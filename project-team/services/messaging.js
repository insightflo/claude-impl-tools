const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const { readEvents, writeEvent } = require('../scripts/lib/whitebox-events');

const COMPATIBILITY_EXPORT_ROOT = 'management';
const COMPATIBILITY_REQUESTS_DIR = path.join(COMPATIBILITY_EXPORT_ROOT, 'requests');
const COMPATIBILITY_RESPONSES_DIR = path.join(COMPATIBILITY_EXPORT_ROOT, 'responses');
const COMPATIBILITY_HANDOFFS_DIR = path.join(COMPATIBILITY_EXPORT_ROOT, 'handoffs');
const READ_ONLY_COMPATIBILITY_PATHS = [
  COMPATIBILITY_REQUESTS_DIR,
  COMPATIBILITY_RESPONSES_DIR,
  COMPATIBILITY_HANDOFFS_DIR,
];
const COMPATIBILITY_EXPORT_NOTE = '<!-- GENERATED FILE: compatibility export. DO NOT EDIT. Rebuild from .claude/collab with `node project-team/services/messaging.js export-compat`. -->';
const REQUIRED_ACTIONABLE_FIELDS = Object.freeze([
  'what_changed',
  'why',
  'next_action',
  'required_artifacts',
  'constraints',
  'recipient',
]);
const MARKDOWN_FIELD_ALIASES = Object.freeze({
  what_changed: ['What Changed', 'Change Summary'],
  why: ['Why', 'Background', 'Reason'],
  next_action: ['Next Action', 'Next Actions'],
  required_artifacts: ['Required Artifacts'],
  constraints: ['Constraints'],
  recipient: ['Recipient', 'To'],
});

