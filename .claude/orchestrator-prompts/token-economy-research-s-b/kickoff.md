<!-- scope: stage B of the token-economy research — BFR-disciplined survey of token/context-economy candidates against a measured cost profile. Runs in parallel with stage A; the profile both stages share is INLINED in §2. Authored 2026-08-01; revised same day after station round 1 (REVISE bottom seat / STOP shadow) — §2 rebuilt from one canonical aggregator run, host-verify glob de-collided from stage A, container-unreachable tool fallback added, sibling-task state corrected. -->
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
- **Deliverable filename (binding):** the research-patch MUST be
  `docs/meta-factory/research-patches/2026-08-01-token-economy-s-b-candidates.md` — the §6
  host-verify globs match on `token-economy-s-b` (deliberately disjoint from stage A's
  `token-economy-s-a` glob: the two stages land concurrently in the same directory, and a shared
  glob lets one stage's file mask the other's absence — `#silent-contract-skip`). Its **first
  line** MUST be an HTML scope comment (`<!-- scope: ... -->`) —
  [`10-research-patch-annotation.test.ts`](../../../packages/core/principles/10-research-patch-annotation.test.ts)
  fails the PR otherwise.
- **Container tool reality — CORRECTED 2026-08-09.** ~~the `claude-code-guide` agent is **NOT
  available** in the aif container (operator-verified precedent).~~ **False, and the evidence was an
  appeal to precedent with no probe.** Measured against the live `aif-handoff-agent-1`:
  `claude-code-guide` is a **built-in** agent compiled into the container's own CLI —
  `grep -ao` over `/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe` (v2.1.218)
  returns its definition literally carrying `source:"built-in"`, `baseDir:"built-in"`,
  `model:"haiku"`. Its tools are network-backed, and the container **has egress**:
  `https://docs.claude.com/en/docs/claude-code/overview` → `301`, `https://api.anthropic.com/` → `404`
  (both answered, neither blocked). **Re-probe before relying on this** — a CLI upgrade or a network
  policy change moves it, and «operator-verified precedent» is exactly the form of evidence that
  produced the wrong answer here. The fallback below stands unchanged and still bounds the blast
  radius: for Claude Code internals use context7 / DeepWiki / WebFetch of the official docs; if none
  of those is reachable either, record `INCONCLUSIVE — tooling unreachable from container` rather
  than answering from recall.
- **Ceilings.** A pre-commit hook blocks any markdown file past **600 lines** — `wc -l` before
  adding, including `prior-art-evaluations.md` (331 lines as of 2026-08-01).
- **Parallel stage.** Stage A (`token-economy-research-s-a`) runs concurrently on the always-on
  attribution. Do not duplicate its work; §2 is the shared source. Where you need a number stage A
  will produce, write `PENDING-STAGE-A` and continue — the distillation seat joins them.

## §1 Work items

### W1 — state our own stack first (own-stack-first, criterion zero)

Before evaluating any external candidate, enumerate what this project **already** does for
token/context economy, from source, with `file:line` or command output:

1. **Progressive disclosure already shipped** — the `00-rule-index.md` digest pattern, skill
   `SKILL.md` hot + `references/` cold split, `claudeMdExcludes` in `.claude/settings.json`
   (NOTE: stage A carries a pre-found finding that the exclusion only partially evicts — cite
   `PENDING-STAGE-A` for the attribution, do not re-derive).
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
   «considered» but not run is T2. If a search tool is unreachable from the container, record
   which one and mark that item `INCONCLUSIVE — tooling unreachable`, never silently narrower.
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
message content. Single aggregator run (2026-08-01T01:00:50Z; full script inlined in stage A's
§2.7); every table cross-foots exactly.

**CORRECTED 2026-08-09 — the exclusivity claim was false.** ~~**That path does not exist in the aif
container**; §2 is your only source for session behaviour.~~ It does exist. Measured against the
live `aif-handoff-agent-1`: `ls -d /home/node/.claude/projects/*rules-as-tests-aif*` → **102**
directories, and `find … -name '*.jsonl'` → **934** transcripts, the newest written the same day the
measurement was taken. **But do not simply substitute one source for the other — they are different
populations:** `/home/node/.claude` is a docker volume (`aif-handoff_claude-auth`), *not* a bind mount
of the operator home, and the directory names are container-side paths (`-home-www-rules-as-tests-aif-…`).
So those 934 transcripts are the **container's own dispatched-worker sessions**, not the 247 host
operator sessions §2 profiles. A stage that mines them is measuring a different cost regime and must
say so. The **binding grammar is unchanged and still applies to §2's numbers**: anything not in the
inlined profile is `INCONCLUSIVE — not in the inlined profile`, never inferred (the why is
[destination-environment-verification.md §3](../../rules/destination-environment-verification.md) — which is also the rule this very
sentence violated: a negative-existence claim about the destination environment, asserted without a
probe of it).

