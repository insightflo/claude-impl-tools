# Vibelab Extension Skills Integration with Claude Project Team

> **Document Version**: 1.0.0
> **Last Updated**: 2026-02-08
> **Status**: Published

## Overview

This document describes how the 5 **Vibelab Extension Skills** (우리스킬) integrate with **Claude Project Team**'s agent system, hooks, and governance framework.

The Vibelab Extension Skills are specialized auxiliary skills built on top of the core vibelab ecosystem (v1.9.2+). They complement Claude Project Team by providing:

1. **Sprint Management** - Layered development (Skeleton→Muscles→Skin)
2. **Multi-AI Review** - Collaborative review with Claude+Gemini+GLM
3. **Quality Auditing** - Pre-deployment comprehensive validation
4. **Work Recovery** - Automatic recovery from interruptions
5. **Workflow Guidance** - Intelligent skill routing (39 skills total)

---

## Integration Architecture

### System Components

```
┌────────────────────────────────────────────────────────────────┐
│                  Claude Project Team v1.0.0                     │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 9 Agents (Project Manager, Chief Architect, QA, etc.)    │   │
│ ├──────────────────────────────────────────────────────────┤   │
│ │ 10 Hooks (Quality Gate, Permission Checker, etc.)        │   │
│ ├──────────────────────────────────────────────────────────┤   │
│ │ 5 Skills (/impact, /deps, /architecture, /changelog)    │   │
│ └──────────────────────────────────────────────────────────┘   │
│                          ↓ Integrates with                      │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  Vibelab Extension Skills v2.2.0 (Hook System: v1.9.2)    │  │
│ ├────────────────────────────────────────────────────────────┤  │
│ │ ✓ agile         - Sprint Management (Horizontal Slicing)  │  │
│ │ ✓ multi-ai-review - Claude+Gemini+GLM Collaboration      │  │
│ │ ✓ quality-auditor - Pre-deployment Comprehensive Audit    │  │
│ │ ✓ recover        - Universal Work Recovery Hub            │  │
│ │ ✓ workflow-guide - 39-Skill Meta Router                   │  │
│ └────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Information Flow

```
Project Manager Request
    ↓
Skill Router Hook
    ├─→ skill-router (auto-detect appropriate skill)
    ├─→ session-memory-loader (restore previous context)
    └─→ context-guide-loader (inject Constitution)
    ↓
Vibelab Extension Skill Execution
    ├─→ /agile (sprint/layer execution)
    ├─→ /multi-ai-review (MCP orchestration)
    ├─→ /quality-auditor (comprehensive validation)
    ├─→ /recover (interruption recovery)
    └─→ /workflow-guide (intelligent routing)
    ↓
Claude Project Team Hooks
    ├─→ quality-gate (verify completion criteria)
    ├─→ standards-validator (check coding standards)
    ├─→ interface-validator (analyze API impacts)
    └─→ cross-domain-notifier (alert stakeholders)
    ↓
Project Manager Review & Approval
```

---

## Integration Matrix

### Skill ↔ Agent Integration

#### 1. Agile Skill Integration

| Scenario | Agent | Agile Command | Integration Point | CPT Hook |
|----------|-------|---------------|-------------------|----------|
| **Sprint Planning** | Project Manager | `/agile start` | Task generation | quality-gate |
| **Layer Execution** | Domain Developer | `/agile auto` | Skeleton→Muscles→Skin | standards-validator |
| **Change Iteration** | Part Leader | `/agile iterate` | Impact analysis | interface-validator |
| **Layer Completion** | Chief Architect | `/agile review` | Architecture validation | architecture-updater |
| **Task Tracking** | Project Manager | `/agile status` | Progress reporting | changelog-recorder |

**Key Integration Points:**

```
Project Manager initializes sprint
    ↓
/agile start → generates TASKS.md
    ↓
Chief Architect reviews plan
    ↓
/agile auto executes layers
    ├─→ Skeleton: Quality Gate checks lint + build
    ├─→ Muscles: Standards Validator checks SOLID + patterns
    └─→ Skin: Interface Validator checks API changes
    ↓
Part Leaders coordinate domain tasks
    ↓
Post-layer notification triggers cross-domain notifier hook
    ↓
