# Dot gate — negative matrix coverage receipt (S4, offline)

> **Date:** 2026-10-05, regenerated after the R1–R11 repair. Status: offline rows covered by paired-negative suites in this branch; live rows BLOCKED pending the operator authorizations in [handoff §5](dot-review-handoff.md).
> **Authoritative for:** which [spec §10](../superpowers/specs/2026-10-05-dot-staging-review-gate-design.md) acceptance rows have a local executable proof, and which wait for live validation.
> **NOT authoritative for:** live GitHub/Dot behavior — a local green suite does not prove native merge admission ([S0 patch](research-patches/2026-10-05-dot-gate-s0-platform-evidence.md) §9).
> **T3 form:** every row names its test + arm. Suites: `bash scripts/dot-review-gate/<name>.test.sh` — 11 suites, 197 arms, all GREEN in one sweep on 2026-10-05 (post-repair; per-finding record: [repair record](dot-review-gate-repair-record.md)).

## Offline rows (proved locally)

| Spec §10 case | Proof (suite → arm) |
| --- | --- |
| Duplicate JSON keys / oversized / deep payload rejected | strict-json → `dup-top`, `size-over`, `depth-65`; validate-report → `dup-key-raw` |
| Prototype-shaped JSON (`__proto__`) rejected, nothing inherits | strict-json → `proto-root`, `proto-nested`, `proto-report-wrap`, `null-proto-root`, `null-proto-nested`, `no-inherited-props`, `roundtrip`; validate-report → `proto-key-raw` |
| Missing, malformed, INCOMPLETE, REVISE, STOP, execution failure → not authorizing | validate-report → `go-with-incomplete`, `tuple-revise-not-gate`, `failure-reason-missing`; publisher → `revise-publishes-failure`, `crashed-review-refused`, `no-record-refused` |
| GO with blocking finding / UNVERIFIED applicable / omitted file → publisher failure | schema GO-conditional (validate-report → `critical-not-blocking`); inventory gaps → `inventory-gap`, `inventory-id-unknown`, `spec-inventory-gap`, `spec-id-unknown`; coverage vs trusted diff → `zero-reviewed-rejected`, `changed-missing-trusted`, `changed-extra-unknown`, `changed-duplicate-path`, `no-inventory-fails-closed` |
| Fake comment / PR JSON file / unenrolled OAuth user → no trusted success | intake → `submit-requires-session`, `envelope-principal-binds-ledger` (authorship is the session principal, never the report's assertion); a PR-authored file has no route to the ledger |
| Same context forged by PAT / another App / Actions → wrong source | readiness → `wrong-app-published`, `spoofed-workflow-path`, `missing-run-identity`, `stale-workflow-version`; armer → `wrong-source-refused`; publisher identity is installation-token-bound (publisher → `jwt-shape`, `publish-on-current-M`); PAT cannot create check runs (Checks API, S0 §7) |
| Old challenge/report replay after new commit / force-push | ledger → `supersede-on-tuple-change`, `submit-superseded-refused` (HTTP), `tuple-drift-at-consume-refused`, `tuple-head-drift`; a challenge binds reviewer/generation/lease → `wrong-reviewer-refused`, `generation-binding-refused`, `lease-expired-refused`, `replay-by-other-reviewer-refused`, `submit-wrong-reviewer-refused`, `submit-generation-mismatch-refused`, `submit-inner-mismatch-refused` |
| Retarget away/back, close/reopen, policy promotion → fresh generation | ledger → the five `tuple-*-changes-generation` arms, `terminal-reopen-new-epoch`, `challenge-verifies-stored-tuple`, `attempts-exhausted` |
| Base advances after publication → new M blocks old authorization | publisher → `stale-M-refused` (live-tuple revalidation), `head-publication-refused` (the publisher writes M only); strictness enforcement itself is native — live row below |
| Publisher asked to authorize H, or stale M supplied | publisher → the publisher has no caller-supplied validation: publication re-validates stored bytes against the LIVE tuple (`stale-M-refused`) and rechecks readiness (`red-mechanics-refused`, `spoofed-workflow-refused`) |
| Latest mechanical attempt red/cancelled/missing after earlier green — per RUN | readiness → `latest-red-after-green`, `latest-skipped`, `neutral-not-success`, `context-missing`, `older-green-newer-red`, `new-run-red-blocks-old-green`, `rerun-green-same-run`, `run-id-tiebreak` (selection is per run identity, not a bare attempt counter) |
| Red mechanics / expired authorization / pause / outage stop claims and publications | service → `red-mechanics-stop-claims`, `expiry-stops-claims`, `expiry-stops-publication`, `pause-stops-claims-and-publication`, `unpause-resumes`, `state-outage-stops-claims`, `lease-frees-claim-slot`, `startup-unresolved-policy-refused` |
| Duplicate submission / crash before-after side effects | ledger → `replay-same-receipt`, `conflict-rejected`, `outbox-dedup-and-claim`; intake → `replay-same-receipt`, `conflict-rejected`, `submit-dup-verdict-raw-rejected`; publisher → `crash-recovery-idempotent`; atomicity → `submission-outbox-atomic-on-fault` (fault-injected rollback), `restart-drains-single-publication`, `e2e-publish-once`, `re-drain-no-second-check` |
| PR modifies workflow/schema/publisher → no self-promotion | load-policy → `unresolved-schema-digest`, `missing-workflow-path`, `untrusted-workflow-path` (manifest identities are operator-promoted); publisher publishes only against validation bound to the pinned schema bytes; trust promotion is outside PR reach by construction (no PR-writable input reaches load-policy) |
| Baseline/historical GO submitted as admission | validate-report → `kind-recast-historical`, `baseline-with-M`, `admission-null-M` |
| Arming only for authorized current GO under intact protections, via the supported API | armer → `armed-once-pinned-mutation` (GraphQL `enablePullRequestAutoMerge` by node id, pinned body), `head-drift-refused`, `revise-refused`, `invalid-refused`, `pause-refused`, `nonstrict-refused`, `wrong-source-refused`, `draft-refused`, `client-allowlist-owner-repo`, `graphql-body-pinned`, `repo-format-validated`, `rearm-idempotent` |
| Restore drill (offline half) | ledger → `backup-restore-roundtrip`, `missing-backup-rejected` |
| Bound injections stay data (never executed) | strict parser/validator treat reports as data only (null-prototype objects, no eval/Function/import of report content anywhere in scripts/dot-review-gate — grep-clean) |
| The suite harness itself cannot fake green | harness → `nonzero-after-partial-success`, `real-child-exit`, `real-child-signal`, `empty-output`, `fail-token`, `missing-arm`, `unexpected-extra-arm` (exit status enforced before output filtering; exact expected arm set) |

## Live rows (BLOCKED pending authorization — handoff §5.2/§5.3 runbooks)

| Spec §10 case | What only live can prove |
| --- | --- |
| Current tuple GO + correct App on M → native squash merge succeeds | actual strict admission on the real repo objects |
| Base advance immediately after success (identical tree case) | native out-of-date + missing-M blocking on real refs |
| Two concurrently qualified PRs: A merges, B waits | real merge-forward + fresh review cycle behavior |
| Alias PRs sharing head SHA | whether per-PR M is distinct — otherwise design STOP (spec §6) |
| Revoked credentials / outage / unknown billing before authorization | platform behavior under real revocation |
| Native pause with an already-armed pending PR | real pause admission stop |
| Admin/direct-push bypass attempts | ruleset enforcement on the live settings |
| Dot unattended browser submission, enrolled identity, session renewal | actual Dot account behavior (P5/P2) |
| Reporter/publisher/armer permission boundaries on real Apps | 403 probes with real installations (P3/P8), incl. the armer's GraphQL minimum-credential proof |
| Semantic calibration with seeded defects | independent adjudication (own background agents remain banned; operator-approved route required — self-review does not satisfy it) |
