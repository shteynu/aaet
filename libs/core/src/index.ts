import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { ConfigManager } from './context/config-manager';
import { Rule, RuleContext, Violation } from './rules/rule.interface';
import { LayeringRule } from './rules/layering.rule';
import { AiReadinessRule } from './rules/ai-readiness.rule';
import { ParadigmRule } from './rules/paradigm.rule';
import { PerformanceRule } from './rules/performance.rule';
import { PatternsRule } from './rules/patterns.rule';

export * from './ai-check.server';
export * from './context/config-manager';
export * from './plugins/vite-plugin';
export * from './plugins/webpack-plugin';
export * from './eslint/eslint-rule';

let sharedConfigManager: ConfigManager | null = null;

export function getOrCreateConfigManager(projectRoot: string): ConfigManager {
  if (!sharedConfigManager) {
    sharedConfigManager = new ConfigManager(projectRoot);
  }
  return sharedConfigManager;
}

export function invalidateFileCache(filePath: string) {
  if (sharedConfigManager) {
    sharedConfigManager.invalidateFile(filePath);
  }
}

export function runStaticAnalysisForSourceFile(
  sourceFile: ts.SourceFile,
  filePath: string,
  configManager: ConfigManager
): Violation[] {
  const rules: Rule[] = [
    new LayeringRule(),
    new AiReadinessRule(),
    new ParadigmRule(),
    new PerformanceRule(),
    new PatternsRule()
  ];

  const nodesByKind = new Map<ts.SyntaxKind, ts.Node[]>();
  function visit(node: ts.Node) {
    let list = nodesByKind.get(node.kind);
    if (!list) {
      list = [];
      nodesByKind.set(node.kind, list);
    }
    list.push(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const context: RuleContext = {
    sourceFile,
    filePath,
    configManager,
    getNodes<T extends ts.Node>(kind: ts.SyntaxKind): T[] {
      return (nodesByKind.get(kind) || []) as T[];
    }
  };

  const violations: Violation[] = [];
  for (const rule of rules) {
    const v = rule.run(context);
    violations.push(...v);
  }
  return violations;
}

export function runStaticAnalysis(projectRoot: string, filesToAnalyze?: string[]): Violation[] {
  const configManager = getOrCreateConfigManager(projectRoot);

  let files = filesToAnalyze;
  if (!files) {
    files = getFilesRecursive(path.resolve(projectRoot, 'libs'))
      .concat(getFilesRecursive(path.resolve(projectRoot, 'apps')));
  }

  const allViolations: Violation[] = [];

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const violations = runStaticAnalysisForSourceFile(sourceFile, filePath, configManager);
    allViolations.push(...violations);
  }

  return allViolations;
}

function getFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.resolve(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        results.push(...getFilesRecursive(filePath));
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(filePath);
    }
  }
  return results;
}

// Helper to generate .ai-context.md file
function generateAiContextFile(targetDir: string) {
  const configManager = new ConfigManager(targetDir);
  const config = configManager.getConfig();
  const angularVersion = configManager.getAngularVersion();
  const workspaceType = configManager.getWorkspaceType();

  let layersTable = '| Layer Name | Glob Pattern |\n|---|---|\n';
  for (const [layerName, pattern] of Object.entries(config.layers)) {
    layersTable += `| \`${layerName}\` | \`${pattern}\` |\n`;
  }

  let restrictionsList = '';
  config.layerRestrictions.forEach(r => {
    restrictionsList += `- **\`${r.from}\`** cannot depend on: ${r.cannotDependOn.map(l => `\`${l}\``).join(', ')}\n`;
  });

  const maxAllowedDI = config.limits?.maxAllowedDI ?? 3;
  const maxLines = config.limits?.maxLines ?? 400;

  const content = `# AAET Workspace Architecture Context
This file describes the architectural rules and best practices enforced in this project. Use this context when generating or refactoring Angular code.

## Environment Context
- **Angular Version:** v${angularVersion}
- **Workspace Layout:** ${workspaceType === 'nx' ? 'Nx Monorepo' : 'Standalone App'}

## Architectural Layers
${layersTable}

## Layer Boundaries & Import Restrictions
${restrictionsList}

## Coding Standards & Limits
- **Max Dependency Injections per class:** ${maxAllowedDI} (constructors + \`inject()\` combined)
- **Max Lines per File:** ${maxLines} (to keep files clean and context-efficient)
- **Modern Angular Syntax:**
  - Mandatory use of Signal-based inputs (\`input()\`) and outputs (\`output()\`) instead of legacy decorators (\`@Input\`, \`@Output\`).
  - Mandatory use of Signal-based queries (\`viewChild()\`, \`contentChild()\`, etc.) instead of legacy decorators (\`@ViewChild\`, etc.).
  - Mandatory use of \`ChangeDetectionStrategy.OnPush\` for all UI Components.
  - Forbid raw RxJS Subjects/Observables in UI components (prefer Signals, \`toSignal()\`, etc.).
  - Forbid direct browser global variable access (\`window\`, \`document\`, \`localStorage\`) outside SSR-safe contexts (e.g. \`afterRender\`, \`isPlatformBrowser\`).
- **RxJS Memory Safety & Leak Detection:**
  - Forbid manual \`.subscribe()\` calls without \`takeUntilDestroyed()\` or \`takeUntil(this.destroy$)\`. Prefer using the async template pipe or \`toSignal()\`.
  - Active runtime tracking monitors and reports active RxJS subscription leaks during component destruction.
- **Template & Rendering Performance:**
  - Forbid method calls in templates (interpolation or property binding) to avoid execution on every Change Detection cycle. Use \`computed\` signals or pre-calculated properties instead.
  - Enforce modern Angular v17+ control flow syntax (\`@if\`, \`@for\`, \`@switch\`) instead of legacy structural directives (\`*ngIf\`, \`*ngFor\`, \`*ngSwitch\`).
- **Routing & Lazy Loading:**
  - Routing files must lazy-load component modules using dynamic imports (\`loadComponent: () => import(...)\`).
  - Statically importing a component targeted by a \`@defer\` block is forbidden (it defeats lazy loading).
- **Platform-Agnostic Isolation:**
  - Direct access to browser globals (\`window\`, \`document\`, \`localStorage\`, \`sessionStorage\`) is forbidden. Inject Angular's \`DOCUMENT\` token or run under SSR-safe context guards (\`isPlatformBrowser\`, \`afterRender\`).
- **AI-Readiness & Token Economy:**
  - Strictly enforce file size limits (${maxLines} lines) to maintain context-efficiency.
  - All public methods must declare explicit return type annotations to make API contracts predictable for code-generation models.

## Enforcement Mechanisms
- **Static Analysis (AAET CLI):** Run \`npm run analyze\` to scan the codebase for architectural, performance, and AI-readiness violations.
- **AI Auto-Fix CLI:** Run \`npx tsx libs/core/src/index.ts --fix\` to automatically refactor violating files using OpenAI/Anthropic models.
- **ESLint Integration:** Enforce static analysis directly inside the development workflow using custom ESLint rules.
- **Build Integrations:** Vite and Webpack plugins validate architectural constraints during active development loops.
- **Runtime Guards:** Real-time checking flags active subscription leaks on component destroy and provides interactive console-based \`aaet.analyze(<id>)\` suggestions.
`;

  const outputPath = path.resolve(targetDir, '.ai-context.md');
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`✅ [AAET AI Context] Generated context file at: ${outputPath}`);
}

