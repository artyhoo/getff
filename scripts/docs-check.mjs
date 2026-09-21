#!/usr/bin/env node
/**
 * docs-check — the deterministic form gate of the getff.ai docs quality contract (S0q).
 *
 * spec: docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md
 *   D-Q2  gate set (ERROR vs SUGGESTION vs OFF, «absent binary = ERROR» in CI)
 *   D-Q6  channels — LIVE: the audit-self.yml `docs-quality` job (full + prose,
 *         strict; also carries the render-terms-style D-Q7 drift gate). The
 *         .husky/pre-commit (--changed) arm is shipped, not applied: the
 *         .husky/** path is agent-denied (`.claude/settings.json`
 *         permissions.deny), so the section travels as
 *         .claude/orchestrator-prompts/getff-ai-site/s0q-pre-commit-section.sh
 *         for a maintainer to insert at harvest — until that apply lands, this
 *         header's only reachable channel is the CI job (rework round 1, 2026-09-17).
 *   D-Q12 escape grammar — `<!-- vale off -->` + `<!-- vale-reason: … -->` + `<!-- vale on -->`,
 *         with the MDX brace-comment twins scanned from day one (the .md/.mdx flip is
 *         D31 S1's decision — D-Q6 greps both comment forms either way)
 *   D-Q13 self-application — the prose profile runs in audit-self.yml over the skill + agent
 *   D-Q17 two profiles DECLARED BY PATH, never inferred from the channel
 *   D-Q18 sources drift — body anchors ⊄ `sources:` is an error; authors add, never remove
 *   R19  renderability — every ```mermaid fence on a page must pass the canonical
 *        allow-list (scripts/lib/mermaid-allowlist.mjs, the ONE module both repos
 *        import): the renderer's throw is a header check only and it silently drops
 *        content inside supported types, so an off-allow-list statement is an ERROR
 *        here and at the landing pre-render seam alike. Pages profile ONLY — a page
 *        gate firing on a prose file is the D-Q17 scope-leak falsifier.
 *
 * Profiles (D-Q17):
 *   pages — docs/site/ at any depth, *.md (+ .mdx). Every gate: markdownlint, Vale.Spelling +
 *           getff.Names, lychee offline, C13 frontmatter, C12 skeleton, escape-reason.
 *           A file here WITHOUT `kind:` is an ERROR, permanently — there is no
 *           exclusion list (umbrella round 1 MAJOR-3: nothing passes by omission).
 *   prose — .claude/skills/docs-author/ markdown minus references/gold/,
 *           agents/docs-form-auditor.md, docs/site-quality/calibration.md.
 *           markdownlint + Vale spelling/Names + escape-reason ONLY — never the page
 *           gates (a page gate firing on a prose file is a scope leak, D-Q17 falsifier).
 * A path in neither list is skipped and reported.
 *
 * Severity (mirrors the S17_WARN_ONLY env pattern):
 *   lenient (default — the pre-commit channel): an absent external binary is a loud
 *   SKIP line, never a silent pass.
 *   strict (DOCS_CHECK_STRICT=1 or --strict — the audit-self.yml channel): an absent
 *   binary is an ERROR (D-Q2: «absent binary = ERROR», not the pre-push warn-and-skip).
 *   A binary that is PRESENT but fails is an ERROR in both modes — a crashed gate must
 *   never read as clean.
 *
 * Exit code: 1 when any ERROR-tier finding exists. SUGGESTION-tier Vale alerts (the six
 * declared D-Q2 suggestions) are reported, never blocking.
 *
 * Usage:
 *   node scripts/docs-check.mjs                   full population (pages + prose)
 *   node scripts/docs-check.mjs --changed         staged files only (the pre-commit form)
 *   node scripts/docs-check.mjs <file...>         explicit files, classified by path
 *   node scripts/docs-check.mjs --profile pages   restrict the full run to one profile;
 *                                                 with explicit files, FORCE that profile
 *                                                 (the test seam). A restricted run whose
 *                                                 population is empty fails as vacuous.
 *   --strict | --lenient                          override DOCS_CHECK_STRICT
 *   --json                                        machine output (test arms + snapshots)
 *   --root <dir>                                  operate on a fixture root
 *
 * External tools, each independently resolved and independently degraded:
 *   vale         VALE_BIN > `vale` on PATH          config: docs/site-quality/vale/.vale.ini
 *   lychee       LYCHEE_BIN > `lychee` on PATH      flags mirror pre-push.ts §8 lycheeSection
 *   markdownlint MARKDOWNLINT_BIN > `npx --no-install markdownlint-cli2` (devDep, lockfile-pinned)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateMarkdownMermaid } from './lib/mermaid-allowlist.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(here, '..');

const PAGES_DIR = 'docs/site';
const PAGES_EXTENSIONS = new Set(['.md', '.mdx']);
/** D-Q17 prose population — fixed paths + the docs-author skill tree minus its frozen gold copies. */
const PROSE_FILES = [
  'docs/site-quality/calibration.md',
  'agents/docs-form-auditor.md',
];
const PROSE_SKILL_DIR = '.claude/skills/docs-author';
const PROSE_EXEMPT_PREFIX = `${PROSE_SKILL_DIR}/references/gold/`;
const VALE_CONFIG = 'docs/site-quality/vale/.vale.ini';
/** D-Q12 escape-reason floor (pr-body-fidelity rationale floor, reused by D-Q12). */
const REASON_MIN = 20;

