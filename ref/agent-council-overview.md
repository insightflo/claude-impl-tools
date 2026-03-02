# Agent Council Reference

> Source: https://github.com/team-attention/agent-council
> Cloned: 2026-03-02
> Location: `~/Projects/ref/agent-council/`

## Overview

Agent Council은 여러 AI CLI(Claude Code, Codex CLI, Gemini CLI)의 의견을 모으고, 의장(Chairman)이 종합해 결론을 내리는 멀티-AI 협업 시스템이다.

**핵심 차별점**: Karpathy의 LLM Council과 달리 **추가 API 비용 없이** 설치된 AI CLI를 활용한다.

## Architecture

### 3-Stage Pipeline

```
Stage 1: Initial Opinions (병렬 실행)
    ├── Claude CLI → opinion.md
    ├── Codex CLI → opinion.md
    └── Gemini CLI → opinion.md

Stage 2: Response Collection
    └── 각 응답 수집 및 포맷팅

Stage 3: Chairman Synthesis
    └── 호스트 에이전트가 모든 의견 종합 → 최종 추천
```

### Key Components

| 파일 | 역할 |
|------|------|
| `council.config.yaml` | 멤버 정의, 타임아웃, 의장 설정 |
| `council.sh` | 메인 실행 스크립트 (one-shot + job mode) |
| `council-job.js` | Job runner 구현 (폴링 가능) |
| `council-job-worker.js` | 멤버별 워커 |

## Configuration Schema

```yaml
council:
  members:
    - name: string       # 에이전트 식별자
      command: string    # CLI 명령어 (프롬프트가 뒤에 붙음)
      emoji: string      # 표시용 이모지
      color: string      # ANSI color (RED, GREEN, BLUE, YELLOW, CYAN)

  chairman:
    role: auto | claude | codex | gemini  # auto: 호스트 CLI 자동 감지
    command: string      # 선택: council.sh 내에서 Stage 3 실행
    description: string

  settings:
    timeout: 120         # 에이전트별 타임아웃 (초)
    exclude_chairman_from_members: true
    synthesize: bool     # council.sh 내에서 Stage 3 강제 실행
```

## Usage Patterns

### One-shot (간단)

```bash
./skills/agent-council/scripts/council.sh "질문 내용"
```

### Job Mode (세밀한 제어)

```bash
JOB_DIR=$(./scripts/council.sh start "질문")
./scripts/council.sh wait "$JOB_DIR"      # 진행상황 대기
./scripts/council.sh results "$JOB_DIR"   # 결과 출력
./scripts/council.sh clean "$JOB_DIR"     # 정리
```

### Host Agent Integration

```
User: "다른 AI들 의견도 들어보자"
User: "council 소집해줘"
User: "codex랑 gemini 의견 물어봐"
```

## Integration Points for multi-ai-review

### 1. CLI vs MCP 접근법 비교

| 측면 | Agent Council (CLI) | multi-ai-review (MCP) |
|------|---------------------|----------------------|
| 비용 | 구독 플랜만 (API 호출 X) | MCP 서버 필요 |
| 설정 | YAML 파일 | MCP 서버 설정 |
| 실행 | Shell 스크립트 | MCP 툴 호출 |
| 확장성 | CLI만 있으면 됨 | MCP 서버 개발 필요 |

### 2. 채택 가능한 패턴

**Option A: CLI 오케스트레이션**
- `council.sh` 패턴 사용
- Claude Code가 Codex/Gemini CLI 직접 호출
- 장점: MCP 의존성 제거, 간단한 설정

**Option B: MCP 유지 + Council 패턴 차용**
- 3-Stage Pipeline 구조만 차용
- MCP 툴을 "members"로 취급
- Fan-out/Fan-in 로직 참고

### 3. 핵심 참고 코드

**병렬 실행 패턴** (`council-job-worker.js`):
```javascript
// 각 멤버별 워커가 독립적으로 실행
// 프롬프트를 CLI에 전달하고 결과를 파일로 저장
```

**Wait 토큰 패턴** (`council-job.js`):
```javascript
// 의미 있는 진행이 있을 때만 반환
// UI 스팸 방지
```

## Requirements

```bash
# CLI 확인
command -v claude
command -v codex
command -v gemini

# Node.js 필수
node --version
```

## Files Reference

```
~/Projects/ref/agent-council/
├── council.config.yaml              # 설정 예시
├── skills/agent-council/
│   ├── SKILL.md                     # 스킬 문서
│   ├── scripts/
│   │   ├── council.sh               # 메인 스크립트 ★
│   │   ├── council-job.sh           # 백그라운드 러너
│   │   ├── council-job.js           # Job 구현 ★
│   │   └── council-job-worker.js    # 워커
│   └── references/
│       ├── overview.md
│       ├── config.md
│       ├── examples.md
│       ├── requirements.md
│       └── host-ui.md
```

## Next Steps for multi-ai-review

1. **CLI 기반 전환 검토**: Gemini CLI, Codex CLI 사용 가능하면 MCP 없이 council 패턴 적용
2. **설정 통합**: `council.config.yaml` 형식을 multi-ai-review 설정에 반영
3. **3-Stage Pipeline**: 현재 multi-ai-review의 2단계를 3단계로 확장 (Opinions → Collection → Synthesis)
