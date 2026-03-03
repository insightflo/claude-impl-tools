# Hybrid Wave Architecture

> Multi-AI Council 합의 기반 대규모 프로젝트 아키텍처 (v2.0)
>
> **핵심 원칙**: Contract-First + Domain Parallelism + Cross-Review = 대규모 일관성

---

## 배경: 왜 기존 방식이 보수적이었나?

### 문제점 1: Integration Hell
병렬 에이전트가 각자 `utils/`, `helpers/`, `types/`를 중복 생성하여 스프린트 종료 시 대규모 재작업 발생.

### 문제점 2: Context Drift
에이전트 A의 API 변경을 에이전트 B가 인지하지 못해 런타임에서야 불일치 발견.

### 문제점 3: 복잡한 회복
병렬 실패 시 어느 지점에서 재시작해야 하는지 판단이 어려움.

---

## Hybrid Wave Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Phase 0: Shared Foundation (단일 에이전트)              │
│                                                         │
│  목적: 모든 에이전트가 준수할 계약(Contract) 확정        │
│                                                         │
│  산출물:                                                │
│  - contracts/api-contract.yaml     (API 스키마)         │
│  - contracts/type-contract.ts      (공유 타입)          │
│  - contracts/design-tokens.json    (디자인 토큰)        │
│  - contracts/domain-boundaries.md  (도메인 경계)        │
│                                                         │
│  검증: 계약 파일 존재, 모든 도메인 정의됨               │
│  소요: 전체의 ~5%                                       │
└─────────────────────────────────────────────────────────┘
                          ↓
                    계약 확정 전
                   병렬 진입 불가
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 1: Domain Parallelism (다중 에이전트)             │
│                                                         │
│  Wave 단위: 20-40 tasks                                 │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │ User    │  │ Product │  │ Order   │  ...            │
│  │ Domain  │  │ Domain  │  │ Domain  │                 │
│  │ Agent   │  │ Agent   │  │ Agent   │                 │
│  └────┬────┘  └────┬────┘  └────┬────┘                 │
│       │            │            │                       │
│       └────────────┴────────────┘                       │
│                    │                                    │
│           Mid-Wave Validation                           │
│      (계약 준수, 중복 코드 탐지)                         │
│                                                         │
│  검증: contract compliance, no duplicate utils          │
│  소요: 전체의 ~60%                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 2: Cross-Review Gate (다중 에이전트)              │
│                                                         │
│  각 도메인 에이전트가 다른 도메인 결과물 검토            │
│                                                         │
│  User Agent ──reviews──▶ Product, Order                │
│  Product Agent ──reviews──▶ User, Order                │
│  Order Agent ──reviews──▶ User, Product                │
│                                                         │
│  탐지 항목:                                             │
│  - 인터페이스 충돌                                      │
│  - 중복 코드                                           │
│  - 타입 불일치                                         │
│  - 계약 위반                                           │
│                                                         │
│  검증: cross-domain review passed, integration tests   │
│  소요: 전체의 ~20%                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 3: Integration & Polish (단일 에이전트)           │
│                                                         │
│  목적: 최종 통합 및 품질 보증                           │
│                                                         │
│  작업:                                                  │
│  - 공통 모듈 통합 (utils/, helpers/)                   │
│  - 중복 제거                                           │
│  - 최종 품질 감사 (/quality-auditor)                   │
│                                                         │
│  검증: full test suite, security scan                  │
│  소요: 전체의 ~15%                                      │
└─────────────────────────────────────────────────────────┘
```

---

## Wave vs Legacy 비교

| 관점 | Legacy (full) | Wave (v2.0) |
|------|---------------|-------------|
| 통합 충돌 | 스프린트 말 발견 | Phase 2에서 조기 탐지 |
| Context Drift | 높음 | 계약으로 방지 |
| 회복 단순성 | 복잡 | Wave 단위 재시작 |
| 병렬 효율 | 높음 | 높음 + 일관성 보장 |
| 권장 태스크 | 80+ (risky) | 80~200 (safe) |

---

## 사용법

### 1. Phase 0 실행 (계약 생성)

```bash
/orchestrate-standalone --mode=wave --phase=0
```

산출물:
```
contracts/
├── api-contract.yaml      # API 스키마 정의
├── type-contract.ts       # 공유 타입 정의
├── design-tokens.json     # 디자인 토큰
└── domain-boundaries.md   # 도메인 경계 규칙
```

### 2. Wave 실행

```bash
# 자동 Wave 실행 (Phase 1-3)
/orchestrate-standalone --mode=wave --wave-size=30

# 또는 특정 Phase만
/orchestrate-standalone --mode=wave --phase=1
```

### 3. Mid-Wave Validation (자동)

Wave 중간에 자동 실행:
- `contract-gate`: API 계약 준수 검증
- `duplicate-detector`: 중복 코드 탐지
- `type-checker`: 타입 일관성 검증

### 4. Cross-Review (Phase 2)

각 도메인 에이전트가 다른 도메인 검토:
```
User Agent reviews: Product, Order
Product Agent reviews: User, Order
Order Agent reviews: User, Product
```

---

## Contract-First 템플릿

`templates/contract-first.yaml` 참조.

주요 섹션:
1. **API Contract**: 응답 형식, 에러 코드, 네이밍 규칙
2. **Type Contract**: 공유 타입 정의
3. **Design Contract**: 색상, 간격, 타이포그래피 토큰
4. **Domain Contract**: 도메인 경계, 의존성 규칙
5. **Test Contract**: 테스트 구조, 커버리지 기준
6. **Wave Validation**: 각 Phase별 검증 항목

---

## FAQ

### Q: 언제 Wave 모드를 써야 하나요?

**A**: 80개 이상의 태스크가 있고, 여러 도메인이 병렬로 개발되어야 할 때.

- 80개 미만: `/agile auto` 또는 `/orchestrate --mode=standard`
- 80-200개: `/orchestrate --mode=wave`
- 200개 이상: 하위 프로젝트로 분할 후 각각 Wave 모드

### Q: Contract-First가 왜 필수인가요?

**A**: 병렬 에이전트가 서로 다른 가정을 하지 않도록 명시적 계약이 필요합니다.

계약 없이 병렬 실행 시:
- 에이전트 A: `user.name` (string)
- 에이전트 B: `user.fullName` (string)
→ 런타임 불일치

계약 있으면:
- 모든 에이전트: `contracts/type-contract.ts`의 `User.name` 사용
→ 일관성 보장

### Q: Mid-Wave Validation이 뭔가요?

**A**: Wave 종료가 아닌 **중간에** 실행되는 검증입니다.

기존: 스프린트 종료 → 통합 → 문제 발견 → 재작업
Wave: 중간 검증 → 조기 발견 → 즉시 수정 → 계속 진행

---

## Multi-AI Council 합의 요약

**Codex**:
> "대규모=무조건 agile 반복이 아니라, **병렬 + 계약 중심 통합 거버넌스**"

**Gemini**:
> "병렬 작업 전의 강력한 표준화(Contract First)와 병렬 작업 후의 자동화된 통합 테스트가 전제되어야 합니다"

**Chairman 결론**:
> Contract-First + Wave 단위 병렬 + 중간 검증이 갖춰지면, 대규모 프로젝트에서도 병렬 접근이 더 높은 완성도를 달성할 수 있습니다.

---

**Last Updated**: 2026-03-03 (v2.0.0)
