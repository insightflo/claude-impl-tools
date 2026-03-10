const fs = require('fs');
const os = require('os');
const path = require('path');

const { syncBridgeState } = require('../../../skills/orchestrate-standalone/scripts/auto/auto-orchestrator');
const { loadState, saveState } = require('../../../skills/orchestrate-standalone/scripts/engine/state');

function makeTempProject(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  return root;
}

describe('auto orchestrator routing state sync', () => {
  test('syncBridgeState clears synthetic sonnet model for tasks without explicit model', () => {
    const projectDir = makeTempProject('auto-routing-sync-');

    saveState({
      tasks: [{
        id: 'T9.1',
        description: 'Build dashboard',
        owner: 'frontend-specialist',
        model: 'sonnet',
        status: 'pending',
      }],
      current_layer: 0,
      total_layers: 1,
    }, projectDir);

    syncBridgeState([{
      id: 'T9.1',
      description: 'Build dashboard',
      deps: [],
      domain: 'ui',
      risk: 'low',
      owner: 'frontend-specialist',
      model: null,
      status: 'pending',
    }], 1, projectDir);

    const state = loadState(projectDir);
    expect(state.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'T9.1',
        owner: 'frontend-specialist',
        model: null,
      }),
    ]));
  });
});
