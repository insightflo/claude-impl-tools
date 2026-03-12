#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  loadRecoverySnapshot,
  recoverySnapshotPath,
} = require('../../orchestrate-standalone/scripts/engine/state');
const { loadAutoState } = require('../../orchestrate-standalone/scripts/auto/engine-adapter');
const { buildWhiteboxSummary } = require('../../whitebox/scripts/whitebox-summary');

const AUTO_STATE_REL_PATH = '.claude/orchestrate/auto-state.json';
const ORCHESTRATE_STATE_REL_PATH = '.claude/orchestrate-state.json';
const TASKS_REL_PATH = 'TASKS.md';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    projectDir: process.cwd(),
    json: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--project-dir=')) {
      options.projectDir = path.resolve(arg.slice('--project-dir='.length));
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

function readJsonIfExists(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readTasksHeuristic(projectDir) {
  const tasksPath = path.join(projectDir, TASKS_REL_PATH);
  if (!fs.existsSync(tasksPath)) {
    return { present: false, path: TASKS_REL_PATH, incomplete_count: 0 };
  }

  const content = fs.readFileSync(tasksPath, 'utf8');
  return {
    present: true,
    path: TASKS_REL_PATH,
    incomplete_count: (content.match(/- \[( |\/)\]/g) || []).length,
  };
}

function summarizeOrchestrate(orchestrateState) {
  if (!orchestrateState || !Array.isArray(orchestrateState.tasks)) return null;
  const failed = orchestrateState.tasks.filter((task) => task && (task.status === 'failed' || task.status === 'timeout'));
  const pending = orchestrateState.tasks.filter((task) => task && task.status === 'pending');
  const inProgress = orchestrateState.tasks.filter((task) => task && task.status === 'in_progress');
  return {
    failed_tasks: failed.map((task) => task.id),
    pending_tasks: pending.map((task) => task.id),
    in_progress_tasks: inProgress.map((task) => task.id),
  };
}

function buildResumeOptions(projectDir, autoState, orchestrateState, snapshot) {
  const options = [];

  if (autoState && autoState.pending_gate) {
    options.push({
      id: 'inspect-pending-gate',
      type: 'inspect',
      available: true,
      source: AUTO_STATE_REL_PATH,
      gate_id: autoState.pending_gate.gate_id,
      reason: 'Pending gate requires operator action before resume.',
      command_hint: '/whitebox status',
    });
    options.push({
      id: 'resume-after-approval',
      type: 'resume',
      available: false,
      source: AUTO_STATE_REL_PATH,
      blocked_by: autoState.pending_gate.gate_id,
      reason: 'Resume is blocked until the pending gate is approved or rejected.',
      command_hint: '/whitebox approvals approve --gate-id=<id>',
    });
    return options;
  }

  const orchestrateSummary = summarizeOrchestrate(orchestrateState);
  if (orchestrateSummary && (orchestrateSummary.failed_tasks.length > 0 || orchestrateSummary.pending_tasks.length > 0)) {
    options.push({
      id: 'resume-orchestrate',
      type: 'resume',
      available: true,
      source: ORCHESTRATE_STATE_REL_PATH,
      reason: orchestrateSummary.failed_tasks.length > 0
        ? 'Failed or timed out tasks remain and can be resumed.'
        : 'Pending tasks remain and can be resumed.',
      command_hint: '/orchestrate --resume',
    });
  }

  if (snapshot) {
    options.push({
      id: 'inspect-recovery-snapshot',
      type: 'inspect',
      available: true,
      source: path.relative(projectDir, recoverySnapshotPath(projectDir)),
      reason: snapshot.remediation || 'Recovery snapshot contains the current blocker context.',
      command_hint: '/recover',
    });
  }

  options.push({
    id: 'start-fresh',
    type: 'restart',
    available: true,
    source: 'manual',
    reason: 'Start a new workflow instead of resuming current runtime state.',
    command_hint: '/workflow',
  });

  return options;
}

function buildRecoverStatus(projectDir) {
  const autoState = loadAutoState(projectDir);
  const orchestrateState = readJsonIfExists(path.join(projectDir, ORCHESTRATE_STATE_REL_PATH), null);
  const snapshot = loadRecoverySnapshot(projectDir);
  const summary = buildWhiteboxSummary(projectDir);
  const tasksHeuristic = readTasksHeuristic(projectDir);

  const sources = [
    {
      kind: 'auto-state',
      path: AUTO_STATE_REL_PATH,
      present: Boolean(autoState),
      authoritative: Boolean(autoState),
      notes: autoState && autoState.pending_gate
        ? 'Canonical auto-state is present and currently blocked on a pending gate.'
        : autoState
          ? 'Canonical auto-state is present.'
          : 'Not present.',
    },
    {
      kind: 'orchestrate-state',
      path: ORCHESTRATE_STATE_REL_PATH,
      present: Boolean(orchestrateState),
      authoritative: !autoState && Boolean(orchestrateState),
      notes: orchestrateState ? 'Canonical orchestrate state is present.' : 'Not present.',
    },
    {
      kind: 'recovery-snapshot',
      path: path.relative(projectDir, recoverySnapshotPath(projectDir)),
      present: Boolean(snapshot),
      authoritative: false,
      notes: snapshot ? 'Derived remediation snapshot persisted from canonical runtime state.' : 'No blocked-state snapshot present.',
    },
    {
      kind: 'whitebox-summary',
      path: '.claude/collab/whitebox-summary.json',
      present: fs.existsSync(path.join(projectDir, '.claude', 'collab', 'whitebox-summary.json')),
      authoritative: false,
      notes: 'Derived status view only; not authoritative for resume selection.',
    },
    {
      kind: 'tasks-md-heuristic',
      path: tasksHeuristic.path,
      present: tasksHeuristic.present,
      authoritative: false,
      notes: tasksHeuristic.present
        ? 'Fallback heuristic only; canonical runtime state takes precedence when present.'
        : 'No fallback task file present.',
    },
  ];

  const authoritativeSource = sources.find((source) => source.authoritative) || null;
  const blockers = [];
  if (snapshot) blockers.push(snapshot);
  else if (autoState && autoState.pending_gate) {
    blockers.push({
      source: 'auto-state',
      type: 'pending_gate',
      gate_id: autoState.pending_gate.gate_id,
      gate_name: autoState.pending_gate.gate_name,
      task_id: autoState.pending_gate.task_id,
      remediation: autoState.pending_gate.recommendation || autoState.pending_gate.trigger_reason || 'Resolve the pending gate before resuming.',
      recommendation: autoState.pending_gate.recommendation || null,
      trigger_reason: autoState.pending_gate.trigger_reason || null,
      evidence_paths: [
        path.join(projectDir, AUTO_STATE_REL_PATH),
        path.join(projectDir, '.claude/collab/events.ndjson'),
        path.join(projectDir, '.claude/collab/control-state.json'),
      ].filter((filePath) => fs.existsSync(filePath)),
    });
  } else if (summary.next_remediation_target) blockers.push(summary.next_remediation_target);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    project_dir: projectDir,
    authoritative_source: authoritativeSource,
    sources,
    blockers,
    non_authoritative_heuristics: tasksHeuristic.present ? [{
      kind: 'tasks-md',
      path: tasksHeuristic.path,
      incomplete_count: tasksHeuristic.incomplete_count,
      reason: authoritativeSource
        ? 'Canonical runtime state is available and takes precedence.'
        : 'Fallback only when canonical runtime state is absent.',
    }] : [],
    resume_options: buildResumeOptions(projectDir, autoState, orchestrateState, snapshot),
  };
}

