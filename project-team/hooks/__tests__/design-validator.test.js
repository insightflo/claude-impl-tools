/**
 * @TASK P2-T3 - Design Validator Hook Tests
 * @TEST hooks/design-validator.js
 *
 * Tests cover:
 *   1. Inline style detection (React style={{}} pattern)
 *   2. Hardcoded color value detection (#fff, rgb(), hsl())
 *   3. Non-standard spacing validation (4px multiples)
 *   4. Design token usage validation
 *   5. File pattern matching (validation vs skip)
 *   6. Violation message formatting
 */

const {
  DESIGN_TOKENS,
  FORBIDDEN_PATTERNS,
  VALIDATION_PATTERNS,
  SKIP_PATTERNS,
  globToRegex,
  matchesAnyPattern,
  shouldValidate,
  validateContent,
  getLineNumber,
  getLineStartIndex,
  formatViolationMessage,
  formatWarningContext,
  toRelativePath
} = require('../design-validator');

// ---------------------------------------------------------------------------
// Path Matching
// ---------------------------------------------------------------------------

describe('globToRegex', () => {
  test('matches exact file path', () => {
    const regex = globToRegex('src/components/Button.tsx');
    expect(regex.test('src/components/Button.tsx')).toBe(true);
    expect(regex.test('src/components/Card.tsx')).toBe(false);
  });

  test('matches wildcard patterns', () => {
    const regex = globToRegex('**/*.tsx');
    expect(regex.test('src/components/Button.tsx')).toBe(true);
    expect(regex.test('src/pages/Home/index.tsx')).toBe(true);
    expect(regex.test('src/utils/helpers.ts')).toBe(false);
  });

  test('matches CSS files', () => {
    const regex = globToRegex('**/*.css');
    expect(regex.test('src/styles/global.css')).toBe(true);
    expect(regex.test('src/components/Button.module.css')).toBe(true);
  });
});

describe('matchesAnyPattern', () => {
  test('matches validation patterns', () => {
    expect(matchesAnyPattern('src/components/Button.tsx', VALIDATION_PATTERNS)).toBe(true);
    expect(matchesAnyPattern('src/components/Button.jsx', VALIDATION_PATTERNS)).toBe(true);
    expect(matchesAnyPattern('src/styles/global.css', VALIDATION_PATTERNS)).toBe(true);
  });

  test('does not match non-UI files', () => {
    expect(matchesAnyPattern('src/utils/helpers.ts', VALIDATION_PATTERNS)).toBe(false);
    expect(matchesAnyPattern('src/api/client.ts', VALIDATION_PATTERNS)).toBe(false);
  });
});

