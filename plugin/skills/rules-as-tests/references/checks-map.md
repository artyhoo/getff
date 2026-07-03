# Карта проверок: где что запускается

> Восемь уровней защиты от edit-time до production. Каждый имеет свою скорость, свою зону ответственности и свой запасной механизм.
> Если читаешь любой документ из корпуса «Правил как тестов» — вернись сюда, чтобы понять, на каком уровне находишься.

Этот документ — единая точка входа. Полная картина: что запускается на каком этапе, что делает, что НЕ делает, какой инструмент используется, и в каком из документов корпуса описано подробно.

> **Authoritative for:** 8-level enforcement-checks map (edit-time → production) — what runs at each level, why, and which corpus doc describes it in depth. Single entry point for navigating the rules-as-tests corpus.
> **NOT authoritative for:** framework's project goal — see [README.md#why-this-exists](https://github.com/artyhoo/rules-as-tests-aif/blob/main/README.md#why-this-exists). Per-level patterns — see [overview.md](overview.md).

---

## Полная схема

```text
EDIT-TIME      PRE-COMMIT     PRE-PUSH       PRE-PR         CI on PR        CI on merge      PRE-DEPLOY     PRODUCTION
────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ms             <5s            10–60s         1–3min         3–10min         10+min           seconds         continuous
─────────       ──────         ──────         ──────         ──────          ──────           ──────          ──────
 IDE LSP        prettier       typecheck      audit-ai-docs  full tests      full mutation    can-i-deploy    SLO
 typecheck      eslint --fix   vitest         sub-agents     coverage        bundle size      error budget    canary
                               related        rules R1..R20  Stryker         security audit   chaos          synthetic
                               depcruise      (+aif-verify)  Storybook+E2E                                    rollback

  локально       локально       локально       локально       GitHub         GitHub           CI / Pact      Datadog/
                                                              Actions        Actions          Broker         Honeycomb
                                                                                                              Argo
                                                                                                              Rollouts

      ↑ shift-left ────────────────────────────────────────────→  ↑ shift-right ────────────────────────────→
```

Слева направо: чем ближе к продакшену, тем дороже найденный баг. Чем ближе к разработчику — тем быстрее отдача. Поэтому **проверки распределяются по этапам не случайно**: то, что можно поймать дёшево и быстро, должно ловиться слева; то, что требует реального трафика, выносится вправо.

---

## Таблица всех уровней

| #   | Уровень                                          | Длительность | Где работает                       | Что делает                                                                                                                                                                                 | Что НЕ делает                                                     | Источник истины                            |
| --- | ------------------------------------------------ | ------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------ |
| 1   | **Edit-time**                                    | мгновенно    | Редактор / IDE                     | TypeScript LSP, ESLint LSP подсвечивают ошибки в коде по мере набора                                                                                                                       | Не запускают тесты, не делают агрегатных проверок                 | TS-сервер, eslint daemon                   |
| 2   | **Pre-commit** (lint-staged через Husky)         | <5 сек       | Локально, перед `git commit`       | `prettier --write` и `eslint --fix --max-warnings=0` **только** на staged-файлах                                                                                                           | Не запускает тесты, не делает typecheck всего проекта             | `.husky/pre-commit` + `.lintstagedrc.json` |
| 3   | **Pre-push** (Husky)                             | 10–60 сек    | Локально, перед `git push`         | `tsc --noEmit` всего проекта, `vitest related` на изменённых файлах, `dependency-cruiser`                                                                                                  | Не запускает Stryker, не делает полный сьют тестов                | `.husky/pre-push`                          |
| 4   | **Pre-PR** (`audit-ai-docs.sh` + review-sidecar) | 1–3 мин      | Локально, в Claude Code            | `./scripts/audit-ai-docs.sh` + sub-agents (`review-sidecar`, `living-docs-auditor`) проверяют `.ai-factory/RULES.md`, two-AI review (+ `/aif-verify` обёртка, если используете AI-Factory) | Не заменяет CI — только дополняет                                 | `audit-ai-docs.sh`, `review-sidecar`       |
| 5   | **CI on PR**                                     | 3–10 мин     | GitHub Actions / GitLab CI         | Полный сьют unit + integration + Storybook + Playwright (для UI). **Stryker incremental** на diff. Coverage threshold.                                                                     | Не делает full mutation на всём репо, не делает chaos engineering | `.github/workflows/ci.yml`                 |
| 6   | **CI on merge**                                  | 10+ мин      | GitHub Actions, после merge в main | Full mutation sweep, bundle size, security audit (npm audit, gitleaks), build artifacts                                                                                                    | Не разворачивает в прод сразу — артефакт ждёт deploy gate         | `.github/workflows/post-merge.yml`         |
| 7   | **Pre-deploy**                                   | секунды      | CI / Pact Broker                   | `can-i-deploy --to production` (для микросервисов), error budget burn rate check, snapshot signing                                                                                         | Не запускает тесты — это уже сделано                              | `pact-broker can-i-deploy`, SLO-сервер     |
| 8   | **Production**                                   | непрерывно   | Live-окружение                     | SLO + error budget tracking, synthetic monitoring каждые 5 мин, canary auto-rollback, chaos engineering                                                                                    | Не валидирует структуру кода — это работа левой стороны           | Datadog/Honeycomb, Argo Rollouts, Gremlin  |

