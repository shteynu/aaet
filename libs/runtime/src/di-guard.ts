import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';

export interface RuntimeLayerConfig {
  layers: Record<string, string>;
  layerRestrictions: Array<{ from: string; cannotDependOn: string[] }>;
}

interface DiPatch {
  prototype: any;
  originalGet: (...args: any[]) => any;
}

let activePatch: DiPatch | null = null;

export function resetDiGuard(): void {
  if (activePatch) activePatch.prototype.get = activePatch.originalGet;
  activePatch = null;
}

/**
 * Installs the experimental DI trace guard and returns an idempotent teardown.
 */
export function setupDiGuard(config: RuntimeLayerConfig, angularCore: any): () => void {
  const core = angularCore || (globalThis as any).ngCore;
  if (!core || (core.isDevMode && !core.isDevMode())) return () => undefined;
  const InjectorClass = core.Injector;
  const prototype = InjectorClass?.prototype;
  if (!prototype || typeof prototype.get !== 'function') return () => undefined;

  if (activePatch?.prototype === prototype) {
    return () => resetDiGuard();
  }
  resetDiGuard();
  const originalGet = prototype.get;
  const resolutionStack: string[] = [];

  prototype.get = function(token: any, notFoundValue?: any, flags?: any) {
    const tokenName = typeof token === 'function' ? token.name : String(token?.name ?? token);
    resolutionStack.push(tokenName);
    try {
      if (resolutionStack.length >= 2) {
        const dependent = resolutionStack[resolutionStack.length - 2];
        const dependency = resolutionStack[resolutionStack.length - 1];
        const dependentLower = dependent.toLowerCase();
        const dependencyLower = dependency.toLowerCase();
        if (dependentLower.endsWith('component') && dependencyLower.includes('api') && dependencyLower.includes('service')) {
          const message = `Dynamic DI boundary violation detected!\n` +
            `Class "${dependent}" directly injected "${dependency}".\n` +
            'Boundary rule: UI Components must not inject API Services directly. Use a Facade instead.';
          console.error(`❌ [AAET DI Violation] ${message}`);
          if (isAiGuardEnabled()) {
            void analyzeViolationWithAi({ ruleId: 'STRICT_LAYERING', message, className: dependent });
          }
        }
      }
      return originalGet.apply(this, [token, notFoundValue, flags]);
    } finally {
      resolutionStack.pop();
    }
  };

  activePatch = { prototype, originalGet };
  console.warn('⚠️ [AAET] Experimental runtime DI Guard is active.');
  let tornDown = false;
  return () => {
    if (tornDown) return;
    tornDown = true;
    if (activePatch?.prototype === prototype) resetDiGuard();
  };
}
