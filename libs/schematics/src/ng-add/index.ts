import { Rule, Tree, SchematicContext } from '@angular-devkit/schematics';

export function ngAdd(options: any): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info('📦 AAET (Angular Architectural Enforcement Toolkit): Initializing...');

    const configPath = '/aaet.config.json';
    if (!tree.exists(configPath)) {
      const defaultConfig = {
        layers: {
          ui: '**/*.component.ts',
          api: '**/*.api.service.ts',
          facade: '**/*.facade.service.ts'
        },
        layerRestrictions: [
          {
            from: 'ui',
            cannotDependOn: ['api']
          }
        ],
        limits: {
          maxAllowedDI: 3,
          maxLines: 400
        }
      };
      tree.create(configPath, JSON.stringify(defaultConfig, null, 2));
      context.logger.info('✅ Generated aaet.config.json in the workspace root.');
    } else {
      context.logger.info('ℹ️ aaet.config.json already exists. Skipping config generation.');
    }

    if (tree.exists('/package.json')) {
      const packageJsonBuffer = tree.read('/package.json');
      if (packageJsonBuffer) {
        try {
          const packageJson = JSON.parse(packageJsonBuffer.toString('utf-8'));
          if (!packageJson.scripts) {
            packageJson.scripts = {};
          }
          
          if (!packageJson.scripts['aaet:check']) {
            packageJson.scripts['aaet:check'] = 'aaet';
            tree.overwrite('/package.json', JSON.stringify(packageJson, null, 2));
            context.logger.info('✅ Added "aaet:check" script to package.json.');
          }
        } catch (err) {
          context.logger.error('❌ Failed to update package.json scripts.');
        }
      }
    }

    return tree;
  };
}
