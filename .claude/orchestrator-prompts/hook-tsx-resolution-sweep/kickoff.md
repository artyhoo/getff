# hook-tsx-resolution-sweep — kickoff

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** I-phase — close a defect CLASS across its two remaining surfaces, with paired-negative tests.
> **Origin:** the T-TSX-A sibling-surface enumeration produced by PR #1126 (job A of the aif-parity umbrella), independently re-swept host-side on 2026-07-24 and cross-confirmed by the merged audit `docs/meta-factory/research-patches/2026-07-24-container-gate-reachability.md`.
> **Deliverable:** one PR against `staging` — both fixes, their paired tests, the correctly-produced plugin twins.
> **Base branch:** staging.

> **Read this before scoping.** PR #1126 fixed ONE hook (`check-doc-authority.sh`) and deliberately
> left the enumeration of its siblings as the deliverable. This kickoff is that follow-up. It covers
> **two** hooks, not one — both carry the identical defect, and one of them additionally fails
> silently. Fixing only the silent one would leave the class half-closed.

## §0 Cold-start context — self-contained, read only this

**The project's enforcement model.** Every codified rule is an executable artefact that must fail at
the *earliest reachable channel* — edit-time → pre-commit → pre-push → CI. A gate that is
*registered* (so it reads as alive in any settings audit) while enforcing nothing is the worst
failure mode in this model: it is invisible to exactly the checks that would notice a missing gate.

**The defect class.** A PostToolUse hook shells out to a TypeScript checker and resolves its runner
from exactly one hard-coded location:

```bash
TSX="$REPO_ROOT/node_modules/.bin/tsx"
```

Linked git worktrees carry no `node_modules`. So in every linked worktree — any developer using
`git worktree`, plus every aif container task worktree — the constructed path misses, and the gate
is structurally inert. The runner is nonetheless reachable by a deterministic git query: one
`dirname` up from `git rev-parse --git-common-dir`.

**The precedent fix (already merged — copy its shape, do not redesign it).** PR #1126 replaced the
single path in `.claude/hooks/check-doc-authority.sh` with a tier list. Read that file's
`_resolve_tsx` function first; it is the reference implementation for this task:

1. `$REPO_ROOT/node_modules/.bin/tsx` — repo-local wins (a consumer pinning a specific tsx keeps getting it).
2. main worktree: `dirname "$(git -C "$REPO_ROOT" rev-parse --git-common-dir)"` then `<that>/node_modules/.bin/tsx`. Guarded for a relative return (`.git`) and for "not a git repo" — must not crash, hang, or leak a git error.
3. `command -v tsx` on `PATH`.
4. Nothing resolves → the hook's skip notice, `exit 0`.

## §1 The two surfaces and their measured state

Both verified host-side on 2026-07-24; neither is inferred.

| # | file:line | defect | skip loudness today |
|---|---|---|---|
| 1 | `.claude/hooks/validate-prompt.sh:46` | `TSX="$REPO_ROOT/node_modules/.bin/tsx"`, no fallback | **loud** — `_emit_skip` at `:69` announces the skip on the model channel |
| 2 | `.claude/hooks/check-worker-dispatch-channel.sh:43` | same construction, no fallback | **SILENT** — the miss branch at `:64` is a bare `[[ ! -x "$TSX" ]] && exit 0`; the model receives nothing at all |

Surface 2's silence is independently evidenced: the merged audit's PROBE 3 fed it a real
`*/kickoff.md` edit in a container worktree and recorded the observed output as `NOTHING APPEARED`
(`docs/meta-factory/research-patches/2026-07-24-container-gate-reachability.md:109`). Surface 2 is
the edit-time channel for the `#worker-dispatch-via-subagent` discipline; while inert-and-silent, a
kickoff author gets neither enforcement nor notice.

**Control surface — proves the class boundary is about resolution STYLE, not "uses tsx":**
`.claude/hooks/runtime-bridge-dispatch.sh:114` resolves via `command -v tsx` and is verdicted alive
(class E) in the same audit. Do not touch it.

**Out of the class (do not fix):** `.claude/hooks/worktree-setup.sh:124-136` — those
`node_modules/.bin/tsx` paths are provisioning *probes* ("does this worktree need node_modules?"),
not a runner resolve for execution. Testing the repo-local path is exactly correct there.

## §2 Scope

