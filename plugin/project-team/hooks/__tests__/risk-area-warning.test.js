/**
 * @TASK P3-T2 - Risk Area Warning Hook Tests
 * @TEST hooks/risk-area-warning.js
 *
 * Tests cover:
 *   1. Glob pattern matching (globToRegex, matchGlob, matchesAnyPattern)
 *   2. Risk level classification
 *   3. Risk area registry (default + custom configs)
 *   4. YAML config parsing
 *   5. Confirmation checklist generation
 *   6. Warning report formatting
 *   7. Pattern matching details (findMatchedPatterns)
 *   8. Risk analysis integration (analyzeRisk)
 *   9. Relative path resolution
 *  10. Edge cases and error handling
 *  11. Hook protocol compliance
 *  12. Priority resolution (CRITICAL > HIGH > MEDIUM > LOW)
 *  13. Reviewer assignment
 *  14. Custom risk area configurations
 *  15. Complex real-world file paths
 *
 * Total: 70+ test cases
 */

const {
  RISK_LEVELS,
  RISK_LABELS,
  DEFAULT_RISK_AREAS,
  globToRegex,
  matchGlob,
  matchesAnyPattern,
  loadRiskAreas,
  parseRiskAreasYaml,
  classifyRiskLevel,
  getRiskLevel,
  generateChecklist,
  formatWarningReport,
  findMatchedPatterns,
  analyzeRisk,
  toRelativePath
} = require('../risk-area-warning');

// ===========================================================================
// 1. Glob Pattern Matching - globToRegex
// ===========================================================================

describe('globToRegex', () => {
  test('converts simple ** pattern to match any path depth', () => {
    const regex = globToRegex('**/payment/**');
    expect(regex.test('src/domains/payment/service.py')).toBe(true);
    expect(regex.test('payment/index.js')).toBe(true);
  });

  test('converts single * to match within one path segment', () => {
    const regex = globToRegex('src/*.py');
    expect(regex.test('src/main.py')).toBe(true);
    expect(regex.test('src/deep/main.py')).toBe(false);
  });

  test('converts ? to match exactly one character', () => {
    const regex = globToRegex('src/?.py');
    expect(regex.test('src/a.py')).toBe(true);
    expect(regex.test('src/ab.py')).toBe(false);
  });

  test('handles empty pattern', () => {
    const regex = globToRegex('');
    expect(regex.test('')).toBe(true);
    expect(regex.test('anything')).toBe(false);
  });

  test('escapes regex metacharacters (dots, etc.)', () => {
    const regex = globToRegex('src/file.py');
    expect(regex.test('src/file.py')).toBe(true);
    expect(regex.test('src/fileXpy')).toBe(false);
  });

  test('handles leading ** without trailing slash', () => {
    const regex = globToRegex('**/*.py');
    expect(regex.test('src/main.py')).toBe(true);
    expect(regex.test('main.py')).toBe(true);
    expect(regex.test('deep/nested/file.py')).toBe(true);
  });

  test('handles trailing ** after slash', () => {
    const regex = globToRegex('src/**');
    expect(regex.test('src/file.py')).toBe(true);
    expect(regex.test('src/deep/nested/file.py')).toBe(true);
  });

  test('handles ** in the middle of a pattern', () => {
    const regex = globToRegex('src/**/test.py');
    expect(regex.test('src/test.py')).toBe(true);
    expect(regex.test('src/deep/test.py')).toBe(true);
    expect(regex.test('src/deep/nested/test.py')).toBe(true);
  });

  test('handles multiple ** segments', () => {
    const regex = globToRegex('**/services/**');
    expect(regex.test('src/services/user.py')).toBe(true);
    expect(regex.test('services/user.py')).toBe(true);
    expect(regex.test('app/services/sub/file.py')).toBe(true);
  });

  test('handles specific file extension patterns', () => {
    const regex = globToRegex('**/services/*_service.py');
    expect(regex.test('src/services/user_service.py')).toBe(true);
    expect(regex.test('services/auth_service.py')).toBe(true);
    expect(regex.test('src/services/user_service.js')).toBe(false);
  });
});

// ===========================================================================
// 2. Glob Pattern Matching - matchGlob
// ===========================================================================

