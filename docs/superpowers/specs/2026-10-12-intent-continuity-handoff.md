# Intent continuity — /arch session handoff

> **Date:** 2026-10-12, Europe/Moscow.
> **Authoritative for:** continuation state and evidence pointers for this session after context compaction.
> **NOT authoritative for:** product meaning, architectural approval, live implementation status or permission to execute. The linked PRD and decision register own their respective content.

## Immediate instruction to the next continuation

Speak Russian with the operator; write repository artifacts in English. Work in `/Users/art/.codex/worktrees/0166/rules-as-tests-aif` and verify `pwd` first. The app default and skill-picker links can point to `/Users/art/.codex/worktrees/8e72/rules-as-tests-aif`; do not switch to that checkout. Use the canonical procedures in the requested `0166` worktree.

After context compaction, the operator chose D5 option A: routine work inside the agreed architecture is autonomous, while material replacement returns for specification discussion. Two initial two-altitude rounds returned top-down GO and bottom-up REVISE; an operator-authorized bottom-up-only third round returned REVISE. The operator then clarified that both existing autonomous and manual launch routes are acceptable and that redesigning `/arch` for an extra launch approval is unwarranted. The PRD was narrowly revised and reapproved on exact bytes. An operator-requested fourth round returned REVISE on exact spec-agreement authority and start-effect integration. Bounded author corrections then received fresh focused top-down and bottom-up GO on frozen input `1281a0b1...`. The operator subsequently said “го кикоф и отдай глм на реализацию”, authorizing kickoff and GLM implementation. The exact written-spec agreement is recorded in [the agreement record](2026-10-12-intent-continuity-spec-agreement.md). Stage A1 is the first scoped implementation packet; later B/C/D remain pending.

The operator accepted checkpoint timing as P8/D4 and later explicitly chose D5 option A. Do not ask either again or misread those answers as approval of the complete architecture.

## Read in this order

1. [Exact product approval](2026-10-12-intent-continuity-approval.md), then its linked current immutable snapshot. PRD SHA-256: `f1a42d1c375b9f4b96dc662da714ed9abf54885fa93716b847d65d0cd7a7ee2a`. The earlier approval/snapshot remain historical evidence.
2. [Readable PRD](2026-10-12-intent-continuity-idea.md).
3. [Current architectural proposal](2026-10-12-intent-continuity-design.md), especially sections 6–10 and Consensus retell.
4. The dated addendum in [earlier design](2026-10-07-idea-arch-incremental-design.md). Earlier design proposals are not implemented-state evidence.
5. For procedure execution, load `.agents/procedures/arch/SKILL.md`, `docs/codex-contributor.md` and the conditional arch references. The supplied native `/arch` card is a pointer, not the entire procedure.

## Settled meaning — do not reopen discovery

- PRD describes what we create, why and the delivered experience as if already available.
- Specification describes how the solution works; the operator discusses idea and architecture/specification.
- Kickoffs/plans are prepared autonomously after specification agreement. Both existing launch routes are valid: an authorized autonomous route may dispatch a ready kickoff, or the operator may choose a manual `/pipeline` launch. No separate per-kickoff approval or launch registry is required. The previous design-only instruction applied until the later explicit GLM implementation request.
- Execution, review, tests and in-scope repair then run autonomously under existing project principles and applicable stack rules, including test-quality, negative-test and anti-tautology requirements. This feature does not invent another coding-standard catalog or build the consumer rule generator.
- Each advisor has a primary document: intent → PRD; architecture → spec; task → kickoff/plan. Its recorded decisions and a bounded concrete question/subject accompany that document.
- Questions route directly by class. An earlier mandatory owner-to-owner relay interpretation was explicitly superseded. Document dependencies are not mandatory agent hops.
- Intent review uses product authority and the artifact/result under review, without inheriting the technical authoring conversation. It must see the candidate specification to compare it; product-only does not mean blind to its subject.
- A changed idea requires operator agreement and renewed discussion of the affected specification.
- Restore from documents and recorded decisions; permanently active sessions and full chat retention are unnecessary.
- Preserve prior checks as evidence, with honest identity/applicability through later changes.
- Scope is the complete discussed lifecycle, delivered incrementally with existing mechanisms. Do not silently reduce it to the first small task or expand it into a replacement factory.

The reported motivating failure is losing meaning **during spec writing**. Example: documentation-driven generation of stack-specific rules/tests repeatedly became ready-made stack templates because that was easier. The one-button installer example is test material, not an implementation task authorized by this session.

## Current design/review frontier

