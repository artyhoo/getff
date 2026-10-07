#!/usr/bin/env node
/**
 * codex-contributor-doctor — probe native Codex discovery and activation without mutating trust.
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { isMainEntry } from './lib/is-main-entry.mjs';
import { readFileSync } from 'node:fs';
export function compareHookDefinitions(definitions, nativeHooks) {
  const key = (event, matcher, handler) =>
    JSON.stringify([
      event,
      matcher ?? null,
      handler.command,
      handler.type ?? handler.handlerType,
      handler.async ?? false,
      handler.timeout ?? handler.timeoutSec ?? null,
      handler.statusMessage ?? null,
      handler.additionalContextLimit ?? null,
    ]);
  const expected = Object.entries(definitions).flatMap(([event, groups]) =>
    groups.flatMap((g) =>
      g.hooks.map((h) =>
        key(event[0].toLowerCase() + event.slice(1), g.matcher, h),
      ),
    ),
  );
  const actual = nativeHooks.map((h) => key(h.eventName, h.matcher, h));
  // Consume matches: duplicate definitions need duplicate native registrations.
  return expected.filter((k) => {
    const i = actual.indexOf(k);
    if (i < 0) return true;
    actual.splice(i, 1);
    return false;
  });
}

export function comparePackagedRuntime(generated, nativeHooks) {
  const expected = (generated ?? []).filter((op) =>
    op.path.startsWith('codex-contributor-plugin/runtime/'),
  );
  const roots = [
    ...new Set(
      nativeHooks
        .filter((h) => h.sourcePath)
        .map((h) => dirname(dirname(h.sourcePath))),
    ),
  ];
  const problems = [];
  for (const op of expected) {
    if (!roots.length) {
      problems.push(`${op.path}: installed plugin source unavailable`);
      continue;
    }
    for (const root of roots) {
      const relative = op.path.slice('codex-contributor-plugin/'.length);
      if (relative.split('/').includes('..'))
        throw new Error('Invalid packaged runtime inventory path');
      const path = resolve(root, relative);
      try {
        const hash = createHash('sha256')
          .update(readFileSync(path))
          .digest('hex');
        if (hash !== op.fingerprint)
          problems.push(
            `${path}: installed runtime differs from generated source`,
          );
      } catch {
        problems.push(`${path}: installed runtime missing or unreadable`);
      }
    }
  }
  return problems;
}

if (isMainEntry(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const child = spawn('codex', ['app-server', '--stdio'], {
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let next = 0,
    buffer = '';
  const pending = new Map();
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const end = buffer.indexOf('\n');
      if (end < 0) break;
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (pending.has(message.id)) {
        const p = pending.get(message.id);
        clearTimeout(p.timer);
        pending.delete(message.id);
        p.resolve(message);
      }
    }
  });
  child.stderr.resume();
  function rejectPending(error) {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    pending.clear();
  }
  child.on('error', rejectPending);
  child.on('exit', () => rejectPending(new Error('Codex app-server exited')));
  function rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method}: timeout`));
      }, 20000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  try {
    const hello = await rpc('initialize', {
      clientInfo: { name: 'getff-contributor-doctor', version: '0.1' },
      capabilities: { experimentalApi: true },
    });
    const results = [];
    for (const method of ['skills/list', 'hooks/list', 'config/read']) {
      const params =
        method === 'config/read'
          ? { cwd: root, includeLayers: true }
          : {
              cwds: [root],
              ...(method === 'skills/list' ? { forceReload: true } : {}),
            };
      const r = await rpc(method, params);
      if (r.error) throw new Error(`${method}: ${JSON.stringify(r.error)}`);
      results.push(r.result);
    }
    const [skills, hooks, config] = results;
    const hookEntry = hooks.data[0],
      skillEntry = skills.data[0];
    const inventory = JSON.parse(
      readFileSync(resolve(root, '.codex/contributor-inventory.json'), 'utf8'),
    );
    const nativeSkills = skillEntry.skills.filter((s) =>
      s.path.startsWith(root + '/.agents/skills/'),
    );
    const nativeHooks = hookEntry.hooks.filter(
      (h) => h.pluginId === 'getff-contributor@getff-contributor-local',
    );
    const expectedHooks = Object.values(inventory.hooks).reduce(
      (a, b) => a + b,
      0,
    );
    const definitions = JSON.parse(
      readFileSync(
        resolve(root, 'codex-contributor-plugin/hooks/hooks.json'),
        'utf8',
      ),
    ).hooks;
    const missingDefinitions = compareHookDefinitions(definitions, nativeHooks);
    const report = {
      runtime: hello.result?.userAgent,
      root,
      projectSkills: nativeSkills.map((s) => ({
        name: s.name,
        path: s.path,
        enabled: s.enabled,
      })),
      missingSkills: inventory.skills
        .filter((s) => !nativeSkills.some((n) => n.name === s.name))
        .map((s) => s.name),
      disabledSkills: inventory.skills
        .filter((s) =>
          nativeSkills.some((n) => n.name === s.name && n.enabled !== true),
        )
        .map((s) => s.name),
      expectedHooks,
      missingDefinitions,
      runtimeProblems: comparePackagedRuntime(inventory.generated, nativeHooks),
      degradations: inventory.degradations,
      contributorHooks: nativeHooks.map((h) => ({
        event: h.eventName,
        matcher: h.matcher,
        command: h.command,
        enabled: h.enabled,
        trust: h.trustStatus,
        hash: h.currentHash,
        sourcePath: h.sourcePath,
      })),
      warnings: [
        ...skillEntry.errors,
        ...hookEntry.warnings,
        ...hookEntry.errors,
      ],
      mcpServers: Object.keys(config.config?.mcp_servers ?? {}),
      projectLayers: (config.layers ?? [])
        .filter((l) => l.name.type === 'project')
        .map((l) => ({
          name: l.name,
          disabledReason: l.disabledReason ?? null,
        })),
    };
    report.discovered =
      report.missingSkills.length === 0 &&
      missingDefinitions.length === 0 &&
      nativeHooks.length === expectedHooks &&
      report.warnings.length === 0;
    report.skillsActivated =
      report.missingSkills.length === 0 && report.disabledSkills.length === 0;
    report.hooksActivated =
      report.discovered &&
      nativeHooks.every(
        (h) => h.enabled && ['trusted', 'managed'].includes(h.trustStatus),
      );
    report.ready =
      report.hooksActivated &&
      report.skillsActivated &&
      report.runtimeProblems.length === 0;
    console.log(JSON.stringify(report, null, 2));
    if (process.argv.includes('--check') && !report.ready) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    child.stdin.end();
    child.kill();
  }
}
