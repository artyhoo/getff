# ПРОМТ ДЛЯ OPUS — review + prep (НЕ для фаблы)

Ты — Opus. Твоя роль: **reviewer + critic + prep-for-fabla**. Не дизайнер, не планировщик — это сделает фабла позже, с чистого листа, через /arch §1 с operator'ом.

Контекст: operator commissioned у GLM-5.2 research-track на тему «действительно ли разным ролям агента дают разный контекст (только нужное) или все получают полный». GLM отработал в host + 6 aif tasks. Сейчас твоя очередь — отфильтровать material, найти что не так, и если что-то не ок — **передиспатчь в aif** для перересёрча/исправления GLM'ом (не правь сам).

## ЧТО ПОДГОТОВЛЕНО (всё на staging, всё в aif-handoff)

### Главная точка входа (читай ПЕРВЫМ)

`docs/superpowers/specs/2026-07-27-per-role-context-bundle-for-opus.md`
— final bundle (268 строк): собрал всё в один файл + reachability audit + 6 contradictions (обе стороны сохранены) + 7 forks + 18 candidate shapes (по пути).

### Substrate docs (на staging, для деталей)

- `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` — 10 falsifiable claims (C1-C10) + 8-item verify-list + 5 forks
- `docs/meta-factory/research-patches/2026-07-27-per-role-context-addendum-fresh-2026.md` — addendum: actual measurement (~236 KB / ~59k tokens always-on), superpowers v6.1.1 → v6.2.0 diff (новый scoped re-reviewer), 6 fresh 2026 sources, 3 NEW claims (C11-C13), 2 NEW forks
- `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md` — 18 candidate shapes (α-σ)
- `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md` — что ещё движется на этой поверхности

### Task output'ы из aif (inline в bundle §3, но оригиналы тут)

- `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scripts-f164e8-f164e807-191a-4336-9fe1-52145255c00e/per-role-context-runtime-probe-report.md` — live CC verification (5 CONFIRMED + 2 PARTIAL, P5 REFUTED — digest location)
- `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scripts-f4dc0b-f4dc0bff-37c6-4662-abab-5c67c9a646b6/per-role-context-deep-research-report.md` — 515 строк, exhaustive sweep 13 поверхностей (S1-S13) + 7 load-bearing questions
- `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scripts-4e73e5-4e73e54e-da1f-44a8-979e-209013a9e6cd/per-role-context-cold-review-report.md` — был blocker-report (контейнер не видел deliverables)

### ПРЕДЫДУЩАЯ РАБОТА В aif НА ЭТУ ТЕМУ (не этой сессии — читай тоже)

Тема injection + progressive disclosure разрабатывалась и раньше. На staging лежат:

- `docs/meta-factory/research-patches/2026-06-13-inject-layer-extension-rphase.md` — DEFER с BUILD re-trigger condition (≥6 marked rules / consumer mis-scope / per-class generated).
- `docs/meta-factory/research-patches/2026-07-18-zcode-parity-s7-subagentstart.md` — SubagentStart coverage gap (CC-primary hooks молча падают на ZCode); backup через PreToolUse:Agent + inject-subagent-context.
- `docs/meta-factory/research-patches/2026-07-18-zcode-parity-s4-warn-subagent.md` — subagent report warn hook (ZCode dual-arm).
- `docs/meta-factory/research-patches/2026-05-27-living-doc-neutral-injection.md` — living-docs injection pattern.

В аif-handoff:
- task `f3c2d6cb` / `01d86a77` — zcode-parity-s7b-subagent-context-extend (Jul 19)
- task `6225f31e` / `d499850e` — AIF scratchpad (Jul 26) — Seat A top-down review session-start-token-audit GO; Seat B rework в per-role-context review REVISE

### Родственная фабла (НА ВЕТКЕ, не на staging)

`origin/claude/session-start-token-audit-77d224:.claude/orchestrator-prompts/session-start-token-audit/kickoff.md`
— operator-commissioned сегодня umbrella про session-start token load (140 KB / 36-40k tokens injected, target ≤20-25k). Hard constraint: «never demote load-bearing always-on check». Это **та же тема, другой угол**: token-audit спрашивает «сколько грузим и как trim'ить», мой research спрашивает «фильтруем ли по ролям». Оба про always-on context load.

## ОТКРЫТЫЕ ВОПРОСЫ И ПРОТИВОРЕЧИЯ (material для твоего review, НЕ мои решения)

GLM ничего не решал. Ниже — наблюдаемые противоречия и гипотезы (гипотезы оставлены как material; разрешение — за тобой).

### Contradiction #1 — `subagent_type` branching

- **Source A (raw research C5):** «no per-role branching in any hook»
- **Source B (deep-research S13.a):** `subagent_type:"implement-worker"` runtime dispatch documented at `docs/superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md:71,103,141`
- **Possible readings (гипотезы, не решения):** (i) per-role context dispatch, (ii) different concept sharing the name, (iii) runtime skill vs hook

### Contradiction #2 — digest location

- **Source A (raw research C5/C10 P5 file:line):** «digest in `session-bootstrap.md` between markers»
- **Source B (runtime-probe P5 REFUTED):** «digest is inline-heredoc in `inject-session-bootstrap.sh:25-33`»

### Contradiction #3 — uniform digest vs operator framing

