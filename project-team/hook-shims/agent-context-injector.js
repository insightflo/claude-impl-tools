#!/usr/bin/env node
'use strict';

const { runShim } = require('./_project-hook-shim');

runShim('agent-context-injector').catch(() => {
  process.exit(0);
});
