---
name: cmux-ai-review
description: cmux 창 분할 기반 멀티-AI 합의 리뷰 엔진. 동일 워크스페이스에서 Gemini/Codex 패널을 나란히 분할해 3-Stage 파이프라인(의견 → 반론 → 합성)을 진짜 병렬로 실행합니다. multi-ai-review의 순차 실행 대신 두 AI가 동시에 리뷰하는 것을 실시간으로 볼 수 있음. "/cmux-ai-review", "cmux 코드 리뷰", "AI 패널 리뷰", "병렬 리뷰" 등 cmux 환경에서 여러 AI의 동시 리뷰가 필요한 요청이라면 반드시 이 스킬을 사용하세요.
triggers:
  - /cmux-ai-review
  - cmux 리뷰
  - cmux 코드 리뷰
  - 패널 리뷰
  - 병렬 AI 리뷰
version: 1.3.0
---

# /cmux-ai-review — cmux 창 분할 병렬 AI 리뷰

> **multi-ai-review와의 차이**: CLI 순차 호출 대신 cmux 패널 분할로 Stage 1을 진짜 동시 실행.
>
> **두 가지 실행 모드:**
> - **기본 모드**: Background Agent + `tail -f` 로그 스트리밍. SendMessage로 Stage 전환.
> - **`--live-mode`**: 패널에서 실제 `claude -p` 프로세스 직접 실행. Stage 전환도 패널에서 새 명령으로 이어짐.

---

## 패널 레이아웃

```
┌────────────────────────────────────────┐
│  Claude (Chairman) — 현재 패널         │
│  오케스트레이션 + 최종 합성             │
├───────────────────┬────────────────────┤
│  Gemini 패널      │  Codex 패널        │
│  tail -f          │  tail -f           │
│  gemini-review.log│  codex-review.log  │
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
gemini-reviewer 에이전트 ──→ 리뷰 + 로그 기록 ──→ SendMessage(summary="opinion-ready")
codex-reviewer 에이전트  ──→ 리뷰 + 로그 기록 ──→ SendMessage(summary="opinion-ready")
                    ↑ 동시 실행 / 패널에서 tail -f로 실시간 확인
```

### Stage 2: 상호 반론 (교차 리뷰)

```
SendMessage 수신 후 즉시 전환
gemini-reviewer ← Codex 의견 전달 → 반론 → SendMessage(summary="rebuttal-ready")
codex-reviewer  ← Gemini 의견 전달 → 반론 → SendMessage(summary="rebuttal-ready")
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

### Step 2: 로그 파일 + Agent Teams 세션 + cmux 패널 생성

```bash
# 로그 파일 먼저 생성 (tail -f가 즉시 열 수 있도록)
mkdir -p .claude/cmux-ai/review
touch .claude/cmux-ai/review/gemini-reviewer.log
touch .claude/cmux-ai/review/codex-reviewer.log
```

```
# Agent Teams 세션 생성
TeamCreate(name="cmux-ai-review-{project}-{timestamp}", description="Parallel AI review pipeline")
TaskCreate(team_name=..., subject="stage1-opinions", description="Collect parallel opinions")
TaskCreate(team_name=..., subject="stage2-rebuttals", description="Cross-rebuttal exchange")
```

```bash
# 패널 생성 + 즉시 tail -f 실행
GEMINI_SURFACE=$(cmux new-split down 2>&1 | awk '{print $2}')
CODEX_SURFACE=$(cmux new-split right --surface $GEMINI_SURFACE 2>&1 | awk '{print $2}')

cmux send --surface $GEMINI_SURFACE \
  "tail -f .claude/cmux-ai/review/gemini-reviewer.log
"
cmux send --surface $CODEX_SURFACE \
  "tail -f .claude/cmux-ai/review/codex-reviewer.log
"

