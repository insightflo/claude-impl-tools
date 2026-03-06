const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const LINEAR_SYNC_TIMEOUT_MS = 120000;

/**
 * Return true when a command is available on PATH.
 *
 * @param {string} command - Executable name.
 * @returns {boolean} Whether the command exists.
 */
function commandExists(command) {
  if (!command) {
    return false;
  }

  const locator = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(locator, [command], {
    stdio: 'ignore'
  });

  return result.status === 0;
}

/**
 * Find a local or global linear-sync skill directory.
 *
 * @param {string} [projectDir=process.cwd()] - Project root.
 * @returns {string|null} Matched skill directory path.
 */
function findLinearSkillDir(projectDir = process.cwd()) {
  const directCandidates = [
    path.join(projectDir, '.claude', 'skills', 'linear-sync'),
    path.join(os.homedir(), '.claude', 'skills', 'linear-sync')
  ];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  const skillRoots = [
    path.join(projectDir, '.claude', 'skills'),
    path.join(os.homedir(), '.claude', 'skills')
  ];

  for (const root of skillRoots) {
    if (!fs.existsSync(root)) {
      continue;
    }

    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    const match = entries.find(entry =>
      entry.isDirectory()
      && (/linear.*sync/i.test(entry.name) || /sync.*linear/i.test(entry.name))
    );

    if (match) {
      return path.join(root, match.name);
    }
  }

  return null;
}

/**
 * Check whether Linear synchronization support is available.
 *
 * @param {string} [projectDir=process.cwd()] - Project root.
 * @returns {boolean} True when a CLI command or skill directory exists.
 */
function isLinearSyncAvailable(projectDir = process.cwd()) {
  return commandExists('linear-sync') || Boolean(findLinearSkillDir(projectDir));
}

/**
 * Format the current auto-state as a Linear-compatible progress payload.
 *
 * @param {object} autoState - Persisted auto-state payload.
 * @returns {{ title: string, status: string, progress: number, labels: string[], iteration: number }} Progress payload.
 */
function formatProgressForLinear(autoState) {
  const total = Number(autoState && autoState.tasks && autoState.tasks.total) || 0;
  const completed = Number(autoState && autoState.tasks && autoState.tasks.completed) || 0;
  const verdict = String(
    autoState && autoState.last_assessment && autoState.last_assessment.verdict
      ? autoState.last_assessment.verdict
      : 'GAPS'
  ).toUpperCase();

  return {
    title: String(autoState && autoState.contract && autoState.contract.goal
      ? autoState.contract.goal
      : '').trim(),
    status: verdict === 'PASS' ? 'Done' : 'In Progress',
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    labels: ['auto-orchestrator'],
    iteration: Number(autoState && autoState.budget && autoState.budget.current_iteration) || 0
  };
}

/**
 * Sync current orchestration progress to Linear when the integration exists.
 *
 * @param {object} autoState - Persisted auto-state payload.
 * @param {string} [projectDir=process.cwd()] - Project root.
 * @returns {{ synced: boolean, reason?: string, error?: string }} Sync result.
 */
function syncToLinear(autoState, projectDir = process.cwd()) {
  try {
    if (!isLinearSyncAvailable(projectDir)) {
      return {
        synced: false,
        reason: 'linear-sync not available'
      };
    }

    const progress = formatProgressForLinear(autoState);
    const sharedOptions = {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: LINEAR_SYNC_TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 4,
      env: {
        ...process.env,
        LINEAR_SYNC_PROGRESS: JSON.stringify(progress),
        LINEAR_SYNC_TITLE: progress.title,
        LINEAR_SYNC_STATUS: progress.status,
        LINEAR_SYNC_PERCENT: String(progress.progress),
        LINEAR_SYNC_ITERATION: String(progress.iteration)
      }
    };

    let result;

    if (commandExists('linear-sync')) {
      result = spawnSync('linear-sync', [], sharedOptions);
    } else {
      if (!commandExists('claude')) {
        return {
          synced: false,
          error: 'claude command not found'
        };
      }

      const prompt = [
        'Sync TASKS.md to Linear board',
        '',
        'Use the linear-sync skill if available.',
        'Current orchestrator progress:',
        JSON.stringify(progress, null, 2)
      ].join('\n');

      result = spawnSync(
        'claude',
        ['-p', prompt, '--output-format', 'text'],
        sharedOptions
      );
    }

    if (result.error) {
      return {
        synced: false,
        error: result.error.message
      };
    }

    if (result.status !== 0) {
      const stderr = String(result.stderr || result.stdout || '').trim();
      return {
        synced: false,
        error: stderr || `linear-sync exited with code ${result.status}`
      };
    }

    return { synced: true };
  } catch (error) {
    return {
      synced: false,
      error: error.message
    };
  }
}

module.exports = {
  syncToLinear,
  isLinearSyncAvailable,
  formatProgressForLinear
};
