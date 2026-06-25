# AAET Configuration Reference

AAET relies on a structured configuration file, `aaet.config.json`, which governs rule strictness, preset settings, layer definitions, and active checkers.

---

## Presets and Precedence

AAET offers two built-in presets:
- `recommended`: Enables high-confidence static rules and keeps runtime and AI checks disabled. Best for minimal noise.
- `strict`: Enables all static analysis rules. Runtime and AI features remain opt-in.

### Rule Evaluation Order
Rules are evaluated according to the following precedence hierarchy (from highest to lowest):
1. **Explicit Rule Value**: Explicitly setting a rule to `off`, `warn`, or `error` in `aaet.config.json` rules object.
2. **Selected Preset**: The setting defined in the chosen `preset` (e.g. `recommended` or `strict`).
3. **Catalogue Default**: The default behavior defined in AAET's internal rules catalog.

Rule severities are defined as:
- `off`: The rule is ignored.
- `warn`: Violations are reported but do not fail the check command.
- `error`: Violations are reported and will cause the `npx aaet check` command to exit with code `1`.

> [!NOTE]
> Legacy boolean rule values (`true` / `false`) automatically migrate to `error` and `off` respectively.

---

## Static Rules

Static rules analyze code files using TypeScript AST parsing to flag architectural issues before compilation.

| Rule ID | Purpose |
| :--- | :--- |
| `STRICT_LAYERING` | Enforce configured import boundaries (e.g. preventing UI component files from directly importing API service files). |
| `MAX_DI_LIMIT` | Limit the number of injected dependencies per class constructor. |
| `ONE_SHOT_CONTEXT_LIMIT` | Enforce maximum source file line count limits. |
| `EXPLICIT_TOKEN_ECONOMY` | Require public methods to declare explicit return types. |
| `LEGACY_DECORATOR` | Prefer modern signal inputs and outputs (`input()`, `output()`) over decorator `@Input()` and `@Output()`. |
| `MODERN_QUERY` | Prefer signal-based queries (`viewChild()`, `contentChildren()`) over `@ViewChild()`, etc. |
| `FORBID_RAW_RXJS_UI` | Prefer signals over raw RxJS Observables for component state bindings. |
| `ENFORCE_ONPUSH` | Require `ChangeDetectionStrategy.OnPush` change detection for performance safety. |
| `ENFORCE_STANDALONE` | Require components, directives, and pipes to be defined as `standalone: true`. |
| `UNSAFE_MANUAL_SUBSCRIBE` | Detect component subscriptions without standard cleanup hooks or operators. |
| `PLATFORM_ISOLATION_VIOLATION` | Detect direct references to browser globals (like `window`, `document`) outside recognized SSR platform checks. |
| `SWITCH_STRATEGY_SMELL` | Flag excessively large switch-case blocks acting as complex state dispatchers. |
| `TIGHT_COUPLING_OBSERVER_SMELL` | Identify methods that have highly coupled code patterns. |
| `TEMPLATE_METHOD_CALL` | Detect direct method calls inside Angular templates. |
| `LEGACY_TEMPLATE_CONTROL_FLOW` | Enforce the use of modern Angular template control flow (`@if`, `@for`, `@switch`) over legacy structural directives (`*ngIf`, `*ngFor`). |
| `ROUTING_LAZY_LOAD_VIOLATION` | Enforce lazy-loading routes for defined modules. |
| `DEFER_LAZY_LOAD_VIOLATION` | Detect eager module/component imports associated with `@defer` blocks. |

### Static Settings
- `maxAllowedDI`: Positive integer setting max constructor parameters (defaults to `3`).
- `maxLines`: Positive integer setting max lines per source file (defaults to `400`).

---

## Runtime Rules (Experimental)

Runtime rules monkey-patch Angular and RxJS lifecycle hooks to detect logical issues while the application runs (typically in dev or testing modes).

| Rule ID | Purpose |
| :--- | :--- |
| `RXJS_SUBSCRIPTION_LEAK` | Sample and track active subscriptions to warn about memory leaks. |
| `STRICT_LAYERING` | Trace Dependency Injection (DI) boundaries at runtime to detect dynamic layering bypasses. |
| `TEMPLATE_METHOD_CALL` | Track method execution frequency within templates to spot change detection bottlenecks. |
| `SLOW_METHOD_EXECUTION` | Measure and alert on execution duration for decorated/monitored methods. |
| `ZONE_BLOCKING_TASK` | Measure NgZone task execution times. |
| `EXCESSIVE_CHANGE_DETECTION` | Track application tick frequency to spot change detection loops. |
| `MUTABLE_SIGNAL_IN_COMPUTED` | Warn about signal write/mutation side-effects triggered inside computed signal evaluation functions. |

### Runtime Settings
- `stackDepth`: Positive integer (defaults to `10`) for capturing stack traces on subscription/calls.
- `samplingRate`: Float value from `0` to `1` controlling runtime execution sampling overhead.
- `slowMethodThresholdMs`: Minimal duration (in ms) to log a method as slow.
- `maxCallFrequency`: Trigger limit for frequency checks.
- `zoneThresholdMs`: Threshold duration (in ms) for reporting zone blocking tasks.
- `maxTicksPerSecond`: Threshold for tick rate warnings.

---

## AI Checker (Experimental)

Runs a large language model check over specified structures.

- **Rule**: `AI_VERIFY_DECORATOR`
- **Settings**:
  - `provider`: AI model provider (e.g. `anthropic`).
  - `endpointUrl`: Custom API proxy URL.
  - `apiKeyEnv`: The name of the server-side environment variable holding the API key (e.g. `ANTHROPIC_API_KEY`). **Do not put your API key directly in config**.
  - `customRules`: Custom structural/pattern guidelines.
  - `autoAnalyze`: Automatically trigger explanation requests on error diagnostics.

---

## Configuration Migration & Merging

When updating your package or migrating a project:
```bash
npx aaet configure
```
This utility:
1. Normalizes older V1 configuration settings (e.g. boolean rules, old `limits` structures).
2. Preserves any unknown custom properties you added.
3. Prints a clean path-based diff.
4. Serializes and writes back only clean **V2** format, ensuring API keys are stripped out.
5. In non-interactive setups (like CI/scripts), run with `--yes` to accept updates without prompts.
