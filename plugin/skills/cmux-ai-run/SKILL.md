---
name: cmux-ai-run
description: cmux 창 분할 기반 멀티-AI 병렬 태스크 실행. 동일 워크스페이스에서 Codex(코드)/Gemini(디자인)/Claude(계획)를 패널로 분할해 동시에 실행합니다. multi-ai-run의 순차 실행과 달리 진짜 병렬. "/cmux-ai-run", "cmux로 AI 분업", "창 분할 병렬 실행", "codex gemini 동시 실행" 등 cmux 환경에서 여러 AI를 동시에 돌리고 싶은 요청이라면 반드시 이 스킬을 사용하세요.
triggers:
  - /cmux-ai-run
  - cmux AI 분업
  - cmux 병렬 실행
  - 창 분할 실행
version: 1.3.0
---

# /cmux-ai-run — cmux 창 분할 병렬 AI 실행

> **multi-ai-run과의 차이**: Bash 서브프로세스(순차) 대신 cmux 패널 분할(진짜 병렬).
>
> **두 가지 실행 모드:**
> - **기본 모드**: Background Agent + `tail -f` 로그 스트리밍. SendMessage 완료 감지.
> - **`--live-mode`**: 패널에서 실제 `claude -p` 프로세스 직접 실행. Claude Code의 `teammateMode=tmux`처럼 에이전트가 패널에서 살아있는 상태로 보임.

---

## 패널 레이아웃

```
┌─────────────────────┬──────────────────────────┐
│  Claude             │  codex-runner 로그        │
│  (현재 패널)        │  $ tail -f codex.log      │
│  오케스트레이터     │  [진행 상황 실시간 표시]   │
│                     ├──────────────────────────┤
│                     │  gemini-runner 로그       │
│                     │  $ tail -f gemini.log     │
│                     │  [진행 상황 실시간 표시]   │
└─────────────────────┴──────────────────────────┘
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

### Step 2: 로그 파일 + Agent Teams 세션 + cmux 패널 생성

```bash
# 로그 파일 먼저 생성 (tail -f가 즉시 열 수 있도록)
mkdir -p .claude/cmux-ai/runs
touch .claude/cmux-ai/runs/codex-runner.log
touch .claude/cmux-ai/runs/gemini-runner.log
```

```
# Agent Teams 세션 생성
TeamCreate(name="cmux-ai-run-{project}-{timestamp}", description="Parallel AI task execution")
TaskCreate(team_name=..., subject="codex-tasks", description="{codex_tasks_list}")
TaskCreate(team_name=..., subject="gemini-tasks", description="{gemini_tasks_list}")
```

```bash
# cmux 패널 생성 + 즉시 tail -f 실행
CODEX_SURFACE=$(cmux new-split right 2>&1 | awk '{print $2}')
GEMINI_SURFACE=$(cmux new-split down --surface $CODEX_SURFACE 2>&1 | awk '{print $2}')

# 패널에 로그 스트리밍 시작 (에이전트 작업이 보임)
cmux send --surface $CODEX_SURFACE \
  "tail -f .claude/cmux-ai/runs/codex-runner.log
"
cmux send --surface $GEMINI_SURFACE \
  "tail -f .claude/cmux-ai/runs/gemini-runner.log
"

cmux set-status "codex" "running" --icon gear --color "#007aff"
cmux set-status "gemini" "running" --icon brush --color "#5856d6"
cmux set-progress 0.2 --label "Agents starting..."
```

### Step 3: 병렬 에이전트 실행

각 에이전트는 진행 상황을 로그 파일에 기록하고, 완료 시 `SendMessage`로 보고:

```
Agent(
  subagent_type="builder",
  team_name="cmux-ai-run-{project}-{timestamp}",
  name="codex-runner",
  run_in_background=true,
  prompt="""
    다음 태스크를 실행하세요.
    태스크: {codex_tasks_list}

    작업 진행 중 아래 규칙으로 .claude/cmux-ai/runs/codex-runner.log 에 실시간 기록:
      - 태스크 시작 시:    echo "[HH:MM:SS] ▶ {task 이름}" >> ...log
      - 파일 읽을 때:      echo "[HH:MM:SS]   📖 reading {file}" >> ...log
      - 파일 쓸 때:        echo "[HH:MM:SS]   ✏️  writing {file}" >> ...log
      - 명령 실행 시:      echo "[HH:MM:SS]   $ {command}" >> ...log
      - 명령 결과:         echo "[HH:MM:SS]   → {결과 한 줄}" >> ...log
      - 결정/판단 시:      echo "[HH:MM:SS]   💡 {결정 내용}" >> ...log
      - 태스크 완료 시:    echo "[HH:MM:SS] ✅ {task 이름} done" >> ...log
      - 에러 발생 시:      echo "[HH:MM:SS]   ⚠️  {에러 내용}" >> ...log

    모든 태스크 완료 후:
      echo "[HH:MM:SS] ━━━━━━━━━━━━━━━━━━━━━━━━━" >> .claude/cmux-ai/runs/codex-runner.log
      echo "[HH:MM:SS] 🏁 codex-runner ALL DONE ({N}개 태스크)" >> .claude/cmux-ai/runs/codex-runner.log
      SendMessage(
        to="team-lead",
        message="{결과 전체 내용}",
        summary="codex-runner: DONE — {완료된 태스크 수}개 완료"
      )
  """
)

