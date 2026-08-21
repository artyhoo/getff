# KICKOFF — recommendation-laziness-discipline (I-phase)

> **Type:** I-phase (implementation). Output = mechanism ship per R-phase binding scope, downgraded to Option D = A+C only per benchmark verdict. Three sub-waves: A (H1 wording), C (new T-trap), D (new Class C rule file).
> **Origin:** 2026-05-25. Follow-up to merged R-phase PRs #206 / #207 / #210. Closes recommendation-laziness-discipline umbrella via mechanism layer for parent rule [`.claude/rules/phase-research-coverage.md §1.12`](../../../.claude/rules/phase-research-coverage.md) (this is NOT a new rule — it's the missing enforcement scaffolding for the existing §1.12 prose discipline).
> **Base branch:** staging.
> **Parallel-safe with:** F.3 meta-orchestrator refactor (zero file overlap — F.3 touches `.claude/skills/meta-orchestrator/**` + helpers; this I-phase touches `.claude/hooks/inject-session-bootstrap.sh:11` + `.claude/rules/ai-laziness-traps.md` + `.claude/rules/recommendation-laziness-discipline.md` [new]).
> **Authority:** maintainer 2026-05-25 (this kickoff drafted under explicit Option D = A+C verdict per [`docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md §1.5`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md)).

---

## §-1 RE-VERIFY THIS KICKOFF FIRST (mandatory, before any execution)

1. **Read this kickoff cold** — pretend you didn't write it.
2. **Verify factual claims:**
   - **H1 wording line:** `grep -n "Recommendation discipline" .claude/hooks/inject-session-bootstrap.sh` → must confirm line 11 still contains the H1 text quoted in §1 Sub-wave A below. If line number drifted → update Sub-wave A reference and re-verify.
   - **Highest T-number in catalogue:** `grep -oE '^### T[0-9]+' .claude/rules/ai-laziness-traps.md | sort -V | tail -1` → must confirm **T19** (highest at kickoff-draft time). If T20 or T21 has landed → re-do §1 Sub-wave C T-number determination per S2 (DECISION-NEEDED collision).
   - **Stryker T20 queued status:** `grep -E 'T20|equivalence-claim' ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_stryker_mutation_hardening_done.md` → must confirm Stryker T20 is **queued, not yet shipped** (memory line «codify as T20 `equivalence-claim-without-evidence`»). If Stryker has shipped T20 between draft and execution → use T21 directly (no DECISION-NEEDED, mechanical bump).
   - **Settings.json deny-list:** `python3 -c "import json; d = json.load(open('.claude/settings.json')); print([r for r in d['permissions']['deny'] if 'inject-session-bootstrap' in r])"` → must be **empty list** (hook body itself is agent-editable; only `settings.json` is denied). If `inject-session-bootstrap.sh` is in deny-list → Sub-wave A delivery flips to snippet-only.
   - **Benchmark verdict reference:** `grep -n "FP_rate = 84" docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md` (on `origin/staging`) → must confirm §1.5 contains «84.2%» / «Drop narrow-B». If verdict has been revised post-draft → re-do §1 Option D scope.
   - **Parent rule §1.12 still in repo:** `grep -n "§1.12 Lead with a reasoned recommendation" .claude/rules/phase-research-coverage.md` → must confirm §1.12 is the canonical authority. If §1.12 renamed/relocated → update §1 Sub-wave D `Authoritative-for` references.
3. **Spawn 1× Opus cold-reviewer subagent** per [orchestrator skill](~/.claude/skills/orchestrator/SKILL.md) Phase -1 default. Focus areas (a/b/c) listed in §-2 below. Re-spawn after each amendment cycle. Max 3 iter → escalate.
4. **GO → proceed to §1. REVISE → fix kickoff, re-review.**

---

## §-2 Phase -1 reviewer brief (1× Opus default)

Spawn via `Agent` tool (`subagent_type: "claude"`, `model: "opus"` or omit, no `isolation` needed — read-only review). Focus split (all three concurrently within the single Opus reviewer):

**(a) T-number determination logic** — does §1 Sub-wave C correctly distinguish three states of Stryker T20 (queued / shipped-after-kickoff-draft / shipped-before-kickoff-execution), and does it map each to the right outcome (DECISION-NEEDED halt / T21 mechanical bump / T22+ further bump)? Read §1 Sub-wave C + §5 S2 + memory `project_stryker_mutation_hardening_done.md` to verify.

**(b) Sub-wave C grep design honours benchmark recall caveat** — benchmark §1.3 (Measurement results / Метрики block) reports `recall = TP / (TP + FN) = 3/3 = 1.0 (грубо; n=10 no-match sample only)`, and §T19 explicitly downgrades this as «speculative; не следует интерпретировать как `filter не пропускает настоящих verdicts`». Does Sub-wave C avoid claiming any post-hoc grep mechanism will «catch» recommendation-laziness violations, or does it correctly frame any optional grep as «logging-only, manual classification required, NOT a gate»? Read §1 Sub-wave C + §6 anti-scope + benchmark §1.3 + §T19 to verify.

**(c) Doc-authority header for new rule references parent (§1.12) correctly** — does §1 Sub-wave D's `Authoritative-for` / `NOT authoritative-for` text correctly position the new rule as **mechanism layer** under parent §1.12, and not as a competing/duplicate rule? Read §1 Sub-wave D + research-patch §1.6 backward-check (EXTENDS, NOT supersedes) + `.claude/rules/doc-authority-hierarchy.md §3`.

**Reviewer return format:** BLOCKER / MAJOR / MINOR list per focus area + verdict GO / REVISE.

