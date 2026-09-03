# Tool decisions format — cold reference

> **Authoritative for:** `.ai-factory/tool-decisions.md` schema for consumer projects — §1 file location, §2 YAML frontmatter + section definitions, §3 format example, §4 version-drift policy.
> **NOT authoritative for:** authoring-repo goal — see authoring repo `README.md#why-this-exists`. Activation discipline — see [../SKILL.md](../SKILL.md).

## §1 File location

Your project root: `.ai-factory/tool-decisions.md`. **Commit this file** — decisions are team-shared and auditable via git history. Use [../templates/tool-decisions.md.template](../templates/tool-decisions.md.template) as a starter.

## §2 Schema

### YAML frontmatter

```yaml
---
deps-hash: <sha256 of package.json "dependencies"+"devDependencies" sections>
last-bootstrap: <ISO date of last full tool-bootstrap run, e.g. 2026-05-11>
aif-version: <AIF semver at time of last bootstrap, e.g. 2.1.0>
---
```

The `deps-hash` field drives rule 5 incrementality. The UserPromptSubmit hook recomputes the hash at session start and injects a WARN if it differs.

### `## Accepted` section

Markdown table: `Tool | Type | Accepted | Rationale`. `Type` is `MCP` or `Skill`. `Accepted` is an ISO date or a short status string (e.g. `recommended`).

### `## Rejected` section

Markdown table: `Tool | Type | Rejected | Reason | Re-eval trigger`. Never re-propose a rejected tool unless the `Re-eval trigger` has fired. Record the trigger explicitly.

### `## Pending review` section

Free-form markdown list of undecided or re-evaluation-due tools. Format: `- <tool-name>: <reason for pending>`.

## §3 Format example

```markdown
---
deps-hash: sha256-a1b2c3d4e5f6
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

When AIF or a tool updates and surfaces new candidates, append to `## Pending review` — do NOT overwrite `## Accepted` or `## Rejected`. Git history is the audit trail; in-place edits to past decisions are not permitted.
