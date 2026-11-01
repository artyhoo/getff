// packages/runtime-bridge/test/ocr-trusted-review.test.ts
// OCR C1b — trusted native-entry producer adapter (getff-ocr-reuse). Every suite runs
// against BOTH the source module and its byte-identical vendor twin (the established
// static-import twin convention, cf. ocr-coverage.test.ts). No inference anywhere: the
// native executable is a STUB driven through the injectable TrustedDeps seam while every
// production path around it is real — real temp git repositories, real git children with
// the GIT_*-scrubbed env the CLI builds, real argv/file/mint/inspection selection.
//
// The stub native implements the REAL custom-rule reference semantics pinned from the
// public producer snapshots (system_rules.go): a space-free rule value that names an
// existing file relative to the CUSTOM JSON's own directory is read from disk, a missing
// reference is silently emptied. The two-base pair (json-dir vs repo-dir resolution)
// pins that minting ADJACENT to the minted JSON is load-bearing — a stub must not return
// a capsule regardless of the actual referenced file (Phase-1 MAJOR regression pair).
//
// Scenario coverage follows the admitted card's enumerated test list: complete supported
// invocation/argv; provider/passthrough rejection; absent invocation with an old complete
// result; nonzero AND signal with complete output; empty/partial/bad JSON; wrong binary
// hash/version; manifest-version mismatch; missing/mutated/deleted material + wrong
// digest; >8k transported; 512KiB limit; exact Unicode/control/CR/newline round-trip;
// config/ambient presence and changes; deleted generated ref + inspection losing the
// capsule; leading-dash paths; NUL-safe rename/deletion/spaces/Unicode; unknown/mismatched
// task/project/candidate; WSL prefix mapping + prefix-sibling/traversal/escape negatives;
// dirty tracked dependency; undeclared untracked input; HEAD/task/input changes during the
// native process; compatible result preserves original bytes and stays distinct from
// semantic approval.
import { afterAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as srcMod from '../src/cli/ocrTrustedReview.js';
import * as vendorMod from '../vendor/src/cli/ocrTrustedReview.js';
import type { AifTaskFull } from '../src/cli/aifHttp.js';

const sha256hex = (data: string | Buffer): string =>
  createHash('sha256').update(data).digest('hex');

const UUID = '11111111-1111-4111-8111-111111111111';

/** Scenario repo material: CR, tab, Unicode, a control char — round-trip cargo. */
const MAT_CONTENT = 'mat line1\r\nmat “snowman” ☃ + 汉字 line2\n\ttabbed\u0001ctrl end';

/** Second tracked-and-clean material (I2 manifest-currency fixtures): committed
 *  at base, never modified by the candidate, NOT declared in the default
 *  manifest — so a mid-run manifest expansion adding it cannot be masked by the
 *  untracked-input policy (it is tracked, clean, and out of the range). */
const MAT2_CONTENT = 'second material: tracked, clean, never in range\n';

interface Scenario {
  tmp: string;
  home: string;
  repo: string;
  repoReal: string;
  backendRoot: string;
  nativeRoot: string;
  backendRepo: string;
  head: string;
  mergeBase: string;
  requiredPaths: string[];
  manifestPath: string;
  ruleFilePath: string;
  ocrBin: string;
  ocrSha256: string;
  task: AifTaskFull;
  git: (args: string[], cwd?: string) => string;
}

const tmpDirs: string[] = [];

/** A minimal, fully-deterministic candidate repo: rename (space + Unicode names),
 *  deletion, addition of a leading-dash path, one modification, one material.
 *  `objectFormat: 'sha256'` builds the same shape with 64-hex commit ids. */
function buildScenario(
  opts: { objectFormat?: 'sha1' | 'sha256' } = {},
): Scenario {
  const tmp = mkdtempSync(join(tmpdir(), 'otr-'));
  tmpDirs.push(tmp);
  const home = join(tmp, 'home');
  mkdirSync(home, { recursive: true });
  const repo = join(tmp, 'ne', 'repo');
  mkdirSync(repo, { recursive: true });
  const gitEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: home,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
  };
  const git = (args: string[], cwd: string = repo): string =>
    execFileSync('git', args, { cwd, env: gitEnv }).toString().trim();
  git([
    '-c',
    'init.defaultBranch=main',
    'init',
    '-q',
    ...(opts.objectFormat === 'sha256' ? ['--object-format=sha256'] : []),
  ]);
  writeFileSync(join(repo, 'README.md'), 'readme\n');
  writeFileSync(join(repo, 'dep.txt'), 'dep v1\n');
  writeFileSync(join(repo, 'old name.md'), 'old content\n');
  writeFileSync(join(repo, 'gone.txt'), 'to be deleted\n');
  mkdirSync(join(repo, 'docs', 'inputs'), { recursive: true });
  writeFileSync(join(repo, 'docs', 'inputs', 'mat1.md'), MAT_CONTENT);
  writeFileSync(join(repo, 'docs', 'inputs', 'mat2.md'), MAT2_CONTENT);
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src', 'widget.ts'), 'export const v = 1;\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'base']);
  writeFileSync(join(repo, 'dep.txt'), 'dep v2 with changes\n');
  writeFileSync(join(repo, 'src', 'widget.ts'), 'export const v = 2;\n');
  git(['mv', 'old name.md', 'новый file.md']);
  git(['rm', '-q', 'gone.txt']);
  writeFileSync(join(repo, 'docs', 'new note.md'), 'a note with spaces\n');
  writeFileSync(join(repo, '-leading-dash.txt'), 'dash-leading path\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'cand']);
  const head = git(['rev-parse', 'HEAD']);
  const mergeBase = git(['merge-base', 'HEAD~1', 'HEAD']);
  // Independent required-path derivation (NEW rename path, deletion path, else sole).
  const raw = execFileSync('git', ['diff', '--name-status', '-z', '--find-renames', 'HEAD~1', 'HEAD', '--'], {
    cwd: repo,
    env: gitEnv,
  });
  const requiredPaths: string[] = [];
  const fields = raw.toString('utf8').split('\0').filter((f) => f !== '');
  for (let i = 0; i < fields.length; ) {
    const status = fields[i] as string;
    if (/^[RC]\d+$/.test(status)) {
      requiredPaths.push(fields[i + 2] as string);
      i += 3;
    } else {
      requiredPaths.push(fields[i + 1] as string);
      i += 2;
    }
  }
  const ocrBin = join(tmp, 'native', 'ocr');
  mkdirSync(join(tmp, 'native'), { recursive: true });
  writeFileSync(ocrBin, 'stub native binary v1.13.3\n');
  chmodSync(ocrBin, 0o755);
  const manifestPath = join(tmp, 'materials.json');
  writeFileSync(
    manifestPath,
    JSON.stringify([{ path: 'docs/inputs/mat1.md', sha256: sha256hex(MAT_CONTENT) }]),
  );
  const ruleFilePath = join(tmp, 'rules.json');
  writeFileSync(
    ruleFilePath,
    JSON.stringify({
      rules: [{ path: 'src/**', rule: 'Focus on src.\nBe strict.', merge_system_rule: false }],
    }),
  );
  const task = {
    id: 'task-1',
    title: 'C1b scenario',
    description: 'Review the candidate against the declared criteria.',
    plan: 'step 1\nstep 2',
    status: 'in_progress',
    projectId: 'proj-1',
    worktreePath: join(tmp, 'be', 'repo'),
    commitSha: head,
  } as unknown as AifTaskFull;
  return {
    tmp,
    home,
    repo,
    repoReal: execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: repo, env: gitEnv })
      .toString()
      .trim(),
    backendRoot: join(tmp, 'be'),
    nativeRoot: join(tmp, 'ne'),
    backendRepo: join(tmp, 'be', 'repo'),
    head,
    mergeBase,
    requiredPaths,
    manifestPath,
    ruleFilePath,
    ocrBin,
    ocrSha256: sha256hex(readFileSync(ocrBin)),
    task,
    git,
  };
}

// ---------------------------------------------------------------------------
// Stub native — driven through TrustedDeps, never executed as a real process.
// ---------------------------------------------------------------------------

type ResultKind = 'ok' | 'empty' | 'badjson' | 'none' | 'wrong-version' | 'wrong-range';

interface NativeOpts {
  banner?: string;
  /** Where space-free rule references resolve from: the pinned CUSTOM semantics
   *  ('json-dir', default) vs project-rule semantics ('repo-dir') — the two-base
   *  regression pair. Missing references are silently emptied (native behavior). */
  refBase?: 'json-dir' | 'repo-dir';
  /** Truncate the printed rule body (inspection loses the full capsule). */
  dropCapsule?: boolean;
  /** I4 outer-frame controls (anchored pinned framing). 'proper' = the exact
   *  public frame: File/Source Custom (--rule)/Pattern/Rule: + opening 40-box
   *  separator + body + single terminal separator. 'after-close' = empty true
   *  body with the capsule only after the close; 'no-header' = payload without
   *  the outer prologue; 'no-close' = truncated before the closing separator;
   *  'capsule-before' = capsule prepended before a full valid frame;
   *  'unknown-source'/'unknown-pattern' = well-formed frame with a foreign
   *  Source/Pattern label; 'outside-extra' = empty body, then an EXTRA
   *  separator + capsule + terminal close (the reviewer's counterexample);
   *  'double-frame' = two complete frames concatenated. Every non-proper
   *  variant must HOLD inspection-framing. */
  framing?:
    | 'proper'
    | 'after-close'
    | 'no-header'
    | 'no-close'
    | 'capsule-before'
    | 'unknown-source'
    | 'unknown-pattern'
    | 'outside-extra'
    | 'double-frame';
  /** Per-path rule SELECTION (native resolver semantics): resolve the FIRST
   *  applicable entry for the inspected path via the fixture's known literal
   *  patterns ('src/**', '**') instead of unioning every entry. */
  select?: boolean;
  /** F-3 witness: on the T1 inspection round (every rules call after the T0
   *  per-path round) silently change the applied rule BODY while keeping the
   *  outer frame and the complete capsule intact — rule currency, not capsule
   *  presence, is what T1 must re-establish. */
  t1MutateRule?: boolean;
  review?: {
    status?: number;
    signal?: NodeJS.Signals;
    error?: string;
    result?: ResultKind;
    mutate?: () => void;
  };
}

interface DepsRecord {
  reviewArgv: string[] | null;
  reviewCalls: number;
  rulesPaths: string[][];
  reviewEnv: Record<string, string> | null;
}

function okResult(sc: Scenario, from: string, to: string): Record<string, unknown> {
  const items = sc.requiredPaths.map((p, i) => ({ item_id: `item-${i + 1}`, path: p }));
  return {
    status: 'complete',
    manifest: {
      schema_version: 'ocr.run-manifest/v1',
      operation: 'review',
      input: {
        mode: 'range',
        resolved_base: from,
        resolved_head: to,
        exact_range: `${from}..${to}`,
      },
      execution: { ocr_version: 'v1.13.3' },
      terminal_state: 'complete',
      coverage: { selected: items, completed: items, reused: [], failed: [], waived: [] },
    },
  };
}

let runCounter = 0;

interface RunOpts {
  native?: NativeOpts;
  tasks?: AifTaskFull[];
  argv?: Partial<Record<string, string | undefined>>;
  extraArgv?: string[];
  /** Fixed run uuid — for tests that must know the run dir before review fires. */
  uuid?: string;
  /** C2 local-request profile: build the closed LOCAL argv (no AIF flags) and
   *  make ANY getTask call fail loudly — local mode must never touch AIF. */
  local?: LocalRequest;
}

