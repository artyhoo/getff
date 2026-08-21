# defer-reflex-mechanical-detection — kickoff (umbrella)

> Created 2026-05-25. Mode: R-phase first → benchmark → I-phase (conditional on benchmark verdict).
> Base branch: `staging`. Single source of truth: this file.

## §0 Cold-start verify (run before drafting anything)

```bash
git fetch origin staging --quiet
gh pr list --state merged --search "merged:>=2026-05-18" --json number,title --limit 30 | jq -r '.[] | "#\(.number) \(.title)"'
gh pr list --state open --json number,title,headRefName --limit 10 | jq -r '.[] | "OPEN #\(.number) \(.title) <- \(.headRefName)"'
ls ~/.claude/projects/-Users-art-code-rules-as-tests-aif/*.jsonl 2>/dev/null | wc -l   # session transcripts available for benchmark
```

Expected post-#226: PRs #213/#214/#217/#222/#223/#225/#226/#224 all in last-30d merged window. No open PR'ов.

## §1 Origin & problem

**3 documented incidents — same defer-pattern, same person, same memory loaded, recurred anyway:**

| # | Date | Event | Memory loaded at time of incident |
|---|------|-------|-----------------------------------|
| 1 | 2026-05-21 | Marked verified epic PR `[ ]` maintainer-owned | `feedback_no_human_verification_ai_self_verifies` directive surfaced same session |
| 2 | 2026-05-22 | PR #163 — clean correction PR, 22/22 green, left for maintainer click | Memory now contained Recurrence #1 entry |
| 3 | 2026-05-25 | PR #226 — own work, own cold-QA GO, 29/29 green, wrote «maintainer's click required» | Memory now contained Recurrence #2 entry + explicit rule «merge verified staging PRs yourself» |

**Falsified hypothesis:** «text-recall via memory entry is sufficient». Three recurrences with memory loaded refute it definitively.

**Maintainer diagnosis:** mutual-deferral antipattern at the text-recall layer. The pattern survives text-level discipline because the agent rationalises differently each time (incident 2 used «staging buffer» framing, incident 3 used «creating PRs requires confirmation» framing) — same defer act under different surface justifications. Need a channel below text-recall.

## §2 What's required (definition of done)

A mechanical detection mechanism that fires WHEN AND ONLY WHEN: an AI session is about to emit a final report that contains a defer-tell phrase **AND** the contextual evidence supports that the deferred PR is the session's own with green CI.

**Defer-tell phrase candidates (seed list — R-phase extends):**

- «maintainer click required»
- «awaiting your decision»
- «ready for merge»
- «жду твой клик»
- «жду решения»
- «требуется ваше одобрение»
- «pending maintainer review»
- «[ ] maintainer-owned»
- «ready for review and merge»

**Contextual evidence signals (R-phase decides which combine):**

- Recent tool call: `gh pr view <number>` returned `state=OPEN` + author matches session identity
- Recent tool call: `gh pr checks <number>` returned all SUCCESS or `ci-success` pass
- Recent tool call: `gh pr create` was issued by session itself
- Negation signal: no `gh pr merge` issued for this PR number after the create

## §3 Stages

### Stage 1 — R-phase (Mode A inline, ~50-80k Opus)

**Output:** `docs/meta-factory/research-patches/<YYYY-MM-DD>-defer-reflex-detection.md`

Required sections:
- §0.1 Cold-start verify (re-run §0 above)
- §0.2 Population enumeration (T10) — count of `*.jsonl` session files in `~/.claude/projects/-Users-art-code-rules-as-tests-aif/`. State sampling strategy.
- §1 Prior-art (T11/T12/T16 mandatory, build-first-reuse-default §3 6-item):
  - `.claude/rules/recommendation-laziness-discipline.md` — closest internal precedent. §4 (A) always-on UserPromptSubmit + §4 (B) Stop-hook **DROPPED** per `narrow-b-benchmark.md` FP=84%. Document why B was dropped + whether defer-tell vocab is narrow enough to escape that fate.
  - `.claude/rules/ai-laziness-traps.md` §2 T20 — operational form of `#recommendation-skips-own-discipline`. T-DRD candidate for catalog if mechanism ships.
  - Superpowers `using-superpowers` skill Red Flags table — ADAPT VOCABULARY candidate (13-entry rationalisation tracker). SSOT #71 REJECT verdict scoped to «delegation-vs-decision», NOT defer-reflex specifically — re-evaluate.
  - DeepWiki + WebSearch ≥3 phrasings: «AI agent self-merge defer detection», «behavioral discipline hook AI assistant», «LLM agent self-authority-deferral pattern detection». Cite candidates, mark each ADOPT/ADAPT/REJECT/BUILD with T16 problem-class check.
