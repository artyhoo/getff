#!/usr/bin/env node
/**
 * check-ships-manifest — Arm A of the ships manifest (one-button point 13): every skill, hook,
 * rule, agent, setting and MCP server getff has carries ONE row in setup.d/ships.manifest that
 * says whether it ships (and through which channel) or is internal, and why.
 *
 * WHY: membership lived in seven hand-kept places and two of them went stale without any check
 * failing — `docs-author` landed in no tier and nothing noticed (plan F4). An unmarked new item
 * now fails here, at pre-commit, and in CI on the whole population.
 *
 * What it checks, all without installing anything:
 *   - population (from `git ls-files`, so an untracked scratch dir never counts) vs rows:
 *     an item with no row, a row with no item, a duplicate row;
 *   - row grammar: 6 TAB fields, kind / verdict / installer / plugin vocabularies;
 *   - reason rules (see the header of setup.d/ships.manifest);
 *   - the plugin column against the plugin tree (plugin/skills, plugin/agents, the names
 *     plugin/hooks/hooks.json registers; the plugin ships no settings, rules or MCP servers);
 *   - a skill's installer column against its tier in setup.d/lib.sh, read through the ONE
 *     tier reader scripts/lib/skill-tiers.mjs (never a second parser);
 *   - `ask` settings (the session-settings group, written only on the pre-launch «yes») against
 *     setup.d/session-settings.json: every `ask` row is in that file with getff's own value (an
 *     array may be a subset), and every key of that file is an `ask` row.
 * Whether the installer really delivers each row at its declared depth is Arm B, a real install:
 * tests/install-sh/ships-manifest.test.sh.
 *
 * Usage: node scripts/check-ships-manifest.mjs [--root <repo>]   exit 0 clean, 1 findings, 2 usage.
 * Channels: .husky/pre-commit (when a population path is staged) and audit-self.yml (always).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readTierSets } from './lib/skill-tiers.mjs';

const KINDS = ['skill', 'hook', 'rule', 'agent', 'setting', 'mcp'];
const VERDICTS = ['ships', 'internal'];
const INSTALLERS = ['core', 'env', 'factory', 'full', 'ask', 'no'];
const PLUGIN = ['yes', 'no'];
const MIN_REASON = 20;

function args(argv) {
  let root = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) root = argv[++i];
    else {
      console.error(`check-ships-manifest: unknown argument ${argv[i]}`);
      process.exit(2);
    }
  }
  return resolve(root);
}

function tracked(root) {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  return out.split('\0').filter(Boolean);
}

const readJson = (root, rel) => {
  const p = join(root, rel);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};

/** Names the plugin's hooks.json registers: `…/run-hook.cmd" <name>`. */
function pluginHookNames(root) {
  const j = readJson(root, 'plugin/hooks/hooks.json');
  const names = new Set();
  if (!j) return names;
  for (const groups of Object.values(j.hooks || {}))
    for (const g of groups || [])
      for (const h of g.hooks || []) {
        const m = /run-hook\.cmd"?\s+([A-Za-z0-9._-]+)/.exec(h.command || '');
        if (m) names.add(m[1]);
      }
  return names;
}

/** Row names of a settings object: top keys, object values expanded one level except `hooks`. */
function settingNames(s) {
  const names = [];
  for (const [k, v] of Object.entries(s || {})) {
    if (k === '$schema') continue;
    if (k !== 'hooks' && v && typeof v === 'object' && !Array.isArray(v))
      for (const sub of Object.keys(v)) names.push(`${k}.${sub}`);
    else names.push(k);
  }
  return names;
}

const getPath = (o, name) => name.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), o);

