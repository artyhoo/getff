#!/usr/bin/env node
/**
 * render-face-facts — deterministic face-facts manifest for the getff.ai landing pin (D42).
 *
 * WHY: the landing site consumes framework facts as pinned data — `docs/site/face-facts.json`
 * is the ONLY carrier of maturity (D32) and the other §7 fact families across the conveyor
 * boundary (the pin sparse-checkouts `docs/site/` only, D31 R12 / D34). Every value here is
 * DERIVED from the same source the runtime executes, never asserted — "derived, not asserted"
 * (render-install-roster.mjs posture; §7: "One generator ... reads the SAME sources the
 * runtime executes").
 *
 * SOURCES (face-pages spec §7 family table — read, never restated):
 *   maturity             packages/core/manifest/maturity.json — rows copied VERBATIM (D42:
 *                        "copies the maturity rows into docs/site/face-facts.json").
 *   installCommands      the `STACK="$a"` case alternations in `setup` + `install.sh`
 *                        LANE_TABLE + the flags list under README.md's "`./setup` ... Flags:".
 *                        stacks = case alternations MINUS LANE_TABLE lanes (no ordering
 *                        assumption); lanes carry their detect file from LANE_TABLE.
 *   firstSteps           packages/core/templates/shared/first-steps.source.json — sequences
 *                        + renders copied verbatim (the SSOT whose renders are parity-gated).
 *   rosters              docs/site/reference/<family>.json — READ, never re-derived (§7):
 *                        per-family familyName + member count.
 *   counts               predicates declared HERE, never typed numbers (§7): principle test
 *                        files, prior-art entry-table rows, research patches, design specs,
 *                        unique doi.org/arxiv.org URLs under docs/ + skills/getff/references/.
 *                        CLAIMS-LEDGER.md counts are landing-side (the file is not in this
 *                        repo) — the landing build merges its own counts.
 *   enforcementOutcomes  packages/core/composition/demo/root-agents-demo.ts
 *                        buildDemoRenderFacts() — the LIVE per-node × per-backend RenderOutcomes
 *                        behind AGENTS.md's two demo regions, serialized as `rendered` | FF code.
 *   npm                  absent until the getff package publishes ≥ 0.1.0 (§7: "absent until
 *                        then"); the offline predicate reads packages/core/package.json
 *                        (private → absent; version < 0.1.0 → absent) — no network.
 *
 * LANDING-SIDE, deliberately absent here (D42 falsifier (b): a value the framework cannot
 * compute is a landing-side stamp, not a face fact): `verified-at: <pinned sha>`, resolved
 * permalinks, `url` — the landing build stamps them onto the fetched JSON at build time
 * (D34: a pre-commit renderer cannot know the SHA of the commit it is creating). This file
 * carries only path:line provenance, never permalinks.
 *
 * RENDER TARGET: docs/site/face-facts.json (D42 — home beside docs/site/reference/; NOT
 * packages/core/manifest/, which ships in npm and is outside the pin). Fence-region checking
 * (FS1's page arm) activates at S1 when the face pages land (D24b byte-identity seam);
 * today the check is the manifest's own byte-identity — the pages do not exist yet.
 *
 * Channels (D42): author-run `--write` (output committed by hand — NO pre-commit wiring:
 * `.husky/pre-commit` invokes neither generator; corrected 2026-09-15, review gate), pre-push +
 * audit-self.yml `--check`, `scripts/render-face-facts.test.sh` acceptance arms, the
 * run-local-ci-sweep `face-facts-check` row. The landing build runs NO framework script (D35/D42).
 *
 * Modes: `--write` (emit) | `--check` (drift, exit 1 naming the file) | `--root <dir>` for
 * fixture runs. Absence of a declared source is a build failure naming the file (D36:
 * absence-by-omission), never an empty cell.
 * Run via `tsx` (imports a .ts module). Precedent: scripts/render-reference.mjs;
 * scripts/render-install-roster.mjs.
 *
 * Logging: [render-face-facts] stderr traces per family derived and the gate verdict.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoRenderFacts } from '../packages/core/composition/demo/root-agents-demo.ts';

const TARGET_REL = 'docs/site/face-facts.json';
const SCHEMA_ID = 'getff.face-facts/v1';

const log = (...m) => console.error('[render-face-facts]', ...m);

function findRoot(start) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, 'setup.d'))) return d;
    const up = dirname(d);
    if (up === d) throw new Error('setup.d not found (walked to filesystem root). Pass --root <dir>.');
    d = up;
  }
}

/** Fail-closed source read: a missing declared source is absence-by-omission (D36). */
function readSource(root, rel, what) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    throw new Error(
      `source missing: ${rel} (${what}) — absence-by-omission, D36: a declared source that ` +
        `does not exist is a build failure naming the file, never an empty cell`,
    );
  }
  return readFileSync(p, 'utf8');
}

