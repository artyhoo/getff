/**
 * ocrTrustedReview.ts — one native OCR review invocation bound to a current, complete declared input set.
 *
 * Usage (getff-ocr-reuse C1b; closed argv, no passthrough):
 *   tsx ocrTrustedReview.ts --task ID --aif-url URL --repo ABSOLUTE_REPO
 *     --backend-root ABSOLUTE_BACKEND_PREFIX --native-root ABSOLUTE_NATIVE_PREFIX
 *     --base-ref REF --materials ABSOLUTE_MANIFEST_JSON
 *     --ocr-bin ABSOLUTE_NATIVE_EXECUTABLE --ocr-sha256 EXPECTED_SHA256
 *     [--rule-file ABSOLUTE_INLINE_RULE_JSON] [--exclude PATTERNS] [--json]
 *
 * What this is: a thin producer adapter. It reads a CURRENT AIF task, binds an
 * explicit local view of its candidate checkout (backend/native root mapping,
 * full commit identity, tracked-clean policy), delivers the COMPLETE declared
 * review inputs through OCR's PUBLIC rule-file interface, runs the ready full
 * OCR product ONCE, and checks the response with the accepted C1a comparison.
 * Upstream performs its own pipeline — no queue, retry controller, session
 * store, chunker, private OCR imports, copied rule resolver or producer-hash
 * clone lives here.
 *
 * What this is NOT: exit 0 means only "compatible native invocation at its T1
 * snapshot" — neither a semantic ResultReview, approval, fulfilled project
 * duty, freshness guarantee nor merge permission. Exit 2/HOLD blocks reliance.
 *
 * Exits: 0 compatible, 2 HOLD (refusal to attest), 1 bad invocation/IO.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { parseCliArgs, CliArgError, isMain } from './cliEntry.js';
import type { CliArgSpec } from './cliEntry.js';
import { getTask } from './aifHttp.js';
import type { AifTaskFull } from './aifHttp.js';
import { compareOcrCoverage } from '../ocrCoverage.js';
import type { OcrCoverageComparison } from '../ocrCoverage.js';

/** Pinned public producer identity (independently derived from main.go/version.go/
 *  root.go/agent.go — never learned from a result): main.go sets
 *  llm.AppVersion = Version, root.go prints `open-code-review <Version>
 *  (<GitCommit>)`, agent.go stamps llm.AppVersion into
 *  manifest.execution.ocr_version. So C1a's expected version is fixed BEFORE
 *  any model call; a result that disagrees is rejected, never the teacher. */
const EXPECTED_OCR_VERSION = 'v1.13.3';
const EXPECTED_OCR_COMMIT_PREFIX = '375f64c';

/** Native readRuleFileSafe cap for a referenced rule file (system_rules.go).
 *  A generated criteria file above this cap is HOLD criteria-over-limit —
 *  never sliced, trimmed or summarized past the cap. */
const CRITERIA_MAX_BYTES = 512 * 1024;

const SHA256_SHAPE = /^[0-9a-f]{64}$/i;
const COMMIT_ID_SHAPE = /^[0-9a-f]{40}$/i;
const COMMIT_ID_256_SHAPE = /^[0-9a-f]{64}$/i;
/** File extensions the native resolver accepts as rule-file references. */
const RULE_REF_EXT = /\.(md|txt|markdown)$/i;

const utf8Strict = new TextDecoder('utf-8', { fatal: true });

const decodeStrict = (buf: Buffer): string => utf8Strict.decode(buf);

const sha256 = (data: Buffer | string): string =>
  createHash('sha256').update(data).digest('hex');

class TrustedHold extends Error {
  constructor(
    readonly reason: string,
    readonly detail: string,
  ) {
    super(`${reason}: ${detail}`);
    this.name = 'TrustedHold';
  }
}

/** Buffered child result. `error` is the spawn-failure code (e.g. ENOENT); the
 *  stdout/stderr payloads stay private (written to the run dir, digested) —
 *  arbitrary native stderr is never echoed into routine verdicts. */
export interface ChildResult {
  stdout: Buffer;
  stderr: Buffer;
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: string;
}

/** Injectable seam for deterministic tests: task fetch, every child process,
 *  the clock and the run-dir UUID. Tests exercise the REAL production paths
 *  (real temp git repos, real argv/file/process selection) through these. */
export interface TrustedDeps {
  getTask(baseUrl: string, taskId: string): Promise<AifTaskFull>;
  spawnChild(
    cmd: string,
    args: readonly string[],
    opts: { cwd: string; env: Record<string, string> },
  ): Promise<ChildResult>;
  now(): number;
  uuid(): string;
}

