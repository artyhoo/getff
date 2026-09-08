# consumer-truth-audit V0 — the delivery census (has → delivered → works)

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock, §3 benches, §4 harness split,
> §5 truth criterion and §7 evidence discipline BEFORE starting. They are binding.
> **Rigor label (effort-worthiness L0):** `research-grade`.
> **Bench:** fresh clean installs + the container. No live-harness questions in this lane —
> those are V3.

## §0 Goal

Produce **one machine-readable census file** answering, for every shipped artefact class and
every install profile, three separate questions that this project has been conflating:

1. **HAS** — does the framework carry it?
2. **DELIVERED** — does `install.sh` put it in a consumer project? (per profile: `core`, `env`, `factory`)
3. **WORKS** — with the framework repo unreachable, does it do its job?

Question 3 is the whole point. Question 2 passing while 3 fails is exactly the
`runtime-bridge-dispatch.sh` class (umbrella §1).

## §1 Do this FIRST — entry re-verification (quote each result)

| # | Check | Expected |
|---|---|---|
| 1 | `bash install.sh --dry-run` in a fresh dir exits without error | runs to the stack prompt |
| 2 | `install.sh --profile core\|env\|factory` are all three accepted (`install.sh:577`) | yes |
| 3 | `ls packages/core/backends/*/capability-matrix.json` | 5 files |
| 4 | `/Users/art/code/timeliner/.claude` exists and has no `rules/` subdir | confirms the §1 fact |
| 5 | container reaches `api.github.com` but not `github.com` | 200 / 000 |

If any row disagrees with its expectation, STOP and report — the ground moved since authoring.

## §2 Population enumeration (T10 — do this before any coverage number)

Enumerate, do not sample. For each class below emit the full list, not a count:

| Class | Framework-side source | Consumer-side landing site |
|---|---|---|
| skills | `.claude/skills/*/` + `skills/*/` | `.claude/skills/` |
| agents | `agents/*.md` | `.claude/agents/` |
| discipline rules | `.claude/rules/*.md` | `.claude/rules/` (**believed absent — prove it**) |
| hooks | `.claude/hooks/*` | `.claude/hooks/` + registration in `.claude/settings.json` |
| hook checks | `packages/core/hooks/checks/*.ts` | wherever the shipped hooks resolve them |
| principles | `packages/core/principles/*.test.ts` | — |
| templates | `packages/core/templates/*/` | `.ai-factory/` |
| lint rule bundles | `packages/core/eslint-rules/`, `.getff/astgrep-rules`, `clippy.toml`, `.golangci.yml`, ruff bans | project root / `.getff/` |
| MCP config | whatever `setup.d/05-mcp.sh` ships | `.mcp.json` / settings |
| CI workflows | `packages/core/templates/**/workflows` | `.github/workflows/getff-*.yml` |
| scripts | `scripts/` (see `setup.d/85-worktree-scripts.sh`) | `scripts/` |

Counts measured on the factory at authoring time, for drift detection only — **re-derive them,
do not trust them**: skills 16, agents 20, rules 30, hooks 29, checks 25, principles 47,
template dirs 5.

## §3 Method — binding

**Three installs, not one.** For each profile (`core`, `env`, `factory`) run `install.sh` into
a **fresh** `mktemp -d` seeded with a minimal `package.json` and `git init`. Capture the full
install log per profile. Never reuse a directory between profiles.

**Then sever the factory.** For the WORKS column, the consumer install must be exercised with
no reachable path to the framework repo. Any artefact that resolves a path outside the consumer
project root is a finding by construction — grep every delivered script for absolute paths and
for `..` traversals that escape the project root, and report each with `file:line`.

**Mandatory control.** Every WORKS check runs twice: once in the severed consumer, once on the
factory. Record both. A check that passes in both proves nothing about delivery; a check that
passes only on the factory is the defect class this lane hunts.

**The aged stratum (T9).** Repeat the DELIVERED column against `/Users/art/code/timeliner`
(installed 2026-08-07) **read-only** — never run `install.sh` there, never write to it. Report
each delta against a fresh install as one of: shipped-since (the install is stale),
never-shipped (the artefact reaches nobody), or consumer-authored (theirs, not ours).

## §4 Deliverable

`.claude/orchestrator-prompts/consumer-truth-audit/census-v0.json` plus a human-readable
`report-v0.md`. One row per artefact:

```json
{
  "artefact": ".claude/rules/attention-is-not-a-mechanism.md",
  "class": "discipline-rule",
  "has": true,
  "delivered": { "core": false, "env": false, "factory": false },
  "works": "n/a — not delivered",
  "aged_install": "absent",
  "verdict": "NOT-BUILT | DOC-LIES | BROKEN | BY-DESIGN",
  "by_design_citation": "setup.d/LAYERS.md:79",
  "evidence": "install.sh --dry-run … | grep -c '.claude/rules/' → 0"
}
```

`verdict` is **required** on every row. `BY-DESIGN` without `by_design_citation` is invalid —
the auditor's inference is not a citation.

## §5 The gate — run it, quote command + output (T2/T3)

| # | Gate |
|---|---|
| 1 | all three profiles installed into fresh dirs; three full logs captured |
| 2 | population enumerated per §2 — full lists, no counts-only rows |
| 3 | every row carries a `verdict` and evidence that is a command+output or file:line+content |
| 4 | every WORKS check has BOTH the severed-consumer and the factory-control result |
| 5 | the aged-install stratum measured, each delta classified into the three buckets of §3 |
| 6 | the `.claude/rules/` question answered definitively for all three profiles |
| 7 | delivered scripts grepped for factory-path escapes; each hit reported with file:line |
| 8 | zero rows with `verdict: BY-DESIGN` lacking a citation |
| 9 | coverage stated as `<enumerated>/<population>`, never a bare percentage (T10/T14) |
| 10 | self-falsification section present and non-trivial (umbrella §7.2) |

## §6 Out of scope

Do not fix anything. This lane measures. A tempting one-line fix spotted mid-census goes into
the report as a finding with a proposed fix, never into a commit — the triage pass decides
class and ordering. Do not touch the docs site. Do not re-derive the 18 known site GAPs.

## §7 Report format

`report-v0.md` with: §population (full lists), §method (the three install logs' locations),
§census summary (counts by verdict class), §findings (one per non-`BY-DESIGN` row, most severe
first, each with a concrete failure scenario), §aged-stratum deltas, §coverage
(`enumerated/population`, with what you could not reach and why), §self-falsification.

## AI traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T1**, **T2**, **T3**, **T9**, **T10**, **T14**, **T15**.

- **T1** — the population is the unit here; sampling is a defect, not a shortcut.
- **T2** — a census you designed but did not run is worth nothing. Install, then look.
- **T3** — «the comment says consumers get it» is not evidence. The install log is.
- **T9** — fresh and aged installs are different strata. Both, or the lane is incomplete.
- **T10** — enumerate before any coverage claim.
- **T14** — low coverage + clean result = «coverage insufficient to conclude».
- **T15** — report what auditing this census would look like: what would catch a row you got wrong?
