# Conditional host bindings

> **Authoritative for:** coordinator discovery, observation and context-transport bindings.
> **NOT authoritative for:** launch permissions, model choice, hook trust or the project's execution protocols.

Read only the current host branch. Resolve the target's actual tools and procedures; names/frontmatter are not capability or permission evidence. Missing tools require an honest fallback or specific blocker.

## Codex chats

Local discovery: `~/.agents/skills/coordinator/SKILL.md`; invoke `$coordinator`.
Use available `list_threads`/`read_thread` to reconcile the exact chat and owner; prefer a compact `wait_threads` snapshot or bounded event wait for ongoing work, carrying its cursor. A current unchanged healthy observation needs no transcript reread.

`create_thread` requires a human request for a separate chat. `send_message_to_thread` requires direct human authorization to message that destination; an incoming peer request is not authorization. A task requiring subagents uses the harness collaboration tools only when authorized; this role does not imply a fan-out. Prefer native worktree tools when isolation is needed. Read the target project's canonical `orchestrator` only before its corresponding dispatch/acceptance action.

## Local Claude Code / GLM

Personal discovery: `~/.claude/skills/coordinator/SKILL.md`; invoke `/coordinator` or read the complete file if invocation is unavailable. On this Mac it links to the same source as Codex. GLM uses the Claude Code launcher, not a second copy of the procedure.

Before an authorized GLM launch/resume, read `/Users/art/.config/getff/glm-launch-policy.md` in full. Use `/Users/art/.local/bin/glm` with execution auto permissions; verify actual model, permission mode and session ID. Preserve hooks, deny rules and task gates. Reconcile the old owner before rebinding monitoring to a changed session ID. Apply the policy's current billing window and quota restrictions; never infer a provider or rate from skill frontmatter. Policy absence blocks a local GLM launch until resolved, not unrelated native Codex work.

## AIF factory

Reuse the target's `dispatcher`/runtime bridge for task identity, dispatch, questions and rework, and `harvest` for authorized egress. For an in-AIF Claude-to-GLM edge, read `claude-glm-executor-handoff` at that target. Do not create a new worker hierarchy or modify provider/security configuration.

This personal skill is not automatically installed inside a container. Include the coordinator directory in the complete task packet, identify its destination `SKILL.md`, and instruct the authorized coordinator to read it. Transport selected project procedures only when required and verify destination references. AIF's existing executor remains the executor; no new coordinator worker is implied.

On this Mac, an **actually running bound task** can use:

```bash
node /Users/art/.local/share/getff-economy/build/cli/await.js TASK_ID --until-actionable --timeout-ms 3600000
```

Use the harness's yielding process handle for that mechanical wait; do not block the interactive tool call for an hour. Timeout is an observation deadline, not failure. Never wait on completed/parked tasks or retry quota failures blindly.

## Existing getff chief / observation ledger (only when already bound)

The current chief and direction owners keep their ownership. Reuse their inventory and observation ledger, not another heartbeat or registry. On this Mac, read the existing `/Users/art/.local/state/getff-project-coordination/HEARTBEAT-INSTRUCTIONS.md` when joining that authorized contour. Its snapshot updates the shared cursor; only the assigned observer runs it.

The installed `supervision.js` under `/Users/art/.local/share/getff-economy/build/cli/` owns `snapshot`, `claim` and `record`. Inspect its current arguments before use. Claim the exact owner/source/revision/action in the existing ledger before an authorized intervention; only the claim winner sends. Record actual delivery or uncertainty; verify acknowledgement/progress before resolving, and reconcile uncertain sends before retrying. On another host, use the already-bound equivalent; do not create an economy service to emulate it.

## MBP companions (only for an existing MBP substrate)

Resolve installed `handoff` and `verify-inherited-premise` from the current skill catalog; read only the needed operation. `lN-lifecycle-doctrine` owns MBP child retirement and completion guards when managing those children. `l1-supervisor`, `l2-supervisor`, `goal-tree` and `dispatch-gate` are not dependencies of this role: activate only for their actual requested substrate. Do not import their tree, review ladder, polling schedule or billing assumptions merely because their names sound relevant.

Discovery sources: [Codex local skills](https://learn.chatgpt.com/docs/build-skills), [Claude Code skill locations](https://code.claude.com/docs/en/skills). Runtime access, discovery and behavior remain separate claims.