---

## Что где запускается, по слоям «Правил как тестов»

| Слой Rules as Tests    | Уровень 1 (IDE)                    | 2 (pre-commit) | 3 (pre-push)                              | 4 (pre-PR)               | 5 (CI PR)                            | 6 (CI merge)    | 7 (pre-deploy)     | 8 (prod)                         |
| ---------------------- | ---------------------------------- | -------------- | ----------------------------------------- | ------------------------ | ------------------------------------ | --------------- | ------------------ | -------------------------------- |
| **L1 Architecture**    | ESLint                             | ESLint --fix   | depcruise                                 | sub-agent                | full ESLint + depcruise              | bundle size     | —                  | service mesh, network policies   |
| **L2 Meta-tests**      | —                                  | —              | vitest related (мета-тесты на изменённых) | sub-agent                | полный мета-тест запуск              | —               | —                  | —                                |
| **L3 Spec by Example** | —                                  | —              | vitest related                            | sub-agent                | полный сьют it.each + property tests | —               | —                  | synthetic e2e                    |
| **L4 Mutation**        | —                                  | —              | —                                         | —                        | Stryker incremental                  | Stryker full    | —                  | chaos engineering                |
| **L5 Living Docs**     | TS LSP подсвечивает несоответствия | —              | —                                         | sub-agent на стиль JSDoc | docs CI build                        | OpenAPI publish | —                  | runbooks обновляются             |
| **Contracts (Pact)**   | —                                  | —              | —                                         | —                        | publish pact contracts               | —               | **`can-i-deploy`** | (Pact Broker отслеживает)        |
| **Shift-right**        | —                                  | —              | —                                         | —                        | —                                    | —               | error budget gate  | SLO + canary + synthetic + chaos |

---

## Что в каждом этапе НЕ должно быть

Один из самых частых антипаттернов — кладут тесты в pre-commit, и через неделю команда массово бьёт `--no-verify`. Вот явные запреты:

### Pre-commit — НЕЛЬЗЯ

- Юнит-тесты (даже на одном файле — это уже >5 секунд).
- `tsc --noEmit` всего проекта (медленно).
- Полный `eslint .` (только staged).
- Stryker (вообще никогда в pre-commit).
- E2E-тесты.
- npm audit (медленно, требует сети).

### Pre-push — НЕЛЬЗЯ

- Stryker mutation testing (медленно).
- Storybook test runner (нужен build).
- Playwright e2e (нужен running server).
- npm audit (запускается в CI, не локально).
- Полный coverage sweep.

### CI on PR — НУЖНО что не нужно локально

- `npm audit --audit-level=high` (security).
- `gitleaks` или `trufflehog` (поиск секретов в коммитах).
- Codecov upload (нужен токен).
- Bundle size check (нужен build).
- Stryker incremental на diff'е (требует actions/cache).

### Production — НЕ дублирует что в CI

