#!/usr/bin/env bash
# [파일 목적] Agent Teams에서 domain-lead가 task를 Codex/Gemini CLI에 위임하는 래퍼
# [주요 흐름]
#   1. CLI 타입(codex|gemini) + 프롬프트를 인자로 받음
#   2. CLI 존재 확인 → 없으면 exit 1
#   3. 프로젝트 디렉토리에서 CLI 실행
#   4. 결과를 stdout으로 반환
# [외부 연결] team-topology.json의 cliRouting 설정 참조
# [수정시 주의] codex/gemini CLI 인자 변경 시 routing.config.yaml과 동기화 필요

set -euo pipefail

CLI_TYPE="${1:-}"
PROMPT="${2:-}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

if [ -z "$CLI_TYPE" ] || [ -z "$PROMPT" ]; then
  echo "Usage: cli-route.sh <codex|gemini> \"<prompt>\"" >&2
  exit 1
fi

case "$CLI_TYPE" in
  codex)
    if ! command -v codex >/dev/null 2>&1; then
      echo "[cli-route] codex CLI not found. Install: npm i -g @openai/codex" >&2
      exit 1
    fi
    cd "$PROJECT_DIR"
    exec codex exec --sandbox workspace-write "$PROMPT"
    ;;
  gemini)
    if ! command -v gemini >/dev/null 2>&1; then
      echo "[cli-route] gemini CLI not found. Install: npm i -g @anthropic-ai/gemini-cli" >&2
      exit 1
    fi
    cd "$PROJECT_DIR"
    exec gemini --output-format text "$PROMPT"
    ;;
  *)
    echo "[cli-route] Unknown CLI type: $CLI_TYPE (expected: codex|gemini)" >&2
    exit 1
    ;;
esac
