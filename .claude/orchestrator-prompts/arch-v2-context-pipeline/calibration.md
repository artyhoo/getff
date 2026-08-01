# arch-v2-context-pipeline — calibration ledger

> **Authoritative for:** the calibration ledger for the arch-v2-context-pipeline umbrella —
> the pre-registered ADR-5 shadow-A/B threshold, the ADR-8 20-dispatch window + owner, the
> ADR-6 K-class re-derivation gate, the row schema, the `shadow=absent` convention, the cohort
> counter format, and the deferred ledger-row-completeness-test trigger.
> **NOT authoritative for:** the dispatch-input-check protocol itself (the five K-classes, the
> K6 candidate/adjudicate split, the output grammar) — see
> [`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md). The umbrella
> stage sequence + acceptance + dispatch choreography — see
> [`.claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md`](kickoff.md). Project
> goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Origin:** arch-v2-context-pipeline S-B (ADR-5, ADR-6, ADR-8; design spec
> [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)).
> Header pre-registered **before any row exists** — a threshold written after the data is not a
> threshold. The first row lands in this stage's W5 self-application run
> ([`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) against its
> own S-B kickoff — T15).

---

## Pre-registered header items (BINDING — evaluated by the umbrella orchestrator)

### Item 1 — ADR-5 threshold (bottom-seat re-tier trigger)

**Threshold:** **≥2 of 5 runs** in which the Opus shadow arm finds a K1/K2-class defect the
bottom seat missed → the bottom seat **re-tiers to Opus** (the five K-classes stay; only the
tier moves).

**Owner:** the L2 umbrella orchestrator (the session that dispatches the stages). The
threshold is evaluated after the 5-run shadow-present cohort completes; the outcome is
recorded as a cohort-summary ledger note, never silently applied.

**`shadow=absent` convention (load-bearing — silence never reads as health):** a run whose
Opus shadow arm was unavailable **proceeds**, but is logged `shadow=absent` in the row and
**does NOT count toward the 5-run cohort**. Per
[`autonomous-loop-continuity.md §2`](../../rules/autonomous-loop-continuity.md), a missing
shadow arm is recorded as missing, never hand-waved into a clean run. The cohort is
**shadow-present runs only** — a silent shadow arm is the §2 failure wearing an «all-clear»
mask.

### Item 2 — ADR-8 window + owner

**Window:** **20 role-shaped dispatches** across the arch-v2-context-pipeline umbrella. Any
dispatch that uses the dispatch-input-checker station counts as one row, regardless of stage.

**Owner:** the L2 umbrella orchestrator. After the 20th role-shaped dispatch, the orchestrator
reviews the cohort for K-class demotion candidates (Item 3) and the ADR-5 threshold state
(re-tier or hold), recording the verdict as a ledger note in the cohort-summary row.

**Baseline-capture boundary (load-bearing):** baseline token/cost rows for ADR-8 are captured
by **stage S-D**, not by this ledger. S-B ships only the schema + the header + the instrument
(§「ADR-8 baseline instrument」 below); S-D ships the rows.

### Item 3 — ADR-6 re-derivation gate (K-class demotion)

**Gate:** a K-class with **0 catches across 10+ runs** while costing measurable seat time
**may** be demoted, with the data attached. «May», not «must» — the umbrella orchestrator
judges whether the absence reflects a class that no live defect triggers (benign) or a class
the seat cannot reach (a coverage gap masquerading as clean, T14
[`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md)).

**Earlier «K1/K2 primary, 5/5 incidents» derivation retracted.** ADR-6 (design spec §3) shows
the incident base assigns 2/5 to K1, and the three remaining incidents are exactly the classes
the split demoted. Until **≥10 runs of ledger data** support a fresh split, the five classes
are **equal** — no primary/background tiering inside this ledger.

---

## Row schema (one row per dispatch)

| Column | Type | Notes |
|---|---|---|
| `date` | ISO date | When the dispatch input was checked |
| `stage` | string | e.g. `S-B`, `S-C`, `S-D` |
| `task id` | aif task id | Links to the aif task record (umbrella §4 O-3) |
| `bottom-seat findings by K-class` | structured | K1..K6 counts + file:line evidence per class |
| `shadow-arm findings by K-class` | structured | K1..K6 counts at Opus altitude; `absent` if arm unavailable |
| `diff (found-by-Opus-only)` | structured | K-class + one-line finding for each defect the bottom seat missed |
| `Coverage` | structured | Surfaces reached of surfaces in scope, carried over verbatim from the station's mandatory `Coverage:` output line ([`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) output grammar). A row with zero findings and no coverage statement converts a shallow pass into apparent evidence — log «coverage insufficient» with the unreached surfaces, never «input clean» (T14) |
| `shadow` | enum: `present` / `absent` | `absent` runs do NOT count toward the 5-run cohort (Item 1) |
| `verdict-affecting notes` | free-form | Cohort-window status; defects fixed inline; etc. |

