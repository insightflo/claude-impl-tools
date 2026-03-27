---
name: context-optimize
description: "Long context optimization with self-editing — extract key information, compress, summarize, and auto-prune stale context using the H2O + Context-1 patterns. Use this whenever documents are too long, the context window is running low, you need to synthesize multiple files, or accumulated tool results are polluting the context. Triggers immediately on 'compress this', 'summarize this', 'document is too long', 'context overflow', 'clean up context', 'prune context', '컨텍스트 정리'. Triggers on /compress, /prune."
trigger: /compress, /optimize, /prune, "컨텍스트 압축", "문서 압축", "긴 문서 요약", "context overflow", "컨텍스트 정리"
version: 2.0.0
updated: 2026-03-27
---

# Context Optimize Skill

> **When to use:**
> - When you need to analyze a long document or codebase
> - When the context window is running low
> - When you need to synthesize multiple files
> - When cleaning up documents before starting a project implementation
> - **When accumulated search/tool results are polluting the context** (v2.0 self-editing)

## Quick Start

```bash
# Extract key information (Heavy-Hitter)
/compress optimize <file>

# Compress a document
/compress <file>

# LLM-based summarization (requires Claude CLI)
/compress <file> --llm
```

---

## Usage Scenarios

### 1. Pre-project document cleanup

```
Situation: Planning docs and specs are too long to read in one pass
Solution:  /compress optimize docs/spec.md --heavy-count=20
Result:    Extract only the top 20 key items for quick understanding
```

### 2. Context overload

```
Situation: "Context window exceeded" or degraded response quality
Solution:  /compress <large-file> --summary-ratio=0.3
Result:    70% compression to free up context headroom
```

### 3. Synthesizing multiple files

```
Situation: Need to reference 10+ files at once
Solution:  /compress build "summarize" docs/*.md
Result:    RAG hybrid extracts only relevant content
```

---

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `optimize <file>` | Heavy-Hitter extraction | `/compress optimize spec.md` |
| `compress <file>` | Compress (preserve start/end) | `/compress README.md` |
| `build <query> <files>` | RAG hybrid | `/compress build "API list" src/*.ts` |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--heavy-count=N` | Number of key items to extract | 10 |
| `--summary-ratio=N` | Compression ratio (0.1–0.9) | 0.3 |
| `--llm` | Use LLM-based summarization | false |
| `--json` | Output in JSON format | false |

---

## Technical Principles

### H2O (Heavy-Hitter Oracle)

Places critical information at the top to mitigate the "Lost in the Middle" phenomenon:

| Type | Priority | Example |
|------|----------|---------|
| h1 header | 1 | `# Title` |
| Class definition | 1 | `class Foo` |
| h2 header | 2 | `## Section` |
| Function definition | 2 | `function bar()` |
| Table header | 2 | `\| col1 \| col2 \|` |
| Code block | 3 | ` ```javascript` |
| List | 4 | `- item` |

**Bonus system**:
- Top 10% of document: priority multiplier 0.8x (higher priority)
- Bottom 10% of document: priority multiplier 0.9x
- Critical keywords (`CRITICAL`, `IMPORTANT`, `🔥`): multiplier 0.5x

### Compressive Context

Older or less important content is summarized; recent and critical content is preserved as-is:

```
[First 5 lines — preserved as-is]
... (compressed) ...
[Middle sampling]
... (compressed) ...
[Last 5 lines — preserved as-is]
```

### LLM Mode (`--llm`)

Semantic summarization using Claude CLI:
- No additional API cost — subscription only
- Automatically falls back to heuristic when running inside Claude Code

---

## How to Run

This skill internally calls `contextOptimizer.js`:

```bash
node project-team/services/contextOptimizer.js <command> <file> [options]
```

### Examples

```bash
# Heavy-Hitter extraction
node project-team/services/contextOptimizer.js optimize docs/spec.md --heavy-count=15 --json

# Compress
node project-team/services/contextOptimizer.js compress large-file.md --summary-ratio=0.2

# LLM-based (run in a separate terminal)
node project-team/services/contextOptimizer.js compress large-file.md --llm

# RAG hybrid
node project-team/services/contextOptimizer.js build "API endpoints" src/*.ts
```

---

---

## Self-Editing Context (v2.0)

> Inspired by [Chroma Context-1](https://www.trychroma.com/research/context-1):
> "Model selectively removes irrelevant documents during retrieval to free context capacity."
> Context-1 achieves 94.1% prune accuracy with this pattern.

### The Problem

During long sessions, tool results accumulate in the conversation:
- Early search results become irrelevant as the task evolves
- Stale file reads pollute context when those files have since been modified
- Debugging output from resolved issues wastes context on solved problems

This is **context pollution** — the same problem Context-1 solves for retrieval.

### `/prune` — Self-Editing Command

When context feels polluted, run `/prune` (or `/compress prune`). The process:

```
1. SCAN: Review all tool results and file reads in the current conversation
2. CLASSIFY each result:
   - KEEP: Still relevant to the current task
   - STALE: Was relevant but task has moved on
   - NOISE: Was never relevant (wrong search, failed attempt)
3. SUMMARIZE stale/noise items into one-line summaries
4. OUTPUT: A compact context summary replacing the bloated results
```

### Prune Decision Criteria

| Signal | Classification | Action |
|--------|---------------|--------|
| File read → file was later modified | STALE | Summarize: "read X, since modified" |
| Search result → query was refined | STALE | Summarize: "searched X, refined to Y" |
| Error output → error was fixed | NOISE | Summarize: "fixed error in X" |
| Debugging trace → bug resolved | NOISE | Drop entirely |
| Tool result still referenced in current task | KEEP | Preserve as-is |
| Recent result (last 3 turns) | KEEP | Preserve as-is |

### When to Self-Edit

Proactively suggest `/prune` when:
- Session has exceeded 20 tool calls
- The same file has been read 3+ times (likely stale earlier reads)
- A search was followed by a more specific search (earlier one is noise)
- Debugging output exists for a resolved issue

### Integration with /compact

`/prune` is lighter than `/compact`:
- `/prune` — removes noise from tool results within the active session
- `/compact` — compresses the entire conversation for a fresh start

Use `/prune` first. If still overloaded, then `/compact`.

---

## Related Resources

- Service README: `project-team/services/README.md`
- MCP server: `project-team/services/mcp-context-server.js`
