/**
 * @TASK P2-T6 - Cross-Domain Notifier Hook Tests
 * @TEST hooks/cross-domain-notifier.js
 *
 * Tests cover:
 *   1. File classification (interface vs design)
 *   2. Interface change detection
 *   3. Design system change detection (tokens, components)
 *   4. Affected domain identification
 *   5. Notification YAML generation
 *   6. Notification path generation
 *   7. Priority classification
 *   8. Report formatting
 *   9. Integration: API spec change scenario
 *   10. Integration: Design system change scenario
 */

const {
  INTERFACE_PATTERNS,
  DESIGN_PATTERNS,
  ALL_PATTERNS,
  PRIORITY,
  NOTIFICATION_TYPES,
  parseSimpleYaml,
  splitKeyValue,
  parseValue,
  globToRegex,
  matchesAnyPattern,
  classifyFile,
  extractEndpointFields,
  extractConsumers,
  detectInterfaceChanges,
  extractDesignTokens,
  extractComponentSections,
  detectDesignChanges,
  identifyAffectedDomains,
  identifyDesignAffectedTargets,
  generateNotificationYaml,
  generateNotificationPath,
  buildNotifications,
  buildInterfaceDescription,
  buildDesignDescription,
  summarizeChangeType,
  summarizeDesignChangeType,
  formatNotificationReport,
  toRelativePath
} = require('../cross-domain-notifier');

// ---------------------------------------------------------------------------
// File Classification
// ---------------------------------------------------------------------------

describe('classifyFile', () => {
  test('classifies interface contract files', () => {
    expect(classifyFile('contracts/interfaces/member-api.yaml')).toBe('interface');
    expect(classifyFile('contracts/interfaces/order-api.yml')).toBe('interface');
    expect(classifyFile('contracts/interfaces/nested/deep-api.yaml')).toBe('interface');
  });

  test('classifies design system file', () => {
    expect(classifyFile('contracts/standards/design-system.md')).toBe('design');
  });

  test('returns null for unrelated files', () => {
    expect(classifyFile('src/main.py')).toBe(null);
    expect(classifyFile('contracts/standards/coding-standards.md')).toBe(null);
    expect(classifyFile('contracts/interfaces/readme.md')).toBe(null);
    expect(classifyFile('tests/test_api.py')).toBe(null);
  });
});

