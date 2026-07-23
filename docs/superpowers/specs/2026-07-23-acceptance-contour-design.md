# Acceptance contour + model-routing boundary — design

> **Status:** DRAFT for cold two-altitude review (/arch §2). Session-2 of the multi-model pipeline track (session-1 shipped PR #1057 bridge-profile marker, #1060/#1064 task-tier routing, #1066 /arch skill).
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
- The top-tier Plan default (no marker → project defaults: Plan=top tier, Task/Review=executor) **remains configured as the fallback** for dispatches that bypass `/arch` (direct kickoffs where the "how" was never judged).
- **Marker value must be the unique profile name** (e.g. `Z.AI GLM-5.2 SDK`): substring `GLM` currently matches 2 profiles and the dispatcher fails on ambiguity by design (kickoff.ts header-region parse, PR #1057).
- **Precondition:** this routing rule activates only together with the fail-closed acceptance gate (D3). Until D3 is live, current defaults stay.
- **CLAUDE.md amendment** («Task-tier routing»): Tier-2 row splits by "has the design judgment already been done?" — Tier 2 + /arch-reviewed kickoff → marker (executor plans); Tier 2 without /arch → no marker (top tier plans). Tier 0/1 unchanged. `/arch` SKILL §3 routing table gains the always-marker rule for factory-bound exits.
- *Falsifier:* if fidelity-REVISE rate on /arch'ed+marker tasks materially exceeds the top-tier-planned baseline over the first N live tasks, move Tier-2 in-aif planning back to the top tier (drop the always-marker rule).

### D2 — Fidelity verdict (design-altitude acceptance)

- New portable cold agent **`agents/fidelity-auditor.md`** (naming family: `*-auditor`; AI-agnostic, session-read, zero paid-LLM-in-CI). Inputs: **only** the kickoff/spec path + the 3-dot diff (`git diff origin/staging...HEAD`). Explicitly NOT given: chat context, implementation log — cold by construction (same principle as `/arch` §2 reviewers).
- Question it answers (design altitude, disjoint from code review): *is this WHAT the kickoff asked for* — reports three drift lists: **missing** (asked, not built), **extra** (built, not asked), **diverged** (built differently than specified), each with file:line evidence.
- Output grammar: `FIDELITY: GO | REVISE | STOP` + findings graded `BLOCKER | MAJOR | MINOR`; may flag `KICKOFF-AMBIGUOUS` when the drift's root cause is the kickoff itself (routes to D6 escalation, not a rework round).
- Seats: factory path — new **`/harvest` §5** (runs after §4 code review, **before** `gh pr create`); in-session path — night-mode/SDD PR-gate (its "PR-body discipline gates satisfied" loop-until item grows this gate). Both seats run it as a subagent of the harvesting session (top-tier or senior-executor seat — the session `/harvest` already requires).

### D3 — Fail-closed gate (mechanical, mirrors the §1.7 precedent)

- Every PR to `staging` MUST carry a `## Fidelity verdict` PR-body section, one of:
  - `FIDELITY: GO` + `Basis: <kickoff/spec path>` + `Round: <n>` + ≥1 file:line evidence line;
  - `FIDELITY: skipped — <rationale ≥20 chars>` (PRs with no kickoff/spec to check against: tier-0 edits, hotfixes, docs-only, config).
- Enforcement: extend the existing PR-body CI gate family (`discipline-self-check.yml` / `pr-body-prior-art.yml` precedent, PR #1098) with a **deterministic grep** job: section present AND (GO with Basis+evidence | skipped with rationale) → green; missing/malformed/REVISE/STOP → **red required check → merge impossible**. Zero LLM in CI (semantic judgment already happened in-session; CI enforces it cannot be silently absent) — per [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md): the named cold-agent protocol is the detection layer, the CI grep is the fail-closed transport, merge authority stays with the (possibly autonomous) merging session.
- Local mirror in `~/.claude/hooks/git-safety.sh` (validates at `gh pr create/edit` time, earlier channel) — **operator manual item** (agents cannot commit operator globals); the CI arm alone is sufficient fail-closed.
- Trust model note: a fabricated GO without running the auditor is the same violation class as a fabricated §1.7 section — detectable at review/retro, out of mechanical scope by [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md).

### D4 — Acceptance package = PR body under contract

Required sections for **stage PRs** (factory or in-session umbrella stages): existing template sections (Summary, Changes, Prior-art, Test plan, §1.7) plus:

- `## Provenance` — kickoff path; base SHA; substrate (`aif task <id>` + bridge-profile name, or `in-session`); models per stage (plan/implement/review); fidelity `Round` count.
- `## Review findings` — aif internal review outcome + §4 cold code-review summary (or in-session dual-review outcome).
- `## Fidelity verdict` — per D3.
- `## Parked questions` — every parked question + its resolution decision, or `none`.

**Mechanical gate stays minimal-first:** only the Fidelity section (D3) is CI-enforced now; Provenance/Review-findings/Parked are template + prose discipline. Promotion trigger recorded: recurring omissions of a section in merged stage PRs → widen the grep to that section (earliest-channel discipline without day-one gate bloat).

### D5 — Parked-question choreography (routing table, not new machinery)

Bricks stay as-is (`questions.ts` collects, `answer.ts` resolves). `/dispatcher` §Q&A gains the binding routing table:

| Question class | Day | Night (unattended) |
|---|---|---|
| technical / in-scope (implementation choice within kickoff bounds) | dispatcher session resolves autonomously (brainstorm → `answer.ts`), decision recorded in task comment + PR `## Parked questions` | same — autonomous |
| intent / goal / design (changes WHAT to build) | `/arch` §4 office hours, top seat | **stay parked — never guess**; morning batch sweep (`questions.ts --project`) |
| environment (container/tooling broken) | `/aif-doctor` | `/aif-doctor` non-destructive arm; else stay parked |

Sweep triggers: monitor-poll park classification (event-driven, already in `/dispatcher` §2.2) + batch sweep at session start. `answer.ts` runs from the dispatcher session (senior-executor seat per skill frontmatter).

### D6 — Rework loop (external counter, cap 2)

- `FIDELITY: REVISE` at harvest → **no PR is opened**; auditor findings go back via `answer.ts --decision request_changes` (findings text = rework feedback comment) → task returns to `implementing`, aif redoes (internal review cap applies again) → re-harvest with `Round: 2`.
- **Cap: 2 fidelity rounds.** Round-2 REVISE → STOP: do not resume the task; dispatcher surfaces an escalation block in its report (task id, both rounds' findings). Operator decides: fix the kickoff via `/arch` (design drift) or intervene manually.
- `KICKOFF-AMBIGUOUS` flag (D2) → escalate immediately to `/arch` office hours without burning a rework round — reworking code against a broken kickoff wastes both rounds.
- Round counter lives in the aif task comments (written by `answer.ts` feedback) and lands in the PR `Round:` field; the dispatcher loop reads it before re-dispatching — no new storage.

### D7 — Final merge

- Agent squash-merges stage PRs to `staging` autonomously when the package is complete: CI green (including the D3 required check) — the existing auto-merge convention continues, now behind a real gate. Night runs never block on a human.
- `main` unchanged: maintainer-manual promote (head=staging, merge-commit — wall 5).
- Human role shifts from per-PR review to: escalations (D6), intent parks (D5), morning reports.

### D8 — Two-altitudes layout (В3): confirmed at the boundary

Bottom altitude inside the factory (aif GLM review) + at harvest §4 (cold code review); top altitude at the borders: `/arch` before spend, fidelity verdict (D2) after build. The known cost — the top critic arrives late — is accepted because: (1) walls 1-4 make an in-factory top seat an aif fork; (2) the D6 cap bounds wasted spend to ≤2 rework rounds; (3) `/arch` upstream cuts the probability of design-level drift at the source. **Revisit trigger:** ≥3 tasks in 3 months hitting round-2 STOP with design-level drift → reconsider an in-aif top-tier plan-review (requires aif changes — wall 1).

### D9 — First live run (В4) + validation plan

- **Implementation of THIS design is in-session** (discipline-bearing surfaces: skills, CI, CLAUDE.md) — do not dogfood the acceptance contour by building it in a factory that does not yet have one.
- **First live factory run after landing:** one real, small `/arch`-produced task with `<!-- bridge-profile: Z.AI GLM-5.2 SDK -->` (exact unique name — verify against live `GET /runtime-profiles` at dispatch time). Validates in one pass: SDK transport (never ran), live marker resolution (never ran), all-GLM pipeline (D1), fidelity loop v1 (D2/D3/D6).
- Success: task completes; PR merges with `FIDELITY: GO`; zero manual unblocking outside designed seams (parks routed per D5). Pre-made fallback decisions: SDK transport fails → operator flips Task/Review profiles back to the proven API-GLM profile; marker-ambiguity error → fix marker string, redispatch.
- The no-marker fallback path (top-tier plans in aif) is validated later by any direct-dispatch task — deliberately not conflated with run №1.

## §4 Config actions (operator, alongside implementation)

1. aif internal review cap 3 → 5 (`env.ts:113` env knob; exact var name verified at apply time). Cheap insurance for unattended nights; diminishing returns acknowledged (same-reviewer blind spots persist past round 3) — the real quality lever is D2/D6.
2. Verify the executor SDK profile's unique display name before first marker use.
3. Optional: extend `~/.claude/hooks/git-safety.sh` with the Fidelity-section mirror (earlier channel than CI).

## §5 Implementation surfaces (input to the plan)

1. `agents/fidelity-auditor.md` — new cold-agent protocol (D2).
2. `.claude/skills/harvest/SKILL.md` — new §5 (fidelity before `gh pr create`), §4 cross-ref.
3. `.claude/skills/dispatcher/SKILL.md` — §2.4 wiring (fidelity + D6 rework loop + escalation block), §Q&A routing table (D5).
4. `.claude/skills/night-mode/SKILL.md` — PR-gate list grows the Fidelity item (D2 in-session seat).
5. `.github/workflows/` — D3 grep job (extend `discipline-self-check.yml` or sibling of `pr-body-prior-art.yml`).
6. `.github/pull_request_template.md` — D4 sections (Fidelity + Provenance + Review findings + Parked questions).
7. `CLAUDE.md` «Task-tier routing» — D1 amendment; `.claude/skills/arch/SKILL.md` §3 — always-marker rule.
8. Rule-index regen if any `.claude/rules/` file is touched (none planned — D3 cites existing rules).

## §6 Out of scope

- Any aif-handoff code change (walls 1-4): no per-stage model splitting inside aif, no in-aif top-tier review seat, no coordinator LLM routing.
- Automated tier classifier (stays a senior judgment per CLAUDE.md).
- Widening the mechanical gate beyond the Fidelity section (D4 promotion trigger recorded instead).

## §7 Known limitations / residual risks

- **Large-diff fidelity audits:** a single cold pass over a huge stage diff may shallow out. Mitigation now: none (keep v1 simple); recorded trigger — first fidelity miss attributable to diff size → chunked per-file-group audit protocol in `agents/fidelity-auditor.md`.
- **Gate-form gaming:** D3 validates form, not that the auditor actually ran — same trust model as §1.7/Prior-art gates; retro-detectable, accepted per no-paid-llm-in-ci.
- **In-session path adoption lag:** night-mode edits are prose (Class C); if the Fidelity section is skipped there, the CI gate still catches the PR (fail-closed holds); the skill edit is convenience, not the mechanism.
