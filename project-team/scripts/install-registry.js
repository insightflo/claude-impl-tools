#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const PROJECT_TEAM_DIR = path.resolve(SCRIPT_DIR, '..');
const REGISTRY_PATH = process.env.PROJECT_TEAM_REGISTRY_PATH
  ? path.resolve(process.env.PROJECT_TEAM_REGISTRY_PATH)
  : path.join(PROJECT_TEAM_DIR, 'config', 'topology-registry.json');
const CAPABILITY_MANIFEST_PATH = process.env.PROJECT_TEAM_CAPABILITY_MANIFEST_PATH
  ? path.resolve(process.env.PROJECT_TEAM_CAPABILITY_MANIFEST_PATH)
  : path.join(PROJECT_TEAM_DIR, 'config', 'capability-manifest.json');
const EXPECTED_MODES = ['full', 'lite', 'standard'];
const REQUIRED_LEVEL = 'required';
const ADVISORY_LEVEL = 'advisory';

function stableArray(values) {
  return [...new Set(values)].sort();
}

function readRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function readCapabilityManifest() {
  return JSON.parse(fs.readFileSync(CAPABILITY_MANIFEST_PATH, 'utf8'));
}

function usage() {
  process.stderr.write(
    [
      'Usage:',
      '  node project-team/scripts/install-registry.js validate',
      '  node project-team/scripts/install-registry.js mode <lite|standard|full>',
      '  node project-team/scripts/install-registry.js owned <lite|standard|full>',
      '  node project-team/scripts/install-registry.js hook-config <lite|standard|full> [global|local] [hooks-path]',
      '  node project-team/scripts/install-registry.js runtime-health <lite|standard|full> <target-base> [global|local]'
    ].join('\n') + '\n'
  );
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function ensureModeName(modeName) {
  if (!EXPECTED_MODES.includes(modeName)) {
    throw new Error(`Unknown mode: ${modeName}`);
  }
}

function getCapabilityCatalog(manifest) {
  return manifest && manifest.closureMatrix && manifest.closureMatrix.capabilities
    ? manifest.closureMatrix.capabilities
    : {};
}

function getCapabilitiesForMode(manifest, modeName, kind, level = REQUIRED_LEVEL) {
  ensureModeName(modeName);
  return Object.entries(getCapabilityCatalog(manifest))
    .filter(([, capability]) => capability.kind === kind && capability.installModes && capability.installModes[modeName] === level)
    .map(([capabilityId]) => capabilityId);
}

function getCapabilitiesByModeLevel(manifest, modeName, level) {
  ensureModeName(modeName);
  return Object.entries(getCapabilityCatalog(manifest)).filter(([, capability]) => capability.installModes && capability.installModes[modeName] === level);
}

function formatCapabilityIssue(capabilityId, capability, detail) {
  const remediation = capability && capability.remediationSource
    ? ` Remediation: ${capability.remediationSource}`
    : '';
  return `${capabilityId}: ${detail}.${remediation}`;
}

function listMissingArtifacts(runtimeArtifacts = []) {
  return runtimeArtifacts.filter((artifactPath) => !fs.existsSync(path.join(PROJECT_TEAM_DIR, artifactPath)));
}

function getModeConfig(registry, modeName) {
  const mode = registry.modes[modeName];
  if (!mode) {
    throw new Error(`Unknown mode: ${modeName}`);
  }
  return mode;
}

function getCompatibilityMetadata(registry, modeName) {
  const profileAliases = registry.legacyAliases.profiles.map((profile) => ({
    alias: profile.alias,
    artifact: profile.artifact,
    canonicalRole: profile.canonicalRole,
    installedInMode: modeName === 'full'
  }));

  return {
    ...registry.compatibility,
    agentAliases: registry.legacyAliases.agents,
    profileAliases
  };
}

function getActiveHelperHooks(registry) {
  return Object.entries(registry.hooks.definitions)
    .filter(([, definition]) => definition.installType === 'helper')
    .map(([name, definition]) => {
      const matcherList = definition.matcherListKey
        ? registry.hooks.matcherLists[definition.matcherListKey] || []
        : [];
      return {
        name,
        artifact: definition.artifact,
        event: definition.event,
        matcher: definition.matcher || null,
        matcherListKey: definition.matcherListKey || null,
        matcherList,
        active: matcherList.length > 0
      };
    })
    .filter((helper) => helper.active)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getModeArtifacts(registry, modeName) {
  const mode = getModeConfig(registry, modeName);
  const canonicalAgentArtifacts = mode.canonicalRoles.flatMap((roleName) => registry.roles[roleName].artifacts);
  const compatibilityAgentArtifacts = registry.legacyAliases.agents.map((entry) => entry.artifact);
  const compatibilityProfileArtifacts = mode.compatibilityProfiles.map((profileAlias) => {
    const profile = registry.legacyAliases.profiles.find((entry) => entry.alias === profileAlias);
    if (!profile) {
      throw new Error(`Unknown compatibility profile alias: ${profileAlias}`);
    }
    return profile.artifact;
  });
  const activeHookArtifacts = mode.hookNames.map((hookName) => registry.hooks.definitions[hookName].artifact);
  const activeHelperArtifacts = getActiveHelperHooks(registry).map((helper) => helper.artifact);

  const grouped = {
    agents: stableArray([...canonicalAgentArtifacts, ...compatibilityAgentArtifacts, ...compatibilityProfileArtifacts]),
    hooks: stableArray([...activeHookArtifacts, ...activeHelperArtifacts]),
    templates: stableArray(registry.installerOwnership.commonArtifacts),
    settings: stableArray(registry.installerOwnership.managedSettingsArtifacts)
  };

  return {
    grouped,
    flattened: stableArray([
      ...grouped.agents,
      ...grouped.hooks,
      ...grouped.templates,
      ...grouped.settings
    ])
  };
}

function getDefaultHooksPath(installMode) {
  return installMode === 'global'
    ? '${HOME}/.claude/hooks'
    : '${CLAUDE_PROJECT_DIR:-.}/.claude/hooks';
}

function buildHookConfigPayload(registry, modeName, options = {}) {
  const installMode = options.installMode === 'global' ? 'global' : 'local';
  const hooksPath = options.hooksPath || getDefaultHooksPath(installMode);
  const payload = buildModePayload(registry, modeName);
  const defs = [...payload.hooks.active, ...payload.hooks.helpers];
  const grouped = {};
  const commands = [];

  for (const def of defs) {
    const event = def.event;
    const matcher = def.matcher || null;
    const key = `${event}::${matcher || ''}`;
    if (!grouped[key]) {
      grouped[key] = { event, matcher, hooks: [] };
    }
    const command = `node "${hooksPath}/${path.basename(def.artifact)}"`;
    commands.push(command);
    grouped[key].hooks.push({
      type: 'command',
      command,
      timeout: event === 'Stop' ? 10 : 5,
      statusMessage: `Running ${def.name}...`
    });
  }

  const hooks = {};
  for (const entry of Object.values(grouped)) {
    if (!hooks[entry.event]) {
      hooks[entry.event] = [];
    }
    const group = { hooks: entry.hooks };
    if (entry.matcher) {
      group.matcher = entry.matcher;
    }
    hooks[entry.event].push(group);
  }

  return {
    managed: {
      installer: 'project-team',
      registryVersion: payload.registryVersion || 'unknown',
      mode: payload.mode,
      installMode,
      commands: stableArray(commands)
    },
    hooks
  };
}

function buildReinstallCommand(registry, modeName, installMode) {
  const modeTemplates = ((registry.runtimeHealth || {}).reinstallCommands) || {};
  const template = modeTemplates[installMode] || modeTemplates.local || 'project-team/install.sh --local --mode={mode} --force';
  return template.replace('{mode}', modeName);
}

function buildRuntimeHealthReport(registry, manifest, modeName, targetBase, installMode) {
  ensureModeName(modeName);
  const absoluteBase = path.resolve(targetBase);
  const requiredEntries = getCapabilitiesByModeLevel(manifest, modeName, REQUIRED_LEVEL);
  const advisoryEntries = getCapabilitiesByModeLevel(manifest, modeName, ADVISORY_LEVEL);
  const report = {
    ok: true,
    registryVersion: registry.registryVersion || 'unknown',
    mode: modeName,
    installMode,
    targetBase: absoluteBase,
    required: {
      checkedCapabilities: requiredEntries.length,
      missing: []
    },
    advisory: {
      checkedCapabilities: advisoryEntries.length,
      missing: []
    }
  };

  const evaluateEntries = (entries, bucket, required) => {
    for (const [capabilityId, capability] of entries) {
      for (const artifactPath of capability.runtimeArtifacts || []) {
        const absoluteArtifactPath = path.join(absoluteBase, artifactPath);
        if (fs.existsSync(absoluteArtifactPath)) {
          continue;
        }
        bucket.missing.push({
          capabilityId,
          kind: capability.kind,
          artifact: artifactPath,
          remediationSource: capability.remediationSource,
          reinstallCommand: buildReinstallCommand(registry, modeName, installMode),
          validationCommand: capability.validationCommand || manifest.defaultValidationCommand || 'node project-team/scripts/install-registry.js validate'
        });
        if (required) {
          report.ok = false;
        }
      }
    }
  };

  evaluateEntries(requiredEntries, report.required, true);
  evaluateEntries(advisoryEntries, report.advisory, false);
  return report;
}

function buildModePayload(registry, modeName) {
  const mode = getModeConfig(registry, modeName);
  const artifacts = getModeArtifacts(registry, modeName);

  return {
    registryVersion: registry.registryVersion,
    mode: modeName,
    description: mode.description,
    canonicalRoleCount: mode.canonicalRoles.length,
    canonicalRoles: mode.canonicalRoles.map((roleName) => ({
      id: roleName,
      ...registry.roles[roleName]
    })),
    specialistRoles: mode.canonicalRoles.filter((roleName) => registry.roles[roleName].kind === 'specialist'),
    hooks: {
      active: mode.hookNames.map((hookName) => ({
        name: hookName,
        ...registry.hooks.definitions[hookName]
      })),
      helpers: getActiveHelperHooks(registry)
    },
    compatibility: getCompatibilityMetadata(registry, modeName),
    compatibilityProfiles: mode.compatibilityProfiles,
    artifacts: artifacts.grouped
  };
}

function validateRegistry(registry, capabilityManifest) {
  const issues = [];
  const capabilityCatalog = getCapabilityCatalog(capabilityManifest);
  const expectedCanonicalRoles = capabilityManifest.closureMatrix.canonicalRoleOrder;

  if (!arraysEqual(registry.canonicalRoleOrder, expectedCanonicalRoles)) {
    issues.push('canonicalRoleOrder must match capability-manifest.json');
  }

  const modeNames = Object.keys(registry.modes).sort();
  if (!arraysEqual(modeNames, EXPECTED_MODES)) {
    issues.push('modes must be exactly lite, standard, and full');
  }

  for (const roleName of expectedCanonicalRoles) {
    if (!registry.roles[roleName]) {
      issues.push(`missing canonical role definition: ${roleName}`);
    }
  }

  for (const modeName of EXPECTED_MODES) {
    const mode = registry.modes[modeName];
    if (!mode) {
      continue;
    }
    const expectedRoles = getCapabilitiesForMode(capabilityManifest, modeName, 'role');
    const expectedHooks = getCapabilitiesForMode(capabilityManifest, modeName, 'hook');
    const expectedProfiles = getCapabilitiesForMode(capabilityManifest, modeName, 'profile');
    if (!arraysEqual(mode.canonicalRoles, expectedRoles)) {
      issues.push(`${modeName} canonicalRoles diverged from capability-manifest.json`);
    }
    if (!arraysEqual(mode.hookNames, expectedHooks)) {
      issues.push(`${modeName} hookNames diverged from capability-manifest.json`);
    }
    if (!arraysEqual(mode.compatibilityProfiles, expectedProfiles)) {
      issues.push(`${modeName} compatibilityProfiles diverged from capability-manifest.json`);
    }
  }

  if ((registry.modes.lite.compatibilityProfiles || []).length !== 0) {
    issues.push('lite must not install compatibility profiles');
  }

  if ((registry.modes.standard.compatibilityProfiles || []).length !== 0) {
    issues.push('standard must not install compatibility profiles');
  }

  if (registry.compatibility.installAliasesInEveryMode !== true) {
    issues.push('compatibility aliases must install in every mode');
  }

  if (registry.compatibility.countAliasesInCanonicalTotals !== false) {
    issues.push('compatibility aliases must not count toward canonical role totals');
  }

  if (registry.compatibility.fullModeRestoresLegacyRuntime !== false) {
    issues.push('full mode must not restore the legacy runtime');
  }

  if (registry.capabilityManifest && registry.capabilityManifest.path !== path.relative(PROJECT_TEAM_DIR, CAPABILITY_MANIFEST_PATH).replace(/\\/g, '/')) {
    issues.push('topology registry capabilityManifest.path must point at the active capability manifest');
  }

  for (const [capabilityId, capability] of Object.entries(capabilityCatalog)) {
    if (!capability.validationCommand) {
      issues.push(formatCapabilityIssue(capabilityId, capability, 'missing validationCommand'));
    }
    if (!capability.remediationSource) {
      issues.push(formatCapabilityIssue(capabilityId, capability, 'missing remediationSource'));
    }
    if (!capability.runtimeArtifacts || capability.runtimeArtifacts.length === 0) {
      issues.push(formatCapabilityIssue(capabilityId, capability, 'missing runtimeArtifacts'));
      continue;
    }

    const missingArtifacts = listMissingArtifacts(capability.runtimeArtifacts);
    if (missingArtifacts.length > 0) {
      issues.push(formatCapabilityIssue(capabilityId, capability, `missing runtime artifact(s): ${missingArtifacts.join(', ')}`));
    }

    if (capability.kind === 'role' && registry.roles[capabilityId]) {
      if (!arraysEqual(registry.roles[capabilityId].artifacts, capability.runtimeArtifacts)) {
        issues.push(formatCapabilityIssue(capabilityId, capability, 'role artifacts differ from topology-registry.json'));
      }
    }

    if ((capability.kind === 'hook' || capability.kind === 'helper-hook') && registry.hooks.definitions[capabilityId]) {
      const registryArtifact = registry.hooks.definitions[capabilityId].artifact;
      if (!capability.runtimeArtifacts.includes(registryArtifact)) {
        issues.push(formatCapabilityIssue(capabilityId, capability, `hook artifact ${registryArtifact} is not covered by the manifest runtimeArtifacts`));
      }
    }

    if (capability.kind === 'profile') {
      const profile = registry.legacyAliases.profiles.find((entry) => entry.alias === capabilityId);
      if (!profile) {
        issues.push(formatCapabilityIssue(capabilityId, capability, 'missing compatibility profile definition in topology-registry.json'));
      } else if (!capability.runtimeArtifacts.includes(profile.artifact)) {
        issues.push(formatCapabilityIssue(capabilityId, capability, `profile artifact ${profile.artifact} is not covered by the manifest runtimeArtifacts`));
      }
    }
  }

  for (const alias of registry.legacyAliases.agents) {
    if (!registry.roles[alias.canonicalRole]) {
      issues.push(`legacy agent alias ${alias.alias} targets unknown role ${alias.canonicalRole}`);
    }
  }

  for (const profile of registry.legacyAliases.profiles) {
    if (!registry.roles[profile.canonicalRole]) {
      issues.push(`legacy profile alias ${profile.alias} targets unknown role ${profile.canonicalRole}`);
    }
  }

  for (const hookName of stableArray([
    ...Object.values(registry.modes).flatMap((mode) => mode.hookNames),
    ...Object.keys(registry.hooks.definitions)
  ])) {
    if (!registry.hooks.definitions[hookName]) {
      issues.push(`missing hook definition: ${hookName}`);
    }
  }

  const riskHelper = registry.hooks.definitions['risk-area-warning'];
  if (!riskHelper || riskHelper.installType !== 'helper') {
    issues.push('risk-area-warning must be registered as a helper hook');
  }

  const advisoryHelpers = getCapabilitiesForMode(capabilityManifest, 'full', 'helper-hook', ADVISORY_LEVEL);
  if (!advisoryHelpers.includes('risk-area-warning')) {
    issues.push('risk-area-warning must stay advisory in capability-manifest.json');
  }

  const matcherList = riskHelper && riskHelper.matcherListKey
    ? registry.hooks.matcherLists[riskHelper.matcherListKey] || []
    : [];
  if (matcherList.length === 0) {
    issues.push('risk-area-warning requires a non-empty matcher list in the registry');
  }

  for (const modeName of Object.keys(registry.modes)) {
    try {
      const artifacts = getModeArtifacts(registry, modeName);
      if (artifacts.flattened.length === 0) {
        issues.push(`${modeName} produced an empty artifact inventory`);
      }
    } catch (error) {
      issues.push(`${modeName} artifact generation failed: ${error.message}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    modeSummaries: Object.keys(registry.modes)
      .sort()
      .map((modeName) => ({
        mode: modeName,
        canonicalRoles: registry.modes[modeName].canonicalRoles,
        hookNames: registry.modes[modeName].hookNames,
        compatibilityProfiles: registry.modes[modeName].compatibilityProfiles,
        ownedArtifactCount: getModeArtifacts(registry, modeName).flattened.length
      }))
  };
}

function printJson(value, exitCode) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exit(exitCode);
}

function main(argv) {
  const command = argv[2];
  const argument = argv[3];

  if (!command) {
    usage();
    process.exit(2);
  }

  const registry = readRegistry();
  const capabilityManifest = readCapabilityManifest();

  try {
    switch (command) {
      case 'validate': {
        const result = validateRegistry(registry, capabilityManifest);
        printJson(result, result.ok ? 0 : 1);
        break;
      }
      case 'mode': {
        if (!argument) {
          throw new Error('Missing mode name');
        }
        printJson(buildModePayload(registry, argument), 0);
        break;
      }
      case 'owned': {
        if (!argument) {
          throw new Error('Missing mode name');
        }
        const artifacts = getModeArtifacts(registry, argument);
        printJson(
          {
            registryVersion: registry.registryVersion,
            mode: argument,
            grouped: artifacts.grouped,
            artifacts: artifacts.flattened
          },
          0
        );
        break;
      }
      case 'hook-config': {
        if (!argument) {
          throw new Error('Missing mode name');
        }
        const installMode = argv[4] === 'global' ? 'global' : 'local';
        const hooksPath = argv[5];
        printJson(buildHookConfigPayload(registry, argument, { installMode, hooksPath }), 0);
        break;
      }
      case 'runtime-health': {
        if (!argument) {
          throw new Error('Missing mode name');
        }
        const targetBase = argv[4];
        if (!targetBase) {
          throw new Error('Missing target base path');
        }
        const installMode = argv[5] === 'global' ? 'global' : 'local';
        const report = buildRuntimeHealthReport(registry, capabilityManifest, argument, targetBase, installMode);
        printJson(report, report.ok ? 0 : 1);
        break;
      }
      default:
        usage();
        process.exit(2);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main(process.argv);
}

module.exports = {
  buildModePayload,
  getCapabilitiesForMode,
  getCapabilitiesByModeLevel,
  getModeArtifacts,
  getActiveHelperHooks,
  buildHookConfigPayload,
  buildRuntimeHealthReport,
  readCapabilityManifest,
  readRegistry,
  validateRegistry
};
