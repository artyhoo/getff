#!/usr/bin/env node
/** Derive native consumer hooks only from delivered, registered framework checks. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitCodexHooks } from '../scripts/lib/codex-hooks.mjs';
import { isMainEntry } from '../scripts/lib/is-main-entry.mjs';

export function consumerCodexHooks(root) {
  const settings = join(root, '.claude/settings.json');
  let source = {};
  try { if (existsSync(settings)) source = JSON.parse(readFileSync(settings, 'utf8')).hooks ?? {}; }
  catch { throw new Error('Consumer settings are not valid JSON; native hooks were not generated'); }
  const selected = {};
  const supported = new Set(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'SubagentStart', 'SubagentStop', 'PreCompact', 'PostToolUseFailure']);
  for (const [event, entries] of Object.entries(source)) {
    if (!supported.has(event)) continue;
    for (const entry of entries) for (const hook of entry.hooks ?? []) {
      if (hook.type !== 'command') continue;
      // Only the installer-owned shell form is portable. Never run arbitrary consumer commands.
      const match = /^bash (?:(?:"\$CLAUDE_PROJECT_DIR\/\.claude\/hooks\/([\w-]+)\.sh")|(?:\.claude\/hooks\/([\w-]+)\.sh))$/.exec(hook.command ?? '');
      const name = match?.[1] ?? match?.[2];
      if (!name || name === 'seal-primary-checkout' || !existsSync(join(root, '.agents/hooks', `${name}.sh`))) continue;
      (selected[event] ??= []).push({ matcher: entry.matcher, command: `/.claude/hooks/${name}.sh` });
    }
  }
  return emitCodexHooks(selected, name =>
    `root="$PWD"; while [ ! -f "$root/.codex/hooks.json" ] && [ "$root" != / ]; do root="\${root%/*}"; root="\${root:-/}"; done; node "$root/scripts/codex-hook-adapter.mjs" ${name}`,
  );
}

if (isMainEntry(import.meta.url)) {
  const { hooks, degradations } = consumerCodexHooks(process.argv[2]);
  for (const degradation of degradations) console.error(`Codex: ${degradation.reason}`);
  process.stdout.write(JSON.stringify({ hooks }, null, 2) + '\n');
}
