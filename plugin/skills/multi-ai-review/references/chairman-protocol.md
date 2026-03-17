# Chairman Protocol (Stage 3)

After receiving Stage 1 + Stage 2 results, **the Chairman (Claude) follows this protocol.**

> See `evidence-rules.md` for scoring arbitration details.

---

## Step 1: Evidence Extraction

Before any consensus evaluation:

1. **Extract concrete findings** from each member:
   - File:line citations (Codex strength)
   - Structural observations (Gemini strength)
   - Severity labels assigned
2. **Run Done-When verification** (if preset defines them)
3. **Identify score gaps** ≥15 points per dimension

---

## Step 2: Consensus Evaluation

Analyze Cross-Review results and determine:

- **Consensus reached**: Members broadly agree, or disagreements are clearly resolved
- **Unresolved issues**: Opposing views on a core issue are still clashing
- **Divergent scores**: Score gap ≥15 requiring arbitration per Evidence Rules

---

## Step 3: Additional Round Decision

```
IF unresolved issues exist AND additional discussion would add value:
    → Run additional Cross-Review (up to 2 extra rounds)
    → Re-query with focused question on contention point
ELSE:
    → Proceed to final synthesis
```

**Constraints**:
- Maximum 3 Cross-Review rounds total (Stage 2 + 2 additional)
- Only core issues affecting decision — not mere opinion differences
- After 3 rounds: summarize as "divided opinion" + Chairman's judgment

---

## Step 4: Run Additional Cross-Review (if needed)

```bash
# JOB_DIR is the directory from the previous Stage
./skills/multi-ai-review/scripts/council.sh cross-review "$JOB_DIR"
```

**Focused Question example**:

> "A argues for approach X, while B argues for approach Y. Compare the trade-offs
> of each concretely, and provide evidence for which is more suitable in production."

---

## Step 5: Final Synthesis

After all rounds complete, synthesize in this format:

```markdown
## Chairman's Synthesis

### {{verdict_label}}: {{final_verdict}}

### Score Card

| Dimension   | Weight | Gemini | Codex | Evidence-Verified | Consensus | Grade |
|-------------|--------|--------|-------|-------------------|-----------|-------|
| Security    | 25%    | 75     | 58    | yes (src/auth:45) | 63.7      | D     |
| Performance | 20%    | 80     | 82    | yes               | 81.0      | B     |
| ...         | ...    | ...    | ...   | ...               | ...       | ...   |
| **Overall** | **100%** | —     | —     | —                 | **XX.X**  | **X** |

### Severity Summary

- Critical: [n items] — [summary]
- High: [n items] — [summary]
- Medium: [n items]
- Low: [n items]

### Points of Consensus

- [Points the members agreed on]

### Disagreements and Resolution

- [Issue] → [Chairman judgment + rationale]

### Recommendations

1. [High-priority action]
2. [Additional considerations]

### Review Metadata

- Domain: [preset name]
- Rounds: [Stage 1 + N additional]
- Consensus Level: [Strong / Moderate / Divergent]
- Composite Score: [score]/100 ([grade])
- Done-When Checks: [passed / failed — list failures]
```

---

## Constraints Summary

| Constraint | Rule |
|------------|------|
| Max rounds | 3 Cross-Review total |
| Additional round criteria | Core issues only |
| Infinite loop prevention | After 3 rounds → "divided opinion" |
| Verification required | All adjustments via grep/file read/test |
| Pre-deploy gate | Done-When must pass before approval |
