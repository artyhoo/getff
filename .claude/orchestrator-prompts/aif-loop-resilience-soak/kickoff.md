# aif-loop-resilience-soak — autonomous self-healing soak run

> **Type:** Soak / chaos-resilience harness for the `/dispatcher` + `/aif-doctor` loop. Runner = CC `/dispatcher` (or `/loop`) self-pacing session, NOT an aif worker. Base: staging.
> **Goal:** the dispatch→monitor→Q&A→harvest→gate→advance loop runs unattended for hours with **zero stalls/pauses/freezes** — every failure is detected → triaged by `/aif-doctor` → non-destructively healed → loop continues; every gap is **logged + fixed in the tooling** so it never needs a human touch again.

## §0 Why this exists (seed evidence)

The 2026-06-04 ai-doc-audit run (C2-R → C3) proved the loop WORKS end-to-end through a flapping Clash/VPN tunnel — but needed operator nudges at 3 points that should have been autonomous. This soak hardens those out. The empirical failure-mode catalogue from that run is the seed (§3).

## §1 Operating contract (DECIDED — do not re-litigate; rationale inline)

1. **Runner = CC session, not aif worker.** The dispatcher loop inherently runs in CC (it dispatches TO aif). An aif worker editing the dispatcher/doctor skills is `#circular-dogfood` (the parked `dispatcher-skill-meta-launch` task `c67a4343` documents exactly this). So: **soak RUNS in this CC session via `ScheduleWakeup` self-pacing; aif executes the WORK the soak dispatches.**
2. **Autonomy contract (codified `feedback_autonomous_detect_doctor_continue_nondestructive`):** on ANY aif anomaly → `/aif-doctor` **immediately** (not "next poll") → apply non-destructive fix → continue. **No pauses for non-destructive fixes.** Discriminate stall-vs-lag by ≥2 signals (`activeTaskCount`, process presence, log-activity freshness) — never wait-and-see when signals are unanimous.
3. **Destructive ops = PARK-and-continue, never auto-execute, never block.** DELETE task / force-push / container rebuild / cap-bump = destructive. During unattended soak: **do NOT execute** (respects `stop-surface-not-hack`), **do NOT block the loop** — log to the soak journal as `ATTN-MORNING` and continue with the next scenario. The operator reviews `ATTN-MORNING` items at wake. This satisfies "no stops" (loop never halts) AND "no silent destruction".
4. **Hardening edits = CC/operator, not aif-dispatched** (`#circular-dogfood` again). The soak LOGS each gap; the fix to `/aif-doctor` §3 / `/dispatcher` SKILL / config is applied by the CC orchestrator (this session) at the end of each round or at soak close.
5. **Work-source = minimal real doc-hygiene micro-tasks + ≤3 genuinely-undone curated umbrellas.** NOT the raw `~/.claude-coordination/*` pending list (mostly stale-done → dedup no-ops, low soak value). The soak's purpose is to EXERCISE the failure/heal paths, so each micro-task is a 1-line real doc touch → real push → real harvest (full network/push/harvest/conflict path, repeatable, minimal token cost). Synthetic-but-real-push is justified here (unlike the `aif_question_loop` synthetic-fork token-burn) because the resilience proof IS the deliverable.

## §2 The soak loop (per round)

```text
1. Pick next scenario from §2.1 rotation
2. Dispatch (real micro-task or curated umbrella stage)
3. Monitor (single-poll-per-turn, self-paced ScheduleWakeup)
4. On anomaly → /aif-doctor → classify → non-destructive fix → continue  [contract §1.2]
5. On done → harvest via aif-local→host (network-flap-resilient path)
6. Log outcome + any intervention to soak journal §4
7. If gap found (manual touch needed / new failure mode) → record in journal as HARDEN-TARGET
8. Loop to 1 (next scenario) — never halt; destructive → ATTN-MORNING + continue
```

### §2.1 Scenario rotation (exercise DIFFERENT failure paths)
Rotate so the soak hits varied modes, not the same one repeatedly:
- **S1 push-path:** trivial doc-touch micro-task → dispatch → harvest. Exercises container→github, harvest, PR, merge.
- **S2 network-flap recovery:** dispatch during/after a github-unreachable window; confirm strict_base_update=false lets branch-isolation continue, claude-probe recovers when net returns.
- **S3 conflict-path:** dispatch two micro-tasks touching the same file → second harvest hits merge-conflict → auto-resolve via rebase OR new-branch (non-force).
- **S4 orphaned-task:** detect a stuck `implementing` (activeTaskCount:0 + no process + frozen tokens) → harvest-from-volume directly (the gap that needed a nudge this session).
- **S5 stale-pending dedup:** dispatch an already-done umbrella → confirm dedup guard marks ALREADY-DONE without surfacing a question.
- (Add Sn as new modes are discovered — §3 grows on incidence, T-AIFDOC-B.)

## §3 Seed failure-mode catalogue (2026-06-04, with coverage status)

