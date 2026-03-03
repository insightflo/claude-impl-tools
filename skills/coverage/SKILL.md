---
name: coverage
description: 테스트 커버리지를 조회하고 분석합니다. 미커버 영역 식별, 트렌드 추적, 도메인별/파일별 커버리지 분석을 지원합니다. /coverage 트리거.
version: 2.2.0
updated: 2026-02-07
---

# 🧪 Test Coverage Map (테스트 커버리지 분석)

> **목적**: 프로젝트의 테스트 커버리지를 조회하고 **미커버 영역을 식별**하며 **커버리지 트렌드를 추적**합니다.
>
> **역할 분담:**
> | 스킬 | 시점 | 범위 |
> |------|------|------|
> | **`/coverage` (이 스킬)** | **수정 전/후, 정기 조회** | **커버리지 현황 + 미커버 영역 + 트렌드** |
> | `/audit` | 배포 전 | 기획 정합성 + DDD + 테스트 + 브라우저 (종합 감사) |
> | `/quality-gate` | Phase 완료 시 | 품질 게이트 통과/실패 |
> | `/impact` | 수정 전 | 영향도 분석 |
>
> **v2.3.0 업데이트**: Standalone 모드 지원

---

## 🔧 MCP 의존성

| MCP | 필수 여부 | 용도 |
|-----|-----------|------|
| 없음 | - | 기본 명령어(`pytest`, `npm test`, `cargo test` 등) 사용 |

> **의존성 없음**: 모든 테스트 러너의 기본 명령어를 활용하여 커버리지 데이터를 수집합니다.

---

## ⛔ 절대 금지 사항

1. ❌ **직접 코드를 수정하지 마세요** - 수정은 `implementation agent`의 역할입니다.
2. ❌ **테스트 설정을 변경하지 마세요** - 커버리지 분석만 수행합니다.
3. ❌ **임의로 커버리지 기준을 내리지 마세요** - 기획 문서의 기준을 따릅니다.

---

## ✅ 스킬 발동 시 즉시 실행할 행동

```
1. 프로젝트 타입 감지 (Python/Node.js/Rust/Go 등)
2. 테스트 환경 확인 (pytest.ini, package.json, Cargo.toml 등)
3. 커버리지 데이터 수집 (각 언어별 명령어 실행)
4. 미커버 파일/영역 식별
5. 커버리지 트렌드 분석 (가능한 경우)
6. 리포트 생성 및 권장사항 제시
```

---

## 🏗️ 실행 프로세스

### 1단계: 프로젝트 타입 감지

```bash
# 파이썬 프로젝트
ls pyproject.toml setup.py requirements.txt 2>/dev/null && echo "Python"

# Node.js 프로젝트
ls package.json 2>/dev/null && echo "Node.js"

# Rust 프로젝트
ls Cargo.toml 2>/dev/null && echo "Rust"

# Go 프로젝트
ls go.mod 2>/dev/null && echo "Go"
```

### 2단계: 테스트 환경 확인

**Python (pytest)**
```bash
# pytest 설정 파일 확인
ls pytest.ini pyproject.toml setup.cfg 2>/dev/null

# pytest-cov 플러그인 확인
pip list | grep pytest-cov
```

**Node.js (Vitest/Jest)**
```bash
# 테스트 설정 확인
ls vitest.config.ts jest.config.js 2>/dev/null

# 패키지 확인
cat package.json | grep -E '"vitest"|"jest"'
```

**Rust (cargo)**
```bash
# Rust 테스트 설정 확인
grep -A 5 "\[profile.test\]" Cargo.toml 2>/dev/null
```

### 3단계: 커버리지 데이터 수집

**Python (pytest-cov)**
```bash
pytest --cov=. --cov-report=json --cov-report=term-missing
```

**Node.js (Vitest)**
```bash
npm run test -- --coverage --coverage.reporter=json --coverage.reporter=text
```

**Node.js (Jest)**
```bash
npm run test -- --coverage --coverageReporters=json --coverageReporters=text
```

**Rust (cargo-tarpaulin)**
```bash
cargo tarpaulin --out Json --output-dir coverage
```

