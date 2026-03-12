'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { readNdjsonFile } = require('./ndjson');
const { redactObject } = require('./redact');

const DEFAULT_SCHEMA_VERSION = '1.0';
const DEFAULT_EVENTS_REL_PATH = '.claude/collab/events.ndjson';
const REQUIRED_KEYS = ['schema_version', 'event_id', 'ts', 'type', 'producer', 'data'];
const RUNS_REL_PATH = '.claude/collab/runs';
const RUN_REPORT_SCHEMA_VERSION = '1.0';

const RUN_LIFECYCLE_TYPES = [
  'approval_required',
  'execution_paused',
  'approval_granted',
  'approval_rejected',
  'execution_resumed',
];

const RUN_REMEDIATION_TYPES = new Set([
  ...RUN_LIFECYCLE_TYPES,
  'orchestrate.gate.outcome',
  'hook.decision',
  'whitebox.control.command.recorded',
]);

function resolveProjectDir(projectDir) {
  return projectDir || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function resolveEventsFilePath(opts = {}) {
  const projectDir = resolveProjectDir(opts.projectDir);
  const file = opts.file || DEFAULT_EVENTS_REL_PATH;
  return path.resolve(projectDir, file);
}

function normalizeRunId(value) {
  return String(value || '').trim().replace(/[\\/]+/g, '_');
}

function extractGateId(data) {
  if (!data || typeof data !== 'object') return null;
  return data.gate_id || data.gate || null;
}

function extractEventRunId(event) {
  const data = event && event.data && typeof event.data === 'object' ? event.data : {};
  return normalizeRunId(data.run_id || null);
}

function resolveRunReportFilePath(projectDir, runId) {
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) return null;
  return path.join(projectDir, RUNS_REL_PATH, normalizedRunId, 'report.json');
}

function resolveRunReportRelativePath(runId) {
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) return null;
  return `${RUNS_REL_PATH}/${normalizedRunId}/report.json`;
}

function createEventId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function buildEnvelope(input) {
  const event = {
    schema_version: input.schema_version || DEFAULT_SCHEMA_VERSION,
    event_id: input.event_id || createEventId(),
    ts: input.ts || new Date().toISOString(),
    type: input.type,
    producer: input.producer,
    data: input.data,
  };

  if (input.correlation_id !== undefined && input.correlation_id !== null && input.correlation_id !== '') {
    event.correlation_id = String(input.correlation_id);
  }
  if (input.causation_id !== undefined && input.causation_id !== null && input.causation_id !== '') {
    event.causation_id = String(input.causation_id);
  }

  return event;
}

function validateEvent(event) {
  const errors = [];

  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { ok: false, errors: ['event must be an object'] };
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in event)) errors.push(`missing required key: ${key}`);
  }

  if ('schema_version' in event && typeof event.schema_version !== 'string') errors.push('schema_version must be a string');
  if ('event_id' in event && typeof event.event_id !== 'string') errors.push('event_id must be a string');
  if ('ts' in event && typeof event.ts !== 'string') errors.push('ts must be a string');
  if ('type' in event && typeof event.type !== 'string') errors.push('type must be a string');
  if ('producer' in event && typeof event.producer !== 'string') errors.push('producer must be a string');
  if ('data' in event && (event.data === null || typeof event.data !== 'object' || Array.isArray(event.data))) {
    errors.push('data must be an object');
  }
  if ('correlation_id' in event && typeof event.correlation_id !== 'string') errors.push('correlation_id must be a string');
  if ('causation_id' in event && typeof event.causation_id !== 'string') errors.push('causation_id must be a string');

  return { ok: errors.length === 0, errors };
}

function writeJsonAtomic(filePath, payload) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function latestByTs(items) {
  return [...items].sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))[0] || null;
}

function deriveRemediation(event) {
  const data = event && event.data && typeof event.data === 'object' ? event.data : {};

  if (event.type === 'approval_rejected') {
    return data.recommendation
      || data.remediation
      || 'Review rejection context, adjust the plan, and request a new approval gate when ready.';
  }
  if (event.type === 'approval_required' || event.type === 'execution_paused') {
    return data.recommendation || data.remediation || null;
  }
  if (event.type === 'orchestrate.gate.outcome' && data.outcome && data.outcome !== 'pass') {
    return data.remediation || data.reason || null;
  }
  if (event.type === 'hook.decision' && data.decision && data.decision !== 'allow') {
    return data.remediation || data.summary || null;
  }
  if (event.type === 'whitebox.control.command.recorded') {
    return data.remediation || null;
  }
  return data.remediation || null;
}

