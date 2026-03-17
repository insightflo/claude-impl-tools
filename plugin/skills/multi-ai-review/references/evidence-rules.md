# Chairman Evidence Weighting Rules (v4.1.0)

> **Why these rules exist**: Code-level evidence (file:line citations) is more reliable than structural impressions. Without explicit verification, scores can be arbitrarily inflated.

---

## Core Principles

1. **Evidence Hierarchy** — Codex's file:line citations outrank Gemini's structural scores
2. **Verification Before Increases** — Score bumps require repo verification (grep, file read, test run)
3. **Pre-Deploy Done-When** — Run Done-When grep checks BEFORE deployment, not after 500 errors
4. **Delta Arbitration** — Score gap ≥15 triggers mandatory verification (no simple averaging)
5. **Domain Weighting** — In `code-review` and `project-gate`, Codex findings receive 2× weight when backed by concrete evidence

---

## Rule 1: Evidence Hierarchy

When Codex provides specific file:line citations and Gemini provides only structural assessment:

- **Prefer Codex** for security, performance, and correctness issues
- **Gemini's structural insight** is still valuable for architecture, UX, and alternative approaches
- **Chairman does NOT average** the two — weights evidence over impression

**Example**:
- Codex: "`src/auth/jwt.ts:45` — missing algorithm validation allows 'none' algorithm"
- Gemini: "Authentication architecture is generally solid, but could use more defense-in-depth"
→ **Chairman prioritizes the Codex finding** (concrete > impression)

---

## Rule 2: Verification Before Score Increases

**Prohibited**: Raising scores based solely on "feels too harsh" or "seems unfair"

**Required**: Before increasing any member's score or adjusting their findings:

```bash
# Verify the claim exists in the codebase
grep -r "claimed_pattern" src/
# OR read the specific file
cat src/path/to/file.ts
# OR run the relevant test
npm test -- --grep "describes the issue"
```

**Score adjustment workflow**:
1. Run verification command
2. Document the result (found / not found / partially correct)
3. If verified → keep score as-is
4. If false positive → adjust with explanation
5. **Never adjust without verification**

---

## Rule 3: Pre-Deploy Done-When Verification

Done-When criteria must be verified **before** deployment, not after.

When a preset defines Done-When checks:

```yaml
# Example from code-review.yaml
done_when:
  - pattern: "algorithm.*['\"]none['\"]"
    context: "src/auth/"
    explanation: "JWT 'none' algorithm vulnerability"
  - pattern: "process\.env\.(API_KEY|SECRET)"
    context: "src/"
    explanation: "Hardcoded secrets in environment calls"
```

**Required action** before marking task complete:

```bash
# Run Done-When grep checks
for check in "${done_when[@]}"; do
  grep -rn "${check[pattern]}" "${check[context]}" && {
    echo "FAIL: ${check[explanation]}"
    exit 1
  }
done
```

If Done-When checks fail:
- **Block deployment** — return non-zero exit code
- **Report findings** in Critical severity section
- **Do NOT proceed** to final approval until resolved

---

## Rule 4: Delta Arbitration (Score Gap ≥ 15)

When members' scores differ by ≥15 points on any dimension:

| Gemini | Codex | Delta | Chairman Action |
|--------|-------|-------|-----------------|
| 85 | 58 | 27 | **Verify** — Cannot average |
| 72 | 60 | 12 | Can average (within threshold) |
| 90 | 70 | 20 | **Verify** — Cannot average |

**Arbitration workflow**:

1. **Identify the gap**: Which dimension shows ≥15 point difference?
2. **Extract evidence**: What specific findings justify each score?
3. **Run verification**: Use grep, file reads, or tests to validate
4. **Resolve**:
   - If Codex's finding is verified → adopt Codex score
   - If Gemini's finding is verified → adopt Gemini score
   - If both valid → record as "divergent" and explain why
   - If neither verified → Chairman's own assessment

**Report format for divergent scores**:

```markdown
### Dimension: [dimension_name] (Divergent)

- **Gemini**: [score]/100 — [reasoning]
- **Codex**: [score]/100 — [reasoning with file:line]
- **Verification**: [command run and result]
- **Resolution**: [adopted score + rationale]
```

---

## Rule 5: Domain-Specific Weighting

In `code-review` and `project-gate` presets, **Codex receives 2× weight** when:

- Finding includes file:line citation
- Finding is about security, performance, correctness, or maintainability
- Finding passes Done-When verification

**Weighted consensus formula**:

```javascript
// For code-review and project-gate only
if (preset === 'code-review' || preset === 'project-gate') {
  if (codex.hasFileLineCitation() && codex.verified()) {
    consensus = (codex.score * 2 + gemini.score) / 3;
  } else {
    consensus = (codex.score + gemini.score) / 2;
  }
}
```

**Example calculation**:

| Dimension | Gemini | Codex | Weighted Consensus |
|-----------|--------|-------|-------------------|
| Security | 75 | 58 (verified `src/auth/jwt.ts:45`) | **(58×2 + 75)/3 = 63.7** |
| Architecture | 85 | 70 (no citation) | (85 + 70)/2 = 77.5 |

---

## Summary Table

| Rule | Trigger | Action |
|------|---------|--------|
| Evidence Hierarchy | Concrete vs structural | Prioritize file:line |
| Verification Required | Score adjustment | Run grep/file read before changing |
| Pre-Deploy Done-When | Task completion | Block if checks fail |
| Delta Arbitration | Score gap ≥15 | Verify, don't average |
| Domain Weighting | code-review/project-gate + verified Codex | 2× weight |
