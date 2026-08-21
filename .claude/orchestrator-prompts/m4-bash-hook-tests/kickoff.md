# Kickoff — Track M.4: tests for 6 untested bash hooks

> **Type:** I-phase build (writing tests for existing production hooks; no production-code change).
> **Origin:** [wave-sequencing-plan.md §2 Track M.4](../../../docs/meta-factory/wave-sequencing-plan.md) + [§5.4 channel-audit + mutation-hardening decision record](../../../docs/meta-factory/wave-sequencing-plan.md) («highest-yield gap» — exact analog of Wave 3 `git.ts` 0-tests pattern, surfaced post-PR #183).
> **Deliverable:** 6 paired-negative test files under `packages/core/hooks/`, one per untested hook, each a single-concern PR into `staging`.
> **Base branch:** `staging` (NOT `main` — main is prod, manual promote only).
> **Authoritative content sources (read first):** [dual-implementation-discipline.md §6](../../../.claude/rules/dual-implementation-discipline.md) · existing test precedents [`check-hook-marker.test.ts`](../../../packages/core/hooks/check-hook-marker.test.ts), [`check-kickoff-traps.test.ts`](../../../packages/core/hooks/check-kickoff-traps.test.ts), [`inject-matching-rule.test.ts`](../../../packages/core/hooks/inject-matching-rule.test.ts) (the 3 already-tested hooks; copy their fixture-spawn pattern) · [paired-negative principle 02](../../../packages/core/principles/02-paired-negative-test.test.ts).

---

## §0 Context — where this sits

Post-PR-#183 audit on `origin/staging` (recorded 2026-05-23 in plan §5.4) — **9 bash hooks** under `.claude/hooks/`, only **3 with dedicated test files**. The 6 untested hooks include **`check-doc-authority.sh` — the project's flagship edit-time gate per the README invariant** (every rule fails at the earliest reachable channel). Same latent-theatre pattern as Wave 3 `git.ts` (load-bearing utility under all pre-push checks, 0 tests until Wave 3 created `git.test.ts`).

Track M sequencing (per plan §2): **M.4 unblocks M.5a** (top-3 edit-time hooks) → **M.5b** (17 pre-commit hooks). Test-first discipline (principle 02 paired-negative) requires the hook's test to exist before new hooks ship. M.4 is therefore a hard dependency for the edit-time rollout downstream.

## §1 The goal (what to build)

For each of the 6 untested hooks, add a vitest test file at `packages/core/hooks/<hook-name>.test.ts` with **paired-negative shape** (per principle 02):

- ❌ at least one scenario where the hook MUST fire / produce its diagnostic / exit non-zero;
- ✅ at least one scenario where the hook MUST stay silent / exit 0 (off-path skip or expected pass);
- ✅ boundary / edge-case scenarios that disambiguate accidental loose matching (false-positive guards).

**The 6 hooks** (in suggested priority order — `check-doc-authority` highest because of README-invariant flagship status):

| # | Hook | Path | Channel | Paired-negative shape (sketch) |
|---|---|---|---|---|
| 1 | **check-doc-authority** | `.claude/hooks/check-doc-authority.sh` | PostToolUse `Edit\|Write`, exit-1 gate (per [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md)) | ❌ edited file in `REQUIRED_HEADER_DOCS` without `Authoritative for:` header → exit 1 · ✅ same file WITH header → exit 0 · ✅ non-required file edited → off-path skip |
| 2 | **deps-hash-check** | `.claude/hooks/deps-hash-check.sh` | PostToolUse on `package.json` / lockfile | ❌ deps hash mismatch / dep drift → diagnostic emitted · ✅ clean state → silent · ✅ unrelated edit → off-path |
| 3 | **inject-session-bootstrap** | `.claude/hooks/inject-session-bootstrap.sh` | UserPromptSubmit, JSON `additionalContext` injection | ❌ missing bootstrap doc → diagnostic / fail-loud · ✅ doc present → inject `additionalContext` per CC hooks contract · ✅ idempotent on repeat invocation in same session |
| 4 | **validate-prompt** | `.claude/hooks/validate-prompt.sh` | UserPromptSubmit (validation channel) | ❌ malformed prompt-pattern → diagnostic · ✅ valid prompt → pass-through |
| 5 | **end-of-turn-reminder** | `.claude/hooks/end-of-turn-reminder.sh` | Stop hook (`reason` → MODEL, `systemMessage` → USER per memory `project_eot_hook_redesign_approved`) | ❌ skip-condition not met but reminder skipped → fail · ✅ skip-condition met → exit 0 (silent) · boundary: AskUserQuestion path (per `project_ask_question_reminder_hook`) |
| 6 | **ask-question-reminder** | `.claude/hooks/ask-question-reminder.sh` | PreToolUse `AskUserQuestion` deny+`permissionDecisionReason` (45s loop-guard) | ❌ AUQ called without prior fork-challenge → deny + reason · ✅ AUQ within loop-guard window → allow · ✅ non-AUQ tool → off-path |

**Test pattern (REUSE, do not reinvent):** copy the fixture-spawn shape from `packages/core/hooks/check-hook-marker.test.ts` (verified during this kickoff authoring — uses `vitest` + `spawnSync` of the real hook with fixture stdin + `mkdtempSync` for on-disk fixtures + graceful `jq`-availability skip). Same pattern works for all 6 hooks; what differs per hook is the fixture content + the assertion on exit code / stdout.

## §2 The load-bearing constraint (do NOT break)

**Test-only change.** No production code under `.claude/hooks/*.sh` is modified by M.4 itself. If a hook is found to have a bug while writing its test:
- **Stop, surface as observation in the PR body** ([CLAUDE.md PR strategy](../../../CLAUDE.md) — no drive-by scope expansion);
- Leave the test in **expected-to-fail (`.failing()`)** or skipped with a TODO citing the observation, OR write a passing test that captures current (buggy) behaviour and surface the bug separately;
- Maintainer decides whether to dispatch a separate fix-umbrella.

This matches [ai-laziness-traps.md T5](../../../.claude/rules/ai-laziness-traps.md) (no implementation bundled into research; here: no fix bundled into test-add).

## §3 Channel decision — no fork

All 6 are **adding tests** to an existing test runner (`packages/core/hooks/*.test.ts` per [vitest config](../../../vitest.config.ts)). Channel = principle test (vitest) + CI `audit-self.yml` execution. No new edit-time / pre-push / pre-commit channel introduced by M.4 — only the leaf-level paired-negative test files.

This is **REFERENCE** in the build-vs-reuse sense (the test pattern is already in repo across 3 precedent hooks per §1; ADAPT only the fixtures per hook). No SSOT row needed. No `Prior-art:` trailer beyond «no new capability» escape-hatch per [CLAUDE.md](../../../CLAUDE.md):

```text
Prior-art: skipped — test additions for existing capability (the 3 already-tested hooks are the precedent; no new capability commit).
```

## §4 Sub-wave decomposition (launch-table input)

6 sub-waves, **all Stage 1, all parallel-safe** (different test files, no shared state). Mode B × 6 worktrees per [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md) — the SSOT #65 `using-git-worktrees` upstream is the preventive mechanism (verified shipped, detects nested via `GIT_DIR != GIT_COMMON_DIR`).

| Sub-wave | Hook | Branch | Worktree | Volume |
|---|---|---|---|---|
| M.4.1 | check-doc-authority | `test/m4-check-doc-authority` | `../rules-as-tests-aif-m4-1` | M (~100–200 LOC test) |
| M.4.2 | deps-hash-check | `test/m4-deps-hash-check` | `../rules-as-tests-aif-m4-2` | M |
| M.4.3 | inject-session-bootstrap | `test/m4-inject-session-bootstrap` | `../rules-as-tests-aif-m4-3` | M |
| M.4.4 | validate-prompt | `test/m4-validate-prompt` | `../rules-as-tests-aif-m4-4` | M |
| M.4.5 | end-of-turn-reminder | `test/m4-end-of-turn-reminder` | `../rules-as-tests-aif-m4-5` | M |
| M.4.6 | ask-question-reminder | `test/m4-ask-question-reminder` | `../rules-as-tests-aif-m4-6` | M |

**SDD?=No per sub-wave:** each sub-wave is single-concern (one test file, one paired-negative shape) — under the «3+ independent tasks» threshold from meta-orchestrator SKILL.md §3. Spec is this kickoff; implementer is the worker; cold-review is the maintainer's own QA per memory `feedback_own_qa_before_handoff`.

## §5 Build steps (per sub-wave — mirror Wave 3 git.test.ts + check-hook-marker.test.ts)

For each hook H in `{check-doc-authority, deps-hash-check, inject-session-bootstrap, validate-prompt, end-of-turn-reminder, ask-question-reminder}`:

1. **`git worktree add ../rules-as-tests-aif-m4-<N> staging`** (per [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md)); `cd` into it; **symlink `node_modules`** from main worktree (tsx hooks fail otherwise per memory `feedback_worktrees_for_parallel_subwaves`).
2. **`git checkout -b test/m4-<H>`** branching FROM staging.
3. **Read the hook source** `.claude/hooks/<H>.sh` carefully — identify its trigger condition + exit contract + stdout shape (per [Stop hook contract](../../../README.md) for #5/#6 specifically: `reason` → model, `systemMessage` → user).
4. **Write `packages/core/hooks/<H>.test.ts`** using the `check-hook-marker.test.ts` template — adapt fixtures + assertions per the row in §1 above.
5. **Run `pnpm test packages/core/hooks/<H>.test.ts`** — green required.
6. **Run `pnpm test:principles`** + **`pnpm test`** full suite — no regression.
7. **Verify** the test FAILS when the production hook is intentionally broken (mutation-test sanity per [principle 11 build-first-reuse-default](../../../packages/core/principles/11-build-first-reuse-default.test.ts) + Stryker precedent PR #183). Restore hook before commit.
8. **Commit** with trailer `Prior-art: skipped — test additions for existing capability (see kickoff §3).`
9. **Push** to remote; **`gh pr create --base staging`** with §1.7 Forward/Backward-check H3 headers (per memory `feedback_pr_s17_authoring_checklist` — 4-arm checklist).
10. **Auto-merge on green CI** (staging policy per memory `project_automerge_staging_plan`).
11. **`git worktree remove ../rules-as-tests-aif-m4-<N>`** after merge.

## §6 Scope boundaries (do NOT do)

- Do **NOT** modify production code under `.claude/hooks/*.sh` (§2 above — surface bugs, don't bundle fixes).
- Do **NOT** rename / reorganise existing test files (`check-hook-marker.test.ts` et al.) — they are the precedent, leave intact.
- Do **NOT** introduce new test-framework dependencies (vitest is already wired; add a dep → triggers `Prior-art:` trailer per CLAUDE.md «capability commit»).
- Do **NOT** batch multiple hooks into one PR (single-concern PR discipline; 6 sub-PRs not 1). Atomic-umbrella per [CLAUDE.md PR strategy](../../../CLAUDE.md).
- Do **NOT** add markers (`@dual-pair` / `@cc-only-rationale`) to the legacy hooks in this PR — the dual-implementation-discipline §9 forward-going convention is maintainer-batched (separate item, not M.4).

## §7 AI-laziness traps active

See [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md). **Active canonical traps for M.4: T3, T5, T11, T13, T15, T19.**

- **T3** (no prose-only findings): each test must have file:line citation against the hook source explaining what behaviour the assertion captures — not «test added for X».
- **T5** (no implementation bundled into research / scope-expansion): hook bug found mid-test → surface, don't fix in M.4 PR.
- **T11** (prior-art before building): the test pattern is **REFERENCE** of `check-hook-marker.test.ts` — cite it in the new test's leading docstring, don't reinvent fixture-spawn shape.
- **T13** (ADOPTED items aren't zero-work): vitest is adopted, but the per-hook fixture is still our job; do not assume «vitest will figure it out» — write explicit assertions on exit code AND stdout / stderr shape AND non-effect on unrelated files.
- **T15** (self-application): the new test file does NOT need its own test (tests are the leaf — meta-testing tests would be infinite regress). Note this explicitly in the PR body to pre-empt T15 confusion.
- **T19** (own cold-QA before handoff): each sub-wave runs its own `pnpm test` + manual mutation-sanity step (§5 step 7) BEFORE pushing — CI green is necessary but not sufficient.

**Domain-specific traps (M.4-specific, NOT in canonical catalogue):**

- **T-M4-A — «bash hook = test the bash directly».** Tempted: write a `.bats` test or invoke `bash hook.sh < fixture` via shell. Counter: the existing 3-hook precedent uses **TS + `spawnSync`** (`check-hook-marker.test.ts:25-30`) — keep one test framework; `bats` would split the harness and force CI to install bats. ADOPT the existing pattern, do not pattern-match-on-name («it's a bash hook → use bash testing tool»; T16 trap shape).
- **T-M4-B — «just test that hook exits 0 / 1».** Tempted: minimal assert on exit code only. Counter: hooks have *both* exit code AND `stdout`/`stderr` semantics (per Stop hook contract: `reason` field → model, `systemMessage` → user; per PostToolUse: JSON `additionalContext`). A test that asserts only exit code misses the channel-injection regressions that broke EOT contract twice (memory `project_eot_hook_redesign_approved` — false-confirm incidents). Assert exit code AND payload shape.
- **T-M4-C — «6 hooks → write 6 identical tests in 6 hours».** Tempted: copy-paste the same skeleton 6 times without thinking. Counter: each hook has a *different* trigger contract (PostToolUse vs UserPromptSubmit vs Stop vs PreToolUse). Read the hook source for each (§5 step 3) before writing the test. T16 «pattern-matching-on-name» variant.

> **Anti-pattern warning:** blanket «see ai-laziness-traps.md» without T-enumeration = T7 violation. The above enumeration + 3 domain-specific traps satisfies principle 12 ([12-ai-laziness-traps.test.ts](../../../packages/core/principles/12-ai-laziness-traps.test.ts)) — kickoff authors MUST enumerate AND add ≥1 domain-specific trap.

## §8 Working-directory / isolation warning

Per [parallel-subwave-isolation.md](../../../.claude/rules/parallel-subwave-isolation.md) and the C2-2026-05-12 incident (parallel session contaminated branch): **each sub-wave MUST run in its own `git worktree`** (§5 step 1). Verify `git branch --show-current` + `git log origin/staging..HEAD` immediately before every `git commit` and `git push` (per memory `feedback_orchestrator_verify_state_before_claim` (a) long iterative cycles arm).

If `git worktree add` fails (filesystem constraints) → **sequential fallback** per parallel-subwave-isolation.md §2 (one sub-wave at a time in shared worktree, full PR cycle each before the next). NEVER concurrent shared-dir per `#shared-workdir-parallel` anti-pattern.

## §9 §1.7 Forward-check (kickoff-level)

This kickoff complies with:
- [no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md) — all tests are deterministic vitest + spawnSync; zero API-billed calls.
- [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md) — verdict = **REFERENCE** the existing 3-hook test pattern (`check-hook-marker.test.ts` precedent); no new capability, no new dep. Falsified if: pattern proves inadequate for hook #X (e.g. `inject-session-bootstrap` requires a different stdin contract) — then SCOPE-CHECK that one sub-wave, surface, don't generalize.
- [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md) — Mode B × 6 worktrees per §4.
- [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) — kickoff is gitignored (`.claude/orchestrator-prompts/`), per-file authority implicit.
- [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) — §7 above enumerates active T-numbers AND adds 3 domain-specific traps T-M4-A/B/C.
- [principle 02 paired-negative](../../../packages/core/principles/02-paired-negative-test.test.ts) — each new test file must have ≥1 ❌-shape AND ≥1 ✅-shape assertion (§1 sketches all 6 explicitly).

**Backward-check:** scope-additive (6 new test files; zero file deletion; zero production change). No existing artefact silently superseded. The kickoff itself adds to `.claude/orchestrator-prompts/m4-bash-hook-tests/` (gitignored — no shipped surface).

## §10 Stage gates (real git checks)

### Stage 1 → DONE (no Stage 2 in M.4)

M.4 has only Stage 1 — all 6 sub-waves are parallel-safe with no dependency edges among them. Stage 1 = DONE when ALL 6 PRs merged to `staging`:

```bash
gh pr list --search "is:merged head:test/m4- base:staging created:>=2026-05-24" \
  --json number,title,mergedAt,headRefName --limit 10
```

Expected: 6 merged PRs (one per M.4.1 … M.4.6).

**Phase -1 cold-review** before declaring M.4 done — per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md) — confirms each PR meets §1 paired-negative contract + §6 scope boundaries. Reviewer is a *separate session*, not the implementer.

## §11 Done =

6 merged sub-PRs into `staging`, each:
- 1 new test file `packages/core/hooks/<hook>.test.ts` (paired-negative ❌+✅+boundary);
- mutation-sanity check performed (§5 step 7);
- `pnpm test` full suite green; `pnpm test:principles` green; `tsc` clean;
- §1.7 H3 headers + ≥1 file:line cite per arm in PR body (per memory `feedback_pr_s17_authoring_checklist`);
- worktree removed after merge (§5 step 11);

…and the maintainer's own cold-QA pass per `feedback_own_qa_before_handoff`.

**Unblocks Track M.5a** (top-3 edit-time hooks: manifest render-drift / research-patch §1.7-substance / actionlint per-yml) — those can dispatch once M.4 lands.

## §12 See also

- [wave-sequencing-plan.md §2 Track M](../../../docs/meta-factory/wave-sequencing-plan.md) — full Track M roadmap.
- [wave-sequencing-plan.md §5.4](../../../docs/meta-factory/wave-sequencing-plan.md) — origin decision record (channel-audit + mutation-hardening 2026-05-23).
- `packages/core/hooks/check-hook-marker.test.ts` — the canonical test pattern to REFERENCE (§5 step 4).
- [`packages/core/hooks/git.test.ts`](../../../packages/core/hooks/utils/git.test.ts) — Wave 3 precedent (0-tests gap closure, the analog M.4 is solving 6× over).
- [`packages/core/principles/02-paired-negative-test.test.ts`](../../../packages/core/principles/02-paired-negative-test.test.ts) — the discipline each new test must satisfy.
- [`packages/core/principles/12-ai-laziness-traps.test.ts`](../../../packages/core/principles/12-ai-laziness-traps.test.ts) — validates §7 T-enumeration shape.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