QA Manager approves layer completion
```

**Example Workflow:**
```
> /agile start
Creates sprint plan with Skeleton→Muscles→Skin layers

[Project Manager approves]

> /agile auto
Executes Skeleton layer
├─ Lint check (via quality-gate hook)
├─ Build verification
└─ notify_user with screenshot

[Chief Architect reviews Skeleton]

Executes Muscles layer
├─ Standards validation (via standards-validator hook)
├─ SOLID principle check
└─ notify_user with feature demo

[Part Leaders review Muscles]

Executes Skin layer
├─ Interface validation (via interface-validator hook)
├─ API impact analysis
└─ cross-domain-notifier alerts affected domains

[QA Manager final approval]
```

---

#### 2. Multi-AI Review Skill Integration

| Scenario | Trigger | MCP Orchestration | CPT Agent | CPT Hook |
|----------|---------|-------------------|-----------|----------|
| **Code Review** | PR creation | GLM + Gemini (async) | Chief Architect | standards-validator |
| **Architecture Review** | Major design change | Gemini (design analysis) + GLM (feasibility) | Chief Architect | interface-validator |
| **Spec Compliance** | Phase completion | 3-stage review (GLM→Gemini→Claude) | QA Manager | quality-gate |
| **API Change Impact** | Contract change | Cross-domain analysis | Project Manager | cross-domain-notifier |

**Key Integration Points:**

```
Domain Developer proposes change
    ↓
/multi-ai-review triggered (or auto via hook)
    ↓
Round 1: Parallel Initial Review
├─ GLM: Spec Compliance (SOLID, patterns)
└─ Gemini: Creative Review (innovations, alternatives)
    ↓
Round 2: Cross-Review (Debate Stage)
├─ GLM critiques Gemini's suggestions
└─ Gemini validates GLM's technical findings
    ↓
Round 3: Consensus Building
└─ Resolve conflicts, synthesize recommendations
    ↓
Claude Integration (Final Decision)
├─ Tree of Thought analysis
├─ Reflection validation
└─ Generate final review report
    ↓
Chief Architect approves/vetoes
    ↓
If API change detected:
└─ interface-validator hook → cross-domain-notifier
    ↓
Affected domains notified (Part Leaders)
```

**OAuth MCP Integration (v2.2.0):**

```bash
# Initialize Gemini OAuth (API key not needed)
mcp__gemini__auth_login

# Subsequent /multi-ai-review calls use OAuth tokens automatically
# No API key management required
```

---

#### 3. Quality Auditor Skill Integration

| Audit Stage | Validator | Chief | QA Manager | Hook |
|-------------|-----------|-------|-----------|------|
| **Spec Compliance** | GLM + Custom | ✓ Review | ✓ Block/Approve | standards-validator |
| **Code Quality** | Static Analysis | ✓ Veto | ✓ Checklist | quality-gate |
| **Test Coverage** | /coverage skill | ✓ Verify | ✓ Enforce 80%+ | quality-gate |
| **DDD Validation** | Demo screenshots | ✓ Review | ✓ Approve | risk-area-warning |
| **Browser Check** | Playwright MCP | - | ✓ Final check | - |

**Key Integration Points:**

```
Phase complete / Deployment imminent
    ↓
/audit triggered by QA Manager
    ↓
Stage 1: Spec Compliance Review
├─ Read planning docs (01-prd.md, 02-trd.md)
├─ Validate implementation matches PRD
├─ Check for YAGNI violations
└─ standards-validator hook checks coding conventions
    ↓
Stage 2: Code Quality Review
├─ SOLID principles analysis
├─ Security (Guardrails check)
├─ Performance review
└─ standards-validator hook validates patterns
    ↓
Stage 3: DDD Validation
├─ Demo pages exist for each feature
├─ Screenshots match mockups (design/)
└─ Console has no errors
    ↓
Stage 4: Test Execution
├─ Run test suite (npm test / pytest)
├─ Check coverage ≥ 80%
└─ quality-gate hook blocks if coverage < threshold
    ↓
Stage 5: Browser Validation (if playwright available)
├─ Screenshot comparison
├─ Responsive design check
└─ Interaction verification
    ↓
