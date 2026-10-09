# Dot relay — runtime operation

> **Authoritative for:** runtime operation of the dot relay — exact CLI commands, opaque transport contracts, existing identities, durable OFF, uncertain-execution recovery, timer install, and the no-merge boundary.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../README.md#why-this-exists). Relay design semantics and the binding opaque amendment — see the state-dir `DESIGN.md` (`/Users/art/.local/state/getff-dot-relay/DESIGN.md`). Coordinator-side bridge duties — see `COORDINATOR-BRIDGE.md` in the same directory. Agent discipline — `.agents/roles/`.

The relay moves private review-derived work between the dot cloud chats and a local supervised executor, without any party printing packet contents. Implementation: `scripts/dot-relay/` (`contract.mjs`, `ledger.mjs`, `executor.mjs`, `cli.mjs`, `active-clock.py` (host-awake budget helper), plus the coordinator-side `bridge-runner.body.js`); tests: `node --test scripts/dot-relay/*.test.mjs`.

## HYBRID deployment limitation

Deployment mode is **HYBRID**, permanently recorded in the runtime `config.json`:

- The **coordinator** (root operator session) is woken by the owned launchd calendar timer `ai.getff.dot-relay` (six `StartCalendarInterval` firings at local hours 0/4/8/12/16/20, `RunAtLoad=true`, `KeepAlive=false`, never `StartInterval`) and drives the cloud tool transport by hand — the relay itself has **no cloud credentials and no cloud client**.
- The **executor** is one owned foreground GLM child (`/Users/art/.local/bin/glm`, model `glm-5.3`) supervised with exact pid/process-start/session identity; each solution execution deadline is 7200000 ms.
- Until the root coordinator supplies an activation receipt (`bridge-activated --automation-id …`), the runtime reports `bridge_pending=true` / status `PARTIAL_AWAITING_BRIDGE`. **Never claim a zero-token idle cloud relay** — cloud traffic only happens when the coordinator acts.

## Runtime root layout

`init --root ABS` creates (and later requires) exactly:

```
<root>/ledger.sqlite      transactional ledger (node:sqlite, WAL, schema user_version=1)
<root>/config.json        label, interval, deployment_mode HYBRID, source SHA
<root>/objects/<sha>.json published immutable envelope bytes, named by artifact sha256
<root>/spool/             in-flight upload state machines (<upload>.state.json, part temps)
<root>/inbox/<id>.json    metadata-put results (chunk-assembled, final-verified)
<root>/plans/bridge-plan.json   bounded metadata-only tick plan
<root>/worker/            supervisor lock, private child stdout/stderr/startup receipts (0600)
<root>/OFF.json           durable stop marker (when OFF)
<root>/timer.json         install-timer receipt
<root>/bridge-activation.json   coordinator activation receipt
<root>/bridge-runner-pin.json   reviewed pin of the deployed bridge-runner body (see below)
```

Root must be absolute, contain no literal `..` segment, and not itself be a symlink (`ROOT_NOT_ABSOLUTE` / `ROOT_TRAVERSAL` / `ROOT_SYMLINK`). Ancestor symlinks (macOS `/tmp`, `/var`) are environment topology, not a refusal reason.

## Commands

All commands: `node scripts/dot-relay/cli.mjs <command> --root <ABS> …`. Success prints one metadata-only JSON line (`ok:true` + ids/counts/digests); failure prints `{ok:false,code:"…"}` and exits 1; unknown flag/command exits 2. No payload excerpt ever reaches stdout.

