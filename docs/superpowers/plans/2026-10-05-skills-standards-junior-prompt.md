# Junior Git-delivery prompt — verified project skill repairs

> **Status:** READY FOR GIT DELIVERY — senior accepted the exact manifest/snapshot in the result report; verify it before acting.
> **Authoritative for:** task-scoped Git delivery and delivery-report contract after senior acceptance.
> **NOT authoritative for:** skill editing, content redesign, global settings, factory dispatch, deployment or release.

Latest operator decision on 2026-10-05 supersedes the earlier junior-implementation assignment. The senior implements all skill repairs, runs checks and performs read-only review after compaction. You handle only the accepted result's Git delivery.

Before acting, read [HANDOFF](../../../HANDOFF.md), the senior's actual `docs/audits/2026-10-05-skills-repair-result.md`, its explicit acceptance verdict, exact source identity and task file manifest. Reconcile live Git in `/Users/art/.codex/worktrees/9d39/rules-as-tests-aif`. If the result report or senior acceptance is absent, report that delivery is not ready; do not implement the repair spec yourself.

## Authorized delivery

1. Verify the accepted candidate base/head or frozen patch (including new resources) and file manifest. Preserve unrelated WIP; use the senior's codex/ task branch or an isolated task checkout without altering another session's branch.
2. If needed, stage only accepted task paths and create a task-scoped commit. Never use blanket git add -A in a dirty shared checkout. Record how the commit maps to the senior-reviewed bytes.
3. Push the task branch, create/update its PR against staging, and follow existing PR-body, pre-push and CI gates. Attach any created PR to the current task through the available app tool. Ordinary task-scoped push/PR/merge are authorized by the operator's role decision.
4. Merge normally to staging only after required checks pass and the result still matches accepted content. No force-push, destructive reset, skipped gate or unrelated merge. Do not merge main, deploy, publish a package, change global permissions or launch AIF.
5. If conflicts, required CI failures or upstream changes require substantive source edits, preserve the branch and return the concrete evidence to the senior. Do not redesign/fix skills or lower checks to finish delivery. A Git-only failure can be resolved within the existing non-destructive Git workflow.
6. Return PR URL, source head, merge SHA, required CI results and any content difference from the accepted snapshot. If delivered content differs, flag senior re-verification before calling the task accepted.

Refresh HANDOFF with actual delivery state. Final response: accepted-result identity; commit/head; PR; merge SHA or precise blocker; observed gate results; evidence of content equivalence. The senior checks the delivery receipt. Do not claim implementation or semantic review as your own work, or claim senior acceptance solely from a green merge.
