# Acceptance contour + model-routing boundary — design

> **Status:** ACCEPTED r3 after cold two-altitude review (/arch §2; both seats Opus). Round 2: bottom-up GO; top-down REVISE with a single MAJOR whose stated downgrade condition ("confirm the plan artifact is readable pre-egress") is met with code evidence (`aifHttp.ts:15,51`, `questions.ts:53,89`, e2e PR #352) — recorded in D1; all round-2 MINORs applied in r3. Session-2 of the multi-model pipeline track (session-1 shipped PR #1057 bridge-profile marker, #1060/#1064 task-tier routing, #1066 /arch skill).
> **Date:** 2026-07-23
> **Authoritative for:** the acceptance-contour design (fidelity verdict, fail-closed gate, acceptance package, parked-Q choreography, rework loop, merge policy) + the model-routing boundary update (who plans inside aif).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). aif-handoff internals — external codebase (walls below). Tier criteria SSOT — [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) (this spec AMENDS it via D1; CLAUDE.md stays the SSOT after the amendment lands).

## §1 Context

Two contours exist: external (interactive top-tier sessions: `/arch` idea→design→kickoff) and internal (aif docker factory: plan→implement→review, driven by `/dispatcher`; or in-session night-mode/SDD). Cheap strong-agentic executor = GLM-5.2 via z.ai; top tier = Fable/Opus (external only; Fable unavailable inside aif). The weakest part (operator priority): **acceptance after the factory** — parked-question handling, rework routing, and final merge have bricks (`questions.ts`, `answer.ts`, `harvest.ts`, `/harvest`, `/dispatcher`) but no choreography, no design-level verdict, and nothing blocking a merge without one.

## §2 Walls (operator-verified, external aif codebase — do not design against them)