| Command | Contract |
| --- | --- |
| `init` | create root/db/config + seeded baseline holds; idempotent for identical config, `CONFIG_MISMATCH` otherwise |
| `tick` | enter the exclusive scheduler transaction (R06: a live/unproven foreign owner refuses with a busy outcome, never overwrites); plan finite local work; reserve+launch a detached `supervise` child ONLY for a validated never-attempted QUEUED solution with a free slot; dispatch same-session recovery (below); no cloud calls, no model call on idle |
| `supervise --execution-id ID` | internal: drives one reserved execution to a terminal state (see executor section) |
| `plan` | write `plans/bridge-plan.json`; stdout = path + sha256 + bounded metadata-only detail for the bridge runner (pending `deliveries`, `manifests` with raw part refs, in-flight `pending_uploads` with resume offsets, `execution`); never contents |
| `spool-begin --id --artifact-sha256 --bytes` | requires the persisted manifest with exactly that id/hash/bytes; returns fresh `upload_id` |
| `spool-append --upload-id --chunk-json` | append decoded string chunk; ≤16 KiB per chunk; argument arrays only, never shell-evaluated |
| `spool-part-begin/--upload-id --ordinal --sha256 --bytes`, `spool-part-finish --upload-id --ordinal` | multipart ordinal discipline: only the next ordinal, identical replay ok, `PART_ORDER`/`PART_MISMATCH` otherwise |
| `spool-finish --upload-id --producer-role ROLE` | verify exact bytes against manifest digests (part + whole), publish `objects/<sha>.json` immutably, ingest privately; single-ref manifests close their implicit part 0 inline; drops the spool state file after success so later plans never re-offer completed uploads |
| `delivery-claim --id` | persist CLAIMED before any tool side effect; return metadata/ref only |
| `delivery-receipt --id --status sent\|not-sent\|uncertain --receipt-file PATH` | bind an adapter-generated receipt (JSON object with string `tool`); sent→SENT_ACCEPTED, uncertain→UNCERTAIN (never auto-retry), not-sent→bounded retry +4h/+8h then BLOCKED |
| `import-ack --file --producer-role` | import destination ACK (see opaque contracts) |
| `baseline-receipt --file` | exact running intake id + full report-key mapping |
| `manifest-import` / `snapshot-import` / `cursor-commit` / `receipt-import` / `index-import` | durable manifest/cursor closure per DESIGN; `index-import` checks the sha256 of the exact file bytes |
| `metadata-put --id --chunk-json --final true\|false` | opaque chunked metadata (≤16 KiB/chunk, ≤200000 B final); rejects `payload`/`body`/`kickoff`/`analysis` keys at ANY nesting depth; safe id charset only; path-only result |
| `bridge-activated --automation-id ID` | coordinator-only activation receipt; idempotent for the same id, `AUTOMATION_CONFLICT` for a different one; **never clears OFF** |
| `bridge-source --expected-sha256 SHA` | trusted-source loader for the coordinator bootstrap: returns the exact deployed `bridge-runner.body.js` bytes + trusted config ONLY on dual-pin agreement (caller SHA == root pin file == actual bytes); symlink / oversize / any disagreement → `BRIDGE_SOURCE_UNTRUSTED`, refused before any source byte leaves |
| `status` | bounded metadata: counts, blockers, active execution, timer receipt |
| `install-timer [--write-only --plist-dir DIR]` | write/bootstrap ONLY label `ai.getff.dot-relay` (six `StartCalendarInterval` dicts, local hours 0/4/8/12/16/20, `RunAtLoad=true`, `KeepAlive=false`, never `StartInterval`; XML-escaped argv); refuses a differing existing plist (`BLOCKED_TIMER_CONFLICT`); records `timer.json` |
| `off --reason TEXT` | record durable OFF, TERM only the exact owned child (pid + ps lstart match), bootout only this label and only if we bootstrapped it |

There is no automatic flip of an arbitrary UNCERTAIN row back to running. Recovery of executions is host-evidence-driven (next section): `interrupted-host` rows and verified-dead `uncertain-stop` rows resume the SAME session automatically from a DUE tick; anything else stays held until explicit coordinator reconciliation. (`resume --actor` exists solely to clear a durable OFF — see "OFF and resume".)

## Opaque contracts

