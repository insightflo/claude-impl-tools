#!/usr/bin/env node
/**
 * tasks-init Code Analyzer
 *
 * 프로젝트 코드베이스를 분석하여:
 * - 기술 스택 감지
 * - import/require 의존성 분석
 * - 도메인 구조 파악
 * - 기존 TODO 수집
 * - 파일 충돌 감지
 */

const fs = require('fs');
const path = require('path');

class CodeAnalyzer {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.dependencies = new Map();
    this.importMap = new Map();
    this.domainMap = new Map();
    this.todos = [];
  }

  /**
   * 기술 스택 감지
   */
  detectTechStack() {
    const stacks = {
      backend: [],
      frontend: [],
      shared: []
    };

    // package.json 확인
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        for (const [name, version] of Object.entries(deps)) {
          if (this.isBackend(name)) stacks.backend.push(name);
          else if (this.isFrontend(name)) stacks.frontend.push(name);
          else stacks.shared.push(name);
        }

        return {
          type: 'nodejs',
          packageManager: pkg.packageManager || 'npm',
          frameworks: this.extractFrameworks(stacks),
          stacks
        };
      } catch (e) {
        // JSON 파싱 실패 시 계속 진행
      }
    }

    // Python 감지
    const pythonFiles = ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'];
    for (const file of pythonFiles) {
      if (fs.existsSync(path.join(this.projectRoot, file))) {
        return {
          type: 'python',
          stacks: this.analyzePythonDeps(file)
        };
      }
    }

    // Go 감지
    if (fs.existsSync(path.join(this.projectRoot, 'go.mod'))) {
      return { type: 'go', stacks: { backend: [], frontend: [], shared: [] } };
    }

    // Rust 감지
    if (fs.existsSync(path.join(this.projectRoot, 'Cargo.toml'))) {
      return { type: 'rust', stacks: { backend: [], frontend: [], shared: [] } };
    }

    return { type: 'unknown', stacks: { backend: [], frontend: [], shared: [] } };
  }

  isBackend(pkgName) {
    const backendPatterns = [
      'express', 'fastify', 'koa', 'nest', 'hapi',
      'typeorm', 'prisma', 'sequelize', 'mongoose',
      'jsonwebtoken', 'bcrypt', 'passport',
      'jest', 'vitest', 'mocha', 'cypress',
      '@nestjs/', '@fastify/', '@typegoose/'
    ];
    return backendPatterns.some(p => pkgName.includes(p));
  }

  isFrontend(pkgName) {
    const frontendPatterns = [
      'react', 'vue', 'angular', 'svelte', 'solid',
      'next', 'nuxt', 'remix', 'astro',
      '@reduxjs/', '@tanstack/', '@mui/', '@chakra-ui/',
      'tailwindcss', 'styled-components', 'emotion',
      'framer-motion', 'react-router', 'vue-router'
    ];
    return frontendPatterns.some(p => pkgName.includes(p));
  }

  extractFrameworks(stacks) {
    const all = [...stacks.backend, ...stacks.frontend, ...stacks.shared];
    return all.filter(p =>
      p.includes('react') || p.includes('vue') || p.includes('angular') ||
      p.includes('next') || p.includes('express') || p.includes('nest') ||
      p.includes('fastify') || p.includes('fastapi')
    );
  }

  analyzePythonDeps(file) {
    // Python 의존성 분석 기본 구조
    return { backend: [], frontend: [], shared: [] };
  }

  /**
   * 디렉토리 구조 분석 (도메인 감지)
   */
  analyzeDirectoryStructure() {
    const srcDir = path.join(this.projectRoot, 'src');
    const domains = [];
    const domainPatterns = [
      'user', 'auth', 'product', 'order', 'payment',
      'cart', 'catalog', 'inventory', 'shipping',
      'admin', 'dashboard', 'setting', 'profile',
      'domain', 'module', 'feature'
    ];

    if (!fs.existsSync(srcDir)) {
      return { domains: [], structure: 'flat' };
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name.toLowerCase();
        if (domainPatterns.some(p => name.includes(p))) {
          domains.push({
            name: entry.name,
            path: path.join('src', entry.name),
            type: this.inferDomainType(entry.name)
          });
        }
      }
    }

    // DDD 구조 감지
    const hasDomainsDir = entries.some(e => e.name === 'domains' || e.name === 'modules');
    const structure = hasDomainsDir ? 'ddd' : (domains.length > 0 ? 'layered' : 'flat');

    return { domains, structure };
  }

  inferDomainType(dirName) {
    const name = dirName.toLowerCase();
    if (['user', 'auth', 'account', 'profile'].some(p => name.includes(p))) {
      return 'user-domain';
    }
    if (['product', 'catalog', 'item', 'inventory'].some(p => name.includes(p))) {
      return 'product-domain';
    }
    if (['order', 'cart', 'checkout', 'payment'].some(p => name.includes(p))) {
      return 'order-domain';
    }
    if (['admin', 'dashboard', 'setting', 'config'].some(p => name.includes(p))) {
      return 'admin-domain';
    }
    return 'unknown-domain';
  }

  /**
   * import/require 의존성 분석
   */
  analyzeImports() {
    const srcDir = path.join(this.projectRoot, 'src');
    if (!fs.existsSync(srcDir)) return this.importMap;

    this.scanDirectory(srcDir);
    return this.importMap;
  }

  scanDirectory(dir, baseDir = null) {
    const base = baseDir || dir;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // node_modules 등 무시
        if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
          this.scanDirectory(fullPath, base);
        }
      } else if (entry.isFile() && this.isSourceFile(entry.name)) {
        this.analyzeFile(fullPath, base);
      }
    }
  }

  isSourceFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'].includes(ext);
  }

  analyzeFile(filePath, baseDir) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(baseDir, filePath);

      const imports = this.extractImports(content, filePath);
      if (imports.length > 0) {
        this.importMap.set(relativePath, {
          imports,
          domain: this.inferFileDomain(relativePath)
        });
      }

      // TODO/FIXME 수집
      const todos = this.extractTodos(content, relativePath);
      this.todos.push(...todos);
    } catch (e) {
      // 파일 읽기 실패 시 무시
    }
  }

  extractImports(content, filePath) {
    const imports = [];
    const ext = path.extname(filePath).toLowerCase();

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      // ES6 imports
      const es6ImportRegex = /import\s+(?:(?:[\w\s{},*]*)\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = es6ImportRegex.exec(content)) !== null) {
        if (!match[1].startsWith('.')) continue; // 외부 모듈 무시
        imports.push(match[1]);
      }

      // CommonJS requires
      const cjsImportRegex = /require\(['"]([^'"]+)['"]\)/g;
      while ((match = cjsImportRegex.exec(content)) !== null) {
        if (!match[1].startsWith('.')) continue;
        imports.push(match[1]);
      }
    } else if (ext === '.py') {
      // Python imports
      const pyImportRegex = /from\s+(\S+)\s+import|import\s+(\S+)/g;
      let match;
      while ((match = pyImportRegex.exec(content)) !== null) {
        const module = match[1] || match[2];
        if (module.startsWith('.')) {
          imports.push(module);
        }
      }
    }

    return [...new Set(imports)];
  }

  inferFileDomain(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.includes('backend') || parts.includes('server') || parts.includes('api')) {
      return 'backend';
    }
    if (parts.includes('frontend') || parts.includes('client') || parts.includes('ui') ||
        filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      return 'frontend';
    }
    if (parts.includes('shared') || parts.includes('common')) {
      return 'shared';
    }
    // 파일 확장자 기반 추론
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      return 'frontend';
    }
    return 'unknown';
  }

  extractTodos(content, filePath) {
    const todos = [];
    const todoRegex = /(TODO|FIXME|XXX|HACK):\s*(.*)/gi;
    let match;
    let lineNumber = 1;

    for (const line of content.split('\n')) {
      while ((match = todoRegex.exec(line)) !== null) {
        todos.push({
          type: match[1],
          message: match[2].trim(),
          file: filePath,
          line: lineNumber
        });
      }
      lineNumber++;
    }

    return todos;
  }

  /**
   * 의존성 그래프 생성 (태스크 의존성 계산용)
   */
  buildDependencyGraph() {
    const graph = {};

    for (const [file, data] of this.importMap.entries()) {
      const fromTask = this.fileToTaskId(file);
      if (!fromTask) continue;

      graph[fromTask] = [];

      for (const imp of data.imports) {
        const toTask = this.importToTaskId(imp, file);
        if (toTask && toTask !== fromTask) {
          graph[fromTask].push(toTask);
        }
      }
    }

    return graph;
  }

  fileToTaskId(filePath) {
    // 파일 경로를 태스크 ID로 변환
    // 예: src/user/UserService.ts → T1.1
    const parts = filePath.split(path.sep);
    const domain = parts.find(p => this.isDomainName(p));
    if (domain) {
      return `${domain}-${path.basename(filePath, path.extname(filePath))}`;
    }
    return null;
  }

  isDomainName(name) {
    const domainNames = ['user', 'auth', 'product', 'order', 'payment', 'cart', 'admin'];
    return domainNames.includes(name.toLowerCase());
  }

  importToTaskId(impPath, fromFile) {
    // 상대 경로 import를 태스크 ID로 변환
    if (impPath.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      const resolved = path.normalize(path.join(fromDir, impPath));
      return this.fileToTaskId(resolved);
    }
    return null;
  }

  /**
   * 위험도 분류
   */
  classifyRisk(filePath, content = '') {
    const criticalPatterns = [
      /password|auth|token|jwt|session/i,
      /payment|billing|invoice|refund/i,
      /credit.?card|bank.?account|swift/i,
      /social.?security|ssn|personal.?identifiable/i,
      /admin.*delete|admin.*destroy/i,
      /\.env|process\.env/i
    ];

    const highPatterns = [
      /email.*send|notification|sms/i,
      /upload.*file|file.*upload/i,
      /external.*api|third.?party/i,
      /cache|redis|memcached/i
    ];

    const pathCheck = criticalPatterns.some(p => p.test(filePath)) ? 'critical' :
                      highPatterns.some(p => p.test(filePath)) ? 'high' : 'low';

    if (pathCheck !== 'low') return pathCheck;

    const contentCheck = criticalPatterns.some(p => p.test(content)) ? 'critical' :
                         highPatterns.some(p => p.test(content)) ? 'high' : 'low';

    return contentCheck;
  }

  /**
   * 분석 결과 종합
   */
  analyze() {
    const techStack = this.detectTechStack();
    const dirStructure = this.analyzeDirectoryStructure();
    const imports = this.analyzeImports();
    const depGraph = this.buildDependencyGraph();

    return {
      techStack,
      dirStructure,
      imports: Object.fromEntries(this.importMap),
      dependencies: depGraph,
      todos: this.todos,
      summary: {
        totalFiles: this.importMap.size,
        totalImports: Array.from(this.importMap.values()).reduce((sum, v) => sum + v.imports.length, 0),
        todoCount: this.todos.length,
        domainCount: dirStructure.domains.length
      }
    };
  }
}

// CLI 실행
if (require.main === module) {
  const analyzer = new CodeAnalyzer();
  const result = analyzer.analyze();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = CodeAnalyzer;
