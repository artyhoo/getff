<!-- scope: Opus distillate of 3 aif research deliverables → input for the Fable idea-correction seat (/arch v2 + context pipeline). Membrane: Fable should not need the raw files after this. -->

# Research distillate — /arch v2 + context pipeline

> **Current as of 2026-07-31.** Every source dated; freshest first; nothing undated or pre-2026 entered without fresh confirmation.
> **Spot-check discipline (handoff decision 4):** 6 in-repo `file:line` claims re-opened in the working dir, 4 external URLs re-fetched (superpowers RELEASE-NOTES, claude.com/blog, code.claude.com/docs/en/skills, .../sub-agents). Failures are in §F, excluded from §A–§E.
> **Sources by date:** CC docs `skills` + `sub-agents` (fetched 2026-07-31, live) · aif-runtime sweep (2026-07-30) · cold-review v2 (2026-07-30) · R1a/R1b/R2/R3 research (2026-07-31) · Anthropic blog (published 2026-07-24) · superpowers RELEASE-NOTES v5.0.6 (fetched 2026-07-31) · in-repo incidents PR #857, #1109 (2026-07).

## §A Design-bearing findings

**A1 — There is NO native per-role subtraction of L1, and Anthropic says so explicitly.**
Source: `code.claude.com/docs/en/sub-agents`, fetched 2026-07-31 — verbatim: «Explore and Plan are the only subagents that omit CLAUDE.md and git status. **There is no frontmatter field or per-agent setting to change which agents skip them.**» Also: «every level of the CLAUDE.md hierarchy the main conversation loads … The built-in Explore and Plan agents skip this.»
Spot-check: **CONFIRMED verbatim** (direct fetch, this session).
Changes: closes the BFR negative-existence check for L2 with a *primary, fresh* source — the hook-side resolver is the only channel, not a preference. But it also means decision 7's «PROJECT goal by role — full text / pointer / pointer+prohibition» is **not deliverable at L1 for subagents**; only `claudeMdExcludes` (per-project, not per-role) plus hook injection can move it. L1 differentiation collapses into L2.

**A2 — There IS a native per-role ADDITIVE lever the research missed: the `skills:` frontmatter field.**
Source: same doc, 2026-07-31 — verbatim: «`skills` … Skills to preload into the subagent's context at startup. **The full skill content is injected, not only the description.**» And: «Built-in agents don't preload skills.» And the constraint: «You can't preload skills that set `disable-model-invocation: true`.»
Spot-check: **CONFIRMED verbatim**; research R2 §4.1 D4 («no per-role/per-subagent-type context-scoping lever») is refuted on the additive half — see §F.
Changes: L2 has a **second, native** delivery channel besides the digest hook — a role's context can be a *skill preloaded by the agent definition*, versioned in-repo, no hook needed. Own-stack-first (BFR §1.1 criterion zero) obliges the L2 design to compare `templates/digests/<role>.md` + resolver against `skills:` preload before building the resolver. **Trap:** `/arch` and `/pipeline` already set `disable-model-invocation: true`, which makes them un-preloadable — the L1 saving and the L2 delivery are in direct conflict on the same frontmatter field.

**A3 — A custom subagent's system prompt replaces CC's system prompt entirely.**
Source: same doc, 2026-07-31 — «The subagent's system prompt replaces the default Claude Code system prompt entirely, the same way `--system-prompt` does. `CLAUDE.md` files and project memory still load through the normal message flow.»
Spot-check: **CONFIRMED verbatim**.
Changes: the single largest L1 channel is already per-role-replaceable for custom subagents; the measure→attribute step (token-audit S1) must attribute the *system prompt* separately for main-session vs custom-subagent, or the budget will be wrong for every dispatched seat.

**A4 — Anthropic's own direction is subtractive, and is silent on per-role shaping.**
Source: `claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models`, published **2026-07-24**, fetched 2026-07-31 — verbatim: «We removed over 80% of Claude Code's system prompt for models like Claude Opus 5 and Claude Fable 5 with no measurable loss on our coding evaluations»; «Claude Code has gotten very competent at using progressive disclosure—loading the right context at the right times»; «Keep your CLAUDE.md lightweight … spend most of the tokens on gotchas»; «Newer models have better judgement and can handle these decisions well without explicit rules.» The fetch independently confirms the negative: **no mention of per-role or per-subagent context shaping.**
Spot-check: **CONFIRMED verbatim, incl. the negative finding.**
Changes: the pipeline has **no external cover in either direction** for per-role shaping — it is this project's own bet. And the «better judgement without explicit rules» clause sits against the repo thesis; the honest framing for the spec is *L1 shrinks (agrees with Anthropic), L2/L3 shape rather than add* — any design that grows total always-on bytes is arguing against a dated primary source.

