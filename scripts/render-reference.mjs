#!/usr/bin/env node
/**
 * render-reference — the D29 reference generator (ref-gen spec §3-§8): eleven families,
 * one engine, two projections (family JSON + fenced markdown), zero new fence machinery.
 *
 * Families: A installer layers · B skills · C agents · D hooks · E templates · F.1 rules ·
 * F.2 generated rules · F.3 scripts · G packages · H bridge CLI · I plugin.
 *
 * Absence discipline (D36): absence-by-CONSTRUCTION renders the G18 token (closed enum,
 * ABSENCE_REASONS); absence-by-OMISSION (a source field the family declares but this member
 * lacks) FAILS the build naming the file, the missing field and the one-line fix. An empty
 * cell is never an outcome; a placeholder is never a value.
 *
 * G18 schema decision, recorded 2026-09-14 (D36 constraint 1 — adding a reason is a recorded
 * schema decision naming its proving input class and its paired negative, never free text):
 * reason #4 `unregistered`. PROPOSITION: a hook file in .claude/hooks/ that BOTH registries
 * (plugin/hooks/hooks.json, .claude/settings.json) fail to name is not always an omission —
 * zcode-parity-doctrine.md rows 1 and 20 record adopt-orchestrator-prompts ("unregistered by
 * default | framework-internal") and worktree-setup ("CC harness feature, not in default
 * settings") as DELIBERATELY unregistered; registering them would require committing
 * .claude/settings.json (agent-uncommittable) and deleting them contradicts the doctrine.
 * PROVING INPUT CLASS: the two registry JSONs (hookRegistrations). PAIRED NEGATIVE: the same
 * file once registered renders the event VALUE, not the token (arm D discriminator), and an
 * unregistered hook with NO delivery marker still fails the build below — the `@dual-pair:` /
 * `@cc-only-rationale` block IS the in-file record of the deliberate-unregistration decision
 * (check-hook-marker.sh gates it), so absence-by-omission keeps naming the file. The token is
 * admissible ONLY on family D `extras.event` / `extras.matcher` (D.schema.json narrows the
 * absent-enum there to this one reason); shipsTo.absent keeps the lane reasons.
 *
 * Input classes are pinned to ref-gen §7 (fragility budget): frontmatter keys via the shared
 * extractor (rule-channel-glob.ts), schema'd JSON, one strict header line per glob (the
 * HEADER_TABLE literal below — the same table the edit-time gate reads, §7 row 6), rule
 * header fields via render-rule-index.mjs (imported, G12), install fingerprints by path AND
 * sha256 content identity, and the wiring-surface classifier in ./census.mjs (§7 row 7).
 * No prose parsing, no installer copy-arm parsing, no git-history inference, no AI fill.
 *
 * Modes: `--write` (emit docs/site/reference/<family>.json + fill fences in EXISTING pages —
 * the generator never creates a page, TD2-6) | `--check` (drift, exit 1) | `--census`
 * (the F.3 measurement + the per-family holes census; ref-gen §3 "Census mode" — the D55
 * first-act command). Run via `npx tsx` (imports .ts modules).
 *
 * Principle test: packages/core/principles/46-reference-generator-arms.test.ts (arms A-G).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beginMarker, endMarker, injectRegion, regionsMatch } from '../packages/core/composition/fence.ts';
import { buildRows } from './render-rule-index.mjs';
import { shippedAgents } from './render-install-roster.mjs';
import { readSkillTiers } from './lib/skill-tiers.mjs';
import { extractHeaderField, extractFrontmatterScalar } from '../packages/core/principles/rule-channel-glob.ts';
import { listScripts, computeWiredSet } from './census.mjs';

const GENERATOR = 'scripts/render-reference.mjs';
const REFERENCE_DIR = 'docs/site/reference';
const SCHEMA_SUBDIR = 'schema';
const TEMPLATES_DIR = 'packages/core/templates';
const TEMPLATE_SIDECAR = `${TEMPLATES_DIR}/templates.manifest.json`;
const RULES_MANIFEST = 'packages/core/manifest/rules-manifest.json';
const FINGERPRINT_DIR = 'tests/install-sh/baselines';

/** G18 gated-absence tokens — closed enum; absence-by-construction ONLY (D36). Adding a
 *  reason = the recorded schema decision in the header comment above, never a quiet append. */
export const ABSENCE_REASONS = ['no-lane', 'no-operator-twin', 'not-byte-copied', 'unregistered'];

/**
 * The shared literal header table (§5 + §7 row 6): one anchored regex per glob, the SAME
 * table the edit-time gate (check-source-header.sh) and this generator's family config read,
 * so the gate and the parser cannot disagree (#sync-by-copy-paste). `<b>` = the file's own
 * basename as it is spelled where it lives; `<stem>` = basename without the extension.
 */
export const HEADER_TABLE = {
  A: { glob: 'setup.d/[0-9]*.sh', line: 2, pattern: '^# setup\\.d/<b> — .{10,}$' },
  D: { glob: '.claude/hooks/*.sh (+ plugin-only hooks/<stem>)', line: 'first comment line after the shebang', pattern: '^# <b> — .{10,}$' },
  'F-sh': { glob: 'scripts/*.sh', line: 2, pattern: '^# <b> — .{10,}$' },
  'F-mjs': { glob: 'scripts/*.mjs', line: 3, pattern: '^ \\* <stem> — .{10,}$' },
  H: { glob: 'packages/runtime-bridge/src/cli/*.ts', line: 2, pattern: '^ \\* <b> — .{10,}$' },
};

/**
 * The two fence-type → `kind:` slugs (TD2-7): sheet card fence and family-overview table
 * fence. The SSOT for these slugs is D30's page-kinds registry (docs-author skill, S0q);
 * until that registry exists in the tree the assertion is armed but deferred — --write and
 * --check print the deferral on stderr and --check reds the moment the registry lands and
 * the slugs differ (a stale pin is visible, never silent).
 */
export const KIND_PINS = { sheet: 'reference-sheet', 'family-table': 'family-overview' };
const KIND_REGISTRY = '.claude/skills/docs-author/references/page-kinds.md';

/** Plumbing allowlists (§7 row 6 literal pins; a stale pin is visible via arms C/F). */
const H_ALLOWLIST = ['aifHttp.ts', 'cliEntry.ts', 'openQuestion.ts'];
const D_ALLOWLIST = ['_zcode-emit', 'run-hook.cmd', 'lang', 'lib'];

