# S1 prior-art consult — three capability areas

> Consult record for the S1 capability commits (per CLAUDE.md build-vs-reuse gate +
> `.agents/rules/build-first-reuse-default.md`). Referent for `Prior-art:` trailers on
> S1 commits (accepted grammar: artefact path `docs/test-assurance-kernel/s1/prior-art.md`).
> Raw queries + hit lists: `logs/phase0/prior-art-searches.md`. Consulted 2026-10-08.
> SSOT append (`docs/meta-factory/prior-art-evaluations.md`) is OUT of S1 write scope —
> flagged to the coordinator as an observation (REPORT), not done autonomously.

## Area (a) — vacuous-assertion / assertion-presence ESLint rules for test files

**Candidates surfaced:**

1. `eslint-plugin-sonarjs` → [`sonarjs/no-trivial-assertions`](https://github.com/SonarSource/eslint-plugin-sonarjs) — «Assertions should not be trivially true» (flags `expect(true).toBe(true)`-class). Closest upstream match for Q1. Confirmed live via WebSearch 2026-10-08 (npm + socket.dev rule listings; also noted missing from oxlint's JS plugin bridge per Ultracite changelog).
2. `eslint-plugin-vitest` → `vitest/expect-expect` (test must contain an expectation; flags comment-only and empty bodies) and `vitest/prefer-expect-assertions` (context7, 2 phrasings 2026-10-08) — closest upstream for Q2.
3. `eslint-plugin-jest` → `jest/no-conditional-expect`, `jest/expect-expect` (adjacent; no dedicated tautology rule — WebSearch confirmed «eslint-plugin-jest does not have a dedicated no-tautology rule»).
4. In-repo: SSOT #154 (ESLint `RuleTester` — ADOPT, the author-side paired valid/invalid harness this stage reuses); SSOT #184 (`check-fences-fire.sh` — consumer-side firing gate, the K5 triple mechanism this stage reuses).

**T16 (per candidate):** upstream problem class = «a *consumer project* installs a test-quality plugin and lints its own tests for style/quality». Our problem class = «this repo must reject defective tests in *its own* tree through a channel it owns, with zero new dependencies (kickoff ground rule 6), explicit tested exemptions for intentional fixtures (`// audit:exempt`), and shipped-twin/fences-fire parity obligations». Match on detection *syntax family* (AST predicate over `expect(...)` calls); mismatch on delivery (adding `eslint-plugin-sonarjs`/`eslint-plugin-vitest` is a new dependency — prohibited) and on scope (upstream rules do not carry our `// audit:exempt` convention or the oxlint-dual-engine delivery constraint).

**Verdict: ADAPT (KEEP-NARROW).** Build own narrow rules in `packages/core/eslint-rules/` (`no-vacuous-assertion` for Q1, `require-effective-assertion` for Q2) implementing a deliberately *narrower, decidable* subset of the upstream semantics: literal-argument vacuity (`expect(<literal>).<matcher>(<literal>)` where both sides are syntactic constants) and assertion-presence per test body. Upstream rules are named here as the semantic REFERENCE and as the falsifier: if a dependency-free path to the upstream plugins appears (or the dep ban lifts), re-weigh ADOPT.

**Falsifier:** `eslint-plugin-vitest`/`sonarjs` become available dependency-free in this repo's lint runtime, or oxlint ships `no-trivial-assertions` natively → re-evaluate ADOPT and retire the custom rules.

## Area (b) — test-quality conformance driver over scratch repos (compliant/violating corpora)

**Candidates surfaced:**

1. In-repo SSOT #226 (adapter-factory conformance jig, BUILD 2026-07-22, PR #1094) — frozen contract + append-only conformance suite with mandatory valid+invalid (RED/GREEN) pairing + a named cold-review protocol. The strongest shape precedent.
2. In-repo SSOT #184 (`check-fences-fire.sh`) + `pre-merge-local.sh` detached-worktree scratch pattern + `run-bash-mutation.sh` shadow-copy contract — the scratch-execution mechanics S1 reuses.
3. Upstream: [solid-contrib/conformance-test-harness](https://github.com/solid-contrib/conformance-test-harness) (runs conformance suites against Solid servers, emits reports); NIST conformance-testing guidance (input selection per functional requirement); `pytest-pytester`/`trybuild`/Sonobuoy (already surveyed at SSOT #226 §6 — all host-language/domain-bound).

**T16:** upstream problem class = «certify a third-party server/adapter/compiler against a protocol spec». Our problem class = «certify THIS repo's own enforcement gates (principles, ESLint rules, guard-liveness) against a frozen expectations contract, by running the real public entrypoints over compliant/violating scratch repos, and detecting a weakened gate while corpus+driver stay fixed». Match on the *harness shape* (frozen expectations + paired compliant/violating corpus + independent reviewer); mismatch on domain (every upstream harness is bound to its host ecosystem; none runs a repo's own meta-test gates over scratch git worktrees). No packaged tool does the latter (negative-existence carried by SSOT #226 §6's 11-phrasing sweep, re-confirmed 2026-10-08).

**Verdict: ADAPT (in-repo #226 shape) / BUILD the glue.** The driver (`scripts/test-assurance/driver.mjs`) reuses the #226 conformance-arm shape — frozen expected outcomes, paired bad/good cases, named cold reviewer — over EXISTING entrypoints (`vitest run --root <scratch>`, real `Linter`, real fences-fire script). No new test platform (spec §6 prohibition).

**Falsifier:** a harness-agnostic conformance kit that drives a repo's own gates over scratch repos ships upstream → re-evaluate ADOPT per SSOT #226's trigger row.

## Area (c) — acceptance-replay adapter over existing gates

**Candidates surfaced:**

1. In-repo: `scripts/host-verify.sh` (REPO-IDENTITY GUARD + exit grammar — the pattern the kickoff fence already cites), SSOT #176 (`run-local-ci-sweep.sh` change-scoped gate aggregator, ADAPT 2026-08-18), SSOT #313 (corpus-verdict frozen vector + reviewed flip, ADAPT 2026-10-04 — the direct precedent for `expectations.json`).
2. Upstream: [`setup-cli-replay`](https://github.com/marketplace/setup-cli-replay) (scenario-driven CLI replay: record real executions, replay deterministically); `aicr verify-evidence` (CI verifies an evidence bundle); «Proof-or-Stop» (arXiv 2026-07-16 — structured gates with fail-closed behaviour when proof is missing/stale).
3. Adjacent, rejected: bernstein `governance verify`, mipiti-verify (evidence-ledger tools bound to their own ledger formats).

**T16:** upstream problem class = «replay recorded tool/session transcripts» (cli-replay replays captured command *outputs* deterministically) or «verify an evidence *ledger* in the tool's own format». Our problem class = «a reviewer runs ONE command that *re-executes the real gate chain* (never reads stored verdicts as proof), cross-checks fresh exits against a frozen expectations schema, and fails closed on missing evidence, skipped required cases, empty selections, or unresolved blocking dispositions». Match on fail-closed evidence discipline (Proof-or-Stop is the conceptual analogue); mismatch on mechanism — every surfaced tool replays *records*; none is a repo-local re-execution adapter with schema validation and tamper controls. Merely reading report JSON is insufficient per the S1 kickoff — a record-replayer cannot discharge that.

**Verdict: BUILD (narrow).** `scripts/test-assurance/verify.mjs` — node-builtin-only, reuses the host-verify.sh identity-guard/exit-grammar pattern and the #313 frozen-vector convention; REPLAY of real entrypoints, not report-reads. `setup-cli-replay` and Proof-or-Stop recorded as REFERENCE (conceptual, not adopted).

**Falsifier:** a production tool ships repo-local gate-chain re-execution with fail-closed evidence-schema validation → re-evaluate ADOPT.

## Trailer mapping (for S1 capability commits)

- Commit 3 (Batch B, Q1/Q2 rules + wiring): `Prior-art: docs/test-assurance-kernel/s1/prior-art.md §area-a (ADAPT/KEEP-NARROW — sonarjs/no-trivial-assertions + vitest/expect-expect named as semantic reference; dep ban per kickoff ground rule 6; SSOT #154/#184 shapes reused in-repo).`
- Commits 4/6/7 (conformance/driver/verify): `Prior-art: docs/test-assurance-kernel/s1/prior-art.md §area-b and §area-c (ADAPT of SSOT #226 shape + BUILD narrow glue; upstream harness/replay tools domain-bound, none re-executes a repo's own gate chain).`

## SSOT-row append (out of scope — coordinator observation)

`docs/meta-factory/prior-art-evaluations.md` is outside the S1 write scope. The three verdicts above (ADAPT/KEEP-NARROW, ADAPT#226/BUILD, BUILD-narrow) should be appended as SSOT rows by a maintainer/authorized session post-acceptance. Recorded in the S1 REPORT as an out-of-scope observation.
