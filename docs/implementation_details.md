# AAET Implementation Details

## Configuration lifecycle

1. Node integrations read `aaet.config.json`.
2. `validateAaetConfig` reports invalid checker, rule, and setting values.
3. `normalizeAaetConfig` migrates V1 fields without mutating the input and produces `EffectiveAaetConfig`.
4. Core and runtime use `isCheckerEnabled`, `isRuleEnabled`, and `getRuleSettings` rather than interpreting raw JSON.
5. `serializeAaetConfig` writes only V2 and removes inline provider secrets.

The CLI and schematic use the same `buildAaetConfig`, `mergeAaetConfig`, diff, schema, and serializer functions. This prevents setup defaults from drifting away from enforcement behavior.

## Static engine

The static engine builds a syntax-kind index for each TypeScript source file. Rules are grouped by their possible diagnostic IDs. A group is skipped when every associated rule is `off`; remaining diagnostics receive the effective `warn` or `error` severity.

## Runtime controller

`setupAaetRuntime(config, adapters)` normalizes the supplied data, tears down a prior AAET controller, and installs only enabled guards. Adapters provide Angular APIs, an optional Observable class, and an optional ephemeral AI key. Teardown restores patched prototypes and clears shared configuration state.

Runtime behavior remains experimental because Angular and RxJS internals can change between supported versions.

## Credentials

Persistent configuration stores only `endpointUrl` and `apiKeyEnv`. The recommended architecture is a same-origin development proxy that resolves credentials server-side. Browser bundles must not contain long-lived provider keys.
