import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';
import { getConfiguredRuleSettings, getRuntimeConfig, isConfiguredCheckerEnabled, isConfiguredRuleEnabled } from './config-state';

const methodCallCounts = new Map<string, { count: number; lastReset: number }>();

export interface ProfileOptions {
  thresholdMs?: number;
  maxCallFrequency?: number;
}

function runtimeRuleEnabled(ruleId: string): boolean {
  return getRuntimeConfig() === null || (isConfiguredCheckerEnabled('runtime') && isConfiguredRuleEnabled('runtime', ruleId));
}

export function ProfileMethods(options: ProfileOptions = {}) {
  return function(target: any): void {
    const prototype = target.prototype;
    if (!prototype) return;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (name === 'constructor' || !descriptor || typeof descriptor.value !== 'function') continue;
      const originalMethod = descriptor.value;
      const proxyMethod = new Proxy(originalMethod, {
        apply(targetMethod, thisArg, argumentsList) {
          const settings = getConfiguredRuleSettings('runtime');
          const thresholdMs = options.thresholdMs ?? settings?.slowMethodThresholdMs ?? 5;
          const maxCallFrequency = options.maxCallFrequency ?? settings?.maxCallFrequency ?? 10;
          const methodKey = `${target.name || 'Component'}.${name}`;
          const start = performance.now();

          if (runtimeRuleEnabled('TEMPLATE_METHOD_CALL')) {
            const now = Date.now();
            let stats = methodCallCounts.get(methodKey);
            if (!stats || now - stats.lastReset > 1000) stats = { count: 0, lastReset: now };
            stats.count++;
            methodCallCounts.set(methodKey, stats);
            if (stats.count > maxCallFrequency) {
              const message = `Method "${methodKey}" called ${stats.count} times in the last second.\n` +
                'This high frequency suggests potential invocation inside a UI template or an SRP violation.';
              console.warn(`⚠️ [AAET Performance Warning] ${message}`);
              if (isAiGuardEnabled()) void analyzeViolationWithAi({ ruleId: 'TEMPLATE_METHOD_CALL', message, className: target.name || 'Component' });
            }
          }

          try {
            return targetMethod.apply(thisArg, argumentsList);
          } finally {
            const duration = performance.now() - start;
            if (runtimeRuleEnabled('SLOW_METHOD_EXECUTION') && duration > thresholdMs) {
              const message = `Method "${methodKey}" execution took ${duration.toFixed(2)}ms, exceeding the threshold of ${thresholdMs}ms.`;
              console.warn(`⚠️ [AAET Performance Warning] ${message}`);
              if (isAiGuardEnabled()) void analyzeViolationWithAi({ ruleId: 'SLOW_METHOD_EXECUTION', message, className: target.name || 'Component' });
            }
          }
        }
      });
      Object.defineProperty(prototype, name, { ...descriptor, value: proxyMethod });
    }
  };
}

interface MethodPatch {
  prototype: any;
  methodName: string;
  original: (...args: any[]) => any;
}

let zonePatch: MethodPatch | null = null;
let changeDetectionPatch: MethodPatch | null = null;

function restorePatch(patch: MethodPatch | null): void {
  if (patch) patch.prototype[patch.methodName] = patch.original;
}

export function setupZoneGuard(angularCore: any, thresholdMs = 16): () => void {
  const prototype = angularCore?.NgZone?.prototype;
  if (!prototype || typeof prototype.run !== 'function') return () => undefined;
  restorePatch(zonePatch);
  const original = prototype.run;
  prototype.run = function(...args: any[]) {
    const start = performance.now();
    try {
      return original.apply(this, args);
    } finally {
      const duration = performance.now() - start;
      if (duration > thresholdMs) {
        const message = `Task executed inside Angular Zone took ${duration.toFixed(2)}ms, exceeding the ${thresholdMs}ms frame threshold.\n` +
          'Consider running heavy work outside Angular or in a Web Worker.';
        console.warn(`⚠️ [AAET Zone Warning] ${message}`);
        if (isAiGuardEnabled()) void analyzeViolationWithAi({ ruleId: 'ZONE_BLOCKING_TASK', message, className: 'NgZone' });
      }
    }
  };
  zonePatch = { prototype, methodName: 'run', original };
  let tornDown = false;
  return () => {
    if (tornDown) return;
    tornDown = true;
    if (zonePatch?.prototype === prototype) {
      restorePatch(zonePatch);
      zonePatch = null;
    }
  };
}

export function setupChangeDetectionGuard(angularCore: any, maxTicksPerSecond = 20): () => void {
  const prototype = angularCore?.ApplicationRef?.prototype;
  if (!prototype || typeof prototype.tick !== 'function') return () => undefined;
  restorePatch(changeDetectionPatch);
  const original = prototype.tick;
  let tickCount = 0;
  let lastReset = Date.now();
  prototype.tick = function(...args: any[]) {
    const now = Date.now();
    if (now - lastReset > 1000) {
      tickCount = 0;
      lastReset = now;
    }
    tickCount++;
    if (tickCount > maxTicksPerSecond) {
      const message = `Excessive Change Detection loops detected! Tick count: ${tickCount} in the last second.\n` +
        'This suggests cyclical triggers, unoptimized bindings, or frequent microtasks.';
      console.warn(`⚠️ [AAET Change Detection Warning] ${message}`);
      if (isAiGuardEnabled()) void analyzeViolationWithAi({ ruleId: 'EXCESSIVE_CHANGE_DETECTION', message, className: 'ApplicationRef' });
    }
    return original.apply(this, args);
  };
  changeDetectionPatch = { prototype, methodName: 'tick', original };
  let tornDown = false;
  return () => {
    if (tornDown) return;
    tornDown = true;
    if (changeDetectionPatch?.prototype === prototype) {
      restorePatch(changeDetectionPatch);
      changeDetectionPatch = null;
    }
  };
}
