# Hierarchical Agent Communication Protocol

## 1. Overview
The agent collaboration system utilizes a file-based communication bus to manage cross-domain change requests. This allows the Orchestrator layer (Project Manager and Chief Architect) and Domain Workers (BackendSpecialist, FrontendSpecialist, DBSpecialist, QASpecialist) to communicate asynchronously and maintain a verifiable audit trail of all architectural and implementation decisions.

## 2. Directory Structure
All communication happens within the `.claude/collab/` directory structure:

```text
.claude/collab/
├── contracts/    # ChiefArchitect-only write (Wave 0 outputs), all agents read
├── requests/     # REQ-*.md files for cross-domain change requests (OPEN/PENDING)
├── decisions/    # DEC-*.md files issued by ChiefArchitect (FINAL rulings)
├── locks/        # JSON lock files for concurrency control (TTL: 10 min)
└── archive/      # Resolved, rejected, or closed REQ/DEC files (wave-end archival)
```

Initialize with: `node project-team/scripts/collab-init.js`

## 3. REQ File Format

Requests must use the following structure containing YAML frontmatter and a Markdown body:

```markdown
---
id: REQ-YYYYMMDD-NNN
thread_id: thread-{domain}-{topic}
from: BackendSpecialist
to: FrontendSpecialist
task_ref: T2.3
status: OPEN
max_negotiation: 2
negotiation_count: 0
timestamp: ISO8601
---
## Change Summary (<=500 chars)
[description — keep concise for context efficiency]

## Response
[receiver fills this in]
```

**File naming**: `REQ-YYYYMMDD-NNN.md` in `.claude/collab/requests/`

## 4. Status Transitions

```
OPEN → PENDING (receiver acknowledged, under analysis)
PENDING → RESOLVED (accepted and implemented)
PENDING → REJECTED (denied, justification in Response section)
PENDING → ESCALATED (negotiation_count >= max_negotiation → ChiefArchitect intervenes)
ESCALATED → RESOLVED (ChiefArchitect creates DEC file, ruling enforced)
```

## 5. REQ Lifecycle Rules

- **Negotiation Limit**: `max_negotiation: 2` (default). If `negotiation_count` reaches this limit, status must transition to `ESCALATED`.
- **Thread Management**: Use the same `thread_id` for related follow-ups. Prevents duplicate REQs for the same issue.
- **Escalation Trigger**: When a REQ reaches `ESCALATED`, ChiefArchitect takes ownership and creates a corresponding DEC file. All agents must comply with the DEC ruling.
- **Context Limit**: Change Summary must be ≤500 characters. Include only what the receiving agent needs to decide.
- **Wave Archive**: At wave completion, all RESOLVED/REJECTED REQs move to `.claude/collab/archive/wave-N/`.

## 6. DEC File Format

Decisions issued by the ChiefArchitect:

```markdown
---
id: DEC-YYYYMMDD-NNN
ref_req: REQ-YYYYMMDD-NNN
from: ChiefArchitect
to: [BackendSpecialist, FrontendSpecialist]
status: FINAL
timestamp: ISO8601
---
## Decision Summary
[Clear statement of the final architectural decision]

## Context & Conflict
[Brief summary of the escalated issue and why negotiation failed]

## Required Actions
- BackendSpecialist: [specific steps]
- FrontendSpecialist: [specific steps]
```

**File naming**: `DEC-YYYYMMDD-NNN.md` in `.claude/collab/decisions/`

## 7. File Lock Format

Before modifying any REQ/DEC file, agents create a JSON lock in `.claude/collab/locks/`:

```json
{
  "file": "REQ-20260305-001.md",
  "locked_by": "FrontendSpecialist",
  "timestamp": "2026-03-05T10:30:00Z",
  "ttl_seconds": 600
}
```

**Lock filename**: `{escaped-filename}.lock` (e.g., `REQ-20260305-001.md.lock`)

**Stale lock detection**: If `now > timestamp + ttl_seconds`, the lock is stale and can be safely overwritten.

**Atomic creation**: Use `O_EXCL` equivalent (write-only, fail-if-exists) to prevent race conditions.

## 8. Domain Boundary Rules

| Agent | Can Write To | Cannot Write To |
|-------|-------------|-----------------|
| BackendSpecialist | `src/domains/`, `src/api/`, `src/services/` | `src/components/`, `database/`, `contracts/` |
| FrontendSpecialist | `src/components/`, `src/pages/`, `src/hooks/` | `src/api/`, `database/`, `contracts/` |
| DBSpecialist | `src/db/`, `migrations/`, `prisma/` | `src/components/`, `src/api/` |
| QASpecialist | `tests/`, `*.test.*`, `*.spec.*` | `src/` (non-test), `database/` |
| ChiefArchitect | `contracts/`, `.claude/collab/contracts/`, `.claude/collab/decisions/` | `src/` |
| Any Agent | `.claude/collab/requests/`, `.claude/collab/locks/` | — |

Cross-domain writes are blocked by `project-team/hooks/domain-boundary-enforcer.js`.
To request a cross-domain change, create a REQ file instead.

## 9. Workflow Example

**Scenario**: BackendSpecialist adds a `role` field to JWT; FrontendSpecialist's AuthGuard needs updating.

1. **Create REQ**: BackendSpecialist creates `REQ-20260305-001.md` (status: `OPEN`) describing the JWT change.
2. **Acknowledge**: FrontendSpecialist creates lock file, updates status to `PENDING`, reviews the request.
3. **Negotiate** (if conflict): FrontendSpecialist proposes alternative in Response section, increments `negotiation_count`.
4. **Resolve**: BackendSpecialist accepts, FrontendSpecialist sets status to `RESOLVED` and implements AuthGuard update.
5. **Escalate** (if no agreement after 2 rounds): status auto-set to `ESCALATED` by `conflict-resolver.js`.
6. **Mediate**: ChiefArchitect reads both positions, creates `DEC-20260305-001.md` with final ruling.
7. **Archive**: After wave completion, REQ and DEC move to `.claude/collab/archive/wave-N/`.

## 10. Wave Integration

```
Wave 0: ChiefArchitect (solo)
└── Runs collab-init.js + creates contracts/

Wave N: Domain Workers (parallel)
├── Read contracts/ (read-only)
├── Create REQ files for cross-domain needs
└── Respond to incoming REQs

Wave Barrier (after each wave):
└── conflict-resolver.js scans requests/
    ├── Exit 0: all clear → next wave begins
    └── Exit 2: ESCALATED REQs → ChiefArchitect mediates first
```

See also: `docs/plan/hierarchical-agent-collab-plan.md`
