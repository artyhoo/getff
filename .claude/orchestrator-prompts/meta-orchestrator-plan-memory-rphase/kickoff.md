# meta-orchestrator-plan-memory-rphase — R-phase kickoff

> Created 2026-05-25 as successor of `meta-orchestrator-plan-memory` (brainstorm umbrella; closed via PR #227).
> **Phase: R-phase ONLY** — no I-phase, no helpers, no SKILL.md edits. Output is a research-patch with a verdict.
> **Binding scope:** [docs/meta-factory/research-patches/2026-05-25-plan-memory-brainstorm.md](../../../docs/meta-factory/research-patches/2026-05-25-plan-memory-brainstorm.md) — the two design directions + 8 R-phase questions defined there ARE this R-phase's scope. Do NOT re-derive directions; pick between them with evidence.

## §0 Cold-start verify

```bash
git fetch origin staging --quiet
git log -1 --oneline                                               # current HEAD
cat docs/meta-factory/research-patches/2026-05-25-plan-memory-brainstorm.md | wc -l   # binding scope present
cat .claude/skills/meta-orchestrator/SKILL.md | head -80           # current SKILL surface
cat .claude/skills/meta-orchestrator/helpers/plan-currency-check.sh | head -40        # L2 detector (write-back missing half)
wc -l docs/meta-factory/wave-sequencing-plan.md                    # §0 blast-radius input for R-phase Q1
ls .claude/orchestrator-prompts/*/state.md 2>/dev/null | head      # existing state.md companions for R-phase Q4 (falsifier #4)
```

## §1 What this R-phase MUST answer

Each item maps 1:1 to the brainstorm `§5 R-phase questions`. Answer with **evidence** (command output, file:line, DeepWiki excerpt) — not prose-only.

| Q | Brainstorm §5 question | Required evidence |
|---|---|---|
| **Q1** | Write-safety of `wave-sequencing-plan.md` § 0 auto-Edit | line count of §0; worst-case corruption walk-through; recommendation: surgical-Edit on a delimited sub-section vs forbid |
| **Q2** | Cache-drift bash check feasibility at ≤20 LOC for Direction B (markdown+markdown `@dual-pair:`) | actual bash sketch + LOC count + false-positive walk-through on 2-3 synthetic drift cases |
| **Q3** | Concurrent-session frequency (parallel worktrees on plan artifacts) | `git log --grep '@dual-pair\|wave-sequencing-plan' --since='90 days ago'` + worktree-state evidence |
| **Q4** | Bootstrap cost on Direction B (empty cache → first-scan) | `time bash .claude/skills/meta-orchestrator/helpers/plan-currency-check.sh` × 3 runs; cache-seed LOC estimate |
| **Q5** | `memory-codification.md §3` compliance (both directions) | direct citation; verify the artefact qualifies as «durable convention» — answer is mostly YES, but spell out the §3 write-time discipline path |
| **Q6** | `reviewer-discipline.md §2` audit per row in §4 strategy-vs-factual table | one ↦ verdict per row (AUTO / SURFACE) with concrete edge-case test; concrete test from brainstorm §5 Q6 («kickoff exists, no PR ever opened» — factual or strategy?) is mandatory |
| **Q7** | `no-paid-llm-in-ci.md §1` compliance audit | per-component verification: priority re-scoring formula inputs must be deterministic |
| **Q8** | Cline Memory Bank ADAPT boundary — does the cache file need «must read at session start» discipline, or does SKILL.md §1 `!shell` injection cover it already? | direct line cite in current SKILL.md; verdict |

## §2 Verdict shape (REQUIRED output structure)

The research-patch MUST emit ONE of:

- **ADOPT Direction A** — with all 8 questions resolved + I-phase scope hint (which sections of SKILL.md + which helpers change).
- **ADOPT Direction B** — same shape.
- **DEFER** — naming which falsifier (brainstorm §6) bit; specify the precondition that would un-defer.
- **REJECT** — with structural reason (e.g. R-phase finding shows neither direction satisfies `dual-implementation-discipline.md §7`).

NO «we should explore further» / «maybe hybrid» / «punt to maintainer» — the brainstorm already separated brainstorm-vs-R-phase. R-phase commits to a verdict (per `phase-research-coverage.md §1.12` lead-with-recommendation).

**Hybrid is allowed iff** it is concretely specified (e.g. «strategy file = Direction A surface, cache file = Direction B surface, but using single-shared bash check») — naming a hybrid as a punt is `#strategy-decided-by-reviewer`-shaped.

## §3 Prior-art consult — what brainstorm DID and what R-phase MUST EXTEND

**Already surveyed by brainstorm (do NOT re-run for these — cite brainstorm §3 instead):**

- Cline Memory Bank (`cline/cline`) — PROVISIONAL ADAPT (brainstorm §3.1)
- TaskMaster MCP — PROVISIONAL REFERENCE (brainstorm §3.2)
- Superpowers `subagent-driven-development` — REFERENCE only, no cross-session (brainstorm §3.3)
- OpenHands `TaskTrackerAction` — REJECT, SaaS-only (brainstorm §3.4)
- aif-handoff — REJECT (already at SSOT #67)
- Devin Knowledge Notes — REJECT, rule-recall not plan-state (brainstorm §3.6)
- 2026 cloud-memory state-of-art (Mem0/Cognee/LangGraph) — REFERENCE, over-engineered at our scale (brainstorm §3.7)

**MUST EXTEND for R-phase (brainstorm did NOT cover):**

1. **AIF `/aif-evolve` register pattern** — research-patches/ accumulator (`phase-research-coverage.md §3`) IS already a per-incident-patch + distillation pattern. Does the plan-memory feature subsume or align with it? T16 check.
2. **`state.md` companion** (already shipped per SKILL.md §10) — does it already solve the cross-session problem for the single-umbrella case? Brainstorm falsifier #4 asks this; R-phase MUST measure.
3. **Tier-1 source check** per `phase-research-coverage.md §1.13`: Claude Code native (any project-scope memory primitive landed in CC since brainstorm? `/recap`? hooks? `claude-code-guide` MCP), AIF (any plan-mem precedent at `lee-to/aif-factory`), OhMyOpencode (any rule-injector with state?). DeepWiki ≥3 phrasings each; WebSearch ≥3 phrasings for «AI agent persistent project plan 2026».
4. **6-item search-coverage** per `phase-research-coverage.md §1.1-§1.6` on the negative-existence claim from brainstorm §3.3 («No Superpowers skill maintains cross-session plan») — verify by running an adversarial counter-prompt (§1.4).

## §4 Hard constraints

- **`no-paid-llm-in-ci.md §1`** — all R-phase tools session-bound (DeepWiki MCP, WebSearch, bash benchmarks). No API-billed call.
- **`build-first-reuse-default.md §3`** — 6-item search check (own-stack / category / semantic / adversarial / floor / Tier-1) before any BUILD-only verdict.
- **`dual-implementation-discipline.md §7`** — if Direction B chosen, the SSOT-pointer mechanism MUST be specified concretely with file:line target.
- **`memory-codification.md §3`** — if the verdict puts plan in a committed file (both directions do), §3 write-time discipline applies; spell out the pointer/codify path.
- **`reviewer-discipline.md §2`** — R-phase commits to a verdict (Direction A/B/DEFER/REJECT). It does NOT punt back to the maintainer with «which direction do you prefer?» — that's `#strategy-decided-by-reviewer`-shaped at the R-phase level. The maintainer's call is downstream: «ship the R-phase verdict? when?».
- **No drive-by code, no helpers, no SKILL.md edits, no `wave-sequencing-plan.md` edits.** R-phase output is the patch only. I-phase is a separate umbrella.

## §5 Active AI-laziness traps (per `ai-laziness-traps.md §3`)

Canonical traps active for this R-phase:

- **T1** — sampling-based audit floor 5 (R-phase Q3 git-log sweep MUST hit ≥5 candidate commits before closing «no parallel-worktree races observed»).
- **T3** — plausible-looking finding without verification (every Q1-Q8 answer needs command-output / file:line / DeepWiki-quote citation).
- **T4** — premature closure (8 questions, not 6 or 4 — answer ALL).
- **T11** — designing custom plan-memory without prior-art (brainstorm did most of this; §3 above lists the residual extension targets — actually run them).
- **T12** — skipping literature sweep because «brainstorm already did it» — brainstorm DEFERRED 4 items to R-phase; R-phase MUST run them per §3 above.
- **T13** — treating ADOPTED items as zero-work (Cline ADAPT was PROVISIONAL; R-phase confirms with `dual-implementation-discipline.md §7` evidence).
- **T15** — self-application: the R-phase patch's «verdict» itself must declare a Track row admission path for the plan-memory feature in `wave-sequencing-plan.md` (brainstorm §8 final paragraph mandate).
- **T16** — pattern-matching-on-name (Cline «Memory Bank» ≠ our plan-state; brainstorm flagged ~55% match; R-phase must verify the match for the *committed-markdown-file* sub-pattern specifically, not the whole bank concept).
- **T19** — own cold-QA before handoff (R-phase patch handoff to maintainer requires own adversarial cold-review of the verdict before declaring done).
- **T20** — inline-verdict-without-evidence (NO «ADOPT B» without preceding tool-call output for Q1-Q8).

Domain-specific traps:

- **T-PM-RP-A** (NEW for this R-phase) — **«measuring the wrong dimension»**. The 8 questions ask for *evidence*. If a Q1 answer reads «§0 is small, edit is safe» without a `wc -l` number + named worst-case row, that's T-PM-RP-A — measuring a vibe instead of a dimension. Counter: every Q1-Q8 answer includes a literal number / file:line / DeepWiki excerpt; vibes are flagged INCONCLUSIVE.
- **T-PM-RP-B** (NEW for this R-phase) — **«brainstorm-completeness illusion»**. The brainstorm is thorough enough that R-phase is tempted to just paraphrase it. Counter: §3 above specifies exactly what the brainstorm did NOT cover and what R-phase MUST extend. If the R-phase patch's prior-art section is a paraphrase of brainstorm §3 with no new evidence — T-PM-RP-B violation.

## §6 Expected output

A research-patch at `docs/meta-factory/research-patches/<YYYY-MM-DD>-plan-memory-rphase.md` containing:

1. **Header** per `doc-authority-hierarchy.md §3` (Authoritative-for + NOT authoritative-for).
2. **Binding-scope citation** — pointer to brainstorm patch.
3. **Q1–Q8 answers** — each with evidence (command output / file:line / DeepWiki excerpt).
4. **Prior-art extension** — §3 above (AIF /aif-evolve, state.md companion measurement, Tier-1 fresh sweep, 6-item coverage check on Superpowers negative claim).
5. **Verdict** — ADOPT-A / ADOPT-B / hybrid-with-concrete-spec / DEFER-with-precondition / REJECT.
6. **SSOT row proposal** — if ADOPT, propose a new row for `prior-art-evaluations.md` (next free ID — check current max). If DEFER/REJECT, no row.
7. **I-phase scope hint** — which SKILL.md sections + helpers change, NOT actual edits.
8. **§1.7 self-reflexive check** — forward (compliance with existing disciplines) + backward (no existing artefact silently superseded).
9. **§1.7 PR-body mandate alert** — IF the R-phase verdict requires an SSOT row append (touches `prior-art-evaluations.md`), the R-phase PR body MUST include `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` per `meta-orchestrator/SKILL.md §4b`. Otherwise (patch-only, no rule/principle/template edit), §4b does not trigger — note the path-check explicitly in the patch's §closure.

## §7 What this is NOT

- NOT I-phase — no SKILL.md edits, no new helpers, no `wave-sequencing-plan.md` edits.
- NOT brainstorm — directions and questions are FROZEN per the binding-scope patch; R-phase commits to a verdict.
- NOT a maintainer-decision punt — R-phase delivers a verdict; downstream decision is *whether* and *when* to ship I-phase.
- NOT recursive admission — the R-phase's own Track row in `wave-sequencing-plan.md` is added in the I-phase shipping PR (brainstorm §8 mandate), not in the R-phase patch.

## §8 How to dispatch

Paste in a fresh Opus session (Mode A — single R-phase, single Worker):

> Read `.claude/orchestrator-prompts/meta-orchestrator-plan-memory-rphase/kickoff.md` (this file). Then read its binding scope: `docs/meta-factory/research-patches/2026-05-25-plan-memory-brainstorm.md`. Run the R-phase per §1–§6 of the kickoff. Output: a single research-patch at `docs/meta-factory/research-patches/<today>-plan-memory-rphase.md` per §6. Commit on a branch `research/plan-memory-rphase`, open PR to `staging`. Run own cold-QA on the verdict before declaring done (T19). No I-phase, no SKILL.md edits, no wave-sequencing-plan.md edits.

## §9 See also

- [docs/meta-factory/research-patches/2026-05-25-plan-memory-brainstorm.md](../../../docs/meta-factory/research-patches/2026-05-25-plan-memory-brainstorm.md) — binding scope (2 directions + 8 questions + 5 falsifiers)
- [.claude/orchestrator-prompts/meta-orchestrator-plan-memory/kickoff.md](../meta-orchestrator-plan-memory/kickoff.md) — predecessor brainstorm kickoff
- [.claude/skills/meta-orchestrator/SKILL.md](../../skills/pipeline/SKILL.md) — current skill surface
- [.claude/skills/meta-orchestrator/helpers/plan-currency-check.sh](../../skills/pipeline/helpers/plan-currency-check.sh) — L2 detector (write-back missing half)
- [.claude/rules/phase-research-coverage.md §1, §1.7, §1.11–§1.13](../../rules/phase-research-coverage.md) — R-phase discipline
- [.claude/rules/build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md) — 6-item search-coverage
- [.claude/rules/dual-implementation-discipline.md §7](../../rules/dual-implementation-discipline.md) — Direction-B SSOT-pointer requirement
- [.claude/rules/memory-codification.md §3](../../rules/memory-codification.md) — write-time discipline
- [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) — canonical trap catalogue
- [.claude/rules/recommendation-laziness-discipline.md](../../rules/recommendation-laziness-discipline.md) — T20 + verdict-with-evidence
