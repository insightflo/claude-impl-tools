# Smart Router Algorithm

> Full specification for the 3-layer experience-weighted routing system.

## Overview

The router answers: "Given this task, which skill will most likely succeed?"

It blends two knowledge sources:
1. **Rules** — The existing workflow-guide decision tree (fast, deterministic, zero data needed)
2. **Experience** — Historical outcomes from experience.jsonl (learns over time)

## Algorithm

```python
def route(task_description, project_context):
    # Extract task signature from natural language
    sig = extract_signature(task_description)
    #   sig.intent, sig.scale, sig.domain, sig.keywords

    # --- Layer 1: Rule-based scoring ---
    rule_scores = workflow_guide_rules(project_context)
    # Returns: {"agile": 0.85, "maintenance": 0.70, "team-orchestrate": 0.60, ...}
    # This is the existing decision-algorithm.md logic, converted to scores

    # --- Layer 2: Experience-based scoring ---
    experiences = load_experience_store()
    similar = find_similar_experiences(sig, experiences, threshold=0.50)

    exp_scores = {}
    for skill_name, skill_experiences in group_by_skill(similar):
        exp_scores[skill_name] = weighted_success_rate(
            skill_experiences,
            recency_decay=0.95,      # Each day reduces weight by 5%
            similarity_weight=True    # Higher similarity → higher weight
        )

    # --- Layer 3: Blending ---
    total_experience = len(similar)
    alpha = min(0.7, 0.3 + total_experience * 0.04)
    # 0 experiences → alpha=0.30 (rules dominate)
    # 5 experiences → alpha=0.50 (balanced)
    # 10+ experiences → alpha=0.70 (experience dominates)

    final_scores = {}
    for skill in all_known_skills():
        r = rule_scores.get(skill, 0.0)
        e = exp_scores.get(skill, 0.5)  # No data → neutral
        final_scores[skill] = (1 - alpha) * r + alpha * e

    # --- Decision ---
    ranked = sorted(final_scores.items(), key=lambda x: -x[1])
    best_skill, best_score = ranked[0]
    runner_up = ranked[1] if len(ranked) > 1 else None

    return {
        "recommendation": best_skill,
        "confidence": best_score,
        "alpha": alpha,
        "rule_score": rule_scores.get(best_skill, 0),
        "exp_score": exp_scores.get(best_skill, 0.5),
        "alternative": runner_up,
        "experience_count": total_experience,
        "similar_experiences": similar[:5]  # Top 5 for display
    }
```

## Rule Score Conversion

The existing workflow-guide uses a waterfall (first match wins). Convert to scores:

| Rule condition | Primary skill | Score | Fallback skills |
|---------------|---------------|-------|-----------------|
| State file incomplete OR merge conflicts | recover | 1.0 | — |
| No TASKS.md, legacy exists | tasks-migrate | 0.95 | tasks-init: 0.70 |
| No TASKS.md | tasks-init | 0.95 | — |
| source_code + bugfix intent | maintenance | 0.85 | agile: 0.60 |
| source_code + incomplete > 0 | agile | 0.85 | maintenance: 0.55 |
| incomplete > 0, tasks < 30 | agile | 0.80 | — |
| incomplete >= 30 | team-orchestrate | 0.85 | agile: 0.50 |
| all completed | quality-auditor | 0.90 | checkpoint: 0.70 |

cmux override: When cmux is available, boost cmux variants by +0.10.

## Weighted Success Rate

```python
def weighted_success_rate(experiences, recency_decay, similarity_weight):
    total_weight = 0
    success_weight = 0
    now = current_timestamp()

    for exp in experiences:
        # Recency weight: exponential decay
        days_ago = (now - exp.ts).days
        w_recency = recency_decay ** days_ago

        # Similarity weight
        w_sim = exp.similarity_score if similarity_weight else 1.0

        # Combined weight
        w = w_recency * w_sim

        total_weight += w
        if exp.outcome.status == "success":
            success_weight += w
        elif exp.outcome.status == "partial":
            success_weight += w * 0.5  # Partial counts as half

    return success_weight / total_weight if total_weight > 0 else 0.5
```

## Edge Cases

### No experience data at all
Alpha stays at 0.30, exp_scores all 0.5 (neutral). Pure rule-based routing — identical to current workflow-guide behavior. Zero regression.

### Skill not in rules but has experience
If a skill has no rule_score (0.0) but strong experience score, it can still surface. At alpha=0.7 with exp_score=0.9: final = 0.3*0 + 0.7*0.9 = 0.63. This is how the system discovers effective skills that rules missed.

### Multiple skills tied
When top two scores are within 0.05 of each other, present both as viable options and let the user decide. Flag this as "close call — consider your preference."

### Confidence thresholds

| Confidence | Action |
|-----------|--------|
| >= 0.80 | Strong recommendation — proceed |
| 0.60-0.79 | Good recommendation — mention alternative |
| 0.40-0.59 | Weak — present top 2-3 options |
| < 0.40 | No good match — this is a genesis trigger |

## Integration with workflow-guide

Memento's router doesn't replace workflow-guide — it enhances Stage 2. When `/memento route` is called directly, it runs the full algorithm. When workflow-guide runs its Stage 2, it can optionally consult memento if experience data exists:

```
workflow-guide Stage 2 (modified):
  1. Run existing decision algorithm → rule_recommendation
  2. IF .claude/memento/experience.jsonl exists AND has > 5 entries:
       Run memento route → memento_recommendation
       IF memento_recommendation differs from rule_recommendation
         AND memento confidence > 0.75:
           Use memento_recommendation, note the override
  3. ELSE: Use rule_recommendation (current behavior)
```

This ensures backward compatibility: without experience data, nothing changes.
