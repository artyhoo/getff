# hook-tsx-resolution-fix — kickoff

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** I-phase — one mechanically-scoped bug fix with paired-negative tests.
> **Origin:** aif-parity umbrella. Root-caused host-side on 2026-07-24; the evidence is quoted inline in §1 and recorded in `docs/meta-factory/research-patches/2026-07-24-aif-stale-claude-overlay.md` §3.
> **Deliverable:** one PR against `staging` — the fix, its paired tests, the regenerated plugin twin, recaptured install baselines.
> **Base branch:** staging.

> **This kickoff is v2.** A v1 existed and was cancelled before implementation because it
> prescribed a `command -v tsx` PATH fallback — measurement showed `tsx` is NOT on `PATH` in the
> target environment, so that fix would have passed its own tests while repairing nothing. If
> anything below reads like it contradicts a remembered v1, v2 is authoritative.

## §0 Cold-start context — self-contained, read only this

**The project's enforcement model.** Every codified rule is an executable artefact that must
fail at the *earliest reachable channel* — edit-time → pre-commit → pre-push → CI. A gate that
is *registered* (so it reads as alive in any settings audit) while enforcing nothing is the
worst failure mode in this model, because it is invisible to exactly the checks that would
notice a missing gate.

**The hook in question.** `.claude/hooks/check-doc-authority.sh` is a PostToolUse (Edit|Write)
hook. It shells out to a TypeScript checker enforcing principle 09 (every canonical doc carries
a `Class:` + `Authoritative for:` header). It resolves the TypeScript runner like this:

```bash
# .claude/hooks/check-doc-authority.sh:48
TSX="$REPO_ROOT/node_modules/.bin/tsx"
...
# lines 65-66
if [[ ! -x "$TSX" ]]; then
  _emit_skip '⚠ check-doc-authority: tsx not found — the principle-09 authority-header check DID NOT RUN for this edit. This is a SKIP, not a pass.'
```