**Go (go test + gocover)**
```bash
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
```

### 4단계: 미커버 영역 식별

커버리지 리포트에서:
- **미커버 라인** 식별
- **미커버 브랜치** 식별
- **미커버 함수** 식별

```bash
# Python: --cov-report=term-missing
#  Missing 컬럼에서 미커버 라인 번호 추출

# Node.js: uncovered lines report
#  Uncovered Lines 섹션에서 미커버 라인 추출
```

### 5단계: 커버리지 트렌드 분석 (선택적)

이전 커버리지 데이터와 비교:
- `.claude/coverage/coverage.json` 또는 CI 저장소에서 이전 데이터 조회
- 상승/하락 추이 계산
- 주요 변화 영역 식별

---

## 🛠️ 주요 명령어 대응

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `/coverage` | 전체 프로젝트 커버리지 조회 | 모든 패키지/모듈 커버리지 표시 |
| `/coverage <path>` | 특정 디렉토리/파일 커버리지 | `/coverage src/services/` |
| `/coverage --uncovered` | 미커버 영역만 표시 | 커버되지 않은 파일 목록 |
| `/coverage --threshold <n>` | n% 미만 파일 표시 | `/coverage --threshold 80` |
| `/coverage --trend` | 커버리지 트렌드 (7일/30일) | 커버리지 변화 차트 |
| `/coverage --function <file>` | 파일별 함수 커버리지 | `/coverage --function auth.py` |
| `/coverage --branch` | 브랜치 커버리지 상세 | 조건부 분기 커버리지 |
| `/coverage --report` | 상세 HTML 리포트 생성 | htmlcov/ 또는 coverage/lcov-report/ |

---

## 📊 출력 형식

