---
paths:
  - '.claude/skills/**'
  - 'agents/**'
  - '.claude/rules/**'
  - 'setup.d/**'
  - 'docs/meta-factory/prior-art-evaluations.md'
  - 'package.json'
  - 'packages/core/package.json'
---

<!-- globs: .claude/skills/**, agents/**, .claude/rules/**, setup.d/**, docs/meta-factory/prior-art-evaluations.md, package.json, packages/core/package.json -->
<!-- inject: BFR: capability proposals resolve to one of 7 verdicts (ADOPT/ADOPT VOCAB/ADAPT/REFERENCE/KEEP NARROW/BUILD/REJECT); default ADOPT/REFERENCE; BUILD requires SSOT consult + DeepWiki+WebSearch ≥3 phrasings. See .claude/rules/build-first-reuse-default.md + prior-art-evaluations.md. -->

# Build-first, reuse-default — operating philosophy

> **Class:** A — companion principle test shipped at [packages/core/principles/11-build-first-reuse-default.test.ts](../../packages/core/principles/11-build-first-reuse-default.test.ts) (#75, 2026-05-17). Design sketch retained at [11-build-first-reuse-default.design.md](../../packages/core/principles/11-build-first-reuse-default.design.md). Channel: paths:(7) + edit-time inject (re-scoped from always-on Tier-0, operator verdict 2026-08-08); always-on pointer carriers: session-bootstrap digest invariant (1) + CLAUDE.md per-commit gate.
> **Fires:** any capability commit / new-capability proposal.
> **Authoritative for:** project-wide macro-level scope discipline; relationship to upstream tools, frameworks, and ecosystems; default verdict for new capability proposals.
> **NOT authoritative for:** per-commit build-vs-reuse — that lives in [CLAUDE.md «Build-vs-reuse invariant (Phase 8.8)»](../../CLAUDE.md). This rule is the macro-level complement to per-commit invariant.

> **Origin:** 2026-05-13 maintainer dialogue surfaced the operating principle. Codified per goal-clarity-dialogue §4.3 v2 verdict (2026-05-16) following the prose-rule-now / executable-test-later split discipline.

## §1 The principle

Maintainer's framing (paraphrased, 2026-05-13):

> «Не переизобретать велосипед — максимально переиспользовать готовые решения. Если есть то что уже работает лучше меня — берём это. Если там чего-то не хватает — дописываем сами.»

Formalised:

**Every capability proposed for this project resolves into ONE of seven verdicts:**

| Verdict | Meaning | When applicable |
|---|---|---|
| **ADOPT** | Use upstream tool/pattern verbatim; depend on upstream | Upstream solves identical problem-class; runtime coupling acceptable |
| **ADOPT VOCABULARY** | Use upstream naming/vocabulary; thin-wrapper implementation ours | Convergent design; vocab alignment reduces cross-project drift; no runtime coupling needed |
| **ADAPT** | Take upstream pattern + modify for our specific problem-class | Pattern useful but problem-class mismatch requires non-trivial changes |
| **REFERENCE** | Cite upstream as mature implementation precedent; our work stays meta-discipline | Our scope is rule/discipline; upstream is engine/runtime serving as «here's how it's done at scale» example |
| **KEEP NARROW** | Our scope narrower than upstream's; upstream noted as parallel-evolution at higher abstraction | Upstream applies our problem-class generically; we serve specific application surface |
| **BUILD** | Write ourselves; no upstream / fundamental misfit / load-bearing gap | Confirmed via §3 mechanism that no production-grade upstream candidate exists for our problem-class |
| **REJECT** | Upstream candidate surfaced + explicitly unsuitable | Upstream pattern would actively harm our setup; document why |

**Default = ADOPT or REFERENCE.** BUILD only after §3 mechanism confirms a documented problem-class mismatch or load-bearing gap.

## §1.1 Satellite doctrine — own-stack-first + two-axis application

The seven verdicts apply to dev-companions (**Claude Code, Superpowers, Superset, aif-handoff, AI Factory**, …) with three refinements. Relocated here 2026-06-01 from [CLAUDE.md](../../CLAUDE.md) — this rule, not CLAUDE.md, is Authoritative-for «relationship to upstream tools + default verdict» (CLAUDE.md owns only the per-commit gate).

**Own-stack-first (criterion zero).** Before reaching for a companion, check whether the harness you already run (**Claude Code**) ships the capability natively. Skipping this is `#own-stack-blind-spot` ([phase-research-coverage.md §1 item 1](phase-research-coverage.md)). Incident 2026-06-01: the companion survey tunnel-visioned on satellites for «control an agent from a phone» and missed that **Claude Code Remote Control** (`claude.ai/code` + mobile app, free on Pro/Max) already does it — making Superset Slack-Pro ([prior-art-evaluations.md #86/#99](../../docs/meta-factory/prior-art-evaluations.md)) redundant for that need.

**Two independent axes — a verdict can differ between them.** Reading a shipped-axis `REJECT` as «the operator may not use this» is a verdict-misread (incident 2026-06-01, SSOT #86/#98/#99):

- **Operator axis** — tooling the maintainer builds *with*. Default: **use companions maximally; don't reinvent.** A companion feature closing a real gap is `ADOPT`-on-operator, not merely `REFERENCE`d. No license/OS/portability constraint — it is the maintainer's machine.
- **Shipped axis** — the product installed into *any* consumer. Default: **AI-/OS-/license-agnostic core that integrates with companions and degrades gracefully when they are absent** ([dual-implementation-discipline.md §3](dual-implementation-discipline.md)). Integrate, never *hard-depend* (a consumer may be on Linux/Windows, OSI-only, no companion). The `./setup` companion-manifest flow ([`setup.d/companions.manifest`](../../setup.d/companions.manifest) + engine, per [companion-install-principle.md](companion-install-principle.md)) is the opt-in seam to set a companion up when absent — keep it opt-in + degrading; making a companion **mandatory** for consumers is a goal change ([README.md#why-this-exists](../../README.md#why-this-exists)), not an operational call.

**Cost gate (mechanical, not AI-judgment).** «Cheap» vs «expensive» = the [CLAUDE.md capability-commit](../../CLAUDE.md) test, reused so the call is grep-checkable rather than a vibe: *cheap* = text/skill/rule edit, env-var, config, or citation (no new dependency, no code-module ≥50-80 LOC, no standing infra) → ADOPT-now when it beats current practice; *expensive* = adds a dependency / code-module / standing infra → requires a **cited concrete friction instance** (memory/research-patch/incident, not «мне кажется»), else DEFER with a recorded trigger.

**Filter + priority.** Both axes share one filter: *closes a named gap*, not «because it's cool» (`#adoption-shame`'s inverse — every wired companion is maintenance surface). Priority (maintainer 2026-06-01): *use* features already in reach **before** building installers or speculative integrations (build-ahead-of-need is `#integration-overhead-overestimate`, §4).

## §2 Why this rule exists

**Primary user = single maintainer; single-domain project.** Maintenance budget = one person. Each BUILT-ourselves capability creates perpetual maintenance cost. ADOPT / REFERENCE distributes maintenance to upstream maintainers — they get bug reports, breaking changes, security patches.

**Per-commit build-vs-reuse already exists** ([CLAUDE.md «Build-vs-reuse invariant (Phase 8.8)»](../../CLAUDE.md)). It enforces SSOT consult + Prior-art trailer for each capability commit. **It works at the micro level.**

**Per-commit gate does NOT prevent macro-level `#parallel-evolution-creep`**: each commit can legitimately pass prior-art consult (no exact match in SSOT at that moment), yet 3-6 months later the *composed* result is a parallel implementation of what an upstream project already does better. This rule fills that gap.

## §3 Mechanism

Six layers, each catching different evidence:

1. **Prior-art SSOT trailer** required on capability commits (already enforced via `.husky/pre-push`).
2. **[phase-research-coverage.md](phase-research-coverage.md) §1 6-item checklist** on negative-existence claims («no upstream candidate exists»).
3. **DeepWiki `ask_question` MCP tool** for repository-level inquiry — «does repo X have pattern Y?». Critical for «is this problem already solved upstream?» questions. Use ≥3 phrasings.
4. **WebSearch ≥3 phrasings** on problem-domain term — for general state-of-art surveys («what frameworks exist for problem-class Z?»). Counters context7-only training-data bias.
5. **SSOT consult** for prior verdicts — `docs/meta-factory/prior-art-evaluations.md`.
6. **This rule** (macro-level operating philosophy) — distinct from per-commit gate; addresses scope-level drift across many commits.

> **Tooling caveat:** `context7` MCP is intentionally **excluded** from this list. context7 targets **library API documentation** (React, Next.js, Prisma, Tailwind etc.) — it does not surface «does production framework X exist for problem-class Y?» knowledge. Substituting context7 for DeepWiki+WebSearch in BFR-default decisions produces low-signal results — see goal-clarity-dialogue §4.3 maintainer correction 2026-05-16.

## §4 Anti-patterns

- **`#parallel-evolution-creep`** — building parallel to existing production tool because per-commit decisions never composed at scope level. Counter: this rule (macro check).
- **`#own-stack-blind-spot`** — believing «our problem is unique» because we never surveyed upstream. Counter: §3 mechanism mandatory before BUILD.
- **`#adoption-shame`** — refusing to adopt because «we can do it our way» (vanity ≠ technical reason). Counter: explicit verdict justification, not «we prefer to build».
- **`#integration-overhead-overestimate`** — assuming adoption costs more than build, without measuring. Counter: estimate integration cost in capability commit body when BUILD verdict chosen.
- **`#pattern-matching-on-name`** (companion to [ai-laziness-traps.md §2 T16](ai-laziness-traps.md)) — assuming ADOPTED item solves same problem-class as ours just because upstream uses similar name. Counter: explicit «Upstream problem class: X. Our problem class: Y. Match? Evidence: …» in verdict rationale.
- **`#vendor-lock-by-convenience`** — choosing ADOPT verbatim because one specific upstream is already in our stack, without comparing to ≥2 alternatives. Counter: when alt-target research is available, BFR-default consultation considers ≥3 upstream candidates per problem-class.

## §5 Promotion to executable test

**Companion principle test** (shipped #75, 2026-05-17): `packages/core/principles/11-build-first-reuse-default.test.ts`.

**Promotion timeline (per §4.3 v2 verdict) — COMPLETE:**

- **Commit A (2026-05-16):** prose rule (this file) + [design sketch markdown](../../packages/core/principles/11-build-first-reuse-default.design.md). ✅ landed.
- **Commit B (2026-05-17, #75):** real principle test implementation. ✅ shipped inside the 2-week window — the fallback below never triggered.

**Fallback (did NOT fire):** had Commit B slipped past the 2-week deadline, the rule would have retained prose-only status with a violation-rate-based promotion criterion («promote when 3+ violations in 6 months») matching peer rules ([phase-research-coverage.md](phase-research-coverage.md), [reviewer-discipline.md](reviewer-discipline.md), etc.).

> **Slot numbering note:** principle slot 10 is permanently occupied by `10-research-patch-annotation.test.ts` (shipped 2026-05-13, pre-1A). BFR-default → slot 11. Cascade applied across 1A roadmap.

## §6 Retirement

**Never retire.** This rule encodes a project-foundational operating philosophy — recursive self-application requirement makes retirement equivalent to abandoning the discipline-bearing artifact ownership model itself. If discipline framework changes structurally, revise this rule's content; do not delete.

2026-08-08 channel re-scope ≠ retirement — see §9.

## §7 Relationship to other rules

- **Subordinate to:** [CLAUDE.md «Build-vs-reuse invariant»](../../CLAUDE.md) at the per-commit level. This rule complements at the scope level.
- **Coordinated with:** [phase-research-coverage.md](phase-research-coverage.md) — both enforce «check before claim», this rule operates at decision-class scope, phase-research-coverage at substance-evidence level.
- **Companion in T-family:** [ai-laziness-traps.md T11/T12/T13/T16](ai-laziness-traps.md) — laziness traps that BFR-default specifically counteracts.

## §8 See also

- [packages/core/principles/11-build-first-reuse-default.design.md](../../packages/core/principles/11-build-first-reuse-default.design.md) — design sketch for the companion executable test (markdown design doc, not TypeScript)
- [docs/meta-factory/prior-art-evaluations.md](../../docs/meta-factory/prior-art-evaluations.md) — SSOT register
- [CLAUDE.md «Build-vs-reuse invariant (Phase 8.8)»](../../CLAUDE.md) — per-commit gate (predecessor at the micro level)
- [docs/meta-factory/research-patches/2026-05-16-goal-clarity-dialogue.md](../../docs/meta-factory/research-patches/2026-05-16-goal-clarity-dialogue.md) — origin research-patch
- [docs/meta-factory/research-patches/2026-05-16-1a-drafts-substantive-review.md](../../docs/meta-factory/research-patches/2026-05-16-1a-drafts-substantive-review.md) — pre-ship review that established slot-11 cascade + BFR rule final wording

## §9 Channel & recursive self-application (2026-08-08)

**Re-scope record.** Operator verdict 2026-08-08: this rule's full text moved off always-on Tier-0 core membership onto CC-native `paths:` + edit-time inject (`@dual-pair`). Resolves S-D′ spec §3.2 DECISION-NEEDED as Option B (target = this file). This is a channel re-scope, NOT retirement (§6 «Never retire» stands).

**Supersession.** The `session-start-token-audit` kickoff `:145` verdict «STAY (declared always-on core) — do NOT demote» is SUPERSEDED by this operator verdict.

**Observable restoration trigger.** Restore Tier-0 membership (all four copies: `scripts/render-rule-index.mjs TIER0_CORE`, `scripts/render-rule-channels.mjs ALWAYS_ON_CORE`, `packages/core/principles/31-rule-channel-declaration.ts ALWAYS_ON_CORE`, `packages/core/principles/31-rule-channel-declaration.test.ts` membership literal) upon ONE incident detectable from git artifacts:
- a merged capability commit whose `Prior-art:` trailer is the escape-hatch form AND whose diff touches none of this rule's `paths:` globs (frontmatter above), OR
- a `#parallel-evolution-creep` finding recorded in a research-patch.

**Proxy-floor honesty.** Edited-paths are a PROXY — read-time loads are not observable post-hoc; a session may read a surface matched by this rule's `paths:` globs without editing it. The proxy under-counts loads, so it can only fire when neither channel provably had its editing occasion — a conservative trigger.

**Self-application (T15).** This stage's own PR is capability-adjacent. The PR body shows the BFR/SSOT consult it preaches. §1a of the S-M kickoff exists because the swap applied to itself asked «who loads the rule after the rule stops loading?» — the carriers named there are the answer.