function buildArgv(
  sc: Scenario,
  over: Partial<Record<string, string | undefined>> | undefined,
  extra: string[] | undefined,
): string[] {
  const get = (k: string): string | undefined => over?.[k];
  return [
    '--task', get('task') ?? sc.task.id,
    '--aif-url', get('aif-url') ?? 'http://aif.invalid/api',
    '--repo', get('repo') ?? sc.repo,
    '--backend-root', get('backend-root') ?? sc.backendRoot,
    '--native-root', get('native-root') ?? sc.nativeRoot,
    '--base-ref', get('base-ref') ?? 'HEAD~1',
    '--materials', get('materials') ?? sc.manifestPath,
    '--ocr-bin', get('ocr-bin') ?? sc.ocrBin,
    '--ocr-sha256', get('ocr-sha256') ?? sc.ocrSha256,
    // Default: the caller rule file IS part of the supported invocation;
    // pass '' explicitly to exercise the capsule-only (no --rule-file) path.
    ...((get('rule-file') ?? sc.ruleFilePath) !== ''
      ? ['--rule-file', (get('rule-file') ?? sc.ruleFilePath) as string]
      : []),
    ...(get('exclude') !== undefined ? ['--exclude', get('exclude') as string] : []),
    ...(extra ?? []),
  ];
}

// --- C2 local-request profile fixtures ----------------------------------------

const LOCAL_REQUEST_KIND = 'getff.ocr-review-request/v1';

interface LocalRequest {
  path: string;
  sha256: string;
}

/** The default local request for the scenario's CURRENT head (call writeLocalRequest
 *  only after any scenario mutation that moves sc.head — the head must match). */
function localRequestBody(sc: Scenario): Record<string, unknown> {
  return {
    kind: LOCAL_REQUEST_KIND,
    id: 'req-c2-1',
    title: 'C2 local review',
    description: 'Review the candidate against the complete declared criteria.',
    plan: 'local step 1\nlocal step 2',
    head: sc.head,
  };
}

/** Write the request bytes and return the {path, sha256} invocation pair. An
 *  explicit '' value in the argv map OMITS a request flag (the rule-file
 *  convention) so the partial-profile negatives can drop exactly one of the
 *  two. `where: 'repo'` places the file INSIDE the repo (the untracked
 *  exception arm). */
function writeLocalRequest(
  sc: Scenario,
  mutate?: (body: Record<string, unknown>) => void,
  where: 'tmp' | 'repo' = 'tmp',
): LocalRequest {
  const body = localRequestBody(sc);
  mutate?.(body);
  const bytes = Buffer.from(JSON.stringify(body), 'utf8');
  const path =
    where === 'tmp' ? join(sc.tmp, 'request.json') : join(sc.repo, 'request-inside.json');
  writeFileSync(path, bytes);
  return { path, sha256: sha256hex(bytes) };
}

/** The exact capsule the CLI must mint for the default local request. */
const localCapsuleOf = (sc: Scenario): string =>
  JSON.stringify({
    title: 'C2 local review',
    description: 'Review the candidate against the complete declared criteria.',
    plan: 'local step 1\nlocal step 2',
    materials: [{ path: 'docs/inputs/mat1.md', sha256: sha256hex(MAT_CONTENT), content: MAT_CONTENT }],
  });

/** Closed LOCAL argv: the shared common flags plus --request-file/--request-sha256
 *  and NONE of the four AIF flags. */
function buildLocalArgv(
  sc: Scenario,
  over: Partial<Record<string, string | undefined>> | undefined,
  extra: string[] | undefined,
  req: LocalRequest,
): string[] {
  const get = (k: string): string | undefined => over?.[k];
  const flag = (name: string, value: string | undefined): string[] =>
    value !== undefined && value !== '' ? [`--${name}`, value] : [];
  return [
    '--repo', get('repo') ?? sc.repo,
    '--base-ref', get('base-ref') ?? 'HEAD~1',
    '--materials', get('materials') ?? sc.manifestPath,
    '--ocr-bin', get('ocr-bin') ?? sc.ocrBin,
    '--ocr-sha256', get('ocr-sha256') ?? sc.ocrSha256,
    ...flag('rule-file', get('rule-file') ?? sc.ruleFilePath),
    ...flag('request-file', get('request-file') ?? req.path),
    ...flag('request-sha256', get('request-sha256') ?? req.sha256),
    ...flag('exclude', get('exclude')),
    ...(extra ?? []),
  ];
}

async function run(
  mod: typeof srcMod,
  sc: Scenario,
  o: RunOpts = {},
): Promise<{ out: srcMod.TrustedReviewRunResult; record: DepsRecord; uuid: string }> {
  const native = o.native ?? {};
  const real = mod.defaultDeps();
  const record: DepsRecord = { reviewArgv: null, reviewCalls: 0, rulesPaths: [], reviewEnv: null };
  const tasks = o.tasks ?? [sc.task];
  let taskCalls = 0;
  const uuid = o.uuid ?? `run-${++runCounter}-${UUID}`;
  const deps: srcMod.TrustedDeps = {
    getTask: o.local
      ? (async () => {
          throw new Error('UNEXPECTED-AIF-CALL');
        }) as srcMod.TrustedDeps['getTask']
      : async () => {
          const t = tasks[Math.min(taskCalls, tasks.length - 1)] as AifTaskFull;
          taskCalls += 1;
          if (t === null) throw new Error('task not found');
          return t;
        },
    now: () => 1_000,
    uuid: () => uuid,
    spawnChild: async (cmd, args, opts) => {
      if (cmd !== sc.ocrBin) return real.spawnChild(cmd, args, opts);
      if (args[0] === '--version') {
        return {
          stdout: Buffer.from(
            native.banner ??
              'open-code-review v1.13.3 (375f64cd6f67a48a135da83cfcf59c52669a09cb) darwin/arm64\n',
          ),
          stderr: Buffer.alloc(0),
          status: 0,
          signal: null,
        };
      }
      if (args[0] === 'rules') {
        record.rulesPaths.push([...args]);
        const ruleJson = args[args.indexOf('--rule') + 1] as string;
        const path = args[args.indexOf('--') + 1] as string;
        const entries = JSON.parse(readFileSync(ruleJson, 'utf8')) as {
          rules: { rule: string; path: string }[];
        };
        const baseDir =
          native.refBase === 'repo-dir' ? sc.repoReal : dirname(ruleJson);
        // Known LITERAL fixture patterns only ('**', 'src/**') — the stub never
        // implements a general glob resolver; selection follows native resolver
        // order (first applicable entry wins).
        const applies = (pattern: string): boolean =>
          pattern === '**' || (pattern === 'src/**' && path.startsWith('src/'));
        const chosen = native.select
          ? [entries.rules.find((e) => applies(e.path)) ?? entries.rules[entries.rules.length - 1]]
          : entries.rules;
        let body = chosen
          .map((e) => {
            if (!/\s/.test(e.rule)) {
              const candidate = join(baseDir, e.rule);
              if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
              return ''; // native silently empties missing references
            }
            return e.rule;
          })
          .join('\n');
        if (native.dropCapsule) body = body.slice(0, 40);
        if (
          native.t1MutateRule &&
          record.rulesPaths.length > sc.requiredPaths.length
        ) {
          body = `Ignore the transported criteria.\n${body}`;
        }
        const sep = '─'.repeat(40);
        // Pinned public prologue (rules_cmd.go): Source label for the custom
        // branch is exactly "Custom (--rule)"; Pattern is the selected entry's
        // original path value; the custom branch adds no Note/SniffedAs line.
        const head = (source: string, pattern: string): string =>
          `File: ${path}\nSource: ${source}\nPattern: ${pattern}\nRule:\n`;
        const header = head('Custom (--rule)', chosen[0]?.path ?? '**');
        const frame = (b: string): Buffer =>
          Buffer.from(`${header}${sep}\n${b}\n${sep}\n`);
        const out = (s: string): { stdout: Buffer; stderr: Buffer; status: 0; signal: null } => ({
          stdout: Buffer.from(s),
          stderr: Buffer.alloc(0),
          status: 0,
          signal: null,
        });
        if (native.framing === 'no-header') {
          // Payload without the outer prologue — capsule present, no anchored frame.
          return out(`Rule:\n${sep}\n${body}\n${sep}\n`);
        }
        if (native.framing === 'no-close') {
          return out(`${header}${sep}\n${body}\n`);
        }
        if (native.framing === 'after-close') {
          // Well-formed prologue, EMPTY true body, the capsule printed only
          // after the closing separator — and nothing terminal after it.
          return out(`${header}${sep}\n\n${sep}\n${capsuleOf(sc)}\n`);
        }
        if (native.framing === 'capsule-before') {
          // Capsule BEFORE a complete valid frame — outside the body, before
          // the prologue.
          return out(`${capsuleOf(sc)}\n${header}${sep}\n${body}\n${sep}\n`);
        }
        if (native.framing === 'unknown-source') {
          return out(`${head('System built-in', chosen[0]?.path ?? '**')}${sep}\n${body}\n${sep}\n`);
        }
        if (native.framing === 'unknown-pattern') {
          return out(`${head('Custom (--rule)', 'never/minted/**')}${sep}\n${body}\n${sep}\n`);
        }
        if (native.framing === 'outside-extra') {
          // The reviewer's counterexample: empty true body, then an EXTRA
          // separator + capsule, with the terminal separator still present —
          // which separator is real is ambiguous and must HOLD.
          return out(`${header}${sep}\n\n${sep}\n${capsuleOf(sc)}\n${sep}\n`);
        }
        if (native.framing === 'double-frame') {
          // Two complete frames concatenated — arbitrary trailing output.
          return out(`${header}${sep}\n${body}\n${sep}\n${header}${sep}\n${body}\n${sep}\n`);
        }
        return { stdout: frame(body), stderr: Buffer.alloc(0), status: 0, signal: null };
      }
      if (args[0] === 'review') {
        record.reviewArgv = [cmd, ...args];
        record.reviewCalls += 1;
        record.reviewEnv = opts.env;
        native.review?.mutate?.();
        const from = args[args.indexOf('--from') + 1] as string;
        const to = args[args.indexOf('--to') + 1] as string;
        const outPath = args[args.indexOf('-o') + 1] as string;
        const kind = native.review?.result ?? 'ok';
        if (kind !== 'none') {
          let bytes = '';
          if (kind === 'ok') bytes = JSON.stringify(okResult(sc, from, to), null, 2);
          else if (kind === 'wrong-version') {
            const r = okResult(sc, from, to) as { manifest: { execution: { ocr_version: string } } };
            r.manifest.execution.ocr_version = 'v1.12.0';
            bytes = JSON.stringify(r, null, 2);
          } else if (kind === 'wrong-range') {
            const r = okResult(sc, from, to) as { manifest: { input: { resolved_base: string; exact_range: string } } };
            r.manifest.input.resolved_base = 'f'.repeat(40);
            r.manifest.input.exact_range = `${'f'.repeat(40)}..${to}`;
            bytes = JSON.stringify(r, null, 2);
          } else if (kind === 'empty') bytes = '';
          else if (kind === 'badjson') bytes = 'not-json{';
          writeFileSync(outPath, bytes);
        }
        return {
          stdout: Buffer.from('review ran\n'),
          stderr: Buffer.alloc(0),
          status: native.review?.error !== undefined ? null : (native.review?.status ?? 0),
          signal: native.review?.signal ?? null,
          ...(native.review?.error !== undefined ? { error: native.review.error } : {}),
        };
      }
      return { stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), status: 1, signal: null };
    },
  };
  const savedHome = process.env.HOME;
  const savedGitProbe = process.env.GIT_X_PROBE;
  process.env.HOME = sc.home;
  process.env.GIT_X_PROBE = 'must-not-reach-children';
  try {
    const argv = o.local
      ? buildLocalArgv(sc, o.argv, o.extraArgv, o.local)
      : buildArgv(sc, o.argv, o.extraArgv);
    const out = await mod.runTrustedReview(argv, deps);
    return { out, record, uuid };
  } finally {
    process.env.HOME = savedHome;
    if (savedGitProbe === undefined) delete process.env.GIT_X_PROBE;
    else process.env.GIT_X_PROBE = savedGitProbe;
  }
}

