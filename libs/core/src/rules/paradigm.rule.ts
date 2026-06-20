import * as ts from 'typescript';
import { Rule, RuleContext, Violation, getLineAndCharacter } from './rule.interface';

export class ParadigmRule implements Rule {
  run(context: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { sourceFile, filePath, configManager } = context;
    const layers = configManager.getFileLayers(filePath);
    const isUiLayer = layers.includes('ui');
    const angularVersion = configManager.getAngularVersion();

    function checkNode(node: ts.Node) {
      // 1. Block legacy decorators (@Input, @Output) & legacy query decorators (@ViewChild, etc.)
      if (ts.isPropertyDeclaration(node)) {
        if (node.modifiers) {
          for (const modifier of node.modifiers) {
            if (ts.isDecorator(modifier)) {
              const decoratorText = modifier.expression.getText(sourceFile);
              if ((decoratorText.startsWith('Input') || decoratorText.startsWith('Output')) && angularVersion >= 17) {
                const { line, character } = getLineAndCharacter(sourceFile, modifier);
                violations.push({
                  ruleId: 'LEGACY_DECORATOR',
                  message: `Modern Paradigm Violation: Legacy decorator "@${decoratorText}" is forbidden. Enforce modern Angular v17+ syntax (e.g. input() instead of @Input()).`,
                  file: filePath,
                  line,
                  character
                });
              } else if (
                (decoratorText.startsWith('ViewChild') ||
                decoratorText.startsWith('ViewChildren') ||
                decoratorText.startsWith('ContentChild') ||
                decoratorText.startsWith('ContentChildren')) &&
                angularVersion >= 17
              ) {
                const { line, character } = getLineAndCharacter(sourceFile, modifier);
                violations.push({
                  ruleId: 'MODERN_QUERY',
                  message: `Modern Paradigm Violation: Legacy query decorator "@${decoratorText}" is forbidden. Enforce modern Signal-based queries (e.g. viewChild() instead of @ViewChild()).`,
                  file: filePath,
                  line,
                  character
                });
              }
            }
          }
        }

        // 2. Forbid raw RxJS Subject/Observable in UI components (only for Angular 16+ where Signals exist)
        if (isUiLayer && angularVersion >= 16) {
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

      // 3. Enforce OnPush change detection strategy and Standalone components
      if (ts.isClassDeclaration(node) && node.modifiers) {
        let isComponent = false;
        let hasOnPush = false;
        let isStandalone = false;
        let componentDecoratorNode: ts.Node | null = null;

        for (const mod of node.modifiers) {
          if (ts.isDecorator(mod) && ts.isCallExpression(mod.expression)) {
            const decoratorName = mod.expression.expression.getText(sourceFile);
            if (decoratorName === 'Component') {
              isComponent = true;
              componentDecoratorNode = mod;
              const args = mod.expression.arguments;
              if (args.length > 0 && ts.isObjectLiteralExpression(args[0])) {
                const properties = args[0].properties;
                for (const prop of properties) {
                  if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                    if (prop.name.text === 'changeDetection') {
                      const val = prop.initializer.getText(sourceFile);
                      if (val.includes('OnPush')) {
                        hasOnPush = true;
                      }
                    } else if (prop.name.text === 'standalone') {
                      const val = prop.initializer.getText(sourceFile);
                      if (val === 'true') {
                        isStandalone = true;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (isComponent && componentDecoratorNode) {
          const className = node.name ? node.name.text : 'AnonymousComponent';
          if (!hasOnPush) {
            const { line, character } = getLineAndCharacter(sourceFile, componentDecoratorNode);
            violations.push({
              ruleId: 'ENFORCE_ONPUSH',
              message: `Modern Paradigm Violation: Component "${className}" does not use "changeDetection: ChangeDetectionStrategy.OnPush". OnPush change detection is required for optimal performance.`,
              file: filePath,
              line,
              character
            });
          }
          if (!isStandalone && angularVersion >= 14) {
            const { line, character } = getLineAndCharacter(sourceFile, componentDecoratorNode);
            violations.push({
              ruleId: 'ENFORCE_STANDALONE',
              message: `Modern Paradigm Violation: Component "${className}" is not standalone. Enforce standalone components ("standalone: true") for modularity and modern Angular standards.`,
              file: filePath,
              line,
              character
            });
          }
        }
      }

      // 4. Detect manual .subscribe() calls without takeUntilDestroyed (RxJS Memory Leaks)
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'subscribe') {
        let isSafe = false;
        const receiver = node.expression.expression;
        if (ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression) && receiver.expression.name.text === 'pipe') {
          for (const arg of receiver.arguments) {
            if (ts.isCallExpression(arg) && arg.expression.getText(sourceFile).includes('takeUntilDestroyed')) {
              isSafe = true;
            }
          }
        }
        if (!isSafe) {
          const { line, character } = getLineAndCharacter(sourceFile, node);
          const suggestion = angularVersion >= 16
            ? 'pipe the observable with "takeUntilDestroyed()"'
            : 'pipe the observable with "takeUntil(this.destroy$)"';
          violations.push({
            ruleId: 'UNSAFE_MANUAL_SUBSCRIBE',
            message: `RxJS Memory Safety Violation: Manual ".subscribe()" call detected. To prevent memory leaks, ${suggestion} or use the async pipe/toSignal() in templates.`,
            file: filePath,
            line,
            character
          });
        }
      }

      // 5. Detect platform isolation violations (direct access to window, document, localStorage, etc.)
      if (ts.isIdentifier(node)) {
        const text = node.text;
        if (text === 'window' || text === 'document' || text === 'localStorage' || text === 'sessionStorage') {
          let p = node.parent;
          let isPropertyAccessName = p && ts.isPropertyAccessExpression(p) && p.name === node;
          let isImportOrType = false;
          while (p) {
            if (ts.isImportDeclaration(p) || ts.isImportSpecifier(p) || ts.isTypeReferenceNode(p) || ts.isParameter(p)) {
              isImportOrType = true;
              break;
            }
            p = p.parent;
          }
          if (!isPropertyAccessName && !isImportOrType) {
            let isSafe = false;
            let parentNode: ts.Node | undefined = node.parent;
            while (parentNode) {
              if (ts.isCallExpression(parentNode)) {
                const exprText = parentNode.expression.getText(sourceFile);
                if (exprText === 'afterRender' || exprText === 'afterNextRender') {
                  isSafe = true;
                  break;
                }
              }
              if (ts.isIfStatement(parentNode)) {
                const condText = parentNode.expression.getText(sourceFile);
                if (condText.includes('isPlatformBrowser')) {
                  isSafe = true;
                  break;
                }
              }
              if (ts.isConditionalExpression(parentNode)) {
                const condText = parentNode.condition.getText(sourceFile);
                if (condText.includes('isPlatformBrowser')) {
                  isSafe = true;
                  break;
                }
              }
              parentNode = parentNode.parent;
            }

            if (!isSafe) {
              const { line, character } = getLineAndCharacter(sourceFile, node);
              violations.push({
                ruleId: 'PLATFORM_ISOLATION_VIOLATION',
                message: `SSR/Hydration Safety Violation: Direct access to global variable "${text}" is forbidden. Inject the "DOCUMENT" token or use "isPlatformBrowser" / "afterRender" checks for platform-agnostic code.`,
                file: filePath,
                line,
                character
              });
            }
          }
        }
      }

      ts.forEachChild(node, checkNode);
    }

    ts.forEachChild(sourceFile, checkNode);
    return violations;
  }
}
