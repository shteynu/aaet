import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { Rule, RuleContext, Violation, getLineAndCharacter } from './rule.interface';

export class PerformanceRule implements Rule {
  run(context: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { sourceFile, filePath, configManager } = context;
    const angularVersion = configManager.getAngularVersion();

    const allTemplates: string[] = [];

    const checkTemplateString = (template: string, sourceNode: ts.Node) => {
      const interpolationRegex = /\{\{([\s\S]*?)\}\}/g;
      let match;
      while ((match = interpolationRegex.exec(template)) !== null) {
        const expression = match[1];
        if (/\b([a-zA-Z0-9_$]+)\s*\(/.test(expression)) {
          const methodMatch = expression.match(/\b([a-zA-Z0-9_$]+)\s*\(/);
          const methodName = methodMatch ? methodMatch[1] : 'unknown';
          const { line, character } = getLineAndCharacter(sourceFile, sourceNode);
          violations.push({
            ruleId: 'TEMPLATE_METHOD_CALL',
            message: `Performance Violation: Method call "${methodName}()" detected in template interpolation. Method calls in templates run on every Change Detection cycle; use Angular Signals (computed) or pre-calculated properties instead.`,
            file: filePath,
            line,
            character
          });
        }
      }

      const bindingRegex = /\[([a-zA-Z0-9.-]+)\]\s*=\s*['"]([^'"]+)['"]/g;
      while ((match = bindingRegex.exec(template)) !== null) {
        const expression = match[2];
        if (/\b([a-zA-Z0-9_$]+)\s*\(/.test(expression)) {
          const methodMatch = expression.match(/\b([a-zA-Z0-9_$]+)\s*\(/);
          const methodName = methodMatch ? methodMatch[1] : 'unknown';
          const { line, character } = getLineAndCharacter(sourceFile, sourceNode);
          violations.push({
            ruleId: 'TEMPLATE_METHOD_CALL',
            message: `Performance Violation: Method call "${methodName}()" detected in template property binding. Use Angular Signals (computed) or pre-calculated properties instead.`,
            file: filePath,
            line,
            character
          });
        }
      }

      // Check for legacy control flow directives
      if (angularVersion >= 17) {
        if (/\*ngIf\b/.test(template)) {
          const { line, character } = getLineAndCharacter(sourceFile, sourceNode);
          violations.push({
            ruleId: 'LEGACY_TEMPLATE_CONTROL_FLOW',
            message: `Modern Syntax Violation: Legacy structural directive "*ngIf" detected. Enforce modern Angular v17+ control flow syntax (e.g. "@if (...) {}") for better performance and cleaner AI code generation.`,
            file: filePath,
            line,
            character
          });
        }
        if (/\*ngFor\b/.test(template)) {
          const { line, character } = getLineAndCharacter(sourceFile, sourceNode);
          violations.push({
            ruleId: 'LEGACY_TEMPLATE_CONTROL_FLOW',
            message: `Modern Syntax Violation: Legacy structural directive "*ngFor" detected. Enforce modern Angular v17+ control flow syntax (e.g. "@for (...) {}") for better performance and cleaner AI code generation.`,
            file: filePath,
            line,
            character
          });
        }
        if (/\*ngSwitch\b/.test(template)) {
          const { line, character } = getLineAndCharacter(sourceFile, sourceNode);
          violations.push({
            ruleId: 'LEGACY_TEMPLATE_CONTROL_FLOW',
            message: `Modern Syntax Violation: Legacy structural directive "*ngSwitch" detected. Enforce modern Angular v17+ control flow syntax (e.g. "@switch (...) {}") for better performance and cleaner AI code generation.`,
            file: filePath,
            line,
            character
          });
        }
      }
    };

    function findComponentDecorator(node: ts.Node) {
      if (ts.isClassDeclaration(node) && node.modifiers) {
        for (const mod of node.modifiers) {
          if (ts.isDecorator(mod) && ts.isCallExpression(mod.expression)) {
            const decoratorName = mod.expression.expression.getText(sourceFile);
            if (decoratorName === 'Component') {
              let localTemplateContent = '';
              let localTemplateNode: ts.Node | null = null;
              const args = mod.expression.arguments;
              if (args.length > 0 && ts.isObjectLiteralExpression(args[0])) {
                const properties = args[0].properties;
                for (const prop of properties) {
                  if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                    const name = prop.name.text;
                    if (name === 'template') {
                      localTemplateContent = prop.initializer.getText(sourceFile).replace(/^['"`]|['"`]$/g, '');
                      localTemplateNode = prop.initializer;
                    } else if (name === 'templateUrl') {
                      const templateUrl = prop.initializer.getText(sourceFile).replace(/^['"`]|['"`]$/g, '');
                      const templatePath = path.resolve(path.dirname(filePath), templateUrl);
                      if (fs.existsSync(templatePath)) {
                        try {
                          localTemplateContent = fs.readFileSync(templatePath, 'utf8');
                          localTemplateNode = prop.initializer;
                        } catch {
                          // ignore read error
                        }
                      }
                    }
                  }
                }
              }

              if (localTemplateContent && localTemplateNode) {
                allTemplates.push(localTemplateContent);
                checkTemplateString(localTemplateContent, localTemplateNode);
              }
            }
          }
        }
      }
      ts.forEachChild(node, findComponentDecorator);
    }
    findComponentDecorator(sourceFile);

    const isRoutingFile = /\b(routing|routes)\b/i.test(path.basename(filePath));
    const importedComponentFiles: Array<{ importPath: string; node: ts.Node }> = [];

    function collectComponentImports(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        const importPath = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
        if (/\b(component)\b/i.test(importPath) || importPath.endsWith('.component')) {
          importedComponentFiles.push({ importPath, node });
        }
      }
      ts.forEachChild(node, collectComponentImports);
    }
    collectComponentImports(sourceFile);

    if (isRoutingFile && importedComponentFiles.length > 0) {
      for (const imp of importedComponentFiles) {
        const { line, character } = getLineAndCharacter(sourceFile, imp.node);
        violations.push({
          ruleId: 'ROUTING_LAZY_LOAD_VIOLATION',
          message: `Performance Violation: Static import of component "${imp.importPath}" detected in routing file. Use dynamic import loadComponent: () => import('${imp.importPath}') to enable lazy loading.`,
          file: filePath,
          line,
          character
        });
      }
    }

    const hasDeferBlock = allTemplates.some(template => /@defer\b/.test(template));
    if (hasDeferBlock && importedComponentFiles.length > 0) {
      for (const imp of importedComponentFiles) {
        const { line, character } = getLineAndCharacter(sourceFile, imp.node);
        violations.push({
          ruleId: 'DEFER_LAZY_LOAD_VIOLATION',
          message: `Performance Violation: Static import of component "${imp.importPath}" detected in a file utilizing "@defer" blocks. Statically importing a deferred component defeats its lazy loading.`,
          file: filePath,
          line,
          character
        });
      }
    }

    return violations;
  }
}
