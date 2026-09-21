#!/usr/bin/env node
/**
 * check-docs-refresh — the D26 refresh MERGE GATE (getff-ai-site R13).
 *
 * spec: docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md R13;
 *       docs/superpowers/specs/2026-09-13-getff-ai-site-design.md D26
 *
 * Over an EXPLICIT range (always caller-supplied — the two R13 callers see different ranges
 * by construction: pre-push sees the push range, the audit-self.yml `docs-refresh` job sees
 * `base..HEAD` and therefore MUST run `fetch-depth: 0`, else the range is empty and this gate
 * reports clean on every PR — the #hope-as-gate shape), the script computes
 * `changed files ∩ cited paths` per page frontmatter and FAILS unless every affected page
 * changed in the same range or carries the escape token:
 *
 *     docs-refresh: deferred — <reason ≥20 chars>
 *
 * (escape-token grammar per docs/.claude precedent `ci-tool-pinning.md §3` —
 * `# ci-tool-pin: allow <reason>`; same ≥20-char rationale floor as docs-check's D-Q12).
 * The token renders as the visible stale badge (D8) and lands in a sweep list.
 *
 * Disjointness (R13, umbrella D35): this is the REFRESH gate — «did a cited source move».
 * The FORM gate is scripts/docs-check.mjs — «is the page well-shaped». The two DO NOT import
 * each other and own disjoint checks; this script in particular NEVER re-checks `kind:`
 * (kind registration is the reference-generator's gate — ref-gen.md:201) and NEVER requires
 * `sources:` to exist (a page with no cited paths cannot be affected — docs-check owns
 * sources presence). Only `sources:` and `docs-refresh:` are read, and only from
 * markdown pages under `docs/site` at any depth (.md/.mdx) — the D26 mapping population.
 *
 * Derived-artifact scope-out (rework disposition, 2026-09-21): `docs/site/face-facts.json`
 * and `docs/site/reference/<FAMILY>.json` are machine-regenerated outputs — written ONLY by
 * the renderers' `--write` arms — whose freshness is owned by those renderers' `--check`
 * byte-identity gates (a §7 last act before every commit), NOT by page refresh. A page citing
 * only derived paths has no hand-refreshable content to update, so a derived-path move is
 * not a refresh obligation: it is exempt (reported, never silent). Pages citing a MIX still
 * gate on their hand-written sources. Without this scope-out every SSOT-row addition
 * (prior-art-evaluations.md feeds face-facts.json → every page citing the face-counts fence)
 * re-trips the gate forever — structural churn, not staleness. Disposition recorded in
 * report-s1-build-framework.md (rework round) under the review's three-option menu.
 *
 * Token-only-edit carve-out (same disposition): a page whose ENTIRE diff in the range is
 * `docs-refresh:` frontmatter lines is bookkeeping — seeding or rewording a deferral — not
 * substance. It must not itself create refresh obligations for the pages citing it, so such
 * edits are dropped from the changed set (reported in `tokenOnlyEdits`, never silent). Any
 * other +/- line in the page (title, body, sources) keeps the page fully in the gate — the
 * carve-out is patch-shaped, not path-shaped, so it cannot smuggle a content change through.
 *
 * Deterministic end to end: git plumbing + line parsing, no network, no LLM
 * (no-paid-llm-in-ci.md). Zero dependencies.
 *
 * Usage:
 *   node scripts/check-docs-refresh.mjs <base>..<head>      the gate (exit 1 on failure)
 *   node scripts/check-docs-refresh.mjs <base>..<head> --json   machine output (test arms)
 *   node scripts/check-docs-refresh.mjs <base>..<head> --root <dir>   fixture/sandbox root
 *
 * Exit codes: 0 every affected page refreshed-or-deferred; 1 gate failure (or malformed
 * escape token); 2 usage / git fatal (a crashed gate must never read as clean).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(here, '..');

const PAGES_DIR = 'docs/site';
const PAGES_EXTENSIONS = new Set(['.md', '.mdx']);
/** Escape-token rationale floor (ci-tool-pinning §3 / docs-check D-Q12 precedent). */
const REASON_MIN = 20;
/** D26 falsifier (b): >10 live deferrals means the escape is becoming the default. */
const DEFERRED_WARN_AT = 10;

// ── derived-artifact scope-out (header docblock above documents the disposition) ───────────────

/**
 * Exact derived paths whose freshness is owned by a renderer `--check` byte-identity gate,
 * not by page refresh. Kept EXPLICIT (a Set, not a broader glob) so an unrelated path that
 * merely looks derived never slips out of the gate.
 */
