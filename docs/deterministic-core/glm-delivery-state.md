# Deterministic core — GLM delivery state

> **Authoritative for:** live delivery state of the deterministic-core initiative under the
> 2026-10-15 GLM/AIF execution authorization ([`glm-full-execution.md`](../meta-factory/research-patches/2026-10-14-deterministic-skill-agent-audit/glm-full-execution.md))
> and the per-stage Codex review addendum ([`codex-stage-review.md`](../meta-factory/research-patches/2026-10-14-deterministic-skill-agent-audit/codex-stage-review.md)).
> **NOT authoritative for:** the agreed design, coverage map, kickoffs or approval records —
> those live in their own reviewed artifacts (SHAs pinned below).

## 1. Identity receipt (recorded at session start, first obligation)

| Field | Value | Evidence |
|---|---|---|
| Session ID | `b6564858-b47d-4563-9d79-1993b31a3550` | `env` → `CLAUDE_CODE_SESSION_ID=b6564858-…` exact-matches receipt `actualSessionId` and addendum's named active session; launcher's `--session-id` was ignored by `--bg` (stderr warning captured in `glm-execution-receipt.json`) |
| Model | `glm-5.3` | harness self-report ("powered by glm-5.3") + `env` → `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` (Z.AI provider) + launcher argv `--model glm-5.3`. Log grep NOT counted as independent (echoes own session text). |
| Permission mode | `auto` | launcher argv `--permission-mode auto`; no override/denial observed in-session |
| Effort | `xhigh` | `env` → `CLAUDE_EFFORT=xhigh` |
| Background job | `b6564858` name `deterministic-core-full`, pid 98014 | receipt `observedSession` |
| Checkout | `/Users/art/.codex/worktrees/deterministic-core-full/rules-as-tests-aif` | launcher cwd |
| Ref at start | `codex/deterministic-core-full` @ `9868fe507910d4905cfae59cdac9cfea8ea716c2` (declared base; fetched staging) | `git rev-parse HEAD` + `git branch --show-current` |
| First real commands | `date` → `LOCAL=2026-10-15 01:47:09 MSK dow=4` (off-peak, peak window Mon–Fri 09:00–13:00); transport verify → `total=80 ok=80 mismatch=0 missing=0` | tool receipts in session transcript |

