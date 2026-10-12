// Named-place resolver — docs single-source engine, slice S3 (E-1, E-2).
// Spec: docs/superpowers/specs/2026-10-01-docs-single-source-engine-design.md `:53`-`:55`
// (E-1 named place, E-2 signature, E-3 canonical form). Stage contract:
// .claude/orchestrator-prompts/docs-ssot-s3-resolver/kickoff.md §2.
//
// One module, `node:*` imports only (S4 consumes it as a source module via tsx; nothing
// in S3 wires it anywhere). Exports:
//   resolvePlace(ref, read?) — the four kinds `h:` `fn:` `jp:` `L:`; successes are
//     discriminated by `kind` (line-bearing kinds carry truthful startLine/endLine; `jp:`
//     omits both — JSON.parse supplies no positions and fabricated bounds are forbidden);
//     expected failures are VALUES `{ code: MISSING | AMBIGUOUS | UNSUPPORTED, message, ref }`,
//     never thrown, and there is NEVER a silent fallback to whole-file content.
//   canonicalJson(value) — recursively sorted object keys (arrays keep order), compact
//     stringify, no trailing newline. THE canonical form of E-1 `jp:` content and E-3's
//     lock file. Narrow form only (RFC 8785's key-sorting + compactness) — no JCS number
//     canonicalisation. NOT the pretty-print `canonicalJson` of
//     scripts/advisor-bridge-beta/store.mjs:46 (T-S3-C: that one does not sort keys).
//   signature(content) — sha256 hex after exactly two normalisations (E-2): CRLF→LF,
//     strip trailing spaces/tabs per line. No semantic normalisation: a reworded comment
//     IS a change the bound prose may depend on.
//
// Path admission runs BEFORE any read on every kind: an absolute path or one whose
// lexical normalisation escapes the repo root is refused UNSUPPORTED (same lexical
// admission as scripts/check-line-citations.mjs:529). The default reader additionally
// re-asserts containment after realpath (symlink escape → UNSUPPORTED). Diagnostics
// carry the ref only, never host-file content.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve as resolvePath, sep } from 'node:path';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A resolved place whose content is a line range: truthful 1-based inclusive bounds. */
export interface LinePlace {
  kind: 'h' | 'fn' | 'L';
  path: string;
  content: string;
  startLine: number;
  endLine: number;
}

/** A resolved JSON-pointer place: line bounds are unavailable and NEVER fabricated. */
export interface JsonPlace {
  kind: 'jp';
  path: string;
  content: string;
}

/** An expected failure, as a value. `message` carries the reason + the ref, never file content. */
export interface PlaceError {
  code: 'MISSING' | 'AMBIGUOUS' | 'UNSUPPORTED';
  message: string;
  ref: string;
}

export type PlaceResult = LinePlace | JsonPlace | PlaceError;

export type PlaceReader = (p: string) => string;

// ---------------------------------------------------------------------------
// Repo root + admission
// ---------------------------------------------------------------------------

// This module lives at <repoRoot>/packages/core/docs-engine/ — three levels up is the root.
const THIS_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolvePath(THIS_DIR, '..', '..', '..');
const REPO_ROOT_REAL = realpathSync(REPO_ROOT);

function err(code: PlaceError['code'], ref: string, reason: string): PlaceError {
  return { code, message: `${code}: ${reason} (ref: ${ref})`, ref };
}

/**
 * Lexical admission — every kind, before any read. `<path>` must be a relative POSIX
 * path whose normalisation stays inside the repo root. Returns the normalised path or
 * an UNSUPPORTED error. The same admission applies to the injected-`read` route: an
 * absolute or escaping path never reaches the reader.
 */
function admitPath(raw: string, ref: string): string | PlaceError {
  if (raw === '') return err('UNSUPPORTED', ref, 'empty <path>');
  if (isAbsolute(raw)) return err('UNSUPPORTED', ref, 'absolute <path> — must be a repo-relative POSIX path');
  // Backslashes are not POSIX separators; on a Windows reader (or any backslash-
  // interpreting reader) `..\x` escapes the root. Refused BEFORE the reader is ever
  // invoked — the default reader's realpath check cannot protect the injected route
  // (review 4242549882).
  if (raw.includes('\\')) return err('UNSUPPORTED', ref, '<path> contains a backslash — must be a repo-relative POSIX path');
  const norm = posix.normalize(raw);
  if (norm === '' || norm === '.' || norm === '..' || norm.startsWith('../')) {
    return err('UNSUPPORTED', ref, '<path> escapes the repo root');
  }
  return norm;
}

interface ReadResult {
  ok: true;
  content: string;
}

