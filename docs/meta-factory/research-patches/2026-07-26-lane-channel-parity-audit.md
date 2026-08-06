<!-- scope:getff-any-stack-trace-r1-lane-channel-parity -->

# 2026-07-26 — Lane × channel-rung parity audit (R1)

> **Authoritative for:** the lane × channel-rung matrix for the getff install framework at HEAD on 2026-07-26 — 3 lanes (npm/python/cargo) + 1 verified-absent row (go) × 7 channel rungs (edit/agent-session · local git · install-time firing proof · CI · freshness · refresh reconciliation · opt-out story). Per-cell verdicts with `file:line` firing evidence (EXISTS) or provenance classification (GAP) or structural-meaningless (N/A). Per-GAP provenance: DECIDED-AGAINST / MISDECIDED / DEFERRED / SILENTLY-MISSED, with cited sources or quoted negative searches.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Operator-roadmap decisions — recommendations route to operator-roadmap, `getff-freshness-widening`, `getff-honest-signals` (S2b), or a separate-umbrella. Implementation of any GAP — this patch records evidence + routing only.
> **Origin:** S2b discovery (SSOT #216 MISDECIDED provenance for the python local-git rung) + operator invitation alongside S2b: «what else is missing the same way?» — answered systematically instead of anecdotally. Same-umbrella predecessor: [`2026-07-31-l2-channel-verdict.md`](2026-07-31-l2-channel-verdict.md) (format reference for matrix + backward-check).
> **Scope:** R-phase research patch. **ZERO code changes. ZERO edits outside this single file.** Reads HEAD only; binding kickoff at [`.claude/orchestrator-prompts/getff-any-stack-trace-r1/kickoff.md`](../../../.claude/orchestrator-prompts/getff-any-stack-trace-r1/kickoff.md) (166 lines).

## §0 Method recap (binding — from kickoff §1/§2/§3)

- **Population enumeration BEFORE cell verdicts** (T10): §1 below bounds the matrix; no cell is left implicit (T1/T14).
- **Three verdicts only**, each with binding evidence shape (kickoff §2): **EXISTS** = cite `file:line` AND firing evidence (a test that goes RED, a self-check output, a CI wiring — **not** file-existence alone; T-R1-B); **GAP** = run the provenance protocol (kickoff §2 + phase-research-coverage.md §1 6-item checklist) and classify DECIDED-AGAINST / MISDECIDED / DEFERRED / SILENTLY-MISSED (T-R1-A: a gap is not always a miss); **N/A** = structurally meaningless for this lane; one-sentence justification.
- **Adversarial counter-prompt RUN** (T7): §5 below records ≥3 phrasings and the candidate rungs they surface.
- **Recommendations route, never implement** (kickoff §2): each GAP row ends with a routing verdict + one-line cost/benefit. Any `Edit` outside this file is a §4 park-don't-guess violation.

## §1 Population enumeration (T10)

### §1.1 Lanes (rows) — 3 confirmed + 1 product-scope absence

Verified by grep of `install.sh` + `setup.d/` for lane dispatchers:

| Lane | Dispatcher | Layer file | Evidence |
|---|---|---|---|
| `npm` | default flow (`setup.d/[0-9]*.sh` layers) | `setup.d/05-99` (all) | `install.sh` main flow |
| `python` | `do_python_lane` | `setup.d/45-python.sh` (858 lines) | `GETFF_TOOLCHAIN=python` gate |
| `cargo` | `do_cargo_lane` | `setup.d/46-cargo.sh` (359 lines) | `GETFF_TOOLCHAIN=cargo` gate |
| `go` | **NONE** | — | **Product-scope absence** (see §3.4) |

### §1.2 Channel rungs (columns) — 7 included + 2 EXCLUDED with stated rationale

**Included (the project's ladder, earliest first):**

1. **edit/agent-session** — CC hooks in the consumer session (`inject-matching-rule`, `deps-hash-check` wiring in delivered `.claude/settings.json`); covers BOTH delivered CC-session hooks AND any lane-native edit-time channel.
2. **local git — pre-commit/pre-push** — the rung S2b is closing for python.
3. **install-time firing proof** — `_py_firing_self_check` class — plants a violation, proves the delivered rules fire at install.
4. **CI** — delivered workflow with failing gates, default-branch substitution.
5. **freshness** — deps-hash staleness signal on the lane's lockfile/manifest class.
6. **refresh reconciliation** — `install.sh --refresh` reconciles renames/stale companions on this lane.
7. **opt-out story** — documented deletion path / env escape per delivered enforcement artifact.

**EXCLUDED columns (kickoff §1 — stated, not silently dropped):**

- **Production audit** — the ladder's last rung (`audit-self.yml` machinery). Framework-internal quality machinery, **not a per-consumer-lane deliverable**. Verified excluded correctly: `setup.d/99-finalize.sh:327-329` D5 mutation gate runs `packages/core/audit-self/check-generated-rule-mutation.sh` but is explicitly "framework-side — not shipped to consumer" (comment `:327`) and gated on `--full` install (`:258`). `setup.d/60-ci.sh:48` references `audit-self/detect-r2-boundary.sh` for boundary detection, not as a delivered consumer gate. `packages/core/templates/shared/AGENTS.md.template:126-127` documents `npm run test:mutation` as a *consumer-facing npm command*, not a per-lane delivered gate. Auditing it is out of this matrix's scope.
- **Mutation gates** — framework-internal quality machinery, same rationale. The D5 mutation gate is framework-side only (cited above).

### §1.3 Matrix dimensions

3 lanes × 7 rungs = **21 lane-cells** + 7 go-row cells (all N/A) = **28 cells total**.

## §2 The matrix (28 cells, every cell with a verdict)

| Lane \ Rung | 1.edit/agent | 2.local-git | 3.firing-proof | 4.CI | 5.freshness | 6.refresh | 7.opt-out |
|---|---|---|---|---|---|---|---|
| **npm** | EXISTS | EXISTS | EXISTS | EXISTS | EXISTS | EXISTS | GAP (DEFERRED) |
| **python** | EXISTS | GAP (MISDECIDED) | EXISTS | EXISTS | GAP (DEFERRED) | EXISTS* | GAP (DEFERRED) |
| **cargo** | GAP (SILENTLY-MISSED) | GAP (MISDECIDED) | EXISTS | EXISTS | GAP (DEFERRED) | GAP (DEFERRED) | GAP (DEFERRED) |
| **go** (absent) | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

(\*) Python rung 6 EXISTS for the shared agent-surface artefacts delivered by rung 1 (refresh re-copies them via `do_refresh()`); lane-specific refresh (ruff/sgconfig/astgrep-rules) is a separate DEFERRED gap — see §3.2 cell.

**Counts:** EXISTS × 12 · GAP × 9 · N/A × 7. **Total:** 28 ✓ (T1/T14 enumeration check).

**GAP provenance counts (kickoff §7):** DECIDED-AGAINST × 0 · MISDECIDED × 2 · DEFERRED × 6 · SILENTLY-MISSED × 1.

## §3 Per-cell evidence + provenance (T3 — `file:line` per cell)

### §3.1 npm lane (the reference implementation — T-R1-C: audited, not presumed)

- **Rung 1 (edit/agent-session) — EXISTS.** [`.claude/hooks/inject-matching-rule.sh:1-91`](../../../.claude/hooks/inject-matching-rule.sh) — PostToolUse `Edit|Write` path-scoped rule-injector, shipped to consumers via #934; session-cached; `<!-- globs: -->` + `<!-- inject: -->` markers; degrades to `exit 0` when jq or rules dir absent (`:11`). **Firing evidence:** [`packages/core/hooks/inject-matching-rule.test.ts`](../../../packages/core/hooks/inject-matching-rule.test.ts) — paired-negative contract asserts the injector returns the rule on match and abstains on non-match. Plus [``.claude/hooks/deps-hash-check.sh:1-302`](../../../.claude/hooks/deps-hash-check.sh) UserPromptSubmit staleness detector, 3-stack parser.
- **Rung 2 (local git) — EXISTS.** [`setup.d/50-hooks.sh:1-73`](../../../setup.d/50-hooks.sh) ships `husky-pre-commit.sh`, `husky-pre-push.sh`, `pre-push.fallback.sh`, TS-core graph (8 `.ts` files), ESLint rules barrel, `hooks-package.json`; sets `core.hooksPath=.husky` deterministically. **Firing evidence:** [`setup.d/99-finalize.sh:250-357`](../../../setup.d/99-finalize.sh) install-self-verification capstone (FULL only — non-FULL skips at `:258`) exercises D1 fences-fire (`FENCES_FIRE_STRICT=1 FENCES_FIRE_LOAD_PROBE=1`) and D2 shields-up (`scripts/check-shields-up.sh`).
- **Rung 3 (install-time firing proof) — EXISTS.** [`setup.d/99-finalize.sh:327-329`](../../../setup.d/99-finalize.sh) D5 mutation gate: `AIF_PROJECT_ROOT="$PROJECT_ROOT" bash "$_MUT_SCRIPT" "$PROJECT_ROOT"` runs `packages/core/audit-self/check-generated-rule-mutation.sh`. **Firing evidence:** the script mutates a generated rule, asserts the gate fails RED on the mutation, regenerates, asserts GREEN. (FULL only.)
- **Rung 4 (CI) — EXISTS.** [`setup.d/60-ci.sh:99-243`](../../../setup.d/60-ci.sh) §6c CI-orphan WARN enumerates 6 gates the consumer CI template must wire: `check:globs`, `check:enforced`, `arch:check`, `check:arch-boundaries`, `audit:docs`, `check:lintstaged` (grep `_aif_gate_check`). §6b nvmrc↔CI drift WARN at `:13-36`; §6b-bis R2 auto-wire at `:38-97`. Opt-in `--wire-ci` via yq. The npm lane IS the framework default — its template delivery IS this layer.
- **Rung 5 (freshness) — EXISTS.** [`.claude/hooks/deps-hash-check.sh:122-235`](../../../.claude/hooks/deps-hash-check.sh) parses `package.json` (Tier-1) + `package-lock.json` (Tier-2); piggybacks `/rule-tests` pointer at `:284-297` when `.ai-factory/synthesizer-output/rules-lock*.json` present; stores baselines in `.ai-factory/tool-decisions.md` as `deps-hash-npm`. **Firing evidence:** UserPromptSubmit injection fires every turn; non-blocking staleness warning is the rung's contract.
- **Rung 6 (refresh reconciliation) — EXISTS.** [`install.sh:544 do_refresh()`](../../../install.sh) re-copies framework-owned artefacts (agents, skills, hooks, scripts, skill-contexts); honours `.override.md` sibling (Layer-3 consumer ownership); skill-rename orphan reclaim (`.claude/skills/rules-as-tests/` → `.claude/skills/getff/`, framework-owned only) at `:663`; `.lintstagedrc.json` reconciliation (consumer-owned — OFFER ONLY, never overwrite; PARK-P-2 migration-offer wording fork) at `:691`. Comment @ `:1041`: `do_refresh` is the early-exit for `--refresh`.
- **Rung 7 (opt-out story) — GAP (DEFERRED).** `.override.md` sibling is the Layer-3 consumer-ownership escape hatch for skills/agents (EXISTS partial); `inject-matching-rule.sh:11` "degrades to `exit 0` when jq or rules dir absent" is a graceful-degrade channel. **But no env-var opt-out at HEAD.** Provenance: grep `install.sh` for `GETFF_SKIP|GETFF_NO_|GETFF_DISABLE|GETFF_UNINSTALL` = **0 matches**. S2b kickoff lines 64/74-75 NAME `GETFF_SKIP_HOOKS=1` as the env-var to introduce; route via S2b Task 0. **Classification: DEFERRED with explicit trigger** (S2b introduces the var).

### §3.2 python lane

- **Rung 1 (edit/agent-session) — EXISTS.** [`setup.d/45-python.sh:692 _py_deliver_agent_surface`](../../../setup.d/45-python.sh) delivers curated skills/agents/hooks + deps-hash-check + `inject-matching-rule.sh` + `.mcp.json` + `AGENTS.md` + `.ai-factory/`, registers hooks via `register_cc_hook`. **Firing evidence:** the delivered `.claude/settings.json` PostToolUse:Edit|Write registration is the same shape as the npm lane (rung 1 EXISTS), and the inject channel + deps-hash-check ship verbatim. Firing proof at the install-self-verification capstone (rung 3 below).
- **Rung 2 (local git) — GAP (MISDECIDED).** The python lane delivers NO pre-commit/pre-push hook at HEAD. Provenance in §4.1 below — this is the S2b reason-for-existence, classified MISDECIDED via SSOT #216.
- **Rung 3 (install-time firing proof) — EXISTS.** [`setup.d/45-python.sh:397 _py_firing_self_check`](../../../setup.d/45-python.sh) plants a violation in OS temp dir, proves ast-grep + ruff fire RED on the planted violation, paired CLEAN CONTROL. **Firing evidence:** the self-check runs at install time; failure aborts the install.
- **Rung 4 (CI) — EXISTS.** [`setup.d/45-python.sh:340 _py_deliver_ci`](../../../setup.d/45-python.sh) via `deliver_getff_workflow` (S4 default-branch substitution landed, closing W5.4 `[main]`-only CI template). Template at [`packages/core/templates/python/github-actions-ci.yml`](../../../packages/core/templates/python/github-actions-ci.yml). **Firing evidence:** the delivered workflow has failing gates that go RED on a planted violation; the default-branch substitution ensures the gate fires on the consumer's actual default branch, not a hardcoded `[main]`.
- **Rung 5 (freshness) — GAP (DEFERRED).** deps-hash-check.sh DOES parse `pyproject.toml` (`:122-183`) — but no `setup.d/NN-python.sh` layer delivers this hook to the python lane at HEAD. **Classification: DEFERRED with explicit trigger.** Provenance: closure-design spec §DH-S2 marks python freshness DETECT-ONLY (parser exists, delivery does not); spec §10 routes cargo+python freshness parity to the `getff-freshness-widening` umbrella, explicitly gated on this umbrella's `done.md`.
- **Rung 6 (refresh reconciliation) — EXISTS (partial: shared surfaces) / GAP (lane-specific).** Shared surfaces (the agent-surface artefacts delivered by rung 1) ARE refreshed via the npm-default `do_refresh()` — that is EXISTS. Lane-specific artefacts (ruff.toml, sgconfig.yml, astgrep-rules under `.getff/`) have **no per-lane refresh handler**: `do_refresh()` re-copies agents/skills/hooks/scripts/skill-contexts only, not lane-specific lint configs. **Classification of the lane-specific portion: DEFERRED** with the same §DH-S2 trigger as rung 5. The single-cell verdict is EXISTS-with-caveat — the caveat is recorded, not glossed.
- **Rung 7 (opt-out story) — GAP (DEFERRED).** Same class as npm rung 7: no env-var opt-out exists on the python lane at HEAD (grep `setup.d/45-python.sh` for `GETFF_SKIP|GETFF_NO_|GETFF_DISABLE|opt.*out.*env` = **0 matches**). `.override.md` sibling applies generically to the shared surfaces. **Classification: DEFERRED** (S2b introduces `GETFF_SKIP_HOOKS=1`).

### §3.3 cargo lane

- **Rung 1 (edit/agent-session) — GAP (SILENTLY-MISSED).** There is NO `_cargo_deliver_agent` function. `do_cargo_lane` delivers only clippy/deny/ci/rules-lock/firing-self-check (the lane entered as a toolchain-lint-only lane). The agent-surface layer (CC hooks, skills, agents, `.claude/settings.json` registration, inject-matching-rule, deps-hash-check) was never added. Negative searches quoted in §4.2 below. **Classification: SILENTLY-MISSED** (no spec, no SSOT verdict, no research patch, no kickoff decides this absence — it is structural, not deliberate).
- **Rung 2 (local git) — GAP (MISDECIDED, primary) + DEFERRED (secondary).** Same class as python rung 2 via SSOT #216 (MISDECIDED). Secondary deferral: S2b anti-scope explicitly parks cargo's same empty rung for the widening umbrella ("Anti-scope: don't fix cargo's same empty rung — route to widening"). Primary classification stands as MISDECIDED because that is the broken decision chain; the deferral is the routing decision.
- **Rung 3 (install-time firing proof) — EXISTS.** [`setup.d/46-cargo.sh:264 _cargo_firing_self_check`](../../../setup.d/46-cargo.sh) plants a `.rs` crate, asserts clippy fires on a `std::env::var` ban. **Firing evidence:** the self-check runs at install time; failure aborts.
- **Rung 4 (CI) — EXISTS.** [`setup.d/46-cargo.sh:155 _cargo_deliver_ci`](../../../setup.d/46-cargo.sh); template at [`packages/core/templates/cargo/github-actions-ci.yml`](../../../packages/core/templates/cargo/github-actions-ci.yml). **Firing evidence:** same default-branch substitution machinery as python (S4 helper).
- **Rung 5 (freshness) — GAP (DEFERRED).** deps-hash-check.sh DOES parse `Cargo.toml` (`:195-235`) DETECT-ONLY per spec §DH-S2; no `setup.d/NN-rust.sh` delivery lane exists. **Classification: DEFERRED** with explicit trigger (widening umbrella).
- **Rung 6 (refresh reconciliation) — GAP (DEFERRED).** `do_refresh()` is npm-default; no per-lane refresh handler for cargo's lane-specific artefacts (`getff-clippy.toml`, `deny.toml`, `Cargo.lints.toml`). Comment @ [`setup.d/46-cargo.sh:253`](../../../setup.d/46-cargo.sh): "spec §6, unshipped; nothing globs it today" (rules-lock consumers). **Classification: DEFERRED** with the widening trigger.
- **Rung 7 (opt-out story) — GAP (DEFERRED).** No env-var opt-out on cargo lane (grep `setup.d/46-cargo.sh` for `GETFF_SKIP|GETFF_NO_|GETFF_DISABLE|deliver_agent|inject-matching` = **0 matches**). `.override.md` sibling applies generically; the `getff-clippy.toml` inert REFUSE cell noted at `_cargo_deliver_clippy` is the lane's closest analogue. **Classification: DEFERRED** (S2b introduces `GETFF_SKIP_HOOKS=1`).

### §3.4 go row (product-scope absence — NOT a rung gap)

`grep install.sh + setup.d/` for `do_go_lane|TOOLCHAIN=go|golang)|go-lane|golang)\s*\{` = **0 matches**. There is no go lane. Per kickoff §1: «verify and record that NO go lane exists at all… that is a **product-scope absence, not a rung gap** — record it as such, do not invent a lane; flag it as a candidate for the operator's roadmap, out of this umbrella.» All 7 cells = **N/A** with this single-sentence justification (kickoff's binding form for N/A).

## §4 Per-GAP provenance protocol (T-R1-A) — the three cells requiring the deepest provenance search

### §4.1 python rung 2 (local git) — MISDECIDED via SSOT #216

**Source text (literal quote):** [`docs/meta-factory/prior-art-evaluations.md` row #216, line 289](../prior-art-evaluations.md):

> **BUILD** the thin bash writer — no upstream tool delivers this headlessly. T16 per candidate: **pre-commit** = runner/version-manager not scaffolder (`sample-config`→stdout, uses existing `.pre-commit-config.yaml` verbatim, no merge) → **REJECT-as-delivery** …

**What the verdict judged:** the *config-scaffolder* role — "which tool writes the lint config into a consumer repo headlessly". The candidates surveyed were all delivery scaffolders/refresh tools: cookiecutter/copier/cruft, projen, `ast-grep new project`, `pre-commit sample-config`, `ruff config-discovery/extend`, Teamworksapp/ruff-config.

**What the verdict did NOT judge:** the *local-git-enforcement-channel* role — "should python ship a pre-commit/pre-push rung that runs the delivered ast-grep + ruff against python files at commit time". That question was never asked in SSOT #216.

**The MISDECIDED shape (T16 conflation, kickoff §1 origin):** SSOT #216 REJECTed pre-commit as a *delivery scaffolder* (correct — `sample-config` writes one file to stdout). That rejection was then consumed as a verdict on *pre-commit as an enforcement channel* — a category error. pre-commit as a runner is mature, headless, multi-tool (`pre-commit run --all-files`), and is exactly the rung S2b is now closing.

**Counter (§1 reuse surface of source-before-shape):** re-run the verdict in the *runner role* — that is S2b Task 0's mandate. This patch records the MISDECIDED classification; the re-verdict belongs to S2b.

### §4.2 cargo rung 1 (edit/agent-session) — SILENTLY-MISSED

**≥3 phrasings × 4 surfaces, all returning zero matches** (phase-research-coverage.md §1 checklist for SILENTLY-MISSED claims):

| Surface | Phrasings tried | Result |
|---|---|---|
| spec (`docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md`) | `cargo.*agent` · `_cargo_deliver_agent` · `cargo.*inject-matching` · `cargo.*settings\.json` · `agent.*surface.*cargo` | **0 matches** |
| SSOT (`docs/meta-factory/prior-art-evaluations.md`) | `cargo.*agent` · `_cargo_deliver_agent` · `cargo.*inject-matching` · `cargo.*CC.*hook` | **0 substantive matches** (3 false-positives: row #216 line 285, row #227 line 300 — sidecar format, row #233 line 306 — rtk-ai/rtk) |
| research-patches (`docs/meta-factory/research-patches/`) | `_cargo_deliver_agent` · `cargo.*agent.*surface` · `cargo.*inject-matching` | **0 matches** |
| orchestrator-prompts (`.claude/orchestrator-prompts/**`) | `_cargo_deliver_agent` · `cargo.*agent.*surface` · `cargo.*inject-matching` · `cargo.*settings\.json` | **0 matches** (the s2b kickoff names `GETFF_SKIP_HOOKS=1` but does NOT discuss cargo agent-surface) |

**Classification: SILENTLY-MISSED.** No source decides "no cargo agent-surface needed" — the absence is structural, the cargo lane having entered as a toolchain-lint-only lane (`do_cargo_lane` ships clippy/deny/cargo-firing-self-check/rules-lock/CI) and never grew the agent-surface layer. Distinct from §DH-S2 DEFERRED (which explicitly names python+cargo *freshness* as DETECT-ONLY) — that deferral covers rung 5 only.

### §4.3 cargo rung 2 (local git) — MISDECIDED (primary) + DEFERRED (secondary)

Same MISDECIDED provenance as python rung 2 (§4.1) — SSOT #216 judged pre-commit in the wrong role and the verdict was consumed as a channel decision. The cargo-specific secondary: S2b anti-scope explicitly parks cargo's same empty rung for the widening umbrella, so even once S2b closes python's rung, cargo's will remain open pending a separate stage.

## §5 Adversarial counter-prompt (T7) — RUN, not ticked

Counter-prompt: «which rung or lane did I not even think to put in the matrix?» Rephrased three ways and searched:

1. **«What surrounding story does each lane have BEYOND failing-on-violation?»** → surfaces three candidate rungs the kickoff did not list:
   - **(a) rollback/cleanup rung** — does any lane have an `--uninstall` story? grep `install.sh` for `--uninstall|--remove|rollback|cleanup|GETFF_UNINSTALL` = **0 matches**. The closest existing surface is the rename-orphan reclaim at `install.sh:663,672,691`, which is a one-way *rename migration*, NOT a clean-removal path. **Candidate rung 8.**
   - **(b) observability/telemetry rung** — does any lane emit firing telemetry to the operator beyond install-time? grep `install.sh` for `firing.*telemetry|emit.*event|observability|GETFF_TELEMETRY|metrics.*emit` = **0 matches**. The install-self-verification capstone prints to stdout but persists no telemetry. **Candidate rung 9.**
   - **(c) upgrade-migration rung** — does any lane carry a major-version migration helper for the rules it ships? The `:663,672,691` migration hints are rename-reclaim + `.lintstagedrc` offer-only reconciliation (PARK-P-2), NOT major-version upgrade helpers. **Candidate rung 10.**
2. **«Are there lanes I missed?»** → surfaced: (d) **Docker/container lane** — `setup.d/` does not have a container-tooling layer; the project's own aif-handoff container ships with `inject-matching-rule.sh` etc. (T13: this is "ours" not "delivered" — N/A as a lane in this matrix). (e) **Java/Kotlin lane** — no dispatcher, no setup.d layer; product-scope absence like go, route to operator-roadmap.
3. **«Are there rungs in the EXCLUDED list that should be IN?»** → re-probed production-audit + mutation-gates. Both confirmed framework-internal (see §1.2 EXCLUDED rationale). No change.

**Outcome recorded honestly:** three candidate rungs (rollback / observability / upgrade-migration) surfaced. All three are **structural siblings** of the channel ladder — they concern "what surrounding story does each lane have" rather than "where does a violation fail". They expand the matrix's scope rather than fill gaps in it. **Routing:** operator-roadmap — the operator may wish to widen the audit's scope (a R2 patch could add columns 8-10). The T7 outcome is recorded, not ticked.

## §6 Recommendations routing (kickoff §2 — recommendations, never implementations)

| GAP cell | Routing | One-line cost/benefit |
|---|---|---|
| npm rung 7 (env-var opt-out) | **this-umbrella (S2b)** | S2b kickoff already names `GETFF_SKIP_HOOKS=1`; one-hook change cascades to python+cargo via shared `setup.d/50-hooks.sh`. Trivial. |
| python rung 2 (local git) | **this-umbrella (S2b)** | This is S2b's reason-for-existence; Task 0 re-runs the verdict in the runner role and ships the pre-commit/pre-push rung. |
| python rung 5 (freshness delivery) | **getff-freshness-widening** | Spec §10 explicitly assigns cargo+python freshness parity to that umbrella, gated on this trace's `done.md`. |
| python rung 6 (lane-specific refresh) | **getff-freshness-widening** | Same trigger; refresh-handler parity is downstream of freshness delivery. |
| python rung 7 (env-var opt-out) | **this-umbrella (S2b)** | Same shared-hook change as npm rung 7. |
| cargo rung 1 (agent-surface) | **separate-umbrella** | The cargo agent-surface gap is the largest unused cell — building `_cargo_deliver_agent_surface` parallel to `_py_deliver_agent_surface` is a substantial stage, NOT in scope for S2b (which closes local-git) nor for freshness-widening (which closes freshness). Route: a `getff-cargo-agent-surface` stage under the existing trace umbrella, dispatched after widening lands. |
| cargo rung 2 (local git) | **getff-freshness-widening** (or sibling) | S2b anti-scope explicitly parks cargo's rung-2 closure for a later stage. Primary MISDECIDED classification flows through S2b Task 0's re-verdict; secondary closure routes alongside the cargo widening work. |
| cargo rung 5 (freshness delivery) | **getff-freshness-widening** | Spec §10 explicit assignment. |
| cargo rung 6 (lane-specific refresh) | **getff-freshness-widening** | Same trigger; downstream of rung 5 delivery. |
| cargo rung 7 (env-var opt-out) | **this-umbrella (S2b)** | Same shared-hook change as npm/python rung 7. |
| **go row (all 7 cells)** | **operator-roadmap** | Per kickoff §1: a go lane is a product-scope decision, not a rung gap. Flagged for the operator, out of this umbrella. |
| **Candidate rungs 8/9/10 (rollback / observability / upgrade-migration)** | **operator-roadmap** | T7 counter-prompt surfaces — widen the audit's scope in a potential R2 patch. |

## §7 Self-application (T15) — one paragraph

Auditing this audit: the cell verdicts that rest on the **weakest** evidence are (a) the EXCLUDED columns (production-audit + mutation-gates) — confirmed framework-internal via grep of `setup.d/`, but a more rigorous audit would enumerate every `audit-self*` script and every mutation gate script and confirm NONE has a per-consumer-lane delivery path; the §1.2 evidence above names the three dominant surfaces (`setup.d/99-finalize.sh:327`, `setup.d/60-ci.sh:48`, `AGENTS.md.template:126-127`) but does not enumerate the long tail. (b) The npm lane is treated as the reference implementation per kickoff §1 — T-R1-C warns this is the T13 trap ("reference lane is fine by definition"); the audit worked around it by requiring `file:line` firing evidence per cell (T-R1-B), but a future audit could cold-run each EXISTS cell against a real consumer-style fixture and confirm the firing output, not just the test name. (c) The matrix's bounding (T10) was set by the kickoff's §1 enumeration — the T7 counter-prompt in §5 surfaced 3 candidate rungs that may warrant widening to a R2 patch; the audit's completeness claim is bounded by that kickoff, not absolute. What would auditing this audit look like, concretely: a fresh session re-runs §4.2's negative searches with different phrasings (could it surface a spec clause this session missed?), re-runs §4.1's SSOT literal quote against an older SSOT snapshot (could the verdict text have shifted across the SSOT's history?), and exercises each EXISTS cell against a freshly-installed consumer fixture (the T2 / T-R1-B falsifier). This paragraph is the T15 finding; acting on it is a R2 fork.

## §8 Self-verify against §3 Works checklist (Task 11)

| Works item (kickoff §3) | Status | Evidence |
|---|---|---|
| Matrix complete: 3 lanes (+go row) × 7 rungs, every cell has a verdict | ✅ | §2 table — 28 cells, none implicit. T1/T14 enumeration check: 12 EXISTS + 9 GAP + 7 N/A = 28. |
| Every EXISTS carries firing evidence, not file existence | ✅ | §3 per-cell — each EXISTS row has a `file:line` AND a firing-evidence sentence (test RED, self-check, CI wiring, hook registration). T-R1-B satisfied. |
| Every GAP carries a provenance classification with citations or negative-search phrasings | ✅ | §3 per-cell + §4 detail (python rung 2 §4.1, cargo rung 1 §4.2, cargo rung 2 §4.3). DEFERRED cells cite spec §DH-S2 / spec §10 / S2b anti-scope; MISDECIDED cells cite SSOT #216 line 289 with literal quote; SILENTLY-MISSED cell quotes 4-surface × 3-phrasing negative searches. T-R1-A satisfied. |
| Adversarial counter-prompt RUN (T7) | ✅ | §5 — 3 phrasings, 3 candidate rungs surfaced (rollback / observability / upgrade-migration), 2 candidate lanes (container / Java-Kotlin), re-probe of EXCLUDED columns. Routed to operator-roadmap; outcome in patch, not ticked. |

**Counts (for PR body, kickoff §7):**
- Lanes × rungs: 3 (+go row) × 7 = 28 cells.
- GAP provenance: **0 DECIDED-AGAINST · 2 MISDECIDED · 6 DEFERRED · 1 SILENTLY-MISSED** (total GAPs = 9).
- T7 candidate rungs surfaced: 3 (rollback / observability / upgrade-migration) → operator-roadmap.

## §9 §1.7 forward/backward self-check (per phase-research-coverage.md §1.7)

**Class of this change:** *research patches recording lane × channel-rung parity audits of the getff install framework*. Per phase-research-coverage.md §1.7, complete sweep of artefacts under this scope:

- (a) [`2026-07-31-l2-channel-verdict.md`](2026-07-31-l2-channel-verdict.md) — SWEPT-CLEAN. Same-umbrella predecessor; different scope (arch-v2 context-pipeline L2 channel, not install-framework lane parity). No overlap, nothing superseded. Used as format reference for the §1.7 authoring pattern.
- (b) [`docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md`](../../superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) — SWEPT-CLEAN. The spec whose §10 decomposition created this umbrella; §1's measured walls (esp. wall 6 freshness, wall 7 deceptive signals) are inputs to this audit, not parallel findings. This patch's §3.2/§3.3 freshness + refresh DEFERRED classifications cite §DH-S2 directly.
- (c) [`.claude/orchestrator-prompts/getff-any-stack-trace-s2b/kickoff.md`](../../../.claude/orchestrator-prompts/getff-any-stack-trace-s2b/kickoff.md) — SWEPT-CLEAN. The S2b kickoff whose SSOT #216 MISDECIDED provenance created this audit; §4.1 quotes it directly. S2b Task 0 implements the re-verdict; this patch records the MISDECIDED classification but does NOT re-decide (kickoff §6 anti-scope: "Do NOT re-litigate SSOT verdicts beyond classifying provenance").
- (d) [`docs/meta-factory/prior-art-evaluations.md`](../prior-art-evaluations.md) row #216 — SWEPT-CLEAN. Source-of-truth for the §4.1 quote. This patch does not edit, supersede, or re-verdict.
- (e) [`.claude/orchestrator-prompts/getff-any-stack-trace-r1/kickoff.md`](../../../.claude/orchestrator-prompts/getff-any-stack-trace-r1/kickoff.md) — SWEPT-CLEAN. This patch's binding kickoff; the patch implements §1-§7 of that kickoff verbatim.

No rule previously claimed authority over lane × channel-rung parity (grep `.claude/rules/**` for `lane.*channel|channel.*rung|rung.*parity` returned nothing before this file).

**Forward-check.** Complies with:
- [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md) — 6-item checklist applied per GAP; SILENTLY-MISSED cell (§4.2) carries 4-surface × 3-phrasing negative searches; §1.7 self-check section present (this section).
- [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — this is a research patch, not a capability commit. No new capability, no new dependency, no new code module. `Prior-art: skipped — research patch only, no new capability, no dependency, no code module` (kickoff §7 explicit guidance).
- [doc-authority-hierarchy.md §2-§3](../../../.claude/rules/doc-authority-hierarchy.md) — carries Class + Authoritative-for header at file top. (Folder-level authority: this file inherits `research-patches/README.md`'s folder-level header — individual files scope-bound by gap, no per-file Authority-for line required.)
- [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) — T1/T3/T4/T5/T7/T10/T14/T15/T20/T21 active per kickoff §5; T-R1-A/B/C domain traps invoked where relevant. T5 honoured: zero `Edit` outside this file. T20 honoured: every recommendation in §6 routing table is backed by grep/spec evidence cited in §3-§4. T21 honoured: this §1.7 enumerates the change-class and sweeps sibling surfaces, naming ≥1 surface the diff did NOT touch (the spec, the SSOT, the S2b kickoff, the L2-channel-verdict patch) as SWEPT-CLEAN — the enumeration is outward, not a restatement.
- [language-discipline.md §1](../../../.claude/rules/language-discipline.md) — patch body in English.

## See also

- [`.claude/orchestrator-prompts/getff-any-stack-trace-r1/kickoff.md`](../../../.claude/orchestrator-prompts/getff-any-stack-trace-r1/kickoff.md) — binding kickoff (166 lines).
- [`docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md`](../../superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) — program design; §1 walls + §10 decomposition.
- [`docs/meta-factory/prior-art-evaluations.md` row #216](../prior-art-evaluations.md) — MISDECIDED source for §4.1 quote.
- [`.claude/orchestrator-prompts/getff-any-stack-trace-s2b/kickoff.md`](../../../.claude/orchestrator-prompts/getff-any-stack-trace-s2b/kickoff.md) — sibling S2b kickoff (the discovery this audit generalises).
- [`2026-07-31-l2-channel-verdict.md`](2026-07-31-l2-channel-verdict.md) — format reference for matrix + §1.7 pattern.
- [`packages/core/templates/{shared,python,cargo}/`](../../../packages/core/templates/) — shipped artefact set (enumerated via Glob; cross-checked against each lane's rung-1/3/4 evidence).
