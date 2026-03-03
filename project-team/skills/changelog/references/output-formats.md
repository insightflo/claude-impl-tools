# Changelog Viewer - Output Formats

> 이 파일은 `/changelog` 스킬의 출력 형식 상세 정의입니다.

---

## 기본 리포트 (변경 이력 목록)

```
===========================================================
  Changelog: <필터 설명>
===========================================================

  Period: <시작일> ~ <종료일>
  Total: <N건>

-----------------------------------------------------------
  2026-02-07 (3건)
-----------------------------------------------------------
  [Feature] Create discount_service in order
     domain: order
     files:  order/services/discount_service.py
             order/schemas/discount.py
     impact: external dependency added: member-api

  [Fix] Fix issue in payment_service
     domain: payment
     files:  payment/services/payment_service.py
     impact: none

  [Refactor] Refactor order_service
     domain: order
     files:  order/services/order_service.py
     impact: none

-----------------------------------------------------------
  2026-02-06 (1건)
-----------------------------------------------------------
  [Test] Update test test_discount.py
     domain: order
     files:  tests/order/test_discount.py
     impact: none

===========================================================
```

---

## 도메인 필터 리포트

```
===========================================================
  Changelog: order domain
===========================================================

  Period: 2026-02-01 ~ 2026-02-07
  Total: 5건 (order domain)

-----------------------------------------------------------
  2026-02-07 (2건)
-----------------------------------------------------------
  [Feature] Create discount_service in order
     files:  order/services/discount_service.py
     impact: external dependency added: member-api

  [Refactor] Refactor order_service
     files:  order/services/order_service.py
     impact: none

===========================================================
```

---

## 통계 리포트 (`--stats`)

```
===========================================================
  Changelog Statistics
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

-----------------------------------------------------------
  Most Changed Files (Top 5)
-----------------------------------------------------------
  1. order/services/discount_service.py    (4 changes)
  2. payment/services/payment_service.py   (3 changes)
  3. order/api/router.py                   (2 changes)

===========================================================
```

---

## 파일 필터 리포트

```
===========================================================
  Changelog: discount_service.py
===========================================================

  Period: all available
  Total: 4건 (file: discount_service.py)

-----------------------------------------------------------
  Change History
-----------------------------------------------------------
  2026-02-07T14:30  [Feature] Create discount_service in order
  2026-02-06T10:15  [Refactor] Refactor discount_service
  2026-02-05T16:45  [Fix] Fix issue in discount_service
  2026-02-03T09:00  [Feature] Add new functionality

===========================================================
```

---

## 변경 이력이 없을 때

```
===========================================================
  Changelog: <필터 설명>
===========================================================

  No changes found.

  Possible reasons:
  - changelog-recorder.js 훅이 아직 실행되지 않았습니다
  - .claude/changelog/ 디렉토리에 YAML 파일이 없습니다
  - 필터 조건에 해당하는 변경 이력이 없습니다

  Tip: 소스 파일을 수정하면 훅이 자동으로 변경 이력을 기록합니다.

===========================================================
```

---

## YAML 엔트리 형식

`changelog-recorder.js`가 생성하는 YAML 형식:

```yaml
entries:
  - date: 2026-02-07T14:30:00
    type: feature
    domain: order
    files:
      - order/services/discount_service.py
      - order/schemas/discount.py
    description: "Create discount_service in order"
    impact:
      - "external dependency added: member-api"
```

---

## 통계 계산 방법

### 막대 그래프 표현

```
최대값 = 가장 건수가 많은 항목
최대 막대 길이 = 12자 (#)
각 항목의 막대 = round(건수 / 최대값 * 12)
최소 1자 보장 (건수 > 0이면)
```
