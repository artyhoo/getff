# Junior delivery — verified Dot #2065 repairs

> **Authoritative for:** this one-shot Git delivery and conditional normal staging merge.
> **NOT authoritative for:** implementation changes, project goals, deployment, recurring schedules, model billing or new merge permissions.

Complete Git delivery of the senior's tested repair to [PR #2065](https://github.com/artyhoo/getff/pull/2065) and normal merge when the current mandatory checks and repository/coordinator policy permit it. This is a delivery task: preserve the verified implementation bytes. Read README goal, `.claude/session-bootstrap.md`, applicable CLAUDE.md merge rules and this packet before acting. Internal Git/PR artifacts are English; the operator return is Russian.

## Immutable inputs

- Repository: `/Users/art/code/rules-as-tests-aif`.
- Senior isolated worktree: `/Users/art/.codex/worktrees/dot-2065-final-fix/rules-as-tests-aif`.
- Source branch: `codex/dot-2065-final-fix`.
- Verified implementation commit: `e5a2d6682ef603ca6226deead89a541609dc0104`.
- Its parent / last reviewed PR head: `f22c9a36aec8439bca3cbbc34dc89f17ef8bf505`.
- Existing PR branch: `claude/dot-gate-round2`; base: `staging`.
- Source evidence: `docs/superpowers/plans/2026-10-06-dot-2065-final-repair-evidence.md` in the senior branch. It contains the SHA256 manifest for all eight changed implementation/test files, independent review findings and their RED→GREEN dispositions, plus full-suite limits.
- The source branch may include a later documentation-only delivery commit. Resolve its current HEAD and inspect the range from the implementation commit; use the entire branch only if the additional changes are exactly this evidence update and delivery packet. Verify that the eight source hashes still match the manifest.

The 69 SUCCESS / two SKIPPED entries last observed on GitHub belong to the old PR head. They do not validate the senior's new bytes.

## Deliver

1. Read the senior evidence. Confirm the source commit and its parent with Git; verify the eight manifest hashes and inspect the actual source-branch range. Preserve the shared staging checkout, other sessions, handoffs and untracked files. Work from the senior isolated checkout or your own suitable existing checkout. Do not copy the senior patch into shared staging.
2. Refresh #2065 through `gh`: state, head/base, current checks, mergeability, required check identities and relevant dependencies. Reconcile any actual managed-PR registration and merge lock through the existing CC coordinator mechanism you know. A durable registration transfers merge authority to the coordinator; an executor cannot silently merge or arm that managed PR. If you are the enrolled coordinator, use its existing policy. If not, deliver and send the merge-ready result to that coordinator using your existing CC messaging. AIF Handoff is excluded.
3. If #2065 is OPEN on the pinned parent, deliver the verified source branch to `claude/dot-gate-round2` with an ordinary fast-forward push. The local Git object is available through the repository's shared object store. Fetch first; verify ancestry immediately before push. Never force-push, rebase published history, rewrite another session's branch or reset shared work.
4. If the PR head or staging moved, preserve the newer work. Pure Git integration is allowed only when it keeps the eight verified source hashes and introduces no substantive implementation change. Use normal merge-forward for staging updates. Conflicting source, changed mechanisms, altered hashes, required regeneration that changes behavior or new defects return to the senior owner with exact paths/revisions. Do not redesign or “fix” these yourself. A rejected non-fast-forward push is a reconciliation signal, never permission to force.
5. If #2065 already merged, do not rewrite or reopen its history. Check whether the verified repairs are already present; report that equivalence if true. Otherwise deliver the exact repairs through a normal follow-up staging PR, attach its review/evidence and apply the same gates. Do not duplicate already-delivered work.
6. Update the PR description to describe the resulting behavior, reference the committed evidence record and preserve required `Fidelity verdict` / §1.7 Forward-check / Backward-check sections. Explain the four repaired boundaries and the test-quality corrections; do not claim a new independent CLEAN verdict, a green full local workspace suite, production autonomy or activation. Do not expose temporary paths as the only machine-readable evidence.

## Verify and conditionally merge

- The senior ran all 19 Dot suites on Node22 and Node24, the real connected HTTP/SQLite/file-adapter lifecycle, and two discriminating mutants. Use the evidence record; do not repeat senior semantic review with no new information.
- After Git integration, run the affected deterministic checks through the repository's normal local channel. All 19 `scripts/dot-review-gate/*.test.sh` suites must pass on the supported Node22 floor; fail-fast and report the failing suite. Do not install unpinned tools or change dependency pins to make the evidence look green.
- Full local `npm test` exited 1 outside the eight changed paths; the evidence record lists the failures and serial diagnostic. This is not permission to bypass CI. Current mandatory GitHub checks on the delivered head and applicable tested merge must all qualify under their actual identities/policy. A rollup count, old success, missing result or unexplained skip is insufficient.
- Use the existing CC monitoring you know to wait for the checks. Do not create a new permanent schedule, launch Dot/model work or add paid infrastructure for this one-shot task. A material new CI failure returns to the senior with the exact failing head/check/log evidence; no junior implementation repair.
- Recheck head/base, dependencies, native checks, merge lock and coordinator authority immediately before normal merge. Default staging policy is squash; use ordinary `gh pr merge ... --squash` with the exact verified head guard when supported. No `--admin`, force, protection change, paid fallback, main promotion or production auto-merge. If the actual policy holds, record the precise hold and leave the PR intact.
- Verify the GitHub result after merge: state MERGED, actual merge SHA and staging contains the delivered source. Do not use auto-merge arming as evidence that merge happened.

## Return

Report PR URL, delivered head, evidence/source commit, mandatory check conclusions, merge SHA (or the exact remaining hold) and any source reconciliation. State separately that live Dot dispatch/capture, CC integration and autonomous operation remain unverified and unlaunched. Stop after this delivery; this packet does not authorize starting the pilot.
