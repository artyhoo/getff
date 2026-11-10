# Dot review gate — setup handoff and evidence

> **Status:** setup packet, 2026-10-05; **amended 2026-10-06** for the V2 contract ([coordination spec](../superpowers/specs/2026-10-06-dot-pr-coordination-design.md), digest `88b0deb817c8afdca85f33c39706d8985a55f8a12f3dcbd36c3653444d25de1f`). Nothing provisioned; every deployment field UNRESOLVED until an operator action fills it. Autonomous launch BLOCKED until the manifest resolves.
> **Authoritative for:** the setup manifest field list, the operator provisioning runbook, the V1→V2 migration rules (§1a), role-specific operating instructions (§1b), the S0 live-proof matrix, and the S5 promotion/pause/rollback recipes for this operator-only integration.
> **NOT authoritative for:** design rationale — [2026-10-05 spec](../superpowers/specs/2026-10-05-dot-staging-review-gate-design.md) (contract parts superseded there) and [2026-10-06 spec](../superpowers/specs/2026-10-06-dot-pr-coordination-design.md); Dot's operating instructions — [DotPRReviewV2](dot-review-protocol.md) (V1 historical); result shape — [V2 schema](dot-review-result-v2.schema.json) ([V1 historical](dot-review-result.schema.json)); observed platform evidence — [S0 patch](research-patches/2026-10-05-dot-gate-s0-platform-evidence.md).
> **Secrets rule:** this file never contains a token, key, password or secret value. Placeholders name the secret store entry; values live in the operator's external secret store.

## Setup manifest

A manifest is READY only when every field is resolved, its receipt recorded, and the loader's fail-closed check passes. `UNRESOLVED` fields block launch; no default substitutes.

| Field | Meaning | Owner | Status |
| --- | --- | --- | --- |
| `protocol_version` | constant `dot-pr-review/2.0.0` ([DotPRReviewV2](dot-review-protocol.md)); protocol release commit SHA + file SHA-256. V1 `dot-staging-review/1.0` is historical/import-only (§1a) | implementation → operator promote | UNRESOLVED |
| `schema_sha256` | SHA-256 of the approved [V2 schema](dot-review-result-v2.schema.json) bytes the publisher consumes. Computed at CONTRACT_READY (docs PR receipt); binding only at operator promotion (S5). V1 schema `98b10f4f1378495241b808265902e6555d2592af6f61454d11cc484d4ae323b0` stays valid for V1-import archaeology only | implementation → operator promote | UNRESOLVED (V2 bytes published; digest recorded in the CONTRACT_READY receipt) |
| `policy_sha256` | SHA-256 of the trusted policy manifest (mechanical inventory, limits, expiry) | operator promote | UNRESOLVED |
| `repository_id` / `repository_full_name` | `1231007068` / `artyhoo/getff`, re-verified live at launch | resolved (S0 §1) | READY |
| `reviewer_principal` | enrolled GitHub user **numeric ID** allowed to submit (never the login string) | operator enrollment | UNRESOLVED |
| `intake_base_url` | HTTPS intake origin (claim + submit + read routes) | hosting provision | UNRESOLVED |
| `oauth_client_id` / `oauth_client_secret_ref` | dedicated OAuth App, **empty scopes**; secret in external store | operator + secret store | UNRESOLVED |
| `webhook_secret_ref` | GitHub webhook HMAC secret (events ingestion) | secret store | UNRESOLVED |
| `publisher_app_id` / `publisher_installation_id` / `publisher_key_ref` | dedicated GitHub App: metadata/contents/PR/actions **read** + **checks write**, selected repo only | operator + secret store | UNRESOLVED |
| `reporter_app_id` / `reporter_installation_id` / `reporter_key_ref` | dedicated GitHub App: PR write + issues write + contents read; **no** checks write | operator + secret store | UNRESOLVED |
| `observer_token_ref` | admin-**read** configuration observer identity (separate from CI and from Dot) | operator + secret store | UNRESOLVED |
| `armer_token_ref` | auto-merge armer identity, egress-allowlisted to enable-auto-merge only | operator + secret store | UNRESOLVED |
| `ledger_path` | durable transactional DB + report store location (persistent volume) | hosting provision | UNRESOLVED |
| `schedule` | Dot scheduled responsibility (task ID, cadence, timezone, protocol pin) | operator, in Dot's Scheduled activity | UNRESOLVED |
| `authorization_expiry` | explicit operator-selected UTC expiry of billing/allowance attestation | operator | UNRESOLVED |
| `limits` | active claims = 1; attempts per tuple = 2; claim lease = 120 min (operator-tunable) | operator promote | PROPOSED |
| `pause_decision` | explicit operator choice: accept immutable prior admissions, or provision+test native `dot-review/pause` route | operator | UNRESOLVED |