### 2.1 Cost by billing category, weighted by price multiplier — THE HEADLINE

Multipliers (cache write 1.25×, cache read 0.1×, output/input 5×) verified against live published
pricing 2026-08-01 by the dispatch-input station. Treat as verified; re-verify only if your
container has network access, else proceed.

| category | raw tokens | multiplier | weighted units | cost share |
| --- | ---: | ---: | ---: | ---: |
| cache READ | 17,501,892,975 | 0.1× | 1,750,189,298 | **53.3%** |
| cache WRITE | 844,266,278 | 1.25× | 1,055,332,848 | **32.2%** |
| output | 91,530,961 | 5× | 457,654,805 | 14.0% |
| uncached input | 17,379,404 | 1× | 17,379,404 | 0.5% |
| **TOTAL** | | | **3,280,556,354** | 100% |

**85.5% of spend is context re-submission, not generation.** Uncached input is negligible, so
caching already works; the cost is that the cached context is large and is billed on every turn.
A candidate that does not shrink resident context or reduce turn count is attacking at most 14%.

### 2.2 Turn counts and the residency multiplier

247 sessions · median **213** turns · p90 **517** · max **833** · total **58,345** turns (58,345
assistant turns with usage; per-model rows in 2.3 sum to exactly this).

A token resident from turn 1 is re-billed at 0.1× on every later turn: **21.2×** a one-shot input
token in a median session, **51.6×** at p90, **83.2×** at max.

### 2.3 Per-model split — why the expensive tiers are the target

| model | turns | raw tokens |
| --- | ---: | ---: |
| claude-opus-4-8 | 29,878 | 10,128,170,357 |
| claude-fable-5 | 17,012 | 4,580,732,963 |
| claude-opus-5 | 6,972 | 2,514,187,492 |
| claude-sonnet-5 | 4,136 | 1,208,617,260 |
| claude-sonnet-4-6 | 184 | 21,217,372 |
| claude-haiku-4-5 | 14 | 2,144,174 |
| `<synthetic>` (harness-internal, zero-token) | 149 | 0 |

Opus 4.8 + Opus 5 + Fable carry **53,862 of 58,345 turns (92%)**.

### 2.4 Tool-call frequency — what drives turn count

Bash 16,768 · Edit 2,922 · Read 1,825 · Write 764 · Agent 548 · TaskUpdate 513 · TaskCreate 309 ·
AskUserQuestion 240 · Skill 177 · ToolSearch 154. (52 tools total; the tail below 154 calls is
omitted as immaterial — stated, not silent.)

### 2.5 Tool-result payload returned INTO context — top 10 by volume

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
This is the payload-class number that any candidate attacking tool output (filters, compressors,
output-limiting wrappers) is evaluated against — whichever candidate that turns out to be.

## §3 Seed candidates (a starting list, NOT the population — see W3)

Each candidate below gets the identical W2 treatment; the ordering is arbitrary, and the amount of
seed detail given per candidate reflects only what was verified at authoring time, not priority.

1. **RTK — `rtk-ai/rtk`** (verified live 2026-08-01 via `gh api repos/rtk-ai/rtk`): CLI proxy
   filtering/compressing command output before it reaches the agent's context. Single Rust binary,
   Apache-2.0, in Homebrew, ~74k stars; topics include `claude-code`, `token-optimization`.
   **The vendor's «60-90% reduction» claim is theirs, on their benchmark, not ours** — restate it
   as a claim to be tested. The number that matters is the share of §2.1 total weighted cost
   removed, not the share of one command's output.
2. **Remaining progressive-disclosure gaps.** Stage A enumerates and ranks these; your job is the
   *mechanism* question — for the artefacts stage A names as the head, what disclosure mechanisms
   exist upstream (in Claude Code itself, in Superpowers, in other agent frameworks) that this
   project is not using? Own-stack-first applies: check what the harness already ships before
   proposing anything built.
3. **Claude Code native context management** — compaction, context editing, `claudeMdExcludes`,
   tool-schema deferral (`ToolSearch`), sub-agent context isolation. **Own-stack-first, criterion
   zero:** these are features of the harness already in use. Establish what exists and what is
   configured *today* before evaluating any external tool that overlaps them. Source per §0's
   container-tool bullet: context7 / DeepWiki / official docs — never recall.
