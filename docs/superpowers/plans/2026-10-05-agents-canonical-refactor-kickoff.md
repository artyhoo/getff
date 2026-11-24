# Canonical .agents Refactor Implementation Plan and Kickoff

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` for implementation. The operator's economical verification preference overrides redundant review rounds and unchanged broad reruns; preserve required checks for changed behavior.
> **Authoritative for:** the operator-approved scope, migration constraints and acceptance of this refactor.
> **NOT authoritative for:** the project goal, existing rule semantics, operator trust decisions or release authority. README.md remains the project-goal owner.

**Goal:** Make `.agents` the canonical shared contributor source and keep Claude Code, ZCode and Codex as thin delivery/adaptation layers, including installation and distribution.
**Architecture:** One source owns each portable procedure, role and check. Harness folders contain discovery entries, configuration or event/argument/output adapters. Generated payloads are permitted where packaging or native discovery requires them, never independently edited workflows.
**Tech Stack:** Existing Markdown/YAML/TOML, Node.js renderer/adapters, Bash installer and Vitest/Node tests; reuse current machinery.
**Spec:** The approved contract below and `.claude/rules/dual-implementation-discipline.md` §7–8. This plan refines task architecture; it does not redefine the project goal.

## Approved contract

The operator approved this direction on 2026-10-05 and explicitly included the installer in the full refactor.

1. `.agents` owns shared authored procedures, role instructions and portable check implementations. Use coherent subdirectories by responsibility, not one flat directory. Existing `.agents/skills` is currently generated Codex output: migrate its ownership deliberately rather than overwriting it blindly.
2. `.claude`, `.zcode`, `.codex` and plugin entry points adapt native discovery, metadata, event schemas and invocation. Preserve expected public skill names, argument handling, trigger intent and check behavior.
3. A common procedure/check is authored once. Prefer direct reuse, validated links or small explicit source-reading entry points. Where a host requires expanded native text, use reproducible generation from the same source with drift detection, never a hand-maintained second procedure.
4. Do not confuse a Markdown pointer with an executed procedure, or registration with working behavior. Ensure full source loading and helper availability in actual workflows.
5. Required authored sources and delivery entries travel through Git. A new worktree must not need an ad-hoc per-worktree generation step merely to recover missing contributor files. Build/install-time package assembly remains legitimate.
6. Adaptation covers skills, role prompts, rules/triggers, hooks/scripts, plugins and MCP configuration. Host plugin activation, external companion availability, hook trust and live MCP sessions remain host-managed boundaries; a file cannot grant them.
7. Keep Claude Code behavior working during migration. Preserve or provide an equivalent reachable channel for each supported behavior. An unsupported native event must have an explicit fallback or an accurately recorded unresolved gap, never silent success or an invented event.
8. Refactor existing architectural owners and guards rather than adding a competing portability standard. Neutral `.ai-factory` configuration already has an owner; do not move unrelated factory/runtime policy just to put every file under `.agents`.

## Global constraints

- Work in `/Users/art/.codex/worktrees/0479/rules-as-tests-aif`; HEAD was detached `1b390629d4806e9378989533c7a1501dd4c08b08`. Reconcile current state first.
- Preserve all existing WIP. Do not reset, stash away, broadly overwrite, or import the complete dirty state of checkout `0d9e`. Do not touch checkout `778f` or the primary checkout.
- Implement the complete refactor autonomously after grounding; ordinary implementation choices need no new permission. Escalate only real unresolved strategy or operator-only actions.
- No staging, commits, pushes, PRs, merges, publishing, production deployment or global configuration changes are authorized. Prepare a reviewable working-tree result.
- Do not edit sealed `.claude/settings.json` or `.ai-factory/harness-model.json` contents or bypass their seals. Preserve existing registered paths through thin compatibility wrappers when needed. If migration truly requires changing a protected artifact, prepare the exact proposal and explain the authority conflict before acting.
- No trust-storage changes or bypass flags. Current native hook trust is complete. Definition changes may require an operator-only native review; report actual changed hashes only.
- Keep inherited model/account settings; no paid API calls or paid LLM in CI. Native discovery/config probes do not require a model turn.
- English repository artifacts; Russian operator communication. Be concise and use concrete outcomes.
- Use bounded isolated workers where applicable, with explicit ownership and `fork_turns: none`; they are not alone and must preserve other changes. Reuse accepted source work; no duplicate exploratory audits.
- The full original 20+32 ledger remains an honest backlog. Do not replace it with a sample or claim every workflow passed because discovery/test counts are green. Do not require unrelated factory execution to complete this storage/delivery refactor.

## Current verified baseline and known gaps

- Current native doctor: 39 project skills discovered, 21 contributor hooks, hooksActivated=true, no missing definitions or skills. This proves discovery/activation, not complete skill behavior.
- Existing adapter tests: 39/39 PASS. Focused CODEX-READY-TEMP: 2 PASS, 10 unrelated tests skipped. Codex-only renderer drift check PASS.
- Native startup, literal pre-tool deny, path-card delivery, marker/header feedback and parent manual compact were tested previously; read linked evidence rather than replaying unchanged cases.
- The emitter currently expands 17 of 18 contributor workflows; one is a thin canonical pointer. Agent procedures are separate pointers. The target must reduce unnecessarily expanded bodies without losing eager helpers or native metadata behavior.
- A temporary archive of current Git HEAD lacked `.agents/skills` and the Codex adapter; the current renderer's Codex check failed there. `.codex` is ignored. Fix distribution, not just this checkout's local availability.
- Node dependencies now live in this checkout after local `npm ci --ignore-scripts`; `npm ls --depth=0 --json` reported no problems. Earlier temporary runtime links/fixtures have disappeared. Check live tools before assuming availability.
- `docs/codex-contributor.md` references absent `docs/session-coordination.md`; its protocol owner specs exist. Repair the reference/dependency honestly; do not invent or blindly copy a new bus implementation.
- Automatic worktree generation was discussed but not implemented. The approved direction supersedes that stopgap.

## File and ownership map

| Surface | Current owners to inspect and update | Required result |
|---|---|---|
| Shared sources | `.claude/skills`, `skills`, `agents`, `.claude/rules`, `.claude/hooks`, `scripts` | An enumerated source-to-canonical-path map; shared content under `.agents`; retain deliberate distinct roles and sources |
| Native layers | `scripts/render-harness-config.mjs`, `scripts/render-codex-contributor.mjs`, `scripts/codex-hook-adapter.mjs`, `.claude`, `.zcode`, `.codex` | Thin native bindings; no second authored workflow or mandatory birth-time regeneration |
| Plugin layers | `plugin`, `codex-contributor-plugin`, `scripts/generate-plugin-twins.sh` | Entry points and build-time payload derived from shared source; dedup/source-hash behavior preserved |
| Installer | `install.sh`, `setup.d/10-skills.sh`, `20-agents.sh`, `40-configs.sh`, `50-hooks.sh`, `85-worktree-scripts.sh`, `lib.sh`, `ships.manifest` | Install from new source layout; preserve core/env/factory, dry-run, force/overwrite, upgrade and consumer-owned files |
| Distribution | `scripts/build-getff-dist.sh`, `packages/getff/package.json`, `packages/getff/.gitignore`, `packages/getff/MANIFEST.sha256`, relevant core package files | New roots actually included in assembled/npm payload; no link into contributor checkout |
| Guards/tests | `packages/core/hooks/harness-config-drift.test.ts`, `scripts/codex-contributor.test.mjs`, installer/skills/plugin tests, `packages/core/principles`, `tests/agnosticism` | Existing checks follow new owners; do not weaken coverage, delete failures or add blanket exemptions |
| Docs/bootstrap | AGENTS.md, CLAUDE.md, canonical bootstrap, installer/binding docs, applicable architecture rules | Correct links and loading paths; preserve goal-bearing and frozen historical content |

## Execution order

### 1. Ground the migration and write the concrete map

- [ ] Read HANDOFF.md, README goal, bootstrap, CLAUDE.md and applicable ai-doc/dual-implementation/parity/installer rules.
- [ ] Enumerate the complete affected own-stack source/delivery population and installer/pack consumers. Exclude external plugin caches and user-scope content from ownership.
- [ ] Produce a concise old-source → new-owner → harness-entry → consumer-payload map. Identify authored vs generated files and retired artifacts.
- [ ] Capture Git/index state and protected file hashes. Record baseline failures separately; do not attribute preexisting failures to this change.

### 2. Establish one complete migration slice

- [ ] Select one existing shipped skill with a real helper and one portable check currently served by a hook; choose from inspected shipped sources, not by name guess.
- [ ] Move their canonical bodies to `.agents`; keep native metadata/entry paths and meaningful source loading correct for all three hosts.
- [ ] Update their installer and package payload in the SAME slice. Install into an isolated temporary consumer; require helpers and wrappers to resolve entirely within delivered content.
- [ ] Exercise expected clean and violating behavior and one source edit flowing to all bindings. If a link/entry cannot preserve behavior, establish the minimal generated binding with drift detection before expanding the migration.

### 3. Complete the remaining source/adaptation migration

- [ ] Apply the working pattern to the full inventoried skill/role/rule/hook population. Preserve bootstrap, context/cache lifecycle, argument handling, triggers, permission seals and reporting behavior.
- [ ] Update renderers, source readers, relative paths, helper discovery, metadata, plugin twins/hashes and coordination references together with each owner move.
- [ ] Convert only harness-specific code/metadata into adapters. Do not relocate neutral policy or durable task runtime merely for directory symmetry.
- [ ] Retire obsolete generated copies using ownership-aware removal. Inventory-based cleanup must never remove consumer-authored files.

### 4. Complete installer, package and Git delivery

- [ ] Update installer source lookup, templates, transform functions, ships/profile manifests, package assembly roots and package files lists. Preserve current profile contents and collision/overwrite semantics.
- [ ] Test fresh installation and upgrade of a legacy-layout temporary consumer, including consumer-owned customization, dry-run and repeated installation.
- [ ] Assemble the distributable using existing builders; inspect local npm pack contents without publication. Install from the assembled payload, with the original contributor path unavailable, and verify no dangling link or helper dependency.
- [ ] Test a fresh temporary checkout containing the intended final tracked file set, including new currently-untracked sources. Do not stage/commit the real checkout to manufacture this fixture; a standalone disposable fixture may commit its own test snapshot.
- [ ] Confirm required `.agents` content/native bindings survive Git packaging and ignore rules; runtime-specific private settings stay private. No requirement to run a generator every time a worktree is created.

### 5. Verify once, repair narrowly, hand off

- [ ] Run affected existing adapter, drift, skill/helper, installer/profile, plugin/hash, agnosticism and package checks. Run required project-wide final gates once after integration; repeat only changed/failed checks.
- [ ] Use bounded native checks for changed joins only. Preserve evidence that discovery, activation and real execution are different. If a host cannot be reached, record the actual boundary rather than claiming native PASS.
- [ ] Update current acceptance/20+32 ledger with explicit refactor evidence and remaining native capability gaps. Never silently mark all rows complete.
- [ ] Update documentation and HANDOFF with changed ownership, commands, results, genuine remaining issues and a reviewable diff. Do not claim completion while installer/package delivery is broken.

## Acceptance / stop conditions

The refactor is complete when shared authored behavior has one canonical owner under `.agents`, all intended native entry paths load that behavior, source edits propagate without manual multi-copy changes, clean Git delivery works, fresh/legacy consumer installation and assembled-package installation work, required checks pass, and runtime limitations are explicitly accounted for.

Temporary consumer links must not point into the source checkout, `/tmp` runtime trees or plugin caches. A renderer drift pass against the already-prepared local tree is insufficient for Git/install delivery. A missing callback is not a successful failed-write alert. Do not fabricate native feature parity.

Pause only dependent work for missing operator-only trust, protected-artifact authority or a genuine unresolved architecture decision; complete independent work first. Factory deployment, new live jobs, external companion installation and release actions are outside this authorization.

## Verification trace template

Record command, fixture/destination, exit code, expected behavior and observed result. Summarize successful routine checks; retain exact failure diagnostics. The first complete slice has clean/violation/source-change controls; ordinary subsequent migration uses existing regression checks instead of repeatedly commissioning proof rounds.

## §1.7 Self-review

**Forward-check:** This plan reuses the one-source/two-channel owner in dual-implementation-discipline §7, current renderers/adapters, installer and package builder. It carries scope authority, preserves README goal, protected configuration and native trust, and prohibits paid LLM in CI. Verification targets actual delivered destinations, not directory appearance.

**Backward-check:** The migration population explicitly includes source procedures/helpers, native metadata/triggers, hook/script invocations, plugin twins/hash/yield, MCP configuration, installer profiles/transforms/overwrites, Git/worktree delivery, npm package assembly, guards and documentation. Existing CC-first historical locations are migration inputs, not justification for independent reimplementation. Residual full-workflow/native-failure/factory cases remain visible in the original ledger.

This is a local implementation kickoff under docs/superpowers/plans, not a launched /pipeline umbrella or bridge-auto job. Do not dispatch /pipeline/aif from this local file without their separate staging/profile prerequisites.
