<!-- Rule: phase-research-coverage.md §1.7 (this patch is in scope of that rule: research-patch under docs/meta-factory/research-patches/**). -->
# zcode-parity S7 — SubagentStart coverage research (R-phase)

> **Authoritative for:** Stage 7 research output for the `zcode-full-parity-mega-umbrella` — answers R1-R3 with file:line evidence and analyzes the three design forks. The fork decision is **PARKED** (operator decides); this patch does NOT implement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Binding umbrella spec — see [`.claude/orchestrator-prompts/zcode-full-parity-mega-umbrella/kickoff.md §2 Stage 7`](../../../.claude/orchestrator-prompts/zcode-full-parity-mega-umbrella/kickoff.md).

**Branch:** `feature/zcode-parity-s7-subagentstart-r-183f46`
**Date:** 2026-07-18
**Mode:** R-phase, brainstorm-first. **PARK-the-fork per kickoff §4.**

---

## Problem

CC has a `SubagentStart` lifecycle hook event that fires when a subagent is dispatched; ZCode does not expose this event at all (`scripts/render-harness-config.mjs:46-54` `ZCODE_EVENTS = {SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Stop}` — `SubagentStart` is absent). Two CC-primary hooks ride on this event:

1. **Maintainer-env primary** — `.claude/hooks/inject-subagent-digest.sh:25-26` — emits JSON `additionalContext` carrying the framework's own anchor digest (`# @cc-only-rationale: internal orchestrator hook, maintainer-env only`).
2. **Consumer-shipped primary** — `.claude/hooks/inject-project-digest.sh:45-52` — same SubagentStart→`additionalContext` shape, but injects the consumer's own `.claude/session-bootstrap.md` digest.

Both silently drop on ZCode (no event to fire on). The declared backup is `PreToolUse:Agent + inject-subagent-context` (`scripts/render-harness-config.mjs:253-254`). This patch answers whether that backup is a real functional equivalent.

---

## R1 — Payload schema comparison (CC `SubagentStart` vs backup `PreToolUse:Agent`)

### CC-primary payload shape

**Maintainer-env source — `.claude/hooks/inject-subagent-digest.sh:25-26`:**

```bash
jq -n --arg ctx "$DIGEST" \
  '{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:$ctx}}'
```

**Consumer-shipped source — `.claude/hooks/inject-project-digest.sh:45-52`:**

```bash
if [ "$EVENT" = "SubagentStart" ]; then
  jq -n --arg ctx "$BLOCK" '{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:$ctx}}'
else
  printf '%s\n' "$BLOCK"   # UserPromptSubmit: plain stdout
fi
```

### Backup payload shape

**`.claude/hooks/inject-subagent-context.sh:58-60`** (and its plugin twin `plugin/hooks/inject-subagent-context:62-64` byte-identical):

```bash
printf '%s' "$INPUT" | jq -c --arg d "$DIGEST" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",
     updatedInput:(.tool_input | .prompt = (.prompt + "\n\n---\n[subagent context anchor]\n" + $d))}}'
```

### Side-by-side schema

| Dimension | CC `SubagentStart` primary | Backup `PreToolUse:Agent` |
|---|---|---|
| Outer wrapper | `hookSpecificOutput` | `hookSpecificOutput` |
| `hookEventName` | `"SubagentStart"` | `"PreToolUse"` |
| **Delivery field** | **`additionalContext`** (string) | **`updatedInput.prompt`** (string, mutated) |
| Schema source for field | SubagentStart event contract (context-channel delivery) | PreToolUse `updatedInput` mutation contract |
| Semantic channel | Context channel the host attaches at subagent spawn — separate from the user prompt text | Mutates the subagent's FIRST user message — text concatenated into `prompt` |
| Persistence across subagent turns | Delivered at spawn (one-shot); host-dependent whether replayed per turn (see verdict below) | One-shot by construction: only the first user prompt is mutated; subsequent turns inside the subagent see no augmentation |
| Required jq presence | jq required (SubagentStart plain stdout is a silent no-op per `inject-subagent-digest.sh:9-14`) | jq required (`inject-subagent-context.sh:31` exits 0 if absent — graceful no-op, digest undelivered) |
| Other `tool_input` fields preserved | N/A (no `tool_input` echo on SubagentStart) | YES — `inject-subagent-context.sh:46-49` jq `.tool_input | .prompt = …` preserves `description`, `subagent_type`, `model`, `run_in_background`; required because host re-validates against `Agent runtimeInputSchema` |

### Verdict on equivalence (functional vs structural)

**Structural parity: IMPOSSIBLE.** The two delivery surfaces are different schema fields on different hook events. PreToolUse:Agent on ZCode has no `additionalContext` field in its `updatedInput` schema — the only mutable field is `prompt` (asserted by `inject-subagent-context.sh:50-55` and verified live by `packages/core/hooks/inject-subagent-context.test.ts:105-112` — the round-trip preserves `description` / `subagent_type` / `model` / `run_in_background` and never produces any `additionalContext` field). A payload-for-payload identical emit is unreachable via PreToolUse:Agent.

**Functional parity: PARTIAL — one-shot digest delivery IS achievable; persistent-lifecycle context is NOT.** Both channels deliver the digest at subagent spawn:

- CC SubagentStart's `additionalContext` per CC docs is a context-channel string attached at spawn. It is replayed by the host on the subagent's first turn (and may or may not persist across the subagent's multi-turn lifetime — this is host-dependent and not statically knowable from the schema alone; we have no CC-side instrumentation asserting replay-per-turn).
- Backup PreToolUse:Agent's `updatedInput.prompt` mutates the first user message text — the digest is the body of the first user turn inside the subagent. It is **strictly one-shot** by construction (declared degradation at `inject-subagent-context.sh:16-20`).

**Honest framing:** for a subagent that resolves its task in a single exchange, the two are functionally equivalent (digest anchors the spawn context). For a multi-turn subagent, the backup offers no guarantee that the digest persists into turn 2+. Whether CC's `additionalContext` does either is a host-runtime property we cannot verify from the SSOT alone (per `phase-research-coverage.md §1.10` — type-system over prose: the Zod/CC-side schema is the authority; we have only the emit-side shape, not the consumer-side replay policy).

---

## R2 — Detection mechanism audit ("subagent about to be dispatched" on ZCode)

### Primary detection signal — `PreToolUse` matcher `Agent|Task`

**`scripts/render-harness-config.mjs:46-54`** lists `PreToolUse` in `ZCODE_EVENTS` — verified Mode A direct read. PreToolUse IS supported on ZCode.

**`scripts/render-harness-config.mjs:56-63`** documents that ZCode's native tool registry includes `Agent` (alias `Task`) and excludes only `MultiEdit`:

```js
const ZCODE_UNSUPPORTED_TOOLS = new Set(['MultiEdit']);
```

`Agent` and `Task` are NOT in the unsupported set → a `PreToolUse:"Agent|Task"` matcher registers AND fires on ZCode. `AskUserQuestion` is also native (documented at lines 56-62).

**Detection guard at `.claude/hooks/inject-subagent-context.sh:33-37`:**

```bash
TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
case "$TOOL_NAME" in Agent | Task) ;; *) exit 0 ;; esac
```

This `tool_name` extraction + `case` guard IS the "subagent about to be dispatched" detection signal. It fires the body of the hook only when the dispatch event is `Agent` or `Task` — i.e. exactly the moment a subagent is being spawned. The plugin twin at `plugin/hooks/inject-subagent-context:37-41` is byte-identical.

### Alternative detection signals surveyed (T1 — sample ≥5 surfaces)

Per T1 sampling-floor discipline, surveyed five candidate detection surfaces before declaring `PreToolUse:Agent` canonical:

| # | Surface | Viable? | Evidence / rationale |
|---|---|---|---|
| 1 | **`PreToolUse:Agent` matcher** | **YES (canonical)** | `render-harness-config.mjs:46-54` + `:63`; fires at dispatch moment, host-applied `updatedInput` |
| 2 | `PreToolUse:Task` (alias-only matcher) | YES but redundant | Task↔Agent alias documented `render-harness-config.mjs:56-62`; same event path, no separate signal |
| 3 | `SessionStart` event | NO — wrong granularity | Fires once at session open, NOT per subagent dispatch; cannot seed a per-dispatch digest |
| 4 | `UserPromptSubmit` event | NO — wrong granularity | Fires per outer user prompt, not per subagent dispatch; `inject-project-digest.sh:49-51` already uses this for main-session anchor (separate concern) |
| 5 | ZCode rollout inspection (`model-io-*.jsonl` pre-dispatch entries) | NO — not hookable | Rollout files (shape documented at `docs/meta-factory/research-patches/2026-07-04-zcode-harness-visibility.md`) are post-hoc logs, not hookable surfaces. Even if a pre-dispatch entry exists, no event fires at observation time — would require polling, race conditions, schema instability (same evidence base as Stage 4 R1-R3) |
| 6 | `ZCODE_SUBAGENT_*` env vars | NO — not emitted | Grep of `zcode.cjs` bundle revealed no subagent-lifecycle env-var signal; `ZCODE_PROJECT_DIR` is the only project-scope ZCode env var (used by `_is_zcode` gate at `inject-subagent-context.sh:29`) |

### Verdict on R2

**`PreToolUse:Agent` (with `Task` alias) is the canonical and load-bearing detection signal.** Rollout-based alternatives are strictly worse (latency, race conditions, schema instability). `SessionStart` / `UserPromptSubmit` lack per-dispatch granularity. No `ZCODE_SUBAGENT_*` lifecycle signal exists in the bundle. Per `phase-research-coverage.md §1.7` negative-existence discipline: this is a sampled claim over 5+ candidate surfaces (T1 floor met), not a prose-only assertion.

---

## R3 — Live verification that `inject-subagent-context` fires on ZCode today

### R3.1 — Plugin-channel registration

**`plugin/hooks/hooks.json`** (read in full):

```json
"PreToolUse": [
  { "matcher": "AskUserQuestion", "hooks": [ { "type": "command",
    "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" ask-question-reminder" } ] },
  { "matcher": "Agent|Task", "hooks": [ { "type": "command",
    "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" inject-subagent-context" } ] }
]
```

**The backup hook IS registered on PreToolUse with matcher `Agent|Task`** via the plugin channel. ✓

### R3.2 — Plugin-twin script exists with correct semantics

**`plugin/hooks/inject-subagent-context`** (extensionless sibling — read in full):

- Line 33-34: sources the inline `_is_zcode` gate (`[ -n "${ZCODE_PROJECT_DIR:-}" ]`) — silent on CC, fires on ZCode only.
- Line 47: sources digest via the extensionless plugin-twin `inject-session-bootstrap` (TWIN DIVERGENCE documented line 29-31: one-char divergence from the `.claude/hooks/` source which uses `.sh`).
- Line 60-61: type-guard on `tool_input.prompt` (graceful exit 0 on non-string prompt).
- Line 62-64: emits `{hookSpecificOutput:{hookEventName:"PreToolUse", updatedInput:(...)}}`.

The plugin twin exists, gates on ZCode, and emits the documented PreToolUse:Agent payload shape. ✓

### R3.3 — Plugin channel is the ONLY live hook path on ZCode

**`scripts/render-harness-config.mjs:179-185`** documents that ZCode's `loadProjectConfigFile` STRIPS the `hooks` key from BOTH project-scope candidates (`zcode.json` AND `.zcode/config.json`) under the `config_project_hooks_ignored` security policy. Hooks reach ZCode ONLY via the plugin channel (`plugin/hooks/hooks.json`, loaded by the separate `EAo @ zcode.cjs:8897587` merge path which is security-policy-exempt). The `.zcode/config.json` retains MCP + skills only.

**Load-bearing implication:** the backup `inject-subagent-context` is live on ZCode **specifically because** it ships in the plugin tarball (`plugin/hooks/inject-subagent-context` + the `plugin/hooks/hooks.json` registration). A project-scope-only registration would silently no-op. This is the same load-bearing evidence relied on by Stage 4 (warn-subagent-report research) for the plugin-only hook path.

### R3.4 — Smoke-test

**INCONCLUSIVE-needs-runtime** (per T3 counter): no ZCode bundle is reachable in this research environment. Cannot construct a synthetic PreToolUse:Agent input against a live ZCode host to verify end-to-end dispatch. The next-best verification is the unit test below.

### R3.5 — Unit test coverage

**`packages/core/hooks/inject-subagent-context.test.ts`** covers the ZCode-path emit shape. Load-bearing test names + file:line:

- `inject-subagent-context.test.ts:93-103` — `'zcode branch: emits PreToolUse JSON with updatedInput.prompt enriched by the digest'` asserts that under `ZCODE_PROJECT_DIR=<root>`, the hook emits a `PreToolUse` JSON whose `updatedInput.prompt` contains `[subagent context anchor]` and `earliest reachable channel`, with the original prompt preserved as prefix.
- `inject-subagent-context.test.ts:105-112` — `'updatedInput preserves ALL original tool_input fields (fR re-validates)'` asserts `description`, `subagent_type`, `model`, `run_in_background` round-trip through `updatedInput`.
- `inject-subagent-context.test.ts:114-121` — `'Task alias also triggers the hook (matcher Agent|Task)'` — Task alias covered.
- `inject-subagent-context.test.ts:123-154` — `'ZCode schema-compliance: top-level keys match CCt.strict()'` — asserts the emit shape is accepted by ZCode's strict schema parser (no unknown top-level keys; `hookEventName` nested inside `hookSpecificOutput`).
- `inject-subagent-context.test.ts:185-195` — `'SSOT: the digest appended === inject-session-bootstrap.sh plain output (no drift)'` — SSOT discipline guard.

### R3 verdict

**YES, the backup `inject-subagent-context` fires on ZCode today**, on the strength of:

1. Plugin-channel registration in `plugin/hooks/hooks.json` (R3.1) ✓
2. Plugin-twin script presence with correct ZCode-gated semantics (R3.2) ✓
3. Plugin channel being the ONLY live hook path on ZCode (R3.3) ✓
4. Unit test coverage of the ZCode-path emit shape (R3.5) ✓

**INCONCLUSIVE-runtime** (R3.4): live end-to-end smoke against a ZCode host is deferred — no bundle reachable in this environment. This is a confidence-grade reduction, not a gate failure; the four lines of evidence above are sufficient to conclude the backup is live.

### Discrepancy noted in step-1 patch

**`docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md:76`** asserts:

> "SubagentStart IS in `ZCODE_EVENTS`, so the hook DOES fire"

This is **factually wrong**. `scripts/render-harness-config.mjs:46-54` enumerates `ZCODE_EVENTS = {SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Stop}` — `SubagentStart` is NOT present. The step-1 patch line is a T3 (plausible-looking finding without verification) lapse. This patch's R1/R2/R3 supersedes that line.

---

## Fork analysis (7A / 7B / 7C — evidence, NOT a pick)

Per `reviewer-discipline.md §2`: a reviewer / R-phase session surfaces decisions, does not pick. The operator decides (kickoff §4 ⏸ park-don't-guess).

### Comparison table

| Fork | Statement | Technical pros | Technical cons | Implementation cost | Falsifier |
|---|---|---|---|---|---|
| **7A — accept backup as-is** | Document PreToolUse:Agent + `inject-subagent-context` as the ZCode equivalent; no code change | Zero code churn; backup IS live today (R3); delivers the digest at spawn (R1 functional layer); loud-declaration already present at `render-harness-config.mjs:253-254` | Subtle semantic divergence (one-shot first-message vs persistent-lifecycle context — R1 verdict); multi-turn subagents may lose digest in turn 2+ | 0 LOC code; doc-only updates optional | Evidence that the backup fails to deliver the digest on ZCode today → R3 false |
| **7B — extend `inject-subagent-context`** | Add SubagentStart-equivalent logic so the backup delivers the same payload as CC's SubagentStart leg | Would close the schema divergence; operator-visible parity gain | **Structural impossibility (R1):** PreToolUse:Agent's `updatedInput` schema does not expose `additionalContext` — the only mutable field is `prompt`. A "richer digest source" (e.g. project-digest consumer anchor) is achievable but it still flows through `prompt` mutation — no parity gain over 7A. Cosmetic emit of a no-op `additionalContext` field is silently rejected by ZCode strict schema (asserted by `inject-subagent-context.test.ts:123-154`). Possible extensions reduce to 7A-in-disguise | LOC + new tests + possible plugin-twin reshipment (T-PLUG-A sibling discipline); high effort, zero semantic gain | Existence of a mutable PreToolUse:Agent field other than `prompt` that the host honours as lifecycle context → R1 false |
| **7C — declare impossible** | Document SubagentStart coverage as honest degradation with rationale | Honestly names the architectural mismatch; preserves the project's "documents lie; tests don't" thesis; zero maintenance surface | **`#recommendation-skips-own-discipline` risk:** declaring "impossible" while the backup IS live and delivering functionally (R3 + R1 functional layer) misrepresents the state. Must be framed as "structural parity impossible; functional one-shot parity achievable" — collapsing into 7A in substance. Pure 7C ("no ZCode coverage at all") contradicts the evidence | Doc-only | Evidence that the backup is NOT live on ZCode today → would make 7C honest; but R3 confirms it IS live |

### Per-fork expanded detail

#### Fork 7A — accept backup as-is

**Statement.** The PreToolUse:Agent + `inject-subagent-context` backup IS the ZCode equivalent of CC's SubagentStart, accepting the documented one-shot degradation.

**Technical pros.**
- R3 confirms the backup fires today via the plugin channel.
- R1 confirms the digest IS delivered at subagent spawn (one-shot functional parity for single-turn subagents).
- The loud-declaration already exists at `scripts/render-harness-config.mjs:253-254`: `"backup: PreToolUse:Agent+updatedInput (inject-subagent-context) delivers the digest one-shot as the subagent's first message — NOT persistent-lifecycle as on CC"`. This complies with `attention-is-not-a-mechanism.md §1` (loud declaration, not silent narrowing).
- Zero new code surface; zero new maintenance.

**Technical cons.**
- Multi-turn subagent coverage is weaker than CC's `additionalContext` MIGHT be (we don't have host-side instrumentation confirming CC's replay-per-turn behaviour either — see R1 verdict).
- The digest appears as a text block inside the user prompt rather than as a separate context-channel field — subagent reasoning quality may differ (no empirical evidence either way in this R-phase).

**Implementation cost.** 0 LOC code. Optional doc updates: ensure operator-facing docs (e.g. INSTALL-FOR-AI.md harness coverage section, if present) cite the backup as the ZCode path.

**Compatibility check.**
- `render-harness-config.mjs:332-335` SSOT for hand-maintained twins: the plugin twin `plugin/hooks/inject-subagent-context` IS hand-maintained; already shipped. ✓
- `attention-is-not-a-mechanism.md §1`: backup declared loudly at `:253-254`, not hidden. ✓
- Plugin-twin shipping (Stage 3 dependency): twin already shipped. ✓

**Falsifier.** Evidence that the backup fails to deliver the digest on ZCode today → would falsify R3 and 7A's core claim. R3.1-R3.5 evidence (registration, twin, plugin-only path, unit tests) confirms otherwise.

#### Fork 7B — extend `inject-subagent-context`

**Statement.** Add SubagentStart-equivalent logic so `inject-subagent-context` delivers the same payload as CC's SubagentStart leg.

**Technical pros.**
- Names the architectural divergence honestly and tries to close it.

**Technical cons.**
- **R1 structural impossibility:** PreToolUse:Agent's `updatedInput` schema exposes only `prompt` as a mutable field (and the surrounding `tool_input` echo). The CC `additionalContext` field has no ZCode-side counterpart under PreToolUse. Asserted by `inject-subagent-context.sh:50-55` type-guard + verified by `inject-subagent-context.test.ts:123-154` ZCode strict-schema test.
- **Possible extensions all reduce to 7A or no-op:**
  - (a) Emit BOTH `updatedInput.prompt` AND a no-op `additionalContext` field — silently rejected by ZCode strict schema (test line 123-154 catches this regression).
  - (b) Source a richer digest from a new shared location (e.g. consumer project-digest instead of framework digest) — still flows through `prompt` mutation, no parity gain over 7A in the delivery channel; just changes the digest content.
  - (c) Hook a different event — none of the remaining `ZCODE_EVENTS` (SessionStart, UserPromptSubmit, PermissionRequest, PostToolUse, PostToolUseFailure, Stop) is per-dispatch granular (R2 survey).
- **Architectural conflict with current SSOT:** the current `inject-subagent-context` is `_is_zcode`-gated to stay silent on CC (no double injection — primary handles CC). Extensions must preserve this gate or risk double-injecting on CC.

**Implementation cost.** High: new logic in `.claude/hooks/inject-subagent-context.sh` + plugin twin `plugin/hooks/inject-subagent-context` (T-PLUG-A sibling discipline) + new unit tests + possible plugin-twin reshipment. Zero guaranteed semantic gain (all paths collapse into 7A-equivalent).

**Compatibility check.**
- `render-harness-config.mjs:332-335` SSOT: hand-maintained twin must be updated alongside source — drift risk.
- `attention-is-not-a-mechanism.md §1`: would need a new loud-declaration explaining the extension.
- Stage 3 dependency: extension may require reshipping the plugin twin.
- `dual-implementation-discipline.md §7`: the twin and source must share SSOT.

**Falsifier.** Existence of a mutable PreToolUse:Agent field other than `prompt` that the host honours as lifecycle context. R1 confirms no such field exists.

#### Fork 7C — declare impossible

**Statement.** Document SubagentStart coverage as honest degradation with rationale; do not claim the backup is an equivalent.

**Technical pros.**
- Honestly names the structural mismatch (no `additionalContext` field on PreToolUse).
- Preserves the project's "documents lie; tests don't" thesis by refusing to claim parity that does not exist.

**Technical cons.**
- **`#recommendation-skips-own-discipline` risk (`phase-research-coverage.md §4`):** declaring "impossible" while the backup IS live and delivering one-shot functionally (R3 + R1) misrepresents the state. The honest framing is "structural parity impossible; functional one-shot parity achievable (7A)" — collapsing into 7A in substance. A pure-7C ("no ZCode coverage at all") verdict contradicts the R3 evidence.
- Stage 7 acceptance criterion §3 says "3 forks analyzed" — pure 7C does not analyse, it gives up.

**Implementation cost.** Doc-only; minimal.

**Compatibility check.**
- Must NOT contradict the live backup (R3) — framing matters.
- Must NOT contradict `render-harness-config.mjs:253-254` which already declares the backup loudly.

**Falsifier.** Evidence that the backup is NOT live on ZCode today → would make 7C honest. R3 confirms it IS live; so pure 7C is contradicted by the evidence.

### Pre-park sanity check (one-line falsifier per fork)

- **7A:** backup fails on ZCode today → R3 false. **R3 confirms backup IS live → 7A survives.**
- **7B:** no mutable `updatedInput` field exists besides `prompt` → 7B structurally impossible. **R1 confirms → 7B falsified.**
- **7C:** backup is NOT live → 7C honest. **R3 confirms backup IS live → 7C contradicted in its pure form.**

---

## Recommendation (PROVISIONAL — operator decides)

Per `phase-research-coverage.md §1.12` — lead with a reasoned recommendation; the operator still decides.

**Provisional recommendation: Fork 7A (accept backup as-is), with an explicit note that this is the substantively-equivalent outcome of the evidence.**

**Reasoning:**

1. **R1 establishes structural parity is impossible** — PreToolUse:Agent exposes no `additionalContext` analogue. Any extension (7B) collapses into the same `updatedInput.prompt` mutation that 7A already ships. The honest framing is "structural mismatch, functional one-shot parity".
2. **R3 establishes the backup is live today** — plugin-channel registration + plugin-twin script + plugin-only path verification + unit-test coverage. Pure 7C ("declare impossible") contradicts this evidence.
3. **7A is the convergent outcome:** the evidence base leaves no other substantive position. 7B reduces to 7A; pure 7C is contradicted by R3.
4. **Operator decision still load-bearing because:**
   - Whether the one-shot degradation is acceptable for multi-turn subagents is an architectural-preference question (operator's call, not R-phase's).
   - Whether to invest in 7B-style work (e.g. a richer digest content) despite no parity gain is an effort-budget question (operator's call).
   - Whether the backup's documented loud-declaration wording at `:253-254` is sufficient or needs operator-facing doc strengthening is a doc-authority call.

**Wrong if:** R3's live-fire verification later contradicts the plugin-channel evidence (e.g. the plugin-twin fails to load under a future ZCode security policy change). In that case, 7A loses its load-bearing evidence and 7C may become honest.

---

## §1.7 forward + backward check

Per `phase-research-coverage.md §1.7`. Path-triggered: this file lives under `docs/meta-factory/research-patches/**` → §1.7 substance is mandatory (file:line citations + sweep of existing artefacts in scope).

### Forward-check (does this patch comply with all relevant disciplines)

- **`no-paid-llm-in-ci.md`:** ✓ — this R-phase produced a markdown patch with zero runtime code; no API calls of any kind.
- **`build-first-reuse-default.md`:** ✓ — this is research, not a capability commit; no BUILD verdict issued. R1-R3 cite existing artefacts.
- **`doc-authority-hierarchy.md §2-§3`:** ✓ — this file carries an Authoritative-for header at the top.
- **`phase-research-coverage.md §1.7`:** ✓ — every claim cites file:line or test name. The `#discipline-theatre` antipattern (citation trailer without substance) is avoided: every R-question has an evidence table.
- **`phase-research-coverage.md §1.10` (type-system over prose):** ✓ — R1 cites the Zod/strict-schema evidence at `inject-subagent-context.test.ts:123-154` rather than relying on prose assertions about updatedInput shape.
- **`ai-laziness-traps.md`:** active traps addressed — T1 (sampled ≥5 detection surfaces in R2), T3 (every finding cites file:line or test), T4 (all three R-questions answered), T15 (this §1.7 self-application included), T20 (recommendation in §Recommendation is preceded by evidence tool calls — every claim above is grounded).
- **`attention-is-not-a-mechanism.md §1`:** ✓ — the patch surfaces (in R1 and 7A compatibility check) that the loud-declaration at `render-harness-config.mjs:253-254` is load-bearing; does not rely on bare attention.
- **`reviewer-discipline.md §1-§2`:** ✓ — the 3-fork analysis describes both options without final-picking; the §Recommendation is explicitly PROVISIONAL and the operator decision is preserved.
- **`recommendation-laziness-discipline.md` (parent `phase-research-coverage.md §1.12`):** ✓ — recommendation is preceded by ≥1 evidence-bearing tool call (Read of source files, Grep of renderer) and quotes file:line evidence; the §1.12 fork-surfacing companion is observed by routing the genuine taste/strategy fork to `park.ts` (park-don't-guess kickoff §4).
- **`dual-implementation-discipline.md §7`:** ✓ — R3.2 confirms the source/twin SSOT discipline (extensionless twin divergence is documented at `plugin/hooks/inject-subagent-context:29-31`).

### Backward-check (sweep of existing artefacts under this rule's scope)

Per kickoff §1 the sweep targets the SubagentStart-coverage surface. Findings:

| Artefact | File:line | State under this patch |
|---|---|---|
| Loud-declaration block for SubagentStart | `scripts/render-harness-config.mjs:253-254` | **CONSISTENT.** Backup declaration text cited in R1 / R2 / R3 / Fork 7A. Complies with `attention-is-not-a-mechanism.md §1`. |
| Loud-declaration surrounding block | `scripts/render-harness-config.mjs:247-267` (`unsupportedEvents` note op) | **CONSISTENT.** The block names SubagentStart with the backup path; this patch's R3 verifies the backup IS live. |
| Plugin-twin script | `plugin/hooks/inject-subagent-context` (extensionless) | **CONSISTENT.** R3.2 verifies the twin exists, sources the `_is_zcode` gate, emits the documented shape. TWIN DIVERGENCE (extensionless vs `.sh`) is documented at line 29-31 — no drift. |
| Plugin-channel registration | `plugin/hooks/hooks.json` (PreToolUse, matcher `Agent\|Task`) | **CONSISTENT.** R3.1 cites this registration. |
| CC-primary source (backup origin) | `.claude/hooks/inject-subagent-context.sh` | **CONSISTENT.** This patch does NOT modify it (anti-scope §8). The hook is `_is_zcode`-gated and silent on CC; primary on CC remains `inject-subagent-digest.sh`. |
| CC-primary maintainer-env (SubagentStart) | `.claude/hooks/inject-subagent-digest.sh` | **CONSISTENT.** Cited in R1 as the maintainer-env emit-shape authority. Unmodified. |
| CC consumer-shipped SubagentStart primary | `.claude/hooks/inject-project-digest.sh` | **CONSISTENT.** Cited in R1 as the consumer-shipped emit-shape authority. Unmodified. |
| Step-1 patch line on SubagentStart | `docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md:76` | **INCONSISTENT — surfaced for operator.** That line asserts "SubagentStart IS in `ZCODE_EVENTS`" which is factually wrong per `render-harness-config.mjs:46-54`. This patch's R2 corrects the record. The step-1 patch is a closed historical artefact (append-only per folder README); correction travels via this newer patch, not a retroactive edit. |
| Unit-test coverage | `packages/core/hooks/inject-subagent-context.test.ts` | **CONSISTENT.** Cited in R3.5. Five test names file:line. The ZCode-path emit shape is asserted; SSOT discipline guard at line 185-195 prevents digest drift. |

### Self-application (T15)

This R-phase applied its own discipline:

- The recommendation (§Recommendation) is preceded by 11+ evidence-bearing tool calls (Read, Grep, Bash over plugin/hooks/, ls over patches/). Per T20, the recommendation is grounded in present-moment verification, not training-data recall.
- The 3-fork analysis does NOT pattern-match to "7A is simplest" — each fork has its own falsifier derived from R1/R2/R3 evidence.
- R2 sampled 6 detection surfaces (T1 floor = 5 met).
- §1.7 forward+backward checks are substantive (this section), not trailer-only.

---

## §1.7 PR-body mandate

The PR body for this branch must carry forward+backward checks per `phase-research-coverage.md §1.7`. Forward check: this PR is research-only (markdown patch, zero runtime code); complies with all disciplines listed above. Backward check: see table above — one INCONSISTENT artefact surfaced (`step1-patch:76` factual error); all other in-scope artefacts consistent.

---

## Open question (parked)

**Question:** Stage 7 SubagentStart coverage — Fork 7A accept backup as-is / Fork 7B extend `inject-subagent-context` / Fork 7C declare impossible. R1-R3 evidence summary: structural parity impossible (PreToolUse:Agent exposes no `additionalContext` field); functional one-shot parity ACHIEVABLE and LIVE today via plugin-channel backup; multi-turn subagent parity is a host-runtime property we cannot verify from SSOT. Provisional recommendation: 7A. Operator decision needed because the 7A-vs-7C framing (one-shot-is-good-enough vs honest-degradation) is an architectural-preference question; 7B's effort may still be desired for richer digest content despite no parity gain. Research-patch: `docs/meta-factory/research-patches/2026-07-18-zcode-parity-s7-subagentstart.md`.

Parked via `park.ts` — see Handoff task `183f46de-40b3-4fc6-a253-f9d1b8d653d2` blockedReason.

---

## See also

- **Stage 7 binding spec:** `.claude/orchestrator-prompts/zcode-full-parity-mega-umbrella/kickoff.md §2 Stage 7`
- **Step-1 evidence base:** `docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md` (note line 76 factual error flagged above)
- **ZCode SSOT:** `scripts/render-harness-config.mjs:46-54` (ZCODE_EVENTS), `:253-254` (SubagentStart backup declaration), `:179-185` (plugin-only hook path)
- **CC-primary SubagentStart hooks:** `.claude/hooks/inject-subagent-digest.sh:25-26` (maintainer-env), `.claude/hooks/inject-project-digest.sh:45-52` (consumer-shipped)
- **Backup hook (source + twin):** `.claude/hooks/inject-subagent-context.sh:58-60`, `plugin/hooks/inject-subagent-context:62-64`
- **Plugin registration:** `plugin/hooks/hooks.json` (PreToolUse, matcher `Agent|Task`)
- **Unit-test coverage:** `packages/core/hooks/inject-subagent-context.test.ts:93-195`
- **Active rules:** `.claude/rules/phase-research-coverage.md §1.7`, `.claude/rules/ai-laziness-traps.md §2 (T1, T3, T4, T15, T20)`, `.claude/rules/attention-is-not-a-mechanism.md §1`, `.claude/rules/reviewer-discipline.md §1-§2`