Quality Report Generated
    ├─ 🔴 Critical Issues → /systematic-debugging
    ├─ 🟠 High Issues → /agile iterate
    ├─ 🟡 Medium Issues → /code-review
    └─ 🟢 Low Issues → Tech debt backlog
    ↓
QA Manager Decision
├─ PASS (90+) → Release approved
├─ CAUTION (70-89) → Minor fixes, then re-audit
└─ FAIL (<70) → Major fixes, re-audit required
    ↓
Post-audit linked hooks
├─ Post-edit-analyzer (detect security patterns)
└─ Git-commit-checker (warn before commit)
```

**Audit Report Triggers Skill Chain:**

```
Quality Audit: 78% (CAUTION)
    ├─ Issue: Spec mismatch on payment flow
    │  └─ Recommendation: /agile iterate "Update payment UI"
    │
    ├─ Issue: Test coverage 75% (need 80%)
    │  └─ Recommendation: /coverage --uncovered app/services/
    │     → Then add tests → /powerqa
    │
    ├─ Issue: Convention violation in error messages
    │  └─ Recommendation: /code-review with standards focus
    │
    └─ All issues resolved? → Re-run /audit
```

---

#### 4. Recover Skill Integration

| Interruption Type | Detection Method | Recovery Path | CPT Agent |
|-------------------|------------------|---------------|-----------|
| **CLI Crash** | .claude/orchestrate-state.json | `/auto-orchestrate --resume` | Project Manager |
| **Agile Mid-Sprint** | task.md `[/]` status | `/agile status` → `/agile run {task-id}` | Part Leader |
| **Worktree Issues** | git worktree list | Git cleanup → reassign tasks | Chief Architect |
| **Incomplete Code** | Parse syntax errors | `/systematic-debugging` → fix → resume | Domain Developer |
| **Quality Gate Failure** | Previous /audit report | Re-execute recommended skill chain | QA Manager |

**Key Integration Points:**

```
Work interruption detected
    ↓
/recover auto-triggered (via error-recovery-advisor hook)
    ↓
Analysis Phase:
├─→ Check .claude/orchestrate-state.json (last completed task)
├─→ Check task.md for [/] items (in-progress)
├─→ Scan Git worktrees for unmerged branches
├─→ Detect incomplete code (unclosed brackets, TODOs)
└─→ Review hook logs for failed validations
    ↓
Situation Assessment:
├─→ Orchestrate state: T2.5 was last completed
│   Action: `/auto-orchestrate --resume` from T2.6
│
├─→ Agile sprint: Muscles layer incomplete
│   Action: `/agile run T1.8` (next incomplete task)
│
├─→ Worktree drift: phase-2-auth has 5 unpushed commits
│   Action: `/agile status` → review changes → git push
│
├─→ Test failures: previous /audit found 3 critical issues
│   Action: `/systematic-debugging` → fix → `/audit` re-run
│
└─→ Multi-scenario: CLI crashed mid-code-review
    Action: `/recover` → `/multi-ai-review --resume` → continue
    ↓
Recovery Execution:
├─→ Restore session context (via session-memory-loader hook)
├─→ Display previous state snapshot
├─→ Show recommended next action
└─→ Ask user: Auto-resume or manual selection?
    ↓
Post-Recovery:
├─→ Verify hook state (quality-gate, standards-validator)
├─→ Resume at correct checkpoint
└─→ Notify Project Manager of recovery
```

**Skill Chain After Recovery:**

```
/recover → Identifies test failure as root cause
    ↓
Recommends: /systematic-debugging
    ↓
After fix: /verification-before-completion
    ↓
Passes? → Continue previous work
    ↓
Fails? → /recover again (with updated context)
```

---

#### 5. Workflow Guide Skill Integration

This meta-skill routes to appropriate skills based on project state. It acts as the **intelligent dispatcher** for both Claude Project Team agents and vibelab skills.

| Project State | Detected By | Recommended Skill | CPT Agent Role |
|---------------|-------------|-------------------|-----------------|
| Idea only | No docs | `/neurion` → `/socrates` | Project Manager |
| Planning incomplete | No 06-tasks.md | `/tasks-generator` | Project Manager |
| Code ready | TASKS.md exists | `/agile auto` or `/auto-orchestrate` | Part Leader |
| Mid-development | tasks.md [/] found | `/agile iterate` | Domain Developer |
| Work interrupted | .claude files | `/recover` | Any (auto-detect) |
| API mismatch | specs/ drift | `/sync` | Chief Architect |
| Feature complete | all tasks [x] | `/trinity` → `/audit` | QA Manager |
| Ready for release | audit PASS | `/verification-before-completion` | QA Manager |

**Key Integration Points:**

```
User requests guidance
    ↓
