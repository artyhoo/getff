# live-research-default-delivery — augment-first (single-PR implementation kickoff)

> **Type:** single buildable implementation kickoff (NOT a meta-launch / umbrella index — no Stage gates, no Sub-wave table, no Launch table). Dispatch this file directly to aif; it produces code + one PR to `staging`.
> **Authoritative for:** making live-research the *primary* stack-rule delivery (augment-first) for `react-next`, presets demoted to fallback baseline; closing #812 + #811. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Base:** `staging`. **Stack of record:** `react-next` ONLY (the only stack with `STACK_PATTERNS`, recipes, and live fixtures). **$0-in-CI, deterministic, no network/MCP needed in the container.**
> **Closes:** [#812](https://github.com/artyhoo/rules-as-tests-aif/issues/812) (live-research as default delivery), [#811](https://github.com/artyhoo/rules-as-tests-aif/issues/811) (preset staleness guard).

## 0. One-line goal

Connect the two **currently-disconnected** pipelines so a consumer's live-research output actually lands in `eslint.config.mjs` as the **primary** stack-specific rules, with **presets demoted to a fallback baseline** (kept for offline / no-MCP / no-research consumers) and a **staleness WARN** on that baseline — realising «live-research instead of presets» (augment-first) for `react-next`.

## 1. Why (the verified gap — evidence, read from `origin/staging`)

The installer ships two pipelines that **never meet**:
- **Presets = the real delivery.** The stack template `packages/preset-next-15-canonical/templates/eslint.config.react.mjs` **hand-inlines** `rules-as-tests/no-unsafe-zod-parse` (R2), `no-server-imports-in-client` (R12), `restricted-syntax-audit-exempt` (R14+R20). They ship because they are written into the committed template, copied verbatim by `setup.d/40-configs.sh`.
- **Live-research = inert.** `setup.d/80-rule-bootstrap.sh` (--full, degrade-on-absent) → `rule-bootstrap-cli.ts` → `install()`/`emit()` writes JSON only to `${PROJECT_ROOT}/.ai-factory/synthesizer-output/` (`eslint-rules-snippet.json` = `plan.eslintConfigSnippet`, `emit.ts:41`; `packages/core/installer/install.ts:18` `OUTPUT_SUBPATH`). **Nothing ever merges that snippet into the live `eslint.config.mjs`.**
- **Proof of the disconnect:** grep `synth-and-wire.ts` + `setup.d/99-finalize.sh` for `synthesizer-output|eslint-rules-snippet|rules-research|from-research` → **NO MATCH**. `synth-and-wire.ts` re-runs `synthesize()` from its OWN hardcoded `STACK_PATTERNS` (react-next → the same R12/R14/R20 preset patterns) and calls `wireNRules()` — it ignores the live snippet entirely.

So today live-research is an inert opt-in artefact; the presets are the only delivery. The operator's mandate: presets are a **rudiment** (frozen snapshots, go stale across stacks/versions); live-research must be the **default** delivery, presets the fallback.

## 2. Scope boundary (do NOT expand)

- **IN:** the augment-first flip for **react-next** — (D1) wire the live snippet into `eslint.config.mjs`; (D2) live-wins-on-collision; (D3) presets become fallback baseline + "fallback, prefer live-research" notice; (D4) #811 staleness marker + WARN; verify principle 28 stays green (do NOT modify it); tests on fixtures.
- **OUT (do NOT touch):** multi-stack live delivery (react-spa/native/ts-server have no `STACK_PATTERNS`/recipes/fixtures — follow-up umbrella); **deleting** presets / a full replace (operator chose augment-first — keep the preset template hand-inlining so principle 26 + offline consumers stay green); the actual live MCP doc-research (runs in the consumer's interactive session, not the container); the #810 install-self-verification work (separate in-flight task). Surface anything else as a one-line `## Out-of-scope observations` in the PR body (CLAUDE.md «PR strategy»).

## 3. Deliverables

### D1 — Wire the live snippet into the live config (close the disconnect)
Make the install flow read `${PROJECT_ROOT}/.ai-factory/synthesizer-output/eslint-rules-snippet.json` (the live-research output) and feed it to `wireNRules()` (`packages/core/install/wire-eslint-r2.ts:312` — the existing ts-morph AST merge; **REUSE it, do not rebuild**) so the generated rules are written into the consumer's `eslint.config.mjs`. Natural seam: `packages/core/install/synth-and-wire.ts` (today it only wires hardcoded `STACK_PATTERNS` and never reads the live snippet — that IS the disconnect; add: also consume the live snippet when present), invoked from `setup.d/99-finalize.sh` after `80-rule-bootstrap`. **Gate the new snippet-read on the snippet FILE existing** — snippet absent ⇒ the new branch is a pure no-op, so the byte-identical capture path (no snippet present) is unchanged (§5). Container-buildable; prove on the `no-head-element` fixture (§6).

### D2 — Live-wins on collision (priority) — resolve at the synth-and-wire layer, NOT merge-eslint-config
**Mechanics caveat (verified — do not get this wrong):** the install path is `synth-and-wire.ts` → `wireNRules()`, which is **presence-only / append-if-missing** (`simpleRulePresent` = string-match, `wire-eslint-r2.ts:219`; a rule-id already in the config string is SKIPPED → the hand-inlined PRESET would win, the opposite of live-wins). `mergeEslintRuleConfig` (which throws `RuleCollisionError`) is **synthesis-time recipe merge ONLY** and is NOT on this install path — do not route precedence through it. So resolve precedence in `synth-and-wire.ts`: compute the **union of preset-baseline rules + live snippet rules with LIVE precedence per rule-id** (replace a simple rule's options/severity with the live one; for the `restricted-syntax`/wrapper rule union+dedupe selectors keeping the live message/severity), then wire — OR give `wireNRules` a replace-on-override path for the live set. Mechanism is the agent's call; the **invariant** (acceptance §8.2) is binding: a new live rule-id is ADDED, and a live rule sharing a preset rule-id OVERRIDES the preset's options (live is authoritative — that is what «default delivery» means). Dedup key stays literal (rule-id / selector) — do NOT invent a "concern" key (scope risk).

### D3 — Presets become the fallback baseline
- **Keep the preset template hand-inlining R2/R12/R14/R20 unchanged** (so principle 26 stays green and an offline / no-MCP / no-research consumer still gets a real fence). "Fallback" = the preset rules are the baseline; the live set augments + overrides on top (D1/D2).
- Print a "presets are the fallback baseline — prefer live-research for fresh rules" notice when the **live path was NOT taken** (no `.ai-factory/rules-research/<stack>.*` artefacts). Mirror the existing deps-free WARN style in `setup.d/99-finalize.sh` (the R7/R8-arming WARN).

### D4 — #811 staleness guard
- Ship a static per-preset freshness marker (e.g. `packages/preset-next-15-canonical/preset.meta.json`: snapshot date + pinned majors — anchor to the real pins: `prettier@3.8.3` `setup.d/70-deps.sh`, `eslint@^9`, Next-15 = `synth-and-wire.ts STACK_PATTERNS['react-next'].version '15.4.0'`).
- A deps-free, `--dry-run`-aware install-time WARN comparing the consumer's installed framework/tool major (read `package.json` text) vs the preset's recorded major → "preset is a frozen Next-15 snapshot; you're on Next N — prefer live-research delivery." $0, deterministic, no new dep.

## 4. Principle 28 — stays GREEN untouched (do NOT re-scope; verify after D1)

**Corrected understanding (cold-review):** `packages/core/principles/28-synth-wire-oracle.test.ts` arm A sources its rules from `synthesize()`-over-the-react-next-**recipes** (R12/R14/R20) and reads the **preset template** as the gold string (`:55-72,:96`); arms B/C are paired-negatives. It does **NOT** consume the live snippet. Since D3 keeps the preset template **unchanged**, wiring a live `no-head-element` into the *consumer's* config does NOT change what arm A computes → **arm A stays byte-identical and GREEN.** (The earlier assumption that the live set makes arm A go RED was a misread — corrected.)

**Therefore: do NOT modify principle 28.** After D1, RUN it and confirm green (acceptance §8.3). The live-path oracle (config gains the generated rule; neuter-negative) belongs in the §6 fixture test, where the live-generate pipeline (`synthesizeGenerate` + `FileGenerateClient`) already lives — bolting a live arm onto principle 28's recipe-sourced oracle would mix two pipelines and risk `T-GIW-B` (an oracle that proves nothing). Leave principle 28's `synthesize()` source intact.

## 5. Byte-identical baselines (stay untouched via snippet-presence gating — verify, don't blind-recapture)

`tests/install-sh/baselines/<stack>/{greenfield,brownfield}.fingerprint` include `eslint.config.mjs`'s sha256. **Correct mechanism (cold-review):** `snapshot.sh` captures via `install.sh <stack> --force` (no `--full`), but `install.sh` DOES run `99-finalize.sh`'s synth-wire (it is NOT `--full`-gated). So the capture is NOT safe because of `--full` gating — it is safe for a narrower reason: the **live snippet `.ai-factory/synthesizer-output/eslint-rules-snippet.json` is ABSENT** in the capture fixture. Because D1 gates its new read on the snippet file existing (§D1), snippet-absent ⇒ no-op ⇒ `wireNRules` finds the preset already-wired ⇒ no write ⇒ **fingerprints UNCHANGED.** VERIFY by running `bash tests/install-sh/byte-identical.test.sh` after D1; re-capture (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`; the wrapper hardcodes compare, ignores env) ONLY if it actually drifts — it should not. Blind re-capture hides real drift.

## 6. Recursive self-application + tests — THIS is the live-path oracle (prove on fixtures, T15)

The live-path proof lives HERE (not in principle 28 — §4). It must be non-vacuous: a merge test that can't fail is theatre (`T-LRD-A`).

- **Positive (augment):** feed the `no-head-element` snippet to the wirer over the react-next preset template fixture — built deterministically via `synthesizeGenerate(JSON.parse(fixtures/no-head-element.research.json), FileGenerateClient(no-head-element.selection.json))` per `packages/core/synthesizer/rule-bootstrap-live.test.ts` ($0, no network) → assert the merged `eslint.config.mjs` **literally contains** the generated `no-head-element` selector **AND** still contains the preset R12/R14/R20 (augment, not replace).
- **Negative 1 (absent snippet ⇒ no-op):** empty/absent live snippet ⇒ merged config == preset baseline, no live rule (this is what keeps §5 baselines green).
- **Negative 2 (override / D2 live-wins):** a live rule sharing a **preset rule-id** but with different options ⇒ the merged config carries the **LIVE** options (preset overridden), proving D2 at the right layer (§3 D2). Construct this with a small fixture (a live rule reusing e.g. R12's id with a changed option).
- Add `wireNRules`-over-preset-template cases to `packages/core/install/wire-synth-rules.test.ts`.
- Wire any new `tests/install-sh/*.test.sh` into `.github/workflows/audit-self.yml` as an explicit `run:` step (the install-sh meta-gate is "armed-but-not-fired" otherwise — PR #796 lesson).

## 7. Build-vs-reuse + capability-commit

This connects existing primitives (REUSE: `wireNRules`, `mergeEslintRuleConfig`, `FileGenerateClient`, the emit/snippet artefacts) — the new capability is the *connection* + priority + fallback + staleness. Consult `docs/meta-factory/prior-art-evaluations.md`; the relevant precedents are the synthesizer/live-adapter entries (#183 rule-bootstrapping) and #91 (mutation-discipline, only if you touch tests). Run the §3 BFR check (DeepWiki/WebSearch ≥3 phrasings on "lint config layering / override precedence" only if you add a non-trivial new mechanism). Carry a `Prior-art:` trailer on the capability commit (cite #183 ADAPT — extends the live-adapter to actually deliver; add a new SSOT id only if a genuinely new capability emerges — verify max id `grep -oE '^\| *[0-9]+ ' docs/meta-factory/prior-art-evaluations.md | grep -oE '[0-9]+' | sort -n | tail -1`).

## 8. Acceptance criteria (verify-before-harvest — orchestrator checks at harvest)

1. On a `--full` react-next install WITH `.ai-factory/rules-research/react-next.{research,selection}.json` present → the generated rule(s) appear in the consumer's `eslint.config.mjs` (live path wired). WITHOUT them → config == preset baseline + the "fallback, prefer live-research" notice (degrade, never error).
2. D2 live-override proven on a fixture (§6 Negative 2): a preset rule-id X + a live rule with the same id X but different options ⇒ the merged `eslint.config.mjs` carries the **live** options for X (preset overridden); AND a new live rule-id (`no-head-element`) is added alongside the retained presets. (Do NOT use a `RuleCollisionError` assertion — that error is synthesis-time-only, never on this install path.)
3. **Principle 28 stays GREEN, untouched** — run it after D1, confirm green (it is recipe-sourced + the template is unchanged, so it does not go RED). Do NOT modify it. The live-path positive+negatives are the §6 fixture oracle (non-vacuous: absent snippet ⇒ baseline; same-id live ⇒ live wins).
4. Byte-identical baselines: verified which path they exercise; re-captured ONLY if actually affected (§5), with a one-line note of which.
5. #811: freshness marker shipped + the staleness WARN fires when installed major ≠ preset major (proven on a fixture/dry-run).
6. Fixture test (§6) green + non-vacuous; `npm test --workspaces` + principle meta-tests green; new install-sh test wired into `audit-self.yml`.
7. PR body: `Closes #812` + `Closes #811`; `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` (each ≥40 chars, ≥1 file:line — `discipline-self-check.yml` gate).

## 9. AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2-§3](../../../.claude/rules/ai-laziness-traps.md))

**Active traps:** T2, T3, T5, T15, T16.
- **T2** — do not write `# would merge`; actually run the wirer on the fixture and assert the rule is in the output config.
- **T3** — every acceptance claim carries a command + observed output.
- **T5** (no drive-by) — react-next ONLY; do NOT touch other stacks, do NOT delete presets, do NOT touch the #810 self-verify surface.
- **T15** — §6: the live-path merge oracle must itself be proven able to fail (non-vacuity lives entirely in §6 now; principle 28 stays unmodified per §4).
- **T16** — REUSE `wireNRules` / `mergeEslintRuleConfig`; do NOT hand-roll a config merger because "merge" sounds like new work.
- **Domain-specific `T-LRD-A` «silent disconnect re-introduced»:** the easiest wrong outcome is wiring code that *looks* connected but the snippet path is wrong/empty ⇒ live rule never lands ⇒ falls back to presets ⇒ green-but-inert (the exact disconnect we're fixing). Counter: §6 fixture test MUST assert the generated rule is **literally present** in the merged config string, not merely that the step ran.

## 10. Output contract

- One branch off `staging`, one PR `--base staging`, `Closes #811` + `Closes #812`. Conventional commits; **commit per deliverable (D1…D4)** so a long run lands durably — if budget runs short, land D1 (the disconnect fix — the operator's core) + D2 first, then D3/D4, and report what remains.
- Do NOT push to `main`. Do NOT open multiple PRs.
- REPORT: files changed (path:line); the fixture-merge output proving the live rule is in the config + presets retained; principle 28: green (unmodified); the §6 oracle: live-path positive + both negatives, non-vacuous; which byte-identical path the baselines exercise (and whether re-captured); the staleness-WARN firing; `npm test --workspaces` result. Confidence + ATTN.
