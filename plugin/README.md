# rules-as-tests — plugin payload

This subtree is the **Claude-Code plugin payload** consumed via the in-repo marketplace
(`.claude-plugin/marketplace.json` → `"source": "./plugin"`). It ships ONLY the
consumer-facing soft layer; the maintainer-internal `.claude/` dev harness is never shipped.

Install:

```text
/plugin marketplace add artyhoo/getff
/plugin install getff@getff
/getff:install-enforcement      # opt-in: wires git-hooks + CI into THIS repo
```

Layout (built stage-by-stage per the plan):

- `hooks/`    — `hooks.json` + extensionless session hooks via `run-hook.cmd` (S2)
- `skills/`   — `using-rules-as-tests` bootstrap + consumer-facing skills (S3)
- `agents/`   — consumer-facing sub-agent subset (S4)
- `commands/` — `/install-enforcement` (S5)
- `install/`  — bundled `install.sh` + templates, the hard-layer payload (S5)

Spec: [`docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md`](../docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md).
Plan: [`docs/superpowers/plans/2026-06-22-cc-plugin-packaging.md`](../docs/superpowers/plans/2026-06-22-cc-plugin-packaging.md).
