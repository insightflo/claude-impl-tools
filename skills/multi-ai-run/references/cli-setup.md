# CLI 설치 가이드

## 필수 CLI

| CLI      | 용도                    | 설치 확인          |
| -------- | ----------------------- | ------------------ |
| `claude` | 오케스트레이터 (호스트) | `claude --version` |
| `codex`  | 코드 생성/리뷰          | `codex --version`  |
| `gemini` | 디자인/UI 작업          | `gemini --version` |

---

## Whitebox 정책 (MVP)

- 실행 정책: `subscription-only`
- 허용 executor: `claude`, `codex`, `gemini`
- 비용 모델: CLI 구독 기반만 사용 (추가 API 비용 없음)
- 범위 제외: API-key-first provider API integration
- Claude 상태 규칙: `CLAUDECODE`가 없으면 `host_not_attached`

---

## Claude Code (필수)

이미 사용 중이므로 설치되어 있습니다.

```bash
claude --version
```

---

## Codex CLI (OpenAI)

### 설치

```bash
npm install -g @openai/codex
```

### 인증

```bash
codex auth
codex auth status
```

### 테스트

```bash
codex -q "Write a hello world in Python"
```

### 권장 설정

```bash
# ~/.codexrc
model: gpt-5.3-codex
auto_approve: false
```

---

## Gemini CLI (Google)

### 설치

```bash
npm install -g @anthropic-ai/gemini-cli
# 또는 공식 방법
pip install google-generativeai
```

### 인증

```bash
gemini auth
gemini auth status
```

### 테스트

```bash
gemini -p "Describe a modern button design"
```

---

## 설치 확인 스크립트

```bash
#!/bin/bash
# check-multi-ai-cli.sh

echo "=== Multi-AI CLI 확인 ==="

check_cli() {
  if command -v $1 &> /dev/null; then
    echo "✅ $1: $(which $1)"
  else
    echo "❌ $1: 미설치"
  fi
}

check_cli claude
check_cli codex
check_cli gemini

echo ""
echo "=== 인증 상태 확인 ==="
if [ -n "$CLAUDECODE" ]; then
  echo "✅ Claude host attached"
else
  echo "⚠️ Claude host_not_attached (CLAUDECODE 미설정)"
fi
codex auth status 2>/dev/null && echo "✅ Codex 인증됨"
gemini auth status 2>/dev/null && echo "✅ Gemini 인증됨"
```

### 정책 점검 스크립트

```bash
node project-team/scripts/subscription-policy-check.js --json
```

상태값: `missing_cli`, `missing_auth`, `host_not_attached`, `ok`

---

## Fallback 동작

CLI가 설치되지 않은 경우:

```
1. 해당 모델 작업 → Claude가 직접 처리
2. 경고 메시지 출력: "[multi-ai-run] codex CLI 미설치. Claude로 fallback"
3. 성능/품질 차이 가능성 안내
```

---

## 문제 해결

### Codex 인증 실패

```bash
# (optional) env var cleanup
unset OPENAI_API_KEY
codex auth --reset
```

### Gemini 권한 오류

```bash
# CLI 인증 갱신
gemini auth
gcloud auth login
# 프로젝트 ID 확인
gcloud config get-value project
```

### 타임아웃

```yaml
# .claude/model-routing.yaml
timeouts:
    codex: 60 # 초
    gemini: 60
    default: 30
```
