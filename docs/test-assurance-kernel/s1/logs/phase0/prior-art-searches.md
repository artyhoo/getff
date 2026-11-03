# S1 prior-art search log — raw queries + hits (2026-10-08)

> T11/T12 evidence for `../prior-art.md`. Every query below was executed live in this session;
> hit lists are the surfaced candidates as returned (trimmed to the load-bearing rows).

## SSOT grep (`docs/meta-factory/prior-art-evaluations.md`, 414 lines)

Command: `grep -inE 'eslint.*(assert|vacuous|expect)|assertion.*lint|no-empty|jest|vitest.*(rule|lint)|test-quality|mutation.*(driver|corpus)|conformance.*(driver|corpus)|replay.*adapter|acceptance.*adapter' docs/meta-factory/prior-art-evaluations.md`

Hits (SSOT row → relevance):
- #39 StrykerJS ADOPT — mutation testing of ESLint rule sources (existing capability, reused conceptually for K3/Q3 sensitivity, not a new dep).
- #118 `eslint --print-config` ADAPT — «assert a custom rule is actually applied in the resolved config» (K5 delivery-family precedent).
- #154 ESLint RuleTester ADOPT — paired valid/invalid author-side harness (reused for the new rules' `.test.ts`).
- #169/#170/#171/#175 validator gates (minimal-pair, messageId reachability, autofix-clean, require-vacuity) — the in-repo paired-negative discipline the new rules must meet.
- #176 local CI sweep aggregator BUILD/ADAPT — change-scoped gate aggregator (area-c shape precedent).
- #184 check-fences-fire.sh BUILD — consumer-side firing gate over bad/good triples (the K5 triple mechanism).
- #226 adapter conformance jig BUILD — frozen contract + paired arms + named cold reviewer (area-b shape precedent, PR #1094).
- #313 corpus-verdict frozen vector + reviewed flip ADAPT — `fixtures/29-corpus-verdicts.json` precedent for frozen `expectations.json`.
- #210 diff-scoped test execution REJECT — pre-push narrowing rejected on dependency-honesty grounds (context for lane design).

No SSOT row covers vacuous-assertion detection, a test-quality conformance driver over scratch repos, or a repo-local acceptance replay adapter → no existing SSOT entry matches the three capability areas.

## context7 (area a — `/vitest-dev/eslint-plugin-vitest`, ≥3 phrasings)

1. Query: «rules for detecting empty tests, no assertions, expect inside test body» →
   `vitest/prefer-expect-assertions` (incorrect: test with no assertions; «assertions not first» example includes `expect(true).toBe(true)`), `vitest/expect-expect` (incorrect: comment-only body, empty body), `prefer-to-be-truthy` (style rule).
2. Query: «detect test with no expect assertion or expect(true).toBe(true)» → same rules; no dedicated constant-vs-constant vacuity rule exists in the plugin.
3. Query: «rule to forbid assertions that compare constant to constant, vacuous always-passing expectation» → surfaced `prefer-expect-type-of`, `prefer-to-contain`, `prefer-equality-matcher` — matcher-*style* rules only. **No vacuity/tautology rule in eslint-plugin-vitest.**

Note: first `resolve-library-id` query («ESLint custom rule to detect vacuous assertions…») resolved `/vitest-dev/eslint-plugin-vitest` (High reputation, 489 snippets); a follow-up query-docs call timed out once and was retried successfully.

## context7 (areas b/c) — covered by in-repo SSOT rows

SSOT #226 and #313 rows already carry their own ≥3-phrasing context7 records (2026-07-22 / 2026-10-04); this consult reuses those records rather than duplicating them (the shapes are unchanged). Fresh phrasings for the replay adapter ran via WebSearch below.

## WebSearch (area a — 3 phrasings, 2026-10-08)

1. «eslint rule detect vacuous assertion expect(true).toBe(true) tautology test» → **sonarjs/no-trivial-assertions** (eslint-plugin-sonarjs, «Assertions should not be trivially true»; recommended config; also noted absent from oxlint JS-plugin bridge per Ultracite changelog); `jest/no-conditional-expect`, `jest/expect-expect` (adjacent); explicit finding: «eslint-plugin-jest does not have a dedicated "no tautology" rule — no-trivial-assertions from sonarjs is the closest match».
2. «eslint-plugin-jest no-conditional-expect trivial assertion expect(true).toBe(true)» (sub-query) → conditional-expect docs only.
3. «sonarjs eslint plugin no-always-false-assertions tautological assertion rule» / «"no-trivial-assertions" eslint-plugin-sonarjs rule» → confirmed rule existence + SonarJS analyzer family.

## WebSearch (area b — 1 broad + sub-queries, 2026-10-08)

«conformance test driver runs test suite against scratch fixture repositories compliant violating corpus harness» →
- [solid-contrib/conformance-test-harness](https://github.com/solid-contrib/conformance-test-harness) (Solid-server conformance suite runner) — domain-bound.
- NIST conformance-testing guidance (input selection per requirement) — methodology, not a tool.
- POSIX/Lustre compliance-testing wiki — domain-bound.
- No tool runs a repo's own meta-test gates over scratch git repos → negative-existence consistent with SSOT #226 §6's 11-phrasing sweep.

## WebSearch (area c — ≥3 phrasings, 2026-10-08)

1. «CI acceptance replay adapter re-executes recorded verification commands fail closed on missing evidence tool» → nothing exact.
2. «"fail closed" CI verification evidence replay recorded commands acceptance testing tool» → arXiv «Proof-or-Stop: Don't Trust the Agent, Trust the Evidence» (2026-07-16) — fail-closed gates when proof missing/stale (conceptual analogue); IBM collect-evidence (collector, not re-executor).
3. «"acceptance replay" CI adapter re-executes recorded verification commands missing evidence fail closed» + «github tool replay recorded verification commands CI acceptance check missing evidence fails» → [`setup-cli-replay`](https://github.com/marketplace/setup-cli-replay) (records command executions, replays deterministically — replays RECORDS, not live gates); `aicr verify-evidence` (bundle verifier in its own ledger format); bernstein `governance verify`; mipiti-verify.
4. «CI pipeline evidence-based verification adapter "fail-closed" replay recorded commands» → MADS-CPS run-level evidence contract (research), WinAPIReplay (OS-call replay).

Conclusion: no production tool re-executes a repo's own gate chain with fail-closed evidence-schema validation + tamper controls → BUILD-narrow verdict for area (c).

## Adversarial counter-prompt (T11/T7 discipline, category level)

«If an upstream solution existed, where would it be?» — a vacuity rule would live in eslint-plugin-vitest/jest/sonarjs rule catalogs (searched — only sonarjs/no-trivial-assertions exists, dep-blocked); a conformance driver would be a TCK/conformance-harness project (searched — domain-bound); a replay adapter would be a CI marketplace action (searched — record-replayers only). All three searches executed; the negative-existence claims above rest on them, not on memory.