describe('matchGlob', () => {
  test('matches payment directory patterns', () => {
    expect(matchGlob('src/payment/processor.py', '**/payment/**')).toBe(true);
    expect(matchGlob('app/domains/payment/models/invoice.py', '**/payment/**')).toBe(true);
  });

  test('matches billing directory patterns', () => {
    expect(matchGlob('src/billing/calculator.py', '**/billing/**')).toBe(true);
    expect(matchGlob('services/billing/stripe.js', '**/billing/**')).toBe(true);
  });

  test('matches auth directory patterns', () => {
    expect(matchGlob('src/auth/login.py', '**/auth/**')).toBe(true);
    expect(matchGlob('app/auth/middleware.js', '**/auth/**')).toBe(true);
  });

  test('matches service file patterns', () => {
    expect(matchGlob('src/services/user_service.py', '**/services/*_service.py')).toBe(true);
    expect(matchGlob('app/services/order_service.py', '**/services/*_service.py')).toBe(true);
  });

  test('matches core directory patterns', () => {
    expect(matchGlob('src/core/config.py', '**/core/**')).toBe(true);
    expect(matchGlob('app/core/database.py', '**/core/**')).toBe(true);
  });

  test('matches api directory patterns', () => {
    expect(matchGlob('src/api/routes.py', '**/api/**')).toBe(true);
    expect(matchGlob('app/api/v2/endpoints.py', '**/api/**')).toBe(true);
  });

  test('matches models directory patterns', () => {
    expect(matchGlob('src/models/user.py', '**/models/**')).toBe(true);
    expect(matchGlob('app/domain/models/order.py', '**/models/**')).toBe(true);
  });

  test('matches tests directory patterns', () => {
    expect(matchGlob('tests/unit/test_user.py', '**/tests/**')).toBe(true);
    expect(matchGlob('src/tests/integration/test_api.py', '**/tests/**')).toBe(true);
  });

  test('matches utils directory patterns', () => {
    expect(matchGlob('src/utils/helpers.py', '**/utils/**')).toBe(true);
    expect(matchGlob('app/utils/formatters.js', '**/utils/**')).toBe(true);
  });

  test('returns false for non-matching paths', () => {
    expect(matchGlob('README.md', '**/payment/**')).toBe(false);
    expect(matchGlob('docs/guide.md', '**/auth/**')).toBe(false);
  });

  test('returns false for null/empty inputs', () => {
    expect(matchGlob(null, '**/payment/**')).toBe(false);
    expect(matchGlob('src/file.py', null)).toBe(false);
    expect(matchGlob('', '**/payment/**')).toBe(false);
    expect(matchGlob('src/file.py', '')).toBe(false);
  });
});

// ===========================================================================
// 3. Glob Pattern Matching - matchesAnyPattern
// ===========================================================================

describe('matchesAnyPattern', () => {
  test('returns true when any pattern matches', () => {
    expect(matchesAnyPattern('src/payment/pay.py', [
      '**/billing/**',
      '**/payment/**',
      '**/auth/**'
    ])).toBe(true);
  });

  test('returns false when no pattern matches', () => {
    expect(matchesAnyPattern('src/utils/helpers.py', [
      '**/payment/**',
      '**/billing/**',
      '**/auth/**'
    ])).toBe(false);
  });

  test('returns false for empty patterns array', () => {
    expect(matchesAnyPattern('src/file.py', [])).toBe(false);
  });

  test('returns false for null inputs', () => {
    expect(matchesAnyPattern(null, ['**/payment/**'])).toBe(false);
    expect(matchesAnyPattern('src/file.py', null)).toBe(false);
  });
});

// ===========================================================================
// 4. Risk Level Constants
// ===========================================================================

describe('RISK_LEVELS', () => {
  test('defines all four risk levels', () => {
    expect(RISK_LEVELS).toHaveProperty('CRITICAL');
    expect(RISK_LEVELS).toHaveProperty('HIGH');
    expect(RISK_LEVELS).toHaveProperty('MEDIUM');
    expect(RISK_LEVELS).toHaveProperty('LOW');
  });

  test('CRITICAL has highest priority (lowest numeric value)', () => {
    expect(RISK_LEVELS.CRITICAL).toBeLessThan(RISK_LEVELS.HIGH);
    expect(RISK_LEVELS.HIGH).toBeLessThan(RISK_LEVELS.MEDIUM);
    expect(RISK_LEVELS.MEDIUM).toBeLessThan(RISK_LEVELS.LOW);
  });
});

describe('RISK_LABELS', () => {
  test('defines labels for all risk levels', () => {
    expect(RISK_LABELS.CRITICAL).toContain('CRITICAL');
    expect(RISK_LABELS.HIGH).toContain('HIGH');
    expect(RISK_LABELS.MEDIUM).toContain('MEDIUM');
    expect(RISK_LABELS.LOW).toContain('LOW');
  });
});

// ===========================================================================
// 5. Default Risk Areas Configuration
// ===========================================================================

