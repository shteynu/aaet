# AAET Project Roadmap & Implementation Plan

This document details the development roadmap for the Angular Architectural Enforcement Toolkit (AAET), tracking completed phases and future goals.

---

## 🗺️ Execution Phases

### ✅ Phase 1: Core AST Parsing (Completed)
* Set up standard TypeScript and AST parsing logic.
* Implement compiler logic targeting class decorators, constructors, and `inject()` parameters.
* Validate parsing capabilities with direct command line compilation checks.

### ✅ Phase 2: Configuration & Glob Matching (Completed)
* Introduce `aaet.config.json` schema.
* Leverage `minimatch` for flexible folder-to-layer glob matching rules.
* Restructured codebase to separate parser logic and configuration reading into modular helper files.

### 🔄 Phase 3: Monorepo Restructuring & Nx Migration (Completed)
* Migrated the repository to a structured Nx Monorepo workspace.
* Extracted functional blocks into:
  * `libs/core` (static compiler rule engine)
  * `libs/runtime` (DI intercepts and Proxy profilers)
  * `libs/schematics` (Angular CLI ng-add automation templates)
  * `apps/demo-app` (mock playground and comprehensive test suite)
* Configured caching defaults in `nx.json` to enable sub-second test execution.

### ✅ Phase 4: Runtime Guard Enforcement (Completed)
* Implemented monkey-patched `Injector` interception for development mode.
* Developed Proxy-based `@ProfileMethods` class decorator.
* Added validation checks to verify warning logs and timing boundaries.

### ✅ Phase 5: Runtime AI Guard & Developer Diagnostics (Completed)
* Integrated runtime guard warnings directly with OpenAI (GPT-4o) and Anthropic (Claude 3.5 Sonnet).
* Designed secure server-side middleware handler `handleAiCheckRequest` to resolve API keys and read class source files safely.
* Rich prompt generation adapting to the local project context: detected Angular Version and Workspace (Nx monorepo vs standalone).
* Created `@AiVerify` class decorator to audit targeted classes on startup.
* Verified execution with mock and integration test blocks in the Vitest suite.

### ✅ Phase 6: Modern Syntax & SSR Compile-Time Rules (Completed)
* Flagged legacy structural directives (`*ngIf`, `*ngFor`) in component templates to encourage Angular 17+ control flow.
* Enforced `standalone: true` component declarations to maximize modularity.
* Detected direct browser global API calls (`window`, `localStorage`) outside SSR-safe blocks (like `afterRender` or `isPlatformBrowser` checks) to ensure hydration safety.
* Solved the multi-component template overwrite bug in static analysis.

### ✅ Phase 7: Advanced Runtime Guards (Completed)
* Added a Change Detection Frequency Guard to warn when application-wide change detection loops run excessively within a short timeframe.
* Correlated active RxJS subscriptions to specific component lifecycles, warning developers of specific un-unsubscribed streams at component destruction.

### ✅ Phase 8: AI-Readiness Tools & CLI Automation (Completed)
* Implemented an AI Auto-Fix command (`npx nx fix demo-app`) to automatically apply LLM-generated refactorings for simple violations.
* Created an AI Context Generator tool (`npx nx context demo-app`) that exports the workspace's architectural boundaries and rules into a `.ai-context.md` file, ready to be attached to LLM prompts.

### ⏳ Phase 9: Performance Optimization & Reliability Hardening (Planned)
* **Dev-Mode Runtime Overhead Mitigation:**
  - Implement lazy, sampled, or depth-limited stack trace generation for the RxJS subscription leak detector to eliminate V8 CPU stalls.
  - Optimize the active component tracking checks to use a constructor-to-count map lookup \(O(1)\) instead of converting the Set to an array and running `.some()` linear scans \(O(N)\) on every component destroy.
  - Cache class/constructor name reflections in DI Guard to avoid repeated string conversions.
* **AI API Request Flooding Guard:**
  - Build a throttling/debouncing queue for runtime violations to prevent concurrent network requests to Claude/OpenAI when high-frequency issues occur.
  - Introduce an opt-in mode where AI diagnostics are run on-demand (e.g. by clicking a console log button) rather than firing automatic requests.
* **Static Analysis Speedups:**
  - Replace synchronous template reading (`fs.readFileSync`) inside AST walks with a pre-read caching mechanism.
  - Refactor static rules (`LayeringRule`, `PatternsRule`, `AiReadinessRule`) to share a single-pass AST visitor rather than doing multiple recursive traversals.
  - Cache results of file layer glob resolution (`minimatch`) inside `ConfigManager` to optimize project-wide scanning.

---

## 🚀 Future Goals & Enhancement Pipeline

### 1. ESLint Plugin Wrapper
Currently, AAET runs as a standalone script (which is very fast). We plan to build an ESLint rule wrapper:
* Allow developers to run AAET checks directly inside their existing `eslint` configuration.
* Show inline linting errors in IDEs (like VS Code, WebStorm) instead of requiring a separate command line process.

### 2. Angular CLI Builder Integration
* Implement a custom Angular CLI builder (e.g., `@aaet/builder:lint`).
* Allow seamless execution using `ng lint aaet`.

### 3. State-Management Boundaries
* Add support for checking boundary conditions in modern state stores (e.g., NgRx, Signals Store).
* Prevent components from writing directly to state stores without executing actions/events.

### 4. Public NPM Release
* Configure workspace packaging pipelines to build libraries.
* Publish `@aaet/core` and `@aaet/runtime` to the public npm registry under an open-source license.

### 5. Vite / DevServer Developer Dashboard
* Introduce a local developer dashboard (e.g., running via Vite middleware at `/__aaet`) providing interactive dependency graphs, active subscription leak trackers, and AI diagnostic logs.

