// Criterion 8 paired-negative: a v2-aware reader REFUSES a v1 lock loudly with a
// «regenerate the lock» remediation message — never a silent partial read, never
// migrate-on-read (an old lock has no per-rule data to migrate).
// (kickoff §3 criterion 8, PARK-S1-1 → staged-A binding)

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRulesLock, RulesLockSchemaError } from './install.ts';

describe('readRulesLock — v2-aware reader (criterion 8: refuse v1 loud)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'schema-refusal-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads a v2 lock cleanly', () => {
    const path = resolve(dir, 'rules-lock.next.json');
    const v2Lock = {
      schemaVersion: 2,
      framework: 'next',
      version: '16.0.0',
      rules: [{ id: 'G1', provenance: [], tier: 2 }],
      emittedAt: '2026-01-01T00:00:00.000Z',
      sourceFingerprint: 'abcdef0123456789',
    };
    writeFileSync(path, JSON.stringify(v2Lock) + '\n');
    const lock = readRulesLock(path);
    expect(lock.schemaVersion).toBe(2);
    expect(lock.rules).toHaveLength(1);
    expect(lock.rules[0].id).toBe('G1');
  });

  it('throws RulesLockSchemaError on a v1 lock', () => {
    const path = resolve(dir, 'rules-lock.next.json');
    const v1Lock = {
      schemaVersion: 1,
      framework: 'next',
      version: '16.0.0',
      ruleIds: ['G1'],
      emittedAt: '2026-01-01T00:00:00.000Z',
      sourceFingerprint: 'abcdef0123456789',
    };
    writeFileSync(path, JSON.stringify(v1Lock) + '\n');
    expect(() => readRulesLock(path)).toThrow(RulesLockSchemaError);
  });

  it('v1 refusal message contains "regenerate the lock" remediation (criterion 8 binding)', () => {
    const path = resolve(dir, 'rules-lock.json');
    const v1Lock = {
      schemaVersion: 1,
      framework: null,
      version: null,
      ruleIds: [],
      emittedAt: '',
      sourceFingerprint: '',
    };
    writeFileSync(path, JSON.stringify(v1Lock) + '\n');
    expect(() => readRulesLock(path)).toThrow(/regenerate the lock/);
  });

  it('error names the path and the found schema version', () => {
    const path = resolve(dir, 'rules-lock.cargo.json');
    writeFileSync(
      path,
      JSON.stringify({
        schemaVersion: 1,
        framework: 'cargo',
        version: null,
        ruleIds: [],
        emittedAt: '',
        sourceFingerprint: '',
      }) + '\n',
    );
    try {
      readRulesLock(path);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RulesLockSchemaError);
      const e = err as RulesLockSchemaError;
      expect(e.found).toBe(1);
      expect(e.path).toBe(path);
      expect(e.message).toContain('version 1');
    }
  });
});
