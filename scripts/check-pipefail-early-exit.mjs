#!/usr/bin/env node
/**
 * check-pipefail-early-exit — refuse a pipe into an early-exiting `grep` in a shell script that
 * runs under `set -o pipefail`, and a printf/echo into `head` / `sed q` / `awk exit` whose status
 * is read there.
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
 * THE EARLY-READER SHAPE (added 2026-09-29, after the post-merge CI of staging 2599f343c4c aborted an
 * install at `_r2_verdict="$(printf '%s\n' "$_r2_out" | head -1)"` in setup.d/eslint-wire.sh).
 * `| head`, `| sed …q` and `| awk '…exit…'` stop reading early too, but whether that hurts depends on
 * whether anything reads the pipeline status: `x=$(a | head -1)` under `set -e` aborts, and so does
 * a bare `a | head -5` statement; `[ "$(a | head -1)" = y ]`, `local x=$(…)` and `x=$(…) || true` do
 * not. So this shape fires only when (1) the command straight left of the reader is bash's own
 * `printf` or `echo` — they write once per line, so the race is live at any size; (2) the pipeline
 * is a top-level statement, or sits in a `$(…)` that a bare assignment statement holds; and (3) that
 * statement's status is read — the file runs under errexit, or the statement is an if / while /
 * `!` condition or part of an `&&` / `||` list — and is not masked by `|| true` / `|| :`.
 * Fix: `${v%%$'\n'*}` for the first line, `reader <<<"$v"` when the reader takes the text's trailing
 * newline as printf '%s\n' would, `reader < <(producer)` otherwise (the producer's status is then
 * not the pipeline's).
 *
 * DECLARED LIMIT. An external producer into an early reader (`grep P file | head -1`, `find | head
 * -1`) is not gated: it writes through stdio, one write for output below a pipe buffer, so it loses
 * the race only on large output — a judgement about the input this line-level scan cannot make.
 * Build-vs-reuse: prior-art-evaluations.md#291 (ShellCheck has no rule for this; measured).
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

/**
 * Walk `code` and call `visit(i)` at every position that is shell syntax rather than quoted text.
 * A `$(` opens a fresh quoting context even inside double quotes, so the pipe in
 * `echo "x: $(a | grep -m1 y)"` is syntax; the frame closes at its matching `)`.
 */
function forEachUnquoted(code, visit, frames = []) {
  const top = {
    sq: false,
    dq: false,
    parens: 0,
    start: -1,
    end: code.length,
    depth: 0,
  };
  frames.push(top);
  const stack = [top];
  for (let i = 0; i < code.length; i++) {
    const f = stack[stack.length - 1];
    const c = code[i];
    if (f.sq) {
      if (c === "'") f.sq = false;
      continue;
    }
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '$' && code[i + 1] === '(' && code[i + 2] !== '(') {
      const nf = {
        sq: false,
        dq: false,
        parens: 0,
        start: i,
        end: code.length,
        depth: stack.length,
      };
      frames.push(nf);
      stack.push(nf);
      i++;
      continue;
    }
    if (f.dq) {
      if (c === '"') f.dq = false;
      continue;
    }
    if (c === "'") f.sq = true;
    else if (c === '"') f.dq = true;
    else if (c === '(') f.parens++;
    else if (c === ')' && f.parens > 0) f.parens--;
    else if (c === ')' && stack.length > 1) stack.pop().end = i;
    else visit(i, f);
  }
  return frames;
}

/** Positions of every unquoted pipe (`|` or `|&`, never `||`) in `code`. */
function pipePositions(code) {
  const out = [];
  let skip = -1;
  forEachUnquoted(code, (i) => {
    if (i === skip || code[i] !== '|') return;
    if (code[i + 1] === '|') {
      skip = i + 1;
      return;
    }
    out.push(i);
  });
  return out;
}

