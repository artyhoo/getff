# S6 → U10 handoff — npm publish checklist for `@rules-as-tests/core`

> **Producer:** launch-preannounce-track S6 (npm pivot-lite PREP, reversible steps 1–2).
> **Consumer:** U10 of `getff-to-prod-meta-launch` — owns the irreversible acts (name change, `private:true` drop, `npm publish`, registry writes).
> **What S6 did NOT do (by ownership boundary):** no name change, no `private` flip, no publish, no registry writes, no `files` field added (see §3 rationale).
> **Verified against:** `origin/staging` rebased to `3d2fbdf2a` (2026-07-11). Package dir: `packages/core/`.

---

## §0 Blocking dependencies (U10 gates)

1. **U11 name-freeze** — the published name (`@getff/*` per U9 repo-split + the `public-launch`/U12 gate that already names `@getff` as the install scope). Do NOT publish under `@rules-as-tests/core`.
2. **U9 repo-split + `@getff/*` rename** — the natural window to also finish the exports narrowing (§2 deferred set) because it severs the in-repo `meta-factory` coupling that blocks it today.
3. **`private:true` drop** — U10-owned, single-line, last reversible-to-irreversible step. Do it in the same commit as the name-freeze so the package is never publishable under the wrong name.

## §1 Exports narrowing — DONE (partial) + DEFERRED remainder

**Landed in S6** (`packages/core/package.json` `exports`): dropped `./validator`.

Evidence (paired RED→GREEN, resolved against the worktree-edited package.json via an isolated `node_modules` symlink — the worktree's own `node_modules` symlinks to the primary checkout and would mask the edit):

- BEFORE: `import.meta.resolve("@rules-as-tests/core/validator")` → RESOLVES.
- AFTER: → `BLOCKED (ERR_PACKAGE_PATH_NOT_EXPORTED)`; all kept subpaths still resolve.

**Why only `validator`:** the 4-module SCC (`research → synthesizer → validator → installer → research`, verified by cross-import grep) is the over-promising surface — importing any one drags the whole cycle, and all four point at raw `.ts`. Of the four, `validator` is the ONLY one with **zero in-repo importers** via the package subpath, so it is a pure over-promise that drops cleanly and reversibly inside S6's surface (`packages/core/package.json` only).

`research`, `synthesizer`, `installer` each have exactly one in-repo consumer: the **private, never-published** `packages/meta-factory/src/{research,synthesizer,installer}/index.ts` re-export shims (`peerDependency` on core, only script is `typecheck`). Dropping their exports breaks `meta-factory` typecheck. Fixing that requires relocating meta-factory to internal relative imports — a **2-package change outside S6's surface**, and pointless to risk at night with no reviewer while npm-delivery (step 3) is still deferred and there is no matrix cell to validate against.

**Recommended for U10 / U9 repo-split:** finish the narrow to the honestly-supportable set
`{ ./manifest, ./manifest-schema, ./eslint-rules, ./detector }`
by dropping `./research`, `./synthesizer`, `./installer` in the same change that rewires meta-factory's three shims to relative deep imports (meta-factory's tsconfig already references `../core/detector/semver.d.ts`, so cross-package relative refs are an established pattern there). `./detector` stays (acyclic, real install-flow + meta-factory consumer). `./eslint-rules` stays (acyclic; the primary consumer artifact — note today consumers actually receive rules by file-copy to `eslint-rules-local/*.mjs`, so the export is the intended future npm-delivery contract, not yet load-bearing).

**Kept surface honesty note:** all code exports point at `.ts`, so a plain-Node consumer cannot `import` them without a TS loader; they are usable only through the framework's own install wiring / the step-3 delivery path. `manifest`/`manifest-schema` (JSON) are the only universally-loadable exports.

## §2 Publish-readiness audit results

`npm pack --dry-run` on `packages/core` (name-freeze pending, so filename is still `rules-as-tests-core-0.1.0.tgz`):

| Metric | Value |
|---|---|
| Files in tarball | **549** |
| Packed size | 842.6 kB |
| Unpacked size | **3.24 MB** |
| `.test.ts` / `.audit.ts` files shipped | **205** (~1.8 MB of source) |
| `fixtures/**` files shipped | 91 |
| `principles/` files shipped | 50 (meta-tests — 11 `.test.ts` + design/support) |
| `audit-self/` files shipped | 16 (self-audit shell + tests) |

**Root cause:** `packages/core/package.json` has **no `files` field and no `.npmignore`** → npm ships the entire package dir (tests, fixtures, meta-tests, self-audit machinery, `stryker*.mjs`, `vitest.config.ts`).