/**
 * The C12 skeleton registry — required `## ` sections per `kind:`, in required order.
 * The seven values are the closed set page-kinds.md registers (docs-author skill);
 * `face-page` is JUDGE-only against D28 §5 (never encoded here) and `glossary` carries
 * C13 only (both empty here by design — an empty list gates nothing, honestly).
 */
export const KINDS = {
  'reference-sheet': ['Fact card', 'Explanation', 'Evidence'],
  'family-overview': ['Common cases', 'When not to reach for this family'],
  'learn-tutorial': ['Steps', 'What you built'],
  guide: ['Prerequisites', 'Steps', 'Verify', 'Variations'],
  understand: ['Mechanism', 'Proof', 'Limits'],
  'face-page': [],
  glossary: [],
};

// ── pure parsing/checking halves (exported for the test arms) ─────────────────────────────────

/** Split a markdown source into `{ data, body }`; `data` is null when the block is absent/malformed. */
export function parseFrontmatter(source) {
  if (!source.startsWith('---')) return { data: null, body: source };
  const end = source.indexOf('\n---', 3);
  if (end === -1) return { data: null, body: source };
  const block = source.slice(3, end).replace(/^\n/, '');
  const data = {};
  let currentList = null;
  for (const rawLine of block.split('\n')) {
    if (/^-\s+/.test(rawLine.trim()) && currentList) {
      currentList.push(rawLine.trim().replace(/^-\s+/, '').trim());
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(rawLine);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === '' || value === undefined) {
      data[key] = [];
      currentList = data[key];
    } else {
      data[key] = value.trim();
      currentList = null;
    }
  }
  return { data, body: source.slice(end + 4) };
}

