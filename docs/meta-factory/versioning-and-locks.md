# Meta-Factory: Воспроизводимость и lock-файлы

> Source: PROPOSAL.md §4 (split в Phase 1.D, 2026-05-07)
> Companion: [PROPOSAL.md](PROPOSAL.md) (overview)
>
> **Authoritative for:** reproducibility model — `rules-lock.json` schema + diff-mode upgrade flow + organization-level research-cache strategy.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Versioning strategy under semver — see [open-questions.md §13.13](open-questions.md). BC migration — see [open-questions.md §13.14](open-questions.md).

---

## 4. Воспроизводимость и lock-файлы

### 4.1 Проблема

Если установка дёргает интернет → каждый запуск даёт разные правила. Это анти-deterministic build, кошмар для CI и онбординга.

### 4.2 Решение — `rules-lock.json`

Аналог `package-lock.json`. Содержит:
- Зафиксированный набор сгенерированных правил с их content hash
- Метаданные research: версия стэка, источники, timestamp
- Validator metadata: что прошло, что было отклонено

**Поведение:**
- Первый запуск: research + generation + validation → lock-файл создаётся, коммитится в репо.
- Последующие запуски: read-only из lock'а. Воспроизводимо.
- Регенерация: только по явной команде `npm run rules:upgrade`, которая показывает diff и требует подтверждения.

**Имя файла — stack-scoped (GH #915 obs 2, #927):** `rules-lock.<framework>.json` (например `rules-lock.ts-server.json`, `rules-lock.react-native.json`); legacy-имя `rules-lock.json` используется только при `framework: null` (own-repo / empty-plan путь). Multi-stack consumer, прогоняющий bootstrap по стэку на один и тот же корень, получает кумулятивную машинную запись — по одному lock'у на стэк, каждый drift-check'ается строго против своего плана (`packages/core/installer/install.ts`, `lockNameOf`). До #927 единый `rules-lock.json` перезаписывался последним синтезированным стэком.

### 4.3 TTL и автоматический regen

При апгрейде версии в `package.json` (Next 16.2 → 16.3) postinstall hook замечает смену версии и предлагает:

```text
ℹ Next.js обновился: 16.2.1 → 16.3.0
ℹ Запустить research diff и предложить актуализацию правил? [Y/n]
```

Если `Y`: research-agent сравнивает changelog'и, выдаёт дельту, synthesizer актуализирует только затронутые правила, validator прогоняет, человек ревьюит diff в правилах.

### 4.4 Общий research-cache

Кеш research'а можно расшарить на уровне организации:
- `~/.rules-as-tests/cache/next/16.2.1.json`
- Отдельный CI job обновляет кеш по расписанию (раз в неделю)
- Команда переиспользует один и тот же research при установках

Это снимает проблему стоимости (десятки WebSearch на каждую установку → один централизованный pull раз в неделю).
