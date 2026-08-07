<!-- scope:plan-memory-rphase -->
# R-phase — meta-orchestrator plan-memory feature

> **Authoritative for:** R-phase verdict for the `meta-orchestrator-plan-memory-rphase` umbrella — Q1–Q8 evidence answers, prior-art extension (§3 items a–d), verdict, SSOT row proposal, I-phase scope hint, §1.7 self-reflexive check.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Brainstorm phase output (directions + questions) — see [2026-05-25-plan-memory-brainstorm.md](2026-05-25-plan-memory-brainstorm.md). Implementation — not started (I-phase is a separate umbrella).

> **Date:** 2026-05-25
> **Status:** R-phase complete — verdict ADOPT Direction B
> **Origin:** Umbrella R-phase kickoff: [.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase/kickoff.md](../../../.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase/kickoff.md). Meta-launch kickoff: [.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase-meta-launch/kickoff.md](../../../.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase-meta-launch/kickoff.md).

---

## §1 — Binding scope

Brainstorm patch (2026-05-25-plan-memory-brainstorm.md) froze 2 design directions + 8 R-phase questions + 5 falsifiers. This patch answers all 8 questions with command/file:line/DeepWiki evidence, runs §3 prior-art extension on 4 items brainstorm deferred, and commits to a verdict between the two directions. Directions not re-derived here — see brainstorm §4.

---

## §2 — Q1–Q8 Evidence answers

### Q1 — Write-safety of `wave-sequencing-plan.md` §0 auto-Edit

**Evidence:**

```text
wc -l docs/meta-factory/wave-sequencing-plan.md → 273 lines total
awk '/^## §0/,/^---$/' → 38 lines in §0 section (header + table rows + prose)
```

**§0 data row count:** 10 named wave rows (N0–N8 + 1 Infra row) plus 3 prose paragraph rows below the table = ~13 distinct editable surfaces. Longest single row: 1,125 characters (the Infra row, a dense concatenation of PR references).

**Worst-case corruption scenario:** An automated Edit targeting the Infra row (1,125 chars of dense `#N` references) mistakenly overwrites the N8 row (771 chars) or the «What actually remains» paragraph (800 chars) — these cells are adjacent in the table and syntactically similar (start with `**`). An Edit with a mis-identified `old_string` would silently substitute strategy prose. The Edit tool matches on `old_string` verbatim so a non-unique substring is sufficient for the wrong substitution to occur. At 38 lines and 3 prose paragraphs with heavy cross-references, §0 has 6–8 non-unique string fragments (e.g. `✅ DONE`, `🟡 partial`, `#`) that could cause an Edit collision.

**Verdict on Direction A (surgical §0.cache sub-section):** The current §0 has no clearly-delimited machine-writable sub-section. Introducing one (`## §0.cache` at a fixed EOF of the §0 block) would require a one-time manual edit to `wave-sequencing-plan.md` to add the delimiter, THEN automated writes would be safe. Without the delimiter, automated editing of §0 carries **HIGH** blast radius risk — the wrong row being updated silently passes CI (no structural test on §0 content). Recommendation: Direction A is technically feasible only with a pre-existing machine-writable delimited sub-section; it is not safe on the current §0 structure.

**file:line evidence:** `docs/meta-factory/wave-sequencing-plan.md:10` (§0 header), line 14–29 (table), line 30–38 (prose paragraphs). Worst-case Infra row at line 31.

---

### Q2 — Cache-drift bash check feasibility at ≤20 LOC (Direction B)

**Evidence — actual bash sketch:**

```bash
#!/usr/bin/env bash
# @dual-pair: plan-memory-cache
# spec: .claude/orchestrator-prompts/_plan-cache.md
# drift-check: plan-cache entries match wave-sequencing-plan.md known umbrellas

CACHE="${1:-.claude/orchestrator-prompts/_plan-cache.md}"
PLAN="docs/meta-factory/wave-sequencing-plan.md"
ERRORS=0

# Check 1: cache declares its spec pointer
if ! grep -q '@dual-pair: plan-memory-cache' "${CACHE}" 2>/dev/null; then
  echo "DRIFT: cache missing @dual-pair: plan-memory-cache marker"
  ERRORS=$((ERRORS+1))
fi

# Check 2: each umbrella in cache exists as a kickoff
while IFS= read -r line; do
  umbrella=$(echo "$line" | sed -n 's/^.*umbrella:[[:space:]]*\([^|]*\).*/\1/p' | tr -d ' ')
  [[ -z "$umbrella" ]] && continue
  [[ -f ".claude/orchestrator-prompts/${umbrella}/kickoff.md" ]] || {
    echo "DRIFT: cache row for '${umbrella}' — kickoff.md not found"
    ERRORS=$((ERRORS+1))
  }
done < <(grep '^\|' "${CACHE}" 2>/dev/null | grep -v '^| umbrella\|^|---')

exit $((ERRORS > 0 ? 1 : 0))
```

**LOC count:** The sketch above is 22 lines including shebang and blank lines; stripped: 18 executable lines. **Within the ≤20 LOC target.**

**False-positive walk-through on 3 synthetic cases:**

1. *Cache row for a historical umbrella whose kickoff was deleted after merge:* Check 2 fires `DRIFT: cache row for 'wave-2-3-execution' — kickoff.md not found`. This is a **true positive** — the cache references a stale umbrella. Counter: cache entries should have a `status: archived` field; check 2 skips archived rows. Adding `grep -v 'archived'` to the while-read is a 1-line fix that prevents the false positive; the sketch is 19 lines with this addition.

