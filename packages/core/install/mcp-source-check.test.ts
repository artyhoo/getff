/**
 * mcp-source-check — circle 2 decisions on recorded registry answers.
 *
 * fixtures/mcp-source-check/ holds the live answers of registry.modelcontextprotocol.io and
 * registry.npmjs.org for the consumer below, recorded 2026-09-29 with GETFF_MCP_FETCH_RECORD
 * (npm manifests trimmed to name/version/homepage/repository/mcpName). They carry the real
 * look-alikes the check must refuse: io.github.friendlygeorge/sentry-mcp-server,
 * io.github.mcp-dir/supabase-mcp, ai.smithery/*supabase*, io.github.microsoft/* for `typescript`.
 * Arms that need a different registry state copy the fixtures and edit one recorded answer.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  applyDecisions,
  checkStackTools,
  fixtureName,
  githubRepo,
  isDecided,
  makeFetchJson,
  MCP_REGISTRY,
  NPM_REGISTRY,
  type CheckResult,
} from './mcp-source-check.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'mcp-source-check');
const PKG = {
  name: 'fx',
  dependencies: {
    '@sentry/react': '^11.0.0',
    '@prisma/client': '^7.0.0',
    '@supabase/supabase-js': '^2.0.0',
    '@upstash/redis': '^1.0.0',
    stripe: '^22.0.0',
    react: '^19.0.0',
  },
  devDependencies: { '@types/react': '^19.0.0', typescript: '^5.0.0' },
};
const searchUrl = (q: string): string => `${MCP_REGISTRY}/v0.1/servers?search=${encodeURIComponent(q)}&version=latest&limit=100`;
const npmUrl = (pkg: string, v: string): string => `${NPM_REGISTRY}/${pkg.replace('/', '%2f')}/${v}`;

function consumer(mcp: object = { mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' } } }): string {
  const root = mkdtempSync(join(tmpdir(), 'mcp-src-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify(PKG));
  writeFileSync(join(root, '.mcp.json'), JSON.stringify(mcp));
  mkdirSync(join(root, '.ai-factory'));
  cpSync(join(import.meta.dirname, '../../../skills/tool-bootstrapping/templates/tool-decisions.md.template'), join(root, '.ai-factory', 'tool-decisions.md'));
  return root;
}
/** A copy of the recorded fixtures with EDIT applied to the answer of each URL named. */
function fixturesWith(edits: Record<string, (body: Record<string, unknown>) => unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-fx-'));
  cpSync(FIXTURES, dir, { recursive: true });
  for (const [url, edit] of Object.entries(edits)) {
    const f = join(dir, fixtureName(url));
    writeFileSync(f, JSON.stringify(edit(JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>)));
  }
  return dir;
}
const check = async (dir = FIXTURES, root = consumer()): Promise<CheckResult> => {
  const r = await checkStackTools(root, makeFetchJson({ GETFF_MCP_FETCH_FIXTURES: dir }));
  expect(r).not.toBeNull();
  return r!;
};
const byServer = (r: CheckResult) => Object.fromEntries(r.decisions.map((x) => [x.server, x]));

