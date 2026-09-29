/**
 * Principle 47 — an early-exit grep never reads a pipe under `pipefail`.
 *
 * THE DEFECT, MEASURED (2026-09-29, the PC: WSL Ubuntu, jq 1.7, GNU grep). Under
 * `set -o pipefail`, `producer | grep -q PAT` returns 141 on a SUCCESSFUL match whenever grep
 * exits before the producer's last write: the producer dies of SIGPIPE and pipefail reports
 * that status for the whole pipeline. Two conditions must meet, and both were traced with
 * `strace`, not assumed:
 *
 *   1. the producer writes more than once — jq 1.7 wrote the 5607-byte RU recap reason of
 *      `tests/install-sh/gh-934-ship-eot-hook.test.sh` arm (E) as 4096 + 1511 bytes;
 *   2. grep has seen a COMPLETE matching line in the first chunk — GNU grep holds an
 *      unterminated line back until its newline arrives, so a single long line never races.
 *      The recap marker sits on line 2 of 37, so grep exited after the first read and jq's
 *      second write got EPIPE.
 *
 * That shape failed 20/1000 idle on the PC (0/1000 on the Mac, whose jq wrote once); the
 * here-string form failed 0/1000 on both. The `awk … | grep -q` sibling in r2-auto-wire arm G
 * failed 42/400 under load. A single-write producer (a small `echo "$v"`) is safe only while
 * its payload fits one stdio flush, which the text of a test cannot prove — so the gate does
 * not grade producers. It flags the SHAPE, exactly as upstream ShellCheck now does.
 *
 * PREDICATE — a port of ShellCheck SC2337 (koalaman/shellcheck PR #3498, merged 2026-09-17,
 * not in any release yet: 0.11.0 is the latest and this repo's CI pins 0.9.0). A `grep`,
 * `egrep` or `fgrep` that (a) is not the first command of its pipeline, (b) carries an
 * early-exit option — `-q`/`--quiet`/`--silent`, `-m`/`--max-count`, `-L` — parsed the way
 * getopt parses it (`-e -q` and `-eq` are patterns, `--` ends options), in (c) a file that
 * sets `pipefail`. Files under a `lib/` directory are sourced into pipefail tests, so they are
 * held to it as well.
 *
 * ESCAPE — the ShellCheck directive itself, on the comment line(s) directly above the command,
 * with a reason of ≥20 chars after a second `#`:
 *
 *     # shellcheck disable=SC2337 # grep -m1 feeds a display-only $(...), status unread
 *
 * The same directive silences SC2337 once a ShellCheck release carries it, so adopting the
 * upstream check retires this module without touching a single escape. A same-line trailing
 * directive is NOT honoured: ShellCheck rejects it (SC1126), and so does this gate.
 *
 * FIX FORMS — `grep -q PAT <<<"$v"`, `v=$(producer) && grep -q PAT <<<"$v"` (keeps the
 * producer's own exit status), `grep -q PAT < <(producer)`, or `grep -q PAT file`.
 *
 * WHAT THIS IS NOT. It is a lexer, not a shell parser: it follows quoting, `$(…)`, backticks,
 * `${…}`, arithmetic, heredoc bodies, comments, `[[ … ]]` and `case` patterns, which is what
 * the corpus uses. A pipeline assembled at runtime (`eval`, a string handed to `bash -c`) is
 * out of reach — as it is for ShellCheck.
 */

/** One flagged grep. `line` is 1-based and names the line holding the `grep` word. */
export interface EarlyExitSite {
  file: string;
  line: number;
  flags: string[];
  text: string;
}

/** A directive that names SC2337 but carries too short a reason to count as a decision. */
export interface WeakEscape {
  file: string;
  line: number;
  reason: string;
}

export interface ScanResult {
  /** Flagged and not escaped — the violations. */
  sites: EarlyExitSite[];
  /** Flagged and escaped by a directive with a substantive reason. */
  escaped: EarlyExitSite[];
  /** Directives naming SC2337 above a flagged grep whose reason is under the floor. */
  weakEscapes: WeakEscape[];
  /** Every grep/egrep/fgrep command word the lexer reached, flagged or not (non-vacuity). */
  grepsSeen: number;
}

export const ESCAPE_REASON_FLOOR = 20;

