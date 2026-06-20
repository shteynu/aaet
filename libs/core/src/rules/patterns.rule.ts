import * as ts from 'typescript';
import { Rule, RuleContext, Violation, getLineAndCharacter } from './rule.interface';

export class PatternsRule implements Rule {
  run(context: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { sourceFile, filePath } = context;

    const classes = context.getNodes<ts.ClassDeclaration>(ts.SyntaxKind.ClassDeclaration);
    for (const node of classes) {
      // Collect injected dependencies for this class
      const injectedDeps = new Set<string>();

      // Constructor injection
      const constructors = node.members.filter(ts.isConstructorDeclaration);
      for (const cons of constructors) {
        for (const param of cons.parameters) {
          injectedDeps.add(param.name.getText(sourceFile));
        }
      }

      // property inject() injection
      for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && member.initializer) {
          const init = member.initializer;
          if (ts.isCallExpression(init) && init.expression.getText(sourceFile) === 'inject') {
            injectedDeps.add(member.name.getText(sourceFile));
          }
        }
      }

      // Traverse methods inside this class to check for smells
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.body) {
          const methodName = member.name.getText(sourceFile);
          
          const switchStatements: ts.SwitchStatement[] = [];
          const accessedDeps = new Set<string>();

          function walk(n: ts.Node) {
            if (ts.isSwitchStatement(n)) {
              switchStatements.push(n);
            } else if (ts.isPropertyAccessExpression(n) && n.expression.kind === ts.SyntaxKind.ThisKeyword) {
              const propName = n.name.getText(sourceFile);
              if (injectedDeps.has(propName)) {
                accessedDeps.add(propName);
              }
            }
            ts.forEachChild(n, walk);
          }
          walk(member.body);

          // A. Check for SWITCH_STRATEGY_SMELL
          for (const sw of switchStatements) {
            const caseCount = sw.caseBlock.clauses.filter(ts.isCaseClause).length;
            if (caseCount >= 4) {
              const { line, character } = getLineAndCharacter(sourceFile, sw);
              violations.push({
                ruleId: 'SWITCH_STRATEGY_SMELL',
                message: `Design Pattern Suggestion: Large switch statement (${caseCount} cases) detected inside method "${methodName}". Consider replacing conditional dispatch with the Strategy or State pattern to improve extensibility and follow the Open/Closed Principle.`,
                file: filePath,
                line,
                character
              });
            }
          }

          // B. Check for TIGHT_COUPLING_OBSERVER_SMELL
          if (injectedDeps.size >= 3 && accessedDeps.size >= 3) {
            const { line, character } = getLineAndCharacter(sourceFile, member);
            violations.push({
              ruleId: 'TIGHT_COUPLING_OBSERVER_SMELL',
              message: `Design Pattern Suggestion: Method "${methodName}" accesses ${accessedDeps.size} different injected dependencies: [${Array.from(accessedDeps).join(', ')}]. This tight coupling suggests a Mediator or Event Bus / Observer pattern should be used to decouple interaction logic.`,
              file: filePath,
              line,
              character
            });
          }
        }
      }
    }

    return violations;
  }
}
