#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  setStaleMarker,
  clearStaleMarker,
  readMarkers,
} = require('../../../project-team/scripts/collab-derived-meta');
const { readTasksStats } = require('../../statusline/lib/tasks-status');
const { readControlState } = require('./whitebox-control-state');

const WHITEBOX_SUMMARY_SCHEMA_VERSION = '1.0';
const WHITEBOX_SUMMARY_REL_PATH = '.claude/collab/whitebox-summary.json';
const BOARD_STATE_REL_PATH = '.claude/collab/board-state.json';
const TASKS_STATUS_REL_PATH = '.claude/cache/tasks-status.json';
const RUNS_REL_PATH = '.claude/collab/runs';
const ORCHESTRATE_STATE_REL_PATHS = [
  '.claude/orchestrate/orchestrate-state.json',
  '.claude/orchestrate-state.json',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    projectDir: process.cwd(),
    json: false,
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--project-dir=')) {
      options.projectDir = path.resolve(arg.slice('--project-dir='.length));
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
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

function writeJsonAtomic(filePath, payload) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function loadTasksStats(projectDir) {
  for (const relativePath of ORCHESTRATE_STATE_REL_PATHS) {
    const orchestratePath = path.join(projectDir, relativePath);
    if (!fs.existsSync(orchestratePath)) continue;
    const orchestrateStats = loadTasksStatsFromOrchestrate(orchestratePath);
    if (orchestrateStats) {
      return {
        ...orchestrateStats,
        source: 'orchestrate-state',
        source_path: relativePath,
      };
    }
  }

  const tasksPath = path.join(projectDir, 'TASKS.md');
  if (fs.existsSync(tasksPath)) {
    return {
      ...readTasksStats(tasksPath),
      source: 'tasks-md',
      source_path: 'TASKS.md',
    };
  }

  return readJsonIfExists(path.join(projectDir, TASKS_STATUS_REL_PATH), {
    done: 0,
    total: 0,
    current_phase: null,
    next_task: null,
    updated_at: new Date().toISOString(),
    source: 'tasks-cache',
    source_path: TASKS_STATUS_REL_PATH,
  });
}

function loadTasksStatsFromOrchestrate(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || !Array.isArray(parsed.tasks)) return null;
    const tasks = parsed.tasks;
    const done = tasks.filter((task) => task && task.status === 'completed').length;
    const inProgressTask = tasks.find((task) => task && task.status === 'in_progress');
    const pendingTask = tasks.find((task) => task && task.status === 'pending');
    const failedTask = tasks.find((task) => task && (task.status === 'failed' || task.status === 'timeout'));
    const nextTask = inProgressTask || pendingTask || failedTask || null;
    return {
      done,
      total: tasks.length,
      current_phase: parsed.current_layer != null ? parsed.current_layer : null,
      next_task: nextTask ? nextTask.id || null : null,
      updated_at: fs.statSync(filePath).mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

function normalizeRunId(value) {
  return String(value || '').trim().replace(/[\\/]+/g, '_');
}

function runReportRelativePath(runId) {
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) return null;
  return `${RUNS_REL_PATH}/${normalizedRunId}/report.json`;
}

function runReportAbsolutePath(projectDir, runId) {
  const relativePath = runReportRelativePath(runId);
  if (!relativePath) return null;
  const absolutePath = path.join(projectDir, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return absolutePath;
}

function withRunReportEvidence(projectDir, runId, evidencePaths) {
  const base = Array.isArray(evidencePaths) ? evidencePaths.slice() : [];
  const reportPath = runReportAbsolutePath(projectDir, runId);
  if (reportPath && !base.includes(reportPath)) base.push(reportPath);
  return {
    report_path: reportPath,
    evidence_paths: base,
  };
}

function flattenColumns(columns = {}) {
  return ['Backlog', 'In Progress', 'Blocked', 'Done']
    .flatMap((name) => Array.isArray(columns[name]) ? columns[name] : []);
}

function classifyPendingDecision(decision = {}) {
  if (decision.decision_class) return decision.decision_class;
  if (decision.source === 'req-conflict' || decision.decision_type === 'agent_conflict') return 'conflict';
  if (decision.source === 'hook-event') return 'validation';
  return 'decision';
}

function decisionPriority(decisionClass) {
  if (decisionClass === 'conflict') return 0;
  if (decisionClass === 'decision') return 1;
  if (decisionClass === 'validation') return 2;
  return 3;
}

function latestRunCard(cards) {
  const withRun = cards.filter((card) => card && card.run_id);
  if (!withRun.length) return null;

  return withRun.sort((a, b) => {
    const aTs = a.last_event_ts || '';
    const bTs = b.last_event_ts || '';
    return bTs.localeCompare(aTs);
  })[0] || null;
}

function nextRemediation(projectDir, staleMarkers, pendingApprovals, pendingDecisions, blockedCards, tasksStats) {
  if (staleMarkers.length > 0) {
    const marker = staleMarkers[0];
    return {
      type: 'artifact',
      id: marker.artifact,
      reason: marker.reason || 'stale derived artifact',
      remediation: 'Rebuild the stale derived artifact before trusting whitebox status.',
    };
  }

  if (pendingApprovals.length > 0) {
    const gate = pendingApprovals[0];
    const reportEvidence = withRunReportEvidence(projectDir, gate.run_id, gate.evidence_paths);
    return {
      type: 'approval',
      id: gate.gate_id,
      reason: `Approval required for ${gate.task_id || gate.gate_name || gate.gate_id}`,
      remediation: 'Review the approval details and run approve or reject through /whitebox approvals.',
      trigger_type: gate.trigger_type || 'user_confirmation',
      recommendation: gate.recommendation || null,
      report_path: reportEvidence.report_path,
      evidence_paths: reportEvidence.evidence_paths,
    };
  }

  if (pendingDecisions.length > 0) {
    const decision = pendingDecisions[0];
    return {
      type: 'decision',
      id: decision.id,
      reason: decision.reason || `Decision pending for ${decision.req_id || decision.task_id || decision.id}`,
      remediation: decision.recommendation || 'Inspect the pending intervention details and resolve the underlying conflict before continuing.',
      trigger_type: decision.trigger_type || decision.decision_type || 'user_confirmation',
      recommendation: decision.recommendation || null,
    };
  }

  if (blockedCards.length > 0) {
    const card = blockedCards[0];
    const reportEvidence = withRunReportEvidence(projectDir, card.run_id, card.evidence_paths);
    return {
      type: 'card',
      id: card.id,
      reason: card.blocker_reason || 'Task is blocked',
      remediation: card.remediation || 'Resolve the blocker and rerun the affected workflow.',
      report_path: reportEvidence.report_path,
      evidence_paths: reportEvidence.evidence_paths,
    };
  }

  if (tasksStats.next_task) {
    return {
      type: 'task',
      id: tasksStats.next_task,
      reason: 'Next incomplete task',
      remediation: 'Continue with the next pending task.',
    };
  }

  return null;
}

function computeGateStatus(staleMarkers, pendingApprovals, pendingDecisions, blockedCards, inProgressCards, tasksStats) {
  if (staleMarkers.length > 0) return 'stale';
  if (pendingApprovals.length > 0) return 'approval_required';
  if (pendingDecisions.length > 0) return 'decision_pending';
  if (blockedCards.length > 0) return 'blocked';
  if (inProgressCards.length > 0) return 'running';
  if (tasksStats.total > 0 && tasksStats.done === tasksStats.total) return 'clear';
  return 'idle';
}

function buildWhiteboxSummary(projectDir) {
  const board = readJsonIfExists(path.join(projectDir, BOARD_STATE_REL_PATH), {
    schema_version: null,
    columns: { Backlog: [], 'In Progress': [], Blocked: [], Done: [] },
    derived_from: {},
  });
  const tasksStats = loadTasksStats(projectDir);
  const controlState = readControlState(projectDir, {
    pending_approval_count: 0,
    pending_approvals: [],
    control_health: null,
  });
  const staleMarkers = readMarkers(projectDir).filter((entry) => entry && !entry.cleared_by);
  const blockedCards = Array.isArray(board.columns?.Blocked) ? board.columns.Blocked : [];
  const pendingDecisions = Array.isArray(board.decisions)
    ? board.decisions.filter((decision) => decision
        && decision.status === 'decision_pending'
        && (!Array.isArray(decision.allowed_actions) || decision.allowed_actions.length === 0))
      .sort((a, b) => decisionPriority(classifyPendingDecision(a)) - decisionPriority(classifyPendingDecision(b)) || String(a.id || '').localeCompare(String(b.id || '')))
    : [];
  const pendingConflictDecisions = pendingDecisions.filter((decision) => classifyPendingDecision(decision) === 'conflict');
  const pendingValidationSignals = pendingDecisions.filter((decision) => classifyPendingDecision(decision) === 'validation');
  const inProgressCards = Array.isArray(board.columns?.['In Progress']) ? board.columns['In Progress'] : [];
  const allCards = flattenColumns(board.columns);
  const runCard = latestRunCard(allCards);
  const pendingApprovals = Array.isArray(controlState.pending_approvals) ? controlState.pending_approvals : [];
  const next = nextRemediation(projectDir, staleMarkers, pendingApprovals, pendingDecisions, blockedCards, tasksStats);

  return {
    schema_version: WHITEBOX_SUMMARY_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    ok: staleMarkers.length === 0 && pendingApprovals.length === 0 && pendingDecisions.length === 0,
    run_id: runCard ? runCard.run_id : null,
    run_id_short: runCard && runCard.run_id ? String(runCard.run_id).slice(0, 12) : null,
    gate_status: computeGateStatus(staleMarkers, pendingApprovals, pendingDecisions, blockedCards, inProgressCards, tasksStats),
    blocked_count: blockedCards.length,
    pending_approval_count: pendingApprovals.length,
    pending_decision_count: pendingDecisions.length,
    pending_conflict_count: pendingConflictDecisions.length,
    pending_validation_count: pendingValidationSignals.length,
    pending_approvals: pendingApprovals.slice(0, 10).map((gate) => {
      const reportEvidence = withRunReportEvidence(projectDir, gate.run_id, gate.evidence_paths);
      return {
        gate_id: gate.gate_id,
        gate_name: gate.gate_name || null,
        task_id: gate.task_id || null,
        run_id: gate.run_id || null,
        correlation_id: gate.correlation_id || null,
        created_at: gate.created_at || gate.required_at || null,
        trigger_type: gate.trigger_type || 'user_confirmation',
        trigger_reason: gate.trigger_reason || null,
        recommendation: gate.recommendation || null,
        report_path: reportEvidence.report_path,
        evidence_paths: reportEvidence.evidence_paths,
      };
    }),
    stale_artifact_count: staleMarkers.length,
    stale_artifacts: staleMarkers.map((entry) => ({
      artifact: entry.artifact,
      schema_version: entry.schema_version || null,
      stale_since: entry.stale_since || null,
      reason: entry.reason || null,
    })),
    next_remediation_target: next,
    tasks: tasksStats,
    board: {
      backlog_count: Array.isArray(board.columns?.Backlog) ? board.columns.Backlog.length : 0,
      in_progress_count: inProgressCards.length,
      blocked_count: blockedCards.length,
      done_count: Array.isArray(board.columns?.Done) ? board.columns.Done.length : 0,
    },
    blocked_cards: blockedCards.slice(0, 5).map((card) => {
      const reportEvidence = withRunReportEvidence(projectDir, card.run_id, card.evidence_paths);
      return {
        id: card.id,
        title: card.title,
        blocker_reason: card.blocker_reason || null,
        blocker_source: card.blocker_source || null,
        remediation: card.remediation || null,
        run_id: card.run_id || null,
        report_path: reportEvidence.report_path,
        evidence_paths: reportEvidence.evidence_paths,
      };
    }),
    pending_decisions: pendingDecisions.slice(0, 10).map((decision) => ({
      id: decision.id,
      task_id: decision.task_id || null,
      req_id: decision.req_id || null,
      source: decision.source || null,
      decision_class: classifyPendingDecision(decision),
      trigger_type: decision.trigger_type || decision.decision_type || null,
      reason: decision.reason || null,
      recommendation: decision.recommendation || null,
    })),
    derived_from: {
      board_state: BOARD_STATE_REL_PATH,
      control_state: '.claude/collab/control-state.json',
      tasks_cache: TASKS_STATUS_REL_PATH,
      board_schema_version: board.schema_version || null,
      board_fingerprint: board.derived_from && board.derived_from.fingerprint ? board.derived_from.fingerprint : null,
      tasks_source: tasksStats.source || null,
      tasks_source_path: tasksStats.source_path || null,
      authoritative_writer: 'skills/whitebox/scripts/whitebox-summary.js',
    },
  };
}

function refreshWhiteboxSummary(options = {}) {
  const projectDir = options.projectDir || process.cwd();
  const summary = buildWhiteboxSummary(projectDir);
  writeJsonAtomic(path.join(projectDir, WHITEBOX_SUMMARY_REL_PATH), summary);
  clearStaleMarker({
    projectDir,
    artifact: WHITEBOX_SUMMARY_REL_PATH,
    clearedBy: 'whitebox-summary',
  });
  return summary;
}

function main() {
  const options = parseArgs();
  const projectDir = options.projectDir;
  const summary = buildWhiteboxSummary(projectDir);

  if (!options.dryRun) {
    try {
      writeJsonAtomic(path.join(projectDir, WHITEBOX_SUMMARY_REL_PATH), summary);
      clearStaleMarker({
        projectDir,
        artifact: WHITEBOX_SUMMARY_REL_PATH,
        clearedBy: 'whitebox-summary',
      });
    } catch (error) {
      setStaleMarker({
        projectDir,
        artifact: WHITEBOX_SUMMARY_REL_PATH,
        schemaVersion: WHITEBOX_SUMMARY_SCHEMA_VERSION,
        reason: `summary refresh failure: ${error.message}`,
      });
      process.stderr.write(`whitebox-summary write failed: ${error.message}\n`);
      process.exitCode = 1;
      if (!options.json) return;
    }
  }

  if (options.json || options.dryRun) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  WHITEBOX_SUMMARY_REL_PATH,
  buildWhiteboxSummary,
  refreshWhiteboxSummary,
  parseArgs,
};
