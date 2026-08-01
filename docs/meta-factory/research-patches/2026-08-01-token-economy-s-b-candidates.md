<!-- scope: stage B token-economy research — BFR-disciplined candidate survey against the §2 measured profile; zero-build; Opus distillation seat owns ranking. -->

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
   - **S-A** `/arch` v2 rewrite + L1 attribution plumbing;
   - **S-B** dispatch-input contract v2 + shadow-A/B calibration ledger (the
     [`calibration.md`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md)
     read for this section);
   - **S-C** L2 population table + 5-option BFR verdict (null option live);
   - **S-D** L2 build — whatever S-C selects;
   - **S-E** L1 budget gate at pre-push/CI + `InstructionsLoaded` blocking verification;
   - **S-F** small-fixes queue.
   **What the umbrella owns:** L1 measurement/attribution/budget-gating, L2 per-role context
   verdict, dispatch-input reality-check choreography. **What it does NOT own:** external candidate
   surveys (RTK and siblings) and native-harness feature adoption verdicts — exactly stage B's
   scope. The token-economy research (stages A+B) feeds evidence INTO S-E's budget gate and S-C's
   L2 verdict; it does not duplicate them.

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
> addresses Bash output, which is a small minority of this project's resident-context tokens.
> Evidence: §2.5 Bash payload ≈ 20.6M chars ≈ 5.15M tokens across the corpus; §2.1 cache-READ raw =
> 17.5B tokens — Bash output is ~0.03% of cache-read raw token volume.

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
  test` shapes; coverage on this mix is unmeasured); (c) the residency-multiplier gain assumes the
  compressed payload still lets the model act correctly — if the model re-runs a command to see
  full output, the saving evaporates.

**The vendor's own README disclaims the bill-reduction framing** — this arithmetic is the
project-side confirmation of that disclaimer.

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
    official Agent Skills docs + multiple deep-dives confirm the filesystem-based three-tier pattern
    (name+description hot, `SKILL.md` warm, bundled reference files cold);
    [arxiv 2607.17598](https://arxiv.org/html/2607.17598v1) («Is Progressive Disclosure All You Need
    for Long-Context…») academic validation.
  - `agent framework progressive disclosure layered context loading` (run under candidate-3 batch)
    → same pattern across Cursor rules / Aider conventions / Cline Memory Bank.
  - `Claude Code claudeMdExcludes partial eviction rules still loaded` → surfaced the partial-eviction
    behaviour stage A independently found (a rule excluded from CLAUDE.md remains loaded as a project
    instruction via CC's parallel rules auto-load channel).
- DeepWiki `ask_question` on `obra/superpowers` (run 2026-08-01): Superpowers ships exactly this
  pattern — at startup only `name`+`description` from YAML frontmatter are pre-loaded; full
  `SKILL.md` read on-demand; bundled `FORMS.md`/`reference.md`/`examples.md` loaded only when
  accessed; `SKILL.md` recommended ≤500 lines; cross-referencing instead of repeating; **ongoing
  `SKILL.md` minification pass** (`docs/superpowers/specs/2026-06-10-strict-cost-sdd-design.md`)
  because «even frequently re-read skills incur significant token costs over a long session».
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
Cost line: **cache WRITE 32.2% + cache READ 53.3%** (resident-context head, 85.5%) — the **largest
attack surface in this survey**. Disclosure removes a token from resident context entirely: saving =
`tokens_removed · (1.25 + residency_multiplier · 0.1)` weighted units.
Worked example: one 200-line (~3k-token) rule file resident across a median 213-turn session costs
`3 000 · (1.25 + 21.2) ≈ 67 000` weighted units/session → `67 000 · 247 sessions ≈ 16.6M` weighted
units = **~0.5% of §2.1 total per such file**. Each disclosure gap stage A ranks is roughly this
order of magnitude; the aggregate depends on how many artefacts are partially-evicted (stage A's
`PENDING-STAGE-A` number).

**4. Two-axis verdict.**
- **Operator axis: `ADOPT` (continue + close the partial-eviction gap).** The pattern is
  upstream-validated (Superpowers + Agent Skills spec + this project's W1.1) and already in force.
  The open work is **configuring the partial-eviction channel** (stage A's finding) and confirming
  every rule is under a `paths:` glob so it loads only when relevant. Cheap.
- **Shipped axis (provisional, one line): `ADOPT` (provisional).** Progressive disclosure is the
  harness-native pattern and AI-/OS-agnostic. **Open question:** are `claudeMdExcludes` and
  `paths:`-glob auto-load portable across consumer harnesses (Cursor/Cline/Aider), or CC-specific?
  Stage A may address this; flagged for the distillation seat.

**5. Cost gate.** **Cheap** on both axes — text/rule/config edits, no dep, no code module, no
infra. The partial-eviction fix is a settings.json edit + verifying each rule carries a `paths:`
glob. No friction instance needed.

**6. Falsifier.** Stage A's per-artefact measurement shows a given disclosure-gap artefact is NOT
resident on turns where it is irrelevant (i.e. the disclosure is already working) — would downgrade
the priority of closing that specific gap without changing the verdict on the pattern.

**`arch-v2 overlap:` PARTIAL with S-C** ([`kickoff.md:91`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md)).
S-C's L2 population table + 5-option BFR verdict will adjudicate which L2 ambient context to load;
stage A's ranked disclosure gaps + this candidate's mechanism menu feed INTO that verdict. This
candidate does not duplicate S-C — it provides the mechanism options S-C selects among.

### Candidate 3 — Claude Code native context management

**Own-stack-first, criterion zero (kickoff W1 item 3):** these are features of the harness already
in use. Establish what exists AND what is configured today before evaluating any external overlap.

**1. BFR §3 mechanism — run and shown.**
- WebSearch (3 phrasings, run 2026-08-01):
  - `Claude Code progressive disclosure layered context skill references cold load mechanism` →
    official Agent Skills docs + academic validation (arxiv 2607.17598).
  - `Claude Code /compact auto-compact context window token reduction effectiveness measurement` →
    [Claude Cookbook on automatic compaction](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction):
    **122,392 token savings (58.6% reduction)** in the worked example; auto-compact triggers at the
    ~95% capacity threshold; [claudefa.st](https://claudefa.st/blog/guide/mechanics/context-buffer-management)
    notes the autocompact buffer shrank 45K→33K; [JetBrains observation-masking research](https://www.albertsikkema.com/ai/development/tools/2026/04/23/smaller-context-window-better-claude-code.html):
    **52% cost reduction + 2.6% solve-rate boost**. **Honest cost:** reddit reports losing 20–25k
    tokens of information on auto-compact — compaction is lossy, not free.
  - `Claude Code sub-agent context isolation token savings parent transcript background` →
    [official sub-agents docs](https://code.claude.com/docs/en/sub-agents); **critical honest signal**
    from [r/ClaudeCode](https://www.reddit.com/r/ClaudeCode/comments/1q6jr9o/yes_subagents_save_context_but_they_use_a_lot_of/):
    *«the subagent loads the entire Claude Code context just to run 3 bash commands»* — sub-agents
    trade parent-context for sub-agent-context, not a free win.
- DeepWiki `ask_question` on `anthropics/claude-code` (run 2026-08-01): compaction auto-triggers
  when the conversation grows too large + `/compact` manual; Read tool uses a compact line-number
  format and deduplicates unchanged re-reads; `CLAUDE_CODE_SIMPLE` disables CLAUDE.md loading;
  **MCPSearch deferral — when MCP tool descriptions exceed ~10% of context window they are deferred
  and discovered via the `MCPSearch`/`ToolSearch` tool instead** (`alwaysLoad` overrides per-server);
  subagent context isolation (only the final message returns to parent); `isolation: "worktree"`.
- context7 `/llmstxt/code_claude_llms_txt` (run 2026-08-01): same features confirmed; explicit
  `permissions.deny: ["ToolSearch"]` config to disable the deferral.
- SSOT grep: `#103` already records the Claude Code config/memory surface (REFERENCE).
- **Configured today on this project** (verified, not recalled):
  - `claudeMdExcludes` — YES (7 entries, `.claude/settings.json:214`; partial eviction per stage A).
  - `ToolSearch`/MCPSearch deferral — IMPLICIT (no `permissions.deny` set; the §2.4 tool-call
    frequency shows `ToolSearch 154` calls — the feature is live and being used).
  - Compaction — IMPLICIT (no config; harness default fires at ~95%).
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
- **Compaction**: shrinks conversation going forward. The 58.6% reduction is on conversation
  history, not total weighted cost — affects only turns AFTER the compaction event. On a 213-turn
  median session with compaction firing once near the end, the forward saving is small; on an
  833-turn max session it is large. **Lossy** — trades context for cost.
