/** B3: fixed controls must reach the production checker and its workflow command.
 * These are bounded grammar/structure claims, not certification of prose or hook semantics.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { load } = createRequire(import.meta.url)('js-yaml');
const discipline = load(readFileSync(join(root, '.github/workflows/discipline-self-check.yml'), 'utf8'));
const audit = load(readFileSync(join(root, '.github/workflows/audit-self.yml'), 'utf8'));
const job = discipline.jobs['verify-pr-body-sections'];
const step = job.steps.find((s: { env?: { PR_BODY?: string } }) => s.env?.PR_BODY);
const husky = audit.jobs['enforce-husky-presence'];
const huskyStep = husky.steps.find((s: { run?: string }) => s.run);

function run(command: string, body = '', cwd = root) {
  return spawnSync('bash', ['-e', '-o', 'pipefail', '-c', command], {
    cwd, env: { ...process.env, PR_BODY: body }, encoding: 'utf8', timeout: 5000,
  });
}
function status(result: ReturnType<typeof run>, expected: number, diagnostic: string) {
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status, result.stdout + result.stderr).toBe(expected);
  expect(result.stdout + result.stderr).toContain(diagnostic);
}

const forward = 'packages/core/principles/01-rule-has-test.test.ts:12 checked — compliant with existing rule-has-test discipline. No forward conflicts.';
const backward = 'packages/core/hooks/checks/s17.test.ts:16 all body-prose test cases ported to vitest (Wave 10.3). Complete sweep performed.';
const sections = (f: string, b: string) => `### §1.7 Forward-check applied\n${f}\n\n### §1.7 Backward-check applied\n${b}`;
const incident = sections(
  'Checked all existing rules R1-R20 — no conflicts with the new rule. Verified principles 01-09 pass. Checked SSOT entries — no overlapping capability area. Trigger sweep complete — no armed triggers fire. Doc-authority headers compliant.',
  "Complete sweep of existing artefacts under the new rule's scope performed. All artefacts compliant. No exemptions required.",
);

describe('production discipline checker', () => {
  it('binds the required non-main PR gate, including body edits, to the shared checker', () => {
    expect(discipline.on).toEqual({ pull_request: { types: ['opened', 'edited', 'synchronize', 'reopened'] } });
    expect(job.name).toBe('§1.7 forward+backward sections present in PR description');
    expect(job.if).toBe("github.event.pull_request.base.ref != 'main'");
    expect(step.env).toEqual({ PR_BODY: '${{ github.event.pull_request.body }}' });
    expect(step.run).toBe('bash scripts/check-discipline-pr-body.sh');
    expect(job.steps.some((s: { uses?: string }) => s.uses?.startsWith('actions/checkout@'))).toBe(true);
  });

  // Literal expectations are independent of awk/grep. A success stub fails adverse cases;
  // an always-failing checker fails the positive cases. Run the actual workflow command.
  it.each([
    ['Incident-1 uncited prose', incident, 1, 'Forward-check section contains 0 file:line citations'],
    ['cited valid body', sections(forward, backward), 0, 'Backward-check cites 1'],
    ['empty body', '', 1, 'PR description is empty'],
    ['missing backward section', `### §1.7 Forward-check applied\n${forward}`, 1, 'Missing or too-short'],
    ['short forward', sections('a.ts:1', backward), 1, 'Missing or too-short'],
    ['short backward', sections(forward, 'b.ts:2'), 1, 'Missing or too-short'],
    ['distinct uncited backward', sections(forward, 'Independent review performed across existing artifacts and all applicable consumers.'), 1, 'Backward-check section contains 0 file:line citations'],
    ['malformed citation', sections(forward.replace('.ts:12', '.ts:no-line'), backward), 1, 'Forward-check section contains 0 file:line citations'],
    ['citation outside section', `evidence.ts:3\n${incident}`, 1, 'Forward-check section contains 0 file:line citations'],
    ['Skip at 60 characters', `### §1.7 Skipped:${'x'.repeat(60)}`, 0, 'Skipped marker present'],
    ['Skip with supported-size UTF-8 content', `### §1.7 Skipped:${'x'.repeat(60)}\n${'é'.repeat(58000)}`, 0, 'Skipped marker present'],
    ['Skip below 60 characters', `### §1.7 Skipped:${'x'.repeat(59)}`, 1, 'Missing or too-short'],
    ['section length exactly 40', sections(`a.ts:1${'x'.repeat(34)}`, `b.ts:2${'y'.repeat(34)}`), 0, 'Backward-check cites 1'],
    ['section length below 40', sections(`a.ts:1${'x'.repeat(33)}`, backward), 1, 'Missing or too-short'],
  ])('%s', (_name, body, expected, diagnostic) => {
    status(run(step.run, body as string), expected as number, diagnostic as string);
  });
});

describe('production husky checker', () => {
  it('has a safe manual fixture carrier in the recurring core hook suite', () => {
    const result = run('bash tests/hooks/test-enforce-husky-presence.sh');
    status(result, 0, 'PASS: husky checker fixed controls');
    // Independent path expectations prevent a fixture helper from silently changing
    // the outer hook subject while the wrapper still prints its final success line.
    expect(result.stdout.split('\n').filter((line) => line.startsWith('::error::'))).toEqual([
      expect.stringMatching(/^::error::missing .+\/missing-pre-commit\/pre-commit$/),
      expect.stringMatching(/^::error::.+\/nonexec-pre-commit\/pre-commit not executable$/),
      expect.stringMatching(/^::error::.+\/stub-pre-commit\/pre-commit lacks expected probes/),
      expect.stringMatching(/^::error::missing .+\/missing-pre-push\/pre-push$/),
      expect.stringMatching(/^::error::.+\/nonexec-pre-push\/pre-push not executable$/),
      expect.stringMatching(/^::error::.+\/stub-pre-push\/pre-push lacks expected probes/),
    ]);
  });

  it('propagates missing hooks and accepts actual checkout shapes through the workflow command', () => {
    expect(husky.name).toBe('Verify .husky/ hooks exist and are non-trivial');
    expect(husky.if).toBeUndefined();
    const fixture = mkdtempSync(join(tmpdir(), 'ci-husky-binding-'));
    try {
      mkdirSync(join(fixture, 'scripts'));
      cpSync(join(root, 'scripts/check-husky-presence.sh'), join(fixture, 'scripts/check-husky-presence.sh'));
      status(run(huskyStep.run, '', fixture), 1, 'missing .husky/pre-commit');
      expect(huskyStep.run).toBe('bash scripts/check-husky-presence.sh');
      cpSync(join(root, '.husky'), join(fixture, '.husky'), { recursive: true });
      status(run(huskyStep.run, '', fixture), 0, 'hooks present, executable, non-trivial');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
