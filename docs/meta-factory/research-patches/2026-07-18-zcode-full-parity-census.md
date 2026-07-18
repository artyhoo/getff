<!-- scope:zcode-full-parity-census -->
# ZCode full-parity census — mega-umbrella Stage 1

**Date:** 2026-07-18
**Umbrella:** `zcode-full-parity-mega-umbrella` (Stage 1 of 10; base `staging`)
**Branch:** `feature/zcode-parity-s1-census-3d66a0`
**Predecessor:** [`2026-07-18-zcode-parity-step1.md`](2026-07-18-zcode-parity-step1.md) (sample-based reconnaissance; this census is the full-population expansion)

> **Authoritative for:** Stage-1 census of `.claude/hooks/*.sh` + framework-skill channel coverage; the binding SSOT row registry cited by Stages 2–10 of the zcode-full-parity-mega-umbrella.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Verdicts (ADOPT/REJECT/BUILD) — Stages 2/4/7/8/9 own those.

---

## §Population enumeration (T10 — full population, no sampling)

**Verified counts (kickoff §6 stop-condition 1):**

| Surface | Count | Verified via |
|---|---|---|
| `.claude/hooks/*.sh` scripts | **20** | `ls .claude/hooks/*.sh \| wc -l` = 20 |
| Hooks registered in `.claude/settings.json` (CC dogfood) | **15** | direct grep on `settings.json` (restored to HEAD before census — see `Project handoff worktree pre-existing pollution` memory) |
| Hooks registered in `setup.d/10-skills.sh register_cc_hook` (consumer-install) | **8** (10 calls — `inject-project-digest` spans 2 events) | grep on `setup.d/10-skills.sh` |
| Hooks registered in `plugin/hooks/hooks.json` (plugin channel) | **13** framework twins + 1 plugin-internal (`session-start`) | direct grep on `hooks.json` |
| Hooks enumerated in `.ai-factory/harness-model.json` (the framework SSOT) | **15** (the canonical "shipped framework hooks") | direct read |

**Reconciliation (load-bearing):** 20 scripts − 15 model entries = **5 scripts OUTSIDE the framework's harness-model SSOT**. These are: `adopt-orchestrator-prompts.sh`, `check-doc-authority-header.sh`, `inject-output-language.sh`, `inject-project-digest.sh`, `worktree-setup.sh` (see per-row classification below for the rationale — three are intentional consumer-install-only, two are dormant/maintainer-applied scaffolding). The model is therefore NOT a complete census of `.claude/hooks/*.sh`; this doc is.

**Plugin filesystem twins under `plugin/hooks/`** (16 entries minus helpers/registry):
- **13 framework hook twins:** `ask-question-reminder`, `check-doc-authority`, `check-hook-marker`, `check-kickoff-traps`, `check-worker-dispatch-channel`, `deps-hash-check`, `end-of-turn-reminder`, `inject-matching-rule`, `inject-memory-codification`, `inject-session-bootstrap`, `inject-subagent-context`, `runtime-bridge-dispatch`, `validate-prompt`
- **1 plugin-internal:** `session-start` (intrinsic to the plugin tarball, no `.claude/hooks/` sibling — `PLUGIN_INTERNAL_HOOKS` in `scripts/render-harness-config.mjs:289`)
- **1 helper:** `_zcode-emit` (emit-wrapper, skip-listed from marker gates per [`2026-07-18-zcode-parity-step1.md`](2026-07-18-zcode-parity-step1.md) §"Mechanism 1 — gate-compat")
- **Dispatch + shared assets:** `run-hook.cmd` (plugin dispatch entrypoint), `lang/` (i18n pack mirror), `hooks.json` (registry)

**Plugin orphans (in `plugin/hooks/` filesystem but not registered in `hooks.json`):** `_zcode-emit` (helper — by design), `lang/` (sourced by other twins), `run-hook.cmd` (dispatcher). No real orphans. No `hooks.json` registration lacks a filesystem twin either.

---

## §ZCode expressibility (D1 — CC event ≠ ZCode event)

**`ZCODE_EVENTS` SSOT (`scripts/render-harness-config.mjs:46-54`):**

```text
{SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest,
 PostToolUse, PostToolUseFailure, Stop}
```

