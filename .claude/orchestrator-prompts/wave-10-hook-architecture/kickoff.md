# Wave 10 — Hook layer architecture: bash→TS-core + AST for code surfaces — KICKOFF

> **Status:** ARMED — **blocked on Wave 9 closure** (2026-05-12). Wave 9 CLOSED 2026-05-13 (PR #51). Scope-expansion edit 2026-05-13 (post-Wave-9 prioritisation session Q4 = variant C + `danger local` context7 evidence). Do NOT start until Wave 9 M1-M5 fixes merged + Review-phase Dn answers done. After Wave 9 closes: open new Claude Code session on Opus, run `/orchestrator`, paste this file as first message.

> **§13.33** — new open-question entry to be created as part of R-phase output commit.

> **Scope-expansion 2026-05-13:** Wave 10 scope **may extend to PR-time enforcement surface** (`.github/workflows/discipline-self-check.yml` shell migration), pending R-phase D6 decision on whether Danger JS (SSOT #41 ADOPT) serves as runtime engine for both pre-push and PR-time. Context7 evidence (2026-05-13): `danger local --dangerfile dangerfile.lite.ts` is documented Husky pre-push integration pattern; `danger.git.commits` accessible in both `danger local` and `danger ci` modes; shared TS modules pattern (lite.ts + main dangerfile.ts) supports DRY across surfaces. R-phase MUST evaluate Danger as runtime-engine candidate, NOT just sister CI tool. See §8 D6.

---

## §1 Problem

Проект имеет **1211 строк shell-кода** в hook/audit слое:

| Файл | Строк | Роль |
|------|-------|------|
| `.husky/pre-push` | 449 | Основной enforcement: §1.7, Prior-art, LOC, path checks |
| `packages/core/audit-self/audit-ai-docs.sh` | 311 | Audit: D1-D5 probes, Markdown + TS-код |
| `packages/core/audit-self/audit-ai-docs.test.sh` | 293 | Shell-тесты на audit скрипт |
| `packages/core/audit-self/pre-push.test.sh` | 158 | Shell-тесты на pre-push логику |

**Три конкретных проблемы**, найденных Wave 9 R-phase (2026-05-12):

1. **C3 shell tests exit-code-only** — `test_D1` и `test_D3` проверяют только exit code, не content вывода. Скрипт который всегда `exit 1` пройдёт оба теста. Прямое следствие того что shell-тесты ограничены в expressiveness.

2. **C4 false negatives из-за regex** — `no-direct-time-randomness`, `no-unsafe-zod-parse` пропускают синтаксические варианты (`globalThis.Date.now()`, `schema['parse']()`) потому что bash grep смотрит на текст, не на AST. Аналогичный паттерн в `audit-ai-docs.sh` D-probes.

3. **Stryker не может мутировать shell** — у `.husky/pre-push` и `audit-ai-docs.sh` **нулевое mutation testing покрытие**. Принципы 01-10 (TypeScript) покрыты Stryker; hook-логика — нет. Это несимметрично для проекта чья thesis — «тесты должны уметь падать».

**Root cause (T11 в историческом масштабе):** ранние AI-сессии выбрали bash как least-resistance path (Husky docs показывают bash-примеры). Никто не поставил вопрос «почему bash если проект TypeScript?» — потому что вопрос выходил за scope каждого R-phase. `#own-stack-blind-spot` — TypeScript и `tsx` были в проекте с начала, но для хуков не рассматривались как кандидат.

**Дополнительный контекст:** `packages/core/package.json:44` уже содержит `"tsx": "^4.19.0"` — нулевая дополнительная зависимость для TS-хуков.

**Sister surface (added 2026-05-13):** PR-time enforcement живёт в `.github/workflows/discipline-self-check.yml` (shell-логика внутри workflow). Это **parallel-shaped** к pre-push: проверяет §1.7 sections в PR body, §1.7 substance arm, prior-art trailer. Тот же layer дисциплины, другая stage (post-push, CI). R-phase должен решить (D6): является ли это в scope Wave 10 (если Danger JS = runtime engine для обоих surfaces) или в Wave 11 (если own-build TS-core хук-runner отдельно от PR-time tool).

---

## §2 Goal

```
bash (10 строк)   → только bootstrap/orchestration: выбрать engine, exit с его кодом
TS-ядро           → вся логика: парсинг, проверки, output — testable, Stryker-mutatable
AST               → для code surfaces (TS/JS анализ в audit-ai-docs)
regex в TS        → для строковых поверхностей (commit messages, file paths) — OK
fallback bash     → упрощённые критические проверки для не-TS стеков
```

**Требование «любой стек»:** проект ставится на Go, Python, Ruby, не только TS. Значит:
- TS-ядро — для TS-стеков (enhanced, Stryker-покрытый, AST-capable)
- bash-fallback — для остальных (regex-уровень, критические проверки только)
- Feature detection в bootstrap: `if command -v node >/dev/null && [ -f "packages/core/hooks/pre-push.ts" ]`

---

## §3 Current state — что именно делает каждый shell-файл

R-phase должен прочитать каждый файл и составить function inventory. Для справки, основные секции `.husky/pre-push`:

- §1 Environment checks
- §2 Staged file detection
- §3 ESLint on staged
- §4 TypeScript compilation check
- §5 Principles tests run
- §6 LOC threshold check (capability commit gate)
- §7 Prior-art trailer check (`pa_check_trailer`)
- §8 §1.7 substance check (`s17_check_trailer`)
- §9 §1.7 body-prose-only detection (added Wave 8.3)

`audit-ai-docs.sh` делает D1-D5 probes на Markdown + enrolled-docs completeness.

**R-phase должен пройти и задокументировать полный function inventory** — не «примерно 9 секций», а точный список с тем что проверяет каждая.

---

## §4 Hard constraints

- **NO bundling в Wave 9 sub-waves.** Wave 10 = отдельный umbrella. Не добавлять в Wave 9.1-9.5.
- **NO платного LLM в CI.** Память `feedback_no_paid_llm_in_ci.md` — load-bearing.
- **Worktrees для параллельных sub-waves.** Память `feedback_worktrees_for_parallel_subwaves.md`.
- **Build-vs-reuse SSOT consult** перед любым «предлагаю написать X»: context7 ≥3 phrasings + SSOT lookup. `tsx` уже в стеке — это own-stack candidate, не external tool.
- **Fallback bash обязателен** — проект должен работать на не-TS стеках после Wave 10.
- **Atomic commits per sub-wave** — каждый sub-wave независимо merge-able.
- **§1.7 substance arm active** — PR bodies требуют file:line citations (Wave 8.1 gate).
- **`§1.7:` или `§1.7 Bootstrap:` trailer** на каждом discipline-вводящем коммите.
- **Paired-negative arm в том же коммите** что и новый TS-тест (Wave 8 D6=C precedent).

---

## §5 R-phase methodology

### §5.-1 Research tooling — двойной канал (added 2026-05-13)

Этот проект имеет ДВА MCP для research: `context7` и `deepwiki`. Они закрывают разные question shapes:

- **`context7`** — API signatures, current usage, library docs «как вызвать функцию X». Использован по умолчанию во всех предыдущих R-phase patches.
- **`deepwiki`** — architectural understanding, cross-repo analysis, tradeoffs. `ask_question(repo, question)` особенно подходит для: «как X устроен внутри?», «чем X отличается от Y?», «какой tradeoff авторы X сделали?» — то есть для build-vs-reuse evaluation.

**Обязательно для этой R-phase:** для КАЖДОГО prior-art / runtime-engine candidate (Husky, Lefthook, simple-git-hooks, **Danger JS**, tsx) прогнать запрос ОБОИМ инструментам и сравнить findings в §4 prior-art findings. Если deepwiki недоступен (MCP не загружен в текущей сессии — проверь `ToolSearch` для `mcp__deepwiki__*`) — задокументировать в §findings + продолжить только с context7.

DeepWiki MCP установлен 2026-05-13 на user scope; в новых сессиях должен быть доступен. Этот двойной канал — empirical-evidence collection для отдельного research-tooling-evaluation session ([kickoff](../research-tooling-evaluation/kickoff.md)).

### §5.0 Prior art sweep (обязателен ПЕРЕД §2 enumeration)

**context7 queries — обязательно все:**

1. `husky typescript hooks` — как другие проекты пишут Husky хуки на TS
2. `git hooks typescript vitest testing` — паттерны тестирования TS git хуков
3. `lefthook husky comparison typescript` — альтернативы Husky с нативным TS support
4. `simple-git-hooks typescript` — lightweight альтернатива
5. `lint-staged husky pre-push typescript` — комбинированные паттерны
6. **`danger js local pre-push husky dangerfile.lite.ts`** — Danger JS как runtime engine (SSOT #41 ADOPT); `danger local` documented Husky integration; обязателен (added 2026-05-13)
7. **`danger js git.commits message body trailer parsing`** — какой API даёт Danger для парсинга commit messages (§1.7 + Prior-art trailer use-case)
8. **`danger js plugin shared dangerfile import lite ci local hybrid`** — паттерн «shared rules между danger ci и danger local»

**WebSearch queries:**

1. `«husky hooks typescript vs bash 2025 2026»` — best practices переход
2. `«git pre-push hook typescript ast eslint programmatic»` — AST в хуках
3. `«mutation testing shell scripts alternatives»` — что делают вместо shell mutation testing
4. **`«danger js as runtime engine for git hooks pre-push»`** — кто-нибудь уже использовал Danger как hook engine? (added 2026-05-13)

**Минимальный output:** ≥5 внешних источников в §11 с URL + verdict. Особо ищи: есть ли production-grade проект который уже переписал bash-хуки на TS и задокументировал паттерн?

**SSOT consult:** перед каждым «предлагаю механизм X» — `prior-art-evaluations.md` lookup + context7. `tsx` = SSOT own-stack candidate. Lefthook/simple-git-hooks = возможные SSOT #42-#43. **Danger JS = SSOT #41 ADOPT (2026-05-13)** — verdict уже ADOPT, остаётся решить *как* (runtime engine vs sister tool vs Wave 11 deferral). NB: «adopted» не значит «automatically chosen as runtime engine»; D6 evaluates fit-for-purpose against own-build TS-core hook runner.

### §5.1 R-phase output requirements (binding)

Файл: `docs/meta-factory/research-patches/2026-MM-DD-§13.33-hook-architecture-research.md`

Обязательные секции:

- **§1 Problem** — restates §1 этого kickoff с точными числами строк (перепроверь grep'ом)
- **§2 Function inventory** — для каждого из 4 shell-файлов: таблица функций/секций + что проверяет + тип surface (строки / код / файл-existence). EXACT counts (grep `^[a-z_]\+()` или `^# ──`)
- **§3 Migration classification** — для каждой функции: `TRIVIAL-REGEX-PORT` (regex в TS, прямой перенос) / `AST-UPGRADE` (нужен @typescript-eslint/parser или рemark) / `OWN-BUILD` (нет готового аналога) / `DROP` (дублирует ESLint уже)
- **§4 Prior art findings** — результаты §5.0 sweep. Lefthook, simple-git-hooks, ts-husky паттерны. **Особо: Danger JS как runtime engine candidate** — `danger local --dangerfile dangerfile.lite.ts` на pre-push + `danger ci` на PR-time, shared TS modules, единый dangerfile pattern. Для каждого кандидата: upstream problem class vs наш problem class (T16 check). Явно сравни «own-build TS-core hook runner» vs «Danger JS as runtime engine» — это load-bearing architecture branch (D6).
- **§5 Architecture decision** — final recommendation на основе D6 evaluation. Three branches: (a) own-build TS hook runner (bash bootstrap + `node --import tsx/esm` + fallback) с Danger как Wave 11 для PR-time only; (b) Danger as runtime engine (`danger local` для pre-push + `danger ci` для PR-time, shared `packages/core/checks/*` модули, ОБА surfaces в scope Wave 10); (c) hybrid (TS-core для pre-push сложных проверок не покрытых Danger API, Danger для PR-body). Обоснование. Риски. Build-vs-reuse трейд-офф explicit.
- **§6 Migration plan** — ordered sub-waves. Каждый: что переносится, входные зависимости, выходной критерий (paired-negative arm required)
- **§7 Fallback spec** — что именно входит в bash-fallback для не-TS стеков. Какие проверки критические (должны быть везде), какие enhanced (только TS-стек)
- **§8 Stryker integration plan** — конкретно: как запустить Stryker на новых TS-хуках. Конфиг. Какие мутации проверять. Ожидаемый score.
- **§9 Adversarial counter-prompt** — «какой аспект архитектуры я не рассмотрел?»
- **§10 Effort estimate** — per sub-wave
- **§11 Open decisions (Dn)** — минимум D1-D5 (см. §8 ниже)
- **§12 SSOT entries proposed** — новые #42+ если найдены Lefthook / simple-git-hooks / паттерны
- **§13 §1.7 self-review** — Forward + Backward + Self-reflexive

### §5.2 Learn-from-upstream mandate (added 2026-05-16 per goal-clarity-dialogue §4.5 v2 verdict)

R-phase MUST execute **NOT ONLY** the standard binary prior-art check (does an AST-hooks engine with our specific configuration — §1.7 substance + Prior-art trailer + audit-ai-docs equivalent — exist upstream?), **but ALSO mine ≥3 «patterns to consider integrating» from existing AI-runtime ecosystem players**, regardless of whether they target our exact problem class.

**Mandatory upstream surfaces to mine:**

- **`aif-handoff` lint-staged + husky setup** — what they got right; what limitations they hit. Reference: DeepWiki probe 2026-05-13 confirmed bash/husky + lint-staged stack.
- **`OhMyOpencode` tool-restrictions-as-permissions approach** — fundamentally different shape (permissions, not hooks). Could it complement our hooks rather than replace? Reference: memory `feedback_ai_doc_research_priority_pool` Tier 1.
- **(when alt-target research lands — see [research-patch 2026-05-16-goal-clarity-dialogue.md §11](../../../docs/meta-factory/research-patches/2026-05-16-goal-clarity-dialogue.md))**: Superpowers / Agent Teams / Cline / Cursor / Codex / Aider patterns.

**R-phase output requirements (additions to §5.1):**

- New §findings.X **«Patterns adopted from upstream»** subsection — minimum 3 entries with format:
  - Pattern name + source (upstream project + section)
  - Our integration plan (verbatim adopt / adapt / reference / reject + rationale)
  - Implementation budget (commit count + LOC estimate)
- New §findings.Y **«Patterns rejected from upstream»** subsection — for documented context. Empty subsection OK if no rejections.

**Acceptance criterion update:** Wave 10 R-phase verdict cannot be «BUILD core engine» alone. Verdict must be **«BUILD core engine enriched by ≥3 upstream patterns»** OR **«BUILD core engine with explicit rationale why upstream patterns inapplicable to all 3+ surveyed players»**. This binds R-phase §5.1 output requirements with mandatory upstream-pattern mining; the §findings.X/§findings.Y subsections become part of §5.1 acceptance.

**Anti-pattern this avoids:** `#parallel-evolution-creep` from [.claude/rules/build-first-reuse-default.md](../../rules/build-first-reuse-default.md) §4. Building parallel to upstream because per-commit decisions never composed at scope level.

---

## §6 I-phase sub-waves (предварительный outline)

После R-phase и maintainer Dn-ответов:

```
Wave 10.1 — TS bootstrap wrapper
  .husky/pre-push: 10-строчный bash dispatch + packages/core/hooks/pre-push.ts stub
  Тест: pre-push.test.ts (vitest) заменяет pre-push.test.sh частично
  Paired-negative: тест что TS-хук падает на известном violation

Wave 10.2 — Port §7 pa_check_trailer → TS
  Самая тестируемая функция. Хорошая первая цель.
  Stryker run после переноса.

Wave 10.3 — Port §8 s17_check_trailer → TS
  Substance check. AST для file:line verification возможен здесь.

Wave 10.4 — audit-ai-docs.sh → audit-ai-docs.ts
  D-probes как TS functions. AST для TS-код-проверок.

Wave 10.5 — bash-fallback spec + install.sh adaptation
  Упрощённый bash-fallback для не-TS стеков.
  install.sh выбирает правильную версию.

Wave 10.6 — Port hook-stub-completeness bash audit → TS principle 11
  Source: packages/core/audit-self/hook-stub-completeness.test.sh (from PR #52, 2026-05-13).
  Target: packages/core/principles/11-hook-stub-completeness.test.ts.
  Bash impl is regression-fixture spec — TS port must produce identical violation
  output on shared fixture. After parity verified, delete bash impl + remove §3a
  invocation from .husky/pre-push (TS principle test wired into npm test instead).
  Tracking origin: research patch docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md §10.A + PR #52 commit 9 «3-place tracker» place #2.
```

---

## §7 AI laziness traps — прочитай перед R-phase

Активные ловушки для этой волны (per [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md)):

**T1** — не смотри на 3 функции и не говори «всё просто перепишем». Function inventory должен охватить все 4 файла полностью (floor = весь файл, это не большой sample).

**T3** — каждое утверждение в §3 «эта функция TRIVIAL-REGEX-PORT» должно иметь: прочитал функцию, вот что она делает, вот почему regex в TS делает то же самое.

**T4** — R-phase output должен включать все 13 секций §5.1. Adversarial counter-prompt §9 обязателен — не факультативен.

**T5** — не фиксить bash во время R-phase. R-phase = только документ. Если увидел очевидный баг — фиксируй в §findings, оставь в I-phase.

**T11** — перед каждым «предлагаю написать X»: context7 ≥3 phrasings. Особо опасная ловушка здесь: написать «предлагаю TS bootstrap» без проверки что Lefthook/simple-git-hooks/ts-husky уже это решают out-of-the-box.

**T13** — `tsx` — ADOPTED-MECHANISM. Upstream problem class: TypeScript execution без компиляции. Наш problem class: TS git hooks. Match? Проверь явно. **Также Danger JS = ADOPTED (SSOT #41 ADOPT 2026-05-13)** — upstream problem class: PR-body validation + CI feedback. Наш problem class для D6: full hook runtime engine (commit parsing + diff analysis + AST в audit-ai-docs). Проверь явно, дотягивается ли API Danger до всех 9 секций pre-push — если нет, D6 = (a) own-build или (c) hybrid, не (b).

**T15** — self-application: применяет ли эта миграция свою же thesis? TS-хуки с vitest + Stryker должны иметь лучшее mutation-adequacy чем те bash-тесты которые они заменяют. Если нет — это провал recursive self-application.

**T16** — Lefthook / simple-git-hooks звучат похоже на «решение». Upstream problem class: замена husky. Наш problem class: тестируемые, Stryker-mutatable, AST-capable хуки. Явно проверь совпадение перед любым «предлагаю Lefthook».

**Domain-specific trap T-Wave10-A** — «Bash работает везде, значит fallback-bash будет достаточен для большинства пользователей.» Соблазн: сделать fallback большим и rich, а TS-ядро минимальным. Контрмера: fallback должен быть минимальным (критические проверки только); TS-ядро — полным (весь enforcement). Иначе «fallback» становится основным путём и thesis теряется.

**Domain-specific trap T-Wave10-B** — «Переписать за один раз — clean slate лучше инкрементального.» Соблазн: написать весь `pre-push.ts` с нуля сразу. Контрмера: каждый sub-wave переносит одну секцию, имеет свои тесты, независимо merge-able. Incremental migration сохраняет working state на каждом шаге.

---

## §8 Open decisions (Dn) — для maintainer после R-phase

**D1 — Husky vs альтернатива.** Оставить Husky (bash bootstrap → TS-ядро) или перейти на Lefthook/simple-git-hooks если они имеют нативный TS support? R-phase должен найти answer.

**D2 — Fallback глубина.** Bash-fallback: только trailer presence checks (§7, §8) или весь enforcement subset? Default = только trailer presence.

**D3 — AST для D-probes.** `audit-ai-docs.sh` D-probes анализируют TS-файлы через grep. Переписать на `@typescript-eslint/parser` AST для D3/D4 (которые смотрят в TS-код) или оставить grep для Markdown-probes, AST только для TS-код-pobes?

**D4 — Stryker coverage target.** После Wave 10.2 (первый TS-хук): какой минимальный mutation score? Default = ≥80% (аналогично принципам).

**D5 — install.sh feature detection.** Как install.sh в consumer-проекте определяет есть ли node? `command -v node` + version check? Или всегда ставить оба варианта (TS + bash-fallback)?

**D6 — Runtime engine (added 2026-05-13).** Какой движок исполняет TS-логику хуков?
  - **(a) Own-build:** `tsx`-based hook runner написанный с нуля. Bash bootstrap → `node --import tsx/esm packages/core/hooks/pre-push.ts`. Полный контроль API. Riska: реализовать заново то, что Danger уже делает.
  - **(b) Danger JS as engine:** `.husky/pre-push` → `npx danger local --dangerfile packages/core/dangerfiles/lite.ts`. `dangerfile.ts` (PR-time) импортирует `lite.ts` + добавляет PR-body checks. Shared modules в `packages/core/checks/*`. Adopted SSOT #41.
  - **(c) Hybrid:** Danger для surfaces где его API хватает (commit/diff/PR body); own-build TS-core там, где Danger API не подходит (например, `audit-ai-docs.sh` D-probes, требующие AST на TS-исходниках).
  - R-phase MUST evaluate всем context7 queries 6-8 + WebSearch #4. Не закрывать D6 без явного «Danger API дотягивается / не дотягивается до каждой из 9 секций pre-push» в §4 prior-art findings.

**D7 — PR-time surface scope (added 2026-05-13).** Зависит от D6.
  - Если D6 = (b) или (c): `.github/workflows/discipline-self-check.yml` migration **в scope Wave 10** (новый sub-wave 10.X = dangerfile.ts setup + workflow simplification). Shared modules reused.
  - Если D6 = (a): PR-time surface = scope **Wave 11** (отдельная волна Danger adoption). Wave 10 closes с pre-push only, Wave 11 owns dangerfile.ts.
  - R-phase явно фиксирует решение по D7 в §5 architecture decision.

---

## §9 Self-application requirement

Этот kickoff — discipline-bearing artefact. Его claims (function counts, migration classification scheme, sub-wave outline) — **неверифицированные estimates**. R-phase ДОЛЖЕН:

1. Перепроверить строки всех 4 файлов (grep, wc)
2. Если function inventory kickoff'а неточен — исправить в R-phase output и зафиксировать как drift в §findings
3. Ответить в §13 self-review: «применяет ли эта волна свою thesis к себе?» — т.е. будут ли TS-хуки Stryker-mutatable лучше чем bash-тесты которые заменяют?

---

## §10 See also

- [`.claude/orchestrator-prompts/wave-9-discipline-theatre-audit/kickoff.md`](../wave-9-discipline-theatre-audit/kickoff.md) — C3/C4 findings которые мотивировали эту волну
- [`docs/meta-factory/research-patches/2026-05-12-§13.31-project-theatre-audit-research.md`](../../../docs/meta-factory/research-patches/2026-05-12-§13.31-project-theatre-audit-research.md) — Wave 9 R-phase, §4 C3/C4 sample audit
- [`.claude/rules/ai-laziness-traps.md`](../../rules/ai-laziness-traps.md) — активные T-числа для §7
- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT; `tsx` likely own-stack candidate; Stryker = #40; **Danger JS = #41 ADOPT (2026-05-13)** — runtime-engine candidate evaluated in D6
- [`docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md`](../../../docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md) — context7 sweep that produced SSOT #41 ADOPT verdict; §5.1 evidence on Danger as deterministic alternative to CodeRabbit (SSOT #38 DEFER per no-paid-LLM)
- [`.github/workflows/discipline-self-check.yml`](../../../.github/workflows/discipline-self-check.yml) — PR-time enforcement surface (sister to pre-push); migration target если D6 = (b) или (c)
- [`packages/core/package.json:44`](../../../packages/core/package.json) — `"tsx": "^4.19.0"` уже в стеке
- [`CLAUDE.md` Build-vs-reuse invariant](../../../CLAUDE.md) — capability-commit gate
- Memories: `feedback_worktrees_for_parallel_subwaves.md`, `feedback_hook_self_test_pipeline_stubs.md`, `feedback_no_paid_llm_in_ci.md`

---

## §11 Final note to the AI who runs this

Проект намеренно переоткрыл bash как наименьшее сопротивление. Теперь есть 1211 строк shell без mutation testing, с regex вместо AST, с exit-code-only тестами.

Твоя задача — не «написать TS-версию». Твоя задача — сначала **понять что именно делает каждая строка bash** (§2 inventory), **проверить что готовые инструменты не решают это лучше** (§5.0 prior art), и **только тогда предложить конкретный план** (§6 migration). В этом порядке, не в обратном.

Если в какой-то момент ты думаешь «всё ясно, можно писать код» — ты ещё на R-phase и писать код нельзя (T5).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
