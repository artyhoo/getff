---
description: Evidence-regeneration runbook — refresh a backend's live-fired capability-matrix evidence at a toolchain pin bump
paths:
  - "packages/core/backends/**"
---

# Evidence regeneration — discipline rule (verified recipe)

<!-- globs: packages/core/backends/** -->
<!-- inject: Regenerating backend evidence? Install the version CI resolves (not host-local), paste capturedDiagnostic from the FRESH firing stdout, verify green BEFORE the one commit. See .claude/rules/evidence-regeneration.md. -->

> **Class:** B — the DETECTION layer already exists as deterministic RED gates (`checkToolchainFreshness` per backend, run by `test:backends`; the FF8004 coherence gate, run by `test:composition`); this rule is the verified *procedure* for satisfying them, delivered edit-time via the `<!-- globs: -->` marker above (injected by [`inject-matching-rule.sh`](../hooks/inject-matching-rule.sh) on any `packages/core/backends/**` edit). Class A (a principle test on the procedure itself) is **structurally unreachable**: the load-bearing step — «`capturedDiagnostic` was pasted from *this session's* fresh firing stdout, not carried over stale» — is not mechanically checkable (incident #1033 changed `date`+`toolchain` while the diagnostic stayed byte-identical and every gate stayed green). A gate cannot tell a fresh paste from a stale one; only the author running the firing command this session can. Promotion ceiling = B until a script is warranted; §6.
> **Fires:** a per-backend toolchain-freshness gate (`checkToolchainFreshness`) goes RED, or a rendered-not-fired matrix cell needs its first live-fired evidence.
> **Authoritative for:** the evidence-regeneration procedure — §1 the rule, §2 the verified per-backend loop (numbered) + the safety interlocks, §3 the two entry conditions + the firing-evidence invariant, §4 the paste-from-fresh-stdout anti-theatre rule, §5 anti-patterns, §6 promotion/retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). The freshness-gate *implementation* — that is each backend's `capability-matrix.test.ts` (`checkToolchainFreshness` + `deriveToolVersion`/`deriveRustcVersion`). The FF8004 coherence gate — that is [`packages/core/composition/gates/composition-gate.ts`](../../packages/core/composition/gates/composition-gate.ts). The verified-recipe *form* — mirrored from [git-conflict-merge-forward.md §2](git-conflict-merge-forward.md), whose subject (git conflicts) is unrelated.

> **Origin:** incident #1033→#1041. #1033 regenerated a matrix evidence block against a **stale host-local eslint** (a version CI does not resolve) and changed only `date`+`toolchain` while the `capturedDiagnostic` stayed byte-identical to the prior block; every deterministic gate stayed green, the regen was semantically wrong, and #1041 had to revert it. The two failure surfaces — «regenerated against the wrong resolver» and «evidence block not actually re-fired» — are invisible to CI by construction, so the countermeasure is a procedure, not a gate. Codified as the framework half of the `rule-tests-surface` umbrella (S3); the design spec is [`docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md §5`](../../docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md).

## §1 The rule

When a backend's toolchain-freshness gate goes RED (its committed evidence `toolchain` string no longer equals the version resolving at test time), regenerate that backend's evidence block by **re-firing the committed invalid fixture with the tool at the version CI will resolve, and pasting the resulting diagnostic verbatim** — then verify green **before** the single commit that carries both the pin-site edit and the matrix edit. Never hand-write a `toolchain` string, never carry a `capturedDiagnostic` over from the prior block, and never commit an evidence block you did not re-fire this session. The RED gate is the detection; this procedure is the authoritative fix.

## §2 The verified recipe (per backend)

Run once per backend whose freshness gate is RED. `<b>` ∈ `{ npm, astgrep, ruff, cargo }`.

```text
REGENERATE-EVIDENCE (freshness gate RED for backend <b>):
1.  Install the version CI WILL RESOLVE — CI is the authoritative resolver (§2a).
      Do NOT regen against an arbitrary host-local tool version (the #1033 defeat).
2.  Re-fire the committed invalid fixture with <b>'s firing-contract command (§2b):
      spawn the CLI (astgrep/ruff/cargo) or run in-process (npm), capture the fresh stdout.
      Confirm the expected rule id / code is present — a non-firing fixture is a STOP (§5).
3.  Rewrite ONLY the evidence block in packages/core/backends/<b>/capability-matrix.json:
      "date"              = today (YYYY-MM-DD)
      "toolchain"         = the exact string the live `--version` reports (§2c)
      "capturedDiagnostic"= ONE exemplar diagnostic PASTED from the step-2 fresh stdout (§4)
    Never touch the cells structure; never add a pseudo-cell; never edit "kind":"live-fired".
4.  Verify green, quoting the verdicts:
      npm --prefix packages/core run test:backends      # every checkToolchainFreshness gate
      npm --prefix packages/core run test:composition    # the FF8004 coherence gate
    MUST be green BEFORE step 5 — this is the safety interlock (§2d).
5.  ONE commit: the pin-site edit (§2e) + the matrix edit (+ fixtures/parser ONLY if the
    diagnostic SHAPE moved). A split commit leaves CI RED in the window between them.
```

**§2a — CI is the authoritative resolver (interlock).** The version to install is the one CI resolves, not whatever is on `PATH` locally. Install it explicitly before re-firing: `npm install -g @ast-grep/cli@<pin>` / `pip install ruff==<pin>` / `rustup toolchain install <pin>` / the eslint dep from `packages/core/package.json`. Regenerating against a stale host-local tool is the exact #1033 failure (#1041 revert). If your host tool differs from the pin, install the pin first; the freshness gate compares against the CI-resolved version, so a regen against a different local version goes RED again in CI.

**§2b — the per-backend firing command** (from `packages/core/backends/<b>/firing-contract.json`):

| `<b>` | firing command (step 2) | fire mode | expected match |
|---|---|---|---|
| `npm` | `npx vitest run backends/npm/firing` | in-process (re-invokes vitest/rule-tester — no external linter) | rule id `no-restricted-syntax` |
| `astgrep` | `ast-grep scan --json` (in the fixture dir) | spawn CLI | `$.ruleId` == `no-datetime-now` |
| `ruff` | `ruff check --output-format=json` (in the fixture dir) | spawn CLI | `$.code` ∈ `{TID251, TID253}` (family) |
| `cargo` | `cargo clippy --message-format=json` (in the fixture dir) | spawn CLI | `$.message.code.code` == `clippy::disallowed_methods` |

The committed invalid fixture lives at `packages/core/backends/<b>/fixtures/firing/invalid/`. `fireContract(contract, dir)` is the shared parameterized runner the tests use; the manual firing above reproduces what it does, so the fresh stdout you paste is the same shape the gate will re-derive.

**§2c — the `toolchain` string format** (what `checkToolchainFreshness` parses; the anchor version in **bold**):

| `<b>` | `--version` source | `toolchain` string format | parser |
|---|---|---|---|
| `npm` | node + eslint | `node v<x> / eslint <semver>` (**eslint** semver is compared) | `parseEslintVersion` |
| `astgrep` | `ast-grep --version` | `ast-grep <semver>` | `parseAstgrepVersion` |
| `ruff` | `ruff --version` | `ruff <semver>` | `parseRuffVersion` |
| `cargo` | `rustc --version` | `rustc <semver> (<hash> <date>)` (**rustc**, NOT cargo, is the anchor) | `parseRustcVersion` |

**§2d — verify-before-commit (interlock).** Step 4 MUST be green before the step-5 commit. A matrix whose `toolchain` ≠ the live `--version` output is the exact #1033 failure; a matrix whose `capturedDiagnostic` was not re-fired this session is #1033's silent variant that no gate catches (§4). Green `test:backends` + `test:composition` is the interlock that proves the evidence block is both fresh (freshness gate) and coherent (FF8004 gate) before it lands.

**§2e — the pin sites** (re-derive each line live before editing; T3):

| pin | site | current pin |
|---|---|---|
| astgrep | `.github/workflows/audit-self.yml:232` (`npm install -g @ast-grep/cli@…`) | `0.44.1` |
| ruff | `.github/workflows/audit-self.yml:242` (`pip install ruff==…`) | `0.15.21` |
| rustc (CI) | `.github/workflows/audit-self.yml:271` (`rustup toolchain install …`) + `:272` (`rustup default …`) | `1.96.1` |
| rustc (fixtures) | `packages/core/backends/cargo/fixtures/firing/{invalid,valid,valid-clean}/rust-toolchain.toml` + `demo/crate/rust-toolchain.toml` (`channel = …`) | `1.96.1` |
| eslint | `packages/core/package.json:61` (`"eslint": "^10.4.0"`) | `^10.4.0` (resolves `10.4.0`) |

The rustc pin is **dual-site** (CI install + the fixtures' `rust-toolchain.toml`); a rustc pin bump edits both in the same commit or the fixture toolchain and the CI toolchain diverge.

## §3 Entry conditions and the firing-evidence invariant

**Two entry conditions, named precisely:**

1. **A toolchain-freshness gate goes RED** — `checkToolchainFreshness` iterates the matrix cells, skips `status:"no"` / no-evidence cells, parses `cell.evidence.toolchain`, and pushes a violation when the claimed version ≠ the version `deriveToolVersion`/`deriveRustcVersion` resolves at test time (loud-skip when the tool is absent, so the gate never false-fails on a machine without the linter). This condition exists for **all four** backends today — ruff, astgrep, npm(eslint), **and cargo** (`deriveRustcVersion`, the rust analog; see the cargo correction below).
2. **A rendered-not-fired cell needs first-fire evidence** — a cell that is *rendered* but carries no live-fired evidence at all. Stale evidence is a hard RED (condition 1), NOT this case; this case is «rendered, no firing evidence». Bind to the **invariant**, not a line number: the firing-evidence predicate `hasFiringEvidence(node, matrix)` = `cell.status !== 'no' && cell.evidence?.kind === 'live-fired'` ([`enforcement-line.ts:34-39`](../../packages/core/composition/enforcement-line.ts)) is what keeps a cell in the fired (green) state rather than the rendered-not-fired (yellow) state; regenerating a live-fired evidence block is what satisfies it. The FF8004 gate **deliberately does not fire** on the spec-legal rendered-not-fired cell — it fires only on matrix *incoherence* (`status:"no"` paired with `kind:"live-fired"`), [`composition-gate.ts:143-158`](../../packages/core/composition/gates/composition-gate.ts). So regenerating evidence must never manufacture coherence by hand; it re-fires and pastes, and the gate stays silent on the legal rendered case.

**Cargo correction (this runbook supersedes the design spec §5 «interim» framing).** [`docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md §5`](../../docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md) describes the cargo arm as *interim* — «no rustc freshness gate, live-fire skipIf(CI), dev-machine-only regen». That text is **stale**: ecosystem-wiring **W4** has landed (#1080). Today cargo is CI-verified exactly like ruff/astgrep — cargo live-fire runs in CI against the pinned toolchain with **no `!isCI` guard** ([`packages/core/backends/cargo/firing.test.ts`](../../packages/core/backends/cargo/firing.test.ts)), and the rustc freshness gate exists (`deriveRustcVersion` in [`capability-matrix.test.ts`](../../packages/core/backends/cargo/capability-matrix.test.ts)). Document and treat cargo as a full CI-verified lane; do **not** encode the spec's interim caveat. (The spec is a design-session-owned artifact; per the Artifact Ownership Contract this runbook does not edit it — it is the loop's source of truth and states the correction here.)

## §4 The paste-from-fresh-stdout anti-theatre rule (load-bearing, #1033)

`capturedDiagnostic` MUST be pasted from **this session's** fresh step-2 firing stdout, and that stdout MUST be quoted in the PR body. This is the one step no gate can enforce: #1033 changed `date`+`toolchain` while the `capturedDiagnostic` stayed byte-identical to the prior block, and every deterministic gate stayed green — the freshness gate only checks the `toolchain` string, not whether the diagnostic was re-derived. The evidence block is only *evidence* if it was produced this session. Concretely:

- Fire the fixture (§2 step 2), copy one exemplar diagnostic from the actual stdout, paste it as `capturedDiagnostic` (JSON-stringified).
- Quote the fresh stdout tail in the PR body so a reviewer sees the diagnostic was re-derived, not carried over.
- If the diagnostic *shape* changed (new fields, a moved range), the fixtures/parser move in the **same** commit (§2 step 5) — a shape change with a stale parser is a different RED.

## §5 Anti-patterns

- **`#evidence-theatre`** — bumping `date`+`toolchain` while `capturedDiagnostic` is carried over byte-identical (the #1033 shape). Passes every gate; is not a regeneration. Counter: §4 — paste from fresh stdout, quote it in the PR body.
- **`#regen-against-host-local-tool`** — re-firing with whatever version is on local `PATH` instead of the version CI resolves. Goes RED again in CI (or, worse, lands a wrong-version evidence block). Counter: §2a — install the pinned version first.
- **`#hand-written-toolchain`** — typing the `toolchain` string from memory instead of copying the live `--version` output. Counter: §2c — the string is the literal `--version` output the parser expects.
- **`#split-regen-commit`** — landing the pin-site edit and the matrix edit in separate commits, leaving CI RED in the window between them. Counter: §2 step 5 — one commit.
- **`#pseudo-cell-or-cells-edit`** — adding a cell or editing the cells structure to «make the matrix pass». `validateMatrix` forces the status/evidence contract RED; the loop rewrites ONLY the evidence block. Counter: never touch cells; regenerate evidence, not structure.
- **`#skip-verify-before-commit`** — committing before `test:backends` + `test:composition` are green. Counter: §2d interlock.

## §6 Promotion / retirement

- **Promotion to a script (BFR expensive branch):** the trigger is a **second regen-friction incident** — a documented case where following this recipe by hand caused a wrong or reverted regen despite the recipe existing. At that point a `scripts/regenerate-evidence.sh <backend>` that installs the pin, fires the fixture, and writes the evidence block from the fresh stdout is warranted (build-vs-reuse: a script is the expensive branch, justified by the recorded second incident, not built ahead of need). Until then this is a recipe, per [build-first-reuse-default.md](build-first-reuse-default.md).
- **Promotion of a freshness gate to a new backend:** when a fifth backend ships a live-fired matrix, add its row to §2b/§2c/§2e and its `checkToolchainFreshness` to `test:backends`; the loop is unchanged.
- **Retirement:** 12 incident-free months after this rule ships → archive to a CLAUDE.md `Harness gates` bullet (peer criteria: [reviewer-discipline.md §4](reviewer-discipline.md)). The RED freshness gates remain regardless — they are the detection layer this recipe serves, not part of the recipe.

## §7 §1.7 self-reflexive note

**Forward-check (this rule complies with active disciplines):**

- [`rule-enforcement-channel-selection.md §1/§3`](rule-enforcement-channel-selection.md): the violation surface splits by detectability — the *stale toolchain* is mechanically detectable and is already a **gate** (`checkToolchainFreshness`, RED at `test:backends`); the *procedure* (which version, paste-from-fresh, one commit) is judgment and is delivered by **edit-time injection** (`<!-- globs: packages/core/backends/** -->` + `paths:` frontmatter, the CC-native/hook `@dual-pair`, set-equal per principle 31). No new gate invented for a judgment call (`#gate-where-judgment-needed` avoided) — §1's Class-B rationale states why Class A is unreachable. ✓
- [`no-paid-llm-in-ci.md`](no-paid-llm-in-ci.md): the mechanism is deterministic bash/vitest gates + a markdown recipe; zero LLM calls. ✓
- [`doc-authority-hierarchy.md §2-§3`](doc-authority-hierarchy.md): carries Class B + Fires + Authoritative-for + NOT-authoritative-for header; enforced dynamically by principle 09 for `.claude/rules/*.md`. ✓
- [`build-first-reuse-default.md`](build-first-reuse-default.md): REUSE verdict — the recipe reuses the existing RED freshness gates, the existing firing-contract commands, the existing `inject-matching-rule.sh` channel, and the git-conflict-merge-forward *form*; no new capability, no new dependency, no script (the expensive branch is deferred to §6's trigger). ✓
- [`source-before-shape.md §1`](source-before-shape.md): the runbook was authored against live-verified sources — the four freshness gates, the firing contracts, the pin sites (each line re-derived, T3), and the git-conflict-merge-forward form — not from memory; the cargo arm binds to the post-W4 `firing.test.ts` state, not the stale spec §5 text. ✓
- [`ai-laziness-traps.md §2`](ai-laziness-traps.md): T3 (every pin site + toolchain string re-derived live, quoted); T15 (the framework is the recipe's first consumer — §rehearsal in the PR body executes the loop on the framework's own matrices); T20 (the «cargo is CI-verified» claim is backed by `firing.test.ts` file evidence, not asserted from the spec's stale framing). ✓

**Backward-check (sweep of the surfaces this rule's change-class touches — «a new `.claude/rules/*.md` verified-recipe»):**

- **Sibling verified-recipe rules** — [`git-conflict-merge-forward.md`](git-conflict-merge-forward.md) is the only other Class-B *verified-recipe* (header + numbered fenced recipe + safety interlock + anti-patterns + §1.7). This rule mirrors its FORM and touches a disjoint subject (evidence regeneration vs git conflicts); it supersedes nothing there. SWEPT-CLEAN (`.claude/rules/git-conflict-merge-forward.md:16`).
- **Channel-declaration population** — principle 31 requires every `.claude/rules/*.md` to declare a channel; this file declares `paths:` + a set-equal `<!-- globs: -->` marker (both `packages/core/backends/**`, a live 102-file glob), so it does not add a channel-declaration debt. SWEPT-CLEAN (`packages/core/principles/31-rule-channel-declaration.ts`).
- **Rule index** — `.claude/rules/00-rule-index.md` is generated; regenerated via `npx tsx scripts/render-rule-index.mjs --write` in the same commit so the new row is present (the `--check` drift gate would otherwise go RED). SWEPT (index regenerated).
- **Doc-authority header population** — principle 09 dynamically requires the header on new `.claude/rules/*.md`; header present. SWEPT-CLEAN.
- **The spec** — [`…-rule-tests-surface-design.md §5`](../../docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md) carries the stale cargo-interim text; per the Artifact Ownership Contract this runbook does NOT edit it, states the §3 correction, and the drift is surfaced to the orchestrator as an observation (not a drive-by spec edit). GAP-NOTED (spec drift → orchestrator observation, out of this stage's scope).

## See also

- [git-conflict-merge-forward.md](git-conflict-merge-forward.md) — the Class-B verified-recipe FORM mirrored here (disjoint subject).
- [docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md §5](../../docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md) — the design spec (cargo §5 «interim» text superseded by §3 above).
- [packages/core/backends/cargo/firing.test.ts](../../packages/core/backends/cargo/firing.test.ts) — the post-W4 CI-verified cargo posture (no `!isCI` guard).
- [packages/core/composition/enforcement-line.ts](../../packages/core/composition/enforcement-line.ts) — the `hasFiringEvidence` predicate (the fired vs rendered-not-fired boundary).
- [packages/core/composition/gates/composition-gate.ts](../../packages/core/composition/gates/composition-gate.ts) — the FF8004 coherence gate (silent on the spec-legal rendered case).
- [.github/workflows/audit-self.yml](../../.github/workflows/audit-self.yml) — the pinned-install steps (astgrep/ruff/rust) = the CI-authoritative resolver.