/** First 1-based line number in `body` matching `re`, or throws (the anchor must exist). */
function lineOf(body, re, rel) {
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i + 1;
  }
  throw new Error(`no line in ${rel} matches ${re} — the provenance anchor is gone; fix the parser`);
}

// ── maturity: rows copied VERBATIM (D42) ────────────────────────────────────────────────────
function deriveMaturity(root) {
  const rel = 'packages/core/manifest/maturity.json';
  const raw = JSON.parse(readSource(root, rel, 'D32 maturity manifest'));
  log('maturity: copied verbatim from', rel);
  return { source: rel, layers: raw.layers, stacks: raw.stacks };
}

// ── install commands: setup case alternations + install.sh LANE_TABLE + README flags ────────
function deriveInstallCommands(root) {
  const setupRel = 'setup';
  const installRel = 'install.sh';
  const readmeRel = 'README.md';
  const setup = readSource(root, setupRel, 'the setup wrapper (positional case arms)');
  const installSh = readSource(root, installRel, 'the installer (LANE_TABLE)');
  const readme = readSource(root, readmeRel, 'the flags list');

  const caseRe = /^\s*([a-z][a-z|-]+)\) STACK="\$a"/;
  const positionals = new Set();
  for (const line of setup.split('\n')) {
    const m = line.match(caseRe);
    if (m) for (const p of m[1].split('|')) positionals.add(p);
  }
  if (positionals.size === 0) {
    throw new Error(`no \`STACK="$a"\` case alternations parsed from ${setupRel} — parser or file drifted`);
  }

  const ltStart = installSh.indexOf("LANE_TABLE='");
  if (ltStart === -1) throw new Error(`LANE_TABLE not found in ${installSh} — parser or file drifted`);
  const ltBody = installSh.slice(ltStart + "LANE_TABLE='".length);
  const ltEnd = ltBody.indexOf("'");
  if (ltEnd === -1) throw new Error(`LANE_TABLE unterminated in ${installSh}`);
  const lanes = [];
  for (const row of ltBody.slice(0, ltEnd).split('\n')) {
    if (!row.trim()) continue;
    const [lane, label, detect] = row.split('|');
    lanes.push({ lane, label, detect });
  }
  if (lanes.length === 0) throw new Error(`no lanes parsed from LANE_TABLE in ${installSh}`);

  // stacks = the case alternations MINUS the lane set — derived from two sources, no ordering
  // assumption about which case arm is which.
  const laneSet = new Set(lanes.map((l) => l.lane));
  const stacks = [...positionals].filter((p) => !laneSet.has(p));
  if (stacks.length === 0) throw new Error(`zero npm stacks after subtracting lanes in ${setupRel}`);

  const flags = [];
  const readmeLines = readme.split('\n');
  const flagsLine = lineOf(readme, /Flags:\s*$/, readmeRel);
  for (let i = flagsLine; i < readmeLines.length; i++) {
    const m = readmeLines[i].match(/^- `(--[a-z-]+)`/);
    if (m) flags.push({ flag: m[1], line: i + 1 });
    else if (readmeLines[i].trim() !== '' && flags.length > 0) break;
  }
  if (flags.length === 0) throw new Error(`no flag bullets under the Flags: line in ${readmeRel}`);

  log(`installCommands: ${stacks.length} stacks, ${lanes.length} lanes, ${flags.length} README flags`);
  return {
    source: {
      positionals: `${setupRel}:${lineOf(setup, caseRe, setupRel)}`,
      laneTable: `${installRel}:${lineOf(installSh, /LANE_TABLE='/, installRel)}`,
      flags: `${readmeRel}:${flagsLine}`,
    },
    stacks,
    lanes,
    flags,
  };
}