/** The heredoc an unquoted `<<TAG` / `<<-'TAG'` in `code` opens, or null (`<<<` is a here-string). */
function heredocOpened(code) {
  let found = null;
  forEachUnquoted(code, (i) => {
    if (found || code[i] !== '<' || code[i + 1] !== '<' || code[i - 1] === '<')
      return;
    if (code[i + 2] === '<') return;
    const m = /^<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/.exec(code.slice(i));
    if (m) found = { strip: m[1] === '-', tag: m[3] };
  });
  return found;
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

// ── The early-reader shape: printf / echo into head, sed q or awk exit, with the status read ──
// bash's printf and echo write once per line (the defect above), so their pipe into a reader that
// stops early loses the race however short the text is; an external producer writes through stdio
// in one go below a pipe buffer, which is why it is left out (the declared limit in the header).

const KEYWORDS = new Set([
  'if',
  'elif',
  'while',
  'until',
  'then',
  'do',
  'else',
  '!',
  '{',
  'time',
]);
const DECLARERS = /^(local|export|declare|typeset|readonly)$/;
const ASSIGN_WORD = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;

/** `words` with leading keywords, env assignments and `command`/`builtin` dropped. */
function commandCore(words) {
  let i = 0;
  while (i < words.length && KEYWORDS.has(words[i])) i++;
  while (i < words.length && ASSIGN_WORD.test(words[i])) i++;
  while (i < words.length && /^(command|builtin)$/.test(words[i])) i++;
  return words.slice(i);
}

/** The early reader (`head`, `sed …q`, `awk …exit`) right of a pipe at `pos`, or null. */
export function earlyReaderAfter(code, pos) {
  let rest = code.slice(pos + 1);
  if (rest.startsWith('&')) rest = rest.slice(1);
  const w = commandCore(commandWords(rest));
  if (!w.length) return null;
  if (w[0] === 'head') return 'head';
  const scripts = [];
  let first = null;
  for (let i = 1; i < w.length; i++) {
    const a = w[i];
    if (w[0] === 'sed' && (a === '-e' || a === '--expression'))
      scripts.push(w[++i] ?? '');
    else if (w[0] === 'sed' && a.startsWith('--expression='))
      scripts.push(a.slice(13));
    else if (w[0] === 'awk' && /^-[Fvf]$/.test(a)) i++;
    else if (a.startsWith('-')) continue;
    else if (first === null) first = a;
  }
  if (!scripts.length && first !== null) scripts.push(first);
  if (
    w[0] === 'sed' &&
    scripts.some((sc) => /(^|[;{}\s0-9$/])q([\s;}0-9]|$)/.test(sc))
  )
    return 'sed q';
  if (w[0] === 'awk' && scripts.some((sc) => /\bexit\b/.test(sc)))
    return 'awk exit';
  return null;
}

/**
 * Early-reader findings in one logical line: a `printf`/`echo` piped straight into an early reader,
 * in a statement whose status something reads — a bare assignment of the substitution holding the
 * pipeline, or the pipeline itself as a statement — under errexit, as a condition (if / while /
 * `&&` / `||`), and not masked by `|| true` / `|| :` or a declaring builtin (local, export, …).
 */
