<!-- scope: pipeline-token-economy decision layer — output of the 2026-08-06 /arch external design contour over docs/superpowers/specs/2026-08-06-arch-prep-pipeline-token-economy.md (feat/prune-worktrees). Revision 3: round-2 narrow re-check findings (3 MAJOR + 4 MINOR) dispositioned in §7, PLUS the operator override of 2026-08-06 (S-D reopened as subtractive per-seat maps; harness-remainder taken into scope; expensive-seat economy principle recorded). -->

# Pipeline context & token economy — decision layer (2026-08-06, rev 3)

> **Authoritative for:** the decision layer over the 2026-08-06 prep-doc — economy principle
> (§0.5), fork resolutions D1/D2/D3/N1/N2 + the per-role reopen (§1), the config-assertion gate
> position (§2), the proposal→stage routing table (§3), umbrella dispositions (§4), exit
> routing (§5), review disposition (§7).
> **NOT authoritative for:** the measurements — the prep-doc and the research patches own them;
> ADR-1..ADR-8 — [`2026-07-31-arch-v2-context-pipeline-design.md`](2026-07-31-arch-v2-context-pipeline-design.md);
> SSOT verdicts #233/#234 — [`prior-art-evaluations.md`](../../meta-factory/prior-art-evaluations.md);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Current as of 2026-08-06.**

> **Branch note.** `origin/staging` is an ancestor of this branch, so the staging-side inputs
> (ADR spec, distillate, `cold-seat-economy.md`) are readable locally; the prep-doc and the
> 2026-08-02 webresearch corpus live on `feat/prune-worktrees` only. One seat reading one ref
> still finds nothing at some links — resolve cross-branch links deliberately.

