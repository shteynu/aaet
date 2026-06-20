import { getOrCreateConfigManager, runStaticAnalysisForSourceFile } from '../index';

export const aaetEslintRule = {
  meta: {
    type: 'problem' as const,
    docs: {
      description: 'Enforce Angular Architectural Enforcement Toolkit (AAET) boundaries and best practices',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [], // no options by default
  },
  create(context: any): any {
    const parserServices = context.parserServices;
    if (!parserServices || !parserServices.program) {
      // Return empty object if typescript-eslint parser is not in use
      return {};
    }

    const filePath = context.getFilename();
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) {
      return {};
    }

    const sourceFile = parserServices.program.getSourceFile(filePath);
    if (!sourceFile) {
      return {};
    }

    const projectRoot = context.getCwd ? context.getCwd() : process.cwd();
    const configManager = getOrCreateConfigManager(projectRoot);

    // Run the static rules using the pre-parsed AST from ESLint parserServices
    const violations = runStaticAnalysisForSourceFile(sourceFile, filePath, configManager);

    // Report all violations directly to ESLint
    for (const v of violations) {
      context.report({
        loc: {
          start: { line: v.line, column: v.character - 1 },
          end: { line: v.line, column: v.character }
        },
        message: `[AAET] ${v.message} (${v.ruleId})`
      });
    }

    return {};
  }
};
