# KICKOFF — doc-audit-ship-boundary (meta-launch / AUTONOMOUS audit run)

> **Type:** autonomous legwork Worker (audit only — NO decisions landed, NO maintainer-owned edits). Dispatched via runtime-bridge → aif-handoff.
> **Base branch:** `staging`. First action: `git fetch origin staging && git checkout -b audit/doc-ship-boundary-stage2 origin/staging`.
> **Generated:** 2026-05-31 by `/meta-orchestrator doc-audit-ship-boundary` Stage 1. Supersedes `../doc-audit-ship-boundary/stage-2-autonomous-kickoff.md` (folded in here).
> **You are a walk-away Worker. The maintainer is NOT watching.** Run to completion, then return ONE report. The success bar is NOT "did everything autonomously" — it is "did the legwork AND parked every genuine maintainer-decision instead of resolving it yourself." Over-autonomy is a DEFECT (see §A).

---

## §0 SELF-CONTAINED — decisions inlined (do not depend on local-only files)

This kickoff travels inline via the bridge (`kickoff.ts` embeds full content). It must run even in a fresh `staging` checkout. Committed-on-`staging` files (the rules, the code, the human/AI docs) ARE your audit targets and ARE present. The design doc + the base umbrella kickoff are **optional context if present** (likely absent in a fresh checkout — do NOT fail on their absence).

**Rules the audit checks against (committed on `staging`):** `.claude/rules/doc-authority-hierarchy.md`, `rule-enforcement-channel-selection.md`, `no-paid-llm-in-ci.md`, `dual-implementation-discipline.md §3`; `README.md#why-this-exists` (goal — **maintainer-owned**).

