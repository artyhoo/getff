# r2-zod-aware-selector — DONE
- Final PR: #748
- Closed: 2026-06-27
- Summary: R2 `no-unsafe-zod-parse` made Zod-aware — stdlib `.parse()` (`JSON.parse`/`Date.parse`/`path.parse`) no longer flagged (dogfood issue #737 closed); later false-positive arm refined by #959.

## Evidence (gh, 2026-09-10)

- `gh issue view 737` → CLOSED «R2 no-unsafe-zod-parse flags ALL .parse() (JSON.parse/Date.parse) — selector has no Zod check → false positives on ordinary code»
- `#743 docs(orchestrator): dogfood-issue kickoffs (#735/#737/#730/#727) [2026-06-26]`
- `#748 fix(eslint-rules): make R2 no-unsafe-zod-parse Zod-aware (closes #737) [2026-06-27]`
- `#959 fix(eslint-rules): R2 skips fully-static literal .parse() arguments — false-positive arm P1.1(e) [2026-07-10]`