**A5 — The aif runtime already does code-enforced per-role shaping at three granularities.**
Source: aif-runtime sweep, 2026-07-30 — `coordinator.ts:270-278` `runtimeProfileModeForStage` (stage → `task|plan|review`, exhaustive, no config override across 4 grep hits); hardcoded `profileMode` literals in all 6 subagents (`planner.ts:330`, `reviewer.ts:49`, `verifier.ts:91`, `improver.ts:87`, `planChecker.ts:122`); agent-definition-name branching (`reviewer.ts:172-173`); per-subagent prompt templates. **What is NOT shaped: the ambient digest — uniform across stages**, matching the repo's own C5.
Spot-check: container-side lines **not reachable from the host worktree** — recorded as sweep-asserted, not re-verified (see §F). The repo half IS verified: `docs/superpowers/specs/2026-07-23-acceptance-contour-design.md:14-15` does cite `coordinator.ts:199` and `reviewer.ts:30,287` as «walls» — and the sweep found both stale (semaphore loop / string-trim helper).
Changes: L3 is **not greenfield**. The spec must state its delta against an existing enforced wall, or it is `#parallel-evolution-creep` against our own runtime. Concretely: the runtime shapes *dispatch-time role* already; the unshaped surface is exactly the *ambient digest* — which is precisely L2. That is a clean, evidence-backed scope line for the umbrella.

**A6 — The dominant defect class is «anchors don't exist as claimed» — 5/5 recent incidents.**
Source: R1a research, 2026-07-31, §6 surprise #1, backed by five 2026-07 in-repo incidents (PR #857 restatement backward-check; `arch/SKILL.md:79` false negative-existence; `night-mode` stale SDD roster; `claudeMdExcludes` pattern-format defect; fired-but-unnoticed `inject-layer-extension` trigger).
Spot-check: **CONFIRMED** — `agents/backward-sweep-auditor.md:24` carries the PR #857 incident verbatim (commit `ec643bac7` → fix `bf1b8b5f3`); `.claude/skills/arch/SKILL.md:79` still carries the false claim verbatim today («verified absent from upstream through v6.1.1: no design-review skill exists there»); the fired trigger reproduces — `grep -lE '^paths:|^<!-- globs:|<!-- inject:' .claude/rules/*.md | wc -l` → **16 of 26** (matches handoff decision 10).
Changes: the bottom seat's budget concentrates on K1+K2; K3–K5 are background coverage, not equal partners. And decision 6's wrapper-drift fix has a live target sitting at `arch/SKILL.md:79` right now.

**A7 — Session-start byte counts are environment-specific; a single number is not portable.**
Source: R2 research D2, 2026-07-31, claims «[observed in this worktree] 39 skills / 16 agents / 19 `.claude/agents`».
Spot-check: **REFUTED-ON-CHECK on the host** — this worktree: `.claude/skills/*/SKILL.md` → **14** (26 `SKILL.md` repo-wide incl. templates), `agents/*.md` → **16** (matches), `.claude/agents/` → **does not exist**. The research ran in the aif container, whose checkout differs.
Changes: reinforces token-audit S1's per-environment split (host-cc vs aif-container) and hardens it into a rule for the spec: **every budget assertion names its environment**; a gate that hard-codes one total will fire falsely in the other. (Same shape as the cold-verify's 90,699 B host vs 131,408 B container correction, verified at `2026-07-31-per-role-context-opus-cold-verify.md:206`.)

**A8 — There IS a documented per-skill description budget; the research said there is none.**
Source: `code.claude.com/docs/en/skills`, 2026-07-31 — `when_to_use` «Appended to `description` in the skill listing and **counts toward the 1,536-character cap**.»
Spot-check: **CONFIRMED verbatim**; research D3(6) «No Anthropic-documented length budget found» → §F.
Changes: L1 gets a real, upstream-defined unit — 14 skills × up-to-1,536 chars is a bounded, attributable channel, and `skill-description-quality.md` (Class C) has an actual number to enforce against instead of taste.

## §B Contradictions with handoff §1/§2

