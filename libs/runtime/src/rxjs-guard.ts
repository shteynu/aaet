import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';

export const activeSubscriptions = new Map<any, { stack: string; timestamp: number }>();

let rxjsStackDepth = 10;
let rxjsSamplingRate = 1.0;

/**
 * Monkey-patches RxJS Observable.prototype.subscribe to track active subscriptions
 * and detect leaks (subscriptions that are never unsubscribed).
 */
export function setupRxjsGuard(ObservableClass: any, config?: { stackDepth?: number; samplingRate?: number }) {
  if (!ObservableClass || !ObservableClass.prototype) {
    return;
  }

  if (config) {
    if (config.stackDepth !== undefined) rxjsStackDepth = config.stackDepth;
    if (config.samplingRate !== undefined) rxjsSamplingRate = config.samplingRate;
  }

  const originalSubscribe = ObservableClass.prototype.subscribe;

  ObservableClass.prototype.subscribe = function(...args: any[]) {
    const subscription = originalSubscribe.apply(this, args);

    // Apply sampling rate check
    if (rxjsSamplingRate < 1.0 && Math.random() > rxjsSamplingRate) {
      return subscription;
    }

    // Capture stack trace to pinpoint the subscription site with a V8 depth limit
    const originalLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = rxjsStackDepth;
    const err = new Error();
    const stack = err.stack || '';
    Error.stackTraceLimit = originalLimit;

    // Register active subscription
    activeSubscriptions.set(subscription, {
      stack,
      timestamp: Date.now()
    });

    const originalUnsubscribe = subscription.unsubscribe;
    if (originalUnsubscribe) {
      subscription.unsubscribe = function() {
        activeSubscriptions.delete(subscription);
        return originalUnsubscribe.apply(this, arguments);
      };
    }

    return subscription;
  };
}

export function getActiveSubscriptions() {
  return Array.from(activeSubscriptions.values());
}

export function clearActiveSubscriptions() {
  activeSubscriptions.clear();
}

let injectorPatched = false;
export const activeComponents = new Set<any>();
export const activeComponentCounts = new Map<any, number>();

/**
 * Intercepts component resolutions via Injector to track component instances.
 * Patches the Ivy onDestroy hook on the component constructor to check for active RxJS subscriptions
 * belonging to that component class when all of its active instances are destroyed.
 */
export function setupRxjsComponentTracking(angularCore: any) {
  const core = angularCore || (globalThis as any).ngCore;
  if (!core || injectorPatched) return;
  const InjectorClass = core.Injector;
  if (!InjectorClass || !InjectorClass.prototype) return;

  const originalGet = InjectorClass.prototype.get;
  injectorPatched = true;

  InjectorClass.prototype.get = function(token: any, notFoundValue?: any, flags?: any) {
    const instance = originalGet.apply(this, arguments);
    if (instance && typeof instance === 'object') {
      const constructor = instance.constructor;
      const className = constructor.name;
      if (className && className.endsWith('Component') && !activeComponents.has(instance)) {
        activeComponents.add(instance);
        activeComponentCounts.set(constructor, (activeComponentCounts.get(constructor) || 0) + 1);

        // Patch onDestroy via Ivy cmp definition
        const cmpDef = constructor.ɵcmp;
        if (cmpDef) {
          const originalOnDestroy = cmpDef.onDestroy;
          cmpDef.onDestroy = function(ctx: any) {
            if (activeComponents.has(ctx)) {
              activeComponents.delete(ctx);
              const count = activeComponentCounts.get(constructor) || 0;
              if (count > 1) {
                activeComponentCounts.set(constructor, count - 1);
              } else {
                activeComponentCounts.delete(constructor);
              }
            }
            
            // Check if there are any remaining active instances of this component type
            const hasRemainingInstances = activeComponentCounts.has(constructor);
            if (!hasRemainingInstances) {
              // No instances left! Check for leaked subscriptions of this class
              const activeSubs = getActiveSubscriptions();
              const leakedSubs = activeSubs.filter(sub => {
                return sub.stack.includes(className);
              });

              if (leakedSubs.length > 0) {
                const msg = `Component "${className}" was destroyed, but ${leakedSubs.length} active subscription(s) remain open!\n` +
                  `Stack trace(s) of creation:\n` +
                  leakedSubs.map(s => s.stack.split('\n').slice(0, 5).join('\n')).join('\n---\n');
                console.warn(`⚠️ [AAET RxJS Leak Warning] ${msg}`);
                
                if (isAiGuardEnabled()) {
                  analyzeViolationWithAi({
                    ruleId: 'RXJS_SUBSCRIPTION_LEAK',
                    message: msg,
                    className
                  });
                }
              }
            }

            if (originalOnDestroy) {
              originalOnDestroy.call(this, ctx);
            }
          };
        }
      }
    }
    return instance;
  };
}

export function getActiveComponentsCount(): number {
  return activeComponents.size;
}

export function clearActiveComponents() {
  activeComponents.clear();
  activeComponentCounts.clear();
}
