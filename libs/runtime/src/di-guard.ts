// Dynamic DI Interceptor for dev mode boundary enforcement
import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';

export interface RuntimeLayerConfig {
  layers: { [key: string]: string };
  layerRestrictions: Array<{
    from: string;
    cannotDependOn: string[];
  }>;
}

let diGuardEnabled = false;

export function resetDiGuard() {
  diGuardEnabled = false;
}

/**
 * Monkey-patches Angular's Injector to dynamically trace DI dependency resolutions
 * and intercept boundary violations in the browser console during development.
 */
export function setupDiGuard(
  config: RuntimeLayerConfig,
  angularCore: any // Pass @angular/core reference or Injector prototype dynamically to avoid peerDependency compile blocks in tests
) {
  // If no Angular core reference, check window.ng or global scope
  const core = angularCore || (globalThis as any).ngCore;
  if (!core) {
    // Silent fail if Angular core is not present (e.g., outside browser/Angular context)
    return;
  }

  const isDevModeFn = core.isDevMode;
  if (isDevModeFn && !isDevModeFn()) {
    return;
  }

  if (diGuardEnabled) return;
  diGuardEnabled = true;

  console.warn('⚠️ [AAET] Runtime DI Guard is active. Enforcing boundary validations.');

  const InjectorClass = core.Injector;
  if (!InjectorClass || !InjectorClass.prototype) {
    return;
  }

  const originalGet = InjectorClass.prototype.get;
  const resolutionStack: string[] = [];

  InjectorClass.prototype.get = function(token: any, notFoundValue?: any, flags?: any) {
    const tokenName = typeof token === 'function' ? token.name : String(token);
    
    resolutionStack.push(tokenName);

    try {
      if (resolutionStack.length >= 2) {
        const dependent = resolutionStack[resolutionStack.length - 2];
        const dependency = resolutionStack[resolutionStack.length - 1];

        const dependentLower = dependent.toLowerCase();
        const dependencyLower = dependency.toLowerCase();

        // Check if a component directly injects an API service
        if (dependentLower.endsWith('component') && (dependencyLower.includes('api') && dependencyLower.includes('service'))) {
          const msg = `Dynamic DI boundary violation detected!\n` +
            `Class "${dependent}" directly injected "${dependency}".\n` +
            `Boundary rule: UI Components must not inject API Services directly. Use a Facade instead.`;
          console.error(`❌ [AAET DI Violation] ${msg}`);
          
          if (isAiGuardEnabled()) {
            analyzeViolationWithAi({
              ruleId: 'STRICT_LAYERING',
              message: msg,
              className: dependent
            });
          }
        }
      }

      return originalGet.apply(this, [token, notFoundValue, flags]);
    } finally {
      resolutionStack.pop();
    }
  };
}