// ── first steps: sequences + renders copied verbatim (the SSOT whose renders are gated) ─────
function deriveFirstSteps(root) {
  const rel = 'packages/core/templates/shared/first-steps.source.json';
  const raw = JSON.parse(readSource(root, rel, 'the first-steps SSOT'));
  log('firstSteps: sequences + renders copied verbatim from', rel);
  return { source: rel, renders: raw.renders, sequences: raw.sequences };
}

// ── rosters: the D29 family JSON, READ, never re-derived (§7) ───────────────────────────────
function deriveRosters(root) {
  const dirRel = 'docs/site/reference';
  const dir = join(root, dirRel);
  if (!existsSync(dir)) {
    throw new Error(`source missing: ${dirRel}/ — absence-by-omission, D36 (the D29 family JSON)`);
  }
  const collator = new Intl.Collator('en', { numeric: true });
  const files = readdirSync(dir).filter((f) => /^[A-Z][0-9]*\.json$/.test(f)).sort(collator.compare);
  const families = {};
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    families[raw.family] = { familyName: raw.familyName, path: `${dirRel}/${f}`, members: raw.members.length };
  }
  if (Object.keys(families).length === 0) {
    throw new Error(`no family JSON in ${dirRel}/ — absence-by-omission, D36`);
  }
  log(`rosters: ${Object.keys(families).length} families read (never re-derived)`);
  return { source: `${dirRel}/`, families };
}

// ── counts: predicates declared here, never typed numbers (§7) ──────────────────────────────
function countByPredicate(root, dirRel, re, recursive) {
  const walk = (abs) => {
    const out = [];
    for (const e of readdirSync(abs)) {
      const p = join(abs, e);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (recursive && e !== 'node_modules' && e !== '.git') out.push(...walk(p));
      } else if (re.test(e)) out.push(p);
    }
    return out;
  };
  return walk(join(root, dirRel)).length;
}

function deriveCounts(root) {
  const priorRel = 'docs/meta-factory/prior-art-evaluations.md';
  const prior = readSource(root, priorRel, 'the prior-art SSOT register');
  const priorArtRows = prior.split('\n').filter((l) => /^\| \d+ \| /.test(l)).length;

  const urlRe = /https?:\/\/(?:www\.)?(?:doi\.org|arxiv\.org)\/[^ \t\r\n)"'>`]+/g;
  const urls = new Set();
  const scanUrls = (abs) => {
    for (const e of readdirSync(abs)) {
      const p = join(abs, e);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (e !== 'node_modules' && e !== '.git') scanUrls(p);
      } else {
        for (const m of readFileSync(p, 'utf8').matchAll(urlRe)) urls.add(m[0]);
      }
    }
  };
  scanUrls(join(root, 'docs'));
  scanUrls(join(root, 'skills/getff/references'));

  const counts = {
    principles: {
      source: 'packages/core/principles/',
      predicate: 'files matching /\\.test\\.ts$/',
      count: countByPredicate(root, 'packages/core/principles', /\.test\.ts$/, false),
    },
    priorArtRows: {
      source: priorRel,
      predicate: 'entry-table rows matching /^\\| \\d+ \\| /',
      count: priorArtRows,
    },
    researchPatches: {
      source: 'docs/meta-factory/research-patches/',
      predicate: 'files matching /^2026-.*\\.md$/',
      count: countByPredicate(root, 'docs/meta-factory/research-patches', /^2026-.*\.md$/, false),
    },
    specs: {
      source: 'docs/superpowers/specs/',
      predicate: 'files matching /^2026-.*\\.md$/',
      count: countByPredicate(root, 'docs/superpowers/specs', /^2026-.*\.md$/, false),
    },
    academicSources: {
      source: ['docs/', 'skills/getff/references/'],
      predicate: 'unique http(s) URLs on doi.org or arxiv.org',
      count: urls.size,
    },
  };
  log(`counts: principles=${counts.principles.count} priorArtRows=${counts.priorArtRows.count} ` +
      `patches=${counts.researchPatches.count} specs=${counts.specs.count} academic=${counts.academicSources.count}`);
  return counts;
}

