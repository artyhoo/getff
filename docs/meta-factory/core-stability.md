# Meta-Factory: Граница invariant core — тесты на изменяемость

> Source: PROPOSAL.md §7 (split в Phase 1.D, 2026-05-07)
> Companion: [PROPOSAL.md](PROPOSAL.md) (overview)
>
> **Authoritative for:** invariant core stability boundaries — what is immutable, what may evolve under semver, CI `core-stability` job design, principle-immutability tests.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists).

---

## 7. Граница invariant core: тесты на изменяемость

(Ответ на открытый вопрос 3: «нужна граница для неизменяемого core, на это тоже можно тесты написать».)

### 7.1 Что значит «core invariant»

> **Design-target note:** пути ниже (`core/...`) описывают *целевой* слой из PROPOSAL.md §7 (pre-monorepo layout), не текущую построенную структуру — актуальный код живёт под `packages/core/`, и `core/generic-rules/R1.json` не существует. См. аналогичную оговорку в [architecture.md](architecture.md#L7).

Файлы и компоненты, изменение которых требует **major version bump** мета-фабрики и явного review:
- `core/principles.md`
- `core/manifest-schema.json`
- `core/validator/*.ts`
- `core/audit-self/*.sh`
- `core/generic-rules/R1.json` — R10.json (стэк-независимые)

### 7.2 Тесты на core stability

> **Design-target note (§7.2 + §7.3):** the CI job `core-stability` + `core.lock` artifact (§7.2) and the `core/principles.test.ts` principle-immutability gate (§7.3) are the *target* design from PROPOSAL.md §7 — **not yet built** (git grep confirms no `core-stability` job in `.github/workflows/`, no `core.lock`, no `core/principles.test.ts`). This is the intended stability boundary, tracked for future implementation; do not treat it as a currently-active CI gate. (Same design-target caveat as the `core/...` paths in §7.1.)

CI job `core-stability`:
1. Hash content всех `core/**` файлов → `core.lock`.
2. На каждом PR: пересчитывает hash. Если что-то изменилось в `core/` без явного флага `core-change: approved` в PR description — CI падает.
3. При изменении core: автоматический trigger полного regression test suite — на canonical examples (Next 15, TS-server) перегенерируется output, сравнивается с baseline. Любая регрессия в behavior блокирует merge.

### 7.3 Тесты на immutability принципов

Отдельный `core/principles.test.ts`:
- Парсит `core/principles.md`
- Проверяет наличие 5 layer'ов (regex)
- Проверяет наличие meta-rules (every rule has executable check, etc.)
- Если кто-то удалил пункт — тест падает

Это **жёсткий guard** против тихого размывания принципов («drift из MUST в should», см. ai-traps lesson #6).

### 7.4 Версионирование core

Semver для самой мета-фабрики:
- **Major**: меняется core (принципы, schema, validator API)
- **Minor**: добавлены новые presets, расширен research, добавлены generic rules
- **Patch**: bug fixes в generators, обновления research-cache

Major bump = breaking change для всех проектов, использующих мета-фабрику. Это редкое событие, требующее migration guide.
