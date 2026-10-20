/**
 * living-docs-audit-cli.ts — the D0 family-owned living-docs audit command
 * (kickoff-d0 §2-§4, deterministic-core).
 *
 * One command with accurate target binding, findings, completeness and exit
 * semantics, replacing the role's mechanical run/report recipes:
 *
 *   node scripts/living-docs-audit.mjs --project-root <absolute-root> \
 *     --profile <base|react-next|react-spa|react-native> \
 *     [--diagnostics-dir <absolute-directory>] [--timeout-ms <integer>] \
 *     [--max-output-bytes <integer>]
 *
 * Exactly ONE family-local JSON result (`getff.living-docs-audit/1`) on stdout;
 * stderr stays for launcher diagnostics. Exit 0 = complete + no blocking
 * violations; 1 = complete + blocking violations; 2 = invalid invocation,
 * incomplete work or execution error (known violations retained).
 *
 * Structured D1/D2 come from audit-ai-docs.ts (sole normative source for this
 * command); the runner shells are invoked once with --structured-drift-external
 * so their legacy D1/D2 populations are omitted at the source. Runner bytes are
 * admitted only against the build-derived identity table (runner-identities).
 * Effects on the target: reads only. Ready artifact: living-docs-audit.bundle.mjs
 * (scripts/build-runtime-bundles.mjs); consumer destination scripts/living-docs-audit.mjs.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, realpathSync, lstatSync, readlinkSync, renameSync, unlinkSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep, dirname, basename } from 'node:path';
import { isDirectRun } from '../install/is-direct-run.ts';
import {
  acquireD1RulesStructured,
  acquireD1Structured,
  acquireD2Structured,
  type StructuredAcquisition,
} from './audit-ai-docs.ts';
import { getRunnerIdentities, type RunnerIdentity, type RunnerIdentityTable, type RunnerKind } from './runner-identities.ts';

// ─── Result schema ───────────────────────────────────────────────────────────

export const RESULT_SCHEMA = 'getff.living-docs-audit/1' as const;

export type Profile = 'base' | 'react-next' | 'react-spa' | 'react-native';
export type CheckStatus = 'passed' | 'violations' | 'not-applicable' | 'incomplete' | 'error';

export interface AuditFinding {
  severity: 'blocking' | 'warning';
  check: string;
  message: string;
  location?: { file: string; line?: number; key?: string };
}

export interface CheckResult {
  check: string;
  status: CheckStatus;
  findings: AuditFinding[];
  reasons: string[];
}

export interface RunnerSelection {
  kind: RunnerKind;
  script: string;
  sourceArtifact: string;
  expectedSha256: string;
  actualSha256: string | null;
  admitted: boolean;
}

export interface ProcessResultInfo {
  exitCode: number | null;
  timedOut: boolean;
  overflowed: boolean;
  killed: boolean;
  stdoutBytes: number;
  stderrBytes: number;
}

export interface AuditResult {
  schema: typeof RESULT_SCHEMA;
  requestedProfile: Profile | null;
  resolvedTarget: string;
  invocationError?: string;
  runner: RunnerSelection | null;
  chainedBase: RunnerSelection | null;
  /** R4 helper admission, recorded when the target delivers scripts/audit-r4.ts. */
  r4Helper: RunnerSelection | null;
  checks: CheckResult[];
  findings: AuditFinding[];
  counts: { blocking: number; warning: number; checksByStatus: Record<CheckStatus, number> };
  complete: boolean;
  process: ProcessResultInfo | null;
  diagnostics: {
    dir: string | null;
    written: string[];
    writeError: string | null;
    excerpts: { stdout: string; stderr: string } | null;
    fullLogsRetained: boolean;
  };
}

// ─── Boundedness constants (kickoff-d0 §2) ──────────────────────────────────

const PROFILES: readonly Profile[] = ['base', 'react-next', 'react-spa', 'react-native'];
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_OUTPUT_BYTES = 2_097_152;
const MAX_MAX_OUTPUT_BYTES = 16_777_216;
const EXCERPT_CHARS = 4096;
const KILL_GRACE_MS = 2_000;

// Consumer-side script paths live ONLY in the build-derived identity table
// (runner-identities virtual module) — no second hand-maintained ledger here.

const RN_NOT_ADMITTED_REASON =
  'react-native runner not admitted in D0: its source-relative BASELINES/DOCS_HEADERS probes ' +
  'inspect preset-package paths absent from ordinary consumer layouts (kickoff-d0 §3); ' +
  'retained for F3/F4. No base fallback is performed.';

// ─── Invocation parsing ──────────────────────────────────────────────────────

interface ParsedArgs {
  projectRoot?: string;
  profile?: string;
  diagnosticsDir?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  errors: string[];
}

