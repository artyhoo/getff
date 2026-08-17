---
name: arch
description: Use when starting the EXTERNAL design contour — turning a raw idea or prep-doc into a reviewed design and a routed handoff. Triggers: /arch, external contour, внешний контур, спроектируй идею, задумка в архитектуру, design contour, arch loop, продумай и спроектируй, идея → kickoff, research contour, research-spec, distillate, исследовательский контур. NOT for reviewing code (/reviewer), dispatching stages (/pipeline), factory runtime questions (aif-doctor), or a bare brainstorm with no handoff (superpowers:brainstorming).
arguments: [topic-or-prep-doc]
argument-hint: '<topic | path/to/prep-doc.md>'
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - Write
  - Edit
  - Skill
  - Bash(git *)
  - Bash(gh *)
  - Bash(ls *)
  - Bash(cat *)
---

> **Class:** C — prose workflow choreography; every load-bearing gate it routes through is owned (and where applicable mechanically enforced) elsewhere: kickoff traps → principle 12; kickoff placement → [kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md); tier criteria → [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md). Promotion trigger: ≥2 incidents in 6 months where a phase was silently skipped and a design flaw reached the factory → add a deterministic phase-artifact check.
> **Fires:** operator starts a design contour for a nontrivial idea (`/arch <topic|prep-doc>`).
> **Authoritative for:** the external-contour choreography ONLY — §0 seat, §1 phase order, §1.5 research contour + membrane/K-pass, §2 the cold two-altitude design-review pass (named cold definition + unique-filenames dispatch contract + the changelog disposition vocabulary), §3 exit routing + kill channels + the exit-chip carve-out for `bridge: auto`, §4 escalation intake.
> **NOT authoritative for:** the ideation loop itself — `superpowers:brainstorming` (ADOPT, wrapped, never re-described); reviewer ROLE discipline (surface, never decide) — [reviewer-discipline.md](../../rules/reviewer-discipline.md); tier criteria — [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md); tier→model instantiation — [night-mode/SKILL.md](../night-mode/SKILL.md) («Overnight model posture» paragraph, relative tiers); dispatch mechanics — [pipeline/SKILL.md](../pipeline/SKILL.md) + `packages/runtime-bridge`. Project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
>
> **Deliberate frontmatter deviation:** sibling command-skills pin `model: opus`; this skill deliberately omits `model:` — the contour is defined to run in the operator's TOP-tier session (whatever fills that seat today; a pinned `opus` would down-shift a stronger-model session). The seat is chosen by the operator at session start, not by frontmatter.

# /arch — external design contour (idea → reviewed design → routed handoff)

A **thin wrapper**: phase 1 is `superpowers:brainstorming` verbatim; this skill owns only what no upstream piece covers — an optional research contour before ideation (§1.5), the cold two-altitude review of the _design itself_ (§2), and the routed handoff out of the contour (§3). If you catch yourself re-describing the brainstorm loop, the reviewer protocol, or SDD here, stop — that is `#parallel-evolution-creep`.

## §0 Invocation & seat

`/arch <topic>` or `/arch <path/to/prep-doc.md>`. Run in a **top-tier session** (relative tiers per [night-mode/SKILL.md](../night-mode/SKILL.md), «Overnight model posture» paragraph — the window slides to the active harness's model set). The operator is a thinking partner, not a ticket author: explore intent before proposing (brainstorming's own discipline).

## §1 Phase 1 — ideate + design (pure reuse)