Agent(
  subagent_type="builder",
  team_name="cmux-ai-run-{project}-{timestamp}",
  name="gemini-runner",
  run_in_background=true,
  prompt="""
    다음 태스크를 실행하세요.
    태스크: {gemini_tasks_list}

    작업 진행 중 아래 규칙으로 .claude/cmux-ai/runs/gemini-runner.log 에 실시간 기록:
      - 태스크 시작 시:    echo "[HH:MM:SS] ▶ {task 이름}" >> ...log
      - 파일 읽을 때:      echo "[HH:MM:SS]   📖 reading {file}" >> ...log
      - 파일 쓸 때:        echo "[HH:MM:SS]   ✏️  writing {file}" >> ...log
      - 명령 실행 시:      echo "[HH:MM:SS]   $ {command}" >> ...log
      - 명령 결과:         echo "[HH:MM:SS]   → {결과 한 줄}" >> ...log
      - 결정/판단 시:      echo "[HH:MM:SS]   💡 {결정 내용}" >> ...log
      - 태스크 완료 시:    echo "[HH:MM:SS] ✅ {task 이름} done" >> ...log
      - 에러 발생 시:      echo "[HH:MM:SS]   ⚠️  {에러 내용}" >> ...log

    모든 태스크 완료 후:
      echo "[HH:MM:SS] ━━━━━━━━━━━━━━━━━━━━━━━━━" >> .claude/cmux-ai/runs/gemini-runner.log
      echo "[HH:MM:SS] 🏁 gemini-runner ALL DONE ({N}개 태스크)" >> .claude/cmux-ai/runs/gemini-runner.log
      SendMessage(
        to="team-lead",
        message="{결과 전체 내용}",
        summary="gemini-runner: DONE — {완료된 태스크 수}개 완료"
      )
  """
)
```

```bash
cmux set-progress 0.4 --label "Agents running (see panels)..."
```

### Step 4: 완료 대기 (이벤트 기반)

메인 Claude는 두 에이전트의 `SendMessage` 수신 대기. 수신 시 패널의 로그에도 완료가 표시되어 있음.

```bash
cmux set-progress 0.7 --label "Waiting for agents..."
```

### Step 5: 결과 통합 + 충돌 해결

두 `SendMessage` 수신 후 결과를 검토하고 프로젝트에 반영:

- **파일 충돌**: 같은 파일 수정 시 Claude가 중재
- **품질 검증**: lint, type-check, test 실행
- **적용**: Edit/Write 도구로 프로젝트에 반영

```bash
cmux set-progress 0.9 --label "Integrating results..."
# ... Claude가 결과 통합 ...
cmux set-progress 1.0 --label "Done"
cmux log --level success -- "cmux-ai-run: All tasks complete"
cmux notify --title "cmux-ai-run Complete" --body "All agents finished"
cmux clear-status "codex"
cmux clear-status "gemini"
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
| Agent 무응답 (5분) | Claude가 직접 해당 태스크 수행 |

---

## 아키텍처 요약

```
메인 Claude (오케스트레이터)
├── 로그 파일 생성 → cmux 패널에서 tail -f (실시간 가시화)
├── TeamCreate → 통신 채널 수립
├── Agent(codex-runner, bg) → 작업 + 로그 기록 → SendMessage(summary="DONE")
├── Agent(gemini-runner, bg) → 작업 + 로그 기록 → SendMessage(summary="DONE")
└── SendMessage 수신 → 결과 통합 (이벤트 기반)
```

---

## --live-mode

> Claude Code의 `teammateMode=tmux`처럼 에이전트를 패널에서 **직접** 실행.
> 패널에서 `claude -p` 프로세스가 실제로 작업하는 모습이 보임.
> 완료 감지는 `.done` 파일 폴링 (5분 타임아웃).

### 언제 사용?

