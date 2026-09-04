# ai-doc-audit-version-reconcile — re-audit all branches by the audit's OWN criteria, merge the best

> **Type:** R (re-audit + score each branch by the audit's own rubric) → compare → I (merge best-of-all into one). Single session. Base: staging.
> **Goal:** several parallel implementations of the ai-doc-audit umbrella exist on different branches. **Re-run the audit's OWN context-hygiene criteria on each branch**, score them, take the best per criterion from each, and merge into one BEST version. Recursive self-application: the audit grades its own output branches by its own standard.

## §0 Comparands (verified facts 2026-06-04 — fetch ALL into the worker repo first)

```bash
# NOTE: `ai-doc-audit` (A) is host-local-only, NOT on origin. Use `ai-doc-audit-fixed`
# as comparand A — byte-identical to ai-doc-audit (verified 2026-06-04).
git fetch origin staging ai-doc-audit-fixed ai-doc-audit-v2 2>&1
```

| ID | Branch | Ahead of staging | `.claude/rules` lines | Nature |
|---|---|---|---|---|
| **A** | `ai-doc-audit` | 21 | 898 | Full impl + aggressive COMPRESS-TO-DIGEST |
| **A'** | `ai-doc-audit-fixed` | 21 | 898 | **Byte-identical to A** (verify: `git diff A...A' --stat` empty) — score once, note dup |
| **B** | `staging` (live) | baseline | 1212 | Same audit via aif; compression then **#418 restored 4 rule bodies** |
| **C** | `ai-doc-audit-v2` | 8 | spec/plan only | Planning subset, no impl — score for spec quality only |

The headline tension: **A is 314 lines (26%) leaner** (better on the always-on-minimal criterion) but **B's #418 restored 4 bodies**, implying A may have **over-deleted load-bearing rule content**. The re-audit must settle this per-rule, not by line count alone.

## §1 The rubric = the audit's OWN criteria (do NOT invent new ones)

Source rubric: `docs/superpowers/specs/2026-06-04-ai-doc-audit-design.md` (lives on branch A — read it there) + the umbrella spine. Score EACH branch on EACH criterion with **deterministic instruments where they exist**:

| # | Criterion (the audit's own) | Instrument (deterministic) | What "better" means |
|---|---|---|---|
| 1 | **Always-on minimal** (lean context) | `bash scripts/measure-always-on.sh` (exists on A) — total bytes/sources | fewer always-on bytes = better — BUT only if criterion 2 holds |
| 2 | **Rule = executable artifact intact** (rules-as-tests) | `npm run -w packages/core test:principles` on each branch | all principle tests GREEN; a digest that drops a Class header / required section / falsifiable anti-pattern and fails a test = REGRESSION, not improvement |
| 3 | **No load-bearing content lost** | per-rule `git diff B...A -- <rule>`; classify dropped chunks LOAD-BEARING (named anti-pattern + falsifier, Class line, promotion/retirement criterion, executable-artifact pointer) vs PROSE-DECORATION | dropping decoration = good; dropping a falsifier/Class/criterion = bad |
| 4 | **Doc-authority headers** | `npm run … 09-doc-authority` + grep `Authoritative for` | present + non-contradicting on each rule |
| 5 | **No broken internal links** | adapted `check-skill-drift.sh` broken-ref scan over the branch | zero genuine broken refs |
| 6 | **AI-agnostic** (no harness-lock) | grep for brand-name hard-deps in shipped artefacts | degrades gracefully; no `"claude"`-string gating |
| 7 | **Cycle-0 instruments quality** | inspect `measure-always-on.sh` / `probe-channels.sh` (A has them) | does the live branch (B) even have them? if A's are better, adopt |

## §2 Method (per-rule, evidence-based — T3 no prose-only)

For each rule in the diff set (`ai-laziness-traps`, `build-first-reuse-default`, `memory-codification`, `recommendation-laziness-discipline`, `reviewer-discipline`, `no-paid-llm-in-ci`, `parallel-subwave-isolation`):
1. Run criteria 1-6 on A's version and B's version.
2. **Per-rule verdict:** `TAKE-A` (digest leaner AND tests green AND no LOAD-BEARING lost) / `TAKE-B` (A dropped LOAD-BEARING → B's body wins) / `MERGE` (A's compression good for some §, B's content needed for others → hand-merge the best of each).
3. The "best" version of each rule = the winner; assemble them into the merged result.

## §3 Deliverable

1. `version-reconcile-verdict.md` (CANON): per-rule scoring table (all 7 criteria, A vs B, instrument output quoted) + per-rule verdict + **overall**: which branch is best wholesale, or the cherry-pick map.
2. **The BEST merge:** a fresh branch from `staging` applying the per-rule winners (TAKE-A rules adopt A's digest; TAKE-B keep B; MERGE = hand-combined). Atomic commit per rule. Verify: `measure-always-on.sh` shows the achieved line-count, ALL principle tests green, zero broken refs. → PR to staging.
3. Adopt A's Cycle-0 instruments (`measure-always-on.sh` etc.) if B lacks better ones.

## §4 Disciplines (mandatory)
- **Recursive self-application (T15):** this IS an ai-doc audit — apply criteria 1-6 to the verdict doc itself; keep it lean.
- **T3:** every score carries instrument output (test result / measure-always-on bytes / diff), never prose-only.
- **T16:** A and B are NOT "same audit twice" — they made different JUDGMENT calls on what's load-bearing. The #418 restoration is B's evidence that A over-compressed 4 bodies; verify that claim per-rule (is each restored body genuinely load-bearing, or was the restoration over-cautious?). Compare judgments, not just sizes.
- **Don't blind-adopt A** (leaner ≠ correct) and **don't blind-keep B** (restoration may be over-cautious) — the per-rule instrument verdict decides.

## §5 Cleanup (after merge — DESTRUCTIVE, operator GO)
Stale branches A/A'/C and the aif `feature/ai-doc-audit-*` workers become deletable once the BEST is merged. PARK as ATTN-operator; do NOT auto-delete.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
