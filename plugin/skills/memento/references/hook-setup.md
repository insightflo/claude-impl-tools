# Automated Experience Logging via Hooks

> How to set up automatic experience capture without manual `/memento log` calls.

## Approach

Claude Code hooks can observe tool usage patterns. The experience logger works in two phases:

### Phase 1: Skill Start Detection

When a Skill tool is invoked, the hook captures:
- Which skill was triggered
- Timestamp
- Current project context (task count, source code presence)

### Phase 2: Outcome Detection

The outcome is determined from subsequent user interaction:
- Next user message sentiment
- Whether another skill was invoked immediately after
- Whether the same skill was re-invoked (retry signal)

## Hook Configuration

Add to `.claude/settings.json` or `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'echo \"{\\\"ts\\\": \\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\\", \\\"skill\\\": \\\"$CLAUDE_TOOL_INPUT\\\"}\" >> .claude/memento/skill-starts.jsonl'",
            "timeout": 5,
            "statusMessage": "Logging skill execution..."
          }
        ]
      }
    ]
  }
}
```

This captures skill invocation events. The outcome assessment happens within the agent's context — it observes whether the user was satisfied based on their next messages.

## Manual Logging Pattern

Until hooks are fully automated, use this pattern after significant skill executions:

```
After /maintenance completes a bugfix:
  → /memento log
  → Agent infers outcome from the conversation context
  → Entry appended to experience.jsonl
```

## Bootstrap: Seeding Experience Data

For a new project with no experience data, you can bootstrap from git history:

1. Read recent git log for skill-related commits
2. Identify patterns: which skills were likely used for which tasks
3. Create approximate experience entries with `trigger: "inferred"`
4. These have lower weight in routing (similarity multiplied by 0.7)

This gives the router something to work with from day one, while clearly marking inferred data as less reliable than observed data.

## Privacy and Scope

- Experience data is **project-scoped** (stored in `.claude/memento/` within the project)
- No experience data is sent to external services
- Add `.claude/memento/` to `.gitignore` if the project is shared and you want per-developer experience
- Keep it tracked if you want team-shared experience (recommended for small teams)
