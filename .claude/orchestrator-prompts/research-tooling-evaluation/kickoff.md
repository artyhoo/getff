# Research-tooling evaluation — KICKOFF

> **Status:** EXECUTED 2026-05-16 → research patch `docs/meta-factory/research-patches/2026-05-16-research-tooling-evaluation.md` (commit d0a40e2); SSOT entries #42–#46 + #27–#30 corrections landed in commit 828e31c. DO NOT re-dispatch.
> **Origin:** post-Wave-9 prioritisation session dialogue (2026-05-13). Maintainer surfaced hypothesis: «возможно я ресёрчил инструменты не тем инструментом — Context7 для tool-selection не оптимален; DeepWiki MCP даёт другой ответ (архитектура + tradeoffs vs API-signature)». Three external claims verified in same session: DeepWiki MCP scope/tools/pricing ✓, Claude Code Agent Teams flag/version ✓, v2.1.100+ token inflation bug ✓.
> **Type:** standalone research session, NOT wave/phase. Single sitting, 2-4 hours.
> **Deliverable:** research patch + SSOT entries; no code changes.
> **Estimated effort:** 2-4 hours one session.

---

## §1 Problem this session solves

Project's `prior-art-evaluations.md` SSOT has been built primarily on **Context7 MCP + WebSearch + manual reasoning**. Context7 is designed for «how to call this API right now» queries — it returns documentation snippets keyed to specific library tasks.

