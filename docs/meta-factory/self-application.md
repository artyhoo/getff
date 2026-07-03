# Self-application как cross-cutting architectural invariant

> **Тип:** Reference-документ (shipped, не transient). Живёт после закрытия Phase 1.
> **Аудитория:** будущие фреш-сессии, контрибьюторы, оркестраторы Phase 2+.
> **Связи:** [EXECUTION-PLAN.md](EXECUTION-PLAN.md) §3.1, §3.2, §7 | [PROPOSAL.md](PROPOSAL.md) §2.2, §6 | [../audits/2026-05-07-self-application-gap.md](../audits/2026-05-07-self-application-gap.md) | [../audits/2026-05-06.md](../audits/2026-05-06.md)
>
> **Authoritative for:** self-application invariant table per L0-L5 layer + Spec discipline; Decision matrix Phase 1 (Decision matrix expansion lives in [open-questions.md §13.8](open-questions.md)); acceptance criteria per layer for closure of self-application gap.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Recursive self-application is a *quality signal* (GCC bootstrap precedent), not the goal — historical framing in this file as «central thesis» predates the 2026-05-09 goal-hierarchy fix.

---

## 1. Тезис self-application gap

Self-application gap — это **не технический долг**. Это фальсификация центрального тезиса пакета: «documents lie; tests don't». Когда фреймворк поставляет enforcement-инструменты потребителю, но не применяет их к себе, документация о принципах превращается в декларацию без доказательства.

На момент 2026-05-07 репо имело 4 непокрытых слоя локального enforcement:

| Слой | Что есть | Что отсутствует | Цена отсутствия |
|---|---|---|---|
| **Spec discipline** | `.claude/orchestrator-prompts/` директория | SHA-validation, проверка существования action | Фейковые SHA коммитятся (`rhysd/actionlint@<fake>` в batch-D); обнаруживается только IDE случайно |
| **Pre-commit** | `templates/shared/husky-pre-commit.sh` для потребителя | `.husky/pre-commit` в репо автора | Markdown >500 строк, broken bash синтаксис проходят в историю |
| **Pre-push** | `templates/shared/husky-pre-push.sh` для потребителя | `.husky/pre-push` в репо автора | actionlint/zizmor ошибки уходят в CI (итог: 3-fix cycle в PR #1) |
| **CI-as-self-test** | `audit-self.yml` — 4 job'а | job `framework-self-install` (E2E install.sh+setup.sh) | Регрессии в installer обнаруживает потребитель, не автор |

**Историческое свидетельство.** PR #1 (`feat/audit-fixes-2026-05`) потребовал трёх отдельных push-циклов для закрытия 16 zizmor-находок в `workflow-integrity.yml`. Причина — отсутствие pre-push hook'а с actionlint/zizmor. Это ровно тот паттерн (push → fail → diagnose → fix → push), который пакет декларирует решённым для потребителей.

---

## 2. Invariant table по слоям L0–L5 + Spec discipline

Self-application — **не отдельный шаг**, а cross-cutting invariant. Каждый слой мета-фабрики должен иметь explicit self-application clause и measurable acceptance criteria.

> **Design-target note (L5 self-diagnose):** the L5 row's *closure signal* «(c) `framework-self-diagnose` CI gate green; `diagnostics-log.json` valid against schema» — and the identical clause in the §7 Acceptance table — is **DESIGN-TARGET, not yet closed**: no `framework-self-diagnose` job exists in `.github/workflows/` (only `framework-self-install*` / `audit-self` / `discipline-self-check` / `framework-self-template-render` are wired), and no `diagnostics-log.json` emission is built. The L5 (a)/(b) install-verification signals are shipped; the (c) self-diagnostics signal is the intended design, tracked for future implementation — L5 is **not** to be read as fully closed on the strength of (c). The L5 self-diagnose aspiration stands; only its *achieved* status is corrected here.

| Слой | Self-application clause | Acceptance criteria |
|---|---|---|
| **L0 Invariant Core** | Принципы прогоняются как тесты против собственного `rules-manifest.json` в pre-commit/pre-push/CI | Автор не может закоммитить нарушение принципа; попытка блокируется `.husky/pre-commit` |
| **L1 Stack Detector** | Detector запускается на самом репо в CI; expected output зафиксирован snapshot-тестом | `setup.sh --stack=$(detect)` идемпотентен на собственном репо; snapshot стабилен ≥3 недели |
| **L2 Research Agent** | Research прогоняется на трёх источниках: `skills/rules-as-tests/SKILL.md` (entry-point), `skills/rules-as-tests/references/overview.md` (5-layer principles), `skills/rules-as-tests/references/ai-traps.md` (anti-patterns) | Все три источника семантически синхронизированы; drift detection возвращает 0 расхождений. Operationalization semantic-drift — TBD per [open-questions.md](open-questions.md) §13.7 (Phase 6); до Phase 6 — manual review при изменении любого из трёх источников |
| **L3 Rule Synthesizer** | Synthesizer регенерирует canonical Next 15 preset, diff сравнивается с live | Поведенческий diff с canonical ≤5%; генерация детерминирована (два запуска = один output) |
| **L4 Self-Validator** | Validator прогоняется на `rules-manifest.json` перед каждым CI run | Каждое существующее правило R1-R20 проходит все meta-tests; validator не пропускает тавтологии |
| **L5 Installer** | (a) `install.sh` + `setup.sh` запускается в CI на tmp-dir; результат проходит framework's own audits. (b) post-install meta-check (re-run L4 + disk artifact existence + lock ruleIds drift). (c) self-diagnostics emission — `install()` emits initial `diagnostics-log.json`; design per [self-diagnostics-design.md](self-diagnostics-design.md), implementation Phase 8.X | Job `framework-self-install` зелёный; артефакты tmp-потребителя проходят `audit-ai-docs.sh`; (c): `framework-self-diagnose` CI gate green; `diagnostics-log.json` valid against schema |
| **Spec discipline** | `.claude/orchestrator-prompts/` валидируются как код (SHA-check, action existence) | Невозможно закоммитить spec с фейковым SHA или несуществующим action-repo |

Эта таблица — **сердце документа**: фиксирует, что self-application не опциональная фича, а структурное требование к каждому компоненту.

---

## 3. Decision matrix Phase 1

Из [EXECUTION-PLAN.md §7](EXECUTION-PLAN.md) с расширенным rationale для каждой строки.

| Слой | Mode | Verdict | Rationale |
|---|---|---|---|
| Bash syntax | Hard fail (pre-commit) | **MUST** | Сломанный `.sh` не обнаруживается до первого запуска в CI. Стоимость <100ms, неисправность обнаруживается до коммита — нет оснований откладывать. |
| YAML/JSON parse | Hard fail (pre-commit) | **MUST** | Невалидный YAML ломает все workflow немедленно. Одно сломанное `audit-self.yml` делает невидимыми все последующие проблемы. <100ms стоимость. |
| Markdown ≤500 строк | Hard fail (pre-commit) | **MUST** | Собственный invariant shipped docs. Нарушение этого правила в собственных файлах фальсифицирует принцип «documents lie». Стоимость <100ms. |
| actionlint | Hard fail (pre-push) | **MUST** | Каждый workflow-дефект = red CI на всех PR. 4-цикл fix в PR #1 — прямое свидетельство того, что отсутствие pre-push дорого. ~200ms. |
| zizmor plain | Hard fail (pre-push) | **MUST** | Security-класс находок (permissions, injection). Не блокировать = нормализовать уязвимости. ~3s — приемлемо для pre-push. |
| Self-test pipeline | Hard fail (pre-push) | **SHOULD** | `audit-ai-docs.test.sh` занимает ~5s, ловит регрессии в probe-logic. SHOULD а не MUST: может иметь external dependency (python yaml), требует установки. |
| Manifest render drift | Hard fail (pre-push, scoped) | **SHOULD** | Drift между manifest.json и RULES.md — тот же класс «documents lie». Скоупировано на `*.json` + `*.md` diff. SHOULD: дорогостоящий typecheck. |
| Spec validation (SHAs) | Soft warn (pre-commit, scoped) | **MAY** | GitHub API rate-limit, требует `gh auth login`. Soft warn, не hard fail: контрибьютор без токена не должен быть заблокирован. |
| Framework-self-install | CI only | **MAY in CI** | ~30s, требует tmp-dir setup. Только CI: нет смысла запускать при каждом локальном push. MAY: не на критическом пути автора. |
| markdownlint-cli2 structural lint | Hard fail (pre-commit) | **MUST** | 4-criteria: failure-cost MEDIUM (markdown drift erodes doc-authority signal across 30+ canonical docs; detectability MEDIUM = structural violations are diff-visible but **not all reviewers notice list-indent or trailing-space drift in a 200-line PR**); local-cost LOW (~200ms, pre-commit); lifecycle-stage 1 (write-time). Shipped 2026-05-10 commit `80ef1d9`. |
| lychee offline link check | Hard fail (pre-push, scoped) | **SHOULD** | 4-criteria: failure-cost MEDIUM (broken cross-refs in canonical docs muddle reviewer cycles); local-cost LOW (~2s, scoped to changed `*.md` via `--offline`); detectability HIGH (lychee output explicit); lifecycle-stage 2 (push-time). SHOULD because lychee install is opt-in (cargo or brew dep; graceful skip when absent). Shipped 2026-05-10 commit `71a7f00`. |
| Harness-hook layer — UserPromptSubmit + PostToolUse | Real-time enforcement at tool-call time (Claude Code only; cross-editor parity WATCHLIST per SSOT #21) | **SHOULD** (project-side) / **MAY** (consumer-side) | 4-criteria: failure-cost HIGH (silent bypass at edit-time = the exact failure mode README §Why-this-exists targets); local-cost LOW (session-bound, no CI cost); detectability MEDIUM (hook fires post-tool, not pre-commit — operator sees within milliseconds but no permanent artifact for review); lifecycle-stage 5 (edit-time, new lifecycle stage). Promote SHOULD→MUST when 3 §13.28-shape incidents accumulate; promote MAY→SHOULD when cross-editor parity ≠ WATCHLIST. Shipped 2026-05-10/11 commits `5c0d32e` (UserPromptSubmit), `2e43874` (PostToolUse validate-prompt), `38dc50a` (PostToolUse principle-09). |
| Functional template-render audit | Hard fail (CI), deterministic only | **MUST in CI** | 4-criteria: failure-cost HIGH (template drift = silent breakage at consumer install-time); local-cost MEDIUM (~30-60s per CI run; deterministic only — no AI vendor secrets per «no-paid» invariant); detectability HIGH (rendered output is diff-visible against fixtures); lifecycle-stage 3 (CI-time). Re-evaluate LLM-judge promotion when deterministic <80% PASS rate OR Anthropic subscription expands to CI compute (per [closed-questions.md §13.27](closed-questions.md)). Shipped 2026-05-10/11 commits `f528586` (harness), `29e62d8` (install + probes), `5afabad` (CI gate). |
| Local advisory template-audit skill | Local advisory, NOT CI-gated, NOT blocking | **MAY** | 4-criteria: failure-cost LOW (paraphrase/cue-placement bugs are P2/P3/P5 from Wave 6 D-2 taxonomy, non-blocking); local-cost ZERO (Claude Code session-bound, free under subscription); detectability HIGH (semantic check by Claude); lifecycle-stage 1 (write-time advisory). Promote MAY→SHOULD when 3 paraphrase-bug incidents accumulate in production. Shipped 2026-05-11 commit `115b8ec`. |
| Operator-side `make validate-prompts` | Hard fail (Makefile target, manual) | **SHOULD** | 4-criteria: failure-cost MEDIUM (orchestrator-prompt spec drift muddles multi-session coordination); local-cost LOW (~1s per file via shared validate-batch-spec.ts); detectability HIGH (CLI output); lifecycle-stage 1 (write-time, operator-discretionary). SHOULD because target is operator-discretionary (not auto-invoked). Shipped 2026-05-11 commit `a008255`. |
| §13.23 4th-layer pre-push trailer check | Warn-only (30-day calibration, pre-push); flip to Hard fail after window | **SHOULD** (during calibration) → **MUST** (post-calibration) | 4-criteria: failure-cost HIGH (rule introductions without §1.7 forward+backward check landed silently for 6 months pre-Wave-7); local-cost LOW (~50ms per push, regex grep on commit body); detectability MEDIUM (pre-push hook output, not CI artefact); lifecycle-stage 2 (push-time). Calibration window 2026-05-11 → 2026-06-10; post-window flip per pre-push hook TODO comment. Shipped 2026-05-11 commit `8982fde`. |
| (meta-rule) No direct LLM API calls in CI | Architectural invariant — committable artifact required between LLM output and CI consumption | **MUST** | 4-criteria: failure-cost HIGH (CI compute cost + non-determinism + API key proliferation = three orthogonal risks); local-cost ZERO (architectural rule, no runtime cost); detectability LOW (no automated check — review-time discipline only); lifecycle-stage 3 (CI-design-time). Per «LLM-then-cache» pattern: all LLM operations are session-bound; CI reads only deterministic artifacts (JSON cache, snapshot, lock file). Codifies «no-paid» invariant per [research-patches/2026-05-11-llm-usage-audit.md](research-patches/2026-05-11-llm-usage-audit.md) §6. |
| Goal-phrase parity audit | Hard fail (pre-push), scoped to canonical README + downstream goal-bearing docs | **SHOULD** | 4-criteria: failure-cost MEDIUM (silent goal drift between README and downstream operational docs is the 2026-05-09 incident pattern); local-cost LOW (~100ms, bash grep on enumerated docs); detectability MEDIUM (probe is detection-based, not a structural lint — false positives possible at synonym-list edge); lifecycle-stage 2 (push-time, when goal-bearing doc edited). SHOULD because synonym list is hand-rolled and incomplete (m1 caveat closed in sub-wave 7.5.d). Shipped 2026-05-11 commit `2b0a505`. |

---

## 4. Эпистемологический разрыв

**Template path vs runtime path:**

```text
templates/shared/husky-pre-commit.sh   ← автор видит как ШАБЛОН
               ↓ install.sh копирует в потребителя
.husky/pre-commit                        ← потребитель видит как СВОЙ hook
```

Автор разрабатывает шаблон, тестирует его глазами и синтаксически. Но **никогда не запускает `install.sh` на собственном репо** → `.husky/` у него не создаётся → шаблон может быть сломан до того, как потребитель его установит.

Это не ошибка невнимательности — это **структурный разрыв**:

1. Автор создаёт шаблон в `templates/` → воспринимает его как «будущее чужого репо».
2. Нет механизма, который бы применил шаблон к текущему репо автоматически.
3. Gap нормализуется через «CI поймает» — и действительно ловит, но уже у потребителя или в post-push.

**Heuristic test (из EXECUTION-PLAN §3.1):** удалить из CI всё CI-specific. Что осталось — должно работать локально. Если разработчик не запускает это локально — self-application нет. Применительно к `audit-self.yml`: mechanical job, `audit-ai-docs.test.sh`, actionlint, zizmor — всё запускаемо одной командой локально. Не запускается не потому что нельзя, а потому что не сделано.

**Закрытие разрыва.** Phase 1 закрывает его явным шагом: создание `.husky/pre-commit` и `.husky/pre-push` непосредственно в репо автора, независимо от содержимого `templates/`. При расхождении — template обновляется, а не hook.

---

## 5. Связь с audit findings

### Finding F1 из `2026-05-06.md` — root cause не закрыт

F1 (артефакты в `src/`, `AGENTS.md`, `.mcp.json`) был закрыт удалением файлов. Но root cause — отсутствие pre-commit gate, блокирующего commit untracked-артефактов из tmp-запусков — остался открытым. Без `.husky/pre-commit` с проверкой bash/json/yaml патологическая ситуация воспроизведётся при следующем ad-hoc запуске тестов вручную в корне репо.

### Finding F3 из `2026-05-06.md` — R2 drift

R2 drift (три источника описывают правило по-разному: RULES.md, best-practices-sidecar, probe) закрыт по wording. Pre-commit gate с `manifest render drift` (§3 выше, SHOULD) предотвратит возникновение нового дрейфа: при любом изменении `factory/rules-manifest.json` рендер RULES.md проверяется автоматически.

### `2026-05-07-self-application-gap.md` — что новое здесь

Тот audit-snapshot (82 строки) фиксирует факт: «что сломано и как воспроизвелось в PR #1». Настоящий документ добавляет:
- Invariant table по всем 7 слоям (§2) с acceptance criteria — то, чего нет в snapshot'е.
- Decision matrix с rationale для каждой строки (§3) — snapshot только перечисляет gaps.
- Эпистемологический анализ разрыва (§4) — snapshot описывает симптом, не структуру.
- Anti-pattern deconstruction (§6) — в snapshot перечислены как антипаттерны без разбора.
- 6-month projection (§8) — в snapshot нет последствий.

### PR #1 timeline как evidence

3-fix cycle (push → zizmor fail → fix → push × 3) — конкретное измеримое доказательство того, что «CI поймает» не равно «достаточно». Каждый fix-cycle = один review-round потерян, один CI-minute сожжён, одна итерация добавлена к PR-хвосту. Без pre-push hook'а это не одноразовая ошибка, а **предсказуемый паттерн** при каждом workflow-изменении.

---

## 6. Anti-patterns которые gap нормализует

### «CI поймает»

**Deconstruction.** CI ловит ровно то же самое что pre-push, но за 60–90 секунд вместо <10 секунд, с ценой review-cycle вместо локального fail. Каждый CI-fix-cycle = один commit в истории с сообщением типа «fix: address zizmor finding». Таких коммитов в PR #1 — три. История репо кодирует паттерн «CI ловит то, что должен ловить pre-push».

### «Я смотрю diff перед push»

**Deconstruction.** Ручной diff-review — привычка, не систематический enforcement. Ломается на больших PR (28 файлов, 16 коммитов в PR #1), на context-switch, на усталости. zizmor нашёл 16 находок в файле, который автор читал несколько раз. Человеческий review дополняет инструменты, но не заменяет.

### «У меня IDE-плагины»

**Deconstruction.** IDE diagnostic однажды поймал `rhysd/actionlint@<fake-sha>` в batch-D. При следующем появлении того же паттерна диагностика была проигнорирована. Привыкание к IDE warning'ам — known phenomenon; единственная надёжная защита — hard-fail gate, которую нельзя проигнорировать.

### «Это small repo»

**Deconstruction.** «Small» не коррелирует с «low failure cost». 16 коммитов, 28 файлов, 8 batch'ей делегации, 4 workflow-файла — достаточная сложность для того, чтобы зависимости между файлами создавали не-очевидные дефекты. Кроме того, small repo — аргумент против sunk cost, не против enforcement.

### «Husky медленный»

**Deconstruction.** actionlint <200ms, zizmor 2–3s, bash syntax <100ms, `audit-ai-docs.test.sh` ~5s. Итого pre-push <10s. Это норма для pre-push. Сравни с одним CI-cycle: 60–90s ожидания + время diagnose + context-restore. Pre-push hook быстрее по совокупности в любом разумном сценарии.

---

## 7. Acceptance criteria — что считать решённым

Для каждого слоя — measurable signal закрытия.

| Слой | Closed when |
|---|---|
| **L0 Invariant Core** | `git commit` с нарушением принципа (broken bash в `.sh`) блокируется локально. Верифицируется: `echo "broken bash" > scripts/test.sh && git add . && git commit` — выход не 0. |
| **L1 Stack Detector** | `make self-audit` зелёный. Snapshot-тест детектора стабилен на протяжении ≥3 недель без ложных срабатываний. |
| **L2 Research Agent** | Команда `meta-factory research --self` завершается без drift-finding'ов между `skills/rules-as-tests/SKILL.md`, `references/overview.md`, `references/ai-traps.md` (см. §2 canonical list). |
| **L3 Rule Synthesizer** | `diff -r packages/preset-next-15-canonical /tmp/regenerated-preset` — поведенческий diff ≤5%. Два независимых запуска дают идентичный output. |
| **L4 Self-Validator** | Все правила R1–R20 проходят meta-tests в `packages/core/principles/`. Mutation-style проверка: сломать одно правило в manifest → соответствующий meta-test падает. Если не падает — meta-test тавтологичен. |
| **L5 Installer** | (a) Job `framework-self-install` в `audit-self.yml` зелёный. Артефакты tmp-потребителя проходят `bash tests/audit/audit-ai-docs.test.sh` с 0 FAIL. Верифицируется: намеренно сломать `install.sh` → job становится красным. (c) Job `framework-self-diagnose` зелёный; `diagnostics-log.json` проходит schema validation per [self-diagnostics-design.md §2](self-diagnostics-design.md). |
| **Spec discipline** | Попытка закоммитить spec с паттерном `<owner>/<repo>@<40-char-sha>` где SHA не верифицирован — выдаёт warn (pre-commit) или hard-fail (pre-push). `packages/core/spec-validation/validate-batch-spec.ts` существует и интегрирован. |

**Composite gate.** Phase 1 считается закрытой только если `make self-audit` зелёный **и** хотя бы один класс ошибок из §1 (spec/pre-commit/pre-push/CI) покрыт автоматическим enforcement'ом, не позволяющим ошибке пройти незаметно.

---

## 8. 6-month projection

Что произойдёт, если self-application gap не закрыть перед Phase 2+:

**Phase 2 (principles as meta-tests).** Без pre-commit gate тест может принять тавтологичное правило. Meta-test, который не падает при сломанном manifest — не meta-test, а театр. Без enforcement механизма это обнаружится только при manual review, если обнаружится вообще.

**Phase 3 (monorepo split).** Без `framework-self-install` job в CI — `install.sh` может сломаться в рамках split-рефакторинга. Узнаем от потребителя (которого пока нет) или из ручного тестирования.

**Phase 5 (validator).** К этому моменту в `rules-manifest.json` будет 30+ правил. Без систематического meta-test прогона часть из них тавтологична (negative test не ловит ничего). Validator будет создавать иллюзию покрытия.

**Phase 6 (research agent).** Без spec discipline в orchestrator-prompts `research-cache.json` может содержать fabricated SHA или несуществующие action-ссылки. Planner-Executor паттерн (L2 не имеет file write) защищает от prompt injection, но не от некорректных references в specs.

**Phase 7 (installer release).** Без `framework-self-install` CI job — релиз shipped с installer'ом, не проверенным на чистом потребителе. Первый реальный потребитель обнаружит сломанный install.sh.

**Systemic.** Каждая фаза без self-application добавляет технический долг, который обнаруживается позже и дороже. Наблюдаемый паттерн (PR #1, Finding F1, F3) — это не случайность, а предсказуемое следствие отсутствия enforcement'а. К Phase 7 накопленный drift между тем что декларирует пакет и тем как он разрабатывается станет структурным противоречием, не точечным дефектом.

---

**0.1.0** — 2026-05-07 (создан в Phase 0.5 step 1, ветка `chore/self-application`)
