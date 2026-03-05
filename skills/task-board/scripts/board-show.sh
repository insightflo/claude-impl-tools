#!/usr/bin/env bash
# board-show.sh — ASCII Kanban board renderer for task-board skill
#
# Reads .claude/collab/board-state.json and renders a terminal kanban board:
#
#   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
#   │   Backlog    │  │ In Progress  │  │   Blocked    │  │     Done     │
#   ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤
#   │ T1.1         │  │ T2.3         │  │ REQ-001      │  │ T1.2         │
#   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
#
# Usage:
#   ./board-show.sh [--project-dir=/path]
#   ./board-show.sh --rebuild   # rebuild board-state.json first

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
BOARD_FILE="$PROJECT_DIR/.claude/collab/board-state.json"
BUILDER="$(dirname "$0")/board-builder.js"
COL_WIDTH=22

# Colors
RESET="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"
C_BLUE="\033[38;2;137;180;250m"
C_GREEN="\033[38;2;166;227;161m"
C_RED="\033[38;2;243;139;168m"
C_YELLOW="\033[38;2;249;226;175m"
C_GRAY="\033[38;2;88;91;112m"

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------

REBUILD=false
for arg in "$@"; do
  case "$arg" in
    --project-dir=*) PROJECT_DIR="${arg#--project-dir=}" ;;
    --rebuild) REBUILD=true ;;
  esac
done

# ---------------------------------------------------------------------------
# Rebuild if requested or missing
# ---------------------------------------------------------------------------

if [[ "$REBUILD" == "true" ]] || [[ ! -f "$BOARD_FILE" ]]; then
  if command -v node &>/dev/null && [[ -f "$BUILDER" ]]; then
    node "$BUILDER" --project-dir="$PROJECT_DIR" 2>/dev/null || true
  fi
fi

if [[ ! -f "$BOARD_FILE" ]]; then
  echo "No board-state.json found. Run: node skills/task-board/scripts/board-builder.js"
  exit 1
fi

# ---------------------------------------------------------------------------
# Parse board-state.json with node (portable, no jq required)
# ---------------------------------------------------------------------------

BOARD_DATA=$(node - "$BOARD_FILE" <<'JSEOF'
const fs = require('fs');
const file = process.argv[1];
const board = JSON.parse(fs.readFileSync(file, 'utf8'));
const cols = ['Backlog', 'In Progress', 'Blocked', 'Done'];
for (const col of cols) {
  const cards = board.columns[col] || [];
  process.stdout.write(col + '\t' + cards.map(c => c.id + (c.agent ? '[' + c.agent + ']' : '')).join('|') + '\n');
}
JSEOF
)

# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

declare -A COL_CARDS
declare -a COL_ORDER=("Backlog" "In Progress" "Blocked" "Done")

while IFS=$'\t' read -r col_name cards_str; do
  COL_CARDS["$col_name"]="$cards_str"
done <<< "$BOARD_DATA"

pad_right() {
  local str="$1" width="$2"
  printf "%-${width}s" "$str"
}

header_color() {
  case "$1" in
    "Backlog")     echo -e "$C_GRAY" ;;
    "In Progress") echo -e "$C_BLUE" ;;
    "Blocked")     echo -e "$C_RED" ;;
    "Done")        echo -e "$C_GREEN" ;;
    *)             echo -e "$RESET" ;;
  esac
}

echo ""
echo -e "${BOLD}Task Board${RESET}  $(date '+%Y-%m-%d %H:%M')"
echo ""

# Header row
for col in "${COL_ORDER[@]}"; do
  color=$(header_color "$col")
  printf "${color}${BOLD}%-${COL_WIDTH}s${RESET}  " "$col"
done
echo ""

# Separator
for col in "${COL_ORDER[@]}"; do
  printf "%s  " "$(printf '%.0s─' $(seq 1 $COL_WIDTH))"
done
echo ""

# Cards: find max rows
max_rows=0
declare -A COL_ARRAY
for col in "${COL_ORDER[@]}"; do
  cards_str="${COL_CARDS[$col]:-}"
  if [[ -n "$cards_str" ]]; then
    IFS='|' read -ra cards <<< "$cards_str"
    count="${#cards[@]}"
  else
    count=0
  fi
  COL_ARRAY["${col}_count"]=$count
  [[ $count -gt $max_rows ]] && max_rows=$count
done

for ((row=0; row<max_rows; row++)); do
  for col in "${COL_ORDER[@]}"; do
    cards_str="${COL_CARDS[$col]:-}"
    if [[ -n "$cards_str" ]]; then
      IFS='|' read -ra cards <<< "$cards_str"
    else
      cards=()
    fi
    if [[ $row -lt ${#cards[@]} ]]; then
      card="${cards[$row]}"
      # Truncate to col width
      if [[ ${#card} -gt $((COL_WIDTH - 1)) ]]; then
        card="${card:0:$((COL_WIDTH - 2))}…"
      fi
      printf "%-${COL_WIDTH}s  " "$card"
    else
      printf "%-${COL_WIDTH}s  " ""
    fi
  done
  echo ""
done

echo ""

# Summary counts
echo -e "${DIM}Counts:${RESET}"
for col in "${COL_ORDER[@]}"; do
  count="${COL_ARRAY[${col}_count]}"
  color=$(header_color "$col")
  printf "  ${color}${col}${RESET}: ${BOLD}${count}${RESET}"
done
echo ""
echo ""
