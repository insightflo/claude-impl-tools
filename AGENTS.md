# AGENTS.md

This file provides guidance to AI agents (Warp, Claude, Cursor, etc.) when working with code in this repository.

## Project Overview

**VibeLab Extension v2.0** - A premium skill pack that extends VibeLab's planning and task system with advanced engineering capabilities for safer, more precise implementation.

This is a skill-based extension framework that operates on top of VibeLab Skills. It provides four custom skills for AI-assisted development workflows that emphasize incremental implementation, context recovery, workflow guidance, and quality auditing.

### Core Philosophy
- **Layer-based incremental implementation**: Build projects in three stages - Skeleton (structure), Muscles (functionality), Skin (polish)
- **Human-in-the-loop checkpoints**: Each layer requires user review and approval before proceeding
- **Planning-first approach**: All work should reference planning documents in `docs/planning/`
- **Context preservation**: Track work progress through state files and orchestration artifacts
- **MCP-independent**: All skills work without MCP servers (optional enhancements available)

## VibeLab Skills vs Extension Skills (Role Division)

| Category | Skill | Role | When to Use |
|----------|-------|------|-------------|
| **VibeLab** | `/socrates` | Planning consultation | Project start |
| **VibeLab** | `/tasks-generator` | Task generation | After planning |
| **VibeLab** | `/auto-orchestrate` | Full automation (30-200 tasks) | Large-scale implementation |
| **VibeLab** | `/code-review` | 2-stage code review | Feature completion |
| **Extension** | `/workflow` | **Meta hub** - skill routing | Anytime |
| **Extension** | `/agile` | Layer-based sprints (1-30 tasks) | Small-scale implementation |
| **Extension** | `/recover` | Universal recovery hub | Work interruption |
| **Extension** | `/audit` | Pre-deployment audit | Before deployment |

## Installation and Setup

### Prerequisites
- VibeLab Skills installed from https://vibelabs.kr/skills/new

### Installation Commands

