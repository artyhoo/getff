# Canonical agents completion — factory implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this continuation task-by-task. Keep one isolated AIF implementer; do not redispatch completed migration slices or commission per-step review rounds.
> **Authoritative for:** AIF continuation steps and result handoff for the existing two-stage implementation.
> **NOT authoritative for:** project goal, host trust or publication permission.

**Goal:** Finish the existing canonical refactor and consumer delivery; return a frozen result for independent cheaper review and host validation.
**Architecture:** Reuse the prepared common .agents owners, thin native entries and existing installer/package machinery.
**Tech Stack:** Markdown, Bash, Node, TypeScript/Vitest, existing runtime-bridge.
**Spec:** [completion design](../specs/2026-10-05-agents-canonical-completion-design.md).

## Global constraints

All constraints in the spec apply. Work in the AIF task's own isolated checkout, never the shared container base.
The Mac paths are origin addresses, NOT paths available to a remote worker. Resolve packet location in the task description and verify packet.sha256 first.
Normal isolated AIF result commits are permitted; the dirty 0479 index, trust and global configuration remain protected. The junior coordinator has latest operator authorization for task-scoped Git publication/merge in an isolated delivery checkout.
The junior coordinator, not the implementer, uses the existing sweep/harvest/PR/check/merge flow under latest scoped authorization. No merge past failing required gates; no unrelated release.
AIF project: rules-as-tests-aif, id 441c1c0c-b633-4612-a34c-2cc0c4d0eaf2; configured profiles, no per-task model marker.
Resume; do not reimplement the 211-path migration.

## Review focus

- A thin entry discovers a skill but omits its full body, invocation argument or required shell step.
- A per-file symlink copied into a test fixture writes back into the canonical owner.
- A fresh Git/npm destination loses ignored entries or follows a link outside its payload.
- Repeat force/refresh overwrites a consumer customization or copies a native alias onto its own seed.
- Green adapter tests conceal missing real Codex callbacks or feedback delivery.

## Task 1: Recover the frozen prepared result

**Files:** packet/continuation.json, checkpoint/integrated-source-in-progress.tar.gz, checkpoint/integrated-owned-paths.json, checkpoint/integration-preimages.json, original-wip.bundle, checkpoint/canonical-compaction-handoff.md.
**Consumes:** immutable packet identities and source-base 1b390629d4806e9378989533c7a1501dd4c08b08.
**Produces:** isolated reconstructed result plus an upstream reconciliation report.

- [ ] Verify every packet.sha256 entry before reading source as authoritative.
- [ ] Read completion spec, latest compaction handoff and source map; use saved logs only for the exact scopes they prove.
- [ ] Reconstruct the original WIP baseline in a separate disposable clone from original-wip.bundle; overlay the integrated source archive there, after checking members are repository-relative.
- [ ] Obtain actual source-base history from the same repository's AIF clone into that disposable clone, without writing the shared base. Preserve WIP; use the real history for history-dependent tests.
- [ ] Compare intended change paths against preimages before adapting to current AIF staging. The synthetic WIP root is a fixture, never a merge parent for the production branch.
- [ ] Transfer the prepared delta onto the isolated AIF task branch with normal Git three-way reconciliation. Preserve newer upstream changes; report unresolved material conflicts instead of overwriting them.
- [ ] Record every added reconciliation change. Do not rerun old slice-copy scripts or the already-executed final-canonical-joins.py.

## Task 2: Close concrete remaining failures

**Files:** current owned MCP/read-owner tests, .agents/procedures/pipeline/helpers/lib/common.sh, canonical bootstrap, docs annotations; discover exact failed test names from saved logs.
**Consumes:** recovered source and recorded failures.
**Produces:** narrow repairs with RED/GREEN receipts, or an evidenced baseline limitation.

- [ ] Recheck the recorded-registry MCP warning case from canonical-failed-runtime-environment.log; MCP decision subset already passed.
- [ ] Recheck changed scope/annotation joins. Pipeline anchor already has 11/11 passing controls; repeat only if reconciliation changed it.
- [ ] Distinguish Cargo toolchain freshness (stored 1.96.1 versus observed 1.98.1) from task regression. Follow existing evidence-regeneration owner if regeneration is needed; never invent a passing baseline.
- [ ] For genuine regressions, reproduce a meaningful failure, fix the owning source and rerun the failing/affected control.
- [ ] Preserve the restored empty tool-decisions template and pinned upstream reference bodies. No fixture-polluted bytes may enter the result.

## Task 3: Finish installer snapshots and standalone delivery

**Files:** setup.d/portable-bindings.sh, installer owners, tests/install-sh/baselines, scripts/build-getff-dist.sh, packages/getff/MANIFEST.sha256.
**Consumes:** frozen common/native payload and snapshot handoff.
**Produces:** all 15 current fingerprints and standalone Git/npm receipts.

