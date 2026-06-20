export * from './di-guard';
export * from './performance-guard';
export * from './rxjs-guard';
export * from './signal-guard';
export * from './ai-guard';
export * from './ai-verify';

import { setupDiGuard } from './di-guard';
import { setupRxjsGuard, setupRxjsComponentTracking } from './rxjs-guard';
import { setupZoneGuard, setupChangeDetectionGuard } from './performance-guard';
import { setupSignalGuard } from './signal-guard';
import { setupAiGuard } from './ai-guard';
import { setRuntimeConfig } from './config-state';
export { globalRuntimeConfig, setRuntimeConfig } from './config-state';

export function setupAaetRuntime(config: any, angularCore: any, ObservableClass?: any) {
  // Normalize if checkers config doesn't exist
  if (config && !config.checkers) {
    config.checkers = {
      static: { enabled: true },
      runtime: { enabled: true },
      ai: { enabled: config.aiGuard?.enabled ?? false }
    };
  }

  setRuntimeConfig(config);

  if (!config) return;

  // Initialize AI Guard
  const aiConfig = config.checkers?.ai || config.aiGuard;
  if (aiConfig && aiConfig.enabled) {
    setupAiGuard(aiConfig, angularCore);
  }

  // Check if runtime checker is enabled
  const runtimeConfig = config.checkers?.runtime;
  if (runtimeConfig?.enabled === false) {
    return;
  }

  const rules = runtimeConfig?.rules || {};

  // 1. DI Guard (STRICT_LAYERING)
  if (rules['STRICT_LAYERING'] !== false) {
    setupDiGuard(config, angularCore);
  }

  // 2. RxJS Guard (RXJS_SUBSCRIPTION_LEAK)
  if (rules['RXJS_SUBSCRIPTION_LEAK'] !== false) {
    if (ObservableClass) {
      setupRxjsGuard(ObservableClass, {
        stackDepth: runtimeConfig?.stackDepth,
        samplingRate: runtimeConfig?.samplingRate
      });
    }
    setupRxjsComponentTracking(angularCore);
  }

  // 3. Zone Guard (ZONE_BLOCKING_TASK)
  if (rules['ZONE_BLOCKING_TASK'] !== false) {
    setupZoneGuard(angularCore);
  }

  // 4. Change Detection Guard (EXCESSIVE_CHANGE_DETECTION)
  if (rules['EXCESSIVE_CHANGE_DETECTION'] !== false) {
    setupChangeDetectionGuard(angularCore);
  }

  // 5. Signal Guard (MUTABLE_SIGNAL_IN_COMPUTED)
  if (rules['MUTABLE_SIGNAL_IN_COMPUTED'] !== false) {
    setupSignalGuard(angularCore);
  }
}
