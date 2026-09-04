# slow-test-triage — kickoff (audit + decide)

> Created 2026-05-25. Mode: R-phase audit + recommendation (no implementation yet — recommendation goes to maintainer for verdict).
> Base branch: `staging`.
> Scope: identify pre-push slow tests + propose the right place for each (skip-conditional / move-to-slow-suite / leave-as-is).
> NOT to fix code in this PR — write a research-patch with recommendation, maintainer verdicts, then separate I-phase if approved.

## §0 Origin & problem

Pre-push hook (`packages/core/hooks/pre-push.ts:253-256`) runs `npx vitest run packages/core/audit-self/audit-ai-docs.test.ts` on every push. One test (line 344, «WARN(skip): tsconfig.json exists but ts-morph missing → still skips OR proceeds») measures ~24s locally on slow-npx machines because its real code path calls `execSync('npx tsx scripts/audit-r4.ts')` inside a sandbox without `ts-morph` → npx hits npm registry, hangs.

**Worked around** in PR #229 with `testTimeout: 36_000` in root `vitest.config.ts` — tight margin, environment-dependent flake remains.

**Root-cause options for permanent fix (this kickoff decides which):**

1. **Skip-conditional** — `it.skipIf(!process.env.HAS_TS_MORPH || !existsSync('node_modules/ts-morph'))(...)`. Skip slow probeR4 sandbox tests when ts-morph not installed locally; CI installs ts-morph → tests run there fully.
2. **Move to slow-suite** — separate vitest config / npm script (`test:slow` or `test:integration`); pre-push skips slow-suite, CI runs it. Same separation pattern as principle 11 fast/slow split.
3. **Mock execSync** — vi.mock the execSync call; tests assert against the mock instead of real subprocess. Lose «real probe» semantic but instant.
4. **Leave as-is** — accept the +24s pre-push overhead; testTimeout 36s stays in root config. Honest cost.

Each has trade-offs — kickoff §3 enumerates.

## §1 Scope

**Audit (mandatory):**
- Enumerate ALL tests in `packages/core/` whose duration exceeds ~3s. Run `pnpm test:principles --reporter=verbose` + similar for hooks/audit-self; record actual durations.
- For each ≥3s test: classify the slow path (network-dependent / IO-heavy / large-fixture / actually-correct-but-comprehensive).
- Identify which are invoked by pre-push (read `packages/core/hooks/pre-push.ts` and `packages/core/hooks/legacy-trailer-checks.sh`).
- Cross-reference: «which slow tests fire on every push vs which only on CI?»

**Recommendation (mandatory):**
- For each slow test or test group: recommend Option 1/2/3/4 from §0 above with rationale.
- Estimate I-phase effort (sub-wave count, LOC, blast radius) per chosen option.
- Decide if a **single** PR or **multiple** PRs (one per slow test class).

**OUT of scope:**
- Implementing the chosen options (separate I-phase, after maintainer GO).
- Refactoring `audit-ai-docs.test.ts` semantics (the mutation-test logic is correct; only its slowness is the issue).
- Touching CI yml config (separate concern).

## §2 Output

`docs/meta-factory/research-patches/<YYYY-MM-DD>-slow-test-triage.md`

Required sections:
- **§0.1** Cold-start verify (re-fetch staging; verify PR #229 merged)
- **§0.2** Population enumeration (T10): full inventory of pre-push tests + their measured durations
- **§1** Slow-test classification table (one row per ≥3s test: file:line, test name, measured duration, slow-path category, fired-by pre-push?)
- **§2** Per-test recommendation (Option 1/2/3/4 + rationale + I-phase effort estimate)
- **§3** Trade-offs analysis per Option (false-positive risk of skip-conditional; CI-only test coverage gap of slow-suite; semantic loss of mock; honest cost of leave-as-is)
- **§4** Maintainer decision-needed list (each Option choice surfaced as DN-X with consequence sketch)
- **§5** §1.7 self-reflexive check (verify-against-source-of-truth on durations; no fabricated numbers; complies with no-paid-llm-in-ci §1, dual-impl §3)
- **§6** Active T-trap citations: T3 (verify durations, don't claim from memory), T7 (don't just match-and-move-on), T10 (enumerate full population before recommending), T15 (audit applies to itself — slow-test audit doesn't itself introduce slow test), T20 (every Option recommendation has tool-output evidence)

## §3 Hard constraints

- `no-paid-llm-in-ci.md §1`: deterministic measurement only (vitest --reporter=verbose, /usr/bin/time, no LLM scoring)
- `phase-research-coverage.md §1.11+§1.12`: every duration claim cites command output; every recommendation cites evidence
- `ai-laziness-traps.md §3`: enumerate T-traps in §6 with concrete counters
- `parallel-subwave-isolation.md §1`: Worker runs in `Agent` `isolation: "worktree"`
- atomic-umbrella: ONE PR adding ONE research-patch file. No code edits in this R-phase.

## §4 Falsifiers

- Audit finds <3 slow tests → kickoff scope was overestimated; document and exit with «not worth a dedicated mechanism, leave-as-is across the board»
- All slow tests turn out CI-environment-only (not local) → the workaround in PR #229 is the right fix forever; archive this kickoff
- Mocking changes semantic meaningfully (the tests were genuinely catching production bugs that mocks miss) → REJECT Option 3 across the board

## §5 How to start

```text
/orchestrator .claude/orchestrator-prompts/slow-test-triage/kickoff.md
```

Run AFTER PR #229 (defer-reflex Stage 1) merged. The 36s timeout in PR #229 is the temporary patch this kickoff supersedes.

## §6 See also

- `packages/core/hooks/pre-push.ts:253-289` — pre-push test invocation
- `packages/core/audit-self/audit-ai-docs.test.ts:344-365` — the specific flaky test that triggered this work
- `vitest.config.ts:25` (after PR #229 merge) — current 36s testTimeout workaround
- PR #183 / commit 33278a4 — prior testTimeout bump (principle 11) — same root cause class
- `.claude/orchestrator-prompts/defer-reflex-detection/kickoff.md` — adjacent umbrella for context
- `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_m4_wave_done` — memory note «pre-push.test.ts:55-65 broken on staging (CI filter masks)» — sibling pre-existing flake

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