For **build-vs-reuse evaluation** (this project's load-bearing discipline per [CLAUDE.md](../../../CLAUDE.md)), the relevant questions are different:
- «How is library X architected internally? What are its constraints?»
- «How does library X differ from library Y at the structural level?»
- «What tradeoffs did library X's authors make? Why?»
- «Does library X's problem class match our problem class?» (T16 check in [`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md))

These are NOT Context7's design center. They are **DeepWiki MCP's** design center — `ask_question` is grounded in actual repo code + architecture; `read_wiki_structure` returns topic list as a starting point.

**Open question (this session's central goal):** how often did past R-phase research patches in this project under-evaluate prior-art because Context7 was the dominant tool and didn't surface architectural / tradeoff information that DeepWiki would have? Targeted, evidence-based check — NOT blanket assertion.

**Companion concern:** Claude Code v2.1.100+ token inflation bug (GitHub issue [#46917](https://github.com/anthropics/claude-code/issues/46917)) materially affects ANY plan that scales Claude Code sessions (Agent Teams, parallel sub-waves, Phase 10 swarming). Out of scope for evaluation here, but in-scope for noting in §findings + open-questions impact.

---

## §2 Goal

Three concrete outputs:

1. **SSOT entry #42 — DeepWiki MCP** with verdict (ADOPT / ADOPT-CONDITIONAL / DEFER / REJECT) based on this session's evaluation. Pre-bias: verdict is likely ADOPT-CONDITIONAL given confirmed free+no-auth scope + obvious architectural-research fit; but R-phase must verify via own use (not just propagate maintainer/external-AI claim).

2. **Decision matrix in research patch §X — Research-tool selection criteria.** Concrete: «for question shape Y, use tool Z». Table format. Examples per row. At least 4 row categories covering: API-signature lookup, architectural understanding, cross-library comparison, build-vs-reuse SSOT evaluation.

3. **Targeted backfill check (≤3 past patches).** Pick 2-3 specific recent prior-art entries in `prior-art-evaluations.md` (e.g. SSOT #38 CodeRabbit DEFER, SSOT #41 Danger JS ADOPT, SSOT #33 Continue.dev) and ask DeepWiki the same questions that produced the verdict. Did DeepWiki surface new evidence that would have changed verdict? **YES** → flag as «retroactive coverage gap»; create research-patch entry per [`phase-research-coverage.md §1`](../../rules/phase-research-coverage.md) discipline. **NO** → no action; document the negative finding (which is itself evidence Context7-only was adequate for those specific cases).

**Out of scope:**
- Re-running ALL past prior-art entries. T4 «closing R-phase prematurely» counter-counter: targeted, not blanket.
- Adopting DeepWiki as default research tool without verdict. Verdict first, adoption second.
- Building any tooling integration (MCP install scripts, automation). Documentation-only deliverable; integration is separate work after verdict.
- Re-evaluating Context7 itself. Context7 stays; question is when to use it vs DeepWiki, not whether to keep Context7.

---

## §3 Hard constraints

- **No paid LLM in CI.** DeepWiki is free for public repos — fits. Verify in §findings that the specific repos this project would query are publicly accessible.
- **Build-vs-reuse SSOT consult.** DeepWiki is a tool-selection candidate; needs `prior-art-evaluations.md` entry (#42 proposed) before declaring «we use DeepWiki for X».
- **Search-coverage discipline.** Per [`phase-research-coverage.md §1`](../../rules/phase-research-coverage.md) 6-item checklist on any negative-existence claim («DeepWiki has no production analog for our use case» etc.).
- **T3 verify-before-stating.** Every «DeepWiki returns better answer for question Y» claim in §findings must be backed by: actual `ask_question` invocation + actual response excerpt + side-by-side with the Context7 result for the same question.
- **T11 designing without prior art.** Before proposing «we adopt DeepWiki for X workflow» — context7 sweep on «MCP-based code research tools» to confirm DeepWiki is best-in-class vs alternatives (Sourcegraph Cody, GitHub Spark, OpenAI Codex search, etc.). ≥3 phrasings.
- **T16 problem-class match.** DeepWiki = upstream «understand open-source repo architecture». Our problem = «build-vs-reuse decisions on tools we may adopt». Match? Verify explicitly — DON'T assume because the tool was framed by maintainer/external-AI as «better for research».
- **Atomic commits.** Research patch as single commit. SSOT entry #42 in same commit (per [CLAUDE.md](../../../CLAUDE.md) build-vs-reuse policy — capability-commit gate).

---

## §4 Methodology

### §4.0 Prior art sweep (BEFORE evaluation)

**context7 queries — обязательно все:**

1. `deepwiki mcp model context protocol public repos` — confirm tools + endpoint independently
2. `sourcegraph cody mcp code search architecture` — alternative for cross-repo code understanding
3. `github mcp server architecture search` — official GitHub MCP capabilities
4. `mcp code research tools comparison 2026` — recent landscape
5. `code understanding ai tools comparison` — broader category

**WebSearch queries:**

1. `«DeepWiki MCP vs Context7 build-vs-reuse research workflow 2026»` — has anyone written this comparison?
2. `«MCP server architecture research tool selection criteria»`
3. `«devin deepwiki indexing coverage which repositories indexed»` — answers the «scope» unknown from initial verification

**Output:** ≥5 external sources in §findings with URLs + verdicts. Especially: does any production project document a Context7-vs-DeepWiki workflow? If yes — cite + adapt. If no — record as «no production analog» per `phase-research-coverage.md` §1 6-item checklist.

### §4.1 Experimental comparison

> **Tool availability check FIRST:** before §4.1 — run `ToolSearch` для `mcp__deepwiki__*`. Если tools НЕ найдены: kickoff'овский претензия «DeepWiki установлен 2026-05-13» неверна для текущей сессии. ABORT §4.1 + escalate maintainer'у вместо continue-with-degraded-methodology. Это T3 verification gate — не предполагай availability, проверь.

Pick 3 concrete questions that recent research patches answered using Context7. For each, run the same question through DeepWiki's `ask_question` against the relevant repo. Document:

| Question | Context7 result (excerpt + URL) | DeepWiki result (excerpt + URL) | Delta | Verdict-change relevant? |
|---|---|---|---|---|
| ... | ... | ... | ... | YES / NO |

**Sample questions (R-phase picks own; these are suggestions):**

1. From SSOT #41 ADOPT (Danger JS): «How does `danger.git.commits` API expose commit message bodies for trailer parsing? What are the limitations?»
2. From SSOT #38 DEFER (CodeRabbit): «Does CodeRabbit's review pipeline allow deterministic non-LLM rules?»
3. From SSOT #33 DEFER (Continue.dev): «How is Continue.dev's per-tool permissions YAML schema structured? What's its scope?»

If 0/3 surface new evidence → DeepWiki adoption verdict shifts toward DEFER or ADOPT-CONDITIONAL with narrow scope.
If 1-2/3 surface new evidence → ADOPT-CONDITIONAL with documented use-case.
If 3/3 → ADOPT with clear «use DeepWiki for any new prior-art evaluation» policy.

### §4.2 Coverage gap check

For each of the 3 sample questions:

- Did DeepWiki return information that **would have changed verdict** (ADOPT → REJECT, DEFER → ADOPT, etc.)?
- If yes — that's a retroactive coverage gap. Open new research-patch entry per [`phase-research-coverage.md §3 aggregation`](../../rules/phase-research-coverage.md): «context7-only sweep missed architectural evidence X surfaced by DeepWiki».
- If no — that's a negative finding (Context7 was adequate for those questions). Document explicitly to avoid T14 («clean audit ≠ no theatre»).

### §4.3 Decision matrix construction

Format: 4+ rows. Each row:
- **Question shape** (concrete pattern, e.g. «How does library X handle case Y?»)
- **Recommended tool** (Context7 / DeepWiki / WebSearch / Multi)
- **Rationale** (why this tool fits this shape)
- **Example** (specific past or hypothetical query + tool that fits)

Baseline categories to cover (R-phase may add):
1. API signature / current usage — Context7
2. Architectural understanding / tradeoffs — DeepWiki
3. Cross-tool comparison — WebSearch + DeepWiki + Context7 (multi)
4. Build-vs-reuse SSOT evaluation — DeepWiki primary + Context7 + WebSearch as cross-check
5. (R-phase adds if found)

### §4.4 Self-application (T15)

This research session itself is a tool-selection exercise. Apply the resulting decision matrix RETROACTIVELY to this session's own methodology: «which questions in §4.0 prior art sweep should have used DeepWiki vs Context7 per the matrix I just produced?» If matrix says DeepWiki for ≥1 row but R-phase used Context7 for that row — flag in §findings + iterate.

---

## §5 R-phase output requirements

**File:** `docs/meta-factory/research-patches/2026-MM-DD-research-tooling-evaluation.md`

**Mandatory sections:**

- **§1 Problem** — restates §1 of kickoff in R-phase's own words
- **§2 Prior art sweep** — results of §4.0; ≥5 external sources cited; explicit «no production analog» check per [`phase-research-coverage.md §1`](../../rules/phase-research-coverage.md) 6-item if claim made
- **§3 Experimental comparison** — table per §4.1; 3 questions; side-by-side excerpts
- **§4 Coverage gap check** — per §4.2; YES findings → research-patch sub-entries opened
- **§5 Decision matrix** — per §4.3; minimum 4 rows; concrete examples per row
- **§6 SSOT entries proposed** — entry #42 DeepWiki MCP with full Verdict / Rationale / Trigger-to-revisit; per [`prior-art-evaluations.md §3`](../../../docs/meta-factory/prior-art-evaluations.md) entry-trigger criteria
- **§7 Adversarial counter-prompt** — «what tool category did I miss in §4.0 sweep?» — concrete tool name candidates, not «in general I covered the space»
- **§8 Open decisions (Dn)** — for maintainer
- **§9 Recursive self-application** — per §4.4 — did this session apply its own output?
- **§10 §1.7 forward+backward check** — required (this session touches `prior-art-evaluations.md` which is in pre-push hook gate via §3 SSOT path)

---

## §6 AI laziness traps active for this session

Per [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md):

**T1** — sampling-based audit floor = 5; recommended ≥10 if checking past patches. This session's §4.2 baseline = 3 sample questions → if 1/3 surfaces gap, escalate to 5+ samples before drawing conclusion (don't conclude from N=3 in either direction).

**T2** — «my methodology would catch theatre, so I don't need to run it». For §4.1 — designing the comparison table doesn't substitute running it. Run `ask_question` 3 times. Cite the outputs verbatim.

**T3** — «plausible-looking finding without verification». For every «DeepWiki gives better answer for X»: actual `ask_question` invocation + actual output excerpt + URL. No prose-only claims.

**T8** — «asking maintainer to avoid doing the work». D-decisions (§5 above) batched at review; not surfaced as «should I X?» mid-session.

**T11** — «designing without checking external prior art». §4.0 mandatory before §4.1. Don't skip context7 sweep claiming «DeepWiki is obvious choice».

**T12** — «skipping literature sweep because I already know the area». Tempted: «I (R-phase AI) already know Context7 vs DeepWiki tradeoffs». NO. WebSearch and context7 the comparison even if confident from training data.

**T13** — «treating ADOPTED items as zero-work». Maintainer/external-AI framed DeepWiki as «better for research». That's framing, not verification. Even if upstream is real, **our problem-class match** is the audit unit (T16).

**T14** — «clean audit = no theatre». If §4.2 returns 0/3 verdict-changes → write «Context7 adequate for these 3 sample questions; coverage insufficient to conclude Context7 adequate in general». Distinguish carefully.

**T15** — **self-application MANDATORY** per §4.4. This session is itself a tool-selection exercise; produce a finding about own methodology.

**T16** — DeepWiki upstream problem class = «open-source repo wiki + Q&A grounded in code». Our problem class = «build-vs-reuse SSOT evaluation for tools we might adopt». Match? — likely YES but verify explicitly with one concrete example. If our use-case is e.g. private-internal-pattern research, match fails and DeepWiki = REJECT for that surface.

**Domain-specific T-RT-A — «framing-by-maintainer bias».** Maintainer surfaced this session with hypothesis «DeepWiki is better for research». R-phase under pressure to confirm. Counter: explicitly entertain the null hypothesis «DeepWiki is **not** materially better; Context7 was adequate». §4.2 NO findings is a valid conclusion — don't manufacture coverage-gaps to justify the new tool.

**Domain-specific T-RT-B — «v2.1.100 bug as scope creep».** Side-finding from session start. NOT in scope to fix. NOT in scope to evaluate downgrade strategy in depth. IS in scope to note in §findings + propose §13.x entry if maintainer wants tracking. Resist temptation to expand session into Claude-Code-version-policy R-phase.

---

## §7 Open decisions (Dn) — for maintainer after R-phase

**D1 — Verdict on DeepWiki MCP.** ADOPT / ADOPT-CONDITIONAL (with scope spec) / DEFER / REJECT, based on §3-§4 findings. R-phase proposes; maintainer confirms.

**D2 — Decision matrix promotion path.** If matrix in §5 lands — promote to `.claude/rules/research-tool-selection.md`? Or keep in research patch only? (Promotion threshold = «next 3 phase-entry sessions use it without amendment» per [`phase-research-coverage.md §5`](../../rules/phase-research-coverage.md) retention pattern.)

**D3 — Backfill scope.** If §4.2 surfaces verdict-changing gaps in 1-3 past patches: re-evaluate those entries now (this session), or open §13.x entry for later? Default = open §13.x, don't expand this session.

**D4 — v2.1.100 token bug response.** Note as observation only (default), or open §13.x entry for Claude-Code-version policy? Out-of-scope for fixing here; in-scope for noting impact on Phase 10 / Agent Teams plans.

**D5 — Agent Teams readiness.** Related but distinct: should there be a follow-up research session on swarm-operational-readiness (kickoff sketched 2026-05-13 in dialogue)? Out-of-scope for this session; D5 is just «yes/no/later» pointer.

---

## §8 Self-application requirement

This kickoff itself is discipline-bearing. Its claims (§1 problem framing, §4.1 comparison table design, §4.3 matrix structure) are **unverified estimates**. R-phase MUST:

1. Re-state §1 problem in own words; if R-phase's framing differs materially, flag in §findings (drift signal).
2. If §4.1 sample questions turn out to be poor samples (e.g. all 3 are API-signature questions where Context7 obviously wins) — replace with better samples covering architecture/tradeoff/comparison questions.
3. §9 of R-phase output answers: «did my matrix output apply to my own methodology in §4.0?» — recursive self-application gate.

---

## §9 See also

- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT; entry #42 DeepWiki MCP target slot
- [`.claude/rules/phase-research-coverage.md`](../../rules/phase-research-coverage.md) — search-coverage discipline + retention policy precedent
- [`.claude/rules/ai-laziness-traps.md`](../../rules/ai-laziness-traps.md) — T1, T2, T3, T8, T11-T16 active here
- [`docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md`](../../../docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md) — recent example of context7-only research patch; potential §4.2 sample candidate
- [DeepWiki MCP docs (verified 2026-05-13)](https://docs.devin.ai/work-with-devin/deepwiki-mcp) — tools, endpoint, pricing
- [Claude Code Agent Teams docs (verified 2026-05-13)](https://code.claude.com/docs/en/agent-teams) — Agent Teams official documentation
- [GitHub issue #46917 — v2.1.100 token inflation](https://github.com/anthropics/claude-code/issues/46917) — for §findings on Claude Code version impact
- [`CLAUDE.md` Build-vs-reuse invariant](../../../CLAUDE.md) — capability-commit gate

---

## §10 Verified facts pool (for R-phase, do NOT re-verify these)

Verified 2026-05-13 in pre-kickoff session (saves R-phase time):

- DeepWiki MCP tools: `read_wiki_structure`, `read_wiki_contents`, `ask_question`. Endpoint `https://mcp.deepwiki.com/mcp` (Streamable HTTP), `/sse` deprecating. Free + no-auth for public repos. Private repos = Devin subscription.
- Claude Code Agent Teams: env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; requires v2.1.32+; launched alongside Opus 4.6; TeammateTool API has 13 operations; experimental status with known limitations (no session resumption with in-process teammates, task status lag, slow shutdown, only one team at a time, no nested teams).
- v2.1.100+ token inflation: real, Anthropic-acknowledged, GitHub issue #46917 open, server-side, ~20K cache_creation token inflation per request vs v2.1.98, 40% commonly, 10-20× worst case. Workaround: downgrade to v2.1.34 via npm. No public fix date as of 2026-05-13.

Each of the above has a citation in the WebFetch / WebSearch outputs of the originating session; R-phase may cite these directly without re-fetching.

**Unknown at session start (R-phase to resolve):**

- Which specific GitHub repos are indexed by DeepWiki. Does it cover everything? Or only popular projects? Or only what Devin has analyzed? Critical for matrix row «build-vs-reuse SSOT evaluation» — if niche tools we want to evaluate aren't indexed, DeepWiki value diminishes.
- DeepWiki rate limits (docs silent).
- DeepWiki freshness — how often indexes refresh after upstream repo changes.

---

## §10.1 Pre-session empirical findings (2026-05-13, ad-hoc DeepWiki test on AIF)

> First-use DeepWiki test during post-Wave-9 prioritisation dialogue. NOT a substitute for §4.1 experimental comparison (which must be done methodically); ad-hoc record only. Treat as inputs to §4.1, not conclusions.

**Test 1 — `read_wiki_structure` on `lee-to/ai-factory`:** ✓ indexed, 10 topic sections returned, includes 3.3 Multi-Agent Support + 4.5 Parallel Development with Worktrees + 6 Self-Improvement System.

**Test 2 — `read_wiki_structure` on `lee-to/aif-handoff`:** ✗ **`Repository not found. Visit https://deepwiki.com/lee-to/aif-handoff to index it.`** Direct evidence: DeepWiki coverage is NOT universal — niche/less-popular repos need manual indexing trigger via deepwiki.com URL. **This is the first concrete data point for §10 «Unknown — which repos indexed».** Implication for matrix: «build-vs-reuse SSOT evaluation» row must flag «DeepWiki coverage check» as prerequisite before relying on `ask_question` for a given repo.

**Test 3 — `ask_question` on AIF skill naming + components:** DeepWiki returned current skill names as `ai-factory.implement`, `ai-factory.task`, `ai-factory.feature`, `ai-factory.verify` (dot-namespace). Said `implement-coordinator` subagent + `aif-handoff` component «not found in provided codebase».

**Test 4 — `query-docs` context7 on same library `/lee-to/ai-factory`:** Returned `aif-*` prefix (v2 convention) — `/aif-implement`, `/aif-plan`, `/aif-explore`. Confirmed `HANDOFF_TASK_ID` env var. Cited paths under `skills/aif-*` and `subagents/implement-coordinator.md`. Cited `AGENTS.md` explicitly stating «v2 mandatory `aif-` prefix; `ai-factory upgrade` migrates v1 bare names».

**Drift signal — two MCPs see different snapshots:** DeepWiki appears to index HEAD/main (where naming may have shifted v2 `aif-*` → v3? `ai-factory.*` namespace); context7 indexes the `2.x` branch explicitly. Same repo, two different temporal/branch perspectives. **This is a load-bearing finding for §5 decision matrix:** «freshness» dimension may need separate row — «which tool's snapshot is current for which kind of question». R-phase MUST explore this dimension in §3 experimental comparison; do NOT collapse to a single «which tool is better» verdict that ignores the temporal axis.

**Cross-implication for SSOT entries #27-#32 (AIF Handoff family):** these entries were captured 2026-05-10/11 via context7 against 2.x branch. If AIF shipped a v3 rename, paths cited in those entries (`subagents/implement-coordinator.md`, `skills/aif-implement/SKILL.md`, etc.) may not exist on main/HEAD. **Recommended R-phase output:** propose §13.x entry «SSOT staleness check schedule for FAST-velocity entries» or recommend 30-day check cadence for `velocity:FAST` entries (current 90-day → 30 days for FAST). Do NOT silently rewrite SSOT #27-#32 — that's its own atomic commit, not bundled into research-tooling patch.

**Cross-implication for swarm-readiness / Agent Teams discussion:** DeepWiki test 3 revealed AIF's `/ai-factory.feature --parallel` (or `--parallel` in 2.x equivalent) is more mature than our `parallel-subwave-isolation.md` rule documented. Specifically AIF auto-copies context files (`.ai-factory/`, `.claude/`, `CLAUDE.md`), auto-invokes downstream skills, offers automated merge+cleanup. Our rule is manual worktree create + manual orchestrator-side dispatch. **Out of scope for this session** (Agent Teams readiness research is separate per D5 in §7). But record finding so swarm-readiness research entry-point has this evidence.

**Indexing-trigger primitive:** DeepWiki provides URL-based indexing trigger. R-phase §4.0 must investigate: can this be programmatic? Does indexing take seconds, hours, days? What's the freshness post-indexing? If indexing is fast + reliable, DeepWiki is broader than its current index suggests; if slow/unreliable, niche repos remain context7-only territory.

**Indexing-trigger observation (2026-05-13, second test in same session):** maintainer manually triggered indexing of `lee-to/aif-handoff` via deepwiki.com URL during session; ~10-15 min later still returns «Repository not found» from `read_wiki_structure`. Indicates: either indexing pending (queued), OR UI workflow requires additional manual confirmation step that wasn't completed, OR there is no programmatic indexing trigger (need to verify in §4.0 by checking docs.devin.ai for indexing API/CLI). R-phase to confirm.

## §10.2 SSOT attribution errors discovered via DeepWiki + context7 cross-check (2026-05-13)

> **Origin:** post-Wave-9 prioritisation session; maintainer asked «may not have gathered all info» about `lee-to/ai-factory` + `lee-to/aif-handoff`. Cross-checking DeepWiki (HEAD/main of ai-factory) against context7 (2.x branch of ai-factory) AND context7 (aif-handoff main) surfaced wrong-repo attribution on multiple SSOT entries.

**Empirical finding:** Phase 8.8 / research-patches 2026-05-11 context7 sweep that produced SSOT entries #27-#30 (AIF Handoff family) **did NOT distinguish between `lee-to/ai-factory` and `lee-to/aif-handoff` as separate GitHub repositories**. The two are independent codebases:

- `lee-to/ai-factory` — CLI tool + skill system (workflow framework). Has `skills/` directory, no `subagents/` directory, no `aif-handoff` dependency or `HANDOFF_TASK_ID` references in current main (per DeepWiki ask_question test 3).
- `lee-to/aif-handoff` — separate autonomous task management system with kanban + coordinators/sidecars. Has `docs/configuration.md`, `docs/architecture.md`, `README.md`. Hosts the `plan-coordinator`, `implement-coordinator`, `review-sidecar`, `security-sidecar` subagents.

**Attribution corrections needed (do NOT do in this session — atomic-commit work for separate research-tooling R-phase output):**

| SSOT | Currently cites | Should cite per evidence | Severity |
|---|---|---|---|
| **#28** `paused:true` semantic | `lee-to/ai-factory v2.x, handoff_sync_status` | `lee-to/aif-handoff main, docs/architecture.md` | High — wrong-repo attribution |
| **#29** `<!-- handoff:task:<id> -->` annotation | `lee-to/ai-factory v2.x, skills/aif-plan/SKILL.md` | Both? Annotation in `aif-plan` (ai-factory 2.x) links to Handoff tasks (aif-handoff main). Need pair-of-paths citation. | Medium — incomplete attribution |
| **#30** `implement-coordinator` subagent | `lee-to/ai-factory v2.x, subagents/implement-coordinator.md` | `lee-to/aif-handoff main` (DeepWiki on ai-factory: «no `subagents/` directory exists»; context7 on aif-handoff confirms coordinators live there) | **CRITICAL — cited file path doesn't exist in cited repo** |
| **#27** `HANDOFF_MODE` env-var | `lee-to/ai-factory v2.x, skills/aif-implement/SKILL.md` | Mixed: ai-factory 2.x had `HANDOFF_TASK_ID` env var as a bridge; main/HEAD (per DeepWiki) doesn't reference it. Likely deprecated or moved to aif-handoff CLI. | Medium — partial-stale citation |

**Root cause:** context7 sweep 2026-05-11 (per `research-patches/2026-05-11-aif-handoff-overlap-analysis.md`) queried `/lee-to/ai-factory` only; did not query `/lee-to/aif-handoff` separately. Same-name-prefix («aif-») masked the separate-repo distinction. T16 «pattern-matching on name» in historical form — the «AIF Handoff» phrase was treated as a feature of AIF (a single system) rather than as a separate repo + integration boundary.

**Implication for §4.2 backfill check:** SSOT #27-#30 are concrete examples where context7-only sweep produced verdict-affecting evidence gaps. R-phase backfill check should re-run with **both** MCPs **and** explicit separate-repo distinction. This validates the research-tooling-evaluation hypothesis empirically — context7 alone insufficient for AIF-family build-vs-reuse decisions.

**Implication for SSOT discipline (project-wide):** when SSOT entry cites a path inside repo X, the `prior-art-evaluations.md §3` entry-trigger criteria should require **path existence verification** at time of entry-creation. Currently relies on context7's «here's where the snippet came from» URL; if that URL is structurally wrong (different repo's path mistaken for cited repo's path), no gate catches it. **R-phase to propose: SSOT-creation gate that grep'es cited path in cited repo's actual filesystem.** This is its own atomic commit + potentially principle test, scoped to research-tooling R-phase output's §6 SSOT entries proposed.

**Additional missed skills surfaced by DeepWiki test 3 (not in current SSOT):**
- `ai-factory.best-practices` — code quality guidelines skill
- `ai-factory.security-checklist` — security audit skill

Both potentially relevant to our `agents/best-practices-sidecar.md` (Wave 8.1b SSOT) — possibly upstream-similar; R-phase to check problem-class match if scope permits.

## §10.3 `lee-to/aif-handoff` full structure (DeepWiki indexed 2026-05-13 after manual trigger; cutcode.dev cross-check)

> Indexed successfully after ~30-45 min delay post-trigger via deepwiki.com. Second indexing-latency data point for §4.0 freshness question.

**aif-handoff is NOT a kanban-component or feature-of-ai-factory. It is a full TypeScript MONOREPO with 7 packages:**

| Package | Role | SSOT-relevant primitives |
|---|---|---|
| `@aif/shared` + `@aif/data` | DB schema, migrations, **state machine**, repository functions | `paused:true` state machine (SSOT #28 actual home) |
| `@aif/api` | Fastify-style API: task routes, project routes, **Chat API + Real-Time Streaming**, **WebSocket events** | Real-time sync primitive |
| **`@aif/agent`** | **The Coordinator** — 4 sub-sections: 5.1 Polling Loop + Locking + Concurrency / **5.2 Subagents: Planner, Implementer & Reviewer** / **5.3 Git Isolation: Branches, Worktrees & Commit Generation** / **5.4 Watchdogs, Error Classification & Recovery** | SSOT #30 actual home (implement-coordinator → Implementer subagent); worktree primitive; self-healing pattern (new ADOPT candidate) |
| **`@aif/runtime`** | **Multi-runtime abstraction** — `RuntimeAdapter` interface + Registry + Capabilities + **Claude Adapter (SDK/CLI/API transports)** + **Codex Adapter (CLI/SDK/App Server)** + **OpenRouter & OpenCode Adapters** | **New ADOPT-candidate** — direct production match to our AI-agnostic sub-agent boundary discussion (`agents/*.md` pattern) |
| `@aif/web` | React frontend: **Kanban Board, Task Cards**, Real-Time Sync, **Agent Timeline**, Chat Panel | UI for swarm-monitoring (not directly relevant to our use case but illustrative) |
| **`@aif/mcp`** | **MCP Integration package** — MCP Tools for Task & Plan Management + **Bidirectional Status Sync** | **New ADOPT-candidate** — direct integration path for Phase 10 swarm coordination; any Claude Code session can manage tasks via this MCP |
| Infrastructure | Docker Setup, CI/CD Workflows, **Quality Gates**, Performance Testing | Production-deployment reference; out of scope for our use case |

**Architectural primitives confirmed (cross-checked DeepWiki + cutcode.dev):**

- **Two execution modes:** Subagents (iterative refinement, higher quality) vs Skills (fast single-pass). **Direct productized analog of our Mode A/B orchestrator pattern.** Vocabulary-or-mechanism ADOPT candidate.
- **Layer-aware execution:** detects task dependencies and dispatches parallel workers across independent layers (matches our parallel-subwave-isolation discipline but automated).
- **Heartbeat monitoring + automatic recovery from stuck stages + rework loops when review catches issues** — self-healing pattern absent from our current orchestrator skill.
- **State machine** with `paused:true` on review stage (SSOT #28's actual implementation).
- **«Powered by Claude Agent SDK», NOT Claude Code Agent Teams (TeammateTool).** Different architectural layers; complementary not duplicate. R-phase should explore whether the two can be composed (e.g. Agent Teams TeammateTool for cross-session messaging + aif-handoff coordinator+subagent for task orchestration).
- **MIT license, open source.** Free to ADOPT or ADAPT.

**Upgraded swarm-readiness gap coverage (post-full-picture):**

| Gap | Was | Updated | Source |
|---|---|---|---|
| 1 Swarm orchestration template | ~30% | **~80%** | `@aif/agent` coordinator + state machine + concurrency limits |
| 2 Worktree spawn | ~80% | **~95%** | Dedicated section 5.3 «Git Isolation» |
| 3 Result aggregation (cross-stream) | ~25% | **~50-60%** | Task-level review stage; cross-task aggregation still own work |
| 4 Per-agent compliance | ~30% | **~60%** | Planner/Implementer/Reviewer + Watchdogs + Error Classification |
| 5 Swarm review | ~30% | **~50%** | Review subagent per task |

**Total infrastructure coverage: ~60-70%** (was 40-50%).

**Remaining gaps (still our originality):**

- **«Audit-shape» cross-stream aggregation** — their review stage is per-task; aggregating N parallel R-phase audit categories (А1-А6 Phase 10 style) into a single coherent verdict is still own work.
- **§1.7 substance check on each subagent output** — their review-subagent checks implementations, not its own review-output. Recursive self-application gap remains.
- **Audit-task decomposition for kanban** — their `plan-coordinator` expects feature/bugfix shape, not audit-category shape. Adapter needed.

**Proposed NEW SSOT entries (R-phase to consider in §6):**

- `lee-to/aif-handoff @aif/runtime RuntimeAdapter` — production-grade AI-agnostic runtime abstraction
- `lee-to/aif-handoff @aif/mcp` — MCP server package for Task/Plan management with bidirectional sync
- `lee-to/aif-handoff @aif/agent Watchdogs + Error Classification + Recovery` — self-healing pattern
- `aif-handoff Subagents-mode vs Skills-mode dichotomy` — productized Mode A/B reference

(All four are NEW candidates not currently in our SSOT; R-phase decides ADOPT / ADAPT / DEFER / REJECT individually.)

**Implication for Phase 10 / swarm-readiness planning:** raw adoption of `@aif/mcp` + reference to `@aif/agent` patterns closes ~70% of swarm-infrastructure gaps. Remaining ~30% (audit-shape aggregation, per-output §1.7, audit-task decomposition) is our own implementation work — but with their production patterns as reference, not green-field design. **Practical roadmap revision (from earlier kickoff estimate):** «2-3 weeks integration work» may be «1-1.5 weeks adoption + 1 week our-originality», not «5 sub-waves of own-build».

---

## §11 Final note to the AI who runs this

This is a **research-only** session. No code changes. No `.claude/rules/*` edits. No PR. Deliverable = single research patch + SSOT entry, single commit.

Resist scope expansion. Resist «while I'm here» observations. Note them in §findings as «out of scope but observed» — do NOT act.

Especially resist:
- Doing the Agent Teams readiness research (separate session, D5).
- Doing the Phase 10 launch research (separate, deferred).
- Auditing more than 3 past patches in §4.2 (scope creep).
- Adopting DeepWiki implementation (e.g. installing MCP, updating settings.json) — verdict first, adoption is separate.

The goal is **one good decision matrix + one defensible SSOT entry + one targeted backfill check.** Three artifacts. That's it.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
