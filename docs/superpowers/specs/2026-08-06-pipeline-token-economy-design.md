<!-- scope: pipeline-token-economy decision layer — output of the 2026-08-06 /arch external design contour over docs/superpowers/specs/2026-08-06-arch-prep-pipeline-token-economy.md (feat/prune-worktrees). Revision 2 (post cold-review round 1: both seats REVISE; all BLOCKER/MAJOR findings dispositioned in §7). -->

# Pipeline context & token economy — decision layer (2026-08-06, rev 2)

> **Authoritative for:** the decision layer over the 2026-08-06 prep-doc — fork resolutions
> D1/D2/D3/N1/N2 (§1), the config-assertion gate position (§2), the proposal→stage routing
> table (§3), umbrella dispositions (§4), exit routing (§5), review-round-1 disposition (§7).
> **NOT authoritative for:** the measurements — the prep-doc and the research patches own them;
> ADR-1..ADR-8 — [`2026-07-31-arch-v2-context-pipeline-design.md`](2026-07-31-arch-v2-context-pipeline-design.md);
> SSOT verdicts #233/#234 — [`prior-art-evaluations.md`](../../meta-factory/prior-art-evaluations.md);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Current as of 2026-08-06.**

> **Branch note.** `origin/staging` is an ancestor of this branch, so the staging-side inputs
> (ADR spec, distillate, `cold-seat-economy.md`) are readable locally; the prep-doc and the
> 2026-08-02 webresearch corpus live on `feat/prune-worktrees` only. One seat reading one ref
> still finds nothing at some links — resolve cross-branch links deliberately.

**Inputs consumed** (per the prep-doc's §6 reading rule — distillate + addressed sections only,
raw stage material not re-read): the prep-doc; the token-economy distillate; `cold-seat-economy.md §3`;
SSOT #233 (RTK) + #234 (L2 verdict); the RTK empirical test
([`2026-08-02-rtk-empirical-test.md`](../../meta-factory/research-patches/2026-08-02-rtk-empirical-test.md));
`2026-08-02-superpowers-vs-trio.md §B` + `2026-08-02-webresearch-anthropic-first-party-plugins.md §10`
(feat/prune-worktrees). **Operator resolutions taken in-session 2026-08-06:** D1 = trim
`CLAUDE.md` (bounded, §1), keep `ai-laziness-traps.md` whole. **Preconditions verified live:**
`fidelity-verdict-in-pr-body` is a registered required check on staging (`gh api` → `ci-success`,
`fidelity-verdict-in-pr-body`); `scripts/check-alwayson-budget.sh` exists with a 101,000 B
ceiling (`check-alwayson-budget.sh:8`) and is not wired to pre-push;
`scripts/measure-always-on.sh` enumerates rules ignoring `claudeMdExcludes` (structurally blind
to the P1 defect class).

**Denominator convention (binding for every share below).** Two profiles coexist and are NOT
mutually convertible: **[W]** = the re-priced 169-session/43,983-turn corpus (READ 44.7% /
WRITE 43.1% / output 11.7%); **[D]** = the 247-transcript stage-A accounted subset
(D = 1,170,235 cost-units/median session; its own §1 caveat: an over-statement relative to the
total bill). Every share is tagged. Untagged percentages are a defect.

## §0 Stance

No parallel structure. Every proposal below lands in an existing or explicitly added stage of
the OPEN `arch-v2-context-pipeline` umbrella, in one operator edit, or in a separately-owned
track. Inventing a sibling structure next to ADR-1..ADR-8 would be `#parallel-evolution-creep`
applied to our own planning ([`build-first-reuse-default.md §4`](../../../.claude/rules/build-first-reuse-default.md)).

## §1 Fork resolutions

Format per fork: resolution → grounds → falsifier («wrong if»).

