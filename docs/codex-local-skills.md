# Local Codex skill bindings

> **Authoritative for:** Codex contributor discovery and host bindings in this checkout.
> **NOT authoritative for:** project goal, canonical procedures, native hook acceptance or PR #2066 delivery.

The native cards in `.agents/skills/` load the existing procedures in this checkout. `scripts/render-codex-contributor.mjs` derives them from `.claude/skills/`, `skills/`, `plugin/skills/` and `agents/`. Project-specific sources override shipped twins of the same name; plugin-only entries are retained. The original skill frontmatter and explicit invocation policies are preserved. Role cards load the original prompts under `agents/`.

Read the complete linked procedure before execution, then read its conditionally required references before the corresponding action. Resolve Markdown links against the file containing the link. Use the source directory named by the card for `${CLAUDE_SKILL_DIR}` and its resources. Preserve the operator's arguments; execute required shell blocks through the shell tool instead of treating their displayed code as executed evidence.

Claude-specific `Skill`, `Agent`, `AskUserQuestion`, tool allowlists and model names are procedure vocabulary, not native capabilities or authorization grants. Read companion skill files directly when a native skill invocation tool is unavailable. Use available question tools for clarification. Delegation requires operator or applicable instruction authorization; cold reviewers must receive only the specified immutable inputs without inherited authoring dialogue. If a required harness capability is unavailable, report the documented degradation or blocker rather than fabricate execution.

This setup installs discovery cards only. It does not install or trust hooks, change model settings, activate permission profiles, or certify native workflow execution. Existing project gates and operator authorization still apply.

Invoke a skill with `$arch`, `$pipeline`, `$dispatcher` or another registered name. Codex scans this checkout's `.agents/skills`; if the app's selector is stale, restart Codex and reopen this checkout.

## Question-tool binding

`AskUserQuestion` means the question carrier permitted by this host, not a tool
name to call literally. Read the current schema and mode restrictions before use.

| Available carrier                                        | Complete card field                                                                                     | Selectable alternatives                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `request_user_input_async`                               | Each `questions[].title` contains the self-contained numbered card                                      | `options` is an array of actual answer strings, recommendation first and marked recommended; include each consequence in its string |
| `request_user_input` (Plan mode only)                    | Each `questions[].question` contains the self-contained numbered card; `header` is only its short label | `options[]` has `label` and `description`; recommended label first, consequence in description; obey its 1–3 question limit         |
| Neither is permitted, or the whole frontier does not fit | One numbered text round in the final reply                                                              | Show the same alternatives, consequences and per-question recommendation in text                                                    |

For `/arch`, load the full-card source required by canonical `references/ideation.md`.
The carrier preserves its round opening, every complete card and one closing
answer instruction (opening in the first question field, closing in the last when
using a tool). Do not put questions in commentary when the host forbids it. The
option array is required for choice-shaped questions even when the same options
are explained in the card. Use 2–3 meaningful alternatives where the schema calls
for them; do not add a fake “Other” option when the UI already provides free text.
A single general recommendation after the round cannot replace each card's own
reasoned recommendation.

An async tool's accepted/queued result confirms delivery only. Keep the questions
pending until the operator answers; continue only independent work. Preselection,
time passing, silence and skipped cards are not answers. Do not duplicate an
already delivered round just because the async call returned immediately.

After compaction, reload the canonical phase and its required companions/card
source; restore the confirmed answers and open frontier from the conversation or
permitted durable register before proceeding. Tool availability may have changed.

## Files, shell and companion procedures

- `Read/Grep/Glob` map to file reads/search; `Bash` maps to the shell tool;
  `Write/Edit` map to the available file-edit tool. An instruction's tool allowlist
  does not create a tool or override host permissions.
- Run from the requested checkout root. Bind `CLAUDE_PROJECT_DIR` to that root,
  `CLAUDE_SKILL_DIR` to the canonical directory printed by the card, and
  `CLAUDE_PLUGIN_ROOT` to this checkout's `plugin/` for its plugin procedures
  (not `codex-contributor-plugin/`, which only registers contributor hooks).
  Bind `$ARGUMENTS` and named arguments from the invocation as data; quote them,
  do not evaluate user text as shell code. Set variables per shell call: one
  call's exports are not evidence they persist in another shell.
