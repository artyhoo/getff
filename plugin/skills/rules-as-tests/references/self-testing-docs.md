# Self-testing documentation — AGENTS.md правила как исполняемые тесты

> Каждое правило в AGENTS.md, которое можно формализовать, должно иметь bash-проверку в `scripts/audit-ai-docs.sh`. Drift и code-vs-docs decay ловятся одной командой за 5-10 секунд.

Этот документ — применение рамки «Правил как тестов» **к самой AI-документации**. Тот же принцип, что для production-кода: правило либо исполняемо, либо не правило. Только здесь объект энфорсмента — `AGENTS.md` / `CLAUDE.md` / `.claude/skills/` / `.claude/rules/`.

Этот подход разработан в реальной практике (см. аудит-скрипты в проектах sisters-sphere и artyhoo-cv); здесь — обобщённая форма, которую можно переносить.

> **Authoritative for:** «rules-as-tests applied to AI documentation» pattern — `audit-ai-docs.sh` design, code-vs-doc probe pairing, negative-test pairing for AGENTS.md rules.
> **NOT authoritative for:** framework's project goal — see [README.md#why-this-exists](https://github.com/artyhoo/getff/blob/main/README.md#why-this-exists). Doc-vs-doc authority drift (separate failure mode) — see [.claude/rules/doc-authority-hierarchy.md](https://github.com/artyhoo/getff/blob/main/.claude/rules/doc-authority-hierarchy.md). AI-doc organization — see [doc-organization.md](doc-organization.md).

---

## Зачем

Стандартные drift-проверки (§drift detection в `doc-organization.md`) проверяют, что **файлы существуют**: skill упомянут в AGENTS.md → есть ли соответствующая папка в `.claude/skills/`?

Этого недостаточно. Файл может существовать, но **код давно перестал соответствовать правилу**. Это — _decay_, и его не ловит ни один существующий drift-чекер.

Решение: **code-vs-docs probes**. Каждое правило AGENTS.md, которое можно формализовать через grep/awk, превращается в bash-проверку в `audit-ai-docs.sh`. Скрипт прогоняет все probes за 5-10 секунд, exit 0 (PASS) или 1 (FAIL).

```text
AGENTS.md «Rule N: <правило>»
            ↓
scripts/audit-ai-docs.sh §[probe N]: grep/awk проверка
            ↓
exit 0 (PASS) | 1 (FAIL) | 0+WARN (decay-watch)
```

Запускается на трёх уровнях:

1. **`/aif-verify`** через `living-docs-auditor` sub-agent — перед PR.
2. **Pre-push hook** (`.husky/pre-push`) — до того, как код покидает машину.
3. **CI on PR** — required check, не даёт мерджить, если не PASS.

---

## Каталог типичных probes