| # | Fork | Resolution | Grounds | Wrong if |
|---|---|---|---|---|
| D1 | Always-on head trim | **Bounded trim of `CLAUDE.md`; keep `ai-laziness-traps.md` whole.** Trim scope = ONLY (a) prose duplicating another authoritative home (pointer exists or is one line away) and (b) prose whose enforcement is mechanical (pre-push/principle test/hook). **Judgment-bearing sections are a keep-list, out of trim scope** — e.g. Task-tier routing (`CLAUDE.md:106` «a judgment, never an automated classifier»), the marker-value rule (`:132` «belt-and-braces», 3 recurrences), PR strategy, un-gated operational conventions. The keep-list is authored INTO the executing kickoff by the planning seat; the trim is not a blanket pointer-collapse. Operator-resolved 2026-08-06; bounds added at review round 1 (TD-B2). | The mechanical-enforcement argument holds only for the gated share of the file; the #1188 hot/cold split already banked the easy half, so remaining headroom is the duplicated/gated share only. `ai-laziness-traps.md`'s force is behavioural — residency IS its channel; a trim's failure mode is silent and no byte-gate detects it. `AGENTS.md` (8,861 B vs 23,740 B) is the pointer-form *pattern*, not a size target — target is set at kickoff time against the keep-list. | A post-trim session bypasses a convention the trimmed prose was carrying → the pointer form under-carries; restore that section. Revisit the traps trim only after S-E's gate ships + an incident-free month. |
| D2 | Measure-first vs ship-cheap-first | **Ship-cheap-first; the N2 measurement rides S-E as its input, not as a standalone prior stage.** | The P1 fix and stage dispositions depend on nothing unmeasured (cause identified, cost measured). The only consumer of per-turn attribution numbers is S-E's gate (ADR-3 requires measured output + the `InstructionsLoaded` verification task). | A decision surfaces that needs N2's numbers before S-E dispatches → split N2 out as its own Tier-1 stage. |
| D3 | Plugin thread | **(a) CC-plugin adapter → NOT this contour: separate /arch (capability commit, positioning call, own BFR pass — plugins patch §10 item 3 is its input). (b) Channel split resolved per the operator's §B3 delegation: `engineering` + `system-design` → preset-option for backend presets; `design` → preset-option for UI presets; `tech-debt` + `standup` → user-scope; `product-management` → not shipped (REJECT stands). (c) `security-guidance` mining → STUDY item in the adapter contour. (d) Operator-axis: adopt the `engineering:architecture` ADR template as the /arch §1 spec-format slot, thin-wrapper (trio §A2 G1) — P12.** Token angle closed: coexistence ≈ 1,402 est-tokens, NOT a binding constraint (trio §A4). | §B1 per-subplugin verdicts are round-2 operator-validated; §B3 explicitly defers the channel split to this contour. 1-button only where the preset's majority needs it. | A preset consumer cohort measurably wants `tech-debt`/`standup` by default → promote those rows to the preset manifest. |
| N1 | Re-write triggers (WRITE 43.1% [W]) | **Discipline + measurement, no new structure.** (a) Resume-as-expensive already codified (`cold-seat-economy.md §3`). (b) Add to the same skill-embeds: prefer artifact handoff to a fresh seat over `/compact`; do not stretch a seat across the 1-hour TTL idle gap. (c) Size each trigger class (TTL expiry / `/compact` / resume) inside S-E's N2 measurement. | WRITE splits into an unavoidable part (every new token written once at 2×) and an avoidable part — full prefix re-writes on the ~5% genuine full-rewrite turns, each costing an entire prefix. This attacks the **trigger**, not the payload (prep-doc §7 item 2). | N2 measures avoidable re-writes at <5% of the WRITE line → the discipline text is empty; retire it. |
| N2 | Dispatch inlining — discipline or gate? | **Default-in-template, not a gate.** Inlined-dispatch format becomes the documented default of the dispatcher/harvest dispatch templates (where the cold-seat-economy embed already sits). Promotion trigger: 3 incidents of a seat burning >100k tokens on file-reading turns → mechanical check in S-B's bottom-seat station. | A hard gate is `#gate-where-judgment-needed`; bare prose is `#hope-as-gate`. Measured stake: 85,855 vs 177,105 tokens per seat (~52%, `cold-seat-economy.md §3`). | The promotion trigger fires → build the mechanical check; OR inlined dispatches start missing regressions a file-reading seat catches. |

**Dropped with evidence — L1 (Bash/Read output economy):** RTK empirical test measured 1.8% of
total weighted cost on our real mix (9.4% of Bash bytes; 71% of our Bash calls are compound
commands RTK refuses to rewrite) — below the 5% falsifier threshold; the 1.8% inherits the
pre-repricing denominator, but no plausible re-basing moves it near the threshold. Config-only
variant shares the ceiling. Re-entry trigger recorded in SSOT #233.

## §2 The generalisable position (prep-doc §7 item 6)