The technical D6–D8 rows in the design were author selections at the written-spec agreement boundary; the operator has now agreed to that exact complete design. D9 records the operator's both-routes clarification plus proposed document-currency checks. The operator-owned meaning/authority rows D1–D5 are answered. The design includes a real first design-time path, direct document-role advice, frozen legacy/adopted-task discrimination, independent current PRD and agreed-spec selection, and checks at existing dispatch/start/resume effects. Stage A1 implements the first spec-fidelity path and current-decision selection; B/C/D and adopted dispatch/start/resume effects remain future stages.

The operator also asked whether installed Superpowers and Matt Pocock skills actually coexist on Codex. Both are installed and `/arch` explicitly resolves the `brainstorming` one-question versus `grilling` frontier-round conflict. `docs/codex-contributor.md` maps absent Skill-tool invocation to full installed-file reads. However the installed `superpowers:brainstorming` 6.4.2 asks for a separate operator review of the implementation plan; that conflicts with the agreed autonomous kickoff/plan preparation. Section 7/D8 now proposes a narrow binding and a fresh Codex behavior test. Source text and this one session do not prove general automatic routing or full host compatibility. Do not report “all fixed.”

The operator clarified that auto-launch is acceptable in the existing autonomous route and a manual `/pipeline` launch is also acceptable. Do not make this a major redesign or ask about it again. `/arch` can author a kickoff from an agreed spec, then use the existing chosen route; a design-only instruction prevents dispatch only while that instruction applies. Round 4 returned REVISE. The author amended only the independent exact-spec-agreement reference, checks before `start-reviewed`/other start-resume effects, and a pre-write no-auto-marker rule for design-only work. Focused round-5 reviewers returned GO on those corrections. The later operator instruction authorized Stage A1 kickoff and GLM implementation; the agreement is exact-content, not a blanket approval of later spec edits.

## Existing-state audit: facts and limits

- `/intent` already describes narrative brief, essential promises/rejected interpretations, exact snapshot approval, artifact-only restoration and independent first-result comparison.
- `/arch` already preserves premises/decisions, consensus retell and question-class escalation. `scripts/check-arch-retell.mjs` checks structure, not semantic truth.
- `/pipeline` and runtime provide launch gates, review/park/answer and continuation guards. `packages/runtime-bridge/src/resultReview.ts` still holds `contract-revision` / `product-decision` without a demonstrated serialized owner path; do not label this complete.
- The ask-file checker explicitly validates pointer shape, not journal existence/honesty. Restoration completeness is not proven by a valid ask file.
- A real generic arch advisor locator was inspected read-only at `/Users/art/.claude-coordination/rules-as-tests-aif/ADVISOR.md`; it is not proof of per-feature product context. Do not rewrite the global locator or launch/message its session.
- No live factory/advisor chain was exercised in the audit. Source instructions, deterministic tests and actual semantic behavior remain separate evidence classes.

Earlier audit commands passed in this session:

```sh
npx vitest run packages/core/skills/intent-result-review.test.ts packages/runtime-bridge/test/result-review-effects.test.ts packages/runtime-bridge/test/aif-answer.test.ts
# 3 files, 127 tests
npx --no-install vitest run packages/core/skills/intent-routing.test.ts packages/core/hooks/snapshot-for-seat.test.ts
# 2 files, 31 tests
bash scripts/check-ask-files.test.sh
# PASS
```

These 158 tests plus the shell suite do not prove semantic routing: some routing tests search procedure text, semantic verdicts in fixtures are predetermined, and no live end-to-end behavior was observed. Do not repeat the entire test suite merely to resume document discussion.

The earlier design's Task 2 is feedback application, small/direct/reused-brief routes, later-feature checkpoints and scoped repair/recovery. It depends on Task 1 evidence/aligned ruling or authorized repair. Neither Task 1 completion nor whole Task 2 readiness was established here.

## Independent review evidence

Round 1 Inputs-ref `8048eed3bddd2c435c1809d998942284bb73fcc6`: [top-down GO](reviews/intent-continuity/round1-top-down-8048eed3.md), [bottom-up REVISE](reviews/intent-continuity/round1-bottom-up-8048eed3.md). The bottom-up findings were adopted into the next revision: missing-scope legacy bypass, architecture-only consult target, unchecked PRD approval and publication-writer assumption.

Round 2 Inputs-ref `7513d6d58eb660a1c714ed9cc1f6395ad7ed3321`: [top-down GO](reviews/intent-continuity/round2-top-down-7513d6d5.md), [bottom-up REVISE](reviews/intent-continuity/round2-bottom-up-7513d6d5.md). Bottom-up confirmed round-1 gaps addressed at design level, then found auto-dispatch before operator choice and no independent current-approval selector. The live design was amended after that snapshot and submitted to the operator-authorized bottom-up round 3. The first two rounds used fresh no-history read-only agents with immutable snapshot paths. The reports remain separate axes; see the design's per-finding dispositions.

