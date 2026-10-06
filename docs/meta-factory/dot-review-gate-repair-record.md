# Dot review gate — repair record for review findings R1–R11

> **Status:** repair complete, 2026-10-05 (R1–R11); round-2 packet executed 2026-10-06 (DR-R1–DR-R5 + increments 5–9 + validate-only CLI — §Round 2 below) plus the cold-review fix pass (§Round 2 → Cold-review fix pass); round-3 repair packet executed 2026-10-06 (SP-1–SP-7 + ST-1 + Dot D2065-S03 + packet lifecycle cases + the bounded-runtime runner — §Round 3 below) plus the round-3 cold-review fix pass (§Round 3 → Round-3 cold-review fix pass). 18 suites, 421 arms, all green in one sweep on 2026-10-06.
> **Authoritative for:** the mechanism-only repair of review findings R1–R11 (review: `docs/superpowers/plans/2026-10-05-dot-staging-review-gate-review.md`) — per finding: the reproduction, the regression evidence, the change made, the verification, the remaining limitation. The round-2 section extends the same format to the follow-up packet's verified defects.
> **NOT authoritative for:** the packet documents (protocol, schema, handoff, design spec, kickoff — owned by the documentation session); live validation (S0/S4) and staging enforcement (S5) remain operator-gated; nothing here is evidence that any live proof ran.
> **Verification base:** `bash scripts/dot-review-gate/<suite>.test.sh` — 18/18 suites exit 0 in one sweep; arm counts: harness 10, strict-json 25, load-policy 15, readiness 20, validate-report 59, gatectl 16, ledger 29, intake 27, publisher 18, reporter 8, armer 19, service 42, finding-lifecycle 65, cc-adapter 17, queue 11, budgets 16, registration 15, runner 9.

## R1 — publication trusted a detached boolean

- **Reproduction (review):** validate a good fixture, mutate the bytes (execution.failure=true, empty mechanical evidence), pass the stale `{ok:true}` → publisher created a `success` check.
- **Proof already fixed / regression:** `publisher.test.sh` arms `crashed-review-refused` (stored record with a crashed review and no CI evidence publishes nothing), `no-record-refused`, `no-inventory-refused`, `red-mechanics-refused`, `spoofed-workflow-refused`, `stale-M-refused`. The new `publishAdmission({ledger, reportId, ...})` has no caller-supplied validation parameter: it re-digests the stored payload, re-validates the stored bytes against the LIVE tuple and the generation's trusted inventory, and rechecks mechanical readiness through `evaluateReadiness` before any write.
- **Change:** `scripts/dot-review-gate/publisher.mjs` rewritten around `loadAuthenticatedResult` (ledger record → digest check → live PR/M reads → `validateReport` with `currentState` + `trustedInventory` → live readiness sweep with `resolveRunIdentity`); `publishFailure` shares the same gate.
- **Verification:** publisher suite 10/10 arms green.
- **Remaining limitation:** the check-run→run-identity mapping (`resolveRunIdentity`) is a service-provided adapter; its correctness against the real Actions API is an S0/S4 live proof, not covered offline.

## R2 — challenge consumption did not enforce reviewer, generation or lease binding

- **Reproduction (review):** challenge issued to reviewer 555001, generation superseded by a head change, consumption as reviewer 999999 succeeded.
- **Regression:** `ledger.test.sh` arms `wrong-reviewer-refused`, `generation-binding-refused`, `tuple-drift-at-consume-refused`, `lease-expired-refused`, `replay-by-other-reviewer-refused` (replay path included), `terminal-consume-refused`; HTTP-level: `intake.test.sh` arms `submit-wrong-reviewer-refused`, `submit-superseded-refused`, `submit-generation-mismatch-refused`, `submit-lease-expired-refused`, `submit-inner-mismatch-refused`.
- **Change:** `ledger.submitReport` performs every binding check inside the transaction, in order: challenge exists → AUTHENTICATED reviewer matches (before any replay path) → replay/conflict → generation not superseded/terminal → lease not expired → expected tuple digest matches → asserted generation seq matches → store report + consume challenge + enqueue outbox, one transaction. The report's own authorship fields stay assertions; the ledger row binds the session principal (`intake.test.sh` arm `envelope-principal-binds-ledger`).
- **Verification:** ledger suite 26/26, intake suite 18/18 green.
- **Remaining limitation:** none known offline; identity derives from the OAuth session, whose live enrollment/isolation is a P3/P5 operator proof.

## R3 — generation digest omitted load-bearing revision/policy fields

- **Reproduction (review):** same base/head, changed M and policy digest → the exact same generation ID was reused.
- **Regression:** `tuple-base-ref-changes-generation`, `tuple-merge-base-changes-generation`, `tuple-M-changes-generation`, `tuple-policy-changes-generation`, `tuple-protocol-changes-generation`, `terminal-reopen-new-epoch` (a terminal tuple reopens with epoch 2, history preserved), `challenge-rejected-on-terminal`, `challenge-verifies-stored-tuple`.
- **Change:** `tupleDigest` covers repository, PR node, base ref/sha, head, merge-base, tested merge M, policy sha256, protocol version; generations carry an `epoch` + full `tuple_json`; `openGeneration` reuses an in-flight generation only for the identical tuple and otherwise opens a new epoch; `issueChallenge` verifies the passed tuple against the stored one BEFORE state checks.
- **Verification:** ledger suite green (see above).
- **Remaining limitation:** none.

## R4 — COMPLETE/GO could cover zero changed files

- **Reproduction (review):** schema-valid COMPLETE/GO with one changed file, empty reviewed_files, reviewed_count 0 → accepted.
- **Regression:** `validate-report.test.sh` inventory arms: `zero-reviewed-rejected` (E_REVIEWED_MISSING), `changed-missing-trusted` (E_CHANGED_MISSING), `changed-extra-unknown` (E_CHANGED_UNKNOWN), `changed-duplicate-path` (E_DUP_CHANGED), `no-inventory-fails-closed` (E_NO_INVENTORY), `spec-inventory-gap`, `spec-id-unknown` (E_INVENTORY); publisher re-checks the same inventory from the generation (`no-inventory-refused`).
- **Change:** `validateReport(..., {trustedInventory})` — for an admission in a live context the report's changed_files must EQUAL the trusted inventory (both directions, unique paths) and reviewed_files must carry an explicit disposition for every changed path; the trusted inventory is pinned to the generation at claim time (`claimGeneration({changedFiles})`), and an admission without one fails closed. Policy `specification_inventory` must be fully assessed.
- **Verification:** validate-report suite 42/42 green.
- **Remaining limitation:** the authoritative diff itself comes from the GitHub files API at claim time; the live mapping is an S0/S4 proof.

## R5 — armer could not address the real repository and used an invented API route

