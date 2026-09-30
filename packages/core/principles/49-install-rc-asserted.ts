/**
 * Principle 49 — detection half: which `install.sh` invocations in an install-sh test leave
 * install.sh's exit code unasserted.
 *
 * > **Authoritative for:** the line-level detector and the ratchet comparison. What counts as
 * > asserted, and why, is stated in the companion test's header.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists.
 *
 * Declared limits (a line scan, not a shell parser): a helper function that wraps install.sh is
 * judged where install.sh appears, not at its call sites; a captured rc counts as asserted when its
 * name is compared after the capture and before the name is assigned again (a comparison inside a
 * branch that may not run still counts); heredoc bodies are not skipped (no install-sh test writes
 * an install.sh invocation into one as of 2026-10-01).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Unasserted {
  line: number;
  reason: string;
}

const PATH = String.raw`["']?\$\{?[A-Za-z_][A-Za-z0-9_]*\}?["']?\/install\.sh(?![\w.])|["']?\$\{?INSTALL(?:_SH)?\}?["']?(?![\w/.])`;
/**
 * An install.sh run: `bash|sh [flags] <path>`, or `<path>` at command position (line start, after
 * `;` `&&` `||` `|` `(` `$(` `then` `do` `!`, past `VAR=value` prefixes). `<path>` is any
 * `$VAR/install.sh` spelling (quote before or after the slash) or `$INSTALL` / `$INSTALL_SH`.
 */
const INVOCATION = new RegExp(
  String.raw`(?:\b(?:bash|sh)\s+((?:-[a-zA-Z]+\s+)*)(?:${PATH}))|(?:(?:^|;|&&|\|\||\||\(|\$\(|\bthen\b|\bdo\b|!)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:${PATH}))`,
);
const ESCAPE = /#\s*install-rc:\s*(.*)$/;
const CONDITION_HEAD = /^\s*(?:if|elif|while|until)\b/;
/** A failure branch on the same logical line: `|| bad …`, `|| fail`, `|| exit 1`, `|| { bad …; }`. */
const FAILS_ON_ERROR = /\|\|\s*\{?\s*(?:bad|fail|die|exit\s+[1-9])\b/;
const MASKED = /\|\|\s*(?:true|:)(?:\s|;|$|\))/;

/** Does `name` get compared after line `from`, before it is assigned again? */
function comparedAfter(lines: string[], from: number, name: string): boolean {
  const v = String.raw`\$\{?${name}\}?`;
  const cmp = new RegExp(
    String.raw`${v}"?\s*(?:-eq|-ne|-gt|-lt|-ge|-le|=|!=|==)|case\s+"?${v}`,
  );
  const reassign = new RegExp(String.raw`(?:^|[\s;&|(])${name}=`);
  for (let k = from + 1; k < lines.length; k++) {
    if (cmp.test(lines[k])) return true;
    if (reassign.test(lines[k])) return false;
  }
  return false;
}

/** Every invocation of install.sh in one test file whose exit code is not asserted. */
export function findUnasserted(text: string): Unasserted[] {
  const lines = text.split('\n');
  const out: Unasserted[] = [];
  let errexit = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*#/.test(lines[i])) continue;
    const start = i;
    let logical = lines[i];
    while (/\\$/.test(logical) && i + 1 < lines.length) {
      logical = logical.replace(/\\$/, ' ') + lines[++i];
    }
    const setOpt = /^\s*set\s+([-+])[a-zA-Z]*e/.exec(logical);
    if (setOpt) errexit = setOpt[1] === '-';
    const inv = INVOCATION.exec(logical);
    if (!inv) continue;
    // `bash -n install.sh` parses the script; it does not run the install.
    if (inv[1] && /(?:^|\s)-[a-zA-Z]*n/.test(inv[1])) continue;
    const lineNo = start + 1;
    const next = lines[i + 1] ?? '';

    const esc =
      ESCAPE.exec(logical) ??
      (start > 0 && /^\s*#/.test(lines[start - 1])
        ? ESCAPE.exec(lines[start - 1])
        : null);
    if (esc) {
      if (esc[1].trim().length >= 20) continue;
      out.push({
        line: lineNo,
        reason: 'install-rc escape rationale under 20 chars',
      });
      continue;
    }

    if (MASKED.test(logical)) {
      out.push({ line: lineNo, reason: 'masked by || true' });
      continue;
    }
    const cap = /([A-Za-z_][A-Za-z0-9_]*)=\$\?/.exec(logical);
    const capNext = cap ? null : /^\s*([A-Za-z_][A-Za-z0-9_]*)=\$\?/.exec(next);
    const name = cap?.[1] ?? capNext?.[1];
    if (name) {
      if (comparedAfter(lines, capNext ? i + 1 : i, name)) continue;
      out.push({
        line: lineNo,
        reason: `rc captured into ${name} but not compared before its next assignment`,
      });
      continue;
    }
    if (CONDITION_HEAD.test(logical)) {
      const body = /;\s*(?:then|do)\b/.exec(logical);
      if (!body || inv.index < body.index) continue;
    }
    if (FAILS_ON_ERROR.test(logical)) continue;
    if (errexit) continue;
    out.push({
      line: lineNo,
      reason: 'exit code neither captured nor tested (errexit off here)',
    });
  }
  return out;
}

export interface SuiteMeasure {
  counts: Record<string, number>;
  files: number;
  invocations: number;
}

/** Per-file count of unasserted invocations across tests/install-sh/*.test.sh. */
export function measureSuite(repoRoot: string): SuiteMeasure {
  const dir = join(repoRoot, 'tests/install-sh');
  const counts: Record<string, number> = {};
  let files = 0;
  let invocations = 0;
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.test.sh')) continue;
    const text = readFileSync(join(dir, name), 'utf8');
    const n = text.split('\n').filter((l) => {
      if (/^\s*#/.test(l)) return false;
      const m = INVOCATION.exec(l);
      return m !== null && !(m[1] && /(?:^|\s)-[a-zA-Z]*n/.test(m[1]));
    }).length;
    if (n === 0) continue;
    files++;
    invocations += n;
    const u = findUnasserted(text).length;
    if (u > 0) counts[name] = u;
  }
  return { counts, files, invocations };
}

/** The ratchet: equal passes; above the baseline fails; below it fails until lowered. */
export function ratchetProblems(
  counts: Record<string, number>,
  baseline: Record<string, number>,
): string[] {
  const problems: string[] = [];
  const names = new Set([...Object.keys(counts), ...Object.keys(baseline)]);
  for (const name of [...names].sort()) {
    const now = counts[name] ?? 0;
    const base = baseline[name] ?? 0;
    if (now > base)
      problems.push(
        `${name}: ${now} install.sh invocation(s) without an asserted exit code, baseline ${base} — capture rc and compare it, test the call directly, or escape with # install-rc: <rationale >= 20 chars>`,
      );
    else if (now < base)
      problems.push(
        `${name}: ${now} unasserted invocation(s), baseline ${base} — lower its entry in 49-install-rc-asserted.baseline.json to ${now} (the ratchet only goes down)`,
      );
  }
  return problems;
}
