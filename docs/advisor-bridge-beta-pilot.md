# Advisor bridge beta — local pilot operation card

> **Status:** implementation ready; pilot NOT enrolled or run. Stage C waits for the senior's explicit pilot-run instruction tied to this card.
> **Authoritative for:** operating the local advisor bridge tracer on this host — enrollment inputs, launch card, limits, evidence recorded so far.
> **NOT authoritative for:** the behavior contract — [2026-10-06-advisor-reverse-bridge-tracer-design.md](superpowers/specs/2026-10-06-advisor-reverse-bridge-tracer-design.md); advisor rights and transport — [2026-10-06-advisor-codex-transport.md](superpowers/specs/2026-10-06-advisor-codex-transport.md).

## 1. What ships

- `scripts/advisor-bridge-beta/cli.mjs` — explicit pilot CLI; no watcher, no daemon, no polling.
- `scripts/advisor-bridge-beta/store.mjs` — validation, immutable artifacts, exclusive ownership, journal/state replay, local binding.
- `scripts/advisor-bridge-beta/process.mjs` — explicit-cwd child processes (argument arrays), bounded lifecycle, cessation proof, result capture.
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
| P4 live `--permission-prompts none` denial | deferred: the host classifier denied the probe spawn; help semantics documented; the pilot's first pass exercises the flag inherently |
| Advisor fork capture (`--sandbox read-only` + `-o`) | syntax-verified; live capture deferred to the pilot's consult cell (one fork per ask; a fork is a full advisor turn) |

Without the profile env a headless `-p` child reports `Not logged in` even though the profile exists in `~/.claude/settings.json` — do not rely on settings-env for bridge children; launch the bridge from a shell carrying the profile.

## 4. Launch card (exact argument arrays)

Executor launch (fresh pass), cwd = the enrolled executor worktree:

```text
claude --session-id <minted-uuid> --model glm-5.3 --permission-prompts none --output-format json -p "<task prompt>"
```

Executor resume (rework pass), only after the previous owned process is proven ended (bounded `wait` + post-exit `ps`, persisted in the attempt record):

```text
claude --resume <recorded-session-uuid> --model glm-5.3 --permission-prompts none --output-format json -p "<rework prompt>"
```

Identity validation: the child JSON's `session_id` must equal the requested UUID, else the attempt is UNKNOWN and nothing relaunches.

Advisor fork (consult cell), cwd = coordination dir; seed + model pin read live from `ADVISOR.md`, never stored (records carry `<redacted:live-advisor-md>`):

```text
codex --ask-for-approval never exec --sandbox read-only --cd <coordination-dir> --skip-git-repo-check \
  fork <seed-from-live-ADVISOR.md> --model <model_pin> -o <mailbox>/outbox/<askId>.candidate.json \
  "advisor role: judge the bounded ask at <askPath>; decide; output the decision. ..."
```

Never used: `--bg`, `--bare`, `--fork-session`, `--safe-mode`, permission bypass, shell-string interpolation, any new provider/API fallback.

## 5. Enrollment (real pilot)

```bash
node scripts/advisor-bridge-beta/cli.mjs --mailbox <anchor>/.claude/advisor-bridge-beta/<pilotId> \
  enroll --pilot-id <pilotId> \
    --senior-session 01a11094-b236-7553-841d-1c5c998e2393 \
    --executor-worktree <isolated executor worktree created before enroll> \
    --coordination-dir "$HOME/.claude-coordination/rules-as-tests-aif" \
    --repo-common-dir "$(git -C <anchor> rev-parse --git-common-dir)"
```

`status` shows the derived state (`taskState`: none → prepared → awaiting-report → reported → accepted; counters; hold reasons). `off` commits OFF under the same operation lock as admission; after OFF no launch, ring, resume or dependent transition is admitted; reads and journal/import recovery stay available.

Limits (enforced durably): one work item, one CC process at a time, ≤3 CC passes, ≤2 advisor calls, 20 min per process, 60 min admission window. `reconcile-lock` / `reconcile-attempt` are the only lock/UNKNOWN clearing paths — explicit, rationale-gated (≥20 chars), journaled; nothing stale is ever auto-deleted.

## 6. Deterministic coverage (all asserted on files/child effects)

`node --test tests/advisor-bridge-beta/protocol.test.mjs` — 21 tests, green ×3 consecutive runs.

| Required case | Test |
|---|---|
| two concurrent claim/run callers → one child launch | «two concurrent claim/run callers…» |
| same event replay returns its receipt | «journal replay…», «request submit…» (replay arms) |
| changed bytes under same ID fail | «request submit…» (digest conflict) |
| abandoned lock + unknown spawn hold | «abandoned operation lock…», «pre-existing reserved attempt…» |
| lost ACK does not relaunch | «lost capture…» |
| journal-only crash replays import without second advisor call | «journal-only crash…» |
| foreign/traversing/symlink-escaping paths fail | «path validation…» |
| old report/decision cannot advance revised request | «stale revision…» |
| OFF before resume → zero new launches | «OFF before run…» |
| zero exit with invalid/missing report does not pass | «zero exit with missing/invalid report…» |
| deadline never releases an unproven owner | «deadline kill never releases…» |

## 7. Limitations recorded before the pilot

- No live CC/advisor child has been driven through the adapter itself; deterministic tests use fake children. Real model executions are required for the pilot path.
- The live `--permission-prompts none` denial cell (P4) and the live read-only fork capture cell are exercised by the pilot's own first pass and consult checkpoint respectively.
- The attended loop only: if the senior is idle, the report stays pending; hand-copied payloads would be labeled assisted transport, not delivery.
- Same-user shell actors can bypass a cooperative bridge; this tracer does not certify hostile-worker confinement.
