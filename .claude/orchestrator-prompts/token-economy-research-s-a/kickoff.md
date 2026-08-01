<!-- scope: stage A of the token-economy research — always-on context attribution against a measured billing profile. Self-contained: the host-side measurement is INLINED in §2 because `~/.claude/projects/` does not exist in the aif container (see §0). Authored 2026-08-01 by the operator-facing session that ran the host-side measurement. -->
<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

# token-economy-research-s-a — what does the always-on context actually cost?

> **Stage goal:** attribute this repository's **always-on context payload** to concrete artefacts,
> and rank those artefacts by **measured cost**, using the billing profile inlined in §2 (already
> measured on the host — do NOT re-measure, you cannot).
> **Output kind:** a research-patch under `docs/meta-factory/research-patches/`. **Zero build** —
> no rule, no hook, no skill, no eviction is implemented here under any outcome. Proposals only.
> **Consumer of this output:** an Opus distillation seat merges this stage with stage B into the
> single patch the operator reads. Write for that consumer — raw, complete, ranked; not polished
> prose.
> **Governing rules (read first):**
> [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) (traps below),
> [`.claude/rules/phase-research-coverage.md §1`](../../rules/phase-research-coverage.md),
> [`.claude/rules/destination-environment-verification.md §3`](../../rules/destination-environment-verification.md).

## §0 Dispatch facts (binding)

- **Tier 1, `bridge-profile` marker present** (header above): the «how» is one determinable
  sentence — enumerate the always-on payload, measure it, multiply by the residency factor in §2.
  No design judgment is required; the judgment was spent authoring this kickoff
  ([CLAUDE.md `Task-tier routing`](../../../CLAUDE.md)).
