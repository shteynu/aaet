# AAET Performance Roadmap

This document outlines the performance strategy for the Angular Architectural Enforcement Toolkit (AAET), tracking completed optimizations and upcoming goals to maintain zero compile-time overhead and lightweight runtime guards.

---

## 🚀 Status Overview

| Performance Optimization | Component | Status | Impact / Benefits |
| :--- | :--- | :---: | :--- |
| **Single-Pass AST Visitor** | `libs/core` | ✅ Done | Walks files exactly once, reducing AST traversal overhead |
| **Glob Matching Caching** | `libs/core` | ✅ Done | Avoids redundant `minimatch` regex compilations per import |
| **Template Reading Cache** | `libs/core` | ✅ Done | Prevents duplicate synchronous disk reads of component templates |
| **On-Demand AI Diagnostics** | `libs/runtime` | ✅ Done | Stops automated API request floods; provides console triggers |
| **Configurable RxJS Stack Capture** | `libs/runtime` | ✅ Done | Caps stack trace serialization via `Error.stackTraceLimit` |
| **RxJS Sampling Rate** | `libs/runtime` | ✅ Done | Reduces tracking overhead by filtering monitored streams |
| **\(O(1)\) Component Tracking** | `libs/runtime` | ✅ Done | Eliminates linear scans \(O(N)\) on component destruction |
| **AI Request Queue / Throttle** | `libs/runtime` | ✅ Done | Debounces and serialises runtime violation network requests |
| **Incremental File Watching** | `libs/core` | ✅ Done | Invalidate cached files using Vite/Webpack dev server hooks |
| **ESLint AST Reuse** | `libs/core` | ✅ Done | ESLint plugin wrapper reuses parserServices pre-built ASTs |

---

## 🛠️ Completed Optimizations

### 1. Static AST Visitor & Caching (`libs/core`)
* **AST Single-Pass Walk:** The core static analyzer now traverses the TypeScript AST exactly once per file on run, storing all nodes in a `Map` indexed by `ts.SyntaxKind`. Rules access nodes instantly via the [RuleContext.getNodes](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/core/src/rules/rule.interface.ts#L16) helper, eliminating rule-specific AST walks.
* **Glob Caching:** [ConfigManager](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/core/src/context/config-manager.ts) caches resolved file layers (`fileLayersCache`), optimizing import layering checks.
* **Template Caching:** Synchronous file I/O operations are cached globally per analysis run, removing redundant disk reads of external component template files.

### 2. Dev-Mode Runtime Guard Hardening (`libs/runtime`)
* **On-Demand AI Analysis:** The toolkit no longer floods LLM providers automatically when developer warnings occur. Instead, it logs a styled suggestion button to the dev console and registers a manual trigger `aaet.analyze(id)` on the global scope.
* **RxJS V8 Stack Depth Cap:** Capped stack-trace generation using `Error.stackTraceLimit = stackDepth` (default: 10), significantly speeding up subscription site tracking in dev tools.
* **RxJS Subscription Sampling:** Enabled configurable `samplingRate` (0.0 to 1.0) to sample subscription captures for high-throughput stream environments.
* **Active Component Map Counters:** Replaced linear scans of active component arrays with a constructor reference-counting map, executing component destroy checks in \(O(1)\) time.

### 3. Request Serialization & Deduplication Middleware (`libs/runtime`)
* **Request Queuing:** Implemented a promise-based serialization queue `requestQueue` to ensure only 1 active fetch call is executed at any time.
* **Deduplication Check:** Uses a `recentlyAnalyzedViolations` Set (matching `ruleId` and `className`) to instantly skip duplicate requests, avoiding API token burning and rate-limits (HTTP 429).

### 4. Watcher Cache Invalidation (`libs/core`)
* **Cache Invalidation Helper:** Implemented `invalidateFile(filePath)` in [ConfigManager](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/core/src/context/config-manager.ts) to evict specific files from layer, template, and violation caches.
* **Vite Plugin:** Created [vite-plugin.ts](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/core/src/plugins/vite-plugin.ts) to hook into Vite server watcher changes and invalidate cache entries dynamically.
* **Webpack Plugin:** Created [webpack-plugin.ts](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/core/src/plugins/webpack-plugin.ts) to evict cache items on Webpack watch cycles.

### 5. ESLint Plugin AST Reuse (`libs/core`)
* **Zero Parsing Overhead:** Created [eslint-rule.ts](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/core/src/eslint/eslint-rule.ts) which hooks directly into ESLint.
* **AST Reuse:** Directly queries the pre-built TS AST `ts.SourceFile` from `context.parserServices.program`, running static rules with absolute zero parsing or disk I/O overhead.