- §2 Phrase catalog — final list of defer-tell phrases (RU + EN). Include negative examples («maintainer click required» in quoted dialogue ≠ violation; «if you want me to merge, say го» = legitimate question).
- §3 Detection mechanism design — concrete proposal: Stop-hook OR PostToolUse-on-AskUserQuestion OR something else. Must specify:
  - WHEN it fires (event)
  - WHAT it reads (draft text + tool history)
  - WHAT it asserts (regex + contextual gate)
  - WHAT it does (block via decision=block, or inject reminder, or stdout-only?)
  - HOW it's tested (paired-negative arms: positive=defer-on-own-PR / negative=defer-phrase-in-different-context)
- §4 Falsifiers — 3+ scenarios where the proposed mechanism would be wrong (e.g., legitimate defer when PR has open conversations from external reviewer; legitimate defer on first-of-kind change; cross-PR discussion mentioning «maintainer click»).
- §5 §1.7 self-reflexive check — does this rule comply with `phase-research-coverage.md §1.12`, `no-paid-llm-in-ci.md §1`, `dual-implementation-discipline.md §3` (CC-internal hook = §3.i exemption or §3.iii one-off?).
- §6 Active T-trap citations (mandatory per ai-laziness-traps.md §3): T11, T12, T15, T16, T20, plus one domain-specific `T-DRD-A` defined inline.

### Stage 2 — Benchmark (Mode A inline, ~30-50k Opus)

**Output:** `docs/meta-factory/research-patches/<YYYY-MM-DD>-defer-reflex-benchmark.md`

**Corpus:** `~/.claude/projects/-Users-art-code-rules-as-tests-aif/*.jsonl` session transcripts. Sample size ≥ 100 turns matching seed regex (precision) + ≥ 30 turns NOT matching but in own-PR-merge-decision context (recall).

**Compute (deterministic, no LLM):**
- **Precision:** of N turns flagged by detector, how many were ACTUAL defer-incidents (true positive)? Manual classification. Wilson 95% CI.
- **Recall:** of K known defer-incidents (the 3 above + any surfaced by full-corpus grep), how many were caught? Manual classification on representative no-match sample.

**Verdict thresholds (codified upfront, no slipping post-hoc):**
- Precision < 80% (FP > 20%) → drop the post-hoc mechanism (same threshold as narrow-b-benchmark.md). Try always-on H-text only OR scope-narrow.
- Recall < 40% on known incidents → drop OR widen vocab.
- Both fail → REJECT — return to text-recall + design path forward.
- Both pass → GO Stage 3.

**Caveat (load-bearing, per narrow-b-benchmark.md §1.3 + §T19):** recall-on-no-match-sample is speculative; the true recall claim must come from manual classification on a representative production sample, not from automated counter-grep. Document this caveat verbatim.

### Stage 3 — I-phase (conditional on Stage 2 GO; design depends on Stage 1 mechanism choice)

Sub-waves not pre-decided — Stage 1 mechanism design determines breakdown. Likely shape:
- Sub-wave A: hook implementation (.claude/hooks/defer-reflex-check.sh OR extension to end-of-turn-reminder.sh)
- Sub-wave B: T-trap addition to ai-laziness-traps.md §2 (slot T21 — T20 taken by recommendation-laziness)
- Sub-wave C (if mechanism is gate-class): companion test in tests/hooks/
- Sub-wave D (if creates new rule): .claude/rules/defer-reflex-detection.md with Class A/B/C per shipped mechanism

## §4 Anti-scope

- ❌ NOT widen to other AI-laziness patterns (T1 sampling-shallow, T4 premature closure, T7 prompt-pattern-matching). Each gets its own R-phase if mechanisation needed; do NOT bundle. Atomic-umbrella discipline.
- ❌ NOT use paid LLM (no-paid-llm-in-ci.md §1).
- ❌ NOT codify in memory only — memory recurrence is the problem being solved (`#memory-as-primary-channel` per rule-enforcement-channel-selection.md §5).
- ❌ NOT skip benchmark and ship always-on H-text alone — that's the falsified hypothesis (3 incidents with H-text-equivalent loaded).
- ❌ NOT propose mechanism without §1 prior-art consult. The narrow-b-benchmark FP=84% is the lesson; learn it first.

## §5 Hard constraints

- **no-paid-llm-in-ci.md §1**: deterministic regex/grep over draft + transcript only.
- **build-first-reuse-default.md §3**: 6-item search check mandatory in Stage 1 §1.
- **phase-research-coverage.md §1.12 + §1.11**: recommendation grounded in tool-call evidence; verify-against-source-of-truth before any «X exists» / «X doesn't exist» claim.
- **doc-authority-hierarchy.md §3**: any new rule under `.claude/rules/*.md` carries Class + Authoritative-for header.
- **dual-implementation-discipline.md §3 + §6**: CC-native hook is acceptable as internal-only tooling with `@cc-only-rationale` marker; if shipped to consumer, requires dual-channel design.
- **parallel-subwave-isolation.md §1**: any Mode B sub-wave dispatch uses `git worktree add`.
- **ai-laziness-traps.md §3**: kickoff cites trap rule, enumerates active T-numbers, adds 1+ domain-specific trap (T-DRD-A above is the seed; R-phase extends).