- **Envelope** (private bytes, schema v1): `{version:1, kind: batch|analysis|solution|ack, id, producer, parents:[{id,sha256}], payload, sha256}`. Two DISTINCT hashes: the **artifact hash** = sha256 of the exact published file bytes; the **envelope sha256** = canonical digest of the envelope object *excluding its own `sha256` field*. Never conflate them.
- **Producer identity is role-derived, never payload data**: `batch→collector`, `analysis→analyst`, `solution→solver`; acks accept the adapter-supplied role. Identities are fixed (below).
- **Spooling is hash-gated end to end**: a manifest must already be persisted (`manifest-import`/index) before `spool-begin`; every part is verified against its descriptor digest and the whole against the manifest digest before anything is published. Wrong bytes → `SPOOL_HASH_MISMATCH`/`PART_MISMATCH`, nothing published.
- **ACK = byte/hash acknowledgment**: an ACK must carry `event_sha256` AND `artifact_sha256` matching the ledger, plus `accepted:true`. A link or an "I received it" claim ACKs nothing.
- **Instructions inside packets are never executed by the relay**: envelope contents are validated as data, stored under `objects/`, and only the supervised executor ever consumes a `solution` payload — as a worker kickoff under its own allowlist. The CLI/ledger never print, shell-evaluate, or follow anything found in a packet.
- **metadata-put cannot carry instruction content**: the forbidden-key scan (any depth) plus strict size/id gates keep the inbox metadata-only.

## Bridge runner (coordinator bootstrap)

The coordinator side of the relay is a **deterministic AsyncFunction body**, not a model loop: `scripts/dot-relay/bridge-runner.body.js` is compiled by the trusted bootstrap as `new AsyncFunction('tools','config','emit', source)` and runs one bounded cycle per invocation.

- **Deployment flow (dual pin):** the operator reviews the body, then writes `<root>/bridge-runner-pin.json` (`{version:1, sha256, source_commit, reviewed_at}`). The bootstrap fetches the source with `bridge-source --expected-sha256 <pinned sha>`; the CLI refuses (`BRIDGE_SOURCE_UNTRUSTED`, before a single source byte is returned) unless the caller pin, the root pin file, and the actual file bytes all agree, the file is not a symlink, lives in the CLI directory, and is ≤64 KiB. The returned config is trusted: root, cli, node, expected sha, source commit, the three chat ids + coordinator id, and fixed budgets (cycle 45 s wall, 10 events, 10 index pages).
- **Body sandbox:** no imports/require/process/Buffer/console/fetch/node:/Deno tokens anywhere in the source (enforced by test); the only surfaces are the three public cloud tools (`wait_threads`, `send_message_to_thread`, `chatgpt_space_read_page_reference`) and `exec_command`, which the body uses exclusively for env-wrapped, fully single-quoted invocations of this CLI scoped to `--root`.
- **Bootstrap validator:** the wrapper rejects any returned/emitted value that is not EXACTLY the fixed schema `{version:1, mode:'HYBRID', state, counts:{sources,deliveries,acks,executions}, blockers:[{code,event_id}]≤10, continuation}` (≤4096 B printable ASCII) → `BRIDGE_OUTPUT_REJECTED`; an exception outside the body → `BRIDGE_BOOTSTRAP_FAILED`. The body itself self-validates the same schema before emitting (a failure collapses to a minimal `BLOCKED`/`BRIDGE_EXCEPTION` object) and emits exactly once; the embedded marker comment must never appear in any output.
- **Cycle order:** `status` first (durable OFF → bounded `OFF` state, zero cloud calls) → one idempotent `tick` → `plan`; finish `pending_uploads` then pending deliveries BEFORE reading new cloud input; `wait_threads` exactly once for the three fixed targets; import `{type:'ack'}` messages; follow locator index chains; then fetch manifests discovered by a refreshed plan and commit the cursor.
- **Locator protocol (strict):** a thread message that is JSON and carries an `index`/`producer`/`status` key CLAIMS locator shape; it must validate exactly — keys exactly `{version:1, status:'READY', generation≥1, producer∈{collector,analyst,solver}, cursor_token 1-64 chars, index:{page_id,reference,sha256,bytes}}` — or the whole cycle is `WAIT` with `WAIT_PROTOCOL` (never a guess). Plain non-JSON chatter is ignored.
- **Chain and bytes:** each index page is fetched by reference and proven (sha256 + size, ≤200000 B) BEFORE materialization via chunked `metadata-put` + `index-import --expected-index-sha256`; artifact parts are spooled codepoint-safely (12 KiB chunks) through `spool-part-begin/append/finish`; an interrupted explicit part is re-begun (temp replaced), an interrupted implicit part resumes by skipping exactly the already-appended bytes.
- **Sends:** claim-first; message = delivery identity + both hashes + ordered opaque part refs. Outcome `sent` → receipt `sent`; `denied` (explicit `ACCESS_DENIED`) → inline fallback only when the whole packet is ≤49152 B (else `TRANSPORT_SIZE`, receipt `not-sent`); anything else → receipt `uncertain` + `SEND_UNCERTAIN`, never a blind retry (uncertain deliveries are no longer PENDING, so no later cycle re-sends).
- **Replay-aware progress:** repeat effects (CLI replay receipts) do not count; a cycle with no first-time effects reports `IDLE`. Budget exhaustion with work pending reports `continuation:true` — the coordinator simply runs another cycle.

