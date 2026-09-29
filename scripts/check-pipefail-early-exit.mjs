#!/usr/bin/env node
/**
 * check-pipefail-early-exit — refuse a pipe into an early-exiting `grep` in a shell script that
 * runs under `set -o pipefail`.
 *
 * THE DEFECT (measured 2026-09-29). `grep -q` exits on its first match. When the command on the
 * left still has a write to make — bash `printf '%s\n' "$multiline"` and `echo` write once per
 * line, gawk writes 4096-byte chunks — that write gets EPIPE and the producer dies of SIGPIPE
 * (141), or returns 1 with «write error: Broken pipe» when SIGPIPE is ignored. Under pipefail that
 * non-zero becomes the status of the whole pipeline, so a positive check reads as «no match» and a
 * negated one (`! a | grep -q X`, `if a | grep -q X; then fail`) turns a real hit into a pass.
 * Scheduling decides the race, so it shows up under CPU load: `setup.d/99-finalize.sh`'s
 * `_r2_boundary_under` returned 141 in 1/400 runs under 2x oversubscription and skipped R2 for a
 * consumer config that had boundary code (tests/install-sh/r2-boundary-under-sigpipe.test.sh).
 *
 * WHAT COUNTS. An unquoted `|` whose right-hand command is `grep` / `egrep` / `fgrep` with an
 * early-exit option: `-q`, `--quiet`, `--silent`, `-l`, `-L`, `--files-with(out)-match(es)`, `-m N`,
 * `--max-count`. `-s` is NOT one (it is --no-messages). Short options are read as clusters, so
 * `-qE`, `-Eq`, `-qxF` all count; `-e`/`-f`/`-m`/`-A`/`-B`/`-C`/`-d`/`-D` end a cluster because
 * the rest of the word is their argument.
 *
 * WHICH FILES. The population below, and within it only files under pipefail: a file that runs
 * `set ... -o pipefail` itself, or one sourced by a parent that does (`setup.d/*.sh` is sourced by
 * install.sh, which runs `set -euo pipefail`). Heredoc bodies are skipped: they are text written
 * for another program, not code of this file.
 *
 * THE FIX IDIOM. `grep -q P <<<"$VAR"` or `grep -q P <<<"$(producer)"`; when the producer's own
 * status is part of the contract, `v=$(producer) && grep -q P <<<"$v"`; for `grep -qv`,
 * `[ -n "$(producer | grep -v X)" ]` — a here-string of empty output is one empty line.
 *
 * ESCAPE. A comment `# sigpipe-safe: <rationale>` on the flagged line or the line directly above,
 * with a rationale of at least 20 characters saying why this producer cannot lose the race
 * (for example: it writes once, and less than a pipe buffer). A shorter rationale is itself a
 * finding.
 *
 * DECLARED LIMIT. `| head -1`, `| awk '{…; exit}'` and `| sed q` are early-exiting readers too, but
 * they are not gated: whether they hurt depends on whether anything reads the pipeline status
 * (`x=$(a | head -1)` under `set -e` aborts; `[ "$(a | head -1)" = y ]` does not), which this
 * line-level scan cannot tell. They were swept by hand on 2026-09-29: every site under `set -e` whose
 * status is not masked reads a file through grep/sed with a few lines of output — one stdio write at
 * exit, so no pending write to lose. Build-vs-reuse: prior-art-evaluations.md#291 (ShellCheck has no
 * rule for this; measured).
 *
 * Usage:
 *   node scripts/check-pipefail-early-exit.mjs              scan the whole population (git ls-files)
 *   node scripts/check-pipefail-early-exit.mjs FILE...      scan the given files that are in it
 *   node scripts/check-pipefail-early-exit.mjs --any FILE... scan the given files, population or not
 * Exit 0 clean, 1 findings, 2 usage/tool error.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const POPULATION = [
  /^install\.sh$/,
  /^setup\.d\/[^/]+\.sh$/,
  /^packages\/core\/audit-self\/[^/]+\.sh$/,
  /^\.claude\/hooks\/[^/]+\.sh$/,
  /^\.husky\/[^/_][^/]*$/,
  /^scripts\/[^/]+\.sh$/,
  /^scripts\/lib\/[^/]+\.sh$/,
  /^packages\/core\/hooks\/[^/]+\.sh$/,
  /^packages\/runtime-bridge\/scripts\/[^/]+\.sh$/,
  /^\.claude\/skills\/[^/]+\/helpers\/[^/]+\.sh$/,
  /^setup\.d\/companions\.manifest$/,
  /^tests\/install-sh\/[^/]+\.sh$/,
];
// Sourced by a parent that already runs under pipefail, so they inherit it without saying so.
// This gate's own paired-negative test: its fixture bodies are quoted strings written to temp
// files, so the offending lines it carries are data, not commands this script runs.
const EXCLUDED = new Set(['scripts/check-pipefail-early-exit.test.sh']);
const SOURCED_UNDER_PIPEFAIL = [/^setup\.d\/[^/]+\.sh$/];

const ESCAPE = /#\s*sigpipe-safe:(.*)$/;
const MIN_RATIONALE = 20;

export function inPopulation(rel) {
  return !EXCLUDED.has(rel) && POPULATION.some((re) => re.test(rel));
}

export function underPipefail(rel, text) {
  if (SOURCED_UNDER_PIPEFAIL.some((re) => re.test(rel))) return true;
  return /(^|[\s;&|(])set\s+(?:[-+][A-Za-z]+\s+)*-[A-Za-z]*o\s*pipefail\b/m.test(
    text,
  );
}

/** Index of the first unquoted `#` that starts a comment, or -1. */
function commentStart(line) {
  let sq = false;
  let dq = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && !sq) {
      i++;
      continue;
    }
    if (c === "'" && !dq) sq = !sq;
    else if (c === '"' && !sq) dq = !dq;
    else if (
      c === '#' &&
      !sq &&
      !dq &&
      (i === 0 || /[\s;&|(]/.test(line[i - 1]))
    )
      return i;
  }
  return -1;
}

