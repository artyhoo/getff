# multi-model-pipeline-pilot — kickoff (RE-SCOPED 2026-07-23)

> **Umbrella:** `multi-model-pipeline-pilot`. **Status:** authored — awaiting operator GO (S2/S3 spend z.ai Coding-Plan quota; do NOT dispatch without explicit GO).
> **Re-scope note (2026-07-23, operator directive):** this umbrella was re-pointed from the P3/P1/P2 GLM-**quality** probe pilot to an **inside-aif mechanism-parity audit**. The original quality-probe design (paired Sonnet-vs-GLM rubric scoring) is **preserved intact** in the decision record [§3 Fork-5/6](../../../docs/meta-factory/research-patches/2026-07-21-multi-model-pipeline-decisions.md) for future revival — nothing is lost, only deferred (T17). The decision record's F-A…F-F ground-truth facts remain the binding input for this audit's mechanics.
> **Goal:** run the smallest real task through the whole factory pipeline (`/pipeline → /dispatcher → aif/GLM → acceptance contour`) and produce a **parity checklist**: for every hook / shield / skill / inject / acceptance-gate, record whether — inside the aif container under the GLM executor — it behaves **the same as in Claude Code**, works **alternatively**, works **worse**, or **does not work at all**, each with evidence.
> **Binding inputs:** decision record F-B (GLM is the sole prod aif profile; 17 tasks done across all workflow kinds) + F-C (aif runs the CC harness with one process-global `ANTHROPIC_BASE_URL`); the hook census in [zcode-parity-doctrine.md §2](../../rules/zcode-parity-doctrine.md) (row source for the checklist); the shipped acceptance contour ([agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) + `pr-body-fidelity` gate, PRs #1102/#1106).

## §1 Why an inside-aif parity audit (not a quality probe)

F-B proved GLM **completes** 17 aif tasks end-to-end — but "reached `done`" says nothing about **which CC-native mechanisms actually fired inside the container**, or whether GLM **honored** them the way Claude does. Nobody has mapped, channel by channel, what survives the trip into aif. That map is the missing artifact this umbrella now produces.

## §2 The parity question (frame precisely — avoid T16 `#pattern-matching-on-name`)

aif runs the **Claude Code harness** (`claude` CLI) in a Docker container, with the model swapped to GLM-5.2 via a process-global `ANTHROPIC_BASE_URL` (F-C, aif-handoff `packages/runtime/src/adapters/claude/options.ts:266-272`). So "does aif support hook X?" is the **wrong** question — the harness is CC, so the event exists. The **right** two-part question per channel:

1. **Wiring parity** — is the mechanism actually live in the container? `.claude/settings.json` is agent-uncommittable (never travels via git); a container base may or may not have hooks registered. A hook whose file exists but is not wired **does not fire**. VERIFY it fires, do not assume.
2. **Behavioral parity** — when the mechanism fires (a rule injected, a shield reddened, a skill invoked), does **GLM-the-model** act on it as well as Claude would? Honors the injected rule? Fixes on shield feedback rather than bypassing? This is the load-bearing axis — "hook fired" ≠ "GLM handled it well".

A checklist row that only proves the file exists is **T3-nonconformant** (no behavioral evidence) and must be marked coverage-limited, not "SAME".

## §3 Stages

**S0 — channel inventory (no model spend).** Derive the row set from SSOTs, not memory (source-before-shape): the 20-row hook census [zcode-parity-doctrine.md §2](../../rules/zcode-parity-doctrine.md); the pre-push shields in `packages/core/hooks/pre-push.ts` + `packages/core/hooks/checks/*.ts`; the acceptance-contour gate (`pr-body-fidelity` + `agents/fidelity-auditor.md`); the skills the coordinator runs (`/harvest`, `/dispatcher`). Tag each row `{inject | shield | skill | acceptance-gate}` and note its CC event. Deliverable: the frozen row list (the checklist skeleton).

**S1 — CC-side baseline (no aif spend).** For each row, state the **expected CC behavior** (what fires, when, what the model is expected to do). Reuse the zcode-parity census where it already documents CC-vs-alternative-harness behavior — do not re-derive. This is the "same as CC" reference column.

**S2 — one live aif carrier run (quota spend — the core).** Design ONE trivial-but-real throwaway task (e.g. a docs stub / one-line scratch fix drawn from the real backlog). Dispatch it through `/pipeline multi-model-pipeline-pilot → /dispatcher` into aif on the GLM profile. While the GLM worker runs, gather per-channel evidence **from inside the container** (task plan/comments, the container worktree, the worker's own commits):

- **Injects** (rule-injection, session-bootstrap, subagent-context, project-digest, output-language) — did the rule/context reach the GLM session? Did GLM's output reflect it (e.g. wrote English machinery, followed an injected rule)?
- **Shields** (pre-push sections at the worker's commit/push inside the container) — did they run? When a shield reddened, did GLM **fix on feedback** or try to bypass? A shield that should have fired on the worker's diff and didn't = a BROKEN/WORSE row.
- **Skills** — did the coordinator actually invoke `/harvest` / `/dispatcher` steps, or degrade?

**S3 — acceptance-contour check (the just-shipped Phase A/B).** At the pre-egress seam (`/dispatcher §2.4`): did the cold `agents/fidelity-auditor.md` run on kickoff+diff, did the FIDELITY block land in the PR body, did the `fidelity-verdict-in-pr-body` gate validate it? Prove the RED direction too (a PR body with a stale `Audited-SHA` must red the gate). This is the first live exercise of the contour on a real aif task.

**S4 — synthesize the parity checklist (the deliverable).** One research patch: per S0 row, the verdict from §4 with evidence. Cite the S2/S3 observations by file:line / command output. Honest coverage per T14 (n=1 carrier task is a sample, not a distribution).

## §4 The deliverable — parity checklist (four categories, binding)

A markdown table, one row per S0 channel, verdict ∈ exactly one of:

- **✅ SAME** — fires in the container AND GLM acts on it equivalently to Claude-in-CC (rule honored / shield fixed-on-feedback / skill invoked correctly), with evidence.
- **🔀 ALTERNATIVE** — fires, but via a different path or GLM handles it differently yet acceptably (e.g. a ZCode-style one-shot inject vs CC's persistent-lifecycle; a documented fallback). Note the divergence.
- **⚠️ WORSE** — fires, but GLM's reaction is degraded (ignores part of an injection, needs more rework rounds, weaker fix) OR the mechanism is only partially wired. Note the gap.
- **❌ BROKEN** — not wired in the container / CC-only event absent with no fallback / GLM ignores it entirely.

Columns: `channel | type | CC-baseline (S1) | aif/GLM observed (S2/S3, evidence) | verdict | note`. End with a rollup: counts per category + the single most-uncertain row + every `coverage-limited` (unexercised) channel listed explicitly (no silent drops).

## §5 Constraints

- **Quota discipline (decision record F-E):** schedule GLM runs OFF-PEAK (peak 14:00-18:00 UTC+8 = 3× multiplier; off-peak 2×; promo 1× through end of September). Record dispatch timestamps + prompts consumed per stage. If quota-blocked, WAIT for the cycle (Fork-4 verdict) — never switch providers mid-audit.
- **[no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md):** all observation runs in aif/session context; nothing audit-related enters CI.
- **Token economy:** ONE live aif run only. Everything provable host-side (S0 inventory, S1 baseline, local shield RED/GREEN probes) is proved without aif spend. GLM is already the cheap tier — no model changes.
- **One stage = one executor session** + the pre-dispatch in-flight probe per [CLAUDE.md](../../../CLAUDE.md) «Pre-dispatch in-flight probe».
- **Worker dispatch channel:** the carrier task is dispatched through the aif runtime (kickoff-consuming coordinator), not via in-session write-capable subagents — per the project's channel-discipline gate.
- **Carrier PR:** throwaway — closed after acceptance is proven; auto-merge verified at the "engaged" level, not force-merged into staging (operator may override → let a genuinely useful micro-fix merge).
- **aif preflight:** `RUNTIME_BRIDGE_AIF_PROJECT_ID` set + `refresh-aif-base.sh` before dispatch; keep-awake vs Mac idle-sleep; on ANY aif symptom → first action is `/aif-doctor`, never fix-by-fix `docker exec`.

## §6 Acceptance criteria

1. The S4 checklist covers every S0 row with a verdict in exactly one of the four categories, each backed by command output or file:line (T3 — no prose-only rows).
2. Behavioral parity is scored, not just wiring: for every inject/shield row, the checklist states what GLM **did** in response, not only that the mechanism fired.
3. The acceptance contour (S3) is exercised in both directions on a real aif task — GREEN on a valid verdict, RED on a stale `Audited-SHA`.
4. Coverage is honest: n=1 carrier task stated as a sample; every unexercised channel listed as `coverage-limited`, never omitted.
5. `done.md` written at S4 merge per [CLAUDE.md](../../../CLAUDE.md) «Umbrella closure convention».

## §7 Out of scope

The original P3/P1/P2 GLM-**quality** probes (paired Sonnet-vs-GLM rubric scoring) — deferred, preserved in the decision record §3 Fork-5/6 for future revival; CAS/versioning (Fork-2 armed trigger); any new escalation protocol (Fork-1 REUSE); automatic provider fallback (Fork-4); self-hosting GLM; edits to README/goal-bearing docs; consumer-shipped artifacts (this is operator-axis work per [build-first-reuse-default.md §1.1](../../rules/build-first-reuse-default.md)).

## §8 AI-traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active traps for this umbrella: **T2** (designing ≠ running — the parity claims must come from an actual aif dispatch, not "would fire" reasoning), **T3** (every checklist row needs command+output or file:line), **T6** (confidence as predicates — counts + coverage + calibration, not "high"), **T14** (a clean low-n row is `coverage-limited`, never "SAME"), **T15** (the audit audits its own carrier — did S2 actually observe the container, or infer?), **T20** (no verdict without evidence-bearing tool output in the same turn).

Domain-specific:

- **T-AIP-A — CC-event-exists ⇒ works-in-aif (the T16 specialization for this audit).** aif is the CC harness, so every hook *file* is present; concluding "SAME" from file-presence skips the two real questions (§2: wired-and-fired? GLM-honored?). Counter: no row is "SAME" without behavioral evidence from inside the container.
- **T-AIP-B — settings.json blind spot.** `.claude/settings.json` is agent-uncommittable and never travels via git; a container may run with hooks *unregistered*. Do NOT assume the container's wired hook set equals the operator's. Verify against the container's actual settings, not the repo.
- **T-AIP-C — quota-blindness misread as BROKEN.** A GLM run that stalls on an exhausted weekly cap (peak 3× multipliers silently burn it) can look like "mechanism doesn't work". Record cycle timestamps + per-stage quota; a quota stall is an environment state (→ `/aif-doctor`), not a parity verdict.
