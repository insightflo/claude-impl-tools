---
name: cmux-ai-review
description: cmux 창 분할 기반 멀티-AI 합의 리뷰 엔진. 동일 워크스페이스에서 Gemini/Codex 패널을 나란히 분할해 3-Stage 파이프라인(의견 → 반론 → 합성)을 진짜 병렬로 실행합니다. multi-ai-review의 순차 실행 대신 두 AI가 동시에 리뷰하는 것을 실시간으로 볼 수 있음. "/cmux-ai-review", "cmux 코드 리뷰", "AI 패널 리뷰", "병렬 리뷰" 등 cmux 환경에서 여러 AI의 동시 리뷰가 필요한 요청이라면 반드시 이 스킬을 사용하세요.
triggers:
  - /cmux-ai-review
  - cmux 리뷰
  - cmux 코드 리뷰
  - 패널 리뷰
  - 병렬 AI 리뷰
version: 1.1.0
---

# /cmux-ai-review — cmux 창 분할 병렬 AI 리뷰

> **multi-ai-review와의 차이**: CLI 순차 호출 대신 cmux 패널 분할로 Stage 1을 진짜 동시 실행.
> 두 AI가 나란히 리뷰하는 것을 실시간으로 볼 수 있고, Stage 간 전환도 명확함.
>
> **완료 감지**: cmux 패널은 시각적 표시 전용. Stage 전환은 Agent Teams API (SendMessage)로 구동 — 파일 폴링 없음.

---

## 패널 레이아웃

```
┌────────────────────────────────────────┐
│  Claude (Chairman) — 현재 패널         │
│  오케스트레이션 + 최종 합성             │
├───────────────────┬────────────────────┤
│  Gemini 패널      │  Codex 패널        │
│  (Perspective A)  │  (Perspective B)   │
└───────────────────┴────────────────────┘
```

---

## Prerequisites

```bash
cmux ping || { echo "cmux 필요"; exit 1; }
CONFIG="${PROJECT_ROOT}/.claude/cmux-ai-models.yaml"
[ ! -f "$CONFIG" ] && CONFIG="${CLAUDE_PLUGIN_ROOT}/skills/cmux-ai-review/config/models.yaml"
```

---

## 모델 설정

기본값 (`config/models.yaml`):
- **Gemini**: `gemini-3.1-pro-preview` (Perspective A)
- **Codex**: `gpt-5.4`, `effort=high` (Perspective B)
- **Claude**: `opus` (Chairman)

프로젝트별 오버라이드: `.claude/cmux-ai-models.yaml`

---

## 3-Stage Pipeline

### Stage 1: 초기 의견 수집 (진짜 병렬)

```
gemini-reviewer 에이전트 ──→ gemini CLI 실행 ──→ SendMessage("opinion-ready", {...})
codex-reviewer 에이전트  ──→ codex CLI 실행  ──→ SendMessage("opinion-ready", {...})
                    ↑ 동시 실행 (백그라운드 에이전트)
```

### Stage 2: 상호 반론 (교차 리뷰)

```
두 의견 수신 확인 후 → 각 에이전트에 상대 의견 전달 (SendMessage) → 반론 작성
gemini-reviewer ← Codex 의견 전달 → 반론 → SendMessage("rebuttal-ready", {...})
codex-reviewer  ← Gemini 의견 전달 → 반론 → SendMessage("rebuttal-ready", {...})
```

### Stage 3: Chairman 합성

```
Claude ─── 양쪽 의견 + 반론 분석 ──→ Score Card + 최종 판정
```

---

## 실행 순서

### Step 1: 도메인 감지

요청 텍스트에서 도메인을 자동 감지:

| 키워드 | 도메인 | Gemini 역할 | Codex 역할 |
|--------|--------|-------------|------------|
| review, PR, code, merge | code-review | 아키텍처/가독성 | 기술/보안/성능 |
| market, stocks, macro | market-regime | 거시/뉴스 | 퀀트/지표 |
| investment, valuation | investment | 시장/전략 | 재무/리스크 |
| risk, security, danger | risk-assessment | 외부위협 | 내부취약점 |
| gate, milestone, Go/No-Go | project-gate | 이해관계자/범위 | 일정/리소스 |

감지 실패 시 `default` 프리셋 적용.

