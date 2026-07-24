<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage S5 of the getff-honest-signals umbrella. Thin dispatch adapter — semantics are BINDING in the sources below, NOT restated here. -->

# getff-honest-signals-s5 — refresh reconciles renames + stale companions

> **Stage 5 of 6.** One stage = one PR onto `staging`. Do NOT do any other stage's work.
> **Binding sources (read both, in order):**
> 1. `.claude/orchestrator-prompts/getff-honest-signals-meta-launch/kickoff.md` §4 «Stage 5 / S5» + §5 AI-traps.
> 2. `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` §8.5 — BINDING for semantics.
>
> **Branch:** `fix/getff-honest-signals-s5`. **Base:** `staging`. **Precondition:** S4 merged.

## §1 The defect

`refresh` leaves a consumer's install in a **half-migrated** state that looks current:

1. **Renamed skill dir.** The framework renamed `rules-as-tests` → `getff`. A consumer who installed before
   the rename ends up with **both** `.claude/skills/rules-as-tests/` and `skills/getff/` after refresh. The
   superseded dir is framework-owned and stale, but it still looks like a live skill.
2. **Stale consumer-owned companion.** The shipped `.lintstagedrc` template
   (`packages/core/templates/shared/.lintstagedrc.json`, which carries `eslint --fix --max-warnings=0`) has
   moved on, but the consumer's own `.lintstagedrc` is **theirs** — silently overwriting it destroys their work.

## §2 What to build — DECIDED (do not redesign)

The two halves get **deliberately different** treatment, because ownership differs:

| Artefact | Owner | Refresh behaviour |
|---|---|---|
| `.claude/skills/rules-as-tests/` | **framework** | **REMOVE** the superseded dir when `skills/getff/` is delivered |
| `.lintstagedrc` | **consumer** | **PRINT a migration offer** (the diff + what to do). **NEVER overwrite, never delete.** |

The asymmetry is the whole point: we may reclaim what we own; we may only *advise* on what the consumer owns.

## §3 «Works» — paired fixtures (binding)

RED pre-fix, GREEN post-fix, **both runs quoted** in the PR body.

1. **Pre-rename install → refresh → exactly ONE skill dir remains** (`skills/getff/`; the superseded
   `rules-as-tests` dir is gone).
2. **Stale `.lintstagedrc` → refresh → the offer is printed AND the file is byte-identical to before.**
   Assert the file is untouched — this is the load-bearing half. A test that only greps for the offer text
   would pass even if refresh clobbered the file.

- **T-HS-A (binding):** assert **exit code / filesystem state first**, wording second.

## §4 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists to prevent.

**Stage-specific park triggers (do NOT guess these — the first is named in the meta-launch kickoff §4c):**

- The **migration-offer text format** — a wording/UX fork the spec does not fix. Park it; do not invent a format.
- Whether the consumer has **modified** the framework-owned `rules-as-tests` dir (so removing it would destroy
  consumer work). If you cannot establish ownership cheaply, park rather than deleting — deletion is the
  irreversible branch.

## §5 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for this stage: T3, T7, T14, T15, T17, T18, T19, T21.**

- **T3** — verify the shipped-template and skill-dir paths live before relying on them.
- **T7 / T14** — a refresh that reports success while leaving a half-migrated tree is this umbrella's defect class.
- **T15** — run refresh against a fixture built from this framework's own delivery and report.
- **T17 / T18 (load-bearing here)** — this is the one stage that **deletes**. Preserve future-value content
  before any destructive step, and never delete a redundant artefact whose unique residue has not been preserved.
- **T19** — own cold-review before handoff.
- **T21** — backward-check enumerates sibling surfaces the diff did NOT touch, never restates the PR.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-HS-A (umbrella)** — asserting on message TEXT instead of filesystem state.
- **T-S5-A (this stage)** — **applying the framework-owned treatment to the consumer-owned file.** Both halves
  are "stale artefact reconciliation", so it is tempting to write one code path for both. Overwriting or
  deleting a consumer's `.lintstagedrc` destroys their work irreversibly. Counter: §2's table is two behaviours,
  and fixture 2 asserts byte-identity of the consumer file.

## §6 Anti-scope

- Do NOT touch any other stage's surface (mutation runner, lychee/pre-push, datetime rules, CI templates, `inject-matching-rule`).
- Do NOT overwrite or delete ANY consumer-owned file.
- Do NOT write `done.md` — closure belongs to S6.
- Do NOT add npm deps.

## §7 PR body

If the diff touches `packages/core/templates/**`, `.claude/skills/**`, `agents/**`, `.claude/rules/**`,
`packages/core/principles/**`, or `CLAUDE.md`, the **§1.7 Forward/Backward sections are REQUIRED** (H3 headings,
literal «applied», ≥40 non-whitespace chars and ≥1 `path.ext:N` citation each) — see meta-launch kickoff §4b and
run its pre-flight grep before `gh pr create`. If template deliveries shift install fingerprints, regenerate
baselines (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) in this same PR and quote a
`SNAPSHOT_MODE=compare` run.