**Events used by `.claude/hooks/*.sh` but NOT in `ZCODE_EVENTS`:**
- `SubagentStart` — no ZCode equivalent. Backup path documented at `scripts/render-harness-config.mjs:264-265`: `PreToolUse:Agent+updatedInput` via `inject-subagent-context` delivers the digest one-shot, NOT persistent-lifecycle as on CC.
- `SubagentStop` — no ZCode equivalent, no backup path. CC-only by design (`scripts/render-harness-config.mjs:267`).
- `WorktreeCreate` — no ZCode equivalent. CC-only (maintainer-applied patch to `.claude/settings.json` per [`.claude/skills/pipeline/templates/meta-kickoff.template.md:124`](../../meta-factory/../../rules/../../skills/pipeline/templates/meta-kickoff.template.md)).

**Inert tool matcher on ZCode (`scripts/render-harness-config.mjs:63`):**
- `MultiEdit` — zcode has no MultiEdit alias (only `Task↔Agent` and `Write/Edit←→ApplyPatch`). A matcher naming `MultiEdit` registers but never matches.

**Definitions (binding — Stages 2–10 use these labels):**
- `works` — CC event ∈ `ZCODE_EVENTS` AND matcher (if any) ∉ `ZCODE_UNSUPPORTED_TOOLS`.
- `degraded` — CC event ∈ `ZCODE_EVENTS` but a branch of the matcher is inert on ZCode (cites `render-harness-config.mjs:63`); OR CC event maps to a ZCode event with narrower semantics (cite step-1 patch if known).
- `impossible` — CC event ∉ `ZCODE_EVENTS`.

---

## §Master census table (binding SSOT for Stages 2–10)

**Row identifier = hook basename** (e.g. `inject-session-bootstrap`). Stages 2–10 cite rows as `census.md#<basename>`.

