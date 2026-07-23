# multi-model-pipeline-pilot — kickoff (RE-SCOPED 2026-07-23)

> **Umbrella:** `multi-model-pipeline-pilot`. **Status:** authored — awaiting operator GO (S2/S3 spend z.ai Coding-Plan quota; do NOT dispatch without explicit GO).
> **Re-scope note (2026-07-23, operator directive):** this umbrella was re-pointed from the P3/P1/P2 GLM-**quality** probe pilot to an **inside-aif mechanism-parity audit**. The original quality-probe design (paired Sonnet-vs-GLM rubric scoring) is **preserved intact** in the decision record [§3 Fork-5/6](../../../docs/meta-factory/research-patches/2026-07-21-multi-model-pipeline-decisions.md) for future revival — nothing is lost, only deferred (T17). The decision record's F-A…F-F ground-truth facts remain the binding input for this audit's mechanics.
> **Goal:** run the smallest real task through the whole factory pipeline (`/pipeline → /dispatcher → aif/GLM → acceptance contour`) and produce a **two-axis parity checklist**: for every hook / shield / skill / inject / acceptance-gate, record — inside the aif container under the GLM executor — (A) whether it **engaged** (wiring axis) and (B) how **GLM handled it** (behavioral axis), each with evidence, so the exact failure mode is always recoverable.
> **Binding inputs:** decision record F-B (GLM is the sole prod aif profile; 17 tasks done across all workflow kinds) + F-C (aif runs the CC harness with one process-global `ANTHROPIC_BASE_URL`); the hook census in [zcode-parity-doctrine.md §2](../../rules/zcode-parity-doctrine.md) (**row-set source only** — see T-AIP-D); the shipped acceptance contour ([agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) + `pr-body-fidelity` gate, PRs #1102/#1106).

## §1 Why an inside-aif parity audit (not a quality probe)

F-B proved GLM **completes** 17 aif tasks end-to-end — but "reached `done`" says nothing about **which CC-native mechanisms actually engaged inside the container**, or whether GLM **honored** them the way Claude does. Nobody has mapped, channel by channel, what survives the trip into aif. That map is the missing artifact this umbrella now produces.

## §2 The parity question (two independent axes — frame precisely, avoid T16)

aif runs the **Claude Code harness** (`claude` CLI) in a Docker container, with the model swapped to GLM-5.2 via a process-global `ANTHROPIC_BASE_URL` (F-C, aif-handoff `packages/runtime/src/adapters/claude/options.ts:266-272`). So "does aif support hook X?" is the **wrong** question — the harness is CC, so the event *type* exists. The **right** question has **two independent axes**, and the deliverable (§4) keeps them separate so a verdict never hides which one failed:

1. **Wiring axis — did the mechanism engage in the container?** Two things can stop it even though the hook file ships in the repo: (a) it may not be **registered** in the container's `.claude/settings.json`. That file **is** git-tracked and travels to the staging-synced container — but it is **maintainer-authored** (agents are deny-listed from editing it, `.claude/settings.json:52`), and a shipped hook file can go **unwired** in `settings.json` (CLAUDE.md:183 records exactly this: `WorktreeCreate` shipped in PR #279 yet was never registered). (b) the container's `claude` runtime must actually load `settings.json` and have the hook's deps (node/tsx/PATH) present. So VERIFY against the container's **actual** settings + runtime — never infer "wired" from repo file-presence.
2. **Behavioral axis — how did GLM handle it once engaged?** When a rule is injected / a shield reddens / a skill is invoked, does **GLM-the-model** act on it as Claude would — honor the rule, fix on shield feedback rather than bypass? This is the load-bearing axis: "engaged" ≠ "handled well". A third, non-obvious sub-mode lives here too (see §4 `MISSERVES`): the mechanism engages and GLM "obeys", yet the CC-tuned mechanism is **counterproductive** under GLM (a Claude-calibrated shield false-reddens correct GLM output; an inject GLM obeys into a wrong reading).

The axes are orthogonal: a channel can be wired-but-ignored, unwired-but-would-be-honored, engaged-and-degraded, etc. Collapsing them into one label destroys the map (§4).

## §3 Stages

**S0 — channel inventory + carrier-reachability tagging (no model spend).** Derive the row set from SSOTs, not memory (source-before-shape):

- the 20-row hook census [zcode-parity-doctrine.md §2](../../rules/zcode-parity-doctrine.md) (row set only — T-AIP-D);
- the pre-push shields in `packages/core/hooks/pre-push.ts` + `packages/core/hooks/checks/*.ts`;
- the acceptance-contour gate (`pr-body-fidelity` + `agents/fidelity-auditor.md`);
- the skills the coordinator runs (`/harvest`, `/dispatcher`);
- **the project's own binding invariant gates** (else they drop upstream of the "no silent rows" guard): build-vs-reuse / capability-commit consult, recursive self-audit (`make self-audit`), §1.7 forward/backward, prior-art trailer, the 6-item search-coverage check — from the session-bootstrap invariants + [CLAUDE.md](../../../CLAUDE.md).

Tag each row `{inject | shield | skill | acceptance-gate | invariant-gate}`, its CC event, AND its **reachability by the chosen S2 carrier**: `reachable` (the carrier's shape triggers it) vs `unreachable-by-carrier` (structurally cannot fire on this carrier — e.g. a subagent-lifecycle hook on a task that spawns no subagent; a capability-commit / §1.7 / prior-art gate on a docs-only diff). For every `unreachable-by-carrier` row, name the **carrier shape that WOULD reach it**. Deliverable: the frozen, reachability-tagged row list (the checklist skeleton).

**S1 — CC-side baseline (no aif spend).** For each row, state the **expected CC behavior** (what engages, when, what the model is expected to do). This is the "same as CC" reference column. Do NOT copy the census's ZCode classification as the baseline (T-AIP-D).

**S2 — one live aif carrier run (quota spend — the core).** Design ONE trivial-but-real throwaway task (e.g. a docs stub / one-line scratch fix from the real backlog). Dispatch it through `/pipeline multi-model-pipeline-pilot → /dispatcher` into aif on the GLM profile. Gather per-channel evidence for **both axes** from inside the container — and note that output alone proves *behavioral* facts, not *wiring* facts (see the evidence rule below):

- **Wiring evidence** (did it engage?): the container's **actual** `.claude/settings.json` wired-hook set; the container's hook/runtime logs; the session transcript — NOT just commits. A hook that produced no observable effect may have been unregistered, not merely silent.
- **Behavioral evidence** (how did GLM handle it?): the task plan/comments, the container worktree, the worker's own commits — did GLM's output reflect an injected rule (e.g. English machinery)? On a reddened shield, did GLM **fix on feedback** or bypass?

Cover, at minimum: injects (rule-injection, session-bootstrap, subagent-context, project-digest, output-language), shields (pre-push sections at the worker's commit/push), skills (did the coordinator actually run `/harvest` / `/dispatcher` steps). `unreachable-by-carrier` rows are NOT run — they are carried to S4 as `COVERAGE-LIMITED` with their would-reach-it carrier.

**S3 — acceptance-contour check (the just-shipped Phase A/B).** At the pre-egress seam (`/dispatcher §2.4`): did the cold `agents/fidelity-auditor.md` run on kickoff+diff, did the FIDELITY block land in the PR body, did the `fidelity-verdict-in-pr-body` gate validate it? Prove the RED direction too (a PR body with a stale `Audited-SHA` must red the gate). First live exercise of the contour on a real aif task.

**S4 — synthesize the two-axis parity checklist (the deliverable).** One research patch: per S0 row, both axes + the derived overall label (§4) with evidence, cited by file:line / command output. Split the report into **exercised-this-run** vs **structurally-unreachable-by-carrier** (each of the latter with its would-reach-it carrier). Honest coverage per T14.

## §4 The deliverable — two-axis parity checklist (binding)

A markdown table, one row per S0 channel. **Two independent axes** (never collapsed), plus a derived overall label that is recoverable back to the axes:

**Wiring axis** (every row gets exactly one):

- `FIRED` — registered in the container AND ran on this carrier.
- `NOT-REGISTERED` — hook ships in the repo but is not wired in the container's settings / its runtime dep is missing → did not run though it could have.
- `UNREACHABLE-BY-CARRIER` — registered, but this carrier's task shape structurally cannot trigger it (record the would-reach-it carrier).

**Behavioral axis** (only when wiring = `FIRED`; else `n/a`):

- `HONORED` — GLM acted on it equivalently to Claude.
- `DIVERGENT-OK` — handled via a different path but acceptably (e.g. a ZCode-style one-shot inject vs CC persistent-lifecycle).
- `DEGRADED` — GLM's reaction weaker (ignored part of an injection, needed more rework rounds, weaker fix).
- `IGNORED` — GLM did not act on it at all.
- `MISSERVES` — engaged AND GLM obeyed, but the CC-tuned mechanism is counterproductive under GLM (false-red on correct output; obeyed inject → wrong reading). Subject = the mechanism, not GLM.

**Derived overall label** (deterministic function of the two axes — this is the "same / alternatively / worse / broken / not-covered" summary the operator asked for; the two axis-columns above are what make *which failure* recoverable):

| Overall | Definition (wiring × behavioral) |
|---|---|
| ✅ SAME | FIRED × HONORED |
| 🔀 ALTERNATIVE | FIRED × DIVERGENT-OK |
| ⚠️ WORSE | FIRED × (DEGRADED or MISSERVES) — note which |
| ❌ BROKEN | NOT-REGISTERED, **or** FIRED × IGNORED — the wiring column says which sub-cause |
| ◻️ COVERAGE-LIMITED | UNREACHABLE-BY-CARRIER (structural), or a reachable row that simply did not fire this run — carry the would-reach-it carrier, never a silent drop |

This is collectively exhaustive (every wiring value maps; COVERAGE-LIMITED absorbs the unexercised rows T14 forbids from SAME) and mutually exclusive (the wiring value disambiguates BROKEN's two sub-causes; MISSERVES gives the third failure mode a home).

Columns: `channel | type | CC-baseline (S1) | wiring | behavioral | overall | evidence (file:line / cmd output)`. End with a rollup: counts per overall label + the single most-uncertain row + the full `UNREACHABLE-BY-CARRIER` list with would-reach-it carriers (no silent drops).

## §5 Constraints

- **Quota discipline (decision record F-E):** schedule GLM runs OFF-PEAK (peak 14:00-18:00 UTC+8 = 3× multiplier; off-peak 2×; promo 1× through end of September). Record dispatch timestamps + prompts consumed per stage. If quota-blocked, WAIT for the cycle (Fork-4 verdict) — never switch providers mid-audit.
- **[no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md):** all observation runs in aif/session context; nothing audit-related enters CI.
- **Token economy:** ONE live aif run only. Everything provable host-side (S0 inventory, S1 baseline, local shield RED/GREEN probes) is proved without aif spend. GLM is already the cheap tier — no model changes. A single carrier reaches only its `reachable` rows by shape — this is a **structural** coverage bound, not a sampling-size one (more identical carriers add zero coverage); the `UNREACHABLE-BY-CARRIER` split in §4 makes the bound explicit and names what a follow-up carrier would need to reach.
- **One stage = one executor session** + the pre-dispatch in-flight probe per [CLAUDE.md](../../../CLAUDE.md) «Pre-dispatch in-flight probe».
- **Worker dispatch channel:** the carrier task is dispatched through the aif runtime (kickoff-consuming coordinator), not via in-session write-capable subagents — per the project's channel-discipline gate.
- **Carrier PR:** throwaway — closed after acceptance is proven; auto-merge verified at the "engaged" level, not force-merged into staging (operator may override → let a genuinely useful micro-fix merge).
- **aif preflight:** `RUNTIME_BRIDGE_AIF_PROJECT_ID` set + `refresh-aif-base.sh` before dispatch; keep-awake vs Mac idle-sleep; on ANY aif symptom → first action is `/aif-doctor`, never fix-by-fix `docker exec`.

## §6 Acceptance criteria

1. The S4 checklist covers every S0 row with **both** axis values (wiring always; behavioral when FIRED, else `n/a`) plus the derived overall label, each backed by command output or file:line (T3 — no prose-only rows).
2. Behavioral parity is scored, not just wiring: for every FIRED inject/shield row, the checklist states what GLM **did** in response, not only that it engaged.
3. The `UNREACHABLE-BY-CARRIER` rows are listed explicitly, each with the carrier shape that would reach it — distinguished from reachable-but-unfired rows (both land under COVERAGE-LIMITED but for different reasons).
4. The acceptance contour (S3) is exercised in both directions on a real aif task — GREEN on a valid verdict, RED on a stale `Audited-SHA`.
5. Coverage is honest: the structural single-carrier bound stated as structural (not "n=1 sample"); every unexercised channel surfaced as COVERAGE-LIMITED, never omitted.
6. `done.md` written at S4 merge per [CLAUDE.md](../../../CLAUDE.md) «Umbrella closure convention».

## §7 Out of scope

The original P3/P1/P2 GLM-**quality** probes (paired Sonnet-vs-GLM rubric scoring) — deferred, preserved in the decision record §3 Fork-5/6 for future revival; CAS/versioning (Fork-2 armed trigger); any new escalation protocol (Fork-1 REUSE); automatic provider fallback (Fork-4); self-hosting GLM; edits to README/goal-bearing docs; consumer-shipped artifacts (this is operator-axis work per [build-first-reuse-default.md §1.1](../../rules/build-first-reuse-default.md)).

## §8 AI-traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active traps for this umbrella: **T2** (designing ≠ running — the parity claims must come from an actual aif dispatch, not "would fire" reasoning), **T3** (every checklist cell needs command+output or file:line), **T6** (confidence as predicates — counts + coverage + calibration, not "high"), **T14** (a reachable-but-unfired row is COVERAGE-LIMITED, never "SAME"), **T15** (the audit audits its own carrier — did S2 actually observe the container's settings + logs, or infer from output?), **T20** (no verdict without evidence-bearing tool output in the same turn).

Domain-specific:

- **T-AIP-A — CC-event-exists ⇒ works-in-aif (the T16 specialization).** aif is the CC harness, so every hook *file* is present; concluding "SAME" from file-presence skips both §2 axes (engaged? GLM-honored?). Counter: no row is SAME without `FIRED` wiring evidence from inside the container AND behavioral evidence.
- **T-AIP-B — registered-in-repo ≠ wired-in-container.** A hook file shipping in the repo does not prove it is registered in the container's `.claude/settings.json` (which **is** git-tracked but maintainer-authored — agents can't edit it, and a shipped hook may go unwired, per CLAUDE.md:183) or that the container runtime loaded it. Verify against the container's **actual** settings + runtime, not the repo's file list. (The `settings.json` file travels via git; do not claim it does not.)
- **T-AIP-C — quota-blindness misread as BROKEN.** A GLM run that stalls on an exhausted weekly cap (peak 3× multipliers silently burn it) can look like "mechanism doesn't work". Record cycle timestamps + per-stage quota; a quota stall is an environment state (→ `/aif-doctor`), not a parity verdict.
- **T-AIP-D — importing the ZCode column of the census.** [zcode-parity-doctrine.md §2](../../rules/zcode-parity-doctrine.md) classifies each hook CC-vs-**ZCode**; aif runs the **CC** harness, so its `cc-only` / `impossible` rows (SubagentStart/Stop/WorktreeCreate) are NOT impossible in aif. Use the census only for the **row set**; derive every aif verdict fresh from container observation — never copy the ZCode classification into the aif column.
