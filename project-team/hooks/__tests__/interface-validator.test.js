/**
 * @TASK P2-T5 - Interface Contract Validator Hook Tests
 * @TEST hooks/interface-validator.js
 *
 * Tests cover:
 *   1. Simple YAML parsing
 *   2. File pattern matching (interface contract paths)
 *   3. Endpoint field extraction
 *   4. Consumer extraction
 *   5. Change detection (add, remove, type change, version bump)
 *   6. Breaking change classification
 *   7. Impact analysis (consumer identification)
 *   8. New spec structure validation
 *   9. Report formatting
 *   10. Integration scenarios
 */

const {
  VALIDATION_PATTERNS,
  CHANGE_TYPES,
  parseSimpleYaml,
  splitKeyValue,
  parseValue,
  globToRegex,
  matchesAnyPattern,
  shouldValidate,
  extractEndpointFields,
  extractConsumers,
  detectChanges,
  analyzeImpact,
  validateSpecStructure,
  formatImpactReport,
  formatNewSpecReport,
  formatImpactJson,
  toRelativePath
} = require('../interface-validator');

// ---------------------------------------------------------------------------
// YAML Parsing
// ---------------------------------------------------------------------------

describe('parseSimpleYaml', () => {
  test('parses simple key-value pairs', () => {
    const yaml = `
version: 1.0.0
domain: member
    `;
    const result = parseSimpleYaml(yaml);
    expect(result.version).toBe('1.0.0');
    expect(result.domain).toBe('member');
  });

  test('parses numeric and boolean values', () => {
    const yaml = `
count: 42
enabled: true
disabled: false
ratio: 3.14
    `;
    const result = parseSimpleYaml(yaml);
    expect(result.count).toBe(42);
    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
    expect(result.ratio).toBe(3.14);
  });

  test('parses null values', () => {
    const yaml = `
empty: null
tilde: ~
    `;
    const result = parseSimpleYaml(yaml);
    expect(result.empty).toBe(null);
    expect(result.tilde).toBe(null);
  });

  test('parses inline arrays', () => {
    const yaml = `
tags: [api, member, auth]
    `;
    const result = parseSimpleYaml(yaml);
    expect(result.tags).toEqual(['api', 'member', 'auth']);
  });

  test('handles empty or invalid input', () => {
    expect(parseSimpleYaml('')).toEqual({});
    expect(parseSimpleYaml(null)).toEqual({});
    expect(parseSimpleYaml(undefined)).toEqual({});
    expect(parseSimpleYaml(123)).toEqual({});
  });

  test('ignores comments', () => {
    const yaml = `
# This is a comment
version: 1.0.0
# Another comment
domain: member
    `;
    const result = parseSimpleYaml(yaml);
    expect(result.version).toBe('1.0.0');
    expect(result.domain).toBe('member');
  });

  test('parses nested objects', () => {
    const yaml = `
version: 1.0.0
domain: member
endpoints:
  - path: /api/members/{id}
    method: GET
    response:
      id: uuid
      name: string
      email: string
    `;
    const result = parseSimpleYaml(yaml);
    expect(result.version).toBe('1.0.0');
    expect(result.domain).toBe('member');
    expect(result.endpoints).toBeDefined();
    expect(Array.isArray(result.endpoints)).toBe(true);
  });
});

describe('splitKeyValue', () => {
  test('splits simple key-value', () => {
    const result = splitKeyValue('name: John');
    expect(result.key).toBe('name');
    expect(result.value).toBe('John');
  });

  test('handles value with colons', () => {
    const result = splitKeyValue('path: /api/v1:8080/items');
    expect(result.key).toBe('path');
    expect(result.value).toBe('/api/v1:8080/items');
  });

  test('handles no colon', () => {
    const result = splitKeyValue('no-colon-here');
    expect(result.key).toBe(null);
    expect(result.value).toBe(null);
  });

  test('handles empty value', () => {
    const result = splitKeyValue('key:');
    expect(result.key).toBe('key');
    expect(result.value).toBe('');
  });
});

