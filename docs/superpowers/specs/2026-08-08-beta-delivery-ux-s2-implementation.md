# beta-delivery-ux S2 — implementation note

> **Status:** thin implementation note, recorded for traceability.
> **Date:** 2026-08-08.
> **Authoritative for:** the S2 implementation choices that the binding spec leaves open or that operator §8a resolutions shape — preset schema + format + marker values + reviewer-tier semantics + CC detection + script-ship grouping.
> **NOT authoritative for:** the binding design itself — see [`2026-07-23-beta-program-design.md`](2026-07-23-beta-program-design.md) §4 A4/A5/A9 (the spec SSOT; on any divergence, the spec wins).

## §1 Scope

S2 ships three daily-use UX artefacts (binding spec A4/A5/A9):

- **A4 — Pipeline launch presets.** Four declarative JSON presets in `.claude/skills/pipeline/references/presets/` (`aif` / `night` / `economy` / `sdd`). Activated by `--preset <name>` flag (clig.dev flag-first) or `AIF_PIPELINE_PRESET` env var; precedence: flag > env > default. Wired into 3 seams: (1) `helpers/parse-override-flags.sh` parser, (2) `SKILL.md §2.5 Step 5` routing predicates, (3) `SKILL.md §0` preamble marker relay into meta-kickoff headers.
- **A5 — `/pipeline status`.** Read-only, three-section status (in-factory / parked questions / ready-to-harvest + PR state), ending with suggested-next lines. Extension of the no-arg overview; NOT a dashboard.
- **A9 — Workspace one-command.** `scripts/getff-work.sh` composes worktree creation (REUSE `scripts/create-worktree.sh`) + dep wiring (package-manager detect) + per-detected-harness session start (CC → DEFER; non-CC → print).

Ships in `env+` profiles. First stage that lands real `env` payload (S1 declared `env` identical to `core`).

## §2 Operator resolutions applied (§8a — BINDING)

The fd1d75e1 run parked six forks; the operator resolved them 2026-08-08. Implemented as resolved:

1. **Preset data schema = Candidate A (flat) + one `description` field.**
   `{mode, reviewer_tier, marker, description, predicates: {bundle_opt_in, review_required, parallel_safe}}`. Optional `aif_runtime_hints.maxReviewIterations` carries the economy reviewer-tier hint. All three seams are bash-3.2 + `jq` one-key lookups.
2. **Preset data format = JSON.** `jq` is already a hard helper dependency. F-B′ shell-sourced rejection: sourcing data executes it as code; the parser itself rejects `eval` for injection risk (strategy C), so data that executes fails F-B′.
3. **Economy reviewer-tier = executor tier with `maxReviewIterations=1`.** Carried via `aif_runtime_hints.maxReviewIterations` in the preset JSON; resolver emits `PRESET_AIF_MAX_REVIEW_ITERATIONS=1` for downstream consumption.
4. **CC detection = `CLAUDE_CODE_SESSION_ID` env var.** When set, the workspace one-command script DEFERS entirely to the native CC flow (`cd <path> && claude -w <name>`); the wrapper does NOT launch a session.
5. **Marker values = full display names.** `economy` → `Z.AI GLM-5.2 SDK`; `aif` → `Claude Opus (plan+review)`. Snapshot of the live runtime-profiles list at the moment of authoring (§1.1 neighbor-gate snapshot). Live re-probe was attempted against `$RUNTIME_BRIDGE_AIF_URL/runtime-profiles` but the bridge was unreachable in the build container; the snapshot values are taken as binding per §8a Park-5 and will be re-verified by the operator at merge time.
6. **Three worktree scripts ship together.** `create-worktree.sh` → `worktree-node-modules.sh` → `link-coordination.sh` form a call chain; partial ship produces loud warnings from `create-worktree.sh:127-129`. `setup.d/85-worktree-scripts.sh` copies all three verbatim under the env+ profile gate (`PROFILE=env` / `PROFILE=factory` / `WITH_AIF_SUITE`).

## §3 Resolved technical forks (inside the §8 mandate)

- **`bin.getff` entry skipped.** `package.json` is `private: true` with no existing `bin` map; an npm-bin entry has no publish surface today. The script is reachable via `bash scripts/getff-work.sh` and shipped to consumer `scripts/` via `setup.d/85`. The bin entry is deferred to R1 (npm release mechanics, §6 out-of-scope).
- **`PRESET_MARKER` emission rule.** The resolver OMITS the `PRESET_MARKER=` line when the preset's marker is null/empty (rather than emitting `PRESET_MARKER=` with an empty value). Rationale: the consumer (kickoff header seam) treats "absent line" as "no bridge-profile marker to emit"; emitting an empty value would be ambiguous with "marker set to empty string". Verified by `parse-preset.test.ts` ENV-NIGHT + ENV-SDD cases.
- **Default behaviour is print-only, never spawn.** Per §4.3-4.4 the spec allows launch/print for non-CC; for safety (interactive session spawn from a shell script risks STDIN/STDOUT/env contamination), the wrapper ALWAYS prints the ready command, even on a TTY. `--no-launch` is effectively the default; the flag exists for forward-compatibility and to satisfy §4.4's "always prints" contract for AI DX.

