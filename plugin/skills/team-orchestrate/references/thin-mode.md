# Thin Mode (--mode=thin)

> Ultra-minimal orchestrator context for 50-200 task projects.
> Absorbed from the former standalone `ultra-thin-orchestrate` skill.
> Achieves 76% context reduction by delegating all work to specialized subagents.

## Core Idea

```
Normal mode: main agent does everything → context explosion
Thin mode:   main agent is traffic cop → subagents do everything
```

| Metric | Normal (50 tasks) | Thin (200 tasks) |
|--------|-------------------|-------------------|
| Total context | ~160K tokens | ~38K tokens |
| Per-task average | ~3,200 tokens | ~190 tokens |
| Reduction | — | 76% |

## Absolute Rules

The orchestrator in thin mode:

**Forbidden:**
- Parsing TASKS.md directly (dependency-resolver does this)
- Writing detailed prompts (pass Task ID only)
- Analyzing results (task-executor handles this)
- Debugging errors (task-executor retries 10 times)
- AskUserQuestion at phase completion (auto-continue)
- Any user confirmation request (unattended automation)

**Required:**
- Read/write state files only
- Pass only Task IDs to subagents
- Process only DONE/FAIL responses
- Merge + continue immediately on phase completion
- Stop only on ALL_DONE

## Dedicated Subagents

### dependency-resolver
```
Input:  RESOLVE_NEXT
Output: READY:T1.3,T1.4 | PHASE_DONE:1 | ALL_DONE
```
Parses TASKS.md, computes dependency graph, returns executable tasks.

### task-executor
```
Input:  TASK_ID:T1.3
Output: DONE:T1.3 | FAIL:T1.3:reason
```
Fully autonomous task execution. Calls expert subagents internally. Retries up to 10 times.

## The Loop (never stops)

```
LOOP:
  1. Call dependency-resolver → get READY tasks
  2. If ALL_DONE → final report → EXIT (only exit point)
  3. If PHASE_DONE → auto-merge → auto-continue → GOTO LOOP
  4. For each ready task:
       Task(subagent_type="task-executor",
            prompt="TASK_ID:{id}",
            run_in_background=true)    ← CRITICAL for context savings
  5. Read output files for DONE/FAIL
  6. GOTO LOOP
```

`run_in_background=true` is the key — without it, all subagent work floods the main context.

## State File Schema

```json
{
  "version": "2.0",
  "mode": "thin",
  "project": "my-project",
  "execution": {
    "current_phase": 1,
    "worktree": "worktree/phase-1-feature",
    "started_at": "2026-01-21T09:00:00Z"
  },
  "tasks": {
    "pending": ["T1.5"],
    "ready": ["T1.3", "T1.4"],
    "in_progress": [],
    "completed": ["T1.1", "T1.2"],
    "failed": []
  }
}
```

## Error Handling

- Individual task failure: add to failed list, continue other tasks
- Dependency on failed task: dependency-resolver auto-blocks dependents
- All failures appear in final report

## CLI Options

| Option | Description |
|--------|-------------|
| `--mode=thin` | Activate thin mode |
| `--phase N` | Execute specific phase only |
| `--resume` | Resume interrupted work |
| `--dry-run` | Print execution plan only |
| `--parallel N` | Max parallel tasks (default: unlimited) |
