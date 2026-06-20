export * from './di-guard';
export * from './performance-guard';
export * from './rxjs-guard';
export * from './signal-guard';
export * from './ai-guard';
export * from './ai-verify';
export * from './config-state';

import { EffectiveAaetConfig, getRuleSettings, isCheckerEnabled, isRuleEnabled } from '@aaet/config';
import { setupAiGuard } from './ai-guard';
import { clearRuntimeConfig, setRuntimeConfig } from './config-state';
import { setupDiGuard } from './di-guard';
import { setupChangeDetectionGuard, setupZoneGuard } from './performance-guard';
import { setupRxjsComponentTracking, setupRxjsGuard } from './rxjs-guard';
import { setupSignalGuard } from './signal-guard';

export interface AaetRuntimeAdapters {
  angularCore: any;
  ObservableClass?: any;
  aiApiKey?: string;
}

export interface AaetRuntimeController {
  readonly config: EffectiveAaetConfig;
  teardown(): void;
}

let activeController: AaetRuntimeController | null = null;

function asTeardown(value: unknown): (() => void) | null {
  return typeof value === 'function' ? value as () => void : null;
}

export function setupAaetRuntime(config: unknown, adapters: AaetRuntimeAdapters): AaetRuntimeController;
export function setupAaetRuntime(config: unknown, angularCore: any, ObservableClass?: any): AaetRuntimeController;
export function setupAaetRuntime(
  config: unknown,
  adaptersOrAngularCore: any,
  legacyObservableClass?: any
): AaetRuntimeController {
  activeController?.teardown();
  const effectiveConfig = setRuntimeConfig(config);
  const adapters: AaetRuntimeAdapters = adaptersOrAngularCore && 'angularCore' in adaptersOrAngularCore
    ? adaptersOrAngularCore as AaetRuntimeAdapters
    : { angularCore: adaptersOrAngularCore, ObservableClass: legacyObservableClass };
  const teardowns: Array<() => void> = [];

  if (isCheckerEnabled(effectiveConfig, 'ai')) {
    const aiSettings = getRuleSettings(effectiveConfig, 'ai');
    setupAiGuard({ enabled: true, ...aiSettings, apiKey: adapters.aiApiKey });
    teardowns.push(() => setupAiGuard({ enabled: false }));
  } else {
    setupAiGuard({ enabled: false });
  }

  if (isCheckerEnabled(effectiveConfig, 'runtime')) {
    const settings = getRuleSettings(effectiveConfig, 'runtime');
    const add = (teardown: unknown): void => {
      const callback = asTeardown(teardown);
      if (callback) teardowns.push(callback);
    };
    if (isRuleEnabled(effectiveConfig, 'runtime', 'STRICT_LAYERING')) {
      add(setupDiGuard(effectiveConfig, adapters.angularCore));
    }
    if (isRuleEnabled(effectiveConfig, 'runtime', 'RXJS_SUBSCRIPTION_LEAK')) {
      if (adapters.ObservableClass) {
        add(setupRxjsGuard(adapters.ObservableClass, {
          stackDepth: settings.stackDepth,
          samplingRate: settings.samplingRate
        }));
      }
      add(setupRxjsComponentTracking(adapters.angularCore));
    }
    if (isRuleEnabled(effectiveConfig, 'runtime', 'ZONE_BLOCKING_TASK')) {
      add(setupZoneGuard(adapters.angularCore, settings.zoneThresholdMs));
    }
    if (isRuleEnabled(effectiveConfig, 'runtime', 'EXCESSIVE_CHANGE_DETECTION')) {
      add(setupChangeDetectionGuard(adapters.angularCore, settings.maxTicksPerSecond));
    }
    if (isRuleEnabled(effectiveConfig, 'runtime', 'MUTABLE_SIGNAL_IN_COMPUTED')) {
      add(setupSignalGuard(adapters.angularCore));
    }
  }

  let tornDown = false;
  const controller: AaetRuntimeController = {
    config: effectiveConfig,
    teardown(): void {
      if (tornDown) return;
      tornDown = true;
      for (const teardown of teardowns.reverse()) teardown();
      clearRuntimeConfig();
      if (activeController === controller) activeController = null;
    }
  };
  activeController = controller;
  return controller;
}
