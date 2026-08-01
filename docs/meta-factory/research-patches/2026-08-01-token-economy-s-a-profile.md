<!-- scope:token-economy -->

# Token-economy stage A — always-on attribution + ranked cost profile

> **Scope:** stage A of the token-economy research umbrella. Attributes the repository's
> always-on context payload to concrete artefacts, ranks them by measured cost, and answers the
> stage's central question — **does always-on documentation or tool-output accumulation dominate
> the resident-context bill?** Zero build: proposals only (no rule/hook/skill/eviction — kickoff
> §3). Stage B owns candidate evaluation; the distillation seat owns merge.
> **Source for session behaviour:** the §A2 billing profile, inlined in the dispatch kickoff,
> measured 2026-08-01 on the host over 247 transcripts / 58,345 assistant turns. The transcript
> path `~/.claude/projects/*rules-as-tests-aif*/` does **not** exist in the aif container; any
> session-level claim not in §A2 is recorded `INCONCLUSIVE — not in the inlined profile`, never
> inferred (kickoff §0 binding grammar, `destination-environment-verification.md §3`).
> **Assumption (binding, stated once):** **4 bytes ≈ 1 token**. No tokenizer is available in the
> container; every converted figure is labelled "est., 4 B/t assumed". Applied uniformly.

## Headline (the answer to the central question, up front)

In the median session (213 turns), **always-on documentation is the larger resident-cost class
but tool-output accumulation is within the same order of magnitude — the two are co-dominant,
not one-runaway.**

| class | est. cost-units / session (median) | share of (always-on + top-5 tool-output) |
|---|---:|---:|
| always-on documentation (11 rows, full payload) | 754,884 | 64.5% |
| tool-output accumulation (top 5 tools, **lower bound**) | 415,351 | 35.5% |

The tool-output figure is a **deliberate lower bound** on its absolute cost — the
uniform-arrival assumption understates tool-output residency specifically (front-loaded arrival
would raise it; see §A4.2). The median-vs-mean session choice is **ratio-neutral** (both classes
are linear in N — see §A4.2). Under realistic front-loaded tool arrival the two classes approach parity. The practical consequence: a token-economy intervention that
touches only always-on documentation addresses at most ~⅔ of the resident bill; the other ~⅓ is
earned tool output whose residency is the real lever (§A3 falsifier).

**Spend shape (from §A2, context for the above):** 85.5% of the corpus bill is context
*re-submission* (cache read 53.3% + cache write 32.2%), 14.0% output, 0.5% uncached input.
Caching is working; the cost is that a large cached context is paid for on every turn — which is
exactly what the residency multiplier below quantifies.

## A1 — W1: always-on payload attribution

### A1.1 The 11-row always-on population (measured)

Repo-side rows (1-8) measured in-container via `wc -c`; host-only rows (9-11) cited verbatim from
kickoff §2.8 (the paths are unreachable in the container). All 8 repo-side measurements **match
the inlined table exactly — no delta** (`wc -c` output below the table).

| # | artefact | bytes | est. tokens (4 B/t) | loading channel |
| --- | --- | ---: | ---: | --- |
| 1 | `CLAUDE.md` | 23,740 | 5,935 | whole file, every session |
| 2 | `.claude/rules/00-rule-index.md` | 4,030 | 1,008 | whole file, every session |
| 3 | `.claude/rules/ai-laziness-traps.md` | 26,387 | 6,597 | always-on core (index) |
| 4 | `.claude/rules/build-first-reuse-default.md` | 12,667 | 3,167 | always-on core (index) |
| 5 | `.claude/rules/attention-is-not-a-mechanism.md` | 2,629 | 657 | always-on core (index) |
| 6 | `.claude/rules/cold-seat-economy.md` | 12,453 | 3,113 | **loaded despite `claudeMdExcludes`** |
| 7 | `.claude/rules/autonomous-loop-continuity.md` | 13,459 | 3,365 | **loaded despite `claudeMdExcludes`** |
| 8 | `.claude/rules/git-conflict-merge-forward.md` | 9,285 | 2,321 | **loaded despite `claudeMdExcludes`** |
| 9 | `~/.claude/CLAUDE.md` (operator-global) | 3,593 | 898 | HOST-ONLY (§2.8), every session |
| 10 | memory `MEMORY.md` index | 16,504 | 4,126 | HOST-ONLY (§2.8), every session |
| 11 | session-bootstrap digest (`inject-session-bootstrap.sh`) | 1,760 | 440 | HOST-ONLY (§2.8), **injected EVERY PROMPT** |
| | **total always-on** | **126,507** | **31,627** | |

Evidence (T3 — every repo-side size is command + output):