## §6 Falsifiers (whole umbrella)

- Stage 1 surfaces an existing upstream tool that solves this problem class → ADOPT/ADAPT, not BUILD.
- Stage 2 benchmark fails both precision + recall thresholds → REJECT umbrella; defer-reflex remains a text-recall discipline accepting periodic recurrence as cost.
- Mechanism requires session-state the hook can't access (e.g., assistant draft text not exposed to Stop hook) → REJECT or scope-narrow.
- Recurrence #4 happens during the umbrella itself (the agent defers WHILE building defer-detection) → counts as confirming evidence, not failure.

## §7 Active AI-laziness traps (cite ai-laziness-traps.md §2 explicitly; kickoff §3 obligation)

- **T11** — designing custom mechanism without external prior-art check. Counter: §1 mandatory.
- **T12** — skipping literature sweep because «I know this area». Counter: WebSearch ≥3 phrasings in §1 even if Worker «remembers» relevant tools.
- **T15** — self-application skipped. Counter: §1.7 self-reflexive check mandatory in Stage 1 §5; verify Stage 1 itself doesn't defer-tell.
- **T16** — pattern-matching-on-name. The recommendation-laziness Stop-hook is NOT the defer-tell Stop-hook just because both end in «hook». Verify problem-class match explicitly: «narrow-b's problem = verdict-words in any turn; ours = defer-phrase in own-PR-merge-decision context. Match? evidence: …».
- **T17** — destructive delegation. Counter: R-phase produces docs only; no destructive ops.
- **T19** — own cold-QA before handoff. Counter: dispatch cold-review subagent on Stage 1 + Stage 2 outputs BEFORE marking ready.
- **T20** — inline-verdict-without-evidence. Counter: every «BUILD/ADAPT/REJECT» in §1 prior-art table cites Bash/WebFetch/grep evidence + file:line.
- **T-DRD-A (NEW, domain-specific)** — **«proposing always-on H-text as the primary mechanism without benchmark»**. Already empirically falsified by 3 incidents (§1). If Stage 1 proposal centers on H-text alone as PRIMARY channel, Stage 1 has failed its own falsifier. Counter: H-text may APPEAR as secondary reinforcement; the primary channel MUST be deterministic mechanical detection.

## §8 §1.7 Forward+Backward stubs for I-phase PR bodies (template)

```markdown
### §1.7 Forward-check applied

- `no-paid-llm-in-ci.md §1` (file:line: `<rule-file>:<line>`) — mechanism is deterministic grep/regex; zero API-billed calls.
- `recommendation-laziness-discipline.md §4` (file:line: `<rule-file>:<line>`) — sibling precedent for AI-discipline mechanical detection; this PR extends the pattern to defer-reflex.
- `build-first-reuse-default.md §3` (file:line: `<rule-file>:<line>`) — prior-art consult done in Stage 1 R-phase; BUILD/ADAPT verdict cited per upstream candidate.
- `ai-laziness-traps.md §2 T<NN>` (file:line: `.claude/rules/ai-laziness-traps.md:<line>`) — new T-trap entry added/referenced.
- `dual-implementation-discipline.md §3` — channel-selection rationale (internal-only @cc-only-rationale OR consumer-facing @dual-pair).

### §1.7 Backward-check applied

- Incidents 2026-05-21/#163/#226 cited as origin in `feedback_no_human_verification_ai_self_verifies.md:<line>` and resolved structurally by this mechanism.
- No other artefact silently superseded; scope strictly defer-reflex detection.
- Companion test added at `tests/<location>/<test-name>.test.sh:<line>`; CI integration verified at `.github/workflows/audit-self.yml:<line>`.
- `narrow-b-benchmark.md` lesson applied: benchmark FP before shipping post-hoc detector; verdict GO/NO-GO documented in Stage 2 patch.
```

## §9 See also

- `.claude/rules/recommendation-laziness-discipline.md` — closest mechanism precedent (Option D=A+C, B-drop lesson)
- `.claude/rules/ai-laziness-traps.md §2 T20` + §5 — trap catalog promotion criterion
- `.claude/rules/rule-enforcement-channel-selection.md §1` + §4 — two-axis principle (detectability → gate/inject; relevance → breadth)
- `.claude/rules/phase-research-coverage.md §1.7 / §1.11 / §1.12` — recommendation discipline parent
- `docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md` — R-phase template
- `docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md` — benchmark template + B-drop lesson
- `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_no_human_verification_ai_self_verifies.md` — 3 incident log (Recurrence #1/#2/#3)
- This kickoff lives at `.claude/orchestrator-prompts/defer-reflex-detection/kickoff.md` (gitignored, local-only)

## §10 How to start next session

```
/meta-orchestrator defer-reflex-detection
```

Or — if the session loader prefers explicit Mode framing — paste this kickoff §1 + §3 Stage 1 block into a fresh Opus session under `/orchestrator` and tell it «R-phase only, return research-patch».

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
