# Portable verified autonomy — bottom-up architecture review R2

Inputs-ref: `709216205eacd2bce791e42a6db6db9ebf105f27`

VERDICT: GO

Scope: fresh artifact-only bottom-up review of the corrected full design, with targeted source counterchecks. This is the substantive second round after R1 REVISE at `b106a201bb84c18593cccdb3c397ec1443219ad4`, not a refreshed identity for the prior verdict. The supplied input map located the immutable material; substantive reads used `git show` at Inputs-ref. No live runtime, chat, memory, configuration or upstream fetch was used. Only this report was written.

Rubric: `.agents/procedures/arch/references/design-review.md` §2, `.agents/rules/reviewer-discipline.md` and its deployed role excerpt at Inputs-ref. Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

References below use repository paths and one-based lines at Inputs-ref. `design.md` abbreviates `docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md`; `routines.ts` abbreviates the captured `docs/superpowers/specs/reviews/portable-verified-autonomy/q1-source-addendum/server__routines.ts`.

## R1 BU1 countercheck — resolved in the proposed design

The previous MAJOR finding was an explicit loss of future result intake, not merely an unproved host capability. The corrected rule in `design.md:139` now separates three cases:

- Healthy owned pending work never consumes the recovery-error budget or disables its routine. Twelve unchanged observations change cadence to thirty minutes while keeping intake enabled.
- Confirmed recovery errors have a separate counter, reset by successful authoritative read. Exhaustion retains scheduled prerequisite reconciliation and automatically clears the technical hold on recovery. Quota holds likewise retain scheduled retries rather than becoming business pauses.
- Automatic disable is restricted to verified authorized completion or explicit business pause/cancel. Terminal/paused business state prevents work even if routine disable fails.

This matches the observer's actual semantics: `packages/runtime-bridge/src/cli/await.ts:117–127` can read healthy pending work successfully and still return `observation_deadline_not_worker_failure`. The revised policy no longer treats that timeout as unavailable execution. The exact late-result regression is explicitly required at `design.md:102`.

The scheduler foundation supports the proposed distinction: enabled due routines are selected at `routines.ts:1017–1019`; recurring next occurrences advance independently of completed attempts at `:1379–1390`. Schedule updates are real manager operations and recalculate the next occurrence when changed (`:592–620`); disable cancels queued runs, rather than establishing cessation of active work (`:642–649`). Startup selection retains enabled recurring routines subject to active-run exclusion (`:975–980`). Thus the revised design can preserve intake without requiring resurrection of a completed native root or a second scheduler.

Counterexample re-run on paper: a healthy AIF task remains unchanged past twelve observations, then completes after the original cutoff. Its routine remains enabled at a slower cadence; the next attempt rereads the same task/result under `design.md:100–102,123,129–133`. It can proceed to review without manual reactivation. Native child return is an additional prompt path, not the sole late-result guarantee. No new deterministic contradiction was found in this revised policy.

This resolution concerns the specified architecture. Actual management-tool authorization, accepted scheduling inputs, restart/overlap behavior, billing eligibility and successful late intake are still qualification requirements, not already-proven capability. GO would be falsified if implementation disables intake on a healthy timeout/error-budget exhaustion, cannot retain an authorized recurring schedule, or requires a human result relay in the mandated Q1 case.

## Targeted seam checks

- The new helper and relationship record remain explicitly proposed glue (`design.md:114,129–133`); no nonexistent helper is represented as an existing exported API. Process identity, custody generation and uncertain-effect reconciliation prevent a lock expiry or finished native turn from being treated as worker cessation.
- The corrected packaging instruction names the actual profile authority, `setup.d/ships.manifest`, and requires an installer exercise (`design.md:161`). The source really splits pipeline into env and dispatcher/intent into factory (`setup.d/ships.manifest:45–52`) and runtime dispatch into factory (`:65`). Naming the inventory alone is no longer offered as consumer delivery proof.
- Review transport now explicitly decodes the CLI result envelope and rejects error/truncated/multiple/invalid payloads before ResultReview validation (`design.md:149`). Captured CLI help documents the launch surface only. The existing checker independently requires current brief/revision (`.agents/procedures/intent/helpers/check-result-review.mjs:704–728`) and enforces published attempt identity when requested (`:736–763`). The design retains independent semantic review rather than equating CLI success with acceptance.
- Full-design boundaries remain intact: distinct AIF/worker/managed-PR custody, preserved acceptance gates, scoped experience with correction, mandatory consumer and second-host proof, and no claim that the first-host pilot completes PA1–PA9. S1 qualification precedes real-task enrollment (`design.md:165–170`).

## Compact watch-list — unverified acceptance cells

| Cell | Evidence still required |
| --- | --- |
| Q1 routine/control | Actual permitted owner can read/update/disable the same routine; long healthy task completes after twelve checks; confirmed-error and quota recovery retain intake; overlap/startup/disconnected returns and pause/cancel precedence work. Check schedule changes do not repeatedly push the next due time forward. |
| CLI/process custody | Real JSON envelope fixtures for worker REPORT as well as ResultReview; durable spawn-intent reconciliation, PID/start/session identity and safe quantum cessation. Missing process evidence must hold rather than launch a competing fixer. |
| Q2 | Actual injected-source inventory and sentinel exclusion with mandatory policy/hooks and eligible authentication preserved; immutable independently authored attempt and lost-return recovery. A fresh CLI session alone proves none of these. |
| Consumer delivery | Actual installer delivers the transitive env/factory helper/procedure/role closure, with legitimate consumer authority and prerequisite detection. |
| Memory / PA8 | Bind installed Hy-Memory identity/interface/account; run isolated succession, supersession, project-decoy and cleanup cases; demonstrate sourced successor use and eligible processing/retrieval cost. |
| Full feature | Real useful task cycle and destination, measured overhead/economics, independent consumer cycle and materially different second-host architecture/proof remain open. |

No BLOCKER, MAJOR, MINOR or ESCALATED finding is recorded. These watch-list cells are explicitly gated qualifications, not new round-triggering findings or completed evidence. No strategy/value-premise choice is made. Final intent-fidelity review and operator architecture agreement remain separate.

VERDICT: GO
