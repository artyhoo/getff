# aif-doctor-helper-parity — kickoff

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** I-phase — port a verified operator-side fix into its shipped in-repo twin, plus the detector that missed it.
> **Origin:** aif-parity umbrella, 2026-07-24. The operator-local copy of this helper was fixed and live-tested; the shipped copy consumers receive still carries both bugs. Full evidence: `docs/meta-factory/research-patches/2026-07-24-aif-stale-claude-overlay.md` §2 and §4.1.
> **Deliverable:** one PR against `staging` — the helper fix, its tests, and the SKILL.md detector correction.
> **Base branch:** staging.

## §0 Cold-start context — self-contained, read only this

**What aif does with the base clone.** The aif-handoff runtime keeps a base clone of this repo
and creates one linked `git worktree` per task off its `staging` branch. A few seconds after
that checkout, it **copies `.claude/` from the base clone's WORKING TREE** into the new
worktree. Consequence: the base clone's *checked-out content* — not just its `staging` ref — is
what every task actually executes as hooks, rules and `settings.json`.

**The incident this kickoff comes from.** A base clone was found with a current `staging` ref
but its working tree parked on a branch from PR #123. Every task therefore ran hooks roughly a
thousand PRs stale, and shipped a leftover `/tmp/hook-logger.sh` registration that had been left
uncommitted in that working tree. The healer script certified this state as healthy on every run.

## §1 The two defects, with exact lines

Both live in [`.claude/skills/aif-doctor/helpers/refresh-aif-base.sh`](../../skills/aif-doctor/helpers/refresh-aif-base.sh).

**Defect 1 — the fast path compares only the ref (`:48-49`):**

```bash
CUR="$(docker exec "$C" git -C "$REPO_PATH" rev-parse "$BRANCH" 2>/dev/null || echo none)"
if [ "$CUR" = "$REAL" ]; then echo "✅ container $BRANCH already current (${REAL:0:7}) — no-op."; exit 0; fi
```

A base clone whose `staging` ref is current but whose **working tree is on another branch**
takes this exit-0 path and is reported healthy. Since the working tree is the overlay source,
this is precisely the broken state, certified as fine. **This is the load-bearing half of the fix.**

**Defect 2 — `branch -f` is refused when the branch is checked out (`:55`, inside `apply_and_verify`):**

```bash
docker exec "$C" git -C "$REPO_PATH" branch -f "$BRANCH" "$1" 2>/dev/null || return 1
```

Once the base clone is correctly *on* `$BRANCH` — which is what defect 1's fix makes the normal
state — git refuses this outright: `fatal: cannot force update the branch 'staging' checked out
at …`. Here the error is swallowed by `2>/dev/null` and surfaces only as `return 1`, so the
primary path silently falls through to the fallback, which fails the same way. Fixing defect 1
without defect 2 leaves the helper unable to refresh at all.

**Defect 3 — the detector documents the same blind spot.** `.claude/skills/aif-doctor/SKILL.md:55`
(§1 probe table) and `:117` (§3.4 «Mismatch») both define base-currency as
`gh api … .object.sha` vs `docker exec … rev-parse staging` — ref only. A reader following the
runbook reproduces the miss.

## §2 Scope — port the verified design

An equivalent fix was applied to the operator-local copy and **live-tested in three runs**
(§4.1 of the research patch): a real refresh with the branch checked out, a realign from the
parked-working-tree state, and a true no-op. Port that design; do not invent a different one.

Required behaviour:

1. **Fast no-op requires BOTH** `rev-parse "$BRANCH" == REAL` **and** `rev-parse HEAD == REAL`.
2. **When the ref is current but the working tree is not**, say so explicitly — name the branch
   the tree is on and the SHA — and realign rather than exiting 0.
3. **When `$BRANCH` is the checked-out branch**, do not call `branch -f`. Fast-forward
   (`merge --ff-only`) when history allows; otherwise detach to the target, `branch -f`, and
   re-attach. Either way ref and working tree end aligned.
4. **When `$BRANCH` is not checked out**, set the branch and then **check it out** — leaving the
   base clone parked elsewhere reinstates the defect.
5. **Refuse to move a checkout with uncommitted tracked changes.** Do not stash them silently
   and never `git reset --hard`; abort with the file list and tell the operator to stash by name.
6. **Verify both** ref and working tree before reporting success; abort loudly if either misses.
7. **Warn when `.claude/` carries uncommitted edits** after a successful run — those are copied
   into every new task worktree. Loud, not fatal.
