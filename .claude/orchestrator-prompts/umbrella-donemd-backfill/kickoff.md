# umbrella-donemd-backfill — close stale umbrellas with evidence-backed done.md

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Umbrella:** umbrella-donemd-backfill (single-stage, Tier 1 — the «how» is one
> sentence: for every umbrella dir without `done.md`, gather merge-signals mechanically
> and write a schema-conformant `done.md` ONLY when closure is proven; anything unclear
> goes to a report, never to a done.md).
> **Goal:** the `/pipeline` no-arg overview currently scans ~99 open umbrellas
> (285 dirs − 186 done.md, measured 2026-07-23); most are finished or superseded legacy
> whose sessions predate the done.md convention. Backfill done.md so completion-detection
> Layer C3 (`priority-score.sh`, CLAUDE.md «Umbrella closure convention») hides them from
> the panel. Zero code changes — this umbrella writes ONLY
> `.claude/orchestrator-prompts/<name>/done.md` files + one report file.
> **Base:** staging. One PR (batch commits every ~25 files OK).
> **Why factory:** operator directive 2026-07-23 — token economy; whole line on the
> executor profile (marker above).

## This dispatch = Stage 1 only

Deliverables 1 + 2 below (`done.md` for proven closures + `report.md`). The
OBSOLETE-CANDIDATE table is **proposed, never applied** in this run, and this
umbrella's own `done.md` is NOT written here — both belong to the gated follow-up
(Deliverable 3), which starts only after the operator answers the proposal.

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity
(two defensible implementations, an undecided design choice, a missing spec detail
that changes behaviour) — **do NOT pick.** Park it as a question (set the task to
`manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
consequence X / Option B → consequence Y») and **stop that task.** Proceed only on
the unambiguous parts. Guessing a fork to "keep moving" is the failure this loop
exists to prevent.

Umbrella-specific: a candidate whose closure signal is weak is an **UNCLEAR row**,
never a park and never a `done.md` — that fork is already decided below. Park
instead when the exclusion list is ambiguous for a dir, when a merged PR plausibly
covers *some but not all* stages of an umbrella, or when the measured population
disagrees with the number below by more than a handful.

## Scope + hard exclusions

Population = every `.claude/orchestrator-prompts/<name>/` WITHOUT `done.md`. Enumerate it
FIRST (T10) with the exact command and count in the report.

**NEVER touch (exclusion list — skip even if they look closed):**

1. Active waves 1-3 + live program umbrellas: `getff-honest-signals`,
   `getff-any-stack-trace`, `getff-foreign-scan-triage`, `adapter-jig`,
   `beta-delivery-ux`, `beta-docs-showcase`, `beta-ai-docs-agnosticism`,
   `multi-model-pipeline-pilot`, `getff-freshness-widening`, `stack-tooling-generation`,
   `getff-to-prod-meta-launch`, `launch-preannounce-track`, `python-delivery-v0`,
   `generation-live-delivery`, `meta-orchestrator-prior-art`, `acceptance-contour`
   (any dir whose name starts with `beta-` or `getff-` and is referenced by
   `docs/superpowers/specs/2026-07-23-*.md` — grep before touching).
2. Any umbrella with a **live signal**: an open PR mentioning its slug
   (`gh pr list --state open --search "<slug>"`), an unmerged `origin/*<slug>*` branch
   with commits ahead of staging, or any file under its dir committed in the last
   **45 days** (`git log -1 --format=%ci -- .claude/orchestrator-prompts/<name>/`).

## Per-candidate protocol (mechanical, evidence per verdict — T3)

For each remaining candidate, collect in order (stop at first sufficient signal):

- **S1 merged-PR:** `gh pr list --state merged --search "<slug>" --json number,title,mergedAt --limit 5`
  — a merged PR whose title/branch carries the umbrella slug and covers its final stage.
- **S2 branch state:** remote branches matching the slug all merged into staging
  (`git branch -r --merged origin/staging | grep "<slug>"` vs unmerged).
- **S3 superseded marker:** the umbrella's own kickoff.md (or the
  `getff-to-prod-meta-launch` graph) carries `superseded-by:` / `absorbed-by:` /
  `→ superseded` naming a successor.

**Verdict rules (conservative — the ONLY four outcomes; operator note 2026-07-23: the
population splits into «finished but never marked» — close now with evidence — and
«obsolete» — PROPOSE, never self-decide):**

| Verdict | Requires | Action |
|---|---|---|
| CLOSED-VERIFIED | S1 hit (merged PR identified) | write done.md, `Final PR: #<num>` |
| SUPERSEDED | S3 marker (quote it in the report) | write done.md, `Final PR: n/a (superseded)`, `Summary: superseded-by <target> (backfill 2026-07)` |
| OBSOLETE-CANDIDATE | no S1/S3, AND last activity > 6 months, AND the topic is visibly overtaken (e.g. pre-live-generation recipe work after the U5 verdict; cite WHAT overtook it) | do NOT write done.md; report row in the «proposed obsolete» table: name + last-activity date + what-overtook-it one-liner. **Operator confirms the list → a follow-up batch commit closes confirmed rows** with `Summary: obsolete (operator-confirmed <date>)` |
| UNCLEAR | anything else — weak/ambiguous/no signal | do NOT write done.md; one report row: name + signals seen |

`done.md` schema (binding, CLAUDE.md «Umbrella closure convention»):

```text
# <umbrella> — DONE
- Final PR: #<num>
- Closed: <YYYY-MM-DD of the merged PR, not today>
- Summary: <one-line> (done.md backfilled 2026-07 by umbrella-donemd-backfill)
```

## Deliverables

1. done.md files for every CLOSED-VERIFIED / SUPERSEDED candidate.
2. `report.md` in THIS umbrella's dir: population enumeration (command + count),
   per-verdict counts, full UNCLEAR table (name + signals), full SUPERSEDED table with
   quoted markers, full OBSOLETE-CANDIDATE table (the operator-confirmation queue —
   parked to the operator via runtime-bridge park/answer, or left as the report table
   for a follow-up).
3. One PR to staging; PR body summarizes counts and links report.md. The follow-up
   obsolete-close batch (after operator confirmation) is a second commit/PR of this
   same umbrella — done.md for THIS umbrella is written only after that follow-up
   resolves (or the operator declines the whole obsolete list).

## Acceptance gate

- Every done.md corresponds to a report row with its evidence (PR number verifiable via
  `gh pr view <num>` — spot-checkable).
- ZERO done.md files under exclusion-list dirs (reviewer greps to confirm).
- `bash .claude/skills/pipeline/helpers/priority-score.sh` still runs clean (no parse
  breakage from new files).
- Report UNCLEAR section present even if empty (T14: absence of findings is a stated
  result, not an omission).

## AI traps (per [.claude/rules/ai-laziness-traps.md §2-§3](../../rules/ai-laziness-traps.md))

Active traps for this run: T1, T3, T7, T10, T14.

- T1/T10 — no sampling: enumerate the FULL no-done.md population first; the report's
  count is the checksum (population = processed + excluded + UNCLEAR).
- T3 — every done.md carries a verifiable Final PR number (or a quoted superseded
  marker); no prose-only closures.
- T7 — the exclusion list is checked per-dir before classification, not pattern-matched
  once and forgotten.
- T14 — UNCLEAR is a first-class outcome; «no merge signal found» never becomes a
  done.md.
- **T-UDB-A (domain):** «cleaner panel» is not evidence — writing done.md to shrink the
  open count without an S1/S3 signal is data corruption of Layer C3; doubt = UNCLEAR.
- **T-UDB-B (domain):** an exclusion-list umbrella that LOOKS finished stays untouched —
  its closure belongs to its own closing session (single-owner-per-stage), not to this
  backfill.
- **T-UDB-C (domain):** a PR-title slug match is NOT closure evidence. `gh pr list
  --search "<slug>"` matches any PR naming the slug, including the umbrella's own
  *kickoff-authoring* PR — live example: PR #1107 is this very umbrella's kickoff and
  would self-match. S1 requires the matched PR to plausibly deliver the umbrella's
  **final stage**, not merely to mention its name.