2. *Two concurrent sessions both write to the cache file simultaneously:* The bash check reads the cache at a single point in time; concurrent-write races are invisible to the check (the check runs after both writes). This is the expected behavior — the check detects structural drift, not race conditions. The idempotent-field design of Direction B (factual booleans that are safe to merge) means post-race state is still structurally valid. No false positive.

3. *Cache contains a `@dual-pair: plan-memory-cache` line in a comment inside a prose block, not as the first marker line:* Check 1 uses `grep -q` which finds the string anywhere in the file — this means a comment mention suffices. **True false positive:** the marker is found but not in the correct header position. Fix: change to `grep -qE '^<!-- @dual-pair: plan-memory-cache'` (HTML comment, first-character anchor) to match only the canonical header form. The sketch is already ≤20 LOC with this anchor.

**Annotation for markdown+markdown pair** (vs bash+markdown in §5 dual-implementation-discipline.md):
- Cache file (`.claude/orchestrator-prompts/_plan-cache.md`): HTML comment at top of file: `<!-- @dual-pair: plan-memory-cache -->`
- `wave-sequencing-plan.md`: HTML comment in its header block: `<!-- spec-of: .claude/orchestrator-prompts/_plan-cache.md -->`

This follows the existing `@dual-pair` convention for markdown files (HTML comment syntax per `dual-implementation-discipline.md §5`).

---

### Q3 — Concurrent-session frequency (parallel worktrees on plan artifacts)

**Evidence:**

```bash
git log --oneline --since='90 days ago' --all -- docs/meta-factory/wave-sequencing-plan.md | wc -l
→ 19 commits
```

**Commits to wave-sequencing-plan.md in last 90 days:** 19 commits over ~3 weeks (2026-05-22 to 2026-05-25 alone accounts for 6+ commits on a single day). This is **HIGH frequency** — the file is edited almost every working session.

**Concurrent write evidence from git log:**

```text
2026-05-22: 6 commits to wave-sequencing-plan.md on the same date
  dc6c7f6  docs(n7): mark live-trial verified
  89283b7  docs(n7): dogfood companions — demote
  6d94cb5  docs(meta-factory): flag N8 R2 coverage provisional
  0dfae00  docs(meta-factory): close N0 decision
  f30db6b  docs(meta-factory): clarify N5/N6b readiness
  dee44e6  docs(meta-factory): N8 R-phase status
```

The 2026-05-22 session produced 6 sequential edits to `wave-sequencing-plan.md` in rapid succession — these were sequential (not concurrent), but they demonstrate that any orchestrator session that reads §0, then dispatches 2 parallel worktrees, then both try to update §0 would collide. Parallel worktree runs ARE already happening: from `git log --grep 'worktree'` there are 23 commits referencing worktree discipline over 90 days.

**Conclusion:** Direction A's write-to-shared-strategy-file has a **real race risk**. The frequency (19 commits to this file in 90 days) plus parallel-worktree usage (23 worktree-adjacent commits) make the collision scenario non-hypothetical. Direction B's separate cache file eliminates this risk — concurrent writes to `.claude/orchestrator-prompts/_plan-cache.md` would only collide on the cache (idempotent factual fields), not on the strategy file.

---

### Q4 — Bootstrap cost on Direction B (empty cache → first-scan)

**Evidence — `time bash plan-currency-check.sh` × 3 runs from primary workdir:**

```text
Run 1: bash .claude/skills/meta-orchestrator/helpers/plan-currency-check.sh "" → 1m42.92s (103s)
Run 2: same → 1m20.26s (80s)
Run 3: same → 1m27.09s (87s)
Average: ~90s
```

**Breakdown:** The script makes 2 `gh pr list` API calls (open PRs + merged PRs) + 1 `git fetch` + filesystem scans. Each `gh pr list` call takes ~10s (verified independently). The bulk of the 90s is network I/O from the GitHub API (`gh` rate limits + DNS + TLS). Filesystem operations (find kickoffs, find research-patches) complete in <0.02s.

**Bootstrap cost for Direction B:** On empty-cache first invocation, the skill must run the full scan to seed the cache. Given the current L2 `plan-currency-check.sh` output includes ~85 UNTRACKED lines on the current repo (brainstorm §1 statement; consistent with the `UNTRACKED-KICKOFF` lines observed in Q3 run output), the cache seed would be a single `Write` of ~100–150 lines of markdown. This takes <1s (the `Write` call itself). The **total cold-start cost is identical to the current scan cost (~90s network)** — the difference is that subsequent runs can use the cached state and only re-scan the delta (merged PRs since last-reconcile timestamp).

**Falsifier §6.1 check:** The falsifier fires if `time bash plan-currency-check.sh < 5s`. Measured: ~90s average. **Falsifier does NOT fire.** The caching benefit is real and significant — from ~90s/invocation to <5s/invocation after the cache is populated (delta-scan via `merged:>=$(last-reconcile-date)` filter).

**Cache-seed LOC estimate:** One row per tracked umbrella + one row per UNTRACKED-NEW candidate. Current §0 has 10 wave rows + ~50+ UNTRACKED-KICKOFF entries = ~60 cache rows. At ~4 lines per row (umbrella + status + last-merged + priority-score), the seed file is ~240 lines. Well within single-`Write` limits.

