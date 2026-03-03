---
name: deps
description: 프로젝트 의존성 그래프를 시각화하고 순환 의존성을 감지합니다. 리팩토링 전, 아키텍처 리뷰 시, 새 도메인 추가 시, 모듈 분리 검토 시 반드시 사용하세요. 도메인 간 결합도가 높아지거나 순환 참조가 의심될 때 즉시 실행하세요. /deps, "의존성 그래프", "순환 의존성 확인" 트리거.
version: 1.1.0
updated: 2026-02-11
---

# Dependency Graph (의존성 그래프 분석)

> **프로젝트의 의존성 관계를 시각화하고, 순환 의존성을 감지하며, 도메인 간 결합도를 분석합니다.**

---

## 스킬 발동 조건

- `/deps` - 전체 도메인 의존성 분석
- `/deps <도메인>` - 특정 도메인 의존성
- `/deps --cycles` - 순환 의존성만 감지
- `/deps <파일> --tree` - 파일 의존성 트리
- `/deps --matrix` - 도메인 간 매트릭스
- "의존성 그래프 보여줘"
- "순환 의존성 있는지 확인해줘"

---

## 절대 금지 사항

1. **코드를 직접 수정하지 마세요** - 분석 전용입니다.
2. **추측으로 의존성을 판단하지 마세요** - 반드시 실제 import/require를 파싱하세요.
3. **순환 의존성을 무시하지 마세요** - 발견 시 반드시 보고하세요.

---

## 실행 단계

```
/deps [대상] [옵션] 수신
    |
    v
[1] 대상 범위 결정 (Scope Resolution)
    |
    v
[2] 도메인 구조 탐색 (Domain Discovery)
    |
    v
[3] Import/Require 파싱 (Dependency Extraction)
    |
    v
[4] 의존성 그래프 구축 (Graph Construction)
    |
    v
[5] 순환 의존성 감지 (Cycle Detection)
    |
    v
[6] 도메인 간 결합도 분석 (Cross-Domain Analysis)
    |
    v
[7] 결과 출력
```

---

### 1단계: 대상 범위 결정

| 입력 | 범위 |
|------|------|
| (없음) | 프로젝트 전체 도메인 |
| 도메인명 | 해당 도메인 내부 + 외부 의존성 |
| 파일 + `--tree` | 파일의 의존성 트리 |

### 2단계: 도메인 구조 탐색

**도메인 식별 기준 (우선순위 순):**

1. `.claude/project-team.yaml`의 `domains` 정의
2. `domains/<도메인명>/` 디렉토리
3. `src/<도메인명>/` 디렉토리
4. 최상위 의미 있는 디렉토리

**레이어 vs 도메인 구분:**

- 레이어 (도메인 아님): `api/`, `services/`, `models/`, `utils/`
- 도메인 (분석 대상): `order/`, `member/`, `product/`, `payment/`

### 3단계: Import/Require 파싱

| 언어 | 패턴 |
|------|------|
| Python | `from x.y import z`, `import x.y` |
| JS/TS | `import ... from '...'`, `require('...')` |
| Go | `import "..."` |

```bash
# Python
grep -rn "^from \|^import " --include="*.py" <대상경로>

# JS/TS
grep -rn "import.*from\|require(" --include="*.ts" --include="*.js" <대상경로>
```

### 4단계: 의존성 그래프 구축

```
노드 (Node): 도메인 또는 모듈
엣지 (Edge): 의존 관계 (방향 있음)
  - from: 의존하는 쪽
  - to: 의존받는 쪽
  - weight: import 개수
```

### 5단계: 순환 의존성 감지 (DFS 기반)

| 레벨 | 설명 | 심각도 |
|------|------|--------|
| 도메인 레벨 | A -> B -> A | CRITICAL |
| 모듈 레벨 | A -> B -> C -> A | HIGH |
| 파일 레벨 | A <-> B | MEDIUM |

### 6단계: 결합도 분석

| 지표 | 설명 | 계산 |
|------|------|------|
| Ca (Afferent) | 들어오는 의존성 수 | 이 도메인에 의존하는 외부 도메인 수 |
| Ce (Efferent) | 나가는 의존성 수 | 이 도메인이 의존하는 외부 도메인 수 |
| I (Instability) | 불안정성 | Ce / (Ca + Ce) |

| 등급 | 교차 의존 수 | 평가 |
|------|-------------|------|
| Loose | 0-2개 | 건전 |
| Moderate | 3-5개 | 관리 가능 |
| Tight | 6-10개 | 리팩토링 검토 |
| Tangled | 11+ | 리팩토링 필수 |

### 7단계: 결과 출력

상세 출력 형식은 `references/output-formats.md`를 참조하세요.

---

## 아키텍처 파일 생성

분석 결과를 `.claude/architecture/dependencies/`에 저장합니다:

- `domain-graph.mmd` - Mermaid 다이어그램
- `module-graph.json` - 모듈 레벨 의존성
- `api-graph.json` - API 호출 관계

---

## Impact 스킬과의 관계

| 구분 | `/impact` | `/deps` |
|------|-----------|---------|
| 분석 단위 | 단일 파일 | 도메인/프로젝트 전체 |
| 주요 출력 | 영향도 리포트 | Mermaid 다이어그램 |
| 핵심 기능 | 변경 영향 범위 | 순환 의존성, 결합도 |
| 용도 | 수정 전 분석 | 아키텍처 리뷰 |

---

## 관련 스킬 연동

| 스킬 | 연동 시점 | 용도 |
|------|-----------|------|
| `/impact <file>` | 순환 의존성 발견 시 | 파일 영향도 확인 |
| `/changelog <domain>` | 의존성 변경 시 | 최근 변경 이력 |
| `/architecture` | 전체 분석 후 | 아키텍처 문서 업데이트 |

---

## 참조 문서

- `references/output-formats.md` - 출력 형식 상세
- `references/examples.md` - 사용 예시
