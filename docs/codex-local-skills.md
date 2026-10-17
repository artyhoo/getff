# Local Codex skill bindings

> **Authoritative for:** local native skill discovery in this checkout (legacy-source cards, pre-`.agents/procedures` layout).
> **NOT authoritative for:** project goal, canonical procedures, native hook acceptance or PR #2066 delivery.

The native cards in `.agents/skills/` load the existing procedures in this checkout. They are generated using the legacy-source mode of the project Codex contributor renderer, with two additional plugin procedure entries. The original skill frontmatter and explicit invocation policies are preserved. Role cards load the original prompts under `agents/`.

Read the complete linked procedure before execution, then read its conditionally required references before the corresponding action. Resolve Markdown links against the file containing the link. Use the source directory named by the card for `${CLAUDE_SKILL_DIR}` and its resources. Preserve the operator's arguments; execute required shell blocks through the shell tool instead of treating their displayed code as executed evidence.

Claude-specific `Skill`, `Agent`, `AskUserQuestion`, tool allowlists and model names are procedure vocabulary, not native capabilities or authorization grants. Read companion skill files directly when a native skill invocation tool is unavailable. Use available question tools for clarification. Delegation requires operator or applicable instruction authorization; cold reviewers must receive only the specified immutable inputs without inherited authoring dialogue. If a required harness capability is unavailable, report the documented degradation or blocker rather than fabricate execution.

This setup installs discovery cards only. It does not install or trust hooks, change model settings, activate permission profiles, or certify native workflow execution. Existing project gates and operator authorization still apply.

Invoke a skill with `$arch`, `$pipeline`, `$dispatcher` or another registered name. Codex scans this checkout's `.agents/skills`; if the app's selector is stale, restart Codex and reopen this checkout.