- **Staging placement.** This kickoff must be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **THE MEASUREMENT SOURCE IS NOT REACHABLE FROM WHERE YOU RUN.** The billing profile comes from
  247 Claude Code transcripts under `~/.claude/projects/*rules-as-tests-aif*/`. **That path does
  not exist in the aif container.** §2 inlines the complete result. You MUST work from §2. Any
  claim about session-level token behaviour that is not in §2 must be recorded
  `INCONCLUSIVE — not in the inlined profile`, never inferred
  ([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).
- **What IS reachable from the container:** this repository's working tree. Everything in §1 is
  repo-side measurement — files you can `wc -c`, `git show`, and read. That is the whole job.
- **Ownership.** This stage writes ONE research-patch. It writes **no** rule, **no** hook, **no**
  skill, and does **not** edit `README.md`, `CLAUDE.md`, `.claude/rules/**`, `.claude/settings.json`,
  `.husky/**` ([CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md)).
- **Ceilings.** A pre-commit hook blocks any markdown file past **600 lines** — run `wc -l` before
  adding.

## §1 Work items

### W1 — enumerate the always-on payload from source, not from recall

Enumerate every artefact that enters a session's context **without the model asking for it**, and
measure each one. From the tree, with a command + output for each (no prose-only entries — T3):

1. **`CLAUDE.md`** at repo root — the project instruction file, loaded in full every session.
2. **`.claude/rules/00-rule-index.md`** — the always-on rule digest.
3. **Every rule file whose delivery channel is `always-on core`** — read the `Channel(s)` column of
   `00-rule-index.md` and resolve each. Note that `.claude/settings.json` carries a
   `claudeMdExcludes` key that EVICTS some rules from the always-on load; resolve the real
   always-on set against that key, not against the index alone (`jq '.claudeMdExcludes'`).
   **A rule listed always-on in the index but excluded in settings is NOT always-on — report the
   discrepancy if you find one.**
4. **`.claude/session-bootstrap.md`** and the digest that `.claude/hooks/inject-session-bootstrap.sh`
   injects — note this one is injected **per prompt**, not once per session. Measure the injected
   digest, and state its per-prompt multiplicity explicitly.
5. **`MEMORY.md`** — the memory index at
   `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/MEMORY.md`. **NOT reachable from
   the container** — its measured size is given in §2; use that number, do not attempt to read it.
6. **Edit-time rule injections** — rules delivered via `<!-- inject: -->` / `paths:` frontmatter
   (`.claude/hooks/inject-matching-rule.sh`). These are NOT always-on but ARE resident once fired;
   measure them as a separate class and say so.

For each artefact report: **bytes, estimated tokens, and the channel that loads it.** State your
bytes→tokens conversion factor and how you derived it; do not silently assume one.

### W2 — apply the residency multiplier and rank

§2 establishes that a token resident from turn 1 costs **21.2×** a one-shot input token in a median
session and **51.6×** at p90. For every artefact from W1, compute:

```text
cost_units_median = tokens × 21.2
cost_units_p90    = tokens × 51.6
```

Produce ONE ranked table, most expensive first, with a running cumulative share so the head/tail
boundary is visible. **Report where the head ends** — the smallest set of artefacts accounting for
≥80% of always-on cost.

### W3 — the tool-output class, measured the same way

§2 section D gives per-tool payload volume returned INTO context across the corpus. Tool output is
**not** always-on, but once returned it is resident for the remainder of the session and re-billed
every subsequent turn. For the top 5 tools by total chars:

1. Convert chars → tokens with your stated factor.
2. Estimate the **mean residency** — a payload returned at turn *t* of an *N*-turn session is
   re-billed *(N − t)* times. You do not have per-turn positions; state the assumption you use
   (e.g. uniform arrival) **and its direction of error**, then compute.
3. Compare the resulting cost class against the W2 always-on head.

**This comparison is the stage's central deliverable**: does always-on documentation or tool-output
accumulation dominate? Answer with numbers, and state what would falsify the answer.

### W4 — what is NOT progressively disclosed

For each W1 artefact, one line: is it already hot/cold split (a small always-on pointer + an
on-demand body), or is it loaded whole? Name the mechanism where one exists
(`claudeMdExcludes`, the `00-rule-index.md` digest pattern, skill `references/` split). This is an
inventory, **not** a proposal — proposals are stage B's and the distillation seat's job.

## §2 The measured billing profile (INLINED — this is your only source for session behaviour)

Measured 2026-08-01 on the host over **247 transcripts** across **99 project directories** under
`~/.claude/projects/*rules-as-tests-aif*/`, reading per-turn billing accounting
(`message.usage`) and tool metadata only — never message content.

### 2.1 Raw token volume by billing category — 58,341 assistant turns

| category | raw tokens | share of raw |
| --- | ---: | ---: |
| uncached input | 17,379,399 | 0% |
| cache WRITE | 844,259,721 | 4% |
| cache READ | 17,501,147,752 | 94% |
| output | 91,526,585 | 0% |
| **total raw** | **18,454,313,457** | |

### 2.2 The same, weighted by price multiplier — THE HEADLINE RESULT

Multipliers are Anthropic's published prompt-caching multipliers relative to base input price
(cache write 1.25×, cache read 0.1×) and the output/input price ratio (5×, which holds across the
Opus and Sonnet families). **Verify these multipliers against current published pricing and record
the check** — if they have changed, recompute the table and say so.

| category | raw tokens | multiplier | weighted units | cost share |
| --- | ---: | ---: | ---: | ---: |
| cache READ | 17,501,147,752 | 0.1× | 1,750,114,775 | **53.3%** |
| cache WRITE | 844,259,721 | 1.25× | 1,055,324,651 | **32.2%** |
| output | 91,526,585 | 5× | 457,632,925 | 14.0% |
| uncached input | 17,379,399 | 1× | 17,379,399 | 0.5% |
| **TOTAL** | | | **3,280,451,750** | 100% |

**Read this carefully — it is the finding the whole stage rests on.** 85.5% of spend is context
*re-submission* (cache read + cache write), not generation. Output is 14%. Uncached input is
negligible, so caching is working; the cost is that **the cached context is large and is paid for
on every single turn**.

### 2.3 Turn-count distribution — the residency multiplier

| statistic | turns |
| --- | ---: |
| sessions | 247 |
| median turns | 213 |
| p90 turns | 517 |
| max turns | 833 |
| total turns | 58,345 |

Derived, and used by W2:

- median session — a token resident from turn 1 is re-billed 212 times at 0.1× = **21.2×** the cost
  of a one-shot input token
- p90 session — **51.6×**
- max session — **83.2×**

### 2.4 Per-model split

| model | turns | raw tokens |
| --- | ---: | ---: |
| claude-opus-4-8 | 29,878 | 10,128,170,357 |
| claude-fable-5 | 17,012 | 4,580,732,963 |
| claude-opus-5 | 6,968 | 2,513,431,331 |
| claude-sonnet-5 | 4,136 | 1,208,617,260 |
| claude-sonnet-4-6 | 184 | 21,217,372 |
| claude-haiku-4-5 | 14 | 2,144,174 |

The expensive tiers (Opus + Fable) carry **53,858 of 58,341 turns (92%)**. This is why the research
targets them.

### 2.5 Tool-call frequency — what drives turn count

| tool | calls |
| --- | ---: |
| Bash | 16,767 |
| Edit | 2,921 |
| Read | 1,825 |
| Write | 764 |
| Agent | 548 |
| TaskUpdate | 513 |
| TaskCreate | 309 |
| AskUserQuestion | 240 |
| Skill | 177 |
| ToolSearch | 154 |

(49 tools total; the tail below 113 calls is omitted as immaterial — that omission is stated, not
silent.)

### 2.6 Tool-result payload returned INTO context — top 10 by volume

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

**Bash and Read together are 96% of all tool-result volume.**

### 2.7 Reproduction command (K2 — the profile must reproduce)

The aggregator is inlined here so the numbers above are reproducible on the host. It reads billing
metadata and tool names/sizes only — never message content. **You cannot run this in the
container** (the path does not exist); it is recorded for the host-side reviewer.

```bash
find ~/.claude/projects -maxdepth 2 -path "*rules-as-tests-aif*" -name "*.jsonl" \
| xargs jq -c 'select(.type=="assistant" and .message.usage) | {
    i:.message.usage.input_tokens,
    cw:.message.usage.cache_creation_input_tokens,
    cr:.message.usage.cache_read_input_tokens,
    o:.message.usage.output_tokens }' \
| jq -s '{turns: length, input: (map(.i)|add), cache_write: (map(.cw)|add),
          cache_read: (map(.cr)|add), output: (map(.o)|add)}'
```

### 2.8 Host-only sizes you cannot measure yourself

- `MEMORY.md` (memory index, loaded every session): **7,738 bytes**.

## §3 Descopes (binding — do not do these)

- **No implementation.** No rule, hook, skill, settings edit, or eviction. Proposals only.
- **No candidate evaluation.** RTK, progressive-disclosure tooling, and every other external
  candidate belong to stage B. If you have an opinion about a tool, record it as one line under
  «observations for stage B» and move on.
- **No re-measurement of session behaviour.** §2 is the source; the transcripts are unreachable.
- **No shipped-axis analysis.** Consumer token economy is explicitly out of scope for this
  umbrella.
- **No new umbrella, no extra PR.** One PR, one research-patch
  ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

## §4 Active AI-laziness traps

Per [`ai-laziness-traps.md §3`](../../rules/ai-laziness-traps.md) this kickoff enumerates its
active traps rather than blanket-referencing the catalogue.

**Active: T1, T3, T6, T10, T14, T15, T20.**

- **T1 / T10** — W1 requires *enumerating the population first* (every always-on artefact), then
  measuring. «I looked at CLAUDE.md and the rule index, they're the big ones» is the exact failure.
- **T3** — every artefact size is a command + output. No prose-only sizes.
- **T6** — no bare «Confidence: high». State coverage as a fraction of the enumerated population.
- **T14** — if coverage is low, the finding is «coverage insufficient to rank», not «the head is X».
- **T15** — self-application: this stage measures always-on context cost; its own research-patch
  becomes a repo document. State in the patch what your own output would cost if it were ever
  loaded always-on, and whether it should be.
- **T20** — no verdict without evidence. Every «X is expensive» carries the number.

**Domain-specific trap — T-TokenA-A:** *«the biggest file is the biggest cost»*. Cost is
`tokens × residency`, and residency differs per channel — the per-prompt bootstrap injection has a
multiplicity that a once-per-session file does not, and an edit-time injection that never fires
costs zero. Ranking by file size instead of by cost-units is this stage's specific way of being
wrong, and it will look like a completed job.

## §5 Host-verify contract

The container is not the destination — the patch lands on the host
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
Run these on the HOST before accepting this stage; a green container run is not evidence.

```bash host-verify
npx markdownlint-cli2 "docs/meta-factory/research-patches/*token-economy*.md"
wc -l docs/meta-factory/research-patches/*token-economy*.md
npx tsx --test packages/core/principles/10-research-patch-annotation.test.ts 2>/dev/null || npx vitest run packages/core/principles/10-research-patch-annotation.test.ts
```

## §6 Acceptance

The stage is done when the research-patch contains:

1. The enumerated always-on population with per-artefact bytes/tokens and loading channel (W1).
2. The ranked cost table with cumulative share and a named head/tail boundary (W2).
3. The tool-output cost class computed with its stated assumption and error direction, compared
   against the always-on head, with a falsifier (W3).
4. The progressive-disclosure inventory (W4).
5. A `Coverage:` line stating what fraction of the enumerated population was measured, and naming
   anything unreached.