Каждый probe имеет три части: **detect** (найти кандидатов), **filter** (исключить exception'ы), **assert** (PASS если пусто, FAIL иначе).

### Probe 1: «Все Server Actions начинаются с requireUser()»

```bash
# Detect: все файлы с экспортом async function в actions/
# Filter: исключить файлы, в которых первая строка функции содержит requireUser
# Assert: пусто = PASS

BAD=$(grep -rn "^export async function" src/app/actions/ \
  | while read line; do
      file=$(echo "$line" | cut -d: -f1)
      lineno=$(echo "$line" | cut -d: -f2)
      # Проверить что в первых 3 строках после объявления есть requireUser
      next3=$(awk "NR>=$lineno && NR<=$((lineno+3))" "$file")
      echo "$next3" | grep -q "await requireUser()" || echo "$line"
    done)

[ -z "$BAD" ] && echo "PASS: Rule 1" || { echo "FAIL: Rule 1: $BAD"; exit 1; }
```

### Probe 2: «Никаких прямых вызовов supabase admin клиента вне actions/api»

```bash
LEAK=$(grep -rn "from.*supabase/admin" src/ \
  | grep -v "src/app/actions/" \
  | grep -v "src/app/api/")

[ -z "$LEAK" ] && echo "PASS: Rule 2" || { echo "FAIL: Rule 2: $LEAK"; exit 1; }
```

### Probe 3: «redirect() не должен вызываться из try/catch»

Сложнее — нужен AWK для structured-проверки function bodies:

```bash
VIOL=""
for f in $(grep -rl "redirect(" src/); do
  out=$(awk '
    /try \{/ { intry=1; trystart=NR }
    /\} catch/ { intry=0 }
    /redirect\(/ {
      if(intry) print FILENAME":"NR": redirect inside try/catch (try started at "trystart")"
    }
  ' FILENAME="$f" "$f")
  [ -n "$out" ] && VIOL="$VIOL\n$out"
done

[ -z "$VIOL" ] && echo "PASS: Rule 3" || { echo "FAIL: Rule 3: $VIOL"; exit 1; }
```

### Probe 4: «Каждый action с FormData обязан вызывать isHoneypotFilled»

```bash
VIOL=""
for f in src/app/actions/*.ts; do
  out=$(awk '
    /^export async function/ {
      fn=$4; sub(/\(.*/,"",fn); start=NR; has_fd=0; has_hp=0;
    }
    /formData: FormData/ { has_fd=1 }
    /isHoneypotFilled/ { has_hp=1 }
    /^}/ {
      if(start && has_fd && !has_hp) print FILENAME":"start": "fn
      start=0; has_fd=0; has_hp=0;
    }
  ' FILENAME="$f" "$f")
  [ -n "$out" ] && VIOL="$VIOL\n$out"
done

[ -z "$VIOL" ] && echo "PASS: Rule 4" || { echo "FAIL: Rule 4: $VIOL"; exit 1; }
```

### Probe 5: «Конфиг X должен содержать Y»

```bash
grep -q "dangerouslyAllowLocalIP" next.config.ts \
  && echo "PASS: Rule 5" \
  || { echo "FAIL: Rule 5: missing dangerouslyAllowLocalIP in next.config.ts"; exit 1; }
```

### Probe 6 (decay-watch): «Миграция X должна быть выполнена к дате Y»

Не блокирует CI, но выдаёт WARN:

```bash
if ls supabase/migrations/*role* 2>/dev/null; then
  echo "PASS: Rule 6 (migration exists)"
else
  echo "WARN: Rule 6 — role migration overdue, deadline 2026-06-01"
fi
```

---

## Обязательное правило: negative test для каждого probe

**Probe без negative test не считается реализованным.** Если регекс случайно сломан (например, забыл escape `\$`), — probe всегда вернёт PASS, и никто не заметит.

Procedure для каждого probe:

1. **Реализовать probe.**
2. **Ввести искусственное нарушение** в код (закомментировать `requireUser()` в одном файле, например).
3. **Прогнать probe.** Ожидаем `FAIL`.
4. **Если PASS — probe сломан**, чинить.
5. **Откатить искусственное нарушение.**
6. **Прогнать ещё раз.** Ожидаем `PASS`.

Это можно автоматизировать в test-suite самого audit-скрипта:

```bash
# tests/audit-ai-docs.unit.sh
# Проверка что каждый probe ловит специально внесённое нарушение

test_probe_R1() {
  # Создать временное нарушение
  cp src/app/actions/example.ts /tmp/example.bak
  sed -i.bak 's/await requireUser()/\/\/ await requireUser()/' src/app/actions/example.ts

  # Запустить только probe R1.
  # Важно: имя probe — R<N>, не голое число. audit-ai-docs.sh парсит --only=R1,
  # сравнение строкой, --only=1 не сматчится ни с одним probe и тест пройдёт ложно.
  if ./scripts/audit-ai-docs.sh --only=R1 > /dev/null 2>&1; then
    echo "FAIL: probe R1 should have caught the violation"
    cp /tmp/example.bak src/app/actions/example.ts
    return 1
  fi

  # Откатить
  cp /tmp/example.bak src/app/actions/example.ts
  rm /tmp/example.bak
  echo "PASS: probe R1 correctly catches violation"
}
```

Эти negative tests прогоняются раз в неделю или при изменении самого `audit-ai-docs.sh`. Не на каждый коммит — иначе тратят time.

---

## Гайдлайны для probes

- **Один probe = одно правило AGENTS.md**. Не объединять.
- **Имя probe = имя правила** («Rule 14: verifyImageMagicBytes used», не «check 14»).
- **AWK для structured проверок** (function bodies, blocks). Grep — для простых строк/импортов. Никаких регексов через `sed` — нечитаемо.
- **False positives ловятся фильтрами `grep -v`** или explicit-исключениями через переменные.
- **Когда правило имеет documented exception** («всё кроме X») — exception в скрипт явно через переменную, не зашитой строкой.
- **Exit codes стандартные**: 0 — все PASS, 1 — хотя бы один FAIL. WARN не влияет на exit.
- **Output формат**: `PASS: Rule N` / `FAIL: Rule N: <details>` / `WARN: Rule N: <details>`.
- **Запускается за 5-10 секунд на типовой кодовой базе.** Если дольше — оптимизировать.

---

## Когда правило НЕ self-testable

Не каждое правило формализуемо. Эти оставляем в AGENTS.md, но **не пытаемся проверить в audit-скрипте**:

- **Семантические** («код должен быть читаемым») — не формализуемо.
- **UX правила** («показать понятную ошибку») — нужна manual QA.
- **Правила про процесс** (Conventional Commits) — отдельным linter'ом (commitlint).
- **Правила требующие runtime data** (RLS policy enforcement) — отдельным integration test.

Для таких → пометить в AGENTS.md как **«проверяется глазами»** или **«проверяется в integration test»** — чтобы не было иллюзии автомата.

---

## Дисциплина поддержки

- **Новое AGENTS.md правило** → новый probe в audit-скрипте (если formalisable).
- **Удалили правило** → удалить probe.
- **Правило поменялось** → обновить probe + negative test.
- **Без negative test probe не считается реализованным** — иначе можно тихо сломать regex и думать что всё PASS.

Скрипт сам — документация. Каждый probe в нём = строка в AGENTS.md. Расхождение видно сразу при code review (PR изменил правило, не обновил probe).

---

## Continuous validation — три уровня

| Уровень                          | Кто запускает        | Когда падает                         | Защищает от                                   |
| -------------------------------- | -------------------- | ------------------------------------ | --------------------------------------------- |
| **Local** (`npm run audit:docs`) | Разработчик перед PR | Если забыл — drift доходит до review | Пропуск                                       |
| **Pre-push** (`.husky/pre-push`) | `git push`           | Автор знает до создания PR           | `--no-verify` обходимо, но в среднем работает |
| **CI on PR**                     | GitHub Actions       | reviewer видит red CI, не мерджит    | Authoritative gate, не обходимо               |

Для соло-проекта — local достаточно. Для команды → CI обязательно. **Pre-push — компромисс между скоростью и надёжностью** (~10 сек к каждому push).

### `npm run audit:docs`

В `package.json`:

```json
"scripts": {
  "audit:docs": "bash scripts/audit-ai-docs.sh",
  "audit:docs:react": "bash scripts/audit-ai-docs.react-next.sh"
}
```

### `.husky/pre-push`

```bash
echo "▶ Audit AI documentation..."
npm run audit:docs || {
  echo "AI-docs audit failed. Run npm run audit:docs locally and fix."
  exit 1
}
```

### CI on PR

```yaml
- name: Audit AI documentation
  run: npm run audit:docs
```

---

## Sub-agent: living-docs-auditor

В AIF под `/aif-verify` подключается `living-docs-auditor` sub-agent, который:

1. Прогоняет `audit-ai-docs.sh`
2. Парсит вывод
3. Для каждого FAIL формулирует human-readable объяснение со ссылкой на конкретное правило в AGENTS.md
4. Если все PASS — выдаёт «VERDICT: ALL PROBES PASSED»

См. `agents/living-docs-auditor.md` в этом пакете.

---

## Антипаттерны

- ❌ **Только CI без local команды** — slow feedback loop, разработчик не знает где упало.
- ❌ **Audit с `set +e`** (продолжать после FAIL) — теряется первый красный, agent видит warnings вперемешку.
- ❌ **Audit без negative test** — фильтр grep случайно сломан, всё PASS, никто не замечает.
- ❌ **Probe который проверяет только «файл существует»** — это §drift detection, не code-vs-docs consistency.
- ❌ **Regex с backreferences без тестов** — отлично работает 99% случаев, ломается на edge case.
- ❌ **Probe в десятки строк для одного правила** — если так сложно, правило не подходит для self-testing, оставить «глазами».
- ❌ **Comment'ы в bash вместо имён функций** — `# rule 14` не ищется через grep, function `probe_rule_14_verify_magic_bytes()` — ищется.

---

## Связано

- `references/doc-organization.md` — hot/cold split AGENTS.md, drift detection §5.1-5.5.
- `agents/living-docs-auditor.md` — sub-agent, который запускает audit-скрипт под `/aif-verify`.
- `packages/core/audit-self/audit-ai-docs.sh` — эталон серверного TS.
- `packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh` — эталон UI-стека.
- `references/overview.md` Layer 5 — Living Documentation как принцип, частным случаем которого является self-testing AI documentation.