- Both fenced ` ```! ` blocks and inline `!bash …` are instructions to run a
  shell tool after substituting the source directory. Codex does not perform
  Claude's shell interpolation on file read. Inspect output, respect failures,
  and follow mode-specific conditions; a displayed command is not a result.
- `/getff:install-enforcement` loads
  [the command procedure](../plugin/commands/install-enforcement.md) in full.
  Run its helper with `bash` and the above root bindings; preview and explicit
  consent remain separate stages. A native skill entry does not install hooks.
- `Skill(...)` loads the full procedure from the active skill catalog. If not
  listed there, inspect installed plugin metadata/files; use a documented
  vendored fallback when supplied. Missing mandatory companions are reported
  before their dependent phase. Reading a file is only loading: execute its
  required steps, conditional references and output contract. Use the wrapper's
  explicit collision bindings (such as `/arch` rounds) over companion defaults.
- `Agent/Task` means an available collaboration subagent when authorized. Use
  a fresh context for cold reviews. Claude model aliases (`opus`, `sonnet`,
  `haiku`) express the canonical relative tier, not Codex model ids. Check the
  actual host model/tool list; report a missing required capability. Tools for
  separate user-owned chats are not interchangeable with subagents or AIF jobs.
- Native MCP discovery and `.mcp.json` are different configuration surfaces.
  Check callable tools, not just files. `WebSearch/WebFetch` use the available
  web tools; do not claim Context7/DeepWiki execution from a web search. Use only
  the fallback the procedure permits, and report unavailable required evidence.
- Claude-only procedures keep their scope. In particular
  `claude-glm-executor-handoff` describes an in-AIF Claude coordinator/GLM worker;
  reading it in Codex does not create that runtime. `TodoWrite` maps to the
  available plan/task tracking tool or a session checklist, not a fabricated call.

## Regeneration and compatibility

From this checkout, run:

```bash
node scripts/render-harness-config.mjs --write --only codex
node scripts/render-harness-config.mjs --check --only codex
node --test scripts/codex-contributor.test.mjs scripts/codex-skills.test.mjs scripts/codex-hook-adapter.test.mjs
node scripts/codex-contributor-doctor.mjs --check
```

`--only codex` leaves Claude settings alone. `.codex/config.toml` is seeded only
when absent; existing operator configuration is preserved byte for byte. Model
changes to MCP defaults therefore require an explicit config merge, not
regeneration. The generator retains explicit-only
invocation policy and source-relative resources for every card. The tests exercise
source integration; the doctor checks native discovery, enabled skills, registration and trust, not
semantic skill compliance. `--check` fails when a required skill is disabled, a
definition is missing or stale, or a hook is not enabled and trusted. Its `ready`
flag covers those checks only; inspect `degradations` separately. The installed contributor plugin carries the adapter, its entry-point helper
and its language resolver under `runtime/`. It selects the active Git checkout
and runs that checkout's canonical hooks. An older checkout therefore does not
need a local `scripts/codex-hook-adapter.mjs` just to execute installed hooks.
Skill procedure fixes still require updating their source checkout; bundling the
adapter does not distribute canonical skill changes to older revisions.

The doctor also compares installed runtime bytes with the generated package.
Missing or stale package files make `ready=false`. A damaged package remains a
visible PreToolUse failure, but its Stop handler does not block completion and
cannot create the missing-runtime retry loop.

To install or refresh the contributor registration from this checkout:

```bash
codex plugin marketplace add ./codex-contributor-plugin
codex plugin add getff-contributor@getff-contributor-local
```

The cache is a snapshot. Review changed definitions in Codex's hook browser and
trust them through its normal UI; Full Access does not grant hook trust. Do not
edit trust hashes or bypass the trust check. The plugin uses the active checkout's
canonical hooks. Its bundled adapter is delivery infrastructure, not a copied
factory runtime or an end-to-end certification.

The local marketplace source path must remain available for future refreshes.
After moving or retiring its worktree, re-register the same marketplace from a
checkout containing these generated manifests before updating the plugin. The
installed cache remains a snapshot; its presence alone does not prove the source
or active checkout is compatible. See [acceptance evidence](codex-skills-acceptance.md)
for the checked population and remaining native limitations.