export function earlyReaderHits(code, errexit) {
  const pipes = [];
  const bounds = []; // top-level statement boundaries: { at, len, op }
  const segStart = new Map(); // frame -> start of the current pipeline segment
  let skip = -1;
  const frames = forEachUnquoted(code, (i, f) => {
    if (i === skip) return;
    const c = code[i];
    const two = code.slice(i, i + 2);
    const topLevel = f.depth === 0 && f.parens === 0;
    if (two === '&&' || two === '||') {
      skip = i + 1;
      if (topLevel) bounds.push({ at: i, len: 2, op: two });
      segStart.set(f, i + 2);
    } else if (c === ';' || c === '&' || c === '\n') {
      if (topLevel) bounds.push({ at: i, len: 1, op: ';' });
      segStart.set(f, i + 1);
    } else if (c === '|') {
      pipes.push({
        at: i,
        frame: f,
        from: segStart.get(f) ?? (f.start < 0 ? 0 : f.start + 2),
      });
      segStart.set(f, i + 1);
    }
  });
  const hits = [];
  for (const p of pipes) {
    const reader = earlyReaderAfter(code, p.at);
    if (!reader) continue;
    const producer = commandCore(commandWords(code.slice(p.from, p.at)))[0];
    if (producer !== 'printf' && producer !== 'echo') continue;
    // The statement whose status matters: the pipe's own at top level, or the one holding its
    // substitution when that substitution is a direct child of the top level.
    let at;
    let after;
    if (p.frame.depth === 0) {
      if (p.frame.parens !== 0) continue;
      at = p.at;
      after = p.at;
    } else if (p.frame.depth === 1) {
      at = p.frame.start;
      after = p.frame.end;
    } else continue;
    const before = bounds.filter((b) => b.at < at).pop();
    const next = bounds.find((b) => b.at > after);
    const stmt = code.slice(
      before ? before.at + before.len : 0,
      next ? next.at : code.length,
    );
    const words = commandWords(stmt.replace(/\$\([^]*$/, ''));
    let k = 0;
    const cond = [];
    while (k < words.length && KEYWORDS.has(words[k])) cond.push(words[k++]);
    if (p.frame.depth === 1) {
      // Only a bare assignment returns the substitution's status: `NAME=…$(…)…` and nothing else.
      if (
        k >= words.length ||
        !ASSIGN_WORD.test(words[k]) ||
        DECLARERS.test(words[k])
      )
        continue;
      const tail = code.slice(p.frame.end + 1, next ? next.at : code.length);
      if (
        !/^["'}]*(\s+[A-Za-z_][A-Za-z0-9_]*\+?=\S*)*\s*(then|do)?\s*$/.test(
          tail,
        )
      )
        continue;
    }
    const nextText = next ? code.slice(next.at + next.len) : '';
    if (next?.op === '||' && /^\s*(true|:)\s*($|[;&|)}])/.test(nextText))
      continue;
    const isCond =
      cond.some((w) => /^(if|elif|while|until|!)$/.test(w)) ||
      before?.op === '&&' ||
      before?.op === '||' ||
      next?.op === '&&' ||
      next?.op === '||';
    if (!errexit && !isCond) continue;
    hits.push({ producer, reader });
  }
  return hits;
}

export function underErrexit(rel, text) {
  if (SOURCED_UNDER_PIPEFAIL.some((re) => re.test(rel))) return true;
  return /(^|[\s;&|(])set\s+(?:[-+][A-Za-z]+\s+)*(-[A-Za-z]*e[A-Za-z]*\b|-o\s*errexit\b)/m.test(
    text,
  );
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
    // A heredoc opened on this physical line starts right after it. Only an unquoted `<<` opens
    // one: `printf "cat <<'EOF'\n…"` is text, and reading it as a heredoc hid the rest of the file.
    const hd = heredocOpened(code);
    if (hd) heredoc = hd;
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
  const errexit = underErrexit(rel, text);
  const findings = [];
  const phys = text.split('\n');
  for (const ll of logicalLines(text)) {
    const hits = pipePositions(ll.code)
      .map((p) => earlyGrepAfter(ll.code, p))
      .filter(Boolean);
    const readers = earlyReaderHits(ll.code, errexit);
    if (!hits.length && !readers.length) continue;
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
      msg: hits.length
        ? `pipe into \`grep ${hits[0].opt}\` under pipefail`
        : `\`${readers[0].producer}\` piped into \`${readers[0].reader}\` where the status is read, under pipefail`,
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
      `\n${findings.length} finding(s). Under pipefail an early-exiting reader can SIGPIPE the producer and flip the result.` +
        `\nFix: grep -q P <<<"$VAR" | grep -q P <<<"$(producer)" | v=$(producer) && grep -q P <<<"$v"` +
        `\n     (grep -qv X: [ -n "$(producer | grep -v X)" ]). printf/echo into head / sed q / awk exit:` +
        `\n     \${v%%$'\\n'*} | reader <<<"$v" | reader < <(producer). Escape: # sigpipe-safe: <why, >= ${MIN_RATIONALE} chars>` +
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
