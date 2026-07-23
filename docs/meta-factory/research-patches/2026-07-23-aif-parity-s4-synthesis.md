<!-- scope:aif-parity-s4-synthesis -->

# aif-parity S4 — synthesis: two-axis parity checklist + root-cause map

> **Umbrella:** `multi-model-pipeline-pilot`. Closes S4 per [kickoff §3](../../../.claude/orchestrator-prompts/multi-model-pipeline-pilot/kickoff.md).
> **Carrier:** ONE aif task `e43ce4ea-cb13-4444-9fc4-694c0059ecd3` on runtime profile `Z.AI GLM-5.2 SDK` (`53eca24c`, transport=sdk), off-peak 2026-07-23, tokenTotal 552,524.
> **Inputs merged:** S2 in-container evidence (PR #1111, `2026-07-23-aif-parity-s2-container-evidence.md`) + S3 host-side observations (this session) + §3b banked pipeline-leg rows.

## §1 What this synthesizes

The pilot's design was *self-referential*: one dispatched aif task whose work product IS the audit evidence, so its journey through the pipeline tests every leg. This file merges the three evidence halves into the binding two-axis checklist required by kickoff §4 — **wiring axis** (did the mechanism engage on this carrier) kept independent from **behavioral axis** (how GLM handled it once engaged), with a root-cause + fix-pointer for every non-SAME row.

**Framing correction that holds throughout (T-AIP-A/D):** aif runs the **Claude Code harness** with the model swapped via a process-global `ANTHROPIC_BASE_URL`. So no row here means "CC event type missing" — the event types exist. Every verdict is about *registration in the container*, *dependency availability*, or *GLM behaviour*, never about harness capability.

## §2 Two-axis checklist (merged)

### §2.1 Injection / shield channels — container-observed

| channel | type | wiring | behavioral | overall | evidence |
|---|---|---|---|---|---|
| pre-commit md-gate (600-line) | shield | FIRED | HONORED | ✅ SAME | S2 §3.2 |
| pre-commit markdownlint-cli2 | shield | FIRED | HONORED after npm-cache workaround; blocks round-1 agent without it | ⚠️ WORSE | S2 §3.2 + §3.4 |
| pre-commit JSON validity | shield | registered, dep (`python3`) MISSING | n/a — silent skip | ◻️ COVERAGE-LIMITED | S2 §2.1, §2.3 |
| pre-commit YAML validity | shield | registered, dep (`python3`) MISSING | n/a — silent skip | ◻️ COVERAGE-LIMITED | S2 §2.1, §2.3 |
| `inject-session-bootstrap.sh` | inject | FIRED | HONORED (digest quoted verbatim) | ✅ SAME | S2 §4.1 |
| CC-native `paths:` rule-injection | inject (CC-native) | FIRED | HONORED | ✅ SAME | S2 §4.3 |
| `check-doc-authority.sh` | shield | **registered** (settings.json:123) but dep `jq` MISSING | SILENT to agent — skips AND its warning never surfaces | ⚠️ **WORSE** (double degradation) | S2 §2.1, §3.1; host re-verify below |
| `validate-prompt.sh`, `check-hook-marker.sh`, `check-kickoff-traps.sh` | shield | registered | SILENT-from-agent-vantage — cannot disambiguate fired-quietly vs did-not-fire | ◻️ COVERAGE-LIMITED | S2 §3.1 |
| `inject-output-language.sh` | inject | NOT-REGISTERED | n/a | ❌ BROKEN (wiring) | S2 §2.2, §4.4 |
| `inject-memory-codification.sh` | inject | NOT-REGISTERED | n/a | ❌ BROKEN (wiring) | S2 §2.2, §4.4 |
| `inject-project-digest.sh` | inject | NOT-REGISTERED | n/a | ❌ BROKEN (wiring) | S2 §2.2, §4.4 |
| `inject-subagent-context.sh` | inject | NOT-REGISTERED | n/a | ◻️ COVERAGE-LIMITED (worker spawned no subagents) | S2 §2.2 |
| `ask-question-reminder.sh` | shield | registered | NOT EXERCISED — `HANDOFF_MODE=1` forbids AskUserQuestion | ◻️ COVERAGE-LIMITED | S2 §2.2 |
| `deps-hash-check.sh` | inject | registered | SILENT-from-agent-vantage | ◻️ COVERAGE-LIMITED | S2 §2.2 |
| `end-of-turn-reminder.sh` | inject | registered | fires at turn end — not observable mid-write | ◻️ COVERAGE-LIMITED | S2 §2.2 |
| `runtime-bridge-dispatch.sh` | shield | registered | NOT TRIGGERED (worker writes no bridge files) | ◻️ COVERAGE-LIMITED | S2 §2.2 |
| Subagent-lifecycle hooks (`inject-subagent-digest`, `warn-subagent-report`) | inject/shield | registered | NOT APPLICABLE — top-level session | ◻️ COVERAGE-LIMITED | S2 §2.2 |
| `worktree-setup.sh` (`WorktreeCreate`) | shield | NOT-REGISTERED (documented, CLAUDE.md:183) | n/a | ◻️ COVERAGE-LIMITED | S2 §2.2 |
| `.husky/pre-push` (TS-core dispatcher) | shield | UNREACHABLE-BY-CARRIER — container has no outbound HTTPS | n/a | ◻️ COVERAGE-LIMITED | S2 §3.5 |
| container-side `git push` | egress | UNREACHABLE-BY-CARRIER (`gnutls_handshake` fail) — **by design** | n/a | ◻️ COVERAGE-LIMITED | S2 §3.5 |

### §2.2 Pipeline legs — banked §3b + host-observed

| leg | wiring | behavioral | overall | evidence |
|---|---|---|---|---|
| `/arch` §2 two-altitude cold review | FIRED | HONORED — bottom-up seat caught a real factual defect in the kickoff | ✅ SAME | kickoff §3b |
| `/pipeline` plan-currency + dup-detect | FIRED | HONORED — flagged the umbrella's deliverable-on-staging overlap | ✅ SAME | kickoff §3b; this session |
| Tier-routing D1 `bridge-profile` marker | FIRED | MISSERVES→fixed — substring resolver matched two similarly-named profiles; loud-throw worked, obvious value was a foot-gun | ⚠️ WORSE (pre-fix) → ✅ SAME (post-fix) | kickoff §3b; `AifHandoffBackend.ts:131` |
| marker name→id resolution (live) | FIRED | HONORED — resolved to `53eca24c` (SDK profile) | ✅ SAME | this session (dispatch output) |
| `/dispatcher` dispatch → aif REST | FIRED | HONORED — real `AifHandoffBackend`, no ManualBackend fallback | ✅ SAME | dispatch output, taskId `e43ce4ea` |
| `/dispatcher` §2.2 monitor loop | FIRED | HONORED — `monitor-classify.sh` returned RUNNING:planning → DONE:done | ✅ SAME | this session |
| `refresh-aif-base.sh` container base sync | FIRED | HONORED — `114a164 → a0423c5` | ✅ SAME | this session |
| whole-pipeline executor-tier routing (D1 intent) | FIRED | HONORED — plan AND implement both on GLM; Opus profile never fired | ✅ SAME | §2.3 row «models-per-stage» |

### §2.3 Acceptance contour — host-side, on the real evidence PR #1111

| mechanism | wiring | behavioral | overall | evidence |
|---|---|---|---|---|
| Pre-egress fidelity seam (`/dispatcher §2.4`) | FIRED | HONORED — cold `agents/fidelity-auditor.md` returned GO Round 1, zero drift | ✅ SAME | PR #1111 `## Fidelity verdict` |
| `pr-body-fidelity` gate — **RED direction** | FIRED | HONORED — fail-closed TWICE on genuine defects (10-hex `Audited-SHA`; then SHA↔head mismatch) | ✅ SAME | PR #1111 runs 30042252170, 30042390255 |
| `pr-body-fidelity` gate — **GREEN direction** | FIRED | HONORED — passed on the valid re-anchored block | ✅ SAME | run 30042579639 |
| Acceptance-package PR sections (template D4) | FIRED | HONORED — Provenance / Review findings / Parked questions filled for real | ✅ SAME | PR #1111 body |
| Models-per-stage probe (S3.3) | PARTIAL | only GLM SDK profile fired (`lastUsageAt` 20:00Z); Opus stale @07-19 → planning did NOT fall back | ✅ SAME (with caveat) | runtime-profiles; `GET /tasks/:id/usage` → 404 |
| D1 calibration plan spot-check | FIRED | HONORED — plan reviewed read-only, matched §2b scope | ✅ SAME | PR #1111 `## Review findings` |
| `harvest-via-api.sh` egress (Channel A) | FIRED | HONORED — landed `cf72727` via Git Data API | ✅ SAME | harvest output |
| **`harvest-via-api` × Audited-SHA guard** | FIRED | **MISSERVES** — API-harvest mints a NEW commit SHA, so a cold audit anchored on the container commit can never match PR head | ⚠️ **WORSE** | §3 root-cause map |
| REVISE rework loop (`answer.ts request_changes`) | NOT EXERCISED | n/a — Round 1 was a genuine GO; no fake divergence staged (kickoff §3 S3.5) | ◻️ COVERAGE-LIMITED | — |
| §2.5 Phase-1 code-review | NOT APPLICABLE | docs-only diff — no code-quality altitude subject; WHAT-altitude covered by fidelity | ◻️ COVERAGE-LIMITED | — |
| night-mode PR-gate; `/harvest` standalone §4 | UNREACHABLE-BY-CARRIER | pre-declared in kickoff §3b | ◻️ COVERAGE-LIMITED | kickoff §3b |

## §3 Root-cause map (every non-SAME row)

1. **`check-doc-authority.sh` — ⚠️ WORSE (the headline finding).** *Root cause (double):* (a) `jq` is MISSING from the aif container (`S2 §2.1`), and the hook is jq-dependent, so it **skips its own check**; (b) its `⚠ jq unavailable` warning goes to **bare stderr**, which the harness does not surface to the agent (`S2 §3.1`). Net: a gate that is *registered* — therefore looks alive in any settings audit — while neither checking nor complaining. This is [`attention-is-not-a-mechanism.md §2`](../../../.claude/rules/attention-is-not-a-mechanism.md) `#warning-nobody-reads` in its purest observed form. *Fix-pointer:* install `jq` in the aif container image, AND re-emit violations via JSON `hookSpecificOutput.additionalContext` (the channel `inject-matching-rule.sh` uses successfully) instead of bare stderr.
2. **Three `inject-*` hooks — ❌ BROKEN (wiring).** *Root cause:* shipped in the repo but absent from the container's `.claude/settings.json` registration. *Fix-pointer:* decide intent (see §5 Q2) — register them, or record the worker-scope exclusion explicitly so «unregistered» stops reading as drift.
3. **pre-commit JSON/YAML validity — ◻️ COVERAGE-LIMITED.** *Root cause:* `python3` MISSING from the container; the gates silently skip. Same shape as (1) minus the registration illusion. *Fix-pointer:* add `python3`, or make the gate fail-loud when its interpreter is absent.
4. **markdownlint-cli2 — ⚠️ WORSE.** *Root cause:* npm-cache state in the container makes round-1 noisy; the agent needed a workaround before the gate became usable. *Fix-pointer:* pre-warm the cache in the image.
5. **`harvest-via-api` × `Audited-SHA` guard — ⚠️ WORSE (new, host-side).** *Root cause:* `pr-body-fidelity` requires `Audited-SHA == PR head`, but `harvest-via-api.sh` mints a fresh commit (blobs→tree→commit) whose SHA differs from the container commit the cold auditor judged. *Resolution used here:* the pushed blob is byte-identical to the audited file, so the verdict re-anchors to PR head under spec-D10 idempotence. *Fix-pointer:* run the fidelity audit **after** harvest (anchor on the API commit), or teach the gate to accept an `Audited-SHA` whose **tree** matches PR head.
6. **`bridge-profile` marker — ⚠️ WORSE→fixed.** *Root cause:* case-insensitive substring resolution matched both `Z.AI GLM-5.2` and `Z.AI GLM-5.2 SDK`. *Fix applied:* marker names the unique profile. *Fix-pointer for the resolver:* exact-match short-circuit before substring.

## §4 Rollup

- ✅ **SAME: 16** — 3 container-side (md-gate, session-bootstrap inject, CC `paths:` injection) + 6 pipeline legs + 7 acceptance-contour rows.
- ⚠️ **WORSE: 4** — `check-doc-authority` (double degradation), markdownlint (cache), `harvest-via-api`×SHA-guard, `bridge-profile` marker (pre-fix).
- ❌ **BROKEN: 3** — the three unregistered `inject-*` hooks (wiring axis).
- ◻️ **COVERAGE-LIMITED: 14** — with a named would-reach-it carrier each (below).

**Most-uncertain row:** the `validate-prompt` / `check-hook-marker` / `check-kickoff-traps` cluster — registered, but *silent from the agent's vantage*, and the carrier cannot disambiguate "fired quietly" from "did not fire". Everything about them is inference; a host-side hook-execution trace is the only disambiguator.

**UNREACHABLE-BY-CARRIER (structural), with would-reach-it carriers:**

| row | would-reach-it carrier |
|---|---|
| `.husky/pre-push` + container `git push` | host-side push (Channel A) — by design, not a defect |
| `ask-question-reminder.sh` | a non-`HANDOFF_MODE` worker |
| Subagent-lifecycle hooks | a session that spawns subagents |
| `runtime-bridge-dispatch.sh` | a session writing runtime-bridge files |
| `worktree-setup.sh` | a session using `claude -w` |
| REVISE rework loop | a task whose diff genuinely diverges from its kickoff |
| Phase-1 code-review | a PR carrying actual code |
| night-mode PR-gate; `/harvest` standalone §4 | an unattended overnight run; a standalone `/harvest` invocation |

## §5 Parked questions — resolution status

- **Q1 (`check-doc-authority` silent — fired-quietly or not at all?) — RESOLVED.** Registered (settings.json:123); `jq` MISSING (`S2 §2.1`) so the hook skips by its own code; its warning uses bare stderr which the harness does not surface. Both halves are now root-caused — see §3 item 1. The residual "did the process literally spawn" is immaterial: with `jq` absent it could not have performed the check either way.
- **Q2 (5 shipped-but-unregistered `inject-*` hooks — intentional or drift?) — MAINTAINER-PENDING.** The *fact* is settled (not registered in the container). The *intent* is not mechanically knowable: these five (`output-language`, `memory-codification`, `project-digest`, `subagent-context`, plus the dispatcher-side `check-worker-dispatch-channel`) are all interactive-session concerns, which makes a deliberate worker-scope exclusion plausible — but plausible is not decided. Recorded here as an open row rather than guessed (kickoff §8 T-AIP-E: a silent channel IS the finding).
- **Q3 (`planRuntimeProfileId=null` — plan on GLM or Opus?) — RESOLVED.** GLM. Only the GLM SDK profile's `lastUsageAt` advanced during this run; the Opus/default profile stayed stale at 2026-07-19. The D1 whole-pipeline-on-executor intent holds for the plan stage. *Caveat:* inferred from profile usage timestamps because `GET /tasks/:id/usage` returns 404 — aif exposes no per-stage model breakdown over REST. That absence is itself a parity observation.

## §6 Self-application (T15) — the audit auditing itself

The kickoff demanded the audit run on its own carrier. Two findings come from doing so:

1. **The auditor fell into the exact trap under study.** While host-side-verifying Q1, this session ran `jq` *inside the container* to inspect `settings.json`, got `jq: not found`, and its `||` fallback printed a fabricated conclusion — "check-doc-authority NOT registered". That is a **silent-tool-absence false negative**: the same failure class as finding §3 item 1, reproduced by the auditor one step after documenting it. It was caught only because the worker's own §2.2 evidence *contradicted* it and the contradiction was chased rather than smoothed over. **Lesson (operational):** a probe whose fallback branch prints a *conclusion* rather than an *error* manufactures evidence; probes must distinguish "tool absent" from "condition false".
2. **The cold-agent boundary held.** The fidelity auditor never saw this dialogue and returned GO on WHAT-conformance; the `pr-body-fidelity` gate then rejected the PR body twice on defects the (non-cold) authoring session had introduced. Detection did not depend on anyone remembering to look — which is the whole claim of [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md).

## §7 Coverage bounds (honest, per T14)

- **Single-carrier bound is structural, not a shortcut:** identical extra carriers add zero coverage (kickoff §5). Every row above that reads COVERAGE-LIMITED names the *differently-shaped* carrier that would reach it — none is a silent drop.
- **Behavioral axis is thin where the harness is quiet:** for the five PostToolUse shields, "SILENT-from-agent-vantage" is honestly recorded as such, never upgraded to SAME. Per T14, a clean-looking row on low observability is *insufficient coverage*, not a clean channel.
- **Row-set provenance:** the container half derives from the worker's own 20-row registered-vs-shipped dump (S2 §2.2), which used [`zcode-parity-doctrine.md §2`](../../../.claude/rules/zcode-parity-doctrine.md) as a **row-set source only** (T-AIP-D) — no ZCode verdict was imported; every aif verdict comes from container observation.
- **Not covered at all:** production-scale behaviour over many tasks, GLM quality-vs-Opus comparison (explicitly descoped to the decision record, kickoff §7), and any row requiring a second carrier shape.
