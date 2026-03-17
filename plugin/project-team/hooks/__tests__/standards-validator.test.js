/**
 * @TASK P2-T2 - Standards Validator Hook Tests
 * @TEST hooks/standards-validator.js
 *
 * Tests cover:
 *   1. File naming conventions (snake_case, PascalCase for components)
 *   2. Class naming conventions (PascalCase)
 *   3. Function naming conventions (camelCase for JS, snake_case for Python)
 *   4. Forbidden patterns (any, console.log, inline style, hardcoded colors, DOM)
 *   5. Architecture layer validation (dependency direction)
 *   6. Error handling validation (domain custom exceptions)
 *   7. Logging validation (structured JSON logging)
 *   8. Utility functions (isCommentLine, toPascalCase, etc.)
 *   9. Full pipeline (validateAll)
 *   10. Report formatting
 */

const {
  SUPPORTED_EXTENSIONS,
  FORBIDDEN_PATTERNS,
  ARCHITECTURE_LAYERS,
  validateFileName,
  validateClassNames,
  validateFunctionNames,
  validateForbiddenPatterns,
  validateArchitectureLayers,
  validateErrorHandling,
  validateLogging,
  validateAll,
  detectLayer,
  extractImportPaths,
  isCommentLine,
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  formatViolationReport,
  toRelativePath
} = require('../standards-validator');

// ---------------------------------------------------------------------------
// File Naming Convention
// ---------------------------------------------------------------------------