- 에이전트가 실제로 작업하는 것을 눈으로 확인하고 싶을 때
- 패널에서 직접 개입(Ctrl+C, 명령 추가 등)이 필요할 때

### Live Mode 실행 순서

**Step 1: 프롬프트 파일 + 패널 생성**

```bash
mkdir -p .claude/cmux-ai/runs
rm -f .claude/cmux-ai/runs/codex-runner.done .claude/cmux-ai/runs/gemini-runner.done

# 각 에이전트 프롬프트를 파일로 작성 (따옴표 이스케이프 없이 전달)
cat > .claude/cmux-ai/runs/codex-prompt.md << 'PROMPTEOF'
{codex_tasks_list}

완료 후 반드시 실행:
  echo "DONE" > .claude/cmux-ai/runs/codex-runner.done
PROMPTEOF

cat > .claude/cmux-ai/runs/gemini-prompt.md << 'PROMPTEOF'
{gemini_tasks_list}

완료 후 반드시 실행:
  echo "DONE" > .claude/cmux-ai/runs/gemini-runner.done
PROMPTEOF

# 패널 생성
CODEX_SURFACE=$(cmux new-split right 2>&1 | awk '{print $2}')
GEMINI_SURFACE=$(cmux new-split down --surface $CODEX_SURFACE 2>&1 | awk '{print $2}')

cmux set-status "codex" "live" --icon gear --color "#007aff"
cmux set-status "gemini" "live" --icon brush --color "#5856d6"
cmux set-progress 0.2 --label "Live agents starting..."
```

**Step 2: 패널에서 실제 AI CLI 직접 실행**

```bash
# Codex 패널: 실제 codex CLI 실행 — 코드 작업
cmux send --surface $CODEX_SURFACE \
  "codex exec \"\$(cat .claude/cmux-ai/runs/codex-prompt.md)\"
"

# Gemini 패널: 실제 gemini CLI 실행 — 디자인/UI 작업
cmux send --surface $GEMINI_SURFACE \
  "gemini -y -p \"\$(cat .claude/cmux-ai/runs/gemini-prompt.md)\"
"

cmux set-progress 0.4 --label "Live agents running (watch panels)..."
```

**Step 3: 완료 대기 (파일 폴링, 5분 타임아웃)**

```bash
TIMEOUT=300
ELAPSED=0
while true; do
  [ -f .claude/cmux-ai/runs/codex-runner.done ] && \
  [ -f .claude/cmux-ai/runs/gemini-runner.done ] && break
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  if [ $ELAPSED -ge $TIMEOUT ]; then
    cmux notify --title "cmux-ai-run timeout" --body "5분 초과 — Claude가 직접 처리합니다"
    break
  fi
done
cmux set-progress 0.9 --label "Integrating results..."
```

**Step 4: 결과 통합 (기본 모드 Step 5와 동일)**

패널의 에이전트가 출력한 파일/변경사항을 검토하고 프로젝트에 반영.

```bash
cmux set-progress 1.0 --label "Done"
cmux log --level success -- "cmux-ai-run (live): All tasks complete"
cmux notify --title "cmux-ai-run Complete" --body "Live agents finished"
cmux clear-status "codex"
cmux clear-status "gemini"
```

### Live Mode 아키텍처

```
메인 Claude (오케스트레이터)
├── 프롬프트 파일 작성 → 패널에서 실제 AI CLI 직접 실행
├── cmux new-split → 이기종 AI가 패널에서 동시 작업
├── codex 패널: codex exec "..."  ← 진짜 Codex가 코드 작업
├── gemini 패널: gemini -y -p "..." ← 진짜 Gemini가 디자인 작업
└── .done 파일 감지 (5분 타임아웃) → Claude가 결과 통합
```

### 기본 모드 vs --live-mode 비교

| | 기본 모드 | --live-mode |
|--|--|--|
| **실제 사용 AI** | Claude 서브에이전트 (이름만 codex/gemini) | 진짜 Codex + 진짜 Gemini CLI |
| 에이전트 실행 | Background subagent | 패널에서 실제 CLI 프로세스 |
| 시각화 | 로그 파일 tail -f | 에이전트가 직접 작업하는 모습 |
| 완료 감지 | SendMessage (이벤트) | .done 파일 폴링 (5분 타임아웃) |
| 개입 가능 여부 | 불가 | 패널 클릭 후 직접 조작 가능 |
| 신뢰성 | 높음 | 패널 프로세스 종료 시 감지 못할 수 있음 |

---

## 설정 파일 우선순위

1. `.claude/cmux-ai-models.yaml` (프로젝트)
2. `config/models.yaml` (스킬 기본값)
