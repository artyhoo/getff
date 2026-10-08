# Quota reporting + Burn mode — reference

> **Authoritative for:** the quota-message format shown to the user, and the full burn-mode protocol (explicit trigger, scope, exit).
> **NOT authoritative for:** the zone thresholds and what to track — see [../SKILL.md](../SKILL.md) §Quota monitoring. Project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists).

> Тело SKILL.md держит зоны-светофор и что отслеживать; здесь — формат сообщений пользователю и полный burn-mode протокол.

## Как сообщать пользователю о квоте

**При смене зоны** — одна строка в начале следующего отчёта:

```text
🟡 Quota: Sonnet ~180k (yellow), Opus ~25k. Переключаюсь на Mode B для оставшихся батчей.
```

**Не выводить per-batch**, если зона не сменилась — это шум.

**В финальном отчёте umbrella** — компактная таблица (раунд / Sonnet / Opus / зона).

## Burn mode (явное переключение по сигналу пользователя)

**Старшая НЕ может автономно определить когда пора жечь Opus.** Не видно: остатка квоты, времени до reset, активности других сессий. Burn mode = только по явному сигналу.

### Триггеры включения

- «жги опус», «burn opus», «по максимуму», «не экономь»
- «до reset недолго», «скоро сброс»
- «opus много осталось», «sonnet полный»
- «делай thorough», «не спеши»

При триггере старшая немедленно подтверждает одной строкой: _«Burn mode активирован: thorough analysis, чтение в моём контексте, длинные deliverables.»_

### Поведение в burn mode

| Что                       | Norma                                        | Burn mode                                                  |
| ------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| Чтение исходников         | Делегировать через Agent                     | **Читать самой** в свой контекст                           |
| Длина ответа              | Краткие bullets                              | Длинные с примерами, обоснованиями                         |
| Архитектурный анализ      | Поверхностный, делегировать                  | Глубокий, multi-file synthesis                             |
| Документы (audits, plans) | Короткие                                     | Comprehensive с decision matrix'ами                        |
| Initiative                | Только по запросу                            | Предлагать backlog Opus-задач                              |
| Mode A inline (Opus)      | Дефолт для execution + research, без избытка | Развёрнутые промты, multi-step follow-ups, thorough audits |

### Backlog задач которые имеет смысл жечь Opus'ом

1. **Security audits** — adversarial reading кода, поиск vulnerabilities
2. **Architecture review** — multi-file pattern detection
3. **Plan vs code drift analysis** — diff между планом/ТЗ и реализацией
4. **Strategic readiness review** — что покрыто, gap, риски
5. **Comprehensive doc consolidation** — глубокий slim с пониманием nuance
6. **Adversarial test case design** — XSS payloads, race conditions, edge cases
7. **Library upgrade planning** — анализ deprecation paths, breaking changes
8. **Performance audit** — N+1 queries, missing memoization, large bundle imports
9. **Pre-emptive Sonnet-промты** — заранее писать file-prompts для будущих задач
10. **Lessons-learned consolidation** — синтез паттернов в новые rules/skills

### Триггеры выключения

- «хватит», «stop», «эконом», «опус кончается», «достаточно»
- 429 в любом tool call
- `/clear` (новая сессия — burn сбросится)
- Cumulative my Opus в сессии превысил 100k (sanity cap)

### При неясности — спросить ОДИН раз

Если в начале сессии есть выбор burn vs normal и **большая umbrella задача**:

```text
В каком режиме работаем?
1. Normal — Mode A на Opus дефолт; делегируем inline, к Mode B (Sonnet) уходим только при нагрузке на Opus-пул (стандарт)
2. Burn — много Opus и скоро reset, не экономим: глубокий анализ, длинные deliverables, всё в своём контексте
```

Не спрашивать если: задача мелкая, явный сигнал есть, или вопрос неуместен.

### Anti-patterns burn mode

- ❌ Бесконечно генерить filler чтобы «потратить токены». Burn ≠ make-work.
- ❌ Игнорировать sanity cap (100k моих Opus).
- ❌ Продолжать burn после exit-триггера.
- ❌ Burn НЕ означает «забыть про правила».
