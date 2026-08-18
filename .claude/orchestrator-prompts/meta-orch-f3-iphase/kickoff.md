# Umbrella: `meta-orch-f3-iphase` — I-phase implementation of F.3 helper-collapse + DN-1..DN-4 final answers

> **Type:** I-phase implementation (single sub-wave, Mode A inline).
> **Authoritative for:** SKILL.md edits implementing F.3 (state-file-driven helpers), new helpers `dispatch-from-state.sh` + `delta-write-from-state.sh`, removal of §3 inline `!shell` block, `allowed-tools` narrow-glob + settings.json fallback, paired-negative tests for new helpers.
> **NOT authoritative for:** F.6 (`$umbrella` named-arg substitution) — DN-4 final = deferred entirely; revisit ONLY if after F.3 ships the main no-arg functionality remains broken. R-phase verdicts — see PRs #261 + #262 (research-patches).

**Origin:** 2026-05-28 — completes the implementation arc started by PR #261 R-phase (verdict F.3) + PR #262 research-patch (DN-1..DN-4 best-practices-backed answers).

Depends on: PR 262 merged to staging — provides Issue #14956 verbatim + I-phase Stage 0 probe mandate as repo-authoritative DN-1 context. **DO NOT START** this umbrella before PR 262 merged.

---

## §0 Binding DN context (sourced from PR #261 + PR #262)

| DN | Final answer | Source |
|---|---|---|
| **DN-1** | **Option C — narrow glob `Bash(bash ${CLAUDE_SKILL_DIR}/helpers/*.sh *)` in SKILL.md frontmatter + `Bash(bash *helpers/*.sh *)` in `~/.claude/settings.json` `permissions.allow` as Issue #14956 fallback** | PR #262 §3 DN-1 verdict |
| **DN-2** | **B — new sibling helper `delta-write-from-state.sh`** for delta arrays writing; existing `update-delta.sh` UNCHANGED (preserves paired-negative test contract) | PR #261 + maintainer 2026-05-27 dialogue |
| **DN-3** | **A — REMOVE §3 inline `!shell` block from SKILL.md.** I-phase commit message body MUST include the removed block content verbatim under heading `### Removed §3 inline !shell block (was at SKILL.md:NNN-MMM)` — preserves «what + why deleted» across squash-merge. | PR #261 + maintainer 2026-05-27 dialogue |
| **DN-4** | **Defer F.6 entirely.** No `$umbrella` named-arg substitution. F.3 helpers + state-file substrate fix main no-arg functionality without F.6. | PR #262 §4 DN-4 verdict |

---

## §1 Stage decomposition

### Stage 0 — Runtime probe of DN-1 Option C glob (MANDATORY first task)

Per PR #262 §1.5a verdict `PROVISIONAL-SYNTAX-EXTRAPOLATED — probe-deferred-to-I-phase-Stage-0`:

1. Create synthetic skill `tmp-glob-probe/SKILL.md` with frontmatter:
   ```yaml
   ---
   name: glob-probe
   description: One-off probe — DO NOT SHIP. Verifies `allowed-tools` glob support for DN-1 Option C.
   allowed-tools: Bash(bash tmp-glob-probe/helpers/*.sh *)
   ---
   ```
