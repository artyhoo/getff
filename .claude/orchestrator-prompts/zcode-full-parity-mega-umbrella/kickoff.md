# KICKOFF — zcode-full-parity-mega-umbrella (RESEARCH-FIRST, multi-stage)

> **Type:** research-first mega-umbrella. NOT execution-build. Goal: full ZCode parity — every framework hook that works on CC must work on ZCode. Each stage produces a verified verdict (ADOPT/BUILD/REJECT) before any implementation.
> **Origin:** orchestrator session 2026-07-18 (continuation of zcode-parity-step1 which is IN-FLIGHT as separate umbrella). User explicitly requested: «нужно прям завести мега амбрелу со всеми шагами сразу чтобы все реализовать» + «нужно чтобы хуки работали и в зкоде».
> **Base branch:** `staging`.
> **Process anchor:** `superpowers:brainstorming` for stage framing + `superpowers:writing-plans` for per-stage plan + Phase -1 self-review before each stage's implementation dispatch.

---

## §0 Why this umbrella exists

**Honest framing (verified in step-1 deep-sweep):**

- 9 of 9 existing plugin-channel twins already work on ZCode (each has env-first `REPO_ROOT` resolution).
- 1 hook (`end-of-turn-reminder`) is runtime-DEAD on ZCode — fixed in step-1 (in-flight).
- 1 hook (`inject-project-digest`) has latent B1 bug at source level — fixed in step-1; **twin not shipped to plugin channel**.
- 1 hook (`warn-subagent-report`) is CC-only by design — fires on `SubagentStop` (not in `ZCODE_EVENTS`).
- SubagentStart coverage: inject-project-digest registers on SubagentStart on CC; silent-drop on ZCode (event absent).