4. **The Anthropic `engineering` plugin verdict** — aif task
   `53c2ecdd-9194-4f6f-bfca-6a3047de214e` (kickoff `anthropic-engineering-prior-art`) reached
   `done` on 2026-08-01, but its research-patch had NOT yet landed on `origin/staging` at this
   kickoff's revision (harvest pending). If the patch is on `staging` when you run, read it and
   record whether it surfaced any context-economy mechanism. If not, record
   `PENDING — task done, verdict not yet harvested to staging` and continue. **Not a blocker.**

## §4 Descopes (binding — do not do these)

- **No implementation, no installation.** Not even `brew install rtk` on a scratch machine. This
  stage produces verdicts and rows, nothing executable.
- **No always-on attribution.** That is stage A. Cite `PENDING-STAGE-A` where you need its numbers.
- **No full shipped-axis evaluation.** One provisional line per candidate (W2 item 4); the axis is
  a later chapter.
- **No final ranking, no winner.** The Opus distillation seat adjudicates. Emitting a
  «recommended candidate» here is the K6 framing-bias defect this pipeline separates seats to
  prevent ([agents/dispatch-input-checker.md](../../../agents/dispatch-input-checker.md)).
  (W4's «ranked next-stage proposals» is a different object and stays required: ordering
  FOLLOW-UP STAGE proposals by attacked cost line is not crowning a candidate.)
- **No new umbrella, no extra PR.** One PR ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

## §4a Park-don't-guess contract (non-negotiable)

On ANY genuine fork or ambiguity — two defensible verdicts for one candidate, a search result that
contradicts the SSOT, a §2 number that appears to contradict another — do **NOT** pick silently.
Park it: set the task to `manualReviewRequired` / `blocked_external` with the fork stated as
«Option A → consequence X / Option B → consequence Y», and stop that item. Proceed on the
unambiguous parts. A verdict chosen **with reasons recorded** is in scope; a verdict chosen
silently is the failure. Never manufacture a quoted command output for anything outside your
environment.

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
Run on the HOST via `bash scripts/host-verify.sh token-economy-research-s-b` before accepting;
a green container run is not evidence. The `test -f` guard exists because `markdownlint-cli2`
exits 0 on a zero-match glob, and stage A's patch lands in the same directory concurrently — an
undiscriminating glob would let A's file mask B's absence.

```bash host-verify
test -f docs/meta-factory/research-patches/2026-08-01-token-economy-s-b-candidates.md
npx markdownlint-cli2 "docs/meta-factory/research-patches/*token-economy-s-b*.md" "docs/meta-factory/prior-art-evaluations.md"
wc -l docs/meta-factory/research-patches/*token-economy-s-b*.md docs/meta-factory/prior-art-evaluations.md
npx vitest run packages/core/principles/08-prior-art-cited.test.ts packages/core/principles/10-research-patch-annotation.test.ts
```

## §7 Acceptance

The stage is done when the research-patch (filename + first-line scope comment per §0) contains:

1. The own-stack enumeration with citations (W1), including the arch-v2 overlap labelling.
2. One complete block per candidate — mechanism shown, T16 statement, §2.1 cost line named,
   reduction estimated as a share of total weighted cost with arithmetic, two-axis verdict, cost
   gate, falsifier (W2).
3. The three-plus searches for unnamed candidates, with what was found **and** what was searched
   and not found (W3).
4. Ranked next-stage proposals with their attacked cost lines (W4).
5. A `Coverage:` line naming what was reached and what was not.
6. Any earned SSOT rows appended per the append-only schema.
7. This stage's PR carries the standard `## §1.7 Self-discipline check` sections (forward +
   backward) — the PR template stubs them; the CI `discipline-self-check` gate rejects placeholders.

## See also

- [`token-economy-research-s-a/kickoff.md`](../token-economy-research-s-a/kickoff.md) — the
  parallel attribution stage sharing this §2 profile (and carrying the full aggregator script).
- [`docs/superpowers/specs/2026-08-01-token-economy-research-design.md`](../../../docs/superpowers/specs/2026-08-01-token-economy-research-design.md)
  — the funnel design (GLM gather → Opus distill → Fable decide) this stage implements.
- [`.claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md)
  — the umbrella owning dispatch/seat economy; W4 proposals feed it.
- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md)
  — the SSOT this stage may append to.