**B1 — Decision 9 relocates SOLID/patterns checks; the research says delete them.**
Decision 9: «SOLID/patterns/LLD checks belong to the implementation-review stage … NOT the dispatch-input seat». R1b (2026-07-31) B1+B6 verdict is stronger: those dimensions are **vacuous by construction** — «the vocabulary applies post-hoc to any code, so the check always passes or always finds something», and its §3.2 verdict line is «**DROP from any reviewer prompt**», with naming/readability «DROP from cold review; allow in self-review only». Evidence is position-grade (Augment Code 2026 «Why Recall Beats Precision for Agents»), not an RCT — but the repo already votes the same way: `agents/review-sidecar.md` is deliberately scoped to tautological-test review and no SOLID reviewer ships.
Fork for Fable: relocating a vacuous check gives the implementation-review stage a permanent noise floor. Either drop it outright, or state why the aif per-task reviewer is exempt from B6.

**B2 — Decision 5 keeps the checks but moves them down a tier; every catch in the evidence base was made a tier UP.**
Decision 5 assigns the surviving cold seat to GLM-in-aif (executor tier) with contract v1. But the K2 catch (`opus-cold-verify:69-71`, unrunnable «marker» claim → real source `inject-session-bootstrap.sh:25-33`), the K5 catch (`:283-298`, fired DEFER trigger at 16/26), and the K4 catch (`claudeMdExcludes` pattern-format) were all produced by **Opus cold-verify passes**, not by an executor-tier seat. R1a §8 item 5 names this as the blind spot the spec itself failed to ask: «whether the reviewer's model tier is a stronger determinant of catch-rate than the check-class» — unmeasured.
Fork: keep decision 5 but make the first 5 bottom-seat runs a **calibration cohort** (did the executor seat reproduce a catch of the class Opus made?), with the falsifier already written into decision 5.

**B3 — Abolishing the top-down seat leaves a real, observed defect class unowned.**
Cold-review v2 (2026-07-30) Dim C found **3 smuggled recommendations** in documents whose own headers disclaim recommendations, and Dim G found structural framing bias (10/18 shapes spawn-side, 2/18 filter-side, 6/18 no-change — «if a reader picks at random, 56% comes from spawn-side»). Spot-check: the Dim C hit at `candidate-shapes.md:106` **CONFIRMED** («**Recommendation:** any codified rule should use…») against the file's own line 3 «**No priority, no recommendation, no verdict lives in this file.**»; the `inflight-context.md:65` «**High — natural host**» hit **CONFIRMED**. Neither smuggled-verdict nor skewed-option-space is detectable by any of the 5 classes in contract v1 — all five are existence/reproduction/consistency/format/external-state checks.
Fork: decision 5 says Opus's three standing looks absorb the top-down function. But in this very track Opus authored or verified the artifacts under audit — T19 self-pass risk. Either add a 6th class («does the document obey its own stated non-goals; is the option space spanned?») or name explicitly which standing look owns framing bias and how it stays cold.

**B4 — «Inject only needed, per layer» (decision 7) is partly un-implementable as written, and partly already available natively.**
Per A1, per-role L1 differentiation has no native setting — the role-differentiated «full text / pointer / pointer + prohibition» must be an L2 hook artifact, so decision 7's L1 clause and L2 clause are one mechanism, not two. Per A2, the L2 delivery has a native alternative (`skills:` preload, full content injected) that the design does not consider, and which collides with `disable-model-invocation` — the very L1 lever the repo already uses on `/arch` and `/pipeline`.
Fork: BFR own-stack-first obliges an explicit verdict on `skills:`-preload vs digest-resolver *before* the resolver is built.

**B5 — The idea grows context machinery in the month Anthropic published an 80%-subtractive result.**
Not a refutation (A4: the post is silent on per-role), but handoff §1's framing «context is a convention → make it an executable artifact» should absorb the dated primary source rather than route around it. The defensible framing: L1 **shrinks and gets attributed**; L2/L3 **redistribute** existing bytes per role; the budget gate asserts a ceiling. A design whose net effect is more always-on bytes contradicts a 2026-07-24 Anthropic measurement and needs to say why.

## §C The 5-class dispatch-input contract v1 — confirmed / adjusted

R1a's A7 explicitly looked for a low-yield class to drop and found **none**; every class has ≥1 in-repo catch in the last 60 days. Verdict per class (source R1a 2026-07-31; my spot-checks noted):

