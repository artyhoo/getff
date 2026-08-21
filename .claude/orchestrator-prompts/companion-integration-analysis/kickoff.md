# Companion-integration analysis — R-PHASE KICKOFF

> **§3.5 status (added 2026-05-17):** **CLEAR per Iteration 2** — [drafts/kickoff-self-review-iteration-1.md](drafts/kickoff-self-review-iteration-1.md) + [drafts/kickoff-self-review-iteration-2.md](drafts/kickoff-self-review-iteration-2.md) document 2 BLOCKERS (B1 D-IDs, B2 Superpowers install-model) + 5 MAJOR + 3 MINOR + 8 propagation defects identified and resolved. Maintainer decisions applied: B1 → strip-numbers-keep-labels; B2 → option A (skip Superpowers install probe; read-only DeepWiki + WebFetch only). **Fresh sessions: SKIP §3.5 iteration loop and start at §4.0 unless kickoff content has changed since 2026-05-17 (verify via `git log --oneline -- .claude/orchestrator-prompts/companion-integration-analysis/kickoff.md`).** If kickoff has changed, re-run §3.5 starting from Iteration 3.
> **Execution-mode hint for fresh sessions:** at session start, request maintainer to enable «work without stopping for clarifying questions» override. Per §6.1 §12, maintainer-decision items are COLLECTED in research-patch §12 DECISION-NEEDED list and reviewed post-session — they should NOT block §4.0-§4.7 execution mid-flight.
>
> **Status:** ARMED 2026-05-16
> **Origin:** Post-Track-4b reviewer-session finding — fragmented coverage of 3 companions (AIF + aif-handoff + Superpowers) across multiple artefacts; no unified comparison + conflict + install-order + ADOPT-vs-ADAPT-vs-BUILD verdict-per-capability table. Load-bearing for Commit 7 substantive grounding + maintainer-pending decisions on Superpowers install, skill-testing ADAPT scope, and the ADOPT-vs-ADAPT investigation. [B1 applied 2026-05-17 — D-IDs (D3/D11/D12/D13) stripped; substantive labels retained. Earlier draft cited D-IDs that did not exist in d-items-strategic-dialogue/decisions.md (only D1-D7 registered).]
> **Type:** standalone R-phase, NOT wave/phase, NOT dialogue. Single focused sitting, 4-6 hours.
> **Deliverable:** research-patch + side-by-side capability matrix (US × 3 companions) + per-capability verdict + install-order + coexistence test plan + drafts updating Commit 7 / Track 4b verdicts where new evidence shifts them.
> **NO PR. NO commits beyond research-patch. NO actual install of companions in this session — install plan is the deliverable, install itself is separate maintainer-approved work.**
> **Blocking dependency for:** Commit 7 (substantive integration grounding) and maintainer-pending decisions on Superpowers install + skill-testing ADAPT scope + ADOPT-vs-ADAPT investigation (the last absorbed here).

---

## §1 Problem this session solves

After Track 4b (`2026-05-16-companion-target-comparison.md`) recommended Superpowers as companion candidate, reviewer-session surfaced a structural gap:

- Existing artefacts cover **3 companions fragmented across separate analyses**:
  - `docs/meta-factory/aif-comparison.md` (2026-05-08) — deep AIF v2.11.0; no Superpowers, no aif-handoff in detail
  - `research-patches/2026-05-11-aif-handoff-overlap-analysis.md` — aif-handoff overlap; no AIF / Superpowers comparison
  - `research-patches/2026-05-16-companion-target-comparison.md` (Track 4b) — Superpowers + 6 others; AIF + aif-handoff only in §4.1 shortlist
  - `prior-art-evaluations.md` SSOT — entries mention all three but as separate disciplined entries
- **No unified side-by-side capability matrix** covering all four (US + 3 companions)
- **No conflict analysis** between companions when installed together
- **No install-order recommendation** or coexistence test plan
- **No per-capability ADOPT/ADAPT/BUILD verdict** mapping our gaps to specific companion offerings

Result: discussing «companion-elevation» (Commit 7) without substantive grounding. BFR-default rule §3 mechanism not fully applied at the cross-companion integration level — only at single-candidate level.

**This R-phase corrects all of above via comprehensive 4-way comparison + hybrid §4.3 probe (real install for project-scoped AIF + our project in /tmp; read-only DeepWiki + repo-file analysis for user-scoped Superpowers per B2-A 2026-05-17).**