2. Create `tmp-glob-probe/helpers/ok.sh` (`#!/bin/bash\necho OK`).
3. Invoke skill via `/glob-probe` slash-command. Capture verbatim:
   - Does CC auto-approve `bash tmp-glob-probe/helpers/ok.sh arg1`? (expected: yes if Option C works)
   - Does CC prompt for `bash -c "rm -rf foo"`? (expected: yes — pattern doesn't match glob)
   - Capture both classifier outputs as evidence.
4. Record observation in commit message body under `### Stage 0 probe output` heading.

**Decision branch:**
- **Probe passes** (auto-approve helper, prompt on `bash -c`) → proceed to Stage 1 with Option C as-planned.
- **Probe fails** (prompt on helper too) → STOP, surface to maintainer. Fall back option: Option A `Bash(bash *)` + global `Bash(bash -c *)` deny (verified zero legitimate `bash -c` usage in repo per PR #261 dialogue 2026-05-27).
- **Issue #14956 still bites in current CC version** → settings.json fallback becomes load-bearing; document in SKILL.md header.

**Cleanup:** delete `tmp-glob-probe/` before any commit (verify `git status --short` shows zero traces).

### Stage 1 — F.3 helper implementation

Implement two new helpers + adjust `allowed-tools`:

#### Stage 1a — `dispatch-from-state.sh` (DN-1 + F.3)

New file `.claude/skills/meta-orchestrator/helpers/dispatch-from-state.sh`:
- Reads winner-id + sub-wave state from `.claude/orchestrator-prompts/_meta-orch-state.json` (or extends `_master-backlog-delta.json` per DN-2 below).
- Emits §3 launch-table + §4 meta-kickoff content (collapses §3+§4 inline blocks).
- Carries `@dual-pair:` and `@cc-only-rationale:` markers per `dual-implementation-discipline.md §6`.
- Class C header (Authoritative-for / NOT authoritative-for per `doc-authority-hierarchy.md §3`).

#### Stage 1b — `delta-write-from-state.sh` (DN-2 B sibling helper)

New file `.claude/skills/meta-orchestrator/helpers/delta-write-from-state.sh`:
- Reads `current_ids` + `resolved_ids` arrays from state-file (per F.3 architecture).
- Runs `jq` INSIDE the helper (not inline) to update `_master-backlog-delta.json` arrays.
- Existing `update-delta.sh` UNTOUCHED — preserves paired-negative test contract (Class A test `packages/core/hooks/update-delta.test.ts`).
- Class C header.

#### Stage 1c — SKILL.md edits

- Add to `allowed-tools` frontmatter: `Bash(bash ${CLAUDE_SKILL_DIR}/helpers/*.sh *)` (Option C narrow glob per DN-1).
- Replace §3 launch-table inline `!shell` block with single-helper invocation: `${CLAUDE_SKILL_DIR}/helpers/dispatch-from-state.sh` (DN-3 A — REMOVE; commit body has verbatim removed block).
- Replace §10 step 5b inline `jq` block + array-write with `${CLAUDE_SKILL_DIR}/helpers/delta-write-from-state.sh` (DN-2 B — sibling helper).
- Update §3 sub-section prose to reflect helper-driven flow.

#### Stage 1d — settings.json fallback (Issue #14956)

- Add to `.claude/settings.json` `permissions.allow`: `Bash(bash *helpers/*.sh *)` (skill-agnostic fallback path).
- Document in PR body: «Fallback because of Issue #14956 — remove this line if/when issue closes.»

### Stage 2 — Tests + verification

#### Stage 2a — Paired-negative tests

Per principle 02 — every new helper has BOTH a positive (does what it claims) and a negative (fails on misuse) test:

- `packages/core/hooks/dispatch-from-state.test.ts` (new) — positive: reads state, emits launch-table; negative: empty state → error message.
- `packages/core/hooks/delta-write-from-state.test.ts` (new) — positive: writes both arrays; negative: malformed state → no-op + error.

#### Stage 2b — Existing test preservation

- `packages/core/hooks/update-delta.test.ts` MUST still pass UNCHANGED (DN-2 contract — sibling helper preserves existing test).
- `packages/core/principles/12-ai-laziness-traps.test.ts` MUST pass (DN-3 removed §3 verified mechanically — patch may assume §3 presence; verify before Stage 1c commit).

### Stage 3 — Update references

- Update `RULES.md` if any new rule emerged (no — DN answers don't introduce new rules; only mechanism changes).
- Update `dual-implementation-discipline.md §9` running counter if new dual-channel artefact landed.
- Update `wave-sequencing-plan.md §0` row reflecting umbrella closure (single-line update).

---

## §2 §3 verbatim-в-commit-body discipline (DN-3 mandate)

When Stage 1c commits the §3 inline `!shell` block removal, the commit message body MUST include:

```text
### Removed §3 inline !shell block (was at SKILL.md:NNN-MMM)

```bash
<verbatim removed block content here — read from staging HEAD before edit>
```

Reason: superseded by `${CLAUDE_SKILL_DIR}/helpers/dispatch-from-state.sh` per F.3
helper-collapse verdict (PR #261). The inline block was classifier-incompatible
under no-arg mode (`${umbrella:-}` substituted before §2 picks winner, so §3 always
emitted "MISSING kickoff" in arg-mode and contributed nothing in no-arg mode).
Helper reads winner-id from state-file populated by §2.
```

Squash-merge collapses the diff but PRESERVES the commit message body. Future `git log --grep="Removed §3 inline"` finds this entry.

---

## §3 Out of scope

- **NOT in this umbrella:** F.6 (`$umbrella` named-arg substitution). DN-4 final = defer. Open separate umbrella ONLY if F.3 ships AND no-arg functionality remains broken.
- **NOT in this umbrella:** new SSOT entries (DN context already established in PR #261/#262).
- **NOT in this umbrella:** wave-sequencing-plan.md §5 narrative rewrite. Only §0 row update for closure.
- **NOT in this umbrella:** ship-vs-gate discipline rule draft (kickoff §5 optional output from PR #262 — Worker chose not to ship; that's a separate future decision).

---

## §4 AI-traps active (per [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md))

Canonical T-numbers:

- **T3** — file:line evidence for every Stage 0 probe observation + every §1.7 PR-body claim.
- **T7** — adversarial counter-prompt at each stage: «did I introduce drift between SKILL.md and helper behavior?», «did I break existing paired-negative test by side-effect?»
- **T15** — self-application: does the I-phase commit itself follow the verbatim-в-commit-body discipline it codifies (DN-3 §2 above)?
- **T17 (preserve before destructive delegation)** — DN-3 mandates removal of §3 block; verbatim-в-commit-body IS the preservation mechanism. Per memory `preserve_before_destructive_delegation`.
- **T19** — own cold-QA on the diff BEFORE `gh pr create`. CI ≠ design review.
- **T20** — no inline verdicts without evidence-bearing tool call same turn (during PR body authoring + Stage 0 probe).

Domain-specific (this I-phase, NOT in canonical catalogue):

- **T-IF1 — Stage 0 probe theatre.** AI tempted to skip Stage 0 and proceed straight to Stage 1c (SKILL.md `allowed-tools` edit) because «PR #262 verdict says Option C». **Counter:** PR #262 §1.5a EXPLICITLY downgraded the verdict to `PROVISIONAL-SYNTAX-EXTRAPOLATED — probe-deferred-to-I-phase-Stage-0`. Stage 0 is mandatory; skipping it = `#discipline-theatre`.
- **T-IF2 — Issue #14956 false-resolved assumption.** AI tempted to check Issue #14956 and if it's been resolved, skip the settings.json fallback. **Counter:** OK to skip fallback ONLY IF probe verifies Option C works without fallback in current CC version. Verify probe AND issue status before dropping fallback.
- **T-IF3 — Verbatim-в-commit-body shortcut.** AI tempted to write «removed §3 inline block — see PR diff» instead of including the verbatim block. **Counter:** DN-3 mandate is explicit per §2 — squash-merge collapses the diff but PRESERVES commit body. The discipline IS the preservation; shortcut defeats it.

---

## §5 §4b §1.7 PR-body mandate

Per [`meta-launch kickoff §4b`](../meta-orch-no-arg-laziness-meta-launch/kickoff.md), §1.7 fires because:
- `.claude/skills/meta-orchestrator/SKILL.md` is touched (path-triggered)
- `.claude/settings.json` is touched (consumer-shipping path, indirectly)
- Possibly `packages/core/principles/12-ai-laziness-traps.test.ts` (Stage 2b verify pass)

Required PR body sections (verbatim shape per discipline gate):

```markdown
### §1.7 Forward-check applied

<≥40 non-whitespace chars>

- `dual-implementation-discipline.md §3` — Internal=CC-native default verified for new helpers + `@dual-pair`/`@cc-only-rationale` markers added. file:line: `.claude/skills/meta-orchestrator/helpers/dispatch-from-state.sh:NNN`
- `phase-research-coverage.md §1.11` — verified against source-of-truth before claim: probe output captured + Issue #14956 re-verified `gh api`. file:line: `<commit-body>:NNN`
- `build-first-reuse-default.md §1` — BFR posture stated: ADAPT (extends existing helper family); no upstream addresses cross-block CC-skill state with classifier-as-constraint shape (per PR #261 §1.4). file:line: `<PR body>:NNN`
- `no-paid-llm-in-ci.md` — VERIFIED OK; helpers are bash + jq, zero API-billed calls.

### §1.7 Backward-check applied

<≥40 non-whitespace chars>

- `SKILL.md §3 launch-table inline block` — REMOVED per DN-3; verbatim content preserved in commit body. file:line: `<commit-body>:NNN`
- `SKILL.md §10 step 5b delta-write inline block` — REPLACED with helper call per DN-2 B. file:line: `.claude/skills/meta-orchestrator/SKILL.md:NNN`
- `update-delta.sh` + `update-delta.test.ts` — UNCHANGED; existing test contract preserved per DN-2 (paired-negative test discipline). file:line: `packages/core/hooks/update-delta.test.ts:NNN`
- `principle 12 `12-ai-laziness-traps.test.ts` — verified passes after §3 removal (Stage 2b). file:line: `packages/core/principles/12-ai-laziness-traps.test.ts:NNN`
```

Pre-flight grep per meta-launch §4b BEFORE `gh pr create`.

---

## §6 Stop conditions

- Stage 0 probe FAILS → STOP, surface to maintainer with fallback option A+global-deny.
- Stage 0 cleanup leaves `tmp-glob-probe/` traces in `git status` → STOP, clean before proceeding.
- principle 12 test breaks after §3 removal → STOP, restore §3 with «DEPRECATED — TODO remove» comment, surface as MAJOR finding.
- §1.7 pre-flight grep fails → STOP, fix PR body before pushing.
- Any temptation to ship F.6 → STOP, DN-4 final = defer.

---

## §7 See also

- [PR #261](https://github.com/Yhooi2/rules-as-tests-aif/pull/261) — R-phase verdict F.3 primary
- [PR #262](https://github.com/Yhooi2/rules-as-tests-aif/pull/262) — DN-1..DN-4 best-practices-backed answers + §1.5a deferral mandate
- [`meta-orch-no-arg-laziness/kickoff.md`](../meta-orch-no-arg-laziness/kickoff.md) — original R-phase umbrella
- [`dn-decisions-best-practices-research/kickoff.md`](../dn-decisions-best-practices-research/kickoff.md) — research umbrella
- [`meta-orch-no-arg-laziness-meta-launch/state.md`](../meta-orch-no-arg-laziness-meta-launch/state.md) — dispatch state log + final DN dispositions
- [`dual-implementation-discipline.md`](../../../.claude/rules/dual-implementation-discipline.md) — markers + Class triage
- [`doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md) — Class + header spec
- [Issue #14956](https://github.com/anthropics/claude-code/issues/14956) — known CC bug requiring settings.json fallback
