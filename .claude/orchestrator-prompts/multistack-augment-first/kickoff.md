# multistack-augment-first — dogfood-driven live-research delivery for ts-server + react-native (react-spa deferred)

> **Type:** dogfood-driven, two-repo plan. **Framework repo** `rules-as-tests-aif` (PRs to `staging`) + **real consumer** `timeliner` (interactive validation on a non-destructive branch). NOT a pure aif-container dispatch — **Phase A (live-research on `timeliner`) is interactive** (needs MCP/WebFetch; the container network is blocked). Phases B/C are container-buildable.
> **Authoritative for:** extending the augment-first live-research delivery (live-research = primary, presets = fallback) to **react-native + ts-server**, validated on real consumers, and closing #812 with **react-spa demo DEFERRED**. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Base:** `staging` @ `5beeb8496`. **Template of record:** PR [#824](https://github.com/artyhoo/rules-as-tests-aif/pull/824) (react-next augment-first — mirror its D1–D4 + non-vacuous oracle).
> **Real consumers (operator's repos):** `timeliner` = ts-server (`apps/api`, hono) + react-native (`apps/mobile`, expo); react-next already shipped (#824), optional re-validate on `nextjs-vitest-playwright`; **react-spa = no real consumer → deferred**.
> **Closes:** [#812](https://github.com/artyhoo/rules-as-tests-aif/issues/812) — on react-next (done) + react-native + ts-server, with a documented `react-spa demo deferred` note (§6).

## 0. One-line goal

Prove and ship augment-first live-research delivery for **react-native** and **ts-server** by dogfooding it on the operator's **real** monorepo (`timeliner`) — real docs → real generated rules landing in the real `eslint.config.mjs` — instead of synthetic in-repo fixtures, then distil the real artefacts into the deterministic CI proof and close #812.

## 1. Why this pivot (operator dialogue, 2026-06-29)

The original plan authored synthetic per-stack fixtures to prove generation. Two findings changed it:
- **The augment-first wiring is already stack-general and runs for every stack** (`setup.d/99-finalize.sh:36` `--stack`; `mergeLiveRules`/`readLiveSnippet` keyed on rule-id, `synth-and-wire.ts:87,120`). Only the per-stack *inputs* are react-next-only.
- **The operator has real consumers** for exactly the two new #812 stacks: `timeliner/apps/api` (ts-server, hono) + `timeliner/apps/mobile` (react-native, expo ~56). Real dogfood is stronger evidence than synthetic fixtures and resolves the "does a declarative rule exist for this stack?" question empirically — and it doubles as the operator's diploma (ВКР) setup + the framework's first real consumer.

## 2. Decisions locked (operator-approved — do NOT re-litigate)

- **Scope = react-native + ts-server**, dogfooded on `timeliner`. react-next is done (#824). **react-spa is DEFERRED** (§6): the operator has no SPA consumer; building a synthetic SPA demo for a stack nobody uses is `#discipline-theatre`. spa keeps its already-stack-general wired path + preset fallback + degrade-notice (no live demo) until a real SPA consumer exists.
- **#812 closes** when react-native + ts-server live delivery is proven on `timeliner` (+ react-next done), with an explicit `react-spa demo deferred` note in the closing comment.
- **Non-destructive on `timeliner`**: all consumer work on a dedicated branch; the diploma is never mutated on its main line. Finding framework bugs is the goal, but **time-box** so it cannot derail the diploma deadline.

## 3. Phase A — dogfood on `timeliner` (INTERACTIVE: MCP session, non-destructive branch)

Container-impossible (needs live MCP/WebFetch). Run in an interactive AI session with MCP, on a `timeliner` branch.

1. **Fresh install.** The installed framework is stale — `.ai-factory/tool-decisions.md` records `aif-version: staging@~2026-06-11` (`aa741d0`), predating all augment-first work (#797/#798/#801/#805/#824). Re-install the **current** framework into `timeliner` via the **multi-stack monorepo install path** (`setup.d/40-configs.sh:207-241` already places per-workspace eslint configs for ts-server/react-native). Verify it lands a config into BOTH `apps/api` AND `apps/mobile` (today `apps/mobile` has **no** `eslint.config.mjs` — a gap to confirm/fix in Phase B).
2. **Run live-research per stack** (the `rule-research` protocol / `agents/rule-researcher.md`): for `apps/api` (ts-server) and `apps/mobile` (react-native/expo), detect the stack, research canonical docs, author `.ai-factory/rules-research/<stack>.{research,selection}.json`. **Observe what actually lands** in each workspace's `eslint.config.mjs` (augment-first: live primary, preset fallback).
3. **Capture findings + artefacts.** Record: which canonical host(s) each stack's docs live on (RN core `reactnative.dev` vs Expo `docs.expo.dev` — Phase B allowlist input); whether a genuinely **declarative-forbid** rule surfaced per stack (vs `manual` → `withManualDrop` drop, §5); every install/wiring gap. Save the real `.research.json`/`.selection.json` — they become the Phase C CI fixtures.

**Output of Phase A:** a concrete gap list + real research artefacts. This *drives* Phase B (do not pre-build Phase B fixes — let the dogfood reveal the exact requirements).

## 4. Phase B — framework fixes driven by Phase A (CONTAINER-BUILDABLE, PRs to `staging`)

Only what Phase A actually surfaced. Expected (confirm before building):
- **allowlist host(s)** — `packages/core/research/allowlist.ts` has no react-native key today (verified: only `next.official`/`react.official`→react.dev/`tailwind.official`/`typescript.official`). Add the exact key(s) Phase A needs — likely `react-native.official → reactnative.dev` and possibly an `expo` host (`docs.expo.dev`) since `apps/mobile` is Expo. Without it `validateProvenance` (`allowlist.ts:24-27`) rejects the RN research plan. (NB: the existing `fixtures/rn-research-plan.json` uses the **invalid** host-as-key `"reactnative.dev"` — the real fixture must use the new *key*.)
- **mobile eslint config placement** — if Phase A confirms `apps/mobile` gets no config, fix the monorepo install path (expo vs bare-rn split: `eslint.config.expo.mjs`/`eslint.config.bare-rn.mjs`).
- **D2 override baseline** — for any stack where a live rule must override a *shipped preset* rule-id, see §5 (the empty-`STACK_PATTERNS` gotcha).
- **D4 staleness marker** — `preset.meta.json` for react-native (+ extend `99-finalize.sh:70` WARN beyond react-next-only); ts-server marker optional (no preset package — minimal `templates/ts-server/preset.meta.json` or skip with rationale).

## 5. Phase C — distil real artefacts into the deterministic CI proof + close #812 (CONTAINER-BUILDABLE)

The dogfood is interactive and not in CI (no-paid-llm-in-ci). CI still needs the **deterministic, $0 non-vacuous oracle** — mirror `packages/core/install/wire-live-snippet.test.ts` per stack, built from the **real** Phase-A `.research.json`/`.selection.json` via `synthesizeGenerate(plan, withManualDrop(new FileGenerateClient(selection), …))`:
- **oracle-source-real:** the built snippet genuinely carries the demo `selector` (`toContain(SELECTOR)`) — catches the `manual`-dropped case.
- **positive (augment):** merged `eslint.config.mjs` **literally contains** the demo selector AND retains the stack's preset rule-ids.
- **negative-1 (absent ⇒ no-op):** keeps byte-identical baselines green.
- **negative-2 (override / D2):** a live rule sharing an **unconditional** preset rule-id ⇒ `overrideKeys.has(id)` + merged config carries the live value.
- Wire new `tests/install-sh/*.test.sh` into `.github/workflows/audit-self.yml` (armed-but-not-fired otherwise — PR #796 lesson).
- Principle 28 stays GREEN + unmodified; byte-identical recapture only if actually drifts (§verify, not blind).
- **Close #812** with the `react-spa demo deferred` note.

### ⚑ Load-bearing technical caveats (carry into Phase B/C — verified this session)

- **T-MAF-A «manual-masquerade»** — existing spa/native research patterns are mostly `check.type:'manual'` (`generate-react-spa.test.ts:86-102`; only RN `rn-web-globals` is declarative-forbid). `withManualDrop` drops manual candidates → an oracle with nothing to assert = green-but-inert. Each stack's demo MUST be genuinely declarative-forbid (real `selector`, firing negative test) or it ships wired+degrade with the demo research-only. **Never invent a contrived rule** (T-MAF-C). For RN `rn-web-globals`: re-express as a `no-restricted-syntax` `presence:"forbid"` selector (e.g. `MemberExpression[object.name='localStorage']`) — do NOT reuse the `stubGenerateRN` `no-restricted-globals` eslintConfig form, which `wireNRules` cannot land (`buildRuleValueExpr` `wire-eslint-r2.ts:262` keeps only `{selector}` entries).
- **T-MAF-B «empty-STACK_PATTERNS → D2 override skipped»** — `STACK_PATTERNS` (`synth-and-wire.ts:38`) has only react-next; for native/ts-server `mergeLiveRules({}, live)` treats a same-id live rule as pure-augment (no override) → `wireNRules` skips it (preset wins). If Phase A needs a live rule to override a shipped preset rule-id, add a `STACK_PATTERNS[stack]` entry mirroring that stack's hand-inlined preset rule-ids. Proof = the §5 Negative-2 oracle.

## 6. react-spa deferral (documented — §1.7 honesty)

react-spa is NOT dropped from the framework — its augment-first path is already stack-general (wiring + preset fallback + degrade-notice all fire for `--stack react-spa`). What is deferred is the **live demo + CI oracle**, because (a) the operator has no SPA consumer to dogfood against, and (b) react-spa's researched patterns are all `manual` (§5 T-MAF-A) so a synthetic demo risks theatre. **Trigger to revisit:** a real react-spa (Vite) consumer appears, or react-spa gets a genuinely declarative-forbid canonical-doc rule. Record this in the #812 closing comment + a one-line follow-up issue.

## 7. Acceptance criteria (verify-before-close)

1. **Phase A (dogfood):** on `timeliner`, a fresh `--full` install + live-research lands a real generated rule into `apps/mobile` (RN) AND `apps/api` (ts-server) `eslint.config.mjs` (augment-first; preset retained). Captured with command + observed config output (T2/T3 — show the rule in the file, not "it ran").
2. **Phase C (CI proof):** per stack, the deterministic oracle is non-vacuous (oracle-source-real + literally-lands + both negatives) and built from the real Phase-A artefacts. A stack with no declarative rule ships wired+degrade with demo research-only, stated explicitly (no contrived rule).
3. Principle 28 GREEN + unmodified; byte-identical baselines verified (recaptured only if actually affected, with a one-line note).
4. allowlist host(s) added match what the real RN/expo docs actually use; D4 marker shipped for react-native + WARN fires on major-mismatch.
5. `npm test --workspaces` + principle meta-tests green; new install-sh tests wired into `audit-self.yml`.
6. #812 closed on react-next + react-native + ts-server with the `react-spa demo deferred` note + follow-up issue link. PRs: `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` (each ≥40 chars, ≥1 file:line).

## 8. AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2-§3](../../../.claude/rules/ai-laziness-traps.md))

**Active traps:** T2, T3, T5, T13, T15, T16 (+ domain T-MAF-A/B/C, §5).
- **T2/T3** — dogfood claims carry command + observed config output; the generated rule must be shown present in the real `eslint.config.mjs`, not "it ran".
- **T5** — react-native + ts-server only; spa deferred (do not synthesise it); do not mutate `timeliner`'s diploma main line.
- **T13** — the stale `timeliner` install + the existing `rn-research-plan.json` are NOT zero-work: stale install predates augment-first; the fixture has invalid allowlist keys + mostly-`manual` patterns. Re-verify, don't reuse blindly.
- **T15** — the §5 oracle per stack must itself be proven able to fail (oracle-source-real + literally-lands + paired negatives).
- **T16** — REUSE `wireNRules`/`mergeLiveRules`/`synthesizeGenerate`; the monorepo install path already exists — extend, don't rebuild.

## 9. Output contract

- **Phase A** = interactive session on a `timeliner` branch → a findings report + committed real `.research.json`/`.selection.json` (on the timeliner branch) + the observed gap list.
- **Phase B/C** = PR(s) to `rules-as-tests-aif` `staging`, commit-per-concern (allowlist; mobile-config; oracle+fixtures per stack; D4). `ts-server` and `react-native` may share a PR or split; last PR carries `Closes #812`, earlier `Refs #812`.
- **Pre-dispatch:** this kickoff must be on `staging` before any `/pipeline`/aif dispatch of Phase B/C ([kickoff-staging-placement.md §1](../../../.claude/rules/kickoff-staging-placement.md)). Probe in-flight before dispatch.
- **Egress:** host-push default ([egress-no-api-bypass.md §1](../../../.claude/rules/egress-no-api-bypass.md)); run the FULL CI-equivalent gate set locally before harvest (CI install order before the synth-bundle #755 check — the semver-drift trap bit #824 twice).
- **REPORT:** per stack — the real config diff proving the live rule landed (Phase A); the non-vacuous CI oracle (Phase C); principle 28 green; byte-identical path; `npm test --workspaces`. State per stack whether a real declarative demo shipped or degraded research-only, with the reason. Confidence + ATTN.
