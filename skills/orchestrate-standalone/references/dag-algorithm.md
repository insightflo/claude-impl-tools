# Kahn's Algorithm for Topological Sorting

> **Purpose**: Generate valid execution order from task dependencies

---

## Algorithm Overview

Kahn's algorithm produces a **topological ordering** of a directed acyclic graph (DAG). In our context:
- **Nodes** = Tasks
- **Edges** = Dependencies (A → B means A must complete before B)

---

## Pseudocode

```
ALGORITHM Kahn(graph):
    INPUT: DAG = (V, E) where V = vertices, E = edges
    OUTPUT: Topologically sorted list

    1. Calculate in-degree for each vertex
       in_degree[v] = number of incoming edges to v

    2. Initialize queue with all vertices having in_degree = 0
       Q = { v | in_degree[v] = 0 }

    3. WHILE Q is not empty:
       a. Remove a vertex u from Q
       b. Add u to sorted list
       c. FOR EACH edge (u → v):
           i. Remove edge from graph
           ii. Decrement in_degree[v]
          iii. IF in_degree[v] = 0:
                   Add v to Q

    4. IF sorted list contains all vertices:
        RETURN sorted list (valid topological order)
       ELSE:
        THROW error (cycle detected)
```

---

## Complexity Analysis

| Metric | Value |
|--------|-------|
| Time | O(V + E) where V = tasks, E = dependencies |
| Space | O(V) for in_degree array and queue |

---

## Application to Tasks

### Example Task Graph

```
T1.1 (design)
   ↓
T1.2 (implement) ← T2.2 (tests)
   ↓                 ↓
T1.3 (verify) → T2.3 (integration)
```

### Step 1: Calculate In-Degrees

| Task | In-Degree |
|------|-----------|
| T1.1 | 0 |
| T1.2 | 1 (from T1.1) |
| T1.3 | 1 (from T1.2) |
| T2.2 | 1 (from T1.1) |
| T2.3 | 2 (from T1.3, T2.2) |

### Step 2: Topological Sort

| Iteration | Queue | Remove | Add to Queue |
|-----------|-------|--------|--------------|
| 1 | [T1.1] | T1.1 | T1.2, T2.2 |
| 2 | [T1.2, T2.2] | T1.2 | T1.3 |
| 3 | [T2.2, T1.3] | T2.2 | (none, T2.3 still needs T1.3) |
| 4 | [T1.3] | T1.3 | T2.3 |
| 5 | [T2.3] | T2.3 | - |

**Result**: T1.1 → (T1.2, T2.2) → T1.3 → T2.3

---

## Cycle Detection

If a cycle exists, Kahn's algorithm **cannot** process all vertices:

```
T1.1 → T1.2 → T1.3
         ↑       ↓
         ←───────┘
```

**Detection**: After algorithm completes, if sorted list length < total vertices, a cycle exists.

---

## Layer Creation for Parallel Execution

After topological sort, create layers for parallel execution:

```
Layer 1: [T1.1]                    (in-degree = 0)
Layer 2: [T1.2, T2.2]              (both depend only on T1.1)
Layer 3: [T1.3]                     (depends on T1.2)
Layer 4: [T2.3]                     (depends on T1.3, T2.2)
```

**Layer Rule**: All tasks in a layer can execute **in parallel**.

---

## Implementation Reference

See `scripts/scheduler.js` for the implementation:
- `parseTasks()` - Extract tasks from TASKS.md
- `buildDAG()` - Kahn's algorithm
- `createLayers()` - Convert to parallel layers

---

**Last Updated**: 2026-03-03
