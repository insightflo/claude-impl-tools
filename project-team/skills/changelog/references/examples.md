# Changelog Viewer - Usage Examples

> 이 파일은 `/changelog` 스킬의 사용 예시입니다.

---

## 예시 1: 기본 조회

```
> /changelog

===========================================================
  Changelog: February 2026
===========================================================

  Period: 2026-02-01 ~ 2026-02-07
  Total: 15건

-----------------------------------------------------------
  2026-02-07 (3건)
-----------------------------------------------------------
  [Feature] Create discount_service in order
     domain: order
     files:  order/services/discount_service.py
     impact: external dependency added: member-api

  [Fix] Fix issue in payment_service
     domain: payment
     files:  payment/services/payment_service.py
     impact: none

  [Refactor] Refactor order_service
     domain: order
     files:  order/services/order_service.py
     impact: none

  ... (12건 더)

===========================================================
```

---

## 예시 2: 도메인 + 기간 필터

```
> /changelog --domain order --last 7d

===========================================================
  Changelog: order domain (last 7 days)
===========================================================

  Period: 2026-02-01 ~ 2026-02-07
  Total: 5건 (order domain)

-----------------------------------------------------------
  2026-02-07 (2건)
-----------------------------------------------------------
  [Feature] Create discount_service in order
     files:  order/services/discount_service.py
             order/schemas/discount.py
     impact: external dependency added: member-api

  [Refactor] Refactor order_service
     files:  order/services/order_service.py
     impact: none

-----------------------------------------------------------
  2026-02-05 (3건)
-----------------------------------------------------------
  [Feature] Add new functionality to order_api in order
     files:  order/api/router.py
     impact: API endpoint modification

  [Fix] Fix issue in order_validator
     files:  order/validators/order_validator.py
     impact: none

  [Test] Add test file test_order_api.py
     files:  tests/order/test_order_api.py
     impact: none

===========================================================
```

---

## 예시 3: 버그 수정 이력만 조회

```
> /changelog --type fix

===========================================================
  Changelog: fix changes (February 2026)
===========================================================

  Period: 2026-02-01 ~ 2026-02-07
  Total: 6건 (type: fix)

-----------------------------------------------------------
  2026-02-07
-----------------------------------------------------------
  [Fix] Fix issue in payment_service
     domain: payment
     files:  payment/services/payment_service.py
     impact: none

-----------------------------------------------------------
  2026-02-05
-----------------------------------------------------------
  [Fix] Fix issue in order_validator
     domain: order
     files:  order/validators/order_validator.py
     impact: none

  [Fix] Fix issue in auth_middleware
     domain: auth
     files:  src/middleware/auth_middleware.py
     impact: API endpoint modification

  ... (3건 더)

===========================================================
```

---

## 예시 4: 변경 통계

```
> /changelog --stats

===========================================================
  Changelog Statistics (February 2026)
===========================================================

  Period: 2026-02-01 ~ 2026-02-07
  Total changes: 24건

-----------------------------------------------------------
  By Domain
-----------------------------------------------------------
  order       ############ 12건 (50.0%)
  payment     ######       6건 (25.0%)
  auth        ###          3건 (12.5%)
  root        ##           2건 ( 8.3%)
  member      #            1건 ( 4.2%)

-----------------------------------------------------------
  By Type
-----------------------------------------------------------
  feature     ############ 12건 (50.0%)
  fix         ######       6건 (25.0%)
  refactor    ###          3건 (12.5%)
  test        ##           2건 ( 8.3%)
  docs        #            1건 ( 4.2%)

-----------------------------------------------------------
  By Day
-----------------------------------------------------------
  02-07       ########     8건
  02-06       #####        5건
  02-05       ####         4건
  02-04       ###          3건
  02-03       ##           2건
  02-02       #            1건
  02-01       #            1건

-----------------------------------------------------------
  Most Changed Files (Top 5)
-----------------------------------------------------------
  1. order/services/discount_service.py    (4 changes)
  2. payment/services/payment_service.py   (3 changes)
  3. order/api/router.py                   (2 changes)
  4. src/middleware/auth_middleware.py     (2 changes)
  5. order/schemas/discount.py             (1 change)

===========================================================
```

---

## 예시 5: 도메인별 통계

```
> /changelog --domain payment --stats

===========================================================
  Changelog Statistics: payment domain
===========================================================

  Period: 2026-02-01 ~ 2026-02-07
  Total changes: 6건 (payment domain)

-----------------------------------------------------------
  By Type
-----------------------------------------------------------
  fix         ###          3건 (50.0%)
  feature     ##           2건 (33.3%)
  refactor    #            1건 (16.7%)

-----------------------------------------------------------
  By Day
-----------------------------------------------------------
  02-07       ##           2건
  02-06       ##           2건
  02-05       #            1건
  02-03       #            1건

-----------------------------------------------------------
  Most Changed Files (Top 3)
-----------------------------------------------------------
  1. payment/services/payment_service.py   (3 changes)
  2. payment/api/router.py                 (2 changes)
  3. payment/models/transaction.py         (1 change)

===========================================================
```

---

## 예시 6: 특정 파일의 변경 이력

```
> /changelog --file discount_service.py

===========================================================
  Changelog: discount_service.py
===========================================================

  Period: all available
  Total: 4건 (file: discount_service.py)

-----------------------------------------------------------
  Change History
-----------------------------------------------------------
  2026-02-07T14:30  [Feature] Create discount_service in order
                    impact: external dependency added: member-api

  2026-02-06T10:15  [Refactor] Refactor discount_service
                    impact: none

  2026-02-05T16:45  [Fix] Fix issue in discount_service
                    impact: none

  2026-02-03T09:00  [Feature] Add new functionality to discount_service
                    impact: internal dependency added: order.models

===========================================================
```
