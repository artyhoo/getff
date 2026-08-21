# preset-react-spa-iphase — build the React-19 SPA preset (#646 Stage 1, I-phase)

- **Type:** implementation (capability commits). Builds a new shipped preset.
- **Opened:** 2026-06-22.
- **Base:** staging.
- **Issue:** [#646](https://github.com/Yhooi2/rules-as-tests-aif/issues/646) Stage 1 (curated bridge). R-phase is **merged** — this is the I-phase.
- **Sibling task (parallel):** `preset-react-native-iphase` builds the RN preset in its own worktree. Independent directory — no shared files with this task.

## What

Build `packages/preset-react-spa/` for **React 19 SPA on Vite** (no SSR, no server actions), mirroring the layout of the existing `packages/preset-next-15-canonical/`. This is a deterministic, hand-authored preset (Stage 1 curated bridge); no LLM at runtime.

The verdicts are **already decided** by the merged R-phase — you IMPLEMENT them, you do not re-research. Read the full verdicts before writing code:

- **Verdicts (SSOT):** `docs/meta-factory/research-patches/2026-06-20-react-spa-rules-rphase.md` §1 + `docs/meta-factory/prior-art-evaluations.md` rows **#136–#141**.
- **Layout to mirror:** `packages/preset-next-15-canonical/` (study its `package.json`, `eslint-rules/index.ts`, one rule + its `.test.ts`, `templates/`, `audit-self/`, `RULES.md` headers).
- **Design context:** `docs/superpowers/specs/2026-06-19-multi-stack-hybrid-design.md` §3, §5.

## Already decided — do NOT re-litigate

| Candidate | Verdict | Action |
|---|---|---|
| JSX/React static correctness (#136) | **ADOPT** | `eslint-plugin-react` — wire into the preset's eslint config (already in `install.sh` REACT_DEVDEPS:1361). No custom rule. |
| Rules-of-Hooks + exhaustive-deps + Compiler (#137) | **ADOPT v6** | `eslint-plugin-react-hooks@^6` — v6 merged the deprecated `eslint-plugin-react-compiler` into the `react-hooks/` namespace. Wire the recommended flat config. |
| Static a11y (#138) | **ADOPT** | `eslint-plugin-jsx-a11y` — `jsxA11y.flatConfigs.recommended`. (jsx-a11y IS correct for SPA — web ARIA/DOM; this is NOT the RN case.) |
| Import-boundary presentation↛domain (#139) | **ADOPT** | `eslint-plugin-boundaries` / dependency-cruiser (own-stack, SSOT #119). NOT a from-scratch BUILD. Custom AST only for inline-logic residue, **YAGNI until a corpus demonstrates need** — do not build it speculatively. |
| Error-boundary **presence** (#140) | **BUILD** | `eslint-rules/require-error-boundary.ts` — the ONE custom rule. See spec below. |
| `@eslint-react` as primary plugin (#141) | **WATCHLIST** | Do NOT adopt as primary. `eslint-plugin-react` stays primary (dual-implementation-discipline). |

**The single BUILD — `require-error-boundary` (#140), spec:**

- Upstream `eslint-react/error-boundaries` validates error-boundary *usage* (try/catch → boundary), **NOT presence**. WebSearch ×3 confirmed no production rule enforces boundary *presence* at app-root/route level. Vite SPA has no Next `error.tsx` / React-Router `errorElement` convention → genuine gap. This is the build-first-reuse-justified BUILD.
- **AST-over-grep (principle 03):** mirror the AST-visitor pattern of `packages/preset-next-15-canonical/eslint-rules/require-use-server-directive.ts` (RuleCreator → meta → create() with a Program/JSX visitor). Do NOT implement as a string grep for `ErrorBoundary`.
- **Scope CONSTRAINT v1 (load-bearing):** keep the rule **narrow** — in-file check at the app-root / top-level-route component only (per SSOT #115 brittleness precedent: an over-broad cross-file boundary-tree walk is brittle and was the failure mode there). If the narrow in-file check proves infeasible, **demote to a principle-test channel** rather than shipping a brittle lint rule — surface that as a finding, do not force it.
- **Paired negative test (principle 02):** `require-error-boundary.test.ts` with RuleTester — ≥1 valid case (boundary present) + ≥1 invalid case (app-root without boundary) + an `// audit:exempt` escape case (mirror the Next rule's exempt handling).

## Build — deliverables (mirror `preset-next-15-canonical`)

```text
packages/preset-react-spa/
├── package.json                    # name @rules-as-tests/preset-react-spa; peerDeps {@rules-as-tests/core:*}; copy devDeps + tsconfig.json + vitest.config.ts VERBATIM from next preset (stack-agnostic) — MUST include @typescript-eslint/rule-tester (RuleTester won't run without it) + @typescript-eslint/utils + typescript + vitest
├── tsconfig.json
├── vitest.config.ts
├── RULES.md                        # canonical R1–R11 (copy/adapt from next preset; Authoritative-for header — principle 09)
├── RULES.react-spa.md              # SPA-specific rule extension doc (Authoritative-for + NOT-authoritative-for headers)
├── eslint-rules/
│   ├── index.ts                    # exports the plugin { rules: { 'require-error-boundary': ... } }
│   ├── require-error-boundary.ts          # the ONE custom rule (AST; spec above)
│   └── require-error-boundary.test.ts     # paired valid/invalid (principle 02)
├── audit-self/
│   └── audit-ai-docs.react-spa.sh  # pre-push doc checks (mirror audit-ai-docs.react-next.sh)
└── templates/
    ├── eslint.config.react.mjs     # SELF-CONTAINED — React/hooks/jsx-a11y/boundaries; NO @next/eslint-plugin-next
    ├── ARCHITECTURE.react-spa.md   # SPA architecture rationale (Authoritative-for header)
    ├── vitest.config.ts
    ├── playwright.config.ts
    └── github-actions-ci-ui.yml    # CI workflow (adapt from next; drop Next-specific steps)
```

**Critical structural fact (corrects the design-spec wording):** `eslint.config.react.mjs` is **NOT a shared file** — it lives only inside each preset. `@next/eslint-plugin-next` appears only inside the next preset's OWN files (`package.json:17` peerDep + `templates/eslint.config.react.mjs:3,7` import and `:179-185` plugin usage) — never in a shared/parent template. So you write your OWN self-contained config WITHOUT the Next plugin, plus a parallel `package.json` with its own peerDeps. You do **not** mutate any shared template, and the Next path stays byte-identical automatically because you never touch it.

## Smoke-verify before declaring done (R-phase open items — discharge these)

1. **#137 Compiler rules load:** wire `eslint-plugin-react-hooks@^6` flat config into a real `eslint.config.mjs` and confirm the React-Compiler rules (now in `react-hooks/` namespace) actually load + a synthetic violation fires. Do NOT author any doc telling consumers to install standalone `eslint-plugin-react-compiler` — those rules live in `eslint-plugin-react-hooks@^6` now.
2. **#140 BUILD fires:** the `require-error-boundary` rule must fail against a synthetic app-root-without-boundary fixture and pass with one present. A rule that cannot fail when violated is dropped, not shipped (project tenet).
3. **#139 DeepWiki re-probe:** the react-spa R-phase carried two **provisional** (WebSearch-only) negative-existence claims. Before the #139/#140 capability commits land, re-run DeepWiki `ask_question` on `javierbrea/eslint-plugin-boundaries` and `Rel1cx/eslint-react` (≥3 phrasings) to upgrade them. If DeepWiki contradicts the verdict, STOP and surface — do not silently ship a falsified verdict (this is exactly what happened to the RN web-globals claim, corrected in #651).

## Out of scope (HARD boundary — these belong to the integration task)

- ❌ Do **NOT** edit `install.sh` (arg parser, menu, auto-detect, SHIPPED_DOCS, copy-blocks, dev-dep arrays). The `install.sh` wiring for BOTH presets is a single separate task (`multi-stack-install-wiring-iphase`) that runs after this one merges — editing it here causes an egress conflict with the parallel RN task.
- ❌ Do **NOT** edit `packages/core/principles/*` (principle 05 hardcoded RULES.md path, principle 09 REQUIRED_HEADER_DOCS / SHIPPED_DOC_PREFIXES). Registration of the new preset into those gates is the integration task's job.
- ❌ Do **NOT** edit `packages/preset-next-15-canonical/**`, any manifest/rules-lock, or `docs/meta-factory/prior-art-evaluations.md` (SSOT rows #136–#141 already exist — **cite, never append**; editing it collides with the parallel RN task on egress). Next path stays byte-identical.
- ❌ Do **NOT** create the PR or push to staging — egress (harvest) is the orchestrator's job. Commit per-capability in the container; the orchestrator harvests.
- Touch **only** `packages/preset-react-spa/**`.

## Acceptance criteria

- `packages/preset-react-spa/` exists, mirrors the next-preset layout.
- `cd packages/preset-react-spa && npm run typecheck` → exit 0.
- `require-error-boundary.test.ts` passes under vitest/RuleTester with ≥1 valid (boundary mounted at root) + **2 invalid** (no boundary; boundary imported-but-not-mounted, per T-MS-A) + 1 `// audit:exempt` case.
- The preset's `eslint.config.react.mjs` loads cleanly (react + react-hooks@6 + jsx-a11y + boundaries) against a sample SPA fixture; the custom rule fires on its synthetic violation.
- `RULES.md`, `RULES.react-spa.md`, `templates/ARCHITECTURE.react-spa.md` carry valid `Authoritative for:` headers (principle 09 format — study an existing one).
- All three smoke-verify items discharged with evidence (command output / file:line), not prose.
- Each new ≥80-LOC file carries a `Prior-art:` trailer referencing the relevant SSOT row (#136–#141) — see CLAUDE.md «Build-vs-reuse invariant».

## Capability-commit discipline

`require-error-boundary.ts` (new ≥80-LOC file under `packages/`) is a **capability commit** → carries a `Prior-art:` trailer citing `prior-art-evaluations.md#140` (verdict BUILD — presence-gap confirmed, no upstream analog). ADOPT wiring (plugins already in SSOT #136–#139) is config, not new capability — but if any added file crosses the ≥80-LOC threshold, trailer it too. The SSOT rows already exist (R-phase recorded them); you cite, you do not append.

## AI-laziness traps (`.claude/rules/ai-laziness-traps.md` §2 — active for this I-phase)

Active canonical traps: **T3**, **T11**, **T13**, **T15**, **T16**.

- **T3** (no prose-only findings) — every smoke-verify + acceptance item needs command output or file:line, not "looks correct".
- **T11** (designing without prior-art) — the R-phase already did the prior-art work; do NOT re-derive verdicts, but DO discharge the #139 DeepWiki re-probe the R-phase explicitly left open.
- **T13** (ADOPTED ≠ zero-work) — the four ADOPT plugins must be *verified to actually load and fire* in the flat config, not assumed-good because upstream is mature.
- **T15** (self-application) — the preset's own RULES/ARCHITECTURE docs must satisfy the same doc-authority headers the framework enforces on consumers.
- **T16** (pattern-matching-on-name) — `eslint-react/error-boundaries` SOUNDS like it covers our need but validates *usage*, not *presence*; that name-vs-function gap is the whole reason #140 is BUILD. Do not "discover" it solves presence and cancel the BUILD.
- **Domain-specific — T-MS-A:** when implementing `require-error-boundary`, the AI is tempted to grep for an `ErrorBoundary` **string presence** anywhere in the file rather than AST-verify the component is an *ancestor of the app-root render tree*. String-presence passes a file that imports but never mounts a boundary. Counter: AST ancestor check per the scope constraint; the paired-negative test must include a "boundary imported but not mounted at root" invalid case.

## §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) (eslint rules are deterministic AST, zero API calls; the DeepWiki re-probe is author-time on the worker's own subscription, not CI); [build-first-reuse-default.md](../../rules/build-first-reuse-default.md) (4 ADOPT + 1 BUILD — BUILD justified by confirmed presence-gap, #140); [doc-authority-hierarchy.md §2-§3](../../rules/doc-authority-hierarchy.md) (all shipped docs carry headers).
- **Backward-check:** implements the merged react-spa R-phase verdicts (#136–#141); supersedes nothing; the design-spec §6 "de-Next-ify shared templates" wording is corrected here per the structural recon (config is per-preset, not shared).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
