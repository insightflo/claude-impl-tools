#!/usr/bin/env node
'use strict';

const { runShim } = require('./_project-hook-shim');

runShim('session-memory-loader').catch(() => {
  process.exit(0);
});