**Why this matters:** without this analysis, ADAPT recommendations risk being premature (when ADOPT-verbatim would work) or naive (when companion-conflict makes ADOPT impossible). Per maintainer's BFR-default application: «не reinventим то что можно установить рядом и использовать» — but «установить рядом» requires verified compatibility, which we don't have.

---

## §2 Out of scope

- **Survey new candidates** — this R-phase covers exactly 4 projects (US + AIF + aif-handoff + Superpowers). Other 6 from Track 4b (Cline / Cursor / Codex / Aider / OhMyOpencode / agent-framework) stay at their Track 4b verdicts.
- **Ship Commit 7** — output is draft revision, not the commit itself.
- **Install companions in production** — install plan is the deliverable; actual install is separate maintainer-approved work after R-phase verdicts.
- **Re-launch 1A goal-clarity scope** — verdicts about positioning are locked at 1A; this R-phase informs Commit 7 wording with stronger empirical grounding.
- **Re-survey BFR-default upstream** — Track 2 covered macro-discipline survey; this is the per-capability follow-through.

---

## §3 Hard constraints

- **§1.7 Forward+Backward check ON THIS R-PHASE'S OUTPUT.** Self-review patch shipped with research-patch (T7 template). [N1 applied 2026-05-17]
- **No paid LLM in CI.** Per [`no-paid-llm-in-ci.md`](../../rules/no-paid-llm-in-ci.md). DeepWiki + WebSearch + actual install probes — all subscription-bundled or local.
- **BFR-default per capability.** For each row in capability matrix, explicit verdict per [build-first-reuse-default.md §1](../../rules/build-first-reuse-default.md) typology.
- **T16 problem-class match for every overlap claim.** «Their X looks like our Y» requires explicit «their problem class: ... our problem class: ... match? evidence: ...».
- **Hybrid §4.3 probe MANDATORY** (per B2-A 2026-05-17) — not theoretical. Use `/tmp/companion-integration-test/` (or git worktree) for real install of AIF + our project (2 project-scoped companions side-by-side); document actual file conflicts, hook collisions, runtime conflicts via shell output. Superpowers covered read-only via DeepWiki + WebFetch of repo `skills/*/SKILL.md` (user-scoped install is forbidden — see §9).
- **No T2, T3, T11, T13, T15, T16 traps.** Active traps listed in §7.
- **MANDATORY FIRST STEP: iterative kickoff self-review.** See §3.5. Do not proceed to §4.0 until §3.5 cycle is cleared OR cap reached with DECISION-NEEDED surfaced.

---

## §3.5 MANDATORY FIRST STEP — Iterative self-review of THIS kickoff

Before executing §4 methodology, the R-phase MUST self-review this kickoff itself against [`phase-research-coverage.md §1.7`](../../rules/phase-research-coverage.md). This is recursive self-application: the same discipline the R-phase will apply to its own output, applied **first** to its own instructions.

**Rationale:** Track 3 (`2026-05-16-prose-rules-audit-research.md`) and Track 4b (`2026-05-16-companion-target-comparison.md`) demonstrated that defects in source documents (1A drafts) propagate to all downstream work — catching them in pre-ship review (`2026-05-16-1a-drafts-substantive-review.md`) caught 7 of 8 defects. Catching kickoff defects BEFORE methodology executes is **cheaper** than catching them in §11 self-review patch after 4-6h of work.

**Iteration loop:**

1. **Read THIS kickoff fully** (every section, no skim).
2. **§1.7 Forward-check ON THE KICKOFF:**
   - Does §4 methodology cover all relevant discipline layers (R1-R20, principles 01-10, build-vs-reuse SSOT, trigger sweep §1.6, doc-authority, no-paid-llm-in-ci)?
   - Are all referenced files / paths real? Run `ls` on every cited path in §11 See-also and §6 deliverables; flag broken.
   - Are anti-patterns (§7) enumerated for THIS task specifically, not blanket-cited from `ai-laziness-traps.md` generic catalogue?
   - Are scope boundaries (§2 Out of scope + §9 What this session does NOT do) explicit and non-overlapping?
