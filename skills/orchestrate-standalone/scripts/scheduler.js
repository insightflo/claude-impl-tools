#!/usr/bin/env node
/**
 * DAG Scheduler for Orchestrate Standalone
 *
 * Implements Kahn's algorithm for topological sorting and layer creation
 * for parallel task execution.
 *
 * @TASK orchestrate-standalone
 * @SPEC SKILL.md
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Task Parsing
// ---------------------------------------------------------------------------

/**
 * Parse TASKS.md and extract tasks with metadata
 */
function parseTasks(tasksPath) {
  const content = fs.readFileSync(tasksPath, 'utf8');
  const tasks = [];
  const taskRegex = /-\s*\[[ x]\]\s+([A-Z]\d+(?:\.\d+)*):\s*(.+?)(?:\n\s{2,}-(.+?))*$/gm;

  let match;
  while ((match = taskRegex.exec(content)) !== null) {
    const taskId = match[1];
    const description = match[2].trim();
    const metadataStr = match[3] || '';

    // Parse metadata
    const metadata = parseMetadata(metadataStr);

    tasks.push({
      id: taskId,
      description,
      deps: metadata.deps || [],
      domain: metadata.domain || null,
      risk: metadata.risk || 'low',
      files: metadata.files || [],
      owner: metadata.owner || null,
      model: metadata.model || 'sonnet',
      status: 'pending'
    });
  }

  return tasks;
}

/**
 * Parse task metadata from YAML-like format
 */
function parseMetadata(metaStr) {
  const metadata = {
    deps: [],
    domain: null,
    risk: 'low',
    files: [],
    owner: null,
    model: 'sonnet'
  };

  const depsMatch = metaStr.match(/deps:\s*\[(.+?)\]/);
  if (depsMatch) {
    metadata.deps = depsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }

  const domainMatch = metaStr.match(/domain:\s*(\w+)/);
  if (domainMatch) metadata.domain = domainMatch[1];

  const riskMatch = metaStr.match(/risk:\s*(\w+)/);
  if (riskMatch) metadata.risk = riskMatch[1];

  const filesMatch = metaStr.match(/files:\s*(.+)/);
  if (filesMatch) {
    metadata.files = filesMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }

  const ownerMatch = metaStr.match(/owner:\s*(.+)/);
  if (ownerMatch) metadata.owner = ownerMatch[1];

  const modelMatch = metaStr.match(/model:\s*(\w+)/);
  if (modelMatch) metadata.model = modelMatch[1];

  return metadata;
}

// ---------------------------------------------------------------------------
// DAG Building (Kahn's Algorithm)
// ---------------------------------------------------------------------------

/**
 * Build dependency graph and return sorted tasks
 */
function buildDAG(tasks) {
  // Build adjacency list and in-degree count
  const graph = {};
  const inDegree = {};

  for (const task of tasks) {
    graph[task.id] = [];
    inDegree[task.id] = 0;
  }

  for (const task of tasks) {
    for (const dep of task.deps) {
      if (graph[dep]) {
        graph[dep].push(task.id);
      }
      inDegree[task.id] = (inDegree[task.id] || 0) + 1;
    }
  }

  // Kahn's algorithm for topological sort
  const sorted = [];
  const queue = tasks.filter(t => inDegree[t.id] === 0);

  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);

    // Reduce in-degree for dependent tasks
    for (const dependentId of graph[current.id]) {
      inDegree[dependentId]--;
      if (inDegree[dependentId] === 0) {
        const dependent = tasks.find(t => t.id === dependentId);
        if (dependent) queue.push(dependent);
      }
    }
  }

  // Check for cycles
  if (sorted.length !== tasks.length) {
    throw new Error('Circular dependency detected in tasks');
  }

  return { sorted, graph };
}

// ---------------------------------------------------------------------------
// Layer Creation for Parallel Execution
// ---------------------------------------------------------------------------

/**
 * Create execution layers based on dependencies
 */
function createLayers(sortedTasks, graph) {
  const layers = [];
  const placed = new Set();

  for (const task of sortedTasks) {
    const deps = graph[task.id] || [];

    // Find the first layer where all dependencies are placed
    let layerIndex = 0;
    for (const layer of layers) {
      const layerTaskIds = new Set(layer.map(t => t.id));
      if (deps.every(d => placed.has(d))) {
        // Found layer, but check for conflicts
        if (!hasConflicts(task, layer)) {
          break;
        }
      }
      layerIndex++;
    }

    if (layerIndex >= layers.length) {
      layers.push([]);
    }
    layers[layerIndex].push(task);
    placed.add(task.id);
  }

  return layers;
}

/**
 * Check if task conflicts with any task in the layer
 */
function hasConflicts(task, layer) {
  for (const other of layer) {
    // File conflict
    for (const f1 of task.files) {
      for (const f2 of other.files) {
        if (f1 === f2 || f1.includes('*') && f2.match(f1.replace('*', '.*'))) {
          return true;
        }
      }
    }

    // Domain conflict (if same domain)
    if (task.domain && task.domain === other.domain) {
      return true;
    }

    // Critical risk tasks always conflict (serial execution)
    if (task.risk === 'critical' || other.risk === 'critical') {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Conflict Detection
// ---------------------------------------------------------------------------

/**
 * Detect file and domain conflicts
 */
function detectConflicts(tasks) {
  const fileMap = {};
  const domainMap = {};

  for (const task of tasks) {
    // File conflicts
    for (const file of task.files) {
      if (!fileMap[file]) fileMap[file] = [];
      fileMap[file].push(task.id);
    }

    // Domain conflicts
    if (task.domain) {
      if (!domainMap[task.domain]) domainMap[task.domain] = [];
      domainMap[task.domain].push(task.id);
    }
  }

  return { fileMap, domainMap };
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

if (require.main === module) {
  const tasksPath = process.argv[2] || 'TASKS.md';

  try {
    const tasks = parseTasks(tasksPath);
    console.log(`Parsed ${tasks.length} tasks`);

    const { sorted, graph } = buildDAG(tasks);
    console.log(`Topological sort: ${sorted.map(t => t.id).join(' -> ')}`);

    const layers = createLayers(sorted, graph);
    console.log(`\nExecution layers: ${layers.length}`);
    layers.forEach((layer, i) => {
      console.log(`  Layer ${i + 1}: ${layer.map(t => t.id).join(', ')}`);
    });

    const conflicts = detectConflicts(tasks);
    console.log(`\nConflicts detected: ${Object.keys(conflicts.fileMap).length} files, ${Object.keys(conflicts.domainMap).length} domains`);

    // Output layers as JSON for orchestrate.sh
    const outputPath = path.join(path.dirname(tasksPath), '.claude', 'task-layers.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ layers, tasks: sorted }, null, 2));
    console.log(`\nLayers written to: ${outputPath}`);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseTasks,
  buildDAG,
  createLayers,
  detectConflicts
};
