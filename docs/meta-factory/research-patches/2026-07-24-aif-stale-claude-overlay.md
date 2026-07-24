<!-- scope:aif-stale-claude-overlay -->

# aif task worktrees run a stale `.claude/` — the base clone's working tree is copied over every fresh checkout

> **Authoritative for:** the stale-`.claude`-overlay defect in aif task worktrees (§2) — its
> mechanism, the evidence chain that establishes it, and the host-side repair applied on
> 2026-07-24 (§4); the corrections it forces on prior aif-parity conclusions (§5).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The CC hook channel model — see
> [2026-07-24-posttooluse-channel-verification.md](2026-07-24-posttooluse-channel-verification.md).
> The upstream copy step itself — it lives in `lee-to/aif-handoff`, is NOT identified here, and
> is left open in §6.

> **Verified against:** container `aif-handoff-agent-1`, framework base clone
> `/home/www/rules-as-tests-aif`, `staging` @ `3bbc58b8de`. Every claim below carries the
> command that produced it.
> **Date:** 2026-07-24.

## §1 Problem

A `git`-level base sync is not sufficient to make an aif worker run current code. After
`~/.claude/refresh-aif-base.sh` moved the container's `staging` from `15d36e6f13` to
`3bbc58b8de`, a **freshly created task worktree still ran hooks from PR #123** — roughly a
thousand PRs behind — because something overwrites `.claude/` after the checkout.

This is the defect class the framework exists to prevent, applied to the framework's own
runtime: a gate that is *registered* and reads as alive, while the file actually executed is a
stale copy. Every hook fix, rule edit and `settings.json` change merged since PR #123 has been
invisible to every aif worker, regardless of how fresh the git base was.

## §2 Evidence chain

Task `c4fe045a` (`hook-tsx-resolution-fix`), worktree
`/home/www/rules-as-tests-aif-feature-hook-tsx-resolution-fix-c4fe04-c4fe045a-…`.

**The worktree branched off the correct, synced tip** — so the base sync itself worked:

```text
$ git -C $W merge-base HEAD staging   -> 3bbc58b8de
$ git -C $W rev-parse --short staging -> 3bbc58b8de
```

**Yet it is born dirty — 60 modified files, the entire `.claude/` surface:**

```text
$ git -C $W status --short | wc -l   -> 60
 M .claude/hooks/check-doc-authority.sh      M .claude/rules/ai-laziness-traps.md
 M .claude/hooks/validate-prompt.sh          M .claude/rules/doc-authority-hierarchy.md
 M .claude/hooks/check-hook-marker.sh        M .claude/settings.json
 M .claude/hooks/check-kickoff-traps.sh      M .claude/skills/ai-doc/SKILL.md
 … (hooks, rules, skills, settings.json, orchestrator-prompts kickoffs)
```

**The committed file carries the fix; the executed file does not:**

```text
$ git -C $W show HEAD:.claude/hooks/check-doc-authority.sh | wc -l          -> 84
$ wc -l < $W/.claude/hooks/check-doc-authority.sh                           -> 29
$ git -C $W show HEAD:.claude/hooks/check-doc-authority.sh | grep -c _emit_skip -> 3
$ grep -c _emit_skip $W/.claude/hooks/check-doc-authority.sh                -> 0
```

The 29-line working-tree body is the **pre-#1116** hook, verbatim:

```bash
printf '⚠ check-doc-authority: jq unavailable — skipping\n' >&2; exit 0
```

Same split on every fixed hook — working-tree `_emit_skip` = 0 against HEAD-object 3 / 4 / 2 / 2
for `check-doc-authority`, `validate-prompt`, `check-hook-marker`, `check-kickoff-traps`.

**The overwrite happens ~3.5 s after the checkout** (mtimes in the same worktree):

```text
02:34:11.742  README.md                              <- git worktree checkout
02:34:11.948  package.json                           <- git worktree checkout
02:34:15.230  .claude/settings.json                  <- overlay
02:34:15.253  .claude/hooks/check-doc-authority.sh   <- overlay
```

**The overlay source is the base clone's WORKING TREE, not any git object.** This is the
decisive test — the base clone's `settings.json` carried a *local, uncommitted* modification,
and the fresh worktree reproduced it:

```text
$ diff -q $BASE/.claude/settings.json $W/.claude/settings.json
  -> identical  (matches the base clone's DIRTY working copy)
$ git -C $BASE show HEAD:.claude/settings.json > /tmp/h.json; diff -q /tmp/h.json $W/.claude/settings.json
  -> differs    (does NOT match the base clone's HEAD object)
```

**Why the source was stale — two independent causes stacked:**

