// rule-bootstrap-cli `--from-practice` arm — ecosystem-wiring W5 (researched-python live path).
//
// The JS live path (FileResearchClient/FileGenerateClient → generate.ts → L4 → install) is
// eslint-only: `engine:'ast-grep'` is parked in the L4 gates ("reserved but not wired —
// deferred per generator-forbid-mvp decision (i)", gate-autofix-clean.ts:116) and install()
// writes `.ai-factory/` which the python lane forbids. The SHIPPED researched-python
// generation contract is the Model A′ lane instead: an `AstgrepResearchedPractice` record →
// `researchedPracticeToNode` bridge → `renderAstgrep` (both pure, proven LG-S1 INC-1/2).
// This arm is the MINIMAL glue making that lane invokable for a CONSUMER: practice JSON →
// rendered rule YAML at `<consumer>/.getff/rules-research/<entryId>.yml`, which the
// python delivery seam (setup.d/45-python.sh) then joins into `.getff/astgrep-rules/`
// on the next install/refresh pass (see backends/astgrep researched-consumer e2e).
//
// Render runs SESSION-SIDE (node available in the research session); the consumer INSTALL
// path stays Node-free — Model A′ §Qa preserved at consumer scope.

import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { PracticeEntryIdError, runPracticeRender } from './rule-bootstrap-cli.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
/** The LG-S1 committed practice record — the realistic researched python convention (yaml.load). */
const PRACTICE_FIXTURE = resolve(
  HERE,
  '../synthesizer/fixtures/live-generation/getff-researched-no-yaml-load.practice.json',
);
/** The LG-S1 committed rendered artifact — render-parity oracle (same pure plan pipeline). */
const RENDERED_FIXTURE = resolve(
  HERE,
  '../synthesizer/fixtures/live-generation/firing/rules/getff-researched-no-yaml-load.yml',
);
const RULE_ID = 'getff-researched-no-yaml-load';