/workflow executes (or auto-triggered by skill-router hook)
    ↓
Stage 1: Silent Project Analysis
├─→ Check docs/planning/ (PRD, TRD, TASKS.md)
├─→ Examine codebase (package.json, Cargo.toml)
├─→ Scan .claude/ (orchestrate-state.json, progress.txt)
├─→ Review git status (branches, worktrees)
└─→ Detect specs/ folder changes (v1.8.1+)
    ↓
Stage 2: State Classification
├─→ Categorize: Ideation | Planning | Implementation | Validation | Release
├─→ Sub-state: Fresh | In-progress | Blocked | Complete
└─→ Risk level: Green | Yellow | Red
    ↓
Stage 3: Skill Recommendation
├─→ Primary skill (highest confidence)
├─→ 2-3 alternatives (context-dependent)
└─→ Reasoning (why this skill?)
    ↓
Example Output:
"Current State: Implementation Mid-way
 ├─ Progress: 14/30 tasks complete (Muscles layer)
 ├─ Blockers: 2 tests failing in payment service
 └─ Recommendation:
     ⭐ PRIMARY: /systematic-debugging (fix test failures)
       Then: /agile run T1.15 (resume task)
     ALT: /powerqa (auto-QA cycling)
     ALT: /recover (reset and resume)"
    ↓
Stage 4: Skill Chain Execution
└─→ Execute recommended primary skill
    └─→ Upon completion, offer next step suggestions
```

**Hook Ecosystem Integration:**

```
/workflow decision-making
    ↓
Informed by Hook Data:
├─ skill-router hook: Recent skill usage patterns
├─ session-memory-loader: Previous session state
├─ error-recovery-advisor: Known failure modes
└─ architecture-updater: Latest ADRs and decisions
    ↓
Output guides user through:
├─ Immediate action (next 30 minutes)
├─ Follow-up skill (after completion)
└─ Risk mitigations (if needed)
```

---

## Workflow Examples

### Scenario 1: Multi-Domain API Change

**Setup**: Orders domain needs new fields from Accounts API

**Flow**:
```
1. Project Manager requests coordination
   > /workflow

2. Workflow Guide detects:
   - Code ready (TASKS.md exists)
   - API change needed (interface impact)

3. Recommended path:
   a) /impact orders/api/order-service.ts → shows affected files
   b) /deps show accounts.api → shows API dependencies
   c) /agile iterate "Add user_profile field to accounts API"
      ├─ impact-analysis identifies Order domain affected
      └─ interface-validator hook detects breaking change

   d) /multi-ai-review on API contract change
      ├─ GLM: Validates backward compatibility strategy
      ├─ Gemini: Proposes versioning approach
      └─ Claude: Final decision with migration timeline

   e) interface-validator hook:
      ├─ Analyzes impact on Orders domain
      └─ cross-domain-notifier → alerts Orders Part Leader

   f) Part Leader (Orders) coordinates:
      > /agile iterate "Update order creation to use new profile field"
      └─ quality-gate hook validates changes against interface contract

4. Both domains complete
   > /audit (pre-deployment validation)

5. All passed
   > /verification-before-completion

6. Release ready ✅
```

**Hook Sequence During This Flow**:
```
interface-validator hook
  ↓ Detects Accounts API change
  ↓
interface-validator hook
  ↓ Analyzes Orders domain impact
  ↓
cross-domain-notifier hook
  ↓ Alerts Orders Part Leader
  ↓
standards-validator hook (on Orders changes)
  ↓
quality-gate hook (on both domain completions)
  ↓
