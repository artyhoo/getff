# Meta-Factory: Acceptance test = self-test через 5 слоёв

> Source: PROPOSAL.md §6 (split в Phase 1.D, 2026-05-07)
> Companion: [PROPOSAL.md](PROPOSAL.md) (overview)
>
> **Authoritative for:** acceptance test design — installer self-validates through the 5-layer enforcement framework; reproduction scenario for canonical Next 15; acceptance test for invariant core itself.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists).
>
> **Implementation status** — this doc specifies *target* acceptance scenarios (from the PROPOSAL.md §6 split), NOT a claim that all of them are currently runnable. Some scenarios exercise **DESIGN-TARGET CLIs** — e.g. `meta-factory upgrade --to …` — that are **not yet implemented** (the `meta-factory` bin is a placeholder stub). These are acceptance targets to build against, not current capabilities; the self-test-through-5-layers design is the intended goal, tracked for future implementation.

---

## 6. Acceptance test = self-test через 5 слоёв

(Ответ на открытый вопрос 6: «отличный пример meta-testing — установился, проверил себя 5 слоями».)

### 6.1 Идея

Self-application invariant действует **с момента 0** — самим фактом разработки фабрики, а не только при установке у потребителя. Установка — лишь **последняя точка верификации** уже-существующего invariant: фабрика прогоняет на себе все свои же 5 слоёв, доказывая корректность до того как окажется в руках потребителя.

| Слой | Что проверяется на себе |
|---|---|
| L1 Architecture | Сгенерированные правила соблюдают layer boundaries в самом сгенерированном коде |
| L2 Meta-tests | Каждое правило имеет negative test; validator уже прогнал их |
| L3 Spec by Example | Examples (bad/good) в manifest исполняемы — bad ловится правилом, good проходит |
| L4 Mutation | Stryker мутирует сгенерированные AST-правила, тесты должны убивать мутантов |
| L5 Living Docs | RULES.md сгенерирован из manifest — автоматически синхронизирован |

Если **любой** слой падает — установка считается **некорректной**, фабрика выдаёт отчёт и предлагает:
- Откатить
- Перегенерировать только провалившиеся правила
- Перейти в human review

### 6.2 Ценность

Это не отдельный test suite — это **тот же набор инвариантов**, который применяется к проекту пользователя. Фабрика **доказывает свою правомочность** на самой себе.

Как сказал пользователь: «установился сразу проверил себя что все ок всеми 5 слоями» — это и есть acceptance criterion для самой установки.

### 6.3 Acceptance test для самого core

**Обязательное требование:** автор не имеет права релизить core без работающего acceptance test'а — без него нечем доказать корректность всей последующей мета-фабрики. Согласно [self-application.md](self-application.md) §8 («6-month projection»): к Phase 7 без acceptance test'а core будет shipped с broken installer. Тезис: **«генератор воспроизводит canonical example»**.

Сценарий:
1. Берём текущий `rules-as-tests-aif` для Next 15 — это canonical example.
2. Запускаем мета-фабрику на чистом проекте Next 15.
3. Сравниваем сгенерированный output с canonical.
4. Ожидаем: эквивалентность по поведению (не по символьному совпадению).

Если генератор генерит что-то качественно отличное от canonical — это сигнал, что либо canonical устарел, либо генератор работает неправильно. В любом случае — повод разобраться.

Аналогично — **на апгрейде**:
1. Берём canonical Next 15.
2. Запускаем `meta-factory upgrade --to next@16.2`.
3. Сравниваем с тем, как мы вручную обновили бы canonical под Next 16.
4. Diff = область для improvement генератора.

Это превращает текущий пакет из «застывшего шаблона» в **золотой стандарт** для тестирования генератора.

> Полный invariant table по слоям и acceptance criteria — в [self-application.md](self-application.md) §2 и §7.
