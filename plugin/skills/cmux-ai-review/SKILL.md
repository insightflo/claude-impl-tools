---
name: cmux-ai-review
description: cmux 창 분할 기반 멀티-AI 합의 리뷰 엔진. 동일 워크스페이스에서 Gemini/Codex 패널을 나란히 분할해 3-Stage 파이프라인(의견 → 반론 → 합성)을 진짜 병렬로 실행합니다. multi-ai-review의 순차 실행 대신 두 AI가 동시에 리뷰하는 것을 실시간으로 볼 수 있음. "/cmux-ai-review", "cmux 코드 리뷰", "AI 패널 리뷰", "병렬 리뷰" 등 cmux 환경에서 여러 AI의 동시 리뷰가 필요한 요청이라면 반드시 이 스킬을 사용하세요.
triggers:
  - /cmux-ai-review
  - cmux 리뷰
  - cmux 코드 리뷰
  - 패널 리뷰
  - 병렬 AI 리뷰
version: 1.0.0
---

# /cmux-ai-review — cmux 창 분할 병렬 AI 리뷰

> **multi-ai-review와의 차이**: CLI 순차 호출 대신 cmux 패널 분할로 Stage 1을 진짜 동시 실행.
> 두 AI가 나란히 리뷰하는 것을 실시간으로 볼 수 있고, Stage 간 전환도 명확함.

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
Gemini 패널 ─── 리뷰 프롬프트 ──→ .claude/cmux-ai/review/gemini-opinion.md
Codex 패널  ─── 리뷰 프롬프트 ──→ .claude/cmux-ai/review/codex-opinion.md
                    ↑ 동시 실행 (cmux send-surface로 양쪽에 동시 전송)
```

### Stage 2: 상호 반론 (교차 리뷰)

```
Gemini 패널 ─── Codex 의견 읽기 ──→ .claude/cmux-ai/review/gemini-rebuttal.md
Codex 패널  ─── Gemini 의견 읽기 ──→ .claude/cmux-ai/review/codex-rebuttal.md
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

### Step 2: 패널 생성

```bash
mkdir -p .claude/cmux-ai/review

# 현재 패널(Claude) 하단 분할
GEMINI_SURFACE=$(cmux new-split down --json | jq -r '.surface_id')

# Gemini 패널 우측 분할
CODEX_SURFACE=$(cmux new-split right --surface $GEMINI_SURFACE --json | jq -r '.surface_id')

cmux set-status "review" "Stage 1: collecting opinions" --icon doc --color "#ff9500"
```

### Step 3: Stage 1 — 병렬 의견 수집

Gemini와 Codex에 동시 전송:

```bash
GEMINI_MODEL=$(yq '.models.gemini.model' $CONFIG)
CODEX_MODEL=$(yq '.models.codex.model' $CONFIG)
CODEX_EFFORT=$(yq '.models.codex.effort' $CONFIG)
DOMAIN_ROLE_G="[config/models.yaml panel_roles.{domain}.gemini 값]"
DOMAIN_ROLE_C="[config/models.yaml panel_roles.{domain}.codex 값]"

# Gemini 패널 전송
cmux send-surface --surface $GEMINI_SURFACE \
  "gemini --model $GEMINI_MODEL --yolo \"
당신의 역할: $DOMAIN_ROLE_G 관점에서 리뷰
대상: {review_target}

리뷰를 완료한 후:
1. 의견을 .claude/cmux-ai/review/gemini-opinion.md에 저장
2. touch .claude/cmux-ai/review/gemini-opinion.done 실행
\"\n"

# Codex 패널 전송 (동시에)
cmux send-surface --surface $CODEX_SURFACE \
  "codex -q --model $CODEX_MODEL --effort $CODEX_EFFORT \"
당신의 역할: $DOMAIN_ROLE_C 관점에서 리뷰
대상: {review_target}

리뷰를 완료한 후:
1. 의견을 .claude/cmux-ai/review/codex-opinion.md에 저장
2. touch .claude/cmux-ai/review/codex-opinion.done 실행
\"\n"

# 완료 대기
until [ -f .claude/cmux-ai/review/gemini-opinion.done ] && \
      [ -f .claude/cmux-ai/review/codex-opinion.done ]; do
  sleep 3
done
```

