<!-- scope:zcode-parity-s2-mech2-alt -->
# ZCode parity Stage 2 — Mech-2 alternative research (4 forks analyzed, parked)

**Date:** 2026-07-18
**Umbrella:** `zcode-full-parity-mega-umbrella` Stage 2 (`.claude/orchestrator-prompts/zcode-full-parity-mega-umbrella/kickoff.md §2 Stage 2`).
**Branch:** `feature/zcode-parity-s2-mech2-alt-a6b345`.
**Type:** R-phase, brainstorm-first. **PARKS the strategic fork — does NOT decide.**
**Operator decision needed:** which of Fork 2A / 2B / 2C / 2D to ADOPT.

---

## §0 Why this stage exists (step-1 dropped Mechanism 2)

Stage 1 (PR #1031, `2026-07-18-zcode-parity-step1.md §"Mechanism 2 — REJECTED"`) dropped auto-derivation of plugin twins because it conflicted with the SSOT at `scripts/render-harness-config.mjs:326-334`:

> *"COVERAGE: a hook works on ZCode ONLY if it has a plugin sibling (T-PLUG-A real copy under `plugin/hooks/<name>`). The sibling scripts are **hand-maintained** (precedent: session-start, inject-matching-rule); this emitter renders only the wiring JSON. drift-gated by harness-config-drift.test.ts; hook-paths.test.sh gate (a-g) enforces sibling discipline."*

Stage 1 left an open question: hand-maintaining 14 twins is error-prone — is there a middle ground that respects the SSOT?

This patch analyzes 4 forks, gives a technical recommendation per fork, and **parks the strategic pick for the operator**.

---

## §1 Evidence base (verified Mode A — direct file inspection)

### Twin population (14 twins + 1 helper under `plugin/hooks/`)

| Twin | Source diverges? | Diff lines vs `.claude/hooks/<name>.sh` | Divergence shape |
|---|---|---|---|
| `ask-question-reminder` | no | 0 | byte-identical |
| `deps-hash-check` | no | 0 | byte-identical |
| `end-of-turn-reminder` | no | 0 | byte-identical (T-ZP-A from step-1) |
| `inject-memory-codification` | no | 0 | byte-identical |
| `inject-session-bootstrap` | no | 0 | byte-identical |
| `check-doc-authority` | yes | 4 | env-first REPO_ROOT rewrite only |
| `check-hook-marker` | yes | 4 | env-first REPO_ROOT rewrite only |
| `check-kickoff-traps` | yes | 4 | env-first REPO_ROOT rewrite only |
| `check-worker-dispatch-channel` | yes | 4 | env-first REPO_ROOT rewrite only |
| `inject-matching-rule` | yes | 52 | var rename `REPO_ROOT`→`PROJECT_DIR` + 15-line T-PLUG-A relocation comment + comment-block rewrite |
| `validate-prompt` | yes | 6 | env-first REPO_ROOT + ADDED consumer-guard `[[ ! -f "$VALIDATOR" ]] && exit 0` (`plugin/hooks/validate-prompt:23`) |
| `inject-subagent-context` | yes | 9 | `.sh` suffix removed from sibling-call + 4-line TWIN DIVERGENCE comment (`plugin/hooks/inject-subagent-context:29-32`) |
| `runtime-bridge-dispatch` | yes | 5 | `SCRIPT_DIR` intermediate dropped entirely + env-first |
| `session-start` | n/a | — | plugin-intrinsic — no `.claude/hooks/` source |

Totals: **5 byte-identical, 4 trivial env-first rewrites, 4 semantically divergent, 1 plugin-intrinsic** (14 twins). Diff sizes via `diff .claude/hooks/<name>.sh plugin/hooks/<name> | wc -l`, 2026-07-18.

### Trio inline adoption (`_is_zcode` / `_emit_ctx` / `_adv_violation`)

Verified via `grep -c` across `plugin/hooks/*` (excludes `_zcode-emit`, `run-hook.cmd`, `*.json`, `*.md`):

| Twin | `_is_zcode()` | `_emit_ctx()` | `_adv_violation()` |
|---|---|---|---|
| check-doc-authority | 1 | 1 | 0 |
| check-hook-marker | 1 | 1 | 1 |
| check-kickoff-traps | 1 | 1 | 1 |
| check-worker-dispatch-channel | 1 | 1 | 0 |
| end-of-turn-reminder | 1 | 0 | 0 |
| inject-session-bootstrap | 1 | 1 | 0 |
| inject-subagent-context | 1 | 0 | 0 |
| validate-prompt | 1 | 1 | 0 |

**8 twins** define `_is_zcode` inline; **6** define `_emit_ctx`; **2** define `_adv_violation`. (Stage-6 migration target — out of scope for Stage 2; this is the maintenance pain the forks below address at the structural level.)

### Existing gate (`tests/plugin/hook-paths.test.sh`, 179 lines)

Already enforces 8 cases (a-h) (file:line cited throughout):

- **(a)** extensionless filename — `:50-53`.
- **(b)** `@dual-pair` / `@cc-only-rationale` marker — `:56-60`.
- **(c)** no `CLAUDE_PROJECT_DIR/.claude/hooks/` hardcode — `:67-71`.
- **(d)** consumer-rules rooted at `CLAUDE_PROJECT_DIR`, not plugin root — `:83-95`.
- **(e)** self-resolves dir before sourcing siblings — `:98-104`.
- **(f)** `hooks.json` parses — `:149-151`.
- **(g)** every `run-hook.cmd <name>` target exists — `:152-174`.
- **(h)** env-first REPO_ROOT form (Form A or B) for 8 in-sweep twins — `:107-146`, list at `:115-124`.

Step-1 (`tests/plugin/hook-paths.test.sh:36`) skip-list covers `_zcode-*` helpers (T-ZP-C — internal infrastructure, not delivery-channel artefacts).

---

## §2 The 4 forks

### Fork 2A — Twin-conformance lint (extend `tests/plugin/hook-paths.test.sh`)

**Shape:** add structural checks for the divergence patterns already documented in §1. Concretely:

- **(i) extensionless sibling-call invariant** — when a twin sources or invokes a sibling script, the call must NOT carry `.sh`. Already true across all twins today (verified: `grep -nE '\.sh"\s|source.*\.sh' plugin/hooks/*` returns only the `_zcode-emit` test fixtures and run-hook.cmd). Lint catches future regressions.
- **(j) consumer-guard invariant for validate-prompt-shape twins** — twins that reference `packages/core/` framework-internal artefacts must carry an `[[ ! -f "$X" ]] && exit 0` (or equivalent) guard. Validates the precedent at `plugin/hooks/validate-prompt:23`.

**Pros:**
- **Preserves the SSOT.** Hand-maintained twins stay hand-maintained; the lint only catches drift (per `scripts/render-harness-config.mjs:330` "drift-gated by harness-config-drift.test.ts; hook-paths.test.sh gate (a-g) enforces sibling discipline" — this fork extends (a-h) → (a-j)).
- **Lowest implementation cost** (see cost estimate below).
- **REUSE verdict per [build-first-reuse-default.md §1](../../rules/build-first-reuse-default.md):** extends the existing `tests/plugin/hook-paths.test.sh` gate; no new test runner, no new infrastructure.
- **Mechanical + deterministic** — no LLM, no judgement in the check (per [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)).
- **Catches the documented precedent failures** — the consumer-guard pattern at `plugin/hooks/validate-prompt:23` and the extensionless-call pattern at `plugin/hooks/inject-subagent-context:47` are both load-bearing and currently unenforced.

**Cons:**
- **Cannot catch *semantic* divergence.** The lint verifies "form X present" but not "form X is accurate". `plugin/hooks/inject-matching-rule`'s 52-line T-PLUG-A relocation comment (diff lines 1-26) is untestable by structural grep.
- **Doesn't reduce twin-maintenance cost** — still 14 hand-maintained files. The trio-copy-paste pain (`_is_zcode`/`_emit_ctx`/`_adv_violation` across 8 twins) is unaddressed; that is Stage 6's scope (mega-umbrella §2 Stage 6).
- **Reactive by design** — each new check is added after a drift pattern is observed.

**Implementation cost:** ~30-60 LOC additions to `tests/plugin/hook-paths.test.sh`, one new entry to `in_sweep_twins` per new repo-reading twin (one line, `:115-124`).
**Per-new-hook cost:** 1 LOC.
**Long-term maintenance:** low — extending a check is mechanical.

**Recommendation: ADOPT.** Pure-additive, REUSE verdict, preserves SSOT, closes the gap between the documented patterns (validate-prompt consumer guard, inject-subagent-context extensionless call) and the enforced ones.

---

### Fork 2B — Per-hook transform spec (YAML sidecar + renderer application)

**Shape:** declare each twin's divergence in a YAML sidecar (e.g. `plugin/hooks/specs/inject-matching-rule.yaml`):

```yaml
twin: inject-matching-rule
transforms:
  - rename_var: { from: REPO_ROOT, to: PROJECT_DIR }
  - replace_comment_block: { anchor: "PostToolUse rule-injector", new_text: "..." }
  - add_line_after: { marker: "set -uo pipefail", line: '# RELOCATION note...' }
```

Renderer reads the spec, applies transforms to `.claude/hooks/<name>.sh`, writes twin to `plugin/hooks/<name>`.

**Pros:**
- **Single source of truth per twin** — divergence declared explicitly, not implicit in diff.
- **Auto-generation possible** — the renderer could verify spec-vs-actual consistency.
- The 5 byte-identical twins become trivial (`transforms: []`); the 4 simple env-first twins become one `replace_var` entry each.

**Cons:**
- **Requires a transform DSL that does not exist.** Capturing `plugin/hooks/inject-matching-rule`'s 52-line comment rewrite needs at minimum: `rename_var`, `replace_comment_block`, `add_line_after`, `drop_intermediate`. That's ~200+ LOC of new transform engine.
- **Directly contradicts SSOT** at `scripts/render-harness-config.mjs:326-334` ("sibling scripts are hand-maintained"). Amending this SSOT is a maintainer-level decision — Stage 2's anti-scope (`kickoff.md §8 Anti-scope`: "Do NOT modify `_zcode-emit` helper or any plugin twin").
- **The DSL becomes the new hand-maintenance surface**, just relocated. Each novel divergence requires a DSL extension; the spec is drift-prone in the same way the twins are.
- **T16 risk — pattern-matching-on-name.** A YAML transform engine is a small codemod tool; production codemod frameworks (jscodeshift, ast-grep, bsccript) exist and are far more capable than anything we'd build. Building our own is `#parallel-evolution-creep` per [build-first-reuse-default.md §4](../../rules/build-first-reuse-default.md).
- **High upfront cost, marginal benefit over hand-maintained + lint (2A/2C).** For the 9 twins without semantic divergence, the YAML adds ceremony without value.

**Implementation cost:** ~200-400 LOC transform engine + 14 YAML specs (~30-60 LOC each) + drift-detection test.
**Per-new-hook cost:** 1 YAML spec (~10-60 LOC depending on divergence).
**Long-term maintenance:** high — DSL extensions for each novel divergence pattern, spec drift, engine test surface.

**Recommendation: REJECT.** Contradicts SSOT, requires bespoke transform DSL duplicating upstream codemod tools (BFR-default violation), large infra investment for marginal benefit over 2A. The "explicit divergence declaration" benefit is already achievable via inline comments in the twin (the existing pattern — see `plugin/hooks/inject-subagent-context:29-32` TWIN DIVERGENCE block).

---

### Fork 2C — Pure hand-maintained + `make check-twins`

**Shape:** keep the current pattern; add a CI test (`scripts/check-twins.sh` invoked via `make check-twins`) that diffs `.claude/hooks/<name>.sh` vs `plugin/hooks/<name>` and asserts that only known-divergence hunks differ. Known divergences recorded in a registry file (e.g. `plugin/hooks/twin-divergences.json`).

**Pros:**
- **Catches *semantic* drift via diff** — known-divergence hunks are documented; unexpected diff → CI fail.
- Closer to the SSOT's spirit than 2B (still "hand-maintained"); just adds guard-rails.
- A `make check-twins` script can be ~30-50 LOC of bash around `diff` + a registry reader.

**Cons:**
- **The registry IS the same maintenance surface as Fork 2B's YAML spec**, in simpler format. Same drift risk between registry and actual divergence.
- **5 of 14 twins are byte-identical today** — they would need registry entries with `divergence: none`, pure ceremony.
- **Hand-writing a per-twin "expected diff hunk" is brittle to whitespace/comment edits** — a contributor adding a blank line to `.claude/hooks/validate-prompt.sh` would trip the registry even if the semantic twin is fine.
- **Overlaps with existing `tests/plugin/hook-paths.test.sh` checks (a-h)** — risk of duplicate-gate confusion. Two gates testing overlapping properties is `#trap-stated-but-not-enforced` adjacent (per [ai-laziness-traps.md §4](../../rules/ai-laziness-traps.md)).
- **Doesn't address the trio-copy-paste pain** — same gap as 2A; deferred to Stage 6.

**Implementation cost:** ~50-100 LOC for `scripts/check-twins.sh` + `plugin/hooks/twin-divergences.json` (~30-60 LOC, one entry per twin).
**Per-new-hook cost:** 1 registry entry.
**Long-term maintenance:** medium — registry upkeep; brittleness to cosmetic edits.

**Recommendation: DEFER.** Technically sound but overlaps with 2A's scope. The 5 byte-identical twins are already covered by structural checks (a-h); the 9 divergent twins benefit more from per-divergence lint (2A adds cases (i)/(j)) than from a diff-vs-registry test. Re-evaluate if drift incidents fire under 2A despite the lint.

---

### Fork 2D — Drop twin concept (runtime detection in single script)

**Shape:** one script works in both channels via runtime branching:

```bash
if [ -n "$CLAUDE_PLUGIN_ROOT" ] && [ -z "$CLAUDE_PROJECT_DIR" ]; then
  # plugin-channel branch
else
  # CC-dogfood branch
fi
```

**Pros:**
- **Minimum file count** — 1 file per hook instead of 2.
- Pattern is well-established: `.claude/hooks/inject-project-digest.sh:18` already uses `REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"` — works in both channels.

**Cons:**
- **Cannot unify all divergences.** `plugin/hooks/inject-subagent-context:47` calls `inject-session-bootstrap` (extensionless) while `.claude/hooks/inject-subagent-context.sh:43` calls `inject-session-bootstrap.sh`. Runtime detection would need: `if [ -n "$CLAUDE_PLUGIN_ROOT" ]; then sibling="${sibling%.*}"; else sibling="$sibling.sh"; fi` — per-twin branching = same maintenance cost, in a worse place (hidden inside conditionals).
- **`validate-prompt` consumer guard** (`plugin/hooks/validate-prompt:23` `[[ ! -f "$VALIDATOR" ]] && exit 0`) is a plugin-only concern — under unified-script it must always run (cost: one extra check on CC dogfood, harmless but ugly, and obscures intent).
- **`inject-matching-rule` var rename** (52-line divergence) cannot be unified without keeping both namesillable; you'd standardize on one name everywhere — but the rename was deliberate (semantic clarity: `PROJECT_DIR` is the *consumer's* project, not the maintainer's repo).
- **install.sh copies `.claude/hooks/*.sh` to consumer `.claude/hooks/`** — under unified-script, the same file would be copied to BOTH `.claude/hooks/foo.sh` AND `plugin/hooks/foo` (extensionless). install.sh's current copy logic doesn't strip extensions; modifying it touches the consumer install surface (`setup.d/10-skills.sh` `register_cc_hook` calls) — out-of-scope for Stage 2 (kickoff §8 anti-scope).
- **Breaks dogfood parity.** Today, byte-identical twins (`end-of-turn-reminder`, `deps-hash-check`, etc.) mean CC-dogfood and plugin-consumer run literally the same bytes. Runtime branching would mean CC-dogfood exercises only one branch — the plugin-channel branch becomes CC-untested code at runtime. T16 risk (pattern-matching on harness name): `#brand-name-detection` adjacent per [dual-implementation-discipline.md §4](../../rules/dual-implementation-discipline.md).

**Implementation cost:** substantial — refactor every twin's divergent section to use runtime detection, modify `install.sh` / `setup.d/10-skills.sh` to handle the extensionless copy, and likely 4-5 separate `if plugin-context` branches for irreducible divergences. ~200-300 LOC across 9 twins + install.sh surgery.
**Per-new-hook cost:** 0 LOC for fully-unifiable hooks; 10-30 LOC per divergent hook (the conditional).
**Long-term maintenance:** high for divergent hooks — branching obscured inside one file.

**Recommendation: REJECT.** Runtime detection works for the trivial case (env-first `REPO_ROOT`, 4 of 14 twins — which already use it via Form A) but does not eliminate the twin concept for the 4 semantically-divergent twins. Worse than 2A/2C: instead of explicit per-twin divergence declared in comments + a lint, you hide divergence in conditionals inside one file. Also breaks dogfood byte-parity (the T-ZP-A pattern proven in step-1).

---

## §3 Comparison matrix

| Fork | Preserves SSOT? | Catches drift? | Catches semantic drift? | Reduces twin count? | Addresses trio pain? | Cost | Per-new-hook |
|---|---|---|---|---|---|---|---|
| 2A lint | ✅ | ✅ | ❌ | ❌ | ❌ (Stage 6) | low | 1 LOC |
| 2B YAML spec | ❌ amends SSOT | ✅ | ✅ | ✅ | ❌ (Stage 6) | high | 1 spec (~10-60 LOC) |
| 2C hand + diff-CI | ✅ | ✅ | ✅ | ❌ | ❌ (Stage 6) | medium | 1 registry entry |
| 2D unified | ✅ (mechanically) | n/a | n/a | ✅ | ❌ (Stage 6) | high | 0 or 10-30 LOC |

**Key insight — trio pain is NOT addressed by ANY of these forks.** It is Stage 6's scope (mega-umbrella §2 Stage 6: "9-twin migration to `_zcode-emit` helper"). Stage 2 is about twin-conformance discipline, not de-duplication of the emit wrapper.

---

## §4 Technical recommendation (operator decides strategic)

**Recommend ADOPT Fork 2A** — twin-conformance lint extending `tests/plugin/hook-paths.test.sh` with cases (i) extensionless sibling-call invariant and (j) consumer-guard invariant.

**Rationale (technical merits only — the strategic tradeoff effort-vs-long-term-maintenance is the operator's call per kickoff §4):**

1. **Preserves the SSOT** at `scripts/render-harness-config.mjs:326-334` (the step-1 rejection criterion for Mechanism 2).
2. **Lowest implementation cost** (~30-60 LOC) and lowest per-new-hook cost (1 LOC).
3. **REUSE verdict per [build-first-reuse-default.md §1](../../rules/build-first-reuse-default.md)** — extends existing test, no new infrastructure. Compare to 2B (BUILD new transform DSL) and 2D (BUILD install.sh surgery).
4. **Closes an observable gap** — the consumer-guard pattern (`plugin/hooks/validate-prompt:23`) and extensionless-call pattern (`plugin/hooks/inject-subagent-context:47`) are load-bearing and currently unenforced.
5. **Composes cleanly with Stage 6** — when the 9-twin migration to `_zcode-emit` lands, the lint will verify the migration is consistent across twins (the helper's contract becomes one of the linted invariants).

**Falsification (what would change this recommendation):**
- If ≥2 drift incidents fire post-2A that the lint could not catch (semantic divergences), promote Fork 2C from DEFER to ADOPT — the diff-vs-registry test catches the residue.
- If the YAML transform DSL were already implemented upstream (e.g. ast-grep/bash-ast tooling with a stable spec format), Fork 2B's REUSE verdict would flip positive — re-evaluate.

---

## §5 SSOT interaction per fork (acceptance criterion)

| Fork | SSOT at `scripts/render-harness-config.mjs:326-334` ("sibling scripts are hand-maintained") |
|---|---|
| 2A lint | **Preserves** — extends drift-gate (a-h)→(a-j); SSOT's "hand-maintained" stance unchanged. |
| 2B YAML spec | **Amends** — replaces "hand-maintained" with "DSL-derived from YAML spec"; maintainer-level decision, out of scope for Stage 2 (anti-scope §8). |
| 2C hand + diff-CI | **Preserves** — adds guard-rail around the existing hand-maintained pattern; SSOT's stance unchanged. |
| 2D unified | **Preserves mechanically** (one file = trivially hand-maintained) but **breaks the T-ZP-A byte-identity precedent** proven in step-1 (PR #1031); changes the channel model. |

---

## §6 Stop-conditions check (kickoff §7)

- ✅ Every fork has file:line evidence (no prose-only claims).
- ✅ SSOT interactions explicit per fork.
- ✅ No fork decided autonomously — recommendation given, strategic pick parked.
- ✅ Anti-scope respected: no `_zcode-emit` helper edit, no plugin twin edits, no fork implemented.

---

## §7 §1.7 Self-review (per [phase-research-coverage.md §1.7](../../rules/phase-research-coverage.md))

### Forward-check (recommendation complies with existing disciplines)

- ✅ **Build-vs-reuse ([build-first-reuse-default.md](../../rules/build-first-reuse-default.md)):** Fork 2A = REUSE (extends existing test, no new infra); Fork 2B = BUILD (rejected, DSL duplication of upstream codemod tools); Fork 2C = REUSE-ish (defers pending drift evidence); Fork 2D = BUILD + breaks T-ZP-A (rejected).
- ✅ **No-paid-LLM ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)):** all 4 forks are deterministic bash/grep/diff — zero API calls.
- ✅ **Doc-authority ([doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md)):** this patch is under `docs/meta-factory/research-patches/**` — filename establishes scope, no per-file header required per §2 filename-convention rule.
- ✅ **Reviewer-discipline ([reviewer-discipline.md §2](../../rules/reviewer-discipline.md)):** the strategic pick (ADOPT one fork) is parked for the operator, not decided here. Technical recommendation is given (allowed per §1.12 lead-with-recommendation), but the strategic tradeoff is surfaced.
- ✅ **Attention-is-not-a-mechanism ([attention-is-not-a-mechanism.md](../../rules/attention-is-not-a-mechanism.md)):** recommendation is backed by file:line evidence + falsification criteria, not bare attention.

### Backward-check (new rule applied to all existing artefacts)

Class of this change = *recommendation to extend `tests/plugin/hook-paths.test.sh` with structural drift checks*.

Surfaces where this class occurs:
- `tests/plugin/hook-paths.test.sh` — the target surface; already covers 14 twins. SWEPT-CLEAN (evidence `:115-124`).
- `packages/core/principles/24-plugin-manifest-integrity.test.ts` — parallel marker-gate; already has the same skip-set (`run-hook.cmd|*.json|*.md|_zcode-*` per step-1 plan-deviation #1). SWEPT-CLEAN.
- `scripts/check-twins.sh` (Fork 2C) — does not exist today; covered by rejection rationale (overlaps with 2A).

No silent supersession. No retroactive invalidation of existing twins.

### Self-reflexive trigger (T15)

This patch's own §1.7 forward+backward checks are present (above). The recommendation discipline it advocates for (lint over BUILD) is the same discipline applied to itself (REUSE existing test, no new infra).

---

## §8 What operator decides

**Question:** which fork to ADOPT for plugin-twin maintenance discipline?

**Options:**

- **2A (recommended on technical merits):** twin-conformance lint extending `tests/plugin/hook-paths.test.sh`. Preserves SSOT, lowest cost, REUSE verdict. ~30-60 LOC.
- **2B:** YAML transform spec + renderer. Contradicts SSOT, requires new DSL. High cost.
- **2C:** hand-maintained + `make check-twins` diff-CI. Overlaps with 2A. Defer pending drift evidence.
- **2D:** drop twin concept, runtime detection. Breaks T-ZP-A byte-identity precedent; doesn't eliminate twins for semantically-divergent cases.

**Strategic tradeoffs NOT determinable on technical merits alone:**

1. **Effort-vs-long-term-maintenance preference:** 2A is cheap+lint; 2B is expensive+single-source-of-truth; 2D is expensive upfront but fewer files long-term.
2. **Risk tolerance for drift the lint cannot catch:** if semantic drift is acceptable, 2A suffices; if not, 2C is the safety net.
3. **Appetite for SSOT amendment:** 2B amends the step-1 SSOT; 2A/2C/2D preserve it.

**Parked via `tsx packages/runtime-bridge/src/cli/park.ts` — task ID = `$HANDOFF_TASK_ID`.**
