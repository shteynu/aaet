import { Rule, Tree, SchematicContext } from '@angular-devkit/schematics';
import * as readline from 'readline';

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function ngAdd(options: any): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    context.logger.info('📦 AAET (Angular Architectural Enforcement Toolkit): Initializing...');

    const configPath = '/aaet.config.json';
    
    // Default config values
    const config: any = {
      checkers: {
        static: {
          enabled: true,
          rules: {
            STRICT_LAYERING: true,
            MAX_DI_LIMIT: true,
            ONE_SHOT_CONTEXT_LIMIT: true,
            EXPLICIT_TOKEN_ECONOMY: true,
            LEGACY_DECORATOR: true,
            MODERN_QUERY: true,
            FORBID_RAW_RXJS_UI: true,
            ENFORCE_ONPUSH: true,
            ENFORCE_STANDALONE: true,
            UNSAFE_MANUAL_SUBSCRIBE: true,
            PLATFORM_ISOLATION_VIOLATION: true,
            SWITCH_STRATEGY_SMELL: true,
            TIGHT_COUPLING_OBSERVER_SMELL: true,
            TEMPLATE_METHOD_CALL: true,
            LEGACY_TEMPLATE_CONTROL_FLOW: true,
            ROUTING_LAZY_LOAD_VIOLATION: true,
            DEFER_LAZY_LOAD_VIOLATION: true
          },
          limits: {
            maxAllowedDI: 3,
            maxLines: 400
          }
        },
        runtime: {
          enabled: true,
          rules: {
            RXJS_SUBSCRIPTION_LEAK: true,
            STRICT_LAYERING: true,
            TEMPLATE_METHOD_CALL: true,
            SLOW_METHOD_EXECUTION: true,
            ZONE_BLOCKING_TASK: true,
            EXCESSIVE_CHANGE_DETECTION: true,
            MUTABLE_SIGNAL_IN_COMPUTED: true,
            AI_VERIFY_DECORATOR: true
          },
          stackDepth: 10,
          samplingRate: 1.0
        },
        ai: {
          enabled: false,
          provider: 'anthropic',
          endpointUrl: '/api/aaet-ai-check',
          autoAnalyze: false
        }
      },
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
      ]
    };

    const isInteractive = process.stdin.isTTY && !options.noInteractive && process.env.NODE_ENV !== 'test' && !process.env.VITEST;

    if (!tree.exists(configPath)) {
      if (isInteractive) {
        try {
          console.log('\n\x1b[36m\x1b[1m=== 📦 AAET (Angular Architectural Enforcement Toolkit) Setup Wizard ===\x1b[0m\n');
          console.log('Select checkers to enable:');
          console.log('  \x1b[1m[1]\x1b[0m Static Checker (validates workspace structure, DI limits, and standards at build/lint/commit)');
          console.log('  \x1b[1m[2]\x1b[0m Runtime Checker (guards against memory leaks, slow zone tasks, and signal mutations in the browser)');
          console.log('  \x1b[1m[3]\x1b[0m AI Checker (auto-analyzes and suggests code refactoring using LLMs)');
          
          const choicesStr = await askQuestion('\n👉 Enter numbers of checkers to enable (comma-separated, e.g. "1,2,3"): ');
          const choices = choicesStr.split(',').map(s => s.trim());

          const enableStatic = choices.includes('1');
          const enableRuntime = choices.includes('2');
          const enableAi = choices.includes('3');

          // 1. Static Checker Config
          config.checkers.static.enabled = enableStatic;
          if (enableStatic) {
            console.log('\n\x1b[34m\x1b[1m--- 🔍 Static Checker Setup ---\x1b[0m');
            const customizeStatic = await askQuestion('👉 Do you want to customize Static Rules? (y/N): ');
            
            const staticRulesList = [
              { id: 'STRICT_LAYERING', desc: 'Enforce strict layering boundaries' },
              { id: 'MAX_DI_LIMIT', desc: 'Enforce constructor dependency injection limits' },
              { id: 'ONE_SHOT_CONTEXT_LIMIT', desc: 'Enforce maximum file line count limits' },
              { id: 'EXPLICIT_TOKEN_ECONOMY', desc: 'Require return type annotations on public methods' },
              { id: 'LEGACY_DECORATOR', desc: 'Forbid legacy decorators like @Input/@Output' },
              { id: 'MODERN_QUERY', desc: 'Require signal queries like viewChild/contentChild' },
              { id: 'FORBID_RAW_RXJS_UI', desc: 'Forbid raw RxJS subjects/observables in UI components' },
              { id: 'ENFORCE_ONPUSH', desc: 'Enforce ChangeDetectionStrategy.OnPush' },
              { id: 'ENFORCE_STANDALONE', desc: 'Enforce standalone components/pipes/directives' },
              { id: 'UNSAFE_MANUAL_SUBSCRIBE', desc: 'Forbid manual subscribe without destroy safety' },
              { id: 'PLATFORM_ISOLATION_VIOLATION', desc: 'Forbid direct browser globals usage (window, document)' },
              { id: 'SWITCH_STRATEGY_SMELL', desc: 'Flag large switch statements smells' },
              { id: 'TIGHT_COUPLING_OBSERVER_SMELL', desc: 'Flag tightly-coupled components' },
              { id: 'TEMPLATE_METHOD_CALL', desc: 'Forbid calling methods directly in templates' },
              { id: 'LEGACY_TEMPLATE_CONTROL_FLOW', desc: 'Enforce modern @if/@for control flow syntax' },
              { id: 'ROUTING_LAZY_LOAD_VIOLATION', desc: 'Enforce lazy loading routes with loadComponent' },
              { id: 'DEFER_LAZY_LOAD_VIOLATION', desc: 'Forbid static import of deferred components' }
            ];

            if (customizeStatic.toLowerCase() === 'y') {
              console.log('\nAvailable Static Rules:');
              staticRulesList.forEach((r, idx) => {
                console.log(`  [${idx + 1}] ${r.id} - ${r.desc}`);
              });
              const rulesChoicesStr = await askQuestion('\n👉 Enter numbers of rules to ENABLE (comma-separated, or press Enter for "all"): ');
              if (rulesChoicesStr) {
                const rulesIdxs = rulesChoicesStr.split(',').map(s => parseInt(s.trim(), 10) - 1);
                // First disable all, then enable selected
                staticRulesList.forEach(r => {
                  config.checkers.static.rules[r.id] = false;
                });
                staticRulesList.forEach((r, idx) => {
                  if (rulesIdxs.includes(idx)) {
                    config.checkers.static.rules[r.id] = true;
                  }
                });
              }
            }

            const maxDiStr = await askQuestion('👉 Enter maximum allowed dependency injections per class (default: 3): ');
            if (maxDiStr) {
              config.checkers.static.limits.maxAllowedDI = parseInt(maxDiStr, 10) || 3;
            }
            const maxLinesStr = await askQuestion('👉 Enter maximum allowed lines per file (default: 400): ');
            if (maxLinesStr) {
              config.checkers.static.limits.maxLines = parseInt(maxLinesStr, 10) || 400;
            }
          }

          // 2. Runtime Checker Config
          config.checkers.runtime.enabled = enableRuntime;
          if (enableRuntime) {
            console.log('\n\x1b[34m\x1b[1m--- 🛡️ Runtime Checker Setup ---\x1b[0m');
            const customizeRuntime = await askQuestion('👉 Do you want to customize Runtime Rules? (y/N): ');

            const runtimeRulesList = [
              { id: 'RXJS_SUBSCRIPTION_LEAK', desc: 'Trace active subscription leaks' },
              { id: 'STRICT_LAYERING', desc: 'Intercept boundary layering violations on DI' },
              { id: 'TEMPLATE_METHOD_CALL', desc: 'Trace template method calls / performance warnings' },
              { id: 'SLOW_METHOD_EXECUTION', desc: 'Warn when class methods exceed execution threshold' },
              { id: 'ZONE_BLOCKING_TASK', desc: 'Warn on zone tasks exceeding frame threshold' },
              { id: 'EXCESSIVE_CHANGE_DETECTION', desc: 'Detect excessive change detection ticks' },
              { id: 'MUTABLE_SIGNAL_IN_COMPUTED', desc: 'Guard against mutations in computed contexts' },
              { id: 'AI_VERIFY_DECORATOR', desc: 'Enable assessment with @AiVerify' }
            ];

            if (customizeRuntime.toLowerCase() === 'y') {
              console.log('\nAvailable Runtime Rules:');
              runtimeRulesList.forEach((r, idx) => {
                console.log(`  [${idx + 1}] ${r.id} - ${r.desc}`);
              });
              const rulesChoicesStr = await askQuestion('\n👉 Enter numbers of rules to ENABLE (comma-separated, or press Enter for "all"): ');
              if (rulesChoicesStr) {
                const rulesIdxs = rulesChoicesStr.split(',').map(s => parseInt(s.trim(), 10) - 1);
                // First disable all, then enable selected
                runtimeRulesList.forEach(r => {
                  config.checkers.runtime.rules[r.id] = false;
                });
                runtimeRulesList.forEach((r, idx) => {
                  if (rulesIdxs.includes(idx)) {
                    config.checkers.runtime.rules[r.id] = true;
                  }
                });
              }
            }

            const stackDepthStr = await askQuestion('👉 Enter V8 stack trace depth limit for RxJS tracking (default: 10): ');
            if (stackDepthStr) {
              config.checkers.runtime.stackDepth = parseInt(stackDepthStr, 10) || 10;
            }
            const samplingRateStr = await askQuestion('👉 Enter RxJS subscription sampling rate [0.0 - 1.0] (default: 1.0): ');
            if (samplingRateStr) {
              config.checkers.runtime.samplingRate = parseFloat(samplingRateStr) || 1.0;
            }
          }

          // 3. AI Checker Config
          config.checkers.ai.enabled = enableAi;
          if (enableAi) {
            console.log('\n\x1b[34m\x1b[1m--- 🤖 AI Checker Setup ---\x1b[0m');
            console.log('Select AI Provider:');
            console.log('  [1] Anthropic Claude (Default)');
            console.log('  [2] OpenAI GPT');
            const providerChoice = await askQuestion('👉 Enter choice (1 or 2): ');
            config.checkers.ai.provider = providerChoice === '2' ? 'openai' : 'anthropic';

            const apiKey = await askQuestion('👉 Enter API Key (optional, press Enter to skip): ');
            if (apiKey) {
              config.checkers.ai.apiKey = apiKey;
            }

            const autoAnalyze = await askQuestion('👉 Auto-analyze violations in real-time? (y/N): ');
            config.checkers.ai.autoAnalyze = autoAnalyze.toLowerCase() === 'y';
          }

          console.log('\n\x1b[32m\x1b[1m✅ Configuration wizard completed successfully!\x1b[0m\n');
        } catch (err: any) {
          context.logger.error(`❌ Setup wizard failed: ${err.message}. Falling back to default settings.`);
        }
      }

      // Sync root limits with static limits for backward compatibility
      config.limits = {
        maxAllowedDI: config.checkers.static.limits.maxAllowedDI,
        maxLines: config.checkers.static.limits.maxLines
      };

      tree.create(configPath, JSON.stringify(config, null, 2));
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
