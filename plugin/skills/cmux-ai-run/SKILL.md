---
name: cmux-ai-run
description: cmux 창 분할 기반 멀티-AI 병렬 태스크 실행. 동일 워크스페이스에서 Codex(코드)/Gemini(디자인)/Claude(계획)를 패널로 분할해 동시에 실행합니다. multi-ai-run의 순차 실행과 달리 진짜 병렬. "/cmux-ai-run", "cmux로 AI 분업", "창 분할 병렬 실행", "codex gemini 동시 실행" 등 cmux 환경에서 여러 AI를 동시에 돌리고 싶은 요청이라면 반드시 이 스킬을 사용하세요.
triggers:
  - /cmux-ai-run
  - cmux AI 분업
  - cmux 병렬 실행
  - 창 분할 실행
version: 1.0.0
---

# /cmux-ai-run — cmux 창 분할 병렬 AI 실행

> **multi-ai-run과의 차이**: Bash 서브프로세스(순차) 대신 cmux 패널 분할(진짜 병렬).
> 같은 워크스페이스에서 Codex/Gemini 패널이 동시에 실행되는 것을 눈으로 볼 수 있음.

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

### Step 2: 패널 생성

```bash
# 현재 패널(Claude) 기준으로 우측 분할 → Codex
CODEX_SURFACE=$(cmux new-split right --json | jq -r '.surface_id')

# Codex 패널 우측 하단 분할 → Gemini
GEMINI_SURFACE=$(cmux new-split down --surface $CODEX_SURFACE --json | jq -r '.surface_id')

# 출력 디렉토리 준비
mkdir -p .claude/cmux-ai/runs
```

### Step 3: 출력 수집 규약 (각 AI에게 전달)

각 AI는 작업 완료 시 반드시:
1. 결과를 `.claude/cmux-ai/runs/{ai}-{task-id}.md`에 기록
2. 완료 마커 `.claude/cmux-ai/runs/{ai}-{task-id}.done` 생성

```bash
# Claude가 Codex 패널에 전송하는 명령 형식
CODEX_PROMPT="
다음 태스크를 구현하고 결과를 파일에 기록하세요.

태스크: {task_description}

완료 후:
1. 구현 내용 요약을 .claude/cmux-ai/runs/codex-{task_id}.md에 저장
2. touch .claude/cmux-ai/runs/codex-{task_id}.done 실행

모델: $(yq '.models.codex.model' $CONFIG)
"

cmux send-surface --surface $CODEX_SURFACE \
  "codex $(yq '.models.codex.args' $CONFIG) \
   --model $(yq '.models.codex.model' $CONFIG) \
   --effort $(yq '.models.codex.effort' $CONFIG) \
   \"$CODEX_PROMPT\"\n"
```

### Step 4: 병렬 디스패치

Codex와 Gemini 패널에 각자 태스크를 동시 전송 (순서 상관없이):

```bash
# --- Codex 패널: 코드 태스크 전송 ---
for task in "${codex_tasks[@]}"; do
  cmux send-surface --surface $CODEX_SURFACE "[task prompt for $task]\n"
done

# --- Gemini 패널: 디자인 태스크 전송 (동시에) ---
for task in "${gemini_tasks[@]}"; do
  cmux send-surface --surface $GEMINI_SURFACE "[task prompt for $task]\n"
done

# 사이드바 진행 표시
cmux set-status "codex" "running ${#codex_tasks[@]} tasks" --icon gear --color "#007aff"
cmux set-status "gemini" "running ${#gemini_tasks[@]} tasks" --icon brush --color "#5856d6"
cmux set-progress 0.3 --label "Parallel execution in progress..."
```

### Step 5: 완료 대기 + 결과 수집

Claude가 완료 마커를 폴링 (각 태스크가 .done 파일 생성 시 완료):

```bash
# 폴링 (완료 대기)
wait_for_done() {
  local marker="$1"
  local timeout=300  # 5분
  local elapsed=0
  while [ ! -f "$marker" ] && [ $elapsed -lt $timeout ]; do
    sleep 5; elapsed=$((elapsed+5))
  done
  [ -f "$marker" ]  # true if done, false if timeout
}

# 모든 태스크 완료 대기
for task_id in "${all_task_ids[@]}"; do
  wait_for_done ".claude/cmux-ai/runs/codex-${task_id}.done" &
  wait_for_done ".claude/cmux-ai/runs/gemini-${task_id}.done" &
done
wait  # 모든 백그라운드 대기 완료

# 결과 읽기
for task_id in "${codex_task_ids[@]}"; do
  cat ".claude/cmux-ai/runs/codex-${task_id}.md"
done
```

### Step 6: 결과 통합 + 충돌 해결

Claude가 각 AI의 출력을 검토:
- **파일 충돌**: 같은 파일 수정 시 Claude가 중재
- **품질 검증**: lint, type-check, test 실행
- **적용**: Edit/Write 도구로 프로젝트에 반영

```bash
cmux set-progress 0.9 --label "Integrating results..."
# ... Claude가 결과 통합 ...
cmux set-progress 1.0 --label "Done"
cmux log --level success -- "cmux-ai-run: All tasks complete"
```

### Step 7: 패널 정리 (선택)

```bash
# 패널 유지 (결과 확인용) 또는 닫기
read -p "패널을 닫으시겠습니까? (y/N): " close_panes
if [[ "$close_panes" == "y" ]]; then
  cmux send-surface --surface $CODEX_SURFACE "exit\n"
  cmux send-surface --surface $GEMINI_SURFACE "exit\n"
fi
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
| 태스크 타임아웃 (5분) | Claude가 직접 재시도 |

---

## 설정 파일 우선순위

1. `.claude/cmux-ai-models.yaml` (프로젝트)
2. `config/models.yaml` (스킬 기본값)
