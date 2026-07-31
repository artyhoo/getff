<!-- scope: session handoff — /arch v2 + context-pipeline track. Written 2026-07-31 by the Fable synthesis session (session-start-token-audit). Consumer: the NEXT Fable session continuing this track, and any Opus/GLM seat it dispatches. This is a decision record + continuation protocol, NOT a spec — the spec is the next session's step 5. -->

# /arch v2 + context pipeline — session handoff (2026-07-31)

> **Authoritative for:** the decisions taken in the 2026-07-31 synthesis session (§2) and the
> continuation protocol (§4). **NOT authoritative for:** project goal
> ([README.md#why-this-exists](../../../README.md#why-this-exists)); the /arch choreography
> (current SSOT: [.claude/skills/arch/SKILL.md](../../../.claude/skills/arch/SKILL.md) until the
> v2 spec supersedes it); any rule cited below — each rule owns itself.

## §1 The idea, in essence (retell critically — see §4 rule 1)

**Context is a convention, and this project's thesis says every convention must become an
executable artifact.** A session's context today is the one convention we never enforced:
budget asserted by nobody, every role loaded identically, role-specific content authored
ad-hoc. The synthesis of four workstreams (token-audit, per-role-context research, prior-art
comparison, the operator's role-pipeline vision) is ONE idea at three layers:

- **L1 — always-on load:** measure → attribute per channel → trim by re-scoping channels →
  assert with a budget gate. (Umbrella live: kickoff merged #1184, S1 running in aif.)
- **L2 — role-shaped digests:** the SubagentStart digest becomes a function of role
  (worker/reviewer/researcher), byte-identical-uniform today by measurement, unblocked by the
  refutation of the «uniform digest = anti-drift machinery» belief (C10 refuted by commit
  dates — see #1182). Next umbrella, after research lands.
- **L3 — dispatch-time authored context:** the operator's role pipeline (Fable dreams/designs
  · Opus criticizes/plans/verifies · GLM researches/builds) IS the L3 machine: each stage's
  artifact (research-spec → distillate → execution plan) is the next role's context by
  construction. The «membrane»: Fable never sees raw research, GLM never sees the dream, Opus
  filters both directions.

The pipeline invariant, self-applied: **an idea must fail at the earliest reachable channel**
(kill at research costs a research; kill at implementation costs an implementation).

## §2 Decisions taken (all operator-confirmed or operator-delegated, 2026-07-31)

1. **Home:** the pipeline lives as an EXTENSION of `/arch` — no new sibling skill.
2. **Roles are total, not review-only:** Fable = ideation/synthesis/spec/fork-judgment, NEVER
   verification passes; Opus = skeptic/planner/verifier; GLM = engineer + heavy researcher.
   Relative tiers (record roles, not model names). Codified in operator memory
   (`feedback_model_ladder_fable_opus_glm`, sharpened 2026-07-31).
3. **One creative arc = system design as the method:** idea → brainstorm → architecture/design
   is ONE systemdesign pass. `superpowers:brainstorming` supplies the dialogue form;
   `engineering:system-design` the engineering method (requirements → constraints → component
   boundaries → interfaces → data flow → trade-offs); `engineering:architecture` the ADR shape
   for decisions (each with a falsifier). Interface-level references only (see 6).
4. **Research contour (new /arch §1.5):** Opus authors a research-spec (what/where to search,
   terminology) → GLM executes in aif → Opus verifies (spot-checks sources — not curation
   only), distills best-of-the-best, and issues the idea verdict GO / rework / kill; killed
   ideas land in the SSOT with reasons. Trigger: new capability / unfamiliar domain / BFR
   verdict needed. Tier 0/1 work skips the contour explicitly, never silently.
5. **Review scheme:** the dedicated top-down design-review seat is ABOLISHED — its function is
   absorbed by Opus's three standing looks (idea verdict §1.5c; execution-plan writing —
   «who must write the plan cannot rubber-stamp the design»; acceptance at harvest). ONE
   dedicated cold bottom seat remains (GLM-in-aif): reality-check of the dispatch input, contract
   v1 = 5 classes (anchors exist as claimed · quoted outputs reproduce · sibling-pattern
   consistency · format mechanics incl. silent failure modes · external-state preconditions).
   Evidence: SSOT #231 — upstream's A/B killed the REVIEW DISPATCH overhead, not the checks
   (inline replacement caught defects at comparable rates). Falsifier: a «does not serve the
   goal» design hole slips past plan-writing Opus into implementation → reinstate the seat.
6. **Wrapper universality (layered abstraction):** a wrapper states only (a) the capability it
   delegates, (b) the interface it relies on, (c) its own delta — NEVER upstream internals.
   Version markers REJECTED. Existing drift (arch/SKILL.md:79 false «no design-review skill
   exists upstream»; night-mode/SKILL.md:15,24 stale SDD roster) is fixed by rewriting to
   interface level inside the /arch v2 umbrella. Cheap insurance: a skill-exists-by-name smoke.
7. **«Inject only needed», per layer:** L1 minimal core for everyone (SESSION goal for all;
   PROJECT goal by role — full text to goal-deciding roles, pointer to executors, pointer +
   standing goal-reasoning prohibition to reviewers). L2 digests as role functions:
   `.claude/templates/digests/<role>.md`, resolver on `subagent_type` with fail-open to
   today's uniform digest; ZCode parity by construction (same templates consumed by the
   PreToolUse:Agent twin; byte-identity pre-commit gate). Budget gate = `InstructionsLoaded`
   hook, error-with-escape-token (ci-tool-pinning §3 precedent), designed INSIDE the L2
   umbrella (not bolted onto token-audit S3). L3 = the membrane artifacts themselves.
8. **Freshness bar (binding for research + distillation):** every source dated, freshest
   first, stale sources do not enter the distillate without fresh confirmation. The distillate
   carries «current as of <date>».
9. **SOLID/patterns/LLD checks belong to the implementation-review stage** (aif per-task
   reviewer + Opus acceptance), NOT the dispatch-input seat — no code exists at dispatch time.
   Which checks actually catch defects at each stage = research task in flight (§3).
10. **Fired BUILD trigger** (inject-layer-extension «≥6 marked rules», actual 16/26): DEFER's
    trigger obliges RE-EVALUATION, not building — folded into the L2 umbrella design; no
    standalone injection layer (`#parallel-evolution-creep` inside our own repo).
11. **Stage-scoped dispatch inputs** (`<umbrella>-s<N>/kickoff.md`) are binding for
    multi-stage umbrellas going forward; token-audit S2/S3 get theirs at their dispatch time.
12. **Closed:** PR #1181 (superseded by #1183, one §8 conclusion refuted by measurement); NO
    retro host-verify wave over the 259 legacy kickoffs (the gate is forward-going by design).
13. **Small-fixes queue** (one maintenance PR at token-audit S2 time, not before):
    `autonomous-loop-continuity.md:4` channel marker understates channels post-S2;
    pipeline/SKILL.md §5 stale `#autonomous-dispatch-without-park` falsifier; aif container
    uncommitted `?? .claude/worktrees/` drift; E-4 hypothesis (claudeMdExcludes entries need
    absolute globs per docs — container ignores repo-relative literals) checked at S2
    acceptance; unique-filenames convention for parallel subagents sharing one scratchpad
    (near-clobber incident 2026-07-31) → codify in /arch v2.

## §3 In-flight aif work (receive in the next session; do NOT re-dispatch)

| Task | What | Lands where |
|---|---|---|
| `775f635f-eab2-4a7c-86ae-e1052b754773` | R1(a) dispatch-input check usefulness · R1(b) LLM implementation-review dimensions · R2 skills/MCP context-pollution levers · R3 Anthropic blog primary-source verify | `docs/meta-factory/research-patches/2026-07-31-review-checks-and-context-levers-research.md` (task commits on its branch → harvest → PR) |
| `c781e8a9-741d-45b8-a186-89915037abe2` | token-audit S1: `scripts/measure-session-start-tokens.sh` + attribution table (incl. skills/MCP/harness remainder, per-environment host-cc vs aif-container) | PR onto staging per kickoff S1; then S2/S3 with stage-scoped inputs |
| `4e1056d2-9198-419f-b13d-d980ec99e80a` (check state) | 8-dimension cold review of per-role substrate + FIRST L3 sweep (aif-handoff agent definitions) | dispatched by the per-role Opus session 2026-07-30; verify status + harvest before relying |

Receive protocol: `source ~/.zshenv`, `curl -s "$RUNTIME_BRIDGE_AIF_URL/tasks/<id>"` for state;
results read via `docker exec aif-handoff-agent-1 git -C /home/www/rules-as-tests-aif show
<branch>:<path>` or harvested via `packages/runtime-bridge/src/cli/harvest.ts`. If the API
refuses connection: `open -a Docker`, wait, containers auto-start.

## §4 Continuation protocol (operator-defined sequence)

1. **Fable retells the idea's essence, fresh and critically** — the operator explicitly does
   NOT want agreement («не нужно со мной соглашаться»): re-derive §1 from the merged
   artifacts, challenge what does not hold, keep what survives. The retell is a check, not a
   ceremony.
2. **Opus delivers the research** (§3 results distilled per decision 4/8 — dates on every
   source, spot-checked, best-of-the-best only).
3. **Fable makes the final idea correction** on the distillate.
4. **Opus critiques** the corrected idea (skeptic pass).
5. **System design** — Fable runs the single creative arc (decision 3) → spec + architecture.
6. **Plan** — Opus writes the execution plan + kickoff (stage-scoped inputs, decision 11).
7. **Implementation in aif** — GLM builds; bottom seat checks dispatch inputs (decision 5);
   Opus accepts at harvest.

## §5 Merged artifacts of this track (evidence base)

- #1182 + #1185 — per-role-context Opus cold-verify (7 contradictions resolved; C10 refuted;
  3-layer definition) + status corrections.
- #1183 — orchestration-contour prior-art verdicts (`docs/meta-factory/research-patches/2026-07-31-orchestration-contour-prior-art-comparison.md`): substrate not reinvented; two wrapper-drift findings; WATCHLIST `/dispatcher` + mission-control probe proposal.
- #1184 — session-start-token-audit umbrella kickoff (`.claude/orchestrator-prompts/session-start-token-audit/kickoff.md`), S1 dispatched.
- Per-role bundle + addendum + raw research: `docs/superpowers/specs/2026-07-2{6,7}-per-role-context-*.md`, `docs/meta-factory/research-patches/2026-07-2{6,7}-per-role-context-*.md` (#1176-#1180).
- SSOT rows of record: #231 (upstream review A/B nuance), #207, #179, #64; new rows drafted by the in-flight research land with its patch.
