#!/bin/bash
#
# Cleanup orphaned multi-ai-review jobs and processes
# Run manually: ./skills/multi-ai-review/scripts/cleanup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JOBS_DIR="$SCRIPT_DIR/.jobs"

echo "🧹 Multi-AI Review Cleanup"
echo

# 1. Remove orphaned job directories (older than 1 hour)
if [ -d "$JOBS_DIR" ]; then
  echo "Checking for orphaned job directories..."
  find "$JOBS_DIR" -type d -name "council-*" -mmin +60 2>/dev/null | while read -r dir; do
    echo "  Removing: $(basename "$dir")"
    rm -rf "$dir"
  done
fi

# 2. Kill orphaned gemini-oauth-mcp processes (older than 1 hour)
echo "Checking for orphaned CLI processes..."
pgrep -f "gemini-oauth-mcp" 2>/dev/null | while read -r pid; do
  if ps -p "$pid" -o etime= 2>/dev/null | grep -qE "[1-9][0-9]:|([2-9][0-9]:|[0-9]+[0-9]:)"; then
    echo "  Killing gemini-oauth-mcp PID: $pid"
    kill "$pid" 2>/dev/null || true
  fi
done

# 3. Kill orphaned council-job-worker.js processes (PPID=1)
echo "Checking for orphaned worker processes..."
pgrep -f "council-job-worker.js" 2>/dev/null | while read -r pid; do
  ppid=$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')
  if [ "$ppid" = "1" ]; then
    echo "  Killing orphaned worker PID: $pid"
    kill "$pid" 2>/dev/null || true
  fi
done

# 4. Count remaining jobs
if [ -d "$JOBS_DIR" ]; then
  REMAINING=$(find "$JOBS_DIR" -type d -name "council-*" 2>/dev/null | wc -l | tr -d ' ')
  echo
  echo "Remaining job directories: $REMAINING"
fi

echo "✅ Cleanup complete"