```text
$ wc -c CLAUDE.md .claude/rules/00-rule-index.md .claude/rules/ai-laziness-traps.md \
    .claude/rules/build-first-reuse-default.md .claude/rules/attention-is-not-a-mechanism.md \
    .claude/rules/cold-seat-economy.md .claude/rules/autonomous-loop-continuity.md \
    .claude/rules/git-conflict-merge-forward.md
  23740 CLAUDE.md
   4030 .claude/rules/00-rule-index.md
  26387 .claude/rules/ai-laziness-traps.md
  12667 .claude/rules/build-first-reuse-default.md
   2629 .claude/rules/attention-is-not-a-mechanism.md
  12453 .claude/rules/cold-seat-economy.md
  13459 .claude/rules/autonomous-loop-continuity.md
   9285 .claude/rules/git-conflict-merge-forward.md
 104650 total
```

Rows 9-11 are not re-measured: the container cannot reach the host paths and a container-side run
of `inject-session-bootstrap.sh` would produce a container-specific digest, not the host one
(`destination-environment-verification.md §3`). Sizes are cited from §2.8.

### A1.2 The claudeMdExcludes discrepancy (carried finding — NOT fixed)

`.claude/settings.json` `claudeMdExcludes` lists 7 rules (read in-container; the file is read-only
for this stage):

```text
$ grep -A 9 'claudeMdExcludes' .claude/settings.json
  "claudeMdExcludes": [
    ".claude/rules/egress-no-api-bypass.md",
    ".claude/rules/memory-codification.md",
    ".claude/rules/recommendation-laziness-discipline.md",
    ".claude/rules/reviewer-discipline.md",
    ".claude/rules/autonomous-loop-continuity.md",
    ".claude/rules/git-conflict-merge-forward.md",
    ".claude/rules/cold-seat-economy.md"
  ]
```

Observed live (kickoff §1, host-measured 2026-08-01): only the first 4 were actually evicted
(`egress-no-api-bypass`, `memory-codification`, `recommendation-laziness-discipline`,
`reviewer-discipline`). The last 3 loaded anyway — rows 6, 7, 8 above, **35,197 B / 8,799 est-tokens
of declared-cold content that is resident every session** (12,453 + 13,459 + 9,285 = 35,197 B).

Separately, the `00-rule-index.md` `Channel(s)` column marks only 3 rules `always-on core`
(`ai-laziness-traps`, `attention-is-not-a-mechanism`, `build-first-reuse-default`), under-reporting
the observed always-on set (which includes rows 1, 2, 9, 10, 11 plus the 3 leak-through rows 6-8).

**Recorded as a measured finding, not fixed** (kickoff §3 descope + §0 ownership). Proposed as a
**next-stage root-cause investigation** candidate: why does `claudeMdExcludes` under-enforce for
3 of 7 listed rules? Hypotheses worth testing on the host (NOT here): (a) the listed paths use a
prefix that does not match the loader's resolution; (b) the 3 leak-through rules carry a secondary
load trigger (e.g. a `paths:`/`channel:` marker, or a Skill-/claude-md-channel token) that
re-admits them; (c) ordering between `claudeMdExcludes` and other loaders. The leak-through rows
are individually small (1.8-2.6 k tokens), but the *mechanism* is the finding: a declared hot/cold
split that silently does not enforce is a token-economy defect class of its own.

### A1.3 The edit-time-injection class (resident-once-fired, NOT always-on)

A separate cost class: rules delivered by the **`inject-matching-rule.sh`** PostToolUse hook
(Edit/Write, injects a one-line **summary** of the rule, once per session when a matching file is
touched). This is the class kickoff §1 W1 asked W4 to inventory — the `Channel(s) = edit-time inject`
rows of `00-rule-index.md`. **Cost is zero unless they fire**; once fired the summary is resident
for the rest of the session (T-TokenA-A guard: these are NOT in the always-on ranking because their
residency is conditional, not from turn 1).

**Population note (T14 shape — completeness sentence must match the definition).** The class
definition above is **narrow** (index rows carrying `edit-time inject`, which is the
`inject-matching-rule.sh` set). It is NOT the wider "any rule with `paths:` frontmatter" — CC-native
read-time `paths:` loading is a **different channel** (loads the whole rule on read, not a one-line
summary on edit). One rule carries `paths:` frontmatter WITHOUT an `edit-time inject` index entry —
`.claude/rules/phase-research-coverage.md` (`paths:(4)`, no `<!-- inject: -->` marker, 34,151 B /
8,538 est-tokens, larger than any of the 15 rows below). It is **outside the enumerated set by
design**: the index's `paths:(N)`-without-`edit-time inject` notation marks it CC-native-read-time
only. A wider "all `paths:`-bearing rules" inventory is a different population and is **not what the
15/15 completeness claim below covers**.

Enumerated from the `Channel(s)` = `edit-time inject` rows of `00-rule-index.md` (all 15, not the
first three that look big — T1/T10):