8. **Preserve everything else**: the graceful no-op when no agent container is running, the
   PRIMARY in-container `git fetch` path, the host-bundle FALLBACK, and a printed revert
   command (which must now also restore the checkout, not only the ref).

Then correct `.claude/skills/aif-doctor/SKILL.md` §1 and §3.4 so the documented detector checks
the working tree too, and the §3.4 symptom list names «base clone checked out on another
branch» as a cause of stale-base garbage.

**Out of scope:** the operator-local `~/.claude/` copy (not in this repo, already fixed); the
upstream `lee-to/aif-handoff` copy step; `heal.sh`.

## §3 Acceptance criteria

Prefer real tests over prose. `tests/` already exercises shell helpers — follow the nearest
existing pattern rather than inventing a harness.

1. **Ref-current + tree-parked is DETECTED, not passed.** Given a repo whose branch ref is at
   the target while `HEAD` is on another branch, the helper must not take the no-op exit, and
   must emit a message naming the parked branch.
2. **Realign lands.** After that run, both `rev-parse <branch>` and `rev-parse HEAD` equal the target.
3. **Checked-out branch refresh works.** Branch checked out, target is a descendant → ref and
   working tree both advance; no `cannot force update` failure.
4. **True no-op is still fast and quiet.** Ref and tree both at target → single success line, exit 0.
5. **Dirty tracked changes abort.** Uncommitted tracked modification present → non-zero exit,
   the offending path named, nothing moved, no stash created by the script.
6. **Graceful skip preserved.** No aif container running → the pre-existing no-op behaviour, unchanged.
7. **Docs match code.** `.claude/skills/aif-doctor/SKILL.md` §1 + §3.4 describe the two-part check.
8. **Suite green.** The repo's own test suites for this area pass.

Criteria 1-5 can be exercised against a throwaway local git repo without any container — build
the fixture that way if a container is unavailable, and say so in the report.

## §4 Constraints (binding)

- **Base `staging`.** One PR, one concern.
- **No `--no-verify`, no gate bypass.** If a gate rejects you, fix what it names and retry.
- **Never `git reset --hard`** anywhere in the helper or its tests — a banned operation in this
  project. Stash-by-name or abort.
- **PR body needs `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied`**
  (H3 headers verbatim), each ≥40 non-whitespace characters and each citing at least one
  `file.ext:line`. The backward-check must enumerate the sibling surfaces of this change-class —
  *other places that assert «the container base is current»* — and verdict each.
- **Commit trailer:** `Prior-art: skipped — porting a verified fix into its shipped twin, no new capability`.
- **Park, don't guess.** If a criterion is unreachable, say so with the blocking output.

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md` §2 and §3)

**Active canonical traps: T2, T3, T15, T19, T21.**

- **T2 — designing ≠ running.** The operator-side fix was accepted only after three live runs. Yours needs its tests actually executed and pasted.
- **T3 — no prose-only findings.** Command + output, or `file:line` with the line's real content.
- **T15 — self-application.** This is the framework's own health-checker failing to check the thing it exists to check. Say what that implies for the other detectors in the same SKILL.
- **T19 — own cold-QA before handoff.** Re-read the diff adversarially; CI green is not a design review.
- **T21 — the backward-check sweeps siblings, it does not restate the PR.** See §4.

**Domain-specific trap — T-PAR-A «the twin is a copy, so copy it».** The operator-local copy and
the shipped copy are *not* line-for-line equivalents: the shipped one has the PRIMARY
in-container `fetch` path and the graceful container-absent skip, which the operator copy does
not. Transplanting the operator file wholesale would delete consumer-facing behaviour. Port the
*design* (§2's eight requirements) into the shipped file's existing structure, and state in your
report which structural differences you preserved.

**Domain-specific trap — T-PAR-B «fixing the script closes the finding».** The finding has three
surfaces: the script, the SKILL detector (§1 table + §3.4), and any other place asserting
base-currency. Fixing only the script leaves the runbook teaching the blind spot. Enumerate
every base-currency assertion you can find and verdict each.

## §6 Report — what to hand back

1. The PR number and branch.
2. The acceptance table: criterion → command → verbatim output → PASS/FAIL, all 8 rows.
3. The T-PAR-A table: structural differences between the two copies that you deliberately preserved.
4. The T-PAR-B enumeration: every base-currency assertion found → FIXED / NOT-APPLICABLE, with `file:line`.
5. Anything you could not verify, named as such.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