- [ ] Read checkpoint/canonical-delivery-snapshot-handoff.md. Temporary captures were successful but some helper/bootstrap hashes are stale; none was accepted as final.
- [ ] Compare current payload against temporary-baselines; narrowly recapture stale cells through the existing snapshot harness.
- [ ] Review expected .agents/native-link changes and ensure literal link targets remain inside delivery. Keep all 15 cells.
- [ ] Copy reviewed fingerprints and run bash tests/install-sh/byte-identical.test.sh once; recapture only genuinely stale failing rows.
- [ ] Run affected canonical-bindings, canonical-link-containment and getff-dist-canonical-links controls if reconciliation changed their inputs.
- [ ] Stage ONLY the intended set in the disposable result checkout. Run existing build-getff-dist commands; regenerate MANIFEST after final source changes; require existing --check/--check-index modes.
- [ ] Run local npm pack, install into an isolated consumer with original contributor source unavailable, and exercise helpers/checks through installed native paths.
- [ ] Construct a fresh checkout/archive from the intended tracked set; confirm Codex discovery files, common owners and helper links are present without recovery generation.

## Task 4: Finish generators and required gates economically

**Files:** existing renderers, generated native/plugin/reference artifacts, project gates.
**Consumes:** frozen final source set.
**Produces:** exact gate results and classified remaining failures.

- [ ] Run node --test scripts/canonical-agents-source.test.mjs scripts/canonical-native.test.mjs scripts/codex-contributor.test.mjs when final reconciliation changed those joins; preserve earlier receipts otherwise.
- [ ] Run node scripts/render-harness-config.mjs --check --only codex and the corresponding selected ZCode check; regenerate only owned native outputs when needed.
- [ ] Use existing plugin-skill/twin/hash/index/rule-channel/reference checks. Never weaken clobber guards to accept an intermediate copy.
- [ ] Check node scripts/build-runtime-bundles.mjs --check; write only if imported sources changed.
- [ ] Run required make self-audit with local toolchain/tsx on PATH and legitimate IPC access.
- [ ] The full npm test already ran before handoff. Reuse its valid unchanged receipts; rerun failed/changed workspaces only, unless base reconciliation invalidates broader evidence.
- [ ] Record command, environment and scope. Any required unresolved failure remains a failed gate; no aggregation of partial counts into full PASS.

## Task 5: Freeze implementation and hand off review

**Files:** implementation-report.md, review-target.json, result archive/patch, additive acceptance and original 20+32 ledger.
**Consumes:** final code and receipts.
**Produces:** immutable independent-review input; architecture/behavior/install/package dispositions.

- [ ] Account for S1.1–S1.12 and S2.1–S2.8; include exact native tests still requiring the actual host.
- [ ] Preserve all 20+32 rows and historical evidence. Do not mark complete=true while requirements remain unverified.
- [ ] Commit only the owned intended task result on the isolated AIF branch if the runtime requires it. Verify actual changed files and non-empty relevant diff; status=done is not acceptance.
- [ ] Export result identity, intended path/link/mode hashes, logs and explicit unresolved issues in review-target.json.
- [ ] Return the packet location and exact result identity to the junior dispatcher; it owns the authorized Git delivery/merge. The implementer does not publish or merge independently.
- [ ] Independent reviewer uses the separate review specification/kickoff. Real host delivery is performed only against original/current preimages with sealed hashes and unchanged host index.

## §5 AI-traps active

Apply the existing ai-laziness-traps catalogue: T2 (execute controls), T3 (observed evidence), T4 (all declared sections), T5 (keep review/source ownership separate), T6 (calibrated coverage), T7 (test adverse paths), T10 (complete inventory), T13 (reuse still needs verification), T14 (unverified differs from clean), T15 (self-apply), T16 (match actual problem class).
Domain C1: source-test PASS or discovered entry is not native execution.
Domain C2: AIF cannot read a Mac /tmp path; unavailable packet means input blocked, never restart migration from stale staging.
Domain C3: immutable result identity precedes independent review; mutable source drift invalidates receipt reuse.

## Stop conditions and routing

Environment trouble -> existing /aif-doctor; in-scope mechanics -> existing /dispatcher technical-fork flow.
Protected-file, trust, unrelated publication or design conflicts -> concrete evidence and operator fork; continue independent work. Ordinary task-scoped Git publication is already authorized for the junior coordinator.
Missing packet, ambiguous source ownership or isolated checkout failure -> do not execute against shared/stale base.
Complete implementation with pending desktop behavior -> report implementation ready, native acceptance pending; never claim the operator's full goal complete.

## §1.7 Self-review

All completion requirements map to recovery, narrow repairs, standalone delivery, final gates or frozen/native acceptance handoff.
No new dispatcher, paid transport, authority exception or blanket test exclusion is introduced.