const DERIVED_SOURCES = new Set(['docs/site/face-facts.json']);
/**
 * Reference family JSONs emitted by `scripts/render-reference.mjs --write`
 * (`docs/site/reference/<FAMILY>.json`, FAMILY = uppercase alphanumeric, e.g. `B.json`).
 * Byte-verified by the same renderer's `--check` arm — see `render-reference.mjs checkMode`.
 */
const DERIVED_SOURCE_RE = /^docs\/site\/reference\/[A-Z][0-9A-Z]*\.json$/;

/** True when a cited path is a machine-regenerated artifact exempt from this gate. */
export function isDerivedSource(p) {
  return DERIVED_SOURCES.has(p) || DERIVED_SOURCE_RE.test(p);
}

// ── population + frontmatter (local, deliberately NOT imported from docs-check) ───────────────

function walkPages(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walkPages(abs, out);
    else if (
      entry.isFile() &&
      PAGES_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))
    )
      out.push(abs);
  }
  return out;
}

/** The D26 mapping population of a root, as repo-relative posix paths, sorted. */
export function pagePopulation(root) {
  return walkPages(join(root, PAGES_DIR))
    .map((a) => relative(root, a).split('\\').join('/'))
    .sort();
}

/**
 * Parse ONLY the two keys this gate owns. Returns { sources: string[], docsRefresh: string|null }.
 * Line-based on purpose: `sources:` opens a `  - item` list, `docs-refresh:` is a scalar.
 * Every other key (title, kind, …) is invisible here — never re-checked (ref-gen.md:201).
 */
