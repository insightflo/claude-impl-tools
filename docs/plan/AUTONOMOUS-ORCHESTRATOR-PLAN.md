# Autonomous Orchestrator

> Autonomous task decomposition, execution, evaluation, and adjustment.
> Symphony-level orchestration intelligence built on Claude Code skill system.

Created: 2026-03-06
Status: v3.1 (Round 3 final — Go)
Basis: Symphony analysis + claude-imple-skills architecture review
Related: SYMPHONY-ADOPTION-PLAN.md (Linear Board Projection — visual layer)
Review: Round 1 council — Codex + Gemini
Review: Round 2 council — Codex + Gemini

## Problem Statement

Current orchestrate-standalone executes pre-defined tasks but cannot:
- Decompose rough tasks into actionable sub-tasks
- Dynamically add/modify tasks during execution
- Self-evaluate results and trigger rework
- Make autonomous decisions about what work is needed

Users must manually define every task in detail before orchestration begins.

## Goal

Build an autonomous orchestrator that accepts rough/high-level tasks,
decomposes them, executes with existing skills, self-evaluates, and
adjusts — with Human Review gates at configurable checkpoints.

```
Human: "Build user authentication with OAuth"
  |
  v
[Autonomous Orchestrator]
  |-- Define: acceptance criteria + constraints locked
  |-- Decompose: 12 sub-tasks identified
  |-- Plan: dependencies mapped, skills selected
  |-- Execute: sub-tasks run with skills (checkpoint, security-review...)
  |-- Assess: automated checks → QA agent → verdict
  |-- Adjust: 3 tasks added (edge cases found), 1 task modified
  |-- Gate: Human Review checkpoint reached
  |
  v
Human: Reviews, approves/reworks
```

## Strategy: Extend First, Extract Later

> Round 1 Codex: "별도 repo 시기상조. orchestrate-standalone 위에 autonomy layer
> 추가가 먼저." Codex confirmed existing engine has wave/sprint/gate/resume already.

**Phase 1**: Add autonomy layer to existing orchestrate-standalone (in claude-imple-skills)
**Phase 2**: Validate with 3+ real scenarios
**Phase 3**: Extract to separate project only if coupling becomes a problem

This avoids:
- Duplicating existing wave/sprint/gate/resume logic
- Breaking existing users during development
- Premature abstraction before patterns stabilize

## Architecture

### Core Loop (DCPEA — Define, Constrain, Plan, Execute, Assess)

> Round 1 Codex: "DPEA에 Define/Constrain 단계 필요. 없으면 Assess/Adjust가
> 매 반복마다 기준을 바꿈."

```
                    ┌─────────────────────────┐
                    │    Human Input           │
                    │  (rough task / goal)     │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │  0. DEFINE + CONSTRAIN   │
                    │  Lock: acceptance criteria│
                    │  constraints, quality bar │
                    │  budget (iterations/tasks)│
                    │  Output: contract         │
                    │  *** HUMAN APPROVAL ***   │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │  1. DECOMPOSE            │
                    │  PM Agent: break down    │
                    │  into sub-tasks          │
                    │  Output: task tree       │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │  2. PLAN                 │
                    │  Architect Agent:        │
                    │  dependencies, order,    │
                    │  skill selection,        │
                    │  context protocol        │
                    │  Output: execution plan  │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │  3. EXECUTE              │
              ┌────►│  Run tasks with skills   │
              │     │  (existing engine:       │
              │     │   wave/sprint/gate)      │
              │     │  Output: artifacts       │
              │     └───────────┬──────────────┘
              │                 │
              │     ┌───────────▼──────────────┐
              │     │  4. ASSESS               │
              │     │  a. Automated checks     │
              │     │     (lint/build/test)     │
              │     │  b. QA Agent reflection  │
              │     │  c. Against DEFINE       │
              │     │     contract criteria     │
              │     │  Output: verdict         │
              │     └───────────┬──────────────┘
              │                 │
              │          ┌──────┴──────┐
              │          │             │
              │     [PASS]        [FAIL/GAPS]
              │          │             │
              │          ▼             ▼
              │     ┌─────────┐  ┌──────────┐
              │     │ Human   │  │ 5. ADJUST│
              │     │ Review  │  │ (within  │
              │     │ Gate    │  │  budget) │
              │     └────┬────┘  └────┬─────┘
              │          │            │
              │          ▼            │
              │     [Continue]        │
              └───────────────────────┘
```

