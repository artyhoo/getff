---
name: installing-enforcement
description: Use when the user wants to actually WIRE the hard enforcement layer (git pre-commit/pre-push hooks + CI) into their repo, or asks "how do I make these rules actually fail the build / block a commit / run in CI", or wants to turn the rules-as-tests methodology from advice into a build-failing gate. Explains the soft-vs-hard boundary and points at the /getff:install-enforcement command.
---

<!-- @harness-posture: cc-native-with-fallback — the namespaced plugin install command is native; other harnesses run the documented consumer installer workflow with the same requested profile -->

# Installing Enforcement

> **Authoritative for:** when and how to wire the plugin's hard enforcement layer (git hooks + CI) — the soft-vs-hard split and the `/getff:install-enforcement` flow.
> **NOT authoritative for:** the installer's deploy mechanics (those live in the project's `install.sh`); the project goal (see the consumer's own README / the framework `README#why-this-exists`).

The getff plugin ships in **two layers**. Knowing which one a request needs is the
whole job of this skill.

## The two layers

| Layer | What it is | How it ships |
|---|---|---|
| **Soft** (session-scoped) | skills, sub-agents, advisory/inject session hooks — they run *inside the agent session* and *advise* | **already live** the moment `/plugin install` finishes |
| **Hard** (repo-scoped) | `.husky` pre-commit/pre-push git hooks, the CI workflow, dev-deps, ESLint/vitest/Stryker configs — they *fail the build* | **opt-in**, via `/getff:install-enforcement` |

A plugin can **never** silently wire a consumer's git/CI — so the hard layer is deliberately
behind an explicit command, not the install. This is the project's own thesis applied to its
packaging: a plugin that *claimed* to install the build-failing enforcement by itself would be
exactly the "documents lie" failure the framework exists to prevent.

## When to wire the hard layer

Wire it when the user wants violations to **actually block** — a commit rejected, a PR red in CI —
not merely surfaced in the session. Signals: "make this fail the build", "block the commit",
"run in CI", "enforce, don't just advise", "set up the git hooks".

Do **not** wire it when the user only wants the methodology/advice (the soft layer already covers
that) or is just exploring.

## How to wire it

Run **`/getff:install-enforcement`**. It:

1. detects/confirms the stack (`ts-server` | `react-next`),
2. **previews** the changes (dry-run — writes nothing),
3. asks for explicit `[y/N]` consent,
4. on yes, resolves the project's **official `install.sh`** (Option C — no bundled copy)
   and runs it against the confirmed consumer repo, deploying `.husky` + CI.

The helper defaults to `main`, independently of the plugin version. If cloning the requested
ref fails, it stops without falling back to another source identity. Never call the default
release-pinned.
For a reviewed local checkout, set `RAT_INSTALL_SOURCE` to its absolute path and record its
HEAD plus any working-tree patch; this avoids the network fetch.

The installer preserves existing files unless `--force` is requested. Deployed files alone do
not prove active gates: report its `NOT wired` and verification output, dependency status,
`git config --get core.hooksPath`, and observed hook/check execution separately. CI delivery
means a workflow file exists; a CI run is a separate observation. Remind the user to commit
the delivered files. Do not claim missing dependencies were installed.

## Native fallback and input binding

Outside Claude's registered plugin command, execute the same installer seam through the shell;
never send `/getff:install-enforcement` as a shell command. Resolve `FRAMEWORK_ROOT` from the
checkout whose native card was loaded, not the literal link to another checkout. In a consumer
without this helper, obtain a reviewed framework checkout first; report a missing helper as
blocked rather than inventing a command. `FRAMEWORK_ROOT` is always the full reviewed
framework checkout containing `install.sh`, even when the skill came from a plugin package.
`CLAUDE_PLUGIN_ROOT` is a different root: the plugin package containing `install/`, not a
framework checkout. Never use it as `FRAMEWORK_ROOT` or `RAT_INSTALL_SOURCE`.
The registered plugin command uses that package's helper; keep its source policy explicit.

Bind `TARGET` to the absolute consumer git root (probe with `git -C <consumer> rev-parse
--show-toplevel`), and `STACK` to the confirmed `ts-server` or `react-next`. An explicit consumer
path wins over session cwd and `CLAUDE_PROJECT_DIR`; a nested cwd must resolve the same root.
Reject unknown stack/flags and an absent/non-repository target before applying. If the operator
only wants advice, explain the soft/hard boundary without invoking the installer.

For a reviewed local source, run this preview with those bound values:

```bash
CLAUDE_PROJECT_DIR="$TARGET" RAT_INSTALL_SOURCE="$FRAMEWORK_ROOT" \
  bash "$FRAMEWORK_ROOT/plugin/install/fetch-and-wire.sh" "$STACK"
```

For a plugin-package helper with that same reviewed local installer source, use this distinct
preview recipe (the package has `install/`, whereas the checkout has `plugin/install/`):

```bash
CLAUDE_PROJECT_DIR="$TARGET" RAT_INSTALL_SOURCE="$FRAMEWORK_ROOT" \
  bash "$CLAUDE_PLUGIN_ROOT/install/fetch-and-wire.sh" "$STACK"
```

The plugin apply form is this same command with `--apply`, only after the successful preview
and consent below. A requested profile still uses the full checkout's `install.sh`; a plugin
package alone cannot serve as that source.

Preserve the command, cwd, source, target, exit code, stdout and stderr. A nonzero exit is a
failed preview, never an empty successful plan; stop before apply and report the diagnostic.
Show the preview before requesting its required consent. In a noninteractive session without
an explicit yes for that target and plan, stop at preview. Earlier explicit consent for that
same disposable target/plan satisfies the gate; never infer yes from silence or `--apply`.

Only after a successful preview and consent, run:

```bash
CLAUDE_PROJECT_DIR="$TARGET" RAT_INSTALL_SOURCE="$FRAMEWORK_ROOT" \
  bash "$FRAMEWORK_ROOT/plugin/install/fetch-and-wire.sh" "$STACK" --apply
```

The seam does not accept `--profile` or `--full`. If the operator requests a particular
profile, preserve it by running `bash "$FRAMEWORK_ROOT/install.sh" "$STACK" --profile
"$PROFILE" --dry-run` from `TARGET`, then the same command without `--dry-run` after consent
(`PROFILE` must be `core`, `env` or `factory`). Do not silently drop profile arguments or append
them to the seam. Dependency installation and companions require their own installer-supported
options and authorization; a preview-only request never permits either. This fallback reuses
the consumer installer, not the contributor plugin or hook-trust bypass. Installation grants
no host trust and must not edit global configuration.

## Honest boundary (T16)

Never tell the user the *plugin* installed the git hooks/CI. The plugin delivered the soft layer;
**they** opted into the hard layer via this command, which ran the official installer in their
repo. Keep that distinction explicit — it is the difference between honest packaging and theatre.

## Without this skill

A request to make a rule fail the build can stop at session advice or imply git hooks were installed when the plugin only loaded prompts.

## With this skill

Recognize the hard-layer request and run the explicit install-enforcement flow: detect stack, preview changes, obtain its required consent, then invoke the official installer and report the concrete delivered gates.