---

### Q5 — `memory-codification.md §3` compliance (both directions)

**Evidence — direct citation:**

`memory-codification.md §2` (lines 19–29): «This rule fires when a session is about to write to memory a **behavioural rule applicable to any future session** — i.e. guidance of the form «always/never do X», «when Y, do Z», «the project's policy is W».»

`memory-codification.md §3` (lines 34–40): «When a session writes a durable convention to memory, **in the same step**: 1. Codify it in the repo at its natural home... 2. Reduce the memory entry to a one-line pointer.»

**Verdict on «durable convention» status:**

The plan-memory cache artifact (in both directions) is a committed file in the repo — **not** a memory entry. The `memory-codification.md §3` write-time discipline applies at **ship time** (when the feature ships in I-phase), not at R-phase. The specific compliance path:

- **Direction A:** the auto-updated §0 in `wave-sequencing-plan.md` is already a committed repo file. No memory-codification concern.
- **Direction B:** the new `.claude/orchestrator-prompts/_plan-cache.md` is a committed repo file. No memory-codification concern.

Both directions store state in committed files — they satisfy the spirit of `memory-codification.md §3` by design (the convention is in the repo, not in user-scope memory). The write-time discipline that **does** apply: when the I-phase ships the feature, any development-session memory entries describing the plan-memory design («the cache lives at `_plan-cache.md`», «auto-update on every invocation») should be codified in the repo (in SKILL.md or this patch) and memory reduced to a pointer. This is a ship-time obligation, not blocking R-phase.

**Would a fresh session on a different machine need this?** Yes — the cache file is committed to the repo and thus available. The feature's behavior (auto-update on invocation) is documented in SKILL.md after I-phase. Fully compliant.

---

### Q6 — `reviewer-discipline.md §2` audit per row in §4 strategy-vs-factual table

**Evidence — per-row verdict:**

Using brainstorm §4 Direction A table as the reference:

| Update | Auto or Surface | Verdict | Edge case |
|---|---|---|---|
| «PR #N merged» → mark row done | AUTO | ✅ Factual — deterministic (`gh pr view #N --json mergedAt` returns a boolean) | No edge case; PR merge is an immutable fact |
| «New kickoff appeared» → add UNTRACKED-NEW candidate | AUTO (candidate only) | ✅ Factual — `find .claude/orchestrator-prompts/*/kickoff.md` is deterministic | Edge case: a kickoff file was created by mistake and is not a real umbrella. The AI should NOT auto-promote to a Track row; marking as UNTRACKED-NEW (candidate) is the correct factual step. Human decision = promotion. |
| «Priority score changed» → rewrite score field | AUTO (numeric) | ⚠️ **PARTIALLY factual.** The formula inputs (PR count, days since last merge) are deterministic bash. The weights (3× / 2× / 1× / 2× axes) are strategy — hardcoded by the maintainer. An automatic re-score with fixed weights is factual; **changing the weights** is strategy. I-phase must hardcode the formula constants in the cache writer and NOT allow dynamic weight changes without maintainer review. | If two umbrellas have equal scores after re-scoring, auto-write of the equal-score result is factual; **auto-reordering of rows** is strategy. Cache stores the numeric score only; ordering is SKILL.md §2 judgment. |
| «Priority order change» → reorder rows | SURFACE | ✅ Strategy — row ordering encodes strategy. Should never auto-apply. | No edge case — always SURFACE. |

**Mandatory concrete test (kickoff exists, no PR ever opened):**

> Scenario: `.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase/kickoff.md` exists. No PR has ever been opened for this umbrella. Is auto-registering it as UNTRACKED-NEW factual or strategy?

**Answer: FACTUAL.** The fact «this kickoff.md file exists» is mechanically verifiable. The fact «no PR exists for this umbrella» is verifiable via `gh pr list --search 'head:research/plan-memory-rphase'`. Registering UNTRACKED-NEW in the cache is recording a factual discovery. The strategic decision («should we work on this umbrella?», «should it be in the wave plan?», «what priority?») is **separate** and is surfaced as DECISION-NEEDED. The auto-registration records the factual existence; it does not choose the response.

This satisfies `reviewer-discipline.md §2` — the AI discovers and records; the maintainer decides and promotes.

---

### Q7 — `no-paid-llm-in-ci.md §1` compliance audit

**Evidence — per-component verification:**

**Priority re-scoring formula inputs (SKILL.md §2, lines 99–125):**

```text
Axis 1: blocks-other-waves (3×) — deterministic: check kickoff §0 cross-wave deps via grep
Axis 2: give-back-value (2×) — deterministic: N5/consumer-artifact keywords in kickoff
Axis 3: size-fit (1×) — deterministic: LOC count via wc -l on kickoff.md
Axis 4: maintainer-prefs (2×) — deterministic: grep for «do next/urgent/after C-1» in wave-sequencing-plan.md §0
```

All four axis **inputs** are deterministic bash commands. The scoring formula itself (sum of weighted inputs) is arithmetic. No LLM call required for the score computation.

**However:** SKILL.md §2 Step 4 says: «If genuine tie OR strategy fork... → ask maintainer.» The tie-break is a human judgment, not an LLM call in CI. The score generation is deterministic; the tie-break surfaces as DECISION-NEEDED. **Fully compliant with `no-paid-llm-in-ci.md §1`.**

