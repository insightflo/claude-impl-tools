# Phase 2: Chief Architect 상세 가이드

## 역할
기술 표준 정의, 아키텍처 결정(ADR) 작성

## 산출물
`management/decisions/ADR-*.md`

## Task 호출

```
Task({
  subagent_type: "orchestrator",
  description: "Architect: 아키텍처 결정 문서",
  prompt: `
## 역할: Chief Architect

당신은 이 프로젝트의 Chief Architect입니다. ADR(Architecture Decision Record)을 작성하세요.

## 입력 정보
- TRD: docs/planning/02-trd.md
- TASKS: docs/planning/06-tasks.md

## 산출물: management/decisions/ 폴더에 ADR 파일들

### ADR-001-tech-stack.md
기술 스택 결정 (이미 TRD에 있으면 정리만)

### ADR-002-api-versioning.md
API 버저닝 정책:
- 버전 표기 방식 (URL path vs Header)
- 하위 호환성 정책
- 지원 중단(deprecation) 절차

### ADR-003-error-handling.md
에러 핸들링 표준:
- 에러 응답 형식 (JSON 스키마)
- HTTP 상태 코드 사용 규칙
- 클라이언트 에러 vs 서버 에러

### ADR-004-naming-convention.md
명명 규칙:
- 파일/폴더 명명 규칙
- 함수/변수 명명 규칙
- API 엔드포인트 명명 규칙

## ADR 형식
각 ADR은 다음 구조를 따릅니다:
- Title, Status (Proposed/Accepted/Deprecated)
- Context (왜 결정이 필요한가)
- Decision (무엇을 결정했는가)
- Consequences (결정의 영향)

## (필수) Governance Operationalization (Doc → Execution)
- ADR이 "문서로 끝"나지 않도록, 아래를 포함하세요:
  - 단일 엔트리 검증 커맨드 제안: `scripts/verify_all.sh` 또는 `make verify`
  - 각 ADR의 결정이 실제로 강제/검증되는 지점 명시(예: lint rule/CI job/테스트/런타임 가드)
  - 산출물 경로 및 CI 아티팩트 경로(있는 경우)
  - 업데이트 트리거(반복 실패, 신규 퍼블릭 경계 추가, 운영/보안 포스처 변화)

## 주의사항
- 구현 코드 작성 금지
- 결정 근거를 명확히 기술
`
})
```

## 완료 조건
- [ ] `management/decisions/` 폴더 생성됨
- [ ] ADR 최소 4개 작성됨
- [ ] 각 ADR에 Status가 명시됨

## ADR 템플릿

```markdown
# ADR-00X: {제목}

## Status
Proposed | Accepted | Deprecated

## Context
{왜 이 결정이 필요한가}

## Decision
{무엇을 결정했는가}

## Consequences

### Positive
-

### Negative
-

### Risks
-
```
