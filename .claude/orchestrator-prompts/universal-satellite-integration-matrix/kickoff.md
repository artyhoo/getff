# Umbrella: Universal-satellite integration matrix (R-phase)

> **Status:** STUB / NOT DISPATCHED. Drafted 2026-05-27 in continuation of `companion-reuse-deep-dive` umbrella discussion.
> **Authoritative for:** R-phase scope for «map each major companion's planning + inner-loop + execution + storage layers to identify integration surfaces for our project as universal satellite».
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). M-A umbrella scope (this is the *research input* M-A needs before refactor begins).

## §0 Origin & vision

Continuation of `companion-reuse-deep-dive` umbrella self-audit. Maintainer surfaced the **universal-satellite** vision (2026-05-27):

> «использовать для удобства своей разработки что-то одно [Superpowers] а наш проект сделать так чтобы он был одинаково хорошо под всех их как спутник»

I.e., maintainer's **own dev** = one preferred stack (Superpowers); **project ship surface** = neutrally compatible with ANY companion stack (AI-Factory, Superpowers, OhMyOpencode, aif-handoff, TaskMaster, Cline/Cursor agent modes). Our project sits as **satellite between/above** all, not inside any.

This re-frames the failed orchestrator-aggregation step in `companion-reuse-deep-dive` (8 documented wrong-narrow framings underscoring how poorly the orchestrator can hold this scope without explicit verification per companion).

## §1 R-phase scope

For each major companion (AI-Factory / Superpowers / OhMyOpencode / aif-handoff / TaskMaster — others if surfaced):

1. **Capability inventory**: what does it ship for
   - R1 persistent plan
   - R2 auto-discovery within-feature tasks
   - R3 cross-project / cross-umbrella task collection
   - R4 DAG dispatch ordering
   - R5 skill recommendation
   - + storage / execution / review / verification layers
2. **Integration surface** for our satellite layer:
   - Does it expose `skill-context/<our-skill>/SKILL.md`-style override hook? (AI-Factory: yes; others: verify)
   - Does it expose lifecycle hooks (pre-plan / post-plan / pre-execute / post-execute)?
   - Does it consume `.ai-factory/RULES.md`-style external config? Or its own format?
   - What's the universal injection point for Living Doc enforcement (R1-R20 / principle tests / audit-ai-docs / mutation)?
3. **Conflict surface**: where would our shipped pieces clash with the companion's own?
4. **Coexistence matrix**: which companion combos work together? (AI-Factory + aif-handoff already integrated via MCP `handoff_*` tools per `aif-plan/SKILL.md:5` — verify others)

## §2 Hard constraints

- **NO recommendation that picks a single companion** — universal-satellite vision is explicit
- **NO substrate edits** — research-only umbrella
- **6-item search-coverage check per negative-existence claim** (`phase-research-coverage.md §1`); pattern-matching-on-name (T16) explicitly enforced per probe
- **No-paid-LLM-in-CI** (subscription-bundled OK; cron/API-billed not)

## §3 Out of scope

- M-A umbrella implementation (this R-phase feeds M-A scope; M-A is separate)
- Choosing maintainer's dev stack (maintainer's preference: Superpowers, already known)
- Spawning sub-umbrellas autonomously per BUILD verdict; surface as recommendation only

## §4 Active T-traps (cross-ref [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md))

T1 (5+ probes per companion floor), T3 (every claim file:line or tool output), T7 (explicit T16 problem-class walk per companion), T11 (BFR-default §3 6-layer for every gap claim), T12 (DeepWiki at moment, not training-data), T13 (re-verify ADOPTED items vs upstream evidence), T15 (this R-phase itself must self-apply: «did we under-credit any companion?»), T16 (load-bearing — the 8 wrong-narrow framings in `companion-reuse-deep-dive` motivated this umbrella), T19 (cold-QA before PR), T20 (verdict cites evidence in same turn), T-CR-A (within-one-project, multi-initiative disambiguation per DeepWiki probe — proven trap)

## §5 Companion candidates to evaluate

| Companion | npm/repo | SSOT rows already evaluated |
|---|---|---|
| AI-Factory | `npm i -g ai-factory` (no GitHub repo public per `npm view` 2026-05-26); maintainer cutcode | Partial — referenced in README:115, but full planning stack NOT yet in SSOT |
| Superpowers | `obra/superpowers` | #55 #64 #65 #71 #74 #76 |
| OhMyOpencode | `code-yeongyu/oh-my-openagent` (verified canonical, 59.6k★, 2026-05-26) | #68 #81 (#81 cites non-existent `Doriandarko/oh-my-openagent` — broken citation, pending maintainer fix) |
| aif-handoff | `lee-to/aif-handoff` | #27 #28 #29 #30 #43 #46 #67 #80 |
| TaskMaster | `eyaltoledano/claude-task-master` | #73 (REJECT on paid-LLM; revisit if subscription mode exists) |
| Cline / Cursor agent | (built-in to harness) | Not in SSOT |
| OpenCode | (built-in plugin host) | Partial in #68 |

## §6 Deliverable

Single research patch: `docs/meta-factory/research-patches/YYYY-MM-DD-universal-satellite-integration-matrix.md`. Sections: §0 TL;DR, §1 per-companion capability inventory, §2 integration surface matrix, §3 conflict surface, §4 coexistence combos, §5 Living Doc injection points, §6 §1.7 Forward/Backward applied, §7 recommendation feed for M-A umbrella.

## §7 Dispatch protocol

Mode A inline Opus single Worker (per `orchestrator/SKILL.md` Phase 3). `isolation: "worktree"`, autonomous to PR-open per `companion-reuse-deep-dive` precedent. Cold-QA before PR (T19). Anti-collusion spot-check by orchestrator on one load-bearing companion-claim before relay to maintainer.

## §8 See also

- `companion-reuse-deep-dive/kickoff.md` — predecessor umbrella
- `companion-reuse-deep-dive` PR #248 6th comment — orchestrator self-audit chain ending with this stub
- README:72 (Living Doc focus = our genuine niche, confirmed)
- README:74 (Cline/Aider drop pending; expand to Superpowers-covered platforms)
- `.claude/rules/build-first-reuse-default.md` §3 (6-layer mandatory)
- `.claude/rules/phase-research-coverage.md §1` (6-item search-coverage)
- `.claude/rules/ai-laziness-traps.md §3` (T-trap enumeration mandate)

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
