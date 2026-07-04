#!/usr/bin/env node
/**
 * render-rule-index — deterministic rule-index digest for CTX Stage 1 (Tier-0 context budget).
 *
 * WHY: the always-on rule context (`.claude/rules/*.md`, auto-loaded by CC every session) grows
 * linearly with rule count. CTX Stage 0/1 shrink this WITHOUT losing enforcement — every rule
 * still fails at its earliest reachable channel (Class A/B gate, or the Tier-0 core rules for
 * Class C via ai-laziness T20) — by replacing the full always-on rule bodies with (a) 3 Tier-0
 * core rules that stay always-on, and (b) a ONE-LINE-PER-RULE index (this renderer's output)
 * that tells the model WHERE to find the rest and WHEN it would have fired. Full rule text is
 * still reachable — via `paths:`/globs edit-time injection, skill-embeds, or a manual read of
 * `.claude/rules/<name>.md` — it is simply no longer always resident in context.
 *
 * SOURCE OF TRUTH: each rule's own `> **Class:**` + `> **Fires:**` header lines (Increment 1),
 * plus `paths:` frontmatter / `<!-- globs: -->` / `<!-- channel: ... -->` markers already in the
 * rule body. This script does NOT invent facts — it extracts and renders what each rule already
 * declares about itself (T-CTX-D: sourced from rule text, never from memory/recall).
 *
 * Two render targets from ONE source (single canonical block, rendered twice):
 *   (a) .claude/rules/00-rule-index.md   — a small standalone digest file
 *   (b) AGENTS.md `rule-index` fenced region (packages/core/composition/fence.ts) — replaces the
 *       previously hand-maintained "## Rules" table.
 *
 * Modes: `--write` (emit both) | `--check` (drift + validity, exit 1 on any failure).
 * `--root <dir>` overrides the search root (default: walk up from cwd, like render-harness-config).
 * Run via `tsx` (imports packages/core/composition/fence.ts — a .ts module, so plain
 * `node` cannot load it on Node <22.6). Precedent: scripts/render-harness-config.mjs --write/--check.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRegions, injectRegion, regionsMatch } from '../packages/core/composition/fence.ts';

const RULE_INDEX_SECTION_ID = 'rule-index';
// This renderer is its own "plan" — there is no DocPlan JSON backing the rule index; the fence
// marker's `plan=` attribute records the generating script instead (self-descriptive, T15).
const RULE_INDEX_PLAN_PATH = 'scripts/render-rule-index.mjs';

const INDEX_MAX_BYTES = 3 * 1024; // 3KB size ceiling asserted by --check (ii)

// Tier-0 core rules: never evicted, always-on regardless of paths:/globs — declared here as the
// project's own current decision (P4 resolution), not derived from any rule's own markers.
const TIER0_CORE = new Set([
  'build-first-reuse-default',
  'attention-is-not-a-mechanism',
  'ai-laziness-traps',
]);

// Subset grammar mirrors inject-matching-rule.sh:44-51 glob_match: `prefix/**` (prefix may
// contain slashes, e.g. ".github/workflows/**"), `*.ext` (suffix match), or an exact path —
// each alternative is anchored so a pattern must be wholly one shape, never a mix.
const GLOB_SUBSET_RE = /^(?:[^*]+\/\*\*|\*\.[^*/]+|[^*]+)$/; // prefix/** | *.ext | exact

function findRoot(start) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, '.claude/rules'))) return d;
    const up = dirname(d);
    if (up === d) throw new Error('.claude/rules not found (walked to filesystem root). Pass --root <dir>.');
    d = up;
  }
}

function listRuleFiles(root) {
  const dir = join(root, '.claude/rules');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== '00-rule-index.md')
    .sort()
    .map((f) => join(dir, f));
}

/** Extract the first `> **Key:** value` line's value (may span the rest of that single line). */
function extractHeaderField(source, key) {
  const re = new RegExp(`^>\\s*\\*\\*${key}:\\*\\*\\s*(.+)$`, 'm');
  const m = source.match(re);
  return m ? m[1].trim() : null;
}

/** Parse YAML frontmatter `paths:` list (simple `- "..."` / `- '...'` / `- ...` lines only). */
function extractFrontmatterPaths(source) {
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const pathsMatch = fm.match(/^paths:\n((?:\s*-\s*.+\n?)+)/m);
  if (!pathsMatch) return null;
  return pathsMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.replace(/^-\s*/, '').replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
}

