<!-- scope: kickoff — ecosystem-wiring umbrella. Design base (BINDING): docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md Part II (§7-§8) + Part III (§9-§10). Wires the lab-proven live-generation core into the consumer install path for python + cargo (owner decision 2026-07-17: both together, not piecemeal; operator scope directive 2026-07-21). Tier 2 (no bridge-profile marker; top tier plans, executor implements). -->

# ecosystem-wiring — kickoff

> **Goal:** the generator works for ANY detected stack end-to-end in a CONSUMER repo: detect
> (pyproject.toml/Cargo.toml + frameworks) → research → generate (already proven, LG umbrella
> closed) → deliver (python live seam + cargo slice) — closing live-generation done.md Gap log
> (a) («Wiring BOTH adapters … is a future umbrella») and the python-delivery-v0
> deferred-behind-trigger items (trigger pulled by the operator 2026-07-21).
> **What exists (re-verify live per T3):** generation for js/ts (production), python (LG-S1
> firing RED) and rust (LG-S3, `research-to-clippy-node.ts` merged); both adapters UNWIRED
> (`ecosystem-unwired-debt.test.ts` BASELINE=2); `detectStack` JS-only (`detector/types.ts:5`);
> python consumer seam shipped (setup.d/45-python.sh); NO cargo delivery slice (grep empty);
> deps-hash staleness for all 3 stacks shipped (#1070).

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement** before any dispatch ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **Pre-dispatch in-flight probe** MUST explicitly cover: **`ir-unfreeze`** (COLLISION CLASS —
  see §3 serialization rule) and **`rule-tests-surface`** (ship-order dependency R5: its S1-S5
  wait on this umbrella's W3), plus the `feat/rule-research-live-adapter` branch state (W5
  input — re-verify Phase-0 spec/kickoff content there AND the neighboring `chore/close-*`
  branch before scoping W5). Re-probe after any Phase -1 review, before actual dispatch.

## §1 Stages (each = one PR onto staging; do NOT collapse)

- **W1 — detect widening.** `detectStack` reads `pyproject.toml` (PEP 621/508 + Poetry) and
  `Cargo.toml`; detects python frameworks (fastapi, sqlalchemy, …) from dependencies. The
  widened `Stack` TYPE SHAPE (enum literals vs `{toolchain, framework}` pair) is W1's OWN S1
  decision, made against a live census of `Stack`-type consumers (spec §7 delegation criterion:
  non-frozen, compiler-enumerated, reversible — operator may pull the decision up).
- **W2 — wire BOTH adapters.** `ecosystem-python.ts` + `ecosystem-cargo.ts` into the production
  `ResolveCtx` — together, never piecemeal (owner 2026-07-17); BASELINE 2→0 in the SAME PR
  (tripwire strict `===`: growth AND partial-wiring both RED). Capability commit → BFR/SSOT +
  `Prior-art:` trailer.
- **W3 — python live delivery.** Live-generated python rules ride the EXISTING seam
  (`.getff/astgrep-rules/` + sgconfig merge + ruff-bans, setup.d/45-python.sh) + the python
  rules-lock variant. NO new delivery channel.
- **W4 — cargo delivery slice + CI arm.** A 45-python-style setup.d slice (clippy.toml/deny
  surface + cargo rules-lock variant). CI arm (spec §7, operator challenge 2026-07-21): pinned
  toolchain install in audit-self.yml (`rustup toolchain install 1.96.1` + clippy + cache,
  ci-tool-pinning Rule A — same posture as the ast-grep/ruff pins at :232/:242), un-skip cargo
  live-fire in CI, add the rustc toolchain-freshness gate (deriveToolVersion analog). After W4,
  NO lane's evidence is dev-machine-only.
- **W5 — live-adapter Phase 1 coordination.** Sequence the existing Phase-0 work from
  `feat/rule-research-live-adapter` (REFERENCE it; do NOT re-design; re-verify branch state
  first — §0). Deliverable: the researched-python path invokable end-to-end on a consumer.
- **W6 — closure.** Scratch-consumer end-to-end proof (fresh dir + pyproject.toml → install →
  plant violation → tool fires RED, commands + output in PR body; same for a scratch cargo
  crate) + umbrella `done.md`.

## §2 «Works» per stage

W1: FastAPI fixture project detects as its python stack (not `unknown`), with tests. W2:
BASELINE=0 same-PR, adapters invoked on the production path (unit + integration evidence). W3/W4:
scratch-consumer install → plant violation → tool fires RED (fired exit codes quoted). W4 CI arm:
cargo firing + freshness gate GREEN IN CI (workflow run linked). W5: researched (not starter)
python rule lands on a scratch consumer via the live path. W6: full-chain proof in done.md.

## §3 Cross-umbrella serialization (BINDING — spec §10 collision rule)

ir-unfreeze S2/S3 and THIS umbrella's W3 move the SAME generated artefacts (`render-astgrep.ts`
emission, `python-templates-drift.test.ts`, snapshot/byte-locks, the astgrep delivery seam) —
the PR #1058 CONFLICTING recurrence class. Rule: the astgrep-emission-touching stages SERIALIZE —
whichever umbrella reaches that stage second first merges the other's landed state and re-fires
its DoD against the CURRENT emission behaviour. Recovery on a CONFLICTING PR = merge-forward
([git-conflict-merge-forward.md §2](../../rules/git-conflict-merge-forward.md)), never rebase.
Umbrella-level parallelism with ir-unfreeze stands — only the named stages serialize.

