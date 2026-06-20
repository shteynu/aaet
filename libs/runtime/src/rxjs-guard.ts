import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';

export const activeSubscriptions = new Map<any, { stack: string; timestamp: number }>();
export const activeComponents = new Set<any>();
export const activeComponentCounts = new Map<any, number>();

interface ObservablePatch {
  prototype: any;
  originalSubscribe: (...args: any[]) => any;
}

let observablePatch: ObservablePatch | null = null;

export function setupRxjsGuard(
  ObservableClass: any,
  config: { stackDepth?: number; samplingRate?: number } = {}
): () => void {
  const prototype = ObservableClass?.prototype;
  if (!prototype || typeof prototype.subscribe !== 'function') return () => undefined;
  if (observablePatch) observablePatch.prototype.subscribe = observablePatch.originalSubscribe;

  const originalSubscribe = prototype.subscribe;
  const stackDepth = config.stackDepth ?? 10;
  const samplingRate = config.samplingRate ?? 1;
  prototype.subscribe = function(...args: any[]) {
    const subscription = originalSubscribe.apply(this, args);
    if (samplingRate < 1 && Math.random() > samplingRate) return subscription;

    const ErrorWithLimit = Error as ErrorConstructor & { stackTraceLimit?: number };
    const originalLimit = ErrorWithLimit.stackTraceLimit;
    let stack = '';
    try {
      ErrorWithLimit.stackTraceLimit = stackDepth;
      stack = new Error().stack || '';
    } finally {
      ErrorWithLimit.stackTraceLimit = originalLimit;
    }

    activeSubscriptions.set(subscription, { stack, timestamp: Date.now() });
    const originalUnsubscribe = subscription?.unsubscribe;
    if (typeof originalUnsubscribe === 'function') {
      subscription.unsubscribe = function(...unsubscribeArgs: any[]) {
        activeSubscriptions.delete(subscription);
        return originalUnsubscribe.apply(this, unsubscribeArgs);
      };
    }
    return subscription;
  };
  observablePatch = { prototype, originalSubscribe };

  let tornDown = false;
  return () => {
    if (tornDown) return;
    tornDown = true;
    if (observablePatch?.prototype === prototype) {
      prototype.subscribe = originalSubscribe;
      observablePatch = null;
    }
  };
}

export function getActiveSubscriptions(): Array<{ stack: string; timestamp: number }> {
  return Array.from(activeSubscriptions.values());
}

export function clearActiveSubscriptions(): void {
  activeSubscriptions.clear();
}

interface ComponentPatch {
  prototype: any;
  originalGet: (...args: any[]) => any;
  destroyHooks: Map<any, any>;
}

let componentPatch: ComponentPatch | null = null;

function teardownComponentPatch(): void {
  if (!componentPatch) return;
  componentPatch.prototype.get = componentPatch.originalGet;
  for (const [definition, originalOnDestroy] of componentPatch.destroyHooks) {
    definition.onDestroy = originalOnDestroy;
  }
  componentPatch = null;
}

export function setupRxjsComponentTracking(angularCore: any): () => void {
  const core = angularCore || (globalThis as any).ngCore;
  const prototype = core?.Injector?.prototype;
  if (!prototype || typeof prototype.get !== 'function') return () => undefined;
  teardownComponentPatch();

  const originalGet = prototype.get;
  const destroyHooks = new Map<any, any>();
  prototype.get = function(...args: any[]) {
    const instance = originalGet.apply(this, args);
    if (!instance || typeof instance !== 'object') return instance;
    const constructor = instance.constructor;
    const className = constructor?.name;
    if (!className?.endsWith('Component') || activeComponents.has(instance)) return instance;

    activeComponents.add(instance);
    activeComponentCounts.set(constructor, (activeComponentCounts.get(constructor) || 0) + 1);
    const definition = constructor.ɵcmp;
    if (!definition || destroyHooks.has(definition)) return instance;

    const originalOnDestroy = definition.onDestroy;
    destroyHooks.set(definition, originalOnDestroy);
    definition.onDestroy = function(ctx: any) {
      if (activeComponents.delete(ctx)) {
        const count = activeComponentCounts.get(constructor) || 0;
        if (count > 1) activeComponentCounts.set(constructor, count - 1);
        else activeComponentCounts.delete(constructor);
      }

      if (!activeComponentCounts.has(constructor)) {
        const leakedSubscriptions = getActiveSubscriptions().filter(subscription => subscription.stack.includes(className));
        if (leakedSubscriptions.length) {
          const message = `Component "${className}" was destroyed, but ${leakedSubscriptions.length} active subscription(s) remain open!\n` +
            `Stack trace(s) of creation:\n${leakedSubscriptions.map(item => item.stack.split('\n').slice(0, 5).join('\n')).join('\n---\n')}`;
          console.warn(`⚠️ [AAET RxJS Leak Warning] ${message}`);
          if (isAiGuardEnabled()) {
            void analyzeViolationWithAi({ ruleId: 'RXJS_SUBSCRIPTION_LEAK', message, className });
          }
        }
      }
      if (originalOnDestroy) return originalOnDestroy.call(this, ctx);
    };
    return instance;
  };

  componentPatch = { prototype, originalGet, destroyHooks };
  let tornDown = false;
  return () => {
    if (tornDown) return;
    tornDown = true;
    if (componentPatch?.prototype === prototype) teardownComponentPatch();
  };
}

export function getActiveComponentsCount(): number {
  return activeComponents.size;
}

export function clearActiveComponents(): void {
  activeComponents.clear();
  activeComponentCounts.clear();
}
