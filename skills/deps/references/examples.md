# Dependency Graph - Usage Examples

> 이 파일은 `/deps` 스킬의 사용 예시입니다.

---

## 예시 1: 전체 도메인 의존성 분석

```
> /deps

===========================================================
  Dependency Graph: Full Project
===========================================================

  Scope: 전체 프로젝트
  Domains Found: 5개 (order, member, product, payment, auth)
  Total Cross-Domain Dependencies: 8개
  Circular Dependencies: 없음

-----------------------------------------------------------
  Mermaid Diagram
-----------------------------------------------------------

  ```mermaid
  graph LR
    order["Order<br/>(Ca:1, Ce:3, I:0.75)"]
    member["Member<br/>(Ca:2, Ce:1, I:0.33)"]
    product["Product<br/>(Ca:2, Ce:0, I:0.00)"]
    payment["Payment<br/>(Ca:1, Ce:2, I:0.67)"]
    auth["Auth<br/>(Ca:3, Ce:0, I:0.00)"]

    order -->|"API 2"| member
    order -->|"API 2"| product
    order -->|"import 1"| auth
    payment -->|"API 1"| order
    payment -->|"import 1"| auth
    member -->|"import 1"| auth

    style product fill:#4CAF50,color:#fff
    style auth fill:#4CAF50,color:#fff
  ```

-----------------------------------------------------------
  Domain Summary
-----------------------------------------------------------

  | Domain   | Ca | Ce | I    | Grade    | Assessment           |
  |----------|----|----|------|----------|----------------------|
  | auth     | 3  | 0  | 0.00 | Loose    | 가장 안정적 (기반 모듈) |
  | product  | 2  | 0  | 0.00 | Loose    | 안정적 (순수 도메인)    |
  | member   | 2  | 1  | 0.33 | Loose    | 안정적                 |
  | payment  | 1  | 2  | 0.67 | Moderate | 보통 (의존성 관리 필요)  |
  | order    | 1  | 3  | 0.75 | Moderate | 높은 의존성 (핵심 도메인) |

  [Architecture Health: GOOD]
  순환 의존성 없음. 결합도가 관리 가능한 수준입니다.

===========================================================
```

---

## 예시 2: 특정 도메인 의존성 (`/deps show order`)

```
> /deps show order

===========================================================
  Dependency Graph: Order Domain
===========================================================

  Order 도메인 의존성:

-----------------------------------------------------------
  [의존하는 것] (Order가 사용하는 외부 의존성)
-----------------------------------------------------------
  +-- member (API 2개)
  |   +-- GET /members/{id} - 회원 정보 조회
  |   +-- GET /members/{id}/grade - 등급 조회
  +-- product (API 2개)
  |   +-- GET /products/{id} - 상품 정보 조회
  |   +-- PATCH /products/{id}/stock - 재고 차감
  +-- auth (import 1개)
      +-- auth.utils.token.verify_token - 토큰 검증

-----------------------------------------------------------
  [의존받는 것] (Order를 사용하는 외부 의존성)
-----------------------------------------------------------
  +-- payment (API 1개)
      +-- GET /orders/{id} - 주문 확인

-----------------------------------------------------------
  Metrics
-----------------------------------------------------------
  Afferent Coupling (Ca): 1
  Efferent Coupling (Ce): 3
  Instability (I): 0.75
  Grade: Moderate

===========================================================
```

---

## 예시 3: 순환 의존성 감지

```
> /deps --cycles

===========================================================
  Circular Dependency Report
===========================================================

  Total Cycles Found: 0

  순환 의존성이 발견되지 않았습니다.
  아키텍처가 건전한 상태입니다.

===========================================================
```

---

## 예시 4: 파일 의존성 트리

```
> /deps src/services/order_service.py --tree

===========================================================
  Dependency Tree: order_service.py
===========================================================

  [이 파일이 의존하는 것] (Outgoing)
  order_service.py
  +-- member.services.member_service (member)
  |   +-- member.models.member (member)
  |   +-- auth.utils.token (auth)
  +-- product.services.product_service (product)
  |   +-- product.models.product (product)
  +-- order.models.order (order - 내부)

  [이 파일에 의존하는 것] (Incoming)
  order_service.py
  +-- order.api.routes.order_router (order - 내부)
  +-- payment.services.checkout_service (payment)

  Tree Depth: 2 levels
  Total Unique Dependencies: 8 files
  Cross-Domain References: 4 (member: 2, product: 1, payment: 1)

===========================================================
```

---

## 예시 5: 도메인 간 매트릭스

```
> /deps --matrix

===========================================================
  Cross-Domain Dependency Matrix
===========================================================

  |          | order | member | product | payment | auth |
  |----------|-------|--------|---------|---------|------|
  | order    |   -   |   2    |    2    |    0    |  1   |
  | member   |   0   |   -    |    0    |    0    |  1   |
  | product  |   0   |   0    |    -    |    0    |  0   |
  | payment  |   1   |   0    |    0    |    -    |  1   |
  | auth     |   0   |   0    |    0    |    0    |  -   |

  Hotspots:
  1. order -> member (2): 가장 높은 결합도
  2. order -> product (2): 동일 수준

  Isolated:
  - product: 외부 의존성 없음 (Ce=0)
  - auth: 외부 의존성 없음 (Ce=0)

===========================================================
```
