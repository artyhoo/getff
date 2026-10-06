# Advisor bridge beta — local pilot operation card

> **Status:** implementation reworked per senior Stage B re-review (findings R1–R7 on top of the accepted S1–S7/C1–C3 corrections); pilot NOT enrolled or run. Stage C waits for the senior's explicit pilot-run instruction tied to this card.
> **Authoritative for:** operating the local advisor bridge tracer on this host — enrollment inputs, launch card, limits, evidence recorded so far.
> **NOT authoritative for:** the behavior contract — [2026-10-06-advisor-reverse-bridge-tracer-design.md](superpowers/specs/2026-10-06-advisor-reverse-bridge-tracer-design.md); advisor rights and transport — [2026-10-06-advisor-codex-transport.md](superpowers/specs/2026-10-06-advisor-codex-transport.md).

## 1. What ships

- `scripts/advisor-bridge-beta/cli.mjs` — explicit pilot CLI; no watcher, no daemon, no polling.
- `scripts/advisor-bridge-beta/store.mjs` — validation, immutable artifacts, exclusive ownership, observed git binding, journal/state replay, task-progression gate, structured report envelope, local binding.
- `scripts/advisor-bridge-beta/process.mjs` — explicit-cwd child processes (argument arrays), bounded lifecycle (serialized spawn + awaited completion), cessation proof, runtime model-evidence validation, result capture.
- `tests/advisor-bridge-beta/protocol.test.mjs` — deterministic temporary-filesystem/process tests, Node built-ins only (`node --test`).

Runtime state lives ONLY in the enrolled anchor's `.claude/advisor-bridge-beta/<pilotId>/` (gitignored). No dependency was added; no package, settings, installer, hook, skill or AIF file was touched.

## 2. Environment preconditions (measured on this host, 2026-10-06)

| Component | Version / value | Evidence |
|---|---|---|
| claude CLI | 2.1.286 at `/Users/art/.local/bin/claude` | `claude --version` |
| codex CLI | 0.160.0 | `codex --version` |
| Node | v24.3.0 | `node --version` |
| GLM profile | `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` + `ANTHROPIC_AUTH_TOKEN` in the launching environment (present by name in `~/.claude/settings.json` `.env` and operator shell rc) | probes P1–P3 below |

The bridge inherits the profile from its launching shell and never searches for, reads or prints credentials. A missing profile variable blocks the launch with a narrow precondition error — no provider switch, no fallback.

## 3. Stage A runtime probes (live, 2026-10-06)

| Cell | Result |
|---|---|
| P1 fresh `-p` + explicit `--session-id` + `--output-format json` | exit 0; `session_id` echoes the requested UUID; real answer |
| P2 exact-ID `--resume` after `wait` + post-exit `ps` | same session id; context carried; `alive_after_wait=no` |
| P3 `--model glm-5.3` pin | `modelUsage` key `glm-5.3`; honored |
| P4 live `--permission-prompts none` denial | unverified: the host classifier denied the probe spawn; a successful pass under the flag does NOT prove a denied request. Preserved as unverified until a legitimate permitted verification route exists |
| Advisor fork capture (`--sandbox read-only` + `-o` + `--output-schema`) | syntax-verified; live capture deferred to the pilot's consult cell (one fork per ask; a fork is a full advisor turn) |

The `glm-5.3` label echoed in `modelUsage` proves the client-reported label only, not the server's internal model; the adapter rejects captures whose reported model evidence is missing or mismatched. Without the profile env a headless `-p` child reports `Not logged in` even though the profile exists in `~/.claude/settings.json` — launch the bridge from a shell carrying the profile.

## 4. Launch card (exact argument arrays)

Executor launch (fresh pass), cwd = the enrolled executor worktree. The initial pass prompt MUST equal the prepared request body. A rework pass MUST be `--resume` of the proven-ended session with the NEXT instruction revision's body as the prompt — the REWORK verdict requires the senior to publish a newer request revision first, and the attempt/report bind to that revision:

```text
claude --session-id <minted-uuid> --model glm-5.3 --permission-prompts none --output-format json -p "<prepared request body>"
claude --resume <recorded-session-uuid> --model glm-5.3 --permission-prompts none --output-format json -p "<next instruction revision body>"
```

