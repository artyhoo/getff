<!-- scope:per-role-digest-fork-host -->

# Research patch — per-role ambient digest fork (host)

> **Authoritative for:** the tradeoff space around shaping the session-bootstrap ambient digest by role (operator H1/H2/H3 mapping, current-state measurement, four design shapes, anti-drift re-examination). A **recommendation-FREE fork** — this patch gives the tradeoff space, not a pick.
> **NOT authoritative for:** the project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The choice between shapes α/β/γ/δ is the operator's, via `/arch §1` from a clean sheet. Anti-drift verdicts — see [opus-cold-verify §4.1](2026-07-31-per-role-context-opus-cold-verify.md). Token-cost baseline — see [S-A profile](2026-08-01-token-economy-s-a-profile.md).
> **Scope marker:** host-side evaluation of a design fork. Zero build, zero file edits outside this patch. Read-only over the aif-handoff source. Not a design decision (contract K6 — self-consistency with non-goals).

## Operator verbatim (binding — the hypothesis under evaluation)

> «ambient-дайджест одинаковый для всех — кажется это было давно и с тех пор все поменялось. Каждой роли и задачи нужен свой ambient-дайджест — может только когда идею формируем нужно про концепцию проекта главную напоминать.»

Decomposed into three sub-hypotheses:
- **H1** — uniform digest is a stale state («с тех пор всё поменялось»).
- **H2** — each role/task needs its own ambient digest.
- **H3** — exception: when forming an idea, the main project concept must always be reminded.

This patch maps each sub-hypothesis to the live code, measures the cost of uniformity, lays out four shapes, and re-examines anti-drift. It does **not** pick.

---

## §A1 Current state — uniform confirmed, runtime partial role-shaping elsewhere

### What is uniform (the digest the operator named)

The session-bootstrap digest injected at every prompt is a **single static heredoc** with **zero role branching**:

- `inject-session-bootstrap.sh:25-33` — `read -r -d '' DIGEST <<'DIGEST' … DIGEST`. One block: goal line + 4 invariants + read-order + H1 recommendation-discipline line + flowchart pointer. The only conditionals inside the script are **`AIF_HOOK_LANG`** (`:38-46`, output-language pinning) and **`AIF_AUTONOMOUS`** (`:63-65`, opt-in autonomy block). No third branch exists.
- `inject-subagent-digest.sh:22` — `DIGEST="$(bash "$HOOK_DIR/inject-session-bootstrap.sh" 2>/dev/null || true)"`. The SubagentStart hook **reuses the UserPromptSubmit digest verbatim** — comment at `:20-21`: «Single source of truth for the digest text: reuse the UserPromptSubmit digest verbatim (one logic, two channels)». **No `subagent_type` / `agent_type` branch.**

### Empirical proof — uniform confirmed by measurement (not source-code inference)

Runtime-probe `f164e807` (Claude Code 2.1.218, CC runtime with `ZCODE_PROJECT_DIR` unset), captured three subagent dispatches and measured the actual injected payload:

> **P1 — `inject-subagent-digest.sh` emits identical `additionalContext` regardless of `subagent_type`.** Three subagent dispatches (`general-purpose`, `Explore`, `Plan`) all received byte-identical digest payload. SHA256 of captured payload from each subagent's verbatim echo: `4bdebe5884cf09ead081341837063a6ad69084f09268805b03828a234704b72e` for all three. Payload = 1539 bytes (= 1500-byte heredoc body + 39-byte CC prefix). **CONFIRMED** — `diff A B` and `diff A C` empty; `sha256sum` byte-equality across all three.
> — `docs/superpowers/specs/2026-07-27-per-role-context-bundle-for-opus.md:88`; source `per-role-context-runtime-probe-report.md:24` (`general-purpose`/`Explore`/`Plan`; `ui-designer-react` was unregistered and substituted with `Plan` — substance preserved).

The probe's own verdict rollup (`runtime-probe-report.md:85-86`): «the digest injection layer is **provably role-agnostic by construction**» and «no evidence of any per-role context differentiation mechanism anywhere in the inspected surface area.»