/** Parse the `<!-- globs: a, b, c -->` marker (comma-separated glob subset). */
function extractGlobsMarker(source) {
  const m = source.match(/^[ \t]*<!--[ \t]*globs:(.*?)-->/m);
  if (!m) return null;
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse ALL `<!-- channel: <mechanism> <artifact>#<anchor> -->` markers (a rule may carry several). */
function extractChannelMarkers(source) {
  const out = [];
  const re = /^[ \t]*<!--[ \t]*channel:(.*?)-->/gm;
  let m;
  while ((m = re.exec(source)) !== null) {
    const val = m[1].trim();
    if (val) out.push(val);
  }
  return out;
}

/** One glob-subset token check: prefix/** | *.ext | exact (mirrors inject-matching-rule.sh:19-20). */
function isSubsetGlob(pattern) {
  return GLOB_SUBSET_RE.test(pattern);
}

/** Parse `<!-- glob-liveness: allow <pattern> <reason> -->` escape-hatch markers (mirrors the
 *  ci-tool-pinning.md §3 `# ci-tool-pin: allow <reason>` idiom): a rule author declares — inline,
 *  visibly, with a reason — that a specific paths:/globs: pattern is intentionally forward-scoped
 *  (e.g. a directory that will hold files once a feature ships) and should not fail the liveness
 *  check today. Keyed by the exact pattern string so the exemption is scoped, not blanket. */
function extractLivenessExemptions(source) {
  const out = new Set();
  const re = /^[ \t]*<!--[ \t]*glob-liveness:[ \t]*allow[ \t]+(\S+)(?:[ \t]+.*)?-->/gm;
  let m;
  while ((m = re.exec(source)) !== null) out.add(m[1]);
  return out;
}

/** An exact-path pattern that is deliberately gitignored (a per-consumer scaffold file this repo
 *  never creates, e.g. `.ai-factory/research-allowlist.json` per .gitignore:42) is not "dead" in
 *  the typo/broken-reference sense — it is a legitimate target that will only exist post-install.
 *  Detected via `git check-ignore` (deterministic, no hardcoded allowlist) rather than assumed. */
function isDeliberatelyGitignoredExact(root, pattern) {
  if (pattern.includes('*')) return false; // only applies to exact-path patterns
  try {
    execFileSync('git', ['check-ignore', '-q', pattern], { cwd: root });
    return true; // exit 0 = ignored
  } catch (e) {
    return false; // exit 1 = not ignored, or git unavailable
  }
}

/** Does `pattern` (prefix/** | *.ext | exact) match at least one tracked file? */
function globHasLiveMatch(root, pattern) {
  let tracked;
  try {
    tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return true; // no git available — cannot assert liveness; do not false-fail
  }
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -2); // keep trailing '/'
    return tracked.some((f) => f.startsWith(prefix));
  }
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1);
    return tracked.some((f) => f.endsWith(ext));
  }
  if (tracked.includes(pattern)) return true;
  return isDeliberatelyGitignoredExact(root, pattern);
}

/** Derive the rule's rendered channel string(s) for the index line. */
function deriveChannels(name, fields) {
  const chans = [];
  if (TIER0_CORE.has(name)) chans.push('always-on core');
  if (fields.paths) chans.push(`paths:(${fields.paths.length})`);
  if (fields.globsMarker) chans.push('edit-time inject');
  for (const c of fields.channelMarkers) {
    const mech = c.split(/\s+/)[0];
    chans.push(mech);
  }
  if (chans.length === 0) chans.push('gate-only');
  return chans.join(', ');
}

/** Parse one rule file into the row shape the index needs. Throws with a readable message on
 *  missing required fields (Class / Fires) so --check fails loudly rather than rendering "undefined". */
function parseRule(path, root) {
  const source = readFileSync(path, 'utf8');
  const name = path.split('/').pop().replace(/\.md$/, '');
  const classField = extractHeaderField(source, 'Class');
  const fires = extractHeaderField(source, 'Fires');
  if (!classField) throw new Error(`${relative(root, path)}: missing "> **Class:**" header line`);
  if (!fires) throw new Error(`${relative(root, path)}: missing "> **Fires:**" header line`);
  const classLetter = (classField.match(/^([ABC])\b/) || [])[1] ?? '?';

  const paths = extractFrontmatterPaths(source);
  const globsMarker = extractGlobsMarker(source);
  const channelMarkers = extractChannelMarkers(source);
  const livenessExemptions = extractLivenessExemptions(source);

  return { name, path, source, classField, classLetter, fires, paths, globsMarker, channelMarkers, livenessExemptions };
}

/** §(iii) cross-check: paths: vs <!-- globs: --> must be SET-EQUAL, subset-grammar, and LIVE
 *  (unless a per-pattern `<!-- glob-liveness: allow <pattern> <reason> -->` escape hatch is present). */