export function defaultDeps(): TrustedDeps {
  return {
    getTask,
    spawnChild: (cmd, args, opts) =>
      new Promise<ChildResult>((resolveSpawn) => {
        const child = spawn(cmd, args, {
          cwd: opts.cwd,
          env: opts.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const out: Buffer[] = [];
        const err: Buffer[] = [];
        child.stdout.on('data', (d: Buffer) => out.push(d));
        child.stderr.on('data', (d: Buffer) => err.push(d));
        child.on('error', (errObj) => {
          resolveSpawn({
            stdout: Buffer.concat(out),
            stderr: Buffer.concat(err),
            status: null,
            signal: null,
            error: (errObj as NodeJS.ErrnoException).code ?? String(errObj),
          });
        });
        child.on('close', (code, signal) => {
          resolveSpawn({
            stdout: Buffer.concat(out),
            stderr: Buffer.concat(err),
            status: code,
            signal: signal ?? null,
          });
        });
      }),
    now: () => Date.now(),
    uuid: () => randomUUID(),
  };
}

export interface TrustedReviewOptions {
  task: string;
  aifUrl: string;
  repo: string;
  backendRoot: string;
  nativeRoot: string;
  baseRef: string;
  materials: string;
  ocrBin: string;
  ocrSha256: string;
  ruleFile?: string;
  exclude?: string;
  json: boolean;
}

const CLI_SPEC: CliArgSpec = {
  options: {
    task: { type: 'string' },
    'aif-url': { type: 'string' },
    repo: { type: 'string' },
    'backend-root': { type: 'string' },
    'native-root': { type: 'string' },
    'base-ref': { type: 'string' },
    materials: { type: 'string' },
    'ocr-bin': { type: 'string' },
    'ocr-sha256': { type: 'string' },
    'rule-file': { type: 'string' },
    exclude: { type: 'string' },
    json: { type: 'boolean' },
  },
};

/** Strict argv parse (cliEntry rejects unknown flags — `--provider` and any
 *  passthrough die here — empty values, and positional junk). */
export function parseTrustedReviewArgs(
  argv: readonly string[],
): TrustedReviewOptions {
  const { values } = parseCliArgs(argv as string[], CLI_SPEC);
  const str = (name: string): string => {
    const v = values[name];
    if (typeof v !== 'string' || v === '') {
      throw new CliArgError(
        `--${name} is required (expects --${name} <value>)`,
      );
    }
    return v;
  };
  const optional = (name: string): string | undefined => {
    const v = values[name];
    return typeof v === 'string' && v !== '' ? v : undefined;
  };
  const opts: TrustedReviewOptions = {
    task: str('task'),
    aifUrl: str('aif-url'),
    repo: str('repo'),
    backendRoot: str('backend-root'),
    nativeRoot: str('native-root'),
    baseRef: str('base-ref'),
    materials: str('materials'),
    ocrBin: str('ocr-bin'),
    ocrSha256: str('ocr-sha256'),
    ruleFile: optional('rule-file'),
    exclude: optional('exclude'),
    json: values['json'] === true,
  };
  if (!SHA256_SHAPE.test(opts.ocrSha256)) {
    throw new CliArgError('--ocr-sha256 must be a full 64-hex SHA-256 value');
  }
  const absolute: [string, string][] = [
    ['repo', opts.repo],
    ['backend-root', opts.backendRoot],
    ['native-root', opts.nativeRoot],
    ['materials', opts.materials],
    ['ocr-bin', opts.ocrBin],
  ];
  if (opts.ruleFile !== undefined) absolute.push(['rule-file', opts.ruleFile]);
  for (const [name, value] of absolute) {
    if (!value.startsWith('/')) {
      throw new CliArgError(`--${name} must be an absolute path`);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Path mapping — component containment, never string-prefix substitution
// (a `/a/b-evil` sibling must NOT match a `/a/b` root).
// ---------------------------------------------------------------------------

const comps = (p: string): string[] => p.split('/').filter((c) => c !== '');

const isUnder = (root: string, path: string): boolean => {
  const r = comps(root);
  const p = comps(path);
  return r.length > 0 && p.length >= r.length && r.every((c, i) => c === p[i]);
};

/** Map the task's absolute BACKEND worktreePath through the explicit backend/
 *  native root pair by path-component containment. Returns null when the
 *  worktree is not inside the backend root (sibling prefix, traversal, null).
 *  Identity mapping is the explicit identical-roots case. */
export function mapBackendToNative(
  worktreePath: string,
  backendRoot: string,
  nativeRoot: string,
): string | null {
  if (!worktreePath.startsWith('/') || worktreePath.includes('\0')) return null;
  if (!backendRoot.startsWith('/') || !nativeRoot.startsWith('/')) return null;
  // A literal `..`/`.` component anywhere in the three paths is traversal by
  // construction — containment math must never normalize it away.
  for (const p of [worktreePath, backendRoot, nativeRoot]) {
    if (comps(p).some((c) => c === '..' || c === '.')) return null;
  }
  if (!isUnder(backendRoot, worktreePath)) return null;
  const rem = comps(worktreePath).slice(comps(backendRoot).length);
  const mapped = ['', ...comps(nativeRoot), ...rem].join('/');
  return mapped === '' ? '/' : mapped;
}

// ---------------------------------------------------------------------------
// NUL-split git output parsing — paths are strict-UTF-8-decoded per field, so
// spaces, tabs, newlines and Unicode never get line-split.
// ---------------------------------------------------------------------------

interface DiffRecord {
  status: string;
  /** R/C: [old, new] — order pinned empirically on git 2.53.0
   *  (`R100\0<old>\0<new>\0` for `--name-status -z --find-renames`); locked by
   *  the ocr-trusted-review tests. */
  paths: string[];
}

const splitZ = (buf: Buffer): Buffer[] => {
  const fields: Buffer[] = [];
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0) {
      if (i > start) fields.push(buf.subarray(start, i));
      start = i + 1;
    }
  }
  return fields;
};

const decodePath = (field: Buffer): string => {
  try {
    return decodeStrict(field);
  } catch {
    throw new TrustedHold(
      'invalid-path-encoding',
      'a Git path is not valid UTF-8; NUL-split fields must decode strictly',
    );
  }
};

/** `git diff --name-status -z --find-renames BASE HEAD --` records. Statuses
 *  A/M/D carry one path; R<score>/C<score> carry old then new; anything else
 *  (T, U, X, B, …) is a named HOLD, never a silent skip. */
export function parseNameStatusZ(buf: Buffer): DiffRecord[] {
  const fields = splitZ(buf);
  const records: DiffRecord[] = [];
  let i = 0;
  while (i < fields.length) {
    const status = fields[i].toString('latin1');
    if (/^[AMD]$/.test(status)) {
      records.push({ status, paths: [decodePath(fields[i + 1] as Buffer)] });
      i += 2;
    } else if (/^[RC]\d+$/.test(status)) {
      records.push({
        status,
        paths: [
          decodePath(fields[i + 1] as Buffer),
          decodePath(fields[i + 2] as Buffer),
        ],
      });
      i += 3;
    } else {
      throw new TrustedHold(
        'unsupported-status',
        `diff status "${status}" is not supported (supported: A, M, D, R<score>, C<score>)`,
      );
    }
  }
  return records;
}

/** Required review identity per record: the NEW rename/copy path, the OLD
 *  deletion path, otherwise the sole path. Old+new are never two items and OCR
 *  item IDs are never reproduced. */
export const requiredPathOf = (rec: DiffRecord): string =>
  rec.status.startsWith('R') || rec.status.startsWith('C')
    ? (rec.paths[1] as string)
    : (rec.paths[0] as string);

/** `git status --porcelain=v1 -z --untracked-files=all` → tracked-dirty flag +
 *  untracked repo-relative paths. Unlike `--name-status -z`, porcelain keeps
 *  XY and the path in ONE NUL-terminated field (`?? untracked.txt\0` — pinned
 *  empirically on git 2.53.0); only rename/copy records carry a second field
 *  (the orig path). A malformed record reads conservatively dirty. */
export function parseStatusZ(buf: Buffer): {
  dirty: boolean;
  untracked: string[];
} {
  const fields = splitZ(buf);
  let dirty = false;
  const untracked: string[] = [];
  let i = 0;
  while (i < fields.length) {
    const rec = decodePath(fields[i] as Buffer);
    if (rec.length < 4 || rec[2] !== ' ') {
      dirty = true;
      i += 1;
      continue;
    }
    const xy = rec.slice(0, 2);
    if (xy === '??') {
      untracked.push(rec.slice(3));
      i += 1;
    } else {
      dirty = true;
      i += /[RC]/.test(xy) ? 2 : 1;
    }
  }
  return { dirty, untracked };
}

// ---------------------------------------------------------------------------
// Materials / caller rule file / criteria minting / ambient / executable
// ---------------------------------------------------------------------------

interface MaterialRef {
  path: string;
  sha256: string;
}

interface VerifiedMaterial {
  path: string;
  sha256: string;
  content: string;
}

export function parseMaterialsManifest(bytes: Buffer): MaterialRef[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeStrict(bytes));
  } catch (err) {
    throw new CliArgError(
      `--materials is not strict UTF-8 JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new CliArgError(
      '--materials must be a JSON array of {path, sha256} records',
    );
  }
  const refs: MaterialRef[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new CliArgError('--materials entries must be objects');
    }
    const rec = entry as Record<string, unknown>;
    const keys = Object.keys(rec).sort();
    if (keys.length !== 2 || keys[0] !== 'path' || keys[1] !== 'sha256') {
      throw new CliArgError(
        '--materials entries must have exactly {path, sha256}',
      );
    }
    const p = rec['path'];
    const s = rec['sha256'];
    if (
      typeof p !== 'string' ||
      p === '' ||
      p.startsWith('/') ||
      p.split('/').includes('..') ||
      p.includes('\0')
    ) {
      throw new CliArgError(
        `material path ${JSON.stringify(p)} is not repo-relative`,
      );
    }
    if (typeof s !== 'string' || !SHA256_SHAPE.test(s)) {
      throw new CliArgError(
        `material ${JSON.stringify(p)} sha256 is not a full 64-hex value`,
      );
    }
    if (seen.has(p)) {
      throw new CliArgError(
        `material path ${JSON.stringify(p)} declared twice`,
      );
    }
    seen.add(p);
    refs.push({ path: p, sha256: s.toLowerCase() });
  }
  return refs;
}

/** Hash-check each COMPLETE declared file (never a reference while withholding
 *  content): regular file, inside the repo, strict UTF-8 text, digest match. */
export function loadMaterials(
  repoReal: string,
  declared: MaterialRef[],
): VerifiedMaterial[] {
  return declared.map((ref) => {
    const abs = resolve(repoReal, ref.path);
    let st;
    try {
      st = lstatSync(abs);
    } catch {
      throw new TrustedHold(
        'material-missing',
        `material "${ref.path}" is missing`,
      );
    }
    if (!st.isFile()) {
      throw new TrustedHold(
        'material-invalid',
        `material "${ref.path}" is not a regular file`,
      );
    }
    let real: string;
    try {
      real = realpathSync(abs);
    } catch {
      throw new TrustedHold(
        'material-missing',
        `material "${ref.path}" cannot be resolved`,
      );
    }
    if (!isUnder(repoReal, real)) {
      throw new TrustedHold(
        'material-escape',
        `material "${ref.path}" resolves outside the repo`,
      );
    }
    const bytes = readFileSync(abs);
    const digest = sha256(bytes).toLowerCase();
    if (digest !== ref.sha256) {
      throw new TrustedHold(
        'material-digest',
        `material "${ref.path}" sha256 ${digest} != declared ${ref.sha256}`,
      );
    }
    let content: string;
    try {
      content = decodeStrict(bytes);
    } catch {
      throw new TrustedHold(
        'material-invalid',
        `material "${ref.path}" is not valid UTF-8 text`,
      );
    }
    if (content.includes('\0')) {
      throw new TrustedHold(
        'material-invalid',
        `material "${ref.path}" contains NUL bytes (unsupported binary)`,
      );
    }
    return { path: ref.path, sha256: digest, content };
  });
}

export interface CallerRuleFile {
  rules: { path: string; rule: string; merge_system_rule?: boolean }[];
  include?: string[];
  exclude?: string[];
}

/** Only explicit INLINE rules with native keys; unknown shapes and any
 *  ambiguous external-file reference are rejected rather than chased. */
export function parseCallerRuleFile(bytes: Buffer): CallerRuleFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeStrict(bytes));
  } catch (err) {
    throw new CliArgError(
      `--rule-file is not strict UTF-8 JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CliArgError('--rule-file must be an object');
  }
  const obj = parsed as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== 'rules' && key !== 'include' && key !== 'exclude') {
      throw new CliArgError(`--rule-file unknown top-level key "${key}"`);
    }
  }
  if (!Array.isArray(obj['rules'])) {
    throw new CliArgError('--rule-file requires a "rules" array');
  }
  const rules = (obj['rules'] as unknown[]).map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new CliArgError('--rule-file rules entries must be objects');
    }
    const rec = entry as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (key !== 'path' && key !== 'rule' && key !== 'merge_system_rule') {
        throw new CliArgError(`--rule-file rule entry unknown key "${key}"`);
      }
    }
    const path = rec['path'];
    const rule = rec['rule'];
    const merge = rec['merge_system_rule'];
    if (typeof path !== 'string' || path === '') {
      throw new CliArgError('--rule-file rule entry needs a non-empty "path"');
    }
    if (typeof rule !== 'string' || rule.trim() === '') {
      throw new CliArgError(
        '--rule-file rule entry needs non-empty inline "rule" text',
      );
    }
    if (merge !== undefined && typeof merge !== 'boolean') {
      throw new CliArgError('--rule-file merge_system_rule must be boolean');
    }
    if (!rule.includes('\n') && !/\s/.test(rule) && RULE_REF_EXT.test(rule)) {
      throw new CliArgError(
        `--rule-file rule value ${JSON.stringify(rule)} is ambiguous (space-free rule-file ` +
          `extension could be read as a file reference) — pass inline text, not a file reference`,
      );
    }
    return merge === undefined
      ? { path, rule }
      : { path, rule, merge_system_rule: merge };
  });
  const out: CallerRuleFile = { rules };
  for (const key of ['include', 'exclude'] as const) {
    const v = obj[key];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.some((e) => typeof e !== 'string' || e === '')) {
      throw new CliArgError(
        `--rule-file ${key} must be an array of non-empty strings`,
      );
    }
    out[key] = [...(v as string[])];
  }
  return out;
}

