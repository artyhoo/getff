# Intent continuity B1 — local acceptance evidence

> **Authoritative for:** the bounded B1 implementation and local checks on 2026-10-13.
> **NOT authoritative for:** the approved PRD, agreed specification, later C/D slices, publication, or a claim that document interpretation is mechanical.

**Verdict:** B1 accepted locally after independent read-only PASS review. No commit, push, PR or merge was performed. The shared worktree's pre-existing WIP was preserved.

B1 uses the existing ask mailbox and `scripts/check-ask-files.sh` delivery edge. Adopted asks route directly by class: `intent` to the selector's current approved PRD, `architecture` to its current agreed specification, and `task` to the exact kickoff/plan carried by a live AIF task. Task prepare and accept fetch `GET /tasks/:id` at the check boundary and hold on fetch, ID or content mismatch. Return validation binds the answer and anchored journal entry to the exact ask, feature, task ID when applicable, decision IDs, verdict and return address. Cold restoration requires an open matching ask, document-bound permitted/forbidden scope, and each declared decision's exact current same-feature journal entry. A passing answer remains advice to the owning execution/review path.

Evidence from `/Users/art/.codex/worktrees/0166/rules-as-tests-aif` after the final change:

```sh
npx vitest run packages/core/skills/intent-current-decisions.test.ts packages/core/skills/intent-pilot.test.ts packages/core/skills/intent-result-review.test.ts packages/core/skills/intent-routing.test.ts packages/runtime-bridge/test/result-review-effects.test.ts packages/core/skills/intent-ask-advice.test.ts
# 6 files, 236/236 passed
bash scripts/check-ask-files.test.sh
# PASS
shellcheck .agents/checks/check-ask-files.sh
# exit 0
npx prettier --check packages/core/skills/intent-ask-advice.test.ts .agents/procedures/intent/helpers/ask-advice.mjs .agents/procedures/dispatcher/references/parks.md .agents/procedures/arch/references/exit-and-escalation.md
# all matched
node scripts/check-arch-retell.mjs docs/superpowers/specs/snapshots/intent-continuity/design-31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078.md
node scripts/render-harness-config.mjs --check --only codex
node .agents/procedures/intent/helpers/current-decisions.mjs --check-plan-prep --feature intent-continuity --spec docs/superpowers/specs/snapshots/intent-continuity/design-31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078.md
git diff --check
# all exit 0
```

The independent cold reviewer examined the final live-GET adapter, helper, return/recovery bindings and focused tests, reran the B1 test file (38/38) and shell ask test (PASS), and returned **PASS** with no B1 blocker or major. Its stated boundary: the deterministic checks establish identity, exact bytes and current references; the advisor judges document meaning. Stages C/D and adopted execution-effect guards remain pending.
