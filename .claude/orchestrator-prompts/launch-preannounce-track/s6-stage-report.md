# S6 stage report — npm pivot-lite PREP (steps 1–2 only)

> **Stage:** S6 of launch-preannounce-track. Scope: reversible prep steps 1 (exports narrow) + 2 (publish-readiness audit). Step 3 (dependency-delivery wiring + tarball matrix cell) DEFERRED per brief — learnings written into the handoff instead.
> **Branch:** `worktree-lpt-s6`, rebased onto `origin/staging` `3d2fbdf2a` (2026-07-11).
> **Surface touched:** `packages/core/package.json` (`exports` map only) + two new umbrella-dir docs (this report + `s6-u10-handoff.md`).
> **Ownership line honored:** NO name change, NO `private` flip, NO publish, NO registry writes, NO `files` field added (rationale below).

## §0 Premise re-verification (S.0 rule)

Re-verified on fresh `origin/staging` (rebased +6 commits from the briefed `e69a0cc2f` to `3d2fbdf2a`):

- `packages/core/package.json` still `"name": "@rules-as-tests/core", "private": true` — UNTOUCHED (verified, left as-is). ✓ premise holds.
- `exports` map present with 8 entries (2 JSON data + 6 code modules). Brief said "5-module"; actual is 6 code modules — minor count drift, immaterial to the narrow. ✓
- No `files` field, no `.npmignore`. ✓ premise holds (over-ship real).
- Cross-subsystem import cycle confirmed live: `research/synthesizer/validator/installer` form a mutual SCC; `eslint-rules/detector/manifest` are acyclic (grep evidence below). ✓

No item was already-fixed; nothing skipped.

## §1 Step 1 — exports narrowing

### Import-graph evidence (grep, `from '../<sibling>'` per module)

```text
eslint-rules -> (none)          detector -> (none)          manifest -> (none)
research     -> detector, synthesizer, validator
synthesizer  -> detector, eslint-rules, installer, research, validator
validator    -> detector, eslint-rules, installer, research, synthesizer
installer    -> detector, research, synthesizer, validator
```
→ SCC = {research, synthesizer, validator, installer}. Acyclic honest surface = {eslint-rules, detector, manifest, manifest-schema}.

### In-repo package-subpath importer census (`@rules-as-tests/core/<sp>`, excl node_modules, excl core/package.json)

```text
manifest:0  manifest-schema:0  eslint-rules:0  validator:0
detector:2 (meta-factory + docs)  research:1 (meta-factory)
synthesizer:1 (meta-factory)  installer:1 (meta-factory)
```
Templates: consumers receive rules by **file-copy** to `eslint-rules-local/*.mjs` (confirmed in `templates/shared/.prettierignore`), NOT via any core subpath. `install.sh`: zero core-subpath refs. No principle test asserts the exports list (grep clean).

### Decision (technical-decided fork)

Dropped **`./validator`** — the only SCC member with zero in-repo importers → pure over-promise, drops cleanly inside the `packages/core/package.json`-only surface. Kept `research/synthesizer/installer` because the private in-repo `meta-factory` shim consumes them (dropping needs a 2-package edit outside S6 surface). Kept `detector/eslint-rules/manifest/manifest-schema` (honestly-supportable). Fuller narrow → owner-logged, deferred to U9 repo-split (handoff §1).

### RED→GREEN evidence (module resolution against the worktree-edited package.json)

The worktree's `node_modules` symlinks to the **primary checkout** (`readlink node_modules` → `/Users/art/code/rules-as-tests-aif/node_modules`; `@rules-as-tests/core` → primary `packages/core`), so a probe via the worktree's own `node_modules` masks the edit. Probed via an isolated `node_modules` symlink pointing at the worktree's `packages/core`:

```text
BEFORE (unedited exports): validator RESOLVES
AFTER  (edited exports):   BLOCKED  validator | ERR_PACKAGE_PATH_NOT_EXPORTED
                           RESOLVES manifest, manifest-schema, eslint-rules,
                                    detector, research, synthesizer, installer
```

## §2 Step 2 — publish-readiness audit

`npm pack --dry-run --json` on `packages/core`: **549 files, 842.6 kB packed, 3.24 MB unpacked**; **205** `.test.ts`/`.audit.ts`, 91 fixtures, 50 principles, 16 audit-self. Root cause: no `files` field / no `.npmignore`.

Runtime **code** import-closure (all 6 bins + kept exports) = 77 files across `{backends, detector, diagnostics, eslint-rules, installer, ir, research, synthesizer, validator}` + `manifest/`; **zero** test files reachable from runtime entrypoints.

Metadata: `bin` — all 6 targets exist but point at `.ts` (need TS loader); `license` field `FSL-1.1-ALv2` but no LICENSE file in `packages/core`; no `README`, `description`, `repository`; `main` = manifest JSON (intentional). Full analysis + recommended `files` allowlist (with the "validate against step-3 matrix, don't trust static closure" caveat) → handoff §2.

### Decision (technical-decided fork): `files` NOT added in S6

Reversible/minimal branch taken. Reasons: (a) an import-closure allowlist misses by-path assets (`templates/`, `skills/`, `install/*.bundle.mjs`, manifest JSON) → a wrong `files` silently breaks delivery; (b) npm-delivery (step 3) is DEFERRED, so there is **no matrix cell** to validate a `files` field against yet; (c) U10 owns publish and will have the step-3 matrix. Documented recommended allowlist + interim negative-glob option for U10.

## §3 Gates run (before push)

| Gate | Result |
|---|---|
| `scripts/build-synth-bundle.sh --check` | `✓ synth-and-wire.bundle.mjs in sync` |
| `packages/core` `tsc --noEmit` | rc=0 |
| `packages/meta-factory` `tsc --noEmit` (confirms narrow breaks nothing) | rc=0 |

The full gate set runs in the pre-push hook on `git push`. `npm run validate` in this repo is the consumer-facing gate wired at install; the in-repo equivalents (typecheck + synth-bundle + pre-push principle suite) are the reachable local checks and are green.

## §4 Deviations / notes

- Brief "5-module" vs actual 6 code exports — immaterial count drift, recorded.
- Only `./validator` dropped, not the full cyclic set — the meta-factory coupling is the reason; not a shortcut. Fuller narrow is a documented deferred recommendation, not silently skipped.
- No systemic drive-by fixes. One observation for the orchestrator: `packages/meta-factory` is a private re-export shim whose only script is `typecheck`; whether it survives the U9 repo-split (vs. being retired) determines whether the fuller exports narrow needs meta-factory rewiring at all. Surfaced as observation only.

## §5 Handoff

`s6-u10-handoff.md` (same dir) — the U10 publish checklist: name-freeze/private-flip gates, exports narrowing status + deferred remainder, `files` over-ship analysis + recommended allowlist, bin/README/LICENSE/metadata gaps, step-3 wiring plan, rollback doctrine (npm unpublish ≠ rollback per 72h rule; roll forward with patch releases).
