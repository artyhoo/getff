# Project bootstrap — discovery reference

> **Authoritative for:** the project-bootstrap discovery checklist — the seven areas' concrete commands, the user-facing questions, and the `orchestrator.local.md` override template.
> **NOT authoritative for:** when discovery may be skipped — see [../SKILL.md](../SKILL.md) §Project bootstrap. Project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists).

> Полный чек-лист самодонастройки при первом запуске в проекте. Тело SKILL.md держит только список областей; здесь — команды, вопросы пользователю и шаблон override-файла.

Скил универсальный. Перед стартом workflow в **новом проекте** старшая один раз делает discovery — без него промты младшим будут содержать неверные команды/конвенции.

## Чек-лист discovery (выполнить молча, в начале первой umbrella в репо)

1. **Корень проекта и язык коммитов**
   - `pwd` → запомни как `<WORKDIR>`
   - `git log --oneline -20` → определи язык коммит-сообщений (en/ru/...) и формат (`Conventional Commits`, `[scope]`, free-form)
2. **Project instructions**
   - Прочитать `CLAUDE.md`, `AGENTS.md` в корне (если есть). Это источник конвенций — не пересказывать в промтах, ссылаться по имени.
   - Если оба отсутствуют — спросить пользователя один раз: «В проекте нет CLAUDE.md/AGENTS.md. Есть ли файл с конвенциями (commit format, base branch, ID задач)?» — далее работать по его ответу.
3. **Git topology**
   - `git remote -v` → один remote или несколько; запомни имя (`origin` / другое)
   - `git branch -a | head -20` → определи базовую ветку (`main` / `master` / `develop` / `staging` / `<remote>/staging`)
   - `git config --get remote.<name>.url` → если есть GitHub URL, запомни `<owner>/<repo>` для `gh pr create --repo`
4. **Task ID convention**
   - Из последних коммитов: ищи паттерн вроде `feat(ID-1234):`, `[ABC-12]`, `#1234`, `ENG-567`. Запомни как `<TASK_ID_PATTERN>`.
   - Если паттерн неоднороден / отсутствует — спросить: «Используется ли в проекте ID задач для коммитов и веток (Jira/Linear/Yougile/GitHub Issues/нет)?»
5. **Build/check commands**
   - Прочитать `package.json` (`scripts`), либо `pyproject.toml`, `Makefile`, `justfile`, `Cargo.toml`, `go.mod` — что есть.
   - Определи команды: `<TYPECHECK>`, `<LINT>`, `<TEST>`, `<BUILD>`, агрегатор `<CHECK_ALL>` если есть.
   - Определи package manager: `npm` / `pnpm` / `yarn` / `bun` / `uv` / `cargo` / etc — по lock-файлу.
6. **Project-local skills и rules**
   - `ls .claude/skills/ .claude/rules/ 2>/dev/null` → список доступных проектных skills. Их **не пересказывать**, упоминать по имени в промте — auto-trigger подгрузит.
7. **File-prompt directory**
   - Проверить `.gitignore` на `.claude/orchestrator-prompts/`. Если строки нет и пользователь хочет Mode B — предложить добавить (один раз).

> After discovery: `Skill('superpowers:subagent-driven-development')` for PRD-driven decomposition, `Skill('superpowers:writing-plans')` for structured plan creation. Discovery is our niche; decomposition is companion's.

## Кэш discovery в текущей сессии

Запомни всё найденное в одном месте контекста (in-head, не файл) — будешь подставлять в промты младшим. При смене ветки/удалении remote — переснять.

## Когда discovery можно пропустить

- Старшая уже работала в этом репо в текущей сессии (cache валиден).
- Задача = одна тривиальная правка по точному пути → прямой `Edit`, без orchestrator-workflow вообще.

## Опциональный override-файл

Если пользователь хочет зафиксировать discovery (чтобы каждый Claude Code session не передискаверивал) — старшая может предложить создать `.claude/orchestrator.local.md` с найденными значениями (gitignored). Это не обязательно: проектный CLAUDE.md/AGENTS.md обычно уже содержит эти данные.

**Шаблон `orchestrator.local.md`:**

```markdown
# Orchestrator local config — discovered <YYYY-MM-DD>

WORKDIR: <abs path>
BASE*BRANCH: <e.g. origin/main>
REMOTE: <name + url>
GH_REPO: <owner/repo or none>
TASK_ID_PATTERN: <e.g. ID-XXXX | none>
COMMIT_FORMAT: <e.g. type(ID-XXXX): описание | type(scope): description>
COMMIT_LANG: <ru | en | ...>
PKG_MANAGER: <npm | pnpm | ...>
TYPECHECK: <command>
LINT: <command>
TEST: <command>
CHECK_ALL: <command or sequence>
PROJECT_SKILLS: <list from .claude/skills/>
PROJECT_RULES: <list from .claude/rules/>
PROMPTS_DIR: .claude/orchestrator-prompts/ # gitignored # orch-home: allow framework-only skill, never in GETFF_SKILLS*\* delivery tiers (setup.d/lib.sh:58-60)
```
