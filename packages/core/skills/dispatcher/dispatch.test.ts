/**
 * dispatcher SKILL.md §2.1 dispatch-output tests (P6 watch-link)
 * Deterministic grep checks: §2.1 instructs emitting a watch-link with
 * config-derived host/port (not hard-coded), and §2.8 contains done.md schema.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const SKILL = resolve(REPO_ROOT, '.claude/skills/dispatcher/references/execution.md');
const skill = readFileSync(SKILL, 'utf8');
const card = readFileSync(resolve(REPO_ROOT, '.claude/skills/dispatcher/SKILL.md'), 'utf8');

it('requires the execution procedure before each loop action', () => {
  expect(card).toContain('[execution](references/execution.md)');
  expect(card).toContain('before its action');
});

function section(start: string, end: string): string {
  const a = skill.indexOf(start);
  const b = skill.indexOf(end, a + 1);
  return b > a ? skill.slice(a, b) : skill.slice(a);
}

describe('SKILL.md §2.1 — watch-link (P6)', () => {
  const s21 = section('**§2.1 —', '**§2.2 —');

  it('§2.1 mentions a watch-link URL with configurable web port', () => {
    expect(s21).toMatch(/AIF_WEB_PORT/);
  });
  it('§2.1 uses env-var host, not literal "localhost" only', () => {
    expect(s21).toMatch(/AIF_WEB_HOST/);
  });
  it('§2.1 default web port is 5180 (aif-handoff-web-1 mapping)', () => {
    expect(s21).toMatch(/5180/);
  });
  it('§2.1 notes web port is separate from API port', () => {
    expect(s21).toMatch(/AIF_PORT/);
  });
});

describe('SKILL.md §2.8 — closure marker (P2)', () => {
  const s28 = section('**§2.8 —', '---');

  it('§2.8 contains done.md schema Final PR line', () => {
    expect(s28).toMatch(/Final PR:/);
  });
  it('§2.8 contains CANON sync (cp to ~/.claude-coordination)', () => {
    expect(s28).toMatch(/claude-coordination/);
  });
  it('§2.8 covers retroactive write for ALREADY-DONE without done.md', () => {
    expect(s28).toMatch(/retroactively/i);
  });
});
