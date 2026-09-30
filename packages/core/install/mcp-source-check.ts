/**
 * mcp-source-check.ts — circle 2 of the install: vendor MCP servers for the project's own
 * dependencies, taken only from the vendor who owns that dependency.
 *
 * Runs at install time on the pre-launch yes (setup.d/35-stack-tools.sh, GETFF_STACK_TOOLS=1).
 * For every DIRECT dependency in package.json except getff's own tools — a fixed set
 * (setup.d/lib.sh getff_dep_names, passed as --getff-deps) whose MCP servers are decided once in
 * getff, not per project, whoever put them in package.json (operator 2026-09-30) — it asks
 * the official MCP registry
 * (registry.modelcontextprotocol.io — the registry itself verifies who may publish under a
 * namespace: GitHub login for io.github.<org>, DNS/HTTP proof for reverse-DNS names) for the
 * servers whose namespace that dependency's owner holds. Three independent ownership signals:
 *   (a) github  — the namespace is io.github.<org> and <org> owns the dependency's GitHub repository;
 *   (b) domain  — the namespace is a reverse-DNS name whose domain IS the dependency's Tier-1
 *                 homepage host, or that host minus a leading `www.` (allowlist-resolver.ts tier1For:
 *                 homepage/repository hosts minus the multi-tenant apexes). Never a parent domain: a
 *                 tenant subdomain's parent belongs to the hosting platform, not to the vendor;
 *   (c) npm scope — the server lists an npm package under the dependency's own npm scope whose
 *                 CURRENT (`latest`) manifest names this server in `mcpName` — the scope's present
 *                 publishers endorse it.
 * Each signal comes from metadata the namespace holder cannot forge, but each can go stale on its
 * own: a renamed GitHub org can be re-registered by someone else, a homepage domain can lapse, a
 * scope's past publisher can keep a personal namespace. So a server is WRITTEN only when two
 * signals agree; one signal makes it a proposal (cold review 2026-09-29, findings 2-4). A server
 * must also share a name token with the dependency (sentry-mcp ↔ @sentry/react), so a dependency
 * on `typescript` does not pull every server under io.github.microsoft.
 *
 * What is installed, into .mcp.json, without a further question (the pre-launch yes IS the
 * confirmation tool-bootstrapping Rule 3 requires, and it names servers that run locally), for a
 * server with two ownership signals:
 *   - its streamable-http remote that needs no header → {type:"http", url}; nothing runs locally;
 *   - else its npm stdio package that declares no variable without a default and no required
 *     argument, and whose CURRENT (`latest`) manifest names this server in mcpName →
 *     {type:"stdio", command:"npx", args:["-y", pkg]}. It runs the vendor's package on the person's
 *     machine at every session start (in agent sessions without a person too — claude -p loads
 *     .mcp.json unasked), so its report line is a warning that says so and names the command that
 *     removes it (operator 2026-09-30: verified sources are installed, not left as a manual step,
 *     with a warning). Not pinned (one-button fork on pins = B, operator log entry 28;
 *     .claude/rules/companion-install-principle.md §1): npm serves its latest, and the version it
 *     served at install time is recorded on the decision line.
 * Anything else is «proposed, not installed» with what it needs. Every decision is one line in
 * .ai-factory/tool-decisions.md carrying server, namespace owner, version and matched dependency.
 * Skills are never installed here (no registry that verifies a skill's publisher exists).
 *
 * No LLM. Network only to the two registries; GETFF_MCP_FETCH_FIXTURES=<dir> answers every
 * request from recorded files (CI — .claude/rules/no-paid-llm-in-ci.md), GETFF_MCP_FETCH_RECORD
 * =<dir> records live answers into that shape.
 *
 * @cc-only-rationale: install-time payload run by setup.d/35-stack-tools.sh through its bundle.
 * Prior-art: prior-art-evaluations.md#301 (official MCP registry read API ADOPT).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  resolveAllowedSources,
  type EcosystemAdapter,
  type InstalledMeta,
} from '../research/allowlist-resolver.ts';
import { npmAdapter } from '../research/ecosystem-npm.ts';

export const MCP_REGISTRY = 'https://registry.modelcontextprotocol.io';
export const NPM_REGISTRY = 'https://registry.npmjs.org';

export type FetchJson = (url: string) => Promise<unknown>;

/** The recorded-answer file name for a URL (fixture and record modes share it). */
export function fixtureName(url: string): string {
  return `${url.replace(/^https?:\/\//, '').replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
}

/** Live fetch (the whole check within DEADLINE_MS of creation, each request allowed whatever is left
 *  of it), or recorded answers when GETFF_MCP_FETCH_FIXTURES is set. A request that fails, runs
 *  past the deadline or has no recorded answer resolves to null — and is reported as unchecked.
 *  No separate per-request cap: an uncached MCP registry search took 12-48 s (curl, 2026-09-30;
 *  a cached one 1.4-1.7 s), a first install is the uncached case, and an 8 s and then a 20 s cap
 *  turned those searches into «did not answer» (P6 run 4, N9). The deadline alone bounds the check,
 *  and waitLine tells the person before the wait. */
export const DEADLINE_MS = 90_000;
/** Requests in flight at once: light public GETs (npm manifests, registry searches). */
export const POOL_WIDTH = 12;
export function makeFetchJson(env: NodeJS.ProcessEnv = process.env, deadlineMs = DEADLINE_MS): FetchJson {
  const fixtures = env['GETFF_MCP_FETCH_FIXTURES'];
  if (fixtures) {
    return async (url) => {
      const f = join(fixtures, fixtureName(url));
      return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as unknown) : null;
    };
  }
  const record = env['GETFF_MCP_FETCH_RECORD'];
  const deadline = Date.now() + deadlineMs;
  return async (url) => {
    const left = deadline - Date.now();
    if (left <= 0) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(left) });
      if (!res.ok) return null;
      const body = (await res.json()) as unknown;
      if (record) {
        mkdirSync(record, { recursive: true });
        writeFileSync(join(record, fixtureName(url)), `${JSON.stringify(body, null, 2)}\n`);
      }
      return body;
    } catch {
      return null;
    }
  };
}

interface RegistryServer {
  name: string;
  version: string;
  remotes?: { type?: string; url?: string; headers?: { name: string; isRequired?: boolean }[] }[];
  packages?: {
    registryType?: string;
    identifier?: string;
    version?: string;
    transport?: { type?: string };
    environmentVariables?: { name: string; isRequired?: boolean; default?: string }[];
    packageArguments?: { isRequired?: boolean; name?: string; value?: string }[];
    runtimeArguments?: { isRequired?: boolean; name?: string; value?: string }[];
  }[];
}

export interface Decision {
  server: string;
  version: string;
  /** How the namespace owner was matched to the dependency — one clause per signal. */
  owner: string;
  signals: number;
  dep: string;
  key: string;
  /** A remote that can be installed without anything from the person. */
  entry?: { type: 'http'; url: string };
  /** A checked npm stdio package that needs nothing set. It runs on the person's machine, so it is
   *  written as `npx -y <pkg>` (not pinned) with a warning line naming that and the command that
   *  removes it; `served` is the version npm served at the check. */
  local?: { pkg: string; served: string };
  /** Why it is only proposed. */
  needs?: string;
}

const STOP = new Set(
  'js ts node nodejs client core sdk lib api mcp server servers cli types utils plugin javascript typescript official the for and'.split(
    ' ',
  ),
);
const tokens = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

/** The GitHub org of a repository/homepage field in any npm form (https, git://, git+ssh,
 *  git@github.com:org/repo, github:org/repo, org/repo shorthand). */
export function githubRepo(field: InstalledMeta['repository'] | string | undefined): { org: string; repo: string } | null {
  const raw = typeof field === 'object' ? field?.url : field;
  if (!raw) return null;
  const m =
    /(?:^|[/@.])github\.com[/:]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?(?:[/#?]|$)/.exec(raw) ??
    /^(?:github:)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?$/.exec(raw);
  if (!m) return null;
  const org = m[1]!.toLowerCase();
  // github.com/<reserved>/… pages are GitHub's own, never a repository owner.
  return GITHUB_RESERVED.has(org) ? null : { org, repo: m[2]!.toLowerCase() };
}
const GITHUB_RESERVED = new Set(['sponsors', 'orgs', 'apps', 'marketplace', 'topics', 'features', 'settings', 'users']);

const isRegistrySpec = (spec: string): boolean => !/^(?:workspace|file|link|git|git\+|github|http|https|npm):/.test(spec);

const declaredIn = (file: string): Record<string, string> => {
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  return {
    ...((pkg['dependencies'] as Record<string, string> | undefined) ?? {}),
    ...((pkg['devDependencies'] as Record<string, string> | undefined) ?? {}),
  };
};

/** Direct dependencies with the metadata that decides ownership: the installed package.json when
 *  node_modules has it, else the npm registry's latest manifest (a fresh project has no node_modules).
 *  Names in GETFF_DEPS are getff's own tools (setup.d/lib.sh getff_dep_names): skipped whoever put
 *  them in package.json, and returned as getffOwn for the report line. */
async function directDeps(
  root: string,
  fetchJson: FetchJson,
  getffDeps: ReadonlySet<string>,
  onStart: (deps: number) => void,
): Promise<{ declared: number; deps: Map<string, InstalledMeta>; missing: string[]; getffOwn: string[] }> {
  let declared: Record<string, string>;
  try {
    declared = declaredIn(join(root, 'package.json'));
  } catch {
    return { declared: 0, deps: new Map(), missing: [], getffOwn: [] };
  }
  const getffOwn = Object.keys(declared).filter((n) => getffDeps.has(n)).sort();
  const names = Object.keys(declared)
    .filter((n) => !getffDeps.has(n) && !n.startsWith('@types/') && isRegistrySpec(String(declared[n])))
    .sort();
  onStart(names.length);
  const found = new Map<string, InstalledMeta>();
  const missing: string[] = [];
  await pool(names, async (name) => {
    const installed = npmAdapter.readInstalledMeta(root, name);
    if (installed) return void found.set(name, installed);
    const m = (await fetchJson(`${NPM_REGISTRY}/${name.replace('/', '%2f')}/latest`)) as Record<string, unknown> | null;
    if (m) found.set(name, { homepage: m['homepage'] as string | undefined, repository: m['repository'] as InstalledMeta['repository'] });
    else missing.push(name);
  });
  // Network order decides the fill order; name order keeps every run's attribution the same.
  const deps = new Map([...found].sort(([a], [b]) => a.localeCompare(b)));
  return { declared: names.length, deps, missing: missing.sort(), getffOwn };
}

async function pool<T>(items: readonly T[], fn: (x: T) => Promise<void>, width = POOL_WIDTH): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]!);
    }),
  );
}

/** All latest, active servers the registry returns for a search (≤2 pages of 100). */
async function search(q: string, fetchJson: FetchJson): Promise<RegistryServer[] | null> {
  const out: RegistryServer[] = [];
  let cursor = '';
  for (let page = 0; page < 2; page++) {
    const url = `${MCP_REGISTRY}/v0.1/servers?search=${encodeURIComponent(q)}&version=latest&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const body = (await fetchJson(url)) as {
      servers?: { server: RegistryServer; _meta?: Record<string, { status?: string }> }[];
      metadata?: { nextCursor?: string };
    } | null;
    if (!body) return page === 0 ? null : out;
    for (const s of body.servers ?? []) {
      const status = s._meta?.['io.modelcontextprotocol.registry/official']?.status;
      if (!status || status === 'active') out.push(s.server);
    }
    cursor = body.metadata?.nextCursor ?? '';
    if (!cursor) break;
  }
  return out;
}

