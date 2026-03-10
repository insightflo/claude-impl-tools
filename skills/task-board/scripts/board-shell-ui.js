#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { buildExplain } = require('../../whitebox/scripts/whitebox-explain');
const {
  buildDefaultIdempotencyKey,
  writeControlCommand,
} = require('../../../project-team/scripts/lib/whitebox-control');

function parseArgs(argv = process.argv.slice(2)) {
  const options = { projectDir: process.cwd() };
  for (const arg of argv) {
    if (arg.startsWith('--project-dir=')) options.projectDir = path.resolve(arg.slice('--project-dir='.length));
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

function collectState(projectDir) {
  const board = readJsonIfExists(path.join(projectDir, '.claude/collab/board-state.json'), {
    columns: { Backlog: [], 'In Progress': [], Blocked: [], Done: [] },
    decisions: [],
  });
  const controlState = readJsonIfExists(path.join(projectDir, '.claude/collab/control-state.json'), {
    pending_approvals: [],
  });
  const approvals = Array.isArray(controlState.pending_approvals) ? controlState.pending_approvals : [];
  const decisions = Array.isArray(board.decisions)
    ? board.decisions.filter((entry) => entry && entry.status === 'decision_pending' && (!Array.isArray(entry.allowed_actions) || entry.allowed_actions.length === 0))
    : [];
  return { board, approvals, decisions };
}

function explainTarget(entry) {
  if (!entry) return { taskId: '', reqId: '', gate: '' };
  if (entry.kind === 'approval') {
    return entry.task_id ? { taskId: entry.task_id, reqId: '', gate: '' } : { taskId: '', reqId: '', gate: entry.gate_id };
  }
  if (entry.task_id) return { taskId: entry.task_id, reqId: '', gate: '' };
  if (entry.req_id) return { taskId: '', reqId: entry.req_id, gate: '' };
  return { taskId: '', reqId: '', gate: entry.id || '' };
}

function buildItems(state) {
  const approvals = state.approvals.map((entry) => ({
    kind: 'approval',
    id: entry.gate_id,
    label: entry.gate_name || entry.gate_id,
    task_id: entry.task_id || null,
    correlation_id: entry.correlation_id || entry.gate_id,
    trigger_type: entry.trigger_type || 'user_confirmation',
    reason: entry.trigger_reason || entry.preview || '',
  }));
  const decisions = state.decisions.map((entry) => ({
    kind: 'decision',
    id: entry.id,
    label: entry.title || entry.id,
    task_id: entry.task_id || null,
    req_id: entry.req_id || null,
    trigger_type: entry.trigger_type || entry.decision_type || 'decision',
    reason: entry.reason || '',
  }));
  return approvals.concat(decisions);
}

function boardCounts(board) {
  const columns = board.columns || {};
  return {
    backlog: Array.isArray(columns.Backlog) ? columns.Backlog.length : 0,
    inProgress: Array.isArray(columns['In Progress']) ? columns['In Progress'].length : 0,
    blocked: Array.isArray(columns.Blocked) ? columns.Blocked.length : 0,
    done: Array.isArray(columns.Done) ? columns.Done.length : 0,
  };
}

function render(projectDir, state, selectedIndex, statusMessage) {
  const items = buildItems(state);
  const counts = boardCounts(state.board);
  const selected = items[selectedIndex] || null;
  const explain = buildExplain({ projectDir, ...explainTarget(selected) });

  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write('Whitebox Terminal\n\n');
  process.stdout.write(`Backlog ${counts.backlog} | In Progress ${counts.inProgress} | Blocked ${counts.blocked} | Done ${counts.done}\n`);
  process.stdout.write(`Pending approvals ${state.approvals.length} | Read-only decisions ${state.decisions.length}\n\n`);

  if (items.length === 0) {
    process.stdout.write('No interventions pending. Press q to exit.\n');
  } else {
    process.stdout.write('Use j/k to move, a/r for approve/reject, q to quit.\n\n');
    items.forEach((entry, index) => {
      const prefix = index === selectedIndex ? '>' : ' ';
      const extra = entry.task_id ? ` task=${entry.task_id}` : entry.req_id ? ` req=${entry.req_id}` : '';
      process.stdout.write(`${prefix} [${entry.kind}] ${entry.label}${extra} (${entry.trigger_type})\n`);
      if (entry.reason) process.stdout.write(`    ${entry.reason}\n`);
    });
  }

  process.stdout.write('\nExplain\n');
  process.stdout.write(`${explain.reason || 'none'}\n`);
  if (explain.remediation) process.stdout.write(`${explain.remediation}\n`);
  if (statusMessage) process.stdout.write(`\n${statusMessage}\n`);
}

async function main() {
  const options = parseArgs();
  let state = collectState(options.projectDir);
  let selectedIndex = 0;
  let statusMessage = '';

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    render(options.projectDir, state, selectedIndex, statusMessage);
    return;
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  const cleanup = () => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
  };

  process.on('exit', cleanup);

  process.stdin.on('data', async (chunk) => {
    const key = String(chunk || '');
    const items = buildItems(state);

    if (key === 'q' || key === '\u001b') {
      cleanup();
      process.exit(0);
      return;
    }

    if (key === 'j' && items.length > 0) {
      selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
      statusMessage = '';
      render(options.projectDir, state, selectedIndex, statusMessage);
      return;
    }

    if (key === 'k' && items.length > 0) {
      selectedIndex = Math.max(0, selectedIndex - 1);
      statusMessage = '';
      render(options.projectDir, state, selectedIndex, statusMessage);
      return;
    }

    if ((key === 'a' || key === 'r') && items.length > 0) {
      const selected = items[selectedIndex];
      if (!selected || selected.kind !== 'approval') {
        statusMessage = 'Selected entry is inspect-only.';
        render(options.projectDir, state, selectedIndex, statusMessage);
        return;
      }
      const action = key === 'a' ? 'approve' : 'reject';
      const result = await writeControlCommand({
        type: action,
        producer: 'board-shell-ui',
        target: {
          gate_id: selected.id,
          task_id: selected.task_id,
        },
        actor: { id: 'board-shell-ui' },
        correlation_id: selected.correlation_id,
        idempotency_key: buildDefaultIdempotencyKey({
          type: action,
          correlation_id: selected.correlation_id,
          target: { gate_id: selected.id },
        }),
      }, { projectDir: options.projectDir });
      state = collectState(options.projectDir);
      statusMessage = `${selected.id}: ${result.status}`;
      render(options.projectDir, state, selectedIndex, statusMessage);
    }
  });

  render(options.projectDir, state, selectedIndex, statusMessage);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error && error.message ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