export const FAMILIES = [
  { id: 'A', name: 'installer layers' },
  { id: 'B', name: 'skills' },
  { id: 'C', name: 'agents' },
  { id: 'D', name: 'hooks' },
  { id: 'E', name: 'templates' },
  { id: 'F1', name: 'rules' },
  { id: 'F2', name: 'generated rules' },
  { id: 'F3', name: 'scripts' },
  { id: 'G', name: 'packages' },
  { id: 'H', name: 'bridge CLI' },
  { id: 'I', name: 'plugin' },
];
const FAMILY_NAME = new Map(FAMILIES.map((f) => [f.id, f.name]));

const log = (...m) => console.error('[render-reference]', ...m);
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The D36 error contract: names the file, the missing field, the one-line fix. */
function fail(msg) {
  throw new Error(msg);
}

// ---------------------------------------------------------------------------
// cached repo reads (fingerprints, tiers, wired set) — one read per root per run
// ---------------------------------------------------------------------------
const cache = new Map();
function memo(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

/** Fingerprint rows {stack, lane, hash, path} — input class 5, read by path and by hash. */
function fingerprints(root) {
  return memo(`fp:${root}`, () => {
    const dir = join(root, FINGERPRINT_DIR);
    const rows = [];
    if (!existsSync(dir)) return rows;
    for (const stack of readdirSync(dir)) {
      const stackDir = join(dir, stack);
      for (const f of readdirSync(stackDir)) {
        if (!f.endsWith('.fingerprint')) continue;
        const lane = f.replace(/\.fingerprint$/, '');
        for (const line of readFileSync(join(stackDir, f), 'utf8').split('\n')) {
          const m = line.match(/^([0-9a-f]{64})  (.+)$/);
          if (m) rows.push({ stack, lane, hash: m[1], path: m[2] });
        }
      }
    }
    return rows;
  });
}

/** Consumer-lane stacks for an installed path (by PATH — presence, any content hash). */
function laneStacks(root, consumerPath) {
  return [...new Set(fingerprints(root).filter((r) => r.path === consumerPath).map((r) => r.stack))].sort();
}

/** shipsTo from lane presence: stacks, else the no-lane token (G18). */
function shipsByLane(root, tier, consumerPath) {
  const stacks = consumerPath ? laneStacks(root, consumerPath) : [];
  return stacks.length ? { tier, stacks } : { tier, absent: 'no-lane' };
}

/** Tier sets (skills) — existsSync-guarded so synthetic fixture roots degrade to framework. */
function tiers(root) {
  return memo(`tiers:${root}`, () => {
    if (!existsSync(join(root, 'setup.d', 'lib.sh'))) return { core: [], env: [], factory: [] };
    return readSkillTiers(root);
  });
}

/** 10-skills.sh hard-copy literals — existsSync-guarded (fixtures); empty when absent. */
function installerSkillLiterals(root) {
  return memo(`literals:${root}`, () => {
    const p = join(root, 'setup.d', '10-skills.sh');
    if (!existsSync(p)) return [];
    return [...readFileSync(p, 'utf8').matchAll(/(?:cp -r|_copy_tree_with_transform) "\$PKG_ROOT\/skills\/([a-z0-9-]+)"/g)].map((m) => m[1]);
  });
}

/** Wired set for scripts/ — the census module is the ONLY classifier (§7 row 7). */
function wiredSet(root) {
  return memo(`wired:${root}`, () => {
    const shippedByPath = [...new Set(fingerprints(root).map((r) => r.path.split('/').pop()).filter((b) => /\.(sh|mjs)$/.test(b)))];
    return computeWiredSet(root, shippedByPath);
  });
}

/** Operator-skill dirs: the TRACKED set (machine-determinism, TD2-4 — untracked runtime
 *  installs like aif-* are not repo members); falls back to readdir outside a git repo so
 *  synthetic fixture roots behave. */
function operatorSkillDirs(root) {
  return memo(`opskills:${root}`, () => {
    const rel = '.claude/skills';
    const abs = join(root, rel);
    if (!existsSync(abs)) return [];
    if (existsSync(join(root, '.git'))) {
      try {
        const out = execFileSync('git', ['ls-files', rel], { cwd: root, encoding: 'utf8' });
        const dirs = new Set();
        for (const line of out.split('\n')) {
          const parts = line.split('/');
          if (parts[0] === '.claude' && parts[1] === 'skills' && parts[2]) dirs.add(parts[2]);
        }
        return [...dirs].filter((d) => existsSync(join(abs, d, 'SKILL.md'))).sort();
      } catch (e) {
        log(`git ls-files failed (${e.message.split('\n')[0]}) — falling back to readdir for ${rel}`);
      }
    }
    return readdirSync(abs).filter((d) => existsSync(join(abs, d, 'SKILL.md'))).sort();
  });
}

function shippedSkillDirs(root) {
  const abs = join(root, 'skills');
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((d) => existsSync(join(abs, d, 'SKILL.md'))).sort();
}

function walkFiles(dir, pre = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walkFiles(join(dir, e.name), `${pre}${e.name}/`));
    else out.push(`${pre}${e.name}`);
  }
  return out;
}

/** 1-based line of the first regex hit in text (null when absent). */
function lineOf(text, re) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  return null;
}

/** First comment line after the shebang: its 1-based line, or null. @-marker lines do NOT
 *  count as the header — the strict grammar demands the header BEFORE any marker (§4 D). */
function firstCommentLineAfterShebang(text) {
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '') continue;
    if (l.startsWith('#!')) continue;
    if (l.startsWith('#')) return { line: i + 1, text: l };
    return null;
  }
  return null;
}

