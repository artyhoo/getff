<!-- scope: stage B of the token-economy research — BFR-disciplined survey of token/context-economy candidates against a measured cost profile. Runs in parallel with stage A; the profile both stages share is INLINED in §2. Authored 2026-08-01 by the operator-facing session that ran the host-side measurement. -->
<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

# token-economy-research-s-b — what could actually reduce the measured cost?

> **Stage goal:** a **BFR-disciplined survey** of candidate mechanisms for reducing token/context
> spend on the expensive model tiers, each candidate evaluated against the **measured** cost
> profile in §2 — never against an intuition about where tokens go.
> **Output kind:** a research-patch under `docs/meta-factory/research-patches/` plus any SSOT rows
> the survey earns. **Zero build** — no tool is installed, wired, or adopted here under any
> outcome.
> **Consumer of this output:** an Opus distillation seat merges this stage with stage A into the
> single patch the operator reads. Write raw and complete, not polished.
> **Governing rules (read first, in full):**
> [`.claude/rules/build-first-reuse-default.md`](../../rules/build-first-reuse-default.md) — §1 the
> seven verdicts, **§1.1 the two axes (operator vs shipped) and own-stack-first**, §3 the mandatory
> six-layer mechanism, §4 anti-patterns. Also binding:
> [`.claude/rules/phase-research-coverage.md §1`](../../rules/phase-research-coverage.md) (the
> 6-item checklist on any negative-existence claim) and
> [`docs/meta-factory/prior-art-evaluations.md §3`](../../../docs/meta-factory/prior-art-evaluations.md)
> (append-only row schema).

## §0 Dispatch facts (binding)

- **Tier 1, `bridge-profile` marker present** (header above). The «how» is one determinable
  sentence: run the BFR §3 mechanism per candidate against the §2 profile and record a two-axis
  verdict. The design judgment — which axis is in scope, what the funnel is, what the cost model is
  — was spent authoring this kickoff ([CLAUDE.md `Task-tier routing`](../../../CLAUDE.md)).
  **The K6 adjudication and the final ranking are NOT yours** — they belong to the Opus
  distillation seat. Emit candidates and evidence; do not crown a winner.
- **Staging placement.** This kickoff must be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **Ownership.** This stage writes ONE research-patch and MAY append rows to
  `docs/meta-factory/prior-art-evaluations.md` (append-only). It writes **no** rule, **no** hook,
  **no** skill, and does **not** edit `README.md`, `CLAUDE.md`, `.claude/rules/**`,
  `.claude/settings.json`, `.husky/**` ([CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md)).
- **Ceilings.** A pre-commit hook blocks any markdown file past **600 lines** — `wc -l` before
  adding, including `prior-art-evaluations.md` (~331 lines as of 2026-07-31).
- **Parallel stage.** Stage A (`token-economy-research-s-a`) runs concurrently on the always-on
  attribution. Do not duplicate its work; §2 is the shared source. Where you need a number stage A
  will produce, write `PENDING-STAGE-A` and continue — the distillation seat joins them.

## §1 Work items

### W1 — state our own stack first (own-stack-first, criterion zero)

Before evaluating any external candidate, enumerate what this project **already** does for
token/context economy, from source, with `file:line` or command output:

1. **Progressive disclosure already shipped** — the `00-rule-index.md` digest pattern, skill
   `SKILL.md` hot + `references/` cold split, `claudeMdExcludes` in `.claude/settings.json`.
2. **Seat/dispatch economy already measured** — `.claude/rules/cold-seat-economy.md §3` carries a
   measured table (fresh full audit 185,239 tokens / 19 tool calls vs inputs-inlined zero-tool
   85,855 tokens / 0 calls) and the watch-list mechanism in `agents/fidelity-auditor.md`.
   **Do not re-derive these numbers; cite them.**
3. **Model-cost routing** — `CLAUDE.md` «Task-tier routing» (Tier 0/1/2 + the `bridge-profile`
   marker).
