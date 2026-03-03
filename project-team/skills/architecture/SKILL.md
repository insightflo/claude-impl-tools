---
name: architecture
description: 프로젝트 아키텍처를 조회하고 시각화합니다. 프로젝트 온보딩 시, 코드 리뷰 전, 신규 도메인 추가 전, 기술 스택 확인 시 사용하세요. "전체 구조", "API 목록", "기술 스택", "도메인 구조" 질문에 응답합니다. /architecture 트리거.
version: 1.1.0
updated: 2026-02-11
---

# Architecture Map (아키텍처 맵 조회)

> **프로젝트의 전체 아키텍처를 조회하고 시각화합니다. 도메인 구조, API 카탈로그, 레이어 구조, 기술 스택을 한눈에 파악할 수 있습니다.**

---

## 스킬 발동 조건

- `/architecture` - 전체 아키텍처 개요
- `/architecture domains` - 도메인 구조
- `/architecture api` - API 카탈로그
- `/architecture layers` - 레이어별 구조
- `/architecture tech` - 기술 스택
- `/architecture <도메인명>` - 특정 도메인 상세
- "아키텍처 보여줘"
- "전체 구조 파악"
- "API 목록"

---

## 절대 금지 사항

1. **코드를 직접 수정하지 마세요** - 조회/시각화 전용입니다.
2. **추측으로 구조를 판단하지 마세요** - 실제 파일 시스템을 기반으로 분석하세요.
3. **아키텍처 문서를 직접 수정하지 마세요** - `architecture-updater.js` 훅의 책임입니다.

---

## 실행 단계

```
/architecture [서브커맨드] 수신
    |
    v
[1] 서브커맨드 파싱
    |
    v
[2] 기존 아키텍처 문서 확인 (.claude/architecture/)
    |
    v
[3] 프로젝트 구조 탐색
    |
    v
[4] 서브커맨드별 분석
    |
    +--> overview: 전체 아키텍처 개요
    +--> domains: 도메인 구조
    +--> api: API 엔드포인트
    +--> layers: 레이어 구조
    +--> tech: 기술 스택
    +--> <도메인명>: 도메인 상세
    |
    v
[5] 시각화 출력
```

---

## 서브커맨드

| 서브커맨드 | 설명 |
|-----------|------|
| (없음) | 전체 아키텍처 개요 |
| `domains` | 도메인 구조 + Mermaid 다이어그램 |
| `api` | API 엔드포인트 카탈로그 |
| `layers` | 레이어별 구조 + 위반 감지 |
| `tech` | 기술 스택 자동 감지 |
| `<도메인명>` | 특정 도메인 상세 분석 |

---

## 도메인 탐색 패턴

| 패턴 | 예시 |
|------|------|
| `src/domains/<name>/` | `src/domains/member/` |
| `domains/<name>/` | `domains/order/` |
| `packages/<name>/` | `packages/auth/` |
| `modules/<name>/` | `modules/payment/` |

**레이어 vs 도메인 구분:**

- 레이어 (도메인 아님): `api/`, `services/`, `models/`, `utils/`
- 도메인 (분석 대상): `order/`, `member/`, `product/`

---

## 레이어 식별 패턴

| 레이어 | 디렉토리 패턴 |
|--------|-------------|
| API/Route | `api/`, `routes/`, `controllers/` |
| Service | `services/`, `usecases/` |
| Model/Entity | `models/`, `entities/` |
| Schema | `schemas/`, `dto/` |
| Repository | `repositories/`, `dao/` |
| Infrastructure | `infrastructure/`, `adapters/` |
| Test | `tests/`, `__tests__/` |

---

## 기술 스택 감지

| 카테고리 | 감지 소스 |
|----------|----------|
| 언어 | 파일 확장자 분포 |
| 프레임워크 | 설정 파일, import 패턴 |
| DB | 설정 파일, ORM import |
| 인프라 | Docker, K8s 설정 파일 |
| CI/CD | 워크플로우 파일 |

```bash
# 설정 파일 확인
cat package.json pyproject.toml requirements.txt 2>/dev/null | head -30

# 인프라 설정
ls Dockerfile docker-compose*.yml .github/workflows/ 2>/dev/null
```

---

## 데이터 소스 우선순위

| 우선순위 | 소스 |
|---------|------|
| 1 | `.claude/architecture/*.md` (훅 생성 문서) |
| 2 | `.claude/project-team.yaml` (프로젝트 설정) |
| 3 | 실시간 파일 시스템 스캔 |

---

## Hook 연동

| 구분 | Hook (`architecture-updater.js`) | Skill (`/architecture`) |
|------|----------------------------------|------------------------|
| 시점 | Write/Edit 후 자동 실행 | 사용자 요청 시 |
| 범위 | 변경된 파일 기준 증분 | 전체 또는 서브커맨드별 |
| 출력 | 문서 자동 갱신 | 대화형 시각화 |
| 용도 | 문서 유지 | 아키텍처 이해 |

---

## 관련 스킬 연동

| 스킬 | 연동 시점 | 용도 |
|------|-----------|------|
| `/deps` | 전체 분석 후 | 의존성 심층 분석 |
| `/impact <file>` | 특정 파일 관심 시 | 변경 영향도 |
| `/changelog <domain>` | 도메인 상세 후 | 변경 이력 |
| `/coverage` | 레이어 분석 후 | 테스트 커버리지 |

---

## 참조 문서

- `references/output-formats.md` - 출력 형식 상세
- `references/examples.md` - 사용 예시