Identity + evidence validation: the child JSON's `session_id` must equal the requested UUID AND `modelUsage` must report the configured `glm-5.3` model, else the attempt is UNKNOWN and nothing relaunches. The spawn happens INSIDE the operation lock together with the OFF check (the serialized launch boundary — OFF and launch cannot interleave), for executor and advisor children alike; the running pid is persisted at spawn time (not only at completion) so OFF termination and reconciliation bind to the exact process. A pid-less reservation is never treated as proof that no process started: only an affirmative serialized record (spawn failure, OFF-before-spawn) or proven cessation of a recorded pid resolves it.

Advisor fork (consult cell), cwd = coordination dir; seed + model pin read live from `ADVISOR.md`, never stored (records carry `<redacted:live-advisor-md>`). The ask is immutably bound to the current request revision+digest; the capture must satisfy the identity contract (`role: "advisor"`, exact `askId`, exact `inputDigest`); the fork's live pid is persisted and its recorded capture status governs import:

```text
codex --ask-for-approval never exec --sandbox read-only --cd <coordination-dir> --skip-git-repo-check \
  fork <seed-from-live-ADVISOR.md> --model <model_pin> \
  --output-schema <mailbox>/outbox/<askId>.schema.json \
  -o <mailbox>/outbox/<askId>.candidate.json \
  "advisor role: judge the bounded ask at <askPath>. Respond ONLY with JSON {\"role\":\"advisor\",\"askId\":\"<askId>\",\"inputDigest\":\"<digest>\",\"answer\":\"<decision>\"} matching the output schema. Do not modify any files — the adapter imports your captured output. Ask: <question>"
```

Never used: `--bg`, `--bare`, `--fork-session`, `--safe-mode`, permission bypass, shell-string interpolation, any new provider/API fallback.

## 5. Enrollment and the attended loop

```bash
node scripts/advisor-bridge-beta/cli.mjs --mailbox <anchor>/.claude/advisor-bridge-beta/<pilotId> \
  enroll --pilot-id <pilotId> \
    --senior-session 01a11094-b236-7553-841d-1c5c998e2393 \
    --executor-worktree <isolated executor worktree created before enroll> \
    --coordination-dir "$HOME/.claude-coordination/rules-as-tests-aif" \
    --repo-common-dir "$(git -C <anchor> rev-parse --git-common-dir)"
```

Enrollment OBSERVES the physical git common directory of both the mailbox anchor and the executor worktree (via `.git` pointer and `commondir` file) and rejects a declared binding that does not match — nonexistent or foreign repositories fail at enroll.

Loop commands: `request` (prepared revision) → `own` → `run` (initial: prompt = request body) → `ask --work-key KEY` (consult checkpoint; `status` shows `consult-pending`; no new pass while an ask is open) → `consult-run` → `consult-import` → `report-import` (structured envelope, below) → `decide` (senior only). REWORK verdict → the senior publishes the NEXT instruction revision → `run --resume` with that revision's body as the prompt (an attempt is bound to its instruction revision; an identical rework retry replays its receipt, it does not launch again). ACCEPTED ends the work item; no further passes.

