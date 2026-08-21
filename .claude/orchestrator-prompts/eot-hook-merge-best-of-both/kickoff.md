# Kickoff — EOT hook: merge best-of-both (#81 `cfa28a3` vs `d695ac5`+redesign)

> Открой новую Claude Code сессию на **Opus**. Это **evaluation + merge-design session**. Цель — НЕ «откатить #81» и НЕ «принять мою ветку as-is», а **оценить обе ветки, понять что лучше в каждой, и слить лучшее**. Деливерабл: merged-hook дизайн + (по явному ОК maintainer) реализация + чистый PR. **При любой неясности или вопросе — СПРАШИВАЙ maintainer, не угадывай** (его прямая инструкция 2026-05-21).

> **Status:** ARMED. Drafted 2026-05-21.
> **Authoritative for:** scope этой merge-сессии — инвентарь трёх версий хука, центральный вопрос про delivery-семантику, best-of-both критерии, git-расклад.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Дизайн редизайна (session-anchor / dual-audience) — см. [research-patch 2026-05-21-end-of-turn-hook-redesign.md](../../../docs/meta-factory/research-patches/2026-05-21-end-of-turn-hook-redesign.md).

---

## §0 Step 0 — обязательное чтение

1. [README.md#why-this-exists](../../../README.md#why-this-exists) — цель (хук — её страж в живой сессии).
2. [.claude/session-bootstrap.md](../../../.claude/session-bootstrap.md) — goal-anchoring (хук — runtime-аналог).
3. [.claude/rules/no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — хук НЕ зовёт платный LLM.
4. [.claude/rules/dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md) — `@cc-only-rationale`.
5. [.claude/rules/ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) §2 — T2/T3/T11/T15/T16.
6. [research-patch 2026-05-21-end-of-turn-hook-redesign.md](../../../docs/meta-factory/research-patches/2026-05-21-end-of-turn-hook-redesign.md) — дизайн редизайна + prior-art + decision-needed D1–D7.
7. Прочти ВСЕ ТРИ версии хука целиком (см. §2 за git-рефами).

---

## §1 Почему эта сессия

Хук **разошёлся на три версии** (branch-state drift, [[orchestrator-branch-state-drift]]). Maintainer (2026-05-21): **не отменять #81 вслепую — оценить, что сделано в каждой, посмотреть как лучше, и слить, взяв лучшее с обеих.** Это reviewer-discipline в действии: какая версия «побеждает» по каждой оси — это решение, которое нельзя принять автопилотом; где неясно — спрашивай.

---

## §2 Три версии — инвентарь (читай каждую целиком по рефу)

| Версия | Где | Branch-логика | Delivery | Recap-формат |
|---|---|---|---|---|
| **#81 `cfa28a3`** | **на `origin/main`** (merged PR #81) | **3 ветки**: `trigger_report` / `trigger_question` / оба | `systemMessage: $msg` (текст recap'а в systemMessage), `reason:` статичный | **ФОРС видимого блока** «## 🟢 Простыми словами»; Layer 1 (5 нумерованных строк) + Layer 2 |
| **`d695ac5`** | `chore/ssot-karpathy-skills-ref` (живой хук, что гоняет maintainer) | **2 ветки**: `long_text` / `asked` (long выигрывает у question) | `reason: $msg` (текст в reason), `systemMessage:` статичный + **коммент «Verified against CC docs: systemMessage НЕ доходит до модели, recap ОБЯЗАН идти в reason»** | «Прежде чем остановиться», bullets, НЕ форсит видимый блок |
| **`695e412`** (редизайн) | `feat/eot-hook-anchor` (запушена) + `cf650d4` на chore | = `d695ac5` 2 ветки | = `d695ac5` (`reason: $msg`) | = `d695ac5` + **session-goal anchor (aiTitle)** + **first-2-lines drift-вердикт НА ЦЕЛИ/УВЕЛО/СВЕРНУЛ** + **Branch B recommendation-first + fork-challenge** |

Точный diff: `git diff cfa28a3 d695ac5 -- .claude/hooks/end-of-turn-reminder.sh` и `git diff d695ac5 695e412`.

---

## §3 ЦЕНТРАЛЬНЫЙ load-bearing вопрос — delivery-семантика (verify, НЕ assume)

**#81 и `d695ac5` сделали ПРОТИВОПОЛОЖНЫЕ предположения о полях Stop-хука:**
- #81 кладёт recap-текст в **`systemMessage`** (значит автор считал, что systemMessage виден где надо).
- `d695ac5` кладёт recap-текст в **`reason`** с комментом «systemMessage НЕ доходит до модели».

Один из них неправ. Это нельзя решать из головы (T3). **Установи фактически:**
1. Что делает `reason` при `decision:"block"` — доходит ли до модели? **Эмпирическая зацепка:** в сессии-родителе (2026-05-21) живой `d695ac5`-style хук (`reason:$msg`) сработал, и инструкция recap'а **дошла до модели** (модель написала «## 🟢 Простыми словами»). → `reason` доходит. Перепроверь и зафиксируй с цитатой.
2. Что делает `systemMessage` — показывается ли пользователю в UI? Доходит ли до модели?
3. **Можно ли использовать ОБА** — `reason` (инструкция модели) + `systemMessage` (короткая заметка человеку)? Если да — это и есть «лучшее с обеих»: модель получает задание, человек видит маркер.

**Источник истины (no paid LLM):** claude-code-guide агент (если доступен в orchestrator-сессии; **из Worker-сабагента НЕ наследуется** — [[claude-code-guide-worker-inaccessible]]) ИЛИ WebFetch официальных CC hooks docs + DeepWiki. Любой claim — с цитатой/ссылкой (T11/T12). **Неясно после проверки → спрашивай maintainer.**

---

## §4 Best-of-both — что оценить по каждой оси

Для каждой оси: какой вариант лучше служит цели (anti-drift recap, в первую очередь для ИИ, но видимый человеку), и почему. Где обе хороши — комбинируй.

1. **Видимый блок «## 🟢» (#81) vs невидимый (d695ac5/редизайн).** Форс-видимый напрямую служит dual-audience-цели maintainer'а (человек видит recap на лету). Редизайн её обронил, понадеявшись, что модель сама напишет видимо. **Вопрос:** вернуть форс-видимый блок? Совместим ли он с `reason`-доставкой (модель пишет видимый блок) ИЛИ нужен `systemMessage` для гарантии видимости?
2. **3 ветки (#81) vs 2 ветки (d695ac5).** Нужна ли отдельная ветка «report+question одновременно», или «long выигрывает у question» проще и достаточно?
3. **Session-anchor + drift-вердикт + recommendation-first (только в редизайне).** Это net-new и желаемое (одобрено D1–D2). Сохранить.
4. **Statelessness / надёжность.** ВСЕ версии stateless (нет /tmp). Не сломать. PR #73 (aggregation/isMeta/`//-1`) — не возвращать.
5. **Layer1/Layer2 нумерованный формат (#81) vs bullets (редизайн).** Какой лучше вынуждает конкретику, а не воду (anti-театр)?

**Идеальный мёрж (гипотеза для проверки, не предрешение):** `reason`-доставка (модель получает) + форс-видимый «## 🟢» блок (человек видит) + session-anchor + drift-вердикт + recommendation-first Branch B + опц. короткая `systemMessage`-заметка человеку. Проверь, что это технически работает, прежде чем закладывать.

---

## §5 Деливерабл и git-гигиена

1. **Дизайн merged-хука** (research-patch апдейт или новый), с обоснованием по каждой оси §4 + ответом на §3.
2. **По явному ОК maintainer** — реализация merged-хука + **чистый PR в main**, который:
   - **supersedes #81** (если §3 подтвердит, что #81 `systemMessage`-доставка не доходит до модели → #81 фактически багнут);
   - **НЕ тащит drive-by `c470873`** (SSOT #49 Karpathy — неродственная работа с chore). Текущая `feat/eot-hook-anchor` его тащит И конфликтит с main — НЕ PR'ить как есть; пересобрать чисто от `origin/main`.
   - §1.7 Forward/Backward (H3 `###`; file:line в ОБЕИХ секциях — [[s17-substance-arm-file-line-citations]]).
3. **Спрашивай maintainer** на форках: supersede #81 (откат merged-работы — reviewer-discipline §2), видимый-блок vs нет, 3 vs 2 ветки.

---

## §6 Текущий git-расклад (чтобы не запутаться)

- `origin/main` — несёт **#81 `cfa28a3`** (3 ветки, systemMessage, форс-видимый блок).
- `chore/ssot-karpathy-skills-ref` (живой checkout `/Users/art/code/rules-as-tests-aif`) — `d695ac5` (живой хук) + `cf650d4` (редизайн поверх). Рабочее дерево гоняет редизайн-хук **прямо сейчас**.
- `feat/eot-hook-anchor` (запушена на origin) = `c470873`(drive-by) + `d695ac5` + `695e412`. **Конфликтит с main** (хук + prior-art-evaluations.md), тащит лишний коммит. **НЕ мёржить как есть.** Можно переиспользовать как сырьё или удалить и пересобрать.
- `feat/eot-hook-session-anchor` — пустой огрызок прошлой попытки (off origin/main, без коммитов), можно игнор/удалить.

**НЕ переписывай историю `chore` и `main`** — параллельная работа, другие сессии могут быть на них. Свои `feat/*` ветки переписывать/force-push'ить — можно.

---

## §7 Hard constraints

- Хук — **bash, CC-native, без платного LLM**. Сохранить `@cc-only-rationale`.
- **Stateless-fire не ломать** (нет /tmp; нет aggregation/isMeta/`//-1` — PR #73 reject).
- Реализация/PR — **только по явному ОК maintainer**. Дизайн — сначала.
- Worktree обязателен, если параллелишь.
- **При неясности — СПРАШИВАЙ** (явная инструкция maintainer; не угадывай форки).

## §8 AI laziness traps (active)
T2 (прогоняй версии, не «would»), T3 (delivery-семантику §3 — фактом+цитатой, не из головы), T11/T12 (CC docs до claim о полях хука), T15 (self-application: merged-хук сам должен пройти свой «объясни просто» тест), T16 (не матчить #81/d695ac5 по имени поля — проверь что reason/systemMessage реально делают). Domain: **T-merge-A** — соблазн выбрать «мою» (редизайн) ветку целиком, потому что она «моя последняя»; counter — §4 заставляет оценить каждую ось отдельно, #81 может быть лучше по видимому блоку.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
