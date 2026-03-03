# Architecture Map - Usage Examples

> 이 파일은 `/architecture` 스킬의 사용 예시입니다.

---

## 예시 1: 전체 아키텍처 개요

```
> /architecture

===========================================================
  Architecture Overview
===========================================================

  Project: my-commerce
  Generated: 2026-02-11 14:30

-----------------------------------------------------------
  Domain Map (Mermaid)
-----------------------------------------------------------

  ```mermaid
  graph TB
    subgraph "Project Architecture"
      member["Member<br/>Files: 12, APIs: 5"]
      order["Order<br/>Files: 18, APIs: 12"]
      product["Product<br/>Files: 8, APIs: 6"]
      payment["Payment<br/>Files: 10, APIs: 4"]
      auth["Auth<br/>Files: 6, APIs: 3"]
    end

    order -->|"API 2, import 3"| member
    order -->|"API 2"| product
    order -->|"import 1"| payment
    payment -->|"API 1"| order
    member -->|"import 1"| auth

    style member fill:#4CAF50,color:#fff
    style product fill:#4CAF50,color:#fff
    style auth fill:#4CAF50,color:#fff
    style order fill:#FF9800,color:#fff
  ```

-----------------------------------------------------------
  Domain Summary
-----------------------------------------------------------

  | Domain  | Files | APIs | Dependencies    | Role             |
  |---------|-------|------|-----------------|------------------|
  | auth    | 6     | 3    | none            | Core (stable)    |
  | member  | 12    | 5    | auth            | Core (stable)    |
  | product | 8     | 6    | none            | Core (stable)    |
  | order   | 18    | 12   | member, product | Business Logic   |
  | payment | 10    | 4    | order           | Business Logic   |

-----------------------------------------------------------
  API Summary
-----------------------------------------------------------

  Total Endpoints: 30
  | Method | Count |
  |--------|-------|
  | GET    | 14    |
  | POST   | 9     |
  | PUT    | 4     |
  | DELETE | 3     |

-----------------------------------------------------------
  Tech Stack (Top)
-----------------------------------------------------------

  | Category   | Technology           |
  |------------|----------------------|
  | Language   | Python 3.14          |
  | Framework  | FastAPI              |
  | ORM        | SQLAlchemy 2.0       |
  | Database   | PostgreSQL           |
  | Test       | pytest               |

  Tip: Use /architecture <subcommand> for details
  - /architecture domains  -> Domain structure
  - /architecture api      -> API catalog
  - /architecture layers   -> Layer structure
  - /architecture tech     -> Full tech stack

===========================================================
```

---

## 예시 2: 도메인 구조

```
> /architecture domains

===========================================================
  Domain Structure
===========================================================

  Domains Found: 5
  Total Files: 54
  Domain Detection: domains/<name>/ pattern

-----------------------------------------------------------
  Domain Dependency Diagram (Mermaid)
-----------------------------------------------------------

  ```mermaid
  graph LR
    auth["Auth<br/>6 files"]
    member["Member<br/>12 files"]
    product["Product<br/>8 files"]
    order["Order<br/>18 files"]
    payment["Payment<br/>10 files"]

    member -->|"1 ref"| auth
    order -->|"5 refs"| member
    order -->|"3 refs"| product
    order -->|"2 refs"| payment
    payment -->|"1 ref"| order

    style auth fill:#4CAF50,color:#fff
    style product fill:#4CAF50,color:#fff
  ```

-----------------------------------------------------------
  Cross-Domain Dependencies
-----------------------------------------------------------

  | Source  | Target  | Refs | Type         |
  |---------|---------|------|--------------|
  | order   | member  | 5    | API + import |
  | order   | product | 3    | API          |
  | order   | payment | 2    | import       |
  | payment | order   | 1    | API          |
  | member  | auth    | 1    | import       |

===========================================================
```

---

## 예시 3: 특정 도메인 상세

