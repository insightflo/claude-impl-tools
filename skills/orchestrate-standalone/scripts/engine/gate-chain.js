#!/usr/bin/env node
/**
 * Gate Chain for Orchestrate Standalone
 *
 * Runs project-team hooks in sequence before/after task execution
 *
 * @TASK orchestrate-standalone
 * @SPEC SKILL.md
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { writeEvent } = require('../../../../project-team/scripts/lib/whitebox-events');

const INSTALL_STATE_REL_PATH = path.join('.claude', 'project-team-install-state.json');

function toTaskMeta(task) {
  if (!task || typeof task !== 'object') return null;
  return {
    id: task.id || null,
    title: task.title || task.description || null,
    domain: task.domain || null,
    risk: task.risk || null,
  };
}

function toTaskListMeta(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .map((task) => {
      if (!task) return null;
      if (typeof task === 'string') return { id: task, title: null, domain: null, risk: null };
      return toTaskMeta(task);
    })
    .filter(Boolean);
}

function buildGateEventPayload(hookName, context, extras = {}) {
  const payload = {
    gate: hookName,
    phase: context.phase || null,
    layer: Number.isInteger(context.layer) ? context.layer : null,
    task: toTaskMeta(context.task),
    ...extras,
  };

  const taskList = toTaskListMeta(context.tasks);
  if (taskList.length > 0) {
    return {
      ...payload,
      scope: 'barrier',
      task_ids: taskList.map((task) => task.id).filter(Boolean),
      tasks: taskList,
    };
  }

  return payload;
}

function getEventCorrelationId(payload) {
  if (payload.task && payload.task.id) return payload.task.id;
  if (payload.scope === 'barrier' && Number.isInteger(payload.layer)) {
    return `layer:${payload.layer}`;
  }
  return null;
}

function readJsonIfExists(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function getInstallState(projectDir = process.cwd()) {
  return readJsonIfExists(path.join(projectDir, INSTALL_STATE_REL_PATH), null);
}

function getInstalledHookSet(projectDir = process.cwd()) {
  const installState = getInstallState(projectDir);
  if (!installState || !Array.isArray(installState.ownedArtifacts)) return null;

  return new Set(
    installState.ownedArtifacts
      .filter((artifact) => typeof artifact === 'string' && artifact.startsWith('hooks/') && artifact.endsWith('.js'))
      .map((artifact) => path.basename(artifact, '.js'))
  );
}

function isInstalledHookRequired(hookName, projectDir = process.cwd()) {
  const installedHooks = getInstalledHookSet(projectDir);
  if (!installedHooks) return false;
  return installedHooks.has(hookName);
}

function parseHookOutput(output) {
  const trimmed = typeof output === 'string' ? output.trim() : '';
  if (!trimmed) return null;

  const candidates = [trimmed, ...trimmed.split('\n').map((line) => line.trim()).filter(Boolean).reverse()];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
    }
  }

  return null;
}

function normalizeDecision(decision) {
  if (typeof decision !== 'string') return null;
  const normalized = decision.trim().toLowerCase();
  return normalized || null;
}

function summarizeHookFailure(parsedOutput, fallbackError) {
  if (!parsedOutput || typeof parsedOutput !== 'object') {
    return {
      summary: fallbackError || 'Gate returned a failing result.',
      recommendation: 'Inspect the hook output and remediate the failing gate before retrying.',
    };
  }

  const summary = typeof parsedOutput.reason === 'string' && parsedOutput.reason.trim()
    ? parsedOutput.reason.trim()
    : typeof parsedOutput.summary === 'string' && parsedOutput.summary.trim()
      ? parsedOutput.summary.trim()
      : fallbackError || 'Gate returned a failing result.';

  const recommendation = typeof parsedOutput.remediation === 'string' && parsedOutput.remediation.trim()
    ? parsedOutput.remediation.trim()
    : 'Inspect the hook output and remediate the failing gate before retrying.';

  return { summary, recommendation };
}

function buildApprovalGate(hookName, context, failure = {}) {
  const payload = buildGateEventPayload(hookName, context);
  const scopeId = getEventCorrelationId(payload)
    || `${context.phase || 'gate'}:${hookName}`;
  const sanitizedScopeId = String(scopeId).replace(/[^a-zA-Z0-9:_-]/g, '-');
  const gateId = `gate:${hookName}:${sanitizedScopeId}`;
  const taskIds = Array.isArray(payload.task_ids) ? payload.task_ids : [];

  return {
    actor: 'system',
    gate_id: gateId,
    correlation_id: gateId,
    gate_name: hookName,
    stage: context.phase || null,
    layer: Number.isInteger(payload.layer) ? payload.layer : null,
    task_id: payload.task && payload.task.id ? payload.task.id : null,
    task_ids: taskIds,
    run_id: context.run_id || null,
    choices: ['approve', 'reject'],
    default_behavior: 'wait_for_operator',
    timeout_policy: 'manual_remediation',
    created_at: new Date().toISOString(),
    preview: failure.summary || `${hookName} requires approval before orchestration can continue.`,
    trigger_type: failure.triggerType || 'hook_gate_denied',
    trigger_reason: failure.summary || `${hookName} blocked orchestration.`,
    recommendation: failure.recommendation || 'Remediate the failing gate before retrying.',
  };
}

async function emitApprovalLifecycleForFailure(hookName, context, failure = {}) {
  const gate = buildApprovalGate(hookName, context, failure);
  const approvalRequired = await emitCanonicalEvent('approval_required', gate, gate.correlation_id || gate.gate_id, 'approval_required');
  if (!approvalRequired.ok) return approvalRequired;

  return emitCanonicalEvent('execution_paused', gate, gate.correlation_id || gate.gate_id, 'execution_paused');
}

async function emitCanonicalEvent(type, data, correlationId = null, stage = type) {
  try {
    await writeEvent({
      type,
      producer: 'orchestrate-gate-chain',
      correlation_id: correlationId || undefined,
      data,
    }, {
      projectDir: process.cwd(),
    });
    return { ok: true, error: null, failure: null };
  } catch (error) {
    const failure = {
      stage,
      event_type: type,
      message: error && error.message ? error.message : String(error),
      code: error && error.code ? error.code : null,
    };
    process.stderr.write(`[gate-chain] canonical event write failed (${type}): ${failure.message}\n`);
    return { ok: false, error, failure };
  }
}

// ---------------------------------------------------------------------------
// Hook Execution
// ---------------------------------------------------------------------------

/**
 * Run a single hook
 */