describe('DEFAULT_RISK_AREAS', () => {
  test('has entries for all four risk levels', () => {
    const levels = DEFAULT_RISK_AREAS.map(a => a.level);
    expect(levels).toContain('CRITICAL');
    expect(levels).toContain('HIGH');
    expect(levels).toContain('MEDIUM');
    expect(levels).toContain('LOW');
  });

  test('CRITICAL areas have required reviewers', () => {
    const critical = DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL');
    expect(critical.reviewers).toContain('qa-manager');
    expect(critical.reviewers).toContain('chief-architect');
  });

  test('HIGH areas have required reviewers', () => {
    const high = DEFAULT_RISK_AREAS.find(a => a.level === 'HIGH');
    expect(high.reviewers).toContain('part-leader');
  });

  test('CRITICAL areas include payment, billing, auth patterns', () => {
    const critical = DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL');
    expect(critical.patterns).toContain('**/payment/**');
    expect(critical.patterns).toContain('**/billing/**');
    expect(critical.patterns).toContain('**/auth/**');
  });

  test('all areas have a non-empty reason', () => {
    for (const area of DEFAULT_RISK_AREAS) {
      expect(area.reason).toBeTruthy();
      expect(typeof area.reason).toBe('string');
    }
  });

  test('all areas have patterns array', () => {
    for (const area of DEFAULT_RISK_AREAS) {
      expect(Array.isArray(area.patterns)).toBe(true);
      expect(area.patterns.length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// 6. Risk Level Classification
// ===========================================================================

describe('classifyRiskLevel', () => {
  // --- CRITICAL ---
  test('classifies payment files as CRITICAL', () => {
    const result = classifyRiskLevel('src/domains/payment/services/processor.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('classifies billing files as CRITICAL', () => {
    const result = classifyRiskLevel('src/billing/invoice.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('classifies auth files as CRITICAL', () => {
    const result = classifyRiskLevel('src/auth/login.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('classifies deeply nested payment file as CRITICAL', () => {
    const result = classifyRiskLevel('app/domains/payment/gateways/stripe/webhook.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  // --- HIGH ---
  test('classifies service files as HIGH', () => {
    const result = classifyRiskLevel('src/services/user_service.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('HIGH');
  });

  test('classifies core files as HIGH', () => {
    const result = classifyRiskLevel('src/core/config.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('HIGH');
  });

  test('classifies JS service files as HIGH', () => {
    const result = classifyRiskLevel('src/services/email_service.js');
    expect(result).not.toBeNull();
    expect(result.level).toBe('HIGH');
  });

  test('classifies TS service files as HIGH', () => {
    const result = classifyRiskLevel('src/services/notification_service.ts');
    expect(result).not.toBeNull();
    expect(result.level).toBe('HIGH');
  });

  // --- MEDIUM ---
  test('classifies api files as MEDIUM', () => {
    const result = classifyRiskLevel('src/api/routes/users.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('MEDIUM');
  });

  test('classifies model files as MEDIUM', () => {
    const result = classifyRiskLevel('src/models/user.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('MEDIUM');
  });

  // --- LOW ---
  test('classifies test files as LOW', () => {
    const result = classifyRiskLevel('tests/unit/test_user.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('LOW');
  });

  test('classifies utility files as LOW', () => {
    const result = classifyRiskLevel('src/utils/helpers.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('LOW');
  });

  // --- Unclassified ---
  test('returns null for unclassified files', () => {
    expect(classifyRiskLevel('README.md')).toBeNull();
    expect(classifyRiskLevel('setup.py')).toBeNull();
    expect(classifyRiskLevel('docs/guide.md')).toBeNull();
  });

  // --- Priority resolution ---
  test('CRITICAL overrides HIGH when path matches both', () => {
    // auth/core -> matches both CRITICAL (auth) and HIGH (core)
    const result = classifyRiskLevel('src/auth/core/token_manager.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('CRITICAL overrides MEDIUM when path matches both', () => {
    // payment/api -> matches both CRITICAL (payment) and MEDIUM (api)
    const result = classifyRiskLevel('src/payment/api/checkout.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('CRITICAL overrides LOW when path matches both', () => {
    // auth/tests -> matches both CRITICAL (auth) and LOW (tests)
    const result = classifyRiskLevel('src/auth/tests/test_login.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('HIGH overrides MEDIUM when path matches both', () => {
    // core/api -> matches both HIGH (core) and MEDIUM (api)
    const result = classifyRiskLevel('src/core/api/internal.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('HIGH');
  });

  test('HIGH overrides LOW when path matches both', () => {
    // core/utils -> matches both HIGH (core) and LOW (utils)
    const result = classifyRiskLevel('src/core/utils/helpers.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('HIGH');
  });

  // --- Null/empty handling ---
  test('returns null for empty string', () => {
    expect(classifyRiskLevel('')).toBeNull();
  });

  test('returns null for null', () => {
    expect(classifyRiskLevel(null)).toBeNull();
  });

  test('returns null for undefined', () => {
    expect(classifyRiskLevel(undefined)).toBeNull();
  });
});

// ===========================================================================
// 7. getRiskLevel helper
// ===========================================================================

describe('getRiskLevel', () => {
  test('returns CRITICAL for payment paths', () => {
    expect(getRiskLevel('src/payment/pay.py')).toBe('CRITICAL');
  });

  test('returns HIGH for core paths', () => {
    expect(getRiskLevel('src/core/config.py')).toBe('HIGH');
  });

  test('returns MEDIUM for api paths', () => {
    expect(getRiskLevel('src/api/routes.py')).toBe('MEDIUM');
  });

  test('returns LOW for test paths', () => {
    expect(getRiskLevel('tests/test_main.py')).toBe('LOW');
  });

  test('returns NONE for unclassified paths', () => {
    expect(getRiskLevel('README.md')).toBe('NONE');
  });
});

// ===========================================================================
// 8. YAML Configuration Parsing
// ===========================================================================

describe('parseRiskAreasYaml', () => {
  test('parses valid YAML-like risk areas config', () => {
    const yaml = `
- level: CRITICAL
  patterns:
    - "**/secure/**"
  reviewers:
    - security-team
  reason: "Security-sensitive code"

- level: HIGH
  patterns:
    - "**/engine/**"
  reviewers:
    - tech-lead
  reason: "Core engine code"
`;
    const result = parseRiskAreasYaml(yaml);
    expect(result).toHaveLength(2);
    expect(result[0].level).toBe('CRITICAL');
    expect(result[0].patterns).toContain('**/secure/**');
    expect(result[0].reviewers).toContain('security-team');
    expect(result[0].reason).toBe('Security-sensitive code');
    expect(result[1].level).toBe('HIGH');
  });

  test('returns defaults for empty content', () => {
    const result = parseRiskAreasYaml('');
    expect(result).toBe(DEFAULT_RISK_AREAS);
  });

  test('returns defaults for null content', () => {
    const result = parseRiskAreasYaml(null);
    expect(result).toBe(DEFAULT_RISK_AREAS);
  });

  test('skips comment lines', () => {
    const yaml = `
# This is a comment
- level: CRITICAL
  patterns:
    # Another comment
    - "**/secret/**"
  reviewers:
    - admin
  reason: "Secret area"
`;
    const result = parseRiskAreasYaml(yaml);
    expect(result).toHaveLength(1);
    expect(result[0].patterns).toContain('**/secret/**');
  });

  test('handles patterns with quotes', () => {
    const yaml = `
- level: HIGH
  patterns:
    - "**/core/**"
  reviewers:
    - "lead-dev"
  reason: "Core logic"
`;
    const result = parseRiskAreasYaml(yaml);
    expect(result[0].patterns).toContain('**/core/**');
    expect(result[0].reviewers).toContain('lead-dev');
  });

  test('handles level in lowercase', () => {
    const yaml = `
- level: critical
  patterns:
    - "**/vault/**"
  reviewers:
    - admin
  reason: "Vault access"
`;
    const result = parseRiskAreasYaml(yaml);
    expect(result[0].level).toBe('CRITICAL');
  });
});

// ===========================================================================
// 9. loadRiskAreas
// ===========================================================================

describe('loadRiskAreas', () => {
  test('returns defaults when no config path provided', () => {
    const result = loadRiskAreas(null);
    expect(result).toBe(DEFAULT_RISK_AREAS);
  });

  test('returns defaults when config path does not exist', () => {
    const result = loadRiskAreas('/nonexistent/path/risk-areas.yaml');
    expect(result).toBe(DEFAULT_RISK_AREAS);
  });
});

// ===========================================================================
// 10. Confirmation Checklist Generation
// ===========================================================================

describe('generateChecklist', () => {
  test('generates CRITICAL checklist items', () => {
    const area = DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL');
    const checklist = generateChecklist('CRITICAL', area);
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist.some(item => item.includes('financial') || item.includes('monetary'))).toBe(true);
    expect(checklist.some(item => item.includes('security'))).toBe(true);
    expect(checklist.some(item => item.includes('test coverage'))).toBe(true);
  });

  test('generates HIGH checklist items', () => {
    const area = DEFAULT_RISK_AREAS.find(a => a.level === 'HIGH');
    const checklist = generateChecklist('HIGH', area);
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist.some(item => item.includes('backward compatibility') || item.includes('cascading'))).toBe(true);
  });

  test('CRITICAL checklist includes reviewer approval item', () => {
    const area = { reviewers: ['qa-manager', 'chief-architect'] };
    const checklist = generateChecklist('CRITICAL', area);
    expect(checklist.some(item => item.includes('qa-manager'))).toBe(true);
    expect(checklist.some(item => item.includes('chief-architect'))).toBe(true);
  });

  test('HIGH checklist includes reviewer approval item', () => {
    const area = { reviewers: ['part-leader'] };
    const checklist = generateChecklist('HIGH', area);
    expect(checklist.some(item => item.includes('part-leader'))).toBe(true);
  });

  test('returns empty checklist for MEDIUM level', () => {
    const checklist = generateChecklist('MEDIUM', { reviewers: [] });
    expect(checklist).toEqual([]);
  });

  test('returns empty checklist for LOW level', () => {
    const checklist = generateChecklist('LOW', { reviewers: [] });
    expect(checklist).toEqual([]);
  });

  test('handles null area gracefully', () => {
    const checklist = generateChecklist('CRITICAL', null);
    expect(checklist.length).toBeGreaterThan(0);
    // Should not include reviewer item when area is null
    expect(checklist.every(item => !item.includes('reviewers'))).toBe(true);
  });
});

// ===========================================================================
// 11. Warning Report Formatting
// ===========================================================================

describe('formatWarningReport', () => {
  test('includes risk level label in report', () => {
    const report = formatWarningReport({
      filePath: 'src/payment/processor.py',
      level: 'CRITICAL',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL'),
      matchedPatterns: ['**/payment/**']
    });
    expect(report).toContain('[CRITICAL]');
  });

  test('includes file path in report', () => {
    const report = formatWarningReport({
      filePath: 'src/payment/processor.py',
      level: 'CRITICAL',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL'),
      matchedPatterns: ['**/payment/**']
    });
    expect(report).toContain('src/payment/processor.py');
  });

  test('includes reason for CRITICAL risk', () => {
    const area = DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL');
    const report = formatWarningReport({
      filePath: 'src/auth/login.py',
      level: 'CRITICAL',
      area,
      matchedPatterns: ['**/auth/**']
    });
    expect(report).toContain(area.reason);
  });

  test('includes matched patterns in report', () => {
    const report = formatWarningReport({
      filePath: 'src/billing/invoice.py',
      level: 'CRITICAL',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL'),
      matchedPatterns: ['**/billing/**']
    });
    expect(report).toContain('**/billing/**');
  });

  test('includes required reviewers for CRITICAL', () => {
    const report = formatWarningReport({
      filePath: 'src/payment/pay.py',
      level: 'CRITICAL',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL'),
      matchedPatterns: ['**/payment/**']
    });
    expect(report).toContain('qa-manager');
    expect(report).toContain('chief-architect');
  });

  test('includes required reviewers for HIGH', () => {
    const report = formatWarningReport({
      filePath: 'src/core/engine.py',
      level: 'HIGH',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'HIGH'),
      matchedPatterns: ['**/core/**']
    });
    expect(report).toContain('part-leader');
  });

  test('includes confirmation checklist for CRITICAL', () => {
    const report = formatWarningReport({
      filePath: 'src/auth/session.py',
      level: 'CRITICAL',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL'),
      matchedPatterns: ['**/auth/**']
    });
    expect(report).toContain('Confirmation Checklist');
    expect(report).toContain('[ ]');
  });

  test('includes confirmation checklist for HIGH', () => {
    const report = formatWarningReport({
      filePath: 'src/core/config.py',
      level: 'HIGH',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'HIGH'),
      matchedPatterns: ['**/core/**']
    });
    expect(report).toContain('Confirmation Checklist');
  });

  test('does NOT include checklist for MEDIUM', () => {
    const report = formatWarningReport({
      filePath: 'src/api/routes.py',
      level: 'MEDIUM',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'MEDIUM'),
      matchedPatterns: ['**/api/**']
    });
    expect(report).not.toContain('Confirmation Checklist');
  });

  test('includes WARNING message for CRITICAL', () => {
    const report = formatWarningReport({
      filePath: 'src/payment/pay.py',
      level: 'CRITICAL',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL'),
      matchedPatterns: ['**/payment/**']
    });
    expect(report).toContain('[WARNING]');
    expect(report).toContain('CRITICAL risk area');
  });

  test('includes CAUTION message for HIGH', () => {
    const report = formatWarningReport({
      filePath: 'src/core/db.py',
      level: 'HIGH',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'HIGH'),
      matchedPatterns: ['**/core/**']
    });
    expect(report).toContain('[CAUTION]');
    expect(report).toContain('HIGH risk area');
  });

  test('includes NOTE message for MEDIUM', () => {
    const report = formatWarningReport({
      filePath: 'src/models/user.py',
      level: 'MEDIUM',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'MEDIUM'),
      matchedPatterns: ['**/models/**']
    });
    expect(report).toContain('[NOTE]');
    expect(report).toContain('MEDIUM risk area');
  });

  test('handles missing matchedPatterns gracefully', () => {
    const report = formatWarningReport({
      filePath: 'src/payment/pay.py',
      level: 'CRITICAL',
      area: DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL'),
      matchedPatterns: null
    });
    expect(report).not.toContain('Matched Patterns');
  });

  test('handles null area gracefully', () => {
    const report = formatWarningReport({
      filePath: 'src/something.py',
      level: 'MEDIUM',
      area: null,
      matchedPatterns: []
    });
    expect(report).toContain('[MEDIUM]');
    expect(report).toContain('src/something.py');
  });
});

// ===========================================================================
// 12. findMatchedPatterns
// ===========================================================================

describe('findMatchedPatterns', () => {
  test('finds matching patterns from CRITICAL area', () => {
    const area = DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL');
    const matched = findMatchedPatterns('src/payment/processor.py', area);
    expect(matched).toContain('**/payment/**');
  });

  test('finds multiple matching patterns', () => {
    // auth + billing -> in a theoretical area with both patterns
    const customArea = {
      level: 'CRITICAL',
      patterns: ['**/payment/**', '**/billing/**', '**/auth/**']
    };
    const matched = findMatchedPatterns('src/auth/login.py', customArea);
    expect(matched).toContain('**/auth/**');
    expect(matched).not.toContain('**/payment/**');
  });

  test('returns empty array when no patterns match', () => {
    const area = DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL');
    const matched = findMatchedPatterns('src/utils/helpers.py', area);
    expect(matched).toEqual([]);
  });

  test('returns empty for null filePath', () => {
    const area = DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL');
    expect(findMatchedPatterns(null, area)).toEqual([]);
  });

  test('returns empty for null area', () => {
    expect(findMatchedPatterns('src/payment/pay.py', null)).toEqual([]);
  });

  test('returns empty for area without patterns', () => {
    expect(findMatchedPatterns('src/file.py', { level: 'HIGH' })).toEqual([]);
  });
});

// ===========================================================================
// 13. Risk Analysis Integration (analyzeRisk)
// ===========================================================================

describe('analyzeRisk', () => {
  test('returns full analysis for CRITICAL file', () => {
    const result = analyzeRisk('src/payment/processor.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
    expect(result.filePath).toBe('src/payment/processor.py');
    expect(result.matchedPatterns).toContain('**/payment/**');
    expect(result.reviewers).toContain('qa-manager');
    expect(result.reviewers).toContain('chief-architect');
    expect(result.reason).toBeTruthy();
    expect(result.checklist.length).toBeGreaterThan(0);
    expect(result.requiresReview).toBe(true);
  });

  test('returns full analysis for HIGH file', () => {
    const result = analyzeRisk('src/core/engine.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('HIGH');
    expect(result.reviewers).toContain('part-leader');
    expect(result.checklist.length).toBeGreaterThan(0);
    expect(result.requiresReview).toBe(true);
  });

  test('returns analysis for MEDIUM file without checklist', () => {
    const result = analyzeRisk('src/api/routes.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('MEDIUM');
    expect(result.checklist).toEqual([]);
    expect(result.requiresReview).toBe(false);
  });

  test('returns analysis for LOW file without checklist', () => {
    const result = analyzeRisk('tests/test_main.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('LOW');
    expect(result.checklist).toEqual([]);
    expect(result.requiresReview).toBe(false);
  });

  test('returns null for unclassified file', () => {
    expect(analyzeRisk('README.md')).toBeNull();
    expect(analyzeRisk('setup.py')).toBeNull();
  });

  test('returns null for null input', () => {
    expect(analyzeRisk(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(analyzeRisk('')).toBeNull();
  });

  test('uses custom risk areas when provided', () => {
    const customAreas = [
      {
        level: 'CRITICAL',
        patterns: ['**/secret/**'],
        reviewers: ['security-officer'],
        reason: 'Top secret files'
      }
    ];
    const result = analyzeRisk('project/secret/keys.py', customAreas);
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
    expect(result.reviewers).toContain('security-officer');
  });

  test('includes area reference in result', () => {
    const result = analyzeRisk('src/payment/pay.py');
    expect(result.area).toBeDefined();
    expect(result.area.level).toBe('CRITICAL');
    expect(result.area.patterns).toContain('**/payment/**');
  });
});

// ===========================================================================
// 14. Relative Path Resolution
// ===========================================================================

describe('toRelativePath', () => {
  test('returns empty string for empty input', () => {
    expect(toRelativePath('')).toBe('');
  });

  test('returns empty string for null', () => {
    expect(toRelativePath(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(toRelativePath(undefined)).toBe('');
  });

  test('returns relative path as-is', () => {
    expect(toRelativePath('src/models/user.py')).toBe('src/models/user.py');
  });

  test('converts absolute path to relative', () => {
    const projectDir = process.cwd();
    const absPath = `${projectDir}/src/models/user.py`;
    const result = toRelativePath(absPath);
    expect(result).toBe('src/models/user.py');
  });

  test('preserves paths outside project directory', () => {
    const result = toRelativePath('/some/other/project/file.py');
    expect(result).toContain('..');
  });
});

// ===========================================================================
// 15. Edge Cases and Error Handling
// ===========================================================================

describe('Edge cases', () => {
  test('globToRegex handles pattern with only **', () => {
    const regex = globToRegex('**');
    expect(regex.test('anything/at/all')).toBe(true);
    expect(regex.test('')).toBe(true);
  });

  test('globToRegex handles pattern with only *', () => {
    const regex = globToRegex('*');
    expect(regex.test('file.py')).toBe(true);
    expect(regex.test('deep/file.py')).toBe(false);
  });

  test('matchGlob handles path with special characters', () => {
    expect(matchGlob('src/payment/pay-v2.py', '**/payment/**')).toBe(true);
    expect(matchGlob('src/payment/pay_v2.py', '**/payment/**')).toBe(true);
  });

  test('classifyRiskLevel with custom empty risk areas', () => {
    const result = classifyRiskLevel('src/payment/pay.py', []);
    expect(result).toBeNull();
  });

  test('classifyRiskLevel with custom risk areas having unknown level', () => {
    const customAreas = [
      { level: 'UNKNOWN', patterns: ['**/payment/**'], reviewers: [], reason: 'test' }
    ];
    const result = classifyRiskLevel('src/payment/pay.py', customAreas);
    expect(result).toBeNull();
  });

  test('analyzeRisk with very deep nested path', () => {
    const result = analyzeRisk('a/b/c/d/e/f/g/h/payment/i/j.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('analyzeRisk with path containing only the keyword', () => {
    const result = analyzeRisk('payment/index.py');
    // "payment/" at the start would need "**/payment/**" to match
    // Since **/ can match zero segments, payment/index.py should match
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('matchGlob handles Windows-style paths (should not match)', () => {
    // Our glob matching works on forward-slash paths only
    expect(matchGlob('src\\payment\\pay.py', '**/payment/**')).toBe(false);
  });

  test('formatWarningReport with empty matched patterns', () => {
    const report = formatWarningReport({
      filePath: 'test.py',
      level: 'LOW',
      area: { reason: 'Low risk', reviewers: [] },
      matchedPatterns: []
    });
    expect(report).toBeTruthy();
    expect(typeof report).toBe('string');
  });
});

// ===========================================================================
// 16. Hook Protocol Compliance
// ===========================================================================

describe('Hook protocol', () => {
  test('formatWarningReport produces non-empty string for CRITICAL', () => {
    const area = DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL');
    const report = formatWarningReport({
      filePath: 'src/payment/pay.py',
      level: 'CRITICAL',
      area,
      matchedPatterns: ['**/payment/**']
    });
    expect(report.length).toBeGreaterThan(0);
  });

  test('report can be serialized as JSON for hookSpecificOutput', () => {
    const area = DEFAULT_RISK_AREAS.find(a => a.level === 'CRITICAL');
    const report = formatWarningReport({
      filePath: 'src/auth/login.py',
      level: 'CRITICAL',
      area,
      matchedPatterns: ['**/auth/**']
    });

    const output = JSON.stringify({
      hookSpecificOutput: {
        additionalContext: report
      }
    });

    const parsed = JSON.parse(output);
    expect(parsed.hookSpecificOutput.additionalContext).toBe(report);
  });

  test('report does not contain characters that break JSON', () => {
    const area = DEFAULT_RISK_AREAS.find(a => a.level === 'HIGH');
    const report = formatWarningReport({
      filePath: 'src/core/engine.py',
      level: 'HIGH',
      area,
      matchedPatterns: ['**/core/**']
    });

    // Should not throw when stringified
    expect(() => JSON.stringify(report)).not.toThrow();
  });
});

// ===========================================================================
// 17. Complex Real-World File Paths
// ===========================================================================

describe('Real-world file paths', () => {
  test('Python payment gateway handler', () => {
    const result = analyzeRisk('src/domains/payment/gateways/stripe/webhook_handler.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('JavaScript auth middleware', () => {
    const result = analyzeRisk('app/auth/middleware/jwt-verify.js');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('TypeScript billing service', () => {
    const result = analyzeRisk('src/modules/billing/services/subscription-manager.ts');
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('Python user service file (HIGH)', () => {
    const result = analyzeRisk('src/services/user_service.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('HIGH');
  });

  test('Core database connection (HIGH)', () => {
    const result = analyzeRisk('src/core/database/connection_pool.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('HIGH');
  });

  test('API v2 endpoint (MEDIUM)', () => {
    const result = analyzeRisk('src/api/v2/endpoints/users.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('MEDIUM');
  });

  test('Data model file (MEDIUM)', () => {
    const result = analyzeRisk('app/models/product.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('MEDIUM');
  });

  test('Integration test file (LOW) - payment in filename, not directory', () => {
    const result = analyzeRisk('tests/integration/test_payment_flow.py');
    // "payment" is in filename, not a directory segment
    // **/payment/** needs /payment/ as a directory, so this stays LOW (via **/tests/**)
    expect(result).not.toBeNull();
    expect(result.level).toBe('LOW');
  });

  test('Integration test file in payment directory (CRITICAL)', () => {
    const result = analyzeRisk('tests/payment/test_payment_flow.py');
    // "payment" IS a directory segment -> matches **/payment/**
    // CRITICAL > LOW, so CRITICAL wins
    expect(result).not.toBeNull();
    expect(result.level).toBe('CRITICAL');
  });

  test('Utility helper file (LOW)', () => {
    const result = analyzeRisk('src/utils/date_formatter.py');
    expect(result).not.toBeNull();
    expect(result.level).toBe('LOW');
  });

  test('Unclassified config file', () => {
    const result = analyzeRisk('.env');
    expect(result).toBeNull();
  });

  test('Unclassified Makefile', () => {
    const result = analyzeRisk('Makefile');
    expect(result).toBeNull();
  });
});

// ===========================================================================
// 18. Custom Risk Area Configurations
// ===========================================================================

describe('Custom risk area configurations', () => {
  test('custom areas with different patterns', () => {
    const customAreas = [
      {
        level: 'CRITICAL',
        patterns: ['**/secrets/**', '**/vault/**'],
        reviewers: ['security-admin'],
        reason: 'Secret management area'
      },
      {
        level: 'HIGH',
        patterns: ['**/plugins/**'],
        reviewers: ['plugin-maintainer'],
        reason: 'Plugin system'
      }
    ];

    expect(classifyRiskLevel('src/secrets/keys.py', customAreas).level).toBe('CRITICAL');
    expect(classifyRiskLevel('src/vault/config.py', customAreas).level).toBe('CRITICAL');
    expect(classifyRiskLevel('src/plugins/my-plugin.js', customAreas).level).toBe('HIGH');
    expect(classifyRiskLevel('src/utils/helpers.py', customAreas)).toBeNull();
  });

  test('custom areas override default areas', () => {
    const customAreas = [
      {
        level: 'LOW',
        patterns: ['**/payment/**'],
        reviewers: [],
        reason: 'Payments are safe in this project'
      }
    ];

    const result = classifyRiskLevel('src/payment/pay.py', customAreas);
    expect(result.level).toBe('LOW');
  });

  test('analyzeRisk with custom areas provides correct reviewers', () => {
    const customAreas = [
      {
        level: 'CRITICAL',
        patterns: ['**/infra/**'],
        reviewers: ['devops-lead', 'sre-team'],
        reason: 'Infrastructure code'
      }
    ];

    const result = analyzeRisk('deployments/infra/terraform/main.tf', customAreas);
    expect(result).not.toBeNull();
    expect(result.reviewers).toContain('devops-lead');
    expect(result.reviewers).toContain('sre-team');
  });
});

// ===========================================================================
// Total: 70+ test cases across 18 categories
// ===========================================================================