export function parseRefreshFrontmatter(source) {
  const parsed = { sources: [], docsRefresh: null };
  if (!source.startsWith('---')) return parsed;
  const end = source.indexOf('\n---', 3);
  if (end === -1) return parsed;
  let listKey = null;
  for (const line of source.slice(3, end).split('\n')) {
    // Any indentation (docs-check.parseFrontmatter accepts any) and optional quotes — a
    // narrower grammar here would read a form-valid page as source-less, i.e. ungated.
    const list = /^\s*-\s+(.*)$/.exec(line);
    if (list && listKey) {
      parsed[listKey].push(list[1].trim().replace(/^(["'])(.*)\1$/, '$2'));
      continue;
    }
    const scalar = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/.exec(line);
    if (!scalar) continue;
    const [, key, value] = scalar;
    if (key === 'sources') {
      listKey = 'sources';
      if (value.trim()) parsed.sources.push(value.trim()); // inline `sources: [a, b]` first entry
    } else {
      listKey = null;
      if (key === 'docs-refresh') parsed.docsRefresh = value.trim();
    }
  }
  return parsed;
}

/** Validate the escape token. Returns null when absent, { ok, reason } or { ok: false, error }. */
export function parseDeferredToken(token) {
  if (token === null || token === undefined || token === '') return null;
  const m = /^deferred\s+—\s+(.+)$/.exec(token);
  if (!m) {
    return {
      ok: false,
      error: `malformed docs-refresh token \`${token}\` — the grammar is \`docs-refresh: deferred — <reason ≥${REASON_MIN} chars>\` (em dash, ci-tool-pinning §3 escape precedent)`,
    };
  }
  const reason = m[1].trim();
  if (reason.length < REASON_MIN) {
    return {
      ok: false,
      error: `docs-refresh deferral reason is ${reason.length} chars — the floor is ${REASON_MIN} (a placeholder is not a reason): \`${reason}\``,
    };
  }
  return { ok: true, reason };
}

// ── git plumbing ───────────────────────────────────────────────────────────────────────────────

/** Changed paths across an explicit `base..head` range; renames yield BOTH paths. */
export function changedPaths(range, root) {
  const r = spawnSync(
    'git',
    [
      '-c',
      'diff.renames=false',
      'diff',
      '--name-only',
      '-z',
      ...range.split('..'),
    ],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (r.error || r.status !== 0) {
    throw new Error(
      `git diff failed for range \`${range}\`: ${(r.stderr || r.error?.message || '').trim()}`,
    );
  }
  return (r.stdout || '').split('\0').filter(Boolean);
}

/**
 * True when a unified-diff patch contains ONLY `docs-refresh:` +/- lines (the token-only-edit
 * carve-out — header docblock above). File headers (`---`/`+++`) are skipped; ANY other
 * content line — title, body, sources — makes this false, so a content change cannot hide
 * behind a token edit. An empty patch is NOT token-only (absence of evidence must not read
 * as an exemption).
 */
export function isTokenOnlyPatch(patch) {
  let sawTokenLine = false;
  // `---`/`+++` are file headers ONLY before a file's first `@@` (the caller may or may not
  // pass the `diff --git` line); inside a hunk they are content (a removed `-- comment` line,
  // an added `++x` line) and must count.
  let inFileHeader = true;
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git')) {
      inFileHeader = true;
      continue;
    }
    if (line.startsWith('@@')) {
      inFileHeader = false;
      continue;
    }
    if (inFileHeader) continue;
    if (line.startsWith('\\ No newline')) continue;
    if (line.startsWith('+') || line.startsWith('-')) {
      // Column 0 only: the token is a frontmatter scalar. An indented `docs-refresh:` is body
      // content (a code sample, a list item) and keeps the page in the gate.
      if (/^[+-]docs-refresh:/.test(line)) {
        sawTokenLine = true;
        continue;
      }
      return false; // any other content line → the page changed substance
    }
  }
  return sawTokenLine;
}

/**
 * The token-only-edit carve-out, wired to git: which changed pages under `docs/site` carry a
 * docs-refresh-only patch. Returns a Set of repo-relative posix paths. A changed page whose
 * patch cannot be read stays OUT of the set (fail-closed — exemption needs evidence).
 */
export function tokenOnlyEditedPages(range, root) {
  const r = spawnSync(
    'git',
    [
      '-c',
      'diff.renames=false',
      'diff',
      '-U0',
      ...range.split('..'),
      '--',
      PAGES_DIR,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const out = new Set();
  if (r.error || r.status !== 0) return out; // no evidence → no exemption
  let current = null;
  let buffer = [];
  const flush = () => {
    if (current && isTokenOnlyPatch(buffer.join('\n'))) out.add(current);
  };
  for (const line of (r.stdout || '').split('\n')) {
    if (line.startsWith('diff --git')) {
      flush();
      const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      current = m ? m[2] : null;
      buffer = [];
      continue;
    }
    if (current !== null) buffer.push(line);
  }
  flush();
  return out;
}

// ── the gate ───────────────────────────────────────────────────────────────────────────────────

/**
 * Pure verdict for ONE page: affected, and if so refreshed / deferred / fail.
 * `changedSet` is a Set of repo-relative posix paths changed in the range.
 *
 * Derived sources (isDerivedSource) are filtered OUT of the gating `via`: a page whose moved
 * sources are all derived is `{ affected: false, exemptDerived: true }` (counted + reported,
 * never silent); a MIX keeps gating on its hand-written sources and carries the derived ones
 * on `exemptVia` for the diagnostics.
 */
export function verdictForPage(fileRel, frontmatter, changedSet) {
  const moved = frontmatter.sources.filter((s) => changedSet.has(s));
  const via = moved.filter((s) => !isDerivedSource(s));
  const exemptVia = moved.filter((s) => isDerivedSource(s));
  if (via.length === 0) {
    if (exemptVia.length === 0) return { affected: false };
    return { affected: false, exemptDerived: true, via: exemptVia };
  }
  const exemptInfo = exemptVia.length > 0 ? { exemptVia } : {};
  if (changedSet.has(fileRel))
    return { affected: true, via, status: 'refreshed', ...exemptInfo };
  const token = parseDeferredToken(frontmatter.docsRefresh);
  if (token === null) {
    return {
      affected: true,
      via,
      status: 'fail',
      ...exemptInfo,
      message: `cited source(s) moved in this range but the page did not change — refresh the page in the same PR, or carry \`docs-refresh: deferred — <reason ≥${REASON_MIN} chars>\` (renders as the D8 stale badge)`,
    };
  }
  if (!token.ok)
    return {
      affected: true,
      via,
      status: 'fail',
      ...exemptInfo,
      message: token.error,
    };
  return {
    affected: true,
    via,
    status: 'deferred',
    reason: token.reason,
    ...exemptInfo,
  };
}

function parseArgs(argv) {
  const opts = { root: DEFAULT_ROOT, json: false, range: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--root') opts.root = resolve(argv[++i] ?? DEFAULT_ROOT);
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (opts.range === null && /^[^.\s]+\.\.[^.\s]+$/.test(a))
      opts.range = a;
    else if (
      opts.range === null &&
      i + 1 < argv.length &&
      /^[^.\s]+$/.test(a) &&
      /^[^.\s]+$/.test(argv[i + 1])
    ) {
      opts.range = `${a}..${argv[i + 1]}`;
      i++;
    } else {
      opts.bad = a;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.range || opts.bad) {
    console.error(`usage: check-docs-refresh.mjs <base>..<head> [--root <dir>] [--json]
  <base>..<head>  the EXPLICIT range to gate (caller-resolved: pre-push push-range, CI base..HEAD).
                  A range is REQUIRED — an empty/implicit range makes this gate report clean on
                  every push (the #hope-as-gate shape R13 amended cold round 1 BU-5 closed).`);
    process.exit(opts.help ? 0 : 2);
  }
  const root = opts.root;
  let changed;
  try {
    changed = changedPaths(opts.range, root);
  } catch (e) {
    console.error(`✗ check-docs-refresh: ${e.message}`);
    process.exit(2);
  }
  // The token-only-edit carve-out: a page whose whole patch is docs-refresh lines drops out
  // of the changed set (seeding a deferral is bookkeeping — it must not cascade a refresh
  // obligation onto the pages citing it). Reported, never silent.
  const tokenOnlySet = tokenOnlyEditedPages(opts.range, root);
  const tokenOnlyEdits = [...tokenOnlySet].sort();
  const changedSet = new Set(changed.filter((p) => !tokenOnlySet.has(p)));
  const pages = pagePopulation(root);

  const affected = [];
  const errors = [];
  const exempt = [];
  let refreshed = 0;
  let deferred = 0;
  let unaffected = 0;
  let exemptDerived = 0;
  for (const rel of pages) {
    let frontmatter;
    try {
      frontmatter = parseRefreshFrontmatter(
        readFileSync(join(root, rel), 'utf8'),
      );
    } catch (e) {
      errors.push({
        file: rel,
        via: [],
        status: 'fail',
        message: `unreadable: ${e.message}`,
      });
      continue;
    }
    const verdict = verdictForPage(rel, frontmatter, changedSet);
    if (!verdict.affected) {
      if (verdict.exemptDerived) {
        exemptDerived++;
        exempt.push({ file: rel, via: verdict.via });
      } else {
        unaffected++;
      }
      continue;
    }
    affected.push({ file: rel, ...verdict });
    if (verdict.status === 'refreshed') refreshed++;
    else if (verdict.status === 'deferred') deferred++;
    else errors.push({ file: rel, ...verdict });
  }

  const result = {
    tool: 'check-docs-refresh',
    root,
    range: opts.range,
    changedCount: changed.length,
    tokenOnlyEdits,
    pages: pages.length,
    unaffected,
    exemptDerived,
    refreshed,
    deferred,
    failures: errors.length,
    affected,
    exempt,
  };

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(
      `check-docs-refresh: range ${opts.range} — ${changed.length} changed path(s), ${pages.length} page(s) in ${PAGES_DIR}`,
    );
    for (const t of tokenOnlyEdits) {
      console.log(
        `  · ${t} — token-only edit (docs-refresh bookkeeping, no refresh cascade)`,
      );
    }
    for (const a of affected) {
      const tag =
        a.status === 'refreshed'
          ? 'PASS (page changed in range)'
          : a.status === 'deferred'
            ? `PASS (deferred: ${a.reason})`
            : 'FAIL';
      const exemptNote = a.exemptVia
        ? ` (also moved, derived-exempt: ${a.exemptVia.join(', ')})`
        : '';
      console.log(
        `  ${a.status === 'fail' ? '✗' : '·'} ${a.file} — via ${a.via.join(', ')}${exemptNote} — ${tag}`,
      );
      if (a.status === 'fail' && a.message) console.log(`      → ${a.message}`);
    }
    for (const e of exempt) {
      console.log(
        `  · ${e.file} — exempt derived via ${e.via.join(', ')} (renderer --check owns freshness)`,
      );
    }
    console.log(
      `summary: pages ${pages.length}, affected ${affected.length}, refreshed ${refreshed}, deferred ${deferred}, failures ${errors.length}, unaffected ${unaffected}, exemptDerived ${exemptDerived}, tokenOnlyEdits ${tokenOnlyEdits.length}`,
    );
    if (deferred >= DEFERRED_WARN_AT) {
      console.log(
        `  ⚠ ${deferred} live deferrals — D26 falsifier (b) threshold is ${DEFERRED_WARN_AT}: the escape is becoming the default; drop the token or make it expire`,
      );
    }
    console.log(
      errors.length > 0
        ? `check-docs-refresh: FAIL — ${errors.length} affected page(s) need a same-range refresh or the docs-refresh: deferred token`
        : `check-docs-refresh: PASS — every affected page refreshed or deferred`,
    );
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

// Only run main when executed directly — the sandbox suite imports the pure parts.
const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();
