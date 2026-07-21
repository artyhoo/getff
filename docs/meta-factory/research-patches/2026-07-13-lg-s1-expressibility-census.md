<!-- scope:live-generation -->
# LG-S1 expressibility census — OWNER-FORK-1 data (ConventionNode IR unfreeze)

> **Scope:** the LG-S1 sub-deliverable 7 (kickoff §2) — measure, on real python conventions, whether the FROZEN `ConventionNode` IR can express live-researched rules, to feed OWNER-FORK-1 (unfreeze the IR or stay narrow). DATA ONLY — the fork is the owner's; this patch decides nothing. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Status:** LANDED on `claude/live-generation-s1-python-a52650` as the OWNER-FORK-1 durable record. The unfreeze decision itself is a separate MT-plane umbrella (STOP line, kickoff §2), decided by the owner on this data.
> **Method:** 15 real python conventions (stratified across security / correctness / typing / imports / style — T9 counter), each classified by a subagent that authored a candidate ast-grep rule and fired it **for real** against `@ast-grep/cli@0.44.1` in an OS temp dir (every row carries an actual `ast-grep scan` exit code — no prose-only claim, T3/T15), with an adversarial relational-collapse pass challenging each non-expressible verdict. Ran as a session-side Workflow (no paid LLM in CI — [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)). Full working ledger: `.superpowers/sdd/lg-s1-census.md` (untracked — excluded via `.git/info/exclude`, not a shared `.gitignore`, so not reproducible across machines; the bucket counts + rate arithmetic above are reproducible from staging artifacts, the per-row exit codes are corroborating detail in the ledger only).
> **Date:** 2026-07-13.
>
> **Post-merge note (2026-07-21):** LG-S1 merged to `staging` via #1005; the require-via-ban count was corrected post-merge by #1025 (5→3, now consistent across §1/§2). This census now lives on `staging` as the durable OWNER-FORK-1 record — the "LANDED on `claude/live-generation-s1-python-a52650`" status above is historical (its original feature-branch). Body below is unchanged from the landed record (archival convention). Cited as the DATA source by the `ir-unfreeze` umbrella kickoff (2026-07-21).

---

## §1 Result headline

| bucket | meaning | count (n=15) | rate |
|---|---|---|---|
| a-flat | single flat ast-grep `pattern` (kind call/attribute/import) — renders through the frozen IR TODAY | 6 | **40.0%** |
| b-relational | needs relational `not:/has:/all:/any:` — ast-grep supports it, but the frozen IR `params` (`Record<string,string\|number>`) + `render-astgrep.ts` (flat `pattern:` only) cannot carry it | 8 | **53.3%** |
| c-type-aware | needs a type checker / dep-graph (mypy / import-linter — deferred backends #213/#214) | 1 | 6.7% |
| d-doc-conformance | only checkable semantically vs prose docs — session-time Living-Documentation, NOT a CI lint gate (no-paid-llm) | 0 | 0.0% |

- **% expressible (a+b) = 14/15 = 93.3%.**
- **Flat-only (frozen IR) = 40.0%** → BELOW the §Qb ~50% shippable threshold — i.e. worse than even the start of the §Qb 50-70% «product-death band» (Option B unfreeze is justified by measured need per the §Qb decider rule).
- **Flat + relational = 93.3%** → well above, BUT reachable only via a **relational-params unfreeze** (`kind` + `not:/has:/all:/any:`) — the concrete, minimal IR change, NOT a «require polarity» field.
- **The decision-relevant delta (+53.3 pts, 8 conventions) is exactly the set gated behind that relational unfreeze**, including all 3 «require-via-ban» cases (the positive-polarity conventions named in §2 — require-type-hints, require-future-annotations, require-docstring; if the author intended a wider 5-case set, the additional 2 must be enumerated here explicitly, since the §2 list is the named source of truth).

## §2 The «require via ban» finding (owner hypothesis, CONFIRMED)

Positive best-practices («require X») reduce to «forbid the shape that LACKS X» (`kind + not: has:`): **3/3** positive-polarity conventions in the sample (require-type-hints, require-future-annotations, require-docstring) became expressible this way — but **all sit in bucket-b** (relational). So positive-best-practice expressibility is real and does NOT need a new polarity axis; it needs the relational-params shape. This directly answers the owner's «можно ли всё через запреты» — mostly yes, via relational bans, contingent on the same minimal unfreeze.

## §3 Coordinator nuance (read before deciding the fork)

`b-relational` here means «the PRECISE expression needs relational», NOT «flat impossible». The flagship `getff-no-yaml-load` is counted b (a precise rule uses `not: has: SafeLoader`), yet its **flat form `pattern: yaml.load($$$ARGS)` fires** (over-broad on the rare safe-Loader call) — so LG-S1 ships it frozen and needs no unfreeze. ⇒ 40% is the «flat AND precise» rate; a «flat, accepting over-broad false positives» rate is higher. Weigh the fork as **40% precise-flat / 93% precise-relational**, where the relational tier buys precision + the entire positive-best-practice class.

## §4 Caveat

n=15 is a small curated sample skewed toward canonical Ruff/Bandit/PEP conventions → read 40/93 as indicative, not a population estimate. Firing evidence is uniformly real (every row an actual exit code; the one c-type-aware case carries a genuine dirty-on-good exit 1). Weak spots are precision-ceiling disclosures (literal-identifier rules miss import-aliased forms), not firing failures.

## §5 §1.7 self-review

- **Forward-check:** complies with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (census ran in a session-side Workflow, ast-grep is a free PATH binary, zero paid-LLM/API gate); [phase-research-coverage.md](../../../.claude/rules/phase-research-coverage.md) (measured BOTH axes — antipattern-bans AND positive-best-practices — per the vision sharpening, not tunnelled on ban-examples); [ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) T3/T15 (every bucket carries a real fired `ast-grep scan` exit code, no prose-only classification; the adversarial relational-collapse pass is the self-applied falsifier); [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) (this patch carries the scope annotation + folder-authority header, claims authority for nothing beyond the census data).
- **Backward-check:** class of this change = **additive OWNER-FORK-1 evidence** (a research-patch recording measured data). Sibling surfaces where the same change-class would apply: the two OTHER ConventionNode-routed stacks (rust — also affected by OWNER-FORK-1, per §Forks; js is NOT ConventionNode-routed so unaffected) — this census measures python only and does NOT claim to cover rust's expressibility (a rust census is future work if the owner takes up the unfreeze). It supersedes nothing: the frozen IR is untouched (the unfreeze is a separate umbrella), the R-phase patch [2026-07-11-live-generation.md](2026-07-11-live-generation.md) §Qb PLANNED this census and is not rewritten. Self-application (T15): the census applied its own «measure empirically, do not assert» discipline to itself — no bucket rests on reasoning where a firing probe was reachable.

## §6 See also

- [2026-07-11-live-generation.md](2026-07-11-live-generation.md) §Qb — the R-phase that specified this census + the §Qb decider framing («≥~50% flat → product; the 50-70% product-death band → unfreeze justified»).
- [.claude/orchestrator-prompts/live-generation/kickoff.md](../../../.claude/orchestrator-prompts/live-generation/kickoff.md) §2 (sub-deliverable 7) + §4 (T-LG-D: no unilateral IR unfreeze).
- `packages/core/ir/types.ts` — the FROZEN `ConventionNode` (the artifact OWNER-FORK-1 decides whether to unfreeze).
