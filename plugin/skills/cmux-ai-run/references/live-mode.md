## --live-mode — cmux 직접 제어 실행

Claude가 cmux 패널에서 codex/gemini CLI를 직접 실행하고,
결과 파일을 Read로 확인하며, 필요 시 추가 명령을 전송하는 대화형 오케스트레이션.

기본 모드가 Background Agent(코디네이터)를 통해 CLI를 간접 호출하는 반면,
live-mode는 Claude 자신이 cmux 명령어로 패널을 직접 제어한다.
패널에서 에이전트가 작업하는 모습이 사용자에게 실시간으로 보인다.

### 언제 사용?

- 에이전트가 작업하는 과정을 눈으로 확인하고 싶을 때
- Claude가 결과를 보고 즉시 후속 명령을 보내야 할 때
- 에러 발생 시 Claude가 직접 대응해야 할 때

### 실행 순서

**Step 1: 패널 생성**

```bash
mkdir -p .claude/cmux-ai/runs

CODEX_SURFACE=$(cmux new-split right 2>&1 | awk '{print $2}')
GEMINI_SURFACE=$(cmux new-split down --surface $CODEX_SURFACE 2>&1 | awk '{print $2}')

cmux set-status "codex" "live" --icon gear --color "#007aff"
cmux set-status "gemini" "live" --icon brush --color "#5856d6"
```

**Step 2: 프롬프트 작성 → 패널에 명령 전송 (결과를 파일로 리다이렉트)**

```bash
# 프롬프트 파일 작성
Write("{codex_tasks}") > .claude/cmux-ai/runs/codex-prompt.md
Write("{gemini_tasks}") > .claude/cmux-ai/runs/gemini-prompt.md

# 패널에서 CLI 실행 — 결과를 파일로 리다이렉트
cmux send --surface $CODEX_SURFACE \
  "codex exec \"\$(cat .claude/cmux-ai/runs/codex-prompt.md)\" > .claude/cmux-ai/runs/codex-result.txt 2>&1; echo __EXIT_\$?__ >> .claude/cmux-ai/runs/codex-result.txt
"
cmux send --surface $GEMINI_SURFACE \
  "gemini -y -p \"\$(cat .claude/cmux-ai/runs/gemini-prompt.md)\" > .claude/cmux-ai/runs/gemini-result.txt 2>&1; echo __EXIT_\$?__ >> .claude/cmux-ai/runs/gemini-result.txt
"
```

핵심: 결과를 파일로 보내면서 `__EXIT_$?__` 마커를 끝에 추가.
이 마커가 있으면 프로세스가 끝난 것이므로 Claude가 바로 확인 가능.

**Step 3: Claude가 결과를 직접 확인**

```
# 결과 파일이 __EXIT_ 마커를 포함할 때까지 대기 후 Read
Read(".claude/cmux-ai/runs/codex-result.txt")
Read(".claude/cmux-ai/runs/gemini-result.txt")
```

- `__EXIT_0__` → 정상 완료, 결과 채택
- `__EXIT_1__` 또는 에러 내용 → Fallback 또는 재시도
- 파일이 비어있거나 마커 없음 → 아직 실행 중, 잠시 후 재확인

**Step 4: 에러 대응 (직접 제어의 핵심)**

에러가 발생하면 Claude가 동일 패널에 후속 명령을 보낼 수 있다:

```bash
# 예: gemini 429 에러 → codex로 대체
cmux send --surface $GEMINI_SURFACE \
  "codex exec \"\$(cat .claude/cmux-ai/runs/gemini-prompt.md)\" > .claude/cmux-ai/runs/gemini-result.txt 2>&1; echo __EXIT_\$?__ >> .claude/cmux-ai/runs/gemini-result.txt
"
```

이것이 .done 폴링과의 결정적 차이 — Claude가 에러를 읽고 즉시 대응한다.

**Step 5: 결과 통합 (기본 모드 Step 5와 동일)**

```bash
cmux set-progress 1.0 --label "Done"
cmux clear-status "codex"
cmux clear-status "gemini"
```

### 아키텍처

```
메인 Claude (오케스트레이터 — 직접 제어)
├── cmux new-split → 패널 생성
├── cmux send → codex exec / gemini -y -p 전송 (결과 → 파일)
├── Read(result.txt) → 완료/에러 확인
├── 에러 시 → cmux send로 재시도 또는 대체 CLI 전송
└── 정상 시 → 결과 통합
```

### 기본 모드 vs --live-mode 비교

| | 기본 모드 | --live-mode |
|--|--|--|
| 오케스트레이터 | Background Agent (코디네이터) | Claude 자신이 직접 |
| CLI 실행 | Agent 내부에서 Bash 호출 | cmux send로 패널에 전송 |
| 완료 감지 | SendMessage (이벤트) | Read(result.txt) + __EXIT__ 마커 |
| 에러 대응 | Agent 내 Fallback | Claude가 읽고 즉시 cmux send |
| 시각화 | tail -f 로그 | 패널에서 CLI가 직접 작업 |
| 후속 명령 | 불가 (Agent 종료 후) | cmux send로 자유롭게 추가 |
