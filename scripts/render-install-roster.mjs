#!/usr/bin/env node
/**
 * render-install-roster — deterministic consumer install roster for INSTALL-FOR-AI.md
 * (beta-ai-docs-agnosticism S3, spec C5 / D2: derived, not asserted).
 *
 * WHY: the "This installs" roster in INSTALL-FOR-AI.md restated the installer's shipped
 * agent/skill sets by hand and drifted (the same lying-doc class the D1 inventory records).
 * This renderer extracts the roster from the SAME manifest the installer executes, so the
 * doc and the installer cannot disagree silently.
 *
 * SOURCES OF TRUTH (read, never re-stated from memory):
 *   - agents shipped by default: every `agents/*.md` MINUS the authoring-only skip-list
 *     (`<name>.md) continue ;;` case labels in setup.d/20-agents.sh) MINUS the
 *     factory-gated pair (the `orchestrator-worker-discipline.md|reviewer-discipline.md`
 *     case in the same file).
 *   - skills core set: the hard-copy literals in setup.d/10-skills.sh
 *     (`cp -r "$PKG_ROOT/skills/<name>"`) PLUS `GETFF_SKILLS_CORE` from setup.d/lib.sh.
 *   - skills env contour: `GETFF_SKILLS_ENV` from setup.d/lib.sh (the default depth).
 *
 * RENDER TARGET: INSTALL-FOR-AI.md fenced region `install-roster`
 *   (the two adjacent roster bullets of the "This installs" list — one region so the
 *   600-line pre-commit gate headroom is preserved; packages/core/composition/fence.ts
 *   machinery — REUSE, no second fence engine).
 * Judgment-bearing caveats (KEEP-AIF notes, factory-gating rationale, `getff`-naming note)
 * stay OUTSIDE the fence as hand prose (T17: the renderer will not preserve them).
 *
 * Modes: `--write` (emit) | `--check` (drift, exit 1 on any failure).
 * Run via `tsx` (imports packages/core/composition/fence.ts — a .ts module).
 * Precedent: scripts/render-rule-index.mjs --write/--check; scripts/render-harness-config.mjs.
 *
 * Logging: [render-install-roster] stderr traces per source read and gate verdict.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRegions, injectRegion, regionsMatch } from '../packages/core/composition/fence.ts';

const TARGET = 'INSTALL-FOR-AI.md';
const SECTION_ROSTER = 'install-roster';

const log = (...m) => console.error('[render-install-roster]', ...m);

function findRoot(start) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, 'setup.d'))) return d;
    const up = dirname(d);
    if (up === d) throw new Error('setup.d not found (walked to filesystem root). Pass --root <dir>.');
    d = up;
  }
}

/** Agents shipped at the default depth: agents/*.md minus skip-list minus factory-gated. */
function shippedAgents(root) {
  const agentDir = join(root, 'agents');
  const files = readdirSync(agentDir).filter((f) => f.endsWith('.md'));
  const script = readFileSync(join(root, 'setup.d', '20-agents.sh'), 'utf8');
  const skips = new Set();
  let factoryGated = new Set();
  for (const m of script.matchAll(/^\s*([a-z0-9-]+\.md)\)\s*continue\s*;;/gm)) skips.add(m[1]);
  const pair = script.match(/^\s*([a-z0-9-]+\.md)\|([a-z0-9-]+\.md)\)/m);
  if (pair) factoryGated = new Set([pair[1], pair[2]]);
  // Fail-loud, never fail-open: zero skip entries means the installer was restructured and
  // these regexes no longer match its shape — rendering would silently list ALL agents as
  // shipped (silent-wrong, the exact lying-doc class this renderer exists to kill).
  if (skips.size === 0) {
    throw new Error('setup.d/20-agents.sh: skip-list parse matched 0 entries — installer restructured? Refusing to render.');
  }
  log(`20-agents.sh: ${skips.size} skip-list + ${factoryGated.size} factory-gated entries`);
  const shipped = files.filter((f) => !skips.has(f) && !factoryGated.has(f)).sort();
  log(`agents/: ${files.length} files -> ${shipped.length} shipped at default depth`);
  return shipped;
}

