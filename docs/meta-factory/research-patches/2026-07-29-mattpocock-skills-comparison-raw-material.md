<!-- scope:mattpocock-skills-comparison-raw-material -->
# mattpocock/skills vs rules-as-tests-aif — raw comparison material

> **Authoritative for:** raw research material comparing two implementations of agent orchestration / progressive disclosure / context injection / inter-agent prompting. Output for Opus + fabla to evaluate. **No verdict, no recommendation, no "we should reuse"** — this is observation only. The build-vs-reuse decision (SSOT #101 / `build-first-reuse-default.md`) is the fabla's, not GLM's.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

**Author:** GLM-5.2 orchestrator (delegated: 2 DeepWiki queries on `mattpocock/skills` + 1 Explore subagent on our side)
**Date:** 2026-07-29
**Trigger:** operator found [github.com/mattpocock/skills](https://github.com/mattpocock/skills) and asked «может вообще будет лучше их переиспользовать хз — сравни».

---

## §0 What mattpocock/skills is

[mattpocock/skills](https://github.com/mattpocock/skills) — "Skills for Real Engineers. Straight from my .agents directory." Matt Pocock's personal agent skill set, public. Multi-harness (Claude Code `.claude/agents/`, OpenAI Codex `.codex/agents/`, Cursor, Antigravity).

Core philosophy (from DeepWiki): **predictability + efficient context handling**. Two-axis skill classification: **model-invoked** (description kept → discoverable by agent, costs context load) vs **user-invoked** (description stripped → invisible to agent, callable only by human typing name, zero context load).

---

## §1 Progressive disclosure — D1

### mattpocock/skills

- **Information hierarchy** with 3 levels (`SKILL.md` content):
  1. **In-skill steps** — primary ordered actions in `SKILL.md`, always in context when skill active
  2. **In-skill reference** — definitions/rules/facts in `SKILL.md`, consulted on demand
  3. **External reference** — material pushed to separate files, loaded only when a **"context pointer"** fires (names the material + encodes the condition for reaching it)
- **Model-invoked vs user-invoked** (`disable-model-invocation` frontmatter flag + `policy.allow_implicit_invocation: false` in `agents/openai.yaml`): the primary mechanism. Stripping `description` makes a skill invisible to the agent → zero context load, callable only by human.
- **`/handoff`** — compacts conversation into a markdown file, new session references that file
- **`/compact`** (built-in) — summarizes earlier turns in same conversation
- **`setup-matt-pocock-skills`** — writes repo-specific config to `docs/agents/` (`issue-tracker.md`, `triage-labels.md`, `domain.md`) which skills read on demand

### rules-as-tests-aif (our side)

- **Path-gated rule injection** (`inject-matching-rule.sh:11-15, 39, 46-47, 60-75, 78`) — scans `.claude/rules/*.md` only on `Edit|Write|MultiEdit`, injects `<!-- inject: -->` summary **once per session** (session-cache), gated by `<!-- globs: -->` marker. Non-blocking (exit 0 + JSON).
- **First-line marker gating on kickoffs** (`runtime-bridge-dispatch.sh:99-100`) — auto-dispatch opt-in via `<!-- bridge: auto -->` first line
- **`bridge-profile:` marker** (`kickoff.ts:15-22, 30, 39-48`) — header-region-only parse, orthogonal channel for Tier-1 routing
- **Event-gated digest** — `UserPromptSubmit` (every prompt) + `SubagentStart` (every subagent) via `inject-session-bootstrap.sh` + `inject-subagent-digest.sh`
- **`claudeMdExcludes`** (`settings.json:214-219`) — removes 4 rules from always-on CLAUDE.md context
- **CC-native `paths:` frontmatter** — paired with `inject-matching-rule.sh` (dual-channel, `inject-matching-rule.sh:3-8`)
- **`allowed-tools` per skill** (`arch/SKILL.md:7-18` etc) — restricts tool surface

---

## §2 Context injection — D2

### mattpocock/skills

- **Through skill invocation** — when a skill fires, its `description` (if model-invoked) + content (`steps` + `reference`) become active context. No hook layer mentioned in DeepWiki.
- **Through file reads** — skills read `CONTEXT.md`, `docs/agents/*.md`, ADRs on demand
- **No hook-based injection** (SessionStart / PostToolUse / SubagentStart) found in DeepWiki survey. The repo is **skills + frontmatter policy**, not hooks.

### rules-as-tests-aif (our side)

5 lifecycle events wired (`.claude/settings.json:60-213`), 3 distinct payload formats:
- **JSON `additionalContext`** (PostToolUse, SubagentStart) — `inject-matching-rule.sh:89-91`, `dispatch.ts:217-227`, `inject-subagent-digest.sh:25-26`
- **Plain stdout** (UserPromptSubmit on CC) — auto-injected by harness, `inject-session-bootstrap.sh:2-4`
- **JSON `updatedInput`** (PreToolUse on ZCode for subagent prompt augmentation) — `inject-subagent-context.sh:73-75`
- Conditional injection: `AIF_HOOK_LANG=ru` (`inject-session-bootstrap.sh:38-46`), `AIF_AUTONOMOUS=1` (`inject-session-bootstrap.sh:63-65`)

---

## §3 Inter-agent prompting / communication — D3

### mattpocock/skills

- **`/skill`-style prose invocation** between skills — e.g. `implement` drives `tdd` internally
- **`/research` subagent** in `wayfinder` — for each research ticket, a subagent spun up to resolve in parallel; captures findings in cited markdown file; main session continues charting
- **Issue tracker as shared artifact** — `wayfinder` tickets are child issues of main map issue; resolution comments update the map's "Decisions so far"
- **`/handoff`** — markdown file handoff across sessions
- **No structured REPORT schema** (no mandatory Status/Deliverable/Evidence fields) found in DeepWiki

### rules-as-tests-aif (our side)

3 handoff edges with defined contracts:
- **6-block input contract** for coordinator → worker (`claude-glm-executor-handoff/SKILL.md:52-60`): `<task>` / `<context>` / `<constraints>` / `<tools>` / `<output>` / `<verify>`
- **REPORT schema** for worker → coordinator (`agents/orchestrator-worker-discipline.md`): mandatory `Status: DONE|BLOCKED|PARTIAL` + `Deliverable` + `Evidence` + optional `BLOCKER`/`MINOR`
- **Diff-as-artifact** for reviewer (`arch/SKILL.md:42-49`, `pipeline/SKILL.md:403`) — "each handed ONLY artifact paths, never chat context"
- **aif REST** for worker → coordinator escalation (`park.ts` + `answer.ts`) — never bare events-API POST ("silently drops feedback text")
- **Channel boundary** (load-bearing): Agent tool = read-only reviewers only; write-tasks go to fresh CC session (`pipeline/SKILL.md:335`, enforced by `principles/29-worker-dispatch-channel.ts`)

---

## §4 Role-specific context payloads — D4

### mattpocock/skills

- **Skill-specific context** — each skill's `SKILL.md` is its own payload (`domain-modeling` gets `CONTEXT.md` + ADRs; `codebase-design` gets deep-modules vocabulary; `triage` gets issue tracker config)
- **HITL vs AFK ticket categorization** in `wayfinder` — Prototype/Grilling tickets need live human exchange; Research tickets are agent-alone
- **`code-review` two-axis parallel sub-agents** — "Standards" axis + "Spec" axis run in parallel so neither pollutes the other. DeepWiki: "specific context each axis receives or any per-role context trimming" is **NOT explicitly detailed** — only the parallel-isolation principle is stated.
- **No per-role model tiering** found in DeepWiki (no `model:` frontmatter differentiation per role)

### rules-as-tests-aif (our side)

- **Per-role frontmatter** — `model:` (arch omits → operator's top-tier; pipeline/dispatcher/harvest pin `model: opus`) + `allowed-tools:` per skill
- **Per-role tier ladder** (`arch/SKILL.md:47`) — top tier designs, mid tier verifies, executor tier builds
- **`bridge-profile:` marker** — Tier-1 (executor-tier whole pipeline) vs Tier-2 (top-tier plans, executor implements)
- **Per-role dispatch prompts** — reviewer (`pipeline/SKILL.md:392-398`), worker (6-block contract), fidelity auditor (kickoff + diff + SHA only)
- **Portable subset** — `orchestrator-worker-discipline.md` ships only "condensed portable subset" to aif container; operator-side skills stay on host

---

## §5 Orchestrator / dispatcher architecture — D5

### mattpocock/skills

- **`ask-matt` router skill** — central router, "does no work itself", orients + hands off to the skill that does the job. User-invoked (description stripped).
- **Main flow: idea → ship** (`grill-with-docs` → `to-spec` → `to-tickets` → `implement` → `code-review`) — `ask-matt` helps navigate
- **`wayfinder`** for large efforts — creates "shared map" of "decision tickets" on issue tracker, monitors "frontier" of open/unblocked/unclaimed issues, fires `/research` subagents in parallel
- **Issue tracker integration** — GitHub/GitLab/local markdown; `setup-matt-pocock-skills` configures
- **No autonomous runtime** — no aif-handoff equivalent; no REST dispatch; no container isolation; no WS status stream

### rules-as-tests-aif (our side)

- **Two-skill split**: `/pipeline` (plan) + `/dispatcher` (execute) — `dispatcher/SKILL.md:24, 311`
- **REST dispatch** to aif-handoff (`dispatch.ts:91-98`; `AifHandoffBackend.dispatch()` → `POST /tasks`)
- **3 dispatch triggers**: PostToolUse hook auto / explicit CLI `/dispatcher` / `/pipeline` autonomous-offer
- **Single-poll-per-turn monitoring** (`dispatcher/SKILL.md:93-103`) — REST GET, no sleep, no WS
- **Stage gates** — `gh pr list --search` empty → HALT (`pipeline/SKILL.md:351-370`)
- **Q&A 3-type taxonomy** (`dispatcher/SKILL.md:243-251`): technical fork (autonomous) / strategic fork (operator) / terminal (harvest)
- **Harvest** — atomic `harvest.ts`: push + PR + auto-merge; resilience paths (`harvest-via-api.sh`, host-pull+push)
- **Pre-dispatch dedup guard** (3-signal, ≥2 of 3) — `dispatcher/SKILL.md:65-78`
- **Unattended posture** — `night-mode/SKILL.md` standing authorization

---

## §6 Surface-level observations (NOT verdicts)

These are surface differences a comparison could weigh. **No recommendation attached.**

| Dimension | mattpocock/skills | rules-as-tests-aif |
|---|---|---|
| Hook layer | none found | 5 lifecycle events, 3 payload formats |
| Progressive disclosure primary mechanism | model-invoked vs user-invoked (description strip) | path-gated rule injection + event-gated digest |
| Inter-agent contract | prose `/skill` invocation + issue tracker artifacts | 6-block input contract + REPORT schema + aif REST |
| Role differentiation | per-skill `SKILL.md` content; HITL vs AFK; 2-axis parallel review | per-role frontmatter + tier ladder + per-role prompts + portable subset |
| Orchestrator | `ask-matt` router (in-session) | `/pipeline` + `/dispatcher` (cross-session, REST to aif) |
| Autonomous runtime | none (no container, no REST dispatch) | aif-handoff (container isolation, REST, WS status, harvest) |
| Multi-harness | yes (CC, Codex, Cursor, Antigravity via frontmatter policy) | partial (CC + ZCode dual-channel, `dual-implementation-discipline.md`) |
| Shared language artifact | `CONTEXT.md` + ADRs (built by `grilling`) | `CLAUDE.md` + `.claude/session-bootstrap.md` digest + `docs/meta-factory/` SSOT |
| Phase continuity | "one unbroken context window" for grilling→spec→tickets; fresh per `/implement` | cross-session via kickoff files on staging + aif container |
| Handoff across sessions | `/handoff` (markdown file) | kickoff files + aif REST + harvest PRs |
| Test/gate discipline | not found in DeepWiki | principles as meta-tests + fidelity-verdict CI gate + rule-as-test framework |
| Subagent dispatch | `/research` parallel subagents in `wayfinder` | Agent tool (read-only reviewers) + aif container (write workers) — channel boundary enforced |

---

## §7 Open questions for Opus/fabla (NOT resolved by GLM)

1. **Is mattpocock's model-invoked vs user-invoked distinction** a mechanism we could adopt for our always-on load problem? (Our `claudeMdExcludes` + `paths:` frontmatter is a different mechanism achieving a similar end.)
2. **Is their `CONTEXT.md` + ADR grilling approach** relevant to our session-bootstrap digest? (We have goal+invariants; they have domain glossary.)
3. **Does their `/handoff` markdown-compaction** overlap with our kickoff-file-on-staging + aif-REST pattern?
4. **Is their `ask-matt` router** simpler/more general than our `/pipeline` + `/dispatcher` split? Or is our split necessary for autonomous (night-mode) runs?
5. **Their 2-axis parallel code-review** ("Standards" + "Spec", parallel subagents) — how does it compare to our `/arch §2` two-altitude review (top-down + bottom-up)?
6. **Their `wayfinder` issue-tracker-based task management** vs our aif-handoff REST task lifecycle — is one more robust for unattended runs?
7. **Build-vs-reuse (SSOT #101)**: is mattpocock/skills a candidate for BUILD re-trigger (like `inject-layer-extension` was)? Or is the surface overlap superficial (different harness assumptions, different autonomy requirements)?

These are open — GLM does not resolve them.

---

## §8 Honest gaps

- DeepWiki on `mattpocock/skills` may not reflect the latest commit (DeepWiki indexing lag). Direct file reads of their `SKILL.md` files would deepen the comparison.
- I did not read mattpocock's actual `SKILL.md` file contents (only DeepWiki summaries + README). A direct read of `ask-matt`, `wayfinder`, `code-review`, `implement`, `grill-with-docs` SKILL.md files would be needed for a load-bearing comparison.
- mattpocock's repo is multi-harness (CC/Codex/Cursor/Antigravity); ours is CC+ZCode. Direct comparison of multi-harness strategy was not done.
- No assessment of whether mattpocock's skills are **production-grade** or **personal-experimental**. The README says "Straight from my .agents directory" — suggests personal, not a framework.

---

## §1.7 self-review

**Forward-check applied.**
- `phase-research-coverage.md §1.7`: this patch carries raw observations + 7 open questions, no verdicts. Surface comparison table (§6) is observation, not evaluation.
- `recommendation-laziness-discipline.md §3`: no ADOPT/BUILD/REJECT/DEFER. §7 explicitly says "GLM does not resolve them." Build-vs-reuse is flagged as fabla's call.
- `build-first-reuse-default.md`: not triggered — no capability commit proposed.
- `ai-laziness-traps.md §2`: T7 (the mattpocock findings are from DeepWiki + README, not a seed list); T14 (§8 honest gaps explicitly state what wasn't verified).
- `doc-authority-hierarchy.md`: header present.

**Backward-check applied.** Class = *raw comparison research record.* Surfaces: 1 sibling track (`2026-07-26-per-role-context-shaping-raw-research.md` + addendum). SWEPT-CLEAN — this patch cites the prior track by reference, does not restate it.

**T21 anti-restatement.** Evidence cites DeepWiki answers verbatim + our-side Explore subagent file:line extraction. Methodology reproducible (the DeepWiki queries + the file list are inline).

---

## See also

- [mattpocock/skills on GitHub](https://github.com/mattpocock/skills)
- [DeepWiki — mattpocock/skills](https://deepwiki.com/mattpocock/skills)
- Our side: `.claude/skills/{arch,pipeline,dispatcher}/SKILL.md`, `.zcode/skills/{dispatcher,harvest,claude-glm-executor-handoff}/SKILL.md`, `.claude/hooks/inject-*.sh`, `packages/runtime-bridge/src/cli/dispatch.ts`, `CLAUDE.md`
- Prior track: `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` + `2026-07-27-per-role-context-addendum-fresh-2026.md`