## Existing identities (do not invent new ones)

| Role | Chat id |
| --- | --- |
| collector | `01a11aad-5df6-7663-ab3d-2e2055634093` |
| analyst | `01a11aac-a354-776a-b766-eb4f3047f082` |
| solver | `01a11adb-b74f-76f9-8f27-b231e7f31081` |
| coordinator | `01a11ae1-13c1-7522-9104-fddb8cb38d9a` |

Seeded ledger events: `DOT-BATCH-0001..0005` (state `BASELINE_HOLD`, null digest placeholders — resolved, never "changed digest", on real import) and intake `DOT-INTAKE-20261008-01` (`ACCEPTED_CONSUMPTION_UNKNOWN` until the exact baseline consumption receipt lands). Initial analyst cursor: `b80b6957-cf4d-434a-9581-33008606603b:5`. Source SHA: `35738554faf029e9fe3b8b4c25bfdde242f65c66`.

## OFF and resume

`off --reason` sets a durable OFF that survives restarts and blocks ALL admissions — ingest, delivery claims, execution claims, and manifest/snapshot/index imports (ACK-only `receipt-import` stays open so in-flight acknowledgments settle). `bridge-activated` records activation but cannot clear OFF. Resuming is a coordinator control action with evidence; OFF itself has no TTL and no auto-clear.

## Uncertain execution recovery

Executions that die without a durable terminal receipt hold their slot — never TTL-released, never blindly retried. Recovery is evidence-driven at two layers:

- **Host reconciliation (`reconcileHost`, run only by the owned scheduler tick)** decides each active row: `retain` (same boot, supervisor proven live), `adopt-monitor` (supervisor dead, exact child alive — a monitor adopts it, ZERO model spawns), `interrupted-host` (different boot — ids preserved for SAME-session resume), `uncertain-identity` / `uncertain-stop` (identity unprovable, or same-boot supervisor AND child dead with no receipt). Each decision carries the row's `session_id`.
- **Automatic same-session recovery from a DUE tick:** `interrupted-host` rows dispatch `supervise --resume` (SAME session, SAME worktree, next precharged attempt); `uncertain-stop` rows dispatch `--resume` ONLY when the `claude agents` census freshly PROVES that exact session gone (`verifiedDead`) — a live or unprovable census holds the row for a later tick. The supervise side re-proves session absence itself before admitting the attempt.
- **Supervisor lock (`worker/supervisor.lock`, R07):** ownership is acquired BEFORE any attempt reservation and reconciled conservatively — a previous-boot or proven-dead holder is taken over with the displaced bytes retained as `supervisor.lock.stale-<ts>` evidence; a live holder blocks (`SUPERVISOR_LOCK`), an unprovable one blocks (`SUPERVISOR_LOCK_UNPROVEN`). A stale lock therefore never blocks ordinary boot recovery and never burns a precharged attempt.
- **Explicit coordinator reconciliation** stays the path for everything else: `reconcileExecution({execution_id, evidence, decision})` where evidence must carry the exact session id and explicit operator/coordinator control prose; `CONFIRM_DEAD` moves the row to `ABORTED_UNCERTAIN` and frees the global slot.

Because `executions.solution_id` is UNIQUE, an aborted solution is **never re-run** — a repair round arrives as a NEW solution envelope (at most two recorded repair rounds per failure; a same-boot resume failure counts only when concrete — sleep/clock-death never does). A supervise child names its reserved row at open (`resumeReserved`); every other un-finished row found at process start is reconciled by the tick's host reconciliation — the safe direction is always "no second launch".

## No merge