**Gap to full parity** (this umbrella's scope):
- Ship plugin twins for hooks that exist at source but not in plugin channel.
- Research + design ZCode-functional alternatives for CC-only event semantics.
- Migrate existing 9 twins to consolidated helper pattern.
- Document every degradation honestly (CC-only concept → declared alternative).

---

## §1 Goals (what "full parity" means)

- **G1 — Plugin-channel coverage complete.** Every consumer hook registered via `register_cc_hook` in `setup.d/10-skills.sh` has a working plugin twin that fires correctly on ZCode.
- **G2 — Subagent event parity.** Honest alternative for `SubagentStart` and `SubagentStop` semantics — either via ZCode-supported events (PreToolUse:Agent / PostToolUse:Agent / Stop) or via declared degradation with rationale.
- **G3 — Pattern consolidation.** All plugin twins source `_zcode-emit` helper (delivered in step-1) instead of copy-pasting the `_is_zcode`/`_emit_ctx`/`_adv_violation` trio.
- **G4 — Cursor/Codex/Aider coverage.** Survey other harness transcript formats; decide whether framework claims agnosticism for them or declares them out-of-scope. Honest verdict per harness.
- **G5 — Documentation SSOT.** `.claude/rules/zcode-parity-doctrine.md` (or extension of existing doc) listing every hook, its CC channel, its ZCode channel, and the resolution status (works / degraded / impossible).

---

## §2 Stages (sequential; research → verdict → plan → impl per stage)

### Stage 1 — Inventory + gap-confirmation (research, deterministic)

**Goal:** produce a complete census of framework hooks + their channel coverage today.

**Deliverable:** `docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md`.

Steps:
1. Enumerate every `.claude/hooks/*.sh` script (full population, no sampling — T10).
2. For each: classify by delivery channel (CC-dogfood only / CC+plugin / framework-internal).
3. Cross-reference with `setup.d/10-skills.sh` `register_cc_hook` calls (CC install path).
4. Cross-reference with `plugin/hooks/hooks.json` registrations + `plugin/hooks/` filesystem (plugin channel).
5. Cross-reference with `render-harness-config.mjs:46-54` `ZCODE_EVENTS` (which events are expressible on ZCode).
6. Build the master table: | hook | CC event(s) | plugin twin? | ZCode event support | gap? |.
7. Verify each "gap" row by direct evidence (not assertion — T3).

**Acceptance:** the census doc is the SSOT for all subsequent stages. Every later stage references it by row.

### Stage 2 — Mechanism 2 alternative research (brainstorm-first)

**Goal:** decide whether to revive some form of twin-generation automation, OR formalize the hand-maintained pattern via lint/test.

**Why this stage:** step-1 dropped Mechanism 2 (auto-derivation) because it conflicted with `render-harness-config.mjs:333` SSOT ("sibling scripts are hand-maintained"). But maintaining 9+ twins by hand is error-prone. There may be a middle ground.

**Brainstorming forks** (use `superpowers:brainstorming`):
- **Fork 2A:** Twin-conformance lint — extend `tests/plugin/hook-paths.test.sh` with checks that verify each plugin twin carries the env-first REPO_ROOT form, the extensionless sibling-call, the consumer-guard where applicable. Catches drift; doesn't auto-generate.
- **Fork 2B:** Per-hook transform spec — declare each twin's divergence explicitly in a YAML sidecar (`{twin: inject-matching-rule, transforms: [rename-REPO_ROOT-to-PROJECT_DIR, add-relocation-comment]}`). Renderer reads spec, applies transforms. More upfront work; less future drift.
- **Fork 2C:** Pure hand-maintained + `make check-twins` script — keep current pattern, add a CI test that diffs source vs twin and asserts only known-divergence hunks differ.
- **Fork 2D:** Drop the twin concept entirely — find a way to make one script work in both channels (e.g. runtime detection: `if [ -n "$CLAUDE_PLUGIN_ROOT" ]; then ... else ... fi`).

**Verdict per fork:** ADOPT / DEFER / REJECT with file:line evidence. Maintainainer decides (reviewer-discipline §2 — surface forks, don't pick).

### Stage 3 — Plugin twin shipping for inject-project-digest + inject-output-language (execution-build)

**Goal:** ship the two consumer hooks that are registered on CC but lack plugin twins.

Depends on: step-1 B1 source-level fix has landed (umbrella `zcode-parity-step1-emit-wrapper`). This stage uses the fixed source.

**Deliverables:**
- `plugin/hooks/inject-project-digest` (extensionless twin with B1 env-first rewrite applied at twin level too).
- `plugin/hooks/inject-output-language` (extensionless twin; no `$0`-relative reads → byte-identical to source).
- `plugin/hooks/hooks.json` registrations.
- Doc: explicit rationale for why these twins are now safe to ship (B1 latent bug closed).

**Acceptance:** both hooks fire correctly on ZCode (verified via test fixtures simulating plugin-channel invocation).

### Stage 4 — warn-subagent-report ZCode research (brainstorm-first, hardest stage)

**Goal:** determine whether a ZCode-functional warn-subagent-report is achievable, and if so, design + build it.

**Current state:** CC-only. Fires on `SubagentStop`. ZCode has no `SubagentStop` event.

**Research questions (verify each before designing):**

- **R1:** Is `~/.zcode/cli/rollout/model-io-*.jsonl` reliably readable during a `Stop` hook firing? Verify on multiple subagent dispatch patterns (single short call, parallel batch, deep subagent-of-subagent).
- **R2:** Does the rollout contain `toolCallId` for Agent calls in a stable schema? Compare 3+ rollout files for shape consistency.
- **R3:** Is the `Stop` event fired AFTER all subagent tool_results are flushed to rollout? (Race condition risk.)
- **R4:** Does ZCode truncate tool_results passed to PostToolUse:Agent the same way CC's 4KB-preview does? (`zcode.cjs` offset ~1395594 — re-verify on current bundle.)
- **R5:** Are there ZCode-specific env vars or signals that indicate "subagent just finished" (e.g. `ZCODE_SUBAGENT_*`)?

**Design forks** (after R1-R5 answered):
- **Fork 4A (Stop + rollout scan):** hook fires on Stop, scans rollout for Agent tool_results with `<usage>`, dedup by toolCallId, emits warn if REPORT sections missing. Real-time latency (fires when main session stops, not when subagent stops).
- **Fork 4B (PostToolUse:Agent + payload-read):** hook fires on PostToolUse:Agent; reads the (possibly truncated) Agent result from `tool_input`; falls back to rollout scan if payload is truncated. Real-time but partial catch.
- **Fork 4C (declare CC-only, document honest degradation):** no ZCode variant; rationale documented in `render-harness-config.mjs:256` (already there) + research-patch doc.
- **Fork 4D (hybrid):** Fork 4B for fast feedback + Fork 4A for completeness on Stop.

**Verdict:** ADOPT one fork with file:line evidence. If 4C, this stage produces only documentation. If 4A/4B/4D, stage 5 implements.

### Stage 5 — warn-subagent-report implementation (conditional on Stage 4 verdict)

**Goal:** build the chosen ZCode variant from Stage 4.

**Conditional:** only runs if Stage 4 verdict ≠ 4C.

**Deliverables per chosen fork:** new hook script + test + doc.

### Stage 6 — 9-twin migration to `_zcode-emit` helper (execution-build)

**Goal:** consolidate the copy-pasted `_is_zcode`/`_emit_ctx`/`_adv_violation` trio into sourced helper calls across all 9 plugin twins.

Depends on: step-1 `_zcode-emit` helper has landed + Stage 2 verdict (Fork 2A lint ensures migration doesn't regress).

**Per-twin migration:**
1. Add `source "${SCRIPT_DIR}/_zcode-emit"` near top of twin.
2. Replace inlined `_is_zcode` / `_emit_ctx` / `_adv_violation` function definitions with calls to helper.
3. Run twin's existing test (must remain green).
4. Run integration test: wrapper + twin output == direct twin invocation.

**Deliverables:** 9 twin edits + 9 integration tests (or 1 parametrized test covering all 9).

### Stage 7 — SubagentStart coverage research (brainstorm-first)

**Goal:** design a ZCode-functional alternative for SubagentStart semantics.

**Current state:** CC has SubagentStart (inject-project-digest fires when subagent starts). ZCode doesn't. Backup documented at `render-harness-config.mjs:253-254`: PreToolUse:Agent + inject-subagent-context.

**Research questions:**
- **R1:** Does the PreToolUse:Agent backup actually deliver the same payload as CC's SubagentStart?
- **R2:** Is there a way to detect "subagent is about to be dispatched" via ZCode events or rollout inspection?
- **R3:** Does `inject-subagent-context` (currently the backup) actually fire on ZCode today? Verify.

**Design forks:**
- **Fork 7A (accept backup as-is):** document PreToolUse:Agent + inject-subagent-context as the ZCode equivalent; no code change.
- **Fork 7B (extend inject-subagent-context):** add SubagentStart-equivalent logic to inject-subagent-context so it delivers the same digest as CC's SubagentStart leg.
- **Fork 7C (declare impossible):** document as honest degradation with rationale.

### Stage 8 — Cursor/Codex/Aider agnosticism survey (research)

**Goal:** honest verdict on whether the framework claims agnosticism for non-CC/ZCode harnesses.

**Steps:**
1. Survey transcript formats for Cursor, Codex CLI, Aider, Windsurf (if any have hook systems).
2. For each: does it have a hook system at all? If yes, what events? What transcript format?
3. Cross-reference with the framework's `ZCODE_EVENTS` / `CC_EVENTS` — what's the delta?
4. Issue verdict per harness: SUPPORTED (works today) / FEASIBLE (could work with adapter) / OUT-OF-SCOPE (no hook system / fundamentally incompatible).

**Deliverable:** `docs/meta-factory/research-patches/<date>-harness-agnosticism-survey.md`.

### Stage 9 — Multi-turn + ai-title anchor research (brainstorm-first)

**Goal:** design ZCode alternatives for two CC-exclusive concepts.

**Current state:**
- **Multi-turn idle-suppression guard** (end-of-turn-reminder L159-188): compares tail-2|head-1 vs tail-1 of transcript. ZCode's synthetic transcript writes 1 line per turn → guard impossible.
- **`ai-title` anchor** (end-of-turn-reminder L40, L43): grep `"type":"ai-title"`. ZCode bundle has 0 occurrences of `ai-title` / `aiTitle`.

**Research questions:**
- **R1:** Does ZCode's rollout (`model-io-*.jsonl`) contain multi-turn data? (Verified yes in step-1 — multiple lines per session.) Can we parse multi-turn from rollout instead of synthetic transcript?
- **R2:** Is there a ZCode-equivalent of CC's `ai-title`? Check bundle for any "session goal" / "summary" concept.
- **R3:** If no ai-title equivalent, what's the best fallback anchor? First user prompt? Hardcoded "session recap" string?

**Design forks:**
- **Fork 9A (rollout-based multi-turn):** rewrite the guard to read multi-turn from rollout instead of synthetic. ~50-80 lines.
- **Fork 9B (declare impossible + degrade gracefully):** keep the existing single-turn guard on synthetic; document the limitation.
- **Fork 9C (hybrid):** synthetic for anchor, rollout for multi-turn — best of both.

### Stage 10 — Documentation SSOT (synthesis)

**Goal:** consolidate all decisions into one canonical doc.

**Deliverable:** `.claude/rules/zcode-parity-doctrine.md` (or extension of existing parity doc).

Contents:
- Per-hook table: | hook | CC channel | ZCode channel | status | rationale |
- Per-degradation: explicit rationale + alternative (or declared impossible).
- Per-research-patch: pointer to the research-patch doc with verdict.
- Update `render-harness-config.mjs:247-258` loud-declaration block if any degradation changes.

---

## §3 Dependencies (stage ordering)

```text
Stage 1 (census) ─┬─> Stage 2 (mech-2 alt research)
                  ├─> Stage 3 (twin shipping) [needs step-1 B1 fix landed]
                  ├─> Stage 4 (warn-subagent research) ─> Stage 5 (conditional impl)
                  ├─> Stage 7 (SubagentStart research)
                  ├─> Stage 8 (Cursor/Codex survey)
                  └─> Stage 9 (multi-turn/anchor research)
                                                                                  │
                                                                                  v
                                                                          Stage 10 (doc)
```

Stages 2, 3, 4, 7, 8, 9 can run in **parallel** after Stage 1 census lands (independent research forks). Stage 5 conditional on Stage 4. Stage 6 needs step-1 helper + Stage 2 lint. Stage 10 last.

---

## §4 Acceptance criteria (mega-umbrella done when)

- [ ] Stage 1 census doc is SSOT (every hook accounted for).
- [ ] Stage 2 verdict on twin-automation (ADOPT one fork with evidence).
- [ ] Stage 3: inject-project-digest + inject-output-language plugin twins shipped + tested.
- [ ] Stage 4 verdict on warn-subagent-report ZCode variant (with R1-R5 evidence).
- [ ] Stage 5 (if applicable): chosen ZCode variant built + tested.
- [ ] Stage 6: 9 twins migrated to `_zcode-emit` helper + integration tests green.
- [ ] Stage 7 verdict on SubagentStart coverage.
- [ ] Stage 8 survey doc with per-harness verdicts.
- [ ] Stage 9 verdict on multi-turn + anchor.
- [ ] Stage 10 doctrine doc consolidates all decisions.
- [ ] Recursive self-application green throughout (`make self-audit`).
- [ ] All §1.7 forward+backward checks present in each stage's PR.

---

## §5 ATTN escalation triggers

- **STOP + surface to operator** if any Stage 4 R1-R5 research question cannot be answered with available evidence (would require runtime access to ZCode internals we don't have).
- **STOP + surface** if a stage's verdict contradicts an upstream SSOT (e.g. tries to reintroduce Mechanism 2 after step-1 rejection).
- **STOP + surface** if the operator's "full parity" goal conflicts with an architectural invariant (e.g. asks for SubagentStop support when ZCode has no event for it — honest degradation is the only option).
- **STOP + surface** if a stage produces a verdict (ADOPT/BUILD/REJECT) without file:line evidence — recommendation-laziness-discipline violation.

---

## §6 Non-goals (explicit)

- **NOT** redefining project goal — README.md#why-this-exists stays authoritative.
- **NOT** building a generic AI-harness abstraction layer — this is per-hook parity work, not a framework redesign.
- **NOT** replacing CC as the primary harness — CC-first architecture is preserved; ZCode gets alternative paths.
- **NOT** claiming full agnosticism for Cursor/Codex/Aider until Stage 8 verdict is in.
- **NOT** auto-merging any stage with red CI or unverified claims.

---

## §7 Operator decisions needed before stage dispatch

For each stage that produces a verdict (2, 4, 7, 9), the operator (user) decides which fork to ADOPT. This is not autonomous — `reviewer-discipline §2` says strategic forks go to the operator.

Stage 3 (twin shipping), Stage 5 (conditional impl), Stage 6 (migration) are execution-build and can proceed autonomously once their prerequisites are met.

Stage 8 (Cursor/Codex survey) is research-only; its verdicts also go to operator.
