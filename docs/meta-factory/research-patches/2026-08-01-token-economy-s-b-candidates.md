<!-- scope:token-economy-s-b-candidates -->

# Token-economy stage B — candidate survey against the measured profile

> **Stage goal (kickoff §0):** BFR-disciplined survey of candidate mechanisms for reducing
> token/context spend on the expensive model tiers, each evaluated against the **measured** cost
> profile inlined in
> [`token-economy-research-s-b/kickoff.md §2`](../../../.claude/orchestrator-prompts/token-economy-research-s-b/kickoff.md).
> **Zero build** — no tool installed, wired, or adopted under any outcome.
> **Consumer of this output:** the Opus distillation seat merges stage A + stage B into the single
> patch the operator reads. This file is raw material, not a ranking — **K6 adjudication and the
> final ranking are NOT this stage's** (kickoff §0/§4).
> **Measured headline (kickoff §2.1, single aggregator run 2026-08-01T01:00:50Z, 247 transcripts):**
> cache READ 53.3% · cache WRITE 32.2% · output 14.0% · uncached input 0.5% → **85.5% of weighted
> cost is context re-submission, not generation.** Every candidate below names which §2.1 row it
> attacks before its estimate (kickoff trap T-TokenB-B).
> **Funnel design:** [`2026-08-01-token-economy-research-design.md`](../../superpowers/specs/2026-08-01-token-economy-research-design.md)
> (GLM gather → Opus distill → Fable decide).
> **Parallel stage:** [`token-economy-research-s-a`](../../../.claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md)
> owns always-on attribution; cite `PENDING-STAGE-A` where its numbers are needed.

## W1 — Own-stack enumeration (own-stack-first, criterion zero)

Per [`build-first-reuse-default.md §1.1`](../../../.claude/rules/build-first-reuse-default.md) the
harness this project already runs is checked before any external candidate. Source-cited, not
recalled. Each item carries an `arch-v2 overlap:` label per kickoff W1 item 4.

1. **Progressive disclosure already shipped.**
   - `.claude/rules/00-rule-index.md` — the digest pattern: one summary line per rule in a
     rendered index table; full rule text lives in `.claude/rules/<name>.md` and is loaded only
     when its `paths:` glob matches an edited file (auto-load via the CC rules convention). Hot
     index + cold full-text.
   - Skill `SKILL.md` hot + `references/` cold split — e.g. `.claude/skills/aif-implement/SKILL.md`
     stays lean and references `references/IMPLEMENTATION-GUIDE.md` and `references/LOGGING-GUIDE.md`
     (opt-in reads, not resident).
   - `claudeMdExcludes` at `.claude/settings.json:214` — 7 entries today (`egress-no-api-bypass`,
     `memory-codification`, `recommendation-laziness-discipline`, `reviewer-discipline`,
     `autonomous-loop-continuity`, `git-conflict-merge-forward`, `cold-seat-economy`): these rules
     are excluded from the CLAUDE.md auto-injection channel. **Stage A carries a pre-found finding
     that the exclusion only partially evicts** (the rules remain project-instructions via CC's
     parallel rules auto-load, a different channel from CLAUDE.md) → attribution =
     `PENDING-STAGE-A`; this stage does **not** re-derive it.
   - **`arch-v2 overlap:`** disclosure artefact enumeration is stage A's W4
     ([`token-economy-research-s-a/kickoff.md:122`](../../../.claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md));
     arch-v2 S-C will give the BFR verdict on L2 population mechanisms. This stage's candidate 2
     (T3 below) feeds mechanism options INTO that verdict — it does not duplicate the enumeration.

2. **Seat/dispatch economy already measured** — cite, do not re-measure.
   [`cold-seat-economy.md §3`](../../../.claude/rules/cold-seat-economy.md) (`:56` section header)
   table:
   | run | tokens | tool calls | wall clock |
   |---|---|---|---|
   | fresh agent (top tier), full fidelity audit | 185,239 | 19 | 174 s |
   | resumed agent (top tier), narrow scope | 164,995 | 8 | 144 s |
   | fresh agent (executor tier), narrow 4-file review | 177,105 | 7 | 137 s |
   | fresh agent (executor tier), inputs inlined, zero tools | 85,855 | 0 | 16 s |
   The load-bearing lever: **inline inputs in the dispatch prompt** (zero tool-reading turns) ≈
   half the tokens of file-reading variants. Turn count dominates cost; input narrowness alone
   saves little. Watch-list mechanism in
   [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md).
   - **`arch-v2 overlap:`** dispatch-input economy IS arch-v2 S-B's surface
     ([`calibration.md`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md)
     — the shadow-A/B ledger). This stage does not propose new dispatch choreography; any
     candidate that overlaps seat-economy (T4 native sub-agent isolation) is labelled against it.

3. **Model-cost routing** — [`CLAUDE.md «Task-tier routing»`](../../../CLAUDE.md): Tier 0 (≤~5
   lines, senior edits directly) / Tier 1 (bulky-simple, `bridge-profile` marker → executor tier
   runs the whole pipeline) / Tier 2 (bulky-complex, top tier plans). This very stage is Tier 1
   via the `Z.AI GLM-5.2 SDK` marker — an in-flight example of routing context-heavy-but-judgment-light
   work to the cheaper tier.
   - **`arch-v2 overlap:`** none — tier routing is the harness/operator axis this research runs on,
     not an arch-v2 stage. A budget gate (S-E) would operate on the OUTPUT of this routing, not
     replace it.