const namespaceOf = (server: string): string => server.split('/')[0]!.toLowerCase();
const ownerLabel = (ns: string): string => ns.split('.').at(-1)!;

function serverKey(server: string): string {
  const suffix = tokens(server.split('/').slice(1).join('-')).join('-');
  return suffix || ownerLabel(namespaceOf(server));
}

/** The mcpName an npm package declares at VERSION (a version or a dist-tag such as `latest`). */
async function npmManifest(id: string, version: string, fetchJson: FetchJson): Promise<{ mcpName?: string; version?: string } | null> {
  return (await fetchJson(`${NPM_REGISTRY}/${id.replace('/', '%2f')}/${encodeURIComponent(version)}`)) as { mcpName?: string; version?: string } | null;
}
async function npmMcpName(id: string, version: string, fetchJson: FetchJson): Promise<string | null> {
  return (await npmManifest(id, version, fetchJson))?.mcpName ?? null;
}

/** Install form for a verified server, or what it needs. */
async function installForm(s: RegistryServer, fetchJson: FetchJson): Promise<Pick<Decision, 'entry' | 'needs' | 'local'>> {
  const needs: string[] = [];
  for (const r of s.remotes ?? []) {
    const req = (r.headers ?? []).filter((h) => h.isRequired).map((h) => h.name);
    if (r.type !== 'streamable-http' || !r.url?.startsWith('https://') || r.url.includes('{')) continue;
    if (req.length === 0) return { entry: { type: 'http', url: r.url } };
    needs.push(...req.map((h) => `header ${h}`));
  }
  for (const p of s.packages ?? []) {
    if (p.registryType !== 'npm' || !p.identifier) continue;
    if ((p.transport?.type ?? 'stdio') !== 'stdio') continue;
    // A variable declared without a default is one the person sets (a URL, a token), even when the
    // registry does not mark it required: redis-mcp declares three, of which one transport is needed.
    // Written without it, the server would fail at every session start. The required ones are named
    // when there are any; otherwise every variable without a default.
    const unset = (p.environmentVariables ?? []).filter((e) => e.default === undefined);
    const vars = unset.some((e) => e.isRequired) ? unset.filter((e) => e.isRequired) : unset;
    const req = [
      ...vars.map((e) => e.name),
      ...[...(p.packageArguments ?? []), ...(p.runtimeArguments ?? [])]
        .filter((a) => a.isRequired && a.value === undefined)
        .map((a) => `argument ${a.name ?? '?'}`),
    ];
    if (req.length) {
      needs.push(...req);
      continue;
    }
    // npx -y <pkg> runs npm's latest, so the latest is the manifest that must name this server.
    const latest = await npmManifest(p.identifier, 'latest', fetchJson);
    if (!latest?.version || latest.mcpName !== s.name) {
      needs.push(`a checked package (the latest npm ${p.identifier} names ${latest?.mcpName ?? 'no server'} in mcpName)`);
      continue;
    }
    return { local: { pkg: p.identifier, served: latest.version } };
  }
  return { needs: needs.length ? [...new Set(needs)].join(', ') : 'a remote or an npm package getff can run' };
}

