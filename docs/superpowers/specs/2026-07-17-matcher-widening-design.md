# matcher-widening — design spec

> **Status:** design FINAL (4 rounds of dual top-down + bottom-up review; not yet implemented).
> **Base:** `origin/staging` @ `4a9b508a9` (verified fresh after round-3 discovered the prior worktree was 8 commits / 3 hooks stale).
> **Branch:** `feat/matcher-widening-multiedit` (recreated off fresh staging; spec doc committed `b7cc54096`).
> **Date:** 2026-07-17.
> **Round-4 update:** preventer redesigned as a DUAL-LAYER gate (edit-time via extending `check-hook-marker.sh` + CI-backstop via extending `channel-coverage.sh`) instead of a new standalone probe — resolves R1 (earliest-channel / reuse-first), R2 (no consumer dead-token), PM-r4.7 (RED-fixture wiring via existing test suites). Edit-site `tests/install-sh/gh-934-ship-doc-authority-hook.test.sh:56` added (was missed in §2).

## 1. The bug

Several file-editing `PostToolUse` hooks are registered with matcher `Edit|Write` only. Claude Code emits `MultiEdit` as a **separate** `PostToolUse` event with `tool_name:"MultiEdit"` — it is NOT cascaded into `Edit`/`Write` events. Therefore an `Edit|Write` matcher does **not** fire on a `MultiEdit` call, and a `MultiEdit` that violates a hook's rule slips past the gate silently.

**Falsifier (confirmed, 3 independent sources):**
1. Official Anthropic docs — matcher filters strictly on `tool_name`; MultiEdit is a distinct name.
2. Anthropic's own `security-guidance` plugin registers `Edit|Write|MultiEdit|NotebookEdit` — proof MultiEdit must be enumerated separately.
3. In-repo: `.claude/orchestrator-prompts/self-enforcement-fixes/kickoff.md:89` carries a live falsifier (`{"tool_name":"MultiEdit","tool_input":{"file_path":...}}` fed to inject-matching-rule.sh, "хук-логика готова"). MultiEdit's `tool_input` DOES include `file_path` (shares the Edit interface), so path-filtering hooks receive the correct path.

The **real bug shape** is *body↔registration drift*: 3 of the affected hooks already have `case "$TOOL" in Edit|Write|MultiEdit)` in their BODY (the author encoded MultiEdit-awareness in the logic) but registered `Edit|Write`. Body and registration disagree.

## 2. Inventory (file-verified on fresh base `4a9b508a9`)

### Narrow `Edit|Write` matchers to widen — **6 hooks total**