### Step 2: Agent Teams 세션 + cmux 패널 생성

```
# Agent Teams 세션 생성
TeamCreate(name="cmux-ai-review-{project}-{timestamp}")

# Stage별 태스크 등록
TaskCreate(team_name=..., title="stage1-opinions", description="Collect parallel opinions")
TaskCreate(team_name=..., title="stage2-rebuttals", description="Cross-rebuttal exchange")
```

```bash
# cmux 패널 생성 (시각적 표시)
mkdir -p .claude/cmux-ai/review
GEMINI_SURFACE=$(cmux new-split down --json | jq -r '.surface_id')
CODEX_SURFACE=$(cmux new-split right --surface $GEMINI_SURFACE --json | jq -r '.surface_id')

cmux set-status "review" "Stage 1: collecting opinions" --icon doc --color "#ff9500"
```

### Step 3: Stage 1 — 병렬 의견 수집

두 에이전트를 동시에 실행. 완료 시 SendMessage로 의견을 전달:

```
# gemini-reviewer 에이전트 (백그라운드)
Agent(
  subagent_type="builder",
  team_name="cmux-ai-review-{project}-{timestamp}",
  name="gemini-reviewer",
  run_in_background=true,
  prompt="""
    다음 대상을 {gemini_role} 관점에서 리뷰하세요.
    모델: gemini-3.1-pro-preview
    대상: {review_target}

    1. `gemini --model gemini-3.1-pro-preview --yolo "{review_prompt}"` 실행
    2. 결과를 .claude/cmux-ai/review/gemini-opinion.md에 저장
    3. SendMessage("team-lead", JSON.stringify({
         stage: "opinion",
         reviewer: "gemini",
         summary: "...(100자 요약)",
         file: ".claude/cmux-ai/review/gemini-opinion.md"
       }))
  """
)

# codex-reviewer 에이전트 (백그라운드, 동시 실행)
Agent(
  subagent_type="builder",
  team_name="cmux-ai-review-{project}-{timestamp}",
  name="codex-reviewer",
  run_in_background=true,
  prompt="""
    다음 대상을 {codex_role} 관점에서 리뷰하세요.
    모델: gpt-5.4 (effort=high)
    대상: {review_target}

    1. `codex -q --model gpt-5.4 --effort high "{review_prompt}"` 실행
    2. 결과를 .claude/cmux-ai/review/codex-opinion.md에 저장
    3. SendMessage("team-lead", JSON.stringify({
         stage: "opinion",
         reviewer: "codex",
         summary: "...(100자 요약)",
         file: ".claude/cmux-ai/review/codex-opinion.md"
       }))
  """
)
```

cmux 패널에 진행 상황 시각화:

```bash
cmux send-surface --surface $GEMINI_SURFACE "echo '🔍 Gemini reviewing...'\n"
cmux send-surface --surface $CODEX_SURFACE "echo '🔍 Codex reviewing...'\n"
cmux set-progress 0.3 --label "Stage 1: parallel opinions..."
```

메인 Claude는 두 `SendMessage(stage="opinion")` 수신 대기.

### Step 4: Stage 2 — 상호 반론 (이벤트 기반 전환)

두 의견 SendMessage 수신 확인 후 즉시 Stage 2 시작 (폴링 없음):

```
# 수신된 의견 파일 읽기
gemini_opinion = read(".claude/cmux-ai/review/gemini-opinion.md")
codex_opinion  = read(".claude/cmux-ai/review/codex-opinion.md")
```

```bash
cmux set-status "review" "Stage 2: cross-rebuttal" --icon arrow.2.squarepath --color "#5856d6"
cmux set-progress 0.5 --label "Stage 2: cross-rebuttal..."
```

각 에이전트에 상대 의견 전달 후 반론 요청:

```
# gemini-reviewer에게 Codex 의견 전달 (SendMessage)
SendMessage("gemini-reviewer", JSON.stringify({
  instruction: "rebuttal",
  opponent_opinion: codex_opinion,
  output_file: ".claude/cmux-ai/review/gemini-rebuttal.md",
  reply_when_done: true
}))

# codex-reviewer에게 Gemini 의견 전달 (SendMessage)
SendMessage("codex-reviewer", JSON.stringify({
  instruction: "rebuttal",
  opponent_opinion: gemini_opinion,
  output_file: ".claude/cmux-ai/review/codex-rebuttal.md",
  reply_when_done: true
}))

# 각 에이전트는 반론 작성 후 SendMessage(stage="rebuttal") 전송
# 메인 Claude는 두 rebuttal SendMessage 수신 대기
```