/** Real-process native stand-in for the default-process witness: a node script
 *  executable spawned through the REAL defaultDeps().spawnChild (execve, argv
 *  with `--` before paths) — --version banner, rules check resolving minted refs
 *  from the custom JSON's own directory with per-path selection, and a review
 *  that writes a complete manifest computed from ACTUAL git output. No model,
 *  no network. */
function makeRealNative(sc: Scenario, variant: 'proper' | 'after-close'): { bin: string; sha: string } {
  const dir = join(sc.tmp, 'real-native');
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, `ocr-${variant}`);
  const L: string[] = [
    '#!/usr/bin/env node',
    "const fs = require('fs');",
    "const path = require('path');",
    "const { execFileSync } = require('child_process');",
    'const args = process.argv.slice(2);',
    "if (args[0] === '--version') {",
    "  process.stdout.write('open-code-review v1.13.3 (375f64cd6f67a48a135da83cfcf59c52669a09cb) darwin/arm64\\n');",
    '  process.exit(0);',
    '}',
    "if (args[0] === 'rules') {",
    "  const ruleJson = args[args.indexOf('--rule') + 1];",
    "  const p = args[args.indexOf('--') + 1];",
    "  const entries = JSON.parse(fs.readFileSync(ruleJson, 'utf8')).rules;",
    "  const chosen = entries.filter((e) => e.path === '**' || (e.path === 'src/**' && p.startsWith('src/')));",
    '  const base = path.dirname(ruleJson);',
    '  const body = chosen',
    "    .map((e) => (/\\s/.test(e.rule)",
    '      ? e.rule',
    "      : (fs.existsSync(path.join(base, e.rule)) ? fs.readFileSync(path.join(base, e.rule), 'utf8') : '')))",
    "    .join('\\n');",
    "  const sep = '─'.repeat(40);",
    "  const head = 'File: ' + p + '\\nSource: Custom (--rule)\\nPattern: ' + (chosen[0] ? chosen[0].path : '**') + '\\nRule:\\n';",
    variant === 'after-close'
      ? `  process.stdout.write(head + sep + '\\n\\n' + sep + '\\n' + ${JSON.stringify(capsuleOf(sc))} + '\\n');`
      : "  process.stdout.write(head + sep + '\\n' + body + '\\n' + sep + '\\n');",
    '  process.exit(0);',
    '}',
    "if (args[0] === 'review') {",
    "  const repo = args[args.indexOf('--repo') + 1];",
    "  const from = args[args.indexOf('--from') + 1];",
    "  const to = args[args.indexOf('--to') + 1];",
    "  const outPath = args[args.indexOf('-o') + 1];",
    "  const raw = execFileSync('git', ['diff', '--name-status', '-z', '--find-renames', from, to, '--'], { cwd: repo }).toString();",
    "  const fields = raw.split('\\0').filter((f) => f !== '');",
    '  const paths = [];',
    '  for (let i = 0; i < fields.length; ) {',
    "    if (/^[RC]\\d+$/.test(fields[i])) { paths.push(fields[i + 2]); i += 3; }",
    '    else { paths.push(fields[i + 1]); i += 2; }',
    '  }',
    "  const items = [...new Set(paths)].map((p, i) => ({ item_id: 'item-' + (i + 1), path: p }));",
    '  fs.writeFileSync(outPath, JSON.stringify({',
    "    status: 'complete',",
    '    manifest: {',
    "      schema_version: 'ocr.run-manifest/v1',",
    "      operation: 'review',",
    "      input: { mode: 'range', resolved_base: from, resolved_head: to, exact_range: from + '..' + to },",
    "      execution: { ocr_version: 'v1.13.3' },",
    "      terminal_state: 'complete',",
    '      coverage: { selected: items, completed: items, reused: [], failed: [], waived: [] },',
    '    },',
    '  }, null, 2));',
    "  process.stdout.write('review ran\\n');",
    '  process.exit(0);',
    '}',
    "process.stderr.write('unsupported subcommand\\n');",
    'process.exit(2);',
  ];
  writeFileSync(bin, `${L.join('\n')}\n`);
  chmodSync(bin, 0o755);
  return { bin, sha: sha256hex(readFileSync(bin)) };
}

/** Drive runTrustedReview through the REAL defaultDeps (real execve spawn, real
 *  env construction, real temp/git behavior) with only the two deterministic
 *  seams overridden — the existing injection surface, never a permissive
 *  spawn-return object. */
async function runRealNative(
  mod: typeof srcMod,
  sc: Scenario,
  variant: 'proper' | 'after-close',
  argv: Partial<Record<string, string | undefined>>,
  uuid: string,
): Promise<srcMod.TrustedReviewRunResult> {
  const native = makeRealNative(sc, variant);
  const deps: srcMod.TrustedDeps = {
    ...mod.defaultDeps(),
    getTask: async () => sc.task,
    uuid: () => uuid,
  };
  const savedHome = process.env.HOME;
  process.env.HOME = sc.home;
  try {
    return await mod.runTrustedReview(
      buildArgv(sc, { 'ocr-bin': native.bin, 'ocr-sha256': native.sha, ...argv }, undefined),
      deps,
    );
  } finally {
    process.env.HOME = savedHome;
  }
}

/** The exact capsule the CLI must mint for the default scenario. */
const capsuleOf = (sc: Scenario): string =>
  JSON.stringify({
    title: sc.task.title,
    description: sc.task.description,
    plan: sc.task.plan,
    materials: [{ path: 'docs/inputs/mat1.md', sha256: sha256hex(MAT_CONTENT), content: MAT_CONTENT }],
  });

afterAll(() => {
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup only
    }
  }
});

const twins: [string, typeof srcMod][] = [
  ['src', srcMod],
  ['vendor', vendorMod],
];