function headerDescription(headerText, basename) {
  const m = headerText.match(new RegExp(`^# ${escapeRe(basename)} — (.+)$`));
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// per-family builders — population computed (§4), absence-by-omission fails (D36)
// ---------------------------------------------------------------------------

function buildA(root) {
  const dir = join(root, 'setup.d');
  const names = existsSync(dir) ? readdirSync(dir).filter((f) => /^[0-9]+-.*\.sh$/.test(f)).sort() : [];
  return names.map((name) => {
    const rel = `setup.d/${name}`;
    const src = readFileSync(join(root, rel), 'utf8');
    const lines = src.split('\n');
    const header = lines[1] ?? '';
    if (!new RegExp(`^# setup\\.d/${escapeRe(name)} — .{10,}$`).test(header)) {
      fail(`${rel}: missing header line 2 matching \`# setup.d/${name} — <one line>\` — add it (HEADER_TABLE.A); every layer states what it does`);
    }
    return {
      name,
      kind: 'installer-layer',
      shipsTo: { tier: 'all' },
      description: header.slice(`# setup.d/${name} — `.length).trim(),
      source: { path: rel, line: 2 },
      extras: { order: parseInt(name, 10) },
      example: null,
    };
  });
}

function postureOf(src, rel) {
  // the marker ships inside an HTML comment on the live tree (`<!-- @harness-posture: portable — … -->`)
  // and may also be a bare line; the VALUE is the first token, the rest is rationale prose.
  const m = src.match(/@harness-posture:\s*([A-Za-z0-9-]+)/);
  if (!m) {
    fail(`${rel}: missing \`@harness-posture:\` marker line — add one (§5 #7); the posture is a sourced field, never inferred`);
  }
  return m[1];
}

function buildB(root) {
  const op = operatorSkillDirs(root);
  const ship = shippedSkillDirs(root);
  const names = [...new Set([...op, ...ship])].sort();
  const tierSets = tiers(root);
  const literals = installerSkillLiterals(root);
  return names.map((name) => {
    const shipRel = `skills/${name}/SKILL.md`;
    const opRel = `.claude/skills/${name}/SKILL.md`;
    const hasShip = existsSync(join(root, shipRel));
    const hasOp = existsSync(join(root, opRel));
    const srcRel = hasShip ? shipRel : opRel;
    const src = readFileSync(join(root, srcRel), 'utf8');
    const description = extractFrontmatterScalar(src, 'description');
    if (description === null || description.trim() === '') {
      fail(`${srcRel}: missing frontmatter \`description\` — add one line (Claude Code routes on it); a blank description is absence-by-omission`);
    }
    const line = lineOf(src, new RegExp(`^description:`));
    if (line === null) fail(`${srcRel}: frontmatter \`description\` line not found — the frontmatter block must carry it`);
    // one row per name: the shipped file is the source (P-AC — what consumers receive); the
    // operator twin's path lands in extras; a shipped skill with no operator twin carries the token.
    let operatorTwin;
    if (hasOp) operatorTwin = opRel;
    else if (hasShip) operatorTwin = { absent: 'no-operator-twin' };
    else operatorTwin = opRel; // operator-native member: the operator file is its own twin row
    const tier = tierSets.factory.includes(name) ? 'factory'
      : tierSets.env.includes(name) ? 'env'
      : tierSets.core.includes(name) || literals.includes(name) ? 'core'
      : 'framework';
    return {
      name,
      kind: 'skill',
      shipsTo: shipsByLane(root, tier, opRel),
      description,
      source: { path: srcRel, line },
      extras: {
        invocation: extractFrontmatterScalar(src, 'disable-model-invocation') !== null ? 'slash-only' : 'auto',
        posture: postureOf(src, srcRel),
        'operator-twin': operatorTwin,
      },
      example: null,
    };
  });
}

/** Whole-token references to the agent's hyphenated name (derived, exact token match). */
function referencedBy(root, name) {
  const re = new RegExp(`(?<![a-z-])${escapeRe(name)}(?![a-z-])`);
  const out = [];
  const scan = (abs, rel) => {
    if (re.test(readFileSync(abs, 'utf8'))) out.push(rel);
  };
  const skillsDir = join(root, '.claude/skills');
  if (existsSync(skillsDir)) {
    for (const rel of walkFiles(skillsDir, '.claude/skills/')) {
      if (rel.endsWith('SKILL.md')) scan(join(root, rel), rel);
    }
  }
  const agentsDir = join(root, 'agents');
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir).filter((f) => f.endsWith('.md'))) {
      scan(join(agentsDir, f), `agents/${f}`);
    }
  }
  const rulesDir = join(root, '.claude/rules');
  if (existsSync(rulesDir)) {
    for (const f of readdirSync(rulesDir).filter((f) => f.endsWith('.md'))) {
      scan(join(rulesDir, f), `.claude/rules/${f}`);
    }
  }
  return out.sort();
}

function buildC(root) {
  const names = shippedAgents(root).map((f) => f.replace(/\.md$/, '')).sort();
  return names.map((name) => {
    const rel = `agents/${name}.md`;
    const src = readFileSync(join(root, rel), 'utf8');
    const description = extractFrontmatterScalar(src, 'description');
    if (description === null || description.trim() === '') {
      fail(`${rel}: missing frontmatter \`description\` — add one line (Claude Code routes on it)`);
    }
    const tools = extractFrontmatterScalar(src, 'tools');
    if (tools === null || tools.trim() === '') {
      fail(`${rel}: missing frontmatter \`tools\` — add the tool list line (§4 C: 100% of the family declares it)`);
    }
    const line = lineOf(src, /^description:/);
    if (line === null) fail(`${rel}: frontmatter \`description\` line not found`);
    return {
      name,
      kind: 'agent',
      shipsTo: shipsByLane(root, 'framework', `.claude/agents/${name}.md`),
      description,
      source: { path: rel, line },
      extras: { tools, 'referenced-by': referencedBy(root, name) },
      example: null,
    };
  });
}

/** Hook registrations from one registry object ({event: [{matcher?, hooks:[{command}]}]}). */
function registryEvents(node, matchRe) {
  const out = [];
  if (!node || typeof node !== 'object') return out;
  for (const [event, entries] of Object.entries(node)) {
    for (const e of entries ?? []) {
      const matcher = typeof e?.matcher === 'string' ? e.matcher : null;
      for (const h of e?.hooks ?? []) {
        const m = (h?.command ?? '').match(matchRe);
        if (m) out.push({ event, matcher, name: m[1] });
      }
    }
  }
  return out;
}

