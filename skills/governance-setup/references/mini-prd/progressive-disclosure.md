# Progressive Disclosure Question Sets

> 점진적 기획: 필요한 시점에 필요한 질문만

---

## Phase 1 Questions (초기)

> 프로젝트 시작 시 반드시 답변해야 할 핵심 질문

```json
{
  "phase": "initial",
  "questions": [
    {
      "id": "purpose",
      "question": "무엇을 만들고 싶나요?",
      "header": "프로젝트 목적",
      "type": "text",
      "required": true,
      "placeholder": "예: 사용자가 자신의 포트폴리오를 만들고 공유할 수 있는 웹 서비스"
    },
    {
      "id": "features",
      "question": "핵심 기능 3~5가지는 무엇인가요?",
      "header": "핵심 기능",
      "type": "multi-select",
      "required": true,
      "options": [
        { "label": "사용자 인증", "description": "로그인/회원가입/프로필" },
        { "label": "콘텐츠 CRUD", "description": "생성/조회/수정/삭제" },
        { "label": "검색/필터", "description": "검색 및 필터링" },
        { "label": "소셜 기능", "description": "댓글/좋아요/팔로우" },
        { "label": "알림", "description": "이메일/푸시 알림" },
        { "label": "결제", "description": "결제 및 결제 관리" },
        { "label": "대시보드", "description": "데이터 시각화 및 분석" },
        { "label": "직접 입력", "description": "기능 목록을 직접 작성" }
      ]
    },
    {
      "id": "tech-stack",
      "question": "선호하는 기술 스택이 있나요?",
      "header": "기술 스택",
      "type": "single-select",
      "required": false,
      "options": [
        { "label": "React + Node.js", "description": "전통적인 풀스택" },
        { "label": "Next.js", "description": "React 기반 풀스택 프레임워크" },
        { "label": "Vue + FastAPI", "description": "Python 백엔드" },
        { "label": "SvelteKit", "description": "신세대 풀스택" },
        { "label": "모름", "description": "AI가 추천해주세요" }
      ]
    }
  ]
}
```

---

## Phase 2 Questions (Skeleton 완료 후)

> 기본 구조가 만들어진 후, 구체적인 사항을 정의

```json
{
  "phase": "skeleton-complete",
  "trigger": "T0.* completed",
  "questions": [
    {
      "id": "business-logic",
      "question": "각 기능의 구체적인 동작을 설명해주세요",
      "header": "비즈니스 로직",
      "type": "table",
      "required": true,
      "columns": ["기능", "입력", "처리", "출력", "예외"],
      "examples": [
        ["로그인", "이메일, 비밀번호", "검증 → JWT 발급", "액세스 토큰", "인증 실패"],
        ["게시글 작성", "제목, 내용", "저장 → 검증", "게시글 ID", "유효성 검사 실패"]
      ]
    },
    {
      "id": "data-model",
      "question": "주요 엔티티와 관계는?",
      "header": "데이터 모델",
      "type": "entity-diagram",
      "required": true,
      "entities": [
        { "name": "User", "fields": ["id", "email", "name", "created_at"] },
        { "name": "Post", "fields": ["id", "user_id", "title", "content"] }
      ]
    },
    {
      "id": "api-contract",
      "question": "주요 API endpoint는?",
      "header": "API 계약",
      "type": "api-list",
      "required": true,
      "endpoints": [
        { "method": "GET", "path": "/api/users", "response": "User[]" },
        { "method": "POST", "path": "/api/users", "request": "{email, name, password}", "response": "User" }
      ]
    }
  ]
}
```

---

## Phase 3 Questions (Muscles 진행 중)

> 구현이 진행되면서 발견된 세부 사항을 정의

```json
{
  "phase": "muscles-in-progress",
  "trigger": "T1.* in_progress",
  "questions": [
    {
      "id": "error-handling",
      "question": "에러 상황과 처리 방안은?",
      "header": "예외 처리",
      "type": "table",
      "required": true,
      "columns": ["에러 상황", "HTTP Code", "사용자 메시지"],
      "examples": [
        ["중복 이메일", "409", "이미 가입된 이메일입니다"],
        ["인증 실패", "401", "이메일 또는 비밀번호가 올바르지 않습니다"],
        ["리소스 없음", "404", "요청한 리소스를 찾을 수 없습니다"]
      ]
    },
    {
      "id": "edge-cases",
      "question": "예외적인 상황은?",
      "header": "에지 케이스",
      "type": "list",
      "required": false,
      "examples": [
        "네트워크 중단 시 재시도 정책",
        "대용량 파일 업로드 처리",
        "동시 요청 처리"
      ]
    },
    {
      "id": "performance",
      "question": "성능 목표는?",
      "header": "성능 요구사항",
      "type": "table",
      "required": false,
      "columns": ["항목", "목표", "측정 방법"],
      "examples": [
        ["API 응답 시간", "< 200ms (p95)", "Datadog APM"],
        ["페이지 로드", "< 2s (p95)", "Lighthouse"],
        ["동시 사용자", "1000명", "부하 테스트"]
      ]
    }
  ]
}
```

---

## 실행 흐름

```
시작
  ↓
┌─────────────────────────────────────────┐
│ Phase 1 Questions (필수)                │
│   • purpose, features, tech-stack       │
└─────────────────────────────────────────┘
  ↓
[거버넌스 셋업 / 구현 시작]
  ↓
┌─────────────────────────────────────────┐
│ T0 완료 시점                            │
│   • business-logic, data-model, api     │
└─────────────────────────────────────────┘
  ↓
[T1 진행 중]
  ↓
┌─────────────────────────────────────────┐
│ Phase 3 Questions (선택)                │
│   • error-handling, edge-cases, perf    │
└─────────────────────────────────────────┘
  ↓
완료
```

---

**Last Updated**: 2026-03-03