1. The base clone's working tree was parked on an ancient branch:

   ```text
   $ git -C $BASE rev-parse --abbrev-ref HEAD -> feature/language-discipline-s2-ssot-123
   $ git -C $BASE log --oneline -1            -> 9c6f00e36d docs(ssot): … (#123)
   $ git -C $BASE show HEAD:.claude/hooks/check-doc-authority.sh | grep -c _emit_skip -> 0
   ```

2. Leftover probe instrumentation was uncommitted in that working tree and propagating into
   every new worktree — `git diff .claude/settings.json` showed +64 lines registering
   `bash /tmp/hook-logger.sh` on PostToolUse / PreToolUse, debris from an earlier
   channel-probe session.

## §3 A second, independent finding — `tsx` is unreachable in task worktrees

Measured in the same worktree:

```text
$W/node_modules/.bin/tsx      -> ABSENT   (task worktrees carry no node_modules)
command -v tsx                -> ABSENT-ON-PATH
/app/node_modules/.bin/tsx    -> EXECUTABLE
```

`check-doc-authority.sh:48` resolves `TSX="$REPO_ROOT/node_modules/.bin/tsx"` with no fallback,
so even after §4's repair the principle-09 gate loudly skips rather than runs. **A bare
`command -v tsx` fallback would not fix this** — `tsx` is not on `PATH` in the container at all;
only `/app/node_modules/.bin/tsx` exists, and that directory is not on `PATH`.

What DOES fix it, verified in the same environment: the **base clone has a full
`node_modules`** (`/home/www/rules-as-tests-aif/node_modules/.bin/tsx` → EXECUTABLE), and from
any task worktree `git rev-parse --git-common-dir` resolves to
`/home/www/rules-as-tests-aif/.git` — one `dirname` away from that `node_modules`. So a
hook-side **main-worktree tier** (repo-local → main-worktree root via `--git-common-dir` →
`command -v` → skip) repairs every linked-worktree consumer, container included, with no
environment change. Design dispatched as the `hook-tsx-resolution-fix` kickoff (v2).

## §4 Repair applied (host-side, reversible)

Both local modifications preserved by name, then the base clone's working tree made current:

```text
git -C $BASE stash push -m "aif-base-hook-logger-instrumentation-2026-07-24" .claude/settings.json
git -C $BASE stash push -m "aif-base-package-lock-local-2026-07-24" package-lock.json
git -C $BASE checkout staging
```

Post-repair verification:

```text
HEAD                                  -> staging @ 3bbc58b8de
dirty files                           -> 1 (untracked .claude/worktrees/ only)
_emit_skip in base working tree       -> 3 / 4 / 2 / 2 (the four fixed hooks)
grep -c hook-logger settings.json     -> 0
grep -c check-doc-authority settings.json -> 1
```

**Revert:** `git -C $BASE checkout feature/language-discipline-s2-ssot-123`, then apply the two
stashes **by their message**, not by index — the stash stack is shared and indices shift
(`git stash list | grep aif-base-…`).

### §4.1 The healer was blind to this, and itself had to be fixed

Putting the base clone **on** `staging` immediately broke the operator-side healer
`~/.claude/refresh-aif-base.sh`, and exposed why the defect survived so long:

- Its refresh step ran `git branch -f "$BRANCH" "$REAL"`, which git **refuses outright** for a
  checked-out branch — `fatal: cannot force update the branch 'staging' checked out at …`.
  Under `set -euo pipefail` the whole healer would abort.
- Worse, its fast-path compared **only the ref**: `[ "$CUR" = "$REAL" ] && exit 0`. A base clone
  parked on a PR-#123 branch with a current `staging` ref therefore printed
  «✅ already current» every time — the healer actively certified the broken state.

The rewritten helper keeps ref and working tree aligned and verifies both: the fast-path now
requires `rev-parse HEAD == REAL` as well; the refresh fast-forwards the checked-out branch
(falling back to detach → `branch -f` → re-attach when history diverges); it refuses to move a
checkout carrying uncommitted tracked changes, telling the operator to stash **by name**; and it
warns when `.claude/` carries uncommitted edits, because those are copied into every new task
worktree — the exact channel by which the `hook-logger` debris shipped itself to every worker.

Verified by three runs, not by inspection:

| test | setup | result |
|---|---|---|
| real refresh, branch checked out | GitHub moved to `03949222ca` (#1121) while base was on `staging` | `✅ 3bbc58b -> 0394922 (ref + working tree)` — the case that hard-failed before |
| realign | working tree parked back on `feature/language-discipline-s2-ssot-123`, ref left current | `⚠ ref staging is current (0394922) BUT the base working tree is on 'feature/…' @ 9c6f00e` → realigned; overlay hooks back to 3 / 4 / 2 / 2 |
| true no-op | nothing moved | `✅ already current — ref and working tree both match, no-op.` |

## §5 Corrections this forces on prior conclusions

- **The two 2026-07-24 probe runs** (`0cedb6bd`, `3a5cad5f`) concluded the edit-time gate was
  SILENT and attributed it to a missing dependency. The attribution is wrong at the root: the
  hook file they executed was the **pre-fix** one. Their observations stand; their causal
  claims do not.
- **The session handoff's §2 claim** — «run `refresh-aif-base.sh`, then the edit-time channel
  becomes testable in-container» — is insufficient. The base sync is necessary and not
  sufficient; without §4 the overlay reinstates pre-#1116 hooks over the synced checkout.
- **`3a5cad5f`'s `tsx: MISSING`** was already known to be right-symptom-wrong-cause. §3 refines
  the correction: the previously-proposed cause (worktree lacks `node_modules`) is true but is
  itself downstream, and the previously-proposed fix (`command -v tsx` fallback) does not work
  in this environment.

## §6 Open — deliberately not closed here

- **Which component performs the copy.** Established: the source is the base clone's working
  tree, and it runs ~3.5 s after `git worktree add`. Not established: the code that does it —
  it lives in `lee-to/aif-handoff`, outside this repo. The right upstream fix is to seed from a
  git object, or to skip `.claude/` entirely; neither is done here. §4 + §4.1 make the stale
  state *detected and self-repairing at every dispatch* (the healer runs as
  `RUNTIME_BRIDGE_PREFLIGHT`), which is a mechanism rather than a one-off — but it is still
  compensation at the copy's source, not removal of the copy.
- **The healer is a preflight, not a gate.** It repairs the overlay source at dispatch time; it
  does not prevent anything from re-parking the base clone in between. Per
  [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)
  that is acceptable only because the check is deterministic and runs automatically on the
  dispatch path — not because someone will notice.
- **Whether the host main-checkout mass-revert shares this mechanism.** The handoff's §4 open
  question and [the 2026-07-24 verification §5](../../../.claude/orchestrator-prompts/aif-parity-fixes/verification-for-fable.md)
  record a 218-file staged revert in the host checkout that included a literal revert of
  #1116's fix — the same *shape* as this overlay. Different surface (host, not container).
  **Hypothesis only; not established.** Do not cite it as explained.
- **`tsx` reachability** (§3) — design settled (three-tier resolution, main-worktree tier
  verified viable), dispatched as `hook-tsx-resolution-fix`; open only until that PR merges.
- **The shipped helper twin carries the §4.1 bugs.**
  `.claude/skills/aif-doctor/helpers/refresh-aif-base.sh:48-49` is the same ref-only fast path
  and `:55` the same bare `branch -f`; `aif-doctor` SKILL §3.4's detector is likewise ref-only.
  Port dispatched as the `aif-doctor-helper-parity` kickoff. Until it merges, the shipped
  helper certifies exactly the broken state §2 documents.

## §7 §1.7 self-reflexive note

**Forward-check.** Complies with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)
— the discovery and the repair are shell commands, zero API calls. Complies with
[attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md): the
finding is *not* left as a warning for someone to read — §4 applies a concrete repair, and §6
names the residual as unmechanised rather than pretending the repair is a gate. Complies with
[doc-authority-hierarchy.md §2-§3](../../../.claude/rules/doc-authority-hierarchy.md) (Class /
Authoritative-for header present). Per
[ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md): **T3** — every claim
above carries its command and output, none is asserted from prose; **T14** — §6 states what is
hypothesis rather than folding it into the finding; **T15** — this is the framework's own
enforcement model failing on the framework's own runtime, reported as such.

**Backward-check.** Class of this change = *«a conclusion in the aif-parity umbrella that was
drawn from an observation made inside a container task worktree»*. Sibling surfaces carrying
that class, each verdicted: `2026-07-23-aif-parity-s2-container-evidence.md` — **GAP**, its
`command -v` dumps are environment-true but any hook-behaviour inference from them inherits the
stale-file confound; `2026-07-23-aif-parity-s4-synthesis.md` — **GAP**, its
`SILENT-from-agent-vantage` rows share the confound (both are append-only merged artefacts,
corrected here, not edited there — §5); `2026-07-24-posttooluse-channel-verification.md` —
**SWEPT-CLEAN**, its channel model was established by host-side probes of the hook *contract*,
not by container observation, so the confound does not reach it;
[`.claude/rules/zcode-parity-doctrine.md §2`](../../../.claude/rules/zcode-parity-doctrine.md) —
**SWEPT-CLEAN**, its census classifies hooks by event expressibility, a property of the harness
config and not of any container checkout.
