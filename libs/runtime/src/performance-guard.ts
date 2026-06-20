import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';

const methodCallCounts = new Map<string, { count: number; lastReset: number }>();

export interface ProfileOptions {
  thresholdMs?: number;      // Warn if execution exceeds this limit (default: 5ms)
  maxCallFrequency?: number; // Warn if called more than this per second (default: 10)
}

/**
 * Class decorator that wraps all class methods with a JS Proxy.
 * Measures execution time using performance.now() and counts invocation frequency.
 */
export function ProfileMethods(options: ProfileOptions = {}) {
  const thresholdMs = options.thresholdMs ?? 5;
  const maxCallFrequency = options.maxCallFrequency ?? 10;

  return function (target: any) {
    const prototype = target.prototype;
    if (!prototype) return;

    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const name of propertyNames) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (name !== 'constructor' && descriptor && typeof descriptor.value === 'function') {
        const originalMethod = descriptor.value;

        const proxyMethod = new Proxy(originalMethod, {
          apply(targetMethod, thisArg, argumentsList) {
            const start = performance.now();
            
            // Frequency tracking
            const methodKey = `${target.name || 'Component'}.${name}`;
            const now = Date.now();
            let stats = methodCallCounts.get(methodKey);
            if (!stats || now - stats.lastReset > 1000) {
              stats = { count: 0, lastReset: now };
            }
            stats.count++;
            methodCallCounts.set(methodKey, stats);

            if (stats.count > maxCallFrequency) {
              const msg = `Method "${methodKey}" called ${stats.count} times in the last second.\n` +
                `This high frequency suggests potential invocation inside a UI template (Change Detection cost) or an SRP violation.`;
              console.warn(`⚠️ [AAET Performance Warning] ${msg}`);
              
              if (isAiGuardEnabled()) {
                analyzeViolationWithAi({
                  ruleId: 'TEMPLATE_METHOD_CALL',
                  message: msg,
                  className: target.name || 'Component'
                });
              }
            }

            try {
              return targetMethod.apply(thisArg, argumentsList);
            } finally {
              const end = performance.now();
              const duration = end - start;
              if (duration > thresholdMs) {
                const msg = `Method "${methodKey}" execution took ${duration.toFixed(2)}ms, exceeding the threshold of ${thresholdMs}ms.`;
                console.warn(`⚠️ [AAET Performance Warning] ${msg}`);
                
                if (isAiGuardEnabled()) {
                  analyzeViolationWithAi({
                    ruleId: 'SLOW_METHOD_EXECUTION',
                    message: msg,
                    className: target.name || 'Component'
                  });
                }
              }
            }
          }
        });

        Object.defineProperty(prototype, name, {
          ...descriptor,
          value: proxyMethod
        });
      }
    }
  };
}

/**
 * Monkey-patches NgZone to measure execution time of tasks run inside the Angular Zone.
 * Logs a warning if a task blocks the main thread for too long (default >16ms, indicating frame drop).
 */
export function setupZoneGuard(angularCore: any, thresholdMs = 16) {
  if (!angularCore) return;
  const NgZoneClass = angularCore.NgZone;
  if (!NgZoneClass || !NgZoneClass.prototype) return;

  const originalRun = NgZoneClass.prototype.run;
  NgZoneClass.prototype.run = function(fn: any, applyThis: any, applyArgs: any) {
    const start = performance.now();
    try {
      return originalRun.apply(this, arguments);
    } finally {
      const duration = performance.now() - start;
      if (duration > thresholdMs) {
        const msg = `Task executed inside Angular Zone took ${duration.toFixed(2)}ms, exceeding the ${thresholdMs}ms frame threshold.\n` +
          `This may drop rendering frames. Consider running heavy computations outside Angular using runOutsideAngular() or delegating to Web Workers.`;
        console.warn(`⚠️ [AAET Zone Warning] ${msg}`);
        
        if (isAiGuardEnabled()) {
          analyzeViolationWithAi({
            ruleId: 'ZONE_BLOCKING_TASK',
            message: msg,
            className: 'NgZone'
          });
        }
      }
    }
  };
}

/**
 * Monkey-patches Angular's ApplicationRef to monitor the frequency of Change Detection cycles.
 * Logs a warning if the number of ticks per second exceeds the maxTicksPerSecond threshold.
 */
export function setupChangeDetectionGuard(angularCore: any, maxTicksPerSecond = 20) {
  if (!angularCore) return;
  const AppRef = angularCore.ApplicationRef;
  if (!AppRef || !AppRef.prototype) return;

  const originalTick = AppRef.prototype.tick;
  let tickCount = 0;
  let lastReset = Date.now();

  AppRef.prototype.tick = function() {
    const now = Date.now();
    if (now - lastReset > 1000) {
      tickCount = 0;
      lastReset = now;
    }
    tickCount++;

    if (tickCount > maxTicksPerSecond) {
      const msg = `Excessive Change Detection loops detected! Tick count: ${tickCount} in the last second.\n` +
        `This suggests cyclical triggers, unoptimized template bindings, or microtasks firing repeatedly inside Zone.js.`;
      console.warn(`⚠️ [AAET Change Detection Warning] ${msg}`);
      
      if (isAiGuardEnabled()) {
        analyzeViolationWithAi({
          ruleId: 'EXCESSIVE_CHANGE_DETECTION',
          message: msg,
          className: 'ApplicationRef'
        });
      }
    }
    return originalTick.apply(this, arguments);
  };
}
