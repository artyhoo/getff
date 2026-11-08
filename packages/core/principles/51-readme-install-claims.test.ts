/** Principle 51: README install claims must track the installer.
 * Authoritative for: checkable README claims and pin rationales. NOT authoritative for:
 * project goal (README.md#why-this-exists). Defect: installer rosters and README drifted.
 * Channel: principle suite. Limit: counts without a nearby noun are not detected by arm E.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkClaim, uncheckedCounts, checkPins } from './51-readme-install-claims';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const roster = await import(join(root, 'scripts/render-install-roster.mjs'));
const tiers = await import(join(root, 'scripts/lib/skill-tiers.mjs'));
const agents: string[] = roster.shippedAgents(root).map((x: string) => x.replace(/\.md$/, ''));
const factory: string[] = [...roster.factoryGatedAgents(root)].map((x: string) => x.replace(/\.md$/, ''));
const skills = roster.shippedSkills(root);
const expected = { A: agents, B: factory, C: [...skills.core, ...skills.envContour], D: tiers.readSkillTiers(root).factory };
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const pins = readFileSync(join(root, 'setup.d/70-deps.sh'), 'utf8');
const form = (arm: keyof typeof expected, names = expected[arm], count = names.length) => {
  const list = names.map(x => `\`${x}\``).join(arm === 'B' ? ' + ' : ', ');
  return ({ A: `${count} shipped by default: ${list}`, B: `${count} more agents ship only under \`--profile factory\`: ${list}`, C: `${count} skills at the default \`env\` profile: ${list}`, D: `\`--profile factory\` adds ${count} more skills: ${list}` })[arm];
};

describe('README claims', () => {
  for (const arm of ['A', 'B', 'C', 'D'] as const) {
    it(`${arm}: live claim`, () => expect(checkClaim(arm, readme, expected[arm])).toEqual([]));
    it(`${arm}: accepts exact set and rejects count, duplicates, missing and extra`, () => {
      expect(checkClaim(arm, form(arm), expected[arm])).toEqual([]);
      expect(checkClaim(arm, form(arm, expected[arm], expected[arm].length + 1), expected[arm])).not.toEqual([]);
      expect(checkClaim(arm, form(arm, [...expected[arm], expected[arm][0]]), expected[arm])).not.toEqual([]);
      expect(checkClaim(arm, form(arm, expected[arm].slice(1)), expected[arm]).join(' ')).toContain(expected[arm][0]);
      expect(checkClaim(arm, form(arm, [...expected[arm], 'nonexistent-agent']), expected[arm]).join(' ')).toContain('nonexistent-agent');
      expect(checkClaim(arm, `${form(arm)}\n${form(arm)}`, expected[arm])).not.toEqual([]);
    });
  }
  it('A: missing docs-form-auditor is named', () => expect(checkClaim('A', form('A', agents.filter(x => x !== 'docs-form-auditor')), agents).join(' ')).toContain('docs-form-auditor'));
  it('B: factory flag required', () => expect(checkClaim('B', form('B').replace('`--profile factory`', '`--all`'), factory)).not.toEqual([]));
  it('C: old singular skill claim is absent', () => expect(checkClaim('C', '1. **A skill**', expected.C).join(' ')).toContain('claim not found'));
  it('E: detects unchecked counts within a line only', () => {
    for (const line of ['the remaining 6 agents cover', 'skips seven authoring-only agents', '11 agents']) expect(uncheckedCounts(line)).not.toEqual([]);
    for (const line of ['(`setup.d/20-agents.sh` skips authoring-only agents)', '(C-1 follow-up, SSOT #50): `aif-review/SKILL.md` injects', '2026-05-20).\n**skill-context**']) expect(uncheckedCounts(line)).toEqual([]);
  });
  it('E: live items contain no unchecked counts', () => expect(uncheckedCounts(readme, true)).toEqual([]));
  it('F: live pins have uncontaminated reasons', () => expect(checkPins(pins)).toEqual([]));
  it('F: rejects malformed blocks and contamination, accepts safe reasons', () => {
    const block = (s: string) => `CORE_DEVDEPS=(\n${s}\n)`;
    expect(checkPins(block('eslint@^9 # why: maintains supported peer compatibility'))).toEqual([]);
    for (const value of ['', block(''), block('a@^1 # why: long enough explanation\n') + '\n' + block('b@^1 # why: long enough explanation'), block('a@^1 b@^1 # why: long enough explanation'), block('a@^1 # why: tbd'), block('a@^1 # why: references vitest@^4 as a dependency'), block('# helper.js is used here\na@^1 # why: long enough explanation'), block('# .helper.mjs, supplies the check\na@^1 # why: long enough explanation'), block('# use `vitest@^4` here\na@^1 # why: long enough explanation'), block('# vitest@^4 is a package\na@^1 # why: long enough explanation')]) expect(checkPins(value)).not.toEqual([]);
  });
});

describe('shared installer roster readers', () => {
  it('prefers canonical roles, falls back to legacy, and rejects an absent factory pair', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'p51-roster-'));
    try {
      mkdirSync(join(dir, 'setup.d')); mkdirSync(join(dir, 'agents'));
      writeFileSync(join(dir, 'agents', 'legacy.md'), '');
      const script = '  skip.md) continue ;;\n  first.md|second.md)\n';
      writeFileSync(join(dir, 'setup.d/20-agents.sh'), script);
      expect(roster.shippedAgents(dir)).toEqual(['legacy.md']);
      mkdirSync(join(dir, '.agents/roles'), { recursive: true });
      writeFileSync(join(dir, '.agents/roles/canonical.md'), '');
      expect(roster.shippedAgents(dir)).toEqual(['canonical.md']);
      expect([...roster.factoryGatedAgents(dir)]).toEqual(['first.md', 'second.md']);
      writeFileSync(join(dir, 'setup.d/20-agents.sh'), '  skip.md) continue ;;\n');
      expect(() => roster.factoryGatedAgents(dir)).toThrow();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('recognizes current procedure and historical literal skill copies', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'p51-skills-'));
    try {
      mkdirSync(join(dir, 'setup.d'));
      writeFileSync(join(dir, 'setup.d/lib.sh'), 'GETFF_SKILLS_CORE="core"\nGETFF_SKILLS_ENV="env"\nGETFF_SKILLS_FACTORY="factory"\n');
      writeFileSync(join(dir, 'setup.d/10-skills.sh'), '_copy_tree_with_transform "$(procedure_source getff)" "$dst"\ncp -r "$PKG_ROOT/skills/tool-bootstrapping" "$dst"\n');
      expect(roster.shippedSkills(dir)).toEqual({ core: ['core', 'getff', 'tool-bootstrapping'], envContour: ['env'] });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('reviewed bypass regressions', () => {
  for (const arm of ['A', 'B', 'C', 'D'] as const) {
    it(`${arm}: rejects a noncanonical list continuation`, () => {
      expect(checkClaim(arm, `${form(arm)},  \`unlisted\``, expected[arm])).not.toEqual([]);
    });
  }
  it('F: rejects an additional one-line active assignment', () => {
    expect(checkPins('CORE_DEVDEPS=(\n  a@^1 # why: long enough explanation\n)\nCORE_DEVDEPS=(b@^1)\n')).not.toEqual([]);
  });
  it('F: rejects an additional indented assignment', () => {
    expect(checkPins('CORE_DEVDEPS=(\n  a@^1 # why: long enough explanation\n)\n  CORE_DEVDEPS=(b@^1)\n')).not.toEqual([]);
  });
  it('F: requires whitespace before the shell comment marker', () => {
    expect(checkPins('CORE_DEVDEPS=(\n  a@^1# why: long enough explanation\n)\n')).not.toEqual([]);
  });
  it('ignores commented-out base copy calls', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'p51-commented-'));
    try {
      mkdirSync(join(dir, 'setup.d'));
      writeFileSync(join(dir, 'setup.d/lib.sh'), 'GETFF_SKILLS_CORE="core"\nGETFF_SKILLS_ENV="env"\nGETFF_SKILLS_FACTORY="factory"\n');
      writeFileSync(join(dir, 'setup.d/10-skills.sh'), '# cp -r "$PKG_ROOT/skills/fake-literal" "$dst"\n# _copy_tree_with_transform "$(procedure_source fake-procedure)" "$dst"\n_copy_tree_with_transform "$(procedure_source getff)" "$dst"\n');
      expect(roster.shippedSkills(dir).core).toEqual(['core', 'getff']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('falls back when the canonical roles path is a file', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'p51-nondir-'));
    try {
      mkdirSync(join(dir, 'setup.d')); mkdirSync(join(dir, 'agents')); mkdirSync(join(dir, '.agents'));
      writeFileSync(join(dir, '.agents/roles'), 'not a directory');
      writeFileSync(join(dir, 'agents/legacy.md'), '');
      writeFileSync(join(dir, 'setup.d/20-agents.sh'), '  skip.md) continue ;;\n  first.md|second.md)\n');
      expect(roster.shippedAgents(dir)).toEqual(['legacy.md']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('extractor and list continuation parity', () => {
  it('rejects a sole indented block opener', () => {
    expect(checkPins('  CORE_DEVDEPS=(\n  a@^1 # why: long enough explanation\n)\n')).not.toEqual([]);
  });
  it('rejects a sole indented block closer', () => {
    expect(checkPins('CORE_DEVDEPS=(\n  a@^1 # why: long enough explanation\n  )\n')).not.toEqual([]);
  });
  for (const arm of ['A', 'B', 'C', 'D'] as const) {
    it(`${arm}: rejects a non-slug list continuation`, () => {
      expect(checkClaim(arm, `${form(arm)}, \`ghost_skill\``, expected[arm])).not.toEqual([]);
    });
  }
});

describe('active array and factory option bypasses', () => {
  const canonical = 'CORE_DEVDEPS=(\n  a@^1 # why: long enough explanation\n)\n';
  it('rejects an appended active array assignment', () => {
    expect(checkPins(canonical + 'CORE_DEVDEPS+=(bad@^1)\n')).not.toEqual([]);
  });
  it('rejects a declared active array assignment', () => {
    expect(checkPins(canonical + 'declare -a CORE_DEVDEPS=(bad@^1)\n')).not.toEqual([]);
  });
  it('rejects a different factory option value', () => {
    expect(checkClaim('B', form('B').replace('factory`', 'factory-reset`'), factory)).not.toEqual([]);
  });
});

describe('Arm F structural shell boundaries', () => {
  const canonical = 'CORE_DEVDEPS=(\n  a@^1 # why: long enough explanation\n)\n';
  it('rejects a second assignment behind an arbitrary declaration command', () => {
    expect(checkPins(canonical + 'typeset -a CORE_DEVDEPS=(bad@^1)\n')).not.toEqual([]);
  });
  it('rejects an indexed assignment to the array', () => {
    expect(checkPins(canonical + 'CORE_DEVDEPS[0]=bad@^1\n')).not.toEqual([]);
  });
  it('rejects an assignment after an escaped pseudo-comment', () => {
    expect(checkPins(canonical + String.raw`echo\ #; CORE_DEVDEPS=(bad@^1)` + '\n')).not.toEqual([]);
  });
  it('rejects an assignment after a quoted hash', () => {
    expect(checkPins(canonical + 'echo "text # still quoted"; CORE_DEVDEPS=(bad@^1)\n')).not.toEqual([]);
  });
  it('rejects an assignment literal in an inline shell comment', () => {
    expect(checkPins(canonical + 'echo done # CORE_DEVDEPS=(bad@^1)\n')).not.toEqual([]);
  });
  it('rejects a closing parenthesis joined to another shell word', () => {
    expect(checkPins(canonical.replace(')\n', ')garbage\n'))).not.toEqual([]);
  });
  it('rejects escaped whitespace before the apparent comment', () => {
    expect(checkPins(String.raw`CORE_DEVDEPS=(
  a@^1\ # why: long enough explanation
)
`)).not.toEqual([]);
  });
  it('accepts the live block and ordinary rationale comments', () => {
    expect(checkPins(pins)).toEqual([]);
    expect(checkPins('# an explanatory note without an assignment\n' + canonical + '# another plain note\n')).toEqual([]);
  });
  it('rejects assignment literals in commented examples', () => {
    expect(checkPins('# typeset -a CORE_DEVDEPS=(bad@^1)\n' + canonical)).not.toEqual([]);
    expect(checkPins(canonical + '# CORE_DEVDEPS+=(bad@^1)\n')).not.toEqual([]);
  });
  it('rejects consecutive assignment literals in one word', () => {
    expect(checkPins(canonical + '# CORE_DEVDEPS=CORE_DEVDEPS=example\n')).not.toEqual([]);
  });
  it('rejects a literal assignment following a multiline quoted hash', () => {
    expect(checkPins(canonical + 'printf "%s" "line one\n#"; CORE_DEVDEPS=(bad@^1)\n')).not.toEqual([]);
  });
  for (const spec of ['a@v1.2.3', 'a@=1.2.3']) {
    it(`accepts shell-safe version spelling ${spec}`, () => {
      expect(checkPins(`CORE_DEVDEPS=(\n  ${spec} # why: long enough explanation\n)\n`)).toEqual([]);
    });
  }
});

describe('Arm F indexed source convention', () => {
  const canonical = 'CORE_DEVDEPS=(\n  a@^1 # why: long enough explanation\n)\n';
  for (const statement of [
    'CORE_DEVDEPS[indices[0]]=bad@^1',
    'CORE_DEVDEPS[levels[a[b[0]]]]=bad@^1',
    'CORE_DEVDEPS[indices[\n0]]=bad@^1',
    '${CORE_DEVDEPS[1]:=bad@^1}',
    '${CORE_DEVDEPS[@]:=bad@^1}',
  ]) {
    it(`rejects nested indexed assignment: ${statement}`, () => {
      expect(checkPins(canonical + statement + '\n')).not.toEqual([]);
    });
  }
  it('accepts the installer read expansions and the live block', () => {
    expect(checkPins(canonical + 'DEVDEPS=( "${CORE_DEVDEPS[@]}" )\nfor spec in "${CORE_DEVDEPS[@]}"; do :; done\n')).toEqual([]);
    expect(checkPins(pins)).toEqual([]);
  });
});
