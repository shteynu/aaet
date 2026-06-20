import * as ts from 'typescript';
import { Rule, RuleContext, Violation, getLineAndCharacter } from './rule.interface';

export class AiReadinessRule implements Rule {
  run(context: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { sourceFile, filePath, configManager } = context;

    // 1. One-Shot Context: Flag files exceeding max lines
    const maxLines = configManager.getConfig().checkers.static.settings.maxLines;
    const lineCount = sourceFile.getLineStarts().length;
    if (lineCount > maxLines) {
      violations.push({
        ruleId: 'ONE_SHOT_CONTEXT_LIMIT',
        message: `AI-Readiness Violation: File has ${lineCount} lines, exceeding the maximum allowed size of ${maxLines} lines. Break down this file to keep AI context window usage efficient.`,
        file: filePath,
        line: 1,
        character: 1
      });
    }

    // 2. Explicit Token Economy: public methods must have strict return types
    const classes = context.getNodes<ts.ClassDeclaration>(ts.SyntaxKind.ClassDeclaration);
    for (const node of classes) {
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member)) {
          const isPrivateOrProtected = member.modifiers?.some(
            mod => mod.kind === ts.SyntaxKind.PrivateKeyword || mod.kind === ts.SyntaxKind.ProtectedKeyword
          );

          if (!isPrivateOrProtected) {
            if (!member.type) {
              const methodName = member.name.getText(sourceFile);
              const { line, character } = getLineAndCharacter(sourceFile, member);
              violations.push({
                ruleId: 'EXPLICIT_TOKEN_ECONOMY',
                message: `AI-Readiness Violation: Public method "${methodName}" lacks an explicit return type annotation. Strict return types make the API predictable for code generation models.`,
                file: filePath,
                line,
                character
              });
            }
          }
        }
      }
    }

    return violations;
  }
}
