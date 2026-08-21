# Kickoff — language-discipline residue (3 independent stages)

> **Type:** mixed — Stage 1 I-phase, Stage 2 R-phase + register edit, Stage 3 R-phase. **Three INDEPENDENT atomic PRs** (one per stage). Order = cheap → expensive; no stage blocks another.
> **Dispatch target:** aif-handoff autonomous worker or `/pipeline` per stage. Stages 1 and 2 are self-contained autonomous; Stage 3 is research, returns a patch + verdict (no source mutation).
> **Self-contained:** every exact change for Stages 1 & 2 is embedded below; executable on the current `staging` base alone (all files already exist there). The links are operator references — do NOT make execution depend on reading them.
> **Origin:** follow-up to the language-discipline umbrella ([PR #583](https://github.com/Yhooi2/rules-as-tests-aif/pull/583), merged 2026-06-16). Design: [spec](../../../docs/superpowers/specs/2026-06-16-language-discipline-design.md) + [plan](../../../docs/superpowers/plans/2026-06-16-language-discipline.md). These three items were the residue surfaced at umbrella close.

## Goal (one line)

Close the three residue items the language-discipline umbrella left open: (1) path-scope the new rule off always-on, (2) record the build-vs-reuse decision in the SSOT, (3) fix the always-on budget guard that measures a 78% overage but is wired to nothing.

## Scope (STRICT — read before touching anything)

- **IN scope:** exactly the three stages below.
- **OUT of scope (do NOT touch):** the merged language-discipline files except Stage 1's frontmatter addition to `.claude/rules/language-discipline.md`; any other rule / skill / hook; the `check-alwayson-budget.sh` *implementation* in Stage 3 (Stage 3 is research-only — it proposes, it does not wire). Bundling stages into one PR is scope creep (trap T-LangRes-D below).

---

## Stage 1 — path-scope `language-discipline.md` off always-on (I-phase, ~15 min) [residue item 2]

**Why (with evidence).** The rule [`.claude/rules/language-discipline.md`](../../../.claude/rules/language-discipline.md) currently loads **every session** (CC auto-loads all `.claude/rules/*.md`). Per [`rule-enforcement-channel-selection.md §1`](../../../.claude/rules/rule-enforcement-channel-selection.md), always-on is reserved for the 3–4 sweeping invariants; everything else must be path-scoped. Language-of-machinery is a narrow topic → always-on for it is `#always-on-bloat`. Four rules already dogfood `paths:` frontmatter (`no-paid-llm-in-ci.md`, `parallel-subwave-isolation.md`, `phase-research-coverage.md`, `rule-enforcement-channel-selection.md`) — this is an established, low-risk pattern.

**Exact edit.** Prepend YAML frontmatter before the `# Language discipline …` title, and add the marker pair immediately after the title (mirrors [`no-paid-llm-in-ci.md:1-10`](../../../.claude/rules/no-paid-llm-in-ci.md)):

```markdown
---
paths:
  - ".claude/hooks/**"
  - ".claude/skills/**"
  - "scripts/**"
---

# Language discipline — internal English, human-facing AIF_HOOK_LANG-gated

<!-- globs: .claude/hooks/**, .claude/skills/**, scripts/** -->
<!-- inject: Internal machinery (hooks/skills/scripts) is English-only; human-facing output follows AIF_HOOK_LANG (ru→Russian, else English); match-data (triggers, detection patterns) stays bilingual. See §1-§2. -->

> **Class:** A — companion principle test shipped at …
```

Keep the `paths:` globs and the `<!-- globs: -->` globs **identical** (the hook's matcher supports only the `prefix/**` / `*.ext` / exact subset).

**Verify (all must pass):**

```bash
( cd packages/core && npx vitest run principles/09-doc-authority-hierarchy.test.ts principles/22-internal-english.test.ts )
npx markdownlint-cli2 .claude/rules/language-discipline.md
```

- Principle 09 must stay green (the Authoritative-for header is still found after the frontmatter — the 4 existing rules prove the pattern).
- Principle 22 must stay green (its `bodyOf()` strips `^---\n…---\n` frontmatter, so trigger-words remain exempt).

**Commit:**

```text
refactor(rule): path-scope language-discipline off always-on (paths: + markers)

Loads only when editing hooks/skills/scripts, per rule-enforcement-channel-selection §1
(not a sweeping invariant). Mirrors the 4 rules already carrying paths: frontmatter.

Prior-art: skipped — applies an existing in-repo pattern (paths: frontmatter) to one rule, no new capability/dependency.
```

---

## Stage 2 — record the build-vs-reuse decision in the SSOT (R-phase + register edit) [residue item 3]

**Why (with evidence).** The two capability commits from the umbrella carry `Prior-art: skipped` trailers (preserved in squash commit `92c776c`). principle 11 F1/F3 is **green** (the rationale is valid) and the CI backstop treats `skipped`-substance as warn-only ([audit-self.yml §7, Option B](../../../.github/workflows/audit-self.yml)), so nothing is broken. The residual gap is purely the build-vs-reuse register: the SSOT ([`prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md)) does not record the decision. The merged `92c776c` trailer **cannot** be rewritten (frozen history; #584/#585/#586 built on top) — so this stage is a *forward* register entry, not a trailer fix.

**Task (search FIRST, then write — this is a negative-existence claim, invariant 3):** the BUILD verdict («no upstream tool gates internal-English + env-gated i18n for AI machinery») is currently **provisional** — only an SSOT-grep (0 hits) was run, NOT the full 6-item search. Before writing the entry, run the search-coverage 6-item checklist ([`phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md)):

- DeepWiki `ask_question` ×3 phrasings, e.g. «does any framework gate that internal tooling/comments stay in one language while user-facing output is locale-switched?», «tool that fails CI on non-English comments in scripts/hooks», «env-var-gated output language directive for an AI agent harness».
- WebSearch ×3 phrasings on the problem-domain term (e.g. «lint rule enforce English-only code comments», «i18n gate AI agent output language environment variable»).

If the search confirms no production analog → verdict **BUILD**; if it surfaces one → verdict ADOPT/ADAPT/REFERENCE and adjust the entry accordingly.

**Register edit.** Append SSOT entry **#122** (next free ID — highest is 121) to [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md), one table row, matching the existing 8-column format (`| ID | prior-art surveyed / absence | our use | first-date | last-date | verdict | rationale | trigger-to-revisit |`). The entry must mention `.claude/rules/language-discipline.md` and `packages/core/principles/22-internal-english.test.ts` verbatim (so `hasSsotMatch` links them) and cite the 6-item search just run.

**Verify:** `( cd packages/core && npx vitest run principles/11-build-first-reuse-default.test.ts )` stays green (F2 verdict recognized, F4/IDs unique).

**Commit:** `docs(ssot): record language-discipline guard build-vs-reuse decision (#122)` + a `§1.7:`-free body (register edit, not a discipline-file `## §` change) — but DO carry a `Prior-art:` line referencing the entry it adds.

---

## Stage 3 — always-on budget guard liveness (R-phase, research-only) [residue item 1]

**Why (with evidence).** [`scripts/check-alwayson-budget.sh`](../../../scripts/check-alwayson-budget.sh) is a "standing drift-guard" that fails when always-on context exceeds a ceiling. Current state on `staging`: `CLAUDE.md` (15 707 B) + 13 rule files (163 903 B) ≈ **179 610 B against ceiling 101 000 B → ~78% over**. But it is **wired to nothing** — `grep -rl check-alwayson-budget .github/ .husky/ .claude/settings.json package.json` returns empty. A guard that measures a 78% overage and fires nowhere is the project's own `armed-but-not-fired` / «documents lie, tests don't» pattern turned on itself (recursive self-application gap, invariant 2). Two coupled defects:

1. **Unwired:** the script's own comment says «wired into pre-push by a C1-I fix once the real ceiling is known» — that fix never landed.
2. **Measure ignores path-scoping:** [`scripts/measure-always-on.sh`](../../../scripts/measure-always-on.sh) is a naive `find .claude/rules -name '*.md'` byte-sum — it counts path-scoped rules (which CC does NOT load every session) the same as always-on ones. So the number overstates true always-on load, and Stage 1's path-scoping will NOT move it (trap T-LangRes-A).

**Deliverable (research patch under [`docs/meta-factory/research-patches/`](../../../docs/meta-factory/research-patches/), NO source mutation):** answer, with evidence —

1. Should `measure-always-on.sh` discount `paths:`-scoped rules (count only frontmatter-less / always-on rules + CLAUDE.md)? What is the *true* always-on baseline after Stage 1 + path-scoping the other non-invariant rules?
2. What is an honest ceiling (the 101 000 default is stale)? Derive from the true baseline + a documented headroom %.
3. Which channel should the wired guard use (pre-push? a principle test? CI last-resort) per [`rule-enforcement-channel-selection.md §3`](../../../.claude/rules/rule-enforcement-channel-selection.md) — and is wiring even warranted, or is periodic-audit enough?

**Explicitly OUT of scope for this stage:** implementing the measure fix or wiring the guard. Those are a follow-up I-phase that the maintainer greenlights from this stage's verdict. Do NOT wire `check-alwayson-budget.sh` at the stale 101 000 ceiling — it would hard-fail every commit at 78% over (trap T-LangRes-C).

---

## AI-laziness traps — REQUIRED (per [`.claude/rules/ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md))

**Active traps for this umbrella: T2, T5, T11, T12, T15, T16, T19** + four domain-specific:

- **T-LangRes-A** (measure-vs-reality) — Stage 1 path-scoping reduces *real* session load but does NOT move the `measure-always-on.sh` byte-sum number; do NOT claim Stage 1 «fixes the budget». Only Stage 3's measure fix connects the two. Stating «always-on reduced» after Stage 1 without noting the metric is unchanged is the trap.
- **T-LangRes-B** (negative-existence without search) — Stage 2's BUILD verdict is provisional until the full 6-item search runs. Do NOT escape-hatch «no upstream tool exists» from training data (T11/T12). Run DeepWiki + WebSearch ×3 each, cite results, THEN write the verdict.
- **T-LangRes-C** (wire-the-guard-as-is) — Stage 3 must NOT propose wiring `check-alwayson-budget.sh` at the stale 101 000 ceiling; a guard that hard-fails every commit at 78% over is worse than an unwired one. Fix measure + ceiling FIRST; wiring is a downstream I-phase.
- **T-LangRes-D** (stage-bundling) — these are three INDEPENDENT PRs. «I'm already in the rules dir, let me also …» bundling Stage 1 + Stage 3, or doing the Stage 3 *implementation* inside the research patch, is scope creep. One stage = one atomic PR.

**Self-application (T15):** this kickoff is itself authored under the language-discipline regime — it is a repo artifact, so it is in English (category 1), per the very rule Stage 1 path-scopes.

## Dispatch sequence (binding — per [`kickoff-staging-placement.md §1`](../../../.claude/rules/kickoff-staging-placement.md))

This kickoff must be **merged to `staging`** before any `/pipeline language-discipline-residue` or aif dispatch — a branch-only kickoff is invisible to dispatch sessions (they run on `staging`). Author → merge → only THEN dispatch.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