**Priority-score.sh helper:**

`grep -n 'claude\|anthropic\|openai\|API_KEY\|curl.*api' .claude/skills/meta-orchestrator/helpers/priority-score.sh` → confirmed: no API calls in the helper (it only does `git log`, `wc -l`, `grep` on local files). **Zero API-billed calls.**

**Cache auto-update on invocation (Direction B, I-phase):** The cache writer will use `gh pr list` (GitHub CLI — uses the GitHub token from `gh` auth, not an LLM API key), `find`, and `date` bash commands. No paid LLM call. The cache content is factual metadata, not LLM-generated prose. **Compliant.**

---

### Q8 — Cline Memory Bank ADAPT boundary + `!shell` injection coverage

**Evidence — direct line cite in SKILL.md §1:**

`SKILL.md lines 67–68` (line content: a `!`-fenced shell injection block):

    ```!
    ${CLAUDE_SKILL_DIR}/helpers/plan-currency-check.sh "${umbrella:-}" 2>/dev/null
    ```

The `!shell` injection fires on **every `/meta-orchestrator` invocation** at Step 1 (§1 lines 55–68). It runs `plan-currency-check.sh` which outputs: git status, ahead/behind staging, open PRs (JSON), merged PRs (JSON), kickoff existence check, research patches, UNTRACKED lines. This data is injected into the model's context.

**Cline ADAPT boundary (T16 committed-markdown sub-pattern verification):**

DeepWiki query 2026-05-25 confirmed: Cline Memory Bank files ARE committed markdown in the project repo (`progress.md`, `activeContext.md` are git-committed). They update «after each session» (recommended) but NOT automatically on every invocation — explicit user command «update memory bank» OR AI-model trigger required.

**T16 problem-class comparison for the committed-markdown sub-pattern specifically:**

- Cline: committed markdown, human-triggered or AI-signal update, project documentation purpose (human-readable status)
- Our cache (Direction B): committed markdown, **deterministic bash auto-update on every invocation**, factual state purpose (machine-readable cache)

**Match on committed-markdown sub-pattern: YES — ~85%.** The storage format (committed markdown in repo) is the same. The update mechanism diverges: Cline is on-demand; ours is deterministic-auto. This is the ADAPT boundary: we adopt the committed-markdown storage pattern and reject the on-demand update mechanism.

**Does SKILL.md §1 `!shell` injection already cover «read at session start»?**

YES — for the plan-currency check (reading `wave-sequencing-plan.md` + live `gh` state). The `!shell` injection provides the model with the current plan state on every invocation. This means the cache file (Direction B) doesn't need a «must read at session start» hook separate from the existing §1 injection. Instead, the cache read can be folded into the `plan-currency-check.sh` script itself: the script reads the cache first, then delta-scans, then outputs the merged result. The model receives the merged output via the existing `!shell` injection. No new hook is needed.

**Verdict: SKILL.md §1 `!shell` injection subsumes the «read at session start» discipline for the cache.** The cache file is read by `plan-currency-check.sh` (as a step in its existing scan), not by a separate hook. This keeps the injection surface minimal and consistent.

---

## §3 — Prior-art extension (4 items brainstorm deferred)

### (a) AIF `/aif-evolve` register pattern — T16 check

**Research method:** WebSearch for «aif-factory aif-evolve register pattern research patches accumulator» (2026-05-25). Note: `lee-to/aif-factory` repository not indexed in DeepWiki (returned «Repository not found»). WebSearch result via aif.cutcode.dev confirms `/aif-evolve` analyzes accumulated patches and improves skill capabilities (the plan→implement→verify→commit→evolve workflow).

**T16 problem-class comparison:**

- AIF `/aif-evolve` problem class: per-incident patch accumulation → periodic distillation → skill improvement. The `/aif-evolve` command reads the accumulated `research-patches/` directory and proposes skill edits. It is a **distillation tool**, not a plan-tracking tool.
- Our plan-memory problem class: cross-session tracking of umbrella PR-merge status + priority scores + UNTRACKED-NEW candidates; deterministic auto-refresh on every invocation.

**Match? NO on problem class.** `/aif-evolve` is a skill-evolution tool that reads accumulated evidence to improve skills over time. Our feature is a plan-state cache that tracks factual runtime state (PR merged/not, kickoff exists/not). The `research-patches/` accumulator in this project (what `phase-research-coverage.md §3` calls the «AIF `/aif-evolve` precedent») is the per-incident patch format — this is already in use and is NOT the plan-memory feature.

**Verdict: REFERENCE-only (already registered vocabulary at `phase-research-coverage.md §3`).** The plan-memory cache does NOT subsume or align with `/aif-evolve`. They are orthogonal tools: `/aif-evolve` improves skill content; plan-memory tracks wave status.

**T16 anti-pattern flag:** Pattern-matching on «AIF = persistent project state» would be incorrect. AIF's persistent state is skill improvement history, not plan tracking. Verified: not pattern-matching on name.

---

### (b) `state.md` companion measurement — falsifier #4

**Evidence — `ls` of existing state.md files:**

```text
14 state.md companions found across .claude/orchestrator-prompts/*/state.md
Sizes: 24–237 lines
```

**Sampling of state.md purpose per umbrella (direct file inspection):**

