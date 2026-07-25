# stale-pending-claims — kickoff

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** I-phase — one mechanical truth-sweep over a bounded population of doc claims.
> **Origin:** the `aif-live-smoke-run0` acceptance run, 2026-07-25. While probing runtime state,
> two claims in always-loaded discipline docs were found to contradict `origin/staging`. Both are
> proven below by command **before** this kickoff was written — this is not a speculative cleanup.
> **Deliverable:** one PR against `staging` correcting every false claim in the §1 population and
> leaving every still-true claim with the command that proves it.
> **Base branch:** staging.

## §0 Cold-start context — self-contained, read only this

**The project's thesis.** Every codified rule is an executable artefact that fails at the earliest
reachable channel; a doc is the channel for the part that cannot be gated. The whole point is that
**an AI agent cannot silently bypass an undocumented convention.** A doc that *misdescribes a
binding mechanism* is therefore worse than a missing doc: the agent reads it, believes it, and
acts on a false model of the gate. `CLAUDE.md` and `.claude/rules/**` are injected into every
session, so a false claim there is maximally load-bearing.

**What a «pending claim» is.** A sentence asserting that some artefact is *not yet* real — «impl
pending», «not yet landed/merged/built», «until X merges», «deliberately not built», «banked fix»,
«is a follow-up». Each such sentence was true when written. Each becomes a lie the moment the thing
lands, and **nothing in this repo re-checks them** — there is no gate for «is this doc's claim about
the future still accurate?». That is the defect class this sweep closes for the current population.

**Why the fix is mechanical, not a design exercise.** For every claim the deciding question is one
command against `origin/staging`: does the named artefact exist / does the named PR appear in the
log / does the named line still read that way. The claim is then either corrected or kept. No
architecture decision is involved — where one *is* involved, §5 tells you to park it, not to solve it.

## §1 The population (bounded — re-enumerate live per T3, do not trust this count)

Run this from the repo root; it is the population definition:

```bash
grep -rniE "impl pending|not yet (landed|merged|built|shipped)|until .{0,40} (merges|lands|ships)|banked fix|deliberately not built|is a follow-up" CLAUDE.md .claude/rules/*.md
```

At authoring time (2026-07-25, `origin/staging` = `4bf244782`) this returned **12 hits across 5
files**: `CLAUDE.md` ×1, `.claude/rules/zcode-parity-doctrine.md` ×6,
`.claude/rules/autonomous-loop-continuity.md` ×1, `.claude/rules/destination-environment-verification.md` ×1,
`.claude/rules/memory-codification.md` ×1 (plus regex overlap). **The count will drift — re-run the
grep and work the list you actually get.** Report the number you enumerated (T10: population before
sampling; a sweep that reports «fixed 2» without stating the population size is not a sweep).

## §2 Two anchors already proven stale (verify, then fix — do not re-derive)

### Anchor A — `CLAUDE.md:132` misdescribes a binding dispatch gate

The «Marker value rule» paragraph states:

> `AifHandoffBackend._resolveProfileId` is a case-insensitive **substring** match with **no
> exact-match priority** (`packages/runtime-bridge/src/AifHandoffBackend.ts:131`) […] The
> resolver-side fix (exact-match short-circuit before substring) is a banked fix-pointer […] —
> until it lands, this authoring rule is the only channel.

**This is false on `origin/staging`.** Proof:

```bash
git show origin/staging:packages/runtime-bridge/src/AifHandoffBackend.ts | grep -n "Exact name match wins\|exact.length > 0"
# 137:    // Exact name match wins: a profile whose name IS the hint is never ambiguous,
# 141:      exact.length > 0 ? exact : profiles.filter((p) => p.name.toLowerCase().includes(needle));
```

Three separate defects in that one paragraph: (a) «no exact-match priority» — the priority exists;
(b) the `:131` line anchor no longer points at the match logic; (c) «until it lands, this authoring
rule is the only channel» — it landed, so there are now two channels and the authoring rule is a
belt-and-braces, not the sole one. **The binding *advice* (pick a value matching exactly one row)
stays correct and MUST survive the edit** — an exact name that is also a prefix of another profile's
name is now safe, but an *abbreviation* still matches ambiguously. Correct the mechanism
description and the anchor; do not delete the rule.

### Anchor B — `zcode-parity-doctrine.md` §3 claims four merged stages are unimplemented

