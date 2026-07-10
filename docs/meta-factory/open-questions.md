# Meta-Factory: Открытые вопросы (что ещё не решено)

> Source: PROPOSAL.md §13 (split в Phase 1.D, 2026-05-07)
> Companion: [PROPOSAL.md](PROPOSAL.md) (overview) · [closed-questions.md](closed-questions.md) (archived entries)
>
> **Authoritative for:** currently-open and armed §13.x questions registry. Each entry: Status / Origin / Trigger condition for revisit / Cross-references. New entries append at the end of currently-open section; entries reaching terminal status migrate OUT to [closed-questions.md](closed-questions.md) atomically.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Closed/resolved questions are archived in [closed-questions.md](closed-questions.md).

---

## 13. Открытые вопросы (что ещё не решено)

### Currently-open entries TOC

| Entry | Status |
|---|---|
| [§13.4 Обработка legacy кодовой базы](#134-обработка-legacy-кодовой-базы) | open, armed |
| [§13.5 Multi-stack monorepos](#135-multi-stack-monorepos) | open, I-2 L1+L2 shipped (generation-live-delivery = hypothesis-realization) |
| [§13.6 Relationship с AIF core](#136-relationship-с-aif-core) | hypothesis verified; operationalization deferred |
| [§13.7 Operationalization L2 semantic drift detection](#137-operationalization-l2-semantic-drift-detection) | partial (symbolic v1 closed Phase 5; behavioral + embedding open) |
| [§13.8 Decision matrix expansion rule](#138-decision-matrix-expansion-rule) | open, running mechanism trigger |
| [§13.9 Bypass через `--no-verify`](#139-bypass-через---no-verify--структурное-решение) | open, armed |
| [§13.10 LLM v2 trigger conditions](#1310-llm-v2-trigger-conditions) | PARTIALLY FIRED (areas 1+2) |
| [§13.11 LLM cost model + tracking](#1311-llm-cost-model--tracking) | OPEN (trigger fired) |
| [§13.12 Real-corpus validation strategy](#1312-real-corpus-validation-strategy) | OPEN, v2 trigger |
| [§13.13 Versioning strategy для preset / recipes](#1313-versioning-strategy-для-preset--recipes) | OPEN, v2 trigger |
| [§13.14 Backwards compatibility / rules-lock.json migration](#1314-backwards-compatibility--rules-lockjson-migration) | OPEN, v2 trigger |
| [§13.16 Search-coverage discipline](#1316-search-coverage-discipline-methodology-layer-parallel-to-1310) | v1-shipped; open closure criteria |
| [§13.17 Three-tier hot/warm/cold context tiering](#1317-three-tier-hotwarmcold-context-tiering-deferred-arxiv-pattern) | deferred |
| [§13.18 AIF deep alignment — rules hierarchy adoption](#1318-aif-deep-alignment--rules-hierarchy-adoption-deferred-option-i) | deferred |
| [§13.19 Cline Memory Bank full pattern adoption](#1319-cline-memory-bank-full-pattern-adoption-deferred) | deferred |
| [§13.20 ADR formal adoption](#1320-adr-formal-adoption-deferred--docsadrs-directory--first-adr-file) | deferred |
| [§13.22 Own-conventions evolution mechanism](#1322-own-conventions-evolution-mechanism--fold-into-l2-research-agent-phase-5) | v1-shipped; deferred to Phase 5+ |
| [§13.24 H8 promoted; H7 still deferred](#1324-h8-promoted-to-4-catalog-h7-still-deferred) | H8 promoted 2026-05-12; H7 deferred (sample 1/3) |
| [§13.31 Project-wide discipline-theatre audit (Wave 9 umbrella)](#1331-project-wide-discipline-theatre-audit-wave-9-umbrella) | armed — triggers after maintainer commits to Phase 9+ scope |
| [§13.32 Project foundations audit & re-evaluation](#1332-project-foundations-audit--re-evaluation-phase-10-umbrella) | armed |

---

> **Note (D8 closure, 2026-05-13):** §13.1 and §13.2 archived to [closed-questions.md](closed-questions.md) (§13.1 empirically validated by Phase 5/6; §13.2 wishful pre-launch). See post-Wave-9 prioritisation session commit.

### 13.4 Обработка legacy кодовой базы

Если мета-фабрика устанавливается в **существующий** проект с кучей legacy кода — все сгенерированные правила сразу дадут тысячи violations. Что делать?

Варианты:
- Bulk `// audit:exempt` для existing files (не рекомендуется — заглушает)
- Baseline file типа eslint-baseline (фиксирует current violations, новые ловятся)
- Postpone enforcement — правила в WARN режиме первый месяц, потом ERROR

Это UX-вопрос, не архитектурный, но важный для adoption.

**Trigger:** first consumer onboarding reports adoption friction with ≥100 pre-existing violations on initial `setup.sh` run (formalized 2026-05-13 via D8 resolution). Until then: no signal expected (0 consumers).

### 13.5 Multi-stack monorepos

Что если в одном репо `apps/web` (Next 16) и `apps/api` (Fastify 5) и `packages/shared` (TS-only)? Три фабрики? Одна с разными scoped правилами?

Гипотеза: одна meta-factory invocation, на выходе — слой scoping в ESLint flat config, разные правила scoped к разным каталогам. Lock-файл общий, в нём отметки «правило R12 applies-to apps/web/**».

Это требует более продвинутого Layer 1 ([architecture.md](architecture.md) §2.3), который понимает workspace structure.

**Trigger:** first consumer is multi-stack monorepo (e.g. `apps/web` + `apps/api` + `packages/shared`), OR Phase 11 AIF integration entry research kicks off — workspace scoping in ESLint flat config is a primary Phase 11 entry-question (formalized 2026-05-13 via D8 resolution).

**Status 2026-06-28 — I-2 L1 + L2 shipped:**
- **I-1** (#790): fresh `-y` single-root stack auto-detect.
- **I-2 Layer 1** (#793): `_detect_stacks_per_workspace` / `_workspace_pkg_dirs` in `setup.d/lib.sh` — per-workspace detection map (`dir<TAB>stack`), node-free, tested.
- **I-2 Layer 2** (this branch, PR TBD): per-workspace scoping primitive + preset delivery.
  - `files:` emission seam added to both rule emitters: `buildRuleConfigElement` (N-rule / synth path) and `r2Element` (R2 path) in `packages/core/install/wire-eslint-r2.ts` — SSOT #182 (ESLint flat-config native `files:` scoping, REFERENCE).
  - `setup.d/40-configs.sh` converted from single-`$STACK` chain → per-workspace loop: each workspace dir receives its stack's recipe-synced preset `eslint.config.mjs` + `eslint-rules-local/index.mjs` stub (3-level re-export, workspace is always `container/name` deep).
  - `setup.d/99-finalize.sh`: R2 scoped to `apps/api/**` for ts-server workspaces; react-native workspace gets its preset; `unknown` workspace emits re-checkable marker.
  - Tests: `packages/core/install/wire-eslint-r2.test.ts` (scoped emission proof), `tests/install-sh/multi-stack-monorepo.test.sh` (timeliner acceptance + no-regression).
- **Remaining open (hypothesis-realization = sibling umbrella `generation-live-delivery`):** making the synthesizer the LIVE delivery for ts-server/react-native (the deep generation-coverage work — out of scope for L2, which builds only the scoping brick).

### 13.6 Relationship с AIF core

AIF — это workflow framework (slash-команды, sub-agents, .ai-factory/). Meta-factory — это генератор enforcement layer. Они **ортогональны**. Но как они стыкуются?

Гипотеза: `meta-factory` генерит **в том числе** обновлённые `.ai-factory/RULES.md`, sub-agent prompts (`best-practices-sidecar.md`), AGENTS.md секции. То есть AIF получает stack-aware контент через meta-factory.

**Status (2026-05-08):** hypothesis verified против AIF v2.11.0 через context7 MCP — see [aif-comparison.md](aif-comparison.md). Convergent structured-check format (§3); 4 integration touchpoints identified (§5). Operationalization Phase 6 (Research Agent) и Phase 11 (AIF integration).

### 13.7 Operationalization L2 semantic drift detection

Acceptance criterion для L2 в [self-application.md](self-application.md) §2: «Все три источника (`skills/rules-as-tests/SKILL.md`, `references/overview.md`, `references/ai-traps.md`) семантически синхронизированы; drift detection возвращает 0 расхождений». Но **что значит «семантически»**? Возможные операционализации:

- **Symbolic:** одинаковые term'ы (e.g. «MUST» vs «should» — диcyrepancy при demotion'е) — **CLOSED Phase 5** ([retros/phase-5.md](retros/phase-5.md), [packages/core/research/drift.ts](../../packages/core/research/drift.ts)): symbolic v1 ships modal-verb + term-presence detection over the 3 canonical sources; `framework-self-research` CI gate enforces 0 mismatches per commit. Same-line modal attribution trade-off documented inline at [drift.ts:79](../../packages/core/research/drift.ts#L79) (m1 from PR #5 review). Phase 7 closing edit — symbolic v1 is the v1 deliverable for this open question.
- **Behavioral:** rule из `overview.md` проверяется тестом из `ai-traps.md` → если изменился principle и не изменился test (или наоборот) — drift — **OPEN, v2 trigger**. Behavioral drift requires linking each principle to a runnable assertion; closed by either a real consumer reporting the gap or Phase 8 acceptance test.
- **Embedding-based:** semantic similarity score; threshold для drift — **OPEN, v2 trigger** (orthogonal to symbolic + behavioral; can layer on later).

> **Filename history (2026-05-07):** ранее три источника описывались как `skills/`, `principles.md`, `ai-traps.md` — но `principles.md` не существовал в репо (phantom file). Phase 1.D resync (per Art's Option A decision) исправил формулировку на реальные filenames; `references/overview.md` играет роль «principles» — содержит детальное описание 5 layers framework. Reviewer flagged это как MAJOR-2; canonical source — [self-application.md](self-application.md) §2.

### 13.8 Decision matrix expansion rule

Decision matrix в [self-application.md](self-application.md) §3 фиксирует 9 layer'ов локального enforcement. Добавление 10-го (например, типизация YAML schema, ESM/CJS coherence check, dependency policy) — по какому правилу включается / исключается?

Гипотеза: 4-критерия gate перед включением в matrix:
1. Failure-cost (low/medium/high) — пропуск через локальный gate
2. Local-cost (<100ms / 100ms-1s / 1s-10s / >10s)
3. Detectability только в runtime/не имеет обратной совместимости
4. Stage в lifecycle (pre-commit / pre-push / CI-only)

Решение принять при добавлении 10-го layer'а; до этого — текущая matrix фиксирована.

**2026-05-10 trigger note:** [§13.27](closed-questions.md#1327-functional-test-for-shipped-ai-briefing-templates--closed-by-wave-7) + [§13.28](closed-questions.md#1328-operator-side-discipline-gap--non-git-validation-path--closed-by-wave-7) close jointly with this entry under **Wave 7** (prompts in `.claude/orchestrator-prompts/wave-7-hot-checks-joint-closure/`, gitignored). Scope: hot-checks for code+docs, harness-level hooks as potential 5th lifecycle stage. Detailed in Wave 7 research.md. **2026-05-11 update:** dogfooded by Wave 7 sub-wave 7.5.a — 9 rows added citing 4-criteria gate verdict per row (see [self-application.md §3](self-application.md)); status remains open as running mechanism trigger.

### 13.9 Bypass через `--no-verify` — структурное решение

Локальный pre-commit / pre-push не блокирует автора который запускает `git commit --no-verify`. Без mitigation invariant декоративен.

Гипотеза (для Phase 1.A scope expansion):
- **CI gate на наличие `.husky/`** в root репо. Если директория пуста или hooks не executable — CI fail. Это не блокирует локальный bypass, но не позволяет push'нуть в main без setup hooks.
- **Audit-self job на наличие framework-self-install passing** — если автор закоммитил без локального запуска (любым путём, включая `--no-verify`), эту ситуацию ловит CI.

Это не silver bullet (контрибьютор всё ещё может временно отключить hooks), но превращает bypass из «invisible» в «visible breach» через CI signal.

**Trigger:** Wave 10 hook architecture closure (bash → TS-core hook migration) — at that closure boundary, evaluate whether CI `--no-verify`-detection (`.husky/` presence + audit-self framework-install passing job) is in-scope as a Wave 10.X sub-wave or remains deferred; OR first observed bypass incident in maintainer or consumer repo. Formalized 2026-05-13 via D8 resolution. Natural fit: Wave 10 already touches hook architecture; bypass-detection is the same layer.

### 13.10 LLM v2 trigger conditions

**Status:** PARTIALLY FIRED (areas 1+2 via Stage 2), areas 3/4/5 OPEN.
**Origin:** Phase 7 close (2026-05-08). EXECUTION-PLAN.md §6.0 locks deterministic-v1 stance and defers LLM extension as a strict-superset v2 trigger. This section is the SSOT for the trigger conditions per area.

> **Trigger fired (2026-06-23, recorded 2026-06-26).** Areas **1** (L2 LLM research) and **2** (Path A L3 gen — «picks from menu») were **fired** by the `stage-2-generate-path` umbrella (Stages 0–5 merged #668/#674/#680/#686/#690/#691): live `web_search` under `allowed_domains` + LLM rule-selection, gated by the existing deterministic L4. **Path A only** — areas **3** (Path B AST gen), **4** (Gate 5 two-AI review), **5** (Gate 3 Stryker mutation) remain **OPEN**, explicitly out-of-scope-HARD per [`stage-2-generate-path/kickoff.md:60`](../../.claude/orchestrator-prompts/stage-2-generate-path/kickoff.md), each with its own later trigger. Sequencing-commitment record (issue #646 hybrid decision): [research-patches/2026-06-26-phase-5-v2-trigger-fired.md](research-patches/2026-06-26-phase-5-v2-trigger-fired.md).

| # | v2 area | Layer | Trigger condition | Verification gate |
|---|---|---|---|---|
| 1 | LLM-driven research extension (context7 MCP + Anthropic `web_search_20250305` with allowed_domains) | L2 | First real consumer reports a research gap on a non-curated framework, OR Phase 8 acceptance shows curated store insufficient for Next 16 patterns | New gate: `framework-self-research --llm` returns drift = 0 against curated baseline + cost ≤$0.10 per `research --self` invocation |
| 2 | Path A LLM gen («picks from menu» — LLM selects existing ESLint plugins / configures options) | L3 | Phase 8 acceptance test passes deterministic; Phase 9 entry research validates ROI (closed negative 2026-05-08, [phase-9-entry-research.md §5 row A1](phase-9-entry-research.md)). **Next re-evaluation:** recipe count exceeds 15 (3× post-A6 baseline of ~5) AND ≥3 framework targets concurrently shipped (e.g. Next + Remix + SvelteKit) require per-framework rule namespace selection AND no single hand-curated preset fits all recipe surfaces. | Two-AI review (gate 5) + cost ≤$1 per generated rule + diff with hand-authored ≤10% |
| 3 | Path B AST gen (LLM writes ESLint rule TypeScript source) | L3 | Phase 9+ entry; new pattern with no existing ESLint plugin | Mutation testing (gate 3) green + paired bad/good corpus passes + human-review checkpoint before commit |
| 4 | Gate 5 — two-AI review via AI-agnostic sub-agent (read by active AI session on Max subscription, no CI API billing; `agents/compliance-verifier.md` = Wave 8.1b instance of pattern) | L4 | Re-armed under no-paid-LLM-in-CI policy (Wave 8.1b); Phase 8 cost-scope decisions DONE. Implementation deferred pending FP verification. | false-positive rate <20% on 10+ real PRs |
| 5 | Gate 3 — mutation testing via Stryker | L4 | Path B activation (gate 3 only mutates AST; nothing to mutate in Path A) | Stryker score ≥80% on Path B rules + runtime ≤5 min per CI run |

**Closure criteria.** Each v2 area closes when (a) trigger fires AND (b) verification gate passes for ≥1 real example AND (c) cost model in §13.11 reports a stable per-invocation budget. Until then: deterministic v1 ships.

**Entry #2 — Phase 9 entry coverage gap (recorded post-merge 2026-05-08).** [Phase 9 entry research](phase-9-entry-research.md) (merged via PR #13) closed §13.10 entry #2 ROI re-evaluation **negative** based on 5-candidate context7 coverage (Cursor, Continue.dev, [Factory ESLint Plugin](prior-art-evaluations.md), Cody, Aider — see [phase-9-entry-research.md §4.A1](phase-9-entry-research.md)). Two production-grade candidates with potentially-relevant rule-synthesis surface were NOT checked at the time: **AIF `/aif-evolve`** (LLM-driven rule synthesis from accumulated fix patches in skill-context domain — structurally adjacent paradigm to «LLM picks rules from menu», already an integrated dependency per [aif-comparison.md](aif-comparison.md)) and **Oh My ClaudeCode** family (multi-agent orchestration with autonomous workflows in our exact runtime — `/code-yeongyu/oh-my-openagent`, `/yeachan-heo/oh-my-claudecode`, etc.). Next entry research session that re-opens §13.10 entry #2 **must** include these candidates in the base before any verdict change. The current DEFER stance carries forward; this note records the gap for future-session discipline.

**Entry #2 — Next re-evaluation candidate base (Phase 9 A6 closure 2026-05-08).** Next re-evaluation candidate base **must include** the original 5 (Cursor / Continue.dev / Factory ESLint Plugin / Cody / Aider) **plus** the two flagged in `f92f60b`: AIF `/aif-evolve` and the Oh My ClaudeCode family. Skipping any of the 7 = REVISE on the entry research.

### 13.11 LLM cost model + tracking

**Status:** OPEN (trigger fired 2026-06-23; cost-tracking infra still deferred).
**Origin:** Phase 8 verdict gate already mentions «cost ≤$5» (EXECUTION-PLAN §6 Phase 8 evaluation), but no tracking infrastructure exists. First LLM v2 invocation triggers this.

**Trigger condition:** first LLM v2 invocation in any of L2/L3/L4 (per §13.10). **Fired** by the `stage-2-generate-path` umbrella (#691) — but generation runs **install-time on the consumer's own LLM subscription, never in CI** ([no-paid-llm-in-ci.md](../../.claude/rules/no-paid-llm-in-ci.md)), so the framework incurs `$0` and no cost-log was built. The open questions below stay deferred until a metered surface (e.g. a self-research CI path, areas §13.10 #1 verification gate) needs per-invocation budgeting.

**Open questions to answer at trigger time:**

- Where are per-invocation cost records stored? (proposal: `<consumerRoot>/.ai-factory/synthesizer-output/llm-cost-log.json`, ring buffer 30 days)
- Aggregation granularity — per rule, per plan, per phase, per consumer?
- Budget cap enforcement — soft warn vs hard fail? At which threshold?
- Authoritative source for token pricing — Anthropic billing API, hand-maintained constants, or both?
- Cross-model accounting (Sonnet vs Opus when gate 5 overrides) — how is cost attributed?

**Decision deferred** until first invocation; tracking shape emerges from real data, not speculation.

#### Gate 5 v2 invocation shape (decided 2026-05-08 Phase 8; re-armed 2026-05-12)

> **Re-armed under no-paid-LLM-in-CI policy (Wave 8.1b, 2026-05-12).** Original design assumed API billing via AIF `review-sidecar` (`model: opus` override) — conflicts with project policy (see `agents/compliance-verifier.md`: «This file is NOT a GitHub Action; it makes no LLM API call; it bills no tokens beyond your existing subscription»). Re-armed: AI-agnostic sub-agent prompt file read by the **active AI session** on Claude Code Max subscription. No CI API billing. Cost arithmetic below is superseded.

Phase 8 entry research (see [phase-8-research.md §6](phase-8-research.md)) closed the **scoping** decision for gate 5 — the **implementation** is still deferred per [§13.10 entry #4](#1310-llm-v2-trigger-conditions) v2 trigger.

| Dimension | Decision | Rationale |
|---|---|---|
| **Invocation mode** | **per-plan** (1 invocation per validate run, full plan in context) | Amortizes context overhead; decision preserved from Phase 8 scoping |
| **Model** | **active session's model** (no API override; Max subscription) | No-paid-LLM-in-CI policy (Wave 8.1b). Original Opus 4.7 API billing analysis superseded. |
| **Severity** | **advisory non-blocking** | AI-session-driven review carries FP risk; promote to blocking only after [§13.10 entry #4](#1310-llm-v2-trigger-conditions) verification gate fires («false-positive rate <20% on 10+ real PRs») |
| **Caching** | keyed on `rules-lock.json.sourceFingerprint` (sha256/16) | Lock already carries the fingerprint; rerun only when fingerprint changes |
| **Per-run budget** | **N/A** — Max subscription, no CI API billing | Supersedes original <$0.30 / <$5 estimates. §13.11 cost-tracking not needed for Gate 5 under AI-agnostic pattern. |

**Cost arithmetic** (Phase 8 original — superseded by AI-agnostic re-arming): original Opus 4.7 API billing estimates no longer apply. CI cost = $0 (Max subscription). §13.11 cost-tracking infrastructure remains relevant for other v2 areas (rows 1–3 in §13.10 table) if those reach build-trigger.

**Implementation status:** invocation shape updated to AI-agnostic pattern (Wave 8.1b re-arming); *building* gate 5 still deferred. Trigger to start build = §13.10 entry #4 v2 condition (Phase 8 cost-scope decisions DONE; no-paid-LLM re-arming DONE; verification gate FP rate still pending real-PR data).

**Cost-tracking infrastructure** (scoped above as a v2 deliverable per §13.11) is **not** built in Phase 8 — keyed on the same `sourceFingerprint`, but the storage shape (proposal: `<consumerRoot>/.ai-factory/synthesizer-output/llm-cost-log.json`) emerges with the first real invocation, not on speculation.

### 13.12 Real-corpus validation strategy

**Status:** OPEN, v2 trigger.
**Origin:** Phase 7 close — gate 4 (tautology) ships with a 3-file negative corpus (`empty.ts`, `comment-only.ts`, `unrelated.tsx`). This is sanitary, not exhaustive. Fullness depends on gate 3 + gate 5 + a real-world corpus.

**Trigger condition:** first real consumer onboard, OR Phase 8 acceptance test runs `meta-factory upgrade --from=next@15 --to=next@16` against a real Next 16 codebase.

**Open questions:**

- Corpus source — Vercel example apps, OSS Next.js projects on GitHub, hand-curated «representative» bundle?
- Negative corpus expansion — what categories beyond empty/comment-only/unrelated? (proposal: minified output, generated code, vendored libs, monorepo-shared utils, test fixtures)
- Corpus refresh policy — bound to framework version bumps (Next 15 → 16 = new corpus) or independent cadence?
- False-positive budget — what fraction of corpus may trigger an existing rule before the rule is rejected as too aggressive?
- Storage — in-repo fixtures, external git submodule, or pulled fresh from registry per CI run?

**Decision deferred** until first real consumer or Phase 8 acceptance, whichever fires first.

### 13.13 Versioning strategy для preset / recipes

**Status:** OPEN, v2 trigger.
**Origin:** Phase 7 retro — `rules-lock.json` ships with `schemaVersion` + `framework` + `version` fields (per [retros/phase-7.md L5 v1 scope](retros/phase-7.md)), but no policy yet on how recipe / preset versioning relates to consumer upgrades.

**Trigger condition:** Phase 11 entry research, OR first consumer who needs to upgrade across a recipe-incompatible boundary.

**Open questions:**

- SemVer for recipes — what counts as breaking? (proposal: removing a rule = MAJOR; relaxing severity = MINOR; tightening severity = MAJOR; adding new rule = MINOR)
- Preset versioning vs framework versioning — independent or coupled? (e.g. `preset-next-15-canonical@1.2.3` ↔ `next@15.4.x` — N:1 or 1:1?)
- Recipe deprecation flow — how is a removed recipe communicated to consumers with active locks?
- Channel discipline — stable / canary / nightly recipes, or single channel?
- Backports — does `preset-next-15-canonical@1.x` continue to receive fixes after `preset-next-16-canonical` ships?

**Decision deferred** to Phase 11 entry.

### 13.14 Backwards compatibility / rules-lock.json migration

**Status:** OPEN, v2 trigger.
**Origin:** Phase 7 close — `rules-lock.json` v1 schema is `{ schemaVersion, framework, version, ruleIds[], emittedAt, sourceFingerprint }` (sha256/16). First schema bump (e.g. adding `cost` field per §13.11, or `diagnosticsVersion` per self-diagnostics-design.md) needs a migration story.

**Trigger condition:** first additive change to `rules-lock.json` schema, OR first consumer with a v0 lock requesting upgrade.

**Open questions:**

- Schema bump policy — bump `schemaVersion`, write both fields during a deprecation window, drop old field after N releases?
- Lock auto-migration — does `meta-factory install` rewrite the lock to the current schema, or refuse and require explicit `meta-factory migrate`?
- Cross-version installer compatibility — can `meta-factory@1.2.0` read a lock written by `1.0.0`? Forward and/or backward?
- Drift detection during migration — sourceFingerprint changes shape (e.g. sha256/16 → sha256/full) — does that count as drift or as a schema-only event?
- Documentation locus — `rules-lock.json` reference doc separate from this open-question, or inline in `architecture.md §2.7`?

**Decision deferred** until first additive schema change.

### 13.16 Search-coverage discipline (methodology layer, parallel to §13.10)

**Status:** v1-shipped (Phase 8.8.1, 2026-05-08).
**Origin:** Phase 9 entry research §4.A1 closed §13.10 entry #2 ROI re-evaluation negative on a 5-candidate context7 sweep; post-merge surfaced AIF `/aif-evolve` and Oh My ClaudeCode family as production-grade analogs in adjacent paradigms (recorded in §13.10 trailer note + commit `f92f60b`). Methodology gap, not a content gap — the recording layer (Phase 8.8 mechanism: SSOT + principle 08 + `Prior-art:` trailer + pre-push hook) was operating correctly; nothing forced the **searching** layer to widen the candidate base before closing a load-bearing «no production analog» claim.

**Phase 8.8.1 v1 ships** as a docs-only methodology layer:

| Layer | Surface | Artifact |
|---|---|---|
| Rule | [`.claude/rules/phase-research-coverage.md`](../../.claude/rules/phase-research-coverage.md) | 5-item coverage checklist + 4 self-reflection prompts + 4 anti-patterns *(v1-ship snapshot, 2026-05-08 — item counts grew since; rule §1 is now count-free by design, see its header "Naming note")* |
| Patches accumulator | [`docs/meta-factory/research-patches/`](research-patches/) | one file per discovered gap; AIF `/aif-evolve` patch format |
| Discipline-layer SSOT trigger | this entry (§13.16) | when to widen / promote the rule |

**This entry is the SSOT for the discipline-layer gate**, parallel to §13.10 (which is the SSOT for LLM-bearing v2 capability triggers). §13.10 governs *when to build LLM features*; §13.16 governs *when the search-discipline rule itself needs revision*.

**Trigger condition for re-evaluation:**

- **Promote to mandatory pre-Step-1.5 checklist** if the next phase entry research session reports observed false-positive rate >0% (i.e. ≥1 verdict-changing coverage gap surfaces post-merge despite the rule being active). Promotion path: bake the §1 checklist into [EXECUTION-PLAN.md §5.5 Step 1.5](EXECUTION-PLAN.md) as a hard process gate, parallel to the existing SSOT consult.
- **Widen rule scope** if a tag accumulates on ≥3 patches in `research-patches/` — distillation pass folds the prevention rules into [`.claude/rules/phase-research-coverage.md` §1](../../.claude/rules/phase-research-coverage.md). Threshold mirrors AIF `/aif-evolve` 6/10 heuristic, scaled to our smaller corpus.
- **Retire** if 3 consecutive phase entry research sessions report observed-zero-FP and no tag accumulates above threshold over the same window. Retirement = collapse the rule into prose guidance in [CLAUDE.md](../../CLAUDE.md) + delete the rule file.

**Verification gate:** the rule applies recursively to itself per Phase 8.8.1 retro §7 — the rule's §1 checklist must, in retrospect, catch the AIF + Oh-My gap that triggered its creation. If self-review fails, the rule is REVISE not GO. (Outcome of the recursive check lives in [retros/phase-8.8.1-coverage-discipline.md](retros/phase-8.8.1-coverage-discipline.md).)

**Closure criteria.** v1 closes when (a) ≥3 phase entry research sessions consume the rule with observed-zero-FP AND (b) no tag accumulates above the distillation threshold over the same window AND (c) no 6th-item candidate is proposed via §2.3 self-reflection. Until then: v1 carries forward, distillation pass at each accumulation threshold.

### 13.17 Three-tier hot/warm/cold context tiering (deferred, arxiv pattern)

**Status:** deferred 2026-05-09 (recorded during goal-hierarchy restructure as «include in plan, do not implement now»).
**Origin:** [arxiv:2602.20478, «Codified Context: Infrastructure for AI Agents in a Complex Codebase»](https://arxiv.org/html/2602.20478v1) — 283-session production study describing three-tier architecture (hot ~660-line constitution + warm 19 domain-specialist agents + cold 34 on-demand spec docs ~16k LOC). Surfaced in goal-hierarchy research 2026-05-09 §9.4 as state-of-the-art compaction-resilience pattern.

**Why deferred:** current scale (9 phases, 1-3 maintainers, single-domain) does not warrant tier-loading infrastructure. Implementing tier-routing mechanism for a problem we don't have = over-engineering. The two-tier hot/cold split (per user's `~/.claude/skills/ai-docs/SKILL.md`) plus Step 0 read-first pattern (per [.claude/session-bootstrap.md](../../.claude/session-bootstrap.md)) cover current needs.

**Trigger condition for revisit:** any of —
- Phase count exceeds 12 (currently 9), with each phase having distinct invariant set.
- Project gains ≥3 distinct domains (parallel to arxiv's 19 specialists scenario).
- Observed compaction events lose load-bearing context ≥2× per quarter despite Step 0 pattern.
- Session length routinely exceeds 50k tokens (compaction frequency dominates).

**Cross-references:** [research-patches/](research-patches/) (AI-doc lens analyses); [.claude/session-bootstrap.md](../../.claude/session-bootstrap.md) (current two-tier implementation).

### 13.18 AIF deep alignment — rules hierarchy adoption (deferred, Option I)

**Status:** deferred 2026-05-09. Recorded during goal-hierarchy restructure.
**Origin:** goal-hierarchy research 2026-05-09 §9.7 surfaced AIF's three-level rules hierarchy (`AGENTS.md` + `.ai-factory/RULES.md` axiom tier + `rules/base.md` project tier + `rules.<area>` area-specific) and proposed Option I — `rules-as-tests-aif` declares principles as entries in AIF's structure rather than maintaining own.

**Why deferred:** AIF integration is Phase 11 work per [PROPOSAL.md §1.4](PROPOSAL.md). Tight alignment NOW = premature lock-in to AIF release lifecycle, weakens standalone-CLI use case (Q4 super-linter dual-positioning pattern). The package currently ships standalone with own install.sh + CLI; alignment decision belongs at Phase 11 entry research, not as a Phase 9.x doc-restructure side-effect.

**Trigger condition for revisit:** any of —
- Phase 11 (AIF integration) entry research kicks off — alignment vs independence is then a primary entry-research question.
- AIF ships `extension.json` schema finalization (currently «in active development» per [README.md §Forward-compatibility note](../../README.md)) — the schema may dictate alignment shape.
- Real consumer adopts the package as AIF plug-in (currently 0 consumers per [no-consumers caveat in §1](EXECUTION-PLAN.md)) — usage signal would clarify whether plug-in framing or standalone framing is the dominant mode.

**Cross-references:** [PROPOSAL.md §1.4](PROPOSAL.md), [aif-comparison.md §9](aif-comparison.md), [README.md `Forward-compatibility note`](../../README.md).

### 13.19 Cline Memory Bank full pattern adoption (deferred)

**Status:** deferred 2026-05-09. Recorded during goal-hierarchy restructure.
**Origin:** goal-hierarchy research 2026-05-09 §9.3 surfaced [Cline Memory Bank](https://docs.cline.bot/) — 6-file hierarchy (`projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`) + Mermaid diagrams in instructions + explicit re-read protocol enforced by Cline's own code.

**What was adopted now:** Step 0 re-read pattern (per [.claude/session-bootstrap.md](../../.claude/session-bootstrap.md)) + Mermaid drift-prevention diagram. This is the load-bearing subset.

**What was deferred:** the 6-file hierarchy itself. For a 1-3 maintainer single-domain project, 6 always-read files is heavier than current need. Risk: «every doc is a drift surface» (matklad) — adding 5 more files to maintain may produce more drift than it prevents.

**Trigger condition for revisit:** any of —
- Project gains multi-domain structure (e.g. separate domains for «framework core» + «consumer-facing presets» + «meta-factory generator») — Cline's productContext / systemPatterns / techContext separation maps directly.
- Active context (current task / focus area) becomes dominant maintenance burden in retros — `activeContext.md` would extract that load.
- Session-bootstrap file approaches 200 LOC (currently ~50) — split into multiple targeted files becomes natural.

**Cross-references:** [.claude/session-bootstrap.md](../../.claude/session-bootstrap.md) (current load-bearing subset implementation); [Cline Memory Bank docs](https://docs.cline.bot/).

### 13.20 ADR formal adoption (deferred — `docs/adrs/` directory + first ADR file)

**Status:** deferred 2026-05-09. Recorded during goal-hierarchy restructure.
**Origin:** [research-patches/2026-05-08-phase-8.8-ssot-format-vs-adr.md](research-patches/2026-05-08-phase-8.8-ssot-format-vs-adr.md) noted prior-art-evaluations.md format converged with ADR/MADR fields without consult; goal-hierarchy research 2026-05-09 §6 OQ2 surfaced ADR-supersede as the canonical pattern for the §6.0 #2 trigger change.

**What was adopted now:** ADR-supersede *semantics* applied inline in [EXECUTION-PLAN.md §6.0 #2](EXECUTION-PLAN.md) — original rule retained, supersede note states new evaluative trigger, no automatic unblock. AWS ADR practice cited inline. **No `docs/adrs/` directory created**, no separate ADR file format adopted.

**Why deferred:** project's existing pattern is SSOT entries + research-patches (similar functional outcome to ADRs per the 2026-05-08 patch finding). Adopting a separate ADR format for a single supersede = adding format-surface for one event. Per the same patch's recommendation: if a future session promotes ADR/MADR to a 6th SSOT entry («Decision Records, ADOPT VOCABULARY»), the SSOT itself can carry the precedent.

**Trigger condition for revisit:** any of —
- 3rd structural supersede or revisit-decision needed — pattern accumulation justifies dedicated format. Threshold mirrors the project's «3 patches per tag → distill» convention.
- A consumer requests formal ADRs (e.g. for compliance / audit purposes).
- Phase 11 AIF integration wants `aif-gate-result`-shaped decisions (cross-tooling format requirement).

**Promotion path when triggered:**
1. Add prior-art-evaluations.md entry «ADR / MADR Decision Records, ADOPT VOCABULARY» with retroactive citation of the §6.0 #2 supersede + this §13.20 entry.
2. Create `docs/adrs/` directory + ADR-001 backfilling the §6.0 #2 supersede.
3. Future supersedes ship as ADR files; EXECUTION-PLAN inline supersede notes link to ADRs by ID.

**Cross-references:** [research-patches/2026-05-08-phase-8.8-ssot-format-vs-adr.md](research-patches/2026-05-08-phase-8.8-ssot-format-vs-adr.md); [EXECUTION-PLAN.md §6.0 #2 supersede block](EXECUTION-PLAN.md); [prior-art-evaluations.md §3](prior-art-evaluations.md) entry-trigger criteria.

### 13.22 Own-conventions evolution mechanism — fold into L2 Research Agent (Phase 5+)

**Status:** v1-shipped (Phase A baseline 2026-05-09: SSOT entries #6-#10 + research-patches `adopted-pattern-drift` tag). Promotion to L2 Research Agent integration deferred until Phase 5+ ships.
**Origin:** goal-hierarchy follow-up research 2026-05-09 (`/tmp/own-conventions-evolution-research.md`) — Option E (Hybrid). Q4 finding: novel territory — no surveyed OSS project does meta-research on own adopted conventions. Q2 finding: industry-wide gap on prose-convention drift detection. Filling the gap from scratch = open research problem; cheaper to ride existing infrastructure when it ships.

**v1 baseline (this branch):**
- 5 SSOT entries (#6 Arc42, #7 AGENTS.md, #8 AIF Step 0, #9 Cline Memory Bank, #10 matklad) with velocity tags.
- 180-day staleness policy from `prior-art-evaluations.md` §5 applies to SLOW/STABLE entries; tighter explicit cadence per FAST/UNCERTAIN entries (90-day) in their `Trigger to revisit` lines.
- `adopted-pattern-drift` tag in `research-patches/` (per `.claude/rules/phase-research-coverage.md` §4 anti-pattern taxonomy) for incident-driven recording.

**Trigger condition for revisit:**
- L2 Research Agent ships (Phase 5 closes per [EXECUTION-PLAN.md §6](EXECUTION-PLAN.md)) — extension is natural at that point.
- ≥2 `adopted-pattern-drift` tag patches accumulate in `research-patches/` — pattern signal that incident-driven mechanism is bearing weight, fold into systematic.
- Real consumer reports drift between framework's adopted convention and downstream stack (currently 0 consumers per no-consumers caveat).

**Promotion path when triggered:**
1. L2 Research target list extended: research own-conventions parallel to user-stacks. Source list = SSOT entries #6-#10 (and any new adopted-pattern entries by then).
2. Diff-mode at version-bump events: when AIF / AGENTS.md / Cline ships a new version, L2 fetches current pattern via context7, compares to last-cached pattern in research-cache, surfaces diff as `research-patches/` entry.
3. CI integration: weekly cron job (or per-phase-entry sweep) running L2 own-conventions check; staleness flags become CI warnings.

**Out of scope for v1:** continuous polling (Option C — over-engineered for 1-3 maintainer scale, conflicts with own §6.0 #2 build-vs-reuse discipline); custom drift-detection tool (open research problem, disproportionate cost for one class of drift).

**Cross-references:** [`.claude/rules/phase-research-coverage.md` §4 anti-patterns](../../.claude/rules/phase-research-coverage.md) — `adopted-pattern-drift` tag added in same branch; [`prior-art-evaluations.md` §5 staleness policy](prior-art-evaluations.md) — extends to entries #6-#10; [open-questions.md §13.16](open-questions.md) — discipline-layer SSOT (parallel cadence-trigger pattern).

### 13.24 H8 promoted to §4 catalog; H7 still deferred

**Status:** H8 **promoted** 2026-05-12 (Wave 8 Batch C). §4 entry `#discipline-application-scope-blindness` added to [`.claude/rules/phase-research-coverage.md`](../../.claude/rules/phase-research-coverage.md); Layer 6 probes added to [`.claude/skills/self-reflection/references/forward-checklist.md`](../../.claude/skills/self-reflection/references/forward-checklist.md); SKILL.md enumeration updated. Research-patch: [research-patches/2026-05-12-§13.24-h8-promotion.md](research-patches/2026-05-12-§13.24-h8-promotion.md). H7 still deferred — threshold not met (sample 1/3). Entry remains open until H7 is resolved. _Originally deferred 2026-05-09 (Wave 0.5 close). Tracker entry for «next-session work» referenced in [research-patches/2026-05-09-§13.21-l3-self-review.md](research-patches/2026-05-09-§13.21-l3-self-review.md) and [PR #20 description Process retrospective](https://github.com/Yhooi2/rules-as-tests-aif/pull/20). Without this entry, follow-up work would have lived only as prose in those artefacts — same shape as H8 sub-case (b) «meta-commentary lags primary content», hence the explicit registration here._

**Origin:** two candidate anti-patterns surfaced during Wave 0.5 work, both as related sibling anti-patterns in the focus-tunnel family alongside `#recursive-self-application-gap` (per [`phase-research-coverage.md §4` preface](../../.claude/rules/phase-research-coverage.md) — siblings differ in dimension, not parent/child):

- **H7 «skill consumption blindness»** — project-internal skill (e.g. [.claude/skills/self-reflection/](../../.claude/skills/self-reflection/SKILL.md)) carries auto-trigger description with keywords matching the drafting context, yet skill is not engaged because the draftsman's attention frame doesn't load skill descriptions; auto-trigger requires the harness or operator to surface the skill explicitly. **Sample size: 1/3** (one occurrence in Wave 0.5 v1 drafting). Threshold not yet met.
- **H8 «discipline-application scope blindness»** — discipline applied to explicit object-under-review (a plan / recommendation / self-review patch), but **not** extended to (a) self-commentary about that object, (b) meta-commentary that lags primary-content updates, (c) claims accepted from collaborators (handover notes, reviewer findings) that propagate into edits. **Sample size: 3/3 named occurrences + 2 additional sub-case (b) instances within Wave 0.5 itself** — see [self-review.md §«H8 escalation list»](research-patches/2026-05-09-§13.21-l3-self-review.md) for the named occurrences and PR #20 retrospective for the additional sub-case (b) instances. Threshold met per [phase-research-coverage.md §3 aggregation](../../.claude/rules/phase-research-coverage.md) (3-patch threshold mirroring AIF `/aif-evolve`).

**Why deferred:** Wave 0.5 acceptance criteria explicitly «Out of scope: Promotion of candidate to §4 anti-pattern catalog». Wave 0.5 deliverable = revision + self-review only; distillation is separate work (research-patch documenting promotion + §4 entry + `forward-checklist.md` Layer 6 extension + optional executable meta-test). Bundling distillation into Wave 0.5 would have conflated «document the gap» (Wave 0.5 scope) with «operationalise the rule» (this entry's scope) — bad atomicity.

**Trigger condition for revisit:**

- **H8** — already met. Distillation can start at any next session that has bandwidth for rule-extension work; recommend pairing with Wave 1-4 reviewer cycles since H8 is most likely to recur during multi-surface implementation work.
- **H7** — second OR third occurrence in subsequent sessions, OR when a new L3-style multi-surface plan is drafted (whichever first). H7 distillation may be paired with H8 distillation if H7 reaches threshold concurrently.

**Promotion path when triggered:**

1. New research-patch under [`research-patches/`](research-patches/) documenting the promotion: one entry per anti-pattern (or combined if H7+H8 promoted concurrently). Includes occurrence list with file:line refs and sub-case enumeration.
2. Append entries to [`.claude/rules/phase-research-coverage.md §4` anti-pattern catalog](../../.claude/rules/phase-research-coverage.md) — for H8, three sub-cases (a/b/c) per current pattern definition in [self-review.md §H8](research-patches/2026-05-09-§13.21-l3-self-review.md).
3. Extend [`.claude/skills/self-reflection/references/forward-checklist.md`](../../.claude/skills/self-reflection/references/forward-checklist.md) Layer 6 «verify before stating» with explicit sub-case (c) probe: «check declarative-not-literal phrasing in self-referencing meta-commentary». Anti-tautology check: forbid hard-coded counts/enumerations in meta-sections that describe primary content.
4. **Optional** — meta-test in [`packages/core/principles/`](../../packages/core/principles/) that catches literal hardcoded counts/SHAs in meta-commentary docs (e.g. regex on `research-patches/*` + `EXECUTION-PLAN.md` for «N commits», numbered SHA enumerations outside test fixtures). Executable form per project thesis «documents lie; tests don't».
5. Update [`.claude/skills/self-reflection/SKILL.md`](../../.claude/skills/self-reflection/SKILL.md) anti-pattern enumeration to mention promoted-from-candidate names.
6. Optionally extend [`.claude/skills/self-reflection/references/anti-patterns-with-examples.md`](../../.claude/skills/self-reflection/references/anti-patterns-with-examples.md) with Wave 0.5 occurrences as case studies.

**Out of scope for this entry:** the actual distillation work (lives in next-session research-patch); design of meta-test specifics (literal-count detection regex, scope predicates); decision of whether to extend §1.7 sub-rule numbering vs add §1.8 (depends on cardinality of distilled patterns).

**Cross-references:** [research-patches/2026-05-09-§13.21-l3-self-review.md](research-patches/2026-05-09-§13.21-l3-self-review.md) §«H7 candidate observation» + §«H8 update» — sample data + sub-case enumeration; [research-patches/2026-05-09-§13.21-l3-revision.md](research-patches/2026-05-09-§13.21-l3-revision.md) — second-occurrence exemplar of §1.7 (parent rule); [PR #20 «Process retrospective» section](https://github.com/Yhooi2/rules-as-tests-aif/pull/20) — narrative context for additional sub-case (b) instances; [`.claude/rules/phase-research-coverage.md §3 aggregation`](../../.claude/rules/phase-research-coverage.md) — 3-patch threshold mechanism.

### 13.31 Project-wide discipline-theatre audit (Wave 9 umbrella)

Wave 8 (§13.29) closed `#discipline-theatre` at the **CI / hook surface layer** — places where the gap was enumerated in research-patch §1.1. It did NOT extend the audit to **prose-substance surfaces** across the project, where the same antipattern is structurally possible but mechanically harder to detect.

Suspected categories (NOT exhaustive — Wave 9 first task = enumerate):

1. **Trailer truthfulness** — `§1.7:` / `Prior-art:` / `§1.7 Bootstrap:` trailer bodies vs the actual diff content of their commits. Wave 8 checks for citation **presence**; not whether the cited file:line actually evidences the claim.
2. **Header accuracy** — `Authoritative-for:` scope statements (per `doc-authority-hierarchy.md`) vs the actual doc content. Wave 8 / principle 09 check **presence** of header; not whether the scope statement matches the doc.
3. **Mutation-adequacy** — all paired-negative tests in the repo (not just principles 01/02/04/08/09). Do they actually fail when the discipline is bypassed, or are they degenerate oracles? Subsumes §13.30.
4. **R1-R20 false-negative rate** — each lint rule has a regex/AST predicate; never measured against adversarial code samples that should fire it. Possible bypass via tiny syntactic variant.
5. **Catalogue substance** — SSOT verdict rationales, memory entry descriptions, skill auto-trigger keyword accuracy. Each currently «present and ≥N chars»; never adversarially audited.
6. **Wave 8 recursive self-application** — Wave 8 itself shipped claims (every PR body, every sub-agent prompt, every paired-negative arm). Each is subject to its own thesis.

**Status:** R-phase DONE (landed 2026-05-21, PR #87); I-phase prompts authored (gitignored scaffold, not formally closed); Wave 10 unblocked.

**Trigger to revisit:** n/a for R-phase (complete). I-phase sub-waves trigger per-category — each category (trailer truthfulness, header accuracy, mutation-adequacy, R1-R20 FN-rate, catalogue substance, Wave 8 recursive self-application) is an independent sub-wave.

**First action upon I-phase:** [`.claude/orchestrator-prompts/wave-9-discipline-theatre-audit/kickoff.md`](../../.claude/orchestrator-prompts/wave-9-discipline-theatre-audit/kickoff.md) (gitignored local scaffold) — per-category implementation sub-waves, each with paired-negative tests verifying mechanism substance. R-phase findings + category list are the input.

**Scope warning:** likely 4-8 week multi-session umbrella. Do NOT bundle into closure of §13.29 — bundling without substantive method is itself `#discipline-theatre`.

**Owner:** maintainer + Phase 9+ planning session.

---

### 13.32 Project foundations audit & re-evaluation (Phase 10 umbrella)

Phase 10 audits **foundational adequacy** — whether chosen mechanisms reflect best current understanding of the problem domain. Distinct from Wave 8 (CI/hook substance) and Wave 9 (behavioral compliance). Every load-bearing decision (PROPOSAL theses, EXECUTION-PLAN, R1-R20, principles, hook substance arms, CI gates, AI-agnostic sub-agent, SSOT format, doc artefacts incl. CLAUDE.md / INSTALL-FOR-AI three-layer model / `.claude/rules/*`) was made with **internal reasoning + context7 only** — external literature never part of methodology. Project-wide gap from day one; `#discipline-theatre` likely originates here.

**Six audit streams:** A1 architectural foundations · A2 mechanism choices · A3 AI-agnostic boundary · A4 AIF integration depth re-evaluation · A5 external tooling · A6 documentation artefacts. **5-class scope reduction** before sweeping: OWN-BUILD (full sweep) / ADAPTED (modifications + problem-class match) / ADOPTED-MECHANISM (5-check integration audit incl. problem-class match per `#pattern-matching-on-name`) / ADOPTED-VOCABULARY (sanity only) / REJECTED (rationale revalidation). ~120 points; ~35-40% scope reduction; AIF-chain risk mitigated (upstream unvalidated → item promotes to OWN-BUILD-class).

**Status:** armed. **Trigger:** Wave 9 closes AND maintainer commits to Phase 10 scope incl. possibility of foundational refactor. **Owner:** maintainer + Phase 10+ planning (post-Wave 9). **Scope warnings:** may surface foundational-thesis refinement (PROPOSAL/README revision) · may surface mechanisms duplicate production-grade tools · may itself become theatre (paired-negative methodology test required) · 4-6 weeks meta-work · moratorium consideration during R-phase.

**First action:** [`.claude/orchestrator-prompts/phase-10-foundations-audit/kickoff.md`](../../.claude/orchestrator-prompts/phase-10-foundations-audit/kickoff.md) (gitignored local scaffold — full A1-A6 enumeration, 5-class table, AIF-chain mitigation, recursive self-application, T-trap enumeration per [`.claude/rules/ai-laziness-traps.md`](../../.claude/rules/ai-laziness-traps.md) §3). R-phase output → `docs/meta-factory/research-patches/2026-MM-DD-§13.32-foundations-audit-research.md`.

**Cross-references:** §13.29 (Wave 8 CI/hook substance); Wave 9 umbrella (behavioral compliance — separate armed entry); SSOT #8, #27-32 in [`prior-art-evaluations.md`](prior-art-evaluations.md) (AIF verdicts → A4); `agents/compliance-verifier.md` + `INSTALL-FOR-AI.md` (AI-agnostic surface → A3); [`.claude/rules/ai-laziness-traps.md`](../../.claude/rules/ai-laziness-traps.md).

**Origin:** maintainer 2026-05-12 during Wave 8.4 — «возможно слишком узкий [ресёрч] … все правила и все их релизации прям ВЕСЬ проект». Wave 9 «research methodology adequacy» partially captures but scoped to R-phase docs only.

---

### 13.34 Autonomous self-audit triggering layer (post-Wave-10 research)

Project's discipline chain (CI hooks, principle tests, two-AI reviewer prompts, maintainer prompts) reliably catches AI-agent slips before merge. PR #51 (numeric-claims-unverified), PR #52 (memory-to-docs codification) demonstrated empirically: 9+ file:line / count / annotation slips caught across multiple review rounds — but **every catch required external trigger** (user prompt «обсудим», reviewer-session dispatch, CI hook firing, principle 10 test on push). The AI agent does NOT autonomously re-verify its own claims before declaring «done»; it drifts to next-thing without self-trigger.

Structural diagnosis: **AI session = «agent doer», not «agent self-trigger-er»**. Without external triggers, silent-bypass returns. Cost during PR #52: 3 review rounds for 10-commit PR. This is the recursive form of the project thesis itself (per [README.md#why-this-exists](../../README.md)) — same failure mode (silent bypass of conventions) extended one layer up: agents also do not autonomously verify their own claims at write time.

**Candidate mechanisms** (for research, not pre-decision):
- A. Claude Code hooks (PreToolUse / PostToolUse / Stop / SubagentStop / UserPromptSubmit) — automatic fire on events
- B. Mandatory skill auto-trigger — `.claude/skills/*` with hard «checklist must complete» gating
- C. AI-agnostic sub-agent invocation requirement — every «done» must include compliance-verifier output
- D. Structured output schema — claims in format with embedded verification refs
- E. Pre-completion checklist convention — hook gates «Stop» event on checklist completion
- F. External paid-LLM reviewer — **PRE-REJECTED** per [`no-paid-llm-in-ci.md`](../../.claude/rules/no-paid-llm-in-ci.md) (codified PR #52)
- G. Hybrid combinations

**Status:** armed; interim shipped + under empirical validation. Candidate-A interim (claim-scan Stop hook #96, recall+precision-fixed) is live but **salience-only**; whether it earns keep is now gated on a behavioural eval, not on belief (decisions Q-E1…Q-E4, 2026-05-21). Mechanism design largely independent of TS-core migration (most candidates are operator-side or AI-session-side, not project TS code), so timing flexible.

**Trigger to revisit:** Wave 10 closure (PR merging Wave 10 batch). Mechanism design benefits from waiting — accumulates additional empirical evidence (review-round burden on Wave 10 PRs). May be promoted sooner if review-round cost during Wave 10 itself becomes prohibitive.

**Empirical promotion gate (Q-E3, maintainer decision 2026-05-21):** the claim-scan interim graduates from interim → kept-mechanism **only** if the session-bound behavioural eval ([tests/eval/](../../tests/eval/), Q-E2) shows an **absolute ≥ +15 percentage-point** lift in claim-groundedness on the targeted class over the committed baseline ([tests/eval/baseline-2026-05-21.md](../../tests/eval/baseline-2026-05-21.md)), across **≥ 50 fired instances** — OR (baseline ≥ 0.85) a **≥ 50% relative reduction** in residual ungrounded rate. Below threshold → interim stays interim / candidate for removal or the H10-pair structural target. The clean A/B is **DEFERRED to longitudinal accrual** (Q-E1) — ~no claim-scan-active data exists yet. Methodology + confounds: [research-patches/2026-05-21-instruction-compliance-empirical.md](research-patches/2026-05-21-instruction-compliance-empirical.md).

**First action upon revisit:** `.claude/orchestrator-prompts/autonomous-self-audit-research/research-prompt.md` (gitignored local scaffold — full candidate enumeration, build-vs-reuse SSOT consult, search-coverage 6-item checklist on negative-existence claims about prior art, recursive applicability check «what catches the catcher's failure?», friction-budget quantification per candidate). R-phase output → `docs/meta-factory/research-patches/2026-MM-DD-§13.34-autonomous-self-audit-research.md`.

**Scope warning:** mechanism choice has friction budget — each candidate has per-turn latency / context cost / attention demand. Quantify before adoption. Also: any mechanism is **itself** subject to its own discipline (turtles-all-the-way-down) — paired-negative methodology test required.

**Recursive self-application gate:** the research patch produced by this entry's session **must** pass through its own proposed mechanism on its own claims. If patch makes claim «mechanism X catches numeric errors», THIS patch's numeric claims must validate through mechanism X. Failure of this gate = mechanism is not viable.

**Cross-references:** [PR #52 `feedback_no_drive_by_prs.md`](../../.claude/rules/no-paid-llm-in-ci.md) (codified policy constraining F category); [`ai-laziness-traps.md §2 T15 «Self-application skipped»`](../../.claude/rules/ai-laziness-traps.md) — companion problem statement; [`agents/compliance-verifier.md`](../../agents/compliance-verifier.md), [`agents/review-sidecar.md`](../../agents/review-sidecar.md) — existing AI-agnostic sub-agent precedents (Wave 8.1b); [`.claude/skills/self-reflection/SKILL.md`](../../.claude/skills/self-reflection/SKILL.md) — closest existing auto-trigger pattern (but skill-availability ≠ skill-execution); `docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md` §10.A — empirical evidence of recursive slip pattern that motivated this entry.

**Owner:** maintainer + post-Wave-10 planning session. Companion to [§13.32](#1332-project-foundations-audit--re-evaluation-phase-10-umbrella) — both armed for post-Wave-10 timeframe but addressing orthogonal layers (foundations-of-mechanisms vs autonomous-self-trigger-of-AI-agent).

**Origin:** 2026-05-13. PR #52 dialogue (memory-to-docs codification PR) — maintainer asked «разве это не я ловлю а каждый слой сам?» Surfaced structural distinction between «layer mechanically catches» (CI hook, principle test) and «layer triggered manually» (user-prompted re-check). Without trigger → AI silently passes wrong-claim through to merge-time. PR #52 itself accumulated 9+ such slips across 3 review rounds — load-bearing empirical evidence.

---

### 13.35 «1%-Rule» adaptation for skill trigger discipline

Superpowers (`obra/superpowers`) introduces a **«1% Rule»** — mandate skill invocation if there's even a slight chance of applicability. ADAPT-candidate for our trigger-keyword discipline in `.claude/skills/*/SKILL.md` frontmatter. Surfaced in [companion-target-comparison.md §3.1 + §7 Decision D](research-patches/2026-05-16-companion-target-comparison.md).

**Status:** ARMED — track without commitment to ADAPT work. Single-maintainer scope; current trigger keywords surfaced by skill frontmatter `description:` field plus orchestrator/reviewer dispatch already cover most cases. «1% Rule» would tighten by mandating skill invocation even on weak-keyword matches.

**Candidate mechanisms:**

- A. Extend SKILL.md frontmatter spec to include explicit «trigger sensitivity» tier (1%-Rule = «always invoke if any keyword matches»; current = «invoke if discriminating keyword matches»).
- B. Add «1%-Rule» check at session-bootstrap (re-read SKILL.md descriptions and proactively dispatch on weak matches).
- C. Reject — current sensitivity adequate; tightening produces false-positive skill loads.

**Trigger to revisit:** ≥3 documented incidents where a skill SHOULD have fired but didn't (skill-availability ≠ skill-execution per §13.34 cross-reference). OR maintainer commits to a skill-discipline session.

**Cross-references:** [companion-target-comparison.md §3.1](research-patches/2026-05-16-companion-target-comparison.md); [§13.34 Autonomous self-audit triggering layer](#1334-autonomous-self-audit-triggering-layer-post-wave-10-research) — related «skill-availability ≠ skill-execution» problem; [`.claude/skills/`](../../.claude/skills/) — current skill surface.

**Origin:** 2026-05-16 companion-target comparison R-phase. ADAPT-candidate flagged but not actioned per §7 Decision D2 (track as ARMED, not author-immediate-research-patch).

---

### 13.37 «Pressure scenarios» adoption for principle tests

Superpowers uses **«Pressure scenarios»** for skill testing — adversarial-probe pattern where a skill is run against scenarios designed to elicit incorrect behavior under time/scope pressure. ADAPT-candidate for our principle tests' adversarial-probe pattern. Surfaced in [companion-target-comparison.md §3.1 + §7 Decision D](research-patches/2026-05-16-companion-target-comparison.md).

**Status:** ARMED — track without commitment. Our paired-negative tests cover «what fails when the discipline is bypassed?»; «pressure scenarios» would add «what happens when the discipline is challenged under stress?» (e.g., time-pressure simulation, scope-creep adversarial input).

**Candidate mechanisms:**

- A. Add `packages/core/principles/N-pressure-scenarios.test.ts` per principle — mechanical adversarial fixtures (e.g., commits with intentionally-misleading trailers; skill triggers with weakly-matching keywords).
- B. Add a skill-level «red-team» fixture under `.claude/skills/*/red-team/` — hand-crafted adversarial inputs per skill.
- C. Reject — current paired-negative tests catch primary cases; pressure-scenario marginal benefit low until ≥3 principle-test bypass incidents observed.

**Trigger to revisit:** ≥3 incidents where a principle test PASSED but the discipline was effectively bypassed (false-negative principle tests, e.g., trailer-syntax check passes but trailer content is meaningless — partial Wave 8.1+ closure scope). OR maintainer commits to a principle-test-quality session.

**Cross-references:** [companion-target-comparison.md §3.1](research-patches/2026-05-16-companion-target-comparison.md); [`packages/core/principles/`](../../packages/core/principles/) — current principle test surface; [`.claude/rules/ai-laziness-traps.md §2 T7`](../../.claude/rules/ai-laziness-traps.md) — adversarial counter-prompt discipline; [§13.32 Project foundations audit](#1332-project-foundations-audit--re-evaluation-phase-10-umbrella) — related re-evaluation umbrella.

**Origin:** 2026-05-16 companion-target comparison R-phase. ADAPT-candidate flagged but not actioned per §7 Decision D2.

---

### 13.38 Claude Code v2.1.100+ token inflation tracking (GitHub issue #46917)

Anthropic-acknowledged server-side `cache_creation` token inflation in Claude Code v2.1.100+ (~20K extra tokens/request vs v2.1.98; ~40% cost increase commonly, 10–20× worst-case; no public fix date as of 2026-05-13). Workaround: pin a pre-v2.1.100 release — this project downgraded v2.1.114 → v2.1.98 (per project memory), which predates the inflated versions. Materially raises cost for any session-scaling plan (Agent Teams, parallel sub-waves, Phase 10 swarming); inflation is silent — no in-session signal. **Status:** ARMED tracking entry — NOT subject to [no-paid-llm-in-ci.md](../../.claude/rules/no-paid-llm-in-ci.md) (version/cost issue, not LLM-API-in-CI).

**Trigger to revisit:** Anthropic ships confirmed server-side fix for #46917 → decide whether a downgrade-policy note belongs in `CLAUDE.md`/`CONTRIBUTING.md`, then close; OR Phase 10 / Agent Teams work begins and the cost impact needs quantifying. **Origin:** research-tooling-evaluation R-phase §8 D4 (2026-05-16), entry opened 2026-05-21; refs [research-patches/2026-05-16-research-tooling-evaluation.md](research-patches/2026-05-16-research-tooling-evaluation.md) §8 D4 + §10.

### 13.39 Recommendation-moment gate (D6 decision — H1 shipped, H2 rejected, H10 → research)

Recommendation-gate iterative research (branch `research/recommendation-gate-iterative`, rounds 3–5) evaluated three mechanisms for catching an AI verdict/recommendation issued without evidence. **Maintainer D6 decision (2026-05-21):**

- **H1 (turn-start reminder) — SHIPPED (#117):** a recommendation-discipline checklist injected into the UserPromptSubmit `inject-session-bootstrap.sh` digest. Context reminder, NOT enforcement (0% FP, ~0 build, instruction-compliance-dependent — honest, no theatre claim).
- **H2 (Stop-hook keyword scanner) — REJECTED:** 67% false-positive rate (round-3 §3.7) = cry-wolf, which the #97 instruction-compliance finding showed erodes compliance. Disqualifying for a HOT gate.
- **H10 (verdict-as-tool-call `issue_verdict` schema) — DEFERRED to research.** HIGH build (custom MCP) for a single maintainer (BFR §2); baseline groundedness already ~0.75 (#97/#98 → small headroom); fabrication-bypass caveat (schema enforces structure, not truth).

**Status:** PARTIALLY RESOLVED — H1 shipped, H2 closed-rejected; **H10 ARMED** as a research item.

**First action upon revisit (H10):** dispatch `.claude/orchestrator-prompts/h10-verdict-gate-research/kickoff.md` (gitignored local scaffold — re-verify the BUILD verdict adversarially via the 6-item search check; fabrication-bypass deterministic pairing; schema boundary for shortlist meta-decisions; build-cost-vs-headroom kill-question; go/no-go surfaced as decision-needed). Run Phase -1 on the kickoff before dispatch.

**Trigger to revisit (H10):** maintainer commits to a HOT structural gate beyond H1; OR H1 + the #98 detector longitudinal data shows the reminder is insufficient (recommendation-class groundedness not improving). Keep **SEPARATE** from §13.34 (consolidation decided against — bounded scope, round-5 §5.3).

**Origin:** recommendation-gate-iterative R-phase rounds 3–5 §5 decision surface; D6 decided by maintainer 2026-05-21. **Cross-references:** [§13.34 Autonomous self-audit triggering layer](#1334-autonomous-self-audit-triggering-layer-post-wave-10-research) (related per-verdict-gate vs session-level-self-trigger split); #117 (H1 implementation); branch `research/recommendation-gate-iterative` (full evidence base).

### 13.40 meta-factory installer/diagnostics CLI — declared but not built (design-target registry)

The 2026-07-03 doc-remediation audit (PRs #867, #875, follow-up) found 5 `docs/meta-factory/*.md` docs honestly declaring a self-hosting meta-factory architecture (installer state-machine, self-diagnostics CI gate, upgrade CLI, research cache) that the code does not yet implement — the `meta-factory` bin is a literal placeholder stub. Each doc was **not** stripped of the aspiration; each got an inline `> **Implementation status:**` / `> **Design-target note:**` disclaimer (style matches `architecture.md:7`) so a reader is not misled into thinking the mechanism is live. This entry is the consolidated pointer.

**Declared-not-built surfaces (design-target, none regressions):**
- `failure-modes.md` §5.1/§5.2 — `.meta-factory-state.json` state-machine + `npx meta-factory install/--resume/--restart/status/--verify` CLI verbs.
- `risks.md` — `research-cache.json` + TTL/auto-regen + `rules:upgrade` script (mitigation table mixes this with the real, shipped `rules-lock.json`).
- `acceptance-tests.md` §6.3 — `meta-factory upgrade --to …` scenario.
- `core-stability.md` §7.2/§7.3 — CI job `core-stability` + `core.lock` artifact + `core/principles.test.ts` immutability gate.
- `self-application.md` L5(c) + §7 — CI gate `framework-self-diagnose` + `diagnostics-log.json` schema validation (L5(a)/(b) install-verification signals ARE shipped; only the (c) self-diagnose signal is the gap).

**Trigger to revisit:** work begins on Phase 8.X (self-diagnostics) or the `meta-factory` bin per `self-diagnostics-design.md` — replace each disclaimer with the shipped mechanism, or promote this entry's items to a tracked implementation phase.

**Origin:** 2026-07-03 doc-audit round 2, Type-B hunt (4 parallel auditors over `docs/meta-factory/*.md` + `.claude/rules/*.md`). **Cross-references:** [`architecture.md:7`](architecture.md) (the disclaimer style this entry's fixes reuse); [`self-diagnostics-design.md`](self-diagnostics-design.md) (Status: design only, Phase 8.X — the same gap, pre-existing honest marker).
