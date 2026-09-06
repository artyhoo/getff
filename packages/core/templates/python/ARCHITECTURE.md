# Architecture — Python project

> Package layout, entrypoints, and where the getff rules are enforced.
>
> Drop into `.ai-factory/ARCHITECTURE.md` and override only what your project needs. The layout below is a starting point; the enforcement table at the bottom is not — it names the checks getff actually installed.
>
> **Authoritative for:** the Python-lane architecture starter — package/module layout, entrypoint conventions, and the map from convention to the enforcement channel the getff Python lane delivers (consumer-customisable).
> **NOT authoritative for:** project goal — see this project's README.md. The rule list and its escape hatches — see `.ai-factory/RULES.md`. Rule BYTES — `.getff/astgrep-rules/<id>.yml` and `.getff/ruff-bans.toml`.

**This is a Python project.** There is no TypeScript layer here — no `dependency-cruiser` run, no
ESLint, no `tsconfig.json`, no Zod. If an agent is about to reach for one of those because "the
architecture doc said so", the doc it read was not this one.

## Package layout (starter — edit to match your project)

```text
src/<your_package>/        # importable package; `src/` layout keeps tests off the source path
├── domain/                # pure logic: dataclasses, enums, protocols. Stdlib only.
├── services/              # use cases / orchestration; depends on domain + the ports below
├── adapters/              # implementations of the ports (db, http clients, queues, clock)
│   └── ports.py           # Protocol / ABC definitions the services depend on
├── api/                   # inbound surface (FastAPI/Flask routers, CLI commands)
├── config.py              # settings parsed once at startup, never read ad hoc
└── __main__.py            # `python -m <your_package>` entrypoint
tests/                     # pytest tree mirroring src/
pyproject.toml             # the project's own metadata + its own tool config
```

Projects with a flat layout (`<your_package>/` at the repo root) or a monorepo of several
distributions are equally fine — rename the directories here to match what you actually have. The
getff rules are path-agnostic: they scan the whole tree, not a fixed set of layers.

## Dependency direction (convention, not a getff-enforced check)

- `domain/` imports nothing project-internal.
- `services/` imports `domain/` and `adapters/ports.py` — never a concrete adapter.
- `adapters/` implements the ports; `api/` calls `services/`.
- No import cycles between packages.

getff installs **no** layering check on the Python lane. If you want this direction enforced, add
your own rule — an `import-linter` contract, or an ast-grep rule under `.getff/astgrep-rules/`
(the honest way, since that is the set `.ai-factory/RULES.md` renders from).

## Entrypoints

Name every process entrypoint explicitly here so an agent does not have to guess: the module a
`python -m` / console-script / ASGI server starts, and the config it reads. A getff install adds
no entrypoint of its own to your application — only the git hook and the CI workflow below.

## Where rules are enforced

Everything in this table is installed by the getff Python lane and runnable right now.

| Convention                                            | Enforced by                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| No `eval(...)`                                        | ast-grep `getff-no-eval` (`.getff/astgrep-rules/`)                    |
| No `os.system(...)`                                   | ast-grep `getff-no-os-system`                                         |
| No naive `datetime.now()` / `datetime.datetime.now()` | ast-grep `getff-no-datetime-now`, `getff-no-datetime-datetime-now`    |
| No naive `datetime.now()` (built-in lane)             | ruff `DTZ005` (`.getff/ruff-bans.toml`)                               |
| No `datetime.datetime.utcnow()`                       | ruff `TID251`                                                         |
| No module-level `tensorflow` import                   | ruff `TID253`                                                         |
| All of the above, before the push leaves your machine | `.getff/hooks/pre-push` (`git config core.hooksPath .getff/hooks`)    |
| All of the above, as the last-resort backstop         | `.github/workflows/getff-python.yml` (`getff-astgrep` + `getff-ruff`) |
| Layering, typing, coverage                            | **not installed by getff** — your own tooling                         |

Reproduce either gate locally with the exact command it runs:

```bash
ast-grep scan
ruff check . --config .getff/ruff-bans.toml --no-cache
```

See `.ai-factory/RULES.md` for the rule list rendered from what this install actually delivered,
including the escape hatches (`# ast-grep-ignore: <id>`, `# noqa: <code>`) and how to add a rule.