function hookRegistrations(root) {
  return memo(`hookreg:${root}`, () => {
    const regs = [];
    const pluginJson = join(root, 'plugin/hooks/hooks.json');
    if (existsSync(pluginJson)) {
      regs.push(...registryEvents(JSON.parse(readFileSync(pluginJson, 'utf8')).hooks ?? {}, /run-hook\.cmd"\s+([a-z0-9-]+)/));
    }
    const settingsJson = join(root, '.claude/settings.json');
    if (existsSync(settingsJson)) {
      regs.push(...registryEvents(JSON.parse(readFileSync(settingsJson, 'utf8')).hooks ?? {}, /\.claude\/hooks\/([a-z0-9-]+)\.sh/));
    }
    return regs;
  });
}

function buildD(root) {
  const hooksDir = join(root, '.claude/hooks');
  const stems = existsSync(hooksDir)
    ? readdirSync(hooksDir).filter((f) => f.endsWith('.sh')).map((f) => f.replace(/\.sh$/, '')).sort()
    : [];
  const regs = hookRegistrations(root);
  const pluginOnly = [...new Set(regs.filter((r) => !stems.includes(r.name)).map((r) => r.name))].sort()
    .filter((n) => !D_ALLOWLIST.includes(n));
  return [...stems, ...pluginOnly].sort().map((stem) => {
    const fwRel = `.claude/hooks/${stem}.sh`;
    const pluginRel = `plugin/hooks/${stem}`;
    const hasFw = existsSync(join(root, fwRel));
    const hasPlugin = existsSync(join(root, pluginRel));
    const srcRel = hasFw ? fwRel : pluginRel;
    const src = readFileSync(join(root, srcRel), 'utf8');
    // strict header: FIRST comment line after the shebang, before any @-marker line
    const first = firstCommentLineAfterShebang(src);
    if (!first) fail(`${srcRel}: missing header line matching \`# ${srcRel.split('/').pop()} — <one line>\` — add it as the first comment line after the shebang (HEADER_TABLE.D, §5 #3)`);
    if (/^# @(dual-pair|cc-only-rationale)\b/.test(first.text)) {
      fail(`${srcRel}: the \`@${first.text.slice(3).split(':')[0]}\` marker block sits BEFORE the header — move the \`# ${srcRel.split('/').pop()} — <one line>\` header above it (§4 D: strict header first)`);
    }
    const description = headerDescription(first.text, srcRel.split('/').pop());
    if (!description) {
      fail(`${srcRel}: first comment line does not match \`# ${srcRel.split('/').pop()} — <one line>\` (HEADER_TABLE.D) — fix it: ${JSON.stringify(first.text)}`);
    }
    const mine = regs.filter((r) => r.name === stem);
    // `unregistered` (G18 reason #4 — see the recorded schema decision in the header comment):
    // both registries silent + a delivery marker = the doctrine-recorded deliberate state
    // (absence-by-construction → token); both registries silent + NO marker falls through to
    // the fail below (absence-by-omission names the file, D36).
    const unregistered = mine.length === 0;
    const events = unregistered ? { absent: 'unregistered' } : [...new Set(mine.map((r) => r.event))].sort();
    const matchers = unregistered ? { absent: 'unregistered' } : [...new Set(mine.filter((r) => r.matcher).map((r) => r.matcher))].sort();
    const delivery = [];
    const dual = src.match(/^#\s*@dual-pair:\s*(.+)$/m);
    if (dual) delivery.push(`@dual-pair:${dual[1].trim()}`);
    if (/^#\s*@cc-only-rationale\b/m.test(src)) delivery.push('@cc-only-rationale');
    if (delivery.length === 0) {
      fail(`${srcRel}: ${unregistered
        ? 'registered in no hooks registry (plugin/hooks/hooks.json, .claude/settings.json) AND carries no `@dual-pair:` / `@cc-only-rationale` marker — a hook nothing registers and no doctrine marker explains never fires (absence-by-omission): register it or remove the file'
        : 'missing `@dual-pair:` / `@cc-only-rationale` marker — add one (check-hook-marker.sh gates it)'}`);
    }
    if (hasPlugin) delivery.push('plugin');
    return {
      name: stem,
      kind: 'hook',
      shipsTo: hasFw ? shipsByLane(root, 'framework', fwRel) : { tier: 'plugin' },
      description,
      source: { path: srcRel, line: first.line },
      extras: { event: events, matcher: matchers, delivery },
      example: null,
    };
  });
}

function buildE(root) {
  const tplDir = join(root, TEMPLATES_DIR);
  const files = existsSync(tplDir)
    ? walkFiles(tplDir).filter((f) => f !== 'templates.manifest.json').sort()
    : [];
  const manifestRel = TEMPLATE_SIDECAR;
  const manifestPath = join(root, manifestRel);
  if (!existsSync(manifestPath)) {
    fail(`${manifestRel}: missing sidecar manifest — create one row per template file \`{path, description}\` (§5 #5); the two-way completeness gate fails without it`);
  }
  const raw = readFileSync(manifestPath, 'utf8');
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) fail(`${manifestRel}: sidecar must be a JSON array of {path, description} rows`);
  const byPath = new Map();
  const TPL_PREFIX = `${TEMPLATES_DIR}/`;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`${manifestRel}: each sidecar row must be an object \`{path, description}\``);
    for (const key of Object.keys(row)) {
      if (key !== 'path' && key !== 'description') {
        fail(`${manifestRel}: row for \`${row.path ?? '?'}\` carries field \`${key}\` — the sidecar carries ONLY \`description\` (G16); \`installed-to\` is derived from fingerprints, never declared`);
      }
    }
    if (typeof row.path !== 'string' || row.path.trim() === '') fail(`${manifestRel}: a sidecar row is missing its \`path\` — name the template file it describes`);
    if (!row.path.startsWith(TPL_PREFIX)) fail(`${manifestRel}: row path \`${row.path}\` is not under \`${TPL_PREFIX}\` — sidecar rows carry the repo-relative template path`);
    if (typeof row.description !== 'string' || row.description.trim() === '') fail(`${manifestRel}: row for \`${row.path}\` is missing \`description\` — add one line`);
    if (byPath.has(row.path)) fail(`${manifestRel}: two rows describe \`${row.path}\` — one row per template file`);
    byPath.set(row.path, row);
  }
  for (const rowPath of byPath.keys()) {
    if (!existsSync(join(root, rowPath))) fail(`${manifestRel}: row describes \`${rowPath}\` which does not exist — fix the path or remove the row (two-way completeness)`);
  }
  // sha256 collision across templates = error naming both (G16: the derivation could not tell
  // which template a fingerprint line came from)
  const seenHash = new Map();
  for (const rel of files) {
    const h = sha256(join(root, TEMPLATES_DIR, rel));
    if (seenHash.has(h)) fail(`${manifestRel}: template sha256 collision: ${seenHash.get(h)} and ${TEMPLATES_DIR}/${rel} are byte-identical — the installed-to derivation cannot distinguish them`);
    seenHash.set(h, rel);
  }
  return files.map((rel) => {
    const rowKey = `${TEMPLATES_DIR}/${rel}`;
    if (!byPath.has(rowKey)) fail(`${manifestRel}: no sidecar row for \`${rowKey}\` — add \`{path: "${rowKey}", description: "..."}\` (every template file needs exactly one row)`);
    const row = byPath.get(rowKey);
    const rowLine = lineOf(raw, new RegExp(`"path"\\s*:\\s*"${escapeRe(rowKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"'))}"`));
    const hash = sha256(join(root, TEMPLATES_DIR, rel));
    const installs = fingerprints(root).filter((r) => r.hash === hash)
      .map((r) => ({ stack: r.stack, lane: r.lane, path: r.path }))
      .sort((a, b) => (a.stack + a.path).localeCompare(b.stack + b.path));
    const installedTo = installs.length ? installs : { absent: 'not-byte-copied' };
    const stacks = [...new Set(installs.map((i) => i.stack))].sort();
    return {
      name: rel,
      kind: 'template',
      shipsTo: stacks.length ? { tier: 'framework', stacks } : { tier: 'framework', absent: 'no-lane' },
      description: row.description,
      source: { path: manifestRel, line: rowLine ?? 1 },
      installedTo,
      extras: { format: extname(rel).replace(/^\./, '') || 'none' },
      example: null,
    };
  });
}

function buildF1(root) {
  const rulesDir = join(root, '.claude/rules');
  const names = existsSync(rulesDir)
    ? readdirSync(rulesDir).filter((f) => f.endsWith('.md') && f !== '00-rule-index.md').map((f) => f.replace(/\.md$/, '')).sort()
    : [];
  const indexRows = new Map(buildRows(root).rows.map((r) => [r.name, r]));
  return names.map((name) => {
    const rel = `.claude/rules/${name}.md`;
    const src = readFileSync(join(root, rel), 'utf8');
    const full = extractHeaderField(src, 'Authoritative for');
    if (full === null || full.trim() === '') {
      fail(`${rel}: missing \`> **Authoritative for:**\` header field — add it (principle 09 gates it; it is the F.1 description source)`);
    }
    const row = indexRows.get(name);
    if (!row) fail(`${rel}: no 00-rule-index.md row — regenerate the index (npx tsx scripts/render-rule-index.mjs --write); F.1 rows are identical to it (G12)`);
    const line = lineOf(src, /^\s*>\s*\*\*Authoritative for:\*\*/);
    if (line === null) fail(`${rel}: \`> **Authoritative for:**\` line not found`);
    const description = full.split(/(?<=\.)\s/)[0].trim();
    if (description === '') fail(`${rel}: \`> **Authoritative for:**\` first sentence is empty`);
    return {
      name,
      kind: 'rule',
      shipsTo: { tier: 'framework' },
      description,
      source: { path: rel, line },
      extras: { class: row.classLetter, fires: row.fires, channels: row.channels },
      example: null,
    };
  });
}

function buildF2(root) {
  const manifestPath = join(root, RULES_MANIFEST);
  if (!existsSync(manifestPath)) fail(`${RULES_MANIFEST}: missing rules manifest — family F.2 has no population without it`);
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  return Object.keys(manifest).sort().map((key) => {
    const row = manifest[key];
    if (typeof row.title !== 'string' || row.title.trim() === '') {
      fail(`${RULES_MANIFEST}: rule \`${key}\` is missing \`title\` — add it (the F.2 description source)`);
    }
    const checkType = row?.check?.type;
    if (typeof checkType !== 'string' || checkType.trim() === '') {
      fail(`${RULES_MANIFEST}: rule \`${key}\` is missing \`check.type\` — add it (§4 F.2: 100% of the family declares it)`);
    }
    const line = lineOf(raw, new RegExp(`^\\s*"${escapeRe(key)}"\\s*:`));
    if (line === null) fail(`${RULES_MANIFEST}: key \`${key}\` line not found`);
    return {
      name: key,
      kind: 'generated-rule',
      shipsTo: { tier: 'framework', stacks: Array.isArray(row.stack) ? [...row.stack].sort() : [] },
      description: row.title,
      source: { path: RULES_MANIFEST, line },
      extras: { checkType },
      example: null,
    };
  });
}

function buildF3(root) {
  const wired = wiredSet(root);
  const scripts = listScripts(root);
  const cards = [];
  const unwired = [];
  for (const s of scripts) {
    if (s.testMaterial) continue; // test material: in the population as a gate, never a card
    if (!wired.has(s.name)) { unwired.push(s.name); continue; }
    const rel = `scripts/${s.name}`;
    const src = readFileSync(join(root, rel), 'utf8');
    const lines = src.split('\n');
    let description = null;
    let headerLine = null;
    if (s.name.endsWith('.sh')) {
      for (const idx of [1, 2]) {
        const m = (lines[idx] ?? '').match(new RegExp(`^# ${escapeRe(s.name)} — (.+)$`));
        if (m) { description = m[1].trim(); headerLine = idx + 1; break; }
      }
      if (!description) {
        fail(`${rel}: missing header line matching \`# ${s.name} — <one line>\` — add it (HEADER_TABLE['F-sh'], §5 #4); a wired script states what it does`);
      }
    } else {
      if (lines[1] !== '/**' || !new RegExp(`^ \\* ${escapeRe(s.name.replace(/\.mjs$/, ''))} — .{10,}$`).test(lines[2] ?? '')) {
        fail(`${rel}: missing JSDoc line 3 matching \` * ${s.name.replace(/\.mjs$/, '')} — <one line>\` (line 2 must open \`/**\`) — add it (HEADER_TABLE['F-mjs'])`);
      }
      description = (lines[2] ?? '').replace(/^ \* .+? — /, '').trim();
      headerLine = 3;
    }
    const wiredFrom = wired.get(s.name).map((ev) =>
      ev.via === 'fingerprint' ? `shipped-by-path (${ev.file})` : ev.via === 'closure' ? `${ev.file}:${ev.line} (${ev.shape}, closure)` : `${ev.file}:${ev.line} (${ev.shape})`,
    );
    const stacks = laneStacks(root, rel);
    cards.push({
      name: s.name,
      kind: 'script',
      shipsTo: stacks.length ? { tier: 'consumer', stacks } : { tier: 'framework', absent: 'no-lane' },
      description,
      source: { path: rel, line: headerLine },
      extras: { 'wired-from': wiredFrom },
      example: null,
    });
  }
  cards.sort((a, b) => a.name.localeCompare(b.name));
  // the unwired list rides on the returned array — familyDoc('F3', members) emits it as the
  // doc-level `unwired` key (§3.1; the arm C contract reads it there)
  cards.unwired = unwired.sort();
  return cards;
}

function buildG(root) {
  const pkgDir = join(root, 'packages');
  const dirs = existsSync(pkgDir)
    ? readdirSync(pkgDir).filter((d) => existsSync(join(pkgDir, d, 'package.json'))).sort()
    : [];
  return dirs.map((dir) => {
    const rel = `packages/${dir}/package.json`;
    const raw = readFileSync(join(root, rel), 'utf8');
    const pkg = JSON.parse(raw);
    const description = pkg.description;
    if (typeof description !== 'string' || description.trim() === '') {
      fail(`${rel}: missing \`description\` — add one line (npm renders it; §5 #1)`);
    }
    const line = lineOf(raw, /"description"\s*:/);
    if (line === null) fail(`${rel}: \`description\` key line not found`);
    if (typeof pkg.version !== 'string' || pkg.version.trim() === '') {
      fail(`${rel}: missing \`version\` — add it (§4 G: 100% of the family declares it)`);
    }
    return {
      name: dir,
      kind: 'package',
      shipsTo: { tier: pkg.private === false ? 'npm' : 'framework' },
      description,
      source: { path: rel, line },
      extras: { version: pkg.version },
      example: null,
    };
  });
}

function buildH(root) {
  const cliDir = join(root, 'packages/runtime-bridge/src/cli');
  const files = existsSync(cliDir)
    ? readdirSync(cliDir).filter((f) => f.endsWith('.ts') && !H_ALLOWLIST.includes(f)).sort()
    : [];
  return files.map((file) => {
    const rel = `packages/runtime-bridge/src/cli/${file}`;
    const lines = readFileSync(join(root, rel), 'utf8').split('\n');
    if (lines[0] !== '/**' || !new RegExp(`^ \\* ${escapeRe(file)} — .{10,}$`).test(lines[1] ?? '')) {
      fail(`${rel}: missing JSDoc line 2 matching \` * ${file} — <one line>\` (line 1 must open \`/**\`) — add it (HEADER_TABLE.H, §5 #6)`);
    }
    return {
      name: file.replace(/\.ts$/, ''),
      kind: 'cli-command',
      shipsTo: { tier: 'factory' },
      description: (lines[1] ?? '').replace(/^ \* .+? — /, '').trim(),
      source: { path: rel, line: 2 },
      extras: {},
      example: null,
    };
  });
}

function buildI(root) {
  const members = [];
  const push = (rel, component, twinSourceRel) => {
    const src = readFileSync(join(root, rel), 'utf8');
    const description = extractFrontmatterScalar(src, 'description');
    if (description === null || description.trim() === '') {
      fail(`${rel}: missing frontmatter \`description\` — add one line (§4 I: 8/8 measured)`);
    }
    const line = lineOf(src, /^description:/);
    if (line === null) fail(`${rel}: frontmatter \`description\` line not found`);
    // twin-of: byte-identical source (sha256) or the not-byte-copied token (G18 — measured,
    // never declared; a plugin file with no repo source is by construction not a byte-copy)
    let twinOf = { absent: 'not-byte-copied' };
    if (twinSourceRel && existsSync(join(root, twinSourceRel)) && sha256(join(root, rel)) === sha256(join(root, twinSourceRel))) {
      twinOf = twinSourceRel;
    }
    members.push({
      // Member key: a skill is named by its DIRECTORY (plugin/skills/<name>/SKILL.md —
      // basename would collapse every skill to "SKILL"; caught by arm C's name-level
      // population comparison, 2026-09-14). Commands/agents are flat files → their stem.
      name: (() => {
        const segs = rel.split('/');
        const base = segs[segs.length - 1];
        return base === 'SKILL.md' ? segs[segs.length - 2] : base.replace(/\.md$/, '');
      })(),
      kind: 'plugin-component',
      shipsTo: { tier: 'plugin' },
      description,
      source: { path: rel, line },
      extras: { component, 'twin-of': twinOf },
      example: null,
    });
  };
  const skillsDir = join(root, 'plugin/skills');
  if (existsSync(skillsDir)) {
    for (const d of readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, 'SKILL.md'))).sort()) {
      push(`plugin/skills/${d}/SKILL.md`, 'skill', `skills/${d}/SKILL.md`);
    }
  }
  const commandsDir = join(root, 'plugin/commands');
  if (existsSync(commandsDir)) {
    for (const f of readdirSync(commandsDir).filter((f) => f.endsWith('.md')).sort()) push(`plugin/commands/${f}`, 'command', null);
  }
  const agentsDir = join(root, 'plugin/agents');
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort()) push(`plugin/agents/${f}`, 'agent', `agents/${f}`);
  }
  return members.sort((a, b) => a.name.localeCompare(b.name));
}