| Class | Verdict | Catch evidence | Adjustment |
|---|---|---|---|
| K1 anchors exist as claimed | **KEEP — promote to primary** | PR #857 (`backward-sweep-auditor.md:24`, spot-check CONFIRMED); `arch/SKILL.md:79` false negative-existence (CONFIRMED live today) | upstream's inline self-review does **not** cover this — DeepWiki on `obra/superpowers` 2026-07-31: «No surviving prompt explicitly verifies that cited files exist». This is the differentiator that survives the A/B |
| K2 quoted outputs reproduce | **KEEP — promote to primary** | 2 catches in 60 days (`opus-cold-verify:69-71`; `orchestration-contour:82-83`) | this distillate adds a 3rd (§F R1) |
| K3 sibling-pattern consistency | **KEEP — background** | 3 stale SDD claims in `night-mode/SKILL.md` | yield tracks upstream velocity, not our own |
| K4 format mechanics / silent failure | **KEEP — background** | `bridge-profile` marker ambiguity (3 kickoffs, PR #1109 — CLAUDE.md «Marker value rule»); `claudeMdExcludes` repo-relative literals | |
| K5 external-state preconditions | **KEEP — background** | fired DEFER trigger at 16/26 (reproduced by me today) | |

**Additions R1a proposes (mechanism-justified, not measured):** (i) explicit **pre-mortem** — force one paragraph of «what would have to be true for this to fail» per spec, rather than a generic «what's missing»; (ii) **acceptance-criteria presence at Stage A** — does the input name what test would prove it wrong, before any code exists (SSOT #228 ships only the Stage-B/PR-side arm).
**Addition I add from §B3:** (iii) **self-consistency with declared non-goals** — a document that disclaims verdicts and then emits one is a defect no K1–K5 class catches, and it occurred 3× in this track's own substrate.

## §D Implementation-review dimensions worth wiring (R1b) — and where they belong

Source R1b, 2026-07-31; all mechanism-grade, none independently benchmarked (vendor-measured only — §F R4).

| Dimension | Verdict | Home per decision 9 |
|---|---|---|
| Correctness / logic | KEEP, primary | aif per-task reviewer |
| Rule / convention conformance | KEEP, primary — «strongest class; a matching task against stated text, not open judgment» (`agents/compliance-verifier.md:33-46`, spot-check CONFIRMED: every layer row demands a `file.ext:line` or a concrete N/A) | aif per-task reviewer + existing principle tests |
| Security | KEEP, constrained by `no-paid-llm-in-ci` | aif per-task reviewer, session-read only |
| Test presence / structure | KEEP | already coded (principles 01-15) |
| **Test quality — does it fail for the right reason** | **ADD** — unowned; presence is coded, reason-for-failure is judgment | Opus acceptance at harvest |
| **Error-path reachability** | **ADD** — no agent in `agents/*.md` owns it | aif per-task reviewer |
| **Differential / unintended behaviour change** | **ADD, scoped against SSOT #228** — #228 covers acceptance-side (did we build what was asked), not unintended-change-side | Opus acceptance at harvest |
| SOLID / design patterns | **DROP everywhere** (B1) | — |
| Naming / readability | DROP from cold review; self-review only | — |

Asymmetry that matters for the pipeline: the superpowers A/B result is about **document** review (author≈reviewer competitive on internal consistency); for **code** review the research cites ~31.7% of silent semantic drift missed by author self-review, not improving with model capability (single study, primary not fetched — §F R4). Cheap checks inline, cold checks delegated — which is what decision 5 already encodes.

## §E Context-scoping levers relevant to L1/L2

All rows fetched from primary Anthropic docs **2026-07-31** unless noted; `[doc]` = documented, `[obs]` = observed in a live session.

| Lever | Mechanism | Scope | Consumed by |
|---|---|---|---|
| `skills:` in agent frontmatter `[doc]` | preloads **full skill content** into a subagent at startup; built-in agents preload nothing; cannot preload `disable-model-invocation: true` skills | per-agent-definition | **L2 — the native rival to the digest resolver (A2). Verdict required before building.** |
| custom subagent system prompt `[doc]` | **replaces** CC's default system prompt entirely; CLAUDE.md still loads via message flow | per-agent-definition | L1 attribution (A3) + L2 role framing |
| «no per-agent CLAUDE.md setting» `[doc]` | Explore/Plan omission is hard-coded; **no frontmatter field or per-agent setting** exists | — | L1: closes the BFR negative-existence check; forces L2 hook (A1) |
| `claudeMdExcludes` `[doc+obs]` | drops matched CLAUDE.md / rules files; measured 40,709 B (~31% of rule load) saved on host, **not firing in container** (cold-verify `:206`, spot-check CONFIRMED) | per-project | L1 trim; the repo-relative-vs-absolute-glob hypothesis is the open falsifier (handoff decision 13) |
| `disable-model-invocation: true` `[doc]` | «Description **not in context**, full skill loads when you invoke» | per-skill | L1 trim — **but blocks `skills:` preload of the same skill** |
| 1,536-char cap on `description` + `when_to_use` `[doc]` | upstream-defined budget unit | per-skill | L1 attribution + `skill-description-quality.md` (A8) |
| `ENABLE_TOOL_SEARCH` (default ON) `[doc]` | MCP tool schemas load on demand inside `ToolSearch` instead of upfront | per-session/env | L1 — already-on; measure before claiming savings |
| `disabledMcpServers` / `enabledMcpServers` `[doc]` | server does not connect; its `instructions` block also stops loading — instructions load even when no tool is called `[obs]` | per-settings-file | L1 trim |
| `disableBundledSkills`, `skillOverrides: off`, `DISABLE_DOCTOR_COMMAND` `[doc]` | remove named/bundled skills | per-settings-file | L1 trim |
| `InstructionsLoaded` hook (CC 2.1.207+) | observability, not removal — asserts what actually loaded | per-session | L1 budget gate (decision 7's error-with-escape-token) |

## §F Rejects — failed spot-check or stale-unconfirmed

- **R1 — «39 skills / 19 `.claude/agents`» as a host measurement** (R2 D2, labelled «[observed in this worktree]»): REFUTED-ON-CHECK — host worktree has 14 skills and no `.claude/agents/`. Container-measured, host-labelled. The derived «>236 KB total» inherits the defect.
- **R2 — «No per-role / per-subagent-type context-scoping lever» (R2 D4)**: REFUTED-ON-CHECK on the additive half — `skills:` preload is documented and per-agent (A2). D4 holds only for *subtraction* of CLAUDE.md.
- **R3 — «No Anthropic-documented length budget» for skill descriptions (R2 D3(6))**: REFUTED-ON-CHECK — 1,536-character cap documented (A8).
- **R4 — the «~31.7% silent semantic drift» figure** (R1b B3): admitted by the research as a WebSearch summary, arXiv primary never fetched. **Stale-unconfirmed → excluded from any load-bearing claim**; used in §D only as directional asymmetry, never as a number.
- **R5 — cold-review v2 Dim C quotes**: the *findings* reproduce, two of the three *quotes* do not. `candidate-shapes.md:106` — recommendation confirmed present, but the quoted tail («not 'filter-by-role' or 'subagent-scoped'») is not in the file (actual: «not "progressive discovery."»), and the header disclaimer is at line **3**, not 5. `addendum:179` — the substance (a «should be single-level» recommendation) is present, but the quoted sentence («example labels … nested subdirectories») does not exist in the file; the actual text is the Fork-6 routing paragraph citing arXiv 2607.17598. K2-class defect **inside the cold-review itself** — findings usable, quotes not citable.
- **R6 — aif-runtime sweep line numbers under `/app/`** (`coordinator.ts:270-278`, `reviewer.ts:49,172-173`): UNVERIFIED from the host — the external checkout is not reachable in this worktree. The repo-side half IS verified (`2026-07-23-acceptance-contour-design.md:14-15` does cite the stale `coordinator.ts:199` / `reviewer.ts:30,287`). Treat A5's granularity claim as sweep-asserted pending a container re-check.
- **R7 — «structured checklist > unstructured review» (R1a A2)** and **«measurable per-dimension defect profile» (R1b B2)**: INCONCLUSIVE at source, no controlled study on AI-authored specs; vendor-published numbers only. Excluded from §A/§C/§D as evidence; the KEEP verdicts rest on in-repo incidents, not on this literature.
- **R8 — superpowers 5×5 A/B methodology**: the quoted result is CONFIRMED verbatim (fetched 2026-07-31), but «quality score» is undefined, the methodology is unpublished, and whether the reviewed documents were AI-authored is unstated. Usable only for what it literally says — the *dispatch* was retired, the *checks* moved inline; the release notes say nothing about verifying that cited files exist (confirmed by my own fetch).
