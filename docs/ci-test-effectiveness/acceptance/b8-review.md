# Task 9 / B8 review

## Spec Compliance

- ✅ Scoped B8/D04 implementation is compliant, with one nonblocking cost/duplication improvement below. The actual observer now returns concrete classic complete=0, established missing=1 and unverified=2; registration and campaign acceptance remain separate effects (`scripts/check-required-contexts.sh:19`, `:25`, `:42`, `:46`, `:54`, `:60`; `docs/ci-test-effectiveness/batches/b8.json:36`).
- Reviewed input: base `f36264e2c379a72a0db36b54536b5f1dc37857b3` through head `76c124e5ef631587751d58de497836f6ac4280dc`, exclusively from `.superpowers/sdd/ci-test-effectiveness/task-9-review-package.txt` (two commits, 26 changed files). Requirements: `task-9-brief.md`; implementer claims: `task-9-report.md`. No Git commands, index/HEAD/branch changes, production edits, live API requests or suite reruns were performed. This requested review report is the only checkout write.
- Rubric: `superpowers:subagent-driven-development/task-reviewer-prompt.md`, canonical `.agents/roles/reviewer-discipline.md` runtime rubric (2026-10-09 correction, §6.1 rubric dated 2026-08-17), and `.agents/rules/reviewer-discipline.md`. Goal authority: `README.md:38` and invariants at `README.md:67`.
- Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

## Strengths and requirement checks

- Actual branch metadata replaces the admin protection endpoint, without adding credentials or write permissions. GH_REPO is passed through the workflow environment and validated as owner/repository; the wanted list is supplied to the helper as the actual JSON argument (`.github/workflows/workflow-integrity.yml:34`, `:39`, `:49`; `scripts/check-required-contexts.sh:12`). The pinned checkout disables persisted credentials (`.github/workflows/workflow-integrity.yml:28`).
- The six existing declaration strings, workflow/job/status identities, PR-only observer condition and nonrequired status remain intact. Both existing event path filters gain the helper path. No main policy, required marker or registration is changed (`.github/workflows/workflow-integrity.yml:1`, `:6`, `:11`, `:18`, `:39`).
- API success is tested independently of stdout, so a nonzero response containing valid JSON cannot become a policy witness. Branch JSON must be one object, with staging name, a supported protection state and concrete string/check schema. Invalid/multiple documents and missing required schema are rejected (`scripts/check-required-contexts.sh:19`, `:25`). The self-review schema RED records the former wrong missing=1 result and the final corpus records its correction (`docs/ci-test-effectiveness/evidence/b8-schema-red.txt:34`).
- A sufficient classic witness exits before querying rulesets. Incomplete classic metadata requires all inherited, paginated ruleset responses to be arrays of disabled/evaluate entries; active, unsupported or unreadable rulesets yield unknown=2. This is conservative, bounded interpretation rather than a general applicability engine (`scripts/check-required-contexts.sh:42`, `:46`, `:53`, `:60`).
- P37's original eleven declaration-equality/event/negative tests remain; the diff adds conformance in its existing home. Fixed case outcomes are independent of helper jq. Fake gh provides literal responses/statuses and exact endpoint matching; the code under test is the real Bash helper and the YAML-extracted actual run block (`packages/core/principles/37-required-context-completeness.test.ts:696`, `:729`, `:909`, `:917`, `:927`, `:948`). This is controlled transport, not a copied policy predicate.
- Known missing-three checks an independently specified exact JSON list and operator action, not only a generic failure (`packages/core/principles/37-required-context-completeness.test.ts:953`). Source declarations are not treated as live registration.
- The meaningful old actual workflow receipt is distinct from helper ENOENT and the early unexpanded-expression RED. The audit driver loads the base workflow, performs only runner repository-expression substitution, controls denied admin access and records actual old status0 versus expected missing1 (`docs/ci-test-effectiveness/evidence/b8-held.py:27`, `:30`, `:44`; `b8-held.json:2`; `b8-old-workflow-false-green.txt:1`). `b8-red.txt` alone would not establish that failure; the report does not claim it does.
- Consumer-call removal retains independent expectations and fails the workflow cases; helper detector bypass fails missing and ruleset-unknown cases. Restoration retains both original hashes and passes the fixed corpus (`docs/ci-test-effectiveness/evidence/b8-held.py:47`, `:54`, `:62`; `b8-held.json:11`, `:19`, `:30`). I independently hashed the current helper/workflow and obtained the exact recorded restored hashes. No held mutation was rerun.
- Scope matches the exact grant: workflow, helper, existing P37, one normally generated shipped-test manifest entry, B8 evidence/batch and appended inventory row. The only manifest diff is P37; its recorded new hash equals the actual current P37 hash `73ef7e3443bda297c95dfe1a352d8bfdca22ab58206274c2deef89c8d1da0f30` (`packages/getff/MANIFEST.sha256:1090`). No audit-self, sweep, installation, new platform or policy-setting mutation appears in the diff.
- Seven criteria are present and substantively supported: relevance to D04, actual entrypoint effectiveness, no warning-green theatre, fixed independent oracle, reuse, measured bounded costs, and finite sufficiency (`docs/ci-test-effectiveness/batches/b8.json:15`). Total cost is honestly distinguished from unmeasured incremental/billing cost (`task-9-report.md`, Verification, cost and self-review). Per-wrapper marginal protection deserves the minor refinement below.
- Native live evidence is correctly status1 with exact missing-three and empty stderr, using existing CLI authentication. The receipt explicitly says workflowTokenUsed=false and retains the pre-final-schema-change helper hash. Neither report nor batch upgrades that to hosted GITHUB_TOKEN capability, completed administrator registration, TAK/sidecar/Windows acceptance or full campaign DONE (`docs/ci-test-effectiveness/evidence/b8-live.json:4`, `:7`, `:11`; `b8-live-stdout.txt:1`; `docs/ci-test-effectiveness/batches/b8.json:36`).

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