const BUILDERS = {
  A: buildA, B: buildB, C: buildC, D: buildD, E: buildE,
  F1: buildF1, F2: buildF2, F3: buildF3, G: buildG, H: buildH, I: buildI,
};

export function buildFamily(root, id) {
  const build = BUILDERS[id];
  if (!build) fail(`unknown family id "${id}" — one of ${FAMILIES.map((f) => f.id).join(', ')}`);
  return build(root);
}

export function buildAllFamilies(root) {
  const out = {};
  for (const f of FAMILIES) out[f.id] = buildFamily(root, f.id);
  return out;
}

export function familyDoc(id, members) {
  const doc = {
    schemaVersion: 1,
    family: id,
    familyName: FAMILY_NAME.get(id),
    generator: GENERATOR,
    members: Array.isArray(members) ? members : [],
  };
  if (id === 'F3' && members && Array.isArray(members.unwired)) doc.unwired = [...members.unwired].sort();
  return doc;
}

/** The family-overview fence body (≤6 columns, one line per member — §6). */
function overviewTable(id, members) {
  const head = {
    A: '| Layer | Order | What it does | Ships-to |',
    B: '| Skill | Tier | Invocation | What it is | Ships-to |',
    C: '| Agent | Tools | What it is | Referenced-by | Ships-to |',
    D: '| Hook | Events | What it does | Delivery | Ships-to |',
    E: '| Template | Format | What it is | Installed-to |',
    F1: '| Rule | Class | Fires | Channels |',
    F2: '| Rule | Check | Stacks | Title |',
    F3: '| Script | What it does | Wired-from | Ships-to |',
    G: '| Package | Version | Ships-to | Description |',
    H: '| Command | What it does | Ships-to |',
    I: '| Component | Kind | Twin-of | What it is |',
  }[id];
  const cells = {
    A: (m) => [`\`${m.name}\``, String(m.extras.order), m.description, 'all stacks'],
    B: (m) => [`\`${m.name}\``, m.shipsTo.tier, m.extras.invocation, m.description, renderShips(m)],
    C: (m) => [`\`${m.name}\``, m.extras.tools, m.description, String(m.extras['referenced-by'].length), renderShips(m)],
    D: (m) => [`\`${m.name}\``, renderEvent(m.extras.event), m.description, m.extras.delivery.join(' + '), renderShips(m)],
    E: (m) => [`\`${m.name}\``, m.extras.format, m.description, renderInstalled(m)],
    F1: (m) => [`\`${m.name}\``, m.extras.class, m.extras.fires, m.extras.channels],
    F2: (m) => [`\`${m.name}\``, m.extras.checkType, (m.shipsTo.stacks ?? []).join(', '), m.description],
    F3: (m) => [`\`${m.name}\``, m.description, m.extras['wired-from'].join('; '), renderShips(m)],
    G: (m) => [`\`${m.name}\``, m.extras.version, m.shipsTo.tier, m.description],
    H: (m) => [`\`${m.name}\``, m.description, m.shipsTo.tier],
    I: (m) => [`\`${m.name}\``, m.extras.component, renderTwin(m.extras['twin-of']), m.description],
  };
  // `cells` is the lookup table (never pre-resolved with `[id]` — indexing the resolved cell
  // function again is the bug arm 3 of render-reference.test.sh pins). The per-kind override
  // keeps a plugin-component row landing in a non-I family rendering with the I columns.
  const rows = members.map((m) => `| ${cells[m.kind === 'plugin-component' ? 'I' : id](m).join(' | ')} |`);
  const cols = head.split('|').length - 2; // leading + trailing empty segments
  return [head, `|${'---|'.repeat(cols)}`, ...rows].join('\n');
}

