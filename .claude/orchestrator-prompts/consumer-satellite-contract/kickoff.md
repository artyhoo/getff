# KICKOFF — consumer-satellite-contract (thin form, round 3)

> **Type:** multi-stage umbrella (factory-bound; authored at round-3 exit routing,
> 2026-08-18).
> **Origin:** [consumer-axis spec](../../../docs/superpowers/specs/2026-08-18-consumer-satellite-harmonization-design.md)
> §8 (D-C1 thin form, D-C2, D-C4, D-C5, D-C7 widened, D-C9) — decisions ratified in
> dialogue 2026-08-18 incl. ESC-1 (census BOTH rows, keep ast-grep on a clean census).
> **Base branch:** staging (NOT main). NOTE: this kickoff lands on staging together
> with the harmonization spec branch `claude/festive-shtern-0e0296` when the operator
> lifts the PR pause — do not dispatch before that merge.
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** consult spent at design time — SSOT
> #253-#257 + spec §5 (fuzzy detectors REJECTED at 13%/38% precision; inventory-join
> scanner explicitly NOT built). No new dependency; the presence check is a <50-LOC
> setup.d shell addition; the principle test extends the existing meta-test family.

## §1 Deliverables (4 stages)

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| S1 census | Retro-census artifacts for BOTH `setup.d/companions.manifest` cc-plugin rows (`:17` superpowers, `:21` ast-grep), per the D-C2 shape: trigger-collision census vs the shipped skill set + capability-ownership row (D-H1 projection) + non-CC degrade path. ast-grep census verdict routes per ESC-1: clean → keep; red → surface to operator (drop vs disable-by-default is the operator's call, NOT the Worker's) | — |
| S2 gate | D-C2 principle test: every `kind=cc-plugin` manifest row carries a census artifact; paired negative (rowless census / censusless row both RED). Freshness bar per D-C2 falsifier: census cites the plugin version it censused | S1 |
| S3 carrier | «Skill routing ownership» section in `packages/core/templates/shared/AGENTS.md.template` (D-C5): static census prose (factory-declared collision classes + remediation recipes per known pair) + carrier-reach note (AGENTS.md is not CC-injected). Plus the ⚠ machine-scope parity line for `kind=cc-plugin` consent in `setup.d/engine.sh` (D-C4, one line; snapshot lane verifies) | S1 |
| S4 check | Known-pair presence check in `./setup` (~20 lines, manifest-driven), keyed on `installed_plugins.json` + `enabledPlugins` — NEVER cache dirs (a cached-but-disabled plugin does not route; measured live with ast-grep, spec §5/R2). Prints the factory's measured resolution per present pair; prescribe-only, never mutates the host. Fixture: a synthetic install registry with a known colliding pair → expected recipe in output; plus one live run on the operator machine | S1 |

## §2 Binding constraints (from the ratified registers — do not re-derive)

- Factory NEVER mutates the consumer host cache (D-C1); shipped static prune stays
  REJECTED (SSOT #256-adjacent, spec D-C1).
- Detection strictly deterministic: plugin presence + factory-declared classes. NO
  fuzzy trigger-keyword matching (two measured 13%/38% precedents).
- The inventory-join engine is OUT (D-C1 thin form). Its return path is the recorded
  escalation (live consumer misroute shows the thin form insufficient) — not this
  umbrella.
- Class-2 limit stands recorded (spec §3): the consumer's-own-skills half is
  prose-only; do NOT attempt to close it here (the P8 hook fork owns that question —
  operator-axis spec §8 item 7).
- §1.7 PR-body mandate applies (targets touch `setup.d/**`,
  `packages/core/templates/**`, `packages/core/principles/**`).

## §3 AI-traps (per [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) for the
full catalogue. Active traps for this umbrella: T3, T10, T16, T19, T21.

Domain-specific:

- **T-CSC-A** — authoring the census from the OPERATOR machine's state instead of the
  SHIPPED payload: the operator's cache/enabled set is not the consumer's surface
  (ast-grep is cached-but-disabled here yet ships enabled-by-consent to consumers).
  Census the manifest rows' payloads as shipped.
- **T-CSC-B** — keying the presence check on `~/.claude/plugins/cache/**` directory
  names because they are easy to `ls`: measured false-positive class (spec §5, R2) —
  key on the install registry.

## §4 Stage gates

One stage = one executor session; run
`SLUG=consumer-satellite-contract bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
before every dispatch. S2/S3/S4 wait for S1's census artifacts merged to staging.
Phase -1 cold review between stages per
[.claude/skills/orchestrator/SKILL.md](../../skills/orchestrator/SKILL.md). Any RED
census verdict on ast-grep → STOP, surface to operator (ESC-1 branch), do not proceed
to S3 content for that row.

## §4b Host acceptance (destination-environment-verification §1)

Workers may run in the aif container; acceptance happens on the HOST:

```host-verify
npx vitest run packages/core/principles/ -t "census"
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash setup 2>&1 | grep -A3 "known-pair"
```

(S2 gate green on host; S3 template edit captured in the install baselines — a stale
fingerprint here is the gate working, regenerate via `SNAPSHOT_MODE=capture` only after
the diff is reviewed; S4 presence check emits its section on the operator machine.)

## §5 See also

- [Consumer-axis spec](../../../docs/superpowers/specs/2026-08-18-consumer-satellite-harmonization-design.md) — the SSOT for every decision above.
- [Operator-axis spec §5.1/§6 P7-P8](../../../docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md) — the binding channel + probe evidence this contract mirrors.
- [dual-implementation-discipline.md §3](../../rules/dual-implementation-discipline.md) — consumer-facing degrade bar.