---

## §0 Origin + verdict citation

**Origin documents (both merged to staging, SSOT for this I-phase):**

1. [`docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md`](../../docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md) — R-phase design, post-merge amended via PR #207.
   - **§1.2:** prior-art survey — this patch is the **mechanism layer for parent rule `.claude/rules/phase-research-coverage.md §1.12`** (introduced 2026-05-22), NOT a new rule.
   - **§1.4:** binding I-phase scope table (items 1/2/3/4 = Sub-waves A+C below; item 6 = the dropped Sub-wave B Stop-hook).
   - **§1.6:** backward-check EXTENDS §1.12 (mechanism) / EXTENDS §1.11 (operational generalisation) / OPERATIONALISES `#recommendation-skips-own-discipline`.
   - **§10:** amendments log (PR #207 own-stack-blind-spot fix + narrow-B benchmark requirement).

2. [`docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md) — production-corpus FP measurement, PR #210.
   - **§1.5 verdict:** `FP_rate = 84.2% (Wilson 95% CI: [62%, 95%], n=19) >> 20% threshold → Drop narrow-B from Option D. Option D = A+C only.`
   - **§1.3 + §T19 recall caveat:** §1.3 Метрики block computes `recall = TP/(TP+FN) = 3/3 = 1.0 (грубо; n=10 no-match sample only)`; §T19 Cold-QA explicitly downgrades this as «speculative; не следует интерпретировать как `filter не пропускает настоящих verdicts`. Настоящий recall, скорее всего, низкий: большинство genuine verdict acts находятся в длинных turns (>750 chars) и turns с tool_use». Load-bearing constraint for Sub-wave C/D design (no post-hoc grep may claim catch-rate without manual classification sample). (Benchmark §1.4 itself is «Char-count threshold N» — N=750 rationale, NOT recall content.)
   - **§Adversarial counter-prompt (bias disclosure):** Worker = same model-class as transcript authors → classification may understand intent too well; FP_rate at 84% is robust against this bias.

**Verdict (this I-phase):** Option D = A + C only. Sub-wave B (Stop-hook scan) is **explicitly out-of-scope** per benchmark §1.5. Any attempt to re-introduce a Stop-hook variant requires a new R-phase + benchmark.

---

## §1 Sub-wave decomposition

Three sub-waves. Sub-wave B from R-phase §1.4 item 6 is **entirely omitted** per §0 verdict. Sub-waves A / C / D are file-disjoint → parallel-safe.

| Sub-wave | Target file | Mode | Parallel-safe with |
|---|---|---|---|
| **A** | `.claude/hooks/inject-session-bootstrap.sh:11` (H1 wording append) | Mode A inline Agent (Opus) + `isolation: "worktree"` | C, D |
| **C** | `.claude/rules/ai-laziness-traps.md` (§2 new T-entry + §3 obligation + §5 promotion criterion) | Mode A inline Agent (Opus) + `isolation: "worktree"` | A, D |
| **D** | `.claude/rules/recommendation-laziness-discipline.md` (NEW file, Class C) | Mode A inline Agent (Opus) + `isolation: "worktree"` | A, C |

### Sub-wave A — H1 wording append in inject-session-bootstrap.sh:11

**Target:** `.claude/hooks/inject-session-bootstrap.sh:11` — the H1 «Recommendation discipline» line injected into every prompt-submit context.

**Verified agent-editable:** `python3 -c "import json; d = json.load(open('.claude/settings.json')); print([r for r in d['permissions']['deny'] if 'inject-session-bootstrap' in r])"` → `[]` (kickoff-draft time). Only `.claude/settings.json` is in the deny-list; the hook body itself is editable. **Therefore Sub-wave A = direct edit by Worker** (not snippet-for-maintainer).

**NOTE — supersedes R-phase §1.4 item 4 owner field:** R-phase §1.4 item 4 lists this target as `maintainer-only (agent-uncommittable file per settings.json deny-list)`. That owner designation was based on an assumed deny-list entry that does NOT exist in the current `settings.json` (verified above; only `Edit(.claude/settings.json)` + `Write(.claude/settings.json)` are denied — the hook file is editable). The §-1 re-verify step 4 re-runs this check at execution time; if the deny-list has changed and `inject-session-bootstrap.sh` IS denied by then, Sub-wave A flips to snippet-for-maintainer delivery and the R-phase owner designation reapplies. This explicit override exists because R-phase §0 is cited as the binding scope SSOT — without this note, a Worker reading R-phase §1.4 item 4 verbatim would correctly halt instead of editing.

**WHAT to do:** append a short qualifier to the existing H1 sentence acknowledging that H1 alone is a reminder (not a gate), and cross-referencing the new T-trap entry from Sub-wave C and the new rule file from Sub-wave D. Per R-phase §1.4 item 4 falsifier («adding cross-reference clutters H1») — keep the append minimal (≤ 1 sentence). The current H1 already states «This is a reminder, not a gate.» — augment the cross-reference only.

**Suggested append (Worker may adjust wording while preserving meaning):**

> Append before the existing closing `(.claude/rules/phase-research-coverage.md §1.7)` cite, a parenthetical pointer: `(see also .claude/rules/recommendation-laziness-discipline.md + T-trap in ai-laziness-traps.md §2)`. Result reads: «…not load-bearing. This is a reminder, not a gate. (see also .claude/rules/recommendation-laziness-discipline.md + T-trap in ai-laziness-traps.md §2) (.claude/rules/phase-research-coverage.md §1.7)»

**Falsifier per R-phase §1.4 item 4:** WRONG IF — adding cross-reference clutters H1 such that the load-bearing first three sentences become harder to read. Counter: append goes at the end, after «not a gate», before existing parenthetical cite.

**Verify after edit:**
1. `grep -n "see also .claude/rules/recommendation-laziness-discipline.md" .claude/hooks/inject-session-bootstrap.sh` → must find on line 11.
2. `bash .claude/hooks/inject-session-bootstrap.sh | head -20` → must run cleanly, no shell-syntax breakage from the append.
3. Diff stat: `git diff .claude/hooks/inject-session-bootstrap.sh` → only 1 line modified (line 11), no trailing whitespace.

### Sub-wave C — New T-trap in ai-laziness-traps.md §2

**Target:** `.claude/rules/ai-laziness-traps.md` — three edits in one Worker pass:

1. **§2 catalogue: new `### T<N>` entry** with content per R-phase §1.4 item 1 (counter: «before issuing any recommendation in dialogue, run at minimum ONE verification command and quote its output»). Frame as «inline-verdict-without-evidence» trap; cite parent rule `.claude/rules/phase-research-coverage.md §1.12` and the named anti-pattern `#recommendation-skips-own-discipline` (from `.claude/rules/phase-research-coverage.md §4`).

2. **§3 obligations: add `T<N>` to the kickoff-author T-enumeration mandate** (one-line addition consistent with §3 format).

3. **§5 promotion criterion: add per-T entry** matching R-phase §1.4 item 2 («T<N> → Class A principle test when 3+ documented incidents in `.claude/rules/` or `research-patches/` each with file:line evidence»).

**T-number determination — execute at Worker dispatch time, NOT at kickoff-draft time:**

```bash
HIGHEST_T=$(grep -oE '^### T[0-9]+' .claude/rules/ai-laziness-traps.md | sort -V | tail -1 | sed 's/### T//')
# Specific matcher: Stryker T20 = «equivalence-claim-without-evidence» per memory.
# A third-party T20 (someone else claimed slot first) returns 0 here, which is the
# correct signal — the state table «HIGHEST_T ≥ 20» row applies and a mechanical
# bump uses HIGHEST_T+1; collision only arises at the exact precondition
# «HIGHEST_T=19 AND Stryker queued».
STRYKER_T20_SHIPPED=$(grep -E '^### T20.*equivalence-claim' .claude/rules/ai-laziness-traps.md | wc -l)
echo "HIGHEST_T=$HIGHEST_T  STRYKER_T20_SHIPPED=$STRYKER_T20_SHIPPED"
```

State table → action (HIGHEST_T = highest existing T-number; STRYKER_T20_SHIPPED = `grep -E '^### T20.*equivalence-claim' .claude/rules/ai-laziness-traps.md | wc -l`, refined matcher to distinguish Stryker's specific T20 from any other future T20):

| HIGHEST_T | Stryker T20 (equivalence-claim) in file | Action |
|---|---|---|
| **19** (current at draft) | 0 | **DECISION-NEEDED (S2): HALT Sub-wave C.** Memory `project_stryker_mutation_hardening_done.md` reserves T20 for Stryker «equivalence-claim-without-evidence» (queued follow-up after PR #183). Two legitimate options, maintainer-only call: **(a)** ship this trap as T20 (first to ship claims slot; Stryker bumps to T21 when it ships) OR **(b)** reserve T20 for Stryker per R-phase §1.4 decision and ship this trap as T21. R-phase §1.4 pre-resolved to **(b) = T21**, but the call is maintainer's (collision is mutual-coordination, not technical). |
| **≥ 20** | any (0 or 1) | **T = HIGHEST_T + 1.** Mechanical bump, no DECISION-NEEDED. Covers all post-Stryker-ship states AND the case where T20 was claimed by a third trap (Stryker will then take its own next-free slot when it ships). |

The simplified two-row table eliminates a possible gap where `HIGHEST_T=20` but Stryker had not yet shipped (e.g., a different trap claimed T20 first) — in all `HIGHEST_T ≥ 20` states the mechanical bump is correct; the DECISION-NEEDED collision can only arise at the exact draft-time pre-condition `HIGHEST_T=19 AND Stryker queued`.

**Trap content (regardless of final T-number):**

> **Trigger:** AI issues a recommendation, verdict, or design call (`ADOPT/BUILD/REJECT/DEFER`, «use X», «pick Y over Z», «we should A») in inline dialogue **without having run at least one evidence-bearing tool call** (`Bash | Read | Grep | Glob | WebFetch | WebSearch`) in the same turn — the recommendation is fabricated from training-data or session-recall, not grounded in present-moment verification.
>
> **Tempted output:** «Recommend Option A» / «BUILD verdict for X» / «use jq here» — without preceding grep, file read, or fetch establishing the evidence base; under the false confidence that the H1 always-on reminder substitutes for the verification act it names.
>
> **Counter:** Before issuing any recommendation/verdict in dialogue, run **at least ONE** evidence-bearing tool call in the same turn and **quote its output** (file:line, command result, fetched excerpt). The recommendation is then **backed**, per parent rule [`phase-research-coverage.md §1.12`](../phase-research-coverage.md). This is the operational form of the named anti-pattern [`#recommendation-skips-own-discipline`](../phase-research-coverage.md) (§4).

**§3 obligation update:** append the new T-number to the list of T-numbers in the existing `T-enumeration` example sentence (e.g. «`Active traps for this R-phase: T1, T3, T4, T7, T11, T13, T15, T<N>`»). Match existing prose style.

**§5 promotion criterion (append):**

> `T<N> → Class A principle test when 3+ documented incidents in `.claude/rules/` or `research-patches/` each with file:line evidence; principle test would do post-hoc semantic grep over chat-transcript exports for verdict-words without preceding evidence-tool, with MANUAL classification (per [`narrow-b-benchmark.md §1.5`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md) — automated FP-rate = 84%, gate-class enforcement infeasible without semantic enrichment; recall caveat per same patch §1.3 + §T19 prevents any catch-rate claim without manual classification sample).`

**Verify after edit:**
1. `grep -c '^### T' .claude/rules/ai-laziness-traps.md` → previous count + 1.
2. `npm test -- packages/core/principles/12-ai-laziness-traps.test.ts` → green (principle 12 checks kickoff format; new T-entry must be valid Markdown header).
3. `grep "T<N>" .claude/rules/ai-laziness-traps.md | wc -l` → ≥ 3 (one in §2 header, one in §3 enumeration, one in §5 promotion). Replace `<N>` with chosen number.

### Sub-wave D — NEW rule file recommendation-laziness-discipline.md (Class C)

**Target:** `.claude/rules/recommendation-laziness-discipline.md` (new file).

**WHAT:** create a self-contained Class C rule file that documents:
- The **mechanism layer** (this rule does NOT redefine the discipline; parent rule §1.12 owns the prose).
- The **named anti-pattern catalogue entry** for inline-chat verdict-without-evidence pattern.
- The **promotion criterion to Class A** (incident-counter based).

**Header (per [`doc-authority-hierarchy.md §3`](../../.claude/rules/doc-authority-hierarchy.md)):**

```markdown
# Recommendation-laziness discipline — mechanism layer

> **Class:** C — prose-only, no companion executable artifact. Promotion criterion in §6.
> **Authoritative for:** mechanism layer + named anti-pattern catalogue entry for inline-chat verdict-without-evidence pattern; promotion criterion in §6.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Recommendation discipline rule itself — see [phase-research-coverage.md §1.12](phase-research-coverage.md) (parent rule, source-of-truth for prose discipline). T-trap catalogue — see [ai-laziness-traps.md §2 T<N>](ai-laziness-traps.md) (sibling enforcement surface).

> **Origin:** 2026-05-25. Codifies the mechanism layer that the parent rule [`phase-research-coverage.md §1.12`](phase-research-coverage.md) (introduced 2026-05-22) explicitly defers to a separate enforcement scaffold. R-phase: [`docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md`](../../docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md) (merged PR #206/#207). Benchmark: [`docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md) (merged PR #210; verdict: Option D = A+C only, B dropped).
```

**Body sections (≈ 80–120 lines total; concise, defer detail to research patches):**

- **§1 Problem.** Link to R-phase §0/§1.1 for full evidence base. One-paragraph summary: empirical insufficiency of H1 always-on reminder alone (3 events in one session under live H1 per R-phase §1.1); mechanism layer needed because parent §1.12 leaves enforcement open.
- **§2 Trigger (when this rule fires).** AI session about to issue an inline-chat verdict / recommendation / design call without preceding evidence-bearing tool call. Specifically: `ADOPT/BUILD/REJECT/DEFER`, «we should X», «use Y», «pick A over B», «лучше Z», «выбираем W» — when issued in dialogue without grep/Read/Bash/WebFetch in the same turn.
- **§3 The rule.** Cite parent §1.12 verbatim (block-quote): «Lead with a reasoned recommendation; act when the best path is clear». Then: «Before issuing any verdict/recommendation in dialogue, run at minimum one evidence-bearing tool call in the same turn and quote its output». Make explicit: this file does NOT redefine §1.12 — it operationalises it.
- **§4 Enforcement channel.** Two layers per benchmark verdict:
  - **(A) H1 wording in `inject-session-bootstrap.sh:11`** (Sub-wave A) — always-on UserPromptSubmit injection, deterministic.
  - **(C) T-trap in `ai-laziness-traps.md §2 T<N>`** (Sub-wave C) — auto-loaded session-start via `.claude/rules/*.md` CC convention; path-scoped reinforcement via `inject-matching-rule.sh` when touching `.claude/rules/**`.
  - **(B) Stop-hook scan — EXPLICITLY DROPPED** per [`narrow-b-benchmark.md §1.5`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md): production-corpus FP_rate = 84.2% (Wilson 95% CI [62%, 95%], n=19) >> 20% threshold. Not shipped. Re-introduction requires new R-phase + benchmark (per benchmark §Prevention §4 «двухуровневый подход» — narrow dict + lemma-based matching = future R-phase fork). **Important:** any post-hoc grep tooling proposed in the future MUST account for the benchmark's recall caveat (per same patch §1.3 measurement block + §T19 explicit downgrade — «recall=1.0 on n=10 no-match sample is speculative; не следует интерпретировать как `filter не пропускает настоящих verdicts`»). Automated grep cannot claim catch-rate without manual classification sample.
- **§5 Anti-patterns.** Single named anti-pattern: `#inline-verdict-without-evidence` → cross-reference to T<N> trap (Sub-wave C). Parent anti-pattern is [`#recommendation-skips-own-discipline`](phase-research-coverage.md) (§4); this anti-pattern is its inline-chat-surface specialisation.
- **§6 Promotion to Class A.** Incident-counter based: when 3+ documented in-session violations within 6 months are recorded (file:line evidence in `.claude/rules/` or `research-patches/`), consider mechanical post-hoc grep gate. Per benchmark §1.3 + §T19 recall caveat (recall=1.0 on n=10 is speculative — true recall likely low because most genuine verdict acts live in long turns >750 chars or turns with tool_use), any such gate MUST include a manual classification sample on a representative production corpus (not automated metrics alone). Retirement: 12 months zero-incident → archive to `CLAUDE.md` prose.
- **§See also.** Cross-references to parent §1.12, sibling §1.11, named anti-pattern `#recommendation-skips-own-discipline`, R-phase patch, benchmark patch, ai-laziness-traps T-trap entry.

**Verify after edit:**
1. `npm test -- packages/core/principles/09-doc-authority-hierarchy.test.ts` → green (header format passes).
2. `wc -l .claude/rules/recommendation-laziness-discipline.md` → ≤ 200 (per `.husky/pre-commit` 500-line gate; comfortable ceiling).
3. `grep -l 'phase-research-coverage.md §1.12' .claude/rules/recommendation-laziness-discipline.md` → match (parent rule cited).
4. `grep -l 'narrow-b-benchmark.md' .claude/rules/recommendation-laziness-discipline.md` → match (benchmark cited, B-drop rationale traceable).

---

## §2 Dispatch mode

**Mode A inline Agent (Opus) for all three sub-waves**, parallel-safe with `isolation: "worktree"` per sub-wave (file-lock matrix clean: A → `.sh` hook file, C → `ai-laziness-traps.md`, D → new `recommendation-laziness-discipline.md`).

Dispatch as 3 concurrent `Agent` tool calls in one message:

```javascript
Agent({ subagent_type: "claude", model: "opus", isolation: "worktree",
        description: "Sub-wave A: H1 wording append",
        prompt: "<self-contained prompt referencing §1 Sub-wave A>" })

Agent({ subagent_type: "claude", model: "opus", isolation: "worktree",
        description: "Sub-wave C: T-trap addition",
        prompt: "<self-contained prompt referencing §1 Sub-wave C — INCLUDES the T-number determination bash block; if it returns DECISION-NEEDED, Worker MUST halt and surface (do not pick T-number autonomously)>" })

Agent({ subagent_type: "claude", model: "opus", isolation: "worktree",
        description: "Sub-wave D: new rule file",
        prompt: "<self-contained prompt referencing §1 Sub-wave D>" })
```

**Mode B (file-prompt → Sonnet)** is NOT recommended for this I-phase: tasks are small, output is critical, immediate result needed for Phase 4 sanity check. Opus burn justified.

**Quota expectation:** ~50-80k Opus per sub-wave (Sub-wave D is largest, ~120-150 lines new file). Total umbrella ~200-300k Opus. Within Green zone if session is fresh.

---

## §3 Acceptance criteria per sub-wave

### Sub-wave A

- [ ] Diff visible: `git diff .claude/hooks/inject-session-bootstrap.sh` shows exactly 1 line modified (line 11), append-only (no character removed from existing H1 content except for trailing whitespace).
- [ ] Hook still executes cleanly: `bash .claude/hooks/inject-session-bootstrap.sh > /dev/null && echo OK` → `OK`.
- [ ] Cross-references resolve: `grep -E "recommendation-laziness-discipline\.md|ai-laziness-traps\.md §2" .claude/hooks/inject-session-bootstrap.sh` → both matches present (after Sub-waves C+D complete, paths must point to real files).

### Sub-wave C

- [ ] Principle 12 test passes: `npm test -- packages/core/principles/12-ai-laziness-traps.test.ts` → green.
- [ ] New T-entry present in §2: `grep -c '^### T' .claude/rules/ai-laziness-traps.md` = previous count + 1.
- [ ] New T-number appears in §3 enumeration and §5 promotion criterion: `grep "T<chosen-number>" .claude/rules/ai-laziness-traps.md | wc -l` ≥ 3.
- [ ] Parent rule cited in trap body: trap text contains `phase-research-coverage.md §1.12`.
- [ ] No T-number collision with Stryker T20: either DECISION-NEEDED was resolved by maintainer (S2 stop applied), or Stryker had not shipped T20 at execution time (verified via `grep -E '^### T20' .claude/rules/ai-laziness-traps.md` — empty before this Sub-wave's commit).

### Sub-wave D

- [ ] File created: `ls .claude/rules/recommendation-laziness-discipline.md` → exists.
- [ ] Principle 09 test passes: `npm test -- packages/core/principles/09-doc-authority-hierarchy.test.ts` → green (header format).
- [ ] File length ≤ 200 lines: `wc -l .claude/rules/recommendation-laziness-discipline.md` → ≤ 200.
- [ ] Parent rule cited: `grep -c 'phase-research-coverage.md §1.12' .claude/rules/recommendation-laziness-discipline.md` ≥ 1.
- [ ] Benchmark cited (B-drop traceability): `grep -c 'narrow-b-benchmark.md' .claude/rules/recommendation-laziness-discipline.md` ≥ 1.
- [ ] Cross-reference to T-trap (Sub-wave C) resolves: `grep -E 'ai-laziness-traps\.md.*T[0-9]+' .claude/rules/recommendation-laziness-discipline.md` → matches the chosen T-number from Sub-wave C.

### Umbrella-level (after all three sub-waves)

- [ ] All three commits land on `<branch>` separately (one per sub-wave) or as one logical batch (acceptable since 3 files, no overlap).
- [ ] `git log --oneline <BASE_BRANCH>..HEAD` → 3 commits (or 1 unified) with `Prior-art:` trailer citing R-phase patch + benchmark patch (per CLAUDE.md «Build-vs-reuse invariant»). **Note on Sub-wave D scope:** the new `.claude/rules/recommendation-laziness-discipline.md` file is OUTSIDE the strict `packages/` capability-commit path defined in CLAUDE.md «What is a capability commit?» — therefore the `.husky/pre-push` hook may not mechanically require a trailer for the Sub-wave D commit. **Still include the trailer voluntarily** per the same CLAUDE.md spirit: the R-phase patch (PR #206/#207) and benchmark patch (PR #210) serve as the prior-art evidence base; citing them by path keeps the audit trail explicit for future readers. Use the escape-hatch syntax if the hook complains: `Prior-art: skipped — rule-file codification, not capability commit; evidence base in 2026-05-24/2026-05-25 research patches`.
- [ ] CI green on PR (npm test, principle 09, principle 12, audit-self all pass).

---

## §4 AI-traps active (per [`.claude/rules/ai-laziness-traps.md §2`](../../.claude/rules/ai-laziness-traps.md))

Active trap enumeration for this I-phase:

- **T1** — sampling-based audit floor = 5. Not applicable here (I-phase is targeted edit, not sampling). **SKIP.**
- **T3** — every finding must have file:line + actual content, not prose-only. **APPLIES to all 3 sub-waves**: every claim («line 11 contains X», «T19 is highest», «settings.json denies inject-session-bootstrap.sh») must be backed by command-output or file:line in REPORT.
- **T7** — following the prompt literally instead of reasoning adversarially. **APPLIES to Sub-wave C**: Worker may tick the §1 Sub-wave C bash determination block as «done» without actually re-running it at execution time (or run it but ignore DECISION-NEEDED and pick a T-number autonomously). Counter: T-RLD-IPhase-A domain-specific extension below mandates explicit re-run + halt-on-DECISION-NEEDED; orchestrator verifies T-number choice in REPORT against expected state.
- **T12** — dual-channel for H1 wording claim. **APPLIES to Sub-wave A**: verify the H1 line content against `inject-session-bootstrap.sh:11` directly before editing (do NOT rely on the quoted text in this kickoff alone — kickoff may have drifted). Read the file at edit-time.
- **T15** — recursive self-application: this very mechanism must be capable of firing on its own future output. **APPLIES to all 3 sub-waves**: each Worker is itself a candidate violator of T<N>. Worker MUST run at least one verification command per recommendation in their REPORT (e.g. before claiming «Sub-wave A complete», run `grep` to verify the line changed as intended; quote the output).
- **T19** — own cold-QA pre-handoff. **APPLIES to umbrella close**: orchestrator runs own diff-review across all 3 sub-waves before opening PR; do not hand off to maintainer on green CI alone (CI checks form, not design).

**Trap T-number reservation note (T-RLD-IPhase-A, domain-specific extension per §3 obligation):**

> **T-RLD-IPhase-A — «Sub-wave C T-number race»:** Worker assigned to Sub-wave C may, under time pressure, autonomously pick a T-number without re-running the §1 Sub-wave C bash block at execution time, OR may proceed past DECISION-NEEDED without halting. Counter: Worker prompt MUST include the bash determination block verbatim AND the «halt on DECISION-NEEDED» instruction; orchestrator verifies T-number choice in REPORT against expected state (HIGHEST_T at time of Worker execution, not at kickoff draft time).

---

## §5 Stop conditions

If any of the following fires, **halt that sub-wave** (others may continue if file-disjoint) and escalate to orchestrator / maintainer:

### S1 — settings.json edit needed for wiring

**Trigger:** Sub-wave A discovers (post-edit) that the H1 append requires registering a new hook entry in `.claude/settings.json` for any reason (e.g., new matcher pattern needed because the H1 change broke the existing UserPromptSubmit registration).

**Note:** unlikely for this I-phase — H1 wording append modifies the hook body content, not the registration. But if discovered: deliver the settings.json snippet in PR body for maintainer to apply (per memory `feedback_settings_json_agent_uncommittable`), halt Sub-wave A merge until applied.

### S2 — T-number collision unresolved (Stryker T20 reservation)

**Trigger:** Sub-wave C bash determination returns `HIGHEST_T=19` AND `STRYKER_T20_SHIPPED=0` (queued, not shipped).

**Action:** HALT Sub-wave C. Surface DECISION-NEEDED to maintainer (Russian or English, per orchestrator session language) with both options:

- **Option (a):** Ship this trap as T20 (first to ship claims slot). Stryker re-numbers to T21 when it ships. Implications: minimal disruption to Stryker (Stryker is queued, not yet PR-drafted); slight inconsistency with R-phase §1.4 pre-decision (which reserved T20 for Stryker).
- **Option (b):** Reserve T20 for Stryker per R-phase §1.4 decision and ship this trap as T21. Honours R-phase decision; preserves Stryker's claim. Implications: T20 slot empty in `ai-laziness-traps.md` until Stryker ships (transient gap, harmless).

R-phase §1.4 pre-resolved to **(b) = T21**, but the coordination call is the maintainer's (this is a mutual-coordination collision, not a technical decision). Sub-waves A and D may proceed in parallel — they do not depend on the T-number choice. Sub-wave D's cross-reference to `T<N>` resolves only after Sub-wave C commits — Sub-wave D may stage with a placeholder and amend, OR may also halt to avoid double-commit churn.

### S3 — Sub-wave C optional grep design infeasible per benchmark recall caveat

**Trigger:** Sub-wave C or D Worker attempts to design a post-hoc grep mechanism that claims a catch-rate (e.g., «this grep will catch X% of violations») without manual classification sample, ignoring benchmark §1.3 + §T19 recall caveat (recall=1.0 on n=10 no-match sample is speculative — true recall likely low because most genuine verdict acts live in long turns >750 chars or turns with tool_use).

**Action:** Worker MUST drop the catch-rate claim; reframe any optional grep as «logging-only, manual classification required, NOT a gate». If Worker cannot reframe → halt Sub-wave, escalate. Per benchmark §Prevention §4: «Не шипать broad dict как gate». Sub-wave D §4 enforcement-channel section MUST explicitly drop B per benchmark §1.5 verdict.

**Recovery if S3 fires:** Sub-wave D ships A+C-only enforcement channels (no B mention beyond the explicit «DROPPED per benchmark» rationale). Sub-wave C ships T-trap as catalogue entry only (no companion principle test in this I-phase — promotion criterion stays §6 prose).

---

## §6 Anti-scope (do NOT touch)

- **NOT editing `.claude/settings.json`** — agent-uneditable (deny-list verified). If hook wiring change becomes necessary, deliver snippet in PR body for maintainer.
- **NOT promoting to Class A in this I-phase** — insufficient evidence (Class C is correct first-codification per [`README.md absolutism research-patch 2026-05-16`](../../docs/meta-factory/research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md)). Promotion criterion stays §6 prose («3+ incidents in 6 months → consider mechanical gate»).
- **NOT editing R-phase research patches** (`2026-05-24-recommendation-laziness-discipline.md`, `2026-05-25-narrow-b-benchmark.md`) — merged, frozen per `research-patches/` folder authority. Any new finding goes in a new follow-up patch.
- **NOT re-adding Sub-wave B (Stop-hook scan)** — explicitly dropped per benchmark §1.5. Re-introduction requires new R-phase + benchmark.
- **NOT claiming higher precision for any post-hoc grep** without manual classification sample — benchmark §1.3 + §T19 recall caveat is load-bearing (no automated grep may claim catch-rate; manual classification on representative production corpus is mandatory before any «X% of violations caught» framing).
- **NOT editing parent rule `phase-research-coverage.md §1.12`** — parent rule owns prose discipline; this I-phase ships mechanism only. Any prose revision to §1.12 is separate scope.
- **NOT editing `ai-laziness-traps.md §2` entries T1-T19** — only ADD new T entry; existing entries are stable history.
- **NOT touching `.claude/skills/meta-orchestrator/**` or `helpers/**` or `templates/**`** — F.3 scope, parallel-safe boundary.
- **No drive-by PRs** if Worker notices systemic issues outside Sub-wave scope (per [`CLAUDE.md «PR strategy»`](../../CLAUDE.md)) — surface as observation in REPORT, do NOT autonomously spawn additional PR.

---

## §7 Handoff to next session

**This kickoff session ONLY writes the kickoff file** (per maintainer instruction). It does NOT dispatch Workers.

After this kickoff is created + Phase -1 GO is recorded in §-1 amendments log (orchestrator session adds an `## §-1 amendments log` section at the bottom of this file capturing each review cycle's findings + amendments), the maintainer runs the next session with the meta-orchestrator skill:

```text
/meta-orchestrator recommendation-laziness-discipline-i-phase
```

`/meta-orchestrator` will:

1. Run plan-currency check (§1): verify §-1 bash blocks still produce the expected results (T-number state, settings.json deny-list, H1 line content, benchmark verdict still in repo).
2. Generate launch-table (§3): tabulate Sub-waves A/C/D with their target files, modes, parallel-safety, and acceptance criteria.
3. Write meta-kickoff (§4): self-contained dispatch prompts for each Sub-wave Worker.
4. Propose dispatch (§5): maintainer confirms → 3 concurrent `Agent` calls launch.

---

## See also

- [`docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md`](../../docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md) — R-phase design (SSOT for prior-art + binding I-phase scope).
- [`docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md) — benchmark patch (SSOT for Option D = A+C verdict + recall caveat).
- [`.claude/rules/phase-research-coverage.md §1.12`](../../.claude/rules/phase-research-coverage.md) — parent rule (prose discipline source-of-truth); §1.11 (sibling); §4 `#recommendation-skips-own-discipline` (named anti-pattern this I-phase operationalises).
- [`.claude/rules/ai-laziness-traps.md`](../../.claude/rules/ai-laziness-traps.md) — Sub-wave C target; T11/T12/T19 (existing surface-mismatch traps); §3 obligations format; §5 promotion criteria format.
- [`.claude/rules/doc-authority-hierarchy.md §3`](../../.claude/rules/doc-authority-hierarchy.md) — Sub-wave D header format spec.
- [`.claude/rules/rule-enforcement-channel-selection.md §3-§4`](../../.claude/rules/rule-enforcement-channel-selection.md) — channel selection rationale (applied in R-phase §1.3).
- [`.claude/rules/build-first-reuse-default.md`](../../.claude/rules/build-first-reuse-default.md) — `Prior-art:` trailer + 7-verdict mandate for capability commits.
- [`.claude/hooks/inject-session-bootstrap.sh:11`](../../.claude/hooks/inject-session-bootstrap.sh) — Sub-wave A target (H1 line).
- [`.claude/orchestrator-prompts/recommendation-laziness-discipline/kickoff.md`](../recommendation-laziness-discipline/kickoff.md) — R-phase kickoff (this I-phase's predecessor).
- [`.claude/orchestrator-prompts/narrow-b-benchmark/kickoff.md`](../narrow-b-benchmark/kickoff.md) — benchmark kickoff (this I-phase's blocking dependency, now resolved per PR #210).
- Memory `project_stryker_mutation_hardening_done.md` — Stryker T20 reservation (S2 collision source).
- [`packages/core/principles/09-doc-authority-hierarchy.test.ts`](../../packages/core/principles/09-doc-authority-hierarchy.test.ts) — Sub-wave D acceptance gate.
- [`packages/core/principles/12-ai-laziness-traps.test.ts`](../../packages/core/principles/12-ai-laziness-traps.test.ts) — Sub-wave C acceptance gate.

---

## §-1 amendments log

### Iter 1 → Iter 2 (2026-05-25, orchestrator amendment)

**Reviewer:** 1× Opus cold-reviewer (Mode A inline `Agent`, focus areas a/b/c per §-2). Verdict: **REVISE** — 0 BLOCKER, 3 MAJOR, 6 MINOR.

**MAJOR findings fixed:**

- **M1 — benchmark §1.4 → §1.3+§T19 (7 occurrences).** Reviewer caught: benchmark §1.4 = «Char-count threshold N» (N=750 rationale), NOT recall caveat. The recall caveat lives in §1.3 Метрики block (`recall = TP/(TP+FN) = 3/3 = 1.0 (грубо; n=10 no-match sample only)`) and §T19 Cold-QA explicit downgrade («speculative; не следует интерпретировать как `filter не пропускает настоящих verdicts`»). Verified by re-reading benchmark file. Seven occurrences corrected: §-2 focus (b), §0 bullet 2, §1 Sub-wave C §5 promotion criterion text, §1 Sub-wave D §4 «Important» clause, §1 Sub-wave D §6 promotion text, §5 S3 trigger, §6 anti-scope bullet. (Original iter-1 reviewer estimated «6» occurrences; actual count was 7 — iter-2 reviewer corrected this as N1 cosmetic finding.)
- **M2 — R-phase owner contradiction (Sub-wave A).** Reviewer caught: R-phase §1.4 item 4 lists `inject-session-bootstrap.sh` as `maintainer-only` based on assumed deny-list entry that doesn't exist. Kickoff §0 cites R-phase §1.4 as binding scope SSOT, then §1 Sub-wave A silently overrode item 4's owner field — a Worker following R-phase verbatim would halt. Fix: added explicit override paragraph in Sub-wave A documenting the deny-list re-verification result + cross-reference to §-1 step 4 (re-verify at execution time; flip back to snippet delivery if the deny-list later changes).
- **M3 — T-number state table gap (HIGHEST_T=20, Stryker=0).** Reviewer caught: original 3-row table didn't handle the case where someone else claimed T20 before Stryker. Simplified to 2 rows: `HIGHEST_T=19 + Stryker queued = DECISION-NEEDED` vs `HIGHEST_T ≥ 20 = mechanical bump (HIGHEST_T+1)`. Also tightened the bash matcher: `grep -E '^### T20.*equivalence-claim'` distinguishes Stryker's specific T20 from any other future T20 (the case where T20 was claimed by a third trap still maps to mechanical bump correctly).

**MINOR findings addressed:**

- **m2 — §4 cited `§3` (obligations) instead of `§2` (catalogue).** Fixed: header now reads `per .claude/rules/ai-laziness-traps.md §2`.
- **m5 — Prior-art trailer ambiguity for Sub-wave D** (file outside `packages/` capability-commit path). Fixed: §3 umbrella criterion now explicitly notes the trailer is voluntary per CLAUDE.md spirit + provides escape-hatch syntax.
- **m6 — T7 (follow-prompt-literally) missing from active traps.** Fixed: added T7 explicitly with Sub-wave C application (bash-block determination + DECISION-NEEDED halt obligations).

**MINOR findings deferred / acknowledged as known-residual:**

- **m1 — Sub-wave A suggested wording produces a double-parenthetical** in the H1 line. Acknowledged but NOT pre-resolved in kickoff: the Worker is the right party to compose final wording at edit-time (Sub-wave A acceptance criterion includes «only 1 line modified, no character removed from existing H1 content except trailing whitespace» — Worker may compose cleaner phrasing that satisfies the constraint). Falsifier (read actual line before editing) catches structural issues.
- **m3 + m4 — cascade of M1 fix into shipped template text** (Sub-wave C §5 promotion criterion + Sub-wave D §4 «Important» clause). Both already corrected as part of M1 fix.

**Re-review status:** iter 2 cold-review pending (next §-1 step). If GO → orchestrator session terminates with handoff command. If REVISE again → iter 3 (final per skill max-3 limit; escalate to maintainer if still REVISE).

### Iter 2 (2026-05-25, orchestrator amendment)

**Reviewer:** 1× Opus cold-reviewer iter-2 re-review (focused on iter-1 fixes per §-1 protocol). Verdict: **GO**.

**RESOLVED status per iter-1 finding:**

- M1 → RESOLVED (all 7 §1.4-recall references corrected; iter-1 «six» count was off by one — see N1 below).
- M2 → RESOLVED (Sub-wave A override paragraph present + conditional flip-back instruction).
- M3 → RESOLVED (2-row table handles all reachable states; refined bash matcher distinguishes Stryker's T20 from third-party T20).
- m2 → RESOLVED (§4 header cites §2).
- m5 → RESOLVED (Sub-wave D Prior-art trailer voluntariness + escape-hatch syntax).
- m6 → RESOLVED (T7 entry added with Sub-wave C application + T-RLD-IPhase-A cross-reference).

**NEW iter-2 findings:**

- **N1 (MINOR cosmetic) — log count off-by-one.** Iter-1 log said «Six occurrences corrected» but 7 sites were fixed. Reviewer flagged as cosmetic-only (operative kickoff content correct at all 7 sites; impacts log accuracy, not Worker behaviour). **Fixed in this iter-2 amendment** (M1 entry above now says «Seven occurrences»).

**Re-review complete. Kickoff GO for handoff to next session.**

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
