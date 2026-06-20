import { CHECKER_IDS, AaetPreset, AiCheckerSettings, CheckerId, ConfigIssue, ConfigureOptions, EffectiveAaetConfig, LegacyAaetConfig, RuleConfigValue, RuleSeverity, RuntimeCheckerSettings, StaticCheckerSettings } from './types';
import { RULE_CATALOG, getPresetRules, getRuleDefinition } from './catalog';

export const DEFAULT_LAYERS: Record<string, string> = {
  ui: '**/*.component.ts',
  api: '**/*.api.service.ts',
  facade: '**/*.facade.service.ts'
};

export const DEFAULT_STATIC_SETTINGS: StaticCheckerSettings = {
  maxAllowedDI: 3,
  maxLines: 400
};

export const DEFAULT_RUNTIME_SETTINGS: RuntimeCheckerSettings = {
  stackDepth: 10,
  samplingRate: 1,
  slowMethodThresholdMs: 5,
  maxCallFrequency: 10,
  zoneThresholdMs: 16,
  maxTicksPerSecond: 20
};

export const DEFAULT_AI_SETTINGS: AiCheckerSettings = {
  provider: 'anthropic',
  endpointUrl: '/api/aaet-ai-check',
  apiKeyEnv: 'ANTHROPIC_API_KEY',
  autoAnalyze: false
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function severity(value: RuleConfigValue | undefined, fallback: RuleSeverity): RuleSeverity {
  if (value === true) return 'error';
  if (value === false) return 'off';
  if (value === 'off' || value === 'warn' || value === 'error') return value;
  return fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizeRules(checker: CheckerId, preset: AaetPreset, input: unknown): Record<string, RuleSeverity> {
  const defaults = getPresetRules(checker, preset);
  const rawRules = isRecord(input) ? input : {};
  return Object.fromEntries(
    Object.entries(defaults).map(([id, fallback]) => [id, severity(rawRules[id] as RuleConfigValue | undefined, fallback)])
  );
}

export function createDefaultConfig(preset: AaetPreset = 'recommended'): EffectiveAaetConfig {
  return {
    $schema: './aaet.config.schema.json',
    version: 2,
    preset,
    layers: { ...DEFAULT_LAYERS },
    layerRestrictions: [{ from: 'ui', cannotDependOn: ['api'] }],
    checkers: {
      static: {
        enabled: true,
        rules: getPresetRules('static', preset),
        settings: { ...DEFAULT_STATIC_SETTINGS }
      },
      runtime: {
        enabled: false,
        rules: getPresetRules('runtime', preset),
        settings: { ...DEFAULT_RUNTIME_SETTINGS }
      },
      ai: {
        enabled: false,
        rules: getPresetRules('ai', preset),
        settings: { ...DEFAULT_AI_SETTINGS }
      }
    }
  };
}

export function normalizeAaetConfig(input: unknown = {}): EffectiveAaetConfig {
  const raw = isRecord(input) ? clone(input) : {};
  const isLegacyConfig = raw.version !== 2 && Object.keys(raw).length > 0;
  const preset: AaetPreset = raw.preset === 'strict' || (raw.preset === undefined && isLegacyConfig)
    ? 'strict'
    : 'recommended';
  const defaults = createDefaultConfig(preset);
  const rawCheckers = isRecord(raw.checkers) ? raw.checkers : {};
  const rawStatic = isRecord(rawCheckers.static) ? rawCheckers.static : {};
  const rawRuntime = isRecord(rawCheckers.runtime) ? rawCheckers.runtime : {};
  const rawAi = isRecord(rawCheckers.ai)
    ? rawCheckers.ai
    : (isRecord(raw.aiGuard) ? raw.aiGuard : {});
  const legacyLimits = isRecord(raw.limits) ? raw.limits : {};
  const staticLimits = isRecord(rawStatic.limits) ? rawStatic.limits : {};
  const staticSettings = isRecord(rawStatic.settings) ? rawStatic.settings : {};
  const runtimeSettings = isRecord(rawRuntime.settings) ? rawRuntime.settings : {};
  const aiSettings = isRecord(rawAi.settings) ? rawAi.settings : {};

  const result = raw as unknown as EffectiveAaetConfig;
  delete (result as unknown as LegacyAaetConfig).limits;
  delete (result as unknown as LegacyAaetConfig).aiGuard;

  result.$schema = typeof raw.$schema === 'string' ? raw.$schema : defaults.$schema;
  result.version = 2;
  result.preset = preset;
  result.layers = isRecord(raw.layers) ? raw.layers as Record<string, string> : defaults.layers;
  result.layerRestrictions = Array.isArray(raw.layerRestrictions)
    ? clone(raw.layerRestrictions) as EffectiveAaetConfig['layerRestrictions']
    : defaults.layerRestrictions;
  result.checkers = {
    ...rawCheckers,
    static: {
      ...rawStatic,
      enabled: typeof rawStatic.enabled === 'boolean' ? rawStatic.enabled : true,
      rules: normalizeRules('static', preset, rawStatic.rules),
      settings: {
        maxAllowedDI: positiveInteger(staticSettings.maxAllowedDI ?? staticLimits.maxAllowedDI ?? legacyLimits.maxAllowedDI, DEFAULT_STATIC_SETTINGS.maxAllowedDI),
        maxLines: positiveInteger(staticSettings.maxLines ?? staticLimits.maxLines ?? legacyLimits.maxLines, DEFAULT_STATIC_SETTINGS.maxLines)
      }
    },
    runtime: {
      ...rawRuntime,
      enabled: typeof rawRuntime.enabled === 'boolean' ? rawRuntime.enabled : false,
      rules: normalizeRules('runtime', preset, rawRuntime.rules),
      settings: {
        stackDepth: positiveInteger(runtimeSettings.stackDepth ?? rawRuntime.stackDepth, DEFAULT_RUNTIME_SETTINGS.stackDepth),
        samplingRate: Math.min(1, Math.max(0, finiteNumber(runtimeSettings.samplingRate ?? rawRuntime.samplingRate, DEFAULT_RUNTIME_SETTINGS.samplingRate))),
        slowMethodThresholdMs: Math.max(0, finiteNumber(runtimeSettings.slowMethodThresholdMs, DEFAULT_RUNTIME_SETTINGS.slowMethodThresholdMs)),
        maxCallFrequency: positiveInteger(runtimeSettings.maxCallFrequency, DEFAULT_RUNTIME_SETTINGS.maxCallFrequency),
        zoneThresholdMs: Math.max(0, finiteNumber(runtimeSettings.zoneThresholdMs, DEFAULT_RUNTIME_SETTINGS.zoneThresholdMs)),
        maxTicksPerSecond: positiveInteger(runtimeSettings.maxTicksPerSecond, DEFAULT_RUNTIME_SETTINGS.maxTicksPerSecond)
      }
    },
    ai: {
      ...rawAi,
      enabled: typeof rawAi.enabled === 'boolean' ? rawAi.enabled : false,
      rules: normalizeRules('ai', preset, rawAi.rules),
      settings: {
        provider: (aiSettings.provider ?? rawAi.provider) === 'openai' ? 'openai' : 'anthropic',
        endpointUrl: typeof (aiSettings.endpointUrl ?? rawAi.endpointUrl) === 'string'
          ? String(aiSettings.endpointUrl ?? rawAi.endpointUrl)
          : DEFAULT_AI_SETTINGS.endpointUrl,
        apiKeyEnv: typeof (aiSettings.apiKeyEnv ?? rawAi.apiKeyEnv) === 'string'
          ? String(aiSettings.apiKeyEnv ?? rawAi.apiKeyEnv)
          : ((aiSettings.provider ?? rawAi.provider) === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'),
        customRules: typeof (aiSettings.customRules ?? rawAi.customRules) === 'string'
          ? String(aiSettings.customRules ?? rawAi.customRules)
          : undefined,
        workspaceType: (aiSettings.workspaceType ?? rawAi.workspaceType) === 'nx' ? 'nx' : ((aiSettings.workspaceType ?? rawAi.workspaceType) === 'standalone' ? 'standalone' : undefined),
        angularVersion: typeof (aiSettings.angularVersion ?? rawAi.angularVersion) === 'number'
          ? Number(aiSettings.angularVersion ?? rawAi.angularVersion)
          : undefined,
        autoAnalyze: typeof (aiSettings.autoAnalyze ?? rawAi.autoAnalyze) === 'boolean'
          ? Boolean(aiSettings.autoAnalyze ?? rawAi.autoAnalyze)
          : false
      }
    }
  };

  for (const checker of CHECKER_IDS) {
    delete (result.checkers[checker] as Record<string, unknown>).limits;
    delete (result.checkers[checker] as Record<string, unknown>).stackDepth;
    delete (result.checkers[checker] as Record<string, unknown>).samplingRate;
    delete (result.checkers[checker] as Record<string, unknown>).apiKey;
    delete (result.checkers[checker] as Record<string, unknown>).provider;
    delete (result.checkers[checker] as Record<string, unknown>).endpointUrl;
    delete (result.checkers[checker] as Record<string, unknown>).apiKeyEnv;
    delete (result.checkers[checker] as Record<string, unknown>).customRules;
    delete (result.checkers[checker] as Record<string, unknown>).workspaceType;
    delete (result.checkers[checker] as Record<string, unknown>).angularVersion;
    delete (result.checkers[checker] as Record<string, unknown>).autoAnalyze;
  }

  return result;
}

export function validateAaetConfig(input: unknown): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  if (!isRecord(input)) {
    return [{ path: '$', message: 'Configuration must be a JSON object.', severity: 'error' }];
  }
  if (input.version !== undefined && input.version !== 2) {
    issues.push({ path: 'version', message: 'Only configuration version 2 can be written.', severity: 'error' });
  }
  if (input.preset !== undefined && input.preset !== 'recommended' && input.preset !== 'strict') {
    issues.push({ path: 'preset', message: 'Preset must be "recommended" or "strict".', severity: 'error' });
  }
  const checkers = isRecord(input.checkers) ? input.checkers : {};
  for (const checker of CHECKER_IDS) {
    const value = checkers[checker];
    if (value !== undefined && !isRecord(value)) {
      issues.push({ path: `checkers.${checker}`, message: 'Checker configuration must be an object.', severity: 'error' });
      continue;
    }
    if (!isRecord(value)) continue;
    if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
      issues.push({ path: `checkers.${checker}.enabled`, message: 'enabled must be a boolean.', severity: 'error' });
    }
    if (value.rules !== undefined && !isRecord(value.rules)) {
      issues.push({ path: `checkers.${checker}.rules`, message: 'rules must be an object.', severity: 'error' });
    } else if (isRecord(value.rules)) {
      for (const [ruleId, ruleValue] of Object.entries(value.rules)) {
        if (!getRuleDefinition(ruleId, checker)) {
          issues.push({ path: `checkers.${checker}.rules.${ruleId}`, message: `Unknown ${checker} rule.`, severity: 'error' });
        }
        if (typeof ruleValue !== 'boolean' && ruleValue !== 'off' && ruleValue !== 'warn' && ruleValue !== 'error') {
          issues.push({ path: `checkers.${checker}.rules.${ruleId}`, message: 'Rule value must be off, warn, error, true, or false.', severity: 'error' });
        }
      }
    }
  }
  const staticChecker = isRecord(checkers.static) ? checkers.static : {};
  const staticSettings = isRecord(staticChecker.settings) ? staticChecker.settings : {};
  const legacyStaticSettings = isRecord(staticChecker.limits) ? staticChecker.limits : {};
  const rootLimits = isRecord(input.limits) ? input.limits : {};
  const validatePositiveInteger = (value: unknown, path: string): void => {
    if (value !== undefined && (!Number.isInteger(value) || Number(value) <= 0)) {
      issues.push({ path, message: 'Must be a positive integer.', severity: 'error' });
    }
  };
  validatePositiveInteger(staticSettings.maxAllowedDI ?? legacyStaticSettings.maxAllowedDI ?? rootLimits.maxAllowedDI, 'checkers.static.settings.maxAllowedDI');
  validatePositiveInteger(staticSettings.maxLines ?? legacyStaticSettings.maxLines ?? rootLimits.maxLines, 'checkers.static.settings.maxLines');

  const runtimeChecker = isRecord(checkers.runtime) ? checkers.runtime : {};
  const runtimeSettings = isRecord(runtimeChecker.settings) ? runtimeChecker.settings : {};
  validatePositiveInteger(runtimeSettings.stackDepth ?? runtimeChecker.stackDepth, 'checkers.runtime.settings.stackDepth');
  validatePositiveInteger(runtimeSettings.maxCallFrequency, 'checkers.runtime.settings.maxCallFrequency');
  validatePositiveInteger(runtimeSettings.maxTicksPerSecond, 'checkers.runtime.settings.maxTicksPerSecond');
  const configuredSamplingRate = runtimeSettings.samplingRate ?? runtimeChecker.samplingRate;
  if (configuredSamplingRate !== undefined && (typeof configuredSamplingRate !== 'number' || configuredSamplingRate < 0 || configuredSamplingRate > 1)) {
    issues.push({ path: 'checkers.runtime.settings.samplingRate', message: 'Must be between 0 and 1.', severity: 'error' });
  }
  for (const setting of ['slowMethodThresholdMs', 'zoneThresholdMs']) {
    const value = runtimeSettings[setting];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      issues.push({ path: `checkers.runtime.settings.${setting}`, message: 'Must be a non-negative number.', severity: 'error' });
    }
  }
  const legacyAi = isRecord(input.aiGuard) ? input.aiGuard : undefined;
  const configuredAi = isRecord(checkers.ai) ? checkers.ai : undefined;
  if (legacyAi?.apiKey || configuredAi?.apiKey) {
    issues.push({ path: configuredAi?.apiKey ? 'checkers.ai.apiKey' : 'aiGuard.apiKey', message: 'Inline API keys are ignored; configure apiKeyEnv or endpointUrl.', severity: 'warning' });
  }
  return issues;
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isRecord(base) || !isRecord(patch)) return clone(patch);
  const result: Record<string, unknown> = { ...clone(base) };
  for (const [key, value] of Object.entries(patch)) {
    result[key] = isRecord(value) && isRecord(result[key])
      ? deepMerge(result[key], value)
      : clone(value);
  }
  return result;
}

