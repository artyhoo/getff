<!-- scope:per-role-context-shaping-raw-research -->
# Per-role context shaping — raw research for cold-verification (R-phase)

> **Authoritative for:** raw findings + falsifiable claims + verify-list for the question «should ambient context injection vary by agent role (worker/planner/reviewer)?». Output for Opus cold-verify — Opus filters, fabla decides, neither happens here. This patch does **NOT** propose a rule, does **NOT** pick options, does **NOT** write a spec. It collects evidence so downstream sessions spend tokens on judgment, not on re-search.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Decision forks are PARKED (operator + fabla decide).

**Author:** GLM-5.2 orchestrator session (token-budget workhorse; 8 delegated subagents across 3 waves: external research, project research, injection-mechanism audit, SDD template audit, wrapper-skill audit, exhaustive skill audit, in-flight mapping, scratchpad discovery).
**Date:** 2026-07-26
**Branch:** `feat/prune-worktrees`
**Mode:** R-phase. **PARK-the-fork** per `reviewer-discipline.md §2` — no verdict picked.

---

## Problem (what was asked)

Operator question (Russian, verbatim): «для каждой сессии возможно нужен разный промт — для креативщика один, для планировщика другой, для ревьювера третий, а для имплементатора другой… воркеру не нужно знать цель идею и архитектуру проекта, а только конкретное место где надо сделать и что надо сделать».

Translation: each agent role should receive a role-shaped prompt; workers should not receive project goal/architecture, only the concrete location and task.

The operator's commission was **research material + hypotheses for Opus to filter**, then fabla writes the spec. NOT a spec from this session.

---

## R1 — External: is "progressive disclosure per role" an established pattern?

### Findings (file/URL:line evidence)

