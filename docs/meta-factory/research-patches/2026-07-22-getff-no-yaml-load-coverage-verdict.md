<!-- scope:getff-no-yaml-load-coverage -->
# `getff-researched-no-yaml-load` receiver-literal coverage — VERDICT: accept as deliberate demo limit

> **Scope:** the flagship live-generation demo rule `getff-researched-no-yaml-load` (python) fires on the literal `import yaml; yaml.load(raw)` but NOT on two evasion forms — aliased receiver (`import yaml as y; y.load(raw)`) and bare import (`from yaml import load; load(raw)`). This patch is the investigation + DECISION (accept the narrowness as a deliberate demo property; do NOT broaden the fixture). Finding origin: rule-tests-surface S2, [PR #1090](https://github.com/rules-as-tests-aif/rules-as-tests-aif/pull/1090). Folder-authority: [research-patches/](.) (scope-bound by gap). NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Status:** DECIDED — documented non-fix. No renderer/fixture change; firing tests + the S2 rule-tests sidecar are untouched. A `_coverage_note` pointer is added to the practice record; the stale «frozen renderer» comment in the bridge is corrected (post-ir-unfreeze reality).
> **Method:** code read against the working tree + `origin/staging`; one live `@ast-grep/cli@0.44.1` firing probe (the CI-pinned version, [audit-self.yml:232](../../../.github/workflows/audit-self.yml)) reproducing every claim below. No prose-only load-bearing claim ([ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) T3/T20).
> **Date:** 2026-07-22.

---

## §1 The finding (tool-verified)

The rendered rule is a single receiver-literal ast-grep pattern ([firing/rules/getff-researched-no-yaml-load.yml:8-9](../../../packages/core/synthesizer/fixtures/live-generation/firing/rules/getff-researched-no-yaml-load.yml)):

```yaml
rule:
  pattern: "yaml.load($$$ARGS)"
```

Live-fired @0.44.1 against a corpus (`ast-grep scan --json`):

| Source line | Form | Fires? |
|---|---|---|
| `import yaml; yaml.load(raw)` | literal | **YES** ✓ (correct) |
| `import yaml as y; y.load(raw)` | aliased receiver | **NO** (bypass 1) |
| `from yaml import load; load(raw)` | bare import | **NO** (bypass 2) |

## §2 Can the backend express a broader rule today? — split answer

- **Renderer: YES.** The IR was **unfrozen** by the closed `ir-unfreeze` umbrella (OWNER-FORK-1 Option B, [PR #1084/#1085](https://github.com/rules-as-tests-aif/rules-as-tests-aif/pull/1084); S2 [#1079](https://github.com/rules-as-tests-aif/rules-as-tests-aif/pull/1079)). `ConventionNode.relational?` ([ir/types.ts:83](../../../packages/core/ir/types.ts)) exists and `render-astgrep.ts` fully renders `any:`/`all:`/`not:`/`has:` ([render-astgrep.ts:236-266](../../../packages/core/backends/astgrep/render-astgrep.ts)). The single-literal-pattern ceiling is **no longer a renderer property.**
- **Bridge: NO (un-wired, by omission — not by design-decision).** `research-to-node.ts` is the bottleneck: its input type `AstgrepResearchedPractice` carries no relational/alternation field, `buildAstgrepNode` never sets `node.relational` ([research-to-node.ts:155-176](../../../packages/core/synthesizer/research-to-node.ts)), and `isSinglePatternExpressible` degrades every non-single-pattern practice to a research-only finding ([:91-99](../../../packages/core/synthesizer/research-to-node.ts)). The `ir-unfreeze` umbrella wired the IR + the renderers + the grammar gate; it did **not** extend this researched-practice bridge. So relational authoring from a researched practice is genuinely un-wired today and not in-flight (umbrella closed).

## §3 Even with relational, the two bypass forms cannot be cleanly closed (probe evidence)

ast-grep 0.44.1 is a purely syntactic matcher with **no import-binding / scope tracking**. Live-probe results:

| Candidate | Alias (`y.load`) | Bare (`load`) | Collateral |
|---|---|---|---|
| current `yaml.load($$$ARGS)` | miss | miss | none |
| `any:[yaml.load, load($$$ARGS)]` | miss | **catch** | fires on **every** bare `load()` (e.g. `from json import load`) — trades FN for an FP class |
| `$M.load($$$ARGS)` (metavar receiver) | catch | n/a | fires on `json.load`, `obj.load`, **every** `.load()` — catastrophic FP |
| `all:[$M.load, has: import yaml as $M]` (import-correlate) | — | — | **0 matches** — ast-grep does not correlate the alias binding to the call-site |

The aliased-receiver form is **genuinely inexpressible** without unacceptable false-positives; the bare-import form is expressible only by trading a false-negative for a false-positive class. This is an ast-grep structural-matcher limit, not a framework gap. (Note: the `ir-unfreeze` LG-S1 census — 40.0% flat-precise → 93.3% flat+relational, n=15 — measured the *require-via-ban* class that relational **does** close; the yaml.load bypass forms are a **different** sub-problem, import-binding, that relational does **not** close. The census does not transfer to this rule.)

## §4 Verdict: accept as a deliberate demo limit — do NOT broaden the fixture

1. **The single-pattern ceiling was deliberate at design time.** The spec chose this rule *because* it reduces to a single ast-grep pattern: «single ast-grep `pattern` (frozen-IR-expressible)» ([2026-07-11-live-generation.md §Qe](2026-07-11-live-generation.md)); §Qb states the «honest v1» posture (single-pattern call/attribute/import bans ship; everything else is a research-only finding). Precision caveat (verified: grep for `alias|bare import|from yaml import|import binding` over the spec returns zero hits): these *specific* bypass forms were never enumerated in the spec — what was deliberate is the single-pattern **ceiling**, and the bypass forms fall *within* that accepted ceiling, not that they were individually foreseen and waived. The project holds a «keep the honest counter-example» culture — the mutable-default non-match is kept as an honest counter-example in the same §Qe.
2. **The demo's value is the pipeline, not rule completeness.** `getff-researched-no-yaml-load` demonstrates live-research → executable rule + firing test — the same honesty note as `no-head-element`. «Fixing» the bypass forms would make the demo *worse* (FN → FP) or is impossible (alias).
3. **Broadening is a real capability commit, and a separate decision.** Wiring the bridge to author relational nodes = a new field on `AstgrepResearchedPractice` + authoring logic + tests → build-vs-reuse gate + `Prior-art:` trailer. It is the bridge-side follow-through of OWNER-FORK-1, its own umbrella — not a drive-by fixture patch. And even then, the alias form stays uncloseable.

**Falsifier (when to revisit):** a consumer ships a *researched* python convention whose honest expression genuinely needs `any:`/relational alternation (not import-binding), AND the single-pattern degrade-to-research-only is materially blocking real rule delivery. That reopens the bridge-side relational-authoring umbrella — with the alias-form limitation stated up front.

## §5 What this patch changes (documented non-fix only)

- **This research-patch** — the durable decision record.
- **[practice.json](../../../packages/core/synthesizer/fixtures/live-generation/getff-researched-no-yaml-load.practice.json)** — a `_coverage_note` field naming the two known bypass forms as a deliberate demo limitation, pointing here. Data edit only; the renderer ignores unknown fields, so the committed rendered artifact and its byte-drift gate are unaffected.
- **[research-to-node.ts](../../../packages/core/synthesizer/research-to-node.ts)** — the «frozen renderer emits only a flat `pattern:`» comment (stale post-ir-unfreeze S2) corrected: the renderer CAN emit relational; the bridge deliberately authors only flat-pattern nodes today (relational authoring un-wired). Comment-only.

## §1.7 Self-review (forward + backward)

**Forward-check (this patch complies with active disciplines):**

- [`ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md): **T20** — the verdict is backed by a live `ast-grep@0.44.1` probe (§3 table) + file:line reads, not asserted from memory; **T3** — every «fires / does-not-fire» claim carries the probe stdout; **T16** — the ir-unfreeze census is explicitly NOT transferred to this rule (its problem class — require-via-ban — differs from this rule's — import-binding), stated in §3; **T15** — the verdict names its own falsifier (§4).
- [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md): zero CI/LLM cost — a markdown record + two comment/data edits; the probe was session-side, deterministic.
- [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md): the decision is **KEEP NARROW / non-fix** — no capability proposed; the alternative (bridge-side relational authoring) is explicitly deferred as its own capability-commit umbrella, not smuggled in.
- [`CLAUDE.md` PR-strategy](../../../CLAUDE.md): stayed in scope — the bridge-side broadening is surfaced as an option, not autonomously opened; the only source touched (`research-to-node.ts`) is a comment correction of a factual error central to this finding.

**Backward-check (sweep of sibling surfaces where this change-class — «documented coverage limit of a live-generation demo rule» — could also apply):**

- **The other committed practice records** — `PRACTICE_RECORDS` holds exactly one record (`getff-researched-no-yaml-load.practice.json`, [render-researched-astgrep.ts:58-60](../../../packages/core/synthesizer/render-researched-astgrep.ts)); no sibling researched practice exists to carry the same note. SWEPT-CLEAN.
- **The S2 rule-tests sidecar** ([rule-tests/astgrep.json](../../../packages/core/synthesizer/fixtures/live-generation/rule-tests/astgrep.json)) — its `bad`/`good` cases are all literal `yaml.load`/`yaml.safe_load` forms (no alias/bare-import case), so it neither asserts nor contradicts the bypass-form coverage; untouched, firing test green. SWEPT-CLEAN.
- **The spec** ([2026-07-11-live-generation.md §Qb/§Qe](2026-07-11-live-generation.md)) — already states the single-pattern «honest v1» ceiling and keeps the mutable-default honest counter-example; this patch is consistent with it, supersedes nothing (per Artifact Ownership Contract the spec is design-session-owned; not edited). SWEPT-CLEAN.
- **The bridge honesty comment** — the one contradicting artefact (stale «frozen renderer») is corrected in this patch's scope. SWEPT (fixed).
