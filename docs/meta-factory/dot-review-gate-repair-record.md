# Dot review gate — repair record for review findings R1–R11

> **Status:** repair complete, 2026-10-05. 11 suites, 197 arms, all green under the repaired harness.
> **Authoritative for:** the mechanism-only repair of review findings R1–R11 (review: `docs/superpowers/plans/2026-10-05-dot-staging-review-gate-review.md`) — per finding: the reproduction, the regression evidence, the change made, the verification, the remaining limitation.
> **NOT authoritative for:** the packet documents (protocol, schema, handoff, design spec, kickoff — owned by the documentation session); live validation (S0/S4) and staging enforcement (S5) remain operator-gated; nothing here is evidence that any live proof ran.
> **Verification base:** `bash scripts/dot-review-gate/<suite>.test.sh` — 11/11 suites exit 0 in one sweep; arm counts: strict-json 25, validate-report 42, load-policy 15, readiness 20, ledger 26, intake 18, publisher 10, reporter 8, armer 12, service 11, harness 10.

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

## Reviewer process observations — implementation side

- The reviewer's demanded ordering (harness first, then regressions, then boundaries, then composition) was followed; every regression above was watched RED against the pre-fix module before the fix (per-finding RED receipts in the session ledger `.superpowers/sdd/2026-10-05-dot-staging-review-gate-junior-prompt/progress.md`).
- Modules are no longer "prototype" in the composition sense: a credential-free end-to-end service exists and is pinned by tests. Live validation (S0), negative live matrix (S4 rows marked BLOCKED) and staging enforcement (S5) remain open and operator-gated; nothing here claims them.
