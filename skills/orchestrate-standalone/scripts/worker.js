#!/usr/bin/env node
/**
 * Task Worker for Orchestrate Standalone
 *
 * Executes individual tasks and reports results
 *
 * @TASK orchestrate-standalone
 * @SPEC SKILL.md
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Task Execution
// ---------------------------------------------------------------------------

/**
 * Execute a single task
 */
async function executeTask(task, options = {}) {
  const {
    claudePath = 'claude',
    projectDir = process.cwd(),
    timeout = 300000 // 5 minutes default
  } = options;

  const statePath = path.join(projectDir, '.claude', 'orchestrate-state.json');

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Update state to "in_progress"
    updateTaskState(statePath, task.id, 'in_progress', { worker: 'worker-' + process.pid % 4 });

    // Prepare prompt for Claude
    const prompt = `
Execute the following task:

**Task ID**: ${task.id}
**Description**: ${task.description}
**Domain**: ${task.domain || 'general'}
**Risk Level**: ${task.risk}
**Owner**: ${task.owner || 'default'}

Please complete this task and report back when done.
`;

    // Spawn Claude CLI
    const claude = spawn(claudePath, [], {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_AGENT_ROLE: task.owner || 'default' }
    });

    let output = '';
    let errorOutput = '';

    claude.stdout.on('data', (data) => {
      output += data.toString();
    });

    claude.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    claude.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        updateTaskState(statePath, task.id, 'completed', {
          duration,
          output: output.slice(-500), // Last 500 chars
          worker: 'worker-' + process.pid % 4
        });
        resolve({ id: task.id, status: 'completed', duration, output });
      } else {
        updateTaskState(statePath, task.id, 'failed', {
          duration,
          error: errorOutput.slice(-500),
          code
        });
        reject(new Error(`Task ${task.id} failed with code ${code}`));
      }
    });

    // Timeout handling
    const timeoutHandle = setTimeout(() => {
      claude.kill('SIGTERM');
      updateTaskState(statePath, task.id, 'timeout', { duration: timeout });
      reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
    }, timeout);

    claude.on('close', () => {
      clearTimeout(timeoutHandle);
    });

    // Send prompt
    claude.stdin.write(prompt);
    claude.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

/**
 * Update task state in orchestrate-state.json
 */
function updateTaskState(statePath, taskId, status, data = {}) {
  try {
    let state = { tasks: [], started_at: new Date().toISOString() };

    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }

    const taskIndex = state.tasks.findIndex(t => t.id === taskId);
    const taskState = {
      id: taskId,
      status,
      updated_at: new Date().toISOString(),
      ...data
    };

    if (taskIndex >= 0) {
      state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...taskState };
    } else {
      state.tasks.push(taskState);
    }

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error(`Failed to update state: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Parallel Execution
// ---------------------------------------------------------------------------

/**
 * Execute multiple tasks in parallel (respecting worker pool size)
 */
async function executeLayer(layer, workerCount = 2) {
  const results = [];
  const executing = [];

  for (const task of layer) {
    const promise = executeTask(task).then(result => {
      results.push(result);
      return result;
    }).catch(error => {
      results.push({ id: task.id, status: 'failed', error: error.message });
      return { id: task.id, status: 'failed', error: error.message };
    });

    executing.push(promise);

    // Wait for one to finish if pool is full
    if (executing.length >= workerCount) {
      await Promise.race(executing);
      // Remove completed from executing
      const completedIndex = executing.findIndex(p =>
        results.some(r => r.id && p.toString().includes(r.id))
      );
      if (completedIndex >= 0) {
        executing.splice(completedIndex, 1);
      }
    }
  }

  await Promise.all(executing);
  return results;
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

if (require.main === module) {
  const taskId = process.argv[2];
  const mode = process.argv[3] || 'standard';

  if (!taskId) {
    console.error('Usage: node worker.js <taskId> [mode]');
    process.exit(1);
  }

  // Worker pool size based on mode
  const workerCount = { lite: 2, standard: 4, full: 8 }[mode] || 4;

  executeTask({ id: taskId }, { timeout: 300000 })
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error(JSON.stringify({ error: error.message }, null, 2));
      process.exit(1);
    });
}

module.exports = {
  executeTask,
  executeLayer,
  updateTaskState
};
