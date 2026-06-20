# AAET Performance and Reliability Notes

## Implemented

- One syntax-kind index is shared by static rule groups per file.
- File-layer and template reads are cached within a configuration manager.
- Disabled static rule groups are skipped.
- Runtime RxJS capture supports bounded stack depth and sampling, including sampling rate `0`.
- Runtime and AI checkers are disabled by default.
- AI requests are serialized and duplicate rule/class requests are suppressed per configured session.

## Still to measure

- Establish representative Angular/Nx benchmark fixtures and publish timings.
- Replace recursive filesystem discovery with project-aware inputs and incremental TypeScript programs.
- Add bounded AI queues, request timeouts, and expiring deduplication.
- Measure each runtime guard against real Angular development builds before making overhead claims.

Runtime instrumentation is experimental; AAET does not claim zero overhead.