export interface MintedCriteria {
  rulesJson: string;
  files: { name: string; content: string }[];
}

/** Mint the private criteria files + the custom rule JSON. References are
 *  space-free ADJACENT filenames relative to the minted JSON's own directory —
 *  the native custom loader resolves references from the CUSTOM JSON directory
 *  (system_rules.go:392-401), NOT from the repo root, and silently empties
 *  missing refs; minting anywhere else would feed that silent-empty state. */
export function mintCriteria(
  runDir: string,
  callerRules: CallerRuleFile | null,
  capsule: string,
): MintedCriteria {
  const files: { name: string; content: string }[] = [];
  const entries =
    callerRules?.rules.map((e, i) => {
      const name = `criteria-${i}.md`;
      files.push({ name, content: `${e.rule}\n${capsule}` });
      return e.merge_system_rule === undefined
        ? { path: e.path, rule: name }
        : { path: e.path, rule: name, merge_system_rule: e.merge_system_rule };
    }) ?? [];
  files.push({ name: 'criteria-final.md', content: capsule });
  const mintedRules = {
    rules: [
      ...entries,
      { path: '**', rule: 'criteria-final.md', merge_system_rule: true },
    ],
    ...(callerRules?.include !== undefined
      ? { include: [...callerRules.include] }
      : {}),
    ...(callerRules?.exclude !== undefined
      ? { exclude: [...callerRules.exclude] }
      : {}),
  };
  const rulesJson = JSON.stringify(mintedRules);
  files.push({ name: 'rules.json', content: rulesJson });
  for (const f of files) {
    const size = Buffer.byteLength(f.content, 'utf8');
    if (size > CRITERIA_MAX_BYTES) {
      throw new TrustedHold(
        'criteria-over-limit',
        `generated ${f.name} is ${size} bytes > native ${CRITERIA_MAX_BYTES}-byte rule-file cap — never sliced`,
      );
    }
  }
  for (const f of files) {
    writePrivate(join(runDir, f.name), Buffer.from(f.content, 'utf8'));
  }
  return { rulesJson, files };
}

/** T1: every minted file must still be byte-identical — a deleted/replaced
 *  criteria file cannot look successful. */