| rule | bytes | est. tokens | `paths:` firing condition |
| --- | ---: | ---: | --- |
| `ci-tool-pinning.md` | 12,050 | 3,013 | `.github/workflows/**`, `.github/actions/**`, `*.sh`, `setup`, `.husky/**`, `plugin/hooks/**` |
| `companion-install-principle.md` | 6,422 | 1,606 | `setup.d/**` |
| `destination-environment-verification.md` | 16,585 | 4,146 | `.claude/orchestrator-prompts/**` |
| `doc-authority-hierarchy.md` | 15,348 | 3,837 | `.claude/rules/**`, `agents/**`, `.claude/skills/**`, `packages/core/templates/**` |
| `dual-implementation-discipline.md` | 21,732 | 5,433 | `.claude/hooks/**`, `agents/**`, `.claude/skills/**` |
| `evidence-regeneration.md` | 20,517 | 5,129 | `packages/core/backends/**` |
| `kickoff-staging-placement.md` | 6,051 | 1,513 | `.claude/orchestrator-prompts/**` |
| `language-discipline.md` | 7,182 | 1,796 | `.claude/hooks/**`, `.claude/skills/**`, `scripts/**` |
| `no-paid-llm-in-ci.md` | 5,897 | 1,474 | `.github/workflows/**`, `.github/actions/**` |
| `parallel-subwave-isolation.md` | 8,600 | 2,150 | `.claude/orchestrator-prompts/**` |
| `research-source-trust.md` | 26,633 | 6,658 | `packages/core/research/**`, `.ai-factory/research-allowlist.json` |
| `rule-enforcement-channel-selection.md` | 18,621 | 4,655 | `.claude/rules/**`, `packages/core/principles/**` |
| `skill-description-quality.md` | 9,586 | 2,397 | `.claude/skills/**` |
| `source-before-shape.md` | 16,852 | 4,213 | `.claude/skills/**`, `agents/**`, `.claude/orchestrator-prompts/**` |
| `zcode-parity-doctrine.md` | 23,101 | 5,775 | `.claude/hooks/**`, `scripts/render-harness-config.mjs`, `plugin/hooks/**`, + 6 zcode decision/patch docs |
| | **215,177** | **53,795** | |

Est-tokens use the **sum-of-rounded-rows** convention (each row = `round(bytes/4)`; total = sum of
row values). The byte total 215,177 ÷ 4 = 53,794.25 — `round()` of the byte-derived figure would
give 53,794; **two rows round up** (12,050 → 3,013 not 3,012; 16,585 → 4,146 not 4,145), so the
column sum is 53,795. Stating this uniformly avoids the 1-token drift between the two conventions.

Evidence:

```text
$ wc -c .claude/rules/{ci-tool-pinning,companion-install-principle,destination-environment-verification,doc-authority-hierarchy,dual-implementation-discipline,evidence-regeneration,kickoff-staging-placement,language-discipline,no-paid-llm-in-ci,parallel-subwave-isolation,research-source-trust,rule-enforcement-channel-selection,skill-description-quality,source-before-shape,zcode-parity-doctrine}.md
 12050  ci-tool-pinning.md
  6422  companion-install-principle.md
 16585  destination-environment-verification.md
 15348  doc-authority-hierarchy.md
 21732  dual-implementation-discipline.md
 20517  evidence-regeneration.md
  6051  kickoff-staging-placement.md
  7182  language-discipline.md
  5897  no-paid-llm-in-ci.md
  8600  parallel-subwave-isolation.md
 26633  research-source-trust.md
 18621  rule-enforcement-channel-selection.md
  9586  skill-description-quality.md
 16852  source-before-shape.md
 23101  zcode-parity-doctrine.md
215177  total
```

This class is ~1.7× the always-on byte volume (215,177 B vs 126,507 B) but its cost is **gated
behind a path match**. In a session that touches many scopes (typical: a `/aif-implement` run edits
under `packages/`, `.claude/`, `.github/`), several fire together; the residency then matches the
always-on multiplier for the remainder of the session. Per-session fired-cost is **NOT computable
from §A2** (no per-session tool/path breakdown) → `INCONCLUSIVE — not in the inlined profile`. The
stage records the population + sizes (gated class) and stops.

## A2 — the measured billing profile (INLINED, host-measured — cited not re-measured)

Reproduced verbatim from the dispatch kickoff §2 (single aggregator run 2026-08-01T01:00:50Z over
247 transcripts / 58,345 assistant turns). The container cannot reach the transcript path; these
numbers are **cited as host-verified inputs** (kickoff §0), not re-earned here.

### A2.1 Raw token volume by billing category

| category | raw tokens | share of raw |
| --- | ---: | ---: |
| cache READ | 17,501,892,975 | 94.8% |
| cache WRITE | 844,266,278 | 4.6% |
| output | 91,530,961 | 0.5% |
| uncached input | 17,379,404 | 0.1% |
| **total raw** | **18,455,069,618** | 100.0% |

### A2.2 Weighted by price multiplier — the spend shape

Multipliers: cache write 1.25×, cache read 0.1× (Anthropic prompt-caching), output 5×
(output/input ratio, holds across the Opus / Sonnet / Fable / Haiku families). Verified against
live published pricing 2026-08-01 by the dispatch-input station (treat as verified — host-verified
input).