3. **§1.7 Backward-check ON THE KICKOFF:**
   - Has every methodology claim («≥25 capability rows», «≥3 source locations per project», «real install probe mandatory») been justified by reasoning visible in the kickoff itself, or do some require unstated assumptions?
   - Are deliverable schemas (§6.1 + §6.2) consistent with methodology (§4) — every §4.X step produces something cited in §6?
   - Are AI-laziness traps (§7) actually mapped to specific §4 failure modes, or are they decorative «we cite ai-laziness-traps.md» without binding?
4. **Identify defects** — categorize each:
   - **Ambiguity** — unclear what to do (e.g., «≥25 rows» — which exact 25?)
   - **Missing constraint** — methodology lets through something it shouldn't
   - **Misalignment** — §4 step produces X but §6 expects Y
   - **Stale reference** — file path doesn't exist / has moved / heading number wrong
   - **Decorative trap citation** — trap mentioned in §7 not used in §4 methodology
5. **If defects found:**
   - Write iteration patch to `drafts/kickoff-self-review-iteration-N.md` (gitignored). Format: defect → severity (BLOCKER / MAJOR / MINOR) → proposed fix → applied (Y/N).
   - Apply fixes directly to this kickoff (R-phase owns its own kickoff per [Artifact Ownership Contract](../../../CLAUDE.md) — `.claude/orchestrator-prompts/*` is operational artefact owned by the discovering session).
   - Re-read kickoff after fixes.
6. **If no defects** → proceed to §4.0 execution.
7. **Iteration cap:** maximum **3 cycles**. If defects persist after 3 iterations → STOP, surface as DECISION-NEEDED to maintainer, do NOT proceed to §4.

**Output:** ≥1 `drafts/kickoff-self-review-iteration-N.md` files. Each documents: defects found, fixes applied, residual concerns, iteration verdict (CLEAR / REPEAT / STOP-DECISION-NEEDED).

**Counter-prompt for each iteration:** «what would falsify the assumption that this kickoff is execution-ready?» — answer concretely, don't paper-match.

---

## §4 Methodology

### §4.0 Per-project capability inventory (mandatory, before any comparison)

For EACH of 4 projects (US + AIF + aif-handoff + Superpowers), enumerate capabilities into a flat list. Format:

```
PROJECT: <name>
Source: <repo / file path / DeepWiki query>

Capabilities:
- <C1>: <one-line what it does>
- <C2>: ...
```

**For US**: enumerate from `.claude/skills/*/SKILL.md`, `.claude/rules/*.md`, `packages/core/principles/*.test.ts`, `agents/*.md`, `packages/core/eslint-rules/`, `packages/preset-next-15-canonical/eslint-rules/`, `packages/core/audit-self/audit-ai-docs.sh` (+ `.test.sh`), `packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh`, `.husky/pre-push` semantic operations, `setup.sh` + `install.sh`, templates ESLint/Stryker/dep-cruiser configs. [M2 + M3 applied 2026-05-17]

**For AIF**: enumerate from DeepWiki probes + existing `aif-comparison.md` evidence (verify still current via fresh DeepWiki probe — 2026-05-08 may have drifted).

**For aif-handoff**: enumerate from DeepWiki probes + existing `research-patches/2026-05-11-aif-handoff-overlap-analysis.md`.

**For Superpowers**: enumerate from DeepWiki probes + existing `research-patches/2026-05-16-companion-target-comparison.md` §3.1 + this session's deep-dive findings (already known: ~21 skills + skill-testing infrastructure + plugin distribution).

**Trap counter (T-CIA-B):** capability inventory must include LOW-VISIBILITY items not just headline features. For each project, sweep at least 3 source locations to avoid sampling only the README.

### §4.1 Side-by-side capability matrix (load-bearing artefact)

Construct unified matrix:

| # | Capability area | Our project | AIF | aif-handoff | Superpowers | Best at it | Overlap class |
|---|---|---|---|---|---|---|---|
| 1 | Skill format (markdown + frontmatter) | *sample, verify* | *sample, verify* | *sample, verify* | *sample, verify* | *sample, verify* | *sample, verify* |
| 2 | Skill testing automation | *sample: NO, verify* | *sample: ?, verify* | *sample: ?, verify* | *sample: YES (bash+claude+transcript), verify* | *sample: Superpowers, verify* | *sample, verify* |
| 3 | Code-level rules (R1-R20) | *sample: YES (templates), verify* | *sample: NO, verify* | *sample: NO, verify* | *sample: NO, verify* | *sample: US, verify* | *sample: unique-to-us, verify* |
| 4 | Living Documentation drift | *sample: YES (packages/core/audit-self/audit-ai-docs.sh), verify* | *sample: NO, verify* | *sample: NO, verify* | *sample: NO, verify* | *sample: US, verify* | *sample: unique-to-us, verify* |
| 5 | Mutation testing (Stryker) | *sample: YES, verify* | *sample: NO, verify* | *sample: YES (own monorepo), verify* | *sample: NO, verify* | *sample: tied, verify* | *sample: partial, verify* |
| ... | ... |

[N3 + M2 applied 2026-05-17 — every sample value annotated «verify» to prevent anchoring.]

**Rows MUST cover at minimum:**

- Skill format + auto-trigger mechanism
- Skill testing automation
- Sub-agent prompt files
- Orchestrator / subagent-driven-development
- Git worktrees discipline
- Brainstorming / planning workflow
- TDD enforcement
- Code-quality rules (ESLint-style)
- Living Documentation drift
- Mutation testing
- Pre-commit / pre-push hooks
- CI workflow generation
- Architecture / dependency rules
- Multi-channel enforcement (edit→commit→push→CI→production)
- Plugin / multi-runtime distribution
- Marketplace / discovery model
- ADR / decision record format
- Prior-art / build-vs-reuse discipline
- §1.7 self-reflexive verification
- AI-laziness-traps catalogue
- AGENTS.md interop
- AST-based hooks
- Drift detection scripts
- Pressure-scenario testing
- «1% Rule» trigger discipline

**~25 capability rows minimum.** Aim for 30-40 for substantive coverage.

### §4.2 Per-row overlap analysis (T16 mandatory)

For each row in §4.1 matrix:

- **Exact match:** all 4 do the same thing, same shape, same lifecycle → mark as «commodity»; verdict is «pick best implementation»
- **Partial overlap:** similar shape, different scope/lifecycle → T16 problem-class match required; verdict per overlap class
- **Unique-to-one:** only one project covers this → no overlap; verdict «that project owns it»
- **Gap-everywhere:** none cover → BUILD candidate (verify via Track 2 if relevant)

For each row, explicit per-capability ADOPT/ADAPT/REFERENCE/KEEP-NARROW/BUILD/REJECT verdict per [BFR rule §1](../../rules/build-first-reuse-default.md).

### §4.3 Conflict + compatibility analysis (HYBRID PROBE — real install for project-scoped; read-only for user-scoped Superpowers)

This is the most expensive section but the most load-bearing.

**Setup**: create `/tmp/companion-integration-test/` (or use git worktree). In it, perform real install operations for project-scoped companions only. Superpowers is analysed read-only (no install) per B2-A maintainer decision 2026-05-17.

1. **Init AIF** (project-scoped): `cd /tmp/companion-integration-test && ai-factory init --agents claude` (binary at `/opt/homebrew/bin/ai-factory`; `--agents` flag verified via `ai-factory init --help`).
2. **Install our project** (project-scoped): `cd /tmp/companion-integration-test && bash /Users/art/code/rules-as-tests-aif/setup.sh --stack=ts-server` (setup.sh sets `PROJECT_DIR="$(pwd)"`, so invoker must `cd` to target dir first). [M1 applied 2026-05-17]
3. **Superpowers — READ-ONLY analysis (NO install)** per B2-A 2026-05-17. Reasoning: Superpowers is user-scoped (DeepWiki probe confirmed install lands at `~/.claude/plugins/`, registers a `SessionStart` hook that injects the `using-superpowers` meta-skill with «1% Rule» mandate into EVERY Claude Code session globally, includes `brainstorming` skill with HARD-GATE blocking implementation flow, and lacks documented clean-uninstall procedure). Cross-scope side-effect on the maintainer's full Claude Code workflow makes install destructive within R-phase scope. **Procedure instead:**
   - Query DeepWiki `obra/superpowers` for skill catalogue (`read_wiki_structure` then `ask_question` per-area).
   - WebFetch (or DeepWiki content read) of `skills/*/SKILL.md` files from `obra/superpowers` GitHub repo to extract: skill name, description / auto-trigger keyword frontmatter, dependencies on other skills, any hooks the skill registers.
   - Cite each finding with: DeepWiki query text + repo file path + line range. T3 «plausible without verification» counter — no Superpowers claim without a concrete cite.
   - **DO NOT execute `/plugin install superpowers@claude-plugins-official`** in any session during this R-phase (foreground or background; in this project or any other). If §4.3 procedure tempts an install — STOP and re-confirm with maintainer.