4. **The in-flight arch-v2-context-pipeline umbrella.**
   [`kickoff.md:6`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md)
   goal verbatim: *«context is the one convention this project never made executable — budget
   asserted by nobody, every role loaded identically»*. The umbrella owns (§1 stage table):
   S-A (`/arch` v2 + L1 attribution), S-B (dispatch-input v2 + shadow-A/B ledger — the
   [`calibration.md`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md)
   read), S-C (L2 population table + 5-option BFR verdict), S-D (L2 build), S-E (L1 budget gate at
   pre-push/CI + `InstructionsLoaded`), S-F (small-fixes queue). **Owns:** L1 measurement, L2
   verdict, dispatch-input choreography. **Does NOT own:** external candidate surveys (RTK and
   siblings) and native-harness feature adoption verdicts — exactly stage B's scope. Stages A+B
   feed evidence INTO S-E/S-C; they do not duplicate them.

## W2 — Candidate evaluations

### Candidate 1 — RTK (`rtk-ai/rtk`, CLI proxy)

**1. BFR §3 mechanism — run and shown (T2/T3/T20).**
- WebSearch (3 phrasings, quoted verbatim, run 2026-08-01):
  - `rtk-ai/rtk claude code CLI proxy token reduction` → repo + vendor claims surfaced
    ([github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk)): «CLI proxy that reduces LLM token
    consumption by 60-90% on common dev commands. Single Rust binary, zero dependencies».
  - `RTK Rust Token Killer benchmark methodology 89% noise removal claude` → README disclaimer
    surfaced verbatim: *«RTK cuts up to 90% of the bash output your agent reads. That is what RTK
    measures, and **it is not the same as cutting your bill by 90%**»*; third-party benchmark
    [jetbrains.com/ai/2026/07/rtk-claude-code-token-savings](https://blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings/)
    («Does 'rtk' skill really cut agent tokens by 60–90%? We tested it»); reddit user report
    («saved 10M tokens (89%)»).
  - `CLI output filter compress agent context token reduction tool comparison` → competitor
    landscape surfaced (TACO arxiv, Headroom, context-compress, GTK proxy, School CLI) — recorded
    under W3.
- DeepWiki `ask_question` on `rtk-ai/rtk` (run 2026-08-01): RTK «primarily targets tool-result
  payloads»; reduction measured as `estimate_tokens(raw) − estimate_tokens(filtered)` where
  `estimate_tokens = chars/4` (±10% vs real tokenisation); four strategies: smart filtering,
  grouping, truncation, dedup; on filter failure falls back to raw output; stats in
  `~/.local/share/rtk/history.db` via `rtk gain`.
- SSOT grep (`grep -niE 'rtk|token.*filter|context.*compress' docs/meta-factory/prior-art-evaluations.md`):
  **0 hits.** RTK is not in the SSOT; this evaluation earns a new row (T8).

**2. T16 problem-class statement.**
> Upstream problem class: short, Bash-heavy dev sessions where command output dominates the context
> budget (vendor benchmark: a 30-min Claude Code session ≈ 150k tokens, much of it command output).
> Our problem class: long sessions (median 213 turns, p90 517) where 85.5% of weighted cost is cache
> READ of resident context that is **not** command output (system prompt, CLAUDE.md, loaded skills,
> prior assistant turns, file Reads).
> Match? **Partial — right cost LINE (resident context, via cache read/write), wrong SURFACE.** RTK
> addresses Bash output, which is a minority of this project's resident-context tokens.
> Evidence (denominator stated explicitly): §2.5 Bash payload ≈ 20.6M chars ≈ 5.15M tokens
> corpus-wide. Compared **raw-once** against §2.1 cache-READ raw (17.5B) = 0.029% — but that
> compares Bash counted once at entry to cache-READ which counts every re-read of every resident
> token (denominator-category error). Apples-to-apples (**re-billed** via §2.2 residency multiplier):
> mid-session entry 5.15M × ~106 ≈ 546M → **3.1%** of cache-READ raw; turn-1 entry 5.15M × 212 ≈
> 1.09B → **6.2%**. Conclusion weakened (margin is ~3-6%, not two orders of magnitude) but **not
> reversed** — Bash is still <10% of the resident-context head; the §3 arithmetic below independently
> lands RTK's project-share saving at 1.9-3.5% of total weighted cost.

**3. §2.1 cost line attacked + arithmetic (T-TokenB-A/B).**
Cost line: **cache WRITE (32.2%) + cache READ (53.3%)** — the resident-context head (85.5%). RTK
compresses Bash output *before* it enters context, so the smaller payload is cache-written once and
cache-read on every subsequent turn. Per §2.2 a token resident from turn 1 is re-billed 21.2×
(median) / 51.6× (p90) / 83.2× (max) — RTK's leverage is amplified by the residency multiplier,
but only on the share it touches.

Arithmetic (generous-to-RTK upper bound — all 5.15M Bash tokens enter at turn 1 of median sessions):
- per-token weighted cost over a median session = `1.25 + (213−1)·0.1 ≈ 22.5` units (write once +
  read 212 times). Realistic mid-session entry ≈ `1.25 + ~106·0.1 ≈ 12` units.
- corpus weighted cost attributable to Bash output ≈ `5.15M · ~12 ≈ 62M` units (realistic) to
  `5.15M · 22.5 ≈ 116M` units (generous) = **1.9% to 3.5% of §2.1 total (3,280,556,354 units)**.
- vendor's 89% noise-removal on Bash → project saving = `0.89 · (1.9%..3.5%)` =
  **≈ 1.7% to 3.1% of total weighted cost** under the assumptions above.
- **Caveats that move this down, not up:** (a) RTK does not touch Read output (14.6M chars / 36.5%
  of tool-result payload — file contents the proxy cannot intercept); (b) the 89% is the vendor's
  on its own command mix, not this project's (this project's `Bash` calls include `git`,
  `markdownlint`, `vitest`, `tsx render-rule-index` — RTK's filters exist for `git status`/`cargo
  test` shapes; coverage on this mix is unmeasured); (c) residency-multiplier gain assumes the
  compressed payload still lets the model act correctly — if it re-runs a command to see full
  output, the saving evaporates.

**The vendor's own README disclaims the bill-reduction framing** — this arithmetic confirms it.

**4. Two-axis verdict.**
- **Operator axis: `DEFER`.** Worth recording (T8 SSOT row). Adoption is cheap on the operator axis
  (Homebrew, zero config) but the project-share saving is too small to justify a new tool surface
  now. **Trigger to revisit:** a measured session class where Bash output > 30% of resident-context
  tokens (e.g. a long test-debug loop) — re-measure and likely upgrade to `ADOPT`-on-operator for
  that class only.
- **Shipped axis (provisional, one line): `REJECT` (provisional).** Ships a platform-specific Rust
  binary as a hard dependency — violates the AI-/OS-/license-agnostic shipped-axis default
  ([build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md)). **Open
  question:** would a config-only equivalent (a skill teaching the agent to pipe Bash through
  `head`/`grep`/`wc`) capture part of the gain without the binary? Not evaluated here — out of
  scope per kickoff §4 descope (one provisional line).

**5. Cost gate (BFR §1.1).**
- Operator axis: **cheap** (text/config install, env var, no project dep) — but DEFER anyway because
  the attacked-cost share is small. No friction instance cited.
- Shipped axis: **expensive** (new binary dependency, platform matrix) → would require a cited
  concrete friction instance to justify; none exists → DEFER/REJECT stands.

**6. Falsifier.** A measured Bash-heavy session class (e.g. `cargo test`/`pytest` debug loop where
test-runner output dominates context) on which RTK removes > 5% of total weighted cost — would
upgrade the operator-axis verdict from DEFER to `ADOPT`-on-operator for that class.

### Candidate 2 — Remaining progressive-disclosure gaps

**Scope split (kickoff §3 item 2):** stage A's W4
([`token-economy-research-s-a/kickoff.md:122`](../../../.claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md))
owns the **artefact enumeration** — which files are resident that should not be, ranked by cost.
Stage A's patch is not on `origin/staging` as of this run (concurrent stages; §6 host-verify glob
de-collided precisely for this) → artefact list = `PENDING-STAGE-A`. This candidate owns the
**mechanism question**: what disclosure mechanisms exist upstream that this project is not using?

**1. BFR §3 mechanism — run and shown.**
- WebSearch (3 phrasings, run 2026-08-01):
  - `Claude Code progressive disclosure layered context skill references cold load mechanism` →
    Agent Skills docs + multiple deep-dives confirm the filesystem three-tier pattern (metadata hot,
    `SKILL.md` warm, bundled refs cold); [arxiv 2607.17598](https://arxiv.org/html/2607.17598v1)
    academic validation.
  - `agent framework progressive disclosure layered context loading` (run under candidate-3 batch)
    → same pattern across Cursor rules / Aider conventions / Cline Memory Bank.
  - `Claude Code claudeMdExcludes partial eviction rules still loaded` → surfaced the partial-eviction
    behaviour stage A independently found (rule excluded from CLAUDE.md remains loaded via CC's
    parallel rules auto-load channel).
- DeepWiki `ask_question` on `obra/superpowers` (run 2026-08-01): Superpowers ships exactly this
  pattern — only `name`+`description` from YAML frontmatter pre-loaded; full `SKILL.md` on-demand;
  bundled refs loaded only when accessed; `SKILL.md` ≤500 lines; **ongoing minification pass**
  (`docs/superpowers/specs/2026-06-10-strict-cost-sdd-design.md`) — «even frequently re-read skills
  incur significant token costs over a long session».
- SSOT grep: `#103` (Claude Code config/memory surface — claudeMdExcludes etc., REFERENCE) and `#8`
  (AIF Step 0 re-read pattern, ADOPT VOCABULARY). Both already recorded.

**2. T16 problem-class statement.**
> Upstream problem class: long agent sessions where every resident token is re-billed on every turn;
> keep resident context small by loading detail on demand (filesystem-tiered: metadata hot, body
> warm, references cold).
> Our problem class: identical — median 213-turn sessions, 85.5% of weighted cost is resident context.
> Match? **Strong.** This project already adopted the pattern (W1.1) — the candidate is not a new
> tool but the **gap between full adoption and partial adoption**. Evidence: claudeMdExcludes
> (`.claude/settings.json:214`) lists 7 rules, but stage A's pre-finding is that the exclusion only
> partially evicts (rules still load via CC's parallel auto-load channel).

**3. §2.1 cost line attacked + arithmetic.**
Cost line: **cache WRITE 32.2% + cache READ 53.3%** (resident-context head, 85.5%) — disclosure
removes a token entirely: saving = `tokens_removed · (1.25 + residency_multiplier · 0.1)`.
Worked example: a 200-line (~3k-token) rule resident across a median 213-turn session costs
`3 000 · (1.25 + 21.2) ≈ 67 000` units/session → `· 247 sessions ≈ 16.6M` units = **~0.5% of §2.1
total per such file**. Each disclosure gap stage A ranks is roughly this order of magnitude; the
aggregate depends on how many artefacts are partially-evicted (stage A's `PENDING-STAGE-A` number).

**4. Two-axis verdict.**
- **Operator axis: `ADOPT` (continue + close the partial-eviction gap).** Upstream-validated
  (Superpowers + Agent Skills spec + W1.1) and in force. Open work: **configuring the partial-
  eviction channel** (stage A's finding) + confirming every rule is under a `paths:` glob.
- **Shipped axis (provisional, one line): `ADOPT` (provisional).** Harness-native pattern and
  AI-/OS-agnostic. **Open question:** are `claudeMdExcludes`/`paths:`-glob portable across
  consumer harnesses (Cursor/Cline/Aider), or CC-specific? Flagged for the distillation seat.

**5. Cost gate.** **Cheap** on both axes — text/rule/config edits, no dep, no code module, no
infra. The partial-eviction fix is a settings.json edit + verifying each rule carries a `paths:` glob.

**6. Falsifier.** Stage A's per-artefact measurement shows a given disclosure-gap artefact is NOT
resident on turns where it is irrelevant (disclosure already working) — would downgrade that
specific gap's priority without changing the verdict on the pattern.

**`arch-v2 overlap:` PARTIAL with S-C** ([`kickoff.md:91`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md)).
S-C's L2 population table + 5-option BFR verdict adjudicates which ambient context to load; stage
A's ranked gaps + this candidate's mechanism menu feed INTO that verdict — they do not duplicate S-C.

### Candidate 3 — Claude Code native context management

**Own-stack-first, criterion zero (kickoff W1 item 3):** these are features of the harness already
in use. Establish what exists AND what is configured today before evaluating any external overlap.

**1. BFR §3 mechanism — run and shown.**
- WebSearch (3 phrasings, run 2026-08-01):
  - `Claude Code progressive disclosure layered context skill references cold load mechanism` →
    official Agent Skills docs + academic validation (arxiv 2607.17598).
  - `Claude Code /compact auto-compact context window token reduction effectiveness measurement` →
    [Claude Cookbook on automatic compaction](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction):
    **122,392 token savings (58.6% reduction)** in the worked example; the page reports a default
    100k-token threshold + guideline bands (no capacity % published — threshold claim retracted);
    [claudefa.st](https://claudefa.st/blog/guide/mechanics/context-buffer-management) notes the
    autocompact buffer shrank 45K→33K; [JetBrains observation-masking research (primary)](https://blog.jetbrains.com/research/2025/12/efficient-context-management/):
    **52% cost reduction + 2.6% solve-rate boost**. **Honest cost:** reddit reports losing 20–25k
    tokens of information on auto-compact — compaction is lossy, not free.
  - `Claude Code sub-agent context isolation token savings parent transcript background` →
    [official sub-agents docs](https://code.claude.com/docs/en/sub-agents); **critical honest signal**
    from [r/ClaudeCode](https://www.reddit.com/r/ClaudeCode/comments/1q6jr9o/yes_subagents_save_context_but_they_use_a_lot_of/):
    *«the subagent loads the entire Claude Code context just to run 3 bash commands»* — sub-agents
    trade parent-context for sub-agent-context, not a free win.
- DeepWiki `ask_question` on `anthropics/claude-code` (run 2026-08-01): compaction auto-triggers
  when conversation grows too large + `/compact` manual; Read tool uses compact line-number format
  and deduplicates unchanged re-reads; **MCPSearch deferral — when MCP tool descriptions exceed
  ~10% of context window they are deferred and discovered via `MCPSearch`/`ToolSearch`**
  (`alwaysLoad` overrides per-server); subagent context isolation (only final message returns to
  parent); `isolation: "worktree"`. (Prior draft asserted a `CLAUDE_CODE_SIMPLE` env var disabling
  CLAUDE.md loading — **retracted**: WebFetch of `code.claude.com/docs/en/settings` on 2026-08-01
  lists 16 `CLAUDE_CODE_*` vars and `CLAUDE_CODE_SIMPLE` is not among them — likely a DeepWiki
  confabulation, not corroborated. The CLAUDE.md-loading channel is **INCONCLUSIVE** from this
  container — `claudeMdExcludes` is the only verified channel.)
- context7 `/llmstxt/code_claude_llms_txt` (run 2026-08-01): corroborated MCPSearch/ToolSearch
  deferral + `permissions.deny: ["ToolSearch"]` config. (Prior draft's "same features confirmed"
  overstated corroboration of the retracted `CLAUDE_CODE_SIMPLE` claim — corrected.)
- SSOT grep: `#103` already records the Claude Code config/memory surface (REFERENCE).
- **Configured today on this project** (verified, not recalled):
  - `claudeMdExcludes` — YES (7 entries, `.claude/settings.json:214`; partial eviction per stage A).
  - `ToolSearch`/MCPSearch deferral — IMPLICIT (no `permissions.deny` set; §2.4 shows `ToolSearch
    154` calls — feature is live).
  - Compaction — IMPLICIT (no config; harness default fires at the published 100k-token threshold).
  - Sub-agent isolation — YES in active use (`Agent` 548 calls per §2.4; `isolation: "worktree"`
    precedent at [`parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md)).
  - Read dedup / compact line format — YES (harness default; no opt-out).

**2. T16 problem-class statement.**
> Upstream problem class: long agent sessions where the harness must keep a 200k-token window
> usable — auto-summarise history (compaction), defer rarely-used tool schemas (MCPSearch), isolate
> sub-task context (sub-agents), exclude irrelevant memory files (claudeMdExcludes).
> Our problem class: identical (median 213-turn sessions, 85.5% resident-context cost).
> Match? **Strong — these ARE the harness's resident-context controls.** The candidate is not
> adoption-from-scratch; it is **configuration tuning + usage discipline** to maximise the leverage
> already-shipped features give.

**3. §2.1 cost line attacked + arithmetic.**
Each feature attacks a different facet of the cache-WRITE+READ head (85.5%):
- **claudeMdExcludes / `paths:` glob auto-load**: removes a resident token entirely. Strongest
  lever — same arithmetic as candidate 2 (~0.5% of total per ~3k-token file across 247 sessions).
- **MCPSearch deferral**: defers tool schemas. The §2.4 profile shows 52 tools; if each schema is
  ~200 tokens, the full set is ~10k tokens — deferred schemas remove `10 000 · (1.25 + 21.2) ≈
  225 000` weighted units/session → `~55.5M` across 247 sessions = **~1.7% of total**, IF all 52
  schemas would otherwise be resident. Already partly live (154 ToolSearch calls logged).
- **Compaction**: **unquantified-with-reason.** The 58.6% reduction is on conversation history,
  not total weighted cost; affects only turns AFTER the compaction event. §2.1 share =
  `(compaction_event_turn / total_turns) × (post-compaction resident / corpus resident)`, but both
  numerator inputs need per-turn attribution = **`PENDING-STAGE-A`**. Direction is downward (median
  213-turn session with one compaction near the end is a small slice; 833-turn max gains more);
  mechanism is **lossy** (trades context for cost).
- **Sub-agent isolation**: **unquantified-with-reason.** §2.4 shows 548 Agent calls, but each
  sub-agent pays its own context cost («just to run 3 bash commands», per r/ClaudeCode). Net win =
  `(parent_intermediate − subagent_result) · residency_multiplier`, positive only when sub-task's
  intermediate work is large and result small — the cold-seat-economy §3 tradeoff (inlined = 85k vs
  file-reading = 177k, same shape). Per-call share below §2.5 granularity; aggregate =
  `PENDING-STAGE-A`.
- **Read dedup / compact line format**: **unquantified-with-reason.** §2.5: Read = 14.6M chars /
  3.65M tokens raw-once; dedup saves re-reads of unchanged files only; compact line format shrinks
  per-Read overhead modestly. No unchanged-vs-changed re-read ratio measured; share = `PENDING-STAGE-A`.

**4. Two-axis verdict.**
- **Operator axis: `ADOPT` (continue + tune).** All five features are live or implicit-default. The
  work is (a) confirming every rule/skill is under a `paths:` glob or `claudeMdExcludes`-equivalent
  (closes candidate-2's gap), (b) measuring whether the published 100k-token compaction threshold
  is right for this project's loss-tolerance, (c) using sub-agent delegation where the cold-seat-economy
  table shows a net win. **No new adoption — configuration + discipline.**
- **Shipped axis (provisional, one line): `ADOPT` (provisional).** Native to CC; portability to
  other consumer harnesses varies (Cursor/Cline have partial analogs). **Open question:** which of
  these features a consumer not on CC loses — the shipped core must degrade gracefully. Flagged for
  the distillation seat.

**5. Cost gate.** **Cheap** on both axes — config edits, no new dependency, no code module. The
only expensive path would be BUILDING a wrapper that re-implements these features for non-CC
harnesses — that is a shipped-axis decision, out of scope here.

**6. Falsifier.** A per-feature measurement showing one of these (e.g. MCPSearch deferral) removes
<0.1% of this project's total weighted cost — would downgrade that feature's tuning priority
without changing the verdict on the bundle.

**`arch-v2 overlap:` COMPLEMENTARY with S-E** ([`kickoff.md:93`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md)).
S-E ships the L1 budget gate at pre-push/CI — the gate that makes resident context *executable*.
Native features shrink what loads; S-E's gate enforces a ceiling. They compose; neither replaces
the other.

### Candidate 4 — Anthropic `engineering` plugin

**1. BFR §3 mechanism — run and shown.**
- WebSearch (3 phrasings, quoted verbatim, run 2026-08-01):
  - `"Anthropic engineering plugin Claude Code context reduction token economy features"` → no
    plugin marketed under the literal name «engineering»; surfaces Anthropic's
    [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
    blog + Tool Search (46.9% MCP-context cut) + context editing (84% on 100-turn evals), all of
    which are native CC features already covered by candidate 3, NOT a separate plugin.
  - `"\"claude engineering\" plugin code review Anthropic features context"` → Anthropic's
    [Code Review plugin](https://claude.com/blog/code-review) (multi-agent PR review) +
    [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)
    marketplace; plugin surface is code-review / engineering-quality, not token economy.
  - `"anthropic claude code \"engineering\" plugin marketplace install features list"` → directory
    results enumerate plugins (`feature-dev`, `plugin-dev`, `code-review`, `commit-commands`);
    none advertised as a token-economy / context-reduction mechanism.
- DeepWiki `ask_question` on `anthropics/claude-code` (run 2026-08-01): «does not explicitly ship
  or document a plugin named 'engineering'»; engineering-adjacent plugins are `feature-dev`,
  `plugin-dev`, `code-review`, `commit-commands`; «none explicitly mention token-economy,
  context-reduction, or advanced context-management capabilities beyond the native Claude Code
  features». Glossary mentions only basic «Compaction».
- SSOT grep (`grep -niE 'engineering.*plugin|anthropic.*plugin' docs/meta-factory/prior-art-evaluations.md`):
  **0 hits.** No prior verdict recorded.
- Staging-presence probe (kickoff §3 item 4): `git fetch origin staging` → **failed with TLS
  handshake error** (`SSL_ERROR_SYSCALL`; github.com unreachable from the aif container,
  `api.github.com` reachable — §0 container-tool-reality note). The harvested prior-art verdict
  (aif task `53c2ecdd-9194-4f6f-bfca-6a3047de214e`, `anthropic-engineering-prior-art`, reached
  `done` 2026-08-01) is therefore **`PENDING — task done, verdict not yet harvested to staging`**
  for the staging-presence check only (kickoff §3 item 4 — not a blocker).

**2. T16 problem-class statement.**
> Upstream problem class (stated, per reachable sources): engineering-quality / code-review
> assistant delivered as a Claude Code plugin (multi-agent PR review). Our problem class:
> token-economy mechanism survey against §2.1. Match? **Likely NO on surface** — the plugin's
> advertised surface is engineering quality, not context reduction. The harvested verdict
> (PENDING above) is the authoritative answer; this stage does not manufacture one from recall.

**3. §2.1 cost line attacked + arithmetic.** Based on the reachable advertised surface
(engineering/code-review), the plugin does **not directly attack any §2.1 row**: 0% of cache-READ
(53.3%), 0% of cache-WRITE (32.2%), 0% of output (14.0%). IF the harvested verdict surfaces a
context-economy mechanism inside the plugin, that finding will name the row and supply the
arithmetic. Quoting a non-zero number now would be T3 (prose-only finding) on a verdict not yet
harvested — `0% on advertised surface; PENDING on harvested surface` is the honest line.

**4. Two-axis verdict.** **Operator + shipped (both provisional): `DEFER`-with-trigger.** Trigger:
the harvested prior-art patch landing on `origin/staging`. Per kickoff §4a (park-don't-guess):
picking a verdict before reading the harvested patch would be the silent fork this stage refuses.

**5. Cost gate.** **Unknown** — depends on what the plugin turns out to be (free plugin = cheap;
paid-tier feature = expensive on operator, REJECT on shipped per `no-paid-llm-in-ci.md`).

**6. Falsifier.** The harvested research-patch lands and surfaces zero context-economy mechanism
inside the plugin → this candidate is removed from the distillation seat's input set.

**`arch-v2 overlap:` UNKNOWN** — depends on the harvested verdict.

## W3 — Unnamed-candidate search

Four WebSearch phrasings run 2026-08-01, each quoted verbatim. Aim: surface mechanisms absent
from the §3 seed list. New candidates are recorded with a one-line T16 statement + the §2.1
cost line they would attack; a full W2 block is not produced here — the distillation seat owns
deep evaluation (kickoff §0/§4 — no winner-crowning from this stage).

### Search 1 — compaction/eviction strategies (beyond CC native)

- **Query:** `agent context compaction eviction strategy LLM long session token reduction framework`
- **What returned:**
  - **Context Window Lifecycle (CWL)** ([arxiv 2606.11213](https://arxiv.org/html/2606.11213v1)) —
    «unbounded working memory for long-horizon agents»; **structured eviction policy**, distinct
    from CC auto-compact's lossy summarisation. Academic; no CC-integrated implementation surfaced.
  - **Governance Decay** ([arxiv 2606.22528](https://arxiv.org/html/2606.22528v1)) — risk paper,
    not a tool; corroborates the candidate-3 «compaction is lossy» honest signal.
  - **LangChain Deep Agents** + **Agent Development Kit (ADK)** — frameworks shipping
    summarisation/offloading; not CC-integrated.
- **New candidate surfaced:** **structured-context-eviction (CWL-style)**. T16 statement:
  > Upstream problem class: long-horizon agents needing unbounded working memory via structured
  > eviction. Our problem class: long sessions (median 213 turns) on a CC harness that already
  > auto-compacts. Match? **Partial** — complements CC compaction with explicit eviction policy
  > instead of summarisation; no CC-integrated implementation exists; would require BUILD.
  > Cost line attacked: cache WRITE+READ (85.5%). Provisional verdict: **WATCHLIST** — research
  > only; BUILD cost on a non-CC-integrated academic paper is unjustified.

### Search 2 — prompt-cache-aware session design

- **Query:** `prompt cache aware agent session design maximize cache read prefix reuse strategy`
- **What returned:** convergent pattern across
  [earendil.com/posts/prompt-caching](https://earendil.com/posts/prompt-caching/),
  [arxiv 2601.06007](https://arxiv.org/html/2601.06007v2),
  [LangChain Deep Agents](https://www.langchain.com/blog/deep-agents-prompt-caching),
  [OpenAI Cookbook 201](https://developers.openai.com/cookbook/examples/prompt_caching_201): «freeze
  system prompt across turns; static-first, dynamic-last; stabilize the prefix; monitor
  `cached_tokens`».
- **Critical §2.1 read:** cache READ 53.3% + cache WRITE 32.2% = **85.5% of cost is already
  cache-mediated**. Caching is working — the question is whether the prefix is being inadvertently
  **invalidated mid-session**, converting READs (0.1×) into WRITEs (1.25×) or uncached (1×). Stage
  A's per-turn attribution is the only thing that can quantify how often prefix-churn happens here.
- **New candidate surfaced:** **prompt-prefix-stability audit**. T16 statement:
  > Upstream problem class: any agent session where cacheable prefix churns. Our problem class:
  > identical — but §2.1 shows caching is dominant (85.5%), so the failure mode is **churn**, not
  > absence. Match? **Strong**. Cost line attacked: cache WRITE (32.2%) — churn converts WRITE
  > 1.25× into READ 0.1× (good) or, when wrong, READ into WRITE/uncached (bad). Provisional verdict:
  > **ADOPT-as-discipline-on-operator** — cheap (no tool, measurement + prompt ordering discipline).

### Search 3 — output-format economy

- **Query:** `LLM structured output JSON schema token economy reduce verbose prose generation`
- **What returned:**
  - [«The JSON Tax» (nehmeailabs)](https://nehmeailabs.com/post/structured-output-overhead) —
    **JSON structured output adds 2-3× token overhead** for simple extraction tasks.
  - [Token Efficiency with Structured Output (Microsoft)](https://medium.com/data-science-at-microsoft/token-efficiency-with-structured-output-from-language-models-be2e51d3d9d5):
    YAML < JSON for token economy; field-name shortening strategies.
  - [arxiv 2606.09395 — «Empirical Study for Structured Output Control in LLMs for Software
    Engineering»](https://arxiv.org/html/2606.09395) — grammar-constrained decoding; theoretical,
    not a CC plugin. (Prior draft titled this «LLGuidance» — that is a different artifact; corrected.)
- **§2.1 read:** output = **14.0%** — smallest non-trivial cost line. Structured-output adoption
  would, per the JSON-Tax finding, **increase** output cost. The Microsoft finding (YAML < JSON,
  terse field names) is the only economy direction, and applies only to the small subset of LLM
  calls producing structured data.
- **New candidate surfaced:** **structured-output-format audit (YAML over JSON, terse schemas)**.
  T16 statement:
  > Upstream problem class: structured-output calls where format overhead dominates. Our problem
  > class: 14% output cost, mostly free-prose assistant turns, not JSON. Match? **Weak on the
  > aggregate cost; potentially strong on a narrow call class** (TACO-like tool calls).
  > Provisional verdict: **DEFER** — narrow surface; revisit only if a measured class of
  > JSON-heavy calls exceeds 1% of output cost.

### Search 4 — session splitting / checkpoint-resume

- **Query:** `agent session splitting checkpoint resume reduce context length long task decomposition subagent`
- **What returned:**
  - **TokenMizer** ([arxiv 2606.06337](https://arxiv.org/html/2606.06337v1)) — three-tier checkpoint,
    8-layer compression, graph-structured memory. Academic.
  - **OpenAI Agents SDK Session Memory** + **LangGraph Context Engineering** — short/long-term
    memory persistence patterns (the slavadub «Long-Running Agent Runtime» post was probed but
    404s as of 2026-08-01; dropped).
- **§2.1 read:** these address cache WRITE+READ (85.5%) by **rotating sessions** before context
  grows. Already dogfooded: [`cold-seat-economy.md §3`](../../../.claude/rules/cold-seat-economy.md)
  shows fresh-with-watchlist ≈ half the tokens of file-reading resume. **The discipline is already
  codified**; the candidate is operational tuning, not a new tool.
- **New candidate surfaced:** **bounded-session + watch-list handoff discipline**. T16 statement:
  > Upstream: long-running tasks needing resumable context. Our problem class: median 213-turn
  > sessions already exceeding the cache-stability sweet spot. Match? **Strong — and already
  > shipped as cold-seat-economy.md.** Provisional verdict: **ADOPT (continue)** — operational only.

### Negative-existence claim — 6-item checklist (phase-research-coverage.md §1)

**Claim:** *«No upstream analog was found that intercepts `Read`-tool-result payloads (file
contents) generically and compresses them before they enter context — the way RTK does for
Bash output.»* This is the **largest single tool-result class in §2.5 (14.6M chars / 36.5% of
total)**, so the absence is load-bearing.

| # | Item | Result |
|---|---|---|
| 1 | Own-stack sweep | CC Read tool — no built-in compression; compact line-number format is the only economy. `pages:` parameter is user-driven, not auto. |
| 2 | Category sweep | Output-filter tooling (RTK), KV-cache eviction (model layer), summarisation frameworks (LangChain) — none target Read-result payloads at the agent-context boundary. |
| 3 | Semantic-distance check | «file-content compressor» / «tool-result preprocessor» / «agent-context middleware» — three phrasings, no production tool surfaced. |
| 4 | Adversarial counter-prompt | «If a Read-result compressor existed, where would it live?» → MCP server, hook layer, or CC plugin. Probed MCP servers registry (WebSearch); no Read-payload-compressing server surfaced. CC's hooks are PostToolUse-after-the-fact — the payload has already entered context. |
| 5 | Prompt-list ≠ complete | §3 named RTK (Bash-only). The absence here is on the **adjacent** surface (Read), not a deeper enumeration of the named candidate. |
| 6 | Trigger sweep at phase entry research (`grep -nE "^### 13\." docs/meta-factory/open-questions.md`, classify FIRED / STILL ARMED / CASCADE-DEPENDENT) | Ran 2026-08-01: 18 entries. **FIRED by this stage:** §13.11 (LLM cost model — §2.1 IS the cost model, measured) and §13.16 (search-coverage discipline — applied here, principle 13 already ships). **STILL ARMED:** §13.17 (hot/warm/cold tiering — deferred, no CC-integrated impl yet), §13.22 (L2 Research Agent — Phase 5+), §13.34/§13.35/§13.37/§13.40 (autonomous self-audit, 1%-Rule, pressure scenarios, meta-factory CLI — no signal). **Already closed elsewhere:** §13.31 (Wave 9 theatre audit), §13.32 (Phase 10 foundations). §13.38 (CC v2.1.100+ token inflation) STILL ARMED — Anthropic fix not confirmed; this stage's measurement baseline predates the regression. §13.39 H1 SHIPPED / H10 ARMED. No new `§13.x` opened by this candidate. |

**Verdict on the claim:** `coverage insufficient` (T14), NOT «category clean». The most defensible
statement is: «no production-grade Read-result-payload compressor was surfaced under the
container-reachable search ceiling; its absence is consistent across 4 phrasings but not
exhaustively excluded». The distillation seat may have host-side tooling the container lacks.

## W4 — Next-stage proposals

Per kickoff §4 descope: **proposals only — no implementation, and no self-selected winner**. Each
proposal = one sentence of scope + the §2 cost line it attacks + cost-gate class + trigger.
Ordered by §2.1 cost line attacked (cache READ 53.3% → cache WRITE 32.2% → output 14.0%).

### Proposal P1 — prompt-prefix-stability audit (cache READ 53.3% + cache WRITE 32.2%)

- **Scope:** stage A's attribution plumbing extended to measure, per turn, how many cache WRITEs
  fire on turns that should have been pure cache READs — i.e. prefix-churn events. Lever is
  **discipline** (static-first, dynamic-last prompt ordering), not a tool.
- **Cost-gate class:** **cheap** (measurement + prompt-ordering discipline; no dependency).
- **Trigger:** stage A's per-turn attribution shows >5% of turns re-WRITE a prefix that should
  have been cache-stable.

### Proposal P2 — disclosure-gap closure (cache WRITE 32.2% + cache READ 53.3%)

- **Scope:** stage A's W4 ranked disclosure-gap artefacts get `paths:`-glob + `claudeMdExcludes`
  treatment so they load only when relevant. Mechanism shipped (W1.1); closure work.
- **Cost-gate class:** **cheap** (rule/config edits).
- **Trigger:** stage A's ranked list shows ≥1 resident artefact irrelevant on >50% of turns.

### Proposal P3 — sub-agent delegation tuning (cache WRITE 32.2% + output 14.0%)

- **Scope:** ship `cold-seat-economy.md §3` "inline inputs in the dispatch prompt" as project-wide
  default for cold audit/review seats. Already measured (85k vs 177k tokens).
- **Cost-gate class:** **cheap** (skill-text edit).
- **Trigger:** any stage dispatching >2 cold audits per PR.

### Proposal P4 — Bash-output economy via skill-text (cache WRITE 32.2%, narrow)

- **Scope:** skill teaching the agent to pipe verbose-but-irrelevant Bash through `head`/`grep`/`wc`.
  Config-only equivalent of RTK — captures part of RTK's gain without the binary dep.
- **Cost-gate class:** **cheap** (skill-text edit).
- **Trigger:** a measured Bash-heavy class where Bash output >30% of resident-context tokens
  (per candidate-1, ~1.9-3.5% of total).

### Proposal P5 — output-format economy audit (output 14.0%, narrow)

- **Scope:** audit structured-output-adjacent calls (TACO-like tool outputs, snapshot regens, SSOT
  row formats) for JSON→YAML + terse field names. Microsoft finding (YAML < JSON) is the only
  documented economy direction on output.
- **Cost-gate class:** **cheap** (text edits).
- **Trigger:** a measured call class producing structured output exceeding 1% of total output cost.

### Proposal P6 — RTK operator-axis trial (cache WRITE 32.2%, Bash-only)

- **Scope:** a measured Bash-heavy session class on which candidate-1's falsifier would fire
  (>5% of total weighted cost removed). Operator-axis only; never shipped.
- **Cost-gate class:** **cheap on operator** (Homebrew, env var); **expensive on shipped** (Rust
  binary dep — rejected).
- **Trigger:** a Bash-heavy session class observed in stage A's per-turn attribution.

### Parked (not proposed)

- **Structured-context-eviction (CWL)** — academic, BUILD cost, no CC-integrated impl. Parked
  until a production-grade upstream emerges; do not propose BUILD on an academic paper.
- **Anthropic engineering plugin** — PENDING the harvested verdict (candidate 4). Re-propose or
  drop at the distillation seat.

## W5 — T15 self-application (kickoff §5 trap T15 — mandatory)

This patch is **itself** a resident-context artefact on the surface this survey evaluates; T15
requires it be audited against its own discipline rather than exempted.

- **Cost to read (re-measured 2026-08-01):** 599 lines, 45,531 chars ≈ 11.4k est-tokens (chars/4)
  resident across any cold-seat that loads it. At median 213-turn residency that is 11.4k × 22.45 ≈
  256k weighted units/session — one of the larger rules this project ships. **The distillation seat
  should treat this patch as a one-shot input, not a resident artefact** — read once, extract
  verdicts, drop.
- **Progressive disclosure (the discipline candidate 2 evaluates)?** No — single flat dump, by
  design (kickoff §0: «write raw and complete, not polished»). The disclosure pattern lives in
  rules and skills, not in research-patches; a flat patch is the correct shape for a one-shot input.
- **Did the survey run on itself?** Yes — §2.5's Read-tool payload row names this surface (Read
  14.6M chars / 36.5% of tool-result payload). Any cold-seat that re-Reads pays the residency
  multiplier; mitigation is the `cold-seat-economy.md §3` «inline inputs» pattern.

## Coverage

**Reached:** WebSearch (12 phrasings across W2/W3 — all quoted inline), DeepWiki (`rtk-ai/rtk`,
`obra/superpowers`, `anthropics/claude-code`), context7 (`/llmstxt/code_claude_llms_txt`),
in-repo source citations (`cold-seat-economy.md §3`, `.claude/settings.json:214`,
`build-first-reuse-default.md §1.1`, the arch-v2 kickoff + calibration.md), SSOT grep on
`prior-art-evaluations.md`. **NOT reached:** `git fetch origin staging` (TLS handshake to
github.com fails from the aif container — candidate-4 patch-presence check records
`INCONCLUSIVE — tooling unreachable from container`), `claude-code-guide` agent (not in aif
container per kickoff §0), host-side `bash scripts/host-verify.sh` (container is not the host per
kickoff §6 — runs at harvest), `vitest` for principles 08/10 (devDeps omitted under
NODE_ENV=production in container — also deferred to host). **PENDING-STAGE-A:** artefact-level
disclosure-gap enumeration (§3 item 2 / candidate 2), per-turn cache-churn attribution
(proposal P1's trigger), full Bash-heavy session-class measurement (proposal P4/P6 triggers).
