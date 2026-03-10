const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseTasks } = require('../../../skills/orchestrate-standalone/scripts/engine/scheduler');

function makeTempProject(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  return root;
}

describe('worker CLI routing', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('child_process');
  });

  test('uses agent frontmatter cli_command before fallback defaults', () => {
    jest.doMock('child_process', () => ({
      ...jest.requireActual('child_process'),
      execSync: jest.fn(),
    }));

    const { resolveCliCommand } = require('../../../skills/orchestrate-standalone/scripts/engine/worker');
    const projectDir = makeTempProject('worker-routing-agent-');
    const result = resolveCliCommand({ owner: 'frontend-specialist', description: 'Build dashboard UI' }, projectDir, 'claude');

    expect(result).toMatchObject({
      command: 'gemini',
      model: 'gemini',
      routeSource: 'agent.cli_command',
    });
  });

  test('prefers project routing over global routing when no agent metadata exists', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-routing-home-'));
    const projectDir = makeTempProject('worker-routing-project-');
    const originalHome = process.env.HOME;

    process.env.HOME = homeDir;
    fs.mkdirSync(path.join(homeDir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(homeDir, '.claude', 'model-routing.yaml'), 'default: codex\n', 'utf8');
    fs.writeFileSync(path.join(projectDir, '.claude', 'model-routing.yaml'), 'default: claude\nrouting:\n  design-*: gemini\n', 'utf8');

    jest.doMock('child_process', () => ({
      ...jest.requireActual('child_process'),
      execSync: jest.fn(),
    }));

    const { resolveCliCommand } = require('../../../skills/orchestrate-standalone/scripts/engine/worker');
    const result = resolveCliCommand({ owner: 'design-lead', description: 'Create visual layout' }, projectDir, 'claude');

    expect(result).toMatchObject({
      command: 'gemini',
      model: 'gemini',
      routeSource: 'routing.project.wildcard',
    });

    process.env.HOME = originalHome;
  });

  test('uses heuristics when no routing metadata exists', () => {
    jest.doMock('child_process', () => ({
      ...jest.requireActual('child_process'),
      execSync: jest.fn(),
    }));

    const { resolveCliCommand } = require('../../../skills/orchestrate-standalone/scripts/engine/worker');
    const projectDir = makeTempProject('worker-routing-heuristic-');
    const result = resolveCliCommand({ description: 'Implement responsive UI component states', domain: 'general' }, projectDir, 'claude');

    expect(result).toMatchObject({
      command: 'gemini',
      model: 'gemini',
      routeSource: 'heuristic.frontend',
    });
  });

  test('parsed tasks without explicit model still route from owner metadata', () => {
    jest.doMock('child_process', () => ({
      ...jest.requireActual('child_process'),
      execSync: jest.fn(),
    }));

    const projectDir = makeTempProject('worker-routing-parse-');
    const tasksFile = path.join(projectDir, 'TASKS.md');
    fs.writeFileSync(tasksFile, '- [ ] T1.1: Build dashboard\n  - owner: frontend-specialist\n', 'utf8');

    const [task] = parseTasks(tasksFile);
    const { resolveCliCommand } = require('../../../skills/orchestrate-standalone/scripts/engine/worker');
    const result = resolveCliCommand(task, projectDir, 'claude');

    expect(task.model).toBeNull();
    expect(result).toMatchObject({
      command: 'gemini',
      model: 'gemini',
      routeSource: 'agent.cli_command',
    });
  });

  test('explicit task model still overrides owner routing', () => {
    jest.doMock('child_process', () => ({
      ...jest.requireActual('child_process'),
      execSync: jest.fn(),
    }));

    const projectDir = makeTempProject('worker-routing-explicit-');
    const tasksFile = path.join(projectDir, 'TASKS.md');
    fs.writeFileSync(tasksFile, '- [ ] T1.2: Build dashboard\n  - owner: frontend-specialist\n  - model: sonnet\n', 'utf8');

    const [task] = parseTasks(tasksFile);
    const { resolveCliCommand } = require('../../../skills/orchestrate-standalone/scripts/engine/worker');
    const result = resolveCliCommand(task, projectDir, 'claude');

    expect(task.model).toBe('sonnet');
    expect(result).toMatchObject({
      command: 'claude',
      model: 'claude',
      routeSource: 'task.model',
    });
  });
});