| file | what changes |
|---|---|
| `.claude/hooks/validate-prompt.sh` | tier-based resolution (~8-12 lines); its existing `_emit_skip` text stays **verbatim** |
| `.claude/hooks/check-worker-dispatch-channel.sh` | tier-based resolution **and** a skip notice on the model channel where `:64` currently exits silently |
| `plugin/hooks/validate-prompt` | **MANUAL twin — hand-edit, do NOT regenerate.** Declared at `.claude/hooks/validate-prompt.sh:15` (`@plugin-transform: manual`): the twin carries an extra `$VALIDATOR` guard (T-PLUG-A) because consumer plugins lack `packages/core/`. Running the generator over it would erase that guard. Apply the same tier fix by hand and keep the guard intact. |
| `plugin/hooks/check-worker-dispatch-channel` | **identity twin — generated.** `scripts/generate-plugin-twins.sh` (pre-commit) produces it. Do not hand-edit. |
| `packages/core/hooks/validate-prompt.test.ts` | exists — extend it |
| `packages/core/hooks/check-worker-dispatch-channel.test.ts` | exists — extend it |

**Skip-notice wording for surface 2.** Match the established shape, do not invent a new voice; the
existing notices read: `⚠ <hook-name>: tsx not found — <what did not run> DID NOT RUN for this edit.
This is a SKIP, not a pass.` It must reach the **model** channel the same way its siblings do —
study how `_emit_skip` is implemented in `validate-prompt.sh` and mirror it. Note surface 2 already
has `_is_zcode` / `_emit_ctx` helpers at `:36-39`; reuse them rather than adding a parallel mechanism.

**Out of scope** (report, do not fix): any other hook, container image contents, worktree
`node_modules` provisioning, `PATH` changes, the `#worker-dispatch-via-subagent` matcher logic itself.

## §3 Acceptance criteria

Each must be demonstrated by a **test that fails without your fix** — not by prose. Run the suite
with the fix (GREEN), then revert only the hook and run it again (RED), and paste both outputs.
A criterion whose test stays green after reverting the fix has not been tested.

**Per hook (both surfaces, 1-5 each):**

1. **Main-worktree tier resolves.** In a linked worktree with no local `node_modules`, whose main worktree has `node_modules/.bin/tsx`, and with **no `tsx` on `PATH`** → the hook RUNS its check (a violating input is rejected; a clean input passes).
2. **Precedence held.** Repo-local `tsx` present → it is the one invoked, even when main-worktree and `PATH` candidates also exist and differ.
3. **PATH tier still works.** No repo-local, no main-worktree candidate, a `tsx` on `PATH` → the check runs.
4. **Degrades safely outside a git repo.** `$REPO_ROOT` not a git repo → tier 2 skipped quietly; no crash, no hang, no git error on the model channel.
5. **No regression when nothing resolves** → the skip notice fires and `exit 0`.

**Surface-2 specific:**

6. **The silence is gone.** With no tier resolving, `check-worker-dispatch-channel.sh` now emits a skip notice on the model channel. The paired negative is the whole point: assert that the pre-fix behaviour (empty stdout **and** empty stderr) no longer holds.
7. **Enforcement path untouched.** When tsx DOES resolve and the matcher reports a violation, the hook's exit code and message are byte-identical to today's behaviour. The skip-notice addition must not alter the violation path.

**Both:**

8. **Twin correctness.** `plugin/hooks/check-worker-dispatch-channel` regenerated by the generator; `plugin/hooks/validate-prompt` hand-edited **with its `$VALIDATOR` guard still present** (grep for it and show the result).
9. **Suites green.** `npx vitest run packages/core/hooks/validate-prompt.test.ts packages/core/hooks/check-worker-dispatch-channel.test.ts`, then the broader `packages/core/hooks` suite.
10. **Install baselines.** `SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh` → 0 fail. Only if it fails, recapture with `SNAPSHOT_MODE=capture` and re-compare. **Do not recapture pre-emptively** — PR #1126 found these hooks are framework-internal and shift nothing; a needless recapture is noise in the diff.

## §4 Constraints (binding)

