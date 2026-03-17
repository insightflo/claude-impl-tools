/**
 * @TASK P3-T4 - Changelog Recorder Hook Tests
 * @TEST hooks/changelog-recorder.js
 *
 * Tests cover:
 *   1.  YAML string escaping
 *   2.  YAML entry serialization
 *   3.  YAML changelog serialization
 *   4.  YAML changelog parsing
 *   5.  YAML value parsing (quoted/unquoted)
 *   6.  Domain extraction (strict patterns)
 *   7.  Domain extraction (extended patterns)
 *   8.  Domain extraction (fallback heuristics)
 *   9.  Change type detection - test files
 *   10. Change type detection - doc files
 *   11. Change type detection - feature (new file)
 *   12. Change type detection - fix patterns
 *   13. Change type detection - refactor patterns
 *   14. Change type detection - new definitions
 *   15. Change type detection - Edit tool heuristics
 *   16. Test file detection
 *   17. Doc file detection
 *   18. Fix pattern detection
 *   19. Refactor pattern detection
 *   20. New definition detection
 *   21. Definition patterns by language
 *   22. Comment line extraction
 *   23. Pattern match counting
 *   24. Impact detection - imports
 *   25. Impact detection - API routes
 *   26. Impact detection - models
 *   27. Impact detection - config
 *   28. Impact detection - migrations
 *   29. Import statement extraction (Python)
 *   30. Import statement extraction (JS/TS)
 *   31. External vs internal import detection
 *   32. API route file detection
 *   33. Model file detection
 *   34. Description generation
 *   35. Changelog file path generation
 *   36. Changelog file I/O (read/write)
 *   37. Append entry
 *   38. Relative path resolution
 *   39. Entry builder
 *   40. Report formatting
 *   41. File skip logic
 *   42. Roundtrip: serialize -> parse
 *   43. Edge cases and error handling
 *   44. Integration: complete pipeline
 *   45. Max entries enforcement
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  CHANGELOG_DIR,
  DOMAIN_PATTERNS,
  EXTENDED_DOMAIN_PATTERNS,
  SOURCE_EXTENSIONS,
  DOC_EXTENSIONS,
  CONFIG_EXTENSIONS,
  MAX_ENTRIES_PER_MONTH,
  yamlEscapeString,
  serializeEntry,
  serializeChangelog,
  parseChangelog,
  parseYamlValue,
  extractDomain,
  detectChangeType,
  isTestFile,
  isDocFile,
  hasFixPatterns,
  hasRefactorPatterns,
  hasNewDefinitions,
  getDefinitionPatterns,
  extractCommentLines,
  countPatternMatches,
  detectImpact,
  extractImportStatements,
  isExternalImport,
  isApiRouteFile,
  isModelFile,
  generateDescription,
  getChangelogFilePath,
  readChangelogFile,
  writeChangelogFile,
  appendEntry,
  toRelativePath,
  buildEntry,
  formatRecordingReport,
  shouldSkipFile
} = require('../changelog-recorder');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 1. YAML String Escaping
// ---------------------------------------------------------------------------

describe('yamlEscapeString', () => {
  test('returns plain string for simple values', () => {
    expect(yamlEscapeString('hello')).toBe('hello');
  });

  test('quotes strings with colons', () => {
    expect(yamlEscapeString('key: value')).toBe('"key: value"');
  });

  test('quotes strings with hash symbols', () => {
    expect(yamlEscapeString('note # comment')).toBe('"note # comment"');
  });

  test('quotes strings starting with spaces', () => {
    expect(yamlEscapeString(' leading space')).toBe('" leading space"');
  });

  test('quotes strings ending with spaces', () => {
    expect(yamlEscapeString('trailing space ')).toBe('"trailing space "');
  });

  test('handles empty string', () => {
    expect(yamlEscapeString('')).toBe('""');
  });

  test('handles null/undefined', () => {
    expect(yamlEscapeString(null)).toBe('""');
    expect(yamlEscapeString(undefined)).toBe('""');
  });

  test('quotes boolean-like strings', () => {
    expect(yamlEscapeString('true')).toBe('"true"');
    expect(yamlEscapeString('false')).toBe('"false"');
    expect(yamlEscapeString('yes')).toBe('"yes"');
    expect(yamlEscapeString('no')).toBe('"no"');
    expect(yamlEscapeString('null')).toBe('"null"');
  });

  test('quotes numeric strings', () => {
    expect(yamlEscapeString('123')).toBe('"123"');
    expect(yamlEscapeString('3.14')).toBe('"3.14"');
  });

  test('escapes double quotes inside strings', () => {
    expect(yamlEscapeString('say "hello"')).toBe('"say \\"hello\\""');
  });

  test('escapes newlines', () => {
    expect(yamlEscapeString('line1\nline2')).toBe('"line1\\nline2"');
  });

  test('escapes backslashes', () => {
    expect(yamlEscapeString('path\\to\\file')).toBe('"path\\\\to\\\\file"');
  });

  test('quotes strings with special YAML characters', () => {
    expect(yamlEscapeString('[array]')).toBe('"[array]"');
    expect(yamlEscapeString('{object}')).toBe('"{object}"');
    expect(yamlEscapeString('& anchor')).toBe('"& anchor"');
    expect(yamlEscapeString('* alias')).toBe('"* alias"');
    expect(yamlEscapeString('!tag')).toBe('"!tag"');
    expect(yamlEscapeString('|literal')).toBe('"|literal"');
    expect(yamlEscapeString('>folded')).toBe('">folded"');
  });
});

// ---------------------------------------------------------------------------
// 2. YAML Entry Serialization
// ---------------------------------------------------------------------------

describe('serializeEntry', () => {
  test('serializes a complete entry', () => {
    const entry = {
      date: '2026-02-07T14:30:00',
      type: 'feature',
      domain: 'order',
      files: ['order/services/discount_service.py'],
      description: 'Add discount service',
      impact: ['member-api dependency added']
    };

    const yaml = serializeEntry(entry);
    expect(yaml).toContain('- date:');
    expect(yaml).toContain('type: feature');
    expect(yaml).toContain('domain: order');
    expect(yaml).toContain('files:');
    expect(yaml).toContain('order/services/discount_service.py');
    expect(yaml).toContain('description:');
    expect(yaml).toContain('impact:');
    expect(yaml).toContain('member-api dependency added');
  });

  test('handles empty impact with "none"', () => {
    const entry = {
      date: '2026-02-07T14:30:00',
      type: 'refactor',
      domain: 'root',
      files: ['main.py'],
      description: 'Refactor main',
      impact: []
    };

    const yaml = serializeEntry(entry);
    expect(yaml).toContain('- none');
  });

  test('serializes multiple files', () => {
    const entry = {
      date: '2026-02-07T14:30:00',
      type: 'feature',
      domain: 'auth',
      files: ['auth/login.py', 'auth/register.py'],
      description: 'Add auth endpoints',
      impact: []
    };

    const yaml = serializeEntry(entry);
    expect(yaml).toContain('auth/login.py');
    expect(yaml).toContain('auth/register.py');
  });

  test('uses custom indentation', () => {
    const entry = {
      date: '2026-02-07T14:30:00',
      type: 'fix',
      domain: 'root',
      files: ['app.py'],
      description: 'Fix bug',
      impact: []
    };

    const yaml = serializeEntry(entry, '    ');
    expect(yaml).toMatch(/^    - date:/m);
  });
});

// ---------------------------------------------------------------------------
// 3. YAML Changelog Serialization
// ---------------------------------------------------------------------------

describe('serializeChangelog', () => {
  test('produces valid YAML header', () => {
    const yaml = serializeChangelog([]);
    expect(yaml).toBe('entries:\n');
  });

  test('serializes multiple entries', () => {
    const entries = [
      {
        date: '2026-02-07T10:00:00',
        type: 'feature',
        domain: 'auth',
        files: ['auth/login.py'],
        description: 'Add login',
        impact: []
      },
      {
        date: '2026-02-07T11:00:00',
        type: 'fix',
        domain: 'order',
        files: ['order/cart.py'],
        description: 'Fix cart',
        impact: ['pricing affected']
      }
    ];

    const yaml = serializeChangelog(entries);
    expect(yaml).toMatch(/^entries:\n/);
    expect(yaml).toContain('type: feature');
    expect(yaml).toContain('type: fix');
  });
});

// ---------------------------------------------------------------------------
// 4. YAML Changelog Parsing
// ---------------------------------------------------------------------------

describe('parseChangelog', () => {
  test('parses a single entry', () => {
    const yaml = `entries:
  - date: 2026-02-07T14:30:00
    type: feature
    domain: order
    files:
      - order/services/discount_service.py
    description: Add discount service
    impact:
      - member-api dependency added`;

    const entries = parseChangelog(yaml);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-02-07T14:30:00');
    expect(entries[0].type).toBe('feature');
    expect(entries[0].domain).toBe('order');
    expect(entries[0].files).toEqual(['order/services/discount_service.py']);
    expect(entries[0].description).toBe('Add discount service');
    expect(entries[0].impact).toEqual(['member-api dependency added']);
  });

  test('parses multiple entries', () => {
    const yaml = `entries:
  - date: 2026-02-07T10:00:00
    type: feature
    domain: auth
    files:
      - auth/login.py
    description: Add login
    impact:
      - none
  - date: 2026-02-07T11:00:00
    type: fix
    domain: order
    files:
      - order/cart.py
    description: Fix cart total
    impact:
      - pricing affected`;

    const entries = parseChangelog(yaml);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('feature');
    expect(entries[1].type).toBe('fix');
  });

  test('handles quoted values', () => {
    const yaml = `entries:
  - date: "2026-02-07T14:30:00"
    type: feature
    domain: order
    files:
      - "order/services/discount_service.py"
    description: "Add discount: member grade support"
    impact:
      - "member-api: dependency added"`;

    const entries = parseChangelog(yaml);
    expect(entries[0].description).toBe('Add discount: member grade support');
    expect(entries[0].impact[0]).toBe('member-api: dependency added');
  });

  test('returns empty array for empty content', () => {
    expect(parseChangelog('')).toEqual([]);
    expect(parseChangelog(null)).toEqual([]);
    expect(parseChangelog(undefined)).toEqual([]);
  });

  test('returns empty array for whitespace-only content', () => {
    expect(parseChangelog('   \n  \n')).toEqual([]);
  });

  test('handles entries with multiple files', () => {
    const yaml = `entries:
  - date: 2026-02-07T14:30:00
    type: feature
    domain: auth
    files:
      - auth/login.py
      - auth/register.py
      - auth/utils.py
    description: Add auth module
    impact:
      - none`;

    const entries = parseChangelog(yaml);
    expect(entries[0].files).toHaveLength(3);
  });

  test('handles entries with multiple impacts', () => {
    const yaml = `entries:
  - date: 2026-02-07T14:30:00
    type: feature
    domain: order
    files:
      - order/payment.py
    description: Add payment
    impact:
      - billing API dependency
      - member service dependency
      - requires migration`;

    const entries = parseChangelog(yaml);
    expect(entries[0].impact).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 5. YAML Value Parsing
// ---------------------------------------------------------------------------

describe('parseYamlValue', () => {
  test('parses unquoted values', () => {
    expect(parseYamlValue('feature')).toBe('feature');
  });

  test('parses double-quoted values', () => {
    expect(parseYamlValue('"hello world"')).toBe('hello world');
  });

  test('parses single-quoted values', () => {
    expect(parseYamlValue("'hello world'")).toBe('hello world');
  });

  test('handles escaped double quotes', () => {
    expect(parseYamlValue('"say \\"hello\\""')).toBe('say "hello"');
  });

  test('handles escaped newlines', () => {
    expect(parseYamlValue('"line1\\nline2"')).toBe('line1\nline2');
  });

  test('handles escaped backslashes', () => {
    expect(parseYamlValue('"path\\\\to\\\\file"')).toBe('path\\to\\file');
  });

  test('handles single-quote escaping (double single-quote)', () => {
    expect(parseYamlValue("'it''s fine'")).toBe("it's fine");
  });

  test('returns empty string for empty input', () => {
    expect(parseYamlValue('')).toBe('');
    expect(parseYamlValue(null)).toBe('');
    expect(parseYamlValue(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 6. Domain Extraction - Strict Patterns
// ---------------------------------------------------------------------------

describe('extractDomain - strict patterns', () => {
  test('extracts from src/domains/ path', () => {
    expect(extractDomain('src/domains/member/services/auth.py')).toBe('member');
  });

  test('extracts from app/domains/ path', () => {
    expect(extractDomain('app/domains/order/models/order.py')).toBe('order');
  });

  test('extracts from domains/ path', () => {
    expect(extractDomain('domains/payment/routes/pay.py')).toBe('payment');
  });

  test('extracts from packages/ path', () => {
    expect(extractDomain('packages/auth-lib/src/index.ts')).toBe('auth-lib');
  });

  test('extracts from modules/ path', () => {
    expect(extractDomain('modules/billing/controllers/invoice.js')).toBe('billing');
  });
});

// ---------------------------------------------------------------------------
// 7. Domain Extraction - Extended Patterns
// ---------------------------------------------------------------------------

describe('extractDomain - extended patterns', () => {
  test('extracts from app/api/routes/ path', () => {
    expect(extractDomain('app/api/routes/auth.py')).toBe('auth');
  });

  test('extracts from app/services/ path', () => {
    expect(extractDomain('app/services/order_service.py')).toBe('order');
  });

  test('extracts from src/models/ path', () => {
    expect(extractDomain('src/models/product.py')).toBe('product');
  });

  test('extracts from app/schemas/ path', () => {
    expect(extractDomain('app/schemas/user.py')).toBe('user');
  });

  test('extracts from src/controllers/ path', () => {
    expect(extractDomain('src/controllers/payment_controller.js')).toBe('payment');
  });
});

// ---------------------------------------------------------------------------
// 8. Domain Extraction - Fallbacks
// ---------------------------------------------------------------------------

describe('extractDomain - fallbacks', () => {
  test('extracts from service filename pattern', () => {
    expect(extractDomain('services/order_service.py')).toBe('order');
  });

  test('returns "root" for top-level files', () => {
    expect(extractDomain('main.py')).toBe('root');
  });

  test('returns "root" for generic src/ files', () => {
    expect(extractDomain('src/main.py')).toBe('root');
  });

  test('returns "root" for null/undefined/empty', () => {
    expect(extractDomain(null)).toBe('root');
    expect(extractDomain(undefined)).toBe('root');
    expect(extractDomain('')).toBe('root');
  });

  test('extracts from non-generic first directory', () => {
    expect(extractDomain('payment/handler.py')).toBe('payment');
  });
});

// ---------------------------------------------------------------------------
// 9. Change Type Detection - Test Files
// ---------------------------------------------------------------------------

describe('detectChangeType - test files', () => {
  test('detects test directory path', () => {
    expect(detectChangeType({ filePath: 'tests/test_auth.py' })).toBe('test');
  });

  test('detects __tests__ directory path', () => {
    expect(detectChangeType({ filePath: '__tests__/auth.test.js' })).toBe('test');
  });

  test('detects test_ prefix filename', () => {
    expect(detectChangeType({ filePath: 'test_login.py' })).toBe('test');
  });

  test('detects .test.js suffix', () => {
    expect(detectChangeType({ filePath: 'auth.test.js' })).toBe('test');
  });

  test('detects .spec.ts suffix', () => {
    expect(detectChangeType({ filePath: 'auth.spec.ts' })).toBe('test');
  });

  test('detects _test.go suffix', () => {
    expect(detectChangeType({ filePath: 'auth_test.go' })).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// 10. Change Type Detection - Doc Files
// ---------------------------------------------------------------------------

describe('detectChangeType - doc files', () => {
  test('detects markdown files', () => {
    expect(detectChangeType({ filePath: 'README.md' })).toBe('docs');
  });

  test('detects rst files', () => {
    expect(detectChangeType({ filePath: 'docs/api.rst' })).toBe('docs');
  });

  test('detects files in docs/ directory', () => {
    expect(detectChangeType({ filePath: 'docs/guide.txt' })).toBe('docs');
  });

  test('detects CHANGELOG files', () => {
    expect(detectChangeType({ filePath: 'CHANGELOG' })).toBe('docs');
  });

  test('detects LICENSE files', () => {
    expect(detectChangeType({ filePath: 'LICENSE' })).toBe('docs');
  });
});

// ---------------------------------------------------------------------------
// 11. Change Type Detection - Feature (New File)
// ---------------------------------------------------------------------------

describe('detectChangeType - feature', () => {
  test('new file creation via Write tool', () => {
    expect(detectChangeType({
      filePath: 'app/services/new_service.py',
      toolName: 'Write',
      newContent: 'class NewService:\n    pass\n'
    })).toBe('feature');
  });

  test('new definitions added to existing file', () => {
    expect(detectChangeType({
      filePath: 'app/services/order.py',
      toolName: 'Edit',
      newContent: 'class OrderService:\n    pass\n\ndef create_order():\n    pass\n',
      oldContent: 'class OrderService:\n    pass\n'
    })).toBe('feature');
  });
});

// ---------------------------------------------------------------------------
// 12. Change Type Detection - Fix Patterns
// ---------------------------------------------------------------------------

describe('detectChangeType - fix', () => {
  test('detects fix keyword in comments', () => {
    expect(detectChangeType({
      filePath: 'app/services/order.py',
      toolName: 'Edit',
      newContent: '# Fixed: null pointer exception\ndef get_order():\n    pass\n',
      oldContent: 'def get_order():\n    pass\n'
    })).toBe('fix');
  });

  test('detects bugfix keyword in comments', () => {
    expect(detectChangeType({
      filePath: 'app/utils.py',
      toolName: 'Edit',
      newContent: '# Bugfix for edge case\ndef parse():\n    pass\n',
      oldContent: 'def parse():\n    pass\n'
    })).toBe('fix');
  });

  test('detects added error handling as fix', () => {
    expect(detectChangeType({
      filePath: 'app/handler.py',
      toolName: 'Edit',
      newContent: 'try:\n    result = do_something()\nexcept ValueError:\n    handle_error()\n',
      oldContent: 'result = do_something()\n'
    })).toBe('fix');
  });
});

// ---------------------------------------------------------------------------
// 13. Change Type Detection - Refactor Patterns
// ---------------------------------------------------------------------------

describe('detectChangeType - refactor', () => {
  test('detects refactor keyword in comments', () => {
    expect(detectChangeType({
      filePath: 'app/services/order.py',
      toolName: 'Edit',
      newContent: '# Refactored for clarity\ndef get_order():\n    pass\n',
      oldContent: 'def get_order():\n    return None\n'
    })).toBe('refactor');
  });

  test('detects cleanup keyword', () => {
    expect(detectChangeType({
      filePath: 'app/utils.py',
      toolName: 'Edit',
      newContent: '// Cleanup unused variables\nconst x = 1;\n',
      oldContent: 'const x = 1;\nconst y = 2;\n'
    })).toBe('refactor');
  });

  test('Edit with similar-length strings defaults to refactor', () => {
    expect(detectChangeType({
      filePath: 'app/main.py',
      toolName: 'Edit',
      oldString: 'def old_name():',
      newString: 'def new_name():'
    })).toBe('refactor');
  });
});

// ---------------------------------------------------------------------------
// 14. Change Type Detection - New Definitions
// ---------------------------------------------------------------------------

describe('detectChangeType - new definitions', () => {
  test('detects new Python function', () => {
    expect(detectChangeType({
      filePath: 'app/services/auth.py',
      toolName: 'Edit',
      newContent: 'def login():\n    pass\n\ndef register():\n    pass\n',
      oldContent: 'def login():\n    pass\n'
    })).toBe('feature');
  });

  test('detects new Python class', () => {
    expect(detectChangeType({
      filePath: 'app/models/user.py',
      toolName: 'Edit',
      newContent: 'class User:\n    pass\n\nclass Admin:\n    pass\n',
      oldContent: 'class User:\n    pass\n'
    })).toBe('feature');
  });
});

// ---------------------------------------------------------------------------
// 15. Change Type Detection - Edge Cases
// ---------------------------------------------------------------------------

describe('detectChangeType - edge cases', () => {
  test('null params returns feature', () => {
    expect(detectChangeType(null)).toBe('feature');
  });

  test('empty params returns feature', () => {
    expect(detectChangeType({})).toBe('feature');
  });

  test('Edit with large addition returns feature', () => {
    expect(detectChangeType({
      filePath: 'app/main.py',
      toolName: 'Edit',
      oldString: 'x = 1',
      newString: 'x = 1\ny = 2\nz = 3\nw = 4\na = 5\nb = 6\nc = 7\nd = 8\ne = 9\nf = 10\ng = 11'
    })).toBe('feature');
  });

  test('Write with larger new content returns feature', () => {
    expect(detectChangeType({
      filePath: 'app/main.py',
      toolName: 'Write',
      oldContent: 'x = 1\n',
      newContent: 'x = 1\ny = 2\nz = 3\nw = 4\na = 5\n'
    })).toBe('feature');
  });
});

// ---------------------------------------------------------------------------
// 16. Test File Detection
// ---------------------------------------------------------------------------

describe('isTestFile', () => {
  test('detects tests/ directory', () => {
    expect(isTestFile('tests/test_auth.py')).toBe(true);
  });

  test('detects test/ directory', () => {
    expect(isTestFile('test/auth.test.js')).toBe(true);
  });

  test('detects __tests__ directory', () => {
    expect(isTestFile('__tests__/auth.test.js')).toBe(true);
  });

  test('detects spec/ directory', () => {
    expect(isTestFile('spec/auth_spec.rb')).toBe(true);
  });

  test('detects test_ prefix', () => {
    expect(isTestFile('test_auth.py')).toBe(true);
  });

  test('detects .test. extension', () => {
    expect(isTestFile('auth.test.ts')).toBe(true);
  });

  test('detects .spec. extension', () => {
    expect(isTestFile('auth.spec.ts')).toBe(true);
  });

  test('detects _test suffix', () => {
    expect(isTestFile('auth_test.go')).toBe(true);
  });

  test('non-test file returns false', () => {
    expect(isTestFile('app/services/auth.py')).toBe(false);
  });

  test('null returns false', () => {
    expect(isTestFile(null)).toBe(false);
    expect(isTestFile('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 17. Doc File Detection
// ---------------------------------------------------------------------------

describe('isDocFile', () => {
  test('detects .md extension', () => {
    expect(isDocFile('README.md', '.md')).toBe(true);
  });

  test('detects .rst extension', () => {
    expect(isDocFile('api.rst', '.rst')).toBe(true);
  });

  test('detects .txt extension', () => {
    expect(isDocFile('notes.txt', '.txt')).toBe(true);
  });

  test('detects docs/ directory', () => {
    expect(isDocFile('docs/guide.html', '.html')).toBe(true);
  });

  test('detects doc/ directory', () => {
    expect(isDocFile('doc/api.yaml', '.yaml')).toBe(true);
  });

  test('detects README file', () => {
    expect(isDocFile('readme', '')).toBe(true);
  });

  test('detects CONTRIBUTING file', () => {
    expect(isDocFile('CONTRIBUTING.md', '.md')).toBe(true);
  });

  test('non-doc file returns false', () => {
    expect(isDocFile('app/main.py', '.py')).toBe(false);
  });

  test('null returns false', () => {
    expect(isDocFile(null, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 18. Fix Pattern Detection
// ---------------------------------------------------------------------------

describe('hasFixPatterns', () => {
  test('detects fix keyword in comments', () => {
    expect(hasFixPatterns('# Fixed issue with null check', '')).toBe(true);
  });

  test('detects bugfix keyword', () => {
    expect(hasFixPatterns('// bugfix: handle empty array', '')).toBe(true);
  });

  test('detects hotfix keyword', () => {
    expect(hasFixPatterns('# hotfix for production issue', '')).toBe(true);
  });

  test('detects added error handling', () => {
    const newContent = 'try:\n    result = fn()\nexcept Exception:\n    pass\n';
    const oldContent = 'result = fn()\n';
    expect(hasFixPatterns(newContent, oldContent)).toBe(true);
  });

  test('returns false for no fix patterns', () => {
    expect(hasFixPatterns('def hello():\n    pass\n', '')).toBe(false);
  });

  test('returns false for null', () => {
    expect(hasFixPatterns(null, '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 19. Refactor Pattern Detection
// ---------------------------------------------------------------------------

describe('hasRefactorPatterns', () => {
  test('detects refactor keyword', () => {
    expect(hasRefactorPatterns('# Refactored logic\ndef fn(): pass', 'def fn(): pass', '')).toBe(true);
  });

  test('detects cleanup keyword', () => {
    expect(hasRefactorPatterns('// Cleanup unused vars\nconst a = 1;', 'const a = 1;', '')).toBe(true);
  });

  test('detects rename keyword', () => {
    expect(hasRefactorPatterns('# renamed variable\nx = 1', 'old_x = 1', '')).toBe(true);
  });

  test('returns false when no old content', () => {
    expect(hasRefactorPatterns('# Refactored', null, '')).toBe(false);
  });

  test('returns false without refactor keywords', () => {
    expect(hasRefactorPatterns('def fn(): pass', 'def fn(): return 1', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 20. New Definition Detection
// ---------------------------------------------------------------------------

describe('hasNewDefinitions', () => {
  test('detects new Python function', () => {
    const newContent = 'def a():\n    pass\ndef b():\n    pass\n';
    const oldContent = 'def a():\n    pass\n';
    expect(hasNewDefinitions(newContent, oldContent, '.py')).toBe(true);
  });

  test('detects new Python class', () => {
    const newContent = 'class A:\n    pass\nclass B:\n    pass\n';
    const oldContent = 'class A:\n    pass\n';
    expect(hasNewDefinitions(newContent, oldContent, '.py')).toBe(true);
  });

  test('no new definitions', () => {
    const content = 'def a():\n    pass\n';
    expect(hasNewDefinitions(content, content, '.py')).toBe(false);
  });

  test('new file (no old content)', () => {
    expect(hasNewDefinitions('def a():\n    pass\n', '', '.py')).toBe(true);
  });

  test('null content returns false', () => {
    expect(hasNewDefinitions(null, '', '.py')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 21. Definition Patterns by Language
// ---------------------------------------------------------------------------

describe('getDefinitionPatterns', () => {
  test('returns patterns for Python', () => {
    const patterns = getDefinitionPatterns('.py');
    expect(patterns.length).toBeGreaterThan(0);
  });

  test('returns patterns for JavaScript', () => {
    const patterns = getDefinitionPatterns('.js');
    expect(patterns.length).toBeGreaterThan(0);
  });

  test('returns patterns for TypeScript', () => {
    const patterns = getDefinitionPatterns('.ts');
    expect(patterns.length).toBeGreaterThan(0);
  });

  test('returns patterns for Go', () => {
    const patterns = getDefinitionPatterns('.go');
    expect(patterns.length).toBeGreaterThan(0);
  });

  test('returns patterns for Rust', () => {
    const patterns = getDefinitionPatterns('.rs');
    expect(patterns.length).toBeGreaterThan(0);
  });

  test('returns patterns for Java', () => {
    const patterns = getDefinitionPatterns('.java');
    expect(patterns.length).toBeGreaterThan(0);
  });

  test('returns empty for unknown extension', () => {
    expect(getDefinitionPatterns('.xyz')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 22. Comment Line Extraction
// ---------------------------------------------------------------------------

describe('extractCommentLines', () => {
  test('extracts Python comments', () => {
    const content = '# this is a comment\nx = 1\n# another comment\n';
    const comments = extractCommentLines(content);
    expect(comments).toHaveLength(2);
    expect(comments[0]).toContain('# this is a comment');
  });

  test('extracts JS single-line comments', () => {
    const content = '// comment here\nconst x = 1;\n// another\n';
    const comments = extractCommentLines(content);
    expect(comments).toHaveLength(2);
  });

  test('extracts block comment lines', () => {
    const content = '/* start\n * middle\n * end\n */\n';
    const comments = extractCommentLines(content);
    expect(comments.length).toBeGreaterThanOrEqual(3);
  });

  test('returns empty for no comments', () => {
    expect(extractCommentLines('x = 1\ny = 2\n')).toEqual([]);
  });

  test('returns empty for null', () => {
    expect(extractCommentLines(null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 23. Pattern Match Counting
// ---------------------------------------------------------------------------

describe('countPatternMatches', () => {
  test('counts function definitions', () => {
    const content = 'def a():\n    pass\ndef b():\n    pass\n';
    const patterns = [/^\s*def\s+\w+/];
    expect(countPatternMatches(content, patterns)).toBe(2);
  });

  test('counts class definitions', () => {
    const content = 'class A:\n    pass\nclass B:\n    pass\n';
    const patterns = [/^\s*class\s+\w+/];
    expect(countPatternMatches(content, patterns)).toBe(2);
  });

  test('returns 0 for no matches', () => {
    expect(countPatternMatches('x = 1\n', [/def\s+/])).toBe(0);
  });

  test('returns 0 for null content', () => {
    expect(countPatternMatches(null, [/def/])).toBe(0);
  });

  test('returns 0 for null patterns', () => {
    expect(countPatternMatches('def a():', null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 24. Impact Detection - Imports
// ---------------------------------------------------------------------------

describe('detectImpact - imports', () => {
  test('detects new external import', () => {
    const impact = detectImpact({
      filePath: 'app/main.py',
      newContent: 'import requests\nimport os\n',
      oldContent: 'import os\n'
    });
    expect(impact).toEqual(expect.arrayContaining([
      expect.stringContaining('external dependency added')
    ]));
  });

  test('detects new internal import', () => {
    const impact = detectImpact({
      filePath: 'app/main.py',
      newContent: 'from app.services.auth import login\nimport os\n',
      oldContent: 'import os\n'
    });
    expect(impact).toEqual(expect.arrayContaining([
      expect.stringContaining('internal dependency added')
    ]));
  });

  test('no impact when no new imports', () => {
    const impact = detectImpact({
      filePath: 'app/main.py',
      newContent: 'import os\n',
      oldContent: 'import os\n'
    });
    // Should not contain import-related impacts
    const importImpacts = impact.filter(i => i.includes('dependency'));
    expect(importImpacts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 25. Impact Detection - API Routes
// ---------------------------------------------------------------------------

describe('detectImpact - API routes', () => {
  test('detects API route file change', () => {
    const impact = detectImpact({
      filePath: 'app/api/routes/auth.py',
      newContent: '@router.get("/login")\ndef login(): pass\n'
    });
    expect(impact).toEqual(expect.arrayContaining([
      'API endpoint modification'
    ]));
  });

  test('detects controller file change', () => {
    const impact = detectImpact({
      filePath: 'app/controllers/order.js',
      newContent: 'module.exports = {}\n'
    });
    expect(impact).toEqual(expect.arrayContaining([
      'API endpoint modification'
    ]));
  });
});

// ---------------------------------------------------------------------------
// 26. Impact Detection - Models
// ---------------------------------------------------------------------------

describe('detectImpact - models', () => {
  test('detects model file change', () => {
    const impact = detectImpact({
      filePath: 'app/models/user.py',
      newContent: 'class User: pass\n'
    });
    expect(impact).toEqual(expect.arrayContaining([
      'data model modification'
    ]));
  });

  test('detects schema file change', () => {
    const impact = detectImpact({
      filePath: 'app/schemas/order.py',
      newContent: 'class OrderSchema: pass\n'
    });
    expect(impact).toEqual(expect.arrayContaining([
      'data model modification'
    ]));
  });
});

// ---------------------------------------------------------------------------
// 27. Impact Detection - Config
// ---------------------------------------------------------------------------

describe('detectImpact - config', () => {
  test('detects YAML config change', () => {
    const impact = detectImpact({
      filePath: 'config/settings.yaml',
      newContent: 'key: value\n'
    });
    expect(impact).toEqual(expect.arrayContaining([
      'configuration change'
    ]));
  });

  test('detects JSON config change', () => {
    const impact = detectImpact({
      filePath: 'package.json',
      newContent: '{}\n'
    });
    expect(impact).toEqual(expect.arrayContaining([
      'configuration change'
    ]));
  });
});

// ---------------------------------------------------------------------------
// 28. Impact Detection - Migrations
// ---------------------------------------------------------------------------

describe('detectImpact - migrations', () => {
  test('detects migration file', () => {
    const impact = detectImpact({
      filePath: 'alembic/migrations/001_initial.py',
      newContent: 'def upgrade(): pass\n'
    });
    expect(impact).toEqual(expect.arrayContaining([
      'database migration'
    ]));
  });
});

// ---------------------------------------------------------------------------
// 29. Import Statement Extraction (Python)
// ---------------------------------------------------------------------------

describe('extractImportStatements - Python', () => {
  test('extracts from-import statements', () => {
    const content = 'from app.services.auth import login\nfrom os import path\n';
    const imports = extractImportStatements(content, '.py');
    expect(imports).toContain('app.services.auth');
    expect(imports).toContain('os');
  });

  test('extracts import statements', () => {
    const content = 'import os\nimport sys\n';
    const imports = extractImportStatements(content, '.py');
    expect(imports).toContain('os');
    expect(imports).toContain('sys');
  });

  test('returns empty for no imports', () => {
    expect(extractImportStatements('x = 1\n', '.py')).toEqual([]);
  });

  test('returns empty for null', () => {
    expect(extractImportStatements(null, '.py')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 30. Import Statement Extraction (JS/TS)
// ---------------------------------------------------------------------------

describe('extractImportStatements - JS/TS', () => {
  test('extracts ES import statements', () => {
    const content = "import { Router } from 'express';\nimport path from 'path';\n";
    const imports = extractImportStatements(content, '.js');
    expect(imports).toContain('express');
    expect(imports).toContain('path');
  });

  test('extracts require statements', () => {
    const content = "const fs = require('fs');\nconst path = require('path');\n";
    const imports = extractImportStatements(content, '.js');
    expect(imports).toContain('fs');
    expect(imports).toContain('path');
  });

  test('works for .ts extension', () => {
    const content = "import { Component } from '@angular/core';\n";
    const imports = extractImportStatements(content, '.ts');
    expect(imports).toContain('@angular/core');
  });
});

// ---------------------------------------------------------------------------
// 31. External vs Internal Import Detection
// ---------------------------------------------------------------------------

describe('isExternalImport', () => {
  test('external package is external', () => {
    expect(isExternalImport('requests')).toBe(true);
    expect(isExternalImport('express')).toBe(true);
    expect(isExternalImport('fastapi')).toBe(true);
  });

  test('relative import is internal', () => {
    expect(isExternalImport('./utils')).toBe(false);
    expect(isExternalImport('../services/auth')).toBe(false);
  });

  test('app.* import is internal', () => {
    expect(isExternalImport('app.services.auth')).toBe(false);
  });

  test('src.* import is internal', () => {
    expect(isExternalImport('src.utils')).toBe(false);
  });

  test('domains.* import is internal', () => {
    expect(isExternalImport('domains.member.services')).toBe(false);
  });

  test('null returns false', () => {
    expect(isExternalImport(null)).toBe(false);
    expect(isExternalImport('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 32. API Route File Detection
// ---------------------------------------------------------------------------

describe('isApiRouteFile', () => {
  test('detects routes directory', () => {
    expect(isApiRouteFile('app/routes/auth.py')).toBe(true);
  });

  test('detects api directory', () => {
    expect(isApiRouteFile('app/api/users.py')).toBe(true);
  });

  test('detects endpoints directory', () => {
    expect(isApiRouteFile('app/endpoints/orders.py')).toBe(true);
  });

  test('detects controllers directory', () => {
    expect(isApiRouteFile('app/controllers/auth.js')).toBe(true);
  });

  test('non-route file returns false', () => {
    expect(isApiRouteFile('app/services/auth.py')).toBe(false);
  });

  test('null returns false', () => {
    expect(isApiRouteFile(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 33. Model File Detection
// ---------------------------------------------------------------------------

describe('isModelFile', () => {
  test('detects models directory', () => {
    expect(isModelFile('app/models/user.py')).toBe(true);
  });

  test('detects schemas directory', () => {
    expect(isModelFile('app/schemas/user.py')).toBe(true);
  });

  test('detects entities directory', () => {
    expect(isModelFile('app/entities/order.py')).toBe(true);
  });

  test('non-model file returns false', () => {
    expect(isModelFile('app/services/auth.py')).toBe(false);
  });

  test('null returns false', () => {
    expect(isModelFile(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 34. Description Generation
// ---------------------------------------------------------------------------

describe('generateDescription', () => {
  test('generates test file description (new)', () => {
    const desc = generateDescription({
      filePath: 'tests/test_auth.py',
      changeType: 'test',
      domain: 'auth',
      toolName: 'Write'
    });
    expect(desc).toContain('test');
    expect(desc).toContain('test_auth.py');
  });

  test('generates test file description (update)', () => {
    const desc = generateDescription({
      filePath: 'tests/test_auth.py',
      changeType: 'test',
      domain: 'auth',
      toolName: 'Edit',
      oldContent: 'existing'
    });
    expect(desc).toContain('Update');
  });

  test('generates docs description', () => {
    const desc = generateDescription({
      filePath: 'README.md',
      changeType: 'docs',
      domain: 'root',
      toolName: 'Write'
    });
    expect(desc).toContain('documentation');
  });

  test('generates feature description (new file)', () => {
    const desc = generateDescription({
      filePath: 'app/services/order.py',
      changeType: 'feature',
      domain: 'order',
      toolName: 'Write'
    });
    expect(desc).toContain('order');
    expect(desc).toContain('Create');
  });

  test('generates fix description', () => {
    const desc = generateDescription({
      filePath: 'app/services/order.py',
      changeType: 'fix',
      domain: 'order'
    });
    expect(desc).toContain('Fix');
  });

  test('generates refactor description', () => {
    const desc = generateDescription({
      filePath: 'app/services/order.py',
      changeType: 'refactor',
      domain: 'order'
    });
    expect(desc).toContain('Refactor');
  });

  test('handles null params', () => {
    expect(generateDescription(null)).toBe('Unknown change');
  });
});

// ---------------------------------------------------------------------------
// 35. Changelog File Path Generation
// ---------------------------------------------------------------------------

describe('getChangelogFilePath', () => {
  test('generates correct path for a date', () => {
    const date = new Date('2026-02-07T14:30:00Z');
    const result = getChangelogFilePath('/project', date);
    expect(result).toBe('/project/.claude/changelog/2026-02.yaml');
  });

  test('pads month with zero', () => {
    const date = new Date('2026-01-15T10:00:00Z');
    const result = getChangelogFilePath('/project', date);
    expect(result).toContain('2026-01.yaml');
  });

  test('handles December', () => {
    const date = new Date('2026-12-15T12:00:00Z');
    const result = getChangelogFilePath('/project', date);
    expect(result).toContain('2026-12.yaml');
  });

  test('uses current date when not provided', () => {
    const result = getChangelogFilePath('/project');
    const now = new Date();
    const expectedMonth = String(now.getMonth() + 1).padStart(2, '0');
    expect(result).toContain(`${now.getFullYear()}-${expectedMonth}.yaml`);
  });
});

// ---------------------------------------------------------------------------
// 36. Changelog File I/O
// ---------------------------------------------------------------------------

describe('Changelog file I/O', () => {
  test('readChangelogFile returns empty array for missing file', () => {
    expect(readChangelogFile(path.join(tmpDir, 'missing.yaml'))).toEqual([]);
  });

  test('writeChangelogFile creates directories and writes file', () => {
    const filePath = path.join(tmpDir, 'changelog', 'test', '2026-02.yaml');
    const entries = [{
      date: '2026-02-07T14:30:00',
      type: 'feature',
      domain: 'test',
      files: ['test.py'],
      description: 'Test entry',
      impact: []
    }];

    writeChangelogFile(filePath, entries);

    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('entries:');
    expect(content).toContain('type: feature');
  });

  test('readChangelogFile reads written file correctly', () => {
    const filePath = path.join(tmpDir, '2026-02.yaml');
    const entries = [{
      date: '2026-02-07T14:30:00',
      type: 'fix',
      domain: 'auth',
      files: ['auth/login.py'],
      description: 'Fix login bug',
      impact: ['session management affected']
    }];

    writeChangelogFile(filePath, entries);
    const read = readChangelogFile(filePath);

    expect(read).toHaveLength(1);
    expect(read[0].type).toBe('fix');
    expect(read[0].domain).toBe('auth');
    expect(read[0].description).toBe('Fix login bug');
    expect(read[0].impact).toEqual(['session management affected']);
  });

  test('writeChangelogFile enforces max entries limit', () => {
    const filePath = path.join(tmpDir, 'overflow.yaml');
    const entries = [];
    for (let i = 0; i < MAX_ENTRIES_PER_MONTH + 100; i++) {
      entries.push({
        date: `2026-02-07T${String(i).padStart(5, '0')}`,
        type: 'feature',
        domain: 'test',
        files: [`file${i}.py`],
        description: `Entry ${i}`,
        impact: []
      });
    }

    writeChangelogFile(filePath, entries);
    const read = readChangelogFile(filePath);

    expect(read.length).toBeLessThanOrEqual(MAX_ENTRIES_PER_MONTH);
  });
});

// ---------------------------------------------------------------------------
// 37. Append Entry
// ---------------------------------------------------------------------------

describe('appendEntry', () => {
  test('creates file and appends first entry', () => {
    const entry = {
      date: '2026-02-07T14:30:00',
      type: 'feature',
      domain: 'auth',
      files: ['auth/login.py'],
      description: 'Add login',
      impact: []
    };

    const date = new Date('2026-02-07T14:30:00Z');
    const result = appendEntry(tmpDir, entry, date);

    expect(result.totalEntries).toBe(1);
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  test('appends to existing entries', () => {
    const date = new Date('2026-02-07T14:30:00Z');

    appendEntry(tmpDir, {
      date: '2026-02-07T10:00:00',
      type: 'feature',
      domain: 'auth',
      files: ['auth/login.py'],
      description: 'Add login',
      impact: []
    }, date);

    const result = appendEntry(tmpDir, {
      date: '2026-02-07T11:00:00',
      type: 'fix',
      domain: 'auth',
      files: ['auth/login.py'],
      description: 'Fix login',
      impact: []
    }, date);

    expect(result.totalEntries).toBe(2);

    const entries = readChangelogFile(result.filePath);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('feature');
    expect(entries[1].type).toBe('fix');
  });
});

// ---------------------------------------------------------------------------
// 38. Relative Path Resolution
// ---------------------------------------------------------------------------

describe('toRelativePath', () => {
  test('returns relative path for absolute path in project', () => {
    const originalCwd = process.cwd();
    const result = toRelativePath(path.join(originalCwd, 'app/main.py'));
    expect(result).toBe(path.join('app', 'main.py'));
  });

  test('returns path as-is for relative path', () => {
    expect(toRelativePath('app/main.py')).toBe('app/main.py');
  });

  test('returns empty for null/empty', () => {
    expect(toRelativePath('')).toBe('');
    expect(toRelativePath(null)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 39. Entry Builder
// ---------------------------------------------------------------------------

describe('buildEntry', () => {
  test('builds complete entry for new file', () => {
    const entry = buildEntry({
      filePath: 'src/domains/order/services/discount_service.py',
      newContent: 'class DiscountService:\n    pass\n',
      toolName: 'Write',
      date: new Date('2026-02-07T14:30:00Z')
    });

    expect(entry.date).toBe('2026-02-07T14:30:00');
    expect(entry.type).toBe('feature');
    expect(entry.domain).toBe('order');
    expect(entry.files).toEqual(['src/domains/order/services/discount_service.py']);
    expect(entry.description).toBeTruthy();
  });

  test('builds entry for test file', () => {
    const entry = buildEntry({
      filePath: 'tests/test_auth.py',
      newContent: 'def test_login(): pass\n',
      toolName: 'Write',
      date: new Date('2026-02-07T14:30:00Z')
    });

    expect(entry.type).toBe('test');
  });

  test('builds entry for doc file', () => {
    const entry = buildEntry({
      filePath: 'docs/api.md',
      newContent: '# API\n',
      toolName: 'Write',
      date: new Date('2026-02-07T14:30:00Z')
    });

    expect(entry.type).toBe('docs');
  });

  test('builds entry for edit operation', () => {
    const entry = buildEntry({
      filePath: 'app/services/order.py',
      oldString: 'def old_name():',
      newString: 'def new_name():',
      toolName: 'Edit',
      date: new Date('2026-02-07T14:30:00Z')
    });

    expect(entry.domain).toBeTruthy();
    expect(entry.files).toEqual(['app/services/order.py']);
  });

  test('uses current date when not provided', () => {
    const entry = buildEntry({
      filePath: 'app/main.py',
      toolName: 'Write'
    });

    expect(entry.date).toBeTruthy();
    // Should be ISO format without milliseconds
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// 40. Report Formatting
// ---------------------------------------------------------------------------

describe('formatRecordingReport', () => {
  test('formats a complete report', () => {
    const entry = {
      type: 'feature',
      domain: 'order',
      files: ['order/services/discount_service.py'],
      description: 'Add discount service',
      impact: ['member-api dependency added']
    };

    const report = formatRecordingReport(entry, '.claude/changelog/2026-02.yaml', 5);

    expect(report).toContain('[Changelog Recorded]');
    expect(report).toContain('Type: feature');
    expect(report).toContain('Domain: order');
    expect(report).toContain('discount_service.py');
    expect(report).toContain('member-api dependency added');
    expect(report).toContain('Total entries this month: 5');
  });

  test('handles entry with no impact', () => {
    const entry = {
      type: 'refactor',
      domain: 'root',
      files: ['main.py'],
      description: 'Refactor main',
      impact: []
    };

    const report = formatRecordingReport(entry, 'changelog.yaml', 1);
    expect(report).toContain('[Changelog Recorded]');
    expect(report).not.toContain('Impact:');
  });

  test('returns empty for null entry', () => {
    expect(formatRecordingReport(null, '', 0)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 41. File Skip Logic
// ---------------------------------------------------------------------------

describe('shouldSkipFile', () => {
  test('skips null/empty paths', () => {
    expect(shouldSkipFile(null)).toBe(true);
    expect(shouldSkipFile('')).toBe(true);
  });

  test('skips changelog directory files', () => {
    expect(shouldSkipFile('.claude/changelog/2026-02.yaml')).toBe(true);
  });

  test('skips hidden directory files', () => {
    expect(shouldSkipFile('.git/config')).toBe(true);
    expect(shouldSkipFile('.vscode/settings.json')).toBe(true);
  });

  test('skips lock files', () => {
    expect(shouldSkipFile('package-lock.json')).toBe(true);
    expect(shouldSkipFile('yarn.lock')).toBe(true);
    expect(shouldSkipFile('poetry.lock')).toBe(true);
    expect(shouldSkipFile('Pipfile.lock')).toBe(true);
    expect(shouldSkipFile('pnpm-lock.yaml')).toBe(true);
  });

  test('skips build/dist directories', () => {
    expect(shouldSkipFile('dist/main.js')).toBe(true);
    expect(shouldSkipFile('build/output.js')).toBe(true);
    expect(shouldSkipFile('coverage/lcov.info')).toBe(true);
  });

  test('skips node_modules', () => {
    expect(shouldSkipFile('node_modules/express/index.js')).toBe(true);
  });

  test('skips __pycache__', () => {
    expect(shouldSkipFile('__pycache__/main.cpython-311.pyc')).toBe(true);
  });

  test('skips binary files', () => {
    expect(shouldSkipFile('assets/logo.png')).toBe(true);
    expect(shouldSkipFile('fonts/arial.woff2')).toBe(true);
    expect(shouldSkipFile('archive.zip')).toBe(true);
  });

  test('skips minified files', () => {
    expect(shouldSkipFile('dist/app.min.js')).toBe(true);
    expect(shouldSkipFile('styles.min.css')).toBe(true);
  });

  test('skips .pyc files', () => {
    expect(shouldSkipFile('module.pyc')).toBe(true);
  });

  test('does NOT skip regular source files', () => {
    expect(shouldSkipFile('app/main.py')).toBe(false);
    expect(shouldSkipFile('src/index.ts')).toBe(false);
    expect(shouldSkipFile('app/services/auth.py')).toBe(false);
  });

  test('does NOT skip test files', () => {
    expect(shouldSkipFile('tests/test_auth.py')).toBe(false);
    expect(shouldSkipFile('__tests__/auth.test.js')).toBe(false);
  });

  test('does NOT skip doc files', () => {
    expect(shouldSkipFile('README.md')).toBe(false);
    expect(shouldSkipFile('docs/api.rst')).toBe(false);
  });

  test('does NOT skip config files', () => {
    expect(shouldSkipFile('config/settings.yaml')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 42. Roundtrip: Serialize -> Parse
// ---------------------------------------------------------------------------

describe('roundtrip serialization', () => {
  test('single entry roundtrip preserves data', () => {
    const original = {
      date: '2026-02-07T14:30:00',
      type: 'feature',
      domain: 'order',
      files: ['order/services/discount_service.py'],
      description: 'Add discount service',
      impact: ['member-api dependency added']
    };

    const yaml = serializeChangelog([original]);
    const parsed = parseChangelog(yaml);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].date).toBe(original.date);
    expect(parsed[0].type).toBe(original.type);
    expect(parsed[0].domain).toBe(original.domain);
    expect(parsed[0].files).toEqual(original.files);
    expect(parsed[0].description).toBe(original.description);
    expect(parsed[0].impact).toEqual(original.impact);
  });

  test('multiple entries roundtrip preserves order', () => {
    const entries = [
      {
        date: '2026-02-07T10:00:00',
        type: 'feature',
        domain: 'auth',
        files: ['auth/login.py'],
        description: 'Add login',
        impact: []
      },
      {
        date: '2026-02-07T11:00:00',
        type: 'fix',
        domain: 'order',
        files: ['order/cart.py'],
        description: 'Fix cart total',
        impact: ['pricing affected', 'tax calculation changed']
      },
      {
        date: '2026-02-07T12:00:00',
        type: 'test',
        domain: 'root',
        files: ['tests/test_main.py'],
        description: 'Add main tests',
        impact: []
      }
    ];

    const yaml = serializeChangelog(entries);
    const parsed = parseChangelog(yaml);

    expect(parsed).toHaveLength(3);
    for (let i = 0; i < entries.length; i++) {
      expect(parsed[i].date).toBe(entries[i].date);
      expect(parsed[i].type).toBe(entries[i].type);
      expect(parsed[i].domain).toBe(entries[i].domain);
    }
  });

  test('roundtrip with special characters in description', () => {
    const original = {
      date: '2026-02-07T14:30:00',
      type: 'feature',
      domain: 'order',
      files: ['order.py'],
      description: 'Add discount: member grade support (10% off)',
      impact: ['pricing: recalculation needed']
    };

    const yaml = serializeChangelog([original]);
    const parsed = parseChangelog(yaml);

    expect(parsed[0].description).toBe(original.description);
    expect(parsed[0].impact[0]).toBe(original.impact[0]);
  });

  test('roundtrip via file I/O', () => {
    const filePath = path.join(tmpDir, 'roundtrip.yaml');
    const original = [{
      date: '2026-02-07T14:30:00',
      type: 'feature',
      domain: 'auth',
      files: ['auth/login.py', 'auth/register.py'],
      description: 'Auth module setup',
      impact: ['session management', 'JWT dependency']
    }];

    writeChangelogFile(filePath, original);
    const read = readChangelogFile(filePath);

    expect(read).toHaveLength(1);
    expect(read[0].files).toEqual(original[0].files);
    expect(read[0].impact).toEqual(original[0].impact);
  });
});

// ---------------------------------------------------------------------------
// 43. Edge Cases and Error Handling
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  test('extractDomain handles deeply nested paths', () => {
    const domain = extractDomain('src/domains/payment/services/v2/stripe/handler.py');
    expect(domain).toBe('payment');
  });

  test('extractDomain handles hyphenated domain names', () => {
    const domain = extractDomain('packages/user-management/src/index.ts');
    expect(domain).toBe('user-management');
  });

  test('detectChangeType handles non-string filePath gracefully', () => {
    // Should not throw
    expect(() => detectChangeType({ filePath: 123 })).not.toThrow();
  });

  test('buildEntry handles missing params', () => {
    const entry = buildEntry({});
    expect(entry.date).toBeTruthy();
    expect(entry.domain).toBe('root');
    expect(entry.files).toEqual([undefined]);
  });

  test('parseChangelog handles malformed YAML gracefully', () => {
    const malformed = 'this is not yaml at all\njust random text\n';
    const result = parseChangelog(malformed);
    // Should not throw, returns empty or partial results
    expect(Array.isArray(result)).toBe(true);
  });

  test('readChangelogFile handles corrupted file', () => {
    const filePath = path.join(tmpDir, 'corrupted.yaml');
    fs.writeFileSync(filePath, '{{{{invalid yaml}}}}', 'utf8');
    const result = readChangelogFile(filePath);
    expect(Array.isArray(result)).toBe(true);
  });

  test('serializeEntry handles missing fields gracefully', () => {
    const entry = { date: '2026-01-01', type: 'feature' };
    // Should not throw
    const yaml = serializeEntry(entry);
    expect(yaml).toContain('date:');
    expect(yaml).toContain('type: feature');
  });

  test('shouldSkipFile handles path with spaces', () => {
    expect(shouldSkipFile('app/my service/main.py')).toBe(false);
  });

  test('detectImpact returns empty array for missing params', () => {
    expect(detectImpact(null)).toEqual([]);
    expect(detectImpact({})).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 44. Integration: Complete Pipeline
// ---------------------------------------------------------------------------

describe('integration - complete pipeline', () => {
  test('Write tool: new feature file -> entry -> file -> read back', () => {
    const entry = buildEntry({
      filePath: 'src/domains/order/services/discount_service.py',
      newContent: [
        'from app.services.member import MemberService',
        '',
        'class DiscountService:',
        '    def calculate_discount(self, member_grade: str) -> float:',
        '        pass',
        ''
      ].join('\n'),
      toolName: 'Write',
      date: new Date('2026-02-07T14:30:00Z')
    });

    // Verify entry fields
    expect(entry.type).toBe('feature');
    expect(entry.domain).toBe('order');
    expect(entry.files).toEqual(['src/domains/order/services/discount_service.py']);
    expect(entry.impact.length).toBeGreaterThan(0);

    // Write and read back
    const result = appendEntry(tmpDir, entry, new Date('2026-02-07T14:30:00Z'));
    const entries = readChangelogFile(result.filePath);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('feature');
    expect(entries[0].domain).toBe('order');
  });

  test('Edit tool: bug fix -> entry with fix type', () => {
    const entry = buildEntry({
      filePath: 'app/services/order.py',
      oldContent: 'def get_total():\n    return sum(items)\n',
      newContent: '# Fixed: handle empty items list\ndef get_total():\n    if not items:\n        return 0\n    return sum(items)\n',
      oldString: 'def get_total():\n    return sum(items)',
      newString: '# Fixed: handle empty items list\ndef get_total():\n    if not items:\n        return 0\n    return sum(items)',
      toolName: 'Edit',
      date: new Date('2026-02-07T15:00:00Z')
    });

    expect(entry.type).toBe('fix');
  });

  test('multiple operations build monthly changelog', () => {
    const date = new Date('2026-02-07T14:30:00Z');

    // Operation 1: New feature
    appendEntry(tmpDir, buildEntry({
      filePath: 'src/domains/auth/services/login.py',
      newContent: 'class LoginService:\n    pass\n',
      toolName: 'Write',
      date
    }), date);

    // Operation 2: Fix
    appendEntry(tmpDir, buildEntry({
      filePath: 'src/domains/auth/services/login.py',
      oldContent: 'class LoginService:\n    pass\n',
      newContent: '# Fixed validation\nclass LoginService:\n    def validate(self): pass\n',
      toolName: 'Edit',
      date: new Date('2026-02-07T15:00:00Z')
    }), date);

    // Operation 3: Test
    appendEntry(tmpDir, buildEntry({
      filePath: 'tests/test_login.py',
      newContent: 'def test_login(): pass\n',
      toolName: 'Write',
      date: new Date('2026-02-07T16:00:00Z')
    }), date);

    // Verify
    const filePath = getChangelogFilePath(tmpDir, date);
    const entries = readChangelogFile(filePath);

    expect(entries).toHaveLength(3);
    expect(entries[0].type).toBe('feature');
    expect(entries[1].type).toBe('fix');
    expect(entries[2].type).toBe('test');
  });

  test('report formatting for recorded entry', () => {
    const entry = buildEntry({
      filePath: 'src/domains/order/services/discount_service.py',
      newContent: 'from app.services.member import MemberService\n\nclass DiscountService:\n    pass\n',
      toolName: 'Write',
      date: new Date('2026-02-07T14:30:00Z')
    });

    const report = formatRecordingReport(
      entry,
      '.claude/changelog/2026-02.yaml',
      1
    );

    expect(report).toContain('[Changelog Recorded]');
    expect(report).toContain('order');
    expect(report).toContain('discount_service');
  });

  test('skipped files do not generate entries', () => {
    // Simulate the skip check that main() would do
    const skippedPaths = [
      '.claude/changelog/2026-02.yaml',
      'node_modules/express/index.js',
      'package-lock.json',
      'dist/bundle.js',
      'logo.png'
    ];

    for (const filePath of skippedPaths) {
      expect(shouldSkipFile(filePath)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 45. Constants and Configuration
// ---------------------------------------------------------------------------

describe('configuration constants', () => {
  test('CHANGELOG_DIR is set', () => {
    expect(CHANGELOG_DIR).toBe('.claude/changelog');
  });

  test('DOMAIN_PATTERNS has entries', () => {
    expect(DOMAIN_PATTERNS.length).toBeGreaterThan(0);
  });

  test('EXTENDED_DOMAIN_PATTERNS has entries', () => {
    expect(EXTENDED_DOMAIN_PATTERNS.length).toBeGreaterThan(0);
  });

  test('SOURCE_EXTENSIONS contains common types', () => {
    expect(SOURCE_EXTENSIONS.has('.py')).toBe(true);
    expect(SOURCE_EXTENSIONS.has('.js')).toBe(true);
    expect(SOURCE_EXTENSIONS.has('.ts')).toBe(true);
  });

  test('DOC_EXTENSIONS contains common types', () => {
    expect(DOC_EXTENSIONS.has('.md')).toBe(true);
    expect(DOC_EXTENSIONS.has('.rst')).toBe(true);
  });

  test('CONFIG_EXTENSIONS contains common types', () => {
    expect(CONFIG_EXTENSIONS.has('.yaml')).toBe(true);
    expect(CONFIG_EXTENSIONS.has('.json')).toBe(true);
  });

  test('MAX_ENTRIES_PER_MONTH is a reasonable number', () => {
    expect(MAX_ENTRIES_PER_MONTH).toBeGreaterThan(100);
    expect(MAX_ENTRIES_PER_MONTH).toBeLessThanOrEqual(10000);
  });
});
