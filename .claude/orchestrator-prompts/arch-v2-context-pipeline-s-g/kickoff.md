<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage-scoped dispatch input — S-G of the arch-v2-context-pipeline umbrella (economy small-fixes 2, added by the 2026-08-06 decision-layer spec). Tier 1 — every item's «how» is one determinable sentence below; the judgment (keep-list, digest scope, renderer edits) is ALREADY ENCODED here by the /arch contour. Marker: re-verify uniqueness + the fidelity precondition at dispatch per the umbrella §0. RE-ISSUED rev 4 (2026-08-06 /arch re-planning after a Phase -1 REVISE): P5a mechanism replaced (pointer-collapse, no @AGENTS.md import — spec §1.6 FORK A), D1b digest homed + renderer granted (§1.6 FORK B), P8 redefined with a decidable acceptance pair (§1.6 FORK D); this stage now runs FIRST of the remaining stages, before S-E. -->

# arch-v2-context-pipeline S-G — economy small-fixes 2

> **Stage goal:** execute the cheap, fully-specified economy items of the decision-layer spec:
> the bounded `CLAUDE.md` trim + traps digest (D1/D1b), the re-write-trigger discipline embeds,
> the inlined-dispatch template default, the rule-index channel realign, and the ADR-template
> wiring. **Design SSOT (read in full):**
> [`2026-08-06-pipeline-token-economy-design.md`](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
> — §1 D1 row (trim bounds + D1b digest + rollback trigger), §1.6 FORK A/B/D (the rev-4
> resolutions this re-issue implements), §3 rows P5-P8 + P12, §0.6
> (agnosticism). Umbrella context: [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md).
>
> One PR, no scope beyond the six items below. A systemic issue noticed mid-stage is a PR-body
> observation, never an extra PR ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

**Base:** `origin/staging`. **Mode:** implementation, one PR onto staging.

## §1 Items (each «how» is one sentence — Tier-1 by construction)

1. **P5a — `CLAUDE.md` pointer-collapse (MECHANISM REPLACED rev 4, spec §1.6 FORK A):**
   collapse the `## Read-first (Step 0)` and `## Project goal pointer` sections
   (`CLAUDE.md:8-17`, measured 1,369 B) to one-line pointers at
   `.claude/session-bootstrap.md` and `README.md#why-this-exists` (keep the one-line
   «contradicting doc has drifted, not README» rule as part of the goal pointer line — it is
   judgment-bearing residue, T18). **Do NOT introduce an `@AGENTS.md` import** — measured to
   ADD 8,861 B resident to remove 1,369 B (net +7,492 B/expensive seat) and to double-load
   the rule-index region. Sized target: `wc -c CLAUDE.md` delta ≤ **−1,100 B** net.
   > **SUPERSEDED (rev 4, preserved per T18):** the rev-3 instruction — `@AGENTS.md` import
   > + fresh-session render check + ZCode `@`-import degradation check — is retired WITH the
   > import; do not execute any of it.
2. **P5b — KEEP-LIST (binding, do NOT trim):** Task-tier routing (`CLAUDE.md:106` region),
   the marker-value rule (`:132` region), PR strategy, Operational conventions (harness
   gates), Umbrella closure, Pre-dispatch in-flight probe, Artifact Ownership Contract.
   These are judgment-bearing or sole-home sections — pointer-collapsing any of them is a
   REVISE at review.
3. **P5c — D1b traps digest (HOMED rev 4, spec §1.6 FORK B):** author the resident hot
   digest at **`.claude/rules/ai-laziness-digest.md`** — every `ai-laziness-traps.md` §2
   T-number + its one-line counter, **≤ 8,192 B** (`wc -c`), **no `paths:` frontmatter**
   (residency flows from `paths:`-absence; the file carries the standard authority header +
   a pointer to the full catalogue); re-scope the full catalogue to
   `paths:` (rule/kickoff/research-patch/skill/agent authoring surfaces — mirror the
   `source-before-shape.md` glob family); ship the deterministic anti-drift
   test at slot **35** (every §2 T-number has a digest line whose counter is an exact
   prefix/quote); record the rollback trigger in the digest rule
   (`ONE senior-seat incident of a digest-under-carried trap → full residency restored`).
   **Tier-0 registry bookkeeping, same PR — ALL FOUR copies, or your own suite goes red
   (spec §1.6 FORK B, round-4 B-1/B-2/M-1):** swap `ai-laziness-traps` →
   `ai-laziness-digest` in (1) `scripts/render-rule-index.mjs:56-60` `TIER0_CORE`; (2)
   `packages/core/principles/31-rule-channel-declaration.ts:58-64` `ALWAYS_ON_CORE` — this
   one is LOAD-BEARING: branch (c) of its 4-branch gate is the only branch a `paths:`-less
   digest can pass, and the set is capped at 4 by a module-load throw, so the swap (not an
   append) keeps the cap; (3) the exact-membership array in
   `packages/core/principles/31-rule-channel-declaration.test.ts` («contains the 4 expected
   rule basenames»); (4) `scripts/render-rule-channels.mjs:75-79` `ALWAYS_ON_CORE` (the
   harness-degradation matrix's in-scope predicate — a stale copy leaves the digest with no
   per-harness verdict, silently). The `00-rule-index.md` member stays in every copy.
   **Regen BOTH render targets:** `render-rule-index.mjs --write` also rewrites the
   `AGENTS.md` rule-index fenced region — commit that hunk; it is generated output, in scope
   (§2), and the principle-21 agnosticism probe requires it once the digest file exists.
   Index headroom is **66 B** (4,030 of 4,096) — first trim
   verbose `Fires:` cells per the script's own comment (this edits the header lines of OTHER
   rule files — explicitly in scope for this item, not scope creep), and only if the regen
   still exceeds
   the ceiling raise `INDEX_MAX_BYTES` to 4,608 with the required reasoning comment.
   **Matrix honesty (round-2 N-1 — there is NO rendered matrix artefact; `--write` only
   scaffolds a missing manifest and never overwrites):** the matrix is in-memory (`--json` /
   `--check`); the honesty layer is the HAND-EDITED manifest
   `.ai-factory/rule-channel-degradations.json` (reviewed data, per the script's own
   header). Update it in this PR: add the `ai-laziness-digest` degradation rows (e.g. its
   `zcode` verdict `degraded(session-start-hook)`) and correct the existing
   `ai-laziness-traps` rows to the post-re-scope reality (`degraded(edit-time-inject)`
   family) — a stale row here is exactly the «undocumented degradation» zcode-parity
   forbids, and `--check` will NOT catch a wrong `target` (it compares only the `degraded`
   prefix). Quote `render-rule-channels.mjs --json` for both rules in the PR body.
   **Channel twin (round-2 N-6 — decided, do not re-derive):** the traps re-scope ships
   BOTH `paths:` frontmatter AND the `<!-- globs: -->` edit-time-inject marker with
   IDENTICAL glob sets (all scopes are `prefix/**`-expressible, so the
   `inject-matching-rule.sh` subset covers them; dual-pair invariant per
   `rule-enforcement-channel-selection.md §4`, family precedent `source-before-shape.md`).
   **Test seed (round-2 N-3):** `tests/agnosticism/harness-self.test.sh` seeds its
   Tier-0-shaped rule by REAL NAME (`ai-laziness-traps.md`, `:78`) — re-seed with
   `ai-laziness-digest.md`, or the Tier-0 branch of `computeVerdict` silently loses
   coverage while the assertion stays green.
   `.claude/rules/*` edits travel as a maintainer-reviewed PR (Artifact Ownership Contract) —
   the PR IS the handoff.