cmux set-status "review" "Stage 1: collecting opinions" --icon doc --color "#ff9500"
cmux set-progress 0.2 --label "Stage 1: starting reviewers..."
```

### Step 3: Stage 1 — 병렬 의견 수집

```
Agent(
  subagent_type="builder",
  team_name="cmux-ai-review-{project}-{timestamp}",
  name="gemini-reviewer",
  run_in_background=true,
  prompt="""
    다음 대상을 {gemini_role} 관점에서 리뷰하세요.
    대상: {review_target}

    작업 진행 중 아래 규칙으로 .claude/cmux-ai/review/gemini-reviewer.log 에 실시간 기록:
      - 리뷰 항목 시작 시:  echo "[Stage1][HH:MM:SS] ▶ {항목 이름} 분석 시작" >> ...log
      - 파일 읽을 때:        echo "[Stage1][HH:MM:SS]   📖 reading {file}" >> ...log
      - 발견 내용:           echo "[Stage1][HH:MM:SS]   🔍 {발견 내용 한 줄}" >> ...log
      - 판단/결정 시:        echo "[Stage1][HH:MM:SS]   💡 {판단 내용}" >> ...log
      - 명령 실행 시:        echo "[Stage1][HH:MM:SS]   $ {command}" >> ...log
      - 명령 결과:           echo "[Stage1][HH:MM:SS]   → {결과 한 줄}" >> ...log
      - 이슈 발견 시:        echo "[Stage1][HH:MM:SS]   ⚠️  {이슈 내용}" >> ...log
      - 항목 완료 시:        echo "[Stage1][HH:MM:SS] ✅ {항목 이름} 분석 완료" >> ...log

    완료 후:
      - 의견 전체를 .claude/cmux-ai/review/gemini-opinion.md 에 저장
      echo "[Stage1][HH:MM:SS] ━━━━━━━━━━━━━━━━━━━━━━━━━" >> .claude/cmux-ai/review/gemini-reviewer.log
      echo "[Stage1][HH:MM:SS] 🏁 gemini-reviewer Stage1 DONE" >> .claude/cmux-ai/review/gemini-reviewer.log
      SendMessage(
        to="team-lead",
        message="{의견 전체 내용}",
        summary="gemini-reviewer: Stage1 DONE — opinion ready"
      )

    Stage 2 SendMessage 수신 대기. 수신 시 {codex_opinion}을 받아:
      - 반론 시작:           echo "[Stage2][HH:MM:SS] ▶ Rebuttal 시작 (상대 의견 검토 중)" >> ...log
      - 동의 포인트:         echo "[Stage2][HH:MM:SS]   ✓ 동의: {내용}" >> ...log
      - 반박 포인트:         echo "[Stage2][HH:MM:SS]   ✗ 반박: {내용}" >> ...log
      - 추가 발견 시:        echo "[Stage2][HH:MM:SS]   🔍 추가 발견: {내용}" >> ...log
      - 판단/결정 시:        echo "[Stage2][HH:MM:SS]   💡 {판단 내용}" >> ...log
      반론을 .claude/cmux-ai/review/gemini-rebuttal.md 에 저장
      echo "[Stage2][HH:MM:SS] ━━━━━━━━━━━━━━━━━━━━━━━━━" >> .claude/cmux-ai/review/gemini-reviewer.log
      echo "[Stage2][HH:MM:SS] 🏁 gemini-reviewer Stage2 DONE" >> .claude/cmux-ai/review/gemini-reviewer.log
      SendMessage(
        to="team-lead",
        message="{반론 전체 내용}",
        summary="gemini-reviewer: Stage2 DONE — rebuttal ready"
      )
  """
)

