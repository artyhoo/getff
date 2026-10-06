#!/usr/bin/env node
/**
 * render-codex-contributor — derive contributor skills, agents, MCP and hooks from canonical sources.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { emitCodexHooks } from './lib/codex-hooks.mjs';

export function emitCodex(model, root) {
  const { hooks, degradations } = emitCodexHooks(model.hooks, name =>
    `root="$(git rev-parse --show-toplevel 2>/dev/null)"; if [ -f "$root/.ai-factory/harness-model.json" ] && [ -f "$root/scripts/codex-hook-adapter.mjs" ]; then node "$root/scripts/codex-hook-adapter.mjs" ${name}; fi`,
  );
  degradations.push({
    mechanism: 'bounded-input-policy',
    reason:
      'Literal cat/head/tail reads and canonical deterministic deny rules only. Native Bash without effective cwd cannot resolve relative reads. Arbitrary interpreters, compound shell, write_stdin and unverified MCP contracts require executor policy; no permission profile is activated.',
  });
  const ops = [
    {
      kind: 'json',
      path: 'codex-contributor-plugin/hooks/hooks.json',
      value: { hooks },
    },
    {
      kind: 'json',
      path: 'codex-contributor-plugin/.codex-plugin/plugin.json',
      value: {
        name: 'getff-contributor',
        version: '0.1.0',
        description:
          'Session hooks for contributors to the getff framework. Requires this repository; no consumer installation.',
        hooks: './hooks/hooks.json',
      },
    },
    {
      kind: 'json',
      path: 'codex-contributor-plugin/.claude-plugin/marketplace.json',
      value: {
        name: 'getff-contributor-local',
        owner: { name: 'getff contributors' },
        plugins: [
          {
            name: 'getff-contributor',
            source: './',
            description: 'Contributor-only Codex session hooks',
            version: '0.1.0',
          },
        ],
      },
    },
  ];
  const toml = [
    '# Generated contributor MCP configuration. Operator owns permission/model policy.',
  ];
  for (const [name, s] of Object.entries(model.mcpServers ?? {})) {
    toml.push(`\n[mcp_servers.${JSON.stringify(name)}]`);
    for (const key of ['url', 'command', 'args'])
      if (s[key] !== undefined) toml.push(`${key} = ${JSON.stringify(s[key])}`);
    if (s.env) {
      toml.push(`[mcp_servers.${JSON.stringify(name)}.env]`);
      for (const [k, v] of Object.entries(s.env))
        toml.push(`${JSON.stringify(k)} = ${JSON.stringify(String(v))}`);
    }
  }
  ops.push({
    kind: 'text',
    path: '.codex/config.toml',
    value: toml.join('\n') + '\n',
  });
  const sources = new Map();
  const canonical = existsSync(join(root, '.agents/procedures'));
  for (const base of canonical
    ? ['.agents/procedures']
    : ['skills', model.skillsDir ?? '.claude/skills']) {
    if (!existsSync(join(root, base))) continue;
    for (const entry of readdirSync(join(root, base), { withFileTypes: true })) {
      // The consumer bootstrap and contributor bootstrap are deliberately different roles.
      if (canonical && entry.name === 'tool-bootstrapping-consumer') continue;
      if (entry.isDirectory() && existsSync(join(root, base, entry.name, 'SKILL.md')))
        sources.set(entry.name, `${base}/${entry.name}`);
    }
  }
  const inventory = [];
  for (const [name, source] of sources) {
    const original = readFileSync(join(root, source, 'SKILL.md'), 'utf8');
    const explicit = /^disable-model-invocation:\s*true\s*$/m.test(original);
    const metadata = /^---\r?\n[\s\S]*?\r?\n---/.exec(original)?.[0];
    if (!metadata) throw new Error(`Codex: missing skill metadata in ${source}/SKILL.md`);
    const value = `${metadata}\n\n> Generated native entry from \`${source}/SKILL.md\`; shared procedure is authored once.\n> **Authoritative for:** native Codex discovery and full-source loading for this entry.\n> **NOT authoritative for:** the shared procedure; read the linked canonical owner.\n\nRead [the complete canonical procedure](../../../${source}/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Bind arguments from the operator invocation. Execute each mandatory shell block through the shell tool. Replace \`\$\{CLAUDE_SKILL_DIR\}\` with \`${source}\` when reading a legacy procedure. Model/tool frontmatter grants no authority on this host.\n`;
    ops.push({ kind: 'text', path: `.agents/skills/${name}/SKILL.md`, value });
    ops.push({
      kind: 'text', path: `.agents/skills/${name}/agents/openai.yaml`,
      value: `policy:\n  allow_implicit_invocation: ${!explicit}\n`,
    });
    for (const child of readdirSync(join(root, source), { withFileTypes: true })) {
      if (child.name === 'SKILL.md' || child.name === 'agents') continue;
      ops.push({
        kind: 'symlink', path: `.agents/skills/${name}/${child.name}`,
        target: relative(join(root, '.agents/skills', name), join(root, source, child.name)),
      });
    }
    inventory.push({ name, source, explicit });
  }
  // Agent prompts are portable procedures. No invented native role/model grants.
  const rolesDir = existsSync(join(root, '.agents/roles')) ? '.agents/roles' : 'agents';
  if (existsSync(join(root, rolesDir)))
    for (const entry of readdirSync(join(root, rolesDir))) {
      if (!entry.endsWith('.md')) continue;
      const name = entry.slice(0, -3);
      const procedure = readFileSync(join(root, rolesDir, entry), 'utf8');
      const scalar = /^description: ([^\n]*)$/m.exec(procedure);
      let description = scalar?.[1] ?? `Canonical ${name} procedure`;
      if (/^[>|][-+]?$/.test(description)) {
        const block = procedure.slice(scalar.index + scalar[0].length).match(/^\n((?:[ \t]+[^\n]*\n)+)/)?.[1] ?? '';
        const lines = block.trimEnd().split('\n').map(line => line.trim());
        description = lines.join(description.startsWith('>') ? ' ' : '\n');
      }
      const tools = /^tools: (.*)$/m.exec(procedure)?.[1] ?? '';
      const readOnly = tools && !/\b(Write|Edit|NotebookEdit)\b/.test(tools);
      const instruction = `Read ${rolesDir}/${entry} in the active repository before proceeding. Follow its complete procedure, output contract and docs/codex-contributor.md host bindings. The canonical prompt owns the workflow; this file only binds a native role. Host authorization controls delegation.`;
      ops.push({
        kind: 'text',
        path: `.codex/agents/${name}.toml`,
        value: `name = ${JSON.stringify(name)}\ndescription = ${JSON.stringify(description)}\n${readOnly ? 'sandbox_mode = "read-only"\n' : ''}developer_instructions = ${JSON.stringify(instruction)}\n`,
      });
      ops.push({
        kind: 'text',
        path: `.agents/skills/${name}/SKILL.md`,
        value: `---\nname: ${name}\ndescription: Read the canonical ${name} procedure when explicitly asked to run that review or audit.\n---\n\n> **Authoritative for:** native discovery and full-source loading for this role.\n> **NOT authoritative for:** the shared role procedure; read its canonical owner.\n\nRead [${rolesDir}/${entry}](../../../${rolesDir}/${entry}) in full. Follow its procedure and [Codex bindings](../../../docs/codex-contributor.md). For a cold seat, spawn without inherited conversation and pass only its required inputs. This skill does not authorize spawning a subagent.\n`,
      });
      ops.push({
        kind: 'text',
        path: `.agents/skills/${name}/agents/openai.yaml`,
        value: 'policy:\n  allow_implicit_invocation: false\n',
      });
      inventory.push({ name, source: `${rolesDir}/${entry}`, explicit: true });
    }
  const generated = ops.map((op) => ({
    path: op.path,
    kind: op.kind,
    fingerprint:
      op.kind === 'symlink'
        ? op.target
        : createHash('sha256')
            .update(
              op.kind === 'json'
                ? JSON.stringify(op.value, null, 2) + '\n'
                : op.value,
            )
            .digest('hex'),
  }));
  const previousPath = join(root, '.codex/contributor-inventory.json');
  if (existsSync(previousPath)) {
    const previous = JSON.parse(readFileSync(previousPath, 'utf8'));
    for (const retired of previous.generated ?? [])
      if (!generated.some((op) => op.path === retired.path)) {
        const resolved = relative(resolve(root), resolve(root, retired.path));
        if (
          resolved !== retired.path ||
          (!resolved.startsWith('.agents/skills/') &&
            !resolved.startsWith('.codex/agents/'))
        )
          throw new Error(
            `Codex: refusing retired path outside managed skill/agent roots: ${retired.path}`,
          );
        ops.push({
          kind: 'remove-owned',
          path: retired.path,
          previousKind: retired.kind,
          fingerprint: retired.fingerprint,
        });
      }
  }
  ops.push({
    kind: 'json',
    path: '.codex/contributor-inventory.json',
    value: {
      skills: inventory,
      generated,
      hookAdapter: 'scripts/codex-hook-adapter.mjs',
      hooks: Object.fromEntries(
        Object.entries(hooks).map(([e, groups]) => [e, groups.length]),
      ),
      degradations,
    },
  });
  return ops;
}
