# Portable verified autonomy — cold top-down architecture review

Inputs-ref: `709216205eacd2bce791e42a6db6db9ebf105f27`

VERDICT: GO

Scope: architecture sufficiency for an implementation specification of the first-host S1/S2 integration. This is not implementation authorization, host qualification, product acceptance, or approval of a second-host design.

## Inputs and independence

Read the pinned design, approved PRD, approval, architecture decisions and accepted research distillate with `git show` at Inputs-ref. Read the pinned arch design-review procedure and reviewer-discipline rule. Line citations below refer to those pinned files, not mutable worktree bytes. No other altitude's report, review dispositions, authoring dialogue, memory, or live source was consumed. No runtime or upstream investigation was performed; this is the top-down axis.

## Findings

No BLOCKER, MAJOR, MINOR or ESCALATED round-triggering findings.

The design serves the recorded outcome rather than substituting infrastructure activity for useful delivery. The PRD requires reduced coordination while retaining independent acceptance, recoverable responsibility and existing conventions (`docs/superpowers/specs/2026-10-26-portable-verified-autonomy-prd.md:10-14`, `:26-34`). The design keeps the existing pipeline, AIF admission/rework, distinct product review, applicable Dot ownership and actual predecessor-merge conditions (`docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md:51-65`, `:79-86`). It explicitly distinguishes completed turns, accepted candidates, delivery and stage expansion (`:90`). This matches P14/P16, not a competing task-to-PR workflow (`docs/superpowers/specs/reviews/portable-verified-autonomy/arch-decisions.md:15-17`).

The new responsibility is sufficiently concrete and bounded. One per-stage relationship record and a one-shot helper connect a stock host routine, native return and separate local worker; existing systems retain task and review meaning (`design.md:114-125`, shorthand for the design path above). The helper does add real reconciliation complexity, but its scope is explicit: identity, durable custody, current-state routing, control and return transport. It does not acquire a daemon, scheduler, execution engine, model router or memory store. The durable-record and effect-boundary rules address duplicate submission, lost return, stale worker results and competing repair ownership rather than asserting distributed exactly-once behavior (`design.md:129-139`). This is a credible integration scope under the PRD's exclusion of a replacement bot platform (`prd.md:58-60`, `:104-106`).

The key feasibility risks are represented honestly as discriminating implementation qualifications. Routine persistence supplies an architectural candidate for responsibility across completed native runs; the document does not pretend native completion already enforces acceptance (`design.md:92-110`). It specifies the concrete launcher, session identity, bounded observation, safe-stop reconciliation and durable return (`:118-125`). Q1 must prove both withheld false acceptance and automatic resumption, including a disconnected result and restart (`:108`); healthy waits remain eligible for late intake beyond twelve checks (`:139`). A failed host control or launcher qualification returns to architecture instead of silently growing a replacement framework (`:106-110`, `:125`, `:139`). A top-down approval need not demand those runtime experiments before their implementation specification exists.

Review and memory have feasible, separately accountable boundaries. The reviewer uses a fresh external process with immutable inputs, restricted retrieval, actual injected-source inventory and validated published results; missing isolation fails the route (`design.md:145-149`). Experience uses the installed memory's observed interface, provenance and supersession, with repository-backed canonical lessons if needed; ownership and policy remain outside memory (`:153-157`). These directly address distillate V4/V5 and PA5 without equating a new thread or installed package with working isolation/continuity (`docs/superpowers/research/portable-verified-autonomy/2026-10-26/distillate.md:23-24`).

Consumer and host independence remain required, with credible delivery boundaries rather than fabricated existing capability. The actual installer dependency closure and consumer-local authority are part of S3 (`design.md:161-170`, `:204-206`). S4 must preserve the same acceptance contract on a materially different coordination host and passes its own architecture review; a model change inside OpenMaus is explicitly insufficient. This is permitted staged progress under PA6/PA9 (`prd.md:38`, `:47-50`, `:96`), not an architectural promise that an unspecified second adapter is already buildable. The first-host integration can proceed to implementation planning while full feature acceptance remains open.

GO would be falsified by an implementation plan that credits unqualified routine/reviewer facilities as proven, substitutes host completion for getff acceptance, introduces concurrent repair owners, bypasses current authority/control at effects, or claims whole-feature completion from S1/S2. Each contradicts explicit design contracts cited above.

## Compact watch-list — acceptance and implementation risks, not new review rounds

| Watch | Required existing boundary |
| --- | --- |
| Routine authority, callable retirement and idle quota | Demonstrate actual permitted execution/control and Q1 before real enrollment; count scheduled model overhead (`design.md:104-110`, `:139-141`, `:165`). |
| Worker cessation and uncertain spawn | A released local lock or expired quantum cannot transfer custody; reconcile process/session and subsystem state, or hold explicitly (`design.md:120-133`). |
| Review input isolation and automatic return | Actual CLI injection inventory, Q2 and current published ResultReview must discriminate forbidden context, stale candidate and lost transport (`design.md:145-149`, `:186`). |
| Installed memory and consumer closure | Verify actual scoped/corrected eligible operation and installer-delivered transitive closure; installation identity alone earns no PA5/PA6 credit (`design.md:153-170`). |
| Benefit and second host | Keep setup/recovery/no-op cost visible; no net-benefit claim until the comparison horizon is accepted, and no PA9 claim until S4 (`design.md:168-174`, `:237`). |

Unrecorded acceptable payback, exact task preference and second-host choice are not priced by this reviewer. The design already preserves their later admission/value boundaries; they do not block architecture sufficiency for S1/S2 (`design.md:170-174`).

## Nonmaterial procedure notes

The dispatch map itself is not present in the pinned Git tree; its on-disk map was read solely to identify inputs. Every reviewed artifact was subsequently read directly from Inputs-ref, preserving immutable content and line provenance. No source edit or other report was made; this file is the sole output. The potentially confusing `r1` output filename was explicitly assigned by the dispatch; it does not imply an earlier draft or a different Inputs-ref.
