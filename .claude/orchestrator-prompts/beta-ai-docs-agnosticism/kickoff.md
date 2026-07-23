# beta-ai-docs-agnosticism — umbrella kickoff (track-2 umbrella C)

> **Type:** execution-build, multi-stage. **Tier 2** per [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md)
> (probe design + doc-class judgments per stage) — NO `bridge-profile` marker.
> **Base branch:** `staging`.
> **Status:** READY after the binding spec is merged to staging AND the §0 gates pass.
> Dispatch is operator-run `/pipeline`.
> **Binding design:** [docs/superpowers/specs/2026-07-23-beta-program-design.md](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> — §6 umbrella C (C1-C5), §2 decisions D4/D7/D8 (AI DX, self-generating docs +
> ownership carve-out, memory/context hygiene), §8 integration contract. Spec wins on
> divergence; surface, don't improvise.

## §0 Dispatch gate

1. C3/C5 are gated on umbrella-A S3 (tier-home doc exists — it is the SSOT the AGENTS.md
   layer points at); C1 template edits are gated on A S1 (profile names final).
2. Pre-dispatch in-flight probe covers track-1 umbrellas + umbrella A stages (shared
   surfaces: `packages/core/templates/shared/AGENTS.md.template`, `INSTALL-FOR-AI.md`,
   `.claude/rules/zcode-parity-doctrine.md` — the latter is maintainer-owned: PATCH
   PROPOSALS only, per spec D7 carve-out).
3. Anchors re-verified live at stage entry (spec §9 preflight 2).

## §1 Goal

Any AI harness opened on a consumer project (or on this repo) orients itself cheaply and
correctly from shipped artifacts alone: AGENTS.md layer per the LF standard, an AI Usage
Guide with machine-followable First Steps, self-generating reference docs that cannot go
stale silently, context7/DeepWiki discoverability, and agnosticism claims that are green
probes rather than prose — under the D8 hygiene rule (thin always-on context, nothing
written to consumer-AI memory).

## §2 Stages

| # | Stage | Scope (spec ref) | Gate |
|---|---|---|---|
| S1 | AGENTS.md layer + AI Usage Guide | C1: consumer template extended with environment layer + degradation pointers (A-S3 doc is SSOT); new AI Usage Guide (First Steps → daily cycle → presets → parks → degradations; ONE source of truth with umbrella B's human First Steps — two renders); INSTALL-FOR-AI refresh (skill-dir naming split, Cursor-story reconciliation) | doc-claims + rules-autoload probes green; the human/AI First-Steps parity is checked by a fixture (same steps list rendered twice); root AGENTS.md ≤150 lines kept |
| S2 | Skills agnosticism probe | C3: new probe class enumerating `.claude/skills` (today NO probe does — verified negative); night-mode conformance treatment; /arch + glm-handoff explicit degradation declarations | principle 21 green over the widened population; seeded-break paired-negative for the new probe (harness-self pattern) |
| S3 | Self-generating docs sweep | C5: inventory of derivable prose → `getff:begin` generated sections + drift gates, honoring the D7 ownership carve-out (maintainer-owned + `.claude/rules/*` → patch proposals / maintainer-landed plans only; zcode-doctrine §3 sync is the first proposal — its deferral trigger fired, Wave B merged #1043-#1047); authoring `agents/claims-conformance-auditor.md` (the §8 assembly-gate cold auditor) | every migrated section has a regen check; proposals for owner-gated files are PRs flagged for maintainer sign-off, never direct edits |
| S4 | Discoverability | C4: context7 submission + `context7.json` (excludeFolders; `rules` field carries discipline rules) + GitHub Action re-index per push; DeepWiki acknowledged secondary (slow refresh — never freshness-critical claims) | context7 resolve-library-id returns this repo; the Action runs green; llms.txt-for-repo explicitly NOT added (crawler-log evidence, spec C4) |

Order: S1 → S2 ∥ S3 → S4. One PR per stage onto staging; closure writes `done.md`.

## §3 Out of scope

Human-facing site content (umbrella B); tier-home authoring (A S3 owns; C1 points);
killer-layer docs semantics (track 1); any autonomous rewrite of maintainer-owned or
`.claude/rules/*` files (patch proposals only, spec D7).

## §4 AI traps (per [.claude/rules/ai-laziness-traps.md §2-§3](../../rules/ai-laziness-traps.md))

Active traps for this umbrella: T3, T10, T14, T15, T16, T20.

- T3 — probe/doc claims need command+output, not prose («probe green» = pasted run).
- T10 — S3 starts with population enumeration (ALL derivable prose classes), never
  sample-first.
- T14 — a clean probe over low coverage is «coverage insufficient», not «agnostic».
- T15 — self-application is the point: the docs discipline applies to OUR docs first.
- T16 — AGENTS.md/LF and context7 are ADOPTED standards: verify OUR problem-class fits
  (root ≤150 lines, nested precedence) instead of cargo-culting the format.
- T20 — verdicts carry file:line evidence.
- **T-BAD-A (domain):** «generated section works because the generator ran once» — every
  `getff:begin` migration must ship its DRIFT check (seeded-break test), else it is a
  new lying-doc with extra steps.

## §5 Escalation

Park via runtime-bridge; owner-gated file changes surface as patch-proposal PRs to the
maintainer; divergence from spec D7/D8 → STOP + surface.
