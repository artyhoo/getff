# Kickoff — Mutation Discipline Umbrella (post-M.4 follow-up)

> **Type:** mixed umbrella — Stage 1 = R-phase audit (no-build), Stages 2-4 = I-phase builds gated on audit findings.
> **Origin:** maintainer dialogue 2026-05-24 close of Meta orchestrator setup session, surfaced discipline-theatre gap: M.4 shipped 6 paired-negative bash hook tests, but bash hooks are NOT mutation-tested in CI (Stryker mutates TS only); tests themselves are NOT mutation-tested either. «Тест есть» ≠ «тест ловит».
> **SSOT:** memory `project_m4_wave_done.md` §5 lessons (gap surfaced); session transcript Meta orchestrator setup 2026-05-24.
> **Deliverable:** by end of umbrella — every load-bearing test in the repo is **mutation-protected** (either via Stryker for TS, or via new bash mutator for `.sh`); discipline-theatre risk closed.
> **Base branch:** `staging` (NOT `main`).

---

## §0 Cold-start context — what's already known

**Pre-existing state (verified 2026-05-24 during M.4 closure):**

Stryker config at `packages/core/stryker.config.mjs` mutates:
- ✅ `eslint-rules/**/*.ts` (minus `.test.ts` + `index.ts`)
- ✅ `hooks/**/*.ts` (minus `.test.ts` + `hooks/pre-push.ts` — explicit exclude as "thin orchestrator")

Second Stryker config at `packages/core/stryker.audit-ai-docs.mjs` covers `packages/core/audit-self/*.ts`.

Stryker explicitly does NOT mutate:
- ❌ Bash hooks (`.claude/hooks/*.sh`) — Stryker does not support bash.
- ❌ Test files themselves (`!hooks/**/*.test.ts` exclude).
- ❌ `hooks/pre-push.ts` (excluded as side-effect-heavy orchestrator).

**M.4 wave (closed 2026-05-24) shipped 6 paired-negative tests** for `.claude/hooks/*.sh` files. Each had manual mutation-sanity single-pass at write-time («сломай хук, тест должен упасть; восстанови — должен пройти»). **No automated mutation testing for bash hooks exists in CI.**

**The honest claim post-M.4:** «нет ни ложно положительных ни ложно отрицательных» = **NOT verifiable** for bash hook tests. We know they passed mutation-sanity at write time; we cannot claim they catch all future regressions automatically.

---

## §1 The goal

Close the discipline-theatre gap by ensuring **every test in the repo provably catches a real bug at CI time**, not just at write time. Specifically:

1. **Know the actual current state** — run Stryker on existing TS scope, get fresh mutation score per file. Drive subsequent decisions by data, not assumption.
2. **Extend mutation testing to bash hooks** — IF audit shows the gap is real and load-bearing (i.e. bash hooks have non-trivial logic worth mutating).
3. **Add tests-of-tests** — IF audit shows TS test files themselves have theatre patterns.
4. **Cover remaining .sh files** — only AFTER (2) so new tests inherit automated mutation protection from day 1.

## §2 Load-bearing constraints (do NOT break)

- **No paid LLM in CI** ([no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md)) — all mutators deterministic.
- **No new heavy dependencies** ([build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md)) — REUSE Stryker for TS; build minimal AST/sed bash mutator only if no upstream exists.
- **Forward-going discipline** — existing test files NOT retroactively rewritten unless audit shows they fail. The 9 bash hook tests in `packages/core/hooks/*.test.ts` are NOT auto-targets for refactor; they're audit subjects.
- **Backward-check** — extending Stryker scope must NOT regress existing test suite execution time beyond ~1.5× current.

## §3 Sub-wave decomposition (Stage gates)

### Stage 1 — A. Mutation audit (R-phase, $0, ~1 hour)

**Goal:** run Stryker on current scope, capture per-file mutation score, identify files <80% kill rate.

**Steps:**
1. `cd packages/core && npx stryker run stryker.config.mjs 2>&1 | tee /tmp/stryker-A.log`
2. `cd packages/core && npx stryker run stryker.audit-ai-docs.mjs 2>&1 | tee /tmp/stryker-audit.log` (audit-self surface)
3. Parse `packages/core/reports/mutation/report.json` — extract per-file kill score.
4. Write findings to `docs/meta-factory/research-patches/<date>-mutation-discipline-audit.md`:
   - §A.1 — Current TS mutation score table (file × kill % × survived mutants count).
   - §A.2 — Files below 80% threshold — list + categorize (real gap vs. mutation-equivalent code).
   - §A.3 — Bash hook surface estimate: count `.sh` files × LOC × branch count → estimate mutation value.
   - §A.4 — Recommendation: which of B / C / D are justified by data, which can be deferred or dropped.

**Stage 1 → Stage 2 gate (REAL):**
```bash
ls docs/meta-factory/research-patches/*-mutation-discipline-audit.md && \
  echo "Stage 1 finding doc exists → Stage 2 admissible"
```

