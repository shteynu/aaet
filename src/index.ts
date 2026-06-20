import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { ConfigManager } from './context/config-manager';
import { Rule, RuleContext, Violation } from './rules/rule.interface';
import { LayeringRule } from './rules/layering.rule';
import { AiReadinessRule } from './rules/ai-readiness.rule';
import { ParadigmRule } from './rules/paradigm.rule';
import { PerformanceRule } from './rules/performance.rule';

export function runStaticAnalysis(projectRoot: string, filesToAnalyze?: string[]): Violation[] {
  const configManager = new ConfigManager(projectRoot);
  const rules: Rule[] = [
    new LayeringRule(),
    new AiReadinessRule(),
    new ParadigmRule(),
    new PerformanceRule()
  ];

  let files = filesToAnalyze;
  if (!files) {
    files = getFilesRecursive(path.resolve(projectRoot, 'src'))
      .concat(getFilesRecursive(path.resolve(projectRoot, 'tests')));
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

    const context: RuleContext = {
      sourceFile,
      filePath,
      configManager
    };

    for (const rule of rules) {
      const violations = rule.run(context);
      allViolations.push(...violations);
    }
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

// Check if run directly
const isRunDirectly = process.argv[1] && (
  process.argv[1].endsWith('index.ts') || 
  process.argv[1].endsWith('index.js') || 
  process.argv[1].includes('tsx')
);

if (isRunDirectly) {
  const targetDir = process.cwd();
  console.log(`\n🔍 AAET: Angular Architectural Enforcement Toolkit (AI-Ready Architecture Guard)`);
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
