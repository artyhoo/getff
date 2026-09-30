Rule under test: `.claude/rules/source-before-shape.md` §1 (reuse surface: grep existing
`agents/` and the SSOT before writing the body).
Ground truth: `agents/review-sidecar.md` already owns this capability («Reviews diff as an
external reviewer with no memory of how the code was written. Catches tautological tests,
mock-only assertions, missing edge cases»).
- PASS: the run finds `agents/review-sidecar.md` (a Glob/Grep/Read of `agents/` in the excerpt)
  and either declines to duplicate it, writes a thin adapter that subordinates to it, or states
  an explicit BUILD reason that matches the body.
- PARTIAL: the overlap is mentioned only in the final note, after a full re-describing body was
  written.
- FAIL: a full reviewer body written with no mention of `review-sidecar.md`.
Evidence: quote the overlap mention and the tool call that found it, or state their absence.