Agent(
  subagent_type="builder",
  team_name="cmux-ai-review-{project}-{timestamp}",
  name="codex-reviewer",
  run_in_background=true,
  prompt="""
    다음 대상을 {codex_role} 관점에서 리뷰하세요.
    대상: {review_target}

    작업 진행 중 아래 규칙으로 .claude/cmux-ai/review/codex-reviewer.log 에 실시간 기록:
      - 리뷰 항목 시작 시:  echo "[Stage1][HH:MM:SS] ▶ {항목 이름} 분석 시작" >> ...log
      - 파일 읽을 때:        echo "[Stage1][HH:MM:SS]   📖 reading {file}" >> ...log
      - 발견 내용:           echo "[Stage1][HH:MM:SS]   🔍 {발견 내용 한 줄}" >> ...log
      - 판단/결정 시:        echo "[Stage1][HH:MM:SS]   💡 {판단 내용}" >> ...log
      - 명령 실행 시:        echo "[Stage1][HH:MM:SS]   $ {command}" >> ...log
      - 명령 결과:           echo "[Stage1][HH:MM:SS]   → {결과 한 줄}" >> ...log
      - 이슈 발견 시:        echo "[Stage1][HH:MM:SS]   ⚠️  {이슈 내용}" >> ...log
      - 항목 완료 시:        echo "[Stage1][HH:MM:SS] ✅ {항목 이름} 분석 완료" >> ...log

    완료 후:
      - 의견 전체를 .claude/cmux-ai/review/codex-opinion.md 에 저장
      echo "[Stage1][HH:MM:SS] ━━━━━━━━━━━━━━━━━━━━━━━━━" >> .claude/cmux-ai/review/codex-reviewer.log
      echo "[Stage1][HH:MM:SS] 🏁 codex-reviewer Stage1 DONE" >> .claude/cmux-ai/review/codex-reviewer.log
      SendMessage(
        to="team-lead",
        message="{의견 전체 내용}",
        summary="codex-reviewer: Stage1 DONE — opinion ready"
      )

    Stage 2 SendMessage 수신 대기. 수신 시 {gemini_opinion}을 받아:
      - 반론 시작:           echo "[Stage2][HH:MM:SS] ▶ Rebuttal 시작 (상대 의견 검토 중)" >> ...log
      - 동의 포인트:         echo "[Stage2][HH:MM:SS]   ✓ 동의: {내용}" >> ...log
      - 반박 포인트:         echo "[Stage2][HH:MM:SS]   ✗ 반박: {내용}" >> ...log
      - 추가 발견 시:        echo "[Stage2][HH:MM:SS]   🔍 추가 발견: {내용}" >> ...log
      - 판단/결정 시:        echo "[Stage2][HH:MM:SS]   💡 {판단 내용}" >> ...log
      반론을 .claude/cmux-ai/review/codex-rebuttal.md 에 저장
      echo "[Stage2][HH:MM:SS] ━━━━━━━━━━━━━━━━━━━━━━━━━" >> .claude/cmux-ai/review/codex-reviewer.log
      echo "[Stage2][HH:MM:SS] 🏁 codex-reviewer Stage2 DONE" >> .claude/cmux-ai/review/codex-reviewer.log
      SendMessage(
        to="team-lead",
        message="{반론 전체 내용}",
        summary="codex-reviewer: Stage2 DONE — rebuttal ready"
      )
  """
)
```

```bash
cmux set-progress 0.35 --label "Stage 1: opinions in progress (see panels)..."
```

### Step 4: Stage 2 — 상호 반론 (이벤트 기반 전환)

두 `SendMessage(summary="...Stage1 DONE")` 수신 후 즉시 Stage 2 시작:

```bash
cmux set-status "review" "Stage 2: cross-rebuttal" --icon arrow.2.squarepath --color "#5856d6"
cmux set-progress 0.55 --label "Stage 2: cross-rebuttal (see panels)..."
```

각 에이전트에 상대 의견 전달 (에이전트는 위 프롬프트에서 대기 중):

```
SendMessage(
  to="gemini-reviewer",
  message="{codex_opinion 전체}",
  summary="Stage2: here is Codex opinion, write rebuttal"
)
SendMessage(
  to="codex-reviewer",
  message="{gemini_opinion 전체}",
  summary="Stage2: here is Gemini opinion, write rebuttal"
)
```

두 `SendMessage(summary="...Stage2 DONE")` 수신 대기.

### Step 5: Stage 3 — Chairman 합성 (Claude)

```bash
cmux set-status "review" "Stage 3: chairman synthesis" --icon star --color "#34c759"
cmux set-progress 0.8 --label "Stage 3: synthesis..."
```

4개 파일 읽어 Score Card 작성:

```
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

결과를 `.claude/cmux-ai/review/final-scorecard.md`에 저장.

### Step 6: 완료 + 패널 정리

```bash
cmux set-progress 1.0 --label "Done"
cmux set-status "review" "complete" --icon checkmark --color "#34c759"
cmux log --level success -- "cmux-ai-review: {grade} ({score}/100)"
cmux notify --title "Review Complete" --body "{grade}: {top finding}"
```

---

## 추가 라운드 조건

Chairman이 아래 조건 중 하나 해당 시 Step 3부터 재실행:
- 두 AI 점수 차이 ≥ 15점
- Critical 이슈가 한쪽만 언급
- 핵심 사실 관계 불일치

