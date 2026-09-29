import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

// The ONLY Cyrillic permitted in the shipped skill (excluding lang/ru.sh):
// the Class-3 bilingual deferral-detection tokens (spec §Class 3).
const ALLOWED = /выбирай сам|оба норм|я устал/;

// The Cyrillic block U+0400-U+04FF, matched by code point in Node. Locale-independent by
// construction: the former `LC_ALL=en_US.UTF-8 grep '[А-Яа-яЁё]'` fell back to BYTE ranges on
// a host without that locale (WSL: only C / C.utf8 / POSIX), and the byte range then matched
// the UTF-8 bytes of U+00D7 '×' (SKILL.md "3×") — measured 2026-09-29, red on the PC only.
const CYRILLIC = /[Ѐ-ӿ]/u;

/** `path:line:text` for every line under `root` carrying Cyrillic; `lang/` dirs are skipped. */
function cyrillicLines(root: string, base = root): string[] {
  const hits: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'lang') hits.push(...cyrillicLines(p, base));
    } else if (entry.isFile()) {
      readFileSync(p, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (CYRILLIC.test(line)) hits.push(`${relative(base, p)}:${i + 1}:${line}`);
        });
    }
  }
  return hits;
}

describe('pipeline skill is English-canonical', () => {
  it('Cyrillic over the skill (excluding lang/ru.sh) yields only allowlisted detection tokens', () => {
    const offenders = cyrillicLines(join(REPO_ROOT, '.claude/skills/pipeline')).filter(
      (l) => !ALLOWED.test(l),
    );
    expect(offenders, `Unexpected Russian prose:\n${offenders.join('\n')}`).toHaveLength(0);
  });

  it('the detector is locale-independent: non-Cyrillic UTF-8 is clean, Cyrillic is caught, lang/ is skipped', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pipeline-cyrillic-'));
    try {
      mkdirSync(join(dir, 'lang'));
      writeFileSync(
        join(dir, 'SKILL.md'),
        '| blocks-other-waves | 3× | «quoted» — dash, é, ü, ≥, →\n',
      );
      writeFileSync(join(dir, 'prose.md'), 'clean line\nсломано\n');
      writeFileSync(join(dir, 'lang', 'ru.sh'), 'msg="привет"\n');
      expect(cyrillicLines(dir)).toEqual(['prose.md:2:сломано']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
