# AAET

AAET is a configurable Angular architecture analyzer with optional, experimental runtime diagnostics and AI-assisted explanations.

Static analysis is the default product. Runtime and AI checkers are opt-in.

## Setup

```bash
npm install --save-dev aaet
npx aaet init
```

Reconfigure an existing workspace at any time:

```bash
npx aaet configure
```

Both commands display a preview before replacing an existing configuration. For CI or scripted installation:

```bash
npx aaet init --interactive=false --preset recommended --checkers static --yes
npx aaet configure --interactive=false --preset strict --disable-rule ENFORCE_ONPUSH --yes
```

Angular CLI users can also run `ng add aaet`. The schematic uses the same presets, configuration builder, migration, and serializer as the CLI.

## Check a workspace

```bash
npx aaet check
npx aaet check apps/my-app/src/app.component.ts
```

The command exits with `1` only when an error-severity diagnostic is present. Warnings are printed without failing the command. Invalid configuration or execution failures exit with `2`.

## Configuration

AAET writes a versioned `aaet.config.json` and a local JSON schema. The `recommended` preset enables low-noise static rules; `strict` enables the complete static policy set. Explicit rule values—`off`, `warn`, or `error`—override the preset.

```json
{
  "$schema": "./aaet.config.schema.json",
  "version": 2,
  "preset": "recommended",
  "layers": {
    "ui": "**/*.component.ts",
    "api": "**/*.api.service.ts",
    "facade": "**/*.facade.service.ts"
  },
  "layerRestrictions": [
    { "from": "ui", "cannotDependOn": ["api"] }
  ],
  "checkers": {
    "static": { "enabled": true, "rules": {}, "settings": { "maxAllowedDI": 3, "maxLines": 400 } },
    "runtime": { "enabled": false, "rules": {}, "settings": { "stackDepth": 10, "samplingRate": 1 } },
    "ai": { "enabled": false, "rules": {}, "settings": { "provider": "anthropic", "apiKeyEnv": "ANTHROPIC_API_KEY", "autoAnalyze": false } }
  }
}
```

V1 `limits`, `aiGuard`, boolean rules, and checker-level runtime settings are accepted and migrated in memory. AAET only writes V2. See [configuration reference](docs/configuration.md).

## Experimental runtime

Runtime guards rely on instrumentation that may vary between Angular releases. Enable them deliberately and always retain the returned controller:

```typescript
import * as angularCore from '@angular/core';
import { Observable } from 'rxjs';
import { setupAaetRuntime } from 'aaet/runtime';

const controller = setupAaetRuntime(aaetConfig, {
  angularCore,
  ObservableClass: Observable
});

// Restore patched methods when the environment is disposed.
controller.teardown();
```

Browser code never reads `aaet.config.json` through Node filesystem APIs. Pass configuration into the initializer from the application bootstrap/build environment.

## AI credentials

Do not put provider keys in `aaet.config.json`. Configure a server proxy through `endpointUrl` and keep the credential in the environment variable named by `apiKeyEnv`. A programmatic runtime adapter may supply an ephemeral `aiApiKey`, but it is never serialized.

## Workspace

- `libs/config`: shared V2 model, presets, catalogue, validation, migration, merge, and schema.
- `libs/core`: static engine and CLI.
- `libs/runtime`: experimental browser instrumentation.
- `libs/schematics`: thin `ng-add` integration.
- `apps/demo-app`: analyzer and runtime fixtures.

```bash
npm run lint
npm test
npm run typecheck
npm run build
```
