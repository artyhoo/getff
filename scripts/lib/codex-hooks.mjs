/** Shared native event/matcher mapping; callers own contributor/consumer scope. */
export function emitCodexHooks(source, commandFor) {
  const hooks = {};
  const degradations = [];
  for (const [event, entries] of Object.entries(source ?? {})) {
    if (event === 'PostToolUseFailure') {
      degradations.push({
        event,
        reason:
          'Codex 0.160.0 has no native PostToolUseFailure event; failed-write dispatch-loss warning has no registered equivalent.',
      });
      continue;
    }
    const mapped = [];
    for (const e of entries) {
      const name = e.command.match(
        /\/(?:\.claude\/hooks|scripts)\/([A-Za-z0-9_-]+)\.sh/,
      )?.[1];
      if (!name) throw new Error(`Codex: unmapped command ${e.command}`);
      // ZCode-only rewrite; native SubagentStart delivers the canonical digest.
      if (name === 'inject-subagent-context') continue;
      let matcher = e.matcher?.split('|').flatMap((tool) => {
        if (tool === 'AskUserQuestion')
          return [tool, 'request_user_input', 'request_user_input_async'];
        if (['Edit', 'Write', 'MultiEdit'].includes(tool))
          return tool === 'MultiEdit' ? ['apply_patch'] : [tool, 'apply_patch'];
        if (tool === 'Bash') return [tool, 'exec_command'];
        return [tool];
      });
      matcher = matcher ? [...new Set(matcher)].join('|') : undefined;
      // Keep the underlying native tools registered; never parse outer code-mode JS.
      if (name === 'seal-primary-checkout' && event === 'PreToolUse')
        matcher = '*';
      if (
        name === 'inject-matching-rule' &&
        ['PreToolUse', 'PostToolUse'].includes(event)
      )
        matcher = [
          ...new Set([...(matcher?.split('|') ?? []), 'Bash', 'exec_command']),
        ].join('|');
      mapped.push({
        ...(matcher ? { matcher } : {}),
        hooks: [
          {
            type: 'command',
            command: commandFor(name, event),
            timeout: name === 'link-coordination' ? 360 : 45,
          },
        ],
      });
    }
    if (mapped.length) hooks[event] = mapped;
  }
  return { hooks, degradations };
}
