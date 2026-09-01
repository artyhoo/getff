#!/usr/bin/env node
/**
 * render-presets — deterministic launch-preset section for AI-USAGE-GUIDE.md
 * (beta-ai-docs-agnosticism S3, spec C5 / D2 + D5(i): the honesty-table row promised
 * «this guide gains a §Presets rendered from the shipped preset data» once the presets
 * shipped; that trigger fired (beta-delivery-ux S2 merged as #1327), so the section
 * exists here — derived, not asserted.
 *
 * SOURCE OF TRUTH (read, never re-stated from memory):
 *   `.claude/skills/pipeline/references/presets/*.json` — the same directory
 *   `.claude/skills/pipeline/helpers/list-presets.sh` scans; the rendered line shape
 *   mirrors its `<name> — <description> (mode=…, marker=…)` output. The renderer parses
 *   the JSON directly (node JSON.parse — no jq dependency, offline-safe).
 *
 * RENDER TARGET: packages/core/templates/shared/AI-USAGE-GUIDE.md fenced region
 *   `pipeline-presets` (the §6a bullet list — packages/core/composition/fence.ts
 *   machinery — REUSE, no second fence engine).
 *
 * Modes: `--write` (emit) | `--check` (drift, exit 1 on any failure).
 * Run via `tsx` (imports packages/core/composition/fence.ts — a .ts module).
 * Precedent: scripts/render-rule-index.mjs; scripts/render-install-roster.mjs.
 *
 * Logging: [render-presets] stderr traces per source read and gate verdict.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRegions, injectRegion, regionsMatch } from '../packages/core/composition/fence.ts';

const TARGET = join('packages', 'core', 'templates', 'shared', 'AI-USAGE-GUIDE.md');
const PRESETS_REL = join('.claude', 'skills', 'pipeline', 'references', 'presets');
const SECTION_PRESETS = 'pipeline-presets';

const log = (...m) => console.error('[render-presets]', ...m);

function findRoot(start) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, 'setup.d'))) return d;
    const up = dirname(d);
    if (up === d) throw new Error('setup.d not found (walked to filesystem root). Pass --root <dir>.');
    d = up;
  }
}

/** One bullet per preset, alphabetically by filename — mirrors list-presets.sh output shape. */
function renderPresetBullet(name, data) {
  const description = typeof data.description === 'string' && data.description ? data.description : '<no description>';
  const mode = typeof data.mode === 'string' && data.mode ? data.mode : '<unknown>';
  const marker = typeof data.marker === 'string' && data.marker ? `, marker=${data.marker}` : '';
  return `- \`${name}\` — ${description} (mode=${mode}${marker})`;
}

function loadPresets(root) {
  const dir = join(root, PRESETS_REL);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const bullets = files.map((f) => {
    const name = f.replace(/\.json$/, '');
    const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    return renderPresetBullet(name, data);
  });
  log(`presets: ${files.length} files (${files.map((f) => f.replace(/\.json$/, '')).join(', ')})`);
  return bullets;
}

function run(argv) {
  const mode = argv.includes('--check') ? 'check' : argv.includes('--write') ? 'write' : null;
  if (!mode) { console.error('usage: render-presets.mjs (--write | --check) [--root <dir>]'); return 2; }
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag !== -1 ? resolve(argv[rootFlag + 1]) : findRoot(process.cwd());

  const body = loadPresets(root).join('\n');
  const expected = new Map([[SECTION_PRESETS, body]]);

  const targetPath = join(root, TARGET);
  const source = readFileSync(targetPath, 'utf8');
  const present = new Set(findRegions(source).map((r) => r.sectionId));

  if (mode === 'write') {
    let out = source;
    for (const [id, b] of expected) {
      out = injectRegion(out, id, 'scripts/render-presets.mjs', b);
    }
    writeFileSync(targetPath, out);
    console.log(`render-presets: wrote ${expected.size} regions into ${TARGET}`);
    return 0;
  }

  // --check
  const drift = [];
  for (const id of expected.keys()) {
    if (!present.has(id)) drift.push(`${TARGET}: region \`${id}\` missing (run --write)`);
  }
  if (!regionsMatch(source, expected)) {
    drift.push(`${TARGET}: preset-section drift vs shipped preset data (${PRESETS_REL}/*.json)`);
  }
  if (drift.length) {
    console.error('✗ pipeline-presets drift:\n' + drift.map((d) => `    - ${d}`).join('\n'));
    console.error('  Fix: npx tsx scripts/render-presets.mjs --write');
    return 1;
  }
  console.log(`✓ pipeline-presets up-to-date (${expected.size} regions in ${TARGET})`);
  return 0;
}

function isMainEntry() {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
}
if (isMainEntry()) process.exit(run(process.argv.slice(2)));

export { loadPresets, renderPresetBullet, SECTION_PRESETS };
