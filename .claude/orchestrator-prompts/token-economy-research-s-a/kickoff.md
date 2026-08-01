<!-- scope: stage A of the token-economy research — always-on context attribution against a measured billing profile. Self-contained: the host-side measurement is INLINED in §2 because `~/.claude/projects/` does not exist in the aif container (see §0). Authored 2026-08-01; revised same day after a STOP verdict from the dispatch-input station (round 2) — MEMORY.md size corrected, §2 rebuilt from one canonical aggregator run, always-on population inlined host-measured. -->
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
  sentence — attribute the inlined always-on payload, apply the residency factor, rank. No design
  judgment is required; the judgment was spent authoring this kickoff
  ([CLAUDE.md `Task-tier routing`](../../../CLAUDE.md)).
- **Staging placement.** This kickoff must be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **THE MEASUREMENT SOURCE IS NOT REACHABLE FROM WHERE YOU RUN.** The billing profile comes from
  247 Claude Code transcripts under `~/.claude/projects/*rules-as-tests-aif*/`. **That path does
  not exist in the aif container.** §2 inlines the complete result. You MUST work from §2.
  A green run in your container proves nothing about the host
  ([destination-environment-verification.md §3](../../rules/destination-environment-verification.md));
  accordingly, **this kickoff's binding grammar**: any claim about session-level token behaviour
  that is not in §2 is recorded `INCONCLUSIVE — not in the inlined profile`, never inferred.
- **What IS reachable from the container:** this repository's working tree. Everything in §1 is
  repo-side work — files you can `wc -c`, `git show`, and read.
- **Ownership.** This stage writes ONE research-patch. It writes **no** rule, **no** hook, **no**
  skill, and does **not** edit `README.md`, `CLAUDE.md`, `.claude/rules/**`, `.claude/settings.json`,
  `.husky/**` ([CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md)).
- **Deliverable filename (binding):** the research-patch MUST be
  `docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md` — the §5
  host-verify globs match on `token-economy-s-a`, and a differently-named file silently escapes
  them (`#silent-contract-skip`). Its **first line** MUST be an HTML scope comment
  (`<!-- scope: ... -->`) — [`10-research-patch-annotation.test.ts`](../../../packages/core/principles/10-research-patch-annotation.test.ts)
  fails the PR otherwise.
- **Ceilings.** A pre-commit hook blocks any markdown file past **600 lines** — run `wc -l` before
  adding.

## §1 Work items

### W1 — attribute the always-on payload (population INLINED — do not re-derive it)

The always-on population below was **measured on the host from a live session's actual injected
context** (2026-08-01), because the rule index's `Channel(s)` column and `claudeMdExcludes` in
`.claude/settings.json` **both disagree with observed reality** — see the pre-found discrepancy
after the table. Work from this table; verify the repo-side byte sizes yourself (`wc -c` — they
are in your tree); the two host-only rows are marked.

| # | artefact | bytes | loading channel |
| --- | --- | ---: | --- |
| 1 | `CLAUDE.md` | 23,740 | whole file, every session |
| 2 | `.claude/rules/00-rule-index.md` | 4,030 | whole file, every session |
| 3 | `.claude/rules/ai-laziness-traps.md` | 26,387 | always-on (index: always-on core) |
| 4 | `.claude/rules/build-first-reuse-default.md` | 12,667 | always-on (index: always-on core) |
| 5 | `.claude/rules/attention-is-not-a-mechanism.md` | 2,629 | always-on (index: always-on core) |
| 6 | `.claude/rules/cold-seat-economy.md` | 12,453 | **loaded despite claudeMdExcludes** |
| 7 | `.claude/rules/autonomous-loop-continuity.md` | 13,459 | **loaded despite claudeMdExcludes** |
| 8 | `.claude/rules/git-conflict-merge-forward.md` | 9,285 | **loaded despite claudeMdExcludes** |
| 9 | `~/.claude/CLAUDE.md` (operator-global) | 3,593 | HOST-ONLY size, every session |
| 10 | memory `MEMORY.md` index | 16,504 | HOST-ONLY size, every session |
| 11 | session-bootstrap digest (`inject-session-bootstrap.sh`) | 1,760 | **injected EVERY PROMPT**, not once per session |

**Pre-found discrepancy (carry it into the patch as a finding — do not re-litigate, do not
hide):** `.claude/settings.json` `claudeMdExcludes` lists 7 rules; in the observed live session
only 4 of them were actually evicted (`egress-no-api-bypass`, `memory-codification`,
`recommendation-laziness-discipline`, `reviewer-discipline`) while 3 loaded anyway (rows 6-8,
35,197 bytes combined). Separately, the `00-rule-index.md` `Channel(s)` column marks only 3 rules
always-on, under-reporting the observed set. Your job is to carry this as a measured finding with
a proposed root-cause investigation as a next-stage candidate — NOT to fix the mechanism.

