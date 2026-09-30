/**
 * Principle 49 — detection half: which `install.sh` invocations in an install-sh test leave
 * install.sh's exit code unasserted.
 *
 * > **Authoritative for:** the line-level detector and the ratchet comparison. What counts as
 * > asserted, and why, is stated in the companion test's header.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists.
 *
 * Declared limits (a line scan, not a shell parser): a helper function that wraps install.sh is
 * judged where install.sh appears, not at its call sites; a captured rc counts as asserted when
 * its name is compared ANYWHERE in the file; heredoc bodies are not skipped (no install-sh test
 * writes an install.sh invocation into one as of 2026-10-01).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Unasserted {
  line: number;
  reason: string;
}

const INVOCATION =
  /(?:^|[\s;&|(!])(?:bash|sh)\s+(?:-[a-z]+\s+)*["']?(?:\$\{?(?:REPO_ROOT|INSTALL_ROOT)\}?\/install\.sh|\$\{?INSTALL(?:_SH)?\}?)(?![A-Za-z0-9_])/;
const ESCAPE = /#\s*install-rc:\s*(.*)$/;
const CONDITION_HEAD = /^\s*(?:if|elif|while|until)\b/;
const CHAINED = /&&\s*(?:ok|pass)\b|\|\|\s*(?:bad|fail)\b/;
const MASKED = /\|\|\s*(?:true|:)(?:\s|;|$|\))/;
const SET_E = /^\s*set\s+-[a-zA-Z]*e/m;

function comparedLater(text: string, name: string): boolean {
  const v = `\\$\\{?${name}\\}?`;
  return new RegExp(
    `${v}"?\\s*(?:-eq|-ne|-gt|-lt|-ge|-le|=|!=|==)|case\\s+"?${v}`,
  ).test(text);
}

/** Every invocation of install.sh in one test file whose exit code is not asserted. */
export function findUnasserted(text: string): Unasserted[] {
  const lines = text.split('\n');
  const setE = SET_E.test(text);
  const out: Unasserted[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*#/.test(lines[i])) continue;
    const start = i;
    let logical = lines[i];
    while (/\\$/.test(logical) && i + 1 < lines.length) {
      logical = logical.replace(/\\$/, ' ') + lines[++i];
    }
    if (!INVOCATION.test(logical)) continue;
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
    const cap =
      /([A-Za-z_][A-Za-z0-9_]*)=\$\?/.exec(logical) ??
      /^\s*([A-Za-z_][A-Za-z0-9_]*)=\$\?/.exec(next);
    if (cap) {
      if (comparedLater(text, cap[1])) continue;
      out.push({
        line: lineNo,
        reason: `rc captured into ${cap[1]} but never compared`,
      });
      continue;
    }
    if (
      CONDITION_HEAD.test(logical) ||
      CHAINED.test(logical) ||
      CHAINED.test(next)
    )
      continue;
    if (setE) continue;
    out.push({
      line: lineNo,
      reason: 'exit code neither captured nor tested (no set -e)',
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
    const n = text
      .split('\n')
      .filter((l) => !/^\s*#/.test(l) && INVOCATION.test(l)).length;
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
