'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const scheduler = require('../../skills/orchestrate-standalone/scripts/engine/scheduler.js');
const state = require('../../skills/orchestrate-standalone/scripts/engine/state.js');
const gateChain = require('../../skills/orchestrate-standalone/scripts/engine/gate-chain.js');

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function stripIndent(content) {
  const lines = String(content).replace(/^\n/, '').split('\n');
  const indents = lines
    .filter(line => line.trim() !== '')
    .map(line => line.match(/^ */)[0].length);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map(line => line.slice(minIndent)).join('\n');
}

async function withTempDir(prefix, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function withCwd(dir, fn) {
  const previous = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

function writeTasksFile(projectDir, content) {
  const tasksPath = path.join(projectDir, 'TASKS.md');
  fs.writeFileSync(tasksPath, stripIndent(content).trim() + '\n', 'utf8');
  return tasksPath;
}

function makeTask(id, overrides) {
  return {
    id,
    description: `Task ${id}`,
    status: 'pending',
    deps: [],
    domain: 'shared',
    risk: 'low',
    files: [`src/${id.toLowerCase()}.js`],
    owner: null,
    model: 'sonnet',
    ...overrides
  };
}

runTest('T0-11a: Wave mode creates proper wave structure', () => {
  const tasks = Array.from({ length: 10 }, (_, index) => makeTask(`T${index + 1}`, {
    domain: `domain-${(index % 3) + 1}`
  }));

  const waves = scheduler.createWaves(tasks, 3);

  assert.ok(waves.length >= 3, `expected at least 3 waves, received ${waves.length}`);
  for (const wave of waves) {
    assert.ok(Array.isArray(wave.tasks), 'wave.tasks should be an array');
    assert.ok(wave.domains && typeof wave.domains === 'object', 'wave.domains should be an object');
  }
});

runTest('T0-11b: createWavePlan produces 4 phases', async () => {
  await withTempDir('orch-wave-plan-', async projectDir => {
    const tasksPath = writeTasksFile(projectDir, `
      - [ ] T1: Seed shared contracts
        - deps: []
        - domain: shared
        - files: contracts/base.yaml

      - [ ] T2: Build API module
        - deps: [T1]
        - domain: api
        - files: src/api.js

      - [ ] T3: Build UI module
        - deps: [T1]
        - domain: ui
        - files: src/ui.js

      - [ ] T4: Integrate system
        - deps: [T2, T3]
        - domain: integration
        - files: src/integration.js
    `);

    const tasks = scheduler.parseTasks(tasksPath);
    const plan = scheduler.createWavePlan(tasks, { waveSize: 2 });

    assert.strictEqual(plan.phases.length, 4);
    assert.deepStrictEqual(
      plan.phases.map(phase => phase.name),
      [
        'Shared Foundation',
        'Domain Parallelism',
        'Cross-Review Gate',
        'Integration & Polish'
      ]
    );
  });
});

runTest('T0-11c: Gate pipeline passes when no hooks installed', async () => {
  await withTempDir('orch-gates-', async projectDir => {
    const layer = [makeTask('T1', { domain: 'api' })];

    await withCwd(projectDir, async () => {
      const result = await gateChain.runGatePipeline(layer, 0);
      assert.strictEqual(result.passed, true);
    });
  });
});

runTest('T0-11d: State resume capability works', async () => {
  await withTempDir('orch-state-', async projectDir => {
    state.saveState({
      version: '1.0.0',
      started_at: '2026-03-06T00:00:00.000Z',
      current_layer: 2,
      total_layers: 4,
      mode: 'wave',
      tasks: [
        { id: 'T1', status: 'completed' },
        { id: 'T2', status: 'pending' }
      ]
    }, projectDir);

    const loaded = state.loadState(projectDir);

    assert.strictEqual(loaded.current_layer, 2);
    assert.strictEqual(state.canResume(projectDir), true);
  });
});

runTest('T0-11e: State clearState creates backup and removes state file', async () => {
  await withTempDir('orch-clear-', async projectDir => {
    state.saveState({
      version: '1.0.0',
      started_at: '2026-03-06T00:00:00.000Z',
      current_layer: 1,
      total_layers: 2,
      mode: 'standard',
      tasks: [{ id: 'T1', status: 'pending' }]
    }, projectDir);

    const statePath = path.join(projectDir, '.claude', 'orchestrate-state.json');
    const backupDir = path.join(projectDir, '.claude', 'backups');

    state.clearState(projectDir);

    assert.strictEqual(fs.existsSync(statePath), false, 'state file should be removed');
    assert.strictEqual(fs.existsSync(backupDir), true, 'backup directory should exist');
    assert.ok(
      fs.readdirSync(backupDir).some(file => /^orchestrate-state-.*\.json$/.test(file)),
      'expected a state backup file in .claude/backups/'
    );
  });
});

runTest('T0-11f: createLayers respects file conflicts', () => {
  const tasks = [
    makeTask('T1', { files: ['src/shared.js'], domain: 'api' }),
    makeTask('T2', { files: ['src/shared.js'], domain: 'ui' })
  ];

  const { sorted } = scheduler.buildDAG(tasks);
  const layers = scheduler.createLayers(sorted);

  assert.ok(layers.length >= 2, `expected file conflicts to force multiple layers, received ${layers.length}`);
});

runTest('T0-11g: createLayers respects domain conflicts', () => {
  const tasks = [
    makeTask('T1', { domain: 'payments', files: ['src/payments-a.js'] }),
    makeTask('T2', { domain: 'payments', files: ['src/payments-b.js'] })
  ];

  const { sorted } = scheduler.buildDAG(tasks);
  const layers = scheduler.createLayers(sorted);

  assert.ok(layers.length >= 2, `expected domain conflicts to force multiple layers, received ${layers.length}`);
});

runTest('T0-11h: createLayers serializes critical risk tasks', () => {
  const tasks = [
    makeTask('T1', { risk: 'critical', domain: 'api', files: ['src/auth.js'] }),
    makeTask('T2', { risk: 'critical', domain: 'ui', files: ['src/dashboard.js'] })
  ];

  const { sorted } = scheduler.buildDAG(tasks);
  const layers = scheduler.createLayers(sorted);

  assert.ok(layers.length >= 2, `expected critical tasks to be serialized, received ${layers.length}`);
});

async function main() {
  for (const test of tests) {
    try {
      await test.fn();
      process.stdout.write('ok - ' + test.name + '\n');
    } catch (error) {
      process.stderr.write('not ok - ' + test.name + '\n' + error.stack + '\n');
      process.exitCode = 1;
    }
  }
}

main().catch(error => {
  process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
});
