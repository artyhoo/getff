<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage S4 of the getff-honest-signals umbrella. Thin dispatch adapter — semantics are BINDING in the sources below, NOT restated here. -->

# getff-honest-signals-s4 — CI template targets the consumer's real default branch

> **Stage 4 of 6.** One stage = one PR onto `staging`. Do NOT do any other stage's work.
> **Binding sources (read both, in order):**
> 1. `.claude/orchestrator-prompts/getff-honest-signals-meta-launch/kickoff.md` §4 «Stage 4 / S4» + §5 AI-traps.
> 2. `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` §8.4 — BINDING for semantics.
>
> **Branch:** `fix/getff-honest-signals-s4`. **Base:** `staging`. **Precondition:** S3 merged.

## §0 ⚠ Entry gate (run FIRST — S3/S4 collide on generated baselines)

S3 also regenerated `tests/install-sh/baselines/*`. Before starting, on a clean `origin/staging`:

```bash
git fetch origin staging -q && SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

Expected: N pass / 0 fail. **Non-zero fail → S3's regen did not land cleanly. HALT and surface — do not
regenerate on top of a broken baseline.**

## §1 The defect

The shipped python CI workflow template hard-codes `main` as the trigger branch. A consumer whose default
branch is `master` (or anything else) installs a workflow that **never runs** — a CI setup that looks
installed and checks nothing.

**Live anchor (re-verify, T3):** `packages/core/templates/python/github-actions-ci.yml:15-18` —
`branches: [main]` appears on **both** the `push` and the `pull_request` trigger.

## §2 What to build

1. **Delivery substitutes the consumer's actual default branch** into the workflow at install time.
2. **Sweep sibling templates** for the same hardcoded `[main]` — this defect is a class, not one file.
   Report the full list you found and what you did with each.

## §3 «Works» — the paired fixture (binding)

RED pre-fix, GREEN post-fix, **both runs quoted** in the PR body.

- **Shape:** install into a repo whose default branch is `master` → the **delivered** workflow's triggers
  match `master` (assert on the delivered file's content, not on the template's).
- **T-HS-A (binding):** assert the **EXIT CODE / delivered-content check first**, wording second.
- Keep a case proving a `main`-default consumer still gets `main` — a substitution that always writes one
  value is the same bug with a different constant.
- **Fresh-install smoke must be green** (template delivery).

## §4 ⚠ Baseline regeneration — same PR, non-negotiable

Same obligation as S3. `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` in this PR, then verify with
`SNAPSHOT_MODE=compare` (N pass / 0 fail) and quote it. Pre-push `test:principles` does not cover these bash
install tests.

## §5 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists to prevent.

**Stage-specific park triggers (do NOT guess these — named in the meta-launch kickoff §4c):**

- **«What IS the consumer's real default branch» when the repo has no remote** (fresh `git init`, no `origin`).
  This is the named park trigger for this stage. Options differ in consequence — park with them stated, do not
  silently fall back to `main` (falling back to `main` is precisely the defect this stage removes).
- Whether a sibling template's `[main]` is **intentional** (e.g. a framework-internal workflow that genuinely
  targets this repo's own branch) rather than a consumer-facing bug — park with the file rather than rewriting it.

## §6 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for this stage: T3, T7, T14, T15, T19, T21.**

- **T3** — re-verify `:15-18` and every sibling hit live; quoted output mandatory.
- **T7 / T14** — the theme is a signal that lies: a workflow that installs but never triggers is exactly that.
- **T15** — apply the sweep to this framework's own workflow templates and report what it found.
- **T19** — own cold-review before handoff.
- **T21** — backward-check enumerates sibling surfaces the diff did NOT touch, never restates the PR.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-HS-A (umbrella)** — asserting on message TEXT instead of the delivered artefact's content.
- **T-S4-A (this stage)** — **testing the template instead of the delivery.** Asserting that the *template* now
  contains a placeholder proves nothing about what the consumer receives. Counter: §3 — the fixture installs
  into a `master`-default repo and asserts on the **delivered** workflow file.
- **T-S4-B (this stage)** — **fixing the one named file and skipping the sweep.** §2 item 2 is half this stage;
  a PR touching only `github-actions-ci.yml` leaves the class open. Counter: report the sweep list explicitly,
  including «no other hits found» if that is genuinely the result (with the command that established it).

## §7 Anti-scope

- Do NOT touch any other stage's surface (mutation runner, lychee/pre-push, datetime rules, refresh, `inject-matching-rule`).
- Do NOT write `done.md` — closure belongs to S6.
- Do NOT add npm deps.

## §8 PR body — §1.7 REQUIRED

This stage edits `packages/core/templates/**` (§4b path list) → the PR body **MUST** carry both
`### §1.7 Forward-check applied` and `### §1.7 Backward-check applied` (H3, literal «applied», ≥40
non-whitespace chars and ≥1 `path.ext:N` citation each). Run the meta-launch kickoff §4b pre-flight grep
before `gh pr create`. **Do NOT use the `### §1.7 Skipped:` escape hatch** — a baseline regen bundled with a
real template change is not «purely structural».

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
