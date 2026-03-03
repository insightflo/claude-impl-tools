# claude-imple-skills

[English](./README.md) | [한국어](./README_ko.md)

**VibeLab Skills 위에서 더 안전하고 정밀한 구현을 돕는 구현(Implementation) 스킬 팩 v3.2.0**

> **필수 요구사항**: 이 확장팩은 [VibeLab Skills v1.10.0+](https://vibelabs.kr/skills/new)가 설치된 환경에서만 정상 작동합니다.

VibeLab의 `/socrates`와 `/tasks-generator`가 만들어낸 기획 문서와 태스크 목록을 기반으로, **레이어별 점진적 구현**, **맥락 복구**, **배포 전 감사**, **워크플로우 라우팅**, 그리고 **v3.0에서 새로 추가된 Project Team 시스템**을 제공합니다.

---

## v3.0 NEW: Project Team

**대규모 프로젝트를 위한 AI 에이전트 팀 협업 시스템**

```
project-team/
├── agents/       # 9개 에이전트 (PM, Architect, Designer, QA, DBA...)
├── hooks/        # 10개 자동화 Hook (권한, 품질, 영향도 검증)
├── skills/       # 5개 유지보수 스킬 (/impact, /deps, /changelog...)
└── templates/    # 프로토콜, ADR, Contract 템플릿
```

### 주요 기능

| 구성요소 | 개수 | 역할 |
|----------|----:|------|
| **에이전트** | 9개 | Project Manager, Chief Architect, QA Manager 등 역할 기반 협업 |
| **Hook** | 10개 | 파일 수정 전후 자동 검증 (권한, 표준, 영향도, 품질) |
| **스킬** | 5개 | 유지보수 분석 (`/impact`, `/deps`, `/changelog`, `/coverage`, `/architecture`) |
| **템플릿** | 7개 | 에이전트 간 통신 프로토콜, ADR, Interface Contract |

### 설치

```bash
cd project-team
./install.sh --global    # 전역 설치
./install.sh --local     # 프로젝트별 설치
```

자세한 내용은 [project-team/README.md](./project-team/README.md) 참고 (formerly `claude-project-team/`, now `project-team/`).

---

## 바이브랩스킬 vs 우리스킬 (역할 분담)

| 구분 | 스킬 | 역할 | 시점 |
|------|------|------|------|
| **바이브랩** | `/neurion` | AI 브레인스토밍 | 아이디어 발굴 |
| **바이브랩** | `/socrates` | 기획 컨설팅 | 프로젝트 시작 |
| **바이브랩** | `/tasks-generator` | 태스크 생성 | 기획 완료 후 |
| **바이브랩** | `/auto-orchestrate` | 완전 자동화 (30~200개) | 대규모 구현 |
| **바이브랩** | `/trinity` | 五柱 코드 품질 평가 | Phase 완료 |
| **바이브랩** | `/code-review` | 2단계 코드 리뷰 | 기능 완료 |
| **우리스킬** | `/workflow` | **메타 허브** - 스킬 라우팅 | 언제든지 |
| **우리스킬** | `/governance-setup` | Phase 0 거버넌스 팀 구성 (v3.1) | 대규모 프로젝트 시작 |
| **우리스킬** | `/agile` | 레이어별 스프린트 (1~30개) | 소규모 구현 |
| **우리스킬** | `/recover` | 범용 복구 허브 | 작업 중단 시 |
| **우리스킬** | `/audit` | 배포 전 종합 감사 | 배포 전 |
| **우리스킬** | `/multi-ai-review` | Claude+Gemini CLI+Codex CLI 컨센서스 리뷰 | 머지/배포 전 |
| **우리스킬** | `/impact` | 파일 변경 영향도 분석 (v3.0) | 수정 전 |
| **우리스킬** | `/deps` | 의존성 그래프/순환 감지 (v3.0) | 리팩토링 전 |
| **우리스킬** | `/changelog` | 변경 이력 조회 (v3.0) | 추적 시 |
| **우리스킬** | `/coverage` | 테스트 커버리지 조회 (v3.0) | 품질 확인 |
| **우리스킬** | `/architecture` | 아키텍처 맵 시각화 (v3.0) | 구조 파악 |

---

## 확장 스킬 (Extension Skills) v3.2.0

### 기존 스킬 (5개)

#### 1) Workflow Guide (`/workflow`) - 메타 허브

프로젝트 상태를 분석해 “지금 가장 적합한 다음 스킬”을 추천합니다.

```
/workflow
```

- 전체 스킬 카탈로그(바이브랩 + 우리스킬) 관리
- 세션 중단 후 진행 상태 자동 감지 및 다음 단계 추천 (v3.1.2)
- 유지보수 워크플로우(버그 수정/리팩토링/건강 점검) 포함
- Project Team Hook/Agent 시스템 연동

#### 2) Agile Sprint Master (`/agile`)

레이어별 점진적 구현 (Skeleton → Muscles → Skin)

```bash
/agile auto                 # 전체 레이어 순차 실행
/agile iterate "변경사항"     # 영향받는 레이어만 스마트 수정
```

#### 3) Context Recover (`/recover`)

모든 유형의 중단된 작업을 복구합니다.

```
/recover
```

#### 4) Quality Auditor (`/audit`)

배포 전 기획 정합성 + 동적 검증을 수행합니다.

```
/audit
```

#### 5) Multi-AI Review (`/multi-ai-review`)

Claude(오케스트레이터) + Gemini CLI + Codex CLI로 컨센서스 리뷰를 수행합니다.

```
/multi-ai-review
```

- 3-Stage: Initial Opinions → Cross-Review → Chairman Synthesis
- MCP 없이 CLI 기반으로 실행 (CLI 구독 플랜 기반)

### v3.1 NEW: Phase 0 거버넌스

#### 6) Governance Setup (`/governance-setup`)

대규모 프로젝트 시작 전 거버넌스 팀을 구성합니다.

```bash
/governance-setup
```

- PM → Chief Architect → Designer → QA Manager → DBA 순차 실행
- 각 에이전트가 선행 산출물 생성 (프로젝트 계획, ADR, 디자인 시스템, 품질 기준, DB 표준)
- 대규모 기준(예): 10+ tasks, 2+ domains, 2+ team members

### v3.0 NEW: 유지보수 스킬 (5개)

#### 7) Impact Analyzer (`/impact`)

```bash
/impact src/services/user_service.py
```

#### 8) Dependency Graph (`/deps`)

```bash
/deps          # 전체 의존성
/deps --cycles # 순환만
```

#### 9) Changelog Query (`/changelog`)

```bash
/changelog
/changelog --domain user
```

#### 10) Coverage Map (`/coverage`)

```bash
/coverage
/coverage --uncovered
```

#### 11) Architecture Map (`/architecture`)

```bash
/architecture
/architecture domains
```

---

## 권장 워크플로우 (v3.1)

```
시작
  |
  |- "뭐부터 해야 해?" ---------------- /workflow (우리스킬)
  |
  |- 아이디어 브레인스토밍 ------------- /neurion (바이브랩)
  |
  |- 기획 완료 ------------------------- /tasks-generator (바이브랩)
  |
  |- 구현 시작 (규모에 따라 분기)
  |   |
  |   |- 소규모 (<= 30개) -------------- /agile auto
  |   |
  |   |- 중규모 (30~50개) -------------- /project-bootstrap -> /auto-orchestrate
  |   |
  |   `- 대규모 (50+개 또는 2+ 도메인)
  |       |- /governance-setup
  |       |- /project-bootstrap
  |       `- /auto-orchestrate --ultra-thin
  |
  |- 유지보수/리팩토링
  |   |- 수정 전 영향도 ---------------- /impact
  |   |- 의존성 확인 ------------------- /deps
  |   `- 변경 이력 --------------------- /changelog
  |
  |- 품질 확인
  |   |- 커버리지 ---------------------- /coverage
  |   |- 아키텍처 ---------------------- /architecture
  |   `- 품질 평가 --------------------- /trinity (바이브랩)
  |
  |- 배포 전 감사 ---------------------- /audit
  |
  `- 작업 중단 시 ---------------------- /recover
```

### 에이전트 팀 필요 여부

| 태스크 수 | 권장 스킬 | 코드 작성 주체 | 에이전트 팀 |
|----------:|-----------|---------------|------------|
| <= 30개 | `/agile auto` | Claude 직접 | ❌ 불필요 |
| 30~50개 | `/auto-orchestrate` | 전문가 에이전트 | ✅ 권장 |
| 50+개 | `/ultra-thin-orchestrate` | 전문가 에이전트 | ✅ 필수 |

---

## 프로젝트 구조

```
claude-imple-skills/
├── skills/                       # 우리스킬 (11개)
│   ├── workflow-guide/
│   ├── governance-setup/
│   ├── agile/
│   ├── recover/
│   ├── quality-auditor/
│   ├── multi-ai-review/
│   └── coverage/
│
├── project-team/                 # AI 팀 협업 시스템
│   ├── install.sh
│   ├── README.md
│   ├── hooks/
│   ├── agents/
│   ├── skills/
│   ├── templates/
│   ├── examples/
│   └── docs/
│
├── scripts/
│   ├── install-windows.ps1
│   └── install-unix.sh
│
├── LICENSE
└── README.md
```

---

## 설치 방법

### 1) VibeLab 먼저 설치

https://vibelabs.kr/skills/new

### 2) 확장팩 설치

**macOS / Linux**

```bash
chmod +x ./scripts/install-unix.sh && ./scripts/install-unix.sh
```

**Windows (PowerShell)**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

### 3) Project Team 설치 (선택)

```bash
cd project-team
./install.sh --global    # 전역 설치 (권장)
```

---

## MCP 의존성

| 스킬 | 필수 MCP | 비고 |
|------|----------|------|
| `/workflow` | 없음 | 기본 도구만 사용 |
| `/agile` | playwright (선택) | 스크린샷 시에만 |
| `/recover` | 없음 | 기본 도구만 사용 |
| `/audit` | playwright (선택) | 브라우저 검증 시에만 |
| `/multi-ai-review` | 없음 (CLI 필요) | gemini/codex CLI 설치 시 컨센서스 리뷰 |
| `/impact`, `/deps`, `/changelog`, `/coverage`, `/architecture` | 없음 | 기본 도구만 사용 |

---

## 버전 히스토리

| 버전 | 날짜 | 주요 변경 |
|----:|------|----------|
| **v3.2.0** | 2026-02-21 | **vibelab v1.10.0 연동** - 신규 스킬 확장 지원, tmux 병렬 모드, Progressive Disclosure |
| **v3.1.2** | 2026-02-11 | **워크플로우 연속성 강화** - 세션 중단 후에도 진행 상태 자동 감지 |
| v3.1.0 | 2026-02-11 | governance-setup 스킬 추가, workflow-guide 개선 |
| v3.0.0 | 2026-03-02 | multi-ai-review: CLI council 워크플로우(Gemini/Codex)로 전환 |
| v3.0.0 | 2026-02-08 | Project Team 추가 - 9 에이전트, 10 Hook, 5 유지보수 스킬 |
| v2.2.0 | 2026-02-02 | VibeLab v1.8.1 통합 |
| v2.1.0 | 2026-01-28 | multi-ai-review 스킬 추가 |
| v2.0.0 | 2026-01-27 | MCP 의존성 제거, workflow-guide 강화 |

---

## 라이선스

MIT License - Copyright (c) 2026 Insightflo Team

---

**Insightflo Team**
_Precision Engineering으로 VibeLab을 확장합니다._
