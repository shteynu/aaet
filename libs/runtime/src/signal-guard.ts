import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';
import { globalRuntimeConfig } from './config-state';

let computedNestingLevel = 0;

export function getComputedNestingLevel() {
  return computedNestingLevel;
}

export function wrapComputed(originalComputed: any) {
  return function(computation: any, options: any) {
    const wrappedComputation = function() {
      computedNestingLevel++;
      try {
        return computation();
      } finally {
        computedNestingLevel--;
      }
    };
    return originalComputed(wrappedComputation, options);
  };
}

export function wrapSignal(originalSignal: any) {
  return function(initialValue: any, options: any) {
    const s = originalSignal(initialValue, options);

    const originalSet = s.set;
    if (originalSet) {
      s.set = function(value: any) {
        if (computedNestingLevel > 0) {
          const msg = `Writable signal mutation detected inside a computed context!\n` +
            `Do not mutate signals inside computed() as it causes side-effects and cyclical updates.`;
          console.error(`❌ [AAET Signal Violation] ${msg}`);
          
          if (isAiGuardEnabled()) {
            const err = new Error();
            const stack = err.stack || '';
            const match = stack.match(/at new\s+([A-Z][a-zA-Z0-9_]+Component|[A-Z][a-zA-Z0-9_]+Service)/) || 
                          stack.match(/at\s+([A-Z][a-zA-Z0-9_]+Component|[A-Z][a-zA-Z0-9_]+Service)/);
            const className = match ? match[1] : 'UnknownClass';
            analyzeViolationWithAi({
              ruleId: 'MUTABLE_SIGNAL_IN_COMPUTED',
              message: msg,
              className
            });
          }
        }
        return originalSet.apply(this, arguments);
      };
    }

    const originalUpdate = s.update;
    if (originalUpdate) {
      s.update = function(updateFn: any) {
        if (computedNestingLevel > 0) {
          const msg = `Writable signal mutation detected inside a computed context!\n` +
            `Do not mutate signals inside computed() as it causes side-effects and cyclical updates.`;
          console.error(`❌ [AAET Signal Violation] ${msg}`);
          
          if (isAiGuardEnabled()) {
            const err = new Error();
            const stack = err.stack || '';
            const match = stack.match(/at new\s+([A-Z][a-zA-Z0-9_]+Component|[A-Z][a-zA-Z0-9_]+Service)/) || 
                          stack.match(/at\s+([A-Z][a-zA-Z0-9_]+Component|[A-Z][a-zA-Z0-9_]+Service)/);
            const className = match ? match[1] : 'UnknownClass';
            analyzeViolationWithAi({
              ruleId: 'MUTABLE_SIGNAL_IN_COMPUTED',
              message: msg,
              className
            });
          }
        }
        return originalUpdate.apply(this, arguments);
      };
    }

    return s;
  };
}

/**
 * Monkey-patches Angular's signal and computed functions to intercept writable signal
 * mutations inside computed contexts.
 */
export function setupSignalGuard(angularCore: any) {
  if (globalRuntimeConfig && globalRuntimeConfig.checkers?.runtime) {
    if (globalRuntimeConfig.checkers.runtime.enabled === false ||
        globalRuntimeConfig.checkers.runtime.rules?.['MUTABLE_SIGNAL_IN_COMPUTED'] === false) {
      return;
    }
  }

  if (!angularCore) return;

  try {
    const originalSignal = angularCore.signal;
    if (originalSignal) {
      Object.defineProperty(angularCore, 'signal', {
        value: wrapSignal(originalSignal),
        writable: true,
        configurable: true
      });
    }
  } catch (err) {
    // Silent fail if immutable
  }

  try {
    const originalComputed = angularCore.computed;
    if (originalComputed) {
      Object.defineProperty(angularCore, 'computed', {
        value: wrapComputed(originalComputed),
        writable: true,
        configurable: true
      });
    }
  } catch (err) {
    // Silent fail if immutable
  }
}