function collectRunLinkedEvents(events, runId) {
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) return [];

  const correlationToRun = new Map();
  const gateToRun = new Map();

  for (const event of events) {
    const eventRunId = extractEventRunId(event);
    if (!eventRunId) continue;
    const data = event && event.data && typeof event.data === 'object' ? event.data : {};
    const correlationId = String(event.correlation_id || '').trim();
    const gateId = extractGateId(data);
    if (correlationId) correlationToRun.set(correlationId, eventRunId);
    if (gateId) gateToRun.set(gateId, eventRunId);
  }

  const linked = [];
  for (const event of events) {
    const data = event && event.data && typeof event.data === 'object' ? event.data : {};
    const eventRunId = extractEventRunId(event);
    const correlationId = String(event.correlation_id || '').trim();
    const gateId = extractGateId(data);
    const inferredRunId = eventRunId
      || (correlationId ? correlationToRun.get(correlationId) : null)
      || (gateId ? gateToRun.get(gateId) : null)
      || null;
    if (inferredRunId !== normalizedRunId) continue;
    linked.push(event);
  }

  return linked;
}

function inferRunIdsForEvent(event, events) {
  const directRunId = extractEventRunId(event);
  if (directRunId) return [directRunId];

  const data = event && event.data && typeof event.data === 'object' ? event.data : {};
  const correlationId = String(event.correlation_id || '').trim();
  const gateId = extractGateId(data);

  const correlationToRun = new Map();
  const gateToRun = new Map();
  for (const candidate of events) {
    const candidateRunId = extractEventRunId(candidate);
    if (!candidateRunId) continue;
    const candidateData = candidate && candidate.data && typeof candidate.data === 'object' ? candidate.data : {};
    const candidateCorrelationId = String(candidate.correlation_id || '').trim();
    const candidateGateId = extractGateId(candidateData);
    if (candidateCorrelationId && !correlationToRun.has(candidateCorrelationId)) {
      correlationToRun.set(candidateCorrelationId, candidateRunId);
    }
    if (candidateGateId && !gateToRun.has(candidateGateId)) {
      gateToRun.set(candidateGateId, candidateRunId);
    }
  }

  const inferred = new Set();
  if (correlationId && correlationToRun.has(correlationId)) inferred.add(correlationToRun.get(correlationId));
  if (gateId && gateToRun.has(gateId)) inferred.add(gateToRun.get(gateId));
  return Array.from(inferred);
}