/** Read an admitted path through the injected reader (pure core) or the default fs reader. */
function readAdmitted(rel: string, read: PlaceReader | undefined, ref: string): ReadResult | PlaceError {
  if (read) {
    try {
      return { ok: true, content: read(rel) };
    } catch (e) {
      return err('MISSING', ref, `cannot read <path>: ${(e as Error).message}`);
    }
  }
  const abs = resolvePath(REPO_ROOT, rel);
  let real: string;
  try {
    real = realpathSync(abs);
  } catch {
    return err('MISSING', ref, `file not found at <path>`);
  }
  // Filesystem escape through symlinks: re-assert containment after realpath.
  if (real !== REPO_ROOT_REAL && !real.startsWith(REPO_ROOT_REAL + sep)) {
    return err('UNSUPPORTED', ref, '<path> resolves outside the repo root through a symlink');
  }
  try {
    return { ok: true, content: readFileSync(real, 'utf8') };
  } catch (e) {
    return err('MISSING', ref, `cannot read <path>: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// signature (E-2) + canonicalJson (E-3 / E-1 jp:)
// ---------------------------------------------------------------------------

/** sha256 hex over CRLF→LF + per-line trailing spaces/tabs stripped, joined with `\n`. */
export function signature(content: string): string {
  const lf = content.replace(/\r\n/g, '\n');
  const stripped = lf
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n');
  return createHash('sha256').update(stripped, 'utf8').digest('hex');
}

/**
 * Recursively sorted object keys (arrays keep order), compact `JSON.stringify`, no
 * trailing newline. Mirrors the RFC 8785 (JCS) reference canonicalizer's object/array
 * handling (cyberphone/json-canonicalization) minus its number canonicalisation —
 * E-3 names the narrow form only. Default JS `.sort()` orders by UTF-16 code units,
 * which is exactly JCS's member ordering.
 */
export function canonicalJson(value: unknown): string {
  return serializeCanonical(value);
}

function serializeCanonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(serializeCanonical).join(',')}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${serializeCanonical((v as Record<string, unknown>)[k])}`);
  return `{${parts.join(',')}}`;
}

// ---------------------------------------------------------------------------
// Grammar
// ---------------------------------------------------------------------------

/**
 * `<path>#<kind>:<name>` for h / fn / jp; `<path>:NN` or `<path>:NN-MM` for L — 1-based,
 * so NN ≥ 1 (`[1-9][0-9]*`): a `:0` / `:0-N` ref names no line and refuses UNSUPPORTED
 * rather than resolving a fabricated empty place (rework finding 25d5a4352292).
 * `jp:` with an EMPTY name is valid — the RFC 6901 empty pointer (whole document).
 * Grammar refusals are UNSUPPORTED, never MISSING.
 */
function parseRef(ref: string): { kind: 'h' | 'fn' | 'jp' | 'L'; path: string; name: string; start?: number; end?: number } | PlaceError {
  if (typeof ref !== 'string' || ref.length === 0) return err('UNSUPPORTED', String(ref), 'empty ref');
  const hash = ref.indexOf('#');
  if (hash !== -1) {
    const rawPath = ref.slice(0, hash);
    const rest = ref.slice(hash + 1);
    const colon = rest.indexOf(':');
    if (colon === -1) return err('UNSUPPORTED', ref, 'no <kind>: token after `#`');
    const kind = rest.slice(0, colon);
    const name = rest.slice(colon + 1);
    if (kind !== 'h' && kind !== 'fn' && kind !== 'jp') {
      return err('UNSUPPORTED', ref, `unknown kind token '${kind}'`);
    }
    if ((kind === 'h' || kind === 'fn') && name === '') {
      return err('UNSUPPORTED', ref, `empty <name> for '${kind}:'`);
    }
    return { kind, path: rawPath, name };
  }
  const m = /^(.*):([1-9][0-9]*)(?:-([1-9][0-9]*))?$/.exec(ref);
  if (!m) return err('UNSUPPORTED', ref, 'expected <path>:NN or <path>:NN-MM (1-based, NN ≥ 1), or <path>#<kind>:<name>');
  const start = Number.parseInt(m[2], 10);
  const end = m[3] !== undefined ? Number.parseInt(m[3], 10) : start;
  if (end < start) return err('UNSUPPORTED', ref, `line range ${start}-${end} has NN > MM`);
  return { kind: 'L', path: m[1], name: m[0], start, end };
}

/**
 * Resolve one named place. The injected `read` keeps the core pure and fixture-testable;
 * by default repo-relative POSIX paths resolve from the repo root.
 */
export function resolvePlace(ref: string, read?: PlaceReader): PlaceResult {
  const parsed = parseRef(ref);
  if ('code' in parsed) return parsed;

  const admitted = admitPath(parsed.path, ref);
  if (typeof admitted !== 'string') return admitted;
  const rel = admitted;

  // Parked languages (engine spec q5): `fn:` for python/cargo/go is deferred until a
  // consumer asks — a new kind is additive, so this refusal never blocks one. The
  // binder falls back to `L:`.
  if (parsed.kind === 'fn' && /\.(py|rs|go)$/i.test(rel)) {
    return err('UNSUPPORTED', ref, `fn: for ${rel.replace(/^.*\./, '').toLowerCase()} is parked (spec q5) — bind code by L:`);
  }

  const file = readAdmitted(rel, read, ref);
  if (!('ok' in file) || file.ok !== true) {
    const e = file as PlaceError;
    return e.code === 'UNSUPPORTED' ? e : err('MISSING', ref, e.message.replace(/^MISSING: /, '').replace(/ \(ref: .*\)$/, ''));
  }
  const content = file.content;

  if (parsed.kind === 'L') {
    return resolveLines(content, parsed.start as number, parsed.end as number, rel, ref);
  }
  if (parsed.kind === 'jp') {
    return resolveJsonPointer(content, parsed.name, rel, ref);
  }
  if (parsed.kind === 'h') {
    return resolveHeading(content, parsed.name, rel, ref);
  }
  return resolveFunction(content, parsed.name, rel, ref);
}

/**
 * Split file content into physical lines. Two subtleties every kind's line arithmetic
 * (and the EOF section bound) build on:
 * - CRLF is ONE terminator: a `\r` immediately before `\n` belongs to the line ending,
 *   not the line content — so a Windows-checkout and an LF checkout of the same file
 *   yield the IDENTICAL line sequence (§7 row 1's identical-signature requirement holds
 *   for the final line of a section too, where a lone trailing `\r` would otherwise
 *   survive `signature`'s CRLF→LF pass). A lone `\r` NOT before `\n` stays in content.
 * - `split('\n')` yields a phantom trailing `''` element for files ending in a newline —
 *   that phantom is NOT a line and is dropped: `'a\nb\n'` is 2 lines, `''` is 0 lines,
 *   `'\n'` is 1 (empty) line.
 */
function splitLines(content: string): string[] {
  const lines = content.split(/\r\n|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function resolveLines(content: string, start: number, end: number, rel: string, ref: string): PlaceResult {
  const lines = splitLines(content);
  if (start > lines.length || end > lines.length) {
    return err('MISSING', ref, `line range ${start}-${end} beyond EOF (${lines.length} lines)`);
  }
  return { kind: 'L', path: rel, content: lines.slice(start - 1, end).join('\n'), startLine: start, endLine: end };
}

// ---------------------------------------------------------------------------
// jp: — RFC 6901 JSON pointer
// ---------------------------------------------------------------------------

/**
 * Decode one reference token per RFC 6901 §4: `~1` → `/` FIRST, then `~0` → `~`
 * (so `~01` names the member `~1`, never `/`). A `~` not followed by `0`/`1` is an
 * illegal reference → UNSUPPORTED.
 */
function decodePointerToken(raw: string): string | null {
  if (/~[^01]/.test(raw) || raw.endsWith('~')) return null;
  return raw.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveJsonPointer(content: string, pointer: string, rel: string, ref: string): PlaceResult {
  let doc: unknown;
  try {
    doc = JSON.parse(content) as unknown;
  } catch {
    // Stable reason only — Node's JSON.parse message can embed an excerpt of the
    // parsed text (review 4242549887), and the diagnostic contract carries the ref,
    // never file contents.
    return err('MISSING', ref, 'file does not parse as JSON (JSONC/comments unsupported)');
  }
  // Empty pointer = the whole document. `/` = ONE token, the empty string = the root
  // object's member named "" (RFC 6901 §4) — never the document itself.
  const rawTokens = pointer === '' ? [] : pointer.startsWith('/') ? pointer.slice(1).split('/') : null;
  if (rawTokens === null) {
    return err('UNSUPPORTED', ref, 'non-empty JSON pointer must start with `/`');
  }
  let cur: unknown = doc;
  for (const raw of rawTokens) {
    const token = decodePointerToken(raw);
    if (token === null) return err('UNSUPPORTED', ref, `malformed escape in pointer token '${raw}'`);
    if (Array.isArray(cur)) {
      // A token applied to an array must be a decimal index with NO leading zeros;
      // `-` (a JSON Patch notion) is illegal here. Illegal → UNSUPPORTED; valid but
      // beyond the last element → MISSING.
      if (!/^(0|[1-9][0-9]*)$/.test(token)) {
        return err('UNSUPPORTED', ref, `token '${token}' is not a legal array index`);
      }
      const idx = Number.parseInt(token, 10);
      if (idx >= cur.length) return err('MISSING', ref, `array index ${idx} beyond last element`);
      cur = cur[idx];
      continue;
    }
    if (cur !== null && typeof cur === 'object') {
      const obj = cur as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(obj, token)) {
        return err('MISSING', ref, `no member named '${token}'`);
      }
      cur = obj[token];
      continue;
    }
    // Legal reference, evaluation cannot continue: a token applied to a scalar/null.
    return err('MISSING', ref, `pointer descends into a scalar at token '${token}'`);
  }
  return { kind: 'jp', path: rel, content: canonicalJson(cur) };
}

// ---------------------------------------------------------------------------
// h: — markdown headings (ATX + setext), fence-aware, github-slugger dedup
// ---------------------------------------------------------------------------

// Ported verbatim from packages/core/principles/42-context-md-pointer-rule.test.ts:158-170
// (slugify — GitHub's anchor text transformation; arm-c3 fixture shapes apply, runs are
// NOT collapsed: `a + b` → `a--b`). No shared-module extraction — two-file scope.
function slugify(headingText: string): string {
  return headingText
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // link → its text
    .replace(/[`*~]/g, '')
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2') // _emphasis_ → emphasis
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

interface HeadingHit {
  slug: string;
  level: number;
  startLine: number; // 1-based, first text line for setext
  endLine: number; // 1-based, the underline for setext
}

/**
 * Fence-aware scan for both GitHub heading forms. ATX: `^ {0,3}#{1,6} ` (levels 1-6).
 * Setext (CommonMark 0.31.2 §4.3): a paragraph of one or more consecutive non-blank
 * text lines immediately followed by `^ {0,3}=+$` (level 1) or `^ {0,3}-+$` (level 2);
 * the slug is computed over the text lines JOINED with a single space, and startLine is
 * the FIRST text line. A `#` or underline inside a fenced code block is not a heading.
 *
 * Dedup is github-slugger's collision-aware EMITTED-slug dedup (NOT principle 42's
 * collectAnchors base-slug counter, whose per-base counter emits `alpha-1` twice for
 * `Alpha`/`Alpha-1`/`Alpha`): occurrence uniqueness is tracked on the emitted slug, and
 * a taken candidate gets `-<n>` (n from 1), incrementing until unused — `alpha` /
 * `alpha-1` / `alpha-2`. Upstream source (Flet/github-slugger index.js) was unreachable
 * from this sandbox (context7/deepwiki unindexed; raw fetches blocked) — the S3 kickoff
 * §1/§7.6 pins this emitted-slug contract and its fixtures.
 */
function scanHeadings(lines: string[]): HeadingHit[] {
  const out: HeadingHit[] = [];
  const used = new Set<string>();
  let inFence = false;
  let fenceChar = '`';
  let fenceLen = 3;
  let paraStart = -1; // 0-based index of the pending paragraph's first line
  const paraText: string[] = [];

  const flushPara = (): void => {
    paraStart = -1;
    paraText.length = 0;
  };
  const emit = (base: string, level: number, startLine: number, endLine: number): void => {
    if (base === '') {
      // Empty-slug headings stay unaddressable (principle 42's convention) but REMAIN
      // section boundaries (review 4242549903): an `h:` section ends at the next
      // heading of the same or higher level even when that heading's slug is empty.
      // Recorded without dedup bookkeeping — lookup can never request an empty slug
      // (parseRef refuses an empty <name> for h:).
      out.push({ slug: '', level, startLine, endLine });
      return;
    }
    let slug = base;
    if (used.has(slug)) {
      let n = 1;
      do {
        slug = `${base}-${n}`;
        n += 1;
      } while (used.has(slug));
    }
    used.add(slug);
    out.push({ slug, level, startLine, endLine });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inFence) {
      // CommonMark: the closing fence is the same character, at least the opener's
      // length (review 4242549876 — a 4-backtick close MUST close a 3-backtick open,
      // else every later heading is ignored).
      if (new RegExp(`^ {0,3}\\${fenceChar}{${fenceLen},}\\s*$`).test(line)) inFence = false;
      flushPara();
      continue;
    }
    const fenceOpen = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceOpen) {
      inFence = true;
      fenceChar = fenceOpen[1][0];
      fenceLen = fenceOpen[1].length;
      flushPara();
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushPara();
      continue;
    }
    const atx = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (atx) {
      flushPara();
      emit(slugify(atx[2]), atx[1].length, i + 1, i + 1);
      continue;
    }
    // Non-paragraph constructs (review 4242549900): only real Markdown paragraph text
    // may accumulate as Setext heading text. List items, block quotes, indented code,
    // HTML blocks/comments, and dash-free thematic breaks interrupt — they flush the
    // pending paragraph and never join it, so `- item\n---` emits no phantom heading.
    // A `-+` run is deliberately NOT here: it may be a genuine Setext underline for
    // the pending paragraph and is handled by the underline branch below.
    const isNonParagraph =
      /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/.test(line) || // list item
      /^ {0,3}>/.test(line) || // block quote
      /^(?: {4}|\t)/.test(line) || // indented code
      /^ {0,3}</.test(line) || // HTML block / comment opener
      /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line); // thematic break, not `-`
    if (isNonParagraph) {
      flushPara();
      continue;
    }
    const underline = /^ {0,3}(=+|-+)\s*$/.exec(line);
    if (underline) {
      if (paraStart >= 0) {
        // Setext: ALL text lines plus the underline belong to the heading.
        const level = underline[1][0] === '=' ? 1 : 2;
        emit(slugify(paraText.join(' ')), level, paraStart + 1, i + 1);
        flushPara();
        continue;
      }
      if (underline[1][0] === '-') {
        flushPara(); // thematic break, not a heading
        continue;
      }
      // A lone `=` line is ordinary paragraph text.
    }
    if (paraStart < 0) {
      paraStart = i;
      paraText.length = 0;
    }
    paraText.push(line);
  }
  return out;
}

function resolveHeading(content: string, slug: string, rel: string, ref: string): PlaceResult {
  const lines = splitLines(content);
  const headings = scanHeadings(lines);
  const hit = headings.find((h) => h.slug === slug);
  if (!hit) return err('MISSING', ref, `no markdown heading with slug '${slug}'`);
  // Emitted slugs are unique by construction, so `h:` never returns AMBIGUOUS.
  let endLine = lines.length;
  for (const other of headings) {
    if (other.startLine > hit.endLine && other.level <= hit.level) {
      endLine = other.startLine - 1;
      break;
    }
  }
  return {
    kind: 'h',
    path: rel,
    content: lines.slice(hit.startLine - 1, endLine).join('\n'),
    startLine: hit.startLine,
    endLine,
  };
}

// ---------------------------------------------------------------------------
// fn: — shell + JS/TS top-level functions, column-0 close, region-aware
// ---------------------------------------------------------------------------

interface FnCarrier {
  re: RegExp; // capture 1 = the function name; requires the body `{` on the same line
  lang: 'shell' | 'js';
}

const FN_CARRIERS: FnCarrier[] = [
  { re: /^([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*\{/, lang: 'shell' }, // POSIX: name() {
  { re: /^function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/, lang: 'shell' }, // ksh: function name {
  { re: /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)[^;]*\{/, lang: 'js' },
  { re: /^(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?\([^)]*\)[^;]*\{/, lang: 'js' },
];

type CloseScan = { closeLine: number } | 'inline' | 'eof';

interface HeredocStart {
  term: string;
  dash: boolean;
  len: number; // characters of `line` consumed by operator + delimiter
}

/** Classify `line` at column `c` (where `line[c] === '<' && line[c + 1] === '<'`): a
 *  heredoc declaration `<<[-] TERM` returns its start; anything else (operator not
 *  followed by a delimiter) returns null. A `<<<` HERE-STRING is an operator whose
 *  word is an ARGUMENT, never a delimiter — a `<` adjacent on either side
 *  disqualifies (review 4242549892: without this, the scan re-enters on the second
 *  `<` of `<<<` and records `"$value"` as a heredoc terminator that never arrives,
 *  swallowing the function's real column-0 close). Shared by the fn: close scanner
 *  and the discovery pre-scan so both agree on what opens a heredoc. */
function shellHeredocStart(line: string, c: number): HeredocStart | null {
  if (line[c - 1] === '<' || line[c + 2] === '<') return null; // `<<<` here-string
  const heredoc = /^<<(-?)\s*(?:'([^']*)'|"([^"]*)"|([A-Za-z_][A-Za-z0-9_]*))/.exec(line.slice(c));
  if (!heredoc) return null;
  return { dash: heredoc[1] === '-', term: heredoc[2] ?? heredoc[3] ?? heredoc[4], len: heredoc[0].length };
}

/**
 * Shell body scanner from just after the opener's `{`. Tracks single/double-quoted
 * strings, `#` comments (only outside `${…}` expansions), and heredocs — so a `}` at
 * column 0 inside any of those regions does NOT close (T-S3-B). The close is the
 * SYNTACTIC `}` at column 0. A `}` in normal context mid-line is an INLINE close —
 * the valid ksh one-liner shape (P16) — which is REFUSED: never scanned past, never
 * reported MISSING for a function that exists.
 */
function scanShellClose(lines: string[], startIdx: number, afterCol: number): CloseScan {
  let state: 'code' | 'sq' | 'dq' | 'comment' = 'code';
  let paramDepth = 0; // inside ${…}
  let groupDepth = 0; // inside a nested `{ … }` brace group in the body — its `}`
  // closes the GROUP, never the function (review 4242549870: real repo functions
  // use `{ echo …; }` groups; their closes must not read as inline one-liner ends)
  let heredocTerm: string | null = null;
  let heredocDash = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (heredocTerm !== null) {
      const candidate = heredocDash ? line.replace(/^\t+/, '') : line;
      if (candidate === heredocTerm) heredocTerm = null;
      continue;
    }
    const startCol = i === startIdx ? afterCol : 0;
    for (let c = startCol; c < line.length; c++) {
      const ch = line[c];
      if (state === 'comment') continue; // ends with the line
      if (state === 'sq') {
        if (ch === '\\') c += 1;
        else if (ch === "'") state = 'code';
        continue;
      }
      if (state === 'dq') {
        if (ch === '\\') c += 1;
        else if (ch === '"') state = 'code';
        continue;
      }
      // code state
      if (ch === '\\') {
        c += 1;
        continue;
      }
      if (ch === "'") {
        state = 'sq';
        continue;
      }
      if (ch === '"') {
        state = 'dq';
        continue;
      }
      if (ch === '#' && paramDepth === 0) {
        state = 'comment';
        continue;
      }
      if (ch === '$' && line[c + 1] === '{') {
        paramDepth += 1;
        c += 1;
        continue;
      }
      if (ch === '{') {
        groupDepth += 1;
        continue;
      }
      if (ch === '<' && line[c + 1] === '<') {
        const heredoc = shellHeredocStart(line, c);
        if (heredoc) {
          heredocDash = heredoc.dash;
          heredocTerm = heredoc.term;
          c += heredoc.len - 1;
          continue;
        }
      }
      if (ch === '}') {
        if (paramDepth > 0) {
          paramDepth -= 1;
          continue;
        }
        if (groupDepth > 0) {
          groupDepth -= 1; // closes a nested brace group, not the function
          continue;
        }
        if (c === 0) return { closeLine: i + 1 };
        return 'inline'; // mid-line normal-context `}` — the inline one-liner close
      }
    }
    if (state === 'comment') state = 'code';
  }
  return 'eof';
}

// Expression-position keywords after which a `/` opens a literal, not a division.
const JS_REGEX_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await',
]);

/** Heuristic: can a `/` at this context open a regex literal (vs divide)? A literal is
 *  expected after nothing significant yet (region start), after value-position
 *  punctuation, or after an expression-position keyword. Conservative on purpose:
 *  ambiguous contexts (`)`, `]`, `}`, prefix `+`/`-`, a previous `/`) resolve to
 *  DIVISION, whose misreads cost nothing (a slash pair can never swallow a brace);
 *  the covered set is chosen so every common literal position (`= /re/`, `( /re/`,
 *  `: /re/`, `return /re/`, `&& /re/`) resolves to LITERAL (review 4242549898). */
function jsRegexCanStart(sigChar: string, sigWord: string, sigWordIsMember: boolean): boolean {
  if (sigChar === '') return true; // nothing significant seen yet
  if (/[A-Za-z0-9_$]/.test(sigChar)) return !sigWordIsMember && JS_REGEX_KEYWORDS.has(sigWord);
  return '=([{;,!&|?:'.includes(sigChar);
}

// Both JS scans consume the same regex body, starting AFTER its opening slash.
// Inspect the first body character too: it may open a class or escape a slash.
function scanJsRegexEnd(line: string, opening: number): number {
  let inClass = false;
  for (let c = opening + 1; c < line.length; c++) {
    const ch = line[c];
    if (ch === '\\') c += 1;
    else if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return c;
  }
  // Regex literals cannot span lines. An invalid unterminated literal consumes
  // this line only, preserving the existing close scanner's end-of-line reset.
  return line.length;
}

/**
 * JS/TS body scanner from just after the opener's `{`. Tracks line/block comments,
 * single/double-quoted strings, and template literals with `${…}` nesting — so a `}`
 * at column 0 inside a template literal or comment does NOT close (T-S3-B). Also
 * tracks regex literals (review 4242549898): a `/` in literal position consumes the
 * body through its unescaped, non-class `/`, so punctuation inside it (`/}/`, `/[/}]/`)
 * never touches the brace depth. Entering
 * `${` SPENDS its `{` in `depth` (the frame records the pre-entry depth), so the
 * interpolation's closing `}` lands exactly ON the frame's depth — it pops the frame
 * and returns to template state, never reading as the function's close. The close is
 * the depth-returning `}` at column 0; a mid-line close is refused (same never-scan-
 * past rule as the shell scanner).
 */
function scanJsClose(lines: string[], startIdx: number, afterCol: number): CloseScan {
  type Frame = { kind: 'template'; depth: number };
  const stack: Frame[] = [];
  let depth = 1; // the function's own opening brace
  let state: 'code' | 'sq' | 'dq' | 'linecomment' | 'blockcomment' | 'template' = 'code';
  let sigChar = ''; // last significant code-state char (regex-vs-division context)
  let sigWord = ''; // the identifier ending at sigChar, '' if sigChar is not one
  let sigWordIsMember = false; // a keyword after `.` is a property, not a regex introducer

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const startCol = i === startIdx ? afterCol : 0;
    for (let c = startCol; c < line.length; c++) {
      const ch = line[c];
      if (state === 'linecomment') continue; // ends with the line
      if (state === 'blockcomment') {
        if (ch === '*' && line[c + 1] === '/') {
          state = 'code';
          c += 1;
        }
        continue;
      }
      if (state === 'sq') {
        if (ch === '\\') c += 1;
        else if (ch === "'") state = 'code';
        continue;
      }
      if (state === 'dq') {
        if (ch === '\\') c += 1;
        else if (ch === '"') state = 'code';
        continue;
      }
      if (state === 'template') {
        if (ch === '\\') c += 1;
        else if (ch === '`') state = 'code';
        else if (ch === '$' && line[c + 1] === '{') {
          stack.push({ kind: 'template', depth });
          depth += 1; // the interpolation's `{` is a real brace level: without this,
          // its closing `}` underflows depth and can read as the function's close
          state = 'code';
          c += 1;
        }
        continue;
      }
      // code state
      if (ch === '/' && line[c + 1] === '/') {
        state = 'linecomment';
        c += 1;
        continue;
      }
      if (ch === '/' && line[c + 1] === '*') {
        state = 'blockcomment';
        c += 1;
        continue;
      }
      if (ch === '/') {
        if (jsRegexCanStart(sigChar, sigWord, sigWordIsMember)) {
          c = scanJsRegexEnd(line, c);
        }
        sigChar = '/'; // regex end or division: no brace effect
        sigWord = '';
        sigWordIsMember = false;
        continue;
      }
      if (/[A-Za-z0-9_$]/.test(ch)) {
        if (/[A-Za-z0-9_$]/.test(sigChar)) sigWord += ch;
        else {
          sigWord = ch;
          sigWordIsMember = sigChar === '.';
        }
        sigChar = ch;
        continue;
      }
      if (!/\s/.test(ch)) {
        sigChar = ch;
        sigWord = '';
        sigWordIsMember = false;
      }
      if (ch === "'") {
        state = 'sq';
        continue;
      }
      if (ch === '"') {
        state = 'dq';
        continue;
      }
      if (ch === '`') {
        state = 'template';
        continue;
      }
      if (ch === '{') {
        depth += 1;
        continue;
      }
      if (ch === '}') {
        depth -= 1;
        // Landing back ON the top frame's depth ⇒ this `}` closes the `${…}` that
        // pushed the frame (entering spent the `{`; the frame recorded the pre-entry
        // depth). Anything else is a plain code brace.
        if (stack.length > 0 && depth === stack[stack.length - 1].depth) {
          stack.pop();
          state = 'template'; // back inside the enclosing template literal
          continue;
        }
        if (depth === 0) {
          return c === 0 ? { closeLine: i + 1 } : 'inline';
        }
      }
    }
    if (state === 'linecomment') state = 'code';
  }
  return 'eof';
}

/**
 * Per-line lexical context for fn: DISCOVERY (contrast: the close scanners above run
 * from inside a known function body). Returns one boolean per line: a carrier regex
 * match on that line counts as a top-level match ONLY when the line STARTS in top-level
 * code for its language — never inside a comment, quoted string, template literal,
 * heredoc, or (JS) a nested scope (review 4242549866: `/*…*` comment bodies and
 * template literals otherwise contribute phantom carriers, and one phantom beside a
 * real function turns it spuriously AMBIGUOUS).
 *
 * JS: full state machine mirroring scanJsClose from file start (top-level = code state,
 * no open `${…}` template frame, brace depth 0). Shell: mirrors scanShellClose from
 * file start (top-level = code state, no open heredoc, no open `${…}`) — without brace
 * depth, because nested shell functions are legitimate top-level definitions.
 */
function jsLineStartsTopLevel(lines: string[]): boolean[] {
  type Frame = { depth: number };
  const stack: Frame[] = [];
  let depth = 0;
  let state: 'code' | 'sq' | 'dq' | 'linecomment' | 'blockcomment' | 'template' = 'code';
  let sigChar = '';
  let sigWord = '';
  let sigWordIsMember = false;
  const out: boolean[] = [];
  for (const line of lines) {
    out.push(state === 'code' && stack.length === 0 && depth === 0);
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (state === 'linecomment') continue; // ends with the line
      if (state === 'blockcomment') {
        if (ch === '*' && line[c + 1] === '/') {
          state = 'code';
          c += 1;
        }
        continue;
      }
      if (state === 'sq') {
        if (ch === '\\') c += 1;
        else if (ch === "'") state = 'code';
        continue;
      }
      if (state === 'dq') {
        if (ch === '\\') c += 1;
        else if (ch === '"') state = 'code';
        continue;
      }
      if (state === 'template') {
        if (ch === '\\') c += 1;
        else if (ch === '`') state = 'code';
        else if (ch === '$' && line[c + 1] === '{') {
          stack.push({ depth });
          depth += 1;
          state = 'code';
          c += 1;
        }
        continue;
      }
      if (ch === '/' && line[c + 1] === '/') {
        state = 'linecomment';
        c += 1;
        continue;
      }
      if (ch === '/' && line[c + 1] === '*') {
        state = 'blockcomment';
        c += 1;
        continue;
      }
      if (ch === '/') {
        if (jsRegexCanStart(sigChar, sigWord, sigWordIsMember)) c = scanJsRegexEnd(line, c);
        sigChar = '/';
        sigWord = '';
        sigWordIsMember = false;
        continue;
      }
      if (/[A-Za-z0-9_$]/.test(ch)) {
        if (/[A-Za-z0-9_$]/.test(sigChar)) sigWord += ch;
        else {
          sigWord = ch;
          sigWordIsMember = sigChar === '.';
        }
        sigChar = ch;
        continue;
      }
      if (!/\s/.test(ch)) {
        sigChar = ch;
        sigWord = '';
        sigWordIsMember = false;
      }
      if (ch === "'") {
        state = 'sq';
        continue;
      }
      if (ch === '"') {
        state = 'dq';
        continue;
      }
      if (ch === '`') {
        state = 'template';
        continue;
      }
      if (ch === '{') {
        depth += 1;
        continue;
      }
      if (ch === '}') {
        depth -= 1;
        if (stack.length > 0 && depth === stack[stack.length - 1].depth) {
          stack.pop();
          state = 'template';
          continue;
        }
        if (depth < 0) depth = 0; // a stray close must not poison later line starts
      }
    }
    if (state === 'linecomment') state = 'code';
  }
  return out;
}

