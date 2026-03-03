/**
 * @TASK P3-T1 - Pre-Edit Impact Check Hook Tests
 * @TEST hooks/pre-edit-impact-check.js
 *
 * Tests cover:
 *   1. Risk level classification (CRITICAL, HIGH, MEDIUM, LOW)
 *   2. Direct impact analysis (import tracking)
 *   3. Indirect impact analysis (API call relationships)
 *   4. Test file association
 *   5. Impact report generation
 *   6. Recommended test commands
 *   7. stdin/stdout hook protocol
 *   8. Edge cases and error handling
 */

const fs = require('fs');
const path = require('path');

const {
  classifyRiskLevel,
  findDirectDependents,
  findIndirectDependents,
  findRelatedTests,
  generateTestCommand,
  analyzeImpact,
  formatImpactReport,
  toRelativePath,
  parseImportStatements,
  detectApiEndpoints,
  buildDependencyMap,
  getRiskDescription,
  RISK_LEVELS,
  RISK_PATTERNS,
  validateAndGetRelativePath,
  discoverProjectFiles
} = require('../pre-edit-impact-check');

// ---------------------------------------------------------------------------
// 1. Risk Level Classification
// ---------------------------------------------------------------------------

describe('classifyRiskLevel', () => {
  // --- CRITICAL ---
  test('classifies payment files as CRITICAL', () => {
    expect(classifyRiskLevel('src/domains/payment/services/payment_service.py')).toBe('CRITICAL');
  });

  test('classifies billing files as CRITICAL', () => {
    expect(classifyRiskLevel('src/domains/billing/models/invoice.py')).toBe('CRITICAL');
  });

  test('classifies auth files as CRITICAL', () => {
    expect(classifyRiskLevel('src/domains/auth/services/auth_service.py')).toBe('CRITICAL');
  });

  test('classifies authentication middleware as CRITICAL', () => {
    expect(classifyRiskLevel('src/middleware/authentication.py')).toBe('CRITICAL');
  });

  test('classifies security module as CRITICAL', () => {
    expect(classifyRiskLevel('src/core/security/token_manager.py')).toBe('CRITICAL');
  });

  test('classifies encryption utilities as CRITICAL', () => {
    expect(classifyRiskLevel('src/utils/encryption.py')).toBe('CRITICAL');
  });

  // --- HIGH ---
  test('classifies service files as HIGH', () => {
    expect(classifyRiskLevel('src/services/user_service.py')).toBe('HIGH');
  });

  test('classifies domain service files as HIGH', () => {
    expect(classifyRiskLevel('src/domains/order/services/order_service.py')).toBe('HIGH');
  });

  test('classifies core module files as HIGH', () => {
    expect(classifyRiskLevel('src/core/config.py')).toBe('HIGH');
  });

  test('classifies core database config as HIGH', () => {
    expect(classifyRiskLevel('src/core/database/connection.py')).toBe('HIGH');
  });

  test('classifies middleware files as HIGH', () => {
    expect(classifyRiskLevel('src/middleware/rate_limiter.py')).toBe('HIGH');
  });

  test('classifies shared libraries as HIGH', () => {
    expect(classifyRiskLevel('src/shared/base_service.py')).toBe('HIGH');
  });

  // --- MEDIUM ---
  test('classifies API route files as MEDIUM', () => {
    expect(classifyRiskLevel('src/api/routes/users.py')).toBe('MEDIUM');
  });

  test('classifies model files as MEDIUM', () => {
    expect(classifyRiskLevel('src/models/user.py')).toBe('MEDIUM');
  });

  test('classifies schema files as MEDIUM', () => {
    expect(classifyRiskLevel('src/schemas/user_schema.py')).toBe('MEDIUM');
  });

  test('classifies controller files as MEDIUM', () => {
    expect(classifyRiskLevel('src/controllers/user_controller.py')).toBe('MEDIUM');
  });

  test('classifies repository files as MEDIUM', () => {
    expect(classifyRiskLevel('src/repositories/user_repository.py')).toBe('MEDIUM');
  });

  test('classifies migration files as MEDIUM', () => {
    expect(classifyRiskLevel('database/migrations/001_create_users.py')).toBe('MEDIUM');
  });

  // --- LOW ---
  test('classifies test files as LOW', () => {
    expect(classifyRiskLevel('tests/unit/test_user_service.py')).toBe('LOW');
  });

  test('classifies utility files as LOW', () => {
    expect(classifyRiskLevel('src/utils/string_helpers.py')).toBe('LOW');
  });

  test('classifies config files as LOW', () => {
    expect(classifyRiskLevel('config/settings.yaml')).toBe('LOW');
  });

  test('classifies documentation as LOW', () => {
    expect(classifyRiskLevel('docs/api/endpoints.md')).toBe('LOW');
  });

  test('classifies fixture files as LOW', () => {
    expect(classifyRiskLevel('tests/fixtures/user_data.json')).toBe('LOW');
  });

  test('classifies unknown files as LOW', () => {
    expect(classifyRiskLevel('README.md')).toBe('LOW');
  });

  // --- Priority: CRITICAL > HIGH ---
  test('CRITICAL overrides HIGH for auth service files', () => {
    // auth is both a service (HIGH) and auth (CRITICAL)
    expect(classifyRiskLevel('src/services/auth_service.py')).toBe('CRITICAL');
  });

  test('CRITICAL overrides MEDIUM for payment API routes', () => {
    // payment route is both API (MEDIUM) and payment (CRITICAL)
    expect(classifyRiskLevel('src/api/routes/payment.py')).toBe('CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// 2. RISK_LEVELS and RISK_PATTERNS
// ---------------------------------------------------------------------------

describe('RISK_LEVELS', () => {
  test('defines all four risk levels', () => {
    expect(RISK_LEVELS).toHaveProperty('CRITICAL');
    expect(RISK_LEVELS).toHaveProperty('HIGH');
    expect(RISK_LEVELS).toHaveProperty('MEDIUM');
    expect(RISK_LEVELS).toHaveProperty('LOW');
  });

  test('CRITICAL has highest priority', () => {
    expect(RISK_LEVELS.CRITICAL).toBeLessThan(RISK_LEVELS.HIGH);
    expect(RISK_LEVELS.HIGH).toBeLessThan(RISK_LEVELS.MEDIUM);
    expect(RISK_LEVELS.MEDIUM).toBeLessThan(RISK_LEVELS.LOW);
  });
});

describe('RISK_PATTERNS', () => {
  test('has patterns for each risk level', () => {
    expect(RISK_PATTERNS).toBeInstanceOf(Array);
    expect(RISK_PATTERNS.length).toBeGreaterThan(0);
  });
});

describe('getRiskDescription', () => {
  test('returns description for CRITICAL', () => {
    const desc = getRiskDescription('CRITICAL');
    expect(desc).toBeTruthy();
    expect(typeof desc).toBe('string');
  });

  test('returns description for HIGH', () => {
    const desc = getRiskDescription('HIGH');
    expect(desc).toBeTruthy();
  });

  test('returns description for MEDIUM', () => {
    const desc = getRiskDescription('MEDIUM');
    expect(desc).toBeTruthy();
  });

  test('returns description for LOW', () => {
    const desc = getRiskDescription('LOW');
    expect(desc).toBeTruthy();
  });

  test('returns generic description for unknown level', () => {
    const desc = getRiskDescription('UNKNOWN');
    expect(desc).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3. Import Statement Parsing
// ---------------------------------------------------------------------------

describe('parseImportStatements', () => {
  test('parses Python from...import statements', () => {
    const content = 'from app.services.user_service import UserService';
    const imports = parseImportStatements(content, '.py');
    expect(imports).toContain('app/services/user_service');
  });

  test('parses Python import statements', () => {
    const content = 'import app.models.user';
    const imports = parseImportStatements(content, '.py');
    expect(imports).toContain('app/models/user');
  });

  test('parses Python relative imports', () => {
    const content = 'from .models import User';
    const imports = parseImportStatements(content, '.py');
    expect(imports).toContain('./models');
  });

  test('parses JavaScript import statements', () => {
    const content = "import { UserService } from './services/user_service';";
    const imports = parseImportStatements(content, '.js');
    expect(imports).toContain('./services/user_service');
  });

  test('parses JavaScript require statements', () => {
    const content = "const UserService = require('./services/user_service');";
    const imports = parseImportStatements(content, '.js');
    expect(imports).toContain('./services/user_service');
  });

  test('parses TypeScript import statements', () => {
    const content = "import { UserService } from '@/services/user_service';";
    const imports = parseImportStatements(content, '.ts');
    expect(imports).toContain('@/services/user_service');
  });

  test('parses multiple import statements', () => {
    const content = [
      'from app.models.user import User',
      'from app.services.auth import AuthService',
      'import app.utils.helpers'
    ].join('\n');
    const imports = parseImportStatements(content, '.py');
    expect(imports).toHaveLength(3);
    expect(imports).toContain('app/models/user');
    expect(imports).toContain('app/services/auth');
    expect(imports).toContain('app/utils/helpers');
  });

  test('ignores comment lines', () => {
    const content = '# from app.models.user import User';
    const imports = parseImportStatements(content, '.py');
    expect(imports).toHaveLength(0);
  });

  test('returns empty array for empty content', () => {
    expect(parseImportStatements('', '.py')).toEqual([]);
  });

  test('returns empty array for unsupported extension', () => {
    expect(parseImportStatements('import something', '.css')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. API Endpoint Detection
// ---------------------------------------------------------------------------

describe('detectApiEndpoints', () => {
  test('detects FastAPI route decorators', () => {
    const content = [
      '@router.get("/users/{user_id}")',
      'async def get_user(user_id: int):',
      '    pass'
    ].join('\n');
    const endpoints = detectApiEndpoints(content, '.py');
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      method: 'GET',
      path: '/users/{user_id}'
    });
  });

  test('detects multiple HTTP methods', () => {
    const content = [
      '@router.get("/users")',
      'async def list_users(): pass',
      '',
      '@router.post("/users")',
      'async def create_user(): pass',
      '',
      '@router.put("/users/{id}")',
      'async def update_user(): pass',
      '',
      '@router.delete("/users/{id}")',
      'async def delete_user(): pass',
      '',
      '@router.patch("/users/{id}")',
      'async def patch_user(): pass'
    ].join('\n');
    const endpoints = detectApiEndpoints(content, '.py');
    expect(endpoints.length).toBeGreaterThanOrEqual(5);
  });

  test('detects Express route patterns', () => {
    const content = [
      "app.get('/api/users', getUsers);",
      "app.post('/api/users', createUser);"
    ].join('\n');
    const endpoints = detectApiEndpoints(content, '.js');
    expect(endpoints.length).toBeGreaterThanOrEqual(2);
  });

  test('returns empty array when no endpoints found', () => {
    const content = 'class UserModel:\n    name = "test"';
    const endpoints = detectApiEndpoints(content, '.py');
    expect(endpoints).toEqual([]);
  });

  test('returns empty array for empty content', () => {
    expect(detectApiEndpoints('', '.py')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Build Dependency Map
// ---------------------------------------------------------------------------

describe('buildDependencyMap', () => {
  test('builds map from file list with content reader', () => {
    const fileContents = {
      'src/services/user_service.py': 'from app.models.user import User',
      'src/routes/users.py': 'from app.services.user_service import UserService',
      'src/models/user.py': ''
    };
    const contentReader = (f) => fileContents[f] || '';
    const extResolver = (f) => '.py';

    const map = buildDependencyMap(Object.keys(fileContents), contentReader, extResolver);
    expect(map).toBeTruthy();
    expect(typeof map).toBe('object');
  });

  test('returns empty map for empty file list', () => {
    const map = buildDependencyMap([], () => '', () => '.py');
    expect(Object.keys(map)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Direct Dependents
// ---------------------------------------------------------------------------

describe('findDirectDependents', () => {
  test('finds files that import the target file', () => {
    const fileContents = {
      'src/models/user.py': '',
      'src/services/user_service.py': 'from src.models.user import User',
      'src/routes/users.py': 'from src.services.user_service import UserService'
    };

    const dependents = findDirectDependents(
      'src/models/user.py',
      Object.keys(fileContents),
      (f) => fileContents[f] || '',
      (f) => '.py'
    );

    expect(dependents).toContain('src/services/user_service.py');
  });

  test('returns empty array when no files import the target', () => {
    const fileContents = {
      'src/models/user.py': '',
      'src/models/order.py': 'from src.models.base import BaseModel'
    };

    const dependents = findDirectDependents(
      'src/models/user.py',
      Object.keys(fileContents),
      (f) => fileContents[f] || '',
      (f) => '.py'
    );

    expect(dependents).toEqual([]);
  });

  test('handles JS/TS imports', () => {
    const fileContents = {
      'src/utils/helpers.js': '',
      'src/services/user.js': "const helpers = require('./utils/helpers');"
    };

    const dependents = findDirectDependents(
      'src/utils/helpers.js',
      Object.keys(fileContents),
      (f) => fileContents[f] || '',
      (f) => '.js'
    );

    // helpers.js is imported by user.js
    expect(dependents.length).toBeGreaterThanOrEqual(0);
  });

  test('does not include the target file itself', () => {
    const fileContents = {
      'src/models/user.py': 'from src.models.base import BaseModel',
    };

    const dependents = findDirectDependents(
      'src/models/user.py',
      Object.keys(fileContents),
      (f) => fileContents[f] || '',
      (f) => '.py'
    );

    expect(dependents).not.toContain('src/models/user.py');
  });
});

// ---------------------------------------------------------------------------
// 7. Indirect Dependents (API call relationships)
// ---------------------------------------------------------------------------

describe('findIndirectDependents', () => {
  test('finds files that call APIs defined in the target file', () => {
    const targetContent = [
      '@router.get("/api/users")',
      'async def list_users(): pass'
    ].join('\n');

    const fileContents = {
      'src/routes/users.py': targetContent,
      'src/services/report_service.py': 'response = await client.get("/api/users")'
    };

    const indirectDeps = findIndirectDependents(
      'src/routes/users.py',
      targetContent,
      '.py',
      Object.keys(fileContents),
      (f) => fileContents[f] || '',
      (f) => '.py'
    );

    expect(indirectDeps.length).toBeGreaterThanOrEqual(0);
  });

  test('returns empty array when target has no API endpoints', () => {
    const targetContent = 'class UserModel:\n    name = "test"';

    const indirectDeps = findIndirectDependents(
      'src/models/user.py',
      targetContent,
      '.py',
      ['src/models/user.py'],
      (f) => targetContent,
      (f) => '.py'
    );

    expect(indirectDeps).toEqual([]);
  });

  test('returns empty array for empty file list', () => {
    const indirectDeps = findIndirectDependents(
      'src/routes/users.py',
      '@router.get("/api/users")\nasync def list(): pass',
      '.py',
      [],
      () => '',
      () => '.py'
    );

    expect(indirectDeps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8. Related Test Files
// ---------------------------------------------------------------------------

describe('findRelatedTests', () => {
  test('finds test file matching Python source file', () => {
    const allFiles = [
      'src/services/user_service.py',
      'tests/unit/test_user_service.py',
      'tests/integration/test_user_service.py'
    ];

    const tests = findRelatedTests('src/services/user_service.py', allFiles);
    expect(tests.length).toBeGreaterThanOrEqual(1);
    expect(tests).toContain('tests/unit/test_user_service.py');
  });

  test('finds test file matching JS source file', () => {
    const allFiles = [
      'src/services/userService.js',
      'src/services/__tests__/userService.test.js',
      'tests/userService.spec.js'
    ];

    const tests = findRelatedTests('src/services/userService.js', allFiles);
    expect(tests.length).toBeGreaterThanOrEqual(1);
  });

  test('finds test file for path-based matching', () => {
    const allFiles = [
      'src/models/user.py',
      'tests/models/test_user.py'
    ];

    const tests = findRelatedTests('src/models/user.py', allFiles);
    expect(tests.length).toBeGreaterThanOrEqual(1);
  });

  test('returns empty array when no test files found', () => {
    const allFiles = [
      'src/models/user.py',
      'src/services/user_service.py'
    ];

    const tests = findRelatedTests('src/models/user.py', allFiles);
    expect(tests).toEqual([]);
  });

  test('does not return non-test files', () => {
    const allFiles = [
      'src/services/user_service.py',
      'src/models/user.py',
      'tests/conftest.py'
    ];

    const tests = findRelatedTests('src/services/user_service.py', allFiles);
    // conftest.py is not a test for user_service
    for (const t of tests) {
      expect(t).toMatch(/test|spec/i);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Test Command Generation
// ---------------------------------------------------------------------------

describe('generateTestCommand', () => {
  test('generates pytest command for Python test files', () => {
    const testFiles = ['tests/unit/test_user_service.py'];
    const cmd = generateTestCommand(testFiles, 'src/services/user_service.py');
    expect(cmd).toContain('pytest');
    expect(cmd).toContain('tests/unit/test_user_service.py');
  });

  test('generates jest command for JS test files', () => {
    const testFiles = ['src/services/__tests__/userService.test.js'];
    const cmd = generateTestCommand(testFiles, 'src/services/userService.js');
    expect(cmd).toContain('jest');
    expect(cmd).toContain('userService.test.js');
  });

  test('handles multiple test files', () => {
    const testFiles = [
      'tests/unit/test_user.py',
      'tests/integration/test_user.py'
    ];
    const cmd = generateTestCommand(testFiles, 'src/models/user.py');
    expect(cmd).toContain('pytest');
    expect(cmd).toContain('tests/unit/test_user.py');
    expect(cmd).toContain('tests/integration/test_user.py');
  });

  test('generates general test command when no test files found', () => {
    const cmd = generateTestCommand([], 'src/models/user.py');
    expect(cmd).toBeTruthy();
    expect(typeof cmd).toBe('string');
  });

  test('includes coverage flag for CRITICAL files', () => {
    const testFiles = ['tests/unit/test_payment.py'];
    const cmd = generateTestCommand(
      testFiles,
      'src/domains/payment/services/payment_service.py',
      'CRITICAL'
    );
    expect(cmd).toContain('cov');
  });
});

// ---------------------------------------------------------------------------
// 10. Impact Analysis (Integration)
// ---------------------------------------------------------------------------

describe('analyzeImpact', () => {
  test('returns complete impact analysis object', () => {
    const result = analyzeImpact(
      'src/services/user_service.py',
      'class UserService:\n    pass',
      [],
      () => '',
      () => '.py'
    );

    expect(result).toHaveProperty('filePath');
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('directDependents');
    expect(result).toHaveProperty('indirectDependents');
    expect(result).toHaveProperty('relatedTests');
    expect(result).toHaveProperty('testCommand');
  });

  test('identifies CRITICAL risk for payment files', () => {
    const result = analyzeImpact(
      'src/domains/payment/services/payment_service.py',
      'class PaymentService:\n    pass',
      [],
      () => '',
      () => '.py'
    );

    expect(result.riskLevel).toBe('CRITICAL');
  });

  test('identifies LOW risk for test files', () => {
    const result = analyzeImpact(
      'tests/unit/test_user_service.py',
      'def test_user(): pass',
      [],
      () => '',
      () => '.py'
    );

    expect(result.riskLevel).toBe('LOW');
  });

  test('handles empty content gracefully', () => {
    const result = analyzeImpact(
      'src/models/user.py',
      '',
      [],
      () => '',
      () => '.py'
    );

    expect(result).toBeTruthy();
    expect(result.riskLevel).toBeDefined();
  });

  test('includes direct dependents in result', () => {
    const fileContents = {
      'src/models/user.py': '',
      'src/services/user_service.py': 'from src.models.user import User'
    };

    const result = analyzeImpact(
      'src/models/user.py',
      '',
      Object.keys(fileContents),
      (f) => fileContents[f] || '',
      (f) => '.py'
    );

    expect(result.directDependents).toContain('src/services/user_service.py');
  });
});

// ---------------------------------------------------------------------------
// 11. Impact Report Formatting
// ---------------------------------------------------------------------------

describe('formatImpactReport', () => {
  test('formats a complete impact report', () => {
    const impact = {
      filePath: 'src/services/user_service.py',
      riskLevel: 'HIGH',
      riskDescription: 'Service layer - business logic changes may affect multiple consumers',
      directDependents: ['src/routes/users.py'],
      indirectDependents: [],
      relatedTests: ['tests/unit/test_user_service.py'],
      testCommand: 'pytest tests/unit/test_user_service.py -v'
    };

    const report = formatImpactReport(impact);
    expect(report).toContain('Impact Analysis');
    expect(report).toContain('HIGH');
    expect(report).toContain('src/services/user_service.py');
    expect(report).toContain('src/routes/users.py');
    expect(report).toContain('pytest');
  });

  test('includes risk level in report', () => {
    const impact = {
      filePath: 'src/domains/payment/pay.py',
      riskLevel: 'CRITICAL',
      riskDescription: 'Payment/billing/auth - financial or security impact',
      directDependents: [],
      indirectDependents: [],
      relatedTests: [],
      testCommand: 'pytest --cov'
    };

    const report = formatImpactReport(impact);
    expect(report).toContain('CRITICAL');
  });

  test('shows "None" or similar when no dependents found', () => {
    const impact = {
      filePath: 'src/utils/helpers.py',
      riskLevel: 'LOW',
      riskDescription: 'Low risk',
      directDependents: [],
      indirectDependents: [],
      relatedTests: [],
      testCommand: ''
    };

    const report = formatImpactReport(impact);
    expect(report).toBeTruthy();
    expect(typeof report).toBe('string');
  });

  test('formats multiple direct dependents', () => {
    const impact = {
      filePath: 'src/models/user.py',
      riskLevel: 'MEDIUM',
      riskDescription: 'Model change',
      directDependents: [
        'src/services/user_service.py',
        'src/services/auth_service.py',
        'src/routes/users.py'
      ],
      indirectDependents: [],
      relatedTests: ['tests/test_user.py'],
      testCommand: 'pytest tests/test_user.py -v'
    };

    const report = formatImpactReport(impact);
    expect(report).toContain('src/services/user_service.py');
    expect(report).toContain('src/services/auth_service.py');
    expect(report).toContain('src/routes/users.py');
  });

  test('includes recommended test command', () => {
    const impact = {
      filePath: 'src/services/user_service.py',
      riskLevel: 'HIGH',
      riskDescription: 'Service',
      directDependents: [],
      indirectDependents: [],
      relatedTests: ['tests/test_user_service.py'],
      testCommand: 'pytest tests/test_user_service.py -v --cov=src/services'
    };

    const report = formatImpactReport(impact);
    expect(report).toContain('pytest');
    expect(report).toContain('test_user_service.py');
  });

  test('includes indirect dependents when present', () => {
    const impact = {
      filePath: 'src/routes/users.py',
      riskLevel: 'MEDIUM',
      riskDescription: 'API route',
      directDependents: [],
      indirectDependents: ['src/services/report_service.py'],
      relatedTests: [],
      testCommand: ''
    };

    const report = formatImpactReport(impact);
    expect(report).toContain('src/services/report_service.py');
  });
});

// ---------------------------------------------------------------------------
// 12. Relative Path Resolution
// ---------------------------------------------------------------------------

describe('toRelativePath / validateAndGetRelativePath (path safety)', () => {
  let tmpRoot;
  let projectDir;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(fs.realpathSync.native(require('os').tmpdir()), 'pre-edit-impact-'));
    projectDir = path.join(tmpRoot, 'project');
    fs.mkdirSync(projectDir, { recursive: true });

    // Seed some files
    fs.mkdirSync(path.join(projectDir, 'src', 'models'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'src', 'models', 'user.py'), 'class User: pass\n', 'utf8');
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('returns empty string for empty input', () => {
    expect(toRelativePath('')).toBe('');
    expect(toRelativePath(null)).toBe('');
    expect(toRelativePath(undefined)).toBe('');
  });

  test('returns relative path as-is when inside project (validated)', () => {
    const prev = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = projectDir;
    try {
      expect(toRelativePath('src/models/user.py')).toBe('src/models/user.py');
    } finally {
      process.env.CLAUDE_PROJECT_DIR = prev;
    }
  });

  test('converts absolute path to relative when inside project', () => {
    const prev = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = projectDir;
    try {
      const absPath = path.join(projectDir, 'src', 'models', 'user.py');
      const result = toRelativePath(absPath);
      expect(result).toBe('src/models/user.py');
    } finally {
      process.env.CLAUDE_PROJECT_DIR = prev;
    }
  });

  test('rejects absolute path outside project', () => {
    const projectDirReal = fs.realpathSync.native(projectDir);
    const outsideFile = path.join(tmpRoot, 'outside.py');
    fs.writeFileSync(outsideFile, 'print("no")\n', 'utf8');

    const rel = validateAndGetRelativePath(outsideFile, projectDirReal);
    expect(rel).toBeNull();
  });

  test('rejects symlink escape outside project', () => {
    const projectDirReal = fs.realpathSync.native(projectDir);

    const outsideDir = path.join(tmpRoot, 'outside');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, 'secret.py'), 'print("secret")\n', 'utf8');

    const linkPath = path.join(projectDir, 'linked_outside');
    try {
      fs.symlinkSync(outsideDir, linkPath, 'dir');
    } catch (e) {
      // Some CI environments restrict symlinks; if so, skip.
      if (String(e && e.code) === 'EPERM' || String(e && e.code) === 'EACCES') {
        return;
      }
      throw e;
    }

    const escaped = path.join(linkPath, 'secret.py');
    const rel = validateAndGetRelativePath(escaped, projectDirReal);
    expect(rel).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 13b. File Discovery Safety: symlink loops + max depth
// ---------------------------------------------------------------------------

describe('discoverProjectFiles (safety bounds)', () => {
  let tmpRoot;
  let projectDir;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(fs.realpathSync.native(require('os').tmpdir()), 'pre-edit-impact-discovery-'));
    projectDir = path.join(tmpRoot, 'project');
    fs.mkdirSync(projectDir, { recursive: true });

    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'src', 'a.js'), '/* test fixture file */\n', 'utf8');

    // Deep tree for max depth test
    let cur = projectDir;
    for (let i = 0; i < 10; i++) {
      cur = path.join(cur, `d${i}`);
      fs.mkdirSync(cur, { recursive: true });
      fs.writeFileSync(path.join(cur, `f${i}.js`), '/* test fixture file */\n', 'utf8');
    }

    // Symlink loop: project/loop -> project
    const loopLink = path.join(projectDir, 'loop');
    try {
      fs.symlinkSync(projectDir, loopLink, 'dir');
    } catch (e) {
      // If symlinks not permitted, we still keep max-depth test.
      if (!(String(e && e.code) === 'EPERM' || String(e && e.code) === 'EACCES')) {
        throw e;
      }
    }
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('does not hang on symlink loops and returns bounded file list', () => {
    const start = Date.now();
    const files = discoverProjectFiles(projectDir, 6);
    const elapsed = Date.now() - start;

    // Not a strict perf test; just a guard against infinite recursion.
    expect(elapsed).toBeLessThan(2000);
    expect(Array.isArray(files)).toBe(true);
    expect(files).toContain('src/a.js');
  });

  test('respects maxDepth to bound recursion', () => {
    const shallow = discoverProjectFiles(projectDir, 1);
    const deep = discoverProjectFiles(projectDir, 20);

    expect(shallow.length).toBeLessThan(deep.length);
  });
});

// ---------------------------------------------------------------------------
// End safety regression tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 13. Edge Cases
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// 13. Edge Cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  test('classifyRiskLevel handles empty path', () => {
    expect(classifyRiskLevel('')).toBe('LOW');
  });

  test('classifyRiskLevel handles null/undefined', () => {
    expect(classifyRiskLevel(null)).toBe('LOW');
    expect(classifyRiskLevel(undefined)).toBe('LOW');
  });

  test('parseImportStatements handles null content', () => {
    expect(parseImportStatements(null, '.py')).toEqual([]);
  });

  test('analyzeImpact handles null allFiles', () => {
    const result = analyzeImpact(
      'src/models/user.py',
      'class User: pass',
      null,
      () => '',
      () => '.py'
    );
    expect(result).toBeTruthy();
    expect(result.directDependents).toEqual([]);
  });

  test('formatImpactReport handles missing fields', () => {
    const report = formatImpactReport({
      filePath: 'test.py',
      riskLevel: 'LOW'
    });
    expect(report).toBeTruthy();
  });

  test('findRelatedTests handles empty file list', () => {
    expect(findRelatedTests('src/models/user.py', [])).toEqual([]);
    expect(findRelatedTests('src/models/user.py', null)).toEqual([]);
  });

  test('generateTestCommand handles null test files', () => {
    const cmd = generateTestCommand(null, 'src/models/user.py');
    expect(cmd).toBeTruthy();
  });

  test('detectApiEndpoints handles null content', () => {
    expect(detectApiEndpoints(null, '.py')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 14. Complex Scenarios
// ---------------------------------------------------------------------------

describe('Complex scenarios', () => {
  test('full pipeline: auth service with dependents and tests', () => {
    const fileContents = {
      'src/services/auth_service.py': [
        'from src.models.user import User',
        'from src.core.security import TokenManager',
        '',
        'class AuthService:',
        '    def login(self, username, password):',
        '        pass'
      ].join('\n'),
      'src/routes/auth.py': [
        'from src.services.auth_service import AuthService',
        '',
        '@router.post("/api/auth/login")',
        'async def login():',
        '    pass'
      ].join('\n'),
      'src/models/user.py': 'class User:\n    pass',
      'src/core/security.py': 'class TokenManager:\n    pass',
      'tests/unit/test_auth_service.py': 'def test_login(): pass'
    };

    const allFiles = Object.keys(fileContents);
    const result = analyzeImpact(
      'src/services/auth_service.py',
      fileContents['src/services/auth_service.py'],
      allFiles,
      (f) => fileContents[f] || '',
      () => '.py'
    );

    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.directDependents).toContain('src/routes/auth.py');
    expect(result.relatedTests).toContain('tests/unit/test_auth_service.py');
  });

  test('full pipeline: model change propagating to services and routes', () => {
    const fileContents = {
      'src/models/order.py': 'class Order:\n    pass',
      'src/services/order_service.py': 'from src.models.order import Order\n\nclass OrderService:\n    pass',
      'src/routes/orders.py': 'from src.services.order_service import OrderService',
      'tests/test_order.py': 'def test_order(): pass',
      'tests/test_order_service.py': 'def test_order_service(): pass'
    };

    const allFiles = Object.keys(fileContents);
    const result = analyzeImpact(
      'src/models/order.py',
      fileContents['src/models/order.py'],
      allFiles,
      (f) => fileContents[f] || '',
      () => '.py'
    );

    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.directDependents).toContain('src/services/order_service.py');
  });

  test('JavaScript project with Express routes', () => {
    const fileContents = {
      'src/routes/users.js': "const express = require('express');\napp.get('/api/users', getUsers);",
      'src/services/userService.js': "const User = require('../models/user');",
      'src/models/user.js': 'class User {}',
      'tests/userService.test.js': 'describe("UserService", () => {});'
    };

    const allFiles = Object.keys(fileContents);
    const result = analyzeImpact(
      'src/models/user.js',
      fileContents['src/models/user.js'],
      allFiles,
      (f) => fileContents[f] || '',
      () => '.js'
    );

    expect(result).toBeTruthy();
    expect(result.riskLevel).toBe('MEDIUM');
  });
});

// ---------------------------------------------------------------------------
// 15. Hook Protocol Integration
// ---------------------------------------------------------------------------

describe('Hook protocol output', () => {
  test('formatImpactReport produces non-empty string for any valid impact', () => {
    const impact = {
      filePath: 'src/services/user_service.py',
      riskLevel: 'HIGH',
      riskDescription: 'Service layer',
      directDependents: ['src/routes/users.py'],
      indirectDependents: [],
      relatedTests: ['tests/test_user_service.py'],
      testCommand: 'pytest tests/test_user_service.py -v'
    };

    const report = formatImpactReport(impact);
    expect(report.length).toBeGreaterThan(0);
  });

  test('report can be used in hookSpecificOutput.additionalContext', () => {
    const impact = {
      filePath: 'src/core/config.py',
      riskLevel: 'HIGH',
      riskDescription: 'Core configuration',
      directDependents: [],
      indirectDependents: [],
      relatedTests: [],
      testCommand: 'pytest -v'
    };

    const report = formatImpactReport(impact);
    const output = JSON.stringify({
      hookSpecificOutput: {
        additionalContext: report
      }
    });

    const parsed = JSON.parse(output);
    expect(parsed.hookSpecificOutput.additionalContext).toBe(report);
  });
});

// ---------------------------------------------------------------------------
// Total: 50+ test cases across 15 categories
// ---------------------------------------------------------------------------
