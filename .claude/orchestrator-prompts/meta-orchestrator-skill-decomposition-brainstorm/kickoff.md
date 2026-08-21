# Brainstorm — meta-orchestrator skill: decomposition / cap-blocker / architecture

> **Mode:** свежая CC сессия на Opus (`/model opus` если не дефолт).
> **Skill:** в начале сессии активируй `superpowers:brainstorming` — explore intent + options + tradeoffs до любых рекомендаций.
> **Output:** research-patch в `docs/meta-factory/research-patches/<YYYY-MM-DD>-meta-orchestrator-skill-decomposition-brainstorm.md`. НЕ выпускай PR, НЕ менять SKILL.md или references. Только R-phase deliverable + verdicts для будущих umbrellas.

---

## §0 Контекст — почему я тебя зову

`/Users/art/code/rules-as-tests-aif` — single-maintainer проект про «AI agents can't silently bypass undocumented conventions». Каждое правило — executable artifact, который падает на самом раннем достижимом канале (edit → pre-commit → pre-push → CI).

В репо есть skill `/meta-orchestrator` — он живёт в `.claude/skills/meta-orchestrator/`. Это «оркестратор оркестраторов»: планирует umbrella'ы, проверяет plan-currency, скорит приоритеты, генерирует launch-table, enforce'ит stage-gates. Был построен в Sub-wave D (PR #186/#187), потом обрастал stages 2A/2B/2C/3/4.

**Симптом:** SKILL.md упёрся в 600-line cap (`.husky/pre-commit:63`). Cap был 500, его уже подняли до 600 один раз — commit `1a947bc chore(husky): bump markdown cap 500→600 for skill-memory umbrella`. Сейчас Stage 4 ушёл бы за cap → пришлось деферить SKILL.md wiring (D.1-D.3) в follow-up PR (см. PR #244 «Known residuals» + «Follow-ups»).

**Подозрение мейнтейнера** (твоя точка отправления, НЕ верифицированный диагноз): «cap-bump раз за разом — плохой паттерн; может разбить SKILL.md на главный + подскилы».

**Твоя задача — не реализовать decomposition.** Твоя задача — **brainstorm-исследование** что вообще не так и какая стратегия лучше.

---

## §1 Что прочитать в первую очередь (10 мин ориентации)

```bash
# Размеры артефактов meta-orchestrator
wc -l .claude/skills/meta-orchestrator/SKILL.md \
      .claude/skills/meta-orchestrator/references/*.md \
      .claude/skills/meta-orchestrator/helpers/*.sh \
      .claude/skills/meta-orchestrator/templates/*

# Сравни с другими скилами
wc -l .claude/skills/*/SKILL.md | sort -n

# История cap'а
git log --all --oneline -- .husky/pre-commit | head -10
git log -1 1a947bc --format=%B  # причина первого bump'а

# Главный документ
head -100 .claude/skills/meta-orchestrator/SKILL.md
grep -n "^## §" .claude/skills/meta-orchestrator/SKILL.md
```

Затем прочитай:
- `.claude/skills/meta-orchestrator/SKILL.md` целиком (~600 LOC; стоит ~10k tokens — займёт прилично контекста, но это load-bearing)
- `docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md` — R-phase verdict который привёл к BUILD'у
- `.claude/rules/build-first-reuse-default.md` — BFR default = REUSE > BUILD (правило, к которому будешь часто возвращаться)
- `.claude/rules/dual-implementation-discipline.md` — про `@dual-pair` + `@cc-only-rationale` (если предложишь раздробить на N skills, что с дисциплиной?)
- `.claude/rules/doc-authority-hierarchy.md §3` — header формат для любых новых docs

---

## §2 Гипотезы для проверки (НЕ предпочтения — критически проверить каждую)

Перед формированием рекомендации **верифицируй каждую гипотезу** или явно отметь как «не проверено».

### H1 — «cap-bump = плохой паттерн»

- Проверь: сколько раз вообще cap двигался (`git log --all` по `.husky/pre-commit` + `.github/workflows/audit-self.yml`)?
- Уперлись только meta-orchestrator или другие скилы тоже растут к лимиту?
- Что говорит `audit-self.yml` workflow про cap — там mirror лимит есть?
- Что если cap = 1000 — что плохого реально произойдёт? (тесты падают? context usage? review readability?)

### H2 — «SKILL.md разбухает не от capability, а от prose»

- Что КОНКРЕТНО занимает 600 LOC в SKILL.md? Делай построчный профиль: что % decision-matrix, что % anti-pattern lists, что % `!shell` blocks, что % cross-references?
- Сколько LOC уже вынесено в references/ (всего ~820)? Получается, decomposition уже идёт — почему не работает?
- Есть ли prose который дублируется между SKILL.md и references? Если да — это утечка single-source-of-truth, отдельная проблема.

### H3 — «можно разбить на sub-skills»

- Поддерживает ли CC harness формальную композицию скилов? Один SKILL может звать другой через `Skill` tool?
- Цена: cross-skill state идёт через файлы. Это `dual-implementation-discipline.md §8 #two-prompts-drift` risk?
- Принцип 18/19 фиксируют output-format именно для одного скила — что с ними при разбиении?
- Проверь существующие примеры разбиения в репо: их нет? Есть в Superpowers / oh-my-openagent / AIF?

### H4 — «больше extraction в references = решение»

- Какие секции SKILL.md ФАКТИЧЕСКИ нужны AI session на каждом invocation, а какие — только в edge-case?
- Цена extraction: больше Read calls (per-session context, не cap), сложнее cross-reference (теряется визуальная навигация)?
- Есть precedent: `references/output-format.md` (374 LOC) уже extracted и проходит через principle 18. Что было хорошо/плохо в том опыте?

### H5 — «разбухание = symptom of contract-first-level overload»

- Может скил пытается делать слишком много? §1-§11 — это 11 концептуально-разных обязанностей в одной точке входа.
- Анти-гипотеза: 11 обязанностей — это **минимальный** контракт оркестратора, разбиение увеличит drift, не уменьшит.
- Что говорит R-phase patch (`2026-05-23-meta-orchestrator-prior-art.md`) про scope? Какие функции БЫЛИ заведомо out-of-scope?

### H6 — «cap должен учитывать references как part-of-skill»

- Сейчас cap считает только SKILL.md. Тотал meta-orchestrator = 2880 LOC (SKILL + references + helpers + templates). Если cap считал бы весь skill — упёрлись бы давно.
- Что лучше: жёсткий cap на SKILL.md (форсит extraction) или soft cap на всю skill-папку (форсит размер capability в целом)?
- Это design-вопрос про дисциплину, а не bash-level.

---

## §3 Prior-art (BFR §3 mandate — ≥6 пункта)

Не выпускай ни одного verdict «BUILD / ADOPT / REJECT» без эвиденса (`phase-research-coverage.md §1.7` + recommendation-laziness rule):

1. **Own-stack sweep:** что уже в репо?
   - `references/plan-cache.md` + `update-cache.sh` (SSOT #77 ADAPT) — extraction pattern уже adopted
   - `references/master-backlog-delta.md` + `update-delta.sh` + `delta-diff.sh` (Stage 3) — same pattern
   - `references/mode-overrides.md` + `parse-override-flags.sh` (Stage 4 — твоя контрольная точка)
   - `references/output-format.md` + principle 18 — extraction + executable test
   - `references/placeholders.md`, `references/failures.md`, `references/plain-language-tail.md`, `references/glossary.md` — все extracted

2. **Superpowers** (`obra/superpowers` — DeepWiki через `mcp__deepwiki__ask_question`):
   - Как они держат skill size управляемым?
   - У них есть `subagent-driven-development` + `executing-plans` — это decomposition или просто separate concerns?
   - Какой у них typical SKILL.md размер?

3. **AIF (`lee-to/ai-factory`):** есть ли cap на skill files? Как декомпозируют сложные skills?

4. **oh-my-openagent (`code-yeongyu/oh-my-openagent`):** их Tier-1 reference (per `feedback_ai_doc_research_priority_pool`). Multi-agent decomposition — но как они держат каждого agent compact?

5. **CC docs:** <https://docs.claude.com/en/docs/claude-code/sub-agents> (read via WebFetch) — есть ли формальное skill-composition мечanism в harness?

6. **Cline (`cline/cline`):** Memory Bank methodology — есть ли там паттерн «один SKILL, много references»?

7. **Negative-existence check:** есть ли в production какой-нибудь production-grade фреймворк, где один slash-command декомпозирован на N подкоманд с shared state через JSON sidecar? Если да — ADAPT precedent.

---

## §4 Constraints (не переоткрывай)

Это инварианты проекта. Любая рекомендация ДОЛЖНА с ними совпадать:

- `no-paid-llm-in-ci.md §1` — никакого API-billed LLM в CI. Не предлагай «LLM-driven SKILL.md splitter».
- `build-first-reuse-default.md §1` — REUSE > BUILD по умолчанию. Перед предложением «давайте напишем X» — серьёзный prior-art check.
- `doc-authority-hierarchy.md §3` — любой новый markdown carries `> **Authoritative for:**` blockquote header.
- `dual-implementation-discipline.md` — если предлагаешь split, продумай drift-protection между частями.
- `feedback_no_drive_by_prs` — твой output = research-patch, НЕ PR с правками.
- Принцип 18 (output-format) + принцип 19 (alias-routing) — фиксируют именно для `/meta-orchestrator` slash command. Любое split-on-skills ломает их binding.

---

## §5 Что я хочу получить в research-patch

Файл `docs/meta-factory/research-patches/<YYYY-MM-DD>-meta-orchestrator-skill-decomposition-brainstorm.md` со структурой:

1. `<!-- scope:meta-orchestrator-skill-decomposition-brainstorm -->` + Authoritative-for header per doc-authority-hierarchy
2. **§0 Cold-start verify** — что прочитал, что верифицировал, какие команды запускал (audit trail)
3. **§1 Population profile** — SKILL.md per-section LOC breakdown + что уже extracted; cap history; comparable skills sizes
4. **§2 Hypothesis verification** — пройди по H1-H6 из этого kickoff'а с verdicts CONFIRMED / REJECTED / INCONCLUSIVE-needs-LLM. Каждый verdict — с file:line или command-output эвиденсом.
5. **§3 Prior-art survey** — что нашёл в Superpowers / AIF / oh-my-openagent / Cline / CC docs / others. Verdict per source: REFERENCE / ADAPT / ADOPT / KEEP-NARROW / REJECT с T16 problem-class сравнением.
6. **§4 Option matrix** — все опции которые ты увидел (включая те что я не упомянул в kickoff'е), с trade-off таблицей. Минимум 3 опции.
7. **§5 Recommended path** — обоснованный verdict (lead with «Recommend X because Y», per `phase-research-coverage.md §1.12`), включая фалсифайер (когда вердикт неправ).
8. **§6 Falsifier conditions** — ≥3 ситуации в которых рекомендация устареет.
9. **§7 §1.7 self-reflexive check** — Forward (с какими правилами совпадает) + Backward (что НЕ меняется по итогу твоего brainstorm'a — SKILL.md, hooks, principles, и т.д.)
10. **§8 T-traps active** — какие из `ai-laziness-traps.md` ты применил, особенно T11 / T13 / T15 / T16 / T19. Добавь ≥1 domain-specific trap для brainstorm-сессии.
11. **§9 Next-step proposal** — конкретный kickoff для I-phase umbrella (если verdict = BUILD/ADAPT/REFACTOR) ИЛИ закрытие как DEFER (если verdict = «cap-bump до 800, разбираться потом»). Точные следующие действия.
12. **§10 See also** — все ссылки которые ты потрогал

---

## §6 Quota expectation

~40-80k Opus tokens. Если упрёшься в 100k — surface как ATTN.

R-phase не должен производить кода. Только markdown. Никаких `Edit` на `SKILL.md` / `references/*` / `helpers/*`. Если рука потянется — это T5 anti-pattern (bundling implementation into research phase), стоп.

---

## §7 T-traps active для тебя

- **T1** sampling-shallow — не closing при 3 looked-at; population enumerate (cap history, all skill sizes, all references) FIRST
- **T7** following-prompt-literally — ставь под сомнение мои гипотезы H1-H6. Возможно ВСЕ они неправы и реальная проблема в другом
- **T11** designing-without-prior-art — БЕЗ ≥3 phrasings WebSearch + ≥3 DeepWiki queries никакого «recommend X»
- **T13** ADOPTED-as-zero-work — если предлагаешь ADOPT Superpowers паттерн, verify upstream class (T16)
- **T15** self-application — brainstorm о SKILL'е должен сам пройти доktrины SKILL'а
- **T19** own QA — перед finalize patch'а, прочитай его сам холодно
- **T20** inline-verdict-without-evidence — каждый «лучше X чем Y» = с tool-call в same turn

**Domain-specific trap для тебя:**

- **T-Brainstorm-A — «decomposition-attractor»**: мейнтейнер уже посеял идею «разбить на sub-skills». Соблазн взять её как baseline и подгонять анализ. Counter: дай каждой опции (включая «cap-bump + ничего не делать», «инвертировать decomposition — собрать references обратно в SKILL.md», «удалить часть фичей») честный fair-trade-off pass.

---

## §8 Когда не делать что-то

- НЕ создавай PR. Output = research-patch только.
- НЕ модифицируй SKILL.md / helpers / templates. Even «one small fix» = T5.
- НЕ принимай решение за мейнтейнера. Если выйдешь на true strategy fork (e.g. «refactor сейчас vs продолжать cap-bump») — surface как DECISION-NEEDED per `reviewer-discipline.md §2`. С тем оговорим что мне предложили лучший вариант есть — **commit к рекомендации**, не option-dump.

---

## §9 Start checklist

- [ ] `git status` clean? `git rev-parse --abbrev-ref HEAD` = ? (если не staging — surface)
- [ ] `gh pr list --state open` — что в полёте? (особенно если есть открытый PR в `.claude/skills/meta-orchestrator/`)
- [ ] Активирован `superpowers:brainstorming`?
- [ ] Прочитал §1 (10-min orientation reads)?

Когда все боксы отмечены — приступай. Удачи.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
