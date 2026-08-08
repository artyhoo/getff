<!-- scope: kickoff — getff-freshness-widening STAGE S1 (locks record reality), REV 2 after the RulesLock.version semantics fork was DECIDED (Option A, operator, 2026-08-08 — see docs/meta-factory/research-patches/2026-08-08-rules-lock-version-semantics-fork.md). Parent: .claude/orchestrator-prompts/getff-freshness-widening/kickoff.md §1 S1. Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §7.1. Tier 2 (generation-context manifest shape is a design decision), NO bridge-profile marker. Container-dispatchable: touches setup.d/ + packages/core/, NOT .claude/**. -->

# getff-freshness-widening S1 — locks record reality (rev 2, post-fork)

> **Goal:** a generated `rules-lock.<framework>.json` currently cannot answer «which dependency
> versions was this rule set generated against?» — the field exists and is hard-coded `null`.
> Until it records reality, the whole freshness loop downstream (S2's targeted staleness, S3's
> ledger) has nothing truthful to compare against.
> **Spec:** §7.1 (BINDING). **Stage gate met:** S0 merged (PR #1279, `1b0968d3b3`).
> **Fork DECIDED (operator, 2026-08-08):** `version` records a **DEPENDENCY** version — Option A
> of [`2026-08-08-rules-lock-version-semantics-fork.md`](../../../docs/meta-factory/research-patches/2026-08-08-rules-lock-version-semantics-fork.md).
> The first S1 run (r1) shipped the opposite reading (consumer's own project version) and was
> withheld from egress; its branch is preserved, see §0.

## §0 What happened to S1-r1 (read before re-deriving anything)

The first execution (branch `feature/getff-freshness-widening-s1-ed7dd3`, head `4e4ee22730`,
4 commits) is **not merged, not on origin** — a fidelity audit returned REVISE on the semantics
defect, and `.husky/pre-push` correctly refused the red branch. Preserved in two places:

- bundle: `.claude/orchestrator-prompts/getff-freshness-widening-s1/s1-4e4ee22730.bundle`
  (gitignored, host copy at `~/.claude-coordination/rules-as-tests-aif/getff-freshness-widening-s1/`) —
  restore: `git fetch <bundle> refs/heads/feature/getff-freshness-widening-s1-ed7dd3` (needs base `7d44221af3`);
- the aif container worktree for task `ed7dd346-181b-495c-be8b-580273e1c487`.

**Carry these r1 parts forward (independently sound — do not re-derive):**

- `tests/install-sh/rules-lock-schema-parity.test.sh` gained `lock_version_raw()` + `case` arms —
  a **value-level** parity check (reverting a writer to `"version": null` turns it RED). Keep it.
- Lane parity asserted over **outputs** (the npm arm invokes `install()` for real), not over
  writers looking alike. Keep the approach (T-S1-B).
- SSOT row 241 (lockfile-provenance, BUILD with REFERENCE) already researched — cite, don't re-search.
- PARK-S1-5 (go lane) — a model park; its resolution is folded into criterion 1 below.

**Discard from r1:** the `sed`-based `[project]`/`[package]` version extractors in
`setup.d/45-python.sh` / `46-cargo.sh` — they implement the rejected Option B reading AND pass
malformed TOML through (criterion 7).

## §1 What exists today (verified live at `0f3235396e` — re-verify before editing, T3)

- **Schema** — `packages/core/installer/types.ts:36-43`:
  `RulesLock { schemaVersion: 1; framework: string|null; version: string|null; ruleIds: string[];
  emittedAt: string; sourceFingerprint: string }`. `ruleIds` is a **flat string array** — «provenance/tier
  per rule» is an *additive schema change*, not a value fix.
- **The three lane writers that hard-code the null** (complete population, enumerated not sampled):
  - `setup.d/45-python.sh:624` — `printf '  "version": null,\n'`
  - `setup.d/46-cargo.sh:244` — `"version": null,`
  - `setup.d/47-go.sh:211` — `"version": null,`
- **npm lane** — already records the DEPENDENCY version: `install.ts:63` `version: plan.version`
  (parity fixture: `framework:'next', version:'16.0.0'`, `tests/install-sh/npm-lane-parity.mts:26-27`).
  This is the reference semantics; align the shell lanes UP to it, never align npm down.
- **The red gate r1 never touched:** `tests/install-sh/python-rules-lock.test.sh:59` asserts
  `grep -q '"version"[[:space:]]*:[[:space:]]*null'` and is CI-wired via `.github/workflows/audit-self.yml`.
  Criterion 6 re-states it to express the decided intent — never merely flip it to chase green.

**Scope trap — the grep is wider than the target.** `grep -rn '"version": null'` also hits
`packages/core/research/**`, `packages/core/synthesizer/fixtures/**`,
`packages/core/detector/expected-self-detect.json`. Those are **research-plan / detector
fixtures — a different artefact class**. Do NOT sweep them.

## §2 Permitted files

- `packages/core/installer/types.ts` — the `RulesLock` schema.
- `packages/core/installer/{install.ts,cli.ts,index.ts}` — only as the schema change forces.
- `packages/core/synthesizer/**` — ONLY the generation-context manifest emission (§3 mechanism);
  widened in rev 2 because the decided semantics makes the synthesizer the version's source of truth.
- `setup.d/45-python.sh`, `setup.d/46-cargo.sh`, `setup.d/47-go.sh` — the three lane writers.
- Tests + fixtures for the above, under `packages/core/**` and `tests/install-sh/**`.
- Baseline/snapshot regeneration the change forces (`tests/install-sh/baselines/**`).

**Not permitted:** anything under `.claude/**` (hard harness block in the container — §6), the
spec, any ADR, any other umbrella's kickoff, and the research/detector fixtures named in §1's
scope trap. Park records land in the park payload + PR `## Parked questions` per the `/pipeline §5`
park-record contract, not as file writes.

## §3 «Works» — explicit + testable

1. **`version` = DEPENDENCY version, spec quote binding.** Spec §7.1 line 231-232 (quote verbatim,
   it decides this criterion): «record the consumer's actual **dependency** versions at generation
   time (today: `"version": null`)». `version` is the resolved version of the framework/dependency
   the rule set was generated against (npm precedent: `framework:'next', version:'16.0.0'`).
   It is **NOT** the consumer's own `[project]`/`[package]`/`go.mod` version — that reading was
   r1's defect: it fires a false staleness diff on a consumer's own version bump and stays silent
   on the dependency bump S2 exists to catch (research patch §3). A fixture generating against a
   pinned-deps project produces a lock whose `version` carries the REAL resolved dependency
   version; quote the before/after JSON. Go lane: `go.mod` has no project-version concept and
   needs none under this semantics — record the target dependency's version from the generation
   context like every other lane; if the generation context genuinely has no named dependency,
   `null` stays legal (`version: string|null`) and the lock says so honestly.
2. **Generation-context manifest is the source (PARK-S1-3 resolved → its Option B, by implication
   of the decided semantics).** The shell writers cannot know the generation-time dependency
   version — only the synthesizer holds it (r1 proved consumer manifests are the wrong source).
   The synthesizer (Node, generation time) emits a machine-readable generation-context manifest
   alongside the ast-grep YAMLs (exact name/shape = this stage's Tier-2 design decision; it must be
   POSIX-`grep`/`sed`-extractable because install-time shell lanes have no Node). Shell writers
   read `version` from it at install time. This same manifest is the designated carrier for the
   per-rule provenance slice when PARK-S1-2/4 are decided — design it so that slice is additive.
3. **Per-rule provenance/tier — park-pending, stated honestly.** Blocked on PARK-S1-1/2/4 (§6 —
   payloads inlined, decisions still open). Ship the version slice without pretending: the lock's
   per-rule fields stay absent (no present-but-empty theatre, T14). If the parks get decided
   before dispatch, this criterion re-activates in full per the §6 payloads.
4. **All four lanes aligned on ONE semantics AND one schema** — python, cargo, go, npm produce the
   same shape and the same meaning of `version`. Prove it at the VALUE level: extend r1's
   `lock_version_raw()` parity check (§0) so that a writer emitting a project-own version (not
   just `null`) goes RED. Parity over outputs, not writers (T-S1-B).
5. **Machine-readable diff shape asserted for the version slice** (spec §7.1, S2's input
   contract): two locks generated across a DEPENDENCY bump differ programmatically-diffably in
   `version`; two locks across a consumer project-version bump do NOT differ. Both directions
   tested — the second is the r1-defect regression test.
6. **The red gate is re-stated, not flipped.** `tests/install-sh/python-rules-lock.test.sh:59`
   currently asserts `version` IS null. Re-state it to assert the decided intent (dependency
   version from generation context; null only when the context names no dependency). The commit
   message for this edit cites this criterion — a bare green-chasing flip is a stage FAILURE.
7. **Malformed-value vectors closed** (r1 blocker 4): `version = { workspace = true }` (cargo
   workspace inheritance), TOML literal strings (`version = '1.2.3'`), and backslash-bearing
   values must never reach the lock as invalid JSON. Under the manifest mechanism the manifest is
   emitted by `JSON.stringify` (well-formed by construction) — so this criterion is satisfied by
   (a) deleting r1's `sed` extractors (§0 Discard) AND (b) a test proving `JSON.parse` succeeds on
   locks produced from a fixture whose consumer manifests contain exactly those three vectors.
8. **Backward compatibility stated, not assumed** (r1 blocker 2): the version slice changes a
   value, not the schema — encode in a test that the lock stays `schemaVersion: 1` and an
   old-lock reader is unaffected. The full PARK-S1-1 policy decision stays parked for the
   per-rule slice (§6).
9. **The scope trap held:** `git diff --name-only origin/staging...HEAD` contains **no**
   research-plan / detector fixture from §1. If one appears, justify explicitly or revert.

```bash host-verify
npx vitest run packages/core/installer
bash tests/install-sh/rules-lock-schema-parity.test.sh
bash tests/install-sh/python-rules-lock.test.sh
npx vitest run packages/core/hooks/deps-hash-check.test.ts
```

## §4 Capability-commit obligation

The generation-context manifest emission may cross the capability-commit thresholds
([CLAUDE.md](../../../CLAUDE.md) «Build-vs-reuse invariant»: new file ≥80 LOC under `packages/`,
or ≥50 LOC under a new `packages/core/<dir>/`). SSOT row 241 (lockfile-provenance, BUILD with
REFERENCE) already covers this capability area from r1's T12 consult — cite it in the `Prior-art:`
trailer; re-search only if the manifest design leaves row 241's scope. If the change stays under
the LOC thresholds, say so explicitly with the count.

## §5 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T3, T10, T11, T12, T14, T16, T19.**

- **T3** — every claim about current behaviour carries command output or file:line. §1's anchors
  were verified live at `0f3235396e`; re-verify before editing.
- **T10** — §1 enumerates the FULL population of rules-lock writers (three) before scoping.
- **T11/T12** — SSOT row 241 exists; cite it. A manifest design outside its scope re-triggers the
  live search — from search, not training-data recall.
- **T14** — absent per-rule fields stated honestly (criterion 3) beat present-but-empty ones.
- **T16** — any ADOPTED lockfile-provenance format states «upstream problem class: X / ours: Y /
  match? evidence: …».
- **T19** — own adversarial cold-review of the diff before handoff; green CI is form, not design.

**Domain-specific traps (S1-specific, NOT in the canonical catalogue):**

- **T-S1-A — fixing the SYMPTOM grep instead of the SOURCE of truth.** The visible defect is the
  literal `"version": null` at three `printf` sites; the path of least resistance is substituting
  whatever version the shell can read at write time. r1 fell exactly here (consumer's own
  `[project]` version). Counter: criterion 1's spec quote + criterion 5's two-direction diff test
  — a value the shell reads from the consumer's manifest cannot pass them.
- **T-S1-B — declaring lane parity from the writers instead of the outputs.** Counter: criterion 4
  demands the value-level parity assertion over generated outputs; extend r1's
  `lock_version_raw()` checker, do not write a second one.
- **T-S1-C — flipping the red assertion to chase green.** `python-rules-lock.test.sh:59` is RED
  against the fix by design. The lazy path is inverting the grep. Counter: criterion 6 — the
  re-stated assertion must express the decided semantics (dependency version, null only when
  no dependency is named) and the commit message must cite criterion 6.

## §6 Fork discipline — aif agent (non-negotiable)

On ANY genuine fork or ambiguity — **do NOT pick.** Park it (`manualReviewRequired` /
`blocked_external`, fork stated as «Option A → consequence X / Option B → consequence Y») and
stop that task. Proceed only on unambiguous parts.

**Decided forks (do not re-litigate):**

- **RulesLock.version semantics → Option A (dependency version).** Operator, 2026-08-08, per the
  research patch. Binding on criteria 1/4/5/6.
- **PARK-S1-3 (shell-lane source) → its Option B (synthesizer-emitted manifest),** by implication
  of the semantics decision — the shell has no other access to the generation context. Binding on
  criterion 2. The manifest's *shape* remains this stage's Tier-2 design work.

**Still-open forks (parked; payloads preserved from r1 so no session re-derives them —
full text in r1's plan file, summarized binding-part here):**

- **PARK-S1-1 — backward-compat policy** for the schema change: bump `schemaVersion` to 2
  (fail loud) / tolerate v1 at read (silent partial) / migrate-on-read (write-on-read side
  effect). Spec §7.1 is silent. Blocks the per-rule slice only; the version slice is additive
  under `schemaVersion: 1` (criterion 8).
- **PARK-S1-2 — `tier` source**: omit tier (spec deviation) / re-derive at install via the
  research-source-trust resolver (threads resolver into installer) / stamp tier onto
  `SynthesizedRule` at synthesis (cleanest, but edits `packages/core/synthesizer/types.ts` +
  `research/types.ts`). Evidence from r1: neither `SynthesizedRule` (synthesizer/types.ts:54-73)
  nor `Provenance` (research/types.ts:4-14) carries `tier`; it is a property of resolution
  (`allowlist-resolver.ts`), not stored.
- **PARK-S1-4 — per-rule schema shape**: `rules: Array<{id, provenance, tier}>` replacing
  `ruleIds` (breaks readers) / `ruleIds` + parallel `ruleProvenance` record (additive,
  shell-friendly) / keyed `rules: Record<id, {...}>` (loses ordering). Interacts with S1-1/S1-2
  and with criterion 5's diff shape.

**Known harness constraint:** container write channels refuse `.claude/**` (observed 2026-08-07,
task `6cfa9c79`). §2's allowlist avoids that surface; this stage IS container-dispatchable. A
needed `.claude/**` write is a park, never a workaround.

## See also

- Umbrella (BINDING scope): [getff-freshness-widening/kickoff.md](../getff-freshness-widening/kickoff.md) §1 S1 + §2.
- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §7.1.
- Fork decision record: [research-patches/2026-08-08-rules-lock-version-semantics-fork.md](../../../docs/meta-factory/research-patches/2026-08-08-rules-lock-version-semantics-fork.md).
- Downstream consumer: S2 (targeted staleness) diffs what this stage emits — criterion 5 is its input contract.
- [CLAUDE.md](../../../CLAUDE.md) «Build-vs-reuse invariant» — the §4 capability-commit gate.