최대 2회까지 반복.

---

## 아키텍처 요약

```
메인 Claude (Chairman/오케스트레이터)
├── 로그 파일 생성 → cmux 패널에서 tail -f (실시간 가시화)
├── TeamCreate → 통신 채널 수립
│
├── [Stage 1] Agent(gemini-reviewer, bg) + Agent(codex-reviewer, bg) — 동시 시작
│            각자 로그 기록 → SendMessage(summary="Stage1 DONE")
│            ↓ 두 SendMessage 수신 후 즉시 Stage 2
│
├── [Stage 2] SendMessage(gemini-reviewer, {codex_opinion})
│            SendMessage(codex-reviewer, {gemini_opinion})
│            각자 반론 + 로그 기록 → SendMessage(summary="Stage2 DONE")
│            ↓ 두 SendMessage 수신 후 즉시 Stage 3
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
| Agent 무응답 (5분) | Claude가 직접 해당 역할 수행 |

---

## 출력 파일 구조

```
.claude/cmux-ai/review/
├── gemini-reviewer.log    # Gemini 실시간 로그 (패널 표시)
├── codex-reviewer.log     # Codex 실시간 로그 (패널 표시)
├── gemini-opinion.md      # Stage 1 Gemini
├── codex-opinion.md       # Stage 1 Codex
├── gemini-rebuttal.md     # Stage 2 Gemini
├── codex-rebuttal.md      # Stage 2 Codex
└── final-scorecard.md     # Stage 3 결과
```

---

## --live-mode

> 패널에서 실제 `claude -p` 프로세스가 직접 리뷰하는 모습이 보임.
> Stage 전환은 동일한 패널에 새 명령을 전송해서 이어받음.
> Stage 1 완료는 `.stage1.done` 파일 감지, Stage 2 완료는 `.stage2.done` 파일 감지.

### Live Mode 실행 순서

**Step 1: 프롬프트 파일 + 패널 생성**

```bash
mkdir -p .claude/cmux-ai/review
rm -f .claude/cmux-ai/review/*.done

# Stage 1 프롬프트 파일 작성
cat > .claude/cmux-ai/review/gemini-stage1-prompt.md << 'PROMPTEOF'
다음 대상을 {gemini_role} 관점에서 리뷰하세요.
대상: {review_target}

의견 전체를 .claude/cmux-ai/review/gemini-opinion.md 에 저장 후:
  echo "DONE" > .claude/cmux-ai/review/gemini-stage1.done
PROMPTEOF

cat > .claude/cmux-ai/review/codex-stage1-prompt.md << 'PROMPTEOF'
다음 대상을 {codex_role} 관점에서 리뷰하세요.
대상: {review_target}

의견 전체를 .claude/cmux-ai/review/codex-opinion.md 에 저장 후:
  echo "DONE" > .claude/cmux-ai/review/codex-stage1.done
PROMPTEOF

# 패널 생성
GEMINI_SURFACE=$(cmux new-split down 2>&1 | awk '{print $2}')
CODEX_SURFACE=$(cmux new-split right --surface $GEMINI_SURFACE 2>&1 | awk '{print $2}')

cmux set-status "review" "Stage 1: live opinions" --icon doc --color "#ff9500"
cmux set-progress 0.2 --label "Stage 1: live reviewers starting..."
```

**Step 2: Stage 1 — 패널에서 실제 AI CLI 직접 실행**

```bash
# Gemini 패널: 실제 gemini CLI 실행
cmux send --surface $GEMINI_SURFACE \
  "gemini -y -p \"\$(cat .claude/cmux-ai/review/gemini-stage1-prompt.md)\"
"

# Codex 패널: 실제 codex CLI 실행
cmux send --surface $CODEX_SURFACE \
  "codex exec \"\$(cat .claude/cmux-ai/review/codex-stage1-prompt.md)\"
"

# Stage 1 완료 대기 (5분 타임아웃)
TIMEOUT=300; ELAPSED=0
while true; do
  [ -f .claude/cmux-ai/review/gemini-stage1.done ] && \
  [ -f .claude/cmux-ai/review/codex-stage1.done ] && break
  sleep 5; ELAPSED=$((ELAPSED + 5))
  [ $ELAPSED -ge $TIMEOUT ] && { cmux notify --title "Stage 1 timeout" --body "직접 처리로 전환"; break; }
done

cmux set-status "review" "Stage 2: live rebuttal" --icon arrow.2.squarepath --color "#5856d6"
cmux set-progress 0.55 --label "Stage 2: cross-rebuttal..."
```

**Step 3: Stage 2 — 동일 패널에 반론 프롬프트 이어서 전송**

```bash
# 상대 의견을 포함한 Stage 2 프롬프트 작성
cat > .claude/cmux-ai/review/gemini-stage2-prompt.md << 'PROMPTEOF'
아래는 Codex의 리뷰 의견입니다. 이에 대한 반론을 작성하세요.

$(cat .claude/cmux-ai/review/codex-opinion.md)

반론 전체를 .claude/cmux-ai/review/gemini-rebuttal.md 에 저장 후:
  echo "DONE" > .claude/cmux-ai/review/gemini-stage2.done
PROMPTEOF

cat > .claude/cmux-ai/review/codex-stage2-prompt.md << 'PROMPTEOF'
아래는 Gemini의 리뷰 의견입니다. 이에 대한 반론을 작성하세요.

$(cat .claude/cmux-ai/review/gemini-opinion.md)

반론 전체를 .claude/cmux-ai/review/codex-rebuttal.md 에 저장 후:
  echo "DONE" > .claude/cmux-ai/review/codex-stage2.done
PROMPTEOF

# 동일 패널에 Stage 2 — 실제 AI CLI로 반론 실행
cmux send --surface $GEMINI_SURFACE \
  "gemini -y -p \"\$(cat .claude/cmux-ai/review/gemini-stage2-prompt.md)\"
"
cmux send --surface $CODEX_SURFACE \
  "codex exec \"\$(cat .claude/cmux-ai/review/codex-stage2-prompt.md)\"
"

# Stage 2 완료 대기 (5분 타임아웃)
TIMEOUT=300; ELAPSED=0
while true; do
  [ -f .claude/cmux-ai/review/gemini-stage2.done ] && \
  [ -f .claude/cmux-ai/review/codex-stage2.done ] && break
  sleep 5; ELAPSED=$((ELAPSED + 5))
  [ $ELAPSED -ge $TIMEOUT ] && { cmux notify --title "Stage 2 timeout" --body "직접 처리로 전환"; break; }
done
```

**Step 4: Stage 3 — Chairman 합성 (기본 모드 Step 5와 동일)**

```bash
cmux set-status "review" "Stage 3: chairman synthesis" --icon star --color "#34c759"
cmux set-progress 0.8 --label "Stage 3: synthesis..."
# 4개 파일 읽어 Score Card 작성 (기본 모드와 동일 로직)
```

### Live Mode 아키텍처

```
메인 Claude (Chairman/오케스트레이터)
├── Stage 1 프롬프트 파일 작성 → 패널에서 실제 AI CLI 직접 실행
│   ├── Gemini 패널: gemini -y -p "..."  ← 진짜 Gemini가 리뷰
│   └── Codex  패널: codex exec "..."    ← 진짜 Codex가 리뷰
│   ↓ .stage1.done 감지
├── Stage 2 프롬프트 파일 작성 → 동일 패널에 이어서 전송
│   ├── Gemini 패널: gemini -y -p "..."  ← 진짜 Gemini가 반론
│   └── Codex  패널: codex exec "..."    ← 진짜 Codex가 반론
│   ↓ .stage2.done 감지
└── Stage 3: Chairman Claude 합성 → Score Card
```

### 기본 모드 vs --live-mode 비교

| | 기본 모드 | --live-mode |
|--|--|--|
| **실제 사용 AI** | Claude 서브에이전트 (이름만 gemini/codex) | 진짜 Gemini + 진짜 Codex CLI |
| Stage 1/2 실행 | Background subagent | 패널에서 실제 CLI 프로세스 |
| Stage 전환 | SendMessage (이벤트) | 동일 패널에 새 명령 전송 |
| 시각화 | 로그 파일 tail -f | 에이전트가 직접 작업하는 모습 |
| 완료 감지 | SendMessage | .done 파일 폴링 (5분 타임아웃) |
| 개입 가능 여부 | 불가 | 패널 클릭 후 직접 조작 가능 |
