---
name: cmux-ai-run
description: cmux 창 분할 기반 멀티-AI 병렬 태스크 실행. 동일 워크스페이스에서 Codex(코드)/Gemini(디자인)/Claude(계획)를 패널로 분할해 동시에 실행합니다. multi-ai-run의 순차 실행과 달리 진짜 병렬. "/cmux-ai-run", "cmux로 AI 분업", "창 분할 병렬 실행", "codex gemini 동시 실행" 등 cmux 환경에서 여러 AI를 동시에 돌리고 싶은 요청이라면 반드시 이 스킬을 사용하세요.
triggers:
  - /cmux-ai-run
  - cmux AI 분업
  - cmux 병렬 실행
  - 창 분할 실행
version: 1.1.0
---

# /cmux-ai-run — cmux 창 분할 병렬 AI 실행

> **multi-ai-run과의 차이**: Bash 서브프로세스(순차) 대신 cmux 패널 분할(진짜 병렬).
> 같은 워크스페이스에서 Codex/Gemini 패널이 동시에 실행되는 것을 눈으로 볼 수 있음.
>
> **완료 감지**: cmux 패널은 시각적 표시 전용. 실제 완료 신호는 Agent Teams API (SendMessage)로 수신 — 파일 폴링 없음.

---

## 패널 레이아웃

```
┌─────────────────────┬─────────────────────┐
│  Claude             │  Codex              │
│  (현재 패널)        │  코드 생성/리팩토링  │
│  오케스트레이터     ├─────────────────────┤
│                     │  Gemini             │
│                     │  디자인/UI 구현      │
└─────────────────────┴─────────────────────┘
```

---

## Prerequisites

```bash
cmux ping || { echo "cmux 필요"; exit 1; }
# 모델 설정 확인 (프로젝트 오버라이드 우선)
CONFIG="${PROJECT_ROOT}/.claude/cmux-ai-models.yaml"
[ ! -f "$CONFIG" ] && CONFIG="${CLAUDE_PLUGIN_ROOT}/skills/cmux-ai-run/config/models.yaml"
```

---

## 모델 설정

기본값 (`config/models.yaml`):
- **Codex**: `gpt-5.4`, `effort=high`
- **Gemini**: `gemini-3.1-pro-preview`
- **Claude**: `opus`

프로젝트별 오버라이드: `.claude/cmux-ai-models.yaml` 생성 (동일 형식)

---

## 실행 순서

### Step 1: 태스크 분석 + 라우팅

TASKS.md 또는 명시된 태스크를 분석해 AI별로 그룹화:

```
codex_tasks: [코드 생성, 리팩토링, 테스트 작성, API 구현]
gemini_tasks: [UI 컴포넌트, 디자인 구현, 스타일링]
claude_tasks: [아키텍처 결정, 플래닝, 복잡한 추론]
```

라우팅 기준은 `config/models.yaml`의 `routing` 섹션 참조.
태스크에 `[model:gemini]` 태그가 있으면 강제 라우팅.

### Step 2: Agent Teams 세션 + cmux 패널 생성

Agent Teams API로 통신 채널을 먼저 만들고, cmux 패널은 시각적 표시용으로 병렬 생성:

```
# Agent Teams 세션 생성
TeamCreate(name="cmux-ai-run-{project}-{timestamp}")

# 각 AI 역할에 태스크 등록
TaskCreate(team_name=..., title="codex-tasks", description="{codex_tasks_list}")
TaskCreate(team_name=..., title="gemini-tasks", description="{gemini_tasks_list}")
```

```bash
# cmux 패널 생성 (시각적 표시)
CODEX_SURFACE=$(cmux new-split right --json | jq -r '.surface_id')
GEMINI_SURFACE=$(cmux new-split down --surface $CODEX_SURFACE --json | jq -r '.surface_id')

mkdir -p .claude/cmux-ai/runs
```

### Step 3: 병렬 에이전트 실행

Claude 서브에이전트 2개를 동시에 실행. 각 에이전트는 내부적으로 gemini/codex CLI를 호출하고, 완료 시 `SendMessage`로 결과를 메인에 전달:

