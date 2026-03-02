# Multi-AI Review Requirements

## CLI 도구 요구사항

### 필수 CLI

| CLI | 용도 | 설치 방법 |
|-----|------|----------|
| **Node.js** | 런타임 | `brew install node` 또는 https://nodejs.org/ |
| **Gemini CLI** | Creative Reviewer | https://github.com/google-gemini/gemini-cli |
| **Codex CLI** | Technical Reviewer | https://github.com/openai/codex |

### 선택 CLI

| CLI | 용도 | 설치 방법 |
|-----|------|----------|
| **Claude Code** | Chairman (호스트) | https://claude.ai/code |

## 설치 확인

```bash
# Node.js 확인
node --version  # v18+ 권장

# CLI 존재 확인
command -v claude && echo "✅ Claude Code"
command -v gemini && echo "✅ Gemini CLI"
command -v codex && echo "✅ Codex CLI"
```

## npm 의존성

```bash
# yaml 파서 필요
cd skills/multi-ai-review
npm install yaml
```

또는 전역 설치:

```bash
npm install -g yaml
```

## 권한 설정

```bash
# 스크립트 실행 권한
chmod +x skills/multi-ai-review/scripts/council.sh
chmod +x skills/multi-ai-review/scripts/council-job.sh
```

## 환경 변수 (선택)

```bash
# ~/.zshrc 또는 ~/.bashrc
export COUNCIL_CONFIG="/path/to/council.config.yaml"
export COUNCIL_JOBS_DIR="/tmp/council-jobs"
export COUNCIL_CHAIRMAN="auto"
```

## 구독 플랜 요구사항

| 서비스 | 플랜 | 비고 |
|--------|------|------|
| Google AI | Gemini 구독 | Gemini CLI 사용 |
| OpenAI | Codex 구독 | Codex CLI 사용 |
| Anthropic | Claude 구독 | Claude Code 사용 |

> **참고**: API 키 방식이 아닌 CLI 구독 플랜을 사용하므로 추가 API 비용이 발생하지 않습니다.

## 시스템 요구사항

- **OS**: macOS, Linux, Windows (WSL)
- **메모리**: 최소 4GB RAM
- **디스크**: 100MB 여유 공간

## 문제 해결

### "Missing runtime dependency: yaml"

```bash
cd skills/multi-ai-review
npm install yaml
```

### "command not found: gemini"

```bash
# Gemini CLI 설치
npm install -g @anthropic/gemini-cli
# 또는
brew install gemini-cli
```

### "Permission denied"

```bash
chmod +x skills/multi-ai-review/scripts/*.sh
```

### 타임아웃 증가

```yaml
# council.config.yaml
council:
  settings:
    timeout: 300  # 5분
```
