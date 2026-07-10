---
description: CI tool pinning — version-pin bare run: installs; lockfile-aware --prefix
paths:
  - ".github/workflows/**"
  - ".github/actions/**"
  - "*.sh"
---

<!-- globs: .github/workflows/**, .github/actions/**, *.sh -->
<!-- inject: Rule: pin bare tool installs (pip install pkg==ver, npm install -g pkg@ver) in workflows AND repo shell scripts; use npm ci --prefix, not npm install. See ci-tool-pinning.md §1-§2. -->
<!-- glob-liveness: allow .github/actions/** no composite action exists yet in this repo; scope is forward-declared for when one ships (CTX Stage 1 render-rule-index.mjs liveness check) -->

# CI tool pinning — discipline rule

> **Class:** A — companion principle test (paired-negative) shipped at `packages/core/hooks/unpinned-tool-install.test.ts` (issue #654, 2026-06-22); pre-push gate at `packages/core/hooks/pre-push.ts` (unpinnedToolInstallSection).
> **Fires:** editing `.github/workflows/**` or any repo shell script (`*.sh`, `setup`, `install.sh`).
> **Authoritative for:** CI tool pinning discipline — §1 the two rules (version pin + lockfile-aware install), §2 scope (this repo's `.github/workflows/` + tracked shell scripts), §3 escape hatch, §4 relationship to companion-install-principle.md, §5 promotion / retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Consumer companion installs — see [companion-install-principle.md](companion-install-principle.md) (different surface, no contradiction with this rule — see §4).

> **Origin:** 2026-06-22, issue #654. zizmor 1.26.1 tightened `adhoc-packages` and surfaced 5 pre-existing LOW findings (`npm install --prefix` at 5 sites). Post-triage we discovered a deeper gap: zizmor's `adhoc-packages` covers npm/gem/pip via `setup-python` action inputs, but does NOT flag bare `run: pip install <pkg>` without a version pin. That gap (T16 verified live: `pip install pyyaml` on a bare `run:` produces zero zizmor findings) is the original cause of `audit-self.yml:741` being pinned to zizmor 1.25.2 to suppress findings rather than fixed. SSOT #153 records both the REFERENCE verdict for zizmor and the BUILD verdict for the bare-`run:` detection slice.

## §1 The two rules

**Rule A — version pin on bare `run:` tool installs:**

In `.github/workflows/` YAML files, any bare `run:` shell command that installs a tool MUST include an explicit version pin:

- `pip install <pkg>==<ver>` (NOT `pip install <pkg>`)
- `npm install -g <pkg>@<ver>` (NOT `npm install -g <pkg>`)

A bare install without a pin is non-deterministic: the CI job's behaviour depends on the package registry's current "latest", making CI output unreliable across time and across runner snapshots.

**Rule B — lockfile-aware install for `--prefix` project deps:**

`run:` steps that install the project's own packages via a `--prefix` path MUST use the lockfile-aware command:

- `npm ci --prefix <P>` (NOT `npm install --prefix <P>`)

`npm install` re-resolves to the latest satisfying version; `npm ci` is strictly reproducible from `package-lock.json`. This `--prefix` form is exactly what zizmor's `adhoc-packages` audit flags, so Rule B is **enforced by the existing zizmor CI gate** (REUSE verdict, SSOT #153a) — not by a separate check.

> **Deferred — bare root `npm install` is NOT yet gated.** Root-level workspace installs (`npm install --silent` without `--prefix`) are flagged by neither zizmor's `adhoc-packages` nor Rule A's pre-push gate. This repo currently has ~10 such sites in `audit-self.yml`. Converting them to `npm ci` and extending a gate to enforce it is a **deferred follow-up**, deliberately NOT stated as a MUST here: a prose-only MUST that the repo itself violates would be `#trap-stated-but-not-enforced` — the "documents lie; tests don't" failure this project exists to prevent.

## §2 Scope

**Rule A applies to two populations in this repository:**

1. `.github/workflows/*.yml` — our own CI (original scope, issue #654). Scanned on every push, framework and consumer repos alike, via `workflowYmlFiles()`.
2. **Git-tracked executable shell scripts** — `*.sh` anywhere in the repo, the root extensionless `setup` entrypoint, and extensionless shell scripts under `.husky/` + `plugin/hooks/` — scanned **on the framework repo only** (SSOT-register presence, the same detector as the #923 tool-absence split), via `shellScriptFiles()` + the `isShellScriptPopulationFile()` predicate in `packages/core/hooks/checks/unpinned-tool-install.ts`. Widened 2026-07-10: the retired `setup.sh` ran a bare `npm install -g ai-factory` (fixed in PR #946) that a workflows-only scan could never see. A consumer's own scripts are NOT gated — this rule scopes to this repository's discipline.

`setup.d/companions.manifest` is **excluded by construction**: it is a data file (TAB-delimited rows), not `*.sh`, so it never enters population 2 even though `engine.sh` executes its `install_cmd` column. That is exactly where the [companion-install-principle.md §1](companion-install-principle.md) no-pin policy lives — see §4 for the two-surface reconciliation.

Rule B applies to `.github/workflows/*.yml` only (enforced by zizmor, §1).

**Carve-outs (Rule A does not flag):**

- `pip install -r <file>` — requirements-file install (pin lives in the file)
- `pip install .` — editable install of a local package
- `pip install -e .` — explicit editable flag
- Already-pinned installs: `==` present for pip; `@` present for npm global
- Comment lines (lines starting with `#`)
- Lines carrying the escape hatch token (see §3)

## §3 Escape hatch

When a tool genuinely cannot or should not be version-pinned in a specific step, add the token `# ci-tool-pin: allow <reason>` at the end of the `run:` line:

```yaml
- name: Install bleeding-edge tool
  run: pip install some-tool  # ci-tool-pin: allow no stable release; main branch only
```

The token `# ci-tool-pin: allow` must appear on the same line as the install command. Any trailing text after `allow` is the rationale (recommended but not required by the gate). A bare comment not containing this token does NOT trigger the escape hatch — the gate will still flag the line.

## §4 Relationship to companion-install-principle.md

[`companion-install-principle.md`](companion-install-principle.md) governs how **consumer companion tools** are installed by `./setup` / `install.sh` on consumer machines. Its §1 principle is: use the companion's own official top-level installer, **without** pinning a version, so updates flow through the companion's own registry.

**This rule governs the opposite surface: our own CI audit tooling in `.github/workflows/`.**

The two rules are NOT contradictory — they apply to orthogonal surfaces:

| Surface | Rule | Rationale |
|---|---|---|
| Consumer companion install (via `setup.d/companions.manifest`) | no pin (companion-install-principle.md §1) | Satellite updates flow through upstream; our installer does not version-manage |
| Our own CI tool install (`run: pip install zizmor`, etc.) | MUST pin (this rule §1) | Reproducibility across CI runs; tool bumps should be deliberate edits, not implicit |
| Our own shell scripts installing tooling (`*.sh`, `setup`) | MUST pin (this rule §1-§2, widened 2026-07-10) | Same non-determinism as CI installs; the manifest surface is out of this population by construction (data file, not `*.sh`) |

**Mechanical reconciliation of the two policies:** the shell-script scan operates on script FILES; the companion no-pin commands live in the manifest DATA file that `engine.sh` reads at runtime (`install_cmd` is a variable in engine.sh, never a literal install command in any `*.sh`). Verified 2026-07-10: the only unpinned install string in the repo shell surface is `setup.d/companions.manifest:20` (`npm install -g @ast-grep/cli`) — outside population 2, never flagged. If a future edit inlines a companion install command directly into a `*.sh` file, the gate WILL flag it — that is intended: companion installs belong in the manifest ([dual-implementation-discipline.md §7](dual-implementation-discipline.md)), and the flag surfaces the misplacement.

One-directional pointer: companion-install-principle.md is NOT edited by this rule (Artifact Ownership Contract — that rule owns its own scope). See it for consumer-side conventions.

## §5 §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (the pre-push gate is deterministic regex, zero API calls); complies with [build-first-reuse-default.md](build-first-reuse-default.md) (REUSE zizmor for the npm/gem/pip-via-action-input slice, BUILD only the unserved bare-`run:` slice per SSOT #153); complies with [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (this file carries Class + Authoritative-for header + is registered in principle 09 `REQUIRED_HEADER_DOCS`); complies with [dual-implementation-discipline.md §2(ii)](dual-implementation-discipline.md) (pre-push gate is repo-internal Husky tooling, §2 non-trigger (ii) — no portable fallback required).
- **Backward-check:** codifies the 2026-06-22 unpinned-zizmor incident (`audit-self.yml:741` pinned to 1.25.2 to suppress findings rather than fix them); enforces the fix (`npm ci --prefix`, `pip install zizmor==1.26.1`) that the preceding commits applied; self-applies via §1 Task #8 (dogfood: all unpinned bare-`run:` installs in `.github/workflows/` pinned before this PR ships). See `unpinnedToolInstallSection` in `packages/core/hooks/pre-push.ts`.
- **Backward-check (2026-07-10 scope widening):** codifies the backward-sweep finding that `setup.sh:89` ran a bare `npm install -g ai-factory` invisible to the workflows-only gate (wrapper retired in PR #946; detection gap closed here). Dogfood at widening time: zero findings across all tracked `*.sh` + `setup` (`grep -nE 'npm install -g|pip install' setup.d/*.sh setup install.sh scripts/*.sh .claude/hooks/*.sh` → empty); the sole unpinned install string repo-wide is the manifest row `setup.d/companions.manifest:20`, excluded by construction per §2. Sibling sweep at widening time: extensionless shebang'd scripts (`.husky/pre-commit|pre-push|post-checkout`, `plugin/hooks/*`) enumerated via `git grep -lE '^#!'`, added to the population, and verified clean (SWEPT-CLEAN — zero install commands).

## §6 Promotion / retirement

- **Class A confirmed:** paired-negative test exists at `packages/core/hooks/unpinned-tool-install.test.ts`. Gate wired into both `main()` and `PREPUSH_ONLY` paths.
- **Retirement:** if zizmor ships native bare-`run:` unpinned-pip detection (SSOT #153 trigger: «zizmor ships a new audit covering bare `run: pip install` without `setup-python` action») → ADOPT that audit (SSOT #153 Verdict transitions from BUILD to REFERENCE), and retire the pre-push gate with a migration note. Matches peer-rule retirement criteria ([reviewer-discipline.md §4](reviewer-discipline.md)).

## See also

- [companion-install-principle.md](companion-install-principle.md) — consumer companion install conventions (no pin; different surface).
- [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) — sibling CI-discipline rule (all CI checks must be API-free).
- [docs/meta-factory/prior-art-evaluations.md #153](../../docs/meta-factory/prior-art-evaluations.md) — SSOT entry: zizmor REFERENCE + bare-run tool-pin BUILD verdict + T16 evidence.
- [`packages/core/hooks/pre-push.ts`](../../packages/core/hooks/pre-push.ts) — the pre-push gate implementing this rule's §1 check.
- [`packages/core/hooks/unpinned-tool-install.test.ts`](../../packages/core/hooks/unpinned-tool-install.test.ts) — paired-negative test (Class A companion).