## §4 Acceptance evidence (T3 — every claim carries command + output)

| AC | Evidence |
|---|---|
| AC-1 (presets activate flag-only, non-TTY) | `parse-preset.test.ts` — 11 cases including FLAG-AIF, FLAG-ECONOMY, ENV-NIGHT, ENV-SDD, COLLISION, UNKNOWN, FLAG-OVER-ENV, ALL-FOUR-PRESETS-ROUND-TRIP. All 11 pass (live test run output in PR body). |
| AC-2 (`list` verb surfaces all four presets, data-driven) | `list-presets.test.ts` — ALL-FOUR-PRESETS-LISTED + DESCRIPTION-EMBEDDED + ALPHABETICAL-ORDER + DATA-DRIVEN-EXTENSIBILITY (drops a 5th JSON in a synthetic dir via `MO_PRESETS_DIR`; verifies it appears with zero code change). All 4 pass. |
| AC-3 (marker emission verified live) | Resolver output for `economy` and `aif` presets contains the unique marker values (`Z.AI GLM-5.2 SDK` / `Claude Opus (plan+review)`). **Caveat:** the bridge was unreachable in the build container; live re-probe of `/runtime-profiles` is queued for the operator at merge time (see §2.5 of this note). |
| AC-4 (`/pipeline status` renders all three sections, gracefully degrades) | `render-status.test.ts` — THREE-SECTIONS-PRESENT + HEADER-MARKER + SUGGESTED-NEXT-TAIL + GRACEFUL-BRICK-UNAVAILABLE + NO-CRASH-WHEN-GH-ABSENT. All 5 pass. Live-fired AC-4 evidence against a running aif + open PR + parked question is captured in the PR body. |
| AC-5 (A9 smoke on CC AND non-CC harness) | `getff-work.test.ts` — CC-DEFERRAL (sets `CLAUDE_CODE_SESSION_ID`, asserts deferral message + `claude -w <name>` printed) + NON-CC-PRINT (asserts ready command printed, no session spawned). Plus live end-to-end smoke during implementation: `bash scripts/getff-work.sh <name> --no-launch` produced worktree + npm install + harness detect. |
| AC-6 (`env` profile carries real payload after S2) | `setup.d/85-worktree-scripts.sh` ships the 3 worktree scripts under env+ gate; dry-run smoke (`PROFILE=env DRY_RUN=1 ...`) confirms the gate admits env+ and skips core. |

## §5 Files shipped

**New files:**

- `.claude/skills/pipeline/references/presets/aif.json`
- `.claude/skills/pipeline/references/presets/night.json`
- `.claude/skills/pipeline/references/presets/economy.json`
- `.claude/skills/pipeline/references/presets/sdd.json`
- `.claude/skills/pipeline/helpers/resolve-preset.sh`
- `.claude/skills/pipeline/helpers/list-presets.sh`
- `.claude/skills/pipeline/helpers/render-status.sh`
- `setup.d/85-worktree-scripts.sh`
- `scripts/getff-work.sh`
- `packages/core/hooks/parse-preset.test.ts`
- `packages/core/hooks/list-presets.test.ts`
- `packages/core/hooks/render-status.test.ts`
- `packages/core/hooks/getff-work.test.ts`
- `docs/superpowers/specs/2026-08-08-beta-delivery-ux-s2-implementation.md` (this file)

**Modified files:**

- `.claude/skills/pipeline/helpers/parse-override-flags.sh` — preset detection block (seam #1).
- `.claude/skills/pipeline/SKILL.md` — arg routing edit + preset preamble (seam #3) + §2.5 routing short-circuit (seam #2) + new §0.1 + §2.6 stubs.
- `.claude/skills/pipeline/references/mode-overrides.md` — new §8 (preset documentation).
- `.claude/skills/pipeline/references/output-format.md` — new §1C (status format).

## §6 Out of scope (per kickoff §6)

- Tier-home doc + degradation matrix + CLAUDE.md pointer-ization → S3.
- GLM one-button flow + aif guided-install implementation → S4.
- `/arch` + `claude-glm-executor-handoff` shipping + runtime-bridge vendoring → S5 (already shipped ahead of this stage).
- npm release mechanics → R1.
- Editing `/arch` or `claude-glm-executor-handoff` CONTENT.
- Touching `setup.d/47-go.sh` or any go-lane row.
- Re-implementing `create-worktree.sh` (REUSE per §4).

## §7 See also

- [Binding design spec](2026-07-23-beta-program-design.md) §4 A4/A5/A9.
- Kickoff: `.claude/orchestrator-prompts/beta-delivery-ux/kickoff.md` §8a (operator resolutions).
- Plan: `.ai-factory/plans/feature-beta-delivery-ux-a83379.md`.
- Sibling stage docs: S1 (`2026-07-23-beta-program-design.md` §3), S5 implementation note (TBD if not yet shipped).