async function runHook(hookName, context = {}) {
  const hooksDir = path.join(process.cwd(), '.claude', 'hooks');
  const hookPath = path.join(hooksDir, `${hookName}.js`);
  const startPayload = buildGateEventPayload(hookName, context);
  const correlationId = getEventCorrelationId(startPayload);

  const startEvent = await emitCanonicalEvent('orchestrate.gate.start', startPayload, correlationId, 'gate_start');
  if (!startEvent.ok) {
    return {
      hook: hookName,
      passed: false,
      code: null,
      output: '',
      error: `canonical event write failed: ${startEvent.failure.message}`,
      write_error: startEvent.failure,
    };
  }

  if (!fs.existsSync(hookPath)) {
    const requiredHook = isInstalledHookRequired(hookName, process.cwd());
    if (requiredHook) {
      const failure = {
        triggerType: 'missing_required_hook',
        summary: `Required installed hook "${hookName}" is missing from .claude/hooks.`,
        recommendation: 'Reinstall project-team hooks or restore the missing gate before retrying.',
      };
      const approvalEvent = await emitApprovalLifecycleForFailure(hookName, context, failure);
      if (!approvalEvent.ok) {
        return {
          hook: hookName,
          passed: false,
          code: null,
          output: '',
          error: `canonical event write failed: ${approvalEvent.failure.message}`,
          write_error: approvalEvent.failure,
        };
      }

      const missingHookPayload = buildGateEventPayload(hookName, context, {
        outcome: 'deny',
        reason: 'missing_required_hook',
        required: true,
      });
      const missingHookEvent = await emitCanonicalEvent('orchestrate.gate.outcome', missingHookPayload, correlationId, 'gate_outcome');
      if (!missingHookEvent.ok) {
        return {
          hook: hookName,
          passed: false,
          code: null,
          output: '',
          error: `canonical event write failed: ${missingHookEvent.failure.message}`,
          write_error: missingHookEvent.failure,
        };
      }

      return {
        hook: hookName,
        passed: false,
        code: null,
        output: '',
        error: failure.summary,
        remediation: failure.recommendation,
        missing: true,
        required: true,
      };
    }

    const missingHookPayload = buildGateEventPayload(hookName, context, {
      outcome: 'skip',
      reason: 'missing_hook',
    });
    const missingHookEvent = await emitCanonicalEvent('orchestrate.gate.outcome', missingHookPayload, correlationId, 'gate_outcome');
    if (!missingHookEvent.ok) {
      return {
        hook: hookName,
        passed: false,
        code: null,
        output: '',
        error: `canonical event write failed: ${missingHookEvent.failure.message}`,
        write_error: missingHookEvent.failure,
      };
    }
    return { passed: true, skipped: true, hook: hookName };
  }

  return new Promise((resolve) => {
    let settled = false;

    const settle = async (payload) => {
      if (settled) return;
      settled = true;

      const parsedOutput = parseHookOutput(payload.output);
      const decision = normalizeDecision(parsedOutput && parsedOutput.decision);
      const deniedByDecision = decision === 'deny' || decision === 'block';
      const failureSummary = summarizeHookFailure(parsedOutput, payload.error);
      const finalPayload = {
        ...payload,
        passed: payload.passed && !deniedByDecision,
        decision,
        error: deniedByDecision && !payload.error ? failureSummary.summary : payload.error,
        remediation: failureSummary.recommendation,
      };

      if (!finalPayload.passed && !finalPayload.skipped) {
        const approvalEvent = await emitApprovalLifecycleForFailure(hookName, context, {
          triggerType: deniedByDecision ? 'hook_gate_denied' : 'hook_gate_failed',
          summary: failureSummary.summary,
          recommendation: failureSummary.recommendation,
        });
        if (!approvalEvent.ok) {
          resolve({
            hook: hookName,
            passed: false,
            code: null,
            output: finalPayload.output,
            error: `canonical event write failed: ${approvalEvent.failure.message}`,
            write_error: approvalEvent.failure,
          });
          return;
        }
      }

      const outcome = finalPayload.skipped
        ? 'skip'
        : finalPayload.passed
          ? 'pass'
          : finalPayload.code === null
            ? 'error'
            : 'deny';

      const outcomePayload = buildGateEventPayload(hookName, context, {
        outcome,
        code: Number.isInteger(finalPayload.code) ? finalPayload.code : null,
        skipped: Boolean(finalPayload.skipped),
        has_error_output: Boolean(finalPayload.error),
        decision,
      });
      const outcomeEvent = await emitCanonicalEvent('orchestrate.gate.outcome', outcomePayload, correlationId, 'gate_outcome');

      if (!outcomeEvent.ok) {
        resolve({
          hook: hookName,
          passed: false,
          code: null,
          output: finalPayload.output,
          error: `canonical event write failed: ${outcomeEvent.failure.message}`,
          write_error: outcomeEvent.failure,
        });
        return;
      }

      resolve(finalPayload);
    };

    const hook = spawn('node', [hookPath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    hook.stdout.on('data', (data) => {
      output += data.toString();
    });

    hook.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    hook.on('error', (error) => {
      void settle({
        hook: hookName,
        passed: false,
        code: null,
        output: output.slice(-1000),
        error: String(error && error.message ? error.message : 'spawn_error').slice(-500)
      });
    });

    hook.on('close', (code) => {
      void settle({
        hook: hookName,
        passed: code === 0,
        code,
        output: output.slice(-1000),
        error: errorOutput.slice(-500)
      });
    });

    // Send context as JSON
    hook.stdin.write(JSON.stringify({
      hook_event_name: 'orchestrate_gate',
      tool_name: 'orchestrate-standalone',
      tool_input: context
    }));
    hook.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Gate Chains
// ---------------------------------------------------------------------------

/**
 * Pre-Dispatch Gate (before task execution)
 */
async function preDispatchGate(task) {
  const results = [];

  // 1. policy-gate (권한 + 표준)
  const policyResult = await runHook('policy-gate', { task, phase: 'pre-dispatch' });
  results.push(policyResult);

  if (!policyResult.passed && !policyResult.skipped) {
    return { passed: false, gate: 'pre-dispatch', reason: 'policy-gate failed', results };
  }

  // 2. risk-gate (영향도 + 위험도)
  const riskResult = await runHook('risk-gate', { task, phase: 'pre-dispatch' });
  results.push(riskResult);

  if (!riskResult.passed && !riskResult.skipped) {
    return { passed: false, gate: 'pre-dispatch', reason: 'risk-gate failed', results };
  }

  return { passed: true, results };
}

/**
 * Post-Task Gate (after task execution)
 */
async function postTaskGate(task) {
  const results = [];

  // 1. contract-gate (API 계약 검증)
  const contractResult = await runHook('contract-gate', { task, phase: 'post-task' });
  results.push(contractResult);

  // 2. docs-gate (문서 + 변경 이력)
  const docsResult = await runHook('docs-gate', { task, phase: 'post-task' });
  results.push(docsResult);

  // 3. task-sync (TASKS.md 업데이트) - handled by docs-gate
  const syncResult = await runHook('task-sync', { task, phase: 'post-task' });
  results.push(syncResult);

  const failed = results.filter(r => !r.passed && !r.skipped);
  return {
    passed: failed.length === 0,
    results,
    failed: failed.map(r => r.hook)
  };
}

/**
 * Phase/Layer Barrier Gate (between layers)
 */
async function barrierGate(layerIndex, tasks) {
  const results = [];

  // 1. quality-gate (품질 게이트)
  const qualityResult = await runHook('quality-gate', {
    layer: layerIndex,
    tasks,
    phase: 'barrier'
  });
  results.push(qualityResult);

  // 2. security-scan (보안 스캔)
  const securityResult = await runHook('security-scan', {
    layer: layerIndex,
    tasks,
    phase: 'barrier'
  });
  results.push(securityResult);

  const failed = results.filter(r => !r.passed && !r.skipped);
  return {
    passed: failed.length === 0,
    results,
    failed: failed.map(r => r.hook)
  };
}

// ---------------------------------------------------------------------------
// Full Gate Pipeline
// ---------------------------------------------------------------------------

/**
 * Run complete gate pipeline for a layer
 */
async function runGatePipeline(layer, layerIndex) {
  // Pre-dispatch for each task in layer
  for (const task of layer) {
    const preResult = await preDispatchGate(task);
    if (!preResult.passed) {
      return {
        passed: false,
        stage: 'pre-dispatch',
        task: task.id,
        reason: preResult.reason
      };
    }
  }

  // (Tasks would be executed here by orchestrate.sh)

  // Post-task for each task in layer
  for (const task of layer) {
    const postResult = await postTaskGate(task);
    if (!postResult.passed) {
      return {
        passed: false,
        stage: 'post-task',
        task: task.id,
        reason: `Hooks failed: ${postResult.failed.join(', ')}`
      };
    }
  }

  // Barrier after layer completes
  const barrierResult = await barrierGate(layerIndex, layer);
  if (!barrierResult.passed) {
    return {
      passed: false,
      stage: 'barrier',
      layer: layerIndex,
      reason: `Hooks failed: ${barrierResult.failed.join(', ')}`
    };
  }

  return { passed: true };
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'pre-dispatch': {
      const task = JSON.parse(args[0]);
      preDispatchGate(task)
        .then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(err => console.error(JSON.stringify({ error: err.message }, null, 2)));
      break;
    }

    case 'post-task': {
      const task = JSON.parse(args[0]);
      postTaskGate(task)
        .then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(err => console.error(JSON.stringify({ error: err.message }, null, 2)));
      break;
    }

    case 'barrier': {
      const layerIndex = parseInt(args[0]);
      const tasks = JSON.parse(args[1]);
      barrierGate(layerIndex, tasks)
        .then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(err => console.error(JSON.stringify({ error: err.message }, null, 2)));
      break;
    }

    case 'pipeline': {
      const layer = JSON.parse(args[0]);
      const layerIndex = parseInt(args[1]);
      runGatePipeline(layer, layerIndex)
        .then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(err => console.error(JSON.stringify({ error: err.message }, null, 2)));
      break;
    }

    default:
      console.log(`
Usage: node gate-chain.js <command> [args]

Commands:
  pre-dispatch <taskJson>    Run pre-dispatch gate for a task
  post-task <taskJson>       Run post-task gate for a task
  barrier <layerIndex>       Run barrier gate after layer
  pipeline <layerJson>      Run full pipeline for a layer
      `);
  }
}

module.exports = {
  runHook,
  preDispatchGate,
  postTaskGate,
  barrierGate,
  runGatePipeline
};