Report envelope (`report-import`): `--request-digest` must equal the current request digest; `--actor` must be the owner token; `--owner-ack` required. PARTIAL/DONE require `--artifact PATH=SHA256` and `--evidence "CMD=>EXIT"` entries; DONE additionally requires `--pass-id` of a completed pass bound to THIS work item and the CURRENT instruction revision (an older revision's pass never certifies a newer instruction, even with an identical request body/digest) and the consult chain (`--consult-decision` bound to the same workKey + revision + digest + `--application-ack`). BLOCKED requires `--blocker` and may legitimately precede any owned pass. Identical retries (timestamps reconstructed) return the existing receipt.

OFF: `off --actor ACTOR` commits OFF, then terminates EVERY exactly identified controlled owned child — executor passes AND advisor forks (SIGTERM, bounded 5 s cessation wait) — records them `interrupted` (HOLD), reports unprovable kills (`unproven`) and pid-less uncertain reservations (`uncertain`). The spawn boundary itself is serialized with OFF under the operation lock, so no controlled child can start after OFF commits. After OFF: late report ingestion and journal/import recovery stay available; new launches, resumes, rings and acceptance (`decide`) are blocked.

Limits (enforced durably): one work item, one CC process at a time, ≤3 CC passes, ≤2 advisor calls, 20 min per process, 60 min admission window. Recovery paths are explicit and evidence-gated: `reconcile-lock` (NOT under the lock itself; a live holder pid is refused) and `reconcile-attempt` (marks `abandoned` with proven cessation of a recorded pid OR an affirmative serialized never-started record — a missing pid alone is never proof; marks `completed` only with captured stdout proving session identity, model evidence and trusted capture; a rationale string alone never marks an attempt safe). Import respects the fork's recorded capture status: invalid, uncertain or interrupted captures stay OPEN/HOLD, and any pre-existing conflicting Answer bytes reject before a receipt. Nothing stale is ever auto-deleted.

## 6. Deterministic coverage (all asserted on files/child effects)

`node --test tests/advisor-bridge-beta/protocol.test.mjs` — 41 tests, green ×3 consecutive runs.

| Required case | Test |
|---|---|
| two concurrent claim/run callers → at most one child launch | «two concurrent claim/run callers…» |
| same event replay returns its receipt; changed content under the same event ID rejects (S7) | «S7: identical event replay…» |
| changed bytes under same request ID fail | «request submit binds digest…» |
| abandoned lock + unknown spawn hold; explicit evidence-gated clearing | «abandoned operation lock…», «pre-existing reserved attempt…», «C3: reconcile-lock refuses…», «C3: an attempt cannot be marked…» |
| lost ACK does not relaunch | «lost capture…» |
| OFF during an owned pass: scoped termination, pid persisted while running, interrupted HOLD, late ingestion allowed, acceptance blocked (S1) | «S1: OFF during an owned pass…» |
| OFF reports uncertain reservations and terminates a live advisor fork; fork pid persisted while running (R1) | «R1: OFF reports uncertain reservations…» |
| OFF before a new pass → zero launches | «OFF before run…» |
| pid-less reservation is never proof of no spawn; affirmative records resolve it (R2) | «R2: a pid-less reservation…» |
| journal-only crash replays import without any advisor child | «journal-only crash…» |
| journaled answer survives outbox tampering; replay stays consistent (C2) | «C2: the journaled answer…» |
| conflicting partial Answer bytes reject before any receipt; evidence preserved (R6) | «R6: conflicting partial Answer bytes…» |
| import respects a recorded invalid fork capture (R7) | «R7: import respects a recorded invalid fork capture» |
| capture identity contract: wrong digest / foreign role / unreserved capture / stale ask (S2) | «S2: a capture with a wrong input digest…», «S2: import refuses…» |
| report delivery envelope: owner, digest, ACKs, artifacts/evidence, DONE needs owned pass + consult (S3) | «S3: the report envelope…», «S3+C1: a full DONE envelope…» |
| identical report/ask/verdict retry returns the existing receipt (C1) | «C1: identical report, ask and verdict retries…» |
| launch progression: no request → reject; identical completed run replays; consult-pending checkpoint (S4) | «S4: run without a prepared request…», «S4: an identical completed launch…», «S4: an open ask…» |
| REWORK → next instruction revision → same-session resume; old-report acceptance rejected (R3/S4) | «R3: REWORK advances to the next instruction revision…» |
| an instruction admits only its owned attempt; sequential + concurrent rework duplicates (R4/S4) | «R4: an instruction admits only its owned attempt…» |
| DONE binds pass and decision to the exact current instruction revision, not just digest (R5) | «R5: DONE binds the pass and the decision…» |
| model evidence: missing/mismatched reported model blocks advancement (S5) | «S5: a mismatched client-reported model…» |
| physical git identity observed at enroll; foreign/nonexistent/anchorless bindings fail (S6) | «S6: enrollment observes physical git identity…», «enroll creates pilot config…» |
| traversal / symlink escape fail | «path validation…» |
| stale report cannot close a revised request; stale consultation decision cannot back a new DONE | «stale revision: old report…» |
| zero exit with invalid/missing report does not pass | «zero exit with missing/invalid report…» |
| deadline kill never releases an unproven owner | «deadline kill never releases…» |

## 7. Limitations recorded before the pilot

- No live CC/advisor child has been driven through the adapter itself; deterministic tests use fake children. Real model executions are required for the pilot path. The spawn-gap serialization (R1) is established structurally (spawn under the OFF-shared lock) and evidenced by both-role pid-persistence/termination cells, not by an interposed-scheduling probe.
- P4 (a live `--permission-prompts none` denial) stays unverified; the pilot's first pass exercises the flag inherently but cannot prove a denial occurred.
- The live read-only fork capture is exercised by the pilot's own consult checkpoint.
- The attended loop only: if the senior is idle, the report stays pending; hand-copied payloads would be labeled assisted transport, not delivery.
- Same-user shell actors can bypass a cooperative bridge; this tracer does not certify hostile-worker confinement.
