<!-- bridge: skip -->
# beta-docs-showcase — /arch prep-doc (track-2 umbrella B; NOT a dispatch kickoff)

> **Type:** ARCH-PREP. This file is the input for umbrella B's OWN `/arch` run
> (`/arch .claude/orchestrator-prompts/beta-docs-showcase/kickoff.md`) — content/IA needs
> its own design pass. The `bridge: skip` first line blocks any auto-dispatch; do NOT
> hand this to `/pipeline` or aif until that /arch run has produced a reviewed design +
> stage plan and replaced/extended this file.
> **Base branch:** `staging`. Execution targets the `getff-landing` repo
> (github.com/artyhoo/getff-landing) — governance model per spec §5: kickoff-encoded
> checklists + PR flow in the landing repo + the phase-2 assembly gate in THIS repo
> (`claims-conformance-auditor`) as the enforcement backstop; no CI is built there.
> **Binding design:** [docs/superpowers/specs/2026-07-23-beta-program-design.md](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> — §5 (umbrella B), §2 D4 (AI DX positioning) + D5 (docs stack verdict + falsifiers).

## Pre-seeded verdicts (decided; the /arch run designs WITHIN them, not around them)

1. **Stack (spec D5):** Fumadocs on Next.js, FULL site migration (docs + custom
   Tailwind v4/shadcn landing + blog/RSS on fumadocs-mdx), static export to GitHub
   Pages, $0, custom domain kept. **Mandatory prototype stage FIRST**: static smoke on
   GH Pages — Orama search, `llms.txt`/`llms-full.txt`/per-page `.md` routes, custom
   domain — BEFORE content migration; failure → Starlight rollback (old site stays in
   git). Evidence + falsifiers live in spec D5; do not re-litigate the framework choice.
2. **Positioning (spec D4):** «AI DX» tagline family; final wording chosen in this run;
   claims constrained by the operator's F5 honest-claim formulas (matrix-proven wording;
   «your AGENTS.md — milestone» until true; no cargo-deny present tense). Environment
   layer labeled **experimental** until the maintainer's README §Why edit (spec §1).
3. **Content skeleton (spec §5):** two-layer showcase (killer = beta, environment =
   experimental) with per-layer how-to-use of the daily cycle; **simple Getting
   Started / First Steps** (install → first rule fires → first task through the
   pipeline; 5-minute read per depth profile; ONE source of truth with umbrella C's AI
   Usage Guide First Steps — two renders); python quickstart (site covers TS+Rust
   only); beta-program page + GitHub-issues feedback channel.
4. **README changes** route through maintainer handoff (Artifact Ownership Contract).

## Open design questions for the /arch run

- Information architecture: sidebar structure for two layers + per-profile First Steps.
- Landing narrative: how the current «Docs lie. Tests don't.» hero evolves into the
  AI DX two-sided framing without losing the existing brand.
- Blog strategy (keep the 1-post blog? announcement post for phase 3?).
- Migration sequencing: prototype → docs port → landing rebuild → blog/RSS — and what
  redirects/URL stability the old Starlight paths need.

## AI traps (per [.claude/rules/ai-laziness-traps.md §2-§3](../../rules/ai-laziness-traps.md))

Active traps for this run: T3, T7, T12, T16, T19.

- T3/T19 — the prototype gate produces command+output evidence (deployed URL, search
  query, fetched llms.txt) + own cold QA before any content migration.
- T7 — the F5 claim formulas are checked claim-by-claim against shipped reality, not
  ticked as a section.
- T12 — Fumadocs specifics (static export details, fumadocs-mdx blog patterns) are
  read from CURRENT docs at build time, not from training memory.
- T16 — Fumadocs is ADOPTED for docs; its absence of landing/blog modules means those
  are OUR code — do not assume upstream covers them.
- **T-BDS-A (domain):** «the site looks done because the happy path renders» — every
  public claim on the site is either probe-backed or labeled experimental; the
  claims-conformance-auditor (umbrella C) is the backstop, not the excuse.
