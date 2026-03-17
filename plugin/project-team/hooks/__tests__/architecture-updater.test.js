/**
 * @TASK P3-T3 - Architecture Updater Hook Tests
 * @TEST hooks/architecture-updater.js
 *
 * Tests cover:
 *   1.  Domain extraction from file paths
 *   2.  Domain file detection
 *   3.  Domain file role classification
 *   4.  API file detection
 *   5.  API endpoint extraction (FastAPI, Flask, Express)
 *   6.  Python handler name extraction
 *   7.  Flask method extraction
 *   8.  Import statement parsing (Python, JS/TS)
 *   9.  Import change detection
 *   10. File discovery configuration
 *   11. Domain analysis
 *   12. File grouping by domain
 *   13. Dependency matrix building
 *   14. Domain extraction from imports
 *   15. API catalog building
 *   16. ARCHITECTURE.md generation
 *   17. Domain document generation
 *   18. API catalog document generation
 *   19. Dependency matrix document generation
 *   20. Change impact analysis
 *   21. Update report formatting
 *   22. Full documentation generation
 *   23. Relative path resolution
 *   24. Edge cases and error handling
 *   25. Integration: complete pipeline scenarios
 */

const {
  ARCHITECTURE_DIR,
  DOMAIN_PATTERNS,
  API_FILE_PATTERNS,
  SOURCE_EXTENSIONS,
  SKIP_DIRS,
  MAX_DISCOVERY_DEPTH,
  extractDomain,
  isDomainFile,
  classifyDomainFileRole,
  isApiFile,
  extractApiEndpoints,
  findPythonHandler,
  extractFlaskMethods,
  parseImports,
  detectImportChanges,
  analyzeDomain,
  groupFilesByDomain,
  buildDependencyMatrix,
  extractDomainFromImport,
  buildApiCatalog,
  generateArchitectureMd,
  generateDomainMd,
  generateApiCatalogMd,
  generateDependencyMatrixMd,
  analyzeChangeImpact,
  formatUpdateReport,
  generateAllDocs,
  toRelativePath
} = require('../architecture-updater');

// ---------------------------------------------------------------------------
// 1. Domain Extraction
// ---------------------------------------------------------------------------

describe('extractDomain', () => {
  test('extracts domain from src/domains/ pattern', () => {
    expect(extractDomain('src/domains/member/services/auth.py')).toBe('member');
  });

  test('extracts domain from app/domains/ pattern', () => {
    expect(extractDomain('app/domains/order/models/order.py')).toBe('order');
  });

  test('extracts domain from domains/ pattern', () => {
    expect(extractDomain('domains/payment/routes/pay.py')).toBe('payment');
  });

  test('extracts domain from packages/ pattern', () => {
    expect(extractDomain('packages/auth-lib/src/index.ts')).toBe('auth-lib');
  });

  test('extracts domain from modules/ pattern', () => {
    expect(extractDomain('modules/billing/controllers/invoice.js')).toBe('billing');
  });

  test('returns null for non-domain files', () => {
    expect(extractDomain('src/main.py')).toBeNull();
    expect(extractDomain('config/settings.yaml')).toBeNull();
    expect(extractDomain('tests/test_main.py')).toBeNull();
  });

  test('returns null for empty or invalid input', () => {
    expect(extractDomain('')).toBeNull();
    expect(extractDomain(null)).toBeNull();
    expect(extractDomain(undefined)).toBeNull();
  });

  test('handles deeply nested domain files', () => {
    expect(extractDomain('src/domains/member/services/internal/helpers.py')).toBe('member');
  });
});

// ---------------------------------------------------------------------------
// 2. Domain File Detection
// ---------------------------------------------------------------------------