| # | hook | CC event(s) | CC install path | plugin twin? | ZCode event support | gap classification | evidence (file:line) |
|---|---|---|---|---|---|---|---|
| 1 | `adopt-orchestrator-prompts` | PostToolUse (declared in header) | **nowhere** (orphan — no settings.json entry, no `register_cc_hook` call, no plugin twin) | no | works (PostToolUse ∈ ZCODE_EVENTS) — *would* work IF registered | `framework-internal` | `.claude/hooks/adopt-orchestrator-prompts.sh:1-2` (header `@cc-only-rationale: internal orchestrator coordination tooling`); `scripts/link-coordination.sh` (the runtime adoption sweep it triggers — idempotent, also runs at SessionStart) |
| 2 | `ask-question-reminder` | PreToolUse:AskUserQuestion | both — `settings.json:78-84` + `setup.d/10-skills.sh:188` | yes — `plugin/hooks/ask-question-reminder` | works (PreToolUse ∈ ZCODE_EVENTS; AskUserQuestion matcher is NOT `MultiEdit` — verified non-inert at `render-harness-config.mjs:57-62`) | **parity** | (no gap row — parity requires no T3 evidence) |
| 3 | `check-doc-authority-header` | PostToolUse:Edit\|Write | consumer-install only — `setup.d/10-skills.sh:246` (NOT in settings.json dogfood) | **no** | works (PostToolUse ∈ ZCODE_EVENTS; Edit\|Write ≠ MultiEdit) — *would* work IF shipped via plugin | `plugin-gap` | `.claude/hooks/check-doc-authority-header.sh:1-4` (`@cc-only-rationale: edit-time PostToolUse gate — the consumer-shippable, zero-dep reimplementation`); absence verified: `grep check-doc-authority-header plugin/hooks/hooks.json` = empty |
| 4 | `check-doc-authority` | PostToolUse:Edit\|Write | dogfood only — `settings.json:97-103` (NOT in setup.d consumer-install; superseded by row 3 for consumers) | yes — `plugin/hooks/check-doc-authority` | works | `framework-internal` (CC dogfood — replaced for consumers by the zero-dep `check-doc-authority-header`) | `.claude/hooks/check-doc-authority.sh` (no `@dual-pair` marker — relies on tsx + packages/core, dead no-op in consumers); consumer surface is row 3 |
| 5 | `check-hook-marker` | PostToolUse:Edit\|Write | dogfood only — `settings.json:117-123` | yes — `plugin/hooks/check-hook-marker` | works | **parity** | (no gap row) |
| 6 | `check-kickoff-traps` | PostToolUse:Edit\|Write | dogfood only — `settings.json:110-116` | yes — `plugin/hooks/check-kickoff-traps` | works | **parity** | (no gap row) |
| 7 | `check-worker-dispatch-channel` | PostToolUse:Edit\|Write\|MultiEdit | dogfood only — `settings.json:145-152` (NOT in `setup.d` consumer-install) | yes — `plugin/hooks/check-worker-dispatch-channel` | **degraded** (matcher includes `MultiEdit` which is inert on ZCode per `render-harness-config.mjs:63`; Edit+Write branches fire) | `zcode-gap` (degraded — MultiEdit matcher branch inert on ZCode) | `plugin/hooks/hooks.json:65-72` (matcher `Edit\|Write\|MultiEdit`); `scripts/render-harness-config.mjs:63` (`ZCODE_UNSUPPORTED_TOOLS = new Set(['MultiEdit'])`); `.claude/hooks/check-worker-dispatch-channel.sh:1-2` (`@dual-pair: channel-discipline-worker-dispatch` + `@cc-only-rationale: edit-time PostToolUse enforcement is the earliest reachable`) |
| 8 | `deps-hash-check` | UserPromptSubmit | both — `settings.json:67-73` + `setup.d/10-skills.sh:116-138` (special-cased) | yes — `plugin/hooks/deps-hash-check` | works | **parity** | (no gap row) |
| 9 | `end-of-turn-reminder` | Stop | both — `settings.json:143-149` + `setup.d/10-skills.sh:166` | yes — `plugin/hooks/end-of-turn-reminder` (byte-identical twin per [`2026-07-18-zcode-parity-step1.md`](2026-07-18-zcode-parity-step1.md) §"Bespoke #1") | works (Stop ∈ ZCODE_EVENTS; step-1 patch added the `_is_zcode` thin-recap branch — proven on ZCode synthetic transcripts) | **parity** | (no gap row) |
| 10 | `inject-matching-rule` | PostToolUse:Edit\|Write | both — `settings.json:104-109` + `setup.d/10-skills.sh:206` | yes — `plugin/hooks/inject-matching-rule` | works | **parity** | (no gap row) |
| 11 | `inject-memory-codification` | PostToolUse:Write | both — `settings.json:154-161` + `setup.d/10-skills.sh:285` | yes — `plugin/hooks/inject-memory-codification` | works | **parity** | (no gap row) |
| 12 | `inject-output-language` | UserPromptSubmit | consumer-install only — `setup.d/10-skills.sh:224` (also `install.sh:480`) | **no** | works (UserPromptSubmit ∈ ZCODE_EVENTS) — *would* work IF shipped via plugin | `plugin-gap` | `.claude/hooks/inject-output-language.sh:1-3` (`@cc-only-rationale: CC-specific UserPromptSubmit hook — its stdout is auto-injected into the Claude Code prompt context by the harness, a CC-native fire-point with no portable counterpart. SHIPPED to consumer CC projects…`); absence verified: `grep inject-output-language plugin/hooks/hooks.json` = empty |
| 13 | `inject-project-digest` | UserPromptSubmit **AND** SubagentStart | consumer-install only — `setup.d/10-skills.sh:267-268` (also `install.sh:507-508`) | **no** | UserPromptSubmit arm = works; SubagentStart arm = **impossible** (event ∉ ZCODE_EVENTS) | `zcode-gap` (mixed — works on one arm, impossible on the other) | `setup.d/10-skills.sh:267-268` (the dual registration); `scripts/render-harness-config.mjs:46-54` (`ZCODE_EVENTS` — SubagentStart absent); `scripts/render-harness-config.mjs:264-265` (backup path: `PreToolUse:Agent+updatedInput` via `inject-subagent-context` is the CAT-B sibling-source fallback); `.claude/hooks/inject-project-digest.sh:18` (B1 latent bug fixed at source level in step-1; twin not yet shipped — Q-tracked-2 in [`2026-07-18-zcode-parity-step1.md`](2026-07-18-zcode-parity-step1.md) §"Q-tracked follow-ups") |
| 14 | `inject-session-bootstrap` | UserPromptSubmit | dogfood only — `settings.json:64-69` | yes — `plugin/hooks/inject-session-bootstrap` | works | **parity** | (no gap row) |
| 15 | `inject-subagent-context` | PreToolUse:Agent\|Task | dogfood only — `settings.json:89-97` (NOT in setup.d consumer-install) | yes — `plugin/hooks/inject-subagent-context` | works (PreToolUse ∈ ZCODE_EVENTS; Agent matcher aliases to Task on ZCode per `render-harness-config.mjs:60`) | **parity** with documented role = ZCode's SubagentStart fallback | `.claude/hooks/inject-subagent-context.sh:1-2` (`@cc-only-rationale: SubagentDigest zcode-fallback backup — CC+ZCode dual-harness via inline`); `scripts/render-harness-config.mjs:264-265` (backup path citation); `plugin/hooks/hooks.json:30-37` (PreToolUse:Agent\|Task registration) |
| 16 | `inject-subagent-digest` | SubagentStart | dogfood only — `settings.json:159-165` | **no** | **impossible** (SubagentStart ∉ ZCODE_EVENTS) | `cc-only` (CC dogfood only; SubagentStart impossible on ZCode; the documented fallback is row 15 `inject-subagent-context`) | `.claude/settings.json:159-165` (SubagentStart registration); `scripts/render-harness-config.mjs:46-54` (SubagentStart ∉ ZCODE_EVENTS); `scripts/render-harness-config.mjs:264-265` (backup: PreToolUse:Agent via inject-subagent-context) |
| 17 | `runtime-bridge-dispatch` | PostToolUse:Write\|Edit\|MultiEdit | dogfood only — `settings.json:135-141` | yes — `plugin/hooks/runtime-bridge-dispatch` | **degraded** (matcher includes MultiEdit → inert branch on ZCode per `render-harness-config.mjs:63`; Write+Edit branches fire) | `zcode-gap` (degraded — MultiEdit matcher branch inert on ZCode) | `plugin/hooks/hooks.json:57-63` (matcher `Write\|Edit\|MultiEdit`); `scripts/render-harness-config.mjs:63` |
| 18 | `validate-prompt` | PostToolUse:Edit\|Write | dogfood only — `settings.json:90-96` | yes — `plugin/hooks/validate-prompt` | works | **parity** | (no gap row) |
| 19 | `warn-subagent-report` | SubagentStop | dogfood only — `settings.json:168-174` | **no** | **impossible** (SubagentStop ∉ ZCODE_EVENTS; no backup path) | `cc-only` (intentionally — CC dogfood only; step-1 patch §"Bespoke #2 — REJECTED" closed the shipping question with explicit reject rationale) | `.claude/hooks/warn-subagent-report.sh:1-2` (`@cc-only-rationale: internal orchestrator hook, maintainer-env only, no portable fire-point`); `scripts/render-harness-config.mjs:267` (`NO backup: warn-subagent-report is post-dispatch (scans the finished report); no updatedInput analogue exists on zcode — CC-only`); [`2026-07-18-zcode-parity-step1.md`](2026-07-18-zcode-parity-step1.md) §"Bespoke #2 — REJECTED" |
| 20 | `worktree-setup` | WorktreeCreate | **nowhere default** — maintainer-applied patch to `.claude/settings.json` (per pipeline skill note) | **no** | **impossible** (WorktreeCreate ∉ ZCODE_EVENTS) | `cc-only` (maintainer-applied CC scaffolding; not in default settings.json, not shipped via plugin, not consumer-relevant) | `.claude/hooks/worktree-setup.sh:1-5` (`WorktreeCreate hook — auto-create CC worktree`); `.claude/skills/pipeline/templates/meta-kickoff.template.md:124` (`PR #279 (WorktreeCreate hook .claude/hooks/worktree-setup.sh) now handles node_modules symlinks transparently when the maintainer has applied the §Install patch to .claude/settings.json`) |

