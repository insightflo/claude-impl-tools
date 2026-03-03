# Impact Analyzer - Usage Examples

> 이 파일은 `/impact` 스킬의 사용 예시입니다.

---

## 예시 1: 서비스 파일 분석

```
> /impact src/services/user_service.py

===========================================================
  Impact Analysis: user_service.py
===========================================================

  Risk Level: HIGH
  Service/core/middleware layer - business logic changes
  may affect multiple consumers. Run related test suites.

-----------------------------------------------------------
  Direct Dependents (이 파일을 import하는 곳)
-----------------------------------------------------------
  - src/api/routes/user.py:L5
  - src/api/routes/admin.py:L8
  - src/services/order_service.py:L12

-----------------------------------------------------------
  Indirect Dependents (API 호출 관계)
-----------------------------------------------------------
  - [GET /api/users/{id}] frontend/pages/profile.tsx
  - [POST /api/users] frontend/pages/register.tsx

-----------------------------------------------------------
  Affected Domains
-----------------------------------------------------------
  - user (직접)
  - order (간접 - order_service가 user_service를 import)

-----------------------------------------------------------
  Related Tests
-----------------------------------------------------------
  - tests/services/test_user_service.py
  - tests/api/test_user_routes.py

-----------------------------------------------------------
  Recommended Actions
-----------------------------------------------------------
  1. 테스트 실행:
     $ pytest tests/services/test_user_service.py tests/api/test_user_routes.py -v --cov=src/services
  2. 리뷰어: user Part Leader
  3. order 도메인에 변경 사항 공유 권장 (교차 의존성)

  [CAUTION] HIGH risk area.
  Run full test suite for affected modules before proceeding.

===========================================================
```

---

## 예시 2: 결제 관련 파일 분석 (CRITICAL)

```
> /impact src/api/routes/payment.py

===========================================================
  Impact Analysis: payment.py
===========================================================

  Risk Level: CRITICAL
  Payment/billing/auth/security area - financial or security
  impact. Requires thorough review and full test coverage.

-----------------------------------------------------------
  Direct Dependents (이 파일을 import하는 곳)
-----------------------------------------------------------
  - src/main.py:L22 (router include)

-----------------------------------------------------------
  Indirect Dependents (API 호출 관계)
-----------------------------------------------------------
  - [POST /api/payments] frontend/pages/checkout.tsx
  - [POST /api/payments] mobile/screens/PaymentScreen.tsx
  - [GET /api/payments/{id}] frontend/pages/order-detail.tsx

-----------------------------------------------------------
  Affected Domains
-----------------------------------------------------------
  - payment (직접)
  - order (간접 - checkout 플로우 연관)

-----------------------------------------------------------
  Related Tests
-----------------------------------------------------------
  - tests/api/test_payment.py
  - tests/integration/test_payment_flow.py

-----------------------------------------------------------
  Recommended Actions
-----------------------------------------------------------
  1. 테스트 실행:
     $ pytest tests/api/test_payment.py tests/integration/test_payment_flow.py -v --cov=src/api/routes
  2. 리뷰어: QA Manager, Chief Architect
  3. 결제 관련 수정은 통합 테스트까지 반드시 실행

-----------------------------------------------------------
  [WARNING] CRITICAL Risk Area
-----------------------------------------------------------
  금융/보안 핵심 영역입니다.

  필수 확인 사항:
  [ ] 변경 사유가 명확한가?
  [ ] 영향 범위를 모두 파악했는가?
  [ ] 테스트 케이스가 준비되었는가?
  [ ] 롤백 계획이 있는가?

  필수 리뷰어: QA Manager, Chief Architect

===========================================================
```

---

## 예시 3: 테스트 파일 분석 (LOW)

```
> /impact tests/services/test_user_service.py

===========================================================
  Impact Analysis: test_user_service.py
===========================================================

  Risk Level: LOW
  Tests/utils/config/docs area - low blast radius.
  Standard review applies.

-----------------------------------------------------------
  Direct Dependents (이 파일을 import하는 곳)
-----------------------------------------------------------
  None found

-----------------------------------------------------------
  Indirect Dependents (API 호출 관계)
-----------------------------------------------------------
  None found

-----------------------------------------------------------
  Affected Domains
-----------------------------------------------------------
  - user (테스트)

-----------------------------------------------------------
  Related Tests
-----------------------------------------------------------
  (이 파일 자체가 테스트 파일입니다)

-----------------------------------------------------------
  Recommended Actions
-----------------------------------------------------------
  1. 테스트 실행:
     $ pytest tests/services/test_user_service.py -v
  2. 리뷰어: 일반 코드 리뷰
  3. 테스트 수정 시 대상 소스 파일의 동작이 변경되지 않았는지 확인

===========================================================
```