describe('checkStackTools on the recorded registry', () => {
  it('finds each vendor server its dependency owner holds, and writes only the one two signals agree on', async () => {
    const r = await check();
    expect(r.unchecked).toEqual([]); // every query had a recorded answer: none drifted
    const s = byServer(r);
    expect(Object.keys(s).sort()).toEqual([
      'com.supabase/mcp',
      'io.github.getsentry/sentry-mcp',
      'io.github.upstash/mcp-server',
      'io.github.upstash/redis-mcp',
      'io.prisma/mcp',
    ]);
    // two signals (GitHub org + npm scope) and a header-free remote → written
    expect(s['io.github.getsentry/sentry-mcp']).toMatchObject({ dep: '@sentry/react', signals: 2, entry: { type: 'http', url: 'https://mcp.sentry.dev/mcp' } });
    // one signal each → proposed, whatever the remote looks like
    expect(s['io.prisma/mcp']).toMatchObject({ signals: 1 });
    expect(s['io.prisma/mcp']!.entry).toBeUndefined();
    expect(s['io.prisma/mcp']!.owner).toBe("domain: prisma.io is @prisma/client's homepage host");
    expect(s['io.prisma/mcp']!.needs).toMatch(/^a second ownership signal/);
    expect(s['com.supabase/mcp']).toMatchObject({ signals: 1 });
    expect(s['com.supabase/mcp']!.entry).toBeUndefined();
    expect(s['com.supabase/mcp']!.owner).toContain('scope @supabase');
    // a local-only server is checked but only proposed: writing it would pin a version (fork F1)
    expect(s['io.github.upstash/redis-mcp']!.needs).toBe(
      'your yes to run it locally: npx -y @upstash/redis-mcp@0.1.1 (checked: its mcpName names this server)',
    );
    expect(s['io.github.upstash/mcp-server']!.needs).toBe('UPSTASH_EMAIL, UPSTASH_API_KEY');
  });

  it('refuses look-alikes: same words, a namespace the dependency owner does not hold', async () => {
    const names = (await check()).decisions.map((x) => x.server);
    for (const fake of ['io.github.friendlygeorge/sentry-mcp-server', 'io.github.mcp-dir/supabase-mcp', 'ai.smithery/pinion05-supabase-mcp-lite', 'io.github.microsoft/playwright-mcp'])
      expect(names).not.toContain(fake);
  });

  it('one signal never writes: a GitHub org alone (the scope no longer endorses the server) is a proposal', async () => {
    const dir = fixturesWith({ [npmUrl('@sentry/mcp-server', 'latest')]: (b) => ({ ...b, mcpName: 'io.github.someone-else/mcp' }) });
    const sentry = byServer(await check(dir))['io.github.getsentry/sentry-mcp']!;
    expect(sentry.signals).toBe(1);
    expect(sentry.entry).toBeUndefined();
  });

  it('the scope signal reads the CURRENT package: an old version naming the server does not count', async () => {
    const dir = fixturesWith({ [npmUrl('@supabase/mcp-server-supabase', 'latest')]: (b) => ({ ...b, mcpName: undefined }) });
    expect(byServer(await check(dir))['com.supabase/mcp']).toBeUndefined();
  });

  it('a homepage on a subdomain does not make its parent domain the owner', async () => {
    const dir = fixturesWith({ [npmUrl('@prisma/client', 'latest')]: (b) => ({ ...b, homepage: 'https://docs.tenant.prisma.io' }) });
    expect(byServer(await check(dir))['io.prisma/mcp']).toBeUndefined();
  });

  it('a remote that needs a header is proposed with the header it needs', async () => {
    // The server comes back from two searches («io.github.getsentry» and «sentry»); edit both.
    const needHeader = (b: Record<string, unknown>) => {
      const body = b as { servers: { server: { name: string; remotes?: { headers?: object[] }[] } }[] };
      for (const x of body.servers)
        if (x.server.name === 'io.github.getsentry/sentry-mcp')
          for (const r of x.server.remotes ?? []) r.headers = [{ name: 'Authorization', isRequired: true }];
      return body;
    };
    const dir = fixturesWith({ [searchUrl('io.github.getsentry')]: needHeader, [searchUrl('sentry')]: needHeader });
    const sentry = byServer(await check(dir))['io.github.getsentry/sentry-mcp']!;
    expect(sentry.entry).toBeUndefined();
    expect(sentry.needs).toContain('header Authorization');
  });

  it('an npm package whose mcpName does not name the server is not offered as a command', async () => {
    const dir = fixturesWith({ [npmUrl('@upstash/redis-mcp', '0.1.1')]: (b) => ({ ...b, mcpName: 'io.github.evil/redis' }) });
    const redis = byServer(await check(dir))['io.github.upstash/redis-mcp']!;
    expect(redis.needs).toContain('names io.github.evil/redis in mcpName');
    expect(redis.needs).not.toContain('npx -y');
  });

  it('npm answered but the MCP registry did not: null, never «nothing found»', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-npm-only-'));
    for (const f of readdirSync(FIXTURES)) if (f.startsWith('registry.npmjs.org')) cpSync(join(FIXTURES, f), join(dir, f));
    expect(await checkStackTools(consumer(), makeFetchJson({ GETFF_MCP_FETCH_FIXTURES: dir }))).toBeNull();
  });

  it('one registry search unanswered: the rest is decided and the gap is reported by name', async () => {
    const dir = fixturesWith({});
    rmSync(join(dir, fixtureName(searchUrl('io.github.upstash'))));
    const r = await check(dir);
    expect(r.unchecked).toEqual(['registry search «io.github.upstash»']);
    expect(byServer(r)['io.github.getsentry/sentry-mcp']).toBeDefined();
  });

  it('no registry at all: null', async () => {
    expect(await checkStackTools(consumer(), makeFetchJson({ GETFF_MCP_FETCH_FIXTURES: mkdtempSync(join(tmpdir(), 'mcp-empty-')) }))).toBeNull();
  });
});

