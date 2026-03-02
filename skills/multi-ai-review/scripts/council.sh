#!/bin/bash
#
# Multi-AI Review Council (agent-council 패턴 기반)
#
# Subcommands:
#   council.sh start [options] "question"     # returns JOB_DIR immediately
#   council.sh status [--json|--text] JOB_DIR # poll progress
#   council.sh wait [--cursor CURSOR] JOB_DIR # wait for progress
#   council.sh results [--json] JOB_DIR       # print collected outputs
#   council.sh stop JOB_DIR                   # best-effort stop running members
#   council.sh clean JOB_DIR                  # remove job directory
#
# One-shot:
#   council.sh "question"
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JOB_SCRIPT="$SCRIPT_DIR/council-job.sh"

usage() {
  cat <<EOF
Multi-AI Review Council

Usage:
  $(basename "$0") start [options] "question"
  $(basename "$0") status [--json|--text] <jobDir>
  $(basename "$0") wait [--cursor CURSOR] <jobDir>
  $(basename "$0") results [--json] <jobDir>
  $(basename "$0") stop <jobDir>
  $(basename "$0") clean <jobDir>

One-shot:
  $(basename "$0") "question"

Examples:
  $(basename "$0") "이 코드의 보안 취약점을 검토해줘"
EOF
}

if [ $# -eq 0 ]; then
  usage
  exit 1
fi

case "$1" in
  -h|--help|help)
    usage
    exit 0
    ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required." >&2
  echo "macOS: brew install node" >&2
  echo "Or: https://nodejs.org/" >&2
  exit 127
fi

case "$1" in
  start|status|wait|results|stop|clean)
    exec "$JOB_SCRIPT" "$@"
    ;;
esac

in_host_agent_context() {
  if [ -n "${CODEX_CACHE_FILE:-}" ]; then
    return 0
  fi
  case "$SCRIPT_DIR" in
    */.codex/skills/*|*/.claude/skills/*)
      if [ ! -t 1 ] && [ ! -t 2 ]; then
        return 0
      fi
      ;;
  esac
  return 1
}

JOB_DIR="$("$JOB_SCRIPT" start "$@")"

if in_host_agent_context; then
  exec "$JOB_SCRIPT" wait "$JOB_DIR"
fi

echo "council: started ${JOB_DIR}" >&2

cleanup_on_signal() {
  if [ -n "${JOB_DIR:-}" ] && [ -d "$JOB_DIR" ]; then
    "$JOB_SCRIPT" stop "$JOB_DIR" >/dev/null 2>&1 || true
    "$JOB_SCRIPT" clean "$JOB_DIR" >/dev/null 2>&1 || true
  fi
  exit 130
}

trap cleanup_on_signal INT TERM

while true; do
  WAIT_JSON="$("$JOB_SCRIPT" wait "$JOB_DIR")"
  OVERALL="$(printf '%s' "$WAIT_JSON" | node -e '
const fs=require("fs");
const d=JSON.parse(fs.readFileSync(0,"utf8"));
process.stdout.write(String(d.overallState||""));
')"

  "$JOB_SCRIPT" status --text "$JOB_DIR" >&2

  if [ "$OVERALL" = "done" ]; then
    break
  fi
done

trap - INT TERM

"$JOB_SCRIPT" results "$JOB_DIR"
"$JOB_SCRIPT" clean "$JOB_DIR" >/dev/null