- SLO/error budget — **не валидация кода**, а валидация поведения.
- Synthetic — не «прошли ли тесты», а «работает ли user journey прямо сейчас».
- Chaos — не unit-тесты, а проверка живой системы.

---

## Какой документ корпуса описывает какой уровень

| Уровень                                                                | Подробное описание в                                                                                                                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — IDE                                                                | Не выделено отдельно — это feature редактора                                                                                                                                 |
| 2 — Pre-commit                                                         | `packages/core/templates/shared/.lintstagedrc.json` + `husky-pre-commit.sh`                                                                                                  |
| 3 — Pre-push                                                           | `packages/core/templates/shared/husky-pre-push.sh` (с fallback на новые ветки)                                                                                               |
| 4 — Pre-PR (`audit-ai-docs.sh` + review-sidecar / living-docs-auditor) | `./scripts/audit-ai-docs.sh` + our `agents/review-sidecar.md` + `agents/living-docs-auditor.md` (+ AIF `rules-sidecar` / `/aif-verify` wrapper, если используете AI-Factory) |
| 5 — CI on PR                                                           | `templates/ts-server/github-actions-ci.yml` или `packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml`                                                       |
| 6 — CI on merge                                                        | Расширение `github-actions-ci.yml` для full mutation sweep (см. комментарии в файле)                                                                                         |
| 7 — Pre-deploy / can-i-deploy                                          | `packages/core/templates/shared/integration-rules.md` (IR2 — Pact + can-i-deploy)                                                                                            |
| 8 — Production                                                         | `packages/core/templates/shared/integration-rules.md` (IR5 — observability) — расширения требуют отдельной инфраструктуры (Prometheus, Honeycomb, Argo Rollouts)             |

---

## Антипаттерны общей картины

1. **Дублирование проверок между уровнями.** Если `tsc --noEmit` уже в pre-push, не нужно его в pre-commit. Если CI делает полный сьют — pre-push не должен повторять. Каждая проверка должна быть **на одном** уровне (плюс CI как страховка от `--no-verify`).

2. **Отсутствие fallback для `--no-verify`.** Локальные хуки можно обойти. Поэтому **всё, что критично — должно быть и в CI**. Pre-commit + pre-push — для скорости фидбэка; CI — для авторитета.

3. **Pre-PR без CI.** `/aif-verify` от AIF — мощная локальная проверка, но не заменяет CI. Внешние контрибьюторы не имеют AIF; AI-агент может пропустить шаг. Required check на merge через CI остаётся обязательным.

4. **Production без feedback loop в shift-left.** Каждый прод-инцидент должен закончиться добавленным тестом или ESLint-правилом. Без этого правая сторона работает в один конец, левая никогда не учится.

5. **Слишком много в одном уровне.** Если CI on PR занимает >10 минут — разработчики начнут мерджить без ожидания. Решение: парам.allелизация, разделение на критические/некритические job'ы, инкрементальный режим (Stryker, ESLint cache, Vitest related).

6. **Pre-commit длиннее 5 секунд.** Команда мгновенно начинает бить `--no-verify`. Lint-staged + только prettier + eslint --fix на staged. Точка.

7. **`@{push}` без upstream-fallback.** Pre-push на новой ветке без upstream упадёт. Используйте fallback на `origin/<default-branch>` через `git symbolic-ref`.

---

## Минимальный pipeline для нового проекта

Если стартуете с нуля, вот минимум, который покрывает 80% проблем:

| Уровень        | Конкретно                                                              |
| -------------- | ---------------------------------------------------------------------- |
| 2 — pre-commit | `prettier --write` + `eslint --fix` через lint-staged                  |
| 3 — pre-push   | `npm run typecheck` + `vitest related $CHANGED` + `npm run arch:check` |
| 5 — CI on PR   | lint, typecheck, arch, tests с coverage threshold, build               |
| 7 — pre-deploy | (если микросервисы) `can-i-deploy --to production`                     |
| 8 — production | один SLO на критичный flow + один synthetic test                       |

Это всё. Без этого — вы летите вслепую. Сверх этого — постепенное добавление по мере роста проекта.

---