| category | raw tokens | multiplier | weighted units | cost share |
| --- | ---: | ---: | ---: | ---: |
| cache READ | 17,501,892,975 | 0.1× | 1,750,189,298 | **53.3%** |
| cache WRITE | 844,266,278 | 1.25× | 1,055,332,848 | **32.2%** |
| output | 91,530,961 | 5× | 457,654,805 | 14.0% |
| uncached input | 17,379,404 | 1× | 17,379,404 | 0.5% |
| **TOTAL** | | | **3,280,556,354** | 100% |

**85.5% of spend is context re-submission**, not generation. The resident payload is large and is
paid for every turn.

### A2.3 Turn-count distribution — the residency multiplier

| statistic | turns |
| --- | ---: |
| sessions | 247 |
| median | 213 |
| p90 | 517 |
| max | 833 |
| total | 58,345 |
| mean (derived: total/sessions) | 236.2 |

Derived (kickoff §2.3): a token resident from turn 1 costs **21.2×** a one-shot input token at the
median (212 re-reads × 0.1×), **51.6×** at p90, **83.2×** at max.

### A2.6 Tool-result payload returned INTO context (top 10 — cited)

Total across all 52 tools: **40,101,993 chars**. Bash + Read together = 35,242,027 chars
(**87.9%** of all tool-result volume).

| tool | results | total chars | max chars |
| --- | ---: | ---: | ---: |
| Bash | 16,760 | 20,610,988 | 29,914 |
| Read | 1,824 | 14,631,039 | 358,428 |
| mcp\_\_claude-in-chrome\_\_computer | 24 | 1,665,599 | 162,340 |
| Agent | 548 | 1,152,020 | 17,854 |
| Edit | 2,922 | 653,724 | 2,301 |
| mcp\_\_Claude_Browser\_\_preview_screenshot | 7 | 411,436 | 149,561 |
| AskUserQuestion | 240 | 204,112 | 999 |
| Write | 764 | 178,561 | 292 |
| Workflow | 113 | 153,331 | 1,624 |
| TaskOutput | 8 | 70,061 | 32,162 |

### A2.8 Host-only sizes (cited verbatim)

`MEMORY.md` index = 16,504 B; operator-global `~/.claude/CLAUDE.md` = 3,593 B; session-bootstrap
digest as actually injected per prompt = 1,760 B (each measured on the host 2026-08-01).

## A3 — W2: ranked cost (residency multiplier applied) + head/tail boundary

**Formula (kickoff §1 W2):** rows 1-10 `cost_units_median = tokens × 21.2` (resident from turn 1);
row 11 `cost_units_median = tokens × 213 × 1.0` (re-injected fresh every prompt, not cached from
turn 1). Row 11 **direction of error**: 213 is the median **assistant**-turn count, an upper bound
on user prompts, so row 11's cost is **overstated** — say so plainly. (Per-prompt injection also
re-enters the cache fresh, so the per-prompt 1.0× input/short-cache cost dominates the 0.1× tail;
using 1.0× is the conservative upper bound.)

| rank | # | artefact | est. tokens | multiplier | cost-units (median) | share | cumulative |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 3 | `ai-laziness-traps.md` | 6,597 | 21.2 | 139,856 | 18.5% | 18.5% |
| 2 | 1 | `CLAUDE.md` | 5,935 | 21.2 | 125,822 | 16.7% | 35.2% |
| 3 | 11 | session-bootstrap digest (per-prompt) | 440 | 213 | 93,720 | 12.4% | 47.6% |
| 4 | 10 | `MEMORY.md` index | 4,126 | 21.2 | 87,471 | 11.6% | 59.2% |
| 5 | 7 | `autonomous-loop-continuity.md` (leak) | 3,365 | 21.2 | 71,338 | 9.5% | 68.6% |
| 6 | 4 | `build-first-reuse-default.md` | 3,167 | 21.2 | 67,140 | 8.9% | 77.5% |
| 7 | 6 | `cold-seat-economy.md` (leak) | 3,113 | 21.2 | 65,996 | 8.7% | **86.3%** ← HEAD ENDS |
| 8 | 8 | `git-conflict-merge-forward.md` (leak) | 2,321 | 21.2 | 49,205 | 6.5% | 92.8% |
| 9 | 2 | `00-rule-index.md` | 1,008 | 21.2 | 21,370 | 2.8% | 95.6% |
| 10 | 9 | `~/.claude/CLAUDE.md` | 898 | 21.2 | 19,038 | 2.5% | 98.2% |
| 11 | 5 | `attention-is-not-a-mechanism.md` | 657 | 21.2 | 13,928 | 1.8% | 100.0% |
| | | **total** | **31,627** | | **754,884** | 100% | |