4. **The in-flight umbrella** — `.claude/orchestrator-prompts/arch-v2-context-pipeline/` owns
   dispatch-input and seat economy. Read its `kickoff.md` and `calibration.md`. **Any candidate
   that duplicates a stage that umbrella already owns must be labelled as such**, not proposed
   fresh.

Skipping this item is `#own-stack-blind-spot`
([build-first-reuse-default.md §1.1](../../rules/build-first-reuse-default.md)) — the 2026-06-01
incident where a companion survey missed that the operator's own harness already shipped the
capability.

### W2 — evaluate each candidate against the MEASURED profile

For **each** candidate in §3, produce a block containing all of:

1. **The BFR §3 mechanism, run and shown** — WebSearch with **≥3 distinct phrasings** (quote the
   queries), DeepWiki `ask_question` where a concrete repo is named (`owner/repo` form), and an
   SSOT consult (`grep` `prior-art-evaluations.md`). Show what each returned. A mechanism
   «considered» but not run is T2.
2. **The T16 problem-class statement, verbatim in this form:**
   > Upstream problem class: X. Our problem class: Y. Match? Evidence: …
3. **Which measured cost line it attacks** — name the §2 row. A candidate that reduces *output*
   tokens is attacking 14% of spend; one that shrinks *resident context* is attacking 85.5%. State
   the line, then estimate the reduction **as a share of total weighted cost**, showing the
   arithmetic.
4. **A two-axis verdict** using the seven-verdict vocabulary — separately for the **operator axis**
   (tooling the maintainer runs) and the **shipped axis** (what a consumer receives). These may
   differ; a `REJECT` on shipped is not a verdict on operator use.
   **Shipped-axis note:** the umbrella's scope is the operator axis. For shipped, record a
   one-line provisional verdict with its open question — do not run a full evaluation.
5. **The cost gate** (BFR §1.1) — is adoption *cheap* (text/skill/rule edit, env var, config,
   citation) or *expensive* (new dependency, code module, standing infra)? Expensive requires a
   **cited concrete friction instance**, else `DEFER` with a recorded trigger.
6. **A falsifier** — one sentence: what observation would make this verdict wrong?

### W3 — find candidates this kickoff did not name

§3 is a seed list, not a population. Run at least **three** searches aimed at surfacing mechanisms
absent from it — e.g. context compaction/eviction strategies, prompt-cache-aware session design,
sub-agent context isolation, tool-schema deferral, output-format economy. Report what you found
**and what you searched but did not find**; a negative-existence claim needs the 6-item checklist
([phase-research-coverage.md §1](../../rules/phase-research-coverage.md)).

### W4 — propose next stages, ranked by attacked cost line

Close with a list of proposed follow-up stages for the `arch-v2-context-pipeline` umbrella (or a
new one, if you argue for it). Each proposal: one sentence of scope, the §2 cost line it attacks,
and its cost-gate class. **Proposals only — no implementation, and no self-selected winner.**

## §2 The measured cost profile (INLINED — shared with stage A)

