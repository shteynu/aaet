import * as ts from 'typescript';
import { Rule, RuleContext, Violation, getLineAndCharacter } from './rule.interface';

export class ParadigmRule implements Rule {
  run(context: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { sourceFile, filePath, configManager } = context;
    const layers = configManager.getFileLayers(filePath);
    const isUiLayer = layers.includes('ui');

    function checkNode(node: ts.Node) {
      // 1. Block legacy decorators (@Input, @Output)
      if (ts.isPropertyDeclaration(node)) {
        if (node.modifiers) {
          for (const modifier of node.modifiers) {
            if (ts.isDecorator(modifier)) {
              const decoratorText = modifier.expression.getText(sourceFile);
              if (decoratorText.startsWith('Input') || decoratorText.startsWith('Output')) {
                const { line, character } = getLineAndCharacter(sourceFile, modifier);
                violations.push({
                  ruleId: 'LEGACY_DECORATOR',
                  message: `Modern Paradigm Violation: Legacy decorator "@${decoratorText}" is forbidden. Enforce modern Angular v19+ syntax (e.g. input() instead of @Input()).`,
                  file: filePath,
                  line,
                  character
                });
              }
            }
          }
        }

        // 2. Forbid raw RxJS Subject/Observable in UI components
        if (isUiLayer) {
          let hasRxjs = false;
          let rxType = '';

          if (node.type) {
            const typeText = node.type.getText(sourceFile);
            if (/\b(Subject|BehaviorSubject|Observable|ReplaySubject)\b/.test(typeText)) {
              hasRxjs = true;
              rxType = typeText;
            }
          }

          if (node.initializer && !hasRxjs) {
            const initText = node.initializer.getText(sourceFile);
            if (/\bnew\s+(Subject|BehaviorSubject|Observable|ReplaySubject)\b/.test(initText)) {
              hasRxjs = true;
              rxType = initText;
            }
          }

          if (hasRxjs) {
            const propName = node.name.getText(sourceFile);
            const { line, character } = getLineAndCharacter(sourceFile, node);
            violations.push({
              ruleId: 'FORBID_RAW_RXJS_UI',
              message: `Modern Paradigm Violation: Raw RxJS property "${propName}" of type/initializer "${rxType}" is forbidden in UI components. Re-architect using Angular Signals (e.g., input(), computed(), signal(), or toSignal()) for modern performance and declarative templates.`,
              file: filePath,
              line,
              character
            });
          }
        }
      }
      ts.forEachChild(node, checkNode);
    }

    ts.forEachChild(sourceFile, checkNode);
    return violations;
  }
}
