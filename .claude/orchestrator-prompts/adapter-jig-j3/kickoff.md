<!-- scope: kickoff — adapter-jig stage J3 (first stamped family: go). Binding design: docs/superpowers/specs/2026-07-22-adapter-jig-design.md §2 (frozen rows F1-F11) + §3 (22 arms) + §9 J3; umbrella scope: .claude/orchestrator-prompts/adapter-jig/kickoff.md §1 J3 / §2 / §5. Tier 2 — NO bridge-profile marker: the F3 host-derivation node below is a genuine design judgment, so the top tier plans and the executor tier implements + reviews. -->

# adapter-jig J3 — first stamped family: go

> **Type:** I-phase, execution-build. ONE atomic PR against `staging`.
> **Deliverable:** the `go` family stamped end-to-end THROUGH the conformance jig — adapter +
> delivery lane + pinned `golangci-lint` CI arm + scratch red/green pair + BASELINE lockstep —
> with **zero** edits to any frozen contract row and zero skill/IR edits.
> **Why this stage exists:** J3 is simultaneously a feature (top-tier language coverage
> js/ts + python + rust + **go**) and the jig's own acceptance test. If go cannot be stamped
> without touching a frozen row, the jig design failed — that is a STOP, not a workaround.
> **Base branch:** staging.

---

## §0 Cold-start context — read this section, then §1; everything needed is anchored here

The **adapter-factory conformance jig** is this repo's answer to «every ecosystem adapter ships
with its executable proof». It has three parts, two of which are already merged:

- **J1 (merged, PR #1087)** — the FROZEN contract: 11 rows `F1`–`F11` naming what an adapter
  family may NOT vary, at [`docs/superpowers/specs/2026-07-22-adapter-jig-contract.md`](../../../docs/superpowers/specs/2026-07-22-adapter-jig-contract.md), plus the named
  cold-review protocol [`agents/adapter-jig-reviewer.md`](../../../agents/adapter-jig-reviewer.md).
- **J2 (merged, PR #1094)** — the **22-arm conformance suite**, landed INSIDE the existing
  vitest + `tests/install-sh` bash suites (no new runner). The canonical arm list is
  [`packages/core/principles/33-adapter-jig-arm-registry.ts:63-93`](../../../packages/core/principles/33-adapter-jig-arm-registry.ts) (`CANONICAL_ARMS`, exactly 22 ids);
  the meta-check that every arm is registered and paired is
  [`packages/core/principles/33-adapter-jig-arm-registry.test.ts:51`](../../../packages/core/principles/33-adapter-jig-arm-registry.test.ts).
- **J3 (this stage)** — stamp the first NEW family through it.

**Three families are already wired** and are your worked examples — read them before writing
anything: `npm` ([`packages/core/research/ecosystem-npm.ts`](../../../packages/core/research/ecosystem-npm.ts)), `python`
([`ecosystem-python.ts`](../../../packages/core/research/ecosystem-python.ts) + lane [`setup.d/45-python.sh`](../../../setup.d/45-python.sh)), `cargo`
([`ecosystem-cargo.ts`](../../../packages/core/research/ecosystem-cargo.ts) + lane [`setup.d/46-cargo.sh`](../../../setup.d/46-cargo.sh)).
**`cargo` is the closest precedent for go** — a compiled language whose linter is not present in
this execution environment (see §1.3). Mirror its shape, do not invent a new one.

---

## §1 Verified state — re-verified on `origin/staging` @ `264109608` (T3; do not re-derive, do not assume)

### §1.1 Anchors you will touch or must respect

| What | Anchor | Why it matters to J3 |
|---|---|---|
| The 3-method adapter seam (`EcosystemAdapter`) | `packages/core/research/allowlist-resolver.ts:133-137` | **F1 FROZEN** — implement it, never change its signature |
| `ResolveCtx`; absent adapter ⇒ Tier-1 always misses | `allowlist-resolver.ts:164-171` | **F2 FROZEN** |
| `tier1For` host-derivation pipeline | `allowlist-resolver.ts:189-243` | **F3 FROZEN** — the §2.1 hard node; adapters FEED it, never re-implement or bypass |
| Ecosystem prefix set | `packages/core/research/ecosystem-name.ts:22` — `new Set(['npm','cargo','pip'])` | **F4** explicitly permits *extending* the set for a new family. Adding `'go'` here is IN SCOPE and is NOT a frozen-row violation. A family-local name parser WOULD be. |
| Typed-const adapter idiom | `ecosystem-cargo.ts:364`, `ecosystem-python.ts:216` | **F5 FROZEN** — declare `export const goAdapter: EcosystemAdapter = {` verbatim in this idiom; two tripwires regex-detect adapters by it |
| Unwired-adapter tripwire | `packages/core/research/ecosystem-unwired-debt.test.ts:106` — `const BASELINE = 0` | **Arm H1 lockstep.** BASELINE is 0 and MUST STAY 0: an adapter that lands unwired pushes the count above BASELINE and the tripwire goes RED. Wire in the same PR. |
| Adapter precondition tripwire | `packages/core/research/ecosystem-adapter-precondition.test.ts` | Arm H3 population-equality — a new adapter joins this population automatically |
| Delivery-cell grammar | `setup.d/45-python.sh:10-38` (matrix), `:73-79`, `:85-145` | **F7 FROZEN** — cell taxonomy + REFUSE-LOUDLY semantics; cell *file names* vary per family, the grammar does not |
| Firing self-check shape | `setup.d/45-python.sh:388` (`_py_firing_self_check`), wired at `install.sh:216` (source) + `install.sh:227` (call) | **F8 FROZEN** — plant violation in `mktemp -d` ONLY; absent tool ⇒ LOUD degrade printing the exact manual command; **rc=0 always**. ⚠ Do NOT use the census pair `45-python.sh:340-412` / `install.sh:217`: the contract itself marks it «DRIFTED from census, corrected» (`docs/superpowers/specs/2026-07-22-adapter-jig-contract.md:63`), and `:340` is `_py_deliver_ci()` — a different cell. |
| Snapshot byte-identity harness | `tests/install-sh/snapshot.sh` | **F9** — a new lane shifts install fingerprints; baselines are re-captured in this same PR |
| Two-surface CI pin parity | framework: `.github/workflows/audit-self.yml:257` (cache key) + `:271-272` (the exact-pinned rustup install) inside the arm at `:250-274`; consumer mirror: `packages/core/templates/{python,cargo}/github-actions-ci.yml` | **F10 FROZEN** + arm P1 — parity is **two-surface**: the go arm and a `packages/core/templates/go/github-actions-ci.yml` mirror bump together. The contract records the framework anchors as corrected-from-census (`contract.md:65`); use the ones in this row, not the census pair. |
| rules-lock core field set | `packages/core/installer/types.ts:36-43` | **F11 FROZEN** — `{schemaVersion, framework, version, ruleIds, emittedAt, sourceFingerprint}` cross-lane; tool-ban fields are per-lane-named |
| Lane numbering | `setup.d/40-configs.sh`, `45-python.sh`, `46-cargo.sh` | the go lane is `setup.d/47-go.sh`; wire it in `install.sh` mirroring the cargo block at `install.sh:236-252` |

### §1.2 The 22 canonical arms your family must satisfy

`A1 A2 · B1 B2 B3 · C1 C2 C3 C4 · D1 D2 D3 · E1 E2 E3 · P1 · G1 G2 G3 · H1 H2 H3`
(ids + slugs: [`33-adapter-jig-arm-registry.ts:63-93`](../../../packages/core/principles/33-adapter-jig-arm-registry.ts)). Read each arm's registered
implementation before claiming your family satisfies it. **Arm G3 is `zero-skill-core-edits` —
it gates this very stage.**

**Map all 22 → your family explicitly**, and report the mapping in the PR body: for each arm,
either the go-side evidence, or «not applicable — <reason>». Do NOT silently drop an arm. If an
arm's *applicability* to a new family is genuinely ambiguous (E3 `toolchain-freshness-vs-evidence`
is the likely one — cargo implements it through a backend capability-matrix at
`packages/core/backends/cargo/capability-matrix.json` + `firing-runner.ts`, and whether a stamped
family owes the same structure is not settled by the umbrella), **park it** (§3) rather than
deciding it — that call sizes the stage and is not yours to make silently.

### §1.3 LOAD-BEARING ENVIRONMENT FACT — `go` is absent; this changes what you may claim, not what you build

Probed 2026-07-25 on BOTH the execution container and the destination host:

```text
container aif-handoff-agent-1:  command -v go → rc=1 ;  command -v golangci-lint → rc=1
                                (node + python3 + jq + gh + git present; cargo and ruff ALSO absent)
destination host (macOS):       go → ABSENT ;  golangci-lint → ABSENT
container network:              https://proxy.golang.org/ → 200
```

**This is the cargo precedent verbatim, not a blocker.** The cargo lane shipped (PR #1080) with
`cargo` absent from this same container: its firing self-check degrades LOUDLY —
`setup.d/46-cargo.sh:295` prints «cargo not on PATH … firing NOT proven (degrade, NOT green)»
and `:304` reports «a skipped check is NOT green» — while the *authoritative* red/green proof
lands on the **GitHub runner**, where `audit-self.yml:250-274` installs an exact-pinned toolchain.

**Therefore, binding for J3:**

- What you CAN prove where you run: the lane's **degrade path** (tool absent ⇒ loud, rc=0), the
  adapter unit tests, the tripwires, the lock/schema arms, the snapshot lockstep.
- What you must NOT claim: «golangci-lint fired RED». You cannot observe that here. Writing it
  is the exact `#container-green-as-acceptance` defect [`destination-environment-verification.md §4`](../../rules/destination-environment-verification.md)
  names, and T14 makes «tool absent» report as **insufficient**, never as **clean**.
- Where the E1 red/green proof actually lands: the **pinned go CI arm on the runner**. The PR
  body links that workflow run (T-EW-C posture). Until it is green on the runner, E1 is
  unproven — say so plainly in the PR body.
- **«Insufficient (tool absent)» is an honest REPORTING label, never a DoD exit.** It is how you
  describe a local run; it does not let the stage finish. The stage finishes when the runner arm
  is green and linked (§4).

### §1.4 Pre-dispatch obligations carried from the binding spec (§9) — do not skip

The spec's stage-kickoff clause ([design spec §9](../../../docs/superpowers/specs/2026-07-22-adapter-jig-design.md), the paragraph opening «Implementation
is a FUTURE umbrella») binds **every** stage kickoff of this umbrella to four things. They are
restated here because a stage worker reads this file, not the spec's preamble:

1. **In-flight probe naming `ir-unfreeze` + `ecosystem-wiring`.** Both were DONE at authoring
   (`ir-unfreeze` #1084, `ecosystem-wiring` #1086, both carrying `done.md`), and no J3 branch or
   PR existed at `264109608`. **Re-probe anyway before you start** — `gh pr list --state open`
   plus `git ls-remote --heads origin | grep -iE 'jig|go'` — because the window between authoring
   and dispatch is exactly where collisions have historically materialised.
2. **Serialization with `rule-tests-surface` S4 — you are the SECOND mover; this is active, not
   conditional.** J3 IS lock-shape-touching (it ships a fingerprint ladder and a rules-lock
   variant, deliverable 3 + F11). Per umbrella [§3](../adapter-jig/kickoff.md) — marked BINDING —
   the lock-touching arms (D1/D2/D3) and S4 **serialize**: whichever reaches merge second merges
   the other's landed state and re-fires its DoD against the CURRENT lock behaviour. **S4 already
   merged** (#1092, 2026-07-22) and its whole umbrella is closed
   (`.claude/orchestrator-prompts/rule-tests-surface/done.md`, final PR #1093) — so J3 is
   unconditionally the second mover. Practically: branch off post-S4 `staging` (satisfies «merges
   the landed state» by construction) and validate your lock arms against the **current,
   post-S4** deps-hash/staleness behaviour, not against what the design spec described before
   S4 landed. A brand-new lane has no pre-S4 firing to re-fire, so there is no rework here — but
   do not read this row as «no interaction».
3. **Merge-forward, never rebase.** If this PR turns CONFLICTING because staging moved, merge
   `origin/staging` INTO the branch and plain-push. `git rebase` + force-push is a dead end here
   (force-push is blocked for agent sessions in every form). Recipe:
   [`git-conflict-merge-forward.md §2`](../../rules/git-conflict-merge-forward.md).
4. **Staging-placement.** This kickoff is on `staging` before dispatch — that is the precondition
   you inherit, and the same rule applies to anything you author: nothing dispatches off a
   branch-only artefact ([`kickoff-staging-placement.md §1`](../../rules/kickoff-staging-placement.md)).

---

## §2 What to build — five deliverables, ONE atomic PR

1. **Adapter** `packages/core/research/ecosystem-go.ts` — `export const goAdapter: EcosystemAdapter = {`
   (F5 idiom verbatim), implementing the three F1 methods over `go.mod` / the module cache.
2. **Prefix registration** — add `'go'` to `KNOWN_ECOSYSTEM_PREFIXES` (`ecosystem-name.ts:22`) so
   `go:<module-path>` parses; unknown prefixes stay fail-closed to `'unknown'`.
3. **Delivery lane** `setup.d/47-go.sh` — the F7 cell grammar mirrored from `46-cargo.sh`:
   fresh-copy / structural-merge-or-REFUSE / REFUSE + namespaced reference / idempotent re-run /
   namespaced consumer CI workflow / `.override.md` refresh escape, plus the **F8 firing
   self-check** with the loud-degrade branch (`46-cargo.sh:255-305` is the shape) and the
   fingerprint ladder with **no silent degrade** (arm D2 — `46-cargo.sh:202-206`). Wire it into
   `install.sh` mirroring the cargo block at `install.sh:236-252`.
4. **Pinned CI arm** in `.github/workflows/audit-self.yml` — an exact-pinned go toolchain +
   `golangci-lint`, cached, mirroring the rust arm at `:250-274` (`:257` cache key, `:271-272`
   the exact-pinned install). **Installing the toolchain is not the deliverable — FIRING under it
   is.** The rust arm exists so that the cargo live-fire (`packages/core/backends/cargo/firing.test.ts`
   via `firing-runner.ts`) resolves the pinned `rustc` when the suite runs on the runner. Your arm
   must likewise make the go firing path actually execute there; an arm that installs go and fires
   nothing is trap T-AJ3-C. **F10 two-surface pin parity (arm P1):** the framework pin string and
   the consumer mirror `packages/core/templates/go/github-actions-ci.yml` (mirroring the existing
   `templates/python/` + `templates/cargo/` pair) bump together.
5. **BASELINE + snapshot lockstep, same PR** — `ecosystem-unwired-debt.test.ts:106` stays `0`
   because the adapter is wired here; re-capture install fingerprints
   (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) and commit the baselines.

Every arm you touch needs its **RED demonstrated before GREEN** (inverted assertion or violating
stub, output quoted in the PR body). A green-only arm is REFUSED by design (spec §3).

### §2.1 THE HARD NODE — go Tier-1 host derivation vs frozen row F3 (read before writing the adapter)

**F3 freezes this pipeline** (`allowlist-resolver.ts:189-243`, contract row F3 marked
VERIFIED EXACT, arms B1/B2/B3):

```text
prefix dispatch → direct-dep gate → [homepage, repository] → https-host extract
  → canonicalize → reject IP / single-label / punycode / multi-tenant apex → empty-hosts miss
```

**The mismatch:** npm/pip/cargo all have a registry metadata document carrying `homepage` and
`repository`. **Go has none** — the module path itself (`github.com/user/repo`) *is* the identity.

**The binding constraint:** F3's own wording is «Adapters **feed** it; they never re-implement or
bypass it.» So the go adapter must **synthesize** the `[homepage, repository]` surface inside
`readInstalledMeta` from the module path, and hand it to the unchanged `tier1For`. It must NOT
add a go-shaped branch inside `tier1For`, and it must NOT skip the pipeline for go.

**Sub-node (arm B3 `direct-deps-only`):** `go.mod` `require` blocks mark transitive dependencies
`// indirect`. `listDirectDeps` MUST filter those out, or the direct-dep gate silently widens the
Tier-1 trust surface.

**Second sub-node (arm B1 `tier1-trust-poisoned-negative`):** because the host now comes from a
string the *consumer's own manifest* controls, the poisoned-host negative matters more here than
in any prior family. A module path like `evil.example.com/github.com/real/repo` must NOT yield
`github.com`. Prove the negative.

**If — and only if — stamping genuinely cannot be done without editing a frozen row: STOP.**
Do not soften the row. Park it (§3) with the exact row id and the two options. The umbrella's
§5 STOP line and spec §9 both say the same thing: a frozen-row touch means the jig design
failed and the **spec** is revised first, in its own change.

---

## §3 Park-don't-guess contract (non-negotiable)

On ANY genuine fork — two defensible implementations with different consequences, an undecided
design choice, or a missing spec detail that changes behaviour — **do NOT pick.**
**Park it as a question** — state it as «Option A → consequence X / Option B → consequence Y»,
stop that thread, and proceed only on the unambiguous parts.

> The phrase «Park it as a question» above is kept on ONE line deliberately: the autonomous
> pre-dispatch gate is a literal `grep -qi 'park it as a question'` over this file
> ([`pipeline/SKILL.md §5`](../../skills/pipeline/SKILL.md) `#autonomous-dispatch-without-park`),
> and a line-wrap through the phrase makes the gate report a missing contract. Do not re-flow it.

Three park triggers named in advance, so they are recognised rather than guessed through:

1. **Any frozen-row touch (F1–F11).** Park with the row id. This is the STOP line, not a tradeoff.
2. **The F3 synthesis shape (§2.1)** — if you conclude the module path cannot be made to feed
   `tier1For` without a resolver-side change, that is a design fork about the *contract*, not an
   implementation detail. Park it; do not edit `tier1For`.
3. **Scope pressure from the absent toolchain (§1.3)** — if you find yourself wanting to install
   `go` into the container, weaken arm E1, or mark E1 green from a simulation: park instead.
   The CI runner is the designed proving ground; changing that is an owner decision.

---

## §4 «Works» — acceptance

This list IS the DoD. It restates the umbrella's «Works» sentence for J3
([`adapter-jig/kickoff.md` §2](../adapter-jig/kickoff.md)) — if anything below looks weaker than
that sentence, the umbrella wins and this list is the defect.

- All five §2 deliverables in ONE PR; nothing go-related outside it.
- **The scratch consumer red/green pair is demonstrated: fresh dir + `go.mod` → install → plant
  violation → `golangci-lint` fires RED, and a clean control stays GREEN.**
- **The CI arm is green ON THE RUNNER and the workflow run is LINKED in the PR body** (T-EW-C
  posture — the umbrella requires the linked run, not the arm's existence). This is the exit
  criterion for arm E1: because the toolchain is absent locally (§1.3), the runner is where the
  red/green above is actually observed. **A stage whose runner arm is red, absent, or unlinked is
  NOT done** — «insufficient (tool absent)» describes a local run honestly, it does not close the
  stage.
- BASELINE at `ecosystem-unwired-debt.test.ts:106` still `0` and the tripwire GREEN.
- Snapshot baselines re-captured and `SNAPSHOT_MODE=compare` clean.
- All 22 arms mapped to the family in the PR body (§1.2), each with go-side evidence or an
  explicit «not applicable — <reason>»; each arm you touched has its RED-before-GREEN quoted.
  Arms that could not run locally are labelled **insufficient (tool absent)** with the exact
  manual command — never as clean — and are settled by the linked runner result above.
- Zero edits to `packages/core/ir/`, `.claude/skills/rule-tests/`, `agents/rule-test-author.md`
  (arm G3), and zero frozen-row edits.
- PR body carries §1.7 Forward-check + Backward-check (`###` H3 headings, the word «applied»,
  ≥40 non-whitespace chars each, ≥1 `path.ext:N` citation each). The Backward-check ENUMERATES
  sibling surfaces — all three existing lanes, both lock writers, the tripwire pair — it does not
  restate this diff (T21).

The commands that decide acceptance **on the destination host** (note: no `go` command appears
here — by §1.3 that proof is the CI runner's, and the PR body links the run):

```bash host-verify
npx vitest run packages/core/principles/33-adapter-jig-arm-registry.test.ts
npx vitest run packages/core/research/ecosystem-unwired-debt.test.ts
npx vitest run packages/core/research/ecosystem-adapter-precondition.test.ts
npx vitest run packages/core/research/ecosystem-name.test.ts
```

Host baseline before this stage, measured 2026-07-25 on the destination host (macOS, node
vitest 4.1.8): the first three files = **36 tests passing**. A drop below that is a regression
introduced by this stage, not a pre-existing red.

---

## §5 Anti-scope / STOP lines (binding — umbrella §5)

- NO edits to `.claude/skills/rule-tests/`, `agents/rule-test-author.md`, `packages/core/ir/`
  (inherited D2/IR freeze — arm G3).
- NO new test runner. Arms land in the EXISTING vitest + `tests/install-sh` suites.
- NO new freshness/staleness ledger; deps-hash stays the `rule-tests-surface` S4 owner.
- NO go artefacts outside this PR, and NO non-go work inside it (T-AJ-C both-or-neither).
- NO paid LLM in CI — the CI arm re-runs deterministic checks only.
- NO `done.md` — umbrella closure belongs to the harvesting session, not the worker.
- NO installing toolchains into the execution container to make a check pass (§3 trigger 3).

---

## §6 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).
**Active canonical traps for this stage: T2, T3, T11, T14, T15, T19, T20, T21.**

- **T2 / T20** — «the arm exists» ≠ «the arm is proven». Every arm needs its RED observed and the
  output quoted. No verdict sentence without its evidence anchor.
- **T3** — §1.1 anchors were re-verified against the working tree at `264109608`; re-check any
  line you rely on before citing it, and cite `file:line`, never prose-only. Concretely: an
  earlier draft of this kickoff copied the F8 census pair (`45-python.sh:340-412` /
  `install.sh:217`) that the J1 contract had already corrected — a stale anchor survives being
  «cited from an authoritative doc». Trust the file, not the citation.
- **T11** — extending a family adds no new SSOT-class capability (the conformance-kit entry is
  SSOT #226, landed with J1). If you find yourself proposing a NEW mechanism, run the prior-art
  consult first rather than inventing.
- **T14** — an arm that cannot run because `go`/`golangci-lint` is absent is **insufficient**,
  never «clean». This is the single most likely dishonesty in this stage — see §1.3.
- **T15** — self-application: the jig is auditing itself here. Your family's arms must survive
  the same RED-provability rule the suite imposes on every other family.
- **T19** — run your own adversarial cold-review via [`agents/adapter-jig-reviewer.md`](../../../agents/adapter-jig-reviewer.md)
  over the whole diff before declaring done. A green CI is not a design review.
- **T21** — the Backward-check enumerates sibling surfaces (three lanes, both lock writers, the
  tripwire pair); a backward-check whose file list equals this diff's file list is non-conformant.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-AJ-A (carried from the umbrella [§4](../adapter-jig/kickoff.md) and SPECIALISED for J3 — the
  umbrella's wording targets J2's retrofit-run; the substance below is unchanged, the surfaces are
  go's) — «the arm passes because it tests the fixture, not the lane».** An arm wired only to a synthetic go fixture and
  never exercised against the REAL delivered lane artefacts is theatre. This is live for J3, whose
  arms are all newly authored against fresh fixtures. Counter: every arm cites the REAL lane
  file/output it judged — the delivered `setup.d/47-go.sh` output, the emitted lock, the installed
  config — not only the fixture it was developed on.
- **T-AJ3-A — «synthesized the host by bypassing F3».** Building the Tier-1 host inside the go
  adapter and handing `tier1For` a finished answer *looks* like feeding it and is actually a
  bypass — the canonicalize/reject stages never run, and the poisoned-module-path negative (arm
  B1) silently passes. Counter: the adapter returns `[homepage, repository]`-shaped raw values;
  every rejection decision stays in `tier1For`. Falsifier: if removing the reject stage from
  `tier1For` does not change your family's B1 result, you bypassed it.
- **T-AJ3-B — «indirect deps counted as direct».** `go.mod` lists transitive requirements in the
  same `require` block, marked `// indirect`. Treating the block as the direct-dep set widens the
  Tier-1 surface invisibly and arm B3 passes on the happy path. Counter: a paired negative with a
  `// indirect` entry that MUST NOT appear in `listDirectDeps` output.
- **T-AJ3-C — «CI arm written but never fired».** Adding the pinned go arm to `audit-self.yml`
  without a linked green workflow run is the T-EW-C defect: the arm is a claim, not a proof.
  Counter: the PR body links the actual run; if the runner is red, the stage is not done.