export function mergeAaetConfig(existing: unknown, updates: unknown): EffectiveAaetConfig {
  return normalizeAaetConfig(deepMerge(existing, updates));
}

export function buildAaetConfig(existing: unknown, options: ConfigureOptions = {}): EffectiveAaetConfig {
  let config = normalizeAaetConfig(existing);
  if (options.preset && options.preset !== config.preset) {
    config = mergeAaetConfig(config, {
      preset: options.preset,
      checkers: {
        static: { rules: getPresetRules('static', options.preset) },
        runtime: { rules: getPresetRules('runtime', options.preset) },
        ai: { rules: getPresetRules('ai', options.preset) }
      }
    });
  }
  if (options.checkers) {
    const selected = new Set(options.checkers);
    config = mergeAaetConfig(config, {
      checkers: Object.fromEntries(CHECKER_IDS.map(id => [id, { enabled: selected.has(id) }]))
    });
  }
  for (const ruleId of options.enableRules ?? []) {
    const definitions = RULE_CATALOG.filter(rule => rule.id === ruleId);
    for (const definition of definitions) {
      config.checkers[definition.checker].rules[ruleId] = definition[config.preset] === 'off' ? 'warn' : definition[config.preset];
    }
  }
  for (const ruleId of options.disableRules ?? []) {
    for (const checker of CHECKER_IDS) {
      if (getRuleDefinition(ruleId, checker)) config.checkers[checker].rules[ruleId] = 'off';
    }
  }
  if (options.staticSettings) config = mergeAaetConfig(config, { checkers: { static: { settings: options.staticSettings } } });
  if (options.runtimeSettings) config = mergeAaetConfig(config, { checkers: { runtime: { settings: options.runtimeSettings } } });
  if (options.aiSettings) config = mergeAaetConfig(config, { checkers: { ai: { settings: options.aiSettings } } });
  return config;
}