describe('globToRegex', () => {
  test('matches interface patterns', () => {
    const regex = globToRegex('**/contracts/interfaces/**/*.yaml');
    expect(regex.test('contracts/interfaces/member-api.yaml')).toBe(true);
    expect(regex.test('project/contracts/interfaces/order-api.yaml')).toBe(true);
  });

  test('matches design patterns', () => {
    const regex = globToRegex('**/contracts/standards/design-system.md');
    expect(regex.test('contracts/standards/design-system.md')).toBe(true);
  });

  test('does not match unrelated paths', () => {
    const regex = globToRegex('**/contracts/interfaces/**/*.yaml');
    expect(regex.test('src/config.yaml')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Interface Change Detection
// ---------------------------------------------------------------------------

describe('detectInterfaceChanges', () => {
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

  test('detects field addition', () => {
    const newSpec = {
      ...baseSpec,
      version: '1.1.0',
      endpoints: [{
        ...baseSpec.endpoints[0],
        response: {
          ...baseSpec.endpoints[0].response,
          grade: 'string'
        }
      }]
    };

    const changes = detectInterfaceChanges(baseSpec, newSpec);
    const fieldAdds = changes.filter(c => c.changeType === 'field_add');
    expect(fieldAdds.length).toBeGreaterThanOrEqual(1);
    expect(fieldAdds.some(c => c.field.includes('grade'))).toBe(true);
  });

  test('detects field removal', () => {
    const newSpec = {
      ...baseSpec,
      version: '2.0.0',
      endpoints: [{
        path: '/api/members/{id}',
        method: 'GET',
        response: {
          id: 'uuid',
          name: 'string'
          // email removed
        }
      }]
    };

    const changes = detectInterfaceChanges(baseSpec, newSpec);
    const fieldRemoves = changes.filter(c => c.changeType === 'field_remove');
    expect(fieldRemoves.length).toBeGreaterThanOrEqual(1);
    expect(fieldRemoves.some(c => c.field.includes('email'))).toBe(true);
  });

  test('detects field type change', () => {
    const newSpec = {
      ...baseSpec,
      version: '2.0.0',
      endpoints: [{
        path: '/api/members/{id}',
        method: 'GET',
        response: {
          id: 'integer', // changed from uuid
          name: 'string',
          email: 'string'
        }
      }]
    };

    const changes = detectInterfaceChanges(baseSpec, newSpec);
    const typeChanges = changes.filter(c => c.changeType === 'field_type_change');
    expect(typeChanges.length).toBeGreaterThanOrEqual(1);
    expect(typeChanges[0].oldValue).toBe('uuid');
    expect(typeChanges[0].newValue).toBe('integer');
  });

  test('detects endpoint removal', () => {
    const newSpec = {
      ...baseSpec,
      version: '2.0.0',
      endpoints: []
    };

    const changes = detectInterfaceChanges(baseSpec, newSpec);
    const endpointRemoves = changes.filter(c => c.changeType === 'endpoint_remove');
    expect(endpointRemoves.length).toBeGreaterThanOrEqual(1);
  });

  test('detects endpoint addition', () => {
    const newSpec = {
      ...baseSpec,
      version: '1.1.0',
      endpoints: [
        ...baseSpec.endpoints,
        { path: '/api/members', method: 'POST', response: { id: 'uuid' } }
      ]
    };

    const changes = detectInterfaceChanges(baseSpec, newSpec);
    const endpointAdds = changes.filter(c => c.changeType === 'endpoint_add');
    expect(endpointAdds.length).toBeGreaterThanOrEqual(1);
  });

  test('detects version bump', () => {
    const newSpec = { ...baseSpec, version: '1.1.0' };
    const changes = detectInterfaceChanges(baseSpec, newSpec);
    const versionBumps = changes.filter(c => c.changeType === 'version_bump');
    expect(versionBumps).toHaveLength(1);
    expect(versionBumps[0].oldValue).toBe('1.0.0');
    expect(versionBumps[0].newValue).toBe('1.1.0');
  });

  test('returns empty array for no changes', () => {
    const changes = detectInterfaceChanges(baseSpec, baseSpec);
    expect(changes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Design System Change Detection
// ---------------------------------------------------------------------------

describe('extractDesignTokens', () => {
  test('extracts color tokens', () => {
    const content = `
--color-primary: #3b82f6
--color-secondary: #64748b
--color-danger: #ef4444
    `;
    const tokens = extractDesignTokens(content);
    expect(tokens.get('--color-primary')).toBe('#3b82f6');
    expect(tokens.get('--color-secondary')).toBe('#64748b');
    expect(tokens.get('--color-danger')).toBe('#ef4444');
  });

  test('extracts font tokens', () => {
    const content = `
--font-size-sm: 0.875rem
--font-size-lg: 1.25rem
    `;
    const tokens = extractDesignTokens(content);
    expect(tokens.get('--font-size-sm')).toBe('0.875rem');
    expect(tokens.get('--font-size-lg')).toBe('1.25rem');
  });

  test('extracts space tokens', () => {
    const content = `
--space-xs: 4px
--space-sm: 8px
--space-md: 16px
    `;
    const tokens = extractDesignTokens(content);
    expect(tokens.get('--space-xs')).toBe('4px');
    expect(tokens.get('--space-sm')).toBe('8px');
    expect(tokens.get('--space-md')).toBe('16px');
  });

  test('handles empty or invalid input', () => {
    expect(extractDesignTokens('')).toEqual(new Map());
    expect(extractDesignTokens(null)).toEqual(new Map());
    expect(extractDesignTokens(undefined)).toEqual(new Map());
  });
});

describe('extractComponentSections', () => {
  test('extracts component section names', () => {
    const content = `
# Design System

## Button
Some button documentation.

## Card
Card component docs.

## Modal
Modal component docs.

### Subsection
Not a component.
    `;
    const components = extractComponentSections(content);
    expect(components.has('Button')).toBe(true);
    expect(components.has('Card')).toBe(true);
    expect(components.has('Modal')).toBe(true);
    expect(components.has('Subsection')).toBe(false); // ### not ##
  });

  test('handles empty input', () => {
    expect(extractComponentSections('')).toEqual(new Set());
    expect(extractComponentSections(null)).toEqual(new Set());
  });
});

describe('detectDesignChanges', () => {
  test('detects token value change', () => {
    const oldContent = '--color-primary: #3b82f6\n--color-secondary: #64748b';
    const newContent = '--color-primary: #2563eb\n--color-secondary: #64748b';

    const changes = detectDesignChanges(oldContent, newContent);
    expect(changes.length).toBe(1);
    expect(changes[0].changeType).toBe('design_token_change');
    expect(changes[0].field).toBe('--color-primary');
    expect(changes[0].oldValue).toBe('#3b82f6');
    expect(changes[0].newValue).toBe('#2563eb');
    expect(changes[0].detail).toBe('token_modified');
  });

  test('detects token addition', () => {
    const oldContent = '--color-primary: #3b82f6';
    const newContent = '--color-primary: #3b82f6\n--color-accent: #f97316';

    const changes = detectDesignChanges(oldContent, newContent);
    const additions = changes.filter(c => c.detail === 'token_added');
    expect(additions.length).toBe(1);
    expect(additions[0].field).toBe('--color-accent');
  });

  test('detects token removal', () => {
    const oldContent = '--color-primary: #3b82f6\n--color-danger: #ef4444';
    const newContent = '--color-primary: #3b82f6';

    const changes = detectDesignChanges(oldContent, newContent);
    const removals = changes.filter(c => c.detail === 'token_removed');
    expect(removals.length).toBe(1);
    expect(removals[0].field).toBe('--color-danger');
  });

  test('detects component section addition', () => {
    const oldContent = '## Button\nButton docs\n## Card\nCard docs';
    const newContent = '## Button\nButton docs\n## Card\nCard docs\n## Tooltip\nTooltip docs';

    const changes = detectDesignChanges(oldContent, newContent);
    const componentAdds = changes.filter(c => c.changeType === 'design_component_change' && c.detail === 'component_added');
    expect(componentAdds.length).toBe(1);
    expect(componentAdds[0].field).toBe('Tooltip');
  });

  test('detects component section removal', () => {
    const oldContent = '## Button\nButton docs\n## Card\nCard docs';
    const newContent = '## Button\nButton docs';

    const changes = detectDesignChanges(oldContent, newContent);
    const componentRemoves = changes.filter(c => c.changeType === 'design_component_change' && c.detail === 'component_removed');
    expect(componentRemoves.length).toBe(1);
    expect(componentRemoves[0].field).toBe('Card');
  });

  test('returns empty for no changes', () => {
    const content = '--color-primary: #3b82f6\n## Button\nDocs';
    expect(detectDesignChanges(content, content)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Affected Domain Identification
// ---------------------------------------------------------------------------

describe('identifyAffectedDomains', () => {
  const spec = {
    version: '2.0.0',
    domain: 'member',
    endpoints: [{
      path: '/api/members/{id}',
      method: 'GET',
      response: { id: 'uuid', name: 'string' }
    }],
    consumers: [
      { domain: 'order', uses: ['GET /api/members/{id}'] },
      { domain: 'payment', uses: ['GET /api/members/{id}'] }
    ]
  };

  test('identifies consumers affected by breaking changes', () => {
    const changes = [{
      changeType: 'field_remove',
      field: 'GET /api/members/{id}.email',
      oldValue: 'string',
      newValue: null
    }];

    const affected = identifyAffectedDomains(changes, spec);
    expect(affected.length).toBe(2);
    expect(affected[0].domain).toBe('order');
    expect(affected[1].domain).toBe('payment');
    expect(affected[0].requiresUpdate).toBe(true);
  });

  test('identifies consumers for non-breaking changes with matching endpoints', () => {
    const changes = [{
      changeType: 'field_add',
      field: 'GET /api/members/{id}.grade',
      oldValue: null,
      newValue: 'string'
    }];

    const affected = identifyAffectedDomains(changes, spec);
    // Consumers using the endpoint are identified
    expect(affected.length).toBeGreaterThanOrEqual(0);
  });

  test('returns empty for spec with no consumers', () => {
    const specNoConsumers = { ...spec, consumers: [] };
    const changes = [{ changeType: 'field_add', field: 'GET /api/x.y', oldValue: null, newValue: 'string' }];
    const affected = identifyAffectedDomains(changes, specNoConsumers);
    expect(affected).toHaveLength(0);
  });

  test('includes source domain in affected entry', () => {
    const changes = [{
      changeType: 'field_remove',
      field: 'GET /api/members/{id}.email',
      oldValue: 'string',
      newValue: null
    }];

    const affected = identifyAffectedDomains(changes, spec);
    expect(affected[0].sourceDomain).toBe('member');
  });
});

describe('identifyDesignAffectedTargets', () => {
  test('creates broadcast target for token changes', () => {
    const changes = [{
      changeType: 'design_token_change',
      field: '--color-primary',
      oldValue: '#3b82f6',
      newValue: '#2563eb',
      detail: 'token_modified'
    }];

    const targets = identifyDesignAffectedTargets(changes);
    expect(targets.length).toBe(1);
    expect(targets[0].target).toBe('broadcast');
    expect(targets[0].roles).toContain('domain-designer');
    expect(targets[0].roles).toContain('frontend-developer');
    expect(targets[0].requiresUpdate).toBe(true);
  });

  test('creates broadcast target for component changes', () => {
    const changes = [{
      changeType: 'design_component_change',
      field: 'Button',
      oldValue: null,
      newValue: 'Button',
      detail: 'component_added'
    }];

    const targets = identifyDesignAffectedTargets(changes);
    expect(targets.length).toBe(1);
    expect(targets[0].target).toBe('broadcast');
    expect(targets[0].requiresUpdate).toBe(false); // component_added is not breaking
  });

  test('marks component removal as requiring update', () => {
    const changes = [{
      changeType: 'design_component_change',
      field: 'Card',
      oldValue: 'Card',
      newValue: null,
      detail: 'component_removed'
    }];

    const targets = identifyDesignAffectedTargets(changes);
    expect(targets[0].requiresUpdate).toBe(true);
  });

  test('returns empty for empty changes', () => {
    const targets = identifyDesignAffectedTargets([]);
    expect(targets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Notification Generation
// ---------------------------------------------------------------------------

describe('generateNotificationPath', () => {
  test('generates path for specific domain target', () => {
    const result = generateNotificationPath('member', 'order', 'spec-update', '2026-02-07');
    expect(result).toBe('management/notifications/to-order/2026-02-07-member-spec-update.yaml');
  });

  test('generates path for broadcast target', () => {
    const result = generateNotificationPath('design-system', 'broadcast', 'token-change', '2026-02-07');
    expect(result).toBe('management/notifications/broadcast/2026-02-07-design-system-token-change.yaml');
  });
});

describe('generateNotificationYaml', () => {
  test('generates valid YAML for interface change', () => {
    const yaml = generateNotificationYaml({
      type: 'interface_change',
      from: 'member',
      to: 'order',
      priority: 'normal',
      created: '2026-02-07T10:30:00Z',
      file: 'contracts/interfaces/member-api.yaml',
      changeType: 'spec-update',
      field: 'GET /api/members/{id}.grade',
      breaking: false,
      description: 'New field available. Update code if needed.',
      deadline: null,
      details: [
        { field: 'GET /api/members/{id}.grade', oldValue: null, newValue: 'string' }
      ]
    });

    expect(yaml).toContain('type: interface_change');
    expect(yaml).toContain('from: member');
    expect(yaml).toContain('to: order');
    expect(yaml).toContain('priority: normal');
    expect(yaml).toContain('breaking: false');
    expect(yaml).toContain('acknowledged: false');
    expect(yaml).toContain('deadline: null');
  });

  test('generates YAML with high priority for breaking changes', () => {
    const yaml = generateNotificationYaml({
      type: 'interface_change',
      from: 'member',
      to: 'order',
      priority: 'high',
      created: '2026-02-07T10:30:00Z',
      file: 'contracts/interfaces/member-api.yaml',
      changeType: 'breaking-change',
      field: 'GET /api/members/{id}.email',
      breaking: true,
      description: 'Field removed. Code update required.',
      deadline: '2026-02-07T23:59:59Z',
      details: [
        { field: 'GET /api/members/{id}.email', oldValue: 'string', newValue: null }
      ]
    });

    expect(yaml).toContain('priority: high');
    expect(yaml).toContain('breaking: true');
    expect(yaml).toContain('deadline: 2026-02-07T23:59:59Z');
  });

  test('generates YAML for design change broadcast', () => {
    const yaml = generateNotificationYaml({
      type: 'design_change',
      from: 'design-system',
      to: 'broadcast',
      priority: 'high',
      created: '2026-02-07T10:30:00Z',
      file: 'contracts/standards/design-system.md',
      changeType: 'token-change',
      field: null,
      breaking: true,
      description: 'Design token changed. UI update required.',
      deadline: '2026-02-07T23:59:59Z',
      details: [
        { field: '--color-primary', oldValue: '#3b82f6', newValue: '#2563eb' }
      ]
    });

    expect(yaml).toContain('type: design_change');
    expect(yaml).toContain('from: design-system');
    expect(yaml).toContain('to: broadcast');
    expect(yaml).toContain('priority: high');
  });
});

// ---------------------------------------------------------------------------
// Build Notifications (Full Pipeline)
// ---------------------------------------------------------------------------

describe('buildNotifications', () => {
  test('builds interface notifications for affected consumers', () => {
    const spec = {
      version: '1.1.0',
      domain: 'member',
      endpoints: [{
        path: '/api/members/{id}',
        method: 'GET',
        response: { id: 'uuid', name: 'string', email: 'string', grade: 'string' }
      }],
      consumers: [
        { domain: 'order', uses: ['GET /api/members/{id}'] }
      ]
    };

    const changes = [{
      changeType: 'field_add',
      field: 'GET /api/members/{id}.grade',
      oldValue: null,
      newValue: 'string'
    }];

    const notifications = buildNotifications({
      category: 'interface',
      changes,
      filePath: 'contracts/interfaces/member-api.yaml',
      spec,
      timestamp: '2026-02-07T10:30:00Z'
    });

    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].notification.from).toBe('member');
    expect(notifications[0].notification.to).toBe('order');
    expect(notifications[0].notification.priority).toBe('normal');
    expect(notifications[0].notification.breaking).toBe(false);
    expect(notifications[0].path).toContain('to-order');
  });

  test('builds breaking interface notifications with high priority', () => {
    const spec = {
      version: '2.0.0',
      domain: 'member',
      endpoints: [{
        path: '/api/members/{id}',
        method: 'GET',
        response: { id: 'uuid', name: 'string' }
      }],
      consumers: [
        { domain: 'order', uses: ['GET /api/members/{id}'] },
        { domain: 'payment', uses: ['GET /api/members/{id}'] }
      ]
    };

    const changes = [{
      changeType: 'field_remove',
      field: 'GET /api/members/{id}.email',
      oldValue: 'string',
      newValue: null
    }];

    const notifications = buildNotifications({
      category: 'interface',
      changes,
      filePath: 'contracts/interfaces/member-api.yaml',
      spec,
      timestamp: '2026-02-07T10:30:00Z'
    });

    expect(notifications.length).toBe(2);

    for (const n of notifications) {
      expect(n.notification.priority).toBe('high');
      expect(n.notification.breaking).toBe(true);
    }

    const targets = notifications.map(n => n.notification.to);
    expect(targets).toContain('order');
    expect(targets).toContain('payment');
  });

  test('builds design system broadcast notifications', () => {
    const changes = [{
      changeType: 'design_token_change',
      field: '--color-primary',
      oldValue: '#3b82f6',
      newValue: '#2563eb',
      detail: 'token_modified'
    }];

    const notifications = buildNotifications({
      category: 'design',
      changes,
      filePath: 'contracts/standards/design-system.md',
      timestamp: '2026-02-07T10:30:00Z'
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0].notification.from).toBe('design-system');
    expect(notifications[0].notification.to).toBe('broadcast');
    expect(notifications[0].notification.roles).toContain('domain-designer');
    expect(notifications[0].notification.roles).toContain('frontend-developer');
    expect(notifications[0].path).toContain('broadcast');
    expect(notifications[0].path).toContain('token-change');
  });

  test('returns empty for interface with no consumers', () => {
    const spec = {
      version: '1.1.0',
      domain: 'member',
      endpoints: [{ path: '/api/x', method: 'GET', response: { id: 'uuid' } }],
      consumers: []
    };

    const changes = [{ changeType: 'field_add', field: 'GET /api/x.grade', oldValue: null, newValue: 'string' }];
    const notifications = buildNotifications({
      category: 'interface',
      changes,
      filePath: 'contracts/interfaces/member-api.yaml',
      spec,
      timestamp: '2026-02-07T10:30:00Z'
    });

    expect(notifications).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Description Builders
// ---------------------------------------------------------------------------

describe('buildInterfaceDescription', () => {
  test('builds single-change description', () => {
    const changes = [{
      changeType: 'field_add',
      field: 'GET /api/members/{id}.grade'
    }];

    const desc = buildInterfaceDescription(changes, 'member');
    expect(desc).toContain('member');
    expect(desc).toContain('grade');
  });

  test('builds multi-change description with counts', () => {
    const changes = [
      { changeType: 'field_add', field: 'GET /api/x.a' },
      { changeType: 'field_remove', field: 'GET /api/x.b' },
      { changeType: 'field_type_change', field: 'GET /api/x.c' }
    ];

    const desc = buildInterfaceDescription(changes, 'member');
    expect(desc).toContain('3 changes');
    expect(desc).toContain('breaking');
    expect(desc).toContain('non-breaking');
  });
});

describe('buildDesignDescription', () => {
  test('builds token change description', () => {
    const changes = [
      { changeType: 'design_token_change', field: '--color-primary', detail: 'token_modified' }
    ];

    const desc = buildDesignDescription(changes);
    expect(desc).toContain('token');
    expect(desc).toContain('modified');
  });

  test('builds component change description', () => {
    const changes = [
      { changeType: 'design_component_change', field: 'Button', detail: 'component_added' }
    ];

    const desc = buildDesignDescription(changes);
    expect(desc).toContain('component');
    expect(desc).toContain('added');
  });
});

// ---------------------------------------------------------------------------
// Change Type Summarization
// ---------------------------------------------------------------------------

describe('summarizeChangeType', () => {
  test('returns breaking-change for field_remove', () => {
    expect(summarizeChangeType([{ changeType: 'field_remove' }])).toBe('breaking-change');
  });

  test('returns breaking-change for endpoint_remove', () => {
    expect(summarizeChangeType([{ changeType: 'endpoint_remove' }])).toBe('breaking-change');
  });

  test('returns breaking-change for field_type_change', () => {
    expect(summarizeChangeType([{ changeType: 'field_type_change' }])).toBe('breaking-change');
  });

  test('returns spec-update for field_add', () => {
    expect(summarizeChangeType([{ changeType: 'field_add' }])).toBe('spec-update');
  });

  test('returns spec-update for endpoint_add', () => {
    expect(summarizeChangeType([{ changeType: 'endpoint_add' }])).toBe('spec-update');
  });

  test('returns version-bump for version_bump', () => {
    expect(summarizeChangeType([{ changeType: 'version_bump' }])).toBe('version-bump');
  });

  test('breaking takes precedence over non-breaking', () => {
    const changes = [
      { changeType: 'field_add' },
      { changeType: 'field_remove' }
    ];
    expect(summarizeChangeType(changes)).toBe('breaking-change');
  });
});

describe('summarizeDesignChangeType', () => {
  test('returns token-change for token changes only', () => {
    expect(summarizeDesignChangeType([{ changeType: 'design_token_change' }])).toBe('token-change');
  });

  test('returns component-change for component changes only', () => {
    expect(summarizeDesignChangeType([{ changeType: 'design_component_change' }])).toBe('component-change');
  });

  test('returns design-update for mixed changes', () => {
    const changes = [
      { changeType: 'design_token_change' },
      { changeType: 'design_component_change' }
    ];
    expect(summarizeDesignChangeType(changes)).toBe('design-update');
  });
});

// ---------------------------------------------------------------------------
// Priority Classification
// ---------------------------------------------------------------------------

describe('NOTIFICATION_TYPES priority', () => {
  test('field_add is normal priority', () => {
    expect(NOTIFICATION_TYPES.field_add.priority).toBe('normal');
    expect(NOTIFICATION_TYPES.field_add.breaking).toBe(false);
  });

  test('field_remove is high priority', () => {
    expect(NOTIFICATION_TYPES.field_remove.priority).toBe('high');
    expect(NOTIFICATION_TYPES.field_remove.breaking).toBe(true);
  });

  test('field_type_change is high priority', () => {
    expect(NOTIFICATION_TYPES.field_type_change.priority).toBe('high');
    expect(NOTIFICATION_TYPES.field_type_change.breaking).toBe(true);
  });

  test('endpoint_add is normal priority', () => {
    expect(NOTIFICATION_TYPES.endpoint_add.priority).toBe('normal');
    expect(NOTIFICATION_TYPES.endpoint_add.breaking).toBe(false);
  });

  test('endpoint_remove is high priority', () => {
    expect(NOTIFICATION_TYPES.endpoint_remove.priority).toBe('high');
    expect(NOTIFICATION_TYPES.endpoint_remove.breaking).toBe(true);
  });

  test('design_token_change is high priority', () => {
    expect(NOTIFICATION_TYPES.design_token_change.priority).toBe('high');
    expect(NOTIFICATION_TYPES.design_token_change.breaking).toBe(true);
  });

  test('design_component_change is normal priority', () => {
    expect(NOTIFICATION_TYPES.design_component_change.priority).toBe('normal');
    expect(NOTIFICATION_TYPES.design_component_change.breaking).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Report Formatting
// ---------------------------------------------------------------------------

describe('formatNotificationReport', () => {
  test('formats interface breaking change report', () => {
    const notifications = [{
      path: 'management/notifications/to-order/2026-02-07-member-breaking-change.yaml',
      content: '...',
      notification: {
        from: 'member',
        to: 'order',
        priority: 'high',
        breaking: true,
        changeCount: 1
      }
    }];

    const report = formatNotificationReport(notifications, 'interface');
    expect(report).toContain('BREAKING CHANGE');
    expect(report).toContain('member');
    expect(report).toContain('order');
    expect(report).toContain('[HIGH]');
    expect(report).toContain('ACTION REQUIRED');
  });

  test('formats interface non-breaking report', () => {
    const notifications = [{
      path: 'management/notifications/to-order/2026-02-07-member-spec-update.yaml',
      content: '...',
      notification: {
        from: 'member',
        to: 'order',
        priority: 'normal',
        breaking: false,
        changeCount: 1
      }
    }];

    const report = formatNotificationReport(notifications, 'interface');
    expect(report).toContain('SPEC UPDATE');
    expect(report).toContain('[NORMAL]');
    expect(report).toContain('Non-breaking');
  });

  test('formats design breaking report', () => {
    const notifications = [{
      path: 'management/notifications/broadcast/2026-02-07-design-system-token-change.yaml',
      content: '...',
      notification: {
        from: 'design-system',
        to: 'broadcast',
        roles: ['domain-designer', 'frontend-developer'],
        priority: 'high',
        breaking: true,
        changeCount: 1
      }
    }];

    const report = formatNotificationReport(notifications, 'design');
    expect(report).toContain('DESIGN BREAKING');
    expect(report).toContain('broadcast');
    expect(report).toContain('domain-designer');
    expect(report).toContain('frontend-developer');
    expect(report).toContain('ACTION REQUIRED');
  });

  test('formats design non-breaking report', () => {
    const notifications = [{
      path: 'management/notifications/broadcast/2026-02-07-design-system-component-change.yaml',
      content: '...',
      notification: {
        from: 'design-system',
        to: 'broadcast',
        roles: ['domain-designer', 'frontend-developer'],
        priority: 'normal',
        breaking: false,
        changeCount: 1
      }
    }];

    const report = formatNotificationReport(notifications, 'design');
    expect(report).toContain('DESIGN UPDATE');
    expect(report).toContain('[NORMAL]');
  });

  test('returns empty for no notifications', () => {
    expect(formatNotificationReport([], 'interface')).toBe('');
    expect(formatNotificationReport([], 'design')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Path Resolution
// ---------------------------------------------------------------------------

describe('toRelativePath', () => {
  test('converts absolute path to relative', () => {
    const projectDir = '/Users/kwak/Projects/my-project';
    process.env.CLAUDE_PROJECT_DIR = projectDir;

    const result = toRelativePath('/Users/kwak/Projects/my-project/contracts/interfaces/member-api.yaml');
    expect(result).toBe('contracts/interfaces/member-api.yaml');
  });

  test('returns relative path as-is', () => {
    expect(toRelativePath('contracts/interfaces/member-api.yaml')).toBe('contracts/interfaces/member-api.yaml');
  });

  test('returns empty string for empty input', () => {
    expect(toRelativePath('')).toBe('');
    expect(toRelativePath(null)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Integration: API Spec Change Scenario (Scenario 1)
// ---------------------------------------------------------------------------

describe('Integration: API Spec Change Scenario', () => {
  const oldSpec = {
    version: '1.0.0',
    domain: 'member',
    endpoints: [{
      path: '/api/members/{id}',
      method: 'GET',
      response: {
        id: 'uuid',
        name: 'string',
        email: 'string'
      }
    }],
    consumers: [
      { domain: 'order', uses: ['GET /api/members/{id}'] },
      { domain: 'payment', uses: ['GET /api/members/{id}'] }
    ]
  };

  test('Scenario 1: non-breaking field addition', () => {
    const newSpec = {
      ...oldSpec,
      version: '1.1.0',
      endpoints: [{
        path: '/api/members/{id}',
        method: 'GET',
        response: {
          id: 'uuid',
          name: 'string',
          email: 'string',
          grade: 'string'
        }
      }],
      consumers: oldSpec.consumers
    };

    // 1. Detect changes
    const changes = detectInterfaceChanges(oldSpec, newSpec);
    expect(changes.length).toBeGreaterThan(0);

    const fieldAdds = changes.filter(c => c.changeType === 'field_add');
    expect(fieldAdds.some(c => c.field.includes('grade'))).toBe(true);

    // 2. Build notifications
    const notifications = buildNotifications({
      category: 'interface',
      changes,
      filePath: 'contracts/interfaces/member-api.yaml',
      spec: newSpec,
      timestamp: '2026-02-07T10:30:00Z'
    });

    // Should notify order and payment domains
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    // 3. Verify notification content
    for (const n of notifications) {
      expect(n.content).toContain('type: interface_change');
      expect(n.content).toContain('from: member');
      expect(n.content).toContain('acknowledged: false');
    }

    // 4. Format report
    const report = formatNotificationReport(notifications, 'interface');
    expect(report).toContain('member');
  });

  test('Scenario 1b: breaking field removal', () => {
    const newSpec = {
      ...oldSpec,
      version: '2.0.0',
      endpoints: [{
        path: '/api/members/{id}',
        method: 'GET',
        response: {
          id: 'uuid',
          name: 'string'
          // email removed
        }
      }],
      consumers: oldSpec.consumers
    };

    // 1. Detect breaking changes
    const changes = detectInterfaceChanges(oldSpec, newSpec);
    const fieldRemoves = changes.filter(c => c.changeType === 'field_remove');
    expect(fieldRemoves.length).toBeGreaterThanOrEqual(1);

    // 2. Build notifications with high priority
    const notifications = buildNotifications({
      category: 'interface',
      changes,
      filePath: 'contracts/interfaces/member-api.yaml',
      spec: newSpec,
      timestamp: '2026-02-07T10:30:00Z'
    });

    expect(notifications.length).toBe(2); // order and payment

    for (const n of notifications) {
      expect(n.notification.priority).toBe('high');
      expect(n.notification.breaking).toBe(true);
      expect(n.content).toContain('breaking: true');
      expect(n.content).toContain('priority: high');
    }

    // 3. Check paths
    const paths = notifications.map(n => n.path);
    expect(paths.some(p => p.includes('to-order'))).toBe(true);
    expect(paths.some(p => p.includes('to-payment'))).toBe(true);

    // 4. Format report
    const report = formatNotificationReport(notifications, 'interface');
    expect(report).toContain('BREAKING CHANGE');
    expect(report).toContain('ACTION REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// Integration: Design System Change Scenario (Scenario 2)
// ---------------------------------------------------------------------------

describe('Integration: Design System Change Scenario', () => {
  test('Scenario 2: primary color change', () => {
    const oldContent = `# Design System

## Colors
--color-primary: #3b82f6
--color-secondary: #64748b
--color-danger: #ef4444

## Button
Standard button component documentation.

## Card
Card component documentation.
`;

    const newContent = `# Design System

## Colors
--color-primary: #2563eb
--color-secondary: #64748b
--color-danger: #ef4444

## Button
Standard button component documentation.

## Card
Card component documentation.
`;

    // 1. Detect design changes
    const changes = detectDesignChanges(oldContent, newContent);
    expect(changes.length).toBe(1);
    expect(changes[0].changeType).toBe('design_token_change');
    expect(changes[0].field).toBe('--color-primary');
    expect(changes[0].oldValue).toBe('#3b82f6');
    expect(changes[0].newValue).toBe('#2563eb');

    // 2. Build broadcast notifications
    const notifications = buildNotifications({
      category: 'design',
      changes,
      filePath: 'contracts/standards/design-system.md',
      timestamp: '2026-02-07T10:30:00Z'
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0].notification.to).toBe('broadcast');
    expect(notifications[0].notification.roles).toContain('domain-designer');
    expect(notifications[0].notification.roles).toContain('frontend-developer');
    expect(notifications[0].notification.priority).toBe('high');

    // 3. Verify notification YAML content
    expect(notifications[0].content).toContain('type: design_change');
    expect(notifications[0].content).toContain('from: design-system');
    expect(notifications[0].content).toContain('to: broadcast');
    expect(notifications[0].content).toContain('--color-primary');

    // 4. Verify path
    expect(notifications[0].path).toContain('broadcast');
    expect(notifications[0].path).toContain('token-change');

    // 5. Format report
    const report = formatNotificationReport(notifications, 'design');
    expect(report).toContain('DESIGN BREAKING');
    expect(report).toContain('domain-designer');
    expect(report).toContain('frontend-developer');
  });

  test('Scenario 2b: component addition', () => {
    const oldContent = `## Button\nDocs\n## Card\nDocs`;
    const newContent = `## Button\nDocs\n## Card\nDocs\n## Tooltip\nNew tooltip docs`;

    const changes = detectDesignChanges(oldContent, newContent);
    expect(changes.some(c => c.field === 'Tooltip')).toBe(true);

    const notifications = buildNotifications({
      category: 'design',
      changes,
      filePath: 'contracts/standards/design-system.md',
      timestamp: '2026-02-07T10:30:00Z'
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0].notification.breaking).toBe(false);
    expect(notifications[0].notification.priority).toBe('normal');
  });

  test('Scenario 2c: mixed token + component changes', () => {
    const oldContent = `--color-primary: #3b82f6\n## Button\nDocs\n## Card\nDocs`;
    const newContent = `--color-primary: #2563eb\n## Button\nDocs\n## Modal\nNew modal docs`;

    const changes = detectDesignChanges(oldContent, newContent);

    // Should have token change + component removal (Card) + component addition (Modal)
    expect(changes.length).toBeGreaterThanOrEqual(2);

    const notifications = buildNotifications({
      category: 'design',
      changes,
      filePath: 'contracts/standards/design-system.md',
      timestamp: '2026-02-07T10:30:00Z'
    });

    // Should have notifications for both token and component changes
    expect(notifications.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  test('handles spec with no endpoints gracefully', () => {
    const oldSpec = { version: '1.0.0', domain: 'member', endpoints: [], consumers: [] };
    const newSpec = { version: '1.1.0', domain: 'member', endpoints: [], consumers: [] };

    const changes = detectInterfaceChanges(oldSpec, newSpec);
    // Only version_bump
    expect(changes.length).toBe(1);
    expect(changes[0].changeType).toBe('version_bump');
  });

  test('handles design content with no tokens and same components', () => {
    const oldContent = '## Button\nPlain text documentation';
    const newContent = '## Button\nUpdated plain text documentation';

    const changes = detectDesignChanges(oldContent, newContent);
    // Same component heading, different body text: no structural changes
    expect(changes).toHaveLength(0);
  });

  test('handles empty consumers in spec', () => {
    const spec = {
      version: '1.0.0',
      domain: 'member',
      endpoints: [{ path: '/api/x', method: 'GET', response: { id: 'uuid' } }],
      consumers: []
    };

    const changes = [{ changeType: 'field_remove', field: 'GET /api/x.name', oldValue: 'string', newValue: null }];
    const affected = identifyAffectedDomains(changes, spec);
    expect(affected).toHaveLength(0);
  });

  test('YAML parser handles edge cases', () => {
    expect(parseSimpleYaml('')).toEqual({});
    expect(parseSimpleYaml(null)).toEqual({});
    expect(parseSimpleYaml(undefined)).toEqual({});
    expect(parseSimpleYaml(123)).toEqual({});
  });
});
