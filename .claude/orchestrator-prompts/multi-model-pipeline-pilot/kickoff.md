# multi-model-pipeline-pilot — kickoff (RE-SCOPED 2026-07-23, r2: self-referential carrier + full-pipeline contour)

<!-- bridge-profile: Z.AI GLM-5.2 -->

> **Umbrella:** `multi-model-pipeline-pilot`. **Status:** GO received (operator, 2026-07-23) — dispatch OFF-PEAK only (§5 quota discipline).
> **Re-scope note:** re-pointed 2026-07-23 from the P3/P1/P2 GLM-**quality** probes to a **whole-pipeline mechanism-parity audit**. The quality-probe design is preserved in the decision record [§3 Fork-5/6](../../../docs/meta-factory/research-patches/2026-07-21-multi-model-pipeline-decisions.md) for future revival (T17). r2 (same day, operator directive): the carrier task **IS the audit** — no throwaway diff — and the audited contour extends to the **entire pipeline from `/arch`**, with a mandatory **root-cause** for every failing row.
> **Goal:** one self-referential run — dispatch ONE aif task whose *work product is the in-container audit evidence itself* — exercising every leg of the pipeline (`/arch` design+review → tier routing (D1 marker) → `/pipeline` → `/dispatcher` → aif/GLM execution → shields at commit/push → harvest → fidelity acceptance → PR gates), and produce a **two-axis parity checklist + root-cause map**: per channel, (A) did it **engage** (wiring), (B) how did **GLM handle it** (behavioral), (C) for every non-SAME row — **why**, diagnosed while the evidence is fresh.
> **Binding inputs:** decision record F-B (GLM `Z.AI GLM-5.2` is the prod aif profile; 17 tasks done) + F-C (aif runs the CC harness, one process-global `ANTHROPIC_BASE_URL`); hook census [zcode-parity-doctrine.md §2](../../rules/zcode-parity-doctrine.md) (**row-set source only** — T-AIP-D); the acceptance contour ([agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) + `pr-body-fidelity` gate, PRs #1102/#1106; required-check registered in staging protection 2026-07-23 → the [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) D1 always-marker exception is ACTIVE, which this kickoff's own `bridge-profile` marker exercises).

## §1 Design: the carrier IS the audit (self-referential economy)

Two birds, one dispatch. The aif worker's task is not a stub — it is **the S2 in-container audit protocol** (§2b). Its diff is the audit's own evidence file (a real research patch that MERGES, not a throwaway); its journey through the pipeline is itself the test of every pipeline leg. Nothing is spent twice: the run tests the machine AND collects the map. Root-cause comes with it almost free — the worker diagnoses *why* a channel is silent while it is still inside the container (re-deriving that later from outside costs far more).

## §2 The parity question (two independent axes — frame precisely, avoid T16)

aif runs the **Claude Code harness** (`claude` CLI) in a Docker container, model swapped to GLM-5.2 via a process-global `ANTHROPIC_BASE_URL` (F-C, aif-handoff `packages/runtime/src/adapters/claude/options.ts:266-272`). So "does aif support hook X?" is the **wrong** question — the harness is CC, the event *type* exists. The right question has **two independent axes**, kept separate in the deliverable (§4) so a verdict never hides which failed:

1. **Wiring axis — did the mechanism engage in the container?** Two stoppers even when the hook file ships in the repo: (a) not **registered** in the container's `.claude/settings.json` — the file **is** git-tracked and travels to the staging-synced container, but it is maintainer-authored (agents deny-listed from editing it, `.claude/settings.json:52`), and a shipped hook can go **unwired** (CLAUDE.md:183: `WorktreeCreate` shipped in PR #279, never registered); (b) the container runtime must load it and have its deps (node/tsx/PATH). VERIFY against the container's **actual** settings + runtime — never infer from repo file-presence.
2. **Behavioral axis — how did GLM handle it once engaged?** Honors the injected rule? Fixes on shield feedback rather than bypassing? "Engaged" ≠ "handled well". A third sub-mode lives here (§4 `MISSERVES`): mechanism engages, GLM "obeys", yet the CC-tuned mechanism is counterproductive under GLM.

## §2b aif-task scope — the in-container worker protocol (what the dispatched task actually does)

The dispatched worker executes ONLY this (S0/S1/S3/S4 are host-side — see §3; do not attempt them from inside):

1. **Wiring dump (read-only):** from the task worktree — `jq '.hooks' .claude/settings.json` (registered set), `ls .claude/hooks/*.sh` (shipped set), `command -v node npx tsx jq gh` + `echo $PATH` (deps). Diff registered-vs-shipped: every shipped-but-unregistered hook is a `NOT-REGISTERED` row with root-cause "absent from container settings.json".
2. **Injection self-report:** quote VERBATIM every injected context block visible in your session (session-bootstrap digest, output-language line, any `📎 Path-relevant rule` PostToolUse injects, subagent-context). For each expected inject that is absent — record absent. (Honest limitation: self-report; flagged as such in evidence.)
3. **Paired-negative shield probe (RED before GREEN, then revert):** stage a deliberate cheap violation and attempt to commit it — e.g. a markdown file pushed past 600 lines (pre-commit md-gate) AND an `.claude/rules/`-style file missing its `Authoritative-for:` header (edit-time/`check-doc-authority` surface). Record the hook's actual output (or its silence — a silent gate on a violating input is a `FIRED`-expected-but-silent finding with root-cause). REVERT the probe artifacts completely before the real commit.
4. **Behavioral trace:** when any gate reddens during your real work — record what you did in response (fix vs bypass), verbatim gate output included.
5. **Evidence deliverable:** write `docs/meta-factory/research-patches/2026-07-23-aif-parity-s2-container-evidence.md`, first line `<!-- scope:aif-parity-s2-container-evidence -->` (principle 10), containing the raw outputs of 1-4 with per-item root-cause for every silent/missing channel. Commit it. That commit+push is itself the live shield test.
6. **Fork discipline:** on ANY genuine ambiguity — park as a question (`manualReviewRequired` / blocked with «Option A → X / Option B → Y»), do NOT guess (the park event itself becomes evidence for the Q&A-routing leg).

## §3 Stages

**S0 — channel inventory + carrier-reachability tagging (host-side, no model spend).** Derive rows from SSOTs, not memory: the 20-row hook census (row set only — T-AIP-D); pre-push shields (`packages/core/hooks/pre-push.ts` + `checks/*.ts`); the acceptance-contour gates; the coordinator skills (`/harvest`, `/dispatcher`); **the project's own invariant gates** (build-vs-reuse/capability consult, `make self-audit`, §1.7, prior-art trailer, 6-item search) — else they drop upstream of the no-silent-rows guard; **and the pipeline legs themselves** (§3b). Tag each row `{inject | shield | skill | acceptance-gate | invariant-gate | pipeline-leg}`, its CC event, and its **reachability by this carrier**: `reachable` vs `unreachable-by-carrier` (with the carrier shape that WOULD reach it). Deliverable: the frozen, reachability-tagged skeleton.

**S1 — CC-side baseline (host-side).** Per row: expected CC behavior (what engages, when, what the model should do). Do NOT copy the census's ZCode column (T-AIP-D).

**S2 — the ONE live aif run = the §2b worker protocol.** Dispatch THIS kickoff via the runtime bridge (`/pipeline multi-model-pipeline-pilot → /dispatcher`); the `bridge-profile` marker routes the whole task pipeline (plan+implement+review) to `Z.AI GLM-5.2` — the dispatch itself is the live test of the marker resolution (`AifHandoffBackend.ts:119-146`) and of the D1 Tier-2 exception route. Host-side observers gather what the worker cannot: aif usage events (which model actually served each stage), task state transitions, park/answer round-trips if any.

**S3 — harvest + acceptance contour (host-side, on the REAL evidence PR).** `/dispatcher §2.4`: pre-egress cold `agents/fidelity-auditor.md` on kickoff+container-diff → FIDELITY block into the PR body → `pr-body-fidelity` gate validates. Prove RED too: momentarily edit the PR body to a stale `Audited-SHA`, confirm the gate reds, restore (paired-negative on the acceptance layer). The PR is **real** — the S2 evidence patch — and merges on GO.

**S4 — synthesize (host-side).** One research patch: the full two-axis checklist + root-cause map, merging container evidence (S2) + host observations (S2/S3) + banked pipeline-leg evidence (§3b). Split **exercised** vs **structurally-unreachable-by-carrier** (each with its would-reach-it carrier). `done.md` at merge.

## §3b Pipeline-leg rows — evidence already banked this session (2026-07-23)

The audited contour starts at `/arch`, and its first legs already ran live while authoring THIS kickoff — bank them as checklist rows, do not re-run:

- **`/arch` §2 two-altitude cold review** — FIRED × HONORED: the two-subagent review (top-down Opus + bottom-up Sonnet) returned REVISE and the bottom-up seat caught a real factual error in this very kickoff (the false «settings.json never travels via git» claim, refuted by `git ls-files`; fixed in r1). The review channel demonstrably detects author-blind defects.
- **`/pipeline` plan-currency + dup-detect leg** — FIRED: the operator's `/pipeline` invocation (this session) ran priority-score/dup-detect/inflight helpers; dup-detect correctly flagged `multi-model-pipeline-pilot` as `deliverable-on-staging` overlap (the pre-re-scope decision record) — evidence the dedup layer reads real state.
- **Tier routing D1 marker leg** — pending S2: this kickoff carries `<!-- bridge-profile: Z.AI GLM-5.2 -->` under the ACTIVE D1 exception (required-check registered 2026-07-23); the S2 dispatch proves (or fails) name→id resolution and whole-pipeline executor-tier routing.
- **Acceptance-contour self-test leg** — partially banked: the `pr-body-fidelity` gate already ran GREEN on real PRs (#1106 GO-block; #1108 skipped-with-rationale) — the GREEN direction is proven; S3 adds the RED direction.

## §4 The deliverable — two-axis parity checklist + root-cause (binding)

One row per S0 channel. **Two independent axes** (never collapsed), a derived overall label (recoverable to the axes), and a **root-cause cell for every non-SAME/ALTERNATIVE row**:

**Wiring axis** (every row): `FIRED` — registered AND ran on this carrier · `NOT-REGISTERED` — ships in repo, not wired in container settings / dep missing · `UNREACHABLE-BY-CARRIER` — registered, but this carrier's shape cannot trigger it (record the would-reach-it carrier).

**Behavioral axis** (only when FIRED; else `n/a`): `HONORED` · `DIVERGENT-OK` (different path, acceptable) · `DEGRADED` (weaker reaction — partial compliance, extra rework rounds) · `IGNORED` · `MISSERVES` (engaged + obeyed, but the CC-tuned mechanism is counterproductive under GLM — false-red on correct output, obeyed-into-wrong-reading; subject = the mechanism).

**Derived overall label** (deterministic from the axes):

| Overall | Definition (wiring × behavioral) |
|---|---|
| ✅ SAME | FIRED × HONORED |
| 🔀 ALTERNATIVE | FIRED × DIVERGENT-OK |
| ⚠️ WORSE | FIRED × (DEGRADED or MISSERVES) — note which |
| ❌ BROKEN | NOT-REGISTERED, **or** FIRED × IGNORED — wiring column says which |
| ◻️ COVERAGE-LIMITED | UNREACHABLE-BY-CARRIER (structural), or reachable-but-unfired this run — with the would-reach-it carrier; never a silent drop |

Collectively exhaustive (COVERAGE-LIMITED absorbs what T14 forbids from SAME) and mutually exclusive (the wiring value disambiguates BROKEN's sub-causes; MISSERVES homes the third failure mode).

**Root-cause cell (mandatory for every ❌ / ⚠️ / unexpected ◻️ row):** the diagnosed WHY with evidence — e.g. `absent from container settings.json (jq output)`, `tsx not on PATH (command -v)`, `hook ran, GLM ignored output-language line (verbatim quote)`, `quota stall misread (cycle timestamp)` — plus a one-line **fix-pointer** (what would flip it to SAME). Diagnosed at observation time (in-container where possible), not reconstructed later.

Columns: `channel | type | CC-baseline (S1) | wiring | behavioral | overall | root-cause+fix (non-SAME) | evidence (file:line / cmd)`. Rollup: counts per label + most-uncertain row + full UNREACHABLE-BY-CARRIER list.

## §5 Constraints

- **Quota (F-E):** GLM runs OFF-PEAK only (peak 14:00-18:00 UTC+8 = 3×; off-peak 2×; promo 1× through September). Record timestamps + prompts per stage. Quota-blocked → WAIT for the cycle (Fork-4), never switch providers mid-audit.
- **[no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md):** all observation is session/aif-bound; nothing audit-related enters CI.
- **Token economy:** ONE live aif run; everything host-provable is proved host-side; the single-carrier bound is **structural** (identical extra carriers add zero coverage) — §4 COVERAGE-LIMITED makes it explicit.
- **One stage = one executor session** + pre-dispatch in-flight probe per [CLAUDE.md](../../../CLAUDE.md).
- **Dispatch channel:** through the aif runtime (this kickoff = the task), not in-session write-capable subagents.
- **The evidence PR is REAL** — it merges (it is the audit's data). No throwaway diff exists in this design.
- **aif preflight:** `RUNTIME_BRIDGE_AIF_PROJECT_ID` + `refresh-aif-base.sh` before dispatch; keep-awake; any aif symptom → `/aif-doctor` first.

## §6 Acceptance criteria

1. Every S0 row carries both axis values (+behavioral `n/a` only when not FIRED), the derived label, and evidence (T3 — no prose-only cells).
2. Every ❌/⚠️ row (and every unexpectedly-silent ◻️) carries a root-cause + fix-pointer, diagnosed from primary evidence.
3. Behavioral parity scored, not just wiring: each FIRED inject/shield row states what GLM **did**.
4. UNREACHABLE-BY-CARRIER rows listed with would-reach-it carriers; distinguished from reachable-but-unfired.
5. Acceptance contour exercised both directions on the real evidence PR (GREEN valid block / RED stale `Audited-SHA`).
6. Pipeline-leg rows (§3b) present: `/arch` review, `/pipeline` dedup, D1 marker routing, `/dispatcher` monitor/harvest, fidelity gate — each with its banked or S2/S3 evidence.
7. Coverage honesty: structural bound stated as structural; nothing silently dropped.
8. `done.md` at S4 merge per [CLAUDE.md](../../../CLAUDE.md) «Umbrella closure convention».

## §7 Out of scope

P3/P1/P2 quality probes (preserved, decision record §3 Fork-5/6); CAS/versioning (Fork-2 armed trigger); new escalation protocols (Fork-1 REUSE); provider fallback (Fork-4); self-hosting GLM; README/goal-doc edits; consumer-shipped artifacts (operator-axis work, [build-first-reuse-default.md §1.1](../../rules/build-first-reuse-default.md)).

## §8 AI-traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active: **T2** (parity claims come from the actual dispatch, not "would fire" reasoning), **T3** (every cell: command+output or file:line), **T6** (confidence as predicates), **T14** (reachable-but-unfired = COVERAGE-LIMITED, never SAME), **T15** (the audit audits its own carrier — did S2 observe settings+logs, or infer from output?), **T20** (no verdict without same-turn evidence).

Domain-specific:

- **T-AIP-A — CC-event-exists ⇒ works-in-aif** (T16 specialization). Hook *file* presence proves neither axis. Counter: SAME requires FIRED wiring evidence from inside the container AND behavioral evidence.
- **T-AIP-B — registered-in-repo ≠ wired-in-container.** `settings.json` IS git-tracked but maintainer-authored; a shipped hook can be unregistered (CLAUDE.md:183). Verify the container's actual settings + runtime. (Do not claim the file "does not travel via git" — it does.)
- **T-AIP-C — quota-blindness misread as BROKEN.** An exhausted weekly cap looks like "mechanism dead". Record cycle timestamps; a quota stall is environment (→ `/aif-doctor`), not a parity verdict.
- **T-AIP-D — importing the census's ZCode column.** The census classifies CC-vs-**ZCode**; aif runs CC, so its `cc-only` rows are NOT impossible in aif. Census = row set only; every aif verdict derives from container observation.
- **T-AIP-E — self-observation contamination.** The carrier task audits its own environment: keep observation steps read-only, keep the shield probe (§2b.3) explicit and fully reverted, and never let "produce a clean checklist" pressure the worker into under-reporting silent channels — a silent channel IS the finding, not a blemish on the run.
