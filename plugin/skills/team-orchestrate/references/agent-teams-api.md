# Agent Teams API Reference

Claude Code의 네이티브 Agent Teams API 상세 참조.

---

## TeamCreate

팀과 공유 작업 리스트를 생성합니다.

```javascript
TeamCreate(
  team_name: string,      // 팀 식별자 (필수)
  description: string,    // 팀 목적 설명 (필수)
  agent_type?: string     // 팀 리드 에이전트 타입 (선택, 기본값: general-purpose)
)
```

**반환값**:
- `team_file_path`: 팀 설정 파일 경로
- `team_name`: 생성된 팀 이름

---

## Agent (team_name 필수)

```javascript
Agent(
  subagent_type: string,   // 에이전트 타입
  team_name: string,       // 팀 이름 (필수 - 없으면 통신 불가)
  name: string,            // 팀메이트 식별자 (필수)
  prompt: string,          // 에이전트 프롬프트
  run_in_background?: boolean
)
```

---

## TaskCreate / TaskUpdate / TaskList

```javascript
// 작업 생성
TaskCreate(subject, description)

// 상태/소유자/의존성 업데이트
TaskUpdate(taskId, status, owner, addBlockedBy)

// 작업 목록 조회
TaskList()
```

---

## SendMessage

```javascript
SendMessage(
  to: string,              // 수신자 이름 (또는 "*" for broadcast)
  message: string | object,
  summary?: string
)
```

**프로토콜 타입**:
- `shutdown_request`: 종료 요청
- `shutdown_response`: 종료 응답
- `plan_approval_request`: 계획 승인 요청
- `plan_approval_response`: 계획 승인 응답
