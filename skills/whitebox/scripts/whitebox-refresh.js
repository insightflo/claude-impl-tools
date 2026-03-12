#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { readMarkers } = require('../../../project-team/scripts/collab-derived-meta');
const { refreshWhiteboxSummary } = require('./whitebox-summary');
const { refreshControlState } = require('./whitebox-control-state');

const BOARD_ARTIFACT = '.claude/collab/board-state.json';
const SUMMARY_ARTIFACT = '.claude/collab/whitebox-summary.json';
const CONTROL_ARTIFACT = '.claude/collab/control-state.json';
const COMPAT_EXPORT_ARTIFACTS = [
  'management/requests/README.md',
  'management/responses/README.md',
  'management/handoffs/README.md',
];

function boardBuilderScript() {
  return path.resolve(__dirname, '../../task-board/scripts/board-builder.js');
}

function compatibilityExportScript() {
  return path.resolve(__dirname, '../../../project-team/services/messaging.js');
}

function artifactPath(projectDir, artifact) {
  return path.join(projectDir, artifact);
}

function hasActiveMarker(projectDir, artifact) {
  return readMarkers(projectDir).some((entry) => entry && !entry.cleared_by && entry.artifact === artifact);
}

function needsRefresh(projectDir, artifact, force) {
  if (force) return true;
  if (!fs.existsSync(artifactPath(projectDir, artifact))) return true;
  return hasActiveMarker(projectDir, artifact);
}

function rebuildBoard(projectDir) {
  const result = spawnSync(process.execPath, [boardBuilderScript(), `--project-dir=${projectDir}`], {
    encoding: 'utf8',
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function compatibilityExportsMissing(projectDir) {
  return COMPAT_EXPORT_ARTIFACTS.some((artifact) => !fs.existsSync(path.join(projectDir, artifact)));
}

function ensureWhiteboxArtifacts(options = {}) {
  const projectDir = options.projectDir || process.cwd();
  const force = Boolean(options.force);
  const rebuilt = [];
  const failures = [];

  if (needsRefresh(projectDir, BOARD_ARTIFACT, force)) {
    const board = rebuildBoard(projectDir);
    if (board.ok) rebuilt.push(BOARD_ARTIFACT);
    else failures.push({ artifact: BOARD_ARTIFACT, message: board.stderr || board.stdout || 'board rebuild failed' });
  }

  if (needsRefresh(projectDir, CONTROL_ARTIFACT, force)) {
    try {
      refreshControlState({ projectDir });
      rebuilt.push(CONTROL_ARTIFACT);
    } catch (error) {
      failures.push({ artifact: CONTROL_ARTIFACT, message: error.message });
    }
  }

  if (needsRefresh(projectDir, SUMMARY_ARTIFACT, force) || rebuilt.includes(BOARD_ARTIFACT) || rebuilt.includes(CONTROL_ARTIFACT)) {
    try {
      refreshWhiteboxSummary({ projectDir });
      rebuilt.push(SUMMARY_ARTIFACT);
    } catch (error) {
      failures.push({ artifact: SUMMARY_ARTIFACT, message: error.message });
    }
  }

  if (force || rebuilt.length > 0 || compatibilityExportsMissing(projectDir)) {
    try {
      const compat = spawnSync(process.execPath, [compatibilityExportScript(), 'export-compat', `--project-dir=${projectDir}`], {
        encoding: 'utf8',
      });
      if ((compat.status || 0) !== 0) {
        throw new Error(compat.stderr || compat.stdout || 'compatibility export failed');
      }
    } catch (error) {
      failures.push({ artifact: 'management/* compatibility exports', message: error.message });
    }
  }

  return {
    ok: failures.length === 0,
    rebuilt,
    failures,
  };
}

module.exports = {
  BOARD_ARTIFACT,
  CONTROL_ARTIFACT,
  SUMMARY_ARTIFACT,
  ensureWhiteboxArtifacts,
  needsRefresh,
};
