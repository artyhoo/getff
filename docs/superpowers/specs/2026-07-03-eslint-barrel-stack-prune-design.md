# ESLint barrel stack-stranding fix — design

**Status:** proposed (brainstorming phase)
**Date:** 2026-07-03
**Issue:** [#882](https://github.com/artyhoo/rules-as-tests-aif/issues/882) (scope widened during design — see Scope)

## Problem

`install.sh <stack> --refresh` — and, discovered during design, `install.sh <stack> --force` too — never removes a PRIOR stack's preset-rule files from `eslint-rules-local/` when a consumer re-installs with a DIFFERENT `--stack`. `generate_eslint_barrel()` (`setup.d/lib.sh`) then regenerates the ESLint plugin barrel from an unconditional glob of `eslint-rules-local/*.ts`, so the stale rule gets re-registered into the barrel even though it doesn't belong to the newly-targeted stack.

Confirmed live:

- `install.sh react-next --force` then `install.sh ts-server --force` (or `--refresh`) into the SAME directory leaves `no-server-imports-in-client.{ts,mjs,d.ts}` on disk and re-registers it in the barrel (5 keys instead of the correct 4 for ts-server).
- A fresh `install.sh ts-server --force` into a clean directory correctly produces 4 keys.

Impact today is low: `eslint.config.mjs` is explicitly consumer-owned and never touched by `--refresh` (`install.sh:225`), so the stray barrel entry doesn't activate a live wrong-rule enforcement in the common case. It's real dead-weight/bookkeeping drift, not (yet) a silent-wrong-lint bug — but it's a real, reproducible defect worth closing at its root.

## Scope

Fixes BOTH `--force` and `--refresh` in one change, since both paths already call the same shared `generate_eslint_barrel()` function (`setup.d/lib.sh`) — fixing it there closes both call sites for free. No separate issue is filed for `--force`; issue #882 gets a comment noting the widened scope.

## Approach

**Chosen: stateless prune-to-valid-set**, inside `generate_eslint_barrel()`.

Before generating barrel content (inside the existing `if [ -z "$DRY_RUN" ]` guard), compute the set of basenames valid for the CURRENT run — core rules (always) + the current `$STACK`'s preset rules (if any) — and delete any `eslint-rules-local/*.ts` (+ matching `.mjs`/`.d.ts`) whose basename isn't in that set (excluding `index`).

No persisted state (no new marker file recording "which stack was this originally installed with") — the function only needs to know what's valid NOW, not what was true historically. Verified no such marker currently exists (checked `.ai-factory/`, `preset.meta.json`).

Safe because `eslint-rules-local/` is documented, in two independent places, as 100% framework-owned — a consumer never places its own files there (`setup.d/40-configs.sh:373`, `setup.d/lib.sh:199`).

Side benefit: the same mechanism also self-heals an unrelated drift case — a stale CORE rule file left behind after a rule is renamed/removed upstream — not just a stack-switch leftover.

### Rejected: consolidate the stack→dirs mapping into a new shared function

An earlier draft of this design proposed extracting a new `stack_rule_source_dirs()` helper in `setup.d/lib.sh` and rewriting the existing (working) copy-loops in `setup.d/40-configs.sh` and `install.sh`'s `do_refresh()` to call it, to avoid a 3rd copy of the stack→preset-dir mapping.

Rejected on reflection: this refactors two currently-correct call sites as a side effect of a bug fix, which conflicts directly with this project's own stated convention (`CLAUDE.md`: *"A bug fix doesn't need surrounding cleanup... Three similar lines is better than a premature abstraction"*). The mapping is tiny (one always-included dir + up to two single-line stack branches), changes rarely (new stacks are added deliberately, alongside a lot of other required work), and any future drift between copies would likely be caught by the barrel key-set test added by this change. A small, isolated 3rd copy living only inside `generate_eslint_barrel()` — touching zero other call sites — is the better tradeoff here.

### Rejected: stateful "track originally-installed stack" marker (issue #882 direction #1)

Would require inventing new persisted state (no such marker exists today) to answer a question ("what stack was this installed with before?") the fix doesn't actually need — "what's valid now" is sufficient and simpler.

### Rejected: allow-list + warn without deleting (issue #882 direction #2)

Leaves the barrel technically correct but the stray files remain on disk indefinitely — a weaker, incomplete fix.

## Data flow

`$STACK` (global) → small inline mapping inside `generate_eslint_barrel()` (core dir always + a `case "$STACK" in ... esac` for the preset dir) → set of valid basenames (by re-globbing those PKG_ROOT-relative dirs) → (a) prune step deletes anything in `eslint-rules-local/*.ts` not in that set (+ `.mjs`/`.d.ts` siblings), (b) existing barrel-content generation proceeds unchanged on what remains.

## Error handling

Filesystem-only (`rm`), no network, no new failure modes. Dry-run: the entire `generate_eslint_barrel()` body is already gated behind `[ -z "$DRY_RUN" ]`, so the new prune step inherits that no-op behavior — consistent with the rest of the function, no new granularity introduced.

## Testing

New paired-negative test (mirrors `tests/install-sh/refresh-regenerates-barrel.test.sh`'s style):

1. `install.sh react-next --force` into a fresh fixture → confirm `no-server-imports-in-client.*` present, barrel registers it.
2. Same directory, `install.sh ts-server --force` → assert the react-next-only files are GONE from `eslint-rules-local/`, the barrel does NOT register the rule, and the barrel's key-set exactly equals a fresh `ts-server --force` install's key-set.
3. Repeat step 2's assertion for `--refresh` instead of `--force` (both call sites must be covered, since both share the fix).

Expected RED on current code (pre-fix), GREEN after.

## Known limitation (out of scope for this fix)

The per-workspace / monorepo scenario — where a single root might need to host more than one stack's presets simultaneously — has NOT been verified against current code. Per existing memory, per-workspace preset placement work is heading toward separate per-workspace directories rather than a shared `eslint-rules-local/`, which would make this fix's "prune to single current stack" assumption safe. If that architecture ever changes to share one directory across stacks, this fix needs re-review.

## References

- Issue [#882](https://github.com/artyhoo/rules-as-tests-aif/issues/882)
- `setup.d/lib.sh:486` `generate_eslint_barrel()`
- `tests/install-sh/refresh-regenerates-barrel.test.sh`