/** Blank out fenced code blocks (``` / ~~~), keeping line count and numbering stable. */
export function stripFences(source) {
  let fence = null;
  return source
    .split('\n')
    .map((line) => {
      const open = /^\s*(```|~~~)/.exec(line);
      if (fence) {
        if (open && line.trim().startsWith(fence)) fence = null;
        return '';
      }
      if (open) {
        fence = open[1];
        return '';
      }
      return line;
    })
    .join('\n');
}

/** Remove HTML/MDX comment blocks (fence markers, generated regions, vale directives). */
export function stripComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

const OFF_LINE = /^(?:<!--\s*vale\s+off\s*-->|\{\/\*\s*vale\s+off\s*\*\/\})$/;
const ON_LINE = /^(?:<!--\s*vale\s+on\s*-->|\{\/\*\s*vale\s+on\s*\*\/\})$/;
const REASON_LINE =
  /^(?:<!--\s*vale-reason:\s*(.*?)\s*-->|\{\/\*\s*vale-reason:\s*(.*?)\s*\*\/\})$/;

/**
 * D-Q12 escape grammar over BOTH comment forms: every `vale off` must be followed
 * on the very next line by a `vale-reason:` comment carrying ≥REASON_MIN chars, and
 * must be closed by a later `vale on`. Examples inside fenced code blocks are prose
 * ABOUT the grammar, not escape attempts, so fences are stripped first.
 */
export function checkEscapes(source) {
  const errors = [];
  const lines = stripFences(source).split('\n');
  const open = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (OFF_LINE.test(line)) {
      open.push(i + 1);
      const next = (lines[i + 1] ?? '').trim();
      const reason = REASON_LINE.exec(next);
      if (!reason) {
        errors.push({
          line: i + 2,
          rule: 'docs-check.escape-reason',
          message:
            '`vale off` is not immediately followed by a `vale-reason:` comment — the two-comment form is D-Q12: `<!-- vale off -->` then `<!-- vale-reason: <≥20 chars> -->`',
        });
      } else {
        const text = reason[1] ?? reason[2] ?? '';
        if (text.length < REASON_MIN) {
          errors.push({
            line: i + 2,
            rule: 'docs-check.escape-reason',
            message: `vale-reason is ${text.length} chars; the floor is ${REASON_MIN} (D-Q12)`,
          });
        }
      }
    } else if (ON_LINE.test(line)) {
      open.pop();
    }
  }
  for (const lineNo of open) {
    errors.push({
      line: lineNo,
      rule: 'docs-check.escape-pairing',
      message:
        '`vale off` with no matching `vale on` before end of file (D-Q12: the escape is closed)',
    });
  }
  return errors;
}

/** C13 frontmatter gate. `fileRel` is used only for messages. */
export function checkFrontmatter(data, fileRel) {
  if (data === null) {
    return [
      {
        line: 1,
        rule: 'docs-check.frontmatter',
        message: `no parseable frontmatter block — title, description, kind and sources: are required (C13)`,
      },
    ];
  }
  const errors = [];
  const want = (key, why) => {
    const v = data[key];
    if (typeof v !== 'string' || v.trim() === '') {
      errors.push({
        line: 1,
        rule: 'docs-check.frontmatter',
        message: `\`${key}:\` missing or empty — ${why}`,
      });
    }
  };
  want('title', 'C13 frontmatter completeness');
  want('description', 'C13 frontmatter completeness');
  const kind = data.kind;
  if (typeof kind !== 'string' || kind.trim() === '') {
    errors.push({
      line: 1,
      rule: 'docs-check.frontmatter',
      message:
        'no `kind:` key — every file under docs/site/ carries a registered kind, permanently, and no exclusion list exists (D-Q17)',
    });
  } else if (!(kind in KINDS)) {
    errors.push({
      line: 1,
      rule: 'docs-check.frontmatter',
      message: `\`kind: ${kind}\` is not registered — the closed set is ${Object.keys(KINDS).join(', ')} (page-kinds.md, C13)`,
    });
  }
  if (!Array.isArray(data.sources)) {
    errors.push({
      line: 1,
      rule: 'docs-check.frontmatter',
      message:
        '`sources:` missing — the D26 refresh mapping input (C13); authors add entries, never remove derived ones (D-Q18)',
    });
  }
  return errors;
}

/** C12 skeleton gate — required `## ` sections present, in order, for the five bulk kinds. */
export function checkSkeleton(body, kind) {
  const required = KINDS[kind] ?? [];
  if (required.length === 0) return [];
  const headings = [];
  const fenced = stripFences(body);
  fenced.split('\n').forEach((line, idx) => {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) headings.push({ title: h[1], line: idx + 1 });
  });
  const errors = [];
  let prev = -1;
  for (const req of required) {
    const found = headings.find((h) => h.title === req);
    if (!found) {
      errors.push({
        line: 1,
        rule: 'docs-check.skeleton',
        message: `missing required section \`## ${req}\` for kind \`${kind}\` (C12)`,
      });
      continue;
    }
    if (found.line < prev) {
      errors.push({
        line: found.line,
        rule: 'docs-check.skeleton',
        message: `\`## ${req}\` is out of the required order for kind \`${kind}\`: ${required.join(' → ')} (C12)`,
      });
    }
    prev = found.line;
  }
  return errors;
}

