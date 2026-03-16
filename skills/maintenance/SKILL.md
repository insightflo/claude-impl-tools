---
name: maintenance
description: 프로덕션 시스템 유지보수 오케스트레이터. 변경 수용 판단 → 영향도 분석 → 안전한 수정 → 테스트 강화 → 이력 관리를 ITIL 기반 5단계로 자동화합니다. 버그 수정, 기능 수정, 설정 변경, 장애 대응 시 반드시 사용하세요. "이 버그 고쳐줘", "프로덕션 수정", "유지보수", "장애 수정", "핫픽스" 요청에 즉시 실행.
version: 1.0.0
updated: 2026-03-16
---

# Maintenance (프로덕션 유지보수 오케스트레이터)

> **목적**: 프로덕션 시스템의 변경을 ITIL 기반 5단계로 안전하게 수행한다.
> 기존 분석 스킬(/impact, /deps, /coverage, /security-review, /changelog)을 자동 연결하여
> 사용자가 개별 실행할 필요 없이 하나의 흐름으로 완료한다.
>
> **핵심 원칙**: 프로덕션 코드를 다루므로, 모든 변경은 영향도 분석 → 사용자 확인 → 수정 → 검증 순서를 반드시 따른다.

---

## 절대 금지 사항

1. ASSESS 단계를 건너뛰고 코드를 수정하지 마라
2. HIGH/CRITICAL 위험도에서 사용자 확인 없이 진행하지 마라
3. 파일 수정 후 lint/type-check 없이 다음 파일로 넘어가지 마라
4. VERIFY 단계를 건너뛰지 마라
5. 변경 이력(RECORD) 없이 작업을 종료하지 마라

---

## 선행 조건 확인 (스킬 시작 시 자동 실행)

1. **Git 저장소**: `.git/` 디렉토리가 있어야 한다. 없으면 중단.
2. **TASKS.md**: 필수 아님 (프로덕션 유지보수는 기존 코드 대상).
3. **프로젝트 타입 감지**: package.json, pyproject.toml, Cargo.toml 등으로 lint/test 명령 결정.

---

## 5단계 워크플로우

```
/maintenance "요청 내용"
    │
    ▼
[Stage 1: ASSESS]  변경 분류 + 위험 사전 심사
    │
    ▼
[Stage 2: ANALYZE] /impact + /deps + /architecture → 영향도 리포트
    │                                                 ↓ HIGH/CRITICAL
    │                                          사용자 확인 필요
    ▼
[Stage 3: IMPLEMENT] git branch + 점진적 수정 + 파일별 검증
    │
    ▼
[Stage 4: VERIFY]  테스트 + /coverage + /security-review
    │
    ▼
[Stage 5: RECORD]  변경 기록 + 커밋 + 롤백 계획
```

---

### Stage 1: ASSESS (변경 수용 판단)

사용자 요청을 분석하여 변경을 분류한다.

```bash
# 1. 대상 파일 식별
# 사용자 요청에서 파일명, 함수명, 에러 메시지 등을 추출

# 2. 변경 유형 분류
#   - Bug Fix: 기존 동작의 오류 수정
#   - Feature Change: 기존 기능의 동작 변경
#   - Config Update: 설정/환경 변수 변경
#   - Refactor: 동작 변경 없는 구조 개선

# 3. ITIL 변경 유형 매핑
#   - Standard: 저위험, 정기적 (설정 변경, 텍스트 수정)
#   - Normal: 중위험, 평가 필요 (로직 변경, API 수정)
#   - Emergency: 장애 대응, 즉시 처리 (프로덕션 다운, 보안 취약점)
```

**위험 사전 심사**: 대상 파일 경로로 위험도를 빠르게 판단한다.

| 경로 패턴 | 위험도 | 이유 |
|-----------|--------|------|
| `**/payment/**`, `**/billing/**` | CRITICAL | 금융 로직 |
| `**/auth/**`, `**/security/**` | CRITICAL | 인증/보안 |
| `migrations/**`, `**/schema*` | HIGH | 데이터 구조 |
| `**/api/**`, `**/routes/**` | HIGH | 외부 인터페이스 |
| `src/**`, `lib/**` | MEDIUM | 일반 비즈니스 로직 |
| `config/**`, `*.env*` | MEDIUM | 환경 설정 |
| `docs/**`, `*.md` | LOW | 문서 |
| `tests/**` | LOW | 테스트 코드 |

**Gate**: Emergency는 경고 배너 출력 후 진행. Normal + HIGH/CRITICAL은 사용자 확인 후 진행.

---

### Stage 2: ANALYZE (영향도 분석)

기존 분석 스킬을 순서대로 호출하여 영향도를 종합한다.

```
1. /impact <대상 파일>        → 변경 영향도 + 위험 요소
2. /deps <대상 파일>          → 의존 관계 + 순환 참조 확인
3. /architecture              → 영향받는 도메인 식별
```

