<!-- scope: kickoff — getff-freshness-widening umbrella. Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §7 (W4) + §4-§6 parity clauses + §9.2/§9.4 + §10. Cold-reviewed GO r2 (/arch §2, 2026-07-23). Tier 2 (no bridge-profile marker). GATED: dispatch only after getff-any-stack-trace/done.md exists on staging. -->

# getff-freshness-widening — kickoff

> **Goal:** close the freshness loop («не протухает») and widen the proven python trace to
> js/rust parity — locks record reality, staleness becomes addressable, the two-client ledger
> seam for level 2 lands, and the ruff/cargo committed-fixture debt closes. Spec BINDING;
> re-verify anchors live (T3) — the trace umbrella will have moved these files.
> **What exists (at design time; trace will extend):** `deps-hash-check.sh` WARN-only
> (`:13-14`), `/rule-tests` piggyback glob-scoped to
> `.ai-factory/synthesizer-output/rules-lock*.json` (`:284-297`), parses npm/python/rust
> manifests (`:9-10`); three hook copies with `@dual-pair` byte-identity
> (`deps-hash-check.test.ts:515-523`); `rules-lock.python.json` `"version": null` (probe);
> ledger `.ai-factory/rules-decisions.md` NOT built (deferred Decision C — now lands);
> ruff/cargo firing = synthetic smokes, committed fixtures pending
> (`agents/rule-test-author.md:65-69`).

## §0 Dispatch gate + in-flight probe (BINDING)

- **Gate:** `.claude/orchestrator-prompts/getff-any-stack-trace/done.md` on `origin/staging`.
- **Staging placement** of this kickoff first ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)).
- **Pre-dispatch in-flight probe** (CLAUDE.md): `getff-honest-signals` + `getff-any-stack-trace`
  residues (hooks, `45-python.sh`, templates); re-probe after Phase -1.
- **Re-plan rule:** this kickoff's stage split is written pre-trace; the planner MUST re-read
  the trace umbrella's landed diffs + `done.md` residuals and fold them before S1 dispatch.

## §1 Stages (each = one PR onto staging; do NOT collapse)

- **S1 — locks record reality (spec §7.1).** All lane locks record the consumer's actual
  dependency versions at generation time + provenance/tier per rule (python lock loses
  `"version": null`; npm/cargo equivalents aligned). Fixture: generation on a pinned-deps
  project → lock carries the real versions; machine-readable diff shape asserted.
- **S2 — targeted staleness (spec §7.2).** Widen the deps-hash WARN lock glob beyond
  `.ai-factory/synthesizer-output/` to the python lock home in `.getff/` — in ALL THREE hook
  copies (byte-identity gate). Lock-diff names WHICH rules cite the changed package; WARN
  text carries the affected rule ids + `/rule-research` re-run pointer. Fixture: dep bump →
  WARN naming the exact rules (the spec §7.5 `apiapp` scenario as a scripted equivalent).
  Polarity stays nudge-by-default; fork F-B config surface chosen here (criteria spec §12).
- **S3 — two-client ledger (spec §7.3, the LEVEL-2 SEAM).** `.ai-factory/rules-decisions.md`:
  per-rule journal (researched-when, from-what provenance+version, revisit-trigger). Schema
  explicitly two-client: the SAME schema+staleness contour must serve `tool-decisions.md`
  (level 2) with no new mechanism — this is D2's binding seam; a schema that only fits rules
  is a stage failure. Capability check: new format → BFR consult + SSOT row + `Prior-art:`
  trailer.
- **S4 — js/rust parity of the trace (spec §4.1/§5/§6 parity clauses).** Thread ResolveCtx
  into the js ESLint-direct path (`file-clients.ts`/`generate.ts`) and the clippy bridge (if
  the trace deferred it); mirror the agent-surface delivery on the cargo lane;
  `rule-researcher.md` rust arm verified live (`cargo clippy` RED quoted). Close the
  ruff/cargo committed-fixture debt (`rule-test-author.md:65-69` pending state → checked-in
  fixtures per lane).
- **S5 — acceptance full + closure (spec §9.2/§9.3).** W6 cell FULL: add the dep-bump →
  targeted-staleness assertion to the cell; RE-RUN the one-beat cold-run protocol (authored
  in the trace umbrella) and quote its verdict; umbrella `done.md`. This done.md is the GATE
  for `stack-tooling-generation` (level 2) — say so in it.

## §2 «Works» per stage (explicit + testable)

S1: lock content quoted pre/post. S2: WARN output quoted naming rule ids; three-copy
byte-identity green. S3: ledger schema exercised by BOTH clients in a fixture (rules entry +
a synthetic tool-decisions entry). S4: per-lane firing quoted (eslint RED / clippy RED /
ruff+astgrep committed fixtures green both directions). S5: cell full green in CI; one-beat
re-run verdict quoted.

## §3 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this umbrella: T1, T3, T7, T13, T14, T15, T19, T21.**

- **T13** — the trace umbrella's artifacts are ADOPTED inputs here, not trusted ground:
  re-verify its seams before building on them (re-plan rule §0).
- **T14** — «no staleness WARN fired» on a lane ≠ freshness works there; assert the positive
  case per lane or report coverage honestly.
- **T15** — run S2's staleness against the framework repo's own generated rules as
  self-application.
- **T21** — backward-check sweeps the SIBLING lanes and the level-2 seam consumers, not the
  diff's own files.
- **T-FW-A (domain)** — declaring parity by RENDER, not FIRE: a lane is «at parity» only when
  its committed fixture FIRES (tool exit code quoted), not when the rule file renders.
  Counter: §2 requires per-lane quoted firing.

## See also

- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §7, §9, §12 (F-B).
- Upstream gate: [getff-any-stack-trace/kickoff.md](../getff-any-stack-trace/kickoff.md).
- Downstream: [stack-tooling-generation/kickoff.md](../stack-tooling-generation/kickoff.md) (STUB — unfolds after this umbrella).
