# Phase -1 — Self-review протокол (полный)

> Тело SKILL.md держит триггеры (когда применять / когда skip) и таблицу реализации. Здесь — полный 5-шаговый протокол, шаблон reviewer-промта, focus split, cost framing, T-traps и anti-patterns. Мотивирующие инциденты и ROI: [rationale.md](rationale.md).

## Протокол (5 шагов)

1. **Прочитать собственный prompt холодно** — притвориться что не писал.
2. **Спавн reviewer'ов** с focus-split A/B. **Реализация по приоритету:**

   **(a) Default — 1× Opus через Agent tool** (omit `model` или `model: opus`). Один Opus умнее двух Sonnet'ов и обычно покрывает focus split A+B сам. Cost ~30-50k Opus. Подходит для большинства dispatch'ей.

   **(b) Prod-blast-radius** (DB write, force-push, capability commit) — **2× Opus через Agent tool parallel** с явным focus split A/B. Cost ~60-100k Opus. Для **сложнейшего дизайна / максимальной цены ошибки** подними хотя бы одного reviewer'а до `model: "fable"` (верхняя ступень reasoning'а — см. «Правило модели для Mode A» в SKILL.md).

   **(c) Когда пользователь явно сказал «экономь / Sonnet»** — **2× Sonnet через Agent tool** (`model: "sonnet"`): реально разводит квоту (проверь разводку по `/status` на своём setup'е, см. «Правило модели»), без ручного copy-paste. Cost ~0 Opus из текущей сессии. Компромисс — Sonnet слабее на adversarial-ревью, поэтому для prod-blast-radius всё равно предпочитай 2× Opus (вариант b). Альтернатива с живыми окнами — Mode B file-prompts (`.claude/orchestrator-prompts/reviewer-A-*.md` / `reviewer-B-*.md`, шаблон `templates/cold-verify-reviewer.md`).

   **Reviewer checklist** (одинаков для A и B, передавать в subagent prompt):
   ```text
   Task: Cold-start review of <kickoff/prompt path> for execution-readiness
   Subagent prompt:
     You are a cold-start reviewer. You did NOT write this prompt. Read it cold and critique:
       (a) Ambiguous instructions or unstated assumptions
       (b) Missing hard constraints (worktree, scope, T-traps, capability-commit, §1.7, drive-by risk)
       (c) Conflicts with current project state — verify file/line/slot/PR claims independently
       (d) Stale references (git log + recent PRs since prompt was drafted)
       (e) T-trap enumeration (per .claude/rules/ai-laziness-traps.md §3) — concrete, not blanket-ref
       (f) Drive-by risk — anything that could cascade into a separate PR mid-flight
     Return: BLOCKER/MAJOR/MINOR list + verdict GO/REVISE.
     No edits, no execution — pure prompt critique.
   ```

   **Focus split** (для вариантов b и c с двумя reviewer'ами):
   - **Reviewer A:** SQL/Bash correctness, exit codes, quoting, escape, pipes, heredoc, transaction safety, psql peculiarities
   - **Reviewer B:** architectural coherence, missing edge cases, hidden assumptions, scope boundaries, rollback paths, observability, security/immutability

3. **Collect findings** от обоих reviewer'ов (или от одного если вариант a).
4. **Адресовать findings:**
   - BLOCKER/MAJOR → орграстратор правит prompt напрямую (yes — сам файл prompt'а, не отдельный doc). Логирует amendment в state.md «Phase -1 amendments» секции.
   - MINOR → лог в «known-residuals», proceed without amend если их < 3.
5. **Re-review обоих reviewer'ов параллельно** (как в Step 2) если правил BLOCKER — **не только REVISE'ра**, потому что fix мог сломать что-то в другом фокусе. Для варианта a — re-review того же одного Opus. Повторять до GO или max **3 итерации** (escalate to maintainer если iter-3 still REVISE).

## Cost framing

- **1× Opus review pass** (default, вариант a): ~30-50k Opus tokens.
- **2× Opus review pass** (prod-blast-radius, вариант b): ~60-100k Opus tokens.
- **2× Sonnet через Agent tool** (пользователь сказал «экономь», вариант c): ~0 Opus из текущей сессии.
- Re-dispatch executor с плохим prompt'ом: ~120-200k Opus + потеря wall-clock + risk of bad prod state.
- **ROI breakeven при 0.5 пойманных BLOCKER/MAJOR per session** — обычно сильно выше.

## T-traps active на Phase -1 (само-ревью применяет себя к себе)

- **T15 self-application MANDATORY** — пропустить Phase -1 = «дисциплина не для орграстратора, я выше этого». Это `#self-application-omitted` anti-pattern.
- **T7 follow-prompt-literally** — review должен быть содержательным, не «прошёл по чеклисту, всё OK». Если reviewer возвращает GO с 0 findings и prompt большой (≥100 строк) — это подозрительно, переспросить с adversarial counter-prompt.
- **T-trap-catalogue-blanket-reference** — кикофф должен enumerate T-номера для конкретного executor task, не просто `см. ai-laziness-traps.md`.
- **T-laziness-single-reviewer** — спавнить только одного reviewer'а когда требуется два (prod-blast-radius) = пропустишь bug в его blind-spot. Экономить здесь = экономить не там.

## Anti-patterns

- ❌ Phase -1 в формате «дай мне review» без указания (a)-(f) чеклиста — поверхностное ревью.
- ❌ Использовать тот же subagent для review и execution — теряется cold-start независимость.
- ❌ Принимать REVISE и proceed без амендмента — отменяет смысл Phase -1.
- ❌ Skip Phase -1 на «это же простой кикофф» — если простой, не нужен субагент вообще, делай direct Edit.
- ❌ «Один reviewer достаточно если promt простой» — если promt простой, не нужен subagent вообще, делай direct Edit. Если spawn'ишь — минимум 1× Opus (default) или 2× для prod-blast-radius.
- ❌ Reviewers с одинаковым focus (оба A или оба B) — теряется coverage split (актуально для вариантов 2× Opus и 2× Sonnet).
- ❌ Re-review только REVISE'ра после fix'а — fix мог сломать что-то в другом фокусе, надо обоих.
- ❌ **Sonnet на prod-blast-radius ревью** — для DB write / force-push / capability commit Sonnet слабее на adversarial-чтении; бери 2× Opus (вариант b), Sonnet оставь для задач попроще.
- ❌ **Слепое follow-prompt-literally (T7)** — не выполнять инструкции под-промта буквально, если они противоречат текущему состоянию; корректировать под факты (модель, пути, слоты), а не следовать слепо.