**Stop conditions:**
- All TS files ≥95% kill rate AND bash hooks have <10 non-trivial branches total → STOP umbrella, declare «discipline-theatre risk verified low». Drop B/C/D. Memory codify finding.
- Audit reveals critical TS code with <60% kill → ESCALATE to maintainer; B/C/D postponed; immediate fix-umbrella for the bad-coverage files.

### Stage 2 — B. Bash mutator tool (I-phase, conditional)

**Pre-condition:** A.3/A.4 recommends building (bash surface area justifies the investment).

**Goal:** deterministic AST/sed-based mutator for `.claude/hooks/*.sh` that operates parallel to Stryker but for bash.

**Sub-decomposition:**
- **B.1** — Research prior art: is there a bash mutation tool upstream? Check via DeepWiki + WebSearch. Per [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md), REFERENCE > BUILD.
- **B.2** — If no upstream: design `packages/core/audit-self/bash-mutator.ts`. Mutation operators (start small): negate `if` condition; swap `&&`/`||`; change exit codes 0→1, 1→0; remove `set -e`; flip string comparators `=`/`!=`.
- **B.3** — Wire into `audit-self.yml` workflow as separate job; threshold ~60% kill (lower than TS Stryker because bash is harder to mutate cleanly).
- **B.4** — Run against M.4 test set; verify the 6 M.4 tests catch ≥60% of mutants for their target hook.

**Stage 2 → Stage 3 gate:**
```bash
gh pr list --search "is:merged head:feat/bash-mutator base:staging" \
  --json number --limit 5 | jq 'length >= 1'
```

### Stage 3 — C. Tests-of-tests (I-phase, conditional)

**Pre-condition:** A.4 recommends + B is merged (so we have a mutator to use).

**Goal:** extend `packages/core/principles/02-paired-negative-test.test.ts` from structural ❌+✅ shape check to **content-level** assertions:
- Each test must assert exit code OR `stdout`/`stderr` content (not just `.toBeDefined()`).
- Each test must have a mutation-sanity docstring comment (forced documentation, not automated proof).
- Each test must use the bash mutator output (if a `.sh` target) to register an automated mutation kill rate.

### Stage 4 — D. Cover remaining .sh files (I-phase)

**Pre-condition:** B merged (so new tests inherit mutation protection from day 1).

**Targets** (per session transcript 2026-05-24 inventory):

| Category | Files | Sub-wave count |
|---|---|---|
| A — Skill helpers | 3 files in `.claude/skills/meta-orchestrator/helpers/` (`priority-score.sh`, `plan-currency-check.sh`, `launch-table-generator.sh`) | D.1–D.3 (parallel) |
| B — CI tools | `scripts/check-skill-drift.sh`, `packages/core/hooks/pre-push.fallback.sh` | D.4, D.5 |
| D — Investigate dup | `packages/core/hooks/deps-hash-check.sh` vs `.claude/hooks/deps-hash-check.sh` — symlink? duplicate? race? | D.6 (R-phase, may not need build) |

Use M.4 paired-negative pattern + bash mutator (from B) for automated kill rate.

---

## §4 AI-laziness traps active

See [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md). **Active for this umbrella: T1, T2, T3, T9, T10, T11, T14, T15, T16, T17, T19** + 2 domain-specific traps.

- **T1 (sampling shallow):** Stage 1 audit must run Stryker on FULL TS scope, not «sampled 3 files, looks fine».
- **T2 (methodology theatre):** Stage 1 finding doc must contain ACTUAL Stryker output excerpts + file:line cites — not «would detect».
- **T3 (no prose-only):** every claim in audit findings = command + output OR file:line citation. «Coverage is high» is forbidden; «file X = 87% kill (12/14 mutants killed, 2 surviving on lines Y, Z)» is required.
- **T9 (sampling EASY):** if Stage 1 samples bash hooks, must sample across recent + ancient hooks, not just M.4-fresh ones.
- **T10 (completeness ≠ what you looked at):** Stage 1 must enumerate full population (`ls .claude/hooks/*.sh | wc -l` = 9) before any coverage claim.
- **T11 (prior art):** Stage 2 B.1 mandatory — DeepWiki + WebSearch for «bash mutation testing» before any line of bash-mutator.ts.
- **T14 (clean ≠ no theatre):** if Stryker finds 100% kill rate on a file, distinguish «high mutation coverage» from «code is mutation-resistant by structure (e.g. trivial constants)» — these look identical but mean different things.
- **T15 (self-application):** the bash mutator itself must have its own .test.ts (recursive). Document explicitly.
- **T16 (pattern-matching-on-name):** «we have Stryker» ≠ «we have mutation coverage» — the scope matters; verify file-by-file what Stryker actually mutates.
- **T17 (preserve before delete):** D.6 investigation of duplicate `deps-hash-check.sh` — investigate before delete; one of the copies may have unique upstream-shipping path.
- **T19 (own QA before handoff):** every PR in this umbrella runs the mutator on its own changes before push; CI green ≠ mutation-tested.