/** Family D `extras.event` cell — the unregistered token renders as prose, never `undefined`. */
function renderEvent(v) {
  return Array.isArray(v) ? v.join(', ') : `not registered (${v.absent})`;
}

function renderShips(m) {
  if (m.shipsTo.absent) return `not installed on any lane (${m.shipsTo.absent})`;
  const stacks = m.shipsTo.stacks ?? [];
  return stacks.length ? `${m.shipsTo.tier}: ${stacks.join(', ')}` : m.shipsTo.tier;
}

function renderInstalled(m) {
  if (m.installedTo.absent) return `not byte-copied (${m.installedTo.absent})`;
  return m.installedTo.map((i) => `${i.stack} · ${i.path}`).join(' / ');
}

function renderTwin(t) {
  return typeof t === 'string' ? t : `not byte-copied (${t.absent})`;
}

/** The card fence block for one member (arm A contract; S0b's gold fixtures pin the bytes). */
export function renderCardFence(dir, entry) {
  const member = JSON.parse(readFileSync(join(dir, entry, 'member.json'), 'utf8'));
  const section = `${member.family}-card-${member.name}`;
  const rows = [
    ['name', `\`${member.name}\``],
    ['kind', member.kind],
    ['ships-to', renderShips(member)],
    ['description', member.description],
    ['source', `\`${member.source.path}:${member.source.line}\``],
    ...Object.entries(member.extras ?? {}).map(([k, v]) => [k, typeof v === 'string' ? v : `\`${JSON.stringify(v)}\``]),
    ...(member.installedTo ? [['installed-to', renderInstalled(member)]] : []),
    ...(member.example ? [['example', `\`${member.example}\``]] : []),
  ];
  const body = ['| Field | Value |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join('\n');
  return `${beginMarker(section, GENERATOR)}\n${body}\n${endMarker(section)}\n`;
}

/** Validate a family doc against its draft-07 schema (arm B contract, in-process backstop). */
async function validateDoc(root, id, doc) {
  const schemaPath = join(root, REFERENCE_DIR, SCHEMA_SUBDIR, `${id}.schema.json`);
  if (!existsSync(schemaPath)) fail(`${REFERENCE_DIR}/${SCHEMA_SUBDIR}/${id}.schema.json: missing schema — every family validates against its draft-07 schema (G8)`);
  const { Ajv } = await import('ajv');
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));
  if (!validate(doc)) {
    fail(`${REFERENCE_DIR}/${id}.json failed ${SCHEMA_SUBDIR}/${id}.schema.json: ${JSON.stringify(validate.errors, null, 2)}`);
  }
}

