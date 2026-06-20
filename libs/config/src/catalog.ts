import { AaetPreset, CheckerId, RuleDefinition, RuleSeverity } from './types';

export const RULE_CATALOG: readonly RuleDefinition[] = [
  { id: 'STRICT_LAYERING', checker: 'static', description: 'Enforce configured layer boundaries.', recommended: 'error', strict: 'error' },
  { id: 'MAX_DI_LIMIT', checker: 'static', description: 'Limit injected dependencies per class.', recommended: 'warn', strict: 'error' },
  { id: 'ONE_SHOT_CONTEXT_LIMIT', checker: 'static', description: 'Limit source file line count.', recommended: 'off', strict: 'error' },
  { id: 'EXPLICIT_TOKEN_ECONOMY', checker: 'static', description: 'Require public method return types.', recommended: 'off', strict: 'error' },
  { id: 'LEGACY_DECORATOR', checker: 'static', description: 'Prefer signal inputs and outputs.', recommended: 'off', strict: 'error' },
  { id: 'MODERN_QUERY', checker: 'static', description: 'Prefer signal-based Angular queries.', recommended: 'off', strict: 'error' },
  { id: 'FORBID_RAW_RXJS_UI', checker: 'static', description: 'Prefer signals over raw UI observables.', recommended: 'off', strict: 'error' },
  { id: 'ENFORCE_ONPUSH', checker: 'static', description: 'Require OnPush change detection.', recommended: 'off', strict: 'error' },
  { id: 'ENFORCE_STANDALONE', checker: 'static', description: 'Require standalone Angular declarations.', recommended: 'off', strict: 'error' },
  { id: 'UNSAFE_MANUAL_SUBSCRIBE', checker: 'static', description: 'Detect subscriptions without recognized cleanup.', recommended: 'off', strict: 'error' },
  { id: 'PLATFORM_ISOLATION_VIOLATION', checker: 'static', description: 'Detect unsafe browser-global access.', recommended: 'warn', strict: 'error' },
  { id: 'SWITCH_STRATEGY_SMELL', checker: 'static', description: 'Suggest strategies for large switches.', recommended: 'off', strict: 'warn' },
  { id: 'TIGHT_COUPLING_OBSERVER_SMELL', checker: 'static', description: 'Report highly coupled methods.', recommended: 'off', strict: 'warn' },
  { id: 'TEMPLATE_METHOD_CALL', checker: 'static', description: 'Detect method calls in Angular templates.', recommended: 'off', strict: 'error' },
  { id: 'LEGACY_TEMPLATE_CONTROL_FLOW', checker: 'static', description: 'Prefer modern Angular control flow.', recommended: 'off', strict: 'error' },
  { id: 'ROUTING_LAZY_LOAD_VIOLATION', checker: 'static', description: 'Require configured routes to lazy-load.', recommended: 'off', strict: 'error' },
  { id: 'DEFER_LAZY_LOAD_VIOLATION', checker: 'static', description: 'Detect eager imports used by defer blocks.', recommended: 'off', strict: 'error' },
  { id: 'RXJS_SUBSCRIPTION_LEAK', checker: 'runtime', description: 'Track active RxJS subscriptions.', recommended: 'warn', strict: 'warn' },
  { id: 'STRICT_LAYERING', checker: 'runtime', description: 'Trace runtime DI boundary violations.', recommended: 'warn', strict: 'warn' },
  { id: 'TEMPLATE_METHOD_CALL', checker: 'runtime', description: 'Track high-frequency method calls.', recommended: 'warn', strict: 'warn' },
  { id: 'SLOW_METHOD_EXECUTION', checker: 'runtime', description: 'Warn about slow decorated methods.', recommended: 'warn', strict: 'warn' },
  { id: 'ZONE_BLOCKING_TASK', checker: 'runtime', description: 'Warn about long Angular zone tasks.', recommended: 'warn', strict: 'warn' },
  { id: 'EXCESSIVE_CHANGE_DETECTION', checker: 'runtime', description: 'Warn about excessive application ticks.', recommended: 'warn', strict: 'warn' },
  { id: 'MUTABLE_SIGNAL_IN_COMPUTED', checker: 'runtime', description: 'Detect signal mutation inside computed.', recommended: 'warn', strict: 'warn' },
  { id: 'AI_VERIFY_DECORATOR', checker: 'ai', description: 'Enable the @AiVerify runtime review decorator.', recommended: 'warn', strict: 'warn' }
];

export function getRulesForChecker(checker: CheckerId): readonly RuleDefinition[] {
  return RULE_CATALOG.filter(rule => rule.checker === checker);
}

export function getRuleDefinition(ruleId: string, checker?: CheckerId): RuleDefinition | undefined {
  return RULE_CATALOG.find(rule => rule.id === ruleId && (!checker || rule.checker === checker));
}

export function getPresetRules(checker: CheckerId, preset: AaetPreset): Record<string, RuleSeverity> {
  return Object.fromEntries(
    getRulesForChecker(checker).map(rule => [rule.id, rule[preset]])
  );
}