**Rows are appended by the dispatching session**, not by
[`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) itself. The
agent is reporting-only; it produces the paste-ready `DISPATCH-INPUT:` block, the dispatching
session commits the row. The output grammar of the agent (K1-K6 + Coverage + basis lines)
maps 1:1 to the row's K-class columns; the conversion is mechanical.

---

## Cohort counter

| Window | Count | Threshold / cap |
|---|---|---|
| Shadow-present cohort (ADR-5) | **2 / 5** | ≥2 K1/K2-only finds → re-tier |
| Role-shaped dispatches (ADR-8) | **3 / 20** | At cap → orchestrator reviews cohort |

The counters are **live state read from the row set below**, not a recap and not a fixed
starting value: the dispatching session updates this block every time a row lands. They read
`2 / 5` and `3 / 20` at this SHA: Row 1 is `shadow=absent` (ADR-8 only, per the convention),
Rows 2-3 are `shadow=present` and both carry Opus-only K1/K2 finds — see the Rows 2-3 cohort
note for the proxy-bottom-seat caveat on how that evidence reads. That asymmetry is the
whole point of the two counters (T-SB-A): a ledger full of `shadow=absent` rows must never
read as cohort progress. A counter that disagrees with the row set is a ledger bug — fix the
counter, never paper over a row.

---

## Deferred — ledger-row-completeness principle test (umbrella §4 O-4)

A principle test asserting «no empty-verdict rows» over a ledger with zero rows is vacuous,
and a vacuous gate is a permanent noise floor by the same argument ADR-7 uses to drop SOLID.

**Trigger:** the **5th row** lands → ship the row-completeness principle test in **that
stage's PR**, not here. The test asserts every row has a non-empty verdict + at least one
K-class finding (or an explicit `coverage-insufficient` line per T14).

**Why deferred, not shipped now:** a test over zero rows can assert nothing true; shipping it
now would create a permanent green noise floor that masks real future drift (the same shape
[`phase-research-coverage.md §1.6`](../../rules/phase-research-coverage.md) warns about for
coverage gates).

---

## ADR-8 baseline instrument

The aif task record carries `tokenTotal` + `costUsd` fields per dispatch. S-D captures the
baseline rows; S-B ships only the schema and the header. Instrument (verified live
2026-07-31, umbrella §4 O-3 — the aif task record carries the fields):

```bash
curl -s "$RUNTIME_BRIDGE_AIF_URL/tasks" | jq -r '.[] | [.id,.status,.tokenTotal,.costUsd] | @tsv'
```

Baseline rows name their environment (per-environment ceilings, N2).

---

## Rows


### Row 1 — S-B self-application (T15)

| Field | Value |
|---|---|
| `date` | 2026-07-31 |
| `stage` | S-B |
| `task id` | efe91281-2640-49b0-ba61-436c2a8eb628 |
| `bottom-seat` | executor-tier (GLM-5.2 — the dispatching session applied the protocol honestly) |
| `basis` | `.claude/orchestrator-prompts/arch-v2-context-pipeline-s-b/kickoff.md` (298 lines) |
| K1 | 0 findings — 13/13 cited paths resolve (verified via `[ -e "$p" ]` over the kickoff's anchor list) |
| K2 | 0 findings — kickoff:125 curl is past-tense («verified live 2026-07-31»); not a current-runtime reproduction obligation. S-D owns baseline capture. |
| K3 | 0 findings — sibling kickoff `.claude/orchestrator-prompts/arch-v2-context-pipeline-s-a/kickoff.md` shares the `<!-- scope: stage-scoped dispatch input — … -->` shape; S-B matches the pattern. |
| K4 | 0 findings — §4a DOES name where parks go (aif task status `manualReviewRequired`/`blocked_external` with the fork stated). Initial misread corrected. |
| K5 | 1 finding (low, non-blocking) — `RUNTIME_BRIDGE_AIF_URL` env var is depended on (kickoff:125) but undeclared in §0 dispatch facts. Non-blocking: S-B ships the schema/header, not baseline rows; the curl is past-tense. |
| K6 candidates | 0 verdict-lexicon hits in the kickoff's own voice (1 hit at kickoff:80 is the K6 lexicon's own definition, not a verdict); 10 non-goal declarations in §4, all consistent with the body. |
| `Coverage` | **5 of 6 K-classes reached mechanically** (K1 anchors, K2 quoted outputs, K3 sibling pattern, K4 format mechanics, K5 external state). K6 reached only at its **candidate-generator** half — the Opus adjudication arm did not run, so framing bias is **unassessed, not clean**. Per the station's own verdict rule this is `coverage-insufficient` on K6, never «input clean» (T14). |
| `shadow` | **absent** — no Opus cold pass ran alongside. Per Item 1 `shadow=absent` convention, this row does **not** count toward the 5-run ADR-5 cohort. |
| `diff (found-by-Opus-only)` | n/a (shadow absent) |
| `verdict-affecting notes` | **Verdict: GO** with one K5 observation recorded. Per the agent's §Self-application paragraph, a finding against the kickoff is a successful run, not a station failure. The K5 observation is filed in the PR body for maintainer triage; the kickoff is binding per §0 and was not edited. |

**Cohort counter update:** shadow-present cohort remains **0 / 5** (this row is `shadow=absent`).
Role-shaped dispatches: **1 / 20** (ADR-8 window — any dispatch-input-checker run counts).

### Row 2 — token-economy-research-s-a dispatch (round 1)

| Field | Value |
|---|---|
| `date` | 2026-08-01 |
| `stage` | token-economy-research S-A (cross-umbrella dispatch using this station) |
| `task id` | not yet dispatched — row records the pre-dispatch check; verdict forced a kickoff revision before any aif task was created |
| `bottom-seat` | claude-sonnet-5 (PROXY for the executor tier — interactive-session Agent tool cannot run GLM; calibration caveat below) |
| `basis` | `.claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md` @ d081ae2e58 (285 lines) |
| K1 | bottom 0; shadow 1 (kickoff:32 — anchor resolves but the cited §3 does not carry the INCONCLUSIVE-recording proposition) |
| K2 | bottom 1 (kickoff:226 — §2.8 `MEMORY.md 7,738 bytes` vs measured 16,504: fabricated-at-authoring, executor barred from self-correcting); shadow 5 (same MEMORY.md; kickoff:205 «96%» arithmetically impossible — ceiling 88.7% from own table; three inconsistent turn totals 58,341/58,345/58,192; §2.5 omission threshold misstated; §2.7 reproduces only §2.1-§2.2) |
| K3 | bottom 0; shadow 3 (missing §4a park contract, §1.7 PR obligation, See-also — all present in arch-v2 sibling kickoffs) |
| K4 | bottom 1 (host-verify primary command `tsx --test` is the wrong runner, saved by `\|\|` fallback); shadow 4 (W1 item 3 `index ∖ claudeMdExcludes` derivation contradicted by observed session state in BOTH directions — 3 of 7 excludes load anyway, index under-reports; bytes→tokens factor underivable in-container; pricing-verification obligation unowned; markdownlint exits 0 on zero-match glob) |
| K5 | bottom 0; shadow 0 (profile marker exact-unique; staging placement verified by both) |
| K6 candidates | both arms: 0 lexicon hits (stated as not-clean per false-negative class); shadow candidates: §2 pre-states W3's open question as conclusion; «96%» pre-ranks W3 inputs |
| `Coverage` | bottom: all anchors + §2.7 re-run + arithmetic + pricing verified live; NOT reached §2.5/§2.6 per-tool reproduction. shadow: 5/5 K-classes; §2.3-§2.6 declared unreproducible from the inlined block (no aggregator for them was inlined) |
| `shadow` | **present** (claude-opus-5) |
| `diff (found-by-Opus-only)` | K2: «96%» impossibility, turn-total inconsistency, §2.7 partial-reproduction over-claim; K4: claudeMdExcludes divergence (35,197 B of «excluded» rules loading anyway); K1: mis-anchored citation. The bottom seat caught MEMORY.md (the single largest defect) but missed every derived-arithmetic and population-integrity defect. |
| `verdict-affecting notes` | **Verdict: STOP (both arms independently).** Kickoff revised same day (all findings addressed: canonical single-run §2, inlined host-measured always-on population, filename binding, §3a/§1.7/See-also added). **Calibration caveat:** bottom seat ran on claude-sonnet-5, not GLM — this row evidences «cheap-tier seat misses K2-arithmetic defects Opus catches» but NOT the GLM-specific question; count it toward ADR-5 with that caveat recorded. |

### Row 3 — token-economy-research-s-b dispatch (round 1)

| Field | Value |
|---|---|
| `date` | 2026-08-01 |
| `stage` | token-economy-research S-B (cross-umbrella dispatch using this station) |
| `task id` | not yet dispatched — pre-dispatch check; verdict forced a kickoff revision first |
| `bottom-seat` | claude-sonnet-5 (PROXY — same caveat as Row 2) |
| `basis` | `.claude/orchestrator-prompts/token-economy-research-s-b/kickoff.md` @ d081ae2e58 (270 lines) |
| K1 | bottom 0 (15/15 anchors incl. content-level spot-checks); shadow 0 (18/18) |
| K2 | bottom 1 (cosmetic star-count drift 74,185→74,186); shadow 3 (kickoff:173 «96% — 35.2M of 36.6M» impossible — own top-10 rows sum to 39.7M, share ≤88.7%; three inconsistent turn totals; §2.4-vs-§2.5 Edit call/result mismatch) |
| K3 | bottom 0; shadow 1 (stage A and B declared the IDENTICAL host-verify glob while landing concurrently in one directory) |
| K4 | bottom 1 (host-verify glob matches zero files today, markdownlint fails open); shadow 2 (same fail-open compounded by the shared glob — A's file can mask B's absence; principle-10 first-line scope-comment contract undeclared) |
| K5 | bottom 0; shadow 2 (kickoff:196 instructs `claude-code-guide`, container-unreachable per operator memory; kickoff:197-201 states task 53c2ecdd «is producing» — live status `done`, patch not on staging: neither branch of the kickoff's dichotomy holds) |
| K6 candidates | both arms: 0 lexicon hits; both flagged the same bare-priority candidate — RTK receives materially richer favourable framing than candidates 2-4, and §2.5's closing line named RTK as the number's consumer. Adjudicated by the dispatching session (the Opus-altitude framing look this station's split assigns upward): REAL — fixed in revision (framing neutralised, §2.5 line de-named, seed-detail disclaimer added). |
| `Coverage` | bottom 18 of ~20 surfaces; shadow 8 of 11 surface classes (in-container tool availability unprobeable from host; raw transcript sums not re-derived — arithmetic-only) |
| `shadow` | **present** (claude-opus-5) |
| `diff (found-by-Opus-only)` | K2: the «96%» impossibility + turn totals (bottom seat verified anchors and live probes but did not cross-foot the tables); K5: both external-state staleness findings (task status, container tool reality). |
| `verdict-affecting notes` | **Verdict: bottom REVISE / shadow STOP → treated as STOP.** Kickoff revised same day (disjoint globs + `test -f` guards, filename binding, tool fallback, task-state wording, framing neutralised). Same PROXY caveat as Row 2. |

**Cohort counter update (after Rows 2-3):** shadow-present cohort **2 / 5** — and in BOTH runs the
Opus arm found K1/K2-class defects the bottom seat missed, so the ADR-5 threshold condition
(«≥2 of 5») is already MET at 2/5. Evaluation is the umbrella orchestrator's call (Item 1), with
one honesty constraint recorded here: both bottom seats were claude-sonnet-5 PROXIES, not the GLM
executor tier, so the cohort evidences «sub-Opus seat misses derived-arithmetic defects», not the
GLM question ADR-5 pre-registered. Recommended reading (recorded, not applied): run remaining
cohort dispatches with an Opus bottom seat where the dispatching session cannot field a true
executor-tier seat, and let the arch-v2 orchestrator rule on the re-tier.
Role-shaped dispatches: **3 / 20**.

#### Round-2 note for Rows 2-3 (2026-08-01)

Both kickoffs re-checked post-revision by one narrow cold Opus seat each (fresh seats +
round-1 watch-list inlined, per [cold-seat-economy.md §1/§3](../../rules/cold-seat-economy.md)):
**GO / GO** at staging `d22b4f4014` — all watch-list items verified fixed, every §2 table
cross-footed exactly, cross-stage numbers identical. Two non-blocking K5 nits from the S-A seat
(§2.1 truncated share column summing to 98%; row-11 formula lacking a direction-of-error note)
plus one K6 lexical tension from the S-B seat (W4 «ranked proposals» vs §4 «no ranking») were
fixed inline by the dispatching session in the same commit as this note — operator ruled no
round 3; the fixes are the seats' own findings, not new substance. Shadow arms deliberately
absent in round 2 (narrow refresh, not a cohort run — does not count toward ADR-5).
