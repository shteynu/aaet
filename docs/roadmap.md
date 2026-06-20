# AAET Roadmap

## Completed foundation

- Nx workspace with static, runtime, schematic, demo, and shared configuration projects.
- Versioned V2 configuration with selectable presets and per-rule severities.
- V1 migration, validation, secure serialization, merge preview, and JSON schema.
- Reusable `aaet init`, `aaet configure`, and `aaet check` commands.
- Thin `ng-add` adapter and typed runtime initializer with teardown.

## Next reliability work

- Replace path/name heuristics with TypeScript program module resolution.
- Parse Angular templates with the Angular compiler for precise diagnostics.
- Validate experimental runtime guards against real Angular applications.
- Add JSON/SARIF reporters and tested npm installation fixtures.
- Reintroduce AI autofix only as previewed patches with parse, typecheck, and explicit apply gates.

For the longer-term feature strategy (semantic foundation, architecture graph, verified AI architect, and the MCP/agent surface), see `docs/strategy.md`.
