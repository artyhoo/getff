/**
 * Principle 46 — the D29 reference generator's testing seams (arms A–G)
 *
 * Source: docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md §8
 *         (the seam table, rows "Gold cards" … "Census classifier paired negative") +
 *         §4 (per-family population predicates) + G18 (gated-absence token enum) +
 *         D36 (docs/superpowers/specs/2026-09-13-getff-ai-site-design.md:163 — absence
 *         discipline: absence-by-construction = token, absence-by-omission = build failure).
 *
 * Invariant: `scripts/render-reference.mjs` is the one generator for the getff.ai reference
 * population (eleven families A–I). This principle is its CI/backstop channel (spec G9:
 * "principle test NN (§8)"), the same posture as every rule with a Class-A companion test.
 * Detection is NOT re-implemented here: population builders, the census classifier and the
 * absence-token provers live in the generator (+ its `census.mjs` module); this test asserts
 * their contracts — arms A–G of §8 — against the live repo and against synthetic fixtures.
 *
 * S0a posture (deliberate RED until the source-hole batch lands): arm B/C/D live-repo arms
 * read the sources AS THEY ARE. The hook-header, script-header, bridge-header, template
 * sidecar and package.json description holes are absence-by-omission (D36) — the generator
 * fails naming the file, and the corresponding arm here is RED naming the same file. That RED
 * is the D55 holes census asserted as a gate; the source-hole tasks (plan Tasks 5–7) are what
 * turn it green. It must NOT be skipped, loosened, or turned into a warning
 * (attention-is-not-a-mechanism.md §2).
 *
 * No paid LLM (no-paid-llm-in-ci.md): fs + regex + the generator's own deterministic modules.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const GEN = join(REPO_ROOT, 'scripts/render-reference.mjs');
const SCHEMA_DIR = join(REPO_ROOT, 'docs/site/reference/schema');
const GOLD_FIXTURES = join(HERE, 'fixtures/reference-gold');

const gen = async () => import(GEN);

const FAMILY_IDS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F1',
  'F2',
  'F3',
  'G',
  'H',
  'I',
] as const;

/** sha256 of a file — the E-family identity probe (input class 5, same function the generator uses). */
function sha256(p: string): string {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/** Every `absent`-enum member across a schema — the closed-enum backstop walks these. */
function absentEnums(
  node: unknown,
  parentKey = '',
  out: string[] = [],
): string[] {
  if (Array.isArray(node)) {
    node.forEach((x) => absentEnums(x, parentKey, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'enum' && parentKey === 'absent' && Array.isArray(v))
        out.push(...(v as string[]));
      else absentEnums(v, k, out);
    }
  }
  return out;
}

/** Parse the 15 install fingerprints into {stack, lane, hash, path} rows (input class 5). */
function fingerprintRows(root = REPO_ROOT) {
  const dir = join(root, 'tests/install-sh/baselines');
  const rows: { stack: string; lane: string; hash: string; path: string }[] =
    [];
  for (const stack of readdirSync(dir)) {
    for (const f of readdirSync(join(dir, stack))) {
      if (!f.endsWith('.fingerprint')) continue;
      const lane = f.replace(/\.fingerprint$/, '');
      for (const line of readFileSync(join(dir, stack, f), 'utf8').split(
        '\n',
      )) {
        const m = line.match(/^([0-9a-f]{64})  (.+)$/);
        if (m) rows.push({ stack, lane, hash: m[1], path: m[2] });
      }
    }
  }
  return rows;
}

/** Independent F.3 re-derivation for arm C: wired set straight from the classifier module. */
async function censusModule() {
  return import(join(REPO_ROOT, 'scripts/census.mjs'));
}

let tmpRoots: string[] = [];
function fixtureRoot(tag: string): string {
  const dir = mkdtempSync(join(tmpdir(), `p46-${tag}-`));
  tmpRoots.push(dir);
  return dir;
}

/** A minimal repo skeleton the per-family builders can run against. */
function scaffold(root: string) {
  for (const d of [
    'setup.d',
    'skills',
    'agents',
    '.claude/hooks',
    'packages/core/templates/shared',
    '.claude/rules',
    'scripts',
    'packages/runtime-bridge/src/cli',
    'plugin/hooks',
    'plugin/skills',
    'plugin/commands',
    'plugin/agents',
    'plugin/.claude-plugin',
    '.claude/skills',
    'packages/core/manifest',
    'tests/install-sh/baselines/ts-server',
  ])
    mkdirSync(join(root, d), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'r', private: true }),
  );
  writeFileSync(
    join(root, 'packages/core/manifest/rules-manifest.json'),
    JSON.stringify({
      R1: {
        title: 'T',
        stack: ['ts-server'],
        check: { type: 'command', command: 'true' },
      },
    }),
  );
  writeFileSync(
    join(root, 'plugin/hooks/hooks.json'),
    JSON.stringify({ hooks: {} }),
  );
  writeFileSync(
    join(root, 'plugin/.claude-plugin/plugin.json'),
    JSON.stringify({ version: '0.0.0' }),
  );
  writeFileSync(
    join(root, '.claude/settings.json'),
    JSON.stringify({ hooks: {} }),
  );
}

