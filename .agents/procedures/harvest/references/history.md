# Harvest origin and rationale

> **Authoritative for:** the scoped harvest origin and rationale detail routed from [the skill card](../SKILL.md).
> **NOT authoritative for:** skill activation, shared gates, or project goal; those remain with the card and its declared owners.

Historical source material preserved from audited SHA `63da1fb35059a892fb634ab02697636dbc1d1976`; dated claims below are not current runtime proof. Apply the card's present routing and verification constraints.

**Origin:** 2026-06-26. Harvesting a finished aif branch reliably reddens CI (PR #724 — 3 reds in a chain) or needs manual reconciliation; the steps lived only in user-scope memory. Spec: [docs/superpowers/specs/2026-06-26-harvest-skill-design.md](../../../../docs/superpowers/specs/2026-06-26-harvest-skill-design.md).

## Without this skill

The operator hand-runs the harvest from memory: inspects the container, picks a push channel, hand-reconciles shared-file collisions, and runs _whichever_ gates come to mind before pushing. The recurring outcome (PR #724) is a push that reddens CI on a gate that was never re-run locally — and a round-trip per red. The 9 egress gotchas live only in user-scope memory, invisible to a fresh session or a different machine.

## With this skill

The four steps run in a fixed order that cannot be silently skipped: egress with the gotchas spelled out inline, deterministic cross-stage reconciliation, then **one command** (`run-local-ci-sweep.sh`) that runs the diff-scoped CI-equivalent gate set before push — the forgotten gate is no longer forgettable. The egress discipline is codified in the repo, not in one session's memory, so any harness (CC / Cursor / Codex) following this skill harvests the same way.
