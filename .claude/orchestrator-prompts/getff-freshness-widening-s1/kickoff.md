<!-- scope: kickoff — getff-freshness-widening STAGE S1 (locks record reality), REV 5: r3 audit repairs — §2 gains the two remaining FORCED files (audit-self.yml lockShape jq; packages/core/ir/convention-node.schema.json) + a park instruction for any fourth. REV 4: r2 audit repairs — §2 permitted-files closure (two omitted files) + §3a derived-not-asserted clarification. REV 3 forks unchanged and NOT re-litigated (version semantics → Option A; PARK-S1-1 → staged-A; PARK-S1-2 → C; PARK-S1-4 → refined-A; operator, 2026-08-08 — see docs/meta-factory/research-patches/2026-08-08-rules-lock-version-semantics-fork.md §9). Parent: .claude/orchestrator-prompts/getff-freshness-widening/kickoff.md §1 S1. Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §7.1. Tier 2 (generation-context manifest shape is a design decision), NO bridge-profile marker. Container-dispatchable: touches setup.d/ + packages/core/, NOT .claude/**. -->

# getff-freshness-widening S1 — locks record reality (rev 5, r3 audit repairs)

> **Goal:** a generated `rules-lock.<framework>.json` currently cannot answer «which dependency
> versions was this rule set generated against?» — the field exists and is hard-coded `null`.
> Until it records reality, the whole freshness loop downstream (S2's targeted staleness, S3's
> ledger) has nothing truthful to compare against.
> **Spec:** §7.1 (BINDING). **Stage gate met:** S0 merged (PR #1279, `1b0968d3b3`).
> **Fork DECIDED (operator, 2026-08-08):** `version` records a **DEPENDENCY** version — Option A
> of [`2026-08-08-rules-lock-version-semantics-fork.md`](../../../docs/meta-factory/research-patches/2026-08-08-rules-lock-version-semantics-fork.md).
> The first S1 run (r1) shipped the opposite reading (consumer's own project version) and was
> withheld from egress; its branch is preserved, see §0.
> **All remaining r1 parks DECIDED the same day (operator):** PARK-S1-1 → staged-A,
> PARK-S1-2 → C, PARK-S1-4 → refined-A — see §6 Decided forks. **No open forks at dispatch.**

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
- SSOT row 241 (lockfile-provenance) was researched in r1 but is **NOT on staging** (verified
  2026-08-08: the SSOT's last row is 240) — it lives only in the bundle. RE-LAND it from the
  bundle, extended with the ADOPT-VOCABULARY note from §6 fork 5, in the SAME commit as the
  `Prior-art:` trailer that cites it (§1.9 existence-check fires on a citation of an unlanded row).
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
- `packages/core/synthesizer/**` — the generation-context manifest emission (§3 mechanism) and
  the `tier` stamp on `SynthesizedRule.research` (PARK-S1-2 → Option C, §6); widened in rev 2-3
  because the decided semantics makes the synthesizer the source of truth for generation facts.
- `packages/core/research/types.ts` — ONLY the additive optional `tier` field on `Provenance`
  (PARK-S1-2 Option C; existing data stays valid).
- `setup.d/45-python.sh`, `setup.d/46-cargo.sh`, `setup.d/47-go.sh` — the three lane writers.
- Tests + fixtures for the above, under `packages/core/**` and `tests/install-sh/**`.
- Baseline/snapshot regeneration the change forces (`tests/install-sh/baselines/**`).
- `docs/meta-factory/prior-art-evaluations.md` — the SSOT row §4 *mandates* re-landing. **Added
  rev 4:** rev 3 omitted it while §4 required editing it, so the stage was undoable as written
  (r2 audit, KICKOFF-AMBIGUOUS finding 1). Append-only per that file's §3 — never rewrite a row.
- `.github/workflows/audit-self.yml` — **ONLY** to (a) wire the criterion-5/7/9 tests this stage
  adds, and (b) update the `lockShape` jq literal, which the `ruleIds`→`rules` rename of
  criterion 3 forces. **(a) added rev 4:** an unwired test is not a gate, so rev 3's omission made
  criteria 5/7/9 unsatisfiable (r2 audit, KICKOFF-AMBIGUOUS finding 2 + the «scope» MAJOR that
  traced to it). **(b) widened rev 5:** rev 4 permitted only test-wiring, but the `lockShape`
  literal asserts the very shape criterion 3 changes — leaving it stale would go red by
  construction (r3 audit KICKOFF-AMBIGUOUS). Any other workflow edit is still out of scope.
- `packages/core/ir/convention-node.schema.json` — **ONLY** the additive optional `tier` field on
  `Provenance`. **Added rev 5:** that schema declares `Provenance` with
  `"additionalProperties": false`, so the §2-permitted `tier` field on `research/types.ts` is
  unrepresentable without it — the schema edit is forced by a change §2 already permits, exactly
  the class rev 4 closed for two other files (r3 audit KICKOFF-AMBIGUOUS).

**Forced-but-unlisted files are a PARK, not a silent edit.** Three revisions have now each
discovered a file the change provably forces but §2 did not list. If you hit a fourth, do NOT
edit it and do NOT stop work on everything else: park it per §6 with the forcing reason
(«file X is required because Y, which §2 permits, cannot be expressed without it»), and proceed
with the rest of the stage.

**Not permitted:** anything under `.claude/**` (hard harness block in the container — §6), the
spec, any ADR, any other umbrella's kickoff, and the research/detector fixtures named in §1's
scope trap. `.github/workflows/**` beyond the single file named above. Park records land in the park payload + PR `## Parked questions` per the `/pipeline §5`
park-record contract, not as file writes.

## §3 «Works» — explicit + testable

> **§3a — DERIVED, not asserted (added rev 4; binding on criteria 1/2/4/6; resolves the r2
> audit BLOCKER without re-opening any rev-3 fork).**
>
> The r2 run read the criteria as «make `version` non-null», found it impossible for the three
> shell lanes, and hard-coded `null` with a justifying comment. Both halves of that are wrong.
> What the criteria require is a **derivation**, not a value:
>
> - **The read is UNCONDITIONAL.** Criterion 2 stands exactly as written — each of the three lane
>   writers MUST consult the generation-context manifest at install time. A `printf`/heredoc
>   literal is not a read, however the surrounding comment justifies it. This is the r2 BLOCKER:
>   `git grep generation-context -- setup.d` returned nothing at `312b2c65fe`, so no lane
>   consults anything.
> - **The resulting VALUE may legitimately be `null`,** per criterion 1's escape clause
>   («if the generation context genuinely has no named dependency, `null` stays legal … and the
>   lock says so honestly») and criterion 6 («null only when the context names no dependency»).
>   Expect `null` for python/cargo/go **today**, for a reason that is structural and must be
>   recorded in the writer's comment rather than asserted: `version` is a **plan-level** field
>   keyed to `framework` (`ResearchPlan {framework, version}`,
>   `packages/core/research/research-plan.schema.json`), and these three are **language** lanes
>   with no single framework dependency. `Provenance` (`packages/core/research/types.ts:4-13`)
>   carries `url`/`allowlistKey`/`fetchedAt`/`packageName?`/`finalUrl?` and **no version field at
>   all**, so no per-rule version exists to lift either. Verify this still holds before relying
>   on it (T3) — if a version field has since appeared, derive from it.
> - **A derived `null` and a hard-coded `null` are different artefacts.** The derived one starts
>   reporting a real version the moment a manifest carries one, with no further code change; the
>   literal never does. That difference is the whole deliverable for these lanes.
> - **Do NOT freeze the blanket `null` into a permanent gate.** `tests/install-sh/rules-lock-schema-parity.test.sh`
>   must not assert «these three lanes are always null» — that would make an unverified
>   present-day claim permanently true by fiat, and would go red on the first lane that gains a
>   named dependency. Assert the derivation instead: manifest present with a version → that
>   value; manifest absent or naming nothing → `null`.
> - **Criteria are NOT re-worded.** Nothing in §3 changes; §3a only states how the existing
>   criteria compose. If you conclude a criterion must be re-worded to match what you built,
>   that is a park (§6), not an edit.
>
> **Shape obligation carried forward:** criterion 2's «POSIX-`grep`/`sed`-extractable» is binding
> on the per-rule slice too, not only on the top-level `version`. The r2 single
> `generation-context.json` satisfies it for `version` (top-level, one field per line at
> `indent=2`), but a nested per-rule array is not shell-extractable without a JSON parser.
> Either demonstrate extraction of the per-rule slice in POSIX shell, or adopt §6 fork 2's
> recommended one-fragment-per-rule composition. This is still your Tier-2 design call.

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
3. **Per-rule provenance/tier — ACTIVE (all three parks decided, §6).** The lock's per-rule shape
   is `rules: Array<{id, provenance: Provenance[], tier}>` — sorted by `id`, named fields only
   (never positional), REPLACING `ruleIds`, landing together with the `schemaVersion: 2` bump
   (§6 forks 3/5). `tier` is stamped at synthesis time onto the rule's research record (additive
   optional field; §6 fork 4) and travels through the manifest — never re-derived at install
   time. Populated for real on the fixture: uniformly-null provenance/tier is a stage FAILURE
   (T14). Update the in-repo shape gates in the same commit: `snapshot.test.ts` lockShape, the
   F11 CORE set in `33-adapter-jig-arm-registry.ts:418-427`, and the parity checker.
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
8. **Backward compatibility — staged policy DECIDED (PARK-S1-1 → staged-A, §6); encode both
   halves in tests:** the version-value change alone is additive under `schemaVersion: 1`; the
   per-rule shape change (criterion 3) lands with `schemaVersion: 2`, and a v2-aware reader
   REFUSES a v1 lock loudly with a «regenerate the lock» remediation message — never a silent
   partial read, never migrate-on-read (an old lock has no per-rule data to migrate). Any
   shipped reader written for v2 (e.g. the future deps-hash S2 parser) branches on
   `schemaVersion` from day one.
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
or ≥50 LOC under a new `packages/core/<dir>/`). SSOT row 241 (lockfile-provenance) was researched
in r1's T12 consult but is **NOT on staging** (verified 2026-08-08: last landed row is 240) — it
lives in the r1 bundle. RE-LAND the row — extended with the ADOPT-VOCABULARY note per §6 fork 5 —
in the SAME commit as the `Prior-art:` trailer that cites it: §1.9 existence-check requires the
cited ID to be landed by-or-before the citing commit. Re-search only if the manifest design
leaves row 241's scope. If the change stays under the LOC thresholds, say so explicitly with
the count.

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

**Decided forks (all operator, 2026-08-08 — do not re-litigate):**

1. **RulesLock.version semantics → Option A (dependency version).** Per the research patch §9.
   Binding on criteria 1/4/5/6.
2. **PARK-S1-3 (shell-lane source) → its Option B (synthesizer-emitted manifest),** by
   implication of the semantics decision — the shell has no other access to the generation
   context. Binding on criterion 2. The manifest's *shape* remains this stage's Tier-2 design
   work; recommended composition: one fragment file per rule id, already in final lock shape, so
   shell lanes select by filename and `cat`-join (no JSON parsing in shell; multi-provenance
   lives INSIDE a fragment — `research.provenance` is already an array, synthesizer/types.ts:72).
3. **PARK-S1-1 (schema compat) → staged-A.** The version-value slice stays `schemaVersion: 1`
   (additive); the per-rule shape slice bumps to `2`, readers refuse v1 loudly («regenerate»).
   Rationale: silent partial reads recreate the silent staleness this umbrella exists to end;
   migrate-on-read cannot invent absent per-rule data. Binding on criterion 8.
4. **PARK-S1-2 (tier source) → Option C.** `tier` is stamped at synthesis time (additive
   optional field beside `fetchedAt`) — tier is a fact about the research moment, like
   `fetchedAt`; re-deriving at install time can silently rewrite history when allowlist/ack
   state moved between generation and install. §2 widened accordingly. Binding on criteria 2-3.
5. **PARK-S1-4 (per-rule shape) → refined Option A.** `rules: Array<{id, provenance, tier}>`
   REPLACES `ruleIds`; sorted by `id`; named fields only, never positional. The r1 Option B
   (parallel `ruleProvenance` map) is REJECTED: its sync with `ruleIds` would be held by a test,
   while the array makes the inconsistency unrepresentable — earlier than any gate. External
   convergence (live-searched 2026-08-08): in-toto/SLSA `subject` and CycloneDX `components`
   are arrays of per-entity objects (CycloneDX 1.6 migrated identity evidence object→array,
   recommending arrays); lockfile-design guidance recommends flat independent sorted entries
   and warns off nested maps (npm's mirrors `node_modules` — problem-class mismatch, T16) and
   positional arrays (bun — «hostile to external tooling»). Verdict class: **ADOPT VOCABULARY**
   (CycloneDX/in-toto shape conventions, no dependency on their schemas) — record in the
   re-landed SSOT row 241 (§4). The fragment dir (one file per rule) is the grep/shell-friendly
   line-oriented surface; the lock stays a single JSON attestation document. Binding on
   criteria 3-5.

**Still-open forks: NONE.** All r1 parks are resolved above (PARK-S1-5 is folded into
criterion 1). The park discipline in this section still applies in full to any NEW fork
discovered during execution.

**Known harness constraint:** container write channels refuse `.claude/**` (observed 2026-08-07,
task `6cfa9c79`). §2's allowlist avoids that surface; this stage IS container-dispatchable. A
needed `.claude/**` write is a park, never a workaround.

## See also

- Umbrella (BINDING scope): [getff-freshness-widening/kickoff.md](../getff-freshness-widening/kickoff.md) §1 S1 + §2.
- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §7.1.
- Fork decision record: [research-patches/2026-08-08-rules-lock-version-semantics-fork.md](../../../docs/meta-factory/research-patches/2026-08-08-rules-lock-version-semantics-fork.md).
- Downstream consumer: S2 (targeted staleness) diffs what this stage emits — criterion 5 is its input contract.
- [CLAUDE.md](../../../CLAUDE.md) «Build-vs-reuse invariant» — the §4 capability-commit gate.
