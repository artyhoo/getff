# S0 — install.sh → setup.d layer boundary table (RESEARCH ONLY)

> **Class:** operational artifact (S0 deliverable of the `modular-install-fullpack` umbrella). **Status:** DONE — research only, no code moved.
> **Authoritative for:** the reference blueprint mapping every `install.sh` step → its target `setup.d/*` layer, the layer-dependency order, and the byte-identical constraints S1–S4 implement against.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md). Stage scope / sequencing — see [kickoff.md](kickoff.md) §3. Layer set is FIXED by brainstorm (kickoff §4) — S0 decides only exact composition/order within it.

> **Inputs walked:** `install.sh` lines 1–1586 (end-to-end, full census per T10); `setup` (48 lines); `setup.d/{engine.sh,companions.manifest,bridge-guided.sh}`; FQA-B evidence patch ([2026-06-11](../../../docs/meta-factory/research-patches/2026-06-11-fqa-b-tool-bootstrapping.md)).
> **Target layers (FIXED, lexicographic exec order):** `05-mcp` · `10-skills` · `15-companions-stack` · `20-agents` · `30-templates` · `40-configs` · `50-hooks` · `60-ci` · `70-deps`. Plus **entry** (thin dispatcher: preflight, flag-parse, stack-pick), **lib** (`setup.d/lib.sh` — safe-helpers), and a proposed post-70 **finalize** tail (S0 recommendation — see O3).

---

## (a) Step → layer table

Walked in source order (the order S1 reads). Each row cites a real `install.sh:line` range. `→ entry`/`→ lib` = does **not** move to a numbered layer. **MIXED** sections are split at the sub-step boundary, not the header (see O6).

### Entry / preflight / lib (L1–655 — everything before §1)

| install.sh step | Lines | Target | Cross-layer deps | Notes |
|---|---|---|---|---|
| shebang · usage doc · `set -euo pipefail` | 1–33 | **entry** | — | dispatcher preamble |
| `PKG_ROOT` / `PROJECT_ROOT` resolution | 35–36 | **entry** | — | both must be in dispatcher scope, visible to every sourced layer (O8) |
| `UPSTREAM_BLOB_URL` + `transform_internal_refs()` | 38–57 | **lib** | — | consumed by 10-skills (`copy_skill_with_transform`) |
| **lib-only guard** (`INSTALL_SH_LIB_ONLY=1 → return 0`) | 59–66 | **lib** | — | **O1 — the guard problem:** returns at L65 BEFORE `copy_safe`/`mkdir_safe`/`chmod_safe` are defined (L201/380/389). S1 must rebuild it so all safe-helpers are unit-testable. `engine.sh:45` is the correct model (guard at END). |
| flag parse (`STACK/FORCE/DRY_RUN/FULL/WIRE_CI/REFRESH`) + `SKIPPED=()` | 68–85 | **entry** | — | `SKIPPED` is shared global state → hoist to dispatcher scope (O2) |
| refuse-install-into-self | 87–92 | **entry** | — | preflight |
| SHIPPED_DOCS Authoritative-for header verify | 94–152 | **entry** | — | preflight; author-side fail-loud; runs in `--dry-run` too |
| `package.json` existence check | 154–163 | **entry** | — | preflight |
| `--refresh` stack auto-detect | 165–174 | **entry** | — | |
| interactive stack picker | 176–187 | **entry** | — | explicitly "stays in entry" per kickoff §4; S4 removes interactivity on `-y` |
| stack validation + banner | 189–198 | **entry** | — | |
| `copy_safe` / `refresh_safe` | 200–251 | **lib** | — | core deploy primitives |
| `merge_prettierignore` (+ markers) | 253–327 | **lib** | — | consumed by 40-configs (§5) |
| `_prettierignore_in_skipped` + `ignore_shipped_configs` (+ markers) | 329–377 | **lib** (def) | reads `SKIPPED` | **CALL is at L1541 → finalize** (O3); def is lib, invocation is post-all-layers |
| `mkdir_safe` / `chmod_safe` | 379–394 | **lib** | — | |
| `detect_pm` | 396–416 | **lib** | — | SSOT detector; consumed by 40-configs (stryker patch) + 70-deps |
| `patch_stryker_package_manager` | 418–450 | **lib** (def) | `detect_pm` | CALLED in 40-configs (§6, L1005/1017) right after stryker copy (O9) |
| `copy_skill_with_transform` / `refresh_skill_with_transform` | 452–512 | **lib** | `transform_internal_refs` | consumed by 10-skills |
| `do_refresh()` | 514–649 | **entry** (dispatcher) | re-implements 10/20/30/40/50 | **O4 — duplication:** mirrors layers with `refresh_safe` semantics; S1 sync risk |
| `--refresh` early-exit dispatch | 651–655 | **entry** | — | |