describe('isDomainFile', () => {
  test('returns true for domain files', () => {
    expect(isDomainFile('src/domains/member/models/user.py')).toBe(true);
    expect(isDomainFile('domains/order/routes/orders.py')).toBe(true);
  });

  test('returns false for non-domain files', () => {
    expect(isDomainFile('src/utils/helpers.py')).toBe(false);
    expect(isDomainFile('tests/test_main.py')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Domain File Role Classification
// ---------------------------------------------------------------------------

describe('classifyDomainFileRole', () => {
  test('classifies service files', () => {
    expect(classifyDomainFileRole('src/domains/member/services/user_service.py')).toBe('service');
  });

  test('classifies model files', () => {
    expect(classifyDomainFileRole('src/domains/member/models/user.py')).toBe('model');
  });

  test('classifies route files', () => {
    expect(classifyDomainFileRole('src/domains/member/routes/auth.py')).toBe('route');
  });

  test('classifies schema files', () => {
    expect(classifyDomainFileRole('src/domains/member/schemas/user_schema.py')).toBe('schema');
  });

  test('classifies controller files', () => {
    expect(classifyDomainFileRole('src/domains/member/controllers/auth.js')).toBe('controller');
  });

  test('classifies repository files', () => {
    expect(classifyDomainFileRole('src/domains/member/repositories/user_repo.py')).toBe('repository');
  });

  test('classifies middleware files', () => {
    expect(classifyDomainFileRole('src/domains/member/middleware/auth.py')).toBe('middleware');
  });

  test('classifies utility files', () => {
    expect(classifyDomainFileRole('src/domains/member/utils/helpers.py')).toBe('utility');
  });

  test('classifies test files', () => {
    expect(classifyDomainFileRole('src/domains/member/tests/test_user.py')).toBe('test');
  });

  test('classifies config files', () => {
    expect(classifyDomainFileRole('src/domains/member/config/settings.py')).toBe('config');
  });

  test('classifies migration files', () => {
    expect(classifyDomainFileRole('src/domains/member/migrations/001_init.py')).toBe('migration');
  });

  test('classifies entity files', () => {
    expect(classifyDomainFileRole('src/domains/member/entities/user.py')).toBe('entity');
  });

  test('classifies interface files', () => {
    expect(classifyDomainFileRole('src/domains/member/interfaces/user.ts')).toBe('interface');
  });

  test('returns other for unknown roles', () => {
    expect(classifyDomainFileRole('src/domains/member/stuff/thing.py')).toBe('other');
  });

  test('returns unknown for empty path', () => {
    expect(classifyDomainFileRole('')).toBe('unknown');
    expect(classifyDomainFileRole(null)).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// 4. API File Detection
// ---------------------------------------------------------------------------

describe('isApiFile', () => {
  test('detects route files', () => {
    expect(isApiFile('src/routes/users.py')).toBe(true);
    expect(isApiFile('src/route/users.py')).toBe(true);
  });

  test('detects api directory files', () => {
    expect(isApiFile('src/api/users.py')).toBe(true);
  });

  test('detects endpoint files', () => {
    expect(isApiFile('src/endpoints/users.py')).toBe(true);
  });

  test('detects controller files', () => {
    expect(isApiFile('src/controllers/user_controller.py')).toBe(true);
  });

  test('detects view files', () => {
    expect(isApiFile('src/views/user_view.py')).toBe(true);
  });

  test('returns false for non-API files', () => {
    expect(isApiFile('src/models/user.py')).toBe(false);
    expect(isApiFile('src/services/user_service.py')).toBe(false);
    expect(isApiFile('tests/test_api.py')).toBe(false);
  });

  test('returns false for empty input', () => {
    expect(isApiFile('')).toBe(false);
    expect(isApiFile(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. API Endpoint Extraction
// ---------------------------------------------------------------------------

describe('extractApiEndpoints', () => {
  test('extracts FastAPI GET endpoint', () => {
    const content = [
      '@router.get("/users/{user_id}")',
      'async def get_user(user_id: int):',
      '    pass'
    ].join('\n');

    const endpoints = extractApiEndpoints(content, '.py');
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      method: 'GET',
      path: '/users/{user_id}',
      handler: 'get_user'
    });
  });

  test('extracts FastAPI POST endpoint', () => {
    const content = [
      '@router.post("/users")',
      'async def create_user(data: UserCreate):',
      '    pass'
    ].join('\n');

    const endpoints = extractApiEndpoints(content, '.py');
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].method).toBe('POST');
    expect(endpoints[0].handler).toBe('create_user');
  });

  test('extracts multiple FastAPI endpoints', () => {
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

    const endpoints = extractApiEndpoints(content, '.py');
    expect(endpoints.length).toBeGreaterThanOrEqual(5);
    expect(endpoints.map(e => e.method)).toEqual(
      expect.arrayContaining(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    );
  });

  test('extracts @app.get style endpoints', () => {
    const content = [
      '@app.get("/health")',
      'async def healthcheck():',
      '    return {"status": "ok"}'
    ].join('\n');

    const endpoints = extractApiEndpoints(content, '.py');
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].path).toBe('/health');
  });

  test('extracts Flask route endpoints', () => {
    const content = [
      '@app.route("/users", methods=["GET", "POST"])',
      'def users():',
      '    pass'
    ].join('\n');

    const endpoints = extractApiEndpoints(content, '.py');
    expect(endpoints.length).toBeGreaterThanOrEqual(1);
    expect(endpoints.some(e => e.method === 'GET')).toBe(true);
    expect(endpoints.some(e => e.method === 'POST')).toBe(true);
  });

  test('extracts Express GET endpoint', () => {
    const content = "app.get('/api/users', getUsers);";
    const endpoints = extractApiEndpoints(content, '.js');
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      method: 'GET',
      path: '/api/users',
      handler: 'getUsers'
    });
  });

  test('extracts Express router endpoints', () => {
    const content = [
      "router.get('/items', listItems);",
      "router.post('/items', createItem);"
    ].join('\n');

    const endpoints = extractApiEndpoints(content, '.ts');
    expect(endpoints).toHaveLength(2);
  });

  test('returns empty array for no endpoints', () => {
    const content = 'class UserModel:\n    name = "test"';
    expect(extractApiEndpoints(content, '.py')).toEqual([]);
  });

  test('returns empty array for empty/invalid content', () => {
    expect(extractApiEndpoints('', '.py')).toEqual([]);
    expect(extractApiEndpoints(null, '.py')).toEqual([]);
    expect(extractApiEndpoints(undefined, '.py')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. Python Handler Name Extraction
// ---------------------------------------------------------------------------

describe('findPythonHandler', () => {
  test('finds sync function handler', () => {
    const lines = [
      '@router.get("/users")',
      'def get_users():',
      '    pass'
    ];
    expect(findPythonHandler(lines, 1)).toBe('get_users');
  });

  test('finds async function handler', () => {
    const lines = [
      '@router.get("/users")',
      'async def get_users():',
      '    pass'
    ];
    expect(findPythonHandler(lines, 1)).toBe('get_users');
  });

  test('finds handler with blank lines between decorator and def', () => {
    const lines = [
      '@router.get("/users")',
      '',
      'async def get_users():',
      '    pass'
    ];
    expect(findPythonHandler(lines, 1)).toBe('get_users');
  });

  test('returns null when no handler found within range', () => {
    const lines = [
      '@router.get("/users")',
      'class SomeClass:',
      '    pass'
    ];
    expect(findPythonHandler(lines, 1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Flask Method Extraction
// ---------------------------------------------------------------------------

describe('extractFlaskMethods', () => {
  test('extracts multiple methods from methods= parameter', () => {
    const line = '@app.route("/users", methods=["GET", "POST"])';
    const methods = extractFlaskMethods(line);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
  });

  test('extracts single method', () => {
    const line = '@app.route("/users", methods=["DELETE"])';
    const methods = extractFlaskMethods(line);
    expect(methods).toContain('DELETE');
  });

  test('defaults to GET when no methods specified', () => {
    const line = '@app.route("/users")';
    const methods = extractFlaskMethods(line);
    expect(methods).toEqual(['GET']);
  });

  test('handles methods with single quotes', () => {
    const line = "@app.route('/users', methods=['PUT', 'PATCH'])";
    const methods = extractFlaskMethods(line);
    expect(methods).toContain('PUT');
    expect(methods).toContain('PATCH');
  });
});

// ---------------------------------------------------------------------------
// 8. Import Statement Parsing
// ---------------------------------------------------------------------------

describe('parseImports', () => {
  test('parses Python from...import statements', () => {
    const content = 'from app.services.user_service import UserService';
    const imports = parseImports(content, '.py');
    expect(imports).toContain('app/services/user_service');
  });

  test('parses Python import statements', () => {
    const content = 'import app.models.user';
    const imports = parseImports(content, '.py');
    expect(imports).toContain('app/models/user');
  });

  test('parses Python relative imports', () => {
    const content = 'from .models import User';
    const imports = parseImports(content, '.py');
    expect(imports).toContain('./models');
  });

  test('parses Python double-dot relative imports', () => {
    const content = 'from ..utils import helpers';
    const imports = parseImports(content, '.py');
    expect(imports).toContain('../../utils');
  });

  test('parses JavaScript import statements', () => {
    const content = "import { UserService } from './services/user_service';";
    const imports = parseImports(content, '.js');
    expect(imports).toContain('./services/user_service');
  });

  test('parses JavaScript require statements', () => {
    const content = "const UserService = require('./services/user_service');";
    const imports = parseImports(content, '.js');
    expect(imports).toContain('./services/user_service');
  });

  test('parses TypeScript imports', () => {
    const content = "import { UserService } from '@/services/user_service';";
    const imports = parseImports(content, '.ts');
    expect(imports).toContain('@/services/user_service');
  });

  test('parses multiple imports', () => {
    const content = [
      'from app.models.user import User',
      'from app.services.auth import AuthService',
      'import app.utils.helpers'
    ].join('\n');
    const imports = parseImports(content, '.py');
    expect(imports).toHaveLength(3);
  });

  test('ignores Python comments', () => {
    const content = '# from app.models.user import User';
    const imports = parseImports(content, '.py');
    expect(imports).toHaveLength(0);
  });

  test('ignores JS comments', () => {
    const content = "// import { User } from './models/user';";
    const imports = parseImports(content, '.js');
    expect(imports).toHaveLength(0);
  });

  test('returns empty for empty/invalid content', () => {
    expect(parseImports('', '.py')).toEqual([]);
    expect(parseImports(null, '.py')).toEqual([]);
    expect(parseImports(undefined, '.py')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 9. Import Change Detection
// ---------------------------------------------------------------------------

describe('detectImportChanges', () => {
  test('detects added imports', () => {
    const oldContent = 'from app.models import User';
    const newContent = 'from app.models import User\nfrom app.services import AuthService';

    const changes = detectImportChanges(oldContent, newContent, '.py');
    expect(changes.added).toContain('app/services');
    expect(changes.removed).toHaveLength(0);
    expect(changes.unchanged).toContain('app/models');
  });

  test('detects removed imports', () => {
    const oldContent = 'from app.models import User\nfrom app.services import AuthService';
    const newContent = 'from app.models import User';

    const changes = detectImportChanges(oldContent, newContent, '.py');
    expect(changes.removed).toContain('app/services');
    expect(changes.added).toHaveLength(0);
  });

  test('detects both added and removed', () => {
    const oldContent = 'from app.old_module import OldClass';
    const newContent = 'from app.new_module import NewClass';

    const changes = detectImportChanges(oldContent, newContent, '.py');
    expect(changes.added).toContain('app/new_module');
    expect(changes.removed).toContain('app/old_module');
  });

  test('returns all unchanged when no changes', () => {
    const content = 'from app.models import User';
    const changes = detectImportChanges(content, content, '.py');
    expect(changes.added).toHaveLength(0);
    expect(changes.removed).toHaveLength(0);
    expect(changes.unchanged).toHaveLength(1);
  });

  test('handles empty old content (new file)', () => {
    const newContent = 'from app.models import User';
    const changes = detectImportChanges('', newContent, '.py');
    expect(changes.added).toContain('app/models');
    expect(changes.removed).toHaveLength(0);
  });

  test('handles empty new content (file cleared)', () => {
    const oldContent = 'from app.models import User';
    const changes = detectImportChanges(oldContent, '', '.py');
    expect(changes.removed).toContain('app/models');
    expect(changes.added).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 10. Configuration Constants
// ---------------------------------------------------------------------------

describe('Configuration', () => {
  test('ARCHITECTURE_DIR is defined', () => {
    expect(ARCHITECTURE_DIR).toBe('.claude/architecture');
  });

  test('DOMAIN_PATTERNS contains expected patterns', () => {
    expect(DOMAIN_PATTERNS.length).toBeGreaterThan(0);
    expect(DOMAIN_PATTERNS.every(p => p instanceof RegExp)).toBe(true);
  });

  test('API_FILE_PATTERNS contains expected patterns', () => {
    expect(API_FILE_PATTERNS.length).toBeGreaterThan(0);
  });

  test('SOURCE_EXTENSIONS includes common languages', () => {
    expect(SOURCE_EXTENSIONS.has('.py')).toBe(true);
    expect(SOURCE_EXTENSIONS.has('.js')).toBe(true);
    expect(SOURCE_EXTENSIONS.has('.ts')).toBe(true);
    expect(SOURCE_EXTENSIONS.has('.tsx')).toBe(true);
  });

  test('SKIP_DIRS includes common non-source directories', () => {
    expect(SKIP_DIRS.has('node_modules')).toBe(true);
    expect(SKIP_DIRS.has('.git')).toBe(true);
    expect(SKIP_DIRS.has('__pycache__')).toBe(true);
    expect(SKIP_DIRS.has('.claude')).toBe(true);
  });

  test('MAX_DISCOVERY_DEPTH is reasonable', () => {
    expect(MAX_DISCOVERY_DEPTH).toBeGreaterThanOrEqual(4);
    expect(MAX_DISCOVERY_DEPTH).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// 11. Domain Analysis
// ---------------------------------------------------------------------------

describe('analyzeDomain', () => {
  const createReader = (contents) => (f) => contents[f] || '';
  const extResolver = (f) => {
    const ext = f.match(/\.\w+$/);
    return ext ? ext[0] : '';
  };

  test('analyzes domain with multiple file roles', () => {
    const files = [
      'src/domains/member/services/user_service.py',
      'src/domains/member/models/user.py',
      'src/domains/member/routes/users.py'
    ];

    const contents = {
      'src/domains/member/services/user_service.py': 'from app.models.user import User\n\nclass UserService: pass',
      'src/domains/member/models/user.py': 'class User: pass',
      'src/domains/member/routes/users.py': '@router.get("/users")\nasync def list_users(): pass'
    };

    const analysis = analyzeDomain('member', files, createReader(contents), extResolver);
    expect(analysis.name).toBe('member');
    expect(analysis.fileCount).toBe(3);
    expect(analysis.roles.service).toHaveLength(1);
    expect(analysis.roles.model).toHaveLength(1);
    expect(analysis.roles.route).toHaveLength(1);
    expect(analysis.endpoints.length).toBeGreaterThanOrEqual(1);
    expect(analysis.imports.length).toBeGreaterThanOrEqual(1);
  });

  test('returns empty analysis for empty file list', () => {
    const analysis = analyzeDomain('empty', [], () => '', () => '.py');
    expect(analysis.name).toBe('empty');
    expect(analysis.fileCount).toBe(0);
    expect(analysis.endpoints).toHaveLength(0);
    expect(analysis.imports).toHaveLength(0);
  });

  test('handles null domain files', () => {
    const analysis = analyzeDomain('test', null, () => '', () => '.py');
    expect(analysis.fileCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 12. File Grouping by Domain
// ---------------------------------------------------------------------------

describe('groupFilesByDomain', () => {
  test('groups files by domain name', () => {
    const files = [
      'src/domains/member/services/user.py',
      'src/domains/member/models/user.py',
      'src/domains/order/services/order.py',
      'src/utils/helpers.py'
    ];

    const groups = groupFilesByDomain(files);
    expect(groups.member).toHaveLength(2);
    expect(groups.order).toHaveLength(1);
    expect(groups.helpers).toBeUndefined(); // not a domain file
  });

  test('returns empty object for no domain files', () => {
    const files = ['src/main.py', 'config/settings.py'];
    const groups = groupFilesByDomain(files);
    expect(Object.keys(groups)).toHaveLength(0);
  });

  test('handles empty file list', () => {
    const groups = groupFilesByDomain([]);
    expect(Object.keys(groups)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 13. Dependency Matrix Building
// ---------------------------------------------------------------------------

describe('buildDependencyMatrix', () => {
  const createReader = (contents) => (f) => contents[f] || '';
  const extResolver = () => '.py';

  test('builds entries for files with imports', () => {
    const contents = {
      'src/domains/member/services/user.py': 'from app.models.user import User',
      'src/domains/member/models/user.py': ''
    };

    const matrix = buildDependencyMatrix(
      Object.keys(contents),
      createReader(contents),
      extResolver
    );

    expect(matrix.entries.length).toBeGreaterThanOrEqual(1);
    expect(matrix.entries[0].file).toBe('src/domains/member/services/user.py');
    expect(matrix.entries[0].imports).toContain('app/models/user');
  });

  test('tracks inter-domain dependencies', () => {
    const contents = {
      'src/domains/order/services/order.py': 'from src.domains.member.services.user import UserService',
      'src/domains/member/services/user.py': ''
    };

    const matrix = buildDependencyMatrix(
      Object.keys(contents),
      createReader(contents),
      extResolver
    );

    expect(matrix.domainDeps.order).toBeDefined();
    expect(matrix.domainDeps.order).toContain('member');
  });

  test('returns empty matrix for empty file list', () => {
    const matrix = buildDependencyMatrix([], () => '', () => '.py');
    expect(matrix.entries).toHaveLength(0);
    expect(Object.keys(matrix.domainDeps)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 14. Domain Extraction from Imports
// ---------------------------------------------------------------------------

describe('extractDomainFromImport', () => {
  test('extracts domain from domains/ import path', () => {
    expect(extractDomainFromImport('src/domains/member/services/user')).toBe('member');
  });

  test('extracts domain from dotted import path', () => {
    expect(extractDomainFromImport('src.domains.order.models.order')).toBe('order');
  });

  test('returns null for non-domain imports', () => {
    expect(extractDomainFromImport('app/utils/helpers')).toBeNull();
    expect(extractDomainFromImport('lodash')).toBeNull();
  });

  test('returns null for empty import', () => {
    expect(extractDomainFromImport('')).toBeNull();
    expect(extractDomainFromImport(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 15. API Catalog Building
// ---------------------------------------------------------------------------

describe('buildApiCatalog', () => {
  const createReader = (contents) => (f) => contents[f] || '';
  const extResolver = (f) => {
    const ext = f.match(/\.\w+$/);
    return ext ? ext[0] : '';
  };

  test('builds catalog from route files', () => {
    const contents = {
      'src/domains/member/routes/users.py': [
        '@router.get("/api/users")',
        'async def list_users(): pass',
        '',
        '@router.post("/api/users")',
        'async def create_user(): pass'
      ].join('\n'),
      'src/domains/order/routes/orders.py': [
        '@router.get("/api/orders")',
        'async def list_orders(): pass'
      ].join('\n'),
      'src/models/user.py': 'class User: pass'
    };

    const catalog = buildApiCatalog(
      Object.keys(contents),
      createReader(contents),
      extResolver
    );

    expect(catalog.length).toBeGreaterThanOrEqual(3);
    expect(catalog.some(e => e.path === '/api/users' && e.method === 'GET')).toBe(true);
    expect(catalog.some(e => e.path === '/api/orders')).toBe(true);
  });

  test('includes domain name in catalog entries', () => {
    const contents = {
      'src/domains/member/routes/users.py': '@router.get("/users")\nasync def get(): pass'
    };

    const catalog = buildApiCatalog(
      Object.keys(contents),
      createReader(contents),
      extResolver
    );

    expect(catalog[0].domain).toBe('member');
  });

  test('sorts catalog by path then method', () => {
    const contents = {
      'src/routes/b.py': '@router.post("/b")\nasync def b_post(): pass\n@router.get("/b")\nasync def b_get(): pass',
      'src/routes/a.py': '@router.get("/a")\nasync def a_get(): pass'
    };

    const catalog = buildApiCatalog(
      Object.keys(contents),
      createReader(contents),
      extResolver
    );

    expect(catalog[0].path).toBe('/a');
    expect(catalog[1].path).toBe('/b');
  });

  test('returns empty catalog when no API files', () => {
    const contents = {
      'src/models/user.py': 'class User: pass'
    };

    const catalog = buildApiCatalog(
      Object.keys(contents),
      createReader(contents),
      extResolver
    );

    expect(catalog).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 16. ARCHITECTURE.md Generation
// ---------------------------------------------------------------------------

describe('generateArchitectureMd', () => {
  const timestamp = '2026-02-07T12:00:00Z';

  test('generates markdown with domain summary table', () => {
    const md = generateArchitectureMd({
      domainAnalyses: {
        member: { fileCount: 5, endpoints: [{ method: 'GET', path: '/users' }] },
        order: { fileCount: 3, endpoints: [] }
      },
      apiCatalog: [{ method: 'GET', path: '/users' }],
      dependencyMatrix: { entries: [], domainDeps: { member: ['order'] } },
      timestamp
    });

    expect(md).toContain('# Architecture Overview');
    expect(md).toContain('member');
    expect(md).toContain('order');
    expect(md).toContain('Total endpoints: 1');
    expect(md).toContain(timestamp);
  });

  test('handles empty data gracefully', () => {
    const md = generateArchitectureMd({
      domainAnalyses: {},
      apiCatalog: [],
      dependencyMatrix: { entries: [], domainDeps: {} },
      timestamp
    });

    expect(md).toContain('# Architecture Overview');
    expect(md).toContain('No domain directories detected');
    expect(md).toContain('No API endpoints detected');
  });

  test('includes document links', () => {
    const md = generateArchitectureMd({
      domainAnalyses: { auth: { fileCount: 2, endpoints: [] } },
      apiCatalog: [],
      dependencyMatrix: { entries: [], domainDeps: {} },
      timestamp
    });

    expect(md).toContain('[API Catalog](api-catalog.md)');
    expect(md).toContain('[Dependency Matrix](dependency-matrix.md)');
    expect(md).toContain('[auth Domain](domains/auth.md)');
  });

  test('shows inter-domain dependencies', () => {
    const md = generateArchitectureMd({
      domainAnalyses: {
        member: { fileCount: 3, endpoints: [] },
        order: { fileCount: 2, endpoints: [] }
      },
      apiCatalog: [],
      dependencyMatrix: { entries: [], domainDeps: { order: ['member'] } },
      timestamp
    });

    expect(md).toContain('order');
    expect(md).toContain('member');
  });
});

// ---------------------------------------------------------------------------
// 17. Domain Document Generation
// ---------------------------------------------------------------------------

describe('generateDomainMd', () => {
  const timestamp = '2026-02-07T12:00:00Z';

  test('generates domain markdown with roles and endpoints', () => {
    const analysis = {
      name: 'member',
      fileCount: 3,
      files: [
        'src/domains/member/services/user.py',
        'src/domains/member/models/user.py',
        'src/domains/member/routes/users.py'
      ],
      roles: {
        service: ['src/domains/member/services/user.py'],
        model: ['src/domains/member/models/user.py'],
        route: ['src/domains/member/routes/users.py']
      },
      endpoints: [
        { method: 'GET', path: '/users', handler: 'list_users', file: 'src/domains/member/routes/users.py' }
      ],
      imports: [
        { from: 'src/domains/member/services/user.py', to: 'app/models/user' }
      ]
    };

    const md = generateDomainMd(analysis, timestamp);
    expect(md).toContain('# member Domain');
    expect(md).toContain('service');
    expect(md).toContain('model');
    expect(md).toContain('route');
    expect(md).toContain('GET');
    expect(md).toContain('/users');
    expect(md).toContain('list_users');
    expect(md).toContain('app/models/user');
  });

  test('handles domain with no endpoints', () => {
    const analysis = {
      name: 'utils',
      fileCount: 1,
      files: ['src/domains/utils/helpers.py'],
      roles: { utility: ['src/domains/utils/helpers.py'] },
      endpoints: [],
      imports: []
    };

    const md = generateDomainMd(analysis, timestamp);
    expect(md).toContain('No endpoints defined');
  });

  test('returns empty string for null analysis', () => {
    expect(generateDomainMd(null, timestamp)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 18. API Catalog Document Generation
// ---------------------------------------------------------------------------

describe('generateApiCatalogMd', () => {
  const timestamp = '2026-02-07T12:00:00Z';

  test('generates catalog with endpoints grouped by domain', () => {
    const catalog = [
      { method: 'GET', path: '/api/users', handler: 'list_users', file: 'routes/users.py', domain: 'member' },
      { method: 'POST', path: '/api/users', handler: 'create_user', file: 'routes/users.py', domain: 'member' },
      { method: 'GET', path: '/api/orders', handler: 'list_orders', file: 'routes/orders.py', domain: 'order' }
    ];

    const md = generateApiCatalogMd(catalog, timestamp);
    expect(md).toContain('# API Catalog');
    expect(md).toContain('Total endpoints: 3');
    expect(md).toContain('## member');
    expect(md).toContain('## order');
    expect(md).toContain('GET');
    expect(md).toContain('POST');
    expect(md).toContain('/api/users');
    expect(md).toContain('/api/orders');
  });

  test('handles empty catalog', () => {
    const md = generateApiCatalogMd([], timestamp);
    expect(md).toContain('No API endpoints detected');
  });

  test('handles null catalog', () => {
    const md = generateApiCatalogMd(null, timestamp);
    expect(md).toContain('No API endpoints detected');
  });
});

// ---------------------------------------------------------------------------
// 19. Dependency Matrix Document Generation
// ---------------------------------------------------------------------------

describe('generateDependencyMatrixMd', () => {
  const timestamp = '2026-02-07T12:00:00Z';

  test('generates matrix with inter-domain dependencies', () => {
    const matrix = {
      entries: [
        { file: 'src/domains/order/services/order.py', imports: ['src/domains/member/services/user'] }
      ],
      domainDeps: {
        order: ['member']
      }
    };

    const md = generateDependencyMatrixMd(matrix, timestamp);
    expect(md).toContain('# Dependency Matrix');
    expect(md).toContain('order');
    expect(md).toContain('member');
    expect(md).toContain('Total files with imports: 1');
  });

  test('handles empty matrix', () => {
    const md = generateDependencyMatrixMd({ entries: [], domainDeps: {} }, timestamp);
    expect(md).toContain('No inter-domain dependencies detected');
    expect(md).toContain('No file dependencies detected');
  });

  test('handles null matrix', () => {
    const md = generateDependencyMatrixMd(null, timestamp);
    expect(md).toContain('# Dependency Matrix');
  });

  test('truncates long import lists with +N more', () => {
    const matrix = {
      entries: [{
        file: 'src/big_file.py',
        imports: ['module1', 'module2', 'module3', 'module4', 'module5']
      }],
      domainDeps: {}
    };

    const md = generateDependencyMatrixMd(matrix, timestamp);
    expect(md).toContain('+2 more');
  });
});

// ---------------------------------------------------------------------------
// 20. Change Impact Analysis
// ---------------------------------------------------------------------------

describe('analyzeChangeImpact', () => {
  test('detects domain file changes', () => {
    const updates = analyzeChangeImpact(
      'src/domains/member/services/user.py',
      'class UserService: pass',
      ''
    );

    expect(updates.domain).toBe('member');
    expect(updates.architecture).toBe(true);
  });

  test('detects API file changes', () => {
    const updates = analyzeChangeImpact(
      'src/routes/users.py',
      '@router.get("/users")\nasync def get(): pass',
      ''
    );

    expect(updates.apiCatalog).toBe(true);
    expect(updates.architecture).toBe(true);
  });

  test('detects import changes', () => {
    const oldContent = 'from app.models import User';
    const newContent = 'from app.models import User\nfrom app.services import Auth';

    const updates = analyzeChangeImpact(
      'src/domains/member/services/user.py',
      newContent,
      oldContent
    );

    expect(updates.dependencyMatrix).toBe(true);
  });

  test('marks new source files for dependency tracking', () => {
    const updates = analyzeChangeImpact(
      'src/domains/member/services/new_service.py',
      'class NewService: pass',
      null
    );

    expect(updates.dependencyMatrix).toBe(true);
  });

  test('returns no updates for non-source files outside domains', () => {
    const updates = analyzeChangeImpact(
      'README.md',
      '# Hello',
      ''
    );

    expect(updates.architecture).toBe(false);
  });

  test('handles combined domain + API + import changes', () => {
    const oldContent = 'from app.models import User';
    const newContent = 'from app.models import User\nfrom app.services import Auth\n@router.get("/users")\nasync def get(): pass';

    const updates = analyzeChangeImpact(
      'src/domains/member/routes/users.py',
      newContent,
      oldContent
    );

    expect(updates.domain).toBe('member');
    expect(updates.apiCatalog).toBe(true);
    expect(updates.dependencyMatrix).toBe(true);
    expect(updates.architecture).toBe(true);
    expect(updates.details.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 21. Update Report Formatting
// ---------------------------------------------------------------------------

describe('formatUpdateReport', () => {
  test('formats domain update report', () => {
    const updates = {
      architecture: true,
      domain: 'member',
      apiCatalog: false,
      dependencyMatrix: false,
      details: ['Domain file changed: member']
    };

    const report = formatUpdateReport(updates);
    expect(report).toContain('[Architecture Update Detected]');
    expect(report).toContain('member');
    expect(report).toContain('Domain');
    expect(report).toContain(ARCHITECTURE_DIR);
  });

  test('formats API catalog update report', () => {
    const updates = {
      architecture: true,
      domain: null,
      apiCatalog: true,
      dependencyMatrix: false,
      details: ['API file changed: src/routes/users.py']
    };

    const report = formatUpdateReport(updates);
    expect(report).toContain('API Catalog');
    expect(report).toContain('api-catalog.md');
  });

  test('formats dependency matrix update report', () => {
    const updates = {
      architecture: true,
      domain: null,
      apiCatalog: false,
      dependencyMatrix: true,
      details: ['Import changes: +1 -0']
    };

    const report = formatUpdateReport(updates);
    expect(report).toContain('Dependency Matrix');
    expect(report).toContain('dependency-matrix.md');
  });

  test('includes stats when provided', () => {
    const updates = {
      architecture: true,
      domain: 'member',
      apiCatalog: true,
      dependencyMatrix: true,
      details: ['Domain file changed']
    };

    const stats = { domainCount: 3, endpointCount: 10, fileCount: 50 };
    const report = formatUpdateReport(updates, stats);
    expect(report).toContain('3 domains');
    expect(report).toContain('10 endpoints');
    expect(report).toContain('50 tracked files');
  });

  test('returns empty for null updates', () => {
    expect(formatUpdateReport(null)).toBe('');
  });

  test('returns empty when no sections to update', () => {
    const updates = {
      architecture: false,
      domain: null,
      apiCatalog: false,
      dependencyMatrix: false,
      details: []
    };

    const report = formatUpdateReport(updates);
    expect(report).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 22. Full Documentation Generation
// ---------------------------------------------------------------------------

describe('generateAllDocs', () => {
  test('generates all doc types', () => {
    const files = [
      'src/domains/member/services/user.py',
      'src/domains/member/models/user.py',
      'src/domains/member/routes/users.py',
      'src/domains/order/services/order.py'
    ];

    const contents = {
      'src/domains/member/services/user.py': 'from app.models.user import User\n\nclass UserService: pass',
      'src/domains/member/models/user.py': 'class User: pass',
      'src/domains/member/routes/users.py': '@router.get("/api/users")\nasync def list_users(): pass',
      'src/domains/order/services/order.py': 'from src.domains.member.services.user import UserService'
    };

    const result = generateAllDocs('/fake/project', {
      files,
      contentReader: (f) => contents[f] || '',
      extResolver: (f) => '.py',
      timestamp: '2026-02-07T12:00:00Z'
    });

    // Check that all doc types are generated
    expect(result.docs).toBeDefined();
    expect(result.docs[`${ARCHITECTURE_DIR}/ARCHITECTURE.md`]).toBeDefined();
    expect(result.docs[`${ARCHITECTURE_DIR}/domains/member.md`]).toBeDefined();
    expect(result.docs[`${ARCHITECTURE_DIR}/domains/order.md`]).toBeDefined();
    expect(result.docs[`${ARCHITECTURE_DIR}/api-catalog.md`]).toBeDefined();
    expect(result.docs[`${ARCHITECTURE_DIR}/dependency-matrix.md`]).toBeDefined();

    // Check stats
    expect(result.stats.domainCount).toBe(2);
    expect(result.stats.endpointCount).toBeGreaterThanOrEqual(1);
    expect(result.stats.fileCount).toBe(4);
  });

  test('generates docs with no domains', () => {
    const result = generateAllDocs('/fake/project', {
      files: ['src/main.py'],
      contentReader: () => 'print("hello")',
      extResolver: () => '.py',
      timestamp: '2026-02-07T12:00:00Z'
    });

    expect(result.docs[`${ARCHITECTURE_DIR}/ARCHITECTURE.md`]).toBeDefined();
    expect(result.stats.domainCount).toBe(0);
  });

  test('generates docs with empty file list', () => {
    const result = generateAllDocs('/fake/project', {
      files: [],
      contentReader: () => '',
      extResolver: () => '.py',
      timestamp: '2026-02-07T12:00:00Z'
    });

    expect(result.docs[`${ARCHITECTURE_DIR}/ARCHITECTURE.md`]).toBeDefined();
    expect(result.stats.fileCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 23. Relative Path Resolution
// ---------------------------------------------------------------------------

describe('toRelativePath', () => {
  test('converts absolute path to relative', () => {
    const projectDir = process.cwd();
    process.env.CLAUDE_PROJECT_DIR = projectDir;

    const result = toRelativePath(`${projectDir}/src/models/user.py`);
    expect(result).toBe('src/models/user.py');
  });

  test('returns relative path as-is', () => {
    expect(toRelativePath('src/models/user.py')).toBe('src/models/user.py');
  });

  test('returns empty for empty input', () => {
    expect(toRelativePath('')).toBe('');
    expect(toRelativePath(null)).toBe('');
    expect(toRelativePath(undefined)).toBe('');
  });

  test('handles paths outside project directory', () => {
    const result = toRelativePath('/some/other/project/file.py');
    expect(result).toContain('..');
  });
});

// ---------------------------------------------------------------------------
// 24. Edge Cases and Error Handling
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  test('extractDomain handles path with trailing slash', () => {
    // Path with trailing slash still matches the domain pattern correctly
    expect(extractDomain('src/domains/member/')).toBe('member');
    // But a path that is just the domain name without nested content returns null
    expect(extractDomain('src/domains/')).toBe(null);
  });

  test('classifyDomainFileRole handles file with multiple role keywords', () => {
    // service takes priority because it is checked first
    const role = classifyDomainFileRole('src/domains/member/services/model_service.py');
    expect(role).toBe('service');
  });

  test('extractApiEndpoints handles mixed content', () => {
    const content = [
      'class UserModel:',
      '    pass',
      '',
      '@router.get("/api/health")',
      'async def health():',
      '    return {"status": "ok"}',
      '',
      '# This is a comment',
      'some_variable = 42'
    ].join('\n');

    const endpoints = extractApiEndpoints(content, '.py');
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].path).toBe('/api/health');
  });

  test('parseImports handles file with no imports', () => {
    const content = 'class User:\n    name = "test"\n    age = 25';
    expect(parseImports(content, '.py')).toEqual([]);
  });

  test('buildApiCatalog skips non-API files', () => {
    const contents = {
      'src/models/user.py': '@router.get("/ghost")\nasync def ghost(): pass'
    };

    const catalog = buildApiCatalog(
      Object.keys(contents),
      (f) => contents[f] || '',
      () => '.py'
    );

    // models/ is not an API file pattern
    expect(catalog).toHaveLength(0);
  });

  test('analyzeChangeImpact skips architecture directory files', () => {
    const updates = analyzeChangeImpact(
      '.claude/architecture/ARCHITECTURE.md',
      '# New content',
      '# Old content'
    );

    // .claude/architecture files are not source files
    expect(updates.architecture).toBe(false);
  });

  test('generateDomainMd handles domain with no imports', () => {
    const analysis = {
      name: 'simple',
      fileCount: 1,
      files: ['src/domains/simple/main.py'],
      roles: { other: ['src/domains/simple/main.py'] },
      endpoints: [],
      imports: []
    };

    const md = generateDomainMd(analysis, '2026-02-07T12:00:00Z');
    expect(md).toContain('No external dependencies');
  });

  test('formatUpdateReport handles updates with all sections', () => {
    const updates = {
      architecture: true,
      domain: 'member',
      apiCatalog: true,
      dependencyMatrix: true,
      details: ['Multiple changes detected']
    };

    const report = formatUpdateReport(updates);
    expect(report).toContain('Domain: member');
    expect(report).toContain('API Catalog');
    expect(report).toContain('Dependency Matrix');
    expect(report).toContain('RECOMMENDATION');
  });
});

// ---------------------------------------------------------------------------
// 25. Integration: Complete Pipeline Scenarios
// ---------------------------------------------------------------------------

describe('Integration: Complete Pipeline', () => {
  test('Scenario 1: New domain service file -> full architecture update', () => {
    const filePath = 'src/domains/payment/services/payment_service.py';
    const newContent = [
      'from src.domains.member.models.user import User',
      'from src.domains.order.services.order_service import OrderService',
      '',
      'class PaymentService:',
      '    def process_payment(self, user_id, order_id):',
      '        pass'
    ].join('\n');

    // 1. Analyze change impact
    const updates = analyzeChangeImpact(filePath, newContent, '');
    expect(updates.domain).toBe('payment');
    expect(updates.dependencyMatrix).toBe(true);
    expect(updates.architecture).toBe(true);

    // 2. Generate report
    const report = formatUpdateReport(updates);
    expect(report).toContain('payment');
    expect(report).toContain('Architecture Update Detected');

    // 3. Full doc generation with this file
    const files = [
      filePath,
      'src/domains/member/models/user.py',
      'src/domains/order/services/order_service.py'
    ];

    const contents = {
      [filePath]: newContent,
      'src/domains/member/models/user.py': 'class User: pass',
      'src/domains/order/services/order_service.py': 'class OrderService: pass'
    };

    const result = generateAllDocs('/fake/project', {
      files,
      contentReader: (f) => contents[f] || '',
      extResolver: () => '.py',
      timestamp: '2026-02-07T12:00:00Z'
    });

    expect(result.stats.domainCount).toBe(3);
    expect(result.docs[`${ARCHITECTURE_DIR}/domains/payment.md`]).toBeDefined();
    expect(result.docs[`${ARCHITECTURE_DIR}/domains/payment.md`]).toContain('payment');
  });

  test('Scenario 2: API route file change -> catalog and domain update', () => {
    const filePath = 'src/domains/member/routes/users.py';
    const oldContent = [
      '@router.get("/api/users")',
      'async def list_users(): pass'
    ].join('\n');
    const newContent = [
      '@router.get("/api/users")',
      'async def list_users(): pass',
      '',
      '@router.post("/api/users")',
      'async def create_user(): pass',
      '',
      '@router.get("/api/users/{id}")',
      'async def get_user(): pass'
    ].join('\n');

    // 1. Analyze change impact
    const updates = analyzeChangeImpact(filePath, newContent, oldContent);
    expect(updates.domain).toBe('member');
    expect(updates.apiCatalog).toBe(true);

    // 2. Verify endpoint extraction
    const endpoints = extractApiEndpoints(newContent, '.py');
    expect(endpoints).toHaveLength(3);
    expect(endpoints.map(e => e.method)).toEqual(
      expect.arrayContaining(['GET', 'POST'])
    );
  });

  test('Scenario 3: Import refactoring -> dependency matrix update', () => {
    const filePath = 'src/domains/order/services/order_service.py';
    const oldContent = [
      'from src.domains.member.services.user_service import UserService',
      'from app.utils.helpers import format_date',
      '',
      'class OrderService:',
      '    pass'
    ].join('\n');
    const newContent = [
      'from src.domains.member.services.user_service import UserService',
      'from src.domains.payment.services.payment_service import PaymentService',
      'from app.utils.helpers import format_date',
      '',
      'class OrderService:',
      '    pass'
    ].join('\n');

    // 1. Detect import changes
    const importChanges = detectImportChanges(oldContent, newContent, '.py');
    expect(importChanges.added).toContain('src/domains/payment/services/payment_service');
    expect(importChanges.unchanged).toContain('src/domains/member/services/user_service');
    expect(importChanges.unchanged).toContain('app/utils/helpers');

    // 2. Analyze change impact
    const updates = analyzeChangeImpact(filePath, newContent, oldContent);
    expect(updates.dependencyMatrix).toBe(true);
    expect(updates.domain).toBe('order');
  });

  test('Scenario 4: Express.js project with multiple routes', () => {
    const files = [
      'src/domains/users/routes/users.js',
      'src/domains/products/routes/products.js',
      'src/domains/users/services/userService.js'
    ];

    const contents = {
      'src/domains/users/routes/users.js': [
        "const express = require('express');",
        "const { UserService } = require('../services/userService');",
        "",
        "router.get('/api/users', listUsers);",
        "router.post('/api/users', createUser);",
        "router.get('/api/users/:id', getUser);"
      ].join('\n'),
      'src/domains/products/routes/products.js': [
        "const express = require('express');",
        "",
        "router.get('/api/products', listProducts);",
        "router.post('/api/products', createProduct);"
      ].join('\n'),
      'src/domains/users/services/userService.js': [
        "const { User } = require('../models/user');",
        "class UserService {}"
      ].join('\n')
    };

    const result = generateAllDocs('/fake/project', {
      files,
      contentReader: (f) => contents[f] || '',
      extResolver: (f) => '.js',
      timestamp: '2026-02-07T12:00:00Z'
    });

    expect(result.stats.domainCount).toBe(2);
    expect(result.stats.endpointCount).toBeGreaterThanOrEqual(5);
    expect(result.docs[`${ARCHITECTURE_DIR}/api-catalog.md`]).toContain('/api/users');
    expect(result.docs[`${ARCHITECTURE_DIR}/api-catalog.md`]).toContain('/api/products');
  });

  test('Scenario 5: Full project analysis with cross-domain dependencies', () => {
    const files = [
      'src/domains/member/services/user.py',
      'src/domains/member/models/user.py',
      'src/domains/member/routes/users.py',
      'src/domains/order/services/order.py',
      'src/domains/order/routes/orders.py',
      'src/domains/payment/services/payment.py'
    ];

    const contents = {
      'src/domains/member/services/user.py': 'from app.models.user import User',
      'src/domains/member/models/user.py': 'class User: pass',
      'src/domains/member/routes/users.py': '@router.get("/api/users")\nasync def list_users(): pass\n@router.get("/api/users/{id}")\nasync def get_user(): pass',
      'src/domains/order/services/order.py': 'from src.domains.member.services.user import UserService',
      'src/domains/order/routes/orders.py': '@router.get("/api/orders")\nasync def list_orders(): pass',
      'src/domains/payment/services/payment.py': 'from src.domains.member.services.user import UserService\nfrom src.domains.order.services.order import OrderService'
    };

    const result = generateAllDocs('/fake/project', {
      files,
      contentReader: (f) => contents[f] || '',
      extResolver: () => '.py',
      timestamp: '2026-02-07T12:00:00Z'
    });

    // Verify architecture overview
    const archMd = result.docs[`${ARCHITECTURE_DIR}/ARCHITECTURE.md`];
    expect(archMd).toContain('member');
    expect(archMd).toContain('order');
    expect(archMd).toContain('payment');
    expect(archMd).toContain('Total endpoints: 3');

    // Verify dependency matrix
    const depMd = result.docs[`${ARCHITECTURE_DIR}/dependency-matrix.md`];
    expect(depMd).toContain('order');
    expect(depMd).toContain('payment');
    expect(depMd).toContain('member');

    // Verify API catalog
    const apiMd = result.docs[`${ARCHITECTURE_DIR}/api-catalog.md`];
    expect(apiMd).toContain('/api/users');
    expect(apiMd).toContain('/api/orders');

    // Verify domain-specific docs
    expect(result.docs[`${ARCHITECTURE_DIR}/domains/member.md`]).toContain('member Domain');
    expect(result.docs[`${ARCHITECTURE_DIR}/domains/order.md`]).toContain('order Domain');
    expect(result.docs[`${ARCHITECTURE_DIR}/domains/payment.md`]).toContain('payment Domain');

    // Verify stats
    expect(result.stats.domainCount).toBe(3);
    expect(result.stats.fileCount).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Bonus: Hook Protocol Output
// ---------------------------------------------------------------------------

describe('Hook protocol compliance', () => {
  test('formatUpdateReport output can be embedded in hookSpecificOutput', () => {
    const updates = {
      architecture: true,
      domain: 'member',
      apiCatalog: true,
      dependencyMatrix: true,
      details: ['Domain file changed']
    };

    const report = formatUpdateReport(updates);
    const output = JSON.stringify({
      hookSpecificOutput: {
        additionalContext: report
      }
    });

    const parsed = JSON.parse(output);
    expect(parsed.hookSpecificOutput.additionalContext).toBe(report);
    expect(parsed.hookSpecificOutput.additionalContext.length).toBeGreaterThan(0);
  });

  test('report includes actionable recommendation', () => {
    const updates = {
      architecture: true,
      domain: 'member',
      apiCatalog: false,
      dependencyMatrix: false,
      details: ['Domain file changed: member']
    };

    const report = formatUpdateReport(updates);
    expect(report).toContain('RECOMMENDATION');
    expect(report).toContain('architecture documentation');
  });
});

// ---------------------------------------------------------------------------
// Total: 60+ test cases across 25+ categories
// ---------------------------------------------------------------------------
