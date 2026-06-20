import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';

let computedNestingLevel = 0;

export function getComputedNestingLevel(): number {
  return computedNestingLevel;
}

function reportSignalMutation(): void {
  const message = 'Writable signal mutation detected inside a computed context!\n' +
    'Do not mutate signals inside computed() because it introduces side effects and cyclical updates.';
  console.error(`❌ [AAET Signal Violation] ${message}`);
  if (!isAiGuardEnabled()) return;
  const stack = new Error().stack || '';
  const match = stack.match(/at new\s+([A-Z][a-zA-Z0-9_]+Component|[A-Z][a-zA-Z0-9_]+Service)/) ||
    stack.match(/at\s+([A-Z][a-zA-Z0-9_]+Component|[A-Z][a-zA-Z0-9_]+Service)/);
  void analyzeViolationWithAi({
    ruleId: 'MUTABLE_SIGNAL_IN_COMPUTED',
    message,
    className: match ? match[1] : 'UnknownClass'
  });
}

export function wrapComputed(originalComputed: any) {
  return function(computation: any, options: any) {
    return originalComputed(function() {
      computedNestingLevel++;
      try {
        return computation();
      } finally {
        computedNestingLevel--;
      }
    }, options);
  };
}

export function wrapSignal(originalSignal: any) {
  return function(initialValue: any, options: any) {
    const signal = originalSignal(initialValue, options);
    const originalSet = signal.set;
    if (typeof originalSet === 'function') {
      signal.set = function(...args: any[]) {
        if (computedNestingLevel > 0) reportSignalMutation();
        return originalSet.apply(this, args);
      };
    }
    const originalUpdate = signal.update;
    if (typeof originalUpdate === 'function') {
      signal.update = function(...args: any[]) {
        if (computedNestingLevel > 0) reportSignalMutation();
        return originalUpdate.apply(this, args);
      };
    }
    return signal;
  };
}

interface SignalPatch {
  angularCore: any;
  signalDescriptor?: PropertyDescriptor;
  computedDescriptor?: PropertyDescriptor;
  installedSignal: boolean;
  installedComputed: boolean;
}

let activePatch: SignalPatch | null = null;

function restoreSignalPatch(): void {
  if (!activePatch) return;
  if (activePatch.installedSignal) {
    if (activePatch.signalDescriptor) Object.defineProperty(activePatch.angularCore, 'signal', activePatch.signalDescriptor);
    else delete activePatch.angularCore.signal;
  }
  if (activePatch.installedComputed) {
    if (activePatch.computedDescriptor) Object.defineProperty(activePatch.angularCore, 'computed', activePatch.computedDescriptor);
    else delete activePatch.angularCore.computed;
  }
  activePatch = null;
  computedNestingLevel = 0;
}

export function setupSignalGuard(angularCore: any): () => void {
  if (!angularCore) return () => undefined;
  restoreSignalPatch();
  const signalDescriptor = Object.getOwnPropertyDescriptor(angularCore, 'signal');
  const computedDescriptor = Object.getOwnPropertyDescriptor(angularCore, 'computed');
  let installedSignal = false;
  let installedComputed = false;

  try {
    if (typeof angularCore.signal === 'function') {
      Object.defineProperty(angularCore, 'signal', {
        value: wrapSignal(angularCore.signal), writable: true, configurable: true
      });
      installedSignal = true;
    }
  } catch {
    // Angular ESM namespace objects can be immutable; this guard remains experimental.
  }
  try {
    if (typeof angularCore.computed === 'function') {
      Object.defineProperty(angularCore, 'computed', {
        value: wrapComputed(angularCore.computed), writable: true, configurable: true
      });
      installedComputed = true;
    }
  } catch {
    // Angular ESM namespace objects can be immutable; this guard remains experimental.
  }

  activePatch = {
    angularCore,
    signalDescriptor: installedSignal ? signalDescriptor : undefined,
    computedDescriptor: installedComputed ? computedDescriptor : undefined,
    installedSignal,
    installedComputed
  };
  let tornDown = false;
  return () => {
    if (tornDown) return;
    tornDown = true;
    if (activePatch?.angularCore === angularCore) restoreSignalPatch();
  };
}
