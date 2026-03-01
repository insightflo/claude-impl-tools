# Phase 1: Project Manager 상세 가이드

## 역할
프로젝트 계획 수립, 마일스톤 정의, 리스크 관리

## 산출물
`management/project-plan.md`

## Task 호출

```
Task({
  subagent_type: "orchestrator",
  description: "PM: 프로젝트 계획 수립",
  prompt: `
## 역할: Project Manager

당신은 이 프로젝트의 PM입니다. 다음 산출물을 생성하세요.

## 입력 정보
- PRD: docs/planning/01-prd.md
- TRD: docs/planning/02-trd.md
- TASKS: docs/planning/06-tasks.md

## 산출물: management/project-plan.md

다음 내용을 포함하세요:
1. 프로젝트 개요 (목적, 범위, 성공 기준)
2. 마일스톤 정의 (Phase별 목표, 기간)
3. 리스크 관리 계획 (식별된 리스크, 대응 방안)
4. 커뮤니케이션 규칙 (보고 주기, 채널)
5. 에스컬레이션 정책
6. (필수) **Governance Operationalization (Doc → Execution)**
   - 단일 엔트리 검증 커맨드 제안: `scripts/verify_all.sh` 또는 `make verify`
   - 거버넌스 산출물(ADR/quality-gates/DB standards/Design system)이 어디에서 어떻게 강제되는지(CI job, 테스트, 산출물 경로)
   - 거버넌스 업데이트 트리거(게이트 실패/새 퍼블릭 경계/보안 포스처 변화)

## 주의사항
- 구현 코드 작성 금지
- 기획 문서 기반으로 작성
- 현실적인 일정 수립
`
})
```

## 완료 조건
- [ ] `management/project-plan.md` 생성됨
- [ ] 마일스톤이 TASKS.md의 Phase와 일치
- [ ] 리스크 최소 3개 이상 식별

## 산출물 예시 구조

```markdown
# Project Plan: {프로젝트명}

## 1. 프로젝트 개요
- **목적**:
- **범위**:
- **성공 기준**:

## 2. 마일스톤
| Phase | 목표 | 기간 | 담당 |
|-------|------|------|------|
| Phase 1 | ... | 1주 | backend-specialist |

## 3. 리스크 관리
| 리스크 | 영향도 | 발생확률 | 대응방안 |
|--------|--------|----------|----------|

## 4. 커뮤니케이션
- 데일리 스탠드업: 매일 09:00
- 주간 리뷰: 매주 금요일

## 5. 에스컬레이션
- Level 1: 팀 리드
- Level 2: PM
- Level 3: 스테이크홀더
```