Rows for Stage `2 / 6`, `5`, `7B`, `9C` read `Decided; impl pending Wave B …` with an empty PR
column. **All four are merged on `origin/staging`.** Proof:

```bash
git log origin/staging --oneline | grep -iE "zcode-parity\): S(5|6|7B|9C)"
# 0151ff4ed feat(zcode-parity): S7B — extend inject-subagent-context for full SubagentStart parity (#1047)
# 52f6b8485 feat(zcode-parity): S5 — warn-subagent-report ZCode variant (4D hybrid) (#1046)
# db6ce7f0c feat(zcode-parity): S9C — end-of-turn-reminder ZCode arm (multi-turn via rollout) (#1044)
# e6d625784 feat(zcode-parity): S6 — 2B-standardize (env-first REPO_ROOT universally) + generator + pre-commit + twin-generation test (#1043)
```

The stale status propagates **inside the same doc** — these are part of the same fix, not extra scope:

- **§3 status column** — four rows flip to `Implemented` with their PR numbers.
- **§2 census row 19** (`warn-subagent-report`) — carries `cc-only` → **parity-pending Wave B Stage 5**; Stage 5 merged, so the pending qualifier is spent.
- **§4 Row 19 / Row 16 / Row 13 rationale** — each says «Status: … impl pending Wave B» or «Wave B Stage 7B upgrades this fallback»; re-word to what merged.
- **§5 agnosticism tier table** — the ZCode row's «13 framework hook twins shipped» count predates Stage 6's twin-generation work. **Re-count it from the tree; do not carry the number forward.**

**One consequence is explicitly NOT yours to fix — see §5 park trigger 1.**

## §3 What to do — the whole «how», in one sentence

For **each** hit in the §1 population: run the one command that decides the claim; if the claim is
**false**, correct the sentence in place and cite what landed it (PR number and/or SHA, plus a
`file.ext:N` anchor re-checked live); if the claim is **still true**, leave it and add the command
or `file:line` that proves it is still true. **No hit may be left unexamined**, and every verdict
carries its evidence inline. That is the entire task; §2 pre-solves the two hardest cases.

Report per hit in this shape (this is the acceptance format):

```text
<file>:<line>  CLAIM=<one-line quote>  VERDICT=STALE|STILL-TRUE  EVIDENCE=<command output / file:line>  ACTION=<edited how | left as-is>
```

## §4 «Works» — the checks that decide acceptance

Both `.claude/rules/**` and `CLAUDE.md` carry structural gates; a truthful edit that breaks a
header is still a fail.

- Editing any `.claude/rules/*.md` **header** obliges a rule-index regen in the **same** PR:
  `npx tsx scripts/render-rule-index.mjs --write`. Commit the regenerated
  `.claude/rules/00-rule-index.md` if it changes; a hand-edit of that file is a fail (it says
  «generated, do not hand-edit» at line 1).
- **600-line markdown gate** (pre-commit): `wc -l` any file you grow. `zcode-parity-doctrine.md`
  is the one at risk — prefer replacing stale words over appending new paragraphs.
- The `discipline-self-check` CI job triggers on `.claude/rules/**` and `CLAUDE.md`, so the PR body
  §1.7 sections are **mandatory** — see §8.

```bash host-verify
npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts
npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts
npx tsx scripts/render-rule-index.mjs --check
```

## §5 Park-don't-guess contract (aif agent — non-negotiable)

On ANY genuine fork — two defensible edits, an undecided design choice, a behaviour change the
sources do not fix — **do NOT pick.** Park it as a question (state it as «Option A → consequence X /
Option B → consequence Y»), stop that thread, and proceed on the unambiguous parts. Guessing a fork
to keep moving is the failure this loop exists to prevent.

**Two park triggers are named in advance. Do not implement either.**

1. **The D3 runtime loud-declaration sync — PARK, DO NOT CODE.**
   `zcode-parity-doctrine.md` §4 Row 19 says the runtime declaration in
   `scripts/render-harness-config.mjs` is «intentionally NOT updated in this PR (defers to the Wave B
   implementation PR)». That deferral has expired — Stage 5 merged — and the declaration still reads
   `NO backup: warn-subagent-report … CC-only` (verify:
   `git show origin/staging:scripts/render-harness-config.mjs | sed -n '250,262p'`). Changing what
   the renderer *declares at runtime* is a behaviour change with a wording call, and it has its own
   snapshot/twin consequences. **Your job is to park it with both options and the evidence**, and to
   make the doc honest about the *current* state (i.e. that the sync is outstanding) without editing
   the renderer. Fixing the doc while leaving the code is the correct half here — say so explicitly.
