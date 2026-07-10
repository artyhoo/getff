// Shared JSON-array parser — paired negatives (MT umbrella S1, python-backend-v0).
// Always-on (no toolchain required): the parse-core is pure. Covers BOTH array-consumer shapes
// (ast-grep `ruleId` flat / ruff `code` flat) plus the empty/junk/non-array tolerances.

import { describe, expect, it } from 'vitest';
import { getByJsonPath, parseIdentitiesFromJsonArray } from './json-array-parse.ts';

describe('parseIdentitiesFromJsonArray — ast-grep `ruleId` shape', () => {
  it('collects each finding\'s ruleId from a JSON array', () => {
    const stdout = JSON.stringify([
      { ruleId: 'no-datetime-now', severity: 'error' },
      { ruleId: 'no-os-system', severity: 'error' },
    ]);
    const ids = parseIdentitiesFromJsonArray(stdout, '$.ruleId');
    expect([...ids].sort()).toEqual(['no-datetime-now', 'no-os-system']);
  });

  it('dedupes repeated ruleIds into a Set', () => {
    const stdout = JSON.stringify([
      { ruleId: 'no-datetime-now' },
      { ruleId: 'no-datetime-now' },
    ]);
    const ids = parseIdentitiesFromJsonArray(stdout, '$.ruleId');
    expect(ids.size).toBe(1);
    expect(ids.has('no-datetime-now')).toBe(true);
  });
});

describe('parseIdentitiesFromJsonArray — ruff `code` shape (S2 second consumer)', () => {
  it('collects each finding\'s code from a JSON array', () => {
    const stdout = JSON.stringify([
      { code: 'TID251', filename: 'a.py' },
      { code: 'TID253', filename: 'b.py' },
    ]);
    const ids = parseIdentitiesFromJsonArray(stdout, '$.code');
    expect([...ids].sort()).toEqual(['TID251', 'TID253']);
  });
});

describe('parseIdentitiesFromJsonArray — tolerances (empty / junk / non-array)', () => {
  it('a clean run printing "[]" yields an empty set', () => {
    expect(parseIdentitiesFromJsonArray('[]', '$.ruleId').size).toBe(0);
  });

  it('empty / whitespace-only stdout yields an empty set (never throws)', () => {
    expect(parseIdentitiesFromJsonArray('', '$.ruleId').size).toBe(0);
    expect(parseIdentitiesFromJsonArray('   \n', '$.ruleId').size).toBe(0);
  });

  it('non-JSON stdout is tolerated as no findings (never throws)', () => {
    expect(() => parseIdentitiesFromJsonArray('not json at all', '$.ruleId')).not.toThrow();
    expect(parseIdentitiesFromJsonArray('not json at all', '$.ruleId').size).toBe(0);
  });

  it('a non-array JSON value (object) yields an empty set, not a crash', () => {
    expect(parseIdentitiesFromJsonArray('{"ruleId":"x"}', '$.ruleId').size).toBe(0);
  });

  it('elements whose jsonPath resolves to null/undefined/non-string are skipped', () => {
    const stdout = JSON.stringify([
      { ruleId: null },
      { ruleId: 42 },
      { other: 'x' },
      { ruleId: 'kept' },
    ]);
    const ids = parseIdentitiesFromJsonArray(stdout, '$.ruleId');
    expect([...ids]).toEqual(['kept']);
  });
});

describe('getByJsonPath — dot-path walk', () => {
  it('walks a nested path and returns undefined on a missing hop (no throw)', () => {
    expect(getByJsonPath({ a: { b: { c: 'v' } } }, '$.a.b.c')).toBe('v');
    expect(getByJsonPath({ a: {} }, '$.a.b.c')).toBeUndefined();
    expect(getByJsonPath(null, '$.a')).toBeUndefined();
  });
});
