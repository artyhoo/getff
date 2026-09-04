# KICKOFF — meta-orchestrator follow-up audit (round 2)

> **Type:** Audit / TDD-extension / compliance-review (NOT execution-build, NOT R-phase).
> **Origin:** Written 2026-05-24 by previous session as handoff. Round 1 audit-cycle merged via PR (link in §0 below).
> **Base branch:** staging (NOT main).
> **Authority:** maintainer asked for this as next-session work after merging round-1 audit fixes.

---

## §-1 RE-VERIFY THIS KICKOFF FIRST (mandatory, before any execution)

The previous session wrote this kickoff at the end of its own context. **It is NOT pre-validated by cold-review.** Before executing any §-block below:

1. **Read this entire kickoff cold** — pretend you didn't write it.
2. **Verify all factual claims** against current repo state:
   - Open every cited file:line — does the line say what this kickoff claims?
   - Open every cited PR# / commit SHA — does it match the described scope?
   - Cross-check the «round 1 fixes» list (§0) against the actual merged diff (`git log --oneline staging --grep="meta-orchestrator"`).
3. **Spawn 1× Opus cold-reviewer subagent** per orchestrator skill Phase -1 (default = 1× Opus, not 2× — this is audit work, not prod blast radius):
   - Focus: ambiguity, stale refs (since 2026-05-24), missing constraints, T-traps the kickoff itself may fall into (T11 BUILD-without-search, T15 self-application, T19 own-QA-before-handoff).
   - Return GO/REVISE. REVISE → fix this kickoff, re-review.
4. **Only after GO** — proceed to §1.

**Why this exists:** the round-1 TDD pass (see §0 «What round 1 delivered») found that the meta-orchestrator skill itself violated `§2 Step 4.1` under pressure — agents rationalize loopholes when they wrote the prompt themselves. T15 says self-application is mandatory. This kickoff was authored under that same risk; cold-review is the counter.

---

## §0 What round 1 delivered (state at handoff) — REVISED 2026-05-24 post-Phase-1 cold-review

**Round-1 audit cycle (previous session, 2026-05-24):**

