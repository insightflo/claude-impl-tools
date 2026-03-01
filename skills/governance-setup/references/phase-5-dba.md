# Phase 5: DBA 상세 가이드

## 역할
데이터베이스 표준 정의, 명명 규칙

## 산출물
`database/standards.md`

## Task 호출

```
Task({
  subagent_type: "database-specialist",
  description: "DBA: 데이터베이스 표준 정의",
  prompt: `
## 역할: DBA

당신은 이 프로젝트의 DBA입니다. 데이터베이스 표준을 정의하세요.

## 입력 정보
- TRD: docs/planning/02-trd.md (DB 기술 스택)
- DB Design: docs/planning/04-database-design.md (있는 경우)

## 산출물: database/standards.md

다음 섹션을 포함하세요:

### 1. 테이블 명명 규칙
- snake_case 사용
- 복수형 사용 (users, orders)
- 접두어 규칙 (없음 또는 도메인별)
- 예약어 회피

### 2. 컬럼 명명 규칙
- snake_case 사용
- 외래키: {referenced_table}_id
- Boolean: is_, has_, can_ 접두어
- 타임스탬프: created_at, updated_at, deleted_at

### 3. 인덱스 정책
- Primary Key 명명: pk_{table}
- Foreign Key 명명: fk_{table}_{column}
- Unique Index 명명: uq_{table}_{column}
- 일반 Index 명명: idx_{table}_{column}

### 4. 마이그레이션 규칙
- 파일 명명: {timestamp}_{description}.sql
- 롤백 스크립트 필수
- 대용량 테이블 변경 시 주의사항
- 무중단 마이그레이션 전략

### 5. 쿼리 표준
- N+1 쿼리 방지
- 페이지네이션 필수 (cursor vs offset)
- 트랜잭션 격리 수준
- 타임아웃 설정

### 6. 백업 및 복구
- 백업 주기
- 보존 기간
- 복구 테스트 주기

### (필수) Governance Operationalization (Doc → Execution)
- 단일 엔트리 검증 커맨드 제안: `scripts/verify_all.sh` 또는 `make verify`
- DB 표준이 실제로 강제되는 지점 명시(예: migration lint, naming checks, CI jobs)
- 체크별 실행 커맨드/산출물 경로/Block vs Warn 매핑 표
- 업데이트 트리거(incident, 성능/락 이슈, 도메인 확장)

## 주의사항
- 구현 코드 작성 금지 (SQL 예시만 포함)
- 팀 전체가 따를 수 있는 명확한 규칙
`
})
```

## 완료 조건
- [ ] `database/standards.md` 생성됨
- [ ] 명명 규칙 예시 포함
- [ ] 마이그레이션 절차 정의됨

## 산출물 예시

```markdown
# Database Standards

## 1. Table Naming
| Rule | Example |
|------|---------|
| snake_case | user_profiles |
| Plural | users, orders |
| No prefix | users (not tbl_users) |

## 2. Column Naming
| Type | Convention | Example |
|------|------------|---------|
| Primary Key | id | id |
| Foreign Key | {table}_id | user_id |
| Boolean | is_, has_, can_ | is_active |
| Timestamp | _at suffix | created_at |

## 3. Index Naming
| Type | Pattern | Example |
|------|---------|---------|
| PK | pk_{table} | pk_users |
| FK | fk_{table}_{col} | fk_orders_user_id |
| Unique | uq_{table}_{col} | uq_users_email |
| Index | idx_{table}_{col} | idx_orders_status |

## 4. Migration Rules
- File: `{YYYYMMDDHHMMSS}_{description}.sql`
- Always include rollback
- Test on staging first

## 5. Query Standards
- Use pagination (cursor preferred)
- Avoid SELECT *
- Use parameterized queries
- Set query timeout: 30s

## 6. Backup Policy
- Full backup: Daily
- Incremental: Hourly
- Retention: 30 days
- Recovery test: Monthly
```
