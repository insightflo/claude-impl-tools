'use strict';

const crypto = require('crypto');

const { writeEvent } = require('./whitebox-events');

const APPROVED_EXECUTORS = new Set(['claude', 'codex', 'gemini']);

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'run';
}

function createRunId(kind, hint) {
  const prefix = slugify(kind || 'run');
  const suffix = hint ? `-${slugify(hint)}` : '';
  const randomPart = crypto.randomBytes(3).toString('hex');
  return `${prefix}${suffix}-${Date.now()}-${randomPart}`;
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function normalizeExecutorName(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'codex' || raw.startsWith('codex ')) return 'codex';
  if (raw === 'gemini' || raw.startsWith('gemini ')) return 'gemini';
  if (raw === 'claude' || raw.startsWith('claude ') || raw.startsWith('sonnet') || raw.startsWith('opus') || raw.startsWith('haiku')) {
    return 'claude';
  }
  return raw;
}

async function emitRunEvent({ type, producer, data, projectDir, correlationId, causationId }) {
  try {
    return await writeEvent({
      type,
      producer,
      correlation_id: correlationId || undefined,
      causation_id: causationId || undefined,
      data,
    }, {
      projectDir,
    });
  } catch {
    return null;
  }
}

function withExecutorMetadata(executor, extra = {}) {
  const normalized = normalizeExecutorName(executor);
  return {
    executor: normalized,
    approved_executor: normalized ? APPROVED_EXECUTORS.has(normalized) : false,
    ...extra,
  };
}

module.exports = {
  APPROVED_EXECUTORS,
  createRunId,
  emitRunEvent,
  hashText,
  normalizeExecutorName,
  withExecutorMetadata,
};