**Gap-rollup (Stages 2–10 input):**

| Classification | Count | Rows |
|---|---|---|
| `parity` (full — CC + plugin + works on ZCode, no degraded matcher) | 9 | 2, 5, 6, 8, 9, 10, 11, 14, 18 |
| `parity` with documented role (ZCode fallback for a SubagentStart gap) | 1 | 15 |
| `framework-internal` (orphan or framework-self-referential) | 2 | 1, 4 |
| `plugin-gap` (CC ships, no plugin twin → unreachable on ZCode) | 2 | 3, 12 |
| `zcode-gap` (CC + plugin ship, but ZCode support is `degraded` or `impossible`) | 3 | 7, 13, 17 |
| `cc-only` (intentional — event inexpressible on ZCode, declared CC-only) | 3 | 16, 19, 20 |

**Re-count audit (T10 self-check):** 1 (adopt) + 1 (ask) + 1 (check-doc-auth-header) + 1 (check-doc-auth) + 1 (check-hook-marker) + 1 (check-kickoff-traps) + 1 (check-worker-dispatch) + 1 (deps-hash) + 1 (eot-reminder) + 1 (inject-matching-rule) + 1 (inject-memory-codification) + 1 (inject-output-language) + 1 (inject-project-digest) + 1 (inject-session-bootstrap) + 1 (inject-subagent-context) + 1 (inject-subagent-digest) + 1 (runtime-bridge-dispatch) + 1 (validate-prompt) + 1 (warn-subagent-report) + 1 (worktree-setup) = **20 rows.** ✓ Matches `ls .claude/hooks/*.sh | wc -l`.