function shellLineStartsTopLevel(lines: string[]): boolean[] {
  const out: boolean[] = [];
  let state: 'code' | 'sq' | 'dq' | 'comment' = 'code';
  let paramDepth = 0; // inside ${…}
  let heredocTerm: string | null = null;
  let heredocDash = false;
  for (const line of lines) {
    out.push(state === 'code' && heredocTerm === null && paramDepth === 0);
    if (heredocTerm !== null) {
      const candidate = heredocDash ? line.replace(/^\t+/, '') : line;
      if (candidate === heredocTerm) heredocTerm = null;
      continue;
    }
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (state === 'comment') continue; // ends with the line
      if (state === 'sq') {
        if (ch === '\\') c += 1;
        else if (ch === "'") state = 'code';
        continue;
      }
      if (state === 'dq') {
        if (ch === '\\') c += 1;
        else if (ch === '"') state = 'code';
        continue;
      }
      if (ch === '\\') {
        c += 1;
        continue;
      }
      if (ch === "'") {
        state = 'sq';
        continue;
      }
      if (ch === '"') {
        state = 'dq';
        continue;
      }
      if (ch === '#' && paramDepth === 0) {
        state = 'comment';
        continue;
      }
      if (ch === '$' && line[c + 1] === '{') {
        paramDepth += 1;
        c += 1;
        continue;
      }
      if (ch === '<' && line[c + 1] === '<') {
        const heredoc = shellHeredocStart(line, c);
        if (heredoc) {
          heredocDash = heredoc.dash;
          heredocTerm = heredoc.term;
          c += heredoc.len - 1;
          continue;
        }
      }
      if (ch === '}' && paramDepth > 0) {
        paramDepth -= 1;
      }
    }
    if (state === 'comment') state = 'code';
  }
  return out;
}