function checkPathsGlobsParity(rule, root) {
  const errs = [];
  if (!rule.paths || !rule.globsMarker) return errs; // only applies when BOTH present
  const a = new Set(rule.paths);
  const b = new Set(rule.globsMarker);
  if (a.size !== b.size || [...a].some((p) => !b.has(p))) {
    errs.push(
      `${rule.name}.md: paths: [${rule.paths.join(', ')}] != globs: [${rule.globsMarker.join(', ')}] — the two glob sets must be identical (rule-enforcement-channel-selection.md §4 dual-pair invariant)`,
    );
  }
  for (const pat of new Set([...rule.paths, ...rule.globsMarker])) {
    if (!isSubsetGlob(pat)) {
      errs.push(`${rule.name}.md: pattern "${pat}" is not in the supported subset (prefix/**, *.ext, or exact)`);
      continue;
    }
    if (!globHasLiveMatch(root, pat) && !rule.livenessExemptions.has(pat)) {
      errs.push(`${rule.name}.md: pattern "${pat}" matches NO tracked file (dead glob) — add <!-- glob-liveness: allow ${pat} <reason> --> if intentionally forward-scoped`);
    }
  }
  return errs;
}

function renderIndexBlock(rows) {
  const lines = [
    'One line per rule — full text: read `.claude/rules/<name>.md` (index: `.claude/rules/00-rule-index.md`).',
    '',
    '| Rule | Class | Fires | Channel(s) |',
    '|---|---|---|---|',
  ];
  for (const r of rows) {
    // The filename (with .md) must appear verbatim so off-CC portability probes
    // (tests/agnosticism/probes/rules-autoload.sh) that grep AGENTS.md for each
    // `.claude/rules/*.md` basename still find it here.
    lines.push(`| \`${r.name}.md\` | ${r.classLetter} | ${r.fires} | ${r.channels} |`);
  }
  return lines.join('\n');
}

function buildRows(root) {
  const files = listRuleFiles(root);
  const rules = files.map((f) => parseRule(f, root));
  const parityErrors = rules.flatMap((r) => checkPathsGlobsParity(r, root));
  const rows = rules.map((r) => ({
    name: r.name,
    classLetter: r.classLetter,
    fires: r.fires,
    channels: deriveChannels(r.name, r),
  }));
  return { rows, parityErrors, rules };
}

function renderIndexFileContent(block) {
  return `# Rule index — generated, do not hand-edit

> **Authoritative for:** rendered rule digest. Regen: \`npx tsx scripts/render-rule-index.mjs --write\`.
> **NOT authoritative for:** project goal — see [README.md](../../README.md#why-this-exists). Full rule text — read \`.claude/rules/<name>.md\`.

${block}
`;
}

function run(argv) {
  const mode = argv.includes('--check') ? 'check' : argv.includes('--write') ? 'write' : null;
  if (!mode) { console.error('usage: render-rule-index.mjs (--write | --check) [--root <dir>]'); return 2; }
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag !== -1 ? resolve(argv[rootFlag + 1]) : findRoot(process.cwd());

  let rows, parityErrors;
  try {
    ({ rows, parityErrors } = buildRows(root));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }

  const block = renderIndexBlock(rows);
  const indexPath = join(root, '.claude/rules/00-rule-index.md');
  const indexContent = renderIndexFileContent(block);

  const agentsPath = join(root, 'AGENTS.md');
  const agentsSource = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : '';

  const drift = [...parityErrors];

  // (i) size ceiling
  if (Buffer.byteLength(indexContent, 'utf8') > INDEX_MAX_BYTES) {
    drift.push(`00-rule-index.md: ${Buffer.byteLength(indexContent, 'utf8')} bytes > ${INDEX_MAX_BYTES} byte ceiling`);
  }

  if (mode === 'write') {
    writeFileSync(indexPath, indexContent);
    const newAgents = injectRegion(agentsSource, RULE_INDEX_SECTION_ID, RULE_INDEX_PLAN_PATH, block);
    writeFileSync(agentsPath, newAgents);
    if (parityErrors.length) {
      console.error('⚠ --write completed but paths:/globs: parity issues remain:\n' + parityErrors.map((e) => `    - ${e}`).join('\n'));
    }
    console.log('render-rule-index: wrote .claude/rules/00-rule-index.md + AGENTS.md rule-index region');
    return 0;
  }

  // --check
  if (existsSync(indexPath)) {
    if (readFileSync(indexPath, 'utf8') !== indexContent) {
      drift.push('.claude/rules/00-rule-index.md: drift vs rendered rule metadata');
    }
  } else {
    drift.push('.claude/rules/00-rule-index.md: missing (run --write)');
  }

  if (!regionsMatch(agentsSource, new Map([[RULE_INDEX_SECTION_ID, block]]))) {
    drift.push('AGENTS.md: rule-index region drift vs rendered rule metadata');
  }

  if (drift.length) {
    console.error('✗ rule-index drift:\n' + drift.map((d) => `    - ${d}`).join('\n'));
    console.error('  Fix: npx tsx scripts/render-rule-index.mjs --write');
    return 1;
  }
  console.log('✓ rule-index up-to-date (00-rule-index.md + AGENTS.md region)');
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

export { buildRows, renderIndexBlock, renderIndexFileContent, RULE_INDEX_SECTION_ID, RULE_INDEX_PLAN_PATH };