function toPosixRelative(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function normalizePreview(value, maxLength = 800) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function responseSectionFromRequest(content) {
  const match = String(content || '').match(/(^|\n)##\s+Response\s*\n([\s\S]*)$/i);
  return match ? match[2].trim() : '';
}

function compatibilityBanner(title, sourcePath) {
  return [
    COMPATIBILITY_EXPORT_NOTE,
    `# ${title}`,
    '',
    `- Canonical source: \`${sourcePath}\``,
    '',
  ].join('\n');
}

function buildSectionPattern(title) {
  const escaped = String(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
}

function extractMarkdownSection(content, aliases) {
  const source = String(content || '');
  for (const alias of aliases) {
    const match = source.match(buildSectionPattern(alias));
    if (match && match[2]) {
      const value = match[2].trim();
      if (value) return value;
    }
  }
  return '';
}

function sanitizeActionableValue(value) {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function parseActionableFieldsFromMarkdown(content, fallbackRecipient = null) {
  const extracted = {
    what_changed: extractMarkdownSection(content, MARKDOWN_FIELD_ALIASES.what_changed),
    why: extractMarkdownSection(content, MARKDOWN_FIELD_ALIASES.why),
    next_action: extractMarkdownSection(content, MARKDOWN_FIELD_ALIASES.next_action),
    required_artifacts: extractMarkdownSection(content, MARKDOWN_FIELD_ALIASES.required_artifacts),
    constraints: extractMarkdownSection(content, MARKDOWN_FIELD_ALIASES.constraints),
    recipient: extractMarkdownSection(content, MARKDOWN_FIELD_ALIASES.recipient) || fallbackRecipient,
  };

  return {
    what_changed: sanitizeActionableValue(extracted.what_changed),
    why: sanitizeActionableValue(extracted.why),
    next_action: sanitizeActionableValue(extracted.next_action),
    required_artifacts: sanitizeActionableValue(
      typeof extracted.required_artifacts === 'string'
        ? extracted.required_artifacts.split(/\n+/).map((line) => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
        : extracted.required_artifacts
    ),
    constraints: sanitizeActionableValue(
      typeof extracted.constraints === 'string'
        ? extracted.constraints.split(/\n+/).map((line) => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
        : extracted.constraints
    ),
    recipient: sanitizeActionableValue(extracted.recipient),
  };
}

function toActionableError(missingFields, semantic) {
  const error = new Error(`Missing required actionable field(s) for ${semantic}: ${missingFields.join(', ')}`);
  error.code = 'COLLAB_MISSING_FIELDS';
  error.missing_fields = missingFields;
  return error;
}

class AgentMessagingService {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.protocolDir = options.protocolDir || path.join(this.projectRoot, 'project-team', 'templates', 'protocol');
    this.managementDir = options.managementDir || path.join(this.projectRoot, 'management');
    this.collabDir = options.collabDir || path.join(this.projectRoot, '.claude', 'collab');
    this.messageQueue = [];
    this.messageHistory = [];
  }

  ensureActionablePayload(payload, semantic) {
    const normalized = {
      what_changed: sanitizeActionableValue(payload && payload.what_changed),
      why: sanitizeActionableValue(payload && payload.why),
      next_action: sanitizeActionableValue(payload && payload.next_action),
      required_artifacts: sanitizeActionableValue(payload && payload.required_artifacts),
      constraints: sanitizeActionableValue(payload && payload.constraints),
      recipient: sanitizeActionableValue(payload && payload.recipient),
    };
    const missingFields = REQUIRED_ACTIONABLE_FIELDS.filter((field) => !normalized[field]);
    if (missingFields.length > 0) {
      throw toActionableError(missingFields, semantic);
    }
    return normalized;
  }

  ensureActionableMarkdown(content, semantic, fallbackRecipient = null) {
    const payload = parseActionableFieldsFromMarkdown(content, fallbackRecipient);
    const hasStructuredFields = ['what_changed', 'why', 'next_action', 'required_artifacts', 'constraints']
      .some((field) => Boolean(payload[field]));
    if (!hasStructuredFields) {
      return this.ensureActionablePayload({
        recipient: fallbackRecipient,
        what_changed: normalizePreview(content, 240),
        why: 'Legacy artifact did not provide structured why section.',
        next_action: `Review ${semantic} and provide an explicit next step.`,
        required_artifacts: [semantic],
        constraints: ['Migrate this artifact to required actionable sections.'],
      }, `${semantic} (legacy fallback)`);
    }
    return this.ensureActionablePayload(payload, semantic);
  }

  async ensureCanonicalScaffolding() {
    const collabHandoffsDir = path.join(this.collabDir, 'handoffs');
    const collabRequestsDir = path.join(this.collabDir, 'requests');
    await Promise.all([
      fsp.mkdir(collabHandoffsDir, { recursive: true }),
      fsp.mkdir(collabRequestsDir, { recursive: true }),
      this.exportCompatibilityViews(),
    ]);
    return {
      collab_handoffs: toPosixRelative(this.projectRoot, collabHandoffsDir),
      collab_requests: toPosixRelative(this.projectRoot, collabRequestsDir),
    };
  }

  async createCanonicalHandoffArtifact(payload) {
    const actionable = this.ensureActionablePayload(payload, 'handoff payload');
    await this.ensureCanonicalScaffolding();
    const handoffsDir = path.join(this.collabDir, 'handoffs');
    const now = new Date();
    const dateId = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const id = payload.id || `HOF-${dateId}`;
    const fileName = `${id}.md`;
    const artifactPath = path.join(handoffsDir, fileName);
    const content = [
      `# Handoff: ${payload.title || 'Cross-domain work transition'}`,
      '',
      '## Sender',
      payload.from || 'unknown',
      '',
      '## Recipient',
      actionable.recipient,
      '',
      '## What Changed',
      actionable.what_changed,
      '',
      '## Why',
      actionable.why,
      '',
      '## Next Action',
      actionable.next_action,
      '',
      '## Required Artifacts',
      ...(Array.isArray(actionable.required_artifacts)
        ? actionable.required_artifacts.map((entry) => `- ${entry}`)
        : [String(actionable.required_artifacts)]),
      '',
      '## Constraints',
      ...(Array.isArray(actionable.constraints)
        ? actionable.constraints.map((entry) => `- ${entry}`)
        : [String(actionable.constraints)]),
      '',
    ].join('\n');
    await fsp.writeFile(artifactPath, content, 'utf-8');
    return artifactPath;
  }

  resolveCompatibilityDir(relativeDir) {
    return path.join(this.projectRoot, relativeDir);
  }

  isCompatibilityPath(filePath) {
    const resolved = path.resolve(filePath);
    return READ_ONLY_COMPATIBILITY_PATHS.some((relativeDir) => {
      const compatDir = this.resolveCompatibilityDir(relativeDir);
      return resolved === compatDir || resolved.startsWith(`${compatDir}${path.sep}`);
    });
  }

  assertCompatibilityPathReadOnly(filePath, semantic) {
    if (!filePath || !this.isCompatibilityPath(filePath)) return;
    const error = new Error(
      `Single source of truth violation: ${semantic} must be written under .claude/collab; ${toPosixRelative(this.projectRoot, filePath)} is a generated compatibility export.`
    );
    error.code = 'COLLAB_SINGLE_SOURCE_OF_TRUTH';
    throw error;
  }

  resolveCanonicalRequestPath(requestFile) {
    const requestsDir = path.join(this.collabDir, 'requests');
    const resolved = path.resolve(this.projectRoot, requestFile);
    this.assertCompatibilityPathReadOnly(resolved, 'request/response artifacts');

    if (fs.existsSync(resolved)) {
      const prefix = `${requestsDir}${path.sep}`;
      if (resolved.startsWith(prefix)) return resolved;
    }

    const byName = path.join(requestsDir, path.basename(requestFile));
    if (fs.existsSync(byName)) return byName;

    const error = new Error(`Canonical request file not found: ${requestFile}`);
    error.code = 'COLLAB_REQUEST_NOT_FOUND';
    throw error;
  }

  resolveHandoffSourcePath(handoffFile) {
    const resolved = path.resolve(this.projectRoot, handoffFile);
    this.assertCompatibilityPathReadOnly(resolved, 'handoff artifacts');
    if (!fs.existsSync(resolved)) {
      const error = new Error(`Handoff source file not found: ${handoffFile}`);
      error.code = 'COLLAB_HANDOFF_NOT_FOUND';
      throw error;
    }
    return resolved;
  }

  compatibilityResponsePathForRequest(requestPath) {
    return path.join(COMPATIBILITY_RESPONSES_DIR, path.basename(requestPath));
  }

  async recordCanonicalMessageEvent(message, metadata = {}) {
    const sourceFile = metadata.sourceFile ? toPosixRelative(this.projectRoot, metadata.sourceFile) : null;
    const compatibilityPath = metadata.compatibilityPath
      ? toPosixRelative(this.projectRoot, metadata.compatibilityPath)
      : null;
    const event = await writeEvent({
      type: `messaging.${message.type}`,
      producer: 'project-team/services/messaging',
      correlation_id: message.id,
      data: {
        message_id: message.id,
        from: message.from,
        to: message.to,
        subject: message.subject,
        protocol: message.protocol,
        priority: message.priority || null,
        action_required: Boolean(message.actionRequired),
        expects_response: Boolean(message.expectsResponse),
        recipient: message.actionable && message.actionable.recipient ? message.actionable.recipient : message.to,
        what_changed: message.actionable && message.actionable.what_changed ? message.actionable.what_changed : null,
        why: message.actionable && message.actionable.why ? message.actionable.why : null,
        next_action: message.actionable && message.actionable.next_action ? message.actionable.next_action : null,
        required_artifacts: message.actionable && message.actionable.required_artifacts ? message.actionable.required_artifacts : null,
        constraints: message.actionable && message.actionable.constraints ? message.actionable.constraints : null,
        source_file: sourceFile,
        compatibility_export: compatibilityPath,
        content_preview: normalizePreview(
          typeof message.content === 'string' ? message.content : JSON.stringify(message.content || {})
        ),
      },
    }, {
      projectDir: this.projectRoot,
    });
    this.messageHistory.push({ ...message, event_id: event.event_id });
    return event;
  }

  async ensureCompatibilityExportDir(relativeDir, title, sourceDescription) {
    const dirPath = this.resolveCompatibilityDir(relativeDir);
    await fsp.mkdir(dirPath, { recursive: true });
    await fsp.writeFile(
      path.join(dirPath, 'README.md'),
      [
        COMPATIBILITY_EXPORT_NOTE,
        `# ${title}`,
        '',
        '- This directory is generated for compatibility and human readability only.',
        '- Authoritative writable artifacts live under `.claude/collab/`.',
        `- Source: ${sourceDescription}`,
        '',
      ].join('\n'),
      'utf-8'
    );
    return dirPath;
  }

  async resetGeneratedMarkdown(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.name === 'README.md' || !entry.name.endsWith('.md')) continue;
      await fsp.unlink(path.join(dirPath, entry.name));
    }
  }

  async exportCompatibilityViews() {
    const requestsDir = path.join(this.collabDir, 'requests');
    const requestFiles = fs.existsSync(requestsDir)
      ? (await fsp.readdir(requestsDir)).filter((name) => /^REQ-.*\.md$/i.test(name)).sort((a, b) => a.localeCompare(b))
      : [];
    const handoffEvents = readEvents({ projectDir: this.projectRoot, tolerateTrailingPartialLine: true }).events
      .filter((event) => event && event.type === 'messaging.handoff')
      .sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));

    const requestsExportDir = await this.ensureCompatibilityExportDir(
      COMPATIBILITY_REQUESTS_DIR,
      'Compatibility Requests Export',
      '`.claude/collab/requests/*.md` canonical request artifacts'
    );
    const responsesExportDir = await this.ensureCompatibilityExportDir(
      COMPATIBILITY_RESPONSES_DIR,
      'Compatibility Responses Export',
      'response sections extracted from `.claude/collab/requests/*.md`'
    );
    const handoffsExportDir = await this.ensureCompatibilityExportDir(
      COMPATIBILITY_HANDOFFS_DIR,
      'Compatibility Handoffs Export',
      'handoff events projected from `.claude/collab/events.ndjson`'
    );

    await Promise.all([
      this.resetGeneratedMarkdown(requestsExportDir),
      this.resetGeneratedMarkdown(responsesExportDir),
      this.resetGeneratedMarkdown(handoffsExportDir),
    ]);

    for (const requestFile of requestFiles) {
      const canonicalPath = path.join(requestsDir, requestFile);
      const canonicalRel = toPosixRelative(this.projectRoot, canonicalPath);
      const content = await fsp.readFile(canonicalPath, 'utf-8');
      await fsp.writeFile(
        path.join(requestsExportDir, requestFile),
        `${compatibilityBanner(`Compatibility Request ${path.basename(requestFile, '.md')}`, canonicalRel)}${content.trim()}\n`,
        'utf-8'
      );

      const responseBody = responseSectionFromRequest(content) || '_No response has been recorded in the canonical request artifact yet._';
      await fsp.writeFile(
        path.join(responsesExportDir, requestFile),
        `${compatibilityBanner(`Compatibility Response ${path.basename(requestFile, '.md')}`, canonicalRel)}${responseBody}\n`,
        'utf-8'
      );
    }

    for (const event of handoffEvents) {
      const data = event.data || {};
      const title = data.subject || data.message_id || event.event_id;
      const sourcePath = data.source_file || '.claude/collab/events.ndjson';
      await fsp.writeFile(
        path.join(handoffsExportDir, `${event.event_id}.md`),
        [
          compatibilityBanner(`Compatibility Handoff ${title}`, sourcePath),
          `- Message ID: \`${data.message_id || 'unknown'}\``,
          `- From: \`${data.from || 'unknown'}\``,
          `- To: \`${data.to || 'unknown'}\``,
          `- Timestamp: \`${event.ts || 'unknown'}\``,
          '',
          '## Preview',
          '',
          data.content_preview || '_No preview available._',
          '',
        ].join('\n'),
        'utf-8'
      );
    }

    return {
      ok: true,
      requests: requestFiles.length,
      handoffs: handoffEvents.length,
      exports: [
        COMPATIBILITY_REQUESTS_DIR,
        COMPATIBILITY_RESPONSES_DIR,
        COMPATIBILITY_HANDOFFS_DIR,
      ],
    };
  }

  async notifyHandoff(handoffFile, recipientAgent) {
    try {
      const handoffPath = this.resolveHandoffSourcePath(handoffFile);
      const handoffContent = await fsp.readFile(handoffPath, 'utf-8');
      const actionable = this.ensureActionableMarkdown(handoffContent, 'handoff artifact', recipientAgent);
      const compatibilityPath = path.join(this.projectRoot, COMPATIBILITY_HANDOFFS_DIR, `${path.basename(handoffPath, path.extname(handoffPath))}.md`);
      const message = {
        type: 'handoff',
        id: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        from: this.extractAgentFromHandoff(handoffContent),
        to: recipientAgent,
        subject: `Handoff: ${this.extractHandoffSubject(handoffContent)}`,
        content: handoffContent,
        actionable,
        actionRequired: true,
        protocol: 'handoff',
      };

      await this.deliverMessage(message);
      await this.recordMessage(message, {
        sourceFile: handoffPath,
        compatibilityPath,
      });

      return {
        success: true,
        messageId: message.id,
        recipient: recipientAgent,
        canonicalSource: toPosixRelative(this.projectRoot, handoffPath),
        compatibilityExport: toPosixRelative(this.projectRoot, compatibilityPath),
        status: 'delivered',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code || null,
        status: 'failed',
        missing_fields: error.missing_fields || [],
      };
    }
  }

  async notifyHandoffPayload(payload) {
    const handoffPath = await this.createCanonicalHandoffArtifact(payload);
    return this.notifyHandoff(handoffPath, payload.recipient);
  }

  async requestResponse(requestFile, recipientAgent) {
    try {
      const requestPath = this.resolveCanonicalRequestPath(requestFile);
      const requestContent = await fsp.readFile(requestPath, 'utf-8');
      const actionable = this.ensureActionableMarkdown(requestContent, 'request artifact', recipientAgent);
      const responsePath = path.join(this.projectRoot, this.compatibilityResponsePathForRequest(requestPath));
      const message = {
        type: 'request',
        id: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        from: this.extractRequestFrom(requestContent),
        to: recipientAgent,
        subject: `Request: ${this.extractRequestSubject(requestContent)}`,
        content: requestContent,
        actionable,
        actionRequired: true,
        protocol: 'request-response',
        expectsResponse: true,
        responseTemplate: path.join(this.protocolDir, 'response.md'),
      };

      await this.deliverMessage(message);
      await this.recordMessage(message, {
        sourceFile: requestPath,
        compatibilityPath: responsePath,
      });

      return {
        success: true,
        messageId: message.id,
        recipient: recipientAgent,
        canonicalRequestFile: toPosixRelative(this.projectRoot, requestPath),
        responseFile: toPosixRelative(this.projectRoot, responsePath),
        compatibilityExportRequired: true,
        status: 'pending_response',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code || null,
        status: 'failed',
        missing_fields: error.missing_fields || [],
      };
    }
  }

  async broadcastDomainChange(change, affectedDomains) {
    const results = [];

    for (const domain of affectedDomains) {
      const recipients = this.getDomainAgents(domain);
      for (const recipient of recipients) {
        const actionable = change && change.actionable
          ? this.ensureActionablePayload({
            ...change.actionable,
            recipient,
          }, 'broadcast message payload')
          : null;
        const message = {
          type: 'broadcast',
          id: this.generateMessageId(),
          timestamp: new Date().toISOString(),
          from: change.initiator || 'system',
          to: recipient,
          subject: `Domain Change: ${change.domain}`,
          content: {
            domain: change.domain,
            changeType: change.type,
            description: change.description,
            breakingChanges: change.breakingChanges || [],
            affectedApis: change.affectedApis || [],
            migrationRequired: change.migrationRequired || false,
          },
          actionable,
          actionRequired: change.actionRequired || false,
          protocol: 'broadcast',
          priority: change.severity || 'medium',
        };

        try {
          await this.deliverMessage(message);
          await this.recordMessage(message);
          results.push({ recipient, status: 'delivered', messageId: message.id });
        } catch (error) {
          results.push({ recipient, status: 'failed', error: error.message });
        }
      }
    }

    return {
      success: true,
      totalRecipients: results.length,
      delivered: results.filter((entry) => entry.status === 'delivered').length,
      failed: results.filter((entry) => entry.status === 'failed').length,
      results,
    };
  }

  async notifyAgent(agentId, messageData) {
    const actionable = messageData && messageData.actionable
      ? this.ensureActionablePayload(messageData.actionable, 'direct message payload')
      : null;
    const message = {
      type: 'direct',
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      from: messageData.from || 'system',
      to: agentId,
      subject: messageData.subject || '',
      content: messageData.content || messageData,
      actionable,
      actionRequired: messageData.actionRequired || false,
      protocol: 'direct',
      priority: messageData.priority || 'normal',
    };

    try {
      await this.deliverMessage(message);
      await this.recordMessage(message);
      return {
        success: true,
        messageId: message.id,
        recipient: agentId,
        status: 'delivered',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 'failed',
      };
    }
  }

  async deliverMessage(message) {
    const inboxDir = path.join(this.managementDir, 'inbox', message.to);
    await fsp.mkdir(inboxDir, { recursive: true });
    const messageFile = path.join(inboxDir, `${message.id}.json`);
    await fsp.writeFile(messageFile, JSON.stringify(message, null, 2), 'utf-8');
  }

  async recordMessage(message, metadata = {}) {
    return this.recordCanonicalMessageEvent(message, metadata);
  }

  getDomainAgents(domain) {
    const domainAgentMap = {
      backend: ['backend-specialist', 'dba'],
      frontend: ['frontend-specialist', 'chief-designer'],
      security: ['security-specialist'],
      quality: ['qa-manager'],
      architecture: ['chief-architect'],
      project: ['project-manager'],
      all: ['project-manager', 'chief-architect', 'chief-designer', 'qa-manager', 'security-specialist', 'backend-specialist', 'frontend-specialist', 'dba'],
    };
    return domainAgentMap[domain] || [`${domain}-part-leader`];
  }

  extractAgentFromHandoff(content) {
    const match = content.match(/\*\*인계자\*\*:\s*(.+)/);
    return match ? match[1].trim() : 'unknown';
  }

  extractHandoffSubject(content) {
    const match = content.match(/# Handoff:\s*(.+)/);
    return match ? match[1].trim() : 'Unknown Handoff';
  }

  extractRequestFrom(content) {
    const match = content.match(/^from:\s*(.+)$/mi) || content.match(/\*\*From\*\*:\s*(.+)/);
    return match ? match[1].trim() : 'unknown';
  }

  extractRequestSubject(content) {
    const match = content.match(/^id:\s*(.+)$/mi)
      || content.match(/##\s+Change Summary\s*\n([^\n]+)/i)
      || content.match(/## Request:\s*(.+)/);
    return match ? match[1].trim() : 'Unknown Request';
  }

  generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  async getMessageHistory(filters = {}) {
    let messages = this.messageHistory;
    if (filters.type) messages = messages.filter((message) => message.type === filters.type);
    if (filters.from) messages = messages.filter((message) => message.from === filters.from);
    if (filters.to) messages = messages.filter((message) => message.to === filters.to);
    if (filters.startDate) messages = messages.filter((message) => new Date(message.timestamp) >= new Date(filters.startDate));
    return messages;
  }

  async getAgentInbox(agentId) {
    const inboxDir = path.join(this.managementDir, 'inbox', agentId);
    try {
      const files = await fsp.readdir(inboxDir);
      const messages = [];
      for (const file of files) {
        const filePath = path.join(inboxDir, file);
        const content = await fsp.readFile(filePath, 'utf-8');
        messages.push(JSON.parse(content));
      }
      return messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch {
      return [];
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const projectDirArg = args.find((arg) => arg.startsWith('--project-dir='));
  const projectRoot = projectDirArg
    ? path.resolve(projectDirArg.slice('--project-dir='.length))
    : process.cwd();
  const positional = args.filter((arg) => !arg.startsWith('--project-dir='));
  const messaging = new AgentMessagingService({ projectRoot });

  switch (command) {
    case 'export-compat':
      messaging.exportCompatibilityViews()
        .then((result) => console.log(JSON.stringify(result, null, 2)))
        .catch((err) => {
          console.error('Error:', err.message);
          process.exitCode = 1;
        });
      break;
    case 'notify-handoff':
      messaging.notifyHandoff(positional[1], positional[2])
        .then((result) => console.log(JSON.stringify(result, null, 2)))
        .catch((err) => console.error('Error:', err.message));
      break;
    case 'notify-handoff-payload': {
      const payloadFile = positional[1];
      if (!payloadFile) {
        console.error('Error: notify-handoff-payload requires <payloadJsonFile>');
        process.exitCode = 1;
        break;
      }
      fsp.readFile(path.resolve(projectRoot, payloadFile), 'utf-8')
        .then((raw) => JSON.parse(raw))
        .then((payload) => messaging.notifyHandoffPayload(payload))
        .then((result) => console.log(JSON.stringify(result, null, 2)))
        .catch((err) => {
          console.error('Error:', err.message);
          process.exitCode = 1;
        });
      break;
    }
    case 'request-response':
      messaging.requestResponse(positional[1], positional[2])
        .then((result) => console.log(JSON.stringify(result, null, 2)))
        .catch((err) => console.error('Error:', err.message));
      break;
    case 'broadcast': {
      const change = JSON.parse(positional[1]);
      const domains = positional.slice(2);
      messaging.broadcastDomainChange(change, domains)
        .then((result) => console.log(JSON.stringify(result, null, 2)))
        .catch((err) => console.error('Error:', err.message));
      break;
    }
    case 'inbox':
      messaging.getAgentInbox(positional[1])
        .then((messages) => console.log(JSON.stringify(messages, null, 2)))
        .catch((err) => console.error('Error:', err.message));
      break;
    default:
      console.log(`
Agent Messaging Service

Usage:
  node messaging.js export-compat [--project-dir=/path]
  node messaging.js notify-handoff <handoffFile> <recipientAgent> [--project-dir=/path]
  node messaging.js notify-handoff-payload <payloadJsonFile> [--project-dir=/path]
  node messaging.js request-response <requestFile> <recipientAgent> [--project-dir=/path]
  node messaging.js broadcast <changeJson> <affectedDomains...> [--project-dir=/path]
  node messaging.js inbox <agentId> [--project-dir=/path]

Examples:
  node messaging.js export-compat
  node messaging.js notify-handoff docs/handoff.md frontend-part-leader
  node messaging.js notify-handoff-payload .claude/collab/handoffs/handoff-payload.json
  node messaging.js request-response .claude/collab/requests/REQ-20260311-001.md backend-specialist
  node messaging.js broadcast '{"type":"breaking","domain":"api"}' backend frontend
  node messaging.js inbox qa-manager
      `);
  }
}

module.exports = AgentMessagingService;
module.exports.AgentMessagingService = AgentMessagingService;
module.exports.COMPATIBILITY_HANDOFFS_DIR = COMPATIBILITY_HANDOFFS_DIR;
module.exports.COMPATIBILITY_REQUESTS_DIR = COMPATIBILITY_REQUESTS_DIR;
module.exports.COMPATIBILITY_RESPONSES_DIR = COMPATIBILITY_RESPONSES_DIR;
module.exports.REQUIRED_ACTIONABLE_FIELDS = REQUIRED_ACTIONABLE_FIELDS;
