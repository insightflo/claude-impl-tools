## --live-mode — cmux 직접 제어 리뷰

Claude가 cmux 패널에서 gemini/codex CLI를 직접 실행하고,
결과 파일을 Read로 확인하며, Stage 전환도 cmux send로 직접 제어하는 대화형 리뷰.

기본 모드가 Background Agent(코디네이터)를 통해 CLI를 간접 호출하는 반면,
live-mode는 Claude Chairman이 cmux 명령어로 패널을 직접 제어한다.

### 실행 순서

**Step 1: 패널 생성**

```bash
mkdir -p .claude/cmux-ai/review

GEMINI_SURFACE=$(cmux new-split down 2>&1 | awk '{print $2}')
CODEX_SURFACE=$(cmux new-split right --surface $GEMINI_SURFACE 2>&1 | awk '{print $2}')

cmux set-status "review" "Stage 1: live" --icon doc --color "#ff9500"
```

**Step 2: Stage 1 — 프롬프트 작성 → 패널에 전송**

```bash
# 프롬프트 파일 작성
Write("{gemini_role} 관점에서 리뷰: {review_target}
      결과를 마크다운으로 출력하세요.") > .claude/cmux-ai/review/gemini-stage1-prompt.md

Write("{codex_role} 관점에서 리뷰: {review_target}
      결과를 마크다운으로 출력하세요.") > .claude/cmux-ai/review/codex-stage1-prompt.md

# 패널에서 CLI 실행 — 결과를 opinion 파일로 리다이렉트
cmux send --surface $GEMINI_SURFACE \
  "gemini -y -p \"\$(cat .claude/cmux-ai/review/gemini-stage1-prompt.md)\" > .claude/cmux-ai/review/gemini-opinion.md 2>&1; echo __EXIT_\$?__ >> .claude/cmux-ai/review/gemini-opinion.md
"
cmux send --surface $CODEX_SURFACE \
  "codex exec \"\$(cat .claude/cmux-ai/review/codex-stage1-prompt.md)\" > .claude/cmux-ai/review/codex-opinion.md 2>&1; echo __EXIT_\$?__ >> .claude/cmux-ai/review/codex-opinion.md
"
```

**Step 3: Claude가 Stage 1 결과를 직접 확인**

```
# __EXIT__ 마커가 나타날 때까지 대기 후 Read
Read(".claude/cmux-ai/review/gemini-opinion.md")
Read(".claude/cmux-ai/review/codex-opinion.md")
```

- `__EXIT_0__` → 의견 수집 성공
- 에러 → 동일 패널에 `cmux send`로 재시도 또는 대체 CLI

**Step 4: Stage 2 — 동일 패널에 반론 명령 전송**

Claude가 양쪽 의견을 읽은 뒤, 상대 의견을 포함한 반론 프롬프트를 작성해서
동일 패널에 바로 전송한다:

```bash
cmux set-status "review" "Stage 2: rebuttal" --icon arrow.2.squarepath --color "#5856d6"

# 상대 의견을 포함한 반론 프롬프트 작성
Write("아래는 Codex 리뷰 의견입니다. 반론을 작성하세요.
      {codex_opinion 전체}") > .claude/cmux-ai/review/gemini-stage2-prompt.md

Write("아래는 Gemini 리뷰 의견입니다. 반론을 작성하세요.
      {gemini_opinion 전체}") > .claude/cmux-ai/review/codex-stage2-prompt.md

# 동일 패널에 Stage 2 전송
cmux send --surface $GEMINI_SURFACE \
  "gemini -y -p \"\$(cat .claude/cmux-ai/review/gemini-stage2-prompt.md)\" > .claude/cmux-ai/review/gemini-rebuttal.md 2>&1; echo __EXIT_\$?__ >> .claude/cmux-ai/review/gemini-rebuttal.md
"
cmux send --surface $CODEX_SURFACE \
  "codex exec \"\$(cat .claude/cmux-ai/review/codex-stage2-prompt.md)\" > .claude/cmux-ai/review/codex-rebuttal.md 2>&1; echo __EXIT_\$?__ >> .claude/cmux-ai/review/codex-rebuttal.md
"
```

**Step 5: Claude가 Stage 2 결과를 직접 확인**

```
Read(".claude/cmux-ai/review/gemini-rebuttal.md")
Read(".claude/cmux-ai/review/codex-rebuttal.md")
```

**Step 6: Stage 3 — Chairman 합성 (기본 모드와 동일)**

4개 파일(opinion × 2 + rebuttal × 2)을 읽어 Score Card 작성.

```bash
cmux set-status "review" "Stage 3: synthesis" --icon star --color "#34c759"
# ... Score Card 작성 ...
cmux set-progress 1.0 --label "Done"
cmux clear-status "review"
```

### 아키텍처

```
메인 Claude (Chairman — 직접 제어)
│
├── [Stage 1] cmux send → gemini/codex CLI 패널 전송 (opinion → 파일)
│   ├── Read(gemini-opinion.md) → 결과/에러 확인
│   └── Read(codex-opinion.md) → 결과/에러 확인
│   ↓ Claude가 직접 확인 후 즉시 Stage 2
│
├── [Stage 2] cmux send → 동일 패널에 반론 전송 (rebuttal → 파일)
│   ├── Read(gemini-rebuttal.md)
│   └── Read(codex-rebuttal.md)
│   ↓ Claude가 직접 확인 후 즉시 Stage 3
│
└── [Stage 3] Chairman 합성 → Score Card
```

### 기본 모드 vs --live-mode 비교

| | 기본 모드 | --live-mode |
|--|--|--|
| 오케스트레이터 | Background Agent (코디네이터) | Claude Chairman이 직접 |
| Stage 전환 | SendMessage (이벤트) | Claude가 Read 확인 후 cmux send |
| 완료 감지 | SendMessage | Read(result) + __EXIT__ 마커 |
| 에러 대응 | Agent 내 Fallback | Claude가 읽고 즉시 대체 CLI 전송 |
| 시각화 | tail -f 로그 | 패널에서 CLI가 직접 리뷰 |
| 후속 명령 | SendMessage로 간접 | cmux send로 자유롭게 추가 |
