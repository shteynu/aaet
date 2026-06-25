# AAET Performance and Reliability Notes

Because AAET performs static AST parsing and optional dynamic runtime patching, performance and reliability are critical considerations. Below is a summary of the design optimizations implemented so far, as well as the plans for future performance auditing.

---

## Implemented Optimizations

AAET is designed to minimize local analysis overhead using several techniques:

- **Shared Syntax-Kind Indexing**: Instead of parsing files repeatedly for different rules, AAET parses each TypeScript file exactly once to construct a syntax-kind index. All active static rules query this index in parallel.
- **Config & File Caching**: File-layer definitions, template resolution, and config merging decisions are cached internally within the configuration manager.
- **Dead-Code Pruning (Analyzer)**: If all rules in a specific group (e.g. AI checker or specific static groups) are disabled in `aaet.config.json`, the execution of the entire rule group is skipped.
- **Overhead-Bounded Runtime**:
  - The RxJS subscription leak tracer supports stack depth limits and sampling rates.
  - Setting `samplingRate` to `0` disables checks completely.
  - The runtime and AI checkers are disabled by default.
- **AI Deduplication**: Under active session runs, duplicate explanation requests for the same diagnostic rule or class signatures are suppressed. AI model requests are serialized and queue-controlled.

---

## Performance Measurements Still to Conduct

To harden the performance profile, the following items are on the roadmap:

- **Benchmark Fixtures**: Establish a suite of representative Angular and Nx workspace benchmarks and publish timing metrics.
- **Incremental TypeScript Programs**: Rather than searching the filesystem recursively, leverage project-aware tsconfigs and incremental compilation features to limit file reads to only modified/affected inputs.
- **AI Throttling**: Add explicit request timeouts, bounded model queues, and expiring cache/deduplication stores to prevent network bottlenecks.
- **Real-World Runtime Auditing**: Test the runtime instrumentation layer against large-scale Angular development builds to measure performance overhead during interactive usage.

---

## Crucial Development Gating

> [!IMPORTANT]
> **Production Safety**
> AAET does not claim zero overhead, and runtime instrumentation is highly experimental. Development instrumentation relies on monkey-patching frameworks and should never be deployed to production. Ensure that `libs/runtime` code is completely gated behind development environment checks so it is tree-shaken out of production bundles.