**Two injection channels, one uniform payload.** Note the byte-count distinction flagged by the S-A profile (§A3): the SubagentStart payload measured by the probe is **1539 B**, while the per-prompt session-bootstrap injection on host measured **1760 B** (2026-08-01) — different channels, different dates. Both are uniform across roles.

### What is already role-shaped (not uniform — operator H1 is half-right)

Role differentiation **exists**, but it lives in the aif-handoff **runtime**, not in the digest hook. It is keyed on `profileMode` and on per-stage `systemPromptAppend`, neither of which touches the digest.

- **`profileMode` enum (3 values).** `subagentQuery.ts:343` — `profileMode?: "task" | "plan" | "review"`. Default `:546` — `options.profileMode ?? "task"`. Only `"review"` changes runtime behavior: `subagentQuery.ts:681-684` auto-appends `REVIEW_DIFF_SCOPE_SYSTEM_APPEND` regardless of agent-definition file. Comment `:678-680`: «Review-stage subagents must only audit the current task's diff… Inject the scope rule here so every review-mode query gets it regardless of the agent definition file.»
- **Per-stage `systemPromptAppend`.** Each of the 6 runtime stages passes its own inline scope constraint; `PROJECT_SCOPE_SYSTEM_APPEND` (`constants.ts:5-8`) is the fallback when a caller omits the override (`subagentQuery.ts:523`). `REVIEW_DIFF_SCOPE_SYSTEM_APPEND` (`constants.ts:15-21`) is the review-only addition.
- **6 runtime stages + 1 auxiliary** (T7 enumeration from the mechanism, `coordinator.ts:81-124` `PIPELINE` array): plan (`planner.ts`, profileMode `plan`), improve (`improver.ts`, `plan`), plan-check (`planChecker.ts`, `plan`), implement (`implementer.ts`, `task`), verify (`verifier.ts`, `review`), review (`reviewer.ts` → two sidecars code+security, `review`), plus auxiliary implement-checklist-sync (`task`).

**Verdict on H1 «поменялось»: part-right, part-wrong.** Half-right: the aif runtime does per-role shaping through `profileMode` + per-stage `systemPromptAppend` (a layer the operator may be thinking of). Part-wrong: **the ambient digest itself — the specific artifact the operator named — is still uniform**, byte-identical across all roles by construction and by measurement. The runtime layer and the digest layer are different mechanisms on different channels.

### Negative-existence: per-role precedent in SSOT — NONE

6-term sweep over the full `prior-art-evaluations.md` (`per-role|per-subagent|role-specific|ambient digest|context injection|per-agent-type|per-subagent-type`) → **exit 1, no matches**. Nearest anchors:
- **#108** (`prior-art-evaluations.md:180`) — Claude Code `SubagentStart` digest-injection. Verdict **ADOPT**. Role-agnostic: «inject digest into juniors at spawn». The closest existing SSOT anchor for this patch, but it has **no per-role dimension**.
- **#64** (`prior-art-evaluations.md:136`) — Superpowers `subagent-driven-development`. Verdict **ADOPT** (inner loop). Roles (implementer / spec-reviewer / code-quality-reviewer) differ by **task phase**, not by differentiated ambient context.

A per-role ambient-digest design is a **first-of-kind SSOT entry** on this dimension.

---

## §A2 Operator H1/H2/H3 mapping (per sub-hypothesis)

### H1 «поменяялось» — PART-RIGHT

See §A1. Half-right (aif runtime per-role via `profileMode` + `REVIEW_DIFF_SCOPE`), part-wrong (the named artifact — the digest — is still uniform, SHA-proof `4bdebe58…`). The blocker that *previously* defended uniformity (C10 «uniform = anti-drift») was refuted on 2026-07-31 (§A5) — so H1's framing that uniformity is «stale» is now consistent with the evidence: there is no longer an evidenced reason to keep the digest uniform.

### H2 «каждой роли свой digest» — OPEN, no evidenced blocker

Enumerated role classes that today receive the **uniform digest** (T7 — from the mechanism, not from the head):