Also measure as a separate class (resident-once-fired, not always-on): rules delivered by
edit-time injection via `paths:` frontmatter (`.claude/hooks/inject-matching-rule.sh`) — enumerate
them from the index's `edit-time inject` channel rows and state their sizes and firing condition.

**Bytes→tokens conversion (binding):** assume **4 bytes ≈ 1 token** and label every converted
number «est., 4 B/t assumed». No tokenizer is available in your environment; a derived-sounding
factor would be fabrication (T3). State the assumption once, apply it uniformly.

### W2 — apply the residency multiplier and rank

§2.3 establishes that a token resident from turn 1 costs **21.2×** a one-shot input token in a
median session and **51.6×** at p90. For every artefact from W1, compute:

```text
cost_units_median = tokens × 21.2         (rows 1-10)
cost_units_median = tokens × 213 × 1.0    (row 11 — re-injected fresh every prompt, not cached
                                           from turn 1; state this asymmetry explicitly)
```

Produce ONE ranked table, most expensive first, with a running cumulative share so the head/tail
boundary is visible. **Report where the head ends** — the smallest set of artefacts accounting for
≥80% of always-on cost.

### W3 — the tool-output class, measured the same way

§2.6 gives per-tool payload volume returned INTO context across the corpus. Tool output is
**not** always-on, but once returned it is resident for the remainder of the session and re-billed
every subsequent turn. For the top 5 tools by total chars:

1. Convert chars → tokens with the stated 4 B/t assumption.
2. Estimate the **mean residency** — a payload returned at turn *t* of an *N*-turn session is
   re-billed *(N − t)* times. You do not have per-turn positions; state the assumption you use
   (e.g. uniform arrival → mean residency ≈ N/2) **and its direction of error**, then compute.
3. Compare the resulting cost class against the W2 always-on head.

**This comparison is the stage's central deliverable**: does always-on documentation or tool-output
accumulation dominate? Treat it as an OPEN question — §2 deliberately ranks nothing; answer with
numbers, and state what would falsify the answer.

### W4 — what is NOT progressively disclosed

For each W1 artefact, one line: is it already hot/cold split (a small always-on pointer + an
on-demand body), or is it loaded whole? Name the mechanism where one exists
(`claudeMdExcludes`, the `00-rule-index.md` digest pattern, skill `references/` split). This is an
inventory, **not** a proposal — proposals are stage B's and the distillation seat's job.

## §2 The measured billing profile (INLINED — this is your only source for session behaviour)

Measured 2026-08-01 on the host over **247 transcripts** across **99 project directories** under
`~/.claude/projects/*rules-as-tests-aif*/`, reading per-turn billing accounting
(`message.usage`) and tool metadata only — never message content. All tables below come from
**one aggregator run** (2026-08-01T01:00:50Z; script inlined in §2.7) — earlier drafts mixed two
runs minutes apart and their totals disagreed by ~0.1%; this revision is single-sourced and
cross-foots exactly.

### 2.1 Raw token volume by billing category — 58,345 assistant turns

| category | raw tokens | share of raw |
| --- | ---: | ---: |
| uncached input | 17,379,404 | 0% |
| cache WRITE | 844,266,278 | 4% |
| cache READ | 17,501,892,975 | 94% |
| output | 91,530,961 | 0% |
| **total raw** | **18,455,069,618** | |

### 2.2 The same, weighted by price multiplier — THE HEADLINE RESULT

Multipliers: Anthropic's published prompt-caching multipliers relative to base input price
(cache write 1.25×, cache read 0.1×) and the output/input price ratio (5×, which holds across the
Opus, Sonnet, Fable and Haiku families). Verified against live published pricing 2026-08-01 by the
dispatch-input station (round 1, both seats independently) — treat as verified; re-verify only if
your container has network access, and if it does not, proceed (do NOT record this as
INCONCLUSIVE — it is a host-verified input, not a claim you must re-earn).

| category | raw tokens | multiplier | weighted units | cost share |
| --- | ---: | ---: | ---: | ---: |
| cache READ | 17,501,892,975 | 0.1× | 1,750,189,298 | **53.3%** |
| cache WRITE | 844,266,278 | 1.25× | 1,055,332,848 | **32.2%** |
| output | 91,530,961 | 5× | 457,654,805 | 14.0% |
| uncached input | 17,379,404 | 1× | 17,379,404 | 0.5% |
| **TOTAL** | | | **3,280,556,354** | 100% |