## 1a. V1 → V2 migration rules (import, never reinterpretation)

V1 (`dot-staging-review/1.0`, [schema](dot-review-result.schema.json)) records are historical artifacts. Rules, per the [2026-10-06 spec §5](../superpowers/specs/2026-10-06-dot-pr-coordination-design.md):

- **Bytes and provenance preserved:** import keeps the original V1 bytes, digest, envelope identity and original protocol version string. A V1 record is never rewritten into V2 shape and never re-validated against the V2 schema.
- **No coerced standing:** a V1 GO/completion never becomes V2 `GO` admission standing; V1 `INCOMPLETE` maps only through an explicit, recorded import decision — never silently to V2 `PARTIAL`. Schema incompatibilities surface as explicit import mappings, not reinterpretation.
- **Separate meaning classes stay separate:** a schema-valid negative/partial V2 report is accepted history and corrective input — its acceptance is not admission. A once-valid report overtaken by head/base movement is archived **superseded** only after verifying its issued assignment; it cannot authorize the new revision. Historical applicability and live authorization are computed separately.
- **Fix and closure records:** V2 `fix_response` and `closure_receipt` records (same schema, discriminated by `record_type`) attach to finding lineage; one active corrective owner per PR; independent closure comes from the reviewer of record, never from the fixer's own claim.
- **Consumers:** #2056 validators/policy pins/fixtures adopt the same V2 schema version/digest in the same window as these declaring docs (supersession + compatibility + fixtures land together); validators must not accidentally interpret V2 as V1; old V1 reports stay readable.

## 1b. Role-specific operating instructions (V2)

| Role | Owns | Evidence at completion |
| --- | --- | --- |
| Executor | Implementation, local checks, obtaining the pre-PR change review, opening the PR, assigned corrections; **no independent merge/arming of a registered managed PR, even on green CI** ([CLAUDE.md exception](../../CLAUDE.md)) | Exact revisions, check receipts, review artifacts, finding-to-fix response (`fix_response` record) |
| Change reviewer | Correctness of its declared change scope, test completeness/quality, false positives/negatives, tautology, maintainability | Scope/revision-bound review artifact; its immutable digest + reviewed revision enter Dot's packet; private detail is recorded as unknown, not assumed |
| Dot/Astra | The seven system dimensions (protocol §4) + prior-review adequacy | V2 `review_report` via authenticated intake; negative reports are first-class accepted results |
| Coordinator (Claude Code) | Durable queue and ownership, CI/review intake, delivery + acknowledgement, stalled-work recovery, re-review, dependency-aware merge ordering | Journal state transitions, action receipts, current eligibility calculation |
| Deterministic helpers | Parsing, identity/freshness, persistence, polling, publication, dedup, budgets, mechanical admission predicates | Executable positive/negative checks at the earliest reachable channel |

Operating semantics:

- **Registration transfers authority:** opening a PR transfers monitoring responsibility (and merge/arming authority for that managed PR) to the coordinator after a durable registration receipt; a failed/missing receipt leaves the PR unregistered and is surfaced. Before registration the coordinator reconciles and disables any conflicting armed auto-merge; unknown armed state holds registration/admission. Release from management requires an explicit recorded operator transition — a stalled coordinator does not silently restore executor merge authority.
- **Messaging reuse:** the coordinator uses the operator's existing Claude Code monitoring and inter-session message/wake mechanism; actual commands, session identifiers, persistence scope and restart behavior are recorded from that mechanism at enrollment. Persist action intent before messaging; delivery is not acknowledgement; duplicate messages return the same receipt; recovery queries pending intents against actual session/PR state. No invented session ID or transport; when a destination identity is unknown, the PR-description receipt is the exchange.
- **Queue:** priority = pending correction verification → qualifying open staging PRs (oldest ready) → unreviewed merged staging PRs (newest merged first); historical review fills only when no open PR qualifies and yields at the next bounded checkpoint. Cursor pagination survives restart; new arrivals ahead of the cursor are reconciled; equal priority breaks by enqueue time deterministically.
- **Ledger vs projections:** the durable ledger is the journal authority; GitHub comments/checks are projections for discovery/dedup, never a second authoritative state machine. Delivery is the complete bounded JSON (or immutable reference + digest when oversized) — truncation never substitutes for the machine report.
- **Deployment labels:** `enrolled autonomous` requires a demonstrated unattended route with live receipts; if only manual report copying exists, the deployment is labeled `ASSISTED` — useful reports retained, autonomous scheduling/merge disabled, stated honestly rather than implied. Dot's callable submission/export and unattended launch routes are **unproven until a live receipt**; no endpoint, connector write or task ID is invented. Dot requires no local-PC access; a remote receiver never depends on a sleeping local machine.

## 2. Prerequisites scoreboard (kickoff §2)

| ID | Receipt | Status (2026-10-05) |
| --- | --- | --- |
| P0 | Spec/kickoff approval + explicit execution route | Operator decision outstanding |
| P1 | Canonical kickoff/spec on origin/staging (tracked blobs) | Pending — publish via staging PR |
| P2 | Dot account eligible, subscription-only policy/expiry confirmed, delegation routes excluded | UNVERIFIED (OpenAI pages bot-blocked from this env; needs supervised account check) |
| P3 | Dot-accessible credentials cannot merge/write checks; enrolled non-writer principal | UNVERIFIED — §4 checklist + live probe |
| P4 | Hosting, backups, secret ownership, actual publisher/reporter App IDs | Unprovisioned — §3 |
| P5 | Unattended authenticated browser submission on actual Dot proven | UNVERIFIED — §5.1 |
| P6 | Expected-App check on current M + strict native auto-merge, race, alias behavior proven | UNVERIFIED — §5.2 |
| P7 | Mechanical 3-vs-6 discrepancy resolved with receipts | Open — live=3, declared=6 ([S0 §6](research-patches/2026-10-05-dot-gate-s0-platform-evidence.md)); operator registration closes it at S5 |
| P8 | Narrow admin-read observer + armer permission boundary proved | UNVERIFIED — §3.4/§5.3 |

## 3. Provisioning runbook (operator; each step is a human touchpoint)

### 3.1 Publisher App (admission check source)

