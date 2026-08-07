<!-- scope: pipeline-token-economy decision layer — output of the 2026-08-06 /arch external design contour over docs/superpowers/specs/2026-08-06-arch-prep-pipeline-token-economy.md (feat/prune-worktrees). Revision 3: round-2 narrow re-check findings (3 MAJOR + 4 MINOR) dispositioned in §7, PLUS the operator override of 2026-08-06 (S-D reopened as subtractive per-seat maps; harness-remainder taken into scope; expensive-seat economy principle recorded). Revision 4 (2026-08-06 /arch re-planning pass): the two /pipeline Phase -1 cold reviews returned design-level defects (S-E STOP, S-G REVISE, S-D′ REVISE); the four forks are resolved in §1.6 with fresh host measurements — D1's import mechanism replaced (it inverted the goal), the D1b digest homed, S-E split (host-only items → new stage S-H), the budget-gate membership predicate fixed and the stage order re-derived. -->

# Pipeline context & token economy — decision layer (2026-08-06, rev 4)

> **Authoritative for:** the decision layer over the 2026-08-06 prep-doc — economy principle
> (§0.5), fork resolutions D1/D2/D3/N1/N2 + the per-role reopen (§1), the config-assertion gate
> position (§2), the proposal→stage routing table (§3), umbrella dispositions (§4), exit
> routing (§5), review disposition (§7).
> **NOT authoritative for:** the measurements — the prep-doc and the research patches own them;
> ADR-1..ADR-8 — [`2026-07-31-arch-v2-context-pipeline-design.md`](2026-07-31-arch-v2-context-pipeline-design.md);
> SSOT verdicts #233/#234 — [`prior-art-evaluations.md`](../../meta-factory/prior-art-evaluations.md);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Current as of 2026-08-06.**

> **Branch note.** The staging-side inputs (ADR spec, distillate, `cold-seat-economy.md`)
> are readable locally; the prep-doc and the
> 2026-08-02 webresearch corpus live on `feat/prune-worktrees` only. One seat reading one ref
> still finds nothing at some links — resolve cross-branch links deliberately. (An earlier
> «staging is an ancestor of this branch» claim is dropped — rev 4: staging moves during
> multi-PR work; verify with `git merge-base --is-ancestor` at read time, never assume.)

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

> **[W] is HISTORICAL from S-H onward — operator verdict 2026-08-07, S-H `DECISION-NEEDED #2`
> Option A.** The operative denominator is **[H]** — the live host corpus S-H measured (189
> session-root + 722 subagent transcripts, WRITE 35.2%;
> `docs/meta-factory/research-patches/2026-08-07-s-h-turn-attribution-p3d-p11.md:109-110`).
> This is a **constatation, not a preference**: [W]'s 169-session subset is physically
> unrecoverable, not merely un-selected — worktree pruning deleted 34 project directories
> together with their transcripts, so «the 169-session subset cannot be re-selected by re-running
> anything» (`…-s-h-turn-attribution-p3d-p11.md:112`, cause at `:92`). Consequences, binding:
> existing [W]-tagged shares stay readable **as history** and are **not** comparable with anything
> measured after 2026-08-07; **no new figure may be tagged [W]**; and every [W]-defined threshold
> is re-adjudicated on [H] or marked un-adjudicable (the one such threshold is N1's falsifier in
> the §1 fork table — annotated there). The tags remain **non-convertible**: a [H] figure must never be read
> as its [W] counterpart (`…-s-h-turn-attribution-p3d-p11.md:168`).

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

## §0.6 AI-agnosticism constraint (operator directive 2026-08-06 — binding for every proposal)

**CC-first, agnostic-always.** Vendor-agnostic agent tooling is the 2026 baseline expectation,
and it is this project's own architecture: build and land on Claude Code FIRST (the operator's
harness — richest surface, fastest iteration), but every SHIPPED artefact stays AI-/OS-agnostic
per the existing doctrine — this section binds the constraint to this spec's proposals, it does
not restate the doctrine (owners: [`dual-implementation-discipline.md §3`](../../../.claude/rules/dual-implementation-discipline.md)
graceful degradation; [`zcode-parity-doctrine.md §1`](../../../.claude/rules/zcode-parity-doctrine.md)
«degraded is acceptable, undocumented degradation is not»; [`build-first-reuse-default.md §1.1`](../../../.claude/rules/build-first-reuse-default.md)
two-axis model — operator-axis may be CC-native, shipped-axis must degrade). Applied to this
spec: P2's principle test + P3's pre-push/CI gates are harness-agnostic by construction
(CI + shell); P1 fixes a CC-native mechanism → non-CC harnesses get documented degradation;
P5's non-CC behaviour is trivial after rev 4 (pointer-collapse edits one CC-read file;
the retired `@AGENTS.md`-import ZCode check retired with the import — §1.6 FORK A); S-D′ (P13) inherits
ADR-2's population-table obligation — every option states per-row reach incl. the ZCode row;
P9's preset wiring rides the opt-in `companions.manifest` flow (degrades when the companion is
absent). A proposal that cannot state its non-CC behaviour is not dispatch-ready.

## §1 Fork resolutions

Format per fork: resolution → grounds → falsifier («wrong if»).

