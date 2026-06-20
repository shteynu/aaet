# AAET Implementation Details

This document outlines the technical implementation details of the static analysis engine and runtime guards in the AAET workspace.

---

## 🔍 Compile-Time: TypeScript Compiler API Integration

The static analyzer in [`libs/core`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/core) parses TypeScript source files directly into an Abstract Syntax Tree (AST) to verify structural and architectural rules.

### 1. AST Creation & Traversal
For every target `.ts` file, a source file object is created:
```typescript
const sourceFile = ts.createSourceFile(
  filePath,
  content,
  ts.ScriptTarget.Latest,
  true
);
```
AAET uses recursive AST traversal via `ts.forEachChild(node, visit)` to find specific syntactic nodes like class declarations, properties, and imports.

### 2. Dependency Extraction Mechanisms
AAET extracts injected dependencies from classes using two main checks:
* **Constructor Parameters:** Traverses constructor parameter nodes (`ts.isConstructorDeclaration`), extracts the type reference nodes (`ts.isTypeReferenceNode`), and records their identifiers (e.g. `private apiService: ApiService`).
* **`inject()` Expressions:** Checks class properties for assignment nodes (`ts.isPropertyDeclaration`) whose initializers are call expressions to a function named `inject()`. It retrieves the type token passed as the first argument or in the generic type parameters.

```typescript
if (ts.isCallExpression(init) && init.expression.getText(sourceFile) === 'inject') {
  const token = init.arguments[0].getText(sourceFile); // e.g. 'ApiService'
}
```

### 3. Template Parsing
To check for method calls in component templates, the performance rule:
1. Locates the `@Component` decorator on class declarations.
2. Extracts either the inline `template` string or resolves the path to the file in `templateUrl`.
3. Utilizes Regex patterns to detect method calls inside interpolation blocks (e.g., `{{ getUsername() }}`) and property bindings (e.g. `[value]="calculateValue()"`).

---

## 🛡️ Runtime: Dev Mode Interception

The runtime guards in [`libs/runtime`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/runtime) intercept Angular's execution path dynamically.

### 1. Injector Monkey-Patching (DI Guard)
The DI boundary guard intercepts dependency injection by patching the prototype of Angular's `Injector`:

```typescript
const originalGet = InjectorClass.prototype.get;

InjectorClass.prototype.get = function(token, notFoundValue, flags) {
  resolutionStack.push(tokenName);
  try {
    // If the resolution stack contains UI Component -> API Service, throw error
    validate(resolutionStack);
    return originalGet.apply(this, arguments);
  } finally {
    resolutionStack.pop();
  }
};
```
* **Dynamic Resolution Trace:** By using `try...finally` with a push/pop stack, the guard maintains a exact trace of the resolution hierarchy, allowing it to detect not only direct constructor injections but also transitive or dynamic dependencies.

### 2. JavaScript Proxies (Performance Guard)
The `@ProfileMethods` decorator replaces all methods on a target class's prototype with a JS Proxy:

```typescript
const proxyMethod = new Proxy(originalMethod, {
  apply(targetMethod, thisArg, argumentsList) {
    const start = performance.now();
    incrementCallCount(methodKey);
    try {
      return targetMethod.apply(thisArg, argumentsList);
    } finally {
      const duration = performance.now() - start;
      if (duration > thresholdMs) {
        console.warn(`[AAET] Slow execution...`);
      }
    }
  }
});
```
* **Proxy Advantages:** JS Proxies provide a zero-overhead footprint when inactive and allow transparent interception of arguments, return values, and timing metrics without polluting the target method's source code.

---

## 🤖 Runtime AI Guard & Verification Engine

AAET integrates real-time AI code reviews and troubleshooting directly inside your browser console during development mode.

### 1. Interception & Forwarding
When active runtime guards (e.g., DI, Performance, or Signal guards) detect a boundary warning or side-effect, they check if the AI Guard is enabled (`isAiGuardEnabled()`). If enabled, they compile a payload consisting of:
*   `ruleId`: The specific rule code (e.g., `STRICT_LAYERING`).
*   `violationMessage`: The warning text.
*   `className`: The target class where the error occurred (extracted via resolution stacks or parsed from stack traces).

This payload is forwarded to the AI analysis engine.

### 2. Dual-Mode Communication Bridge
The AI Guard in [`libs/runtime/src/ai-guard.ts`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/runtime/src/ai-guard.ts) supports two communication channels:
*   **Direct API Mode:** The browser submits queries directly to OpenAI (`https://api.openai.com/v1/chat/completions`) or Anthropic (`https://api.anthropic.com/v1/messages`). This is useful for tests or headless environments but requires exposing API keys to the client bundle.
*   **Local Proxy Mode (Recommended):** The browser calls a local dev server endpoint (e.g., `/api/aaet-ai-check` or `http://localhost:3000/api/aaet-ai-check`). The Node.js-based core server handler `handleAiCheckRequest` in [`libs/core/src/ai-check.server.ts`](file:///Users/maxim.berenshtein/WebstormProjects/aaet/libs/core/src/ai-check.server.ts):
    1.  Resolves API keys securely using backend environment variables (`CLAUDE_API_KEY`, `OPENAI_API_KEY`).
    2.  Reads the actual class file directly from the local filesystem using `fs.readFileSync` (solving the compiled bundle limitation).
    3.  Enriches the system prompt with context-aware data: the detected **Angular Version** (from `package.json`) and **Workspace Layout** (standalone vs Nx monorepo).
    4.  Queries the LLM and formats the explanation and refactored fix into a clean, parsed JSON response back to the client.

### 3. `@AiVerify` Class Decorator
Developers can explicitly flag any component or service for dynamic code inspection:
```typescript
@AiVerify({ filePath: 'apps/demo-app/src/app/stub.component.ts' })
export class StubComponent {}
```
The decorator wraps the class constructor to trigger a background AI review request *exactly once* during the first class instantiation, preventing redundant API calls and keeping console outputs clean.

