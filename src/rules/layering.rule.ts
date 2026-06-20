import * as ts from 'typescript';
import * as path from 'path';
import { Rule, RuleContext, Violation, getLineAndCharacter } from './rule.interface';

export class LayeringRule implements Rule {
  run(context: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { sourceFile, filePath, configManager } = context;

    // 1. Check Import Layer Violations
    function checkImports(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
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
      ts.forEachChild(node, checkImports);
    }
    checkImports(sourceFile);

    // 2. Check SOLID DI Limits (maxAllowedDI)
    const limits = configManager.getConfig().limits;
    const maxAllowedDI = limits ? limits.maxAllowedDI : 3;

    function checkClasses(node: ts.Node) {
      if (ts.isClassDeclaration(node)) {
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

        // Check inject() DI
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
        ts.forEachChild(node, findInjectCalls);

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
      ts.forEachChild(node, checkClasses);
    }
    checkClasses(sourceFile);

    return violations;
  }
}
