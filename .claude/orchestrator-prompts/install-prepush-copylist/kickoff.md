# install.sh pre-push copy-list completeness — kickoff

> **Class:** operational kickoff (dispatch input).
> **Authoritative for:** scope of the fix for GH #735 — `install.sh` ships the COMPLETE import graph of `pre-push.ts` so the full TS-core pre-push hook runs (never crashes `ERR_MODULE_NOT_FOUND`) on a fresh consumer; plus a drift guard so the copy-list cannot fall behind the import graph again.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The consumer-side `.ts`-rule-loading fix (barrel TS→JS compilation) and REDUCED-mode WARN visibility — those belong to [enforcement-liveness-fix](../enforcement-liveness-fix/kickoff.md) (U2), see §4 carve-out.
> **Base branch:** `staging` (NOT `main` — promote manually).
> **Tracking issue:** [#735](https://github.com/artyhoo/rules-as-tests-aif/issues/735) — full evidence, corrected scope table, repro.

## §1 Goal (one phrase)

On a fresh consumer, after `./setup -y ts-server`, the real git pre-push hook (`bash .husky/pre-push …`) loads **without** `ERR_MODULE_NOT_FOUND` and runs its FULL substance checks — it never hard-crashes because a check module its `pre-push.ts` imports was not shipped.

## §2 Grounded current state (verified, file:line, `origin/staging`)

`pre-push.ts` reaches **five** check modules; `install.sh` ships **two**:

| module in `pre-push.ts` import graph | line | import kind | shipped by install.sh? | failure when missing |
|---|---|---|---|---|
| `checks/prior-art.ts` | 30 | static | ✓ | — |
| `checks/s17.ts` | 31 | static | ✓ | — |
| `checks/unpinned-tool-install.ts` | 32 | **static** | ✗ | **hard crash at load** — `ERR_MODULE_NOT_FOUND`, push aborted (the issue headline) |
| `checks/guard-liveness.ts` | 405 | dynamic `await import()` | ✗ | `die()` → `process.exit(1)` when the guard-liveness gate fires |
| `checks/cmd-script-liveness.ts` | 469 | dynamic `await import()` | ✗ | `die()` → `process.exit(1)` when the cmd-script gate fires |
| `packages/core/eslint-rules/index.ts` + its 4 rule files | transitive (via `guard-liveness.ts`) | static-in-that-module | ✗ | guard-liveness `die()`s on load even after the 3 checks ship |

- `install.sh:322-328` copy-list (`for _ts in … done`) ships only `pre-push.ts`, `utils/run-check.ts`, `utils/git.ts`, `checks/prior-art.ts`, `checks/s17.ts`.
- `die()` is `pre-push.ts:191` = `process.exit(1)` — confirmed push-blocking, not a warning.
- The static crash (`unpinned-tool-install.ts`) fires **before any gate runs**, masking the two downstream dynamic `die()`s — shipping only that one module just moves the failure downstream. Ship the **complete** graph.

## §3 The task

1. **Extend the `install.sh` copy-list** (`install.sh:322-328`) to ship the full graph: add `checks/unpinned-tool-install.ts`, `checks/guard-liveness.ts`, `checks/cmd-script-liveness.ts`, and the transitive `packages/core/eslint-rules/index.ts` + the 4 rule files it re-exports (`no-unsafe-zod-parse`, `no-direct-time-randomness`, `require-otel-span`, `restricted-syntax-audit-exempt`) into `packages/core/eslint-rules/` on the consumer.
2. **Add a drift guard test** that parses `pre-push.ts` (and the checks it reaches) for every `'./checks/*.ts'` / `'./utils/*.ts'` / `'../../eslint-rules/*'` reference — **static `import` AND dynamic `await import()`** — and asserts each resolved module is present in the install copy-list (or already shipped). This is the same class as `packages/core/principles/21-shipped-agent-tools-valid.test.ts` (#551). It must FAIL if any copy-list entry is removed (non-vacuity).

## §4 Scope

**In:** the `install.sh` copy-list completeness + the drift-guard test. **Out / carve-out (do NOT touch — single owner per concern):**
- `setup.d/40-configs.sh` (consumer barrel TS→JS compilation) — owned by [enforcement-liveness-fix](../enforcement-liveness-fix/kickoff.md) S2.
- `pre-push.fallback.sh` REDUCED-WARN messaging — owned by enforcement-liveness-fix S4.
- The R2 selector breadth (`no-unsafe-zod-parse.ts`) — separate issue #737.

Touching those is a scope violation; this fix is the `install.sh` copy-list slice only.

## §5 Acceptance (deterministic — the worker proves done, not asserts)

- Fresh consumer (clean-baseline, no AIF artifacts) → `./setup -y ts-server` → `ls packages/core/hooks/checks/` shows all three checks present.
- `printf 'refs/heads/x <sha> refs/heads/x 0000…0\n' | bash .husky/pre-push origin https://example.invalid/r.git` exits **0** (no `ERR_MODULE_NOT_FOUND`), on Node v22.x **and** v24.x.
- A planted-violation push is **FLAGGED by the full hook** (not crashed).
- The drift-guard test goes **RED** when any one copy-list entry is deleted (proves it actually detects absence).

## §6 Build-vs-reuse (per [build-first-reuse-default.md](../../rules/build-first-reuse-default.md))

Reuse the existing copy-list `refresh_safe` mechanism — no new install machinery. The drift guard reuses the established allow-list-gate pattern from `21-shipped-agent-tools-valid.test.ts` (#551) — REUSE, not a new framework. Capability commits carry a `Prior-art:` trailer citing the #551 precedent.

## §7 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this fix: **T3** (every finding has command-output / file:line, no prose-only claims), **T10** (enumerate the FULL import graph — static AND dynamic — before claiming the copy-list complete; the headline module is only 1 of 5), **T15** (self-application: the drift guard must itself fail when mutated), **T19** (own cold-QA: actually run a fresh install and the hook, don't trust the diff — CI form-checks, not consumer behaviour).

Domain trap **T-PREPUSH-COPYLIST-A**: tempted to ship only `unpinned-tool-install.ts` (the crash headline) and stop — the static crash **masks** the two downstream dynamic `die()`s (`guard-liveness`, `cmd-script-liveness`) and the transitive eslint-rules barrel. Enumerate every module reachable from `pre-push.ts` via static `import` *and* `await import()`, per the issue's corrected table; a fix that resolves only the headline is the 2nd recurrence, not a fix.

```bash host-verify
# Retro-marked 2026-08-21: §5 bullet 2 verbatim with the placeholder SHAs zeroed (the no-op deletion shape)
printf 'refs/heads/x 0000000000000000000000000000000000000000 refs/heads/y 0000000000000000000000000000000000000000\n' | bash .husky/pre-push origin https://example.invalid/r.git
```