function buildRunReport(runId, events, projectDir) {
  const relevantEvents = collectRunLinkedEvents(events, runId);
  const lifecycle = {};
  for (const type of RUN_LIFECYCLE_TYPES) {
    const typed = relevantEvents.filter((event) => event.type === type);
    const last = latestByTs(typed);
    lifecycle[type] = {
      present: typed.length > 0,
      count: typed.length,
      last_event_id: last ? last.event_id : null,
      last_ts: last ? last.ts : null,
    };
  }

  const remediationEvents = relevantEvents
    .filter((event) => RUN_REMEDIATION_TYPES.has(event.type))
    .map((event) => {
      const data = event && event.data && typeof event.data === 'object' ? event.data : {};
      return {
        event_id: event.event_id,
        type: event.type,
        ts: event.ts,
        correlation_id: event.correlation_id || null,
        causation_id: event.causation_id || null,
        gate_id: extractGateId(data),
        task_id: data.task_id || null,
        trigger_type: data.trigger_type || null,
        trigger_reason: data.trigger_reason || null,
        recommendation: data.recommendation || null,
        remediation: deriveRemediation(event),
      };
    });

  const latest = latestByTs(relevantEvents);
  const latestRemediation = latestByTs(remediationEvents);
  const correlationIds = Array.from(new Set(relevantEvents
    .map((event) => String(event.correlation_id || '').trim())
    .filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const gateIds = Array.from(new Set(relevantEvents
    .map((event) => extractGateId(event && event.data && typeof event.data === 'object' ? event.data : {}))
    .filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
  const taskIds = Array.from(new Set(relevantEvents
    .map((event) => {
      const data = event && event.data && typeof event.data === 'object' ? event.data : {};
      return data.task_id || null;
    })
    .filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
  const triggerTypes = Array.from(new Set(relevantEvents
    .map((event) => {
      const data = event && event.data && typeof event.data === 'object' ? event.data : {};
      return data.trigger_type || null;
    })
    .filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));

  return {
    schema_version: RUN_REPORT_SCHEMA_VERSION,
    run_id: normalizeRunId(runId),
    generated_at: new Date().toISOString(),
    event_count: relevantEvents.length,
    first_event_ts: relevantEvents.length ? [...relevantEvents].sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')))[0].ts : null,
    last_event_ts: latest ? latest.ts : null,
    lifecycle,
    remediation: {
      current: latestRemediation ? {
        event_id: latestRemediation.event_id,
        type: latestRemediation.type,
        ts: latestRemediation.ts,
        remediation: latestRemediation.remediation,
        recommendation: latestRemediation.recommendation,
      } : null,
      history: remediationEvents,
    },
    correlation: {
      ids: correlationIds,
      gate_ids: gateIds,
      task_ids: taskIds,
      trigger_types: triggerTypes,
      latest_event_id: latest ? latest.event_id : null,
      latest_event_type: latest ? latest.type : null,
      latest_correlation_id: latest ? latest.correlation_id || null : null,
      latest_causation_id: latest ? latest.causation_id || null : null,
    },
    evidence_paths: [
      path.join(projectDir, DEFAULT_EVENTS_REL_PATH),
      path.join(projectDir, '.claude/collab/control.ndjson'),
      path.join(projectDir, resolveRunReportRelativePath(runId)),
    ].filter((filePath) => fs.existsSync(filePath)),
    derived_from: {
      event_log: DEFAULT_EVENTS_REL_PATH,
      writer: 'project-team/scripts/lib/whitebox-events.js',
    },
  };
}

function refreshRunReportForEvent(event, options = {}) {
  const projectDir = resolveProjectDir(options.projectDir);
  const parsed = readEvents({ projectDir, tolerateTrailingPartialLine: true });
  const runIds = inferRunIdsForEvent(event, parsed.events);
  if (runIds.length === 0) return null;
  const refreshed = [];
  for (const runId of runIds) {
    const report = buildRunReport(runId, parsed.events, projectDir);
    if (!report || report.event_count === 0) continue;
    const reportPath = resolveRunReportFilePath(projectDir, runId);
    writeJsonAtomic(reportPath, report);
    refreshed.push({ run_id: runId, report_path: reportPath });
  }
  return refreshed.length > 0 ? refreshed[0] : null;
}

async function writeEvent(input, options = {}) {
  const event = redactObject(buildEnvelope(input || {}));
  const validation = validateEvent(event);
  if (!validation.ok) {
    const err = new Error(`invalid event: ${validation.errors.join('; ')}`);
    err.code = 'WHITEBOX_EVENT_INVALID';
    err.validation = validation;
    throw err;
  }

  const filePath = resolveEventsFilePath(options);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  fs.appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf8');

  try {
    refreshRunReportForEvent(event, options);
  } catch {
  }

  return event;
}

function classifyTruncated(readResult, filePath, tolerateTrailingPartialLine) {
  if (!tolerateTrailingPartialLine || !readResult.errors.length) {
    return { truncatedLines: new Set(), totalLines: 0 };
  }

  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return { truncatedLines: new Set(), totalLines: 0 };
  }

  const lines = raw.split('\n');
  const totalLines = lines.length;
  const hasTrailingNewline = raw.endsWith('\n');
  const lastNonEmptyLine = (() => {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if ((lines[i] || '').trim()) return i + 1;
    }
    return 0;
  })();

  const truncatedLines = new Set();
  for (const err of readResult.errors) {
    const msg = String(err.error || '');
    const trailingPartial = !hasTrailingNewline && err.line === lastNonEmptyLine;
    if (trailingPartial || (err.line === lastNonEmptyLine && msg.includes('Unexpected end of JSON input'))) {
      truncatedLines.add(err.line);
    }
  }
  return { truncatedLines, totalLines };
}

function readEvents(options = {}) {
  const filePath = resolveEventsFilePath({ file: options.file, projectDir: options.projectDir });
  const tolerateTrailingPartialLine = options.tolerateTrailingPartialLine !== false;

  const result = readNdjsonFile(filePath);
  const { truncatedLines } = classifyTruncated(result, filePath, tolerateTrailingPartialLine);

  const errors = result.errors.filter((e) => !truncatedLines.has(e.line)).map((e) => ({
    line: e.line,
    kind: 'invalid_json',
    message: e.error,
    content_preview: e.content_preview,
  }));

  const truncated = result.errors.filter((e) => truncatedLines.has(e.line)).map((e) => ({
    line: e.line,
    kind: 'truncated',
    message: e.error,
    content_preview: e.content_preview,
  }));

  return {
    file: filePath,
    events: result.records,
    errors,
    truncated,
  };
}

function validateEvents(options = {}) {
  const parsed = readEvents({
    file: options.file,
    projectDir: options.projectDir,
    tolerateTrailingPartialLine: true,
  });

  let valid = 0;
  let schemaInvalid = 0;
  const schemaVersions = new Set();

  for (const event of parsed.events) {
    const validation = validateEvent(event);
    if (validation.ok) {
      valid += 1;
      if (typeof event.schema_version === 'string') schemaVersions.add(event.schema_version);
    } else {
      schemaInvalid += 1;
    }
  }

  const invalid = parsed.errors.length + schemaInvalid;
  const truncated = parsed.truncated.length;
  const total = parsed.events.length + parsed.errors.length + parsed.truncated.length;

  return {
    ok: invalid === 0 && truncated === 0,
    total,
    valid,
    invalid,
    truncated,
    schemaVersions: Array.from(schemaVersions).sort(),
  };
}

module.exports = {
  RUNS_REL_PATH,
  RUN_REPORT_SCHEMA_VERSION,
  buildRunReport,
  collectRunLinkedEvents,
  extractEventRunId,
  refreshRunReportForEvent,
  writeEvent,
  readEvents,
  validateEvents,
};