export function isCheckerEnabled(config: EffectiveAaetConfig, checker: CheckerId): boolean {
  return config.checkers[checker].enabled;
}

export function getRuleSeverity(config: EffectiveAaetConfig, checker: CheckerId, ruleId: string): RuleSeverity {
  return config.checkers[checker].rules[ruleId] ?? 'off';
}

export function isRuleEnabled(config: EffectiveAaetConfig, checker: CheckerId, ruleId: string): boolean {
  return isCheckerEnabled(config, checker) && getRuleSeverity(config, checker, ruleId) !== 'off';
}

export function getRuleSettings<TChecker extends CheckerId>(config: EffectiveAaetConfig, checker: TChecker): EffectiveAaetConfig['checkers'][TChecker]['settings'] {
  return config.checkers[checker].settings;
}

function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['apiKey', 'openaiApiKey', 'anthropicApiKey'].includes(key))
      .map(([key, item]) => [key, stripSecrets(item)])
  );
}

export function serializeAaetConfig(config: unknown): string {
  return `${JSON.stringify(stripSecrets(normalizeAaetConfig(config)), null, 2)}\n`;
}

function flatten(value: unknown, prefix = ''): Record<string, unknown> {
  if (!isRecord(value) && !Array.isArray(value)) return { [prefix || '$']: value };
  const entries: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isRecord(item) || Array.isArray(item)) Object.assign(entries, flatten(item, path));
    else entries[path] = item;
  }
  return entries;
}

export function formatConfigDiff(before: unknown, after: unknown): string {
  const oldValues = flatten(normalizeAaetConfig(before));
  const newValues = flatten(normalizeAaetConfig(after));
  const paths = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])].sort();
  const changes: string[] = [];
  for (const path of paths) {
    if (JSON.stringify(oldValues[path]) === JSON.stringify(newValues[path])) continue;
    if (path in oldValues) changes.push(`- ${path}: ${JSON.stringify(oldValues[path])}`);
    if (path in newValues) changes.push(`+ ${path}: ${JSON.stringify(newValues[path])}`);
  }
  return changes.length ? changes.join('\n') : 'No configuration changes.';
}