Invoke `superpowers:brainstorming` AS IS: intent → clarifying questions → 2-3 approaches with trade-offs → design presented section-by-section → spec written and self-reviewed. Its user-review gate stands. Additionally, when the dialogue closes real forks with verdicts, record them with per-verdict falsifiers (H1 discipline) — as a research-patch decision record when the design closes a coverage gap (that folder's charter; established decision-record practice), otherwise inside the spec itself.

**Spec-format slot (P12, trio §A2 G1) — operator-axis ADOPT of the upstream `engineering:architecture` ADR template** ([spec D3 item (d)](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md); [research-patch §A2](../../../docs/meta-factory/research-patches/2026-08-02-knowledge-work-plugins-utility.md)). When that plugin is installed (`claude plugin install engineering@knowledge-work-plugins`), the spec produced by §1's brainstorming flow wraps its ADR template (Context / Decision / Status / Consequences); otherwise the same shape is hand-authored. Thin-wrapper only — the template body lives upstream, never re-described here (T16, `#parallel-evolution-creep`).

**Spec-template obligation (2026-08-10, [advisor-pattern-design §7/§8](../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)):** every spec this contour produces carries an **operator-premise register** (verbatim-faithful = faithful to MEANING in context, never a naked transcript; transfer by copy-or-pointer, never paraphrase) and **per-decision falsifiers**. The register is the layer the recorded-premise test stands on ([reviewer-discipline.md](../../rules/reviewer-discipline.md)): spec ≠ recorded idea — both required. **Live decision register (2026-08-17, operator-ratified D4):** the spec additionally carries a table `Decision | Status (answered / operator-fork) | Resolution | Falsifier`, grown **during** §1's dialogue as decisions settle — never reconstructed at close (T10: the population precedes the conclusions); the per-decision falsifiers above are its `Falsifier` column, and the §2 cold seats verify it as artifact content.

**Frontier pacing (ADOPT of mattpocock `grill-me`→`grilling`, [SSOT #253](../../../docs/meta-factory/prior-art-evaluations.md); lifted from ADAPT 2026-08-17, operator-ratified D1-D3).** The questioning phases of §1 are paced by the companion skill `grilling` (`mattpocock-skills` plugin, MIT, version-pinned at install) — invoke it AS IS and read the mechanic from the upstream skill text (design tree → frontier → batched rounds each with a recommended answer → recompute → empty-frontier stop), **never from a paraphrase here**: a 2026-08-17 cold review measured the paraphrase channel losing the non-blocking probe rule. When the plugin is absent, say so explicitly and fall back to batching prerequisite-settled questions per round + enumerate-before-done — never silently revert to one-per-message. This contour owns only the bindings no upstream piece covers: (a) **collision** — brainstorming's «Only one question per message» yields to grilling's rounds for prerequisite-settled questions; mutually-dependent questions stay serial; brainstorming keeps everything else (approaches, design, spec, its user gate — which also carries grilling's «do not act until confirmed»). (b) **facts** — grilling's dispatch-a-sub-agent rule lands on this repo's probes (T20; §1.5 when the research contour is live); per upstream, a running probe is an unsettled prerequisite — only its downstream questions wait, the rest of the frontier is asked now. (c) **round carrier** — a frontier that fits (≤4 questions, choice-shaped) rides `AskUserQuestion` with the recommendation as the first option; longer or prose-shaped questions use upstream's numbered `❓ Qn / ➡️` format. (d) **the tree surface** — the spec's live decision register (above) is where settled decisions land at settle time; the dialogue closes only when no row lacks a `Status` — «nothing left silently assumed» is T10 applied to the decision population, checkable by the §2 cold seats.

## §1.5 Research contour — idea → distillate BEFORE design (delta #0)

When the idea touches a **new capability**, an **unfamiliar domain**, or needs a **BFR verdict**, run a research contour before §1's ideation. Tier-0/Tier-1 work (per [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md)) skips this contour **explicitly** — one line in the artefact saying so, never silently.

**Seats as relative tiers, never model names** (handoff decision 2; same posture as [night-mode/SKILL.md](../night-mode/SKILL.md) «Overnight model posture», the tier→model instantiation SSOT — point at it, do not restate it).

### 1. Research-spec template (verifier seat authors BEFORE dispatch)

Two fields are REQUIRED and the template says so:

- **pre-mortem paragraph** — «what would have to be true for this idea to fail»
- **acceptance-criteria line** — «what test would prove this idea wrong»

Both before any code exists.

### 2. Execution + freshness bar (binding)

The research runs on the executor tier in aif. **Freshness bar:** every source dated, freshest first; no stale source enters the distillate without fresh confirmation.

### 3. Distillation + idea verdict

The verifier seat **spot-checks sources** (not curation only), distills, carries a «current as of `<date>`» line, and issues `GO | rework | kill`. Killed ideas land in the prior-art SSOT ([docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md)) with their reasons.

### 4. Membrane + K-pass + bounded drill-down (ADR-4)

The ideation seat consumes distillates; the executor seat consumes specs/kickoffs; the verifier seat sees both directions. This is a **default with bounded recourse, not epistemic isolation** — state it explicitly, because the earlier framing implied isolation.

**K-pass station.** A K1/K2 pass (anchors exist as claimed · quoted outputs reproduce) runs **on each distillate before it is consumed**, by a seat **cold for that distillate** (cold as defined in §2), so the distiller's defects die at the distiller's channel. Evidence: a verifier seat shipped two non-reproducing quotes inside a confirmed-findings cold review. On failure the distillate goes back to the distiller (rework); **2+ consecutive rework rounds → surface to the operator**.

**Drill-down, bounded and symmetric** for both consuming seats: first choice is «ask the producing seat to re-verify claim X» (one round-trip, membrane intact); direct opening of a cited source is capped at **≤3 per artifact**; **every** drill-down is recorded IN the resulting artifact, naming the claim and what changed. The next verification look (critique or acceptance) treats an **unrecorded** drill-down as a finding — without a named consumer this is `#warning-nobody-reads` ([attention-is-not-a-mechanism.md §2](../../rules/attention-is-not-a-mechanism.md)).

**Scope** stays cited-sources-only; browsing stays blocked.

## §2 Phase 2 — cold two-altitude design review (delta #1)

Dispatch **two read-only subagents** (Agent tool), each handed ONLY artifact paths (spec / decision record / kickoff draft) — never chat context. **Cold, defined once and used everywhere:** a seat is cold when it **did not author the artifact AND did not receive the authoring context** — artifact paths only. The reviewer that never saw the dialogue cannot inherit its blind spots (Phase -1 cold-review precedent, [CLAUDE.md «Meta-orchestrator self-review obligation»](../../../CLAUDE.md)). This same definition gates §1.5's K-pass and §3's exit; it is stated once here and referenced, not re-stated per section.

The two seats are altitudes, not tiers — tiers are assigned once, in the seat-instantiation paragraph below, so that the two statements cannot drift apart:

- **Top-down** — question: does the design serve the stated goal; is it feasible; are the architectural choices sound; what did the authors not consider?
- **Bottom-up** — question: do the named files/APIs/patterns actually exist as claimed; does this assemble from the real bricks; which claims lack file:line evidence?

The two reports are presented side by side, **never merged or reranked into one list** — one altitude must not mask the other (adopted from mattpocock `code-review`'s two-axis rule, [SSOT #253](../../../docs/meta-factory/prior-art-evaluations.md) plugin sweep 2026-08-17); each seat's verdict stands on its own axis.

**Unique-filenames dispatch contract (handoff decision 13).** When two or more subagents are dispatched in parallel and share one scratchpad directory, each dispatch prompt names a **unique output filename** (e.g. `<seat>-<topic>.md`), assigned by the dispatching session, never chosen by the subagent — e.g. `top-down-<topic>.md` and `bottom-up-<topic>.md` for the two §2 seats.

**Seat instantiation — operator model ladder (fixed 2026-07-23). Relative tiers, not hard-coded model names** (same posture as [night-mode/SKILL.md](../night-mode/SKILL.md) «Overnight model posture» — the window slides to whatever the active harness offers): the contour runs a three-role ladder — _top tier designs · mid tier verifies · executor tier builds_. When the authoring session itself occupies the top tier, BOTH §2 review seats default to the **mid tier** (Claude today: Fable authors → Opus reviews; on a harness without a third tier the seats collapse to a fresh-context same-tier second opinion, per night-mode's degradation rule). Rationale: a cold review's power is cold-by-construction (artifact-only input, no authoring dialogue), not the reviewer's tier — and top-tier tokens are not spent on volume verification. The **executor tier** side of the ladder is owned by [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md), not this skill. The operator may explicitly request a top-tier review seat for an unusually hard design.

Both report in the **verdict grammar this skill's dispatch prompts specify** (owned here — it is the prompt contract, not a protocol restatement): `VERDICT: GO | REVISE | STOP`, findings graded `BLOCKER | MAJOR | MINOR | ESCALATED`, each with file:line evidence. **Severity contract ([advisor-pattern-design §6](../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)):** a round-triggering finding additionally carries a `Failure-scenario:` line (concrete failure / goal-impact); scenario-less findings live in the notes lane (fixed same-round or recorded — never a new round). A finding standing on an UNRECORDED value premise is graded `ESCALATED` and routed to the concept holder, never priced by the reviewer.

**Changelog disposition vocabulary ([triage-kernel-v2 §7 / D-K6](../../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md)).** When a round's findings are written up in a spec changelog, each one carries exactly one disposition from `ACCEPTED | DISSOLVED | ESCALATED | FIXED` — `ACCEPTED` granted as valid, with the clause after it naming how it was absorbed (amended here, recorded as a known limit, or routed onward); `FIXED` the narrower in-place case, repaired in this round's commit; `DISSOLVED` no longer applies because a premise moved, so neither repaired nor rejected; `ESCALATED` handed unpriced to the concept holder and closed only by their answer (the §4 return edge). `ACCEPTED` and `FIXED` are two registers for the same slot, not disjoint categories — measured over the 66 specs under `docs/superpowers/specs/`, no changelog mixes them in its per-finding rows ([session-bus-v2](../../../docs/superpowers/specs/2026-08-09-session-bus-v2.md) §14 and [autonomous-night-v3](../../../docs/superpowers/specs/2026-08-09-autonomous-night-v3-design.md) §13 use `ACCEPTED` throughout and `FIXED` never; [advisor-pattern-design](../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md) §11 the reverse) — so read `FIXED` as a sharpening of `ACCEPTED`, and do not re-label an existing changelog to mix them. This is the **after-image** of the verdict grammar above, not a second grade set: a finding keeps its `BLOCKER | MAJOR | MINOR | ESCALATED` grade and additionally gains a disposition once the round closes. Namespace note ([advisor-pattern-design §6](../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)): the identically-spelled task-status in orchestrator-prompt state legends is a different namespace and is not renamed.

<!-- effort-worthiness embed (spec-of: .claude/rules/effort-worthiness.md) -->

**Effort-worthiness** ([effort-worthiness.md](../../rules/effort-worthiness.md)): practice-first default — a demand for a probe/extra round states what-breaks-if-wrong and what learning-in-practice costs; zero-finding reviews are legitimate. The operator's global `/reviewer` command carries this same grammar (hand-applied 2026-08-10), and in-repo `/reviewer` invocations load the project skill [.claude/skills/reviewer/SKILL.md](../reviewer/SKILL.md) (skill precedence over the same-named command), which binds the §6 contract directly. Reviewer ROLE discipline — surface findings and forks, never decide strategy — is owned by [reviewer-discipline.md](../../rules/reviewer-discipline.md); dispatch prompts point there for role bounds. Iterate design → review to GO; cap **2** REVISE rounds, then surface the disagreement to the operator as a genuine fork (park-vs-proceed spirit).

## §3 Phase 3 — exit routing (delta #2)

**Kill channels, enumerated with their cost ordering.** An idea can die at: the research-spec (pre-mortem) → the distillate (idea verdict) → the critique (REVISE/STOP) → acceptance. Each cheaper than the next. The last two are judged by a seat **cold as defined in §2**; the distillate verdict is not — §1.5 step 3 has the verifier seat distil _and_ rule on its own distillate, which is exactly why §1.5 step 4 puts a **cold** K-pass over that artifact before anything consumes it. The contour's job is to make the cheap deaths _reachable_ — the project's «fails at the earliest reachable channel» thesis ([README.md#why-this-exists](../../../README.md#why-this-exists)) applied to ideas.

Two decisions, in order — this is the contour's boundary:

**Decision 1 — factory or in-session?** A senior judgment this skill owns (it is NOT part of the CLAUDE.md tier table, which governs only the factory path). Factory is the **default** for bulky work. Keep it in-session when the work needs the operator in the loop as it unfolds (discipline-bearing authoring, live design iteration), touches surfaces the factory cannot write (agent-uncommittable globals), or the contour itself produced it small enough to finish here.

**Decision 2 — route:**

<!-- prettier-ignore -->
| Path                              | Route                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| factory-bound                     | classify per [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) and author the kickoff (traps per principle 12). A kickoff that passed this contour's §2 review carries the `<!-- bridge-profile: <executor-profile-name> -->` marker REGARDLESS of tier — the design judgment was spent here — PROVIDED it is plan-complete: it encodes the decomposition-relevant decisions AND every descope from the dialogue (the fidelity auditor's sole truth — spec D1/D2). Not plan-complete → no marker (top tier plans in aif). Marker value = the UNIQUE profile display name. The always-marker exception is ACTIVE only while the `fidelity-verdict-in-pr-body` required check is registered in staging branch protection (fail-closed precondition — spec D1/D3); before registration, dispatch without the marker → merge to **staging** ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)) → multi-stage umbrella → [/pipeline](../pipeline/SKILL.md); single task → `<!-- bridge: auto -->` first line (runtime-bridge dispatches it) |
| in-session                        | continue the native superpowers tail: `writing-plans` → `subagent-driven-development`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| tiny (Tier 0, ≤~5 lines / 1 file) | just make the edit; no artifacts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Dispatch chips at the exit (ADR D1/D2, stage S1 — the contract is owned by [pipeline `references/output-format.md §9`](../pipeline/references/output-format.md), never restated here).** When `spawn_task` is invocable in this session, emit one chip per routed next action from the table above, ALONGSIDE the written handoff — **except** the single-task `bridge: auto` row: the write-time hook [`runtime-bridge-dispatch.sh`](../../hooks/runtime-bridge-dispatch.sh) already dispatches that kickoff, so a chip there is a second dispatch path for the same task. Each chip prompt carries the same four steps — `Isolation first` → `In-flight probe` → `Stage-gate at click time` → cwd + artefact path — and is rendered in full next to the chip. Chips are additive and ephemeral; the routed artefact (kickoff on staging, or the in-session plan) stays the durable record.

## §4 Escalation intake (the contour's return edge)

Factory tasks park questions (runtime-bridge `park`/`answer`). Sweep them in batch from a top-tier session («office hours»): in-scope architecture questions → the senior-executor seat answers; intent/goal/creative questions — and anything the senior seat is unsure about — → the top seat. Route by question class, not by a fixed hop chain. **Review-`ESCALATED` intake (2026-08-10):** findings graded `ESCALATED` by any §2 review seat (unrecorded value premise) arrive on this same edge — they route to the concept holder (the advisor seat, [advisor-pattern-design §3/§6](../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)); floored objects go to the operator with a pre-built decision package.

## Seat lifecycle

Registry-role seat sessions (birth · work · self-cleaning · retirement) follow ONE protocol —
[.claude/rules/seat-lifecycle.md](../../rules/seat-lifecycle.md) (SLP): each phase binds a
settled owner (ADR D6/D7/D8, session-bus v2, night-mode); bus-touching steps are
Part-II-gated. Never restate it here (`#fifth-description-of-the-loop`).

## Without this skill

Each contour is re-improvised: the operator manually switches models per phase (6× `/model` in the origin session, 2026-07-21) and re-asks «how do I start this»; the design itself gets no cold review at either altitude, so plausible-but-wrong designs reach the factory where rework is most expensive; and the handoff decision (kickoff vs in-session) is re-derived from memory against no criteria — the exact re-invention the task-tier table was written to end.

## With this skill

One entry point runs the whole contour in one top-tier session: brainstorming unchanged, then two cold reviewers at fixed altitudes gate the design before any implementation spend, then the exit is routed by the recorded tier criteria — the handoff artifact (kickoff on staging, or an in-session plan) lands exactly where the next contour expects it, and parked factory questions flow back to the right seat in batch.

## See also

- `superpowers:brainstorming` — the wrapped phase-1 engine (ADOPT; its spec self-review + user gate stand unchanged). Upstream's capability: brainstorming **ships** an author-side spec-document reviewer prompt, and its own flow leaves the spec pass as a self-review rather than dispatching that prompt. Our delta: two cold seats at fixed altitudes with a verdict grammar and a routed exit.
- [reviewer-discipline.md](../../rules/reviewer-discipline.md) — reviewer ROLE discipline both §2 seats point to (surface, never decide).
- [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) — the §3 factory-path classification criteria (fixed, judgment-applied).
- [pipeline/SKILL.md](../pipeline/SKILL.md) — the internal-contour entry `/arch` hands umbrellas to.
- [night-mode/SKILL.md](../night-mode/SKILL.md) — relative-tier posture, «Overnight model posture» paragraph (tier→model instantiation SSOT).
- `packages/runtime-bridge` — `bridge: auto` + `bridge-profile` markers (kickoff.ts), park/answer CLI.
