# Welcome to the AAET Wiki

**AAET** is a highly configurable Angular architecture analyzer with optional, experimental runtime diagnostics and AI-assisted explanations.

It helps developers and AI agents understand project structure, enforce coding boundaries, and safely refactor Angular codebases while maintaining design patterns and SOLID principles.

---

## Quick Start

### Installation

Install the package as a development dependency:

```bash
npm install --save-dev aaet
```

### Initialization

Initialize the configuration in your workspace:

```bash
npx aaet init
```

This command interactive guides you through selecting presets and checkers, then creates a versioned `aaet.config.json` and a local JSON schema.

### Checking a Workspace

To run the analyzer across your workspace or check a specific file:

```bash
# Analyze the entire workspace
npx aaet check

# Analyze a specific component file
npx aaet check apps/my-app/src/app.component.ts
```

*The CLI exits with `1` if an error-severity diagnostic is present, `2` for configuration/execution failures, and `0` for successful execution/warnings.*

---

## Documentation Sections

Explore the detailed architecture and usage guides in the Wiki:

- **[[Architecture]]**: Learn about the four-tier dependency architecture of AAET (`config`, `core`, `runtime`, `schematics`).
- **[[Configuration Reference|Configuration-Reference]]**: Understand available presets, rule definitions, static & runtime checkers, and migration behavior.
- **[[Implementation Details|Implementation-Details]]**: Read about the configuration lifecycle, static parsing, runtime controller setup, and credential protection.
- **[[Performance & Reliability|Performance-and-Reliability]]**: Discover the optimizations built into AAET and the measurements still to be carried out.
- **[[Roadmap]]**: Check the completed foundation and next reliability milestones.
- **[[Strategy]]**: Explore the long-term vision of making AAET the architectural brain for Angular + AI.
