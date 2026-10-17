# Project skills standards repair — senior implementation kickoff

> **Status:** IMPLEMENTED — deterministic senior acceptance recorded in the result report; junior delivery pending — [packet review](2026-10-05-skills-standards-packet-review.md).
> **Authoritative for:** the senior implementation sequence and verification/report contract for [the spec](../specs/2026-10-05-skills-standards-repair-design.md).
> **NOT authoritative for:** project goal, global settings, task dispatch to AIF, publication or unrelated refactors.

## Goal and execution destination

Implement F1–F8 from [the audit](../../audits/2026-10-05.md) under the spec's acceptance contract; preserve F9's honest evidence gap. Primary destination: `/Users/art/.codex/worktrees/9d39/rules-as-tests-aif`; baseline HEAD `c4532e16aa369ef3c66e227dd59d8ceef9e60263`.

This is a local kickoff under docs/superpowers/plans. It is not an executable /pipeline or bridge-auto dispatch input. No factory session is being launched. If the operator later chooses AIF, first publish the dispatch input to staging and verify task-side readability through the existing pipeline; a Mac path does not establish container access.

## Step 0 — Re-ground

Read AGENTS.md, README Why this exists, session-bootstrap, the spec, audit addendum and HANDOFF. Run live git status/log, identify source owners and preserve unrelated WIP. The senior's partial source draft was restored; do not apply temporary abandoned patches. Create a task branch with codex/ prefix before implementation on detached HEAD; do not move another session's branch.

Read skill-creator/writing guidance already available to the harness and applicable project rules, especially doc authority, description quality, source ownership, reviewer discipline and language discipline. Use English for internal artifacts, preserve bilingual match metadata.

## Step 1 — Concrete contracts first

Repair F1–F6/F8 in source owners as specified. Inspect each real helper/installer before changing a command or path. Check the doctor passive inventory excludes verify-bridge/ensure-parallel and preserves the existing Tier-1/Tier-2 contract. Check API harvest argument parsing and Git Data behavior without invoking the live API. Resolve consumer agent and runner availability honestly.

## Step 2 — Conditional decomposition

For each of pipeline/dispatcher/doctor/orchestrator/arch/night-mode, enumerate current common constraints and mode branches **before** extraction. Keep the card's common input/result/actions and mandatory pre-action limits. Move each substantial branch/history to a named reference with a direct condition-bearing pointer; rewrite relative Markdown links and anchors for its destination. Preserve original command execution context and canonical source delegation.

Do not use a single mandatory load-everything appendix, a pasted summary with hidden constraints, dense one-line paragraphs or deleted incidents as a shortcut. Keep genuinely simple skills standalone. Record before/after lines, words and bytes; explain each exception to the 200-line working target.

## Step 3 — Regenerate and verify

Run `bash scripts/generate-plugin-skills.sh` after source changes, then inspect generated payload diff. Do not hand-edit generated payloads. Preserve the independent tool-bootstrapping scopes and plugin-native entries.

Run the destination contract below. Some tests require committed/tracked inputs or a clean generated-payload status: use a disposable clone containing the **candidate bytes**, with only task-scoped temporary commits as necessary. Do not run a pristine-HEAD test and present it as candidate verification. For generation tests, copy candidate source/payload first, establish a clean disposable snapshot, then run the existing test. Observe its no-op check against those candidate bytes.

The preparation checkout lacks node_modules; Vitest 4.1.8 was observed in the main clone at `/Users/art/code/rules-as-tests-aif/node_modules/.bin/vitest` on 2026-10-05. Re-check availability. Reuse a temporary local dependency link or the existing project dependency workflow; do not alter manifests/lockfiles or claim an unrun suite passed. Remove temporary local links on exit.

```bash host-verify
bash scripts/check-skill-drift.sh
bash tests/plugin/skill-routing.test.sh
npm --prefix packages/core run test:principles -- 09-doc-authority-hierarchy 15-skill-paired-negative 18-meta-orchestrator-output-format 21-agnosticism-conformance 39-skill-fence-orch-home 48-skill-description-budget
```

The final command's existing npm script expands to `vitest run principles/ ...`: it may select the whole principle suite. Use a direct `vitest run <explicit test paths>` for a targeted rerun if that is appropriate, documenting the actual command. Do not confuse a selected test list with a full-suite verdict.

Additional acceptance evidence, required beyond that block:

- `bash tests/plugin/skills-generation.test.sh` on a disposable clean candidate snapshot.
- Strict YAML parse of all 27 production files using an available real YAML parser; not the repo's permissive budget extractor. Verify raw metadata and flags against baseline.
- Check local Markdown targets/anchors of changed cards **and** resources; inspect runtime bare paths separately. Check the full production population and source-to-plugin copies.
- Exercise framework/consumer/plugin-only resolution for F4/F5 in fixtures or temporary roots, including missing-agent/runner outcomes. Use existing installer fixtures where practical; a plugin validator alone does not prove runnable consumer instructions.
- Inspect required invariants and record lines/words/bytes for six cards. No structural pass proves model routing or full live AIF behavior.
- `git diff --check`; relevant generation/installer/principle tests if their paths or expectations change. Keep meaningful negative controls when moving a test target.

## Stop conditions

An actual host permission block, protected-artifact conflict, unresolved semantic contradiction, changed owner after upstream migration, or missing material evidence is ATTN. Complete independent work and name the blocked acceptance item. Do not solve by broadening permissions, lowering a gate, changing profiles or deleting source history.

The senior performs source work, task-scoped local branch/commits, verification and review. After explicit senior acceptance, the junior handles task-scoped push/PR/normal staging merge through existing gates under the revised delivery prompt. No CI bypass, force-push, unrelated merge, deployment, paid inference or live AIF mutation is authorized.

## Active AI traps and self-application

T2/T3: inspect command outputs and exact paths, not a plausible recollection ([digest](../../../.claude/rules/ai-laziness-digest.md)). T10: enumerate all production copies and every mode/invariant before declaring complete. T14: unavailable/skipped checks stay unavailable/skipped. T15: apply evidence discipline to this packet and junior report. T19: senior cold review is a separate result gate; do not self-certify it ([reviewer discipline](../../../.claude/rules/reviewer-discipline.md)).

Domain S1: strict YAML failure is not a native CC loading failure. S2: metadata/line budgets do not establish routing quality. S3: every Markdown link can pass while a bare runtime path is unusable in a consumer. S4: moving text lower in the same entrypoint or requiring all appendices does not save activation context.

## Return contract

Write `docs/audits/2026-10-05-skills-repair-result.md` using [the result template](2026-10-05-skills-standards-result-template.md). Update only audit statuses plus an appended repair note; preserve original audit evidence. Refresh HANDOFF with real state. Return report path, branch/base/head, patch or commit identity, changed-file list, command receipts, F1–F9 table, residuals and the senior acceptance verdict. Only then give the accepted manifest/identity to junior for Git delivery. The senior checks actual bytes through [the result-review plan](2026-10-05-skills-standards-review.md).

## Role update — 2026-10-05

This kickoff is executed by the senior after compaction. The old junior implementation assignment is superseded; the technical sequence remains applicable. The junior does not fix source or resolve substantive review findings. Any Git-delivery conflict that changes accepted content returns to the senior before renewed acceptance.
