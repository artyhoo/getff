<!-- scope:docplan-auditor-first-run -->
# 2026-07-04 — docplan-auditor first run (A15 mandate)

> Scope: cold run of agents/docplan-auditor.md on demo-DocPlan.
> Demo DocPlan: packages/core/composition/fixtures/root-agents-demo.docplan.json
> Input nodes: no-direct-env-var (cargo, type-aware): packages/core/backends/cargo/test-fixtures.ts FIXTURE_NODE;
> no-direct-process-env (npm, syntax): packages/core/composition/fixtures/no-direct-process-env.node.json

## Input

Demo DocPlan has 1 section ("Configuration access"), 2 nodes, 0 excluded.

The section groups a cargo type-aware ban (`std::env::var`) and an npm syntax ban
(`process.env`) under the unified title "Configuration access". Both nodes share the
same behavioral theme: require using a config accessor instead of direct env reads.

## Transcript

```text
Population: 1 section, 2 nodes, 0 excluded.

Per section:
  - configuration-access "Configuration access"  — CLEAN
      (a) title↔nodes: CLEAN. Both nodes' claims align with the section title.
          no-direct-env-var: "Read configuration through the injected config accessor, never std::env::var directly"
          no-direct-process-env: "Read configuration through the injected config accessor, never process.env directly"
          Both prohibit direct environment-variable reads in favor of a config accessor;
          "Configuration access" accurately describes both.
      (b) mis-grouping: none. The two nodes share the same behavioral theme (config
          accessor mediation vs. direct env reads) and differ only in toolchain (cargo
          vs. npm). No alternative section exists, and neither node's claim is off-theme
          enough to warrant a split-off section of its own. The cross-toolchain pairing
          is coherent, not a grouping error.
      (d) granularity: right-grained. Two nodes covering the same convention across two
          toolchains is a natural multi-toolchain grouping unit. Splitting into separate
          sections per toolchain would fragment a unified rule; the current grain matches
          the claim-level abstraction.

Excluded:
  - (no entries)

Overall verdict: CLEAN (grouping is sound). Title accurately covers both nodes;
no mis-grouping; granularity is appropriate for a two-toolchain pair of the same convention.
```

## Verdict

CLEAN across all 4 dimensions. The demo DocPlan's single "Configuration access" section
grouping both the cargo `std::env::var` ban and the npm `process.env` ban is semantically
coherent: both nodes express the same convention (use a config accessor, never read env
vars directly), differing only in toolchain. The cold auditor, without access to any PR
narrative, independently confirms the grouping is sound.

---

## A10 — supersession note (validateMatrix hash-equal claim)

DoD §3.1 of the MT kickoff stated "hash-equal хойст" (byte-identical hoist) for
validateMatrix — the claim being that extracting validateMatrix from both backends would
produce a function identical to the existing assertEveryNodeResolved.

**Empirical fact:** `validateMatrix` is parameterized via `extractIdentity` and is NOT
byte-identical to `assertEveryNodeResolved`. The hash-equal predicate is logically
impossible when consolidating diverging bodies:
- cargo backend: diagnostic identity extracted via nested `message.code.code`
- npm backend: diagnostic identity extracted via flat `ruleId`

These are structurally incompatible; no single unparameterized body could serve both.

PR #901 body honestly disclosed this divergence under the "DoD §3.1" section — the
extractIdentity parameterization was acknowledged as the correct consolidation approach.

**Executable truth:** `packages/core/backends/shared/validate-matrix.ts` (the actual
implementation as shipped).

**Supersession pointer:** this note, not a kickoff edit. The MT kickoff is a closed
artifact (per `docs/meta-factory/retros/` append-only convention and CLAUDE.md Artifact
Ownership Contract). Precedent: `research-source-trust.md §6` backward-check
(supersession notes belong in a research-patch or rule, not in a retroactive kickoff edit).

---

## §1.7 Forward-check (research-only)

This patch is a research-only artifact: it records an audit run result (A15) and a
factual supersession note (A10). It introduces no new discipline rule, no code change,
and no capability artifact.

- **Forward:** no new rule introduced — no existing discipline rules are implicated
  by this patch beyond those already enforced. The docplan-auditor output is read-only
  consumption of `agents/docplan-auditor.md` (existing artifact, unchanged). The A10
  note records a factual divergence from a closed kickoff claim; it does not alter any
  enforced invariant. No sibling discipline docs require updating.
- **Self-application (T15):** the A15 cold auditor run itself is the recursive
  self-application mandated by MT S4 PR-B — `agents/docplan-auditor.md` was exercised
  against a real DocPlan (`packages/core/composition/fixtures/root-agents-demo.docplan.json`),
  not just specified and left untested. The A10 supersession note applies the
  supersession-note pattern (`research-source-trust.md:352` §6 backward-check)
  recursively: this patch uses the same mechanism it cites as precedent, confirming
  it works as specified.