## Зрелый pipeline для production-системы

Все 8 уровней включены и взаимно дополнены:

| Уровень | Что добавляется к минимуму                                                                               |
| ------- | -------------------------------------------------------------------------------------------------------- |
| 2       | + commitlint + sort-package-json                                                                         |
| 3       | + dependency-cruiser strict + meta-tests на критических каталогах                                        |
| 4       | + AIF `/aif-verify` (rules-sidecar) + review-sidecar                                                     |
| 5       | + Stryker incremental + Storybook test-runner + Playwright + bundle size + Codecov                       |
| 6       | + Stryker full nightly + npm audit + gitleaks + OpenAPI publish                                          |
| 7       | + Pact `can-i-deploy` + error budget burn rate check                                                     |
| 8       | + полный SLO-стек (Pyrra/Sloth) + Argo Rollouts canary + Datadog Synthetic + chaos engineering quarterly |

Это путь. Не пытайтесь поднять всё за неделю. Каждый уровень — отдельная инвестиция, которая окупается на масштабе.

---

## Шпаргалка: какой инструмент на каком уровне

| Инструмент                         | Уровень                              |
| ---------------------------------- | ------------------------------------ |
| TypeScript LSP                     | 1                                    |
| Prettier                           | 2                                    |
| ESLint (--fix)                     | 2                                    |
| ESLint (--max-warnings=0)          | 5                                    |
| `tsc --noEmit`                     | 3, 5                                 |
| `vitest related`                   | 3                                    |
| `vitest run --coverage`            | 5                                    |
| Vitest property-based (fast-check) | 5                                    |
| Storybook test-runner              | 5                                    |
| Playwright                         | 5 (e2e в CI) + 8 (synthetic в проде) |
| Stryker `--incremental`            | 5                                    |
| Stryker full                       | 6                                    |
| dependency-cruiser                 | 3, 5                                 |
| AIF `/aif-verify`                  | 4                                    |
| AIF sub-agents                     | 4                                    |
| commitlint                         | 2                                    |
| Husky                              | 2, 3                                 |
| lint-staged                        | 2                                    |
| npm audit                          | 5, 6                                 |
| gitleaks / trufflehog              | 5, 6                                 |
| Codecov                            | 5                                    |
| Pact `can-i-deploy`                | 7                                    |
| OpenSLO + Pyrra/Sloth              | 8                                    |
| Datadog Synthetic / Checkly        | 8                                    |
| Argo Rollouts / Flagger            | 7→8 (gate + execution)               |
| Gremlin / LitmusChaos              | 8                                    |
| OpenTelemetry SDK                  | 8                                    |

---

## Связь с компонентами этого пакета

Этот документ — навигационная карта. Каждый компонент пакета покрывает свою часть:

- **`skills/rules-as-tests/SKILL.md`** + `references/overview.md` — общая 5-слойная рамка (применима к уровням 4, 5).
- **`templates/ts-server/`** — конфиги для серверного TS-стека (уровни 2, 3, 5, 6).
- **`packages/preset-next-15-canonical/templates/`** — React/Next.js конфиги (уровни 2, 3, 5, 6).
- **`agents/review-sidecar.md`** + **`living-docs-auditor.md`** (ours) + AIF's own **`rules-sidecar`** (reads `RULES.md`) — sub-agents для уровня 4. На этом уровне всегда работает `./scripts/audit-ai-docs.sh` + наши sub-agents; `/aif-verify` — обёртка AI-Factory поверх них, если вы её используете. (`best-practices-sidecar` is AIF's — KEEP-AIF; R-rule residue rides the `aif-rules-check` skill-context.)
- **`scripts/audit-ai-docs.sh`** — code-vs-docs probes (уровень 4 + 5).
- **`packages/core/templates/shared/integration-rules.md`** — IR1-IR6 для уровней 5 (Pact CI), 7 (can-i-deploy), 8 (observability propagation).
- **`references/self-testing-docs.md`** — детально про code-vs-docs probes как extension рамки на саму AI-документацию.

Если ты разработчик, читающий любой из перечисленных документов и потерял ориентир — вернись сюда, чтобы понять, где находишься.