4. **P6 — re-write-trigger discipline embeds:** add to the cold-seat-economy skill-embed
   blocks (`harvest/SKILL.md`, `dispatcher/SKILL.md`): prefer artifact handoff to a fresh seat
   over `/compact`; do not stretch a seat across the 1-hour TTL idle gap; avoid mid-session
   model/effort switches and MCP toggles on a fat context — each invalidates the cached
   prefix and re-bills it at write price (pending S-H P3d verification of the config-change
   class — rev 4 moved P3d there). Same handoff rule.
5. **P7 — inlined-dispatch template default:** make the inputs-inlined dispatch format the
   documented default in the dispatcher/harvest dispatch templates, with the promotion trigger
   quoted (3 incidents of >100k file-reading seats → mechanical check in S-B's station).
6. **P8 + P12 (P8 REDEFINED rev 4, spec §1.6 FORK D — the rev-3 wording was
   undischargeable: the renderer never reads `probe-channels.sh`, and its acceptance was
   already green on unmodified staging).** The named drift, each with a decidable fix:
   (a) `deriveChannels` (`render-rule-index.mjs:86-97`) emits one entry per
   `<!-- channel: -->` marker — `00-rule-index.md:15` renders `skill-embed, skill-embed` for
   `cold-seat-economy.md`'s two embed targets; fix: aggregate repeated mechanisms to
   `skill-embed(2)`. (b) `probe-channels.sh:19` greps `'<!-- globs:'` unanchored and
   false-positives on PROSE mentions — `phase-research-coverage.md:21` documents «no globs
   marker, by design (T-SEF-A)» yet the probe reports `globs=yes`; fix: anchor the grep to a
   marker at line start (`^<!-- globs:`). (c) **NOT drift — do not «fix»:** the
   `phase-research-coverage` row rendering `paths:(4)` without `edit-time inject` is CORRECT
   (that rule deliberately has no globs sibling); adding the channel would regress a
   documented design decision. Then regen `npx tsx scripts/render-rule-index.mjs --write`
   (never hand-edit the generated index). P12: wire the `engineering:architecture` ADR
   template as /arch §1's
   spec-format slot (thin-wrapper line in `arch/SKILL.md`, trio §A2 G1 cited).
   **Slot note:** this stage's anti-drift test takes slot **35**, PRE-ASSIGNED —
   do NOT re-derive «next free» (S-E, which dispatches after this stage merges, holds **34**;
   highest existing is `33-`).

## §2 Permitted files

`CLAUDE.md`, `.claude/rules/*` incl. the new `ai-laziness-digest.md`
(maintainer-reviewed PR), `.claude/skills/harvest/SKILL.md`, `.claude/skills/dispatcher/SKILL.md`,
`.claude/skills/arch/SKILL.md`, **`scripts/render-rule-index.mjs` + `scripts/probe-channels.sh`
+ `scripts/render-rule-channels.mjs` (granted rev 4, spec §1.6 FORK B/D — exactly the §1
item 3/6 edits, nothing broader)** +
`.claude/rules/00-rule-index.md` (regen only), **`AGENTS.md` — the generated `rule-index`
fenced region ONLY, written by `--write`, never hand-edited** (round-4 B-1: the regen's
second target; any hunk outside the `getff:begin section=rule-index` … `getff:end` fence is
a violation), `packages/core/principles/*` (anti-drift test +
allowlist + the principle-31 `ALWAYS_ON_CORE` swap in module and test, §1 item 3),
`tests/install-sh/*` (snapshot regen if agent/rule fingerprints shift),
`.ai-factory/rule-channel-degradations.json` (ONLY the `ai-laziness-digest` /
`ai-laziness-traps` rows — §1 item 3 matrix honesty), and
`tests/agnosticism/harness-self.test.sh` (ONLY the §1 item 3 seed swap).
NOT permitted: `AGENTS.md` outside the generated region,
`scripts/measure-always-on.sh` / `scripts/check-alwayson-budget.sh` (S-E owns the meter and
the gate — dispatches after this stage).

## §3 Acceptance

```bash host-verify
npx vitest run packages/core/principles
npx tsx scripts/render-rule-index.mjs --check
npx tsx scripts/render-rule-channels.mjs --check
```

(The contract is non-mutating — round-4 minor: `--write` runs during the work, `--check`
decides acceptance; `--check` covers BOTH render targets, including the `AGENTS.md` region.)

Plus review-time (all quoted in the PR body):

- **Keep-list intact:** keep-list sections byte-identical (git diff shows no hunk touching
  them).
- **Resident-set table, before/after (spec §1.6 FORK A — the acceptance is on the SET, not
  one file):** for each file in {`CLAUDE.md`} ∪ {`.claude/rules/*.md` lacking `^paths:`
  frontmatter, minus `claudeMdExcludes` entries}, `wc -c`, plus the total. Expected at base:
  69,453 B over 5 files (spec §1.6 FORK D). Expected after: `CLAUDE.md` ≤ −1,100 B,
  `ai-laziness-traps.md` OUT of the set (gains `paths:`), `ai-laziness-digest.md` IN
  (≤ 8,192 B), total ≈ ≤ 50.2 KB. `grep -c '@AGENTS' CLAUDE.md` → 0.
- **P8 acceptance pair (spec §1.6 FORK D):** BEFORE — `bash scripts/probe-channels.sh |
  grep phase-research-coverage` shows `globs=yes` (false-positive) and `grep -n 'skill-embed,
  skill-embed' .claude/rules/00-rule-index.md` hits; AFTER — `globs=no` on that row, zero
  duplicated mechanisms in any Channel(s) cell, `npx tsx scripts/render-rule-index.mjs
  --check` green, index ≤ `INDEX_MAX_BYTES`.
- **Anti-drift discrimination:** the slot-35 test fails when a digest line is deleted
  (mutation shown once).
- **Tier-0 quadruple swap complete (round-4 B-2/M-1):** `grep -rn 'ai-laziness-traps'
  scripts/render-rule-index.mjs scripts/render-rule-channels.mjs
  packages/core/principles/31-rule-channel-declaration.ts
  packages/core/principles/31-rule-channel-declaration.test.ts` returns ZERO Tier-0-set
  hits (mentions outside the set literals are fine — quote the grep); `render-rule-channels.mjs
  --json` output quoted showing `ai-laziness-digest` rows with per-harness verdicts AND the
  corrected `ai-laziness-traps` rows; the manifest rows match those verdicts (N-1); the
  `harness-self.test.sh` seed swapped and the suite green (N-3).
- Every trimmed section's new home is named (T18).

## §3a Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
defensible implementations, an undecided design choice, a missing spec detail that changes
behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
Y») and **stop that task.** Proceed only on the unambiguous parts.

