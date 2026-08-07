<!-- scope: stage-scoped dispatch input — S-D′ of the arch-v2-context-pipeline umbrella (reopened scope, operator override 2026-08-06). NO bridge-profile marker — DELIBERATE: Tier 2 and NOT plan-complete (the subtraction-map authoring is the un-spent design judgment), so the top tier plans in aif per CLAUDE.md Task-tier routing. RE-ISSUED rev 4 (2026-08-06 /arch re-planning after a Phase -1 REVISE): dependency widened to S-E + S-H (the P11/P14/P3d inputs live in S-H now — spec §1.6 FORK C); the ADR-8 control arm re-homed to a dispatch-time parity split with a recorded deviation (spec §1.5); the ordering instrument named honestly (spec P13 rev 4). REV 5 (2026-08-07) absorbs this stage's FIRST cold Phase -1, which returned STOP: the fork-independent findings are fixed in place below, and the ADR-8 A/B arm is PARKED behind the §5 DECISION-NEEDED — it is NOT dispatchable until the operator resolves that fork. REV 6 (2026-08-07) records the operator's resolution of that fork — §5 = Option A, the ADR-8 A/B arm is DESCOPED from this stage (deliverable 3 removed, §4 T2 re-scoped to this stage's own before/after, follow-on stage stubbed in §6); the §5 blocker is lifted, so the ONLY remaining gate on dispatch is the two-gate S-E + S-H dependency. REV 7 (2026-08-07) records the operator verdict resolving PR #1255 DECISION-NEEDED 1: the dependency list gains S-L — this stage orders its harness-side drops by the P14 ranking, S-L re-prices it (the 4 B/token conversion is falsified), so S-L's re-priced ranking is a consumed deliverable under the umbrella §3 two-gate form. REV 8 (2026-08-07) records the gate closing: S-L merged as PR #1263, so with S-E (#1237), S-H (#1239 + #1249) and S-L (#1263) ALL merged, every consumed-deliverable gate is MET on both arms and the stage is DISPATCHABLE. Rev 8 changes no scope and no deliverable — it only retires the «S-L is open» claim that rev 7 left in three places below. -->
<!-- host-verify contract lives in §3 (a real contract, not an opt-out). The earlier `host-verify: none` opt-out was retracted 2026-08-06: deliverable 2 edits `agents/*.md`, which shifts install fingerprints, so this stage DOES have an executable arm — see §3. -->

# arch-v2-context-pipeline S-D′ — per-seat subtraction maps

> **Stage goal:** author WHAT EACH CC SEAT CLASS STOPS LOADING — subtraction, never authored
> per-role ambient content (SSOT #234's DEFER/null stands for the additive scope). **Design
> SSOTs (read both, in full):**
> [`2026-08-06-pipeline-token-economy-design.md`](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
> — §1.5 (the reopen, its scope line, ADR-8 inheritance), §0.5 (priority ordering), §0.6
> (agnosticism constraint), P13;
> [`2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> — ADR-8 (the experiment protocol this stage inherits), ADR-1 (L1 sub-axes), ADR-2
> (population-table obligation + C2: a custom subagent's system prompt REPLACES CC's).
> Umbrella context: [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md).
>
> **Depends on S-E, S-H AND S-L merged (rev 7)** — S-H carries the P11 probe (do Explore/Plan
> load rules?) and the N2/P3d attribution numbers (spec §1.6 FORK C); S-L carries the
> re-priced P14 ranking the harness-side drops are ordered by (operator verdict 2026-08-07,
> PR #1255 `DECISION-NEEDED` 1); S-E carries the fixed
> per-file meter this stage orders its repo-side drops by. Do not dispatch before all three.
>
> **INPUT CONDITION — baseline snapshot before any prune (operator verdict 2026-08-07, S-H
> `DECISION-NEEDED #1` Option B).** This stage's before/after measurement is invalid on a corpus
> that shrinks under it: between the S-A seed and S-H the transcript population moved **−23.5%**
> (247 → 189 files, 99 → 65 project dirs) because pruning a worktree deletes its transcripts with
> it — a population change, not drift
> (`docs/meta-factory/research-patches/2026-08-07-s-h-turn-attribution-p3d-p11.md:73-95`).
> **Binding:** a host-side snapshot of the **per-turn billing projection** is captured BEFORE any
> worktree prune, and this stage's baseline cites the snapshot it used.
> **Form — reuse, not build** ([build-first-reuse-default.md](../../rules/build-first-reuse-default.md)):
> copy the shape of the existing `origin/data/metrics` channel — one appended CSV row per day on a
> data branch, outside the main history — but **NOT its mechanism**: that channel is a CI cron
> (`.github/workflows/metrics-collect.yml`) collecting GitHub repo-popularity counters
> (`date,stars,forks,clones_…`), and the corpus it would need lives at `~/.claude/projects`, which
> CI cannot reach. The snapshotter is therefore host-side by construction.
> **Scope note (do not widen):** authoring that snapshotter is NOT this stage's deliverable — this
> clause states the precondition and its form; the owning stage is named at dispatch.
> **One consumer, not two (§5 = Option A, operator verdict 2026-08-07, recorded in rev 6):** with
> the ADR-8 A/B arm descoped from S-D′, the surviving consumer of a stable baseline is **this
> stage's own before/after**; ADR-8's 20-dispatch window travels to the follow-on stage that takes
> the dispatch choreography, and that stage inherits this same input condition.

**Base:** `origin/staging`. **Mode:** design + implementation, one PR onto staging.

## §1 Deliverables

1. **Subtraction map document** (one file under `docs/superpowers/specs/`): per CC seat class —
   review subagents · Explore/Plan · senior main seat — which currently-loading blocks are
   dropped, via which native mechanism (agent-definition system-prompt replacement / rule
   channel re-scoping / `claudeMdExcludes` — the latter is RECOMMENDATION-ONLY: settings
   files are operator-owned and outside §2, so a `claudeMdExcludes` drop ships as a
   recommended diff, exactly like S-H's P14 rows), each drop with: measured resident cost of
   the block, per-population reach incl. the ZCode row (documented degradation where
   unreachable), and a **restoration trigger** (the observable failure that reverses the
   drop). **The bootstrap injector is a MANDATORY named block (spec §1.6 FORK E):** the
   `UserPromptSubmit`/`SubagentStart` digest inject (**provisional 1,760 B/invocation,
   uncached — inherited from spec FORK E, which itself instructs S-H to re-measure; quote
   S-H's P3d measurement or mark the row provisional-pending-P3d, never restate this number
   as measured**) reaches
   every seat class INDEPENDENTLY of agent definitions — a review-seat map that ignores it
   subtracts theatre, not tokens. Its mechanism is a `.claude/hooks/*` / settings edit,
   which is NOT in §2's permitted set → the map row carries a maintainer-handoff proposed
   diff (e.g. the once-per-session cache pattern `inject-matching-rule.sh` already uses),
   priced from S-H's P3d line, with the anti-drift counter-argument (per-prompt re-inject
   is the digest's compaction-resilience purpose) stated in the row.
   **Ordering instrument (rev 5 — spec P13; corrected against the script's actual manifest):**
   `scripts/measure-always-on.sh` prices **`CLAUDE.md` + `.claude/rules/*.md` ONLY** — its
   manifest is `files=( "CLAUDE.md" )` plus a `find .claude/rules -maxdepth 1 -name '*.md'`
   (`scripts/measure-always-on.sh:10-11`). It emits **no line for `agents/*.md`**, so the
   rev-4 claim that its per-file output prices «rules and agent prompts» was false for the
   agent half. Corrected instrument set, by drop unit:
   - **rules** (whole file is the drop unit) → `measure-always-on.sh` per-file output;
   - **`CLAUDE.md` sections** → `sed -n 'X,Yp' CLAUDE.md | wc -c`;
   - **`agents/*.md`** (whole file is the drop unit) → `wc -c agents/<name>.md`, and for a
     replacement prompt the delta `wc -c` before vs after — state both numbers;
   - **harness-side blocks** → S-L's re-priced P14 ranking (rev 7 — S-H's original list is
     superseded for ordering: its conversion constant is falsified).

   A block **no** instrument in that list prices is `UNPRICED` — **park its ORDERING and keep
   the drop, do not stop the task** (this is the binding reading; see §3a(a), which rev 5
   harmonises). Never estimate (T-SDP-A).
2. **Review-seat agent definitions** (`agents/*.md`): replacement system prompts carrying
   reviewer-discipline + verdict grammar instead of the full operational head. Editing
   `agents/*.md` shifts install fingerprints — regen snapshots
   (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`).
3. **ADR-8 experiment — PARKED at rev 5, NOT dispatchable.** The cold Phase -1 found the
   rev-4 form unexecutable on four independent counts, each verified: (i) `parity(task-id)`
   is undefined over aif's id space — task ids are UUIDs
   (`calibration.md:150` → `efe91281-2640-49b0-ba61-436c2a8eb628`), and no parity function is
   defined, so two executors compute two different arms and the «mechanical» audit is
   narration; (ii) the audit as scoped VOIDs the window on day one — the ledger already holds
   three arm-less rows (`calibration.md:145-215`), two with no task id at all, so
   `arm == parity(task-id)` over «every row» fails before the first subtracted dispatch
   exists; (iii) **review-defect count has no instrument and no producer anywhere in the
   umbrella** — the ledger's named instrument covers `tokenTotal`/`costUsd` only
   (`calibration.md:127-135`), while ADR-8's falsifier needs BOTH metrics
   (`2026-07-31-arch-v2-context-pipeline-design.md:243-244`), so the window cannot be
   adjudicated; (iv) two agent-definition variants both ship to consumers through
   `install.sh:606-618`'s glob-copy, whose skip-list is not in §2 — so the experiment either
   edits an unpermitted file or ships an experiment to every consumer.

   **DESCOPED at rev 6 — §5 resolved to Option A (operator verdict 2026-08-07).** The four
   findings above stand as the record of *why*; the arm itself leaves this stage. **Binding for
   an executor of S-D′:** do NOT implement any part of the A/B arm, do NOT invent a parity
   function, do NOT fabricate a defect count — and do NOT treat their absence as a shortfall.
   This stage now ships deliverables 1, 2 and 4; a PR with no evaluation arm is **conformant**,
   not incomplete. The arm's new home is the follow-on stage stubbed in §6. **The §5 blocker is
   lifted; the dependency gates (S-E + S-H + S-L as of rev 7) are unaffected by this
   descope and still bind.**
4. **SSOT #234 annotation** (same PR): trigger (a) fired — operator-declared expensive-seat
   budget exhaustion, 2026-08-06 session; verdict text unchanged, annotation appended per the
   row's own protocol.

**Priority (binding, spec §0.5):** expensive CC seats first; aif executor seats deferred —
cheap tokens + the guidance gradient (a weaker executor needs MORE resident instruction);
any executor-side trim must show it does not starve the weaker seat.

**Descopes:** no authored per-role digests (that is the closed additive scope); no budget-gate
work (S-E owns); no CLAUDE.md content trim (S-G owns — this stage may re-scope rule CHANNELS,
not rewrite rule text).

## §2 Permitted files

`docs/superpowers/specs/*` (the map), `agents/*.md` **EXCEPT the maintainer-owned set** —
`agents/living-docs-auditor.md`, `agents/review-sidecar.md`, `agents/rule-test-author.md` are
read-only for all sessions ([CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md)); a
replacement system prompt that genuinely belongs in one of those files travels as a proposed
diff in the PR body for maintainer handoff, never as a direct edit —
`.claude/rules/*` frontmatter `paths:` edits — direct edits IN the stage PR, explicitly
flagged as maintainer-owned surface; the maintainer's PR review/merge IS the handoff
(harmonised rev 4 with S-G's posture — round-4 minor: two stages of one umbrella stated
opposite readings of the same contract). **Any `paths:` edit changes the rendered
`Channel(s)` cell in BOTH generated targets (round-2 N-2 — without this the stage is
unshippable exactly like S-G's B-1): after editing, run `npx tsx
scripts/render-rule-index.mjs --write` and commit the regenerated
`.claude/rules/00-rule-index.md` + the `AGENTS.md` rule-index fenced region (both
regen-only, never hand-edited — permitted for that purpose), and update the affected rows
of `.ai-factory/rule-channel-degradations.json` (reviewed data) so the degradation stays
documented,
`.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md` (ADR-8 rows),
`.claude/orchestrator-prompts/arch-v2-context-pipeline/done.md` — ONLY if this stage is the
LAST of the umbrella to merge (umbrella-closure convention; `priority-score.sh` C3 treats
its existence as whole-umbrella closure, so writing it early is a defect),
`docs/meta-factory/prior-art-evaluations.md` (#234 annotation),
`tests/install-sh/*` (snapshot regen only). `.claude/hooks/*` and `.claude/settings.json`
remain NOT permitted — injector and excludes changes travel as proposed diffs (§1 item 1).

**Tier-0 registry surfaces — GRANTED at rev 5, and the reason you will need them (cold
Phase -1 B3).** The senior-main-seat rule-channel drop has, on the current host, **no target
that is not a Tier-0 member**: after `claudeMdExcludes`, the resident rule set is
`00-rule-index.md` (generated) + `build-first-reuse-default.md` +
`attention-is-not-a-mechanism.md` + `ai-laziness-digest.md`, and those three ARE
`ALWAYS_ON_CORE` (`packages/core/principles/31-rule-channel-declaration.ts:58-63`, capped at
4 by a module-load throw at `:65-70`) and `TIER0_CORE`
(`scripts/render-rule-index.mjs:56-60`). Re-scoping one therefore requires the four-way swap
that spec §1.6 FORK B documents, and **all four copies are hereby permitted** (same grant
S-G received — `arch-v2-context-pipeline-s-g/kickoff.md:118-121`):
`scripts/render-rule-index.mjs` · `packages/core/principles/31-rule-channel-declaration.ts` ·
its `.test.ts` exact-membership literal · `scripts/render-rule-channels.mjs`. **Swap, never
append** — the cap is 4 and a fifth entry throws at module load.

> **Why this needs its own acceptance leg (§3) and not just a permission.** The collision is
> **silent**: `deriveChannels` (`scripts/render-rule-index.mjs:86-88`) pushes `always-on core`
> for a TIER0_CORE member **and** `paths:(N)` when the rule gains a `paths:` list, and
> `--check` diffs the render output against the regenerated file — both sides change
> together, so `npx tsx scripts/render-rule-index.mjs --check` stays **GREEN** while shipping
> a self-contradictory `always-on core, paths:(N)` row and (per FORK B) a rule with no
> per-harness delivery verdict. Taking that green as acceptance is `#silent-contract-skip`
> ([destination-environment-verification.md §4](../../rules/destination-environment-verification.md)).

## §3 Acceptance

```bash host-verify
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
npx tsx scripts/render-rule-index.mjs --check
npx tsx scripts/render-rule-channels.mjs --check
```

> The earlier `host-verify: none` opt-out on this file was **wrong** and is retracted:
> deliverable 2 edits `agents/*.md`, which §1 itself notes shifts install fingerprints
> («regen snapshots»). An opt-out on a stage with an executable arm is `#optout-as-reflex`
> ([destination-environment-verification.md §4](../../rules/destination-environment-verification.md)).
> Regen with `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`, then the plain run
> above must pass **on the host**.

**Tier-0 swap leg (rev 5, non-vacuous by construction — the `--check` green above does NOT
cover it).** If the stage re-scopes any Tier-0 rule's channel: show the four-way swap landed
in all four copies (`git diff --name-only` naming each), show `npx vitest run
packages/core/principles/31-rule-channel-declaration.test.ts` green, AND show the
**discrimination**: revert exactly one of the four copies, show the suite goes **RED**,
restore, show GREEN. Paste both outputs. Additionally quote the rendered index row for the
re-scoped rule and confirm it does NOT read `always-on core, paths:(N)` — a row carrying both
is the self-contradiction `--check` cannot see. If the stage re-scopes no Tier-0 rule, state
that explicitly and say which senior-seat mechanism carried the drop instead.

Review-time (design stage): every map row carries cost + reach + restoration trigger (a row
missing any of the three is incomplete);
the #234 annotation lands in the same PR; no drop touches a block whose consumer is the aif
executor tier without the §1 priority justification; §0.6 agnosticism — every mechanism names
its non-CC behaviour or documents degradation.

**Reach is MEASURED or declared UNVERIFIED — never asserted (rev 5, cold Phase -1 M2).** The
«per-population reach» cell of every map row states HOW it was established. Permitted bases:
S-H's P11 probe (Explore/Plan only), a live probe you ran and quoted, or upstream client
documentation cited by URL + section. For the **review-subagent** seat class specifically:
no upstream deliverable measures what a custom review subagent loads, so unless you ran that
probe yourself, the reach cell reads `UNVERIFIED — no probe exists` and the row's drop is
**held**, not shipped. A row whose reach cell is a bare «yes»/«no» is incomplete, exactly as
a missing cost cell is.

**Deliverable 2 (review-seat agent definitions) — population FIRST, then criteria (rev 5,
cold Phase -1 B5; T10 before T1).** Before authoring anything, enumerate the population in
the PR body: `ls agents/*.md` (**17 files at rev-5 authoring time**), classified into
review-seat agents (in scope) / non-review agents (out of scope) / the maintainer-owned
read-only set above, **with the classification stated per file**. Then: the stage covers
**every** agent classified review-seat, or names each uncovered one with a reason. **Floor:
if fewer than 5 review-seat agents are covered, the PR states the population count and why
the covered subset is the complete in-scope set** — «I shipped one and it satisfied the
criteria» is the T1 sampling artifact this leg exists to block.

Per shipped `agents/*.md` replacement prompt: (a) exists and is named in the map it
implements, (b) carries the reviewer-role boundary of
[reviewer-discipline.md §1](../../rules/reviewer-discipline.md) and the surface-as-
DECISION-NEEDED pattern of [§2](../../rules/reviewer-discipline.md) (**rev 5 correction:
the rev-4 text cited §2 for the role boundary, which lives in §1; and it cited a «verdict
grammar» that exists in NEITHER `.claude/rules/reviewer-discipline.md` NOR
`agents/reviewer-discipline.md` — `grep -cE 'GO|REVISE|STOP|verdict grammar'` returns 0 on
both. If the prompt needs a GO/REVISE/STOP grammar, take it from
[`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) and cite THAT
— do not invent one and do not cite a section that does not carry it**), (c) states which
currently-loading blocks it drops and what the seat still receives, (d) touches no file in the
maintainer-owned set above, and (e) the install snapshots were regenerated in the same PR with
the host run quoted.

**Upstream dependency — TWO gates each, not one (rev 4: S-E AND S-H; rev 7: + S-L)** (the umbrella models
this at [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md)):
per upstream stage, (1)
**merged** — its PR is on `staging`; (2) **content-read** — the consumed deliverable
actually returned a usable answer: S-H's P11 probe **and P3d per-turn
attribution** (rev 5 — P3d was missing from the rev-4 list while §1 item 1 prices the
MANDATORY injector row from it; a P3d that lands degraded, e.g. the failed-run shape its own
kickoff names, leaves that row priced from nothing), S-E's fixed per-file
meter, and S-L's re-priced P14 ranking (rev 7). P11 may legitimately land `INCONCLUSIVE` («coverage insufficient» is its honest output
when the probe cannot observe). If it did, this stage's Explore/Plan rows have no evidence
base: say so and descope those rows, do NOT substitute an assumption. Reading «merged» as
sufficient is `#hope-as-gate`.

## §3a Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
defensible implementations, an undecided design choice, a missing spec detail that changes
behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
Y») and **stop that task.** Proceed only on the unambiguous parts.

**(a) is NOT a task-stopping park (rev 5 — the rev-4 text stated two incompatible readings of
one rule).** An unpriced block has ONE implementation and only an unknown rank, so it is not
a fork: **keep the drop, leave it unranked, mark it `UNPRICED` in the map, and continue**
(§1's binding reading). Stop the task only for (b) and (c) below, which are genuine
two-consequence forks.

Expected to fire here on: **(a)** any drop whose cost none of the §1 instruments prices
(`measure-always-on.sh` for rules, `sed | wc -c` for `CLAUDE.md` sections, `wc -c` for
`agents/*.md`, S-L's re-priced P14 ranking harness-side) — record `UNPRICED`, do not rank it, do not
estimate (T-SDP-A), do not stop; **(b)** the ZCode population row, when a mechanism has no ZCode equivalent
— «documented degradation» is the decided answer, but if a drop would be *silently* different
there rather than absent, that is a real fork: state both consequences and park; **(c)** any
drop where the restoration trigger has no observable (T-SDP-B) — park instead of writing a
vibe. Never extrapolate a per-seat load figure from an environment you did not measure.

## §4 AI-traps

See [`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) (cited per §3 of that rule).
**Active traps for this stage: T1, T2, T3, T10, T13, T15, T16, T20.**
**T10 — population enumeration BEFORE any per-agent work** (which seat classes, which
`agents/*.md`, which blocks): added rev 5 because the stage's dominant failure mode is an
incomplete population, and §3's deliverable-2 leg was satisfiable by a one-file PR until this
round. **T1 — sampling floor**: «I covered one review-seat agent and every criterion passed»
is the sampling artifact, not a result; §3 states the floor and the escape (name the whole
in-scope set). T2 — a baseline must be
CAPTURED, not described (**re-scoped at rev 6:** ADR-8's A/B baseline left with the descoped arm
(§1 item 3, §5, §6), but this stage's OWN before/after baseline remains in scope and remains
subject to T2 — and per the header's INPUT CONDITION it cites the pre-prune billing-projection
snapshot it used, rather than a figure re-derived at read time); T3 — every «block X
costs Y» row cites the measurement; T13/T16 —
«C2 replaces the system prompt» is upstream-doc-verified for the CURRENT client version, not
assumed from the ADR; T15 — the map's own residency: the map document is consumed at
dispatch-authoring, never loaded always-on; T20 — no drop without its measured cost quoted.
**T-SDP-A — subtraction-theatre:** dropping blocks nobody measured (feels productive, saves
nothing) while the measured heavy blocks stay resident because dropping them is harder.
Counter (rev 4): maps are ordered by the §1 instrument — fixed `measure-always-on.sh`
per-file output repo-side, S-L's re-priced P14 ranking harness-side (rev 7) — largest priced block first; a
map that skips a top-3 priced block states why; unpriced blocks park, never rank.
**T-SDP-B — restoration-trigger-as-decoration:** writing «restore if problems occur» as the
trigger. Counter: each trigger names an OBSERVABLE (a failed gate, a review-defect class, a
budget line moving), not a vibe.

> **Label-forward-reference note (rev 5):** `T-SDP-A` and `T-SDP-B` are cited in §1 and §3a
> above and DEFINED here. Read §4 before executing §1 — the labels are binding where cited.

## §5 RESOLVED DECISION-NEEDED — Option A (operator verdict 2026-08-07, rev 6)

> **RESOLVED: Option A — the ADR-8 A/B arm is DESCOPED from S-D′.** The fork below is kept
> verbatim as the record of what was decided and against what alternative; it is **no longer a
> dispatch blocker**. Consequences now in force: §1 item 3 is descoped (a PR with no evaluation
> arm is conformant, not incomplete); §4 T2 is re-scoped to this stage's own before/after; ADR-8
> accrues its **second** recorded deviation, and its A/B window travels to the follow-on stage
> stubbed in §6. **The remaining gate on dispatch is the consumed-deliverable dependency alone —
> S-E + S-H + S-L as of rev 7 — and at rev 8 all three are merged (#1237 / #1239 + #1249 / #1263).**

The stage's first cold Phase -1 (2026-08-07) returned **STOP**. Every fork-independent finding
is fixed in rev 5 above. What remained was one genuine fork with no determinate best answer on
the project's merits, so it was logged, not decided:

**DECISION-NEEDED: does the ADR-8 A/B experiment belong in S-D′ at all, given that neither its
selection mechanism nor its second metric has a home inside §2's permitted set?**

- **Option A — descope the A/B from S-D′.** The stage ships subtraction maps + review-seat
  agent definitions + the #234 annotation; ADR-8 stays explicitly open with a named owner and
  a follow-on stage that owns the dispatch choreography. **Consequence:** the maps merge with
  no evaluation arm — so §3's «a PR that ships maps with no executable A/B arm fails the
  stage's purpose» must be **rewritten out**, not merely left unmet, and ADR-8 accrues a
  second recorded deviation.
  > **Rev-6 correction to this Option's own text — the quoted §3 sentence does not exist.**
  > Executing the descope required locating it; it is not in §3 and not anywhere in this file.
  > Verified by exhaustive grep over the whole kickoff, not by reading §3:
  > `grep -nE 'A/B|ADR-8|experiment|ledger|arm|purpose|evaluation'` returns, in the §3 region
  > (lines 165-264 at rev 5), only the `#optout-as-reflex` note about install-fingerprint
  > snapshots — nothing tying the stage's purpose to an executable arm. The A/B framing lived in
  > **§1 item 3** and **§4 T2** instead, and those are what rev 6 actually edits. The Option's
  > consequence is therefore satisfied by construction; the sentence it named was a rev-5
  > paraphrase of a line that had already been removed. Recorded rather than quietly ignored:
  > an instruction that points at absent text is a real defect in the fork's own statement.
- **Option B — widen §2 to the surfaces the experiment needs.** Grant this stage the dispatch-
  choreography home (the umbrella's ledger-schema section and/or
  `.claude/skills/dispatcher/SKILL.md`) plus `install.sh`'s agent skip-list, and define both
  the parity function over UUIDs and the review-defect-count instrument here. **Consequence:**
  the stage grows from «author maps» into «author maps + amend the dispatch protocol + amend
  the installer», crossing two other owners' surfaces mid-stage — the shape
  [CLAUDE.md `PR strategy`](../../../CLAUDE.md) exists to prevent — and its Tier-2 planning
  judgment now covers choreography it was never scoped to design.

**The INCONCLUSIVE is CLOSED at rev 6 — and it independently corroborates Option A.** The open
question was whether aif creates the task id before or after the dispatch prompt is composed.
**Answer: after.** The kickoff ships as the `description` field *inside* the `POST /tasks` request
body (`packages/runtime-bridge/src/AifHandoffBackend.ts:231-239`), and the id exists only in that
call's **response** (`:249`, `const taskId = (createResult as { id: string }).id`). The only
post-create mutation is `PUT /tasks/{id} {paused:false}` (`:260`); the sole other write is a
best-effort `DELETE` rollback on failure (`:263`) — no request edits `description` after creation.
**Therefore an arm selected by task-id parity cannot be written into the dispatch prompt without a
two-phase dispatch redesign**, which is a choreography change well outside a map-authoring stage —
independent grounds for Option A beyond the four findings in §1 item 3.
**Caveat, stated because it bounds the claim:** verified **client-side only**. `packages/api` was
not audited for whether a *paused* task's `description` is editable after creation; if it is, a
two-phase dispatch becomes cheaper — but that is a question for the §6 follow-on stage, and it does
not reopen this one.

**Dispatch status at rev 8 (2026-08-07): DISPATCHABLE.** The §5 blocker is **lifted**, and every
consumed-deliverable gate is now MET on both arms — S-E (#1237), S-H (#1239 + #1249) and **S-L
(#1263, merged 2026-08-07T12:50Z)**. S-L's re-priced P14 ranking, the ordering input for the
harness-side drops, is on `staging` at
[`…-s-l-recalculation.md`](../../../docs/meta-factory/research-patches/2026-08-07-s-l-recalculation.md);
read its **§5** before ordering anything — it is binding and counter-intuitive: **«A re-ranking is
not a rescale — S-D′ must re-derive rather than multiply through»**, because a uniform factor
preserves order by construction and would hide the effect. Note also that both hook injects are
levers a `/context`-ordered list ranks at **zero**. Rev 7's «S-L is not merged» is retired.
Do not let an executor «work around» the descoped arm in the other
direction either: re-introducing an A/B under a different name is the same scope-crossing this
resolution declined.

## §6 Follow-on stage stub — ADR-8's A/B, re-homed (rev 6)

Not a dispatchable kickoff: a **stub**, so the descoped arm has a named destination rather than an
open promise. Scoping it is its own act, and this stage does not perform it.

- **Owns:** ADR-8's experiment protocol as inherited at spec §1.5 — baseline before merge,
  20-dispatch window, deterministic A/B, owner closes with a verdict PR — for the *subtractive*
  shaping S-D′ ships.
- **Must resolve before it is dispatchable** (the four §1-item-3 findings, unchanged and still
  the entry criteria): a defined parity function over aif's UUID id space; a ledger whose arm
  column is populated (the three existing arm-less rows either backfilled or excluded, so the
  parity audit does not void the window on day one); an instrument and a producer for the
  **review-defect count**, ADR-8's second falsifier metric, which exists nowhere in the umbrella;
  and a home for the `install.sh` agent skip-list so two agent-definition variants do not ship to
  every consumer.
- **Plus the rev-6 finding:** the dispatch prompt predates the task id (§5 above,
  `AifHandoffBackend.ts:231-249`), so the parity split needs either a two-phase dispatch or a
  selector that is not the task id. Audit `packages/api` for description-editability of a paused
  task first — that is the cheap branch, and it was explicitly not audited here.
- **Permitted surfaces it will need** (why it could not live in S-D′): the umbrella's
  ledger-schema section, `.claude/skills/dispatcher/SKILL.md`, and `install.sh`'s skip-list —
  three owners S-D′ does not have, which is what made Option B a mid-stage scope crossing.
- **Inherits** the header's INPUT CONDITION: its baseline is captured from a pre-prune
  billing-projection snapshot, not re-derived at read time.
- **Depends on:** S-D′ merged (it evaluates what S-D′ ships).