### Decisions (binding, inlined)
- **G1 — ship-boundary doctrine:** ship the injection layer to consumers as a **stack-aware, self-populating** mechanism (generic rule-injector hook + bootstrap template); factory-specific *content* stays home. Deliverable = a per-artifact-class rule.
- **G1-T16 (verify, don't assume):** the stack-detect→populate→update loop exists for **tools** (`skills/tool-bootstrapping`) + **testable** rules (`packages/core/detector-v0/detect-applicable-rules.ts`, `packages/core/research/store/next/*`, `packages/preset-next-15-canonical`) — but NOT for the injection/judgment layer. Extending = **ADAPT**, not done. Verify the reuse-vs-build boundary by file:line. If build-sized → **PARK** (own kickoff? maintainer decides), do NOT build.
- **B1 — audit method:** TWO layers — (1) deterministic grep/count for machine-checkable claims, exhaustive; (2) AI session-bound semantic check for prose (you / dispatch `agents/living-docs-auditor.md`), real findings not bare flags, NO paid CI. Over the FULL doc population. Falsifier: if Layer-2 won't fit one session → B2 risk-weighted + explicit coverage caveat.
- **Two axes (every doc):** "vs reality" (claim vs code/git/`install.sh`) AND "vs goal" (framing vs `README.md#why-this-exists`; catches `doc-authority-hierarchy.md §4 #operational-doc-redefines-goal`).
- **C — goal/path map:** standard 4-part (path / goal re-validated / where-we-are / remaining tail), self-reconciled; goal maintainer-owned.

---

## §1 What to do (Stage 2.0 then 2.1 — sequential)

### Stage 2.0 — one-time local mutation run (audit fuel, NO CI)
```bash
cd packages/core
npx stryker run stryker.config.mjs        2>&1 | tee /tmp/doc-audit-stryker-core.log
npx stryker run stryker.audit-ai-docs.mjs 2>&1 | tee /tmp/doc-audit-stryker-audit.log   # per-file kill: packages/core/reports/mutation/report.json
```
Bash hooks (universalmutator, B.1 verdict SSOT #91): `pip install universalmutator`; operators `exit 0↔1`, `&&↔||`, `set -e↔+e`; run on `end-of-turn-reminder.sh` first (29 branches), test-cmd = the vitest that invokes the hook by path. **Fallback** if it won't stand up: manual break-hook→test-must-fail spot-check on top 2–3 hooks + record coverage caveat (T6/T14). Do NOT block the audit on tooling. Output → theatre-suspect list (high survival).

### Stage 2.1 — doc reconciliation (B1: two-layer, two-axis, self-inclusive)
1. **Enumerate the FULL load-bearing population FIRST** (T10), both audiences: human (`README.md`, `INSTALL.md`, `INSTALL-FOR-AI.md`, `CONTRIBUTING.md`, `docs/runtime-bridge-setup.md`, load-bearing `docs/meta-factory/*`) + AI (`CLAUDE.md`, `.claude/session-bootstrap.md`, `.claude/rules/*`, `.claude/skills/*/SKILL.md`, `agents/*`, shipped twins `skills/*`) **+ this umbrella's own outputs if present** (T15). Write the list before auditing.
2. **Layer 1 (deterministic):** every machine-checkable claim (counts, "X exists", cross-refs) → grep/count, exhaustive; each finding = command + output (T3).
3. **Layer 2 (AI, session-bound):** read prose-judgment claims, judge on BOTH axes (reality + goal). Cite file:line.
4. Test-quality claims checked **against Stage 2.0 results**, never the docs' own assertions (T14).
5. **G1-T16 boundary:** verify by file:line which parts of the existing loop transfer to the injection layer vs need new code; record the reuse-vs-build finding; build-sized → PARK.

---

## §A ANTI-OVER-AUTONOMY — the load-bearing acceptance criterion (maintainer-required 2026-05-31)

> The maintainer's explicit bar: the run must **accumulate questions** where there was genuine uncertainty the maintainer should resolve — NOT silently resolve them. The one-line test:
>
> **If resolving X requires choosing project strategy, interpreting the goal, picking which of two legitimate paths the project takes, or editing a maintainer-owned artifact → PARK it (DECISION-NEEDED). If X is a fact you can verify, or a method this kickoff already fixed → proceed.**

**You MAY decide yourself (proceed):** method/mechanics already fixed here (B1, which grep, enumeration order); whether a machine-checkable claim HOLDS/LIES (evidence, not a decision); classifying a finding as stale/contradiction (reporting).

**You MUST PARK (DECISION-NEEDED, do not resolve):**
- any goal-alignment finding (framing vs README goal) — goal is maintainer-owned;
- any contradiction between two maintainer-owned authority docs — don't pick the winner;
- the G1 doctrine final wording, and any ship-vs-home call for an artifact class where evidence is ambiguous;
- the G1-T16 reuse-vs-build verdict if it implies build work (own kickoff vs bundle);
- G4 mutation-test placement;
- any edit to maintainer-owned artifacts (README goal, `.husky/`, `.claude/rules/` enforcement, `settings.json`) — propose a diff, do not land;
- any "fix" where the right target is ambiguous (fix the doc? the code it describes? the rule under it?);
- all test-fixes (downstream, separately reviewed) — except an UNAMBIGUOUS tautology whose rule is CERTAINLY correct, and only if recorded "was theatre → fixed".

**Mandatory final self-classification gate (before you finish):** list EVERY choice you made during the run. For each, classify: **(a)** fact / method-already-fixed → OK; **(b)** strategy / goal / doctrine / placement / authority-conflict → it MUST be in DECISION-NEEDED, not silently applied. If you find any (b) you resolved silently → that is a defect: move it to DECISION-NEEDED and tag `#over-autonomy-corrected`. An **empty** DECISION-NEEDED batch is itself suspicious (README is already known to lie/drift) → re-check you didn't over-decide.

---

## §2 Return contract (the ONE report)

Write `docs/meta-factory/research-patches/2026-05-31-doc-audit-ship-boundary-findings.md` (add `<!-- scope:doc-audit-ship-boundary-findings -->`) with:
- §Population enumerated (full list + counts).
- §Mutation run (per-file kill %, theatre-suspect list, any caveat).
- §Reconciliation table: per doc → claim → axis (reality/goal) → verdict (HOLDS / LIES / STALE / GOAL-DRIFT / unverifiable-needs-human) → evidence (cmd or file:line).
- §G1-T16 reuse-vs-build boundary finding.
- §DECISION-NEEDED batch — every parked item (per §A) with a **proposed resolution**: "Option A→X / Option B→Y, I propose A because …". Proposed doc fixes as diffs; proposed doctrine wording; proposed G4 placement. NONE auto-applied.
- §Self-classification list (the §A gate output).

Commit the findings doc + open ONE PR to `staging` (findings + proposed diffs in the body — NO maintainer-owned edits landed). If the PR body touches `.claude/rules/**`/`packages/core/principles/**`/`CLAUDE.md`/`agents/**`/`.claude/skills/**` etc., honor the `### §1.7 Forward-check applied` / `### §1.7 Backward-check applied` mandate (H3 headings, ≥40 chars each, ≥1 file:line per section, word "applied").

---

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md §3`)

See `.claude/rules/ai-laziness-traps.md §2`. **Active: T1, T2, T3, T4, T7, T10, T14, T15, T16, T19, T20** + domain traps below.
- **T3 (no prose-only findings):** every "doc lies" = command/file:line.
- **T10 (enumerate before claim):** full population first; "checked a few" is an artifact.
- **T14 (clean ≠ no drift):** low coverage → "insufficient", not "clean".
- **T15 (self-application):** audit this umbrella's own outputs too.
- **T16 (pattern-matching-on-name):** `audit-self.yml` / "full doc audit" — verify actual coverage, not the name; same for the G1-T16 loop (tools/testable ≠ judgment layer).
- **T20 (evidence-backed verdict):** every verdict carries evidence.
- **T-DOC-A — "the doc is the source of truth":** code/git/`install.sh` are truth; docs are the defendant, not the witness.
- **T-DOC-B — "ship boundary feels obvious":** G1 = per-artifact-class rule tied to the goal, applied uniformly, not gut.
- **T-SHIP-C — re-opening the goal under cover of reconciliation:** README §Why-this-exists is maintainer-owned; surface goal-questions as DECISION-NEEDED, never rewrite.

> Blanket "see ai-laziness-traps.md" without the enumeration above = T7 violation. Enumeration + 3 domain traps present (principle 12).

---

## §6 Recursive self-application

This run is the project's thesis ("documents lie; tests don't") turned on the project's own docs. It must audit its own outputs (the findings doc, the map) on the same two axes, not ship fresh unverified prose. The Stage 2.0 mutation run is the "tests don't lie" evidence feeding the "documents lie" audit.

---

## §8 Stop conditions / anti-scope
- Do NOT fix tests before the Stage 2.0 snapshot is recorded (only the unambiguous-tautology inline exception, recorded "was theatre → fixed").
- Do NOT redefine the goal; goal-questions → DECISION-NEEDED.
- Do NOT auto-land edits to maintainer-owned artifacts — propose diffs.
- Do NOT open additional PRs for systemic issues found mid-audit — list as observations.
- Goal-fork or authority-doc contradiction → DECISION-NEEDED, do not pick.
- If universalmutator can't stand up → fallback spot-check + caveat; do NOT block.

---

## §9 Acceptance (what the maintainer + the verifier session check afterwards)
1. ONE findings PR to `staging`; findings doc present; **no maintainer-owned edits landed**.
2. DECISION-NEEDED batch present, each item with a proposed resolution; **non-empty** unless the audit genuinely found zero goal/doctrine/placement/authority items (improbable — flag if empty).
3. The §A self-classification list is present and shows no silently-resolved (b)-class decision.
4. No surprises: branched from `staging`, scope = findings + proposed diffs only, no drive-by PRs.
5. Mutation run captured (or documented tooling caveat).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
