// Runtime Performance Profiler & SRP Checker using JS Proxies
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
              console.warn(
                `⚠️ [AAET Performance Warning] Method "${methodKey}" called ${stats.count} times in the last second.\n` +
                `   This high frequency suggests potential invocation inside a UI template (Change Detection cost) or an SRP violation.`
              );
            }

            try {
              return targetMethod.apply(thisArg, argumentsList);
            } finally {
              const end = performance.now();
              const duration = end - start;
              if (duration > thresholdMs) {
                console.warn(
                  `⚠️ [AAET Performance Warning] Method "${methodKey}" execution took ${duration.toFixed(2)}ms, exceeding the threshold of ${thresholdMs}ms.`
                );
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
