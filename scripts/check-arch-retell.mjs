#!/usr/bin/env node
/**
 * check-arch-retell — every point of an /arch consensus retell names where it came from.
 *
 * THE DEFECT (2026-09-29, one-button chain design, a session compacted many times). Asked to
 * retell the design so the operator could confirm consensus, the author mixed its own inventions
 * (retry-then-remove, an `llms.txt` pointer line, temp-copy proof mechanics — zero hits in the
 * previous revision, added only in the retelling's own commit) with operator decisions, and
 * presented a round-1 BLANKET answer (agreement to a batch) as a firm decision on each detail.
 * Compaction summaries flatten who-said-what, and spec text the author wrote reads as agreed even
 * when it is not. The operator moved the design to a fresh session.
 *
 * THE CONTRACT (owner: .claude/skills/arch/SKILL.md, «Consensus retell»). A spec section headed
 * `## Consensus retell` must carry:
 *   1. a `Baseline:` line — the SHA of the last operator-confirmed commit of the spec, which every
 *      claim was diffed against before the retell was written, or `none` for a first retell;
 *   2. exactly one table, with a `Source` column and at least one row, every row's cell made of
 *      one or more of
 *        operator «<quote>»        the operator's own words, non-empty
 *        P<n> / P-<n>              a premise-register number
 *        register <row-id>         a decision-register row; append `(blanket)` when the operator
 *                                  agreed to a batch, not to this detail
 *      joined by `+` or `,`. `author` is refused in this table;
 *   3. a `### Unconfirmed — author derivations` subsection (list items, or `- none`).
 * A cited P-number or register row must be RECORDED in the same file outside every retell
 * section — as the first cell of a table row, a list item, a heading or a bold line lead (`| P3 |`,
 * `| **D4** —`, `- P3 —`, `### P3`, `**P3** —`) — so a retell cannot cite a premise the spec never recorded, and a word that
 * merely occurs in prose does not count. Every `## Consensus retell` section is checked.
 *
 * THE BASELINE ARM, BY CHANNEL. A Baseline SHA is real at the moment it is written and may stop
 * resolving later: design branches are squash-merged and deleted (`delete_branch_on_merge`), so
 * their commits leave every clone. So the SHA is resolved only where it was just written:
 *   (default)   CI whole-corpus scan — shape only: a 7-40 hex SHA or `none`;
 *   --staged    pre-commit — resolve it when the index ADDS that Baseline line;
 *   --resolve   resolve every Baseline (manual use, tests).
 *
 * DECLARED LIMIT. The gate checks the tag, not its truth: it cannot tell a real operator quote from
 * an invented one, nor whether a claim really matches the row it cites — that stays the §2 cold
 * seats' job. It fires only where the section exists; that /arch writes the section is prose in
 * the skill. It does not read a register row's Status, so «answered» is the author's word.
 * Build-vs-reuse: prior-art-evaluations.md#299.
 *
 * Usage:
 *   node scripts/check-arch-retell.mjs [--staged|--resolve]              scan docs/superpowers/specs/*.md
 *   node scripts/check-arch-retell.mjs [--staged|--resolve] <file.md>…   scan the given files
 * Exit: 0 clean, 1 findings, 2 usage error.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const SPEC_DIR = join(ROOT, 'docs/superpowers/specs');
const SECTION = /^##\s+Consensus retell\s*$/;
const UNCONFIRMED = /^###\s+Unconfirmed\s+—\s+author derivations\s*$/;
const BASELINE = /^\*{0,2}Baseline:\*{0,2}\s*/;
const TABLE_ROW = /^\s*\|/;
const SEPARATOR = /^\s*\|[\s:|-]+\|\s*$/;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Split a table row into trimmed cells; `\|` is a literal pipe, not a cell border. */
const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));