2. **`memory-codification.md` «PENDING settings.json WIRING».**
   `.claude/settings.json` is agent-uncommittable by design and may be untracked, so «is the hook
   wired?» may be unverifiable from the tree alone. If you cannot decide it by command, **leave the
   claim untouched and record why it is unverifiable** — do not guess either way, and do not edit
   `settings.json`.

## §6 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).
**Active traps for this stage: T2, T3, T7, T10, T14, T15, T20, T21.**

- **T2** — designing ≠ sweeping. «My method would find the stale ones» is not a finding; each hit needs its command and its verdict.
- **T3** — no prose-only verdicts. Every `STALE` / `STILL-TRUE` carries command output or `file:line` content.
- **T7** — do not pattern-match this kickoff. §2's two anchors are pre-proven; the *rest* of the population is yours to decide, and §1's count is explicitly expected to be wrong.
- **T10** — enumerate the population **before** reporting coverage. «Fixed N» without the denominator is not a result.
- **T14** — a hit you could not decide is `INCONCLUSIVE`, not `STILL-TRUE`. Do not launder «I did not verify it» into «it is fine».
- **T15** — self-application: this sweep's own PR body will contain claims about what it did. Do not write a §1.7 whose claims are the very class of claim you are auditing.
- **T20** — no verdict without an evidence-bearing call in the same breath.
- **T21** — the backward-check enumerates **sibling surfaces the diff did NOT touch** (other always-loaded docs that carry future-tense claims — `.claude/skills/*/SKILL.md`, `agents/*.md`, `docs/meta-factory/*.md`), with grep evidence per surface. A backward-check whose surface list equals this PR's own file list is non-conformant.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-SPC-A — «rewrote the sentence, never ran the command».** The tempting shape is to *soften* a
  stale claim into vagueness («may not yet be landed») instead of deciding it. A hedge is not a
  correction; it makes the doc unfalsifiable, which is strictly worse than a dated lie. Counter: §3's
  per-hit report format has no «hedged» verdict — only `STALE`, `STILL-TRUE`, or `INCONCLUSIVE` with
  the reason it could not be decided.
- **T-SPC-B — «fixed the §3 status row, left the four downstream sentences».** Anchor B's staleness
  appears in **five** places in one file (§2 census, §3 table, §4 ×3 rationales, §5 tier table);
  flipping only the obvious status table reads as complete and leaves the doc self-contradicting.
  Counter: after editing, re-grep that file for the stage identifiers (`Wave B`, `Stage 5`, `S7B`,
  `9C`, `pending`) and show the grep is clean or justified.

## §7 Anti-scope

- Do **NOT** edit `scripts/render-harness-config.mjs` or any hook/twin — park trigger 1.
- Do **NOT** edit `README.md` (`§Why this exists`), `docs/meta-factory/PROPOSAL.md`, or anything
  under `docs/meta-factory/retros/` — Artifact Ownership Contract, [CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md).
- Do **NOT** edit `.claude/settings.json` (agent-uncommittable) or `.claude/rules/00-rule-index.md` by hand (regenerate it).
- Do **NOT** rewrite any rule's *substance* — this is a truth-sweep over claims about
  implementation state, not a rule revision. If a claim is false because the **rule** is wrong
  (not because the artefact landed), that is a park, not an edit.
- Do **NOT** add npm dependencies. Do **NOT** write `done.md` — closure belongs to the harvesting session.

## §8 PR body — §1.7 REQUIRED

This PR edits `.claude/rules/**` and `CLAUDE.md`, both in the `discipline-self-check` trigger path
list ([.github/workflows/discipline-self-check.yml:14-20](../../../.github/workflows/discipline-self-check.yml)),
so the body **MUST** carry both `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied`
— H3 headings, the literal word «applied», ≥40 non-whitespace characters and ≥1 `path.ext:N`
citation in each. Do **not** reach for the `### §1.7 Skipped:` escape hatch: correcting the
description of a binding dispatch gate is not «purely structural».

Include the full per-hit table from §3 in the body — it is the evidence the reviewer grades.
