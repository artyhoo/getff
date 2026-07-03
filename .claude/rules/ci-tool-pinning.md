# CI tool pinning — discipline rule

> **Class:** A — companion principle test (paired-negative) shipped at `packages/core/hooks/unpinned-tool-install.test.ts` (issue #654, 2026-06-22); pre-push gate at `packages/core/hooks/pre-push.ts` (unpinnedToolInstallSection).
> **Authoritative for:** CI tool pinning discipline — §1 the two rules (version pin + lockfile-aware install), §2 scope (this repo's `.github/workflows/`), §3 escape hatch, §4 relationship to companion-install-principle.md, §5 promotion / retirement.
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

Both rules apply exclusively to `.github/workflows/*.yml` files in this repository (our own CI). Rule A's pre-push gate (`unpinnedToolInstallSection` in `pre-push.ts`) scans every workflow YAML file via `workflowYmlFiles()`.

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

One-directional pointer: companion-install-principle.md is NOT edited by this rule (Artifact Ownership Contract — that rule owns its own scope). See it for consumer-side conventions.

## §5 §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (the pre-push gate is deterministic regex, zero API calls); complies with [build-first-reuse-default.md](build-first-reuse-default.md) (REUSE zizmor for the npm/gem/pip-via-action-input slice, BUILD only the unserved bare-`run:` slice per SSOT #153); complies with [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (this file carries Class + Authoritative-for header + is registered in principle 09 `REQUIRED_HEADER_DOCS`); complies with [dual-implementation-discipline.md §2(ii)](dual-implementation-discipline.md) (pre-push gate is repo-internal Husky tooling, §2 non-trigger (ii) — no portable fallback required).
- **Backward-check:** codifies the 2026-06-22 unpinned-zizmor incident (`audit-self.yml:741` pinned to 1.25.2 to suppress findings rather than fix them); enforces the fix (`npm ci --prefix`, `pip install zizmor==1.26.1`) that the preceding commits applied; self-applies via §1 Task #8 (dogfood: all unpinned bare-`run:` installs in `.github/workflows/` pinned before this PR ships). See `unpinnedToolInstallSection` in `packages/core/hooks/pre-push.ts`.

## §6 Promotion / retirement

- **Class A confirmed:** paired-negative test exists at `packages/core/hooks/unpinned-tool-install.test.ts`. Gate wired into both `main()` and `PREPUSH_ONLY` paths.
- **Retirement:** if zizmor ships native bare-`run:` unpinned-pip detection (SSOT #153 trigger: «zizmor ships a new audit covering bare `run: pip install` without `setup-python` action») → ADOPT that audit (SSOT #153 Verdict transitions from BUILD to REFERENCE), and retire the pre-push gate with a migration note. Matches peer-rule retirement criteria ([reviewer-discipline.md §4](reviewer-discipline.md)).

## See also

- [companion-install-principle.md](companion-install-principle.md) — consumer companion install conventions (no pin; different surface).
- [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) — sibling CI-discipline rule (all CI checks must be API-free).
- [docs/meta-factory/prior-art-evaluations.md #153](../../docs/meta-factory/prior-art-evaluations.md) — SSOT entry: zizmor REFERENCE + bare-run tool-pin BUILD verdict + T16 evidence.
- [`packages/core/hooks/pre-push.ts`](../../packages/core/hooks/pre-push.ts) — the pre-push gate implementing this rule's §1 check.
- [`packages/core/hooks/unpinned-tool-install.test.ts`](../../packages/core/hooks/unpinned-tool-install.test.ts) — paired-negative test (Class A companion).
