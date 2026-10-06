# PR #2065 — senior final repair evidence

> **Authoritative for:** the bounded repair scope, source-byte manifest and verification performed by this session.
> **NOT authoritative for:** project goals, future CI results, production enrollment, autonomous merge or billing. Goal: README; contract: the approved Dot coordination specification.

## Pinned source and scope

Source parent: `f22c9a36aec8439bca3cbbc34dc89f17ef8bf505`, PR #2065, branch `claude/dot-gate-round2`, target staging. Last remote refresh remained OPEN at this head, base `d8924768f59a0d71530ca3d366c84ed2319e62e1`, 69 SUCCESS / two SKIPPED entries. Those checks belong to the parent, not these repairs.

Implementation workspace: `/Users/art/.codex/worktrees/dot-2065-final-fix/rules-as-tests-aif`. The following manifest binds all changed implementation/test bytes; documentation added beside it does not change those bytes.

| Path | SHA256 |
| --- | --- |
| `scripts/dot-review-gate/cc-adapter.mjs` | `9c669a2f7faba5e8d69f80fcfd29341dc684945c9a9e413ef446341320619e9f` |
| `scripts/dot-review-gate/connected-lifecycle.test.sh` | `3eac2b0448503f097e9f1ecd8ef8a3c0326258861fb27f34f8ddb3b70efaf8ec` |
| `scripts/dot-review-gate/intake.mjs` | `e52f9a03dc661c2aef20e3a81464243c98cef7ae1cd8c6914db2e0f4e2372a7d` |
| `scripts/dot-review-gate/ledger.mjs` | `9db44f5d756ea6b72500534e7eb2d661d33d70812570eb117b43e9a525174c88` |
| `scripts/dot-review-gate/runner.mjs` | `0adcb1a37deaba801e2bcaea2288295f4afb379876729b636fa30b6eb4e9f451` |
| `scripts/dot-review-gate/runner.test.sh` | `1ae9cb18bc60df7ea2df54f787595fc324efefc8833e9a68ce24b8f1b26e281c` |
| `scripts/dot-review-gate/service.mjs` | `01ec7ca2a25c4a52af9e1b4c46735a5a05ff83afa8b47240b146acebc52ee3e7` |
| `scripts/dot-review-gate/service.test.sh` | `7b7063e4a474ce96ba5539e51c5308909ca6d1cc53795b9d3c8b78df78a054a4` |

Approved spec SHA256 remains `88b0deb817c8afdca85f33c39706d8985a55f8a12f3dcbd36c3653444d25de1f`; canonical V2 schema remains `b110a641f74dbc29b000b1b9621d4694caa4684368e6c4f75e70a3d58bed107b`. No wire fields, policy pins, dependencies or workflow definitions changed.

## Repairs and discriminating evidence

| Original finding | Result |
| --- | --- |
| R4-1: distinct outcome suppressed | Immutable accepted report ID/digest deduplicates redelivery; GO → REVISE → GO on one fix revision survives restart. A current negative holds closure. The consumer checks issued scope, document validity and live tuple before granting a new outcome. |
| R4-2: attached review escapes PR | One shared resolver checks the entire attached finding set against challenged repository/PR and current applicable fix before any receipt is written. Foreign, mixed/unknown and stale-revision submissions refuse without partial authority. A valid two-finding correction closes both through the real chain. |
| R4-3: wrong issuer and stale execution | Webhook receipts preserve expected App, resolved workflow/run/attempt/time and revision-basis digest. Wrong/missing App or workflow does not qualify. Closure uses both current authoritative checks and applicable webhook evidence through the existing readiness evaluator. A newer red or pending run holds; older green delivery cannot mask it. |
| R4-4 / ST-R4-1: registration bypass | Review, verification and correction routing resolve ACTIVE PR scope; absent/foreign scope holds. The runner checks again at adapter delivery and per recovered action using its original persisted packet. RELEASED INTENT produces no file or delivery; explicit ACTIVE re-enrollment restores delivery. |
| ST-R4-2: empty priority precondition | Test seeds an actual outstanding DELIVERED review, verification work and competing review work with budget headroom. The known verify-as-review mutant now fails E_REVIEW_ACTIVE at the targeted priority assertion. |
| Composition gap | Connected test injects the real service drain into the runner; uses HTTP authentication/HMAC, SQLite and the actual file adapter. Counters and outcomes come from those components. |