/**
 * D-Q18 anchor grammar (the half the D29 renderer shares): body anchors are
 *  (a) markdown links `(target)` and (b) inline-code spans, whose target resolves to an
 * EXISTING repo file. Fenced blocks and comments are machine territory, stripped first.
 * Anchors must all appear in `sources:`; the reverse is not required (authors may add).
 */
export function extractAnchors(body, fileRel, root) {
  const anchors = new Set();
  const text = stripComments(stripFences(body));
  const pageAbsDir = dirname(join(root, fileRel));
  const addExisting = (candidate) => {
    const abs = isAbsolute(candidate)
      ? candidate
      : resolve(pageAbsDir, candidate);
    try {
      if (statSync(abs).isFile())
        anchors.add(relative(root, abs).split(sep).join('/'));
    } catch {
      /* not an anchor — a link to a non-existent path is lychee's finding, not a source */
    }
  };
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#|\/\/)/.test(target)) continue;
    const pathPart = target.split('#')[0];
    if (pathPart) addExisting(pathPart);
  }
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const span = m[1].trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_./-]*\.[A-Za-z0-9]+$/.test(span)) continue;
    if (span.includes('..')) continue;
    addExisting(join(root, span));
  }
  return [...anchors].sort();
}

/** D-Q18 drift — every body anchor must appear in `sources:`. */
export function checkSources(anchors, sources, fileRel) {
  if (anchors.length === 0) return [];
  const listed = new Set((sources ?? []).map((s) => String(s).trim()));
  return anchors
    .filter((a) => !listed.has(a))
    .map((anchor) => ({
      line: 1,
      rule: 'docs-check.sources',
      message: `body anchor \`${anchor}\` is not in \`sources:\` — add it (authors add, never remove a derived entry — D-Q18)`,
    }));
}

/** D-Q17 classification, by path only. Returns 'pages' | 'prose' | null. */
export function classifyPath(fileRel) {
  const p = fileRel.split(sep).join('/');
  if (
    (p.startsWith(`${PAGES_DIR}/`) || p === PAGES_DIR) &&
    PAGES_EXTENSIONS.has(p.slice(p.lastIndexOf('.')))
  ) {
    return 'pages';
  }
  if (PROSE_FILES.includes(p)) return 'prose';
  if (
    p.startsWith(`${PROSE_SKILL_DIR}/`) &&
    p.endsWith('.md') &&
    !p.startsWith(PROSE_EXEMPT_PREFIX)
  )
    return 'prose';
  return null;
}

function walkMarkdown(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(abs));
    else if (
      entry.isFile() &&
      PAGES_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))
    )
      out.push(abs);
  }
  return out;
}

/** The full D-Q17 population of a root, as repo-relative posix paths, sorted. */
export function fullPopulation(root) {
  const pagesDir = join(root, PAGES_DIR);
  const pages = existsSync(pagesDir) ? walkMarkdown(pagesDir) : [];
  const prose = [];
  for (const fixed of PROSE_FILES) {
    const abs = join(root, fixed);
    if (existsSync(abs)) prose.push(abs);
  }
  const skillDir = join(root, PROSE_SKILL_DIR);
  if (existsSync(skillDir)) prose.push(...walkMarkdown(skillDir));
  return {
    pages: pages.map((a) => relative(root, a).split(sep).join('/')).sort(),
    prose: [
      ...new Set(prose.map((a) => relative(root, a).split(sep).join('/'))),
    ]
      .filter((p) => !p.startsWith(PROSE_EXEMPT_PREFIX))
      .sort(),
  };
}

// ── external tools ─────────────────────────────────────────────────────────────────────────────

function onPath(bin) {
  for (const dir of (process.env.PATH ?? '').split(':')) {
    if (!dir) continue;
    const candidate = join(dir, bin);
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      /* unreadable PATH entry — skip */
    }
  }
  return null;
}

function resolveVale() {
  return process.env.VALE_BIN || onPath('vale');
}

function resolveLychee() {
  return process.env.LYCHEE_BIN || onPath('lychee');
}