// ── enforcement outcomes: the live demo RenderOutcomes (never restated) ─────────────────────
function deriveEnforcementOutcomes() {
  const { nodes, outcomesByBackend } = buildDemoRenderFacts();
  const out = {};
  for (const n of nodes) {
    const perBackend = {};
    for (const [backend, om] of outcomesByBackend) {
      const o = om.get(n.id);
      if (!o) throw new Error(`no RenderOutcome for node ${n.id} on backend ${backend}`);
      perBackend[backend] = o.kind === 'rendered' ? 'rendered' : o.code;
    }
    out[n.id] = perBackend;
  }
  log(`enforcementOutcomes: ${nodes.length} demo nodes × ${outcomesByBackend.size} backends (live facts)`);
  return {
    source: [
      'AGENTS.md:78',
      'AGENTS.md:98',
      'packages/core/composition/demo/root-agents-demo.ts:133',
    ],
    nodes: out,
  };
}

// ── npm: absent until published ≥ 0.1.0 (§7) — offline predicate over the package manifest ──
function deriveNpm(root) {
  const rel = 'packages/core/package.json';
  if (!existsSync(join(root, rel))) return undefined; // no package manifest → no npm family
  const pkg = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (pkg.private === true) return undefined;
  const [maj, min] = String(pkg.version ?? '0.0.0').split('.').map((x) => parseInt(x, 10) || 0);
  if (maj === 0 && min < 1) return undefined; // < 0.1.0
  log(`npm: published ${pkg.version}`);
  return { source: rel, version: pkg.version };
}

// ── assembly ────────────────────────────────────────────────────────────────────────────────
const NOTE = [
  'Derived, not asserted — `scripts/render-face-facts.mjs --write`; `--check` fails on any hand',
  'edit (umbrella D42; face-pages spec §7, seams FS1/FS2). Sources per family are cited in each',
  "family's `source` as path:line — never permalinks (D34: a pre-commit renderer cannot know the",
  'SHA of the commit it is creating).',
  'The landing build consumes this file as pinned data and stamps `url`, `verified-at: <pinned',
  'framework sha>` and resolved permalinks at build time (D42 falsifier (b): a URL-dependent',
  'value is a landing-side stamp, not a face fact). The landing runs no framework script (D35).',
  'Fence-region checking on the face pages (FS1 page arm) activates at S1 when the pages land',
  '(D24b byte-identity seam); today the check is this manifest\'s own byte-identity.',
  'Counts: CLAIMS-LEDGER.md counts are landing-side (the file is not in this repo). npm section:',
  'absent until the package publishes ≥ 0.1.0 (§7 "absent until then").',
];

function deriveFaceFacts(root) {
  const facts = { schema: SCHEMA_ID, _note: NOTE };
  facts.maturity = deriveMaturity(root);
  facts.installCommands = deriveInstallCommands(root);
  facts.firstSteps = deriveFirstSteps(root);
  facts.rosters = deriveRosters(root);
  facts.counts = deriveCounts(root);
  facts.enforcementOutcomes = deriveEnforcementOutcomes();
  const npm = deriveNpm(root);
  if (npm !== undefined) facts.npm = npm;
  return JSON.stringify(facts, null, 2) + '\n';
}

function main() {
  const argv = process.argv.slice(2);
  let root = process.cwd();
  let mode = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--write') mode = 'write';
    else if (argv[i] === '--check') mode = 'check';
    else if (argv[i] === '--root') root = resolve(argv[++i]);
    else {
      console.error(`usage: render-face-facts.mjs --write | --check [--root <dir>]`);
      process.exit(2);
    }
  }
  if (!mode) {
    console.error('usage: render-face-facts.mjs --write | --check [--root <dir>]');
    process.exit(2);
  }

  const derived = deriveFaceFacts(root);
  const target = join(root, TARGET_REL);
  if (mode === 'write') {
    writeFileSync(target, derived);
    log(`wrote ${TARGET_REL} (${derived.split('\n').length} lines)`);
    return;
  }
  if (!existsSync(target)) {
    console.error(`❌ ${TARGET_REL} is missing — run scripts/render-face-facts.mjs --write (D42)`);
    process.exit(1);
  }
  if (readFileSync(target, 'utf8') !== derived) {
    console.error(
      `❌ ${TARGET_REL} differs from the derivation — run scripts/render-face-facts.mjs --write ` +
        `(D42: derived, not asserted)`,
    );
    process.exit(1);
  }
  log(`check: ${TARGET_REL} is byte-identical to the derivation`);
}

main();