async function assertKindPins(root) {
  const registry = join(root, KIND_REGISTRY);
  if (!existsSync(registry)) {
    log(`kind-pin assertion deferred — ${KIND_REGISTRY} (D30's page-kinds registry) does not exist yet (S0q); pins: ${JSON.stringify(KIND_PINS)}`);
    return;
  }
  const reg = readFileSync(registry, 'utf8');
  for (const [fenceType, slug] of Object.entries(KIND_PINS)) {
    if (!new RegExp(`(^|\\W)${escapeRe(slug)}(\\W|$)`).test(reg)) {
      fail(`${KIND_REGISTRY}: the ${fenceType} fence is pinned to kind slug \`${slug}\`, which the registry does not list — update KIND_PINS in ${GENERATOR} (a stale pin is named, never guessed around)`);
    }
  }
}

function findRoot(start) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, 'setup.d'))) return d;
    const up = dirname(d);
    if (up === d) throw new Error('setup.d not found (walked to filesystem root). Pass --root <dir>.');
    d = up;
  }
}

// ---------------------------------------------------------------------------
// modes
// ---------------------------------------------------------------------------

function censusMode(root) {
  const wired = wiredSet(root);
  const scripts = listScripts(root);
  const cards = scripts.filter((s) => wired.has(s.name) && !s.testMaterial);
  const unwired = scripts.filter((s) => !wired.has(s.name) && !s.testMaterial);
  const testMaterial = scripts.filter((s) => s.testMaterial);
  console.log(`== census (F.3 wiring) over scripts/ — population ${scripts.length}, cards ${cards.length}, unwired ${unwired.length}, test material ${testMaterial.length}`);
  console.log(`-- cards (${cards.length}) — one evidence line per member:`);
  for (const s of cards) {
    const ev = wired.get(s.name).map((e) => (e.via === 'fingerprint' ? `shipped-by-path (${e.file})` : `${e.file}:${e.line} (${e.shape}${e.via === 'closure' ? ', closure' : ''})`)).join('; ');
    console.log(`  ${s.name}\n    via ${ev}`);
  }
  console.log(`-- unwired (${unwired.length}) — no execution-shaped reference on a non-comment line of any wiring surface:`);
  console.log(unwired.length ? unwired.map((s) => `  ${s.name}`).join('\n') : '  (none)');
  console.log(`-- test material (${testMaterial.length}) — in the population as a gate, never a card:`);
  console.log(testMaterial.length ? testMaterial.map((s) => `  ${s.name}`).join('\n') : '  (none)');
  console.log('-- per-family build (absence-by-omission = a hole; D36):');
  for (const f of FAMILIES) {
    try {
      const members = buildFamily(root, f.id);
      console.log(`  ${f.id} ${FAMILY_NAME.get(f.id)}: OK (${members.length} members)`);
    } catch (e) {
      console.log(`  ${f.id} ${FAMILY_NAME.get(f.id)}: HOLES — ${e.message}`);
    }
  }
  console.log('-- absence tokens (G18, counted over all buildable families):');
  const counts = {};
  for (const f of FAMILIES) {
    try {
      const walk = (v) => {
        if (Array.isArray(v)) return v.forEach(walk);
        if (v && typeof v === 'object') {
          if (typeof v.absent === 'string') counts[v.absent] = (counts[v.absent] ?? 0) + 1;
          for (const x of Object.values(v)) walk(x);
        }
      };
      walk(buildFamily(root, f.id));
    } catch { /* holes reported above */ }
  }
  for (const r of ABSENCE_REASONS) console.log(`  ${r}: ${counts[r] ?? 0}`);
  return 0;
}

