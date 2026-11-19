# Junior Git-delivery prompt — verified project skill repairs

> **Status:** READY FOR GIT DELIVERY — senior accepted the exact manifest/snapshot in the result report; verify it before acting.
> **Authoritative for:** task-scoped Git delivery and delivery-report contract after senior acceptance.
> **NOT authoritative for:** skill editing, content redesign, global settings, factory dispatch, deployment or release.

Latest operator decision on 2026-10-05 supersedes the earlier junior-implementation assignment. The senior implements all skill repairs, runs checks and performs read-only review after compaction. You handle only the accepted result's Git delivery.

Before acting, read [HANDOFF](../../../HANDOFF.md), the senior's actual `docs/audits/2026-10-05-skills-repair-result.md`, its explicit acceptance verdict, exact source identity and task file manifest. Reconcile live Git in `/Users/art/.codex/worktrees/9d39/rules-as-tests-aif`. If the result report or senior acceptance is absent, report that delivery is not ready; do not implement the repair spec yourself.

## Current accepted state — 2026-10-06

Workspace: `/Users/art/.codex/worktrees/9d39/rules-as-tests-aif`.
Branch: `codex/skills-standards-repair`; target: `staging`.
Original base: `c4532e16aa369ef3c66e227dd59d8ceef9e60263`.
Latest observed delivery commit: `b3abb96509e` (resolve and verify the full SHA live).
Task commits already exist; do not recreate the implementation or apply the frozen patch on top of them.

The senior accepted **82 implementation/dependency paths** in
`docs/audits/2026-10-05-skills-repair-manifest.json`, plus eleven administrative task documents
named in the result report. This prompt is one of those administrative documents.
Earlier 56/69/70/81-file identities are superseded:

- Manifest SHA256: `0194384baa6ff066d306879fce08ed8b87aea74347a9381534d0b1f2806b3121`.
- Frozen implementation/dependency patch: `/tmp/skills-repair-accepted.patch`.
- Patch SHA256: `d7eedde987d0746abde774dfb9fb1aabf8498235db2a084f7fbccc78fbab4ed1`.

Compare every manifest file's bytes in the delivered commit with its recorded SHA256.
The source, dependent citations, generated reference indexes, getff distribution manifest and
eleven installed fingerprints and the face-facts spec count are already repaired and accepted. Actual snapshot compare passed
all 15 cases; the result records the other deterministic checks and their limits. F9 remains OPEN.
Review receipts are author-session read-only checks, **not an independent cold audit**.

At this checkpoint the normal full pre-push is being retried. No successful push, PR or merge
has been observed yet. Reconcile live state before continuing; do not create a duplicate PR.
Ignored `packages/getff` payload copies and the temporary `node_modules` symlink are not task
files to commit. Remove the task-created symlink after gates if it still points to the recorded
main-clone dependencies; preserve unrelated files.

## Authorized delivery

1. Verify the accepted candidate base/head or frozen patch (including new resources) and file manifest. Preserve unrelated WIP; use the senior's codex/ task branch or an isolated task checkout without altering another session's branch.
2. If needed, stage only accepted task paths and create a task-scoped commit. Never use blanket git add -A in a dirty shared checkout. Record how the commit maps to the senior-reviewed bytes.
3. Push the task branch, create/update its PR against staging, and follow existing PR-body, pre-push and CI gates. Attach any created PR to the current task through the available app tool. Ordinary task-scoped push/PR/merge are authorized by the operator's role decision.
4. Send the senior the PR URL, exact source head, PR body and observed check status when the PR exists. After the senior verifies that receipt, merge normally to staging only after required checks pass and the result still matches accepted content. No force-push, destructive reset, skipped gate or unrelated merge. Do not merge main, deploy, publish a package, change global permissions or launch AIF.
5. If conflicts, required CI failures or upstream changes require source edits or new generated artifacts outside the accepted manifest, preserve the branch and return the concrete evidence to the senior. Do not redesign/fix skills, rerun generators or lower checks to finish delivery. A Git-only failure can be resolved within the existing non-destructive Git workflow. Do not fabricate an independent cold-review receipt if a gate requires one.
6. Return PR URL, source head, merge SHA, required CI results and any content difference from the accepted snapshot. If delivered content differs, flag senior re-verification before calling the task accepted.

Refresh HANDOFF with actual delivery state. Final response: accepted-result identity; commit/head; PR; merge SHA or precise blocker; observed gate results; evidence of content equivalence. The senior checks the delivery receipt. Do not claim implementation or semantic review as your own work, or claim senior acceptance solely from a green merge.
