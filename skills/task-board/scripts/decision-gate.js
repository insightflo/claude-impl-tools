#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function requireFirst(paths) {
  for (const candidate of paths) {
    try {
      return require(candidate);
    } catch {}
  }
  throw new Error(`Unable to load module from: ${paths.join(', ')}`);
}

const { findTasksFile, updateTaskCheckboxes } = requireFirst([
  path.join(__dirname, '../../../project-team/hooks/task-sync.js'),
  path.join(__dirname, '../../../hooks/task-sync.js'),
]);
const { loadState, resolveDecision } = requireFirst([
  path.join(__dirname, '../../team-orchestrate/scripts/engine/state.js'),
]);

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { projectDir: process.cwd(), command: args[0] || 'list', id: '', action: '' };
  for (const arg of args.slice(1)) {
    if (arg.startsWith('--project-dir=')) opts.projectDir = path.resolve(arg.slice(14));
    else if (arg.startsWith('--id=')) opts.id = arg.slice(5);
    else if (arg.startsWith('--action=')) opts.action = arg.slice(9);
  }
  return opts;
}

function listDecisions(projectDir) {
  const state = loadState(projectDir);
  const decisions = Array.isArray(state.decisions) ? state.decisions : [];
  const pending = decisions.filter((entry) => entry.status === 'pending');
  process.stdout.write(JSON.stringify({ pending }, null, 2) + '\n');
}

function resolveTaskSyncDecision(projectDir, decision, action) {
  if (decision.type !== 'task_sync_permission') {
    throw new Error(`Unsupported decision type: ${decision.type}`);
  }

  if (action === 'approve') {
    const tasksFile = findTasksFile(projectDir);
    if (!tasksFile) {
      throw new Error('TASKS.md not found');
    }
    const result = updateTaskCheckboxes(tasksFile, [decision.task_id]);
    resolveDecision(decision.id, action, projectDir, {
      tasks_file: tasksFile,
      sync_result: result,
    });
    return { tasksFile, result };
  }

  resolveDecision(decision.id, action, projectDir, {});
  return { tasksFile: null, result: null };
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.command === 'list') {
    listDecisions(opts.projectDir);
    return;
  }

  if (opts.command !== 'resolve') {
    throw new Error('Usage: node skills/task-board/scripts/decision-gate.js <list|resolve> [--project-dir=/path] [--id=...] [--action=approve|reject]');
  }

  if (!opts.id || !opts.action) {
    throw new Error('resolve requires --id and --action');
  }

  if (!['approve', 'reject'].includes(opts.action)) {
    throw new Error('action must be approve or reject');
  }

  const state = loadState(opts.projectDir);
  const decision = (state.decisions || []).find((entry) => entry.id === opts.id);
  if (!decision) {
    throw new Error(`Decision not found: ${opts.id}`);
  }

  const outcome = resolveTaskSyncDecision(opts.projectDir, decision, opts.action);
  const nextState = loadState(opts.projectDir);
  fs.mkdirSync(path.join(opts.projectDir, '.claude', 'collab'), { recursive: true });
  process.stdout.write(JSON.stringify({
    decision: nextState.decisions.find((entry) => entry.id === opts.id),
    outcome,
  }, null, 2) + '\n');
}

main();
