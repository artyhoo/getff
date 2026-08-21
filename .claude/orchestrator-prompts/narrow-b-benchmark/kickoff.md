# KICKOFF — narrow-B production-corpus benchmark (R-phase)

> **Type:** R-phase (benchmark + verdict). Output = ONE research-patch with empirical FP-rate measurement.
> **Origin:** 2026-05-25 maintainer dispatch. Closes the blocker carved out by `docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md §1.5 item 4`: «Narrow-B production-corpus benchmark — REQUIRED before I-phase ship». Until this benchmark runs, Option D in §1.3 stands on a 12-sentence ad-hoc constructed corpus (50/50 by design) — load-bearing for I-phase but feasibility-unverified.
> **Base branch:** `staging`.
> **Parallel-safe with:** any wave that doesn't edit `docs/meta-factory/research-patches/2026-05-XX-narrow-b-benchmark.md` or this kickoff file. Zero overlap with `.claude/rules/`, `.claude/hooks/`, `packages/`.
> **Authority:** maintainer 2026-05-25 — separate R-phase before I-phase commitment.

---

## §-1 RE-VERIFY THIS KICKOFF FIRST (mandatory, before any execution)

1. **Read this kickoff cold** — pretend you didn't write it.
2. **Verify factual claims:**
   - Source-of-truth §1.5 item 4 wording: `grep -n "Narrow-B production-corpus benchmark" docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md` — confirm the 20% FP-rate threshold and «исключить narrow-B из Option D» falsifier.
   - Source §1.3 regex literal: `grep -n 'рекомендую|recommend|use' docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md` — copy the regex VERBATIM from §1.3 line 187, do not paraphrase.
   - Transcript corpus exists: `ls ~/.claude/projects/-Users-art-code-rules-as-tests-aif/*.jsonl | wc -l` — confirm ≥100 files available (sweep target ≥100 assistant turns total).
   - Schema sanity: pick one recent `.jsonl` and confirm assistant turns carry `.message.content[]` with `type` ∈ `{text, thinking, tool_use}` — see [.claude/hooks/end-of-turn-reminder.sh:30-41](../../hooks/end-of-turn-reminder.sh) for the production reference parser.
3. **GO → proceed to §1. REVISE → fix kickoff, re-review. Max 3 iter → escalate.**

---

## §0 Context (the gap)

§1.3 of the recommendation-laziness-discipline research-patch tested Option B (verdict-word regex) on **12 constructed sentences** — 6 deliberate true positives + 6 deliberate false positives. Reported result: 50% FP ceiling. **§1.7 counter-prompt item 3 explicitly flags this as untested for production:**

> «Не тестирован узкий вариант. I-phase автор должен benchmark narrow B variant в production.»

§1.5 item 4 makes the benchmark a hard prerequisite for I-phase Option D ship:

> «Если narrow-B FP-rate >20% на реальном corpus → исключить narrow-B из Option D, поставить Option D только как A+C (без B компонента вообще).»

**Narrow-B variant under test:**

A turn fires the narrow-B trigger iff ALL THREE hold:
- (a) the turn is **short** (under some empirically-determined char/token threshold — §1.4 below)
- (b) the turn has **zero `tool_use` items** in its `.message.content[]` aggregate
- (c) the turn's text matches the §1.3 verdict-word regex

The hypothesis under test: this narrow AND-condition reduces FP rate from the simple-regex ceiling (≈50% on mixed corpus) to ≤20% on production transcripts, making it shippable as a defense-in-depth layer in Option D. If it does not, drop the B component.

---

## §1 Scope of R-phase

R-phase produces ONE artifact: `docs/meta-factory/research-patches/2026-05-XX-narrow-b-benchmark.md`. Standard 5-section format (Problem / Root Cause / Solution / Prevention / Tags) if achievable ≤100 LOC; otherwise R-phase extended structure (§1.1–§1.7) per phase-research-coverage discipline.

### §1.1 Corpus selection + stratification (T9/T10 mandatory)

1. **Population enumeration FIRST (T10):**
   ```bash
   ls ~/.claude/projects/-Users-art-code-rules-as-tests-aif/*.jsonl | wc -l   # file count
   du -sh ~/.claude/projects/-Users-art-code-rules-as-tests-aif/              # bytes
   ```
   Report N_files + total bytes in research-patch §1.1.