async function writeMode(root) {
  await assertKindPins(root);
  const families = buildAllFamilies(root);
  for (const f of FAMILIES) {
    const doc = familyDoc(f.id, families[f.id]);
    await validateDoc(root, f.id, doc);
    const outPath = join(root, REFERENCE_DIR, `${f.id}.json`);
    writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
    log(`wrote ${REFERENCE_DIR}/${f.id}.json (${doc.members.length} members)`);
  }
  // fences: only into pages that already exist (TD2-6 — the generator never creates a page)
  let fences = 0;
  for (const f of FAMILIES) {
    const page = join(root, REFERENCE_DIR, `${f.id}.md`);
    if (!existsSync(page)) continue;
    const section = `${f.id}-table`;
    const body = overviewTable(f.id, families[f.id]);
    writeFileSync(page, injectRegion(readFileSync(page, 'utf8'), section, GENERATOR, body));
    fences++;
  }
  // family A's overview page is setup.d/LAYERS.md (§5 #2 — the layer table is a fence target)
  const layers = join(root, 'setup.d/LAYERS.md');
  if (existsSync(layers)) {
    const section = 'A-table';
    const body = overviewTable('A', families.A);
    writeFileSync(layers, injectRegion(readFileSync(layers, 'utf8'), section, GENERATOR, body));
    fences++;
  }
  console.log(`render-reference: wrote ${FAMILIES.length} family JSONs + filled ${fences} fence(s)`);
  return 0;
}

async function checkMode(root) {
  await assertKindPins(root);
  const families = buildAllFamilies(root);
  const drift = [];
  for (const f of FAMILIES) {
    const doc = familyDoc(f.id, families[f.id]);
    await validateDoc(root, f.id, doc);
    const outPath = join(root, REFERENCE_DIR, `${f.id}.json`);
    if (!existsSync(outPath)) { drift.push(`${REFERENCE_DIR}/${f.id}.json missing (run --write)`); continue; }
    const expected = `${JSON.stringify(doc, null, 2)}\n`;
    if (readFileSync(outPath, 'utf8') !== expected) drift.push(`${REFERENCE_DIR}/${f.id}.json drifted from the sources`);
    const page = join(root, REFERENCE_DIR, `${f.id}.md`);
    if (existsSync(page) && !regionsMatch(readFileSync(page, 'utf8'), new Map([[`${f.id}-table`, overviewTable(f.id, families[f.id])]]))) {
      drift.push(`${REFERENCE_DIR}/${f.id}.md: fence \`${f.id}-table\` drifted`);
    }
  }
  const layers = join(root, 'setup.d/LAYERS.md');
  if (existsSync(layers) && !regionsMatch(readFileSync(layers, 'utf8'), new Map([['A-table', overviewTable('A', families.A)]]))) {
    drift.push('setup.d/LAYERS.md: fence `A-table` drifted');
  }
  if (drift.length) {
    console.error(`✗ reference drift:\n${drift.map((d) => `    - ${d}`).join('\n')}`);
    console.error('  Fix: npx tsx scripts/render-reference.mjs --write');
    return 1;
  }
  console.log(`✓ reference up-to-date (${FAMILIES.length} family JSONs + fences)`);
  return 0;
}

export async function run(argv) {
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag !== -1 ? resolve(argv[rootFlag + 1]) : findRoot(process.cwd());
  if (argv.includes('--census')) return censusMode(root);
  if (argv.includes('--write')) return writeMode(root);
  if (argv.includes('--check')) return checkMode(root);
  console.error(`usage: render-reference.mjs (--write | --check | --census) [--root <dir>]`);
  return 2;
}

function isMainEntry() {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
}
if (isMainEntry()) run(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`✗ ${e.message}`); process.exit(1); });
