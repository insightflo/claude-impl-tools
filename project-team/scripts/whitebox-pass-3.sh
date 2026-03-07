#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
EVIDENCE_DIR="$ROOT_DIR/.sisyphus/evidence"

mkdir -p "$EVIDENCE_DIR"

FIXTURE_DIR="$(mktemp -d "$ROOT_DIR/.sisyphus/pass3-fixture.XXXXXX")"
mkdir -p "$FIXTURE_DIR/.claude/collab/requests"

node -e "const fs=require('fs'); const path=require('path'); const dir=process.argv[1]; fs.mkdirSync(path.join(dir,'.claude','collab'), {recursive:true}); fs.writeFileSync(path.join(dir,'TASKS.md'), '## Phase 3\n### [ ] T0.1: Pass 3 blocked fixture\n', 'utf8'); fs.writeFileSync(path.join(dir,'.claude','orchestrate-state.json'), JSON.stringify({tasks:[{id:'T0.1',title:'Pass 3 blocked fixture',status:'failed',owner:'fixture-agent'}]}, null, 2), 'utf8'); const evt={schema_version:'1.0',event_id:'evt-pass3-1',ts:'2026-03-07T00:00:00.000Z',type:'task_blocked',producer:'fixture',correlation_id:'T0.1',data:{task_id:'T0.1',status:'failed',run_id:'run-pass3-1'}}; fs.writeFileSync(path.join(dir,'.claude','collab','events.ndjson'), JSON.stringify(evt)+'\n', 'utf8');" "$FIXTURE_DIR"

node "$ROOT_DIR/skills/task-board/scripts/board-builder.js" --project-dir="$FIXTURE_DIR" --dry-run --json 2>&1 | tee "$EVIDENCE_DIR/pass-3-board.json"
cargo build --manifest-path "$ROOT_DIR/skills/task-board/tui/Cargo.toml" 2>&1 | tee "$EVIDENCE_DIR/pass-3-cargo.txt"

if command -v tmux >/dev/null 2>&1; then
  tmux new-session -d -s wb "bash -lc '$ROOT_DIR/skills/task-board/scripts/board-show.sh --project-dir=\"$FIXTURE_DIR\"'"
  sleep 1
  tmux capture-pane -pt wb:0 > "$EVIDENCE_DIR/pass-3-tui.txt"
  tmux kill-session -t wb
else
  WHITEBOX_TUI_CAPTURE=1 "$ROOT_DIR/skills/task-board/scripts/board-show.sh" --project-dir="$FIXTURE_DIR" > "$EVIDENCE_DIR/pass-3-tui.txt"
fi

node "$ROOT_DIR/skills/whitebox/scripts/whitebox-status.js" --project-dir="$FIXTURE_DIR" --json 2>&1 | tee "$EVIDENCE_DIR/pass-3-status.json"
node "$ROOT_DIR/skills/whitebox/scripts/whitebox-explain.js" --task-id=T0.1 --project-dir="$FIXTURE_DIR" --json 2>&1 | tee "$EVIDENCE_DIR/pass-3-explain.json"
grep -n "whitebox\|Ratatui" "$ROOT_DIR/README.md" "$ROOT_DIR/README_ko.md" "$ROOT_DIR/INSTALL.md" "$ROOT_DIR/skills/whitebox/SKILL.md" 2>&1 | tee "$EVIDENCE_DIR/pass-3-docs.txt"