/**
 * Words of `s` up to the end of the simple command (unquoted `|`, `;`, `&`, `)`, `}` or `<`/`>`).
 * Quotes are removed from each word; that is all the flag reader below needs.
 */
function commandWords(s) {
  const words = [];
  let cur = '';
  let has = false;
  let sq = false;
  let dq = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (sq) {
      if (c === "'") sq = false;
      else cur += c;
      continue;
    }
    if (dq) {
      if (c === '\\') {
        cur += s[++i] ?? '';
      } else if (c === '"') dq = false;
      else cur += c;
      continue;
    }
    if (c === "'") {
      sq = true;
      has = true;
    } else if (c === '"') {
      dq = true;
      has = true;
    } else if (c === '\\') {
      cur += s[++i] ?? '';
      has = true;
    } else if (/\s/.test(c)) {
      if (has) words.push(cur);
      cur = '';
      has = false;
    } else if (/[|;&)}<>]/.test(c)) {
      break;
    } else {
      cur += c;
      has = true;
    }
  }
  if (has) words.push(cur);
  return words;
}

const ARG_LETTERS = new Set(['e', 'f', 'm', 'A', 'B', 'C', 'd', 'D']);
const EARLY_LETTERS = new Set(['q', 'l', 'L', 'm']);
const EARLY_LONG =
  /^--(quiet|silent|files-with-matches|files-without-match|max-count(=.*)?)$/;

/** The early-exit option `words` (a grep command, grep itself first) carries, or null. */
export function earlyExitOption(words) {
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (w === '--') return null;
    if (w.startsWith('--')) {
      if (EARLY_LONG.test(w)) return w;
      continue;
    }
    if (w.startsWith('-') && w.length > 1) {
      for (let j = 1; j < w.length; j++) {
        const l = w[j];
        if (EARLY_LETTERS.has(l)) return `-${l}`;
        if (ARG_LETTERS.has(l)) {
          if (j === w.length - 1) i++; // the argument is the next word
          break;
        }
      }
    }
  }
  return null;
}

/** Positions of every unquoted pipe (`|` or `|&`, never `||`) in `code`. */
function pipePositions(code) {
  const out = [];
  let sq = false;
  let dq = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '\\' && !sq) {
      i++;
      continue;
    }
    if (c === "'" && !dq) sq = !sq;
    else if (c === '"' && !sq) dq = !dq;
    else if (c === '|' && !sq && !dq) {
      if (code[i + 1] === '|') {
        i++;
        continue;
      }
      out.push(i);
    }
  }
  return out;
}

/** The grep command right of a pipe at `pos`, if it has an early-exit option. */
function earlyGrepAfter(code, pos) {
  let rest = code.slice(pos + 1);
  if (rest.startsWith('&')) rest = rest.slice(1);
  const words = commandWords(rest);
  while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]))
    words.shift();
  if (words[0] === 'command') words.shift();
  if (!words.length || !/^(grep|egrep|fgrep)$/.test(words[0])) return null;
  const opt = earlyExitOption(words);
  return opt ? { opt } : null;
}

/** Logical lines of a script: continuations joined, heredoc bodies dropped, comments kept apart. */
export function logicalLines(text) {
  const phys = text.split('\n');
  const out = [];
  let heredoc = null;
  let acc = null;
  for (let n = 0; n < phys.length; n++) {
    const raw = phys[n];
    if (heredoc) {
      const body = heredoc.strip ? raw.replace(/^\t+/, '') : raw;
      if (body === heredoc.tag) heredoc = null;
      continue;
    }
    const cs = commentStart(raw);
    const code = cs === -1 ? raw : raw.slice(0, cs);
    const comment = cs === -1 ? '' : raw.slice(cs);
    if (!acc) acc = { line: n + 1, code: '', comments: [] };
    acc.comments.push(comment);
    const trimmed = code.replace(/\s+$/, '');
    const cont = /(^|[^\\])(\\\\)*\\$/.test(trimmed);
    acc.code += (cont ? trimmed.slice(0, -1) : code) + ' ';
    // A heredoc opened on this physical line starts right after it.
    const hd = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/.exec(code);
    if (hd && !/<<</.test(code.slice(hd.index, hd.index + 3))) {
      heredoc = { strip: hd[1] === '-', tag: hd[3] };
    }
    if (
      cont ||
      /(^|[^|])\|\s*$/.test(trimmed) ||
      /(&&|\|\|)\s*$/.test(trimmed)
    ) {
      if (!heredoc) continue;
    }
    out.push(acc);
    acc = null;
  }
  if (acc) out.push(acc);
  return out;
}

