<!-- scope:orchestration-contour-prior-art -->
# Orchestration contour — prior-art comparison and build-vs-reuse verdicts

> **Authoritative for:** the build-vs-reuse adjudication of our orchestration contour (`/arch`, `/pipeline`, `/dispatcher`, `night-mode`, `aif-doctor`, `packages/runtime-bridge`) against `mattpocock/skills`, `obra/superpowers`, and the operator-control-plane field — §1 population, §2 per-source findings, §3 the per-capability verdict table, §4 the answer + the drift findings, §5 proposed follow-ups.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The skills themselves — each `SKILL.md` owns its own behaviour. Settled SSOT verdicts — [prior-art-evaluations.md](../prior-art-evaluations.md) rows are cited by ID here, never re-adjudicated from memory.

**Author:** Opus prior-art analyst session, 2026-07-31.
**Question:** «Кажется мы опять переизобрели велосипед» — is our orchestration contour a parallel implementation of something that already exists upstream?
**Predecessor:** PR #1181 (`docs/mattpocock-comparison`) shipped GLM-authored *raw material* with 7 explicitly-unresolved questions and an honest §8 gap («I did not read mattpocock's actual `SKILL.md` file contents»). This patch closes that gap and issues the verdicts. It supersedes none of #1181's observations; it does not depend on #1181 merging.

---

## §0 Method (what was actually run)

Per [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md) — DeepWiki repo-level inquiry ≥3 phrasings, WebSearch ≥3 phrasings, SSOT consult first, context7 deliberately excluded (wrong tool class for «does a framework exist for problem Y»).

| Layer | What was run | Result |
|---|---|---|
| SSOT consult (first) | grep [prior-art-evaluations.md](../prior-art-evaluations.md) for the capability area | rows #27/#28/#29/#30/#43/#45/#46/#64/#65/#67/#101/#109/#111/#178/#179/#201/#221/#228 already cover most of the contour; `mattpocock` appears **0 times** (`grep -ci mattpocock` → 0) |
| DeepWiki ×3 | `mattpocock/skills`: (1) what is it + full skill inventory + runtime?; (2) how does `wayfinder` orchestrate + autonomy/state/resumption?; (3) mechanical enforcement + design-review + cold reviewers | see §2.1 |
| DeepWiki ×1 | `obra/superpowers`: does it ship design-review / unattended-autonomy / external-runtime dispatch? | see §2.2 |
| WebSearch ×3 | container dispatch + REST task queue; CC orchestrator marketplace; agent-skills alternatives | surfaced `builderz-labs/mission-control`, `block/agent-task-queue`, Tembo, Open SWE, Conductor/Claude Squad class — §2.3 |
| Primary source | `gh api` on both repos; direct reads of shipped `SKILL.md` bodies in the local plugin cache (3 versions) and via `raw.githubusercontent.com` | the decisive evidence in §2.2 came from here, not from any summary |

**Anti-confirmation guard.** The operator's prior is «we reinvented it». Per [ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) T20 and the asymmetric-skepticism rule, a verdict *agreeing* with that prior needs the same evidence bar as one refusing it. Both directions are exercised below: §4.1 refuses the suspicion for the substrate, §4.2 upholds a narrower version of it for two specific claims in our own bodies.

---

## §1 Population enumeration (T10 — enumerate before sampling)

Every artifact in the contour, read live in this worktree at `origin/staging` + the operator-global path. No sampling: the population is small enough to enumerate whole.