## Independent review and corrective pass

Two fresh independent reviewers inspected the eight-file patch against the approved spec and repository standards. Frozen reviewed patch SHA256: `513da2a7c1eb6a70e75576775bce1331acca0e762ffba10b857fe04761af9143`.

- Spec reviewer reproduced closure against newer failed live CI on the same tuple. A new real HTTP test first reproduced RESOLVED against that failed state. The ledger now also evaluates the authoritative live check set; the test holds VERIFYING, then resolves only after the current state qualifies.
- Spec reviewer reproduced exact accepted-review replay returning E_REVIEW_SCOPE after resolution, and stranded outcome redelivery. Exact authenticated same-claim/digest replay now returns the existing receipt. Already-consumed immutable outcome redelivery grants no new authority and proceeds to publication. The connected test forces a publisher outage, closes findings, then demonstrates publication recovery. FOLLOW_UP remains non-authorizing and publishes the existing failure conclusion; this is report delivery, not merge approval.
- Standards reviewer demonstrated a last-delivery-wins check mutant passing the initial test because its closure payload replayed an earlier report. The test now uses distinct bytes, requires HTTP `replayed:false` and the actual E_NOT_RESOLVABLE / LATEST_ATTEMPT consumer hold. That mutant now fails the behavior assertion; the correct implementation passes.

These reviewers returned REVISE on the frozen patch. The author repaired all three material findings through RED → GREEN tests and the affected suite sweep. They did not independently issue a new CLEAN verdict for the final bytes. No material Fowler-smell finding or strategic ruling was reported.

## Executed checks and limits

- All 19 named Dot gate suites exit 0 on Node v22.23.1: armer, budgets, cc-adapter, connected-lifecycle, finding-lifecycle, gatectl, harness, intake, ledger, load-policy, publisher, queue, readiness, registration, reporter, runner, service, strict-json and validate-report.
- All 19 also passed on Node v24.3.0; subsequent connected-test strengthening passes on both versions. Original R4 counterexamples and the three cold-review findings had observed failing controls before repair.
- Temporary verify-as-review and last-delivery-wins mutants exit 1 at the relevant assertions. Mutant bytes are scratch-only and excluded from delivery.
- `node --check` on the five changed modules, `bash -n` on the three changed shell suites and `git diff --check` pass. Internal implementation and evidence prose are English.
- Full Node22 `npm test` was executed and **exited 1**. Core: 8 failed files / 18 failed tests, 320 passed files / 5,068 passed tests, one skipped file / 74 skipped tests. Collection failures also appear in the log. getff: three files / 43 tests pass; runtime-bridge: 23 files / 504 tests pass, one file/test skipped. These are observed workspace results, not an overall green claim.
- Failed core files: `audit-self/prove-rules.test.ts`, `eslint-rules/plugin-dual-engine.test.ts`, `install/delivered-scripts-lint-ignored.test.ts`, `hooks/getff-work.test.ts`, `hooks/husky-self-delegate.test.ts`, `hooks/parse-preset.test.ts`, `backends/npm/capability-matrix.test.ts`, `skills/pipeline/repo-root-anchor.test.ts`. They are outside the changed paths. Errors include tool/dependency resolution, toolchain evidence mismatch and timeouts. No unmodified-parent full-suite comparison was executed; do not label all failures proven pre-existing.
- A serial diagnostic rerun of those eight files was started to distinguish concurrency from persistent failures. Its current outcome belongs in the delivery handoff; it does not waive full-suite failures.

Scratch logs are under `/tmp/dot-final-*`; this committed evidence record and its source manifest are the durable input. No raw credentials are included. Existing workspace dependencies were reused; none was installed by this session.

## Delivery and remaining acceptance

The repair is ready for Git delivery with **conditional merge only after current required checks pass**. It is not a claim that full workspace validation or production autonomy is green. Refresh PR/head/base, preserve newer author work, follow normal repository/coordinator merge authority and dependency ordering. Substantive conflicts or new CI failures return to the senior repair owner; do not bypass checks or ask a junior to redesign the mechanics.

No remote source was pushed or merged by this session. No real Dot dispatch, CC wake/read/ACK/cessation, production receiver, native managed merge fence, schedule or paid fallback was exercised. These live floors remain UNVERIFIED. AIF Handoff remains excluded from the correction loop. A normal source merge cannot establish unattended operation or unlimited/zero billing.
