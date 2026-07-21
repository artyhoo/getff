<!-- scope: kickoff — adapter-jig umbrella. Design base (BINDING): docs/superpowers/specs/2026-07-22-adapter-jig-design.md (cold-reviewed GO×2, /arch §2 two-altitude). Builds the adapter-factory conformance jig: frozen contract F1-F11 + 22-arm suite + named cold-review protocol. Tier 2 (no bridge-profile marker; top tier plans, executor implements). -->

# adapter-jig — kickoff

> **Goal:** the adapter-factory conformance jig exists as executable artifacts AND stamps its
> first family: the frozen contract (spec §2, F1-F11) extracted into checked form, the 22-arm
> conformance suite (spec §3) landed inside EXISTING suites and retrofit-run against the three
> wired lanes, and the **go family stamped end-to-end THROUGH the jig** (J3 — demand trigger
> pulled by the operator 2026-07-22: top-tier language coverage js/ts + python + rust + go) —
> closing the «every adapter ships with its executable proof» lift the ecosystem-wiring retro
> motivated.
> **What exists (re-verify live per T3):** three wired lanes (npm default; python W2 #1076 +
> W3 #1078; cargo W2 #1076 + W4 #1080); BASELINE=0 (`ecosystem-unwired-debt.test.ts`);
> `EcosystemAdapter`/`ResolveCtx` seam (`allowlist-resolver.ts`); delivery-cell grammar +
> firing self-checks (`setup.d/45-python.sh`, `46-cargo.sh`); snapshot harness; W5 (#1082)
> researched-python live path — merge state MUST be re-probed at dispatch.

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement:** this kickoff + the spec MUST be on `origin/staging` before any
  dispatch ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **Pre-dispatch in-flight probe** MUST explicitly cover: `ecosystem-wiring` (W5/W6 may still
  be in flight — J2's retrofit-run consumes their merged state; do NOT dispatch J2 while a
  lane-touching W-stage PR is open), `rule-tests-surface` (S1-S5 may run in parallel — §3
  edge), and `ir-unfreeze` (no shared files expected; re-probe after any Phase -1 review).
- **Parallel-with:** `rule-tests-surface` umbrella-level PARALLEL-OK — file surfaces disjoint
  by construction (its S1 skill/agent files are this umbrella's STOP lines; its S4 deps-hash
  seam is likewise a STOP line here). ONE stage-level edge only — see §3.

## §1 Stages (each = one PR onto staging; do NOT collapse)

- **J1 — contract extraction.** Freeze spec §2 into checked artifacts: contract doc + exported
  contract types + the F1-F11 checklist + the named cold-review protocol
  `agents/adapter-jig-reviewer.md` (spec §5 step 2 — clause (b) must exist as an artifact at
  first use). Capability commit: new SSOT entry (conformance-kit problem class — spec §6
  negative finding: zero existing rows) AFTER the DeepWiki companion-pool residual runs (CC,
  AIF, oh-my-openagent — the recorded falsifier). `Prior-art:` trailer. No behaviour change.
- **J2 — conformance-suite assembly (no new runner).** Land the 22 arms (spec §3) INSIDE
  existing suites (vitest `packages/core/` + `tests/install-sh` bash); pairing enforced by a
  meta-check in the EXISTING principles suite. Retrofit-run against npm/python/cargo —
  findings expected, each lands as fix + arm. The retrofit-run DOUBLES as the DN-J1 drift
  probe (spec §6): measure 45-python↔46-cargo shared-grammar drift; non-trivial ⇒ extract the
  shared delivery-cell library (2B-standardize precedent) in this stage; trivial ⇒ record the
  measurement and keep per-lane glue. *(The DN-J2 dry-stamp rehearsal is SUPERSEDED — J3's
  demand trigger was pulled, so the rehearsal collapses into J3's real stamping run.)*
- **J3 — first stamped family: go (demand ARRIVED — operator trigger 2026-07-22, strategic
  top-tier coverage js/ts + python + rust + go).** Executes after J2. DoD = spec §9 J3: stamp
  end-to-end THROUGH the jig — adapter + delivery lane + pinned golangci-lint CI arm +
  scratch red/green pair — zero skill/IR edits, BASELINE lockstep; touching a frozen row ⇒
  STOP and revise the spec first (this STOP line carries the superseded rehearsal's
  contract-validation duty).

## §2 «Works» per stage

J1: the F1-F11 checklist is checkable (each row → its arm/gate reference resolves); the
reviewer protocol executes on a synthetic diff and returns one-verdict-per-group. J2: all 22
arms GREEN on the three wired lanes with RED-provability demonstrated (inverted-assertion or
violating-stub per arm — quoted in the PR body); drift-probe measurement recorded. J3: scratch
consumer fresh dir + `go.mod` → install → plant violation → golangci-lint fires RED + clean
control GREEN, CI arm green ON THE RUNNER (workflow run linked — T-EW-C posture), BASELINE
lockstep in the same PR, zero frozen-row edits (else STOP → spec revision first).

## §3 Cross-umbrella serialization (BINDING)

`rule-tests-surface` S4 lands the deps-hash staleness glob; a lock-shape-touching J-stage and
S4 move ADJACENT surfaces (locks: emitted by lanes here, read by their gates there). Rule: the
lock-touching arms of J2 (D1/D2/D3) and S4 SERIALIZE — whichever reaches merge second first
merges the other's landed state and re-fires its DoD against the CURRENT lock behaviour
(merge-forward, never rebase — [git-conflict-merge-forward.md §2](../../rules/git-conflict-merge-forward.md)).
Umbrella-level parallelism with rule-tests-surface stands; only the named arms serialize.

## §4 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this umbrella: T2, T3, T11, T14, T15, T19, T20, T21.**

- **T2/T20** — «arm exists» ≠ «arm proven»: every arm needs its RED demonstrated (inverted
  assertion or violating stub), output quoted. A green-only arm is REFUSED by design (spec §3).
- **T3** — spec census citations are design-time (@ `ffa571149` + PR regimes); re-verify live
  at each stage (staging has moved: W1-W4 merged, W5 pending at authoring).
- **T11** — J1's SSOT entry lands only AFTER the companion-pool DeepWiki residual runs.
- **T14** — the J2 retrofit-run reports coverage honestly: a lane where an arm cannot run
  (tool absent) is «insufficient», never «clean».
- **T15** — the jig self-applies: the suite's own arms must survive their own RED-provability
  rule; the rehearsal is the jig auditing itself.
- **T19** — own adversarial cold-review (the J1-shipped protocol) before every handoff.
- **T21** — backward-checks enumerate sibling surfaces (both lock writers, all delivery
  lanes, tripwire pair), never restate the diff.

**Domain-specific traps:**

- **T-AJ-A — «arm passes because it tests the fixture, not the lane»**: an arm wired to a
  synthetic fixture only, never exercised against the real lane artefacts, is theatre — each
  arm's retrofit-run must cite the REAL lane file/output it judged.
- **T-AJ-B — «drift probe eyeballed»**: DN-J1 resolves on a MEASURED drift (diff stats /
  structural comparison of the two lane scripts, method recorded), not «looks similar to me».
- **T-AJ-C — «go leaks ahead of its stage»**: J3 is its own atomic PR; any `install.sh`/
  `setup.d`/CI go artefact appearing in the J1 or J2 diff is a stage-discipline breach
  (mirrors T-EW-A both-or-neither atomicity: the lane + its CI arm + BASELINE move together
  in J3, never piecemeal across stages).

## §5 STOP lines (binding)

- NO edits to `.claude/skills/rule-tests/`, `agents/rule-test-author.md`, `packages/core/ir/`
  (inherited D2/IR freeze — spec §8, arm G3).
- NO new test runner (spec §8; arms land in existing suites).
- NO new freshness/staleness ledger; deps-hash stays owner (rule-tests-surface S4 territory).
- NO shipped go artefacts outside J3's own PR (T-AJ-C stage atomicity).
- NO paid LLM in CI (generation/review are session-bound; CI re-runs deterministic arms only).

## §6 See also

- [docs/superpowers/specs/2026-07-22-adapter-jig-design.md](../../../docs/superpowers/specs/2026-07-22-adapter-jig-design.md) — BINDING design (contract, arms, forks DN-J1/DN-J2 with recorded defaults).
- [.claude/orchestrator-prompts/rule-tests-surface/kickoff.md](../rule-tests-surface/kickoff.md) — the parallel umbrella (§3 edge; PARALLEL-OK otherwise).
- [.claude/orchestrator-prompts/ecosystem-wiring/kickoff.md](../ecosystem-wiring/kickoff.md) — the predecessor umbrella whose incidents seeded the arm catalogue.
- [.claude/rules/attention-is-not-a-mechanism.md](../../rules/attention-is-not-a-mechanism.md) — the discipline the jig operationalizes (gates + named protocols, never bare attention).
