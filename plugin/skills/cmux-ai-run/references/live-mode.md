## --live-mode — cmux 직접 제어 실행

Claude가 cmux 패널에서 codex/gemini CLI를 직접 실행하고,
결과를 확인하며, 필요 시 추가 명령을 전송하는 대화형 오케스트레이션.

기본 모드가 Background Agent(코디네이터)를 통해 CLI를 간접 호출하는 반면,
live-mode는 Claude 자신이 cmux 명령어로 패널을 직접 제어한다.
패널에서 에이전트가 작업하는 모습이 사용자에게 실시간으로 보인다.

### 두 가지 실행 방식

Claude가 태스크 특성을 보고 판단해서 선택한다:

| | 원샷 모드 | 인터랙티브 모드 |
|--|--|--|
| 실행 | `codex exec "prompt"` / `gemini -y -p "prompt"` | `codex` / `gemini -y` 먼저 띄우고 프롬프트 입력 |
| 적합한 경우 | 독립적 단일 태스크, 결과만 필요 | 여러 후속 질문, 이전 컨텍스트 필요, 탐색적 작업 |
| 결과 확인 | 파일 리다이렉트 + Read + __EXIT__ 마커 | 패널에서 직접 확인 (사용자가 볼 수 있음) |
| 후속 작업 | 새 원샷 명령 전송 | cmux send로 같은 세션에 추가 질문 |
| 종료 | 자동 | `/exit` 또는 Ctrl+C |
| 대화 컨텍스트 | 유지 안 됨 | 유지됨 (이전 답변 기억) |

**판단 기준:**

- **원샷 선택**: 명확한 단일 태스크 (코드 생성, 파일 변환, 테스트 작성 등)
- **인터랙티브 선택**: 탐색적 리뷰, 연속 질문이 예상되는 작업, 반복 수정이 필요한 UI 작업

### 원샷 실행 순서

**Step 1: 패널 생성 + 프롬프트 작성**

```bash
mkdir -p .claude/cmux-ai/runs

CODEX_SURFACE=$(cmux new-split right 2>&1 | awk '{print $2}')
GEMINI_SURFACE=$(cmux new-split down --surface $CODEX_SURFACE 2>&1 | awk '{print $2}')

Write("{codex_tasks}") > .claude/cmux-ai/runs/codex-prompt.md
Write("{gemini_tasks}") > .claude/cmux-ai/runs/gemini-prompt.md
```

**Step 2: 패널에 명령 전송 (결과를 파일로 리다이렉트)**

```bash
cmux send --surface $CODEX_SURFACE \
  "codex exec \"\$(cat .claude/cmux-ai/runs/codex-prompt.md)\" > .claude/cmux-ai/runs/codex-result.txt 2>&1; echo __EXIT_\$?__ >> .claude/cmux-ai/runs/codex-result.txt
"
cmux send --surface $GEMINI_SURFACE \
  "gemini -y -p \"\$(cat .claude/cmux-ai/runs/gemini-prompt.md)\" > .claude/cmux-ai/runs/gemini-result.txt 2>&1; echo __EXIT_\$?__ >> .claude/cmux-ai/runs/gemini-result.txt
"
```

**Step 3: 결과 확인**

```
Read(".claude/cmux-ai/runs/codex-result.txt")   # __EXIT_0__ 확인
Read(".claude/cmux-ai/runs/gemini-result.txt")   # __EXIT_0__ 확인
```

- `__EXIT_0__` → 정상 완료
- 에러 → Ctrl+C 후 동일 패널에 대체 CLI 전송

### 인터랙티브 실행 순서

**Step 1: 패널 생성 + CLI 인터랙티브 모드 실행**

```bash
CODEX_SURFACE=$(cmux new-split right 2>&1 | awk '{print $2}')
GEMINI_SURFACE=$(cmux new-split down --surface $CODEX_SURFACE 2>&1 | awk '{print $2}')

# CLI를 먼저 띄움 (프롬프트 없이)
cmux send --surface $CODEX_SURFACE "codex
"
cmux send --surface $GEMINI_SURFACE "gemini -y
"
```

**Step 2: 프롬프트 입력**

```bash
# CLI 초기화 대기 후 프롬프트 전송
cmux send --surface $CODEX_SURFACE "{codex_task_prompt}
"
cmux send --surface $GEMINI_SURFACE "{gemini_task_prompt}
"
```

**Step 3: 후속 질문 (필요 시)**

```bash
# 이전 컨텍스트가 유지된 상태에서 추가 질문
cmux send --surface $CODEX_SURFACE "{follow_up_question}
"
```

**Step 4: 종료**

```bash
cmux send --surface $CODEX_SURFACE "/exit
"
cmux send --surface $GEMINI_SURFACE "/exit
"
```

### 에러 대응 (두 방식 공통)

Claude가 에러를 감지하면 동일 패널에서 즉시 대응한다:

```bash
# 1. 실행 중인 프로세스 중단
cmux send-key --surface $SURFACE ctrl+c

# 2. 대체 CLI로 전환 (예: gemini 429 → codex로 대체)
cmux send --surface $SURFACE "codex exec \"\$(cat prompt.md)\" > result.txt 2>&1; echo __EXIT_\$?__ >> result.txt
"
```

### 아키텍처

```
메인 Claude (오케스트레이터 — 직접 제어)
├── cmux new-split → 패널 생성
│
├── [판단] 태스크 특성에 따라 원샷/인터랙티브 선택
│
├── 원샷: cmux send → CLI 원샷 실행 (결과 → 파일)
│   └── Read(result.txt) + __EXIT__ 마커 확인
│
├── 인터랙티브: cmux send → CLI 띄움 → 프롬프트 입력 → 후속 질문
│   └── 패널에서 직접 확인 (대화 컨텍스트 유지)
│
├── 에러 시 → Ctrl+C → 대체 CLI 전송
└── 정상 시 → 결과 통합
```
