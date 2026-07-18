<!-- scope:zcode-parity-s4-warn-subagent -->
# ZCode parity Stage 4 — warn-subagent-report ZCode variant research (4 forks, PARKED)

**Date:** 2026-07-18
**Umbrella:** `zcode-full-parity-mega-umbrella` Stage 4
**Branch:** `feat/zcode-parity-s4-warn-subagent-r`
**Type:** R-phase, brainstorm-first. **Strategic fork PARKED — operator decides.**

> **Authoritative for:** the R1–R5 evidence verdicts + 4-fork feasibility analysis for the `warn-subagent-report` ZCode variant. **NOT authoritative for:** the fork decision itself (parked via `park.ts`); project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

---

## §1 Goal restated (one paragraph)

Determine whether a ZCode-functional `warn-subagent-report` is achievable, given that the current CC-only hook fires on `SubagentStop` — an event absent from `ZCODE_EVENTS` (`scripts/render-harness-config.mjs:46-54`). Answer R1–R5 with file:line or bundle-offset evidence; PARK any un-answerable question; analyse 4 design forks (4A/4B/4C/4D); give a technical recommendation; **park the strategic fork for the operator**.

## §2 Event surface (D1 guard + T16 vocabulary check)

Cross-check each candidate event against `ZCODE_EVENTS` (`scripts/render-harness-config.mjs:46-54`):

| Event | In `ZCODE_EVENTS`? | Evidence | Vocabulary meaning |
|---|---|---|---|
| `SubagentStop` | **NO** | `scripts/render-harness-config.mjs:46-54` (set excludes it); `:256` already declares `"NO backup: warn-subagent-report is post-dispatch … — CC-only"` | The CC-only event the current `.claude/hooks/warn-subagent-report.sh:2` registers for. **Inexpressible on ZCode.** |
| `Stop` | YES | `scripts/render-harness-config.mjs:53`; prior bundle evidence `docs/meta-factory/research-patches/2026-07-04-zcode-harness-visibility.md:15` "Event set = `{SessionStart,UserPromptSubmit,PreToolUse,PermissionRequest,PostToolUse,PostToolUseFailure,Stop}` (bundle @571313)" | ZCode `Stop` fires per main-session turn (CC analog). **Not** a subagent-end signal. |
| `PostToolUse:Agent` | YES (matcher fires via alias) | `scripts/render-harness-config.mjs:60-63` "zcode's native tool registry … INCLUDES AskUserQuestion … It is NOT inert. The ONLY inert matcher is MultiEdit: zcode aliases are Task↔Agent and Write/Edit←ApplyPatch ONLY" | `PostToolUse:Agent` matcher registers on ZCode via the `Task↔Agent` alias. Fires after Agent tool returns its result to the **main session**. |

**Step-1 patch prior art** (`docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md:46-49`): explicitly rejected a ZCode variant of this same hook on grounds (a) self-declared CC-only (`warn-subagent-report.sh:7`), (b) event inexpressible, (c) already-declared degradation, (d) existing CC hook + test sufficient. This stage re-opens that rejection only on the R1–R5 / 4-fork substance; the prior art is **AFFIRMED, not overturned**.

---

## §3 R1–R5 evidence verdicts