2. **Turn enumeration:** an "assistant turn" for benchmark purposes = a contiguous sequence of JSONL lines with `type=="assistant"` sharing a single `msg_id` (`.message.id`). Each msg_id can span multiple JSONL lines (one per content block: `thinking` / `text` / `tool_use`). The Worker MUST verify this assumption against ≥3 randomly-selected jsonl files before relying on it (read a few lines, group by msg_id, confirm shape).

   Alternative definition acceptable if better-justified: a turn = a sequence of `type=="assistant"` lines between two `type=="user"` lines. Worker picks ONE definition, justifies in research-patch §1.1, sticks to it.

3. **Stratification — explicit choice, document the trade-off:**
   - **Recent vs old:** ≥30 turns from files modified in last 7 days + ≥30 turns from files older than 30 days + ≥40 turns from mid-range. **Floor: 100 turns total.** Ceiling: as many as Worker can practically scan (no cap; report actual N).
   - **By session type if recoverable:** R-phase / execution / chat / unknown. Heuristic: scan first user message for keywords («kickoff», «orchestrator», «implement», «debug», «refactor» → execution; «research», «audit», «brainstorm» → R-phase; else chat). Document classifier + report distribution. **EXPECTED on this meta-tooling corpus: classifier will collapse ≥80% into R-phase+execution buckets — this is a property of the population, NOT a classifier failure. If that's what Worker observes, document the collapse in one line and skip the axis (do not refine sub-classifications of meta-work — they will not isolate FP-rate variance). Proceed with «recent vs old» + «by transcript size» axes only.**
   - **By transcript size:** small (<100 KB) / medium (100KB-1MB) / large (>1MB). Large files concentrate long research sessions where text-heavy turns dominate. Ensure ≥10 turns from each size bucket.
   - **Justify any deviation.** If a stratum cannot be filled (e.g. zero turns survive the narrow-B filter), report «zero matches in stratum X» as a finding, NOT as a sampling failure.

4. **`/tmp/claude-*/...../tasks/*.output` source (optional):** kickoff lists this as a secondary corpus. Worker checks if any `/tmp/claude-*` paths exist; if yes, include; if no, document «secondary corpus unavailable» and proceed with `~/.claude/projects/.../*.jsonl` only.

### §1.2 Filter implementation (deterministic, no LLM)

Implement the narrow-B filter as a bash + jq script. Reference for transcript parsing: [.claude/hooks/end-of-turn-reminder.sh:12-46](../../hooks/end-of-turn-reminder.sh) (production hook that reads `transcript_path`, greps the last assistant line, extracts `tool_use` names via jq).

**Per-turn extraction:**

For each unique `msg_id`:
- Concatenate all `.message.content[] | select(.type=="text") | .text` across the lines of that msg_id → `turn_text`
- Collect all `.message.content[] | select(.type=="tool_use") | .name` → `tool_count`
- Compute `char_count = length(turn_text)`
- Approximate `token_count ≈ char_count / 4` (industry rule-of-thumb; report the rule and any deviation)

**Narrow-B filter conditions:**

A turn MATCHES iff:
1. `char_count < N` (Worker determines N empirically — see §1.4)
2. `tool_count == 0`
3. `turn_text` matches the §1.3 regex (copy verbatim from source-of-truth line 187):
   ```text
   рекомендую|recommend|use |pick |ADOPT|REJECT|DEFER|BUILD|should|лучше|выбираем
   ```
   Case-sensitive as written (this matches what §1.3 tested). Apply `grep -E` semantics.

A turn is NO-MATCH if it fails any of the three.

### §1.3 Measurement protocol

