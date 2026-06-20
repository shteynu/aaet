import {
  CheckerId,
  EffectiveAaetConfig,
  getRuleSettings,
  isCheckerEnabled,
  isRuleEnabled,
  normalizeAaetConfig
} from '@aaet/config';

export let globalRuntimeConfig: EffectiveAaetConfig | null = null;

export function setRuntimeConfig(config: unknown): EffectiveAaetConfig {
  globalRuntimeConfig = normalizeAaetConfig(config);
  return globalRuntimeConfig;
}

export function clearRuntimeConfig(): void {
  globalRuntimeConfig = normalizeAaetConfig({ version: 2, preset: 'recommended' });
}

export function getRuntimeConfig(): EffectiveAaetConfig | null {
  return globalRuntimeConfig;
}

export function isConfiguredCheckerEnabled(checker: CheckerId): boolean {
  return globalRuntimeConfig ? isCheckerEnabled(globalRuntimeConfig, checker) : false;
}

export function isConfiguredRuleEnabled(checker: CheckerId, ruleId: string): boolean {
  return globalRuntimeConfig ? isRuleEnabled(globalRuntimeConfig, checker, ruleId) : false;
}

export function getConfiguredRuleSettings<TChecker extends CheckerId>(checker: TChecker): EffectiveAaetConfig['checkers'][TChecker]['settings'] | null {
  return globalRuntimeConfig ? getRuleSettings(globalRuntimeConfig, checker) : null;
}
