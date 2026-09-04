# Umbrella: `dispatch-worktree-automation` — eliminate manual worktree-creation step from parallel dispatch workflow

> **Status:** DRAFT planned 2026-05-29. **NOT yet dispatched.** R-phase only — no implementation until verdict is reviewed and maintainer-approved. After verdict, separate I-phase implements the winning candidate.
>
> **Authoritative for:** R-phase scope covering elimination of the recurring manual worktree-setup step in parallel R-phase / execution-build dispatch workflow — currently 5-7 terminal commands × N sub-waves per umbrella dispatch, emitted as paste-block bash in meta-launch kickoffs (`.claude/skills/meta-orchestrator/templates/meta-kickoff.template.md §4 {{DISPATCH_INSTRUCTIONS}}`).
>
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The implementation itself — separate I-phase umbrella post-verdict. Cross-worktree gitignored coordination-doc sync — see [research-patches/2026-05-17-cross-worktree-coord-doc-sync.md](../../../docs/meta-factory/research-patches/2026-05-17-cross-worktree-coord-doc-sync.md) (orthogonal). Subagent vs paste-tab discipline channel — see PR #265 research-patches/2026-05-29-skill-row3-vs-worker-dispatch-antipattern.md (sibling drift R-phase; this umbrella concerns the **automation surface**, that one concerned the **channel discipline**).
>
> **Class:** N/A (kickoff doc, not a rule). Discipline-bearing artefact — full §1.7 self-reflexive check at §6 + §7.

---

## §0 One-line frame