**Inputs consumed** (per the prep-doc's §6 reading rule): the prep-doc; the token-economy
distillate; `cold-seat-economy.md §3`; SSOT #233 + #234; the RTK empirical test
([`2026-08-02-rtk-empirical-test.md`](../../meta-factory/research-patches/2026-08-02-rtk-empirical-test.md));
`2026-08-02-superpowers-vs-trio.md §B` + `2026-08-02-webresearch-anthropic-first-party-plugins.md §10`
(feat/prune-worktrees). **Operator resolutions taken in-session 2026-08-06:** D1 = trim
`CLAUDE.md` (bounded), traps whole (sub-fork D1b OPEN, §1); per-role REOPENED as subtractive
(§1.5); harness remainder in scope (P14). **Preconditions verified live:**
`fidelity-verdict-in-pr-body` required on staging (`gh api`); `scripts/check-alwayson-budget.sh`
exists (101,000 B ceiling, `:8`), unwired to pre-push; `scripts/measure-always-on.sh` ignores
`claudeMdExcludes` (blind to the P1 defect class); `scripts/probe-channels.sh` exists (channel
source of truth for P8); `picomatch` is NOT an explicit dependency (`npm ls picomatch` → empty;
transitive only, two majors in tree).

**Denominator convention (binding).** Three tags, none convertible: **[W]** = re-priced
169-session corpus (READ 44.7% / WRITE 43.1% / output 11.7% of total weighted spend); **[D]** =
stage-A accounted subset (D = 1,170,235 cost-units/median session; an over-statement vs the
total bill); **[A]** = share of the always-on doc bill (754,884 units [D]-scale). Untagged
percentages are a defect.

## §0 Stance

No parallel structure. Every proposal lands in an existing or explicitly added stage of the
OPEN `arch-v2-context-pipeline` umbrella, in one operator edit, or in a separately-owned track
(`#parallel-evolution-creep` guard, [`build-first-reuse-default.md §4`](../../../.claude/rules/build-first-reuse-default.md)).

## §0.5 Economy principle (operator directive, 2026-08-06 — binding for lever ranking)

**Optimise the resident head of the EXPENSIVE CC seats (top/mid tier — Fable, Opus) FIRST; the
aif executor seats (GLM) are lower-priority, not exempt.** This is a priority ordering, not a
hard boundary (operator clarification 2026-08-06): economise where tokens are dearest first.
Grounds: (a) the cost constraint is CC-side — executor-tier tokens in aif are plentiful,
top-tier CC tokens are the scarce resource (the aif dispatch layer exists precisely to spare
them); (b) the guidance gradient runs the other way — a weaker executor needs MORE resident
instruction and oversight, a stronger seat needs less. Today's uniform load inverts this: the
full disciplinary corpus is resident in the most expensive seat. Every lever below is ranked
for expensive-seat effect first; executor-side residency trims are legitimate later work, with
the guidance gradient as their guard-rail (never starve the weaker seat of instruction).

## §1 Fork resolutions

Format per fork: resolution → grounds → falsifier («wrong if»).

| # | Fork | Resolution | Grounds | Wrong if |
|---|---|---|---|---|
| D1 | Always-on head trim | **Bounded trim of `CLAUDE.md`; D1b RESOLVED (2026-08-06, operator-delegated): traps → resident hot digest.** `CLAUDE.md` trim mechanism: **dedupe the shared core via `@AGENTS.md` import** (CC inlines `@`-imports at load; goal/rule-index/Step-0 live once, in the portable file) + keep the CC-only share in place; **judgment-bearing sections are a keep-list, out of trim scope** (`CLAUDE.md:106` tier routing «a judgment, never an automated classifier»; `:132` marker-value «belt-and-braces»; PR strategy; un-gated operational conventions). Keep-list authored INTO the executing kickoff. ZCode check rides the stage: if `@`-import is not honoured there, document the degradation (zcode-parity doctrine), do not block the trim. **D1b:** expensive seats get a hot digest (T-numbers + one-line counters, ~2k vs 6.6k tokens); full catalogue re-scoped to `paths:` (fires edit-time on rule/kickoff/research-patch authoring — the earliest reachable channel for exactly the work traps bite); executor channel already mechanical (principle test 12 fails any kickoff without trap enumeration); **anti-drift gate:** a deterministic test asserts every §2 T-number has a digest line. | The mechanical-enforcement argument holds only for the gated share; #1188 banked the easy half. ~2/3 of `CLAUDE.md` is CC-only content AGENTS.md deliberately lacks — full unification would bloat the portable file. D1b's ground is §0.5: the full lazy-executor manual resident in the smartest seat is the inversion; savings ≈ 9% [A]. | A post-trim session bypasses a convention the trimmed prose carried → restore that section. **D1b rollback trigger: ONE incident of a senior-seat session committing a trap the digest under-carried → full residency restored, incident recorded.** |
| D2 | Measure-first vs ship-cheap-first | **Ship-cheap-first; N2 measurement rides S-E as its input.** | P1 and stage dispositions depend on nothing unmeasured. The only consumer of per-turn attribution is S-E's gate (ADR-3). | A decision needs N2's numbers before S-E dispatches → split N2 into its own Tier-1 stage. |
| D3 | Plugin thread | **(a) CC-plugin adapter → separate /arch (capability commit, positioning; plugins patch §10 item 3 is its input). (b) Channel split per the operator's §B3 delegation: `engineering` + `system-design` → preset-option backend; `design` → preset-option UI; `tech-debt` + `standup` → user-scope; PM not shipped. (c) `security-guidance` mining → STUDY in the adapter contour. (d) Operator-axis ADOPT: `engineering:architecture` ADR template as /arch §1's spec-format slot, thin-wrapper (trio §A2 G1) — P12.** Token angle closed: ≈1,402 est-tokens, not binding (trio §A4). | §B1 verdicts round-2 operator-validated; §B3 defers the split here. | A preset cohort measurably wants `tech-debt`/`standup` by default → promote to manifest. |
| N1 | Re-write triggers (WRITE 43.1% [W]) | **Discipline + measurement, no new structure.** (a) Resume-as-expensive codified (`cold-seat-economy.md §3`). (b) Skill-embed additions: prefer artifact handoff to a fresh seat over `/compact`; do not stretch a seat across the 1-hour TTL idle gap. (c) Trigger-class sizing inside S-E's N2. | WRITE = unavoidable first-writes (2× each new token) + avoidable full prefix re-writes (~5% of turns, each a whole prefix). Attacks the **trigger**, not the payload. | N2 measures avoidable re-writes <5% of the WRITE line [W] → retire the discipline text. |
| N2 | Dispatch inlining | **Default-in-template, not a gate.** Promotion trigger: 3 incidents of a seat burning >100k tokens on file-reading turns → mechanical check in S-B's bottom-seat station. | Hard gate = `#gate-where-judgment-needed`; bare prose = `#hope-as-gate`. Stake: 85,855 vs 177,105 tokens/seat (~52%). | Trigger fires → build the check; OR inlined dispatches miss regressions a file-reading seat catches. |

**Dropped with evidence — L1 (Bash/Read output economy):** RTK empirical 1.8% of total weighted
cost on our mix (9.4% of Bash bytes; 71% compound commands) — below the 5% falsifier; inherits
the pre-repricing denominator, but no re-basing approaches the threshold. Re-entry trigger in
SSOT #233.

## §1.5 Per-role — REOPENED, re-scoped subtractive (operator override 2026-08-06)

**What stands:** SSOT #234's DEFER/null for the question it actually adjudicated — building an
**additive** authored per-role ambient layer (5 injection-channel options). No fresh evidence
moves that.

**What reopens:** the operator declared the #234 re-open trigger (a) fired — the metered-seat
incident is the operator's own expensive-seat budget exhaustion in CC, documented this session.
The reopened scope is NOT the old L2: it is **per-seat subtraction maps** — which
already-loading blocks each CC seat class can DROP. Subtraction is the direction the external
evidence favours (Anthropic 2026-07-24 subtractive result), so the earlier «evidence points
away» reading does not apply to this scope. Mechanisms all native (own-stack-first): review
subagents → custom agent definitions whose system prompt REPLACES CC's (C2), carrying
reviewer-discipline + verdict grammar instead of the full operational head; Explore/Plan →
P11's probe prices what they already skip; senior main seat → P1 + P5 + rule channel
re-scoping (the #1188 pattern); **aif GLM seats → deferred by §0.5's priority ordering**
(cheap tokens + the guidance gradient make them last in line, not off the table). **ADR-8 is not orphaned — it is inherited:** S-D′'s rollout runs under ADR-8's
own experiment protocol (baseline before merge, 20-dispatch window, deterministic A/B branch,
owner closes with a verdict PR), now measuring subtractive shaping instead of additive.
**Stage: S-D′** (P13). The SSOT #234 row gets a trigger-fired annotation at S-D′ dispatch, per
its own protocol.

## §2 The generalisable position (prep-doc §7 item 6)

**Build the config-assertion gate — ADR-3/S-E subject matter.** Corrected narrative (round 1):
the failure signal was not absent — the absolute-glob hypothesis sat queued as S-F charter
item 4 (E-4) since 2026-07-31. What failed is the **channel**: a queued hypothesis is
`#warning-nobody-reads` with extra steps ([`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md)
in config form). Config is a rule; rules get executable tests at the earliest reachable
channel. **P2 consumes S-F item 4** — the same P4 commit marks it consumed in the S-F charter
(cross-reference both ways).

Two deterministic asserts, **behavioural, not form-proxy** (`**/` entries match thanks to
picomatch semantics against absolute paths, NOT the normaliser, which only absolutises
`/`-prefixed entries — a prefix-form check would reject the one form proven to work):

1. **Committed-list liveness (CI-reachable principle test):** evaluate every
   `claudeMdExcludes` entry in `.claude/settings.json` with picomatch (absolute paths,
   `{dot:true}`) against the repo file tree; any entry matching 0 files fails.
2. **Local-shadow detection (host-only → pre-push + `worktree-doctor`):** if
   `.claude/settings.local.json` defines `claudeMdExcludes`, the local list's picomatch
   match-set must be a superset of the project list's match-set (behavioural, not string
   comparison) — else error-with-escape-token. CI cannot see this file; pre-push is its
   earliest reachable channel.
3. **Semantic backstop (outcome channel):** residual risk = our picomatch diverging from the
   client's bundled matcher. Primary backstop: P3's `InstructionsLoaded`-based measurement (an
   entry asserted-excluded but observed loaded → gate red). **Fallback if `InstructionsLoaded`
   proves unobservable** (its blocking/observability is exactly what P3's verification task
   tests): the post-P3 `measure-always-on.sh` — once its `claudeMdExcludes` blindness is fixed
   it computes the expected-excluded set itself and diffing its output against a live session
   inventory serves as the outcome check. Both channels named; neither is bare attention.

**Dependency honesty (round-2 N-2):** the asserts need `picomatch` as an **explicit pinned
devDependency** (today it is transitive-only, two majors in the tree — an unpinned transitive
matcher is exactly the semantics-drift risk the backstop exists for). That makes P2 a
**capability commit**: it carries a `Prior-art:` trailer (verdict ADOPT verbatim — picomatch IS
the upstream the shipped client bundles; SSOT entry added in the same commit per the
build-vs-reuse invariant), and pins the major to match the client's.

This remains the contour's **cheaply-killable proposal**: if matcher semantics change, the
backstop fires and the asserts get re-derived.

**Consumer-impact correction carried loudly:** the distillate's «does not affect shipped
consumers» is REVERSED — a consumer, container, or CI runner WITHOUT the local overlay reads
the committed inert list and gets **zero eviction**. The committed default is the product;
this raises P1's priority and enters the S-E kickoff as fresh evidence.

## §3 Proposals → stage routing, each with its cost line

| # | Proposal | Lands in | Cost line attacked | Size |
|---|---|---|---|---|
| P1 | Config fix, remaining half: **operator edits committed `.claude/settings.json`** — 7 entries → `**/<name>.md`. Local half ALREADY APPLIED (2026-08-06, three worktrees, 7/7 glob verified). After the committed fix merges, drop the redundant local key. | **operator** | READ + WRITE [W] | 15.9% [D] measured |
| P2 | Config-assertion gate (§2 asserts 1-2 + backstop). Capability commit: picomatch pinned explicit devDep + `Prior-art:` trailer + SSOT entry. | **S-E** | recurrence insurance on P1's line | ~0 run cost; consumes S-F item 4 |
| P3 | Budget gate per ADR-3: **REUSE `check-alwayson-budget.sh` — wire into pre-push + per-environment ceilings**; fix `measure-always-on.sh` blindness; N2 measurement (re-write trigger classes, arrival-position, edit-time-injection firing rates); `InstructionsLoaded` verification task | **S-E** | READ + WRITE [W] ceilings | repo-owned always-on share only (ADR-3 post-falsifier scope) |
| P4 | **One umbrella-kickoff commit** (planning-session-owned surface): (a) S-D stage-table row → CLOSED-NULL for the ADDITIVE scope per SSOT #234 + S-D′ row added (P13) with its charter; (b) **S-D charter prose rewritten** — the «L2-closure PR (retirement note + `done.md`, no build)» instruction DELETED (kickoff:176-177): a stage-level `done.md` closes the whole umbrella (`priority-score.sh:140,255-263` — C3 file-existence is the closure signal; `:23-25,122-126` document it); (c) S-G row + Ordering slot + marker values for S-G/S-D′ (`Z.AI GLM-5.2 SDK`, re-verified unique at dispatch per the CLAUDE.md marker-value rule); (d) S-F item 4 marked consumed-by-P2. Umbrella `done.md` only when the LAST stage merges. | **S-D/S-G bookkeeping** | — | — |
| P5 | Bounded `CLAUDE.md` trim per D1 (`@AGENTS.md` core-dedupe + CC-only keep + keep-list; ZCode `@`-import degradation check) **+ D1b traps digest** (digest authored + full catalogue re-scoped to `paths:` + anti-drift test + rollback trigger) | **S-G** | READ + WRITE [W] | `CLAUDE.md` = 16.7% [A], headroom = duplicated/gated share, sized at kickoff (post-#1188 baseline); traps digest ≈ 9% [A] |
| P6 | Re-write-trigger discipline text (N1b) into cold-seat-economy skill-embeds. `.claude/rules/*` maintainer-owned → **proposed diff in the stage PR, maintainer reviews/merges**. | **S-G** | WRITE 43.1% [W] — the trigger | unsized until N2 |
| P7 | Inlined-dispatch as template default (N2) | **S-G** | WRITE + output [W] | ~52%/cold seat measured |
| P8 | `Channel(s)` truth: fix at source (`scripts/probe-channels.sh` is the channel source of truth; rule frontmatter/renderer inputs) then regen `npx tsx scripts/render-rule-index.mjs --write` — never hand-edit the generated index | **S-G** | L1 inventory honesty | Tier-1 |
| P9 | Trio channel-split wiring (D3b) — `companions.manifest` / `preset.meta.json` rows | **companion/beta track** | none | — |
| P10 | CC-plugin adapter + `security-guidance` mining | **separate /arch** | none (positioning) | — |
| P11 | Probe: do `Explore`/`Plan` subagents load `.claude/rules/` at all? One measured session each, host-side; outcome = evidence beside the per-role work (S-D′ consumes it). | **S-E** | READ [W] scoping | cheap |
| P12 | Operator-axis ADOPT: `engineering:architecture` ADR template as /arch §1 spec-format slot | **S-G** | none (quality) | cheap text edit |
| P13 | **S-D′ — per-seat subtraction maps** (§1.5): review-agent definitions with replacement system prompts; senior-seat rule re-scoping map; consumes P11; aif seats deferred per §0.5 priority ordering; runs under ADR-8's inherited experiment protocol (baseline → 20-dispatch window → A/B → verdict PR); SSOT #234 trigger-fired annotation | **S-D′** (reopened, Tier-2) | READ + WRITE [W] on expensive seats | sized by its own ADR-8 baseline capture |
| P14 | **Harness-remainder pricing + disable set** (operator override): per-block price list of the non-repo resident load — MCP tool schemas + server instructions, plugin SessionStart injects (e.g. the `using-superpowers` full-text inject each session start), skills/agents listings, memory index — via `InstructionsLoaded` + `/context`; deliverable = settings-recommendations doc with per-item token cost, operator applies. Preserve what already works (ToolSearch deferral keeps deferred schemas non-resident). | **S-E** | READ + WRITE [W] — the ~60-70% of session start outside repo control | remainder ≈ 100k − (29-39k repo-owned), S1-measured bounds |

**S-G — new small stage** (added rev 2; routed into the umbrella by P4(c)): Tier-1, one PR,
items P5-P8 + P12, maintainer-handoff protocol for every `.claude/rules/*` surface, kickoff
carries the D1 keep-list. S-F's charter stays closed («no scope beyond the four items»).

## §4 Umbrella dispositions (prep-doc §0 requirement)

| Umbrella | Disposition |
|---|---|
| `arch-v2-context-pipeline` | **ADVANCES.** S-D → additive scope closed-null; **S-D′ reopened subtractive** (operator override, #234 trigger (a) fired) — both via P4's single kickoff commit, never a stage `done.md`. S-E → strengthened (P2, P3, P11, P14). S-F → untouched; item 4 consumed by P2. S-G → added (P5-P8, P12). Umbrella `done.md` only at last-stage merge. |
| `per-role-context-cold-verify` | **CLOSES.** The reserved design decision is delivered: no ADDITIVE per-role ambient (its research corpus fed #234, which stands for that scope); the subtractive successor S-D′ lives under `arch-v2-context-pipeline`, not here. Whole-umbrella `done.md` correct here. |
| research-patch trio / plugin thread | **ADVANCES + routed.** Channel split resolved (D3b); operator-axis ADR-template adoption (P12); adapter + security-guidance → own contour (P10). Observation, not acted on: the 2026-08-02/-06 corpus needs harvesting from `feat/prune-worktrees` to staging. |

## §5 Exit routing (/arch §3)

- **Operator, manual:** (1) P1 — the committed `.claude/settings.json` half; (2) per the
  round-2 recheck's own recommendation, eyeball the three rev-3 fix sites (P4's charter
  rewrite clause, §2's dependency-honesty paragraph, P4(c)'s S-G routing) instead of a third
  cold seat (`cold-seat-economy.md §3`). (D1b was operator-delegated and is resolved in §1:
  digest, with the one-incident rollback trigger.)
- **Factory-bound:** S-E kickoff (P2 + P3 + P11 + P14) — Tier-2, plan-complete → WITH marker
  (precondition ACTIVE). S-D′ kickoff — Tier-2 (subtraction maps need design; ADR-8 protocol
  inherited). S-G — Tier-1 with the D1 keep-list authored in. P4 — the planning session's own
  kickoff commit, first in sequence (it creates S-D′/S-G rows the kickoffs then fill).
- **Bookkeeping:** umbrella-closure `done.md` for `per-role-context-cold-verify`; session
  memory corrected (done in-session 2026-08-06: local-half-applied state + fork resolutions
  recorded in `project_arch_v2_context_pipeline`).
- **Deferred contours:** P9 (companion track), P10 (separate /arch).

## §6 §1.7 self-reflexive note

**Forward-check.** [`build-first-reuse-default.md §1.1`](../../../.claude/rules/build-first-reuse-default.md):
**one capability commit total** — P2's pinned picomatch devDep, verdict ADOPT verbatim (the
matcher the shipped client bundles), `Prior-art:` trailer + SSOT entry in the same commit; the
earlier «no BUILD anywhere» claim was corrected at round 2 (a transitively-present dep is not
an explicit one). Everything else REUSES: `check-alwayson-budget.sh`, `measure-always-on.sh`,
`probe-channels.sh`, native agent-definition replacement, principle-test infra.
[`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md):
every new check is a deterministic gate or a named measurement channel with a named fallback
(§2 item 3). [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md): all gates
deterministic. T20: every resolution carries grounds + falsifier; unsized quantities say so.
**Backward-check.** Class = *artefacts that rank/size/adjudicate context-economy levers*:
distillate — superseded on open forks only, consumer-impact claim corrected loudly; prep-doc —
consumed, §5 forks resolved; SSOT #233 — cited unchanged; **SSOT #234 — trigger-fired
annotation owed at S-D′ dispatch (its own protocol), verdict text unchanged**; ADR-8 —
inherited by S-D′, not orphaned; umbrella kickoff — P4 edits stage table AND S-D charter prose
(the round-2 sweep found the prose survivor); `cold-seat-economy.md` — extended via P6's
handoff; `session-start-token-audit` (closed) — banked trim is P5's baseline.
**Self-application (T15).** This spec is consumed once by stage kickoffs — never always-on;
the contour ran on distillate + addressed sections only; its review = two cold seats + one
narrow fresh re-check seat (the §3-P7 discipline applied to its own production).

## §7 Review disposition

**Round 1** (two cold seats, both REVISE — 2 BLOCKER + 9 MAJOR + 8 MINOR): all dispositioned
in rev 2; the round-2 re-check verified each fix against rev-2 text line-by-line — none
regressed. (Full table in rev 2, `git show e9d50326e3^..335d0ed0d0`; reports:
scratchpad `top-down-…`/`bottom-up-pipeline-token-economy.md`.)

**Round 2** (fresh narrow re-check seat, REVISE — 3 new MAJOR + 4 MINOR, all introduced by
rev-2 fixes):

| Finding | Fix in rev 3 |
|---|---|
| N-1 S-G existed only inside the spec (no kickoff routing, no marker, no Ordering slot) | P4(c): S-G row + Ordering + marker value in the same kickoff commit |
| N-2 picomatch not an explicit dep → «no BUILD» claim false | §2 dependency-honesty paragraph; P2 reclassified capability commit (pin + trailer + SSOT); §6 corrected |
| N-3 S-D charter prose still instructs «retirement note + `done.md`» | P4(b): charter prose rewrite named with kickoff:176-177 + priority-score.sh:140,255-263 evidence |
| Minor: [W]/[D] tags violated 6×, one tag spanning two denominators | [A] tag added; all shares re-tagged |
| Minor: `probe-channels.sh` not named for P8 | named in P8 |
| Minor: no fallback if `InstructionsLoaded` unobservable | §2 item 3 fallback (post-fix `measure-always-on.sh` as outcome channel) |
| Minor: S-F item 4 consumption not routed | P4(d) |

**Round 3:** per the re-check seat's own recommendation, no third cold seat — the three MAJOR
fixes are text-mechanical; the operator eyeballs the three sites (§5). Round cap respected
(/arch §2: 2 REVISE rounds, then surface — surfaced in §5 as the operator eyeball step).

## See also

- prep-doc: `docs/superpowers/specs/2026-08-06-arch-prep-pipeline-token-economy.md` (feat/prune-worktrees).
- [`2026-07-31-arch-v2-context-pipeline-design.md`](2026-07-31-arch-v2-context-pipeline-design.md) — ADR-1..ADR-8.
- [`2026-08-01-token-economy-distillate.md`](../../meta-factory/research-patches/2026-08-01-token-economy-distillate.md) — measurements + lever table.
- [`2026-08-02-rtk-empirical-test.md`](../../meta-factory/research-patches/2026-08-02-rtk-empirical-test.md) — the L1 kill evidence.
- `2026-08-02-superpowers-vs-trio.md` §B, `…-anthropic-first-party-plugins.md` §10 (feat/prune-worktrees) — the D3 evidence base.
- Cold-review reports: scratchpad `top-down-…`, `bottom-up-…`, `recheck-pipeline-token-economy.md` (session-local).