describe('parseValue', () => {
  test('parses strings', () => {
    expect(parseValue('hello')).toBe('hello');
    expect(parseValue('"quoted"')).toBe('quoted');
    expect(parseValue("'single'")).toBe('single');
  });

  test('parses numbers', () => {
    expect(parseValue('42')).toBe(42);
    expect(parseValue('3.14')).toBe(3.14);
    expect(parseValue('-1')).toBe(-1);
  });

  test('parses booleans', () => {
    expect(parseValue('true')).toBe(true);
    expect(parseValue('false')).toBe(false);
  });

  test('parses null', () => {
    expect(parseValue('null')).toBe(null);
    expect(parseValue('~')).toBe(null);
    expect(parseValue('')).toBe(null);
  });

  test('parses inline arrays', () => {
    expect(parseValue('[a, b, c]')).toEqual(['a', 'b', 'c']);
    expect(parseValue('[1, 2, 3]')).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Path Matching
// ---------------------------------------------------------------------------

describe('globToRegex', () => {
  test('matches interface contract paths', () => {
    const regex = globToRegex('**/contracts/interfaces/**/*.yaml');
    expect(regex.test('contracts/interfaces/member-api.yaml')).toBe(true);
    expect(regex.test('project/contracts/interfaces/order-api.yaml')).toBe(true);
    expect(regex.test('contracts/interfaces/nested/deep/api.yaml')).toBe(true);
  });

  test('does not match non-interface paths', () => {
    const regex = globToRegex('**/contracts/interfaces/**/*.yaml');
    expect(regex.test('contracts/standards/coding.yaml')).toBe(false);
    expect(regex.test('src/config.yaml')).toBe(false);
    expect(regex.test('contracts/interfaces/member-api.json')).toBe(false);
  });
});

describe('shouldValidate', () => {
  test('validates interface contract YAML files', () => {
    expect(shouldValidate('contracts/interfaces/member-api.yaml')).toBe(true);
    expect(shouldValidate('contracts/interfaces/order-api.yml')).toBe(true);
    expect(shouldValidate('contracts/interfaces/payment/stripe-api.yaml')).toBe(true);
  });

  test('does not validate non-contract files', () => {
    expect(shouldValidate('contracts/standards/coding.yaml')).toBe(false);
    expect(shouldValidate('src/config.yaml')).toBe(false);
    expect(shouldValidate('contracts/interfaces/readme.md')).toBe(false);
    expect(shouldValidate('src/models/user.py')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Endpoint Field Extraction
// ---------------------------------------------------------------------------

describe('extractEndpointFields', () => {
  test('extracts fields from endpoints', () => {
    const spec = {
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'uuid',
            name: 'string',
            email: 'string'
          }
        }
      ]
    };

    const fields = extractEndpointFields(spec);
    expect(fields.get('GET /api/members/{id}')).toBe('__endpoint__');
    expect(fields.get('GET /api/members/{id}.id')).toBe('uuid');
    expect(fields.get('GET /api/members/{id}.name')).toBe('string');
    expect(fields.get('GET /api/members/{id}.email')).toBe('string');
  });

  test('extracts request fields', () => {
    const spec = {
      endpoints: [
        {
          path: '/api/members',
          method: 'POST',
          request: {
            name: 'string',
            email: 'string'
          },
          response: {
            id: 'uuid'
          }
        }
      ]
    };

    const fields = extractEndpointFields(spec);
    expect(fields.get('POST /api/members.request.name')).toBe('string');
    expect(fields.get('POST /api/members.request.email')).toBe('string');
    expect(fields.get('POST /api/members.id')).toBe('uuid');
  });

  test('handles multiple endpoints', () => {
    const spec = {
      endpoints: [
        { path: '/api/members', method: 'GET', response: { items: 'array' } },
        { path: '/api/members/{id}', method: 'GET', response: { id: 'uuid' } },
        { path: '/api/members', method: 'POST', response: { id: 'uuid' } }
      ]
    };

    const fields = extractEndpointFields(spec);
    expect(fields.has('GET /api/members')).toBe(true);
    expect(fields.has('GET /api/members/{id}')).toBe(true);
    expect(fields.has('POST /api/members')).toBe(true);
  });

  test('handles empty spec', () => {
    expect(extractEndpointFields({}).size).toBe(0);
    expect(extractEndpointFields({ endpoints: [] }).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Consumer Extraction
// ---------------------------------------------------------------------------

describe('extractConsumers', () => {
  test('extracts consumer domains', () => {
    const spec = {
      consumers: [
        { domain: 'order', uses: ['GET /api/members/{id}'] },
        { domain: 'payment', uses: ['GET /api/members/{id}', 'POST /api/members'] }
      ]
    };

    const consumers = extractConsumers(spec);
    expect(consumers.size).toBe(2);
    expect(consumers.get('order').uses).toEqual(['GET /api/members/{id}']);
    expect(consumers.get('payment').uses).toHaveLength(2);
  });

  test('handles empty consumers', () => {
    expect(extractConsumers({}).size).toBe(0);
    expect(extractConsumers({ consumers: [] }).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Change Detection
// ---------------------------------------------------------------------------

describe('detectChanges', () => {
  const baseSpec = {
    version: '1.0.0',
    domain: 'member',
    endpoints: [
      {
        path: '/api/members/{id}',
        method: 'GET',
        response: {
          id: 'uuid',
          name: 'string',
          email: 'string'
        }
      }
    ],
    consumers: [
      { domain: 'order', uses: ['GET /api/members/{id}'] }
    ]
  };

  test('detects field addition (non-breaking)', () => {
    const newSpec = {
      ...baseSpec,
      version: '1.1.0',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'uuid',
            name: 'string',
            email: 'string',
            grade: 'string'  // New field
          }
        }
      ]
    };

    const changes = detectChanges(baseSpec, newSpec);
    const fieldAdds = changes.filter(c => c.type === 'field_add');
    expect(fieldAdds.length).toBeGreaterThanOrEqual(1);
    expect(fieldAdds.some(c => c.field.includes('grade'))).toBe(true);
    expect(fieldAdds[0].breaking).toBe(false);
  });

  test('detects field removal (breaking)', () => {
    const newSpec = {
      ...baseSpec,
      version: '2.0.0',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'uuid',
            name: 'string'
            // email removed
          }
        }
      ]
    };

    const changes = detectChanges(baseSpec, newSpec);
    const fieldRemoves = changes.filter(c => c.type === 'field_remove');
    expect(fieldRemoves.length).toBeGreaterThanOrEqual(1);
    expect(fieldRemoves.some(c => c.field.includes('email'))).toBe(true);
    expect(fieldRemoves[0].breaking).toBe(true);
  });

  test('detects field type change (breaking)', () => {
    const newSpec = {
      ...baseSpec,
      version: '2.0.0',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'integer',  // Changed from uuid to integer
            name: 'string',
            email: 'string'
          }
        }
      ]
    };

    const changes = detectChanges(baseSpec, newSpec);
    const typeChanges = changes.filter(c => c.type === 'field_type_change');
    expect(typeChanges.length).toBeGreaterThanOrEqual(1);
    expect(typeChanges[0].field).toContain('id');
    expect(typeChanges[0].oldValue).toBe('uuid');
    expect(typeChanges[0].newValue).toBe('integer');
    expect(typeChanges[0].breaking).toBe(true);
  });

  test('detects endpoint removal (breaking)', () => {
    const newSpec = {
      ...baseSpec,
      version: '2.0.0',
      endpoints: []  // All endpoints removed
    };

    const changes = detectChanges(baseSpec, newSpec);
    const endpointRemoves = changes.filter(c => c.type === 'endpoint_remove');
    expect(endpointRemoves.length).toBeGreaterThanOrEqual(1);
    expect(endpointRemoves[0].breaking).toBe(true);
  });

  test('detects endpoint addition (non-breaking)', () => {
    const newSpec = {
      ...baseSpec,
      version: '1.1.0',
      endpoints: [
        ...baseSpec.endpoints,
        {
          path: '/api/members',
          method: 'POST',
          response: { id: 'uuid' }
        }
      ]
    };

    const changes = detectChanges(baseSpec, newSpec);
    const endpointAdds = changes.filter(c => c.type === 'endpoint_add');
    expect(endpointAdds.length).toBeGreaterThanOrEqual(1);
    expect(endpointAdds[0].breaking).toBe(false);
  });

  test('detects version bump', () => {
    const newSpec = {
      ...baseSpec,
      version: '1.1.0'
    };

    const changes = detectChanges(baseSpec, newSpec);
    const versionBumps = changes.filter(c => c.type === 'version_bump');
    expect(versionBumps).toHaveLength(1);
    expect(versionBumps[0].oldValue).toBe('1.0.0');
    expect(versionBumps[0].newValue).toBe('1.1.0');
  });

  test('detects consumer addition', () => {
    const newSpec = {
      ...baseSpec,
      consumers: [
        ...baseSpec.consumers,
        { domain: 'payment', uses: ['GET /api/members/{id}'] }
      ]
    };

    const changes = detectChanges(baseSpec, newSpec);
    const consumerAdds = changes.filter(c => c.type === 'consumer_add');
    expect(consumerAdds).toHaveLength(1);
    expect(consumerAdds[0].newValue).toBe('payment');
  });

  test('detects consumer removal', () => {
    const newSpec = {
      ...baseSpec,
      consumers: []  // Order consumer removed
    };

    const changes = detectChanges(baseSpec, newSpec);
    const consumerRemoves = changes.filter(c => c.type === 'consumer_remove');
    expect(consumerRemoves).toHaveLength(1);
    expect(consumerRemoves[0].oldValue).toBe('order');
  });

  test('returns empty array when no changes', () => {
    const changes = detectChanges(baseSpec, baseSpec);
    expect(changes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Impact Analysis
// ---------------------------------------------------------------------------

describe('analyzeImpact', () => {
  test('identifies affected consumers for breaking changes', () => {
    const newSpec = {
      version: '2.0.0',
      domain: 'member',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'uuid',
            name: 'string'
            // email removed (breaking)
          }
        }
      ],
      consumers: [
        { domain: 'order', uses: ['GET /api/members/{id}'] },
        { domain: 'payment', uses: ['GET /api/members/{id}'] }
      ]
    };

    const changes = [
      {
        type: 'field_remove',
        field: 'GET /api/members/{id}.email',
        oldValue: 'string',
        newValue: null,
        breaking: true,
        label: 'Field Removed',
        action: 'Breaking change'
      }
    ];

    const impact = analyzeImpact(changes, newSpec);
    expect(impact.hasBreakingChanges).toBe(true);
    expect(impact.breakingCount).toBe(1);
    expect(impact.affectedConsumers.length).toBe(2);
    expect(impact.affectedConsumers[0].requiresUpdate).toBe(true);
    expect(impact.affectedConsumers[1].requiresUpdate).toBe(true);
  });

  test('identifies non-breaking changes for consumers', () => {
    const newSpec = {
      version: '1.1.0',
      domain: 'member',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'uuid',
            name: 'string',
            email: 'string',
            grade: 'string'  // Added
          }
        }
      ],
      consumers: [
        { domain: 'order', uses: ['GET /api/members/{id}'] }
      ]
    };

    const changes = [
      {
        type: 'field_add',
        field: 'GET /api/members/{id}.grade',
        oldValue: null,
        newValue: 'string',
        breaking: false,
        label: 'Field Added',
        action: 'Non-breaking'
      }
    ];

    const impact = analyzeImpact(changes, newSpec);
    expect(impact.hasBreakingChanges).toBe(false);
    expect(impact.nonBreakingCount).toBe(1);
  });

  test('includes domain and version in impact', () => {
    const newSpec = {
      version: '1.1.0',
      domain: 'member',
      endpoints: [],
      consumers: []
    };

    const impact = analyzeImpact([], newSpec);
    expect(impact.domain).toBe('member');
    expect(impact.version).toBe('1.1.0');
    expect(impact.totalChanges).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Spec Structure Validation
// ---------------------------------------------------------------------------

describe('validateSpecStructure', () => {
  test('validates correct spec', () => {
    const spec = {
      version: '1.0.0',
      domain: 'member',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: { id: 'uuid', name: 'string' }
        }
      ]
    };

    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test('detects missing version', () => {
    const spec = {
      domain: 'member',
      endpoints: [{ path: '/api/test', method: 'GET', response: { id: 'uuid' } }]
    };

    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('version'))).toBe(true);
  });

  test('detects missing domain', () => {
    const spec = {
      version: '1.0.0',
      endpoints: [{ path: '/api/test', method: 'GET', response: { id: 'uuid' } }]
    };

    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('domain'))).toBe(true);
  });

  test('detects missing endpoints', () => {
    const spec = {
      version: '1.0.0',
      domain: 'member'
    };

    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('endpoints'))).toBe(true);
  });

  test('detects endpoint without path', () => {
    const spec = {
      version: '1.0.0',
      domain: 'member',
      endpoints: [{ method: 'GET', response: { id: 'uuid' } }]
    };

    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('path'))).toBe(true);
  });

  test('detects endpoint without method', () => {
    const spec = {
      version: '1.0.0',
      domain: 'member',
      endpoints: [{ path: '/api/test', response: { id: 'uuid' } }]
    };

    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('method'))).toBe(true);
  });

  test('detects endpoint without response or request', () => {
    const spec = {
      version: '1.0.0',
      domain: 'member',
      endpoints: [{ path: '/api/test', method: 'GET' }]
    };

    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('response'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Report Formatting
// ---------------------------------------------------------------------------

describe('formatImpactReport', () => {
  test('formats breaking change report', () => {
    const impact = {
      domain: 'member',
      version: '2.0.0',
      totalChanges: 1,
      breakingCount: 1,
      nonBreakingCount: 0,
      hasBreakingChanges: true,
      changes: [
        {
          type: 'field_remove',
          field: 'GET /api/members/{id}.email',
          oldValue: 'string',
          newValue: null,
          breaking: true,
          label: 'Field Removed',
          action: 'Breaking change: all consumers must be updated.'
        }
      ],
      affectedConsumers: [
        {
          domain: 'order',
          uses: ['GET /api/members/{id}'],
          affectedEndpoints: ['GET /api/members/{id}.email'],
          recommendations: ['[BREAKING] Field Removed: ...'],
          requiresUpdate: true,
          suggestedFiles: ['order/services/*.py']
        }
      ]
    };

    const report = formatImpactReport(impact);
    expect(report).toContain('BREAKING CHANGE');
    expect(report).toContain('member');
    expect(report).toContain('2.0.0');
    expect(report).toContain('Field Removed');
    expect(report).toContain('order');
    expect(report).toContain('REQUIRED ACTIONS');
    expect(report).toContain('approval');
  });

  test('formats non-breaking change report', () => {
    const impact = {
      domain: 'member',
      version: '1.1.0',
      totalChanges: 1,
      breakingCount: 0,
      nonBreakingCount: 1,
      hasBreakingChanges: false,
      changes: [
        {
          type: 'field_add',
          field: 'GET /api/members/{id}.grade',
          oldValue: null,
          newValue: 'string',
          breaking: false,
          label: 'Field Added',
          action: 'Non-breaking'
        }
      ],
      affectedConsumers: []
    };

    const report = formatImpactReport(impact);
    expect(report).toContain('SPEC UPDATE');
    expect(report).toContain('member');
    expect(report).toContain('1.1.0');
    expect(report).toContain('NON-BREAKING');
    expect(report).not.toContain('REQUIRED ACTIONS');
  });
});

describe('formatNewSpecReport', () => {
  test('formats valid new spec report', () => {
    const spec = {
      version: '1.0.0',
      domain: 'member',
      endpoints: [
        { path: '/api/members/{id}', method: 'GET', response: { id: 'uuid', name: 'string' } }
      ],
      consumers: [
        { domain: 'order', uses: ['GET /api/members/{id}'] }
      ]
    };

    const validation = { valid: true, issues: [] };
    const report = formatNewSpecReport(spec, validation);

    expect(report).toContain('NEW');
    expect(report).toContain('member');
    expect(report).toContain('1.0.0');
    expect(report).toContain('Endpoints: 1');
    expect(report).toContain('Consumers: 1');
    expect(report).toContain('/api/members/{id}');
    expect(report).toContain('order');
    expect(report).toContain('registered successfully');
  });

  test('formats invalid new spec report', () => {
    const spec = { domain: 'broken' };
    const validation = {
      valid: false,
      issues: ['Missing required field: "version"', 'Missing or invalid "endpoints" array']
    };

    const report = formatNewSpecReport(spec, validation);
    expect(report).toContain('STRUCTURE ISSUES');
    expect(report).toContain('version');
    expect(report).toContain('endpoints');
  });
});

describe('formatImpactJson', () => {
  test('produces machine-readable impact JSON', () => {
    const changes = [
      { type: 'field_add', field: 'GET /api/members/{id}.grade', oldValue: null, newValue: 'string', breaking: false }
    ];
    const impact = {
      domain: 'member',
      version: '1.1.0',
      breakingCount: 0,
      hasBreakingChanges: false,
      affectedConsumers: [
        {
          domain: 'order',
          suggestedFiles: ['order/services/discount_service.py'],
          requiresUpdate: false,
          affectedEndpoints: ['GET /api/members/{id}.grade']
        }
      ]
    };

    const json = formatImpactJson(changes, impact);
    expect(json.change.domain).toBe('member');
    expect(json.change.version).toBe('1.1.0');
    expect(json.change.types).toEqual(['field_add']);
    expect(json.impact.breaking).toBe(false);
    expect(json.impact.consumers).toHaveLength(1);
    expect(json.impact.consumers[0].domain).toBe('order');
  });
});

// ---------------------------------------------------------------------------
// Path Resolution
// ---------------------------------------------------------------------------

describe('toRelativePath', () => {
  test('converts absolute path to relative', () => {
    const projectDir = '/Users/kwak/Projects/my-project';
    process.env.CLAUDE_PROJECT_DIR = projectDir;

    const absolutePath = '/Users/kwak/Projects/my-project/contracts/interfaces/member-api.yaml';
    const relative = toRelativePath(absolutePath);

    expect(relative).toBe('contracts/interfaces/member-api.yaml');
  });

  test('returns relative path as-is', () => {
    const relativePath = 'contracts/interfaces/member-api.yaml';
    expect(toRelativePath(relativePath)).toBe(relativePath);
  });

  test('returns empty string for empty input', () => {
    expect(toRelativePath('')).toBe('');
    expect(toRelativePath(null)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Change Type Definitions
// ---------------------------------------------------------------------------

describe('CHANGE_TYPES', () => {
  test('field_add is non-breaking', () => {
    expect(CHANGE_TYPES.field_add.breaking).toBe(false);
  });

  test('field_remove is breaking', () => {
    expect(CHANGE_TYPES.field_remove.breaking).toBe(true);
  });

  test('field_type_change is breaking', () => {
    expect(CHANGE_TYPES.field_type_change.breaking).toBe(true);
  });

  test('endpoint_remove is breaking', () => {
    expect(CHANGE_TYPES.endpoint_remove.breaking).toBe(true);
  });

  test('endpoint_add is non-breaking', () => {
    expect(CHANGE_TYPES.endpoint_add.breaking).toBe(false);
  });

  test('version_bump is non-breaking', () => {
    expect(CHANGE_TYPES.version_bump.breaking).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: Full Scenarios
// ---------------------------------------------------------------------------

describe('Integration: Complete Workflow', () => {
  const oldYamlSpec = {
    version: '1.0.0',
    domain: 'member',
    endpoints: [
      {
        path: '/api/members/{id}',
        method: 'GET',
        response: {
          id: 'uuid',
          name: 'string',
          email: 'string'
        }
      }
    ],
    consumers: [
      { domain: 'order', uses: ['GET /api/members/{id}'] }
    ]
  };

  test('non-breaking field addition flow', () => {
    const newSpec = {
      ...oldYamlSpec,
      version: '1.1.0',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'uuid',
            name: 'string',
            email: 'string',
            grade: 'string'
          }
        }
      ]
    };

    // 1. Detect changes
    const changes = detectChanges(oldYamlSpec, newSpec);
    expect(changes.length).toBeGreaterThan(0);

    // 2. All field_add changes are non-breaking
    const fieldAdds = changes.filter(c => c.type === 'field_add');
    expect(fieldAdds.length).toBeGreaterThan(0);
    expect(fieldAdds.every(c => c.breaking === false)).toBe(true);

    // 3. Impact analysis
    const impact = analyzeImpact(changes, newSpec);
    expect(impact.hasBreakingChanges).toBe(false);
    expect(impact.domain).toBe('member');
    expect(impact.version).toBe('1.1.0');

    // 4. Format report
    const report = formatImpactReport(impact);
    expect(report).toContain('SPEC UPDATE');
    expect(report).not.toContain('REQUIRED ACTIONS');

    // 5. Machine-readable output
    const json = formatImpactJson(changes, impact);
    expect(json.impact.breaking).toBe(false);
  });

  test('breaking field removal flow', () => {
    const newSpec = {
      ...oldYamlSpec,
      version: '2.0.0',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'uuid',
            name: 'string'
            // email removed
          }
        }
      ]
    };

    // 1. Detect changes
    const changes = detectChanges(oldYamlSpec, newSpec);
    const fieldRemoves = changes.filter(c => c.type === 'field_remove');
    expect(fieldRemoves.length).toBeGreaterThan(0);
    expect(fieldRemoves.every(c => c.breaking === true)).toBe(true);

    // 2. Impact analysis
    const impact = analyzeImpact(changes, newSpec);
    expect(impact.hasBreakingChanges).toBe(true);
    expect(impact.breakingCount).toBeGreaterThan(0);

    // 3. Consumer should require update
    expect(impact.affectedConsumers.length).toBeGreaterThan(0);
    expect(impact.affectedConsumers[0].domain).toBe('order');
    expect(impact.affectedConsumers[0].requiresUpdate).toBe(true);

    // 4. Format report
    const report = formatImpactReport(impact);
    expect(report).toContain('BREAKING CHANGE');
    expect(report).toContain('REQUIRED ACTIONS');
    expect(report).toContain('order');
  });

  test('breaking type change flow', () => {
    const newSpec = {
      ...oldYamlSpec,
      version: '2.0.0',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'integer',  // uuid -> integer
            name: 'string',
            email: 'string'
          }
        }
      ]
    };

    const changes = detectChanges(oldYamlSpec, newSpec);
    const typeChanges = changes.filter(c => c.type === 'field_type_change');
    expect(typeChanges.length).toBe(1);
    expect(typeChanges[0].oldValue).toBe('uuid');
    expect(typeChanges[0].newValue).toBe('integer');

    const impact = analyzeImpact(changes, newSpec);
    expect(impact.hasBreakingChanges).toBe(true);
  });

  test('endpoint removal flow', () => {
    const newSpec = {
      ...oldYamlSpec,
      version: '2.0.0',
      endpoints: []
    };

    const changes = detectChanges(oldYamlSpec, newSpec);
    const endpointRemoves = changes.filter(c => c.type === 'endpoint_remove');
    expect(endpointRemoves.length).toBeGreaterThanOrEqual(1);

    const impact = analyzeImpact(changes, newSpec);
    expect(impact.hasBreakingChanges).toBe(true);
  });

  test('new spec creation flow', () => {
    const newSpec = {
      version: '1.0.0',
      domain: 'notification',
      endpoints: [
        {
          path: '/api/notifications',
          method: 'POST',
          request: { userId: 'uuid', message: 'string' },
          response: { id: 'uuid', status: 'string' }
        }
      ],
      consumers: []
    };

    const validation = validateSpecStructure(newSpec);
    expect(validation.valid).toBe(true);

    const report = formatNewSpecReport(newSpec, validation);
    expect(report).toContain('NEW');
    expect(report).toContain('notification');
    expect(report).toContain('registered successfully');
  });

  test('multiple changes in single update', () => {
    const newSpec = {
      version: '2.0.0',
      domain: 'member',
      endpoints: [
        {
          path: '/api/members/{id}',
          method: 'GET',
          response: {
            id: 'integer',      // type change (breaking)
            name: 'string',
            // email removed (breaking)
            grade: 'string',    // added (non-breaking)
            avatar: 'string'   // added (non-breaking)
          }
        },
        {
          path: '/api/members',  // new endpoint (non-breaking)
          method: 'GET',
          response: { items: 'array', total: 'integer' }
        }
      ],
      consumers: [
        { domain: 'order', uses: ['GET /api/members/{id}'] },
        { domain: 'billing', uses: ['GET /api/members/{id}'] }  // new consumer
      ]
    };

    const changes = detectChanges(oldYamlSpec, newSpec);

    // Should detect multiple change types
    const types = new Set(changes.map(c => c.type));
    expect(types.has('version_bump')).toBe(true);
    expect(types.has('field_type_change')).toBe(true);
    expect(types.has('field_remove')).toBe(true);
    expect(types.has('field_add')).toBe(true);
    expect(types.has('endpoint_add')).toBe(true);
    expect(types.has('consumer_add')).toBe(true);

    const impact = analyzeImpact(changes, newSpec);
    expect(impact.hasBreakingChanges).toBe(true);
    expect(impact.totalChanges).toBeGreaterThan(5);
    expect(impact.affectedConsumers.length).toBeGreaterThanOrEqual(1);
  });
});