function isCommit(sha) {
  try {
    execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Lines the index adds to <file> (for --staged). */
function stagedAdds(file) {
  try {
    const diff = execFileSync('git', ['diff', '--cached', '-U0', '--', file], { encoding: 'utf8' });
    return new Set(diff.split('\n').filter((l) => /^\+(?!\+\+)/.test(l)).map((l) => l.slice(1)));
  } catch {
    return new Set();
  }
}

/** Parse one Source cell into references; returns { refs, error }. */
function parseSource(cell) {
  if (!cell) return { error: 'empty Source cell' };
  const refs = [];
  for (const raw of cell.split(/\s*[+,]\s*(?![^«]*»)/)) {
    const part = raw.trim();
    let m;
    if ((m = /^operator\s+«(.*)»$/.exec(part))) {
      if (!m[1].trim()) return { error: 'empty operator quote' };
    } else if ((m = /^(P-?\d+)$/.exec(part))) {
      refs.push(m[1]);
    } else if ((m = /^register\s+(\S+?)(\s+\(blanket\))?$/.exec(part))) {
      refs.push(m[1]);
    } else if (/^author\b/i.test(part)) {
      return { error: '`author` belongs in «Unconfirmed — author derivations», not the table' };
    } else {
      return { error: `unrecognised source «${part}» (want operator «…» / P<n> / register <id>)` };
    }
  }
  return { refs };
}

/** Is <id> recorded as a register entry: first cell of a table row, a list item, or a heading? */
function isRecorded(id, outsideLines) {
  const tok = `\\**${escapeRe(id)}\\**(?![\\w-])`;
  const bold = `\\*\\*${escapeRe(id)}\\*\\*`;
  const re = new RegExp(`^\\s*(?:\\|\\s*${tok}|[-*]\\s+${tok}|#+\\s+${tok}|${bold})`);
  return outsideLines.some((l) => re.test(l));
}

/** Retell sections as [start, end) line ranges; headings inside a code fence are quoted templates. */
function sections(lines) {
  const out = [];
  let fenced = false;
  let open = -1;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fenced = !fenced;
    if (fenced) return;
    if (/^##\s/.test(l) && open !== -1) {
      out.push([open, i]);
      open = -1;
    }
    if (SECTION.test(l)) open = i;
  });
  if (open !== -1) out.push([open, lines.length]);
  return out;
}

function checkSection(file, lines, [start, end], outsideLines, mode) {
  const findings = [];
  const at = (i) => `${file}:${i + 1}`;
  const idx = [];
  for (let i = start + 1; i < end; i++) idx.push(i);

  const b = idx.find((i) => BASELINE.test(lines[i]));
  if (b === undefined) {
    findings.push(`${at(start)}: no «Baseline:» line (last operator-confirmed commit, or none)`);
  } else {
    const val = lines[b].replace(BASELINE, '');
    const sha = /^`?([0-9a-f]{7,40})\b/.exec(val);
    if (sha) {
      const resolve = mode === 'resolve' || (mode === 'staged' && stagedAdds(file).has(lines[b]));
      if (resolve && !isCommit(sha[1])) findings.push(`${at(b)}: Baseline ${sha[1]} is not a commit in this repository`);
    } else if (!/^none\b/i.test(val)) {
      findings.push(`${at(b)}: Baseline must be a commit SHA or «none»`);
    }
  }

  const tables = idx.filter((i) => TABLE_ROW.test(lines[i]) && SEPARATOR.test(lines[i + 1] ?? '') && !TABLE_ROW.test(lines[i - 1] ?? ''));
  if (tables.length === 0) {
    findings.push(`${at(start)}: no retell table`);
  } else {
    if (tables.length > 1) findings.push(`${at(tables[1])}: more than one table in the retell — keep one`);
    const h = tables[0];
    const col = cells(lines[h]).findIndex((c) => /^source$/i.test(c));
    if (col === -1) {
      findings.push(`${at(h)}: retell table has no «Source» column`);
    } else {
      let rows = 0;
      for (let i = h + 2; i < end && TABLE_ROW.test(lines[i]); i++) {
        rows++;
        const { refs, error } = parseSource(cells(lines[i])[col] ?? '');
        if (error) {
          findings.push(`${at(i)}: ${error}`);
          continue;
        }
        for (const ref of refs) {
          if (!isRecorded(ref, outsideLines)) {
            findings.push(`${at(i)}: cites ${ref}, which this spec never records as a register entry outside the retell`);
          }
        }
      }
      if (rows === 0) findings.push(`${at(h)}: retell table has no rows`);
    }
  }

  if (!idx.some((i) => UNCONFIRMED.test(lines[i]))) {
    findings.push(`${at(start)}: no «### Unconfirmed — author derivations» subsection (write «- none» when empty)`);
  }
  return findings;
}

function check(file, mode) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const secs = sections(lines);
  if (!secs.length) return [];
  const inside = new Set(secs.flatMap(([s, e]) => Array.from({ length: e - s }, (_, k) => s + k)));
  const outsideLines = lines.filter((_, i) => !inside.has(i));
  return secs.flatMap((sec) => checkSection(file, lines, sec, outsideLines, mode));
}

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('-'));
const mode = flags.includes('--resolve') ? 'resolve' : flags.includes('--staged') ? 'staged' : 'shape';
if (flags.some((f) => f !== '--staged' && f !== '--resolve') || flags.length > 1) {
  console.error('usage: check-arch-retell.mjs [--staged|--resolve] [file.md …]');
  process.exit(2);
}
const paths = args.filter((a) => !a.startsWith('-'));
const files = paths.length
  ? paths
  : existsSync(SPEC_DIR)
    ? readdirSync(SPEC_DIR)
        .filter((f) => f.endsWith('.md'))
        .map((f) => relative(process.cwd(), join(SPEC_DIR, f)))
    : [];
const findings = files.flatMap((f) => check(f, mode));
for (const f of findings) console.error(`❌ ${f}`);
if (findings.length) {
  console.error('   contract: .claude/skills/arch/SKILL.md «Consensus retell»');
  process.exit(1);
}
