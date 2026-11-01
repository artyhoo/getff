# M05 / A05 — lexical ErrorBoundary ancestor repair (proposal evidence)

> Status: PROPOSED ONLY — prepared in an owned copy; not applied to any actual root.
> Producer under repair: `packages/core/eslint-rules/require-error-boundary.ts`.
> Frozen oracle: `docs/test-assurance-kernel/s2/m05-error-boundary-cases.json`
> (sha256 `688e099f380a2fd15a7eafcad7cfc5eedcebaeb165acb0e4e5715e192c1342fb`, copied
> byte-for-byte from the Root freeze). Authored implement/verify iterations: **2 of cap 3**
> (1 — predicate repair; 2 — loop typing fix caught by core typecheck).

## 1. Defect (A05)

The rule implemented a whole-file `hasErrorBoundaryInJSX` flag: any ErrorBoundary-like
`JSXOpeningElement` anywhere in the file suppressed the diagnostic, including an unrelated
wrapped component (`Preview` before/after `App`) or a wrapped JSX sibling beside an unwrapped
one. That drifted from the documented contract — RULES.react-spa.md §R-SPA-EB Implementation:
"checks for the presence of a JSX element whose name contains ErrorBoundary **as an ancestor in
the file's JSX tree**". Root's source-bound measurement at source840 (ACTUAL-CURRENT-BOUNDARY-
RESULTS.json): all three frozen bad cases missed their diagnostic on both surfaces; all three
good cases admitted.

## 2. Repair (minimal, in-file)

Replaced the whole-file flag with per-element ancestry: each non-boundary
`JSXOpeningElement` walks `node.parent` up to `Program`; if any enclosing `JSXElement` (or
fragment-child position under one) has an ErrorBoundary-like name (identifier or member
expression property), that element is protected. The file reports `missingErrorBoundary` on
the first unprotected element when at least one exists. Preserved unchanged:
ErrorBoundary-like name/member recognition, no-JSX admission, inline-fallback good cases,
and the whole-file first-JSX-line `// audit:exempt` contract.

## 3. Evidence (source-relative, owned copy `preparation/m05-proposal-copy/`)

| Step | Command | Result |
| --- | --- | --- |
| firstRED (unchanged producer at 5a9278c7) | `node --test scripts/test-assurance/s2/m05-error-boundary.test.mjs` | 6 bad subtests fail (`got 0`), 6 good pass; exit 1 |
| repaired green | same + `cd packages/core && npx vitest run eslint-rules/require-error-boundary.test.ts` | native 14/14 exit 0; vitest 19/19 exit 0 |
| K3 permissive fault (original before-image bytes re-applied, sha `0ece1bd5…`) | both suites, fresh processes | native: 8 fail, exactly the 6 bad subtests `got 0` + 2 parents; vitest 6 failed \| 13 passed — failures only at intended new bad assertions |
| K3 reachability probe | faulted TS driven via Linter on `unrelated-wrapped-before-app` | `[]` — diagnostic actually absent |
| K4 v1 fault (boundary-skip removal) — **ineffective, superseded** | both suites | stayed green (14/14, 19/19): the ancestor walk's first step is the element's own `JSXElement`, so a boundary self-protects; fault behaviorally neutralized, honestly recorded |
| K4 v2 fault (exit gate ignores ancestry: `if (!hasJSX || !hasUnprotectedJSX) return;` → `if (!hasJSX) return;`) | both suites, fresh processes | native 8 fail = 6 good controls `expected 0 diagnostic(s), got 1 (missingErrorBoundary)` + 2 parents; vitest 9 failed \| 10 passed (old valid #1–#3 + frozen good ×2 surfaces); no-JSX and audit:exempt stay admitted; no infra errors |
| restoration + final green | restore exact bytes, stock compile, both suites | native 14/14 exit 0; vitest 19/19 exit 0 |
| core typecheck | `cd packages/core && npm run typecheck` | iteration 1 caught TS2367/TS2322 in the walk loop (precise `JSXOpeningElement.parent` typing); fixed with the repo idiom `TSESTree.Node \| undefined` (no-vacuous-assertion.ts:67); final exit 0 |
| SPA package suite | `cd packages/preset-react-spa && npm test` | 7/7, exit 0 (public export unchanged) |
| P51 corpus conformance | `npx vitest run principles/51-test-quality-corpus-conformance.test.ts` | 10/10 with the new material staged |
| stock twin drift gate | `bash scripts/build-shipped-eslint-rules.sh --check` | exit 0 — `.mjs` in sync with final `.ts`; `.d.ts` byte-identical to HEAD (no public type change) |
| dist/runtime checks — **HELD** | `node scripts/build-runtime-bundles.mjs --check`; `bash scripts/build-getff-dist.sh --check` | both RED by predicted staleness only: getff dist DRIFT on exactly the 3 changed tracked paths; rule-bootstrap-cli bundle would embed the changed rule (fresh-build diff). Outputs deliberately NOT regenerated — later delivery gate owns them |

## 4. Scope and honest limits

- Lexical in-file ancestry only, per SSOT #140 scope CONSTRAINT v1: no cross-file
  boundary-tree walk, no runtime/function-call rendering analysis. A boundary applied via a
  wrapper function that renders `children` inside itself is NOT recognized unless the call
  site's JSX tree shows it.
- An import alone still protects nothing (import produces no `JSXOpeningElement`).
- `extractJSXElementName` limits: a member expression is recognized via its property
  (`Sentry.ErrorBoundary`), a plain object identifier otherwise falls back to the object name
  only when the property is not boundary-like — exotic tag expressions (`x['Error-Boundary']`)
  are out of scope.
- No universal component semantics claimed; native/Next framework conventions
  (error.tsx, errorElement) are a different class and untouched.
- Installed consumer ESLint/config proof is NOT simulated here: it belongs to the later gate
  after accepted actual source and fresh reciprocal derived generation.

## 5. Proposal artifacts

Patch + parent/tree/commit-object ids and per-path postimage hashes:
`preparation/` (REPORT.md, AFTER-STATE.json, SHA-MANIFEST.txt, m05-proposal.patch).
No actual source, generated output, public/native integration or manifest effect was
produced by this packet.
