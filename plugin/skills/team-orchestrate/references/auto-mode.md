# Auto Mode (--mode=auto)

> Direct subagent dispatch via Task tool. No Agent Teams API needed.
> Absorbed from the former standalone `auto-orchestrate` skill.

## When to Use

| Task count | Recommended mode |
|-----------|-----------------|
| 1-30 | `--mode=auto` (default for small projects) |
| 30-50 | `--mode=auto` + Phase-level `/compact` |
| 50-200 | `--mode=thin` |
| 200+ | `--mode=thin --phase N` |

## Core Principles

1. Parse TASKS.md → build dependency graph
2. No-dependency tasks → parallel execution (Task tool, concurrent calls)
3. Dependent tasks → wait for predecessors, then execute sequentially
4. Phase complete → test/build verification → auto-merge to main
5. Failures don't stop the loop → report in final summary
6. Phase completion → Slack notification + user checkpoint

## Orchestrator Rules

The main agent (orchestrator) coordinates only — it never writes code directly.

**Allowed**: TASKS.md checkbox updates, CLAUDE.md updates, git commands, test/build commands
**Forbidden**: Source code writing, test code writing, implementation of any kind

## Git Worktree (Mandatory)

All phase work happens in a Git Worktree, never on main directly.

```bash
# Setup
git worktree add worktree/phase-1-feature -b phase-1-feature
cd worktree/phase-1-feature

# After phase completion
cd ../..
git merge phase-1-feature --no-ff -m "Phase 1 complete"
git worktree remove worktree/phase-1-feature
```

Pass worktree path to every subagent:

```
Task({
  subagent_type: "backend-specialist",
  description: "P1-T1.4: Implement object store",
  prompt: "Worktree: worktree/phase-1-feature\n..."
})
```

## Expert Subagents

| subagent_type | Role |
|---------------|------|
| `backend-specialist` | API, business logic, DB |
| `frontend-specialist` | React UI, state management |
| `database-specialist` | Schema, migrations |
| `test-specialist` | Test writing, quality verification |
| `security-specialist` | Security scan, vulnerability analysis |
| `3d-engine-specialist` | Three.js, IFC/BIM, 3D visualization |

## Phase Completion Workflow

```
Phase N complete
  → Run tests in worktree
  → Merge to main (--no-ff)
  → Slack notification (if webhook configured)
  → AskUserQuestion: [1] /compact + continue [2] Continue [3] Stop
```

## State File

```
.claude/orchestrate-state.json
```

Tracks: current phase, task status (pending/ready/in_progress/completed/failed), slack webhook URL.

## Frontend Demo Verification

After frontend task completion:
1. Check demo page exists
2. Screenshot verification (loading, error, empty, normal states)
3. Console error check
4. Output test guide before marking TASK_DONE

## Error Recording

Failed tasks must be recorded in CLAUDE.md with: task ID, error, retry count, status.