```
# gemini-runner 에이전트 (백그라운드)
Agent(
  subagent_type="builder",
  team_name="cmux-ai-run-{project}-{timestamp}",
  name="gemini-runner",
  run_in_background=true,
  prompt="""
    다음 태스크를 gemini CLI로 실행하세요.
    모델: gemini-3.1-pro-preview (또는 config 값)
    태스크: {gemini_tasks_list}

    1. `gemini --model gemini-3.1-pro-preview --yolo "{task_prompt}"` 실행
    2. 결과를 .claude/cmux-ai/runs/gemini-result.md에 저장
    3. SendMessage("team-lead", "gemini-runner: DONE\n{결과 요약}")
    4. TaskUpdate(task_id="{gemini_task_id}", status="completed")
  """
)

# codex-runner 에이전트 (백그라운드, 동시 실행)
Agent(
  subagent_type="builder",
  team_name="cmux-ai-run-{project}-{timestamp}",
  name="codex-runner",
  run_in_background=true,
  prompt="""
    다음 태스크를 codex CLI로 실행하세요.
    모델: gpt-5.4 (effort=high, 또는 config 값)
    태스크: {codex_tasks_list}

    1. `codex -q --model gpt-5.4 --effort high "{task_prompt}"` 실행
    2. 결과를 .claude/cmux-ai/runs/codex-result.md에 저장
    3. SendMessage("team-lead", "codex-runner: DONE\n{결과 요약}")
    4. TaskUpdate(task_id="{codex_task_id}", status="completed")
  """
)
```

cmux 패널에도 동시에 시각적 활동 표시:

```bash
# 패널에 진행 상황 표시 (시각용, 완료 감지는 SendMessage로)
cmux send-surface --surface $CODEX_SURFACE "echo '🤖 codex-runner started...'\n"
cmux send-surface --surface $GEMINI_SURFACE "echo '🤖 gemini-runner started...'\n"
cmux set-status "codex" "running" --icon gear --color "#007aff"
cmux set-status "gemini" "running" --icon brush --color "#5856d6"
cmux set-progress 0.3 --label "Parallel execution in progress..."
```

### Step 4: 완료 대기 (이벤트 기반)

메인 Claude는 두 에이전트의 `SendMessage`를 수신하여 완료를 감지 (폴링 없음):

```
# 두 에이전트가 각자 SendMessage로 완료를 알림
# 메인 Claude는 알림을 수신할 때까지 대기 (blocking)
#
# 수신 예시:
#   gemini-runner → "gemini-runner: DONE\n컴포넌트 3개 구현 완료..."
#   codex-runner  → "codex-runner: DONE\nAPI 엔드포인트 5개 구현 완료..."
#
# 두 메시지를 모두 받으면 Step 5로 진행
```

```bash
cmux set-progress 0.7 --label "Waiting for agents..."
```

### Step 5: 결과 통합 + 충돌 해결

두 에이전트 완료 후 Claude가 결과를 검토하고 프로젝트에 반영:

- **파일 충돌**: 같은 파일 수정 시 Claude가 중재
- **품질 검증**: lint, type-check, test 실행
- **적용**: Edit/Write 도구로 프로젝트에 반영

```bash
cmux set-progress 0.9 --label "Integrating results..."
# ... Claude가 결과 통합 ...
cmux set-progress 1.0 --label "Done"
cmux log --level success -- "cmux-ai-run: All tasks complete"
cmux notify --title "cmux-ai-run Complete" --body "All agents finished"
```

### Step 6: 패널 정리 (선택)

```bash
cmux clear-status "codex"
cmux clear-status "gemini"
# 패널 유지 (결과 확인) 또는 닫기는 사용자 선택에 맡김
```

---

## 태스크 태그 (TASKS.md에서 사용)

```markdown
- [ ] T1.1: Implement auth API [model:codex]
- [ ] T1.2: Create login UI component [model:gemini]
- [ ] T1.3: Design system architecture [model:claude]
- [ ] T1.4: Write integration tests  # 태그 없으면 routing 설정 기준 자동 배정
```

---

## Fallback

| 상황 | 동작 |
|------|------|
| `codex` CLI 없음 | Claude가 직접 처리 |
| `gemini` CLI 없음 | Claude가 직접 처리 |
| cmux 없음 | `/multi-ai-run` 사용 권장 |
| Agent 타임아웃 | SendMessage 미수신 시 5분 후 Claude가 직접 재시도 |

---

## 아키텍처 요약

```
메인 Claude (오케스트레이터)
├── TeamCreate → 통신 채널 수립
├── cmux 패널 생성 → 시각적 표시
├── Agent(gemini-runner, background) → gemini CLI 실행 → SendMessage 완료 알림
├── Agent(codex-runner, background)  → codex CLI 실행  → SendMessage 완료 알림
└── SendMessage 수신 → 결과 통합 (이벤트 기반, 폴링 없음)
```

---

## 설정 파일 우선순위

1. `.claude/cmux-ai-models.yaml` (프로젝트)
2. `config/models.yaml` (스킬 기본값)
