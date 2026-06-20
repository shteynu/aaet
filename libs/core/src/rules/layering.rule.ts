import * as ts from 'typescript';
import * as path from 'path';
import { Rule, RuleContext, Violation, getLineAndCharacter } from './rule.interface';

export class LayeringRule implements Rule {
  run(context: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { sourceFile, filePath, configManager } = context;

    // 1. Check Import Layer Violations
    const imports = context.getNodes<ts.ImportDeclaration>(ts.SyntaxKind.ImportDeclaration);
    for (const node of imports) {
      const importPath = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      let resolvedPath = importPath;
      
      if (importPath.startsWith('.')) {
        resolvedPath = path.resolve(path.dirname(filePath), importPath);
        if (!resolvedPath.endsWith('.ts') && !resolvedPath.endsWith('.tsx') && !resolvedPath.endsWith('.js')) {
          resolvedPath += '.ts';
        }
      }

      const violationCheck = configManager.checkViolation(filePath, resolvedPath);
      if (violationCheck.violates) {
        const { line, character } = getLineAndCharacter(sourceFile, node);
        violations.push({
          ruleId: 'STRICT_LAYERING',
          message: `Layer boundary violation: File in layer "${violationCheck.fromLayer}" cannot import from layer "${violationCheck.forbiddenLayer}" (${importPath}).`,
          file: filePath,
          line,
          character
        });
      }
    }

    // 2. Check SOLID DI Limits (maxAllowedDI)
    const maxAllowedDI = configManager.getConfig().checkers.static.settings.maxAllowedDI;

    const classes = context.getNodes<ts.ClassDeclaration>(ts.SyntaxKind.ClassDeclaration);
    for (const node of classes) {
      let diCount = 0;
      const diDetails: string[] = [];

      // Check constructor DI
      const constructors = node.members.filter(ts.isConstructorDeclaration);
      for (const cons of constructors) {
        for (const param of cons.parameters) {
          if (param.type) {
            diCount++;
            diDetails.push(param.name.getText(sourceFile) + ': ' + param.type.getText(sourceFile));
          }
        }
      }

      // Check inject() DI - find inject calls inside class members
      function findInjectCalls(n: ts.Node) {
        if (ts.isCallExpression(n) && n.expression.getText(sourceFile) === 'inject') {
          diCount++;
          let propName = 'injected';
          let p = n.parent;
          while (p && p !== node) {
            if (ts.isPropertyDeclaration(p) || ts.isVariableDeclaration(p)) {
              propName = p.name.getText(sourceFile);
              break;
            }
            p = p.parent;
          }
          let token = 'unknown';
          if (n.typeArguments && n.typeArguments.length > 0) {
            token = n.typeArguments[0].getText(sourceFile);
          } else if (n.arguments && n.arguments.length > 0) {
            token = n.arguments[0].getText(sourceFile);
          }
          diDetails.push(`${propName} (inject(${token}))`);
        }
        ts.forEachChild(n, findInjectCalls);
      }

      for (const member of node.members) {
        findInjectCalls(member);
      }

      if (diCount > maxAllowedDI) {
        const className = node.name ? node.name.getText(sourceFile) : 'AnonymousClass';
        const { line, character } = getLineAndCharacter(sourceFile, node);
        violations.push({
          ruleId: 'MAX_DI_LIMIT',
          message: `SOLID Violation: Class "${className}" has ${diCount} injected dependencies, exceeding the maximum allowed of ${maxAllowedDI}. Injections: [${diDetails.join(', ')}].`,
          file: filePath,
          line,
          character
        });
      }
    }

    return violations;
  }
}