let markdownlintCache;
/** MARKDOWNLINT_BIN > local devDep via `npx --no-install` (lockfile-pinned; no network fetch). */
function resolveMarkdownlint(root) {
  if (markdownlintCache !== undefined) return markdownlintCache;
  const direct = process.env.MARKDOWNLINT_BIN;
  if (direct) {
    markdownlintCache = { cmd: direct, baseArgs: [], cwd: root };
    return markdownlintCache;
  }
  const probe = spawnSync(
    'npx',
    ['--no-install', 'markdownlint-cli2', '--version'],
    { cwd: root, encoding: 'utf8' },
  );
  markdownlintCache =
    probe.status === 0
      ? {
          cmd: 'npx',
          baseArgs: ['--no-install', 'markdownlint-cli2'],
          cwd: root,
        }
      : null;
  return markdownlintCache;
}

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8' });
}

// ── orchestration ──────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    root: DEFAULT_ROOT,
    changed: false,
    profile: null,
    json: false,
    strict: null,
    files: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--changed') opts.changed = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--lenient') opts.strict = false;
    else if (a === '--profile') opts.profile = argv[++i] ?? null;
    else if (a === '--root') opts.root = resolve(argv[++i] ?? DEFAULT_ROOT);
    else if (a === '--help' || a === '-h') opts.help = true;
    else opts.files.push(a);
  }
  return opts;
}