Operator-authorized round 3 Inputs-ref `2b52bff8103c0b0772adfad1c0d6cb2b5dd4e3ab`: [bottom-up REVISE](reviews/intent-continuity/round3-bottom-up-2b52bff8.md), no top-down seat. The reviewer found that current PRD approval and spec-review freshness were checked at preparation but not expressly at the later dispatch effect. The subsequent revision bound freshness to adopted dispatch effects, including a PRD A→B supersession with unchanged kickoff. The operator then accepted both existing launch routes, so the separate launch-selection part of that interim revision was dropped before round 4.

Operator-requested final round 4 Inputs-ref `6d26ba299a27da49a1efc145e1184f44f208e495`: [top-down REVISE](reviews/intent-continuity/round4-top-down-6d26ba29.md), [bottom-up REVISE](reviews/intent-continuity/round4-bottom-up-6d26ba29.md). The reviewers found no independently selected current operator-agreed spec, no explicit freshness check at post-planning `start-reviewed`, and no pre-write binding to prevent the auto marker during design-only work. Sections 4/6/7 and AC2/AC5/AC8 were amended after the frozen input. At that point the amendment had no independent GO; the later operator continuation authorized the focused closure recorded next.

Operator continuation, focused round 5 Inputs-ref `1281a0b1118a1e84886943315c120cbee266d8e8`: [top-down GO](reviews/intent-continuity/round5-top-down-1281a0b1.md), [bottom-up GO](reviews/intent-continuity/round5-bottom-up-1281a0b1.md), zero graded findings. Both seats reviewed the exact design SHA-256 `969e4e7660993a73acf065d5d534581578847097b877b43dbe5b87da2ceb6615`. Subsequent live-design edits only annotate review status/history and the next boundary; check that diff if relying on exact-content review. GO is a design finding closure, not implementation proof or operator written-spec agreement.

The operator then agreed to the presented written design and authorized GLM implementation. [The exact agreement](2026-10-12-intent-continuity-spec-agreement.md) preserves design SHA-256 `31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078`. [Stage A1 kickoff](../../../.claude/orchestrator-prompts/intent-continuity/kickoff-a1.md) is the first implementation packet. It contains no `bridge: auto` marker because the selected route is a directly monitored local GLM session, avoiding a second dispatch path.

## Stage A1 implementation and acceptance

The operator-requested GLM implementation ran in the required `0166` worktree under the [Stage A1 kickoff](../../../.claude/orchestrator-prompts/intent-continuity/kickoff-a1.md). Mac restart interrupted earlier background owners; the final bound owner was `edbd9d66-a819-451d-b591-fb40554108d2` (`glm-5.3`, auto mode). Do not resume it as an active implementation task merely because an old handoff mentioned work in flight. The pre-launch WIP recovery bundle remains at `/tmp/intent-continuity-a1-wip-baseline/`; it is recovery evidence, not permission to restore over live work.

A1 now has a working candidate-spec-to-PRD fidelity path, independently selected current PRD/spec authority, immutable specification-review attempts, a frozen legacy discriminator, and guards for `/arch` presentation/agreement and plan preparation. The wrong stack-template candidate was rejected, the corrected candidate and agreed design passed, and the current selector retained the approved PRD `f1a42d1c...` and agreed spec `31000fc2...` at revision 2. A fresh artifact-only role reconstructed those decisions and attempt outcomes without conversation handles. A fresh ephemeral read-only Codex `/arch` probe read the installed `brainstorming` and `grilling` texts, emitted a frontier round, and preserved the written-spec, plan-preparation and design-only launch boundaries. See `/Users/art/.claude/jobs/edbd9d66/tmp/ac4-recovery.json`, `ac10-arch-contour-probe.txt` and `ac10-contour-scoring.md` for the exact probe outputs. These job-local artifacts should be copied into durable review evidence before relying on them across host cleanup.

Independent coordinator audit found writer defects after the worker's initial cold review: atomic rename replaced a canon selector symlink; sibling writers held separate locks; a retargeted selector could put a write under the wrong lock; and historical approvals could be replayed. The GLM owner repaired those cases. Follow-up review then found that the ordinary recorder routes omitted the expected-revision token, and the freeze writer could publish to another filename inside the locked directory. The operator directed Codex to finish without GLM, so session `edbd9d66` was stopped. Codex reproduced both remaining cases with failing tests, made the revision token mandatory for mechanism decisions, carried it through `/intent` and `/arch`, bound freeze publication to its exact canonical filename, and made it write-once. The coordinator reran the five-file Vitest battery (198/198), `bash scripts/host-verify.sh .claude/orchestrator-prompts/intent-continuity/kickoff-a1.md` (4/4), and a read-only current-selector query (revision 2, unchanged approved PRD/spec). Final independent read-only review returned PASS on the bounded repair, and A1 was accepted locally within its kickoff scope. See [A1 acceptance evidence](reviews/intent-continuity/a1-acceptance.md). No commit, push, PR or merge was made; the large pre-existing WIP remains.