/** kind -> Set(name) of what getff has, plus the plugin-side facts. */
function population(root) {
  const files = tracked(root);
  const pop = Object.fromEntries(KINDS.map((k) => [k, new Set()]));
  const plugin = { skill: new Set(), agent: new Set(), hook: pluginHookNames(root) };
  for (const f of files) {
    let m;
    if ((m = /^(?:skills|\.claude\/skills)\/([^/]+)\/SKILL\.md$/.exec(f))) pop.skill.add(m[1]);
    else if ((m = /^plugin\/skills\/([^/]+)\/SKILL\.md$/.exec(f))) (pop.skill.add(m[1]), plugin.skill.add(m[1]));
    else if ((m = /^\.claude\/hooks\/([^/]+)\.sh$/.exec(f))) pop.hook.add(m[1]);
    else if ((m = /^\.claude\/rules\/([^/]+)\.md$/.exec(f))) pop.rule.add(m[1]);
    else if ((m = /^agents\/([^/]+)\.md$/.exec(f))) pop.agent.add(m[1]);
    else if ((m = /^plugin\/agents\/([^/]+)\.md$/.exec(f))) (pop.agent.add(m[1]), plugin.agent.add(m[1]));
  }
  for (const h of plugin.hook) pop.hook.add(h);
  if (files.includes('.claude/settings.json'))
    for (const n of settingNames(readJson(root, '.claude/settings.json'))) pop.setting.add(n);
  if (files.includes('.mcp.json'))
    for (const k of Object.keys((readJson(root, '.mcp.json') || {}).mcpServers || {})) pop.mcp.add(k);
  return { pop, plugin };
}

function skillTier(root) {
  const lib = join(root, 'setup.d', 'lib.sh');
  const tiers = readTierSets(readFileSync(lib, 'utf8'));
  const tierOf = new Map();
  for (const t of ['core', 'env', 'factory']) for (const s of tiers[t]) tierOf.set(s, t);
  return tierOf;
}