Source checkout `/Users/art/.codex/worktrees/6612/rules-as-tests-aif` treated as read-only input
owner; no writes issued there (the launcher's receipt file there predates this session).

The accidental Python launcher text included in the first prompt was treated as provenance of
this session's birth, never executed, and will not be executed (operator clarification 2026-10-15).

## 2. Codex stage-review gate — ACKNOWLEDGED (operator clarification 2026-10-15)

Binding on EVERY stage (D0 and all later): prepare an immutable candidate; record exact
commit/PR head, diff, kickoff/spec references, executed checks, complete evidence, unresolved
findings, cumulative caps and next proposed action in this file; set state to
`awaiting-codex-stage-review`. No stage merge, no stage acceptance, no dependent-stage
dispatch before an explicit content-bound Codex GO against that exact content. GLM may repair
the same stage within caps; changed content returns for renewed review. Codex GO is necessary
and does NOT replace existing factory gates (independent fidelity review, CI, predecessor
merge gates, managed-PR ownership). Do not self-approve; do not treat silence as approval.
Already-approved input publication/transport and D0 preparation continue within existing
authority. Any adopted execution brief keeps its existing exact-content Codex approval gate.

## 3. Packet transport verification

`glm-input-transport.json` → 80/80 destination files present with exact SHA256 match
(`total=80 ok=80 mismatch=0 missing=0`, python3 hashlib over every manifest entry).
Key agreed inputs re-pinned: design spec `b30836da…d099e`, coverage `03770d84…93db`,
PRD/product-brief `4869eaee…d326`, kickoff `21ec5958…4d54`, kickoff-d0 `83b9f00b…6bb0`.
Container-side (AIF destination) transport NOT yet performed — see stage ledger.

**Host plan-preparation check — GREEN (2026-10-15, this session).** Read-only verb
`current-decisions.mjs --check-plan-prep` run against the canonical selector owner
(`--orch-home`/`--repo-root` = 6612 checkout, roots `6612,e220`), spec bytes SHA256
`b30836da…d099e`: `{"ok":true, attemptId:"565cd291f736…", prdSha256:"4869eaee…", specSha256:"b30836da…"}` —
exact match with the packet's `glm-host-plan-prep.json`. A bare run in THIS checkout is RED
by design (`matches_attempt_missing`: `print-orch-home.sh` resolves orch-home to the current
checkout, while the canonical selector lives only in 6612); verb verified read-only
(write-free grep over the verb implementation) before the 6612-rooted rerun.

**Publication repair round 1 (2026-10-15, Windows MAX_PATH).** First CI run on PR #2108
(head `bdd38a68614`) failed the Consumer-matrix Windows cell in 13 s: `git.exe` checkout
`unable to create file … Filename too long` — six arch-review input-snapshot filenames
(219–279 chars repo-relative) exceeded Windows MAX_PATH once the runner prefix was added.
Repair: stripped the redundant flattened path prefix from those six names (content bytes
unchanged, `@content-hash` suffixes unchanged), updated name references inside
`top-down-r1.md`, `intent-final.json`, `r1-inputs.txt`, `final-inputs.txt`, updated the
manifest's destination paths + the four edited records' sha256 rows, and recorded the
repair in the manifest's `postTransportRepairs` field. Longest packet path now 197 chars;
manifest re-verified **80/80 ok, 0 mismatch, 0 missing** after the repair. Repair commit
lands as a new commit on the same PR (published branch — no rebase); the Codex candidate
head moves to the repair commit.

**Publication repair round 2 (2026-10-15, principle-10 scope annotation + face-facts drift).**
CI round 2 on head `c33b882eaf0` surfaced two deterministic failures (full rollup read
via `gh pr view --json statusCheckRollup`, after the ci-wait heuristic exited 0 on a
truncated 11-of-38 read — its own ⚠ lines flagged the truncation):
1. `Principles as meta-tests (Phase 2)`: principle 10 requires a first-line
   `<!-- scope:<slug> -->` on every top-level research patch — the packet's
   `2026-10-14-deterministic-skill-agent-audit.md` lacked it. Repair: prepended
   `<!-- scope:deterministic-skill-agent-audit -->` (content otherwise unchanged);
   full test logic re-run mechanically over the population: 286 files, 0 violations.
2. `Manifest → RULES.md drift check`: `docs/site/face-facts.json` is a derived
   artifact (D42) — the packet's new patch/spec files moved the derived counts
   (patches 285→286, specs 113→115). Repair: `render-face-facts.mjs --write`;
   `--check` now byte-identical.
Manifest sha256 row for the annotated file updated (`fbaa9170…` → `c8e7dac1…`), repair
recorded in `postTransportRepairs`; the 6612 source-archive provenance in
`recovery-receipt.json` deliberately keeps the pre-annotation `archivedSha256`.
Manifest re-verified **80/80 ok, 0 mismatch, 0 missing** after the repair. Repair
commit `36596f1643d` (published branch — new commit, no rebase); Codex candidate
head moves to the PR tip including this repair.

**Operator coordination change (2026-10-15, mid-flight).** Periodic monitoring of this
delivery is disabled; no status-only prompts or polling will come from the operator side.
At each REAL stage READY the delivery session must hand the immutable candidate/head,
evidence, findings, caps and proposed next action to the existing Codex review chat
`01a13bf0-a4a9-7060-bc9d-f6e0eefcad54` through an ALREADY-SUPPORTED owner handoff — a
state-file update alone cannot wake the reviewer. Do not invent a bridge/scheduler/
watcher/new session; if no supported addressed delivery route exists in this harness,
report that exact handoff blocker at the safe boundary while preserving the stage gate
and any independent admitted work.

**In-flight probe (2026-10-15, before publication commit).**
`SLUG=deterministic-core bash .agents/procedures/dispatcher/helpers/probe-inflight.sh`
→ `VERDICT: PROBE-INCOMPLETE` — one arm unaskable (item d, container git branches:
Docker daemon unreachable from the Mac; contexts `desktop-linux` dead, `pc` = ssh).
Asked arms, all CLEAR of umbrella collision:
- (a) PRs: 4 slug-scoped open PRs all foreign non-colliding (#2067 one-button-w2,
  #2076 codex-contributor, #2079 pipeline-f1-reconciliation, #2097 docs-ssot S3);
  no PR publishes deterministic-core inputs (staging `git ls-tree` shows no entries).
- (b) branches: no remote branch matching `deterministic`; ahead-commits arm clear
  (local branch `codex/deterministic-core-full` unpublished at probe time).
- (c) parallel sessions: worktree scan — only THIS worktree matches the umbrella;
  no parallel CC session observed.
- AIF API substitute for the task side (docker arm compensation):
  `/tasks?limit=1000` → 407 rows; exact token `deterministic-core` → **0 hits**
  (an earlier substring `deterministic` match of 123 rows was prose in foreign
  umbrellas — superseded); non-terminal tasks both foreign
  (`open-issues-2026-09-fix-waves-meta-launch` blocked_external, `intent-t9-boundary` plan_ready).
- Residue: container-side git branches remain unverified until docker/arm-(d) is
  askable again; `--late` re-probe fires in the same turn as PR create.

**Coordinator-seat-delegation reconciliation (2026-10-15).** The
`coordinator-seat-delegation.md` card fired on aif-API polling. This session is NOT a
coordinator-seat over a delegated pipeline: per the delivery contract it IS the single
standalone delivery executor for publication/transport/stage-progression/evidence, and the
stage-review addendum forbids creating a second executor/scheduler/monitoring hierarchy.
Falls under the rule's own out-of-scope clause («sessions whose role IS the pipeline»);
chip-worker delegation would violate the operator's no-second-executor instruction.

## 4. Caps ledger (per contract; separate count per admitted batch; no renaming resets)

| Batch | Iterations used (max 5) | PARTIAL redispatch (max 2) | Clarifications (max 2) | State |
|---|---|---|---|---|
| input-publication | **2** (1: Windows MAX_PATH filename repair; 2: principle-10 scope annotation + face-facts regen, 2026-10-15) | 0 | 0 | awaiting-codex-stage-review (PR #2108) |
| d0-living-docs | 0 | 0 | 0 | not started |
| d1-rule-tests | 0 | 0 | 0 | not started |
| later-stage batches | — | — | — | not started |

## 5. Stage ledger

| Stage | AIF task IDs | Profile/model | Candidate head | Factory gates | Codex stage review | State |
|---|---|---|---|---|---|---|
| input-publication (docs→staging) | n/a (local) | n/a | PR **#2108**; heads per repair round: r0 `bdd38a68614` (85 files; §1.7 body; late probe LATE-CLEAR) → r1 `c33b882eaf0` (MAX_PATH) → r2 `36596f1643d` (scope annotation + face-facts) + state-record commit = PR tip (exact SHA delivered in the Codex handoff; `gh pr view 2108 --json headRefOid` is authoritative) | §1.7 PR body, CI, in-flight probes (+`--late`) | **awaiting-codex-stage-review** — candidate = PR #2108 tip; merge held for content-bound Codex GO | awaiting-codex-stage-review |
| input-transport (AIF dest) | n/a (transport) | n/a | — | hash verification at destination | evidence recorded here | pending |
| D0 living-docs | — | resolve ordinary GLM-5.3 (non-Flash) | — | fidelity review + CI + predecessor gates | required before merge/acceptance/dependent dispatch | pending |
| D1 rule-tests | — | — | — | same | required | pending |
| F2–F6 inventory/report + remaining | — | — | — | same | required per stage | pending |
| F7 coverage/benefit | — | — | — | same + benefit evidence (measured only) | required | pending |

## 6. Factual drift register (acknowledged, not blocking)

Local plan's September claim of zero open PRs vs nine observed open PRs at review time —
recorded as dated-evidence drift; product approval not reopened (per contract `<context>`).

## 7. Current status / next permitted action

- Done this checkpoint: required reading (full), host plan-prep GREEN (canonical roots),
  in-flight probe (asked arms clear; docker arm unaskable, recorded), coordinator-seat
  delegation rule reconciled (out-of-scope for this contract-assigned executor role),
  publication commit `bdd38a68614` pushed + PR **#2108** created (late probe LATE-CLEAR
  in the same turn). Pre-commit gates verified locally: all packet markdown < 600 lines
  (max 416, `osmani-complete.md`); staged kickoffs mode 100644; no secrets in packet
  (leaked-token value + generic patterns scanned, zero hits); research-patch index
  carries §1.7 Forward/Backward; both kickoffs carry §6 T-enumeration citations
  (principle 12 form). Hook fallback demanded a trailer — escape-hatch `Prior-art:
  skipped — documentation-only…` added (doc/md/json files only, no packages/ code).
- **State: awaiting-codex-stage-review on input-publication** (candidate = PR #2108
  tip after repair round 2 — CI round 2 exposed two deterministic failures, both
  repaired in `36596f1643d`; CI round 3 watched; merge held). D0 dispatch
  additionally waits for publication merge.
- Next permitted action without further permission (parallel, per addendum "publication/
  transport … may continue"): watch PR #2108 CI; transport + hash-verify inputs at the
  AIF destination through existing mechanisms; resolve the ordinary GLM-5.3 (non-Flash)
  profile; prepare D0 dispatch inputs.
- Not permitted without Codex stage GO: merge/accept any stage, dispatch dependent
  implementation stages. Not permitted at all: main merge, release publication, settings/
  provider changes, force push, rebase of published branches, check bypass, paid LLM in CI.

_Updated: 2026-10-15 ~02:35 MSK by session `b6564858` (GLM glm-5.3, xhigh, auto)._