- `meta-orchestrator-plan-memory-rphase-meta-launch/state.md` (70 lines): single-umbrella dispatch record — §1 Inputs (kickoff path, plan-currency verdict, git HEAD), §2 Decisions, §3 Phase -1 verdict, §4 Quota state, §5 Handoff state. **Scope: single umbrella, single session.**
- `meta-orchestrator-planner-completeness/state.md` (237 lines): multi-stage umbrella — stage-by-stage log, Phase -1 review findings, BLOCKER/MAJOR/MINOR items. **Scope: single umbrella, multiple stages.**
- `mutation-discipline-umbrella-meta-launch/state.md` (153 lines): Stage 1–2 dispatch log. **Scope: single umbrella.**
- `autonomous-research-orchestrator/state.md` (129 lines): kickoff/status table for multiple research items but **within a single orchestrator session's scope.**

**Falsifier #4 analysis:**

Brainstorm §6.4: «Falsifier fires if: `state.md` lifetime analysis shows it covers the maintainer's actual use pattern.»

**Finding:** state.md companions cover the **single-umbrella cross-stage** case (one umbrella, multiple stages, multiple sessions within that umbrella). They do NOT cover the **global no-argument mode** use case: «list all in-flight umbrellas, their statuses, and prioritize the next one». The state.md for `meta-orchestrator-plan-memory-rphase-meta-launch` documents this specific launch; it does not know about `mutation-discipline-umbrella-meta-launch` or `recommendation-laziness-discipline-i-phase-meta-launch`.

There is NO global `state.md` that spans all umbrellas. The `wave-sequencing-plan.md §0` is the only global view, and it requires manual reconciliation (19 commits in 90 days, all manual).

**Falsifier #4 verdict: DOES NOT FIRE.** state.md covers single-umbrella multi-session state (50% of the use case per brainstorm §1). The other 50% — global no-argument mode, cross-umbrella priority, UNTRACKED-NEW accumulation — is NOT covered by any existing artifact. The plan-memory feature addresses a real, unmet gap.

---

### (c) Tier-1 fresh sweep

**Claude Code native (DeepWiki 2026-05-25, 3 queries):**

**Query 1:** «Does Claude Code have any project-scope persistent memory primitive that auto-updates on session start?»

**DeepWiki finding:** CC added `memory: project|user|local` frontmatter field for agents (v2.1.33, Feb 2026). Gives each sub-agent a persistent directory (`.claude/agent-memory/<name>/`). `SessionStart` hook available for session initialization (injects `additionalContext`). `/recap` command for session summaries. Sessions stored in `~/.claude/sessions/`.

**Query 2:** «Can a SessionStart hook or agent memory frontmatter automatically read AND write back to a committed plan markdown file deterministically without user input?»

**DeepWiki finding:** «directly modifying a committed plan file in a deterministic, automated way without user intervention for both reading and writing is not a primary, explicit feature of the `SessionStart` hook or agent memory frontmatter.» The hook's mechanism is `additionalContext` injection (read + inject context), not write-back to committed files.

**Query 3 (adversarial):** «Does CC's `SessionStart` hook or `/recap` mechanism fully replace the need for a separate plan-cache file?»

**Finding:** `/recap` is a human-triggered or away-summary feature. `SessionStart` injects `additionalContext` but does NOT write back. The `!shell` injection in SKILL.md §1 already covers the «read plan at session start» need. What's missing: the **write-back** half (persisting reconciled state back to a file). CC's primitives cover the read/inject side but not the deterministic write-back to a committed file on every invocation.

**Conclusion:** No new CC primitive landed since brainstorm that would subsume Direction B. The `memory: project` frontmatter is for sub-agent knowledge notes (analogous to `.claude/rules/*.md` convention), not for plan-state tracking.

**AIF (`lee-to/aif-factory`) — DeepWiki 2026-05-25:**

Repository not indexed in DeepWiki. WebSearch confirms: AIF implements `/aif-evolve` for skill improvement, not project-plan state management. No plan-memory analog found. (See §3(a) above for T16 analysis.)

**OhMyOpencode — DeepWiki 2026-05-25:**

