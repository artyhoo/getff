<!-- scope:meta-orchestrator-f3-substance-followup -->
# Research patch — F.3 substance follow-up: Item 10 fix + known residuals

> **Inherits authority from** [research-patches/README.md](README.md) folder-level Authoritative-for header. Scope-bound to: F.3 substance audit findings from 2026-05-25 — Item 10 fix (MAJOR), Item 8 and principle 18 MINOR observations (known-residuals). **NOT authoritative for** project goal (см. [README.md#why-this-exists](../../../README.md#why-this-exists)); F.3 binding scope — see `2026-05-24-meta-orchestrator-refactor-f3-scope.md`.
> **Date:** 2026-05-25 · **Author session:** claude-sonnet-4-6, Worker dispatch (fix/meta-orchestrator-item10-b5).
> **Tags:** `#meta-orchestrator-tech-debt` · `#launch-table-generator` · `#gap-1-fix` · `#falsifier-as-criterion` · `#smoke-test-gap`

---

## §1.1 — Item 10 fix (MAJOR — was false-negative in F.3)

**Bug:** `detect_subwaves()` in `.claude/skills/meta-orchestrator/helpers/launch-table-generator.sh:47-55` returned 0 sub-waves for `meta-orchestrator-iphase/kickoff.md` even though that kickoff has 4 real sub-waves (A/B/C/D at lines 86-89).

**Root cause (two layers):**

1. **Technical:** F.3 shipped Option A keyword filter (`R-phase|execution|wiring|Mode [AB]|Direct Edit|SDD|Queue mode|I-phase|implementer|reviewer|sub-wave|Sub-wave`). The `meta-orchestrator-iphase` sub-wave content column describes SKILL.md sections (`### §3 Launch-table`, `helpers/launch-table-generator.sh`, etc.) — none of which match any keyword. False-negative was structural, not accidental.

2. **Process:** G binding spec §1.5 Item 10 Falsifier explicitly demanded smoke-test on 3 kickoffs. F.3 author tested on 2 only (meta-orchestrator-followup-audit + mutation-discipline-umbrella); the 3rd test (`meta-orchestrator-iphase`) would have caught this. Falsifier was prose in the spec but not operationalized as a binding acceptance criterion in the implementing PR's checklist.

**Fix: Option B5 — hybrid section-scoped + keyword fallback.**

Primary path: detect a `## §N <Sub-wave|sub-wave>*` section heading via awk state machine. Within that section ALL row-shaped lines are treated as sub-waves (section heading is the scope marker — no keyword filter needed). Section ends at next `## ` heading or EOF.

Fallback path: if no Sub-wave section heading found, fall back to original keyword-filter behavior (preserves backward compatibility for kickoffs without such headings, e.g. template-generated kickoffs).

**Files changed:**
- `.claude/skills/meta-orchestrator/helpers/launch-table-generator.sh` (authoring)
- `skills/meta-orchestrator/helpers/launch-table-generator.sh` (consumer mirror — byte-identical)

**Smoke-test evidence (all 4 pass):**

| Kickoff | Expected | Actual | Path taken |
|---|---|---|---|
| `meta-orchestrator-iphase` | 4 sub-waves (A/B/C/D) | 4 detected ✅ | Primary (has `## §3 Sub-wave decomposition…`) |
| `meta-orchestrator-followup-audit` | 8 sub-waves (1-8) | 8 detected ✅ | Primary (has `## §2 Sub-wave order + dispatch mode`) |
| `mutation-discipline-umbrella` | 0 sub-waves | 0 detected ✅ | Primary (has `## §3 Sub-wave decomposition (Stage gates)` but inside-section rows are `### Stage N` H3 subheadings, not pipe-delimited → row regex matches 0) |
| `meta-orchestrator-linear-autonomous` | 0 sub-waves | 0 detected ✅ | Fallback (no `## §N Sub-wave` heading; keyword filter finds 0 orchestration-mode rows) |

Note on exit codes: `set -euo pipefail` + grep no-match in fallback path causes exit 1 when 0 sub-waves are detected (expected, documented in kickoff §0). STDOUT content is the success signal, not exit code.

**Why B5 over alternatives:**
- vs B6 (broaden keywords): keyword soup grows indefinitely; each new kickoff with different vocabulary needs more keywords. B5 fixes the class of problem.
- vs pure section-scoped (Option B from G §1.5): pure section-scoped fails on kickoffs without a recognizable Sub-wave section heading. Hybrid keeps fallback.

---

## §1.2 — Item 8 MINOR (known-residual, no PR action)

**Observation:** SKILL.md §10 communicates the 3-layer output structure (D-G-2 Option A split) via inline backtick references rather than visual `####` subheadings. Content is correct; scanability is reduced. Full 3-layer structure is at `references/output-format.md`.

**Classification:** MINOR — readable, just less visually scannable. Future UX iteration may revisit.

**Action:** none in this PR. Logged for awareness.

---

## §1.3 — Principle 18 MINOR (known-residual, no PR action)

**Observation:** `packages/core/principles/18-meta-orchestrator-skill.test.ts` validates substring presence in SKILL.md §10 (per the D-G-2 prose-pointer design), not actual header structure. This is appropriate for the current prose-pointer design (testing structure would require the structure to exist first). The test strength matches the current design intent.

**Classification:** MINOR — note for future principle-test rework if §10 grows `####` subheadings. Not a gap in current design.

**Action:** none in this PR. Logged for future reference.

---

## §1.4 — Process lesson

**Lesson: Falsifier line in a binding spec MUST be operationalized as a binding acceptance criterion in the implementing PR's checklist; otherwise it is prose-only and can be silently skipped.**

F.3's binding spec (G companion §1.5 Item 10) said: «Falsifier (INCONCLUSIVE): keyword filter може пропустить sub-waves з нестандартними назвами. Smoke-test: запустити проти 3 різних kickoffs». This was a Falsifier — a criterion that, if run, would have falsified the claim that Option A was sufficient. F.3 author ran 2 of 3 smoke-tests; the 3rd (which would have caught the false-negative) was not run.

The fix is not «be more careful» — it is structural: **Falsifiers in the binding spec must be copied into the implementing PR's acceptance checklist as mechanical gates with evidence**, not prose observations. If a Falsifier is in the spec but not in the checklist, it is structurally skippable.

This lesson is domain-specific T-F3-FU-A from the kickoff §5 AI-laziness traps. It extends the general principle at [`.claude/rules/phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md) (Falsifiers operationalized as binding criteria).

**Anti-pattern:** `#falsifier-as-prose-not-criterion` — Falsifier exists in binding spec but is not copied into the implementing PR's acceptance checklist. Counter: transfer each Falsifier from spec to checklist verbatim when drafting the implementing PR body.

---

## §1.7 — Self-reflexive check (forward + backward)

**Forward-check (this patch complies with existing disciplines):**

- [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md): fix is deterministic bash (awk state machine + grep) — zero API-billed calls. ✅
- [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md): Option B5 does not add new dependencies; awk/grep are POSIX built-ins. No new capability commit (helper stays ≤80 LOC; no new file under `packages/core/<new-dir>/`). ✅
- [doc-authority-hierarchy.md §2-§3](../../../.claude/rules/doc-authority-hierarchy.md): this patch carries scope-bound header + scope HTML comment. ✅
- [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md): both Forward+Backward checks present with file:line evidence. ✅
- [ai-laziness-traps.md §2 T3](../../../.claude/rules/ai-laziness-traps.md): smoke-test evidence includes command + actual output, not just «verified locally». ✅

**Backward-check (new rule applied to existing artefacts):**

This patch introduces a process lesson (`#falsifier-as-prose-not-criterion`) but does NOT introduce a new project-wide rule requiring retroactive sweep. The lesson is descriptive — it names an anti-pattern for future awareness. No existing PR checklist or binding spec is retroactively invalidated. The anti-pattern label is a future-lookup handle for the §3 research-patches accumulator, per [phase-research-coverage.md §3](../../../.claude/rules/phase-research-coverage.md).

The helper change (B5 logic) is a backward-compatible fix — the fallback path preserves existing behavior for kickoffs without Sub-wave section headings. No existing kickoff is adversely affected (verified by smoke tests 3+4: mutation-discipline-umbrella and meta-orchestrator-linear-autonomous both correctly return 0 sub-waves).

---

## §A — See also

- [docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-refactor-f3-scope.md §1.5 Item 10](2026-05-24-meta-orchestrator-refactor-f3-scope.md) — G binding spec Item 10, now updated with follow-up reference line.
- [docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-refactor-design.md](2026-05-24-meta-orchestrator-refactor-design.md) — G primary research patch; context for the full F.3 refactor.
- [`.claude/skills/meta-orchestrator/helpers/launch-table-generator.sh`](../../../.claude/skills/pipeline/helpers/launch-table-generator.sh) — fixed helper (authoring copy).
- [`skills/meta-orchestrator/helpers/launch-table-generator.sh`](../../../.claude/skills/pipeline/helpers/launch-table-generator.sh) — fixed helper (consumer mirror).
- [`.claude/rules/phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md) — Falsifier → binding criterion discipline source.
- [`.claude/rules/ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md) — T3/T4/T7/T15/T17/T19 traps active for this kickoff; T-F3-FU-A domain-specific trap codified in §1.4 above.