function targetList(opts) {
  if (opts.files.length > 0) {
    return opts.files.map((f) =>
      relative(opts.root, resolve(process.cwd(), f)).split(sep).join('/'),
    );
  }
  if (opts.changed) {
    const r = run(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
      opts.root,
    );
    if (r.status !== 0)
      return { error: `git diff --cached failed: ${(r.stderr || '').trim()}` };
    return (r.stdout || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return null; // full population
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = opts.root;
  if (opts.help) {
    console.error(
      'see the header comment of scripts/docs-check.mjs for the full contract',
    );
    process.exit(0);
  }
  if (opts.profile && opts.profile !== 'pages' && opts.profile !== 'prose') {
    console.error(
      `✗ --profile must be 'pages' or 'prose', got '${opts.profile}'`,
    );
    process.exit(2);
  }
  const strict = opts.strict ?? process.env.DOCS_CHECK_STRICT === '1';
  const errors = [];
  const suggestions = [];
  const skips = [];

  const fail = (message) => {
    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({ tool: 'docs-check', root, severity: strict ? 'strict' : 'lenient', populations: null, errors: [{ file: '(docs-check)', line: null, rule: 'docs-check.fatal', message }], suggestions: [], skips: [] }, null, 2)}\n`,
      );
    } else {
      console.error(`✗ docs-check: ${message}`);
    }
    process.exit(1);
  };

  const listed = targetList(opts);
  if (listed && listed.error) fail(listed.error);

  let populations = { pages: [], prose: [], skipped: [] };
  if (listed === null) {
    const full = fullPopulation(root);
    if (opts.profile) {
      populations[opts.profile] = full[opts.profile];
      if (populations[opts.profile].length === 0) {
        fail(
          `vacuous run: --profile ${opts.profile} population is empty — a restricted gate with nobody in it asserts nothing`,
        );
      }
    } else {
      populations.pages = full.pages;
      populations.prose = full.prose;
    }
  } else {
    for (const rel of listed) {
      if (!existsSync(join(root, rel))) {
        errors.push({
          file: rel,
          line: null,
          rule: 'docs-check.fatal',
          message: 'file does not exist',
        });
        continue;
      }
      const cls = opts.profile ?? classifyPath(rel);
      if (cls === 'pages' || cls === 'prose') populations[cls].push(rel);
      else
        populations.skipped.push({
          file: rel,
          reason:
            'no profile — neither docs/site/**(x) nor the D-Q17 prose population',
        });
    }
    if (
      opts.profile &&
      populations[opts.profile].length === 0 &&
      errors.length === 0
    ) {
      fail(
        `vacuous run: --profile ${opts.profile} matched none of the ${listed.length} given file(s)`,
      );
    }
  }

  const pageFiles = [...populations.pages].sort();
  const proseFiles = [...populations.prose].sort();
  const allFiles = [...pageFiles, ...proseFiles];

  // per-file structural gates (pure, always run)
  for (const rel of allFiles) {
    const abs = join(root, rel);
    let source;
    try {
      source = readFileSync(abs, 'utf8');
    } catch (e) {
      errors.push({
        file: rel,
        line: null,
        rule: 'docs-check.fatal',
        message: `unreadable: ${e.message}`,
      });
      continue;
    }
    const { data, body } = parseFrontmatter(source);
    for (const e of checkEscapes(source)) errors.push({ file: rel, ...e });
    const isPage = pageFiles.includes(rel);
    if (isPage) {
      // R19 — mermaid renderability: the canonical allow-list module (shared with the
      // landing pre-render seam) validates every fence; findings already carry absolute
      // markdown line numbers and `mermaid.allowlist.*` rule ids.
      for (const e of validateMarkdownMermaid(source))
        errors.push({ file: rel, ...e });
      const fmErrors = checkFrontmatter(data, rel);
      for (const e of fmErrors) errors.push({ file: rel, ...e });
      if (data !== null && typeof data.kind === 'string' && KINDS[data.kind]) {
        for (const e of checkSkeleton(body, data.kind))
          errors.push({ file: rel, ...e });
      }
      if (Array.isArray(data?.sources)) {
        const anchors = extractAnchors(body, rel, root);
        for (const e of checkSources(anchors, data.sources, rel))
          errors.push({ file: rel, ...e });
      }
    }
  }

  // markdownlint (both profiles, batched)
  if (allFiles.length > 0) {
    const mdl = resolveMarkdownlint(root);
    if (!mdl) {
      const message =
        'markdownlint-cli2 unavailable (no MARKDOWNLINT_BIN, not a local devDep)';
      if (strict)
        errors.push({
          file: '(markdownlint)',
          line: null,
          rule: 'docs-check.tool-absent',
          message: `${message} — ERROR under strict (D-Q2)`,
        });
      else
        skips.push({
          tool: 'markdownlint',
          reason: `${message} — structural markdownlint not run (lenient)`,
        });
    } else {
      const r = run(mdl.cmd, [...mdl.baseArgs, ...allFiles], mdl.cwd);
      if (r.error) {
        errors.push({
          file: '(markdownlint)',
          line: null,
          rule: 'docs-check.tool',
          message: `failed to spawn: ${r.error.message}`,
        });
      } else if (r.status !== 0) {
        const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
        for (const rel of allFiles) {
          const lines = out.split('\n').filter((l) => l.startsWith(rel));
          if (lines.length > 0) {
            errors.push({
              file: rel,
              line: null,
              rule: 'markdownlint',
              message: lines.slice(0, 10).join(' | '),
            });
          }
        }
        const attributed = allFiles.some((rel) => out.includes(rel));
        if (!attributed) {
          errors.push({
            file: '(markdownlint)',
            line: null,
            rule: 'markdownlint',
            message: out.split('\n').slice(0, 10).join(' | '),
          });
        }
      }
    }
  }

  // vale — spelling + Names (error tier gates) + the six declared suggestions (reported)
  if (allFiles.length > 0) {
    const vale = resolveVale();
    const config = join(root, VALE_CONFIG);
    if (!vale || !existsSync(config)) {
      const message = !vale ? 'vale binary absent' : `${VALE_CONFIG} missing`;
      if (strict)
        errors.push({
          file: '(vale)',
          line: null,
          rule: 'docs-check.tool-absent',
          message: `${message} — ERROR under strict (D-Q2: absent binary is not warn-and-skip)`,
        });
      else
        skips.push({
          tool: 'vale',
          reason: `${message} — spelling/Names not run (lenient; set VALE_BIN)`,
        });
    } else {
      const r = run(
        vale,
        ['--config', config, '--output=JSON', ...allFiles],
        root,
      );
      let alerts = null;
      if (!r.error && r.status !== null && r.stdout) {
        try {
          const parsed = JSON.parse(r.stdout);
          // Vale 3.21.0 emits an object keyed by file path and the alerts
          // themselves carry no Path (measured on this config); older shapes
          // were a flat alert array with Path on each entry. Normalize to the
          // flat shape, re-attaching the key as Path.
          alerts = Array.isArray(parsed)
            ? parsed
            : Object.entries(parsed).flatMap(([file, list]) =>
                list.map((a) => ({ ...a, Path: file })),
              );
        } catch {
          alerts = null;
        }
      }
      if (!Array.isArray(alerts)) {
        errors.push({
          file: '(vale)',
          line: null,
          rule: 'docs-check.tool',
          message: `vale failed (rc=${r.status ?? '?'}) — a crashed gate is never read as clean: ${(r.stderr || r.stdout || '').trim().split('\n').slice(0, 5).join(' | ')}`,
        });
      } else {
        for (const alert of alerts) {
          const rawPath = String(alert.Path ?? '');
          const entry = {
            file: (isAbsolute(rawPath) ? relative(root, rawPath) : rawPath)
              .split(sep)
              .join('/'),
            line: alert.Line ?? null,
            rule: alert.Check ?? 'vale',
            message: String(alert.Message ?? '').trim(),
          };
          if (alert.Severity === 'error') errors.push(entry);
          else suggestions.push(entry);
        }
      }
    }
  }

  // lychee — offline link check, pages profile only (D-Q2), flags mirror pre-push §8
  if (pageFiles.length > 0) {
    const lychee = resolveLychee();
    if (!lychee) {
      const message = 'lychee binary absent';
      if (strict)
        errors.push({
          file: '(lychee)',
          line: null,
          rule: 'docs-check.tool-absent',
          message: `${message} — ERROR under strict (D-Q2)`,
        });
      else
        skips.push({
          tool: 'lychee',
          reason: `${message} — offline link check not run (lenient; set LYCHEE_BIN)`,
        });
    } else {
      const r = run(
        lychee,
        ['--offline', '--no-progress', '--root-dir', root, ...pageFiles],
        root,
      );
      if (r.error) {
        errors.push({
          file: '(lychee)',
          line: null,
          rule: 'docs-check.tool',
          message: `failed to spawn: ${r.error.message}`,
        });
      } else if (r.status !== 0) {
        const out = `${r.stdout || ''}\n${r.stderr || ''}`;
        let attributed = false;
        for (const rel of pageFiles) {
          if (out.includes(rel)) {
            const lines = out.split('\n').filter((l) => l.includes(rel));
            errors.push({
              file: rel,
              line: null,
              rule: 'lychee',
              message: lines.slice(0, 5).join(' | ').trim(),
            });
            attributed = true;
          }
        }
        if (!attributed) {
          errors.push({
            file: '(lychee)',
            line: null,
            rule: 'lychee',
            message: out.trim().split('\n').slice(-15).join(' | '),
          });
        }
      }
    }
  }

  const result = {
    tool: 'docs-check',
    root,
    severity: strict ? 'strict' : 'lenient',
    populations: {
      pages: pageFiles,
      prose: proseFiles,
      skipped: populations.skipped,
    },
    errors,
    suggestions,
    skips,
  };

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(
      `docs-check: severity ${strict ? 'strict' : 'lenient'} — pages ${pageFiles.length}, prose ${proseFiles.length}, skipped ${populations.skipped.length}`,
    );
    for (const e of errors)
      console.log(
        `  ✗ ${e.file}${e.line ? `:${e.line}` : ''} [${e.rule}] ${e.message}`,
      );
    const cap = 20;
    for (const s of suggestions.slice(0, cap))
      console.log(
        `  · ${s.file}${s.line ? `:${s.line}` : ''} [${s.rule}] ${s.message}`,
      );
    if (suggestions.length > cap)
      console.log(
        `  · … +${suggestions.length - cap} more suggestion(s) (never blocking, D-Q2)`,
      );
    for (const s of skips) console.log(`  SKIP ${s.tool} — ${s.reason}`);
    if (populations.skipped.length > 0) {
      console.log(
        `  skipped (${populations.skipped.length}): ${populations.skipped
          .map((s) => s.file)
          .slice(0, 5)
          .join(', ')}${populations.skipped.length > 5 ? ' …' : ''}`,
      );
    }
    console.log(
      errors.length > 0
        ? `docs-check: FAIL — ${errors.length} error(s), ${suggestions.length} suggestion(s)`
        : `docs-check: PASS — 0 errors, ${suggestions.length} suggestion(s)`,
    );
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

// Only run main when executed directly — the test arms import the pure parts.
const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();