Per kickoff §4 (park-don't-guess) + §7 stop conditions, every R-answer requires file:line or bundle-offset evidence — NO assertion. Anything unreachable from this environment is PARKED.

### R1 — Is `~/.zcode/cli/rollout/model-io-*.jsonl` reliably readable during a `Stop` hook firing?

**Verdict: PARKED.** No `~/.zcode/cli/rollout/` directory exists in this container (`find / -path '*/.zcode*'` empty; `find ~ -name rollout -type d` empty). The rollout directory lives in the maintainer's ZCode environment; this Linux container is the aif-agent runtime, not the operator's daily driver. **No prior research-patch in the repo characterises rollout readability-during-Stop** (greps `rollout.*readable|rollout.*flush|model-io.*jsonl` surface only the kickoff's own question + Stage 9 R1 which itself was an open question).

Per §7 stop condition «R1-R5 cannot be answered with available evidence → PARK that question (don't guess)»: **PARKED**.

### R2 — Does rollout contain `toolCallId` for Agent calls in a stable schema?

**Verdict: PARKED.** Same evidence gap as R1 — no rollout files in environment, no prior schema characterisation in repo. The CC schema has `toolCallId` on every tool_use/tool_result pair; whether ZCode's rollout mirrors this is unverified. **Cannot assert "yes" or "no" from training data** (T3 active).

### R3 — Is `Stop` fired AFTER all subagent tool_results flushed to rollout?

**Verdict: PARKED.** Race-condition claims are the highest-stakes assertions to fabricate (T3); without a runtime probe or a recorded prior probe, this is exactly the kind of question §7 says to STOP on. No prior research records a Stop-vs-rollout-flush ordering probe.

### R4 — Does ZCode truncate tool_results passed to PostToolUse:Agent the same way CC's 4KB-preview does?

**Verdict: PARKED.** The kickoff cites `zcode.cjs offset ~1395594`, but **the bundle is not present in this environment** (`find / -name zcode.cjs` empty; the prior bundle inspection at `docs/meta-factory/research-patches/2026-07-04-zcode-harness-visibility.md:10` references `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs` — a maintainer-Mac path, absent from this Linux container). Per §7 stop condition «ZCode bundle has changed shape (offset 1395594 stale) → re-find the truncation logic, cite new offset»: **without the bundle at all, we cannot even establish the offset is stale, let alone confirm it**. The prior research-patches reference other offsets (e.g. `8793167`, `571313`, `2047000`, `8897587`, `1073004`, `1038931`) — but **none of them document PostToolUse:Agent payload truncation**.

### R5 — Are there ZCode-specific env vars indicating "subagent just finished"?

**Verdict: PARTIAL — no `ZCODE_SUBAGENT_*` found; two project-dir vars confirmed.**

- `CLAUDE_PROJECT_DIR` IS set on ZCode (`docs/meta-factory/research-patches/2026-07-04-zcode-harness-visibility.md:12`, bundle offset `uRt @ zcode.cjs:1073004`).
- `ZCODE_PROJECT_DIR` IS set on ZCode (same offset; both equal session cwd).
- **No** env var of the form `ZCODE_SUBAGENT_*` is referenced anywhere in repo evidence (`grep -rn 'ZCODE_SUBAGENT'` → only the kickoff question itself). The two project-dir vars do not signal subagent-end; they identify the session workspace only.

So: a "subagent just finished" signal **was not found** in env-var form. Cannot claim universal absence (negative-existence claim — §1.4 adversarial check), so this is PARKED-on-absence-of-evidence, not a positive "no such var exists".

### Summary table

| R# | Verdict | Reason |
|---|---|---|
| R1 | **PARKED** | no rollout dir in env; no prior characterisation |
| R2 | **PARKED** | no rollout files; schema unverified |
| R3 | **PARKED** | race-condition claim requires runtime probe |
| R4 | **PARKED** | zcode.cjs bundle absent from env; cited offset unverified |
| R5 | **PARTIAL** | `ZCODE_PROJECT_DIR` + `CLAUDE_PROJECT_DIR` confirmed; no `ZCODE_SUBAGENT_*` found (negative-existence, not asserted universally) |

**Implication for forks:** every fork that depends on R1–R4 has a feasibility blocker; only Fork 4C is feasibility-determinate today.

---

## §4 4-fork feasibility analysis

For each fork: feasibility (given R-evidence), implementation cost, catch-rate estimate, latency characteristics. Each fork's feasibility is reported as **DETERMINATE** (R-evidence allows a verdict) or **BLOCKED** (one or more PARKED R-questions gate the verdict).

### Fork 4A — `Stop` + rollout scan

- **Mechanism:** hook fires on `Stop`, scans `~/.zcode/cli/rollout/model-io-*.jsonl` for Agent tool_results carrying `<usage>` markers, dedup by `toolCallId`, emit warn if any REPORT section missing.
- **Feasibility: BLOCKED** on R1 (rollout readable during Stop?) + R2 (toolCallId schema stable?) + R3 (flush ordering — without this, the scan can race and miss the just-finished subagent's result).
- **Implementation cost:** high — new rollout JSONL parser + dedup logic + integration with the existing REPORT-section grammar (`warn-subagent-report.sh:78-97`). Estimated 80–150 LOC + a fixture-based test corpus of ≥3 rollout shapes (the §1.1 sample-diversity counter-trap).
- **Catch-rate estimate:** cannot assess — depends on R3 (whether Stop fires post-flush) and on rollout schema stability. If both hold, theoretical catch-rate approaches CC's SubagentStop coverage (every Agent call has a rollout entry); if either fails, undefined.
- **Latency:** real-time at main-session-stop (NOT at subagent-stop). The main session keeps running after every subagent returns; the warn fires only when the main session itself stops — so feedback arrives at end of turn, not at end of subagent. Worse than CC's SubagentStop latency for the operator.
- **Verdict:** feasibility gated on 3 PARKED questions.

### Fork 4B — `PostToolUse:Agent` + payload-read

- **Mechanism:** hook fires on `PostToolUse:Agent`; reads the Agent result from `tool_input`; falls back to rollout scan if payload is truncated.
- **Feasibility: BLOCKED** on R4 (does ZCode truncate the Agent tool_result the same way CC's 4KB-preview does?). The fallback path inherits R1+R2+R3 blockers from Fork 4A.
- **Implementation cost:** medium-high — new PostToolUse:Agent matcher on the warn hook (currently single-event on SubagentStop), payload-truncation detection, conditional fallback to rollout. Estimated 60–100 LOC.
- **Catch-rate estimate:** if R4 confirms CC-style 4KB truncation, catch-rate is bounded by the truncation point — a subagent report longer than 4KB will have its tail (where ATTN/Commit sections typically live) chopped, producing false negatives on the warn. If R4 refutes truncation, catch-rate matches CC.
- **Latency:** real-time at subagent-return (the moment the operator cares about). Best latency of the four forks.
- **Verdict:** feasibility gated on R4; the fallback path additionally gated on R1+R2+R3.

### Fork 4C — declare CC-only, honest degradation

- **Mechanism:** no ZCode variant. Rationale documented in `scripts/render-harness-config.mjs:256` (already there: `"NO backup: warn-subagent-report is post-dispatch (scans the finished report); no updatedInput analogue exists on zcode — CC-only"`) and the step-1 research-patch (`docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md:46-49`).
- **Feasibility: DETERMINATE — ALREADY SHIPPED.** The declaration is live today. The CC-only rationale marker is at `.claude/hooks/warn-subagent-report.sh:7` (`@cc-only-rationale: internal orchestrator hook, maintainer-env only, no portable fire-point`).
- **Implementation cost:** zero — no code change. This research-patch IS the deliverable.
- **Catch-rate estimate:** 0% on ZCode (no hook fires). The honest-degradation cost is the explicit tradeoff.
- **Latency:** N/A.
- **Verdict:** the only fork whose feasibility is settled by current evidence. Aligns with `attention-is-not-a-mechanism.md §1` (loudly declare the narrowing, not silent drop).

### Fork 4D — hybrid (4B fast feedback + 4A completeness)

- **Mechanism:** Fork 4B fires on PostToolUse:Agent for fast feedback on the (possibly truncated) payload; Fork 4A fires on Stop for completeness scan of the full rollout.
- **Feasibility: BLOCKED** on R1+R2+R3+R4 (union of 4A and 4B blockers).
- **Implementation cost:** highest — sum of 4A and 4B LOC, plus the dedup logic to avoid double-warning for the same subagent (the 4B arm warns, then 4A re-warns on Stop without a suppress-token mechanism). Estimated 150–220 LOC.
- **Catch-rate estimate:** if all four R-questions resolve favourably, catch-rate is the union of 4A (post-flush completeness) + 4B (real-time); otherwise undefined.
- **Latency:** 4B latency for the first signal, 4A latency for the complete signal.
- **Verdict:** feasibility gated on the union of all four PARKED questions; the most complex fork with the largest surface for double-warning bugs.

### Summary

| Fork | Feasibility | Cost | Catch-rate | Latency |
|---|---|---|---|---|
| 4A (Stop+rollout) | BLOCKED (R1+R2+R3) | high | undefined w/o R3 | main-session-stop (worse than CC) |
| 4B (PostToolUse:Agent) | BLOCKED (R4; fallback R1+R2+R3) | medium-high | bounded by truncation if R4 confirms | real-time (best) |
| 4C (CC-only, declare) | **DETERMINATE — shipped** | **zero** | 0% on ZCode (honest degradation) | N/A |
| 4D (hybrid) | BLOCKED (R1+R2+R3+R4) | highest | undefined w/o all four | tiered |

---

## §5 Technical recommendation (operator decides the fork)

**Recommendation: Fork 4C is the only feasibility-determinate verdict today.**

Three considerations drive this:

1. **R1–R4 are all PARKED** on missing runtime evidence (rollout dir + zcode bundle). The aif-agent container is structurally the wrong place to probe these — the bundle lives at `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs` on the operator's Mac, and the rollout files live at `~/.zcode/cli/rollout/` on the same machine. **The operator has direct access; the agent does not.**
2. **The pre-existing declaration** at `scripts/render-harness-config.mjs:256` already ships 4C — it is not a new decision, just a research-patch that affirms the prior art (step-1 patch §"Bespoke #2 — REJECTED"). The step-1 patch's rejection reasons (a)–(d) remain valid.
3. **Reversibility:** 4C is reversible. If the operator later probes R1–R4 on their environment and the evidence supports 4A/4B/4D, Stage 5 (conditional, Wave B) can implement the chosen variant without unwinding 4C — the declaration at `:256` simply updates to point at the new mechanism.

**However, per kickoff §4 park-don't-guess, the strategic fork itself is the operator's call** — it bakes in product tradeoffs (real-time vs completeness), effort budget, and architectural fit. The agent's job stops at: (1) R1–R5 verdicts, (2) fork feasibility matrix, (3) this recommendation. The fork decision is parked via `park.ts`.

### What the operator needs to unblock 4A/4B/4D

To move any of 4A/4B/4D from BLOCKED to DETERMINATE, the operator (in their ZCode env) would need to provide:

| For fork | Probe needed | Probe shape |
|---|---|---|
| 4A, 4D | R1 | dispatch a subagent, then on the next main-session Stop, `ls ~/.zcode/cli/rollout/ && head -n 5 <latest>.jsonl` — confirm readability + schema |
| 4A, 4D | R2 | compare 3 rollout files; check `toolCallId` presence on Agent tool_use entries |
| 4A, 4D | R3 | in a Stop hook, log the rollout file's mtime + size vs the subagent-return timestamp; check whether the last Agent tool_result line is present at Stop-fire time |
| 4B, 4D | R4 | `grep -n -A5 -B5 'truncate\|preview' /Applications/ZCode.app/Contents/Resources/glm/zcode.cjs | head -50` — find current PostToolUse:Agent truncation logic; cite offset |
| (any) | R5 | `env | grep -i zcode` from inside a Stop hook — enumerate ZCode-specific vars |

---

## §6 Park-don't-guess contract — invocation

Strategic fork parked via `packages/runtime-bridge/src/cli/park.ts`. Parked-question ID returned by the CLI is recorded in §"In plain words" below.

The parked question carries:
- R1–R5 verdicts (4 PARKED, 1 PARTIAL).
- 4-fork feasibility matrix (only 4C determinate today).
- Agent recommendation: 4C (only feasibility-determinate fork; reversible if operator later provides runtime evidence).
- Explicit hand-off: operator decision needed — product/effort/architecture tradeoff not determinable on technical merits alone.

After park, per kickoff §4 step 5: **finish — do NOT continue to Stage 5 impl.**

---

## §7 §1.7 Self-reflexive review (T15)

Per [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md) — research-patch walks its own discipline.

### Forward-check (compliance with existing disciplines)

- **no-paid-llm-in-ci.md:** this patch is prose-only, zero API calls. ✅
- **build-first-reuse-default.md §3:** no capability proposed — pure research output; no BFR consult required for a research-patch that recommends no new artefact. The forward-going fork (if 4A/4B/4D is later chosen) would trigger the §3 6-item consult; that is Stage 5's obligation, not this R-phase's. ✅
- **doc-authority-hierarchy.md §2-§3:** this file carries an Authoritative-for header (top blockquote). Lives under `docs/meta-factory/research-patches/` — folder-level authority inherited from the README.md there. ✅
- **dual-implementation-discipline.md §2(i):** this is a markdown artefact; §2(i) carve-out — no portable/CC-native pair required. ✅
- **rule-enforcement-channel-selection.md:** no new rule proposed; no channel decision to make. ✅
- **attention-is-not-a-mechanism.md §1:** every declared narrowing is LOUD — Fork 4C is the loud-declaration verdict, already shipped at `render-harness-config.mjs:256`. This patch affirms rather than introduces the declaration. ✅
- **ai-laziness-traps.md §2:** T3 (every claim cited) — R1–R5 + fork matrix cite file:line or PARK; T4 (don't close before all answerable R-questions done) — all 5 R-questions answered (4 PARKED, 1 PARTIAL), no premature closure; T15 (self-application) — this §1.7 block; T16 (vocabulary match) — §2 D1 guard table cross-checks each event against `ZCODE_EVENTS`; T20 (no verdict-without-evidence) — the §5 recommendation explicitly grounds in the R-verbatim table, not asserted from recall. ✅
- **phase-research-coverage.md §1.11:** state-claims verified against git/source — `find /` for rollout dir + bundle, `Grep` for prior research-patch references; no claim from session memory. ✅

### Backward-check (recursive sweep)

- **prior step-1 patch rejection:** step-1 patch §"Bespoke #2 — REJECTED" rejected a ZCode variant with reasons (a)–(d). This patch **affirms** that rejection on independent R-evidence grounds (R1–R4 PARKED) — does not silently supersede it. The rejection rationale at step-1 `docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md:46-49` is cited verbatim in §2.
- **existing `:256` declaration:** the loud-declaration at `scripts/render-harness-config.mjs:256` is the live 4C implementation today. This patch does not edit it (anti-scope §8); it documents that the declaration is evidence-backed.
- **no new artefact created that would itself need a §1.7 review:** this is the §1.7 review.

### Anti-pattern self-check

- `#negative-existence-claim` (§4): the R5 "no `ZCODE_SUBAGENT_*` found" is a negative-existence claim. Per §1.4 adversarial check — the search was a single-environment grep, not an exhaustive bundle probe. **Explicitly marked "PARKED-on-absence-of-evidence, not a positive 'no such var exists'"** in §3 R5. Not load-bearing.
- `#claim-from-memory-not-source`: every R-verdict was probed against the actual filesystem (`find /`, `Grep`) — none from session recall.
- `#discipline-theatre`: the §1.7 block cites real evidence per row, not presence-of-the-section-as-compliance.

---

## §8 Anti-scope confirmation

Per kickoff §8:

- ❌ Did NOT implement any fork. Stage 5 is conditional on operator decision.
- ❌ Did NOT modify `.claude/hooks/warn-subagent-report.sh` or `scripts/render-harness-config.mjs`.
- ❌ Did NOT decide the strategic fork — parked via `park.ts`.

---

## §9 In plain words (operator summary)

- **R1 (rollout readable during Stop?):** PARKED — no rollout dir in env.
- **R2 (rollout toolCallId schema stable?):** PARKED — no rollout files.
- **R3 (Stop fires after subagent flush?):** PARKED — needs runtime probe.
- **R4 (PostToolUse:Agent payload truncation?):** PARKED — zcode.cjs bundle not in env (lives at `/Applications/ZCode.app/.../glm/zcode.cjs`).
- **R5 (ZCode env vars for subagent-end?):** PARTIAL — `ZCODE_PROJECT_DIR` + `CLAUDE_PROJECT_DIR` confirmed; no `ZCODE_SUBAGENT_*` found.
- **4A (Stop+rollout scan):** BLOCKED on R1+R2+R3.
- **4B (PostToolUse:Agent+payload):** BLOCKED on R4.
- **4C (CC-only, declare):** DETERMINATE — already shipped at `render-harness-config.mjs:256` + `warn-subagent-report.sh:7`. Zero new code.
- **4D (hybrid):** BLOCKED on R1+R2+R3+R4.
- **Recommendation:** 4C is the only feasibility-determinate verdict today. Strategic fork PARKED for operator.
- **Parked-question ID:** (returned by `park.ts` — see park.ts stdout)