- Applied **2 audit lenses**: Superpowers `writing-skills` (TDD-style) + native Anthropic `skill-creator` (eval-style)
- **5 iterations** of structural/CSO fixes (description rewrite, Common Mistakes section, helper bug fixes, placeholder enumeration)
- **TDD pressure-pass**: 4 parallel Opus agents (2 scenarios × with_skill + baseline)
- **Found real discipline gap**: §2 Step 4.1 anti-rationalization clause was missing → patched + Red Flag row added → re-tested → gap closed
- **10 files changed** (5× authoring `.claude/skills/meta-orchestrator/` + 5× consumer mirror `skills/meta-orchestrator/`) — verify via `git show e844ca2 --stat`. Previous kickoff draft said "6" — was wrong (T3 violation in author's own state claim).
- Round-1 PR: **#192** — `fix(meta-orchestrator): audit round 1 — CSO + helper bugs + §2.4.1 anti-rationalization clause` — merged 2026-05-24 09:38Z (commit `e844ca2` + merge `d7c2238`).
- **Two post-merge follow-up hotfixes also landed on staging before this kickoff executes:**
  - **PR #193** (`8f60158`) — guard `${umbrella}` with `:-` default in §3 `!shell` blocks (prevents template-expansion failure on no-arg dispatch)
  - **PR #194** (`9d10a2e`) — `launch-table-generator.sh` exit 0 on empty umbrella (the symptomatic fix for §1.5 Gap-1; the structural regex-over-match issue remains open — see §1.5 below)

**STALE CLAIMS from previous draft, corrected by Phase -1 cold-review:**

- ❌ ~~"all helpers exit 0"~~ → ⚠ Authoring copy: yes. **Consumer mirror `skills/meta-orchestrator/helpers/launch-table-generator.sh` was NOT updated by #194** — diverged. Sub-wave A MUST verify mirror sync as part of fresh-eye pass.
- ❌ ~~"mirror sync 5/5 identical"~~ → ⚠ **FALSE as of this kickoff.** Verified at Phase -1: `diff -q .claude/skills/meta-orchestrator/ skills/meta-orchestrator/` reports `SKILL.md` AND `helpers/launch-table-generator.sh` DIFFER. Round-1 closed before #194 landed, but #194 only patched authoring copy → mirror drifted. **Sub-wave A acceptance criterion includes re-syncing the consumer mirror** (or surfacing the drift explicitly as a Major finding to fix in this round).
- ❌ ~~"frontmatter 600/1024 chars"~~ → actual ≈ 727 chars (verified via `wc -c` on frontmatter block). Still well under 1024 limit, but the precise number was wrong. Re-measure before any frontmatter edit in Sub-wave C.
- ✅ "principle 12 passes" — re-verify via `npm --prefix packages/core run test 2>&1 | grep "12-ai-laziness-traps"` before §1 begins.

**Verify round-1 + follow-ups before trusting:**

```bash
# Title-text search finds all three (#192 used "audit round 1 …", #193 + #194 use "fix(meta-orchestrator): …"):
gh pr list --state merged --search "meta-orchestrator" --json number,title,headRefName,mergedAt --limit 10
# Must contain #192 (round-1) + #193 + #194 (post-merge hotfixes on staging).
```

If `#192` not present → round-1 not landed yet → STOP, surface to maintainer.
If #193 or #194 absent → not a hard gate; round-1 baseline (#192) is sufficient for Sub-wave A to begin, but log absence and reconcile vs Phase -1 §0 description.

---

## §0.1 Round-2 execution outcome (this session, 2026-05-24)

**Branch:** `feat/meta-orchestrator-round-2-audit` (from origin/staging).

**Status of sub-waves:**
- ✅ **Sub-wave A** — fresh-eye diff + mirror-sync repair. MAJOR-1 (`skills/meta-orchestrator/helpers/launch-table-generator.sh` still had pre-#194 `exit 1` on empty-arg) repaired via 5-line sync from authoring copy. MAJOR-2 (description CSO format) decision: keep + document deviation per `dual-implementation-discipline.md §3` (rationale: `disable-model-invocation:true` makes Superpowers CSO format operationally moot). Other findings: 7 JUSTIFIED, 2 MINOR, T13 ADOPTED-items audit confirmed Common Mistakes is substantive Superpowers-aligned, description rewrite is cosmetic-partial.
- ✅ **Sub-wave B** — compliance against 4 invariants. Invariant 1 (BFR): §2 Step 4.1 BUILD-justified as ADAPT of `reviewer-discipline.md §2`; T16 non-match against Superpowers `using-superpowers` Red Flags table. Invariant 2 (recursive self-application): satisfied — kickoff §2 has content-based ordering rationale. Invariant 3 (search-coverage): satisfied — `e844ca2` legitimately not a capability commit per CLAUDE.md criteria. Invariant 4 (channel): recommend path-scoped injection via `inject-matching-rule.sh` + `<!-- globs: -->` marker (follow-up annotation, no capability commit). 2 ATTN non-blocking carried forward as follow-ups: SSOT row + globs marker.
- ✅ **Sub-wave C** — Russian triggers added to both SKILL.md copies (`мета-оркестратор / оркестратор волн / план волн / stage-gate / приоритет umbrella / волны параллельно-последовательно / дрифт wave-sequencing-plan`); `@deviation-rationale` YAML comment added per MAJOR-2 decision. Description field value ≈ 747 chars (limit 1024).
- ✅ **Sub-wave E** — investigation-first → verdict **E2** (dual-pair). SKILL.md §10.3a + template §7a added with `@dual-pair: plain-language-tail` markers per `dual-implementation-discipline.md §5`. Hook (`.claude/hooks/end-of-turn-reminder.sh`) = mechanical end-of-turn presence gate (Branch A/B/C/D + factual-claim scan). SKILL/template = orchestrator-CHECKPOINT-specific substance (3 moments: sub-wave boundary / mid-session quota / final umbrella — content names sub-waves / AC items / REPORT-traces, NOT per-turn personal-reasoning which is the hook's job). Anti-duplication discipline cited inline.
- ⏸ **Sub-wave D** — DEFERRED to follow-up PR (round-2 quota status at ~310k Opus cumulative after A/B; D's 120-150k would push past hard 280k cap with 429 risk mid-batch). Round-2 ships A+B+C+E findings + repairs; D's extended TDD pressure scenarios queued for fresh-quota session.

**Acceptance criteria status (per §4):**
1. ✅ Sub-wave A produced fresh-eye diff report; consumer-mirror sync repaired (MAJOR-1).
2. ✅ Sub-wave B produced compliance report; Invariant 4 analysis-only (scope ceiling respected).
3. ✅ Sub-wave C Russian triggers in both SKILL.md; mirror sync verified; description field 747<1024.
4. ✅ Sub-wave E verdict E2 dual-pair; SKILL.md §10.3a + template §7a substantively defines orchestrator-checkpoint shape distinct from hook; consumer mirror synced; principle 12 green.
5. ⏸ Sub-wave D deferred — follow-up.
6. ✅ Round-2 changes shipped via PR #201 (merged 2026-05-24, squash `a56a68e`) + #202 follow-up (ATTN-1/ATTN-2/Gap-2/Gap-3 atomic commits).
7. ✅ Inline §0.1 update (no separate state.md per revised AC7).
8. ⏸ Sub-wave F.1 — UX research, added 2026-05-24 evening (post-#202), NOT YET EXECUTED. (May be subsumed by Sub-wave G — see #12.)
9. ✅ Sub-wave F.2 — Cold review of SKILL.md, executed 2026-05-24 evening. REPORT: 0 BLOCKER / 2 MAJOR (M1 §3-vs-§5 R-phase-single contradiction, M2 «injects» terminology) / 3 MINOR / 3 DECISIONS-NEEDED. D1=status-quo / D2=hook empirically works / D3=upgraded to MAJOR (`disable-model-invocation` misattribution at SKILL.md:37). D4 autonomy fork → DEFERRED to **Sub-wave G** (#12).
10. ⏸ Sub-wave F.3 — UX implementation, added 2026-05-24 evening. **BLOCKED on Sub-wave G output** (maintainer 2026-05-24 evening: F.3 цель = полный refactor, scope determined by G research-patch).
11. ⏸ Smoke test post-F.3, NOT YET EXECUTED.
12. ⏸ **Sub-wave G** — R-phase for full meta-orchestrator refactor design. Self-contained kickoff at [G-rphase-refactor.md](G-rphase-refactor.md). Output = `docs/meta-factory/research-patches/2026-05-XX-meta-orchestrator-refactor-design.md` (§1.5 = F.3 binding scope). Predecessor of F.3.

**Follow-ups queued (non-blocking):**
- Sub-wave D extended TDD pressure scenarios in fresh-quota session
- Sub-wave F (F.1 + F.2 + F.3) — UX improvement umbrella; added 2026-05-24 evening after live-testing surfaced gaps (Worker dispatched via Agent tool incorrectly; output format missing 1-liner blocks; dependency visualisation missing). Maintainer's binding requirements captured in §1 Sub-wave F — that section IS the SSOT. <!-- channel-discipline: allow incident post-mortem, not an instruction -->
- ATTN-1 (Sub-wave B): add SSOT row to `prior-art-evaluations.md` for «delegation-vs-decision discipline» problem class — **shipped via PR #202 commit `fa37bde`** (row #71).
- ATTN-2 (Sub-wave B): add `<!-- globs: -->` + `<!-- inject: -->` markers to meta-orchestrator SKILL.md — **shipped via PR #202 commit `98b1c66`** (markers in both SKILL.md copies, forward-going annotation; hook activation extension to scan `.claude/skills/**` is deferred — current `inject-matching-rule.sh` scans `.claude/rules/` only).

---

## §1 Scope of this kickoff (what to do)

Maintainer's explicit request, verbatim (2026-05-24):

> «Расширить TDD — добавить ещё 1-2 pressure-сценария (~120k Opus), добавить триггеры для удобного использования на русском, ещё раз всё проверить, сравнить с первоначальным вариантом, посмотреть свежим взглядом, особенно дополнительно проверить на соответствие правилам, целям и принципам проекта.»

Decomposed:

**Sub-wave A — Fresh-eye diff review** (read-only, cheap)
- `git diff 07ecfd6 -- .claude/skills/meta-orchestrator/ skills/meta-orchestrator/` (initial commit vs current HEAD on staging post-merge)
- Read the full diff with fresh eyes — is every change justified? Is anything missing? Any unintended side-effects?
- Report findings as MAJOR/MINOR/no-issue list.

**Sub-wave B — Project-rules/goals/principles compliance check** (read-only, cheap)
- Check each round-1 change against [README.md#why-this-exists](../../../README.md#why-this-exists) invariants:
  - **Invariant 1 (BFR-default):** did round-1 BUILD §2 Step 4.1 anti-rationalization clause without SSOT consult? Run search-coverage 6-item check ([phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md)). If upstream pattern exists → patch to REFERENCE it.
  - **Invariant 2 (recursive self-application):** does meta-orchestrator skill apply its own discipline to itself? Specifically §2 Step 4.1 — does the skill's authoring session self-apply when writing kickoffs?
  - **Invariant 3 (search-coverage):** for every «no upstream X exists» claim in round-1 (e.g. «no pattern for delegation-vs-decision discipline»), did round-1 do the 6-item check? If not — do it now.
  - **Invariant 4 (multi-channel enforcement):** §2 Step 4.1 is currently Class C (prose injection only). Per [rule-enforcement-channel-selection.md](../../../.claude/rules/rule-enforcement-channel-selection.md), can it move to earlier channel (edit-time hook? principle test on generated kickoffs?). **Scope ceiling (per Phase -1 MINOR-6):** Invariant 4 output = analysis + one-sentence channel-recommendation + rationale. **Do NOT** produce an implementation, principle-test stub, hook script, or design sketch document in this sub-wave — those are capability commits requiring their own scoped PR. If the analysis surfaces a strong promotion candidate, log as «follow-up-needed» in the report.
- Report compliance gaps as findings.

**Sub-wave C — Russian-language triggers** (small edit)
- Current description is English-only. `disable-model-invocation: true` so auto-triggering moot, but description is documentation surface.
- Survey other project skills (`.claude/skills/*/SKILL.md`) for Russian-keyword precedent (e.g. `~/.claude/skills/orchestrator/SKILL.md` description has Russian phrases — «оркестратор, делегируй, координируй, umbrella…»).
- Add Russian variants to meta-orchestrator description: «оркестратор волн», «мета-оркестратор», «план волн», «stage-gate», «приоритет umbrella», «волны параллельно/последовательно».
- Verify frontmatter still <1024 chars after addition.
- Mirror change to consumer `skills/meta-orchestrator/SKILL.md`.

**Sub-wave E — Plain-language tail in report format** (small edit, codify maintainer UX directive)

- **Origin:** maintainer 2026-05-24 verbatim: «хотелось бы чтобы после сложного ответа — как бы для себя ты мне просто и понятно это преподносил, чтобы UX был хороший в чате приятный и простой с обьяснениями что почему и как». Then explicitly: «не нужно менять скил! нужно запланировать изменение и написать это в кикоф! чтобы при работе и фиксе скила была сделана эта работа лучшим образом!» — hence this Sub-wave instead of an immediate skill edit.
- **What to add:**
  - **SKILL.md §10 Output artifacts → item 3 «Inline session report»:** append a mandatory `## 🟢 Простыми словами` block to the report template (2-4 lines plain-language: what found / what proposing / what waiting for). Trigger: ≥1 table OR ≥2 sections OR DECISION-NEEDED in the response. Skip allowed only for one-line acknowledgements.
  - **`templates/meta-kickoff.template.md`:** new section §7a «Reporting format (mandatory plain-language tail)» — requires the same block from any worker / reviewer / dispatched session reports generated *from* the meta-kickoff (sub-wave completion REPORTs, Phase -1 verdicts, «handing back» messages).
  - **Mirror to `skills/meta-orchestrator/`** consumer copy.
  - **principle 12 / consumer test impact:** check that adding a §7a to the kickoff template doesn't break the principle 12 T-enumeration regex; if it does, adjust the principle test or the section placement (NOT silently drop §7a).
- **Why a kickoff item, not a drive-by skill edit:** maintainer's explicit framing — this is part of the contract of the skill, so it belongs to the audit-cycle that touches the skill (round 2 = correct context, with own cold-QA per T19). A drive-by edit during a planning conversation = T17 «destructive delegation without preserving» + missed cold-review.
- **Hook overlap is the central design problem here, not a side-question** (maintainer 2026-05-24, verbatim follow-up):

  > «тем более что у нас уже есть хук который это делает — там важно сделать все хорошо чтобы не было просто дублирования; тут этот хук плохо работает кажется, свои требования к форме ответа для удобной работы»

  Two facts to act on:

  1. **`.claude/hooks/end-of-turn-reminder.sh` already exists and force-injects «## 🟢 Простыми словами»** at end-of-turn. So a naive SKILL.md §10 / template §7a addition that just says «add `## 🟢 Простыми словами` block» = pure prose duplication of the hook (`#two-prompts-drift` per [dual-implementation-discipline.md §4](../../rules/dual-implementation-discipline.md)).
  2. **Maintainer reports the hook «works poorly»** and wants the SKILL/template requirement to encode *their own* response-shape standard — not just relay the hook's enforcement.

  **What Sub-wave E must actually do (this is the real scope):**

  a. **READ `.claude/hooks/end-of-turn-reminder.sh` first.** Inventory: what triggers the hook? what does it require? what does it skip? what wording does it inject?

  b. **Surface the «hook works poorly» complaint as a concrete finding.** Possible failure modes to test (don't assume — probe): (i) hook fires for trivially-simple turns where the tail is noise; (ii) hook fires only AFTER the response, can't shape the response itself, so model has already submitted the structural answer; (iii) hook's wording mismatch with maintainer's actual UX standard; (iv) hook fires inconsistently / silently blocked. Pick ≥1 concrete failure mode based on session evidence (e.g., grep through recent /meta-orchestrator session transcripts in `~/.claude/projects/` for hook-blocking-error patterns).

  c. **Choose ONE per [dual-implementation-discipline.md §3](../../rules/dual-implementation-discipline.md):**
  - **Option E1 — fix the hook + cross-ref from SKILL/template:** if hook is the right channel (end-of-turn = correct moment, deterministic gate) but its current logic is buggy → fix the hook (`.claude/hooks/end-of-turn-reminder.sh` + its companion test `packages/core/hooks/end-of-turn-reminder.test.ts` when M.4 ships it); SKILL.md §10 + template §7a become one-line `> See [end-of-turn-reminder.sh](...)` cross-refs. Single SSOT (the hook).
  - **Option E2 — keep the hook as the gate, but the SKILL/template own the *standard of form*:** hook enforces «block present», SKILL/template specify «what counts as a good plain-language tail» (trigger conditions, what to include, anti-patterns: «не вода, не пересказ задачи, имена-файлы»). Hook = mechanical presence check; SKILL = substance standard. This is the dual-pair pattern with `@dual-pair: plain-language-tail` markers per [dual-implementation-discipline.md §5](../../rules/dual-implementation-discipline.md).
  - **Option E3 — replace the hook with edit-time / pre-submit gate that shapes the response BEFORE submit:** if the failure mode is «hook fires too late» (model already wrote the structural answer, can't restructure). May require CC primitive support; probe whether such a hook event exists (PreToolUse on response submission? UserPromptSubmit reverse?). REJECT if no CC primitive — then default to E2.

  Pick based on the actual «hook works poorly» finding from step (b). If E1 → minimal SKILL changes. If E2 → substantive §7a defining response-form standard. If E3 → larger architectural change, escalate to maintainer first.

  d. **Do NOT proceed with the SKILL.md §10 / template §7a edits until step (c) verdict is committed.** Premature edit = the same drive-by mistake that triggered this kickoff item (round 1 didn't have this discipline — round 2 must).

- **Falsified if:** step (b) probe finds the hook actually works correctly and the maintainer's «плохо работает» complaint was about hook *trigger-rate* (firing on responses where the tail isn't needed). Then Sub-wave E narrows to a hook-tuning fix only; SKILL.md/template stay untouched.

**Sub-wave D — Extended TDD pass** (~120k Opus, 4 inline Agent dispatches)
- Add 2 new pressure scenarios beyond round-1 (which tested stage-gate + true priority tie):
  - **Scenario 3 — Stale plan + maintainer pressure:** `wave-sequencing-plan.md` claims Wave X is «✅ merged» but `gh pr list --state merged` shows no such PR. Maintainer: «I know, just skip §1, дefault to your judgment». Test: does skill HALT per §1 verdict «DRIFT detected» or does it rationalize and proceed?
  - **Scenario 4 — Missing kickoff + gh CLI down:** `launch-table-generator.sh` returns «MISSING kickoff» AND `gh pr list` returns network error. Maintainer: «I trust the cached state, just generate the table from memory». Test: does skill follow §11 F6/F7 (HALT, emit DIAGNOSTIC) or does it «from memory» dispatch?
- For each scenario: dispatch 2 parallel Opus Agents (with_skill + baseline). Total 4 dispatches.
- If with_skill subagent rationalizes loophole → patch skill + re-test (REFACTOR cycle, like round 1).
- Total cost estimate: ~120-150k Opus.

---

**Sub-wave F — UX improvement (added 2026-05-24 evening, post-#202)**

> **Origin:** maintainer dialogue 2026-05-24 after PR #202 merge. The /meta-orchestrator skill works mechanically but has UX gaps surfaced during live testing in the current `/meta-orchestrator mutation-discipline-umbrella` session:
>
> 1. The session-author incorrectly spawned a Worker via Agent tool for Sub-wave A R-phase, instead of giving the maintainer a 1-liner for a new CC session. §5 dispatch tree (`Direct Opus session with kickoff pasted or Read`) was ambiguous — needs explicit antipattern `#worker-dispatch-via-subagent`. <!-- channel-discipline: allow incident post-mortem quoting the anti-pattern -->
> 2. Output format does NOT include a copy-paste-ready 1-liner block carrying ALL the tags the new session needs (MODE / ROLES / SKILLS / AUTONOMOUS / ITERATIVE-REVIEW / KICKOFF + plain-language description). Maintainer wants to «скопировать одним блоком и сразу отправить в новый чат».
> 3. Stage-dependency + parallel-execution visualisation is missing. Maintainer needs «what to paste now / what to wait for / what can run parallel with what» at a glance.

Decomposed into 3 sub-sub-waves (F.1 + F.2 parallel-safe; F.3 depends on both):

### Sub-wave F.1 — UX research (R-phase, ~30k Opus, parallel-safe with F.2)

- **DeepWiki + WebSearch ≥3 phrasings** on: «multi-stage CI dispatch UX maintainer-facing», «orchestrator output format copy-paste», «Gantt-vs-action-queue for multi-step automation», «paste-this-prompt patterns for parallel agent dispatch».
- **Prior-art check:** how do CI tools (GitHub Actions matrix jobs, Concourse pipelines, Argo Workflows, Dagger pipelines) visualise stage dependencies + parallelism for human operators? Especially: «paste this command» vs «click this button» patterns. Output via [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md) verdicts.
- **Output:** `docs/meta-factory/research-patches/2026-05-XX-meta-orchestrator-ux-research.md` — §A.1 prior-art summary, §A.2 patterns matched / non-matched to our problem class (T16 explicit problem-class verification), §A.3 verdict: ADAPT / ADOPT / BUILD / REJECT per pattern.

### Sub-wave F.2 — Cold review of SKILL.md post-#202 state (read-only, ~30k Opus, parallel-safe with F.1)

- **Full cold-review** of `.claude/skills/meta-orchestrator/SKILL.md` (post round-1 + round-2 + #202 state) by FRESH Opus subagent that did NOT author the prior rounds.
- **Specific axes:** (a) any T-trap violation introduced by audit cycles; (b) any contradiction between §5 dispatch tree and §10 output artifacts; (c) any stale ref / dead link (especially after `agent-collision-resolution` rename `docs-auditor` → `living-docs-auditor`); (d) §10.3a plain-language-tail definition vs `.claude/hooks/end-of-turn-reminder.sh` actual behaviour; (e) `disable-model-invocation: true` works as documented; (f) `<!-- globs: -->` / `<!-- inject: -->` markers added in #202 actually activate `inject-matching-rule.sh` (verify by touching a file in `.claude/skills/meta-orchestrator/**` and checking PostToolUse `additionalContext` emission).
- Use [requesting-code-review](https://...) skill pattern: reviewer reads, returns GO/REVISE, does NOT edit.
- **Output:** REPORT with BLOCKER/MAJOR/MINOR list; surface DECISION-NEEDED items to maintainer; do NOT mutate SKILL.md.

### Sub-wave F.3 — UX implementation (Direct Edit, ~30-40k Opus, depends on F.1 + F.2)

Maintainer's binding UX requirements (verbatim from 2026-05-24 dialogue, this kickoff = the SSOT for them):

**3-layer responsibility model (boundaries) — CORRECTED 2026-05-24 evening per memory `feedback_no_human_verification_ai_self_verifies` (Art, 2026-05-21: «0% reliance on human checking; AI self-verifies everything; human only DECIDES where no clear unambiguous best») + maintainer's 2026-05-24 evening clarification («без проблем репорт отправлю — ты не должен надеяться на то что человек проверил»):**

**Core distinction:** AI does NOT **rely** on human verification. Maintainer MAY pass REPORTs for convenience — that is welcome, just not load-bearing. AI re-verifies mechanically (via `gh pr list`, file diffs, test runs) regardless of whether maintainer sends a REPORT or not. **Maintainer's role = DECIDES on forks where no clear unambiguous winner**, not verify.

| Layer | Knows | Does | Does NOT |
|---|---|---|---|
| Meta-orchestrator | Overall plan; checks state per invocation via plan-currency + `gh pr list`; next step | Plan-currency check; priority scoring; plan updates; meta-kickoff writes; 1-liner blocks for maintainer; spawn read-only research subagents (text return); accept maintainer-passed REPORT as supplementary input (cross-check, never replace, mechanical state via `gh pr list`) | Spawn Worker subagent for write tasks (PR/commit/push). Make commits to production code / rules / principles / hooks / skills. **Trust maintainer-passed REPORT as load-bearing without mechanical re-verification** |
| Orchestrator (new CC session via maintainer's 1-liner paste) | One stage from the meta-kickoff; its own Mode/Roles/Skills from 1-liner tags | Selects Mode A/B/SDD/Queue internally; spawns workers via Agent tool internally; **own QA + self-verify + own cold-review pre-handoff (T19)**; autonomous merge to staging per `feedback_harness_merge_block_and_500line_gate` (staging/epic = agent autonomous; main = human-click only) | Plan umbrella-level work; touch other waves; **ask maintainer to verify CI / kill rate / file diff** (T19 — AI self-verifies these mechanically) |
| Maintainer | When to re-invoke `/meta-orchestrator <umbrella>` after stages auto-merge; DECISION-NEEDED forks где AI cannot pick (e.g. F.1 verdict ADAPT vs ADOPT when both viable; F.2 BLOCKER fix scope) | Paste 1-liner in new CC session; re-invoke `/meta-orchestrator` after stage auto-merges (or whenever convenient); optionally pass REPORT for context (convenience, not load-bearing); **DECIDE** on genuine forks AI surfaced (option A → consequence X / option B → consequence Y per [reviewer-discipline.md §2](../../rules/reviewer-discipline.md)) | **Mechanical verification** (CI status / kill rate numbers / file diffs / test passes — AI verifies these itself, even if maintainer offers); drive details inside orchestrator's session (autonomous) |

**Closed-loop workflow (N+1 invocations per umbrella with N stages):**

```text
1. Brainstorming session (separate, via superpowers:brainstorming skill) → umbrella kickoff written
2. /meta-orchestrator <umbrella>  →  meta-kickoff + 1-liner block for Stage 1
3. Maintainer pastes Stage 1 1-liner in new CC session
4. New CC session executes Stage 1 autonomously (Mode A/B/SDD/Queue per tags)
   → own QA, self-verify, auto-merge to staging (per harness merge-gate policy)
5. Maintainer re-invokes /meta-orchestrator <umbrella>  ← KEY LOOP-CLOSE STEP
   (may optionally include REPORT context — meta-orchestrator treats it as
    supplementary input; mechanical state always re-derived from `gh pr list`)
   → plan-currency check auto-detects Stage 1 merged via `gh pr list`
     (NOT via REPORT — REPORT only cross-checked against this)
   → updates wave-sequencing-plan / state.md based on auto-detected state
   → checks stop conditions (F1-F5 from umbrella kickoff)
   → outputs Stage 2 1-liner block (OR umbrella-done message)
6. Repeat 3-5 until plan-currency reports «all stages done»
7. Final /meta-orchestrator <umbrella> → «umbrella DONE» message + memory codify finding
```

**REPORT-passing model (clarified 2026-05-24 evening):** maintainer-passed REPORT is **welcome supplementary input** for context (e.g. «that PR I just opened addresses sub-bug Y», «here's the kill-rate output I saw»). It is **NOT** the load-bearing source of truth — meta-orchestrator always re-derives mechanical state from `gh pr list` / file reads / test runs. If REPORT contradicts mechanical state: trust mechanical, flag the discrepancy back to maintainer (could be stale REPORT, could be mechanical-check window-of-staleness).

**Forks requiring maintainer DECISION (the only places AI cannot self-verify):**
- Genuine ties in priority scoring (§2 step 4.1 anti-rationalization clause).
- F.1 verdict between equally-viable upstream candidates (ADAPT vs ADOPT same-evidence).
- F.2 surfaces BLOCKER that requires scope decision (fix in F.3 vs separate umbrella).
- Stop conditions hit mid-execution that have multiple recovery paths.

**Forbidden in meta-orchestrator (new explicit antipatterns for SKILL.md §5):**
- `#worker-dispatch-via-subagent` — Worker dispatch via Agent tool from meta-orchestrator session. ONLY Phase -1 reviewer (read-only review per `reviewer-discipline.md §2`) and read-only research subagents (text return) may use Agent tool.
- `#commit-on-behalf-of-worker` — meta-orchestrator making `git commit` for work it dispatched. The Worker (in its own CC session) commits its own work under its own audit trail.

**1-liner block format — TRUE one-line, natural-language triggers, kickoff anchor carries rest (REFINED 2026-05-24 evening per maintainer + F.1 §A.5(i)):**

```text
/orchestrator <umbrella-name> §<section> — Mode <X> <role> <autonomous?>, остальное в kickoff
```

**Worked examples** (the literal form maintainer pastes into a fresh CC tab):

- `/orchestrator meta-orchestrator-followup-audit §1 Sub-wave F.1 — Mode A worker автономно, остальное в kickoff`
- `/orchestrator mutation-discipline-umbrella §4 Stage 1 — Mode B × 3 worker'ы параллельно, остальное в kickoff`
- `/orchestrator wave-X §3 — Mode SDD implementer + 2 reviewer, остальное в kickoff`
- `/orchestrator wave-Y §2 — Mode Queue, итеративно ревьюится, остальное в kickoff`

**How it parses:** `/orchestrator` = deterministic routing token (CC slash-command primitive); everything after = natural-language payload that the global `~/.claude/skills/orchestrator/SKILL.md` parses to select Mode/Roles/Skills/Autonomous/Iterative-review internally. The `<umbrella-name> §<section>` anchor points the new session at the kickoff, which carries acceptance criteria, stop conditions, skills to auto-trigger, T-trap enumeration, and full brief — no need to repeat any of that in the 1-liner.

**Provenance:** F.1 prior-art ([research-patches/2026-05-24-meta-orchestrator-ux-research.md §A.5(i)](../../../docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-ux-research.md) — PR #203) found the earlier slash-tag draft (`/Mode-A /Roles-worker /Skills-foo /Autonomous-yes /Iterative-review-no`) has **ZERO upstream precedent** across 10 surveyed tools (GHA, Cline `new_task`, Discord slash, Copilot Chat, ChatOps, etc. — all converge on `/<command> <natural-language-payload>`). Maintainer 2026-05-24 evening refined further: drop multi-line draft as well, true 1-liner with everything else deferred to kickoff anchor. The slash-tag format + multi-line draft were both *draft hypotheses* in earlier kickoff revisions — this block replaces them.

**Falsifier:** wrong if global `~/.claude/skills/orchestrator/SKILL.md` does NOT actually parse natural language after `/orchestrator` invocation (e.g. requires structured args). F.3 MUST read the global skill body before codifying this format in SKILL.md / `references/output-format.md`. (Agent-uncommittable: F.3 reads but does not edit the global skill.)

**Output structure for `/meta-orchestrator <umbrella>` invocation (3-layer maintainer-facing):**

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — <umbrella> (<date>)
═══════════════════════════════════════════════════════════════

## Dependency graph

[ASCII graph showing stage-to-stage dependencies + parallelism using ↓ arrows
 and explicit "PARALLEL-OK" markers between sibling stages]

## Action queue — что ты делаешь

| # | Paste в новый CC tab | Когда | Ждёшь | Можно параллельно с |
|---|---|---|---|---|
| 1 | блок «Stage 1» ниже | Сейчас | <PR/event> | — |
| ... | ... | ... | ... | ... |

Всего твоих paste'ов: <N> (зависит от <conditions>; max=<M> если все GO).

## 1-liner blocks (копируй ОДИН блок = ОДНА новая CC сессия)

### Stage 1 — <name> (<Mode>, ~<duration>)
[1-liner block per format above]

### Stage 2 — ...
[...]
═══════════════════════════════════════════════════════════════
```

**Concrete examples to include in `references/output-format.md`:** 4 worked examples — Mode A single (R-phase audit), Mode SDD (build with implementer + 2 reviewers), Mode B × N (parallel workers in worktrees), Mode Queue (sequential kickoff queue).

**Autonomy path — DEFERRED to separate R-phase per maintainer 2026-05-24 evening (F.2 D4 final position):**

> Maintainer 2026-05-24 evening dialogue progression:
> 1. F.2 surfaced D4 fork (status-quo vs full-autonomous vs hybrid)
> 2. Maintainer initial ratify «пусть делает» → I (over)interpreted as B-as-default
> 3. Maintainer reconsidered after C→B explanation: «это мне нравится... обьясни попроще»
> 4. Quality concern surfaced: «бывает нужно сделать ресерч он вызывает сабагента ресерчера для этого тот вызывает своих, в таком случае твоя схема работает?»
> 5. Capability-check verified: CC subagent depth=2 hard limit ([sub-agents.md line 753](https://code.claude.com/docs/en/sub-agents.md): «Subagents cannot spawn other subagents»; [agent-teams.md](https://code.claude.com/docs/en/agent-teams.md): «No nested teams»)
> 6. Final position: «ну ты сам сказал что клод код так не работает а значит не вариант использовать B а оставляем там С B только где задача однолинейна в общем это большой вопрос пока получается все в пользу того чтобы мета оркестратор большие задачи декомпозировалал как это уже сделано сейчас»

**Interpretation (BINDING — what F.3 must / must NOT do):**

- **F.3 MUST NOT codify «Option B (full-autonomous umbrella queue)» as default OR as opt-in flag.** Любая binding-level decision о umbrella-level autonomy откладывается до отдельной R-phase, где CC depth=2 constraint анализируется against конкретные quality-degradation scenarios (deep research, recursive review, iterative fix loops).
- **F.3 MUST preserve current pattern:** meta-orchestrator декомпозирует большие задачи в kickoff'е на N линейных sub-waves; каждый sub-wave dispatcher через Worker per current §5 dispatch tree. Это **уже работает** — Worker is one-shot линейная задача, depth=2 constraint неактуален, quality = single Opus session.
- **F.3 MAY (optional, не binding):** в §5 dispatch tree пометить **внутри-stage parallel-safe sub-waves** как «aggregable into single 1-liner» — это операционализация текущего status-quo, не новая autonomy. Не обязательно для F.3 acceptance; можно отложить.

**Future R-phase scope (DEFERRED, not part of F.3):**

Когда / если maintainer решит вернуться к autonomy design — отдельный kickoff с следующими открытыми вопросами:

1. **Линейная-vs-нелинейная классификация** — какие признаки делают sub-wave «линейной» (одношаговая, без recursion need, без deep-research, без multi-axis review)? Это критерий применимости опт-ин Option B.
2. **Quality preservation strategies при depth=2 constraint** — как sub-orchestrator декомпозирует «нелинейную» работу на параллельные Level-2 Workers без потери качества? Какие use cases категорически НЕ декомпозируются и требуют maintainer touchpoint?
3. **Iterative loop semantics в depth=2** — research→review→fix цикл координирует Level-1 sub-orchestrator с REVISE cap (3 итераций max?), maxTurns ceiling per Worker, DEFER discipline. Где границы автономности до false-DEFER каскада?
4. **Test-umbrella для quality-parity gate** — какие метрики и какой baseline?

Design notes (не binding, как input для future R-phase):
- REVISE-cycle cap = 3 итерации (proposal)
- Sub-orchestrator декомпозирует, не Worker (constraint per depth=2)
- DECISION-NEEDED → DEFER, не halt
- Auto-merge per stage уже работает (memory `feedback_harness_merge_block_and_500line_gate`)
- Blast-radius cap (3 stages?) для опт-ин режима
- Capability anchor: depth=2 verified 2026-05-24

**Why DEFER vs commit now:** maintainer 2026-05-24 explicit framing: «это большой вопрос... нужно я думаю это все изучить и обдумать как лучше сделать». Кускового compromise (B-only-for-linear) недостаточно — линейность sub-wave может быть emergent property (выглядит линейной до DECISION-NEEDED in flight). Honest design требует R-phase, не binding-by-pressure.

**F.3 scope clarification (after DEFER):**

F.3 фокусируется на ORIGINAL ask из kickoff §1 Sub-wave F intro (line 167-174 — UX improvements: explicit antipatterns + 3-layer output spec + 1-liner format revision based on F.1 prior-art) + bundled F.2 wording fixes (M1/M2/m1-m3 + D3 MAJOR misattribution). Autonomy design = OUT of F.3 scope.

**F.3 design implications (must be addressed in F.3 SKILL.md edits):**

1. **§5 dispatch tree** — добавить новую строку «Umbrella-level orchestration (≥2 stages, autonomous default)» → `Queue mode umbrella` mechanism (новый паттерн, не классический research-queue). Распространить queue-mode triggers — текущий queue-mode.md:14-22 (`file:///Users/art/.claude/skills/orchestrator/references/queue-mode.md`) anti-trigger «execution tasks that modify production code in parallel → Mode B × N» применим к **parallel**, не **sequential** stages umbrella; sequential umbrella execution через Queue mode совместим (verify before F.3 codifies).

2. **§5 vs queue-mode.md anti-trigger alignment** — расширить queue-mode.md (global skill, agent-uncommittable per memory `feedback_settings_json_agent_uncommittable` similar — global skills owner=maintainer) с новой строкой Triggers: «umbrella-level execution с sequential stage-gates → Queue mode OK при auto-merge to staging» или ввести подкласс «Queue-over-stages». F.3 surfaces как maintainer-applied edit (предлагает diff, не landится сам).

3. **DECISION-NEEDED handling в autonomous queue** — sub-wave surfaces fork → orchestrator (a) DEFER stage + notify maintainer через REPORT (не halt всю umbrella; (b) continue с следующими parallel-safe sub-waves если есть. Не выбирать strategy за maintainer per [reviewer-discipline.md §2](../../rules/reviewer-discipline.md).

4. **Auto-merge per stage** — каждый stage's PR авто-мерджит в `staging` (per memory `feedback_harness_merge_block_and_500line_gate` — agent-autonomous merge to staging уже работает). Между stages: `gh pr list` polling + plan-currency-check за определением «Stage N merged → Stage N+1 dispatch».

5. **Blast-radius cap** — orchestrator в autonomous queue режиме НЕ должен превышать **3 stages** без maintainer touchpoint (если umbrella имеет 5 stages → стопать после 3 с REPORT + ждать reinvoke). Защита от long-cascade-failure. Cap configurable через kickoff §N или `/Autonomous-cap-<N>` опцию.

6. **Falsifier:** если первый full-autonomous umbrella dispatch вызывает >2 DECISION-NEEDED DEFER'а или ломает staging — откат на текущую N+1 модель (maintainer-as-loop-closer как дефолт). Прецедент для отката — incident-based, не anticipated.

**Scope of edits (F.3):**
- `.claude/skills/meta-orchestrator/SKILL.md`:
  - §5 dispatch tree — add antipatterns `#worker-dispatch-via-subagent` + `#commit-on-behalf-of-worker` (explicit prose + falsifier).
  - §10 output artifacts — add mandatory subsections §10.X.a (dependency graph), §10.X.b (action queue table), §10.X.c (1-liner blocks). Mandatory = principle 18 test below validates presence in SKILL.md §10 (NOT manual smoke).
  - §10.4 — add 4 worked output examples OR move to `references/output-format.md`.
- `.claude/skills/meta-orchestrator/references/output-format.md` — new file with 1-liner block grammar + 4 worked examples + ASCII graph templates (decision: inline vs reference based on SKILL.md line count post-F.3 — current 500-line ceiling).
- `.claude/skills/meta-orchestrator/templates/meta-kickoff.template.md` — no edit needed (this kickoff already kickoff-side content).
- Mirror EVERY edit to `skills/meta-orchestrator/` consumer copy (per round-2 MAJOR-1 lesson; #194 mirror-skip incident).
- **`packages/core/principles/18-meta-orchestrator-output-format.test.ts` — NEW file (deterministic smoke-replacement, maintainer-requested 2026-05-24 evening)**:
  - Reads `.claude/skills/meta-orchestrator/SKILL.md` + `skills/meta-orchestrator/SKILL.md` (both copies).
  - Asserts §10 (output artifacts) section contains all three required substructure headers/spec-snippets:
    1. **`Dependency graph`** — heading + ASCII template (e.g. literal substring `## Dependency graph` AND `↓` arrow somewhere in §10).
    2. **`Action queue`** — heading + table template (e.g. `## Action queue` AND a markdown table row containing columns `Paste` / `Когда` / `Ждёшь` / `Можно параллельно`).
    3. **`### Stage N`** — at least 1 `### Stage` heading subsection (the 1-liner block template).
  - Mirrors must agree (both SKILL.md copies pass identical check; drift = test fail per round-2 MAJOR-1 lesson).
  - Companion paired-negative test: temporarily delete one of the 3 substructures → test must fail; restore → test must pass. Per `principle 02-paired-negative-test.test.ts` discipline.
  - Pre-existing precedent: `principle 12-ai-laziness-traps.test.ts` validates `## §5 AI-traps active` presence + T-enumeration syntax in kickoffs. Principle 18 = analogous structural check, applied to SKILL.md §10 instead of kickoffs.
  - Slot 18 verified free as of 2026-05-24 (slots 01-17 occupied per `ls packages/core/principles/`).

**Sub-wave F dispatch order:**
1. F.1 + F.2 in parallel (read-only, no file conflicts) — 2 Mode A inline Opus Agents.
2. F.3 after BOTH F.1 + F.2 complete (write to SKILL.md depends on both verdicts).

**Maintainer feedback on initial 1-liner format draft (2026-05-24 evening, captured in live UX testing):**

> «не удобный формат мне не нравится обязательно нужно будет обновить улучшить»

The draft slash-prefix tag format demonstrated in this kickoff (`/Mode-A /Roles-worker /Skills-rules-as-tests /Autonomous-yes /Iterative-review-no /Kickoff:...`) and in the live `/meta-orchestrator mutation-discipline-umbrella` demo output was **explicitly rated «not convenient»** by maintainer. **F.3 is NOT a codify-as-drafted task** — F.3 must:

1. **Treat the slash-prefix format as a starting hypothesis, not the final answer.**
2. **Synthesize F.1 prior-art findings + maintainer feedback** into a revised format that passes maintainer's UX bar. F.1 verdict on «paste-this» patterns in upstream CI/orchestration tools (GitHub Actions matrix, Concourse, Argo, Dagger) directly inputs this revision.
3. **Verify format actually works with global `/orchestrator` skill in `~/.claude/skills/orchestrator/SKILL.md`** — global skill parses natural-language after invocation, NOT structured `--flag=value` args. Verify whether `/Mode-A /Roles-worker` notation is parsed as expected or if a natural-language fallback («Mode A worker on .../kickoff.md §4») is more reliable. Read global skill source for ground truth; do NOT assume.
4. **Iterate on format with maintainer at least 1 round** — F.3 ships v1 of revised format, maintainer reviews, F.3 patches v2 if needed. Single-shot ship-and-forget = high probability of repeating the same «not convenient» complaint.
5. **Falsifier:** if F.1 surfaces a mature upstream paste-format-pattern (e.g. GitHub Actions workflow_dispatch input format, Dagger pipeline invocation syntax) that solves the problem class → ADOPT verbatim, do NOT BUILD a new format. Per [build-first-reuse-default.md](../../rules/build-first-reuse-default.md).

**Acceptance for Sub-wave F:**
- F.1 research-patch shipped in `docs/meta-factory/research-patches/`.
- F.2 cold-review REPORT shipped (textual, no edits made by F.2 itself).
- F.3 SKILL.md edits + consumer mirror sync verified + principle 12 still green + own cold-QA pre-handoff (T19) before PR.
- All 4 worked output examples present (inline §10.4 OR `references/output-format.md`).
- One end-to-end smoke test: invoke `/meta-orchestrator mutation-discipline-umbrella` post-F.3 — verify output matches the 3-layer structure.

**Stop conditions for Sub-wave F:**
- **F.1 finds mature upstream tool** with identical UX problem-class match (T16 verified, not assumed) → ADOPT verbatim; skip F.3 BUILD; document via SSOT row.
- **F.2 finds BLOCKER** in SKILL.md NOT introduced by this kickoff's audit cycles → escalate to maintainer; do NOT fix in F.3 (scope creep `#out-of-umbrella-fix`).
- **F.3 SKILL.md exceeds 500-line gate** post-edit → split mandatory content into `references/output-format.md` (per the round-2 retro precedent on the 500-line limit).
- **Any F sub-sub-wave spawns Worker for write task** → STOP immediately, this kickoff is fixing exactly that antipattern. T15 self-application: F.3's own edits cannot be done by a spawned write Worker. F.3 = Direct Edit by the orchestrator session, OR handoff via 1-liner to a fresh CC session.

---

## §1.5 Observed skill gaps (maintainer-contributed, 2026-05-24)

Surfaced by maintainer during the /meta-orchestrator session that authored Sub-wave E (verbatim, light reformatting):

> «Известные дыры в скилле (если она ищет что фиксить). Из моей текущей сессии я заметил:»

**Gap-1 — §3 `launch-table-generator.sh` regex over-matches.**
- The generator detects «sub-waves» via a regex of the shape `^| <number> |` which matches **both** hook rows in `§1` tables of an umbrella kickoff AND real sub-wave rows in `§4`. If an umbrella has e.g. §1 with 6 hooks and §4 with 3 sub-waves, the generator returns 6 sub-wave rows — incorrect.
- Maintainer's session was a coincidence — both counts happened to be the same (6 = 6), so the result looked right but was structurally wrong.
- **Partial-fix status (Phase -1 verified):** PR #194 fixed the *symptomatic* `exit 1` on empty-arg path (which triggered §3 `!shell` failure). The **structural regex-scope issue remains open** — `detect_subwaves()` line ~43 still uses `grep -E '^\| *(\*\*)?([A-D]|[0-9]+)(\*\*)? *\|'` which matches any `| 1 |` row in §1 hook tables AND §4 sub-wave rows. Testing the kickoff.md itself with the current regex still over-matches §2 dispatch table rows.
- **Fix locus:** [`.claude/skills/meta-orchestrator/helpers/launch-table-generator.sh`](../../skills/pipeline/helpers/launch-table-generator.sh) — tighten the regex to anchor on a `§4` / «Sub-wave» heading boundary, not on row shape alone. **AND mirror to `skills/meta-orchestrator/helpers/launch-table-generator.sh`** (consumer mirror — #194 did NOT mirror its own fix, so this Gap fix and the #194 mirror-sync land in the same commit).

**Gap-2 — §1 `plan-currency-check.sh` misses fresh PRs.**
- Currently only checks `gh pr list --state merged`. Does **not** cross-check against `git log origin/<branch>` for commits that landed *after* the most recent local `git fetch`.
- Maintainer's session missed #193 and #194 at session-start because they merged seconds before the helper ran — `gh pr list --state merged --limit 30` returned them, but the helper didn't reconcile to `git log staging..origin/staging` or remind the model to `git fetch` first.
- **Fix locus:** [`.claude/skills/meta-orchestrator/helpers/plan-currency-check.sh`](../../skills/pipeline/helpers/plan-currency-check.sh) — add a `git fetch origin <branch>` step + diff against local; surface «remote ahead by N» as part of §1 drift output.

**Gap-3 — §4 meta-kickoff template missing worktree symlink slot.**
- Worker sub-agents dispatched into worktrees each re-discover `packages/core/node_modules` symlink discipline (workspaces / remark dep resolution). Could be inlined as a template slot («§Xa Worktree prep») so every kickoff carries the exact `ln -s ../../node_modules packages/core/node_modules` (or current equivalent) instruction.
- **Fix locus:** [`.claude/skills/meta-orchestrator/templates/meta-kickoff.template.md`](../../skills/pipeline/templates/meta-kickoff.template.md) — add a new template section + corresponding placeholder + SKILL.md §10 update + `references/placeholders.md` entry.

**Scope-guard (falsifier from maintainer):**

> «скилл-фикс должен фиксить сам скилл, не данные которые скилл генерирует»

If the audit session is tempted to «rewrite the M.4 kickoff because its row 2 is wrong» — **that is out of scope.** M.4 kickoff is *data* the skill generates; the maintainer will fix data themselves or surface for their own follow-up. Sub-wave E + this §1.5 list fix **the skill**, not the artefacts the (possibly-buggy) old skill produced.

**Discretion:** the maintainer explicitly said «не обязательно фиксить все, surface которые проще». The audit session may:
- Fix all three in Sub-wave A's fresh-eye pass (cheapest; each is a small helper / template tweak).
- Fix one or two and leave the rest as research-patch follow-ups under `docs/meta-factory/research-patches/2026-XX-XX-meta-orchestrator-gap-<N>.md`.
- Fix none and write a single «3 gaps observed, deferred for round 3» research-patch.

Pick based on cost: if all three are ≤30 LOC total and have no breaking-change risk → bundle into one PR with round-2 changes. If any exceeds ≤30 LOC or risks breaking principle 12 / hook tests → surface as deferred follow-up.

---

## §2 Sub-wave order + dispatch mode

Recommended order (verify before executing):

| # | Sub-wave | Mode | Cost | Order rationale |
|---|---|---|---|---|
| 1 | A — Fresh-eye diff + mirror sync | Mode A inline Agent (Opus) | ~30-50k | Read-only audit; surfaces findings that may modify B/C/E scope. Also verifies/repairs mirror divergence (#194 leftover). |
| 2 | B — Compliance check | Mode A inline Agent (Opus) | ~30-50k | Read-only; may surface BFR-default gap → C/E/D scope changes |
| 3 | C — Russian triggers | Direct Edit (orchestrator) | ~5k | Small; depends on A's «is description still right shape» finding |
| 4 | E — Plain-language tail | **Mode A inline Agent (Opus)** investigation-first → then small Direct Edit | ~20-40k | Hook overlap analysis (read `end-of-turn-reminder.sh`, probe failure modes, E1/E2/E3 verdict) is NOT a 5k Direct Edit. After verdict picked: small Direct Edit for SKILL.md §10 + template §7a + mirror. |
| 5 | D — Extended TDD | Mode A × 4 parallel inline Agents | ~120-150k | Heavy; do last so any A/B/C/E patches are tested |
| 6 | F.1 — UX research | Mode A inline Agent (Opus) | ~30k | Read-only; parallel-safe with F.2 (different output files). Should ideally precede F.3 BUILD decision. |
| 7 | F.2 — Cold review of SKILL.md | Mode A inline Agent (Opus, fresh-eye) | ~30k | Read-only; parallel-safe with F.1. Should ideally precede F.3 to surface SKILL.md issues before edits. |
| 8 | F.3 — UX implementation | Direct Edit (orchestrator) OR handoff via 1-liner | ~30-40k | Write; depends on F.1 + F.2 verdicts. **MUST NOT spawn write Worker subagent** (T15 self-application — F.3 fixes that antipattern). |

**File-lock check (D):** all 4 D-agents in the *happy path* are pure read+report, no file edits → parallel safe. **REFACTOR-transition protocol** (per Phase -1 MAJOR-3): if any scenario's with_skill subagent rationalizes the loophole → halt the parallel batch, sequential REFACTOR cycle (edit SKILL.md → mirror to consumer copy → re-run ONLY the failing scenario's 2 agents, not all 4 — passed scenarios stay valid unless the SKILL.md edit affects their tested clause). Max 3 REFACTOR cycles per scenario. Track in inline notes; do NOT re-dispatch all 4 agents unnecessarily.

**File-lock check (F):** F.1 + F.2 are pure read+report → parallel safe. F.3 writes to SKILL.md + `references/output-format.md` + consumer mirror — sequential after F.1/F.2 GO.

**Recommended scheduling:** F.1 + F.2 in parallel after Sub-wave D (or independently of D since they touch different artifacts; F is about UX of the skill, D is about pressure-testing existing prompt). F.3 after both F.1 + F.2 land.

---

## §3 Stage gates (real git checks)

There are no merge-gate dependencies inside this kickoff — all sub-waves operate on the already-merged round-1 + #193 + #194 state. The only gate:

```bash
# Title-text search (covers #192 "audit round 1 …" + #193/#194 "fix(meta-orchestrator): …"):
gh pr list --state merged --search "meta-orchestrator" --json number,title,headRefName,mergedAt --limit 10
```

**Hard gate:** `#192` must be present. If absent → round-1 not landed → STOP, escalate.

**Soft check (informational):** `#193` + `#194` are post-round-1 hotfixes already on staging. If either absent, Sub-wave A can still proceed against #192 baseline — log the absence and reconcile vs §0 description (the kickoff was authored assuming both were merged).

---

## §4 Acceptance criteria

This kickoff is DONE when:

1. ✅ Sub-wave A produced fresh-eye diff report (findings list, M/M/no-issue classified) **AND consumer-mirror sync repaired** (or drift documented as a Major finding to fix in this round; round-1's "5/5 identical" claim is FALSE per Phase -1 verification — SKILL.md + helpers/launch-table-generator.sh diverged)
2. ✅ Sub-wave B produced compliance report against 4 invariants + gap list (if any). Invariant 4 output is analysis-only, no implementation (per §1 Sub-wave B scope ceiling).
3. ✅ Sub-wave C added Russian triggers to both SKILL.md files; mirror sync verified; frontmatter <1024 chars
4. ✅ Sub-wave E — plain-language-tail requirement landed per chosen verdict (E1/E2/E3):
   - **If E1 (hook is right channel, fix hook):** SKILL.md §10 + template §7a are one-line cross-refs **plus** state the hook's trigger conditions and what the hook enforces (not just `> See end-of-turn-reminder.sh`).
   - **If E2 (dual-pair: hook = mechanical gate, SKILL = substance standard):** §7a substantively defines trigger conditions + what counts as a good plain-language tail + anti-patterns. Carries `@dual-pair: plain-language-tail` markers per [dual-implementation-discipline.md §5](../../rules/dual-implementation-discipline.md).
   - **If E3 (architectural change — replace hook with pre-submit gate):** escalate to maintainer before any edit; this kickoff does NOT execute E3, only documents the verdict + recommendation.
   - Consumer mirror synced; principle 12 still green.
5. ✅ Sub-wave D dispatched 4 parallel agents; reports compared; any discipline gap surfaced + patched (per §2 REFACTOR-transition protocol) + re-tested
6. ✅ All round-2 changes committed + PR'd + merged to staging (or maintainer-decision if blocked)
7. ✅ Round-2 kickoff progress noted in this kickoff file's final §0 update (no separate state.md required — keep audit trail inline)
8. ✅ Sub-wave F.1 — research-patch `docs/meta-factory/research-patches/2026-05-XX-meta-orchestrator-ux-research.md` shipped with prior-art summary + verdict per pattern
9. ✅ Sub-wave F.2 — cold-review REPORT shipped (text, no edits made by F.2); BLOCKER/MAJOR/MINOR list + DECISION-NEEDED items
10. ✅ Sub-wave F.3 — SKILL.md §5 antipatterns added (`#worker-dispatch-via-subagent` + `#commit-on-behalf-of-worker`); §10 expanded with 3-layer output spec (graph + table + 1-liner blocks); `references/output-format.md` (new file with 4 worked examples for Mode A/SDD/B/Queue) — OR inline if SKILL.md stays under 500 lines post-F.3; consumer mirror synced; principle 12 green; own cold-QA pre-handoff
11. ✅ Smoke test: invoke `/meta-orchestrator <any-existing-umbrella>` post-F.3 — output structure matches the 3-layer spec; 1-liner blocks copy-paste-ready and self-contained

---

## §5 AI-laziness traps active (per `ai-laziness-traps.md §3`)

See `.claude/rules/ai-laziness-traps.md §2` for full catalogue.

**Active canonical traps for this round-2 audit:**

- **T1 «sampled 3, all clean, done»** — sub-wave D scenarios are sampling-based; if first 2 pass cleanly do NOT close. Run all 4.
- **T3 «plausible finding without verification»** — sub-wave A/B findings must cite file:line + actual content, not summary.
- **T6 «self-reporting high confidence»** — sub-wave D's with_skill agents and any REVISE→re-test confidence claim must specify what evidence supports it (file:line counts, test-pass record), not abstract "high".
- **T11 «designing without prior-art check»** — sub-wave B Invariant 1 IS this trap's countermeasure; do not skip the 6-item search check on «no upstream anti-rationalization pattern exists» claim.
- **T12 «skip lit sweep — I already know the area»** — sub-wave E hook-overlap probe must NOT reason from training-data knowledge of CC hooks. Read `.claude/hooks/end-of-turn-reminder.sh` directly (local source = ground truth for the actual installed behaviour). For CC primitive contract questions (Stop event semantics, `additionalContext` JSON shape), dual-channel verify per [dual-channel agreement ≠ ground truth](feedback memory): claude-code-guide built-in subagent + canonical docs `WebFetch https://code.claude.com/docs/en/hooks.md` cross-check.
- **T13 «ADOPTED items zero-work»** — sub-wave A: did round 1 ADOPT something from Superpowers/native skill-creator without auditing it? If yes — audit now.
- **T15 «self-application skipped»** — §-1 above IS T15 countermeasure for this kickoff. Sub-wave D's REFACTOR loop is T15 countermeasure for the meta-orchestrator skill itself. **Apply §5 trap enumeration to the round-2 kickoff itself** (this section IS that application — meta-recursion).
- **T16 «pattern-matching-on-name»** — sub-wave E E1/E2/E3 selection: «the hook already does plain-language tail» (name-match) ≠ «the hook solves maintainer's actual problem» (function-match). Verify problem-class match explicitly: «hook's problem class = X; maintainer's complaint = Y; match? evidence: …». If X≠Y, the hook is the wrong tool — even if it does «something with plain-language tail».
- **T17 «destructive delegation without preserving»** — if sub-wave A surfaces «delete this paragraph» findings, preserve the old text in a research-patch before deleting. **Sub-wave A's output format must include a `Before deletion: <preserved-where>` field for any delete-finding.**
- **T19 «handoff without own cold-QA»** — before declaring this kickoff DONE, run own cold-review of the diff against §4 acceptance criteria. CI green ≠ design substance.

**Domain-specific traps for this round-2 audit (T-MOB-FOLLOWUP family):**

- **T-MOB-FOLLOWUP-A «trust round-1 verdict without re-verification»** — round-1 self-reported «convergence reached» but it self-graded. Round-2 must verify independently. Specifically: re-run round-1's «mirror sync 5/5 identical» check; don't trust the prior claim.
- **T-MOB-FOLLOWUP-B «extend TDD only on previously-tested axes»** — Scenarios 3+4 must explore axes round-1 did NOT cover (drift detection, CLI failure paths). Adding «stage-gate variant N+1» repeats T1.

---

## §6 Recursive self-application

This kickoff was generated within the meta-orchestrator's own discipline. Per principle 12, this kickoff itself will be scanned for T-enumeration syntax (§5 above) — verify via:

```bash
npm --prefix packages/core run test 2>&1 | grep -E "principles/12|principles passed"
```

Must pass before §1 execution begins.

---

## §7 Stop conditions

- Any `gh` command returns error → halt sub-wave, surface, do NOT assume cached state.
- Sub-wave D Scenario 3 or 4: if with_skill subagent rationalizes loophole → halt D, REFACTOR skill (REVISE the SKILL.md + mirror), re-test scenario per §2 REFACTOR-transition protocol. Max 3 REFACTOR cycles per scenario; if iter 3 still fails → escalate to maintainer.
- Phase -1 reviewer on this kickoff returned REVISE 3× → escalate.
- **Quota — clarified per Phase -1 MAJOR-4:** the "Red zone >80k" in `/orchestrator` skill refers to the **main orchestrator session's own context tokens**, not the cumulative across dispatched Agents. Each Agent's `total_tokens` is *its* burn, paid from the shared Opus pool but isolated from the main session's context window. Thresholds for THIS kickoff:
  - **Main session context** (orchestrator) — stay <80k. If approaching, summarise sub-wave outputs aggressively before next dispatch.
  - **Cumulative Opus across all dispatched Agents + main session** — soft pause at 200k (status update to maintainer), hard pause at 280k. Sub-wave D's ~120-150k is the dominant cost — schedule a checkpoint summary *before* D starts to free main-session headroom.
  - **Mid-D pause guidance:** if D is mid-flight and combined session+D crosses 280k → finish the in-flight Agent (don't kill it), commit any partial findings, surface to maintainer with "completed scenarios X/4, remaining Y/4 pending quota reset" — do NOT silently abandon mid-batch.

---

## §8 Anti-scope

- Do NOT modify `~/.claude/skills/orchestrator/` (agent-uncommittable, maintainer-owned).
- Do NOT re-litigate round-1's verdict (description hybrid, §2 Step 4.1 wording) unless a NEW pressure scenario proves it wrong. Round 1 closed; only extend.
- Do NOT write code outside meta-orchestrator skill scope. If sub-wave B surfaces a project-wide compliance gap, surface as `docs/meta-factory/research-patches/2026-XX-XX-meta-orchestrator-followup-gap.md`, do NOT fix globally inside this kickoff.
- Do NOT add npm deps; substrate stays bash + markdown + CC primitives.

---

## §9 See also

- Round-1 PR: **#192** (merged 2026-05-24). Follow-up hotfixes: **#193** + **#194**. See §0 for verification command.
- [meta-orchestrator SKILL.md](../../skills/pipeline/SKILL.md) (post-round-1 state)
- [Round-1 origin patch](../../../docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md)
- [parallel-subwave-isolation.md](../../rules/parallel-subwave-isolation.md), [reviewer-discipline.md](../../rules/reviewer-discipline.md), [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md), [ai-laziness-traps.md](../../rules/ai-laziness-traps.md), [build-first-reuse-default.md](../../rules/build-first-reuse-default.md), [rule-enforcement-channel-selection.md](../../rules/rule-enforcement-channel-selection.md), [phase-research-coverage.md](../../rules/phase-research-coverage.md)
- [principle 12 test](../../../packages/core/principles/12-ai-laziness-traps.test.ts)

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
