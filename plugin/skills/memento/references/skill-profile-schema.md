# Skill Profile Schema

> Auto-generated from experience.jsonl. One profile per skill.
> Stored in `.claude/memento/profiles/<skill-name>.json`

## Profile Format

```json
{
  "skill": "maintenance",
  "last_updated": "2026-03-27T10:30:00+09:00",
  "capabilities": ["bugfix", "hotfix", "config_change"],
  "stats": {
    "total_uses": 47,
    "success": 38,
    "partial": 6,
    "failure": 3,
    "success_rate": 0.81,
    "avg_duration_sec": 210,
    "avg_tokens": 15200,
    "median_tokens": 12800
  },
  "best_for": [
    {
      "signature": {"intent": "bugfix", "scale": "single_file"},
      "success_rate": 0.95,
      "sample_size": 20
    },
    {
      "signature": {"intent": "bugfix", "scale": "multi_file"},
      "success_rate": 0.85,
      "sample_size": 13
    }
  ],
  "failure_patterns": [
    {
      "pattern": "cross_domain bugfix",
      "conditions": {"intent": "bugfix", "scale": "cross_domain"},
      "failure_rate": 0.67,
      "sample_size": 3,
      "suggestion": "Run /impact first to map cross-domain dependencies"
    }
  ],
  "trend": {
    "direction": "stable",
    "recent_10_success_rate": 0.80,
    "overall_success_rate": 0.81,
    "delta": -0.01
  },
  "efficiency": {
    "tokens_trend": "decreasing",
    "recent_10_avg_tokens": 13500,
    "overall_avg_tokens": 15200
  }
}
```

## Profile Generation Rules

### When to regenerate
- After every 5 new experience entries for that skill
- When `/memento health` or `/memento profile <skill>` is invoked

### capabilities
Extract from the set of `task_signature.intent` values where the skill has been used successfully. Only include intents with success_rate > 0.60.

### best_for
Group experiences by (intent, scale) pairs. Include pairs with:
- sample_size >= 3
- success_rate >= 0.70

Sort by success_rate descending.

### failure_patterns
Group experiences by (intent, scale, domain) combinations. Flag when:
- failure_rate >= 0.40
- sample_size >= 2

Each pattern should include a concrete `suggestion` — an actionable step to avoid the failure, such as running a prerequisite skill.

### trend.direction
Compare recent 10 runs to overall:
- `improving`: recent > overall + 0.05
- `declining`: recent < overall - 0.05
- `stable`: within ±0.05

### Minimum data threshold
Don't generate a profile until a skill has at least 3 experience entries. Below this, there isn't enough data for meaningful patterns.
