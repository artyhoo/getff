# Tool decisions format — cold reference

> **Authoritative for:** `.ai-factory/tool-decisions.md` schema — §1 file location, §2 YAML frontmatter + section definitions, §3 format example, §4 version-drift policy.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). Activation discipline (when to write this file) — see [../SKILL.md](../SKILL.md). Consumer-facing twin — see [skills/tool-bootstrapping/references/decision-format.md](../../../../skills/tool-bootstrapping/references/decision-format.md).

## §1 File location

Repository root: `.ai-factory/tool-decisions.md`. **Committed** — not gitignored; decisions are team-shared and auditable via git history. Mirrors Cline Memory Bank committed-file pattern (SSOT #9 ADOPT VOCABULARY) at per-install granularity, not per-tool-call like Continue.dev `permissions.yaml` (SSOT #33 DEFER).

## §2 Schema

### YAML frontmatter

```yaml
---
# Per-stack deps-hash baselines (DH-S1 multistack, kickoff #1016). One line per detected
# stack; each stores sha256-<hex> of that stack's declared deps. A stack's line is omitted
# when the consumer has no manifest for it.
deps-hash-npm: <sha256 of package.json deps surface — dependencies + devDependencies + peerDependencies + optionalDependencies + overrides + resolutions + pnpm.overrides (each if present, object-guarded)>
deps-hash-python: <sha256 of pyproject.toml deps surface — Tier-1 6 non-[project] tables + Tier-2 tomllib [project].dependencies/optional-dependencies>
deps-hash-cargo: <sha256 of Cargo.toml deps surface — Tier-1 table-boundary hash of [dependencies]/[dev-dependencies]/[build-dependencies] + dotted sub-tables + [target.*.{dependencies,dev-dependencies,build-dependencies}] + [workspace.{dependencies,dev-dependencies,build-dependencies}]; Tier-2 cargo metadata enrichment (DH-S2)>
last-bootstrap: <ISO date of last full tool-bootstrap run, e.g. 2026-05-11>
aif-version: <AIF semver at time of last bootstrap, e.g. 2.1.0>
---
```

The `deps-hash-*` fields are the rule 5 incrementality triggers. The UserPromptSubmit hook (`packages/core/hooks/deps-hash-check.sh`, DH-S1 npm/python + DH-S2 rust) recomputes each present stack's hash at session start and injects a WARN if any differs from its recorded value. **Backward compatibility:** the legacy bare `deps-hash:` key is read as the `npm` slot, so existing JS-only consumers keep working without re-baseline. If BOTH `deps-hash:` and `deps-hash-npm:` are present, `deps-hash-npm:` wins (migration-safe). A consumer with none of these keys recorded is "unbaselined" — the hook still warns (the install-time nudge) but with honest wording ("not yet baselined"), not "deps changed" (GH #548).

### `## Accepted` section

Markdown table with columns: `Tool | Type | Accepted | Rationale`. `Type` is `MCP` or `Skill`. `Accepted` is an ISO date or a short status string (e.g. `recommended`).

### `## Rejected` section

Markdown table with columns: `Tool | Type | Rejected | Reason | Re-eval trigger`. Never re-propose a rejected tool unless the `Re-eval trigger` condition has fired. Record the trigger explicitly — «no longer needed» is not a valid trigger.

### `## Pending review` section

Free-form markdown list of tools proposed but undecided, or tools due for re-evaluation (e.g. SSOT velocity-tag fired per [docs/meta-factory/prior-art-evaluations.md](../../../../docs/meta-factory/prior-art-evaluations.md)). Format: `- <tool-name>: <reason for pending>`.

## §3 Format example

```markdown
---
deps-hash-npm: sha256-a1b2c3d4e5f6...
deps-hash-python: sha256-fedcba987654...
last-bootstrap: 2026-05-11
aif-version: 2.1.0
---

## Accepted

| Tool       | Type | Accepted    | Rationale                                               |
| ---------- | ---- | ----------- | ------------------------------------------------------- |
| context7   | MCP  | recommended | strongly recommended for doc lookup; NOT auto-installed |
| github-mcp | MCP  | 2026-05-11  | GitHub Issues + PRs in active use by workflow           |

## Rejected

| Tool         | Type | Rejected   | Reason                            | Re-eval trigger            |
| ------------ | ---- | ---------- | --------------------------------- | -------------------------- |
| postgres-mcp | MCP  | 2026-05-11 | Project uses SQLite, not Postgres | Stack migrates to Postgres |

## Pending review

- brave-search-mcp: AIF /aif proposed on 2026-06-01 re-run; awaiting team decision
```

## §4 Version drift

When a SSOT velocity-tag fires (AIF entry #31 90-day cadence) or when `/aif` re-run surfaces new candidates, append to `## Pending review` — do NOT overwrite `## Accepted` or `## Rejected`. Git history is the audit trail; in-place edits to past decisions are not permitted.