None identified within this scoped change.

### Minor (Nice to Have)

**M1 — Consolidate repetitive wrapper cases while retaining the helper schema corpus.**

- Severity: Minor; layer=implementation; whose=reviewer. Evidence: `packages/core/principles/37-required-context-completeness.test.ts:909`–`:931`, `.github/workflows/workflow-integrity.yml:39`–`:49`, and `docs/ci-test-effectiveness/batches/b8.json:20`.
- Violated quality target: distinct marginal value relative to recurring cost; this is not an assertion that 22 is inherently excessive. The shared loop is DRY and assertions are real, so it is not verbatim implementation duplication or a blocking defect.
- Failure-scenario: each future helper-only schema fixture automatically adds a second Bash/gh/jq execution through a wrapper that only assigns the same argument and calls the same helper. It consumes recurring principle/prepush time without exercising another schema decision. Recorded restored verbose timings total approximately 0.73s for the 22 workflow cases, versus a 2.30s Vitest run/3.594s command; these are rounded case timings, not an isolated incremental benchmark. Current total host command cost is 4.251s. The issue is small, cumulative execution cost and weak marginal-value accounting, not current false-green behavior.
- Actionable correction: retain the helper's branch/ruleset schema corpus; execute a smaller, explicit workflow boundary corpus covering complete0, exact missing-three1, branch transport-failure2 with valid complete stdout, and rules transport-failure2 with valid empty stdout. These distinguish successful invocation/argument delivery, status1 propagation, and both early/late status2 propagation. Retain the environment/path assertion and held consumer/detector expectations. Consolidating the remaining workflow copies preserves the observed contract and deletion/bypass protection. No additional test hierarchy or quota is needed. If all copies are retained, record a concrete wrapper-specific fault each adds rather than treating two entrypoints as sufficient justification for every repeated schema.
- This note does not request a re-review round: the current corpus is valid and fast in absolute terms; no current policy or acceptance decision is wrong.

**N1 — Existing verification output has npm warning noise (informational, outside this repair).**

- Severity: Minor informational; layer=implementation; whose=reviewer. Evidence: `docs/ci-test-effectiveness/evidence/b8-host-manifest-check.txt:3`–`:8` retains six npm gitignore-fallback warnings. The implementer explicitly discloses them and the command succeeds. These warnings are not introduced by the B8 runtime change. No source correction is required for this scoped verdict; any packaging warning cleanup should be handled in its owning scope. No failure-scenario attributable to this patch and no re-review round.

## Per-case marginal-value assessment

All helper entries below have a distinct concrete branch/status/schema boundary or sufficient-witness claim. The workflow has no per-schema logic: it constructs the single JSON argument and makes the final helper call. Consequently the full helper corpus is justified; only the listed workflow boundary representatives add distinct required protection. This assessment concerns maintainability/cost, not a smaller test-count target.