describe('shouldValidate', () => {
  test('validates UI component files', () => {
    expect(shouldValidate('src/components/Button.tsx')).toBe(true);
    expect(shouldValidate('src/pages/Home.jsx')).toBe(true);
    expect(shouldValidate('src/styles/global.css')).toBe(true);
  });

  test('skips design token definition files', () => {
    expect(shouldValidate('src/styles/tokens.css')).toBe(false);
    expect(shouldValidate('src/styles/design-tokens.css')).toBe(false);
    expect(shouldValidate('src/theme/theme.ts')).toBe(false);
  });

  test('skips test files', () => {
    expect(shouldValidate('src/components/__tests__/Button.test.tsx')).toBe(false);
    expect(shouldValidate('src/components/Button.spec.tsx')).toBe(false);
  });

  test('skips non-UI files', () => {
    expect(shouldValidate('src/utils/helpers.ts')).toBe(false);
    expect(shouldValidate('README.md')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Inline Style Detection
// ---------------------------------------------------------------------------

describe('validateContent - Inline Styles', () => {
  test('detects React inline styles', () => {
    const content = `
      <div style={{ color: 'red', fontSize: '16px' }}>
        Hello World
      </div>
    `;
    const result = validateContent(content, 'Button.tsx');
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].pattern).toBe('inlineStyle');
    expect(result.violations[0].message).toContain('Inline styles are forbidden');
  });

  test('detects multiple inline styles', () => {
    const content = `
      <div style={{ color: 'red' }}>
        <span style={{ fontSize: '14px' }}>Text</span>
      </div>
    `;
    const result = validateContent(content, 'Component.tsx');
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  test('allows no inline styles', () => {
    const content = `
      <div className="button">
        <span className="text">Hello</span>
      </div>
    `;
    const result = validateContent(content, 'Button.tsx');
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Hardcoded Color Detection
// ---------------------------------------------------------------------------

describe('validateContent - Hardcoded Colors', () => {
  test('detects hex colors', () => {
    const content = `
      .button {
        background-color: #3b82f6;
        color: #fff;
      }
    `;
    const result = validateContent(content, 'styles.css');
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.pattern === 'hexColor')).toBe(true);
  });

  test('detects RGB colors', () => {
    const content = `
      .card {
        background: rgb(255, 255, 255);
      }
    `;
    const result = validateContent(content, 'Card.css');
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.pattern === 'rgbColor')).toBe(true);
  });

  test('detects HSL colors', () => {
    const content = `
      .alert {
        background: hsl(0, 100%, 50%);
      }
    `;
    const result = validateContent(content, 'Alert.css');
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.pattern === 'hslColor')).toBe(true);
  });

  test('allows design token colors', () => {
    const content = `
      .button {
        background-color: var(--color-primary);
        color: var(--color-text);
      }
    `;
    const result = validateContent(content, 'Button.css');
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Non-Standard Spacing Detection
// ---------------------------------------------------------------------------

describe('validateContent - Non-Standard Spacing', () => {
  test('detects non-4px-multiple spacing', () => {
    const content = `
      .card {
        padding: 15px;
        margin: 5px;
      }
    `;
    const result = validateContent(content, 'Card.css');
    // These should be warnings, not errors
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.pattern === 'nonStandardSpacing')).toBe(true);
  });

  test('allows standard 4px multiples', () => {
    const content = `
      .card {
        padding: 16px;
        margin: 24px;
        gap: 8px;
      }
    `;
    const result = validateContent(content, 'Card.css');
    // Should have no spacing warnings for 16, 24, 8 (all 4px multiples)
    const spacingWarnings = result.warnings.filter(w => w.pattern === 'nonStandardSpacing');
    expect(spacingWarnings).toHaveLength(0);
  });

  test('allows design token spacing', () => {
    const content = `
      .card {
        padding: var(--space-4);
        margin: var(--space-6);
      }
    `;
    const result = validateContent(content, 'Card.css');
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  test('validates rem/em values', () => {
    const content = `
      .card {
        padding: 1.5rem; /* 24px = OK */
        margin: 0.3125rem; /* 5px = NOT OK */
      }
    `;
    const result = validateContent(content, 'Card.css');
    // 0.3125rem = 5px (not 4px multiple) should warn
    const spacingWarnings = result.warnings.filter(w => w.pattern === 'nonStandardSpacing');
    expect(spacingWarnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Line Number Detection
// ---------------------------------------------------------------------------

describe('getLineNumber', () => {
  test('calculates correct line number', () => {
    const content = `line 1
line 2
line 3
line 4`;
    const indexOfLine3 = content.indexOf('line 3');
    expect(getLineNumber(content, indexOfLine3)).toBe(3);
  });

  test('handles first line', () => {
    const content = 'line 1\nline 2';
    expect(getLineNumber(content, 0)).toBe(1);
  });
});

describe('getLineStartIndex', () => {
  test('finds line start index', () => {
    const content = 'line 1\nline 2\nline 3';
    const indexInLine2 = content.indexOf('line 2') + 3; // Middle of "line 2"
    const lineStartIndex = getLineStartIndex(content, indexInLine2);
    expect(lineStartIndex).toBe(7); // After "line 1\n"
  });

  test('handles first line', () => {
    const content = 'line 1\nline 2';
    expect(getLineStartIndex(content, 3)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Message Formatting
// ---------------------------------------------------------------------------

describe('formatViolationMessage', () => {
  test('formats error violations', () => {
    const violations = [
      {
        line: 10,
        message: 'Inline styles are forbidden',
        match: 'style={{ color: "red" }}'
      }
    ];
    const message = formatViolationMessage('Button.tsx', violations, []);
    expect(message).toContain('Design System Violation');
    expect(message).toContain('Button.tsx');
    expect(message).toContain('Line 10');
    expect(message).toContain('Inline styles are forbidden');
  });

  test('formats warnings', () => {
    const warnings = [
      {
        line: 5,
        message: 'Use standard spacing values',
        match: 'padding: 15px'
      }
    ];
    const message = formatViolationMessage('Card.css', [], warnings);
    expect(message).toContain('WARNINGS');
    expect(message).toContain('Line 5');
    expect(message).toContain('padding: 15px');
  });

  test('includes design guide reference', () => {
    const message = formatViolationMessage('Component.tsx', [], []);
    expect(message).toContain('Design System Guide');
    expect(message).toContain('var(--color-');
    expect(message).toContain('4px multiples');
  });
});

describe('formatWarningContext', () => {
  test('formats warning context', () => {
    const warnings = [
      {
        line: 8,
        message: 'Use standard spacing',
        match: 'margin: 5px'
      }
    ];
    const message = formatWarningContext('Card.tsx', warnings);
    expect(message).toContain('Card.tsx');
    expect(message).toContain('design warning');
    expect(message).toContain('Line 8');
  });
});

// ---------------------------------------------------------------------------
// Path Resolution
// ---------------------------------------------------------------------------

describe('toRelativePath', () => {
  test('converts absolute path to relative', () => {
    const projectDir = '/Users/kwak/Projects/my-project';
    process.env.CLAUDE_PROJECT_DIR = projectDir;

    const absolutePath = '/Users/kwak/Projects/my-project/src/components/Button.tsx';
    const relative = toRelativePath(absolutePath);

    expect(relative).toBe('src/components/Button.tsx');
  });

  test('returns relative path as-is', () => {
    const relativePath = 'src/components/Button.tsx';
    expect(toRelativePath(relativePath)).toBe(relativePath);
  });

  test('returns empty string for empty input', () => {
    expect(toRelativePath('')).toBe('');
    expect(toRelativePath(null)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('Integration: Full Validation', () => {
  test('validates complex React component with multiple violations', () => {
    const content = `
import React from 'react';

export function Card() {
  return (
    <div
      style={{ backgroundColor: '#f3f4f6', padding: '15px' }}
      className="card"
    >
      <h2 style={{ color: 'rgb(31, 41, 55)', fontSize: '18px' }}>Title</h2>
      <p>Description</p>
    </div>
  );
}
    `;

    const result = validateContent(content, 'Card.tsx');

    expect(result.valid).toBe(false);

    // Should detect inline styles (2 occurrences)
    const inlineStyleViolations = result.violations.filter(v => v.pattern === 'inlineStyle');
    expect(inlineStyleViolations.length).toBeGreaterThan(0);

    // Should detect hardcoded colors
    const colorViolations = result.violations.filter(
      v => v.pattern === 'hexColor' || v.pattern === 'rgbColor'
    );
    expect(colorViolations.length).toBeGreaterThan(0);

    // Should have spacing warnings for 15px
    const spacingWarnings = result.warnings.filter(w => w.pattern === 'nonStandardSpacing');
    expect(spacingWarnings.length).toBeGreaterThan(0);
  });

  test('validates clean component with design tokens', () => {
    const content = `
import React from 'react';
import './Card.css';

export function Card() {
  return (
    <div className="card">
      <h2 className="card-title">Title</h2>
      <p className="card-description">Description</p>
    </div>
  );
}

/* Card.css */
.card {
  background-color: var(--color-surface);
  padding: var(--space-4);
  border-radius: 8px;
}

.card-title {
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-2);
}

.card-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
    `;

    const result = validateContent(content, 'Card.tsx');

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});
