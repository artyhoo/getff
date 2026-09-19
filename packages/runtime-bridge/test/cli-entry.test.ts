// packages/runtime-bridge/test/cli-entry.test.ts
/**
 * Paired tests for src/cli/cliEntry.ts — the shared CLI entrypoint plumbing that
 * replaces the copy-pasted main-module guard (A6-1 / R-6) and the hand-rolled
 * `--flag <value>` lookup (A6-4 / A6-7 / R-6) in every runtime-bridge CLI.
 *
 * T3 compliance: each assertion names the defect it closes.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { isMain, parseCliArgs, CliArgError } from '../src/cli/cliEntry.js';

const HERE = fileURLToPath(import.meta.url);

describe('isMain — realpath on BOTH sides (A6-1)', () => {
  it('true when argv[1] is a SYMLINK to the module file (the npx/bin/.bin case)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-entry-'));
    try {
      const target = join(dir, 'real-cli.ts');
      writeFileSync(target, '// target\n');
      const link = join(dir, 'linked-cli');
      symlinkSync(target, link);

      // Pre-fix this was FALSE: fileURLToPath(import.meta.url) is the RESOLVED
      // target while argv[1] is the LINK → guard false → CLI exits 0 doing nothing.
      expect(isMain(pathToFileURL(target).href, link)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('true when argv[1] is the module file itself (the plain `tsx park.ts` case)', () => {
    expect(isMain(pathToFileURL(HERE).href, HERE)).toBe(true);
  });

  it('false for an unrelated argv[1] (importing the module must stay side-effect-free)', () => {
    expect(isMain(pathToFileURL(HERE).href, join(tmpdir(), 'somewhere-else.ts'))).toBe(false);
  });

  it('false — never throws — when argv[1] is absent (node -e, some embedders)', () => {
    expect(isMain(pathToFileURL(HERE).href, undefined)).toBe(false);
  });
});

const OPTS = {
  options: {
    task: { type: 'string' },
    question: { type: 'string' },
    json: { type: 'boolean' },
  },
  maxPositionals: 1,
} as const;

describe('parseCliArgs — rejects the argv shapes the hand-rolled lookup accepted', () => {
  it('accepts the normal shape', () => {
    const got = parseCliArgs(['--task', 't1', '--question', 'Fork?', '--json'], OPTS);
    expect(got.values).toEqual({ task: 't1', question: 'Fork?', json: true });
    expect(got.positionals).toEqual([]);
  });

  it('accepts --flag=value', () => {
    expect(parseCliArgs(['--task=t1'], OPTS).values.task).toBe('t1');
  });

  it('A6-7: a flag whose value is the NEXT FLAG is an error, not a value', () => {
    // Old valueOf(): `--task --question X` → taskId '--question' → GET /tasks/--question → 404.
    expect(() => parseCliArgs(['--task', '--question', 'Fork?'], OPTS)).toThrow(CliArgError);
  });

  it('A6-4: a value-taking flag BEFORE a positional does not swallow the positional', () => {
    const got = parseCliArgs(['--question', 'Fork?', 'f1010da4'], OPTS);
    expect(got.positionals).toEqual(['f1010da4']);
    expect(got.values.question).toBe('Fork?');
  });

  it('rejects a trailing value-taking flag with no value at all', () => {
    expect(() => parseCliArgs(['--task'], OPTS)).toThrow(CliArgError);
  });

  it('rejects an EMPTY --flag= value rather than silently taking the empty string', () => {
    expect(() => parseCliArgs(['--task='], OPTS)).toThrow(/empty value/);
  });

  it('rejects an unknown flag instead of silently ignoring it', () => {
    expect(() => parseCliArgs(['--taks', 't1'], OPTS)).toThrow(/unknown option/i);
  });

  it('rejects positional junk beyond the declared maximum', () => {
    expect(() => parseCliArgs(['a', 'b'], OPTS)).toThrow(/unexpected argument/i);
  });

  it('error messages are CliArgError (the CLIs turn them into exit 1 + stderr)', () => {
    try {
      parseCliArgs(['--nope'], OPTS);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CliArgError);
      expect((err as Error).message).toMatch(/--nope/);
    }
  });
});