### Recommended `files` allowlist (VALIDATE before trusting — see caveat)

Runtime **code** import-closure from all bins + kept exports = 77 files across:
`backends, detector, diagnostics, eslint-rules, installer, ir, research, synthesizer, validator` (**zero** test files reachable). Plus `manifest/` (data; `main` + exports) and the by-path assets below.

```jsonc
"files": [
  "manifest/", "eslint-rules/", "detector/", "research/",
  "synthesizer/", "validator/", "installer/", "ir/",
  "backends/", "diagnostics/", "composition/",
  "templates/", "install/", "skills/",
  "LICENSE.md", "README.md"
]
```

**CAVEAT (do not skip):** an import-closure allowlist MISSES by-path assets (`templates/`, `skills/`, `install/synth-and-wire.bundle.mjs`, manifest JSON loaded by path). `composition/` was NOT reached by the code closure — include-or-exclude must be decided against the **step-3 delivery matrix cell** (`npm i <tarball>` into a fixture, run the real install + rule-firing), NOT this static list. That is exactly why S6 did **not** add `files` blind: with no delivery matrix yet, an allowlist is unvalidatable and a wrong one silently breaks consumers. Even a conservative negative approach (glob-exclude `**/*.test.ts`, `**/*.audit.ts`, `**/fixtures/**`, `principles/`, `audit-self/`, `stryker*.mjs`, `vitest.config.ts`) removes ~360 of 549 files with high confidence and low breakage risk if U10 wants an interim step before the full allowlist.

### Other metadata gaps (all OUTSIDE S6's `exports`/`files`-only edit exception → left for U10)

- **`bin`**: all 6 targets exist but point at `.ts` (e.g. `./detector/cli.ts`) → require a TS loader at runtime; under plain `node` the installed bins will not run. Resolve as part of step-3 delivery (thin shims / tsx dependency / prebuild). Not a blocker for file-copy delivery.
- **`README.md`**: absent in `packages/core` → the npm package page would be blank. Add one (or a stub pointing at the repo).
- **`LICENSE`**: `license` field = `FSL-1.1-ALv2`, but no LICENSE file in `packages/core` (root has `../../LICENSE.md`). Copy/symlink it into the package before publish.
- **`description`**, **`repository`**: absent → npm metadata gaps. Add both.
- **`main`**: `./manifest/rules-manifest.json` — intentional (`require('@rules-as-tests/core')` returns the manifest JSON). Confirm this is desired at publish; harmless.

## §3 Remaining step-3 wiring (DEFERRED — not built in S6, per kickoff)

Step 3 (dependency-delivery behind a flag + a tarball matrix cell) is gated on the S2 start cell being green AND U10 having published. What S6 learned that step-3 must handle:

1. **Bin-as-`.ts` delivery.** The consumer receives hooks/checks either by (a) thin `.husky/*` shims that call the package bin, or (b) the current file-copy path. For (a) the bins must be runnable — decide the TS-loader story (ship a tsx dep, or prebuild `.ts`→`.js`, or shims that invoke `npx tsx`). The step-3 matrix cell (`npm i <tarball>` into a fixture) is where the `files` allowlist (§2) and the bin-runnability both get validated for real.
2. **Asset delivery.** `templates/`, `skills/`, `install/synth-and-wire.bundle.mjs` are loaded by path, not import — they MUST be in `files`. The matrix cell is the only honest check that they arrived.
3. **File-copy fallback stays live** in parallel (rollback doctrine below): the same matrix cell must pass on the file-copy path too, so consumers can pin last-good regardless of the npm path.

## §4 Rollback doctrine (binding)

- **`npm unpublish` is NOT a rollback.** The 72h unpublish window is not a safety net for a shipped release; treat every publish as permanent.
- **Roll forward with patch releases.** A bad `0.x.y` is fixed by `0.x.(y+1)`, never by unpublish.
- **Consumers pin last-good.** The file-copy fallback path stays functional so a consumer can pin the previous known-good delivery while a patch ships.
- Publish `0.1.0` (or the name-frozen equivalent) only after the S2 start cell is green on the tarball path.

## §5 One-command publish target for U10 (after §0 gates clear)

Once name-freeze + `files` (validated via step-3 matrix) + `private:true` drop are in:
`cd packages/core && npm publish --access public` (scoped package → `--access public` required for first publish). Everything upstream of that line is reversible and either done (exports `validator` drop) or documented above.