### Context Protocol

> Round 1 Gemini: "Global Intent vs Local Task Context 전달 방법 정의 필요."

Every skill/agent invocation receives a structured context envelope:

```json
{
  "global": {
    "goal": "Build user authentication with OAuth",
    "contract": { "acceptance_criteria": [...], "constraints": [...] },
    "architecture_decisions": [...]
  },
  "local": {
    "task_id": "AUTH-03",
    "task_description": "Implement JWT token validation",
    "dependencies_completed": ["AUTH-01", "AUTH-02"],
    "skill_hint": "security-review"
  },
  "budget": {
    "max_iterations": 5,
    "remaining_iterations": 3,
    "max_dynamic_tasks": 10,
    "tasks_added_so_far": 2
  }
}
```

### Budget Guardrails

> Round 1 Gemini: "Token/Budget 관리 — 무한 루프 방지용 예산 가드레일."

| Guardrail | Default | Configurable |
|-----------|---------|-------------|
| Max DCPEA loop iterations | 5 | Yes |
| Max dynamically added tasks | 10 | Yes |
| Max consecutive failures before human escalation | 3 | Yes |
| Decompose result requires human approval | Yes (MVP) | Yes |
| Adjust result requires human approval | No (within budget) | Yes |

When any budget is exceeded → forced Human Review Gate.

### Skill Invocation Contract

> Round 1 Codex: "Skill invocation이 가장 과소정의됨. 입력 스키마, 출력 스키마,
> side effect 범위, timeout/retry, rollback, idempotency를 정의해야 함."

Each skill invocation follows this contract:

```yaml
# Skill Invocation Contract
invoke:
  skill: "checkpoint"
  input:
    context_envelope: { global: ..., local: ... }
    files_changed: ["src/auth/jwt.js"]
    git_diff: "..."
  expectations:
    output_format: "structured_json"  # or "markdown", "pass_fail"
    timeout_ms: 120000
    retry_on_failure: 1
    side_effects: "read_only"  # or "read_write", "git_commit"
  on_failure:
    action: "skip_with_warning"  # or "halt", "retry", "escalate"
    fallback: null
```

**MVP simplification**: Skills are invoked via Claude Code subagent with
prompt-based contract. Formal schema enforcement is Post-MVP.

### Assess Pipeline

> Round 1 Gemini: "QA Agent 전에 automated checks 필수."

```
Assess pipeline (per task):
  1. Automated checks (mandatory, non-negotiable):
     - lint/format check
     - build succeeds
     - existing tests pass
     - no new security vulnerabilities (if security-review available)
  2. QA Agent reflection (against contract criteria):
     - completeness check
     - correctness evaluation
     - edge case identification
  3. Verdict: PASS / FAIL(reason) / GAPS(missing_items)
```

### State Management

> Round 1 Codex: "versioned schema, append-only event log 필요."

```json
// .claude/orchestrate/auto-state.json
{
  "schema_version": 1,
  "session_id": "auto-2026-03-06-1200",
  "contract": {
    "version": 1,
    "hash": "sha256:abc123...",
    "goal": "Build user authentication with OAuth",
    "acceptance_criteria": ["JWT auth works", "OAuth flow complete"],
    "constraints": ["No external auth service", "Must pass security-review"],
    "quality_bar": "all tests pass + security-review clean",
    "verify_cmd": "npm test && npm run lint"
  },
  "budget": {
    "max_iterations": 5,
    "current_iteration": 3,
    "max_dynamic_tasks": 10,
    "dynamic_tasks_added": 2
  },
  "tasks": {
    "total": 15,
    "completed": 8,
    "in_progress": 2,
    "failed": 1,
    "dynamically_added": ["AUTH-13", "AUTH-14"]
  },
  "events": [
    { "ts": "...", "type": "define", "data": { "contract": "..." } },
    { "ts": "...", "type": "decompose", "data": { "tasks_created": 12 } },
    { "ts": "...", "type": "assess", "data": { "verdict": "fail", "gaps": [...] } },
    { "ts": "...", "type": "adjust", "data": { "tasks_added": ["AUTH-13"] } },
    { "ts": "...", "type": "gate", "data": { "type": "phase", "status": "approved" } }
  ]
}
```

