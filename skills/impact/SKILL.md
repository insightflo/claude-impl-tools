---
name: impact
description: 파일 변경 전 영향도/위험도를 분석합니다. 프로덕션 코드 수정 전, 리팩토링 전, 핵심 로직 변경 시 반드시 이 스킬을 사용하세요. 특히 payment, auth, billing, security 경로의 파일을 수정할 때는 필수입니다. /impact, "영향도 분석", "이 파일 수정하면 어디에 영향 가?" 트리거.
version: 1.1.0
updated: 2026-02-11
---

# Impact Analyzer (변경 영향도 분석)

> **파일 수정 전에 영향 범위, 위험도, 관련 테스트를 분석하여 안전한 변경을 지원합니다.**

---

## 스킬 발동 조건

- `/impact <파일경로>`
- `/impact analyze <파일경로>`
- "이 파일 수정하면 어디에 영향 가?"
- "변경 영향도 분석해줘"

---

## 절대 금지 사항

1. **코드를 직접 수정하지 마세요** - 이 스킬은 분석 전용입니다.
2. **추측으로 의존성을 판단하지 마세요** - 반드시 실제 import/require 구문을 파싱하세요.
3. **분석 없이 위험도를 단정하지 마세요** - 파일 경로 패턴과 실제 의존성을 모두 확인하세요.

---

## 실행 단계

```
/impact <파일경로> 수신
    |
    v
[1] 대상 파일 유효성 확인
    |
    v
[2] 위험도 분류 (Risk Classification)
    |
    v
[3] 직접 의존성 분석 (Direct Dependents)
    |
    v
[4] 간접 의존성 분석 (Indirect Dependents)
    |
    v
[5] 영향 받는 도메인 식별
    |
    v
[6] 관련 테스트 탐색
    |
    v
[7] 권장 검토자 결정
    |
    v
[8] 영향도 리포트 출력
```

---

### 1단계: 대상 파일 유효성 확인

파일 존재 여부와 타입 확인 (지원: `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte`)

### 2단계: 위험도 분류

파일 경로 패턴 기반으로 위험도를 분류합니다.

| 위험도 | 패턴 | 필수 조치 |
|--------|------|-----------|
| **CRITICAL** | `payment`, `billing`, `auth`, `security`, `crypto`, `jwt`, `password` | 전체 테스트 + 리뷰 필수 |
| **HIGH** | `services/*`, `core/`, `middleware/`, `shared/` | 관련 테스트 스위트 실행 |
| **MEDIUM** | `api/`, `routes/`, `models/`, `schemas/` | 계약 호환성 확인 |
| **LOW** | `tests/`, `utils/`, `config/`, `docs/` | 표준 리뷰 |

**커스텀 설정**: `.claude/risk-areas.yaml`이 있으면 해당 설정을 우선 적용합니다.

### 3단계: 직접 의존성 분석

대상 파일을 **import하거나 require하는** 모든 파일을 탐색합니다.

```bash
# Python
grep -rn "from.*<모듈명>|import.*<모듈명>" --include="*.py" .

# JS/TS
grep -rn "from.*<모듈명>|require.*<모듈명>" --include="*.ts" --include="*.js" .
```

### 4단계: 간접 의존성 분석

대상 파일이 **API 엔드포인트를 정의**하는 경우, 해당 API를 호출하는 파일을 탐색합니다.

| 유형 | 설명 | 탐색 방법 |
|------|------|-----------|
| API 호출 | 엔드포인트를 호출하는 클라이언트 | API 경로 문자열 grep |
| 이벤트 구독 | 이벤트를 발행/구독하는 파일 | 이벤트명 grep |

### 5단계: 영향 받는 도메인 식별

의존성 분석 결과를 기반으로 영향 받는 도메인을 식별합니다.
- 디렉토리 구조 기반: `domains/<도메인명>/`, `src/<도메인명>/`
- `.claude/project-team.yaml`의 도메인 정의가 있으면 우선 적용

### 6단계: 관련 테스트 탐색

| 원본 파일 | 탐색 대상 |
|-----------|-----------|
| `user_service.py` | `test_user_service.py`, `user_service_test.py` |
| `userService.ts` | `userService.test.ts`, `userService.spec.ts` |

### 7단계: 권장 검토자 결정

| 위험도 | 권장 검토자 |
|--------|-------------|
| **CRITICAL** | QA Manager + Chief Architect |
| **HIGH** | Part Leader (해당 도메인) |
| **MEDIUM** | Domain Developer |
| **LOW** | 일반 코드 리뷰 |

**교차 도메인 영향 시**: 영향 받는 모든 도메인의 Part Leader를 추가합니다.

### 8단계: 영향도 리포트 출력

상세 출력 형식은 `references/output-formats.md`를 참조하세요.

---

## Hook 연동

| 구분 | Hook (`pre-edit-impact-check.js`) | Skill (`/impact`) |
|------|-----------------------------------|-------------------|
| 시점 | Edit 시 자동 실행 | 사용자 요청 시 |
| 범위 | 단일 파일 요약 | 상세 분석 + 권장 사항 |
| 용도 | 실시간 경고 | 사전 계획 수립 |

---

## 관련 스킬 연동

| 스킬 | 연동 시점 | 용도 |
|------|-----------|------|
| `/deps <domain>` | 교차 도메인 영향 발견 시 | 도메인 의존성 시각화 |
| `/coverage <file>` | 관련 테스트 확인 후 | 테스트 커버리지 상세 확인 |
| `/changelog <domain>` | 수정 완료 후 | 변경 이력 기록 확인 |

---

## 참조 문서

- `references/output-formats.md` - 출력 형식 상세
- `references/examples.md` - 사용 예시