function printHuman(status) {
  const authoritative = status.authoritative_source
    ? `${status.authoritative_source.kind} (${status.authoritative_source.path})`
    : 'none';
  process.stdout.write(`authoritative: ${authoritative}\n`);
  process.stdout.write(`sources:\n`);
  for (const source of status.sources) {
    process.stdout.write(`- ${source.kind}: ${source.present ? 'present' : 'missing'}`);
    if (source.authoritative) process.stdout.write(' [authoritative]');
    process.stdout.write(`\n  ${source.notes}\n`);
  }
  process.stdout.write(`resume options:\n`);
  for (const option of status.resume_options) {
    process.stdout.write(`- ${option.id}: ${option.available ? 'available' : 'blocked'} (${option.type})\n`);
    process.stdout.write(`  ${option.reason}\n`);
  }
  if (status.blockers.length > 0) {
    process.stdout.write(`blockers:\n`);
    for (const blocker of status.blockers) {
      process.stdout.write(`- ${blocker.type || blocker.id || 'blocker'}: ${blocker.remediation || blocker.reason || 'see status json'}\n`);
    }
  }
}

function main() {
  const options = parseArgs();
  const status = buildRecoverStatus(options.projectDir);
  if (options.json) {
    process.stdout.write(JSON.stringify(status, null, 2) + '\n');
    return;
  }
  printHuman(status);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildRecoverStatus,
  parseArgs,
  printHuman,
};