Expected to fire here on: **(a)** P5b, on any section where «is this the
keep-list or is this duplicative?» is genuinely arguable — the keep-list is binding and a
touched keep-list hunk is a REVISE (T-SG-A), so park the borderline section rather than
trimming it; **(b)** P5c, when a T-number's counter cannot be compressed without paraphrase —
the anti-drift test requires an exact prefix/quote, not a paraphrase (T-SG-B), so park rather
than loosen the test to fit the digest; **(c)** P5c renderer bookkeeping, if after trimming
`Fires:` cells the regen STILL exceeds even the raised 4,608 B ceiling — park with the two
candidate next steps (split the index vs raise again) rather than picking. (The rev-3
expected-fork (a) — ZCode `@`-import honour — is gone with the import, spec §1.6 FORK A.)
Never manufacture a quoted fresh-session observation.

## §3b Stage neighbours (rev 4 — S-E dispatches AFTER this stage merges)

> **SUPERSEDED (rev 4, preserved per T18):** the rev-3 text here said S-E «runs
> concurrently» and prescribed worktree isolation + merge-forward against it. The spec
> re-derived the order (§1.6 FORK D): **this stage merges FIRST**; S-E's ceilings derive
> from the post-S-G resident baseline, and S-E's base precondition checks for this stage on
> staging.

