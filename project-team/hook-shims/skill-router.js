#!/usr/bin/env node
'use strict';

const { runShim } = require('./_project-hook-shim');

runShim('skill-router').catch(() => {
  process.exit(0);
});
