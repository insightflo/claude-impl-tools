---
name: team-orchestrate
description: Hierarchical agent orchestration using Claude Code native Agent Teams. Analyzes TASKS.md, creates a team via TeamCreate, spawns teammates with Agent(team_name), and coordinates via shared TaskList + SendMessage. Use this for 30+ task projects requiring parallel execution with governance.
triggers:
  - /team-orchestrate
  - 에이전트 팀 실행
  - 팀 오케스트레이트
version: 2.0.0
updated: 2026-03-16
---

# Agent Teams Orchestration

> **Goal**: Parallel agent execution using Claude Code native Agent Teams API.
>
> **v2.0**: Uses TeamCreate + TaskCreate + Agent(team_name) + SendMessage for real
> Agent Teams with mailbox communication, shared task lists, and governance hooks.

---

## Prerequisite Checks (auto-run on activation)

1. **TASKS.md exists**: Must be at project root.
   - Missing → "Create one first with `/tasks-init`."

2. **TASKS.md format**: Must include `deps:` and `domain:` fields.
   - Invalid → "Convert with `/tasks-migrate`."

3. **Agent Teams enabled**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings.
   - Missing → "Run `project-team/install.sh --local --mode=team`."

---

## Architecture: 2-Level Team

```
Level 0 — Team Lead (this session)
  │
  ├── architecture-lead (Teammate)  — backend, api, database tasks
  ├── qa-lead (Teammate)            — test, security, quality tasks
  └── design-lead (Teammate)        — frontend, ui, design tasks

Communication: SendMessage (bidirectional)
Task coordination: Shared TaskList (TeamCreate → TaskCreate → TaskUpdate)
Governance: TeammateIdle hook + TaskCompleted hook
```

Each teammate works autonomously on assigned tasks, communicates via SendMessage,
and goes idle between turns (this is normal — idle ≠ done).

---

## Execution Flow

### Step 1: Analyze TASKS.md

Run domain-analyzer to classify tasks by domain and assign to teammates:

```bash
node skills/team-orchestrate/scripts/domain-analyzer.js --tasks-file TASKS.md --json
```

Output: `{ leader, teammates: [{ agent, taskIds, domains, ... }] }`

### Step 2: Create Team

```
TeamCreate(
  team_name = "{project-name}",
  description = "Agent team for {project-name}: {teammate-count} teammates, {task-count} tasks"
)
```

### Step 3: Create Tasks in Shared TaskList

For each incomplete task from TASKS.md, create a shared task:

```
TaskCreate(
  subject = "T1.1: User API design",
  description = "Design REST endpoints for user domain. deps: []. domain: backend. risk: low."
)
```

Set dependencies after creation:

```
TaskUpdate(task_id = "2", blockedBy = ["1"])
```

### Step 4: Spawn Teammates

For each active teammate from domain-analyzer output, spawn with Agent:

```
Agent(
  subagent_type = "builder",
  team_name = "{project-name}",
  name = "architecture-lead",
  prompt = "You are architecture-lead on team {project-name}.
    Your domains: backend, api, database.

    Workflow:
    1. Check TaskList for tasks assigned to you
    2. Work on one task at a time
    3. After completing each task, call TaskUpdate(status='completed')
    4. Then check TaskList again for the next available task
    5. Update TASKS.md with [x] for each completed task
    6. Send a message to team-lead when you hit a blocker

    {cli_hint}"
)
```

**CLI hint** (if `cli` is set in team-topology.json):
```
CLI hint: For design subtasks, you may invoke `gemini` CLI via Bash if available.
Check: command -v gemini
Usage: echo '<subtask prompt>' | gemini
Always validate CLI output before applying.
```

### Step 5: Assign Tasks

Assign tasks to teammates based on domain-analyzer output:

```
TaskUpdate(task_id = "1", owner = "architecture-lead")
TaskUpdate(task_id = "5", owner = "design-lead")
TaskUpdate(task_id = "8", owner = "qa-lead")
```

### Step 6: Monitor and Coordinate

While teammates work:
- **Receive messages** automatically (no polling needed)
- **Resolve blockers** when teammates report issues via SendMessage
- **Handle plan approvals** via SendMessage protocol:
  ```
  SendMessage(
    to = "architecture-lead",
    message = { "type": "plan_approval_response", "request_id": "...", "approve": true }
  )
  ```
- **Reassign tasks** if a teammate is stuck: `TaskUpdate(task_id, owner="other-lead")`
- **Check progress** via `TaskList` periodically

### Step 7: Completion and Shutdown

When TaskList shows all tasks completed:

1. Verify TASKS.md is fully updated (`[x]` for all done tasks)
2. Gracefully shut down each teammate:
   ```
   SendMessage(to = "architecture-lead", message = { "type": "shutdown_request", "reason": "All tasks complete" })
   SendMessage(to = "design-lead", message = { "type": "shutdown_request", "reason": "All tasks complete" })
   SendMessage(to = "qa-lead", message = { "type": "shutdown_request", "reason": "All tasks complete" })
   ```
3. Report final status to user

---

## Configuration

### team-topology.json

`skills/team-orchestrate/config/team-topology.json` controls domain-to-teammate mapping
and optional CLI routing. See the file for full schema.

### Optional Multi-AI CLI Routing

Set `cli` field per teammate to hint external CLI usage:

| `cli` value | Effect |
|-------------|--------|
| `null` | Claude only (default) |
| `"gemini"` | Teammate may call `gemini` CLI via Bash for subtasks |
| `"codex"` | Teammate may call `codex exec` via Bash for subtasks |

The teammate (Claude) decides when to invoke the CLI, validates the result, and hooks still apply.

### Governance Hooks

Registered in `.claude/settings.json`:
- `TeammateIdle` → fires when a teammate finishes a turn
- `TaskCompleted` → fires when a task is marked complete
- `task-progress-gate` (Stop) → warns if TASKS.md not updated

---

## Key Behaviors

**Teammates go idle between turns** — this is normal. Idle means waiting for input, not done.
Send a message to wake an idle teammate.

**Task discovery is automatic** — teammates check TaskList after completing each task
and claim the next available unblocked task.

**TASKS.md sync is mandatory** — after each task completion, the teammate must update
TASKS.md with `[x]`. The task-progress-gate Stop hook catches any missed updates.

---

## Usage

```bash
/team-orchestrate                          # default
/team-orchestrate --tasks-file path/to    # custom TASKS.md
```

---

## Reference Documents

- `references/agent-teams-api.md` — Full Agent Teams API reference (TeamCreate, SendMessage, etc.)

---

**Last Updated**: 2026-03-16 (v2.0.0 — Native Agent Teams API)
