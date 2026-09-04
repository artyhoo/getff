#!/usr/bin/env node
/**
 * render-zcode-parity-rollup — PROPOSAL renderer (maintainer sign-off pending; S3 D3, P1).
 *
 * NOT WIRED: the render target — a `getff:begin section=zcode-parity-rollup` fence inside
 * `.claude/rules/zcode-parity-doctrine.md` §2 — does not exist yet, because `.claude/rules/*`
 * are maintainer-owned (Artifact Ownership Contract + spec C5 D7 carve-out: generated sections
 * there exist only via maintainer-landed render plans). This script is the renderer half of
 * the maintainer-landing plan (docs/meta-factory/research-patches/2026-09-01-s3-owner-proposals.md
 * §P1); the maintainer lands the fence, then flips this script's --check arm into CI
 * (audit-self.yml, same pattern as render-rule-index/render-install-roster).
 *
 * DERIVABLE SLICE ONLY (the D7 falsifier applied — judgment stays prose):
 *   - hook population:        `ls .claude/hooks/*.sh | wc -l`
 *   - plugin-twin presence:   `ls plugin/hooks/` (which twins shipped → reachable on ZCode)
 *   - class rollup:           census.md §2 classification column (the census is the binding
 *                             SSOT the doctrine cites per row)
 * The per-row classification rationale («works via 4D hybrid», degraded-arm wording, …) is
 * judgment prose and STAYS hand-maintained inside the doctrine table.
 *
 * Modes: `--emit` (print the rendered body to stdout — the maintainer pastes it into the
 * fence). `--check` refuses until the target fence exists (exit 2), so wiring it into CI
 * before the fence lands fails loudly, never silently green.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCTRINE = join('.claude', 'rules', 'zcode-parity-doctrine.md');
const CENSUS = join('docs', 'meta-factory', 'research-patches', '2026-07-18-zcode-full-parity-census.md');
const SECTION = 'zcode-parity-rollup';

const log = (...m) => console.error('[render-zcode-parity-rollup]', ...m);

function findRoot(start) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, 'setup.d'))) return d;
    const up = dirname(d);
    if (up === d) throw new Error('setup.d not found. Pass --root <dir>.');
    d = up;
  }
}

function renderBody(root) {
  const hooks = readdirSync(join(root, '.claude', 'hooks')).filter((f) => f.endsWith('.sh')).sort();
  const pluginHooks = existsSync(join(root, 'plugin', 'hooks'))
    ? readdirSync(join(root, 'plugin', 'hooks')).sort()
    : [];
  // Classification rollup: parse the doctrine's own §2 table classification column (the
  // doctrine cites census.md per row; the table is the compact form). Only the class token
  // is parsed — rationale prose in the same cells is ignored. Cells are split on UNESCAPED
  // pipes (`\|` appears inside cell prose and must not split).
  const doctrine = readFileSync(join(root, DOCTRINE), 'utf8');
  // §2 only: §3's per-stage table also opens rows with `| <n> |` and would cross-match.
  const census = doctrine.match(/^## §2 Hook census table[\s\S]*?(?=^## §3 )/m)?.[0] ?? '';
  if (!census) { log('WARNING: §2 census section not found in doctrine — rollup will be empty'); }
  const classes = {};
  let total = 0;
  for (const row of census.matchAll(/^\| \d+ \|.*\|$/gm)) {
    const cells = row[0].replace(/\\\|/g, '\u0000').split('|').map((c) => c.replace(/\u0000/g, '\\|').trim());
    const cls = (cells[cells.length - 2] ?? '').replace(/`/g, '').replace(/\s*\(.*\)\s*$/, '').trim();
    if (!cls) continue;
    classes[cls] = (classes[cls] ?? 0) + 1;
    total += 1;
  }
  const twins = hooks.filter((h) => pluginHooks.includes(h.replace(/\.sh$/, '')) || pluginHooks.includes(h));
  const lines = [
    `- Hook population: **${hooks.length}** (= \`ls .claude/hooks/*.sh | wc -l\`)`,
    `- Plugin twins shipped: **${twins.length}** of ${hooks.length} — ${twins.map((t) => `\`${t.replace(/\.sh$/, '')}\``).join(', ') || 'none'}`,
    `- Classification rollup (census SSOT): ${Object.entries(classes).map(([k, v]) => `\`${k}\` = ${v}`).join('; ')}; Total = ${total}`,
    ``,
    `<!-- Counts above are generated (plan=scripts/render-zcode-parity-rollup.mjs); per-row classification rationale is hand prose and stays outside this section. -->`,
  ];
  log(`hooks: ${hooks.length}; plugin twins: ${twins.length}; table rows parsed: ${total}`);
  return lines.join('\n');
}

function run(argv) {
  const mode = argv.includes('--emit') ? 'emit' : argv.includes('--check') ? 'check' : null;
  if (!mode) { console.error('usage: render-zcode-parity-rollup.mjs (--emit | --check) [--root <dir>]'); return 2; }
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag !== -1 ? resolve(argv[rootFlag + 1]) : findRoot(process.cwd());
  if (!existsSync(join(root, CENSUS))) { console.error(`census SSOT missing: ${CENSUS}`); return 2; }

  const body = renderBody(root);
  if (mode === 'emit') { process.stdout.write(body + '\n'); return 0; }

  // --check: refuse until the maintainer-landed fence exists (fail loud, never silently green).
  const doctrine = readFileSync(join(root, DOCTRINE), 'utf8');
  if (!doctrine.includes(`getff:begin section=${SECTION}`)) {
    console.error(`✗ target fence \`getff:begin section=${SECTION}\` not present in ${DOCTRINE} yet —`);
    console.error('  the landing is a MAINTAINER action (proposal: docs/meta-factory/research-patches/2026-09-01-s3-owner-proposals.md §P1).');
    console.error('  Until it lands, use --emit to print the body. Do not wire --check into CI before the fence exists.');
    return 2;
  }
  console.error('--check body-compare arm: not implemented until the fence lands (land it, then mirror');
  console.error('  the render-rule-index.mjs regionsMatch pattern here and wire audit-self.yml).');
  return 2;
}

function isMainEntry() {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
}
if (isMainEntry()) process.exit(run(process.argv.slice(2)));

export { renderBody, SECTION };
