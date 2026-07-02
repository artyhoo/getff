# Meta-Factory: Архитектурные слои и Path A/B

> Source: PROPOSAL.md §2 + §3 (split в Phase 1.D, 2026-05-07)
> Companion: [PROPOSAL.md](PROPOSAL.md) (overview)
>
> **Authoritative for:** 6-layer architecture description (L0 Invariant Core → L5 Installer), data flow between layers, Path A vs Path B synthesis paths, v1 deterministic stance per layer.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Phase scope and acceptance criteria — see [EXECUTION-PLAN.md](EXECUTION-PLAN.md). **Implementation status** — this doc describes the *target* layer design, not a claim that every layer is currently built; per-layer reality lives in [EXECUTION-PLAN.md](EXECUTION-PLAN.md) (status-audit 2026-06-29 / post-v1 block). External doc-synthesis tools (e.g. DeepWiki) reading L0-L5 as an operational subsystem is the misread this line exists to prevent.

---

## 2. Архитектурные слои

### 2.1 Шесть слоёв

```text
Layer 0 — Invariant Core (никогда не генерится)
Layer 1 — Stack Detector
Layer 2 — Research Agent
Layer 3 — Rule Synthesizer
Layer 4 — Self-Validator
Layer 5 — Installer
```

Поток данных: `0 → 1 → 2 → 3 → 4 → 5`. Layer 4 имеет **обратную связь** в Layer 3 (отклонённые правила возвращаются на регенерацию или в human review).

### 2.2 Layer 0 — Invariant Core

**Что внутри.** То, что никогда не генерится и определяет «настоящий пакет»:

| Компонент | Содержание | Почему invariant |
|---|---|---|
| Принципы | 5 layers framework, AST > grep, paired negative tests, mutation testing, two-AI review (via AIF `review-sidecar`; `model: opus` override — v2 trigger, не в shipped-агенте: см. v1-stance note в §2.6 / [open-questions.md §13.10 entry #4](open-questions.md)) | Это сам тезис; если генерировать — теряется опора |
| Meta-rules | «every rule has executable check», «no tautology», «documents lie», «MUST не демотируется до should» | Критерии валидности любого LLM-output |
| Workflow контракт | detect → research → synthesize → validate → install | Контракт между фазами |
| Schema manifest | JSON Schema для `rules-manifest.json` | Фиксирует формат, в который research должен попадать |
| Generic R-rules | TS hygiene (R1), async correctness (R5), errors (R6), naming (R10) — стэк-независимы | Одинаковы для Next 14/15/16, Fastify 4/5, Astro |
| Validator | rule-tester прогон, mutation testing, negative-test gate | Стоит на выходе, режет мусор |
| Audit-self CI | Проверка пакета своими же принципами | Без этого «принципы» — пустые слова |

**Граница invariant ↔ generated.** Каждый компонент инварианта покрыт **тестами на сам инвариант**: при любом изменении core эти тесты прогоняются и проверяют, что:
- Schema manifest не сломана
- Validator не пропускает заведомо плохие правила (positive test)
- Validator не отвергает заведомо хорошие правила (negative test)
- Generic R-rules компилируются и проходят rule-tester

См. [acceptance-tests.md](acceptance-tests.md) §6.3 «Acceptance test для самого core».

### 2.3 Layer 1 — Stack Detector

**Что делает.** Парсит `package.json`, lock-файлы, конфиги, структуру каталогов. Возвращает structured `stack.json`:

```json
{
  "framework": { "name": "next", "version": "16.2.1", "router": "app" },
  "runtime": { "name": "node", "version": "20.18.0" },
  "language": { "name": "typescript", "version": "5.7.2" },
  "patterns": ["server-actions", "rsc", "form-data", "use-cache"],
  "structure": {
    "kind": "monolith-app",
    "src-layout": "app-router",
    "test-runner": "vitest"
  },
  "missing": ["opentelemetry", "playwright", "storybook"]
}
```

> **v1.1 subset note (2026-05-08):** Detector ships `{stack, framework, runtime, confidence, severity, weight, source, rules, missing, patterns}` per Bundle 4-partial-extended (Phase 5 entry). Fields `language`, `structure`, `router` are v2 backlog. Authoritative current contract: `packages/core/detector/types.ts`. Layer 2 (Research Agent) consumes `missing` + `patterns`.

**Что НЕ делает.** Не принимает решений о правилах. Только наблюдение, факты, без интерпретации.

### 2.4 Layer 2 — Research Agent

**Что делает.** Для каждого detected паттерна:
1. Идёт в `context7` MCP за официальной документацией (allowlist).
2. WebSearch с allowlist (nextjs.org, react.dev, vercel.com/docs, MDN, official changelogs).
3. Извлекает best practices + anti-patterns.
4. Структурирует в `research-cache.json` под версию.

**Granularity (см. ответ на вопрос 1).** Двойная: **и** на уровне фреймворка целиком («Next 16.2 patterns»), **и** на уровне отдельных фич («Server Actions return type pattern в Next 16.2»). При генерации правил учитываются их взаимодействия — например, Turbopack default в 16 влияет на то, как Stryker должен мутировать.

**Diff-режим (см. ответ на вопрос 2).** При апгрейде версии (Next 15 → 16):
1. Берётся существующий `rules-lock.json` для Next 15.
2. Research даёт **только дельту**: что изменилось между 15 и 16 в best practices.
3. Synthesizer актуализирует правила точечно, не переписывая всё.
4. Diff показывается человеку на review.

Это решает «не переписываем заново, только актуализируем».

**Защита от prompt injection.** Жёсткий allowlist источников. WebSearch без allowlist для best practices — запрещён. Только официальные docs.

> **v1 deterministic stance (2026-05-08):** Research Agent ships **deterministic-curated** in Phase 5 (`packages/core/research/store/`, hand-authored JSON entries; symbolic drift detection over 3 canonical sources). LLM extension (context7 MCP + Anthropic `web_search_20250305` with allowed_domains) deferred as v2 trigger per [open-questions.md §13.10](open-questions.md). The contract documented in §2.4 above describes the v1+v2 unified surface; v2 is a strict superset over the v1 store. v1 ships behaviorally identical to the contract for curated frameworks; v2 extends coverage to non-curated ones.
>
> **Live-adapter update (2026-07-02, doc-truth sweep):** the deferred leg is now **partially LIVE** — rule-research live-adapter Phase 1 (#805, umbrella closed #809) + live-research as the **default rule delivery**, augment-first (react-next #824; multistack B1-B4 #828; 2026-06-29). Mechanism: an in-session, AI-agnostic protocol ([agents/rule-researcher.md](../../agents/rule-researcher.md), thin CC trigger [.claude/skills/rule-research/SKILL.md](../../.claude/skills/rule-research/SKILL.md)) researches canonical live docs and emits committed `ResearchPlan`/`GenerateSelection` JSON; the deterministic factory synthesizes the rule + firing test from those (port/adapter surface: `packages/core/research/research-port.ts`, `research-adapter-anthropic.ts`, `research-live.test.ts`). No paid LLM in CI — research runs in the active session per [no-paid-llm-in-ci.md](../../.claude/rules/no-paid-llm-in-ci.md); the curated store remains the baseline (augment-first). Still v2-deferred: LLM-driven synthesizer menu-picker (§2.5) and Path B AST generation.
>
> **Trust-tier update (2026-07-02, rule-research-trust-tiers umbrella):** the hardcoded 7-key `ALLOWED_SOURCES` const above is now **resolver-computed** across three trust tiers evaluated in order (first match wins) — Tier 0 builtin curated (the same 7 keys, unchanged), Tier 1 derived automatically from a consumer's own direct-dependency metadata (scope-locked to that package, multi-tenant apexes excluded), and Tier 2 consumer-acked via a committed `.ai-factory/research-allowlist.json` file. The factory stays offline and no-network at validate time — Tier-1 resolution reads only local files (`allowlist-resolver.ts`). See [`.claude/rules/research-source-trust.md`](../../.claude/rules/research-source-trust.md) for the discipline and [`.claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md` §4](../../.claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md) for the full architecture.

### 2.5 Layer 3 — Rule Synthesizer

**Что делает.** На основе research'а выводит:
- ESLint правила (конфигурация существующих плагинов — Path A) или сам AST-плагин (Path B, см. §3)
- Negative test cases (обязательно для каждого правила)
- Audit probes
- RULES.md fragments под стек
- ESLint flat config с правильным scoping

**Output формат.** Tentative `rules-manifest.json`:

```json
{
  "R12": {
    "title": "Server vs Client Components (Next 16)",
    "stack": ["next@>=15"],
    "applies-to": ["src/app/**/*.tsx"],
    "requires-package": "next",
    "check": {
      "type": "eslint",
      "plugin": "rules-as-tests",
      "rule": "no-server-imports-in-client",
      "config": "error"
    },
    "negative-test": {
      "input": "'use client'\\nimport fs from 'node:fs'\\nexport default function X() {}",
      "expect-violation": "no-server-imports-in-client"
    },
    "examples": {
      "bad": "...",
      "good": "..."
    },
    "research-source": "nextjs.org/docs/app/building-your-application/rendering",
    "research-version": "16.2.1",
    "research-fetched-at": "2026-05-07T10:00:00Z"
  }
}
```

> **v1 deterministic stance (2026-05-08):** Synthesizer ships **Path A only**, hand-authored recipes (`packages/core/synthesizer/recipes/*.json`); `synthesize(plan)` is a pure JSON-to-SynthesisPlan transform with no LLM calls. v1 is the «curated recipes on disk» case of «picks from menu»; v2 ships the actual LLM-driven menu picker per [open-questions.md §13.10 entry #2](open-questions.md). Path B AST gen is a separate v2 trigger per §13.10 entry #3 (Phase 9+). v2 ships as a strict superset — recipes remain authoritative for curated stacks even after LLM gen activates.

### 2.6 Layer 4 — Self-Validator

**Что делает.** Прогоняет invariant-проверки против каждого сгенерированного правила:

1. **Schema check** — соответствует JSON Schema.
2. **rule-tester прогон** — для каждого правила запускается positive case (нарушение → ошибка) и negative case (валидный код → ошибки нет).
3. **Mutation на правиле** — Stryker мутирует AST-логику правила; тесты должны убить мутантов.
4. **Tautology check** — правило не должно срабатывать на пустом коде или на коде без целевой конструкции.
5. **Two-AI review** — второй агент в холодную смотрит правило и его тесты, ищет тавтологию или пропуски.
6. **Cross-rule conflict check** — новое правило не противоречит существующим (например, не запрещает паттерн, который другое правило требует).

**Отклонение.** Если хоть один gate провален — правило **не пишется на диск**. Возврат в Layer 3 для регенерации (с feedback'ом от validator) или в human review.

**Это и есть применение собственных принципов пакета к LLM-output.**

> **v1 deterministic stance (2026-05-08):** Validator ships **gates 1, 2, 4, 6 REQUIRED** in Phase 7. Gate 3 (mutation testing via Stryker) is a v2 trigger per [open-questions.md §13.10 entry #5](open-questions.md) — only mutates AST, so nothing to mutate in Path A; activates with Path B (Phase 9+). Gate 5 (two-AI review) is a v2 trigger per §13.10 entry #4 — maps to AIF `review-sidecar` (`model: opus`); cost-scope decision deferred to Phase 8. See [retros/phase-7.md L4 6-gate triage table](retros/phase-7.md) for v1 lock state. v2 expansion is strict-superset over v1 REQUIRED gates.

**Anti-vacuity cluster (S3, generator-forbid-mvp):** Three additional gates added in `packages/core/validator/` to catch example pairs that are correct but non-informative. All three are engine-agnostic; `eslint-restricted` implementation ships now; `ast-grep` yields an explicit deferred-marker per decision (i). These gates return `n/a` when no applicable rules are present and never re-implement gate 2 (firing check) or gate 4 (corpus-firing check).

> **Runtime status (honest, S3):** these three gates are **forward-protection**. Until S4 makes `synthesize` emit `declarative` forbid rules (carrying `message`) into real plans, **no rule in the live `detectStack → research → synthesize` pipeline reaches gates 7–9** — they resolve to `n/a` on the self/fixture snapshots and are exercised only by their paired adversarial fixtures. This is spec-sanctioned (S3 is a stage *before* S4's compilation), not theatre — but "9 gates" must not be read as "9 active defenses on real output today." Gates 7–8 activate on real output at S4; gate 9 activates when a fixable rule (S4/G3b codegen) is emitted.

7. **single-token-diff** — `examples.good` and `examples.bad` must differ by ≤5 whitespace-token edits (Levenshtein). A larger distance means the pair may not isolate the targeted construct. Applies to `declarative` rules only. The `≤5` is a **conservative interim bound**: it rejects grossly non-minimal pairs (the gate's own adversarial BAD fixture is 22 edits); the *ideal* is a single targeted construct (≈1 token / 1 AST-node — the umbrella §S3 intent). The exact minimality threshold is **calibrated at S4** against the first real emitted forbid pairs (none exists to calibrate against yet).
8. **messageId-coverage** — for `declarative` rules that declare `check.message` or `check.messageId`, verifies the declared value IS the one actually emitted when linting `examples.bad`. Closes the gate-2 loose ruleId-fallback gap.
9. **autofix-clean** — for `eslint`/`declarative` rules, applies one pass of ESLint fix patches from `examples.bad` and re-verifies: (a) fixed output parses, (b) same-rule violation is gone, (c) no new same-rule violation introduced. Returns `n/a` for fixer-less rules (e.g. `no-restricted-syntax`). Forward-protects S4/G3b emit.
10. **require-vacuity** — for `declarative` rules with `presence:'require'`, checks TWO vacuity directions that the forbid tautology gate (gate 4) cannot catch (T-RCT-B): **(A)** selector must fire on `examples.bad` (required construct absent → must flag; never-fires = vacuous); **(B)** selector must NOT fire on `examples.good` (required construct present → must not flag; always-fires = vacuous). Returns `n/a` when no require rules are present. `ast-grep` require rules yield an explicit deferred-marker (same as gates 7–9). Ships in S2 (`generator-require-composite-tier`). **Why gate 4 can't be reused:** the empty/unrelated negative corpus has no host node — a broken require selector that never matches trivially "passes" gate 4 (direction A false green). The require gate uses the rule's own examples instead.

> **Require semantics (S2):** `presence:'require'` declarative rules fire when the required construct is **absent**. The selector is authored as `:not(:has(...))` — matching nodes that LACK a required descendant. The `synthesize.ts` bridge (lines 94–107) wires any `eslint-restricted` declarative selector into `no-restricted-syntax` regardless of `presence` — a require selector therefore reddens on absence with **zero wiring change** (require is a semantic extension, not a code-path fork). The `compile-declarative-md.ts` engine dispatch uses a `switch` over the engine enum with a `// G3b: codegen engine slots here` marker + no-op `default` arm — the seam for future codegen engine registration.

### 2.7 Layer 5 — Installer

**Что делает.**
1. Записывает только validated правила в проект.
2. Генерит `RULES.md`, `eslint.config.mjs`, `audit-ai-docs.sh`, GitHub Actions workflow из manifest.
3. Создаёт `rules-lock.json` для воспроизводимости.
4. Устанавливает npm deps, husky, скрипты.
5. После установки запускает Layer 4 ещё раз против установленного — финальная meta-проверка.

> **v1 deterministic stance (2026-05-08):** Installer ships **artifact write only** in Phase 7 — validated rules + 3 emit artifacts + `rules-lock.json` + post-validate. Items 4 (npm deps install / husky / GHA generation) deferred as v2 trigger; `install.sh` already handles those at the bash level. **v1.5 self-diagnostics** (item between v1 and v2) — `diagnostics-init` write hook per [self-diagnostics-design.md](self-diagnostics-design.md), Phase 8.X parallel sub-phase. v2 ships full installer scope per [open-questions.md §13.13](open-questions.md) versioning + [§13.14](open-questions.md) BC migration.

---

## 3. Path A vs Path B (генерация AST-правил)

### 3.1 Path A — безопасный (default)

**Что генерится:** конфигурация существующих плагинов + список применимых плагинов.

Research отвечает на вопрос «какие плагины и в каких настройках нужны для Next 16.2». Например:
- Включить `eslint-plugin-react-compiler` (новый для React 19+)
- Выключить часть `react-hooks/exhaustive-deps` (компилятор делает за нас)
- Скорректировать scoping `no-restricted-imports` под App Router

LLM не пишет TypeScript код, он **выбирает из меню**. Риск ошибки минимальный.

### 3.2 Path B — амбициозный (опционально)

**Что генерится:** сам AST-плагин TypeScript.

LLM получает описание паттерна → генерит `eslint-rule.ts` + `rule-tester.test.ts`. Validator прогоняет. Если все negative tests падают и positive проходят — правило допускается.

**Риск.** Сгенерированный TS-код может зависнуть на edge cases (template strings, JSX spread, conditional rendering). Validator должен покрывать их matrix-тестами.

**Когда применять.** Только когда Path A не покрывает потребность (новый паттерн, для которого нет готового плагина). С обязательным **human review checkpoint** перед commit'ом.

### 3.3 Переключение

Конфигурация в `meta-factory.config.json`:
```json
{
  "synthesis-mode": "conservative",  // только Path A
  "synthesis-mode": "creative",       // Path A + Path B с human review
  "synthesis-mode": "research-only"   // не генерить, только репортить findings
}
```

Default — `conservative`.

> **v1 deterministic stance (2026-05-08):** the `synthesis-mode` config is **v2-only**. v1 ships implicit `conservative`-equivalent — recipes on disk, no toggle, no `meta-factory.config.json` consumed. The toggle activates with Path A LLM gen (per [open-questions.md §13.10 entry #2](open-questions.md)) and Path B (entry #3). In v1, attempting to set this field is a no-op; the synthesizer reads recipes regardless.
