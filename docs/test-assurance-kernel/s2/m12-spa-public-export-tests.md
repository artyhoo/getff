# S2 M12 — SPA preset public-export test transport (cand-spa-empty-selection)

> **Status:** preparation packet (owned scratch only) — proposed two-path change, no
> actual-root effect. Input: accepted actual `36ba664d…` (tree `067fcd33…`) on
> `codex/tak-s1-d011`. Frozen inputs: INDEPENDENT-EXPECTED-OUTCOMES `dd3b9812…`,
> six public-export controls `2f3f2df0…`, NoFiles premise `4eb50744…`.

## The gap

The SPA preset's package-public export lane had **zero tracked tests**:
`packages/preset-react-spa/eslint-rules/` contained only `index.ts` (the public
re-export of the core `requireErrorBoundary`), the package `vitest.config.ts`
selects `eslint-rules/**/*.test.ts`, so `npm --prefix packages/preset-react-spa
run test` exited **1 — "No test files found"** (premise `4eb50744…`, reproduced in
this packet as the first meaningful RED). Core rule behavior is tested at
`packages/core/eslint-rules/require-error-boundary.test.ts`, but that package test command executed no test cases for
the **package-public transport** — the preset's default plugin and its `rules`
map. This packet adds exactly that lane. It is NOT a core-algorithm repair: the
core rule passes all six frozen controls unchanged.

## The change (exactly two new paths)

1. `packages/preset-react-spa/eslint-rules/index.test.ts` — a real RuleTester
   suite (the installed `@typescript-eslint/rule-tester`, wired to vitest exactly
   like the existing preset-next/core lanes) whose **governed subject is the
   public export** (`import plugin, { rules } from './index.ts'`), not a direct
   core import. One transport-identity case (`plugin.rules[…] === rules[…]`)
   plus the six frozen control cases with `filename: 'src/App.tsx'`:

   | case id | expected |
   |---|---|
   | `bare-app-root` | reject `missingErrorBoundary` |
   | `import-only-boundary` | reject `missingErrorBoundary` |
   | `mounted-boundary` | admit |
   | `member-boundary` | admit |
   | `no-jsx-scope-control` | admit |
   | `declared-first-jsx-exemption` | admit |

2. this document.

Nothing else changes: `vitest.config.ts` (`b6fb45a2…`), `package.json`, the
public `index.ts` (`b31721a5…`), the core rule (`0ece1bd5…`) and every other
source byte are frozen and byte-verified after all runs. The existing selector
already matches `index.test.ts`; no `passWithNoTests` or config weakening is
involved — the original proposal's real-first-test branch, not an empty-selector
waiver.

## Evidence (owned scratch `preparation/spa-scratch-36ba/`)

- **first RED** (`logs/firstred-nofiles.log`): package command EXIT 1,
  `No test files found, exiting with code 1`, selector population = `index.ts`
  only → tracked selected tests 0.
- **Healthy lane** (`logs/healthy-lane.log`, `logs/healthy-cases-verbose.log`):
  EXIT 0, **7/7** — all six frozen cases registered and executed by name
  (explicit reject/admit pairs; no skip/todo); case IDs + expectations frozen
  pre-fault in `logs/frozen-pre-fault.log`.
- **Causal public-binding weakening** (`logs/fault-norule.log`): ONLY the preset
  `index.ts` exported binding was temporarily replaced by a no-op create handler
  (`{ ...requireErrorBoundary, create: () => ({}) }` — meta kept, so no
  unknown-rule/parse crash). Package command **EXIT 1**; exactly the two bad
  cases failed with `Expected 1 / Received 0` (the intended
  `missingErrorBoundary` diagnostic absent — `2 failed | 5 passed`); all four
  good companions plus the identity case still admitted. The test driver, core
  rule and inputs stayed fixed — a real exported-binding fault, not injected
  test results.
- **Restored** (`logs/restored-green.log`): preset `index.ts` restored from the
  byte snapshot (NOT a git checkout/reset) to the exact frozen `b31721a5…`;
  package command EXIT 0, 7/7 again.

## Honest limits

- Six frozen controls are a **limited transport oracle**: they prove the public
  export channel rejects/admits the supplied static in-file examples. They do
  NOT prove SPA app semantics, runtime rendering, cross-file boundary trees,
  glob scoping in consumer configs, or coverage beyond these cases.
- The identity case is a structural binding check, not a behavior claim.
- First healthy-run attempt used a `spa/…` run label that RuleTester parses as a
  plugin reference (config error, zero cases executed); fixed to a slash-free
  label — six case codes/expectations unchanged (`logs/healthy-lane.log` header).

## Cycle accounting

New distinct SPA original atomic budget: cap 5, used before 0; this packet is
author-reported cycle 1. The coordinator conservatively records two authored
verification attempts (initial config-error attempt and corrected executable
carrier), plus this type/comment/document refinement: used 3/5, remaining 2/5.
The initial config error executed zero cases and is not behavioral detection. Prior counters unchanged: GLV 2/5 (3 remain), P51 4/5 (1),
intake 4/5 (1), M15 3/5 (2), AIF 2/2. No borrows, resets or refunds.

Independent exact-source acceptance and later owned-source/shared-generation
gates remain separate later stages; this packet is preparation only.