| Source | Established term | Quote |
|---|---|---|
| [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | **progressive disclosure** (canonical) | "Letting agents navigate and retrieve data autonomously also enables progressive disclosure." |
| Same source | **context pollution** (anti-pattern, official) | "context windows of all sizes will be subject to context pollution and information relevance concerns" |
| Same source | **context rot** (anti-pattern, official) | "Studies on needle-in-a-haystack style benchmarking have uncovered the concept of context rot" |
| Same source | sub-agent summary norm | "returns only a condensed, distilled summary (often 1,000-2,000 tokens)" |
| [LangChain — Context Engineering for Agents](https://www.langchain.com/blog/context-engineering-for-agents) | 4 strategies: Write/Select/**Isolate**/Compress | "Isolating context involves splitting it up to help an agent perform a task" |
| [Liu et al., TACL 2024](https://aclanthology.org/2024.tacl-1.9/) / [arXiv 2307.03172](https://arxiv.org/abs/2307.03172) | **lost in the middle** (5,300+ citations) | U-shaped performance; 30%+ drop when relevant info is in middle of long context |
| [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) | per-role payload 4-tuple | "Each subagent needs (1) an objective, (2) an output format, (3) tools/sources guidance, (4) task boundaries" |
| [arXiv 2508.08322](https://arxiv.org/html/2508.08322v1) | explicit per-role payloads in coding system | "The orchestrator first invokes the Planner agent… with the structured task specification and the knowledge summary"; workers get "the relevant excerpt of the plan… code snippets… specific instructions" |
| [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents) | platform primitive | "Each subagent starts with a fresh, isolated context window… It doesn't see your conversation history" |
| [DeepWiki — obra/superpowers SDD](https://deepwiki.com/obra/superpowers) | confirms SDD per-role via file-handoff | "Each subagent receives a tailored payload"; brief/report/diff as files |

### Claim C1 (falsifiable)
**"Progressive disclosure" + "context isolation" are the established external terms; "progressive discovery" / "role-based context shaping" are NOT.** Anti-pattern names: context pollution, context rot, lost-in-the-middle.

- **Wrong if:** Opus finds a more authoritative source using "progressive discovery" or "role-based context shaping" as canonical terms.
- **GLM did NOT verify:** whether the operator's term "progressive discovery" maps to a different established concept (e.g. UX progressive disclosure vs agentic).

### Claim C2 (falsifiable)
**The principle is externally authoritative.** Anthropic, LangChain, arXiv converge on per-role context isolation.

- **Wrong if:** Opus finds the convergence is marketing, not engineering (the Liu et al. paper is about single-agent context, not multi-agent role split).

---

## R2 — Internal: how is per-role context shaped in THIS repo today?

### Findings (file:line)

**The 3-layer progressive-disclosure mechanism (path-gated, session-gated — NOT role-gated):**

| Mechanism | Event | Gating | Citation |
|---|---|---|---|
| `inject-matching-rule.sh` | PostToolUse Edit\|Write\|MultiEdit | path glob + once-per-session | `.claude/hooks/inject-matching-rule.sh:39, 50-57, 64-66, 78, 84` |
| `inject-subagent-digest.sh` | SubagentStart (CC only) | none (every subagent) | `.claude/hooks/inject-subagent-digest.sh:22-26`, wiring `.claude/settings.json:183-192` |
| `inject-project-digest.sh` | UserPromptSubmit + SubagentStart | none | `.claude/hooks/inject-project-digest.sh:36, 46-53` |
| `inject-subagent-context.sh` | PreToolUse:Agent\|Task (ZCode fallback) | tool-name matcher | `.claude/hooks/inject-subagent-context.sh:62, 73-75`, wiring `.claude/settings.json:89-98` |

**Key observation:** `inject-subagent-context.sh:62` *preserves* `subagent_type` on its stdin (per the comment) but **does not branch on it**. The plumbing for per-role branching partially exists; the branch logic does not.

**Per-role content exists in agent prompt files** — but is loaded by the agent reading its own kickoff, NOT injected per role:

- `agents/fidelity-auditor.md:32` — "Inputs (paths/text only — never chat context, never implementation logs)"
- `agents/orchestrator-worker-discipline.md:23-24` — "The full operator-side orchestrator workflow does NOT travel into the container — only this condensed portable subset does"
- `agents/backward-sweep-auditor.md` — receives ONLY the change's class (never the diff/PR), per `.claude/rules/phase-research-coverage.md:37`

**The 6-block input contract** (closest existing per-role-shape artifact): `.zcode/skills/claude-glm-executor-handoff/SKILL.md:52-71`. Load-bearing lines:
- `:56` — "`<context>` — only what THIS step needs — summarized, not raw-forwarded"
- `:64` — "Atomicity > detail. A weaker-reasoning executor optimizes one goal; multi-goal prompts drift silently"
- `:65` — "Never forward raw conversation. Summarize what's load-bearing for THIS step"
- `:71` — "This contract is not GLM-specific in shape — it applies to any weaker-reasoning executor-handoff" (author flagged for promotion; **never promoted**)

### Claim C3 (falsifiable)
**Per-role injection does not exist in any hook today.** No hook reads `subagent_type`/role and varies payload.

- **Wrong if:** Opus grep finds a hook with role branching that wave-1/2/3 missed.
- **GLM did verify:** `grep -rniE "worker\|reviewer\|planner\|role\|subagent_type" .claude/hooks/` returned only `inject-subagent-context.sh:62` as a *comment* about preservation, not a branch.

### Claim C4 (falsifiable)
**The repo's existing per-role trim rules are scoped to one role each, not generalized.** `phase-research-coverage.md:37` (backward-sweep-auditor); `agents/*.md` content loaded by agent self-read, not by hook injection.

- **Wrong if:** Opus finds a rule that generalizes per-role trim across worker/planner/reviewer.

---

## R3 — What does superpowers (the plugin) ship?

### Findings (file:line in `/Users/art/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.1.1/`)

| Aspect | Implementation | Citation |
|---|---|---|
| Hooks shipped | **EXACTLY ONE** — SessionStart injector | `hooks/hooks.json:3-15` |
| What it injects | Full body of `using-superpowers/SKILL.md` (62 lines), `<EXTREMELY_IMPORTANT>`-wrapped | `hooks/session-start:11, 27` |
| Output shape | Platform-branched: `additional_context` (Cursor), `hookSpecificOutput.additionalContext` (CC), top-level `additionalContext` (Copilot) | `hooks/session-start:38-47` |
| Per-role? | **NO** — identical for every session | (no branching in `hooks/session-start`) |
| Other hook events | **NONE** — no PreToolUse/PostToolUse/SubagentStart/UserPromptSubmit/Stop | exhaustive grep of `hooks/` and `skills/` |

**Progressive disclosure in superpowers is prose describing the host harness, not a mechanism the plugin ships.** Every mention lives in `skills/writing-skills/anthropic-best-practices.md:235, 408, 1049, 1099, 1115` — describes Anthropic's Skill-filesystem mechanism (host loads `SKILL.md` + reference files on demand via Skill tool).

**SDD's per-role shaping is categorical, not quantitative.** The brief-as-file / report-as-file / diff-as-file pattern (`scripts/task-brief`, `scripts/review-package`) keeps bulk out of dispatch. The reviewer template has the strictest scope-limit:

> "Do not crawl the broader codebase. Inspect code outside the diff only to evaluate a concrete risk you can name — one focused check per named risk" — `task-reviewer-prompt.md:38-50`

The implementer template's `## Context` slot is **unbounded** — `implementer-prompt.md:18-20`:
```markdown
## Context
[Scene-setting: where this fits, dependencies, architectural context]
```

The famous "42k-char dispatch" warning at `subagent-driven-development/SKILL.md:189-193` is **prose only** — no script counts dispatch-prompt size, no checker. `task-brief:40` and `review-package:44` only `echo` byte counts of artifact files as diagnostics.

**Planner role is NOT shaped by SDD** — `writing-plans/SKILL.md:10-12, 144-154`: planning is inline, the plan-reviewer template is orphaned and unreferenced.

### Claim C5 (falsifiable)
**Superpowers does not ship per-role injection.** The plugin's entire context-injection surface is one flat SessionStart dump.

- **Wrong if:** Opus finds a non-SessionStart hook or a per-role branch in a version newer than 6.1.1.

### Claim C6 (falsifiable)
**Progressive disclosure + injection are NOT a deliberate pair in superpowers.** They are coincidental coexistence: one flat bootstrap inject (plugin-shipped) + one inherited host capability (filesystem-Skill loading).

- **Wrong if:** Opus finds a skill or hook in the plugin that cross-references the two as a designed pair.

### Claim C7 (falsifiable)
**SDD has zero quantitative context discipline.** No token/char budget, no per-slot ceiling, no enforcement script.

- **Wrong if:** Opus grep finds a token counter or budget gate in a version newer than 6.1.1, or in a script GLM missed.

---

## R4 — Do the 3 wrapper skills (arch/pipeline/dispatcher) add context-shaping on top of SDD?

### Findings (file:line, `.claude/skills/{arch,pipeline,dispatcher}/SKILL.md`; `.zcode/skills/*` siblings are byte-identical per `diff -q`)

| Skill | Names roles? | Per-role context payload? | Adds context-shaping on top of SDD? |
|---|---|---|---|
| `arch` | Partially — two-altitude reviewer ladder (`arch:44-45`); ideation delegated to `superpowers:brainstorming` (`arch:38`) | **NO** — both reviewer seats get the same payload ("artifact paths only, never chat context", `arch:42`). Differentiation by *question* + *model tier* (`arch:47`), not by *context shape*. | **NO** — adds cold two-altitude design review + exit routing |
| `pipeline` | YES — three SDD sub-wave roles ("Implementer", "Spec-reviewer", "Code-quality-reviewer", `pipeline:319-321`); Phase -1 reviewer (`pipeline:392-398`) | **NO** — all three roles read the **same kickoff** | **NO** — `pipeline:322, 323, 424` defer to SDD vocabulary + dispatch template AS-IS |
| `dispatcher` | NO — names *question types* (technical/strategic/environment, `dispatcher:244-260`) and *park mechanisms* | N/A | **NO** — defers cold-review to `superpowers:requesting-code-review` (`dispatcher:56, 210`); dispatches via REST-to-aif (`tsx packages/runtime-bridge/src/cli/dispatch.ts`, `dispatcher:85-87`) |

**Future-intent marker:** `pipeline:528` — "activates when inject-matching-rule.sh is extended to scan `.claude/skills/*/SKILL.md` (today scans `.claude/rules/` only)" — confirms the repo's progressive-disclosure scanner does NOT yet cover the wrapper skills themselves.

### Claim C8 (falsifiable)
**The 3 wrapper skills add verdict + routing disciplines on top of SDD; they do NOT add context-shaping.** Differentiation is by *question* + *purpose* + *model tier*, never by *context payload*.

- **Wrong if:** Opus finds a per-role context table or allow/deny list in any of the three wrappers that wave-2 missed.

---

## R5 — In-flight work compatibility (what's already moving on this surface)

### Findings

**A. `session-start-token-audit` umbrella** — operator-commissioned today (2026-07-26). Branch `claude/session-start-token-audit-77d224`, tip `fb218ab6c5`, **NOT on `origin/staging`** (dispatch blocker per `kickoff-staging-placement.md`).

- **Goal** (from `.claude/orchestrator-prompts/session-start-token-audit/kickoff.md:6-11`): a fresh CC session starts at ~100k tokens; the repo's own injected set measures ~140 KB ≈ 36-40k tokens. Attribute every artifact to its injecting channel, then trim by re-scoping channels. **Budget target ≤20-25k tokens** (operator-adjustable).
- **Hard constraint** (`kickoff:9, 100-102`): never demote a load-bearing always-on check (per `attention-is-not-a-mechanism.md`).
- **S2 moves (PRE-DECIDED)** (`kickoff:86-93`): `zcode-parity-doctrine.md` add `paths:` frontmatter; `autonomous-loop-continuity.md` + `git-conflict-merge-forward.md` → `claudeMdExcludes`; CLAUDE.md hot/cold split; `MEMORY.md` English-compressed index (proposal-only).
- **Per-environment attribution (BINDING)** (`kickoff:76-84`): the aif-container executor runs a DIFFERENT harness — its session-start injection set is NOT the host CC set. Container rows attributed from a live probe, never by assuming host semantics.

**B. PR #1175** `getff-honest-signals` S6 — `feature/getff-honest-signals-s6-27553f`, OPEN, review deferred by operator.
- **What:** `inject-matching-rule.sh` corpus-absent arm — handles consumers with no `.claude/rules/` corpus (report once loudly, then quiet for the session).
- **Files touched:** `.claude/hooks/inject-matching-rule.sh` (+28/-2); plugin twin `plugin/hooks/inject-matching-rule` (byte-identical); `packages/core/hooks/inject-matching-rule.test.ts` (+116/-2); 11 install-sh baseline fingerprints.
- **Status:** code-complete, mechanically green. Review deferred — required `fidelity-verdict-in-pr-body` check RED BY DESIGN, holds merge.

**C. `inject-layer-extension`** — DONE/DEFER (PR #494, 2026-06-13). DEFER keyed on a BUILD re-trigger condition: (a) ≥6 marked rules, or (b) consumer mis-scope report, or (c) per-class generated rules. A per-role-context rule adding per-role markers may re-raise this trigger.

**D. `skill-context-runtime-probe`** — DONE (2026-05-21). Probed `.ai-factory/skill-context/<skill>/SKILL.md` override — works for background sidecars (e.g. `review-sidecar`). Generalization to dispatched workers (foreground) UNVERIFIED.

**E. AIF scratchpad Seat B** — `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scratchpad-d49985-*/REVIEW-REPORT.md`, modified 2026-07-26 20:53. VERDICT: **REVISE**. Reworked mid-flight by operator into a per-role-context review answering the operator's exact question.

- **5-axis comparison** (this project vs SDD): axes 1-4 (prompt templates, tool surface, model tier, kickoff-as-task-brief) MATCH. **Axis 5 (ambient context injection) is UNIFORM across roles — the only honest gap.**
- **Load-bearing finding (F2):** the uniform digest is **DELIBERATE anti-drift machinery**, not an oversight. Evidence:
  - 2026-05-09 incident (cited in CLAUDE.md «Artifact Ownership Contract») — reviewer agents pattern-matched on language in EXECUTION-PLAN.md §1 («north star»), then reinforced the wrong goal across reviewer cycles.
  - `.claude/session-bootstrap.md:3-7` states the design intent: "persists project goal + invariants across context compaction … more robust than CLAUDE.md compaction-block which depends on compactor cooperation."
  - The digest exists BECAUSE every role was observed to drift on goal — making it role-specific weakens the property that catches drift.

**F. AIF scratchpad Seat A** — sibling top-down review, did NOT see Seat B. VERDICT: **GO** on the umbrella. [MAJOR] finding: removing `autonomous-loop-continuity.md` from always-on injection creates a guidance gap (the §2 bounded-waiter rule is needed DURING execution, before the Stop-hook fires). Plus 3 [MINOR] (paths:/globs format mismatch, container-probe fallback, git-conflict-merge-forward rebase-reflex window).

### Claim C9 (falsifiable)
**The session-start-token-audit umbrella owns the "context budget" vocabulary** — it already establishes measurement, attribution, and the "never demote always-on" constraint. Any per-role-context work shares its surface.

- **Wrong if:** Opus finds the two threads operate on orthogonal surfaces (token-audit = always-on file load; per-role = dispatch-time delta). [Wave-3 GLM analysis says they ARE orthogonal axes — file-level trim vs per-dispatch shaping — but compose at the same hook.]

### Claim C10 (HIGH-LOAD-BEARING, falsifiable)
**The uniform session-bootstrap digest is deliberate anti-drift machinery.** Splitting it trades drift-prevention for context hygiene. This is the load-bearing tradeoff the operator's question implicitly raises.

- **Wrong if:** Opus reads the 2026-05-09 incident record directly and finds the drift was caused by something OTHER than missing uniform context — e.g. by misleading language in EXECUTION-PLAN.md being the root cause, in which case the fix is `doc-authority-hierarchy.md`, not uniform injection.
- **GLM did NOT verify:** the incident's specifics (which reviewer, which cycle, which wrong goal). Only the citation in CLAUDE.md «Artifact Ownership Contract» was read.

---

## Verify-list for Opus cold-verify (what GLM did NOT do — token-saving disclosure)

Each item is a concrete check Opus can run, not a request for judgment.

1. **Verify digest size** — run `wc -c` on the digest block in `.claude/session-bootstrap.md` (between `<!-- digest:start -->` and `<!-- digest:end -->` markers) and apply the T-TOK-A divisor (bytes/4 ASCII, bytes/2.2 if >30% non-ASCII per session-start-token-audit kickoff §1). The H2 math ("is it ~500 tokens?") depends on this number.
2. **Verify the 2026-05-09 incident** — find the original record (likely in a retro, ADR, or `docs/meta-factory/` from May 2026). Confirm: (a) was it actually a uniform-context issue, or a doc-authority issue? (b) did the fix that landed (uniform digest) actually prevent recurrence, or did something else?
3. **Verify `skill-context-runtime-probe` generalization** — does `.ai-factory/skill-context/<skill>/SKILL.md` override work for *dispatched workers* (foreground), or only sidecars (background)? Check the probe report + any successor usage.
4. **Verify `inject-layer-extension` BUILD re-trigger applies** — read `inject-layer-extension/done.md`; check whether per-role markers would re-raise SSOT #101 (marker-vs-`paths:` decision).
5. **Re-grep for hidden per-role machinery** — `grep -rniE 'subagent_type|role.*context|per-role' .claude/ packages/ scripts/ plugin/` to confirm no wave missed a branch.
6. **Verify the wrapper-skill claim (C8)** — re-read `arch/pipeline/dispatcher` end-to-end for any per-role context table GLM missed.
7. **Check newer superpowers versions** — is there a >6.1.1 release that ships more hooks? Check `obra/superpowers` releases.
8. **Verify C9 orthogonality** — does per-role-context-shaping actually compose with session-start-token-audit S2's file-trim moves, or do they conflict at the hook level?

---

## PARKED forks (operator + fabla decide; NOT picked here)

Per `reviewer-discipline.md §2`, these are surfaced as decision forks with no verdict from this session.

### Fork 1 — Does per-role ambient injection pay off at all?

Operator's context-minimization instinct vs the project's anti-drift thesis (Seat B F2). If the digest is already small (verify-list #1) and the drift incident was actually a doc-authority issue (verify-list #2), the answer may be "no measurable benefit, defer".

### Fork 2 — If yes, which delivery channel?

- (a) SubagentStart hook per-role branch (extends `inject-subagent-digest.sh` / `inject-subagent-context.sh`)
- (b) `.ai-factory/skill-context/<role>/SKILL.md` override (proven for sidecars; generalization unverified — verify-list #3)
- (c) Hybrid: keep uniform digest + add one-line per-role prime
- (d) Surgical doc-only: acknowledge tradeoff, no behavior change
- (e) Other

### Fork 3 — Absorb into `session-start-token-audit` as a stage, or run as separate umbrella?

The token-audit owns the budget vocabulary. Per-role-shaping may be a natural S4 stage. OR the token-audit's "never demote always-on" hard constraint (S2 descopes) may prevent per-role trimming by construction (verify-list #8).

### Fork 4 — Sequencing constraints

- Do NOT touch `inject-matching-rule.sh` surface until PR #1175 merges.
- Do NOT start per-role work until `session-start-token-audit` S2 lands (per-research; re-verify live — T3).

### Fork 5 — Vocabulary

External terms ("progressive disclosure" / "context isolation") vs repo-native terms ("path-relevant rule" / "additionalContext"). The plugin already uses "progressive disclosure" in `writing-skills/anthropic-best-practices.md` — but only as prose describing the host harness.

---

## What this patch is NOT

- **NOT a spec.** No design, no architecture, no implementation plan. Fabla writes that after Opus filters.
- **NOT a recommendation.** No "we should X", no ADOPT/BUILD/REJECT/DEFER verdict. Per `recommendation-laziness-discipline.md`, an unbacked verdict is provisional; GLM is not the session that backs one.
- **NOT a complete census.** Verify-list items 5-7 explicitly delegate re-grep + version-check to Opus. GLM's grep was thorough but not exhaustive (3 waves, 8 subagents — but a fresh cold-verify is the project's own discipline per `phase-research-coverage.md §1.7`).
- **NOT a decision on the operator's parallel work.** The session-start-token-audit umbrella and Seat A/B scratchpad reviews are operator-owned; this patch surfaces them as findings (R5), does not opine on their disposition.

---

## See also

- `.claude/orchestrator-prompts/session-start-token-audit/kickoff.md` (branch `claude/session-start-token-audit-77d224`) — the operator's parallel commission.
- `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scratchpad-d49985-*/REVIEW-REPORT.md` — Seat B's per-role-context review (REVISE).
- `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scratchpad-6225f3-*/REVIEW-REPORT.md` — Seat A's top-down review (GO).
- `.claude/rules/phase-research-coverage.md §1.7` — the cold-verify discipline this patch's verify-list follows.
- `.claude/rules/recommendation-laziness-discipline.md §3` — why this patch parks forks instead of picking.
- `.claude/rules/reviewer-discipline.md §2` — strategy-fork surfacing rule.