4. (Optionally) wire up aif-handoff if applicable to discipline-framework consumer install (it's primarily orchestration runtime, may not install into project).

**Observe and document:**

- **File-level conflicts (AIF ↔ our project, observed in /tmp):** does AIF init create files that our setup.sh overwrites? List collisions by path + size delta.
- **Hook conflicts (AIF ↔ our project, observed in /tmp):** AIF may install hooks; we install `.husky/pre-push`; do they collide on same trigger? List by hook-name.
- **Settings conflicts (AIF ↔ our project, observed in /tmp):** `.claude/settings.json` — who owns which fields? Merge strategy?
- **Cross-scope skill / trigger keyword collision (AIF + our project + Superpowers, computed from read-only data):**
  - Inventory project-scoped skills installed in /tmp test dir: enumerate `.claude/skills/*/SKILL.md` after AIF + our setup.sh complete. Extract trigger keywords per skill.
  - Inventory user-scoped Superpowers skills from `obra/superpowers` repo (via DeepWiki / WebFetch per §4.3 step 3 above). Extract trigger keywords per skill.
  - Build trigger-collision matrix: rows = trigger keywords; columns = source project; cells = which skill(s) would compete. Document which would win per Claude Code's resolution rules (cite Claude Code docs for resolution semantics).
  - Special attention: Superpowers `using-superpowers` meta-skill is injected at every SessionStart with «1% Rule» (mandate to invoke skills aggressively) — analyse whether the rule itself would override our skill auto-triggers if Superpowers were installed.
- **CI conflicts (AIF ↔ our project, observed in /tmp):** AIF may generate workflow; we generate workflow; do they merge or overwrite?

**Document EACH conflict as:**

```
CONFLICT C-N:
- What: <file / hook / trigger>
- Who collides: <project A vs project B>
- Resolution: <merge possible / explicit selection needed / show-stopper>
- Recommendation: <how to handle in install plan>
```

**Trap counter (T-CIA-A «assume-compatibility-without-probing»):** if §4.3 ships with «no probe run, assumed compatible» — REJECT the R-phase output and re-run with actual install.

### §4.4 ADOPT/ADAPT/BUILD verdict per capability

Drawing from §4.2 overlap + §4.3 conflicts, for each row produce final verdict:

- **ADOPT-VERBATIM**: their implementation works as-is, no modification needed, no conflict with us → install + use
- **ADOPT-INTEGRATED**: their implementation works but requires config / integration shim → install + configure
- **ADAPT-POST-INSTALL**: install their base, add modifications via override layer (e.g. our skill that extends theirs)
- **ADAPT-MINIMAL**: our version exists, but adopt their pattern at API/format level (e.g. their `SKILL.md` frontmatter shape)
- **REFERENCE-ONLY**: don't install; cite as pattern precedent in our rule
- **KEEP-NARROW**: our scope deliberately narrower; document why
- **BUILD-OURS**: gap-everywhere, no upstream candidate, BUILD per BFR rule
- **REJECT-CONFLICT**: candidate conflicts irreconcilably with our discipline; document why excluded

### §4.5 Install order + coexistence checklist

Based on §4.3 conflicts, produce:

```
INSTALL ORDER (recommended):
1. <project A> first because <reason>
2. <project B> second because <depends on A or non-conflicting>
3. <project C> third because <...>

POST-INSTALL VERIFICATION CHECKLIST:
[ ] file X exists with correct ownership
[ ] hook Y wired in correct order
[ ] skill trigger Z resolves to correct project
[ ] CI workflow merges without override
[ ] no duplicate enforcement (same rule from 2 projects)
```

### §4.6 Coexistence test plan

Design ongoing verification:

- One-time post-install probe (above checklist)
- Periodic re-check trigger (when upstream version bump? sample: monthly?)
- CI gate candidate: «installed-companion versions are compatible» (deterministic check, no LLM, per `no-paid-llm-in-ci.md`)

### §4.7 Armed-trigger cross-check (§1.7 Forward-check completeness) [M5 added 2026-05-17]

Per [`phase-research-coverage.md §1.7`](../../rules/phase-research-coverage.md) Forward-check item «trigger sweep (§1.6 — every armed §13.x in open-questions.md)», the consolidated verdicts from §4.4 + §4.7-companions analysis MUST be cross-checked against armed `§13.x` triggers in [`docs/meta-factory/open-questions.md`](../../../docs/meta-factory/open-questions.md).

Procedure:

1. `grep -nE "^### 13\." docs/meta-factory/open-questions.md` to enumerate every §13.x entry.
2. For each entry, read its trigger condition (one-sentence summary).
3. For each consolidated verdict in §4.4, ask: «does this verdict satisfy or violate this trigger?». Likely-relevant areas: §13.22 (L2 Research Agent), §13.x entries on companion / SSOT / plugin / hook conventions if armed.
4. Document each touch as one of: `VERDICT-FIRES-TRIGGER` (verdict adoption armed a §13.x trigger that should now fire as research-patch), `VERDICT-PREVENTS-TRIGGER` (verdict closure makes a §13.x trigger moot), `NO-TOUCH` (verdict orthogonal to trigger).
5. Empty result acceptable IFF explicitly verified via `grep` output cited; «no triggers touched» without enumeration = T15 «self-application skipped».

---

## §5 Tools available

- DeepWiki MCP (`mcp__deepwiki__*`) — primary architectural research per capability + Superpowers read-only analysis per §4.3 step 3 (B2-A 2026-05-17)
- WebFetch — fetch raw `skills/*/SKILL.md` files from `obra/superpowers` GitHub repo when DeepWiki content needs verification by line number
- WebSearch — for version updates / install instructions / changelog drift
- Bash + grep + ripgrep — for our project inventory
- **Real shell execution** for §4.3 project-scoped install probes (AIF + our project in /tmp) — install in temp dir, run, observe
- ToolSearch — to load deferred tool schemas as needed

---

## §6 Deliverable structure

### §6.1 Research-patch — `docs/meta-factory/research-patches/2026-MM-DD-companion-integration-analysis.md`

Mandatory sections:

- §1 Problem (recap from this kickoff §1)
- §2 Background (Track 4b origin + Track 2 + aif-comparison.md state)
- §3 Per-project capability inventory (4 subsections, one per project)
- §4 Unified capability matrix (≥25 rows)
- §5 Per-row overlap analysis with verdicts
- §6 Conflict + compatibility analysis (hybrid: real install probe outputs for AIF + our project; DeepWiki query results + repo file cites for Superpowers, per B2-A)
- §7 ADOPT/ADAPT/BUILD verdict consolidation per capability
- §8 Install order + coexistence checklist
- §9 Coexistence test plan
- §10 §1.7 Forward+Backward check on consolidated verdicts
- §11 Self-review patch (recursive §1.7 on this R-phase output)
- §12 DECISION-NEEDED surfaces (likely 5-10 items)
- §13 What this R-phase does NOT do
- §14 See also

### §6.2 Drafts in this kickoff's `drafts/` subdir (gitignored)

- `drafts/commit-7-readme-revision-v2.md` — revised Commit 7 wording with substantive integration grounding (supersedes Track 4b §4.1 draft if findings shift)
- `drafts/install-order-checklist.md` — operational checklist for maintainer running the install
- `drafts/coexistence-ci-gate-design.md` — sketch for deterministic compatibility check

---

## §7 AI laziness traps active for this session

Per [`ai-laziness-traps.md §3`](../../rules/ai-laziness-traps.md) — kickoff author obligations satisfied via enumeration.

**Canonical traps (HIGH relevance):**

- **T2** «my methodology would catch it» — designing the matrix ≠ running the probes. §4.3 MUST execute real installs for AIF + our project AND must run DeepWiki + WebFetch cites for Superpowers — not describe what either would show.
- **T3** «plausible without verification» — every matrix row needs cited evidence. For AIF + our project rows: DeepWiki query + path + shell probe output. For Superpowers rows: DeepWiki query + repo file path + line range (no probe output substitute).
- **T11** «designing without prior art» — §4.0 inventory MUST consult DeepWiki for each project, not memory alone.
- **T13** «ADOPTED ≠ zero work» — for every ADOPT-VERBATIM verdict, verify the upstream actually integrates with our existing artefacts via §4.3 probe.
- **T14** «clean audit = no theatre» — if §4.3 shows «no conflicts found», ask «did I install at all, or just describe?». Probe must produce conflict output OR explicit «clean install verified by <command>».
- **T15** «self-application MANDATORY» — §6.1 §11 self-review patch is mandatory.
- **T16** «pattern-matching-on-name» — explicit problem-class match per matrix row.

**Domain-specific traps:**

- **T-CIA-A** «assume-compatibility-without-probing» — §4.3 MUST run real installs for AIF + our project in /tmp. For Superpowers (B2-A 2026-05-17), read-only analysis substitutes; trap shifts to «accept any Superpowers compatibility claim without explicit DeepWiki query / repo file path / line range citation». Output without probe (AIF + our) OR without cited Superpowers evidence = R-phase REJECTED.
- **T-CIA-B** «inventory bias toward headline features» — §4.0 must sweep ≥3 source locations per project, not just README. LOW-visibility capabilities (audit-ai-docs.sh, paired-negative pattern, frontmatter conventions, scope:annotation) must be included.
- **T-CIA-C** «install-order shortcut» — install order recommendation in §4.5 MUST come from actual probe (which order ran cleanly), not theoretical reasoning.
- **T-CIA-D** «overlap blindness» (T16 sibling) — «Superpowers `using-git-worktrees` skill» and our `parallel-subwave-isolation rule` look similar but operate at different layers (their skill = runtime instruction to AI; our rule = framework principle with companion test). Don't collapse to «same thing».
- **T-CIA-E** «ADOPT-on-paper-only» — recommending ADOPT for capability X requires evidence that upstream works for OUR use case. For AIF + our project: evidence = §4.3 probe output. For Superpowers (B2-A 2026-05-17): evidence = explicit «not yet probed; rationale: user-global install destructive within R-phase scope per B2-A; recommend follow-up probe in separate maintainer-authorised session» appended to each Superpowers ADOPT verdict. Naked ADOPT recommendations for Superpowers without this caveat = REJECTED.
- **T-CIA-F** «AIF-incumbency-bias» — AIF is already installed in our project; tempting to defer all AIF questions to «already handled». Don't. Re-verify per current AIF version that integration assumptions still hold.
- **T-CIA-G** «aif-handoff scope confusion» — aif-handoff is primarily orchestration runtime for SDLC tasks, NOT a discipline framework that installs into consumer projects. Don't apply «install side-by-side» to it the same way as AIF / Superpowers. Document the distinction.
- **T-CIA-H** «execute-on-first-read» — proceeding to §4.0 without running §3.5 iteration cycle. Symptom: research-patch §11 self-review claims «kickoff was solid» without naming any iteration. Counter: §3.5 requires ≥1 `drafts/kickoff-self-review-iteration-N.md` file before §4.0 starts. R-phase output WITHOUT iteration evidence = REJECTED.

---

## §8 Output requirements

- Research-patch (required, per §6.1 schema)
- ≥4 drafts in drafts/ (≥1 `kickoff-self-review-iteration-N.md` from §3.5 + Commit 7 v2 + install checklist + coexistence gate sketch) [N2 applied 2026-05-17]
- §1.7 Forward+Backward self-review patch as §11 of research-patch (mandatory, T7 template)
- Memory entry update — `project_session_ordering_2026_05_13.md` to reflect R-phase completion
- **MUST include hybrid §6 evidence** — not summaries: raw shell output (truncated to 20 lines per command) with cited commands for AIF + our project installs; DeepWiki query text + repo file path + line ranges for Superpowers (per B2-A 2026-05-17)

---

## §9 What this session does NOT do

- Does NOT actually install AIF or our project in production project (only `/tmp` test directory)
- **Does NOT install Superpowers globally in ANY session (per B2-A 2026-05-17) — Superpowers is read-only analysis via DeepWiki + repo file fetch only. `/plugin install superpowers@claude-plugins-official` is FORBIDDEN within R-phase scope.**
- Does NOT ship Commit 7 (output is draft)
- Does NOT modify `.claude/rules/`, `.claude/skills/`, `agents/`, `packages/core/principles/`
- Does NOT relaunch 1A or 1B
- Does NOT launch Wave 10 R-phase
- Does NOT install MCP servers
- Does NOT register Superpowers in SSOT (that's a separate atomic commit after maintainer approves)
- Does NOT close `companion-target-comparison/kickoff.md` (Track 4b kickoff stays ARMED for the other 6 candidates if maintainer wants deeper coverage)

---

## §10 Final note to the AI running this

**START HERE:** before reading any further, execute §3.5 iteration cycle on THIS kickoff. Do NOT proceed to §4.0 until §3.5 is cleared (CLEAR verdict) OR iteration cap reached (3 cycles) with DECISION-NEEDED surfaced. **This is the single most important constraint of this R-phase** — skipping §3.5 propagates kickoff defects into 4-6 hours of work.

**This R-phase exists because the maintainer applied BFR-default rule more strictly than Track 4b did.** Maintainer asked: «зачем ADAPT, если можно ADOPT-verbatim?» — that question is structurally correct and applies to EVERY companion capability, not just one.

The hardest part of this R-phase is **§4.3 — REAL install probe for AIF + our project in /tmp; READ-ONLY repo analysis for Superpowers (per B2-A 2026-05-17)**. Most R-phase failures here will be «described install without running it» (for AIF / ours) or «claimed Superpowers behaviour without DeepWiki / repo cite» (for Superpowers). Counter:

1. **For AIF + our project install steps:** paste the actual command + actual exit code + actual stderr/stdout (truncated). If install fails, document failure mode, don't smooth over.
2. **For Superpowers read-only analysis:** every claim has a DeepWiki query OR a repo file path + line range citation. No prose-only claims about Superpowers.
3. **For cross-scope trigger collision matrix:** if two skills produce duplicate functionality (e.g. Superpowers ships a skill called `using-git-worktrees` and we have a rule with parallel scope), that's a CONFLICT row in the matrix even if no shell error fires.
4. **HARD STOP: do NOT install Superpowers globally in any session during this R-phase.** Even «just to verify» = B2 violation = R-phase REJECTED.

If you find yourself writing «companion X integrates cleanly with us» without naming the specific commands you ran (AIF / ours) or the specific DeepWiki query / repo cite (Superpowers) — STOP. That is `#assume-compatibility-without-probing`.

---

## §11 See also

- [build-first-reuse-default.md §1](../../rules/build-first-reuse-default.md) — verdict typology
- [ai-laziness-traps.md §2 T16](../../rules/ai-laziness-traps.md) — pattern-matching-on-name protocol
- [reviewer-discipline.md §2](../../rules/reviewer-discipline.md) — DECISION-NEEDED surface pattern
- [phase-research-coverage.md §1.7](../../rules/phase-research-coverage.md) — Forward+Backward methodology applied to this R-phase's own output
- [docs/meta-factory/aif-comparison.md](../../../docs/meta-factory/aif-comparison.md) — AIF v2.11.0 single-project analysis (2026-05-08; may be stale, verify)
- [docs/meta-factory/research-patches/2026-05-11-aif-handoff-overlap-analysis.md](../../../docs/meta-factory/research-patches/2026-05-11-aif-handoff-overlap-analysis.md) — aif-handoff single-project analysis
- [docs/meta-factory/research-patches/2026-05-16-companion-target-comparison.md](../../../docs/meta-factory/research-patches/2026-05-16-companion-target-comparison.md) — Track 4b (Superpowers + 6 others, light coverage of AIF/aif-handoff)
- [docs/meta-factory/research-patches/2026-05-16-bfr-default-upstream-verification.md](../../../docs/meta-factory/research-patches/2026-05-16-bfr-default-upstream-verification.md) — Track 2 macro-discipline survey
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT (no Superpowers entry yet; add after this R-phase if integration recommends)
- [.claude/orchestrator-prompts/companion-target-comparison/kickoff.md](../companion-target-comparison/kickoff.md) — Track 4b kickoff (still ARMED for other 6 candidates)
- [.claude/orchestrator-prompts/post-1a-coordination/kickoff.md](../post-1a-coordination/kickoff.md) — post-1A overall coordinator
- [.claude/orchestrator-prompts/goal-clarity-dialogue/drafts/atomic-commit-plan.md Commit 7](../goal-clarity-dialogue/drafts/atomic-commit-plan.md) — downstream Commit 7 (this R-phase grounds it substantively)

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
