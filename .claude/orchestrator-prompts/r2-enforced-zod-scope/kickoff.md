# R2 `check:enforced` — scope to zod-bearing packages — kickoff

> **Class:** operational kickoff (dispatch input).
> **Authoritative for:** scope of the fix for GH #730 — `check:enforced` (`check-rule-enforced.sh`) demands R2 only on packages that can actually have a Zod boundary (declare `zod`); a zod-less package (e.g. an Expo app) is **N/A**, not a hard fail. Fresh `--full` install on a monorepo with an Expo app → `npm run validate` green.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The R2 *selector* breadth — sibling issue #737 ([r2-zod-aware-selector](../r2-zod-aware-selector/kickoff.md)). The install copy-list — #735.
> **Base branch:** `staging` (NOT `main` — promote manually).
> **Tracking issue:** [#730](https://github.com/artyhoo/rules-as-tests-aif/issues/730) — live repro on timeliner (Expo `apps/mobile`), 3-component disagreement.

## §1 Goal (one phrase)

On a pnpm monorepo containing an Expo/React-Native app (`apps/mobile`, no `zod` dependency, `expo lint`), a fresh `install.sh ts-server --full` → `npm run validate` is **green** out of the box: `check:enforced` skips the zod-less package as N/A while still enforcing R2 on every package that has a real Zod boundary.

## §2 Decision (fixed — do not re-litigate)

**Option 1 (scope `check:enforced` to packages with a zod dependency), auto-detect.** Rationale: R2 is "validation at Zod boundaries"; a package with **no `zod` dependency physically cannot have an unsafe-zod-parse** → N/A is *derived from the rule's own semantics*, not bolted on. Rejected alternatives (per issue §"Fix directions"): option 2 (per-package N/A marker) = manual burden; option 3 (teach the Layer-2 wirer about `expo lint`) = heavy, and RN apps should not enforce R2 (no zod); option 4 (warn only) = not a fix. **Detection = the package declares `zod` in its nearest `package.json` (direct dep or devDep).** (Operator confirmed auto-detect over an explicit marker, 2026-06-26.)

## §3 Grounded current state (verified, file:line, `origin/staging`)

- `packages/core/audit-self/check-rule-enforced.sh:162-167` — the shadow-package loop demands R2 in **every** shadowed package's resolved config; an Expo `apps/mobile` (ships its own `eslint-config-expo` config, no zod) → `✗ … R2 NOT in resolved config … SILENTLY INERT` → exit 1.
- `RULE_GLOBS.boundary` (`packages/preset-next-15-canonical/templates/eslint.config.react.mjs:26`) is broad (`**/src/**`, `**/app/**`), so `apps/mobile/src/app/index.tsx` matches and the package is treated as a boundary scope.
- The R2-N/A marker (`r2-na-marker.sh`, consulted at `check-rule-enforced.sh:38-44`) is **whole-layout**, not per-package: it can't be set here because other packages *do* have real zod boundaries (`r2_na_recheck` → `broke`). There is no way today to declare "R2 N/A for `apps/mobile` only" — hence the per-package zod-relevance approach.

## §4 The task

In `check-rule-enforced.sh`, before demanding R2 on a package (both the shadow loop L162-167 and the root scope L150-159 as applicable): determine whether that package is **R2-relevant** = its nearest `package.json` declares `zod` in `dependencies`/`devDependencies`. If **not** → **skip** it as N/A with a clear log line (`· <pkg>: no zod boundary — R2 N/A (skipped)`), do not call `verify_file`. If **yes** → keep today's `--print-config` enforcement unchanged. A package with zero boundary files is already skipped; this adds the zod-relevance skip on top.

## §5 Scope

**In:** `check-rule-enforced.sh` package-relevance gate (zod-dependency check) + its test. **Out:**
- The R2 selector (`no-unsafe-zod-parse.ts`) — sibling #737. **Shared principle, not shared code:** this is the **package**-granularity arm of "R2 ⟺ zod present"; #737 is the **call-site** arm. Different files, different languages — keep the notion of "has zod" consistent, but do not touch the TS rule here.
- The Layer-2 wirer (`wire-eslint-r2.ts`) — do **not** teach it about `expo lint` (that is rejected option 3).
- The install copy-list — #735.

## §6 Acceptance (deterministic — non-vacuous)

- Monorepo fixture: `apps/api` (has `zod`, real boundary) + `apps/mobile` (no `zod`, `eslint-config-expo`, `src/app/index.tsx`).
- `check-rule-enforced.sh` exits **0**: `apps/mobile` reported skipped ("no zod boundary — R2 N/A"); `apps/api` reported `✓ R2 applied`.
- **Non-vacuity:** if `apps/api` (which *does* have zod) has R2 unwired, the gate still **FAILS** — the skip applies only to genuinely zod-less packages, the false-green-catch for zod packages is preserved.
- Fresh `install.sh ts-server --full` on such a monorepo → `npm run validate` exits 0.

## §7 Build-vs-reuse (per [build-first-reuse-default.md](../../rules/build-first-reuse-default.md))

Reuse the existing shadow-loop + `find`/`package.json` reading already in `check-rule-enforced.sh`; small bash addition, no new tool. Prior-art SSOT to consult/cite in the capability commit trailer: **#118** (`check:enforced` resolved-config gate), **#120** (install auto-wires R2 by reading the repo), **#547 C4** (`r2-na-marker` whole-layout decision — why per-package is the new slice).

## §8 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T3** (actual `check-rule-enforced.sh` output for every claim), **T14** (clean ≠ correct: a `skipped` must be because the package has no zod, not because the check silently passed on nothing — assert both arms), **T15** (self-application: the test fails if the zod-relevance skip is removed AND if a zod package's real inertness stops being caught).

Domain trap **T-R2-SCOPE-A**: tempted to "fix" `apps/mobile` by setting the whole-layout `r2-na-marker` — it breaks (`r2_na_recheck` → `broke`) because sibling packages DO have zod boundaries. The fix is **per-package** zod-relevance inside the gate, not a layout-wide N/A; reaching for the existing marker is the wrong tool (pattern-matching-on-name, T16).

```bash host-verify
# Retro-marked 2026-08-21: §6 acceptance resolves via the existing harness that encodes rule-enforced reach (the skip-for-zod-less-packages behaviour this task scoped)
bash tests/install-sh/gh-535-rule-enforced.test.sh
```