- **Reproduction (review):** `/repos/artyhoo/getff/pulls/2042` → E_ALLOWLIST; `/repos/x/pulls/2042` accepted; the write route `PUT /repos/{o}/{r}/pulls/{n}/auto-merge` is not a documented REST endpoint (docs check: REST pulls surface documents merge/merge-async only; enabling auto-merge is the GraphQL mutation `enablePullRequestAutoMerge`).
- **Regression:** `armer.test.sh` arms `armed-once-pinned-mutation` (one POST /graphql whose body equals the pinned mutation: query + `pullRequestId` from the live PR read + `SQUASH`), `client-allowlist-owner-repo` (one-component and foreign-repo paths refused client-side), `graphql-body-pinned` (an unpinned mutation body never reaches the transport), `repo-format-validated`, `head-drift-refused` (live head/base bound against the reviewed report before any write), plus the authorization-guard arms (`revise-refused`, `invalid-refused` — the armer validates the bytes ITSELF, `pause-refused`, `nonstrict-refused`, `wrong-source-refused`, `draft-refused`, `rearm-idempotent`).
- **Change:** `scripts/dot-review-gate/armer.mjs` rewritten: owner/name repo enforced client-side; the ONLY write is `POST /graphql` with a body pinned by `createArmerClient`; PR addressed by `node_id`; merge method pinned to the SQUASH/MERGE/REBASE enum; internal `validateReport` with the generation's trusted inventory — no caller-supplied validation flag.
- **Verification:** armer suite 12/12 green.
- **Remaining limitation:** live minimum-credential proof (the armer token can do the mutation and nothing else) is an S0 probe; not performed here.

## R6 — the test harness could report green after a failed child process

- **Reproduction (review):** a node child printing `ok first-arm` then exiting 1 → the old `out=$(node … | grep …)` pattern printed "all green" (pipeline discarded the exit status; a literal-FAIL scan plus any ok line decided the verdict).
- **Regression:** `harness.test.sh` (new, 10 arms): `nonzero-after-partial-success`, `empty-output`, `fail-token`, `missing-arm`, `unexpected-extra-arm`, `signal-killed-child`, and two REAL children (`real-child-exit`, `real-child-signal`) run through the same capture pattern the suites use.
- **Change:** `scripts/dot-review-gate/suite-harness.sh` — `assert_suite_arms` checks the child's exit status BEFORE any output filtering, requires non-empty output, no FAIL token, and an EXACT match of the observed `ok <arm>` set against the declared expectation (missing and unexpected arms both fail). All node-script suites (armer, publisher, reporter, intake, ledger, service) migrated; strict-json/readiness/load-policy/validate-report were audited and already fail-safe (per-arm output contract), left as-is.
- **Verification:** every suite re-run under the repaired harness in the final sweep — 11/11 green; a suite cannot go green without its declared arms.
- **Remaining limitation:** none.

## R7 — the strict parser treated `__proto__` as object inheritance

