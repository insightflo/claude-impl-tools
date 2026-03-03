# Mini-PRD to Audit Mapping

> Mini-PRD로 `/audit` 검사를 통과하기 위한 매핑 가이드

---

## 개요

**문제**: `/audit`가 Socrates 7개 문서를 요구
**해결**: Mini-PRD가 Socrates 문서의 핵심을 포함

---

## 매핑 테이블

| Socrates 문서 | Mini-PRD 필드 | Audit 검증 항목 | 필수 여부 |
|---------------|---------------|-----------------|-----------|
| **prd.md** | purpose, features | 기획 정합성 | ✅ 필수 |
| **trd.md** | tech-stack | 아키텍처 | ✅ 필수 |
| **database-design.md** | data-model | DDD | ✅ 필수 |
| **api-contracts.md** | api-contract | API 계약 | ✅ 권장 |
| **screen-spec.md** | (별도) | 화면 명세 | 🔄 화면 설계 시 |
| **ui-guide.md** | (별도) | UI 가이드 | 🔄 디자인 시 |
| **test-strategy.md** | (별도) | 테스트 전략 | 🔄 QA Phase |

---

## Phase별 필수 항목

### Phase 1 (초기) - `/audit` 최소 필수

```yaml
management/mini-prd.md:
  purpose:
    description: "프로젝트 목적 한 문장"
    audit_check: "기획 정합성 - purpose 필드 존재 확인"

  features:
    - name: "기능명"
      description: "기능 설명"
      priority: "P0 | P1 | P2"
    audit_check: "기획 정합성 - features 배열 존재 확인"

  tech_stack:
    frontend: "프론트엔드 기술"
    backend: "백엔드 기술"
    database: "DB 기술"
    audit_check: "아키텍처 - tech_stack 필드 존재 확인"
```

### Phase 2 (구체화) - `/audit` 권장

```yaml
management/mini-prd.md:
  data_model:
    entities:
      - name: "EntityName"
        fields:
          - { name: "id", type: "UUID" }
          - { name: "email", type: "string", unique: true }
    audit_check: "DDD - data_model.entities 존재 확인"

  api_contract:
    endpoints:
      - { method: "GET", path: "/api/users", response: "User[]" }
      - { method: "POST", path: "/api/users", request: "{email, name}", response: "User" }
    audit_check: "API 계약 - api_contract.endpoints 존재 확인"
```

### Phase 3 (보완) - `/audit` 추가 점수

```yaml
management/mini-prd.md:
  error_handling:
    - error: "중복 이메일"
      http_code: 409
      message: "이미 가입된 이메일입니다"

  edge_cases:
    - case: "네트워크 중단"
      handling: "재시도 3회, 지수 백오프"

  performance:
    - metric: "API 응답 시간"
      target: "< 200ms (p95)"
      measure: "Datadog APM"
```

---

## `/audit` 통과 조건

### 최소 통과 (Phase 1만 완료)

```yaml
# management/mini-prd.md 구조
purpose: "프로젝트 목적"
features: [...]  # 최소 3개
tech_stack: {...}

# /audit 검증
✅ 기획 정합성: purpose, features 존재
✅ 아키텍처: tech_stack 존재
⚠️ DDD: data-model 없음 (경고)
⚠️ API 계약: api-contract 없음 (경고)
```

### 권장 통과 (Phase 2까지 완료)

```yaml
# management/mini-prd.md 구조
purpose: "프로젝트 목적"
features: [...]
tech_stack: {...}
data_model: { entities: [...] }
api_contract: { endpoints: [...] }

# /audit 검증
✅ 기획 정합성: 통과
✅ 아키텍처: 통과
✅ DDD: data_model 엔티티 존재
✅ API 계약: endpoints 정의됨
```

### 완전 통과 (Phase 3까지 완료)

```yaml
# management/mini-prd.md 구조 + Phase 3 항목
error_handling: [...]
edge_cases: [...]
performance: [...]

# /audit 검증
✅ 모든 항목 통과
✅ 예외 처리 정의됨
✅ 성능 목표 설정됨
```

---

## `/quality-auditor` 수정 필요

현재 `/audit` 스킬이 Socrates 7개 문서를 요구합니다.
Mini-PRD를 지원하도록 수정이 필요합니다:

### 변경 전 (quality-auditor/SKILL.md)

```markdown
## 전제 조건

1. 기획 문서 존재 확인
   - docs/planning/01-prd.md
   - docs/planning/02-trd.md
   - docs/planning/03-database-design.md
   - ...
```

### 변경 후

```markdown
## 전제 조건

1. 기획 문서 존재 확인 (둘 중 하나)
   - **옵션 A**: Socrates 7개 문서
     - docs/planning/01-prd.md
     - docs/planning/02-trd.md
     - ...
   - **옵션 B**: Mini-PRD (권장)
     - management/mini-prd.md
     - Phase 1 최소, Phase 2 권장
```

---

## 사용 예시

### 예시 1: Mini-PRD만으로 `/audit` 통과

```bash
# 1. Mini-PRD 작성 (Phase 1 + 2)
/governance-setup
  → mini-prd 생성

# 2. /audit 실행
/audit
  → ✅ Mini-PRD 감지
  → ✅ 기획 정합성 확인 (purpose, features)
  → ✅ 아키텍처 확인 (tech_stack)
  → ✅ DDD 확인 (data_model)
  → ✅ 통과
```

### 예시 2: Socrates + Mini-PRD 혼합

```bash
# 1. 기존 Socrates 문서 있음
docs/planning/01-prd.md
docs/planning/02-trd.md

# 2. Mini-PRD로 보완
management/mini-prd.md
  → data_model 추가 (DDD 검증 통과)
  → api_contract 추가 (API 계약 검증 통과)

# 3. /audit 실행
/audit
  → 기존 Socrates + Mini-PRD 통합 검증
```

---

## 체크리스트

### Mini-PRD 작성 시

- [ ] **Phase 1**: purpose 명확히 (한 문장)
- [ ] **Phase 1**: features 최소 3개
- [ ] **Phase 1**: tech_stack 최소 프론트/백엔드/DB
- [ ] **Phase 2**: data_model 주요 엔티티 2개 이상
- [ ] **Phase 2**: api_contract 최소 3개 endpoint
- [ ] **Phase 3**: error_handling 주요 에러 케이스
- [ ] **Phase 3**: performance 최소 1개 지표

### `/audit` 실행 전

- [ ] Mini-PRD 파일 위치: `management/mini-prd.md`
- [ ] Phase 1 항목 모두 존재
- [ ] Phase 2 항목 가능한 한 작성
- [ ] YAML/Markdown 형식 유효

---

**Last Updated**: 2026-03-03