const GREP_NAMES = new Set(['grep', 'egrep', 'fgrep']);
const EARLY_EXIT = new Set(['q', 'quiet', 'silent', 'm', 'max-count', 'L']);
/** Short options that consume a value — the getopt string SC2337 uses: `e: f: m: A: B: C: d: D:`. */
const SHORT_WITH_VALUE = new Set(['e', 'f', 'm', 'A', 'B', 'C', 'd', 'D']);
const LONG_WITH_VALUE = new Set([
  'regexp',
  'file',
  'max-count',
  'after-context',
  'before-context',
  'context',
  'directories',
  'devices',
]);
/** Reserved words that may open a command position without being the command. */
const LEADING_KEYWORDS = new Set([
  'if',
  'then',
  'elif',
  'else',
  'fi',
  'while',
  'until',
  'do',
  'done',
  '!',
  '{',
  '}',
  'time',
  'function',
]);
/** Wrappers whose first non-assignment argument is the real command. */
const WRAPPERS = new Set(['command', 'builtin', 'exec', 'env', 'nice']);
/** Stands in for any expansion inside a word, so `$FLAGS` never reads as an option. */
const EXPANSION = '\u0000';

export function setsPipefail(src: string): boolean {
  return /^[^#\n]*\bset\s+[^#\n]*-[A-Za-z]*o\s+pipefail\b/m.test(src);
}

/** The early-exit options in a grep argument list, parsed as getopt would. */
export function earlyExitFlags(args: string[]): string[] {
  const found: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k]!;
    if (a.includes(EXPANSION)) continue;
    if (a === '--') break;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const name = a.slice(2, eq === -1 ? undefined : eq);
      if (EARLY_EXIT.has(name)) found.push(`--${name}`);
      if (eq === -1 && LONG_WITH_VALUE.has(name)) k++;
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      for (let c = 1; c < a.length; c++) {
        const ch = a[c]!;
        if (EARLY_EXIT.has(ch)) found.push(`-${ch}`);
        if (SHORT_WITH_VALUE.has(ch)) {
          if (c === a.length - 1) k++;
          break;
        }
      }
    }
  }
  return found;
}

interface Word {
  v: string;
  pos: number;
}

type Stop = 'eof' | ')' | '`' | 'case';

class Lexer {
  private i = 0;
  private readonly n: number;
  private readonly heredocs: { delim: string; stripTabs: boolean }[] = [];
  private caseEnded = false;
  readonly hits: { pos: number; flags: string[] }[] = [];
  grepsSeen = 0;

  constructor(private readonly src: string) {
    this.n = src.length;
  }

  run(): void {
    this.scanList('eof');
  }

  private startsWith(s: string, at = this.i): boolean {
    return this.src.startsWith(s, at);
  }

  private consumeHeredocs(): void {
    while (this.heredocs.length > 0) {
      const h = this.heredocs.shift()!;
      while (this.i < this.n) {
        let nl = this.src.indexOf('\n', this.i);
        if (nl === -1) nl = this.n;
        const raw = this.src.slice(this.i, nl);
        this.i = nl + 1;
        if ((h.stripTabs ? raw.replace(/^\t+/, '') : raw) === h.delim) break;
      }
    }
  }

  private skipToEol(): void {
    const nl = this.src.indexOf('\n', this.i);
    this.i = nl === -1 ? this.n : nl;
  }

  /** From an opening `((` (at this.i), past its matching `))`. */
  private skipArith(): void {
    let depth = 0;
    while (this.i < this.n) {
      const c = this.src[this.i++];
      if (c === '(') depth++;
      else if (c === ')' && --depth === 0) return;
    }
  }