Measured 2026-08-01 on the host over **247 transcripts** across **99 project directories** under
`~/.claude/projects/*rules-as-tests-aif*/`, reading per-turn billing accounting only — never
message content. **That path does not exist in the aif container**; §2 is your only source for
session behaviour. Anything not here is `INCONCLUSIVE — not in the inlined profile`, never
inferred ([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).

### 2.1 Cost by billing category, weighted by price multiplier — THE HEADLINE

Multipliers are Anthropic's published prompt-caching multipliers relative to base input price
(cache write 1.25×, cache read 0.1×) and the output/input price ratio (5×). **Verify these against
current published pricing and record the check.**

| category | raw tokens | multiplier | weighted units | cost share |
| --- | ---: | ---: | ---: | ---: |
| cache READ | 17,501,147,752 | 0.1× | 1,750,114,775 | **53.3%** |
| cache WRITE | 844,259,721 | 1.25× | 1,055,324,651 | **32.2%** |
| output | 91,526,585 | 5× | 457,632,925 | 14.0% |
| uncached input | 17,379,399 | 1× | 17,379,399 | 0.5% |
| **TOTAL** | | | **3,280,451,750** | 100% |

**85.5% of spend is context re-submission, not generation.** Uncached input is negligible, so
caching already works; the cost is that the cached context is large and is billed on every turn.
A candidate that does not shrink resident context or reduce turn count is attacking at most 14%.

### 2.2 Turn counts and the residency multiplier

247 sessions · median **213** turns · p90 **517** · max **833** · total 58,345 turns.

A token resident from turn 1 is re-billed at 0.1× on every later turn: **21.2×** a one-shot input
token in a median session, **51.6×** at p90, **83.2×** at max.

### 2.3 Per-model split — why the expensive tiers are the target

| model | turns | raw tokens |
| --- | ---: | ---: |
| claude-opus-4-8 | 29,878 | 10,128,170,357 |
| claude-fable-5 | 17,012 | 4,580,732,963 |
| claude-opus-5 | 6,968 | 2,513,431,331 |
| claude-sonnet-5 | 4,136 | 1,208,617,260 |
| claude-sonnet-4-6 | 184 | 21,217,372 |
| claude-haiku-4-5 | 14 | 2,144,174 |

Opus + Fable carry **53,858 of 58,341 turns (92%)**.

### 2.4 Tool-call frequency — what drives turn count

Bash 16,767 · Edit 2,921 · Read 1,825 · Write 764 · Agent 548 · TaskUpdate 513 · TaskCreate 309 ·
AskUserQuestion 240 · Skill 177 · ToolSearch 154. (49 tools total; the tail below 113 calls is
omitted as immaterial — stated, not silent.)

### 2.5 Tool-result payload returned INTO context — top 10 by volume

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

**Bash and Read together are 96% of tool-result volume** — 35.2M of 36.6M chars. This is the
number the RTK candidate must be evaluated against.

## §3 Seed candidates (a starting list, NOT the population — see W3)

1. **RTK — `rtk-ai/rtk`** (verified live 2026-08-01 via `gh api repos/rtk-ai/rtk`). «Rust Token
   Killer»: a CLI proxy that filters/compresses command output **before it reaches the agent's
   context**. Single Rust binary, zero deps, 100+ commands, <10 ms overhead, claims 60-90% token
   reduction on common dev commands. 74,185 stars, Apache-2.0, in Homebrew (`brew install rtk`).
   Topics include `claude-code`, `token-optimization`.
   *Evaluate against §2.5* — it attacks the Bash/Read payload class, which is 96% of tool-result
   volume. **The claim «60-90% reduction» is the vendor's, on their benchmark, not ours** — restate
   it as a claim to be tested, never as our expected saving. The number that matters is the share
   of §2.1 total weighted cost, not the share of one command's output.
2. **Remaining progressive-disclosure gaps.** Stage A enumerates and ranks these; your job is the
   *mechanism* question — for the artefacts stage A names as the head, what disclosure mechanisms
   exist upstream (in Claude Code itself, in Superpowers, in other agent frameworks) that this
   project is not using? Own-stack-first applies: check what the harness already ships before
   proposing anything built.
3. **Claude Code native context management** — compaction, context editing, `claudeMdExcludes`,
   tool-schema deferral (`ToolSearch`), sub-agent context isolation. **Own-stack-first, criterion
   zero:** these are features of the harness already in use. Establish what exists and what is
   configured *today* before evaluating any external tool that overlaps them.
   Use the `claude-code-guide` agent or context7 rather than recall.
4. **The Anthropic `engineering` plugin verdict** — aif task `53c2ecdd-9194-4f6f-bfca-6a3047de214e`
   (kickoff `anthropic-engineering-prior-art`) is producing a BFR verdict on Anthropic's
   first-party `engineering` plugin. If its research-patch has landed on `staging` by the time you
   run, read it and record whether it surfaced any context-economy mechanism. If it has not landed,
   record `PENDING — sibling stage in flight` and continue. **It is not a blocker.**

## §4 Descopes (binding — do not do these)

- **No implementation, no installation.** Not even `brew install rtk` on a scratch machine. This
  stage produces verdicts and rows, nothing executable.
- **No always-on attribution.** That is stage A. Cite `PENDING-STAGE-A` where you need its numbers.
- **No full shipped-axis evaluation.** One provisional line per candidate (W2 item 4); the axis is
  a later chapter.
- **No final ranking, no winner.** The Opus distillation seat adjudicates. Emitting a
  «recommended candidate» here is the K6 framing-bias defect this pipeline separates seats to
  prevent ([agents/dispatch-input-checker.md](../../../agents/dispatch-input-checker.md)).
- **No new umbrella, no extra PR.** One PR ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

## §5 Active AI-laziness traps

Per [`ai-laziness-traps.md §3`](../../rules/ai-laziness-traps.md) this kickoff enumerates its
active traps rather than blanket-referencing the catalogue.

**Active: T2, T3, T11, T12, T13, T14, T15, T16, T20.**

- **T2** — «my BFR method would surface prior art» is not running it. Each candidate shows its
  actual queries and their actual results.
- **T3** — no prose-only findings; command + output, or `file:line` with the quoted content.
- **T11 / T12** — no proposal without the search that preceded it; no «I already know this area».
  Training data is stale on fast-moving agent tooling — search at the moment of proposing.
- **T13** — a candidate that is already ADOPTED upstream is not thereby zero-work; confirm the
  upstream had evidence.
- **T14** — a clean search at low coverage is «coverage insufficient», never «nothing exists».
- **T15** — self-application: this survey is itself a context-consuming artefact. State what your
  own research-patch costs to read and whether its structure follows the disclosure discipline it
  evaluates.
- **T16** — the verbatim problem-class statement per candidate (W2 item 2). Name adjacency is the
  trap: a tool tagged `token-optimization` is not thereby our problem class.
- **T20** — no verdict without evidence in the same breath.

**Domain-specific trap — T-TokenB-A:** *«percentage-of-its-own-output» substitution*. A tool that
cuts 80% off `git status` output is trivially true and nearly irrelevant; the question is what
share of **§2.1 total weighted cost** it removes. Reporting a vendor's per-command reduction as the
project's saving is this stage's specific way of producing an impressive, wrong answer.

**Domain-specific trap — T-TokenB-B:** *cost-line blindness*. Proposing a mechanism that shortens
model *output* (14% of spend) while presenting it as a major saving, when the measured head is
resident context (85.5%). Every candidate must name its §2.1 row before its estimate.

## §6 Host-verify contract

The container is not the destination — the patch and any SSOT rows land on the host
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
Run these on the HOST before accepting; a green container run is not evidence.

```bash host-verify
npx markdownlint-cli2 "docs/meta-factory/research-patches/*token-economy*.md" "docs/meta-factory/prior-art-evaluations.md"
wc -l docs/meta-factory/research-patches/*token-economy*.md docs/meta-factory/prior-art-evaluations.md
npx vitest run packages/core/principles/08-prior-art-cited.test.ts packages/core/principles/10-research-patch-annotation.test.ts
```

## §7 Acceptance

The stage is done when the research-patch contains:

1. The own-stack enumeration with citations (W1), including the arch-v2 overlap labelling.
2. One complete block per candidate — mechanism shown, T16 statement, §2.1 cost line named,
   reduction estimated as a share of total weighted cost with arithmetic, two-axis verdict, cost
   gate, falsifier (W2).
3. The three-plus searches for unnamed candidates, with what was found **and** what was searched
   and not found (W3).
4. Ranked next-stage proposals with their attacked cost lines (W4).
5. A `Coverage:` line naming what was reached and what was not.
6. Any earned SSOT rows appended per the append-only schema.
