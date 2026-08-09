<!-- scope: kickoff — getff-freshness-widening STAGE S1b (the python lane's provenance PRODUCER), rev 1. Un-parks PARK-S1-7, recorded in PR #1333's `## Parked questions`. Parent: .claude/orchestrator-prompts/getff-freshness-widening/kickoff.md §1 (S1 substrate clause / S2 input contract). Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §7 items 1-2. Tier 2 (fragment keying + dir layout are design decisions), NO bridge-profile marker. Container-dispatchable: touches packages/core/ + setup.d/ + tests/, NOT .claude/**. -->

# getff-freshness-widening S1b — the python lane's provenance PRODUCER (rev 1)

> **Goal:** on the python lane's live researched path every emitted lock rule reads
> `{"provenance":[],"tier":2}` — while the provenance it should carry exists one directory away in
> `.getff/rules-research/*.practice.json`. S1 shipped the per-rule *shape* and a working *reader*;
> the *producer* never existed for this path. Spec §7 item 1 calls per-rule provenance «the
> substrate for what went stale», and item 2 requires the WARN to name «WHICH rules cite the
> changed package» — for the python lane that is unbuildable on an empty substrate.
> **Spec:** §7 items 1-2 (BINDING, quoted in §3 criterion 1). **Stage gate met:** S1 merged
> (PR #1333, `4f68ed560a`).
> **Un-park authority:** PARK-S1-7's recorded revisit trigger («S2's targeted staleness needing
> per-rule provenance for the python lane») had NOT fired at authoring time — no S2 kickoff,
> branch or PR exists (verified 2026-08-09: `gh pr list --search getff-freshness`,
> `git branch -a --list '*getff-freshness*'`, `ls .claude/orchestrator-prompts/`). This stage
> exists because the **operator pulled it forward** on 2026-08-09, which is the other half of the
> un-park condition. Do not re-litigate the un-park.

## §0 Why this is its own stage and not part of S1 or S2

S1 could not close it: the fix needs `packages/core/install/rule-bootstrap-cli.ts`, which S1's §2
did not permit and whose §3 did not name it, and S1's own park clause prescribes PARK for a
forced-but-unlisted file when the stage ships without it. There was no in-§2 alternative —
`packages/core/synthesizer/render-researched-astgrep.ts:20-26` states its own invariant that
«a renderer NEVER gains an fs write».

S2 should not absorb it either: S2's file set (the three `deps-hash-check.sh` copies) is disjoint
from this one, and S2 is **not container-dispatchable** because it writes under `.claude/**`
(umbrella kickoff §5, harness constraint observed 2026-08-07 on task `6cfa9c79`). Folding this
work in would make S2 two-concern AND drag a dispatchable change onto a host-only stage.

## §1 What exists today (verified live at `4f68ed560a` — re-verify before editing, T3)

**Two independent causes, both confirmed by file:line.**

1. **No producer on this path.** `packages/core/install/rule-bootstrap-cli.ts:243` — the
   `--from-practice` arm writes the rule YAMLs and returns
   (`return { mode: 'practice-render', rendered, researchOnly: plan.researchOnly }`) before any
   `emit()` runs. `packages/core/synthesizer/emit.ts:97-103` is the ONLY fragment writer in the
   tree, so no generation-context fragment is ever produced for a researched python rule.
2. **Even if it ran, the keys would not match.** `emit.ts:101` writes `${r.id}.json` where `r.id`
   is the plan id `G{n}` (`generate.ts:52`, `synthesize.ts:90`), while `setup.d/45-python.sh:528`
   looks up `$frag_dir/$it.json` with `$it` = the **delivered** ast-grep rule id (`getff-*`). The
   two namespaces never intersect; the shell falls through to the literal at `45-python.sh:531`.

**The shared-directory hazard the park record did not know about (found 2026-08-09, read-only).**
The fragment dir is one dir for all lanes — `.ai-factory/synthesizer-output/generation-context/`
(`45-python.sh:641-643`). The lanes read it differently:

- **python** looks up **point-wise by id** (`45-python.sh:528`) → stray `G{n}` fragments are inert
  for it. The `G{n}`-vs-`getff-*` split is therefore **not** a collision risk in the python lock.
- **cargo and go glob the whole dir** — `for _rf in "$_frag_dir"/*.json`
  (`46-cargo.sh:257-268`, `47-go.sh:224-232`), concatenating every fragment into their own
  `rules` array. Python-lane fragments written naively into that dir **surface as foreign rules
  inside the cargo and go locks.** Closing this is criterion 4, and it is why those two readers
  are in §2.

**What the producer has to work with.** `runPracticeRender` (`rule-bootstrap-cli.ts:215-244`)
already holds `opts.consumerRoot`, the loaded `records` (each carrying its provenance — e.g.
`getff-researched-no-yaml-load.practice.json` has
`{"url":"https://pyyaml.org/wiki/PyYAMLDocumentation","allowlistKey":"pyyaml","fetchedAt":…}`),
the resolved `ctx` from `resolveCtxForRoot`, and `plan.rendered[].entryId`.

**Two joins you must verify rather than assume (T3 — this kickoff does not decide them):**

- `RenderedResearchedRule` is `{entryId, path, yaml}` (`render-researched-astgrep.ts:71-75`) — it
  carries **no** provenance. `entryId` is set from `result.node.id`
  (`render-researched-astgrep.ts:139`). Whether a record's own id equals that node id (i.e. how to
  join records → rendered entries) is a code fact to establish in `research-to-node.ts`, not to
  infer from filenames.
- `tier` — `Provenance.tier` is optional (`packages/core/research/types.ts:16-21`) and the
  synthesize path stamps it via `stampProvenanceTier` (`synthesize.ts:94`). Whether the practice
  path stamps it at all decides whether a derived `2` here is a real Tier-2 verdict or an
  accidental `DEFAULT_TIER` fallback. Criterion 3 requires you to say which, with evidence.

**Scope trap.** `grep -rn 'provenance' setup.d` also reaches the ruff/clippy ban surfaces and the
research fixtures. This stage touches the **rules-lock fragment path only**.

## §2 Permitted files

- `packages/core/install/rule-bootstrap-cli.ts` — the producer (`runPracticeRender`). The file
  PARK-S1-7 existed for.
- `packages/core/synthesizer/emit.ts` — ONLY if the fragment-writing is factored into a shared
  helper both call. Reusing one writer is preferred over a second implementation
  (`#sync-by-copy-paste`, [dual-implementation-discipline.md §8](../../rules/dual-implementation-discipline.md)); a
  second inline writer must be justified in the PR body.
- `setup.d/46-cargo.sh`, `setup.d/47-go.sh` — ONLY the glob arms named in §1, and ONLY as
  criterion 4 forces.
- `setup.d/45-python.sh` — ONLY if the chosen dir layout moves what the reader must look up. If
  python needs no edit, say so explicitly with the reason.
- Tests + fixtures for the above, under `packages/core/**` and `tests/install-sh/**`.
- Baseline/snapshot regeneration the change forces (`tests/install-sh/baselines/**`).
- `docs/meta-factory/prior-art-evaluations.md` — ONLY if §4 concludes this is a capability commit
  needing a new row. Append-only per that file's §3; never rewrite a row.
- `packages/core/install/synth-and-wire.bundle.mjs` — the generated twin, rebuilt **only** via
  `bash scripts/build-synth-bundle.sh`, never hand-edited. **Conditional:** verified 2026-08-09
  that the bundle inlines `synthesizer/tier.ts` (1 hit) and does **not** inline `emit.ts` or
  `rule-bootstrap-cli.ts` (0 hits), so it goes stale only if you touch `tier.ts`. If it does,
  `packages/core/hooks/pre-push.ts:1144-1145` runs `build-synth-bundle.sh --check` and refuses the
  push — regenerate, do not park (S1 rev-6 precedent: a stale generated twin leaves the stage
  un-shippable, not merely incomplete).

**Forced-but-unlisted file → PARK, with S1's two exceptions.** Do not edit it and do not stop
everything else: park it per §6 with the forcing reason, and finish the rest. The exceptions
(edit and disclose in the PR body's `## Parked questions`) are (a) a file §3 explicitly names as
required-to-edit, and (b) a generated twin whose staleness blocks the push itself.

**Not permitted:** anything under `.claude/**`; `.claude/hooks/deps-hash-check.sh`,
`packages/core/hooks/deps-hash-check.sh` and the plugin twin (**that is S2's file set — touching it
here re-creates the two-concern stage this stage exists to avoid**); the spec; any ADR; any other
umbrella's kickoff; `.github/workflows/**`.

## §3 «Works» — explicit + testable

1. **The producer exists on the LIVE path.** Spec §7 item 1 (quote binding): locks record
   «the provenance+tier per rule — the substrate for "what went stale"». Running the real
   `--from-practice` pipeline against a fixture consumer produces a generation-context fragment
   per delivered rule, with no hand-placed file anywhere in the run. Quote the invocation and the
   resulting directory listing.
2. **The key namespace resolves through the READER.** The fragment the producer writes is found by
   `_py_json_rules` unmodified in its lookup contract — proven by the emitted lock, never by
   asserting that two strings look alike (see T-S1b-B).
3. **Provenance is real, and tier is honest.** For a researched python rule the lock's `rules[]`
   entry carries non-empty `provenance` with the record's `url` / `allowlistKey` / `fetchedAt`.
   A uniformly-empty `provenance` across the fixture is a stage FAILURE (T14). For `tier`: state
   whether the value is a stamped verdict or the `DEFAULT_TIER` fallback, with the file:line that
   decides it. A *derived* 2 and an *accidental* 2 are different artefacts — the S1 r3 audit
   rejected exactly this conflation once already.
4. **Cross-lane contamination closed, both directions tested.** On a tree carrying python
   fragments: the python lock names its own rules, AND the cargo and go locks do **not** gain
   them. On a tree carrying cargo/go fragments (if any lane ever writes them): unchanged
   behaviour. The mechanism (per-lane subdir, filename discipline, or a filter at the glob) is
   your Tier-2 design call; the constraint is that no lane reports another lane's rules.
5. **The new arm REDS before the fix.** Add a `tests/install-sh/python-rules-lock.test.sh` arm
   that runs the real pipeline end-to-end and asserts non-empty `provenance` for a researched
   python rule. **Quote its failing output on the pre-fix tree and its passing output after** —
   a green-only claim does not satisfy this criterion.
6. **Arm (12) is NOT weakened.** The existing arm hand-writes its fragment under the delivered id
   and therefore proves the READER only; its comment and ok-message were narrowed to say exactly
   that (commit «test(install-sh): arm (12) claims the READER, not the producer — PARK-S1-7»).
   Keep it as-is; the new arm from criterion 5 is additive. Broadening arm (12) back into a
   producer claim is a stage FAILURE.
7. **The Node lane is unregressed.** The `G{n}`-keyed fragments from `emit.ts` still work for the
   synthesize/generate path; assert it, do not assume it from «different filenames».
8. **Scope trap held:** `git diff --name-only origin/staging...HEAD` contains no
   `deps-hash-check` copy and nothing under `.claude/**`.

```bash host-verify
npx vitest run packages/core/synthesizer
npx vitest run packages/core/installer
bash tests/install-sh/python-rules-lock.test.sh
bash tests/install-sh/rules-lock-schema-parity.test.sh
bash scripts/build-synth-bundle.sh --check
```

> **Why these five.** The first closes a gate-coverage hole S1 shipped with: S1's four host-verify
> commands never ran `packages/core/synthesizer`, so its acceptance contract could not see this
> defect class at all. The last closes the second hole: `scripts/run-local-ci-sweep.sh` does not
> cover the synth-bundle drift gate that CI runs unconditionally.
>
> **Provisioning caveat for whoever accepts this (measured, not assumed).** Command [5] exits **2**
> with «esbuild not found» on an unprovisioned worktree — the SAME exit code it uses for real
> drift, so an unprovisioned host reads as a failing stage. Observed on this kickoff's own authoring
> worktree; `bash scripts/worktree-node-modules.sh --apply <worktree>` fixed it and the check then
> reported «in sync». Provision before accepting, and read an exit 2 from [5] as
> «tool missing OR drift» until you have looked at its stderr.

## §4 Capability-commit obligation

Judge against [CLAUDE.md](../../../CLAUDE.md) «Build-vs-reuse invariant» (new file ≥80 LOC under
`packages/`, ≥50 LOC under a new `packages/core/<dir>/`, or a new explicit dependency). The
expected shape — a fragment write inside an existing function — falls under all three thresholds;
**if so, say so explicitly with the LOC count and use the escape-hatch trailer.** If you instead
add a new module that crosses a threshold, the governing SSOT row is
[#243](../../../docs/meta-factory/prior-art-evaluations.md) (per-rule array shape, ADOPT
VOCABULARY) — whose recorded revisit trigger literally names «S2 or S3 ships a per-rule provenance
format». Cite it by ID; only re-search if your design leaves that row's scope.

## §5 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T2, T3, T10, T14, T15, T19, T21.**

- **T2** — designing ≠ auditing. «The producer would now write the fragment» is not criterion 1;
  a run with quoted output is.
- **T3** — every claim about current behaviour carries command output or file:line. §1's anchors
  were verified at `4f68ed560a`; re-verify before editing.
- **T10** — enumerate the full population of fragment readers before scoping (three lanes today:
  `45-python.sh`, `46-cargo.sh`, `47-go.sh` — two of them globbing). Do not scope from python alone.
- **T14** — present-but-empty is the exact defect this stage repairs. A fixture that yields empty
  provenance «because the fixture has none» is coverage insufficient to conclude, not a pass.
- **T15** — self-application: this stage's own deliverable is a producer whose absence a green test
  concealed. Say in the PR body what would conceal *this* stage's absence, and whether criterion 5
  actually closes it.
- **T19** — own adversarial cold-review of the diff before handoff. On S1, two independent cold
  seats disagreed on the same branch and the one that ran the pipeline end-to-end was right.
- **T21** — the backward-check enumerates sibling surfaces (the other two lane readers, the Node
  lane, the drift gates), not a recap of this diff.

**Domain-specific traps (S1b-specific, NOT in the canonical catalogue):**

- **T-S1b-A — proving the producer with a hand-placed fragment.** The path of least resistance is
  to write a fixture fragment and watch the lock pick it up — which is precisely what arm (12)
  already does and precisely how this defect stayed green through a whole stage. Counter:
  criterion 1 requires the real `--from-practice` invocation, and criterion 6 forbids reshaping
  arm (12) into the missing proof.
- **T-S1b-B — declaring the key namespace correct by inspection.** `entryId` *looks* like the
  delivered rule id, so the tempting shortcut is to assert the join instead of exercising it.
  Counter: criterion 2 is satisfied only through the reader's own output.
- **T-S1b-C — fixing python and never opening cargo/go.** The brief that motivated this stage
  named only the `G{n}`-vs-`getff-*` question; the shared-dir glob was found by reading the other
  two lanes. Counter: criterion 4, both directions.

## §6 Fork discipline — aif agent (non-negotiable)

On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a
missing detail that changes behaviour) — **do NOT pick.** Park it (`manualReviewRequired` /
`blocked_external`, stated as «Option A → consequence X / Option B → consequence Y») and stop that
task. Proceed only on the unambiguous parts.

**Explicitly NOT forks — these are your Tier-2 design calls, decide them and record the reason:**

- fragment dir layout (shared dir with per-lane filtering vs. per-lane subdirs) — constrained only
  by criterion 4 and by not regressing the Node lane (criterion 7);
- whether the writer is shared with `emit.ts` or separate (§2 states the preference, not a mandate);
- the records → rendered-entries join, once you have established it from the code (§1).

**A genuine fork here would be:** a choice that changes the *lock's shape* (schemaVersion, field
names) — that shape is settled by S1 and SSOT #243, so if your design seems to need it, park.

**Known harness constraint:** container write channels refuse `.claude/**` (observed 2026-08-07,
task `6cfa9c79`). §2's allowlist avoids that surface, so this stage IS container-dispatchable. A
needed `.claude/**` write is a park, never a workaround.

## §7 Egress form traps (cost two red CI rounds on S1 — form, not substance)

- `Audited-SHA` must be **12-40 hex**; a 10-char short SHA is rejected.
- A capability PR needs a literal `Prior-art: prior-art-evaluations.md#N (…)` **line** in the body
  — a `## Prior-art consult` prose section does not satisfy the gate, and `Prior-art: skipped` is
  rejected on capability PRs. If §4 concludes non-capability, the escape-hatch form needs a
  ≥20-char rationale saying *why*.
- The local `git-safety.sh` mirror additionally demands `### §1.7 Skipped:` as an **H3** with ≥60
  chars of rationale.

## See also

- Umbrella (BINDING scope): [getff-freshness-widening/kickoff.md](../getff-freshness-widening/kickoff.md) §1.
- Predecessor stage: [getff-freshness-widening-s1/kickoff.md](../getff-freshness-widening-s1/kickoff.md) — §3 criterion 3 (the per-rule shape this stage populates) and §6 fork 2 (the one-fragment-per-rule composition).
- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §7 items 1-2.
- Downstream consumer: S2 (targeted staleness) — its «WARN names WHICH rules cite the changed package» is unbuildable for the python lane until this stage lands.
- [CLAUDE.md](../../../CLAUDE.md) «Build-vs-reuse invariant» — the §4 gate.
