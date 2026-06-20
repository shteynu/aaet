export const CHECKER_IDS = ['static', 'runtime', 'ai'] as const;

export type CheckerId = typeof CHECKER_IDS[number];
export type AaetPreset = 'recommended' | 'strict';
export type RuleSeverity = 'off' | 'warn' | 'error';
export type RuleConfigValue = RuleSeverity | boolean;
export type AiProvider = 'openai' | 'anthropic';

export interface LayerRestriction {
  from: string;
  cannotDependOn: string[];
}

export interface StaticCheckerSettings {
  maxAllowedDI: number;
  maxLines: number;
}

export interface RuntimeCheckerSettings {
  stackDepth: number;
  samplingRate: number;
  slowMethodThresholdMs: number;
  maxCallFrequency: number;
  zoneThresholdMs: number;
  maxTicksPerSecond: number;
}

export interface AiCheckerSettings {
  provider: AiProvider;
  endpointUrl?: string;
  apiKeyEnv: string;
  customRules?: string;
  workspaceType?: 'nx' | 'standalone';
  angularVersion?: number;
  autoAnalyze: boolean;
}

export interface PersistedCheckerConfig<TSettings extends object = Record<string, unknown>> {
  enabled?: boolean;
  rules?: Record<string, RuleConfigValue>;
  settings?: Partial<TSettings>;
  [key: string]: unknown;
}

export interface PersistedStaticCheckerConfig extends PersistedCheckerConfig<StaticCheckerSettings> {
  /** @deprecated V1 compatibility. Use settings. */
  limits?: Partial<StaticCheckerSettings>;
}

export interface PersistedRuntimeCheckerConfig extends PersistedCheckerConfig<RuntimeCheckerSettings> {
  /** @deprecated V1 compatibility. Use settings.stackDepth. */
  stackDepth?: number;
  /** @deprecated V1 compatibility. Use settings.samplingRate. */
  samplingRate?: number;
}

export interface PersistedAiCheckerConfig extends PersistedCheckerConfig<AiCheckerSettings> {
  /** V1 checker properties are accepted and migrated into settings. */
  provider?: AiProvider;
  endpointUrl?: string;
  apiKeyEnv?: string;
  apiKey?: string;
  customRules?: string;
  workspaceType?: 'nx' | 'standalone';
  angularVersion?: number;
  autoAnalyze?: boolean;
}

export interface AaetConfigV2 {
  $schema?: string;
  version: 2;
  preset: AaetPreset;
  layers: Record<string, string>;
  layerRestrictions: LayerRestriction[];
  checkers: {
    static: PersistedStaticCheckerConfig;
    runtime: PersistedRuntimeCheckerConfig;
    ai: PersistedAiCheckerConfig;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LegacyAaetConfig {
  layers?: Record<string, string>;
  layerRestrictions?: LayerRestriction[];
  limits?: Partial<StaticCheckerSettings>;
  aiGuard?: PersistedAiCheckerConfig;
  checkers?: Partial<AaetConfigV2['checkers']>;
  [key: string]: unknown;
}

export interface EffectiveCheckerConfig<TSettings extends object> {
  enabled: boolean;
  rules: Record<string, RuleSeverity>;
  settings: TSettings;
  [key: string]: unknown;
}

export interface EffectiveAaetConfig extends AaetConfigV2 {
  checkers: {
    static: EffectiveCheckerConfig<StaticCheckerSettings>;
    runtime: EffectiveCheckerConfig<RuntimeCheckerSettings>;
    ai: EffectiveCheckerConfig<AiCheckerSettings>;
    [key: string]: unknown;
  };
}

export interface ConfigIssue {
  path: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface RuleDefinition {
  id: string;
  checker: CheckerId;
  description: string;
  recommended: RuleSeverity;
  strict: RuleSeverity;
}

export interface ConfigureOptions {
  preset?: AaetPreset;
  checkers?: CheckerId[];
  enableRules?: string[];
  disableRules?: string[];
  staticSettings?: Partial<StaticCheckerSettings>;
  runtimeSettings?: Partial<RuntimeCheckerSettings>;
  aiSettings?: Partial<AiCheckerSettings>;
}