## §4 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this umbrella: T2, T3, T11, T14, T15, T20, T21.**

- **T2/T20** — «wired» claims require the invocation actually run + output quoted, not «the code
  path exists».
- **T3** — BASELINE value, `Stack` type, seam paths re-verified live at each stage (staging
  moves; this kickoff's facts are design-time).
- **T14** — NO rust expressibility claims (the census is python-only — recorded GAP); W4 proves
  delivery + firing, not convention coverage.
- **T15** — the framework's own scratch-consumer runs ARE the self-application; a stage without
  a fired proof is not done.
- **T21** — backward-checks enumerate sibling surfaces (both `.getff` seams, all hook copies,
  baselines/fingerprints), never restate the diff.

**Domain-specific traps:**

- **T-EW-A — «wire one adapter, defer the other»**: violates the owner decision AND leaves
  BASELINE≠actual (tripwire RED). Both-or-neither per PR-visible state.
- **T-EW-B — «build a new delivery channel because the seam is inconvenient»**: W3/W4 ride
  existing seams (45-python precedent); a new channel is a design change → STOP and surface.
- **T-EW-C — «cargo green without CI firing»**: after W4, a cargo «works» claim citing only a
  dev-machine run is the exact theatre the CI arm exists to end — quote the CI workflow run.
- **T-EW-D — «detect-shape scope creep»**: W1 widens detection; it does NOT touch the IR, the
  skill, or research protocols (spec §8: wiring a stack must require ZERO skill edits — that is
  the D2 acceptance test; if it doesn't hold, STOP).

## §5 STOP lines (binding)

- NO IR unfreeze here (`ir/types.ts:3` stays until ir-unfreeze lands its own S1); relational
  expressibility is ir-unfreeze scope.
- NO edits to `.claude/skills/rule-tests/` or `agents/rule-test-author.md` from this umbrella
  (D2 acceptance test, spec §8).
- NO new freshness ledger; staleness stays deps-hash-owned.
- NO paid LLM in CI; the CI arm is deterministic tool installs + firing only.

## §6 See also

- [docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md](../../../docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md) — BINDING design (Part II).
- [.claude/orchestrator-prompts/rule-tests-surface/kickoff.md](../rule-tests-surface/kickoff.md) — the dependent skill umbrella (R5 ship order).
- [.claude/orchestrator-prompts/ir-unfreeze/kickoff.md](../ir-unfreeze/kickoff.md) — the parallel umbrella this one serializes stages with (§3).
- [.claude/orchestrator-prompts/live-generation/done.md](../live-generation/done.md) — Gap log (a), the recorded debt this umbrella pays.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