```
> /architecture order

===========================================================
  Domain Detail: order
===========================================================

  Domain: order
  Path: src/domains/order/
  Files: 18
  APIs: 12

-----------------------------------------------------------
  Directory Structure
-----------------------------------------------------------

  order/
  +-- api/
  |   +-- router.py            (route, 6 endpoints)
  |   +-- cart_router.py       (route, 6 endpoints)
  +-- services/
  |   +-- order_service.py     (service, core logic)
  |   +-- discount_service.py  (service, calculation)
  +-- models/
  |   +-- order.py             (model, SQLAlchemy)
  |   +-- order_item.py        (model, SQLAlchemy)
  |   +-- cart.py              (model, SQLAlchemy)
  +-- schemas/
  |   +-- order_schema.py      (schema, Pydantic)
  |   +-- cart_schema.py       (schema, Pydantic)
  +-- repositories/
  |   +-- order_repository.py  (repository, CRUD)
  |   +-- cart_repository.py   (repository, CRUD)
  +-- tests/
      +-- test_order.py        (test, 15 cases)
      +-- test_cart.py         (test, 10 cases)

-----------------------------------------------------------
  API Endpoints
-----------------------------------------------------------

  | Method | Path                 | Handler         |
  |--------|----------------------|-----------------|
  | GET    | /api/orders          | list_orders     |
  | GET    | /api/orders/{id}     | get_order       |
  | POST   | /api/orders          | create_order    |
  | PUT    | /api/orders/{id}     | update_order    |
  | DELETE | /api/orders/{id}     | cancel_order    |
  | POST   | /api/orders/{id}/pay | process_payment |

-----------------------------------------------------------
  External Dependencies (Outgoing)
-----------------------------------------------------------

  | Target Domain | Ref Type | Details                          |
  |---------------|----------|----------------------------------|
  | member        | API      | GET /api/members/{id} (grade)    |
  | member        | import   | member.models.User               |
  | product       | API      | GET /api/products/{id} (price)   |
  | payment       | import   | payment.services.process_payment |

-----------------------------------------------------------
  Dependents (Incoming)
-----------------------------------------------------------

  | Source Domain | Ref Type | Details                          |
  |---------------|----------|----------------------------------|
  | payment       | API      | GET /api/orders/{id}             |
  | notification  | import   | order.events.ORDER_CREATED       |

===========================================================
```

---

## 예시 4: 기술 스택

```
> /architecture tech

===========================================================
  Technology Stack
===========================================================

  Project: my-commerce
  Detected: 2026-02-11

-----------------------------------------------------------
  Core Stack
-----------------------------------------------------------

  | Category         | Technology        | Version   | Config File        |
  |------------------|-------------------|-----------|--------------------|
  | Language          | Python            | 3.14      | pyproject.toml     |
  | Framework         | FastAPI           | 0.115.x   | pyproject.toml     |
  | ORM               | SQLAlchemy        | 2.0.x     | pyproject.toml     |
  | Database          | PostgreSQL        | 16.x      | docker-compose.yml |
  | Validation        | Pydantic          | 2.x       | pyproject.toml     |

-----------------------------------------------------------
  Development Tools
-----------------------------------------------------------

  | Category         | Technology        |
  |------------------|-------------------|
  | Test Framework    | pytest            |
  | Linter            | ruff              |
  | Type Checker      | mypy              |
  | Package Manager   | pip               |

-----------------------------------------------------------
  Infrastructure
-----------------------------------------------------------

  | Category         | Technology        |
  |------------------|-------------------|
  | Container         | Docker            |
  | Orchestration     | Docker Compose    |
  | CI/CD             | GitHub Actions    |
  | Cache             | Redis             |

-----------------------------------------------------------
  File Distribution
-----------------------------------------------------------

  | Extension | Count | Percentage |
  |-----------|-------|------------|
  | .py       | 85    | 62%        |
  | .ts       | 30    | 22%        |
  | .yaml     | 12    | 9%         |
  | .md       | 10    | 7%         |

===========================================================
```