  /** From just past `${`, past its matching `}`. */
  private skipBraces(): void {
    let depth = 1;
    while (this.i < this.n && depth > 0) {
      const c = this.src[this.i++];
      if (c === '\\') this.i++;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === "'") this.i = this.src.indexOf("'", this.i) + 1 || this.n;
    }
  }

  /** `$…` at this.i: every expansion form. Returns after the expansion. */
  private expansion(): void {
    if (this.startsWith('$((')) {
      this.i++;
      this.skipArith();
    } else if (this.startsWith('$(')) {
      this.i += 2;
      this.scanList(')');
    } else if (this.startsWith('${')) {
      this.i += 2;
      this.skipBraces();
    } else {
      this.i++;
      while (this.i < this.n && /[A-Za-z0-9_@*#?$!-]/.test(this.src[this.i]!)) {
        const special = /[@*#?$!-]/.test(this.src[this.i]!);
        this.i++;
        if (special) break;
      }
    }
  }

  private readDoubleQuoted(): string {
    let out = '';
    while (this.i < this.n) {
      const c = this.src[this.i]!;
      if (c === '"') {
        this.i++;
        return out;
      }
      if (c === '\\') {
        out += this.src[this.i + 1] ?? '';
        this.i += 2;
      } else if (c === '$' && this.i + 1 < this.n && /[({A-Za-z0-9_@*#?$!-]/.test(this.src[this.i + 1]!)) {
        this.expansion();
        out += EXPANSION;
      } else if (c === '`') {
        this.i++;
        this.scanList('`');
        out += EXPANSION;
      } else {
        out += c;
        this.i++;
      }
    }
    return out;
  }

  private readWord(): string {
    let out = '';
    while (this.i < this.n) {
      const c = this.src[this.i]!;
      if (' \t\n;&|<>()'.includes(c)) break;
      if (c === '\\') {
        if (this.src[this.i + 1] !== '\n') out += this.src[this.i + 1] ?? '';
        this.i += 2;
      } else if (c === "'") {
        const j = this.src.indexOf("'", this.i + 1);
        const end = j === -1 ? this.n : j;
        out += this.src.slice(this.i + 1, end);
        this.i = end + 1;
      } else if (c === '$' && this.src[this.i + 1] === "'") {
        let j = this.i + 2;
        while (j < this.n && this.src[j] !== "'") j += this.src[j] === '\\' ? 2 : 1;
        out += this.src.slice(this.i + 2, j);
        this.i = j + 1;
      } else if (c === '"') {
        this.i++;
        out += this.readDoubleQuoted();
      } else if (c === '`') {
        this.i++;
        this.scanList('`');
        out += EXPANSION;
      } else if (c === '$' && this.i + 1 < this.n && /[({A-Za-z0-9_@*#?$!-]/.test(this.src[this.i + 1]!)) {
        this.expansion();
        out += EXPANSION;
      } else {
        out += c;
        this.i++;
      }
    }
    return out;
  }

  private skipBlanks(newlines: boolean): void {
    while (this.i < this.n) {
      const c = this.src[this.i];
      if (c === ' ' || c === '\t') this.i++;
      else if (c === '\\' && this.src[this.i + 1] === '\n') this.i += 2;
      else if (newlines && c === '\n') {
        this.i++;
        this.consumeHeredocs();
      } else if (newlines && c === '#') this.skipToEol();
      else return;
    }
  }

  private skipDoubleBracket(): void {
    while (this.i < this.n) {
      this.skipBlanks(true);
      if (this.startsWith(']]') && /[\s;&|)]|^$/.test(this.src[this.i + 2] ?? '')) {
        this.i += 2;
        return;
      }
      const before = this.i;
      if (';&|<>()'.includes(this.src[this.i]!)) this.i++;
      else this.readWord();
      if (this.i === before) this.i++;
    }
  }

  /** `case WORD in (pattern) list ;; … esac` — patterns may hold `|` and `)`, lists may not. */
  private caseStatement(): void {
    while (this.i < this.n) {
      this.skipBlanks(true);
      if (this.readWord() === 'in') break;
    }
    while (this.i < this.n) {
      this.skipBlanks(true);
      if (this.startsWith('esac') && /[\s;&|)]|^$/.test(this.src[this.i + 4] ?? '')) {
        this.i += 4;
        return;
      }
      if (this.src[this.i] === '(') this.i++;
      while (this.i < this.n && this.src[this.i] !== ')') {
        const before = this.i;
        if ('|; \t\n'.includes(this.src[this.i]!)) this.i++;
        else this.readWord();
        if (this.i === before) this.i++;
      }
      this.i++;
      this.caseEnded = false;
      this.scanList('case');
      if (this.caseEnded) {
        this.caseEnded = false;
        return;
      }
    }
  }

  private evaluate(words: Word[], seg: number): void {
    let k = 0;
    while (k < words.length) {
      const v = words[k]!.v.replace(/^\\/, '');
      if (WRAPPERS.has(v) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(v) || (v.startsWith('-') && k > 0)) k++;
      else break;
    }
    const cmd = words[k];
    if (!cmd) return;
    const base = cmd.v.replace(/^\\/, '').split('/').pop()!;
    if (!GREP_NAMES.has(base)) return;
    this.grepsSeen++;
    if (seg < 1) return;
    const flags = earlyExitFlags(words.slice(k + 1).map((w) => w.v));
    if (flags.length > 0) this.hits.push({ pos: cmd.pos, flags });
  }

  private scanList(stop: Stop): void {
    let seg = 0;
    let words: Word[] = [];
    // After `|`, `&&` or `||` a newline continues the list rather than ending it.
    let awaitingOperand = false;
    const flush = (): void => {
      if (words.length > 0) this.evaluate(words, seg);
      words = [];
    };
    const endPipeline = (): void => {
      flush();
      seg = 0;
    };
    while (this.i < this.n) {
      const c = this.src[this.i]!;
      if (c === ' ' || c === '\t') {
        this.i++;
      } else if (c === '\\' && this.src[this.i + 1] === '\n') {
        this.i += 2;
      } else if (c === '\n') {
        if (!awaitingOperand) endPipeline();
        this.i++;
        this.consumeHeredocs();
      } else if (c === '#') {
        this.skipToEol();
      } else if (c === ')' && stop === ')') {
        this.i++;
        flush();
        return;
      } else if (c === '`' && stop === '`') {
        this.i++;
        flush();
        return;
      } else if (c === ';') {
        if (stop === 'case' && (this.startsWith(';;') || this.startsWith(';&'))) {
          flush();
          this.i += this.startsWith(';;&') ? 3 : 2;
          return;
        }
        endPipeline();
        this.i++;
      } else if (c === '&') {
        if (this.startsWith('&&')) {
          endPipeline();
          awaitingOperand = true;
          this.i += 2;
        } else if (this.startsWith('&>')) {
          this.i += this.startsWith('&>>') ? 3 : 2;
          this.skipBlanks(false);
          this.readWord();
        } else {
          endPipeline();
          this.i++;
        }
      } else if (c === '|') {
        if (this.startsWith('||')) {
          endPipeline();
          awaitingOperand = true;
          this.i += 2;
        } else {
          flush();
          seg++;
          awaitingOperand = true;
          this.i += this.startsWith('|&') ? 2 : 1;
        }
      } else if (c === '(') {
        if (words.length === 0 && this.startsWith('((')) {
          this.skipArith();
        } else {
          this.i++;
          this.scanList(')');
        }
      } else if (c === ')') {
        this.i++;
      } else if (c === '<' || c === '>') {
        if (this.startsWith('<(') || this.startsWith('>(')) {
          this.i += 2;
          this.scanList(')');
          words.push({ v: EXPANSION, pos: this.i });
        } else if (this.startsWith('<<<')) {
          this.i += 3;
          this.skipBlanks(false);
          this.readWord();
        } else if (this.startsWith('<<')) {
          this.i += 2;
          const stripTabs = this.src[this.i] === '-';
          if (stripTabs) this.i++;
          this.skipBlanks(false);
          this.heredocs.push({ delim: this.readWord(), stripTabs });
        } else {
          this.i++;
          while (this.i < this.n && '<>&|'.includes(this.src[this.i]!)) this.i++;
          this.skipBlanks(false);
          if (!this.startsWith('(')) this.readWord();
        }
      } else {
        const pos = this.i;
        const v = this.readWord();
        if (this.i === pos) {
          this.i++;
          continue;
        }
        awaitingOperand = false;
        if (words.length === 0) {
          if (stop === 'case' && v === 'esac') {
            this.caseEnded = true;
            return;
          }
          if (LEADING_KEYWORDS.has(v)) continue;
          if (v === 'case') {
            this.caseStatement();
            continue;
          }
          if (v === '[[') {
            this.skipDoubleBracket();
            continue;
          }
        }
        words.push({ v, pos });
      }
    }
    flush();
  }
}

const DIRECTIVE = /^\s*#\s*shellcheck\s+disable=([A-Z0-9,]+)(.*)$/;

/** The SC2337 directive governing 0-based `line`, looked up over the comment block above it. */
function directiveAbove(lines: string[], line: number): { line: number; reason: string } | null {
  for (let k = line - 1; k >= 0 && /^\s*#/.test(lines[k]!); k--) {
    const m = DIRECTIVE.exec(lines[k]!);
    if (m && m[1]!.split(',').includes('SC2337')) {
      const hash = m[2]!.indexOf('#');
      return { line: k + 1, reason: hash === -1 ? '' : m[2]!.slice(hash + 1).trim() };
    }
  }
  return null;
}

/** First line of the continued block that ends on 0-based `line` (`\`, `|`, `&&`, `||` tails). */
function blockStart(lines: string[], line: number): number {
  let k = line;
  while (k > 0 && /(\\|\||&&)\s*$/.test(lines[k - 1]!)) k--;
  return k;
}

/**
 * Scan one file's source. `inScope` overrides the pipefail detection — the caller decides for
 * sourced libraries, which inherit the option from the file that sources them.
 */
export function scanSource(
  file: string,
  src: string,
  inScope: boolean = setsPipefail(src),
): ScanResult {
  const result: ScanResult = { sites: [], escaped: [], weakEscapes: [], grepsSeen: 0 };
  if (!inScope) return result;
  const lexer = new Lexer(src);
  lexer.run();
  result.grepsSeen = lexer.grepsSeen;
  const lines = src.split('\n');
  const lineOf = (pos: number): number => src.slice(0, pos).split('\n').length - 1;
  for (const hit of lexer.hits) {
    const l = lineOf(hit.pos);
    const site: EarlyExitSite = { file, line: l + 1, flags: hit.flags, text: lines[l]!.trim() };
    const d = directiveAbove(lines, blockStart(lines, l)) ?? directiveAbove(lines, l);
    if (!d) result.sites.push(site);
    else if (d.reason.length >= ESCAPE_REASON_FLOOR) result.escaped.push(site);
    else result.weakEscapes.push({ file, line: d.line, reason: d.reason });
  }
  return result;
}
