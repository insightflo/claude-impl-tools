# Mini-PRD (Progressive)

> **용도**: 빠른 기획 + `/audit` 호환
> **버전**: 2.0.0
> **작성일**: {{DATE}}

---

## 📋 Phase 1: 초기 기획 (필수)

> 프로젝트 시작 전에 반드시 답변해야 할 핵심 질문입니다.

### 1.1 프로젝트 목적 (purpose)

**Q: 무엇을 만들고 싶나요?**

간단히 설명해주세요:
```
{{PROJECT_PURPOSE}}
```

### 1.2 핵심 기능 (features)

**Q: 핵심 기능 3~5가지는 무엇인가요?**

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| {{FEATURE_1}} | {{DESC_1}} | P0 |
| {{FEATURE_2}} | {{DESC_2}} | P0 |
| {{FEATURE_3}} | {{DESC_3}} | P1 |

### 1.3 기술 스택 (tech-stack)

**Q: 선호하는 기술 스택이 있나요?**

| 분류 | 기술 | 사유 |
|------|------|------|
| 프론트엔드 | {{FRONTEND}} | {{REASON}} |
| 백엔드 | {{BACKEND}} | {{REASON}} |
| DB | {{DATABASE}} | {{REASON}} |
| 배포 | {{DEPLOY}} | {{REASON}} |

---

## 📋 Phase 2: 구체화 (Skeleton 완료 후)

> 기본 구조가 만들어진 후, 구체적인 사항을 정의합니다.

### 2.1 비즈니스 로직 상세

**Q: 각 기능의 구체적인 동작은?**

```
기능: {{FEATURE_NAME}}
  입력: {{INPUT}}
  처리: {{PROCESS}}
  출력: {{OUTPUT}}
  예외: {{EXCEPTION}}
```

### 2.2 데이터 모델 (data-model)

**Q: 주요 엔티티와 관계는?**

```yaml
# 예시
User:
  id: UUID
  email: string (unique)
  name: string
  created_at: datetime

Post:
  id: UUID
  user_id: UUID (FK → User)
  title: string
  content: text
  published_at: datetime?
```

### 2.3 API 계약 (api-contract)

**Q: 주요 API endpoint는?**

```yaml
# 예시
GET /api/users
  response: User[]

POST /api/users
  request: { email, name, password }
  response: User

GET /api/users/:id
  response: User
```

---

## 📋 Phase 3: 보완 (Muscles 진행 중)

> 구현이 진행되면서 발견된 세부 사항을 정의합니다.

### 3.1 예외 처리

**Q: 에러 상황과 처리 방안은?**

| 에러 상황 | HTTP Code | 처리 |
|-----------|-----------|------|
| 중복 이메일 | 409 | "이미 가입된 이메일입니다" |
| 인증 실패 | 401 | "이메일 또는 비밀번호가 올바르지 않습니다" |
| {{ERROR}} | {{CODE}} | {{HANDLING}} |

### 3.2 에지 케이스

**Q: 예외적인 상황은?**

```
상황: {{EDGE_CASE}}
  현재 처리: {{CURRENT_HANDLING}}
  개선 필요: {{IMPROVEMENT}}
```

### 3.3 성능 요구사항

**Q: 성능 목표는?**

| 항목 | 목표 | 측정 방법 |
|------|------|----------|
| API 응답 시간 | < 200ms (p95) | Datadog APM |
| 페이지 로드 | < 2s (p95) | Lighthouse |
| 동시 사용자 | {{NUMBER}} | 부하 테스트 |

---

## 📋 Audit 호환성 매핑

> 이 Mini-PRD는 `/audit`의 기획 정합성 검사를 통과하기 위해
> Socrates 7개 문서의 핵심을 포함합니다.

| Socrates 문서 | Mini-PRD 매핑 | 상태 |
|---------------|---------------|------|
| prd.md | purpose, features | ✅ Phase 1 |
| trd.md | tech-stack | ✅ Phase 1 |
| database-design.md | data-model | ✅ Phase 2 |
| api-contracts.md | api-contract | ✅ Phase 2 |
| screen-spec.md | (화면별) | 🔄 화면 설계 시 |
| ui-guide.md | (디자인) | 🔄 디자인 시 |
| test-strategy.md | (테스트) | 🔄 QA Phase |

---

## ✅ 완료 체크리스트

### Phase 1 (초기)
- [ ] 프로젝트 목적 기술
- [ ] 핵심 기능 3~5개 정의
- [ ] 기술 스택 선정

### Phase 2 (구체화)
- [ ] 비즈니스 로직 상세
- [ ] 데이터 모델 정의
- [ ] API 계약 작성

### Phase 3 (보완)
- [ ] 예외 처리 정의
- [ ] 에지 케이스 식별
- [ ] 성능 요구사항 설정

---

**작성자**: {{AUTHOR}}
**검토자**: {{REVIEWER}}
**승인자**: {{APPROVER}}