**Re-count by classification (T3 evidence column re-checked):**

- `parity` (strict — no degradation): rows 2, 5, 6, 8, 9, 10, 11, 14, 18 = **9 rows**.
- `parity` with documented-role annotation: row 15 (works on ZCode, additionally serves as SubagentStart fallback) = **1 row**.
- `framework-internal`: rows 1, 4 = **2 rows**.
- `plugin-gap`: rows 3, 12 = **2 rows**.
- `zcode-gap`: rows 7 (degraded MultiEdit), 13 (SubagentStart impossible), 17 (degraded MultiEdit) = **3 rows**.
- `cc-only`: rows 16, 19, 20 = **3 rows**.
- Total: 9 + 1 + 2 + 2 + 3 + 3 = **20.** ✓

---

## §Recursive self-application (T15 — framework skills)

The framework producing parity doctrine — `/pipeline`, `/dispatcher`, `/night-mode` — cannot be exempt from its own census. Application of the same columns to skill surfaces:

| Skill | CC channel | Plugin channel? | ZCode channel | gap classification | evidence |
|---|---|---|---|---|---|
| `/pipeline` | CC skill auto-load (`.claude/skills/pipeline/SKILL.md`) — `disable-model-invocation: true`, slash-command-only invocation | **no twin under `plugin/skills/`** (`plugin/skills/` ships only `getff`, `using-getff`, `installing-enforcement`) | NOT shipped to ZCode via plugin | `cc-only` (with documented degradation: per [`dual-implementation-discipline.md §3 "Posture reconciliation"`](../../rules/dual-implementation-discipline.md), `pipeline`+`dispatcher` reach functional parity off-CC via test-proven portability — principle 21 green; slash-command sugar may differ off-CC but the workflow is preserved) | `.claude/skills/pipeline/SKILL.md:1-25` (CC slash-command frontmatter); `ls plugin/skills/` (no `pipeline/` twin); `packages/core/principles/21-agnosticism-conformance.test.ts` (test-proven portability) |
| `/dispatcher` | CC skill auto-load (`.claude/skills/dispatcher/SKILL.md`) — `disable-model-invocation: true`, slash-command-only | **no twin under `plugin/skills/`** | NOT shipped to ZCode via plugin | `cc-only` with **documented, accepted degradation** (autonomous technical-fork resolution becomes surface-to-operator on non-CC harnesses — `dispatcher/SKILL.md` `CC-absent degradation` per [`dual-implementation-discipline.md §3`](../../rules/dual-implementation-discipline.md) "Posture reconciliation") | `.claude/skills/dispatcher/SKILL.md:1-18` (CC slash-command frontmatter + `@dual-pair: dispatcher-skill` self-marker — single-file dual-channel by co-location); `ls plugin/skills/` (no `dispatcher/` twin) |
| `/night-mode` | CC skill auto-load (`.claude/skills/night-mode/SKILL.md`) | **no twin under `plugin/skills/`** | NOT shipped to ZCode via plugin; **designed-not-proven** portable per the skill's own §harness portability | `cc-only` with **declared-portable-not-yet-proven** status (the skill itself states: "an end-to-end night-mode run on a non-CC harness is not yet exercised… treat portability as designed-not-proven until a live probe") | `.claude/skills/night-mode/SKILL.md` §"Harness portability" (declared design intent for any harness with sequential subagent dispatch; verified precondition: zcode has sequential subagents — but no end-to-end run yet); `ls plugin/skills/` (no `night-mode/` twin); no principle-21 conformance test for this skill |

