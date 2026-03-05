#!/usr/bin/env node
/**
 * PreToolUse[Edit|Write] Hook: Domain Boundary Enforcer
 *
 * Blocks agents from writing/editing files outside their assigned domain.
 * Supports the hierarchical agent collaboration architecture where each
 * Domain Worker has a clearly defined set of allowed paths.
 *
 * Claude Code Hook Protocol (PreToolUse):
 *   - stdin: JSON { hook_event_name, tool_name, tool_input: { file_path, content } }
 *   - stdout: JSON { decision: 'allow'|'block', reason?, suggestion? }
 *
 * Agent role detection: process.env.CLAUDE_AGENT_ROLE
 * Cross-domain changes: create REQ file in .claude/collab/requests/
 */

const path = require('path');

// ---------------------------------------------------------------------------
// Domain Map: which paths each agent role is allowed to write
// ---------------------------------------------------------------------------

const DOMAIN_MAP = {
  'backend-specialist': {
    allowed: [
      'src/domains/',
      'src/api/',
      'src/services/',
      'src/repositories/',
    ],
  },
  'frontend-specialist': {
    allowed: [
      'src/components/',
      'src/pages/',
      'src/hooks/',
      'src/styles/',
    ],
  },
  'db-specialist': {
    allowed: [
      'src/db/',
      'migrations/',
      'prisma/',
      'database/',
    ],
  },
  'qa-specialist': {
    allowed: [
      'tests/',
      'qa/',
    ],
    allowedPatterns: [
      /\.test\.[jt]sx?$/,
      /\.spec\.[jt]sx?$/,
    ],
  },
  // ChiefArchitect: contracts + collab infra only
  'chief-architect': {
    allowed: [
      'contracts/',
      '.claude/collab/contracts/',
      '.claude/collab/decisions/',
      'project-team/references/',
    ],
  },
};

// Roles with no domain restriction (allow all)
const UNRESTRICTED_ROLES = new Set([
  'project-manager',
  'chief-designer',
  'maintenance-analyst',
  'security-specialist',
]);

// Paths any agent can write (cross-agent collaboration paths)
const ALWAYS_ALLOWED_WRITE = [
  '.claude/collab/requests/',
  '.claude/collab/locks/',
];

// Paths any agent can write (test patterns apply to qa-specialist separately)
const CONTRACTS_READ_ONLY_PREFIXES = [
  'contracts/',
  '.claude/collab/contracts/',
];

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function toRelativePath(filePath) {
  if (!filePath) return '';
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  // path.resolve normalizes traversal sequences (e.g. src/domains/../../contracts)
  const absPath = path.resolve(projectDir, filePath);
  // Normalize to forward slashes for cross-platform prefix matching
  return path.relative(projectDir, absPath).replace(/\\/g, '/');
}

function normalizeRole(raw) {
  if (!raw) return '';
  return raw.toLowerCase().trim().replace(/\s+/g, '-');
}

function matchesPrefix(rel, prefixes) {
  for (const prefix of prefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}

function matchesPatterns(rel, patterns) {
  if (!patterns) return false;
  for (const pat of patterns) {
    if (pat.test(rel)) return true;
  }
  return false;
}

function isAllowed(role, rel) {
  // Unrestricted roles can write anywhere
  if (UNRESTRICTED_ROLES.has(role)) return { allowed: true };

  // Any agent can write to requests/ and locks/
  if (matchesPrefix(rel, ALWAYS_ALLOWED_WRITE)) return { allowed: true };

  // contracts/ is read-only for non-ChiefArchitect
  if (matchesPrefix(rel, CONTRACTS_READ_ONLY_PREFIXES) && role !== 'chief-architect') {
    return {
      allowed: false,
      reason: `"${rel}" is a contracts/ file. Only chief-architect can write here.`,
      suggestion: 'If you need a contract change, create a REQ file in .claude/collab/requests/ to request ChiefArchitect review.',
    };
  }

  const domain = DOMAIN_MAP[role];
  if (!domain) {
    // Unknown role — allow (fallback safety)
    return { allowed: true };
  }

  // Check allowed path prefixes
  if (matchesPrefix(rel, domain.allowed)) return { allowed: true };

  // Check allowed patterns (e.g. *.test.ts for qa-specialist)
  if (matchesPatterns(rel, domain.allowedPatterns)) return { allowed: true };

  return {
    allowed: false,
    reason: `Role "${role}" is not allowed to write to "${rel}" (outside domain boundary).`,
    suggestion: `Create a REQ file in .claude/collab/requests/ to request this cross-domain change. The receiving agent will review and respond.`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    process.stdin.on('error', () => resolve({}));
  });
}

async function main() {
  const input = await readStdin();
  const hookEvent = input.hook_event_name || '';
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};

  // Only intercept PreToolUse for Edit/Write
  if (!hookEvent.startsWith('PreToolUse')) return;
  if (!['Edit', 'Write'].includes(toolName)) return;

  const filePath = toolInput.file_path || toolInput.path || '';
  if (!filePath) return;

  const rel = toRelativePath(filePath);
  // Skip files outside project (relative paths starting with ..)
  if (rel.startsWith('..')) return;

  const rawRole = process.env.CLAUDE_AGENT_ROLE || '';
  const role = normalizeRole(rawRole);

  // No role set = allow (non-agent context)
  if (!role) return;

  const result = isAllowed(role, rel);

  if (!result.allowed) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: result.reason,
      suggestion: result.suggestion,
    }));
  }
  // Allowed: no output needed (implicit allow)
}

main().catch(() => {});

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DOMAIN_MAP,
    UNRESTRICTED_ROLES,
    ALWAYS_ALLOWED_WRITE,
    isAllowed,
    normalizeRole,
    toRelativePath,
  };
}
