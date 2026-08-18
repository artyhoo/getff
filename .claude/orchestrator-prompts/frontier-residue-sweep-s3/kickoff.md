# KICKOFF — frontier-residue-sweep S3 (stale count claims in shipped docs)

> **Type:** execution-build, single stage (S3 of the `frontier-residue-sweep` umbrella —
> [`../frontier-residue-sweep/kickoff.md`](../frontier-residue-sweep/kickoff.md) §1 row S3).
> **Origin:** operator routing 2026-08-18, from the skill-harmonization close
> ([`../skill-harmonization-mechanisms/done.md`](../skill-harmonization-mechanisms/done.md)).
> **Base branch:** staging (NOT main).
> **Rigor label (effort-worthiness L0):** `build-and-verify` — factory-internal, reversible.

## §1 Scope (verbatim from the umbrella — do not widen)

Two pre-existing false count claims in shipped docs:

1. `.claude/skills/pipeline/references/failures.md:1,3` says «F1 through F8» over a
   nine-row table (F9 present at `:18`). Fix the header and the intro line to match the
   real population — count the rows, do not trust either number.
2. The `done.md` files carrying no `- Final PR: #` line (measured 27 of 275 on 2026-08-18,
   PR <https://github.com/artyhoo/getff/pull/1470> §1.7 backward-check — a `done_pr`
   metadata gap, NOT a detection failure, since Layer C3 tags DONE on existence:
   `priority-score.sh:255`). Backfill the line where the final PR is recoverable
   (`gh pr list --search` per umbrella slug); where it is genuinely unrecoverable, write
   `- Final PR: unknown (backfill 2026-08; no PR search hit)` — never invent a number.

**Live proof:** re-run the measurement after the fix — the PR body quotes the before/after
counts (`grep -rL '- Final PR: #' …` style, exact command included).

## §2 Permitted files

- `.claude/skills/pipeline/references/failures.md`
- `.claude/orchestrator-prompts/*/done.md` (ONLY adding the `- Final PR:` metadata line;
  no other edits to closed records)
- `tests/install-sh/baselines/**` + snapshot artefacts (ONLY as `SNAPSHOT_MODE=capture`
  regeneration fallout of shipped-file edits)

Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands
in the park payload + the PR's `## Parked questions`, and its correction lands as a separate
owner commit — so this allowlist deliberately names no park-record artefact.

## §3 Binding constraints (from the umbrella §2 — do not re-derive)

- `done.md` files are closed historical artifacts (CLAUDE.md Artifact Ownership Contract) —
  this stage adds ONE metadata line per file under an explicit operator-routed umbrella
  scope; the narrative text stays byte-identical.
- `failures.md` is part of the shipped `/pipeline` skill: check whether it is in the
  install copy list (`grep -n 'failures.md' setup.d/*.sh install.sh`) and regenerate the
  snapshot if so (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`).
- A backfilled PR number must be verified against `gh pr view <N>` (merged, right repo,
  right umbrella) before it is written — a wrong number is worse than `unknown`.
- PR citations in kickoffs use the URL form, never hash-number tokens (dup-detect signal —
  see the umbrella kickoff's citation-form note).

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: T3, T10, T14, T19.

Domain-specific:

- **T-FRS3-A** — trusting the recorded counts («F1 through F8», «27 of 275») instead of
  re-measuring at edit time; both populations move. Enumerate, then edit, then re-measure
  and quote both runs (T10 + T14 applied).
- **T-FRS3-B** — backfilling a plausible-looking PR number from a slug match without
  opening it — every backfilled number needs a `gh pr view` verification trace.

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