const VALUE_OPTIONS = new Set(['--project-root', '--profile', '--diagnostics-dir', '--timeout-ms', '--max-output-bytes']);

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { errors: [] };
  const seen = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!VALUE_OPTIONS.has(arg)) {
      parsed.errors.push(`unknown or malformed argument: ${arg}`);
      continue;
    }
    if (seen.has(arg)) {
      parsed.errors.push(`duplicate option: ${arg}`);
      continue;
    }
    seen.add(arg);
    const value = argv[i + 1];
    if (value === undefined) {
      parsed.errors.push(`missing value for ${arg}`);
      continue;
    }
    i++;
    switch (arg) {
      case '--project-root': parsed.projectRoot = value; break;
      case '--profile': parsed.profile = value; break;
      case '--diagnostics-dir': parsed.diagnosticsDir = value; break;
      case '--timeout-ms':
      case '--max-output-bytes': {
        if (!/^[0-9]+$/.test(value)) {
          parsed.errors.push(`${arg} must be a positive integer, got: ${value}`);
          break;
        }
        const n = Number(value);
        if (n <= 0) { parsed.errors.push(`${arg} must be positive, got: ${value}`); break; }
        if (arg === '--timeout-ms') {
          if (n > MAX_TIMEOUT_MS) parsed.errors.push(`--timeout-ms exceeds maximum ${MAX_TIMEOUT_MS}, got: ${value}`);
          else parsed.timeoutMs = n;
        } else {
          if (n > MAX_MAX_OUTPUT_BYTES) parsed.errors.push(`--max-output-bytes exceeds maximum ${MAX_MAX_OUTPUT_BYTES}, got: ${value}`);
          else parsed.maxOutputBytes = n;
        }
        break;
      }
    }
  }
  if (!parsed.projectRoot) parsed.errors.push('missing required option: --project-root <absolute-root>');
  else if (!isAbsolute(parsed.projectRoot)) parsed.errors.push(`--project-root must be absolute, got: ${parsed.projectRoot}`);
  if (!parsed.profile) parsed.errors.push('missing required option: --profile <base|react-next|react-spa|react-native>');
  else if (!PROFILES.includes(parsed.profile as Profile)) parsed.errors.push(`unknown --profile: ${parsed.profile} (expected one of ${PROFILES.join('|')})`);
  if (parsed.diagnosticsDir !== undefined && !isAbsolute(parsed.diagnosticsDir)) {
    parsed.errors.push(`--diagnostics-dir must be absolute, got: ${parsed.diagnosticsDir}`);
  }
  return parsed;
}

// ─── Root resolution (once, before any backend starts) ──────────────────────

function validateRoot(rawRoot: string): { resolved: string; error: string | null } {
  const resolved = resolve(rawRoot);
  try {
    const st = statSync(resolved);
    if (!st.isDirectory()) return { resolved, error: `target is not a directory: ${resolved}` };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? '';
    if (code === 'ENOENT' || code === 'ENOTDIR') return { resolved, error: `target does not exist: ${resolved}` };
    return { resolved, error: `target cannot be accessed: ${resolved} (${(err as Error).message})` };
  }
  try {
    readdirSync(resolved);
  } catch (err) {
    return { resolved, error: `target directory cannot be listed: ${resolved} (${(err as Error).message})` };
  }
  return { resolved, error: null };
}

function isOutsideTree(root: string, dir: string): boolean {
  const rel = relative(root, dir);
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/** Resolve existing ancestry, including a dangling directory link, before allowing diagnostics. */
function physicalDestination(raw: string): string {
  let path = resolve(raw);
  const tail: string[] = [];
  let links = 0;
  for (;;) {
    try { return resolve(realpathSync(path), ...tail); }
    catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err;
      try {
        if (lstatSync(path).isSymbolicLink()) {
          if (++links > 40) throw new Error('diagnostics directory has a symlink loop');
          path = resolve(dirname(path), readlinkSync(path));
          continue;
        }
      } catch (linkErr) {
        const linkCode = (linkErr as NodeJS.ErrnoException).code;
        if (linkCode !== 'ENOENT' && linkCode !== 'ENOTDIR') throw linkErr;
      }
      const parent = dirname(path);
      if (parent === path) throw err;
      tail.unshift(basename(path));
      path = parent;
    }
  }
}