| # | Fork | Resolution | Grounds | Wrong if |
|---|---|---|---|---|
| D1 | Always-on head trim | **Bounded trim of `CLAUDE.md`; D1b RESOLVED (2026-08-06, operator-delegated): traps → resident hot digest.** `CLAUDE.md` trim mechanism — **AMENDED rev 4 (§1.6 FORK A): pointer-collapse, NO `@AGENTS.md` import.** The rev-3 import mechanism was measured to invert the goal (import makes 8,861 B resident to remove 1,369 B, net **+7,492 B per expensive seat**, and duplicates the resident rule-index region — evidence in §1.6). Instead: collapse the `Read-first (Step 0)` + `Project goal pointer` sections to one-line pointers at `.claude/session-bootstrap.md` and `README.md#why-this-exists`; sized target **net ≤ −1,100 B**, acceptance measured on the **resident set** (no new resident file), not on one file; **judgment-bearing sections are a keep-list, out of trim scope** (`CLAUDE.md:106` tier routing «a judgment, never an automated classifier»; `:132` marker-value «belt-and-braces»; PR strategy; un-gated operational conventions). Keep-list authored INTO the executing kickoff. ZCode check rides the stage: if `@`-import is not honoured there, document the degradation (zcode-parity doctrine), do not block the trim. **D1b:** expensive seats get a hot digest (T-numbers + one-line counters, ~2k vs 6.6k tokens); full catalogue re-scoped to `paths:` (fires edit-time on rule/kickoff/research-patch authoring — the earliest reachable channel for exactly the work traps bite); executor channel already mechanical (principle test 12 fails any kickoff without trap enumeration); **anti-drift gate:** a deterministic test asserts every §2 T-number has a digest line. **Digest home — RESOLVED rev 4 (§1.6 FORK B): new rule file `.claude/rules/ai-laziness-digest.md`, ≤ 8,192 B, no `paths:` frontmatter (resident by the client's own mechanism); the renderer bookkeeping (TIER0_CORE swap traps→digest, channel dedupe, `INDEX_MAX_BYTES` headroom) rides S-G, whose permitted set now includes `scripts/render-rule-index.mjs`.** | The mechanical-enforcement argument holds only for the gated share; #1188 banked the easy half. ~2/3 of `CLAUDE.md` is CC-only content AGENTS.md deliberately lacks — full unification would bloat the portable file. D1b's ground is §0.5: the full lazy-executor manual resident in the smartest seat is the inversion; savings ≈ 9% [A]. | A post-trim session bypasses a convention the trimmed prose carried → restore that section. **D1b rollback trigger: ONE incident of a senior-seat session committing a trap the digest under-carried → full residency restored, incident recorded.** |
| D2 | Measure-first vs ship-cheap-first | **Ship-cheap-first; N2 measurement rides S-E as its input.** | P1 and stage dispositions depend on nothing unmeasured. The only consumer of per-turn attribution is S-E's gate (ADR-3). | A decision needs N2's numbers before S-E dispatches → split N2 into its own Tier-1 stage. |
| D3 | Plugin thread | **(a) CC-plugin adapter → separate /arch (capability commit, positioning; plugins patch §10 item 3 is its input). (b) Channel split per the operator's §B3 delegation: `engineering` + `system-design` → preset-option backend; `design` → preset-option UI; `tech-debt` + `standup` → user-scope; PM not shipped. (c) `security-guidance` mining → STUDY in the adapter contour. (d) Operator-axis ADOPT: `engineering:architecture` ADR template as /arch §1's spec-format slot, thin-wrapper (trio §A2 G1) — P12.** Token angle closed: ≈1,402 est-tokens, not binding (trio §A4). | §B1 verdicts round-2 operator-validated; §B3 defers the split here. | A preset cohort measurably wants `tech-debt`/`standup` by default → promote to manifest. |
| N1 | Re-write triggers (WRITE 43.1% [W]) | **Discipline + measurement, no new structure.** (a) Resume-as-expensive codified (`cold-seat-economy.md §3`). (b) Skill-embed additions: prefer artifact handoff to a fresh seat over `/compact`; do not stretch a seat across the 1-hour TTL idle gap. (c) Trigger-class sizing inside S-E's N2. | WRITE = unavoidable first-writes (2× each new token) + avoidable full prefix re-writes (~5% of turns, each a whole prefix). Attacks the **trigger**, not the payload. | ~~N2 measures avoidable re-writes <5% of the WRITE line [W] → retire the discipline text.~~ **HISTORICAL — un-adjudicable as written (2026-08-07, #2 Option A):** [W] is unrecoverable, so this falsifier can never be evaluated on the corpus it names. **Operative restatement on [H]:** avoidable re-writes <5% of the WRITE line **[H]** → retire the discipline text. **Standing [H] reading: 16.5% > 5% → the discipline text STAYS** (1,416 turns, 1.7% of turns, carrying 16.5% of the [H] WRITE line — `…-s-h-turn-attribution-p3d-p11.md:154`, Option-A consequence `:162`). Not a [W] result: `:168`. |
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
(cheap tokens + the guidance gradient make them last in line, not off the table). **ADR-8 is not orphaned — it is inherited, with one recorded deviation
(rev 4):** S-D′'s rollout runs under ADR-8's own experiment protocol (baseline before merge,
20-dispatch window, deterministic A/B, owner closes with a verdict PR), now measuring
subtractive shaping instead of additive. **Deviation, recorded loudly rather than quietly:**
ADR-8's control arm specified «hook branches on task-id parity, one branch in the resolver» —
but the resolver was never built (S-D CLOSED-NULL adopted the null option), so that arm has
no home. The deterministic split is **re-homed to dispatch time**: two review-agent
definition variants (subtracted vs uniform), selected by task-id parity at dispatch, with the
arm recorded in the calibration-ledger row; determinism stays auditable — the window-close
verdict PR runs a mechanical parity audit over the ledger (`arm == parity(task-id)` for every
row) and quotes it. A ledger with missing arm columns or a failed parity audit voids the
window (fail-closed), which preserves ADR-8's «a real A/B rather than fail-open-by-accident»
intent without inventing a resolver S-D declined to build.
**Stage: S-D′** (P13). The SSOT #234 row gets a trigger-fired annotation at S-D′ dispatch, per
its own protocol.

## §1.6 Re-planning fork resolutions (rev 4, 2026-08-06 — measured on the host at staging `c8a2bfcec6`)

The /pipeline Phase -1 cold reviews (S-E STOP, S-G REVISE, S-D′ REVISE) surfaced four
design-level forks. Every number below was re-run in the re-planning session per T-REPLAN-B —
none is carried from the reviews.

### FORK A — D1's `@AGENTS.md` import inverted the trim's goal → pointer-collapse

**Resolution:** drop the import; collapse the two named `CLAUDE.md` sections to one-line
pointers (`.claude/session-bootstrap.md`; `README.md#why-this-exists`). D1 row amended above.
**Evidence:** `wc -c AGENTS.md` → 8,861; `sed -n '8,17p' CLAUDE.md | wc -c` → 1,369.
`AGENTS.md` is NOT in the resident set (`scripts/measure-always-on.sh:10-11` builds
`files=( "CLAUDE.md" )` + `.claude/rules/*.md`; corroborated by the attribution table's
10-source enumeration). Importing it adds 8,861 B resident to remove 1,369 B — net
**+7,492 B/expensive seat** — and makes the rule-index region resident twice (`AGENTS.md`
carries it via `render-rule-index.mjs:21-22,199-200`, alongside the resident
`00-rule-index.md`, 4,030 B). The collapsed prose is already delivered twice more: the
UserPromptSubmit bootstrap digest re-injects goal + invariants every prompt (observed live
2026-08-06), and `.claude/session-bootstrap.md` is the Step-0 read target itself.
**Sized target:** net ≤ −1,100 B on `CLAUDE.md` (1,369 B removed, ≤ ~250 B of pointers added).
**Acceptance (resident set, not one file):** the S-G PR quotes (i) `wc -c CLAUDE.md`
before/after with delta ≤ −1,100 B, (ii) `grep -c '@AGENTS' CLAUDE.md` → 0, (iii) the
resident-set table (§FORK D formula) before/after — no file enters the set.
**Wrong if:** a harness materialises where `CLAUDE.md` must inline the shared core (no hook
digest, no session-bootstrap read) — then re-open the import WITH its measured residency cost
stated in the row, never as a free win.

### FORK B — D1b digest home → new rule file + S-G gets the renderer

**Resolution:** digest = `.claude/rules/ai-laziness-digest.md` (≤ 8,192 B ≈ 2k tokens, no
`paths:` → resident by construction). `ai-laziness-traps.md` gains `paths:` (rule/kickoff/
research-patch/skill/agent authoring surfaces) and leaves residency. Renderer bookkeeping in
the same S-G PR: (a) `TIER0_CORE` swap `'ai-laziness-traps'` → `'ai-laziness-digest'` — the
set is a display label (`render-rule-index.mjs:56-60`, `:88` unconditionally emits
`always-on core`), so leaving it stale would render a self-contradictory row
(`always-on core, paths:(N)`) in the very PR whose P8 item is Channel(s) truth; (b) index
headroom: `wc -c 00-rule-index.md` → 4,030 vs `INDEX_MAX_BYTES` 4,096 (`:52`) = **66 B**, one
row ≈ 150 B — first trim verbose `Fires:` cells (the script's own guidance), and if the regen
still exceeds the ceiling, raise to **4,608** with the script's required reasoning comment;
(c) channel dedupe — see FORK D item (b). **Residency mechanism:** residency
flows from `paths:`-absence minus `claudeMdExcludes`.
**The Tier-0 registry is QUADRUPLICATED (round-4 cold review B-1/B-2/M-1) — the S-G PR
swaps `ai-laziness-traps` → `ai-laziness-digest` in ALL FOUR in one commit, or its own suite
goes red:** (1) `render-rule-index.mjs:56-60` `TIER0_CORE` — display label; (2)
`packages/core/principles/31-rule-channel-declaration.ts:58-64` `ALWAYS_ON_CORE` —
**load-bearing, not a label**: branch (c) of the Class-A channel gate is the ONLY branch a
`paths:`-less digest can pass, and the set is capped at 4 by a module-load throw (`:65-70`);
(3) that principle's test literal («contains the 4 expected rule basenames» —
exact-membership assert in `31-rule-channel-declaration.test.ts`); (4)
`scripts/render-rule-channels.mjs:75-79` `ALWAYS_ON_CORE` — feeds the harness-degradation
matrix's in-scope predicate, so a stale copy leaves the digest with NO per-harness delivery
verdict, silently (§0.6 violation). The `00-rule-index.md` member stays in every copy. An
earlier rev-4 draft said «`TIER0_CORE` only labels it» — TRUE of the renderer, FALSE of
principle 31; corrected here.
**Second render target (round-4 B-1):** `render-rule-index.mjs --write` writes BOTH
`00-rule-index.md` AND the `AGENTS.md` rule-index fenced region (`:187-204`); `--check` and
the principle-21 agnosticism probe (`tests/agnosticism/probes/rules-autoload.sh`) make the
`AGENTS.md` regen MANDATORY once a rule is added. S-G's permitted set therefore includes
`AGENTS.md` **scoped to the generated rule-index region, via `--write` only, never
hand-edited** — this does not resurrect FORK A's import; the region was always generated.
**Rejected:** digest as a `CLAUDE.md` section (re-grows the P5a-trimmed file; sits outside
the rule inventory P8 makes truthful). **S-G tier consequence (the ONE authoritative
permitted-set statement — the §3 S-G row defers here):** permitted set grows to
include `scripts/render-rule-index.mjs` + `scripts/probe-channels.sh` +
`scripts/render-rule-channels.mjs` + the two principle-31 files + the `AGENTS.md` generated
region + the `ai-laziness-*` rows of `.ai-factory/rule-channel-degradations.json`
(hand-maintained reviewed data — round-2 N-1: there is NO rendered matrix artefact;
`--write` only scaffolds a missing manifest) + the `tests/agnosticism/harness-self.test.sh`
Tier-0 seed swap (round-2 N-3: it seeds `ai-laziness-traps.md` by real name);
the discriminator re-run keeps Tier 1 — every edit is one determinable sentence,
decided here (four set swaps, dedupe, ceiling procedure, regen, seed swap) — and the marker
rides the
/arch §3 plan-complete exception regardless. **Wrong if:** regen after the swap shows any
OTHER Tier-0-labelled row whose file carries `paths:`, or a FIFTH Tier-0 consumer surfaces
(`grep -rn 'ALWAYS_ON_CORE\|TIER0_CORE\|ai-laziness-traps' scripts/ packages/ tests/` —
scope includes `tests/`, round-2 N-3 — finds a set literal or name-keyed consumer this list
misses) — then stop and surface.

### FORK C — S-E's host-only trio cannot run behind the marker → split out stage S-H

**Resolution:** S-E keeps the container-safe items (P2a, P2b — P2b later REMOVED, see FORK D
overlay-semantics correction 2026-08-07 —, P3a, P3b, P3c) WITH the
marker; P3d, P11, P14 move to a new **host-side stage S-H** (no marker — not factory-bound;
executed by a host CC session). **Evidence:** the aif container mounts a NAMED VOLUME
`claude-auth:/home/node/.claude` (`~/code/aif-handoff/docker-compose.yml:27`), not the host
`~/.claude` — `~/.claude/projects/**.jsonl` (P3d's input) does not exist there, exactly as
the stage-A kickoff states («You cannot run this in the container»); P11 requires measured
HOST sessions; P14 requires `/context`, a CC slash command. Dropping the marker instead would
run five container-safe items on the expensive tier against §0.5. **P3d's aggregator gets a
permitted home:** S-H creates `scripts/measure-turn-attribution.sh`, seeded (read-only) from
the inlined snippet in `token-economy-research-s-a/kickoff.md` §2.7 («Reproduction — the full
aggregator») — no edit to another
umbrella's kickoff (Artifact Ownership Contract), no divergent second copy: the script
becomes the SSOT and the S-A kickoff stays a historical record. **Wrong if:** the aif compose
ever bind-mounts the host `~/.claude/projects` tree — re-verify at S-H authoring; if it does,
fold S-H back into S-E and record the merge here.

### FORK D — the budget gate's meter over-counts; the fix is S-E's, not S-G's P8

**Resolution:** the load-bearing repair is the **membership predicate inside
`scripts/measure-always-on.sh`** (S-E P3b, extended) — NOT S-G's P8: the meter reads neither
the rendered index nor `probe-channels.sh` (`grep -c probe-channels scripts/render-rule-index.mjs`
→ 0; the meter's own manifest is `files=( "CLAUDE.md" )` + ALL `.claude/rules/*.md`).
**Fixed predicate:** resident set = `CLAUDE.md` + `.claude/rules/*.md` lacking `^paths:`
frontmatter (the `probe-channels.sh:20` predicate, one bash idiom shared by both consumers;
the TS extractor in `packages/core/principles/rule-channel-glob.ts` stays the semantic owner)
minus the effective `claudeMdExcludes`. **Overlay semantics — CORRECTED 2026-08-07: the
model is `project ∪ local` (union + dedupe), and the rejected draft was right.** Round-4
MAJOR-3 had overruled that draft with the reason that union «contradicts P2b» and that under
union P2b's superset assert «would be vacuous». Reading the shipped client settled it: the
settings fold applies a customizer that unions arrays and replaces only for `fallbackModel`
(`ipe()` → `WSm()` → `Mo()`, `claude.exe` v2.1.207) — so the assert IS vacuous, and that is a
fact about the client, not a reason to reject the model. **The PARK condition was therefore
MET and fired: P2b is removed** (see the corrected verdict patch
`docs/meta-factory/research-patches/2026-08-06-claudemd-overlay-semantics-verdict.md` §3-§4).
P3b implements the union. **Method note for future forks:** «model X would make our gate
pointless, therefore not X» is an inverted inference — the gate is the thing under test. **Measured:** today's meter
reports 394,687 B > 101,000 (EXIT=1, before any work); the TRUE resident set is
`CLAUDE.md` 23,740 + `00-rule-index.md` 4,030 + `build-first-reuse-default.md` 12,667 +
`attention-is-not-a-mechanism.md` 2,629 + `ai-laziness-traps.md` 26,387 = **69,453 B** —
under the ceiling. Post-S-G baseline ≈ 69,453 − 26,387 (traps leaves) + ≤ 8,192 (digest) −
~1,100 (P5a) ≈ **≤ 50.2 KB**. **Ceiling formula (decided):** per-environment ceiling =
post-P3b measured baseline at the stage's base commit × 1.10, rounded up to the next 1,000 B,
labelled with environment + derivation comment. **Acceptance TRIPLE (round-4 M-2 — the before/after pair alone proves the METER was fixed,
never that the GATE discriminates; EXIT=0 after is true by construction when the ceiling
derives from the state being measured):** (1) before = unmodified meter,
`check-alwayson-budget.sh` EXIT=1 at ~394-403 KB (post-S-G tree — the digest adds ≤ 8.2 KB
to the broken meter's count); (2) after = fixed meter + re-derived ceiling, EXIT=0; (3)
**discrimination** = the fixed gate run against a ceiling forced below the measured baseline
(env override or fixture ceiling — the gate must support one) exits 1 naming the overage.
All three runs quoted. **P8 redefined (it could not discharge what FORK D
assigned it):** the real, named drift is (a) `00-rule-index.md:15` renders
`skill-embed, skill-embed` — the renderer's `deriveChannels` emits one entry per
`<!-- channel: -->` marker without aggregation → fix: render repeated mechanisms once with a
count (`skill-embed(2)`); (b) `probe-channels.sh:19` false-positives on PROSE mentions of the
globs marker — `phase-research-coverage.md:21` documents «no `<!-- globs: -->` sibling, by
design (T-SEF-A)» yet the probe reports `globs=yes` because its grep is unanchored → fix:
anchor the grep to a marker at line start. The review's second claimed drift row
(`phase-research-coverage` missing `edit-time inject`) is **NOT drift** — the rendered row is
correct and adding the channel would regress a documented design decision. (c) `TIER0_CORE`
label truth rides FORK B. **P8 acceptance pair:** before — probe reports
`phase-research-coverage … globs=yes` and the index carries the duplicated cell; after —
`globs=no` on that row, no duplicated mechanism in any Channel(s) cell, `--check` green.
**Stage order consequence:** S-G **precedes** S-E (S-G changes the resident population —
traps out, digest in, `CLAUDE.md` trimmed — and S-E's ceiling derives from the post-S-G
baseline). The reviews' claim «S-G's P8 must precede S-E's gate» reached the right order for
the wrong reason: P8's index/probe fixes are display-layer; the population change is what
sequences the stages. **Wrong if:** the client is shown to load `paths:`-scoped rules
always-on after all (then the predicate is wrong — re-derive from a live session inventory,
and the §2 item-3 outcome backstop is the catch channel).

### FORK E — the repo-owned bootstrap injector (surfaced by the round-4 cold review, M-5)

**The gap:** `.claude/settings.json` wires `hooks.UserPromptSubmit` →
`.claude/hooks/inject-session-bootstrap.sh` (and `SubagentStart` reuses the same digest
source) — **1,760 B measured per invocation, no session cache, fires on EVERY prompt submit
and every subagent spawn** (verified live 2026-08-06). It is repo-owned yet sits in the seam
between the plan's two instruments: P3b's meter counts FILES; P14 is scoped to the NON-repo
harness load. On a 30-turn expensive seat it injects ~53 KB — comparable to the entire
post-S-G resident file set (~50 KB) — and no rev-3 artefact priced or claimed it. It also
reaches review subagents REGARDLESS of S-D′'s replacement system prompts (the
`SubagentStart` hook fires independently of the agent definition), so subtraction maps that
ignore it can pass acceptance while the seat's real head is untouched (T-SDP-A shape).
**Resolution:** (a) S-H's P3d prices it explicitly — per-prompt and per-subagent injection
cost as its own line (the injection-firing-rates deliverable already covers the channel);
(b) S-D′'s maps MUST carry the injector as a named block per seat class, with mechanism =
`.claude/hooks/*` / settings edit via **maintainer-handoff proposed diff** (hooks are not in
S-D′'s permitted set); (c) candidate lever recorded for the maps to adjudicate, not decided
here: a once-per-session cache in `inject-session-bootstrap.sh` (the sibling
`inject-matching-rule.sh` already implements exactly that pattern), which would convert
~1,760 B × turns into ~1,760 B × 1 — against the counter-argument that per-prompt
re-injection is the digest's anti-drift PURPOSE (compaction resilience). Note the P5a
interplay: FORK A cites the injector as evidence the collapsed prose is still delivered —
true, and the injector's own cost is the LARGER lever; the two statements are consistent
because P5a trims a resident file while FORK E prices a per-turn channel.
**Wrong if:** the injector is shown to be cached per session after all (then the ~53 KB
figure collapses to ~1.8 KB and the lever drops out of the top-3 — re-run the grep for a
session-cache guard and the live double-fire observation before pricing).

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
2. ~~**Local-shadow detection (host-only → pre-push + `worktree-doctor`):** if
   `.claude/settings.local.json` defines `claudeMdExcludes`, the local list's picomatch
   match-set must be a superset of the project list's match-set (behavioural, not string
   comparison) — else error-with-escape-token. CI cannot see this file; pre-push is its
   earliest reachable channel.~~
   **WITHDRAWN 2026-08-07 — do not rebuild from this item.** The client merges array settings
   (`project ∪ local`), so the superset condition holds by construction and this assert is
   green-by-construction — `#hope-as-gate`. See §1.6 FORK D's dated overlay-semantics correction
   and `docs/meta-factory/research-patches/2026-08-06-claudemd-overlay-semantics-verdict.md` §3.
   The **inverse** hazard (a local file ADDING excludes to hide always-on rules) is real and
   unclaimed by any stage — it needs its own item, not a revival of this one.
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
| P1 | Config fix — **LANDED (rev 4): the committed `.claude/settings.json` carries all 7 entries in `**/<name>.md` form on staging since PR #1223 (`c8a2bfcec6`), verified `git show origin/staging:.claude/settings.json`.** Remaining operator step: drop the now-redundant `claudeMdExcludes` key from `.claude/settings.local.json` (lists verified identical). | **operator (residue only)** | READ + WRITE [W] | 15.9% [D] measured |
| P2 | Config-assertion gate (**§2 assert 1** + backstop; §2 assert 2 WITHDRAWN 2026-08-07 — see §2). Capability commit: picomatch pinned explicit devDep + `Prior-art:` trailer + SSOT entry. | **S-E** | recurrence insurance on P1's line | ~0 run cost; consumes S-F item 4 |
| P3 | Budget gate per ADR-3: **REUSE `check-alwayson-budget.sh` — wire into pre-push + per-environment ceilings (formula + acceptance pair in §1.6 FORK D)**; fix `measure-always-on.sh` TWICE-blind manifest (membership predicate: `^paths:`-absence minus effective `claudeMdExcludes` — §1.6 FORK D); `InstructionsLoaded` verification task. N2 per-turn measurement → **S-H** (rev 4, §1.6 FORK C). | **S-E** | READ + WRITE [W] ceilings | repo-owned always-on share only (ADR-3 post-falsifier scope; 29-39% declared-coverage statement binding) |
| P4 | **One umbrella-kickoff commit** (planning-session-owned surface): (a) S-D stage-table row → CLOSED-NULL for the ADDITIVE scope per SSOT #234 + S-D′ row added (P13) with its charter; (b) **S-D charter prose rewritten** — the «L2-closure PR (retirement note + `done.md`, no build)» instruction DELETED (kickoff:176-177): a stage-level `done.md` closes the whole umbrella (`priority-score.sh:140,255-263` — C3 file-existence is the closure signal; `:23-25,122-126` document it); (c) S-G row + Ordering slot + marker value for S-G (`Z.AI GLM-5.2 SDK`, re-verified unique at dispatch per the CLAUDE.md marker-value rule; S-D′ carries NO marker — un-spent judgment, rev-4 correction of this row); (d) S-F item 4 marked consumed-by-P2. Umbrella `done.md` only when the LAST stage merges. | **S-D/S-G bookkeeping** | — | — |
| P5 | Bounded `CLAUDE.md` trim per D1 — **rev 4 mechanism: pointer-collapse, NO import (§1.6 FORK A); the ZCode `@`-import degradation check is RETIRED with the import** — + keep-list **+ D1b traps digest** (digest authored at `.claude/rules/ai-laziness-digest.md` + full catalogue re-scoped to `paths:` + anti-drift test + rollback trigger + renderer bookkeeping, §1.6 FORK B) | **S-G** | READ + WRITE [W] | sized (rev 4): P5a net ≤ −1,100 B; D1b net ≈ −18 KB resident (traps 26,387 B out, digest ≤ 8,192 B in) |
| P6 | Re-write-trigger discipline text (N1b) into cold-seat-economy skill-embeds. `.claude/rules/*` maintainer-owned → **proposed diff in the stage PR, maintainer reviews/merges**. | **S-G** | WRITE 43.1% [W] — the trigger | unsized until N2 |
| P7 | Inlined-dispatch as template default (N2) | **S-G** | WRITE + output [W] | ~52%/cold seat measured |
| P8 | `Channel(s)` truth — **REDEFINED rev 4 (§1.6 FORK D): the source of truth is the rule files' own frontmatter/markers rendered by `render-rule-index.mjs`; `probe-channels.sh` is a diagnostic reporter the renderer never reads.** Named drift to fix: renderer channel dedupe (`skill-embed, skill-embed` → `skill-embed(2)`); probe's unanchored globs-grep false-positive on prose mentions; TIER0_CORE label truth (rides D1b). Then regen `--write` — never hand-edit the index. Acceptance pair in §1.6. | **S-G** | L1 inventory honesty | Tier-1 |
| P9 | Trio channel-split wiring (D3b) — `companions.manifest` / `preset.meta.json` rows | **companion/beta track** | none | — |
| P10 | CC-plugin adapter + `security-guidance` mining | **separate /arch** | none (positioning) | — |
| P11 | Probe: do `Explore`/`Plan` subagents load `.claude/rules/` at all? One measured session each, host-side; outcome = evidence beside the per-role work (S-D′ consumes it). **Re-routed to S-H (rev 4, §1.6 FORK C — host-only, cannot run behind the marker).** | **S-H** | READ [W] scoping | cheap |
| P12 | Operator-axis ADOPT: `engineering:architecture` ADR template as /arch §1 spec-format slot | **S-G** | none (quality) | cheap text edit |
| P13 | **S-D′ — per-seat subtraction maps** (§1.5): review-agent definitions with replacement system prompts; senior-seat rule re-scoping map; consumes P11 (now S-H); aif seats deferred per §0.5 priority ordering; runs under ADR-8's inherited experiment protocol with the rev-4 recorded deviation (dispatch-time parity split — §1.5); SSOT #234 trigger-fired annotation. **Instrument (rev 4 — the earlier «ordered by the S-E attribution table» named a table nobody produces):** repo-side drops are ordered by the **fixed `measure-always-on.sh` per-file output** (S-E P3b); harness-side by the **P14 price list** (S-H) **— annotation 2026-08-07 (operator verdict, PR #1255 `DECISION-NEEDED` 1): superseded for ordering by S-L's re-priced ranking (the 4 B/token conversion behind the S-H list is falsified); S-L merged is a consumed-deliverable gate on S-D′ dispatch**; a block neither instrument prices is `UNPRICED` and its ordering parks. | **S-D′** (reopened, Tier-2) | READ + WRITE [W] on expensive seats | sized by its own ADR-8 baseline capture |
| P14 | **Harness-remainder pricing + disable set** (operator override): per-block price list of the non-repo resident load — MCP tool schemas + server instructions, plugin SessionStart injects (e.g. the `using-superpowers` full-text inject each session start), skills/agents listings, memory index — via the P3c-verified channel + `/context`; deliverable = settings-recommendations doc with per-item token cost, operator applies. Preserve what already works (ToolSearch deferral keeps deferred schemas non-resident). **Re-routed to S-H (rev 4, §1.6 FORK C — `/context` is a CC slash command, host-only).** | **S-H** | READ + WRITE [W] — the ~60-70% of session start outside repo control | remainder ≈ 100k − (29-39k repo-owned), S1-measured bounds |

**S-G — new small stage** (added rev 2; routed into the umbrella by P4(c)): Tier-1, one PR,
items P5-P8 + P12, maintainer-handoff protocol for every `.claude/rules/*` surface, kickoff
carries the D1 keep-list. S-F's charter stays closed («no scope beyond the four items»).
**Rev 4:** permitted set grows per §1.6 FORK B's «S-G tier consequence» list (the renderer,
the probe, `render-rule-channels.mjs`, the principle-31 pair, the `AGENTS.md` generated
region, the degradation manifest rows, the `harness-self` seed — stated ONCE there; this
row defers to it, round-2 N-4); Tier-1 re-affirmed under the discriminator (every code edit
is a decided, one-sentence «how»); **S-G now precedes S-E** (§1.6 FORK D — it changes the
resident population S-E's ceiling derives from).

**S-H — new host-side stage** (added rev 4, §1.6 FORK C): the three host-only measurement
items — P3d per-turn attribution (new SSOT script `scripts/measure-turn-attribution.sh`,
seeded read-only from the S-A kickoff snippet), P11 Explore/Plan probe, P14
harness-remainder price list incl. the FORK E injector line — plus a conditional live
confirmation of S-E's P3c
`InstructionsLoaded` verdict when that verdict says «observable». **Scheduling (round-4 M-6
— §0.5 says economise where tokens are dearest first, and S-H's P14 addresses the 60-71%
share):** S-H is UNBLOCKED from S-E — it may run any time after this re-plan merges,
concurrently with S-G/S-E (permitted sets verified disjoint). Its two S-E touchpoints
degrade gracefully and say so: P14 uses the P3c-verified channel if S-E has merged, else
`/context` alone with a note; the conditional P3c live confirmation is skipped with a note
if S-E has not merged by stage end. **No marker, not factory-bound** — the container
cannot reach `~/.claude/projects`, `/context`, or a live CC session; executed by a host CC
session holding the S-H kickoff. Tier-1-shaped work (measurement running against decided
classes), host-bound by construction.

## §4 Umbrella dispositions (prep-doc §0 requirement)

| Umbrella | Disposition |
|---|---|
| `arch-v2-context-pipeline` | **ADVANCES.** S-D → additive scope closed-null; **S-D′ reopened subtractive** (operator override, #234 trigger (a) fired) — both via P4's single kickoff commit, never a stage `done.md`. S-E → strengthened (P2, P3), container-safe after the rev-4 split. S-F → untouched; item 4 consumed by P2. S-G → added (P5-P8, P12), precedes S-E. **S-H → added rev 4** (P3d, P11, P14 — host-side). Stage order: **S-G → S-E (strict); S-H independent, concurrent-allowed (round-4 M-6); S-D′ after S-E + S-H** (§1.6 FORK C/D/E) **+ S-L (annotation 2026-08-07, operator verdict — S-L re-prices the P14 ranking S-D′ orders by; PR #1255 `DECISION-NEEDED` 1 promoted to a gate)**. Umbrella `done.md` only at last-stage merge. |
| `per-role-context-cold-verify` | **CLOSES.** The reserved design decision is delivered: no ADDITIVE per-role ambient (its research corpus fed #234, which stands for that scope); the subtractive successor S-D′ lives under `arch-v2-context-pipeline`, not here. Whole-umbrella `done.md` correct here. |
| research-patch trio / plugin thread | **ADVANCES + routed.** Channel split resolved (D3b); operator-axis ADR-template adoption (P12); adapter + security-guidance → own contour (P10). Observation, not acted on: the 2026-08-02/-06 corpus needs harvesting from `feat/prune-worktrees` to staging. |

## §5 Exit routing (/arch §3)

- **Operator, manual:** (1) P1 — LANDED (rev 4, PR #1223); residue = drop the redundant
  local `claudeMdExcludes` key; (2) per the
  round-2 recheck's own recommendation, eyeball the three rev-3 fix sites (P4's charter
  rewrite clause, §2's dependency-honesty paragraph, P4(c)'s S-G routing) instead of a third
  cold seat (`cold-seat-economy.md §3`). (D1b was operator-delegated and is resolved in §1:
  digest, with the one-incident rollback trigger.)
- **Factory-bound (rev 4 order: S-G → S-E strict; S-H independent/concurrent; S-D′ after
  S-E + S-H — annotation 2026-08-07: + S-L, operator verdict per the P13 cell above):** S-G — Tier-1 with the D1
  keep-list authored in, WITH marker, **first of the factory stages** (it sets the resident
  baseline). S-E kickoff
  (P2 + P3, container-safe) — Tier-2, plan-complete → WITH marker (precondition ACTIVE).
  S-H — host-side, NO marker, not factory-bound (host CC session), dispatchable any time
  after this re-plan merges. S-D′ kickoff — Tier-2,
  NO marker (subtraction maps need design; ADR-8 protocol inherited with the §1.5 deviation).
  P4 — LANDED: the umbrella rows/Ordering shipped with the rev-3 kickoff commit (#1218) and
  the rev-4 corrections ship in the re-plan PR itself.
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

**Round 4 (rev 4 — outside the /arch rounds above):** two /pipeline Phase -1 dispatch-time
cold reviews over the rev-3 STAGE KICKOFFS (not this spec) returned S-E STOP, S-G REVISE,
S-D′ REVISE with design-level findings that traced back to spec rows (D1's import mechanism,
D1b's homelessness, P3d/P11/P14's container-infeasibility, the meter's manifest). Resolved by
the 2026-08-06 /arch re-planning pass: §1.6 fork resolutions + the rev-4 row amendments.
The re-issued artefacts then ran the /arch §2 two-altitude cold review (two fresh Opus
seats, artifact-paths-only): **top-down REVISE** (2 BLOCKER B-1/B-2, 6 MAJOR M-1..M-6),
**bottom-up REVISE** (1 BLOCKER, 3 MAJOR, 5 MINOR — measurement layer fully reproduced,
defects in kickoff assembly). Every finding is dispositioned in this revision: the
quadruplicated Tier-0 registry + `AGENTS.md` second render target (FORK B rewrite), the
gate-discrimination third leg (FORK D), the overlay-semantics fork (FORK D), the bootstrap
injector (new FORK E), the S-H unblocking (M-6), plus the stale cross-references in the
kickoffs. A round-2 fresh narrow re-check then verified every disposition real (3/3
BLOCKER, 9/9 MAJOR, 13/13 minor) and surfaced 3 defects the dispositions introduced —
N-1 (no rendered matrix artefact: the manifest is hand-maintained reviewed data), N-2
(S-D′ carried B-1's unshippable shape on its own `paths:` edits), N-3 (a fifth,
name-keyed Tier-0 consumer in `tests/agnosticism/harness-self.test.sh`) — all three +
3 minors dispositioned in this same revision; round cap reached, the three fix sites go to
the operator eyeball per the round-3 precedent above. Reports: scratchpad
`top-down-replan-token-economy.md` / `bottom-up-replan-token-economy.md` /
`recheck-replan-token-economy.md` (session-local).

## §8 Independent cross-check — operator `/doctor` scan (2026-08-06, additive; no resolution changed)

The operator ran an independent `/doctor` installation scan (50 sessions / 5 days / 103
project dirs) the same day and handed the report into this contour. Three confirmations, one
new out-of-scope surface, one host-side observation:

1. **Resident-set convergence.** The scan's estimate — ~18.2k tokens of always-on memory per
   session — converges with this spec's host measurement (true resident set 69,453 B ≈ 17.4k
   tokens, §1.6 FORK D) within ~5%, via a fully independent channel (transcript-side
   estimation vs file-side byte count). It also independently ranks
   `.claude/rules/ai-laziness-traps.md` (~6.6k tokens) as the single heaviest always-on file —
   above `CLAUDE.md` itself — which is exactly the lever FORK B's digest swap (S-G P5c/P5d)
   targets first.
2. **P1 residue confirmed live** — and it has a sibling. The local
   `.claude/settings.local.json` still carries the byte-identical `claudeMdExcludes` duplicate
   (verified: `jq '.claudeMdExcludes|length'` → 7). The scan additionally found
   `inject-memory-codification.sh` registered on `PostToolUse:Write` in BOTH
   `.claude/settings.json` and `.claude/settings.local.json` (verified with `jq` on both
   files) — it double-fires on every `Write` (~31 ms each). The operator-residue action
   widens to one edit: drop both duplicate keys from the local file. Agent-uncommittable
   surface either way (`.claude/settings.local.json`), so this stays an operator action, not
   a stage obligation.
3. **Lazy-loading posture validated externally.** The scan's Check 4 concluded «nothing left
   to migrate» from `CLAUDE.md` (Task-tier routing stays resident: dispatch-blocker rule) —
   consistent with D1's bounded-trim-with-keep-list resolution, not a full offload.
4. **NEW surface, deferred out of this umbrella: skills-listing budget overflow.** Names +
   descriptions across all sources ≈ 9.1k est. tokens vs the harness's ~2k listing budget;
   over budget the harness truncates descriptions and inter-skill routing degrades. Project
   skills contribute ~2.2k; heaviest measured description: `arch/SKILL.md` 1,486 chars, then
   `self-reflection` 969 / `aif-doctor` 965 / `pipeline` 907 (host-measured this session).
   The dominant weight (~6.2k) is app-bundled plugins outside repo control, so a repo-side
   fix recovers at most the project share. Disposition — SUPERSEDED same day: the original
   «deferred out of umbrella» call was overridden by explicit operator invitation («умбрелла
   всё берёт») → routed to NEW stage **S-I** (kickoff
   `.claude/orchestrator-prompts/arch-v2-context-pipeline-s-i/kickoff.md`; host-bound, MID-tier
   seat with `superpowers:writing-skills` loaded — operator directive). The round-capped
   S-G/S-E kickoffs remain untouched; S-I is a new artifact with its own Phase -1 review at
   dispatch.
5. **Host-side hook latency — routed to S-I (P-I6):** `~/.claude/hooks/post-api-push-autosync.sh`
   blocks `PostToolUse:Bash` at a 3.9 s median when it fires (network in the hook body). Fix =
   deferred-report pattern (background the network, next hook invocation relays the outcome
   lines) — NOT plain backgrounding: the hook's stdout is a load-bearing channel to the active
   session (the DIVERGED warning's named consumer; 2026-07-10 31-commit drift incident), so
   orphaning it would be `#warning-nobody-reads`.
6. **Executed during the 2026-08-06 Actions-outage window (in the /arch session, ahead of
   S-I's verify pass):** the P1-residue sibling pair — conditional `claudeMdExcludes` drop
   (3 of 21 worktree copies, only where the committed `**/` form is present) + the duplicate
   `inject-memory-codification.sh` registration removed (20 copies); and
   `"uniq-rewrite": "off"` added to `~/.claude/settings.json` `skillOverrides`. Backups in the
   session scratchpad. S-I re-verifies both (its P-I3/P-I4 verify-only items).

## See also

- prep-doc: `docs/superpowers/specs/2026-08-06-arch-prep-pipeline-token-economy.md` (feat/prune-worktrees).
- [`2026-07-31-arch-v2-context-pipeline-design.md`](2026-07-31-arch-v2-context-pipeline-design.md) — ADR-1..ADR-8.
- [`2026-08-01-token-economy-distillate.md`](../../meta-factory/research-patches/2026-08-01-token-economy-distillate.md) — measurements + lever table.
- [`2026-08-02-rtk-empirical-test.md`](../../meta-factory/research-patches/2026-08-02-rtk-empirical-test.md) — the L1 kill evidence.
- `2026-08-02-superpowers-vs-trio.md` §B, `…-anthropic-first-party-plugins.md` §10 (feat/prune-worktrees) — the D3 evidence base.
- Cold-review reports: scratchpad `top-down-…`, `bottom-up-…`, `recheck-pipeline-token-economy.md` (session-local).