각 스킬의 결과를 종합하여 영향도 리포트를 생성한다:

```markdown
## 영향도 리포트

| 항목 | 결과 |
|------|------|
| 대상 파일 | 3개 |
| 영향받는 파일 | 12개 |
| 영향받는 도메인 | backend, api |
| 순환 참조 | 없음 |
| 위험도 | HIGH |

### 위험 요소
- payment 도메인의 핵심 로직 변경
- 3개 API 엔드포인트에 영향
```

**Gate**: 위험도 HIGH/CRITICAL이면 사용자에게 확인한다:
- 영향도 요약 표시
- "진행 / 범위 축소 / 중단" 선택지 제공

---

### Stage 3: IMPLEMENT (안전한 수정)

프로덕션 코드를 안전하게 수정한다. 모든 변경은 별도 브랜치에서 진행한다.

```bash
# 1. 브랜치 생성
git checkout -b maintenance/{change-type}-{short-description}

# 2. 파일별 점진적 수정
#    - 한 파일 수정
#    - 즉시 lint + type-check 실행
#    - 실패 시: git checkout -- <file> 로 되돌리고 사용자에게 보고
#    - 성공 시: 다음 파일로 진행

# 3. 프로젝트별 검증 명령
#    Node.js: npx eslint <file> && npx tsc --noEmit
#    Python:  ruff check <file> && mypy <file>
#    Rust:    cargo check
```

**원칙**:
- 한 번에 하나의 파일만 수정한다
- 수정 후 즉시 검증한다 — 검증 전에 다음 파일로 넘어가지 마라
- 모든 파일이 검증 실패하면 중단하고 사용자에게 수동 수정을 제안한다

---

### Stage 4: VERIFY (테스트 강화)

수정된 코드의 품질을 검증한다.

```
1. 기존 테스트 실행           → 전체 통과 확인
2. /coverage <변경 파일>      → 커버리지 감소 여부
3. /security-review --path <변경 파일>  → 보안 취약점 확인
```

**검증 결과 판정**:

| 결과 | 판정 | 조치 |
|------|------|------|
| 테스트 전체 통과 + 커버리지 유지 + 보안 클린 | ✅ PASS | RECORD로 진행 |
| 테스트 통과 + 커버리지 감소 | ⚠️ WARN | 경고 표시, 사용자 결정 |
| 테스트 실패 | ❌ FAIL | 실패 원인 표시, 수정 제안 |
| CRITICAL 보안 이슈 | ❌ BLOCK | 보안 이슈 해결 전 진행 불가 |

---

### Stage 5: RECORD (이력 관리)

변경 이력을 체계적으로 기록한다.

```
1. 변경 기록(Change Record) 생성    → references/change-record-template.md 기반
2. 구조화된 커밋 메시지 작성
3. 롤백 계획 제시
```

**커밋 메시지 형식**:

```
{change-type}({domain}): {description}

Change-Type: {Standard|Normal|Emergency}
Risk-Level: {CRITICAL|HIGH|MEDIUM|LOW}
Impact: {affected domains}
Files: {count} modified
Rollback: git revert <hash>
```

**롤백 계획**: 커밋 완료 후 롤백 명령을 사용자에게 안내한다.

---

## 최종 리포트

모든 단계 완료 후 요약 리포트를 출력한다:

```
┌─────────────────────────────────────────────┐
│ 🔧 유지보수 완료 리포트                       │
├─────────────────────────────────────────────┤
│ 변경 유형: Bug Fix (Normal)                  │
│ 위험도: MEDIUM                               │
│                                              │
│ ✅ ASSESS:    Standard 분류                   │
│ ✅ ANALYZE:   3개 파일, 2개 도메인 영향       │
│ ✅ IMPLEMENT: 3/3 파일 수정 성공              │
│ ✅ VERIFY:    테스트 통과, 커버리지 유지       │
│ ✅ RECORD:    CR-20260316-001 생성            │
│                                              │
│ 브랜치: maintenance/fix-payment-null-check    │
│ 롤백: git revert abc1234                     │
└─────────────────────────────────────────────┘
```

---

## 스킬 연동 테이블

| 단계 | 호출 스킬 | 목적 |
|------|----------|------|
| ASSESS | (내장 로직) | 변경 분류 + 위험 사전 심사 |
| ANALYZE | `/impact`, `/deps`, `/architecture` | 영향도 종합 분석 |
| VERIFY | `/coverage`, `/security-review` | 품질 + 보안 검증 |
| RECORD | `/changelog` (hook 자동) | 이력 기록 |

---

## 참조 문서

- `references/change-record-template.md` — RFC 스타일 변경 기록 템플릿

---

**Last Updated**: 2026-03-16 (v1.0.0)