export interface CheckResult {
  decisions: Decision[];
  /** Dependencies and registry searches that got no answer — reported, never read as «nothing». */
  unchecked: string[];
  /** getff's own tools present in package.json — not looked up. */
  getffOwn: string[];
}

/** The decisions for ROOT's direct dependencies other than GETFF_DEPS; null when nothing could be
 *  checked (no dependency's metadata could be read, or no registry search came back). */
export async function checkStackTools(
  root: string,
  fetchJson: FetchJson,
  getffDeps: ReadonlySet<string> = new Set(),
  onStart: (deps: number) => void = () => {},
): Promise<CheckResult | null> {
  const { declared, deps, missing, getffOwn } = await directDeps(root, fetchJson, getffDeps, onStart);
  if (declared > 0 && deps.size === 0) return null;
  const adapter: EcosystemAdapter = {
    ecosystem: 'npm',
    listDirectDeps: () => new Set(deps.keys()),
    readInstalledMeta: (_r, name) => deps.get(name) ?? null,
  };
  // Tier-2 acknowledgements play no part here; an absent path reads as none.
  const tier1 = resolveAllowedSources({ root, adapter, ackFilePath: join(root, '.ai-factory', '.no-ack-for-mcp-check') });

  interface Probe { dep: string; org: string | null; hosts: string[]; scope: string | null; depTokens: Set<string> }
  const probes: Probe[] = [...deps].map(([dep, meta]) => {
    const gh = githubRepo(meta.repository) ?? githubRepo(meta.homepage);
    const t = tier1.tier1For(dep);
    const scope = dep.startsWith('@') ? dep.slice(1, dep.indexOf('/')).toLowerCase() : null;
    return {
      dep,
      org: gh?.org ?? null,
      hosts: t.ok ? [...t.hosts] : [],
      scope,
      depTokens: new Set([...tokens(dep), ...(gh ? tokens(gh.repo) : [])]),
    };
  });

  const queries = new Set<string>();
  for (const p of probes) {
    if (p.org) queries.add(`io.github.${p.org}`);
    for (const h of p.hosts) queries.add(h.replace(/^www\./, '').split('.').reverse().join('.'));
    if (p.scope && !STOP.has(p.scope)) queries.add(p.scope);
  }
  const found = new Map<string, RegistryServer>();
  const failed: string[] = [];
  await pool([...queries].sort(), async (q) => {
    const list = await search(q, fetchJson);
    if (!list) failed.push(q);
    for (const s of list ?? []) found.set(s.name, s);
  });
  if (queries.size > 0 && failed.length === queries.size) return null;

  const decisions: Decision[] = [];
  for (const s of [...found.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const ns = namespaceOf(s.name);
    const nsDomain = ns.split('.').reverse().join('.');
    const serverTokens = tokens(s.name.split('/').slice(1).join('-'));
    const relevanceTokens = serverTokens.length ? serverTokens : [ownerLabel(ns)];
    let best: { dep: string; signals: string[] } | null = null;
    for (const p of probes) {
      if (!relevanceTokens.some((t) => p.depTokens.has(t))) continue;
      const signals: string[] = [];
      if (p.org && ns === `io.github.${p.org}`) signals.push(`GitHub org: ${ns} is the org of ${p.dep}'s repository`);
      if (!ns.startsWith('io.github.') && ns.includes('.') && p.hosts.some((h) => h === nsDomain || h === `www.${nsDomain}`))
        signals.push(`domain: ${nsDomain} is ${p.dep}'s homepage host`);
      if (p.scope) {
        for (const pk of s.packages ?? []) {
          if (pk.registryType !== 'npm' || !pk.identifier?.startsWith(`@${p.scope}/`)) continue;
          if ((await npmMcpName(pk.identifier, 'latest', fetchJson)) === s.name) {
            signals.push(`npm scope: the latest ${pk.identifier}, under ${p.dep}'s scope @${p.scope}, names this server`);
            break;
          }
        }
      }
      if (signals.length > (best?.signals.length ?? 0)) best = { dep: p.dep, signals };
    }
    if (!best) continue;
    const form = await installForm(s, fetchJson);
    const decision: Decision = {
      server: s.name,
      version: s.version,
      owner: best.signals.join('; '),
      signals: best.signals.length,
      dep: best.dep,
      key: serverKey(s.name),
      ...form,
    };
    if ((decision.entry || decision.local) && best.signals.length < 2) {
      delete decision.entry;
      delete decision.local;
      decision.needs = 'a second ownership signal — getff writes a server only when two of GitHub org, homepage domain and npm scope agree';
    }
    decisions.push(decision);
  }
  return { decisions, unchecked: [...missing, ...failed.sort().map((q) => `registry search «${q}»`)], getffOwn };
}

/** True when tool-decisions.md already names this server, or has a row whose Tool cell is its key
 *  (a person's own rejection uses the short name, as the template's tables do). */
export function isDecided(dec: string, d: Pick<Decision, 'server' | 'key'>): boolean {
  const esc = (x: string): string => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return (
    new RegExp(`(^|[^A-Za-z0-9._/-])${esc(d.server)}($|[^A-Za-z0-9._/-])`, 'm').test(dec) ||
    new RegExp(`^\\|\\s*${esc(d.key)}\\s*\\|`, 'm').test(dec)
  );
}

const describe = (d: Decision): string => (d.entry ? `http ${d.entry.url}` : '');
/** True when an existing .mcp.json entry already runs this server (http: its url; npm: its package). */
const runs = (v: unknown, d: Decision): boolean => {
  const s = JSON.stringify(v);
  if (d.entry) return s.includes(`"${d.entry.url}"`);
  return !!d.local && (s.includes(`"${d.local.pkg}"`) || s.includes(`"${d.local.pkg}@`));
};

/** Writes the decisions into .mcp.json and .ai-factory/tool-decisions.md; returns the report lines. */
export function applyDecisions(root: string, decisions: Decision[], opts: { dryRun?: boolean; date: string }): string[] {
  const lines: string[] = [];
  const mcpPath = join(root, '.mcp.json');
  const mcp = existsSync(mcpPath) ? (JSON.parse(readFileSync(mcpPath, 'utf8')) as { mcpServers?: Record<string, unknown> }) : {};
  const servers = (mcp.mcpServers ??= {});
  const decPath = join(root, '.ai-factory', 'tool-decisions.md');
  let dec = existsSync(decPath) ? readFileSync(decPath, 'utf8') : '';
  const accepted: string[] = [];
  const pending: string[] = [];
  let mcpChanged = false;

  for (const d of decisions) {
    const c4 = `${d.server} ${d.version} — owner: ${d.owner}; matched dependency ${d.dep}`;
    const configured = Object.entries(servers).find(([, v]) => runs(v, d));
    if (configured) {
      lines.push(`⊝ ${d.server}: already in .mcp.json as «${configured[0]}» — kept as it is`);
      // A re-seeded tool-decisions.md (install --force) must still say why the entry is there.
      if (!isDecided(dec, d)) accepted.push(`| ${configured[0]} | MCP | ${opts.date} | already in .mcp.json: ${c4} |`);
      continue;
    }
    if (isDecided(dec, d)) {
      lines.push(`⊝ ${d.server}: already decided in .ai-factory/tool-decisions.md — not re-proposed`);
      continue;
    }
    if (d.entry && !(d.key in servers)) {
      servers[d.key] = d.entry;
      mcpChanged = true;
      accepted.push(`| ${d.key} | MCP | ${opts.date} | installed by getff on the pre-launch yes (${describe(d)}): ${c4} |`);
      lines.push(`✓ .mcp.json: ${d.key} (${describe(d)}) — ${c4}`);
    } else if (d.local && !(d.key in servers)) {
      // Runs the vendor's own package on this machine; the pre-launch yes names that, and the line
      // says what runs and how to take it out (operator 2026-09-30: verified sources installed, warned).
      servers[d.key] = { type: 'stdio', command: 'npx', args: ['-y', d.local.pkg] };
      mcpChanged = true;
      const remove = `claude mcp remove ${d.key} -s project`;
      accepted.push(
        `| ${d.key} | MCP | ${opts.date} | installed by getff on the pre-launch yes (runs on your machine: npx -y ${d.local.pkg}, npm served ${d.local.served}; remove: ${remove}): ${c4} |`,
      );
      lines.push(`⚠ .mcp.json: ${d.key} runs on your machine — npx -y ${d.local.pkg}, not pinned: npm served ${d.local.served}; to remove it: ${remove} — ${c4}`);
    } else {
      const why = d.entry || d.local ? `the name «${d.key}» is already taken in .mcp.json` : `needs ${d.needs}`;
      pending.push(`- ${d.server}: proposed, not installed — ${why}; ${c4}`);
      lines.push(`⊝ proposed, not installed: ${d.server} — ${why}; ${c4}`);
    }
  }
  if (opts.dryRun) return lines.map((l) => `[dry-run] ${l}`);

  if (mcpChanged) writeFileSync(mcpPath, `${JSON.stringify(mcp, null, 2)}\n`);
  if (accepted.length || pending.length) {
    if (!dec) dec = '## Accepted\n\n| Tool | Type | Accepted | Rationale |\n| ---- | ---- | -------- | --------- |\n\n## Pending review\n';
    if (accepted.length) dec = insertAfterSection(dec, '## Accepted', accepted, (l) => l.startsWith('|'));
    if (pending.length) dec = insertAfterSection(dec, '## Pending review', pending, (l) => l.startsWith('- ') || l.startsWith('<!--'));
    mkdirSync(join(root, '.ai-factory'), { recursive: true });
    writeFileSync(decPath, dec);
  }
  return lines;
}

/** Inserts ROWS after the last line of SECTION's leading block that satisfies IN_BLOCK
 *  (the table of «## Accepted», the list of «## Pending review»); appends the section when absent. */
function insertAfterSection(text: string, section: string, rows: string[], inBlock: (l: string) => boolean): string {
  const ls = text.split('\n');
  const start = ls.findIndex((l) => l.trim() === section);
  if (start === -1) return `${text.replace(/\n*$/, '\n')}\n${section}\n\n${rows.join('\n')}\n`;
  let at = start + 1;
  for (let i = start + 1; i < ls.length && !ls[i]!.startsWith('## '); i++) if (inBlock(ls[i]!)) at = i + 1;
  if (at === start + 1) {
    ls.splice(at, 0, '', ...rows);
  } else {
    ls.splice(at, 0, ...rows);
  }
  return ls.join('\n');
}

/** The report line for dependencies and searches the registries did not answer. */
export function uncheckedLine(unchecked: readonly string[]): string {
  return `⚠ not checked: ${unchecked.join(', ')} — the registry gave no answer (none within ${DEADLINE_MS / 1000} s, or an error), so nothing was added or proposed for them; everything above stands, and running the install again checks them again`;
}

/** The line printed before the registries are asked: a live registry can take up to the deadline. */
export function waitLine(deps: number): string {
  return `… asking the npm and MCP registries about ${deps} dependencies — this can take up to ${DEADLINE_MS / 1000} s`;
}

/** The report line for getff's own tools the project's package.json has. */
export function getffOwnLine(names: readonly string[]): string {
  return `⊝ not looked up: ${names.join(', ')} — getff's own tools; their MCP servers are decided once in getff, not per project`;
}

async function main(argv: string[]): Promise<number> {
  const arg = (flag: string): string | undefined => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const root = resolve(arg('--root') ?? '.');
  const dryRun = argv.includes('--dry-run');
  // --getff-deps a,b,c: setup.d/lib.sh getff_dep_names, joined by 35-stack-tools.sh.
  const getffDeps = new Set((arg('--getff-deps') ?? '').split(',').filter(Boolean));
  const date = process.env['GETFF_TODAY'] ?? new Date().toISOString().slice(0, 10);
  const result = await checkStackTools(root, makeFetchJson(), getffDeps, (n) => {
    if (n > 0) console.log(waitLine(n));
  });
  if (result === null) {
    console.log('⚠ the npm or MCP registry did not answer — no vendor server was checked');
    return 0;
  }
  const lines = applyDecisions(root, result.decisions, { dryRun, date });
  if (lines.length === 0 && result.unchecked.length === 0)
    console.log('⊝ no direct dependency has an MCP server published by its own vendor');
  if (result.getffOwn.length) console.log(getffOwnLine(result.getffOwn));
  for (const l of lines) console.log(l);
  if (result.unchecked.length)
    console.log(uncheckedLine(result.unchecked));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (rc) => process.exit(rc),
    (e: unknown) => {
      console.log(`⚠ the vendor-server check stopped: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(0);
    },
  );
}
