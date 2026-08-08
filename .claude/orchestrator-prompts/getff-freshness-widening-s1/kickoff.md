<!-- scope: kickoff — getff-freshness-widening STAGE S1 (locks record reality). Parent: .claude/orchestrator-prompts/getff-freshness-widening/kickoff.md §1 S1. Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §7.1. Tier 2 (schema shape is a design decision), NO bridge-profile marker. Container-dispatchable: touches setup.d/ + packages/core/, NOT .claude/**. -->

# getff-freshness-widening S1 — locks record reality

> **Goal:** a generated `rules-lock.<framework>.json` currently cannot answer «which dependency
> versions was this rule set generated against?» — the field exists and is hard-coded `null`.
> Until it records reality, the whole freshness loop downstream (S2's targeted staleness, S3's
> ledger) has nothing truthful to compare against. This stage makes the lock record the
> consumer's **actual** dependency versions at generation time, plus provenance/tier **per rule**.
> **Spec:** §7.1 (BINDING). **Stage gate met:** S0 merged (PR #1279, `1b0968d3b3`).

## §1 What exists today (verified live at `1b0968d3b3` — re-verify before editing, T3)

- **Schema** — `packages/core/installer/types.ts:36-43`:
  `RulesLock { schemaVersion: 1; framework: string|null; version: string|null; ruleIds: string[];
  emittedAt: string; sourceFingerprint: string }`. Note `ruleIds` is a **flat string array** —
  there is **no per-rule field at all**, so «provenance/tier per rule» is an *additive schema
  change*, not a value fix.
- **The three lane writers that hard-code the null** (this is the complete population of
  rules-lock writers — enumerated, not sampled):
  - `setup.d/45-python.sh:624` — `printf '  "version": null,\n'`
  - `setup.d/46-cargo.sh:244` — `"version": null,`
  - `setup.d/47-go.sh:211` — `"version": null,`
- **npm lane** — reaches the lock through `packages/core/installer/` (`install.ts` / `cli.ts`)
  rather than a `setup.d` shell writer; align it in the same shape, do not fork a second schema.

**Scope trap — the grep is wider than the target.** `grep -rn '"version": null'` also hits
`packages/core/research/**`, `packages/core/synthesizer/fixtures/**`,
`packages/core/detector/expected-self-detect.json`. Those are **research-plan / detector
fixtures — a different artefact class**, where `version: null` may be legitimate. **Do NOT sweep
them.** Touch only the rules-lock writers above and whatever the schema change forces.

## §2 Permitted files

- `packages/core/installer/types.ts` — the `RulesLock` schema.
- `packages/core/installer/{install.ts,cli.ts,index.ts}` — only as the schema change forces.
- `setup.d/45-python.sh`, `setup.d/46-cargo.sh`, `setup.d/47-go.sh` — the three lane writers.
- Tests + fixtures for the above, under `packages/core/**` and `tests/install-sh/**`.
- Baseline/snapshot regeneration the change forces (`tests/install-sh/baselines/**`).

**Not permitted:** anything under `.claude/**` (also a hard harness block in the container — see
§6), the spec, any ADR, any other umbrella's kickoff, and the research/detector fixtures named in
§1's scope trap. Recording a fired PARK is not a file write (see `/pipeline §5` park-record
contract): it lands in the park payload + the PR's `## Parked questions`, and its correction lands
as a separate owner commit — so this allowlist deliberately names no park-record artefact.

## §3 «Works» — explicit + testable

1. **Lock content quoted pre/post** (the umbrella §2 criterion, binding): a fixture generating
   against a **pinned-deps** project produces a lock whose `version` carries the REAL resolved
   version, not `null`. Quote the before JSON and the after JSON.
2. **Per-rule provenance/tier present and populated** — not merely present-but-empty. A lock from
   the fixture shows, per rule, where the rule came from and at what tier. An empty or
   uniformly-`null` provenance field is a stage FAILURE, not a pass (T14).
3. **All four lanes aligned on ONE schema** — python, cargo, go, npm produce the same shape.
   Prove it: a schema-parity assertion over the four, not four separate hand-checks.
   (`tests/install-sh/rules-lock-schema-parity.test.sh` already exists — extend it rather than
   writing a second parity checker.)
4. **Machine-readable diff shape asserted** (spec §7.1): two locks generated across a dependency
   bump differ in a way a downstream consumer can diff programmatically. This is what S2 consumes —
   a shape only a human can read fails this criterion.
5. **The scope trap held:** `git diff --name-only origin/staging...HEAD` contains **no**
   research-plan / detector fixture from §1. If one appears, justify it explicitly or revert it.
6. **Backward compatibility stated, not assumed:** `schemaVersion` is currently the literal `1`.
   Say what happens to a consumer holding an old lock — bump, tolerate, or migrate — and encode
   that decision in a test. Silence here is a stage failure.

```bash host-verify
npx vitest run packages/core/installer
bash tests/install-sh/rules-lock-schema-parity.test.sh
npx vitest run packages/core/hooks/deps-hash-check.test.ts
```

## §4 Capability-commit obligation (this stage almost certainly triggers it)

Adding a per-rule provenance/tier structure is a **new format**. Per [CLAUDE.md](../../../CLAUDE.md)
«Build-vs-reuse invariant» this is a capability commit if it lands a new file ≥80 LOC under
`packages/` (or ≥50 LOC under a new `packages/core/<dir>/`). If so, it MUST carry:

1. A [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) SSOT consult —
   lockfile-provenance formats are a well-populated problem space (SLSA provenance, SBOM/CycloneDX,
   npm/pnpm lock `resolved`+`integrity`). **Run the search; do not assert from memory** (T11/T12).
2. A new SSOT row with `Verdict` / `Rationale` / `Trigger to revisit` **in the same commit**, if no
   existing row matches.
3. A `Prior-art:` trailer whose verdict **matches what the body actually does**
   (`#consult-as-trailer-not-input`, [source-before-shape.md §4](../../rules/source-before-shape.md)).

If the change stays under the LOC thresholds, say so explicitly with the count rather than
skipping the question.

## §5 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T3, T10, T11, T12, T14, T16, T19.**

- **T3** — every claim about current behaviour carries command output or file:line. §1's anchors
  were verified live; re-verify before editing, they may have moved.
- **T10** — §1 enumerates the FULL population of rules-lock writers (three) before scoping. Do not
  re-scope from a fresh grep without re-enumerating.
- **T11/T12** — §4's prior-art search happens **at the moment of proposing the format**, from a
  live search, not from training-data recall about SBOM formats.
- **T14** — «the lock has a provenance field now» ≠ «locks record reality». A field populated with
  nulls on the fixture is insufficient coverage, and must be reported as such.
- **T16** — if any upstream lockfile-provenance format is ADOPTED, state «upstream problem class:
  X / our problem class: Y / match? evidence: …». Name-similarity is not a match.
- **T19** — own adversarial cold-review of the diff before handoff; green CI is form, not design.

**Domain-specific traps (S1-specific, NOT in the canonical catalogue):**

- **T-S1-A — fixing the SYMPTOM grep instead of the SOURCE of truth.** The visible defect is the
  literal string `"version": null` in three shell writers, so the path of least resistance is to
  substitute a version variable at those three `printf` sites and call the stage done. That
  satisfies criterion 1 and **fails the stage**: the lock must record the versions the rules were
  actually *generated against*, which is a property of the generation context, not of whatever the
  shell can read at write time. Counter: criterion 4 (machine-readable diff across a dep bump) and
  criterion 2 (per-rule provenance) cannot be satisfied by string substitution — if your diff is
  three one-line `printf` edits, you have not done this stage.
- **T-S1-B — declaring lane parity from the writers instead of the outputs.** Four lanes «aligned»
  is tempting to assert by reading the four writers and observing similar code. Counter:
  criterion 3 demands a parity assertion over generated **outputs**; extend the existing
  `rules-lock-schema-parity.test.sh`. Two writers can look alike and emit divergent JSON.

## §6 Fork discipline — aif agent (non-negotiable)

On ANY genuine fork or ambiguity (two defensible schema shapes, an undecided compatibility policy,
a missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task
to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X /
Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing
a fork to "keep moving" is the failure this whole loop exists to prevent.

**Pre-registered likely park:** criterion 6's backward-compatibility policy (bump `schemaVersion`
vs tolerate an old lock vs migrate it) is a **design decision with a consumer-visible consequence**.
If the spec §7.1 does not settle it, park it — do not choose silently.

**Known harness constraint:** write channels inside the aif container refuse paths under
`.claude/**` (observed 2026-08-07, task `6cfa9c79`). This stage's §2 allowlist deliberately avoids
that surface, so it IS container-dispatchable. If you nonetheless need a `.claude/**` write, that is
a park, never a workaround.

## See also

- Umbrella (BINDING scope): [getff-freshness-widening/kickoff.md](../getff-freshness-widening/kickoff.md) §1 S1 + §2.
- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §7.1.
- Downstream consumer: S2 (targeted staleness) diffs what this stage emits — criterion 4 is its input contract.
- [CLAUDE.md](../../../CLAUDE.md) «Build-vs-reuse invariant» — the §4 capability-commit gate.
