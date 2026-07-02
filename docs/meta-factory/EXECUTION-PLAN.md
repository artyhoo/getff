# Execution Plan — Meta-Factory + Self-Application

> **Status:** v0.1.1 — для исполнения в новой сессии (8 findings closed 2026-05-07, see retros/EXECUTION-PLAN-review-2026-05-07.md)
> **Created:** 2026-05-07
> **Source:** обсуждение между Art и AI, итерации 1-7
> **Companion:** `docs/meta-factory/PROPOSAL.md` (architecture), `docs/meta-factory/ORCHESTRATOR-START-PROMPT.md` (запускающий промпт)
>
> **Authoritative for:** phase scope, sequencing, acceptance criteria, operational decisions.
> **NOT authoritative for:** project goal, methodology, design invariants — see [README.md#why-this-exists](../../README.md#why-this-exists). §1 below is a pointer, not a goal-bearing section.
>
> **Этот файл — transient artifact**. Живёт пока план не выполнен; после релиза 1.0 — архивируется в `docs/audits/`. Размер может превысить 500-строчный лимит, действующий для shipped framework docs (RULES.md и т.д.).

---

## 1. Цель проекта

> **Pointer (2026-05-09 goal-hierarchy fix):** project goal, methodology, and design invariants are owned by [README.md#why-this-exists](../../README.md#why-this-exists). This §1 is a pointer + operational acceptance criteria; it does **not** redefine the goal. Earlier framing of recursive self-application as «north star» drifted from README; the corrected hierarchy and Artifact Ownership Contract live in [README.md#why-this-exists](../../README.md#why-this-exists), [.claude/session-bootstrap.md](../../.claude/session-bootstrap.md), and [CLAUDE.md `Artifact Ownership Contract`](../../CLAUDE.md). Restructure rationale: see commits on branch `docs/goal-hierarchy-restructure`.

**Operational restatement (do not edit unless README changes):**

- **Goal** — AI agents can't silently bypass undocumented conventions. Every rule is an executable artifact that fails at the earliest reachable channel (edit-time → pre-commit → pre-push → CI → production audit; CI = last-resort gate).
- **Methodology** — generate enforcement rules from principles (presets устаревают, принципы — нет). Recursive self-application = quality signal (GCC bootstrap precedent), **not** the goal. Re-elevation to «north star» in any phase doc = drift; surface as a coverage-gap patch under [research-patches/](research-patches/).
- **Operational acceptance criterion (this plan):** мета-фабрика регенерирует canonical Next 15 preset с diff ≤5%, обновляет его до Next 16 с diff к manual baseline ≤15%, валидирует собственный output набором meta-tests, выведенных из тех же принципов которые она проповедует. This is *how we know the methodology works on the way to the user-facing goal* — not the goal itself.

> **No-consumers caveat (m4 finding 2026-05-07):** на момент 2026-05-07 у пакета нет downstream consumers. Этот ~4-month plan justified как initial proof of methodology — generates rules from principles such that recursive self-application is satisfied. Priority decisions внутри фаз должны учитывать: «если consumer'ов нет — какие decisions можно отложить до первого реального installation». User-value goal (per README) remains primary; methodology validation is a quality gate on the path to the goal.

---

## 2. Текущее состояние репо (на 2026-05-07, post-merge update)

**Branch (для исполнения этого плана):** `chore/self-application` (новая, создана от `main` 2026-05-07 после merge'а PR #1). Self-application umbrella per `docs/audits/2026-05-07-self-application-gap.md` proposed name.

**History context (B1 finding 2026-05-07):** PR #1 (`feat/audit-fixes-2026-05`) merged в `main` как commit `35ab3f9`. Этот план был black-drafted в той ветке до merge'а, отсюда устаревший state claim в v0.1.0; обновлено в этом v0.1.1 review.

**Что уже работает (на main HEAD `35ab3f9`):**
- `factory/rules-manifest.json` (280 строк) + `rules-manifest.schema.json` (63 строки) как SSOT
- `scripts/render-rules.ts` — manifest → markdown через Ajv
- `scripts/detect-applicable-rules.ts` — Stack Detector v0 (по `requires-package`)
- `setup.sh:82-97` — bash stack detection (next.config.* / package.json / react in deps)
- `templates/shared/eslint-rules/` — 7 ESLint правил с RuleTester + Vitest paired tests
- `audit-self.yml` — 4 jobs (mechanical, rule-to-probe, probe-tests, manifest-render-check)
- `workflow-integrity.yml` — actionlint + zizmor + branch-protection assert
- `tests/audit/audit-ai-docs.test.sh` — 16 негативных тестов

**Что НЕ работает (подтверждено через `ls`):**
- ~~`.husky/` в корне репо отсутствует. Templates `husky-pre-commit.sh` и `husky-pre-push.sh` существуют, шипятся consumer'у через `install.sh:171-174` (mkdir + copy + chmod), но **author их не запускает**.~~ — ЗАКРЫТО (Phase 1.A, commit `fea6ea7c7`): `.husky/{pre-commit,pre-push,post-checkout}` в корне репо и активны у author'а; таблица Pre-commit/Pre-push и схема ниже сохранены как историческая мотивация Phase 1.A (отметка 2026-07-02, doc-truth sweep).
- ~~`audit-self.yml` НЕ имеет job'а `framework-self-install`~~ — ЗАКРЫТО 2026-06-29 (PR #823): jobs `framework-self-install-{ts-server,react-next,validated}` + `install-self-verification.test.sh` гоняются в CI.
- `audit-self.yml` НЕ запускает actionlint/zizmor (что и привело к 4-cycle fix на workflow-integrity.yml).
- `.claude/orchestrator-prompts/` — нет валидации SHA/file-existence для action references (привело к фейковому `rhysd/actionlint@<fake-sha>` в batch-D.md).

**Существующие документы по теме:**
- `docs/meta-factory/PROPOSAL.md` (709 строк, draft 0.1.0) — architecture
- `docs/audits/2026-05-06.md` — fresh-session audit (6 findings, 4 closed, 1 invalid, 1 open)
- `docs/audits/2026-05-07-self-application-gap.md` — short snapshot self-application gap

---

## 3. Ключевые insights этой сессии

### 3.1 Self-application gap — fundamental, not peripheral

**4 слоя enforcement которых нет в собственном репо:**

| Слой | Что есть | Что отсутствует | Цена отсутствия |
|---|---|---|---|
| Spec discipline | orchestrator-prompts директория | SHA-validation, action existence check | Фейковые SHA коммитятся (`rhysd/actionlint@<fake>` в batch-D) |
| Pre-commit | template для consumer'а | `.husky/pre-commit` в репо автора | Markdown >600 / broken bash коммитятся |
| Pre-push | template для consumer'а | `.husky/pre-push` в репо автора | actionlint/zizmor errors уходят в CI (4 fix-cycle на 1 PR) |
| CI-as-self-test | `audit-self.yml` + `framework-self-install-{ts-server,react-next,validated}` jobs + `install-self-verification.test.sh` (PR #823, 2026-06-29) | — закрыто; E2E install+self-verify в CI | (исторически: регрессии ловил consumer) |

**Эпистемологический разрыв:**
```text
templates/shared/husky-pre-commit.sh  ← author видит как ШАБЛОН
                ↓ install.sh копирует
.husky/pre-commit                       ← consumer видит как СВОЙ pre-commit hook
```
Author никогда не запускает install.sh на свой же репо → `.husky/` у него не создаётся → template сломан до того, как consumer его установит.

**Heuristic test:** удалить из CI всё CI-specific. Что осталось — должно работать локально. Если разработчик не запускает это локально — self-application нет. Применительно к этому репо: `audit-self.yml` mechanical job, `tests/audit/audit-ai-docs.test.sh`, actionlint, zizmor — всё запускается одной командой локально. **Не запускается** не потому что нельзя — потому что не сделано.

**Anti-patterns которые gap нормализует:**
- «CI поймает» — да, через 60-90с после commit'а за стоимость review-cycle
- «Я смотрю diff перед push» — привычка, не systematic enforcement; ломается на больших PR
- «У меня IDE-плагины» — IDE diagnostic однажды поймал `rhysd/actionlint`, на втором witness был бы проигнорирован
- «Это small repo, не нужно» — 16 коммитов, 28 файлов, 8 batch'ей делегации = уже не small
- «Husky медленный» — actionlint 200ms, zizmor 2-3s, pre-push <10s = норма

### 3.2 Архитектурные invariants каждого слоя

Self-application — **не отдельный шаг**, а cross-cutting invariant. Каждый компонент мета-фабрики должен иметь explicit self-application clause:

| Слой | Self-application clause | Acceptance |
|---|---|---|
| L0 Invariant Core | Принципы исполнимы как тесты, прогон в pre-commit/pre-push/CI на собственном manifest'е | Author не может закоммитить нарушение принципа |
| L1 Stack Detector | Детектит сам себя в CI | `setup.sh --stack=$(detect)` идемпотентен на собственном репо |
| L2 Research | Research собственные docs: `skills/rules-as-tests/SKILL.md` + `references/overview.md` + `references/ai-traps.md` (canonical per [self-application.md](self-application.md) §2) | Все три источника семантически синхронизированы; **operationalized 2026-06-29** — live web_search research port+adapter+provenance-gate (PR #686), дефолт доставки augment-first (PR #824) |
| L3 Synthesizer | Regenerate canonical preset, diff с live | Minimal diff |
| L4 Validator | Прогоняется на `rules-manifest.json`, не только на LLM-output | Каждое существующее правило проходит meta-tests |
| L5 Installer | Запускается в CI на tmp-dir, результат проходит framework's audits | framework-self-install green — достигнуто 2026-06-29 (PR #823) |
| Spec discipline | orchestrator-prompts валидируются как код | Невозможно закоммитить spec с фейковым SHA |

### 3.3 Prior art — никто не делает stack-aware research-based generation с self-validation

| Проект | Что делает | Чем отличается |
|---|---|---|
| `gptlint` | LLM at lint time, markdown rules + GritQL pre-filter | Runtime LLM, не генерация ESLint правил |
| `eslint-plugin-llm-core` | 20 hardcoded ESLint правил под AI-mistakes | Frozen snapshot, как наш текущий пакет |
| `Factory-AI/eslint-plugin` | Custom linters от Factory AI | Manual rules, не stack-aware |
| `ai-rulesmith` | Композиция markdown rules для агентов + judge-model test feature | Целит в `CLAUDE.md`/agents, не code lint. Но **judge-model = наш two-AI review pattern** |

**Наша ниша:** generated ESLint rules + stack-aware research + self-validation (рекурсия принципов). Не занята.

### 3.4 Технологические находки 2026

**Constrained generation (Anthropic GA early 2026, OpenAI/Google с 2024):**
- Native structured output через JSON Schema → FSM → невозможно сгенерировать невалидный manifest
- XGrammar < 40us/token overhead
- Это **снимает** Schema check как один из 6 gate'ов Layer 4 — переводится на этап **генерации**, не валидации

**Planner-Executor pattern (OWASP/Cisco/PCFI 2026):**
- **Must-have архитектура** для защиты от indirect prompt injection через docs
- L2 Research = **Planner**: видит untrusted docs, **не имеет file write**, выдаёт structured plan
- L3 Synthesizer = **Executor**: имеет file write, потребляет **только structured output** L2

**Mutation testing scope:**
- Stryker мутирует AST через Babel → работает только для Path B (генерация AST правил)
- Для Path A (configuration only — `{ "rule": "no-restricted-imports", "options": [...] }`) нечего мутировать
- Path A нужен **другой gate**: corpus test через канонические positive/negative фрагменты

### 3.5 Next.js 15 → 16 — реальные breaking changes

> **Source-of-truth:** [`vercel/next.js v16.2.2 docs/01-app/02-guides/upgrading/version-16.mdx`](https://github.com/vercel/next.js/blob/v16.2.2/docs/01-app/02-guides/upgrading/version-16.mdx) (verified 2026-05-08 via context7 MCP `/vercel/next.js/v16.2.2` × 4 phrasings, see [phase-8-research.md §2](phase-8-research.md)).
>
> **Snapshot history:** v0.1.x carried 7 items (Pages Router, async params, middleware→proxy, Turbopack default, Babel removed, AMP, image-deprecation). Phase 8 entry research found 15 items in `version-16.mdx`; below is the full categorized list. **Recipe-relevant = 13/15** (runtime-only items flagged).

**Structural (3, all recipe-relevant):**
- `middleware.ts` → `proxy.ts` (export rename, default `nodejs` runtime; edge users may keep `middleware.ts`)
- `skipMiddlewareUrlNormalize` config option → `skipProxyUrlNormalize`
- Pages Router fully removed (`pages/` directory is now a migration blocker on Next 16)

**API (5; 4 recipe-relevant, 1 runtime-only):**
- Sync access to `cookies()`/`headers()`/`draftMode()` — fully removed (await required)
- Sync access to `params`/`searchParams` in pages, layouts, route handlers — fully removed (await/`React.use()` required)
- `unstable_cacheLife` / `unstable_cacheTag` graduated to stable APIs
- `PageProps<'/path/[id]'>` codegen — requires `npx next typegen` after install
- Server Actions default response cache → `default-no-store` (runtime behavior; **not** source-rule)

**Deprecations (2, both recipe-relevant):**
- `next/legacy/image` `objectFit` / `objectPosition` props removed — replace with `style`
- AMP support fully removed (`useAmp`, `amp` config field, page-level `export const config = { amp }`)

**Config (3, all recipe-relevant):**
- `eslint` option in `next.config.js` removed — wire ESLint via direct `eslint.config.*` instead
- `experimental.turbopack` → top-level `turbopack` (graduated; Turbopack default for `next dev`)
- `experimental.swcMinify` + assorted experimental flags graduated or removed

**Runtime (3; 2 recipe-relevant as engine guards, 1 runtime-only):**
- Node 18 dropped — minimum `20.9.0` (engine guard recipe candidate)
- TypeScript minimum `5.1.0` (engine guard recipe candidate)
- Browser support tightened: Chrome/Edge/Firefox 111+, Safari 16.4+ (runtime — **not** source-rule)

**Implication for thesis «preset устаревает».** Empirically validated: 15 breaking changes in one major version, 13 of them require recipe authoring or update. Stop-rule status: snapshot drift is a **planned refresh** task (Task 8.1, this commit), not a Phase 8 REVISE trigger.

---

## 4. Архитектура (краткая, детали в PROPOSAL.md §2)

```text
[invariant core: принципы] + [detected stack] + [research] → [generated rules-as-tests]
                                                                  ↑
                                  [self-validation by core principles]
```

6 слоёв: L0 Invariant Core, L1 Stack Detector, L2 Research Agent (Planner), L3 Rule Synthesizer (Executor), L4 Self-Validator, L5 Installer.

---

## 5. Стандартный retrospective gate (применяется после каждой фазы)

После закрытия любой фазы — `docs/meta-factory/retros/phase-N.md` со следующей структурой.

### Verification block (≤200 строк)

- Перечень executable команд с expected output
- Скриншот / лог зелёного CI
- Diff состояний `git log --oneline phase-start..phase-end`
- Если фаза вводит invariant — invariant зафиксирован как тест

### Self-reflection block

- Какие assumptions проверились → что узнали в результате
- Какие assumptions опровергнулись → что обновляется в PROPOSAL.md
- Какие unknown unknowns обнаружились → что добавить в §13 PROPOSAL
- Был ли соблазн что-то «сделать на потом» (`// TODO`, `audit:exempt`, `--skip`) → задокументировать с rationale, иначе откатить

### Evaluation block (formalized gate)

- **Self-application score (0-10):** применился ли тезис к собственной работе. Метрика: # автоматических enforcement-правил created / # вручную проверенных
- **Time-vs-plan ratio:** фактически / запланировано. >2x → root cause analysis обязателен (формат RCA section ниже)
- **New risks identified:** добавление в §11 PROPOSAL
- **Verdict:** **GO** (следующая фаза), **REVISE** (правки текущей до GO), **STOP** (план больше не валиден, новая итерация целиком)

> **Numerical thresholds caveat (m2 finding 2026-05-07):** все числовые пороги в плане (`≥80%`, `≤5%`, `≤15%`, `≤$5`, `≥30%`, `>3 update в неделю`) — **initial guesses**. На первом retrospective где порог релевантен — обязательно зафиксировать rationale и при необходимости adjust с записью в retro.

### RCA section format (применяется при Time-vs-plan >2x или сработавшем stop-rule из §8)

5 пунктов в `retros/phase-N.md`, отдельная секция `## Root cause analysis`:

1. **Failed assumption:** какое предположение из плана оказалось неверным
2. **Surprise:** что обнаружилось чего не ожидали (unknown unknown → known unknown)
3. **What we learned:** generalizable insight, переносимый на следующие фазы
4. **Scope change:** что добавилось / убралось из плана; обновлён ли §6 / §8 / §11 PROPOSAL
5. **Next probe:** что проверить первым в следующей фазе чтобы не повторить ошибку

Без всех 5 пунктов — RCA считается неполным, verdict не может быть **GO**.

`phase-N.md` коммитится **перед** началом следующей фазы. Это гарантирует, что retrospective — артефакт, а не привычка.

---

## 5.5 Phase entry gate (added 2026-05-08 — context7-first research)

> **Trigger:** перед началом любой Phase, до драфта `PHASE-N-PROMPT.md`.
> **Origin:** 2026-05-08 AIF comparison обнаружил 6 areas of overlap c готовыми решениями; до этого roadmap содержал ~30-40% reinvented capability.

**Step 0 «Existing solutions research»** — обязательный gate перед implementation планированием:

1. **List capability areas** Phase покроет (3-7 distinct capabilities)
2. **Step 1.5 — Consult prior-art-evaluations.md** (mandatory, gating). Для каждой capability area из Step 1 — проверить [prior-art-evaluations.md](prior-art-evaluations.md) SSOT на совпадения с «Capability matched». Если найдено: (a) обновить «Last reviewed» date в entry в том же commit'е что и phase research; (b) включить candidate в Step 5 matrix с current verdict + rationale; (c) если verdict = `DEFER` / `WATCHLIST` — explicit re-evaluation note в matrix: «still applies» / «trigger condition fires now» / «new evidence». Если совпадений нет — продолжать к Step 2 Resolve candidates; новый candidate, обнаруженный там, добавляется в SSOT в том же commit'е что и phase research (per [prior-art-evaluations.md §3](prior-art-evaluations.md)). **Acceptance:** phase-N-research.md cites all matched prior-art entries by ID format `[prior-art-evaluations.md#N]`; «Last reviewed» dates touched in same commit (verified via `git log -p` в phase retro). Numbering note: this step keeps the «1.5» label per [Phase 8.8 prompt T6](retros/phase-8.8.md) intent — inserted between «List capability areas» and «Resolve candidates»; the renumbered Resolve / Specific queries / Build matrix / Go-no-go items below were items 2-5 pre-Phase-8.8 and are now 3-6 to make room.
3. **Resolve candidates** через `mcp__context7__resolve-library-id` для каждой capability — AIF + 2-4 top alternatives в той же домене
4. **Specific queries** через `mcp__context7__query-docs` по target functionality (не general terms; itera 3 phrasings минимум если результат пустой)
5. **Build matrix** `{capability} × {existing solution} × {convergent design}` — записывается в `docs/meta-factory/phase-N-research.md` (transient artifact, ≤200 строк); matrix references prior-art entries from Step 1.5 by ID
6. **Go/no-go per capability:** для каждой — explicit rationale «build vs reuse» с цитатой из context7 result + reference к prior-art-evaluations.md entry если applicable

**Hard constraints:**
- **No git clone / gh api** для external libraries — только context7 (per memory rule установленному 2026-05-08).
- Если context7 не имеет library ID — flag «not in context7» в matrix, fallback к local clone только как last resort с explicit оговоркой.
- **Output verifiable** — каждый claim в matrix через context7 query, не trust-by-narration.

**Acceptance:** matrix complete + go/no-go decisions per capability + ≥1 reuse decision (если все 3-7 capabilities = «build», это red flag — high probability of reinvention).

**Phase 0.5 — 2** этому gate'у не предшествовали (предшествуют сейчас retrofit в `aif-comparison.md`). Применяется начиная с Phase 3 retrofit + Phase 4-9.

**Phase 3 retrofit status (2026-05-08):** Step 0 retroactively conducted — see [phase-3-research.md](phase-3-research.md) (matrix + decisions) и [PHASE-3-PROMPT-v0.2.0.md](PHASE-3-PROMPT-v0.2.0.md) (delta prompt). Verdict: **KEEP merged Phase 3 as-is** — все 5 capability reuse decisions validated ex-post; нет capability change worth revert+redo cost. Forward Step 0 triggers documented для Phase 4 (entry), Phase 8 (Changesets adoption), Phase 9+ (pnpm/Nx/Turbo re-evaluation thresholds).

> **Phase 4-9 caveat (2026-05-08):** descriptions ниже написаны до AIF analysis 2026-05-08. После решения «plug-in для AIF» (PROPOSAL §1.4) — significant reuse expected: ~30-40% capability через AIF skills. Конкретные reuse decisions per Phase **обязаны** проходить Step 0 gate (см. §5.5) до драфта phase prompt. См. [aif-comparison.md §9 reuse matrix](aif-comparison.md). Текущие Phase descriptions — upper-bound build estimates; реальный scope сужается на Phase entry.

---

## 6. План фаз с retrospective gates

> **Parallelism note (M3 finding 2026-05-07):** Phase 2 (principles meta-tests) и Phase 4 (Stack Detector v1) технически могут стартовать параллельно с Phase 3 (monorepo split): Phase 2 пишет тесты в `tests/principles/` независимо от структуры пакетов; Phase 4 дорабатывает уже-работающий `setup.sh:82-97` + `scripts/detect-applicable-rules.ts` in-place. Phase 3 split лишь определяет финальный shape куда переезжают артефакты. Решение «делать ли параллельно» — **на Phase 1 retrospective** по реальной cognitive-load оценке, не сейчас. Cumulative timeline в §8 оставлен консервативным как upper bound; sequential execution = baseline, parallelism = potential win при подтверждении на Phase 1 retro.

> **Phase 5/6/7 reordering note (2026-05-08, post-Phase-6 close):** boundaries reassigned during burn-mode session, single coherent edit covering Phase 5 + Phase 6 retros:
>
> - **Original (v0.1.x):** Phase 5 = L4 Validator, Phase 6 = L2 Research Agent, Phase 7 = L3 Synthesizer + L5 Installer.
> - **Current (v0.1.3+):** **Phase 5 = L2 Research Agent** (closed, see [retros/phase-5.md](retros/phase-5.md)) → **Phase 6 = L3 Synthesizer Path A only** (closed, see [retros/phase-6.md](retros/phase-6.md)) → **Phase 7 = L4 Validator + L5 Installer** (closed 2026-05-08, see [retros/phase-7.md](retros/phase-7.md)) → **Phase 8 = Acceptance Next 15 → 16 + canonical regen ≤5%** (next).
>
> Rationale: linear data flow `0 → 1 → 2 → 3 → 4 → 5` per [architecture.md §2.1](architecture.md). L4 Validator gates synthesized output — without L2 + L3 there is nothing beyond Phase 2 manifest meta-tests for L4 to validate; running L4 first was inverted from data flow. L5 Installer needs L3 output to install. The Phase descriptions below retain their original headings («Phase 5 — Layer 4 Validator…», etc.) for diff hygiene; **read via the mapping above**, not the headings. Cumulative timeline in §8 unchanged in calendar terms; reordering does not affect total budget.

### §6.0 v1 deterministic stance (locked Phase 4-7)

> **Date:** 2026-05-08 (Phase 7 close).
> **Scope:** durable, all 5 layers L1-L5 (stop-rules apply to every `packages/*` workspace's `package.json`, not only the L1-L5 architectural code paths). Supersedes the v1+v2 unified phrasing in §6 Phase 5/6/7 descriptions below (Phase 4-9 caveat in §5.5 already flags this drift).
> **Origin:** four retros (Phase 4/5/6/7) converged on the same architectural decision — ship deterministic-curated v1, defer LLM extension as a strict-superset v2 trigger.

**What shipped deterministic in v1:**

- **L1 Stack Detector** (Phase 4 closed) — file-based detection over `package.json` + lockfile + configs; hand-authored bundle catalog. No LLM. See [retros/phase-4.md](retros/phase-4.md).
- **L2 Research Agent** (Phase 5 closed) — curated `packages/core/research/store/` JSON entries; `loadResearchPlan` + symbolic drift detection over the 3 canonical sources. No context7 / WebSearch at runtime. See [retros/phase-5.md](retros/phase-5.md).
- **L3 Rule Synthesizer** (Phase 6 closed) — Path A only, hand-authored recipes (`packages/core/synthesizer/recipes/*.json`); `synthesize(plan)` is a pure JSON-to-SynthesisPlan transform. No LLM «picks from menu» yet. See [retros/phase-6.md](retros/phase-6.md).
- **L4 Self-Validator** (Phase 7 closed) — gates 1, 2, 4, 6 REQUIRED; gate 3 (mutation) skipped (Path B only); gate 5 (two-AI review) deferred. Pure `validate(plan) → ValidationReport`, no LLM. See [retros/phase-7.md](retros/phase-7.md).
- **L5 Installer** (Phase 7 closed) — artifact write + `rules-lock.json` + post-validate. No npm deps install / husky / GHA generation in v1. See [retros/phase-7.md](retros/phase-7.md).

**What shipped beyond v1 (статус-аудит 2026-06-29, источник `origin/staging`):**

- **L1 Stack Detector** — авто-детект из `package.json` (`_detect_stack_from_pkg`, node-free) на свежем install (PR #780/#790); **4 стека**: ts-server / react-next / react-spa / react-native (пресеты `packages/preset-react-spa/`, `packages/preset-react-native/`, #646 Stage 1); per-workspace детект для multi-stack монорепо (#793). Остаётся file-based + детерминированным, без LLM.
- **L2 Research** — больше не только курируемый JSON: live web_search research (port+adapter+provenance-gate, $0-CI, #686) + live-research как дефолт доставки правил augment-first для react-next (#805/#811/#812/#824, 2026-06-29).
- **L3 Synthesizer** — за пределами Path-A: recipe-less генерация (`generate.ts` + Anthropic-адаптер), декларативный ярус (`compile-declarative-md.ts`), live menu-pick, мутационная проверка сгенерированных правил (`run-generated-rule-mutation`).
- **L4 Validator** — `packages/core/validator/` с гейтами tautology / single-token-diff (минимальная пара) / autofix-clean / message-id-coverage / rule-tester / require-vacuity / conflict / schema, у 6 из 8 — adversarial-тест (conflict/schema — обычный `.test.ts`). 31 принцип-тест.
- **L5 Installer** — install-self-verification (заборы срабатывают, сгенерированные тесты не пустые, PR #823, closes #810); `--yes/--full` + авто-детект (T2b закрыт, #780); пре-компиляция ESLint-правил в `.mjs`+`.d.ts` (снят краш Node 22, `enforcement-liveness-fix` DONE #745/#752); модульный `setup.d/` (05–99).

**Hard stop-rules from retros (all 4 held through Phase 7):**

1. **NO LLM at runtime in v1** — zero Anthropic SDK / OpenAI / context7 calls in any of L1-L5 hot paths. Research store is curated on disk.
2. **NO new explicit deps** — only transitive ones (ESLint, TS-ESLint parser, preset plugin); `package.json` diffs are bin entries + scripts + exports.

   > **Supersede 2026-05-09 (goal-hierarchy fix).** Under the user-value goal as restated in [README.md#why-this-exists](../../README.md#why-this-exists), the trigger changes from absolute «no new deps» to evaluative: *does the hand-rolled version create friction for users vs. a widely-adopted, well-maintained alternative?* If yes — adopt with `Prior-art:` trailer + SSOT entry update. If no — keep hand-rolled. Original absolute rule retained above as historical record per AWS ADR practice; new evaluative trigger applies forward.
   >
   > **No automatic unblock.** Existing [prior-art-evaluations.md](prior-art-evaluations.md) WATCHLIST/DEFER entries (#1 Autogrep, #2 Netlify CLI, #4 Factory ESLint Plugin, #5 Anthropic web_search) carry forward their existing primary blockers — the supersede unblocks NONE automatically. Each needs separate re-evaluation under the new trigger; Phase 9.x retro is the natural cadence.
3. **NO yargs/commander** — CLIs use `process.argv` parsing (≤60 LOC each).
4. **NO Path B AST gen** — Phase 9+ trigger; Path A only through Phase 8.

**v2-trigger areas (5, all `OPEN, v2 trigger` per [open-questions.md §13.10](open-questions.md)):**

| # | v2 area | Layer | Trigger condition (authoritative source: §13.10) |
|---|---|---|---|
| 1 | LLM-driven research extension (context7 MCP + Anthropic `web_search_20250305` with allowed_domains) | L2 | First real consumer reports a research gap on a non-curated framework |
| 2 | Path A LLM gen («picks from menu») | L3 | Phase 8 acceptance test passes deterministic; Phase 9 entry research |
| 3 | Path B AST gen | L3 | Phase 9+; new pattern with no existing ESLint plugin |
| 4 | Gate 5 (two-AI review via AIF `review-sidecar` `model: opus`) | L4 | Phase 8 cost-scope decision (per-rule vs per-plan; advisory vs blocking) |
| 5 | Gate 3 (mutation testing via Stryker) | L4 | Path B activation (gate 3 only mutates AST; nothing to mutate in Path A) |

§13.10 is the SSOT for trigger conditions; this list shows names + layer mapping only. v2 areas are **strict supersets** over v1 — v2 activation does not invalidate v1 contracts.

**Cross-references:** [architecture.md §2.4-§2.7](architecture.md), [retros/phase-4.md](retros/phase-4.md), [retros/phase-5.md](retros/phase-5.md), [retros/phase-6.md](retros/phase-6.md), [retros/phase-7.md](retros/phase-7.md), [aif-comparison.md §4](aif-comparison.md), [open-questions.md §13.10](open-questions.md).

---

### Phase 0.5 — Documentation alignment (1-2 дня)

**Задача:** зафиксировать новое понимание в PROPOSAL.md и создать reference-документ.

**Артефакты:**
1. `docs/meta-factory/self-application.md` — invariant table по слоям + decision matrix (раздел 7 ниже) + почему первичнее остальных. Размер: ≤500 строк (соблюдаем собственный invariant — этот документ shipped reference, не transient).
2. `PROPOSAL.md` — три точечные правки:
   - §17 «Self-application as architectural invariant» — **short pointer** (≤15 строк): один абзац с тезисом + invariant table из 7 строк (по слою) + ссылка на `docs/meta-factory/self-application.md` за полным rationale. **Полный контент НЕ дублируется в PROPOSAL.md** (M1 finding 2026-05-07: PROPOSAL.md = 709 строк уже превышает invariant ≤500; добавление полного §17 ухудшает violation).
   - §6 rewrite (acceptance test = invariant с момента 0)
   - §10 Phase 0.5 insert
3. `docs/meta-factory/retros/phase-0-5.md` (на закрытии)

**Acceptance:** fresh-session reader понимает self-application как cross-cutting invariant.

**Verification:**
```bash
wc -l docs/meta-factory/self-application.md          # ≤500
grep -c "Self-application" PROPOSAL.md                # ≥3 (§17 + §6 + §10)
grep "self-application.md" PROPOSAL.md                # cross-reference exists
```
Плюс: fresh-session test — дать новой сессии Claude prompt «summarize architectural invariants from PROPOSAL.md», проверить что в ответе self-application как invariant.

**Self-reflection:**
- Сравнить v0.1.0-draft PROPOSAL → v0.2.0-draft. Diff должен быть **смена приоритета**, не патч
- Что не получилось зафиксировать — в §13 PROPOSAL как открытый вопрос
- Перепроверить: есть ли ещё архитектурные invariants, которые я пропустил?

**Evaluation:**
- Self-application score: 2/10 (документация, тут self-application проявляется только через executable verification)
- Time-vs-plan: 1-2 дня; если >3 → разобраться
- Verdict gate: **GO** только если fresh-session test прошёл

---

### Phase 1 — Self-application gap closure (3-5 дней)

Три batch'а по приоритету.

#### Batch 1.A — Local enforcement (MUST, 1 день)

**Артефакты:** `.husky/pre-commit`, `.husky/pre-push`, `Makefile`, `CONTRIBUTING.md`, root `package.json` если нужен для husky.

**Scope expansion (added 2026-05-07 per PROPOSAL.md §13.9 — `--no-verify` mitigation):** новый job `enforce-husky-presence` в `.github/workflows/audit-self.yml`:
- Проверяет существование `.husky/pre-commit` и `.husky/pre-push` в коммитимом репо (`test -f` + `test -x`)
- Содержимое hooks не пустое и не начинается с `exit 0`
- CI fail при отсутствии setup'а — превращает локальный `--no-verify` bypass из invisible в visible breach
- ~10 строк YAML, no external dependencies

**Содержание `.husky/pre-commit`:**
- Из `templates/shared/husky-pre-commit.sh` + extended mechanical probes из `audit-self.yml`:
  - bash syntax (scoped к `git diff --cached -- '*.sh'`)
  - JSON validity (`*.json`)
  - YAML validity (`*.yml`, `*.yaml`)
  - Markdown ≤600 строк (`*.md`)
- Цель: <5 секунд

**Содержание `.husky/pre-push`:**
- Из `templates/shared/husky-pre-push.sh` + добавить:
  - `actionlint .github/workflows/*.yml`
  - `pip install zizmor && zizmor --format plain .github/workflows/`
  - `bash tests/audit/audit-ai-docs.test.sh`
  - `npx tsx scripts/render-rules.ts --check`
- Цель: ≤30 секунд

**Содержание `Makefile`:**
```makefile
self-audit: pre-commit-check pre-push-check
pre-commit-check:
	@.husky/pre-commit
pre-push-check:
	@.husky/pre-push
install-hooks:
	@npx husky install
```

**Verification:**
```bash
make self-audit                               # green на чистом HEAD
git checkout -b test/broken-hook
echo "broken bash" > scripts/test.sh
git add . && git commit -m "test"             # должно блокироваться pre-commit
git checkout main && git branch -D test/broken-hook
```

**Self-reflection:**
- Совпадает ли `.husky/pre-commit` с template? Расхождение = template неполон → доработать template
- Какие probes на pre-push, не pre-commit? Соответствует ли cost-budget'у?

**Evaluation:**
- Self-application score: 7/10 (применён, но без CI gate, проверяющего наличие `.husky/`)
- Time-vs-plan: 1 день
- Risk: bypass через `--no-verify` — нужен ли отдельный CI gate?

#### Batch 1.B — Framework-self-install (SHOULD, 1-2 дня)

**Артефакты:** новые jobs `framework-self-install-ts-server` и `framework-self-install-react-next` в `audit-self.yml`.

**Содержание job'а:**
```yaml
framework-self-install-ts-server:
  runs-on: ubuntu-latest
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@<sha>  # actual pinned
      with:
        persist-credentials: false
    - name: Self-install on tmp consumer
      run: |
        mkdir -p /tmp/fake-consumer && cd /tmp/fake-consumer
        git init && echo '{"name":"fake","version":"0.0.0"}' > package.json
        bash $GITHUB_WORKSPACE/install.sh ts-server
        bash $GITHUB_WORKSPACE/setup.sh ts-server || echo "setup smoke"
        bash $GITHUB_WORKSPACE/scripts/audit-ai-docs.sh
```

**Verification:**
```bash
git checkout -b test/break-install
sed -i '' 's|copy_safe.*ARCHITECTURE|# DELETED|' install.sh
git add . && git commit && git push
gh run watch                                  # должно стать red
git checkout main && git branch -D test/break-install
```

**Self-reflection:**
- Длительность job'а — приемлема? (>2 мин = обсудить)
- React-next path требует storybook init — проверяется ли это?
- Edge cases на tmp-dir (нет git, нет package.json) — handled?

**Evaluation:**
- Self-application score: 8/10
- Risk: tmp-dir может скрыть real-world problems → fixture-based testing с подготовленными скелетами

#### Batch 1.C — Spec discipline (MAY, 1 день)

**Артефакты:** `scripts/validate-batch-spec.ts`, integration в pre-commit (soft warn) + pre-push (hard fail).

**Логика валидации:**
- Для `.claude/orchestrator-prompts/**/*.md`:
  - grep по паттерну `<owner>/<repo>@<40-char-sha>`
  - `gh api repos/<owner>/<repo>/contents/action.yml?ref=<sha>` — HTTP 200 = действующий action
  - `gh api repos/<owner>/<repo>/git/refs/tags/<comment-version>` — резолвится в тот же SHA
  - exit 0 если всё ОК

**Verification:**
```bash
echo 'rhysd/actionlint@4dde6cc9404f24f0930a25e9d34fc5a4ea22e0eb # v1.7.12' \
  >> .claude/orchestrator-prompts/test-spec.md
git add . && git commit -m "test"
git push origin HEAD                          # blocked on pre-push
git reset HEAD~1 --hard
```

**Self-reflection:**
- Root cause фейкового SHA в batch-D.md? Не было tooling'а / привычки / context-switch?
- (m3 finding 2026-05-07 — split в два probe'а)
  - **Probe 1 (SHA validation):** применима ли spec validation к **GitHub action references** (`owner/repo@SHA`) в других местах кроме `.claude/orchestrator-prompts/`? Например, в `.github/workflows/*.yml` или в `INSTALL-FOR-AI.md`? Что ещё можно валидировать через `gh api`?
  - **Probe 2 (intra-skill paths):** применима ли валидация **relative file paths** в SKILL.md (`references/X.md` → `test -f $skill_dir/references/X.md`)? Это другой механизм (file existence, не gh api), но та же категория «spec discipline». Стоит ли добавить probe в pre-commit?
- gh api rate-limit budget?

**Evaluation:**
- Self-application score: 9/10
- Risk: gh api зависит от auth token — fallback для контрибьюторов без `gh auth login`?

> **2026-05-10 reconciliation note:** Phase 1.C was implemented in [`.husky/pre-push`](../../.husky/pre-push) §6 block, BUT `.claude/orchestrator-prompts/` was subsequently gitignored (rationale: operator-side prompts hold session-specific context not for upstream). This makes the hook block dormant on the main path — fires only as defensive guard for force-added files past gitignore. Discipline mechanism formally exists but is structurally bypassed. Tracked as [closed-questions §13.28](closed-questions.md) with default closure path: non-git `make validate-prompts` target (advisory). Surface as Phase 11+ work after Wave 5 + Wave 6 close.

#### Phase 1 итоговая retrospective

Composite retro в `docs/meta-factory/retros/phase-1.md`. Главное: **появился ли local enforcement, который перехватывает классы ошибок из self-application gap document'а**? Если хоть один класс не покрыт — fix перед Phase 2.

**Verdict gate:** **GO** к Phase 2 только если все 3 batch'а зелёные одновременно.

---

### Phase 2 — Principles as meta-tests (1 неделя)

**Задача:** извлечь принципы из `skills/rules-as-tests/references/{overview,ai-traps,self-testing-docs}.md`, формализовать каждый как исполнимый тест против `factory/rules-manifest.json`.

**Артефакты:**
1. `tests/principles/*.test.ts` — по одному на принцип
2. `docs/meta-factory/principles-as-tests.md` — каталог: принцип → тест → ожидаемое состояние → known exceptions
3. Интеграция в `make self-audit`, pre-push, `audit-self.yml`

**Список принципов (стартовый, расширится):**
- Every rule has executable check (или явный rationale для manual)
- Paired negative test для каждого `eslint`-правила
- AST > grep (TSESTree, не raw regex)
- No tautology (фиксированный negative-корпус: empty file, comment-only, unrelated AST)
- Manifest = SSOT (каждое правило в manifest имеет соответствие в RULES.md и в audit script)
- MUST не демотируется до should (policy без «should», «consider», «recommended»)
- Documents lie (examples bad/good исполнимы)

**Verification:**
```bash
npm run test:principles                       # все meta-tests green
grep -c "^- " docs/meta-factory/principles-as-tests.md  # ≥7 принципов
git log --grep "principle:" --oneline         # каждый meta-test = atomic коммит
```
Mutation-style проверка meta-tests: сломать одно правило в manifest, проверить что соответствующий meta-test падает. Если не падает — meta-test тавтологичен.

**Self-reflection:**
- Сколько правил R1-R20 + IR1-IR6 не прошли все meta-tests? Эмпирическая классификация для §13.3
- Какие принципы не удалось формализовать? → known limitations с rationale
- Новые принципы из чтения references, которых не было в стартовом списке?
- Diff стартового списка vs финального — почему?

**Evaluation:**
- Self-application score: 10/10 (apex рекурсии тезиса)
- Time-vs-plan: 1 неделя
- §13.3 closure: эмпирически закрыт; обновление PROPOSAL §13.3
- Verdict gate: **GO** только если ≥80% правил проходят все meta-tests, OR оставшиеся ≤20% классифицированы с rationale

---

### Phase 3 — Monorepo split (1-2 недели)

**Задача:** §9 PROPOSAL — split на `packages/core/`, `packages/preset-next-15-canonical/`, `packages/meta-factory/` (skeleton).

**Артефакты:** workspace root, три пакета, обновлённый `install.sh`.

**Verification:**
```bash
npm install                                   # workspace install
make self-audit                               # green из workspace root
cd packages/core && npm test                  # principles meta-tests green standalone
cd ../preset-next-15-canonical && npm test    # 7 ESLint rules green
cd ../meta-factory && npm run typecheck        # skeleton compiles
```
Симуляция npm publish:
```bash
cd packages/core && npm pack
cd /tmp/fake-consumer && npm install /path/to/core-*.tgz
```

**Self-reflection:**
- Сложно классифицируемые файлы (между core и preset) — кандидаты на hybrid категорию §13.3
- Circular deps между пакетами = §13.3 неправильно решён, пересмотреть
- Размер `packages/core/` — близок к предыдущему пакету = split не дал ничего; ≤30% = корректно
- Diff с заявленной структурой PROPOSAL §9.2

**Evaluation:**
- Self-application score: 7/10 (split вручную, но **результат** проверяется meta-tests Phase 2)
- Risk: workspace tooling выбрать раз навсегда (npm workspaces vs pnpm vs yarn)
- Verdict gate: **GO** к Phase 4 только если все три пакета проходят meta-tests Phase 2 standalone

---

### Phase 4 — Layer 1 Stack Detector v1 (1 неделя)

**Задача:** извлечь логику из `setup.sh:82-97` + `scripts/detect-applicable-rules.ts` в `packages/core/detector/`. Добавить version-aware детектирование (Next 15 vs 16, React 18 vs 19).

**Self-application clause:** detector прогоняется на root репо в CI; expected output фиксируется в snapshot.

**Verification:**
```bash
cd packages/core && npm run detect             # output JSON: stack info этого репо
cd /tmp/fake-next-16 && npm install next@16 && npm run detect  # детектит next@16
```
Snapshot test в CI.

**Self-reflection:**
- Какие признаки package.json не дали однозначной классификации? → edge cases для §13.5 multi-stack
- Version-aware logic vs simple semver match — оправдана сложность?
- Confidence score (high/medium/low) — consistent с §8 PROPOSAL?

**Evaluation:**
- Self-application score: 8/10
- Risk: snapshot fragility — каждое изменение в template package.json triggers update
- Verdict gate: **GO** к Phase 5 если snapshot стабилен через ≥3 недели

---

### Phase 5 — Layer 4 Validator beyond meta-tests (2-3 недели)

**Задача:** расширить Phase 2 принципы на gates из §2.6 PROPOSAL.

**Self-application clause:** validator прогоняется на собственном manifest'е перед каждым CI run.

**Gates:**
- Schema check → constrained generation (Anthropic GA), невалидный manifest не парсится
- rule-tester прогон → understood (наш текущий паттерн)
- Mutation на правилах → **только Path B** (отложено до Phase 9)
- Tautology check → fixed negative-корпус (определён в Phase 2)
- Two-AI review → AIF `review-sidecar` с `model: opus` override (anti-bias convention поверх AIF infrastructure); дорогая верификация, только после merge, не блокирует
- Cross-rule conflict → fixture с заведомо конфликтующими правилами

**Self-reflection:**
- False positive rate gates? >50% = удалить, не cargo cult
- Two-AI review cost per PR в долларах. >$1 = budget cap или soft warn
- Constrained generation работает на актуальных моделях? Fallback?

**Evaluation:**
- Self-application score: 10/10 (validator валидирует свою же конфигурацию)
- Risk: false positives блокируют PR'ы → exception механизм с rationale
- Verdict gate: **GO** если на 10+ реальных PR validator работал без false-positive блокировок

---

### Phase 6 — Layer 2 Research Agent + Planner-Executor (2-3 недели)

**Задача:** L2 как Planner. context7 + WebSearch с allowlist. research-cache.json формат + diff-режим (§4 PROPOSAL).

**Critical:** Planner-Executor pattern. L2 не имеет file write, выдаёт только structured plan. L3 потребляет plan, не сырые docs.

**Self-application clause:** research прогоняется на трёх собственных источниках — `skills/rules-as-tests/SKILL.md` + `references/overview.md` + `references/ai-traps.md` → drift detection (canonical per [self-application.md](self-application.md) §2).

**Verification:**
```bash
meta-factory research --self                                                  # research собственные docs
meta-factory research --diff skills/rules-as-tests/references/overview.md@v0.1 ...@HEAD
```

**Self-reflection:**
- Утечка privilege Planner→Executor?
- Allowlist sources — насколько узкий? Расширили = почему?
- Research-cache TTL и cleanup?

**Evaluation:**
- Self-application score: 9/10
- Risk: prompt injection через docs — main vector, regular red-team testing
- Verdict gate: **GO** если red-team test (отдельный document с prompt-injection examples) — все blocked

---

### Phase 7 — Layer 3 Synthesizer Path A + Layer 5 Installer (3-4 недели)

**Self-application clause:** synthesizer regenerate'ит canonical preset, diff с live. Installer прогоняется в CI на tmp-dir (расширение Phase 1.B на packaged form).

**Verification:**
```bash
meta-factory generate --stack=next@15 --output=/tmp/regenerated-preset
diff -r packages/preset-next-15-canonical /tmp/regenerated-preset  # minimal
```

**Self-reflection:**
- Diff после регенерации canonical — большой = synthesizer плох ИЛИ canonical устарел
- Lock-файл воспроизводимый — два запуска на чистом cache, сравнение
- Stateful resume — kill процесс на середине, resume

**Evaluation:**
- Self-application score: 10/10 (synthesizer воспроизводит сам себя через canonical)
- Risk: large diff требует human review checkpoint
- Verdict gate: **GO** к Phase 8 если diff на canonical regen ≤5%

---

### Phase 8 — Acceptance Next 15 → 16 как E2E proof (1-2 недели)

**Задача:** запустить `meta-factory upgrade --from=next@15 --to=next@16`, сравнить с manual baseline. **Это и есть финальный acceptance**.

> **Phase 8.X parallel sub-phase:** self-diagnostics implementation per [self-diagnostics-design.md](self-diagnostics-design.md). **Trigger:** Phase 8 acceptance test passes (deterministic green). Scope: §2 schema, §3 path, §5 read CLI, §6 write hooks, L5 (c) invariant, CI gate `framework-self-diagnose`. Does not block Phase 9 entry.

**Verification:**
```bash
mkdir /tmp/next-16-test && cd /tmp/next-16-test
npm init -y && npm install next@16 react@19
meta-factory install --auto-detect
make self-audit                                 # должно пройти
```
Manual baseline: 1-2 дня создание `preset-next-16-manual`. Затем сравнение `manual` vs `generated`. Diff = improvement area.

**Self-reflection:**
- Что полностью правильно сгенерировал synthesizer?
- Что частично, требовало manual fix?
- Что полностью не получилось → Path A insufficient → нужна Path B?
- Стоимость одного `upgrade` в долларах + время. Готов пользователь к такой цене?

**Evaluation:**
- Self-application score: 10/10
- Risk: diff с manual >30% = мета-фабрика не работает, retry с другой архитектурой
- Verdict gate: **GO** к 1.0 release только если diff ≤15% И стоимость ≤$5 И время ≤10 минут

---

### Phase 9+ — Path B, нишевые стеки, multi-stack monorepos, AIF integration

Согласно PROPOSAL §10 Phase 10-11 + §13.5, §13.6.

**Validation-chain / multi-toolchain (2026-07-02, by reference — single-source):**
последовательность trust-tiers S1→S2→S3 (shipped 2026-07-02: #850/#852/#853) → diagnostics D1 → B → MT (Rust, `{toolchain, stack}`).
Дизайн D1+B: [../superpowers/specs/2026-07-02-diagnostics-core-design.md](../superpowers/specs/2026-07-02-diagnostics-core-design.md) (§6 binding sequencing, §9 stage B).
R-phase + architecture v0.2: [research-patches/2026-07-02-multi-toolchain-generalization.md](research-patches/2026-07-02-multi-toolchain-generalization.md) (§9 supersedes §8; §9.1 invention gaps; пробы P1-P6 до MT-kickoff).
Sequencing-домом остаётся ROADMAP «Поток MT» (planning workspace). Не гейтит MVP.

После каждой sub-фазы — тот же retrospective gate.

### Post-1.0 growth waves N0–N8 (active — tracked elsewhere by reference)

The post-build growth waves (**N0** June-15 metered-dispatch storm, **N1** niche-validation, **N2** adopt-from-companions, **N3** bash→TS core, **N4** recommendation-moment gate, **N5** give-back, **N6** coexistence + one-button, **N7** dogfood companions, **N8** deterministic-offload autonomy economy) are **active tasks**, not archived patches (decision 0.3, 2026-05-22). To avoid a second sequencing authority inside this file (drift), they are promoted **by reference**, single-source:

- **Ordering / deps / gates / launch order + verified status snapshot** → [wave-sequencing-plan.md](wave-sequencing-plan.md) (`Authoritative for` execution ordering of N0–N8; §0 holds the reconciled status — re-verify before relying).
- **Wave content / rationale** → [research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md](research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md) (N0–N7) + [research-patches/2026-05-22-deterministic-offload-autonomy-economy.md](research-patches/2026-05-22-deterministic-offload-autonomy-economy.md) (N8).
- **Single hard date:** 2026-06-15 (N0). Cost-first invariant: free research before paid build ([no-paid-llm-in-ci.md](../../.claude/rules/no-paid-llm-in-ci.md)).

---

## 7. Decision matrix для Phase 1 (отсюда выводятся artifacts)

| Layer | Mode | Failure cost | Local cost | Verdict |
|---|---|---|---|---|
| Bash syntax | Hard fail (pre-commit) | High (broken commit) | <100ms | MUST |
| YAML/JSON parse | Hard fail (pre-commit) | High | <100ms | MUST |
| Markdown ≤600 lines | Hard fail (pre-commit) | Medium | <100ms | MUST |
| actionlint | Hard fail (pre-push) | High (CI red) | ~200ms | MUST |
| zizmor plain | Hard fail (pre-push) | High (CI red) | ~3s | MUST |
| Self-test pipeline | Hard fail (pre-push) | Medium | ~5s | SHOULD |
| Manifest render drift | Hard fail (pre-push, scoped) | Medium | ~2s | SHOULD |
| Spec validation (SHAs) | Soft warn (pre-commit, scoped) | Low | ~1s per spec | MAY |
| Framework-self-install | CI only | Low (rare) | ~30s | MAY in CI |

---

## 8. Cumulative timeline и stop-rules

| Фаза | Длительность | Cumulative | Stop-rule |
|---|---|---|---|
| 0.5 docs | 1-2 дня | 2д | Fresh-session test провалился 2 раза → план неясен |
| 1 self-application | 3-5 дней | 1н | Local enforcement не закрыт за 7 дней → root cause analysis |
| 2 principles | 1 неделя | 2н | ≥30% правил R1-R20 не проходят meta-tests → принципы или правила переписать |
| 3 monorepo | 1-2 недели | 4н | Circular deps между пакетами → §13.3 неправильно решён |
| 4 detector | 1 неделя | 5н | Snapshot fragility (>3 update в неделю) → детектор over-engineered |
| 5 validator | 2-3 недели | 8н | False-positive rate >20% → gates неправильно подобраны |
| 6 research | 2-3 недели | 11н | Red-team test провалился — план security перепроработать |
| 7 synth+install | 3-4 недели | 15н | Canonical regen diff >20% → synthesizer не работает |
| 8 E2E proof | 1-2 недели | 17н | Diff с manual >30% → план мета-фабрики не работает, radical revision |
| 9+ | open | 4-6м total | — |

---

## 9. Что делать в новой сессии (entry point)

1. **Прочитать этот файл целиком** + `docs/meta-factory/PROPOSAL.md` + `docs/audits/2026-05-07-self-application-gap.md`.
2. **Выполнить fresh-review** план (см. раздел 10) — sceptic mode, не приукрашивать.
3. **Если REVISE** — записать findings в `docs/meta-factory/EXECUTION-PLAN-review-NNNN.md`, обсудить с пользователем перед стартом.
4. **Если APPROVE** — стартовать Phase 0.5 step 1: создать `docs/meta-factory/self-application.md`.
5. После каждой фазы — `docs/meta-factory/retros/phase-N.md` по стандартному формату (раздел 5).
6. Делегация junior tasks (mechanical edits, batch implementations) — через `Agent` tool с subagent_type=general-purpose, для UI и тестов — через специализированных агентов.
7. Использовать существующий `orchestrator` skill: «Старшая планирует и делегирует через Agent tool, младшие делают и сами верифицируют, старшая принимает по доказательствам.»

---

## 10. Fresh-review checklist

Перед стартом Phase 0.5 — провести critical fresh review плана. Пройтись по списку:

### 10.1 Структурные вопросы
- [ ] Цель проекта (раздел 1) — действительно ли self-application gap blocks её? Или это side-quest?
- [ ] Текущее состояние (раздел 2) — verified через ls / cat / git log? Или скопировано из памяти?
- [ ] 4 layers enforcement (раздел 3.1) — все ли действительно отсутствуют? Может что-то частично есть?
- [ ] Архитектурные invariants (раздел 3.2) — каждый ли клозеp реалистичен? Или это idealization?

### 10.2 План фаз
- [ ] Phase 0.5 — действительно ли документация first? Или это бюрократия перед делом?
- [ ] Phase 1 — Decision matrix (раздел 7) корректна? Costs реалистичны?
- [ ] Phase 2 — список 7 принципов исчерпывающий? Что упущено?
- [ ] Фазы 3-8 — зависимости правильные? Можно ли распараллелить?
- [ ] Phase 9+ — open-ended; стоит ли уточнить?

### 10.3 Verification и self-reflection
- [ ] Каждая verification команда — реально исполняема? Или псевдо-код?
- [ ] Self-reflection вопросы каждой фазы — open enough, чтобы поймать unknown unknowns?
- [ ] Evaluation thresholds (>2x time, ≥80% pass rate, etc.) — обоснованы или произвольные?

### 10.4 Risks
- [ ] Stop-rules (раздел 8) — ranges правильные? Слишком loose / strict?
- [ ] Self-application gap может всплыть на любой фазе (не только Phase 1) — план это учитывает?
- [ ] Что если Phase 1 покажет, что local enforcement сам по себе сложнее ожидаемого? Plan B?

### 10.5 Pragmatic
- [ ] Fixated ли план на architecture vs реальные пользователи? Если пользователей нет, multi-month plan justified только для proof-of-concept цели — это явно сказано?
- [ ] Бюджет API tokens (Phase 5/6/7 use LLM tools) — оценен?
- [ ] Что если Art временно недоступен — план самостоятельно advance'ится через несколько фаз? Или нужен continuous human input?

### 10.6 Self-application к самому плану
- [ ] План сам по себе self-applied? `EXECUTION-PLAN.md` ≤600 строк? (Может нарушать — sanity check)
- [ ] Verification команды плана сами проверены? Или скопированы без проверки?
- [ ] Если кто-то в Phase 5 поломает план fundament-ом — какой gate это поймает?

**Verdict:**
- **APPROVE:** план целостный, verification конкретный, stops realistic, self-reflection поможет ловить drift. Старт Phase 0.5.
- **REVISE:** обнаружен один или несколько критических промахов. Список в `EXECUTION-PLAN-review-NNNN.md`, обсудить с Art.
- **REJECT:** план структурно нерабочий (например, цель неправильно понята). Запросить переписку.

---

## 11. Что СОЗНАТЕЛЬНО оставлено за рамками плана

- **Маркетинг и naming (§13.2 PROPOSAL).** Решается на Phase 11 после релиза 1.0 — рано.
- **Multi-stack monorepos (§13.5).** Решается на Phase 9+ после single-stack успеха.
- **Legacy codebase UX (§13.4).** Adoption-критично, но не архитектурно. Phase 11.
- **AIF integration (§13.6).** Phase 11 — после стабилизации core.
  - Backlog SSOT: [aif-comparison.md §7 «Phase 11 backlog»](aif-comparison.md). 3 subtasks:
    - **11.1** — emit `aif-gate-result`-compatible JSON shape from L4 ValidationReport + L5 InstallReport.
    - **11.2** — `/aif-loop` RULE-SCHEMA convertor (JSON-to-JSON mapping `rules-manifest.json` ↔ AIF rule schema).
    - **11.3** — `docs/meta-factory/contributing-recipes.md` (external-author onboarding).
  - **Trigger condition for starting Phase 11:** Phase 8 + Phase 9 stable; first real consumer onboard. Until then — backlog only, no implementation.
  - Touchpoint 4 (`skill-context/<skill>/SKILL.md` per-skill overrides) is **closed in Phase 4** (commit `b5e16b7`, see [retros/phase-4.md](retros/phase-4.md) Reuse posture #4.6); it is not a Phase 11 subtask.
  - `/aif-verify` integration spike → Phase 8 entry research per [retros/phase-7.md](retros/phase-7.md) Open Q #5; not a Phase 11 subtask.
- **Path B (§3.2).** Phase 9+ — экспериментальный, не блокер 1.0.
- **Confidence tier UI/CLI (§8).** Логика встроена в L1 detector + L4 validator; UX-разработка — позже.

---

## 12. Sources (use в новой сессии для verification claims)

Технические:
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [GPTLint how it works](https://gptlint.dev/project/how-it-works)
- [@typescript-eslint/rule-tester](https://typescript-eslint.io/packages/rule-tester/)
- [Stryker Mutator](https://stryker-mutator.io/docs/)
- [LLM Structured Output 2026](https://collinwilkins.com/articles/structured-output)
- [OWASP LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [Prompt Control-Flow Integrity (PCFI 2026)](https://arxiv.org/html/2603.18433)

Prior art:
- [GPTLint repo](https://github.com/gptlint/gptlint)
- [Factory-AI/eslint-plugin](https://github.com/Factory-AI/eslint-plugin)
- [ai-rulesmith](https://github.com/Luzgan/ai-rulesmith)
- [eslint-plugin-llm-core / 500 AI mistakes](https://dev.to/pertrai1/i-analyzed-500-ai-coding-mistakes-and-built-an-eslint-plugin-to-catch-them-jme)
- [Custom ESLint Rules for AI Determinism](https://understandingdata.com/posts/custom-eslint-rules-determinism/)

Adoption context:
- [AI Coding Tool Adoption 2026 Survey](https://www.digitalapplied.com/blog/ai-coding-tool-adoption-2026-developer-survey)

---

## 13. Версия документа

- **0.1.0** — 2026-05-07 — первая версия плана после 7 итераций обсуждения. После каждого retrospective phase — bump minor с changelog в файле `docs/meta-factory/retros/CHANGELOG.md`.
- **0.1.1** — 2026-05-07 — закрытие 8 findings из `retros/EXECUTION-PLAN-review-2026-05-07.md`: B1 (post-merge state §2), M1 (Phase 0.5 §17 как pointer §6), M2 (line numbers через grep), M3 (Parallelism note §6), m1 (RCA format §5), m2 (thresholds caveat §5), m3 (Phase 1.C split §6), m4 (no-consumers caveat §1). Plan переехал в новую ветку `chore/self-application` от `main` (`35ab3f9`).