**macOS/Linux:**
```bash
chmod +x ./scripts/install-unix.sh && ./scripts/install-unix.sh
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

### What Installation Does
- Creates symbolic links (Unix) or junctions (Windows) from `skills/` to `~/.claude/skills/`
- Makes all four extension skills available to Claude Desktop
- Skills remain in-repo for version control and easy updates

## Architecture

### Directory Structure
```
vibelab-extension/
├── skills/                    # Four extension skills
│   ├── workflow-guide/        # v2.0.0 - Meta hub for skill routing
│   ├── agile/                 # v1.9.0 - Sprint master for layered implementation
│   ├── recover/               # v1.9.0 - Universal recovery hub
│   └── quality-auditor/       # v2.0.0 - 2-stage review + DDD verification
├── scripts/                   # Installation scripts
│   ├── install-unix.sh        # Symlink creator for Unix/macOS
│   └── install-windows.ps1    # Junction creator for Windows
├── LICENSE                    # MIT License
├── README.md                  # User-facing documentation
└── AGENTS.md                  # This file (AI agent guidance)
```

### MCP Dependencies

| Skill | Required MCP | Notes |
|-------|--------------|-------|
| `/workflow` | None | Basic tools only |
| `/agile` | playwright (optional) | For screenshot capture |
| `/recover` | None | Basic tools only |
| `/audit` | playwright (optional) | For browser verification |

> **All skills work without MCP.** MCP servers provide optional enhancements.

### Skill Dependencies

Each skill expects specific project structures:

**Workflow Guide (`/workflow`)**
- Analyzes: `docs/planning/*.md`, project file structure, task state
- Decision tree based on: presence of planning docs, tasks, code
- Recommends single next action, not exhaustive options
- Manages catalog of 31 skills (27 VibeLab + 4 Extension)

**Agile Sprint Master (`/agile`)**
- Depends on: `docs/planning/06-tasks.md` (task list with layer tags)
- Uses task ID format: `T0.*` (Skeleton), `T1.*-T2.*` (Muscles), `T3.*` (Skin)
- Checkpoint-based execution with user approval at each layer

**Context Recover (`/recover`)**
- Reads: `.claude/orchestrate-state.json`, `.claude/progress.txt`, `task.md`
- Priority: v1.7.4 orchestrate state > traditional task markers
- Detects incomplete work from file patterns and state artifacts

**Quality Auditor (`/audit`)**
- Required docs: `docs/planning/01-prd.md`, `02-trd.md`, `07-coding-convention.md`
- Optional docs: `03-user-flow.md`, `04-database-design.md`
- Two-stage review: (1) Spec Compliance → (2) Code Quality
- DDD verification: Checks demo pages match design mockups
- Test execution: Uses standard commands (`npm test`, `pytest`)

## Development Workflows

### Recommended Workflow Sequence

```
Start
  │
  ├─ "What should I do?" ─────────── /workflow (Extension)
  │
  ├─ Idea only ───────────────────── /socrates (VibeLab)
  │
  ├─ Planning complete ───────────── /tasks-generator (VibeLab)
  │
  ├─ Implementation
  │   ├─ 1-30 tasks ──────────────── /agile auto (Extension)
  │   └─ 30-200 tasks ────────────── /auto-orchestrate (VibeLab)
  │
  ├─ Feature changes ─────────────── /agile iterate (Extension)
  │
  ├─ Code review ─────────────────── /code-review (VibeLab)
  │
  ├─ Pre-deployment audit ────────── /audit (Extension)
  │
  └─ Work interrupted ────────────── /recover (Extension)
```

### Layer-Based Implementation

**Skeleton Layer (🦴)**:
- Task IDs: `T0.*`, `T1.1-T1.3`
- Focus: Overall layout, dummy data, navigation structure
- Checkpoint question: "Does the overall structure look right?"

**Muscles Layer (💪)**:
- Task IDs: `T1.4-T2.*`
- Focus: Real data integration, core business logic, interactions
- Checkpoint question: "Does it actually work properly?"

**Skin Layer (✨)**:
- Task IDs: `T3.*`
- Focus: Design system application, animations, edge cases, premium feel
- Checkpoint question: "Is the user experience excellent?"

### Task Scale Selection

| Task Count | Recommended Skill | Features |
|------------|-------------------|----------|
| **1-10** | `/agile run` + `/agile done` | Manual control, detailed reports |
| **10-30** | `/agile auto` | Layer checkpoints, user collaboration |
| **30-50** | `/auto-orchestrate` (VibeLab) | Full automation, Phase parallel execution |
| **50-200** | `/ultra-thin-orchestrate` (VibeLab) | Ultra-lightweight mode |
| **Error loops** | `/ralph-loop` (VibeLab) | Self-referential learning |

### Agile Commands

**New Projects:**
- `/agile auto` - Execute all layers sequentially with user approval at each checkpoint

**Existing Projects:**
- `/agile iterate "design change description"` - Analyze impact and execute affected layers only
- `/agile run T2.1` - Start specific task with execution plan
- `/agile done T2.1` - Complete task with report generation
- `/agile status` - Show current sprint progress
- `/agile review` - Request user review of current state

### Change Impact Detection

`/agile iterate` automatically determines affected layers:

| Change Type | Affected Layers | Example |
|-------------|-----------------|---------|
| Design change | ✨ Skin | Colors, fonts, animations |
| UI structure | 🦴 Skeleton + ✨ Skin | Navigation, page layout |
| New feature | 🦴 + 💪 + ✨ All | New screens/APIs/models |
| Business logic | 💪 Muscles | API logic, validation |
| Bug fix | Specific layer | Target only affected layer |

## Quality Assurance

### Two-Stage Review Process

**Stage 1: Spec Compliance**
- Requirements match: Are PRD features implemented exactly?
- Missing features: Are edge cases from planning docs handled?
- YAGNI violations: Are there unnecessary features not in planning?

**Stage 2: Code Quality**
- SOLID/Clean Code principles
- Security guardrails (no API key exposure, SQL injection prevention)
- Performance (no unnecessary re-renders, no waterfall fetching)

### DDD (Demo-Driven Development) Verification

For UI tasks:
- Each task should have independent demo page
- Screenshot comparison with mockups in `design/`
- Browser console must be error-free during demo

### Quality Scoring

`/audit` generates scores:

| Score | Verdict | Meaning |
|-------|---------|---------|
| 90+ | ✅ PASS | Production-ready |
| 70-89 | ⚠️ CAUTION | Minor fixes needed |
| <70 | ❌ FAIL | Major revision required |

### Quality Gates

| Gate | Required Skill | Pass Criteria |
|------|----------------|---------------|
| **G1: Feature** | `/code-review` | 2-stage review pass |
| **G2: Phase** | `/evaluation` | Quality metrics 80%+ |
| **G3: Audit** | `/audit` | Spec compliance + DDD + Tests |
| **G4: Deep Review** | `/multi-ai-review` | 3-AI consensus (optional) |
| **G5: Final** | `/verification-before-completion` | Verification commands succeed |

## Context Recovery

### Recovery Priority

When running `/recover`, check in this order:

1. **Orchestrate State** (`.claude/orchestrate-state.json`) - Automation tracking
2. **Progress Log** (`.claude/progress.txt`) - Decision and issue history
3. **Task Markers** (`task.md`) - Traditional `[ ]`, `[/]`, `[x]` markers
4. **Git Worktree** - Unmerged branches, dirty state

### Incomplete Work Detection

Patterns that trigger recovery suggestions:
- Unclosed code blocks in markdown
- Unmatched brackets in code files
- TODO markers (`// TODO:`, `# FIXME:`)
- Stub implementations (`pass`, `throw new Error('Not implemented')`)

## Task File & ID Policy

### Canonical Task File

| Priority | Path | Description |
|----------|------|-------------|
| **1 (Canonical)** | `./TASKS.md` | 프로젝트 루트의 표준 태스크 파일 |
| 2 (Legacy) | `docs/planning/06-tasks.md` | VibeLab 컨벤션 |
| 3 (Legacy) | `task.md`, `*tasks*.md` | 기타 레거시 형식 |

> **Rule**: 신규 프로젝트는 루트 `TASKS.md`만 사용. 레거시 파일이 있으면 `/tasks-migrate`로 통합.

### Task ID Policy

두 가지 ID 형식 모두 허용:

| Format | Pattern | Use Case | Example |
|--------|---------|----------|---------|
| **Phase-based** | `P{n}-T{m}`, `P{n}-S{m}-T{k}` | 프로젝트/Phase 관리 | `P1-T1`, `P2-S1-T3` |
| **Agile Layer** | `T{layer}.{seq}` | 스프린트/레이어 작업 | `T0.1`, `T1.2`, `T3.4` |

**Agile Layer 의미:**
- `T0.*` — Skeleton (구조, 레이아웃)
- `T1.*` — Muscles (핵심 기능)
- `T2.*` — Muscles Advanced (고급 기능)
- `T3.*` — Skin (UI 다듬기, 애니메이션)

**권장 사용:**
- 신규 스프린트/구현: `T*` (agile layer)
- 대규모 프로젝트/Phase 확장: `P*-T*`

## Important Constraints

### What Skills DON'T Do

**Quality Auditor:**
- ❌ Does NOT directly modify code (that's the implementation agent's job)
- ❌ Does NOT critique without referencing planning docs
- ❌ Does NOT audit without planning documents

**Workflow Guide:**
- ❌ Does NOT write code directly (only recommends next steps)
- ❌ Does NOT list all available skills (only contextually relevant 1-2)
- ❌ Does NOT ask user first (analyzes project state silently)

**Agile Sprint Master:**
- ❌ Does NOT skip checkpoints
- ❌ Does NOT commit to git without explicit user request

**Context Recover:**
- ❌ Cannot restore unsaved data (CLI crash before file write)
- ❌ Cannot restore running processes (`npm run dev`, etc.)

## Korean Language Support

All skills support Korean commands and natural language:
- `/복구` = `/recover`
- "스프린트 시작" = "start sprint"
- "코드 검토" = "code review"
- "워크플로우 추천" = "workflow recommendation"

## Version Information

- **Current Version**: v2.0.0
- **Last Updated**: 2026-01-27
- **License**: MIT (Copyright 2026 Inflo Team)
- **Requires**: VibeLab Skills installed first