1. Planner + plan-checker share ONE profile socket (`coordinator.ts:199`); plan-checker is a formatter, not a critic (`planChecker.ts:101-115`).
2. Reviewer + both sidecars share the Review socket (`reviewer.ts:30,287`); review-gate runs in Task mode. Internal review cap: env-tunable (`env.ts:113`), currently 3.
3. aif coordinator is deterministic TS — cannot consult a senior model mid-run; only outward channel = park/answer (proven e2e, PR #352).
4. Fable cannot run inside aif (rollout gate; `ANTHROPIC_BASE_URL` is process-global — one provider per invocation).
5. Agent merge gating: `gh pr merge --squash` allowed to `staging`/`epic/*` only; `main` is maintainer-manual (promote: head=staging, merge-commit).

These walls are why the top altitude lives at the **boundary**, not inside the factory.

## §3 Decisions

### D1 — Routing boundary: judgment at the borders, one-model factory inside

- A kickoff produced by `/arch` (design cold-reviewed at two altitudes) **always carries** `<!-- bridge-profile: <executor-profile-name> -->` → the whole aif pipeline (plan+implement+review) runs on the executor tier, **including Tier-2 work**. Rationale: the design judgment was already spent in `/arch`; in-aif planning over a reviewed kickoff is decomposition (Tier-1-class work). A second strong planner that never saw the design dialogue is a re-judgment risk (it "improves" the reviewed design), not a safety layer — and the plan-checker formatter (wall 1) catches nothing either way.
- **Plan-completeness precondition (r2, review finding):** the always-marker rule applies only when the `/arch` kickoff is *plan-complete* — it encodes the decomposition-relevant decisions (module boundaries, load-bearing step order, test strategy) and **every descope/decision from the design dialogue** (the kickoff is the fidelity auditor's sole truth — D2). If `/arch` cannot state the "how" at that level, do NOT emit the marker — the task falls back to the top-tier-plan default. This lands as an explicit obligation in `/arch` SKILL §3 (factory-bound exit).
- The top-tier Plan default (no marker → project defaults: Plan=top tier, Task/Review=executor) **remains configured as the fallback** for dispatches that bypass `/arch` or fail plan-completeness.
- **Marker value must be the unique profile name** (e.g. `Z.AI GLM-5.2 SDK`): substring `GLM` currently matches 2 profiles. Mechanics: header-region-only parse (`packages/runtime-bridge/src/kickoff.ts:30,44-46`); name→id resolution throws loudly on 0 or >1 matches (`AifHandoffBackend.ts:141-144`) — no silent fallback.
- **Precondition:** this routing rule activates only together with the fail-closed acceptance gate (D3). Until D3 is live, current defaults stay.
- **CLAUDE.md amendment** («Task-tier routing»): Tier-2 row splits by "has the design judgment already been done?" — Tier 2 + /arch-reviewed **plan-complete** kickoff → marker (executor plans); otherwise → no marker (top tier plans). Tier 0/1 unchanged.
- **Monitor blind spot + calibration (r2, review finding):** fidelity (D2) measures WHAT-conformance, not plan/HOW quality — the specific risk D1 introduces (workable-but-architecturally-worse decomposition that stays WHAT-conformant) is invisible to it. Countermeasure: for the **first 5 marker-planned Tier-2 tasks**, the harvesting session runs a top-tier read-only spot-check of the aif-produced plan artifact (cheap — plans are small), recorded in the PR `## Review findings` section. This is a bounded calibration measure, not standing machinery.
- **Plan-artifact retrieval (r3, verified):** the plan is readable pre-egress via the bridge's existing REST read — `GET /tasks/:id` returns the `plan` field (`packages/runtime-bridge/src/cli/aifHttp.ts:15,51`), already load-bearing in the shipped question-loop (`questions.ts:53,89` reads `task.plan` for the mid-flight-park anchor; e2e-proven, PR #352). No new aif capability needed.
- **Calibration-window counter (r3, review finding):** no new storage — the window is derived by query: count merged base-`staging` PRs whose `## Review findings` contains a `Plan spot-check:` entry (`gh pr list --search`, deterministic); window open while count < 5.
- *Falsifier (extended r2):* if, over the calibration window, fidelity-REVISE rate OR plan spot-check MAJOR-finding rate on marker-planned Tier-2 tasks materially exceeds what the same checks show on top-tier-planned tasks, move Tier-2 in-aif planning back to the top tier (drop the always-marker rule). Cohorts differ by /arch-ness, so treat the comparison as directional, not statistical.

### D2 — Fidelity verdict (design-altitude acceptance)

- New portable cold agent **`agents/fidelity-auditor.md`** (naming family: `*-auditor`; AI-agnostic, session-read, zero paid-LLM-in-CI; carries the doc-authority `Class:`/`Authoritative-for:` header — principle 09 enforces dynamically). Inputs: **only** the kickoff/spec path + the 3-dot diff. Explicitly NOT given: chat context, implementation log — cold by construction (same principle as `/arch` §2 reviewers).
- **Build-vs-reuse articulation (r2, review finding):** verdict **BUILD**, disjoint from neighbours: night-mode's completeness-critic and SDD's spec-reviewer are *context-ful, in-loop* checks inside the in-session executor; the factory path has **no in-session loop at all** — work arrives cold to the harvesting session, and nothing existing performs a cold, single-grammar, gate-feeding WHAT-conformance audit across both substrates. Grep of `agents/` + skills confirms no existing `fidelity`/design-conformance auditor (source-before-shape §1 consult done at design time; SSOT entry lands with the artifact per CLAUDE.md).
- Question it answers (design altitude, disjoint from code review): *is this WHAT the kickoff asked for* — three drift lists: **missing** (asked, not built), **extra** (built, not asked), **diverged** (built differently), each with file:line evidence.
- Output grammar: `FIDELITY: GO | REVISE | STOP` + findings graded `BLOCKER | MAJOR | MINOR`; may flag `KICKOFF-AMBIGUOUS` when the drift's root cause is the kickoff itself (routes to D6 escalation, not a rework round). The D1 plan-completeness obligation (descopes encoded in kickoff) is the load-bearing precondition that keeps false-MISSING findings rare; residual risk in §7.
- **Seats (r2, corrected against real choreography — review finding both altitudes):**
  - **Factory / dispatcher path:** fidelity runs in `/dispatcher` §2.4 **before invoking `harvest.ts`** (which creates the PR and queues auto-merge inside one binary — there is no seam inside it). The diff is read pre-egress from the container: `docker exec <agent> git -C <worktree> diff origin/staging...HEAD` (read-only; the in-container `origin/staging` ref is an established pattern — `/harvest` §1.1 already runs `git log origin/staging..HEAD` in-container, `.claude/skills/harvest/SKILL.md:41`; the 3-dot form tolerates a stale base. Implementation-time check: confirm the ref resolves in a live agent container). `FIDELITY: REVISE` → no egress, no PR (D6).
  - **Manual `/harvest` path:** `/harvest` §4 is restructured — fidelity becomes the step **between** §4.1 (cold code review) and the current §4.2 (`gh pr create`); PR creation moves after it.
  - **In-session path (night-mode/SDD):** the "PR-body discipline gates satisfied" loop-until item grows the fidelity gate — the session runs the same agent on spec+diff before `gh pr create`. Role delineation (r3): night-mode's completeness-critic stays the *deep, context-ful in-loop* check during execution; `fidelity-auditor` is the *cold boundary gate-grammar producer* at PR time — complementary layers, not duplicates.

### D3 — Fail-closed gate (mechanical, mirrors the PR-body gate precedent)

- Every PR **with base `staging`** MUST carry a `## Fidelity verdict` PR-body section, one of:
  - `FIDELITY: GO` + `Basis: <kickoff/spec path>` + `Round: <n>` + `Audited-SHA: <commit>` + ≥1 file:line evidence line;
  - `FIDELITY: skipped — <rationale ≥20 chars>` (PRs with no kickoff/spec to check against: tier-0 edits, hotfixes, docs-only, config).
- **Enforcement pattern (r2, corrected):** a deterministic grep job on the **unfiltered** `pr-body-prior-art.yml` model (fires on every `opened/edited/synchronize/reopened` — PR #1098 precedent), NOT on `discipline-self-check.yml` (path-filtered → tier-0/docs PRs would escape + required-check "Expected/waiting" dead-stuck gotcha). Scoping: required-check registration **only in the `staging` branch-protection set is the primary exemption mechanism** (a check never registered on `main` cannot block a base=`main` PR — robust regardless of Actions skip semantics); the job-level `github.base_ref == 'staging'` guard is defense-in-depth. Promote PRs (base=`main`, head=`staging`) are exempt by construction; the fragile promote flow (CLAUDE.md Harness gates) is untouched. Implementation caution (r3): verify the skipped-required-job conclusion behavior on a throwaway PR before registering the check as required.
- **Staleness guard (r3, review finding):** the GO form's `Audited-SHA` must equal the PR head SHA — the grep job compares them; a commit pushed after the audit turns the check red until re-audit + body update. This closes the "GO computed against an earlier diff" drift deterministically (the semantic re-audit itself stays in-session per no-paid-llm-in-ci; CI only enforces SHA equality).
- **Rollout (r2, review finding):** (a) in-flight staging PRs opened pre-gate get one-line grandfathering: `FIDELITY: skipped — pre-gate PR, opened before fidelity gate landed`; (b) the introducing PR **dogfoods its own auditor** — the agent file exists in its diff; the PR carries a real `FIDELITY: GO` produced by it (recursive self-application).
- Zero LLM in CI (semantic judgment already happened in-session; CI enforces it cannot be silently absent) — per [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md): the named cold-agent protocol is the detection layer, the CI grep is the fail-closed transport, merge authority stays with the (possibly autonomous) merging session.
- Local mirror in `~/.claude/hooks/git-safety.sh` (validates at `gh pr create/edit` time, earlier channel) — **operator manual item**; the CI arm alone is sufficient fail-closed.
- Trust model: a fabricated GO without running the auditor is the same violation class as a fabricated §1.7 section — retro-detectable, out of mechanical scope per [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md).

### D4 — Acceptance package = PR body under contract

Required sections for **stage PRs** (factory or in-session umbrella stages), **placed BEFORE the §1.7 block** (r2: the §1.7 awk substance-gate captures until the next `/^###/`; a trailing H2 would silently widen its capture — `discipline-self-check.yml:62-66`):

- `## Provenance` — kickoff path; base SHA; substrate (`aif task <id>` + bridge-profile name, or `in-session`); models per stage (plan/implement/review); fidelity `Round` count.
- `## Review findings` — aif internal review outcome + cold code-review summary (or in-session dual-review outcome); during the D1 calibration window: the plan spot-check result.
- `## Fidelity verdict` — per D3.
- `## Parked questions` — every parked question + its resolution decision, or `none`.

**Mechanical gate stays minimal-first:** only the Fidelity section (D3) is CI-enforced now; the rest are template + prose discipline. Promotion trigger recorded: recurring omissions in merged stage PRs → widen the grep to that section.

### D5 — Parked-question choreography (routing table, not new machinery)

Bricks stay as-is (`questions.ts` collects, `answer.ts` resolves). `/dispatcher` §3 (Q&A) gains the binding routing table:

| Question class | Day | Night (unattended) |
|---|---|---|
| technical / in-scope (implementation choice within kickoff bounds) | dispatcher session resolves autonomously (brainstorm → `answer.ts`), decision recorded in task comment + PR `## Parked questions` | same — autonomous |
| intent / goal / design (changes WHAT to build) | `/arch` §4 office hours, top seat | **stay parked — never guess**; morning batch sweep (`questions.ts --project`) |
| environment (container/tooling broken) | `/aif-doctor` | `/aif-doctor` non-destructive arm; else stay parked |

Sweep triggers: monitor-poll park classification (event-driven, `/dispatcher` §2.2) + batch sweep at session start. `answer.ts` runs from the dispatcher session (senior-executor seat per skill frontmatter).

### D6 — Rework loop (external counter, cap 2, both substrates)

**Round** = the count of fidelity audits performed for the stage. Cap **2** on both substrates; round-2 REVISE → STOP + escalation (operator decides: fix the kickoff via `/arch` for design drift, or intervene manually).

| | Factory (dispatcher) | In-session (night-mode/SDD) |
|---|---|---|
| REVISE action | findings → `answer.ts --decision request_changes` (feedback comment; task → `implementing`, aif redoes with internal review cap) → re-audit later = Round 2. **No egress, no PR** (fidelity runs pre-egress, D2) | findings feed the session's own fix loop; re-audit after fixes = Round 2. No PR until GO |
| Round storage | aif task comments (written by `answer.ts` feedback); dispatcher loop reads before re-dispatch | session-local (one session owns the whole loop); recorded in morning report |
| Round in PR body | written by the harvesting session at PR time | written by the session at PR time |
| Escalation surface | dispatcher report escalation block (task id + both rounds' findings) | morning report BLOCKED item |

`KICKOFF-AMBIGUOUS` (D2) → escalate immediately to `/arch` office hours without burning a rework round — reworking code against a broken kickoff wastes both rounds.

### D7 — Final merge

- Agent squash-merges stage PRs to `staging` autonomously when the package is complete: CI green including the D3 required check — the existing auto-merge convention continues, now behind a real gate. Night runs never block on a human.
- `main` unchanged: maintainer-manual promote (head=staging, merge-commit — wall 5, untouched by D3 scoping).
- Human role shifts from per-PR review to: escalations (D6), intent parks (D5), morning reports.

### D8 — Two-altitudes layout (В3): confirmed at the boundary

Bottom altitude inside the factory (aif GLM review) + at harvest (cold code review); top altitude at the borders: `/arch` before spend, fidelity verdict (D2) after build. The known cost — the top critic arrives late — is accepted because: (1) walls 1-4 make an in-factory top seat an aif fork; (2) the D6 cap bounds wasted spend to ≤2 rework rounds; (3) `/arch` upstream + the D1 plan-completeness bar cut the probability of design-level drift at the source. **Revisit trigger:** ≥3 tasks in 3 months hitting round-2 STOP with design-level drift, OR the D1 calibration spot-checks surfacing repeated plan-quality MAJORs → reconsider an in-aif top-tier plan-review (requires aif changes — wall 1).

### D9 — Validation plan (В4): staged, not 4-in-1

- **Implementation of THIS design is in-session** (discipline-bearing surfaces: skills, CI, CLAUDE.md) — do not dogfood the acceptance contour by building it in a factory that does not yet have one.
- **Run 0 (smoke, r2 — decoupled per review finding):** one *tiny* Tier-1 mechanical task with `<!-- bridge-profile: Z.AI GLM-5.2 SDK -->` (exact unique name — verify against live `GET /runtime-profiles` at dispatch time). Validates in isolation: SDK transport (never ran) + live marker resolution (never ran) + all-GLM pipeline mechanics. Pre-made fallbacks: SDK transport fails → operator flips Task/Review profiles to the proven API-GLM profile; marker-ambiguity error → fix marker string, redispatch.
- **Run 1 (acceptance loop):** one real, small `/arch`-produced plan-complete task through the full contour: dispatch → all-GLM → parks routed per D5 → pre-egress fidelity → PR with package → D3 gate → autonomous merge. Success: `FIDELITY: GO`, zero manual unblocking outside designed seams. Failure attribution is clean because run 0 already cleared transport/marker/pipeline.
- The no-marker fallback path (top-tier plans in aif) is validated later by any direct-dispatch task — deliberately separate.

### D10 — Resilience: crash-safe by durable state (operator requirement, 2026-07-23)

**Principle:** no contour step may keep its progress ONLY in session memory. Every step must be resumable by re-deriving state from durable stores — git (commits/branches/container worktrees), the aif task record (REST), the PR body. A session death (network drop, CC quota window, z.ai limit) costs at most the current in-flight step, never completed work. Named anti-pattern: `#state-in-session-memory`.

Per-surface inventory (mostly existing mechanisms — cited, not rebuilt):

| Surface | Durable store | On crash / outage |
|---|---|---|
| aif task execution | commits in container worktree + aif DB task record | provider outage/quota → task stalls → monitor → `/aif-doctor` (existing rule); resume when the window reopens |
| dispatcher loop | none needed — stateless by design | fresh session re-derives from `GET /tasks` + git + `gh pr` (§2.0 probe exists for exactly this) |
| dispatch | `exit 0` contract + ManualBackend fallback file (existing) | retry after blocker clears |
| harvest egress | pushed branch; push is retryable; §2.4b API path for dead transport (existing) | death between push and PR-create → re-run continues |
| fidelity audit | verdict counts only once recorded (PR body / task comment) | stateless + idempotent → re-run on the same SHA, cheap |
| Round counter (factory) | aif task comments + PR body | survives |
| Round counter (in-session) | session-local — **accepted gap**: resets on crash; worst case one extra audit round, cap still bounds spend | note in morning report |
| implementing this very design | per-task TDD commits (plan discipline) | lose only the uncommitted step |
| CC quota overnight | night-mode's existing quota-backoff delta (that skill owns it — not re-described) | backoff + resume |

## §4 Config actions (operator, alongside implementation)

1. aif internal review cap 3 → 5 (`env.ts:113` env knob; exact var name verified at apply time). Cheap insurance for unattended nights; diminishing returns acknowledged (same-reviewer blind spots persist past round 3) — the real quality lever is D2/D6.
2. Verify the executor SDK profile's unique display name before first marker use.
3. Optional: extend `~/.claude/hooks/git-safety.sh` with the Fidelity-section mirror (earlier channel than CI).

## §5 Implementation surfaces (input to the plan)

1. `agents/fidelity-auditor.md` — new cold-agent protocol (D2), **with doc-authority Class/Authoritative-for header** (principle 09 dynamic enforcement).
2. `.claude/skills/harvest/SKILL.md` — §4 restructure: fidelity step between cold code-review and `gh pr create` (D2 seats).
3. `.claude/skills/dispatcher/SKILL.md` — §2.4 pre-egress fidelity step (before `harvest.ts`) + D6 rework/escalation wiring; §3 Q&A routing table (D5).
4. `.claude/skills/night-mode/SKILL.md` — PR-gate list grows the fidelity item (D2 in-session seat).
5. `.github/workflows/` — D3 grep job as an **unfiltered sibling of `pr-body-prior-art.yml`** with `base_ref == staging` guard; register in staging branch protection (operator confirms protection edit).
6. `.github/pull_request_template.md` — D4 sections inserted **before** the §1.7 block.
7. `CLAUDE.md` «Task-tier routing» — D1 amendment (plan-complete discriminator); `.claude/skills/arch/SKILL.md` §3 — always-marker rule + plan-completeness/descope-encoding obligation (D1/D2).
8. Rule-index regen if any `.claude/rules/` file is touched (none planned — D3 cites existing rules).

## §6 Out of scope

- Any aif-handoff code change (walls 1-4): no per-stage model splitting inside aif, no in-aif top-tier review seat, no coordinator LLM routing.
- Automated tier classifier (stays a senior judgment per CLAUDE.md).
- Widening the mechanical gate beyond the Fidelity section (D4 promotion trigger recorded instead).
- **`epic/*`-base PRs (r3, explicit decision):** the v1 gate scopes to base `staging` only. The designed factory path is staging-hardcoded (`harvest.ts --base staging`, `dispatcher/SKILL.md:118`); epic-integration flows do not pass through this contour today. Recorded trigger: the first factory-harvested umbrella targeting an `epic/*` base → extend the required-check registration to the `epic/*` protection pattern.

## §7 Known limitations / residual risks

- **Plan-quality blind spot on the marker path** — fidelity checks WHAT, not HOW; bounded by the D1 calibration spot-checks (first 5 tasks) and the D8 revisit trigger. Accepted: standing top-tier plan review would re-open wall 1.
- **False-MISSING on descoped items** — a descope agreed in dialogue but absent from the kickoff reads as drift to the cold auditor. Primary counter: D1 plan-completeness obligation (descopes MUST be encoded in the kickoff); residual burns ≤2 rounds then escalates with `KICKOFF-AMBIGUOUS` available.
- **Large-diff fidelity audits:** a single cold pass over a huge stage diff may shallow out. Recorded trigger — first fidelity miss attributable to diff size → chunked per-file-group audit protocol in `agents/fidelity-auditor.md`.
- **Gate-form gaming:** D3 validates form, not that the auditor actually ran — same trust model as §1.7/Prior-art gates; retro-detectable, accepted per no-paid-llm-in-ci.
- **In-session path adoption lag:** night-mode edits are prose (Class C); if the fidelity step is skipped there, the CI gate still catches the PR at merge (fail-closed holds); the skill edit is convenience, not the mechanism.