/** Replace the diagnostic entry itself; never truncate a linked target inode. */
function writeDiagnostic(dir: string, name: string, text: string): void {
  const temporary = join(dir, `.${name}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, text, { flag: 'wx' });
    renameSync(temporary, join(dir, name));
  } finally {
    try { unlinkSync(temporary); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
  }
}

// ─── Runner identity admission ───────────────────────────────────────────────

function sha256File(p: string): string | null {
  try {
    return createHash('sha256').update(readFileSync(p)).digest('hex');
  } catch {
    return null;
  }
}

function selectRunner(root: string, kind: RunnerKind, ident: RunnerIdentity): { selection: RunnerSelection; problem: string | null } {
  const scriptAbs = join(root, ident.script);
  const actual = sha256File(scriptAbs);
  const selection: RunnerSelection = {
    kind,
    script: ident.script,
    sourceArtifact: ident.sourceArtifact,
    expectedSha256: ident.sha256,
    actualSha256: actual,
    admitted: actual !== null && actual === ident.sha256,
  };
  if (actual === null) {
    return { selection, problem: `runner script missing or unreadable: ${ident.script} — main check cannot run` };
  }
  if (actual !== ident.sha256) {
    return { selection, problem: `unsupported runner bytes: ${ident.script} sha256 ${actual} does not match the admitted source artifact ${ident.sourceArtifact} (${ident.sha256}) — not executed, consumer bytes preserved` };
  }
  return { selection, problem: null };
}

// ─── Bounded runner execution ────────────────────────────────────────────────

interface RunnerOutput {
  exitCode: number | null;
  timedOut: boolean;
  overflowed: boolean;
  killed: boolean;
  stdout: string;
  stderr: string;
  stdoutBytes: number;
  stderrBytes: number;
  spawnError: string | null;
}

/**
 * Spawn the runner ONCE with bash, cwd = the resolved root, NO_COLOR forced
 * (non-TTY grammar), no shell string interpolation (argv array). Combined
 * stdout+stderr bytes are capped; timeout/overflow kill via SIGTERM with a
 * 2s grace period then SIGKILL. No retries.
 */
export function runBounded(scriptAbs: string, root: string, timeoutMs: number, maxBytes: number): Promise<RunnerOutput> {
  return new Promise((resolveRun) => {
    let child;
    try {
      // detached → the runner gets its OWN process group (child.pid == pgid), so a
      // timeout/overflow kill reaches the whole tree (wrappers spawn a nested base;
      // the base spawns `npx tsx`), not only the direct bash (cold-review BLOCKER:
      // a surviving descendant holding the pipe stalled `close` forever).
      child = spawn('bash', [scriptAbs, '--structured-drift-external'], {
        cwd: root,
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });
    } catch (err) {
      resolveRun({ exitCode: null, timedOut: false, overflowed: false, killed: false, stdout: '', stderr: '', stdoutBytes: 0, stderrBytes: 0, spawnError: (err as Error).message });
      return;
    }
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let total = 0;
    let timedOut = false;
    let overflowed = false;
    let killed = false;
    let spawnError: string | null = null;
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    let streamGraceTimer: ReturnType<typeof setTimeout> | null = null;
    let closedCode: number | null | undefined;
    let terminating = false;

    // Signal the whole process group (negative pid). Falls back to the direct
    // child only when the group is already gone.
    const signalGroup = (sig: NodeJS.Signals): void => {
      if (child.pid !== undefined) {
        try { process.kill(-child.pid, sig); return; } catch { /* group gone */ }
      }
      // Never fall back to a former leader PID after Node observed its exit.
      if (child.exitCode === null && child.signalCode === null) {
        try { child.kill(sig); } catch { /* already gone */ }
      }
    };
    const groupAlive = (): boolean => {
      if (child.pid === undefined) return false;
      try { process.kill(-child.pid, 0); return true; }
      catch (err) { return (err as NodeJS.ErrnoException).code !== 'ESRCH' && process.platform !== 'win32'; }
    };
    const hardKill = () => {
      graceTimer = null;
      // The leader can have exited while an owned same-group child is still alive.
      if (groupAlive() || (child.exitCode === null && child.signalCode === null)) signalGroup('SIGKILL');
      if (closedCode !== undefined) settle(closedCode);
    };
    const terminate = () => {
      if (terminating) return;
      terminating = true;
      killed = true;
      signalGroup('SIGTERM');
      graceTimer = setTimeout(hardKill, KILL_GRACE_MS);
    };
    const timeoutTimer = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);

    const settle = (exitCode: number | null) => {
      if (settled) return;
      if (graceTimer && groupAlive()) {
        // Closed leader pipes do not cancel escalation for its remaining process group.
        closedCode = exitCode;
        return;
      }
      settled = true;
      clearTimeout(timeoutTimer);
      if (graceTimer) clearTimeout(graceTimer);
      if (streamGraceTimer) clearTimeout(streamGraceTimer);
      const stdout = Buffer.concat(outChunks).toString('utf8');
      const stderr = Buffer.concat(errChunks).toString('utf8');
      resolveRun({
        exitCode,
        timedOut,
        overflowed,
        killed,
        stdout,
        stderr,
        stdoutBytes: Buffer.byteLength(stdout),
        stderrBytes: Buffer.byteLength(stderr),
        spawnError,
      });
    };

    const takeChunk = (chunks: Buffer[], chunk: Buffer): void => {
      // Past the cap nothing is accumulated (the overflowed result reports a
      // bounded excerpt only) — a loud runner cannot balloon memory.
      if (!overflowed) chunks.push(chunk);
      total += chunk.length;
      if (total > maxBytes && !overflowed) { overflowed = true; terminate(); }
    };

    child.stdout.on('data', (chunk: Buffer) => takeChunk(outChunks, chunk));
    child.stderr.on('data', (chunk: Buffer) => takeChunk(errChunks, chunk));
    child.on('error', (err) => { spawnError = err.message; });
    // Normal settle: `close` fires only after the pipes drain, so the happy path
    // never loses buffered stdout (the summary line is the LAST line).
    child.on('close', (code) => settle(code));
    // Fallback: `exit` fires when the direct child dies even if a descendant
    // (re-grouped, unreachable by the group signal) still holds the pipe. Give
    // the streams the same grace, then destroy them — `close` then fires and we
    // settle. Bounds worst-case settlement to exit + KILL_GRACE_MS, never ∞.
    child.on('exit', () => {
      streamGraceTimer = setTimeout(() => {
        child.stdout?.destroy();
        child.stderr?.destroy();
      }, KILL_GRACE_MS);
    });
  });
}

// ─── Output grammar (exact non-TTY PASS/FAIL/WARN + summaries) ───────────────

export interface ParsedRecord {
  kind: 'PASS' | 'FAIL' | 'WARN';
  rule: string;
  details: string[];
  scope: 'base' | 'wrapper';
}

export interface ScopeSummary { scope: 'base' | 'wrapper'; pass: number; fail: number; warn: number; }

const RECORD_RE = /^(PASS|FAIL|WARN): (.+)$/;
const SUMMARY_RES: Record<'base' | 'wrapper', RegExp[]> = {
  // base summary is ALSO the scope switch inside next/spa output (base runs first)
  base: [/^Audit complete: (\d+) PASS, (\d+) FAIL, (\d+) WARN$/],
  wrapper: [
    /^UI audit complete: (\d+) PASS, (\d+) FAIL, (\d+) WARN$/,
    /^React SPA audit complete: (\d+) PASS, (\d+) FAIL, (\d+) WARN$/,
  ],
};

/** Check identity from a record rule string: `R4: …`→R4, `D1 (drift): …`→D1, `R-SPA-EB: …`→R-SPA-EB. */
export function checkIdOf(rule: string): string {
  const m = /^(R-SPA-[A-Z0-9]+|SPA-GUARD|[RD]\d+)\b/.exec(rule);
  return m ? m[1] : rule;
}

export function parseRunnerOutput(profileHasWrapper: boolean, stdoutText: string): {
  records: ParsedRecord[];
  summaries: ScopeSummary[];
  structureErrors: string[];
} {
  const records: ParsedRecord[] = [];
  const summaries: ScopeSummary[] = [];
  const structureErrors: string[] = [];
  let scope: 'base' | 'wrapper' = 'base';
  let sawBaseSummary = false;
  let sawWrapperSummary = false;
  let lastRecord: ParsedRecord | null = null;

  for (const rawLine of stdoutText.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const recordMatch = RECORD_RE.exec(line);
    if (recordMatch) {
      if ((sawBaseSummary && scope === 'base') || sawWrapperSummary) {
        structureErrors.push(`record after terminal summary: ${line}`);
        continue;
      }
      lastRecord = { kind: recordMatch[1] as ParsedRecord['kind'], rule: recordMatch[2], details: [], scope };
      records.push(lastRecord);
      continue;
    }
    let matchedSummary = false;
    for (const [scopeKey, res] of Object.entries(SUMMARY_RES) as [('base' | 'wrapper'), RegExp[]][]) {
      for (const re of res) {
        const m = re.exec(line);
        if (!m) continue;
        matchedSummary = true;
        if (scopeKey === 'base') {
          if (sawBaseSummary) structureErrors.push(`duplicate base summary: ${line}`);
          sawBaseSummary = true;
          if (profileHasWrapper) scope = 'wrapper';
        } else {
          if (!profileHasWrapper) structureErrors.push(`wrapper summary in base-only output: ${line}`);
          if (sawWrapperSummary) structureErrors.push(`duplicate wrapper summary: ${line}`);
          sawWrapperSummary = true;
        }
        summaries.push({ scope: scopeKey, pass: Number(m[1]), fail: Number(m[2]), warn: Number(m[3]) });
      }
      if (matchedSummary) break;
    }
    if (matchedSummary) { lastRecord = null; continue; }
    if (line.trim() === '' || line.startsWith('▶') || line.startsWith('─') || line.startsWith('═')) continue;
    if (/^\s+\S/.test(line)) {
      // indented detail line — attaches to the record it follows (shell echo pattern)
      if (lastRecord) lastRecord.details.push(line);
      continue;
    }
    // unclassified line (delegated-tool output inside R4's npx capture, etc.) —
    // recorded in the stdout excerpt; records/summaries govern completion.
  }
  return { records, summaries, structureErrors };
}

// ─── WARN three-way discrimination (kickoff-d0 §3) ───────────────────────────

export type WarnClassification =
  | { kind: 'not-applicable'; reason: string }
  | { kind: 'incomplete-known'; reason: string }
  | { kind: 'incomplete-unknown'; reason: string }
  | { kind: 'soft-warning' };

/** Audited surface absent — documented absence, not a defect (checked FIRST: some phrases also say "could not run"). */
const WARN_NOT_APPLICABLE_RES: RegExp[] = [
  /no src\/domain/,
  /no src\/shared\/ui/,
  /no source directories found/,
  /no src\/ directory/,
  /no passport/,
  /AGENTS\.md not found/,
];

/** Required tooling/input missing — the check could not perform its acquisition. */
const WARN_INCOMPLETE_KNOWN_RES: RegExp[] = [
  /skipped: npx not found/,
  /ts-morph not installed/,
  /no tsconfig\.json/,
  /no eslint\.config\.(mjs|js) found/,
  /require-error-boundary not found in/,
  /tool-decisions\.md missing/,
];

export function classifyWarn(rule: string): WarnClassification {
  for (const re of WARN_NOT_APPLICABLE_RES) {
    if (re.test(rule)) return { kind: 'not-applicable', reason: `audited surface absent: ${rule}` };
  }
  for (const re of WARN_INCOMPLETE_KNOWN_RES) {
    if (re.test(rule)) return { kind: 'incomplete-known', reason: `required tooling/input missing: ${rule}` };
  }
  if (/\(skipped:|could not run/.test(rule)) {
    return { kind: 'incomplete-unknown', reason: `unrecognized skip/could-not-run warning (not guessed): ${rule}` };
  }
  return { kind: 'soft-warning' };
}

// ─── Scope evaluation (exit/result contradictions) ───────────────────────────

function recordToCheck(scopeLabel: string, record: ParsedRecord): CheckResult {
  const id = `${scopeLabel}/${checkIdOf(record.rule)}`;
  const message = record.details.length > 0 ? `${record.rule}\n${record.details.join('\n')}` : record.rule;
  if (record.kind === 'PASS') return { check: id, status: 'passed', findings: [], reasons: [] };
  if (record.kind === 'FAIL') {
    return { check: id, status: 'violations', findings: [{ severity: 'blocking', check: id, message }], reasons: [] };
  }
  const classified = classifyWarn(record.rule);
  switch (classified.kind) {
    case 'not-applicable': return { check: id, status: 'not-applicable', findings: [], reasons: [classified.reason] };
    case 'incomplete-known': return { check: id, status: 'incomplete', findings: [], reasons: [classified.reason] };
    case 'incomplete-unknown': return { check: id, status: 'incomplete', findings: [], reasons: [classified.reason] };
    case 'soft-warning':
      return { check: id, status: 'passed', findings: [{ severity: 'warning', check: id, message }], reasons: [] };
  }
}

export function evaluateScope(params: {
  scopeLabel: string;
  scope: 'base' | 'wrapper';
  isWrapperScope: boolean;
  baseExit: number | null;
  proc: { exitCode: number | null; timedOut: boolean; overflowed: boolean; killed: boolean };
  stdout: string;
  parse: { records: ParsedRecord[]; summaries: ScopeSummary[]; structureErrors: string[] };
}): { checks: CheckResult[]; completion: CheckResult } {
  const { scopeLabel, scope, isWrapperScope, baseExit, proc, stdout, parse } = params;
  const checks: CheckResult[] = [];
  const completionReasons: string[] = [];
  let completionStatus: CheckStatus = 'passed';

  const bump = (status: CheckStatus, reason: string) => {
    completionReasons.push(reason);
    // error outranks incomplete for the completion aggregate
    if (completionStatus !== 'error' && (status === 'error' || completionStatus === 'passed')) completionStatus = status;
  };

  const scoped = parse.records.filter((r) => r.scope === scope);
  const summary = parse.summaries.find((s) => s.scope === scope) ?? null;

  if (proc.timedOut) bump('error', `runner timed out and was killed (SIGTERM→SIGKILL); partial output cannot prove completion`);
  if (proc.overflowed) bump('error', `runner output exceeded the byte cap and it was killed; truncated output cannot prove completion`);
  if (stdout.trim() === '') bump('error', 'runner produced no output');
  if (!summary) bump('error', `terminal summary missing for ${scope} scope — completion cannot be proven`);
  for (const structureError of parse.structureErrors) bump('error', structureError);

  // Legacy D1/D2 population must be absent in --structured-drift-external mode.
  for (const record of scoped) {
    const id = checkIdOf(record.rule);
    if (id === 'D1' || id === 'D2') {
      bump('error', `legacy ${id} record emitted in --structured-drift-external mode (contract error): ${record.rule}`);
    }
  }

  if (summary) {
    const failRecords = scoped.filter((r) => r.kind === 'FAIL').length;
    const passRecords = scoped.filter((r) => r.kind === 'PASS').length;
    const warnRecords = scoped.filter((r) => r.kind === 'WARN').length;
    // Documented wrapper behavior: BASE_EXIT≠0 increments FAIL_COUNT with no printed FAIL line.
    const expectedFail = failRecords + (isWrapperScope && baseExit !== null && baseExit !== 0 ? 1 : 0);
    if (summary.fail !== expectedFail || summary.pass !== passRecords || summary.warn !== warnRecords) {
      bump('error',
        `summary counters disagree with parsed records (${scope} scope): summary ${summary.pass} PASS/${summary.fail} FAIL/${summary.warn} WARN vs parsed ${passRecords}/${failRecords}/${warnRecords}` +
        (isWrapperScope ? ` (+1 documented FAIL for nonzero nested-base exit; base exit ${baseExit})` : ''));
    }
  }

  const exitCode = proc.exitCode;
  if (exitCode !== null && exitCode !== 0 && exitCode !== 1) {
    bump('error', `unexplained runner exit code ${exitCode}`);
  }
  const failRecords = scoped.filter((r) => r.kind === 'FAIL');
  if (exitCode === 0 && failRecords.length > 0) {
    bump('error', 'runner exited 0 but printed FAIL records — exit/result contradiction (FAIL findings retained)');
  }
  if (exitCode === 1 && failRecords.length === 0 && !isWrapperScope) {
    bump('error', 'runner exited 1 with no FAIL records — unexplained nonzero exit');
  }
  if (exitCode === 1 && failRecords.length === 0 && isWrapperScope && (baseExit === null || baseExit === 0)) {
    bump('error', 'wrapper exited 1 with no FAIL records and the nested base exited 0 — unexplained nonzero exit');
  }

  for (const record of scoped) checks.push(recordToCheck(scopeLabel, record));

  const completion: CheckResult = { check: `${scopeLabel}/completion`, status: completionStatus, findings: [], reasons: completionReasons };
  return { checks, completion };
}

// ─── Structured auxiliary checks ─────────────────────────────────────────────

function structuredCheck(id: string, acquisition: StructuredAcquisition): CheckResult {
  const findings = acquisition.findings.map((f) => ({
    severity: f.severity,
    check: id,
    message: f.message,
    ...(f.location ? { location: f.location } : {}),
  }));
  return { check: id, status: acquisition.status, findings, reasons: acquisition.reasons };
}

function runStructuredAuxiliaries(root: string): CheckResult[] {
  const checks: CheckResult[] = [];
  try {
    checks.push(structuredCheck('structured/d1-skills', acquireD1Structured(root)));
  } catch (err) {
    checks.push({ check: 'structured/d1-skills', status: 'error', findings: [], reasons: [`acquisition failed: ${(err as Error).message}`] });
  }
  try {
    checks.push(structuredCheck('structured/d1-rules', acquireD1RulesStructured(root)));
  } catch (err) {
    checks.push({ check: 'structured/d1-rules', status: 'error', findings: [], reasons: [`acquisition failed: ${(err as Error).message}`] });
  }
  try {
    checks.push(structuredCheck('structured/d2-json-configs', acquireD2Structured(root)));
  } catch (err) {
    checks.push({ check: 'structured/d2-json-configs', status: 'error', findings: [], reasons: [`acquisition failed: ${(err as Error).message}`] });
  }
  return checks;
}

// ─── Exit semantics ──────────────────────────────────────────────────────────

export function deriveExitCode(result: AuditResult): number {
  if (result.invocationError) return 2;
  const bad = result.checks.some((c) => c.status === 'incomplete' || c.status === 'error');
  if (bad) return 2;
  return result.counts.blocking > 0 ? 1 : 0;
}

function tally(checks: CheckResult[]): AuditResult['counts'] {
  const checksByStatus: Record<CheckStatus, number> = { passed: 0, violations: 0, 'not-applicable': 0, incomplete: 0, error: 0 };
  for (const c of checks) checksByStatus[c.status] += 1;
  const findings = checks.flatMap((c) => c.findings);
  return {
    blocking: findings.filter((f) => f.severity === 'blocking').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    checksByStatus,
  };
}

// ─── Audit execution ─────────────────────────────────────────────────────────

export async function executeAudit(argv: string[]): Promise<AuditResult> {
  const parsed = parseArgs(argv);
  const result: AuditResult = {
    schema: RESULT_SCHEMA,
    requestedProfile: (parsed.profile as Profile) ?? null,
    resolvedTarget: '',
    runner: null,
    chainedBase: null,
    r4Helper: null,
    checks: [],
    findings: [],
    counts: { blocking: 0, warning: 0, checksByStatus: { passed: 0, violations: 0, 'not-applicable': 0, incomplete: 0, error: 0 } },
    complete: false,
    process: null,
    diagnostics: { dir: parsed.diagnosticsDir ?? null, written: [], writeError: null, excerpts: null, fullLogsRetained: false },
  };

  if (parsed.errors.length > 0) {
    result.invocationError = parsed.errors.join('; ');
    return result;
  }

  const rootCheck = validateRoot(parsed.projectRoot!);
  result.resolvedTarget = rootCheck.resolved;
  if (rootCheck.error) {
    result.invocationError = rootCheck.error;
    return result;
  }
  const root = rootCheck.resolved;

  if (parsed.diagnosticsDir !== undefined) {
    result.diagnostics.dir = resolve(parsed.diagnosticsDir);
    try {
      const diagAbs = physicalDestination(parsed.diagnosticsDir);
      result.diagnostics.dir = diagAbs;
      if (!isOutsideTree(realpathSync(root), diagAbs)) {
        result.invocationError = `--diagnostics-dir must be outside the audited tree: ${diagAbs} is inside ${root}`;
        return result;
      }
      for (const name of ['runner-stdout.txt', 'runner-stderr.txt', 'result.json']) {
        try {
          if (lstatSync(join(diagAbs, name)).isSymbolicLink()) {
            result.invocationError = `diagnostics destination must not be a symlink: ${join(diagAbs, name)}`;
            return result;
          }
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err;
        }
      }
    } catch (err) {
      // Unverifiable output permissions must not suppress independent read-only checks.
      // Keep the failure and skip every write to this unresolved destination.
      result.diagnostics.writeError = `diagnostics location cannot be resolved: ${(err as Error).message}`;
    }
  }

  const profile = parsed.profile as Profile;
  const timeoutMs = parsed.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = parsed.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  // Structured D1/D2 auxiliaries run for EVERY profile — including the
  // unsupported-main branch (react-native) and missing-runner incompletes.
  const checks: CheckResult[] = runStructuredAuxiliaries(root);

  let identities: RunnerIdentityTable | null = null;
  try {
    identities = getRunnerIdentities();
  } catch (err) {
    checks.push({
      check: 'main',
      status: 'incomplete',
      findings: [],
      reasons: [`runner identity table unavailable — build-derived module not injected: ${(err as Error).message}`],
    });
  }

  let proc: ProcessResultInfo | null = null;
  let runnerOutput: RunnerOutput | null = null;

  if (identities) {
    if (profile === 'react-native') {
      checks.push({ check: 'main', status: 'incomplete', findings: [], reasons: [RN_NOT_ADMITTED_REASON] });
    } else {
      const kind = profile as RunnerKind;
      const ident = identities.runners[kind];
      const runnerSel = selectRunner(root, kind, ident);
      result.runner = runnerSel.selection;

      let chainedProblem: string | null = null;
      if (kind !== 'base') {
        const chainedIdent = ident.chainedBase ?? identities.runners.base;
        const chainedSel = selectRunner(root, 'base', chainedIdent);
        result.chainedBase = chainedSel.selection;
        if (chainedSel.problem) {
          if (chainedSel.selection.actualSha256 === null) {
            // Chained base missing: the wrapper skips it itself — run the wrapper,
            // but the base scope stays honestly incomplete (wrapper exit 0 ≠ complete).
            chainedProblem = `chained-base-missing:${chainedSel.problem}`;
          } else {
            // Chained base bytes unsupported: running the wrapper would execute
            // unadmitted bytes — do NOT run it.
            chainedProblem = `chained-base-unsupported:${chainedSel.problem}`;
          }
        }
      }

      // R4 helper admission (kickoff-d0 §3 "the invoked R4 helper where applicable"):
      // when the target delivers scripts/audit-r4.ts, its bytes must match the
      // build-derived identity — the base runner executes it via `npx tsx`, so
      // unadmitted helper bytes are the same unsupported-format case as unadmitted
      // runner bytes: recorded, refused, never silently executed. An absent helper
      // stays the runner's own applicability call (generic/node-free layouts).
      let helperProblem: string | null = null;
      const helperIdent = identities.runners.base.r4Helper;
      if (helperIdent) {
        const helperSel = selectRunner(root, 'base', helperIdent);
        if (helperSel.selection.actualSha256 !== null) {
          result.r4Helper = helperSel.selection;
          if (!helperSel.selection.admitted) helperProblem = helperSel.problem;
        }
      }

      if (helperProblem) {
        checks.push({ check: 'main', status: 'incomplete', findings: [], reasons: [helperProblem] });
      } else if (runnerSel.problem) {
        const reasons = [runnerSel.problem];
        if (chainedProblem) reasons.push(chainedProblem.slice(chainedProblem.indexOf(':') + 1));
        checks.push({ check: 'main', status: 'incomplete', findings: [], reasons });
      } else if (chainedProblem?.startsWith('chained-base-unsupported:')) {
        checks.push({ check: 'main', status: 'incomplete', findings: [], reasons: [runnerSel.problem ?? '', chainedProblem.slice('chained-base-unsupported:'.length)].filter(Boolean) });
      } else {
        if (chainedProblem) {
          checks.push({ check: 'main/chained-base', status: 'incomplete', findings: [], reasons: [chainedProblem.slice('chained-base-missing:'.length)] });
        }
        runnerOutput = await runBounded(join(root, ident.script), root, timeoutMs, maxOutputBytes);
        proc = {
          exitCode: runnerOutput.exitCode,
          timedOut: runnerOutput.timedOut,
          overflowed: runnerOutput.overflowed,
          killed: runnerOutput.killed,
          stdoutBytes: runnerOutput.stdoutBytes,
          stderrBytes: runnerOutput.stderrBytes,
        };
        result.process = proc;

        if (runnerOutput.spawnError) {
          checks.push({ check: 'main', status: 'error', findings: [], reasons: [`runner process failed to start: ${runnerOutput.spawnError}`] });
        } else {
          const parse = parseRunnerOutput(kind !== 'base', runnerOutput.stdout);
          const baseExit = kind === 'base' ? runnerOutput.exitCode : null;
          const baseEval = evaluateScope({
            scopeLabel: 'base',
            scope: 'base',
            isWrapperScope: false,
            baseExit,
            proc: { exitCode: kind === 'base' ? runnerOutput.exitCode! : baseSummaryExit(parse, runnerOutput.exitCode), timedOut: runnerOutput.timedOut, overflowed: runnerOutput.overflowed, killed: runnerOutput.killed },
            stdout: runnerOutput.stdout,
            parse,
          });
          checks.push(...baseEval.checks, baseEval.completion);

          if (kind !== 'base') {
            const wrapperEval = evaluateScope({
              scopeLabel: kind,
              scope: 'wrapper',
              isWrapperScope: true,
              baseExit: inferWrapperBaseExit(parse, runnerOutput.exitCode),
              proc: { exitCode: runnerOutput.exitCode!, timedOut: runnerOutput.timedOut, overflowed: runnerOutput.overflowed, killed: runnerOutput.killed },
              stdout: runnerOutput.stdout,
              parse,
            });
            checks.push(...wrapperEval.checks, wrapperEval.completion);
          }
        }
      }
    }
  }

  result.checks = checks;
  result.counts = tally(checks);
  result.findings = checks.flatMap((c) => c.findings);
  result.complete = !result.invocationError && !checks.some((c) => c.status === 'incomplete' || c.status === 'error');

  // Diagnostics: only at the explicit requested location (outside the tree).
  if (result.diagnostics.dir) {
    try {
      if (result.diagnostics.writeError) throw new Error(result.diagnostics.writeError);
      mkdirSync(result.diagnostics.dir, { recursive: true });
      if (runnerOutput) {
        writeDiagnostic(result.diagnostics.dir, 'runner-stdout.txt', runnerOutput.stdout);
        writeDiagnostic(result.diagnostics.dir, 'runner-stderr.txt', runnerOutput.stderr);
        result.diagnostics.written.push('runner-stdout.txt', 'runner-stderr.txt');
      }
      writeDiagnostic(result.diagnostics.dir, 'result.json', `${JSON.stringify(result, null, 2)}\n`);
      // Recorded only after the writes succeeded — a failed write must not leave
      // `written` claiming files that do not exist (cold-review MINOR).
      result.diagnostics.written.push('result.json');
      result.diagnostics.fullLogsRetained = true;
    } catch (err) {
      result.diagnostics.writeError = `failed to write diagnostics: ${(err as Error).message}`;
      checks.push({ check: 'diagnostics-write', status: 'error', findings: [], reasons: [result.diagnostics.writeError] });
      result.checks = checks;
      result.counts = tally(checks);
      result.findings = checks.flatMap((c) => c.findings);
      result.complete = false;
    }
  } else if (runnerOutput) {
    result.diagnostics.excerpts = {
      stdout: runnerOutput.stdout.slice(0, EXCERPT_CHARS),
      stderr: runnerOutput.stderr.slice(0, EXCERPT_CHARS),
    };
  }

  return result;
}

/**
 * For a wrapper run, the nested base's own exit is not directly observable —
 * the wrapper swallows it into FAIL_COUNT. For base-scope exit semantics we use
 * the base summary's FAIL count: >0 means the base itself reported violations
 * (exit 1 by the base's own contract); 0 means exit 0. Null when the base
 * summary is missing (the completion check handles that as its own error).
 */
function baseSummaryExit(parse: ReturnType<typeof parseRunnerOutput>, _wrapperExit: number | null): number | null {
  const baseSummary = parse.summaries.find((s) => s.scope === 'base');
  if (!baseSummary) return null;
  return baseSummary.fail > 0 ? 1 : 0;
}

/** Wrapper's nested-base exit as observable: base summary FAIL>0 ⇒ base exit 1. */
function inferWrapperBaseExit(parse: ReturnType<typeof parseRunnerOutput>, _wrapperExit: number | null): number | null {
  return baseSummaryExit(parse, _wrapperExit);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let result: AuditResult;
  try {
    result = await executeAudit(process.argv.slice(2));
  } catch (err) {
    result = {
      schema: RESULT_SCHEMA,
      requestedProfile: null,
      resolvedTarget: '',
      invocationError: `launcher error: ${(err as Error).message}`,
      runner: null,
      chainedBase: null,
      r4Helper: null,
      checks: [],
      findings: [],
      counts: { blocking: 0, warning: 0, checksByStatus: { passed: 0, violations: 0, 'not-applicable': 0, incomplete: 0, error: 0 } },
      complete: false,
      process: null,
      diagnostics: { dir: null, written: [], writeError: null, excerpts: null, fullLogsRetained: false },
    };
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(deriveExitCode(result));
}

if (isDirectRun(process.argv[1], import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`living-docs-audit failed: ${(err as Error).message}\n`);
    process.exit(2);
  });
}
