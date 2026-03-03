# Hook Gate Protocol

> **Protocol**: How orchestrate-standalone integrates with project-team hooks

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Pre-Dispatch Gate                                                │
│   BEFORE task execution                                         │
│   - policy-gate: Check permissions, validate standards          │
│   - risk-gate: Analyze impact, assess risk                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Task Execution                                                   │
│   - Worker pool executes task                                   │
│   - Claude CLI with agent role                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Post-Task Gate                                                   │
│   AFTER task completion                                        │
│   - contract-gate: Validate API contracts                     │
│   - docs-gate: Update architecture, changelog                  │
│   - task-sync: Update TASKS.md checkboxes                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Barrier Gate (after each layer)                                │
│   - quality-gate: Check code quality, tests                     │
│   - security-scan: Run security checks                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hook Input Format

```json
{
  "hook_event_name": "orchestrate_gate",
  "tool_name": "orchestrate-standalone",
  "tool_input": {
    "phase": "pre-dispatch | post-task | barrier",
    "task": { "id": "T1.1", "description": "...", ... },
    "layer": 0,
    "tasks": ["T1.1", "T1.2"]
  }
}
```

---

## Hook Output Format

```json
{
  "hookSpecificOutput": {
    "additionalContext": {
      "decision": "allow | deny",
      "reason": "Explanation...",
      "warnings": ["..."]
    }
  }
}
```

---

## Available Hooks

| Hook | Stage | Purpose | Required |
|------|-------|---------|----------|
| **policy-gate** | pre-dispatch | Permission + standards validation | ✅ |
| **risk-gate** | pre-dispatch | Impact + risk assessment | ✅ |
| **contract-gate** | post-task | API contract validation | ✅ |
| **docs-gate** | post-task | Architecture + changelog | ✅ |
| **task-sync** | post-task | TASKS.md update | ✅ |
| **quality-gate** | barrier | Quality checks | ✅ |
| **security-scan** | barrier | Security scanning | ✅ |

---

## Gate Flow Logic

### Pre-Dispatch

```python
for task in layer:
    result = run_hook('policy-gate', {task, phase: 'pre-dispatch'})
    if not result.passed:
        BLOCK(task, reason="policy-gate failed")
        return

    result = run_hook('risk-gate', {task, phase: 'pre-dispatch'})
    if not result.passed and task.risk != 'low':
        WARN(task, reason="risk-gate warning")
        # Continue for low risk, block for medium/high
```

### Post-Task

```python
for task in layer:
    result = run_hook('contract-gate', {task, phase: 'post-task'})
    if not result.passed:
        LOG(task, reason="contract-gate failed")
        # Continue but flag for review

    run_hook('docs-gate', {task, phase: 'post-task'})
    run_hook('task-sync', {task, phase: 'post-task'})
```

### Barrier

```python
result = run_hook('quality-gate', {layer, tasks: layer_task_ids})
if not result.passed:
    BLOCK_LAYER(reason="quality-gate failed")

result = run_hook('security-scan', {layer, tasks: layer_task_ids})
if not result.passed:
    BLOCK_LAYER(reason="security-scan failed")
```

---

## Integration Points

### With project-team Hooks

Located at: `project-team/hooks/`

```bash
.claude/hooks/
├── policy-gate.js       # ✅ Integrated
├── risk-gate.js         # ✅ Integrated
├── contract-gate.js     # ✅ Integrated
├── docs-gate.js          # ✅ Integrated
├── quality-gate.js       # ✅ Existing
├── security-scan.js      # ✅ Existing
└── task-sync.js          # ✅ Existing (separate)
```

---

## Error Handling

| Gate | Fail Behavior |
|------|--------------|
| policy-gate | BLOCK - Cannot proceed without permission |
| risk-gate | WARN - Allow low risk, block medium/high |
| contract-gate | LOG - Flag for review, continue |
| docs-gate | LOG - Continue, update is optional |
| task-sync | LOG - Update best effort |
| quality-gate | BLOCK - Must pass before next layer |
| security-scan | BLOCK - Must pass before next layer |

---

## Hook Installation Status

| Mode | Hooks Installed |
|------|-----------------|
| **lite** | policy-gate, security-scan |
| **standard** | + quality-gate, contract-gate |
| **full** | + risk-gate, docs-gate |

**Note**: If hook is missing, gate is **skipped** (not a failure).

---

## CLI Integration

Hooks are executed via Node.js:

```bash
node .claude/hooks/policy-gate.js < input.json
```

The orchestrate-standalone script (`orchestrate.sh`) calls hooks via `gate-chain.js`.

---

**Last Updated**: 2026-03-03