### Step 5: Stage 3 — Chairman 합성 (Claude)

두 반론 SendMessage 수신 후 즉시 합성:

```bash
cmux set-status "review" "Stage 3: chairman synthesis" --icon star --color "#34c759"
cmux set-progress 0.85 --label "Stage 3: synthesis..."
```

```
# 4개 파일 읽기
gemini_opinion  = read(".claude/cmux-ai/review/gemini-opinion.md")
codex_opinion   = read(".claude/cmux-ai/review/codex-opinion.md")
gemini_rebuttal = read(".claude/cmux-ai/review/gemini-rebuttal.md")
codex_rebuttal  = read(".claude/cmux-ai/review/codex-rebuttal.md")
```

Chairman 합성 규칙:
- 점수 차이 ≥ 15 → 증거 검증 후 결정 (평균 금지)
- code-review 도메인 → Codex 의견 2배 가중 (파일:라인 인용 시)
- 미해결 쟁점 → 추가 라운드 (최대 2회, Step 3부터 재실행)

Score Card 형식:

```
## Score Card — {domain} Review
- Overall Grade: A/B/C/D/F
- Score: {N}/100

| Dimension    | Score | Key Finding |
|-------------|-------|-------------|
| Security     |  /25  | ...         |
| Performance  |  /20  | ...         |
| Correctness  |  /20  | ...         |
| Maintain.    |  /25  | ...         |
| Style        |  /10  | ...         |

## Critical Issues
- [Critical] {issue}

## Recommendations
1. {recommendation}
```

### Step 6: 완료 + 패널 정리

```bash
cmux set-progress 1.0 --label "Done"
cmux set-status "review" "complete" --icon checkmark --color "#34c759"
cmux log --level success -- "cmux-ai-review: {grade} ({score}/100)"
cmux notify --title "Review Complete" --body "{grade}: {top finding}"

# 결과를 .claude/cmux-ai/review/final-scorecard.md에 저장
# 패널 정리는 사용자 선택에 맡김
```

---

## 추가 라운드 조건

Chairman이 아래 조건 중 하나 해당 시 Step 3부터 재실행 (에이전트 재활용):

- 두 AI 점수 차이 ≥ 15점
- Critical 이슈가 한쪽만 언급
- 핵심 사실 관계 불일치

최대 2회까지 반복.

---

## 아키텍처 요약

```
메인 Claude (Chairman/오케스트레이터)
├── TeamCreate → 통신 채널 수립
├── cmux 패널 생성 → 시각적 표시
│
├── [Stage 1] Agent(gemini-reviewer, bg) → gemini CLI → SendMessage(stage="opinion")
│            Agent(codex-reviewer, bg)  → codex CLI  → SendMessage(stage="opinion")
│            ↓ 두 의견 수신 후 즉시 Stage 2
│
├── [Stage 2] SendMessage(gemini-reviewer, {codex_opinion}) → 반론 → SendMessage(stage="rebuttal")
│            SendMessage(codex-reviewer, {gemini_opinion})  → 반론 → SendMessage(stage="rebuttal")
│            ↓ 두 반론 수신 후 즉시 Stage 3
│
└── [Stage 3] Chairman 합성 → Score Card 출력
```

---

## Fallback

| 상황 | 동작 |
|------|------|
| `gemini` CLI 없음 | Gemini 패널 대신 Claude가 Perspective A 담당 |
| `codex` CLI 없음 | Codex 패널 대신 Claude가 Perspective B 담당 |
| cmux 없음 | `/multi-ai-review` 사용 권장 |
| Agent 무응답 | SendMessage 미수신 시 5분 후 Claude가 직접 해당 역할 수행 |

---

## 출력 파일 구조

```
.claude/cmux-ai/review/
├── gemini-opinion.md      # Stage 1 Gemini
├── codex-opinion.md       # Stage 1 Codex
├── gemini-rebuttal.md     # Stage 2 Gemini
├── codex-rebuttal.md      # Stage 2 Codex
└── final-scorecard.md     # Stage 3 결과
```