**85.5% of spend is context *re-submission* (cache read + cache write), not generation.** Output
is 14%. Uncached input is negligible, so caching is working; the cost is that the cached context
is large and is paid for on every single turn. (This characterises the SPEND SHAPE only — whether
the resident payload is dominated by always-on documentation or by accumulated tool output is
exactly W3's open question, not answered here.)

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
| claude-opus-5 | 6,972 | 2,514,187,492 |
| claude-sonnet-5 | 4,136 | 1,208,617,260 |
| claude-sonnet-4-6 | 184 | 21,217,372 |
| claude-haiku-4-5 | 14 | 2,144,174 |
| `<synthetic>` (harness-internal, zero-token) | 149 | 0 |

Rows sum to 58,345 turns and 18,455,069,618 raw tokens — exactly the §2.1 totals. The expensive
tiers (Opus 4.8 + Opus 5 + Fable) carry **53,862 of 58,345 turns (92%)**. This is why the research
targets them.

### 2.5 Tool-call frequency — what drives turn count

| tool | calls |
| --- | ---: |
| Bash | 16,768 |
| Edit | 2,922 |
| Read | 1,825 |
| Write | 764 |
| Agent | 548 |
| TaskUpdate | 513 |
| TaskCreate | 309 |
| AskUserQuestion | 240 |
| Skill | 177 |
| ToolSearch | 154 |

(52 tools total; the tail below 154 calls is omitted as immaterial — that omission is stated, not
silent.)

### 2.6 Tool-result payload returned INTO context — top 10 by volume

Total across all 52 tools: **40,101,993 chars**.

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

**Bash and Read together are 35,242,027 of 40,101,993 chars — 87.9% of all tool-result volume.**
(Results may be ≤ calls for a tool: a call whose result never landed — session cut mid-turn — has
no payload row.)

### 2.7 Reproduction — the full aggregator (K2: the profile must reproduce)

The complete script producing every table above is inlined so the numbers are reproducible on the
host. It reads billing metadata and tool names/sizes only — never message content. **You cannot
run this in the container** (the path does not exist); it is recorded for the host-side reviewer.
Live corpus growth means a later re-run drifts ~0.1-0.2% upward from the figures above; that drift
is expected, not a defect.

```bash
FILES=$(find ~/.claude/projects -maxdepth 2 -path "*rules-as-tests-aif*" -name "*.jsonl")
# §2.1/§2.2 — billing categories
printf '%s\n' "$FILES" | xargs jq -c 'select(.type=="assistant" and .message.usage) | {i:.message.usage.input_tokens, cw:.message.usage.cache_creation_input_tokens, cr:.message.usage.cache_read_input_tokens, o:.message.usage.output_tokens}' \
| jq -s '{turns: length, input:(map(.i)|add), cache_write:(map(.cw)|add), cache_read:(map(.cr)|add), output:(map(.o)|add)}'
# §2.4 — per-model split
printf '%s\n' "$FILES" | xargs jq -c 'select(.type=="assistant" and .message.usage) | {m:(.message.model//"unknown"), t:(.message.usage.input_tokens+.message.usage.cache_creation_input_tokens+.message.usage.cache_read_input_tokens+.message.usage.output_tokens)}' \
| jq -s 'group_by(.m) | map({model:.[0].m, turns:length, raw:(map(.t)|add)}) | sort_by(-.raw)'
# §2.5 — tool-call frequency
printf '%s\n' "$FILES" | xargs jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | .name' | sort | uniq -c | sort -rn
# §2.6 — tool-result payload volume (two-pass id→name join)
printf '%s\n' "$FILES" | xargs jq -c 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | {id:.id, name:.name}' | jq -s 'INDEX(.id)' > /tmp/_names.json
printf '%s\n' "$FILES" | xargs jq -c 'select(.type=="user") | .message.content[]? | select(.type=="tool_result") | {id:.tool_use_id, len:(.content|tostring|length)}' \
| jq -s --slurpfile n /tmp/_names.json 'map(. + {name:($n[0][.id].name // "unknown")}) | group_by(.name) | map({name:.[0].name, results:length, chars:(map(.len)|add), max:(map(.len)|max)}) | sort_by(-.chars)'
# §2.3 — per-session turn counts
printf '%s\n' "$FILES" | while read -r f; do jq -s '[.[] | select(.type=="assistant" and .message.usage)] | length' "$f"; done | sort -n
```

### 2.8 Host-only sizes you cannot measure yourself

- memory `MEMORY.md` index: **16,504 bytes** (`wc -c`, 2026-08-01; round-1 station caught the
  draft's unmeasured «7,738» — this figure is the station-verified correction).
- operator-global `~/.claude/CLAUDE.md`: **3,593 bytes**.
- session-bootstrap digest as actually injected per prompt: **1,760 bytes** (measured by running
  `inject-session-bootstrap.sh` on the host).

## §3 Descopes (binding — do not do these)

- **No implementation.** No rule, hook, skill, settings edit, or eviction. Proposals only.
- **No candidate evaluation.** RTK, progressive-disclosure tooling, and every other external
  candidate belong to stage B. If you have an opinion about a tool, record it as one line under
  «observations for stage B» and move on.
- **No re-measurement of session behaviour.** §2 is the source; the transcripts are unreachable.
  (Repo-side `wc -c` of W1 rows is required, not re-measurement.)
- **No shipped-axis analysis.** Consumer token economy is explicitly out of scope for this
  umbrella.
- **No new umbrella, no extra PR.** One PR, one research-patch
  ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

## §3a Park-don't-guess contract (non-negotiable)

On ANY genuine fork or ambiguity — two defensible readings, a §2 number that appears to contradict
another, a missing detail that changes the ranking — do **NOT** pick silently. Park it: set the
task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
consequence X / Option B → consequence Y», and stop. Proceed only on the unambiguous parts.
Specifically anticipated here: if any W1 byte size you re-measure in the tree differs from the
inlined table (the tree moves), record BOTH numbers and continue with yours, stating the delta —
that is not a park-worthy fork. A §2 internal contradiction IS one: never reconcile it by guessing.
Never manufacture a quoted command output for anything outside your environment.

## §4 Active AI-laziness traps

Per [`ai-laziness-traps.md §3`](../../rules/ai-laziness-traps.md) this kickoff enumerates its
active traps rather than blanket-referencing the catalogue.

**Active: T1, T3, T6, T10, T14, T15, T20.**

- **T1 / T10** — W1's population is inlined, but the edit-time-injection class (last W1 paragraph)
  must be enumerated from the index, all rows — not the first three that look big.
- **T3** — every repo-side size is a command + output. No prose-only sizes.
- **T6** — no bare «Confidence: high». State coverage as a fraction of the enumerated population.
- **T14** — if coverage is low, the finding is «coverage insufficient to rank», not «the head is X».
- **T15** — self-application: this stage measures always-on context cost; its own research-patch
  becomes a repo document. State in the patch what your own output would cost if it were ever
  loaded always-on, and whether it should be.
- **T20** — no verdict without evidence. Every «X is expensive» carries the number.

**Domain-specific trap — T-TokenA-A:** *«the biggest file is the biggest cost»*. Cost is
`tokens × residency`, and residency differs per channel — the per-prompt bootstrap injection
(row 11) has a multiplicity that a once-per-session file does not, and an edit-time injection that
never fires costs zero. Ranking by file size instead of by cost-units is this stage's specific way
of being wrong, and it will look like a completed job.

## §5 Host-verify contract

The container is not the destination — the patch lands on the host
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
Run on the HOST via `bash scripts/host-verify.sh token-economy-research-s-a` before accepting;
a green container run is not evidence. The `test -f` guard exists because `markdownlint-cli2`
exits 0 on a zero-match glob — without the guard a misnamed deliverable passes silently.

```bash host-verify
test -f docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md
npx markdownlint-cli2 "docs/meta-factory/research-patches/*token-economy-s-a*.md"
wc -l docs/meta-factory/research-patches/*token-economy-s-a*.md
npx vitest run packages/core/principles/10-research-patch-annotation.test.ts
```

## §6 Acceptance

The stage is done when the research-patch (filename + first-line scope comment per §0) contains:

1. The always-on attribution with per-artefact bytes/est-tokens and loading channel, including the
   carried claudeMdExcludes discrepancy finding and the edit-time-injection class (W1).
2. The ranked cost table with cumulative share and a named head/tail boundary, with row 11's
   per-prompt multiplicity handled per the W2 formula (W2).
3. The tool-output cost class computed with its stated assumption and error direction, compared
   against the always-on head, with a falsifier (W3).
4. The progressive-disclosure inventory (W4).
5. A `Coverage:` line stating what fraction of the enumerated population was measured, and naming
   anything unreached.
6. This stage's PR carries the standard `## §1.7 Self-discipline check` sections (forward +
   backward) — the PR template stubs them; the CI `discipline-self-check` gate rejects placeholders.

## See also

- [`token-economy-research-s-b/kickoff.md`](../token-economy-research-s-b/kickoff.md) — the
  parallel candidate-survey stage sharing this §2 profile.
- [`docs/superpowers/specs/2026-08-01-token-economy-research-design.md`](../../../docs/superpowers/specs/2026-08-01-token-economy-research-design.md)
  — the funnel design (GLM gather → Opus distill → Fable decide) this stage implements.
- [`.claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md)
  — the umbrella owning dispatch/seat economy; this research feeds its next stages.
- [`.claude/rules/cold-seat-economy.md`](../../rules/cold-seat-economy.md) — the already-measured
  seat-economy discipline (do not re-derive its table).