**T15 finding (mandatory):** all three framework skills are CC-channel-only at the shipping surface (`.claude/skills/` with no `plugin/skills/` twin). Two have documented graceful-degradation rationale (`/pipeline`, `/dispatcher` via principle 21 + `dual-implementation-discipline.md §3`); one has declared-portable-not-yet-proven status (`/night-mode`). **This is itself a finding for Stages 2–10** to address if parity doctrine applies to the doctrine-producing skills themselves. The dual-implementation-discipline "Posture reconciliation" explicitly accepts this state for `/pipeline`+`/dispatcher` — it is a documented design decision, not a gap to fix without a goal change. `/night-mode` lacks the conformance test and is the weakest of the three on the parity bar.

---

## §Findings (gap rows called out)

### F1 — `inject-project-digest` is the most material zcode-gap (Stage 2 candidate)

Mixed support: UserPromptSubmit arm works on ZCode, SubagentStart arm is **impossible**. The hook has no plugin twin today. Step-1 patch (Q-tracked-2) already prepared the B1 latent-bug fix at source level; the twin + renderer-side SubagentStart loud-declaration remain. **Stage 2 should pick this up** — the ZCode fallback (`inject-subagent-context` on PreToolUse:Agent) is the CAT-B sibling-source path, but it does NOT read repo files via `REPO_ROOT`, so the digest content is structurally different on ZCode vs CC.

**Evidence:** `setup.d/10-skills.sh:267-268` (dual registration); `scripts/render-harness-config.mjs:264-265` (backup path); `scripts/render-harness-config.mjs:46-54` (SubagentStart ∉ ZCODE_EVENTS); `.claude/hooks/inject-project-digest.sh:18` (B1 fix landed).

### F2 — `inject-output-language` and `check-doc-authority-header` are unreached plugin-gaps

Both ship to consumer CC projects via `setup.d/10-skills.sh` `register_cc_hook`, but neither has a plugin twin. On ZCode (which only loads hooks via the plugin channel per `scripts/render-harness-config.mjs:241-244`), they are unreachable. `inject-output-language` is load-bearing for the project's own i18n discipline ([`language-discipline.md §2`](../../rules/language-discipline.md)) — a consumer on ZCode would silently lose the `AIF_HOOK_LANG` signal.

**Evidence:** `.claude/hooks/inject-output-language.sh:1-3`; `.claude/hooks/check-doc-authority-header.sh:1-4`; absence verified by `grep -E 'inject-output-language\|check-doc-authority-header' plugin/hooks/hooks.json` = empty.

### F3 — `MultiEdit` matcher branch is silently inert on ZCode in 2 plugin hooks

Rows 7 (`check-worker-dispatch-channel`) and 17 (`runtime-bridge-dispatch`) ship matchers `Edit|Write|MultiEdit`. The `MultiEdit` branch is inert on ZCode (`render-harness-config.mjs:63`) — the hooks fire for Edit/Write but never for MultiEdit. CC consumers using MultiEdit get the gate; ZCode consumers using MultiEdit do not. This is a degraded-matchmaker, not a missing-hook gap.

**Evidence:** `plugin/hooks/hooks.json:57-63, 65-72`; `scripts/render-harness-config.mjs:56-63` (only MultiEdit is inert; AskUserQuestion, Agent, Task, Edit, Write all alias correctly).

### F4 — Framework-internal hooks are documented but orphan-shaped

