# Angular Architectural Enforcement Toolkit (AAET)

**AAET** is a hybrid tool combining compile-time static analysis and runtime validation to enforce clean architectural boundaries, performance best practices, and AI-readiness in large-scale Angular applications.

By using standard TypeScript Compiler APIs for static analysis and JS Proxies/Monkey-patching for runtime checks, AAET ensures that your codebase remains structured, modular, performant, and friendly for AI code generation agents.

---

## 🏗️ Workspace Architecture (Nx Monorepo)

The project is structured as a modular Nx monorepo:

* **[`libs/core`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/core)** — The static analysis compiler engine. Traverses the AST of source files and applies checks.
* **[`libs/runtime`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/runtime)** — Runtime validations active in development mode (`isDevMode()`).
  * **DI Guard:** Intercepts Angular dependency resolution to flag dynamic boundary violations.
  * **Performance Guard:** JS Proxy-based method profiler (`@ProfileMethods`) to track slow execution times and high-frequency calls.
* **[`libs/schematics`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/schematics)** — Angular CLI integration templates (e.g. `ng-add`).
* **[`apps/demo-app`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/apps/demo-app)** — A mock application and test bed hosting the test suite (`aaet.spec.ts`) and mock source files with architectural violations to verify rules.

---

## 🚀 Getting Started

### 1. Install Dependencies
Run the following command at the root of the workspace:
```bash
npm install
```

### 2. Run Tests
AAET is fully covered by Vitest tests. You can run them via Nx (results are automatically cached):
```bash
npx nx test demo-app
```

### 3. Run Static Analysis
Analyze files inside the workspace to find architectural violations according to the workspace configurations:
```bash
npx nx analyze demo-app
```
*Note: This command will exit with code `1` if violations are found, which is ideal for blocking commits in pre-commit hooks or CI/CD pipelines.*

---

## ⚙️ Configuration (`aaet.config.json`)

The workspace configuration is located in the root folder: [`aaet.config.json`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/aaet.config.json).

```json
{
  "layers": {
    "ui": "**/*component.ts",
    "api": "**/*api.service.ts",
    "facade": "**/*facade.service.ts"
  },
  "layerRestrictions": [
    {
      "from": "ui",
      "cannotDependOn": ["api"]
    }
  ],
  "limits": {
    "maxAllowedDI": 3,
    "maxLines": 400
  }
}
```

### Key Configurations:
* `layers`: Maps architectural layers to physical file paths using glob patterns.
* `layerRestrictions`: Enforces isolation boundaries (e.g. preventing the UI components layer from importing direct API services).
* `limits.maxAllowedDI`: Max dependency injections allowed per class (constructors + `inject()` calls combined) to enforce the Single Responsibility Principle.
* `limits.maxLines`: Enforces maximum file length to keep the files small and context-efficient for LLM / AI code generators.

---

## 🛡️ Runtime Guards Usage

Detailed documentation on implementation and runtime integration can be found in the [`docs/`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/docs) directory.

### 1. DI Guard
Hook into your development build (e.g., in `main.ts` or during app initialization) to catch dynamic runtime boundary violations in the browser console:
```typescript
import { setupDiGuard } from '@aaet/runtime';
import * as core from '@angular/core';

setupDiGuard({
  layers: { ui: '**/*component.ts', api: '**/*api.service.ts' },
  layerRestrictions: [{ from: 'ui', cannotDependOn: ['api'] }]
}, core);
```

### 2. Method Profiling Guard
Decorate components or services to monitor expensive template calls or slow execution:
```typescript
import { ProfileMethods } from '@aaet/runtime';

@ProfileMethods({ thresholdMs: 5, maxCallFrequency: 10 })
export class UserProfileComponent {
  // Methods inside this class will be profiled at runtime
}
```
If a method exceeds the threshold or is executed too frequently (suggesting a bad template binding call), a warning is logged to the developer console.
