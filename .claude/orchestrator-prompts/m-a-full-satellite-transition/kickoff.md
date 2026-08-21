# Umbrella: M-A full-satellite transition (multi-stage R+I)

> **Status:** STUB. Drafted 2026-05-27 by orchestrator session at conclusion of `companion-reuse-deep-dive` umbrella.
> **Authoritative for:** scope + 6-stage breakdown for transitioning `rules-as-tests-aif` from current substrate-heavy state to thin universal-satellite over Superpowers + AI-Factory + aif-handoff companions (per maintainer vision 2026-05-27).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

## §0 Origin & vision

Maintainer vision (2026-05-27, `companion-reuse-deep-dive` session):

> «использовать для удобства своей разработки что-то одно [Superpowers] а наш проект сделать так чтобы он был одинаково хорошь под всех их как спутник»

I.e., for maintainer's **own dev** = one preferred stack (Superpowers); for project ship surface = **universal satellite** neutrally compatible with ANY companion stack (AI-Factory, Superpowers, OhMyOpencode, aif-handoff, TaskMaster, OpenCode). Our project stays **between/above** all companions on uncontested niche layer (Living Documentation enforcement).

**Input matrix:** `docs/meta-factory/research-patches/2026-05-27-universal-satellite-integration-matrix.md` (PR #252, merged 2026-05-26) — 7 companions × R1-R5 + integration surfaces + conflict surfaces + coexistence combos verified.

**Catalogued evidence:** companion-reuse-deep-dive session catalogued 12 wrong-narrow framings (orchestrator-aggregation systematically under-credited upstream + over-credited own-work). M-A transition fixes this at substrate level — when most of orchestrator skill's volume is delegated to upstream, the surface for that error class shrinks.

## §1 6-stage breakdown

### Stage 1 — R-phase: per-section orchestrator skill audit vs companions

**Output:** `docs/meta-factory/research-patches/YYYY-MM-DD-orchestrator-skill-audit.md`

For each section of `~/.claude/skills/orchestrator/SKILL.md`:
- Map to companion equivalent (Superpowers SDD / `executing-plans` / `requesting-code-review` / etc; AI-Factory `aif-plan` / `loop-orchestrator` / `implement-coordinator`; OhMyOpencode Atlas/Prometheus)
- Per kickoff §2 of universal-satellite matrix (PR #252): use §1.1-§1.7 per-companion findings as input
- Classify per section: REPLACE-WITH-COMPANION / KEEP (genuine niche) / HYBRID-WRAPPER

**Stage 4 input.**

### Stage 2 — R-phase: install.sh K-1 extension design

**Output:** `docs/meta-factory/research-patches/YYYY-MM-DD-install-sh-k1-extension.md`

Design MCP-style prompts in `install.sh` for optional companion install (precedent: existing AI-Factory auto-install pattern):
- «Установить Superpowers? [y/N]» → invoke `obra/superpowers` install via their marketplace
- «Установить aif-handoff Kanban? [y/N]» → install if user wants autonomous-execution layer
- «Установить TaskMaster (subscription mode)? [y/N]»
- AI-Factory already auto-installs — keep as-is OR add prompt for consistency

**Stage 5 input.**

### Stage 3 — R-phase: Living Doc neutral injection points

**Output:** `docs/meta-factory/research-patches/YYYY-MM-DD-living-doc-neutral-injection.md`

For R1-R20 enforcement / principle tests / mutation testing / audit-ai-docs.sh — verify they work neutrally regardless of which companion combo is installed:
- Per PR #252 §5: edit-time / pre-commit / pre-push / CI / production audit channels
- Verify no companion's pipeline collides
- Document any conflict + escape hatch

### Stage 4 — I-phase: orchestrator skill trim + Phase 4.5 ADAPT

**Output:** edits to `~/.claude/skills/orchestrator/SKILL.md`

Implementing Stage 1 audit findings:
- Replace REPLACE-WITH-COMPANION sections with `Skill('superpowers:*')` / `Skill('aif-plan')` invocations
- Keep KEEP-niche sections (cross-umbrella scanning, classify-work.sh, Stage-gate dispatch, quota zones, Phase -1, bootstrap discovery — anything not in any companion)
- **Phase 4.5 ADAPT (subsumed from prior Phase-4.5-micro-umbrella plan):** ADAPT Superpowers' `skills/writing-skills/anthropic-best-practices.md` «Research synthesis workflow» (Cross-reference claims + Verify citations) as new Phase 4.5 self-audit step. Closes the 12-wrong-narrow-framing pattern catalogued in `companion-reuse-deep-dive` session.
- SSOT amendments per Stage 1 findings

### Stage 5 — I-phase: install.sh K-1 extension

**Output:** edits to `install.sh` + companion install verification

Implementing Stage 2 design:
- MCP-style prompts for Superpowers / aif-handoff / TaskMaster
- Verify each companion's install actually works from oф repo
- SSOT amendment if any new install precedent surfaces

### Stage 6 — I-phase: README + docs update

**Output:** edits to `README.md` + relevant docs

- Update README:72 «Is» section to reflect satellite role precisely
- Update README:74 «Isn't» section if surface list needs further refinement (currently already trimmed to Claude Code, Cursor, Codex via PR #253)
- Update README:115 install instructions to reflect new K-1 companion install flow
- Update CLAUDE.md if any AI-tooling conventions change
- Update relevant `.claude/rules/*.md` if discipline scope shifts

## §2 Hard constraints

- **NO substrate edits in R-phase stages (1/2/3)** — research-only patches
- **Phase -1 cold-review MANDATORY** per orchestrator/SKILL.md Phase -1 section (1× Opus default; 2× Opus for prod-blast-radius like substrate edits in Stage 4/5/6)
- **No drive-by** per CLAUDE.md PR strategy — each stage = its own PR
- **No paid LLM in CI** — substrate edits must respect AI-agnostic positioning
- **Worktree isolation** per parallel-subwave-isolation.md §1 for any parallel Worker dispatch
- **6-item search-coverage check** (`phase-research-coverage.md §1`) on every negative-existence claim
- **T16 «pattern-matching-on-name» explicit walk** per companion comparison (kickoff §1.1)
- **Universal-satellite vision is non-negotiable** — no stage may recommend «pick one companion as default» (anti-vision)

## §3 Active T-traps (cross-ref [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md))

T1, T3, T7, T11, T12, T13, T15 (load-bearing — recursive self-application: each stage's R-phase audits whether the stage's own discipline applies to itself), T16, T19, T20, T-CR-A (within-one-project disambiguation per DeepWiki probe — proven 12-trap recurrence in predecessor session).

**New domain-specific trap for this umbrella:** **T-MA-A «12-wrong-narrow-framings-recurrence»** — orchestrator-aggregation systematically under-credits upstream + over-credits own-work; Phase 4.5 ADAPT (Stage 4) is the mechanism countermeasure; every M-A stage MUST cite specific upstream claims with file:line evidence at synthesis step, not at handoff step.

## §4 Dispatch protocol

- Stages run **sequentially**, not parallel (Stage N depends on Stage N-1 output)
- Each stage = full Opus session (R-phase) or 1-2 sessions (I-phase, depends on diff size)
- Mode A inline Opus Worker per stage; `isolation: "worktree"`; autonomous to PR-open per `companion-reuse-deep-dive` precedent
- Cold-QA before PR (T19) MANDATORY per worker
- Anti-collusion spot-check by orchestrator on one load-bearing claim per stage before relay to maintainer
- Each stage closes with REPORT + waiting for maintainer merge before next stage spawns

## §5 Out of scope

- Picking single companion (anti-vision — would defeat universal-satellite framing)
- Spawning sub-umbrellas autonomously per finding; surface as recommendation only
- Editing companions' own code (we are satellite, not contributor to upstream — separate decision)
- Cross-project (multi-repo) features — we operate cross-**umbrella** within one repo only

## §6 See also

- `docs/meta-factory/research-patches/2026-05-27-universal-satellite-integration-matrix.md` (PR #252) — **THE input matrix** for Stage 1/2/3
- `companion-reuse-deep-dive/kickoff.md` — predecessor umbrella + comments on PR #248 chronicling 12 wrong-narrow framings
- `README.md:72-74` (post-PR #253) — current project positioning statement
- `install.sh:307-322` — existing AI-Factory auto-install precedent for K-1 extension
- `~/.claude/skills/orchestrator/SKILL.md` — the artefact being trimmed in Stage 4
- `.claude/rules/build-first-reuse-default.md` — verdict ladder
- `.claude/rules/phase-research-coverage.md §1` — 6-item search-coverage + §1.7 self-reflexive
- `.claude/rules/ai-laziness-traps.md §3` — T-trap enumeration mandate
- `agents/compliance-verifier.md` — AI-agnostic §1.7 substance review

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
