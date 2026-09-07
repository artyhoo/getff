# Rules — the getff Python lane

> **Authoritative for:** the rule list this project's AI agents must follow, and the enforcement channel of each rule. The Summary table below is RENDERED AT INSTALL TIME from the rules actually delivered into `.getff/`, so it names your rule set, not a generic one.
> **NOT authoritative for:** project goal — see this project's README.md. Architecture / layering — see `.ai-factory/ARCHITECTURE.md`. Rule BYTES — each rule's real definition lives in `.getff/astgrep-rules/<id>.yml` (ast-grep lane) or `.getff/ruff-bans.toml` (ruff lane); this file describes them, the files decide.

These rules are enforced at the **earliest reachable channel**: `ast-grep` and `ruff` at
edit-time and in the local pre-push hook (`.getff/hooks/pre-push`), then the
`getff-python` CI workflow as the backstop for a deliberate local bypass.

**This project is a Python project.** There is no TypeScript rule set here — no type-checker
run, no JavaScript linter, no dependency-cruiser architecture check. If an agent finds itself
about to run one of those because "the rules said so", the rules it read were not these.

## Summary table

> Generated at install time by `_py_render_rules_md` (`setup.d/45-python.sh`) from the rules
> present in `.getff/astgrep-rules/` and `.getff/ruff-bans.toml`. Re-running the installer
> re-renders it only when this file is absent (it is yours to edit — see Rule maintenance).

<!-- begin: rules-table-generated -->

_No getff rules were found under `.getff/` when this file was rendered._

<!-- end: rules-table-generated -->

## The two lanes

### ast-grep lane — structural rules

Rule files live in `.getff/astgrep-rules/`, one YAML per rule, and are registered for scanning
through the project's `sgconfig.yml` (`ruleDirs:` includes `.getff/astgrep-rules`).

**Check:** `ast-grep scan` from the project root. A rule fires as `error`, so a hit is a
failure, not a note.

**Escape hatch:** ast-grep honours a `# ast-grep-ignore: <rule-id>` comment on the line above
the offending expression. Use it with a reason in the same comment; a bare ignore with no
rationale is the thing this rule set exists to prevent.

### ruff lane — import and API bans

Ban codes live in `.getff/ruff-bans.toml`. That file is getff-owned and always delivered, so
the bans fire even when this project keeps its own `ruff.toml` or `[tool.ruff]` block (getff
refuses to overwrite either — it ships `getff-ruff.toml` for reference instead and leaves your
config untouched).

**Check:** `ruff check . --config .getff/ruff-bans.toml --no-cache` — this is the exact command
the pre-push hook and the CI workflow run, so running it locally reproduces the gate.

**Escape hatch:** ruff honours `# noqa: <code>` on the offending line. Same rule as above:
carry a reason.

## How violations are handled

1. The earliest channel that can see the violation reports it — the editor's ast-grep/ruff
   integration, then `.getff/hooks/pre-push`, then the `getff-python` CI job.
2. Fix the code. If the rule is genuinely wrong for this project, change the rule (below) —
   never `--no-verify`, and never an un-explained `noqa` / `ast-grep-ignore`.

## Rule maintenance

- Every rule here names a real command that fires. A rule with no runnable check is a wish,
  not a rule: implement the check or delete the rule.
- This file is **yours**. The installer writes it once and then leaves it alone; `--refresh`
  never overwrites it (only `--force` does). Add project-specific rules freely.
- Rules delivered by getff are regenerated from `.getff/`, so the honest way to add a rule to
  the enforced set is to add its YAML to `.getff/astgrep-rules/` (or its code to
  `.getff/ruff-bans.toml`) and record it here — not to describe it here alone.
- `.getff/rules-lock.python.json` records the rule ids and the fingerprint of the delivered
  set, so what a given install shipped stays auditable.
