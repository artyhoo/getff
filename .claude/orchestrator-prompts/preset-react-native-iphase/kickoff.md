# preset-react-native-iphase — build the React-Native preset, Expo + bare (#646 Stage 1, I-phase)

- **Type:** implementation (capability commits). Builds a new shipped preset.
- **Opened:** 2026-06-22.
- **Base:** staging.
- **Issue:** [#646](https://github.com/Yhooi2/rules-as-tests-aif/issues/646) Stage 1 (curated bridge). R-phase is **merged** — this is the I-phase.
- **Sibling task (parallel):** `preset-react-spa-iphase` builds the SPA preset in its own worktree. Independent directory — no shared files with this task.
- **Scope decision (operator, 2026-06-22 — REVISED from Expo-only):** **BOTH baselines.** Ship `eslint-config-expo/flat` (#142, Expo path) **and** `@react-native/eslint-config` (#143, bare-RN path) as two selectable baselines over a shared RN rule layer. Rationale: the project goal is **multi-stack + a factory for any stack** ([README.md#why-this-exists](../../README.md#why-this-exists)) — covering both the Expo and the bare-RN consumer up front serves that goal directly; restricting to Expo-only would under-serve it. This supersedes the earlier Expo-only call (which leaned YAGNI; the operator weighted the multi-stack goal higher).

## What

Build `packages/preset-react-native/` for **React Native — both Expo and bare RN**, mirroring the layout of `packages/preset-next-15-canonical/`. Deterministic, hand-authored (Stage 1 curated bridge); no LLM at runtime.

Verdicts are **already decided** by the merged R-phase — IMPLEMENT, don't re-research. Read before coding:

- **Verdicts (SSOT):** `docs/meta-factory/research-patches/2026-06-20-react-native-rules-rphase.md` §1 + `docs/meta-factory/prior-art-evaluations.md` rows **#142–#148**.
- **Layout to mirror:** `packages/preset-next-15-canonical/`.
- **Design context:** `docs/superpowers/specs/2026-06-19-multi-stack-hybrid-design.md` §3, §5, §8.

## Already decided — do NOT re-litigate

| Candidate | Verdict | Action |
|---|---|---|
| Expo ESLint baseline (#142) | **ADOPT — ship** | `eslint-config-expo/flat` as the **Expo-path baseline**. **CRITICAL (file-verified #651):** its globals block spreads `...globals.browser` + sets `window:false` ≡ *whitelists* web globals — it does **NOT forbid** them. So it does NOT close #146; you MUST add the denylist in the shared layer. |
| Bare-RN baseline (#143) | **ADOPT — ship (REVISED: now shipped, not swap-only)** | `@react-native/eslint-config` (official RN-core flat config) as the **bare-RN-path baseline**, a second selectable baseline. (R-phase also named `@callstack/eslint-config` as a more-maintained alternative — pick `@react-native/eslint-config` as the official default; note `@callstack` in ARCHITECTURE as the swap.) |
| RN style/text rules (#144) | **ADOPT** + WATCHLIST | `eslint-plugin-react-native@^5` — `no-inline-styles`, `no-color-literals`, `no-unused-styles`, etc. In the **shared RN layer** (applies to both baselines). Not bundled by either baseline → add explicitly. WATCHLIST: if it breaks under future ESLint → migrate to `@callstack` bundle. |
| RN a11y (#145) | **ADOPT** | `eslint-plugin-react-native-a11y` (Nearform) in the shared layer. **Supersedes jsx-a11y for RN** — jsx-a11y targets web ARIA/DOM (wrong problem-class for RN). Do NOT wire jsx-a11y here. |
| Forbid web-only globals/DOM (#146) | **ADAPT (config, not BUILD)** | core ESLint `no-restricted-globals` denylist (`window`, `document`, `localStorage`, DOM APIs) in the shared layer. **REQUIRED primary mechanism, not optional** — the Expo baseline whitelists them (see #142); bare-RN must forbid them too. Custom AST residue is **YAGNI** until a corpus demands it. |
| Enforce StyleSheet.create (#147) | **ADOPT (not a BUILD)** | `react-native/no-inline-styles` (from #144) drives StyleSheet.create adoption. NOT a from-scratch rule. |
| Prefer FlashList over FlatList (#148) | **REJECT the BUILD** | No upstream rule exists; perf-opinion not a correctness invariant; 2026 landscape is three-way (FlatList/FlashList/LegendList). Do **NOT** ship a custom rule. OPTIONAL: a **commented, default-off** `no-restricted-imports` snippet in the shared layer, nothing in `eslint-rules/`. |

**Net: ZERO from-scratch custom rules; TWO baselines over one shared rule layer.** Zero-BUILD is a *build-first-reuse success* (design-spec §8). The preset is config-wiring of two upstream baselines + the shared layer (style/a11y plugins + `no-restricted-globals` denylist).

**Acceptance note on "≥1 custom rule per stack":** the issue's sketch said each stack ships a custom rule, but the R-phase REJECTED all RN BUILDs on merit. Per design-spec §8 this is explicitly tolerated. RN's **target antipattern — web-only globals leaking into RN code — is caught by the `no-restricted-globals` denylist (#146)** in the shared layer, satisfying "catches its target antipattern" without a custom `eslint-rules/*.ts`. If `eslint-rules/` ends up empty, that is correct; do not invent a rule to fill it.

## Build — deliverables (mirror `preset-next-15-canonical`, RN-adapted, BOTH baselines)

```text
packages/preset-react-native/
├── package.json                      # name @rules-as-tests/preset-react-native; peerDeps {@rules-as-tests/core:*}; devDeps: eslint-config-expo, @react-native/eslint-config, eslint-plugin-react-native@^5, eslint-plugin-react-native-a11y (+ copy tsconfig.json + vitest.config.ts verbatim from next preset). NO main/exports → eslint-rules (see note below)
├── tsconfig.json
├── RULES.md                          # canonical R1–R11 (Authoritative-for header — principle 09)
├── RULES.react-native.md             # RN-specific rule extension doc (Authoritative-for + NOT-authoritative-for headers); documents BOTH baselines + when to pick which
├── audit-self/
│   └── audit-ai-docs.react-native.sh # pre-push doc checks (mirror audit-ai-docs.react-next.sh)
└── templates/
    ├── eslint.config.rn-common.mjs   # SHARED RN layer: eslint-plugin-react-native + react-native-a11y + no-restricted-globals denylist (#146) + optional commented FlashList no-restricted-imports. Imported by both baselines (DRY). NO @next plugin, NO jsx-a11y.
    ├── eslint.config.expo.mjs        # Expo baseline: eslint-config-expo/flat + spreads rn-common
    ├── eslint.config.bare-rn.mjs     # bare-RN baseline: @react-native/eslint-config + spreads rn-common
    ├── ARCHITECTURE.react-native.md  # RN architecture rationale + Expo-vs-bare baseline choice + @callstack swap note (Authoritative-for header)
    ├── vitest.config.ts
    └── github-actions-ci-ui.yml      # RN/Expo CI workflow (adapt from next)
```

Notes:
- **Two baselines, one shared layer (DRY):** extract the style/a11y/denylist rules into `eslint.config.rn-common.mjs`; each baseline config imports + spreads it. If a worker finds a clean reason the two baselines can't share (config-shape mismatch), self-contained duplication of the ~10-rule layer is an acceptable fallback — surface the reason, don't silently diverge the two.
- **Which baseline a consumer gets** is an install-time choice (Expo deps present → Expo baseline; else bare-RN) — that wiring is the separate `multi-stack-install-wiring-iphase` task, NOT this one. This task only ships both config files + the common layer.
- **No `eslint-rules/` custom rules expected** (zero BUILD). **Decision:** OMIT the `eslint-rules/` directory entirely — the preset ships its value via `templates/` (configs) + `RULES.*.md` (docs), not as an importable JS plugin. Consequently `package.json` has **no `main`/`exports` pointing to `eslint-rules/index.ts`** (unlike the next preset) — that is correct, not a defect. Do NOT invent an empty rules plugin just to mirror the field.
- **Playwright is web-only** — RN does not use it. Omit `playwright.config.ts`; if an e2e stub is wanted, note Detox/Maestro in ARCHITECTURE, do not wire playwright.
- **Self-contained config (corrects design-spec wording):** these eslint configs are per-preset, not shared with other presets. You do NOT touch `preset-next-15-canonical` or any cross-preset template. Next path stays byte-identical because you never touch it.
- **CI template (`github-actions-ci-ui.yml`) must lint clean under `zizmor`** — shipped CI workflows under `packages/` are zizmor-gated (recently hardened on staging); adapt from next but verify it lints clean, do not assume (T13: adopted CI yaml ≠ zero-work).

## Smoke-verify before declaring done (R-phase open items + both-baseline checks — discharge these)

1. **#144 `eslint-plugin-react-native@^5` flat-config:** no published v5 flat-config example surfaced in the R-phase (peer-dep `eslint ^9` is necessary, not sufficient). Wire `react-native/no-inline-styles` into a real flat config, confirm it loads AND fires on an inline-style fixture. If it does not load under flat config, surface it (WATCHLIST trigger → consider `@callstack` bundle), do not fake-pass.
2. **#145 `eslint-plugin-react-native-a11y` flat-config completeness:** confirm all its rules load under flat config before the ADOPT lands.
3. **#146 denylist actually forbids:** confirm `no-restricted-globals` flags `window`/`document`/`localStorage` in an RN fixture **despite** the Expo baseline whitelisting them (the denylist is a *separate rule key* from the globals whitelist, so it fires additively — confirm it is present and effective, not a key-collision to "win"). This is the load-bearing correction from #651 — prove it, don't assume it. **Test it under BOTH baselines** (Expo whitelists web globals; the denylist must fire under the Expo config specifically).
4. **Both baselines load:** `eslint.config.expo.mjs` AND `eslint.config.bare-rn.mjs` each load cleanly against a sample RN fixture and apply the shared-layer rules. `@react-native/eslint-config` flat-config compatibility under ESLint v9 must be verified, not assumed (same caveat as #144).

## Out of scope (HARD boundary — these belong to the integration task)

- ❌ Do **NOT** edit `install.sh`. The wiring for BOTH presets (incl. the Expo-vs-bare baseline selection) is the single separate `multi-stack-install-wiring-iphase` task that runs after this merges — editing here conflicts with the parallel SPA task on egress.
- ❌ Do **NOT** edit `packages/core/principles/*` (principle 05 / 09 registration is the integration task's job).
- ❌ Do **NOT** edit `packages/preset-next-15-canonical/**`, any manifest/rules-lock, or `docs/meta-factory/prior-art-evaluations.md` (SSOT rows #142–#148 already exist — **cite, never append**; editing it collides with the parallel SPA task on egress). Next path byte-identical.
- ❌ Do **NOT** create the PR or push — egress (harvest) is the orchestrator's job.
- Touch **only** `packages/preset-react-native/**`.

## Acceptance criteria

- `packages/preset-react-native/` exists, mirrors the next-preset layout (RN-adapted), with BOTH baseline configs + the shared `rn-common` layer.
- `cd packages/preset-react-native && npm run typecheck` → exit 0.
- **Both** `eslint.config.expo.mjs` and `eslint.config.bare-rn.mjs` load cleanly (their baseline + shared react-native + react-native-a11y + no-restricted-globals) against a sample RN fixture.
- All four smoke-verify items discharged with evidence (command output), not prose — especially #146 (denylist beats the Expo whitelist) and both-baselines-load.
- `RULES.md`, `RULES.react-native.md`, `templates/ARCHITECTURE.react-native.md` carry valid `Authoritative for:` headers (principle 09 format); ARCHITECTURE documents the Expo-vs-bare choice.
- ZERO custom `eslint-rules/*.ts` is acceptable (build-first-reuse success); web-globals antipattern caught by the #146 denylist in the shared layer.

## Capability-commit discipline

The new preset adds explicit dependencies (`eslint-config-expo`, `@react-native/eslint-config`, `eslint-plugin-react-native`, `eslint-plugin-react-native-a11y`) in its `package.json` → **capability commit** → `Prior-art:` trailer citing `prior-art-evaluations.md#142` (Expo baseline) / `#143` (bare-RN baseline) / `#144` / `#145` (verdicts ADOPT — upstream solves the problem-class). The denylist config (#146 ADAPT) cites `#146`. The SSOT rows already exist (R-phase recorded them); you cite, you do not append.

## AI-laziness traps (`.claude/rules/ai-laziness-traps.md` §2 — active for this I-phase)

Active canonical traps: **T3**, **T13**, **T15**, **T16**.

- **T3** (no prose-only findings) — every smoke-verify needs command output, especially the #146 denylist proof and both-baselines-load.
- **T13** (ADOPTED ≠ zero-work) — all FIVE ADOPT items (two baselines + three shared-layer plugins) must be *verified to load + fire*; the #144 v5 flat-config AND `@react-native/eslint-config` flat compatibility have no published example, so this is real work across BOTH baselines, not a rubber-stamp.
- **T15** (self-application) — the preset's own docs satisfy the same doc-authority headers the framework enforces on consumers.
- **T16** (pattern-matching-on-name) — TWO live instances: (a) `jsx-a11y` SOUNDS reusable from the SPA preset but is web ARIA/DOM — wrong problem-class for RN; use `react-native-a11y`. (b) `eslint-config-expo` SOUNDS like an RN config that would forbid web globals, but it *whitelists* them — the exact name-vs-function gap that makes the #146 denylist mandatory.
- **Domain-specific — T-MS-B:** the AI is tempted to assume `eslint-config-expo` already forbids DOM/web globals "because it's a React-Native config", and therefore skip the `no-restricted-globals` denylist (#146). File-verified FALSE (#651): the Expo config whitelists web globals via the `globals.browser` spread. The denylist is REQUIRED and must be present + effective **under the Expo baseline specifically**, since that is the one that whitelists (`no-restricted-globals` is a separate rule key — it fires additively, not a key-collision). Counter: smoke-verify #3 must show a web global actually flagged in an RN fixture under the Expo baseline.

## §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) (deterministic eslint config; DeepWiki/smoke checks are author-time, not CI); [build-first-reuse-default.md](../../rules/build-first-reuse-default.md) (zero BUILD — all ADOPT/ADAPT/REJECT; shipping two upstream baselines is maximal REUSE, the purest build-first-reuse outcome); [doc-authority-hierarchy.md §2-§3](../../rules/doc-authority-hierarchy.md) (shipped docs carry headers).
- **Backward-check:** implements the merged react-native R-phase verdicts (#142–#148) incl. the #651 web-globals correction; applies the operator's 2026-06-22 **both-baselines** scope decision (revised from Expo-only — multi-stack goal weighted over YAGNI); supersedes the earlier Expo-only kickoff (this file replaces it); corrects the design-spec §6 "shared template" wording per structural recon.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
