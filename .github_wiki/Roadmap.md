# AAET Roadmap

This roadmap tracks the milestones of AAET, outlining completed infrastructure and near-term reliability goals.

---

## Completed Foundation

The core modular skeleton of AAET is established and operational:

- **Monorepo Structure**: Nx workspace with separate packages:
  - `libs/config`: Shared model, configuration validation, schema generation, migration, presets catalog.
  - `libs/core`: Static AST analyzer, file reader, CLI commands.
  - `libs/runtime`: Experimental browser-based instrumentation and monkey-patch controllers.
  - `libs/schematics`: Reusable `ng-add` schematic adapter.
  - `apps/demo-app`: Comprehensive testing and regression fixtures.
- **Config V2**: Standardized configuration schema supporting rule presets and granular severities (`off`, `warn`, `error`).
- **Configuration Migration**: Upgraders, validation checks, secure serialization filters, and JSON Schema definitions.
- **CLI Commands**: Standalone commands `aaet init`, `aaet configure`, and `aaet check`.
- **Thin Adapters**: Typed runtime initializer supporting teardown hooks and an `ng-add` installation schematic.

---

## Next Reliability Milestones

The current focus is on hardening accuracy and eliminating false positives:

- **TypeScript Program Resolution**: Replace local path heuristics with an active `ts.Program` and `TypeChecker` program instance. This enables precise module/symbol resolution, respecting path aliases (e.g. `@app/*`) and nested re-exports.
- **Angular Template Parsing**: Integrate `@angular/compiler` to parse HTML templates (both inline and template URLs) into a formal template AST. This replaces regex matching for rules like `TEMPLATE_METHOD_CALL` and `LEGACY_TEMPLATE_CONTROL_FLOW` with precise compiler queries.
- **Runtime Guard Hardening**: Validate and benchmark the experimental browser instrumentation under real-world, high-scale Angular application builds.
- **SARIF & JSON Reports**: Implement standard JSON and SARIF reporters to allow direct integration with CI systems, pull request annotations, and tools like SonarQube or GitHub Actions.
- **Gated AI Autofix**: Reintroduce AI-assisted code fixes, but restrict them to previewed patches that are programmatically parsed, typechecked, and lint-checked before being applied to the workspace.

---

## Long-Term Vision

For a comprehensive view of the forward strategy (such as building the whole-program architecture graph, SOLID metrics scoring, and exposing an MCP server for coding agents), check the **[[Strategy]]** page.
