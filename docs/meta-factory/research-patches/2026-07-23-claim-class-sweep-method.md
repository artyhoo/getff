<!-- scope:claim-class-sweep-method -->

# Claim-class sweep: keyword grep cannot close a proposition — use the cold enumerator


> **Scope:** one gap — the sweep method used to remove a falsified claim. Folder
> authority: [research-patches/](./) is scope-bound by gap per
> [doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md).

**Problem** — while removing a measurement-falsified claim («the branch-protection
registration is asserted/enforced») from PR #1102's artifacts, the author swept by
grepping for the phrasings already known to be bad. Seven instances survived across four
fix rounds: each restated the same *proposition* in new words («assertion is red» →
«kicks in automatically» → «asserts» → «keeps that precondition a mechanism» → a consumer
`RULES.md` billing-plan explanation). Every instance was found by a cold auditor, never
by the author's own sweep.

**Root Cause** — §1 items 2/4 failure at claim-removal time: a string search can only
find repeats of what was already found; the population of surfaces (including docs the
artifact CITES as its policy source, e.g. `workflow-integrity.yml:3-4` →
`packages/preset-next-15-canonical/RULES.md`) was never enumerated. This is
`#backward-check-restates-not-sweeps` (T21) applied to claim-removal: sweeping by known
phrasings IS restating what you already found. Aggravating: the purpose-built cold
enumerator [`agents/backward-sweep-auditor.md`](../../agents/backward-sweep-auditor.md)
existed the whole time and was never dispatched.

**Solution** — the seven instances were closed (final commits `589eb1366`, `7e19fffd3`,
PR #1102); the method lesson is recorded in the acceptance-contour spec §7 and here.

**Prevention** — PRIORITY CHECK: when removing a claim that measurement falsified,
do NOT grep for its wordings. Instead (1) dispatch
[`agents/backward-sweep-auditor.md`](../../agents/backward-sweep-auditor.md) with the
*proposition* («X claims the protection check is enforced/self-activating») — it
enumerates surfaces cold, including cited policy docs and consumer-shipped copies;
(2) read each enumerated file end-to-end, checking every sentence that predicates an
effect against the measurement. Population first, phrasing never.

**Tags** — `#backward-check-restates-not-sweeps` `#discipline-application-scope-blindness`
`#claim-from-memory-not-source` (T21 incident counter +1: this is a second documented
occurrence-class instance after PR #857).

## §1.7 Forward-check applied

Complies with [no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md): the prescribed mechanism is `agents/backward-sweep-auditor.md`, a session-read cold agent — zero API-billed calls, no CI gate added. Complies with [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md): verdict **REUSE** — the enumerator this patch prescribes already ships (`agents/backward-sweep-auditor.md:1-4`); no new capability, no new dependency, the entire fix is a usage rule. Complies with [rule-enforcement-channel-selection.md §1](../../../.claude/rules/rule-enforcement-channel-selection.md): completeness-of-enumeration is a semantic judgment, so the channel is prose + cold agent, never a gate ([ai-laziness-traps.md §5 T21](../../../.claude/rules/ai-laziness-traps.md) states the same ceiling explicitly). Complies with [doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md): folder-level authority, `<!-- scope: -->` marker present, no per-file header required.

## §1.7 Backward-check applied

Class of this change = **incident records that raise the T21 `#backward-check-restates-not-sweeps` counter and prescribe the cold enumerator**. Surfaces where that class occurs, enumerated (`grep -rln "backward-sweep-auditor\|T21" .claude/rules/ docs/meta-factory/research-patches/ agents/`): (1) [`.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md) §2 T21 + §5 promotion trigger — **SWEPT: consistent, not superseded**; T21's counter reads 1/3 (PR #857) and this patch is the second instance of the class, so the counter moves to 2/3 — the promotion threshold (3 incidents, semantic test with MANUAL classification) is NOT yet reached and this patch does not claim it is. (2) [`.claude/rules/phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md) authoring format — **SWEPT-CLEAN**: this patch's own backward-check uses that enumeration format, and the rule already names the cold agent as the delegation target; nothing to change. (3) [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md) — **SWEPT-CLEAN**: its dispatch contract already accepts a change *class*; a proposition is a class, so no edit is needed — the gap was non-use, not capability. (4) [`docs/superpowers/specs/2026-07-23-acceptance-contour-design.md`](../../superpowers/specs/2026-07-23-acceptance-contour-design.md) §7 method-finding — **SWEPT: extended, not duplicated**; that entry records the same incident from the spec's side and now points at the same prescription. No artefact is superseded by this patch; it adds one incident record and one usage rule.
