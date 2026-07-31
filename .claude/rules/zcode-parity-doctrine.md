---
paths:
  - .claude/hooks/**
  - scripts/render-harness-config.mjs
  - plugin/hooks/**
  - docs/meta-factory/zcode-parity-mega.decisions.md
  - docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md
  - docs/meta-factory/research-patches/2026-07-18-zcode-parity-s2-mech2-alt.md
  - docs/meta-factory/research-patches/2026-07-18-zcode-parity-s4-warn-subagent.md
  - docs/meta-factory/research-patches/2026-07-18-zcode-parity-s7-subagentstart.md
  - docs/meta-factory/research-patches/2026-07-18-zcode-parity-s8-harness-survey.md
  - docs/meta-factory/research-patches/2026-07-18-zcode-parity-s9-multiturn-anchor.md
---

# ZCode parity doctrine — discipline rule

> **Class:** A — companion principle test shipped at [packages/core/principles/09-doc-authority-hierarchy.test.ts](../../packages/core/principles/09-doc-authority-hierarchy.test.ts) (doctrine registered in `REQUIRED_HEADER_DOCS`; the doctrine itself is a SSOT pointer-aggregator, the enforcement lives in existing gates per §6).
> **Fires:** editing hook twins or the harness-config renderer; authoring zcode-parity decision docs (exact set: the rule's `paths:` frontmatter).
> **Authoritative for:** the canonical ZCode-parity SSOT — §2 per-hook census (binding, extends [census.md](../../docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md)), §3 per-stage decision rollup (binding, extends [decisions.md](../../docs/meta-factory/zcode-parity-mega.decisions.md)), §4 degradation rationale per CC-only hook, §5 agnosticism tier table.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Per-stage implementation detail — see merged stage PRs (Wave A: #1031/#1034/#1035/#1036/#1037/#1038/#1039/#1040; Wave B dispatch plan: [decisions.md §Wave B dispatch plan](../../docs/meta-factory/zcode-parity-mega.decisions.md)). Maintenance philosophy — see [dual-implementation-discipline.md](dual-implementation-discipline.md). Build-vs-reuse verdicts — see [build-first-reuse-default.md](build-first-reuse-default.md).

<!-- globs: .claude/hooks/**, scripts/render-harness-config.mjs, plugin/hooks/**, docs/meta-factory/zcode-parity-mega.decisions.md, docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md, docs/meta-factory/research-patches/2026-07-18-zcode-parity-s2-mech2-alt.md, docs/meta-factory/research-patches/2026-07-18-zcode-parity-s4-warn-subagent.md, docs/meta-factory/research-patches/2026-07-18-zcode-parity-s7-subagentstart.md, docs/meta-factory/research-patches/2026-07-18-zcode-parity-s8-harness-survey.md, docs/meta-factory/research-patches/2026-07-18-zcode-parity-s9-multiturn-anchor.md -->
<!-- inject: ZCode parity doctrine — full parity is the goal (CC-first + AI-agnostic by design). Before editing hooks or render-harness-config, check §2 census for whether the hook has ZCode parity / plugin twin / CC-only rationale, and §3 for whether a Wave B stage changes its classification. -->

## §1 Goal statement

The framework's goal is **full ZCode parity**: any hook, any skill, any consumer-facing artefact that ships on Claude Code ships equivalently on ZCode, with documented fallbacks or accepted-degradation rationale for any CC-native primitive ZCode cannot express. The framework is **AI-agnostic by design** — any harness with a CC-compatible hook system works; per-harness feature coverage varies.

Long-term: full AI agnosticism. Current pragmatic stance (per [Meta-fork C](../../docs/meta-factory/zcode-parity-mega.decisions.md) operator decision, 2026-07-18):

> «вообще мы должны быть ии агностиками - это цель к которой мы должны придти и к которой мы идем - просто многие фишки еще не реализованны - но цель пока что CC first + аналогичное для остальных(пусть слабее работает пофиг)»

CC-first today (full features) + analogous for others (ZCode today; Cursor/Codex/Windsurf on roadmap; Aider out-of-scope — no hook system). Even degraded support is acceptable; the doctrine is that no harness is rejected on the roadmap toward agnosticism.

## §2 Hook census table (binding SSOT)

**Row identifier = hook basename.** Full evidence per row lives in [census.md](../../docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md); this table is the compact form (evidence column dropped — cite `census.md#<basename>` for file:line detail).

`ZCODE_EVENTS` = `{SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Stop}` ([`scripts/render-harness-config.mjs:46-54`](../../scripts/render-harness-config.mjs)). `SubagentStart`, `SubagentStop`, `WorktreeCreate` are NOT expressible on ZCode.

| # | hook | CC event(s) | ZCode support | classification |
|---|---|---|---|---|
| 1 | `adopt-orchestrator-prompts` | PostToolUse | works (PostToolUse ∈ `ZCODE_EVENTS`); unregistered by default | `framework-internal` |
| 2 | `ask-question-reminder` | PreToolUse:AskUserQuestion | works | `parity` |
| 3 | `check-doc-authority-header` | PostToolUse:Edit\|Write | works; consumer-install only via `setup.d/10-skills.sh:246` — NO plugin twin shipped (verified live: `ls plugin/hooks/ \| grep -x check-doc-authority-header` → empty; row 4's `check-doc-authority` twin exists, NOT row 3's); not reachable on ZCode via plugin channel | `plugin-gap` |
| 4 | `check-doc-authority` | PostToolUse:Edit\|Write | works; CC-dogfood only (consumer surface is row 3) | `framework-internal` |
| 5 | `check-hook-marker` | PostToolUse:Edit\|Write | works | `parity` |
| 6 | `check-kickoff-traps` | PostToolUse:Edit\|Write | works | `parity` |
| 7 | `check-worker-dispatch-channel` | PostToolUse:Edit\|Write\|MultiEdit | degraded (`MultiEdit` matcher inert on ZCode; Edit+Write fire) | `zcode-gap` |
| 8 | `deps-hash-check` | UserPromptSubmit | works | `parity` |
| 9 | `end-of-turn-reminder` | Stop | works (step-1 added `_is_zcode` thin-recap branch; proven on ZCode synthetic transcripts) | `parity` |
| 10 | `inject-matching-rule` | PostToolUse:Edit\|Write | works | `parity` |
| 11 | `inject-memory-codification` | PostToolUse:Write | works | `parity` |
| 12 | `inject-output-language` | UserPromptSubmit | works; plugin twin shipped via Stage 6 (#1043) → reachable on ZCode via plugin channel | `parity` |
| 13 | `inject-project-digest` | UserPromptSubmit **AND** SubagentStart | mixed: UserPromptSubmit arm works; SubagentStart arm impossible (event ∉ `ZCODE_EVENTS`); fallback = row 15 | `zcode-gap` |
| 14 | `inject-session-bootstrap` | UserPromptSubmit | works | `parity` |
| 15 | `inject-subagent-context` | PreToolUse:Agent\|Task | works (Agent aliases to Task on ZCode); documented role = ZCode's SubagentStart fallback | `parity` (with role annotation) |
| 16 | `inject-subagent-digest` | SubagentStart | impossible (event ∉ `ZCODE_EVENTS`); role replaced on ZCode by row 15 | `cc-only` |
| 17 | `runtime-bridge-dispatch` | PostToolUse:Write\|Edit\|MultiEdit | degraded (`MultiEdit` matcher inert; Write+Edit fire) | `zcode-gap` |
| 18 | `validate-prompt` | PostToolUse:Edit\|Write | works | `parity` |
| 19 | `warn-subagent-report` | SubagentStop | works via 4D hybrid (#1046): PostToolUse:Agent real-time arm + Stop completeness arm deliver the report the SubagentStop event would have carried | `parity` (4D hybrid variant) |
| 20 | `worktree-setup` | WorktreeCreate | impossible (event ∉ `ZCODE_EVENTS`); CC harness feature, not in default settings | `cc-only` (maintainer-applied scaffolding) |

**Classification rollup:** `parity` (strict) = 11 rows (2, 5, 6, 8, 9, 10, 11, 12, 14, 18, 19); `parity` with role annotation = 1 (15); `framework-internal` = 2 (1, 4); `plugin-gap` = 1 (3); `zcode-gap` = 3 (7, 13, 17); `cc-only` = 2 (16, 20). Total = 20 = `ls .claude/hooks/*.sh \| wc -l` (census baseline at [census.md §Population enumeration](../../docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md)); Wave B (#1043/#1044/#1046/#1047) flipped rows 12/19 since census time (row 3 stays `plugin-gap` — Stage 6 shipped row 4's `check-doc-authority` twin, NOT row 3's `check-doc-authority-header`).

## §3 Per-stage decisions

All 5 strategic forks decided 2026-07-18 in [decisions.md §Wave A brainstorm resolutions](../../docs/meta-factory/zcode-parity-mega.decisions.md). **Status column reflects runtime reality** for all Wave B stages (5/6/7B/9C merged via #1043/#1044/#1046/#1047). The sole outstanding deferral is D3 — runtime loud-declaration sync in [`scripts/render-harness-config.mjs:256-268`](../../scripts/render-harness-config.mjs), still emitting `NO backup: warn-subagent-report … CC-only` despite Stage 5's merge; that sync is **deliberately parked** because the renderer edit has its own wording + snapshot consequences.

| Stage | Decision | Status | PR | Notes |
|---|---|---|---|---|
| Step-1 | emit-wrapper infra + end-of-turn-reminder B2-C + B1 latent fix | Implemented | #1031 | `plugin/hooks/_zcode-emit` helper + `_is_zcode` thin-recap branch |
| 1 | full-parity census (mega-umbrella Stage 1) | Implemented | #1034 | binding census SSOT, cited by §2 |
| 2 | mech-2 alt research — 4 forks analyzed | Implemented (research only) | #1035 | implementation rolled into Stage 6 |
| 3 | ship `inject-project-digest` + `inject-output-language` plugin twins | Implemented | #1036 | closes row 12 `plugin-gap` for `inject-output-language` |
| 4 | warn-subagent ZCode variant research (R1-R5) | Implemented (research only) | #1037 | parked for Wave B Stage 5 |
| 7 | SubagentStart coverage research (7A vs 7B) | Implemented (research only) | #1038 | parked for Wave B Stage 7B |
| 8 | Cursor/Codex/Aider/Windsurf agnosticism survey | Implemented (research only) | #1039 | F3-with-Cursor framing applied here in §5 |
| 9 | multi-turn + ai-anchor ZCode research | Implemented (research only) | #1040 | parked for Wave B Stage 9C |
| Wave B brainstorm | 5 fork resolutions for Wave B dispatch | Implemented (decisions doc) | #1042 | binding input for Wave B Stages 5/6/7B/9C |
| 2 / 6 | **2B-standardize** — single source template + generator + minimal marker | Implemented | #1043 | 85% of twins byte-identical after env-first `REPO_ROOT` standardization; generator ~20 LOC bash |
| 5 | **4D hybrid** — `warn-subagent-report` ZCode variant (PostToolUse:Agent real-time arm + Stop completeness arm) | Implemented | #1046 | closed row 19 `cc-only` (ZCode has 120KB payload vs CC 4KB — ZCode is better) |
| 7B | **extend `inject-subagent-context`** for full `SubagentStart` payload parity | Implemented | #1047 | closed row 13 SubagentStart gap (real parity, not minimal backup) |
| 9C | **synthetic-transcript anchor + rollout multi-turn guard** for `end-of-turn-reminder` ZCode arm | Implemented | #1044 | ZCode-only branch addition; CC arm unchanged |
| 10 | doctrine doc + README F3 framing (this artefact) | Implemented (this PR) | (this PR) | §5 agnosticism tier + §3 status column |

## §4 Per-degradation rationale

For each row classified `cc-only` in §2, the design intent and the closing-evidence status.

**Row 16 — `inject-subagent-digest` (SubagentStart):** CC dogfood-only; SubagentStart is inexpressible on ZCode (`ZCODE_EVENTS` excludes it). The role is replaced on ZCode by row 15 `inject-subagent-context` via the [`render-harness-config.mjs:264-265`](../../scripts/render-harness-config.mjs) backup path — `PreToolUse:Agent+updatedInput` delivers the digest one-shot as the subagent's first message, NOT persistent-lifecycle as on CC. **Stage 7B (#1047)** upgraded this fallback from minimal backup to full payload parity. **Status:** parity via `PreToolUse:Agent+updatedInput` full-payload delivery.

**Row 19 — `warn-subagent-report` (SubagentStop):** declared CC-only at step-1 patch §"Bespoke #2 — REJECTED" ([`2026-07-18-zcode-parity-step1.md`](../../docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md)). **Stage 5 (4D hybrid, #1046)** closed this: the Stop hook arm receives `transcript_path` (R3 verified) and reads the finished report via rollout scan; PostToolUse:Agent arm reads the 120KB payload directly (R4 verified — ZCode is *better* than CC's 4KB). **Status:** `parity via 4D hybrid (#1046)`. The runtime loud-declaration in [`scripts/render-harness-config.mjs:256-268`](../../scripts/render-harness-config.mjs) still reads `NO backup: warn-subagent-report … CC-only` and is **deliberately out of scope for this doc-sweep** — the renderer sync is owned by a follow-up that updates both the renderer text and its snapshots in lockstep.

**Row 20 — `worktree-setup` (WorktreeCreate):** maintainer-applied CC scaffolding, not in default `.claude/settings.json`, not shipped via plugin, not consumer-relevant. `WorktreeCreate` is a CC harness feature not in `ZCODE_EVENTS` by design. **Status:** closed — accepted-degradation, no Wave B action.

**Row 13 — `inject-project-digest` SubagentStart arm (mixed):** UserPromptSubmit arm works on ZCode (row 13 §2 classification `zcode-gap`); SubagentStart arm is impossible and falls back to row 15. **Stage 7B (#1047)** upgraded the fallback to full parity (closes the gap).

**Rows 7, 17 — `MultiEdit` matcher inert branch:** `MultiEdit` is the only ZCode-inert tool matcher ([`render-harness-config.mjs:63`](../../scripts/render-harness-config.mjs)); Edit/Write/Task/Agent/AskUserQuestion all alias correctly. The MultiEdit branch is silently inert — Edit/Write branches fire. **Status:** degraded, documented; not in Wave B scope (acceptable degradation per Meta-fork C: «пусть слабее работает пофиг»).

**Row 12 — `inject-output-language` (`plugin-gap` closed):** CC ships via `setup.d/10-skills.sh` `register_cc_hook`; ZCode reaches hooks ONLY via the plugin channel ([`render-harness-config.mjs:241-244`](../../scripts/render-harness-config.mjs)). **Stage 6 (#1043)** shipped the plugin twin — verified live: `ls plugin/hooks/inject-output-language` returns the file. Row 12 is load-bearing for [language-discipline.md §2](language-discipline.md). Classification is now `parity` (§2 census).

**Row 3 — `check-doc-authority-header` (`plugin-gap` STAYS):** Stage 6 shipped row 4's twin (`plugin/hooks/check-doc-authority`), NOT row 3's `check-doc-authority-header` — verified live: `ls plugin/hooks/ \| grep -x check-doc-authority-header` → empty. The hook script exists at `.claude/hooks/check-doc-authority-header.sh` (consumer-shippable zero-dep reimplementation, per `@cc-only-rationale` marker) but is reachable on consumers ONLY via `setup.d/10-skills.sh:246`, not via the ZCode plugin channel. **Status:** `plugin-gap` retained — a Stage 6 follow-up would ship the missing twin to close it; out of scope for this doc-sweep.

## §5 Agnosticism tier table

Per [Meta-fork C](../../docs/meta-factory/zcode-parity-mega.decisions.md) + [Fork 5 F3-with-Cursor](../../docs/meta-factory/zcode-parity-mega.decisions.md) verdicts. NO harness is rejected on the roadmap toward agnosticism (Meta-fork C binding interpretation #3).

| Tier | Harness | Coverage | Evidence |
|---|---|---|---|
| **Supported today** | Claude Code | Primary dogfood harness; deepest coverage (all 20 hooks; principle tests + 4-layer enforcement) | [README.md#why-this-exists](../../README.md); §2 census |
| **Supported today** | ZCode | Full parity via plugin channel + `_zcode-emit` helper; 16 framework hook twins shipped (re-counted live: `ls plugin/hooks/ \| grep -vE '^_zcode-emit|^hooks.json|^lang|^run-hook.cmd|^session-start' \| wc -l` → 16, post-Stage 6). Two rows remain `cc-only` (16, 20); the three CC-only *events* (`SubagentStart`/`SubagentStop`/`WorktreeCreate`) are still inexpressible on ZCode, but SubagentStop now has a parity variant via row 19's 4D hybrid (Stage 5, #1046) — accepted-degradation rationale for rows 16/20 per §4 | §2 census; [`scripts/render-harness-config.mjs:46-54`](../../scripts/render-harness-config.mjs); step-1 patch #1031 |
| **Supported today** | Cursor | High CC-overlap (native `SubagentStart`/`Stop`, lifecycle hooks, 4 rule-activation types). Listed based on docs-verification in [S8 agnosticism survey](../../docs/meta-factory/research-patches/2026-07-18-zcode-parity-s8-harness-survey.md); **live end-to-end testing is a follow-up** (verified STALE-absent at origin/staging `fab189d09e`: `ls packages/core/principles/*cursor* packages/core/hooks/*cursor* 2>/dev/null` → exit 2; `git show origin/staging:docs/meta-factory/research-patches/2026-07-18-zcode-parity-s8-harness-survey.md \| grep -ciE "runtime.test|live.fired|live.end.to.end.test"` → 0 — survey carries docs-verification only, no live-runtime evidence) | #1039 |
| **Roadmap (FEASIBLE-WITH-WORK)** | Codex CLI | Lifecycle hooks present; per-tool matcher adapter needed | #1039 |
| **Roadmap (FEASIBLE-WITH-WORK)** | Windsurf | Cascade Hooks present; taxonomy adapter needed | #1039 |
| **Out-of-scope** | Aider | No hook system (upstream issues `aider#2045`, `aider#2557` open) | #1039 |

The Cursor caveat (docs-verified, not live-tested) is the load-bearing honest disclosure. The doctrine does NOT claim runtime-verified Cursor support — only that the CC overlap makes it structurally supported.

## §6 Cross-references

- **Decisions SSOT:** [`docs/meta-factory/zcode-parity-mega.decisions.md`](../../docs/meta-factory/zcode-parity-mega.decisions.md) — all 5 strategic forks resolved 2026-07-18.
- **Census SSOT:** [`docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md`](../../docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md) — full 20-row evidence per hook, binding on §2.
- **Step-1 patch:** [`docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md`](../../docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md) — emit-wrapper infra, B1 latent fix, Bespoke #2 REJECT.
- **Wave A research patches:** [`s2-mech2-alt`](../../docs/meta-factory/research-patches/2026-07-18-zcode-parity-s2-mech2-alt.md), [`s4-warn-subagent`](../../docs/meta-factory/research-patches/2026-07-18-zcode-parity-s4-warn-subagent.md), [`s7-subagentstart`](../../docs/meta-factory/research-patches/2026-07-18-zcode-parity-s7-subagentstart.md), [`s8-harness-survey`](../../docs/meta-factory/research-patches/2026-07-18-zcode-parity-s8-harness-survey.md), [`s9-multiturn-anchor`](../../docs/meta-factory/research-patches/2026-07-18-zcode-parity-s9-multiturn-anchor.md).
- **Renderer SSOT:** [`scripts/render-harness-config.mjs`](../../scripts/render-harness-config.mjs) — `ZCODE_EVENTS` (lines 46-54), `ZCODE_UNSUPPORTED_TOOLS` (line 63), backup-path loud-declarations (lines 256-268).
- **Plan §0 (split rationale):** the S10 plan lived at a gitignored local path (`.ai-factory/plans/zcode-parity-s10-doctrine-doc.md`, never tracked — dangling as a link since S10 merged); its §0 rationale — defer the D3 runtime loud-declaration sync to the Wave B implementation PR — is restated in §3's header note above (D3 is the sole outstanding deferral, deliberately parked).

## §7 §1.7 self-reflexive note

**Forward-check (this doctrine complies with active disciplines):**

- [`no-paid-llm-in-ci.md`](no-paid-llm-in-ci.md): doctrine is markdown; no CI gate, no API calls. ✓
- [`doc-authority-hierarchy.md`](doc-authority-hierarchy.md) §3: carries Class + Authoritative-for header; registered in `REQUIRED_HEADER_DOCS` via principle 09 (this PR). ✓
- [`build-first-reuse-default.md`](build-first-reuse-default.md): REFERENCE verdict — no new capability proposed. The doctrine aggregates existing decisions + census into a SSOT pointer-doc; no BUILD/ADOPT call. ✓
- [`dual-implementation-discipline.md`](dual-implementation-discipline.md): no new dual-channel artefact shipped — the doctrine describes existing dual-channel state and cites `@dual-pair` / `@cc-only-rationale` markers already on the hooks. ✓
- [`phase-research-coverage.md §1.7`](phase-research-coverage.md): this §7 IS the forward+backward self-check. ✓
- [`phase-research-coverage.md §1.11`](phase-research-coverage.md): Wave B merge status re-verified at this sweep's authoring time via `git log origin/staging --oneline | grep -iE "zcode"` — Wave B Stages 5/6/7B/9C (#1043/#1044/#1046/#1047) ARE merged; the §0 split-decision's premise («not merged → defer D3») is itself now stale at the premise level and is corrected inline above (§3 header note + §4 Row 19). ✓
- [`recommendation-laziness-discipline.md §3`](recommendation-laziness-discipline.md): split-decision (defer D3) is a clear-on-merits call (avoid doc-lies), surfaced in the plan + this doctrine's §3 status column. ✓
- [`ai-laziness-traps.md §2`](ai-laziness-traps.md): T3 (every census row cites census.md anchor — evidence column drops but the binding SSOT is the cited census); T15 (this §7 is self-application; §2 census table is the framework's own parity discipline applied to itself); T7 (didn't pattern-match on kickoff's "all upstream merged" claim — verified against `git log`). ✓

**Backward-check (sweep of existing zcode-parity artefacts — no contradiction):**

- [`docs/meta-factory/zcode-parity-mega.decisions.md`](../../docs/meta-factory/zcode-parity-mega.decisions.md): superseded by nothing; §3 cites it as source. ✓
- [`docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md`](../../docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md): superseded by nothing; §2 cites it as binding census SSOT. ✓
- [`scripts/render-harness-config.mjs`](../../scripts/render-harness-config.mjs): §4 + §6 cite its `ZCODE_EVENTS` SSOT (lines 46-54), `ZCODE_UNSUPPORTED_TOOLS` (line 63), backup-path loud-declarations (lines 256-268). Deliverable D3 (loud-declaration sync) deferred per plan §0 — runtime reality unchanged in this PR. ✓
- [`README.md`](../../README.md): new `## Compatibility` section (this PR) points back to this doctrine; no contradiction with existing install/stack sections. ✓
- [`dual-implementation-discipline.md §3 "Posture reconciliation"`](dual-implementation-discipline.md): §5 agnosticism tier table is consistent with the accepted-degradation framing. ✓
- [`.claude/rules/00-rule-index.md`](00-rule-index.md): regenerated (this PR); doctrine appears as a new row. ✓

**Self-application (T15):** the framework producing a parity doctrine must apply the doctrine to itself. §2 census table includes the framework's own `/pipeline` / `/dispatcher` / `/night-mode` skills (per [census.md §Recursive self-application](../../docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md)): all three are CC-channel-only at the shipping surface with documented graceful-degradation rationale (`/pipeline`+`/dispatcher` via principle 21; `/night-mode` declared-portable-not-yet-proven). The doctrine is honest about the weakest link (`/night-mode` lacks the conformance test).
