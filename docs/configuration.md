# AAET Configuration Reference

## Presets and precedence

`recommended` enables high-confidence static boundary checks and keeps runtime/AI disabled. `strict` enables all static policy rules, while runtime and AI remain opt-in. Resolution order is: explicit rule value, selected preset, catalogue default.

Rule values are `off`, `warn`, or `error`. Legacy booleans migrate to `off` and `error` respectively.

## Static rules

| Rule | Purpose |
| --- | --- |
| `STRICT_LAYERING` | Enforce configured import boundaries. |
| `MAX_DI_LIMIT` | Limit injected dependencies per class. |
| `ONE_SHOT_CONTEXT_LIMIT` | Limit source file line count. |
| `EXPLICIT_TOKEN_ECONOMY` | Require public method return types. |
| `LEGACY_DECORATOR` | Prefer signal inputs and outputs. |
| `MODERN_QUERY` | Prefer signal-based queries. |
| `FORBID_RAW_RXJS_UI` | Prefer signals over raw UI observables. |
| `ENFORCE_ONPUSH` | Require OnPush change detection. |
| `ENFORCE_STANDALONE` | Require standalone declarations. |
| `UNSAFE_MANUAL_SUBSCRIBE` | Detect subscriptions without recognized cleanup. |
| `PLATFORM_ISOLATION_VIOLATION` | Detect browser globals outside recognized guards. |
| `SWITCH_STRATEGY_SMELL` | Advise on large switch dispatch. |
| `TIGHT_COUPLING_OBSERVER_SMELL` | Report highly coupled methods. |
| `TEMPLATE_METHOD_CALL` | Detect template method calls. |
| `LEGACY_TEMPLATE_CONTROL_FLOW` | Prefer modern Angular template control flow. |
| `ROUTING_LAZY_LOAD_VIOLATION` | Enforce configured lazy route policy. |
| `DEFER_LAZY_LOAD_VIOLATION` | Detect eager imports associated with defer blocks. |

Static settings are `maxAllowedDI` and `maxLines`, both positive integers.

## Runtime rules

| Rule | Purpose |
| --- | --- |
| `RXJS_SUBSCRIPTION_LEAK` | Sample and track active subscriptions. |
| `STRICT_LAYERING` | Trace experimental DI boundary violations. |
| `TEMPLATE_METHOD_CALL` | Track high-frequency decorated methods. |
| `SLOW_METHOD_EXECUTION` | Measure decorated method duration. |
| `ZONE_BLOCKING_TASK` | Measure Angular zone task duration. |
| `EXCESSIVE_CHANGE_DETECTION` | Track application tick frequency. |
| `MUTABLE_SIGNAL_IN_COMPUTED` | Detect signal writes inside wrapped computed functions. |

Runtime settings are `stackDepth`, `samplingRate`, `slowMethodThresholdMs`, `maxCallFrequency`, `zoneThresholdMs`, and `maxTicksPerSecond`. Sampling accepts `0` through `1`; duration thresholds accept zero; count and depth settings must be positive integers.

## AI checker

`AI_VERIFY_DECORATOR` belongs to the AI checker and only runs when both the checker and rule are enabled. AI settings include `provider`, `endpointUrl`, `apiKeyEnv`, `customRules`, and `autoAnalyze`.

`apiKeyEnv` names a server-side environment variable; it is not the secret itself. Inline `apiKey` values are reported and removed during V2 serialization.

## Migration and merging

`aaet configure` preserves unknown custom fields, normalizes recognized V1 fields, prints a path-based diff, and requires confirmation. Non-interactive updates to existing files require `--yes`.
