import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(REPO_ROOT, '.claude/skills/story/helpers/emit-story-prompt.sh');

function run(lang?: string): string {
  const env = { ...process.env };
  if (lang === undefined) delete env.AIF_HOOK_LANG;
  else env.AIF_HOOK_LANG = lang;
  return execFileSync('bash', [HELPER], { env, encoding: 'utf8' });
}

describe('emit-story-prompt.sh', () => {
  // D-G (plain-words recap v2) inverted the former "by acts" / "по актам" assertions
  // ON PURPOSE: the story body is now the session-scale recap (why → what changed →
  // decided → least sure → next), so the tests assert the new marker + session sections
  // and the ABSENCE of the removed chronicle bullet. Red-first proof: both new marker
  // assertions go red against the pre-D-G pack (## 🎬 The story / ## 🎬 Как это было).
  it('default → English session-recap instruction with the P-7 🎬 marker', () => {
    const out = run(undefined);
    expect(out).toContain('## 🎬 What changed this session');
    expect(out).toContain('Why all this was');
    expect(out).toMatch(/What is different now/);
    expect(out, 'D-G removed the by-acts chronicle').not.toMatch(/by acts/i);
  });
  it('AIF_HOOK_LANG=ru → Russian session-recap instruction', () => {
    const out = run('ru');
    expect(out).toContain('## 🎬 Что изменилось за сессию');
    expect(out).toContain('Зачем всё это было');
    expect(out, 'D-G removed the «по актам» chronicle').not.toMatch(/по актам/i);
  });
  it('unknown lang → English fallback (non-empty)', () => {
    const out = run('zz');
    expect(out).toContain('## 🎬 What changed this session');
    expect(out.trim().length).toBeGreaterThan(0);
  });
});
