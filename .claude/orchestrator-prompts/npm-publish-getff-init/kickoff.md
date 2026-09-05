# npm-publish-getff-init — umbrella kickoff (U10: the `getff` distribution package + publish)

> **Type:** build umbrella, **host-side in-session execution** (operator decision 2026-09-05:
> consumer-shipped, irreversible-after-publish surface → research-grade, top-tier seat; the aif
> instance holds no Claude profile). Replaces the 2026-07-23 STUB of the same name.
> **Class:** operational kickoff (dispatch input).
> **Authoritative for:** the scope, decided inputs, deliverables, gate and floors of U10 — the
> package that makes `npx getff@latest init` real, and the publish act that follows.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the name architecture — [`getff-name-architecture-freeze.md`](../../../docs/meta-factory/getff-name-architecture-freeze.md)
> (binding, cited by section below); the release frame — [`2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §7-§8; the publish checklist — [`launch-preannounce-track/s6-u10-handoff.md`](../launch-preannounce-track/s6-u10-handoff.md).
> **Base branch:** `staging`. **Program position:** getff-to-prod U10, re-gated 2026-07-23 on
> beta-delivery-ux R1 (merged #1358) + release-frame phase-1 exit (measured met 2026-09-05 except
> «GLM one-button on a clean machine», accepted as proxy by the release handoff).
> **Rigor label (effort-worthiness L0):** `research-grade` — the tarball is what every consumer
> installs, and `npm unpublish` is not a rollback (freeze §5). The rigor lives in the
> consumer-matrix cell and the paired-RED `files` evidence, not in extra rounds.
> **Prior-art (build-vs-reuse, CLAUDE.md gate):** the assembler + drift gate copy an in-repo,
> ratified precedent — [`scripts/build-synth-bundle.sh`](../../../scripts/build-synth-bundle.sh)
> `--check` against a committed artefact; the tarball cell copies
> [`tests/consumer-matrix/npm-tarball-cell.sh`](../../../tests/consumer-matrix/npm-tarball-cell.sh)
> (R1). The capability commit still runs the SSOT consult + context7 ≥3 phrasings at build
> time and carries the `Prior-art:` trailer (§5 T11).

**Host-verify contract** (the S1+S2 acceptance commands, run on the host from the repo root;
the publish gate in §3 S3 is the operator's act and is deliberately not in this block):

```bash host-verify
bash scripts/build-getff-dist.sh --check
bash tests/consumer-matrix/getff-dist-cell.sh
npm --prefix packages/getff pack --dry-run
npx --prefix packages/core vitest run packages/core/principles/36-ci-needs-completeness.test.ts
```

## §0 Read first, in order

1. This kickoff.
2. [`getff-name-architecture-freeze.md`](../../../docs/meta-factory/getff-name-architecture-freeze.md)
   — §1 family table, **§2 §0.5 RESOLVED** (the shape: a distribution package whose tarball
   mirrors the repo root), §3 version floor, §4 ownership evidence, §5 rollback doctrine, the
   F-C′ resolution and the **U10 WARNING ratified verdict (b)**.
3. [`2026-09-02-beta-release-night-morning-report.decisions.md`](../../../docs/superpowers/specs/2026-09-02-beta-release-night-morning-report.decisions.md)
   Decision 1 — unscoped `getff`, bin `getff`.
4. [`s6-u10-handoff.md`](../launch-preannounce-track/s6-u10-handoff.md) §2 (metadata gaps),
   §4 (rollback), §5 (publish command).
5. [`tests/consumer-matrix/npm-tarball-cell.sh`](../../../tests/consumer-matrix/npm-tarball-cell.sh)
   - the freeze record's «`files` allowlist — measured paired-RED evidence» section — the
     method this umbrella reuses for the new package.

## §1 Goal

`npx getff@latest init` (spec D6) installs the enforcement layer into a fresh consumer and the
first planted violation **fails** — from a tarball published under the unscoped name `getff`,
version `0.1.0`, whose contents are **assembled** from this repo so that `install.sh` finds
every `PKG_ROOT/...` path exactly where it looks today. Nothing else changes for consumers who
install by clone or by `curl … | sh`.

## §2 Decided inputs — do not re-derive (each with its record)

| Input                             | Decision                                                                                                                                                                                                                                                                                                                                                                                             | Record                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Package name                      | unscoped **`getff`**, bin **`getff`**; `@getff/*` reserved for libraries                                                                                                                                                                                                                                                                                                                             | decisions.md Decision 1 (operator, 2026-09-03)                            |
| Shape                             | **new workspace package `packages/getff/`** whose tarball lays out the repo root: `install.sh`, `setup`, `setup.d/`, `agents/`, `skills/`, `templates/`, `.claude/{hooks,skills,templates}`, `scripts/` shipped subset, `packages/{core,preset-*,runtime-bridge,lint-config}`, `.prettierrc.json`. **Assembled at pack time, never hand-authored; `install.sh` does not move** (215 test references) | freeze §2 §0.5 RESOLVED (2026-08-17) — rejected alternatives listed there |
| What `getff init` runs            | `./setup` with the caller's arguments (README:10 «`getff init` (via `./setup`)»); every other subcommand prints usage and exits 2                                                                                                                                                                                                                                                                    | freeze §2                                                                 |
| Version                           | **`0.1.0`** — `0.0.1` is the spent placeholder                                                                                                                                                                                                                                                                                                                                                       | freeze §3                                                                 |
| Publish set at the beta           | **`getff` only.** `@rules-as-tests/core` stays `private: true` and ships _inside_ the tarball; its rename to `@getff/core` and separate publish are U9 (post-announce)                                                                                                                                                                                                                               | freeze §1 + spec D1 «U9 no longer gates U10»                              |
| Runtime deps for the shipped bins | `tsx` already in `dependencies` (F-C′ option a); preset imports resolved dynamically with honest degrade (U10 WARNING verdict b, implemented) — **nothing further to promote for `init`**, because `init` runs `install.sh`, not the six `rules-as-tests-*` bins                                                                                                                                     | freeze F-C′ + U10 WARNING                                                 |
| Rollback                          | `npm unpublish` is NOT a rollback; roll forward with `0.1.(y+1)`; consumers pin last-good; publish only after the start cell is green on the tarball path                                                                                                                                                                                                                                            | freeze §5 (verbatim from s6-u10 §4)                                       |
| Ownership                         | `getff` name and `@getff` org both owned by `artyhoo` (authed probe 2026-08-17; re-run `npm whoami` + `npm owner ls getff` at S3 entry)                                                                                                                                                                                                                                                              | freeze §4                                                                 |
| Ordering in the release           | this umbrella's PR merges to `staging` → **ultra review** (`/code-review ultra`, operator) on the promote → promote #4 → **BS3 merged** (spec §8 F5 docs-site claims gate) → `npm publish`                                                                                                                                                                                                           | release handoff 2026-09-05; operational-conventions §2 rule (3)           |

**Still open at authoring, decided HERE (reversible, Type-2):** the assembler is an explicit
`scripts/build-getff-dist.sh` with a `--check` drift arm, **and** `packages/getff/package.json`
declares `"prepack": "bash ../../scripts/build-getff-dist.sh"` so a bare `npm pack` can never
produce a stale tarball. The committed drift artefact is a **manifest** (`packages/getff/MANIFEST.sha256`:
path + sha256 per assembled file), not the payload — committing ~500 duplicated files would make
every framework PR touch the package. _Falsifier: if `prepack` proves unreliable under `npm pack`
from the workspace root (npm runs lifecycle scripts per package), drop it and make the cell the
only guard — recorded, not silently._

## §3 Stages + deliverables

Stages are sequential; S1+S2 land in **one PR** (the cell is the proof of S1, per R1's method —
a `files` set «established by paired-RED arms against a consumer-matrix cell, not by reasoning»).

### S1 — the distribution package (capability commit)

- `packages/getff/package.json`: `name: getff`, `version: 0.1.0`, `private: false`,
  `license: FSL-1.1-ALv2`, `description`, `repository` (+ `directory`), `homepage`, `bugs`,
  `engines.node >= 22`, `bin: { getff: ./bin/getff }`, `files: [...]` = the assembled tree
  (every entry paired-RED, S2), `scripts.prepack`, `scripts.build:dist`, `scripts.build:dist:check`.
  **No `dependencies`**: the payload is self-contained files; the consumer's toolchain is what
  `install.sh` already probes for (bash, git, node, npm).
- `packages/getff/bin/getff` — bash, `set -euo pipefail`, resolves its own package root
  (`$(cd "$(dirname "$0")/.." && pwd)`), `init` → `exec "$ROOT/setup" "$@"`; `--version` →
  the package version from `package.json`; anything else → usage, exit 2. **Never a network
  fetch** (freeze §0.5 rejected the clone-shim).
- `packages/getff/README.md` (npm page: what it installs, the two entry points, the maturity
  labels, link to getff.ai) and `packages/getff/LICENSE` (copy of the root `LICENSE.md` — s6-u10
  §2 gap).
- `scripts/build-getff-dist.sh` — default mode assembles the payload into `packages/getff/`
  (rsync/cp of the §2 tree from the repo root; the copied payload paths are gitignored under
  `packages/getff/`), writes `MANIFEST.sha256`; `--check` assembles into a temp dir, diffs the
  manifest against the committed one, exits 1 on drift with the differing paths listed
  (the `build-synth-bundle.sh --check` shape). The `.gitignore` block for the payload names
  every top-level copied path explicitly — no `*`.
- Root `package.json` `workspaces` already covers `packages/*`; verify `npm ci` at the root
  stays green with the new workspace (no deps → no lockfile churn beyond the workspace entry).

### S2 — the consumer-matrix cell (the gate that makes S1 true)

- `tests/consumer-matrix/getff-dist-cell.sh`, modelled on `npm-tarball-cell.sh`:
  (1) `bash scripts/build-getff-dist.sh --check` → exit 0 (drift gate live);
  (2) `npm pack` in `packages/getff` → record file count + unpacked size;
  (3) `npm i <tarball>` into a fresh ts-server fixture (no registry);
  (4) `npx getff --version` → `0.1.0`; `npx getff frobnicate` → exit 2 + usage;
  (5) **the U10 gate**: `npx getff init -y ts-server` in the fixture → exit 0, then plant the
  canonical violation the fresh-install smoke already uses (reuse
  `tests/install-sh/` planted-violation helpers — do not invent a new one) → `npm run lint`
  exits non-zero naming the rule. «Published → installs cleanly» is NOT the assertion; «the
  first violation fails» is (T-NPI-A);
  (6) **paired-RED arms per `files` entry**: for each top-level entry, pack with that entry
  removed (a temp copy of `package.json`) and show step (5) fails — or mark the entry
  `UNVALIDATED-by-this-cell` with the reason, never drop it silently (R1 method).
- `.github/workflows/audit-self.yml`: a job `consumer-matrix-getff-dist-cell` running the
  script with pinned actions (ci-tool-pinning), **added to `ci-success.needs`** — principle 36
  (`36-ci-needs-completeness.test.ts`) fails otherwise, and so does the
  `#warning-nobody-reads` rule. Zero LLM calls (no-paid-llm-in-ci).
- `packages/core/principles/`: no new principle — the cell is the mechanism.

### S3 — publish (operator act; agent prepares, operator presses)

- Preconditions, each quoted: S1+S2 merged to `staging`; ultra review on the promote recorded;
  promote #4 merged (merge commit); **BS3 merged** (docs-site claims gate); `npm whoami` →
  `artyhoo`; `npm owner ls getff` → `artyhoo`; `npm view getff version` → `0.0.1`.
- From `main`: `cd packages/getff && npm run build:dist && npm publish --dry-run` (quote the
  file list; compare the count with the cell's) → operator runs `npm publish` (unscoped → no
  `--access` flag needed; tag `latest`).
- **Fresh-machine gate (U10's own, from the 2026-07-23 stub):** on a machine that has never
  cloned this repo, `mkdir t && cd t && npm init -y && npx getff@0.1.0 init -y ts-server` →
  plant the violation → `npm run lint` fails naming the rule. Quote it in `done.md`. If the
  operator has no second machine, a fresh Docker `node:22` container is the accepted proxy —
  say which was used.
- `done.md` here at S3 close (umbrella-closure convention) with the published version, the
  tarball file count, the gate output, and the residue routed onward (U9 rename, `@getff/core`).

## §4 Gate + host acceptance (S1+S2 PR)

| #   | Check (run, quote command + output)                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `bash scripts/build-getff-dist.sh && git status --short packages/getff` → only `MANIFEST.sha256` (and tracked metadata) show; payload paths are ignored                                                  |
| 2   | `bash scripts/build-getff-dist.sh --check` → exit 0; then edit one shipped file (e.g. add a comment to `setup.d/lib.sh`), re-run → exit 1 naming that path; revert                                       |
| 3   | `cd packages/getff && npm pack --dry-run` → file count and size printed; `install.sh` and `setup` at the tarball root; no `node_modules`, no `.git`, no `tests/`, no `docs/`                             |
| 4   | `bash tests/consumer-matrix/getff-dist-cell.sh` → GREEN, with step (5)'s failing lint output pasted and the per-entry RED table                                                                          |
| 5   | `npm ci` at the repo root green; `npm test --workspace=@rules-as-tests/core --run` green; `npx vitest run packages/core/principles/36-ci-needs-completeness.test.ts` green                               |
| 6   | `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` shows **no** fingerprint change — the consumer install payload is untouched by this umbrella (the package is additive)                         |
| 7   | Prior-art trailer on the capability commit; SSOT entry or match in `prior-art-evaluations.md`; PR body §1.7 Forward+Backward with `file:line` (the PR touches `.github/workflows/**` and adds a package) |
| 8   | Phase -1 / T19 cold review of the PR diff by a fresh seat before merge — findings recorded in the PR body                                                                                                |

## §5 AI-traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active:** **T2** (the cell is run, not described), **T3** (every gate row quotes output),
**T7** (counter-prompt: «what would make the cell pass while `npx getff@latest init` fails on a
real machine?» — the fixture sharing the repo's `node_modules`; `setup` resolving `HERE` to the
workspace, not the tarball; the planted violation caught by a globally installed ESLint; a
`files` entry that packs but is never read), **T10** (enumerate the `PKG_ROOT` path set with the
freeze record's grep BEFORE writing `files`), **T11** (SSOT consult + context7 ≥3 phrasings on
«npm monorepo publish a package whose tarball mirrors the repo root» / «npm prepack assemble
files» / «npm bundledDependencies vs copying workspace packages» before the assembler exists;
cite what surfaced), **T14** (an `UNVALIDATED-by-this-cell` entry is stated, not implied
green), **T17/T18** (nothing in the repo is moved or deleted — `install.sh` stays), **T19** (own
cold pass before handoff). **Domain:** **T-NPI-A** — «published → installs cleanly» asserted
without a from-scratch run; the counter is S3's fresh-machine gate and the cell's step (5).
**T-U10-B** — «the assembler copies the working tree, including untracked files» — assemble
from `git ls-files` output (tracked files only), never from a directory walk.

## §6 Floors (operator-only; park, never improvise)

- `npm publish` and anything that writes to the registry (owners, tags, deprecations).
- Ultra review on the promote PR; the promote merge itself (base=`main`, agent-blocked).
- The publish ORDER relative to BS3 — the spec says BS3 first; deviating is an operator
  decision recorded in a decisions file.
- Choosing a second machine vs the Docker proxy for the fresh-machine gate.

## §7 See also

- [`getff-to-prod-meta-launch/kickoff.md`](../getff-to-prod-meta-launch/kickoff.md) — U10 row
  (re-gated 2026-07-23), the 🔒 marker.
- [`beta-delivery-ux/done.md`](../beta-delivery-ux/done.md) — R1 closing record, the U10 gates
  it left open (line 18).
- [`docs/meta-factory/operational-conventions.md`](../../../docs/meta-factory/operational-conventions.md)
  §2 — the three promote rules.
- [`.claude/rules/ci-tool-pinning.md`](../../rules/ci-tool-pinning.md),
  [`.claude/rules/no-paid-llm-in-ci.md`](../../rules/no-paid-llm-in-ci.md),
  [`.claude/rules/build-first-reuse-default.md`](../../rules/build-first-reuse-default.md) — the
  three rules the S1+S2 PR body's §1.7 Forward-check names.