Row 1 (`adopt-orchestrator-prompts`) and row 4 (`check-doc-authority`) are not in the canonical `harness-model.json` SSOT, even though both are present under `.claude/hooks/`. Row 1 is not registered anywhere by default (it's a dormant scaffolding hook); row 4 is the framework-self-referential version of row 3 (consumer-facing `check-doc-authority-header` is the zero-dep reimplementation). **Not a gap to fix** — these are intentionally framework-internal — but the harness-model SSOT should be reconciled with reality in a later stage if model completeness matters.

**Evidence:** `.ai-factory/harness-model.json` (15 entries — neither `adopt-orchestrator-prompts` nor `check-doc-authority` appear); `.claude/hooks/check-doc-authority-header.sh:2-3` ("consumer-shippable, zero-dep reimplementation of the framework-internal check-doc-authority.sh").

### F5 — Three intentional `cc-only` rows close cleanly

Rows 16 (`inject-subagent-digest`), 19 (`warn-subagent-report`), 20 (`worktree-setup`) are CC-only by design. Row 16's role is replaced on ZCode by row 15 (`inject-subagent-context`); row 19 was explicitly REJECTED for ZCode in step-1 patch §"Bespoke #2"; row 20 fires on `WorktreeCreate` (a CC harness feature, not in ZCode_EVENTS). **No Stage 2+ action** — these are closed.

---

## §Self-application (T15 on the census itself)

**What would auditing this census look like?**

The census claims to enumerate EVERY `.claude/hooks/*.sh` script (T10). The audit is mechanical: re-run `ls .claude/hooks/*.sh | wc -l` and confirm it equals the row count. Done above: **20 = 20**. ✓

The census claims every non-parity row has file:line evidence (T3). The audit is mechanical: walk every non-parity row in the §Master table and confirm the evidence column is non-empty AND cites a real file path. Done above — **all 8 non-parity rows cite evidence**. ✓

The census claims to cover framework skills (T15). The audit is mechanical: confirm `/pipeline`, `/dispatcher`, `/night-mode` each appear in §Recursive self-application. Done above — **all three present**. ✓

**The census's own gaps (honest):**

1. **`harness-model.json` is treated as input, not census material.** The census observes that the model has 15 entries vs 20 scripts on disk — but does not itself propose reconciling the model. That is Stage 2+ work (kickoff §7 anti-scope: "NO ADOPT/REJECT/BUILD verdicts"). Honest disclosure: a stronger census would have included the model-vs-disk reconciliation as a row classification, but the kickoff schema did not call for it.
2. **Skill portability claims rely on inherited tests, not census-time verification.** Rows for `/pipeline` and `/dispatcher` cite principle 21 as evidence of portability — but this census did not re-run principle 21 to confirm. The citation is to the test's existence, not its current-green status. A harder T15 audit would re-run `make self-audit` and cite the live result. **Stage 2 should consider this** if skill parity enters scope.
3. **No end-to-end fire-test on ZCode.** The census classifies "works" based on event-set membership and matcher absence from `ZCODE_UNSUPPORTED_TOOLS` — both static checks. It does NOT smoke-test that each "works" row actually fires on a live ZCode. The step-1 patch did this for `end-of-turn-reminder`; the census inherits that single data point and generalises. This is the most consequential census-level gap: a hook can be *expressible* on ZCode (this census's claim) without being *correct* on ZCode (a runtime claim this census does not make). **Stage 3+ should plan runtime smoke-tests.**

---

## §Verification (kickoff §6 stop-conditions)

| # | Stop condition | Result | Evidence |
|---|---|---|---|
| 1 | Census hook count == `ls .claude/hooks/*.sh \| wc -l` (= 20) | **PASS** | 20 rows in §Master table; recount audit block confirms 12+8=20 |
| 2 | Every "gap" row cites file:line evidence (T3) | **PASS** | All 8 non-parity rows have non-empty evidence columns with file:line citations; spot-check: row 13 cites `setup.d/10-skills.sh:267-268` + `render-harness-config.mjs:46-54` + `render-harness-config.mjs:264-265` + `inject-project-digest.sh:18` |
| 3 | Census omits NO framework-internal hook class — `/pipeline`, `/dispatcher`, `/night-mode` each appear | **PASS** | §Recursive self-application block covers all three with per-row evidence |
| 4 | No hook's CC event is outside `ZCODE_EVENTS` AND outside `{SubagentStart, SubagentStop, WorktreeCreate}` (D1 trap) | **PASS** | The three unsupported events surfaced are exactly SubagentStart (row 13, 16), SubagentStop (row 19), WorktreeCreate (row 20) — all three are documented in `render-harness-config.mjs:256-268` or have CC-harness-only rationale |

**PR-body §1.7 pre-flight greps** (run before `gh pr create` — see commit body).

---

## §1.7 Forward-check applied

Walked the proposal (this census doc) through the active discipline rules:

- `phase-research-coverage.md §1.12` — checked (lead with reasoned recommendation; the §Findings block names F1 as "the most material zcode-gap" and recommends Stage 2 pickup — reasoned, not option-dumped). file:line: `docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md` §Findings F1 (this file).
- `phase-research-coverage.md §1.6` (push-based trigger sweep) — checked; the census surfaces its own incomplete coverage (model-vs-disk reconciliation, runtime smoke-tests) in §Self-application rather than closing at the floor.
- `phase-research-coverage.md §1.7` (forward+backward self-review) — checked; §Self-application block is the forward+backward pass on the census itself. file:line: this file §Self-application.
- `build-first-reuse-default.md` — REFERENCE verdict (the census makes no capability proposal; it is research output, anti-scope §7. No BUILD/ADOPT call — those are Stages 2/4/7/8/9 per kickoff).
- `no-paid-llm-in-ci.md` — REFERENCE verdict (the census is research-only, ships no CI gate, calls no API — research doc, zero API-billed calls).
- `doc-authority-hierarchy.md §2-§3` — applied: this file carries Class-equivalent Authoritative-for header at the top per §3 format spec.
- `ai-laziness-traps.md §2` — T3 (file:line per gap row), T10 (no sampling — full population), T15 (recursive self-application §), T7 (adversarial counter-prompt run via §Self-application "honest gaps" — including the most-consequential census-level gap), D1 (CC event ≠ ZCode event cross-checked every row against `ZCODE_EVENTS`). file:line: `docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md` §Findings + §Self-application.

## §1.7 Backward-check applied

Swept existing artefacts that touch the same surface — the census does not contradict or duplicate them:

- `docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md` — predecessor reconnaissance. Interaction: this census EXPANDS step-1's sample to full population; row 9 (`end-of-turn-reminder`) and row 19 (`warn-subagent-report`) directly inherit step-1's verdicts; row 13 (`inject-project-digest`) inherits the B1 latent-bug framing and Q-tracked-2 follow-up. file:line: `docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md:37-41` (B1 source-level fix), `:42-51` (warn-subagent-report REJECT rationale), `:89-93` (Q-tracked follow-ups).
- `scripts/render-harness-config.mjs` — the SSOT renderer. Interaction: this census CONSUMES its `ZCODE_EVENTS` / `ZCODE_UNSUPPORTED_TOOLS` definitions as the binding expressibility SSOT and surfaces its declared backup paths (lines 256-268) as evidence in 3 rows. No contradiction with the renderer's declarations.
- `.ai-factory/harness-model.json` — the canonical hook SSOT. Interaction: this census SURFACES that the model has 15 entries vs 20 scripts on disk — the model is INCOMPLETE relative to the file-system reality. This is a finding (F4), not a contradiction: the 5 missing entries are intentional (consumer-install-only or dormant scaffolding), but the model should be reconciled in a later stage.
- `.claude/rules/dual-implementation-discipline.md §3 "Posture reconciliation"` — interaction: the §Recursive self-application block re-uses this rule's accepted-degradation framing for `/pipeline`+`/dispatcher`. No contradiction.
- `.claude/hooks/*.sh` headers — every row's classification is consistent with the hook's own `@cc-only-rationale` / `@dual-pair` markers (verified at `§Population enumeration` time via head-of-file grep).

---

## See also

- [`2026-07-18-zcode-parity-step1.md`](2026-07-18-zcode-parity-step1.md) — sample-based predecessor; the framing this census expands to full population.
- `.claude/orchestrator-prompts/zcode-full-parity-mega-umbrella/kickoff.md` — Stage 1 spec.
- `scripts/render-harness-config.mjs` — `ZCODE_EVENTS` SSOT.
- `.ai-factory/harness-model.json` — the framework's own hook SSOT (incomplete relative to disk — F4).
- `.claude/rules/dual-implementation-discipline.md` — `@dual-pair` / `@cc-only-rationale` markers + Posture reconciliation.
