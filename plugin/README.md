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

**What «consumer-facing skills» means here.** Six derived plus two plugin-native. `getff` (the methodology) and `tool-bootstrapping` (stack-aware MCP/skill proposals) are generated from the framework's own `skills/`; `ai-doc`, `rule-research`, `rule-tests` and `template-audit` (the installer's CORE tier) are generated from `.claude/skills/` with repo-internal links rewritten to blob URLs; `installing-enforcement` (the hard-layer seam) and `using-getff` (the activation bootstrap) are plugin-native. The set is machine-checked twice: `scripts/generate-plugin-skills.sh` derives every generated entry (its entry table is the recorded membership), and principle 24 arm (g) gates membership plus content fidelity so it cannot change by a silent directory add.

`tool-bootstrapping` is here because this plugin's own `deps-hash-check` hook tells your session to «run /tool-bootstrapping to re-evaluate» when your manifest changes; shipping the instruction without the skill would be an instruction you cannot follow.

> **Superseded 2026-09-11 (plugin-skills-generator Stage 2).** This README previously defined the set as four and excluded `rule-research`/`rule-tests` because their own text is installer-bound (`./setup --full`; per-backend files «NOT delivered to consumers»). The operator's 2026-09-11 GO lifted that exclusion: the installer already ships all four as its consumer-facing CORE tier (`setup.d/lib.sh:61`), and this plugin bundles `install.sh` under `install/`, so the installer path the skills name exists on-channel. Both skills still name installer-only surfaces in prose; their links are rewritten to blob URLs so every reference resolves. Rationale + evidence: [`docs/meta-factory/research-patches/2026-09-11-plugin-skills-generator-stage0-reverif.md`](https://github.com/artyhoo/getff/blob/main/docs/meta-factory/research-patches/2026-09-11-plugin-skills-generator-stage0-reverif.md) §4 F5.

Spec: [`docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md`](https://github.com/artyhoo/getff/blob/main/docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md).
Plan: [`docs/superpowers/plans/2026-06-22-cc-plugin-packaging.md`](https://github.com/artyhoo/getff/blob/main/docs/superpowers/plans/2026-06-22-cc-plugin-packaging.md).