**Contract Change Control** (Round 2 Codex):
- `contract.hash` computed from acceptance_criteria + constraints + verify_cmd
- Contract changes require a dedicated gate + justification event
- Assess always validates against the locked contract hash, not free-form interpretation

**Concurrency-Safe Event Log** (Round 2 Codex):
- Events written to separate append-only file: `.claude/orchestrate/auto-events.jsonl`
  (one JSON object per line — no full-file rewrite, no race condition)
- `auto-state.json` holds only current summary (derived from events on load)
- Workers append to events file; only the main loop rewrites state summary

**TASKS.md Sync Protocol** (Round 2 Gemini):
- Before each Execute wave, orchestrator re-reads TASKS.md to detect human edits
- If human added/modified/removed tasks → failure gate triggered (MVP scope gate merged into failure gate)
- Human edits take priority (orchestrator adjusts its plan, not vice versa)
- Detected via: compare TASKS.md hash before vs after each wave

**Context Sliding Window** (Round 2 Gemini):
- For task sets > 30: only current wave + immediate dependencies get full context
- Completed tasks summarized as `{id, status, key_outputs}` (not full detail)
- Architecture decisions always included in global context (never windowed out)

- Compatible with existing orchestrate-state.json (extends, not replaces)

### MVP Agent Simplification

> Round 2 Codex: "MVP에서 PM/Architect/QA 3개 분리 불필요. orchestrator 1개 +
> assess 반사 단계면 충분."

**MVP**: Single orchestrator agent handles Define/Decompose/Plan/Adjust.
Separate QA reflection only for Assess stage.

**Post-MVP**: Split into specialized PM/Architect/QA agents when prompt
complexity warrants it (validated in Phase 2 benchmarks).

### Dynamic Task ID Policy

> Round 2 Codex: "TASKS.md를 언제, 누가, 어떤 ID 정책으로 수정하는지 필요."

- Dynamic tasks use parent ID + sequence: `AUTH-03.1`, `AUTH-03.2`
- Only the orchestrator main loop writes to TASKS.md (workers never modify it)
- All TASKS.md modifications recorded as events in auto-events.jsonl
- On resume: TASKS.md is reconciled with event log (events are authoritative)

### Human Review Gates

> Round 2 Codex: "Gate 종류 줄이기. MVP는 4개면 충분."

| Gate Type | Trigger | What Human Reviews | MVP |
|-----------|---------|-------------------|-----|
| Contract gate | After Define stage | Acceptance criteria + constraints | Yes |
| Decompose gate | After task tree generated | Task breakdown quality | Yes |
| Failure gate | N consecutive failures or budget exceeded | Failure analysis + proposed fix | Yes |
| Final gate | All tasks complete | Full output + QA report | Yes |
| Phase gate | All tasks in a phase complete | Phase deliverables + assessment | Post-MVP |
| Scope gate | Dynamic tasks exceed budget | New tasks + justification | Post-MVP (merged into Failure gate for MVP) |
| Critical gate | Security/architecture changes | Diff + impact analysis | Post-MVP |

## Changes to Current Project (claude-imple-skills)

### Phase 0: Stabilize Existing Engine (Day 1-3)

> Round 1 Codex: "기존 엔진에 TODO/버그 있음. scheduler 레이어 계산 오류,
> state 런타임 에러."

- 0-1. Fix scheduler.js layer computation bug (uses successors instead of predecessors)
- 0-2. Fix state.js runtime error (`in_progress` vs `inProgress` variable mismatch)
- 0-3. Fix worker.js context passing (taskId only → full task object)
- 0-4. Verify orchestrate.sh completion path
- 0-5. Unify state schema (orchestrate-state.json path consistency)
- 0-6. Add concurrency-safe event log file (.jsonl append-only)
- 0-7. Create minimal engine/auto adapter boundary (thin interface, not full refactor)
- 0-8. Add missing tests for edge cases
- 0-9. Confirm wave/sprint/gate/resume all work correctly