- **Reproduction (review):** `{"__proto__":{"injected":true}}` set a prototype instead of an own property; a whole report wrapped in one `__proto__` key passed `validateReport` with zero errors.
- **Regression:** `strict-json.test.sh` arms `proto-root`, `proto-nested`, `proto-report-wrap` (all rejected with `PROTO_KEY`), `null-proto-root`, `null-proto-nested`, `no-inherited-props`, `roundtrip`; `validate-report.test.sh` arm `proto-key-raw` (the review's exact validator-level repro now rejected).
- **Change:** `parseStrictJson` builds objects with `Object.create(null)` and refuses the `__proto__` key outright (`PROTO_KEY`); nothing parsed from untrusted bytes can inherit or shadow.
- **Verification:** strict-json 25/25, validate-report 42/42 green; the ajv chain accepts prototype-free objects.
- **Remaining limitation:** none.

## R8 — the HTTP intake erased duplicate keys before the strict parser saw them

- **Reproduction (review):** raw `verdict STOP` + `verdict GO` body: direct validator rejected it, but the intake's JSON.parse+stringify made it validate clean.
- **Regression:** `intake.test.sh` arm `submit-dup-verdict-raw-rejected` (the raw duplicate-verdict POST is refused at the envelope boundary with `DUP_KEY`).
- **Change:** `/submit` strict-parses the RAW envelope bytes with `parseStrictJson` before any normalization; the envelope shape (string claim_id, integer generation, object report) is checked, and the inner report's claim/generation must equal the envelope's (`E_ENVELOPE`) — stitched bytes are named. The stored payload is the canonical reserialization of the strictly-parsed report, so validation, digest and storage see identical bytes.
- **Verification:** intake suite 18/18 green.
- **Remaining limitation:** none.

## R9 — readiness accepted spoofed workflows and could select an older green run

- **Reproduction (review):** a fake context published by the expected Actions App from `.github/workflows/untrusted.yml` passed; an older green run at attempt 1 followed by a newer red run at attempt 1 still passed.
- **Regression:** `readiness.test.sh` arms `spoofed-workflow-path` (WORKFLOW), `missing-run-identity` (WORKFLOW — unverifiable identity is not readiness), `stale-workflow-version` (policy-pinned `workflow_sha` mismatch), `workflow-version-pinned` (matching pin ready), `older-green-newer-red` (LATEST_ATTEMPT — the review's exact repro), `rerun-green-same-run` (attempt 2 of the SAME run heals), `run-id-tiebreak`, `new-run-red-blocks-old-green`; `load-policy.test.sh` arms `missing-workflow-path`, `untrusted-workflow-path` (the trusted workflow identity is a POLICY fact).
- **Change:** each mechanical policy context carries a required `workflow_path` (`.github/workflows/…`) and optional pinned `workflow_sha`; `evaluateReadiness` groups per context by RUN identity (newest `run_started_at`, then run id) and takes the highest `run_attempt` WITHIN the winning run — a bare attempt counter across unrelated runs no longer selects anything; the run's workflow identity must equal the policy's.
- **Verification:** readiness 20/20, load-policy 15/15 green.
- **Remaining limitation:** mapping real check-runs to run identities is the service adapter's job; live verification is an S0/S4 proof.

## R10 — report commit and outbox enqueue were separate transactions

- **Reproduction (review):** crash between the report commit and the enqueue left a consumed report with no delivery event; only an exact client retry repaired it.
- **Regression:** `ledger.test.sh` arms `submission-outbox-atomic-on-fault` (`openLedger(path, {faultAfter:'report-insert'})` throws inside the transaction → report absent, no `report.submitted` event, generation state rolled back) and `restart-drains-single-publication` (fresh process view of the same file drains the event exactly once); `service.test.sh` arm `restart-drains-single-publication` repeats it through the composed service.
- **Change:** `submitReport` and `claimGeneration` each write state + outbox event in ONE transaction (`outboxEnqueueTx` composes without a nested BEGIN); the `faultAfter` injection point exists for durability tests only.
- **Verification:** ledger 26/26, service 11/11 green.
- **Remaining limitation:** delivery is at-least-once; exactly-once EFFECTS rest on the publisher's external_id reuse (`crash-recovery-idempotent`) — that chain is tested offline and holds.

## R11 — running service, queue and operational fail-closed controls were missing

- **Reproduction (review):** grep found only definitions, no composition; `/claim` issued challenges without readiness; `claim_lease_minutes` was never enforced; `authorization_expiry` was a load-time check only.
- **Regression:** `service.test.sh` (new, 11 arms): `startup-unresolved-policy-refused`, `e2e-publish-once`, `re-drain-no-second-check`, `red-mechanics-stop-claims` (409 E_NOT_READY), `state-outage-stops-claims` (503), `lease-frees-claim-slot`, `expiry-stops-claims` (403), `expiry-stops-publication` (events kept pending, nothing published), `pause-stops-claims-and-publication` (503 / skipped-paused / nothing published), `unpause-resumes`, `restart-drains-single-publication`.
- **Change:** `scripts/dot-review-gate/service.mjs` — `createGateService` composes intake HTTP + fail-closed gates (expiry, durable pause via the ledger `control` table, readiness on /claim, state availability) + `drainOutbox` (durable consumer: report.submitted → ledger-backed publish; red mechanics / expiry / pause SKIP and keep the event pending; at-least-once delivery, exactly-once effects by external_id). The service refuses to start on an unresolved policy or missing schema. The intake gained `claimGate`/`submitGate` seams, an awaited validator, and lease-aware claim counting.
- **Verification:** service suite green; the full sweep stays green.
- **Remaining limitation:** browser queue/forms and reporter delivery are out of prototype scope; the webhook consumer archives events but does not yet drive the generation state machine (a webhook that re-runs `beginGeneration` on synchronize is a documented next step, not implemented).

## A2 (follow-up packet 2026-10-06, increment 2) — valid non-authorizing reviews were rejected before the ledger

- **Reproduction:** with a live tuple attached, `validateReport` pushed `E_NOT_AUTHORIZING`/`E_KIND_RECAST` into `errors`, so `ok` was false for a valid REVISE/INCOMPLETE review; the intake's `!verdict.ok → 422` then rejected it before `ledger.submitReport` — the service's `E_NOT_AUTHORIZING → publishFailure` branch (`service.mjs`) was unreachable for the most common corrective outcome, and no composed test exercised acceptance at all.
- **Regression:** `service.test.sh` +5 arms: `accept-revise-persisted` (valid REVISE → 200 + receipt, watched RED as 422 first), `replay-idempotent` (identical bytes → same `report_id`, `replayed:true`), `forged-envelope-rejected` (stitched inner claim → 422 `E_ENVELOPE`), `stale-tuple-submit-refused` (head moved after claim → 422 `E_TUPLE`; a delayed issued review cannot authorize the new head), `revise-publishes-named-failure` (drain routes the record to exactly ONE `failure` check on M; zero success checks — a REVISE can never merge).
- **Change:** `validate-report.mjs` — the result now carries two predicates: `ok` (acceptable document: format, schema, semantics, inventory, tuple) and `authorizing` (kind=admission ∧ COMPLETE ∧ GO); the non-authorizing status moved from `errors` to a named `nonAuthorizing` marker list, computed document-intrinsically (the historical-GO recast is named even without a live context). `publisher.mjs` — `loadAuthenticatedResult` treats every remaining error as fatal (the code filter is gone) and returns `authorizing`; `publishAdmission` refuses on `!authorizing` (same predicate, single source). Intake unchanged — accepting valid non-authorizing documents falls out of the validator contract.
- **Verification:** `validate-report.test.sh` 42/42 (the two recast arms converted from REJECT to PASS+named-marker; `admission-valid` pins `AUTH`); `service.test.sh` 16/16; full sweep 11 suites / 202 arms green on the merged head.
- **Remaining limitation:** V2 verdicts (`PARTIAL` coverage, `DECISION_REQUIRED`) and historical-report import wait on the DotPRReviewV2/2.0.0 schema pin from the docs lane (packet §10) — the separation mechanism is proven on the V1 surface; no V2 field spelling is invented here.

## A4 (follow-up packet 2026-10-06, increment 4) — finding lifecycle was absent from the durable journal

- **Gap (packet):** "Extend the existing persistent ledger for finding lineage/occurrences, queue, single correction owner, assignment/token/lease, acknowledgement, fix revision, check/change-review/Dot-closure receipts and retry reservations. Production memory fallback is rejected. New heads invalidate admission, not finding history."
- **Regression:** `finding-lifecycle.test.sh` (new suite, 17 arms, wired as the 12th named line in the CI job): idempotent occurrence recording, exclusive claim (`E_ALREADY_CLAIMED`), fencing on ack/fix (`E_FENCING`), `expired-claim-holds-until-revoked` (`E_CESSATION_UNKNOWN` — lease expiry is not cessation), revoke-then-reclaim with a NEW token, fix response → VERIFYING, closure refused without receipts, closure refused while the latest post-fix check failed, VERIFIED closure with change_review receipt, disposition allowlist (`E_DISPOSITION`), recurrence opens a new occurrence while lineage keeps the RESOLVED past, bounded retry reservations surviving reopen (crash-safety), superseded generation keeps finding history. Service arms: `memory-ledger-refused` (`E_NO_PERSISTENT_PATH`), `memory-allowed-for-fixtures`.
- **Change:** `ledger.mjs` — four tables (`finding_occurrences`, `finding_claims`, `finding_receipts`, `retry_reservations`) and methods `recordFindings`/`listOpenFindings`/`lineage`/`getOccurrence`/`claimFinding`/`acknowledgeFinding`/`recordFixResponse`/`revokeClaim`/`recordReceipt`/`recordClosure`/`reserveRetry`/`close`; every mutation transactional. `service.mjs` — persistence guard (`allowMemoryLedger` fixture flag; a service without a durable path refuses `E_NO_PERSISTENT_PATH`) and `close()` now checkpoints the ledger.
- **Verification:** finding-lifecycle 17/17, service 18/18, full sweep 12 suites / 221 arms green; battery green.
- **Remaining limitation:** the queue/priority/pagination layer (packet increment 7), the outbox consumers for finding events (increment 5) and the CC adapter (increment 6) are not wired to these tables yet; V2 finding field spelling waits on the schema pin. This increment proves the durable lifecycle mechanics.

## A3 (follow-up packet 2026-10-06, increment 3) — DotPRReviewV2 semantics behind the pinned schema

- **Contract:** CONTRACT_READY receipt from the docs lane (PR #2058, head 47f34a3bcc): schema `dot-review-result-v2.schema.json` sha256 `b110a641…` + 13 published records with an expectation table; spec digest `88b0deb8…` byte-verified against the operator-approved embedded copy. The bytes are PINNED under `tests/dot-review-gate/fixtures/v2/` — field spelling stays owned by the versioned schema; the mechanism lane invents nothing.
- **Regression:** `validate-report.test.sh` +12 arms: the pin-integrity arm (fixture = receipt bytes; when the canonical file lands in-tree, byte-identity is enforced), the independent re-execution of all 13 published records against their own expectations, missing-dimension invalidity (schema-blind), UNVERIFIED-dimension-forces-PARTIAL, the authorizing predicate (GO ∧ COMPLETE ∧ SUFFICIENT ∧ no blocking), tuple drift and inventory both directions over the V2 identity/scope fields. `service.test.sh` +5 arms: V2 records end-to-end — stitched envelope 422, REVISE/INSUFFICIENT accepted → one named failure check, a fully qualifying V2 GO authorizes exactly one success check on M.
- **Change:** `validate-report.mjs` — dispatch on `protocol_version: dot-pr-review/2.0.0` into `validateV2Report` (pinned schema compile cache, seven role dimensions, tuple/inventory over `review_identity`/`scope`, V2 authorizing predicate); the V1 path never sees V2 records and vice versa. `intake.mjs` — V2 envelope binding via `review_identity.assignment_id`; ledger TEXT normalization (verdict object → JSON, `record_type` → kind). `service.mjs` — `schemaBytesV2` wiring; PR-number resolution reads V2's nested identity; drain results carry the refusal reason. `publisher.mjs` — tuple state protocol from the loaded policy; the authorizing refusal message comes from the validator's marker. `load-policy.mjs` — `SUPPORTED_PROTOCOLS` (both eras; the policy declares which it runs).
- **Verification:** validate-report 54/54, service 23/23, full sweep 12 suites / 238 arms green; battery green.
- **Remaining limitation:** V2 finding→ledger wiring (finding_ids → `recordFindings`), the fix_response/closure_receipt record types into the lifecycle tables, and queue/adapter work are later packet increments; the pinned copies converge with the canonical files at the merge-forward (byte-identity arm enforces it).

## Reviewer process observations — implementation side

- The reviewer's demanded ordering (harness first, then regressions, then boundaries, then composition) was followed; every regression above was watched RED against the pre-fix module before the fix (per-finding RED receipts in the session ledger `.superpowers/sdd/2026-10-05-dot-staging-review-gate-junior-prompt/progress.md`).
- Modules are no longer "prototype" in the composition sense: a credential-free end-to-end service exists and is pinned by tests. Live validation (S0), negative live matrix (S4 rows marked BLOCKED) and staging enforcement (S5) remain open and operator-gated; nothing here claims them.

## Round 2 (packet 2026-10-06) — verified defects DR-R1–DR-R5, V2 extras, increments 5–9, validate-only CLI

Scope: the continuation packet's five verified defects, two V2 extras, increments 5–9 and the validate-only item. Same discipline: every fix RED-first (quoted failure), paired-negative arms name the single property under test (T22 isolation), full sweep green per stage. Commits: `dbd17c8abca` (DR-R1), `a68cc47acf2` (DR-R2), `2d93f60a711` (DR-R3), `f74339c90cd` (DR-R4), `0d8f89e9ff6` (DR-R5), `b129ff17def` (V2 extras), `a515e932329` (inc 5), `3df17e447a5` (inc 6), `2fd90c475b0` (inc 7), `a6b27d420c4` (inc 8), `e41356473be` (inc 9), `0a7663e7eb0` (gatectl).

### DR-R1 — closure evidence could be stale, self-authored or irrelevant

- **Defect:** closure to VERIFIED accepted evidence unrelated to the fix revision (pre-fix successes, the fix owner reviewing their own work, missing dot_closure receipt).
- **Change:** `ledger.mjs` `closureTx` (shared by `recordClosure` and the inc-5 `applyClosureReceipt`) now binds the evidence set to the LATEST fix_response: a successful check receipt ON the fix revision AFTER the fix; an independent change review (actor ≠ fix owner, after the fix, on the fix revision); a dot_closure receipt. ALREADY_FIXED requires a successful check; NOT_APPLICABLE / REJECTED_WITH_EVIDENCE require evidence receipts; a second fix invalidates the earlier evidence set.
- **Regression:** finding-lifecycle +12 arms (`verified-requires-*`, `stale-review-before-fix-refused`, `self-review-refused`, `second-fix-invalidates-evidence`, `already-fixed-*`, `rejected-*`); isolation per T22 — every arm carries change_review + dot_closure so only the property under test differs.
- **Verification:** finding-lifecycle 42/42.
- **Remaining limitation:** check/actor identity binds ledger receipts; that receipts correspond to real GitHub objects is live-matrix material.

### DR-R2 — corrective ownership was per-occurrence, so recurrence escaped the fence

- **Defect:** a claim fenced one occurrence; a recurrence of the same finding opened a second claim for the same PR (two concurrent fixers), and cessation on expiry released only one slot.
- **Change:** occurrences carry `repository_id` + `pr_node_id` derived from the issuing generation; `claimFinding` fences scope-wide (any live claim in the scope refuses `E_ALREADY_CLAIMED`); recurrence rebinds the active claim to the newest occurrence; scopeless fixture rows keep the per-occurrence fence.
- **Regression:** finding-lifecycle +7 arms (`pr-scope-single-owner`, `cessation-scope-wide`, `revoke-frees-whole-scope`, `cross-pr-not-fenced`, `fence-survives-reopen`, `claim-follows-recurrence-tail`, `recurrence-claim-refused`).
- **Verification:** finding-lifecycle 42/42; the DR-R2 cessation arm initially passed for the wrong reason (the claimant's own expired lease) — fixed by the scope-wide fence, after which the arm cascade disappeared.
- **Remaining limitation:** none offline.

### DR-R3 — rejection from admission destroyed correctly-issued late reports

- **Defect:** a report submitted after the tuple moved hit the admission path's refuse and was lost — no history, no replay, no receipt.
- **Change:** `ledger.submitReport` validates against the ISSUED generation tuple: a moved tuple stores the report as superseded history (`superseded_at`, `admission: false`, envelope bytes + digest + `received_via` provenance) and returns a receipt; replay returns the existing receipt; the lease is checked only when the tuple is current.
- **Regression:** intake `submit-tuple-drift-archived-as-history` + `envelope-bytes-and-provenance-stored`; service `late-report-persisted-as-history`, `replay-after-movement-existing-receipt`, `archived-record-never-publishes`, `forged-still-rejected-after-movement`; ledger replay arms.
- **Verification:** intake 19/19, service 34/34, ledger 30/30.
- **Remaining limitation:** none offline.

### DR-R4 — V2 documents validated without the pinned schema bytes

- **Defect:** a schema-less V2 document could reach validation; service startup accepted a V2-era policy without the pin; publication did not require the bytes.
- **Change:** `validate-report.mjs` refuses schema-less V2 validation (`E_SCHEMA`); `service.mjs` startup requires `schemaBytesV2` for V2-era policy (`E_CONFIG`); `publisher.mjs` threads the bytes through load/publish (`E_CONFIG` on absence); CLI `--schema-v2`.
- **Regression:** validate-report `v2-missing-schema-bytes-refused`, `v2-cli-without-schema-refused`, `v2-cli-with-schema-accepts`; service `v2-era-startup-requires-pin`; publisher `v2-schema-less-publication-refused`, `v2-publisher-publishes-with-pin`.
- **Verification:** validate-report 58/58, service 34/34, publisher 18/18.
- **Remaining limitation:** the pin's byte-identity against the canonical schema is enforced by the `v2-schema-pin-integrity` arm at the merge-forward.

### DR-R5 — publication identity and drain concurrency

- **Defect:** the external check-run id was derived from report top-level fields (conclusion change reused the id, colliding histories); discovery failures were swallowed as "not found"; concurrent drains could double-hand outbox items; wording claimed exactly-once.
- **Change:** identity is intent-bound: `sha256(payloadDigest:generation:policySha:mergeSha:conclusion)` — a conclusion change gets a fresh id by construction; check-run reuse requires the SAME conclusion; discovery tolerates only 404; POST read-back verified (`E_PUBLISH_UNVERIFIED`); `outboxClaimBatch` is a claim-lease RESERVATION (disjoint batches, restart-persistent); docs say at-least-once.
- **Regression:** publisher `failure-never-reuses-success`, `go-never-reuses-failure`, `v2-crash-retry-idempotent`, `discovery-failure-refuses`, `publication-read-back-verified`, `read-back-mismatch-refused`; service concurrent-drain arms; ledger `concurrent-drain-reserved`, `stale-lease-recovered`.
- **Verification:** publisher 18/18, service 34/34.
- **Remaining limitation:** read-back against the real Checks API is live-matrix material.

### V2 extras (packet) — HISTORICAL never authorizes; envelope bytes stored

- **Change:** the V2 authorizing predicate requires `review_identity.mode === 'OPEN_PR'` (HISTORICAL with a qualifying verdict still refuses — `E_KIND_RECAST`-family marker); intake stores the original bounded (≤1 MiB) envelope bytes with digest + `received_via`.
- **Regression:** validate-report `v2-historical-qualifying-not-authorizing`; intake `envelope-bytes-and-provenance-stored`.
- **Remaining limitation:** none offline.

### Increment 5 — V2 records reach the lifecycle through real consumers

- **Change:** `service.mjs` drain routes by `record_type`: review_report findings → `recordFindings` (published AND superseded); fix_response/closure_receipt → ledger apply methods binding by assignment+owner (`E_FENCING` revoked / `E_IDENTITY` wrong owner / `E_LIMITS` key mismatch; closure maps RESOLVED→VERIFIED through the shared `closureTx` gate); unknown events stay pending `unhandled`.
- **Regression:** service +5 arms (`v2-findings-enter-lifecycle`, `superseded-findings-recorded-as-history`, `v2-fix-response-consumed`, `v2-closure-receipt-consumed`, `unknown-events-stay-pending`); finding-lifecycle +6 consumer arms.
- **Remaining limitation:** publication read-back closure (`E_PUBLISH_UNVERIFIED`) is publisher-level, not a lifecycle transition.

### Increment 6 — CC adapter over the destination's real coordination channel

- **Probed destination (2026-10-06):** `~/.claude-coordination/<project>/` with `_handoff-<sessionId>.md` `Read when:` convention (161 live files), osascript notify (merge-lock-watcher convention), session UUIDs.
- **Change:** `cc-adapter.mjs` — INTENT row in the ledger BEFORE delivery; atomic `_dot-gate-msg-<id>.md` write; ACK via `_dot-gate-ack-<id>.md`; idempotent recovery; replacement held while the previous claim is live or expired-unrevoked (`E_CESSATION_UNKNOWN`); notify failure non-fatal.
- **Regression:** cc-adapter.test.sh (new 13th CI line, 12 arms).
- **Remaining limitation:** a real cross-session wake (the file actually pulling a session back) is live-enrollment material.

### Increment 7 — persistent work queue in the protocol's priority order

- **Change:** `queue.mjs` — buildQueue in protocol §3 order (verify oldest first → qualifying open non-draft PRs by ready-then-number → unreviewed merged newest first; blocked items visible with reason); durable `work_claims` reservations (disjoint batches, restart-persistent, lapsed leases recover); `gateHistorical` revalidates a finding before any fix launch (already-fixed → ALREADY_FIXED, no launch).
- **Regression:** queue.test.sh (14th CI line, 11 arms).
- **Remaining limitation:** qualification of "qualifying PR" against live GitHub state is adapter input, live-gated.

### Increment 8 — finite dispatch budgets with pre-inference reservations

- **Change:** `budgets.mjs` — REQUIRED_LIMITS missing disables unattended dispatch (`E_LIMITS_MISSING`); reservations persist BEFORE model invocation (`launch:<window>` / `fix:<occurrence>` / `prchurn:<pr>` in retry_reservations); window rolls; bursts coalesce; quota pause distinct from the operator pause; `shouldLaunchCronTurn` refuses an empty turn.
- **Regression:** budgets.test.sh (15th CI line, 15 arms; `reservation-precedes-invocation` — the launch spy never fires past the bound).
- **Remaining limitation:** the limits themselves are operator-configured; no defaults are invented.

### Increment 9 — durable managed-PR registration, merge default off

- **Change:** `registration.mjs` + `pr_registrations` table — armed-state reconciliation completes BEFORE registration issues (armed → disarm; unknown → `E_ARMED_UNKNOWN`, no row: `getRegistration() === undefined` is the admission hold); registration unique per PR, restart-persistent; merge DEFAULT OFF — enable/release require an explicit recorded operator transition; `executorGuard` refuses executor merge/arm (`E_SELF_MERGE`).
- **Regression:** registration.test.sh (16th CI line, 12 arms).
- **Remaining limitation:** the native probe/disarm against real GitHub is a live acceptance requirement (packet's own wording).

### Validate-only control surface (packet item)

- **Change:** `gatectl.mjs` — `validate` (policy fail-closed, schema-pin verified against ACTUAL bytes `E_SCHEMA_PIN`, ledger open+migrate, queue build, dispatch-budget status; ZERO transport calls, ZERO model launches — spy-counted in the summary), `pause`/`read`/`recover` offline, `start` refuses without `--allow-live` (`E_VALIDATE_ONLY`) and reports live start `E_LIVE_UNENROLLED`.
- **Regression:** gatectl.test.sh (17th CI line, 9 arms).
- **Remaining limitation:** everything here is offline/ASSISTED — a real unattended Dot launch/export is unproved (packet wording: record ASSISTED until proved live).

### Cold-review fix pass (packet increment 12, 2026-10-06) — `020e7a2de92`

An independent cold reviewer (separate read-only session, brief = the defect/increment claims only, no diff narrative) ran the 17 suites read-only and returned 10× FIXED-VERIFIED, inc 9 PARTIAL, gatectl verified-with-gap, 2 Important + 5 Minor findings, 5 test-gaps. Graded by effect; Critical/Important → one fix pass (RED-first each); minors graded and dispositioned:

- **Fixed — Important (drain effect-dropping):** a superseded fix_response/closure_receipt was archived with its lifecycle effect silently dropped (`service.mjs` superseded branch fired before the record consumers). One consumer (`consumeLifecycleRecord`) now serves both paths; the closure gate, not the drain, refuses unproven evidence. RED: `superseded-fix-record-still-consumed` (`entry=[["report.submitted","archived"]] tail=OPEN` → GREEN `fix-recorded`, occurrence VERIFYING).
- **Fixed — Important (merge gate unread):** `merge_enabled` was written by the operator transition but read by nothing — merge default OFF was a stored bit. `executorGuard` gates merge/arm twice: the executor NEVER (`E_SELF_MERGE`, identity checked first — the permanent property), and even the registered coordinator is held until the transition (`E_MERGE_DISABLED`). RED: the two coordinator-while-disabled arms; GREEN: 4 new arms (`coordinator-merge-refused-while-disabled`, `coordinator-arm-refused-while-disabled`, `coordinator-may-merge-after-transition`, plus the retained `coordinator-may-arm`).
- **Fixed — Minor (comment overclaim):** the cron-guard comment claimed signals it does not read; corrected (under-launches, never over-launches).
- **Fixed — test-gap:** `window-bound-survives-restart` (the window bound itself across reopen; previously only the churn counter was restart-tested).
- **Fixed — live-caught:** principle 47's arm flagged `gatectl.mjs`'s naive `import.meta.url` vs `argv[1]` compare during the battery; replaced with the sanctioned `isMainEntry`.
- **Deferred — Minor (V2 pin absent):** the policy carries only the V1 `schema_sha256`; V2 bytes are presence-checked and digested but never pinned against policy. The V2 policy field belongs to the trusted-policy surface (docs lane owns the template); the in-repo V2 bytes are pinned by `v2-schema-pin-integrity` at the merge-forward. Cost if wrong: tampered out-of-repo V2 bytes validate records until the merge-forward pin check.
- **Deferred — Minor (window budget on refused launch):** the launch-window counter is consumed before churn reservations refuse — conservative direction (under-dispatch only).
- **Deferred — Minor (actor assertions):** DR-R1 independence rests on caller-asserted `actor` in finding_receipts — weaker than submitReport's challenge binding; the trust root is ledger write access (same class as the round-1 receipts limitation).
- **Deferred — Minor (stale ASSIGNED occurrence):** after a rebind the old occurrence keeps ASSIGNED; inflates open-findings counts (cron guard under-signals idle).
- **Noted (test topology):** `concurrent-drains-single-check` uses stub transports without shared check-run state — a shared transport would be stricter; flagged, not rebuilt.

## Round 3 (packet 2026-10-06) — SP-1–SP-7, ST-1, Dot D2065-S03, packet lifecycle cases, bounded-runtime runner

Scope: the operator packet's repair items SP-1–SP-7, the ST-1 runtime wiring, the Dot-side aggregate-mechanical-evidence disposition (Dot D2065-S03 → SP-7) and the packet-mandated lifecycle cases. Same discipline: every fix RED-first (the RED observation is quoted in its commit message), paired-negative arms name the single property under test (T22), full 18-suite sweep green per stage. Merge stays OFF; the round's Dot record is ASSISTED/offline — Codex owns external capture/export, Claude Code owns receiving, routing and correction; nothing here claims live validation or production autonomy. Commits: `1517574599c` (SP-1), `f75135eb5d9` (SP-2), `8004dbc7ded` (SP-3), `494d7f2aa27` (SP-7 / D2065-S03), `fba0b396794` (SP-4), `8b964cdc142` (SP-5/ST-1), `72502c270de` (SP-6), `ad3132488e9` (packet cases), `16b93282e7d` (runner).

### SP-1 — V2 fix/closure records entered intake without record-specific binding

- **Defect:** any well-formed V2 `fix_response` / `closure_receipt` traversed intake regardless of whether the referenced assignment/finding existed, was revoked, or belonged to the submitting actor — binding was deferred entirely to the ledger consumers.
- **Change:** `intake.mjs` dispatches per `record_type`: a fix_response must bind a LIVE assignment (exists, not REVOKED, actor = assignment owner); a closure_receipt's `finding_ids` must resolve; the review_report keeps its `review_identity` binding. `ledger.mjs` exposes the read-side lookups the checks need.
- **Regression:** intake +8 arms: `v2-fix-response-traverses-intake`, `v2-fix-response-replay-same-receipt`, `v2-fix-wrong-actor-refused`, `v2-fix-unknown-assignment-refused`, `v2-fix-revoked-assignment-refused`, `v2-closure-receipt-traverses-intake`, `v2-closure-unknown-finding-refused`, `v2-review-report-identity-kept`.
- **Remaining limitation:** none offline; assignment/finding identity against real GitHub objects is live-matrix material.

### SP-2 — record consumers could substitute declared evidence for real receipts

- **Defect:** the fix_response's independent change review and the closure_receipt's evidence were consumed as narrative — no REAL review/evidence receipts were minted, so a record could carry a fix to VERIFYING without any independent review existing, and a closure could be attempted on unproven evidence by the executor itself.
- **Change:** `service.mjs` `consumeLifecycleRecord` records the fix record's independent change review and the closure record's evidence as genuine `finding_receipts` before the lifecycle transition; `ledger.mjs` authenticate/apply paths preserve the receipt chain — the closure gate (unchanged) then refuses what the receipts do not prove.
- **Regression:** service +4 arms: `fix-record-carries-independent-review` (the review receipt exists and is independent), `unproven-closure-stays-pending` (a closure record without the required receipts leaves the occurrence open, the event stays pending), `executor-self-closure-refused`, `v2-closure-record-resolves-lineage` (a fully evidenced closure record resolves through the shared gate).
- **Remaining limitation:** receipt actor identity binds ledger-side assertions (same trust root as the round-2 receipts limitation); live actor binding is enrollment material.

### SP-3 — the operational V2 schema was presence-checked, not pinned

- **Defect:** after DR-R4 the V2 bytes had to EXIST, but nothing bound their CONTENT: a V2-era policy could run against permissive schema bytes (`{"type":"object"}`) at validation, startup, gatectl and publication.
- **Change:** the trusted-policy template gains `schema_v2_sha256`; `validate-report.mjs` computes sha256 over the provided V2 bytes and refuses a mismatch (E_SCHEMA_PIN_V2, distinguishing an absent pin from a wrong pin); `service.mjs` refuses a V2-era startup whose pin differs from the started bytes (E_CONFIG); `gatectl.mjs` refuses at validate time (E_SCHEMA_PIN, absent-pin and mismatch messages distinct) and a V2-era policy without bytes; `publisher.mjs` inherits the refusal through `validateReport`.
- **Regression:** validate-report `v2-policy-schema-pin`; service `v2-era-startup-wrong-bytes-refused` (alongside the round-2 `v2-era-startup-requires-pin`); gatectl `validate-v2-pin-mismatch-fails-closed`, `validate-v2-era-without-v2-bytes-refused`, `validate-v2-pin-canonical-passes`; publisher `v2-publication-wrong-bytes-refused`. Policy template + intake fixture updated with the real V2 digest.
- **Remaining limitation:** the pin's byte-identity against the canonical in-tree schema stays enforced by `v2-schema-pin-integrity` at the merge-forward (round-2 arm, unchanged).

### SP-7 / Dot D2065-S03 — mechanical evidence aggregated across contexts, not by identity

- **Defect:** closure evidence could be satisfied by ANY single successful check — a passing unrelated context masked a failing or missing required one, and there was no notion of "the latest result of each required context".
- **Change:** `ledger.mjs` `closureTx` takes `requiredContexts` (the trusted set = policy `mandatoryMechanical` head-bound contexts, threaded from `service.mjs`) and evaluates the LATEST receipt per context on the fix revision (last-write-wins over the ordered evidence list): every required context must have a success ON the fix revision; a missing context refuses naming it; a stale fix revision refuses; supersession within one context is last-write-wins. A policy without required contexts configures an empty set and refuses (`sp7-missing-requiredcontexts-config-refused`).
- **Regression:** finding-lifecycle +7 arms: `sp7-mixed-order-a-refuses-failing-required-check` (the RED: mixed-order evidence with a failing required check resolved before the fix), `sp7-mixed-order-b-refuses` (order-independence of the refusal), `sp7-all-required-success-resolves`, `sp7-missing-required-context-refuses`, `sp7-same-context-supersession-resolves`, `sp7-stale-revision-refuses`, `sp7-missing-requiredcontexts-config-refused`; service consumer composition: `sp7-consumer-mixed-contexts-refuses`, `sp7-consumer-all-required-success-resolves`. Fixture note: `SELECT *` does not return the implicit rowid — "latest" is last-write-wins over the insertion-ordered evidence list.
- **Remaining limitation:** receipt contexts are ledger-side identities; their correspondence to real check-run contexts is the readiness/publisher live surface (S0/S4).

### SP-4 — durable eligibility was absent at the publication and arming boundaries

- **Defect:** a later GO could publish over an open blocking finding's lineage, and arming consulted only the reviewed bytes and protections — the durable journal and the registration receipt (merge DEFAULT-OFF) were witnesses at neither boundary.
- **Change:** `ledger.mjs` `openBlockingFindings(repositoryId, prNodeId)`; `publisher.mjs` `publishAdmission` refuses on open blocking lineage (E_OPEN_BLOCKING, naming the keys — a failure publication is never held); `armer.mjs` `armAutoMerge` takes the ledger and composes: required-ledger present (absent = E_CONFIG hold), open blocking lineage (E_OPEN_BLOCKING), ACTIVE registration receipt (absent/released = E_UNREGISTERED), recorded operator enablement (E_MERGE_DISABLED) — all BEFORE the GraphQL mutation.
- **Regression:** publisher `open-blocking-lineage-holds-publication`; service `sp4-open-blocking-lineage-holds-publication` (a later GO over open F-901 keeps the event pending); armer `arming-without-journal-refused`, `open-blocking-lineage-holds-arm` (`/F-ARM/` named), `unknown-registration-holds-arm`, `merge-disabled-holds-arm`, `released-registration-holds-arm`. Fixture sharp edge noted below.
- **Remaining limitation:** the registration receipt's reconciliation against real armed state is the round-2 inc-9 live acceptance item (unchanged).

### SP-5 / ST-1 — CC action recovery was idempotent but payload-blind

- **Defect:** recovery re-delivered an INTENT without its original bounded payload (a `{recovered:true}`-class stub could stand in for real content), the recovered count reported the wrapper's `.length` (undefined), and re-delivery had no durable retry budget — a poison action could loop forever.
- **Change:** `ledger.mjs` `coord_actions.payload_text` (added via `ensureColumn`, bounded at 64 KiB, E_LIMITS beyond) stored with a digest at dispatch time; `cc-adapter.mjs` recovery re-renders the ORIGINAL payload after digest verification (a mismatch holds, E_DIGEST — never re-delivers suspect content), under a PERSISTED per-action retry budget (`maxRecoveryAttempts`, `reserveRetry`; exhaustion = named hold, E_BUDGET); `gatectl.mjs` reports `recovered_deliveries: recovered.recovered.length` (the true count).
- **Regression:** cc-adapter +4 arms: `recovery-restores-original-payload`, `recovery-retry-budget-holds`, `crash-after-write-preserves-content` (the payload_text is durable before delivery — a crash between write and delivery loses nothing), `wrong-ack-content-not-acked`; gatectl `recover-sp5` (`"recovered_deliveries": 1`) + `recover-restores-original-payload` (the recovered file carries the original instruction text).
- **Remaining limitation:** a real cross-session wake is live-enrollment material (round-2 inc-6 limitation, unchanged).

### SP-6 — closure accepted stale or non-affirmative resolutions

- **Defect:** closure evaluated the review verdict but not its CURRENTNESS or AFFIRMATIVENESS: an older positive review survived a newer REVISE, opaque verdicts counted, an anonymous success could stand in for a decision, and REJECTED/NOT_APPLICABLE dispositions needed no evidenced principal.
- **Change:** `ledger.mjs` — `AFFIRMATIVE_REVIEW_VERDICTS = ['GO','RESOLVED','APPROVED','SATISFIED']`; `closureTx` requires the LATEST independent change review's verdict to be affirmative and the LATEST dot_closure disposition to be `VERIFIED` with no unresolved blockers (absence = legacy/minted shape → hold); ALREADY_FIXED binds a concrete check identity (context + revision); REJECTED / NOT_APPLICABLE require an evidenced actor receipt.
- **Regression:** finding-lifecycle +11 arms: `sp6-revise-change-review-holds-closure` (the RED: a newer REVISE over an older GO held closure before the fix), `sp6-decision-required-dot-closure-holds`, `sp6-opaque-verdict-holds-closure`, `sp6-not-applicable-dot-closure-holds`, `sp6-unresolved-blockers-hold`, `sp6-newer-negative-invalidates-older-positive`, `sp6-affirmative-controls-resolve` (control: the affirmative verdict resolves once current), `sp6-already-fixed-binds-check-identity`, `sp6-already-fixed-identified-check-resolves`, `sp6-rejected-requires-principal`, `sp6-rejected-signed-review-resolves`.
- **Remaining limitation:** verdict semantics are ledger-side enumerations; real review verdicts arrive through the live intake surface.

### Packet-mandated lifecycle cases — coherent fixes, scope release, recurrence rebind

- **Change:** `ledger.mjs` `applyFixResponseRecord` accepts a `targets` array — ONE coherent fix response applies to EVERY named finding key within the assignment's PR scope (scope-checked: E_LIMITS/E_NOT_FOUND per key, `applied` returns the covered keys); `closureTx` releases the scope's claims (ASSIGNED/ACKNOWLEDGED → REVOKED, scoped and scopeless rows) on any successful resolution; a scoped recurrence during VERIFYING rebinds the active claim to the newest occurrence (DR-R2 composition, now pinned).
- **Regression:** finding-lifecycle +3 arms: `coherent-fix-covers-several-findings`, `final-closure-releases-scope`, `scoped-recurrence-during-verifying-rebinds`.
- **Remaining limitation:** none offline.

### Bounded-runtime runner — the exports had no common operational consumer

- **Gap (packet):** "connect the actual bounded runtime" — queue, budgets, registration, the CC adapter and the ledger each worked alone; no deterministic one-cycle consumer existed.
- **Change:** `runner.mjs` `runCycle` — discovery → check qualification (`buildQueue`) → per-item registration/ownership (an unregistered PR holds, E_UNREGISTERED — work stays queued and visible) → historical revalidation (`gateHistorical` before any fix launch) → PERSISTED budget reservation (`budgets.reserveLaunch`) BEFORE the coordination dispatch → ACK observation → injected receipt intake (the SAME outbox consumer the service drains) → budget-bounded recovery. Everything destination-specific is dependency-injected (`discover`, `isQualifying`, `drain`, `revalidateFinding`); counters are observed, not fabricated; dispatch is a coordination message to a Claude Code session — never a model launch, never a merge. `gatectl start` distinguishes E_NO_RUNNER (named runner absent on disk) from E_LIVE_UNENROLLED.
- **Regression:** `runner.test.sh` (new, 18th CI line, 8 arms): `cycle-empty-destination-observed-zeros`, `unregistered-pr-holds-at-runtime`, `registered-pr-dispatches-with-reservation`, `exhausted-window-bound-holds-second-pr` (the persisted per-window bound holds a FRESH registered PR in the same window), `ack-observed-by-next-cycle`, `missing-limits-disable-handout`, `historical-already-fixed-launches-nothing` (superseded generation + `revalidateFinding: → false` records ALREADY_FIXED, launches nothing), `recovery-composes-through-cycle` (a stranded INTENT re-delivered with its ORIGINAL payload by the cycle); gatectl `start-runner-missing-is-not-unenrolled`; armer `v2-record-refused-historical-compat` (the armer's V1 admission shape is RETAINED historical compatibility — a V2 record refuses it; active V2 merge authority flows through the SP-4 registration receipt).
- **Remaining limitation:** everything is offline/ASSISTED — enrollment, live destination wiring and a real unattended run remain operator-gated; the runner composes the same injected seams the suites pin.

### Process notes (round 3)

- **TDD incident, self-caught:** `runner.mjs` was written before its test was watched RED — removed, `runner.test.sh` written, `ERR_MODULE_NOT_FOUND` observed RED, module restored. The Iron Law holds.
- **Fixture sharp edge:** `insertRegistration` requires `reconciledAt` — a registration row without it fails at bind time with a bare SQLite parameter error rather than a named code. Every fixture now passes it; a named E_ code at the ledger boundary would be the cleaner contract (deferred — cosmetic).
- **Hang diagnosis recipe (reused from round 2):** a suite that "hangs" is a leaked server or a crashed arm inside `out="$(node …)"` buffering; extract the heredoc and run node directly to stream.
- **Suite counts this round:** the round-3 additions grew the sweep from 353 arms / 17 suites (round-2 receipt) to 421 arms / 18 suites (the cold-review fix pass below added 5 arms); the new 18th CI line is `runner.test.sh`; assert-list totals per suite are in the verification base above. Where a suite's logged `ok` line count exceeds its assert list, the assert list is the receipt (the harness enforces the exact set).

### Round-3 cold-review fix pass (packet increment 12, 2026-10-06)

An independent cold reviewer (separate read-only session, brief = the nine round-3 claims ONLY, no diff narrative) ran all 18 suites fresh (18/18 exit 0, no leaked processes), attempted its own falsifications per claim, and returned: nine claims NONE REFUTED (SP-1..SP-5, SP-7, packet cases, runtime FIXED-VERIFIED; SP-5/ST-1 PARTIAL on one sub-property), plus 2 Important + 4 Minor findings. Graded by effect; both Importants + the mechanically-real Minors entered ONE fix pass, each arm mutation-verified (the gap arms were proven RED by neutering the mechanism they protect, then GREEN after restore):

- **Fixed — Important (untested E_DIGEST hold, cc-adapter.mjs:113-118):** recovery's digest-verification branch had NO executable arm — deleting the check left all 18 suites green while a corrupt stored payload would be delivered as instructions. New arm `recovery-digest-mismatch-holds` tampers `coord_actions.payload_text` via a raw SQLite connection without touching the digest and asserts the row STAYS INTENT with the digest hold named and no file delivered. Mutation check observed: neutered → `FAIL digest hold DELIVERED/null`; restored → green.
- **Fixed — Important (failure-path resource leak, service.test.sh):** every `svc.close()` was inline in the try body with no finally — any mid-suite throw after a service started leaked the intake HTTP server, and the node child never exited (the exact hang class that cost real time in rounds 2–3). `newService` now tracks every created service and wraps close to be idempotent; the outer `finally` closes all tracked services. Mutation check observed: an injected mid-suite throw failed the suite in 0.38 s (previously: an open-server hang), FAIL recorded, child exited.
- **Fixed — Minor (dead OAuth-state TTL, intake.mjs:89-90):** `states.delete(state)` ran BEFORE `states.get(state)`, so the TTL branch could never fire and never-consumed states accumulated forever. Reordered (read → TTL check deletes on expiry → delete-on-consume) and expired states are swept on each `/oauth/start` — the Map stays bounded. One-use semantics preserved (intake OAuth arms green).
- **Fixed — Minor (armer state check was not an allowlist, armer.mjs):** only `state === 'RELEASED'` refused; any unknown future state string would have PASSED the eligibility gate (fail-open). Now `state !== 'ACTIVE'` refuses; new arm `unknown-registration-state-holds-arm` pins an unknown string holding.
- **Fixed — arm-coverage gaps (Minor F6):** `start-allow-live-still-unenrolled` (the `E_LIVE_UNENROLLED` fallback is load-bearing — pinned), `drain-step-observed` (the runner's injected receipt-intake step is counted, not swallowed), the unregistered-hold arm now also asserts the work stayed QUEUED and visible, and the SP-6 NOT_APPLICABLE disposition got its paired arms (`sp6-not-applicable-closure-requires-principal` / `sp6-not-applicable-signed-review-resolves` — mirroring the REJECTED pair).
- **Deferred — Minor (documented trade-off):** the SP-6 "latest independent review must be AFFIRMATIVE" leg is vacuous on today's real V2 path — the pinned V2 `change_review_receipt` schema has no `verdict` property, so minted receipts carry none and the affirmative check passes vacuously; the load-bearing affirmative assertion is the dot_closure leg (disposition VERIFIED + no blockers), which is non-vacuous. Cost if wrong: a verdict-carrying negative review would hold closure, but a verdict-less one cannot be distinguished — the fix belongs to the docs lane's schema (field spelling is owned by the versioned schema, not this lane). Already documented in `ledger.mjs` at the check.
- **Deferred — Minor (cosmetic):** `insertRegistration` requires `reconciledAt`; a missing one fails at bind time with a bare SQLite parameter error rather than a named E_ code (fixtures all pass it).

Post-fix sweep: 18/18 suites green, 421 arms (armer 19, cc-adapter 17, finding-lifecycle 65, gatectl 16, runner 9).