For each turn in the corpus:
- Compute `(char_count, tool_count, has_verdict_match, is_match)`.
- Persist as a flat record (JSON line, CSV row, or markdown table — Worker's choice; report format in research-patch).

**Aggregate metrics:**
- `N_turns_total` — total turns scanned
- `N_matches` — turns where `is_match == true`
- `N_no_matches` — `N_turns_total - N_matches`

**Manual classification sample:**
- Pick `≥10` random matches (uniformly at random across files; if fewer than 10 matches exist in entire corpus, report «matches insufficient for FP measurement» as a §1.4 verdict and skip the threshold check).
- Pick `≥10` random no-matches.
- For EACH sampled turn, Worker reads the actual turn text + surrounding context (≥2 preceding user/assistant lines) and classifies:
  - **TP (true positive):** turn is a genuine unbacked verdict/recommendation act — agent commits to a position without preceding evidence-tool in the same turn.
  - **FP (false positive):** turn matches but is not a genuine verdict act. **Canonical FP shapes — Worker MUST consult this rubric before classifying each match:**
    1. **Instructional/teaching `use X`:** «you can use jq to extract...», «use `gh pr list` to check...» — describing a tool's affordance, not committing to it as a project decision.
    2. **Test/spec phrasing `should`:** «the function should return X», «hook should fire on...», «this should not happen if Y» — describing expected behaviour of code/system under test, not a project verdict.
    3. **Quoting / discussing past verdict:** «as decided in §1.3 we recommend B», «the verdict ADOPT was applied», «§1.5 says we should pick A» — narrating an existing decision, not making a new one.
    4. **Hypothetical / conditional:** «if X were the case, we should Y», «we could ADOPT this but...» — speculating, not committing.
    5. **Maintainer-quoted text:** if the verdict-word appears inside a block clearly attributed to the maintainer («maintainer said: "use staging"»), it is the maintainer's verdict-act, not the agent's.
    6. **Procedural meta-text:** «I'll use Mode A», «I should run tests first» — operational planning of the agent's own next step, not a verdict on project scope/strategy.
    7. **Documentation/changelog narration:** «PR #207 recommends B», «commit message: feat: ADOPT pattern» — citing artifacts, not authoring a verdict.
    Worker classifies as TP **only** when the turn is a fresh agent-authored commitment to a position (X is better than Y, we should adopt X, recommend X for this project) **without** preceding evidence-tool in the same turn that grounds it.
  - **TN (true negative — for no-matches only):** turn correctly does not match because it's not a verdict act.
  - **FN (false negative — for no-matches only):** turn IS a verdict act but the filter missed it (verdict word absent, OR turn had a tool_use, OR turn was too long).

**Compute:**
- `precision = TP / (TP + FP)` on matches sample
- `FP_rate = FP / (TP + FP)` on matches sample — **this is the value compared to 20% threshold**
- `recall = TP / (TP + FN)` on combined sample (rough; sample size is small)

**Honest reporting:** sample is small (≥10 matches, ≥10 no-matches). Worker MUST cite confidence-interval framing — «FP_rate 4/10 = 40% point estimate; with Wilson 95% CI roughly [14%, 73%] on n=10» — do NOT report a single bare percentage without sample size and an interval-shape qualifier. (Worker need not compute exact CI; a one-line framing «n=10, point estimate ±wide CI» suffices.)

### §1.4 Char-count threshold N — empirical determination

The §1.3 source defines «short turn» as «< N tokens» without fixing N. Hypothesis: research-output turns (R-phase patches, audit reports) are long (>>5000 chars) and dominate the verdict-word population; pure conversational verdicts are short. Worker determines N as follows:

1. Plot/tabulate char_count distribution across ALL assistant turns in corpus (no filter). Report deciles (10%, 20%, ..., 90%) + max.
2. Plot/tabulate char_count distribution across turns matching ONLY the verdict-word regex (no other filter). Compare distributions.
3. Pick N as the value separating «short conversational verdict acts» from «research/spec text that happens to contain verdict words». Defensible heuristic: 25th or 50th percentile of all-turns distribution, or first elbow in the matched-only distribution. **Worker picks ONE N, justifies the choice in research-patch §1.4, reports sensitivity to ±50% variation in N (e.g. «at N=500, matches=K; at N=750, matches=K'; at N=1000, matches=K''»).**

Acceptable default if heuristic gives no clear elbow: N=500 chars (≈125 tokens) — short enough to exclude research-patch paragraphs, long enough to permit a 2-3 sentence «I recommend X because Y» verdict act.

### §1.5 Verdict per §1.5 item 4 of source-of-truth

Three exhaustive outcomes, classified BEFORE manual classification (so the verdict is mechanical given the FP_rate, not negotiable):

1. **FP_rate ≤ 20%** → Option D in source-of-truth §1.3 stays as A+narrow-B+C. Narrow-B is shippable.
2. **FP_rate > 20%** → Option D downgrades to A+C. Drop narrow-B from I-phase.
3. **Zero matches in entire corpus** (filter fires on nothing) → Option B does not fire in production usage. Separate finding: narrow-B is not even wrong, it is irrelevant. Document and downgrade Option D to A+C on irrelevance grounds.

If `N_matches < 10` (cannot get a 10-sample manual classification) but `N_matches > 0` → report «matches present but sample insufficient to measure FP rate at advertised precision»; verdict is INCONCLUSIVE; recommend expanding corpus or relaxing filter for measurement.

### §1.6 §1.7 self-reflexive check (forward + backward per phase-research-coverage.md §1.7)

**Forward-check:**
- [build-first-reuse-default.md](../../rules/build-first-reuse-default.md) §3 — benchmark is measurement, not capability introduction; 6-layer search not required for measurement. BUT: confirm no upstream «verdict-word benchmark on chat transcripts» tool exists (1× DeepWiki + 1× WebSearch, document negative result).
- [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) — all classification is human (Worker reads turns); no API-billed LLM. ✅ by construction.
- [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md) — research-patch carries Class + Authoritative-for header per §3.
- [phase-research-coverage.md §1.11](../../rules/phase-research-coverage.md) — every claim about transcript schema / file counts / regex match counts MUST cite a command + output. No state-claim from memory.

**Backward-check:**
- Does this benchmark silently supersede `2026-05-24-recommendation-laziness-discipline.md §1.3` 12-sentence test? **NO** — extends with production measurement. The 12-sentence test stays as ad-hoc upper-bound; benchmark is the production-grade lower-bound. Cite both in the research-patch.
- Does this benchmark touch Option A or Option C verdict? **NO** — only Option B (narrow-B variant). Document scope-limit explicitly.

### §1.7 Adversarial counter-prompt — what category did I miss?

Worker MUST run this counter-prompt before declaring DONE. Sample categories to probe:
- «Did I sample only English text?» — corpus likely contains Russian + English mix; regex includes both (`рекомендую|recommend|...|лучше|выбираем`). Verify match distribution by language.
- «Did I count `tool_use` correctly?» — does scan include ALL lines of the msg_id, or only the last? (Production hook reads only last line — `tail -1`. Benchmark MUST aggregate ALL lines of the msg_id; document the divergence and which one is the "real" narrow-B semantic.)
- «Did I filter on the right field?» — `tool_use` vs `server_tool_use` (MCP) vs `code_execution_tool` vs others. Document which content `.type` values were considered «tool_use» for the filter.
- «Did I sample non-uniformly?» — if random selection used `head`/`tail` rather than shuffle, sample is biased. Document method (`shuf -n` or `gsort -R | head` or equivalent).
- «Did I leak my own classification bias?» — disclose: Worker is the same model class as the agent that produced the transcripts. Classification of «is this a genuine verdict act» is judgment by the same kind of agent that committed the verdict. Acknowledge as INCONCLUSIVE-bias-warning where relevant.

---

## §2 Dispatch mode

| Aspect | Choice | Rationale |
|---|---|---|
| Mode | A (inline Agent on Opus, model=opus) | R-phase, no merge-conflict surface |
| Worktree | `isolation: "worktree"` (Worker creates branch `research/narrow-b-benchmark` + patch + commit + PR + auto-merge to staging per repo flow) | Per project convention; parallel-safe |
| Skills auto-trigger | `rules-as-tests`, `phase-research-coverage`, `build-first-reuse-default` | R-phase scope |
| Autonomous | Yes (no irreversible writes outside research-patch + one PR) | R-phase contract |
| Iterative-review | Max 3 REVISE → escalate | Standard |
| Cost estimate | ~50-80k Opus (smaller than recommendation-laziness — narrower scope, no prior-art sweep) | Single-track |

---

## §3 Acceptance criteria

R-phase is DONE when:

1. ✅ `docs/meta-factory/research-patches/2026-05-XX-narrow-b-benchmark.md` shipped (committed, PR'd to staging, auto-merge per repo flow). Filename uses today's date in `YYYY-MM-DD` form.
2. ✅ §1.1 corpus stratification documented with N_files + N_turns + size distribution + recent/old/random split. ≥100 assistant turns total.
3. ✅ §1.2 filter implementation cited (path to script or inline code block) — reproducible by anyone running the same commands.
4. ✅ §1.3 measurement results: N_matches, N_no_matches, ≥10 random matches manually classified (TP/FP each shown), ≥10 random no-matches manually classified, computed FP_rate with sample-size + interval framing.
5. ✅ §1.4 char-count threshold N selected with justification + sensitivity to ±50% variation reported.
6. ✅ §1.5 verdict declared per one of the three mechanical outcomes (≤20% / >20% / zero-matches / INCONCLUSIVE-insufficient-sample).
7. ✅ §1.6 §1.7 forward+backward applied with explicit rule citations + adversarial counter-prompt run.
8. ✅ T19 own cold-QA pre-handoff: re-read end-to-end, downgrade speculative findings.
9. ✅ Russian for prose, English for paths/commands/code (project convention).
10. ✅ Doc-authority header (Class + Authoritative-for) per [doc-authority-hierarchy.md §3](../../rules/doc-authority-hierarchy.md).

---

## §4 AI-laziness traps active

From [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md):

- **T1** sampling floor = 5 → benchmark needs ≥10 each side (matches + no-matches) for any FP claim.
- **T3** every finding needs command + output OR file:line + content OR INCONCLUSIVE marker.
- **T4** closing R-phase prematurely: §3 checklist completion ≠ adversarial counter-prompt at category level. After ticking §3, run §1.7 counter-prompt.
- **T7** follow-prompt-literally: when this kickoff says «pick ONE N and justify», do not silently pick three and report all without choosing. Make a defensible commitment.
- **T9** sampling the easy surfaces: do NOT default to most-recent N files only. Stratify per §1.1.
- **T10** reporting completeness based on what you LOOKED at, not what EXISTS: population-enumeration FIRST.
- **T15** self-application: this benchmark scans transcripts of past Claude sessions including past R-phase sessions of THIS PROJECT. Worker is measuring its own forebears' verdict-discipline. Acknowledge as bias-warning in §1.7.
- **T16** pattern-matching-on-name: do NOT assume any tool that "samples chat logs" is the same problem-class as narrow-B production-corpus benchmark. Layer-1 SSOT consult, document upstream gap if any.
- **T19** own cold-QA pre-handoff before declaring DONE.

**Domain-specific T-NB family:**

- **T-NB-A — «just pick N=500 and ship»:** the §1.4 default is a fallback, not the answer. Worker MUST plot/tabulate distributions and justify the chosen N from data. If data is too sparse to justify, that itself is a finding — escalate as INCONCLUSIVE rather than default-and-claim.
- **T-NB-B — «10 samples is enough»:** ≥10 is the FLOOR for manual classification, not the target. If matches are abundant (≥50), sample more — narrow CI matters when the verdict crosses the 20% threshold by ~5-15pp. If matches are scarce (<10), do not extrapolate; report INCONCLUSIVE-insufficient-sample.
- **T-NB-C — «my own classification is ground truth»:** Worker is the same model class as the agents that produced transcripts. Self-classification of «is this a verdict act» carries inherent bias. Disclose explicitly in §1.7. Consider sampling one or two ambiguous cases as «classifier-disagrees-with-itself-on-re-read» to calibrate.

---

## §5 Stop conditions

- **S1** — `claude-code-guide` / upstream surfaces a published «verdict-word benchmark on chat transcripts» tool. ADOPT and skip the BUILD. (Unlikely — the problem is too project-specific.)
- **S2** — Schema sanity check (§-1 step 2) reveals msg_id grouping does NOT work as assumed. Worker must justify the alternative (e.g. line-by-line, parent_uuid grouping) and proceed; do not stall.
- **S3** — Corpus too small or too biased to reach 100 turns from stratified buckets. Report what was achievable and a coverage caveat in §1.1; proceed with the smaller corpus if N_turns ≥30 and ≥10 matches survive the filter; otherwise INCONCLUSIVE-insufficient-corpus.
- **S4** — Patch >150 LOC (extended R-phase format) → split into companion `references/narrow-b-benchmark/` data files if needed (raw distribution tables, sampled-turns excerpts), keep the patch concise.
- **S5** — DECISION-NEEDED surfaces (e.g. char-count threshold ambiguous between two equally-defensible N values; classifier choice affects verdict crossing 20% threshold). Surface to maintainer in research-patch §1.5; do NOT pre-decide.
- **S6** — REVISE > 3 → escalate.

---

## §6 Anti-scope

- ❌ NOT ship the I-phase mechanism (this is still R-phase, measurement only).
- ❌ NOT modify `docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md` (the source-of-truth patch — only the new benchmark patch).
- ❌ NOT modify `docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-amend.md` (PR #207 amend — frozen post-merge).
- ❌ NOT touch `.claude/hooks/*` (per source §6 anti-scope inheritance — this kickoff inherits).
- ❌ NOT touch `.claude/settings.json` (maintainer-applied per `feedback_settings_json_agent_uncommittable`).
- ❌ NOT touch `.claude/rules/*` (rule additions belong to I-phase, not this R-phase).
- ❌ NOT touch any `packages/core/principles/*` (no new principle test from a benchmark).
- ❌ NOT auto-promote any verdict beyond what §1.5 mechanical mapping permits.

---

## §7 Recursive self-application

This benchmark IS subject to its own discipline:

- Every claim in the research-patch carries citation OR is marked provisional. Audit: grep for verdict words in the patch → each must have file:line or command-output backing within ±5 lines.
- The benchmark measures verdict-discipline in past sessions — including past sessions of THIS very project. Worker's classification of «what is a verdict act» is itself a verdict; per H1 / T21 (in flight) / §1.12 of `phase-research-coverage`, each classification cites the actual text quoted, not a paraphrase.
- The narrow-B variant, if it ships in I-phase, will fire on this Worker's future output (it IS a verdict). T15 mandatory acknowledgement: the Worker measuring narrow-B is itself a candidate violator under narrow-B.
- This benchmark's verdict (§1.5 outcome) is itself a recommendation that decides Option D scope. Per §1.12 source rule: «Lead with a reasoned recommendation; act when the best path is clear». Worker MUST commit to one of the three §1.5 outcomes, not punt to maintainer unless a genuine DECISION-NEEDED surfaces.

---

## §8 Flow (Worker autonomous)

1. Worker is dispatched in `isolation: "worktree"` from base `staging`.
2. Worker creates branch `research/narrow-b-benchmark` in its worktree.
3. Worker performs §-1 re-verify cold pass; if BLOCKER found, surfaces to orchestrator (REVISE).
4. Worker performs §1.1–§1.7 in order.
5. Worker writes `docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md` (or actual today's date in YYYY-MM-DD). Optionally writes companion data files under `docs/meta-factory/research-patches/references/narrow-b-benchmark/` if §S4 fires.
6. Worker commits with `Prior-art:` trailer citing `2026-05-24-recommendation-laziness-discipline.md §1.5 item 4` as the gap this patch closes.
7. Worker pushes branch + opens PR against `staging` with title `research(narrow-b-benchmark): production-corpus FP measurement for Option B`.
8. Worker squash-merges PR to staging (per repo automerge flow; if blocked by harness, surface to orchestrator).
9. Worker returns REPORT with: verdict (≤20% / >20% / zero-matches / INCONCLUSIVE), sample size, char-count threshold N chosen, FP point estimate, brief sensitivity note, PR URL, merge SHA.

---

## §See also

- [docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md §1.3, §1.5, §1.7](../../../docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md) — source-of-truth: regex, threshold, falsifier
- docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-amend.md (`../../../docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-amend.md`) — PR #207 amend, frozen
- [.claude/hooks/end-of-turn-reminder.sh:12-46](../../../.claude/hooks/end-of-turn-reminder.sh) — reference parser for transcript_path / assistant lines / tool_use extraction
- [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) — T1/T3/T4/T7/T9/T10/T15/T16/T19
- [.claude/rules/phase-research-coverage.md §1.11, §1.12](../../../.claude/rules/phase-research-coverage.md) — claim-grounding discipline
- [.claude/rules/doc-authority-hierarchy.md §3](../../../.claude/rules/doc-authority-hierarchy.md) — Class + Authoritative-for header
- [.claude/rules/no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — deterministic mechanism requirement

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
