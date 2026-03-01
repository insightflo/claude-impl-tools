---
name: governance-setup
description: 대규모 프로젝트의 거버넌스 팀(PM, Architect, Designer, QA, DBA)이 구현 전 선행 작업을 수행합니다. /governance-setup, "거버넌스 구성", "프로젝트 팀 셋업" 트리거.
version: 1.2.0
updated: 2026-02-21
---

# 🏛️ Governance Setup (Phase 0)

> **목적**: 대규모 프로젝트에서 구현 전에 거버넌스 팀이 표준과 품질 기준을 확립합니다.
>
> **⚠️ 핵심 원칙**: 이 스킬은 **구현 코드를 작성하지 않습니다**. 오직 **거버넌스 문서와 표준**만 생성합니다.
>
> **전제 조건**: TASKS.md가 존재해야 합니다. 없으면 `/tasks-generator` 먼저 실행.
>
> **v1.2.0**: Progressive Disclosure 적용, `/eros` 연동 추가

---

## ⛔ 절대 금지 사항

1. ❌ **구현 코드 작성 금지** - 표준/정책 문서만 작성
2. ❌ **에이전트 순서 무시 금지** - PM → Architect → Designer → QA → DBA 순서 필수
3. ❌ **사용자 확인 없이 진행 금지** - 각 에이전트 완료 후 사용자 승인 필요

---

## ✅ 즉시 실행 행동

### (중요) 문서 → 실행 연결고리
- 이 스킬은 구현 코드를 작성하지 않지만, 산출물이 실제로 효력을 가지려면 **문서가 실행 가능한 강제 장치(게이트/테스트/타입/CI)**로 내려가야 합니다.
- 따라서 `management/quality-gates.md`와 `ADR-*.md`에는 **"어디에서 어떻게 강제되는지"(예: 단일 검증 엔트리 커맨드, CI job, 테스트 스위트, 산출물 경로)**를 반드시 포함하세요.
- 예: `scripts/verify_all.sh` 또는 `make verify` 같은 **단일 엔트리 검증 커맨드**를 정의하고, quality gates 항목을 그 커맨드 하위 단계로 매핑.


### 0단계: 전제 조건 확인

```bash
ls docs/planning/06-tasks.md 2>/dev/null || ls TASKS.md 2>/dev/null
ls management/project-plan.md management/decisions/ADR-*.md 2>/dev/null
```

**TASKS.md가 없으면** → `/tasks-generator` 먼저 안내

---

## 🔄 거버넌스 팀 5단계 순차 실행

| Step | 에이전트 | 산출물 | 상세 가이드 |
|------|----------|--------|-------------|
| 1 | **PM** | `management/project-plan.md` | `references/phase-1-pm.md` |
| 2 | **Architect** | `management/decisions/ADR-*.md` | `references/phase-2-architect.md` |
| 3 | **Designer** | `design/system/*.md` | `references/phase-3-designer.md` |
| 4 | **QA Manager** | `management/quality-gates.md` | `references/phase-4-qa.md` |
| 5 | **DBA** | `database/standards.md` | `references/phase-5-dba.md` |

### 각 Phase 진입 시
1. 해당 `references/phase-N-*.md` 파일을 Read
2. Task 호출 템플릿에 따라 에이전트 실행
3. 완료 조건 확인 후 다음 단계로

---

## 📋 거버넌스 완료 체크리스트

```
management/
├── project-plan.md           ← PM
├── quality-gates.md          ← QA Manager
└── decisions/
    ├── ADR-001-tech-stack.md
    ├── ADR-002-api-versioning.md
    ├── ADR-003-error-handling.md
    └── ADR-004-naming-convention.md

design/system/
├── tokens.md, components.md, layout.md, accessibility.md

database/
└── standards.md              ← DBA
```

---

## 🔗 다음 단계 (CRITICAL)

> **이 섹션은 스킬 완료 후 반드시 실행합니다.**

거버넌스 완료 후 **AskUserQuestion**으로 다음 단계 안내:

```json
{
  "questions": [{
    "question": "✅ 거버넌스 셋업 완료! 다음 단계를 선택하세요:",
    "header": "다음 단계",
    "options": [
      {"label": "⭐ 에이전트 팀 생성 (권장)", "description": "/project-bootstrap - backend, frontend, test 전문가 생성"},
      {"label": "결핍 분석 먼저", "description": "/eros - 숨겨진 가정과 결핍 검증 (v1.10.0)"},
      {"label": "직접 구현 시작", "description": "/agile auto - Claude가 직접 코드 작성 (소규모만)"},
      {"label": "다른 워크플로우", "description": "/workflow - 전체 스킬 목록에서 선택"}
    ],
    "multiSelect": false
  }]
}
```

### 선택에 따른 자동 실행

| 선택 | 실행 |
|------|------|
| "에이전트 팀 생성" | `Skill({ skill: "project-bootstrap" })` |
| "결핍 분석 먼저" | `Skill({ skill: "eros" })` |
| "직접 구현 시작" | `Skill({ skill: "agile" })` |
| "다른 워크플로우" | `Skill({ skill: "workflow-guide" })` |

---

## ⚙️ Hook 연동

| 산출물 | Hook | 동작 |
|--------|------|------|
| ADR-*.md | `standards-validator` | ADR 위반 시 경고 |
| quality-gates.md | `quality-gate` | 품질 미달 시 차단 |
| design/system/*.md | `design-validator` | 디자인 위반 감지 |
| database/standards.md | `standards-validator` | DB 명명 규칙 검사 |

---

## 🆘 FAQ

**Q: TASKS.md가 없어요**
→ `/tasks-generator` 먼저 실행

**Q: 특정 단계만 다시 실행하고 싶어요**
→ 해당 `references/phase-N-*.md`를 Read 후 Task 호출

**Q: 에이전트 호출 실패**
→ `ls ~/.claude/agents/` 확인 (Claude Project Team 필요)

---

**Last Updated**: 2026-02-21 (v1.2.0 - Progressive Disclosure, /eros 연동)