- **Sub-agent isolation**: saves parent cache WRITE+READ of intermediate results, but the sub-agent
  pays its own context cost. Net win only when the sub-task's intermediate work is large and the
  result is small (the cold-seat-economy.md §3 measured tradeoff: inlined inputs = 85k vs
  file-reading = 177k — the SAME shape).
- **Read dedup / compact line format**: modest; harness default.

**4. Two-axis verdict.**
- **Operator axis: `ADOPT` (continue + tune).** All five features are live or implicit-default. The
  work is (a) confirming every rule/skill is under a `paths:` glob or `claudeMdExcludes`-equivalent
  (closes candidate-2's gap), (b) measuring whether the 95% compaction threshold is right for this
  project's loss-tolerance, (c) using sub-agent delegation where the cold-seat-economy table shows
  a net win. **No new adoption — configuration + discipline.**
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

### Candidate 4 — Anthropic `engineering` plugin (reduced block — PENDING)

**1. BFR §3 mechanism — run and shown (the only reachable slice).**
- Patch-presence probe on `origin/staging` (kickoff §3 item 4): `git fetch origin staging` →
  **failed with TLS handshake error** (`fatal: unable to access ... SSL_ERROR_SYSCALL`;
  recurrence of the §0 container-tool-reality note — github.com is unreachable from the aif
  container, `api.github.com` is reachable). Recorded per kickoff §0 escape clause:
  **`INCONCLUSIVE — tooling unreachable from container`** for the staging-presence check.
- Reduced-block trigger met (kickoff §3 item 4 second branch): the prior-art verdict for this
  plugin is owned by aif task `53c2ecdd-9194-4f6f-bfca-6a3047de214e` (kickoff
  `anthropic-engineering-prior-art`), which reached `done` on 2026-08-01 but whose research-patch
  had **NOT** landed on `origin/staging` at this revision (harvest pending). Recorded verbatim:
  **`PENDING — task done, verdict not yet harvested to staging`** (kickoff §3 item 4 — **not a
  blocker**, explicitly).
- WebSearch on the plugin's stated scope (1 phrasing — reduced-block ceiling): surfaces that the
  Anthropic `engineering` plugin is a Claude Code plugin sold on its `claude engineering` /
  code-review surface, not a published token-economy mechanism; vendor pages do not advertise
  context-reduction features.
- SSOT grep (`grep -niE 'engineering.*plugin|anthropic.*plugin' docs/meta-factory/prior-art-evaluations.md`):
  **0 hits.** No prior verdict recorded on this plugin.

**2. T16 problem-class statement (on the plugin's STATED scope — the only ground the reduced
   block can stand on without the harvested verdict).**
> Upstream problem class (stated): code-review / engineering-quality assistant delivered as a
> Claude Code plugin. Our problem class: token-economy mechanism survey against §2.1. Match?
> **UNKNOWN on adoption overlap; likely NO on surface** — the plugin's advertised surface is
> code review, not context reduction. **Verdict reserved** pending the harvested research-patch;
> this reduced block does NOT manufacture a verdict from recall of the plugin.

**3. §2.1 cost line attacked + arithmetic.** **Cannot be computed honestly without the harvested
verdict.** The plugin's advertised surface (engineering / code review) does not directly attack
any §2.1 row; IF the harvested patch surfaces a context-economy mechanism inside the plugin, that
verdict will name the row and the arithmetic. Recording a number here would be T3 (prose-only
finding) on a verdict not yet harvested.

**4. Two-axis verdict.** **Operator + shipped (both provisional): `DEFER`-with-trigger.** Trigger:
the harvested research-patch landing on `origin/staging` (aif task
`53c2ecdd-9194-4f6f-bfca-6a3047de214e`'s harvest), at which point a full W2 block replaces this
reduced block. The DEFER is on the **evidence base**, not on the plugin — a verdict on the plugin
itself is reserved. Per kickoff §4a (park-don't-guess): picking a verdict now would be the silent
fork this stage refuses.

**5. Cost gate.** **Unknown** — depends on what the plugin turns out to be (free plugin = cheap;
paid-tier feature = expensive on operator, REJECT on shipped per no-paid-llm-in-ci). Deferred
with the verdict.

**6. Falsifier.** The harvested research-patch lands and surfaces zero context-economy mechanism
inside the plugin → this candidate is removed from the distillation seat's input set.

**`arch-v2 overlap:` UNKNOWN** — depends on the harvested verdict.
