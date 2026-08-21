# R2 `no-unsafe-zod-parse` — make the selector Zod-aware — kickoff

> **Class:** operational kickoff (dispatch input).
> **Authoritative for:** scope of the fix for GH #737 — the R2 rule `no-unsafe-zod-parse` flags only genuine **Zod** `.parse()`, not stdlib `.parse()` (`JSON.parse`/`Date.parse`/`path.parse`); plus a paired positive/negative fixture that proves it.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The `check:enforced` package-relevance gate (zod-less packages) — that is sibling issue #730 ([r2-enforced-zod-scope](../r2-enforced-zod-scope/kickoff.md)). The install copy-list — #735.
> **Base branch:** `staging` (NOT `main` — promote manually).
> **Tracking issue:** [#737](https://github.com/artyhoo/rules-as-tests-aif/issues/737) — breadth evidence (3/3 stdlib calls flagged), meta-test gap.

## §1 Goal (one phrase)

The shipped R2 rule fires **only** on a real Zod `schema.parse()` in a boundary file — `JSON.parse(x)`, `Date.parse(x)`, `path.parse(x)` and other stdlib `.parse()` calls in ordinary code are **NOT** flagged (they have no `.safeParse`, so the rule currently emits an unfixable error on correct code).

## §2 Grounded current state (verified, file:line, `origin/staging`)

- `packages/core/eslint-rules/no-unsafe-zod-parse.ts:27` — the selector is `CallExpression[callee.type='MemberExpression'][callee.property.name='parse']` with **no Zod/type check**. It reports **every** member `.parse()` call.
- The rule's own `description` (L17-18) says "Forbid **Zod** `.parse()` in HTTP boundary files" — but the selector matches all `.parse()`. Name/description ≠ behaviour.
- The shipped liveness test verifies the rule with `linter.verify("const s={parse:x=>x};const r=s.parse('x');", …)` — `{parse:x=>x}` is an **arbitrary object, not a Zod schema** — so the test asserts "**any** `.parse()` fires," **codifying** the over-broad selector instead of catching it. There is no negative fixture proving `JSON.parse` is NOT flagged.
- Amplifier: the layout-agnostic glob `**/src/**` now runs R2 across all source, so every `JSON.parse`/`Date.parse` in ordinary code becomes a false positive silenceable only by a per-line `// audit:exempt` — which trains blanket-exemption and defeats the rule.

## §3 The task

1. **Make the selector Zod-aware.** Primary: type-aware via `parserServices.getTypeAtLocation(callee.object)` — the consumer config is `strictTypeChecked`, so type info is available; require the callee object to resolve to a Zod schema type (`ZodType` / a `z.*` schema). Fallback heuristic (when type info is unavailable): receiver imported from `zod`, or named `*Schema` / a `z.*` chain. Decide by what the paired fixture (§5) actually proves — this is a technical call closed by evidence, not a park point.
2. **Rewrite the test as a paired positive/negative** (principle 02): a real Zod `schema.parse(x)` MUST be flagged; `JSON.parse(x)` / `Date.parse(x)` / `path.parse(x)` MUST NOT. The current `{parse:x=>x}` assertion is **removed/replaced** — it asserts the bug.
3. (Optional, if the type-aware selector alone does not fully close it) narrow the rule's `files` globs toward genuine boundary dirs (`**/handlers/**`, `**/routes/**`, `**/controllers/**`, `**/app/api/**`). The selector fix is primary; glob-narrowing is complementary, not a substitute.

## §4 Scope

**In:** `no-unsafe-zod-parse.ts` selector + its test (`no-unsafe-zod-parse.test.ts`) + any shipped copy/regeneration of the rule. **Out:**
- The `check:enforced` gate scoping (zod-less packages) — sibling #730. **Shared principle, not shared code:** #737 makes R2 zod-aware at **call-site** granularity; #730 makes it zod-aware at **package** granularity. Use a consistent notion of "is this Zod"; do not edit `check-rule-enforced.sh` here.
- The install copy-list — #735.

## §5 Acceptance (deterministic — paired, non-vacuous)

- A fixture file with `JSON.parse(x)`, `Date.parse(x)`, `path.parse(x)` → **0** R2 errors.
- A fixture file with a real Zod `Schema.parse(x)` (e.g. `const S = z.object({…}); S.parse(input)`) → **exactly 1** R2 error.
- The negative arm **FAILS** if the selector is reverted to the bare `.parse()` match (proves the test detects the over-broad selector — the gap the shipped test had).
- `make self-audit` green.

## §6 Build-vs-reuse (per [build-first-reuse-default.md](../../rules/build-first-reuse-default.md))

Reuse `@typescript-eslint/utils` `parserServices` — already a dependency, `strictTypeChecked` already configured. **No new dependency.** This is the canonical typescript-eslint type-aware-lint pattern. Capability commit carries a `Prior-art:` trailer (consult the rule's existing SSOT row + typescript-eslint type-aware precedent).

## §7 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T3** (file:line + actual `eslint` output for every claim), **T16** (pattern-matching-on-name — the rule is *named* `no-unsafe-zod-parse` but *behaves* as `no-any-parse`; name ≠ problem-class, verify behaviour), **T15** (self-application: the negative fixture must fail on a reverted selector).

Domain trap **T-R2-SELECTOR-A**: tempted to keep the existing `{parse:x=>x}` test because "it passes" — that test **codifies the bug**. The fix MUST replace it with a real Zod-schema positive + stdlib-`.parse()` negative; leaving the old assertion locks the over-broad selector in and re-greens the very defect this closes (a `#trap-stated-but-not-enforced` shape).

```bash host-verify
# Retro-marked 2026-08-21: §5 names it — "make self-audit green" (covers the wired manifest liveness for no-unsafe-zod-parse)
make self-audit
```
