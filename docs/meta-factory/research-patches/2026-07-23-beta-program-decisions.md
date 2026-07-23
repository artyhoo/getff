<!-- scope:beta-program -->
# Beta-program design session — decision record (2026-07-23)

> **Scope:** decision provenance for the beta-program design
> ([spec](../../superpowers/specs/2026-07-23-beta-program-design.md) — the binding
> artifact; this patch records HOW the verdicts were reached: consult evidence, search
> phrasings, rejected alternatives). Folder-level authority per research-patches charter.
> Session: /arch (Fable seat), worktree `fable-public-release-design-f2b480`, staging
> anchor `812268ac2`.

## §1 Session shape

Three research passes fed the design (all sub-agent transcripts in the session task
store; condensed results embedded in the spec):

1. **Recon fan-out (10 parallel readers):** install flow, skills contour, runtime-bridge,
   agnosticism harness + zcode state, staging currency + parallel sessions, docs state,
   getff-landing, npm prior-art, operator plan-v2 (Downloads), tier-home inventory.
   Key discoveries: the «multi-model pipeline + acceptance» parallel session =
   local branch `claude/multi-model-pipeline-arch-ef674f` → acceptance-contour spec
   (ACCEPTED r3); track-1 = any-stack closure session (`claude/getff-idea-status-d8b805`,
   5 umbrella kickoffs); zcode-parity doctrine §3 stale vs merged Wave B (#1043-#1047);
   NO agnosticism probe enumerates `.claude/skills`; GLM has ZERO install-surface
   presence; npm publish prior-art complete in s6-u10-handoff.md.
2. **BFR consults (4 web agents, ≥3 phrasings each; searches recorded per agent):**
   docs-framework comparison; progressive install depth + one-click LLM onboarding;
   launch presets + status-command UX; AI-docs standards + context7 mechanics.
3. **Docs-stack dispute pass (3 web agents, operator-requested):** census of 23 top
   docs sites (package.json / DOM fingerprints), Fumadocs+Mintlify deep-dive
   (DeepWiki-grounded static-export verification), community threads + benchmarks
   (HN/Reddit-archive/X; no rigorous benchmarks exist — recorded).

## §2 Verdicts (condensed; falsifiers live in the spec §2)

| # | Area | Verdict | Decisive evidence |
|---|---|---|---|
| 1 | Release ordering | **Absorb** getff-to-prod U8-U12 tail; publish only after track-1 + acceptance + operator self-testing (operator decisions) | operator answers 2026-07-23; plan-v2 F1 hybrid-lite (U9 post-announce); U-graph collision surfaced by recon |
| 2 | Docs stack | **ADOPT Fumadocs** (full-Next migration, static GH Pages); REJECT Mintlify (hosting lock, pricing flux) + hybrid Astro-adapter (immature); demote Starlight incumbent | census: shadcn/ui, Zod, Turborepo, Better Auth on Fumadocs; Mintlify roster = Anthropic/Cursor/Perplexity/LangChain/Resend/Bun; static export verified (Orama pre-render, llms routes); community: «shadcn but for docs», complaints absorbable under AI-agent maintenance |
| 3 | Install depth | **ADOPT VOCABULARY** rustup named profiles (+ per-line consequence text, Drupal #892348 lesson); ADAPT upgrade to our stateless regen | install-depth consult; existing flag machinery `install.sh:97-118` |
| 4 | LLM onboarding | **ADAPT** aider detect→explain→one-key→validate pattern; REFERENCE claude-code-router + LiteLLM (no routing rebuild); no GUI (BFR cost gate) | onboarding consult; aif REST CRUD confirmed at `~/code/aif-handoff/.../runtimeProfiles.ts` (checkout 2026-05-26 → field shapes designed-not-proven) |
| 5 | Entry points | npx (JS) + **`curl \| sh` universal** (rustup/uv/bun pattern); npx is NOT the python/rust/go standard | consult Q1; per-ecosystem standards (uvx/pipx, cargo, go install) |
| 6 | Presets + status | declarative presets + list verb + flag-first + TTY-menu sugar (`gh workflow run` model); status = git-status shape with next-command lines; REJECT menu-only + dashboards | presets/status consult incl. clig.dev TTY rule; NO established agent-framework status convention found (gap → BUILD-thin) |
| 7 | AI docs | **ADOPT** AGENTS.md LF standard (universal reader support); REJECT llms.txt for the repo (crawler-log evidence), keep on docs site; context7 registration + `context7.json` `rules` field + reindex Action; DeepWiki secondary (slow refresh — operator acknowledged) | ai-docs consult; operator directives |
| 8 | Self-generating docs | both sides (consumer + this repo): derivable prose → `getff:begin` generated sections + drift gates | operator directive; live gap evidence: zcode doctrine §3 vs #1043-#1047; Cursor story contradiction README↔INSTALL-FOR-AI |
| 9 | Positioning | «AI DX» as public term + 4th north-star measure | operator directive; two-sided framing (DX for agents / AI-powered DX) |
| 10 | Memory hygiene | framework never writes consumer-AI memory; thin always-on layer | operator directive; hot/cold ai-doc standard |

## §3 SSOT note

Per the CLAUDE.md build-vs-reuse invariant, new prior-art SSOT rows land WITH the
capability commits of the executing umbrellas (Fumadocs adoption → umbrella B's site PR;
context7 registration, skills-probe, presets, status — their respective A/C stages), each
citing this patch as the consult record. No SSOT row is added by this design-only PR
(no capability commit here). Existing rows consulted: #64 (SDD ADOPT), #66/#68
(orchestration REFERENCE), #86/#98/#99 (companion axes), #126 (CC /init ADAPT — the
AI-performs-setup precedent), #179 (SkillRouter), #196 (source-before-shape), #221/#222
(multi-model pipeline).

## §4 Known unproven claims carried into the spec

- aif runtime-profile CRUD field shapes + per-mode-defaults API (checkout 2 months
  stale) — verify live at A2 implementation (spec R2).
- Fumadocs-static behaviors re-verified by the mandatory B prototype (spec D5 falsifier 1).
- «uv/uvx dominant Python entry» — operator-facing claim to re-check at B/C authoring
  time before it enters shipped docs.
- Acceptance-contour spec is on its authoring branch, not staging — §8 contract treats
  it as pending; re-verify on merge (spec R6).

## §1.7 Self-review (research-only patch — no rule/discipline introduced)

This patch records decision provenance; it introduces no new rule, principle, or gate, so
a **forward-check** suffices (no paired backward-check obligation per
[phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md), arm (f')).
Both directions are stated for substance.

**Forward-check (this patch complies with active disciplines):**

- [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md): patch is markdown —
  no CI gate, no API call, no paid LLM. ✓
- [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md): no
  capability commit here — §3 records that new SSOT rows land WITH the executing umbrellas'
  capability commits (Fumadocs → umbrella B site PR; context7/skills-probe/presets/status →
  A/C stages), each citing this patch. Verdicts in §2 each carry decisive evidence, not vibe. ✓
- [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md): the binding
  artifact is the [spec](../../superpowers/specs/2026-07-23-beta-program-design.md) (carries
  its own Class/Authoritative headers); this patch carries the `<!-- scope:beta-program -->`
  first-line annotation (principle 10) + folder-level research-patches authority. ✓
- [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md): this
  section IS the self-review; §1 records the search coverage (3 research passes, ≥3 phrasings
  per BFR agent). ✓

**Backward-check (sibling-surface sweep).** Class of this change = *design-decision-provenance
record for an in-flight umbrella*. Surfaces where this class occurs on staging:
`docs/meta-factory/research-patches/2026-07-23-getff-any-stack-closure-design.md` (parallel
track-1 provenance) — NOT touched, no verdict here supersedes it (SWEPT-CLEAN); the
getff-to-prod meta-launch kickoff — its U8-U12 tail is absorbed by the meta-launch AMENDMENT
commit (separate artifact, not this patch). No existing decision record is superseded or
contradicted by §2's verdicts. GAP-FOUND: none.

**Self-application (T15):** the framework's own build-vs-reuse + search-coverage disciplines
were applied to this design session's own verdicts — §2 every row cites decisive evidence and
§3 defers SSOT rows to the executing capability commits rather than front-loading them here.
