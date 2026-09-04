# matcher-widening — night-mode kickoff (resume from STEP 2 Layer 1)

> **Purpose:** single source of truth for an unattended (night-mode) resume session. Read top-to-bottom before touching anything. The operator is away — DO NOT ask questions inside the autonomy fork policy below; LOG owner-forks to `docs/superpowers/specs/2026-07-17-matcher-widening-decisions.md` instead.
> **Pre-req:** `superpowers:night-mode` skill + `superpowers:subagent-driven-development` (the executor + dual-reviewer loop).
> **Worktree:** `/Users/art/code/rules-as-tests-aif-matcher-widening` (branch `feat/matcher-widening-multiedit`, base `origin/staging` @ `4a9b508a9`).
> **Companion spec (FULL design context, 4 review rounds):** [`2026-07-17-matcher-widening-design.md`](./2026-07-17-matcher-widening-design.md) — READ THIS FIRST for the why behind each decision.

---

## STEP 0 — verify the hypothesis (DO NOT trust this doc blindly)

Before doing any work, **verify the state on disk matches what this doc claims**. If anything has drifted, STOP and reconcile (this doc was written by a prior session; the worktree could have been touched, or `origin/staging` could have moved).

Run these checks, compare to the expected values, and record any mismatch:

```bash
git -C /Users/art/code/rules-as-tests-aif-matcher-widening status --short
# Expected: clean OR only the in-progress STEP-2 edits (see §"Where we are")

git -C /Users/art/code/rules-as-tests-aif-matcher-widening log --oneline -5
# Expected top 3:
#   <SHA> WIP STEP 2 Layer 1 — check-hook-marker @file-content-gate extension (UNCOMMITTED if you see no commit message; see below)
#   f707d68d1 fix(hooks): widen 6 PostToolUse gate matchers Edit|Write -> Edit|Write|MultiEdit
#   0d365c8a1 docs(spec): round-4 — dual-layer gate + missed edit-site
#   b7cc54096 docs(spec): matcher-widening design — 6-hook fix + lightweight probe

git -C /Users/art/code/rules-as-tests-aif-matcher-widening fetch origin staging
git -C /Users/art/code/rules-as-tests-aif-matcher-widening rev-parse origin/staging
# Expected: 4a9b508a9 (or newer — if newer, see "If base moved" below)

# verify STEP 1 actually landed (6 matchers widened)
grep -cE '"matcher": "Edit\|Write"' /Users/art/code/rules-as-tests-aif-matcher-widening/.ai-factory/harness-model.json
# Expected: 0 (5 were widened; 0 narrow Edit|Write left)
grep -cE '"matcher": "Edit\|Write\|MultiEdit"' /Users/art/code/rules-as-tests-aif-matcher-widening/.ai-factory/harness-model.json
# Expected: 6 (5 widened + 1 already-correct check-worker-dispatch-channel)
```bash

**If any check mismatches → STOP.** Either: (a) a parallel session committed something, (b) base moved and someone rebased, (c) the worktree is in an unexpected state. Do NOT proceed on a wrong base. Reconcile by reading `git log`, `git diff`, `git reflog` until you understand what happened; if unrecoverable, append to the decisions doc and exit (do NOT improvise a fix overnight).

---

## Where we are (resume point)

### DONE — STEP 1 (commit `f707d68d1`, all gates GREEN)
6 PostToolUse matcher'ов widened `Edit|Write` → `Edit|Write|MultiEdit`:
- `.ai-factory/harness-model.json` lines 23,27,31,35,39 (5 quote-anchored)
- `node scripts/render-harness-config.mjs --write` regenerated `.claude/settings.json`
- `setup.d/10-skills.sh:206,246,197` + `install.sh:469,493,486` (functional + comments)
- `tests/install-sh/gh-934-ship-session-ux-hooks.test.sh:56,57,136` + comments 6,11,54
- `tests/install-sh/gh-934-ship-doc-authority-hook.test.sh:56` + comment 13
- Re-captured 4 npm greenfield baselines (brownfield stable, 3 python stable — byte-identical GREEN)

Gates verified GREEN at STEP 1 commit: `render --check`, `byte-identical` 11/11, `refresh-covers-full-delivery`, both `gh-934-ship-*` tests (11/11 + 14/14), `shellcheck`.

### IN-PROGRESS — STEP 2 Layer 1 (NOT yet committed, possibly partially on disk)
Layer 1 = extend `check-hook-marker.sh` (edit-time gate) with a new `@file-content-gate` invariant. State at handoff:

1. **Marker added to 3 path-only hooks** (probably already on disk — verify):
   - `.claude/hooks/validate-prompt.sh` header: `# @file-content-gate: ...`
   - `.claude/hooks/check-doc-authority.sh` header: `# @file-content-gate: ...`
   - `.claude/hooks/check-doc-authority-header.sh` header: `# @file-content-gate: ...`
2. **`check-hook-marker.sh` extended** with the `@file-content-gate` rule: after the existing marker-presence check, if the hook declares `@file-content-gate` AND it is registered in `.claude/settings.json` (framework-self), assert its matcher contains `Edit`, `Write`, AND `MultiEdit`. **Tolerance:** shipped-only hooks (no framework-self entry, e.g. `check-doc-authority-header`) → SKIP (matcher is enforced by install-sh tests + Layer 2, not here). Reason: gate has no framework-side matcher to read for them.
3. **3 new test arms in `packages/core/hooks/check-hook-marker.test.ts`**: paired-negative (`@file-content-gate` + `Edit|Write` reg → exit 1), paired-positive (`Edit|Write|MultiEdit` → exit 0), shipped-only-tolerance (no settings entry → exit 0). Uses `writeSandboxSettings()` helper to stage a sandbox `.claude/settings.json`.

**Handoff verification** — the prior session confirmed by hand: all 6 hooks exit 0, synthetic fixture with `Edit|Write` reg → exit 1 with correct message. **The vitest suite was NOT yet run** (the session ended on `Cannot find package 'vitest'` — needs `npm install`).

---

## What to do (in strict order)

### Task A — bootstrap + verify (DO FIRST, no code)
1. `npm install` (in worktree root or `packages/core/` — wherever `package.json` lives). This was the blocker.
2. Run STEP 0 hypothesis checks (above). If any mismatch → STOP per STEP 0 rules.
3. `git status` — confirm the in-progress STEP-2 edits are on disk (markers in 3 hooks + extended `check-hook-marker.sh` + 3 new test arms). If missing, they may be lost — reconstruct from the "Where we are" section above + the spec doc.

### Task B — finish + validate STEP 2 Layer 1
1. Run: `cd packages/core && npx vitest run hooks/check-hook-marker.test.ts`
2. Expected: all 9 arms green (6 existing + 3 new). If any red → debug. Likely culprits: (a) sandbox `settings.json` path resolution (the hook computes `REPO_ROOT` from its own location — sandbox copy in `<tmp>/.claude/hooks/` → REPO_ROOT=`<tmp>`, so a sandbox `<tmp>/.claude/settings.json` IS read), (b) jq filter on `PostToolUse[].hooks[].command` matching the hook basename.
3. Once green → commit with message: `feat(hooks): @file-content-gate edit-time gate (Layer 1 of matcher-widening preventer)`. Body: explain the invariant, the tolerance for shipped-only, the 3 test arms.