The relay and the supervised executor **never merge, never arm auto-merge, never force-push** (`gh pr merge*`, `git push *--force*`, `git rebase*` are disallowed at the child allowlist level). `verifyPr` only VERIFIES: DONE requires the exact stable head SHA, base `staging`, OPEN non-draft, no auto-merge, not CONFLICTING, and nonempty required checks all `pass`. Merge authority stays exactly where the repo's merge policy puts it.

## Fixed failure codes (stdout, never prose)

`ROOT_NOT_ABSOLUTE` `ROOT_TRAVERSAL` `ROOT_SYMLINK` `ROOT_NOT_INITIALIZED` `CONFIG_MISMATCH` `SOURCE_ID_INVALID` `SOURCE_OFFSET_CONFLICT` `SOURCE_HASH_MISMATCH` `SOURCE_OVERSIZE` `UNKNOWN_MANIFEST` `MANIFEST_MISMATCH` `SPOOL_HASH_MISMATCH` `SPOOL_ENVELOPE_INVALID` `PART_ORDER` `PART_MISMATCH` `PARTS_INCOMPLETE` `PART_NOT_BEGUN` `CHUNK_OVERSIZE` `CHUNK_NOT_JSON` `CHUNK_NOT_STRING` `METADATA_OVERSIZE` `METADATA_NOT_JSON` `METADATA_FORBIDDEN_KEY` `BAD_ID` `UNKNOWN_UPLOAD` `UNKNOWN_DELIVERY` `DELIVERY_STATE` `DELIVERY_NOT_DUE` `RECEIPT_STATUS` `RECEIPT_SHAPE` `ACK_SHAPE` `ACK_MISMATCH` `ACK_ROLE_MISMATCH` `OFF` `EXECUTION_STATE` `UNKNOWN_EXECUTION` `CURSOR_PENDING_ITEMS` `CURSOR_UNKNOWN` `BLOCKED_TIMER_CONFLICT` `AUTOMATION_CONFLICT` `BAD_AUTOMATION_ID` `NO_CONFLICT` `CONFLICT_INPUT` — plus bridge-runner cycle blockers `WAIT_PROTOCOL` `SOURCE_BYTES_UNPROVEN` `TRANSPORT_SIZE` `SEND_UNCERTAIN` `SEND_DENIED` `BRIDGE_SOURCE_UNTRUSTED` `BRIDGE_EXCEPTION` `SPOOL_BEGIN_FAILED` `SPOOL_APPEND_FAILED` `SPOOL_PART_FAILED` `SPOOL_FINISH_FAILED` `CURSOR_COMMIT_FAILED` `INDEX_IMPORT_FAILED` `RECEIPT_WRITE_FAILED` — plus bootstrap-side rejection codes `BRIDGE_OUTPUT_REJECTED` `BRIDGE_BOOTSTRAP_FAILED` — plus executor blockers and uncertain reasons `BLOCKED_BASE_FETCH` `BLOCKED_STALE_BASE` `BLOCKED_BRANCH_EXISTS` `SUPERVISOR_LOCK` `SUPERVISOR_LOCK_UNPROVEN` `BLOCKED_LAUNCH` `BLOCKED_PERMISSION` `UNCERTAIN_SPAWN` `BLOCKED_STARTUP` `UNCERTAIN_IDENTITY` `CLOCK_UNPROVEN` `UNCERTAIN_STOP` `UNCERTAIN_RESUME_IDENTITY` `IDENTITY_UNPROVEN` `BLOCKED_RESUME_METADATA` `BLOCKED_RESUME_WORKTREE` `BLOCKED_DUPLICATE_PR` `TIMED_OUT_ACTIVE` `BLOCKED_CAPTURE` `BLOCKED_CHECK_POLICY` `BLOCKED_CI` `BLOCKED_PR_STATE` `BLOCKED_HEAD_MISMATCH` `BLOCKED_HEAD_MOVED`.

## Receipts and reporting

Private evidence lives under the runtime root (`timer.json`, `bridge-activation.json`, `worker/*` at 0600). Session-level reporting is metadata-only: `/Users/art/.local/state/getff-dot-relay/REPORT.md` + `status.json` carry status, source commit, test receipts, PR URL/head, timer receipt, `deployment_mode=HYBRID`, `bridge_pending`, and unresolved fixed codes — never report bodies, kickoff text, or packet bytes.
