## --live-mode — cmux 직접 제어 리뷰

Claude Chairman이 cmux 패널에서 codex/gemini CLI를 인터랙티브 세션으로 띄우고,
프롬프트를 주입한 뒤, `cmux wait-for` 시그널로 Stage 전환을 제어하는 방식.

인터랙티브 세션이므로 Stage 1→2 전환 시 이전 분석 컨텍스트가 유지되어
더 깊은 반론이 가능하다.

### CLI별 실행 옵션

| CLI | 실행 명령 | 안정성 |
|-----|----------|--------|
| **Codex** | `codex --dangerously-bypass-approvals-and-sandbox` | 가장 안정적 |
| **Gemini** | `gemini -y -m gemini-3-flash-preview` | API 400/429 빈번, 불안정 |

### 프롬프트 전송: paste-buffer

`cmux send`는 줄바꿈을 Enter(제출)로 해석해서 멀티라인 프롬프트가 잘린다.
반드시 `set-buffer` + `paste-buffer`를 사용:

```bash
cmux set-buffer --name prompt "$(cat prompt.md)"
cmux paste-buffer --name prompt --surface $SURFACE
sleep 1
cmux send-key --surface $SURFACE Return
```

### 콜백: 스크립트 파일 방식

콜백을 인라인으로 넣으면 Gemini가 "해석"해버린다. 스크립트 파일로 분리:

```bash
cat > .claude/cmux-ai/review/callback-gemini-s1.sh << 'EOF'
cmux wait-for -S review-gemini-s1 && cmux notify --title "Gemini" --body "Stage 1 완료"
EOF
chmod +x .claude/cmux-ai/review/callback-gemini-s1.sh
```

프롬프트 끝에 한 줄: `완료 후 반드시 bash .claude/cmux-ai/review/callback-gemini-s1.sh 실행해.`

### 실행 순서

**Step 1: 패널 생성 + CLI 실행 + Ready 확인**

```bash
mkdir -p .claude/cmux-ai/review

GMN=$(cmux new-split down 2>&1 | awk '{print $2}')
CDX=$(cmux new-split right --surface $GMN 2>&1 | awk '{print $2}')

cmux send --surface $GMN "gemini -y -m gemini-3-flash-preview
"
cmux send --surface $CDX "codex --dangerously-bypass-approvals-and-sandbox
"

sleep 5
cmux capture-pane --surface $GMN --lines 3  # "Type your message" 확인
cmux capture-pane --surface $CDX --lines 3  # "gpt-5.4 high fast" 확인
```

**Step 2: Stage 1 — 콜백 스크립트 + 프롬프트 작성 + 전송**

```bash
# 콜백 스크립트 생성
cat > .claude/cmux-ai/review/callback-gemini-s1.sh << 'EOF'
cmux wait-for -S review-gemini-s1 && cmux notify --title "Gemini" --body "Stage 1 완료"
EOF
cat > .claude/cmux-ai/review/callback-codex-s1.sh << 'EOF'
cmux wait-for -S review-codex-s1 && cmux notify --title "Codex" --body "Stage 1 완료"
EOF
chmod +x .claude/cmux-ai/review/callback-*.sh

# 프롬프트 파일 (콜백은 스크립트 실행 한 줄)
Write: .claude/cmux-ai/review/gemini-s1-prompt.md
  {gemini_role} 관점에서 다음을 리뷰하세요: {review_target}
  의견을 .claude/cmux-ai/review/gemini-opinion.md 에 저장하세요.
  완료 후 반드시 bash .claude/cmux-ai/review/callback-gemini-s1.sh 실행해.

# paste-buffer로 전송 (줄바꿈 안전)
cmux set-buffer --name gmn-s1 "$(cat .claude/cmux-ai/review/gemini-s1-prompt.md)"
cmux paste-buffer --name gmn-s1 --surface $GMN
sleep 1
cmux send-key --surface $GMN Return

cmux set-buffer --name cdx-s1 "$(cat .claude/cmux-ai/review/codex-s1-prompt.md)"
cmux paste-buffer --name cdx-s1 --surface $CDX
sleep 1
cmux send-key --surface $CDX Return
```

**Step 3: Stage 1 완료 대기**

```bash
cmux wait-for review-gemini-s1 --timeout 600 &
cmux wait-for review-codex-s1 --timeout 600 &
```

**Step 4: Stage 2 — 같은 세션에서 반론 (컨텍스트 유지)**

시그널 수신 후, 양쪽 의견 파일을 읽어 상대 의견을 포함한 반론 프롬프트 작성:

```bash
# Stage 2 콜백 스크립트
cat > .claude/cmux-ai/review/callback-gemini-s2.sh << 'EOF'
cmux wait-for -S review-gemini-s2 && cmux notify --title "Gemini" --body "Stage 2 완료"
EOF
chmod +x .claude/cmux-ai/review/callback-gemini-s2.sh

# 반론 프롬프트 (상대 의견 포함)
Write: .claude/cmux-ai/review/gemini-s2-prompt.md
  상대(Codex)의 리뷰 의견: {codex_opinion}
  이에 대한 반론을 작성하고 .claude/cmux-ai/review/gemini-rebuttal.md 에 저장하세요.
  완료 후 반드시 bash .claude/cmux-ai/review/callback-gemini-s2.sh 실행해.

# paste-buffer로 같은 패널에 전송
cmux set-buffer --name gmn-s2 "$(cat .claude/cmux-ai/review/gemini-s2-prompt.md)"
cmux paste-buffer --name gmn-s2 --surface $GMN
sleep 1
cmux send-key --surface $GMN Return
```

```bash
cmux wait-for review-gemini-s2 --timeout 600 &
cmux wait-for review-codex-s2 --timeout 600 &
```

**Step 5: Stage 3 — Chairman 합성 (기본 모드와 동일)**

```bash
# Read: gemini-opinion.md, codex-opinion.md, gemini-rebuttal.md, codex-rebuttal.md
# → Score Card 작성 → final-scorecard.md
```

### 시그널 네이밍

| Stage | Gemini 시그널 | Codex 시그널 |
|-------|-------------|-------------|
| Stage 1 | `review-gemini-s1` | `review-codex-s1` |
| Stage 2 | `review-gemini-s2` | `review-codex-s2` |

### 에러 대응

```bash
# 타임아웃 시 수동 확인
cmux capture-pane --surface $GMN --lines 10

# Gemini 불안정 → Ctrl+C → Codex로 대체
cmux send-key --surface $GMN ctrl+c
sleep 2
cmux send --surface $GMN "codex --dangerously-bypass-approvals-and-sandbox
"

# 패널 죽었는지 확인
cmux capture-pane --surface $GMN --lines 1 2>&1
# "Error: invalid_params" → 패널 닫힘
```

### 아키텍처

```
Claude (Chairman — 직접 제어)
│
├── [Stage 1] paste-buffer → 리뷰 프롬프트 주입
│   ├── Gemini: 리뷰 → opinion.md → bash callback-s1.sh
│   └── Codex:  리뷰 → opinion.md → bash callback-s1.sh
│   ↓ cmux wait-for 시그널 수신
│
├── [Stage 2] paste-buffer → 같은 세션에 반론 주입 (컨텍스트 유지)
│   ├── Gemini: 반론 → rebuttal.md → bash callback-s2.sh
│   └── Codex:  반론 → rebuttal.md → bash callback-s2.sh
│   ↓ cmux wait-for 시그널 수신
│
└── [Stage 3] Chairman 합성 → Score Card
```