// Helper to run AI Auto-Fixing
async function runAiAutoFix(targetDir: string) {
  const configManager = new ConfigManager(targetDir);
  const violations = runStaticAnalysis(targetDir);

  if (violations.length === 0) {
    console.log('✅ No architectural or AI-readiness violations found! Codebase is healthy.');
    return;
  }

  console.log(`🤖 Found ${violations.length} violations. Starting AI Auto-Fix...\n`);

  // Group violations by file path
  const violationsByFile = new Map<string, typeof violations>();
  violations.forEach(v => {
    const list = violationsByFile.get(v.file) || [];
    list.push(v);
    violationsByFile.set(v.file, list);
  });

  let fixedCount = 0;

  for (const [filePath, fileViolations] of violationsByFile.entries()) {
    const relativeFile = path.relative(targetDir, filePath);
    console.log(`🤖 Refactoring: ${relativeFile}...`);

    // Combine violation messages
    const combinedMessage = fileViolations.map(v => `[${v.ruleId}] Line ${v.line}: ${v.message}`).join('\n');
    const firstViolation = fileViolations[0];

    try {
      const response = await handleAiCheckRequest({
        filePath,
        ruleId: firstViolation.ruleId,
        violationMessage: combinedMessage,
        className: 'TargetFile',
        angularVersion: configManager.getAngularVersion(),
        workspaceType: configManager.getWorkspaceType(),
        fullFileFix: true
      });

      if (response && response.suggestion) {
        fs.writeFileSync(filePath, response.suggestion, 'utf8');
        console.log(`   ✅ Successfully refactored: ${relativeFile}`);
        fixedCount++;
      } else {
        console.log(`   ⚠️ No refactoring suggestion returned for: ${relativeFile}`);
      }
    } catch (err: any) {
      console.error(`   ❌ Failed to fix ${relativeFile}: ${err.message}`);
    }
  }

  console.log(`\n🎉 AI Auto-Fix completed! Successfully refactored ${fixedCount} of ${violationsByFile.size} file(s).`);
}

// Check if run directly
const isRunDirectly = process.argv[1] && (
  process.argv[1].endsWith('index.ts') || 
  process.argv[1].endsWith('index.js') || 
  process.argv[1].includes('tsx')
);

if (isRunDirectly) {
  const targetDir = process.cwd();
  console.log(`\n🔍 AAET: Angular Architectural Enforcement Toolkit (AI-Ready Architecture Guard)`);

  const hasFixFlag = process.argv.includes('--fix') || process.argv.includes('-f');
  const hasContextFlag = process.argv.includes('--context') || process.argv.includes('-c');

  if (hasContextFlag) {
    try {
      generateAiContextFile(targetDir);
      process.exit(0);
    } catch (err: any) {
      console.error(`Error generating context file: ${err.message}`);
      process.exit(2);
    }
  }

  if (hasFixFlag) {
    console.log(`Running AI Auto-Fix on: ${targetDir}\n`);
    runAiAutoFix(targetDir)
      .then(() => process.exit(0))
      .catch(err => {
        console.error(`Error running AI Auto-Fix: ${err.message}`);
        process.exit(2);
      });
  } else {
    console.log(`Running static analysis on: ${targetDir}\n`);
    try {
      const violations = runStaticAnalysis(targetDir);

      if (violations.length === 0) {
        console.log('✅ No architectural or AI-readiness violations found! Codebase is healthy.');
        process.exit(0);
      } else {
        console.log(`❌ Found ${violations.length} violations:\n`);
        violations.forEach(v => {
          const relativeFile = path.relative(targetDir, v.file);
          console.log(`[${v.ruleId}] ${relativeFile}:${v.line}:${v.character}`);
          console.log(`   👉 ${v.message}\n`);
        });
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Error running static analysis: ${err.message}`);
      process.exit(2);
    }
  }
}
