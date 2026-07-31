# Proposal 2 — inject-session-bootstrap autonomy-block §2 wait-rule line + paired test

> **Apply to (paired atomic — both files in the same maintainer commit):**
>   (a) `.claude/hooks/inject-session-bootstrap.sh` (agent-blocked)
>   (b) `packages/core/hooks/inject-session-bootstrap.test.ts` (agent-editable, but the test
>       assertion depends on the hook change being applied first — ships paired here, NOT in
>       S2 PR #2, because applying only the test half makes CI RED until the hook lands)
> **Origin:** session-start-token-audit S2 §1 table row 2 + Note B (BINDING pairing).
> **Mechanism:** the rule `autonomous-loop-continuity.md` is currently delivered always-on via
> the CC-native auto-load (no `paths:` frontmatter). Proposal 3 excludes it from that channel
> via `claudeMdExcludes`. Its Class header (`:9`) declares its channels as (a) the Stop-hook
> arm (`end-of-turn-reminder.sh` `#F10`) and (b) "the always-on autonomy block in
> `inject-session-bootstrap.sh` … prose delivered reliably" — always-on CLAUDE.md injection is
> **not** among them. But the existing autonomy block (`inject-session-bootstrap.sh:48-65`)
> covers §1's stop rule (item 2) and §3's `#invented-constraint` (item 3); **§2's wait rule
> ("silence is not health") is delivered by nothing except the always-on injection this move
> removes.** So this proposal adds the §2 operative prescription as a 4th item to the autonomy
> block, delivering it to exactly the audience that needs it (`AIF_AUTONOMOUS=1`) rather than
> to every session.
>
> This CLOSES a declared-channel-vs-reality gap rather than opening one — the same defect class
> as the zcode row, which is why it belongs in this umbrella.
>
> **Token impact (this proposal alone):** the hook addition costs ~600 bytes per
> `AIF_AUTONOMOUS=1` session (one literal line in the digest, emitted every turn while
> autonomy is opt-in). It does NOT change the token count for interactive sessions (the
> `AIF_AUTONOMOUS` block is opt-in; off-by-default). Combined with proposal 3, it removes
> 13,459 bytes / ~3,365 tokens from every session-start (the rule no longer auto-loads).
> Net for autonomous sessions: ~13,459 − ~600 = ~12,859 bytes saved per session-start.
> Net for interactive sessions: 13,459 bytes saved per session-start, zero overhead.
> **Diff verification:** both diffs mechanically generated + `git apply --check` returns clean
> against the pre-application HEAD of `feature/session-start-token-audit-c781e8` (commit
> 336d031ef, 2026-07-30).

## Part A — hook diff (`.claude/hooks/inject-session-bootstrap.sh`)

The AIF_AUTONOMOUS block runs from line 48 to line 65 of the hook and contains 3 items in a
single DIGEST append. The 4th item is added INSIDE that same append, between the existing
item (3) and the closing quote. The diff touches ONE physical line (the `DIGEST=` append).

```diff
diff --git a/.claude/hooks/inject-session-bootstrap.sh b/.claude/hooks/inject-session-bootstrap.sh
--- a/.claude/hooks/inject-session-bootstrap.sh
+++ b/.claude/hooks/inject-session-bootstrap.sh
@@ -61,7 +61,7 @@ esac
 # Falsifier: if a session with AIF_AUTONOMOUS=1 still stops at a reportable boundary with work
 # in flight, this block bought nothing and F10 needs the Stop-hook arm, not more words.
 if [ "${AIF_AUTONOMOUS:-0}" = "1" ]; then
-  DIGEST="$DIGEST"$'\n[autonomy] Standing operator authorization for this unattended run — do NOT re-ask for it, and do NOT infer a narrower constraint than is written here:\n  (1) Cold sub-agents are AUTHORIZED. Dispatch them for adversarial review of your own output and for backward-sweep enumeration over a change class. This is the operator\'s standing request, so the "unless the user requested it" condition on any session-prompt default is SATISFIED. Reviewing your own artefacts alone is author-blind (ai-laziness-traps.md T19/T21).\n  (2) Do NOT end a turn merely because you have something reportable. Report AND continue in the same turn while work remains — dispatched tasks in flight, an unharvested accepted branch, an open item you own. Ending on a report while work is in flight is finding F10; it recurred twice in one day. Stop only when blocked on the operator, or genuinely finished.\n  (3) A constraint you cannot trace to a citable line in CLAUDE.md, a rule file, or a skill is NOT a constraint. A predecessor session invented "merging is the operator\'s click", obeyed its own invention for seven PRs, and the operator merged six by hand.'
+  DIGEST="$DIGEST"$'\n[autonomy] Standing operator authorization for this unattended run — do NOT re-ask for it, and do NOT infer a narrower constraint than is written here:\n  (1) Cold sub-agents are AUTHORIZED. Dispatch them for adversarial review of your own output and for backward-sweep enumeration over a change class. This is the operator\'s standing request, so the "unless the user requested it" condition on any session-prompt default is SATISFIED. Reviewing your own artefacts alone is author-blind (ai-laziness-traps.md T19/T21).\n  (2) Do NOT end a turn merely because you have something reportable. Report AND continue in the same turn while work remains — dispatched tasks in flight, an unharvested accepted branch, an open item you own. Ending on a report while work is in flight is finding F10; it recurred twice in one day. Stop only when blocked on the operator, or genuinely finished.\n  (3) A constraint you cannot trace to a citable line in CLAUDE.md, a rule file, or a skill is NOT a constraint. A predecessor session invented "merging is the operator\'s click", obeyed its own invention for seven PRs, and the operator merged six by hand.\n  (4) §2 wait rule (silence ≠ health): a monitor that has died and a monitor with nothing to report look identical. For any wait the loop depends on, use a bounded waiter that ALWAYS emits a terminal verdict — the awaited state, a timeout, or a fetch failure — never nothing. In this repo that is `packages/runtime-bridge/src/cli/await.ts` (always pass `--timeout-ms` on a load-bearing wait), or a plain `until`-loop whose every exit path prints one line. Treat any monitor as a BONUS signal, never as the primary one.'
 fi
```

The added text (item 4) is the §2 operative prescription, quoted nearly verbatim from
`.claude/rules/autonomous-loop-continuity.md §2` ("silence is not health" + the bounded-waiter
invariant + the `await.ts` reference + the `--timeout-ms` always rule).

## Part B — paired test assertion (`packages/core/hooks/inject-session-bootstrap.test.ts`)

The test file (`packages/core/hooks/inject-session-bootstrap.test.ts`, 222 lines at S2 authoring
time) has **zero** autonomy-block coverage today: `grep -ci autonom` returns 0 across its 222
lines. This is a NEW assertion, not an update. The diff adds a new `it(...)` block at the END
of the existing `describe(...)` (BEFORE the describe's closing `});`).

```diff
diff --git a/packages/core/hooks/inject-session-bootstrap.test.ts b/packages/core/hooks/inject-session-bootstrap.test.ts
--- a/packages/core/hooks/inject-session-bootstrap.test.ts
+++ b/packages/core/hooks/inject-session-bootstrap.test.ts
@@ -219,4 +219,31 @@ describe('inject-session-bootstrap.sh — UserPromptSubmit bootstrap injection',
     expect(stdout).toContain('[output-language]');
     expect(stdout).toContain(`AIF_HOOK_LANG=${sentinel}`);
   });
+
+  it('AUTONOMY-BLOCK §2: under AIF_AUTONOMOUS=1 the digest carries the §2 wait-rule prescription (proposal 2 pairing)', () => {
+    // Pins the BINDING pairing from session-start-token-audit S2 Note B: excluding
+    // autonomous-loop-continuity.md from always-on load (via claudeMdExcludes — proposal 3)
+    // is safe ONLY if the §2 wait-rule prescription is delivered by another channel. This
+    // asserts that channel (the AIF_AUTONOMOUS=1 autonomy block in inject-session-bootstrap.sh)
+    // actually carries the §2 line. Without this assertion, removing the rule from always-on
+    // load would silently strand §2 — the failure mode Note B exists to prevent.
+    //
+    // Counter-falsifier: revert proposal 2 part A (no §2 line in the autonomy block) — this
+    // test goes RED because the §2 markers are absent from the AIF_AUTONOMOUS=1 digest.
+    const { stdout } = runHook('autonomy-block-test', {
+      AIF_AUTONOMOUS: '1',
+    });
+    expect(stdout).toContain('[autonomy]');
+    // The §2 prescription must name the bounded-waiter invariant:
+    expect(stdout).toContain('silence');
+    expect(stdout).toContain('terminal verdict');
+    expect(stdout).toContain('--timeout-ms');
+    // And it must point at the repo's canonical waiter:
+    expect(stdout).toContain('await.ts');
+    // The 4 items must all be present (the autonomy block enumerates them):
+    expect(stdout).toContain('(1) Cold sub-agents');
+    expect(stdout).toContain('(2) Do NOT end a turn');
+    expect(stdout).toContain('(3) A constraint you cannot trace');
+    expect(stdout).toContain('(4) §2 wait rule');
+  });
 });
```

## Apply recipe (binding — both halves in the same maintainer commit)

```bash
# 1. Apply part A (the hook line addition — 1 line replaced, 1 line added):
git apply docs/meta-factory/research-patches/2026-07-26-session-start-token-audit-proposals/02-inject-session-bootstrap-autonomy-block.diff
# (or hand-edit the line — the added text is between the existing item (3) and the closing quote)

# 2. Apply part B (the test assertion — new it() block before the describe's closing });):
git apply docs/meta-factory/research-patches/2026-07-26-session-start-token-audit-proposals/02-inject-session-bootstrap-autonomy-block-test.diff
# (This file IS agent-editable, but it is NOT applied in S2 PR #2 — applying it without part A
#  would make CI RED. The agent ships both halves here for the maintainer to land atomically.)

# 3. Run the test to verify the pairing is sound:
npx vitest run packages/core/hooks/inject-session-bootstrap.test.ts
# All existing assertions stay GREEN (existing behaviour unchanged for non-autonomous sessions);
# the new §2 assertion is GREEN ONLY if part A is also applied.

# 4. Verify the AIF_AUTONOMOUS=0 path is byte-identical (existing assertion already covers this
#    via the 'idempotent-check' and 'output is identical' assertions — they should stay GREEN).
```

## Why the test-half is NOT in S2 PR #2

The test-half asserts presence of "(4) §2 wait rule" in the autonomy block's digest. The
hook-half (`.claude/hooks/inject-session-bootstrap.sh`) is agent-deny-listed — the agent
cannot apply it in S2 PR #2. Applying only the test-half in PR #2 would make CI RED until the
maintainer lands proposal 2. Per the kickoff's Note B ("Add the paired assertion … in the same
PR"), "the same PR" means the SAME commit as the hook change — which is the maintainer's
apply-PR, not S2 PR #2. This proposal therefore ships both halves for atomic maintainer
application.

## Why this is safe

- The autonomy block is **opt-in** (only emits when `AIF_AUTONOMOUS=1`). Interactive sessions
  pay zero tokens and see zero behavioural change. Verified: the existing `runHook` test helper
  does not set `AIF_AUTONOMOUS`, so every existing assertion in the test file exercises the
  off-by-default path and is unaffected.
- The §2 prescription is quoted nearly verbatim from the rule's own §2 — single source of
  truth, not parallel evolution.
- The existing `inject-session-bootstrap.test.ts` has 9 assertions covering sentinel tags,
  goal anchor, payload shape, ZCode JSON, idempotency, exit code, env-plumbing. None of them
  reference the autonomy block. The new assertion is additive and gated on `AIF_AUTONOMOUS=1`.

## Risks if misapplied

- **Applying proposal 3 (claudeMdExcludes add for `autonomous-loop-continuity.md`) WITHOUT
  this proposal** breaks the declared channel contract: §2 is no longer delivered anywhere.
  The kickoff's Note B makes the pairing BINDING for exactly this reason.
- **Adding the §2 line as a 5th item instead of a 4th** is fine if the existing items are
  renumbered; the test asserts `(4) §2 wait rule` literally, so the test catches a missing
  or mis-numbered item.
- **Applying ONLY part B (test) without part A (hook)** in a maintainer commit makes CI RED
  — the test fails on the absent `(4) §2 wait rule` line. Apply A and B in the same commit.
