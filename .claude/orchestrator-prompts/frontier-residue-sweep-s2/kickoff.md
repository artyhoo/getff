# KICKOFF — frontier-residue-sweep S2 (retire the competing dependency spellings)

> **Type:** execution-build, single stage (S2 of the `frontier-residue-sweep` umbrella —
> [`../frontier-residue-sweep/kickoff.md`](../frontier-residue-sweep/kickoff.md) §1 row S2).
> **Origin:** operator routing 2026-08-18, from the skill-harmonization close
> ([`../skill-harmonization-mechanisms/done.md`](../skill-harmonization-mechanisms/done.md)).
> **Base branch:** staging (NOT main).
> **Rigor label (effort-worthiness L0):** `build-and-verify` — factory-internal, reversible.

## §1 Scope (verbatim from the umbrella — do not widen)

Retire the third and fourth spellings of the SAME dependency edge (D-H13 allows exactly one
spelling — the stage table's `Depends on` column):

1. `.claude/skills/orchestrator/references/queue-mode.md:72` («predecessor GO?») and `:251`
   (`ESCALATE:K:blocked-by-prerequisite`) — reword to consume the `Depends on` column /
   `frontier.sh` verdict instead of their own vocabulary.
2. The `**Prerequisite:**` lines in kickoffs under `.claude/orchestrator-prompts/**`
   (re-measure the population by grep before editing — the umbrella counted 6 on
   2026-08-18; trust the re-count, not this number).
3. The unratified prep-doc
   `docs/superpowers/specs/2026-08-17-arch-prep-skill-stack-harmonization.md:347`
   (`Blocked-by:` with no supersession pointer in its header) — add the supersession
   pointer, do not rewrite history.
4. Converting the 11 prose-edge kickoffs to the `Depends on` column
   (`frontier.md` ceiling 5) belongs here too.

**Note on ownership:** `.claude/skills/orchestrator/` is normally read-only for /pipeline
sessions («wrap, never fork»); this stage edits it under an explicit operator-routed
umbrella scope — a deliberate owner-invited edit, cite this kickoff in the commit body.

## §2 Permitted files

- `.claude/skills/orchestrator/references/queue-mode.md`
- `.claude/orchestrator-prompts/*/kickoff.md` (ONLY the `**Prerequisite:**` / prose-edge →
  `Depends on` conversions; no scope edits)
- `docs/superpowers/specs/2026-08-17-arch-prep-skill-stack-harmonization.md` (header
  supersession pointer only)
- `tests/install-sh/baselines/**` + snapshot artefacts (ONLY as `SNAPSHOT_MODE=capture`
  regeneration fallout of shipped-file edits)

Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands
in the park payload + the PR's `## Parked questions`, and its correction lands as a separate
owner commit — so this allowlist deliberately names no park-record artefact.

## §3 Binding constraints (from the umbrella §2 — do not re-derive)

- **Never introduce a second spelling.** The edge is `Depends on` in the stage table; S2
  removes competitors, it does not add a synonym (D-H13, `#parallel-evolution-creep`).
- **Do not fork or edit `frontier.sh`.**
- Editing historical kickoffs converts the dependency SPELLING only — deliverable text,
  scopes, and closed-stage records stay byte-identical outside the converted lines.
- Shipped-file edits (`.claude/skills/**`) require `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`
  with the diff reviewed before committing.
- PR citations in kickoffs use the URL form, never hash-number tokens (dup-detect signal —
  see the umbrella kickoff's citation-form note).

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: T3, T10, T14, T19.

Domain-specific:

- **T-FRS2-A** — trusting the umbrella's counts («6 Prerequisite lines», «11 prose-edge
  kickoffs») instead of re-running the grep enumeration at edit time; the population moves
  with every merged kickoff. §population-enumeration BEFORE editing (T10 applied).
- **T-FRS2-B** — «retiring» a spelling by deleting the line's obligation instead of
  rewording it onto the surviving spelling — the queue-mode pre-dispatch check must still
  CHECK the predecessor, just via the one vocabulary.

## §4c Autonomous aif dispatch — park-don't-guess contract

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to
> `manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
> consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the
> unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists
> to prevent.

## §5 Host acceptance

```bash host-verify
npx vitest run --root packages/core principles/
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash scripts/check-skill-drift.sh
```
