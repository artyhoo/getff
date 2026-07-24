<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage S1 of the getff-honest-signals umbrella. Thin dispatch adapter — semantics are BINDING in the sources below, NOT restated here. -->

# getff-honest-signals-s1 — mutation runner: skipped ≠ green

> **Stage 1 of 6.** One stage = one PR onto `staging`. Do NOT do any other stage's work.
> **Binding sources (read both, in order):**
> 1. `.claude/orchestrator-prompts/getff-honest-signals-meta-launch/kickoff.md` §4 «Stage 1 / S1» + §5 AI-traps.
> 2. `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` §8.1 — BINDING for semantics.
>
> **Branch:** `fix/getff-honest-signals-s1`. **Base:** `staging`.

## §1 The defect (code-grounded — re-verify every line live, T3)

`packages/core/synthesizer/run-generated-rule-mutation.sh` reports **PASS while having tested nothing**:

| Line | Behaviour | Why it lies |
|---|---|---|
| `:169` | malformed rule (empty id/selector/input) → `IDX++; continue` | silent skip, **no counter** |
| `:176-177` | `WARN: original selector did NOT fire on negative-test input — skipping rule` → `IDX++; continue` | skip is printed but **no counter** |
| `:218-221` | `if [ "$OVERALL_TOTAL" -gt 0 ]` guards the `=== overall: … ===` line | all-skipped ⇒ `OVERALL_TOTAL=0` ⇒ **the summary line vanishes entirely** |
| `:223-228` | `OVERALL_FAIL` is never incremented by a skip ⇒ stays `0` | prints `PASS — all generated rules ≥${MIN_KILL}% kill rate`, **exit 0** |

**Net:** N rules present, every one skipped → a few WARN lines, then `PASS`, exit 0. A green signal for zero work done.

**Not in scope / do NOT change:** the `RULE_COUNT -eq 0` early exit at `:143-146` («No declarative rules with negative-test inputs in manifest — nothing to test», exit 0). That path is **already honest** — it claims nothing. The defect is *rules present but not tested*.

## §2 What to build

1. **Count skips.** Track skipped rules (both skip paths above) in a counter alongside `OVERALL_KILLED` / `OVERALL_TOTAL` / `OVERALL_FAIL`.
2. **Report them.** The summary must state the skip count — `N skipped — NOT green` per the umbrella kickoff. The `=== overall: … ===` line must **not** disappear when everything skipped; an all-skipped run is the case that most needs a printed verdict.
3. **`tested=0` with rules present can NOT print `PASS`.** Choose the exit polarity so a run that tested nothing is not reported as success.

**Polarity wording precedent** — mirror the neighbouring `packages/core/hooks/pre-push.ts` generated-rule-material section (`generatedRuleMaterialSection`, around `:919-938`): its documented idiom is *«never a push-blocking die, never a silent pass»*, with **LOUD DEGRADE** for a tool-absent skip and a hard failure for broken material. Match that vocabulary; do not invent a new one.

## §3 «Works» — the paired fixture (binding)

A fixture that runs **RED on the pre-fix runner** and **GREEN post-fix**, and the PR body quotes **both actual runs** (prose-only claims are rejected at review).

- **Shape:** a manifest whose rule's selector does **not** fire on its negative-test input → the runner must show the skip verdict and a **non-PASS exit**.
- **T-HS-A (binding):** the fixture asserts the **EXIT CODE first**, message wording second. A fixture that greps the new wording but not the exit code passes even if the gate still exits 0 — that is this umbrella's own defect reproduced inside its fix.
- **T15 self-application:** run the **fixed** runner against the framework's own generated rules and report the result in the PR body. If it now reports skips that were previously invisible, that is a finding to state, not to hide.

## §4 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists to prevent.

**Stage-specific park triggers (do NOT guess these):**

- The **exact exit code** for an all-skipped run if you judge that a non-zero exit would break an existing caller — park with the caller evidence rather than silently choosing 0.
- The **precise summary wording**, if you cannot make it simultaneously consistent with the `pre-push.ts` LOUD-DEGRADE idiom and the umbrella's `N skipped — NOT green` phrasing.

## §5 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) for the full catalogue. **Active traps for this stage: T3, T7, T14, T15, T19, T21.**

- **T3** — every line number above re-verified live before you rely on it; quoted tool output mandatory, never prose-only.
- **T7** — this stage's THEME is skip-reported-as-green. Do not reproduce it in your own fixture: a fixture that "passes" because the check silently skipped IS the defect.
- **T14** — a green run at low coverage is «coverage insufficient to conclude», not «fixed».
- **T15** — run the fixed runner on the framework's own generated rules (§3) and report what it says.
- **T19** — own adversarial cold-review of the diff before handoff; CI green ≠ design review.
- **T21** — if a §1.7 backward-check applies, enumerate sibling surfaces the diff did NOT touch, never restate the PR.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-HS-A (umbrella)** — asserting on message TEXT instead of polarity/exit-code. Counter: §3, exit code first.
- **T-S1-A (this stage)** — **fixing only the loud skip path.** `:176` prints a WARN and is easy to find; `:169` is a *silent* `continue` on malformed rule data and is easy to miss. A fix that counts only the WARN path still reports `PASS` on a manifest of malformed rules. Counter: both skip paths increment the counter, and the fixture covers whichever path your implementation treats as secondary.

## §6 Anti-scope

- Do NOT touch any other stage's surface (`pre-push.ts` lychee section, datetime rules, CI templates, refresh, `inject-matching-rule`).
- Do NOT change the `RULE_COUNT -eq 0` early-exit path (§1).
- Do NOT write `done.md` — umbrella closure belongs to S6.
- Do NOT add npm deps.

## §7 PR body

`packages/core/synthesizer/**` is **not** in the §4b path list (`.claude/rules/**`, `packages/core/principles/**`, `packages/core/templates/**`, `.claude/skills/**`, `agents/**`, `CLAUDE.md`, …), so the §1.7 Forward/Backward sections are **not** required for this stage. If your diff does reach one of those paths, §4b applies in full — see the meta-launch kickoff §4b for the exact shape and the pre-flight grep.

Quote both fixture runs (RED pre-fix, GREEN post-fix) and the T15 self-application run.
