# AAET Implementation Details

This document covers the internal design, lifecycle mechanics, and implementation architectures within the AAET codebase.

---

## Configuration Lifecycle

The AAET configuration engine manages settings through a structured lifecycle to ensure consistency, security, and type safety:

```
[aaet.config.json] ---> [validateConfig] ---> [normalizeConfig] ---> [EffectiveConfig]
                                                                             |
[serializeConfig] <--- [Security Filters] <----------------------------------+---> [Static & Runtime Engines]
```

1. **Reading Config**: The Node toolchain reads `aaet.config.json` via the filesystem.
2. **Validation (`validateAaetConfig`)**: Checks the validity of rule definitions, preset names, settings keys, and data types, reporting errors.
3. **Normalization (`normalizeAaetConfig`)**: Normalizes the raw input configuration by converting legacy structures (such as V1 fields, boolean rules, and old limits) into a modern configuration model, returning an immutable `EffectiveAaetConfig`.
4. **Usage**: Both the static engine (`libs/core`) and the runtime agent (`libs/runtime`) interact only with helper functions (`isCheckerEnabled`, `isRuleEnabled`, and `getRuleSettings`) rather than reading the raw configuration structure directly.
5. **Serialization (`serializeAaetConfig`)**: Writes configuration back to the filesystem in standard V2 format. This step automatically strips out any inline API keys or secrets before serialization.

> [!TIP]
> The command-line interface (`aaet configure`) and the Angular schematic (`ng add`) use the exact same configuration builder, merging engine, schema validation, and serialization routines. This prevents configuration drift between manual CLI setups and automated schematics.

---

## Static AST Engine

The static analyzer leverages TypeScript AST parsing for fast, lightweight checks:

- **Syntax-Kind Indexing**: Instead of parsing files repeatedly for each rule, the core engine parses each TypeScript source file exactly once. It constructs a syntax-kind lookup index mapping AST node kinds to their position.
- **Rule Groups**: Rules are logically grouped. If every rule in a specific group is set to `off` (e.g. all template control rules), the analyzer skips executing that entire group.
- **Diagnostics Resolution**: Emitted rule diagnostics are mapped to their resolved severity (`warn` or `error`) as determined by the configuration evaluation. Only `error`-level diagnostics cause the CLI check command to fail.

---

## Runtime Controller

The experimental runtime checker (`libs/runtime`) operates dynamically within the browser:

- **Bootstrap Injection**: `setupAaetRuntime(config, adapters)` receives a normalized configuration and platform-specific adapters (Angular APIs, RxJS Class reference, etc.).
- **Monkey-Patching Guards**: If the checker is enabled, it patches global constructors and prototypes (like `Observable.prototype.subscribe` or `ApplicationRef.tick`) to install diagnostic probes.
- **Teardown**: The runtime initialization returns an idempotent controller. When `controller.teardown()` is executed (e.g. in test cleanup), the tool restores the original un-patched prototypes, ensuring zero pollution.

> [!WARNING]
> Because Angular and RxJS internal APIs are subject to change between releases, the runtime layer remains experimental. Avoid embedding runtime monitoring logic in production bundles.

---

## Credentials Safety

Persistent configuration files (`aaet.config.json`) must never contain raw API secrets or tokens:

- **Key Environment Naming**: Config stores the *name* of the environment variable (via `apiKeyEnv`) rather than the key value.
- **Proxy Architecture**: The recommended setup for AI analysis in browser/runtime environments is a same-origin development proxy. The proxy resolves the authentication key from the server environment, preventing exposure in the browser.
- **Ephemeral Supply**: Programmatic adapters may supply a short-lived `aiApiKey` in memory during bootstrap, but the config serializer explicitly removes this property before writing to disk.
