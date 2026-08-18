# KICKOFF — frontier-residue-sweep S1 (executors read the frontier)

> **Type:** execution-build, single stage (S1 of the `frontier-residue-sweep` umbrella —
> [`../frontier-residue-sweep/kickoff.md`](../frontier-residue-sweep/kickoff.md) §1 row S1).
> **Origin:** operator routing 2026-08-18 — «the weightiest residue» of the
> skill-harmonization close ([`../skill-harmonization-mechanisms/done.md`](../skill-harmonization-mechanisms/done.md)).
> **Base branch:** staging (NOT main).
> **Rigor label (effort-worthiness L0):** `build-and-verify` — factory-internal, reversible.

## §1 Scope (verbatim from the umbrella — do not widen)

`/dispatcher` §2.7 «Advance» and `night-mode` pick the next stage by eye —
`grep -rln frontier .claude/skills/` hits only `pipeline/` and `arch/`, and
`night-mode/SKILL.md:35` delegates stage-gate mechanics to `dispatcher` §2. Wire the
frontier read (`bash .claude/skills/pipeline/helpers/frontier.sh <umbrella>`) into the
surface that actually advances stages autonomously. **Bindings, not a fork of the helper.**

**Live proof required (T-FRS1-A):** a dispatcher-path run whose stage choice is traceable to
a `FRONTIER:` line — recorded output in the PR body, not prose that says it should.

## §2 Permitted files

- `.claude/skills/dispatcher/SKILL.md` + `.claude/skills/dispatcher/references/**` + `.claude/skills/dispatcher/helpers/**`
- `.claude/skills/night-mode/SKILL.md` + `.claude/skills/night-mode/references/**`
- `packages/core/skills/dispatcher/**` (tests), `packages/core/hooks/**` only if a new test file is the enforcement arm
- `tests/install-sh/baselines/**` + snapshot artefacts (ONLY as `SNAPSHOT_MODE=capture` regeneration fallout of shipped-file edits)

Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands
in the park payload + the PR's `## Parked questions`, and its correction lands as a separate
owner commit — so this allowlist deliberately names no park-record artefact.

## §3 Binding constraints (from the umbrella §2 — do not re-derive)

- **Do NOT fork or edit `frontier.sh`** — it stays a single emitter owned by `/pipeline`.
  S1 adds consumers, never a second implementation.
- **`done=yes basis=marker-unverified` is not a merge proof.** The wiring MUST keep the
  `gh pr list --search "is:merged … base:staging"` check as the authority and feed its
  verdict back via `MO_FRONTIER_DONE` / `MO_FRONTIER_OPEN`. Dispatching on the marker read
  alone re-opens the false-green class.
- **Respect the documented ceilings** in `.claude/skills/pipeline/references/frontier.md` §6
  — they are measured limits with falsifiers, not bugs.
- **`.claude/skills/pipeline/SKILL.md` sits at 599 lines** against a hard `>600` pre-commit
  gate — but S1 must not need to touch it at all (owner boundary).
- Shipped-file edits (`.claude/skills/**`) require `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`
  with the diff reviewed before committing.
- PR citations in kickoffs use the URL form, never hash-number tokens (dup-detect signal —
  see the umbrella kickoff's citation-form note).

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: T2, T3, T19, T21.

Domain-specific:

- **T-FRS1-A** — declaring done because a binding paragraph was added to
  `dispatcher/SKILL.md`. The failure mode being fixed is «the executor never reads the
  frontier»; proof is an actual dispatch-path run whose stage choice traces to a
  `FRONTIER:` line.
- **T-FRS1-B** — wiring that trusts `done=yes basis=marker-unverified` as a merge proof
  (see §3 constraint 2); a self-test must cover the marker-lies case.

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
npx vitest run --root packages/core hooks/frontier.test.ts
npx vitest run --root packages/core principles/
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash scripts/check-skill-drift.sh
```
