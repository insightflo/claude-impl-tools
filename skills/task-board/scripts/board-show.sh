#!/usr/bin/env bash
# board-show.sh — ASCII Kanban board renderer for task-board skill
#
# Reads .claude/collab/board-state.json and renders a terminal kanban board.
# Delegates rendering to Node.js for portability (avoids bash 4+ requirements).
#
# Usage:
#   ./board-show.sh [--project-dir=/path]
#   ./board-show.sh --rebuild   # rebuild board-state.json first

set -euo pipefail

BUILDER="$(dirname "$0")/board-builder.js"

# ---------------------------------------------------------------------------
# Args (parse BEFORE computing BOARD_FILE so --project-dir takes effect)
# ---------------------------------------------------------------------------

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
REBUILD=false
DECISION_ID=""
DECISION_ACTION=""
for arg in "$@"; do
  case "$arg" in
    --project-dir=*) PROJECT_DIR="${arg#--project-dir=}" ;;
    --rebuild) REBUILD=true ;;
    --approve=*) DECISION_ID="${arg#--approve=}"; DECISION_ACTION="approve" ;;
    --reject=*) DECISION_ID="${arg#--reject=}"; DECISION_ACTION="reject" ;;
  esac
done

BOARD_FILE="$PROJECT_DIR/.claude/collab/board-state.json"

if [[ -n "$DECISION_ID" ]]; then
  node "$(dirname "$0")/decision-gate.js" resolve --project-dir="$PROJECT_DIR" --id="$DECISION_ID" --action="$DECISION_ACTION"
  REBUILD=true
fi

# ---------------------------------------------------------------------------
# Rebuild if requested or missing
# ---------------------------------------------------------------------------

if [[ "$REBUILD" == "true" ]] || [[ ! -f "$BOARD_FILE" ]]; then
  if command -v node &>/dev/null && [[ -f "$BUILDER" ]]; then
    node "$BUILDER" --project-dir="$PROJECT_DIR" 2>&1 || true
  fi
fi

if [[ ! -f "$BOARD_FILE" ]]; then
  echo "No board-state.json found. Run: node skills/task-board/scripts/board-builder.js"
  exit 1
fi

# ---------------------------------------------------------------------------
# Render via Node (portable, works with bash 3.2+ on macOS)
# ---------------------------------------------------------------------------

node - "$BOARD_FILE" <<'JSEOF'
'use strict';
const fs = require('fs');
const file = process.argv[2];  // argv[0]=node, argv[1]="-", argv[2]=file

const board = JSON.parse(fs.readFileSync(file, 'utf8'));
const COL_ORDER = ['Backlog', 'In Progress', 'Blocked', 'Done'];
const COL_WIDTH = 22;

// ANSI colors
const R = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const C = {
  Backlog:       '\x1b[38;2;88;91;112m',
  'In Progress': '\x1b[38;2;137;180;250m',
  Blocked:       '\x1b[38;2;243;139;168m',
  Done:          '\x1b[38;2;166;227;161m',
};

function pad(s, w) {
  const str = String(s);
  if (str.length >= w) return str.slice(0, w - 1) + '…';
  return str + ' '.repeat(w - str.length);
}

const now = new Date().toLocaleString('ko-KR', { hour12: false });
process.stdout.write(`\nTask Board  ${now}\n\n`);

// Header
for (const col of COL_ORDER) {
  const count = (board.columns[col] || []).length;
  process.stdout.write(`${C[col]}${BOLD}${pad(col + ' (' + count + ')', COL_WIDTH)}${R}  `);
}
process.stdout.write('\n');

// Separator
for (let i = 0; i < COL_ORDER.length; i++) {
  process.stdout.write('─'.repeat(COL_WIDTH) + '  ');
}
process.stdout.write('\n');

// Cards
const maxRows = Math.max(...COL_ORDER.map(col => (board.columns[col] || []).length));
for (let row = 0; row < maxRows; row++) {
  for (const col of COL_ORDER) {
    const cards = board.columns[col] || [];
    if (row < cards.length) {
      const card = cards[row];
      const label = card.id + (card.agent ? ` [${card.agent}]` : '');
      process.stdout.write(pad(label, COL_WIDTH) + '  ');
    } else {
      process.stdout.write(' '.repeat(COL_WIDTH) + '  ');
    }
  }
  process.stdout.write('\n');
}

const decisions = Array.isArray(board.decisions) ? board.decisions.filter((d) => d.status === 'decision_pending') : [];
if (decisions.length > 0) {
  process.stdout.write('Pending Decisions\n');
  process.stdout.write('-----------------\n');
  for (const decision of decisions) {
    const actions = Array.isArray(decision.allowed_actions) ? decision.allowed_actions.join('/') : '';
    process.stdout.write(`- ${decision.id}: ${decision.title}\n`);
    if (decision.task_id) process.stdout.write(`  task: ${decision.task_id}\n`);
    if (decision.reason) process.stdout.write(`  reason: ${decision.reason}\n`);
    if (actions) process.stdout.write(`  actions: ${actions}\n`);
    process.stdout.write(`  run: bash skills/task-board/scripts/board-show.sh --approve=${decision.id} --project-dir=.\n`);
  }
  process.stdout.write('\n');
}

process.stdout.write('\n');
JSEOF
