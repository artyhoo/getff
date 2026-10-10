# Bundle composition — §5.5 detail reference

> **Authoritative for:** §5.5 Bundle composition full spec — B1 `bundle-curate.sh` contract, B2 plan-persistence + launch-prompt format, B3a self-evaluation checklist, anti-patterns.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). SKILL.md §5.5 is the live invocation surface; this file is the detail reference.

**Origin:** bundle-autonomous Stage 3 (2026-05-26). Maintainer verdict: meta-orchestrator = planner + router; downstream `orchestrator` skill = executor. Prior-art: [docs/meta-factory/research-patches/2026-05-26-bundle-autonomous-prior-art.md](../../../../docs/meta-factory/research-patches/2026-05-26-bundle-autonomous-prior-art.md).

---

## B1 — bundle-curate.sh full contract

**Usage:**

Run this command now, read its output, and apply it before continuing (required on every invocation):

```bash
.agents/procedures/pipeline/helpers/bundle-curate.sh "<path-to-backlog-file>"
```

**Backlog file format:** one item per line; each non-blank, non-`#` line is either a kickoff file path or a literal description string (same per-item input contract as `classify-work.sh`).

**Internal logic (3 passes):**

1. **Per-item classify + assign:** invokes `classify-work.sh` + `assign-skill.sh`. Handles `MISSING-FILE` (exit 3) cleanly — skips item with reason, does NOT abort the run.
2. **Eligibility filter (B1):** only `fix` + `I-phase-small` pass. `R-phase` / `I-phase-large` excluded with reason `excluded: type=X not in {fix,I-phase-small}`.
3. **File-overlap rejection:** extracts path-like tokens (ending in `.ts|tsx|js|sh|md|yml|yaml|json`) from item description + RATIONALE. If ≥2 candidates share a token → second excluded with reason `excluded: file-overlap with prior candidate`.
4. **Max-5 cap (T-BA-A):** keeps first 5 eligible in input order; excess excluded with reason `excluded: max-bundle-5 cap`.
5. **Output:** markdown table to stdout: `| idx | item-source | classification | dispatch-mode | assigned-skill | file-scope | notes |`.

**MISSING-FILE (J1 fix):** if `classify-work.sh` exits 3 with `MISSING-FILE: <path>` on stderr, item is skipped with that reason. Surface MISSING-FILE rows to maintainer.

**T-BA-C:** bundle = `fix`-class only. R-phase / I-phase-large items = BLOCKER if found in output (B3a check 5 is the semantic backstop; B1 filter enforces mechanically).

**Principle 20** (`packages/core/principles/20-bundle-classification.test.ts`) — mechanical correctness gate: positive (cap + filter + overlap) + paired-negative (broken logic catches).

---

## B2 — plan persistence + launch-prompt format

**Persistence path:** `.claude/orchestrator-prompts/<umbrella-slug>/composed-plan.md` (gitignored). Use the Write tool.

**Composed-plan file format:**

```markdown
# Composed bundle plan — <umbrella-slug>

**Date:** <ISO timestamp>
**Source backlog:** <path to backlog file>

## B1 output table

<paste markdown table from bundle-curate.sh stdout>

## Dispatch order

Recommended dispatch order (dependency + file-touch-risk graded):

1. <item-N> — <reason>
2. …

## Notes

<B3a findings, MISSING-FILE items, maintainer-attention items>
```

**Launch-prompt format:** a single self-contained markdown block the maintainer can copy verbatim into a `/orchestrator <umbrella>` session. Must include: bundle slug, item list with kickoff paths or descriptions, per-item dispatch-mode, per-item assigned-skill, sequencing notes. Must NOT contain any approval grammar or parse-back hooks.

**HARD requirement:** auto-approve is **forbidden**. Meta-orchestrator never auto-invokes `/orchestrator`. The plan + launch-prompt are FOR THE MAINTAINER.

---

## B3a — self-evaluation checklist (before emit)

Run in the live AI session (prose-following). NOT mechanised in `bundle-curate.sh`.

1. **Independence:** genuinely independent? B1 enforces file-scope dedup; also check semantic-overlap (two items touching same skill's SKILL.md → exclude one or surface for split).
2. **Mode coherence:** if 5 items → 5 different modes assigned → suspicious, re-check routing.
3. **Skill coherence:** assigned skill matches task class? (vitest test → vitest; bash hook → none/playwright). Flag mismatch.
4. **Order rationale:** dependency-order / risk-graded / file-touch-graded, or arbitrary? Document.
5. **Caps respected:** bundle ≤5; no `R-phase` or `I-phase-large` → **BLOCKER** if found.

**If ≥1 BLOCKER:** DO NOT emit. Surface: «composed N candidates but blocked on X; please decide».

**If only warnings:** emit with warnings in `## Notes` section.

---

## Anti-patterns

- `#bundle-execution-loop` — meta-orchestrator dispatching Workers, polling `gh pr checks`, or auto-merging. Those belong in downstream `orchestrator` skill.
- `#auto-approve-bypass` — launch-prompt with parse-back grammar («reply GO», «I'll interpret...»). Counter: one-way emit, no response parsing.
- `#bundle-with-ineligible` — including `R-phase` / `I-phase-large` because «there's space». Counter: T-BA-C + B3a check 5.