### Task C — STEP 2 Layer 2 (CI-backstop via `channel-coverage.sh`)
1. Read `tests/agnosticism/probes/channel-coverage.sh` (69 LOC) — it already sweeps `@dual-pair` / `@cc-only-rationale` population-wide. Extend it with a third sweep: hooks declaring `@file-content-gate` must have `Edit|Write|MultiEdit` (or `Write|Edit|MultiEdit`) in their registration. Source of truth for the matcher: `.ai-factory/harness-model.json` (SSOT, flat `{matcher, command}` shape at `$.hooks.PostToolUse[*]`).
2. **RED fixture** — `tests/fixtures/matcher-drift/`: a synthetic hook `.sh` with `@file-content-gate` + a synthetic `harness-model.json` fragment registering it `Edit|Write`. The probe, invoked against this fixture root, MUST fail.
3. **Wiring caveat (PM-r4.7):** the live `run-audit.sh` invocation in `packages/core/principles/21-agnosticism-conformance.test.ts` runs ALL probes against the REAL repo and asserts all-PORTABLE. So the RED fixture CANNOT be exercised via the live harness (it would flip the live audit red). Exercise it in ISOLATION via a dedicated `*.paired-negative.test.ts` (precedent: `packages/core/principles/20-bundle-classification.paired-negative.test.ts`) that invokes the probe with the fixture root as an override.
4. **Probe root-resolution:** existing probes resolve `REPO_ROOT` by walking up from their own path. A fixture under `tests/fixtures/matcher-drift/` needs an override — accept it as `$1` or via an env var (e.g. `MATCHER_DRIFT_ROOT`). Make the probe accept the root as `$1` with a default to the walk-up.
5. Run: `cd packages/core && npx vitest run principles/21-agnosticism-conformance.test.ts` (must stay GREEN — the new probe's real-tree arm emits PORTABLE for all 6 hooks now). Plus the new paired-negative test (must be RED-then-GREEN).
6. Commit: `feat(hooks): @file-content-gate CI-backstop probe (Layer 2 of matcher-widening preventer)`.

### Task D — full gate sweep
All must be GREEN before push:
- `node scripts/render-harness-config.mjs --check`
- `cd packages/core && npx vitest run principles/ hooks/`
- `bash tests/install-sh/lib-helpers.test.sh`
- `bash tests/install-sh/meta-all-wired.test.sh`
- `bash tests/install-sh/layer-units.test.sh`
- `bash tests/install-sh/refresh-covers-full-delivery.test.sh`
- `bash tests/install-sh/gh-934-ship-session-ux-hooks.test.sh`
- `bash tests/install-sh/gh-934-ship-doc-authority-hook.test.sh`
- `bash tests/install-sh/byte-identical.test.sh`
- `shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh .claude/hooks/*.sh`

If any red → debug. Do NOT push red.

### Task E — adversarial cold-review (T19) of the entire diff
After all gates green, dispatch a fresh-context reviewer over the WHOLE branch diff (`git diff origin/staging...HEAD`). The reviewer MUST:
- verify the `@file-content-gate` invariant catches the bug class (synthetic RED fixture proves it),
- verify no hook was missed (population sweep covers all 6),
- verify the tolerance for shipped-only is principled (not a loophole),
- look for new holes this PR might open (e.g. did extending `check-hook-marker.sh` introduce a regression? did the new probe break an existing principle-21 arm?).

If the reviewer finds a load-bearing issue → fix + re-run Task D. If cosmetic → note in the PR body.

### Task F — PR
1. `git push -u origin feat/matcher-widening-multiedit`
2. Write PR body to a temp file (use `--body-file` — the git-safety hook validates §1.7 sections locally). Body MUST include:
   - **§1.7 Forward-check:** cite the design spec, the 4-round review history, the falsifier proof.
   - **§1.7 Backward-check:** enumerate what was reused (`check-hook-marker.sh`, `channel-coverage.sh`) vs newly built (the `@file-content-gate` rule, RED fixture); confirm no existing rule/principle is superseded.
   - **Intentional-skip list:** `plugin-broken-manifest` fixture, `apply-doc-fixes.test.ts:32,36` frozen prose, `scripts/apply-doc-fixes.sh:61,66` frozen, `validate-prompt.test.ts:4` doc comment, `setup.d/lib.sh:871` doc example, `scripts/setup-cc-adoptions.sh:62` warning prose, `probe-zcode-hooks.sh:52,59` frozen probe data.
   - **`Prior-art:` trailer** if any new capability file was added (principle 11 F1 enforces at pre-push).
3. `gh pr create --base staging --title "fix(hooks): widen PostToolUse gate matchers to MultiEdit + @file-content-gate preventer" --body-file <path>`
4. Watch CI via `~/.claude/scripts/ci-wait.sh <PR>` (single Bash call with `timeout: 600000` — NEVER a sleep loop). If CI red → fix + re-push. If green → the operator merges in the morning (do NOT auto-merge unless harness pre-authorises and the call is unambiguous).

### Task G — morning report
Write to `docs/superpowers/specs/2026-07-17-matcher-widening-morning-report.md`:
- what landed (commits, PR link, CI status),
- decision resolutions (any owner-fork logged? any technical fork resolved with rationale?),
- BLOCKED increments (with the "why"),
- the owner-fork log path (if any forks were logged to `*-decisions.md`),
- any degradation taken (e.g. a layer skipped, a test marked skip).

---

## Autonomy / fork policy (operator is AWAY — follow strictly)

- **Technical forks** (which impl is better on the merits; an open design detail) → **resolve autonomously** with a one-line rationale in the commit message or decisions doc. Examples you may hit: where exactly to place `@file-content-gate` marker line (above or below `@cc-only-rationale`? — pick "below, on its own `# ` line"); how to phrase the probe's verdict string (use `PORTABLE` per existing convention). DO NOT block on these.
- **Genuine owner forks** (taste/strategy with no determinate best on the project's merits) → **LOG to `docs/superpowers/specs/2026-07-17-matcher-widening-decisions.md`**, do NOT decide, do NOT block. Examples: should the `@file-content-gate` rule also cover case-TOOL hooks (parity-check) — current design skips this (Layer 1 = marker-only; case-TOOL hooks covered by Layer 2 population sweep). If you hit a new owner fork, append it; surface in the morning report.
- **Quota / rate-limit** → use the harness's sleep/resume (or `ScheduleWakeup` ~20-30 min on CC). Commit every converged task durably so a restart loses nothing.
- **CI red after push** → fix + re-push before declaring done. Do NOT merge red.
- **Base moved (`origin/staging` advanced past `4a9b508a9`)** → rebase `feat/matcher-widening-multiedit` onto the new tip; re-run Task D; if conflicts in the 6 touched hooks/setup.d/install.sh → resolve conservatively (prefer the incoming staging version for unrelated hunks, keep our matcher-widening for our hunks). LOG the rebase in the morning report.
- **A parallel session committed to `feat/matcher-widening-multiedit`** → reconcile (read their commit; if complementary, continue; if contradictory, LOG and exit).

---

## Critical nuances (do NOT step on these)

- **Base is FRESH** `4a9b508a9`. Prior review rounds 1-3 ran on a stale `de7fc9d4c` and were partially invalid — that's why the base was recreated. Do NOT recreate the worktree.
- **`check-doc-authority-header` is shipped-only** (from merged #1009): 0 in `.claude/settings.json`, 0 in `.ai-factory/harness-model.json`. Registered only via `setup.d:246` + `install.sh:493`. Layer 1 tolerates it (matcher-lookup returns empty → skip). Its matcher is enforced by `tests/install-sh/gh-934-ship-doc-authority-hook.test.sh:56` (widened in STEP 1) and Layer 2.
- **`inject-memory-codification` — DO NOT TOUCH** (`Write`-only by design, decision A5; models the memory-entry *creation* moment).
- **`inject-project-digest` — DO NOT TOUCH** (`UserPromptSubmit`+`SubagentStart`, not a file-content gate).
- **`paths:` frontmatter divergence (A4):** `inject-matching-rule`'s `@dual-pair` is CC `paths:` frontmatter (read-time, tool-agnostic). Widening the hook matcher does NOT widen `paths:`. This read-vs-edit timing divergence is by design — DO NOT try to "fix" it.
- **"Do not lose anything" + parallel work may be running:** the MAIN worktree `/Users/art/code/rules-as-tests-aif` may be DIRTY (someone else's WIP). DO NOT TOUCH IT. Work ONLY in `/Users/art/code/rules-as-tests-aif-matcher-widening`. Before any push: `git fetch origin staging` to verify base didn't move.
- **Frozen intentional-skip files (DO NOT edit):** `tests/fixtures/plugin-broken-manifest/plugin/hooks/hooks.json:5` (intentional broken fixture), `packages/core/hooks/apply-doc-fixes.test.ts:32,36` (frozen historical prose — editing breaks the sed-match test), `scripts/apply-doc-fixes.sh:61,66` (frozen), `packages/core/hooks/validate-prompt.test.ts:4` (doc comment), `setup.d/lib.sh:871` (doc example), `scripts/setup-cc-adoptions.sh:62` (warning prose), `.claude/orchestrator-prompts/launch-preannounce-track/s5-probes/probe-zcode-hooks.sh:52,59` (frozen probe data).

---

## If something is unrecoverable

Append to `docs/superpowers/specs/2026-07-17-matcher-widening-decisions.md` with: what happened, what you tried, why it's blocked. EXIT. Do NOT improvise a load-bearing fix overnight. The morning report surfaces it.

---

## Policy reminders (operator already decided — do NOT re-litigate)

- **Decision B (dual-layer gate)** is APPROVED. Do not re-open the architecture (4 review rounds closed: T2 Arm-b incoherence, T6 N=1 incidence, R1 reuse-first, R5 missed edit-site).
- **A5 (inject-memory-codification Write-only)** is APPROVED. Do not widen it.
- **Single atomic PR** (fix + both layers). Do not split into multiple PRs.
- **Principle №33 DEFERRED** to incidence N≥2. The dual-layer gate IS the lighter middle option (probe/gate ≠ principle slot per `dual-implementation-discipline.md` §9). Do not promote to a principle in this PR.