for (const [label, mod] of twins) {
  describe(`ocrTrustedReview (${label}) — closed argv and pure parsers`, () => {
    it('rejects --provider passthrough and unknown flags with exit 1', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc, { extraArgv: ['--provider', 'chatgpt'] });
      expect(r.out.exitCode).toBe(1);
      expect(r.out.verdict).toBeNull();
      expect(r.out.stderrLine).toMatch(/provider|unknown/i);
    });

    it('rejects positional junk with exit 1', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc, { extraArgv: ['stray-positional'] });
      expect(r.out.exitCode).toBe(1);
    });

    it('rejects a non-hex --ocr-sha256 with exit 1', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc, { argv: { 'ocr-sha256': 'nothex' } });
      expect(r.out.exitCode).toBe(1);
    });

    it('parses --name-status -z with the empirically pinned rename order (old, new)', () => {
      const buf = Buffer.from(
        ['M', 'a b.txt', 'R100', 'old name.md', 'новый file.md', 'D', 'gone.txt'].join('\0') + '\0',
      );
      const recs = mod.parseNameStatusZ(buf);
      expect(recs).toEqual([
        { status: 'M', paths: ['a b.txt'] },
        { status: 'R100', paths: ['old name.md', 'новый file.md'] },
        { status: 'D', paths: ['gone.txt'] },
      ]);
      expect(mod.requiredPathOf(recs[1] as { status: string; paths: string[] })).toBe('новый file.md');
      expect(mod.requiredPathOf(recs[2] as { status: string; paths: string[] })).toBe('gone.txt');
    });

    it('holds unsupported diff statuses (T) instead of skipping them', () => {
      const buf = Buffer.from(['T', 'weird.bin'].join('\0') + '\0');
      expect(() => mod.parseNameStatusZ(buf)).toThrow(/unsupported-status/);
    });

    it('parses porcelain -z with XY and path in ONE field, renames taking two', () => {
      const parsed = mod.parseStatusZ(Buffer.from('?? untracked a.txt\0M  staged.txt\0'));
      expect(parsed.dirty).toBe(true);
      expect(parsed.untracked).toEqual(['untracked a.txt']);
      const clean = mod.parseStatusZ(Buffer.from('?? x\0'));
      expect(clean).toEqual({ dirty: false, untracked: ['x'] });
      const rename = mod.parseStatusZ(Buffer.from('R  new name.md\0old name.md\0'));
      expect(rename.dirty).toBe(true);
      expect(rename.untracked).toEqual([]);
    });

    it('maps backend→native by component containment (sibling prefix fails)', () => {
      expect(mod.mapBackendToNative('/w/be/repo', '/w/be', '/w/ne')).toBe('/w/ne/repo');
      expect(mod.mapBackendToNative('/w/be-evil/repo', '/w/be', '/w/ne')).toBeNull();
      expect(mod.mapBackendToNative('/w/be/../out/repo', '/w/be', '/w/ne')).toBeNull();
      expect(mod.mapBackendToNative('/w/ne/repo', '/w/ne', '/w/ne')).toBe('/w/ne/repo');
      expect(mod.mapBackendToNative('relative/repo', '/w/be', '/w/ne')).toBeNull();
    });

    it('classifies runtime-config presence: ENOENT is the only absence (F-1)', () => {
      // The runtime-config probe and the GLOBAL ambient probe share the parent
      // ~/.opencodereview directory, so a real parent-level lstat failure
      // (EACCES/ELOOP/ENOTDIR) can never hit the config probe alone — the
      // integration witnesses surface it as the ambient hold. This direct
      // probe witness pins the config site's own classification: a failed
      // presence probe is NEVER 'absent'.
      const tmp = mkdtempSync(join(tmpdir(), 'otr-rc-'));
      tmpDirs.push(tmp);
      const homeOk = join(tmp, 'home-ok');
      mkdirSync(homeOk, { recursive: true });
      // Proven absence: nothing exists → ENOENT → 'absent' (legitimate).
      expect(mod.readRuntimeConfig(homeOk)).toBe('absent');
      // Non-absence failure (ENOTDIR): .opencodereview is a regular file, so
      // lstat of .../config.json fails without proving absence.
      const homeFile = join(tmp, 'home-file');
      mkdirSync(homeFile, { recursive: true });
      writeFileSync(join(homeFile, '.opencodereview'), 'not a directory');
      expect(mod.readRuntimeConfig(homeFile)).toBe('unknown');
      // Non-absence failure (ELOOP): .opencodereview is a self-referential
      // symlink — resolving the component loops before existence is known.
      const homeLoop = join(tmp, 'home-loop');
      mkdirSync(homeLoop, { recursive: true });
      symlinkSync('.opencodereview', join(homeLoop, '.opencodereview'));
      expect(mod.readRuntimeConfig(homeLoop)).toBe('unknown');
    });

    it('rejects ambiguous external-file rule values in --rule-file', () => {
      expect(() =>
        mod.parseCallerRuleFile(Buffer.from(JSON.stringify({ rules: [{ path: '**', rule: 'docs/crit.md' }] }))),
      ).toThrow(/ambiguous/);
      expect(() =>
        mod.parseCallerRuleFile(
          Buffer.from(JSON.stringify({ rules: [{ path: '**', rule: 'ok text' }], extra: 1 })),
        ),
      ).toThrow(/unknown top-level key/);
      const ok = mod.parseCallerRuleFile(
        Buffer.from(
          JSON.stringify({
            rules: [{ path: 'src/**', rule: 'line one\nline two', merge_system_rule: true }],
            include: ['*.ts'],
          }),
        ),
      );
      expect(ok.rules[0]?.merge_system_rule).toBe(true);
      expect(ok.include).toEqual(['*.ts']);
    });

    it('rejects malformed materials manifests (duplicate, absolute, bad sha)', () => {
      expect(() =>
        // Both entries carry valid 64-hex shas so the /twice/ check — not the
        // first entry's shape — is what rejects the manifest.
        mod.parseMaterialsManifest(
          Buffer.from(JSON.stringify([{ path: 'a', sha256: '0'.repeat(64) }, { path: 'a', sha256: '1'.repeat(64) }])),
        ),
      ).toThrow(/twice/);
      expect(() =>
        mod.parseMaterialsManifest(Buffer.from(JSON.stringify([{ path: '/abs/a', sha256: '0'.repeat(64) }]))),
      ).toThrow(/repo-relative/);
      expect(() =>
        mod.parseMaterialsManifest(Buffer.from(JSON.stringify([{ path: 'a', sha256: 'zz' }]))),
      ).toThrow(/64-hex/);
      expect(mod.parseMaterialsManifest(Buffer.from('[]'))).toEqual([]);
    });

    it('mints adjacent criteria refs and the ** catch-all, holding over 512KiB unsliced', () => {
      const dir = mkdtempSync(join(tmpdir(), 'otr-mint-'));
      tmpDirs.push(dir);
      const caller = mod.parseCallerRuleFile(
        Buffer.from(JSON.stringify({ rules: [{ path: 'src/**', rule: 'inline rule text here' }] })),
      );
      const mint = mod.mintCriteria(dir, caller, 'CAPSULE');
      const minted = JSON.parse(mint.rulesJson) as {
        rules: { path: string; rule: string; merge_system_rule?: boolean }[];
      };
      expect(minted.rules).toEqual([
        { path: 'src/**', rule: 'criteria-0.md' },
        { path: '**', rule: 'criteria-final.md', merge_system_rule: true },
      ]);
      expect(readFileSync(join(dir, 'criteria-0.md'), 'utf8')).toBe('inline rule text here\nCAPSULE');
      expect(readFileSync(join(dir, 'criteria-final.md'), 'utf8')).toBe('CAPSULE');
      const big = 'x'.repeat(512 * 1024 + 1);
      const bigDir = mkdtempSync(join(tmpdir(), 'otr-big-'));
      tmpDirs.push(bigDir);
      expect(() => mod.mintCriteria(bigDir, null, big)).toThrow(/criteria-over-limit/);
    });
  });

  describe(`ocrTrustedReview (${label}) — T0/T1 binding against real temp repos`, () => {
    it('runs the complete supported invocation with the exact native argv', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc);
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', r.uuid);
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.status).toBe('compatible');
      expect(r.out.verdict?.runDir).toBe(runDir);
      expect(r.out.verdict?.comparison?.status).toBe('compatible');
      if (r.out.verdict?.comparison?.status === 'compatible') {
        expect(r.out.verdict.comparison.identity).toEqual({
          resolvedBase: sc.mergeBase,
          resolvedHead: sc.head,
          exactRange: `${sc.mergeBase}..${sc.head}`,
          ocrVersion: 'v1.13.3',
        });
      }
      expect(r.record.reviewArgv).toEqual([
        sc.ocrBin,
        'review',
        '--repo', sc.repoReal,
        '--from', sc.mergeBase,
        '--to', sc.head,
        '--rule', join(runDir, 'rules.json'),
        '--format', 'json',
        '--audience', 'agent',
        '--color', 'never',
        '--provider', 'chatgpt',
        '-o', join(runDir, 'ocr-result.json'),
      ]);
      // Minted criteria: adjacent refs relative to the CUSTOM JSON directory.
      const capsule = capsuleOf(sc);
      const minted = JSON.parse(readFileSync(join(runDir, 'rules.json'), 'utf8'));
      expect(minted.rules).toEqual([
        { path: 'src/**', rule: 'criteria-0.md', merge_system_rule: false },
        { path: '**', rule: 'criteria-final.md', merge_system_rule: true },
      ]);
      expect(readFileSync(join(runDir, 'criteria-0.md'), 'utf8')).toBe(`Focus on src.\nBe strict.\n${capsule}`);
      expect(readFileSync(join(runDir, 'criteria-final.md'), 'utf8')).toBe(capsule);
      // Inspection reached EVERY required path — deletions, rename-NEW, leading dash.
      const inspected = r.record.rulesPaths.map((a) => a[a.indexOf('--') + 1]);
      for (const p of sc.requiredPaths) expect(inspected).toContain(p);
      expect(inspected).toContain('-leading-dash.txt');
      expect(inspected).toContain('новый file.md');
      expect(inspected).toContain('gone.txt');
      // Verdict persisted; env scrubbed of GIT_*; no semantic-approval language.
      const persisted = JSON.parse(readFileSync(join(runDir, 'trusted-review-verdict.json'), 'utf8'));
      expect(persisted.status).toBe('compatible');
      expect(r.record.reviewEnv?.['GIT_X_PROBE']).toBeUndefined();
      expect(r.out.verdict?.childEnvSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(r.out.stderrLine).toMatch(/not a semantic ResultReview/);
    });

    it('passes --exclude through verbatim as a single native option', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc, { argv: { exclude: 'vendor/**,dist/**' } });
      expect(r.out.exitCode).toBe(0);
      const i = (r.record.reviewArgv as string[]).indexOf('--exclude');
      expect((r.record.reviewArgv as string[]).slice(i, i + 2)).toEqual(['--exclude', 'vendor/**,dist/**']);
    });

    it('preserves the original result bytes and never approves semantics', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc);
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', r.uuid);
      const onDisk = readFileSync(join(runDir, 'ocr-result.json'));
      expect(onDisk.length).toBeGreaterThan(0);
      expect(r.out.verdict?.result?.sha256).toBe(sha256hex(onDisk));
      expect(r.out.verdict?.result?.bytes).toBe(onDisk.length);
      const v = r.out.verdict as unknown as Record<string, unknown>;
      expect(v['approved']).toBeUndefined();
      expect(v['accepted']).toBeUndefined();
    });

    it('holds invocation-absent when the binary fails to spawn, unrescued by an old complete result', async () => {
      const sc = buildScenario();
      // Pre-seed an old complete result INSIDE this invocation's owned run dir —
      // under the strict untracked policy that is the only accepted untracked
      // location, and stale bytes already sitting at the result path must still
      // not rescue a failed spawn.
      const uuid = `absent-${UUID}`;
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', uuid);
      mkdirSync(runDir, { recursive: true });
      const oldBytes = JSON.stringify(okResult(sc, sc.mergeBase, sc.head));
      writeFileSync(join(runDir, 'ocr-result.json'), oldBytes);
      // result:'none' — a spawn that never started (ENOENT) writes nothing.
      const r = await run(mod, sc, { uuid, native: { review: { error: 'ENOENT', result: 'none' } } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('invocation-absent');
      expect(r.out.verdict?.comparison).toBeUndefined();
      expect(readFileSync(join(runDir, 'ocr-result.json'), 'utf8')).toBe(oldBytes);
    });

    it('holds invocation-nonzero on exit 1 AND on a kill signal, despite complete output', async () => {
      const sc = buildScenario();
      const nonzero = await run(mod, sc, { native: { review: { status: 1, result: 'ok' } } });
      expect(nonzero.out.exitCode).toBe(2);
      expect(nonzero.out.verdict?.holdReason).toBe('invocation-nonzero');
      expect(nonzero.out.verdict?.comparison).toBeUndefined();
      // Strict untracked policy: a PRIOR invocation's run dir is undeclared
      // input for the next one — clear it so each subcase starts pristine.
      rmSync(join(sc.repoReal, '.ai-factory'), { recursive: true, force: true });
      const signalled = await run(mod, sc, { native: { review: { signal: 'SIGKILL', result: 'ok' } } });
      expect(signalled.out.exitCode).toBe(2);
      expect(signalled.out.verdict?.holdReason).toBe('invocation-nonzero');
      expect(signalled.out.verdict?.invocation?.signal).toBe('SIGKILL');
    });

    it('holds invocation-partial on empty / truncated / non-JSON output', async () => {
      const sc = buildScenario();
      for (const kind of ['empty', 'badjson'] as ResultKind[]) {
        const r = await run(mod, sc, { native: { review: { result: kind } } });
        expect(r.out.exitCode).toBe(2);
        expect(r.out.verdict?.holdReason).toBe('invocation-partial');
        rmSync(join(sc.repoReal, '.ai-factory'), { recursive: true, force: true });
      }
      const none = await run(mod, sc, { native: { review: { result: 'none' } } });
      expect(none.out.verdict?.holdReason).toBe('invocation-absent');
    });

    it('holds executable-digest on a wrong binary hash and never invokes review', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc, { argv: { 'ocr-sha256': '0'.repeat(64) } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('executable-digest');
      expect(r.record.reviewCalls).toBe(0);
    });

    it('holds executable-version on an unsupported banner and never invokes review', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc, {
        native: { banner: 'open-code-review v1.12.0 (abcdef1234567890) darwin/arm64\n' },
      });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('executable-version');
      expect(r.record.reviewCalls).toBe(0);
    });

    it('surfaces the independent C1a manifest-version mismatch as its own hold', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc, { native: { review: { result: 'wrong-version' } } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('incompatible-version');
      expect(r.out.verdict?.holdDetail).toMatch(/v1\.13\.3/);
    });

    it('holds material-missing / material-digest at T0 and stale-material on mid-run mutation', async () => {
      const missing = buildScenario();
      const rMissing = await run(mod, missing, {
        argv: {
          materials: (() => {
            const p = join(missing.tmp, 'materials-missing.json');
            writeFileSync(p, JSON.stringify([{ path: 'docs/inputs/nope.md', sha256: '0'.repeat(64) }]));
            return p;
          })(),
        },
      });
      expect(rMissing.out.exitCode).toBe(2);
      expect(rMissing.out.verdict?.holdReason).toBe('material-missing');

      const wrongDigest = buildScenario();
      const pWrong = join(wrongDigest.tmp, 'materials-wrong.json');
      writeFileSync(pWrong, JSON.stringify([{ path: 'docs/inputs/mat1.md', sha256: '1'.repeat(64) }]));
      const rWrong = await run(mod, wrongDigest, { argv: { materials: pWrong } });
      expect(rWrong.out.verdict?.holdReason).toBe('material-digest');

      const mutated = buildScenario();
      const rMut = await run(mod, mutated, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              writeFileSync(join(mutated.repo, 'docs', 'inputs', 'mat1.md'), 'mutated mid-run');
            },
          },
        },
      });
      expect(rMut.out.exitCode).toBe(2);
      expect(rMut.out.verdict?.holdReason).toBe('stale-material');

      const deleted = buildScenario();
      const rDel = await run(mod, deleted, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              rmSync(join(deleted.repo, 'docs', 'inputs', 'mat1.md'));
            },
          },
        },
      });
      expect(rDel.out.verdict?.holdReason).toBe('stale-material');
    });

    it('holds stale-manifest when the --materials manifest changes mid-run (I2)', async () => {
      // Expansion: a second ALREADY-TRACKED clean material added to the manifest
      // during the native process — tracked so the untracked-input policy cannot
      // mask the manifest-currency regression.
      const expand = buildScenario();
      const expanded = JSON.stringify([
        { path: 'docs/inputs/mat1.md', sha256: sha256hex(MAT_CONTENT) },
        { path: 'docs/inputs/mat2.md', sha256: sha256hex(MAT2_CONTENT) },
      ]);
      const rExp = await run(mod, expand, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              writeFileSync(expand.manifestPath, expanded);
            },
          },
        },
      });
      expect(rExp.out.exitCode).toBe(2);
      expect(rExp.out.verdict?.holdReason).toBe('stale-manifest');

      // Reordering the same entries is still a manifest change.
      const reorder = buildScenario();
      const reordered = JSON.stringify([
        { path: 'docs/inputs/mat2.md', sha256: sha256hex(MAT2_CONTENT) },
        { path: 'docs/inputs/mat1.md', sha256: sha256hex(MAT_CONTENT) },
      ]);
      const rRe = await run(mod, reorder, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              writeFileSync(reorder.manifestPath, reordered);
            },
          },
        },
      });
      expect(rRe.out.exitCode).toBe(2);
      expect(rRe.out.verdict?.holdReason).toBe('stale-manifest');

      // Deletion / unreadability of the manifest is a HOLD, never silent reuse
      // of the T0-declared list.
      const gone = buildScenario();
      const rDel = await run(mod, gone, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              rmSync(gone.manifestPath);
            },
          },
        },
      });
      expect(rDel.out.exitCode).toBe(2);
      expect(rDel.out.verdict?.holdReason).toBe('stale-manifest');
    });

    it('transports >8k declared material losslessly through the capsule', async () => {
      const sc = buildScenario();
      const big = `${'длинная строка материала 🍺\r\n'.repeat(400)}${'x'.repeat(9000)}`;
      writeFileSync(join(sc.repo, 'docs', 'inputs', 'mat1.md'), big);
      sc.git(['add', '-A']);
      sc.git(['commit', '-qm', 'big material']);
      // The scenario now spans cand..bigMaterial: only the material is required.
      sc.head = sc.git(['rev-parse', 'HEAD']);
      sc.mergeBase = sc.git(['merge-base', 'HEAD~1', 'HEAD']);
      sc.requiredPaths = ['docs/inputs/mat1.md'];
      // The manifest must declare the BIG material's digest, not the original one.
      writeFileSync(sc.manifestPath, JSON.stringify([{ path: 'docs/inputs/mat1.md', sha256: sha256hex(big) }]));
      const task = { ...sc.task, commitSha: sc.head } as AifTaskFull;
      const capsule = JSON.stringify({
        title: task.title,
        description: task.description,
        plan: task.plan,
        materials: [{ path: 'docs/inputs/mat1.md', sha256: sha256hex(big), content: big }],
      });
      const r = await run(mod, sc, { tasks: [task] });
      expect(r.out.exitCode).toBe(0);
      expect(Buffer.byteLength(capsule, 'utf8')).toBeGreaterThan(8192);
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', r.uuid);
      expect(readFileSync(join(runDir, 'criteria-final.md'), 'utf8')).toBe(capsule);
    });

    it('holds criteria-over-limit above the native 512KiB rule-file cap without slicing', async () => {
      const sc = buildScenario();
      const huge = `x`.repeat(600 * 1024);
      writeFileSync(join(sc.repo, 'docs', 'inputs', 'mat1.md'), huge);
      sc.git(['add', '-A']);
      sc.git(['commit', '-qm', 'huge material']);
      sc.head = sc.git(['rev-parse', 'HEAD']);
      sc.requiredPaths = ['docs/inputs/mat1.md'];
      // The manifest must declare the HUGE material's digest, so the hold that
      // fires is criteria-over-limit, not material-digest.
      writeFileSync(sc.manifestPath, JSON.stringify([{ path: 'docs/inputs/mat1.md', sha256: sha256hex(huge) }]));
      const task = { ...sc.task, commitSha: sc.head } as AifTaskFull;
      const r = await run(mod, sc, { tasks: [task] });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('criteria-over-limit');
      expect(r.record.reviewCalls).toBe(0);
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', r.uuid);
      expect(existsSync(join(runDir, 'criteria-final.md'))).toBe(false);
    });

    it('round-trips exact Unicode/control/CR/newline material bytes', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc);
      expect(r.out.exitCode).toBe(0);
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', r.uuid);
      const capsule = readFileSync(join(runDir, 'criteria-final.md'), 'utf8');
      const parsed = JSON.parse(capsule) as { materials: { content: string }[] };
      expect(parsed.materials[0]?.content).toBe(MAT_CONTENT);
      // CR/newline survive as JSON escape sequences, control char as \u0001.
      expect(capsule).toContain('\\r\\n');
      expect(capsule).toContain('\\u0001');
      expect(capsule).toContain('☃');
    });

    it('holds ambient-rule-present at T0 and when created mid-run (project and global)', async () => {
      const project = buildScenario();
      mkdirSync(join(project.repo, '.opencodereview'), { recursive: true });
      writeFileSync(join(project.repo, '.opencodereview', 'rule.json'), '{}');
      // Tracked + clean so the run reaches the AMBIENT hold: under the strict
      // untracked policy an untracked ambient rule.json would (correctly) hold
      // undeclared-untracked-input first.
      project.git(['add', '-A']);
      project.git(['commit', '-qm', 'ambient project rule']);
      project.head = project.git(['rev-parse', 'HEAD']);
      project.mergeBase = project.git(['merge-base', 'HEAD~1', 'HEAD']);
      project.requiredPaths = ['.opencodereview/rule.json'];
      const rProject = await run(mod, project, {
        tasks: [{ ...project.task, commitSha: project.head } as AifTaskFull],
      });
      expect(rProject.out.exitCode).toBe(2);
      expect(rProject.out.verdict?.holdReason).toBe('ambient-rule-present');

      const global = buildScenario();
      mkdirSync(join(global.home, '.opencodereview'), { recursive: true });
      writeFileSync(join(global.home, '.opencodereview', 'rule.json'), '{}');
      const rGlobal = await run(mod, global);
      expect(rGlobal.out.verdict?.holdReason).toBe('ambient-rule-present');

      const midRun = buildScenario();
      const rMid = await run(mod, midRun, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              mkdirSync(join(midRun.repo, '.opencodereview'), { recursive: true });
              writeFileSync(join(midRun.repo, '.opencodereview', 'rule.json'), '{}');
            },
          },
        },
      });
      expect(rMid.out.exitCode).toBe(2);
      expect(rMid.out.verdict?.holdReason).toBe('ambient-rule-present');
    });

    it('binds and re-checks the native runtime config by digest only (change ⇒ stale)', async () => {
      const stable = buildScenario();
      mkdirSync(join(stable.home, '.opencodereview'), { recursive: true });
      writeFileSync(join(stable.home, '.opencodereview', 'config.json'), '{"k":"v"}');
      const rStable = await run(mod, stable);
      expect(rStable.out.exitCode).toBe(0);
      expect((rStable.out.verdict?.runtimeConfig as { sha256: string }).sha256).toBe(
        sha256hex('{"k":"v"}'),
      );

      const changed = buildScenario();
      mkdirSync(join(changed.home, '.opencodereview'), { recursive: true });
      writeFileSync(join(changed.home, '.opencodereview', 'config.json'), '{"k":"v1"}');
      const rChanged = await run(mod, changed, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              writeFileSync(join(changed.home, '.opencodereview', 'config.json'), '{"k":"v2"}');
            },
          },
        },
      });
      expect(rChanged.out.exitCode).toBe(2);
      expect(rChanged.out.verdict?.holdReason).toBe('stale-runtime-config');
    });

    it('holds ambient-rule-unknown when a presence probe fails without ENOENT (F-1, T0 and T1)', async () => {
      // T0, project side: a TRACKED self-referential .opencodereview symlink
      // (committed so the strict untracked policy cannot mask the probe) —
      // lstat of <repo>/.opencodereview/rule.json resolves the looping
      // component and fails ELOOP: unknown settings state, never absent.
      const proj = buildScenario();
      symlinkSync('.opencodereview', join(proj.repo, '.opencodereview'));
      proj.git(['add', '-A']);
      proj.git(['commit', '-qm', 'ambient loop']);
      proj.head = proj.git(['rev-parse', 'HEAD']);
      proj.mergeBase = proj.git(['merge-base', 'HEAD~1', 'HEAD']);
      proj.requiredPaths = ['.opencodereview'];
      const rProj = await run(mod, proj, {
        tasks: [{ ...proj.task, commitSha: proj.head } as AifTaskFull],
      });
      expect(rProj.out.exitCode).toBe(2);
      expect(rProj.out.verdict?.holdReason).toBe('ambient-rule-unknown');

      // T0, global side: the same self-loop under the invocation HOME.
      const glob = buildScenario();
      symlinkSync('.opencodereview', join(glob.home, '.opencodereview'));
      const rGlob = await run(mod, glob);
      expect(rGlob.out.exitCode).toBe(2);
      expect(rGlob.out.verdict?.holdReason).toBe('ambient-rule-unknown');

      // T0, ENOTDIR class (shared parent): ~/.opencodereview is a regular
      // FILE — both home-side probes fail ENOTDIR; ambient is checked first,
      // so the verdict names the ambient refusal (the config site's own
      // never-absent classification is witnessed in the parsers suite).
      const filed = buildScenario();
      writeFileSync(join(filed.home, '.opencodereview'), 'not a directory');
      const rFiled = await run(mod, filed);
      expect(rFiled.out.exitCode).toBe(2);
      expect(rFiled.out.verdict?.holdReason).toBe('ambient-rule-unknown');

      // T1, global side: the settings state becomes unverifiable DURING the
      // native process — a failed re-read must HOLD, not pass as absent.
      const mid = buildScenario();
      const rMid = await run(mod, mid, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              symlinkSync('.opencodereview', join(mid.home, '.opencodereview'));
            },
          },
        },
      });
      expect(rMid.out.exitCode).toBe(2);
      expect(rMid.out.verdict?.holdReason).toBe('ambient-rule-unknown');
    });

    it('two-base pair: json-dir resolution carries the capsule; repo-dir resolution loses it', async () => {
      // Positive: the pinned CUSTOM semantics resolve minted refs from the
      // minted JSON's own directory — adjacent minting works.
      const scPos = buildScenario();
      const pos = await run(mod, scPos, { native: { refBase: 'json-dir' } });
      expect(pos.out.exitCode).toBe(0);
      // Negative: the same stub resolving from the REPO directory (project-rule
      // semantics) finds no criteria files there — refs silently empty, capsule
      // gone, HOLD. Minting anywhere but adjacent to the JSON would feed native
      // exactly this silent-empty state.
      const scNeg = buildScenario();
      const neg = await run(mod, scNeg, { native: { refBase: 'repo-dir' } });
      expect(neg.out.exitCode).toBe(2);
      expect(neg.out.verdict?.holdReason).toBe('inspection-lost-capsule');
      expect(neg.record.reviewCalls).toBe(0);
    });

    it('holds inspection-lost-capsule when the printed rule body is truncated', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc, { native: { dropCapsule: true } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('inspection-lost-capsule');
      expect(r.record.reviewCalls).toBe(0);
    });

    it('holds inspection when the capsule appears only OUTSIDE the rule body (I4)', async () => {
      // Well-formed prologue, EMPTY true body, the capsule printed after the
      // closing separator with nothing terminal after it — the anchored frame
      // finds no unique terminal separator; only the validated Rule body
      // establishes transport.
      const sc = buildScenario();
      const r = await run(mod, sc, { native: { framing: 'after-close' } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('inspection-framing');
      expect(r.record.reviewCalls).toBe(0);
    });

    it('holds inspection on unknown or truncated rule framing (I4)', async () => {
      const noHeader = buildScenario();
      const rH = await run(mod, noHeader, { native: { framing: 'no-header' } });
      expect(rH.out.exitCode).toBe(2);
      expect(rH.out.verdict?.holdReason).toBe('inspection-framing');
      expect(rH.record.reviewCalls).toBe(0);
      const noClose = buildScenario();
      const rC = await run(mod, noClose, { native: { framing: 'no-close' } });
      expect(rC.out.exitCode).toBe(2);
      expect(rC.out.verdict?.holdReason).toBe('inspection-framing');
      expect(rC.record.reviewCalls).toBe(0);
    });

    it('accepts an ordinary inline Rule: heading inside the rule body (I4 anchored frame)', async () => {
      // The reviewer's false-HOLD counterexample: a caller criterion whose
      // body itself contains a literal Rule: line. The frame is anchored at
      // the output start, so body content can never forge or break it.
      const sc = buildScenario();
      const inlineRule = join(sc.tmp, 'inline-rules.json');
      writeFileSync(
        inlineRule,
        JSON.stringify({
          rules: [{ path: 'src/**', rule: 'Rule:\nRequire the complete current criteria.' }],
        }),
      );
      const r = await run(mod, sc, { argv: { 'rule-file': inlineRule } });
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.status).toBe('compatible');
    });

    it('holds when the capsule appears only before the outer frame (I4)', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc, { native: { framing: 'capsule-before' } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('inspection-framing');
      expect(r.record.reviewCalls).toBe(0);
    });

    it('holds on unknown Source or Pattern labels in the outer frame (I4)', async () => {
      const badSource = buildScenario();
      const rS = await run(mod, badSource, { native: { framing: 'unknown-source' } });
      expect(rS.out.exitCode).toBe(2);
      expect(rS.out.verdict?.holdReason).toBe('inspection-framing');
      expect(rS.record.reviewCalls).toBe(0);
      const badPattern = buildScenario();
      const rP = await run(mod, badPattern, { native: { framing: 'unknown-pattern' } });
      expect(rP.out.exitCode).toBe(2);
      expect(rP.out.verdict?.holdReason).toBe('inspection-framing');
      expect(rP.record.reviewCalls).toBe(0);
    });

    it('holds on trailing frames or an extra structural separator after an empty body (I4)', async () => {
      const doubled = buildScenario();
      const rD = await run(mod, doubled, { native: { framing: 'double-frame' } });
      expect(rD.out.exitCode).toBe(2);
      expect(rD.out.verdict?.holdReason).toBe('inspection-framing');
      expect(rD.record.reviewCalls).toBe(0);
      // Terminal separator IS present, but the extracted region contains
      // another structural separator — which close is real is ambiguous.
      const extra = buildScenario();
      const rE = await run(mod, extra, { native: { framing: 'outside-extra' } });
      expect(rE.out.exitCode).toBe(2);
      expect(rE.out.verdict?.holdReason).toBe('inspection-framing');
      expect(rE.record.reviewCalls).toBe(0);
    });

    it('delivers per-path selected criteria: src/** gets its inline rule, others the catch-all', async () => {
      // The minted rules.json carries criteria-0 (src/**) plus the ** catch-all;
      // native selects the FIRST applicable entry per inspected path. The stub's
      // select mode resolves from the ACTUAL minted files via the custom-JSON-dir
      // semantics — this pins per-path delivery the unioning stub could not see.
      const sc = buildScenario();
      const r = await run(mod, sc, { native: { select: true } });
      expect(r.out.exitCode).toBe(0);
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', r.uuid);
      const capsule = capsuleOf(sc);
      const inspectionText = (phase: string, p: string): string =>
        readFileSync(join(runDir, `inspection-${phase}-${sha256hex(p).slice(0, 16)}.txt`), 'utf8');
      const srcOut = inspectionText('t0', 'src/widget.ts');
      expect(srcOut).toContain('Focus on src.');
      expect(srcOut).toContain(capsule);
      const otherOut = inspectionText('t0', 'dep.txt');
      expect(otherOut).toContain(capsule);
      expect(otherOut).not.toContain('Focus on src.');
    });

    it('holds stale-criteria when a generated criteria file is deleted mid-run', async () => {
      // The run dir must be known BEFORE the review fires, so the mutate hook
      // can delete inside it — fixed uuid passed to run().
      const sc = buildScenario();
      const uuid = `fixed-${UUID}`;
      const r = await run(mod, sc, {
        uuid,
        native: {
          review: {
            mutate: () => {
              rmSync(join(sc.repoReal, '.ai-factory', 'ocr', uuid, 'criteria-final.md'));
            },
          },
        },
      });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('stale-criteria');
    });

    it('holds stale-inspection when the T1 applied rule changes with capsule and frame intact (F-3)', async () => {
      // The native prints a DIFFERENT valid rule body on the T1 round — same
      // outer frame, complete capsule, our minted files untouched — so capsule
      // presence alone must not look successful: the T1 inspection is bound to
      // the T0 applied-rule evidence by digest.
      const sc = buildScenario();
      const r = await run(mod, sc, { native: { t1MutateRule: true } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('stale-inspection');
      // The T1 binding is retained in the verdict (digests only, no bodies).
      expect(r.out.verdict?.inspection1?.length).toBe(sc.requiredPaths.length);
    });

    it('persists the T1 inspection binding on a compatible run without private bodies (F-3)', async () => {
      const sc = buildScenario();
      const r = await run(mod, sc);
      expect(r.out.exitCode).toBe(0);
      const v = r.out.verdict;
      expect(v?.inspection1?.length).toBe(sc.requiredPaths.length);
      for (const i of v?.inspection1 ?? []) {
        const t0 = (v?.inspection ?? []).find((x) => x.path === i.path);
        expect(t0?.outputSha256).toBe(i.outputSha256);
      }
      // Evidence only: no material/capsule BODY text may leak into the verdict.
      expect(JSON.stringify(v)).not.toContain('snowman');
      expect(JSON.stringify(v)).not.toContain('mat line1');
    });

    it('holds unknown/mismatched task, project and candidate identity', async () => {
      const wrongId = buildScenario();
      const rId = await run(mod, wrongId, {
        tasks: [{ ...wrongId.task, id: 'other-task' } as AifTaskFull],
      });
      expect(rId.out.exitCode).toBe(2);
      expect(rId.out.verdict?.holdReason).toBe('task-identity-mismatch');

      const noProject = buildScenario();
      const rProj = await run(mod, noProject, {
        tasks: [{ ...noProject.task, projectId: ' ' } as AifTaskFull],
      });
      expect(rProj.out.verdict?.holdReason).toBe('task-missing-fields');

      const noPlan = buildScenario();
      const rPlan = await run(mod, noPlan, { tasks: [{ ...noPlan.task, plan: null } as AifTaskFull] });
      expect(rPlan.out.verdict?.holdReason).toBe('task-missing-fields');

      const blankDesc = buildScenario();
      const rDesc = await run(mod, blankDesc, {
        tasks: [{ ...blankDesc.task, description: '   ' } as AifTaskFull],
      });
      expect(rDesc.out.verdict?.holdReason).toBe('unknown-criteria');

      const moved = buildScenario();
      // Flip the first hex char to a GUARANTEED-different digit — a fixed '0'
      // prefix is a no-op whenever the fixture SHA happens to start with '0'
      // (latent 1/16 flake per run; observed 2026-10-29).
      const flipped = `${moved.head[0] === '0' ? '1' : '0'}${moved.head.slice(1)}`;
      const rHead = await run(mod, moved, {
        tasks: [{ ...moved.task, commitSha: flipped } as AifTaskFull],
      });
      expect(rHead.out.exitCode).toBe(2);
      expect(rHead.out.verdict?.holdReason).toBe('head-mismatch');

      const unknown = buildScenario();
      const rUnknown = await run(mod, unknown, { tasks: [null as unknown as AifTaskFull] });
      expect(rUnknown.out.exitCode).toBe(1);
    });

    it('maps WSL-style roots, rejects prefix siblings and traversal, allows identical roots', async () => {
      // Default scenario IS the WSL-style mapping (be/repo → ne/repo).
      const sc = buildScenario();
      const r = await run(mod, sc);
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.repo).toBe(sc.repoReal);

      const sibling = buildScenario();
      const rSib = await run(mod, sibling, {
        tasks: [{ ...sibling.task, worktreePath: join(sibling.tmp, 'be-evil', 'repo') } as AifTaskFull],
      });
      expect(rSib.out.exitCode).toBe(2);
      expect(rSib.out.verdict?.holdReason).toBe('identity-mapping');

      const traversal = buildScenario();
      const rTrav = await run(mod, traversal, {
        tasks: [
          { ...traversal.task, worktreePath: join(traversal.tmp, 'be', '..', 'outside', 'repo') } as AifTaskFull,
        ],
      });
      expect(rTrav.out.verdict?.holdReason).toBe('identity-mapping');

      const identical = buildScenario();
      const rIdent = await run(mod, identical, {
        argv: { 'backend-root': identical.nativeRoot },
        tasks: [{ ...identical.task, worktreePath: identical.repo } as AifTaskFull],
      });
      expect(rIdent.out.exitCode).toBe(0);
    });

    it('holds stale-identity-mapping when the mapped alias retargets or dies mid-run (F-2)', async () => {
      // Move the real checkout behind a native-side ALIAS symlink: the mapped
      // path (tmp/ne/repo) resolves onto --repo at T0, and the cached checkout
      // stays clean with the same HEAD, task and materials throughout — only
      // the external mapping moves. T1 must re-establish the identity itself.
      const mkAliased = (): Scenario & { alias: string; real: string } => {
        const sc = buildScenario();
        const real = join(sc.tmp, 'checkout-A');
        renameSync(sc.repo, real);
        symlinkSync(real, sc.repo); // tmp/ne/repo is now the alias onto A
        return { ...sc, alias: sc.repo, real };
      };
      // Stability control: an UNCHANGED alias re-resolves identically at T1.
      const keep = mkAliased();
      const rKeep = await run(mod, keep);
      expect(rKeep.out.exitCode).toBe(0);

      // Retarget: mid-run the alias resolves to a different directory while
      // every cached fact about A still matches.
      const retarget = mkAliased();
      const other = join(retarget.tmp, 'checkout-B');
      const rRet = await run(mod, retarget, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              // rmSync on a symlink needs recursive:true on Node 24 — a bare
              // rmSync throws "Path is a directory" through the stub.
              rmSync(retarget.alias, { recursive: true, force: true });
              mkdirSync(other, { recursive: true });
              symlinkSync(other, retarget.alias);
            },
          },
        },
      });
      expect(rRet.out.exitCode).toBe(2);
      expect(rRet.out.verdict?.holdReason).toBe('stale-identity-mapping');

      // Failed resolution: the alias is deleted and not recreated — the T1
      // mapping cannot be re-established at all.
      const gone = mkAliased();
      const rGone = await run(mod, gone, {
        native: {
          review: {
            result: 'ok',
            mutate: () => rmSync(gone.alias, { recursive: true, force: true }),
          },
        },
      });
      expect(rGone.out.exitCode).toBe(2);
      expect(rGone.out.verdict?.holdReason).toBe('stale-identity-mapping');
    });

    it('holds tracked-dirty on worktree AND staged changes to unchanged dependencies', async () => {
      const worktree = buildScenario();
      writeFileSync(join(worktree.repo, 'dep.txt'), 'dirty mid-run edit\n');
      const rWt = await run(mod, worktree);
      expect(rWt.out.exitCode).toBe(2);
      expect(rWt.out.verdict?.holdReason).toBe('tracked-dirty');

      const staged = buildScenario();
      writeFileSync(join(staged.repo, 'README.md'), 'staged edit\n');
      staged.git(['add', 'README.md']);
      const rSt = await run(mod, staged);
      expect(rSt.out.verdict?.holdReason).toBe('tracked-dirty');
    });

    it('holds undeclared untracked inputs; declared material/manifest/run-dir inputs stay accepted', async () => {
      // Positive: manifest placed INSIDE the repo — an allowed digest-bound exception.
      const sc = buildScenario();
      const insideManifest = join(sc.repo, 'materials-inside.json');
      writeFileSync(insideManifest, readFileSync(sc.manifestPath));
      const r = await run(mod, sc, { argv: { materials: insideManifest } });
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.untracked0).toContain('materials-inside.json');

      // Positive: an explicitly declared UNTRACKED material is accepted (the
      // manifest's digest binds it before the run).
      const scUn = buildScenario();
      const untrackedMat = 'docs/inputs/untracked-mat.md';
      const untrackedContent = 'declared but never committed\n';
      writeFileSync(join(scUn.repo, untrackedMat), untrackedContent);
      const manifestWithUntracked = join(scUn.tmp, 'materials-untracked.json');
      writeFileSync(
        manifestWithUntracked,
        JSON.stringify([
          { path: 'docs/inputs/mat1.md', sha256: sha256hex(MAT_CONTENT) },
          { path: untrackedMat, sha256: sha256hex(untrackedContent) },
        ]),
      );
      const rUn = await run(mod, scUn, { argv: { materials: manifestWithUntracked } });
      expect(rUn.out.exitCode).toBe(0);
      expect(rUn.out.verdict?.untracked0).toContain(untrackedMat);
      expect(rUn.out.verdict?.materials?.map((m) => m.path)).toContain(untrackedMat);

      // Negative (I3): ANY other untracked input file is a HOLD — the review's
      // exact counterexample, previously waived because it is not a required path.
      const scCtx = buildScenario();
      writeFileSync(join(scCtx.repo, 'src', 'untracked-context.ts'), 'export {};\n');
      const rCtx = await run(mod, scCtx);
      expect(rCtx.out.exitCode).toBe(2);
      expect(rCtx.out.verdict?.holdReason).toBe('undeclared-untracked-input');
      expect(rCtx.out.verdict?.untracked0).toContain('src/untracked-context.ts');

      // Collision with a required path only arises together with an index
      // change (rm --cached): the tree is then dirty AND the collision is
      // recorded — never silently waived.
      const collide = buildScenario();
      collide.git(['rm', '-q', '--cached', 'docs/new note.md']);
      const rCol = await run(mod, collide);
      expect(rCol.out.exitCode).toBe(2);
      expect(['tracked-dirty', 'undeclared-untracked-input']).toContain(rCol.out.verdict?.holdReason);
      expect(rCol.out.verdict?.untracked0).toContain('docs/new note.md');
    });

    it('accepts native session/raw artifacts under the invocation HOME (no repo exemption needed)', async () => {
      // Pinned upstream persist.go:24,106-117 / raw_writer.go:19-59: native
      // writes session/raw artifacts ONLY under $HOME/.opencodereview/{sessions,raw},
      // never inside the reviewed repo — so the strict untracked-input policy
      // needs no repo-folder waiver for them.
      const sc = buildScenario();
      const r = await run(mod, sc, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              const enc = join(sc.home, '.opencodereview', 'sessions', 'enc-repo', 'sess-1');
              mkdirSync(enc, { recursive: true });
              writeFileSync(join(enc, 'sess-1.jsonl'), '{"event":"x"}\n');
              mkdirSync(join(sc.home, '.opencodereview', 'raw', 'enc-repo'), { recursive: true });
              writeFileSync(join(sc.home, '.opencodereview', 'raw', 'enc-repo', 'r1.txt'), 'raw\n');
            },
          },
        },
      });
      expect(r.out.exitCode).toBe(0);
      expect(existsSync(join(sc.home, '.opencodereview', 'sessions', 'enc-repo', 'sess-1', 'sess-1.jsonl'))).toBe(
        true,
      );
    });

    it('holds stale-head / stale-task on changes during the native process', async () => {
      const movedHead = buildScenario();
      const rHead = await run(mod, movedHead, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              movedHead.git(['commit', '--allow-empty', '-qm', 'late commit']);
            },
          },
        },
      });
      expect(rHead.out.exitCode).toBe(2);
      expect(rHead.out.verdict?.holdReason).toBe('stale-head');

      const changedTask = buildScenario();
      const rTask = await run(mod, changedTask, {
        tasks: [changedTask.task, { ...changedTask.task, description: 'changed mid-run' } as AifTaskFull],
      });
      expect(rTask.out.verdict?.holdReason).toBe('stale-task');

      const changedRules = buildScenario();
      const rRules = await run(mod, changedRules, {
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              writeFileSync(changedRules.ruleFilePath, JSON.stringify({ rules: [{ path: '**', rule: 'x y' }] }));
            },
          },
        },
      });
      expect(rRules.out.verdict?.holdReason).toBe('stale-criteria');
    });

    it('holds empty-range and unsupported identity (base ref must resolve)', async () => {
      const empty = buildScenario();
      empty.git(['commit', '--allow-empty', '-qm', 'empty candidate']);
      const emptyTask = { ...empty.task, commitSha: empty.git(['rev-parse', 'HEAD']) } as AifTaskFull;
      const rEmpty = await run(mod, empty, {
        tasks: [emptyTask],
        argv: { 'base-ref': 'HEAD~1' },
      });
      expect(rEmpty.out.exitCode).toBe(2);
      expect(rEmpty.out.verdict?.holdReason).toBe('empty-range');

      const badRef = buildScenario();
      const rRef = await run(mod, badRef, { argv: { 'base-ref': 'no-such-ref' } });
      expect(rRef.out.exitCode).toBe(1);
    });

    it('reviews the merge-base range: a diverged base tip is not candidate material (I1)', async () => {
      // Move the base branch AFTER the fork point: base-only.ts is base-side
      // work the native invocation (which reviews --from MERGE_BASE --to HEAD)
      // never sees — requiring it as review material is a false HOLD.
      const sc = buildScenario();
      sc.git(['checkout', '-q', '-b', 'basebranch', 'HEAD~1']);
      writeFileSync(join(sc.repo, 'base-only.ts'), 'base side only\n');
      sc.git(['add', '-A']);
      sc.git(['commit', '-qm', 'base moves on']);
      sc.git(['checkout', '-q', 'main']);
      sc.mergeBase = sc.git(['merge-base', 'basebranch', 'HEAD']);
      // The fork point is still the original base commit, so the scenario's
      // independently derived requiredPaths (HEAD~1..HEAD) remain correct.
      expect(sc.mergeBase).toBe(sc.git(['rev-parse', 'HEAD~1']));
      const r = await run(mod, sc, { argv: { 'base-ref': 'basebranch' } });
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.status).toBe('compatible');
      expect(r.out.verdict?.range?.requiredPaths).not.toContain('base-only.ts');
      // Base-tip currency is checked independently of the denominator.
      expect(r.out.verdict?.range?.base).toBe(sc.git(['rev-parse', 'basebranch']));
    });

    // --- default-process witness -----------------------------------------------------------------
    // The stub arms above prove CLI logic; these prove the repaired pipeline through
    // the REAL defaultDeps().spawnChild — an execve of an owned scratch node
    // executable (no model, no network). Only the two deterministic seams
    // (getTask/uuid) are overridden, the existing injection surface.
    it('default-process witness: real spawn carries the repaired pipeline end to end', async () => {
      const sc = buildScenario();
      const uuid = `witness-p1-${UUID}`;
      const out = await runRealNative(mod, sc, 'proper', {}, uuid);
      expect(out.exitCode).toBe(0);
      expect(out.verdict?.status).toBe('compatible');
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', uuid);
      expect(existsSync(join(runDir, 'ocr-result.json'))).toBe(true);
      expect(existsSync(join(runDir, 'native-stdout.txt'))).toBe(true);
      expect(out.verdict?.invocation?.status).toBe(0);
    });

    it('default-process witness: a diverged base tip stays out of scope through real spawn (I1)', async () => {
      const sc = buildScenario();
      sc.git(['checkout', '-q', '-b', 'basebranch', 'HEAD~1']);
      writeFileSync(join(sc.repo, 'base-only.ts'), 'base side only\n');
      sc.git(['add', '-A']);
      sc.git(['commit', '-qm', 'base moves on']);
      sc.git(['checkout', '-q', 'main']);
      const out = await runRealNative(mod, sc, 'proper', { 'base-ref': 'basebranch' }, `witness-p2-${UUID}`);
      expect(out.exitCode).toBe(0);
      expect(out.verdict?.status).toBe('compatible');
      expect(out.verdict?.range?.requiredPaths).not.toContain('base-only.ts');
    });

    it('default-process witness: outside-body capsule holds through real spawn (I4)', async () => {
      const sc = buildScenario();
      const out = await runRealNative(mod, sc, 'after-close', {}, `witness-p3-${UUID}`);
      expect(out.exitCode).toBe(2);
      expect(out.verdict?.holdReason).toBe('inspection-framing');
    });
  });

  // --- C2: the explicit local-request profile ----------------------------------
  // The AIF task-bound profile above keeps its entire existing matrix unchanged
  // (brief: reuse unchanged tests, no whole-matrix duplication). These arms cover
  // ONLY the new local profile: --request-file/--request-sha256, no AIF call, and
  // the profile-specific negatives. The shared pipeline (materials, capsule,
  // inspection, invocation, comparison) is exercised through the same stub.
  describe(`ocrTrustedReview (${label}) — explicit local-request profile (C2)`, () => {
    it('runs the complete local invocation with the exact native argv and a distinct request binding', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      const r = await run(mod, sc, { local: req });
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', r.uuid);
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.status).toBe('compatible');
      expect(r.out.verdict?.profile).toBe('local');
      expect(r.out.verdict?.request).toEqual({
        path: req.path,
        sha256: req.sha256,
        id: 'req-c2-1',
        head: sc.head,
      });
      // No invented AIF task binding rides along in local mode.
      expect((r.out.verdict as unknown as Record<string, unknown>)['task']).toBeUndefined();
      // ONE native review invocation, the same closed argv as the AIF profile.
      expect(r.record.reviewCalls).toBe(1);
      expect(r.record.reviewArgv).toEqual([
        sc.ocrBin,
        'review',
        '--repo', sc.repoReal,
        '--from', sc.mergeBase,
        '--to', sc.head,
        '--rule', join(runDir, 'rules.json'),
        '--format', 'json',
        '--audience', 'agent',
        '--color', 'never',
        '--provider', 'chatgpt',
        '-o', join(runDir, 'ocr-result.json'),
      ]);
      // The minted capsule carries the REQUEST's title/description/plan plus the
      // complete declared materials — one shared criteria pipeline.
      const capsule = localCapsuleOf(sc);
      expect(readFileSync(join(runDir, 'criteria-final.md'), 'utf8')).toBe(capsule);
      expect(readFileSync(join(runDir, 'criteria-0.md'), 'utf8')).toBe(`Focus on src.\nBe strict.\n${capsule}`);
      const persisted = JSON.parse(readFileSync(join(runDir, 'trusted-review-verdict.json'), 'utf8'));
      expect(persisted.profile).toBe('local');
      expect(persisted.request?.id).toBe('req-c2-1');
      expect(persisted.status).toBe('compatible');
    });

    it('makes no AIF HTTP call in local mode (any fetch fails the run)', async () => {
      // run()'s local seam makes deps.getTask throw UNEXPECTED-AIF-CALL — a
      // compatible local verdict is itself the witness that it was never called.
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      const r = await run(mod, sc, { local: req });
      expect(r.out.exitCode).toBe(0);
      expect(r.out.stderrLine).not.toMatch(/UNEXPECTED-AIF-CALL/);
      expect(r.out.stderrLine).toMatch(/not a semantic ResultReview/);
    });

    it('accepts a null plan as the explicitly authorized local shape', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc, (b) => {
        b.plan = null;
      });
      const r = await run(mod, sc, { local: req });
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.status).toBe('compatible');
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', r.uuid);
      expect(JSON.parse(readFileSync(join(runDir, 'criteria-final.md'), 'utf8')).plan).toBeNull();
    });

    it('rejects mixed and partial profile flags with exit 1', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      // Mixed: the full AIF set AND the local set.
      const rMixed = await run(mod, sc, {
        local: req,
        extraArgv: ['--task', sc.task.id, '--aif-url', 'http://aif.invalid/api',
          '--backend-root', sc.backendRoot, '--native-root', sc.nativeRoot],
      });
      expect(rMixed.out.exitCode).toBe(1);
      expect(rMixed.out.verdict).toBeNull();
      expect(rMixed.out.stderrLine).toMatch(/mixed/i);
      // A single stray AIF flag over a local invocation is still mixed.
      const rStray = await run(mod, sc, { local: req, extraArgv: ['--task', sc.task.id] });
      expect(rStray.out.exitCode).toBe(1);
      expect(rStray.out.stderrLine).toMatch(/mixed/i);
      // Partial local: --request-file without --request-sha256.
      const rNoSha = await run(mod, sc, { local: req, argv: { 'request-sha256': '' } });
      expect(rNoSha.out.exitCode).toBe(1);
      expect(rNoSha.out.stderrLine).toMatch(/both --request-file and --request-sha256/i);
      // Partial local: --request-sha256 without --request-file.
      const rNoFile = await run(mod, sc, { local: req, argv: { 'request-file': '' } });
      expect(rNoFile.out.exitCode).toBe(1);
      expect(rNoFile.out.stderrLine).toMatch(/both --request-file and --request-sha256/i);
    });

    it('rejects a relative --request-file and a non-hex --request-sha256 with exit 1', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      const rRel = await run(mod, sc, { local: req, argv: { 'request-file': 'request.json' } });
      expect(rRel.out.exitCode).toBe(1);
      expect(rRel.out.stderrLine).toMatch(/--request-file must be an absolute path/);
      const rHex = await run(mod, sc, { local: req, argv: { 'request-sha256': 'nothex' } });
      expect(rHex.out.exitCode).toBe(1);
      expect(rHex.out.stderrLine).toMatch(/--request-sha256 must be a full 64-hex/);
    });

    it('holds request-digest when the pinned bytes do not match --request-sha256', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      const r = await run(mod, sc, { local: req, argv: { 'request-sha256': '0'.repeat(64) } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('request-digest');
      expect(r.record.reviewCalls).toBe(0);
    });

    it('holds request-shape on unknown or invalid request shapes', async () => {
      const arms: { name: string; write: (sc: Scenario) => LocalRequest }[] = [
        {
          name: 'wrong kind',
          write: (sc) => writeLocalRequest(sc, (b) => { b.kind = 'other.request/v9'; }),
        },
        {
          name: 'blank description (criteria cannot be bound)',
          write: (sc) => writeLocalRequest(sc, (b) => { b.description = '   '; }),
        },
        {
          name: 'missing head',
          write: (sc) => writeLocalRequest(sc, (b) => { delete b.head; }),
        },
        {
          name: 'short head',
          write: (sc) => writeLocalRequest(sc, (b) => { b.head = (b.head as string).slice(0, 39); }),
        },
        {
          name: 'plan as number',
          write: (sc) => writeLocalRequest(sc, (b) => { b.plan = 7; }),
        },
        {
          name: 'extra key',
          write: (sc) => writeLocalRequest(sc, (b) => { b.extra = true; }),
        },
        {
          name: 'not JSON',
          write: (sc) => {
            const path = join(sc.tmp, 'request.json');
            writeFileSync(path, 'not-json{');
            return { path, sha256: sha256hex('not-json{') };
          },
        },
        {
          name: 'not strict UTF-8',
          write: (sc) => {
            const path = join(sc.tmp, 'request.json');
            const bytes = Buffer.from([0x7b, 0xff, 0xfe, 0x7d]);
            writeFileSync(path, bytes);
            return { path, sha256: sha256hex(bytes) };
          },
        },
      ];
      for (const arm of arms) {
        const sc = buildScenario();
        const req = arm.write(sc);
        const r = await run(mod, sc, { local: req });
        expect(r.out.exitCode, arm.name).toBe(2);
        expect(r.out.verdict?.holdReason, arm.name).toBe('request-shape');
        expect(r.record.reviewCalls, arm.name).toBe(0);
      }
    });

    // Single production change that flips this case: the readFileSync catch in
    // the local profile returning holdResult('request-unreadable', …) instead
    // of throwing. The request sha stays pinned by writeLocalRequest; only the
    // file's bytes are removed — no sibling input can flip the case.
    it('holds request-unreadable when the request file is missing or unreadable (exit 2), never compatibility', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      rmSync(req.path);
      const r = await run(mod, sc, { local: req });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.status).toBe('hold');
      expect(r.out.verdict?.holdReason).toBe('request-unreadable');
      expect(r.out.stderrLine).toMatch(/request-unreadable/);
      expect(r.record.reviewCalls).toBe(0);
    });

    it('holds head-mismatch when HEAD differs from the requested head', async () => {
      const moved = buildScenario();
      // Flip the first hex char to a GUARANTEED-different digit (1/16-flake guard).
      const flipped = `${moved.head[0] === '0' ? '1' : '0'}${moved.head.slice(1)}`;
      const req = writeLocalRequest(moved, (b) => { b.head = flipped; });
      const r = await run(mod, moved, { local: req });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('head-mismatch');
    });

    it('rejects an unresolvable base ref in local mode (exit 1)', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      const r = await run(mod, sc, { local: req, argv: { 'base-ref': 'no-such-ref' } });
      expect(r.out.exitCode).toBe(1);
    });

    it('transports a >8k declared material losslessly through the local capsule', async () => {
      const sc = buildScenario();
      const big = `${'длинная строка материала 🍺\r\n'.repeat(400)}${'x'.repeat(9000)}`;
      writeFileSync(join(sc.repo, 'docs', 'inputs', 'mat1.md'), big);
      sc.git(['add', '-A']);
      sc.git(['commit', '-qm', 'big material']);
      sc.head = sc.git(['rev-parse', 'HEAD']);
      sc.mergeBase = sc.git(['merge-base', 'HEAD~1', 'HEAD']);
      sc.requiredPaths = ['docs/inputs/mat1.md'];
      writeFileSync(sc.manifestPath, JSON.stringify([{ path: 'docs/inputs/mat1.md', sha256: sha256hex(big) }]));
      const req = writeLocalRequest(sc);
      const r = await run(mod, sc, { local: req });
      expect(r.out.exitCode).toBe(0);
      const runDir = join(sc.repoReal, '.ai-factory', 'ocr', r.uuid);
      const capsule = readFileSync(join(runDir, 'criteria-final.md'), 'utf8');
      expect(Buffer.byteLength(capsule, 'utf8')).toBeGreaterThan(8192);
      expect(JSON.parse(capsule).materials[0].content).toBe(big);
    });

    it('holds stale-request when the request file changes or dies mid-run', async () => {
      const changed = buildScenario();
      const reqChanged = writeLocalRequest(changed);
      const rCh = await run(mod, changed, {
        local: reqChanged,
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              const body = localRequestBody(changed);
              body.description = 'changed mid-run';
              writeFileSync(reqChanged.path, JSON.stringify(body));
            },
          },
        },
      });
      expect(rCh.out.exitCode).toBe(2);
      expect(rCh.out.verdict?.holdReason).toBe('stale-request');

      const gone = buildScenario();
      const reqGone = writeLocalRequest(gone);
      const rDel = await run(mod, gone, {
        local: reqGone,
        native: { review: { result: 'ok', mutate: () => rmSync(reqGone.path) } },
      });
      expect(rDel.out.exitCode).toBe(2);
      expect(rDel.out.verdict?.holdReason).toBe('stale-request');
    });

    it('holds stale-identity-mapping when the canonical --repo alias retargets mid-run (local)', async () => {
      // No backend/native mapping exists in local mode — the identity that T1
      // must re-establish is canonical --repo and the Git toplevel themselves.
      const mkAliased = (): Scenario & { alias: string } => {
        const sc = buildScenario();
        const real = join(sc.tmp, 'checkout-A');
        renameSync(sc.repo, real);
        symlinkSync(real, sc.repo); // tmp/ne/repo is now an alias onto A
        return { ...sc, alias: sc.repo };
      };
      // Stability control: an UNCHANGED alias re-resolves identically at T1.
      const keep = mkAliased();
      const reqKeep = writeLocalRequest(keep);
      const rKeep = await run(mod, keep, { local: reqKeep });
      expect(rKeep.out.exitCode).toBe(0);

      // Retarget: mid-run the alias resolves elsewhere while every cached fact
      // (clean checkout, same HEAD, same request/materials) still matches.
      const retarget = mkAliased();
      const reqRet = writeLocalRequest(retarget);
      const other = join(retarget.tmp, 'checkout-B');
      const rRet = await run(mod, retarget, {
        local: reqRet,
        native: {
          review: {
            result: 'ok',
            mutate: () => {
              rmSync(retarget.alias, { recursive: true, force: true });
              mkdirSync(other, { recursive: true });
              symlinkSync(other, retarget.alias);
            },
          },
        },
      });
      expect(rRet.out.exitCode).toBe(2);
      expect(rRet.out.verdict?.holdReason).toBe('stale-identity-mapping');

      // Failed resolution: the alias is deleted and not recreated.
      const gone = mkAliased();
      const reqGone = writeLocalRequest(gone);
      const rGone = await run(mod, gone, {
        local: reqGone,
        native: {
          review: { result: 'ok', mutate: () => rmSync(gone.alias, { recursive: true, force: true }) },
        },
      });
      expect(rGone.out.exitCode).toBe(2);
      expect(rGone.out.verdict?.holdReason).toBe('stale-identity-mapping');
    });

    it('keeps an in-repo request file an allowed untracked input', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc, undefined, 'repo');
      const r = await run(mod, sc, { local: req });
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.untracked0).toContain('request-inside.json');
    });

    // Single production change that flips this case: the local-profile head
    // comparison demanding equal-length exact equality instead of the AIF
    // prefix form. The request sha stays pinned by writeLocalRequest; the ONLY
    // mutated input is head = sc.head.slice(0, 40) — shape-valid 40-hex against
    // a 64-hex SHA-256 HEAD (a SHA-256 repo, not a mutated SHA-1 one, is the
    // one fixture where both shapes are simultaneously valid).
    it('holds head-mismatch when local request.head is a 40-hex prefix of a SHA-256 HEAD (exit 2)', async () => {
      const sc = buildScenario({ objectFormat: 'sha256' });
      expect(sc.head).toMatch(/^[0-9a-f]{64}$/i);
      const req = writeLocalRequest(sc, (b) => {
        b.head = (b.head as string).slice(0, 40);
      });
      const r = await run(mod, sc, { local: req });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.status).toBe('hold');
      expect(r.out.verdict?.holdReason).toBe('head-mismatch');
      expect(r.out.stderrLine).toMatch(/head-mismatch/);
      expect(r.record.reviewCalls).toBe(0);
    });

    // Control: exact 64-hex equality still runs in a SHA-256 repository.
    it('accepts an exact 64-hex local request.head in a SHA-256 repository', async () => {
      const sc = buildScenario({ objectFormat: 'sha256' });
      const req = writeLocalRequest(sc);
      const r = await run(mod, sc, { local: req });
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.status).toBe('compatible');
      expect(r.out.verdict?.request?.head).toBe(sc.head);
    });

    // Single production change that flips this case: admitting the
    // canonical-parent/lexical-leaf entry of the supplied request alongside its
    // realpath. Pins: the request bytes are written once outside the repo and
    // read through the link (digest identical, sha pinned by writeLocalRequest)
    // — only the untracked symlink ENTRY distinguishes this fixture from the
    // compatible happy path.
    it('admits an in-repo symlink to the pinned local request instead of holding undeclared-untracked-input', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      const link = join(sc.repo, 'request-link.json');
      symlinkSync(req.path, link);
      const r = await run(mod, sc, { local: { path: link, sha256: req.sha256 } });
      expect(r.out.verdict?.untracked0).toContain('request-link.json');
      expect(r.out.exitCode).toBe(0);
      expect(r.out.verdict?.status).toBe('compatible');
      expect(r.out.verdict?.request?.path).toBe(link);
    });

    // Negative control for the entry exemption: only the SUPPLIED entry is
    // admitted — a second, unrelated in-repo symlink stays undeclared context.
    it('still holds undeclared-untracked-input for an unrelated in-repo symlink', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      const link = join(sc.repo, 'request-link.json');
      symlinkSync(req.path, link);
      symlinkSync(req.path, join(sc.repo, 'other-link.json'));
      const r = await run(mod, sc, { local: { path: link, sha256: req.sha256 } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('undeclared-untracked-input');
      expect(r.out.verdict?.untracked0).toContain('other-link.json');
      expect(r.record.reviewCalls).toBe(0);
    });

    it('holds stale-inspection when the T1 applied rule changes (F-3, local profile)', async () => {
      const sc = buildScenario();
      const req = writeLocalRequest(sc);
      const r = await run(mod, sc, { local: req, native: { t1MutateRule: true } });
      expect(r.out.exitCode).toBe(2);
      expect(r.out.verdict?.holdReason).toBe('stale-inspection');
    });
  });
}
