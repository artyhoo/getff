# getff — plugin payload

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
- `skills/`   — `using-getff` bootstrap + the consumer-facing skill set (S3) — defined below
- `agents/`   — consumer-facing sub-agent subset (S4)
- `commands/` — `/install-enforcement` (S5)
- `install/`  — bundled `install.sh` + templates, the hard-layer payload (S5)

**What «consumer-facing skills» means here.** Four: `getff` (the methodology) and `tool-bootstrapping` (stack-aware MCP/skill proposals) come from the framework's own `skills/`; `installing-enforcement` (the hard-layer seam) and `using-getff` (the activation bootstrap) are plugin-native. The term was previously used here undefined, which is how the set drifted from the packaging spec unnoticed — it is defined now, and principle 24 arm (g) gates it so it cannot change by a silent directory add.

`tool-bootstrapping` is here because this plugin's own `deps-hash-check` hook tells your session to «run /tool-bootstrapping to re-evaluate» when your manifest changes; shipping the instruction without the skill would be an instruction you cannot follow.

The set is deliberately narrower than what `./setup` installs. The rule-authoring skills (`rule-research`, `rule-tests`) are bound to the installer by their own text — one ends its protocol in `./setup --full`, the other reads per-backend files it states are not delivered to consumers — so shipping them here would ship instructions their reader cannot execute. Run `./setup` if you want those.

Spec: [`docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md`](../docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md).
Plan: [`docs/superpowers/plans/2026-06-22-cc-plugin-packaging.md`](../docs/superpowers/plans/2026-06-22-cc-plugin-packaging.md).