- **Source A (raw research C10):** «uniform digest = deliberate anti-drift» (2026-05-09 incident, specifics не верифицированы)
- **Source B (operator's framing):** «worker should not receive goal/architecture»
- Гипотеза: это fork, не contradiction — обе стороны могут быть одновременно верны (но это гипотеза, не решение)

### Contradiction #4 — DeepWiki vs local evidence

- **Source A (DeepWiki obra/superpowers):** «re-review-prompt.md NOT in v6.2.0»
- **Source B (local file):** `~/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/skills/subagent-driven-development/re-review-prompt.md` существует, 107 строк

### Contradiction #5 — re-reviewer scope vs always-on load

- **Source A (addendum C12):** v6.2.0 scoped re-reviewer (narrower context внутри SDD)
- **Source B (addendum C11):** actual worker payload ~236 KB unfiltered (always-on load)
- Гипотеза: re-reviewer scope-narrowing — внутри SDD, не влияет на always-on load (но это гипотеза, не решение)

### Contradiction #6 — definition fork (load-bearing)

«per-role context» имеет 2 значения:
- (a) auto-injected at session start → равномерно для всех ролей (C11 прав на этом уровне)
- (b) hand-authored role-specific content → дифференцировано (S8/S11/S12 прав на этом уровне)

Operator's verbatim question «inject only needed» maps to (a). Operator's framing «roles receive different» could map to either. Это definition fork — без разрешения интерпретация всего material неоднозначна.

### Contradiction #7 — claudeMdExcludes (operator подсветил)

- **Source A (session-start-token-audit kickoff line 22-26):** «`claudeMdExcludes` empirically confirmed absent from a live session start while all other NO-paths rules were present» → **РАБОТАЕТ** для rules/
- **Source B (runtime-probe P4):** «4 rules in `claudeMdExcludes` were predicted-NO but observed-YES» → **НЕ РАБОТАЕТ** для rules/

Это да/нет противоречие. Гипотезы о причинах (не решения):
1. Token-audit оперся на transcript snapshot одной live-сессии и surveyman ошибся
2. Runtime-probe работал в aif-контейнере (CC 2.1.218), не на host CC — behaviour может отличаться
3. Они измеряли разное: token-audit мог смотреть frozen transcript, probe — live session context

## КОНТЕКСТЫ ДОВЕРИЯ (observation, не указания)

1. **C11 measurement** — это GLM host + aif container probe (CC 2.1.218), НЕ real CC host session. Real CC может вести себя иначе.
2. **DeepWiki vs local** — DeepWiki в одном случае (re-review-prompt.md) опровергнут local file. Это observation про надёжность DeepWiki в целом, не указание «never trust DeepWiki».
3. **claudeMdExcludes** — смотри contradiction #7.
4. **`subagent_type:"implement-worker"` runtime dispatch** — смотри contradiction #1.

## ТВОЯ РОЛЬ

1. **Cold review всего material.** Применяй тот же cold-eye что и к любому external research: overreach, weak falsifiers, hidden recommendations, framing bias, missing evidence, stale claims.

2. **Resolve contradictions #1-7** (или подтверди что что-то ещё开放но). Все 7 — material, не мои решения.

3. **Run verify-list из raw research patch (8 пунктов).**

4. **Если что-то не ок — НЕ правь сам.** Диспетчь в aif через `npx tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff> --force` с конкретным regression-fix kickoff. GLM в aif-handoff container'е переделает. Это его работа — тяжелый ресёрч и фикс; твоя — фильтр.

5. **Дополни material** своими finding'ами (если заметил что GLM пропустил — задиспатчь additional research task в aif).

6. **Подготовь cleaned + extended material для fabla.** Не рекомендуй дизайн — fabla решит сама после /arch §1 с operator'ом с чистого листа.

## ПОСЛЕ ПОДГОТОВКИ

Когда материал отфильтрован + дополнен + сохранён на staging:
- operator стартует /arch §1 с фаблой С ЧИСТОГО ЛИСТА (сначала обсуждение, что вообще делать).
- Потом фабла ознакомится с твоим prep как с одним из input'ов.
- Потом — /arch §2 two-altitude review + design + dispatch.

## АУДИТ ТРЕЙЛ

PRs этой сессии: #1176 (substrate), #1177 (addendum), #1178 (corrections), #1179 (final bundle), #1180 (contradiction #6).
PRs предыдущей работы по теме: ищи в `git log origin/staging --grep='inject\|subagent\|session-start\|claudeMdExcludes'`.

Staging tip сейчас: `3172cc5653`.

## ДОПОЛНИТЕЛЬНЫЕ ИСТОЧНИКИ (operator подсветил)

- **Anthropic blog (July 24, 2026):** [claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models) — «The new rules of context engineering for Claude 5 generation models». Anthropic удалили >80% Claude Code system prompt для Opus 5 / Fable 5 без measurable loss на coding evals. Ключевые тезисы: Rules → Judgement; Examples → Interface design; Upfront → **Progressive disclosure** (skills + ToolSearch deferred loading); Repeat → Simple tool desc; Memory в CLAUDE.md → Auto-memory; Simple specs → Rich references. Совет по CLAUDE.md: «lightweight, tokens on gotchas, avoid stating the obvious, progressive disclosure heavily». Это **свежая официальная Anthropic позиция ровно по нашей теме**.
- **`claude doctor`** (команда `/doctor` в Claude Code) — новая встроенная команда от Anthropic для rightsize skills + CLAUDE.md файлов. Полезно для оптимизации текущего контекста этого repo.
