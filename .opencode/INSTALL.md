<!-- scope:plugin-packaging -->
# Installing getff for OpenCode

> **Authoritative for:** the off-CC (OpenCode) install path for the getff plugin's **soft layer** — fetch-and-follow, the shared `plugin/skills/` body, the accepted SessionStart degradation, and the tool mapping.
> **NOT authoritative for:** the project goal — see [README.md#why-this-exists](../README.md#why-this-exists). The Claude Code install — see [INSTALL.md](../INSTALL.md) / the in-repo marketplace. The hard-layer installer mechanics — see [`install.sh`](../install.sh).

Claude Code gets the full plugin (skills auto-trigger via a SessionStart hook, sub-agents, the
`/install-enforcement` command). OpenCode gets the **same portable substrate** — the skills under
[`plugin/skills/`](../plugin/skills/) — with **one accepted degradation** (below). This is the
"fetch + follow" adapter: there is no OpenCode-native plugin shim; you point OpenCode at the
shared skills body.

## Prerequisites

- [OpenCode](https://opencode.ai) installed.
- A local checkout of this repo (the skills travel with the repo):
  ```bash
  git clone https://github.com/Yhooi2/rules-as-tests-aif.git
  ```

## Install — point OpenCode at the shared skills body

Add the repo's `plugin/skills/` to your `opencode.json` `skills.paths` (global or project-level):

```json
{
  "skills": {
    "paths": ["/abs/path/to/rules-as-tests-aif/plugin/skills"]
  }
}
```

Restart OpenCode. The skills (`using-getff`, `getff`, `installing-enforcement`)
are now discoverable via OpenCode's native `skill` tool.

## The one accepted degradation — read the bootstrap on demand

On Claude Code, a `SessionStart` hook injects the `using-getff` bootstrap automatically,
so the skills **auto-trigger** without you doing anything. **OpenCode has no equivalent
same-moment session-hook auto-injection** ([dual-implementation-discipline.md §3](../.claude/rules/dual-implementation-discipline.md)).

This is a **documented degradation, not a portability gap** — the skill content is fully portable;
only the auto-fire trigger is CC-native. The workaround is one line at the start of a session:

```text
use the skill tool to load using-getff
```

Read it once per session and it establishes the same instruction-priority ladder + "invoke the
relevant skill before responding" discipline the CC bootstrap injects.

## Tool mapping

The skills are authored against Claude Code tool names. On OpenCode:

| Skill references | OpenCode equivalent |
|---|---|
| `Skill` tool | OpenCode's native `skill` tool |
| `Task` with sub-agents | OpenCode `@mention` syntax |
| `TodoWrite` | `todowrite` |
| File ops (`Read`/`Edit`/`Write`/`Grep`/`Glob`) | your native tools |

## The hard layer (git hooks + CI) — also portable

The `/getff:install-enforcement` slash command is Claude-Code sugar, but the seam it
runs is plain bash and works anywhere:

```bash
# preview (writes nothing), then apply:
bash /abs/path/to/rules-as-tests-aif/plugin/install/fetch-and-wire.sh ts-server
bash /abs/path/to/rules-as-tests-aif/plugin/install/fetch-and-wire.sh ts-server --apply
```

It fetches the project's official `install.sh` and wires `.husky` + CI into the current repo —
the same honest soft/hard boundary as on Claude Code: the soft layer is the skills above; the
hard layer is this explicit, opt-in step.

## Other harnesses

Cursor, Codex, Aider, Windsurf: there is no per-harness adapter yet. They can read the same
`plugin/skills/*/SKILL.md` bodies directly, and [`AGENTS.md`](../AGENTS.md) carries the
cross-harness contributor context. A native adapter per harness is a follow-up, not part of v1.