changelog-recorder hook (auto-documents both domains' changes)
  ↓
architecture-updater hook (updates API contract docs)
```

---

### Scenario 2: Emergency Bug Fix with Recovery

**Setup**: Payment processing has critical bug, CLI crashes mid-fix

**Flow**:
```
1. QA Manager detects production issue
   > /systematic-debugging "Payment fails for amounts > 999"

2. Issue identified: Validation regex too strict

3. Domain Developer starts fix but CLI crashes

4. Next session, automatic recovery:
   > /recover (auto-triggered by error-recovery-advisor hook)

5. Recover analyzes:
   ├─ Orchestrate state: payment-service.py L23-45 was being edited
   ├─ Git status: 1 file modified, not committed
   ├─ Last action: /code-review (review in-progress)
   └─ Recommendation: /systematic-debugging --resume

6. Resume debugging

7. Fix implemented
   > /code-review payment_service.py
   ├─ Standards validator checks pattern compliance
   └─ Chief Architect approves fix

8. Verify fix
   > /powerqa payment_service.py (auto-QA cycling)

9. Add regression tests
   > /coverage --uncovered app/services/payment.py

10. Pre-deployment check
    > /audit (skip design, focus on payment domain)
    ├─ Test coverage: 88% ✅
    ├─ Spec compliance: ✅
    └─ Security: No API key exposure ✅

11. Release
    > /verification-before-completion

12. Changelog auto-recorded by changelog-recorder hook ✅
```

**Key Integration Points**:
- `error-recovery-advisor` hook auto-detects crash
- `session-memory-loader` restores context
- `post-edit-analyzer` hook validates fix patterns
- `git-commit-checker` hook warns before commit
- `changelog-recorder` hook auto-documents fix

---

### Scenario 3: Large Feature with Horizontal Slicing

**Setup**: New checkout flow across 3 layers (Skeleton→Muscles→Skin)

**Flow**:
```
1. Project Manager initiates
   > /agile start

2. Sprint plan created with 3 layers:
   - Skeleton: Layout + dummy data (T0.1-T0.3)
   - Muscles: Cart logic + payment API (T1.1-T1.5)
   - Skin: Animations + error states (T2.1-T2.3)

3. Layer 1: Skeleton
   > /agile auto (Skeleton layer)

   Each task includes:
   ├─ Lint check (quality-gate hook)
   ├─ Build verification
   └─ notify_user with screenshot

   [Part Leader reviews → Approves]

4. Layer 2: Muscles
   > /agile auto (Muscles layer)

   ├─ Standards validation (standards-validator hook)
   ├─ API contract check (interface-validator hook)
   ├─ Cross-domain check (cart-service impacts other domains)
   └─ cross-domain-notifier hook → alerts Payment & Inventory

   [Chief Architect approves architecture]
   [Other Part Leaders confirm no conflicts]

5. Layer 3: Skin
   > /agile auto (Skin layer)

   ├─ Design system validation (design-validator hook)
   ├─ Responsive test (playwright-mcp if available)
   └─ Final quality check

   [Chief Designer approves design system compliance]

6. Post-implementation
   > /coverage (verify 80%+ test coverage)

   If coverage < 80%:
   └─ /coverage --uncovered → identify gaps → add tests

7. Final validation
   > /audit (comprehensive pre-release audit)

   Checks:
   ├─ Spec compliance vs 01-prd.md ✅
   ├─ Code quality vs 02-trd.md ✅
   ├─ Convention compliance vs 07-coding.md ✅
   ├─ Test coverage ✅
   └─ Cross-domain impacts ✅

8. Release
   > /verification-before-completion

9. Automated hooks:
   ├─ changelog-recorder: Generates CHANGELOG entry
   ├─ architecture-updater: Updates ADR docs
   └─ cross-domain-notifier: Notifies affected teams
```

---

## Hook Specifications

### Interaction with Vibelab Skills

| Hook | Vibelab Skill | Trigger | Action |
|------|---------------|---------|--------|
| **skill-router** | `/agile`, `/review`, `/recover` | Keyword detected | Auto-load skill |
| **session-memory-loader** | All skills | Session start | Restore prev state |
| **context-guide-loader** | All skills | Skill start | Inject Constitution |
| **error-recovery-advisor** | `/recover` | Error detected | Suggest recovery path |
| **standards-validator** | `/agile`, `/multi-ai-review` | Code changes | Validate patterns |
| **design-validator** | `/agile` (Skin layer) | Design changes | Check design system |
| **quality-gate** | `/audit`, `/powerqa` | Phase completion | Block if < 80% coverage |
| **interface-validator** | `/multi-ai-review` | API changes | Analyze cross-domain impact |
| **cross-domain-notifier** | `/agile iterate`, `/multi-ai-review` | Domain impact detected | Alert Part Leaders |
| **post-edit-analyzer** | `/agile`, `/multi-ai-review` | After edit | Security pattern check |
| **git-commit-checker** | All skills | Before git push | Warn of audit failures |
| **architecture-updater** | `/audit`, `/multi-ai-review` | ADR/major changes | Update architecture docs |
| **changelog-recorder** | All skills (final) | Version/phase complete | Auto-generate changelog |

---

## Configuration & Setup

### Installation

1. **Install Claude Project Team** (if not already done):
   ```bash
   cd /path/to/project-team
   ./install.sh --global
   # or --local for project-specific installation
   ```

2. **Verify Installation**:
   ```bash
   ls ~/.claude/hooks/
   # Should show: permission-checker.js, standards-validator.js, quality-gate.js, etc.
   ```

3. **Verify Vibelab Extension Skills** (already in place):
   ```bash
   ls /path/to/claude-imple-skills/skills/
   # Should show: agile/, multi-ai-review/, quality-auditor/, recover/, workflow-guide/
   ```

### Configuration

1. **Global Configuration** (`~/.claude/settings.json`):
   ```json
   {
     "hooks": [
       "skill-router",
       "session-memory-loader",
       "context-guide-loader",
       "standards-validator",
       "design-validator",
       "quality-gate",
       "interface-validator",
       "cross-domain-notifier",
       "architecture-updater",
       "changelog-recorder",
       "post-edit-analyzer",
       "error-recovery-advisor",
       "risk-area-warning",
       "git-commit-checker"
     ],
     "skillIntegration": {
       "enableAutoRouter": true,
       "enableContextPreserve": true,
       "enableQualityGates": true,
       "enableCrossDomainNotification": true
     }
   }
   ```

2. **Project Configuration** (`.claude/settings.json`):
   ```json
   {
     "project": {
       "name": "My Project",
       "domains": ["orders", "accounts", "payments"],
       "qaThresholds": {
         "testCoverage": 80,
         "auditScore": 70
       },
       "skillConfig": {
         "agile": {
           "defaultReviewCheckpoints": true,
           "layerNotifications": true
         },
         "multiAiReview": {
           "geminiOAuth": true,
           "glmApiKey": "${GLM_API_KEY}"
         },
         "qualityAuditor": {
           "preDeploymentMode": true,
           "playwrightCheck": true
         }
       }
     }
   }
   ```

### Environment Variables

```bash
# Gemini MCP (OAuth - recommended)
# No key needed - use: mcp__gemini__auth_login

# GLM MCP (API Key based)
export GLM_API_KEY="your_glm_api_key"

# Optional: Custom skill paths
export VIBELAB_SKILLS_PATH="/path/to/claude-imple-skills/skills"
export VIBELAB_HOOKS_PATH="/path/to/claude-imple-skills/.claude/hooks"
```

---

## Compatibility & Requirements

### Version Requirements

| Component | Minimum Version | Recommended | Notes |
|-----------|-----------------|-------------|-------|
| Claude Code CLI | Latest | Latest | Hook support required |
| Claude Project Team | 1.0.0 | 1.0.0+ | This integration requires v1.0.0+ |
| Vibelab Extension Skills | 2.2.0 | 2.2.0+ | Hook system: v1.9.2+ |
| Node.js | 20.0 | 20.10+ | For hook execution |
| Bash | 4.0 | 5.0+ | For install.sh scripts |

### Compatibility Matrix

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Project Team 1.0.0 ←→ Vibelab Skills 2.2.0           │
├──────────────────────┬──────────────────────────────────────┤
│ Component            │ Compatibility                        │
├──────────────────────┼──────────────────────────────────────┤
│ Agents               │ ✅ Full (9 agents recognize skills)  │
│ Hooks                │ ✅ Full (14 hooks active)            │
│ Quality Gates        │ ✅ Full (coverage, audit)            │
│ Interface Validator  │ ✅ Full (API contract checking)      │
│ MCP Integration      │ ✅ Partial (Gemini OAuth, GLM API)   │
│ Skill Router         │ ✅ Full (auto-detect 39 skills)     │
│ Context Preservation │ ✅ Full (session-memory-loader)      │
│ Error Recovery       │ ✅ Full (error-recovery-advisor)     │
│ Changelog Auto-Gen   │ ✅ Full (changelog-recorder)         │
│ Cross-Domain Notify  │ ✅ Full (multi-domain support)       │
└──────────────────────┴──────────────────────────────────────┘
```

---

## Best Practices

### 1. Sprint Planning with Agile + Project Team

**DO:**
- [ ] Start with `/agile start` after Project Manager approves plan
- [ ] Let quality-gate hook validate each layer before proceeding
- [ ] Notify Part Leaders after each layer completion
- [ ] Use `/agile iterate` for mid-sprint changes (not `/agile auto`)
- [ ] Coordinate with interface-validator before API changes

**DON'T:**
- ❌ Bypass /audit before deployment
- ❌ Skip notify_user checkpoints in agile
- ❌ Change API without interface-validator review
- ❌ Commit code that fails quality-gate

---

### 2. Code Review with Multi-AI + Standards Validator

**DO:**
- [ ] Use `/multi-ai-review` for architecture/API decisions
- [ ] Let standards-validator check code patterns
- [ ] Wait for Chief Architect VETO period before merging
- [ ] Use GLM + Gemini consensus for major decisions

**DON'T:**
- ❌ Merge without standards-validator passing
- ❌ Override Chief Architect veto without justification
- ❌ Skip Gemini creativity review for complex features

---

### 3. Pre-Deployment with Audit + Quality Gate

**DO:**
- [ ] Run `/audit` 48 hours before planned release
- [ ] Address 🔴 Critical issues first
- [ ] Re-run `/audit` after fixes
- [ ] Let quality-gate hook enforce coverage ≥ 80%
- [ ] Coordinate with cross-domain-notifier for impacts

**DON'T:**
- ❌ Deploy with audit score < 90
- ❌ Ignore interface-validator warnings
- ❌ Proceed if test coverage < 80%
- ❌ Skip changelog-recorder (auto-generated)

---

### 4. Recovery with Error Recovery Advisor

**DO:**
- [ ] Let `/recover` auto-trigger after interruptions
- [ ] Review recovery recommendations before resuming
- [ ] Use session-memory-loader to restore context
- [ ] Re-run quality checks after recovery

**DON'T:**
- ❌ Skip /recover and manually resume (loses context)
- ❌ Ignore error-recovery-advisor warnings
- ❌ Force commit after interrupted work

---

### 5. Skill Routing with Workflow Guide

**DO:**
- [ ] Let `/workflow` auto-recommend skills
- [ ] Trust skill-router hook for intelligent dispatch
- [ ] Follow suggested skill chain recommendations
- [ ] Check secondary options if primary not applicable

**DON'T:**
- ❌ Randomly pick skills without /workflow guidance
- ❌ Skip workflow state analysis
- ❌ Ignore "Risk Level: Red" warnings

---

## Troubleshooting

### Issue: Hook Not Triggering

**Symptoms**: Quality gate doesn't block despite low coverage

**Solution**:
```bash
# 1. Verify hooks installed
ls ~/.claude/hooks/ | grep quality-gate

# 2. Check Claude Code recognizes hooks
claude mcp list | grep hooks

# 3. Restart Claude Code
# (hooks may need reload)

# 4. Check hook logs
tail -f ~/.claude/logs/hooks.log
```

---

### Issue: Skill Doesn't Auto-Load

**Symptoms**: `/agile` command not recognized

**Solution**:
```bash
# 1. Verify skill-router hook enabled
grep "skill-router" ~/.claude/settings.json

# 2. Check skill paths
ls /path/to/claude-imple-skills/skills/agile/

# 3. Manually specify skill path if needed
export VIBELAB_SKILLS_PATH="/path/to/claude-imple-skills/skills"

# 4. Restart Claude Code
```

---

### Issue: Multi-AI Review Fails

**Symptoms**: `/multi-ai-review` shows MCP errors

**Solution**:

**For Gemini OAuth:**
```bash
# Re-authenticate
mcp__gemini__auth_login

# Verify status
mcp__gemini__auth_status
```

**For GLM API:**
```bash
# Verify API key
echo $GLM_API_KEY
# (should not be empty)

# Check GLM endpoint accessibility
curl https://open.bigmodel.cn/api/v1/health
```

---

### Issue: Quality Gate Blocking Legitimate Changes

**Symptoms**: Coverage check fails despite tests passing

**Solution**:
```bash
# 1. Run coverage command directly
pytest --cov=app --cov-report=term-missing
# or
npm run test -- --coverage

# 2. Check coverage threshold setting
grep "testCoverage" .claude/settings.json

# 3. Verify excluded files aren't inflating threshold
cat pytest.ini | grep omit
# or
cat package.json | grep "coverage.exclude"

# 4. Update threshold if justified (with Chief Architect approval)
# ⚠️ Never lower threshold without documentation
```

---

## Migration Guide (From Pure Vibelab)

If migrating from pure vibelab to integrated vibelab + Claude Project Team:

### Step 1: Install Claude Project Team
```bash
cd /path/to/project-team
./install.sh --global
```

### Step 2: Verify Hook Activation
```bash
# Should show both vibelab hooks AND project-team hooks
ls ~/.claude/hooks/ | wc -l
# Expected: 14+ hooks
```

### Step 3: Update Project Config
```json
{
  "skillIntegration": {
    "enableAutoRouter": true,
    "enableQualityGates": true
  }
}
```

### Step 4: Test Integration
```bash
# Should trigger skill-router hook + context-guide-loader
/agile start

# Should recognize Project Manager as orchestrator
/workflow

# Should run quality-gate hook
/audit
```

### Step 5: Update Team Workflows
- Brief team on new hooks
- Update runbooks to include quality-gate blocking
- Configure domain-level Part Leaders in settings.json
- Set up interface contracts in contracts/interfaces/

---

## Future Enhancements

### Planned Integrations (v1.1+)

- [ ] **Event-Driven Alerts**: Hook metrics → Slack/Teams notifications
- [ ] **GraphQL Federation**: Interface validator for GraphQL schemas
- [ ] **Microservices Templates**: Cross-domain communication patterns
- [ ] **CI/CD Pipeline Integration**: Hooks → GitHub Actions / GitLab CI
- [ ] **Cost Optimization**: `/cost-router` integration with quality gates
- [ ] **Performance Benchmarks**: Vercel review integration with audit
- [ ] **Multi-Cloud Deployment**: Domain-specific infrastructure validation

---

## Summary

The integration of **Vibelab Extension Skills** with **Claude Project Team** creates a comprehensive system for:

1. **Layered Development** (/agile): Horizontal slicing with checkpoint reviews
2. **Collaborative Review** (/multi-ai-review): Multi-perspective analysis before merge
3. **Comprehensive Audit** (/quality-auditor): Pre-deployment validation across all dimensions
4. **Intelligent Recovery** (/recover): Automatic restoration from interruptions
5. **Skill Routing** (/workflow-guide): Intelligent dispatcher for 39+ skills

All backed by **14 automated hooks** that enforce governance, prevent breaking changes, and maintain architectural consistency.

---

## Contact & Support

For integration issues:

1. Check this document for troubleshooting
2. Review hook logs: `tail -f ~/.claude/logs/hooks.log`
3. Test hook directly: `claude mcp list | grep -E "(skill-router|quality-gate)"`
4. Consult Chief Architect if architectural conflicts arise
5. Consult QA Manager for quality gate enforcement questions

---

**Document**: SKILL-INTEGRATION.md
**Version**: 1.0.0
**Last Updated**: 2026-02-08
**Maintainers**: Vibelab Extension Team + Claude Project Team
**Status**: Production Ready

---

**Next Steps for Project Managers:**
1. Run `./install.sh --global` to activate Claude Project Team
2. Set up domain configurations in `.claude/settings.json`
3. Brief teams on new workflows
4. Schedule initial `/audit` with QA Manager
5. Begin first sprint with `/agile start` + quality gate enforcement