// setup.d/companions.manifest is TAB-separated data, but its detect_cmd column (field 2) is shell:
// setup.d/engine.sh runs it with `eval "$detect_cmd"`, and both of engine.sh's callers — install.sh
// and ./setup — run `set -euo pipefail`. Only that column is scanned; the rest of a row is data.
const MANIFEST = 'setup.d/companions.manifest';

function manifestAsScript(text) {
  return text
    .split('\n')
    .map((row) =>
      /^\s*(#|$)/.test(row) ? '' : (row.split('\t')[1] ?? '').trim(),
    )
    .join('\n');
}

/** Findings for one file's text. `rel` is only used for messages and the pipefail decision. */
export function scanText(rel, text) {
  if (rel === MANIFEST)
    return scanText(
      `${MANIFEST}#detect_cmd`,
      `set -o pipefail\n${manifestAsScript(text)}`,
    ).map((f) => ({ ...f, file: MANIFEST, line: f.line - 1 }));
  if (!underPipefail(rel, text)) return [];
  const findings = [];
  const phys = text.split('\n');
  for (const ll of logicalLines(text)) {
    const hits = pipePositions(ll.code)
      .map((p) => earlyGrepAfter(ll.code, p))
      .filter(Boolean);
    if (!hits.length) continue;
    const above = ll.line >= 2 ? phys[ll.line - 2] : '';
    const escapeSrc = [...ll.comments, /^\s*#/.test(above) ? above : ''];
    const esc = escapeSrc.map((c) => ESCAPE.exec(c)).find(Boolean);
    if (esc) {
      const why = esc[1].trim();
      if (why.length >= MIN_RATIONALE) continue;
      findings.push({
        file: rel,
        line: ll.line,
        msg: `sigpipe-safe rationale is ${why.length} chars, needs >= ${MIN_RATIONALE}`,
        code: ll.code.trim(),
      });
      continue;
    }
    findings.push({
      file: rel,
      line: ll.line,
      msg: `pipe into \`grep ${hits[0].opt}\` under pipefail`,
      code: ll.code.trim(),
    });
  }
  return findings;
}

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
}

function main(argv) {
  let any = false;
  const args = [];
  for (const a of argv) {
    if (a === '--any') any = true;
    else if (a === '-h' || a === '--help') {
      console.log(
        'usage: check-pipefail-early-exit.mjs [--any] [FILE...]  (no FILE: the whole population)',
      );
      return 0;
    } else args.push(a);
  }
  const root = repoRoot();
  let files;
  if (args.length) {
    files = args
      .map((f) => relative(root, resolve(f)).split('\\').join('/'))
      .filter((rel) => any || inPopulation(rel));
  } else {
    files = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean)
      .filter(inPopulation);
  }
  const findings = [];
  for (const rel of files) {
    let text;
    try {
      text = readFileSync(resolve(root, rel), 'utf8');
    } catch {
      continue; // deleted in the working tree: nothing left to scan
    }
    findings.push(...scanText(rel, text));
  }
  for (const f of findings) {
    const snippet = f.code.length > 160 ? `${f.code.slice(0, 157)}...` : f.code;
    console.log(`${f.file}:${f.line}: ${f.msg}\n    ${snippet}`);
  }
  if (findings.length) {
    console.log(
      `\n${findings.length} finding(s). Under pipefail an early-exiting grep can SIGPIPE the producer and flip the result.` +
        `\nFix: grep -q P <<<"$VAR" | grep -q P <<<"$(producer)" | v=$(producer) && grep -q P <<<"$v"` +
        `\n     (grep -qv X: [ -n "$(producer | grep -v X)" ]). Escape: # sigpipe-safe: <why, >= ${MIN_RATIONALE} chars>` +
        `\nSpec: header of scripts/check-pipefail-early-exit.mjs`,
    );
    return 1;
  }
  console.log(`✓ pipefail early-exit: ${files.length} file(s) clean`);
  return 0;
}

// Compare real paths: import.meta.url is resolved through symlinks, argv[1]
// is not, so a checkout reached through a symlinked directory would never
// run main() and would exit 0 with no output — a silent pass.
function isEntryPoint() {
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(process.argv[1] ?? '')
    );
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(
      `check-pipefail-early-exit: ${e instanceof Error ? e.message : e}`,
    );
    process.exit(2);
  }
}