Maintainer hypothesis (2026-05-29 session): «manual `git worktree add` + `cd` + `node_modules` symlinks + `git checkout -b` × N sub-waves каждый раз когда дисптчу параллельную R-phase / execution-build стадию — это recurring tax который мог бы быть автоматизирован: либо embedded-в-кикофах bash, либо orchestrator-side primitive, либо ещё что-то». Reframe the dispatch UX question from «which channel for Worker?» (PR #265 surface — Agent vs paste-tab) to «**how does the worktree itself come into being without maintainer typing terminal commands?**».

---

## §1 Origin

**Recurring operational pain.** Today (2026-05-29), maintainer hit the friction explicitly when dispatching aif-handoff bridge R-phase (Sub-waves A + B): meta-orchestrator emitted in `.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge-meta-launch/kickoff.md §4` (lines 89-115) the standard paste-block format:

```bash
cd /Users/art/code/rules-as-tests-aif
git fetch origin staging
git worktree add ../rules-as-tests-aif-aif-handoff-sw-A origin/staging
cd ../rules-as-tests-aif-aif-handoff-sw-A
git checkout -b research/aif-handoff-bridge-variant-a
```

— that's 5 commands × 2 sub-waves (Stage 1) = 10 manual terminal actions, then 2 fresh CC tab opens, then 2 paste actions = **14 maintainer steps for one dispatch**. With Sub-wave C and D (later stages) the total reaches 28+ steps per umbrella.

**Predecessor work.** This morning's session (2026-05-29) produced two artefacts addressing related-but-distinct surfaces:

- [PR #265](https://github.com/Yhooi2/rules-as-tests-aif/pull/265) — R-phase research-patch identifying SKILL.md §5 row 3 vs anti-pattern §348 drift. Verdict Candidate C («`Agent({isolation:"worktree"})` as permitted channel alongside paste-tab») was applied via `/tmp/skill-edit.py` then maintainer reverted via `/tmp/skill-revert.py` because subagent-channel turned out not to be what maintainer wanted operationally (visibility + quota separation). PR #265 verdict thus is **stale** w.r.t. operational preference but the drift-identification stands.
- 3 hand-crafted paste-prompts (Stage 4 P4 fix, aif-handoff bridge SW-A, SW-B) with embedded STEP 0 bash inside the paste body. Empirical exemplar of one candidate (A below). One-off, not a systematic fix.

This R-phase is the systematic fix sweep.

---

## §2 Admission gates — DO NOT dispatch this R-phase until ALL hold

1. **`/tmp/skill-revert.py` applied + verified.** Working tree clean for `.claude/skills/meta-orchestrator/SKILL.md` (i.e. `git diff` returns nothing for that file) — ensures R-phase scope isn't muddied by half-applied Candidate C wording. ✅ Pre-requisite for clean baseline.
2. **PR #265 status decided.** Either (a) close PR #265 as «verdict superseded by `dispatch-worktree-automation` umbrella»; or (b) merge PR #265's R-phase patch as historical record (verdict marked stale in §6 of that patch). Both legitimate; maintainer call. Blocking: this kickoff cites PR #265, can't dispatch if PR is in undefined limbo.
3. **Maintainer prioritisation explicit.** This R-phase competes with: (a) `aif-handoff-as-runtime-bridge` Sub-waves A/B (Variant B fs-watcher overlaps with Candidate F below — same root mechanism, narrower deployment scope); (b) `meta-orch-channel-discipline` umbrella (promote SKILL.md:347 Class C→A); (c) any other in-flight umbrella per `wave-sequencing-plan.md §0`. Maintainer says which goes next. Parallel R-phases of multiple umbrellas with overlapping problem-class = budget burn without throughput gain.
4. **Phase -1 cold-review of THIS kickoff complete.** 1× Opus reviewer per orchestrator skill Phase -1 protocol. Reviewer verifies §1.7 forward+backward (§6 + §7 below) + §2 candidates is genuinely ≥5 distinct (not 1 dressed as 5).

If any gate fails → kickoff stays parked.

---

## §3 Candidate solutions — exhaustive enumeration

Each candidate MUST be evaluated against the 5 criteria (§4 below). R-phase output must include a concrete verdict for each, not «А и Б одинаково хороши».

### Candidate A — Embed STEP 0 bash inside the paste-block body

**Mechanism:**
```text
meta-orchestrator → emits .claude/orchestrator-prompts/<umbrella>-meta-launch/kickoff.md §4
   §4 paste-block contains BOTH bash STEP 0 (cd / git worktree add / node_modules symlinks / git checkout -b / pwd verify)
   AND the /orchestrator slash-command Worker prompt in ONE paste body.
   ↓
maintainer opens fresh CC tab (in any dir), pastes ONE block per sub-wave
   ↓
Worker session's AI runs STEP 0 bash on first turn (Bash tool), then proceeds to task body
```

**Pros:** Pure UX fix, no infrastructure. Maintainer's terminal stays untouched. Each fresh CC tab is independent (separate Opus quota window, visibility per session). No new dependencies. Backwards-compatible with all current dispatch channels.

**Cons:** Bash STEP 0 duplicated in every sub-wave paste-block (~10 lines × N sub-waves) — visual bloat in meta-launch kickoff. AI in Worker session might skip STEP 0 if prompt structure unclear (`#discipline-theatre` risk). Doesn't help when maintainer wants in-session dispatch (which is what Candidate B/E address).

**Falsifier:** wrong if (a) fresh CC tab can't execute multi-line bash reliably on first turn (verify — empirically it can; today's 3 hand-crafted prompts worked when piloted); OR (b) maintainer prefers in-session dispatch and tab-opening itself is the friction (different problem class).

**Empirical exemplar:** 3 hand-crafted paste-prompts produced 2026-05-29 today (Stage 4 / SW-A / SW-B) demonstrate the format. Reference for I-phase if A wins.

### Candidate B — CC `Agent({isolation:"worktree"})` (the reverted SKILL.md edit)

**Mechanism:**
```text
meta-orchestrator session reads umbrella kickoff §6
   ↓
For each sub-wave: dispatches Agent({isolation:"worktree", model:"opus", prompt:"<worker prompt>"})
   CC native primitive creates worktree per-subagent + auto-removes on no-change
   ↓
Subagents run in parallel within meta-orchestrator's own CC process
```

**Pros:** Zero manual setup at maintainer level. Native CC primitive (per Superpowers `using-git-worktrees` Red Flag #1 — «use the native primitive when available»). Aligned with project's adopted SSOT #64 + #65.

**Cons:** Subagents share parent session's Opus quota (no separate quota window). No separate CC tab for live progress visibility (maintainer can only see via `/workflows` or wait for completion). Audit trail is via Workflow tool result, not separate session log. Maintainer 2026-05-29 vetoed this approach operationally: «сабагент не вариант» — preferring separate fresh CC sessions for visibility + quota separation.

**Falsifier:** wrong if the operational veto is reversible (e.g. maintainer prefers speed over visibility for short tasks) OR if quota-sharing is acceptable for low-volume R-phase work. The 2026-05-29 dispatch attempt via Workflow tool burned 227k tokens on a misconfigured args parameter — independent of channel, but maintainer correlated subagent-dispatch with that waste.

**Status:** Was applied as PR #265 verdict via `/tmp/skill-edit.py`, then reverted via `/tmp/skill-revert.py`. This R-phase reassesses with fresh framing.

### Candidate C — External helper script `mo-worktree <umbrella> <suffix>`

**Mechanism:**
```text
maintainer runs single command:
   mo-worktree aif-handoff sw-A
   ↓
script handles: git fetch / git worktree add /Users/art/code/<project>-<umbrella>-<suffix> origin/staging
                cd /Users/art/code/<project>-<umbrella>-<suffix>
                node_modules + packages/core/node_modules symlinks (idempotent)
                git checkout -b <auto-derived-branch>
                echo "DONE. Open fresh CC tab in this dir, paste prompt from <kickoff-path>"
```

**Pros:** Reduces 5 commands → 1. Scriptable, version-controllable, reusable across umbrellas. Maintainer still opens fresh CC tab manually → preserves visibility + quota separation. Zero CC infrastructure changes.

**Cons:** Still manual: maintainer runs script + opens tab + pastes prompt = 3 maintainer actions per sub-wave (down from 7, but not zero). Branch name derivation logic must be specified (per-umbrella convention or `<umbrella>-<suffix>` default). New artefact to maintain (`.bin/mo-worktree` or similar).

**Falsifier:** wrong if maintainer's friction is not «typing commands» but «context-switching between terminal and CC tab» — script doesn't fix the context switch, only collapses commands.

### Candidate D — PreToolUse hook auto-creates worktree on dispatch

**Mechanism:**
```text
.claude/hooks/auto-worktree.sh — PreToolUse hook on UserPromptSubmit or SessionStart
   Reads prompt; detects marker (e.g. first line "# WORKTREE: <umbrella>/<sub-wave>")
   If marker present + not already in worktree: creates worktree, cd's session, runs setup
   Strips marker from prompt before forwarding to model
```

**Pros:** Declarative — maintainer just adds a marker line and pastes. Reusable across all dispatches. Worktree creation transparent to model.

**Cons:** Hook complexity (CC hooks can modify env but cwd-change semantics for ongoing session are not guaranteed — needs verification per CC hooks docs). Hook fires per-session, not per-dispatch — may not have the dispatch context. Adds new hook to maintain.

**Falsifier:** wrong if CC hook system cannot reliably `cd` an already-running CC session into a new worktree (likely — sessions bind to a cwd at start). May only work via SessionStart hook BEFORE session opens, which requires the worktree path passed via env var at `claude` launch time. Not paste-friendly.

### Candidate E — Native CC `WorktreeCreate` / `EnterWorktree` tool primitive

**Mechanism:**
```text
CC platform exposes a tool (per Superpowers `using-git-worktrees` Step 1a):
   WorktreeCreate({branch: "research/foo", base: "origin/staging"})
   → returns worktree path
   → session can switch into it via EnterWorktree({path})
```

**Pros:** Pure-native, zero manual. Native primitive per Superpowers guidance.

**Cons:** **CRITICAL** — verify whether CC actually exposes these tools or whether they're hypothetical. Superpowers SKILL Step 1a says «It might be a tool with a name like `EnterWorktree`, `WorktreeCreate`, a `/worktree` command, or a `--worktree` flag». «Might be» = not guaranteed. Project's Agent tool has `isolation: "worktree"` (Candidate B), but a separate WorktreeCreate/EnterWorktree primitive that creates a worktree the *current* session enters is unknown. Needs §1.5 CC primitive probe.

**Falsifier:** if probe confirms CC has no such tool today, this candidate is upstream-feature-request, not actionable now. Downgrade to long-term ADAPT.

### Candidate F — Filesystem-watcher daemon (aif-handoff bridge Variant B-equivalent)

**Mechanism:**
```text
daemon watches .claude/orchestrator-prompts/**/<umbrella>-meta-launch/kickoff.md
   On new kickoff: parses §4 sub-wave list
   For each sub-wave: git worktree add + node_modules symlinks + git checkout -b
   Notifies maintainer (notification / file marker / pull-based check)
   Maintainer opens fresh CC tabs in pre-created worktrees, pastes /orchestrator prompts
```

**Pros:** Fully automated worktree creation, no maintainer action needed for setup. Daemon is reusable for any umbrella. Compatible with both fresh-tab and Agent-inline channels.

**Cons:** Daemon process management (systemd / launchd / supervisord). Race conditions if maintainer also runs `git worktree add` manually. New dependency / new failure surface. Overlap with `aif-handoff-as-runtime-bridge` Sub-wave B (which evaluates aif-handoff itself for daemon role) — see overlap analysis below.

**Falsifier:** wrong if daemon overhead exceeds the manual cost it eliminates (single maintainer, low-volume dispatches → daemon ROI poor). Also wrong if `aif-handoff-as-runtime-bridge` Variant B verdict lands first with «Variant B = adopt aif-handoff fs-watcher» — then this candidate collapses to «use aif-handoff» (no new daemon needed).

**Overlap with aif-handoff Sub-wave B:** Sub-wave B evaluates aif-handoff-as-the-daemon. Candidate F here is daemon-from-scratch OR adopt aif-handoff. Coordination: this R-phase should explicitly check aif-handoff bridge Sub-wave B verdict (if landed before this R-phase) and use it as input; otherwise propose joint verdict.

### Candidate G — Hybrid (A + B): meta-orchestrator emits both formats

**Mechanism:**
```text
meta-orchestrator §4 dispatch generates TWO blocks per sub-wave:
   1. Embedded-STEP-0 paste-block (Candidate A) — for fresh-tab dispatch with visibility
   2. Agent({isolation:"worktree"}) example (Candidate B) — for in-session dispatch with speed
   Maintainer picks per situation; both supported
```

**Pros:** Doesn't force one trade-off; preserves maintainer choice. Captures dual-channel reality (operational preference varies by context).

**Cons:** Visual bloat in meta-launch kickoff (2× content per sub-wave). Maintainer decision-fatigue («which channel now?»). Doesn't eliminate the manual case fully.

**Falsifier:** wrong if maintainer wants ONE default and the other on-demand (then A or B alone wins + the other documented as opt-in).

---

## §4 Five evaluation criteria — each candidate scored

Every Sub-wave verdict MUST score each candidate against these 5 criteria with file:line / command-output evidence per claim (not vibes):

1. **Manual maintainer-step count BEFORE/AFTER.** Per sub-wave dispatch: how many keyboard actions does maintainer take from «I want to run this umbrella» to «Worker session is live and working»? Current baseline: 7 (fetch / worktree add / cd / symlinks bash / checkout / open tab / paste — initial `cd` to primary workdir not counted, assumed already-there). Target: ≤2 (paste prompt + open tab, or even ≤1). Score: integer.

2. **Visibility per sub-wave.** Can maintainer observe Worker progress live in a separate window? YES / NO / PARTIAL. Fresh CC tab = YES. Subagent in parent session = NO (only post-completion via Workflow result). Daemon-spawned = depends.

3. **Quota separation.** Does Worker session draw from a separate Opus pool window than the orchestrator/maintainer's primary session? YES / NO. Fresh CC tab = YES. Subagent = NO.

4. **Integration complexity / install cost.** LOC delta to land. New dependencies (daemon, hook, external tool). Onboarding cost for fresh checkouts. Target: minimal. Score: small / medium / large.

5. **Audit trail equivalence.** Can a reviewer reconstruct what the Worker did from artefacts (git log, session logs, tool results)? YES / NO / PARTIAL. All candidates that produce commits + PRs satisfy. Candidates that bypass commit (e.g. uncommitted Agent-inline edits in worktree that get auto-cleaned) are NO.

---

## §5 AI-laziness traps (per `ai-laziness-traps.md §3` mandatory cite + enumerate + ≥1 domain-specific)

See `.claude/rules/ai-laziness-traps.md §2` for full catalogue.

**Active canonical traps for this R-phase:**

- **T1** (sampling floor ≥5) — when evaluating each candidate against §4 criteria, sample ≥5 historical dispatches OR ≥5 user-stated scenarios; don't close at 1-2.
- **T3** (file:line per claim) — every claim about CC primitive existence/behaviour cites file:line in `docs/agent-sdk/typescript.md` or `code.claude.com/docs/en/*.md` excerpt.
- **T7** (run the adversarial counter-prompt, not just cite) — at §3 Candidate E (native CC tool), actually probe for `WorktreeCreate` / `EnterWorktree` / `--worktree` flag existence; don't just say «may exist».
- **T11** (BFR §3 6-layer applied) — before declaring «build new daemon» (Candidate F) or «build helper script» (Candidate C), full BFR sweep over upstream alternatives (aif-handoff, Superpowers, OhMyOpencode worktree-management, etc).
- **T12** (web-search at moment, not from memory) — for «no native CC tool exists» negative-existence claim (Candidate E falsifier), run actual probe + WebSearch + WebFetch of CC docs.
- **T13** (verify ADOPTED items have upstream evidence) — Candidate B claim «aligned with Superpowers» must cite specific Superpowers SKILL line (already done in current SKILL.md row 3, but the citation may not transfer if row 3 narrative changes).
- **T15** (self-application) — this R-phase's own dispatch workflow embodies the problem class. Does the verdict apply to itself? If Candidate A wins, does dispatching THIS R-phase use embedded-STEP-0 paste-blocks? Surface in §6.
- **T16** (problem-class match) — Candidate F overlaps with aif-handoff bridge Sub-wave B; explicit «upstream problem class: X. Our problem class: Y. Match?» check.
- **T19** (own cold-QA before handoff) — R-phase patch must be cold-reviewed by 1× Opus reviewer before PR creation (per `ai-laziness-traps.md §2 T19`).
- **T20** (verdict backed by evidence) — every ADOPT/ADAPT/BUILD/REJECT/DEFER has same-section tool call or excerpt.

**Domain-specific traps (NOT in canonical catalogue):**

- **T-DWA-A** — «Native primitive blind-trust». R-phase tempted to declare Candidate E winner because «native is best per Superpowers norm». Counter: verify the primitive EXISTS in CC today via direct probe + WebFetch of CC docs; «may exist» is not «does exist». Falsifier: probe returns no such tool.
- **T-DWA-B** — «Veto-as-permanent-NO». 2026-05-29 maintainer veto on subagent dispatch happened in context of failed Workflow run (227k tokens wasted on misconfigured args). R-phase tempted to read this as permanent rejection of Candidate B. Counter: re-evaluate Candidate B under non-failed conditions; document whether maintainer's veto extends to all subagent dispatches or only the failed-workflow context. Surface as DECISION-NEEDED if ambiguous (per `reviewer-discipline.md §2`).
- **T-DWA-C** — «Embedded-STEP-0 today = embedded-STEP-0 forever». Today's 3 hand-crafted paste-prompts are exemplars, not the only Candidate A implementation. R-phase tempted to assume Candidate A means «exactly what I did today». Counter: Candidate A is the SHAPE («bash STEP 0 inside paste body»), not the SPECIFIC TEXT. Implementation may differ (different bash, different markers, different verify steps).

> **Anti-pattern warning:** blanket «see ai-laziness-traps.md» without enumeration above = T7 violation (pattern-matching the prompt instead of reasoning against it). This kickoff explicitly enumerates T-numbers AND 3 domain-specific traps per `ai-laziness-traps.md §3` mandate.

---

## §6 Required searches (`phase-research-coverage.md §1` — 6-item checklist on negative-existence)

Before any `BUILD` verdict, **all 6** must run with file:line evidence + fetched excerpts (T3 mandate):

1. **SSOT consult** — [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) for entries on: «worktree», «dispatch automation», «session bootstrap», «session-start hook», «paste prompt». Cite by ID. Known starting points: SSOT #65 (`superpowers:using-git-worktrees`, REFERENCE — Red Flag #1 mandates native primitive); SSOT #64 (`subagent-driven-development`, ADOPT VOCABULARY — relevant if Candidate B re-enters); SSOT #67 (aif-handoff full Kanban, REJECT for /meta-orchestrator scope — relevant if Candidate F → aif-handoff).
2. **DeepWiki `ask_question`** (≥3 phrasings) on:
   - `obra/superpowers` — «does Superpowers have a skill or primitive that automates worktree creation on dispatch, not just isolation?»
   - `cline/cline` — «how does Cline handle multi-task dispatch in isolated environments?»
   - `code-yeongyu/oh-my-openagent` — «how does OhMyOpencode bootstrap isolated worker sessions?»
3. **WebSearch** (≥3 phrasings, per [T12](../../../.claude/rules/ai-laziness-traps.md)): «claude code worktree auto-create on session start», «git worktree dispatcher daemon orchestrator», «agent dispatch isolated worktree automation pattern».
4. **Build-vs-reuse SSOT** — full sweep over [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md), not just keyword match. For each promising entry, T16 problem-class check: «upstream X = problem class Y; ours = automate worktree creation in CC dispatch workflow; match?»
5. **CC primitive verification** — direct probe + WebFetch of `code.claude.com/docs/en/skills.md`, `code.claude.com/docs/en/hooks.md`, `code.claude.com/docs/en/sub-agents.md`. Required outputs:
   - **5a — `WorktreeCreate` / `EnterWorktree` tool existence:** does CC expose a tool for creating a worktree the current session enters? (Candidate E)
   - **5b — `--worktree` flag on `claude` CLI:** does `claude --worktree=<path>` start a session in a new worktree? Test: `claude --help | grep -i worktree`.
   - **5c — Hook semantics for cwd change:** can a SessionStart or PreToolUse hook reliably change the session's cwd? Verify in `hooks.md`. (Candidate D)
   - **5d — Agent tool `isolation:"worktree"` semantics under Workflow:** today's failed Workflow burned 227k tokens with workers receiving `undefined` prompt — diagnose whether args-passing was the root cause or whether Workflow + Agent isolation has deeper limitation. (Affects Candidate B re-evaluation.)
6. **DeepWiki on this repo** — `Yhooi2/rules-as-tests-aif` — search for prior incidents/research on «worktree automation», «dispatch hook», «session bootstrap» in `.claude/skills/` + `.claude/hooks/`. Also search merged PR history for prior worktree-automation attempts that may have been abandoned.

---

## §7 §1.7 Forward-check applied (kickoff-author obligation)

This kickoff is a discipline-bearing artefact — must comply with all active disciplines per `.claude/rules/`. Sweep:

- **[doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md):** kickoff lives under `.claude/orchestrator-prompts/<umbrella>/` — gitignored per `.gitignore:2`, follows folder-level scope-by-filename pattern; per-file Authoritative-for header included above (top of file). ✓
- **[phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md):** §6 above specifies 6-item checklist for the R-phase Worker; Worker MUST run all 6 with file:line evidence per claim. ✓
- **[phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md):** this very forward+backward check satisfies §1.7 for the kickoff itself; the R-phase patch (Worker deliverable) will produce its own §1.7. ✓
- **[phase-research-coverage.md §1.12](../../../.claude/rules/phase-research-coverage.md):** R-phase Worker lead with reasoned recommendation in §6 of patch (not option-dump); falsifier explicit. ✓ (mandate transferred to Worker)
- **[build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md):** §3 Candidates explicitly include REFERENCE/ADAPT options before BUILD; Candidate F (daemon-from-scratch) and Candidate C (mo-worktree script) are BUILDs — must justify against §3 6-layer search per BFR. ✓
- **[no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md):** all candidates are deterministic (bash scripts, hooks, CC primitives, paste-blocks). No CI-side LLM call. ✓
- **[reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md):** DECISION-NEEDED reservations sit in §2 admission gates (2.2 PR #265 status, 2.3 priority pick), §3 Candidate B veto-reversibility, and §9 patch-§8 ATTN/DECISION-NEEDED — maintainer-strategy calls preserved per `reviewer-discipline.md §2`. ✓
- **[ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md):** §5 above enumerates 10 canonical T-traps + 3 domain-specific T-DWA-A/B/C. NOT blanket-reference. ✓
- **[parallel-subwave-isolation.md §4](../../../.claude/rules/parallel-subwave-isolation.md):** N7 verdict (REFERENCE Superpowers `using-git-worktrees`) is directly relevant — Candidate E and Candidate B both invoke the dogfooded primitive. ✓
- **[dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md):** if winning candidate ships as a hook or helper script, dual-pair markers required at I-phase. Carried as I-phase obligation (post-verdict, not §8 sweep target — §8 covers existing artefacts under THIS R-phase scope; dual-pair triggers on future hook/script which doesn't exist yet). ✓

---

## §8 §1.7 Backward-check applied (kickoff-scope sweep)

Sweep of existing artefacts under this R-phase's scope — what does it interact with, what might it silently supersede?

- **[meta-orchestrator SKILL.md §3 + §4](../../../.claude/skills/pipeline/SKILL.md)** — current dispatch instructions generator; whichever candidate wins, I-phase will edit §3/§4 generation guidance. **NOT silently superseded** — explicitly the I-phase target. Worker should NOT edit these in R-phase.
- **[meta-kickoff.template.md §4 `{{DISPATCH_INSTRUCTIONS}}`](../../../.claude/skills/pipeline/templates/meta-kickoff.template.md)** — placeholder for per-sub-wave dispatch text; same I-phase target as SKILL.md §3/§4. Verify in §6 source-of-truth check.
- **[meta-kickoff.template.md §4a Worker worktree setup](../../../.claude/skills/pipeline/templates/meta-kickoff.template.md)** — existing `node_modules` symlink helper that's already idempotent; some candidates (A, C, F) preserve and reuse this, others (B, D, E) make it redundant. Backward-compatible inclusion.
- **[placeholders.md `{{DISPATCH_INSTRUCTIONS}}` description](../../../.claude/skills/pipeline/references/placeholders.md)** — currently «name the worktree command (Mode B) or inline Agent dispatch (Mode A)»; description may need update if winning candidate changes generation shape.
- **[aif-handoff-as-runtime-bridge kickoff §3 Variant B](../aif-handoff-as-runtime-bridge/kickoff.md)** — overlaps with Candidate F. Coordination: if aif-handoff R-phase lands first with Variant B verdict, this R-phase's Candidate F evaluates that verdict; otherwise this R-phase proposes joint approach. Backward-check: do NOT duplicate work.
- **PR #265 research-patch** — sibling drift R-phase; its Candidate C verdict («`isolation:"worktree"` carve-out») was applied + reverted. This R-phase supersedes the operational direction of PR #265's verdict (channel selection is downstream of worktree automation choice). PR #265's drift identification stands.
- **[3 hand-crafted paste-prompts (2026-05-29 session, not committed)](https://github.com/Yhooi2/rules-as-tests-aif/pull/265)** — empirical exemplar of Candidate A; reference for I-phase if A wins.
- **`.claude/hooks/*.sh` existing hooks** — none currently automate worktree; Candidate D would add a new one. Backward-check: review hook-overlap per CC convention if D wins.
- **`packages/core/principles/*.test.ts`** — no current principle test gates worktree-automation discipline; Candidate D or F might warrant a new principle test post-I-phase if winning candidate becomes a recurring failure mode. Surface as future work.

No artefact silently superseded. I-phase edit targets explicitly listed.

---

## §9 Sub-wave breakdown (R-phase, single session, Mode A inline Opus)

Single R-phase sub-wave (no parallel sub-waves needed — this is a focused candidate-evaluation task).

**Worker:** 1× Opus session with this kickoff body.

**Output:** `docs/meta-factory/research-patches/2026-05-29-dispatch-worktree-automation.md` (or 2026-05-30 if dispatched tomorrow).

**Sections required in patch (per kickoff §6 + §7 + §8 + §3 evaluation):**
1. Problem restatement (own paraphrase, not copy-paste from §1)
2. Search-coverage execution (all 6 items from §6 with file:line evidence)
3. Per-candidate verdict (each of 7 candidates A-G against 5 criteria) with falsifier
4. Recommendation (lead with verdict + rationale + falsifier per `phase-research-coverage.md §1.12`)
5. §1.7 Forward+Backward sections (presence-check via pre-flight grep mandatory per `feedback_pr_s17_authoring_checklist`)
6. Self-application (T15) — does the recommendation apply to dispatching THIS very R-phase?
7. I-phase implementation sketch (≤30 LOC if BUILD, or precise file:line edits if REFERENCE/ADAPT)
8. ATTN / DECISION-NEEDED items for maintainer

**No code shipped in R-phase.** I-phase implements the winning candidate as a separate umbrella post-verdict.

---

## §10 Stop conditions (per `ai-laziness-traps.md §2 T4` — closing prematurely)

- **R-phase STOP:** if §6 CC primitive verification 5a/5b/5c returns negative-existence on all native primitives (no `WorktreeCreate`, no `--worktree` flag, no hook cwd-change) → Candidate E fails, Candidate D likely fails. Don't proceed to BUILD verdict for D without verified hook semantics.
- **Candidate F STOP:** if aif-handoff bridge Sub-wave B verdict lands AND adopts aif-handoff as daemon → Candidate F collapses to «adopt aif-handoff» (no new daemon), record finding + verdict «F superseded by aif-handoff bridge Sub-wave B».
- **Candidate B re-evaluation STOP:** if 2026-05-29 maintainer veto is documented as permanent across all subagent dispatches (not just failed Workflow context) → Candidate B = REJECT with note. If reversible → re-score.
- **All candidates REJECT:** if §3 sweep finds no candidate meeting acceptance criteria (manual step count ≤ 2 + visibility YES + quota separation YES + integration cost low + audit trail YES) → escalate as DECISION-NEEDED to maintainer; do NOT lower acceptance bar unilaterally.

---

## §11 Worker dispatch (after admission gates §2 hold)

For the R-phase Worker session — choose ONE channel based on maintainer's current preference (today 2026-05-29 → fresh CC tab paste with embedded STEP 0, per session pain):

**Channel (a) — Fresh CC tab + embedded STEP 0 (current operational preference):**

```bash
cd /Users/art/code/rules-as-tests-aif
git fetch origin staging --quiet
git worktree add /Users/art/code/rules-as-tests-aif-dispatch-worktree-auto origin/staging
cd /Users/art/code/rules-as-tests-aif-dispatch-worktree-auto

GIT_COMMON_DIR=$(git rev-parse --git-common-dir)
PRIMARY=$(dirname "$(cd "$GIT_COMMON_DIR" && pwd)")
[[ ! -e node_modules ]] && ln -sfn "$PRIMARY/node_modules" node_modules
[[ ! -e packages/core/node_modules ]] && ln -sfn ../../node_modules packages/core/node_modules

git checkout -b research/dispatch-worktree-automation
pwd && git branch --show-current
```

Then in fresh CC tab opened in that dir, paste:

```text
/orchestrator dispatch-worktree-automation §9 — Mode A inline R-phase per kickoff at .claude/orchestrator-prompts/dispatch-worktree-automation/kickoff.md. Output: docs/meta-factory/research-patches/<DATE>-dispatch-worktree-automation.md. Active T-traps per §5: T1, T3, T7, T11, T12, T13, T15, T16, T19, T20, T-DWA-A, T-DWA-B, T-DWA-C. PR base: staging. §1.7 PR-body mandate per §4b template applies. CI gate: research-patches/** NOT in §1.7 trigger paths — pre-flight grep is only programmatic check.
```

**Channel (b) — Agent({isolation:"worktree"}) inline (if maintainer reverses subagent veto post-this-R-phase landing):** see §3 Candidate B for spec. Not used today.

**Channel (c) — Self-application (T15):** if Candidate A wins this R-phase, future invocations of similar R-phases use embedded-STEP-0 paste-blocks (the format channel (a) above demonstrates). Verify post-merge.

---

## §12 Out-of-scope (explicit anti-scope)

- **NOT implementing any winner.** R-phase produces verdict + I-phase sketch only. Implementation = separate I-phase umbrella.
- **NOT modifying `.claude/skills/meta-orchestrator/SKILL.md`.** That is I-phase target; classifier blocks agent edits anyway. R-phase patch may include recipe-script for I-phase, like `/tmp/skill-edit.py` precedent.
- **NOT resolving aif-handoff bridge Sub-wave B in parallel.** That's its own R-phase. This R-phase observes verdict if landed.
- **NOT modifying cross-worktree-sync-research findings.** Orthogonal R-phase (gitignored doc sync vs worktree creation are different problem classes).
- **NOT closing or merging PR #265 in this R-phase.** Separate maintainer call (admission gate §2.2).
- **NOT writing principle test.** Future work if winning candidate becomes recurring failure mode.

---

## See also

- [PR #265 research-patches/2026-05-29-skill-row3-vs-worker-dispatch-antipattern.md](https://github.com/Yhooi2/rules-as-tests-aif/pull/265) — sibling drift R-phase on channel discipline (Agent vs paste-tab); this R-phase concerns the **automation surface** before channel choice.
- [.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md](../aif-handoff-as-runtime-bridge/kickoff.md) — Variant B (fs-watcher) overlaps with Candidate F here.
- [docs/meta-factory/research-patches/2026-05-17-cross-worktree-coord-doc-sync.md](../../../docs/meta-factory/research-patches/2026-05-17-cross-worktree-coord-doc-sync.md) — orthogonal R-phase on gitignored coord-doc sync across worktrees.
- [.claude/rules/parallel-subwave-isolation.md §4 N7](../../../.claude/rules/parallel-subwave-isolation.md) — REFERENCE to Superpowers `using-git-worktrees` (relevant to Candidates B + E).
- [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — BFR discipline; Candidates C + F (BUILDs) must clear 6-layer sweep per §3.
- `/tmp/skill-edit.py` — applied + reverted 2026-05-29; precedent for I-phase recipe-script pattern.
- `/tmp/skill-revert.py` — applied 2026-05-29 to clean working tree before this kickoff.
- 3 hand-crafted paste-prompts (Stage 4 / SW-A / SW-B, 2026-05-29 session, not committed) — empirical exemplar of Candidate A.

Prior-art: prior-art-evaluations.md#65 (`using-git-worktrees`, REFERENCE — Red Flag #1 «use the native primitive» is direct input to Candidates B + E). prior-art-evaluations.md#64 (`subagent-driven-development`, ADOPT VOCABULARY — input to Candidate B re-evaluation).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