**Phase 0 Exit Criteria** (Round 3 Codex):
- wave/sprint/resume smoke tests pass
- current_layer persistence verified on resume
- worker_count enforcement confirmed
- state/event log integrity: no data loss on concurrent workers
- All existing `--mode=wave` and `--mode=sprint` tests green

### Phase 1: Autonomy Layer MVP (Day 4-10)

Add to orchestrate-standalone as new mode: `--mode=auto`

- 1-1. Define stage: contract generation from rough goal
  - Input: 1-2 sentence goal
  - Output: acceptance criteria, constraints, quality bar
  - Human approval required before proceeding
- 1-2. Decompose stage: PM agent integration
  - Reads contract → generates task tree in TASKS.md format
  - Supports heading-style and bullet-style tasks
  - Human approval of decomposition (MVP)
- 1-3. Plan stage: Architect agent integration
  - Dependency detection from decomposed tasks
  - Skill selection hints per task
  - Execution order (reuses existing scheduler.js)
- 1-4. Execute stage: enhanced worker with context
  - Context envelope (global + local) passed to each task
  - Reuses existing wave/sprint execution engine
- 1-5. Assess stage: automated checks + QA agent
  - lint/build/test automated pipeline
  - QA agent reflection against contract
  - Verdict: PASS/FAIL/GAPS
- 1-6. Adjust stage: dynamic task modification
  - Add tasks for identified gaps (within budget)
  - Modify existing tasks if rework needed
  - Budget enforcement (max iterations, max tasks)
- 1-7. DCPEA loop integration in orchestrate.sh
  - `--mode=auto` flag
  - Budget guardrails
  - State management (auto-state.json)
- 1-8. Resume from auto checkpoint

### Phase 2: Validation + Hardening (Day 11-15)

- 2-1. Benchmark scenario 1: Small feature (5-10 tasks generated)
- 2-2. Benchmark scenario 2: Medium feature (15-30 tasks generated)
- 2-3. Benchmark scenario 3: Bug fix with investigation (dynamic tasks)
- 2-4. Context protocol validation (no context drift across tasks)
- 2-5. Gate UX refinement (clear summaries at each gate)
- 2-6. Agent prompt iteration based on benchmark results
- 2-7. Documentation: usage guide, architecture, agent prompts

### Phase 3: Extract Decision (Day 16-17)

> Round 2 Codex: "deprecation은 빼기. 추출 판단만."
> Round 2 Codex: "engine과 auto-layer 모듈 경계 먼저 만들기."

- 3-1. Refactor: separate `engine/` (existing wave/sprint/gate) from `auto/` (DCPEA layer)
  - This makes future extraction trivial without touching engine code
- 3-2. Evaluate: does `--mode=auto` belong in orchestrate-standalone?
  - If coupling is manageable → keep as mode
  - If complexity warrants separation → extract to new project with /workflow-guide
- 3-3. Update workflow-guide routing to include auto mode
- 3-4. No deprecation of existing modes (premature — deferred to Future)

### Phase 4: Advanced Features (Future)

- 4-1. Cross-session learning (what decompositions worked well)
- 4-2. Complexity estimation and time prediction
- 4-3. Parallel assessment (multiple tasks assessed simultaneously)
- 4-4. Linear Board integration (auto → push → board reflects progress)
- 4-5. Multi-AI review integration for complex architectural decisions

## Non-Goals

- Elixir/OTP runtime (stays Node.js/Bash)
- Long-running daemon (session-based only)
- Replacing Claude Code itself (orchestrator IS a Claude Code skill)
- Full Symphony port (we borrow patterns, not implementation)
- Removing human from the loop entirely (gates are mandatory)
- Premature repo extraction before validation (Phase 3 decides)

## Risks and Mitigations

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Decomposition quality varies by task type | High | PM prompt iteration + mandatory human gate after decompose |
| Assessment drift (criteria change each loop) | **High** | Contract locked in Define stage, assessed against it |
| Infinite adjust loops | Medium | Budget guardrails: max 5 iterations, max 10 dynamic tasks |
| Skill invocation context loss | Medium | Context envelope protocol with global/local separation |
| Existing orchestrate-standalone breakage | Medium | Auto mode is additive — existing modes unchanged |
| Agent prompt quality | High | Phase 2 dedicated to prompt iteration on benchmarks |
| Assessment false positives | High | Automated checks → QA Agent → Human gate (3-layer) |
| Scope creep during implementation | Medium | MVP strictly Phase 0-1 only |