`_emit_skip` (PR #1120) announces the skip on the JSON `hookSpecificOutput.additionalContext`
channel — the channel the model actually receives — plus stderr for terminal/CI readers. So the
degradation is *loud*. It is still a degradation: the gate does not run.

## §1 The defect and its measured cause

**`$REPO_ROOT` is a linked git worktree, and linked worktrees carry no `node_modules`.** Every
value below was measured in the target environment; none is inferred.

| probe | result |
|---|---|
| `[ -x "$WORKTREE/node_modules/.bin/tsx" ]` | **ABSENT** — linked worktrees get no `node_modules` |
| `command -v tsx` | **ABSENT ON PATH** |
| `[ -x "$MAIN_WORKTREE/node_modules/.bin/tsx" ]` | **EXECUTABLE** — the main working tree has a full install |
| `git -C "$WORKTREE" rev-parse --git-common-dir` | `<MAIN_WORKTREE>/.git` — i.e. one `dirname` from that `node_modules` |
| `command -v node` | `/usr/local/bin/node` (v22) |

So the runner the hook needs is present and **reachable by a deterministic git query**, one
directory up from `--git-common-dir`. The hook simply never looks there.

**Consequence.** In every linked worktree the principle-09 gate is structurally inert — it
announces its own death on every single edit and never checks anything. That is any developer
using `git worktree`, plus every container task worktree.

## §2 Scope — the fix

**The «how» in one sentence:** resolve `tsx` through a tier list — repo-local, then the **main
worktree's** `node_modules/.bin/tsx` located via `git rev-parse --git-common-dir`, then a `tsx`
on `PATH` — and emit the existing skip only when every tier misses.

Binding precedence, in this order:

1. `$REPO_ROOT/node_modules/.bin/tsx` — repo-local wins (a consumer pinning a specific tsx must keep getting it).
2. **Main-worktree tier:** `dirname "$(git -C "$REPO_ROOT" rev-parse --git-common-dir)"` then
   `<that>/node_modules/.bin/tsx`. This is the tier that repairs the linked-worktree case.
   Guard it: `--git-common-dir` can return a relative path (`.git`) and can fail outside a repo
   — handle both without letting the hook crash or hang.
3. `command -v tsx` on `PATH` — last resort, for globally-installed toolchains.
4. Nothing resolves → the existing `_emit_skip` notice, unchanged text, unchanged `exit 0`.

**Files in scope:**

| file | what changes |
|---|---|
| `.claude/hooks/check-doc-authority.sh` | the resolution tiers (~8-12 lines) |
| `plugin/hooks/check-doc-authority` | its plugin twin — **auto-generated**, no `@plugin-transform` marker; the `generate-plugin-twins` pre-commit hook regenerates it. Do not hand-edit it. |
| `packages/core/hooks/check-doc-authority.test.ts` | the paired tests (file exists; extend it) |
| `tests/install-sh/baselines/*/*.fingerprint` (8 files) | recapture — a shipped-hook edit shifts install fingerprints |

**Out of scope** (surface in the report, do not fix): any other hook, container image contents,
worktree `node_modules` provisioning, `PATH` changes.

## §3 Acceptance criteria

Each must be demonstrated by a **test that fails without your fix** — not by prose. Tier 2 is
the one that matters; a suite that only covers tiers 1 and 3 has not tested this change.

1. **Main-worktree tier resolves.** In a linked worktree with no local `node_modules`, whose
   main worktree has `node_modules/.bin/tsx`, and with **no `tsx` on `PATH`** → the hook RUNS
   the check: a doc missing its authority header is rejected (exit 2, message on the model
   channel); a compliant doc passes.
2. **Precedence held.** Repo-local `tsx` present → it is the one invoked, even when the
   main-worktree and `PATH` candidates also exist and differ.
3. **PATH tier still works.** No repo-local, no main-worktree candidate, a `tsx` on `PATH` → the check runs.
4. **No regression when nothing resolves.** No candidate in any tier → the existing `_emit_skip`
   notice fires, verbatim, exit 0.
5. **Degrades safely outside a git repo.** `$REPO_ROOT` not a git repo → tier 2 is skipped
   quietly; the hook does not crash, hang, or emit a git error to the model channel.
6. **Twin parity.** `plugin/hooks/check-doc-authority` carries the same fix, produced by the generator, not by hand.
7. **Suite green.** `npx vitest run packages/core/hooks/check-doc-authority.test.ts` passes; then the broader hook suite still passes.
8. **Baselines.** `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` then `SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh` → 0 fail.

## §4 Constraints (binding)

- **Base `staging`.** One PR, one concern. Do not fix anything else you notice — report it instead (§6).
- **No `--no-verify`, no gate bypass.** If a pre-commit or pre-push gate rejects you, fix what it names and retry. A gate that stops you is the product working.
- **PR body needs a `### §1.7 Forward-check applied` and a `### §1.7 Backward-check applied`
  section** (H3 headers verbatim), each ≥40 non-whitespace characters and each citing at least
  one `file.ext:line`. The backward-check must **enumerate sibling surfaces of the same
  change-class** — other hooks that resolve a helper binary at a hard-coded repo-local path —
  and give a verdict per surface. A backward-check that only restates what this PR did is
  non-conformant (see T21 in §5).
- **Commit trailer.** Bug fix, not a new capability, so the escape hatch applies:
  `Prior-art: skipped — bug fix to an existing hook's binary resolution, no new capability` in
  the commit body (rationale ≥20 chars). Same line in the PR body.
- **Park, don't guess.** If an acceptance criterion turns out to be unreachable, stop and say so
  with the command output that blocked you. Do not invent a weaker criterion and declare it met.
  **v1 of this kickoff died of exactly that class of error** — a fix designed against an assumed
  environment rather than a measured one.

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md` §2 and §3)

**Active canonical traps: T2, T3, T14, T15, T19, T21.**

- **T2 — designing ≠ running.** «A tier list would fix this» is not a deliverable. Run the tests, paste the output.
- **T3 — no prose-only findings.** Every claim in your report carries a command + its output, or a `file:line` with the line's actual content.
- **T14 — clean ≠ covered.** If a check passes because it never executed, that is «coverage insufficient», not «pass». This whole task exists because a skip was read as a pass.
- **T15 — self-application.** This fix restores a gate that checks *documentation authority headers*. State explicitly whether the restored gate would have fired on your own diff, and what that says about the fix.
- **T19 — own cold-QA before handoff.** CI green is not a design review. Re-read your own diff adversarially before you call it done.
- **T21 — the backward-check sweeps siblings, it does not restate the PR.** See §4.

**Domain-specific trap — T-TSX-A «fixed the observed hook, therefore the class is fixed».** The
tempting move is to patch `check-doc-authority.sh` and stop. The defect class is *«a hook
resolves a helper binary at a hard-coded repo-local path with no fallback»*. Enumerate every
`.claude/hooks/*.sh` that resolves a binary this way (grep for `node_modules/.bin`, `$REPO_ROOT/…`
binary paths, bare interpreter paths) and report each as SAME-DEFECT / NOT-APPLICABLE with
`file:line` evidence. **Report them; fix only `check-doc-authority.sh` in this PR** — the
enumeration is the deliverable, a multi-hook sweep is a separate PR.

**Domain-specific trap — T-TSX-B «testing the tier you can reach».** Tier 2 is awkward to test:
it needs a linked worktree whose main root has `node_modules` while `PATH` has no `tsx`. Tiers 1
and 3 are trivial by comparison. The tempting move is to cover 1 and 3 well, assert tier 2 in
prose, and call the suite complete — which would ship the exact v1 failure in new clothes.
Criterion 1 is not satisfied by any test that does not actually construct the linked-worktree
condition. If you cannot construct it, say so explicitly rather than substituting a weaker test.

## §6 Report — what to hand back

1. The PR number and branch.
2. The acceptance table: criterion → command → verbatim output → PASS/FAIL, all 8 rows.
3. The T-TSX-A enumeration table: hook → resolution line → SAME-DEFECT / NOT-APPLICABLE.
4. **Field note (report only, not part of the PR):** you are running inside a container task
   worktree. While you worked, the repo's own PostToolUse hooks fired on your edits. Record
   verbatim any hook output you saw — skip notices, violation messages, silence. If you saw
   nothing at all, write `NOTHING APPEARED` rather than inferring. Raw data for a separate
   audit; do not analyse it.
5. Anything you could not verify, named as such.