function mintUnchanged(runDir: string, mint: MintedCriteria): boolean {
  for (const f of mint.files) {
    try {
      if (readFileSync(join(runDir, f.name)).toString('utf8') !== f.content)
        return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Ambient presence classification: ENOENT is the ONLY proven absence — any
 *  other lstat failure (EACCES/EIO/ELOOP/ENOTDIR) leaves the settings state
 *  UNKNOWN, never absent. A dangling symlink lstats present (listed-but-
 *  dangling is refused as present, not unknown). */
type AmbientPresence = 'absent' | 'present' | 'unknown';

function readAmbient(
  repoReal: string,
  home: string,
): { project: AmbientPresence; global: AmbientPresence } {
  const check = (p: string): AmbientPresence => {
    try {
      lstatSync(p);
      return 'present'; // dangling/inaccessible-but-listed is NOT absent
    } catch (err) {
      return (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'absent'
        : 'unknown';
    }
  };
  return {
    project: check(join(repoReal, '.opencodereview', 'rule.json')),
    global: check(join(home, '.opencodereview', 'rule.json')),
  };
}

/** Runtime-config binding: hash its bytes, record PROVEN absence (ENOENT
 *  only), or classify the failure — listed-but-unreadable is `unreadable`; a
 *  presence probe that failed without proving absence is `unknown`, never a
 *  clean empty profile. Exported for the probe witnesses: this site and the
 *  global ambient probe share the ~/.opencodereview parent directory, so a
 *  real parent-level lstat failure can never hit the config probe alone. */
export type RuntimeConfigBinding =
  | { sha256: string }
  | 'absent'
  | 'unreadable'
  | 'unknown';

export function readRuntimeConfig(home: string): RuntimeConfigBinding {
  const p = join(home, '.opencodereview', 'config.json');
  try {
    lstatSync(p);
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'absent'
      : 'unknown';
  }
  try {
    return { sha256: sha256(readFileSync(p)) };
  } catch {
    return 'unreadable';
  }
}

async function bindExecutable(
  deps: TrustedDeps,
  opts: TrustedReviewOptions,
  cwd: string,
  env: Record<string, string>,
): Promise<{ digest: string; version: string }> {
  let st;
  try {
    st = lstatSync(opts.ocrBin);
  } catch {
    throw new TrustedHold(
      'executable-absent',
      `--ocr-bin ${opts.ocrBin} is missing`,
    );
  }
  if (!st.isFile() || (st.mode & 0o111) === 0) {
    throw new TrustedHold(
      'executable-invalid',
      `--ocr-bin ${opts.ocrBin} is not a regular executable`,
    );
  }
  const digest = sha256(readFileSync(opts.ocrBin));
  if (digest !== opts.ocrSha256.toLowerCase()) {
    throw new TrustedHold(
      'executable-digest',
      `--ocr-bin sha256 ${digest} != expected ${opts.ocrSha256.toLowerCase()}`,
    );
  }
  const r = await deps.spawnChild(opts.ocrBin, ['--version'], { cwd, env });
  if (r.error || r.status !== 0) {
    throw new TrustedHold(
      'executable-version',
      `--version failed (${r.error ?? `exit ${r.status}`})`,
    );
  }
  const banner = r.stdout.toString('utf8');
  const m = /^open-code-review (v\S+) \(([0-9a-f]{7,64})\)/.exec(banner);
  if (
    !m ||
    m[1] !== EXPECTED_OCR_VERSION ||
    !m[2].startsWith(EXPECTED_OCR_COMMIT_PREFIX)
  ) {
    throw new TrustedHold(
      'executable-version',
      `--version banner ${JSON.stringify(banner.trim())} is not ${EXPECTED_OCR_VERSION} (${EXPECTED_OCR_COMMIT_PREFIX})`,
    );
  }
  return { digest, version: m[1] };
}

interface InspectionResult {
  path: string;
  exit: number | null;
  capsuleFound: boolean;
  outputSha256: string;
}

/** Public `ocr rules check --repo REPO --rule MINTED --color never -- PATH` per
 *  required path (the positional PATH follows `--`, so leading-dash paths reach
 *  inspection). The pinned command prints the rule detail inside one outer
 *  frame: an ANCHORED prologue — `File: <exact requested path>`, the custom
 *  source label, `Pattern: <selected entry's original path value>`, `Rule:` —
 *  the opening 40-box separator, the body, and a single terminal closing
 *  separator with exact line termination. The frame is matched as an exact
 *  string prefix/suffix, never a search through the payload: inline Rule:/File:
 *  text inside the body stays ordinary content and can neither forge nor break
 *  the frame. Allowed Pattern values come from the minted expected rule JSON
 *  (caller order preserved, identical values collapsed); an unrecognized or
 *  multiple-possible prologue, a missing/extra terminal separator, a body line
 *  that is itself a structural separator (ambiguous output), or a capsule
 *  outside the validated body — all HOLD. Raw output stays private (+digest),
 *  never rule bodies. */
async function inspectPaths(
  deps: TrustedDeps,
  opts: TrustedReviewOptions,
  cwd: string,
  env: Record<string, string>,
  runDir: string,
  requiredPaths: string[],
  capsule: string,
  patterns: string[],
  phase: 't0' | 't1',
): Promise<InspectionResult[]> {
  const out: InspectionResult[] = [];
  for (const p of requiredPaths) {
    const r = await deps.spawnChild(
      opts.ocrBin,
      [
        'rules',
        'check',
        '--repo',
        cwd,
        '--rule',
        join(runDir, 'rules.json'),
        '--color',
        'never',
        '--',
        p,
      ],
      { cwd, env },
    );
    let text: string | null = null;
    try {
      text = decodeStrict(r.stdout);
    } catch {
      text = null;
    }
    writePrivate(
      join(runDir, `inspection-${phase}-${sha256(p).slice(0, 16)}.txt`),
      r.stdout,
    );
    if (r.error || r.status !== 0 || text === null) {
      throw new TrustedHold(
        phase === 't0' ? 'inspection-failed' : 'stale-inspection',
        `native rules check failed for "${p}" (${r.error ?? `exit ${r.status}`})`,
      );
    }
    // Pinned public outer frame (cmd/opencodereview rules_cmd.go printer): the
    // custom branch emits exactly
    //   File: <path>\nSource: Custom (--rule)\nPattern: <entry path>\nRule:\n
    //   ────…\n<detail.Rule>\n────…\n
    // with no Note/SniffedAs line. We anchor on that full prologue and require
    // a single terminal closing separator — no occurrence scans through the
    // payload, so a newline inside the requested path needs no line-splitting
    // and body content cannot masquerade as structure.
    const SEP = '─'.repeat(40);
    const CLOSE = `${SEP}\n`;
    const prefixOf = (pattern: string): string =>
      `File: ${p}\nSource: Custom (--rule)\nPattern: ${pattern}\nRule:\n${SEP}\n`;
    const anchored = patterns
      .map(prefixOf)
      .filter((pre) => text.startsWith(pre));
    if (anchored.length !== 1) {
      throw new TrustedHold(
        phase === 't0' ? 'inspection-framing' : 'stale-inspection',
        anchored.length === 0
          ? `rules check output for "${p}" does not start with the pinned outer frame`
          : `rules check output for "${p}" matches more than one minted outer frame`,
      );
    }
    const tail = text.slice(anchored[0].length);
    if (!tail.endsWith(CLOSE)) {
      throw new TrustedHold(
        phase === 't0' ? 'inspection-framing' : 'stale-inspection',
        `rules check output for "${p}" lacks a single terminal closing separator`,
      );
    }
    const bodyWithNl = tail.slice(0, tail.length - CLOSE.length);
    if (!bodyWithNl.endsWith('\n')) {
      throw new TrustedHold(
        phase === 't0' ? 'inspection-framing' : 'stale-inspection',
        `rules check rule body for "${p}" is not newline-terminated by the public printer`,
      );
    }
    const body = bodyWithNl.slice(0, -1);
    if (body.split('\n').includes(SEP)) {
      // The public printer does not escape separator look-alikes inside the
      // body, so such output is structurally ambiguous — never guess which
      // separator is real, never trim or rewrite the caller's criteria.
      throw new TrustedHold(
        phase === 't0' ? 'inspection-framing' : 'stale-inspection',
        `rules check rule body for "${p}" contains a structural separator line — ambiguous output`,
      );
    }
    if (!body.includes(capsule)) {
      throw new TrustedHold(
        phase === 't0' ? 'inspection-lost-capsule' : 'stale-inspection',
        `rules check Rule body for "${p}" does not contain the complete capsule`,
      );
    }
    out.push({
      path: p,
      exit: r.status,
      capsuleFound: true,
      outputSha256: sha256(r.stdout),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

export interface TrustedReviewVerdict {
  kind: 'ocr-trusted-review/v1';
  status: 'compatible' | 'hold';
  holdReason?: string;
  holdDetail?: string;
  repo?: string;
  runDir?: string;
  task?: { id: string; digest: string; commitSha: string };
  range?: {
    head: string;
    base: string;
    mergeBase: string;
    exactRange: string;
    records: { status: string; paths: string[] }[];
    requiredPaths: string[];
  };
  untracked0?: string[];
  untracked1?: string[];
  manifest?: { path: string; sha256: string };
  materials?: { path: string; sha256: string; bytes: number }[];
  ruleFile?: { path: string; sha256: string };
  capsuleSha256?: string;
  ambient?: { project: string; global: string };
  runtimeConfig?: string | { sha256: string };
  childEnvSha256?: string;
  executable?: { path: string; sha256: string; version: string };
  inspection?: {
    path: string;
    exit: number | null;
    capsuleFound: boolean;
    outputSha256: string;
  }[];
  /** T1 per-path native re-inspection binding (digests only, never rule
   *  bodies) — persisted so a compatible verdict carries the re-established
   *  applied-rule evidence, and a HOLD names the path whose rule moved. */
  inspection1?: {
    path: string;
    exit: number | null;
    capsuleFound: boolean;
    outputSha256: string;
  }[];
  invocation?: {
    argv: string[];
    elapsedMs: number;
    status: number | null;
    signal: NodeJS.Signals | null;
    error: string | null;
    stdoutBytes: number;
    stderrBytes: number;
    stdoutFile: string;
    stderrFile: string;
  };
  result?: { bytes: number; sha256: string };
  comparison?: OcrCoverageComparison;
}

const lineFor = (v: TrustedReviewVerdict): string =>
  v.status === 'compatible'
    ? `[runtime-bridge] ocrTrustedReview: compatible (run dir ${v.runDir ?? 'n/a'}) — ` +
      `source compatibility only, not a semantic ResultReview`
    : `[runtime-bridge] ocrTrustedReview: HOLD ${v.holdReason ?? 'unknown'} — ${v.holdDetail ?? ''}`;

function persistVerdict(runDir: string, verdict: TrustedReviewVerdict): void {
  try {
    writePrivate(
      join(runDir, 'trusted-review-verdict.json'),
      Buffer.from(JSON.stringify(verdict, null, 2), 'utf8'),
    );
  } catch {
    // A verdict that cannot be persisted must not break the exit contract.
  }
}

/** 0600 exclusive write — never overwrites an existing artifact. */
function writePrivate(path: string, bytes: Buffer): void {
  writeFileSync(path, bytes, { mode: 0o600, flag: 'wx' });
}

/** Authorized env, preserved except inherited GIT_* overrides — the same env
 *  is used for every git AND ocr child so a host hook cannot redirect
 *  -C/repo handling. Only its digest is ever recorded, never values. */
function buildChildEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith('GIT_')) env[k] = v;
  }
  return env;
}

function digestEnv(env: Record<string, string>): string {
  const parts: string[] = [];
  for (const k of Object.keys(env).sort()) parts.push(k, env[k] as string);
  return sha256(parts.join('\0'));
}

const commitIdsEqual = (a: string, b: string): boolean => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || (x.length > y.length ? x.startsWith(y) : y.startsWith(x));
};

export interface TrustedReviewRunResult {
  exitCode: 0 | 1 | 2;
  verdict: TrustedReviewVerdict | null;
  stderrLine: string;
}

export async function runTrustedReview(
  argv: readonly string[],
  deps: TrustedDeps,
): Promise<TrustedReviewRunResult> {
  let opts: TrustedReviewOptions;
  try {
    opts = parseTrustedReviewArgs(argv as string[]);
  } catch (err) {
    const msg = err instanceof CliArgError ? err.message : String(err);
    return {
      exitCode: 1,
      verdict: null,
      stderrLine: `[runtime-bridge] ocrTrustedReview: ${msg}`,
    };
  }

  const facts: TrustedReviewVerdict = {
    kind: 'ocr-trusted-review/v1',
    status: 'hold',
  };
  let runDir: string | null = null;

  const holdResult = (
    reason: string,
    detail: string,
  ): TrustedReviewRunResult => {
    const verdict: TrustedReviewVerdict = {
      ...facts,
      status: 'hold',
      holdReason: reason,
      holdDetail: detail,
    };
    if (runDir !== null) persistVerdict(runDir, verdict);
    return { exitCode: 2, verdict, stderrLine: lineFor(verdict) };
  };

  try {
    // --- canonical repo + authorized env ---------------------------------
    const repoReal = realpathSync(opts.repo);
    facts.repo = repoReal;
    const env = buildChildEnv();
    facts.childEnvSha256 = digestEnv(env);
    const home = env['HOME'];
    if (!home)
      throw new Error(
        'HOME is not set — cannot bind global ambient/config paths',
      );

    // --- fresh private run dir (before everything that can HOLD, so every
    //     hold verdict has a persisted home; its artifacts are this
    //     invocation's allowed untracked exception) -------------------------
    const runId = deps.uuid();
    runDir = join(repoReal, '.ai-factory', 'ocr', runId);
    facts.runDir = runDir;
    mkdirSync(runDir, { recursive: true, mode: 0o700 });
    if (realpathSync(runDir) !== runDir || !isUnder(repoReal, runDir)) {
      throw new Error(
        `run dir ${runDir} escapes the repo (symlinked ancestor)`,
      );
    }

    // --- git child helpers (argument-array, scrubbed env, end-of-options) --
    const gitText = async (args: string[]): Promise<string> => {
      const r = await deps.spawnChild('git', args, { cwd: repoReal, env });
      if (r.error || r.status !== 0) {
        throw new Error(
          `git ${args[0]} failed (${r.error ?? `exit ${r.status}`})`,
        );
      }
      return r.stdout.toString('utf8').trim();
    };
    const gitBuffer = async (args: string[]): Promise<Buffer> => {
      const r = await deps.spawnChild('git', args, { cwd: repoReal, env });
      if (r.error || r.status !== 0) {
        throw new Error(
          `git ${args[0]} failed (${r.error ?? `exit ${r.status}`})`,
        );
      }
      return r.stdout;
    };

    // --- T0 task identity ---------------------------------------------------
    const task = await deps.getTask(opts.aifUrl, opts.task);
    const taskJson = JSON.stringify(task);
    if (task.id !== opts.task) {
      return holdResult(
        'task-identity-mismatch',
        `task response id "${task.id}" != requested "${opts.task}"`,
      );
    }
    const projectId = task.projectId ?? '';
    const worktreePath = task.worktreePath ?? '';
    const commitSha = task.commitSha ?? '';
    if (
      !projectId.trim() ||
      !worktreePath.startsWith('/') ||
      !(
        COMMIT_ID_SHAPE.test(commitSha) || COMMIT_ID_256_SHAPE.test(commitSha)
      ) ||
      task.plan === null ||
      task.plan === undefined ||
      typeof task.title !== 'string' ||
      !task.title.trim()
    ) {
      return holdResult(
        'task-missing-fields',
        'task response lacks projectId / absolute worktreePath / full commitSha / non-null plan / title',
      );
    }
    facts.task = { id: task.id, digest: sha256(taskJson), commitSha };
    const description = task.description ?? '';
    if (!description.trim()) {
      return holdResult(
        'unknown-criteria',
        'task description is absent/blank — review criteria cannot be bound',
      );
    }

    // --- backend→native mapping ---------------------------------------------
    const mapped = mapBackendToNative(
      worktreePath,
      opts.backendRoot,
      opts.nativeRoot,
    );
    let mappedReal: string | null = null;
    try {
      mappedReal = mapped === null ? null : realpathSync(mapped);
    } catch {
      mappedReal = null;
    }
    if (mapped === null || mappedReal === null || mappedReal !== repoReal) {
      return holdResult(
        'identity-mapping',
        `worktreePath "${worktreePath}" does not map through (${opts.backendRoot} → ${opts.nativeRoot}) onto --repo`,
      );
    }

    // --- git identity + range -------------------------------------------------
    const toplevelRaw = await gitText(['rev-parse', '--show-toplevel']);
    if (realpathSync(toplevelRaw) !== repoReal) {
      throw new Error(
        `--repo ${repoReal} is not the git toplevel (${toplevelRaw})`,
      );
    }
    const head = await gitText([
      'rev-parse',
      '--verify',
      '--end-of-options',
      'HEAD^{commit}',
    ]);
    if (!COMMIT_ID_SHAPE.test(head) && !COMMIT_ID_256_SHAPE.test(head)) {
      throw new Error(`HEAD did not resolve to a full commit id: ${head}`);
    }
    const base = await gitText([
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${opts.baseRef}^{commit}`,
    ]);
    if (!COMMIT_ID_SHAPE.test(base) && !COMMIT_ID_256_SHAPE.test(base)) {
      throw new Error(
        `base ref ${opts.baseRef} did not resolve to a full commit id`,
      );
    }
    const mergeBase = await gitText(['merge-base', base, head]);
    if (
      !COMMIT_ID_SHAPE.test(mergeBase) &&
      !COMMIT_ID_256_SHAPE.test(mergeBase)
    ) {
      throw new Error(
        `merge-base(${base}, ${head}) did not resolve to a full commit id`,
      );
    }
    if (!commitIdsEqual(head, commitSha)) {
      return holdResult(
        'head-mismatch',
        `HEAD ${head} != task.commitSha ${commitSha}`,
      );
    }

    // Denominator = the SAME range the native invocation reviews (--from
    // MERGE_BASE --to HEAD). Diverging the base-ref tip after the fork adds
    // base-side files to a base..head diff; those are not candidate material
    // and must not become required paths (false HOLD). Base-tip currency is
    // checked separately at T1 (stale-base), not by widening this diff.
    const diff0 = parseNameStatusZ(
      await gitBuffer([
        'diff',
        '--name-status',
        '-z',
        '--find-renames',
        mergeBase,
        head,
        '--',
      ]),
    );
    if (diff0.length === 0) {
      return holdResult('empty-range', `diff ${mergeBase}..${head} is empty`);
    }
    const requiredPaths: string[] = [];
    for (const rec of diff0) {
      const p = requiredPathOf(rec);
      if (!requiredPaths.includes(p)) requiredPaths.push(p);
    }
    facts.range = {
      head,
      base,
      mergeBase,
      exactRange: `${mergeBase}..${head}`,
      records: diff0.map((r) => ({ status: r.status, paths: r.paths })),
      requiredPaths,
    };

    // --- tracked-clean + untracked policy ---------------------------------------
    // Canonical forms: the untracked exception compares against paths git
    // reports relative to the REAL repo root, so a caller passing a symlinked
    // form (e.g. /var vs /private/var on macOS) must not false-HOLD. Falls
    // back to the resolved path when the file does not exist (yet) — the
    // later mandatory reads surface that as their own error.
    const realOf = (p: string): string => {
      try {
        return realpathSync(p);
      } catch {
        return p;
      }
    };
    const manifestAbs = realOf(resolve(opts.materials));
    const ruleFileAbs =
      opts.ruleFile !== undefined ? realOf(resolve(opts.ruleFile)) : null;
    const statusOf = async (): Promise<{
      dirty: boolean;
      untracked: string[];
    }> =>
      parseStatusZ(
        await gitBuffer([
          'status',
          '--porcelain=v1',
          '-z',
          '--untracked-files=all',
        ]),
      );
    const undeclaredUntracked = (
      untracked: string[],
      materialPaths: Set<string>,
    ): string[] =>
      untracked.filter((rel) => {
        const abs = resolve(repoReal, rel);
        if (abs === manifestAbs) return false;
        if (ruleFileAbs !== null && abs === ruleFileAbs) return false;
        if (runDir !== null && (abs === runDir || abs.startsWith(`${runDir}/`)))
          return false;
        if (materialPaths.has(rel)) return false;
        // Strict policy: after the exact admitted exceptions (manifest, caller
        // rule file, this invocation's run dir, declared materials) ANY other
        // nonignored untracked input is undeclared context — not only files the
        // range happens to require.
        return true;
      });

    const st0 = await statusOf();
    facts.untracked0 = st0.untracked;
    if (st0.dirty) {
      return holdResult(
        'tracked-dirty',
        'tracked content is not clean (index or worktree)',
      );
    }

    // --- materials -----------------------------------------------------------------
    const manifestBytes = readFileSync(opts.materials);
    facts.manifest = { path: opts.materials, sha256: sha256(manifestBytes) };
    const declared = parseMaterialsManifest(manifestBytes);
    const materials = loadMaterials(repoReal, declared);
    facts.materials = materials.map((m) => ({
      path: m.path,
      sha256: m.sha256,
      bytes: Buffer.byteLength(m.content, 'utf8'),
    }));
    const materialPaths = new Set(declared.map((d) => d.path));
    const offenders0 = undeclaredUntracked(st0.untracked, materialPaths);
    if (offenders0.length > 0) {
      return holdResult(
        'undeclared-untracked-input',
        `undeclared untracked inputs: ${offenders0.join(', ')}`,
      );
    }

    // --- caller rule file -------------------------------------------------------------
    let callerRules: CallerRuleFile | null = null;
    if (opts.ruleFile !== undefined) {
      const ruleBytes = readFileSync(opts.ruleFile);
      callerRules = parseCallerRuleFile(ruleBytes);
      facts.ruleFile = { path: opts.ruleFile, sha256: sha256(ruleBytes) };
    }

    // --- capsule + minted criteria ------------------------------------------------------
    const capsule = JSON.stringify({
      title: task.title,
      description,
      plan: task.plan,
      materials: materials.map((m) => ({
        path: m.path,
        sha256: m.sha256,
        content: m.content,
      })),
    });
    facts.capsuleSha256 = sha256(capsule);
    const mint = mintCriteria(runDir, callerRules, capsule);
    // Allowed outer-frame Pattern VALUES, from our own minted expected rule
    // JSON — caller entry order preserved, identical values collapsed. Never
    // resolved/matched by us, never learned from native output.
    const mintedPatterns = [
      ...new Set(
        (JSON.parse(mint.rulesJson) as { rules: { path: string }[] }).rules.map(
          (e) => e.path,
        ),
      ),
    ];

    // --- ambient + runtime config --------------------------------------------------------
    const ambient0 = readAmbient(repoReal, home);
    facts.ambient = ambient0;
    if (ambient0.project === 'present' || ambient0.global === 'present') {
      return holdResult(
        'ambient-rule-present',
        `project=${ambient0.project} global=${ambient0.global}`,
      );
    }
    if (ambient0.project === 'unknown' || ambient0.global === 'unknown') {
      return holdResult(
        'ambient-rule-unknown',
        `project=${ambient0.project} global=${ambient0.global} — settings presence could not be established (lstat failed without ENOENT)`,
      );
    }
    const rtCfg0 = readRuntimeConfig(home);
    facts.runtimeConfig = rtCfg0;
    if (rtCfg0 === 'unknown') {
      return holdResult(
        'runtime-config-unknown',
        '~/.opencodereview/config.json presence could not be established (lstat failed without ENOENT)',
      );
    }
    if (rtCfg0 === 'unreadable') {
      return holdResult(
        'runtime-config-unreadable',
        '~/.opencodereview/config.json exists but cannot be read',
      );
    }

    // --- executable -------------------------------------------------------------------------
    const exe0 = await bindExecutable(deps, opts, repoReal, env);
    facts.executable = {
      path: opts.ocrBin,
      sha256: exe0.digest,
      version: exe0.version,
    };

    // --- native inspection per required path ----------------------------------------------------
    facts.inspection = (
      await inspectPaths(
        deps,
        opts,
        repoReal,
        env,
        runDir,
        requiredPaths,
        capsule,
        mintedPatterns,
        't0',
      )
    ).map((i) => ({
      path: i.path,
      exit: i.exit,
      capsuleFound: i.capsuleFound,
      outputSha256: i.outputSha256,
    }));

    // --- one inference invocation ------------------------------------------------------------------
    const resultPath = join(runDir, 'ocr-result.json');
    const reviewArgs = [
      'review',
      '--repo',
      repoReal,
      '--from',
      mergeBase,
      '--to',
      head,
      '--rule',
      join(runDir, 'rules.json'),
      ...(opts.exclude !== undefined ? ['--exclude', opts.exclude] : []),
      '--format',
      'json',
      '--audience',
      'agent',
      '--color',
      'never',
      '--provider',
      'chatgpt',
      '-o',
      resultPath,
    ];
    const startedAt = deps.now();
    const proc = await deps.spawnChild(opts.ocrBin, reviewArgs, {
      cwd: repoReal,
      env,
    });
    const elapsedMs = deps.now() - startedAt;
    writePrivate(join(runDir, 'native-stdout.txt'), proc.stdout);
    writePrivate(join(runDir, 'native-stderr.txt'), proc.stderr);
    facts.invocation = {
      argv: [opts.ocrBin, ...reviewArgs],
      elapsedMs,
      status: proc.status,
      signal: proc.signal,
      error: proc.error ?? null,
      stdoutBytes: proc.stdout.length,
      stderrBytes: proc.stderr.length,
      stdoutFile: join(runDir, 'native-stdout.txt'),
      stderrFile: join(runDir, 'native-stderr.txt'),
    };
    if (proc.error !== undefined) {
      return holdResult(
        'invocation-absent',
        `native review could not run (${proc.error})`,
      );
    }
    if (proc.signal !== null) {
      return holdResult(
        'invocation-nonzero',
        `native review killed by ${proc.signal}`,
      );
    }
    if (proc.status !== 0) {
      return holdResult(
        'invocation-nonzero',
        `native review exited ${proc.status}`,
      );
    }
    let resultBytes: Buffer;
    try {
      resultBytes = readFileSync(resultPath);
    } catch {
      return holdResult(
        'invocation-absent',
        'native review wrote no result file',
      );
    }
    if (resultBytes.length === 0) {
      return holdResult('invocation-partial', 'result file is empty');
    }
    let raw: unknown;
    try {
      raw = JSON.parse(decodeStrict(resultBytes));
    } catch {
      return holdResult(
        'invocation-partial',
        'result file is not strict UTF-8 JSON',
      );
    }
    facts.result = { bytes: resultBytes.length, sha256: sha256(resultBytes) };

    // --- T1: re-read every bound fact; any change is a named stale HOLD -----------
    try {
      const task1 = await deps.getTask(opts.aifUrl, opts.task);
      if (JSON.stringify(task1) !== taskJson) {
        return holdResult(
          'stale-task',
          'task response changed during the native process',
        );
      }
      // --- canonical mapping re-established at T1 (F-2): the alias that
      //     resolved onto this checkout at T0 is re-resolved NOW — a repointed
      //     or unresolvable mapping HOLDS even while every cached fact below
      //     (clean checkout, same HEAD, same task/materials) still matches.
      //     --repo and the Git toplevel are re-canonicalized the same way and
      //     compared with the T0 identity. ---
      try {
        const mapped1 = mapBackendToNative(
          worktreePath,
          opts.backendRoot,
          opts.nativeRoot,
        );
        const mapped1Real = mapped1 === null ? null : realpathSync(mapped1);
        const repo1Real = realpathSync(opts.repo);
        const toplevel1 = await gitText(['rev-parse', '--show-toplevel']);
        if (
          mapped1 === null ||
          mapped1Real === null ||
          mapped1Real !== repoReal ||
          repo1Real !== repoReal ||
          realpathSync(toplevel1) !== repoReal
        ) {
          return holdResult(
            'stale-identity-mapping',
            `canonical mapping changed during the native process: mapped "${
              mapped1 ?? 'unmapped'
            }" → ${mapped1Real ?? 'unresolvable'}, --repo → ${repo1Real}, toplevel ${toplevel1} (T0 identity ${repoReal})`,
          );
        }
      } catch (err) {
        return holdResult(
          'stale-identity-mapping',
          `canonical mapping could not be re-established at T1: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      // Manifest currency: re-read the ACTUAL --materials file, never the T0
      // `declared` list. Any list/order/path/digest mutation flips the digest;
      // deletion or unreadability fails the read. Both are HOLDs — a mutated
      // input set must not ride through on stale T0 knowledge.
      let manifest1Bytes: Buffer;
      try {
        manifest1Bytes = readFileSync(opts.materials);
      } catch (err) {
        return holdResult(
          'stale-manifest',
          `--materials manifest unreadable at T1: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (
        sha256(manifest1Bytes) !== (facts.manifest as { sha256: string }).sha256
      ) {
        return holdResult(
          'stale-manifest',
          '--materials manifest changed during the native process',
        );
      }
      let materials1: VerifiedMaterial[];
      try {
        materials1 = loadMaterials(repoReal, declared);
      } catch (err) {
        if (err instanceof TrustedHold) {
          return holdResult('stale-material', err.detail);
        }
        throw err;
      }
      for (let i = 0; i < materials1.length; i++) {
        if (materials1[i].content !== materials[i].content) {
          return holdResult(
            'stale-material',
            `material "${materials1[i].path}" changed during the native process`,
          );
        }
      }
      if (opts.ruleFile !== undefined) {
        if (
          sha256(readFileSync(opts.ruleFile)) !==
          (facts.ruleFile as { sha256: string }).sha256
        ) {
          return holdResult(
            'stale-criteria',
            'caller rule file changed during the native process',
          );
        }
      }
      const ambient1 = readAmbient(repoReal, home);
      if (ambient1.project === 'present' || ambient1.global === 'present') {
        return holdResult(
          'ambient-rule-present',
          `T1 project=${ambient1.project} global=${ambient1.global}`,
        );
      }
      if (ambient1.project === 'unknown' || ambient1.global === 'unknown') {
        return holdResult(
          'ambient-rule-unknown',
          `T1 project=${ambient1.project} global=${ambient1.global} — settings presence could not be re-established (failed re-read is a HOLD)`,
        );
      }
      const rtCfg1 = readRuntimeConfig(home);
      if (rtCfg1 === 'unknown') {
        return holdResult(
          'stale-runtime-config',
          'runtime config presence could not be re-established at T1 (lstat failed without ENOENT)',
        );
      }
      if (JSON.stringify(rtCfg1) !== JSON.stringify(rtCfg0)) {
        return holdResult(
          'stale-runtime-config',
          'runtime config changed during the native process',
        );
      }
      let exe1: { digest: string; version: string };
      try {
        exe1 = await bindExecutable(deps, opts, repoReal, env);
      } catch (err) {
        if (err instanceof TrustedHold) {
          return holdResult('stale-executable', err.detail);
        }
        throw err;
      }
      if (exe1.digest !== exe0.digest || exe1.version !== exe0.version) {
        return holdResult(
          'stale-executable',
          'native executable digest/version changed during the native process',
        );
      }
      const head1 = await gitText([
        'rev-parse',
        '--verify',
        '--end-of-options',
        'HEAD^{commit}',
      ]);
      if (head1 !== head) {
        return holdResult('stale-head', `HEAD moved ${head} → ${head1}`);
      }
      const base1 = await gitText([
        'rev-parse',
        '--verify',
        '--end-of-options',
        `${opts.baseRef}^{commit}`,
      ]);
      if (base1 !== base) {
        return holdResult(
          'stale-base',
          `base ref tip moved ${base} → ${base1}`,
        );
      }
      const mergeBase1 = await gitText(['merge-base', base, head]);
      if (mergeBase1 !== mergeBase) {
        return holdResult(
          'stale-range',
          'merge-base changed during the native process',
        );
      }
      const diff1 = parseNameStatusZ(
        await gitBuffer([
          'diff',
          '--name-status',
          '-z',
          '--find-renames',
          mergeBase,
          head,
          '--',
        ]),
      );
      if (JSON.stringify(diff1) !== JSON.stringify(diff0)) {
        return holdResult(
          'stale-range',
          'required diff statuses/paths changed during the native process',
        );
      }
      const st1 = await statusOf();
      facts.untracked1 = st1.untracked;
      if (st1.dirty) {
        return holdResult(
          'stale-dirty',
          'tracked content became dirty during the native process',
        );
      }
      const offenders1 = undeclaredUntracked(st1.untracked, materialPaths);
      if (offenders1.length > 0) {
        return holdResult(
          'undeclared-untracked-input',
          `T1 undeclared untracked inputs: ${offenders1.join(', ')}`,
        );
      }
      if (!mintUnchanged(runDir, mint)) {
        return holdResult(
          'stale-criteria',
          'a generated criteria file was deleted or replaced',
        );
      }
      const inspection1 = await inspectPaths(
        deps,
        opts,
        repoReal,
        env,
        runDir,
        requiredPaths,
        capsule,
        mintedPatterns,
        't1',
      );
      // F-3: the repeated per-path inspection is BOUND to the T0 applied-rule
      // evidence — the same complete capsule inside a DIFFERENT valid rule
      // body must not look successful. T1 digests are persisted as evidence;
      // rule bodies never are.
      facts.inspection1 = inspection1.map((i) => ({
        path: i.path,
        exit: i.exit,
        capsuleFound: i.capsuleFound,
        outputSha256: i.outputSha256,
      }));
      const t0RuleByPath = new Map(
        (facts.inspection ?? []).map((i) => [i.path, i.outputSha256]),
      );
      for (const i of inspection1) {
        if (t0RuleByPath.get(i.path) !== i.outputSha256) {
          return holdResult(
            'stale-inspection',
            `applied rule for "${i.path}" changed during the native process (T1 inspection digest differs from T0)`,
          );
        }
      }
    } catch (err) {
      if (err instanceof TrustedHold) throw err;
      // A FAILED re-read is itself a HOLD, never a skipped verification.
      return holdResult(
        'stale-git',
        `T1 re-read failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // --- accepted C1a comparison ------------------------------------------------------
    const comparison = compareOcrCoverage(raw, {
      requiredPaths,
      resolvedBase: mergeBase,
      resolvedHead: head,
      expectedRange: `${mergeBase}..${head}`,
      expectedOcrVersion: EXPECTED_OCR_VERSION,
    });
    facts.comparison = comparison;
    if (comparison.status !== 'compatible') {
      return holdResult(comparison.reason, comparison.detail);
    }
    const verdict: TrustedReviewVerdict = { ...facts, status: 'compatible' };
    persistVerdict(runDir, verdict);
    return { exitCode: 0, verdict, stderrLine: lineFor(verdict) };
  } catch (err) {
    if (err instanceof TrustedHold) {
      return holdResult(err.reason, err.detail);
    }
    return {
      exitCode: 1,
      verdict: null,
      stderrLine: `[runtime-bridge] ocrTrustedReview failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

// Run only as a real entrypoint — an import (for the named exports) must stay
// side-effect-free. Shared realpath-both-sides guard: cliEntry.ts isMain.
if (isMain(import.meta.url)) {
  runTrustedReview(process.argv.slice(2), defaultDeps())
    .then((out) => {
      if (out.verdict !== null && process.argv.includes('--json')) {
        process.stdout.write(JSON.stringify(out.verdict, null, 2) + '\n');
      }
      process.stderr.write(`${out.stderrLine}\n`);
      process.exit(out.exitCode);
    })
    .catch((err) => {
      process.stderr.write(
        `[runtime-bridge] ocrTrustedReview failed: ${err}\n`,
      );
      process.exit(1);
    });
}