| # | Artifact | LOC | What it actually is (evidence) |
|---|---|---|---|
| 1 | [`.claude/skills/arch/SKILL.md`](../../../.claude/skills/arch/SKILL.md) | 84 | Contour choreography. `:30` «A **thin wrapper**: phase 1 is `superpowers:brainstorming` verbatim». Owns §2 (cold two-altitude design review) + §3 (exit routing). `:6` `disable-model-invocation: true` |
| 2 | [`.claude/skills/pipeline/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) | 538 | Plan-currency check → cross-umbrella priority → launch-table → stage-gate dispatch. `:28` BUILD verdict 2026-05-23, R-patch `2026-05-23-meta-orchestrator-prior-art.md`. `:8` `disable-model-invocation: true`, `model: opus` |
| 3 | [`.claude/skills/dispatcher/SKILL.md`](../../../.claude/skills/dispatcher/SKILL.md) | 332 | Execution loop over the aif REST/WS API (dispatch → monitor → Q&A → harvest → stage-gate). SSOT #111, BUILD |
| 4 | [`.claude/skills/night-mode/SKILL.md`](../../../.claude/skills/night-mode/SKILL.md) | 54 | `:11` «The dispatch loop … **is `superpowers:subagent-driven-development` (SDD)**. Use it.» Owns 8 numbered delta items only |
| 5 | [`.claude/skills/aif-doctor/SKILL.md`](../../../.claude/skills/aif-doctor/SKILL.md) | 298 | Read-only diagnosis of the third-party aif runtime + gated mutations. Operator-side ops, not orchestration |
| 6 | `~/.claude/skills/orchestrator/SKILL.md` (operator-global, **not** in this repo) | 492 | General delegation / Mode A-B / Queue mode. Agent-uncommittable; [pipeline/SKILL.md:24](../../../.claude/skills/pipeline/SKILL.md) declares it NOT-authoritative-for and names the 4 gaps `/pipeline` closes |
| 7 | [`packages/runtime-bridge/src/AifHandoffBackend.ts`](../../../packages/runtime-bridge/src/AifHandoffBackend.ts) | 397 | `:1-2` «**adapter for the lee-to/aif-handoff runtime**». `:16-18` documents the exact 2-step REST contract (`POST /tasks` → `PUT /tasks/:id {paused:false}`) against someone else's server |
| 8 | [`packages/runtime-bridge/src/kickoff.ts`](../../../packages/runtime-bridge/src/kickoff.ts) | 98 | Marker parse only — `:29` `BRIDGE_PROFILE_RE`, `:41-50` header-region-bounded `extractProfileHint` |
| 9 | `packages/runtime-bridge/src/cli/{dispatch,await,harvest,park,answer,questions,ensure-parallel,aifHttp,openQuestion}.ts` | 1 680 | CLI verbs over the same third-party API |

**Total contour = 1 306 lines of prose choreography (rows 1-6) + 2 175 lines of TypeScript (rows 7-9), of which 0 lines implement an agent runtime.** Row 7's header is the load-bearing fact for §4: the runtime is `lee-to/aif-handoff`, a third-party Docker+DB Kanban server (SSOT #67). We wrote a typed client for it.

---

## §2 Per-source findings

### §2.1 `mattpocock/skills`

**What it is (primary source, `gh api repos/mattpocock/skills` 2026-07-31):** 196 169 stars, 16 904 forks, MIT, created 2026-02-03, last push 2026-07-29, `default_branch: main`, not archived. Description: «Skills for Real Engineers. Straight from my .agents directory.» Cross-checked via WebFetch of the GitHub page (196.2k / 16.9k — agrees). **This is not a personal-experimental repo; by adoption it is one of the most-starred repos in the ecosystem.** The raw-material patch's §8 speculation («suggests personal, not a framework») is refuted.

**Shape.** `gh api .../contents/skills` → six directories: `engineering` (18 entries), `productivity` (6), plus `deprecated`, `in-progress`, `misc`, `personal`. `.claude-plugin/plugin.json` v1.2.0 registers 22 skills as a Claude Code plugin. DeepWiki (query 1), independently: «The repository itself does not involve a dedicated runtime, daemon, task queue, REST API, or container» — WebFetch of the README agrees («no runtime, server, daemon, or task queue component described»). **Dual-channel + manifest inspection all agree: pure markdown skills.**

**The flow.** `ask-matt` (fetched raw): frontmatter is exactly `name` + `description` + `disable-model-invocation: true`; the body is a decision tree that *tells the user which `/skill` to invoke*. It dispatches nothing. Main chain: `grill-with-docs` → `to-spec` → `to-tickets` → `implement` → `code-review`.

**`wayfinder` (DeepWiki query 2, quoting SKILL.md).** A «shared map» issue labelled `wayfinder:map` with child *decision tickets*; the tracker is the state machine (open/blocked/unclaimed/closed), the «frontier» is the open∧unblocked∧unclaimed set, a session **claims** a ticket by assignee-before-work so concurrent sessions skip it, and «never resolve more than one ticket per session — with the exception of research tickets», which fire `/research` subagents in parallel. Resumption is by re-invoking on the map.

**`handoff` (fetched raw).** Compacts the conversation to a doc in the OS temp dir, deliberately outside the workspace, with suggested-skills + references-by-path + secret redaction. «There's no automated agent dispatch built into this tool» — a human copies it into a fresh session.

**Enforcement (DeepWiki query 3).** No hooks enforcing its own skills; the mechanical artefacts it ships are *setup* skills that wire **the consumer's** repo (`setup-ts-deep-modules` → `dependency-cruiser` boundaries; `git-guardrails-claude-code`; `setup-pre-commit`). Its own conventions are model-read prose. Notably: `code-review` runs its **Standards** and **Spec** axes as *parallel sub-agents* specifically «to prevent context pollution», with findings «aggregated side-by-side without being merged or re-ranked».

### §2.2 `obra/superpowers` — the companion we already wrap

`gh api repos/obra/superpowers`: 263 933 stars, 23 562 forks, MIT, pushed 2026-07-28. Installed cache holds **three** versions: 5.1.0, 6.1.1, 6.2.0 (`ls ~/.claude/plugins/cache/superpowers-dev/superpowers/`).

**(a) Does `/arch` actually thin-wrap `brainstorming`?** Yes, verifiably. `brainstorming/SKILL.md` (6.2.0, 151 lines) owns a 9-step checklist ending at `writing-plans`; `arch/SKILL.md:36-38` invokes it «AS IS» in one paragraph and adds a single sentence (record verdicts with falsifiers). `arch/SKILL.md` never restates the checklist, the process-flow digraph, the HARD-GATE, or the visual-companion protocol. The `source-before-shape.md` failure mode (PR #858) did **not** recur here.

**(b) Does `night-mode` actually thin-layer over SDD?** Structurally yes — 54 lines against SDD's 503, with `:11` explicitly forbidding re-description. **But three of its factual claims about SDD are stale or wrong**, and all three sit inside the paragraphs that justify its deltas:

1. **`night-mode/SKILL.md:15` names a retired roster.** It says the loop dispatches «**two** fresh reviewer subagents (spec-reviewer ≈ top-down / architecture; code-quality-reviewer ≈ bottom-up / code)». That is the 5.1.0 shape (`ls .../5.1.0/skills/subagent-driven-development/` → `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md`). The installed 6.2.0 ships **one** `task-reviewer-prompt.md` (`SKILL.md:57`, `:300`) covering both verdicts (`:259-262` «never accept a report missing either verdict — spec compliance AND task quality»). Upstream `RELEASE-NOTES.md:61`: «The two per-task reviewer prompts became one. `spec-reviewer-prompt.md` and `code-quality-reviewer-prompt.md` are gone… If you dispatch the old files directly, switch to the new one.» SSOT #64's own description carries the same retired roster — correct as an append-only historical record, stale as a live instruction.
2. **`night-mode/SKILL.md:24` mis-states the gap it fills.** Delta item 2 offers a whole-work two-altitude pass «beyond SDD's per-increment review». SDD 6.2.0 has a **Final Review** over the whole branch (`:391-414`), dispatched on the most capable model, fed the ledger's deferred/parked lines. The genuinely-unserved parts of item 2 are the *second altitude* and the *completeness-critic*; «beyond SDD's per-increment review» overstates it, because SDD's per-increment review is not the only thing there.
3. **`night-mode/SKILL.md:24` silently overrides an adopted parameter.** «Cap per-increment rework at ~4 iterations» vs SDD `:320` «Five rounds maximum per task». A layer may override its base — but an unannounced numeric divergence from the adopted loop is exactly the drift `#parallel-evolution-creep` starts as.

**(c) The decisive finding — upstream measured our `/arch` §2 delta and retired it.** `arch/SKILL.md:79` asserts: «verified absent from upstream through v6.1.1: no design-review skill exists there, 2026-07-21». Checked live:

- `ls .../6.1.1/skills/brainstorming/` and `ls .../6.2.0/skills/brainstorming/` **both** contain `spec-document-reviewer-prompt.md`. Its header: «Use this template when dispatching a spec document reviewer subagent. **Purpose:** Verify the spec is complete, consistent, and ready for implementation planning. **Dispatch after:** Spec document is written». `writing-plans` had the twin `plan-document-reviewer-prompt.md` in 6.1.1.
- `grep -rn "spec-document-reviewer" .../6.2.0/skills/` → **no skill body references it.** It is an orphaned artefact; the wiring is gone.
- Why it is gone — upstream `RELEASE-NOTES.md:283-290` (v5.0.6, 2026-03-24), «Inline Self-Review Replaces Subagent Review Loops»: «The subagent review loop (dispatching a fresh agent to review plans/specs) **doubled execution time (~25 min overhead) without measurably improving plan quality. Regression testing across 5 versions with 5 trials each showed identical quality scores** regardless of whether the review loop ran… Self-review catches 3-5 real bugs per run in ~30s instead of ~25 min, with comparable defect rates to the subagent approach.» `brainstorming/SKILL.md:30` + `:120` are the replacement («Spec self-review — quick inline check… No need to re-review — just fix and move on»).

So the negative-existence claim at `arch/SKILL.md:79` is **narrowly true and materially misleading**: no standalone design-review *skill* exists, but a cold spec-review *subagent loop* existed, was A/B-measured, and was deliberately retired — and the artefact still ships. Per [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md), a negative-existence claim owes the 6-item check; a `ls` of the wrapped skill's own directory would have surfaced this.

**(d) What upstream genuinely does not have** (DeepWiki on `obra/superpowers`, corroborated by reading 6.2.0): no unattended/overnight autonomy policy with fork classification or quota backoff — «Superpowers does not currently ship built-in functionality for running fully unattended/overnight»; and no dispatch to an external runtime, container, or non-subagent session with a persistent queue — «the codebase does not indicate support for dispatching work to arbitrary external runtimes, containers, or separate non-subagent sessions with a persistent task queue».

### §2.3 Other prior art the searches surfaced

| Candidate | Evidence | Bearing |
|---|---|---|
| `builderz-labs/mission-control` | `gh api`: 5 884 stars, MIT, created **2026-02-13**, pushed 2026-07-27. «Self-hosted control plane for AI agents: dispatch tasks, review runs, track spend, and operate OpenClaw, Claude Code, Codex, and other runtimes» | **The closest thing found to `/dispatcher`'s problem class**, and it *predates* SSOT #111's 2026-06-03 evaluation without being surfaced by it. Capability depth unverified here → §5 F1 |
| `block/agent-task-queue` | `gh api`: 55 stars, Apache-2.0, pushed 2026-07-29 | Local concurrency queue only; no dispatch/egress/PR gate. Not our class |
| Tembo; Open SWE (LangChain); Conductor / Claude Squad / Emdash class | WebSearch 2026-07-31 | Container-or-worktree-per-agent runtimes. Same class as `lee-to/aif-handoff`, which we already ADOPTED as the substrate — competitors to the runtime, not to our bridge |
| SkillRouter (SSOT #179, REFERENCE) | settled row | Still REFERENCE; ~24 skills is far below its 80K-registry class |
| Multi-agent orchestration literature (SSOT #221, REFERENCE) | settled row | Still REFERENCE; taxonomies, not adoptable engines |

---

## §3 Verdict table

BFR §1 verdicts, per capability, per axis ([build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md) — operator axis = what the maintainer works *with*; shipped axis = what installs into a consumer). T16 line + falsifier per row.

| # | Our capability | Nearest upstream | Operator axis | Shipped axis | T16 problem-class | Falsifier («this verdict is wrong if…») |
|---|---|---|---|---|---|---|
| V1 | `/arch` §1 ideation | `superpowers:brainstorming`; `mattpocock:grill-with-docs`/`grilling` | **ADOPT** (already; `arch:36-38`) | n/a (operator-side skill) | X = turn an idea into an approved spec by dialogue; Y = same. **Match: yes** | `arch/SKILL.md` starts restating the checklist/HARD-GATE instead of invoking it |
| V2 | `/arch` §2 cold two-altitude **design** review | `superpowers` retired spec-document-reviewer loop (v5.0.6); `mattpocock:code-review` 2-axis parallel sub-agents | **KEEP NARROW** (retain, with the divergence argued — not «no upstream exists») | n/a | X(superpowers) = document-hygiene review of a spec by a fresh subagent, A/B-measured as no-gain; X(mattpocock) = 2-axis isolated review of **code**; Y = goal/feasibility **plus** a bottom-up existence-check that the named files/APIs/patterns are real, on an artifact bound for a **paid factory run**. **Match: partial — same mechanism, different object and different cost of a wrong pass** | Our own §2 shows the upstream result: ≥5 contours where the two seats produce no finding that the inline self-review would not have caught. Then §2 is ~25 min of theatre and should collapse to `brainstorming`'s inline self-review + one bottom-up fact-check seat |
| V3 | `/arch` §3 exit routing (tier table, kickoff-vs-in-session) | `mattpocock:ask-matt` (router); none in superpowers | **BUILD** (retain) | n/a | X = tell a human which skill to invoke next; Y = classify a *dispatch tier* and emit a routed artefact (kickoff + `bridge-profile` marker) into a factory. **Match: no — routing a human ≠ routing a metered run** | An upstream router emits a machine-parsed handoff artefact with a model/cost tier attached |
| V4 | `night-mode` inner loop | `superpowers:subagent-driven-development` | **ADOPT** (settled — SSOT #64) | n/a | Settled at #64; not re-adjudicated here | — |
| V5 | `night-mode` overnight delta (fork policy, quota backoff, Workflow economy, standing authorization) | none found | **BUILD** (retain) | n/a | X = n/a — DeepWiki on `obra/superpowers`: «does not currently ship built-in functionality for running fully unattended/overnight». **Genuinely unserved** | Superpowers ships an unattended mode with a fork-classification policy → collapse the delta to a wrapper |
| V6 | `/pipeline` multi-umbrella stage-gating | `mattpocock:wayfinder`; global `orchestrator` | **KEEP NARROW** (settled BUILD, SSOT #67 REJECT of the runtime-as-orchestrator; wayfinder is new evidence that does not overturn it) | n/a | X = resolve *decision* tickets under uncertainty until the route is clear, one per session, tracker as state; Y = verify a plan is current, priority-score umbrellas, and gate stage N+1 on stage N's PR being **merged** (`gh pr list --search is:merged`). **Match: no — charting unknowns ≠ gating known stages on merge state** | `wayfinder` grows a merge-state gate and cross-map priority scoring, or our stage-gate is re-expressible as tracker dependencies without loss |
| V7 | `/dispatcher` cross-boundary loop | `builderz-labs/mission-control` (5.9k★) | **WATCHLIST** — SSOT #111's BUILD stands as a record, but its stated revisit trigger («a new operator-facing agent-control framework covers cross-boundary REST dispatch + git egress + PR gate in a single tool») now has a **named, unevaluated candidate that predates #111** | n/a | X = self-hosted control plane dispatching tasks to several agent runtimes with review/spend tracking; Y = dispatch → monitor → park/answer Q&A → pre-egress fidelity → harvest → PR → stage-gate. **Match: unknown — must not be asserted either way from a description string** | The §5 F1 probe shows mission-control covers dispatch **and** git egress **and** the merge gate → #111 flips toward ADOPT/ADAPT. Or it shows a control *plane* without the harvest/gate half → #111's BUILD is reconfirmed on better evidence |
| V8 | `runtime-bridge` (2 175 LOC) | `lee-to/aif-handoff` (the runtime itself) | **ADOPT the runtime + BUILD the client** | ships (`packages/runtime-bridge`), degrades to `ManualBackend` when absent | X = server-side autonomous Kanban runtime (SSOT #67); Y = a typed client that speaks its REST/WS contract from a CC session. **Match: no — we did not build X, we call it** (`AifHandoffBackend.ts:1-2`) | aif-handoff ships its own CC-native slash-command client → our bridge becomes duplicate surface |
| V9 | Progressive disclosure via `disable-model-invocation` | `mattpocock` uses the same flag as its *primary* mechanism | **already convergent** — ADOPT VOCABULARY, no action | already shipped | X = strip a skill from the model's discovery surface so it costs no context and only a human can call it; Y = identical (`arch/SKILL.md:6`, `pipeline/SKILL.md:8`). **Match: yes — and we arrived at it independently** | — (nothing to change; recorded so a future session does not «discover» it as a gap) |
| V10 | Rule-as-test enforcement layer (hooks, principle tests, CI gates) | neither repo has an equivalent | **BUILD** (settled — the project's goal) | ships | X = both upstreams enforce their own conventions by model-read prose (mattpocock's mechanical skills configure the *consumer's* linters, not its own discipline); Y = every codified rule is an executable artifact failing at the earliest channel. **Match: no** | An upstream skills repo ships gates over its own conventions |

**No blanket verdict is issued.** Three rows retain BUILD, three are ADOPT/already-converged, two are KEEP NARROW, one flips to WATCHLIST, one is settled elsewhere.

---

## §4 The honest answer

### §4.1 No — the substrate is not reinvented, and the evidence is one-sided

The suspicion's strongest form would be «we built our own agent runtime / our own subagent loop / our own brainstorm engine». All three are false against live evidence:

- The **runtime is someone else's**. [`AifHandoffBackend.ts:1-2`](../../../packages/runtime-bridge/src/AifHandoffBackend.ts) — «adapter for the lee-to/aif-handoff runtime»; the docker container, the planner, the worktree-per-task, the state machine are upstream's (SSOT #67/#43/#45/#88). Of 2 175 TypeScript lines, zero implement a runtime.
- The **executor loop is upstream's** — SSOT #64 ADOPT, and [`night-mode/SKILL.md:11`](../../../.claude/skills/night-mode/SKILL.md) refuses to restate it.
- The **ideation loop is upstream's** — [`arch/SKILL.md:36-38`](../../../.claude/skills/arch/SKILL.md), invoked «AS IS».
- The **primary progressive-disclosure mechanism is the same one** the 196k-star repo uses (V9) — convergent, not duplicated.

And the two capabilities we do BUILD are the two both upstreams state they do not have: unattended autonomy (V5) and cross-boundary dispatch-with-git-egress (V7, pending the F1 probe). Against `mattpocock/skills` specifically the overlap is thinner than the surface suggests: it is an **in-session, human-in-the-loop, single-engineer idea→ship flow with the issue tracker as durable state**, with no hooks, no runtime, no unattended mode, and no enforcement of its own conventions. Its `handoff` is a temp-file a human carries; ours is a kickoff a machine dispatches. Different problem class, not a wheel we re-cut.

### §4.2 But yes — in two places our body claims a delta larger than it is

This is the part of the suspicion that survives contact with evidence, and it is narrower and more specific than «we reinvented the contour»:

1. **[`arch/SKILL.md:79`](../../../.claude/skills/arch/SKILL.md) — a negative-existence claim that does not hold up.** «no design-review skill exists there» is defended only by the word *skill*: `spec-document-reviewer-prompt.md` ships in the very directory `/arch` wraps, in both 6.1.1 and 6.2.0, and upstream retired its wiring after an A/B that found «identical quality scores» for ~25 min of overhead (`RELEASE-NOTES.md:283-290`). Our §2 may still be right — its bottom-up seat fact-checks against the codebase, which upstream's document-hygiene reviewer never did, and our downstream cost (a wrong design entering a metered factory run) is not upstream's (a human re-reads a plan). **That argument is defensible and is nowhere written down.** What is written down is a claim that the thing does not exist.
2. **[`night-mode/SKILL.md:15` and `:24`](../../../.claude/skills/night-mode/SKILL.md) — the layer describes a base that has moved.** The two-reviewer roster is 5.1.0's and was explicitly retired (`RELEASE-NOTES.md:61`); the «beyond SDD's per-increment review» framing ignores SDD's whole-branch Final Review (`SDD SKILL.md:391-414`); and the ~4-round cap silently contradicts SDD's five (`SDD SKILL.md:320`). A thin layer whose *stated* justification for existing is a description of the base is only as thin as that description is current.

Neither is `#parallel-evolution-creep` yet — no duplicate mechanism was built. Both are the **precondition** for it: the wrapper no longer knows what the wrapped thing does, which is how a delta quietly grows into a parallel implementation. Recorded here rather than fixed, per the task's scope bound.

### §4.3 The genuinely unserved slice (what justifies what we built)

Neither upstream, nor the control-plane field, offers: **an operator-side session that dispatches a plan-complete artefact into a third-party container runtime, resolves its parked questions over REST, gates its egress on a cold fidelity verdict, harvests it to a PR, and refuses to advance stage N+1 until stage N is merged — unattended.** SSOT #111 established that in 2026-06; §2.3 shows one candidate (`mission-control`) that deserves a real probe before that claim is repeated. Until that probe runs, the honest statement is «unserved as far as we have checked, with one named unevaluated candidate», not «unserved».

---

## §5 Proposed follow-ups (proposals only — nothing implemented here)

Each is scoped so a later session can take it without re-deriving this analysis. Per the Artifact Ownership Contract, none of these were applied in this PR.

- **F1 — probe `builderz-labs/mission-control` against `/dispatcher`'s five verbs.** DeepWiki ≥3 phrasings + a read of its dispatch/egress code: does it (a) dispatch to an external runtime, (b) resolve worker questions bidirectionally, (c) push a branch out of a container, (d) open a PR, (e) gate a next stage on merge state? Outcome updates SSOT #111 (its own trigger already names this). **Highest value of the five** — it is the only open «did we reinvent it?» question left.
- **F2 — correct `night-mode/SKILL.md:15,24` against SDD 6.2.0.** Name the single `task-reviewer-prompt.md`; re-state delta 2 against SDD's Final Review (`:391-414`) so the claimed delta is the *second altitude + completeness-critic*, not «beyond per-increment»; either align the rework cap with SDD's five or state the override and why. Tier 1 (mechanical, ≤1 file).
- **F3 — replace the negative-existence claim at `arch/SKILL.md:79` with the divergence argument.** Cite `spec-document-reviewer-prompt.md` and the v5.0.6 retirement measurement, then state why §2 survives it (bottom-up existence-check; cost asymmetry of a factory run). Strictly better than the current claim under [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md).
- **F4 — consider a staleness trigger for wrapper skills.** Both drift findings share one shape: a thin wrapper describing a base that moved under it, with nothing to notice. A candidate mechanism is a pinned upstream-version marker in wrappers over `superpowers:*` plus a check that the cached plugin version still matches. **Proposal only** — this is a capability commit and would need its own BFR pass; it may well be over-engineering for two findings, and the cheaper answer is re-verification at the next contour run.
- **F5 — no action on `mattpocock/skills` adoption.** Its overlap is either already-converged (V9) or a different problem class (V3, V6). Its `code-review` two-axis isolation is worth citing as convergent-design precedent for `/arch` §2's shape when F3 is written. Adopting the repo as a whole would add a second, differently-opinionated idea→ship flow beside the one we already ADOPTED, which is `#adoption-shame`'s inverse — maintenance surface for no named gap.

SSOT entries **#230, #231, #232** are appended in this same PR per [prior-art-evaluations.md §3](../prior-art-evaluations.md).

---

## §6 §1.7 self-check

### §1.7 Forward-check applied

- [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md): all six layers run — SSOT consult first (18 rows cited by ID), DeepWiki ×4 across 2 repos, WebSearch ×3 phrasings, primary-source `gh api` + raw file reads; context7 correctly excluded. §1.1 two-axis applied per row in §3. ✓
- [`ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md): **T10** — §1 enumerates the whole population (9 artifacts, no sampling) before any finding. **T3** — every claim carries a command or `file:line`; the one inference I made from a `grep -rl` (that 6.2.0 had dropped `spec-document-reviewer-prompt.md`) was **wrong and is corrected in §2.2(c)** by an `ls`, which changed the finding from «upstream deleted it» to «upstream orphaned it». **T12** — upstream state was read from the installed cache and `gh api`, not recalled. **T13** — the ADOPTED items (#64, #65) were re-verified against shipped source, which is how the roster drift surfaced. **T14** — §4.3 reports «unserved as far as we have checked, with one named unevaluated candidate», not «unserved». **T16** — every §3 row carries an explicit X/Y problem-class line. **T20 / asymmetric skepticism** — the operator's prior is *refused* in §4.1 on evidence and *upheld narrowly* in §4.2 on evidence; neither direction is asserted from agreement. ✓
- [`recommendation-laziness-discipline.md §3`](../../../.claude/rules/recommendation-laziness-discipline.md): every §3 row carries a falsifier; §5 items are proposals with owners and scope, not decisions taken. ✓
- [`attention-is-not-a-mechanism.md`](../../../.claude/rules/attention-is-not-a-mechanism.md): F4 is labelled a *proposal needing its own BFR pass*, and this patch does not claim that recording the drift prevents it. ✓
- [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md): markdown only; no gate, no CI LLM call. ✓ [`doc-authority-hierarchy.md §2-§3`](../../../.claude/rules/doc-authority-hierarchy.md): header present. ✓ [`language-discipline.md`](../../../.claude/rules/language-discipline.md): artefact in English. ✓
- Artifact Ownership Contract: no edit to `README.md`, `CLAUDE.md`, `.claude/rules/**`, `.claude/skills/**`, or `~/.claude/skills/**`. `prior-art-evaluations.md` is append-only and this session is a capability-commit-adjacent research session, an owner of that file per the contract. ✓

### §1.7 Backward-check applied

Class of this change = **prior-art evaluation of an own capability**. Sibling surfaces enumerated (`ls docs/meta-factory/research-patches/ | grep -icE "prior-art|comparison"` → 10, this file included; plus a full SSOT row scan), verdicted individually:

- [`research-patches/2026-05-23-meta-orchestrator-prior-art.md`](2026-05-23-meta-orchestrator-prior-art.md) → **SWEPT-CLEAN, not superseded.** It produced the `/pipeline` BUILD and SSOT #67's REJECT; §3 V6 adds `wayfinder` as *new* evidence and reaches the same place (KEEP NARROW), so its verdict stands rather than being overturned.
- SSOT **#111** (`/dispatcher`, BUILD, 2026-06-03) → **GAP FOUND.** Its search missed `builderz-labs/mission-control`, which was created 2026-02-13 — before that evaluation. Action: V7 flips to WATCHLIST, new row #232 records the candidate, F1 scopes the probe. The row itself is not rewritten (append-only).
- SSOT **#64** (SDD, ADOPT, 2026-05-22) → **GAP FOUND (downstream, not in the row).** The row's roster description is a correct historical record; the *live* restatement at `night-mode/SKILL.md:15` is stale. Action: F2, plus row #231 recording the upstream retirement evidence.
- SSOT **#65** (`using-git-worktrees`) → **SWEPT-CLEAN.** The skill still ships in 6.2.0 with the exact Step-0 primitive the row cites — `GIT_DIR != GIT_COMMON` detection plus the submodule guard and the «already in a linked worktree → do NOT create another» skip (`6.2.0/skills/using-git-worktrees/SKILL.md:21,26,33`). The file is *not* byte-identical to 6.1.1 (`diff -q` → differ), so «unchanged» is deliberately not asserted; only the cited primitive was re-verified.
- SSOT **#179** (SkillRouter), **#221** (orchestration literature), **#201** (Advisor tool), **#228** (fidelity gate) → **SWEPT-CLEAN**; each remains correct at its stated scope and none is contradicted by anything found here.
- [`research-patches/2026-07-26-per-role-context-shaping-raw-research.md`](2026-07-26-per-role-context-shaping-raw-research.md) + its 2026-07-27 addendum → **ADJACENT, untouched.** Different question (per-role context payload shaping); a parallel session owns that track this week and this patch deliberately does not enter it.
- PR **#1181**'s raw-material patch → **COMPLEMENTED, not superseded.** It states «no verdict… the build-vs-reuse decision is the fabla's»; this patch supplies the verdicts and closes its §8 gap (actual `SKILL.md` reads). Its §6 observation table survives; its §8 guess that mattpocock's repo is «personal, not a framework» is corrected by §2.1's 196k-star measurement.
- [`.claude/rules/source-before-shape.md`](../../../.claude/rules/source-before-shape.md) → **SWEPT: GAP-ADJACENT.** Its `:20` Origin is literally this failure — «PR #858 shipped `.claude/skills/night-mode/SKILL.md` re-describing the executor + dual-reviewer loop **already owned by Superpowers**». The rule's own failure mode was therefore re-tested against the two wrappers it governs: `/arch` passes; `night-mode` passes the rule as written (it does not re-describe the loop) but fails on the *currency* of its base-description (§4.2). That is a **new variant** of the rule's shape — «restates a base that has since moved» rather than «restates the base at all», which `:64`'s promotion criterion (a mechanically-detectable reinvention signature) does not cover. Recorded here, **not** codified into the rule: `.claude/rules/**` is maintainer-owned under the Artifact Ownership Contract and F4 scopes the question honestly rather than pre-empting it.
- Rule-file sweep for prior claims of authority over «is our contour a reinvention»: `grep -rlE "reinvent|parallel-evolution" .claude/rules/` → **three** files, each checked. [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) `:26,:40,:53,:70` owns the *criteria and the anti-pattern*, not any per-capability adjudication — this patch applies it, does not supersede it. `source-before-shape.md` — above. [`autonomous-loop-continuity.md`](../../../.claude/rules/autonomous-loop-continuity.md) `:124` uses `#parallel-evolution-creep` once, in passing, to justify not building a second waiter — unrelated surface, **SWEPT-CLEAN**. Nothing is superseded.

---

## See also

- [prior-art-evaluations.md](../prior-art-evaluations.md) — rows #64, #65, #67, #101, #111, #179, #201, #221 cited above; #230-#232 appended in this PR.
- [github.com/mattpocock/skills](https://github.com/mattpocock/skills) · [deepwiki.com/mattpocock/skills](https://deepwiki.com/mattpocock/skills)
- [github.com/obra/superpowers](https://github.com/obra/superpowers) — `RELEASE-NOTES.md` v5.0.6 «Inline Self-Review Replaces Subagent Review Loops»; v6.2.0 «The two per-task reviewer prompts became one».
- [github.com/builderz-labs/mission-control](https://github.com/builderz-labs/mission-control) — the F1 probe target.
- PR #1181 — the GLM-authored raw material this patch adjudicates.