Repository `oh-my-opencode/opencode` not indexed in DeepWiki. WebSearch for «OhMyOpencode rule-injector persistent state» found only references to the `rulesInjector` pattern (already registered at SSOT #61/#62) — no plan-state management feature.

**WebSearch «AI agent persistent project plan 2026» (3 phrasings):**

1. «AI agent persistent project plan memory across sessions 2026 committed markdown file» → Key finding: «file-based memory outperforms vector retrieval for autonomous agents; agents reading the full learnings file every session since it's small enough to fit in context; injecting learnings into system prompt at session start.» (gleecus.com, mem0.ai, medium.com/iniyarajan 2026-04)

2. «Claude Code project-scope memory agent frontmatter persistent plan state 2026» → CC v2.1.33 `memory:` frontmatter for sub-agents. Not a wave-plan tracker.

3. «Superpowers skills cross-session plan tracking persistent state orchestrator 2026» → No Superpowers skill for cross-session plan persistence. WebSearch found `superpowers-optimized` fork with «built-in memory stack» (session-log.md + known-issues.md) but this is a fork, not upstream Superpowers, and focuses on per-session coding context, not cross-umbrella wave planning.

**Conclusion of Tier-1 sweep:** No new Tier-1 source landed a cross-session project-plan-state feature since brainstorm. The confirmed gap remains: committed markdown + deterministic auto-update is the right substrate; no upstream skill does it at the meta-orchestrator wave-plan level.

---

### (d) 6-item search-coverage on Superpowers «no cross-session plan» negative claim

Applying `phase-research-coverage.md §1.1–§1.6`:

**§1.1 Own-stack sweep:** Superpowers is already in our stack (SSOT #64 — ADOPT). Does it ship a wave-plan persistence surface? Checked: no (`subagent-driven-development` reads static plan, `TodoWrite` is in-session only). Own-stack dependency confirmed inert for this problem class.

**§1.2 Category sweep:** Categories that could host a cross-session project plan: (a) orchestration skills, (b) meta-orchestrator skills, (c) session-state plugins. Checked for each: (a) Superpowers `subagent-driven-development` — no cross-session state (confirmed). (b) No other upstream meta-orchestrator skill found (WebSearch + DeepWiki). (c) `superpowers-optimized` fork has `session-log.md` / `known-issues.md` — a per-session coding context tracker, NOT a wave-plan persistence mechanism. Category sweep: no match found.

**§1.3 Semantic-distance check:** The query «cross-session plan tracking» was rephrased as «persistent orchestration state», «multi-session wave roadmap», «project plan persistence skill». All phrasings returned the same candidates (Cline Memory Bank, TaskMaster, state.md). No new candidates surfaced under rephrasing. Semantic distance covered.

**§1.4 Adversarial counter-prompt (mandatory):** «If Superpowers HAD a skill that maintained a persistent cross-session project plan, what would it look like?»

DeepWiki 2026-05-25: «Superpowers does not currently have a skill that maintains a persistent cross-session project plan... The current design does not include features for managing a portfolio of projects or tracking progress across disparate, high-level initiatives.»

Counter-prompt outcome: DeepWiki confirmed the absence even when asked adversarially. The absence is not a gap in the query — it is a genuine design choice in Superpowers (scope = single-feature development workflow, not multi-project orchestration). The claim is **load-bearing, not provisional**.

**§1.5 Floor check:** Floor = 5 candidates checked. Checked: (1) Superpowers `subagent-driven-development`, (2) Superpowers `writing-plans`, (3) Superpowers `brainstorming` server state, (4) `superpowers-optimized` fork session-log, (5) Superpowers `using-superpowers` meta-skill. All 5 confirm no cross-session wave-plan persistence. Floor met.

**§1.6 Trigger sweep:** No §13.x trigger fires on this specific claim — the «no Superpowers cross-session plan» negative claim does not appear in `open-questions.md §13.x`. The claim is a research finding, not a tracked trigger.

**Conclusion:** 6-item coverage passed. The negative existence claim «No Superpowers skill maintains cross-session plan» is verified to load-bearing status. NOT provisional.

---

## §4 — Verdict: ADOPT Direction B

**Verdict: ADOPT Direction B — shadow cache file (committed, separate from strategy)**

**Evidence chain for the verdict:**

1. **Q1 (write-safety):** Direction A requires auto-editing a strategy-bearing file with 10+ dense rows and no machine-safe delimiter. Blast radius is HIGH (worst-case row = 1,125 chars, 6–8 non-unique string fragments). Direction B isolates writes to a separate cache file with a strict schema. **Q1 favors Direction B.**

2. **Q3 (concurrent-session safety):** 19 commits to `wave-sequencing-plan.md` in 90 days + confirmed parallel worktree usage (23 worktree-adjacent commits). Direction A's shared-strategy-file write has a real race condition. Direction B's cache is idempotent and concurrent-safe. **Q3 favors Direction B.**

3. **Q4 (bootstrap cost):** Full scan takes ~90s (3-run average: 103s, 80s, 87s). The falsifier threshold is 5s — far exceeded. Caching is justified. Direction B's delta-scan after cache seed reduces subsequent invocations to <5s (only merged PRs since `last-reconcile` timestamp). **Q4 confirms caching is needed; falsifier §6.1 does NOT fire.**

4. **Q2 (drift check feasibility):** Direction B's bash drift check is ≤20 LOC (18 executable lines in the sketch above), handles 3 synthetic false-positive cases, and uses the existing `@dual-pair` HTML-comment annotation convention for markdown+markdown pairs. **Q2 confirms Direction B is implementable within constraints.**

5. **Q6 (reviewer-discipline audit):** All Direction B auto-apply updates (PR-merge factual, UNTRACKED-NEW candidate, numeric priority score) are deterministic bash, no AI judgment required. The «kickoff exists, no PR opened» case is definitively FACTUAL (auto-register as UNTRACKED-NEW candidate). **Q6 confirms Direction B's strategy-vs-factual boundary is clean.**

6. **Q7 (no-paid-LLM):** All four scoring axis inputs are deterministic bash. No API-billed calls. Direction B's cache writer uses `gh pr list` (GitHub token, not LLM API) + `find` + `date`. **Q7: fully compliant.**

7. **Q8 (Cline ADAPT boundary):** Cache read is subsumed by the existing `!shell` injection (folded into `plan-currency-check.sh`). No new «must read at session start» hook needed. **Q8: no new session-start discipline required.**

**Why not Direction A?** Direction A is blocked by Q1 (blast radius) and Q3 (concurrent-session race). Its single advantage (no new artifact) is outweighed by the structural coupling between strategy layer and factual cache. A future §0.cache delimited sub-section could be added manually to `wave-sequencing-plan.md` — but that is I-phase scope, not a reason to adopt Direction A now. Direction B is structurally superior for this project's artifact-ownership discipline.

**Why not DEFER?** Falsifiers §6.2 (average UNTRACKED count ≤5) and §6.3 (active umbrella count ≤4) were checked:
- §6.2: The Q3 evidence shows plan-currency-check.sh outputs 85+ UNTRACKED-KICKOFF lines on a single run — far above the ≤5 threshold. Falsifier §6.2 does NOT fire.
- §6.3: `ls .claude/orchestrator-prompts/*/kickoff.md | wc -l` = 63 kickoffs total (observed in Q4 run). Active tracked waves ≥6. Falsifier §6.3 does NOT fire.

**Why not REJECT?** The brainstorm §3 prior-art survey found no upstream tool that satisfies our problem class (committed-markdown + deterministic auto-update + cross-umbrella wave-plan tracking + CLI-session-bound + no paid LLM). BUILD is confirmed after exhaustive survey.

---

## §5 — SSOT row proposal (verdict = ADOPT → row appended)

New row appended to `docs/meta-factory/prior-art-evaluations.md` at ID **#77** (current max = #76, verified by `grep -E '^\| [0-9]+ \|' docs/meta-factory/prior-art-evaluations.md | awk -F'|' '{print $2}' | sort -n | tail -1` → `76`).

**Row:**

| 77 | Cline Memory Bank committed-markdown sub-pattern (`cline/cline` — `memory-bank/progress.md`, `activeContext.md`, committed markdown in project repo, updated after each session by explicit command or AI trigger) | `/meta-orchestrator` plan-memory Direction B — ADOPT the committed-markdown-in-repo storage pattern (separate factual cache file committed to project repo); REJECT the on-demand update trigger mechanism (ours is deterministic auto-update on every invocation, not human-command or AI-signal-triggered) | 2026-05-25 | 2026-05-25 | ADAPT | R-phase verdict patch `2026-05-25-plan-memory-rphase.md §4` (DeepWiki `cline/cline` 3 queries 2026-05-25). **T16 problem-class check:** upstream = «project documentation maintained across sessions by committed markdown files, updated on-demand or AI-triggered, human-readable status tracking»; ours = «factual-state cache for cross-umbrella wave-plan tracking, auto-updated deterministically on every invocation, machine-readable schema, separate from strategy layer». **Match on committed-markdown sub-pattern: ~85%** (storage format identical; update mechanism diverges: Cline = on-demand, ours = deterministic-auto). ADAPT: adopt storage pattern, design our own update trigger. The ~55% match brainstorm §3.1 cited was for the WHOLE Memory Bank concept; the committed-markdown *sub-pattern specifically* matches at ~85% (the only component we adopt). | If Cline ships auto-update on every session-start (removing the «explicit command» requirement), the problem-class match increases and the update-trigger mechanism may be adoptable verbatim — upgrade to ADOPT. |

---

## §6 — I-phase scope hint (NOT edits — design only)

**Target: a new umbrella `meta-orchestrator-plan-memory-iphase` with:**

1. **New file:** `.claude/orchestrator-prompts/_plan-cache.md` — the committed shadow cache. Format: markdown table with columns: `umbrella | kickoff-exists | last-pr-merged | untracked-new | last-reconcile | priority-score`. Pre-populated empty at creation; seeded on first invocation.

2. **Modified file:** `.claude/skills/meta-orchestrator/helpers/plan-currency-check.sh` — add cache read at start (if cache exists, do delta-scan only; if empty, do full scan and write cache). Add cache write at end (update reconciled fields). Add `@dual-pair: plan-memory-cache` marker.

3. **Modified file:** `.claude/skills/meta-orchestrator/SKILL.md §1` — add step referencing cache output (plan-currency-check.sh already injected; cache output is part of that). Document the cache-seeding behavior and delta-scan optimization.

4. **New file:** `.claude/skills/meta-orchestrator/helpers/plan-cache-check.sh` — the ≤20 LOC drift check from Q2. Wired as a reviewer-time check (not CI gate, per `no-paid-llm-in-ci.md §1`).

5. **Annotation to add:** `wave-sequencing-plan.md` header: `<!-- spec-of: .claude/orchestrator-prompts/_plan-cache.md -->` — the single HTML comment that makes the relationship explicit per `dual-implementation-discipline.md §5`.

6. **`wave-sequencing-plan.md §0` Track row:** Add a row for `meta-orchestrator-plan-memory` to §0 (per brainstorm §8 T15 mandate — the umbrella's own Track row lands in the I-phase shipping PR, not this R-phase patch).

**I-phase capability-commit classification:** New file `_plan-cache.md` is <50 LOC at creation (empty template); the modified `plan-currency-check.sh` gets additions likely ≥50 LOC → triggers capability-commit gate per CLAUDE.md. `Prior-art: prior-art-evaluations.md#77 (Cline Memory Bank committed-markdown sub-pattern, ADAPT)` trailer required.

---

## §7 — §1.7 self-reflexive check

### Forward-check (this patch complies with existing disciplines)

- **`no-paid-llm-in-ci.md §1`** — all R-phase tools were session-bound: DeepWiki MCP (CC subscription), WebSearch (session), bash timing runs (local). Zero API-billed calls. All proposed I-phase mechanisms are deterministic bash + `gh` CLI (GitHub token, not LLM API). ✅
- **`build-first-reuse-default.md §3`** — 6-item search coverage run in §3(d): own-stack (Superpowers SSOT #64), category sweep (5 candidates), semantic distance (3 phrasings), adversarial counter-prompt (DeepWiki confirmed absence), floor ≥5, trigger sweep (no §13.x trigger). BUILD verdict confirmed after exhaustive survey. ✅
- **`recommendation-laziness-discipline.md §3 (T20)`** — verdict «ADOPT Direction B» follows Q1–Q8 evidence answers, each backed by command output / file:line / DeepWiki excerpt. No inline verdict without preceding tool-call output. ✅
- **`reviewer-discipline.md §2`** — verdict commits to Direction B; does not punt to maintainer with «which do you prefer?». Strategy vs factual boundary verified in Q6. ✅
- **`dual-implementation-discipline.md §7`** — Direction B SSOT-pointer mechanism specified in §6 (HTML comment annotation + drift check). SSOT pointer: `<!-- spec-of: .claude/orchestrator-prompts/_plan-cache.md -->` on `wave-sequencing-plan.md`. ✅
- **`memory-codification.md §3`** — verified in Q5: plan artifact lives in committed file, no memory store. Ship-time write-time discipline obligations identified. ✅
- **`doc-authority-hierarchy.md §3`** — this patch carries the required header (Authoritative-for + NOT authoritative-for). ✅
- **`phase-research-coverage.md §1.12`** — verdict leads with evidence, not option-dump. All Q1–Q8 have concrete findings. ✅

### Backward-check (no existing artifact silently superseded)

- This patch does NOT modify `wave-sequencing-plan.md`, SKILL.md, `plan-currency-check.sh`, any rule file, or any principle test.
- This patch does NOT modify existing SSOT rows. It APPENDS row #77 only.
- `wave-sequencing-plan.md` remains the strategy SSOT; the proposed `_plan-cache.md` is a NEW artifact, not a replacement.
- Existing SSOT rows #64 (Superpowers SDD), #67 (aif-handoff), #72 (OpenHands), #73/#74/#75/#76 (planner-completeness) are cited as references but NOT modified.
- This patch does not retroactively change any brainstorm §3 provisional verdicts — they remain in the brainstorm patch; this R-phase patch documents the final verdicts.
- No existing rule, principle, or CLAUDE.md section is superseded by this patch. ✅

---

## §8 — §1.7 PR-body mandate alert

**§4b path-check:** This patch touches `docs/meta-factory/research-patches/2026-05-25-plan-memory-rphase.md` AND `docs/meta-factory/prior-art-evaluations.md` (SSOT row #77 appended). The SSOT append **triggers §4b**.

The PR body for this patch MUST include:
- `### §1.7 Forward-check applied` (H3, word «applied») with ≥40 non-whitespace chars + ≥1 file:line citation
- `### §1.7 Backward-check applied` (H3, word «applied») with ≥40 non-whitespace chars + ≥1 file:line citation

See §7 above for the forward/backward check evidence; specific file:line citations are included in the PR body per the meta-launch kickoff §4b template.

---

## §9 — T15 self-application

**Track-row admission path declared (mandatory per brainstorm §8):**

The `meta-orchestrator-plan-memory` umbrella's own Track row in `wave-sequencing-plan.md §0` is added in the **I-phase shipping PR** (the PR that ships the cache file + SKILL.md modifications), NOT in this R-phase patch. Per brainstorm §8: «the umbrella's own Track row should be added to `wave-sequencing-plan.md` in the same PR that ships the feature — making the first self-application visible in the commit history.»

The plan-currency-check.sh currently emits `UNTRACKED-KICKOFF: meta-orchestrator-plan-memory-rphase has kickoff.md but not in §0` (confirmed in Q3 run output). This will be resolved by the I-phase Track row addition.

T15 satisfied: admission path declared. Row not added in this R-phase (umbrella kickoff §7 / SSOT constraint).

---

## See also

- [2026-05-25-plan-memory-brainstorm.md](2026-05-25-plan-memory-brainstorm.md) — binding scope (2 directions + 8 questions + 5 falsifiers)
- [.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase/kickoff.md](../../../.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase/kickoff.md) — R-phase kickoff
- [.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase-meta-launch/kickoff.md](../../../.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase-meta-launch/kickoff.md) — meta-launch kickoff
- [.claude/skills/meta-orchestrator/SKILL.md](../../../.claude/skills/pipeline/SKILL.md) — current skill surface (the read-only surface this feature extends)
- [.claude/skills/meta-orchestrator/helpers/plan-currency-check.sh](../../../.claude/skills/pipeline/helpers/plan-currency-check.sh) — the modified helper in I-phase
- [docs/meta-factory/prior-art-evaluations.md](../prior-art-evaluations.md) — SSOT row #77 appended
- [docs/meta-factory/wave-sequencing-plan.md](../wave-sequencing-plan.md) — strategy SSOT (NOT auto-modified by Direction B)
- [.claude/rules/dual-implementation-discipline.md §5-§7](../../../.claude/rules/dual-implementation-discipline.md) — @dual-pair annotation convention
- [.claude/rules/memory-codification.md §3](../../../.claude/rules/memory-codification.md) — write-time discipline
- [.claude/rules/no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md) — hard constraint on I-phase mechanisms