## Success Criteria

1. `--mode=auto` accepts a rough 1-2 sentence goal → produces implementation plan
2. Contract stage locks acceptance criteria before execution begins
3. Decompose generates valid TASKS.md sub-tasks from goal
4. Execute reuses existing wave/sprint engine (no duplication)
5. Assess detects at least 1 quality issue in benchmark scenarios
6. Adjust adds tasks for identified gaps (within budget)
7. Human Review gates pause execution with clear summary
8. Resume from checkpoint without losing progress
9. Existing `--mode=wave` and `--mode=sprint` work unchanged
10. 3 benchmark scenarios pass end-to-end

## Relationship to Linear Board (v5.1)

Linear Board Projection is the **visual layer**:
- Auto orchestrator updates TASKS.md → `/linear-sync push` → board reflects progress
- Human Review gates map to Linear's Human Review workflow state
- Integration deferred to Phase 4 (Linear Board MVP first)

## Review Log

### Round 1 — Codex (council.sh)

| Finding | Resolution |
|---------|-----------|
| Separate repo premature — extend orchestrate-standalone first | Strategy changed: extend first, extract later (Phase 3) |
| 17 days unrealistic — existing engine has bugs | Phase 0 added: stabilize existing engine first |
| DPEA needs Define/Constrain stage | DCPEA loop with contract locking |
| Skill invocation under-defined | Skill Invocation Contract added |
| Dynamic state management insufficient | Append-only event log + versioned schema |

### Round 1 — Gemini (council.sh)

| Finding | Resolution |
|---------|-----------|
| Context Protocol missing | Context envelope (global/local/budget) defined |
| Token/Budget management needed | Budget guardrails table + forced gate on exceed |
| Automated verification before QA | 3-layer assess pipeline: auto checks → QA → human |
| Phase 1.5 for protocol definition | Merged into Phase 1 (context in 1-4, contract in 1-1) |

### Round 2 — Codex (council.sh)

| Finding | Resolution |
|---------|-----------|
| Contract needs hash/version for change control | Added contract.hash + contract.version + change gate |
| Concurrency-unsafe JSON state file | Append-only .jsonl event log + derived summary |
| MVP doesn't need 3 separate agents | Single orchestrator + QA reflection only |
| Too many gate types for MVP | Reduced to 4 MVP gates |
| Dynamic task ID policy missing | Parent ID + sequence (AUTH-03.1) + TASKS.md write rules |
| State schema path inconsistency | Phase 0-5: unify state schema |
| Worker receives taskId only, no context | Phase 0-3: fix worker context passing |
| Phase 3 deprecation premature | Removed — extract decision only, no deprecation |
| Need engine/auto-layer module boundary | Phase 3-1: refactor into engine/ and auto/ |
| verify_cmd needed in contract | Added to contract schema |

### Round 2 — Gemini (council.sh)

| Finding | Resolution |
|---------|-----------|
| scheduler.js bug confirmed (successors vs predecessors) | Phase 0-1: explicit fix target |
| state.js bug confirmed (in_progress vs inProgress) | Phase 0-2: explicit fix target |
| TASKS.md sync protocol for human edits during execution | Added: hash-based detection + scope gate |
| Context sliding window for 30+ tasks | Added: current wave + dependencies only |

### Round 3 Final — Codex (council.sh)

| Finding | Resolution |
|---------|-----------|
| Scope gate MVP conflict (TASKS.md sync vs Post-MVP) | Unified: human edits → failure gate (MVP) |
| engine/auto boundary too late at Phase 3 | Moved to Phase 0-7: minimal adapter boundary |
| Phase 0 exit criteria missing | Added explicit exit criteria checklist |
| Conditional Go: Phase 0 must complete before auto | Acknowledged — Phase 0 is blocking gate |

### Round 3 Final — Gemini (council.sh)

| Finding | Resolution |
|---------|-----------|
| Contract must be measurable and verifiable | Acknowledged — prompt tuning in Phase 1-1 |
| Phase 2 should include intentional failure tests | Acknowledged — benchmark scenarios include failure paths |
| Full Go approved | v3.1 Go |