describe('validateFileName', () => {
  test('accepts snake_case Python file', () => {
    const violations = validateFileName('src/domains/auth/user_service.py');
    expect(violations).toHaveLength(0);
  });

  test('accepts snake_case JS file', () => {
    const violations = validateFileName('src/utils/string_helpers.js');
    expect(violations).toHaveLength(0);
  });

  test('accepts kebab-case JS file', () => {
    const violations = validateFileName('src/utils/string-helpers.js');
    expect(violations).toHaveLength(0);
  });

  test('accepts PascalCase component file (.tsx)', () => {
    const violations = validateFileName('src/components/UserProfile.tsx');
    expect(violations).toHaveLength(0);
  });

  test('accepts PascalCase component file (.jsx)', () => {
    const violations = validateFileName('src/components/LoginForm.jsx');
    expect(violations).toHaveLength(0);
  });

  test('accepts PascalCase component file (.vue)', () => {
    const violations = validateFileName('src/components/AppHeader.vue');
    expect(violations).toHaveLength(0);
  });

  test('rejects PascalCase for Python file', () => {
    const violations = validateFileName('src/domains/auth/UserService.py');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('naming');
    expect(violations[0].message).toContain('snake_case');
  });

  test('rejects PascalCase for non-component JS file', () => {
    const violations = validateFileName('src/utils/StringHelpers.js');
    expect(violations.length).toBeGreaterThan(0);
  });

  test('skips __init__.py files', () => {
    const violations = validateFileName('src/domains/auth/__init__.py');
    expect(violations).toHaveLength(0);
  });

  test('skips index.js files', () => {
    const violations = validateFileName('src/components/index.js');
    expect(violations).toHaveLength(0);
  });

  test('skips config files', () => {
    expect(validateFileName('jest.config.js')).toHaveLength(0);
    expect(validateFileName('vite.config.ts')).toHaveLength(0);
    expect(validateFileName('tsconfig.json')).toHaveLength(0);
  });

  test('skips non-code files', () => {
    expect(validateFileName('docs/readme.md')).toHaveLength(0);
    expect(validateFileName('data/users.json')).toHaveLength(0);
    expect(validateFileName('config.yaml')).toHaveLength(0);
  });

  test('accepts dotted names like permission-checker.test.js', () => {
    const violations = validateFileName('hooks/__tests__/permission-checker.test.js');
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Class Naming Convention
// ---------------------------------------------------------------------------

describe('validateClassNames', () => {
  test('accepts PascalCase class in Python', () => {
    const content = 'class UserService:\n    pass';
    const violations = validateClassNames(content, 'src/user_service.py');
    expect(violations).toHaveLength(0);
  });

  test('accepts PascalCase class in JS', () => {
    const content = 'class UserRepository {\n  constructor() {}\n}';
    const violations = validateClassNames(content, 'src/user_repository.js');
    expect(violations).toHaveLength(0);
  });

  test('accepts exported class in JS', () => {
    const content = 'export class AuthService {\n}';
    const violations = validateClassNames(content, 'src/auth_service.ts');
    expect(violations).toHaveLength(0);
  });

  test('accepts export default class in JS', () => {
    const content = 'export default class PaymentGateway {\n}';
    const violations = validateClassNames(content, 'src/payment.ts');
    expect(violations).toHaveLength(0);
  });

  test('rejects snake_case class name', () => {
    const content = 'class user_service:\n    pass';
    const violations = validateClassNames(content, 'src/service.py');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].severity).toBe('error');
    expect(violations[0].message).toContain('PascalCase');
  });

  test('rejects camelCase class name', () => {
    const content = 'class authService {\n}';
    const violations = validateClassNames(content, 'src/auth.ts');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('PascalCase');
  });

  test('reports correct line number', () => {
    const content = 'import os\n\n\nclass bad_class:\n    pass';
    const violations = validateClassNames(content, 'src/bad.py');
    expect(violations[0].line).toBe(4);
  });

  test('detects multiple class violations', () => {
    const content = 'class foo_bar:\n    pass\n\nclass baz_qux:\n    pass';
    const violations = validateClassNames(content, 'src/classes.py');
    expect(violations).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Function Naming Convention
// ---------------------------------------------------------------------------

describe('validateFunctionNames', () => {
  // Python: snake_case
  test('accepts snake_case function in Python', () => {
    const content = 'def get_user_by_id(user_id):\n    pass';
    const violations = validateFunctionNames(content, 'src/service.py');
    expect(violations).toHaveLength(0);
  });

  test('accepts async snake_case function in Python', () => {
    const content = 'async def create_order(data):\n    pass';
    const violations = validateFunctionNames(content, 'src/service.py');
    expect(violations).toHaveLength(0);
  });

  test('accepts dunder methods in Python', () => {
    const content = 'def __init__(self):\n    pass\ndef __str__(self):\n    pass';
    const violations = validateFunctionNames(content, 'src/model.py');
    expect(violations).toHaveLength(0);
  });

  test('accepts private methods starting with underscore', () => {
    const content = 'def _validate_input(data):\n    pass';
    const violations = validateFunctionNames(content, 'src/service.py');
    expect(violations).toHaveLength(0);
  });

  test('rejects camelCase function in Python', () => {
    const content = 'def getUserById(user_id):\n    pass';
    const violations = validateFunctionNames(content, 'src/service.py');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('snake_case');
  });

  test('rejects PascalCase function in Python', () => {
    const content = 'def GetUser(user_id):\n    pass';
    const violations = validateFunctionNames(content, 'src/service.py');
    expect(violations.length).toBeGreaterThan(0);
  });

  // JS/TS: camelCase
  test('accepts camelCase function in JS', () => {
    const content = 'function getUserById(userId) {\n  return null;\n}';
    const violations = validateFunctionNames(content, 'src/service.js');
    expect(violations).toHaveLength(0);
  });

  test('accepts async camelCase function in JS', () => {
    const content = 'async function fetchOrders() {\n  return [];\n}';
    const violations = validateFunctionNames(content, 'src/service.js');
    expect(violations).toHaveLength(0);
  });

  test('accepts exported function in JS', () => {
    const content = 'export function createUser(data) {\n}';
    const violations = validateFunctionNames(content, 'src/service.ts');
    expect(violations).toHaveLength(0);
  });

  test('accepts export default function in JS', () => {
    const content = 'export default function handleRequest(req) {\n}';
    const violations = validateFunctionNames(content, 'src/handler.ts');
    expect(violations).toHaveLength(0);
  });

  test('accepts PascalCase function in .tsx (component)', () => {
    const content = 'function UserProfile() {\n  return <div />;\n}';
    const violations = validateFunctionNames(content, 'src/UserProfile.tsx');
    expect(violations).toHaveLength(0);
  });

  test('rejects snake_case function in JS', () => {
    const content = 'function get_user_by_id(userId) {\n}';
    const violations = validateFunctionNames(content, 'src/service.js');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('camelCase');
  });

  test('reports correct line number', () => {
    const content = 'import os\n\ndef BadFunc(x):\n    pass';
    const violations = validateFunctionNames(content, 'src/service.py');
    expect(violations[0].line).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Forbidden Patterns
// ---------------------------------------------------------------------------

describe('validateForbiddenPatterns', () => {
  // any type
  describe('any type detection', () => {
    test('detects : any in TypeScript', () => {
      const content = 'const data: any = {};\nfunction foo(x: any): any {}';
      const violations = validateForbiddenPatterns(content, 'src/service.ts');
      const anyViolations = violations.filter(v => v.id === 'any-type');
      expect(anyViolations.length).toBeGreaterThan(0);
    });

    test('detects as any in TypeScript', () => {
      const content = 'const result = value as any;';
      const violations = validateForbiddenPatterns(content, 'src/service.ts');
      const anyViolations = violations.filter(v => v.id === 'any-type');
      expect(anyViolations.length).toBeGreaterThan(0);
    });

    test('does not flag any in .js files', () => {
      const content = 'const data = "any string";';
      const violations = validateForbiddenPatterns(content, 'src/service.js');
      const anyViolations = violations.filter(v => v.id === 'any-type');
      expect(anyViolations).toHaveLength(0);
    });

    test('skips any in comment lines', () => {
      const content = '// const data: any = {};\n/* as any */';
      const violations = validateForbiddenPatterns(content, 'src/service.ts');
      const anyViolations = violations.filter(v => v.id === 'any-type');
      expect(anyViolations).toHaveLength(0);
    });
  });

  // console.log
  describe('console.log detection', () => {
    test('detects console.log', () => {
      const content = 'console.log("hello");';
      const violations = validateForbiddenPatterns(content, 'src/service.js');
      const consoleViolations = violations.filter(v => v.id === 'console-log');
      expect(consoleViolations.length).toBeGreaterThan(0);
    });

    test('detects console.error', () => {
      const content = 'console.error("error");';
      const violations = validateForbiddenPatterns(content, 'src/service.js');
      const consoleViolations = violations.filter(v => v.id === 'console-log');
      expect(consoleViolations.length).toBeGreaterThan(0);
    });

    test('detects console.warn', () => {
      const content = 'console.warn("warning");';
      const violations = validateForbiddenPatterns(content, 'src/service.ts');
      const consoleViolations = violations.filter(v => v.id === 'console-log');
      expect(consoleViolations.length).toBeGreaterThan(0);
    });

    test('does not flag in .py files', () => {
      const content = 'console.log("test")';  // Not really Python, but extension check
      const violations = validateForbiddenPatterns(content, 'src/service.py');
      const consoleViolations = violations.filter(v => v.id === 'console-log');
      expect(consoleViolations).toHaveLength(0);
    });

    test('skips commented console.log', () => {
      const content = '// console.log("debug");';
      const violations = validateForbiddenPatterns(content, 'src/service.js');
      const consoleViolations = violations.filter(v => v.id === 'console-log');
      expect(consoleViolations).toHaveLength(0);
    });
  });

  // inline style
  describe('inline style detection', () => {
    test('detects style={{ }} in JSX', () => {
      const content = '<div style={{ color: "red" }}>';
      const violations = validateForbiddenPatterns(content, 'src/Component.tsx');
      const styleViolations = violations.filter(v => v.id === 'inline-style');
      expect(styleViolations.length).toBeGreaterThan(0);
    });

    test('detects style="..." in templates', () => {
      const content = '<div style="color: red;">';
      const violations = validateForbiddenPatterns(content, 'src/Component.vue');
      const styleViolations = violations.filter(v => v.id === 'inline-style');
      expect(styleViolations.length).toBeGreaterThan(0);
    });

    test('does not flag in .js files', () => {
      const content = 'const style = { color: "red" };';
      const violations = validateForbiddenPatterns(content, 'src/service.js');
      const styleViolations = violations.filter(v => v.id === 'inline-style');
      expect(styleViolations).toHaveLength(0);
    });
  });

  // hardcoded colors
  describe('hardcoded color detection', () => {
    test('detects hex color in JSX', () => {
      const content = 'const color = "#ff0000";';
      const violations = validateForbiddenPatterns(content, 'src/component.tsx');
      const colorViolations = violations.filter(v => v.id === 'hardcoded-color');
      expect(colorViolations.length).toBeGreaterThan(0);
    });

    test('detects rgb() color', () => {
      const content = 'background-color: rgb(255, 0, 0);';
      const violations = validateForbiddenPatterns(content, 'src/styles.css');
      const colorViolations = violations.filter(v => v.id === 'hardcoded-color');
      expect(colorViolations.length).toBeGreaterThan(0);
    });

    test('detects rgba() color', () => {
      const content = 'color: rgba(0, 0, 0, 0.5);';
      const violations = validateForbiddenPatterns(content, 'src/styles.scss');
      const colorViolations = violations.filter(v => v.id === 'hardcoded-color');
      expect(colorViolations.length).toBeGreaterThan(0);
    });

    test('skips CSS custom property definitions', () => {
      const content = '--color-primary: #ff0000;';
      const violations = validateForbiddenPatterns(content, 'src/theme.css');
      const colorViolations = violations.filter(v => v.id === 'hardcoded-color');
      expect(colorViolations).toHaveLength(0);
    });

    test('skips design token files', () => {
      const content = 'const primary = "#ff0000";';
      const violations = validateForbiddenPatterns(content, 'src/design/tokens.ts');
      const colorViolations = violations.filter(v => v.id === 'hardcoded-color');
      expect(colorViolations).toHaveLength(0);
    });

    test('skips var() references', () => {
      const content = 'color: var(--primary);';
      const violations = validateForbiddenPatterns(content, 'src/styles.css');
      const colorViolations = violations.filter(v => v.id === 'hardcoded-color');
      expect(colorViolations).toHaveLength(0);
    });
  });

  // direct DOM manipulation
  describe('direct DOM manipulation detection', () => {
    test('detects document.getElementById', () => {
      const content = 'const el = document.getElementById("root");';
      const violations = validateForbiddenPatterns(content, 'src/service.js');
      const domViolations = violations.filter(v => v.id === 'direct-dom');
      expect(domViolations.length).toBeGreaterThan(0);
    });

    test('detects document.querySelector', () => {
      const content = 'const el = document.querySelector(".container");';
      const violations = validateForbiddenPatterns(content, 'src/utils.ts');
      const domViolations = violations.filter(v => v.id === 'direct-dom');
      expect(domViolations.length).toBeGreaterThan(0);
    });

    test('detects innerHTML assignment', () => {
      const content = 'element.innerHTML = "<p>hello</p>";';
      const violations = validateForbiddenPatterns(content, 'src/renderer.js');
      const domViolations = violations.filter(v => v.id === 'direct-dom');
      expect(domViolations.length).toBeGreaterThan(0);
    });

    test('detects document.createElement', () => {
      const content = 'const div = document.createElement("div");';
      const violations = validateForbiddenPatterns(content, 'src/builder.ts');
      const domViolations = violations.filter(v => v.id === 'direct-dom');
      expect(domViolations.length).toBeGreaterThan(0);
    });

    test('skips test files', () => {
      const content = 'const el = document.getElementById("root");';
      const violations = validateForbiddenPatterns(content, 'src/service.test.js');
      const domViolations = violations.filter(v => v.id === 'direct-dom');
      expect(domViolations).toHaveLength(0);
    });

    test('skips __tests__ directory', () => {
      const content = 'document.querySelector("#app");';
      const violations = validateForbiddenPatterns(content, 'src/__tests__/helper.js');
      const domViolations = violations.filter(v => v.id === 'direct-dom');
      expect(domViolations).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Architecture Layer Validation
// ---------------------------------------------------------------------------

describe('detectLayer', () => {
  test('detects presentation layer', () => {
    expect(detectLayer('src/domains/auth/routes/auth_routes.py')).toEqual(
      { layer: 'presentation', index: 0 }
    );
    expect(detectLayer('src/domains/auth/controllers/user_controller.py')).toEqual(
      { layer: 'presentation', index: 0 }
    );
    expect(detectLayer('src/pages/home.tsx')).toEqual(
      { layer: 'presentation', index: 0 }
    );
  });

  test('detects application layer', () => {
    expect(detectLayer('src/domains/auth/services/auth_service.py')).toEqual(
      { layer: 'application', index: 1 }
    );
    expect(detectLayer('src/domains/order/usecases/create_order.py')).toEqual(
      { layer: 'application', index: 1 }
    );
  });

  test('detects domain layer', () => {
    expect(detectLayer('src/domains/auth/models/user.py')).toEqual(
      { layer: 'domain', index: 2 }
    );
    expect(detectLayer('src/domains/auth/entities/user_entity.py')).toEqual(
      { layer: 'domain', index: 2 }
    );
  });

  test('detects infrastructure layer', () => {
    expect(detectLayer('src/domains/auth/repositories/user_repo.py')).toEqual(
      { layer: 'infrastructure', index: 3 }
    );
    expect(detectLayer('src/external/stripe_client.py')).toEqual(
      { layer: 'infrastructure', index: 3 }
    );
  });

  test('returns null for unknown layer', () => {
    expect(detectLayer('src/utils/helpers.py')).toBeNull();
    expect(detectLayer('config/settings.py')).toBeNull();
  });
});

describe('extractImportPaths', () => {
  test('extracts Python from...import path', () => {
    const paths = extractImportPaths('from app.domains.auth.services.auth_service import AuthService', '.py');
    expect(paths).toContain('app/domains/auth/services/auth_service');
  });

  test('extracts Python import path', () => {
    const paths = extractImportPaths('import app.domains.auth.models.user', '.py');
    expect(paths).toContain('app/domains/auth/models/user');
  });

  test('extracts JS import path', () => {
    const paths = extractImportPaths("import { UserService } from '../services/user_service';", '.ts');
    expect(paths).toContain('../services/user_service');
  });

  test('extracts JS require path', () => {
    const paths = extractImportPaths("const user = require('./models/user');", '.js');
    expect(paths).toContain('./models/user');
  });

  test('returns empty for non-import lines', () => {
    const paths = extractImportPaths('const x = 42;', '.js');
    expect(paths).toHaveLength(0);
  });
});

describe('validateArchitectureLayers', () => {
  test('allows presentation importing from application', () => {
    const content = 'from app.domains.auth.services.auth_service import AuthService';
    const violations = validateArchitectureLayers(content, 'src/domains/auth/routes/auth_routes.py');
    expect(violations).toHaveLength(0);
  });

  test('allows application importing from domain', () => {
    const content = 'from app.domains.auth.models.user import User';
    const violations = validateArchitectureLayers(content, 'src/domains/auth/services/auth_service.py');
    expect(violations).toHaveLength(0);
  });

  test('detects domain importing from presentation (reverse dependency)', () => {
    const content = 'from app.domains.auth.routes.auth_routes import router';
    const violations = validateArchitectureLayers(content, 'src/domains/auth/models/user.py');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('architecture');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].source).toBe('domain');
    expect(violations[0].target).toBe('presentation');
  });

  test('detects domain importing from application (reverse dependency)', () => {
    const content = 'from app.domains.auth.services.auth_service import AuthService';
    const violations = validateArchitectureLayers(content, 'src/domains/auth/models/user.py');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].source).toBe('domain');
    expect(violations[0].target).toBe('application');
  });

  test('detects application importing from presentation', () => {
    const content = 'from app.domains.auth.routes.auth_routes import router';
    const violations = validateArchitectureLayers(content, 'src/domains/auth/services/auth_service.py');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].source).toBe('application');
    expect(violations[0].target).toBe('presentation');
  });

  test('allows infrastructure importing from domain', () => {
    const content = 'from app.domains.auth.models.user import User';
    const violations = validateArchitectureLayers(content, 'src/domains/auth/repositories/user_repo.py');
    expect(violations).toHaveLength(0);
  });

  test('skips non-code files', () => {
    const content = 'from app.domains.auth.routes import router';
    const violations = validateArchitectureLayers(content, 'docs/notes.md');
    expect(violations).toHaveLength(0);
  });

  test('skips files without detectable layer', () => {
    const content = 'from app.domains.auth.routes import router';
    const violations = validateArchitectureLayers(content, 'src/utils/helpers.py');
    expect(violations).toHaveLength(0);
  });

  test('works with JS/TS imports', () => {
    const content = "import { router } from '../routes/auth_routes';";
    const violations = validateArchitectureLayers(content, 'src/domains/auth/models/user.ts');
    expect(violations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Error Handling Validation
// ---------------------------------------------------------------------------

describe('validateErrorHandling', () => {
  test('detects generic Exception in domain layer (Python)', () => {
    const content = 'def validate(self):\n    raise Exception("invalid")';
    const violations = validateErrorHandling(content, 'src/domains/auth/models/user.py');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('error-handling');
    expect(violations[0].message).toContain('Exception');
  });

  test('detects RuntimeError in domain layer (Python)', () => {
    const content = 'raise RuntimeError("something went wrong")';
    const violations = validateErrorHandling(content, 'src/domains/auth/models/user.py');
    expect(violations.length).toBeGreaterThan(0);
  });

  test('detects generic Error in domain layer (JS)', () => {
    const content = 'throw new Error("invalid input");';
    const violations = validateErrorHandling(content, 'src/domains/auth/models/user.ts');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('Error');
  });

  test('skips non-domain layer files', () => {
    const content = 'raise Exception("service error")';
    const violations = validateErrorHandling(content, 'src/domains/auth/services/auth_service.py');
    expect(violations).toHaveLength(0);
  });

  test('skips test files', () => {
    const content = 'raise Exception("test error")';
    const violations = validateErrorHandling(content, 'tests/auth/test_user.py');
    // validateErrorHandling only checks domain layer, tests are not domain
    expect(violations).toHaveLength(0);
  });

  test('allows custom domain exceptions', () => {
    const content = 'raise UserNotFoundError("user not found")';
    const violations = validateErrorHandling(content, 'src/domains/auth/models/user.py');
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Logging Validation
// ---------------------------------------------------------------------------

describe('validateLogging', () => {
  test('detects print() in Python production code', () => {
    const content = 'def process():\n    print("processing")';
    const violations = validateLogging(content, 'src/domains/auth/services/auth_service.py');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('logging');
  });

  test('allows print in __main__ block', () => {
    const content = 'if __name__ == "__main__":\n    print("running")';
    const violations = validateLogging(content, 'src/scripts/runner.py');
    expect(violations).toHaveLength(0);
  });

  test('skips test files (Python)', () => {
    const content = 'print("test output")';
    const violations = validateLogging(content, 'tests/auth/test_user.py');
    expect(violations).toHaveLength(0);
  });

  test('skips test files (JS)', () => {
    const content = 'console.log("test");';
    const violations = validateLogging(content, 'src/service.test.js');
    expect(violations).toHaveLength(0);
  });

  test('skips conftest.py', () => {
    const content = 'print("fixture setup")';
    const violations = validateLogging(content, 'tests/conftest.py');
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

describe('isCommentLine', () => {
  test('detects Python comment', () => {
    expect(isCommentLine('  # This is a comment', '.py')).toBe(true);
    expect(isCommentLine('x = 1  # inline', '.py')).toBe(false);
  });

  test('detects JS/TS single-line comment', () => {
    expect(isCommentLine('  // This is a comment', '.js')).toBe(true);
    expect(isCommentLine('  // comment', '.ts')).toBe(true);
  });

  test('detects JS/TS multi-line comment markers', () => {
    expect(isCommentLine('  /* start */', '.js')).toBe(true);
    expect(isCommentLine('  * middle', '.js')).toBe(true);
  });

  test('detects HTML comment in Vue', () => {
    expect(isCommentLine('  <!-- comment -->', '.vue')).toBe(true);
  });

  test('does not flag code as comment', () => {
    expect(isCommentLine('const x = 1;', '.js')).toBe(false);
    expect(isCommentLine('x = 1', '.py')).toBe(false);
  });
});

describe('toPascalCase', () => {
  test('converts snake_case to PascalCase', () => {
    expect(toPascalCase('user_service')).toBe('UserService');
    expect(toPascalCase('auth_handler')).toBe('AuthHandler');
  });

  test('converts kebab-case to PascalCase', () => {
    expect(toPascalCase('user-service')).toBe('UserService');
  });

  test('converts camelCase to PascalCase', () => {
    expect(toPascalCase('userService')).toBe('UserService');
  });
});

describe('toCamelCase', () => {
  test('converts snake_case to camelCase', () => {
    expect(toCamelCase('get_user_by_id')).toBe('getUserById');
    expect(toCamelCase('create_order')).toBe('createOrder');
  });

  test('converts PascalCase to camelCase', () => {
    expect(toCamelCase('UserService')).toBe('userService');
  });
});

describe('toSnakeCase', () => {
  test('converts camelCase to snake_case', () => {
    expect(toSnakeCase('getUserById')).toBe('get_user_by_id');
    expect(toSnakeCase('createOrder')).toBe('create_order');
  });

  test('converts PascalCase to snake_case', () => {
    expect(toSnakeCase('UserService')).toBe('user_service');
  });
});

// ---------------------------------------------------------------------------
// Full Validation Pipeline
// ---------------------------------------------------------------------------

describe('validateAll', () => {
  test('runs all checks on Python file', () => {
    const content = [
      'class user_model:',
      '    def GetUser(self):',
      '        raise Exception("not found")',
      '        print("debug")'
    ].join('\n');
    const violations = validateAll(content, 'src/domains/auth/models/user_model.py');
    expect(violations.length).toBeGreaterThan(0);
    // Should have: class naming, function naming, error handling, logging violations
    const types = new Set(violations.map(v => v.type));
    expect(types.has('naming')).toBe(true);
    expect(types.has('error-handling')).toBe(true);
    expect(types.has('logging')).toBe(true);
  });

  test('runs all checks on TypeScript file', () => {
    const content = [
      'const data: any = {};',
      'console.log("debug");',
      'class user_repo {',
      '  innerHTML = "<p></p>";',
      '}'
    ].join('\n');
    const violations = validateAll(content, 'src/domains/auth/repositories/user_repo.ts');
    expect(violations.length).toBeGreaterThan(0);
    const ids = violations.map(v => v.id).filter(Boolean);
    expect(ids).toContain('any-type');
    expect(ids).toContain('console-log');
  });

  test('skips non-supported file types', () => {
    const content = '# Just markdown\nSome text with any random content.';
    const violations = validateAll(content, 'docs/readme.md');
    expect(violations).toHaveLength(0);
  });

  test('returns no violations for clean code', () => {
    const content = [
      'class UserService:',
      '    def get_user_by_id(self, user_id):',
      '        pass',
      '',
      '    def create_user(self, data):',
      '        pass'
    ].join('\n');
    const violations = validateAll(content, 'src/domains/auth/services/user_service.py');
    expect(violations).toHaveLength(0);
  });

  test('returns no violations for clean TypeScript', () => {
    const content = [
      'import { UserRepository } from "../repositories/user_repository";',
      '',
      'export class UserService {',
      '  private readonly repo: UserRepository;',
      '',
      '  async getUser(id: string): Promise<User> {',
      '    return this.repo.findById(id);',
      '  }',
      '}'
    ].join('\n');
    const violations = validateAll(content, 'src/domains/auth/services/user_service.ts');
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Report Formatting
// ---------------------------------------------------------------------------

describe('formatViolationReport', () => {
  test('returns empty string for no violations', () => {
    const report = formatViolationReport([], 'src/service.py');
    expect(report).toBe('');
  });

  test('includes file path in report', () => {
    const violations = [
      { type: 'naming', severity: 'error', message: 'Bad name', line: 1 }
    ];
    const report = formatViolationReport(violations, 'src/bad_service.py');
    expect(report).toContain('src/bad_service.py');
    expect(report).toContain('1 violation(s)');
  });

  test('counts errors and warnings separately', () => {
    const violations = [
      { type: 'naming', severity: 'error', message: 'Bad class', line: 1 },
      { type: 'naming', severity: 'warning', message: 'Bad func', line: 3 },
      { type: 'forbidden', severity: 'error', message: 'console.log', line: 5 }
    ];
    const report = formatViolationReport(violations, 'src/service.ts');
    expect(report).toContain('Errors: 2');
    expect(report).toContain('Warnings: 1');
  });

  test('groups violations by type', () => {
    const violations = [
      { type: 'naming', severity: 'error', message: 'Bad name', line: 1 },
      { type: 'forbidden', severity: 'error', message: 'console.log', line: 5 },
      { type: 'naming', severity: 'warning', message: 'Bad func', line: 3 }
    ];
    const report = formatViolationReport(violations, 'src/service.ts');
    expect(report).toContain('-- Naming --');
    expect(report).toContain('-- Forbidden --');
  });

  test('includes fix suggestions', () => {
    const violations = [
      {
        type: 'forbidden',
        severity: 'error',
        message: 'console.log forbidden',
        fix: 'Use logger instead',
        line: 1
      }
    ];
    const report = formatViolationReport(violations, 'src/service.js');
    expect(report).toContain('Fix: Use logger instead');
  });

  test('includes line content when available', () => {
    const violations = [
      {
        type: 'forbidden',
        severity: 'warning',
        message: 'console.log',
        line: 1,
        lineContent: 'console.log("hello")'
      }
    ];
    const report = formatViolationReport(violations, 'src/service.js');
    expect(report).toContain('Code: console.log("hello")');
  });

  test('includes reference to standards document', () => {
    const violations = [
      { type: 'naming', severity: 'error', message: 'Bad name', line: 1 }
    ];
    const report = formatViolationReport(violations, 'src/service.py');
    expect(report).toContain('contracts/standards/coding-standards.md');
  });
});

// ---------------------------------------------------------------------------
// Relative Path Resolution
// ---------------------------------------------------------------------------

describe('toRelativePath', () => {
  test('returns empty string for empty input', () => {
    expect(toRelativePath('')).toBe('');
    expect(toRelativePath(null)).toBe('');
    expect(toRelativePath(undefined)).toBe('');
  });

  test('returns relative path as-is', () => {
    expect(toRelativePath('src/domains/auth/models/user.py'))
      .toBe('src/domains/auth/models/user.py');
  });
});

// ---------------------------------------------------------------------------
// SUPPORTED_EXTENSIONS and ARCHITECTURE_LAYERS config
// ---------------------------------------------------------------------------

describe('Configuration', () => {
  test('SUPPORTED_EXTENSIONS includes common file types', () => {
    expect(SUPPORTED_EXTENSIONS.has('.js')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.ts')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.tsx')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.py')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.css')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.vue')).toBe(true);
    expect(SUPPORTED_EXTENSIONS.has('.svelte')).toBe(true);
  });

  test('ARCHITECTURE_LAYERS has 4 layers in correct order', () => {
    expect(ARCHITECTURE_LAYERS).toHaveLength(4);
    expect(ARCHITECTURE_LAYERS[0].name).toBe('presentation');
    expect(ARCHITECTURE_LAYERS[1].name).toBe('application');
    expect(ARCHITECTURE_LAYERS[2].name).toBe('domain');
    expect(ARCHITECTURE_LAYERS[3].name).toBe('infrastructure');
  });

  test('FORBIDDEN_PATTERNS has 5 rules', () => {
    expect(FORBIDDEN_PATTERNS).toHaveLength(5);
    const ids = FORBIDDEN_PATTERNS.map(p => p.id);
    expect(ids).toContain('any-type');
    expect(ids).toContain('console-log');
    expect(ids).toContain('inline-style');
    expect(ids).toContain('hardcoded-color');
    expect(ids).toContain('direct-dom');
  });
});