### Step 4: Stage 2 — 상호 반론

각 AI에게 상대방의 의견을 전달:

```bash
cmux set-status "review" "Stage 2: cross-rebuttal" --icon arrow.2.squarepath --color "#5856d6"

GEMINI_OPINION=$(cat .claude/cmux-ai/review/gemini-opinion.md)
CODEX_OPINION=$(cat .claude/cmux-ai/review/codex-opinion.md)

# Gemini → Codex 의견 검토
cmux send-surface --surface $GEMINI_SURFACE \
  "gemini --model $GEMINI_MODEL --yolo \"
다음은 Codex의 리뷰 의견입니다:
---
$CODEX_OPINION
---
동의하거나 반론할 부분을 구체적으로 기술하세요.
결과를 .claude/cmux-ai/review/gemini-rebuttal.md에 저장 후
touch .claude/cmux-ai/review/gemini-rebuttal.done 실행
\"\n"

# Codex → Gemini 의견 검토 (동시에)
cmux send-surface --surface $CODEX_SURFACE \
  "codex -q --model $CODEX_MODEL --effort $CODEX_EFFORT \"
다음은 Gemini의 리뷰 의견입니다:
---
$GEMINI_OPINION
---
동의하거나 반론할 부분을 구체적으로 기술하세요.
결과를 .claude/cmux-ai/review/codex-rebuttal.md에 저장 후
touch .claude/cmux-ai/review/codex-rebuttal.done 실행
\"\n"

until [ -f .claude/cmux-ai/review/gemini-rebuttal.done ] && \
      [ -f .claude/cmux-ai/review/codex-rebuttal.done ]; do
  sleep 3
done
```

### Step 5: Stage 3 — Chairman 합성 (Claude)

Claude가 모든 의견과 반론을 종합해 Score Card 작성:

```bash
cmux set-status "review" "Stage 3: chairman synthesis" --icon star --color "#34c759"

# 4개 파일 읽기
GEMINI_OP=$(cat .claude/cmux-ai/review/gemini-opinion.md)
CODEX_OP=$(cat .claude/cmux-ai/review/codex-opinion.md)
GEMINI_RB=$(cat .claude/cmux-ai/review/gemini-rebuttal.md)
CODEX_RB=$(cat .claude/cmux-ai/review/codex-rebuttal.md)
```

Chairman 합성 규칙:
- 점수 차이 ≥ 15 → 증거 검증 후 결정 (평균 금지)
- code-review 도메인 → Codex 의견 2배 가중 (파일:라인 인용 시)
- 미해결 쟁점 → 추가 라운드 (최대 2회)

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
cmux set-status "review" "complete" --icon checkmark --color "#34c759"
cmux log --level success -- "cmux-ai-review: {grade} ({score}/100)"
cmux notify --title "Review Complete" --body "{grade}: {top finding}"

# 결과를 .claude/cmux-ai/review/final-scorecard.md에 저장
# 패널 정리 (선택)
```

---

## 추가 라운드 조건

Chairman이 아래 조건 중 하나 해당 시 Stage 2 재실행:
- 두 AI 점수 차이 ≥ 15점
- Critical 이슈가 한쪽만 언급
- 핵심 사실 관계 불일치

최대 2회까지 반복.

---

## Fallback

| 상황 | 동작 |
|------|------|
| `gemini` CLI 없음 | Gemini 패널 대신 Claude가 Perspective A 담당 |
| `codex` CLI 없음 | Codex 패널 대신 Claude가 Perspective B 담당 |
| cmux 없음 | `/multi-ai-review` 사용 권장 |

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