1. Register a GitHub App named e.g. `getff-dot-review-publisher`. Homepage any; webhook optional (events go through the intake webhook app instead).
2. Permissions: Repository → Administration **read-only** (protection reread), Contents **read-only**, Metadata **read-only**, Pull requests **read-only**, Actions **read-only**, Commit statuses **read-only**, **Checks: read and write**. Account permissions: none.
3. "Where can this app be installed": only selected repositories → install on `artyhoo/getff` only.
4. Record `publisher_app_id` + `publisher_installation_id`; private key → secret store (`publisher_key_ref`). Never commit the key; never grant contents write (check-runs need only the checks permission — verified against [Checks API docs](https://docs.github.com/en/rest/checks/runs): only GitHub Apps can create check runs at all).

### 3.2 Reporter App (feedback surface)

1. Register `getff-dot-review-reporter`: Pull requests **read and write**, Issues **read and write**, Contents **read-only**; no Checks permission.
2. Install selected-repo only. Record IDs + key ref. S0 live probe (§5.3) must confirm it cannot create check runs or merge.

### 3.3 OAuth App (intake identity)

1. Register an OAuth App (`getff-dot-review-intake`), callback = `<intake_base_url>/oauth/callback` (fixed).
2. Authorization callback URL only; **request zero scopes** in the authorize redirect (`scope=` empty). Server exchanges code and calls `GET /user`; enrollment compares the immutable numeric `id` against `reviewer_principal`. Reject nonempty granted scopes in the token response.
3. Client secret → secret store.

### 3.4 Observer + armer identities

- Observer: a fine-grained PAT with **Administration: read-only** on `artyhoo/getff` only → `observer_token_ref`. It backs the configuration observer; workflow-integrity's warn-pass job stays what it is (GITHUB_TOKEN cannot read protection — measured PR #1102).
- Armer: separate fine-grained PAT with Pull requests **read and write** → `armer_token_ref`; arming uses GitHub's supported native-auto-merge operation — GraphQL mutation [`enablePullRequestAutoMerge`](https://docs.github.com/en/graphql/reference/mutations#enablepullrequestautomerge) with the pull request **node ID**. GraphQL has a single endpoint, so the egress allowlist is the **pinned operation document + variables** (repository ID, PR node ID, merge method `SQUASH`) — never caller-supplied input — plus reads; there is no per-action REST route to allowlist. Minimum-permission proof for enable-auto-merge is an S0 live probe (§5.3); if it cannot be demonstrated, arming stays operator-owned and Dot never arms.

### 3.5 Hosting, ledger, backups

- Provision the intake/publisher host + persistent volume; SQLite ledger + immutable report store (spec §8). Backups before upgrades; restore drill is an S4 receipt.
- Secrets: external store only (never repo source, never PR Actions secrets).

## 4. Dot credential-isolation checklist (P3)

Enumerate every GitHub-capable route reachable by Dot on the operator account and force it read-only or absent — shared plugin permissions are account-wide ([spec §3](../superpowers/specs/2026-10-05-dot-staging-review-gate-design.md)); a prompt is not a permission boundary.

1. Inventory ChatGPT-connected apps/plugins with GitHub access; record each and its scopes.
2. Downscope or disconnect every GitHub connector that carries repo write/administration; keep at most read-only public access.
3. Confirm no browser session in Dot's cloud environment holds an authenticated github.com session with write rights; log out/remove.
4. Confirm local computer access for Dot is disabled.
5. Live probe (§5.3): attempt a write through each remaining route from the Dot side; every attempt must fail with insufficient scope; record outputs as the P3 receipt.

If a needed isolation requires changing the operator's own account setup (account-wide downscoping), that tradeoff is presented to the operator as-is — it is preferable to pretending prompts enforce separation.

## 5. S0 live-proof runbooks (operator-supervised; separate authorization gates each)

### 5.1 Dot submission proof (P5)

1. Operator enrolls the reviewer identity (dedicated GitHub user, no repo collaboration/admin; record numeric ID).
2. Stand up a staging-intake instance (test origin, test challenge) from the S2 implementation.
3. Instruct Dot (actual account, own cloud env): claim at `<test-intake>/claim`, then submit a fixed sample payload to `<test-intake>/submit` with the issued challenge; unattended.
4. Receipt = intake log showing authenticated session, served challenge, accepted submission with envelope identity = enrolled numeric ID + timestamps. Re-run after deliberate session renewal to prove recurring login behavior is understood, not promised.

### 5.2 Native freshness matrix (P6) — disposable objects only, never staging/main

On a disposable branch `dot-s0-sandbox` + disposable ruleset:

| Row | Setup | Expected native outcome |
| --- | --- | --- |
| M-check success | App check success on current `refs/pull/N/merge` (+ strict) | squash merge admitted |
| head-only success | same check success published on head only, none on M | blocked (head fallback must not admit) |
| stale M | base advances immediately after M-success | blocked (new M lacks check) |
| wrong source | same context name from a different App / PAT / Actions | blocked (expected `app_id` mismatch) |
| alias PRs | two open PRs sharing head SHA on the sandbox base | record whether M is distinct per PR — distinct ⇒ per-PR authorization holds; shared M ⇒ STOP, alias policy decision (spec §6) |
| admin bypass | enforce_admins false + attempt merge as admin | documents the bypass; S5 closes it (no-bypass ruleset) |

Capture before/after refs, check IDs, app IDs, merge outcomes per row. A "blocked" must name the gate reason, not a conflict.

### 5.3 Permission-boundary probes (P3 tail, P8)

- Reporter App token → attempt check-run create (expect 403) and merge (expect 403); PR comment/issue create allowed.
- Publisher token → attempt contents push (expect 403); check-run create on M allowed; on H refused by code, not by permission.
- Armer token → attempt `enablePullRequestAutoMerge` on the probe PR through the pinned operation (expected allowed), then attempt a different mutation or an ad-hoc document from the same client wrapper (expect wrapper refusal — the allowlist is the operation document + pinned variables, §3.4).
- Observer token → read protection (allowed); attempt settings write (expect 403).

## 6. S5 promotion recipe (operator; only after S4 acceptance)

1. Snapshot current staging protection JSON + rulesets (observer read) → `pre-dot-snapshot.json`.
2. Activate native pause first: create ruleset `dot-review-pause` targeting exactly `refs/heads/staging`, active, require status check `dot-review/pause` (never produced), **no bypass actors**, and verify via observer read that it is active and binding (test on the sandbox first per §5.2 infra).
3. Update staging protection/ruleset: `strict: true`; required checks = reconciled mechanical six (`ci-success`, `fidelity-verdict-in-pr-body`, `stale-revert-in-pr-diff`, `Template render probes — P1/P4/P6 (deterministic)`, `capability PR carries Prior-art line in PR body (squash-survival)`, `§1.7 forward+backward sections present in PR description`) + `dot-review/v1` bound to the publisher `app_id`; `enforce_admins`/ruleset bypass: none; keep `allow_force_pushes:false`, `allow_deletions:false`; require PRs.
   - The disposable observation check-run (first successful publisher run) must exist before the context is selectable in the UI; verify binding via `required_status_checks.checks[].app_id` == publisher App ID — workflow-integrity's green is not configuration proof.
4. Keep the classic protection values until ruleset equivalence is proved by the observer, then remove the classic duplicate per spec §9 (rulesets layer with classic protection — do not silently drop other contexts).
5. Migrate docs in the same rollout contract: `automerge-staging-plan.md` (strict:false paragraph → strict:true + Dot admission contract), CLAUDE.md «Agent PR merge policy» (auto-merge still `--auto`, body never frozen, no `--body` with `--auto`), workflow-integrity comment block (note the externally published seventh context lives in the trusted manifest, NOT in the workflow-derived list — principle 37's grammar stays workflow-only), run-local-ci-sweep.sh REGISTRATION STATE note, and the §1.7/provenance operational notes. These are operator/maintainer-owned edits; implementation agents do not self-merge them.
6. Reconcile P7 receipts: registration of the three missing mechanical contexts at the same settings change.
7. Verify: observer read shows exact expected JSON; armer enrolls one authorized PR; remove pause requirement only after checks/reporting/configuration evidence is complete; observe the first authorized admission end-to-end.

## 7. Pause and rollback

- **Pause new admissions (native):** activate `dot-review-pause` ruleset (§6 step 2), verify active via observer, then service-pause (`PAUSED` flag stops claims/publications). Service pause alone does NOT stop an already-armed PR — native pause does; that ordering is mandatory.
- **Pause new claims only:** service pause flag; already-valid immutable admissions remain completed decisions (no native TTL).
- **Rollback (pause and repair, default):** keep native pause; fix services/config; re-verify with observer; resume. Removing the `dot-review/v1` requirement restores the weaker pre-Dot contract and requires an explicit operator decision (spec §11); disable auto-merge and cancel armed PRs while deciding.
- **Credential compromise:** revoke the affected App/key/session, rotate secrets, re-enroll; preserve ledger + report evidence throughout; mechanical requirements never removed during repair.

## 8. Evidence links

- Observed live platform state + doc verifications: [S0 evidence patch](research-patches/2026-10-05-dot-gate-s0-platform-evidence.md) (2026-10-05).
- Design + acceptance matrix: [spec §10](../superpowers/specs/2026-10-05-dot-staging-review-gate-design.md).
- Stage receipts land under `docs/meta-factory/` next to this file as stages close (S1–S5), each with commit/release SHA, commands, outputs, and RED→GREEN negative-test results.
