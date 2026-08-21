# multi-stack-install-wiring-iphase — wire install.sh + extend principles for the two new presets (#646 Stage 1, integration)

- **Type:** integration (install.sh wiring + principle-test extension). Single task owning the SHARED files both presets need.
- **Opened:** 2026-06-22.
- **Base:** staging.
- **Issue:** [#646](https://github.com/Yhooi2/rules-as-tests-aif/issues/646) Stage 1.
- **⚠ DISPATCH DEPENDENCY (binding):** dispatch this task **ONLY after BOTH preset PRs are merged to staging** — `preset-react-spa-iphase` AND `preset-react-native-iphase`. This task edits `install.sh` copy-blocks that reference real preset files and registers real `RULES.md`/`ARCHITECTURE.md` into principle gates — those files must exist on staging first. Dispatching early → the worker has nothing to wire. (The two preset tasks fence `install.sh`/`principles` OUT of their scope precisely so this one task owns them — no egress collision.)

## What

Make `packages/preset-react-spa/` and `packages/preset-react-native/` **actually installable** by wiring `install.sh`, and bring the two new presets under the framework's self-application gates (principle 05 + 09). The presets already exist (built by the two phase-A tasks); this task only touches SHARED files. Mirror the existing `react-next` wiring exactly.

**Read before coding:**
- The two built presets: `packages/preset-react-spa/**` + `packages/preset-react-native/**` (study their actual layout — esp. RN ships TWO baseline configs `eslint.config.expo.mjs` + `eslint.config.bare-rn.mjs` + a shared `eslint.config.rn-common.mjs`, and may have NO `eslint-rules/`).
- The mirror reference: every `react-next` touchpoint in `install.sh` (line numbers below) + `packages/preset-next-15-canonical/` layout.
- `docs/superpowers/specs/2026-06-19-multi-stack-hybrid-design.md` §3 (Stage-1 boundary; Next path must stay byte-identical).

## Build — exact touchpoints

### 1. `install.sh` wiring (mirror the `react-next` path at each line)

| Touchpoint | Current line | Action |
|---|---|---|
| Arg parser | `install.sh:81` `ts-server\|react-next)` | add `react-spa`/`react-native` as valid STACK values |
| Stack guard | `install.sh:189-190` `❌ Unknown stack` | extend the allowed-stack check to the 4 stacks **+ update the error-message text `(use ts-server or react-next)` to list all 4** |
| Interactive menu | `install.sh:178-186` `Choose [1/2]` | add `3) react-spa`, `4) react-native`; widen the `read -rp` range + `case` |
| Auto-detect | `install.sh:167-173` | **ORDER MATTERS — test `react-native` (`expo`/`react-native` in deps) BEFORE `react-spa` (`vite`+`react-dom`, no `next`)**: an RN project may also pull react-dom-adjacent pkgs, so RN must match first. Keep existing fallback. |
| `SHIPPED_DOCS` | `install.sh:111-131` | add the 6 new docs (3 per preset — see §2 for the exact list; install.sh + principle 09 MUST match) |
| Copy-blocks | `:599` (audit-self), `:779`/`:807`/`:808` (RULES/ARCHITECTURE), `:854` (audit script), `:951` (eslint-rules glob), `:1010-1012` (templates), `:1018` (CI) | add per-stack copy branches mirroring `react-next`. **Add NEW `if [ "$STACK" = "react-spa" ]` / `react-native` branches — do NOT edit the existing `react-next` blocks** (this is what keeps the Next path byte-identical). **SPA eslint template** = `templates/eslint.config.react.mjs` — **SAME basename as next, NOT `eslint.config.react-spa.mjs`** (presets differ by package dir, not filename) → copies to `eslint.config.mjs`. **SPA ships `playwright.config.ts`; RN does NOT** (web-only — RN omits it) → skip the playwright copy for `react-native`. **RN both-baselines:** copy the Expo-vs-bare config by detect (Expo deps present → `eslint.config.expo.mjs`; else `eslint.config.bare-rn.mjs`) → `eslint.config.mjs`, plus always copy `eslint.config.rn-common.mjs`. **RN has no `eslint-rules/`** → skip the eslint-rules copy loop for that stack (don't fail on an empty/absent dir). |
| Dev-deps | `:1350` `CORE_DEVDEPS`, `:1359` `REACT_DEVDEPS`, `:1366` `DEVDEPS+=` guard | add `REACT_SPA_DEVDEPS` (`eslint-plugin-react`, `react-hooks`, `jsx-a11y`, `eslint-plugin-boundaries`, vite/test deps) + `REACT_NATIVE_DEVDEPS` (`eslint-config-expo`, `@react-native/eslint-config`, `eslint-plugin-react-native`, `eslint-plugin-react-native-a11y`); add `[ "$STACK" = "react-spa" ] && DEVDEPS+=(...)` / same for react-native, mirroring `:1366` |

### 2. principle 09 (doc-authority) — THREE files must stay in sync

The drift test (`packages/core/principles/09-doc-authority-hierarchy.test.ts:139-167`) asserts install.sh `SHIPPED_DOCS` **exactly equals** the shipped-doc subset of `REQUIRED_HEADER_DOCS`, AND has a **hardcoded count**. Update ALL of:

- **`packages/core/principles/09-doc-authority-hierarchy.ts:27`** `REQUIRED_HEADER_DOCS` — add (verify exact filenames against the built presets):
  - `packages/preset-react-spa/RULES.md`, `packages/preset-react-spa/RULES.react-spa.md`, `packages/preset-react-spa/templates/ARCHITECTURE.react-spa.md`
  - `packages/preset-react-native/RULES.md`, `packages/preset-react-native/RULES.react-native.md`, `packages/preset-react-native/templates/ARCHITECTURE.react-native.md`
- **`packages/core/principles/09-doc-authority-hierarchy.test.ts:155`** `SHIPPED_DOC_PREFIXES` — add `'packages/preset-react-spa/'` + `'packages/preset-react-native/'`.
- **`packages/core/principles/09-doc-authority-hierarchy.test.ts:165`** `expect(installShipped).toHaveLength(19)` — **update 19 → 25** (19 existing + 6 new = 3 docs × 2 presets; all 6 fall under the two new prefixes, so the shipped-subset grows by exactly 6 and install.sh SHIPPED_DOCS grows by the same 6 — the two stay equal). **This hardcoded number is the #1 trap (see T-MS-C) — forgetting it fails the drift test even when everything else is correct.** (The sentinel `REQUIRED_HEADER_DOCS.length >= 20` at `:88` stays green — adding docs only raises it — no edit needed there.)
- **`install.sh` `SHIPPED_DOCS`** (:111-131) — add the SAME 6 paths. The set must equal the `REQUIRED_HEADER_DOCS` shipped-subset exactly (test line 166: `new Set(installShipped)).toEqual(new Set(shippedSubset))`).

### 3. principle 05 (manifest ↔ RULES.md) — conditional, determine first

`packages/core/principles/05-manifest-ssot.test.ts:26` hardcodes `RULES_MD_PATH = preset-next-15-canonical/RULES.md` and checks every manifest rule-ID appears in that ONE RULES.md.

**Determine, then act:**
- **If** the new presets' `RULES.md` are **rendered from the shared manifest** (`packages/core/manifest/rules-manifest.json` via `render-rules.ts`, like next) → extend principle 05 to check each preset's RULES.md (path list, not a single const) + run `render-rules.ts --check` per preset.
- **If** they are **static copies** (not manifest-rendered) → principle 05 stays next-only (it's a manifest↔rendered-doc drift check; static docs are out of its scope). **Document this in the test** (a comment why new presets aren't checked) and surface it as a follow-up observation — do NOT silently leave the divergence unexplained, and do NOT do a deep manifest-into-per-stack-render refactor here (out of scope; that's a separate decision).

**Deterministic check (grep, do not assume):** the next preset's `RULES.md:13` carries the provenance line `> Generated from \`factory/rules-manifest.json\` by \`scripts/render-rules.ts\`. Do not edit by hand.` Run `grep -l 'Generated from.*render-rules' packages/preset-react-spa/RULES.md packages/preset-react-native/RULES.md` — **marker present → manifest-rendered** (extend principle 05 from the single `RULES_MD_PATH` const to a path-list + run `render-rules.ts --check` per preset); **marker absent → static copy** (principle 05 stays next-only — add a comment in the test explaining why the new presets are out of manifest-drift scope, and surface it as a follow-up observation). Choose the branch from the grep result, not assumption.

## Acceptance criteria

- `./install.sh react-spa --dry-run` AND `./install.sh react-native --dry-run` → complete with `✅ Dry-run complete`, NO `❌ Unknown stack`.
- `npm --prefix packages/core run test:principles` (or the repo's principle-suite command) → **green**, incl. principle 05 + 09 + the 09 drift test with the updated count.
- Next.js path **byte-identical**: `./install.sh react-next --dry-run` output unchanged; `make self-audit` green.
- Full CI green on the PR (the principle-suite + install-self-install jobs are the load-bearing ones).
- Evidence (per T3): paste the `--dry-run` tails + the principle-suite pass line, not prose claims.

## Out of scope

- ❌ Do NOT rewrite or "improve" the preset directories — they're done (phase A). Touch them only if a copy-block reveals a real missing file (then surface it, minimal fix).
- ❌ Do NOT build Stage 2 generate-path / L4-gate — that's the next umbrella.
- ❌ Do NOT refactor the manifest into per-stack rendering unless principle 05's "rendered" branch trivially needs it (and even then, prefer the documented-static branch + follow-up).
- ❌ Do NOT create the PR or push — egress (harvest) is the orchestrator's job.

## Capability-commit discipline

This task edits `install.sh` (not `package.json`, not a new ≥80-LOC file under `packages/`) + small principle-test edits → **likely NOT a capability commit** by the [CLAUDE.md](../../../CLAUDE.md) definition. If the pre-push hook flags one anyway (e.g. a principle-test edit crosses a threshold), use the escape hatch: `Prior-art: skipped — integration wiring (install.sh + principle-test registration) for presets whose capabilities were already SSOT-cited in #136–#148, no new capability`. If any added file does cross ≥80 LOC, trailer it citing the relevant preset SSOT row.

## AI-laziness traps (`.claude/rules/ai-laziness-traps.md` §2 — active)

Active canonical traps: **T3**, **T13**, **T15**, **T16**.

- **T3** (no prose-only) — run both `--dry-run`s + the principle suite, paste real output. "Should install" is not evidence.
- **T13** (ADOPTED ≠ zero-work) — mirroring the `react-next` copy-blocks is not blind copy: RN diverges (two baselines, no `eslint-rules/`); verify each copy branch against the ACTUAL built preset layout, not the next-preset assumption.
- **T15** (self-application) — the whole point is bringing new presets under the framework's own gates; the principle suite passing IS the self-application check.
- **T16** (pattern-matching-on-name) — the new presets are NOT shaped like next: react-native ships zero custom rules + two baseline configs. Copying the next eslint-rules glob blindly (`:951`) will mis-handle RN. Match the actual layout, not the name.
- **Domain-specific — T-MS-C:** updating `REQUIRED_HEADER_DOCS` + install.sh `SHIPPED_DOCS` but **forgetting the hardcoded `toHaveLength(19)`** at `09-...test.ts:165` (and the exact-set-equality on line 166). The drift test then fails even though the doc lists are correct. This is the PR #264-class trap (a principle test with a hardcoded count/allowlist that a new path must update). Counter: after editing the three sync points, grep the 09 test for `toHaveLength` and any hardcoded count, and run the 09 test in isolation before declaring done.

## §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) (install.sh + principle tests are deterministic bash/TS, zero API calls); [build-first-reuse-default.md](../../rules/build-first-reuse-default.md) (pure wiring of already-decided ADOPT/BUILD verdicts — no new capability); [doc-authority-hierarchy.md §2-§3](../../rules/doc-authority-hierarchy.md) (registers the new shipped docs into the authority-header gate — this task is literally extending that gate's coverage).
- **Backward-check:** consumes the merged phase-A presets (#646 Stage 1) + the merged kickoffs (#655/#656); supersedes nothing; this is the integration half that the two preset kickoffs explicitly fenced out (`install.sh`/`principles` marked out-of-scope there so this single task owns them).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