B (cross-workflow document advice), C (result/change continuity) and D (delivery breadth), plus adopted dispatch/start/resume guards, remain follow-on stages. Do not call the complete intent-continuity feature done because A1 passes.

## Stage B1 continuation (2026-10-13)

The operator directed Codex to finish B1 itself, then later requested GLM again; the final bound GLM session `0b868ca3` was stopped after its candidate failed cold review. Codex finished the bounded B1 scope in this `0166` worktree. Adopted asks now use the existing ask gate for direct document-bound `task`/`architecture`/`intent` routing and owner-led return. The task route uses a live `GET /tasks/:id` at both prepare and accept, compared against the ask's task ID and exact kickoff/plan bytes. Cold restoration validates exact current same-feature decision entries rather than loose ID mentions. The final independent read-only review returned PASS, and the six-file regression passed 236/236 with the ask shell test PASS. See [B1 acceptance evidence](reviews/intent-continuity/b1-acceptance.md) for commands and boundaries. No commit, push, PR or merge was performed. C/D and adopted execution-effect guards remain follow-on work; the full feature is not complete.

## Stage C/D continuation (2026-10-13)

The operator directed Codex to finish without GLM. C/D code and canonical/native delivery were completed locally in the `0166` worktree, preserving existing WIP. The adopted runtime now reselects current PRD/spec/review at reachable effect boundaries; result attempts publish write-once and current use checks the independently selected PRD and observed revision. One unchanged pre-freeze live AIF task omitted from A1's empty task-ID freeze was recovered by a receipt only after live AIF readback proved project, status and timestamps. See [C/D bounded acceptance](reviews/intent-continuity/c-d-acceptance.md) for final commands, cold code PASS, the independent product `needs-evidence` ruling and its limits. Technical checks pass, but full AC7 product acceptance remains open: a real result-to-PRD comparison must justify a positive attempt before its later invalidation can be demonstrated. No commit, push, PR or merge was performed.

## Files and WIP preservation

Pre-existing WIP is substantial (the earlier audit counted 381 status entries). Do not reset, clean, bulk stage, bulk format or commit unrelated changes. No branch commit or push was made during the design or A1 implementation work. Detached Git objects for review snapshots were built with a separate temporary index; the branch HEAD and shared index were not advanced. New files remain untracked; retain them across continuation.

This session's intended document changes:

- New PRD, approval and design: `docs/superpowers/specs/2026-10-12-intent-continuity-{idea,approval,design}.md`.
- Current exact PRD snapshot: `docs/superpowers/specs/snapshots/intent-continuity/f1a42d1c375b9f4b96dc662da714ed9abf54885fa93716b847d65d0cd7a7ee2a.md`; the prior `a722...` snapshot remains historical.
- New handoff: this file.
- Nine architecture review reports: `docs/superpowers/specs/reviews/intent-continuity/round{1,2,4,5}-{top-down,bottom-up}-*.md` and `round3-bottom-up-2b52bff8.md`; plus the A1 kickoff's initial REVISE and focused GO audit reports in the same directory.
- Exact written-spec agreement and frozen design: `docs/superpowers/specs/2026-10-12-intent-continuity-spec-agreement.md` and `docs/superpowers/specs/snapshots/intent-continuity/design-31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078.md`.
- Stage A1 execution packet: `.claude/orchestrator-prompts/intent-continuity/kickoff-a1.md` (tracked as a regular file, deliberately no auto-dispatch marker).
- `docs/superpowers/specs/2026-10-07-idea-arch-incremental-design.md`: a dated addendum linking the clarified product boundary and pending follow-on design; original content retained.
- `CONTEXT.md`: product brief, specification and kickoff/plan glossary entries; no implementation instructions added.

Before this handoff update, validation passed: current design's `check-arch-retell.mjs`, local document link checks, byte-identical PRD snapshot/approval/spec digest bindings and `git diff --check`. The PRD approval is **Codex's exact-content review under the operator's delegated brief-approval instruction**, not a false claim that the operator personally reviewed the exact authored bytes. The operator's exact written-design agreement is recorded in the linked spec-agreement document.

## Resume message

Briefly tell the operator in Russian: A1/B1 and the bounded C/D implementation have passed local technical checks, while final C1/IC-P6 product acceptance remains `needs-evidence`. Preserve the large pre-existing WIP. Do not resume a stale GLM session. The next useful proof is a real observed result-to-PRD comparison, then change invalidation of a justified positive attempt; do not claim the complete feature matches the PRD before that evidence exists.
