# Experience Log Schema

> Append-only JSONL format. One line per skill execution.

## Entry Format

```json
{
  "id": "exp_20260327_001",
  "ts": "2026-03-27T10:30:00+09:00",
  "skill": "maintenance",
  "trigger": "user_explicit",
  "task_signature": {
    "intent": "bugfix",
    "domain": "auth",
    "scale": "multi_file",
    "keywords": ["미들웨어", "세션", "토큰"]
  },
  "context": {
    "has_tasks_md": true,
    "task_count": 12,
    "incomplete_count": 5,
    "source_code": true,
    "cmux_available": false,
    "project_type": "fastapi"
  },
  "outcome": {
    "status": "success",
    "signals": {
      "user_proceeded": true,
      "user_corrected": false,
      "quality_gate_passed": true,
      "error_occurred": false,
      "re_invoked": false
    },
    "user_feedback": null
  },
  "metrics": {
    "duration_sec": 180,
    "tokens_used": 12400,
    "tool_calls": 23
  }
}
```

## Field Definitions

### id
Format: `exp_YYYYMMDD_NNN` — date + sequence number within that day.

### trigger
How the skill was invoked:
- `user_explicit` — User typed /skill-name directly
- `router_suggested` — workflow-guide or memento recommended it
- `auto_chained` — Another skill invoked it as part of a pipeline

### task_signature
The "fingerprint" of what the user was trying to do. Used for similarity matching.

**intent** (required):
| Value | Description |
|-------|-------------|
| `bugfix` | Fix a bug or error |
| `feature` | Add new functionality |
| `refactor` | Restructure without changing behavior |
| `review` | Code review, security review, audit |
| `deploy` | Ship, PR, release |
| `plan` | Planning, task creation, governance |
| `research` | Investigation, analysis, exploration |
| `design` | UI/UX design, design system |
| `maintenance` | Config change, dependency update, hotfix |
| `orchestrate` | Multi-agent or multi-AI coordination |

**domain**: Extract from file paths, module names, or keywords. Examples: `auth`, `payment`, `api`, `frontend`, `database`, `infra`.

**scale**:
| Value | Heuristic |
|-------|-----------|
| `single_file` | Change affects 1 file |
| `multi_file` | 2-10 files in same domain |
| `cross_domain` | Multiple domains involved |
| `system_wide` | Architecture-level change |

**keywords**: 3-5 most relevant terms from the task description.

### outcome.status
| Value | When |
|-------|------|
| `success` | Task completed, user satisfied |
| `partial` | Completed but with issues or rework needed |
| `failure` | Did not achieve the goal |
| `abandoned` | User switched to different approach |
| `unknown` | No feedback signal — exclude from stats |

### outcome.signals
Boolean indicators used to determine status. Multiple signals may be true.

### metrics
Optional but valuable for efficiency tracking:
- `duration_sec` — Wall clock time from skill start to end
- `tokens_used` — Total tokens consumed (if available)
- `tool_calls` — Number of tool invocations

## Similarity Matching

To find similar past experiences for a new task:

```
similarity(task_a, task_b) =
    0.40 * (intent_match)       +   # exact match = 1.0, else 0.0
    0.25 * (scale_match)        +   # exact = 1.0, ±1 step = 0.5, else 0.0
    0.20 * (keyword_overlap)    +   # Jaccard similarity of keyword sets
    0.15 * (domain_match)           # exact = 1.0, else 0.0
```

Scale ordering for ±1 step: single_file < multi_file < cross_domain < system_wide

Threshold for "similar": similarity >= 0.50
