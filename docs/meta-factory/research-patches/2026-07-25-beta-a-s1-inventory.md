<!-- scope:beta-delivery-ux -->
# beta-delivery-ux S1 (A1) — per-profile payload inventory

> **Authoritative for:** the per-profile payload inventory that ships under
> `--profile core|env|factory` (binding input to `setup.d/10-skills.sh` profile-driven dispatch
> + `INSTALL-FOR-AI.md` profile section). The inventory IS the deliverable's spine — every
> install decision routes through it.
> **NOT authoritative for:** project goal — see
> [README.md#why-this-exists](../../../README.md#why-this-exists). Design SSOT — see
> [`docs/superpowers/specs/2026-07-23-beta-program-design.md` §4 A1](../../superpowers/specs/2026-07-23-beta-program-design.md).
> Stage contract — see `.ai-factory/plans/feature-beta-delivery-ux-f67932.md` (Handoff plan).

**Date:** 2026-07-25 · **Branch:** `feature/beta-delivery-ux-f67932` · **Stage:** beta-delivery-ux S1 (A1)

## §1 Population enumeration (T10 — input to the inventory)

The inventory is built against this enumerated population, not from artefacts the stage happened
to open. Re-derived from `origin/staging` at execution entry; verify with the §6 commands.

### §1.1 Skills shipped today (from `skills/` + `.claude/skills/` via `setup.d/10-skills.sh`)

| Skill | Source path | Today's gate |
|---|---|---|
| `getff` | `skills/getff/` | unconditional |
| `tool-bootstrapping` | `skills/tool-bootstrapping/` | unconditional |
| `template-audit` | `.claude/skills/template-audit/` | CORE (F7) |
| `ai-doc` | `.claude/skills/ai-doc/` | CORE (F7) |
| `rule-research` | `.claude/skills/rule-research/` | CORE (F7) |
| `rule-tests` | `.claude/skills/rule-tests/` | CORE (F7) |
| `pipeline` | `.claude/skills/pipeline/` | AIF SUITE (`--with-aif-suite`) |
| `dispatcher` | `.claude/skills/dispatcher/` | AIF SUITE |
| `aif-doctor` | `.claude/skills/aif-doctor/` | AIF SUITE |
| `harvest` | `.claude/skills/harvest/` | AIF SUITE |
| `night-mode` | `.claude/skills/night-mode/` | AIF SUITE |
| `story` | `.claude/skills/story/` | AIF SUITE |
| ~~`self-reflection`~~ | `.claude/skills/self-reflection/` | **NOT shipped** (repo-internal §1.7) |
| `/arch` | `.claude/skills/arch/` | **NOT shipped today** → S5 wires env+ |
| `claude-glm-executor-handoff` | `.claude/skills/claude-glm-executor-handoff/` | **NOT shipped today** → S5 wires factory |

### §1.2 Hooks shipped today (from `setup.d/10-skills.sh` §1b-§1i)

| Hook | Event | Today's gate | Channel |
|---|---|---|---|
| `deps-hash-check` | UserPromptSubmit | unconditional (§1b) | settings.json |
| `end-of-turn-reminder` (+lang pack) | Stop | unconditional (§1c) | settings.json |
| `ask-question-reminder` | PreToolUse:AskUserQuestion | unconditional (§1d) | settings.json |
| `inject-matching-rule` | PostToolUse:Edit\|Write\|MultiEdit | unconditional (§1e) | settings.json |
| `inject-output-language` | UserPromptSubmit | unconditional (§1f) | settings.json |
| `check-doc-authority-header` | PostToolUse:Edit\|Write\|MultiEdit | unconditional (§1g) | settings.json |
| `inject-project-digest` (+template) | UserPromptSubmit + SubagentStart | unconditional (§1h) | settings.json |
| `inject-memory-codification` | PostToolUse:Write | unconditional (§1i) | settings.json |

### §1.3 Hooks NOT shipped today (framework-internal; consumers do not receive)

`adopt-orchestrator-prompts`, `check-doc-authority` (delegates to tsx + packages/core — dead in
consumer), `check-hook-marker`, `check-kickoff-traps`, `check-worker-dispatch-channel`,
`inject-session-bootstrap` (framework goal-digest), `inject-subagent-context`,
`inject-subagent-digest`, `runtime-bridge-dispatch`, `validate-prompt`, `warn-subagent-report`,
`worktree-setup`. Per spec §4 A1: re-triage the contour-guard subset (`check-kickoff-traps`,
`check-doc-authority`, `check-worker-dispatch-channel`) at env/factory depth — see §2.2.

### §1.4 Templates shipped today (always — all profiles inherit)

- `packages/core/templates/shared/` — `.lintstagedrc.json`, `.nvmrc`, `.prettierignore`,
  `AGENTS.md.template`, `ARCHITECTURE.ts-server.md`, `CLAUDE.md.template`,
  `DESCRIPTION.template.md`, `hooks-package.json`, `husky-pre-commit.sh`, `husky-pre-push.sh`,
  `integration-rules.md`, `tsconfig.json`, `skill-context/{aif-orchestrator-discipline,
  aif-review,aif-rules-check}/SKILL.md`.
- Stack-specific: `packages/core/templates/{cargo,python,react-next,react-spa,react-native,
  ts-server}/...`.

### §1.5 `.husky/` gate chain (from `setup.d/50-hooks.sh`)

`pre-commit` + `pre-push` + `core.hooksPath` activation. Unconditional today.

### §1.6 Companions in `setup.d/companions.manifest` (5 rows)

| Name | kind | Today's posture |
|---|---|---|
| `superpowers` | cc-plugin | detect + interactive consent |
| `runtime-bridge` | external-service | bridge guided-detect — aif-handoff runtime |
| `deepwiki` | mcp | detect + interactive consent |
| `ast-grep-cli` | cli | detect + interactive consent |
| `ast-grep` | cc-plugin | detect + interactive consent |

### §1.7 Plugin twins (`plugin/hooks/`, for ZCode parity — Commit C surface)

`ask-question-reminder`, `check-doc-authority`, `check-hook-marker`, `check-kickoff-traps`,
`check-worker-dispatch-channel`, `deps-hash-check`, `end-of-turn-reminder`,
`inject-matching-rule`, `inject-memory-codification`, `inject-output-language`,
`inject-project-digest`, `inject-session-bootstrap`, `inject-subagent-context`,
`runtime-bridge-dispatch`, `validate-prompt`, `warn-subagent-report-zcode` + `lang/` pack +
`hooks.json` registry + `_zcode-emit` helper. **No plugin twin today for**
`check-doc-authority-header` (zcode-parity-doctrine §2 row 3, `plugin-gap`).

### §1.8 Vendored runtime-bridge subset (S5 A7 — factory-only install surface)

Added by stage [`feature/beta-delivery-ux-eac3a0`](../../../setup.d/55-runtime-bridge-vendor.sh)
per spec [`2026-07-23-beta-program-design.md` §4 A7](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
(lines 285-289). Install surface: `setup.d/55-runtime-bridge-vendor.sh` (sourced between
`50-hooks` and `60-ci`). Source-of-truth for the vendor COPY:
[`packages/runtime-bridge/vendor/`](../../../packages/runtime-bridge/vendor/) — 13 transitively-
closed `.ts` files (dispatch CLI closure) + `hooks/runtime-bridge-dispatch.sh` (PostToolUse
dispatch hook, byte-identical to `.claude/hooks/runtime-bridge-dispatch.sh`) + `README.md` +
minimal `package.json` (peer-dep on `tsx`, no version pin per
[companion-install-principle.md §1](../../companion-install-principle.md)).

**Profile gate:** `factory` OR legacy `WITH_AIF_SUITE` only. `env` / `core` profiles skip the
layer (early `return 0` — verified by dry-run + real-install in
[commit 2551ce154 / 176767216](https://github.com/artyhoo/getff/commit/2551ce154)). The vendor
COPY is **not** an npm dependency (spec A7 binds COPY; npm packaging of the bridge stays
deferred to U9 post-announce).

**Consumer landing paths** (under `PROFILE=factory`):

| Consumer path | Source |
|---|---|
| `.claude/vendor/runtime-bridge/` (13 `.ts` + `README.md` + `package.json`) | `packages/runtime-bridge/vendor/` (rm -rf + cp -r — idempotent wipe-and-recopy) |
| `.claude/hooks/runtime-bridge-dispatch.sh` (PostToolUse dispatch hook) | `packages/runtime-bridge/vendor/hooks/runtime-bridge-dispatch.sh` (via `copy_safe` — idempotent with the runtime `setup-runtime-bridge.sh` flow, byte-identical source) |

**Install-time vs runtime split (load-bearing):** layer 55 is **install-time file-copy only**;
it does NOT register the PostToolUse hook in `.claude/settings.json` (that is a runtime
decision the consumer makes when they bring up aif-handoff — without the settings.json
registration the hook is a no-op even if the file is present). The interactive
runtime setup (env-var probe, settings.json registration) is owned by
[`packages/runtime-bridge/scripts/setup-runtime-bridge.sh`](../../../packages/runtime-bridge/scripts/setup-runtime-bridge.sh),
which is framework-only (the consumer does NOT receive `packages/`); the consumer follows the
`README.md` pointer instead. See the layer 55 header comment for the full coordination note.

**Smoke-enabling stub (NOT a park resolution):** the vendored `idempotency.ts:32` reads
`RUNTIME_BRIDGE_DEDUP_PATH` from env (per-project dedup-log path — spec A7), falling back to
`join(tmpdir(), 'runtime-bridge-dedup.jsonl')`. `ManualBackend.ts` retains its hardcoded `/tmp`
paths as an honest-gap (in-scope of parked fork P3 — manual-fallback path resolution; see
[`beta-delivery-ux.md` §3.1 P3](../../beta-delivery-ux.md)).

**Parked forks (recorded in the stage plan, not resolved here):** P1 import-coupling,
P2 path-resolution mechanism, P3 dedup-log path mechanism, P4 update mechanism,
P5 vendor subset boundary (resolved at dispatch.ts transitive-closure time — 13 files; see
[`vendor/README.md`](../../../packages/runtime-bridge/vendor/README.md) transitive closure
table). Spec A7 falsifier (U9): if first foreign tester blocked by vendoring → raise bridge
packaging priority.

---

## §2 Per-profile payload inventory (the deliverable's spine)

**Profile semantics (spec §4 A1, binding):**
- **`core`** — default; today's default + full killer payload. No AIF operator suite.
- **`env`** — `core` + `/arch` wiring + tier-home doc + pipeline presets + status +
  night-mode/SDD placeholders. **No aif runtime.**
- **`factory`** — `env` + dispatcher/harvest/aif-doctor (today's `--with-aif-suite` payload) +
  runtime-bridge wiring + GLM one-button placeholder.

**Stage boundary (operator-confirmed — implement, do not re-litigate):** S1 ships the profile
machinery and the placeholder rows for env/factory-only items; S2/S3/S4/S5 own the live content
that the placeholders route to. A row marked `placeholder (S5)` in the inventory ships a commented
or `is_layer_ready`-gated stub in `setup.d/10-skills.sh`, NOT the live artefact.

### §2.1 Skills inventory

| Skill | core | env | factory | Rationale |
|---|:---:|:---:|:---:|---|
| `getff` | ✓ | ✓ | ✓ | Universal entry point (consumer-facing). |
| `tool-bootstrapping` | ✓ | ✓ | ✓ | Stack-aware tool/MCP recommendations (consumer-facing). |
| `template-audit` | ✓ | ✓ | ✓ | Local advisory audit of shipped templates (consumer-facing). |
| `ai-doc` | ✓ | ✓ | ✓ | AI-doc authoring standard (consumer-facing; reuse for own AI docs). |
| `rule-research` | ✓ | ✓ | ✓ | Bootstrap rules from live docs (consumer-facing). |
| `rule-tests` | ✓ | ✓ | ✓ | Write/repair firing test material (consumer-facing). |
| `/arch` | — | placeholder (S5 wires) | placeholder (S5 wires) | Multi-model contour captain; **content is S5's scope** — S1 ships the row only. |
| `claude-glm-executor-handoff` | — | — | placeholder (S5 wires) | GLM→executor dispatch protocol; **content is S5's scope** — S1 ships the row only. |
| `pipeline` | — | — | ✓ | Planner — requires aif-handoff runtime (factory depth). |
| `dispatcher` | — | — | ✓ | Pipeline's execution companion — requires aif-handoff runtime. |
| `aif-doctor` | — | — | ✓ | Diagnoses aif-handoff runtime (only meaningful where it runs). |
| `harvest` | — | — | ✓ | Egress finished aif-agent branch to PR (only meaningful with runtime). |
| `night-mode` | — | — | ✓ | Overnight-autonomous orchestration (executor + dual-reviewer + advisor). |
| `story` | — | — | ✓ | Plain-language by-act recap. Same gate as suite siblings per F7. |
| `pipeline status` (A5) | — | placeholder (S2 wires) | placeholder (S2 wires) | Status one-command — **S2's scope**. |
| `night-mode/SDD` (A4) | — | placeholder (S2 wires) | placeholder (S2 wires) | Pipeline launch presets — **S2's scope**. |

**Today's `--with-aif-suite` mapping (kickoff §4 item 3 — back-compat):** the six AIF SUITE
skills (`pipeline`, `dispatcher`, `aif-doctor`, `harvest`, `night-mode`, `story`) ship when
`PROFILE=factory` OR `WITH_AIF_SUITE` is set. `--with-aif-suite` is preserved as a back-compat
alias that forces `PROFILE=factory`. `--all` continues to mean `--full + --with-aif-suite` and
additionally sets `PROFILE=factory`.

### §2.2 Hooks inventory — re-triage of today's dogfood-vs-consumer split

Per spec §4 A1 (operator correction 2026-07-23): at env/factory depth the consumer authors their
OWN kickoffs and AI docs, so contour-guard hooks become consumer-relevant *shields* there. T18
applies — preserve the residue via the upstream-native mechanism (profile-gated install), never
just delete the unconditional shipment.

**Hooks shipped today (universally — all three profiles inherit):**

| Hook | core | env | factory | Rationale |
|---|:---:|:---:|:---:|---|
| `deps-hash-check` | ✓ | ✓ | ✓ | Universal convenience — staleness alert (§1b). |
| `end-of-turn-reminder` (+lang) | ✓ | ✓ | ✓ | Universal convenience — Stop recap (§1c). |
| `ask-question-reminder` | ✓ | ✓ | ✓ | Universal convenience — fork challenge (§1d). |
| `inject-matching-rule` | ✓ | ✓ | ✓ | Universal convenience — rule injection on scoped edit (§1e). |
| `inject-output-language` | ✓ | ✓ | ✓ | Universal convenience — language pin (§1f). |
| `inject-project-digest` (+tmpl) | ✓ | ✓ | ✓ | Universal convenience — project anchor digest (§1h). |
| `inject-memory-codification` | ✓ | ✓ | ✓ | Universal convenience — memory-write nudge (§1i). |

**Hooks RE-TRIAGED — contour-guard set, gate changes by profile:**

| Hook | core | env | factory | Rationale (per spec §4 A1) |
|---|:---:|:---:|:---:|---|
| `check-doc-authority-header` | ✓ | ✓ | ✓ | **STAYS universal.** It is the consumer-side zero-dep bash REIMPLEMENTATION of the framework's check-doc-authority — already shipped unconditionally today (§1g) because consumers author `.claude/rules/*.md` and `.claude/skills/*/SKILL.md` at every depth. Removing it from `core` would be a T18 residue violation (lose a shield between profiles). The `core` consumer is authoring AI docs/skills the moment they add a rule. |

**Hooks NOT shipped today — framework-internal, parked or out-of-scope for S1:**

| Hook | profile verdict | Rationale |
|---|---|---|
| `check-doc-authority` (delegates to tsx + packages/core) | NOT shipped (any profile) | Dead in consumer — already today's posture. The §1g `check-doc-authority-header` reimplements its consumer-slice in zero-dep bash. |
| `check-kickoff-traps` | PARK (genuine fork per kickoff §7) | Consumer-relevant at env/factory depth (they author kickoffs there), but **porting it requires shipping `.claude/orchestrator-prompts/` infrastructure** that the consumer does not have at S1 install time. Porting is a fork on the install-surface boundary → PARK as DECISION-NEEDED for the maintainer: either (a) ship a consumer-scoped variant of the contour guard, or (b) defer to a S2/S3 stage that ships the orchestrator-prompts convention to consumers. **S1 does NOT silently drop, NOR silently port.** |
| `check-worker-dispatch-channel` | NOT shipped at `core`/`env`; factory ships via runtime-bridge vendor (S5) | Only meaningful where the dispatcher ships. `factory` profile will wire it when runtime-bridge lands (S5). S1 ships no row. |
| `check-hook-marker`, `validate-prompt`, `warn-subagent-report` | NOT shipped (any profile) | Framework-authoring discipline (`.claude/hooks/` registration invariants); not consumer-facing. |
| `runtime-bridge-dispatch` | factory only — wired by S4/S5 | Tied to runtime-bridge presence. S1 declares the profile gate; S4/S5 ship the implementation. |
| `adopt-orchestrator-prompts`, `inject-session-bootstrap`, `inject-subagent-context`, `inject-subagent-digest`, `worktree-setup` | NOT shipped (any profile) | Framework-meta machinery; not applicable to consumers. |

### §2.3 Templates inventory

| Template set | core | env | factory | Rationale |
|---|:---:|:---:|:---:|---|
| `packages/core/templates/shared/**` | ✓ | ✓ | ✓ | Universal config + AGENTS.md/CLAUDE.md/DESCRIPTION templates + skill-context overrides. |
| `packages/core/templates/{cargo,python,react-*,ts-server}/**` | ✓ | ✓ | ✓ | Stack-specific killer payload. Lanes covered: js / python / cargo (§3). |
| `.ai-factory/` passport (DESCRIPTION, ARCHITECTURE, RULES.*) | ✓ | ✓ | ✓ | **AI Factory file convention STAYS core-shipped** (spec A1 satellite verdict). The TOOL (`/aif-*`) is not shipped. |

### §2.4 `.husky/` gate chain

| Artefact | core | env | factory | Rationale |
|---|:---:|:---:|:---:|---|
| `pre-commit` + `pre-push` + `core.hooksPath` | ✓ | ✓ | ✓ | Universal guard chain — kickso-lost-between-profiles invariant (spec A1). |

### §2.5 Companions inventory (per spec §4 A1 satellite verdicts)

| Companion | core | env | factory | Rationale |
|---|:---:|:---:|:---:|---|
| `superpowers` (cc-plugin) | ✓ (recipe) | ✓ (recipe) | ✓ (recipe) | Recommendation + setup recipe only — **never a default install** (spec A1 Superset verdict shape). Detect-first; opt-in. |
| `deepwiki` (mcp) | ✓ | ✓ | ✓ | Universal recommendation — knowledge surface for any consumer. |
| `ast-grep-cli` (cli) | ✓ | ✓ | ✓ | Universal — ast-grep is the rule engine for js/python lanes. |
| `ast-grep` (cc-plugin) | ✓ | ✓ | ✓ | Universal recommendation. |
| `runtime-bridge` (external-service) | — | — | ✓ (guided-install declaration; S4 implements) | **`factory` profile UPGRADES the manifest row** from detect+instruct to consented guided INSTALL. **S1 ships the declaration comment on the row only — implementation is S4's scope.** |
| `aif-handoff` (new row) | — | — | ✓ (guided-install declaration; S4 implements) | Today the row is implicit (runtime-bridge routes to it). S1 adds an explicit `aif-handoff` row carrying the `@profile: factory` declaration comment. S4 implements the guided install. |

### §2.6 Plugin twins (zcode parity — Commit C surface)

Per [`zcode-parity-doctrine.md §2`](../../../.claude/rules/zcode-parity-doctrine.md) census:

| Hook | Census row | Status under profiles |
|---|---|---|
| All currently-shipped plugin twins | `parity` (11) / `framework-internal` (2) / `plugin-gap` (row 3) | **No row flips introduced by S1** — S1 does not change which hooks are reachable on the plugin channel, only WHICH setup.d path installs the .claude/hooks/ originals. The plugin twins mirror .claude/hooks/ byte-for-byte per the existing generator. |
| `check-doc-authority-header` | row 3, `plugin-gap` | **STAYS `plugin-gap`.** S1 does not add a plugin twin for it (out of scope; the §2 census doctrine owns this row's resolution). |

---

## §3 Descope verification — the go lane (T-BDU-C, re-verified at execution entry)

`git ls-tree origin/staging setup.d/` lists `46-cargo.sh`, **no `47-go.sh`** (re-verified at
execution entry: see §6 commands). Spec §8: «J3 owns `setup.d/47-go.sh` — A1 profiles list it
only after J3 merges». **No go row in the inventory.** If `47-go.sh` appears mid-stage → STOP
per plan §9 (stop condition).

Covered lanes: **js / python / cargo.**

---

## §4 U3 residue sweep verdicts (Task 1 — T17/T18)

### §4.1 `feature/modular-install-fullpack-f6366e` — SUPERSEDED-with-evidence

Branch carried 1 commit ahead of staging (kickoff said 2; empirical: 1):
`7a5bd7c5 — feat(install): S1 — modularize install.sh into setup.d/ layers (4-stack byte-identical)`.

Staging carries an EVOLVED SUPERSET of this work:
- staging `setup.d/lib.sh` = 969 lines vs branch 372
- staging `install.sh` = 832 lines vs branch 473
- staging has 18 setup.d/ files vs branch 14 (4 MORE layers)
- staging `install.sh:52` carries the BASH_SOURCE PKG_ROOT fix in MORE-REFINED form
  (`# §4d-4: use ${BASH_SOURCE[0]} not $0 — correct when sourced (lib-only mode).`)
- staging's per-layer line counts are larger (e.g. `50-hooks.sh` 73 vs 90 — staging has more
  content; `40-configs.sh` 427 vs 229 — staging has more)

**Verdict:** `SUPERSEDED-with-evidence: 7a5bd7c5 — install.sh + setup.d/{05-mcp,10-skills,
15-companions-stack,20-agents,30-templates,40-configs,50-hooks,60-ci,70-deps,LAYERS.md,lib.sh}
+ tests/install-sh/{baselines/*,layers.test.sh,lib-helpers.test.sh,snapshot.sh} already on
staging via merged modular-install-fullpack S1/S2 (PR #723 et al.) in evolved form; diff is a
strict subset.`

### §4.2 `mif-s3-integ` — OUT-OF-SCOPE-PARKED + OPERATOR-CONSTRAINT-PARKED

The plan's authoring-time note «mif-s3-integ UNREACHABLE from this container» was a snapshot at
plan authoring. **At execution entry the local branch `mif-s3-integ` IS reachable**
(`git branch -a | grep -x mif-s3-integ` returns the branch). Only `origin/mif-s3-revive-toolbootstrap`
is unreachable (TLS handshake fails on `git fetch`). The empirical sweep proceeds against the
local branch — verdict supplied below.

5 commits ahead of staging:

| Commit | Subject | Verdict |
|---|---|---|
| `222fb6b6` | ci(s3): wire tool-decisions-seed-integration.test.sh into audit-self.yml | **OPERATOR-CONSTRAINT-PARKED** — operator pre-start constraint: «DO NOT edit `.github/workflows/audit-self.yml` in this stage — even if a residue verdict suggests porting that commit». Track-1 getff-honest-signals S4 (task `032181b3`) is LIVE on that file. |
| `7f4a7fc1` | S3: revive tool-bootstrap layer + static stack column (modular-install-fullpack) | **OUT-OF-SCOPE-PARKED** — adds ~100 LOC to `setup.d/15-companions-stack.sh` implementing `_detect_stack_from_pkg` + `_stack_matches`. Genuine unique residue on an S1-scope surface, BUT it changes WHAT gets built (stack-detection layer), not HOW (profile depth). S1 is install-profiles-DEPTH, not stack-aware-companion-SELECTION. Per kickoff §7: porting would change WHAT gets built → PARK. |
| `fbc47b6d` | fix(s2/s3 integ): 05-mcp manifest read 5 fields (stacks column from S3) | **OUT-OF-SCOPE-PARKED** — depends on the stacks-column infrastructure from `7f4a7fc1`. Same rationale. |
| `b02d0953` | style(s3): prettier-fix decision-format.md (shipped + dogfood copies) | **OUT-OF-SCOPE-PARKED** — formatting-only edit to `packages/core/skills/tool-bootstrapping/references/decision-format.md` + dogfood twin. Not in S1's surface list. |
| `6c654b0f` | test(s3): regen byte-identical baselines after prettier-fix of shipped decision-format.md | **OUT-OF-SCOPE-PARKED** — test-data regen tied to `b02d0953`. |

**DECISION-NEEDED for maintainer (per kickoff §7 + plan §Parked forks):**

- **Path A** — dispatch a separate stage to absorb the S3 stack-aware companion selection
  residue (the unique value in `7f4a7fc1` + `fbc47b6d`). It is genuine future-value work that
  S1 deliberately does not absorb.
- **Path B** — confirm the residue is dispositioned elsewhere (e.g. track-1, a parallel
  umbrella, or superseded by a separate decision). Operator pre-start constraint is consistent
  with **Path B for the `222fb6b6` commit only**; the other four still need inspection.
- **Path C** — keep the branch dormant longer; record verdict in the dormant-branch tracker.

**S1 proceeds** on the unambiguous parts (the modular-install-fullpack SUPERSEDED sweep + the
new profile machinery); the parked residue does not block this stage's implementation.

---

## §5 Profile-selection mechanics (binding — Tasks 4-6 implement this)

### §5.1 Selection surfaces

| Surface | Behaviour | Reference |
|---|---|---|
| `--profile <name>` flag | Sets `PROFILE` variable; case-insensitive; rejects unknown with exit 1. Mutually-aware with `--with-aif-suite` (explicit `--profile` wins; WARN on disagreement). | Task 4 |
| TTY menu (no `--profile`, `isatty 0`) | 3-choice menu with one-line consequence per profile. | Task 4 |
| Non-TTY default (no `--profile`, `! isatty 0`) | Defaults to `core`; prints one-line `[profile] core (non-interactive default; re-run with --profile env\|factory to deepen)`. Never blocks. | Task 4 |
| `INSTALL-FOR-AI.md` smart default | AI reads the doc and picks `core` (default), `env` (uses /arch or multi-model contour), or `factory` (consumer runs aif-handoff or wants to). | Task 7 |

### §5.2 Consequence text per profile (rustup vocabulary — ADOPTED pattern, T16)

Upstream problem class: pick a toolchain-component-set depth.
Our problem class: pick an install-depth payload set.
Match? same shape — vocabulary transfers; mechanism differs: rustup is additive-components;
ours is stateless-regen via `--refresh` (re-run with a deeper profile regenerates from the new
depth's payload set).

| Profile | One-line consequence |
|---|---|
| `core` | Rules + tests + guard hooks + killer payload; today's default. No AIF operator runtime. |
| `env` | core + multi-model contour surface (/arch, presets, status, night-mode/SDD) — wired as placeholders; no AIF runtime. |
| `factory` | env + the AIF operator suite (dispatcher/harvest/aif-doctor + runtime-bridge + GLM one-button placeholder) — full aif-handoff runtime stack. |

### §5.3 Stateless-regen upgrade semantics (Task 6)

| Op | Behaviour |
|---|---|
| `core → core` re-run with `--refresh` | byte-identical no-op |
| `core → env` with `--refresh --profile env` | env-only placeholders ADDED; core artefacts remain byte-identical |
| `env → factory` with `--refresh --profile factory` | factory-only payload (AIF SUITE skills + aif-handoff declaration row) ADDED; env+core artefacts remain byte-identical |
| `factory → env` (downgrade) | **NOT in scope** — spec A1 upgrade path is monotonic (re-run with deeper). A downgrade is `git rm` the deeper-only artefacts manually. |

---

## §6 Re-verification commands (host-verify contract)

```bash
# Spec anchors (R5 — staging moves fast)
git show origin/staging:install.sh | sed -n '97,118p'           # flag block
git show origin/staging:setup.d/10-skills.sh | sed -n '55,100p'  # F7 split
git ls-tree origin/staging setup.d/ | grep -E '47-go' && exit 1 || true  # go-lane descope holds

# Population enumeration (re-derive §1)
git ls-files packages/core/templates/shared/ packages/core/templates/{cargo,python,react-next,react-spa,react-native,ts-server}/ | sort
git ls-files .claude/hooks/ 'packages/core/hooks/deps-hash-check.sh' | sort
git ls-files .claude/skills/ | grep -E '/SKILL\.md$' | sort
git ls-files packages/core/templates/shared/skill-context/ | sort
git show origin/staging:setup.d/companions.manifest | head -40

# Residue branch reachability (§4)
git branch -a | grep -E 'modular-install-fullpack|mif-s3' || echo "(neither branch present)"

# install-sh snapshot suite (byte-identical invariant)
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh

# Per-profile smokes (host-verify contract in plan)
./install.sh --profile core   --dry-run
./install.sh --profile env    --dry-run
./install.sh --profile factory --dry-run
./install.sh --profile core   < /dev/null   # non-TTY default path
```

The container cannot prove the smoke cells pass — `destination-environment-verification.md §3`.
The host run is the authoritative acceptance.

---

## §7 §1.7 self-reflexive note (this inventory applies to itself)

- **Forward-check:** complies with `no-paid-llm-in-ci.md` (markdown only); `doc-authority-
  hierarchy.md §2-§3` (Class + Authoritative-for header present); `build-first-reuse-default.md`
  (REFERENCE the rustup profile pattern + ADOPT VOCABULARY; no new capability proposed — T16
  match-line in §5.2); `dual-implementation-discipline.md` (no new dual-channel artefact);
  `phase-research-coverage.md §1.7` (this section IS the self-check); `phase-research-coverage.md
  §1.11` (verify-against-SSOT before each verdict — every population count re-derived from
  staging at execution entry, §6).
- **Backward-check:** class of this change = «install-surface payload inventory + profile-depth
  routing over the setup.d layer set». Sibling surfaces swept:
  - **Diff-touched (own-PR surfaces):** `setup.d/10-skills.sh` (SWEPT-CLEAN — current F7 split
    catalogued in §1.1, profile-driven refactor in Task 5 will not lose any row);
    `setup.d/20-agents.sh` (SWEPT-CLEAN — orchestrator-worker + reviewer-discipline +
    aif-orchestrator-discipline agents/skill-context F7 gates mirror 10-skills pattern);
    `setup.d/companions.manifest` (SWEPT-CLEAN — 5 rows enumerated in §1.6, profile gates in §2.5,
    aif-handoff row declaration-only per §2.5); `setup.d/LAYERS.md` (SWEPT-CLEAN — Status column
    audit target for Task 5); `INSTALL-FOR-AI.md` (SWEPT-CLEAN — current `--with-aif-suite`
    references catalogued, profile section added in Task 7);
    `packages/core/templates/shared/AGENTS.md.template` (SWEPT-CLEAN — pointer addition in Task 7);
    `plugin/hooks/` (SWEPT-CLEAN — zcode parity census holds, no row flips in §2.6);
    `tests/install-sh/baselines/` (SWEPT-CLEAN — regenerated, 13/13 byte-identical post-regen).
  - **Non-diff sibling surfaces (swept outward per T21):**
    - `setup.d/05-mcp.sh` — SWEPT-CLEAN: MCP companion install (`claude mcp add` for context7,
      deepwiki, etc.) is profile-agnostic — consumer picks their own MCPs at any depth. No
      profile-gate needed; the layer's existing `FULL` early-return gate handles its dry-run
      behaviour unchanged.
    - `setup.d/30-templates.sh` — SWEPT-CLEAN: `.ai-factory/` templates (DESCRIPTION, ARCHITECTURE,
      RULES, integration-rules, tool-decisions) are core-shipped per inventory §2.4 (the FILE
      CONVENTION is core; the TOOL is not shipped). No payload split by profile today.
    - `setup.d/40-configs.sh` — SWEPT-CLEAN: ESLint rules + dependency-cruiser + tsconfig are
      core payload (rules + tests + guards — every profile carries them). No profile-gate needed.
    - `setup.d/45-python.sh` / `setup.d/46-cargo.sh` — SWEPT-CLEAN: toolchain lanes are gated on
      `GETFF_TOOLCHAIN` (env-var contract), independent of profile. Profile model composes
      orthogonally — a consumer at any depth can install any toolchain lane.
    - `setup.d/50-hooks.sh` — SWEPT-CLEAN: `.husky` pre-commit/pre-push chain is core payload per
      kickoff §2 hard requirement ("no shipped comfort or shield may be lost between profiles").
      Verified: `grep -nE '\bPROFILE\b' setup.d/50-hooks.sh` → empty (no profile reference in the
      layer).
    - `setup.d/60-ci.sh` — SWEPT-CLEAN: `.nvmrc` + CI yaml + R2 auto-wire are core payload. No
      profile-gate needed.
    - `setup.d/70-deps.sh` — SWEPT-CLEAN: `package.json` scripts merge + dev-dep install are
      core payload. No profile-gate needed.
    - `setup.d/99-finalize.sh` — SWEPT-CLEAN: synth-wire + R2 AST-wire + barrel-gen are
      core payload. No profile-gate needed.
    - `.github/workflows/audit-self.yml` — UNTOUCHED per operator pre-start constraint (parallel
      track-1 task `032181b3` live on that file).
    - `mif-s3-integ` / `origin/mif-s3-revive-toolbootstrap` — OUT-OF-SCOPE-PARKED §4.2 (local
      branch `mif-s3-integ` empirically swept; remote `origin/mif-s3-revive-toolbootstrap` still
      unreachable from container via TLS. Per-commit verdicts in §4.2; DECISION-NEEDED for maintainer).
    - `feature/modular-install-fullpack-f6366e` — SUPERSEDED §4.1.
- **Self-application (T15):** the inventory is itself bound by the population-enumeration
  requirement (T10) — §1 IS that enumeration; an inventory assembled from artefacts happened-to-open
  would violate T10. The §2 verdicts cite §1 rows by ID.