### 전체 커버리지 조회 (`/coverage`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧪 테스트 커버리지 분석                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📈 전체 커버리지                                                    │
│  ├── 라인 커버리지:    ████████░░  82% (1230/1500 lines)            │
│  ├── 브랜치 커버리지:  ███████░░░  71% (410/575 branches)           │
│  └── 함수 커버리지:    █████████░  88% (45/51 functions)            │
│                                                                     │
│  📁 패키지별 커버리지:                                               │
│  ├── app/api/          ██████████  95%                              │
│  ├── app/services/     ████████░░  82%                              │
│  ├── app/models/       ███████░░░  78%                              │
│  ├── app/utils/        █████░░░░░  65% ⚠️                           │
│  └── tests/            ██████████ 100%                              │
│                                                                     │
│  ⚠️ 커버리지 미달 (80% 미만):                                        │
│  ├── app/utils/        65% (13/20 lines)                            │
│  └── app/models/       78% (32/41 lines)                            │
│                                                                     │
│  💡 다음 단계:                                                       │
│  - /coverage --uncovered (미커버 영역 상세 확인)                     │
│  - /coverage app/utils/ (특정 패키지 분석)                          │
│  - /coverage --function (함수별 커버리지)                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 특정 경로 커버리지 (`/coverage <path>`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧪 테스트 커버리지: app/services/                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📊 커버리지 요약                                                    │
│  ├── 라인 커버리지:    ████████░░  82% (45/55 lines)                │
│  ├── 브랜치 커버리지:  ███████░░░  71% (15/21 branches)             │
│  └── 함수 커버리지:    █████████░  88% (7/8 functions)              │
│                                                                     │
│  📄 파일별 커버리지:                                                 │
│  ├── order_service.py      ██████████  95% (38/40)                  │
│  ├── payment_service.py     ████████░░  82% (18/22)                 │
│  ├── discount_service.py    ████████░░  78% (12/15)                 │
│  └── notification_service.py ███░░░░░░  45% (5/11) ⚠️               │
│                                                                     │
│  🎯 함수별 커버리지 (discount_service.py):                          │
│  ├── calculate_discount()       ████████░░  82%                     │
│  ├── get_member_grade()         ██████████ 100%                     │
│  └── apply_coupon()             ████████░░  78%                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 미커버 영역 상세 (`/coverage --uncovered`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧪 미커버 영역 분석                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📍 app/services/discount_service.py (커버리지: 78%)                │
│  ├── L45-48: 등급이 null인 경우 처리 (예외 케이스)                   │
│  │   def get_member_grade(user_id):                                │
│  │       grade = db.query(user_id)                                 │
│  │       if grade is None:  # 💥 미커버 분기                        │
│  │           ...                                                   │
│  ├── L67-70: 쿠폰 만료 처리 (엣지 케이스)                            │
│  │   def apply_coupon(coupon_code, user):                          │
│  │       if coupon.expired:  # 💥 미커버 분기                       │
│  │           ...                                                   │
│  └── L92-95: API 타임아웃 재시도 로직                                │
│      try:                                                          │
│          result = api_call()                                       │
│      except Timeout:  # 💥 미커버 예외                               │
│          ...                                                       │
│                                                                     │
│  📍 app/utils/validators.py (커버리지: 65%)                         │
│  ├── L12-18: 복합 정규식 패턴 (이메일 검증)                         │
│  ├── L45-50: 국제 도메인 처리                                        │
│  └── L78-82: 특수 문자 이스케이프                                    │
│                                                                     │
│  💡 권장 사항:                                                       │
│  1. 미커버 영역에 대한 테스트 케이스 추가                            │
│  2. 예외/엣지 케이스에 집중                                          │
│  3. 성공 경로만 테스트했으면 실패 경로 추가                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 임계값 미달 파일 (`/coverage --threshold 80`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧪 커버리지 기준 미달 파일 (기준: 80%)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  파일                              커버리지    라인       미달       │
│  ─────────────────────────────────────────────────────────────────  │
│  1. app/utils/validators.py        65%      20 / 31    -15% ❌    │
│  2. app/services/notification.py   71%      5  / 7     -9%  ❌    │
│  3. app/models/order.py            78%      32 / 41    -2%  ⚠️    │
│                                                                     │
│  📊 통계                                                             │
│  ├── 기준 미달: 3개 파일                                             │
│  ├── 전체 파일: 15개                                                 │
│  └── 달성률: 80% (15/15에서 3개 미달)                               │
│                                                                     │
│  💡 해결 방법:                                                       │
│  /coverage app/utils/validators.py --uncovered (미커버 확인)        │
│  이후 해당 파일의 테스트 케이스 추가 필요                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 커버리지 트렌드 (`/coverage --trend`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  📈 커버리지 트렌드 (최근 30일)                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  라인 커버리지:                                                      │
│  2026-01-07: 65% ▄                                                  │
│  2026-01-14: 68% ▅                                                  │
│  2026-01-21: 72% ▆                                                  │
│  2026-01-28: 78% ▇                                                  │
│  2026-02-04: 80% █                                                  │
│  2026-02-07: 82% █ ⬆️ +2%                                           │
│                                                                     │
│  📊 기간별 통계:                                                     │
│  ├── 이전주: 80%                                                    │
│  ├── 현재: 82%                                                      │
│  └── 변화: +2% ✅                                                   │
│                                                                     │
│  🔍 주요 변화 원인:                                                  │
│  ├── 2026-02-04: 서비스 레이어 테스트 추가 (+3%)                    │
│  └── 2026-02-07: 예외 처리 테스트 추가 (+2%)                        │
│                                                                     │
│  💡 목표:                                                            │
│  현재: 82% → 목표: 85% (3% 더 필요)                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 함수별 커버리지 (`/coverage --function <file>`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧪 함수별 커버리지: app/services/order_service.py                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  함수                              라인    커버리지   상태           │
│  ─────────────────────────────────────────────────────────────────  │
│  create_order()                   18     ██████████ 100% ✅       │
│  update_order_status()            12     ████████░░  83% ✅       │
│  cancel_order()                   15     ███████░░░  71% ⚠️       │
│  get_order_details()              8      ██████████ 100% ✅       │
│  validate_order_items()           10     █████░░░░░  50% ❌       │
│  apply_discount_to_order()        14     ██████████ 100% ✅       │
│  send_order_notification()        9      ███░░░░░░░  33% ❌       │
│                                                                     │
│  📊 통계                                                             │
│  ├── 전체 함수: 7개                                                  │
│  ├── 100% 커버: 3개                                                  │
│  ├── 80-99%: 2개                                                    │
│  └── 80% 미만: 2개                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 브랜치 커버리지 상세 (`/coverage --branch <file>`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧪 브랜치 커버리지: app/services/discount_service.py              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  라인  코드                        분기      커버리지              │
│  ─────────────────────────────────────────────────────────────────  │
│  L12   if user.premium:           True  ✅ Covered                │
│         (premium 회원)             False ✅ Covered                │
│                                                                     │
│  L28   if discount >= threshold:   True  ✅ Covered                │
│         (할인이 임계값 이상)       False ❌ Not covered            │
│                                                                     │
│  L45   elif grade is None:         True  ❌ Not covered            │
│         (등급이 null인 경우)       False ✅ Covered                │
│                                                                     │
│  L67   try-except block:                                            │
│         Success ✅ Covered                                          │
│         Timeout ❌ Not covered                                      │
│         ValueError ✅ Covered                                       │
│                                                                     │
│  📊 브랜치 통계                                                      │
│  ├── 전체 브랜치: 12개                                              │
│  ├── 커버된 브랜치: 9개 (75%)                                       │
│  └── 미커버 브랜치: 3개 (25%)                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 권장 사항 생성 로직

커버리지 분석 후 자동으로 권장사항을 제시합니다:

### 1. 파일별 권장사항

**80% 초과**
```
✅ 우수한 테스트 커버리지입니다.
   유지보수 시 이 수준을 유지해주세요.
```

**70-80%**
```
⚠️ 개선 여지가 있습니다.
   다음 영역의 테스트 추가를 권장합니다:
   - 예외 처리 경로
   - 엣지 케이스
   - 조건부 분기
```

**70% 미만**
```
❌ 커버리지가 낮습니다.
   /coverage --uncovered [파일] 명령으로 미커버 영역을 확인하고
   다음 순서로 테스트를 추가해주세요:
   1. 주요 기능 (happy path)
   2. 예외 처리
   3. 엣지 케이스
```

### 2. 도메인별 분석

```
💡 order 도메인 분석:
   ├── services/: 95% ✅ (테스트 충분)
   ├── models/:   78% ⚠️ (모델 검증 테스트 추가 권장)
   └── validators/: 65% ❌ (입력 검증 테스트 필요)

   → 다음 스프린트에서 validators 커버리지 80% 이상으로 개선 권장
```

### 3. 트렌드 기반 권장사항

**상승 추이 (good)**
```
📈 좋은 추이입니다! 이 모멘텀을 유지해주세요.
   지난주 +3%에서 이번주 +2% 증가
   → 목표: 3주 내 85% 달성 가능
```

**하락 추이 (warning)**
```
📉 커버리지가 감소했습니다.
   지난주: 85% → 이번주: 82% (-3%)
   새로운 코드 추가 시 테스트도 함께 작성해주세요.
```

---

## 🔗 관련 스킬 연동

### `/impact <file>` (영향도 분석 후 커버리지 확인)

```
/impact app/services/order_service.py
  ↓
[영향도 분석 출력]
  ↓
💡 권장: /coverage app/services/ --uncovered
  (변경되는 영역의 테스트 커버리지 확인)
```

### `/audit` (배포 전 종합 감사 중 커버리지 검증)

```
/audit
  ↓
[1단계: 기획 검증]
[2단계: DDD 검증]
[3단계: 코드 품질]
  ↓
/coverage (자동 실행)
  ↓
[커버리지 리포트]
  ↓
커버리지 80% 미만 시 감사 차단
```

### `/maintenance-analyst` (유지보수 전 커버리지 확인)

```
사용자: "payment 로직 수정해줘"
  ↓
/impact payment_service.py
  ↓
"현재 커버리지: 78%입니다. 수정 전 테스트를 실행해주세요."
  ↓
/coverage payment_service.py (현재 상태 저장)
  ↓
[수정 진행]
  ↓
/coverage payment_service.py (수정 후 상태 비교)
  ↓
"커버리지 유지 확인 완료 ✅"
```

---

## 🎯 활용 시나리오

### Scenario 1: PR 검토 전 커버리지 확인

```bash
# 1. 전체 커버리지 확인
/coverage

# 2. 기준 미달 파일 식별
/coverage --threshold 80

# 3. 특정 파일 상세 분석
/coverage app/services/order_service.py --uncovered

# 결과: "이 파일은 78% 커버리지입니다.
#        다음 테스트 추가를 권장합니다: L45-48, L67-70"
```

### Scenario 2: 버그 수정 후 테스트 커버리지 확보

```bash
# 1. 수정할 파일의 현재 커버리지 확인
/coverage app/services/payment_service.py

# 결과: 75% 커버리지

# 2. 미커버 영역 확인
/coverage app/services/payment_service.py --uncovered

# 결과: 다음 영역 미커버
#       - L34-37: 환불 처리 로직
#       - L65-68: 부분 결제 처리

# 3. 버그 수정 + 테스트 추가

# 4. 개선 확인
/coverage app/services/payment_service.py

# 결과: 85% 커버리지로 개선됨 ✅
```

### Scenario 3: 도메인별 커버리지 현황 파악

```bash
# 1. order 도메인 전체 커버리지
/coverage order/ --report

# 2. 서비스별 상세 분석
/coverage order/services/
/coverage order/models/
/coverage order/validators/

# 3. 트렌드 추적
/coverage order/ --trend

# 결과: 지난달부터 10% 상승, 목표까지 5% 남음
```

### Scenario 4: 새 기능 추가 시 테스트 체크리스트

```bash
# 1. 기능 구현
[구현 진행]

# 2. 함수별 커버리지 확인
/coverage --function <new_module.py>

# 3. 각 함수가 100% 커버되도록 테스트 추가
# (성공 경로 + 예외 경로 모두)

# 4. 전체 프로젝트 커버리지 확인
/coverage

# 5. 기준 이상 달성 시 PR 오픈
```

---

## 🔧 기술 명세

### Python (pytest-cov)

**설정 파일**: `pytest.ini` 또는 `pyproject.toml`

```ini
[tool:pytest]
addopts = --cov=app --cov-report=html --cov-report=term-missing
testpaths = tests
```

**명령어:**
```bash
# 기본 커버리지
pytest --cov=app

# JSON 리포트 생성
pytest --cov=app --cov-report=json

# HTML 리포트
pytest --cov=app --cov-report=html
```

### Node.js (Vitest)

**설정 파일**: `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  },
});
```

**명령어:**
```bash
# 커버리지 리포트
npm run test -- --coverage

# JSON 리포트
npm run test -- --coverage --coverage.reporter=json
```

### Node.js (Jest)

**설정 파일**: `jest.config.js`

```javascript
module.exports = {
  collectCoverage: true,
  coverageReporters: ['text', 'json', 'html'],
  collectCoverageFrom: ['src/**/*.{ts,js}'],
};
```

**명령어:**
```bash
npm test -- --coverage
```

### Rust (cargo-tarpaulin)

**설치:**
```bash
cargo install cargo-tarpaulin
```

**명령어:**
```bash
# JSON 리포트
cargo tarpaulin --out Json --output-dir coverage

# 텍스트 리포트
cargo tarpaulin --out Stdout
```

### Go

**도구**: `go test` + `go-cover`

**명령어:**
```bash
# 커버리지 프로필 생성
go test -coverprofile=coverage.out ./...

# 텍스트 리포트
go tool cover -func=coverage.out

# HTML 리포트
go tool cover -html=coverage.out
```

---

## 📁 저장 구조

커버리지 데이터는 다음 위치에 저장됩니다:

```
project-root/
├── .claude/
│   ├── coverage/
│   │   ├── coverage.json         # 현재 커버리지 데이터
│   │   ├── coverage-history.json # 커버리지 변화 이력
│   │   └── coverage-report.md    # 이전 분석 리포트
│   │
│   └── cache/
│       └── coverage-cache/       # 계산 캐시
│
├── coverage/                      # 도구별 생성 디렉토리
│   ├── .coverage               # Python
│   ├── htmlcov/               # Python HTML
│   ├── lcov-report/           # JavaScript HTML
│   └── coverage.out           # Go
│
└── [tool-specific-dirs]/
```

---

## ⚠️ 주의사항

1. **캐싱 문제**: 커버리지는 이전 실행 결과를 캐시할 수 있습니다.
   ```bash
   # 캐시 초기화 후 실행
   pytest --cov=app --cov-erase
   ```

2. **제외 규칙 확인**: 설정에서 제외된 파일/디렉토리는 커버리지에서 빠집니다.
   ```bash
   # 설정 파일 확인
   grep -E "omit|exclude" pytest.ini pyproject.toml package.json
   ```

3. **병렬 테스트**: 병렬 실행 시 커버리지 결과가 부정확할 수 있습니다.
   ```bash
   # 순차 실행 권장
   pytest --cov=app -n 0
   ```

4. **생성된 코드**: 자동 생성된 코드(migrations, 프로토콜 버퍼 등)는 일반적으로 제외됩니다.

---

## 🚀 통합 예제

### 커버리지 확인 + 개선 워크플로우

```bash
# 1단계: 현재 상태 확인
/coverage
# 결과: 82% 커버리지

# 2단계: 미달 파일 식별
/coverage --threshold 80
# 결과: 3개 파일 80% 미만

# 3단계: 첫 번째 파일 분석
/coverage app/utils/validators.py --uncovered
# 결과: L12-18, L45-50 미커버

# 4단계: 테스트 추가 (개발자)
[Test 추가 작업]

# 5단계: 개선 확인
/coverage app/utils/validators.py
# 결과: 65% → 88% 개선

# 6단계: 전체 커버리지 재확인
/coverage
# 결과: 82% → 85% 달성 ✅
```

---

## 📞 도움말

### "커버리지 데이터를 찾을 수 없습니다"

```
원인: 테스트가 실행되지 않았거나 coverage 도구가 설치되지 않음

해결:
1. 테스트 설정 파일 확인: pytest.ini, package.json, Cargo.toml
2. 커버리지 도구 설치 확인:
   - Python: pip install pytest-cov
   - Node.js: npm install --save-dev @vitest/coverage-v8
   - Rust: cargo install cargo-tarpaulin
   - Go: go install github.com/mattn/goveralls@latest
3. 직접 명령어 실행: pytest --cov, npm run test -- --coverage
```

### "특정 파일의 커버리지가 0%입니다"

```
원인:
1. 파일이 제외 규칙에 포함됨
2. 파일이 임포트되지 않음 (데드 코드)
3. 테스트가 없음

확인:
1. 설정 파일의 exclude/omit 규칙 확인
2. 파일 임포트 경로 확인
3. 테스트 파일 존재 여부 확인
```

### "커버리지 트렌드가 표시되지 않습니다"

```
원인: 이전 커버리지 데이터가 없음

해결:
1. 이전 커버리지 리포트가 저장되어 있는지 확인
2. CI 환경에서 자동 저장되도록 설정
3. 초기 실행 후 7일 후 트렌드 활성화
```

---

## 💡 Best Practices

1. **정기적 확인**: 매 스프린트 종료 시 커버리지 확인
2. **목표 설정**: 도메인별로 커버리지 목표 설정 (보통 80%)
3. **트렌드 모니터링**: 커버리지 하락 추이 주시
4. **점진적 개선**: 급격한 개선보다는 꾸준한 증가 추구
5. **팀 논의**: 커버리지 목표를 팀과 함께 결정

---

## 📚 참고 자료

| 도구 | 문서 |
|------|------|
| pytest-cov | https://pytest-cov.readthedocs.io/ |
| Vitest coverage | https://vitest.dev/coverage.html |
| Jest coverage | https://jestjs.io/docs/coverage |
| cargo-tarpaulin | https://github.com/xd009642/tarpaulin |
| Go coverage | https://golang.org/doc/effective_go#testing |

---

**마지막 업데이트**: 2026-02-07
**유지보수**: Project Team Maintenance Skills