| # | Hook | Where registered | Body has `case "$TOOL"`? | Class |
|---|------|------------------|--------------------------|-------|
| 1 | `validate-prompt.sh` | harness-model.json:23 | NO (path-only: `.tool_input.file_path`) | path-only-gate |
| 2 | `check-doc-authority.sh` | harness-model.json:27 | NO (path-only) | path-only-gate |
| 3 | `inject-matching-rule.sh` | harness-model.json:31 + setup.d:206 + install.sh:469 (shipped) | YES (`Edit\|Write\|MultiEdit)`, no spaces) | parity-gate |
| 4 | `check-kickoff-traps.sh` | harness-model.json:35 | YES (`Edit \| Write \| MultiEdit)`, spaces) | parity-gate |
| 5 | `check-hook-marker.sh` | harness-model.json:39 | YES (`Edit \| Write \| MultiEdit)`, spaces) | parity-gate |
| 6 | `check-doc-authority-header.sh` | setup.d:246 + install.sh:493 (shipped, from merged #1009) | NO (path-only) | path-only-gate |

**Already-correct (do NOT touch):** `runtime-bridge-dispatch.sh` (`Write|Edit|MultiEdit`), `check-worker-dispatch-channel.sh` (`Edit|Write|MultiEdit`), `inject-memory-codification.sh` (`Write` — A5 decision: Write-only by design).

**Out of scope:** `inject-project-digest.sh` (#1014) — on `UserPromptSubmit`+`SubagentStart`, not a file-content gate. `Agent|Task` / `AskUserQuestion` PreToolUse matchers — not file-content.

> **Note on hook #6:** round-3 review discovered PR #1009 was MERGED (`b770090`, 2026-07-16). Its `check-doc-authority-header.sh` is path-filtered and registered `Edit|Write` via the shipped installers — a real MultiEdit enforcement hole on the consumer surface. It was invisible to all prior rounds because the worktree base predated the merge. This is why the base was refreshed.

### Parser hazard (PM7, verified)
The 3 `case "$TOOL"` hooks use **two syntax variants**: `Edit|Write|MultiEdit)` (no spaces, inject-matching-rule.sh:38) vs `Edit | Write | MultiEdit)` (spaces, the other two). Any probe extracting the tool-set MUST whitespace-normalize before splitting on `|`. Also each file has a SECOND `case ... esac` (path-glob) — anchor specifically on `case "$TOOL" in`.

### Edit-site summary
- `.ai-factory/harness-model.json`: 5 quote-anchored fields (lines 23,27,31,35,39) → `Edit|Write|MultiEdit`. Lines 43/47/51 (already-MultiEdit / Write) survive quote-anchored replace.
- `setup.d/10-skills.sh:206` + `:246` → `Edit|Write|MultiEdit`.
- `install.sh:469` + `:493` → `Edit|Write|MultiEdit`.
- `tests/install-sh/gh-934-ship-session-ux-hooks.test.sh`: lines 56,57,136 (functional exact-equality + ok-msg). Line 59 uses `$_imr_matcher` var — NOT edited. Comments 6,11,54 optional.
- `tests/install-sh/gh-934-ship-doc-authority-hook.test.sh:56` (round-4 add): exact-equality `[ "$_matcher" = "Edit|Write" ]` + ok-msg literal `Edit|Write` + comment line 13. Widening hook #6 breaks this test unless updated.
- Re-capture 8 npm baselines (`SNAPSHOT_MODE=capture`); 3 python untouched.
- `node scripts/render-harness-config.mjs --check` first (pre-sync proof, exits 0 today), then `--write` to regen `.claude/settings.json` (`.mcp.json` byte-identical, `.zcode/` gitignored).
- **Acknowledged non-edit surfaces:** `plugin/hooks/hooks.json:17` (already widened — data point), `tests/fixtures/plugin-broken-manifest/...hooks.json:5` (intentional broken fixture), `.claude/orchestrator-prompts/launch-preannounce-track/s5-probes/probe-zcode-hooks.sh:52,59` (frozen probe data), `packages/core/hooks/apply-doc-fixes.test.ts:32,36` (frozen historical prose — editing breaks the sed-match test), `scripts/apply-doc-fixes.sh:61,66` (frozen), `validate-prompt.test.ts:4` (doc comment), `setup.d/lib.sh:871` (doc example).

## 3. Design — single atomic PR (fix + lightweight preventer)

**Decomposition:** ONE PR (not two). Round-1 considered 2-PR (fix / preventer) but round-2/3 showed splitting opens a recurrence window with no offsetting benefit once the preventer is lightweight. Atomic = no window, single self-consistent end-state.

### 3a. The fix (STEP 1)
Widen all 6 matchers to `Edit|Write|MultiEdit` per the inventory. SSOT-first (harness-model.json → `render --write` → setup.d/install.sh → gh-934 test → re-capture baselines).

### 3b. The preventer (STEP 2) — DUAL-LAYER gate (edit-time + CI-backstop)

A full principle №33 was **deferred** (T6: incidence N=1; a probe/gate is the project's codified lighter middle option per dual-implementation-discipline.md §9 — a probe ≠ a principle slot, so the 3-in-6-months threshold governs principle-slot promotion, not gate addition).

Round-4 review (R1) found a **reuse-first** path that lands the preventer at the **earliest reachable channel** (rule-enforcement-channel-selection.md §4: edit-time ≻ CI) by extending EXISTING mechanisms rather than building new ones. Round-4 (R2) also showed that a standalone probe + `@file-content-gate` marker ships a dead bookkeeping token to consumers (check-doc-authority-header is consumer-shipped). Both resolve by reusing the existing marker-sweep infrastructure:

**Layer 1 — edit-time (extend `check-hook-marker.sh`):** this hook ALREADY iterates `.claude/hooks/*.sh` at edit-time, already reads `@dual-pair:` / `@cc-only-rationale:` markers from headers, already exits 1 on violation. Extend it to also enforce a NEW in-hook declaration `# @file-content-gate` (added to the 3 path-only hooks: validate-prompt, check-doc-authority, check-doc-authority-header): if a hook declares `@file-content-gate`, its registered matcher (read from `.claude/settings.json`, the rendered output) MUST be `Edit|Write|MultiEdit`. For the 3 case-TOOL hooks (inject-matching-rule, check-kickoff-traps, check-hook-marker itself — wait, self-application: see §3e), the parity rule applies (matcher ⊇ case-arm set). The signal lives **in the hook header** (author declaration) → no allowlist, no Arm(b) failure. This catches the recurrence at edit-time, the earliest channel.

**Layer 2 — CI-backstop (extend `channel-coverage.sh`):** the existing agnosticism probe (69 LOC, auto-wired via `tests/agnosticism/run-audit.sh:14` glob → principle 21 → audit-self.yml) ALREADY sweeps `@dual-pair` / `@cc-only-rationale` markers population-wide. Extend it to ALSO sweep `@file-content-gate` markers and assert the same matcher rule. CI catches what edit-time might miss (the original hole was itself an edit-time-hook bypass — defense in depth, rule-enforcement-channel-selection §4).

**Why dual-layer, not edit-time-only:** the very bug being fixed is an edit-time hook that was itself bypassed. Single-layer trust in the same mechanism class is not robust; CI is the last-resort backstop per README. The cost is small (both extensions reuse existing iteration/marker-resolution logic).

**Why not standalone new probe (rejected, round-4 R1):** would land only at CI (later channel), create a parallel reader of the hook population (structure-drift risk, build-first-reuse-default §4 `#parallel-evolution-creep`), and ship a consumer dead-token (R2). Reuse wins.

**Why not allowlist (rejected, round-1):** a name-allowlist passes today but cannot catch the next instance of the same bug — false security, the worst outcome for a rules-as-tests repo.

### 3c. Paired-negative (T5 meta-gap — load-bearing, not optional)
Both layers ship a live RED fixture/assertion proving non-tautology:
- **Layer 1** (check-hook-marker.sh extension): tested via the existing `tests/hooks/` suite pattern — a synthetic hook with `@file-content-gate` + a settings entry with `Edit|Write` → the gate exits 1. Mirrors how check-hook-marker.sh is already tested.
- **Layer 2** (channel-coverage.sh extension): tested via principle 21's existing paired-negative arms (synthetic TSV rows) OR a dedicated fixture under `tests/fixtures/matcher-drift/`. The live `run-audit.sh` invocation in principle 21 must stay GREEN (all-PORTABLE) on the real repo; the RED case is exercised in isolation, not via the live harness run (PM-r4.7).

### 3d. Decisions made
- **A5:** `inject-memory-codification.sh` stays `Write`-only (models the *creation* moment of a memory entry; in-place Edit is a lower-probability vector). No `@file-content-gate` marker (not a file-content-gate).
- **`@file-content-gate` marker** chosen because the signal must be declarative (in-hook header) to avoid the allowlist trap.
- **Dual-layer** chosen over edit-time-only because the original bug was itself an edit-time-hook bypass (defense in depth).

### 3e. Self-application note (check-hook-marker.sh edits itself)
`check-hook-marker.sh` is BOTH (a) one of the 6 hooks whose matcher we widen AND (b) the Layer-1 gate we extend. Editing it triggers its OWN edit-time check — which must pass on the new version. This is recursive self-application (the project's dogfooding principle). Implementation must verify the gate passes on its own post-edit source.

### 3d. Decisions made
- **A5:** `inject-memory-codification.sh` stays `Write`-only (models the *creation* moment of a memory entry; in-place Edit is a lower-probability vector). No marker added (not a file-content-gate).
- **`@file-content-gate` marker** chosen over alternatives because the signal must be declarative (in-hook) to avoid the allowlist trap.

## 4. Residual risks / honest notes

- **Probe is CI-tier (last-resort channel), not edit-time.** README says earliest-reachable-channel. An edit-time hook on `harness-model.json` authoring is a future Tier-1 promotion; documented in the probe's header, not silently landed at CI.
- **`paths:` ↔ hook matcher divergence (A4):** `inject-matching-rule`'s `@dual-pair` is CC `paths:` frontmatter (read-time, tool-agnostic). Widening the hook matcher does NOT widen `paths:` (no tool matcher). This read-vs-edit timing divergence is by design — documented, not fixed.
- **Principle №33 remains deferred** to incidence N≥2; the dual-layer gate is the lighter middle-option (a probe/gate ≠ a principle slot, per dual-implementation-discipline.md §9 — so the 3-in-6-months threshold governs principle-slot promotion, not gate addition). This dissolves the F3 "silent-drop" risk (a bare GitHub issue without a detector = armed-but-not-fired, phase-research-coverage §1.6).

## 5. Gates before push
`render-harness-config.mjs --check` (drift = GREEN); `vitest run packages/core/principles/ packages/core/hooks/`; bash `lib-helpers`+`meta-all-wired`+`layer-units`; `refresh-covers-full-delivery`; `gh-934-ship-session-ux-hooks`; `gh-934-ship-doc-authority-hook`; `byte-identical` (after re-capture); the extended check-hook-marker.sh self-passes on its own edited source; the extended channel-coverage.sh + its RED paired-negative; `shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh .claude/hooks/*.sh`; own adversarial cold-review of the final diff.

## 6. Review history (4 rounds, dual top-down + bottom-up)
- **Round 1:** found the original allowlist-design was T16 false-security (body↔registration drift undetectable); SSOT-first order (harness-model.json, not settings.json direct edit); replace-footgun (quote-anchor); gh-934 test line undercount.
- **Round 2:** Arm(b) incoherence (no signal distinguishes path-only-gate from intentionally-narrow); incidence N=1 vs 3/6mo threshold; case-syntax split; check-authority-header follow-up misframed.
- **Round 3:** discovered the worktree base was 8 commits / 3 hooks STALE (PR #1009 merged b770090) — invalidating prior inventories; both reviewers erred on the hook name (`check-doc-authority-header`, not `check-authority-header`); confirmed 6th hook (check-doc-authority-header) is a real path-only-gate MultiEdit hole; chose middle-option probe + `@file-content-gate` marker to resolve Arm(b) without allowlist. **Lesson:** dual-review shares the worktree's blind spots — a stale base fools both reviewers identically; only an out-of-band check (`gh pr view`) surfaced it.
- **Round 4:** on the refreshed base, top-down found the REUSE-FIRST path (R1: extend check-hook-marker.sh + channel-coverage.sh instead of a new probe — earliest channel, no consumer dead-token R2); found a MISSED edit-site (R5: `gh-934-ship-doc-authority-hook.test.sh:56` hardcoded Edit|Write); corrected the citation (R4 nit: BFR §5 → dual-impl §9). Bottom-up confirmed the probe auto-wiring (run-audit.sh:14 glob) and flagged the RED-fixture test-wiring gap. Decision (maintainer, option B): **dual-layer gate** (edit-time + CI-backstop) — resolves all round-4 findings in one design.