describe('Principle 46 — D29 reference generator arms (spec §8)', () => {
  it('the generator exists and exposes the arm-testable surface', async () => {
    const g = await gen();
    for (const fn of ['buildFamily', 'buildAllFamilies', 'familyDoc', 'run']) {
      expect(
        g[fn],
        `scripts/render-reference.mjs must export ${fn}`,
      ).toBeTypeOf('function');
    }
    expect(g.FAMILIES.map((f: { id: string }) => f.id).sort()).toEqual(
      [...FAMILY_IDS].sort(),
    );
    // G18 closed enum, exactly four reasons (TD2-1 struck no-profile-gate; reason #4
    // `unregistered` is the recorded schema decision in the generator's header comment —
    // the doctrine-recorded unregistered-by-default hooks, zcode-parity-doctrine.md rows 1+20):
    expect(g.ABSENCE_REASONS.sort()).toEqual([
      'no-lane',
      'no-operator-twin',
      'not-byte-copied',
      'unregistered',
    ]);
    // The enum's SSOT is ABSENCE_REASONS: every `absent` enum across every schema may narrow
    // it (D's event/matcher admit ONLY `unregistered`), never exceed it.
    for (const id of FAMILY_IDS) {
      const schema = JSON.parse(
        readFileSync(join(SCHEMA_DIR, `${id}.schema.json`), 'utf8'),
      );
      for (const reason of absentEnums(schema)) {
        expect(
          g.ABSENCE_REASONS,
          `${id}.schema.json carries absence reason "${reason}" outside the closed enum`,
        ).toContain(reason);
      }
    }
  });

  // ---- Arm A — gold cards byte-for-byte (spec §8 row 1; fixtures land at S0b, D24b) ----
  it('arm A: reproduces the S0b gold cards byte-for-byte (vacuous until the fixtures land)', async () => {
    const g = await gen();
    const hasGold =
      existsSync(GOLD_FIXTURES) && readdirSync(GOLD_FIXTURES).length > 0;
    if (!hasGold) {
      // D24b: the gold cards are hand-written in S0b AGAINST this build. The arm is
      // declared here so the fixture drop activates it with no test-file edit.
      expect
        .soft(
          hasGold,
          'arm A dormant — fixtures/reference-gold/ empty until S0b',
        )
        .toBe(false);
      return;
    }
    for (const entry of readdirSync(GOLD_FIXTURES)) {
      const fixtureRootDir = join(GOLD_FIXTURES, entry);
      const rendered = g.renderCardFence(fixtureRootDir, entry);
      const gold = readFileSync(
        join(GOLD_FIXTURES, entry, 'gold.fence'),
        'utf8',
      );
      expect(rendered).toBe(gold);
    }
  });

  // ---- Arm B — schema validation (additionalProperties:false, no empty strings) ----
  it('arm B: every family doc validates against its draft-07 schema; no empty strings', async () => {
    const g = await gen();
    const ajv = new Ajv({ allErrors: true, strict: false });
    const families = g.buildAllFamilies(REPO_ROOT);
    for (const id of FAMILY_IDS) {
      const schemaPath = join(SCHEMA_DIR, `${id}.schema.json`);
      expect(
        existsSync(schemaPath),
        `docs/site/reference/schema/${id}.schema.json must exist`,
      ).toBe(true);
      const validate = ajv.compile(
        JSON.parse(readFileSync(schemaPath, 'utf8')),
      );
      const doc = g.familyDoc(id, families[id]);
      const ok = validate(doc);
      expect(
        ok,
        `family ${id} JSON failed its schema:\n${JSON.stringify(validate.errors, null, 2)}`,
      ).toBe(true);
      // No empty strings anywhere — the «blank cell» ban (G18) below the JSON layer.
      const empties: string[] = [];
      const walk = (v: unknown, at: string) => {
        if (typeof v === 'string') {
          if (v.trim() === '') empties.push(at);
          return;
        }
        if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
        else if (v && typeof v === 'object')
          for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`);
      };
      walk(doc, id);
      expect(
        empties,
        `family ${id} carries empty-string cells: ${empties.join(', ')}`,
      ).toEqual([]);
    }
  });

  // ---- Arm C — population ↔ cards 1:1, re-derived from §4, never from the output ----
  it('arm C: per family, the §4 population predicate re-derived independently equals the member set (both directions)', async () => {
    const g = await gen();
    const families = g.buildAllFamilies(REPO_ROOT);
    const emitted = (id: string) =>
      families[id].map((m: { name: string }) => m.name).sort();

    // A — setup.d/[0-9]*.sh
    const popA = readdirSync(join(REPO_ROOT, 'setup.d'))
      .filter((f) => /^[0-9]+-.*\.sh$/.test(f))
      .sort();
    expect(emitted('A'), 'A: population ↔ members').toEqual(popA);

    // B — shipped skills ∪ operator skills, merged by name. The operator side is the TRACKED
    // set (Phase-0 decision 4.1, TD2-4: the container's untracked aif-* runtime installs are
    // not repo members — a readdir here would make the population machine-dependent); outside
    // a git repo (synthetic fixtures) it falls back to readdir.
    const opSkillDirs = (): string[] => {
      const abs = join(REPO_ROOT, '.claude/skills');
      if (existsSync(join(REPO_ROOT, '.git'))) {
        const out = execFileSync('git', ['ls-files', '.claude/skills'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
        });
        const dirs = new Set<string>();
        for (const line of out.split('\n')) {
          const parts = line.split('/');
          if (parts[0] === '.claude' && parts[1] === 'skills' && parts[2])
            dirs.add(parts[2]!);
        }
        return [...dirs]
          .filter((d) => existsSync(join(abs, d, 'SKILL.md')))
          .sort();
      }
      return readdirSync(abs).filter((d) =>
        existsSync(join(abs, d, 'SKILL.md')),
      );
    };
    const opSkills = opSkillDirs();
    const shipSkills = readdirSync(join(REPO_ROOT, 'skills')).filter((d) =>
      existsSync(join(REPO_ROOT, 'skills', d, 'SKILL.md')),
    );
    const popB = [...new Set([...opSkills, ...shipSkills])].sort();
    expect(
      emitted('B'),
      'B: population ↔ members (shipped ∪ operator, one row per name)',
    ).toEqual(popB);

    // C — agents minus the authoring-only skip-list, via the roster import (G12)
    const roster = await import(
      join(REPO_ROOT, 'scripts/render-install-roster.mjs')
    );
    const popC = roster
      .shippedAgents(REPO_ROOT)
      .map((f: string) => f.replace(/\.md$/, ''))
      .sort();
    expect(
      emitted('C'),
      'C: population ↔ members (roster-imported shipped set)',
    ).toEqual(popC);

    // D — .claude/hooks/*.sh stems ∪ plugin-only registered stems
    const hookStems = readdirSync(join(REPO_ROOT, '.claude/hooks'))
      .filter((f) => f.endsWith('.sh'))
      .map((f) => f.replace(/\.sh$/, ''));
    const hooksJson = JSON.parse(
      readFileSync(join(REPO_ROOT, 'plugin/hooks/hooks.json'), 'utf8'),
    );
    const registered = new Set<string>();
    for (const entries of Object.values(hooksJson.hooks ?? {})) {
      for (const e of entries as { hooks: { command: string }[] }[]) {
        for (const h of e.hooks) {
          const m = h.command.match(/run-hook\.cmd"\s+([a-z0-9-]+)/);
          if (m) registered.add(m[1]);
        }
      }
    }
    const popD = [...new Set([...hookStems, ...registered])].sort();
    expect(
      emitted('D'),
      'D: population ↔ members (.claude/hooks ∪ plugin-only registered)',
    ).toEqual(popD);

    // E — packages/core/templates/** (every template file, dotfiles included), MINUS the
    // sidecar manifest: templates.manifest.json is the family's description SOURCE (§5 #5),
    // not a member — the same exclusion the generator applies, so the sidecar landing in the
    // source-hole batch does not grow the population by one phantom row.
    const tpl: string[] = [];
    const walkTpl = (d: string, pre: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walkTpl(join(d, e.name), `${pre}${e.name}/`);
        else if (`${pre}${e.name}` !== 'templates.manifest.json')
          tpl.push(`${pre}${e.name}`);
      }
    };
    walkTpl(join(REPO_ROOT, 'packages/core/templates'), '');
    expect(
      emitted('E'),
      'E: population ↔ members (all 38 template files)',
    ).toEqual(tpl.sort());

    // F.1 — rules minus the generated index (the same filter render-rule-index applies)
    const ruleFiles = readdirSync(join(REPO_ROOT, '.claude/rules'))
      .filter((f) => f.endsWith('.md') && f !== '00-rule-index.md')
      .map((f) => f.replace(/\.md$/, ''));
    expect(
      emitted('F1'),
      'F.1: population ↔ members (rules minus generated index)',
    ).toEqual(ruleFiles.sort());

    // F.2 — rules-manifest.json keys
    const manifest = JSON.parse(
      readFileSync(
        join(REPO_ROOT, 'packages/core/manifest/rules-manifest.json'),
        'utf8',
      ),
    );
    expect(emitted('F2'), 'F.2: population ↔ members (manifest keys)').toEqual(
      Object.keys(manifest).sort(),
    );

    // F.3 — wired ∪ shipped-by-path, cards exclude test material; unwired listed, never carded
    const censusMod = await censusModule();
    const shippedByPath = new Set(
      fingerprintRows()
        .map((r) => r.path.split('/').pop()!)
        .filter((b) => /\.(sh|mjs)$/.test(b)),
    );
    const wired = censusMod.computeWiredSet(REPO_ROOT, [...shippedByPath]);
    const allScripts = censusMod.listScripts(REPO_ROOT);
    const popF3cards = allScripts
      .filter(
        (s: { name: string; testMaterial?: boolean }) =>
          wired.has(s.name) && !s.testMaterial,
      )
      .map((s: { name: string }) => s.name)
      .sort();
    expect(
      emitted('F3'),
      'F.3: cards == wired non-test scripts (cards, not the unwired list)',
    ).toEqual(popF3cards);
    const f3doc = g.familyDoc('F3', families.F3);
    const unwiredExpected = allScripts
      .filter(
        (s: { name: string; testMaterial?: boolean }) =>
          !wired.has(s.name) && !s.testMaterial,
      )
      .map((s: { name: string }) => s.name)
      .sort();
    expect(
      (f3doc.unwired ?? []).sort(),
      'F.3: unwired[] == non-wired non-test scripts (§11 cleanup candidates)',
    ).toEqual(unwiredExpected);

    // G — packages/*/package.json
    const popG = readdirSync(join(REPO_ROOT, 'packages'))
      .filter((d) => existsSync(join(REPO_ROOT, 'packages', d, 'package.json')))
      .sort();
    expect(
      emitted('G'),
      'G: population ↔ members (workspace packages)',
    ).toEqual(popG);

    // H — cli/*.ts minus the plumbing allowlist
    const H_ALLOW = ['aifHttp.ts', 'cliEntry.ts', 'openQuestion.ts'];
    const popH = readdirSync(join(REPO_ROOT, 'packages/runtime-bridge/src/cli'))
      .filter((f) => f.endsWith('.ts') && !H_ALLOW.includes(f))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort();
    expect(
      emitted('H'),
      'H: population ↔ members (CLI commands minus plumbing allowlist)',
    ).toEqual(popH);

    // I — plugin skills ∪ commands ∪ agents (hooks belong to D, never double-rowed)
    const popI = [
      ...readdirSync(join(REPO_ROOT, 'plugin/skills')).filter((d) =>
        existsSync(join(REPO_ROOT, 'plugin/skills', d, 'SKILL.md')),
      ),
      ...readdirSync(join(REPO_ROOT, 'plugin/commands'))
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace(/\.md$/, '')),
      ...readdirSync(join(REPO_ROOT, 'plugin/agents'))
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace(/\.md$/, '')),
    ].sort();
    expect(
      emitted('I'),
      'I: population ↔ members (plugin tree components)',
    ).toEqual(popI);

    // E: template sha256 uniqueness (G16 — a collision is an error naming both files)
    const seen = new Map<string, string>();
    for (const rel of tpl) {
      const h = sha256(join(REPO_ROOT, 'packages/core/templates', rel));
      if (seen.has(h))
        throw new Error(`template sha256 collision: ${seen.get(h)} and ${rel}`);
      seen.set(h, rel);
    }

    // Allowlisted plumbing paths exist (stale-pin visibility, §7 row 6)
    for (const p of [
      'plugin/hooks/_zcode-emit',
      'plugin/hooks/run-hook.cmd',
      'plugin/install/fetch-and-wire.sh',
      'packages/runtime-bridge/src/cli/aifHttp.ts',
      'packages/runtime-bridge/src/cli/cliEntry.ts',
      'packages/runtime-bridge/src/cli/openQuestion.ts',
    ]) {
      expect(
        existsSync(join(REPO_ROOT, p)),
        `allowlisted plumbing path must exist: ${p}`,
      ).toBe(true);
    }
  });

  it('arm C: absence tokens count per reason, printed and asserted; every token is enum-closed', async () => {
    const g = await gen();
    const families = g.buildAllFamilies(REPO_ROOT);
    const counts: Record<string, number> = {};
    const walk = (id: string, v: unknown) => {
      if (Array.isArray(v)) return v.forEach((x) => walk(id, x));
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (typeof o.absent === 'string') {
          expect(
            g.ABSENCE_REASONS,
            `family ${id}: token reason "${o.absent}" must be in the closed enum`,
          ).toContain(o.absent);
          counts[o.absent] = (counts[o.absent] ?? 0) + 1;
        }
        for (const x of Object.values(o)) walk(id, x);
      }
    };
    for (const id of FAMILY_IDS) walk(id, families[id]);
    // Print for the report (T14: the census is the measurement, per reason).
    console.log('arm C absence-token counts:', JSON.stringify(counts));
    // Both proven propositions must be live today: a byte-copy gap and a twin gap.
    expect(
      counts['not-byte-copied'],
      'E: rendered/merged templates carry not-byte-copied',
    ).toBeGreaterThan(0);
    expect(
      counts['no-operator-twin'],
      'B: shipped skills without an operator twin carry no-operator-twin',
    ).toBeGreaterThanOrEqual(0);
    // Reason #4 is live today (the doctrine-recorded unregistered hooks, D event+matcher ×2):
    expect(
      counts['unregistered'],
      'D: adopt-orchestrator-prompts + worktree-setup are deliberately unregistered',
    ).toBeGreaterThan(0);
  });

  // ---- Arm D — paired negative per family + absence-token input discriminators ----
  it('arm D: a fixture with one missing field fails naming the file; the same fixture complete passes', async () => {
    const g = await gen();
    const cases: { id: string; build: (root: string) => void }[] = [
      {
        id: 'A',
        build: (root) => {
          scaffold(root);
          writeFileSync(
            join(root, 'setup.d/10-skills.sh'),
            '#!/usr/bin/env bash\n# setup.d/10-skills.sh — copy the skill trees.\n',
          );
          writeFileSync(
            join(root, 'setup.d/20-agents.sh'),
            '#!/usr/bin/env bash\nNO HEADER HERE\n',
          );
        },
      },
      {
        id: 'B',
        build: (root) => {
          scaffold(root);
          mkdirSync(join(root, 'skills/alpha'), { recursive: true });
          writeFileSync(
            join(root, 'skills/alpha/SKILL.md'),
            '---\nname: alpha\n---\n# alpha\n',
          );
        },
      },
      {
        id: 'D',
        build: (root) => {
          scaffold(root);
          writeFileSync(
            join(root, '.claude/hooks/my-hook.sh'),
            '#!/usr/bin/env bash\n# no grammar here\n',
          );
        },
      },
      {
        id: 'E',
        build: (root) => {
          scaffold(root);
          writeFileSync(
            join(root, 'packages/core/templates/shared/x.toml'),
            'k = 1\n',
          );
          writeFileSync(
            join(root, 'packages/core/templates/templates.manifest.json'),
            JSON.stringify([
              {
                path: 'packages/core/templates/shared/OTHER.toml',
                description: 'present but for another file',
              },
            ]),
          );
        },
      },
      {
        id: 'F3',
        build: (root) => {
          scaffold(root);
          // a wired script (referenced from package.json scripts — an admitted surface)
          // without the header grammar
          writeFileSync(
            join(root, 'scripts/wired.sh'),
            '#!/usr/bin/env bash\necho hi\n',
          );
          writeFileSync(
            join(root, 'package.json'),
            JSON.stringify({
              name: 'r',
              private: true,
              scripts: { w: 'bash scripts/wired.sh' },
            }),
          );
        },
      },
      {
        id: 'G',
        build: (root) => {
          scaffold(root);
          writeFileSync(
            join(root, 'packages/core/package.json'),
            JSON.stringify({ name: '@r/core', private: true }),
          );
        },
      },
      {
        id: 'H',
        build: (root) => {
          scaffold(root);
          writeFileSync(
            join(root, 'packages/runtime-bridge/src/cli/answer.ts'),
            '/**\n * no grammar here\n */\nexport {}\n',
          );
        },
      },
    ];
    for (const c of cases) {
      const bad = fixtureRoot(`neg-${c.id}`);
      c.build(bad);
      let msg = '';
      try {
        g.buildFamily(bad, c.id);
      } catch (e) {
        msg = (e as Error).message;
      }
      expect(
        msg,
        `family ${c.id}: absence-by-omission must fail the build`,
      ).toMatch(/—|missing|header|description/);
      expect(msg.length).toBeGreaterThan(0);
      expect(msg, `family ${c.id}: the error names a file`).toMatch(
        /\.(sh|md|json|toml|ts)/,
      );
    }

    // The same fixtures WITH the field present pass.
    const good = fixtureRoot('positive');
    scaffold(good);
    writeFileSync(
      join(good, 'setup.d/10-skills.sh'),
      '#!/usr/bin/env bash\n# setup.d/10-skills.sh — copy the skill trees.\n',
    );
    mkdirSync(join(good, 'skills/alpha'), { recursive: true });
    writeFileSync(
      join(good, 'skills/alpha/SKILL.md'),
      '---\nname: alpha\ndescription: Do the alpha thing end to end.\n---\n# alpha\n@harness-posture: portable\n',
    );
    mkdirSync(join(good, '.claude/skills/alpha'), { recursive: true });
    writeFileSync(
      join(good, '.claude/skills/alpha/SKILL.md'),
      '---\nname: alpha\ndescription: Do the alpha thing end to end.\n---\n# alpha\n@harness-posture: portable\n',
    );
    // a complete hook also carries the delivery marker (spec §4 row D: `delivery` is DERIVED
    // from `@dual-pair:<anchor>` / `@cc-only-rationale` — a hook without one is
    // absence-by-omission), placed AFTER the header line per the §4 row D grammar.
    writeFileSync(
      join(good, '.claude/hooks/my-hook.sh'),
      '#!/usr/bin/env bash\n# my-hook.sh — remind the operator of the question.\n# @cc-only-rationale: test-fixture hook with no portable counterpart.\n',
    );
    // a complete hook is a REGISTERED hook (the generator fail-closes on a hook no registry
    // names — a hook nothing registers never fires): register my-hook like settings.json does.
    writeFileSync(
      join(good, '.claude/settings.json'),
      JSON.stringify({
        hooks: {
          UserPromptSubmit: [
            {
              hooks: [
                {
                  type: 'command',
                  command:
                    'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/my-hook.sh"',
                },
              ],
            },
          ],
        },
      }),
    );
    writeFileSync(
      join(good, 'packages/core/templates/shared/x.toml'),
      'k = 1\n',
    );
    writeFileSync(
      join(good, 'packages/core/templates/templates.manifest.json'),
      JSON.stringify([
        {
          path: 'packages/core/templates/shared/x.toml',
          description: 'The x config template.',
        },
      ]),
    );
    writeFileSync(
      join(good, 'scripts/wired.sh'),
      '#!/usr/bin/env bash\n# wired.sh — wire the thing on every push.\necho hi\n',
    );
    writeFileSync(
      join(good, 'package.json'),
      JSON.stringify({
        name: 'r',
        private: true,
        scripts: { w: 'bash scripts/wired.sh' },
      }),
    );
    writeFileSync(
      join(good, 'packages/core/package.json'),
      JSON.stringify({
        name: '@r/core',
        private: true,
        version: '0.0.0-fixture',
        description: 'The core package.',
      }),
    );
    writeFileSync(
      join(good, 'packages/runtime-bridge/src/cli/answer.ts'),
      '/**\n * answer.ts — answer one open question from the queue.\n */\nexport {}\n',
    );
    for (const id of ['A', 'B', 'D', 'E', 'F3', 'G', 'H'] as const) {
      expect(
        () => g.buildFamily(good, id),
        `family ${id}: the complete fixture passes`,
      ).not.toThrow();
    }
  });

  it('arm D: absence tokens are input-discriminated, not string-matched (G18/TD2-3)', async () => {
    const g = await gen();
    const make = (withFingerprintLine: boolean, withTwin: boolean) => {
      const root = fixtureRoot(`disc-${withFingerprintLine}-${withTwin}`);
      scaffold(root);
      const skill = 'skills/solo/SKILL.md';
      mkdirSync(dirname(join(root, skill)), { recursive: true });
      // posture marker present (family B's posture is a SOURCED field — §5 #7), twin flag
      // varied below is the discriminator under test, not the posture.
      writeFileSync(
        join(root, skill),
        '---\nname: solo\ndescription: A shipped skill with no operator twin.\n---\n# solo\n@harness-posture: portable\n',
      );
      if (withTwin) {
        mkdirSync(join(root, '.claude/skills/solo'), { recursive: true });
        writeFileSync(
          join(root, '.claude/skills/solo/SKILL.md'),
          '---\nname: solo\ndescription: A shipped skill with no operator twin.\n---\n# solo\n@harness-posture: portable\n',
        );
      }
      const tplRel = 'packages/core/templates/shared/solo.toml';
      writeFileSync(join(root, tplRel), 'k = 1\n');
      writeFileSync(
        join(root, 'packages/core/templates/templates.manifest.json'),
        JSON.stringify([{ path: tplRel, description: 'The solo template.' }]),
      );
      if (withFingerprintLine) {
        const h = sha256(join(root, tplRel));
        writeFileSync(
          join(
            root,
            'tests/install-sh/baselines/ts-server/greenfield.fingerprint',
          ),
          `${h}  .getff/solo.toml\n`,
        );
      }
      return root;
    };

    // E `not-byte-copied`: TRUE (no fingerprint line carries the sha) → token; input mutated
    // (a fingerprint line added) → a VALUE. The discriminator is the input, not the string.
    const noFp = g
      .buildFamily(make(false, false), 'E')
      .find((m: { name: string }) => m.name === 'shared/solo.toml');
    expect(noFp.installedTo).toEqual({ absent: 'not-byte-copied' });
    const withFp = g
      .buildFamily(make(true, false), 'E')
      .find((m: { name: string }) => m.name === 'shared/solo.toml');
    expect(withFp.installedTo).not.toHaveProperty('absent');
    expect(Array.isArray(withFp.installedTo)).toBe(true);

    // B `no-operator-twin`: TRUE (no .claude/skills/solo/SKILL.md) → token; twin created → value.
    const noTwin = g
      .buildFamily(make(false, false), 'B')
      .find((m: { name: string }) => m.name === 'solo');
    expect(noTwin.extras['operator-twin']).toEqual({
      absent: 'no-operator-twin',
    });
    const withTwin = g
      .buildFamily(make(false, true), 'B')
      .find((m: { name: string }) => m.name === 'solo');
    expect(withTwin.extras['operator-twin']).not.toHaveProperty('absent');
    expect(String(withTwin.extras['operator-twin'])).toMatch(
      /\.claude\/skills\/solo\/SKILL\.md$/,
    );

    // B/C `no-lane`: the consumer path appears in no fingerprint line → token; a fingerprint
    // line carrying the path → the stack list.
    expect(noTwin.shipsTo).toEqual({ tier: 'framework', absent: 'no-lane' });
    const lanedRoot = make(false, false);
    writeFileSync(
      join(
        lanedRoot,
        'tests/install-sh/baselines/ts-server/greenfield.fingerprint',
      ),
      `${'0'.repeat(64)}  .claude/skills/solo/SKILL.md\n`,
    );
    const laned = g
      .buildFamily(lanedRoot, 'B')
      .find((m: { name: string }) => m.name === 'solo');
    expect(laned.shipsTo).toEqual({ tier: 'framework', stacks: ['ts-server'] });

    // A hand-declared `installedTo` in the SOURCE sidecar is absence-by-omission by
    // construction (G16: the sidecar carries ONLY `description` — installed-to is DERIVED
    // from fingerprints, never declared): the generator fail-closes naming the manifest and
    // the offending key; the schema's closed absent-enum remains the backstop for anything
    // that reaches a doc some other way (asserted directly on a hand-built doc, below).
    const handTok = fixtureRoot('hand-token');
    scaffold(handTok);
    writeFileSync(
      join(handTok, 'packages/core/templates/shared/h.toml'),
      'k = 1\n',
    );
    writeFileSync(
      join(handTok, 'packages/core/templates/templates.manifest.json'),
      JSON.stringify([
        {
          path: 'packages/core/templates/shared/h.toml',
          description: 'x',
          installedTo: { absent: 'made-up-reason' },
        },
      ]),
    );
    let handMsg = '';
    try {
      g.buildFamily(handTok, 'E');
    } catch (e) {
      handMsg = (e as Error).message;
    }
    expect(
      handMsg,
      'a hand-declared installedTo must fail the build naming the manifest',
    ).toContain('templates.manifest.json');
    expect(handMsg, 'the failure names the offending key').toContain(
      'installedTo',
    );
    // schema backstop: an `absent` value outside the closed enum never validates, wherever it
    // appears (the enum lives in the schema, not in the generator's goodwill).
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(
      JSON.parse(readFileSync(join(SCHEMA_DIR, 'E.schema.json'), 'utf8')),
    );
    const badDoc = {
      schemaVersion: 1,
      family: 'E',
      familyName: 'templates',
      generator: 'scripts/render-reference.mjs',
      members: [
        {
          name: 'shared/h.toml',
          kind: 'template',
          shipsTo: { tier: 'framework' },
          description: 'x',
          source: {
            path: 'packages/core/templates/templates.manifest.json',
            line: 1,
          },
          installedTo: { absent: 'made-up-reason' },
          extras: { format: 'toml' },
          example: null,
        },
      ],
    };
    expect(
      validate(badDoc),
      'a hand-typed token must fail the schema, not pass through',
    ).toBe(false);

    // D `unregistered` (reason #4, generator header comment records the schema decision):
    // both registries silent + a delivery marker → token; the SAME file registered in
    // settings.json → the event VALUE (the discriminator is the input, not the string); the
    // same fixture minus the marker → build failure naming the file (the paired negative —
    // the marker block is the in-file record of the deliberate unregistration).
    const dMake = (registered: boolean, marker: boolean) => {
      const root = fixtureRoot(`disc-D-${registered}-${marker}`);
      scaffold(root);
      const lines = [
        '#!/usr/bin/env bash',
        '# d-hook.sh — emit the fixture session start.',
      ];
      if (marker)
        lines.push(
          '# @cc-only-rationale: fixture hook, deliberately unregistered by default.',
        );
      lines.push('');
      writeFileSync(
        join(root, '.claude/hooks/d-hook.sh'),
        `${lines.join('\n')}\n`,
      );
      if (registered) {
        writeFileSync(
          join(root, '.claude/settings.json'),
          JSON.stringify({
            hooks: {
              SessionStart: [
                {
                  hooks: [
                    {
                      type: 'command',
                      command:
                        'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/d-hook.sh"',
                    },
                  ],
                },
              ],
            },
          }),
        );
      }
      return root;
    };
    const unreg = g
      .buildFamily(dMake(false, true), 'D')
      .find((m: { name: string }) => m.name === 'd-hook');
    expect(
      unreg.extras.event,
      'an unregistered hook carries the unregistered token, not an event list',
    ).toEqual({ absent: 'unregistered' });
    expect(unreg.extras.matcher).toEqual({ absent: 'unregistered' });
    const regd = g
      .buildFamily(dMake(true, true), 'D')
      .find((m: { name: string }) => m.name === 'd-hook');
    expect(
      regd.extras.event,
      'registering the same hook flips the token back to the event value',
    ).toEqual(['SessionStart']);
    expect(regd.extras.matcher).toEqual([]);
    let dNeg = '';
    try {
      g.buildFamily(dMake(false, false), 'D');
    } catch (e) {
      dNeg = (e as Error).message;
    }
    expect(
      dNeg,
      'unregistered AND marker-less is an omission — the build fails naming the file',
    ).toContain('.claude/hooks/d-hook.sh');
    // schema backstop for the NARROW reason: D's event field admits ONLY `unregistered` —
    // a doc carrying a lane-style reason on `event` never validates.
    const dValidate = new Ajv({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(join(SCHEMA_DIR, 'D.schema.json'), 'utf8')),
    );
    const dMember = {
      name: 'd-hook',
      kind: 'hook',
      shipsTo: { tier: 'framework' },
      description: 'emit the fixture session start.',
      source: { path: '.claude/hooks/d-hook.sh', line: 2 },
      extras: {
        event: { absent: 'no-lane' },
        matcher: [],
        delivery: ['@cc-only-rationale'],
      },
      example: null,
    };
    expect(
      dValidate({
        schemaVersion: 1,
        family: 'D',
        familyName: 'hooks',
        generator: 'scripts/render-reference.mjs',
        members: [dMember],
      }),
      'a borrowed reason on extras.event must fail the D schema',
    ).toBe(false);
    expect(
      dValidate({
        schemaVersion: 1,
        family: 'D',
        familyName: 'hooks',
        generator: 'scripts/render-reference.mjs',
        members: [
          {
            ...dMember,
            extras: {
              event: { absent: 'unregistered' },
              matcher: [],
              delivery: ['@cc-only-rationale'],
            },
          },
        ],
      }),
      'the unregistered token itself validates on extras.event',
    ).toBe(true);
  });

  // ---- Arm E — F.1 parity vs the committed rule index ----
  it('arm E: reference F.1 rows are identical to the 00-rule-index.md rows', async () => {
    const g = await gen();
    const families = g.buildAllFamilies(REPO_ROOT);
    const index = readFileSync(
      join(REPO_ROOT, '.claude/rules/00-rule-index.md'),
      'utf8',
    );
    const indexRows = new Map<
      string,
      { cls: string; fires: string; channels: string }
    >();
    for (const m of index.matchAll(
      /^\| `([^`]+\.md)` \| ([ABC]) \| (.+?) \| (.+?) \|$/gm,
    )) {
      indexRows.set(m[1].replace(/\.md$/, ''), {
        cls: m[2],
        fires: m[3],
        channels: m[4],
      });
    }
    expect(
      indexRows.size,
      'the committed index must be non-empty for this arm to mean anything',
    ).toBeGreaterThan(20);
    for (const m of families.F1) {
      const row = indexRows.get(m.name);
      expect(row, `F.1 member ${m.name} must have an index row`).toBeDefined();
      expect(m.extras.class, `F.1 ${m.name} class parity`).toBe(row!.cls);
      expect(m.extras.fires, `F.1 ${m.name} fires parity`).toBe(row!.fires);
      expect(m.extras.channels, `F.1 ${m.name} channels parity`).toBe(
        row!.channels,
      );
    }
    expect(families.F1.length, 'F.1 row count parity').toBe(indexRows.size);
  });

  // ---- Arm F — wired ⇒ header backstop (escape token only on unwired/test material) ----
  it('arm F: every wired script, layer and CLI command carries its per-glob header; escapes only where allowed', async () => {
    const g = await gen();
    // The header table is the shared literal table (§7 row 6) — the same one the
    // edit-time gate reads, so the gate and the parser cannot disagree.
    expect(
      g.HEADER_TABLE,
      'the header table must be exported for the shared-gate contract',
    ).toBeTypeOf('object');

    const families = g.buildAllFamilies(REPO_ROOT);
    // Families whose description IS the header (A, D, F.3, H) are already header-gated by
    // construction: buildFamily threw if any member lacked it. So the backstop here asserts
    // the census⇒header implication directly on the live tree:
    const censusMod = await censusModule();
    const scripts = censusMod.listScripts(REPO_ROOT);
    const wired = censusMod.computeWiredSet(REPO_ROOT, []);
    const src = (name: string) =>
      readFileSync(join(REPO_ROOT, 'scripts', name), 'utf8');
    const headerOk = (name: string) => {
      const body = src(name);
      if (name.endsWith('.sh')) {
        return new RegExp(`^# ${name} — .{10,}$`, 'm').test(
          body.split('\n').slice(1, 3).join('\n'),
        );
      }
      const lines = body.split('\n');
      return (
        lines[1] === '/**' &&
        new RegExp(`^ \\* ${name.replace(/\.mjs$/, '')} — .{10,}$`).test(
          lines[2] ?? '',
        )
      );
    };
    const violations: string[] = [];
    for (const s of scripts) {
      const isWired = wired.has(s.name);
      if (s.testMaterial) continue; // test material: gated in population, no card, no header demand
      if (isWired && !headerOk(s.name))
        violations.push(`wired script lacks header: scripts/${s.name}`);
      if (!isWired && !headerOk(s.name)) {
        const escaped = src(s.name).match(/^# getff:no-card — (.+)$/m);
        if (!escaped || escaped[1].trim().length < 20) {
          violations.push(
            `unwired script lacks header AND a ≥20-char escape token: scripts/${s.name}`,
          );
        }
      }
    }
    expect(
      violations,
      'wired ⇒ header (spec §8 backstop); unwired needs the header or the escape token\n' +
        violations.join('\n'),
    ).toEqual([]);
    void families;
  });

  // ---- Arm G — census classifier paired negatives (one arm per shape + quote rule) ----
  it('arm G: comment, JSDoc-citation, message-string and multi-line-advisory references wire NOTHING', async () => {
    const censusMod = await censusModule();
    const known = new Set(['target.sh']);
    const visit = (text: string) => {
      const hits: string[] = [];
      censusMod.scanShellText(text, (n: string) => hits.push(n), known);
      return hits;
    };
    // a comment line
    expect(visit('# run scripts/target.sh to regenerate\n')).toEqual([]);
    // a one-line Fix: message string (quote opens before the path)
    expect(visit('echo "Fix: run node scripts/target.sh --write"\n')).toEqual(
      [],
    );
    // the real multi-line advisory shape (check-hook-marker.sh:174-178): the string opens at
    // the first line and the path lands on the continuation line — Q1 wires nothing. (The
    // fixture mirrors the real `*) _adv_violation "❌ …` block; a heredoc body is a DIFFERENT
    // construct and an admitted classifier cost per ref-gen §7 row 7 — the falsifier there is
    // the census diff in the same PR, not this arm.)
    expect(
      visit(
        [
          '      *) _adv_violation "❌ demo: $REL_PATH declares the gate but its PostToolUse',
          "   matcher is '$REG_MATCHER', missing tools (must include Edit, Write, AND MultiEdit",
          '   in any order — a path-only gate has no tool filter).',
          "   Fix the matcher + run 'node scripts/target.sh --write'.\" ;;",
          '',
        ].join('\n'),
      ),
    ).toEqual([]);
    // prose inside a quoted span on ONE line never wires (Q2)
    expect(
      visit('printf "%s\\n" "see scripts/target.sh for details"\n'),
    ).toEqual([]);
    // a JSDoc precedent citation in a TS surface wires nothing (comment-skip arm)
    const tsHits: string[] = [];
    censusMod.scanStructuredText(
      '// precedent: scripts/render-rule-index.mjs --write (see also scripts/target.sh)\n',
      'ts',
      (n: string) => tsHits.push(n),
      known,
    );
    expect(tsHits).toEqual([]);
  });

  it('arm G: one real execution shape per kind DOES wire — command position, verb, quoted path token, quoted assignment, import closure', async () => {
    const censusMod = await censusModule();
    const known = new Set(['target.sh', 'twin.mjs']);
    const hitsOf = (text: string) => {
      const hits: { name: string; shape: string }[] = [];
      censusMod.scanShellText(
        text,
        (n: string, l: number, s: string) => hits.push({ name: n, shape: s }),
        known,
      );
      return hits;
    };
    // invocation verb (§4 F.3 lists bash/sh/node/npx tsx/tsx/source/exec as the invocation-
    // verb shape, DISTINCT from command position — `bash scripts/x` is the verb shape).
    expect(hitsOf('bash scripts/target.sh\n')).toEqual([
      { name: 'target.sh', shape: 'invocation-verb' },
    ]);
    // invocation verb, second member of the verb set
    expect(
      hitsOf('exec scripts/target.sh --flag\n').map((h) => h.shape),
    ).toEqual(['invocation-verb']);
    // command substitution + for-in list
    expect(
      hitsOf('V="$( node scripts/target.sh )"\n').map((h) => h.shape),
    ).toEqual(['command-substitution']);
    expect(
      hitsOf('for f in scripts/target.sh; do :; done\n').map((h) => h.shape),
    ).toEqual(['for-in-list']);
    // S9/Q2: the quote opens AT the path token
    expect(
      hitsOf('run "$ROOT/scripts/target.sh"\n').map((h) => h.name),
    ).toEqual(['target.sh']);
    // The LOAD-BEARING positive (build-synth-bundle.sh:52): a quoted assignment whose value
    // is the quoted path token must wire — trimming this arm yields 30, not 31 (TD-1).
    expect(
      hitsOf('PARITY="$ROOT/scripts/target.sh"\n').map((h) => h.name),
    ).toEqual(['target.sh']);
    // spawn argument + ES import (structured surfaces)
    const ts: string[] = [];
    censusMod.scanStructuredText(
      'await run(["bash", "scripts/target.sh"]); await import("./scripts/twin.mjs");\n',
      'ts',
      (n: string, _l: number, s: string) => ts.push(`${n}:${s}`),
      known,
    );
    expect(ts).toEqual(['target.sh:spawn-argument', 'twin.mjs:es-import']);
    // package.json scripts value + workflow run: line
    const js: string[] = [];
    censusMod.scanStructuredText(
      JSON.stringify({ scripts: { w: 'bash scripts/target.sh' } }),
      'json-scripts',
      (n: string, _l: number, s: string) => js.push(`${n}:${s}`),
      known,
    );
    // (the value `bash scripts/target.sh` is a verb shape inside the json value)
    expect(js).toEqual(['target.sh:json-value:invocation-verb']);
    const ym: string[] = [];
    censusMod.scanStructuredText(
      'jobs:\n  a:\n    steps:\n      - run: bash scripts/target.sh\n',
      'yaml',
      (n: string, _l: number, s: string) => ym.push(`${n}:${s}`),
      known,
    );
    expect(ym).toEqual(['target.sh:workflow-run:invocation-verb']);
    // closure: a wired .mjs importing census.mjs-style ES-import wires the imported module
    const root = fixtureRoot('closure');
    scaffold(root);
    writeFileSync(
      join(root, 'scripts/wired.mjs'),
      '#!/usr/bin/env node\n/**\n * wired.mjs — wire the closure fixture.\n */\nimport { x } from "./census-like.mjs";\nx();\n',
    );
    writeFileSync(
      join(root, 'scripts/census-like.mjs'),
      '#!/usr/bin/env node\n/**\n * census-like.mjs — the imported module the closure must reach.\n */\nexport const x = 1;\n',
    );
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'r',
        private: true,
        scripts: { w: 'node scripts/wired.mjs' },
      }),
    );
    const wired = censusMod.computeWiredSet(root, []);
    expect(
      wired.has('wired.mjs'),
      'the entry script is wired via package.json',
    ).toBe(true);
    expect(
      wired.has('census-like.mjs'),
      'closure reaches ES-imported non-test scripts (S6)',
    ).toBe(true);
    expect(
      wired
        .get('census-like.mjs')
        ?.some((e: { via: string }) => e.via === 'closure'),
    ).toBe(true);
  });

  it('arm G: the real advisory block at check-hook-marker.sh wires render-harness-config NOTHING (live Q1 proof)', async () => {
    const censusMod = await censusModule();
    const marker = readFileSync(
      join(REPO_ROOT, '.claude/hooks/check-hook-marker.sh'),
      'utf8',
    );
    const known = new Set(
      censusMod.listScripts(REPO_ROOT).map((s: { name: string }) => s.name),
    );
    const hits: string[] = [];
    censusMod.scanShellText(marker, (n: string) => hits.push(n), known);
    expect(
      hits,
      `the advisory strings in check-hook-marker.sh must wire nothing, got: ${hits}`,
    ).not.toContain('render-harness-config.mjs');
  });

  // ---- D32 maturity manifest (plan Task 5) — the badge source every later page derives from ----
  // D32 (docs/superpowers/specs/2026-09-13-getff-ai-site-design.md:156): ONE framework-side
  // file `packages/core/manifest/maturity.json` + draft-07 schema beside it; sections `layers`
  // (D4: rules beta / factory experimental) + `stacks` (ONE row per installable positional);
  // each row = label + label definition + caveat (one sentence) + verified-at, stacks add the
  // rule-generation status (face-pages §5.1.4). T-S0A-B: a row traces to an operator decision
  // or a measurement — an unknown fact is an operator question, never a placeholder. This arm
  // is the ajv channel that "validated" claim rides on (same posture as the rules-manifest
  // consumer arms; ajv per prior-art #194).
  it('D32: maturity.json validates against its draft-07 schema; stacks = the 7 installable positionals; label↔definition is a function', () => {
    const manifestPath = join(
      REPO_ROOT,
      'packages/core/manifest/maturity.json',
    );
    const schemaPath = join(
      REPO_ROOT,
      'packages/core/manifest/maturity.schema.json',
    );
    expect(
      existsSync(manifestPath),
      'packages/core/manifest/maturity.json must exist (D32)',
    ).toBe(true);
    expect(
      existsSync(schemaPath),
      'packages/core/manifest/maturity.schema.json must exist (D32)',
    ).toBe(true);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    expect(
      schema.$schema,
      'schema must pin draft-07 (rules-manifest.schema.json precedent)',
    ).toBe('http://json-schema.org/draft-07/schema#');
    expect(
      schema.additionalProperties,
      'closed vocabulary: additionalProperties:false at top level',
    ).toBe(false);
    const doc = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    expect(
      validate(doc),
      `maturity.json failed its schema:\n${JSON.stringify(validate.errors, null, 2)}`,
    ).toBe(true);

    // The stacks population is CLOSED at the 7 installable positionals (D32 §5.1.4 — the list
    // is operator-decided, quoted verbatim; the schema also pins it via required+closed keys).
    const POSITIONALS = [
      'ts-server',
      'react-next',
      'react-spa',
      'react-native',
      'python',
      'cargo',
      'go',
    ].sort();
    expect(
      Object.keys(doc.stacks).sort(),
      'stacks must be exactly the 7 installable positionals (D32)',
    ).toEqual(POSITIONALS);
    expect(
      Object.keys(doc.layers).sort(),
      'layers must be exactly rules + factory (D4)',
    ).toEqual(['factory', 'rules']);

    // label ↔ definition is a function (one-fact-one-place): a label rendered with two
    // different «what the label means» sentences on two pages is exactly the drift D32 exists
    // to kill, so the definition must be identical in every row that shares a label.
    const defByLabel = new Map<string, string>();
    const dupes: string[] = [];
    for (const row of [
      ...Object.values(doc.layers),
      ...Object.values(doc.stacks),
    ] as Array<{ label: string; definition: string }>) {
      const seen = defByLabel.get(row.label);
      if (seen === undefined) defByLabel.set(row.label, row.definition);
      else if (seen !== row.definition) dupes.push(row.label);
    }
    expect(
      dupes,
      `labels carrying two different definitions: ${dupes.join(', ')}`,
    ).toEqual([]);
    expect(
      [...defByLabel.keys()].sort(),
      'the only renderable labels are the four operator/README-backed ones',
    ).toEqual(['alpha', 'beta', 'early', 'experimental']);

    // No empty strings anywhere — the «blank cell» ban (G18) below the JSON layer.
    const empties: string[] = [];
    const walk = (v: unknown, at: string) => {
      if (typeof v === 'string') {
        if (v.trim() === '') empties.push(at);
        return;
      }
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`);
    };
    walk(doc, 'maturity');
    expect(
      empties,
      `maturity.json carries empty-string cells: ${empties.join(', ')}`,
    ).toEqual([]);
  });

  afterAll(() => {
    for (const d of tmpRoots) rmSync(d, { recursive: true, force: true });
  });
});