**Domain-specific (new — `T-MUT-*`):**

- **T-MUT-A — «manual mutation-sanity ≡ automated mutation testing».** Tempted: claim «M.4 already mutation-tested because sub-agents did manual sanity». Counter: manual sanity = single-pass at write time. Automated = continuous in CI. They are not interchangeable — this umbrella exists because of the gap.
- **T-MUT-B — «high mutation score = bug-free test».** Tempted: assume that if a test kills 95% of mutants, it's good. Counter: mutation testing has known false-positive rate (equivalent mutants); a survived mutant may still be valid code. The `audit findings` must categorize survived mutants by `legitimate-equivalent` vs `real-gap`.

## §5 Recursive self-application

The mutation discipline being established by this umbrella **must apply to itself**:

- The bash mutator built in Stage 2 must have its own paired-negative test (M.4 pattern), and that test must itself be mutation-tested by the bash mutator (recursive bootstrap).
- The principle 02 extension in Stage 3 must pass its own check.
- The audit doc in Stage 1 must cite primary Stryker output, not paraphrase (T3 self-application).

The **dogfood gate:** before declaring umbrella done, the bash mutator must successfully detect a real-but-undocumented bug in at least one of the existing 9 bash hooks. If it doesn't surface anything, either the hooks are perfect (unlikely) or the mutator is not effective enough — re-design.

## §6 §1.7 forward-check (umbrella-level)

This umbrella complies with:
- [no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md) — all mutation tools deterministic (Stryker for TS, AST/sed for bash).
- [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md) — Stage 2 B.1 enforces REFERENCE > BUILD via mandatory prior-art research.
- [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md) — Stage 1 = R-phase before any I-phase build.
- [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md) — Stage 4 D.1–D.6 in worktrees per existing M.4 precedent.
- [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md) — Phase -1 cold-review between Stages mandatory.
- [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) — this kickoff gitignored (`.claude/orchestrator-prompts/`), per-file authority implicit by filename.
- [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) — §4 enumeration + 2 domain traps (T-MUT-A, T-MUT-B).

**Backward-check:** umbrella does NOT supersede M.4 — it COMPLEMENTS it (M.4 shipped tests; this verifies them). No existing artifact silently retired. Scope-additive on `packages/core/audit-self/` + new principle 02 extension + new bash mutator + new test files (Stage 4).

## §7 Stop conditions

- **F1** — Stage 1 audit finds TS Stryker score ≥95% on ALL files AND bash hooks have <10 non-trivial branches → STOP umbrella, declare gap small. Drop B/C/D.
- **F2** — Stage 2 B.1 surfaces a mature upstream bash mutator (REFERENCE candidate) → ADOPT instead of BUILD. Re-scope B.2 accordingly.
- **F3** — Stage 2 B.4 fails dogfood (mutator detects 0 bugs in existing hooks) → ESCALATE; either mutator is weak (re-design operators) or hooks are perfect (unlikely; investigate by injecting known bug).
- **F4** — Stage 3 principle 02 extension causes false-positive cascade on existing tests → revert, narrow scope, retry.
- **F5** — Stage 4 sub-wave commits ≥80 LOC in a single PR → split per `dual-implementation-discipline.md §9` single-concern principle.

## §8 Done =

Umbrella complete when:

1. ✅ Mutation audit research-patch shipped to `docs/meta-factory/research-patches/<date>-mutation-discipline-audit.md` with full per-file Stryker scores.
2. ✅ Decision recorded (in audit doc + memory): B/C/D each = GO / DEFER / DROP with rationale.
3. ✅ If B was GO: bash mutator landed in `staging` with its own paired-negative test passing.
4. ✅ If C was GO: principle 02 extended; existing tests adapted (if necessary) without false-positive churn.
5. ✅ If D was GO: remaining .sh files covered with tests + mutation-protected by B's mutator.
6. ✅ All sub-wave PRs cold-reviewed (Phase -1).
7. ✅ Memory entry `project_mutation_discipline_umbrella_done.md` codifies findings + lessons.

## §9 See also

- `wave-sequencing-plan.md` — for Track M context (this umbrella is post-M.4 followup, parallel to M.5/M.6).
- `project_m4_wave_done.md` — memory; M.4 closure + 5 lessons (gap surfacing source).
- `project_stryker_mutation_hardening_done.md` — memory; prior Stryker SDD waves (4 hardening rounds).
- `packages/core/stryker.config.mjs` — primary Stryker config (TS scope authoritative).
- `packages/core/stryker.audit-ai-docs.mjs` — secondary Stryker config (audit-self scope).
- M.4 umbrella kickoff at `.claude/orchestrator-prompts/m4-bash-hook-tests/kickoff.md` — paired-negative test pattern reference.
- M.4 meta-launch kickoff at `.claude/orchestrator-prompts/m4-bash-hook-tests-meta-launch/kickoff.md` — Mode B × N worktrees dispatch pattern.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
