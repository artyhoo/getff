# Authority restoration for specification review

Date: 2026-10-15

The current-decision selector was read at revision 1, with the existing approved PRD digest `4869eaee6c97d6ea055a94e11f462d4c4c3870a79a5fe5bf6eecd17574d3d326` and `currentSpec: null`. Its content references still name the former e220 paths.

Four exact recovered files were restored at those original paths: the approved PRD snapshot, product-brief approval JSON, premise record and original approval receipt. They are an archival authority mirror only; no Git checkout or implementation workspace was recreated. Their bytes equal the recovered originals in 6612. No selector, approval statement or approval digest was changed; no approval replay or pre-mechanism bootstrap was used.

For the existing intent helpers, the explicit owner roots are:

- `/Users/art/.codex/worktrees/6612/rules-as-tests-aif`
- `/Users/art/.codex/worktrees/e220/rules-as-tests-aif`

The restored approval resolved through the canonical presentation checker. Before semantic review publication, the checker correctly returned `matches_attempt_missing`; it did not report a missing or invalid approval. This is authority restoration evidence, not a semantic review verdict.

The review snapshots are Git objects under `refs/codex/deterministic-core-review-20261015/`. They were made with a temporary Git index; the working branch, HEAD and normal index were not changed. Snapshot refs provide immutable review inputs and are not implementation commits or publication.

Keep the original mirror available while the existing selector references it. Do not silently edit the selector to relocate references. Normal project work and the current design remain in 6612.