| # | Role class | Where the digest lands | Mechanism that already shapes this role | Does uniform digest visibly waste/distract? |
|---|---|---|---|---|
| 1 | Operator main session | `UserPromptSubmit` every prompt (`inject-session-bootstrap.sh:67`) | `AIF_HOOK_LANG` / `AIF_AUTONOMOUS` only | Likely high-relevance — this is the seat that *needs* the H1 recommendation discipline + read-order |
| 2 | aif coordinator (host CC session driving the pipeline) | `UserPromptSubmit` | runtime `profileMode` is set downstream on subagents, not here | Mixed — coordinator dispatches all stages |
| 3 | aif subagent — `plan` (planner/improver/plan-checker) | `SubagentStart` verbatim reuse (`inject-subagent-digest.sh:22`) | runtime `profileMode:plan` + per-stage `systemPromptAppend` | The 4 invariants + H1 line are methodology-framing; a planner arguably benefits, but it has its own scope constraint already |
| 4 | aif subagent — `task` (implementer, checklist-sync) | `SubagentStart` verbatim | runtime `profileMode:task` + `PROJECT_SCOPE_SYSTEM_APPEND` | Same — execution role; digest's anti-drift lines (per §A5) are not load-bearing here |
| 5 | aif subagent — `review` (reviewer, security-sidecar, verifier) | `SubagentStart` verbatim | runtime `profileMode:review` + `REVIEW_DIFF_SCOPE_SYSTEM_APPEND` | Reviewer reads diff-scope in its system prompt; the digest's read-order + H1 lines are adjacent but not redundant |
| 6 | CC-native subagent types (`general-purpose`/`Explore`/`Plan` and custom agents) | `SubagentStart` (CC matcher on `agent_type`) | agent-definition file system prompt | The probe (`4bdebe58…`) proved these get byte-identical digest; whether an `Explore` agent needs the H1 recommendation-discipline line is **INCONCLUSIVE without host trial** |
| 7 | Night-mode autonomous orchestrator | `UserPromptSubmit` with `AIF_AUTONOMOUS=1` | autonomy block appended (`:63-65`) | Already shaped — this is the one role that *does* get a distinct digest block today |

**Where uniformity plausibly costs tokens without buying relevance:** rows 3–6. A worker/review subagent's first content in context is a 1760-B block whose goal-redefinition-prevention job (§A5) is already held by doc-authority mechanisms the subagent never bypasses. But "plausibly" is not "measured" — per-role relevance is **INCONCLUSIVE without a host trial** (no transcript instrumentation in this patch's scope; see §A6 falsifier).

### H3 «идею формируем → концепция нужна» — OPEN, requires a marker that does not exist

The operator's exception (idea-formation always needs the main concept) presupposes a mechanism to *tell* the digest hook that the current session is doing idea-formation. **No such mechanism exists today.**

- The digest hook's complete conditional surface is `AIF_HOOK_LANG` + `AIF_AUTONOMOUS` (`inject-session-bootstrap.sh:38-65`). A 10-candidate grep (`AIF_SESSION|AIF_PHASE|AIF_TIER|AIF_CONTOUR|AIF_ARCH|AIF_BRAINSTORM|AIF_IDEA|SESSION_TYPE|SESSION_PHASE`) across `.claude/hooks/` → **zero hits**.
- `/arch` (`.zcode/skills/arch/SKILL.md`) is `disable-model-invocation: true` — operator-invoked; its §1 (idea-formation = `superpowers:brainstorming`) and §1.5 (research contour) live **inside the skill body** and never reach the hook layer. No skill-load signal propagates to `UserPromptSubmit` (`.claude/settings.json:60-78` — `UserPromptSubmit` has no skill matcher; no hook reads `tool_input` for a skill name).
- CLAUDE.md "Task-tier routing" (`:110-124`) classifies *pieces of work* (Tier 0/1/2) for factory dispatch at `/arch` §3 exit-routing — a per-task judgment recorded in an artifact, **not** a session-mode flag.

**Implication for H3:** to test "idea-formation always needs the concept" you would first have to *add* a signal (e.g. an `AIF_CONTOUR=idea` env var set by `/arch`, or a `PreToolUse` matcher on skill-load) so the digest hook can branch on it. None exists. H3 is therefore **open but blocked on a missing prerequisite** — any shape that implements H3 (δ, below) inherits this prerequisite as a work item.