| Fixed case (P37 line) | Direct helper protection | Workflow disposition |
| --- | --- | --- |
| complete classic contexts (731) | Basic complete witness and source, exit0 | Retain: actual call and successful argument delivery |
| complete real checks schema (738) | Checks array supplies contexts independently | Consolidate: parser is entirely in helper |
| known missing three (748) | Exact subtraction, names/action, exit1 | Retain: actual list/quoting and status1 reach workflow |
| unprotected known empty (755) | False protected with concrete empty state is missing1 | Consolidate: same wrapper status1 boundary |
| protected without status requirement (763) | Explicit null requirement is known missing1 | Consolidate: same wrapper status1 boundary |
| inactive ruleset known missing (771) | Disabled ruleset cannot supply missing requirements | Consolidate: helper-only enforcement interpretation |
| active uninspected ruleset (778) | Cannot infer applicability; unknown2 | Consolidate: wrapper status2 already covered |
| active ruleset plus sufficient classic witness (785) | Additional unknown rules cannot invalidate sufficient positive witness | Consolidate: helper fast path; no wrapper branch |
| branch HTTP failure despite valid complete body (792) | Nonzero transport overrides superficially complete JSON | Retain: early status2 propagates through actual run block |
| branch malformed JSON (800) | Invalid JSON never classifies as missing/complete | Consolidate: helper-only parsing boundary |
| branch unknown schema (807) | Empty object is unknown, not absent | Consolidate: helper-only schema boundary |
| protected branch missing checks schema (814) | Missing field differs from explicit null; demonstrated schema RED | Consolidate: helper-only schema boundary |
| branch wrong JSON type (822) | Array is not branch object | Consolidate: helper-only schema boundary |
| branch contexts wrong type (829) | String cannot substitute for contexts array | Consolidate: helper-only schema boundary |
| branch checks malformed (836) | Numeric context cannot supply check name | Consolidate: helper-only schema boundary |
| branch multiple documents (843) | Single branch object cardinality is enforced | Consolidate: helper-only schema boundary |
| rules API failure despite valid empty body (850) | Nonzero later transport cannot establish absence | Retain: late status2 also propagates |
| rules malformed JSON (858) | Invalid rulesets body is unknown2 | Consolidate: helper-only parser boundary |
| rules unknown schema (865) | Object is not ruleset page array | Consolidate: helper-only schema boundary |
| rules unknown enforcement (872) | Unrecognized/missing enforcement is not inactive | Consolidate: helper-only interpretation boundary |
| paginated later active ruleset (879) | A later page prevents false known-missing | Consolidate: helper pagination boundary |
| classic complete needs no rules API (886) | Unreadable rules API cannot invalidate sufficient classic witness | Consolidate: helper fast-path independence |

The two sufficient-classic fixtures intentionally overlap at exit0, but retain different declared fixture conditions (active rules versus API failure) at negligible individual cost; neither actually calls the rules endpoint. The implemented fast path itself is the evidence of independence. They must not be described as inspecting an active ruleset or observing its transport failure. A single “classic complete with unusable rules endpoint” helper representative could also cover the operational fast-path contract if later simplification is desired; current retention does not block approval.

## Checks performed and evidence assessed

- Read the complete provided diff in bounded chunks, task brief/report, canonical reviewer discipline, and repository goal/bootstrap; no broad repository crawl.
- Read the saved predispatch branch/ruleset receipt for the named concrete risk that final schema validation might reject the real ordinary branch response. It contains protected=true, protection.enabled=true, required_status_checks contexts/checks with the known three strings, and empty inherited rulesets. Those fields satisfy the final helper schema by inspection. No API or final live rerun was needed; the dated receipt is not fresh hosted evidence.
- Focused outside-diff delivery check for the named concrete risk that new unconditional Bash/jq probes might be delivered through a Windows CI principle job: inspected actual principle invocation locations. Both `principles-meta-tests` (`.github/workflows/audit-self.yml:347`, `:365`) and `kickoff-checks` (`:3064`, `:3079`) use ubuntu-latest. No Windows claim is inferred. Local Windows developer compatibility remains unverified.
- Independently computed current helper/workflow/P37 SHA256. Helper `8dfda7a473197990d649a47f3b2324cca40f824b345a732de74af8f791005770` and workflow `d84360a7ea11fb4b2a67e4f6f23ee8d6d465a70373b0ec17bf865f47422ec714` match held restoration; P37 matches manifest. This is source identity checking, not a repeated suite.
- Existing final host receipts show exact requested bash syntax0, focused P37 56/56 status0, actionlint0, and normal archive/manifest check0 (`docs/ci-test-effectiveness/evidence/b8-host.json:1`; `b8-host-principle37.txt:4`; `b8-host-manifest-check.txt:1`). Existing held receipts show consumer1, detector1, restored0. These runs were assessed, not independently rerun. Test counts are execution evidence, not effectiveness by themselves.

## Assessment

**Task quality: Approved for scoped B8/D04, with nonblocking M1.** The actual path has truthful bounded tri-state behavior, independent offline entrypoint expectations and genuine old/held false-green evidence. The source/report preserve the distinction between readable observation and administrator-owned enforcement.

### Cannot verify / separate acceptance

- Hosted execution with the actual workflow GITHUB_TOKEN, especially inherited rulesets visibility, is pending. Native CLI access does not establish it; failures still return unknown2 rather than green.
- Current administrative registration is missing three of six according to retained observations; no source edit repairs that. The exact prepared Settings action in the implementer report must be performed by its existing owner while preserving other contexts/app associations/policy, then reobserved.
- The retained native live command used the earlier documented helper hash. Final live-schema compatibility is supported by final code inspection and the fixed offline corpus, not a new exact-final live command.
- TAK #2144, sidecar #2146, Windows #2116, full campaign/full-hooks acceptance and independent hosted/platform acceptance remain separate. No merge, push or campaign-complete verdict is made.
- Normal hooks, final Git cleanliness and the entire S1 immutability claim are reported by the implementer; the provided scoped diff supports no S1 changes, but I did not rerun Git/hook checks or audit all repository state.
