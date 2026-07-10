---
description: Opt-in — wire the HARD enforcement layer (git hooks + CI) into THIS repo by fetching and running the project's official installer. Dry-run first, consent-gated. The plugin's soft layer (skills/agents/session hooks) is already live; this is the separate bridge to the part a plugin can never silently install.
---

# /getff:install-enforcement

Wire the **hard** enforcement layer — `.husky` pre-commit/pre-push git hooks, the CI workflow,
and the dev-deps they need — into the user's current repository (`$CLAUDE_PROJECT_DIR`).

This is the **honest boundary** (T16): the plugin delivers the soft, session-scoped layer
(skills, sub-agents, advisory hooks) on install. It does **not** silently mutate the repo's
git/CI — a plugin that claimed to would be lying. This command is the explicit, opt-in bridge:
it fetches the project's **own official `install.sh`** (Option C — no bundled copy) and runs it
against the current repo.

## Steps

1. **Confirm the stack.** Ask the user which stack to wire if it is not obvious from the repo:
   `ts-server` (default — Node/TypeScript server) or `react-next` (Next.js/React). Look at the
   repo first (`package.json` deps: `next` → `react-next`, else `ts-server`) and propose one.

2. **Preview (dry-run — writes nothing).** Run the seam helper in its default dry-run mode and
   show the user the full plan:

   ```bash
   "${CLAUDE_PLUGIN_ROOT}/install/fetch-and-wire.sh" <stack>
   ```

   This fetches the official installer (pinned to the plugin version) and runs
   `install.sh <stack> --dry-run` against `$CLAUDE_PROJECT_DIR`. Nothing is written.

3. **Get explicit consent.** Show the preview, then ask the user `[y/N]` whether to apply it.
   Default is **No**. Do not proceed without an explicit yes.

4. **Apply (only on yes).** Run the real wiring:

   ```bash
   "${CLAUDE_PLUGIN_ROOT}/install/fetch-and-wire.sh" <stack> --apply
   ```

   This wires `.husky/pre-commit` + `.husky/pre-push`, the CI workflow, and the configs. The
   underlying `install.sh` is idempotent and never overwrites existing files without `--force`.

5. **Report.** Summarise what was wired (the `.husky` hooks + CI workflow) and remind the user to
   commit the changes and install the dev-deps the hooks need (the installer prints the list; it
   does not auto-install them unless re-run with `--full`).

## Notes

- **Offline / no network:** the helper fetches the installer from the project repo. If the user
  is offline or behind a firewall, point them at the repo's `install.sh` directly, or set
  `RAT_INSTALL_SOURCE=/path/to/a/local/checkout` before running.
- **Soft vs hard:** if the user only wants the skills/agents (no git-hook/CI enforcement), they do
  **not** need this command — those are already live from `/plugin install`.
