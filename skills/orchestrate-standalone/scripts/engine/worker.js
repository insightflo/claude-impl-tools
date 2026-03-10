#!/usr/bin/env node
/**
 * Task Worker for Orchestrate Standalone
 *
 * Executes individual tasks and reports results
 *
 * @TASK orchestrate-standalone
 * @SPEC SKILL.md
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createRunId,
  emitRunEventDetailed,
  withExecutorMetadata,
} = require('../../../../project-team/scripts/lib/whitebox-run');

const STATE_FILE = '.claude/orchestrate-state.json';

function buildTaskSyncDecision(task, output) {
  const text = String(output || '');
  if (!/TASKS\.md/i.test(text)) return null;

  const permissionSignals = [
    /requires permission/i,
    /blocked by permissions/i,
    /approve the write/i,
    /approve to mark/i,
    /write permission/i,
    /update was blocked by permissions/i,
    /권한이 필요합니다/,
    /업데이트 권한이 필요합니다/,
    /허용하시면/,
    /마킹하겠습니다/
  ];

  if (!permissionSignals.some((pattern) => pattern.test(text))) {
    return null;
  }

  return {
    id: `DEC-TASKSYNC-${task.id}`,
    type: 'task_sync_permission',
    task_id: task.id,
    task_title: task.description || task.id,
    status: 'pending',
    title: `Approve TASKS.md sync for ${task.id}`,
    reason: 'Task completed but TASKS.md checkbox sync needs write approval.',
    allowed_actions: ['approve', 'reject']
  };
}

async function emitCanonicalEvent(type, data, projectDir = process.cwd(), correlationId = null, stage = type) {
  const result = await emitRunEventDetailed({
    type,
    producer: 'orchestrate-worker',
    correlationId,
    projectDir,
    data,
    stage,
    mode: 'best_effort',
  });
  if (!result.ok) {
    writeStderr(`[worker] canonical event write failed (${type}): ${result.failure.message}`);
  }
  return result;
}

function writeStderr(message) {
  process.stderr.write(`${message}\n`);
}

function persistTaskState(statePath, taskId, status, data = {}) {
  let state = { tasks: [], decisions: [], started_at: new Date().toISOString() };

  if (fs.existsSync(statePath)) {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }

  if (!Array.isArray(state.tasks)) state.tasks = [];
  if (!Array.isArray(state.decisions)) state.decisions = [];

  const taskIndex = state.tasks.findIndex((task) => task.id === taskId);
  const previous = taskIndex >= 0 ? state.tasks[taskIndex] : null;
  const taskState = {
    id: taskId,
    status,
    updated_at: new Date().toISOString(),
    ...data,
  };

  if (taskIndex >= 0) {
    state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...taskState };
  } else {
    state.tasks.push(taskState);
  }

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  return { previousStatus: previous && previous.status ? previous.status : null };
}

function upsertDecision(statePath, decision) {
  try {
    let state = { tasks: [], decisions: [], started_at: new Date().toISOString() };

    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }

    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!Array.isArray(state.decisions)) state.decisions = [];

    const index = state.decisions.findIndex((entry) => entry.id === decision.id);
    const timestamp = new Date().toISOString();
    const next = {
      updated_at: timestamp,
      ...decision
    };

    if (index >= 0) {
      state.decisions[index] = {
        created_at: state.decisions[index].created_at || timestamp,
        ...next
      };
    } else {
      state.decisions.push({ created_at: timestamp, ...next });
    }

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (error) {
    writeStderr(`Failed to update decisions: ${error.message}`);
  }
}

function clearTaskDecisions(statePath, taskId) {
  try {
    if (!fs.existsSync(statePath)) return;
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (!Array.isArray(state.decisions)) return;
    const next = state.decisions.filter((entry) => entry.task_id !== taskId);
    if (next.length === state.decisions.length) return;
    state.decisions = next;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (error) {
    writeStderr(`Failed to clear task decisions: ${error.message}`);
  }
}

async function updateTaskState(statePath, taskId, status, data = {}, options = {}) {
  const { emitEvent = true, emitMode = 'best_effort' } = options;

  try {
    const { previousStatus } = persistTaskState(statePath, taskId, status, data);
    if (!emitEvent) return { ok: true, previousStatus };

    const projectDir = path.dirname(path.dirname(statePath));
    const eventResult = await emitCanonicalEvent('orchestrate.task.status_changed', {
      task_id: taskId,
      from: previousStatus,
      to: status,
      changed: previousStatus !== status,
      has_duration: Number.isFinite(data.duration),
      has_exit_code: Number.isInteger(data.code),
      worker: typeof data.worker === 'string' ? data.worker : null,
    }, projectDir, taskId, 'task_status_changed');

    if (!eventResult.ok) {
      if (emitMode === 'strict') {
      const error = new Error(`Failed to write orchestrate.task.status_changed for ${taskId}: ${eventResult.failure.message}`);
      error.code = 'WHITEBOX_EVENT_WRITE_FAILED';
      error.failure = eventResult.failure;
      throw error;
      }

      writeStderr(`Failed to write orchestrate.task.status_changed for ${taskId}: ${eventResult.failure.message}`);
    }

    return { ok: true, previousStatus, eventWarning: eventResult.ok ? null : eventResult.failure };
  } catch (error) {
    writeStderr(`Failed to update state: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Routing Management
// ---------------------------------------------------------------------------

function stripQuotes(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function normalizeExecutorCandidate(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'codex' || raw.startsWith('codex ')) return 'codex';
  if (raw === 'gemini' || raw.startsWith('gemini ')) return 'gemini';
  if (raw === 'claude' || raw.startsWith('claude ') || raw.startsWith('sonnet') || raw.startsWith('opus') || raw.startsWith('haiku')) {
    return 'claude';
  }
  return raw;
}

function parseModelRoutingFile(filePath, scope) {
  const config = {
    default: 'claude',
    routing: {},
    domains: {},
    taskTypes: {},
    filePath,
    scope,
  };

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  let section = '';
  let nested = '';

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#') || line.trim() === '---') continue;

    const topLevel = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (topLevel && !line.startsWith('  ')) {
      section = topLevel[1];
      nested = '';
      if (section === 'default') {
        config.default = stripQuotes(topLevel[2]) || config.default;
      }
      continue;
    }

    const child = line.match(/^  ([^:\s][^:]*):\s*(.*)$/);
    if (!child) continue;

    const key = child[1].trim();
    const value = stripQuotes(child[2]);
    if (section === 'routing') {
      if (key === 'domains') {
        nested = 'domains';
        continue;
      }
      config.routing[key] = value;
      nested = '';
      continue;
    }
    if (section === 'task_types') {
      config.taskTypes[key] = value;
      continue;
    }

    const grandChild = line.match(/^    ([^:\s][^:]*):\s*(.*)$/);
    if (section === 'routing' && nested === 'domains' && grandChild) {
      config.domains[grandChild[1].trim()] = stripQuotes(grandChild[2]);
    }
  }

  return config;
}

function loadModelRouting(projectDir) {
  const candidates = [
    { filePath: path.join(projectDir, '.claude', 'model-routing.yaml'), scope: 'project' },
    { filePath: path.join(os.homedir(), '.claude', 'model-routing.yaml'), scope: 'global' },
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.filePath)) continue;
    try {
      return parseModelRoutingFile(candidate.filePath, candidate.scope);
    } catch (error) {
      writeStderr(`Failed to parse model-routing.yaml (${candidate.filePath}): ${error.message}`);
    }
  }

  return {
    default: 'claude',
    routing: {},
    domains: {},
    taskTypes: {},
    filePath: null,
    scope: 'default',
  };
}

function wildcardMatches(pattern, value) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(String(value || ''));
}

function resolveRoutingConfig(task, routingConfig) {
  if (!routingConfig) return null;
  if (!routingConfig.filePath) return null;

  const taskType = stripQuotes(task.task_type || task.type || '');
  if (taskType && routingConfig.taskTypes[taskType]) {
    return {
      value: routingConfig.taskTypes[taskType],
      source: `routing.${routingConfig.scope}.task_type`,
    };
  }

  const owner = stripQuotes(task.owner || '');
  if (owner && routingConfig.routing[owner]) {
    return {
      value: routingConfig.routing[owner],
      source: `routing.${routingConfig.scope}.owner`,
    };
  }

  if (owner) {
    for (const [pattern, value] of Object.entries(routingConfig.routing)) {
      if (!pattern.includes('*')) continue;
      if (wildcardMatches(pattern, owner)) {
        return {
          value,
          source: `routing.${routingConfig.scope}.wildcard`,
        };
      }
    }
  }

  const domain = stripQuotes(task.domain || '');
  if (domain && routingConfig.domains[domain]) {
    return {
      value: routingConfig.domains[domain],
      source: `routing.${routingConfig.scope}.domain`,
    };
  }

  if (routingConfig.default) {
    return {
      value: routingConfig.default,
      source: `routing.${routingConfig.scope}.default`,
    };
  }

  return null;
}

function toAgentFileCandidates(owner) {
  const normalized = String(owner || '').trim();
  if (!normalized) return [];
  const pascal = normalized
    .split('-')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join('');
  return [`${normalized}.md`, `${pascal}.md`];
}

function loadAgentCliCommand(owner, projectDir) {
  const filenames = toAgentFileCandidates(owner);
  const directories = [
    path.join(projectDir, '.claude', 'agents'),
    path.resolve(__dirname, '../../../../project-team/agents'),
  ];

  for (const directory of directories) {
    for (const filename of filenames) {
      const filePath = path.join(directory, filename);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) continue;
      for (const line of match[1].split(/\r?\n/)) {
        const cliMatch = line.match(/^cli_command:\s*(.+)$/);
        if (!cliMatch) continue;
        const value = stripQuotes(cliMatch[1]);
        if (!value) continue;
        return {
          value,
          source: 'agent.cli_command',
        };
      }
    }
  }

  return null;
}

function inferExecutorFromTask(task) {
  const haystack = [task.owner, task.domain, task.description, task.title].filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return null;
  if (/(frontend|ui|design|css|component|layout|ux|visual|react)/.test(haystack)) {
    return { value: 'gemini', source: 'heuristic.frontend' };
  }
  if (/(backend|api|server|database|db|schema|migration|endpoint|test|testing|auth|payment)/.test(haystack)) {
    return { value: 'codex', source: 'heuristic.backend' };
  }
  if (/(architecture|architect|planning|plan|governance|security|audit|review)/.test(haystack)) {
    return { value: 'claude', source: 'heuristic.reasoning' };
  }
  return null;
}

function resolveCliCommand(task, projectDir, defaultClaudePath = 'claude') {
  let resolution = task.model
    ? { value: task.model, source: 'task.model' }
    : loadAgentCliCommand(task.owner, projectDir)
      || resolveRoutingConfig(task, loadModelRouting(projectDir))
      || inferExecutorFromTask(task)
      || { value: 'claude', source: 'fallback.default' };

  let model = resolution.value;
  let routeSource = resolution.source;
  let fallbackReason = null;

  const rawModel = String(model || 'claude').trim().toLowerCase();
  const normalizedExecutor = normalizeExecutorCandidate(rawModel);

  let resolvedModel = 'claude';
  if (normalizedExecutor === 'codex' || normalizedExecutor === 'gemini') {
    resolvedModel = normalizedExecutor;
  } else if (normalizedExecutor === 'claude') {
    resolvedModel = 'claude';
  } else {
    writeStderr(`[Warning] Unknown model '${rawModel}'. Falling back to 'claude'.`);
    resolvedModel = 'claude';
    fallbackReason = 'unknown_model';
  }

  let command = defaultClaudePath;
  let args = [];
  const requestedExecutor = normalizedExecutor || rawModel;

  if (resolvedModel === 'codex') {
    command = 'codex';
    args = ['exec'];
  } else if (resolvedModel === 'gemini') {
    command = 'gemini';
    args = [];
  }

  if (command !== defaultClaudePath) {
    try {
      const checkCmd = process.platform === 'win32' ? 'where' : 'which';
      execSync(`${checkCmd} ${command}`, { stdio: 'ignore' });
    } catch (e) {
      writeStderr(`[Warning] CLI '${command}' not found. Falling back to '${defaultClaudePath}'.`);
      fallbackReason = `missing_cli:${command}`;
      command = defaultClaudePath;
      args = [];
      resolvedModel = 'claude';
    }
  }

  return { command, args, model: resolvedModel, requestedExecutor, routeSource, fallbackReason };
}

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
    timeout = 300000, // 5 minutes default
    taskControl = null
  } = options;

  const statePath = path.join(projectDir, STATE_FILE);

  return new Promise((resolve, reject) => {
    void (async () => {
    const startTime = Date.now();
    let timeoutHandle = null;
    let finalized = false;
    const layerAbortMessage = `Task ${task.id} cancelled because another task in the same layer failed`;

    if (taskControl && typeof taskControl === 'object') {
      taskControl.cancelRequested = false;
      taskControl.abortExecution = null;
      taskControl.cancel = () => {
        taskControl.cancelRequested = true;
        if (typeof taskControl.abortExecution === 'function') {
          taskControl.abortExecution();
        }
      };
    }

    // Prepare prompt
    const prompt = `
Execute the following task:

**Task ID**: ${task.id}
**Description**: ${task.description}
**Domain**: ${task.domain || 'general'}
**Risk Level**: ${task.risk}
**Owner**: ${task.owner || 'default'}

Please complete this task and report back when done.
`;

    // Resolve which CLI to use based on routing rules
    const runId = task.run_id || createRunId('multi-ai-run', task.id);

    async function maybeFinalizeLayerAbort() {
      if (!(taskControl && taskControl.cancelRequested)) return false;

      clearTaskDecisions(statePath, task.id);
      await finalizeExecution({
        status: 'failed',
        outcome: 'error',
        exitCode: null,
        stateData: {
          error: 'Cancelled because another task in the same layer failed',
          code: 'LAYER_ABORTED',
        },
        error: new Error(layerAbortMessage),
      });
      return true;
    }

    const { command, args, model, requestedExecutor, routeSource, fallbackReason } = resolveCliCommand(task, projectDir, claudePath);
    process.stderr.write(`[worker] Task ${task.id} → ${command} (model: ${model})\n`);

    await emitCanonicalEvent('multi_ai_run.route.selected', {
      run_id: runId,
      task_id: task.id,
      owner: task.owner || 'default',
      route_source: routeSource,
      requested_executor: requestedExecutor,
      command,
      ...withExecutorMetadata(model),
    }, projectDir, task.id, 'route_selected');

    if (await maybeFinalizeLayerAbort()) return;

    if (fallbackReason) {
      await emitCanonicalEvent('multi_ai_run.route.fallback', {
        run_id: runId,
        task_id: task.id,
        owner: task.owner || 'default',
        route_source: routeSource,
        requested_executor: requestedExecutor,
        fallback_reason: fallbackReason,
        fallback_executor: model,
        command,
        ...withExecutorMetadata(model),
      }, projectDir, task.id, 'route_fallback');

    }

    if (await maybeFinalizeLayerAbort()) return;

    await emitCanonicalEvent('orchestrate.execution.start', {
      run_id: runId,
      task_id: task.id,
      domain: task.domain || 'general',
      risk: task.risk || 'low',
      owner: task.owner || 'default',
      model,
      command,
      ...withExecutorMetadata(model),
    }, projectDir, task.id, 'execution_start');

    if (await maybeFinalizeLayerAbort()) return;

    // Update state to "in_progress"
    try {
      await updateTaskState(statePath, task.id, 'in_progress', { worker: 'worker-' + process.pid % 4 });
    } catch (error) {
      reject(error);
      return;
    }

    if (await maybeFinalizeLayerAbort()) return;

    // Spawn the selected CLI
    const cli = spawn(command, args, {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_AGENT_ROLE: task.owner || 'default',
        CLAUDE_TASK_ID: task.id,
        WHITEBOX_RUN_ID: runId,
      }
    });

    if (taskControl && typeof taskControl === 'object') {
      taskControl.abortExecution = () => {
        void maybeFinalizeLayerAbort();
        cli.kill('SIGTERM');
      };
    }

    let output = '';
    let errorOutput = '';

    async function finalizeExecution(result) {
      if (finalized) return;
      finalized = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (taskControl && typeof taskControl === 'object') {
        taskControl.abortExecution = null;
      }

      const duration = Number.isFinite(result.durationMs) ? result.durationMs : (Date.now() - startTime);
      const stateData = {
        duration,
        ...result.stateData,
      };

      await emitCanonicalEvent('orchestrate.execution.finish', {
        run_id: runId,
        task_id: task.id,
        outcome: result.outcome,
        duration_ms: duration,
        exit_code: result.exitCode,
        ...(result.timeout ? { timeout: true } : {}),
        ...withExecutorMetadata(model),
      }, projectDir, task.id, 'execution_finish');

      try {
        await updateTaskState(statePath, task.id, result.status, stateData);
      } catch (error) {
        reject(error);
        return;
      }

      if (result.status === 'completed') {
        resolve({ id: task.id, status: 'completed', duration, output });
        return;
      }

      reject(result.error instanceof Error ? result.error : new Error(String(result.error || `Task ${task.id} failed`)));
    }

    cli.stdout.on('data', (data) => {
      output += data.toString();
    });

    cli.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    cli.on('error', async (err) => {
      await finalizeExecution({
        status: 'failed',
        outcome: 'error',
        exitCode: null,
        stateData: {
          error: err.message,
        },
        error: new Error(`Task ${task.id} failed to start: ${err.message}`),
      });
    });

    cli.on('close', async (code) => {
      if (code === 0) {
        const decision = buildTaskSyncDecision(task, output);
        if (decision) {
          upsertDecision(statePath, decision);
        } else {
          clearTaskDecisions(statePath, task.id);
        }
        await finalizeExecution({
          status: 'completed',
          outcome: 'pass',
          exitCode: 0,
          stateData: {
            output: output.slice(-500),
            worker: 'worker-' + process.pid % 4,
          },
        });
      } else {
        clearTaskDecisions(statePath, task.id);
        await finalizeExecution({
          status: 'failed',
          outcome: 'deny',
          exitCode: Number.isInteger(code) ? code : null,
          stateData: {
            error: errorOutput.slice(-500) || `Process exited with code ${code}`,
            code,
          },
          error: new Error(`Task ${task.id} failed with code ${code}`),
        });
      }
    });

    // Timeout handling
    timeoutHandle = setTimeout(() => {
      cli.kill('SIGTERM');
      clearTaskDecisions(statePath, task.id);
      void finalizeExecution({
        status: 'timeout',
        outcome: 'error',
        exitCode: null,
        durationMs: timeout,
        stateData: {},
        timeout: true,
        error: new Error(`Task ${task.id} timed out after ${timeout}ms`),
      });
    }, timeout);

    // Send prompt
    cli.stdin.write(prompt);
    cli.stdin.end();
    })().catch(reject);
  });
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
  let stopScheduling = false;

  function cancelSiblingTasks(excludeTaskId) {
    for (const entry of executing) {
      if (entry.task.id === excludeTaskId) continue;
      if (entry.control && typeof entry.control.cancel === 'function') {
        entry.control.cancel();
      }
    }
  }

  for (const task of layer) {
    if (stopScheduling) break;

    const control = { cancel: null };
    const entry = { task, control, promise: null };
    const p = executeTask(task, { taskControl: control })
      .then(result => {
        executing.splice(executing.indexOf(entry), 1);
        results.push(result);
        return result;
      })
      .catch(error => {
        executing.splice(executing.indexOf(entry), 1);
        if (!stopScheduling) {
          stopScheduling = true;
          cancelSiblingTasks(task.id);
        }
        const res = { id: task.id, status: 'failed', error: error.message };
        results.push(res);
        return res;
      });

    entry.promise = p;
    executing.push(entry);

    if (executing.length >= workerCount) {
      await Promise.race(executing.map(item => item.promise));
    }
  }

  await Promise.all(executing.map(item => item.promise));
  return results;
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

if (require.main === module) {
  const taskArg = process.argv[2];
  const projectDir = process.argv[3] || process.cwd();

  if (!taskArg) {
    writeStderr('Usage: node worker.js <taskJson|taskId> [projectDir]');
    process.exit(1);
  }

  // JSON 문자열이면 파싱, 아니면 최소 task 객체 생성
  let task;
  try {
    task = JSON.parse(taskArg);
  } catch {
    task = { id: taskArg, description: taskArg, domain: 'general', risk: 'low' };
  }

  executeTask(task, { projectDir, timeout: 300000 })
    .then(result => {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    })
    .catch(error => {
      writeStderr(JSON.stringify({ error: error.message }, null, 2));
      process.exit(1);
    });
}

module.exports = {
  executeTask,
  executeLayer,
  updateTaskState,
  loadModelRouting,
  resolveCliCommand
};
