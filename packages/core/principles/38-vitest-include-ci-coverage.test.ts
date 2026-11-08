/** P38: actual CI commands must cover every tracked workspace Vitest population.
 * Uses installed config grammar and substring filters, not mentions in YAML data.
 * Earliest carrier: recurring principles pre-push; required CI remains the backstop.
 * Prior art: SSOT #248. Empty presets are deliberately populations of zero.
 */
import { describe, it, expect } from 'vitest';
import {
  commands,
  populations,
  selected,
  workflowRegistry,
  literalArray,
  workflows,
} from './ci-test-invocations.js';

const missing = (sources = workflows()) => {
  const registry = workflowRegistry(sources);
  return populations().flatMap((p) =>
    p.files.filter((f) => !registry.calls.some((c) => selected(f, c, p))),
  );
};
const yamlRun = (command: string) =>
  `jobs:\n  test:\n    steps:\n      - run: ${JSON.stringify(command)}\n`;

describe('Principle 38 — workspace Vitest population reaches actual CI invocations', () => {
  it('(a) real-tree: every nonempty workspace population is invoked', () => {
    expect(
      missing(),
      `Unwired Vitest files; add an actual package command. Unsupported shapes: ${workflowRegistry().unsupported.join('\n')}`,
    ).toEqual([]);
  });
  it('(b) non-vacuity: tracked configs and core population cannot disappear', () => {
    const pop = populations();
    expect(pop.length).toBeGreaterThanOrEqual(5);
    expect(
      pop.find((p) => p.cwd === 'packages/core')!.files.length,
    ).toBeGreaterThan(200);
    expect(pop.flatMap((p) => p.files)).toContain(
      'packages/core/principles/38-vitest-include-ci-coverage.test.ts',
    );
    expect(
      workflowRegistry().calls.filter((c) => c.runner === 'vitest').length,
    ).toBeGreaterThan(8);
    expect(
      literalArray('export default { test: { includes: [] } }', 'include'),
    ).toBeNull();
    expect(
      literalArray('export default { test: { include: dynamic } }', 'include'),
    ).toBeNull();
    expect(
      literalArray('export default { test: { include: [] } }', 'include'),
    ).toEqual([]);
    for (const config of [
      "const decoy = {include: ['**/*.test.ts']}; export default dynamic;",
      "export default {root: '../other', test: {include: ['**/*.test.ts']}};",
      "export default {test: {include: ['**/*.test.ts'], ...dynamic}};",
    ])
      expect(literalArray(config, 'include')).toBeNull();
  });
  it('(c) runner semantics: substring, trailing slash, cwd and config stay distinct', () => {
    const p = {
      cwd: 'packages/core',
      config: 'packages/core/vitest.config.ts',
      files: [],
    };
    const call = (text: string) => commands(text, p.cwd).calls[0];
    expect(
      selected('packages/core/detector/a.test.ts', call('vitest run tor/'), p),
    ).toBe(true);
    expect(
      selected(
        'packages/core/audit-self/hooks-tree-guard.test.ts',
        call('vitest run hooks/'),
        p,
      ),
    ).toBe(false);
    expect(
      selected(
        'packages/core/audit-self/hooks-tree-guard.test.ts',
        call('vitest run hooks'),
        p,
      ),
    ).toBe(true);
    expect(
      selected(
        'packages/core/hooks/a.test.ts',
        commands('vitest run', 'packages/runtime-bridge').calls[0],
        p,
      ),
    ).toBe(false);
    expect(
      selected(
        'packages/core/hooks/a.test.ts',
        commands('npx --prefix packages/core vitest run packages/core/hooks/')
          .calls[0],
        p,
      ),
    ).toBe(true);
    expect(
      selected(
        'packages/core/audit-self/template-render.audit.ts',
        commands(
          'npx --prefix packages/core vitest run packages/core/audit-self/',
        ).calls[0],
        p,
      ),
    ).toBe(false);
    expect(
      selected(
        'packages/core/hooks/a.test.ts',
        commands('vitest run --config packages/core/vitest.config.ts').calls[0],
        p,
      ),
    ).toBe(true);
  });
  it.each([
    ['direct', 'vitest run hooks/', true],
    ['quoted env', 'env CI=1 vitest run "hooks/"', true],
    ['and list', 'true && vitest run hooks/', true],
    ['print', 'echo vitest run hooks/', false],
    ['printf', 'printf "%s" "vitest run hooks/"', false],
    ['comment', '# vitest run hooks/', false],
    ['dead', 'false && vitest run hooks/', false],
    ['heredoc', 'cat <<EOF\nvitest run hooks/\nEOF', false],
    ['misleading path', 'node tools/vitest run hooks/', false],
    ['unknown options', 'vitest run --project unknown hooks/', false],
    ['name subset', 'vitest run -t one hooks/', false],
    ['named subset', 'vitest run --testNamePattern=one hooks/', false],
    ['exclude subset', 'vitest run --exclude hooks/missing.test.ts', false],
  ])('(d) fixed actual-invocation corpus: %s', (_name, command, expected) => {
    expect(
      workflowRegistry([yamlRun(command as string)]).calls.some(
        (c) => c.runner === 'vitest',
      ),
    ).toBe(expected);
  });
  it('(e) recursive scripts resolve package cwd, passed filters and cycle bounds', () => {
    const scripts = {
      test: 'npm run nested',
      nested: 'vitest run',
      cycle: 'npm run cycle',
    };
    const result = workflowRegistry(
      [yamlRun('npm --prefix packages/runtime-bridge test -- test/')],
      () => scripts,
    );
    expect(result.calls).toEqual([
      {
        runner: 'vitest',
        cwd: 'packages/runtime-bridge',
        args: ['test/'],
        config: undefined,
      },
    ]);
    expect(
      workflowRegistry([yamlRun('npm run cycle')], () => scripts).calls,
    ).toEqual([]);
    expect(
      workflowRegistry(
        [yamlRun('npm run missing')],
        () => scripts,
      ).unsupported.join(),
    ).toContain('missing npm script');
  });
  it('(f) removal, data-only replacement and new runner populations are rejected', () => {
    for (const replacement of ['', 'echo ']) {
      const sources = workflows().map((s) =>
        s.replace(
          /run: npm --prefix packages\/core run test:skills/g,
          replacement
            ? 'run: echo npm --prefix packages/core run test:skills'
            : 'run: true',
        ),
      );
      expect(
        missing(sources).some((f) => f.startsWith('packages/core/skills/')),
      ).toBe(true);
    }
    const registry = workflowRegistry();
    const p = {
      cwd: 'packages/new-runner',
      config: 'packages/new-runner/vitest.config.ts',
      files: ['packages/new-runner/zzz-unwired.test.ts'],
    };
    expect(
      p.files.filter((f) => !registry.calls.some((c) => selected(f, c, p))),
    ).toEqual(p.files);
    expect(
      workflowRegistry([
        'jobs: {test: {steps: [{name: "vitest run", run: "true"}]}}',
      ]).calls,
    ).toEqual([]);
    expect(missing([]).length).toBeGreaterThan(200);
  });
});
