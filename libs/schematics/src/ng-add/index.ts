import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import {
  AAET_CONFIG_SCHEMA,
  AaetPreset,
  CheckerId,
  buildAaetConfig,
  createDefaultConfig,
  formatConfigDiff,
  serializeAaetConfig,
  validateAaetConfig
} from '@aaet/config';

export interface NgAddOptions {
  interactive?: boolean;
  preset?: AaetPreset;
  checkers?: CheckerId[];
  enableRule?: string[];
  disableRule?: string[];
  yes?: boolean;
  confirm?: boolean;
  skipInstall?: boolean;
}

function writeOrOverwrite(tree: Tree, filePath: string, content: string): void {
  if (tree.exists(filePath)) tree.overwrite(filePath, content);
  else tree.create(filePath, content);
}

export function ngAdd(options: NgAddOptions = {}): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info('AAET: configuring architecture analysis.');
    const configPath = '/aaet.config.json';
    const schemaPath = '/aaet.config.schema.json';
    const exists = tree.exists(configPath);
    let existing: unknown = createDefaultConfig(options.preset ?? 'recommended');

    if (exists) {
      try {
        existing = JSON.parse(tree.read(configPath)!.toString('utf8'));
      } catch (error) {
        throw new Error(`Cannot update aaet.config.json: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const configured = buildAaetConfig(existing, {
      preset: options.preset,
      checkers: options.checkers,
      enableRules: options.enableRule,
      disableRules: options.disableRule
    });
    const errors = validateAaetConfig(configured).filter(issue => issue.severity === 'error');
    if (errors.length) {
      throw new Error(errors.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
    }

    if (exists) {
      context.logger.info(`AAET configuration preview:\n${formatConfigDiff(existing, configured)}`);
    }
    const mayWrite = !exists || options.yes === true || options.confirm === true;
    if (mayWrite) {
      writeOrOverwrite(tree, configPath, serializeAaetConfig(configured));
      writeOrOverwrite(tree, schemaPath, `${JSON.stringify(AAET_CONFIG_SCHEMA, null, 2)}\n`);
      context.logger.info(`${exists ? 'Updated' : 'Created'} aaet.config.json.`);
    } else {
      context.logger.warn('Existing aaet.config.json was not changed. Run "aaet configure" or pass --yes.');
    }

    const packageJsonPath = '/package.json';
    if (tree.exists(packageJsonPath)) {
      const packageJson = JSON.parse(tree.read(packageJsonPath)!.toString('utf8'));
      packageJson.scripts ??= {};
      packageJson.scripts['aaet:check'] ??= 'aaet check';
      tree.overwrite(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
    }

    if (!options.skipInstall) context.addTask(new NodePackageInstallTask());
    return tree;
  };
}
