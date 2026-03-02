# Multi-AI Review Examples

## 기본 사용법

### 코드 리뷰

```bash
# CLI 직접 실행
./skills/multi-ai-review/scripts/council.sh "이 코드의 보안 취약점을 검토해줘"

# Claude Code에서 요청
"이 파일 리뷰해줘, council 소집해줘"
```

### 아키텍처 리뷰

```bash
./skills/multi-ai-review/scripts/council.sh "이 마이크로서비스 아키텍처가 확장 가능한지 검토해줘"
```

### 기획서 리뷰

```bash
./skills/multi-ai-review/scripts/council.sh "이 PRD의 완전성과 실현 가능성을 검토해줘"
```

## Job Mode 예시

### 1. 잡 시작

```bash
JOB_DIR=$(./skills/multi-ai-review/scripts/council.sh start "리뷰 요청 내용")
echo "Job started: $JOB_DIR"
```

### 2. 진행 상황 모니터링

```bash
# JSON 형식
./skills/multi-ai-review/scripts/council.sh status "$JOB_DIR"

# 텍스트 형식
./skills/multi-ai-review/scripts/council.sh status --text "$JOB_DIR"

# 상세 출력
./skills/multi-ai-review/scripts/council.sh status --text --verbose "$JOB_DIR"
```

### 3. 결과 확인

```bash
# 텍스트 형식
./skills/multi-ai-review/scripts/council.sh results "$JOB_DIR"

# JSON 형식
./skills/multi-ai-review/scripts/council.sh results --json "$JOB_DIR"
```

### 4. 정리

```bash
./skills/multi-ai-review/scripts/council.sh clean "$JOB_DIR"
```

## Claude Code 통합 예시

### 키워드 트리거

```
User: "이 코드 리뷰해줘"
User: "council 소집해줘"
User: "여러 AI 의견 물어봐"
User: "Gemini랑 Codex 의견 들어보자"
```

### 리뷰 결과 예시

```markdown
## 💎 Gemini (Creative Reviewer)

### 긍정적 평가
- 코드 구조가 명확함
- 에러 처리가 잘 되어 있음

### 개선 제안
1. **[High]** 성능 최적화 필요
2. **[Medium]** 접근성 개선 권장

### 대안 아이디어
- 캐싱 레이어 추가 고려

---

## 🤖 Codex (Technical Reviewer)

### 아키텍처 평가
- SOLID 원칙 준수 양호
- 의존성 주입 패턴 적절

### 개선 제안
1. **[Critical]** SQL 인젝션 취약점
2. **[High]** 테스트 커버리지 부족

---

## 🧠 Claude (Chairman Synthesis)

### 최종 판정
- **상태**: Conditional Approval
- **합의율**: 75%

### 우선 개선사항
1. SQL 인젝션 수정 (Critical)
2. 성능 최적화 (High)
3. 테스트 커버리지 향상 (High)
```

## 설정 예시

### 최소 설정

```yaml
council:
  members:
    - name: gemini
      command: "gemini"
      emoji: "💎"
      color: "GREEN"
  chairman:
    role: "auto"
  settings:
    timeout: 60
```

### 전체 설정

```yaml
council:
  members:
    - name: gemini
      command: "gemini"
      emoji: "💎"
      color: "GREEN"

    - name: codex
      command: "codex exec"
      emoji: "🤖"
      color: "BLUE"

  chairman:
    role: "auto"
    description: "모든 의견을 종합하여 최종 추천 제시"

  settings:
    timeout: 120
    exclude_chairman_from_members: true
```

## 에러 처리 예시

### CLI 미설치

```bash
# Gemini CLI가 없는 경우
$ ./scripts/council.sh "리뷰 요청"
Error: gemini CLI not found
Install from: https://github.com/google-gemini/gemini-cli
```

### 타임아웃

```bash
# 120초 타임아웃 초과 시
$ ./scripts/council.sh status "$JOB_DIR"
{
  "members": [
    { "member": "gemini", "state": "timed_out", "message": "Timed out after 120s" }
  ]
}
```