### Pipeline (L657–1586)

| install.sh § (step) | Lines | Target | Cross-layer deps | Notes |
|---|---|---|---|---|
| **§1 Skills** — rules-as-tests, tool-bootstrapping, pipeline/dispatcher/aif-doctor/template-audit, aif-doctor heal helpers | 657–713 | **10-skills** | lib (`copy_skill_with_transform`) | inline skip-logic appends `SKIPPED` (L661/675) |
| **§1b Hooks** — `deps-hash-check.sh` copy + `settings.json` UserPromptSubmit registration | 715–745 | **50-hooks** | lib | CC hook (≠ git hook); detector for the tool-bootstrap deps-hash cycle whose state file is seeded in 30-templates (§3, L782–788) — runtime coupling, not install-order |
| **§2 Sub-agents** — `agents/*.md` → `.claude/agents/` (skips 2 authoring-only probers) | 747–768 | **20-agents** | lib | |
| **§3a** .ai-factory mkdir + DESCRIPTION/ARCHITECTURE/RULES/integration-rules | 770–781 | **30-templates** | lib | L776 `mkdir .ai-factory/orchestrator-prompts` = /pipeline backlog home (10-skills concern, structural seed → kept with 30) |
| **§3b** `tool-decisions.md` seed (FQA-B P1 fix) | 782–788 | **30-templates** | lib | **CONCERN = tool-bootstrap (S3 / 15).** Mechanically a `copy_safe template → .ai-factory/` (identical in kind to §3a) → placed in 30-templates; flagged for S3 (O7). DN-1 = Option B `<pending>` sentinel already shipped |
| **§3c** skill-context overrides loop (aif-review/aif-rules-check/aif-orchestrator-discipline) | 790–803 | **20-agents** | reads SHIPPED_DOCS array (entry) | AIF-native sub-agent extension (SSOT #50); agent-adjacent |
| **§3d** react-next ARCHITECTURE/RULES + aif-handoff integration echo | 806–814 | **30-templates** | lib | stack-gated |
| **§4 Scripts** — audit-ai-docs, audit-r4, check-rule-globs, check-rule-enforced, detect-r2-boundary, r2-na-marker, check-arch-boundaries, check-lintstaged-resolves (+react-next audit) | 816–856 | **40-configs** | lib | enforcement-script payloads; consumed by 60-ci wiring + the `validate` script merged in 70-deps. (Alt home = a scripts concern, but no such layer in the fixed set.) |
| **§5a** .nvmrc · .lintstagedrc.json · per-package lintstagedrc stubs · .prettierignore merge · .prettierrc · tsconfig.json | 858–890 | **40-configs** | lib (`merge_prettierignore`) | |
| **§5b** AGENTS.md (`.template` → AGENTS.md) | 891 | **30-templates** | lib | consumer-edited template (Next-steps step 3); agent-doc but template-shaped |
| **§5c** .husky/ + pre-commit + pre-push + pre-push.fallback.sh + TS-core hooks (pre-push.ts + closure) + hooks-package.json + chmod + **core.hooksPath activation** | 892–936 | **50-hooks** | lib | git-hook cluster; `core.hooksPath` activation (L925–936) is the arming step |
| **§5b' Custom ESLint rules** — eslint-rules-local copy + **barrel generation** | 938–992 | **40-configs** | lib | barrel (L966–992) reads the copied rule files → intra-layer order: copy-then-generate (O9) |
| **§6a** stack configs: eslint.config · vitest.config · dependency-cruiser · stryker (+`patch_stryker_package_manager`) · (react: playwright) | 994–1021 (config subset) | **40-configs** | lib (`patch_stryker`, `detect_pm`) | **MIXED §6** — split from workflows below |
| **§6b** `.github/workflows/` mkdir + ci.yml + workflow-integrity.yml (both stacks) | 996, 1006–1008, 1018–1020 | **60-ci** | — | CI workflow files |
| **§6b nvmrc↔CI drift WARN** | 1023–1046 | **60-ci** | reads .nvmrc (40) + workflows (60) | non-destructive WARN |
| **§6b-bis R2 auto-wire Layer 1** — classify repo, patch ROOT eslint.config.mjs OR record R2 N/A | 1048–1107 | **60-ci** | reads eslint.config.mjs (40); writes tool-decisions.md (30); sources detect-r2-boundary from **PKG_ROOT** (O8) | **sets `_r2_verdict` (global, read at L1483)** (O2) |
| **§6c CI-orphan WARN + auto-wire** — `_aif_gate_check`/`_aif_detect_gates`/`_aif_yq_wire`, yq install offer, WARN/paste-block | 1109–1254 | **60-ci** | reads workflows (60) | **the AST-wire the kickoff flags (~1121–1156)**; `unset -f` at L1253 |
| **§7 package.json scripts** — canonical scripts merge + hook-devDeps merge + arch:check target resolution | 1256–1338 | **70-deps** | lib (`detect_pm`-adjacent) | declares devDeps (husky/lint-staged/sort-package-json) that §8 installs — declare-before-install, both in 70 |
| **§8 dev-dependency install** — CORE/REACT DEVDEPS, prompt/`--full` gate, pnpm/yarn/npm | 1340–1418 | **70-deps** | lib (`detect_pm`) | **sets `DEPS_INSTALLED` (L1412, read at L1566); `DEVDEPS` (L1365, read at L1579)** (O2) |
| **§8b tsx-at-root** — probe + install tsx so pre-push TS hook resolves | 1420–1475 | **70-deps** | lib (`detect_pm`) | REDUCED-mode honesty WARN |
| **§6b-bis-L2 R2 AST-wire Layer 2** — wire R2 into per-package eslint configs via ts-morph | 1477–1521 | **finalize** (post-70) | **needs ts-morph from 70-deps**; reads `_r2_verdict` (60) | **O3 — 60-ci CONCERN but 70-deps-gated** → cannot live in a 60 layer that precedes 70 |
| **cih-s3 V2 otel-arming WARN** — @opentelemetry/* vs AIF_STRICT_RUNTIME | 1523–1537 | **finalize** (post-70) | — | independent grep; positioned in the post-70 tail (60-ci concern: R7/R8 arming) |
| **`ignore_shipped_configs` CALL** | 1539–1541 | **finalize** | **reads complete `SKIPPED` (all layers)** | **O3 — must run after EVERY copy_safe** |
| **Done / summary** — SKIPPED summary, completion banner, Next-steps | 1543–1586 | **finalize** / entry | reads `SKIPPED`, `DEPS_INSTALLED` (70), `DEVDEPS` (70), `detect_pm` (lib) | |

**Census check:** lines 1–1586 fully accounted for; no unassigned section, no missed inline closure (cold-QA below).

### NEW layers — no install.sh source (O7)

| Layer | install.sh rows | Provenance / who populates |
|---|---|---|
| **05-mcp** | **none** (net-new) | S2 builds it. context7 → `.mcp.json` (per-project, regression L1) + stack MCP + user-scope DeepWiki (detect-first). **Prior art:** legacy `setup.sh:289–307` context7 `.mcp.json` jq-merge (FQA-B §Probe 2/3). Runs EARLY, before 70-deps (kickoff Q1: reads `package.json`, not `node_modules`). |
| **15-companions-stack** | **none** (sourced from `setup`, not install.sh) | S3. Source = `setup` wrapper companion loop (`setup:24–34`) + `setup.d/engine.sh` (`companion_step`) + `setup.d/companions.manifest`, extended with a **stack column**. Tool-bootstrap revival (deps-hash cycle, SKILL context7 contract fix) is the S3 concern that *reads* the §3b `tool-decisions.md` seed. **No AIF stack-mapping** (gated behind R1, kickoff §9). |

---

## (b) Layer-dependency list (execution order)

Lexicographic exec order with the binding **must-run-before** constraints:

```text
entry/preflight  (refuse-self, header-verify, pkg.json check, stack pick, flag parse)
  │  hoists shared globals: SKIPPED, _r2_verdict, DEPS_INSTALLED, DEVDEPS, PKG_ROOT, PROJECT_ROOT, FLAGS
  ▼
05-mcp            ─ independent (reads package.json for stack; NO node_modules dep) ── Q1: before 70
10-skills         ─ independent
15-companions     ─ independent (companions install via own installers; detect-first)
20-agents         ─ independent (skill-context loop reads SHIPPED_DOCS from entry)
30-templates      ─ independent (file deploys); §3b tool-decisions seed read at runtime by 50-hooks' deps-hash hook
40-configs        ─ intra-layer order: rule-files→barrel (§5b'); stryker copy→patch (§6a)
50-hooks          ─ independent for content (git hooks + CC hook + hooksPath arming)
60-ci             ─ DEPENDS ON 40-configs: reads eslint.config.mjs (R2-L1), .nvmrc (drift WARN), workflows
70-deps           ─ §7 declare-devDeps → §8 install → §8b tsx; needs package.json
  ▼
finalize (post-70)─ R2-L2 AST-wire (needs ts-morph from 70) · V2 otel-WARN · ignore_shipped_configs
                    (needs complete SKIPPED) · SKIPPED summary · Next-steps
```

**Binding constraints (the non-negotiable edges):**
1. `40-configs` **before** `60-ci` — R2-L1 patches `eslint.config.mjs`; nvmrc-drift reads `.nvmrc`; both shipped in 40. (Satisfied: 40 < 60.)
2. `70-deps` **before** finalize — R2-L2 needs ts-morph that 70 installs.
3. finalize is **last** — `ignore_shipped_configs` reads the fully-accumulated `SKIPPED`.
4. Intra-40: rule-file copies **before** barrel-gen; stryker copy **before** `patch_stryker_package_manager`.
5. Intra-70: §7 scripts/devDeps declare **before** §8 install.
6. `05-mcp` **before** `70-deps` (Q1, fixed) — already satisfied by numeric order.

**Non-edges (reorder-safe):** every other inter-layer pair is independent — each `copy_safe` targets a distinct destination path and is skip-if-exists, so moving e.g. `50-hooks` from its monolith position (§1b, runs 2nd) to its layer position (runs 7th) does **not** change installed file content (O5).

---

## (c) Observations for S1+ (record-only; no fixes applied — T5)

- **O1 — Lib-only guard must be rebuilt.** `install.sh:64–66` returns before `copy_safe`(201)/`mkdir_safe`(380)/`chmod_safe`(389)/`refresh_safe`(231)/`detect_pm`(396) exist, so lib-only mode exposes only `transform_internal_refs`. S1's `setup.d/lib.sh` must place the `LIB_ONLY` guard **after all** safe-helper defs (model: `setup.d/engine.sh:45`, guard at end) so `tests/install-sh/*.test.sh` can source-and-unit-test them. The kickoff §4 flags this explicitly.
- **O2 — Shared global state crosses layer boundaries.** `SKIPPED` (init L85; appended in `copy_safe` L206/L463 and inline L661/L675; read by `ignore_shipped_configs` + summary L1551), `_r2_verdict` (set L1059 → read L1483), `DEPS_INSTALLED` (L1368/1412 → L1566), `DEVDEPS` (L1365 → L1579). The dispatcher must **declare/export these before sourcing layers**, and layers must be **`source`d into the dispatcher shell (not run as subshells/`bash file`)** so their mutations to `SKIPPED` persist. A subshell-per-layer model silently breaks the skipped-summary and `ignore_shipped_configs`.
- **O3 — There is a post-70 tail that breaks naive 60→70 ordering.** R2 Layer-2 AST-wire (1477–1521, ts-morph-gated) + `ignore_shipped_configs` (1541, SKIPPED-complete-gated) + V2 otel-WARN (1523–1537) must run **after** 70-deps. **Recommendation:** add a thin `99-finalize` step (or keep these in the dispatcher tail) — a position, not a new concern-layer. R2-L2 is a 60-ci *concern* executed post-deps; document the cross-reference, do not try to force it into a pre-70 layer.
- **O4 — `do_refresh()` duplicates the layer logic.** `install.sh:514–649` re-implements 10/20/30/40/50 with `refresh_safe` semantics + `.override.md` Layer-3 ownership. S1 decision: either (a) each layer file accepts a `MODE` arg (`copy`|`refresh`) and the dispatcher iterates layers twice, or (b) `do_refresh` stays a separate orchestration that must be kept in sync by hand. (a) eliminates the drift risk; (b) is lower-churn. Surface to maintainer — taste/strategy call.
- **O5 — "byte-identical" = installed filesystem, NOT stdout (self-application / T-MIF-B).** Reordering independent `copy_safe` calls is content-safe, but the console transcript **will** differ (section order, `▶` headers, and the order of paths in the "Skipped paths:" summary, since `SKIPPED` accumulates in layer order). S1's snapshot test must diff the **installed tree** (`find "$dst" -type f | sort` + per-file hash/`diff -r`), **not** captured stdout — else T-MIF-B fails on a cosmetic, not-real difference. This is the single most important framing for the S1 acceptance test.
- **O6 — MIXED sections must be cut at the sub-step, not the header.** §3 (770–814 → 30-templates + 20-agents), §5 (858–936 → 40-configs + 30-templates + 50-hooks), §6 (994–1021 → 40-configs + 60-ci). The header comments are not the layer boundary.
- **O7 — NEW layers carry no install.sh rows.** 05-mcp is net-new (S2; prior art = legacy `setup.sh:289–307`); 15-companions-stack is sourced from `setup`+manifest (S3), not install.sh. The §3b `tool-decisions.md` seed is mechanically a 30-templates deploy but is the **S3 tool-bootstrap concern** — S3 owns reviving the deps-hash cycle that reads it. T-MIF-C reminder: S2 must verify `mcp__context7__*` actually resolves post-install, not just that `.mcp.json` gained a line.
- **O8 — Keep `PKG_ROOT` (payload source) and `PROJECT_ROOT` (install target) distinct after extraction.** Both must live in dispatcher scope. Note: the R2 auto-wire sources `detect-r2-boundary.sh` from **`$PKG_ROOT`** (L1058), not the installed `scripts/` copy — layer files inherit this distinction.
- **O9 — Preserve intra-layer ordering** within 40-configs (rule-files→barrel; stryker→patch) and 70-deps (declare→install). These are real data dependencies, not cosmetic.
- **O10 — (observed, out of scope) 70-deps is the heaviest layer** — §7+§8+§8b each re-`detect_pm` and re-probe; idempotent, no fix needed. Recorded per T5 (not bundling a fix).

---

## Self-application (T15) & cold-QA (T19)

- **T15 — does the split respect the byte-identical invariant S1 must prove?** Yes for **installed filesystem state**, conditional on O1 (guard), O2 (hoisted shared globals via `source` model), O3 (post-70 finalize preserved), O9 (intra-layer order). **No for stdout** — and that is the load-bearing self-application finding (O5): the S0 blueprint itself must tell S1 to scope the byte-identical test to the tree, not the transcript, or the modularization's own acceptance gate would false-fail. The blueprint applies its own discipline to its own acceptance criterion.
- **T16 — pattern-matching-on-name avoided:** `15-companions-stack` is NOT install.sh's job (it's `setup`+manifest); `05-mcp`'s "return context7" is verified-needed via FQA-B (installed nowhere today), not assumed. The §3b tool-decisions seed is named a 30-templates *deploy* but tagged with its true *concern* (S3) rather than collapsing the two.
- **T19 — adversarial re-read of the table against install.sh:** every `# ─── N. ───` header (census: 94,200,651,657,715,747,770,816,858,938,994,1023,1048,1109,1256,1340,1420,1477,1523,1543) has a row; every inline closure with cross-layer effect (`patch_stryker` call, barrel-gen, `_aif_yq_wire`, R2-L1/L2, `ignore_shipped_configs` call, core.hooksPath activation, settings.json registration) is individually rowed; no `# ───` section and no global-state mutation site is unassigned. The `do_refresh` parallel path (514–649) is explicitly rowed (not silently dropped). Cold-QA found one initial gap (V2 otel-WARN 1523–1537) which was unassigned in the first pass and is now placed in finalize.

---

## (d) Coverage statement (honest)

- **Line ranges walked:** `install.sh` 1–1586 **in full** (3 reads: 1–802, 803–1222, 1223–1586) — every line read, not sampled (T10 census over T1 floor). `setup` 1–48 full; `setup.d/engine.sh` 1–47 full; `setup.d/companions.manifest` 1–7 full; `setup.d/bridge-guided.sh` 1–49 full. FQA-B patch read in full for the S3-narrowing + 05-mcp prior-art evidence.
- **Citations:** every step→layer row carries a verified `install.sh:line` range; the load-bearing claims (lib-only guard precedence, AST-wire fn lines, shared-global set/read sites, `ignore_shipped_configs` call site, § census) were re-verified by `grep -n` (commands run this session) — zero prose-only mappings (T3).
- **What S0 did NOT do (scope fence, T5):** moved no code; created/edited only this one file; applied no fix from O1–O10 (each is a record for S1+). No PR/branch/drive-by.
- **Confidence:** high on the install.sh census + ordering edges (mechanically grepped + full read). Medium-and-flagged on the two judgment calls handed to S1/maintainer: §3b tool-decisions placement (30 mechanically vs 15 by-concern — O7) and `do_refresh` strategy (O4). Both surfaced as decisions, not silently chosen.
- **Calibration:** first pass over this surface; one self-caught omission in cold-QA (V2 otel-WARN). The post-70 finalize tail (O3) is the highest-risk item for S1 to get wrong and is called out three times (table, dep-list, O3).

<!-- host-verify: none — S0 is RESEARCH ONLY (own header: the layer-boundary table, no code moved) — the executable stages s1-s5 carry the contracts -->