---

## §A3 Cost of uniformity — measured baseline + per-role relevance estimate

### Measured baseline (S-A profile, `2026-08-01-token-economy-s-a-profile.md` on staging)

| Metric | Value | Citation |
|---|---|---|
| Per-prompt digest size (host) | **1760 B** | S-A `§A1.1:61`, `§A2.8:267-268` |
| Est. tokens (4 B/t binding) | **440 tokens** | S-A `:15`, `:61` |
| Per-prompt multiplicity | **213× (explicit UPPER bound — median assistant-turn count)** | S-A `:273-276`, `:285` |
| Cost-units (median session) | **93,720** | S-A `§A3:285` |
| Share of always-on | **12.4%** (rank **3** by cost-units, up from byte-rank 11) | S-A `:285`, `:307-310` |

The S-A profile explicitly ranks the digest **#3 by cost-units** precisely because of per-prompt multiplicity (`:307-310`): «ranking by file size would have misplaced the digest and dropped a 12.4%-cost artefact to 'negligible'.»

### What S-A could and could not answer

S-A **could** measure the aggregate always-on cost rank. S-A **could not** (explicit `INCONCLUSIVE`) determine whether the digest enters the prompt cache or is billed fresh each turn (`§A7:503-505`, `§A8:527-530`) — that single unknown can move the true cost ~10× lower if the digest is cache-hit (distillate L4: «If the digest is cache-hit rather than billed fresh, the real cost is ~10× lower and this drops below L6»). S-A **does not address** per-role relevance at all — the distillate (`:114`) explicitly descopes per-role bundle shaping as a sibling concern.

### Per-role relevance estimate (this patch — by role-class, INCONCLUSIVE without host trial)

The 1760-B digest is 7 content lines: (1) goal, (2) 4 invariants, (3) read-order, (4) H1 recommendation discipline, (5) flowchart pointer. A relevance estimate *by role-class* (not a measurement — a structural inference from what each role does):

| Role class | Lines plausibly load-bearing for this role | Lines plausibly wasted | Relevance estimate |
|---|---|---|---|
| Operator main session | 1, 2, 3, 4 (all — this is the seat that issues verdicts) | — | **~100%** |
| aif coordinator | 1, 2, 4 (drives the pipeline, issues routing verdicts) | 3 (read-order is Step-0, already done) | **~75%** |
| aif `plan` subagent | 1, 2 (methodology framing helps planning) | 3, 4 (has its own scope constraint) | **~50%** |
| aif `task` subagent | 1 (goal anchor only) | 2, 3, 4 (execution role; doc-authority already gates it) | **~25%** |
| aif `review` subagent | 1, 4 (reviewer issues verdicts → H1 applies) | 2, 3 | **~50%** |
| CC-native `Explore`/`general-purpose` | 1 (goal anchor) | 2, 3, 4 (generic worker) | **~25%** |
| Night-mode autonomous | 1, 2, 4 + autonomy block (already gets a distinct append) | — | **~100%** (already shaped) |

These are **structural estimates, not measurements**. The honest floor: a `task`/`Explore` worker reading only the goal line (line 1, ~150 B) wastes ~1610 B per prompt — but "waste" presumes the role would behave identically without the other lines, which is the very claim a host trial must test (§A6).

### Hypothetical savings floor (quantitative, per-role shaping)

If shaping produced the relevance estimate above, the per-prompt cost for a worker role drops from **440 tokens → ~40 tokens** (goal-line-only, ~150 B ÷ 4 B/t). Across a median session of 213 prompts, if (say) half the prompts are worker-role subagent spawns receiving a 150-B worker digest instead of 1760 B:

- Worker digest floor: **~40 tokens × 107 prompts ≈ 4,280 tokens** saved per median session on those spawns (≈4.6% of the digest's 93,720 cost-units) — a **floor**, not a ceiling, and contingent on (a) the relevance estimates holding under live measurement and (b) the digest not being cache-hit (which would shrink the saving ~10×). This is a quantitative *floor of the floor*: it confirms there is a non-zero lever, not that the lever is large.

---

## §A4 Four design shapes — tradeoff table (no pick)

The operator declined uniform. The shapes below are the design space; this patch evaluates tradeoffs, it does **not** choose.

| | Shape α — per-role digests via `agent_type` branch | Shape β — single goal anchor + per-role curation | Shape γ — no ambient digest, kickoff carries all | Shape δ — idea-formation full / execution trimmed (H3 exact) |
|---|---|---|---|---|
| **Core idea** | `inject-subagent-digest.sh` reads `agent_type` (CC) and picks a `<!-- digest:worker -->` block. Full differentiation. | 1-line goal always injected; methodology/invariants loaded cold on request. Hybrid of operator H3. | Drop the ambient digest entirely; every needed fact lives in the kickoff/dispatch. Superpowers SDD posture. | Idea-formation session gets the full digest; execution roles get a trimmed (goal-only) digest. Operator H3 literally. |
| **Code change surface** | CC: branch `inject-subagent-digest.sh:22` on `agent_type`; add N digest blocks to `inject-session-bootstrap.sh:25`. **ZCode: structural parity IMPOSSIBLE** (see portability row). | Shrink the heredoc to goal-line; move 2-5 to `.claude/session-bootstrap.md` cold-load. | Delete the digest from `UserPromptSubmit` + `SubagentStart`; rely on kickoff + Step-0 read. | Add idea-formation marker (env var or skill-load matcher — **does not exist today**, §A2 H3) + two digest variants. |
| **Risk: anti-drift regression** | **None evidenced.** C10 refuted (§A5); doc-authority holds anti-drift, role-independently. Per-role digest does not weaken principle 09 / Authoritative-for / D-3 probe / Artifact Contract. | **None evidenced** (same basis). Goal line still present. | **Low but non-zero** — removes the always-on goal anchor; relies entirely on Step-0 read + kickoff. The one scenario where uniformity *might* have helped (long autonomous session after compaction) loses its re-injection. | **None evidenced** for execution trim. Idea-formation keeps full digest, so H3's "concept always" is satisfied. |
| **SSOT surface cost** | N digest blocks (e.g. 3-4: coordinator/plan/task/review). New SSOT entry needed (per-role precedent = NONE today, §A1). | 1 anchor + cold doc. Smallest SSOT surface. | 0 digest blocks; but kickoff authoring discipline must absorb the relocated facts. | 2 digest variants + 1 marker mechanism. Medium SSOT surface. |
| **Portability (CC vs ZCode)** | **Asymmetric.** CC: native `SubagentStart` matcher on `agent_type` + `additionalContext` (DeepWiki-confirmed; field is `agent_type` not `subagent_type`). **ZCode: no `SubagentStart` event at all** (`zcode-parity-s7-subagentstart.md:13-15` — `ZCODE_EVENTS` lacks it; `:70` R1 «structural parity IMPOSSIBLE»). ZCode backup = `PreToolUse:Agent` prompt-mutation, one-shot, no `additionalContext` analogue (`:66,166`). | Portable — both harnesses inject via `UserPromptSubmit`. | Portable — removes a hook entirely. | Marker mechanism must itself be portable; the digest-variant split inherits α's CC/ZCode asymmetry on the `SubagentStart` side. |
| **Matches problem-class (T16)** | Strong where roles genuinely diverge (review vs task). Weak if roles are actually near-identical in what they need. | Strong if the real waste is the *methodology* lines for workers (§A3 estimate says yes). | Strong only if kickoffs are reliably complete — historical evidence (2026-05-09) says operational docs drift, so this bets the goal anchor on kickoff discipline. | Strong if H3 is right (idea-formation uniquely needs the concept) AND a marker can be added. |

**Honest asymmetry note (load-bearing):** any shape that wants *per-subagent* differentiation (α, δ-on-subagents) hits a hard portability wall on ZCode. The CC side is native and clean (`agent_type` matcher); the ZCode side has no `SubagentStart` event and can only approximate via `PreToolUse:Agent` prompt-mutation. A shape that differentiates only at the `UserPromptSubmit` (main-session) level (β, γ, δ-on-main) is portable because both harnesses have `UserPromptSubmit`. This asymmetry is itself a fork input — the operator's choice of shape may be constrained by whether per-*subagent* shaping is required or only per-*session* shaping.

---

## §A5 Anti-drift re-examination — the снятый blocker holds

This is the load-bearing re-check. The opus-cold-verify (2026-07-31) refuted C10 («uniform digest = deliberate anti-drift»). Re-verified against the code:

### C10 refuted — verbatim

`2026-07-31-per-role-context-opus-cold-verify.md`:
- **§0 `:26-29`:** «C10's causal claim is REFUTED by its own falsifier. The uniform digest is *not* the anti-drift machinery of the 2026-05-09 incident: it postdates the incident, came from a different workstream, and was once recorded as *amplifying* drift. The anti-drift property is held by doc-authority mechanisms, which are role-independent. **The main stated blocker against per-role shaping has no evidentiary base.**»
- **§4.1 chronology `:233-238`:** `session-bootstrap.md` landed 2026-05-09 as a read-first Step-0 file; the `UserPromptSubmit` injection hook landed 2026-05-11; the `SubagentStart` uniform digest — the exact behavior C10 defends — landed **2026-06-01**, **23 days later, from orchestrator-gate work, not anti-drift work**.
- **§4.1 amplification `:239-243`:** the digest was once recorded as *amplifying* drift — `2026-05-16-goal-clarity-dialogue.md:37-41`: the hook injected the narrow phrasing as the first content of the dialogue convened to fix that phrasing (`#operational-doc-redefines-goal`, «in self-inflicted recursive form»). Commit `e2398d158e` had to hard-edit the heredoc because the hook does not read `session-bootstrap.md`.

### 2026-05-09 root cause — EXECUTION-PLAN.md §1 language, NOT digest

- `CLAUDE.md:87` (Artifact Ownership Contract, verbatim): «The contract addresses the exact mechanism of the 2026-05-09 incident: reviewer agents pattern-matching on language in `docs/meta-factory/EXECUTION-PLAN.md §1` («north star»), then reinforcing the wrong goal across reviewer cycles.»
- `.claude/rules/doc-authority-hierarchy.md:20`: «2026-05-09 goal-hierarchy restructure incident — `EXECUTION-PLAN.md §1` silently re-defined the project's goal… The drift went uncaught for months because the project had code-level discipline … but **no doc-authority discipline**.»
- `:35`: «goal drift is caused by **pattern-matching on observed authoritative-language in context, not by token-distance forgetting**» (citing arXiv 2505.02709). «A drift caused by *language present in context* is not fixed by *delivering more context uniformly*.»

### Are the doc-authority mechanisms role-independent? — YES (verified)

- **Principle 09 test** (`packages/core/principles/09-doc-authority-hierarchy.test.ts`) — executable test enforcing the Authoritative-for header on the canonical doc list. Applies to the doc, not the reader.
- **Authoritative-for headers** (`doc-authority-hierarchy.md §3`) — declared at the top of every canonical doc; dynamically enforced for skills + flat rules + agents (`:56-58`). The header is on the *doc*; whichever role reads it sees the same scope declaration.
- **D-3 goal-phrase parity probe** (`self-application.md:72`; landed `2b0a505f92`, 2026-05-11) — the recurrence detector that actually landed. The 2026-06-05 goal-drift audit verdict CLEAN rests on six doc-authority criteria; the digest is credited nowhere (opus-cold-verify `:244-246`).
- **Artifact Ownership Contract** (`CLAUDE.md:70-87`) — per-role read-only/read-write boundaries keyed on *doc content* (README goal-redefinition is structural change → read-only for all reviewer/impl/planning sessions). The 2026-05-09 lesson (`:87`) is that the *language* in a goal-bearing doc was the drift vector, not the reader's identity.

**All four mechanisms are role-independent** — they constrain the doc and the read-only boundary, not which role is reading. Per-role digest shaping does not weaken any of them.

### Counter-finding hunt — honest pass

Is there a *real* anti-drift mechanism in the uniform digest that the opus-cold-verify missed? Search:
- The digest's goal line (line 1) re-injects the canonical goal every prompt. After compaction, this is the *only* always-on re-anchor. **This is a genuine property** — but it is the *content* (the goal phrase), not *uniformity across roles*, that does the work. A per-role digest that keeps the goal line in every role's variant (β, δ) preserves this property; a shape that drops the ambient goal anchor entirely (γ) does not. This nuances the verdict: **uniformity-as-such is not the anti-drift mechanism; the goal-line-presence-per-role is.** A counter-finding to record: γ (no ambient digest) is the one shape with a non-zero, un-refuted anti-drift risk — it bets the post-compaction re-anchor on Step-0 read + kickoff discipline.
- No other anti-drift mechanism found in the uniform digest beyond the goal-line presence. The invariants/read-order/H1 lines are methodology, not anti-drift (per doc-authority-hierarchy `:35`: drift is pattern-matching on authoritative language, not token-distance forgetting).

**Net: the снятый blocker holds.** C10's «uniform = anti-drift» has no evidentiary base; the genuine anti-drift property (goal-line presence) is preserved by any shape that keeps the goal line per role (α if all variants include it, β, δ) and only genuinely at risk under γ.

---

## §A6 Recommendation-FREE fork statement + falsifier

### Fork statement

The operator decides between shapes α / β / γ / δ via `/arch §1` from a clean sheet. This patch supplies the tradeoff space:

- **The снятый blocker (C10) holds** — there is no evidenced anti-drift cost to per-role shaping, except a residual, un-refuted risk specific to **γ** (dropping the ambient goal anchor).
- **H1 is half-right** — the *digest* is still uniform (SHA-proof `4bdebe58…`); the *runtime* already does per-role shaping on a different channel (`profileMode`, `REVIEW_DIFF_SCOPE`).
- **H2 is open** — per-role relevance is structurally plausible (§A3 estimate) but **INCONCLUSIVE without a host trial**; the quantitative floor (≈4.6% of digest cost-units for worker-role shaping) is a floor-of-a-floor, contingent on cache behavior.
- **H3 is open but blocked on a missing prerequisite** — no idea-formation marker exists today; any shape implementing H3 (δ) inherits "add a marker" as a work item.
- **A hard portability asymmetry bisects the design space** — per-*subagent* shaping (α, δ-on-subagents) is native on CC (`agent_type` matcher) but **structurally impossible** on ZCode (no `SubagentStart` event); per-*session* shaping (β, γ, δ-on-main) is portable.

This patch makes **no recommendation**. Picking a shape is the operator's call at `/arch §1`; the cold two-altitude review there is the right venue to weigh the portability asymmetry against the relevance estimates.

### Falsifier — what would prove "proceed with per-role" wrong

If the operator proceeds with a per-role shape (α/β/δ), the verdict flips to "mistake" if **any** of these materializes:
1. **Measured drift incident post-rollout** attributable to the per-role variant omitting a line the uniform digest carried — specifically a goal-drift recurrence on a role whose trimmed digest dropped the goal line. (Falsifies "the снятый blocker holds" for that shape.)
2. **ZCode parity blocked** — a per-subagent shape (α/δ) ships CC-only and the ZCode side cannot reach functional parity, fracturing the dual-harness posture the digest's `_emit_ctx` branch (`inject-session-bootstrap.sh:15-18`) exists to preserve. (Falsifies the portability row for α/δ.)
3. **Host trial shows the relevance estimates (§A3) are inverted** — e.g. worker roles measurably *do* need the invariants/H1 lines and behave worse without them, collapsing the savings case. (Falsifies H2's "uniformity wastes" premise for that role class.)
4. **The idea-formation marker (H3 prerequisite) cannot be made portable** — δ's differentiator cannot fire on both harnesses, reducing δ to α-or-β in practice.

Conversely, γ (no ambient digest) is falsified if a post-compaction goal-drift incident recurs that the always-on goal line would have caught — the one scenario where the uniform digest's goal-line presence has a non-refuted (if unevidenced) anti-drift value.

---

## §B Provenance (§2 BFR — run, not asserted)

### WebSearch (≥3, cited)
- **Anthropic — Effective Context Engineering for AI Agents** (first-party): context as finite resource; curate the window. <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- **Anthropic — Equipping agents for the real world with Agent Skills**: progressive disclosure — metadata gives just enough for the model to know when each skill fires, rather than loading everything into the system prompt upfront. <https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills>
- **LangChain — Context Engineering for Agents**: «the art and science of filling the context window with just the right information at each step of an agent's trajectory» — per-step (per-role) injection framing. <https://www.langchain.com/blog/context-engineering-for-agents>
- **Martin Fowler — Harness Engineering**: «Context engineering provides us with the means to make guides and sensors available to the agent» — ambient-injection (guides/sensors quietly fed) framing. <https://martinfowler.com/articles/harness-engineering.html>

### Anthropic July-24 blog — progressive disclosure + CLAUDE.md advice
The "new rules of context engineering" thread (surfaced via the Agent Skills post + the Reddit-discussed "delete 90% of your system prompt" guidance) converges on: **keep CLAUDE.md/ambient minimal, push conditionally-needed knowledge into skills the model discovers on demand.** This is the industry-direction wind behind β (single anchor + cold curation) and γ (no ambient, kickoff carries all). It does not decide between them — it raises the prior that *less* ambient is the direction, which the operator's H3 (trim execution, keep idea-formation) also points at.

### DeepWiki `anthropics/claude-code` — CC native per-subagent support (Shape α route)
**CONFIRMED native** (triangulated against `code.claude.com/docs/en/hooks` + two secondary sources): `SubagentStart` supports matcher on agent type + `hookSpecificOutput.additionalContext`. **Correction load-bearing for any α implementation:** the field is **`agent_type`**, not `subagent_type` — present «when the session uses `--agent` or the hook fires inside a subagent» (value = agent frontmatter `name`, or `plugin:name` for plugins). `SubagentStart` is **non-blocking** (can inject context, cannot refuse a spawn). CC ≥2.1.0 also offers agent-frontmatter hooks for an even cleaner per-role attach point. *Caveat:* `additionalContext` augments context; it does not replace the subagent's base system prompt (that needs the custom-agent frontmatter `systemPrompt`). **Falsifier:** a future CC release renaming `agent_type` or dropping `additionalContext` from `SubagentStart` — re-check `code.claude.com/docs/en/hooks` "Common input fields" before locking implementation.

### SSOT grep — per-role precedent (negative-existence, 6-item check)
Full-file regex `per-role|per-subagent|role-specific|ambient digest|context injection|per-agent-type|per-subagent-type` over `prior-art-evaluations.md` → **exit 1, no matches** (true negative). Nearest anchors: #108 (SubagentStart digest, ADOPT, role-agnostic, `:180`); #64 (SDD, ADOPT inner loop, roles-by-task-not-context, `:136`). Per-role ambient digest = first-of-kind SSOT dimension.

### ZCode parity — S7 SubagentStart patch
`2026-07-18-zcode-parity-s7-subagentstart.md`: ZCode does **not** expose `SubagentStart` at all (`ZCODE_EVENTS` lacks it, `scripts/render-harness-config.mjs:46-54`); R1 verdict `:70` «Structural parity: IMPOSSIBLE.» Backup channel `PreToolUse:Agent` preserves `subagent_type` through `updatedInput` but has no `additionalContext` analogue — per-role dispatch on ZCode collapses to one-shot first-prompt text mutation (`:66,166`). Provisional recommendation Fork 7A (`:286`) accepts the one-shot backup as-is.

---

## §C Non-goals (contract K6)

- **NOT a design decision.** This patch does not pick α/β/γ/δ. The choice is the operator's at `/arch §1`.
- **NOT an implementation.** Zero edits to `inject-session-bootstrap.sh`, `inject-subagent-digest.sh`, `subagentQuery.ts`, or any aif-handoff source. Zero build.
- **NOT a re-litigation of C10.** The opus-cold-verify (2026-07-31) is append-only; this patch *re-verifies* its conclusion against the code and records one counter-finding nuance (γ's residual goal-anchor risk), it does not overturn it.
- **NOT a host-trial.** Per-role relevance estimates (§A3) are structural inferences, not measurements; the falsifier (§A6.3) names the host trial as the missing step before any shape is load-bearing.
