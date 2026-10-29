# Intent continuity A1 — acceptance evidence

> **Authoritative for:** the coordinator's local A1 acceptance checks and remaining review boundary on 2026-10-13.
> **NOT authoritative for:** product intent, the agreed architecture, later slices B/C/D, or publication permission.

**Final local verdict:** A1 accepted within the kickoff scope after the coordinator's bounded repair, 198/198 tests, 4/4 host checks and independent PASS review. No publication action is implied.

The A1 implementation lives in the shared `0166` worktree and preserves its pre-existing WIP. The exact product authority remains PRD SHA-256 `f1a42d1c375b9f4b96dc662da714ed9abf54885fa93716b847d65d0cd7a7ee2a`; the operator-agreed specification remains SHA-256 `31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078`. The read-only current-selector query returned revision 2 with those references after all probes. No commit, push, PR or merge was performed.

## Observed behavior

- AC1: fresh artifact-only reviewers rejected a candidate that replaced documentation-driven stack-specific rule/test generation with ready-made templates (`mismatch`, published attempt `b41062b2...`, `--check-presentation` exit 2), and accepted the corrected candidate (`matches`, published attempt `0d0c97e9...`, exit 0). The agreed design also has a `matches` attempt `33c18f8c...`. The three immutable attempt records remain under `.claude/orchestrator-prompts/intent-continuity/spec-reviews/`.
- AC2: missing/stale/unapproved/unagreed/cross-feature/cross-repository evidence holds the matching transition in the focused tests. The selector is read independently of a candidate kickoff. A missing adoption marker cannot claim the frozen legacy route.
- AC4: a fresh no-history, read-only advisor received only the selector, spec-review corpus, exact PRD/spec snapshots and their approval/agreement records. It recovered the promise, current revision 2, exact PRD/spec hashes, three attempt outcomes and their applicability. The advisor returned `null` for a command in a document it had not been given instead of inventing it. Job evidence: `/Users/art/.claude/jobs/edbd9d66/tmp/ac4-recovery.json` and `ac4-truth-key.txt`.
- AC9: the initial WIP baseline was preserved. The frozen legacy discriminator and foreign-repository checks have negative tests. Adopted dispatch/start/resume effect guards remain outside A1 and are held for later stages.
- AC10: a fresh `codex exec --ephemeral -s read-only` session independently found the `/arch` card and canonical procedure, read the installed Superpowers brainstorming and Matt Pocock grilling texts, emitted a two-question frontier round, preserved operator discussion of the written spec, required no second plan-preparation vote, and honored design-only/no-auto-dispatch. The read-only non-interactive probe did not perform an actual operator exchange or write a spec. Job evidence: `/Users/art/.claude/jobs/edbd9d66/tmp/ac10-arch-contour-probe.txt` and `ac10-contour-scoring.md`.

The coordinator found and had the execution owner repair two further A1 writer defects. First, atomic rename over a selector symlink forked a shared canon into local bytes. Second, after that repair, sibling worktrees used separate local writer locks for one canonical target. The last repair locks beside the resolved target, applies that lock to selector and freeze writes, and refuses a final-component symlink chain beyond its bound. Three paired tests were RED against pre-repair bytes (`3 failed, 41 passed`) and GREEN after repair (`44 passed`). The exact reproduction, changed-function list and logs are in `/Users/art/.claude/jobs/edbd9d66/tmp/a1-lock-race-repair.md`.

## Coordinator verification after the last repair

From `/Users/art/.codex/worktrees/0166/rules-as-tests-aif`:

```sh
npx vitest run packages/core/skills/intent-current-decisions.test.ts packages/core/skills/intent-pilot.test.ts packages/core/skills/intent-result-review.test.ts packages/core/skills/intent-routing.test.ts packages/runtime-bridge/test/result-review-effects.test.ts
# 5 files, 192/192 tests passed, exit 0

bash scripts/host-verify.sh .claude/orchestrator-prompts/intent-continuity/kickoff-a1.md
# 4/4 commands passed, exit 0; includes 148/148 kickoff tests and 39/39 Codex contributor tests

node .agents/procedures/intent/helpers/current-decisions.mjs --read --feature intent-continuity
# exit 0; revision 2; exact approved PRD and agreed specification preserved
```

The independent cold review returned **REVISE**. It confirmed the last repair covers the reproduced sibling-lock defect, then found two A1 blockers: the write target is resolved again after acquiring its lock, so symlink retargeting can put a write under the wrong lock; and an older valid PRD approval can be replayed after A→B to return the selector to A because the writer lacks the required expected-prior revision/ref comparison. The same GLM execution owner is repairing these findings. The 192-test and 4/4-host results above predate that repair and must be rerun. A1 is **not accepted** yet. The complete intent-continuity feature remains incomplete: B, C and D are later stages.

Follow-up review after that repair remained **REVISE**. The coordinator independently reran the expanded A1 battery (196/196) and host contract (4/4), with live selector revision 2 unchanged. The reviewer confirmed the historical-replay and selector-retarget fixes, but found that the expected-prior token is optional and omitted by the documented `/intent` and `/arch` recorder routes. A delayed, distinct receipt can therefore advance after an intervening decision. The freeze writer also binds only its target directory, so a same-directory symlink retarget can overwrite another file. Both findings were returned to the same GLM execution owner for a further tests-first repair. A1 remains **not accepted**; the green counts above are pre-repair evidence.

The operator then directed Codex to finish A1 without GLM; the GLM owner was stopped. Codex added two failing regression cases: an untokened mechanism advance succeeded, and a same-directory freeze symlink published at an unrelated filename. The repairs require `--expect-revision` for mechanism-recorded decisions, carry the revision from the `/intent` read or `/arch` presentation check through their actual recorder commands, require the freeze's exact canonical target, and publish it with a write-once hard link. The coordinator reran the five-file battery (198/198), host contract (4/4), syntax check and live selector read (revision 2, original PRD/spec unchanged). The final independent read-only review returned **PASS** for the bounded writer-lock, revision-compare and freeze repair, with no remaining Important finding in those surfaces. A1 is **accepted locally within its kickoff scope**. AC10's fresh Codex probe was non-interactive and read-only; it demonstrated all five scoped predicates but did not exercise a real new operator exchange or writable dispatch temptation. That limitation is recorded in `ac10-contour-scoring.md`. B/C/D and adopted execution-effect guards remain separate work.