**Cumulative-column convention (uniform).** Cumulative share = `cumulative_cost / 754,884`, computed
once per row from the unrounded cost-units column (NOT sum-of-rounded-shares — that drifts 0.1pp on
four cells where the per-rank share rounds down but the cumulative doesn't). The head/tail boundary
is unaffected (rank 7 = 86.3% under every rounding mode).

**Head/tail boundary.** The smallest set accounting for ≥80% of always-on cost is the **top 7**
(cumulative 86.3%); top 6 = 77.5% (just under). **Head ends at `cold-seat-economy.md`** (rank 7).
Tail = ranks 8-11 (`git-conflict-merge-forward`, `00-rule-index`, `~/.claude/CLAUDE.md`,
`attention-is-not-a-mechanism`), **13.7%** combined.

**T-TokenA-A guard (ranking by cost-units, not file size).** Byte-size order is:
`ai-laziness-traps` (26,387) > `CLAUDE.md` (23,740) > `MEMORY.md` (16,504) > `autonomous-loop-continuity`
(13,459) > `build-first-reuse-default` (12,667) > `cold-seat-economy` (12,453) > … with the
**bootstrap digest (1,760 B) last by size**. Cost-units order promotes the bootstrap digest to
**rank 3** (from byte-rank 11) because of its per-prompt multiplicity (213× vs 21.2×). The two
orderings are NOT the same; ranking by file size would have misplaced the digest and dropped a
12.4%-cost artefact to "negligible". The rank order otherwise mostly tracks byte size (rows 1, 2,
10, 7, 4 hold their relative positions) — this coincidence is noted, not relied on.

## A4 — W3: tool-output cost class vs always-on head (CENTRAL DELIVERABLE)

### A4.1 Method

Take the top 5 tools by total chars (§A2.6): Bash, Read, mcp__claude-in-chrome__computer, Agent,
Edit. Convert chars → tokens at 4 B/t. Estimate **mean residency** under a **uniform-arrival**
assumption: a payload returned at turn *t* of an *N*-turn session is re-billed *(N − t)* times at
the 0.1× cache-read rate. For uniform arrival over *t* ∈ [1, *N*], mean *(N − t)* = (*N* − 1)/2 ≈ *N*/2.
For the median session (*N* = 213) this is **106 re-bills**, giving a tool-output multiplier of
**106 × 0.1 = 10.6** (vs 21.2 for always-on, which is resident from turn 1).

Per-session normalisation: §A2.6 chars are corpus-wide (247 sessions). Per-session tokens =
corpus-tokens / 247.

### A4.2 Direction of error (state plainly, per kickoff)

Three modelling choices, with **direction-of-error marked per choice**. A rework reviewer (cold
host-side re-computation) caught that the prior draft mis-stated factor 2 as a tool-output-only
downward bias — it is **ratio-neutral** for the always-on-vs-tool-output comparison (T3 firing at
review: the median choice understates BOTH classes equally, because both are linear in N).

1. **Uniform arrival** — reality is **front-loaded** (initial Bash/Read exploration dominates early
   turns). Front-loaded arrival → payloads sit resident **longer** → actual mean residency is
   **higher** than *N*/2. So uniform arrival is a **lower bound on tool-output specifically**. This
   is the dominant lower-bound driver; it does NOT affect the always-on side (resident from turn 1
   regardless of arrival position).
2. **Median session (*N* = 213)** — the corpus mean is **236.2** turns (right-skewed by long
   sessions). Using the median under-states the **absolute** cost of BOTH classes by ~10% (the
   always-on multiplier at the mean would be (236.2−1)×0.1 = 23.5, not 21.2; tool-output's residency
   would be (236.2−1)/2 × 0.1 = 11.76, not 10.6). **Ratio-neutral for the comparison**: both classes
   are linear in N, so the ratio is essentially fixed across session lengths. Verified arithmetically:
   at N=213 → 754,884 vs 415,351 (ratio 1.8176); at N=517 → 1,836,729 vs 1,010,947 (ratio 1.8168);
   at N=833 → 2,961,278 vs 1,630,054 (ratio 1.8167). The ratio moves < 0.05% across a 4× session-
   length range. A p90 analysis (517 turns) is therefore **not** a lever that moves the comparison.
3. **Per-session even distribution** — IF long sessions produce disproportionately more tool output
   (super-linear in N), dividing by 247 flattens that correlation and under-states mean per-session
   tool-output. This is a tool-output-specific downward bias, **conditional on the super-linearity
   hypothesis** (not measurable from §A2 — the §A2 aggregator reports corpus totals, not per-session
   output-vs-length).

Net: the A4.3 numbers are a **conservative lower bound on absolute tool-output cost** (factors 1 + 3
push that direction; factor 3 is conditional). **The ratio against always-on is ratio-invariant to
factor 2.** The levers that CAN move the ratio are: (i) arrival-position distribution (factor 1 —
front-loaded arrival raises tool-output's effective multiplier above the uniform N/2); (ii) per-tool
payload volume (changes to Bash/Read output truncation would shift the corpus-tokens column).
**Session length is NOT such a lever.**

### A4.3 Top-5 tool-output cost (median session, uniform arrival — LOWER BOUND)

| tool | corpus chars | corpus tokens (4 B/t) | per-session tokens (÷247) | × residency 10.6 | cost-units / session |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bash | 20,610,988 | 5,152,747 | 20,861 | 10.6 | 221,127 |
| Read | 14,631,039 | 3,657,760 | 14,809 | 10.6 | 156,975 |
| mcp\_\_claude-in-chrome\_\_computer | 1,665,599 | 416,400 | 1,686 | 10.6 | 17,872 |
| Agent | 1,152,020 | 288,005 | 1,166 | 10.6 | 12,360 |
| Edit | 653,724 | 163,431 | 662 | 10.6 | 7,017 |
| **top-5 total** | **38,713,370** | **9,678,343** | **39,184** | | **415,351** |

(All-tool total = 40,101,993 chars / 10,025,498 tokens / 40,589 per-session; at residency 10.6 →
**~430,243 cost-units/session**. Top-5 covers 96.5% of all tool-output tokens.)

### A4.4 The comparison

| class | cost-units / session (median) |
|---|---:|
| always-on total (11 rows, §A3) | 754,884 |
| always-on HEAD — top 7 (≥80%, §A3) | 651,343 |
| tool-output top 5 (lower bound, §A4.3) | 415,351 |
| tool-output ALL tools (lower bound) | ~430,243 |

**Verdict (numbers, not narrative).** Always-on documentation is the larger single class in the
median session: **754,884 vs ~430,243** (all tools, lower bound) — a ratio of **~1.75 : 1**. But
tool-output is **within the same order of magnitude**, and the tool-output number is a deliberate
lower bound: the uniform-arrival assumption understates tool-output residency specifically, while
the median-vs-mean session choice is **ratio-neutral** (§A4.2 factor 2 — both classes are linear in
N). Under realistic front-loaded arrival the two classes approach parity. **The two classes are
co-dominant**; a token-economy intervention that addresses only always-on documentation leaves **at
least ~35%** of the resident bill untouched (35.5% by top-5 tool-output, 36.3% by all-tool).

Cross-check on the headline ratio: tool-output / (always-on + top-5 tool-output) = 415,351 /
(754,884 + 415,351) = **35.5%** — matches §Headline.

**Falsifier.** The verdict ("co-dominant, always-on slightly larger; tool-output is a lower
bound") would be falsified in either direction. A rework reviewer (cold host-side re-computation)
caught that the prior draft mis-stated both the ratio's sensitivity to session length and the
dominance thresholds (T3 firing at review); the corrections are inlined below.

- **Session length is ratio-invariant — NOT a lever.** Both cost classes are linear in N: always-on
  = `31,187 × (N−1) × 0.1 + 440 × N`; tool-output = `39,184 × (N−1)/2 × 0.1`. Their ratio is therefore
  essentially fixed at ~1.82 across all N (verified at N=213/517/833 in §A4.2; moves < 0.05%). The
  prior draft's claim that a longer session amplifies tool-output relative to always-on is
  arithmetically false, as is the claim that always-on has no median-vs-mean downward bias (its 21.2
  multiplier is itself median-derived; at the 236.2 mean it would be 23.5 — the median understates
  BOTH sides, not one). A p90 analysis (517 turns, 51.6× always-on multiplier) shifts BOTH classes
  up by the same linear factor; the ratio moves < 0.05% and the verdict is unchanged.

- **The levers that CAN move the ratio** are: (i) **arrival-position distribution** — front-loaded
  arrival raises tool-output's effective multiplier above the uniform N/2; late-only arrival lowers
  it. (ii) **Per-tool payload volume** — changes to Bash/Read output truncation shift the
  corpus-tokens column. Both are tool-output-side levers; the always-on side is fixed by the row
  population.

- **Falsified → "always-on dominates decisively"** would require tool-output mean residency so low
  that its cost drops to a negligible share. At a 40-turn mean residency: `39,184 × 40 × 0.1 =
  156,736` cost-units, which is **20.8%** of always-on (not "<20%", and not "below ~150,000" — the
  prior draft's threshold figures were wrong). The corpus pattern (Bash-heavy exploration front-loads
  work) argues against such late-only arrival, but it is not measurable from §A2.

- **Falsified → "tool-output dominates"** would require tool-output mean residency ≥ the break-even
  point: `754,884 / (39,184 × 0.1) = 192.6 turns`. For a 213-turn median session that is **90.4%**
  of all turns — and the theoretical maximum from turn-1-only arrival is `N − 1 = 212`, so no
  realistic arrival distribution can produce a 192.6-turn mean. (At the prior draft's quoted
  160-turn mean residency: `39,184 × 160 × 0.1 = 626,944` vs always-on 754,884 — still **17%
  smaller**, i.e. not dominant. Dominance is effectively unreachable under this corpus.) The prior
  draft's "long sessions dominate the corpus" condition is ratio-invariant per the bullet above — it
  cannot discriminate between the two classes and is dropped.

- The current answer rests on the median session and uniform-arrival assumptions. The arrival-
  distribution data needed to tighten the residency assumption beyond the uniform lower bound is
  `INCONCLUSIVE — not in the inlined profile`; that data would settle the only ratio-moving lever
  reachable from §A2.

## A5 — W4: progressive-disclosure inventory (one line per artefact)

Inventory only — NOT a proposal (kickoff §3 descope; stage B and the distillation seat own proposals).

| # | artefact | split status | mechanism |
| --- | --- | --- | --- |
| 1 | `CLAUDE.md` | loaded whole | none (root AI-tooling doc; loaded whole by CC convention) |
| 2 | `00-rule-index.md` | **already split** (this file IS the hot pointer) | `00-rule-index.md` digest pattern — one-line-per-rule index (hot) → full rule bodies (cold, separate files) |
| 3 | `ai-laziness-traps.md` | loaded whole | none (declared `always-on core`; no split intended) |
| 4 | `build-first-reuse-default.md` | loaded whole | none (declared `always-on core`; no split intended) |
| 5 | `attention-is-not-a-mechanism.md` | loaded whole | none (declared `always-on core`; small enough at 657 tokens) |
| 6 | `cold-seat-economy.md` | **declared split, INEFFECTIVE** | `claudeMdExcludes` lists it, but it loads anyway (§A1.2 leak) |
| 7 | `autonomous-loop-continuity.md` | **declared split, INEFFECTIVE** | `claudeMdExcludes` lists it, but it loads anyway (§A1.2 leak) |
| 8 | `git-conflict-merge-forward.md` | **declared split, INEFFECTIVE** | `claudeMdExcludes` lists it, but it loads anyway; also carries a `claude-md` channel marker (still loads) |
| 9 | `~/.claude/CLAUDE.md` | loaded whole | none (operator-global; out of repo scope) |
| 10 | `MEMORY.md` index | **already split** (this file IS the hot pointer) | `MEMORY.md` digest pattern — one-line-per-memory index (hot) → per-memory files (cold) |
| 11 | session-bootstrap digest | **already split** (the digest IS the hot shard) | `inject-session-bootstrap.sh` digest injection — full `.claude/session-bootstrap.md` is cold; only the 1,760 B digest is injected per prompt |

**Summary:** 3/11 are already hot/cold-split by design (rows 2, 10, 11 — all digest/pointer
patterns). 3/11 have a **declared** split that silently does not enforce (rows 6, 7, 8 — the
`claudeMdExcludes` leak of §A1.2). 5/11 are loaded whole by design (rows 1, 3, 4, 5, 9). The
single largest disclosure opportunity by *effectiveness gap* is fixing the leak — rows 6-8 are
declared cold but pay always-on cost (8,799 est-tokens × 21.2 = 186,539 cost-units, 24.7% of the
always-on total), which is a **mechanism defect, not a documentation-design question**.

## A6 — T15 self-application (mandatory, kickoff §4)

This stage measures always-on context cost; its own output is a repo document. T15 requires it
state its own always-on cost and recommend for/against its own residency.

```text
$ wc -c docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md
36786 docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md
$ wc -l docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md
554 docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md
```

36,786 B → **9,197 est-tokens** (4 B/t). If loaded always-on, its median cost would be
9,197 × 21.2 = **194,976 cost-units/session** — larger than every always-on row in §A3, including
`ai-laziness-traps.md` (rank 1, 139,856). A single research artefact would leap to **rank 1** of the
always-on ranking — a self-inflicted ~26% increase in the always-on bill it exists to measure. The
rank-1 verdict is robust to the self-referential `wc` drift (any size ≥ 26,364 B = `139,856 / 21.2 × 4`
leaps to rank 1; this file is ~10,000 B past that threshold).
(This §A6 has been refreshed twice under rework: round 1 corrected a stale `wc` from before the
file's See-also section settled, promoting self-cost from previously-quoted rank 2 to rank 1 — T3
firing inside T15, caught at review. Round 2 (this revision) re-runs the `wc` after the §A4.2/§A4.4
falsifier rewrite + §A1.3 boundary note grew the file from 30,453 B to 36,414 B; this third refresh
absorbs the small drift introduced by the second refresh itself. The rank-1 verdict is unchanged.)
The drift floor (a `wc` quote that grows the file by single-digit bytes when refreshed) does not
move the verdict; the cost figure is approximate by the 4 B/t assumption anyway.

This patch is a **one-time research artefact** under `docs/meta-factory/research-patches/` — a
folder with folder-level authority (individual files scope-bound by gap, append-only; per
`doc-authority-hierarchy.md §2` + the folder `README.md`). It is **not** auto-loaded by CC's
session-start `.claude/rules/*.md` convention, **not** referenced by the always-on digest, and
**not** in any `paths:` frontmatter. Its design intent is **cite-by-reference** — a downstream
intervention (stage B / distillation seat) reads it once, extracts the recommendation, and the
patch is never loaded again. **Recommendation: do NOT load this patch always-on.** It should remain
cold. (The §A4 numbers show always-on cost is the problem; adding this patch to always-on would
materially worsen the very quantity it reports.)

## A7 — Observations for stage B (descoped one-liners, kickoff §3)

Recorded as one-liners per the descope; stage B owns evaluation.

- The `claudeMdExcludes` leak (§A1.2, §A5) is a **mechanism defect** — 24.7% of the always-on bill
  is content that is *declared* cold. Stage B should evaluate whether this is fixable in-settings
  or needs a different disclosure primitive.
- Bash + Read tool output = 87.9% of all tool-result volume (§A2.6). The lever for the tool-output
  class is **output truncation / summarisation at return time**, not arrival reduction. Candidate
  evaluation is stage B.
- Row 11 (session-bootstrap digest, per-prompt) is small per-injection (440 tokens) but pays the
  per-prompt multiplicity — a caching analysis (does the digest enter the prompt cache, or is it
  billed fresh each turn?) is `INCONCLUSIVE — not in the inlined profile`; stage B may investigate.
- The edit-time-injection class (§A1.3, 53,795 est-tokens gated behind path-match) has no
  per-session firing-rate data in §A2; a real cost ranking of this class requires host-side
  path-match instrumentation — stage B candidate.

## A8 — Coverage

**Measured:** 8/11 always-on rows repo-side via `wc -c` (rows 1-8; all match the inlined table —
no delta). 3/11 host-only sizes cited verbatim from §A2.8 (rows 9-11 — paths unreachable in
container). Edit-time-injection class: **fully enumerated under the narrow definition** (index's
`edit-time inject` rows = the `inject-matching-rule.sh` set) — 15/15 rules, each with `wc -c` size +
`paths:` firing condition. The wider "any `paths:`-bearing rule" population is a different class
(CC-native read-time, not edit-time inject); one such rule (`phase-research-coverage.md`, 34,151 B)
is recorded as a boundary note in §A1.3 and is **outside** the 15/15 set by design.
`claudeMdExcludes` list: read in-container (7/7 entries).

**Cited, NOT re-measured (transcripts unreachable):** the entire §A2 billing profile (raw token
volume, weighted spend, turn-count distribution, per-model split, tool-call frequency, tool-result
payload volume) — 247 transcripts / 58,345 turns, host-measured 2026-08-01. A green container run
proves nothing about the host (`destination-environment-verification.md §3`).

**Unreached / INCONCLUSIVE:** per-turn positioning of tool output (needed to tighten the §A4
residency assumption beyond the uniform-arrival lower bound); per-session path-match firing rates
for the edit-time-injection class (needed to cost that class per-session); whether the row-11
digest enters the prompt cache. All three require host-side instrumentation not available here.

**Reproducibility:** the §A2 aggregator script is inlined in the dispatch kickoff §2.7 for the
host-side reviewer. Re-runs drift ~0.1-0.2% upward as the live corpus grows — expected, not a defect.

## See also

- Dispatch kickoff `token-economy-research-s-a` (§A2 source, binding filename + scope-comment,
  §3a park-don't-guess, §4 active traps, §5 host-verify contract).
- [`token-economy-research-s-b/kickoff.md`](../../../.claude/orchestrator-prompts/token-economy-research-s-b/kickoff.md) — parallel
  candidate-survey stage sharing the same §A2 profile.
- [`docs/superpowers/specs/2026-08-01-token-economy-research-design.md`](../../superpowers/specs/2026-08-01-token-economy-research-design.md)
  — **parent design** (Task A = this patch; Task B = stage S-B).
- [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
  — umbrella owner this patch feeds. **Scope-distinction (do not misread as supersession):** its
  S1 measured the *script-derived repo-owned always-on set* at ~29,589 tokens (aif-container) /
  ~39,021 (host-cc); §A1/§A3 here is a *different measurement scope* — the host-measured
  live-session always-on population (11 rows), which excludes the harness remainder (tool schemas,
  MCP instructions, skills listings) that dominates the S1 <40% verdict.
- [`docs/superpowers/specs/2026-07-23-acceptance-contour-design.md`](../../superpowers/specs/2026-07-23-acceptance-contour-design.md)
  — the acceptance contour (fidelity gate spec; not the funnel — the funnel design is the
  `token-economy-research-design.md` entry above).
- [`.claude/rules/cold-seat-economy.md`](../../../.claude/rules/cold-seat-economy.md) — already-measured
  seat-economy discipline (the §A3 table is independent; do not re-derive cold-seat numbers from it).
- [`destination-environment-verification.md`](../../../.claude/rules/destination-environment-verification.md)
  — why §A2 is cited, not re-measured.