/** Skill slugs per depth, derived from the installer's own literals/constants. */
function shippedSkills(root) {
  const tenSkills = readFileSync(join(root, 'setup.d', '10-skills.sh'), 'utf8');
  const base = [...tenSkills.matchAll(/cp -r "\$PKG_ROOT\/skills\/([a-z0-9-]+)"/g)].map((m) => m[1]);
  const lib = readFileSync(join(root, 'setup.d', 'lib.sh'), 'utf8');
  const readSet = (name) => {
    const m = lib.match(new RegExp(`${name}="([^"]+)"`));
    if (!m) throw new Error(`setup.d/lib.sh: ${name} not found`);
    return m[1].split(/\s+/);
  };
  const core = [...new Set([...base, ...readSet('GETFF_SKILLS_CORE')])].sort();
  const envContour = readSet('GETFF_SKILLS_ENV').sort();
  log(`10-skills.sh base: ${base.join(', ')}; lib.sh core: ${core.length} dirs; env contour: ${envContour.length} dirs`);
  return { core, envContour };
}

function renderAgentsBullet(agents) {
  return `- \`.claude/agents/\` — ${agents.length} files: ${agents.map((a) => a.replace(/\.md$/, '')).join(', ')}`;
}

function renderSkillsBullet({ core, envContour }) {
  const all = [...core, ...envContour];
  return `- \`.claude/skills/\` — ${all.length} dirs at the default \`env\` depth: the ${core.length}-dir core set — ${core.join(', ')} — plus the operator contour ${envContour.join(', ')}`;
}

function run(argv) {
  const mode = argv.includes('--check') ? 'check' : argv.includes('--write') ? 'write' : null;
  if (!mode) { console.error('usage: render-install-roster.mjs (--write | --check) [--root <dir>]'); return 2; }
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag !== -1 ? resolve(argv[rootFlag + 1]) : findRoot(process.cwd());

  const agents = shippedAgents(root);
  const skills = shippedSkills(root);
  // The target bullets sit inside a numbered-list item (3-space indent) — the generated
  // body must carry the same indent or --write would break the list's markdown nesting.
  const body = [renderAgentsBullet(agents), renderSkillsBullet(skills)]
    .map((l) => `   ${l}`)
    .join('\n');
  const expected = new Map([[SECTION_ROSTER, body]]);

  const targetPath = join(root, TARGET);
  const source = readFileSync(targetPath, 'utf8');
  const present = new Set(findRegions(source).map((r) => r.sectionId));

  if (mode === 'write') {
    let out = source;
    for (const [id, body] of expected) {
      out = injectRegion(out, id, 'scripts/render-install-roster.mjs', body);
    }
    writeFileSync(targetPath, out);
    console.log(`render-install-roster: wrote ${expected.size} regions into ${TARGET}`);
    return 0;
  }

  // --check
  const drift = [];
  for (const id of expected.keys()) {
    if (!present.has(id)) drift.push(`${TARGET}: region \`${id}\` missing (run --write)`);
  }
  if (!regionsMatch(source, expected)) {
    drift.push(`${TARGET}: roster drift vs installer manifest (setup.d/20-agents.sh + setup.d/10-skills.sh + setup.d/lib.sh)`);
  }
  if (drift.length) {
    console.error('✗ install-roster drift:\n' + drift.map((d) => `    - ${d}`).join('\n'));
    console.error('  Fix: npx tsx scripts/render-install-roster.mjs --write');
    return 1;
  }
  console.log(`✓ install-roster up-to-date (${expected.size} regions in ${TARGET})`);
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

export { shippedAgents, shippedSkills, renderAgentsBullet, renderSkillsBullet, SECTION_ROSTER };
