# Dot review gate for staging — implementation specification

> **Status:** conditional integration design; autonomous launch BLOCKED. No gate implementation or enablement was verified.
> **Operating instructions:** [DotStagingReviewV1 protocol](../../meta-factory/dot-review-protocol.md); protocol version `dot-staging-review/1.0`.
> **Setup and evidence handoff:** [handoff](../../meta-factory/dot-review-handoff.md).
> **Date:** 2026-10-05.
> **Authoritative for:** the proposed operator-only Dot review protocol, trusted publication boundary, staging admission contract, and implementation acceptance criteria.
> **NOT authoritative for:** project goals or invariants — [README](../../../README.md#why-this-exists); existing live GitHub settings; consumer installation; production promotion.
> **Execution kickoff:** [design-to-execution stages](../plans/2026-10-05-dot-staging-review-gate-kickoff.md).

## 1. Intent, scope and decision

The operator wants autonomous substantive review before staging admission, using Dot's own subscription-backed cloud environment. Review covers project goals, every applicable principle, repository standards, originating specification, correctness and architecture. Mechanical checks run first. Dot receives no merge authority. A deterministic publisher authenticates and validates its report; GitHub's native auto-merge performs the merge.

Only COMPLETE + GO + zero blocking findings for the current revision, with every mechanical requirement successful, can authorize admission. REVISE, STOP, INCOMPLETE, execution failure, malformed, missing, untrusted or stale results block. Historical reviews cannot authorize admission. Open-PR defects remain PR findings; verified defects still present in staging become deduplicated issues.

**Recommendation:** ADAPT GitHub App check publication and native strict status-check admission; use Dot's documented cloud browser to submit to an authenticated HTTPS intake portal. Implement only the protocol validator, revision binding, queue/ledger and transport glue. Do not use a custom model endpoint or an assumed GitHub write connector.

This is a conditional engineering design, not a claim of operational readiness. The browser-to-intake route exists as a platform capability; the intake service does not exist yet. Account enrollment, permissions isolation, hosting and live merge-SHA enforcement must pass stage S0 before enforcement. If native GitHub behavior cannot satisfy the negative matrix, STOP; do not replace it with polling or a head-only success check.

No Codex/ChatGPT Work delegation, local tasks, native Codex GitHub reviews, own background agents, external model API calls, purchased credits, automatic allowance upgrades or paid fallback. No consumer capability, setup manifest change, or change to main promotion is included.

## 2. Observed current state and evidence boundaries

Read-only observations in this checkout on 2026-10-05:

| Evidence | Observation | Implication |
| --- | --- | --- |
| `git remote -v` | origin fetch `git@github.com:artyhoo/getff.git`, push `https://github.com/artyhoo/getff.git` | Actual repository is `artyhoo/getff`, not historical names in operational docs |
| `gh api repos/artyhoo/getff` | repository ID `1231007068`, owner type `User`, public, default `staging`, auto-merge and squash enabled | Public personal-account repository; branch rulesets available, queue eligibility differs |
| Same API | squash title `PR_TITLE`, message `PR_BODY` | Preserve conventional PR titles and the full body; never freeze body with `--body` at arming |
| `gh api repos/artyhoo/getff/branches/staging/protection` | `strict:false`; three required contexts below, all App ID `15368`; `enforce_admins:false`; force-push/deletion false | Current contract has no Dot requirement and permits administrator bypass |
| `gh api repos/artyhoo/getff/rulesets` | `[]` | No repository rulesets returned by this authenticated endpoint; not an organization inventory |
| `gh api repos/artyhoo/getff/git/ref/heads/staging` | `e5a795754edf5341d3b79738ec81ee783689bd50` | Observation only, not a frozen baseline |
| `git rev-parse HEAD` | `7db11c8b57ee440c1bd9b5920f8041ffb7d3c879`, branch `staging` | Checkout differs from live staging; local tests cannot establish the live baseline |
| Paginated staging check-runs | 47 GitHub Actions runs, App `15368`; one Socket Security run, App `156372` | Observed check publishers, not a complete installation inventory |
| App installation queries | repository `/installation`: HTTP 401; user `/installations`: HTTP 403 requiring App-authorized token | Full installed-App inventory and publisher availability remain UNVERIFIED |

Live required contexts: `ci-success`, `fidelity-verdict-in-pr-body`, `stale-revert-in-pr-diff`.

Local [workflow-integrity.yml](../../../.github/workflows/workflow-integrity.yml) declares six contexts. The additional declarations are `Template render probes — P1/P4/P6 (deterministic)`, `capability PR carries Prior-art line in PR body (squash-survival)`, and `§1.7 forward+backward sections present in PR description`. Reconcile this observed three-versus-six discrepancy before enforcement; do not silently drop either set. Its protection assertion explicitly warns and passes when its token cannot read settings, and accepts active rulesets without checking their contents. Its green result is not configuration proof.

[audit-self.yml](../../../.github/workflows/audit-self.yml) already has `merge_group` and the `ci-success` aggregate. Other required jobs occupy independent workflows; cross-file `needs` cannot aggregate them. [Principle 37](../../../packages/core/principles/37-required-context-completeness.test.ts) ties declarations to workflow-integrity and [the local sweep](../../../scripts/run-local-ci-sweep.sh). Extend that mechanism deliberately for an externally published check; do not invent a fictitious workflow job merely to satisfy its grammar.

[Existing automerge plan](../../meta-factory/automerge-staging-plan.md) describes strict:false throughput. This design replaces that staging admission assumption after rollout, preserving staging as trunk/default and main as manually promoted production. Reconcile its historical main-promotion commands with current [CLAUDE.md](../../../CLAUDE.md); do not execute them.

GitHub currently documents merge queue availability for public **organization-owned** repositories and eligible private organization repositories. Observed `owner.type=User` makes queue unavailable for this repository topology; no paid-plan guess is needed. Reverify owner and documentation at S0. An organization migration is a separate operator decision. [GitHub queue eligibility](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request-with-a-merge-queue).

## 3. Prior art, alternatives and real handoff

Consulted [prior-art SSOT](../../meta-factory/prior-art-evaluations.md): #38 CodeRabbit substantive pre-merge checks (DEFER), #41 Danger JS deterministic PR validation (ADOPT), #116 git-carried kickoff portability (ADAPT). Existing compliance-verifier, review-sidecar, living-docs-auditor and capability-reuse-auditor prompts are review dimensions to reuse, read directly by Dot; do not dispatch them as agents. No claim that no upstream gate exists is made. DeepWiki/context7 research was not performed; any new BUILD capability claim must complete the repository's broader prior-art research at S1.

| Candidate | Problem-class match and verdict | Boundary / prerequisite |
| --- | --- | --- |
| GitHub native App checks + rulesets + auto-merge | ADAPT: upstream handles authenticated external checks and merge admission; our residue is subscription review results and coverage | Dedicated App and exact expected source; live freshness proof |
| Dot cloud browser + authenticated portal | SELECT: documented browser supports ordinary HTTPS interaction, independent of write connectors | Build a small portal; enroll a non-writer identity; demonstrate unattended submission on actual Dot |
| Custom MCP write action | DEFER: possible ChatGPT integration, not evidence of availability in this Dot/account | Verify plan, Dot tool exposure, OAuth and unattended permission behavior before reconsidering |
| Existing GitHub plugin comment/JSON result | REJECT as assumed transport: available read tools do not establish write capability or an isolated author | Shared operator identity would undermine attribution; marker alone is forgeable |
| GitHub queue | ADOPT if topology later becomes eligible; unavailable under observed personal ownership | Retest all required jobs and publisher on merge_group; head authorization cannot authorize a new group |
| Danger JS | REUSE existing deterministic mechanisms; not a semantic reviewer or authenticated Dot transport | Keep existing PR-body gates; avoid a second framework for the same checks |
| Work/Codex/native AI review or billed SaaS/API | REJECT for this operator scope | Explicit execution/billing constraints |
| Human copying JSON, PR-authored file, unauthenticated webhook | REJECT as autonomous trusted handoff | Cannot establish autonomous enrolled reviewer origin |

OpenAI documents Dot's own cloud computer/browser, scheduled work and plugin access. Local access and Codex delegation are optional features, not this design's execution route. Configure an explicitly assigned scheduled review responsibility rather than assuming proactive research can write: proactive research tools have additional read-only restrictions. [Introducing dots](https://openai.com/index/introducing-dots/), [Dot setup and scheduling](https://help.openai.com/en/articles/20001530-getting-started-with-your-dot).

Plugin connections and permissions are shared with ChatGPT, Work and Codex. Therefore a prompt saying “never merge” is insufficient if Dot can access an operator GitHub writer token. Enrollment requires proving all Dot-accessible GitHub paths are read-only or absent, including browser sessions, plugins and computers. Remove/downscope shared writer access or establish a genuinely isolated supported permission configuration; do not assume a per-Dot credential wall exists. If this cannot be done without changing the operator's account setup, present that tradeoff and remain blocked. [Dot permission boundaries](https://help.openai.com/en/articles/20001529-dots-privacy-security-and-safety-faqs).

### 3.1 Intake authentication

Proposed service exposes an ordinary browser queue, claim form and JSON submission form. Authenticate using a dedicated GitHub OAuth App with explicitly empty scopes and a separate enrolled GitHub user having no repository collaboration or administration rights. The server performs OAuth code exchange and `GET /user`; compare immutable numeric user ID against enrollment, never login text or JSON's asserted author. Tokens remain server-side; use Secure/HttpOnly/SameSite session cookies, OAuth state, CSRF protection, bounded requests and a fixed callback URL. Reject nonempty granted scopes; reused OAuth consent can preserve previously granted scopes. No GitHub write token reaches Dot. [OAuth flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [empty-scope access](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

The server issues a random one-use claim challenge tied to reviewer principal, repository ID, PR identity, revision tuple, policy version and generation. Submission requires that authenticated session and challenge. The JSON author field is only an assertion; the authenticated server envelope supplies the authoritative principal, received time and payload digest. A PR can neither enroll a reviewer nor create a challenge. Browser enrollment requires operator-assisted sign-in once; recurring login/approval requirements must be tested, not promised away.

**Attribution limit:** this authenticates the enrolled submission identity, not a cryptographic OpenAI Dot/model attestation. No documented attestation or Dot signing tool was found in the consulted primary sources. Record the operator's enrollment receipt, Dot activity/report reference and execution route. An operator or thief controlling that identity can impersonate it. If the operator requires cryptographic proof of the executing model, this design is BLOCKED pending a supported upstream mechanism; do not relabel OAuth as that proof.

## 4. Actors, credentials and control plane

| Actor | Minimum authority | Explicit exclusion |
| --- | --- | --- |
| Dot | public source/PR reads, intake claim and submission as enrolled reviewer | no repository write, merge, checks/status write, publisher secret, local computer or delegation |
| Intake | OAuth identity/session management, queue claim and durable report storage | no GitHub merge/check credential; no executing uploaded content |
| Publisher App | selected repository only; metadata/contents/PR/actions read, checks write | no contents write, PR write, administration write, auto-merge or merge endpoints |
| Reporter App | PR write for summary/inline comments; issues write for verified staging defects; contents read | no checks write, contents write or administrator role; no merge operations |
| Configuration observer | administration read plus required read scopes, in a separate service identity if needed | no administration write; inaccessible to Dot/PR CI |
| Auto-merge armer | separate narrowly routed trusted service; GitHub permissions needed to enable auto-merge (verify minimum in S0) | no bypass; egress allows only validated staging enable-auto-merge operations; credential never exported |
| Native GitHub merger | platform evaluates applicable protections at merge | no Dot/publisher delegation of merge authority |
| Operator | explicit settings/credential enrollment, policy promotion, pause and recovery | no routine bypass actor configured |

GitHub does not offer a general “auto-merge arming only” credential scope. The armer's necessary broad underlying permission is a residual risk, constrained by a separate process, endpoint allowlist, exact repository/base checks and native protections. If that boundary cannot be demonstrated, keep arming operator-owned; do not give Dot that credential. Reporter PR write also allows PR metadata/review changes; verify it cannot merge without contents write in S0. [App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app), [native auto-merge](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request).

App installation tokens are selected-repository and downscoped, short-lived; private keys stay in the publisher's secret store. Dedicated identities avoid accepting arbitrary GitHub Actions publishers as the Dot source. Actual App IDs/installation IDs are setup outputs, never invented constants. GitHub App authentication and source binding are reused mechanisms. [Installation authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation), [Checks API](https://docs.github.com/en/rest/checks/runs).

Deploy trusted service code from an operator-approved immutable release outside PR execution. Do not run PR workflows, imported PR modules, shell commands, package installation, report templates or renderer plugins with publisher secrets. The trusted manifest pins validator/schema/protocol versions, mechanical context inventory, accepted workflow identities/code versions and their load-bearing dependencies. PR changes to workflow/config/publisher/schema or goal sources cannot self-promote this manifest. They require explicit control-plane approval before authorization; no generic scope exception inferred from GO.

CI workflow job names alone are spoofable even under the GitHub Actions App. Read actual run/job IDs, workflow path/ID, run revision/event, conclusions and trusted workflow version. Reconcile modified workflow/dependency closures; unexplained trust changes block. Publisher outputs are data, escaped in HTML/Markdown; finding paths/lines and URLs are bounded and validated, never commands or arbitrary SSRF fetch targets.

## 5. Data flow and state machine

GitHub signed events → deterministic inventory/readiness → durable eligible queue → Dot cloud browser claim → review → authenticated JSON submission → immutable ledger record → publisher validation → reporter feedback → required App check on the current tested merge revision → independent armer → native auto-merge.

GitHub webhook HMAC authenticates **GitHub events**, not Dot verdicts. Verify the raw request body before parsing, deduplicate delivery IDs and query authoritative API state. Accept only pinned repository/installations. Missing signatures block event ingestion. [Webhook signature validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).

State per generation: DISCOVERED → WAITING_MECHANICAL → ELIGIBLE → CLAIMED → REVIEWING → SUBMITTED → VALIDATING → AUTHORIZED or BLOCKED → MERGED/CLOSED. Any changed identity/revision/policy creates SUPERSEDED plus a new generation. Lease expiry or reviewer crash produces INCOMPLETE/BLOCKED, never success. Policy or billing uncertainty produces PAUSED before claim/publication.

Persist before each external side effect, using a transaction and outbox. Exactly-once transport is not assumed: repeat identical payload/digest returns the same receipt; another payload for a consumed challenge conflicts. A generation has one final verdict. Safe retries reconcile recorded check/comment IDs with GitHub before creating anything new. Recover a crash after GitHub accepted a check by matching stable external_id and verifying the actual App and SHA; do not infer publication from a local flag alone.

Mechanical readiness excludes every `dot-review/*` context. Evaluate all trusted mandatory mechanical jobs and their current attempts; missing, failure, cancellation, skipped/neutral substitutes or unresolved inventory is not readiness. Conditional clean exemptions must be explicit successful deterministic gate outputs. This prevents circular waiting on the Dot check. Require evidence linked to the exact PR head H and tested merge M as appropriate for that workflow; never use branch-level green or another PR's artifacts as evidence.

## 6. Freshness and native enforcement

Define tuple `T=(repo_id, PR node_id, base_ref, B, H, A, M, policy_digest, protocol_version, generation)`: B is current staging ref, H current PR head, A independently computed merge-base, M GitHub's current `refs/pull/<n>/merge` tested merge commit. Fetch parents/tree and require M to combine B and H; mergeability unknown, unavailable merge refs or conflicts block. Record M before and after mechanical qualification/review; recompute at publication.

**Select strict:true plus merge-revision-only App check `dot-review/v1`.** Publisher never produces successful `dot-review/v1` on H. It publishes only on the current M, after reviewing M and validating the tuple. No head-only compatibility mode or backfill. GitHub prioritizes test-merge status when present and otherwise checks the head; with no Dot success on H that fallback cannot admit a PR. GitHub also natively requires an up-to-date head with strict checks. [Strict checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [test merge versus head checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

This is stronger than asynchronously clearing head checks after staging advances: a base change produces a different tested merge revision, whose Dot check is absent, and native strictness blocks the outdated topic branch. The publisher's final API reread narrows races, but **GitHub's merge admission on the current merge revision is the enforcement boundary**. No interval of polling is claimed to close a merge race.

Tradeoff: independent concurrent PRs cannot keep strict:false throughput. After one merges, the others must merge-forward staging into their head, rerun mechanical CI and undergo fresh review. No rebase/force-push worker workflow; follow [merge-forward rule](../../../.claude/rules/git-conflict-merge-forward.md). Publisher cannot update branches. Serial review scheduling can reduce wasted reviews, not weaken admission.

**S0 hard prerequisite:** demonstrate App check source pinning and native auto-merge on M in a disposable protected branch, including fallback-to-head behavior, base movement immediately after publication and head changes while mergeable state is recomputing. Documentation supports the primitives, not a guarantee about every runtime combination. If the live matrix fails, enforcement is unsupported and remains disabled; organization migration + real queue is the alternative requiring a new decision.

Other transitions:

| Event | Required behavior |
| --- | --- |
| New commit or force-push | New H/M and generation; old challenge/report cannot authorize; force-push is handled even though worker policy forbids it |
| Retarget away/back | Different base_ref invalidates claim; no publisher on non-staging; returning starts a fresh generation |
| Staging advances / concurrent merge | Different B/M invalidates result; strict admission and missing current-M check block before event processing |
| Base rewrite/deletion | Native rules forbid it, including administrators; restore protection and audit before resume if settings were overridden |
| Mechanical rerun becomes red | Native required mechanical checks block; invalidate in-flight review qualification and require current successful attempts |
| PR close/reopen | Close cancels lease; reopen requires a new claim and validation, no historical success reuse |
| Duplicate PRs sharing commits | Checks are SHA-scoped, not PR-scoped; test whether M is distinct. No unsupported claim of PR isolation |
| Duplicate/reordered delivery | Idempotent receipt/outbox; generation comparison rejects older events, current API state wins |
| API timeout/rate limit/revocation | No new authorization, bounded retry/backoff; missing current checks keep admission blocked |

The duplicate-PR test must prove the chosen identity contract. If two PR identities share M, the gate cannot guarantee per-PR authorization with a single native context. Do not solve that race by listing current duplicates or watching comments. Either require operator approval of revision-scoped authorization with committed originating specifications (and record alias PRs), or STOP this design until an enforceable distinct admission route is chosen. No alias reuse is enabled by default.

Originating specifications and goal/principle evidence are immutable commit/path/blob references in T. PR title/body/comments are supporting, untrusted context, never mutable authority over an approved revision. Required PR-body gates remain independent. Changes affecting scope after review require a new reviewed commit or explicit stopped admission, not an optimistic reuse of the existing check.

A published authorization is an immutable completed decision for T, not a renewable time lease. Before a same-revision rerun that could overturn GO, an operator must first establish a native admission pause; updating a check is not an atomic “revoke before a concurrent merge” guarantee. An invalidated or crashed **in-flight** execution cannot publish. A publisher crash after valid committed publication does not retroactively make that completed review incomplete.

**Same-M lifecycle limitation:** native checks do not encode generation, policy digest or PR lifecycle. A close/reopen, retarget-away/back or policy/protocol promotion may preserve M and its previous success. Intake replay rejection cannot prove that native GitHub refuses the old check. The transitions above describe required semantics, not measured enforcement. S0/S4 must test already-successful checks through these transitions and policy promotion, including authorized writers attempting direct native PR merge. Pause natively before invalidating an accepted same-M decision. If the intended isolation cannot be enforced, STOP rollout pending an explicitly approved supported identity/lifecycle contract; never claim generation IDs or polling solve it.

## 7. Versioned JSON contract

Implement JSON Schema draft 2020-12, protocol `dot-staging-review/1.0`, with `additionalProperties:false` recursively. Unknown minor/major versions block until an approved validator supports them. Required object fields below are normative; examples/placeholders are not values accepted in production.

| Field | Type and required contents |
| --- | --- |
| `protocol_version` | constant `dot-staging-review/1.0` |
| `kind` | `admission`, `baseline`, or `historical` |
| `claim_id`, `generation`, `review_id` | challenge UUID, positive integer, UUID |
| `repository` | numeric `id`, canonical `full_name`; validate ID `1231007068` and configured name |
| `pull_request` | integer `number` and exact `node_id`; null only for baseline |
| `revision` | `base_ref`, `base_sha`, `head_sha`, `merge_base_sha`, `tested_merge_sha`; 40 lowercase hex SHA strings; M null only for non-admission |
| `policy` | `version`, `sha256`, `principle_inventory_sha256`, `spec_inventory_sha256` |
| `execution` | asserted `reviewer_id`, `route` constant `dot-own-cloud`, `started_at`, `finished_at` UTC timestamps, `activity_reference`, `failure` boolean, `failure_reason` nullable bounded string |
| `completion` | `COMPLETE` or `INCOMPLETE` |
| `verdict` | `GO`, `REVISE` or `STOP` |
| `report` | trusted-store reference, `sha256`, bounded summary and limitations array |
| `mechanical_evidence` | each expected context: App ID, run/job/check IDs, head/tested SHA, workflow ID/path/version, attempt, successful conclusion |
| `goal_evidence` | README goal/invariant paths, blob SHA and exact line references; each requirement mapped to assessed impact and evidence |
| `principle_evidence` | every inventory ID: applicability, rationale, PASS/FAIL/NOT_APPLICABLE/UNVERIFIED, evidence references |
| `specification_evidence` | originating spec commit/path/blob/requirement ID and result/evidence; explicit documented absence requires operator-approved policy, never silently skipped |
| `coverage` | full changed-file inventory, reviewed file entries, dimension entries, omissions, truncation flag, counts derived from inventories |
| `findings` | objects specified below, empty array allowed |
| `self_review` | adversarial questions asked, discovered gaps and how resolved; own report validation limitations |

Evidence reference object: `repository_id`, `commit_sha`, `path`, `blob_sha`, `line_start`, `line_end`, bounded `explanation`, optional trusted run/report ID. Dimension IDs are `goals`, `principles`, `standards`, `specification`, `correctness`, `architecture`, `security`, `tests`, `self_application`, `build_vs_reuse`, `documentation`. All require a result and substantive evidence. Applicability inventory is generated from the trusted base's rule/principle sources plus proposed changes; a removed rule remains visible as a removal, not omitted from coverage.

Finding object: stable `id`, `blocking` boolean, severity enum `critical|major|minor|note`, category, bounded title/description, evidence array, fix expectation, location `{commit_sha,path,line,side}` or null, and staging verification `{sha,present,evidence}` or null. Critical/major findings must block; GO with any blocking finding is invalid. Inline findings reference valid diff lines, otherwise use a normal PR comment with source location; do not fabricate inline positions.

Deterministic validator must reject duplicate JSON keys, wrong types/enums, unknown fields, oversized payload (>1 MiB), >1,000 findings, excessive string/array/nesting lengths, non-finite values, path traversal, invalid line ranges, future/inverted timestamps, missing evidence, unknown inventory IDs, inconsistent counts and SHA/identity mismatches. Implement explicit bounds in schema; no permissive coercion. Resolve referenced blobs from GitHub by pinned SHA, not URLs chosen by the report.

Admission additionally requires the authenticated envelope/challenge, current T, complete change/rule/spec/dimension inventories, no omissions/truncation/UNVERIFIED applicable requirement, execution.failure=false, COMPLETE, GO and no blockers; reread mechanical evidence and native protections independently. A valid REVISE/STOP/INCOMPLETE report is archived and produces failure, never neutral/skipped. Missing result remains absent/in_progress or times out to failure. Historical/baseline reports are never converted into success by changing `kind`.

**Format validity is not semantic quality.** A schema cannot establish that rationale is true, architecture is sound or all relevant principles were identified. Named protocol `DotStagingReviewV1` must walk inventories and requirement-to-evidence mappings. Observation calibration uses independently adjudicated seeded defects and operator review of coverage. Publish report limitations and measured results; do not claim perfect detection or fabricated confidence.

### 7.1 Normative schema source for implementation

The linked JSON file is the single schema source, supplied as a documentation artifact, not an installed validator. S1 must implement and test a validator consuming its approved bytes. Require format assertions (UUID and date-time), a 64-level parser nesting limit and all cross-field/current-state checks above; JSON Schema alone cannot compare line endpoints, timestamps, inventory equality or current revisions. Every evidence object carries `trusted_run_or_report_id` (null when absent).

Normative documentation artifact: [dot-review-result.schema.json](../../meta-factory/dot-review-result.schema.json). It is not a deployed validator. The approved setup manifest must pin its SHA-256 and the publisher release that consumes these exact bytes; mismatches block launch. Baseline/historical results require null tested_merge_sha and cannot be recast as admission.


## 8. Review, reports, baseline and durable ledger

Dot reads README goal/invariants first, session bootstrap, applicable rules, CLAUDE, relevant standards/specifications and prior-art records, then the full diff and affected dependents. Evaluate changed tests for tautology and regression proof, enforcement channel selection, security/architecture boundaries, docs authority and recursive self-application. Do not sample the changed-file population to claim COMPLETE. Record generated/binary exclusions with a deterministic equivalence check and justified dimension coverage.

Open eligible staging PRs have priority; stable ordering oldest-ready first, then PR number. One active claim per PR/generation, bounded lease, heartbeat, atomic claim/CAS. Review H and merged tree M; do not start semantic review until required mechanical evidence for exact H/M succeeds. A changed revision interrupts publication even if Dot finishes reading the old snapshot.

When no eligible open PR exists, establish a baseline on current staging before the historical queue. Include full source/goal/rule inventory and exact-revision `make self-audit` evidence from a proven isolated runtime or a trusted CI run that actually executes that command. Missing execution evidence makes the baseline INCOMPLETE. Running repository code requires a disposable credential-free sandbox with no browser/session mounts, intake/publisher credentials or internal-service access. Dot's documented cloud computer is not evidence that such isolation exists: probe it. If isolation is unavailable, do static review, use exact-revision trusted CI evidence, record the self-audit limitation and keep baseline INCOMPLETE until accepted execution evidence exists. Never run PR-controlled code in the authenticated browser environment.

Capture baseline B0, command/environment receipts, failures and limitations. If staging moves before completion, retain B0 as history and refresh baseline at the new SHA. Historical queue: enumerate all merged-into-staging PRs with pagination; choose unreviewed newest-first by mergedAt and number, persist a moving watermark and reviewed IDs. Review each actual merged change and its original spec; separately verify any defect against current staging SHA before issue creation. Closed-unmerged PRs are outside that queue. Ineligible open PRs do not stop historical work; a newly eligible PR takes precedence at the next safe checkpoint.

Reporter leaves exactly one identified summary comment per open PR, updated by stored comment ID, covering tuple, verdict/completion, coverage, blockers, report link and limitations. Stable finding IDs deduplicate inline comments; outdated locations remain historical and are marked resolved/superseded in the summary. No issues for open-PR defects. For baseline/historical findings, issue only after current-staging reproduction/static proof, paginated search of open/closed issues by stable fingerprint plus category/path/cause, and recheck of existing remediation. Link report, original PR and current proof; update a matching issue rather than duplicating it. Dedup ambiguity is held for review, not guessed.

Ledger lives in an operator-controlled durable transactional database (proposed SQLite on persistent volume for one writer; backups before upgrades) and immutable report objects with hashes. It is outside reviewed branches and cannot be written by PR code or Dot directly. Intake persists authenticated submissions; publisher writes acceptance/rejection/publication events; reporter writes comment/issue receipts. No review-generated repository commits, no head invalidation loop. CI artifacts and GitHub comment/check retention are not the sole archive.

Key admission records by repository ID, PR node ID, T digest and generation; historical records by PR node ID and actual merge commit, with current verification SHA separately. Preserve source/evidence inventories, exact revisions, protocol/schema/policy versions, authenticated principal, route/activity references, environment, run IDs, timestamps, payload/report hashes, verdicts, lifecycle transitions and side-effect IDs. Read-only queue/coverage dashboard reports eligible/in-flight/blocked/historical counts, coverage gaps, last successful baseline, age and report links. Dot may read it; only services write authoritative state.

## 9. Ruleset and operational contract

Create a staging-only active branch ruleset after observation success, matching exactly `refs/heads/staging`. Require PRs, strict required checks, block deletion/non-fast-forward, and no configured bypass actors (including admins and Apps). Preserve existing classic protection and every current required check while reconciling all six declarations. Rulesets layer with classic protection. Owner can still change settings; record that unavoidable administrative authority separately from bypass permission. [Ruleset availability and layering](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).

Required contexts are the reconciled mechanical set plus exactly `dot-review/v1`, expected source the actual dedicated publisher App's integration ID. Never `any source`, GitHub Actions or a human PAT for that context. Emit a disposable observation check to make App/context selectable, then verify API/UI binding; check-run `app.id` must match. No same-name commit-status workaround; duplicate check/status names can create ambiguous requirements.

Direct pushes to staging fail the required-PR rule. Test administrators, contributor, Dot principal, publisher and armer; settings-admin mutation remains operator-only. Main settings/default topology do not change. Squash-title conventions reuse current conventional-commit title validation and PR_TITLE/PR_BODY settings. Armer only handles open, non-draft staging PRs with validated COMPLETE/GO and protections intact; enable native auto-merge with squash, without freezing the body. GitHub may disable arming on unsupported/new-writer changes; reread and rearm only after a fresh qualified generation.

No merge queue rule in this owner topology. Preserve existing merge_group handling. A future queue migration requires every mechanical context and Dot publisher to handle group SHA and member inventory; review that exact combined group, not cached member-head GO, and prove group rebuild/reorder tests before enablement.

Protection verification is a real external deterministic configuration observer, not workflow-integrity's current warn-pass job. Pin expected contexts/sources, strictness, target, bypasses, PR requirement and force-push/deletion policies. Lack of admin-read evidence blocks readiness/enforcement; supply a narrowly scoped read identity, not a broad PAT in PR CI. Alert on drift and stop new publications/arming. Monitoring detects setting drift; it cannot prevent an authorized owner from changing settings.

Emergency pause: an operator activates a preprepared no-bypass ruleset requiring an additional never-produced context `dot-review/pause`. Admission stops natively once activation is confirmed, even if previous GO exists or services are down. Service pause flag alone stops new publications but does not revoke already accepted decisions. No claim of instantaneous pause before GitHub acknowledges the settings change. Resume removes the extra requirement only after health/configuration validation; test this on disposable branches.

## 10. Negative tests, live validation and acceptance

Offline paired-negative tests must mutate one input at a time with fixed sibling inputs: protocol, repository/PR, H/B/A/M, challenge/principal, schema bounds, inventories, verdict/completion/finding consistency, run source/revision/attempt, policy digest, replay and state transitions. Show the pre-fix failure for each implementation change; a sibling publisher side effect must not cause false GREEN. Injection strings are data and must never invoke code. No LLM invocation in tests or CI.

Live matrix uses an operator-approved disposable branch/ruleset and harmless PRs, never staging/main; create no objects in this design session. Capture before/after refs, required settings, report, App ID/check IDs and native merge outcome for every row. “Failed to merge” must identify the gate reason, not merely a conflict.

| Case | Native admission expected |
| --- | --- |
| Current tuple, successful mechanics, authenticated COMPLETE/GO, no blockers, correct App on M | Squash auto-merge succeeds once armed |
| Missing, malformed, INCOMPLETE, REVISE, STOP or execution failure | Blocked |
| GO with blocking finding / UNVERIFIED applicable principle / omitted file | Publisher failure; blocked |
| Fake comment, PR JSON file, arbitrary workflow artifact or unenrolled OAuth user | No trusted success; blocked |
| Same context forged by PAT, another App, or GitHub Actions | Wrong-source check cannot satisfy gate |
| Old challenge/report replay after new commit or force-push | Current H/M lacks authorization; blocked |
| Retarget away/back, close/reopen, missing/unknown mergeability | Requalification required; no stale reuse |
| Base advances immediately before and after publication, including identical resulting tree | New M/strict admission blocks old authorization |
| Two concurrently qualified PRs: A merges, B waits | B must merge-forward and obtain new mechanics/review |
| Submission asks publisher to authorize H instead of M, or supplies an old M | Publisher refuses head publication; old-M success cannot satisfy current admission |
| Two PR identities share head/base, differing originating scope | Distinct M must isolate authorization; otherwise design STOP pending alias decision |
| Latest mechanical attempt red/cancelled/missing after earlier green | Blocked |
| Duplicate submission/delivery; crash before/after ledger and GitHub side effects | One logical receipt/check/comment; no partial acceptance |
| PR modifies workflow/schema/publisher or injects instructions | No unapproved control-plane version, secrets or execution; blocked |
| Publisher/API outage, revoked principal/App, unknown billing or exhausted Dot limits before authorization | No new success; blocked |
| Native pause with an already successful pending PR | Does not merge while pause requirement active |
| Admin/direct push/armer or Dot manual merge attempt | Ruleset refuses bypass/direct push; Dot and publisher lack credential authority |
| Baseline/historical GO payload submitted as admission | Rejected; cannot authorize open PR |

Acceptance requires all rows proved, not a sampled subset; current COMPLETE/GO is the only successful admission path. Operator-adjudicated seeded semantic defects must exercise goals, principles, spec, correctness and architecture; every known blocker is surfaced and completeness gaps yield INCOMPLETE. This calibration is evidence for those cases, not a universal accuracy guarantee. Count reviewed files/principles/dimensions and report unknowns explicitly.

## 11. Rollout, availability and rollback

1. S0: verify account/transport/isolation/native freshness constraints and unknowns; no enforcement on staging. Obtain installation inventory through an authorized read route, not the failed APIs above.
2. S1–S3: implement versioned protocol, ledger, trusted services and tests in observation mode. Context `dot-review/observe-v1` is never required and never masquerades as production success. Observe open PRs and baseline; no armer action until separately authorized.
3. S4: disposable live matrix and semantic calibration; restore backups to demonstrate durability. Refresh current staging baseline before the historical queue. Produce receipts and a signed-off readiness report; no prerequisites marked complete from prose.
4. S5: operator enables staging ruleset and production publisher together under a native pause, verifies all sources/settings, then removes pause. Existing PRs need fresh qualification; migrate docs and context inventories in the same rollout contract. Observe first authorized staging admission and drift monitor.

Subscription allowance is an input to scheduling, not an availability guarantee. Require an explicit operator-selected authorization expiry in the approved setup manifest. Record observed account eligibility, allowance/reset and any promotion end date from actual account UI/terms; first-month extended limits are documented, but this account's expiry and remaining limits were not verified. If no trustworthy automated allowance signal exists, require a short operator-attested billing-policy validity window; on expiry, default PAUSED and block new authorizations. Cap active claims at one, review attempts per tuple at two, claim lease initially 120 minutes; these proposed limits are operator-tunable, not promised platform capacity. Never retry indefinitely, purchase credits or invoke another execution route.

After promotion expiry, continue only when the operator verifies subscription-included capacity and spending restrictions. Unknown/exhausted allowance, platform safety pause, auth failure and long outages leave admission blocked. Health checks cover intake/publisher DB/backups, queue age, stuck leases, webhook delivery gaps, token/config readability and last Dot completion; notify on actionable failure or meaningful change, not each unchanged poll. Reconciliation scans recover missed events; freshness enforcement remains native GitHub, not those scans.

Reports already validly published for an immutable T remain completed decisions during an outage; no new review is authorized without health/billing validity. If policy requires immediate suspension of all previously approved admissions, activate the native pause and verify its acknowledgement; expiry alone cannot revoke a native check. The operator must accept immutable prior decisions or provision and test this pause route before launch; check success has no native application-defined TTL. Never promise TTL enforcement by a timer that may be down.

Rollback defaults to **pause and repair**, preserving mechanical checks and ledger. Keep an API/UI snapshot of old settings and tested restoration instructions. Removing the Dot requirement restores the weaker old contract and needs an explicit operator decision; disable auto-merge/cancel armed PRs and hold native pause while deciding. Revoke compromised App/session credentials, preserve report evidence and re-enroll. No automatic rollback that opens merges; no main changes.

## 12. Operator decisions and remaining prerequisites

1. Approve proposed browser portal, dedicated enrolled reviewer identity and hosting/secret/database ownership. No endpoint, identity or App is already provisioned.
2. Verify Dot account access, scheduled unattended browser submission, subscription-only allowance/expiry and actual credential isolation. Shared writer plugins may require account-wide downscoping; this inconvenience is preferable to pretending prompts enforce separation.
3. Approve strict:true throughput cost and current-merge-SHA check strategy, subject to S0 proof. Current personal ownership rules out queue; organization migration is an alternative, outside this task.
4. Accept OAuth-principal attribution rather than nonexistent model attestation, or keep blocked. Resolve SHA-sharing PR alias behavior only if the live test finds it; no automatic policy weakening.
5. Approve separate App registrations, expected source IDs, no-bypass admin contract, mechanical three-versus-six reconciliation and armer permission boundary. Manual arming is the fallback if least-privilege autonomous arming cannot be proved; Dot never receives merge rights.

These are setup/adoption decisions for the concrete design, not missing answers to the already agreed review scope. This session authorizes documents only: no commit, push, settings mutation, implementation, worker dispatch or merge.

Human touchpoints are limited to adopting this changed admission contract (including strictness/attribution), enrolling credentials through secure sign-in, provisioning externally exposed services/Apps, promoting trusted control-plane versions, enabling/pausing protections, and resolving any demonstrated unsupported platform behavior. Each changes authority, exposes a service, needs a password, or weakens/changes policy; ordinary queue claims, reports, deduplication, retry and valid staging admission remain automatic. No per-PR human review is added to the agreed routine gate.

## 13. Self-review and limitations

Adversarial question: “Which stale or forged result could still satisfy a native check after publisher validation?” Found: head SHA does not bind B, SHA-scoped checks may cross PR identities, neutral/skipped can pass native requirements, post-publication revocation and TTL are not atomic. The design addresses them with M-only success plus strictness, alias STOP, explicit failure conclusions, native pause and immutable authorization semantics.

Second question: “Which execution category did the design assume without evidence?” Found: Dot-specific write connector, credential separation despite shared plugins, isolated code execution and complete App inventory. They are now explicit prerequisites; browser capability is sourced, actual account behavior remains unprobed. This is a design, not a completed live security audit or baseline review.

Backward surface enumeration: staging contract docs; six mechanical workflows; aggregate/required-context principle tests; local CI sweep; workflow-integrity protection assertion; reviewer prompts; armer/publisher credentials; main promotion boundary; kickoff tracking/sync. Existing checks are retained; workflow-integrity's warn-pass and live missing declarations are recorded gaps requiring implementation reconciliation. No existing operational artifact was rewritten in this design session.

Self-application: documents delegate goal authority to README, reuse native GitHub primitives, keep semantic work out of CI and require paired-negative enforcement tests. A schema-valid but semantically weak review remains a residual risk. No independent cold-agent review was run because the operator forbids own background agents; the adversarial pass is self-review, not independent validation. Operator/approved Dot review of this specification remains outstanding.

## 14. Accepted operating reconciliation (2026-10-05)

The canonical operating prompt is [DotStagingReviewV1](../../meta-factory/dot-review-protocol.md). It supersedes earlier conflict-repair and background-agent instructions for this assignment: Dot only reviews; the executor merges current staging into the feature branch, resolves conflicts, reruns mechanics and requests fresh independent review. Dot never edits application code, pushes commits or merges PRs. No available executor means BLOCKED with the required action recorded.

The [handoff setup manifest](../../meta-factory/dot-review-handoff.md#setup-manifest) owns deployment values and receipts. No ledger URL/path, publisher release/App, intake identity, schedule or authorization expiry is configured by this design. Live API reinspection found strict:false and no Dot gate on 2026-10-05; see the handoff for bounded evidence. Until all preflight receipts pass, use explicitly selected report-only work or remain launch-blocked. A report in chat cannot authenticate an admission or prove a saved schedule.

Delivery states are distinct: review completed, authenticated delivery acknowledged, ledger committed, feedback published, and admission accepted. Recovery reconciles each receipt independently. Strategic uncertainty is DECISION-NEEDED, represented as STOP with a blocking decision finding in the schema; code smells remain advisory unless supported by a violated requirement and concrete impact.