const tmpDirs: string[] = [];
function freshConsumer(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rb-practice-'));
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "scratch"\nversion = "0"\n');
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function renderedPathOf(consumer: string): string {
  return join(consumer, '.getff', 'rules-research', `${RULE_ID}.yml`);
}

describe('runPracticeRender — practice JSON → rendered rule YAML on the consumer', () => {
  it('renders the committed yaml.load practice record byte-identical to the committed artifact', () => {
    const consumer = freshConsumer();
    const result = runPracticeRender({
      consumerRoot: consumer,
      fromPractice: PRACTICE_FIXTURE,
      log: () => {},
    });

    expect(result.mode).toBe('practice-render');
    expect(result.rendered.map((r) => r.entryId)).toEqual([RULE_ID]);
    expect(result.researchOnly).toEqual([]);

    const written = renderedPathOf(consumer);
    expect(existsSync(written)).toBe(true);
    // Render parity: the SAME pure plan pipeline (bridge + renderAstgrep) the framework's
    // drift gate locks — the consumer-side render can never diverge from the committed lane.
    expect(readFileSync(written, 'utf8')).toBe(readFileSync(RENDERED_FIXTURE, 'utf8'));
  });

  it('accepts a DIRECTORY of *.practice.json records (the .getff/rules-research home)', () => {
    const consumer = freshConsumer();
    const recDir = join(consumer, '.getff', 'rules-research');
    mkdirSync(recDir, { recursive: true });
    writeFileSync(
      join(recDir, `${RULE_ID}.practice.json`),
      readFileSync(PRACTICE_FIXTURE, 'utf8'),
    );

    const result = runPracticeRender({
      consumerRoot: consumer,
      fromPractice: recDir,
      log: () => {},
    });
    expect(result.rendered.map((r) => r.entryId)).toEqual([RULE_ID]);
    expect(readFileSync(renderedPathOf(consumer), 'utf8')).toBe(
      readFileSync(RENDERED_FIXTURE, 'utf8'),
    );
  });

  it('MAJOR-1 degrade-not-inert: a non-expressible practice → research-only finding, NO file written', () => {
    const consumer = freshConsumer();
    const practice = JSON.parse(readFileSync(PRACTICE_FIXTURE, 'utf8')) as Record<string, unknown>;
    practice['entryId'] = 'getff-researched-mutable-default-arg';
    practice['kind'] = 'def'; // outside EXPRESSIBLE_KINDS — §Qb frozen-IR ceiling
    const rec = join(consumer, 'bad.practice.json');
    writeFileSync(rec, JSON.stringify(practice));

    const logged: string[] = [];
    const result = runPracticeRender({
      consumerRoot: consumer,
      fromPractice: rec,
      log: (m) => logged.push(m),
    });

    expect(result.rendered).toEqual([]);
    expect(result.researchOnly).toHaveLength(1);
    expect(result.researchOnly[0].reason).toBe('not-expressible');
    expect(existsSync(join(consumer, '.getff', 'rules-research'))).toBe(false);
    // The degrade is LOUD, never silent (mirrors withManualDrop).
    expect(logged.join('\n')).toContain('getff-researched-mutable-default-arg');
  });

  it('trust gate: a practice with non-allowlisted provenance → research-only, NO file written', () => {
    const consumer = freshConsumer();
    const practice = JSON.parse(readFileSync(PRACTICE_FIXTURE, 'utf8')) as Record<string, unknown>;
    practice['provenance'] = [
      { url: 'https://evil.example.com/docs', allowlistKey: 'pyyaml', fetchedAt: '2026-07-11T00:00:00.000Z' },
    ];
    const rec = join(consumer, 'spoofed.practice.json');
    writeFileSync(rec, JSON.stringify(practice));

    const result = runPracticeRender({
      consumerRoot: consumer,
      fromPractice: rec,
      log: () => {},
    });
    expect(result.rendered).toEqual([]);
    expect(result.researchOnly).toHaveLength(1);
    expect(result.researchOnly[0].reason).toBe('provenance-rejected');
    expect(existsSync(renderedPathOf(consumer))).toBe(false);
  });

  it('throws on a directory with zero *.practice.json (degrade+guidance handled by the CLI catch)', () => {
    const consumer = freshConsumer();
    const empty = join(consumer, 'nothing-here');
    mkdirSync(empty, { recursive: true });
    expect(() =>
      runPracticeRender({ consumerRoot: consumer, fromPractice: empty, log: () => {} }),
    ).toThrow(/practice/i);
  });
});

// ── SECURITY (W5 rework, MAJOR): entryId is consumer-authored input that becomes a FILENAME. ──────
// Before the fix, `writeFileSync(join(outDir, `${entryId}.yml`))` used the record's entryId verbatim:
// a traversal id (`../..`-segments) wrote OUTSIDE .getff/rules-research (arbitrary file write under
// the consumer root and beyond), and a crafted id could silently clobber existing files. The fix
// refuses any entryId not matching the shipped rule-id slug convention (^[a-z][a-z0-9-]*$ —
// starters `getff-no-eval`…, researched `getff-researched-no-yaml-load`) BEFORE any fs use, plus a
// belt-and-braces resolved-path containment check (ackfilepath/resolvedWithinRoot posture).
describe('entryId filesystem safety — traversal/clobber shapes REFUSED before any fs use', () => {
  function practiceWithId(entryId: string): Record<string, unknown> {
    const practice = JSON.parse(readFileSync(PRACTICE_FIXTURE, 'utf8')) as Record<string, unknown>;
    practice['entryId'] = entryId;
    return practice;
  }

  it('traversal entryId (`../../pwned`) → REFUSED loudly, NOTHING written anywhere', () => {
    const consumer = freshConsumer();
    const rec = join(consumer, 'traversal.practice.json');
    writeFileSync(rec, JSON.stringify(practiceWithId('../../pwned')));

    expect(() =>
      runPracticeRender({ consumerRoot: consumer, fromPractice: rec, log: () => {} }),
    ).toThrow(PracticeEntryIdError);
    // The traversal target (.getff/rules-research/../../pwned.yml = <consumer>/pwned.yml) must
    // NOT exist, and the output dir must not have been created either (refuse BEFORE fs use).
    expect(existsSync(join(consumer, 'pwned.yml'))).toBe(false);
    expect(existsSync(join(consumer, '.getff', 'rules-research'))).toBe(false);
  });

  it('path-separator entryId (`evil/nested`) → REFUSED (error names the entryId contract)', () => {
    const consumer = freshConsumer();
    const rec = join(consumer, 'separator.practice.json');
    writeFileSync(rec, JSON.stringify(practiceWithId('evil/nested')));

    // Asserting the MESSAGE (not just any throw): pre-fix this path died with an incidental
    // fs ENOENT — the refusal must be the deliberate entryId gate, not a filesystem accident.
    expect(() =>
      runPracticeRender({ consumerRoot: consumer, fromPractice: rec, log: () => {} }),
    ).toThrow(/entryId/);
    expect(existsSync(join(consumer, '.getff', 'rules-research'))).toBe(false);
  });

  it('valid slug entryId passes the gate unchanged (the committed convention renders)', () => {
    const consumer = freshConsumer();
    const result = runPracticeRender({
      consumerRoot: consumer,
      fromPractice: PRACTICE_FIXTURE,
      log: () => {},
    });
    expect(result.rendered.map((r) => r.entryId)).toEqual([RULE_ID]);
    expect(existsSync(renderedPathOf(consumer))).toBe(true);
  });
});

describe('rule-bootstrap-cli --from-practice — real CLI invocation', () => {
  const CLI = join(REPO_ROOT, 'packages/core/install/rule-bootstrap-cli.ts');

  it('renders + writes via the real entrypoint (exit 0, JSON summary on stdout)', { timeout: 120_000 }, () => {
    const consumer = freshConsumer();
    const r = spawnSync(
      'npx',
      ['--no-install', 'tsx', CLI, '--consumer-root', consumer, '--from-practice', PRACTICE_FIXTURE],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout) as { mode: string; rendered: { entryId: string }[] };
    expect(out.mode).toBe('practice-render');
    expect(out.rendered.map((x) => x.entryId)).toEqual([RULE_ID]);
    expect(existsSync(renderedPathOf(consumer))).toBe(true);
  });

  it('unsafe entryId → CLI exits NON-ZERO even without --strict (security refusal, not a degrade)', { timeout: 120_000 }, () => {
    const consumer = freshConsumer();
    const practice = JSON.parse(readFileSync(PRACTICE_FIXTURE, 'utf8')) as Record<string, unknown>;
    practice['entryId'] = '../../pwned';
    const rec = join(consumer, 'traversal.practice.json');
    writeFileSync(rec, JSON.stringify(practice));

    const r = spawnSync(
      'npx',
      ['--no-install', 'tsx', CLI, '--consumer-root', consumer, '--from-practice', rec],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    // The degrade contract (rc=0, never abort install) does NOT apply to an attack-shaped input:
    // an unsafe entryId is refused with a loud error and a hard non-zero exit.
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/entryId/);
    expect(existsSync(join(consumer, 'pwned.yml'))).toBe(false);
  });

  it('refuses --from-practice combined with --from-research/--from-selection (authoring error)', { timeout: 120_000 }, () => {
    const consumer = freshConsumer();
    const r = spawnSync(
      'npx',
      [
        '--no-install', 'tsx', CLI,
        '--consumer-root', consumer,
        '--from-practice', PRACTICE_FIXTURE,
        '--from-research', PRACTICE_FIXTURE,
        '--strict',
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--from-practice/);
    expect(existsSync(renderedPathOf(consumer))).toBe(false);
  });
});