- **Base `staging`.** One PR. The concern is "close the tsx-resolution defect class in hooks" — both surfaces belong to it. Do not widen further; anything else you notice goes in the report (§6).
- **No `--no-verify`, no gate bypass.** If a pre-commit or pre-push gate rejects you, fix what it names and retry. A gate that stops you is the product working.
- **Do not redesign the tier logic.** `check-doc-authority.sh`'s `_resolve_tsx` is merged and green; reuse its shape. If you believe it is wrong, say so in the report — do not silently diverge.
- **PR body needs `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied`** (H3 verbatim), each ≥40 non-whitespace characters and each citing at least one `file.ext:line`. The backward-check must enumerate the class's surfaces with a per-surface verdict — after this PR the class should be **closed**, so state explicitly which surfaces remain (ideally: none) and cite the grep that proves it. A backward-check that only restates this PR is non-conformant (T21, §5).
- **Commit trailer:** `Prior-art: skipped — bug fix to existing hooks' binary resolution, no new capability` (rationale ≥20 chars). Same line in the PR body.
- **Park, don't guess.** If an acceptance criterion proves unreachable, stop and say so with the command output that blocked you. Do not invent a weaker criterion and declare it met. A prior version of the sibling task died of exactly that: a fix designed against an assumed environment rather than a measured one.

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md` §2 and §3)

**Active canonical traps: T2, T3, T13, T14, T15, T19, T21.**

- **T2 — designing ≠ running.** "The tier list would fix this too" is not a deliverable. Run both suites, paste the output, including the RED-before-GREEN revert runs.
- **T3 — no prose-only findings.** Every claim carries a command + its output, or a `file:line` with the line's actual content.
- **T13 — an adopted fix is not zero-work.** The tier logic comes from a merged PR, but transplanting it is not free: each hook has its own guard ordering and its own skip semantics. Verify the transplant in situ; do not assume it lands correctly because it worked elsewhere.
- **T14 — clean ≠ covered.** A check that passes because it never executed is "coverage insufficient", not "pass". This entire defect class exists because a skip was read as a pass — and on surface 2, because a silence was read as a pass.
- **T15 — self-application.** Surface 2 is the edit-time gate for kickoff authoring. State explicitly whether the restored gate would have fired on **this very kickoff file**, and what that says about the fix.
- **T19 — own cold-QA before handoff.** CI green is not a design review. Re-read your own diff adversarially before calling it done.
- **T21 — the backward-check sweeps siblings, it does not restate the PR.** See §4.

**Domain-specific trap — T-SWEEP-A «fixed the loud one, called the class closed».** The two surfaces
are asymmetric: surface 1 needs one change, surface 2 needs two (resolution **and** loudness). The
tempting move is to apply the tier fix to both, watch both suites go green, and declare the class
closed — leaving surface 2 still silent on the *other* skip paths it may have. Before closing,
enumerate **every** early-exit in `check-worker-dispatch-channel.sh` (`grep -n 'exit 0' `) and state
per exit whether it is a legitimate no-op (off-path, wrong tool, outside repo) or a
degradation-that-should-announce-itself. Fix only the tsx one in this PR; report the rest.

**Domain-specific trap — T-SWEEP-B «regenerate everything, it's what the generator is for».** One
twin is generated (`check-worker-dispatch-channel`), the other is hand-maintained
(`validate-prompt`, declared `@plugin-transform: manual` at `:15`, carrying an extra `$VALIDATOR`
guard that the source deliberately lacks). Running `scripts/generate-plugin-twins.sh` and committing
whatever it produces would silently strip that guard, breaking consumer plugins — and the twin would
still look "correctly generated" in review. Check `mode:` in the generator's own output for each
twin you touch, and grep the manual twin for its guard after editing.

## §6 Report — what to hand back

1. The PR number and branch.
2. The acceptance table: criterion → command → verbatim output → PASS/FAIL, all 10 rows, with the RED-before-GREEN evidence for the paired negatives.
3. The T-SWEEP-A early-exit enumeration for `check-worker-dispatch-channel.sh`: line → exit reason → legitimate-no-op / should-announce.
4. Confirmation that the class is closed: the grep over `.claude/hooks/*.sh` for the hard-coded-path pattern, and its output.
5. **Field note (report only, not part of the PR):** you are running inside a container task worktree. While you worked, the repo's own PostToolUse hooks fired on your edits — including, after your fix, possibly the very hooks you are fixing. Record verbatim any hook output you saw. If you saw nothing, write `NOTHING APPEARED` rather than inferring. Raw data for a separate audit; do not analyse it.
6. Anything you could not verify, named as such.
