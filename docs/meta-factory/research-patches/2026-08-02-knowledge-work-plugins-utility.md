<!-- scope:knowledge-work-plugins-utility-host -->

# Anthropic `knowledge-work-plugins` trio (engineering / design / product-management) — BFR utility verdict

**Candidate:** three plugins from the Anthropic-authored open-source marketplace [`anthropics/knowledge-work-plugins`](https://github.com/anthropics/knowledge-work-plugins): `engineering`, `design`, `product-management`. **Evaluated:** 2026-08-01. **Verdict class:** BFR §1.1 two-axis split — **ADOPT-operator + KEEP NARROW-shipped** for all three, with a load-bearing **Cowork-vs-CC environment caveat** (§A0). **Sibling precedents:** verdict [53c2ec](#see-also) (the standalone off-marketplace `engineering` pack), PR #1210 (`claude-plugins-official` utility). **This patch complements both — it neither re-litigates 53c2ec nor duplicates #1210; it fixes the §A0 error in #1210 the operator caught** (§A4).

## §Top — operator question answered directly (W4)

«Три плагина не покрыты — `engineering`, `design`, `product-management` из `knowledge-work-plugins`. 0/10 совпадений → значит дополняют?» — **partially yes on the operator axis, no on the shipped axis, and the «0/10» framing needs a correction first.** The trio comes from a *different marketplace* than the plugins #1210 audited (`claude-plugins-official`). PR #1210's §A0 claimed «плагина engineering/design в marketplace нет» — **that is true only for `claude-plugins-official`; it is false for `knowledge-work-plugins`, where both exist.** This patch is the correct fix. The per-capability T16 (§A1) confirms the problem-class verdict 53c2ec reached for the standalone `engineering` pack **extends to all three knowledge-work plugins**: they are **prompt-shaping packs + MCP-connector bundles**, not executable enforcement — the decisive discriminator is the file census (`git/trees/main?recursive=1` → 1657 files; **zero `hooks.json`, zero `.husky`, zero executable scripts in the trio**; the repo's 26 `.py` files all live in `bio-research/`+`data/`, NOT in engineering/design/PM). On the **operator axis** the trio is genuinely useful for the skills we do not own (product brainstorming, design critique, PM spec-writing, accessibility review) — but the live-body read surfaces **one real mechanism-overlap** (`product-management:product-brainstorming` ↔ `superpowers:brainstorming` wrapped by `/arch` §1) that is **domain-divergent** (PM product-problem brainstorming vs technical-capability design), adjudicated in §A2. On the **shipped axis** the trio is **installable in CC CLI** (`claude plugin marketplace add anthropics/knowledge-work-plugins` — verbatim README, confirmed DeepWiki), so it is NOT «inapplicable in principle»; but shipping it as a mandatory companion would be a goal change, so it stays KEEP NARROW. **Falsifier in §A6.**

---

## §A0 — Cowork-vs-CC environment resolution (W1 — load-bearing fact)

This is the work item the prior verdicts left open. The kickoff's Host fact 2 asserted the trio is **«Claude Cowork (desktop)»** only. That is **half-right and the correction is load-bearing for both the operator and shipped axes.** Three independent probes converge:

| Probe | Source (this session) | Result |
|---|---|---|
| **Raw README** | `raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/README.md` (WebFetch) | «Built for [Claude Cowork](https://claude.com/product/cowork), **also compatible with [Claude Code](https://claude.com/product/claude-code)**.» Then an **explicit CC-CLI install block**: `claude plugin marketplace add anthropics/knowledge-work-plugins` → `claude plugin install sales@knowledge-work-plugins`. |
| **GitHub repo `description`** | `gh api repos/anthropics/knowledge-work-plugins` | «Open source repository of plugins primarily intended for knowledge workers to use in **Claude Cowork**» — the word «primarily» is the qualifier the kickoff's Host fact 2 dropped. |
| **DeepWiki ×1** (full-roster + env ask) | `anthropics/knowledge-work-plugins` | «designed for both Claude Cowork (desktop) and Claude Code CLI … 'Built for Claude Cowork, also compatible with Claude Code'. … No indication that engineering/design/product-management ship hooks.json, executable scripts, pre-commit/pre-push hooks, CI gates, or lint rules.» Adds: `hooks/hooks.json` is a *supported* plugin component but «rarely used in Cowork» per the `create-cowork-plugin` skill. |
| **WebSearch ×3** (state-of-art 2026-08) | this session | Convergent: Cowork is the desktop/sandboxed agent; CC is the CLI; plugins are «built for Cowork but explicitly work with Claude Code»; install is via Cowork's «Customize» tab OR the CC-CLI `claude plugin` commands. ([gradually.ai](https://www.gradually.ai/en/claude-code-vs-claude-cowork/), [productcompass.pm](https://www.productcompass.pm/p/claude-code-guide), [support.claude.com](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)) |

**Resolution (binding for this patch):**

1. **Primary target environment = Claude Cowork (desktop); secondary = Claude Code CLI.** The trio is **technically installable in CC CLI** (`claude plugin install <p>@knowledge-work-plugins`). The kickoff's binary «Cowork-only» framing over-narrowed it; but the *optimal* environment is Cowork — the skills reference Cowork-only affordances (`~~calendar`/`~~email`/`~~chat`/`~~meeting transcription` connectors in `product-management/CONNECTORS.md`, sourced via `.mcp.json` HTTP MCP servers: Slack/Linear/Asana/Notion/Figma/Amplitude/Pendo/Intercom/Fireflies).
2. **Cowork-tooling is MCP-based, not hook-based.** The `product-management/.mcp.json` (read this session) declares HTTP-type MCP servers. MCP is a host-agnostic standard — so the connector surface is *not* hard-Cowork-locked; a CC-CLI consumer with the same MCP servers configured gets the same connector behaviour. What IS Cowork-shaped is the *workflow* (PM stakeholder comms, design handoff, competitive briefs) — these are knowledge-work artefacts, not framework-engineering artefacts.
3. **Enforcement posture = zero executable, confirmed by negative-existence sweep.** The trio ships `.claude-plugin/plugin.json` (manifest) + `.mcp.json` (connectors) + `CONNECTORS.md` + `README.md` + `skills/*/SKILL.md` (+ `commands/` for PM only). **No `hooks.json`, no `.husky`, no scripts, no CI, no lint.** 6-item checklist on this negative-existence claim run in §A1 census footnote.

**Why this matters for the verdict:** because the trio IS CC-CLI-installable, the shipped axis is **not «inapplicable in principle»** — it is the standard KEEP NARROW (integrates via the harness-native plugin mechanism, degrades gracefully when absent, never mandatory). The Cowork caveat narrows the *operator* recommendation: the maintainer gets the most value running these in Cowork (their optimal seat), and *may* install them in CC CLI where the workflow still fits (e.g. a PM-flavoured design critique in a CC session).

---

## §A1 — Per-capability T16 (W2) — actual counts, not the kickoff's

The kickoff's Host fact 3 claimed capability counts of «engineering 6+6, design 6+6, PM 7+7 = ~38». **That is wrong, and correcting it is the T-DUP discipline.** The actual structure (from `gh api .../git/trees/main?recursive=1` + per-skill `contents` reads, this session):

| Plugin | Skills (actual) | Commands (actual) | Kickoff's claim | Discrepancy |
|---|---|---|---|---|
| `engineering` | **10** (`architecture, code-review, debug, deploy-checklist, documentation, incident-response, standup, system-design, tech-debt, testing-strategy`) | **0** (no `commands/` dir — 404) | «6 skills + 6 commands» | The «6 commands» were the **skill names mislabelled as commands**. Same skills, no commands. |
| `design` | **7** (`accessibility-review, design-critique, design-handoff, design-system, research-synthesis, user-research, ux-copy`) | **0** (no `commands/` dir — 404) | «6 skills + 6 commands» | 7 skills (not 6); the «6 commands» do not exist; some skill names differ (`design-system` not `design-system-management`; `ux-copy` not `ux-writing`; `research-synthesis` not `design-system-management`). |
| `product-management` | **8** (`competitive-brief, metrics-review, product-brainstorming, roadmap-update, sprint-planning, stakeholder-update, synthesize-research, write-spec`) | **1** (`brainstorm.md`) | «7 skills + 7 commands» | 8 skills (not 7); 1 command (not 7). |
| **Total** | **25 skills + 1 command = 26 capabilities** | | **«~38»** | The «6+6/6+6/7+7» command counts conflated `partner-built/slack/commands/standup.md` (a *different* plugin) with engineering. |

**Per-capability T16 — for each skill: Upstream problem class: X. Our problem class: Y. Match? Evidence.** Our contour cited from source (T7): `/arch` = idea→research-contour(§1.5)→ideate(§1 wraps `superpowers:brainstorming`)→cold-two-altitude-review(§2)→route(§3); `/dispatcher` = dispatch→monitor→Q&A→harvest with `GO|REVISE|STOP`; `/harvest` = egress+sweep+cold-review+PR. Our enforcement = 35 principle tests + 4 ESLint rules + 20 CC hooks + pre-push + 11 CI workflows (census in 53c2ec §1).

### engineering (10 skills) — verdicts inherit 53c2ec; cited, not re-derived

53c2ec already produced a full T16 row for each of these 10 skills (0/10 direct match; 1/10 narrow format-slot overlap on `architecture`'s ADR template; 9/10 no overlap). **This patch does NOT re-derive them** (T-DUP) — it cites 53c2ec §2 rows 1-10 verbatim and adds only the Cowork-environment caveat (§A0) that 53c2ec did not carry. The one ADOPT-VOCABULARY candidate (ADR template → `/arch` §1's empty format slot) remains a surfaced-only descope, unchanged.

### design (7 skills) — newly adjudicated

| # | Skill | Upstream problem class (X) | Our problem class (Y) | Match? | Evidence |
|---|---|---|---|---|---|
| 1 | `design-critique` | Structured feedback on a Figma link/screenshot — usability, hierarchy, consistency, at any stage from exploration to final polish | **No counterpart.** We ship `design-compare` (operator-global, NOT via `install.sh`) — pixel-diff *verification* against a макет, the opposite end of the lifecycle. No critique/feedback skill. | **NO — different problem class** (feedback-generation vs pixel-verification) | desc verbatim (this session); `~/.claude/skills/design-compare/` |
| 2 | `design-system` | Audit/document/extend a design system — naming inconsistencies, hardcoded values, component variants/states/a11y notes, new patterns | **No counterpart.** We ship no design-system skill. `packages/core/composition/` ships React component *fixtures*, not a design-system audit. | **NO** | desc; `packages/core/composition/` |
| 3 | `accessibility-review` | WCAG 2.1 AA audit on a design/page — contrast, keyboard nav, touch target, screen reader, pre-handoff | **Partial mechanism, divergent scope.** Our global AGENTS.md mandates WCAG 2.1 AA as a *quality floor* and `ux-react-expert`/`ui-designer-react` agents audit accessibility — but these are operator-global, component-level, and our *enforcement* of a11y is prose+agent, not a shipped skill. Upstream is a dedicated pre-handoff audit skill. | **NO — name-adjacent, scope-divergent** (we mandate a11y as a floor across skills; upstream ships a dedicated audit skill) | desc; `~/.zcode/agents/{ux-react-expert,ui-designer-react}.md`; AGENTS.md «WCAG 2.1 AA accessibility» |
| 4 | `design-handoff` | Generate developer handoff specs from a design — layout, tokens, component props, interaction states, breakpoints, edge cases, animation | **No counterpart.** We ship no design→dev handoff skill. `native-css-responsive` (operator-global) is a CSS *technique*, not a handoff spec generator. | **NO** | desc; `~/.zcode/skills/native-css-responsive/` |
| 5 | `ux-copy` | Write/review microcopy, error messages, empty states, CTAs, naming | **No counterpart.** We ship no copy-writing skill. | **NO** | desc |
| 6 | `user-research` | Plan/conduct/synthesize user research — interview guides, usability tests, survey design | **No counterpart.** Out of our problem class (we are a framework-discipline project, not a UX-research tool). | **NO** | desc |
| 7 | `research-synthesis` | Synthesize interview transcripts/surveys/NPS into themes, insights, segments, prioritized next steps | **No counterpart.** Distinct from our research-patches (which distill *coverage gaps*, not user research). | **NO** | desc; `docs/meta-factory/research-patches/` |

**design tally: 0/7 direct matches.** All 7 are knowledge-work/UX skills with no counterpart in our executable-enforcement + dispatch-choreography contour. The closest (`accessibility-review`) shares the WCAG 2.1 AA *standard* with our AGENTS.md floor but ships it as a dedicated skill we do not own.

### product-management (8 skills + 1 command) — newly adjudicated

| # | Skill/cmd | Upstream problem class (X) | Our problem class (Y) | Match? | Evidence |
|---|---|---|---|---|---|
| 1 | `product-brainstorming` (+ `/brainstorm` cmd) | **Brainstorm product ideas / explore problem spaces / challenge assumptions as a thinking partner** — PM-flavoured: problem exploration, solution ideation, assumption testing, strategy. Frameworks: HMW, JTBD, Opportunity-Solution Trees, First Principles, SCAMPER, OODA, Reverse Brainstorming. Session: Frame→Diverge→Provoke→Converge→Capture. Explicit: «not to generate deliverables … think alongside the PM». | `/arch` §1 = **`superpowers:brainstorming` ADOPTed verbatim** — intent→clarifying-Qs→2-3 approaches with trade-offs→design section-by-section→spec+self-review; PLUS `/arch` §1.5 research contour, §2 cold review, §3 routing. We do NOT own the brainstorm loop's body. | **REAL mechanism-overlap, DOMAIN-DIVERGENT** — see §A2.1 for the full adjudication. Both are «sharp thinking partner that challenges assumptions before convergence»; the *methodology* overlaps (diverge/converge, assumption-stress, anti-premature-convergence); the *subject* differs (PM product-problem/user-hypothesis/metric vs technical-capability/architecture). | skill body (read in full this session, 400+ lines); `commands/brainstorm.md` (read in full); `/arch` SKILL.md §1 header «delegates wholesale to superpowers:brainstorming ADOPT-wrapped» |
| 2 | `write-spec` | Write a feature spec / PRD — Problem Statement, Goals, Non-Goals, User Stories, Requirements (P0/P1/P2 with acceptance criteria), Success Metrics, Open Questions, Timeline. Human-readable document. | Our spec contour: `/arch` §1.5 emits a *research-spec template* (pre-mortem + acceptance-criteria line, machine-shaped) and a *distillate* with `GO\|rework\|kill`; `/arch` §3 emits a **kickoff into a metered factory** (machine-parseable, crash-idempotent per runtime-bridge spec D10). `agents/fidelity-auditor.md` D1/D2 audit fidelity against the kickoff. | **NO — name-adjacent, format-divergent.** Upstream PRD = human-readable PM document (user stories, P0/P1/P2, success metrics). Our spec = machine-parseable kickoff + acceptance-criteria + distillate membrane feeding a factory. T16: both called «spec» but upstream is PM-review prose, ours is a metered-factory input. | skill body (read this session, PRD structure §); `/arch` §1.5+§3; `agents/fidelity-auditor.md` |
| 3 | `roadmap-update` | Update/create/reprioritize a product roadmap (Now/Next/Later, dependency slips) | **No counterpart.** Our `/pipeline` owns *wave/umbrella launch-table sequencing* (which stage to run next), not a product roadmap. Different artefact class. | **NO** | desc; `.zcode/skills/pipeline/SKILL.md` |
| 4 | `sprint-planning` | Plan a sprint — scope, capacity, P0 vs stretch, carryover | **No counterpart.** Out of our problem class (we have no sprint concept; `/dispatcher` executes stages, not sprints). | **NO** | desc; `/dispatcher` §0 |
| 5 | `stakeholder-update` | Generate audience/cadence-tailored stakeholder updates (exec-brief, eng-detail, customer-facing) | **No counterpart.** `/story` writes release narratives (a different artefact/audience). | **NO** | desc; `.zcode/skills/story/SKILL.md` |
| 6 | `competitive-brief` | Competitive analysis brief / battle cards / board materials | **No counterpart.** Out of our problem class entirely. | **NO** | desc |
| 7 | `metrics-review` | Product-metrics review with trend analysis + scorecard + recommended actions | **No counterpart.** Out of our problem class. | **NO** | desc |
| 8 | `synthesize-research` | Synthesize user research (interviews/surveys/tickets) into themes + ranked findings | **No counterpart.** Same as design `research-synthesis` — UX-research synthesis, not our coverage-gap distillation. | **NO** | desc |

**product-management tally: 0/8 direct matches; 1/8 real mechanism-overlap (`product-brainstorming`) that is domain-divergent; 1/8 name-adjacent-but-format-divergent (`write-spec`).**

### Aggregate (all 25 skills + 1 command across the trio)

**0/26 direct problem-class matches; 1/26 real mechanism-overlap that is domain-divergent (`product-brainstorming` ↔ `superpowers:brainstorming`); 1/26 narrow format-slot candidate inherited from 53c2ec (`engineering:architecture` ADR template).** No plugin-level verdict stands in for the capabilities — per `#pattern-matching-on-name` (T16).

> **Negative-existence census footnote (6-item checklist, §1):** claim = «the trio ships no executable enforcement». (1) Own-stack sweep: `git/trees/main?recursive=1` → 1657 files; grep for `hook|\.py$|\.js$|\.sh$|\.husky` → all 26 `.py` live in `bio-research/`+`data/` skills, the 1 `.js` is `.github/scripts/external-pr-scope.js` (repo infra, not a plugin), zero in engineering/design/PM. (2) Category sweep: checked for `hooks.json`, `.husky/`, `pre-commit`, `pre-push`, `exit 1`, `eslint rule`, `CI gate`, `blocking` — zero in the trio. (3) Semantic-distance: «enforcement», «gate», «block tool call» — none. (4) Adversarial counter-prompt «if it shipped a hook, where?» → `hooks/hooks.json` per CC convention — the trio's top-level listing shows no such file; DeepWiki confirms `hooks.json` is «rarely used in Cowork» and these three don't use it. (5) Prompt-list ≠ complete: README structure block names only `.claude-plugin/plugin.json`, `.mcp.json`, `commands/`, `skills/` — no hooks. (6) Trigger sweep: n/a. **Conclusion: confirmed — enforcement is via `.mcp.json` connectors + skill prose, NOT blocking hooks.**

---

## §A2 — Overlap adjudication (the two candidates) — real or name-adjacent?

### §A2.1 — `product-brainstorming` ↔ `superpowers:brainstorming` (wrapped by `/arch` §1): REAL mechanism-overlap, DOMAIN-DIVERGENT

This is the single most load-bearing overlap finding, so it gets the full T16 treatment.

**Upstream problem class (X):** a *product-PM thinking partner* that explores problem spaces, generates solutions, stress-tests assumptions, and explores strategy — **explicitly «not to generate deliverables … think alongside the PM»**. Modes: Problem Exploration, Solution Ideation, Assumption Testing, Strategy Exploration. Frameworks: HMW, JTBD, Opportunity-Solution Trees, First Principles, SCAMPER, OODA, Reverse Brainstorming. Session rhythm: Frame→Diverge→Provoke→Converge→Capture. Anti-patterns it names: solutioning-before-framing, feature-parity trap, anchoring-on-constraints, one-idea-brainstorm, analysis-paralysis, brainstorming-when-you-should-be-researching.

**Our problem class (Y):** `/arch` §1 **does not own a brainstorm body** — it delegates wholesale to `superpowers:brainstorming` (ADOPT, wrapped, never re-described, per `/arch` header «NOT authoritative for the ideation loop»). `superpowers:brainstorming` is a *generic-capability* ideation loop (intent→clarifying-Qs→2-3 approaches with trade-offs→design→spec+self-review). `/arch` adds around it: §1.5 research contour (pre-mortem + acceptance-criteria + distillate `GO|rework|kill`), §2 cold two-altitude review, §3 routing into a metered factory.

**Match?** The **methodology overlaps genuinely** — both are «divergent-then-convergent thinking partner that resists premature convergence and stress-tests assumptions». Several of upstream's anti-patterns (solutioning-before-framing, anchoring-on-first-idea) are methodologically identical to `superpowers:brainstorming`'s intent-exploration discipline. **BUT the domain diverges:**
- Upstream is **PM/product-domain**: user problems, hypotheses, metrics, competitive strategy, user segments, adoption assumptions. Its frameworks (JTBD, Opportunity-Solution Trees, OODA-for-competitive-tempo) are product-strategy tools.
- Ours (via `superpowers:brainstorming`) is **technical-capability-domain**: software design, capability mapping, architecture trade-offs, how to build X.

**Verdict: REAL mechanism-overlap, DOMAIN-DIVERGENT — not a redundancy and not a pure name-adjacency.** This is the nuanced middle case T16 exists to surface. The implication: the maintainer building a *product* (not just a framework) would find `product-brainstorming` genuinely additive on the **operator axis** for product-strategy thinking that `superpowers:brainstorming` does not specialise in — but it is **NOT** a candidate to displace or wrap `superpowers:brainstorming` (which we already ADOPTed and which `/arch` §1 wraps), because we do not own the technical-capability brainstorm body to swap. It is a *parallel-domain* skill, not a replacement.

**Cost gate:** cheap (CC/Cowork plugin enable on the operator's machine; no repo dependency; no shipped change). → ADOPT-operator candidate for product-strategy work; REFERENCE for the methodology overlap (HMW/JTBD/SCAMPER are reusable ideation vocabulary).

### §A2.2 — `write-spec` ↔ our spec/kickoff contour: NAME-ADJACENT, FORMAT-DIVERGENT

**Upstream (X):** a **human-readable PRD** — Problem Statement, Goals, Non-Goals, User Stories («As a [user type]…»), Requirements (P0/P1/P2 with acceptance criteria), Success Metrics (leading/lagging), Open Questions, Timeline. Output = a document a PM reviews.

**Our (Y):** `/arch` §1.5 emits a **research-spec template** (pre-mortem + acceptance-criteria line, machine-shaped) and a **distillate** with `GO|rework|kill` membrane; `/arch` §3 emits a **kickoff** into a metered factory. The kickoff is **machine-parseable** (crash-idempotent per runtime-bridge spec D10; consumed by `packages/runtime-bridge/src/kickoff.ts`); `agents/fidelity-auditor.md` D1/D2 audits fidelity against it.

**Match?** **NO — name-adjacent, format-divergent.** Both are called «spec» but upstream produces a PM-review prose document (user stories, success metrics, timeline); ours produces a metered-factory input (acceptance-criteria + distillate + kickoff). The acceptance-criteria *concept* appears in both, but upstream's is a PRD field; ours is a falsifier line feeding a gate. T16: adopting upstream's PRD format would NOT feed our factory — it would produce a document our `fidelity-auditor` cannot machine-parse. **No displacement, no adoption into the contour.**

---

## §A3 — Two-axis verdict per plugin (W3, BFR §1.1, canonical VERDICTS vocabulary)

Per [build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md), the two axes are adjudicated separately. Per the F2 gate ([`packages/core/principles/11-build-first-reuse-default.test.ts:70`](../../../packages/core/principles/11-build-first-reuse-default.test.ts) `VERDICTS` set), each shipped-axis cell is a single canonical verdict.

| Plugin | Operator axis | Shipped axis (canonical, single verdict) | Cowork caveat |
|---|---|---|---|
| `engineering` (10 skills) | **ADOPT** (53c2ec §4.2, unchanged) — for `standup`, `incident-response`, `debug`, `deploy-checklist`, `documentation`, `tech-debt`, skills we do not own. | **KEEP NARROW** | Optimal seat = Cowork, but CC-CLI-installable; no shipped change. |
| `design` (7 skills) | **ADOPT** — `design-critique`, `design-system`, `accessibility-review`, `design-handoff`, `ux-copy`, `user-research`, `research-synthesis` are all skills we do not own; the maintainer does UI work (this repo ships React components). Closest own-stack = `design-compare` (verification, not generation) + the operator-global design agents — different problem class. | **KEEP NARROW** | Optimal seat = Cowork (Figma/Amplitude connectors); CC-CLI-installable; no shipped change. |
| `product-management` (8 skills + 1 cmd) | **ADOPT** — `product-brainstorming` (real mechanism-overlap, domain-divergent — §A2.1, additive for product-strategy), `write-spec`, `roadmap-update`, `sprint-planning`, `stakeholder-update`, `competitive-brief`, `metrics-review`, `synthesize-research` — all out of our problem class. | **KEEP NARROW** | Optimal seat = Cowork (Linear/Notion/Figma connectors); CC-CLI-installable; no shipped change. |

**Two-axis net: ADOPT-operator + KEEP NARROW-shipped for all three.** The Cowork caveat does NOT change the shipped-axis verdict to «inapplicable» (because the trio IS CC-CLI-installable) — it stays the standard KEEP NARROW. It DOES sharpen the operator recommendation: run these in Cowork for maximum value; CC-CLI install is a secondary, workflow-dependent option.

**Why not REJECT-shipped:** REJECT is for upstream that would *actively harm* our setup. The trio is harmless to coexist with (it ships no enforcement that could conflict with ours; it degrades gracefully when absent). KEEP NARROW names «our scope is narrower; upstream serves a different consumer surface» — which is exactly the case (we ship executable enforcement + dispatch choreography; they ship prompt-shaping + connectors).

---

## §A4 — Integration with 53c2ec and #1210 (W4 — cite, do not duplicate)

**The §A0-error correction (load-bearing for this patch's reason to exist):**

PR #1210's §A0 resolved «what is the engineering plugin / design plugin?» and concluded (resolution bullet, verbatim from #1210 §A0): «**No directory named `engineering` and none named `design`** [in `claude-plugins-official`] … There is no plugin named **'engineering'** in the marketplace … there is a plugin named **'frontend-design'**, but no plugin simply named 'design'.» **That conclusion is correct for `claude-plugins-official`** — and #1210's §A1-§A4 utility verdict over that marketplace's 8 engineering-set plugins + `frontend-design` stands unchanged. **But it is FALSE for `anthropics/knowledge-work-plugins`**, where `engineering` and `design` DO exist as top-level plugin directories (this patch's §A1 census: `engineering/skills/` 10 skills; `design/skills/` 7 skills). The operator caught this («Оператор поймал»). This patch is the fix: it adjudicates the trio from the *other* marketplace that #1210's §A0 sweep did not cover.

| Prior verdict | What it covered | Relationship to this patch |
|---|---|---|
| **53c2ec** (off-marketplace standalone `engineering` v1.2.0 pack) | 10 skills, 0/10 match, ADOPT-operator + KEEP NARROW-shipped; ADR-template ADOPT-VOCABULARY candidate (descoped) | **Inherited + extended.** This patch's `engineering` verdict cites 53c2ec §2 rows 1-10 (does NOT re-derive) and adds only the Cowork-vs-CC caveat 53c2ec lacked. **Note:** the knowledge-work `engineering` and 53c2ec's standalone pack share 10 identical skill names + descriptions (verified this session) — they are effectively the *same content* distributed via two channels (the open-source repo + the off-marketplace listing 53c2ec saw). So the verdict converges, as expected. |
| **#1210** (`claude-plugins-official`: code-review, security-guidance, code-modernization, code-simplifier, feature-dev, hookify, claude-md-management, commit-commands + frontend-design) | 8 marketplace plugins + frontend-design; security-guidance + code-modernization = the real utility; frontend-design = REJECT-shipped | **Complemented, not duplicated.** #1210 covered a *different marketplace*. This patch covers the three `knowledge-work-plugins` the operator named as uncovered. The §A0 error is cited here (not fixed in #1210 — it is on review; this patch is the documented correction). |
| **#1183** (`2026-07-31-orchestration-contour-prior-art-comparison.md`) | mattpocock/superpowers/mission-control orchestration contour | **Methodology precedent only** — per-capability T16 reuse; different candidate set. |

**Anti-duplication check (T-DUP):** this patch does NOT re-adjudicate any capability #1210 or 53c2ec already covered. The 10 `engineering` skills are cited from 53c2ec; the 7 `design` + 8 `product-management` skills are genuinely new (sweep: 0 prior verdicts on `design`/`product-management` — confirmed by SSOT grep in §A5).

---

## §A5 — SSOT row (W5)

**ID selection rationale (§1.11 — verify against source, not session memory):** the SSOT max id on `origin/staging` is **#233** (`grep -oE '^\| [0-9]+ \|' | sort -n | tail -3` → 232/233; #234 is #1210's in-flight row, NOT yet on staging). PR #1210 is MERGEABLE/CLEAN and will land #234. To avoid an ID collision when #1210 merges, this patch appends **#235**, leaving #234 reserved for #1210.

**SSOT precedent sweep** (`grep -niE 'cowork|knowledge-work|product-management' docs/meta-factory/prior-art-evaluations.md` → **0 hits**): confirmed — no prior verdict on any knowledge-work plugin, Cowork, or product-management. This is a clean-area verdict.

The appended row (#235) lives in `docs/meta-factory/prior-art-evaluations.md` (separate file edit in this PR). Verdict cell = single canonical `KEEP NARROW` (per F2; the operator-axis ADOPT is captured in the Rationale cell, not the Verdict cell, to keep the Verdict cell canonical).

---

## §A6 — Falsifier (per verdict)

What evidence, if it materialised, would flip a verdict?

- **Any of the trio → ships executable enforcement (hooks/gates/CI/lint):** currently confirmed zero (§A1 census). If a future release adds a `hooks.json` with `decision:"block"` semantics (as `claude-plugins-official/security-guidance` ships), the relevant skill rows would shift from NO-overlap to potential redundancy with our enforcement layer, and the shipped-axis verdict would shift toward REJECT (conflict) or ADOPT (closure). Requires a major release.
- **`product-brainstorming` domain convergence → redundancy with `superpowers:brainstorming`:** if `superpowers:brainstorming` extended into PM-domain frameworks (JTBD, Opportunity-Solution Trees, product-metric assumptions) AND `/arch` §1 stopped being a thin wrapper, the §A2.1 verdict would shift from «domain-divergent, additive» to «redundant — re-evaluate». Currently `superpowers:brainstorming` stays generic-capability; no convergence.
- **`write-spec` → machine-parseable:** if upstream's PRD gained a machine-parseable acceptance-criteria schema consumable by `agents/fidelity-auditor.md` D1/D2, the §A2.2 verdict would shift from «format-divergent» to «candidate feed into the factory». Currently it is PM-review prose.
- **Shipped-axis KEEP NARROW → ADOPT:** if (a) we decide to ship a knowledge-work/PM/design surface to consumers (we currently ship none), AND (b) a harness-agnostic equivalent exists or we build one. Both absent today — and shipping any first-party Cowork-primary plugin as a mandatory companion would be a goal change ([README.md#why-this-exists](../../../README.md#why-this-exists)).
- **Cowork-vs-CC framing:** if Anthropic drops CC-CLI compatibility (removes the `claude plugin install` block from the README), the shipped axis would shift toward «inapplicable in principle for CC consumers» — but the operator axis (Cowork seat) would be unaffected.

---

## §1.7 self-check — forward + backward

### §1.7 Forward-check applied

Checked against currently-active layers (each with file:line evidence):

- **`build-first-reuse-default.md §1/§1.1/§3`** — seven verdicts (`.claude/rules/build-first-reuse-default.md:41-49`), two-axis split (§1.1) honoured: §A3 adjudicates operator + shipped separately; own-stack-first run per-capability in §A1 (the «Our problem class» column IS the own-stack sweep). Mechanism run (§3): WebSearch ×3 + DeepWiki ×2 + raw-GitHub census (`git/trees/main?recursive=1` + per-skill `contents`) this session, not memory. **COMPLIES.**
- **`phase-research-coverage.md §1`** — 6-item checklist applied to the negative-existence claim «trio ships no enforcement»: §A1 census footnote records all 6 items explicitly. **COMPLIES.**
- **`ai-laziness-traps.md §2 T16`** — per-capability problem-class match: §A1 carries one T16 row per design (7) + product-management (8) skill; engineering's 10 are cited from 53c2ec (T-DUP). No plugin-level verdict without per-capability match. **COMPLIES.**
- **`phase-research-coverage.md §1.11`** — verify-against-source: the ID-selection decision (§A5) re-checked `origin/staging` max-id rather than trusting session recall; the §A0 correction re-read the README + repo description rather than inheriting the kickoff's «Cowork-only» Host fact. **COMPLIES.**
- **`dual-implementation-discipline.md §3`** — AI-/OS-/license-agnostic default: §A3 ships nothing new; the trio is first-party Cowork-primary; making it mandatory would be a goal change. **COMPLIES.**
- **`doc-authority-hierarchy.md`** — this patch is a Class-B process/utility verdict (not a load-bearing gate); it edits no rule/skill/agent/hook (§descope). **COMPLIES.**
- **`recommendation-laziness-discipline.md` (H1)** — every ADOPT/KEEP NARROW in §A3 cites either 53c2ec, this session's census, or the live body reads; each carries a falsifier in §A6. No unbacked verdict. **COMPLIES.**

### §1.7 Backward-check applied

Change class = *utility/prior-art verdict over the knowledge-work-plugins trio (engineering/design/product-management)*. The diff touches ONLY (a) this research-patch and (b) the SSOT row #235 append. Sibling surfaces a cold sweep must reach (T21 — enumerate surfaces OUTSIDE the diff, not restate it):

| Sibling surface | Verdict | Evidence |
|---|---|---|
| **Verdict 53c2ec** (standalone `engineering` pack, worktree) | **SWEPT-CLEAN — cited + extended, not re-litigated** | §A4: this patch's `engineering` verdict cites 53c2ec §2 rows 1-10 verbatim and adds only the Cowork caveat; 53c2ec's ADOPT-operator + KEEP NARROW-shipped is inherited unchanged. The 10 skill names+descs verified identical this session (§A4 note), so the verdicts converge as expected. |
| **PR #1210** (`claude-plugins-official` utility patch, on review) | **SWEPT-CLEAN — complemented, §A0 error cited not fixed** | §A4: this patch covers a *different marketplace*; #1210's §A1-§A4 verdicts over its 8+1 plugins stand unchanged. The §A0 error is cited here as the correction, not edited in #1210 (it is on review). |
| **`2026-07-31-orchestration-contour-prior-art-comparison.md`** (#1183) | **SWEPT-CLEAN — methodology precedent only** | §A4: different candidate set (mattpocock/superpowers/mission-control); only the per-capability T16 methodology is reused. |
| **SSOT rows #64 (SDD), #111 (`/dispatcher`), #149 (CC plugin schema), #84 (`claude plugin install`)** | **SWEPT-CLEAN — referenced, not modified** | §A3 ships nothing new; #149's CC-plugin schema and #84's install mechanism are the *channel* the operator-axis ADOPT uses. The new row #235 is append-only; existing rows untouched. |
| **`companions.manifest` + `setup.d/15-companions-stack.sh`** | **SWEPT-CLEAN — explicitly NOT edited (descope)** | §A3 nets to zero companion changes; the manifest's entries are unchanged. No silent supersession of `superpowers`/`ast-grep`. |
| **`/arch`, `/dispatcher`, `/harvest` SKILL.md** | **SWEPT-CLEAN — referenced as the audited pipeline, not edited** | §A1's «Our problem class» column cites these skills as the gap-baseline; §A2.1 cites `/arch` §1's brainstorming-wrap header; the skills themselves are not modified. |
| **`superpowers:brainstorming`** (ADOPTed, wrapped by `/arch` §1) | **SWEPT-CLEAN — the overlap target, not displaced** | §A2.1: `product-brainstorming` is «domain-divergent, additive», NOT a candidate to displace or wrap `superpowers:brainstorming` (we do not own the technical-capability brainstorm body to swap). The ADOPT of `superpowers:brainstorming` stands. |
| **`agents/fidelity-auditor.md`** | **SWEPT-CLEAN — referenced, not edited** | §A2.2 cites its D1/D2 machine-parseable fidelity contract as the discriminator vs upstream's prose PRD; the agent is not modified. |

**T21 discriminator:** the surface list above is NOT the diff's own files (diff = patch + SSOT row #235; sweep = 8 sibling surfaces outside the diff). The backward-check enumerates sibling verdicts/rules/manifest/skills/agents this patch could have silently contradicted; it does not restate the diff.

---

## See also

- **Verdict 53c2ec** — the standalone off-marketplace `engineering` pack (ADOPT-operator + KEEP NARROW-shipped, 0/10 problem-class match). Lives in worktree `rules-as-tests-aif-feature-anthropic-engineering-prior-art-53c2ec-…` at `docs/meta-factory/research-patches/2026-08-01-anthropic-engineering-plugin-prior-art.md`; **NOT on staging** at this patch's authoring time. This patch inherits 53c2ec's 10-row engineering T16 and adds the Cowork caveat.
- **PR #1210** — `claude-plugins-official` utility verdict (security-guidance/code-modernization = real gaps; frontend-design = REJECT-shipped). At `docs/meta-factory/research-patches/2026-08-02-anthropic-plugins-utility.md`; MERGEABLE/CLEAN, not yet merged at this patch's authoring time. This patch complements it (different marketplace) and cites its §A0 error as corrected.
- [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — governing rule (§1 verdicts, §1.1 two axes + own-stack-first, §3 mechanism).
- [`phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md) — 6-item negative-existence checklist applied in §A1 census footnote.
- [`ai-laziness-traps.md §2 T16`](../../../.claude/rules/ai-laziness-traps.md) — per-capability problem-class match discipline (§A1).
- [`prior-art-evaluations.md`](../prior-art-evaluations.md) — SSOT; new row #235 appended by this patch (leaving #234 for #1210).
- **Live sources read this session:** `github.com/anthropics/knowledge-work-plugins` (repo, 1657-file tree census via `gh api git/trees`), raw README, per-skill `SKILL.md` bodies for all 25 trio skills + `product-management/commands/brainstorm.md` + `product-management/.mcp.json` + `product-management/CONNECTORS.md`; DeepWiki `anthropics/knowledge-work-plugins` ×2; WebSearch ×3 (2026-08 state-of-art).
