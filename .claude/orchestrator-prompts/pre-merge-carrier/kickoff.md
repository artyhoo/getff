# KICKOFF — pre-merge-carrier (design stage S0)

> **Type:** design-stage kickoff (single stage; build stages are decomposed BY the design,
> not by this file). Authored 2026-08-18 from the operator-ratified triage decision.
> **Origin:** [#1466](https://github.com/artyhoo/getff/issues/1466) (ship a local pre-merge
> carrier gating the MERGE RESULT) + [#1465](https://github.com/artyhoo/getff/issues/1465)
> (Actions quota wall reports as a normal gate failure). Ratified decision:
> [#1466 comment 2026-08-18](https://github.com/artyhoo/getff/issues/1466#issuecomment-5325966626)
> — target = normal inner loop for every consumer with CI as unbypassable backstop;
> landing = **opt-in first**, promotion to default on the first live catch (real merge
> conflict or genuinely failing gate) on a consumer other than `timeliner`.
> **Base branch:** staging. Per [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md),
> do NOT dispatch until this kickoff is merged to staging.
> **Rigor label (effort-worthiness L0):** `research-grade` — the deliverable specifies a
> consumer-shipped surface (carrier script + CI-template posture + install docs), which is
> exactly the contour [effort-worthiness.md §1](../../rules/effort-worthiness.md) reserves
> for research-grade.
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** NOT yet spent — the design session runs the
> full consult (SSOT + DeepWiki/WebSearch ≥3 phrasings) as its first work item, §1 row 1.

## §1 Deliverables (one stage — the design)

| # | Deliverable | Acceptance |
| --- | --- | --- |
| 1 | **Prior-art consult + SSOT rows** in [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md). Named candidates to weigh (not exhaustive): `git merge-tree --write-tree` (plumbing that computes the merge result without a worktree), GitHub merge queue (the hosted answer to the same defect class), `nektos/act` -class local CI runners, existing pre-push machinery in this repo. Verdict per candidate with T16 problem-class match | new SSOT row(s) exist; each carries Verdict + Rationale + Trigger-to-revisit, and the row's capability-area text contains the literal token `pre-merge-carrier` (the host-verify grep keys on it — 0 hits in the SSOT today, verified 2026-08-18) |
| 2 | **Design spec** at `docs/superpowers/specs/YYYY-MM-DD-pre-merge-carrier-design.md` (real authoring date, per the specs-dir convention — every existing entry is `YYYY-MM-DD-…`) answering, at minimum: (a) carrier shape — how the merge result is built (throwaway worktree vs `merge-tree`) and how «same validate, not a subset» is guaranteed per stack lane; (b) **cross-stack interlock inventory** — the six false-verdict traps from #1466 are `timeliner`-specific (Turbo cache, shared Postgres, pnpm); the shipped ts-server template is npm-based with neither ([templates/ts-server/github-actions-ci.yml](../../../templates/ts-server/github-actions-ci.yml)), and the python/go/cargo lanes are UNINVENTORIED — note the two template roots: ts-server under `templates/`, python/go/cargo under `packages/core/templates/<lane>/github-actions-ci.yml`; the spec measures, not estimates, what each lane needs; (c) delivery channel — which `setup.d/` section ships the opt-in script, ownership mode (`copy_safe` vs `refresh_safe`); (d) the #1465 riders — waiter third state (`CI UNAVAILABLE`; signature: zero executed steps, ~2 s duration, sub-5 s detection threshold per #1465) where a shipped waiter surface exists, and the install-docs line about the account-wide Free-plan Actions pool; (e) honest-framing contract — PASS output says «local pre-merge run», never «CI green»; (f) promotion-trigger instrumentation — how «first live catch on a non-timeliner consumer» becomes observable rather than anecdotal; (g) build-stage decomposition table for the follow-on umbrella | spec file exists; every item (a)-(g) has a section; open forks are marked `DECISION-NEEDED`, never silently resolved |
| 3 | **Falsifier record** carried into the spec: (α) opt-in usage ≈ zero (precedent: WorktreeCreate hook shipped unregistered for all, incident 2026-07-23 in [CLAUDE.md](../../../CLAUDE.md)) → force default or drop; (β) second-stack interlock generalisation costs more than the channel is worth → stay opt-in permanently | both falsifiers present verbatim in the spec's own promotion/retirement section |

## §2 Binding constraints (ratified — do not re-derive)

- **Gate the MERGE RESULT, never the branch alone** — the branch-green/merge-red case is
  the entire reason the carrier is not a weaker copy of CI (#1466 «Why this is more than a
  billing workaround»). A design that gates the head commit is a wrong answer, not a variant.
- **CI stays the unbypassable backstop** — the carrier is an earlier channel per the
  earliest-reachable-channel invariant ([README.md#why-this-exists](../../../README.md#why-this-exists)),
  not a CI replacement. Local run = weaker evidence (bypassable, dirty host); the framing
  ships with the tool.
- **Opt-in first.** Default-on is a later promotion with the recorded trigger; the design
  may prepare it but must not ship it.
- **#1465 parts 1-2 land IN THE SAME CHANGE as the opt-in carrier ship, cheaply**
  (ratified decision item 2, verbatim «In the same change, land #1465 parts 1–2 cheaply»).
  The §(g) build-stage decomposition must honour this sequencing — scheduling the waiter
  third state or the docs line as separate later stages, or parking them behind a
  `DECISION-NEEDED` fork, is a deviation from the ratified record, not a design freedom.
- **Shipped-axis agnosticism** ([build-first-reuse-default.md §1.1](../../rules/build-first-reuse-default.md)):
  the carrier must degrade gracefully per stack lane; no hard dependency on Turbo/pnpm/Postgres
  assumptions imported from the reference implementation.
- **No paid LLM anywhere** in the mechanism ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)).
- Implementation (follow-on stages, NOT this kickoff) is **capability-commit territory**:
  `Prior-art:` trailers required; the §1 row-1 consult is what they will cite.
- Reference implementation to read, not to vendor blindly:
  `scripts/pre-merge-local.sh` in `artyhoo/timeliner`
  ([PR #229](https://github.com/artyhoo/timeliner/pull/229), merged 2026-08-18).

## §3 AI-traps (per [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

See [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) for the full catalogue.
Active traps for this design stage: T3, T11, T12, T16, T19.

Domain-specific:

- **T-PMC-A** — generalising the interlock set from ONE measured host/stack: all evidence in
  #1466 is three runs, one machine, one consumer, docs-only branches. The spec's §(b)
  inventory must probe each shipped lane's actual cache/shared-resource surfaces (grep the
  lane templates + setup.d), not extrapolate timeliner's six traps by analogy.
- **T-PMC-B** — quietly designing a branch-gate because it is simpler: any draft in which
  the verified sha equals the head sha on a branch that is behind base has re-created the
  exact defect the issue names. The spec must state the three-sha report (head, base,
  merge result) as a hard output contract.

## §4 Host acceptance

```bash host-verify
ls docs/superpowers/specs/*pre-merge-carrier-design.md
grep -q "pre-merge-carrier" docs/meta-factory/prior-art-evaluations.md
grep -qi "falsifier" docs/superpowers/specs/*pre-merge-carrier-design.md
```

(Design-stage contract: the spec file exists under the specs convention; the SSOT carries
the consult row keyed on the literal `pre-merge-carrier` — that token has 0 hits in the SSOT
today (verified 2026-08-18), so the command cannot pass vacuously; and the spec carries the
deliverable-3 falsifier section. Build-stage contracts are declared by the follow-on
kickoffs the spec's §(g) decomposition produces.)

## §5 See also

- [#1465](https://github.com/artyhoo/getff/issues/1465) / [#1466](https://github.com/artyhoo/getff/issues/1466) — the verified evidence base (quota wall live-confirmed 2026-08-18; `validate` = 19 gates with `--continue-on-error`, timeliner `package.json:39`).
- [CLAUDE.md «Build-vs-reuse invariant»](../../../CLAUDE.md) — the per-commit gate the build stages will pass through.
- [.claude/rules/effort-worthiness.md](../../rules/effort-worthiness.md) — the L0 label above + the four-test card for any extra-rigor demand inside the design session.
