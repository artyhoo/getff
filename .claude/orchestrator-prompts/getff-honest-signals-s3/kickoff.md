<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage S3 of the getff-honest-signals umbrella. Thin dispatch adapter — semantics are BINDING in the sources below, NOT restated here. -->

# getff-honest-signals-s3 — datetime false positive, BOTH rules

> **Stage 3 of 6.** One stage = one PR onto `staging`. Do NOT do any other stage's work.
> **Binding sources (read both, in order):**
> 1. `.claude/orchestrator-prompts/getff-honest-signals-meta-launch/kickoff.md` §4 «Stage 3 / S3» + §5 AI-traps.
> 2. `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` §8.3 — BINDING for semantics.
>
> **Branch:** `fix/getff-honest-signals-s3`. **Base:** `staging`. **Precondition:** S2 merged.

## §1 The defect

Both shipped python datetime rules fire on **correct, timezone-aware** code. A consumer who writes the
*recommended* form gets a red error for doing the right thing.

**Live anchors (re-verify, T3):**

| File | Line | Current pattern |
|---|---|---|
| `packages/core/templates/python/.getff/astgrep-rules/getff-no-datetime-now.yml` | `:9` | `pattern: "datetime.now($$$ARGS)"` |
| `packages/core/templates/python/.getff/astgrep-rules/getff-no-datetime-datetime-now.yml` | `:9` | `pattern: "datetime.datetime.now($$$ARGS)"` |
| `packages/core/templates/python/ruff.toml` | `:9` | `"datetime.datetime.utcnow".msg = "…is deprecated and returns a naive datetime; use datetime.now(timezone.utc)"` |

`$$$ARGS` matches **any** argument list including a non-empty one, so `datetime.now(timezone.utc)` fires —
**the very form `ruff.toml:9` tells the consumer to use.** The two shipped gates contradict each other.

## §2 What to build — DECIDED «narrow to naive» (do not redesign)

For **BOTH** rule files:

- zero-arg `now()` — the naive, untestable read — **stays RED**;
- `datetime.now(timezone.utc)` (an explicit tz argument) — **goes GREEN**;
- the message text stays **consistent with `ruff.toml:9`**, which already names `datetime.now(timezone.utc)`
  as the recommended form. Do not let the astgrep message and the ruff message recommend different things.

Both files get the same treatment — fixing one and leaving its sibling is the recurring defect shape here.

## §3 «Works» — paired fixtures (binding)

**Fixtures both ways for BOTH rule files** (4 cases minimum): naive form → RED; tz-aware form → GREEN.
RED-pre-fix / GREEN-post-fix runs quoted in the PR body.

- **T-HS-A (binding):** assert the **EXIT CODE / firing verdict first**, message wording second.
- **Fresh-install smoke must be green** (this is a template delivery).

## §4 ⚠ Baseline regeneration — same PR, non-negotiable

Template edits shift install fingerprints. Regenerate **in this same PR**:

```bash
SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh
```

then verify:

```bash
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

Expected: N pass / 0 fail. Pre-push `test:principles` does **not** cover the install-sh bash tests — run them
locally, do not assume CI catches it. A template change without its baseline regen lands a red `staging`.

## §5 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists to prevent.

**Stage-specific park triggers (do NOT guess these — named in the meta-launch kickoff §4c):**

- The **message wording**, where the astgrep text and `ruff.toml:9` must stay consistent — this is a wording/UX
  fork the spec does not fix. Park it; do not invent phrasing.
- Any **middle case** that is neither zero-arg nor an explicit `timezone.utc` argument (e.g. a variable passed as
  the tz, `datetime.now(tz)`): if the DECIDED «narrow to naive» line does not clearly determine RED or GREEN for
  it, park with the concrete example rather than choosing.

## §6 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for this stage: T3, T7, T14, T15, T19, T21.**

- **T3** — re-verify all three `:9` anchors live before relying on them.
- **T7 / T14** — a rule narrowed until it fires on nothing is the same lie as a skip reported green. Keep the naive-form RED fixture as the proof it still bites.
- **T15** — run the changed rules against the framework's own python fixtures and report.
- **T19** — own cold-review before handoff.
- **T21** — backward-check enumerates sibling surfaces the diff did NOT touch (other shipped astgrep rules using `$$$ARGS` where any-args is equally wrong), never restates the PR.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-HS-A (umbrella)** — asserting on message TEXT instead of firing polarity.
- **T-S3-A (this stage)** — **fixing one rule file and not its twin.** The two files differ only by
  `datetime.now` vs `datetime.datetime.now`; a fix applied to the first reads as complete. Counter: §2 and §3
  both require BOTH files, with fixtures both ways for each.
- **T-S3-B (this stage)** — **skipping the baseline regen** because `test:principles` passed. Those bash install
  tests are not in the pre-push principle run. Counter: §4, run `SNAPSHOT_MODE=compare` and quote the N pass / 0 fail.

## §7 Anti-scope

- Do NOT touch any other stage's surface (mutation runner, lychee/pre-push, CI templates, refresh, `inject-matching-rule`).
- Do NOT change `ruff.toml`'s banned-api semantics — it is the consistency reference, not this stage's target.
- Do NOT write `done.md` — closure belongs to S6.
- Do NOT add npm deps.

## §8 PR body — §1.7 REQUIRED

This stage edits `packages/core/templates/**`, which **is** in the §4b path list, so the PR body **MUST**
carry both `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied` — H3 headings, the literal
word «applied», ≥40 non-whitespace chars and ≥1 `path.ext:N` citation in each. Run the meta-launch kickoff §4b
pre-flight grep before `gh pr create`.

**Do NOT reach for the `### §1.7 Skipped:` escape hatch** — a baseline regen bundled with a real template
semantics change is not «purely structural» (meta-launch kickoff §4b hard-rule 5).