| # | Mode | Detect | Non-destructive fix | Covered today? |
|---|---|---|---|---|
| 1 | container can't reach github (Clash fake-ip `fc00::` not routable from container) | container curl github 000, host 200, DNS `fc00::N` | `/etc/hosts` Clash IPv4 fake-ip + `extra_hosts` in docker-compose.override.yml | ad-hoc → **HARDEN: /aif-doctor §3 new mode** |
| 2 | SSH origin + no ssh binary in container | `cannot run ssh` | `git config url.https.insteadOf` (Tier-1) | doctor §4 Tier-1 ✓ |
| 3 | branch-isolation hard-fail | `base_update_failed strict_base_update=true` | set `strict_base_update: false` in `.ai-factory/config.yaml` (volume) | ad-hoc → **HARDEN: doctor §3 mode + note it's volume-durable** |
| 4 | whole-tunnel-down → claude-probe timeout → crash-loop in planning | `Timed out while probing CLI`, token flat | name+stop (operator net) OR wait for net | doctor §3.3 ✓ (but probe-timeout symptom not in catalogue → **HARDEN**) |
| 5 | **orphaned `implementing`** — worker gone, status stuck (flap killed status-PUT) | `activeTaskCount:0` + no process + frozen tokens, not parked | harvest-from-volume directly (work already committed) | **GAP → HARDEN: doctor §3 NEW mode + dispatcher orphan-detect** |
| 6 | harvest push: actionlint/zizmor missing in container | pre-push hook fails on missing bin | land-from-host (aif-local fetch → host push) | dispatcher ⚡ rule prose ✓ (but not in harvest.ts → **HARDEN: bake aif-local fallback**) |
| 7 | git-safety blocks force-push / --no-verify / compound `gh pr merge` | hook 🛑 | new-branch instead of force-push; separate create+merge | ad-hoc → **HARDEN: dispatcher §2.4 note non-force harvest pattern** |
| 8 | merge-conflict on harvest (branch behind staging) | `mergeStateStatus: DIRTY` | rebase+resolve OR new-branch | **GAP → HARDEN: dispatcher §2.4 conflict-handling step** |
| 9 | monitor-classify UNKNOWN on `plan_ready`/`review`/orphaned | `UNKNOWN:*` from helper | n/a (classifier gap) | **GAP → HARDEN: monitor-classify.sh add plan_ready/review/orphaned states** |

## §4 Soak journal (the running record)

Append-only log at `.claude/orchestrator-prompts/aif-loop-resilience-soak/soak-journal.md` (CANON). One row per round:
```text
<ts> | scenario=Sn | taskId=<8> | outcome=HEALED|CLEAN|ATTN-MORNING | mode=#N | fix=<one-line> | harden-target=<file:section or none>
```
`ATTN-MORNING` rows = destructive ops the operator must approve at wake. `harden-target` rows = the gap-fix list for §5.

## §5 Hardening deliverable (applied by CC orchestrator, NOT aif — §1.4)

At soak close (or incrementally each round), turn `harden-target` rows into patches:
- **`/aif-doctor` §3:** add new empirically-observed modes (orphaned-task, github-container-block, claude-probe-timeout, merge-conflict-harvest) with detect→fix→reversibility. Grow on incidence (T-AIFDOC-B), never speculatively.
- **`/dispatcher` SKILL:** §2.4 harvest = bake the aif-local→host fallback + non-force-on-conflict + orphan-detect (activeTaskCount:0 + no-process + frozen-tokens → harvest-from-volume).
- **`monitor-classify.sh`:** add `plan_ready`/`review`/orphaned classification (no more `UNKNOWN:*`); add a test in `packages/core/skills/dispatcher/monitor.test.ts`.
- **config durables (already done this session, verify):** `strict_base_update:false`, `extra_hosts`, `GIT_CONFIG_*` insteadOf, `aif-local` remote.
- Each harden-patch ships as its own atomic PR via the same loop (dogfood — but the SKILL edits, being circular, are pushed by CC not aif).

## §6 Success criteria
- Soak runs ≥N rounds (operator sets N or "until morning") with **zero loop-halts** (every non-destructive failure auto-healed).
- Every distinct failure mode hit is either (a) already-covered or (b) logged as harden-target + fixed.
- `monitor-classify.sh` returns zero `UNKNOWN:*` at soak end.
- `ATTN-MORNING` list (destructive ops) is non-empty only for genuine destructive decisions, each with evidence.

## §7 Disciplines (mandatory)
- AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)): T3 (verify inputs — the stale-branch-content bug this session), T2 (run the methodology, don't just design it), T19 (own cold-QA before each harden-PR handoff), **T-soak-A**: «token-display lag ≠ stall — discriminate by activeTaskCount+process+log-freshness before triage; but DON'T let lag-caution defer a real stall (the 2026-06-04 orphan gap)».
- Every harden-claim carries command+output (no prose-only).
- §self-application: does the soak itself stall? If the soak loop ever halts on a non-destructive condition, that IS a finding.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
