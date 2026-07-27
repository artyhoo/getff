<!-- scope:per-role-context-addendum-fresh-2026 -->
# Per-role context — ADDENDUM: fresh 2026 sources + superpowers v6.2.0 + actual payload measurement

> **Authoritative for:** ADDITIONAL raw research material extending the 2026-07-26 patch with (a) superpowers v6.2.0 diff vs v6.1.1, (b) fresh summer-2026 web sources, (c) the actual-payload measurement answering the operator's verbatim question. Output for Opus cold-verify; this patch does NOT replace the 2026-07-26 patch, it adds to it. Where the two disagree, this one is more recent (2026-07-27) and is grounded in runtime measurement + 2026 sources.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Decision forks remain PARKED.

**Author:** GLM-5.2 orchestrator session (delegated research: 2 subagents — v6.2.0 diff agent + summer-2026 web research agent; plus direct host-side measurement of actual worker payload).
**Date:** 2026-07-27
**Branch:** `feat/prune-worktrees` (post PR #1176 merge to staging; this patch lands on top of staging)
**Companion:** [`2026-07-26-per-role-context-shaping-raw-research.md`](./2026-07-26-per-role-context-shaping-raw-research.md) — the original 10-claim patch. Read it first; this addendum extends/refutes parts of it.

---

## §0 What changed between 2026-07-26 and 2026-07-27

1. **Operator correction.** The 2026-07-26 patch answered the wrong question (gate-framed: "is there a hook that checks role-specificity?"). The verbatim question was filter-framed: "do roles receive different context, and is only-needed context injected?" This addendum answers the verbatim question via direct measurement.
2. **Stale-source correction.** The 2026-07-26 patch cited Liu et al. 2024 + MetaGPT 2023 as primary. The operator asked for fresh 2026 sources. This addendum cites 6 sources from 2026 (March, June, July) + the Anthropic Agent Skills docs (late-2025 position, unchanged in 2026).
3. **Version correction.** The 2026-07-26 patch audited superpowers v6.1.1. The actually-installed version is **v6.2.0 (2026-07-23, 4 days before the original patch)**. This addendum diffs v6.1.1 vs v6.2.0 for role-relevant changes.
4. **Claim C5 correction.** The 2026-07-26 patch's claim C5 implied `claudeMdExcludes` filters rules at session start. The runtime-probe task `f164e807` (P4 verdict) proved `claudeMdExcludes` applies only to CLAUDE.md memory imports, not to `.claude/rules/*.md`. All 11 no-paths rules load at every session start.

---

## R1 — Actual worker payload measurement (the verbatim answer)

> Operator question: «важно чтобы инжектили только нужное а не весь контекст — так ли это?»

**Answer: NO.** A worker session in this repo receives the same ~236 KB always-on context as a planner or reviewer session. There is no per-role filtering of the always-on load. The ONLY role-differentiation is the kickoff file's content (which is role-specific text, not context filtering).

### R1.a What a worker session actually loads at start

Measured 2026-07-27 in `/Users/art/code/rules-as-tests-aif`:

| Component | Bytes | Per-role filtered? | Evidence |
|---|---|---|---|
| Rules without `paths:` frontmatter (11 files) | **131,408** (~33k tokens) | **NO** — all 11 load at every session start, regardless of role | `for f in .claude/rules/*.md; do head -10 "$f" \| grep -q '^paths:' \|\| wc -c < "$f"; done` |
| `claudeMdExcludes` (4 rules "should be excluded") | (n/a — exclusion ignored) | **DOES NOT APPLY** to `.claude/rules/*.md` — `claudeMdExcludes` filters CLAUDE.md memory imports only | Runtime-probe `f164e807` P4 verdict: "the 4 rules in `claudeMdExcludes` were predicted-NO but observed-YES" |
| `CLAUDE.md` (project) | 26,517 | NO | `wc -c CLAUDE.md` |
| `~/.claude/CLAUDE.md` (user-global) | 3,593 | NO | `wc -c ~/.claude/CLAUDE.md` |
| `MEMORY.md` files (8 project scopes) | 74,742 | NO | `find ~/.claude/projects -name MEMORY.md \| xargs wc -c` |
| SubagentStart digest (uniform) | ~1,500 | **NO** — byte-identical for `general-purpose` / `Explore` / `Plan` (SHA256 `4bdebe58…`) | Runtime-probe `f164e807` P1 verdict |
| Kickoff file | 3–15 KB | **YES** — different text per role, but this is the task description, not a filtered subset of the always-on load | varies per `.claude/orchestrator-prompts/<umbrella>/kickoff.md` |
| **Always-on subtotal** | **~236 KB / ~59k tokens** | **NONE filtered by role** | sum above |

### R1.b What this means

- A worker dispatched to "edit one line in `prune-worktrees.sh`" sees 131 KB of rules (ai-laziness-traps, zcode-parity-doctrine, autonomous-loop-continuity, etc.) plus 27 KB of CLAUDE.md plus 75 KB of MEMORY.md plus the digest. None of that is filtered by the fact that this is a worker.
- The Anthropic path (Agent Skills) would filter this via load-on-demand — but the repo's `claudeMdExcludes` mechanism that the 2026-07-26 patch leaned on **does not actually filter rules** (only CLAUDE.md imports).

### Claim C11 (NEW, falsifiable)
**The repo's always-on context load is ~236 KB and is identical for every agent role.** No per-role filtering exists at any layer (hook, rule, dispatcher, kickoff).

- **Wrong if:** Opus finds a mechanism the runtime-probe didn't exercise (e.g. a CC-internal filter that drops rules for Explore-type subagents — Claude Code docs say Explore/Plan omit CLAUDE.md and git status, but say nothing about rules).

---

## R2 — superpowers v6.2.0 vs v6.1.1 (role-relevant changes)

> v6.2.0 was released **2026-07-23** (4 days before the 2026-07-26 patch). The 2026-07-26 patch audited v6.1.1. v6.2.0 is the actually-installed version (`~/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/`).

### R2.a NEW role: scoped re-reviewer

v6.2.0 introduces a new template: `skills/subagent-driven-development/re-review-prompt.md` (107 lines, does not exist in v6.1.1). The re-reviewer receives a **genuinely narrower** context than the task-reviewer:

- `re-review-prompt.md:46-53` — "Your scope is the findings list and the fix diff. Verdict every finding. Inspect the fix diff for new problems the fix itself introduced. Do NOT re-review code the fix did not touch…"
- `re-review-prompt.md:55-63` — "Run a test only when reading the code raises a specific doubt… never a package-wide suite."
- Inputs (`re-review-prompt.md:94-103`): brief + findings + report + `[FIX_BASE_SHA]..[HEAD_SHA]` (fix-range diff only).

This is the **clearest per-role context filtering in v6.2.0**: the re-reviewer's diff is scoped to the fix range, hard-bans re-reviewing untouched code, hard-bans running the suite. The task-reviewer (unchanged) gets the full task diff + full rubric.

### R2.b Sharpened "Nothing else" cap on implementer dispatch

`SKILL.md` v6.2.0 line 220-224 (newly hoisted into the implementer-dispatch section):

> A dispatch prompt describes one task, not the session's history. Do not paste accumulated prior-task summaries ("state after Tasks 1-3") into later dispatches — a real session's dispatch hit 42k chars of which 99% was pasted history. A fresh subagent needs its task, the interfaces it touches, and the global constraints. **Nothing else.**

In v6.1.1 this line lived under "Constructing Reviewer Prompts". v6.2.0 hoists it into implementer-dispatch and adds the period-punctuated "Nothing else."

### R2.c Per-role model tiering (capability, not content)

`SKILL.md` v6.2.0 lines 168-179, 398: re-reviewer = "cheap-to-mid tier"; fix-loop rounds 4-5 = "one tier above stuck implementer"; final reviewer = "most capable available". v6.1.1 had only "scale to the diff" — no per-role mapping.

### R2.d Reviewer inputs spelled out per role

`SKILL.md` v6.2.0 lines 273-283: task-reviewer gets brief + report + review-package + global-constraints; re-reviewer gets brief + findings + report + fix-diff-only. (v6.1.1 had the task-reviewer partitioning; v6.2.0 extends to the re-reviewer.)

### R2.e REMOVED claim: dispatching-parallel-agents

`skills/dispatching-parallel-agents/SKILL.md` v6.1.1 line (deleted in v6.2.0): "Focus — Each agent has narrow scope, less context to track." The mechanism did not enforce this; v6.2.0 silently drops the claim.

### R2.f Verdict on v6.2.0

**PARTIAL** — v6.2.0 deepens per-role context partitioning **inside SDD** (most concretely via the scoped re-reviewer), but introduces **no cross-cutting per-role mechanism**:
- `session-start` hook is **byte-identical** to v6.1.1 (only `hooks.json` gets `shell: "bash"` for Windows).
- `dispatching-parallel-agents` still assumes uniform dispatch.
- No per-role payload schema, no per-role system prompt, no per-role context window budget.
- Partitioning is **advisory prompt engineering by the controller**, not an enforced gate. Compare to the rules-as-tests pattern in this repo where a violated rule fails the build — here, a violated partition just silently bloats a subagent.

### Claim C12 (NEW, falsifiable)
**superpowers v6.2.0 (2026-07-23) adds a genuinely scoped re-reviewer role** (narrower context than task-reviewer by construction), but **introduces no system-level per-role context filtering**. The session-start hook is byte-identical to v6.1.1.

- **Wrong if:** Opus finds per-role branching in a v6.2.0 file the diff agent didn't read, or in v6.2.1+ (not yet released as of 2026-07-27).

---

## R3 — Fresh summer-2026 web sources

> The 2026-07-26 patch leaned on Liu et al. 2024 + MetaGPT 2023. The operator asked for fresh 2026, ideally summer. Six 2026 sources below; honest gaps in §R5.

### R3.a Anthropic's position (unchanged from late 2025)

**No Anthropic engineering post on per-role context in June, July, or August 2026.** Latest engineering post as of 2026-07-27 is Apr 23, 2026 ("An update on recent Claude Code quality reports"). The Anthropic news surface in summer 2026 is model launches (Claude Opus 5 on Jul 24; Sonnet 5 on Jun 30; "Making of Claude Code" Jul 6) — none is an engineering deep-dive on per-role context.

Anthropic Agent Skills docs (now at [platform.claude.com/docs/en/agents-and-tools/agent-skills/overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)) — **zero occurrences of "role", "per-role", or "role-specific"**. Progressive disclosure is the canonical position: "you can install many Skills without context penalty: until a Skill is triggered, only its name and description occupy context." Identity-via-active-Skill is Anthropic's answer to role specialization, not role-filtered-context.

### R3.b Claude Code subagent docs — the Explore/Plan exception

[code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents) (fetched 2026-07-27; version refs v2.1.117 → v2.1.219). Per-role context handling:

- Subagent startup loads: system prompt + task message + CLAUDE.md hierarchy + git status + preloaded skills + sibling roster.
- **The ONLY documented role-based context filter**: "Explore and Plan are the only subagents that omit CLAUDE.md and git status."
- Custom subagents have **no documented mechanism** to opt out of CLAUDE.md / git status / sibling roster.
- Fork mode (`/subtask`) is the exception — inherits full parent context.
- Newer features (no dates): persistent `memory` field, output scanning (v2.1.210+), nested subagents with depth limits.

### R3.c Hierarchical routing — named in March 2026

[pub.towardsai.net/state-of-context-engineering-in-2026-cf92d010eab1](https://pub.towardsai.net/state-of-context-engineering-in-2026-cf92d010eab1) — published **March 22, 2026**. Pattern 3 "Context Routing": "Hierarchical routing uses a lead agent to triage queries to specialised sub-agents, each with its own focused context window." Names Anthropic, Manus, OpenAI, Google, GitHub, Cursor as adopters of the Skills format. Notes the latency trade-off: "spinning up separate specialised sub-agents… introduces latency from inter-agent communication."

[SudoAll — Multi-Agent Coordination 2026 Playbook](https://sudoall.com/multi-agent-coordination-2026-playbook/) — published **June 24, 2026**. "The orchestrator-worker layout is now the dominant production pattern." "Least privilege per agent role; no worker has more tool access than its task requires."

### R3.d arXiv 2607.17598 — harness-dependent + against deep routing

[arxiv.org/abs/2607.17598](https://arxiv.org/abs/2607.17598) — submitted **July 20, 2026** (6 days before original patch). Title: "Is Progressive Disclosure All You Need for Long-Context Agents?"

- **Harness-dependent**: "disclosure is a harness-dependent context-scaling tool, not a universal accuracy lever" (§5.1).
- **Against deep routing**: "A second, deeper routing level never helps and sometimes breaks accuracy outright, so one level is enough" (Abstract, §6). This empirically challenges multi-level hierarchical routing.
- **Silent on per-role**: zero occurrences of "role", "specialist", "sub-agent", "per-role". Tests single-agent document navigation, not role split.

### R3.e Harness-MU — per-USER filtering, per-ROLE is future work

[arxiv.org/abs/2606.21856](https://arxiv.org/abs/2606.21856) — submitted **June 20, 2026**. Six-component infrastructure (Gatekeeper, Mediator, per-user parallel Workers, ComplianceChecker). Per-USER context isolation: "the Worker never merges users' histories and only leverages filtered knowledge of one person." Crucially — "role-specific prompt templates" appears ONLY in Section 6.9 as **future work**, not implemented.

### R3.f Google ADK — closest to true per-role filtering in production

[developers.googleblog.com — Architecting efficient context-aware multi-agent framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/) — published **Dec 4, 2025**. ADK's `include_contents` knob "determine[s] how much context flows from the root agent" to the callee. "Narrative casting" + "Action attribution" rewrite prior messages so the new agent doesn't claim prior actions. **Closest production mechanism to true per-role context filtering** (not just spawn-fresh).

### R3.g Production vendor comparison (2026)

| Vendor | Approach | Per-role context? | Source date |
|---|---|---|---|
| Claude Code | Fresh-context subagents; Explore/Plan omit CLAUDE.md+git | Limited (only 2 built-in agents) | fetched 2026-07-27 |
| Cursor | Fresh-context subagents; orchestrator pattern since Cursor 2.5 | Role-specific system prompt, clean context | fetched 2026-07-27 |
| Devin (Cognition) | Isolated VMs per managed Devin; main Devin = coordinator | Per-agent VM isolation, not prompt-level | release notes Jan-Jul 2026 |
| LangChain/LangGraph | "subagent invocation is really about context isolation"; supervisor + specialized workers | Role-specific worker agents, fresh context per invocation | fetched 2026-07-27 |
| **Google ADK** | `include_contents` knob + Narrative casting | **Closest to true per-role filtering** | Dec 4, 2025 |
| OpenAI Codex | Not publicly documented | Unknown | — |

### Claim C13 (NEW, falsifiable)
**True per-role context filtering (shared context filtered differently by role) is rare in 2026 production.** The dominant pattern is "spawn a fresh-context subagent with a role-specific prompt + skill preload." Google ADK's `include_contents` is the clearest example of true per-role filtering. Anthropic's position is unchanged: progressive disclosure + identity-via-active-Skill, no per-role filtering.

- **Wrong if:** Opus finds a 2026 production vendor (Codex, Cursor, Cursor-Cursor2.5+) that ships true per-role filtering and the web agent missed it.

---

## R4 — Updated fork surface (for fabla awareness)

The 2026-07-26 patch parked 5 forks. The 2026-07-27 evidence updates the fork surface:

- **Fork 1 (forcing function):** unchanged. No incident proven; uniform digest = deliberate anti-drift (per CLAUDE.md AOC citation, still unverified in specifics).
- **Fork 2 (delivery channel):** the new evidence narrows this. **The dominant 2026 pattern is fresh-context spawn + role-specific prompt**, not per-role filtering of shared context. If the fabla picks a shape, the spawn+prompt path (α-rule + η-templates + κ-upstream-SDD-contribution) is the ecosystem-aligned direction; the hook-per-role path (ε, ζ, μ) goes against the grain of how every major vendor does it.
- **Fork 3 (absorb into token-audit):** unchanged.
- **Fork 4 (sequencing):** unchanged. PR #1175 still gating the `inject-matching-rule.sh` surface.
- **Fork 5 (vocabulary):** refined. "Progressive disclosure" remains canonical, BUT the 2026 sources distinguish it from "context routing" (Towards AI) and from "context isolation" (LangChain). The fabla may want to pick the most precise term.

### NEW Fork 6 — single-level vs multi-level routing

arXiv 2607.17598 (July 2026) empirically shows **multi-level routing hurts accuracy**. If the fabla picks a routing-based shape, it should be **single-level** (controller → role-specific subagent) not multi-level (controller → specialist → sub-specialist).

### NEW Fork 7 — isolation vs filtering

The operator's verbatim question implied filtering ("inject only needed"). The 2026 ecosystem does isolation (fresh context per spawn). These achieve similar ends via different mechanisms. The fabla may want to clarify which it wants.

---

## R5 — Honest gaps (what 2026-07-27 still couldn't find)

1. **Anthropic summer-2026 engineering post on per-role context** — there isn't one as of 2026-07-27. Latest relevant engineering post is Apr 23, 2026 (and it's about a bug, not architecture).
2. **Claude Opus 5 system card** (launched Jul 24, 2026) — fetched only at news-index level; full launch post may contain context-architecture guidance. Follow-up fetch needed.
3. **OpenAI Codex per-role context documentation** — no public doc found.
4. **Production open-source repo implementing true per-role filtering** — not found. The repos in the wild (herakles-dev/claude-code-agents, goatstarter/goat-herd, yourjhay/maple-team, sva-admin/agent-team, milojarow/manada-skills) ship role-specific agents that rely on Claude Code's default fresh-context isolation; none implements a filtering layer.
5. **Benchmark of hierarchical routing** — asserted in vendor blogs and the Towards AI article, not benchmarked at the pattern level. Only arXiv 2607.17598 tests routing depth (and finds against depth > 1).
6. **v6.2.1+ superpowers** — not released as of 2026-07-27. v6.2.0 is current.

---

## §1.7 self-review

> Required on all research-patch files per principle 13. Self-review below.

**Forward-check applied.**

- [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md): this patch carries 3 NEW falsifiable claims (C11, C12, C13) with explicit "Wrong if:" falsifiers. No prose-only assertions.
- [`recommendation-laziness-discipline.md §3`](../../../.claude/rules/recommendation-laziness-discipline.md): no ADOPT/BUILD/REJECT/DEFER verdict. 7 forks surfaced (5 inherited + 2 new), none picked. The "ecosystem-aligned direction" note in Fork 2 is an observation about industry direction, not a verdict — fabla still decides.
- [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md): forks surfaced, not resolved.
- [`ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md): T3 (the R1.a payload table is `wc -c` command output, not recall); T7 (the 11 no-paths rules are enumerated from the live mechanism, not from a seed list); T14 (the "Anthropic has no summer-2026 post" finding is concrete — date-stamped enumeration of anthropic.com/engineering — not a catch-all).
- [`attention-is-not-a-mechanism.md`](../../../.claude/rules/attention-is-not-a-mechanism.md): no detection layer or compensating mechanism proposed; the parked forks remain surface-only.
- [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md): N/A — no capability commit, just research record.
- [`doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md): the patch carries Authoritative-for / NOT authoritative-for markers.

**Backward-check applied.** Class of this change = *an addendum research record extending a prior patch with fresh sources + version diff + actual-payload measurement.* Surfaces where that class occurs: 1 sibling (`2026-07-26-per-role-context-shaping-raw-research.md`). **SWEPT-CLEAN** — this addendum explicitly cites the prior patch by path and confirms/refutes its claims by ID. No duplication; the addendum does not restate the 2026-07-26 patch's content, it extends it.

**T21 anti-restatement check.** This patch's evidence list is NOT its own diff — it cites the runtime-probe task output (`f164e807`), the v6.2.0 release notes (`RELEASE-NOTES.md`), 6 external 2026 sources, and direct `wc -c` measurements from the host repo. The measurement methodology is reproducible (the commands are inline).

---

## See also

- [`2026-07-26-per-role-context-shaping-raw-research.md`](./2026-07-26-per-role-context-shaping-raw-research.md) — the original 10-claim patch (C1-C10). Where this addendum disagrees, the addendum wins on recency + measurement grounding.
- [`docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md`](../../superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md) — 18 candidate shapes (α-σ); the 2026-07-27 evidence updates Fork 2 (channel choice) but does not invalidate the shapes.
- Runtime-probe task `f164e807` output: `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scripts-f164e8-f164e807-191a-4336-9fe1-52145255c00e/per-role-context-runtime-probe-report.md`.
- Deep-project-research task `f4dc0bff` output: `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scripts-f4dc0b-f4dc0bff-37c6-4662-abab-5c67c9a646b6/per-role-context-deep-research-report.md` (S13 covers superpowers v6.2.0 in detail; this addendum's R2 is a focused role-relevant subset).