**Build the config-assertion gate — it is ADR-3/S-E subject matter, not a new idea.** Corrected
narrative (review round 1, TD-M4): the failure signal was not entirely absent — the absolute-glob
hypothesis has sat queued as S-F charter item 4 (E-4) since 2026-07-31. What failed is the
**channel**: a queued hypothesis is `#warning-nobody-reads` with extra steps — detection existed
but nothing failed loudly, so the defect survived a research stage, a cold review, and a
root-cause session ([`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md)
in config form). Config is a rule; rules get executable tests at the earliest reachable channel.
**P2 consumes S-F item 4** — at execution, both kickoffs cross-reference so the hypothesis is
not resolved twice.

Two deterministic asserts, **behavioural, not form-proxy** (round-1 correction, BU-M2 + TD-M5 —
`**/` entries match thanks to picomatch semantics against absolute paths, NOT the normaliser,
whose only job is absolutising `/`-prefixed entries; a prefix-form check would wrongly reject
the one form proven to work):

1. **Committed-list liveness (CI-reachable principle test):** evaluate every
   `claudeMdExcludes` entry in `.claude/settings.json` with picomatch itself (absolute paths,
   `{dot:true}` — the same semantics the client ships) against the repo file tree; any entry
   matching 0 files fails the test. This catches relative-form entries, typos, and renamed
   rules alike, and survives pattern-form evolution.
2. **Local-shadow detection (host-only → pre-push + `worktree-doctor`):** if
   `.claude/settings.local.json` defines `claudeMdExcludes`, the local list's picomatch
   match-set must be a superset of the project list's match-set (computed behaviourally, not
   by string comparison) — otherwise error-with-escape-token. CI cannot see this file;
   pre-push is its earliest reachable channel.
3. **Semantic backstop (outcome channel):** asserts 1-2 share one residual risk — our
   picomatch diverging from the client's bundled matcher. The backstop is P3's
   `InstructionsLoaded`-based measurement: an entry asserted-excluded but observed loaded
   turns the budget gate red. Asserts catch config rot at commit time; the measurement
   catches semantics drift at run time. Both channels are named; neither is bare attention.

This is the contour's **cheaply-killable proposal** (prep-doc §7 item 3): if the harness
changes matching semantics, the backstop fires and the asserts get re-derived.

**Consumer-impact correction carried loudly (TD-M9):** the distillate's «does not affect
shipped consumers» is REVERSED by the prep-doc's mechanism finding — a consumer, container, or
CI runner WITHOUT the local overlay reads the committed 7-entry inert list and gets **zero
eviction** (every «excluded» rule loads). The committed default is the product; this raises
P1's priority and enters the S-E kickoff as fresh evidence.

## §3 Proposals → stage routing, each with its cost line

| # | Proposal | Lands in | Cost line attacked | Size (denominator tagged) |
|---|---|---|---|---|
| P1 | Config fix, remaining half: **operator edits committed `.claude/settings.json`** — 7 entries → `**/<name>.md` glob form. The `settings.local.json` half is ALREADY APPLIED (2026-08-06, three worktrees, verified 7/7 glob-form live). After the committed fix merges, drop the now-redundant local key (it would otherwise mask future committed-list rot — the original defect shape, one layer up). | **operator** (agent-uncommittable) | READ + WRITE | measured 15.9% [D] (8.8k tokens × residency) |
| P2 | Config-assertion gate (§2: asserts 1-2 + backstop wiring) | **S-E** | same line — recurrence insurance | gate cost ~0; protects P1's saving; consumes S-F item 4 |
| P3 | Budget gate per ADR-3: **REUSE `scripts/check-alwayson-budget.sh` (101,000 B ceiling) — wire into pre-push + per-environment ceilings** rather than building new; **fix `measure-always-on.sh` blindness** (it ignores `claudeMdExcludes`, so it cannot see P1-class defects); + N2 measurement as input (re-write trigger class sizes, arrival-position, edit-time-injection firing rates) + `InstructionsLoaded` verification task | **S-E** | READ + WRITE (ceilings) | per ADR-3's post-falsifier scope: repo-owned always-on share only |
| P4 | S-D closure: **status edit in the umbrella kickoff stage table** («S-D — CLOSED-NULL 2026-08-06 per SSOT #234; re-open triggers live there») + **ADR-8 disposition recorded in the same edit and in `calibration.md`'s header**: the per-role experiment never runs because the shaping channel was never built; ADR-8's falsifier folds into #234's trigger set (no orphaned ADR). **NEVER a stage-level `done.md`** — `priority-score.sh` C3 treats `<umbrella>/done.md` existence alone as whole-umbrella closure (`priority-score.sh:23-25,122-126`); the umbrella's `done.md` is written only when the LAST stage merges. | **S-D** (bookkeeping) | — | — |
| P5 | Bounded `CLAUDE.md` trim per D1 (keep-list mandatory in kickoff) | **S-G** (new stage, below) | READ + WRITE | `CLAUDE.md` = 16.7% of always-on cost [D]; trim headroom = duplicated/gated share only, sized at kickoff time (post-#1188 baseline) |
| P6 | Re-write-trigger discipline text (N1b) into the existing cold-seat-economy skill-embeds. `.claude/rules/*` is maintainer-owned (Artifact Ownership Contract) → lands as a **proposed diff in the stage PR, maintainer reviews/merges** — the handoff IS the review, never a silent session edit. | **S-G** | WRITE 43.1% [W] — the **trigger**, not the payload | unsized until N2 (falsifier in §1) |
| P7 | Inlined-dispatch as template default (N2) | **S-G** | WRITE + output [W] | ~52% per cold seat, measured |
| P8 | `Channel(s)` truth: fix at the **source of truth** and regenerate — `00-rule-index.md` is generated («do not hand-edit», regen `npx tsx scripts/render-rule-index.mjs --write`); the fix edits rule frontmatter/renderer inputs, then regens | **S-G** | honesty of the L1 inventory | Tier-1 |
| P9 | Trio channel-split wiring (D3b) — `companions.manifest` / `preset.meta.json` rows | **companion/beta track, Tier-1** — NOT this umbrella | none (≈1.4k est-tokens, not binding) | — |
| P10 | CC-plugin adapter + `security-guidance` mining | **separate /arch contour, later** | none (positioning) | — |
| P11 | **Probe (prep-doc §6, never run): do `Explore`/`Plan` subagents load `.claude/rules/` at all?** One measured session each, host-side. Outcome lands as evidence beside the per-role closure: if they skip rules, a native per-role filter already ships and several L-table proposals were solving a solved problem. | **S-E** (rides the measurement pass) | READ [W] (scoping) | cheap; unblocks nothing (closure stands on #234) but prices it |
| P12 | Operator-axis ADOPT: `engineering:architecture` ADR template wired as /arch §1's spec-format slot (thin-wrapper, trio §A2 G1) | **S-G** | none (quality, not cost) | cheap text edit |

**S-G — new small stage under the umbrella** (round-1 fix, TD-M8): S-F's charter is closed
(«no scope beyond the four items», Tier-1, dispatched at token-audit S2 timing) — appending
P5-P8/P12 to it would violate its own acceptance line. S-G = «economy small-fixes 2»: Tier-1,
one PR, items P5-P8 + P12, maintainer-handoff protocol for every `.claude/rules/*` surface,
kickoff carries the D1 keep-list. Not parallel structure: a sibling stage inside the owning
umbrella, same pattern as S-F itself.

## §4 Umbrella dispositions (prep-doc §0 requirement)

| Umbrella | Disposition |
|---|---|
| `arch-v2-context-pipeline` | **ADVANCES.** S-D → closed-null via kickoff status edit + ADR-8 disposition (P4; explicitly NOT a `done.md`). S-E → strengthened: P2 + P3 + P11 with the §3 finding and the consumer-impact correction as fresh kickoff evidence. S-F → untouched (charter closed; its item 4 is consumed by P2 with cross-references). S-G → added (P5-P8, P12). Umbrella `done.md` only when the last stage merges. |
| `per-role-context-cold-verify` | **CLOSES.** The design its header reserved for «a later /arch session» is this contour's verdict: per-role L2 is not built — SSOT #234's DEFER/null stands, no fresh evidence moves any trigger; P11's probe prices the native-filter question without blocking closure. This umbrella closes fully → its own `done.md` is correct here (whole-umbrella semantics). |
| research-patch trio / plugin thread | **ADVANCES + routed.** Token question closed (§A4, not binding); channel split resolved (D3b); operator-axis ADR-template adoption (P12); adapter + security-guidance mining routed to their own contour (P10). Out-of-scope observation, not acted on: the 2026-08-02/-06 corpus lives only on `feat/prune-worktrees` and needs harvesting to staging. |

## §5 Exit routing (/arch §3)

- **Operator, manual (highest-value):** P1 — the committed `.claude/settings.json` half (the
  local half is already applied). One edit; P2 then prevents recurrence. Routed to operator
  because the file is agent-uncommittable (two agent edit attempts were correctly refused).
- **Factory-bound:** the S-E kickoff (P2 + P3 + P11) is Tier-2; the design judgment is spent
  here, so once plan-complete AND this spec's cold review returns GO, it dispatches WITH the
  `bridge-profile` marker (precondition verified ACTIVE). S-G is Tier-1 with the D1 keep-list
  authored in.
- **Bookkeeping:** P4 status edit (never a stage `done.md`); umbrella-closure `done.md` for
  `per-role-context-cold-verify`; correct the stale session memory («operator deleted the
  local key 2026-08-01» — false: the key exists and now carries the 7-entry glob form).
- **Deferred contours:** P9 (companion track), P10 (separate /arch).

## §6 §1.7 self-reflexive note

**Forward-check.** [`build-first-reuse-default.md §1.1`](../../../.claude/rules/build-first-reuse-default.md):
no BUILD anywhere — P2 rides existing test infra, P3 explicitly REUSES `check-alwayson-budget.sh`
instead of a new gate (round-1 own-stack correction), RTK stays DEFER (#233), L2 stays un-built
(#234), P12 is ADOPT-on-operator. [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md):
every new check is a deterministic gate or a named measurement channel; §2's backstop names its
consumer. [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md): all proposed
gates deterministic. T20: every §1 resolution carries grounds + falsifier; deliberately unsized
quantities say so. **Backward-check.** Class = *artefacts that rank/size/adjudicate
context-economy levers*: distillate — superseded on open forks only (measurements stand; its
consumer-impact claim corrected LOUDLY in §2); prep-doc — consumed, §5 forks resolved;
SSOT #233/#234 — cited, unchanged; `cold-seat-economy.md` — extended prospectively via P6's
handoff; `session-start-token-audit` (closed) — its banked trim is P5's baseline;
umbrella kickoff — P4 edits its stage table (planning-session-owned surface, in-contract).
**Self-application (T15).** This spec is consumed once by stage kickoffs — never always-on;
the contour itself ran on distillate + addressed sections only (P7's discipline applied to its
own production), and its own review round was two cold seats + this disposition (§7).

## §7 Review disposition — round 1 (2026-08-06)

Both cold seats returned REVISE. Every BLOCKER/MAJOR and its fix:

| Finding | Fix in rev 2 |
|---|---|
| TD-B1 stage `done.md` closes whole umbrella (`priority-score.sh` C3) | P4 rewritten: kickoff status edit, `done.md` banned at stage level, umbrella `done.md` at last-stage merge |
| TD-B2 D1 grounds false for judgment-bearing `CLAUDE.md` prose | D1 re-bounded: trim = duplicated/gated share only; mandatory keep-list in S-G kickoff |
| BU-M1 P1 half already applied; spec prescribed a done edit | P1 = committed half only; local state recorded; post-merge local-key drop sequenced |
| BU-M2 + TD-M5 assert-1 mechanism misattribution / form-proxy | §2 asserts rebuilt behavioural (picomatch match-set), + InstructionsLoaded semantic backstop |
| TD-M3 own-stack: existing budget/measure scripts ignored | P3 = REUSE + wire + fix `measure-always-on.sh` blindness |
| TD-M4 «no failure signal» contradicted by queued S-F item 4 | §2 narrative corrected (channel failure, not detection absence); P2 consumes item 4 |
| TD-M6 P8 hand-edits a generated file | P8 routed via source-of-truth + regen |
| TD-M7 prep-doc §6 probe dropped | P11 added (rides S-E) |
| TD-M8 S-F charter violation + rules ownership | S-G stage added; maintainer-handoff protocol for `.claude/rules/*` |
| TD-M9 falsified distillate consumer claim left live | §2 correction paragraph; enters S-E kickoff evidence; memory fix in §5 |
| TD note: ADR-8 orphaned by S-D closure | ADR-8 disposition recorded in P4 |
| Minors (denominators, P5 model wording, branch-hazard, superset definition, RTK denominator) | Denominator convention added ([W]/[D] tags); D1 model reworded; branch note softened; assert-2 superset defined behaviourally; RTK caveat noted |

## See also

- prep-doc: `docs/superpowers/specs/2026-08-06-arch-prep-pipeline-token-economy.md` (feat/prune-worktrees).
- [`2026-07-31-arch-v2-context-pipeline-design.md`](2026-07-31-arch-v2-context-pipeline-design.md) — ADR-1..ADR-8.
- [`2026-08-01-token-economy-distillate.md`](../../meta-factory/research-patches/2026-08-01-token-economy-distillate.md) — measurements + lever table.
- [`2026-08-02-rtk-empirical-test.md`](../../meta-factory/research-patches/2026-08-02-rtk-empirical-test.md) — the L1 kill evidence.
- `2026-08-02-superpowers-vs-trio.md` §B, `2026-08-02-webresearch-anthropic-first-party-plugins.md` §10 (feat/prune-worktrees) — the D3 evidence base.
- Cold-review reports (round 1): scratchpad `top-down-pipeline-token-economy.md`, `bottom-up-pipeline-token-economy.md` (session-local artefacts).
