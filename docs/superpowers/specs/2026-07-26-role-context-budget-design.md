# Design — Role-Based Context Budget (Progressive Disclosure per Role)

> **Status:** research / pre-codification (rev 2 — 2026-07-26, after wave 2 audit). This doc prepares material for a fabla / brainstorm on whether and how to codify "role-based context shaping" in this repo. It is **not** an implementation spec — no rule is proposed for adoption yet. Decision options are laid out in §6.
>
> **Author:** orchestrator session (delegated research: 8 subagent waves across 2 audits + DeepWiki + web)
> **Date:** 2026-07-26
> **Branch:** `feat/prune-worktrees` (local, HEAD `e76dcb0c05`)
> **Source repo:** superpowers = [`obra/superpowers`](https://github.com/obra/superpowers) v6.1.1

---

## 0. TL;DR (read this first)

The thesis: different agent roles (worker, planner, reviewer, brainstormer) need **different context payloads**, not the full project context. A worker only needs *WHERE + WHAT*; a planner needs *GOAL + ARCHITECTURE*; a reviewer needs *CRITERIA + DIFF*; a brainstormer needs *IDEA + CONSTRAINTS*. Dumping the full project context into every role causes **context pollution** and **lost-in-the-middle** degradation.

### Wave 2 changed the picture — three corrections to the wave-1 framing

1. **The user was *half-right* about superpowers — but not in the way hypothesized.** Wave 1 said "no per-role injection." Wave 2 confirmed: superpowers *does* ship a real injection hook (`hooks/session-start`, file `hooks/hooks.json:3-15`), and the dispatcher/wrapper skills *do* name roles. But: (a) the injection is **one flat `using-superpowers/SKILL.md` dump at SessionStart, identical for every session and every role** — not per-role; (b) the wrapper skills name roles but prescribe the **same context payload per role** (differentiation is by *question* + *model tier*, not by *context shape*). The substrate exists; the per-role axis does not.
2. **Progressive disclosure + injection are NOT a deliberate pair in superpowers.** They are two independent mechanisms that happen to coexist. Progressive disclosure is mentioned only as **prose describing the host harness's Skill-filesystem mechanism** (`writing-skills/anthropic-best-practices.md:235,1049,1099`) — superpowers relies on it but does not implement it. Injection is one flat bootstrap. No skill or hook cross-references the two as a designed pair.
3. **New design candidate surfaced: Option E (§6) — extend the SessionStart hook to be per-role.** Wave 1 missed this because we hadn't audited the `hooks/` directory of the plugin. The plumbing partially exists; the gap is purely in hook logic + content sourcing.

### What the full research found

1. **The principle is real and externally authoritative.** Anthropic, LangChain, and arXiv converge on it. The established term is **"progressive disclosure"** (Anthropic) / **"context isolation"** (LangChain's "Isolate" strategy). Anti-pattern names: **context pollution**, **context rot** (Anthropic official); **lost in the middle** (Liu et al., TACL 2024, 5300+ citations — the canonical mechanism-level citation).
2. **The repo already implements progressive disclosure for *paths* and *sessions*, but NOT for *roles*.** The path-scoped `inject-matching-rule.sh` (PostToolUse, once-per-session) is the existing mechanism. There is **zero** per-role branching in any hook today (verified by grep — see §3.6).
3. **SDD (superpowers:subagent-driven-development) has strong *categorical* discipline but zero *quantitative* discipline.** The brief-as-file / report-as-file / diff-as-file pattern keeps bulk out of the dispatch; the reviewer template has the strictest scope-limit ("don't crawl broader codebase" — `task-reviewer-prompt.md:38-50`). But: no token/char budget anywhere, no bound on the `## Context` slot, no enforcement script — the famous "42k-char dispatch of which 99% was pasted history" warning (`SKILL.md:189-193`) is **prose only**, no checker.
4. **Superpowers ships exactly ONE hook** — `SessionStart`, flat-injects the full `using-superpowers/SKILL.md` body, no per-role branching, no other hook events (no PreToolUse / PostToolUse / SubagentStart). See §3.7.
5. **The 3 wrapper skills (arch / pipeline / dispatcher) add verdict + routing disciplines on top of SDD — they do NOT add context-shaping.** All three consume SDD's templates as-is; none overrides `implementer-prompt.md` or `task-reviewer-prompt.md`. See §4.7.
6. **The principle is fragmented across 3 repo artifacts** (6-block input contract in `claude-glm-executor-handoff`; brief-as-file in SDD; one per-role trim rule in `phase-research-coverage.md:37`) but **not codified as a rule**, and **has no entry in the prior-art SSOT** (`docs/meta-factory/prior-art-evaluations.md` — negative-existence confirmed by 12-phrase grep).

**The decision in front of us** (laid out in §6): codify as a rule + templates (full), spike as a rule only, surgically extend one skill, **extend the superpowers SessionStart hook (new)**, or defer entirely.

---

## 1. The problem — why this matters

### 1.1 The user's framing (verbatim intent)

> "Для каждой сессии возможно нужен разный промт — для креативщика один, для планировщика другой, для ревьювера третий, а для имплементатора другой… воркеру не нужно знать цель идею и архитектуру проекта, а только конкретное место где надо сделать и что надо сделать."

Translation: each role gets a role-shaped prompt; workers must not receive project goal/architecture, only the concrete location and task.

### 1.2 Why this is a real problem (externally grounded)

- **Lost in the middle** (Liu et al., TACL 2024, [arXiv 2307.03172](https://arxiv.org/abs/2307.03172), 5300+ citations): U-shaped performance curve; 30%+ accuracy drop when relevant information sits in the middle of a long context. This is the **mechanism-level** reason full-context-to-worker underperforms.
- **Context pollution** + **context rot** (Anthropic, [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)): official terms for the failure mode. Practitioner threshold (anecdotal): "the model fumbles for 20k tokens and then that session heavily rotted."
- **Sub-agent context isolation** is a platform primitive: "Each subagent starts with a fresh, isolated context window… It doesn't see your conversation history" ([Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)).

### 1.3 Why this matters *for this repo specifically*

The repo's own invariant #4 — *"every rule fails at the earliest reachable channel (CI = last resort)"* — implies that if role-context pollution is a real failure mode, there should be a rule that fires when an agent is about to dispatch a worker with too much context. Today there is no such rule. The repo's recursive-self-application principle says: if we believe this, we should codify it as an executable artifact, not just a guideline.

---

## 2. External research — what the literature says

### 2.1 The canonical pattern: progressive disclosure (Anthropic's term)

[Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) is the single most load-bearing source. Key claims:

- Names the pattern: **"progressive disclosure"** — letting agents navigate and retrieve context autonomously, on-demand.
- Names the technique: **"compaction"** — summarizing a conversation nearing the context-window limit.
- Names the anti-patterns: **"context pollution"** + **"context rot"**.
- Sub-agent summary norm: workers return "1,000-2,000 tokens" of distilled summary, not full transcripts.
- Orchestrator/worker split: "The main agent coordinates with a high-level plan while subagents perform deep technical work."

### 2.2 The orchestrator/worker doctrine

[Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) (Jun 2025):

- **Per-role payload spec (the canonical 4-tuple):** "Each subagent needs (1) an objective, (2) an output format, (3) guidance on the tools and sources to use, and (4) clear task boundaries."
- **Artifact handoff beats chat-forwarding:** "Rather than requiring subagents to communicate everything through the lead agent, implement artifact systems where specialized agents can create outputs that persist independently."
- **Failure threshold:** "if the context window exceeds 200,000 tokens it will be truncated" — mitigation is to "spawn fresh subagents with clean contexts."

### 2.3 The strategy vocabulary (LangChain)

[LangChain — Context Engineering for Agents](https://www.langchain.com/blog/context-engineering-for-agents) names four formal strategies: **Write, Select, Isolate, Compress**. Our thesis maps to **Isolate** ("splitting context up to help an agent perform a task" via multi-agent separation of concerns) + **Compress** ("retaining only the tokens required to perform a task").

### 2.4 The closest academic match

[Context Engineering for Multi-Agent LLM Code Assistants](https://arxiv.org/html/2508.08322v1) (arXiv 2508.08322, 2025) is the only paper found that prescribes explicit per-role context payloads in a Claude-Code-based orchestrator-worker system:

- **Orchestrator/planner gets more:** "The orchestrator first invokes the Planner agent… with the structured task specification and the knowledge summary."
- **Workers get targeted slices:** "Each agent is given: (a) the relevant excerpt of the plan… (b) any code snippets retrieved that pertain to that step… and (c) its specific instructions."
- **Isolation:** "Each subagent operates with an isolated context window… does not see the entire dialogue history or unrelated data."
- Quantified (caveat: not isolated as a variable): multi-agent 80% single-shot success vs 40% single-agent baseline, at 3-5× token cost.

### 2.5 Prior art on role-specialized artifact handoff

[MetaGPT](https://arxiv.org/html/2308.00352v6) (arXiv 2308.00352) — the "assembly-line" role-specialization paper. Roles (PM, architect, engineer, QA) each operate on structured per-role artifacts (user stories → design docs → APIs → tests) rather than raw shared context. Frames the boundary as artifact handoff rather than context trimming.

### 2.6 Fresh / weak sources (cite with caveat)

- [arXiv 2607.17598](https://arxiv.org/abs/2607.17598) — "Is Progressive Disclosure All You Need for Long-Context Agents?" — submitted 6 days ago, un-peer-reviewed. Claim: progressive disclosure "buys context, not intelligence"; "a second routing level never helps and sometimes breaks accuracy." **Cite only as "recent preprint."**
- **Gap:** no primary OpenAI Codex / Cognition Devin / Aider publication found on per-role context shaping. Cursor coverage is community/forum only. Cross-vendor consensus is Anthropic + LangChain + academic, not cross-vendor.

### 2.7 Terminology verdict

| Caller's term | Established term? |
|---|---|
| "Progressive discovery" | **No** — appears to be the caller's own label. |
| "Role-based context shaping" | **No** — not an established phrase. |
| "Progressive disclosure" | **Yes** (Anthropic's term, widely adopted). |
| "Context isolation" | **Yes** (LangChain's "Isolate" strategy). |
| Anti-pattern "context pollution" / "context rot" | **Yes** (Anthropic official). |
| Mechanism citation "lost in the middle" | **Yes** (Liu et al., TACL 2024 — canonical). |

**Recommendation:** any codified rule should use **"progressive disclosure"** + **"context isolation (sub-agent partitioning)"** as the canonical vocabulary, not "progressive discovery."

---

## 3. Internal research — how it works in this repo today

### 3.1 The existing progressive-disclosure mechanism: `inject-matching-rule.sh`

File: `.claude/hooks/inject-matching-rule.sh`. This IS the repo's existing implementation of progressive disclosure (load-on-demand rule reminders, not always-on).

| Aspect | Implementation | Citation |
|---|---|---|
| Trigger | PostToolUse, gated to `Edit\|Write\|MultiEdit` | `inject-matching-rule.sh:39` |
| Matcher wiring | `.claude/settings.json:118-125` (matcher `Edit\|Write\|MultiEdit`) | settings.json:119 |
| Path-scope | HTML-comment `<!-- globs: ... -->` marker in each rule, hand-rolled 3-pattern matcher (prefix/**, *.ext, exact) | `inject-matching-rule.sh:50-57, 64-66` |
| Once-per-session dedup | Tmpfile cache keyed by `session_id`, stores rule slugs | `inject-matching-rule.sh:46-47, 78, 84` |
| Injected payload | `📎 Path-relevant rule — <one-line summary> (see .claude/rules/<slug>.md)` — a pointer, not the rule body | `inject-matching-rule.sh:80-83` |
| Output contract | JSON `hookSpecificOutput.additionalContext` (PostToolUse; plain stdout is ignored) | `inject-matching-rule.sh:89-90` |
| Gate semantics | **Non-blocking** — always `exit 0`; this is a reminder, not an enforcement point | `inject-matching-rule.sh:14, 41, 87, 91` |

**Three takeaways:**

1. The mechanism is **path-scoped and session-scoped**, but **never role-scoped**. Its only inputs are `tool_name`, `file_path`, `session_id` (`inject-matching-rule.sh:35-37`).
2. It injects a **pointer + one-line summary**, never the full rule. Progressive disclosure = "here's a reminder that this rule exists, go read it if relevant."
3. The 3-pattern glob matcher is deliberately simple (no glob engine) — adding a role dimension would not require a more complex matcher, just a new input field.

### 3.2 The dual-pair delivery model

Each rule ships up to **four artifacts across two channels**:

| Artifact | Channel | Consumer | Parsed by |
|---|---|---|---|
| frontmatter `paths:` | CC-native **read-time**, whole-rule | CC harness auto-loads the whole `.md` when an edited path matches | the CC harness |
| `<!-- globs: -->` | **edit-time**, portable marker | This repo's `inject-matching-rule.sh` | inject-matching-rule.sh:64 |
| `<!-- inject: -->` | edit-time summary | Delivered as `additionalContext` | inject-matching-rule.sh:80 |
| `Class:`/`Fires:`/`Authoritative for:` blockquote | human/SSOT metadata | AGENTS.md rule-index, principle test 09 | `scripts/render-rule-index.mjs` |

A new role-context rule would need to fit this dual-pair model: a CC-native read-time channel + a portable edit-time channel.

### 3.3 The SubagentStart hooks (3 of them — CC/ZCode parity split)

| Hook | Event | Fires on | Payload shape | Per-role? |
|---|---|---|---|---|
| `inject-subagent-digest.sh` | SubagentStart (CC-only) | every subagent | same digest for all | **no** |
| `inject-project-digest.sh` | UserPromptSubmit + SubagentStart | every subagent | same digest for all | **no** |
| `inject-subagent-context.sh` | PreToolUse:Agent\|Task (ZCode fallback) | every dispatched subagent | augments `tool_input.prompt` via `updatedInput` | **no** — preserves `subagent_type` (line 62 comment) but does **not** branch on it |

**Key finding:** `inject-subagent-context.sh` already has `tool_input.subagent_type` on its stdin (it preserves it) — the plumbing for per-role branching **partially exists**. The CC `SubagentStart` event payload similarly carries the subagent's type/definition. The gap is purely in the **hook logic** (no role branch) and **content sourcing** (one global digest, not partitioned by role).

### 3.4 The 6-block input contract — closest existing per-role-shape artifact

`.zcode/skills/claude-glm-executor-handoff/SKILL.md:52-71`. The 6 blocks: `<task>` / `<context>` / `<constraints>` / `<tools>` / `<output>` / `<verify>`. The load-bearing trim rules:

- **Line 56:** `"<context> — only what THIS step needs — summarized, not raw-forwarded"`
- **Line 64:** `"Atomicity > detail. A weaker-reasoning executor optimizes one goal; multi-goal prompts drift silently."`
- **Line 65:** `"Never forward raw conversation. Summarize what's load-bearing for THIS step. GLM treats pasted chat artifacts as ambiguous instruction content, not inert background."`
- **Line 71:** `"This contract is not GLM-specific in shape — it applies to any weaker-reasoning executor-handoff."` — the author flags it as a candidate for promotion to a general discipline, but it has **not** been promoted (still lives only in the GLM-edge skill).

### 3.5 The one existing per-role trim rule

`.claude/rules/phase-research-coverage.md:37` — for the backward-sweep-auditor role: *"delegate the enumeration to the cold `agents/backward-sweep-auditor.md` sub-agent: hand it ONLY the change's class (never the diff/PR), so it enumerates siblings without being able to restate the PR it never saw."* This is a genuine per-role context-trim rule, but scoped to **one** specific auditor role, not generalized.

### 3.6 What does NOT exist today

Verified by grep across `.claude/hooks/`, `.claude/rules/`, `.zcode/skills/`:

- **No per-role injection.** No hook reads `subagent_type`/role and selects different injected text by role (see §3.3).
- **No rule named "role-context-budget"** or any synonym (`context-minim`, `role-based context`, `worker only needs`, `trim context`, `context pollution`, `context hygiene` — 12-phrase grep, zero matches in `.claude/rules/`).
- **No SSOT prior-art entry** for this principle (`docs/meta-factory/prior-art-evaluations.md` — 12-phrase grep, zero matches).
- **No quantitative budget** anywhere in SDD (no token/char counter, no per-slot ceiling, no enforcement script — the 42k-char warning is prose only).
- **No planner-role dispatch discipline** in SDD (planning is inline, `writing-plans/SKILL.md:10-12, 144-154`).

### 3.7 What superpowers (the plugin) itself ships — wave 2 finding

Source: [`obra/superpowers`](https://github.com/obra/superpowers) v6.1.1, cached at `/Users/art/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.1.1/`. This corrects a wave-1盲点: the plugin's own `hooks/` directory was not audited. Wave 2 audited it.

**The plugin ships exactly ONE hook — a SessionStart injector.** Files: `hooks/hooks.json:3-15` (Claude Code registration), `hooks/session-start` (the bash injector), `hooks/run-hook.cmd` (cross-platform polyglot wrapper). Plus a Cursor variant `hooks-cursor.json`.

| Aspect | Implementation | Citation |
|---|---|---|
| Event | `SessionStart` only (matcher `startup\|clear\|compact`) | `hooks/hooks.json:3-15` |
| What it injects | The full body of `using-superpowers/SKILL.md` (62 lines), wrapped in `<EXTREMELY_IMPORTANT>` tags | `hooks/session-start:11, 27` |
| Output shape | Platform-branched: `additional_context` (Cursor), `hookSpecificOutput.additionalContext` (Claude Code), top-level `additionalContext` (Copilot CLI/SDK) | `hooks/session-start:38-47` |
| Per-role? | **NO** — identical payload for every session | (no branching logic in `hooks/session-start`) |
| Other hook events | **NONE** — no PreToolUse, no PostToolUse, no SubagentStart, no UserPromptSubmit, no Stop | exhaustive grep of `hooks/` and `skills/` |

**Three implications:**

1. **The plugin's entire context-injection surface is one flat SessionStart dump.** It does not inject per-role, per-path, per-event, or on-demand. After SessionStart, the plugin does zero context injection — all subsequent context shaping is done by the coordinator (main agent) manually constructing dispatch prompts per the SDD templates.
2. **Progressive disclosure in superpowers is prose about the host harness, not a mechanism the plugin implements.** Every mention of "progressive disclosure" lives in `writing-skills/anthropic-best-practices.md:235, 408, 1049, 1099, 1115` — and it describes Anthropic's Skill-filesystem mechanism (the host loads `SKILL.md` + bundled reference files on demand via the Skill tool), not anything superpowers ships. Zero hits for "progressive discovery" or "context isolation" as terms.
3. **The two are NOT a deliberate pair.** No skill or hook in the plugin cross-references injection + progressive disclosure as a designed pair. They are coincidental: one flat bootstrap inject (plugin-shipped) + one inherited host capability (filesystem-Skill loading). The wave-1 framing "the repo implements progressive disclosure via `inject-matching-rule.sh`" was about *this repo's* hooks, not the plugin's — and this repo's hooks (§3.1) are strictly more sophisticated than the plugin's single SessionStart dump.

**Falsifier for "the pair is deliberate in superpowers":** would require (a) any skill or hook cross-referencing the two as a designed pair, (b) the SessionStart hook emitting a per-role digest rather than one flat document, or (c) a `PreToolUse`/`UserPromptSubmit`/`SubagentStart` hook existing that loaded skill content on demand. **All three FALSIFIED** in 6.1.1. The only non-SessionStart hook events appear in a future-design spec (`docs/superpowers/specs/2026-04-06-worktree-rototill-design.md:31, 341`) as unimplemented Phase-4 work.

---

## 4. SDD audit — what superpowers gives us for free

### 4.1 The "isolated context, construct exactly what they need" line (role-agnostic)

The identical sentence appears in three skills — SDD's canonical context-shaping statement:

- `subagent-driven-development/SKILL.md:10`
- `dispatching-parallel-agents/SKILL.md:10`
- `requesting-code-review/SKILL.md:8`

> "You delegate tasks to specialized agents with isolated context. By precisely crafting their instructions and context, you ensure they stay focused and succeed at their task. **They should never inherit your session's context or history — you construct exactly what they need.**"

This is a *negative* discipline (don't forward history) + a *positive* obligation (construct what they need) — but it is **role-agnostic**. It does not differentiate worker vs reviewer vs planner.

### 4.2 Worker dispatch template (`implementer-prompt.md`)

Structure (10 sections): `description`, `## Task Description` (points at brief), `## Context` (the scene-setting slot), `## Before You Begin`, `## Your Job`, `## Code Organization`, `## When You're in Over Your Head`, `## Before Reporting Back: Self-Review`, `## After Review Findings`, `## Report Format`.

**What the dispatcher is told to INCLUDE** (`SKILL.md:225-235`, "File Handoffs"):

1. one line on where this task fits in the project;
2. the brief path, introduced as "read this first — it is your requirements, with the exact values to use verbatim";
3. interfaces and decisions from earlier tasks that the brief cannot know;
4. the dispatcher's resolution of any ambiguity spotted in the brief;
5. the report-file path and report contract.

**What it is told to OMIT:**

- The whole plan file — `SKILL.md:374-376` ("Make a subagent read the whole plan file … hand it its task brief instead").
- Accumulated prior-task summaries — `SKILL.md:189-193` ("do not paste accumulated prior-task summaries ('state after Tasks 1-3') into later dispatches — a real session's dispatch hit 42k chars of which 99% was pasted history").

**Critical gap — the `## Context` slot is unbounded.** `implementer-prompt.md:18-20` reserves the slot:

```markdown
## Context

[Scene-setting: where this fits, dependencies, architectural context]
```

The SKILL recipe (`:225-235`) lists *what* the slot should contain but gives **no length cap**. A grep across all three skills for `token|char count|42k|hard limit|budget|word count|paragraph|max (tokens|chars|lines|words)` returns only two prose hits — `SKILL.md:119` (cost guidance) and `SKILL.md:191` (the 42k anecdote). **The shape is "what to include," not "how much."**

### 4.3 Reviewer dispatch template (`task-reviewer-prompt.md`) — the strictest discipline in SDD

Structure (12 sections). The scope-limiting instruction (`task-reviewer-prompt.md:38-50`) is a **genuine per-role context trim**, not just a focus instruction:

> "Read the diff file once — it contains the commit list, a stat summary, and the full diff with surrounding context, and it is your view of the change. The diff's context lines ARE the changed files: do not Read a changed file separately unless a hunk you must judge is cut off mid-function — and say so in your report. Do not re-run git commands. […] **Do not crawl the broader codebase. Inspect code outside the diff only to evaluate a concrete risk you can name — one focused check per named risk**, and name both the risk and what you checked in your report."

This is an **input-channel allowlist** (diff file + brief + report) + a **named-risk exception** (out-of-diff Reads allowed only for a named risk, one focused check per risk, risk+check both reported). Reinforced at `:67-73` (don't re-run the suite), `:52-53` (read-only). The dispatcher side adds a *content* trim: `SKILL.md:174-180` says the Global Constraints block is the reviewer's "attention lens" — verbatim binding values only, not process rules.

**But:** no size budget on the named-risk checks — "one focused check per named risk" is a count limit, not a token limit.

### 4.4 Planner role — NOT shaped by SDD

Planning is done by the main agent (or human), not dispatched. Evidence:

- `writing-plans/SKILL.md:10-12` — "Write comprehensive implementation plans assuming the engineer has zero context" (planning is an artifact authored in the main session).
- `writing-plans/SKILL.md:144-154` — "This is a checklist you run yourself — **not a subagent dispatch**." Even plan QA is inline.
- The one plan-reviewer template (`writing-plans/plan-document-reviewer-prompt.md`) is **orphaned** — the skill never references or invokes it. It has zero context-shaping guidance.

**Conclusion:** SDD prescribes rich context shape for implementer + task-reviewer, but **not for planner**. A role-budget rule would cover planner from scratch.

### 4.5 The brief-as-file mechanism (`scripts/task-brief`)

A bash extractor that pulls one task's full text out of the plan into a uniquely named file (default `<repo-root>/.superpowers/sdd/task-<N>-brief.md`), so "the task text never has to be pasted through the controller's context."

- **Brief file holds:** the task's full text — exact values, magic strings, signatures, test cases, acceptance criteria. The brief is the SSOT for requirements.
- **Dispatch prompt holds:** (1) one line on fit; (2) brief path; (3) interfaces/decisions from earlier tasks; (4) ambiguity resolutions; (5) report-file path + contract.

The reviewer gets the **same brief file** + the report file + the diff-package file + the verbatim Global Constraints block — three paths + one pasted block.

### 4.6 SDD verdict — what we get for free vs what we'd add

**For free:**

- Strong *categorical* context discipline: brief/report/diff-as-file pattern keeps bulk out of the dispatch.
- The reviewer template's input-channel allowlist + named-risk exception (`task-reviewer-prompt.md:38-50`).
- The implementer template omits the plan and prior-task history (`SKILL.md:189-193, 374-376`).
- Repeated warnings that "everything you paste … stays resident … and is re-read on every later turn" (`SKILL.md:222-223`).

**We'd need to add** (everything quantitative + everything enforceable + the planner role):

1. Per-role token/char budgets (none exist).
2. A planner-role budget (planning is inline and unshaped).
3. A bound on the unbounded `## Context` slot.
4. A token counter / checker script (the existing scripts only `echo` byte counts of artifact files, never measure or gate the dispatch prompt itself — `task-brief:40`, `review-package:44`).
5. A verbatim-vs-narrated budget split.
6. Per-diff-size scaling for the reviewer (SDD scales the *model* to the diff but never the *context budget* — `SKILL.md:111-113, 126-130`).

SDD solves the **composition** problem (what goes in a dispatch) but not the **size** problem (how much) and not the **enforcement** problem (what fails when you blow the budget). The repo's own invariant ("every rule fails at earliest reachable channel") has no SDD-side implementation for context size.
### 4.7 Wrapper skills (arch / pipeline / dispatcher) — wave 2 finding

The repo ships three wrapper skills on top of SDD: `.claude/skills/{arch,pipeline,dispatcher}/SKILL.md` (byte-identical to `.zcode/skills/*` siblings — `diff -q` empty for all three). The user's hypothesis: these wrappers may already implement progressive-disclosure + injection per role. **Wave-2 audit: they do not.**

| Skill | Names roles? | Per-role context payload? | Adds context-shaping on top of SDD? |
|---|---|---|---|
| `arch` | Partially — names a two-altitude reviewer ladder (top-down / bottom-up, `arch:44-45`); ideation delegated to `superpowers:brainstorming` (`arch:38`) | **NO** — both reviewer seats get the **same payload** ("artifact paths only, never chat context", `arch:42`). Differentiation is by *question* + *model tier* (`arch:47`), not by *context shape*. | **NO** — adds cold two-altitude design review + exit routing; does not touch SDD templates. |
| `pipeline` | YES, most explicit — three SDD sub-wave roles ("Implementer session", "Spec-reviewer session", "Code-quality-reviewer session", `pipeline:319-321`); Phase -1 reviewer (`pipeline:392-398`) | **NO** — all three roles read the **same kickoff**. `pipeline:319-321` prescribe role *purpose* but not role *context payload*. | **NO** — `pipeline:322, 323, 424` defer to SDD's vocabulary + dispatch template AS-IS; adds verdict-grammar + routing, not context-shaping. |
| `dispatcher` | NO — names *question types* (technical / strategic / environment, `dispatcher §3 lines 244-260`) and *park mechanisms*, not roles | N/A | **NO** — defers cold-review to `superpowers:requesting-code-review` (`dispatcher:56, 210`) and technical forks to `superpowers:brainstorming` (`dispatcher:56, 268`); dispatches via REST-to-aif (`tsx packages/runtime-bridge/src/cli/dispatch.ts`, `dispatcher:85-87`), not Agent-tool. |

**Per-role content EXISTS in `agents/*.md` prompt files** — but is loaded by the agent **reading its own kickoff at runtime**, not injected by a hook per role:

- `agents/fidelity-auditor.md:32` — "Inputs (paths/text only — never chat context, never implementation logs)"
- `agents/orchestrator-worker-discipline.md:23-24` — "The full operator-side orchestrator workflow does NOT travel into the container — only this condensed portable subset does."

These are role-specific *documentation*, delivered by the agent reading its own kickoff — not progressive-disclosure *injection* per role.

**SDD templates are NOT in this repo** — confirmed by `find ... -name "implementer*" -o -name "*reviewer-prompt*"`. They live only in the superpowers plugin (`skills/subagent-driven-development/`). The wrappers do not override them.

**Pipeline line 528** explicitly flags a future extension: "activates when inject-matching-rule.sh is extended to scan `.claude/skills/*/SKILL.md` (today scans `.claude/rules/` only)" — confirming the repo's own progressive-disclosure scanner does **not yet cover** the wrapper skills themselves.

**§4.7 verdict — does the user's optimism about the wrappers hold?**

- **Role names: YES.** Pipeline §5 enumerates them; arch §2 enumerates two reviewer seats.
- **Per-role context payloads: NO.** Differentiation is by *question*, *purpose*, *model tier* — never by *context payload*.
- **Falsifier (3 conditions, all must hold for optimism to be warranted):**
  1. **(FALSIFIED)** At least one wrapper contains a per-role context table or allow/deny list. Grep returns only purpose/job descriptions, never context-payload specs.
  2. **(FALSIFIED)** A hook with a matcher keyed to role (`subagent_type:reviewer` or similar). `.claude/settings.json:90-97` matcher is `Agent|Task` (tool-name only); `:183-192` SubagentStart has no matcher.
  3. **(FALSIFIED)** `inject-subagent-digest.sh` (or sibling) branches on `subagent_type`. `.claude/hooks/inject-subagent-digest.sh:22-26` emits a single `DIGEST` variable with no branching.

**Bottom line:** the wrappers add verdict + routing disciplines on top of SDD; they do **not** add context-shaping. The user's optimism is **not warranted** for the wrappers — the substrate (hook events fire, payloads emit) exists, but the per-role axis is absent from both the hooks and the wrapper skills.

---

## 5. Synthesis — review of current state

### 5.1 What works today

| Practice | Where | Strength |
|---|---|---|
| Path-scoped progressive disclosure | `inject-matching-rule.sh` (this repo) | Solid, deterministic, once-per-session, portable across harnesses (globs marker). 15/26 rules wired. |
| Brief-as-file / report-as-file / diff-as-file | SDD `scripts/task-brief`, `scripts/review-package` | Keeps bulk artifacts out of dispatch prompts and out of controller context. |
| Reviewer input-channel allowlist | `task-reviewer-prompt.md:38-50` | The strictest per-role trim in the system. |
| 6-block input contract | `claude-glm-executor-handoff/SKILL.md:52-71` | Explicit "never forward raw conversation" + atomicity rule. Author flagged it for promotion. |
| One per-role trim rule | `phase-research-coverage.md:37` | Proves the pattern can be codified as a repo rule. |
| Self-contained kickoffs | `.claude/orchestrator-prompts/**` | Each kickoff tells the worker "you inherit NO memory, this kickoff is self-contained." |
| SessionStart flat-inject (the plugin) | `superpowers/hooks/session-start` | Real but flat — dumps `using-superpowers/SKILL.md` to every session; **identical for every role**. |

### 5.2 What is fragmented

- The "never forward raw conversation" rule lives in **one GLM-edge skill** (`claude-glm-executor-handoff:65`), not in a repo-wide rule.
- The 6-block contract is **flagged for promotion** (`:71`) but never promoted.
- The "42k-char dispatch" warning is **prose only** in SDD — no checker.
- Reviewer scope-limiting is **baked into one template**, not a principle.
- The backward-sweep-auditor trim is **one role**, not a generalized doctrine.
- **Wave 2:** injection exists on **two layers that don't talk to each other** — (a) the plugin's flat SessionStart hook (`superpowers/hooks/session-start`), (b) the repo's path/session injectors (`inject-matching-rule.sh`, `inject-subagent-digest.sh`). Neither is per-role; neither references the other.

### 5.3 What is absent

- **No per-role injection.** No hook — neither in the plugin (single SessionStart flat inject, §3.7) nor in the repo (path/session injectors, §3.1-§3.3) — branches on `subagent_type`/role.
- **No per-role context payload in any wrapper skill** (arch/pipeline/dispatcher name roles but prescribe the same context shape — §4.7).
- No quantitative context budget (token/char) anywhere.
- No enforcement mechanism for context size (no script measures the dispatch prompt).
- No planner-role dispatch discipline.
- No SSOT prior-art entry for the principle.
- No canonical vocabulary in the repo ("progressive disclosure" / "context isolation" are not used in any rule — only in `writing-skills/anthropic-best-practices.md` of the plugin, where it describes the host harness).

### 5.4 The honest falsifier — is the principle "already implemented, just not named"?

**Three falsifiers, all considered:**

1. **Structural-encoding falsifier** (wave 1): SDD templates *do* encode different input shapes per role via `[BRIEF_FILE]` vs `[DIFF_FILE]` placeholders — one could argue the principle is implicit. **Counter:** absence of (a) any quantitative bound, (b) any planner coverage, and (c) any enforcement script means the structural encoding is incomplete.
2. **Plugin-hook falsifier** (wave 2, new): the plugin ships `hooks/session-start` — one could argue "injection per role exists, just needs a branch." **Counter:** the hook has no branching logic, no per-role content sourcing, and no other hook events. The plumbing partially exists; the per-role axis does not.
3. **Wrapper-skill falsifier** (wave 2, new): arch/pipeline/dispatcher name roles — one could argue "roles are already shaped." **Counter:** differentiation is by *question* + *purpose* + *model tier*, never by *context payload*. All three wrappers consume SDD's templates as-is.

**Verdict across all three:** the named principle + the per-role enforcement are **both genuinely absent**. The substrate (hook events fire, payloads emit, templates exist) is real; the per-role axis is absent on every layer (plugin hook, repo hook, wrapper skill, SDD template).

### 5.5 The "deliberate pair" question — answered

The user's framing implied progressive disclosure + injection are (or should be) a **deliberate pair**. Wave 2 confirms: they are **NOT** a deliberate pair in either superpowers or this repo.

| Layer | Progressive disclosure | Injection | Pair deliberate? |
|---|---|---|---|
| superpowers plugin | Prose only — describes host harness's Skill-filesystem mechanism (`anthropic-best-practices.md:235, 1049`) | One flat SessionStart dump (`hooks/session-start`) | **NO** — never cross-referenced |
| this repo | Path-gated rule summaries (`inject-matching-rule.sh`) | Path-gated + session-gated injectors + SubagentStart digest | **Partially** — `inject-matching-rule.sh` is itself both the disclosure and the injection (the summary IS the injected content), but it's path-gated, not role-gated |
| wrapper skills | None prescribed | None prescribed | N/A |
| SDD | File-handoff pattern (brief/report/diff as files) | None — coordinator constructs prompts manually | **NO** — file-handoff is disclosure-by-artifact; no injection |

**This is the gap a codification would close:** make the pair *deliberate* and add the *per-role axis*.

---

## 6. Design options for the fabla

Four options, ordered by scope. Each is a *candidate shape* — none is recommended yet; the fabla picks.

### Option A — Full codification (rule + templates + agent extension)

**Shape:**

- New rule: `.claude/rules/role-context-budget.md` (Class A, paths: `.claude/orchestrator-prompts/**, agents/**, .zcode/skills/**`).
- SSOT prior-art entry: `docs/meta-factory/prior-art-evaluations.md` row #N (cites Anthropic + LangChain + Liu et al.).
- Firing test: `scripts/role-context-budget.test.sh` (a paired-negative test, per repo convention).
- Inject hook extension: extend `inject-matching-rule.sh` (or add a sibling) to fire on kickoff/dispatch authoring paths.
- Four templates: `.claude/orchestrator-prompts/templates/{worker,planner,reviewer,brainstorm}.md` with pre-baked section structures.
- Agent extension: extend `agents/orchestrator-worker-discipline.md` with input-shape per role (today it defines only output schema).

**Pros:**

- Aligns with repo invariant #4 ("every rule fails at earliest reachable channel") — full enforcement surface.
- Recursive-self-application green: the framework validates itself with its own logic.
- Generalizes the fragmented artifacts into one principle.

**Cons:**

- ~2× the work of a spike.
- Risk: if the principle's formulation is wrong, templates get redone too.
- Adds always-on context cost (the rule itself) unless carefully scoped.

**Estimated effort:** 1 medium wave (3-4 sub-tasks).

### Option B — Spike: rule only (validate the principle first)

**Shape:**

- New rule: `.claude/rules/role-context-budget.md` (Class A, narrow paths).
- SSOT prior-art entry.
- Firing test.
- Inject hook extension.
- **No templates. No agent extension.**

**Pros:**

- Validates that the principle is catchable and doesn't break existing kickoffs before investing in templates.
- Smaller risk surface.
- Matches the repo's "spike → validate → expand" cadence (cf. night-mode/SDD model).

**Cons:**

- Leaves the "what exactly goes in a worker kickoff" question subjective.
- Doesn't deliver the visible artifact (templates) that operators can immediately use.
- The rule without templates may be too abstract to fire meaningfully.

**Estimated effort:** 1 small wave (2 sub-tasks).

### Option C — Surgical: extend one skill, no new rule

**Shape:**

- Generalize the 6-block input contract: promote it from `claude-glm-executor-handoff/SKILL.md` into a shared `role-context-slice` reference, and add an explicit per-role context table.
- Optionally extend `night-mode/SKILL.md`'s advisor slice discipline.
- **No new rule. No SSOT entry. No firing test.**

**Pros:**

- Lowest disruption.
- Tests the principle's wording in one place before committing repo-wide.
- The 6-block contract is already flagged for promotion (`claude-glm-executor-handoff:71`).

**Cons:**

- Violates repo invariant #4 (no enforcement channel — pure documentation).
- "Documents lie; tests don't" — the repo's own thesis. A doc-only change is the weakest channel.
- Doesn't address the planner-role gap or the enforcement gap.

**Estimated effort:** 1 small task.

### Option D — Defer codification; document the gap only

**Shape:**

- This design doc is the deliverable. No code/rule changes.
- Add a "known gap" note to `docs/meta-factory/EXECUTION-PLAN.md` or a deferred-ideas log.
- Revisit when a concrete failure (a worker that drifted because of context pollution) provides the forcing function.

**Pros:**

- Zero risk.
- Honest about the absence of a forcing function.
- The research is preserved for when it's needed.

**Cons:**

- The gap remains. The next context-pollution incident has no codified defense.
- The research decays (links rot, the arXiv preprint's caveats get forgotten).

**Estimated effort:** 0 (this doc is the work).

### Option E — Extend the SessionStart/SubagentStart hook to be per-role (wave 2 new)

This option surfaced from the wave-2 audit of the plugin's `hooks/session-start` (§3.7) and the repo's `inject-subagent-context.sh:62` which already *preserves* `subagent_type` (§3.3). The plumbing partially exists; the gap is purely in hook logic + content sourcing.

**Shape:**

- Extend `inject-subagent-digest.sh` (CC SubagentStart) and/or `inject-subagent-context.sh` (ZCode PreToolUse:Agent fallback) to **read `subagent_type` / `description` from the hook input** and emit a **role-specific digest**.
- Add per-role digest blocks (e.g. `<!-- digest:worker:start -->` / `<!-- digest:reviewer:start -->` markers in `.claude/session-bootstrap.md`, or per-role files in `.claude/session-bootstrap/<role>.md`).
- Apply the same once-per-session dedup pattern `inject-matching-rule.sh:46-47, 78` already uses — keyed by `(session_id, role)` rather than `(session_id, rule-slug)`.
- No new rule file, no new templates. The hook IS the enforcement.

**Pros:**

- **Lowest-friction enforcement.** The hook is a hard channel — every dispatched subagent automatically gets the right role-shaped digest without any coordinator discipline required.
- **Recursive-self-application green.** The repo already has `inject-matching-rule.sh` as the canonical progressive-disclosure injector; extending its sibling to be role-aware is the same pattern.
- **Addresses the "deliberate pair" gap directly** (§5.5) — makes progressive disclosure + injection a designed pair *for the role axis*.
- Plumbing partially exists: `inject-subagent-context.sh:62` already preserves `subagent_type`.

**Cons:**

- **Requires content sourcing discipline** — someone has to write and maintain the per-role digest blocks (what does a worker need? a reviewer? a planner?). This is the same problem as Option A's templates, just delivered through a different channel.
- **Hook-only is invisible to operators.** Unlike templates (Option A), a hook doesn't show operators what good per-role context looks like — they can't learn by example.
- **Risk of digest bloat** — if per-role blocks are not tightly bounded, the SubagentStart payload could grow unbounded (the same "42k-char" failure mode SDD warns about, just moved to injection time).
- **Doesn't help the manual-dispatch path** (arch, pipeline) — those dispatch via Agent tool with hand-written prompts; the SubagentStart hook fires *after* dispatch, so it can augment but cannot trim what the coordinator already pasted.

**Estimated effort:** 1 small-medium wave (1 hook extension + 1 content file + 1 firing test).

### 6.x Comparison matrix

| Option | New rule? | Templates? | Hook enforcement? | SSOT entry? | Effort | Risk | Aligns with invariant #4? |
|---|---|---|---|---|---|---|---|
| A — Full | ✓ | ✓ (4) | ✓ (inject + test) | ✓ | medium | medium (formulation risk) | ✓ fully |
| B — Spike | ✓ | ✗ | ✓ (inject + test) | ✓ | small | low | ✓ partially (no templates) |
| C — Surgical | ✗ | ✗ | ✗ (doc only) | ✗ | tiny | low | ✗ violates |
| D — Defer | ✗ | ✗ | ✗ | ✗ | zero | zero | ✗ violates |
| **E — Hook-per-role (new)** | ✗ | ✗ (digest blocks instead) | ✓ (hook IS enforcement) | optional | small-medium | medium (content + bloat) | ✓ via hook channel |

---

## 7. Open questions for the fabla

These are the genuine forks that need a human decision before any implementation:

1. **Is there a forcing function?** Has a worker actually drifted because it received full project context? Or is this preventive? (If preventive, Option D may be honest; if there's an incident, Option A/B/E is justified.)
2. **Quantitative or categorical?** Should the rule prescribe token/char budgets (e.g. "worker dispatch ≤ 2k tokens of narrated context"), or only categorical allow/deny lists ("worker gets WHERE+WHAT, not GOAL+ARCH")? SDD's entire discipline is categorical; the literature gives no canonical numbers.
3. **Planner role — in scope?** SDD treats planning as inline (human/main-agent). Should this rule be the first to prescribe a planner dispatch discipline, or should it stay scoped to worker + reviewer (where SDD already has templates)?
4. **Enforcement channel — inject (Option E), rule (Option A/B), or doc (Option C)?** Wave 2 made this a real three-way fork. The hook channel (E) is the earliest reachable channel (SubagentStart fires before the subagent's first turn); the rule channel (A/B) is path-gated at edit time; the doc channel (C) has no enforcement. The repo's "CI = last resort" invariant favors E > A/B > C, but E requires content sourcing that A/B's templates also need.
5. **Vocabulary — adopt "progressive disclosure" externally, or coin a repo term?** External sources use "progressive disclosure" / "context isolation." The repo's existing vocabulary is "path-relevant rule" / "additionalContext." Should the rule use the external term (for cross-project recognition) or a repo-native term? Wave 2 note: the plugin already uses "progressive disclosure" in `writing-skills/anthropic-best-practices.md` — but only as prose describing the host harness.
6. **Is the "deliberate pair" framing load-bearing?** Wave 2 found progressive disclosure + injection are NOT a deliberate pair in either superpowers or this repo (§5.5). Is making them a deliberate pair a goal in itself, or is per-role shaping enough (regardless of whether it's delivered via disclosure, injection, or both)?

---

## 8. Citations (grounding for any future rule)

### Primary external

1. **[Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)** — primary authority; names progressive disclosure, compaction, context pollution, context rot; "1,000-2,000 token" summary norm.
2. **[Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)** — orchestrator/worker doctrine; the canonical 4-tuple payload spec (objective, output format, tools/sources, task boundaries).
3. **[Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)** — platform-level guarantee of isolated per-subagent context windows.
4. **[LangChain — Context Engineering for Agents](https://www.langchain.com/blog/context-engineering-for-agents)** — names the "Isolate" strategy (and Write/Select/Compress) as the formal context-engineering vocabulary.
5. **[Liu et al., "Lost in the Middle," TACL 2024](https://aclanthology.org/2024.tacl-1.9/)** / [arXiv 2307.03172](https://arxiv.org/abs/2307.03172) — the canonical academic citation for *why* full-context-to-worker underperforms (5,300+ citations).

### Supporting external

6. [arXiv 2508.08322](https://arxiv.org/html/2508.08322v1) — explicit worked example of per-role payloads in a coding system (caveat: not isolated as a variable).
7. [MetaGPT 2308.00352](https://arxiv.org/html/2308.00352v6) — prior art on role-specialized artifact handoff.
8. [arXiv 2607.17598](https://arxiv.org/abs/2607.17598) — recent preprint (6 days old, un-peer-reviewed); "progressive disclosure buys context, not intelligence."
9. **[`obra/superpowers`](https://github.com/obra/superpowers) v6.1.1** — the plugin source repo (wave 2). [SDD SKILL.md](https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md) for cross-reference.
10. [DeepWiki — obra/superpowers SDD](https://deepwiki.com/obra/superpowers) — confirms SDD does per-role context shaping via file-handoff (file artifacts, not injection); matches local audit.

### Internal (file:line)

11. `.claude/hooks/inject-matching-rule.sh:39, 50-57, 64-66, 80-83, 89-90` — the existing path-scoped progressive-disclosure mechanism.
12. `.claude/settings.json:90-97, 118-125, 183-192` — wiring (PreToolUse Agent\|Task, PostToolUse Edit\|Write\|MultiEdit, SubagentStart).
13. `.zcode/skills/claude-glm-executor-handoff/SKILL.md:52-71` (esp. `:56, :64, :65, :71`) — the 6-block input contract.
14. `.claude/rules/phase-research-coverage.md:37` — the one existing per-role trim rule.
15. `superpowers/skills/subagent-driven-development/SKILL.md:10, 189-193, 225-235, 374-376` — SDD's worker dispatch discipline + the 42k-char warning.
16. `superpowers/skills/subagent-driven-development/task-reviewer-prompt.md:38-50, 67-73` — the reviewer input-channel allowlist.
17. `superpowers/skills/subagent-driven-development/implementer-prompt.md:18-20` — the unbounded `## Context` slot.
18. `superpowers/skills/writing-plans/SKILL.md:10-12, 144-154` — planner is inline, not dispatched.
19. `superpowers/skills/writing-skills/anthropic-best-practices.md:235, 408, 1049, 1099, 1115` — the only mentions of "progressive disclosure" in the plugin; all prose describing the host harness.
20. **`superpowers/hooks/hooks.json:3-15`** + **`superpowers/hooks/session-start:11, 27, 38-47`** — the plugin's ONLY shipped hook: flat SessionStart inject of `using-superpowers/SKILL.md`, no per-role branching, no other hook events. (Wave 2 finding.)
21. `.claude/hooks/inject-subagent-context.sh:62, 73-75` — the ZCode SubagentStart fallback that already preserves `subagent_type` (plumbing for per-role branching exists).
22. `.claude/hooks/inject-subagent-digest.sh:22-26` — emits ONE digest to EVERY subagent, no `subagent_type` branching (the gap Option E would close).
23. `.claude/skills/arch/SKILL.md:42, 44-45, 47` — two-altitude reviewer ladder; same payload per seat.
24. `.claude/skills/pipeline/SKILL.md:319-321, 322-323, 424, 528` — three SDD sub-wave roles; consumes SDD templates as-is; flags future `inject-matching-rule.sh` skill-scan extension.
25. `.claude/skills/dispatcher/SKILL.md:85-87, 244-260` — dispatches via REST-to-aif; names question types not roles.
26. `agents/fidelity-auditor.md:32`, `agents/orchestrator-worker-discipline.md:23-24` — per-role trim content exists in agent prompt files, loaded by the agent reading its own kickoff (not injected per role).

---

## 9. Next step

This document (rev 2) is the deliverable for the fabla / brainstorm. The next action is **a human review of this doc**, then a decision on Option A/B/C/D/**E** (§6) and the open questions (§7). No implementation work begins until that decision.

**Wave 2 changed the option set**: Option E (extend the SessionStart/SubagentStart hook to be per-role) is now on the table because the wave-2 audit found the plugin ships a real injection hook with partial plumbing for per-role branching. If the fabla's answer to open question #4 is "earliest reachable channel," Option E is the strongest candidate.