Slot bookkeeping survives the re-order: this stage holds principle-test slot **35**; S-E
holds **34**. If staging moves mid-stage for any unrelated reason, resolve by **merging
staging into this branch** — never `git rebase` a published branch
([git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md)).

## §4 AI-traps

See [`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) (cited per §3 of that rule).
**Active traps for this stage: T1, T3, T7, T15, T18, T20.** T1/T7 — the keep-list is checked
section-by-section, not pattern-matched from this kickoff's summary; T3 — the before/after
byte counts are command outputs, not estimates; T15 — the digest itself is discipline-bearing:
its PR carries the §1.7 self-check; T18 — trimmed prose with unique residue is RELOCATED
(pointer to its new home), never deleted; T20 — every «before/after» and «probe shows X»
claim in the PR body is a quoted command output, not an assumption.
**T-SG-A — trim-past-the-keep-list:** the pointer-collapse momentum carrying into a keep-list
section because it «looks duplicative». Counter: §3's byte-identity check on keep-list
sections is the acceptance gate — a single touched keep-list hunk is a REVISE.
**T-SG-B — digest-drift-by-paraphrase:** digest lines paraphrasing counters until they no
longer match the catalogue. Counter: the anti-drift test asserts T-number presence AND the
counter line is an exact prefix/quote of the catalogue's counter, not a paraphrase.