function resolveFunction(content: string, name: string, rel: string, ref: string): PlaceResult {
  const lines = splitLines(content);
  const matches: Array<{ lineIdx: number; lang: 'shell' | 'js'; afterCol: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    for (const carrier of FN_CARRIERS) {
      const m = carrier.re.exec(lines[i]);
      if (m && m[1] === name) {
        matches.push({ lineIdx: i, lang: carrier.lang, afterCol: m[0].length });
      }
    }
  }
  // Lexical-context filter: a carrier counts only when its line starts in top-level
  // code for its language (see the *LineStartsTopLevel doc comment).
  const shellStarts = matches.some((m) => m.lang === 'shell') ? shellLineStartsTopLevel(lines) : null;
  const jsStarts = matches.some((m) => m.lang === 'js') ? jsLineStartsTopLevel(lines) : null;
  const visible = matches.filter((m) => (m.lang === 'shell' ? shellStarts : jsStarts)![m.lineIdx]);
  if (visible.length === 0) {
    return err('MISSING', ref, `no top-level shell/JS-TS function '${name}' (other spellings are not matched — bind by L:)`);
  }
  if (visible.length > 1) {
    return err('AMBIGUOUS', ref, `${visible.length} distinct top-level matches for '${name}' (lines ${visible.map((x) => x.lineIdx + 1).join(', ')})`);
  }
  const hit = visible[0];
  const scan = hit.lang === 'shell' ? scanShellClose(lines, hit.lineIdx, hit.afterCol) : scanJsClose(lines, hit.lineIdx, hit.afterCol);
  if (scan === 'eof') {
    return err('UNSUPPORTED', ref, `function '${name}' has no column-0 closing brace — the E-1 boundary does not exist`);
  }
  if (scan === 'inline') {
    return err('UNSUPPORTED', ref, `function '${name}' closes INLINE (one-liner body) — no column-0 boundary; bind by L:`);
  }
  return {
    kind: 'fn',
    path: rel,
    content: lines.slice(hit.lineIdx, scan.closeLine).join('\n'),
    startLine: hit.lineIdx + 1,
    endLine: scan.closeLine,
  };
}