describe('applyDecisions', () => {
  it('writes .mcp.json and one line per decision into tool-decisions.md, and is idempotent', async () => {
    const root = consumer();
    const { decisions } = await check(FIXTURES, root);
    const lines = applyDecisions(root, decisions, { date: '2026-09-29' });
    expect(lines.filter((l) => l.startsWith('✓'))).toEqual([expect.stringMatching(/^✓ \.mcp\.json: sentry \(http https:\/\/mcp\.sentry\.dev\/mcp\)/)]);
    const mcp = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8'));
    expect(Object.keys(mcp.mcpServers).sort()).toEqual(['context7', 'sentry']);
    const dec = readFileSync(join(root, '.ai-factory', 'tool-decisions.md'), 'utf8');
    // C4: server, namespace owner, version, matched dependency — on the one line
    expect(dec).toMatch(/^\| sentry \| MCP \| 2026-09-29 \| .*io\.github\.getsentry\/sentry-mcp 0\.42\.0 — owner: GitHub org: io\.github\.getsentry .* matched dependency @sentry\/react \|$/m);
    expect(dec).toMatch(/^- io\.prisma\/mcp: proposed, not installed — needs a second ownership signal .*1\.0\.0 — owner: domain: prisma\.io .*matched dependency @prisma\/client$/m);
    expect(dec.indexOf('| sentry |')).toBeLessThan(dec.indexOf('## Rejected'));
    const again = applyDecisions(root, decisions, { date: '2026-09-30' });
    expect(again.every((l) => l.startsWith('⊝'))).toBe(true);
    expect(readFileSync(join(root, '.ai-factory', 'tool-decisions.md'), 'utf8')).toBe(dec);
  });

  it('a rejection written the template way (short name in the Tool cell) keeps the server out', async () => {
    const root = consumer();
    const f = join(root, '.ai-factory', 'tool-decisions.md');
    writeFileSync(f, readFileSync(f, 'utf8').replace('| _none yet_ | —    | —        | —      | —               |', '| sentry | MCP | 2026-09-01 | not used here | never |'));
    const lines = applyDecisions(root, (await check(FIXTURES, root)).decisions, { date: '2026-09-29' });
    expect(lines).toContain('⊝ io.github.getsentry/sentry-mcp: already decided in .ai-factory/tool-decisions.md — not re-proposed');
    expect(JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers.sentry).toBeUndefined();
  });

  it('keeps an entry the person already has for the same server, under any name', async () => {
    const root = consumer({ mcpServers: { mysentry: { type: 'http', url: 'https://mcp.sentry.dev/mcp' } } });
    const lines = applyDecisions(root, (await check(FIXTURES, root)).decisions, { date: '2026-09-29' });
    expect(lines).toContain('⊝ io.github.getsentry/sentry-mcp: already in .mcp.json as «mysentry» — kept as it is');
    expect(JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers.sentry).toBeUndefined();
  });

  it('a name the person already uses for another server is not overwritten', async () => {
    const root = consumer({ mcpServers: { sentry: { command: 'my-own-sentry' } } });
    const lines = applyDecisions(root, (await check(FIXTURES, root)).decisions, { date: '2026-09-29' });
    expect(lines.join('\n')).toContain('proposed, not installed: io.github.getsentry/sentry-mcp — the name «sentry» is already taken in .mcp.json');
    expect(JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers.sentry).toEqual({ command: 'my-own-sentry' });
  });

  it('--dry-run writes nothing to either file', async () => {
    const root = consumer();
    const mcp = readFileSync(join(root, '.mcp.json'), 'utf8');
    const dec = readFileSync(join(root, '.ai-factory', 'tool-decisions.md'), 'utf8');
    const lines = applyDecisions(root, (await check(FIXTURES, root)).decisions, { date: '2026-09-29', dryRun: true });
    expect(lines.every((l) => l.startsWith('[dry-run] '))).toBe(true);
    expect(readFileSync(join(root, '.mcp.json'), 'utf8')).toBe(mcp);
    expect(readFileSync(join(root, '.ai-factory', 'tool-decisions.md'), 'utf8')).toBe(dec);
  });

  it('isDecided matches whole names, not a longer name that contains them', () => {
    expect(isDecided('- com.supabase/mcp-lite: proposed', { server: 'com.supabase/mcp', key: 'supabase' })).toBe(false);
    expect(isDecided('- com.supabase/mcp: proposed', { server: 'com.supabase/mcp', key: 'supabase' })).toBe(true);
  });
});

describe('githubRepo', () => {
  it.each([
    ['git+https://github.com/Stripe/stripe-node.git', 'stripe'],
    ['git://github.com/getsentry/sentry-javascript.git', 'getsentry'],
    ['git+ssh://git@github.com/upstash/redis-js.git', 'upstash'],
    ['github:vercel/next.js', 'vercel'],
    ['prisma/prisma', 'prisma'],
    ['https://gitlab.com/a/b', undefined],
    ['https://notgithub.com/x/y', undefined],
    ['https://github.com/sponsors/foo', undefined],
  ])('%s → %s', (url, org) => {
    expect(githubRepo(url)?.org).toBe(org);
  });
});
