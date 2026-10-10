// m7 (one-button chain, part P5, scope D): `.ai-factory/tool-decisions.md` is shared by two writers — the
// tool-bootstrapping skill (an agent editing the file) and the installer, which writes marked blocks into it
// (`<!-- <ns>:<name>:begin/end -->`). An agent that regenerates the file from the skill's template erases them.
// The shipped skill must say «edit in place, keep each block byte-for-byte» and name every block the installer
// writes, so a block added later (P3's getff:installed-versions) turns this RED until the skill names it too.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MARKER = /<!-- ((?:aif|getff):[a-z0-9-]+):begin -->/g;

/** Every block marker the installer's code writes (install.sh and setup.d/*.sh), by name. */
function installerMarkers(): string[] {
  const files = ['install.sh', ...readdirSync(join(REPO, 'setup.d')).filter((f) => f.endsWith('.sh')).map((f) => `setup.d/${f}`)];
  const names = files.flatMap((f) => [...readFileSync(join(REPO, f), 'utf8').matchAll(MARKER)].map((m) => m[1]));
  return [...new Set(names)].sort();
}
const SKILL_FILES = ['.agents/procedures/tool-bootstrapping-consumer/SKILL.md', '.agents/procedures/tool-bootstrapping-consumer/references/decision-format.md'];
const skillText = () => SKILL_FILES.map((f) => readFileSync(join(REPO, f), 'utf8')).join('\n');

function unnamed(markers: string[], text: string): string[] {
  return markers.filter((m) => !text.includes(`<!-- ${m}:begin -->`));
}

describe('the tool-bootstrapping skill names every block the installer writes (T-D3)', () => {
  it('derives the installer blocks from its code, and the skill names each one', () => {
    const markers = installerMarkers();
    expect(markers).toEqual(expect.arrayContaining(['aif:project-checks', 'aif:r2-na'])); // never vacuous
    expect(unnamed(markers, skillText())).toEqual([]);
  });

  it('the skill says to edit in place and keep each block byte-for-byte', () => {
    const text = skillText();
    expect(text).toMatch(/byte-for-byte/);
    expect(text).toMatch(/never regenerate it from the template/);
  });

  it('a block the installer starts writing that the skill does not name is RED (paired negative)', () => {
    expect(unnamed([...installerMarkers(), 'getff:new-block'], skillText())).toEqual(['getff:new-block']);
  });
});