function main() {
  const root = args(process.argv.slice(2));
  const manifestPath = join(root, 'setup.d', 'ships.manifest');
  const findings = [];
  const accepted = [];
  const bad = (line, kind, name, why) => findings.push(`setup.d/ships.manifest:${line}: ${kind} ${name} — ${why}`);
  if (!existsSync(manifestPath)) {
    console.error('check-ships-manifest: setup.d/ships.manifest is missing');
    process.exit(1);
  }
  const { pop, plugin } = population(root);
  const tierOf = skillTier(root);
  const rows = new Map(); // "kind name" -> line
  const settings = readJson(root, '.claude/settings.json') || {};
  const session = readJson(root, 'setup.d/session-settings.json');
  const askRows = new Set();

  readFileSync(manifestPath, 'utf8').split('\n').forEach((raw, i) => {
    const line = i + 1;
    if (raw === '' || raw.startsWith('#')) return;
    const f = raw.split('\t');
    if (f.length !== 6) return bad(line, f[0] ?? '?', f[1] ?? '?', `${f.length} TAB fields, want 6`);
    const [kind, name, verdict, installer, plug, reason] = f;
    if (!KINDS.includes(kind)) return bad(line, kind, name, `unknown kind (want ${KINDS.join('|')})`);
    if (!VERDICTS.includes(verdict)) return bad(line, kind, name, `unknown verdict «${verdict}»`);
    if (!INSTALLERS.includes(installer)) return bad(line, kind, name, `unknown installer «${installer}»`);
    if (!PLUGIN.includes(plug)) return bad(line, kind, name, `unknown plugin value «${plug}»`);
    const key = `${kind} ${name}`;
    if (rows.has(key)) return bad(line, kind, name, `duplicate row (first at line ${rows.get(key)})`);
    rows.set(key, line);
    if (!pop[kind].has(name)) return bad(line, kind, name, 'stale row: no such item in the repo');

    const text = reason === '-' ? '' : reason;
    const long = (s) => s.trim().length >= MIN_REASON;
    if (verdict === 'internal') {
      if (installer !== 'no') bad(line, kind, name, `internal but installer=${installer}: an internal item is not installed`);
      if (!text.startsWith('internal, because ') || !long(text.slice('internal, because '.length)))
        bad(line, kind, name, `internal needs «internal, because <why, >= ${MIN_REASON} chars>»`);
      if (plug === 'yes') {
        const pc = /plugin copy:\s*(.*)$/.exec(text);
        if (!pc || !long(pc[1])) bad(line, kind, name, 'internal but the plugin ships it: name it with «plugin copy: <what happens / who removes it>»');
        else accepted.push(`${kind} ${name}: ${pc[1].trim()}`);
      }
    } else if (installer === 'no' && plug === 'no') {
      if (!text.startsWith('pending: ') || !long(text.slice('pending: '.length)))
        bad(line, kind, name, `ships through no channel: needs «pending: <who delivers it, and when>»`);
    } else if (installer === 'no' && !long(text)) {
      bad(line, kind, name, `ships only through the plugin: say why the installer does not carry it (>= ${MIN_REASON} chars)`);
    }
    if ((installer === 'factory' || installer === 'full') && !long(text))
      bad(line, kind, name, `installer=${installer}: say why the default run (env) does not install it (>= ${MIN_REASON} chars)`);
    if (installer === 'ask') {
      askRows.add(name);
      if (kind !== 'setting') bad(line, kind, name, 'installer=ask is only for settings (the session-settings group)');
      else if (!long(text)) bad(line, kind, name, `installer=ask: say what the setting changes for the person (>= ${MIN_REASON} chars)`);
      const want = getPath(settings, name);
      const got = session ? getPath(session, name) : undefined;
      if (kind !== 'setting') {
        /* reported above */
      } else if (got === undefined) bad(line, kind, name, 'installer=ask but setup.d/session-settings.json does not carry it');
      else if (Array.isArray(got)) {
        const extra = Array.isArray(want) ? got.filter((x) => !want.some((y) => JSON.stringify(y) === JSON.stringify(x))) : got;
        if (extra.length) bad(line, kind, name, `setup.d/session-settings.json has entries getff's own .claude/settings.json does not: ${JSON.stringify(extra)}`);
      } else if (JSON.stringify(got) !== JSON.stringify(want))
        bad(line, kind, name, `setup.d/session-settings.json says ${JSON.stringify(got)}, getff's own .claude/settings.json says ${JSON.stringify(want)}`);
    }

    const pluginHas = plugin[kind] ? plugin[kind].has(name) : false;
    if (plug === 'yes' && !pluginHas)
      bad(line, kind, name, plugin[kind] ? 'plugin=yes but the plugin tree does not carry it' : `plugin=yes, but the plugin ships no ${kind}s`);
    if (plug === 'no' && pluginHas) bad(line, kind, name, 'plugin=no but the plugin tree carries it');

    if (kind === 'skill' && tierOf.has(name) && installer !== tierOf.get(name))
      bad(line, kind, name, `installer=${installer} but setup.d/lib.sh puts it in the ${tierOf.get(name)} tier`);
  });

  for (const name of settingNames(session))
    if (!askRows.has(name))
      findings.push(`setup.d/session-settings.json: ${name} — written on the pre-launch «yes» but not an \`ask\` row of setup.d/ships.manifest`);

  for (const kind of KINDS)
    for (const name of [...pop[kind]].sort())
      if (!rows.has(`${kind} ${name}`))
        findings.push(`setup.d/ships.manifest: ${kind} ${name} — unmarked: add a row saying whether it ships or is internal, and why`);

  for (const a of accepted) console.log(`  · internal, plugin still carries it — ${a}`);
  if (findings.length) {
    for (const f of findings) console.error(f);
    console.error(`\n${findings.length} finding(s). Format and reason rules: header of setup.d/ships.manifest.`);
    process.exit(1);
  }
  const total = KINDS.reduce((n, k) => n + pop[k].size, 0);
  console.log(`✓ ships manifest: ${total} item(s) marked (${KINDS.map((k) => `${pop[k].size} ${k}`).join(', ')})`);
}

main();
