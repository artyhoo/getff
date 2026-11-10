/** P41: tracked deterministic shell/Node/Python test sources need actual CI invocation.
 * Bounded YAML + command grammar shared with P38; no arbitrary shell reachability claim.
 * The installer meta-all-wired gate remains: its disk population and audit-self-only boundary
 * differ from this tracked, all-workflow registry. SSOT prior-art #248.
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import {
  tracked,
  read,
  workflows,
  populations,
  selected,
  workflowRegistry,
  nativeCovered,
  commands,
} from './ci-test-invocations.js';

const ALLOWLIST = new Map<string, string>([
  [
    'scripts/docplan-auditor-runtime-audit.test.mjs',
    'Historical receipt replay with external native-run artifacts; S1 historical-receipt disposition, not a fresh deterministic CI suite.',
  ],
  [
    'scripts/template-audit-runtime-receipts.test.mjs',
    'Historical receipt replay with external native-run artifacts; S1 historical-receipt disposition, not a fresh deterministic CI suite.',
  ],
  [
    'tests/aif-init/runtime-output.test.mjs',
    'Historical receipt replay with external native-run artifacts; S1 historical-receipt disposition, not a fresh deterministic CI suite.',
  ],
  [
    'tests/native-entry/rule-test-author-runtime.test.py',
    'Historical receipt replay with external native-run artifacts; S1 historical-receipt disposition, not a fresh deterministic CI suite.',
  ],
  [
    'tests/reviewer-runtime-audit/receipts.test.mjs',
    'Historical receipt replay with external native-run artifacts; S1 historical-receipt disposition, not a fresh deterministic CI suite.',
  ],
  [
    'tests/runtime/fidelity-auditor-receipt.test.mjs',
    'Historical receipt replay with external native-run artifacts; S1 historical-receipt disposition, not a fresh deterministic CI suite.',
  ],
]);
export const population = () =>
  tracked().filter(
    (f) =>
      /(?:\.test\.(?:sh|[cm]?js|py)$|\/(?:test_[^/]+\.py|test-[^/]+\.sh)$)/.test(
        f,
      ) &&
      !/(^|\/)(?:fixtures?|templates?|vendor|node_modules|dist)\//.test(f) &&
      !f.startsWith('packages/getff/') &&
      !f.startsWith('docs/'),
  );

// Exactly two existing source wrappers are accepted, never arbitrary path string mentions.
// Only top-level it callbacks and their direct statements qualify: skipped/dead/function-only
// references cannot supply credit. The existing wrapper bodies remain the assertion owners.
function directCallbacks(source: string): ts.Block[] {
  const file = ts.createSourceFile(
    'wrapper.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const blocks: ts.Block[] = [];
  function statements(nodes: ts.NodeArray<ts.Statement>): void {
    for (const node of nodes) {
      if (
        !ts.isExpressionStatement(node) ||
        !ts.isCallExpression(node.expression)
      )
        continue;
      const call = node.expression;
      if (
        !ts.isIdentifier(call.expression) ||
        !['describe', 'it'].includes(call.expression.text)
      )
        continue;
      const cb = call.arguments[1];
      if (!cb || !ts.isArrowFunction(cb) || !ts.isBlock(cb.body)) continue;
      if (call.expression.text === 'it') blocks.push(cb.body);
      else statements(cb.body.statements);
    }
  }
  statements(file.statements);
  return blocks;
}
const printer = ts.createPrinter({ removeComments: true });
const compact = (node: ts.Node): string =>
  printer
    .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    .replace(/\s/g, '')
    .replace(/"/g, "'");
function wrapperTargets(sources: (path: string) => string = read): string[] {
  const registry = workflowRegistry();
  const pop = populations();
  const out: string[] = [];
  function delivered(path: string): boolean {
    return pop.some(
      (p) =>
        p.files.includes(path) &&
        registry.calls.some((c) => selected(path, c, p)),
    );
  }
  const advisor = 'packages/core/hooks/advisor-role-reminders.test.ts';
  const advisorSource = sources(advisor);
  if (
    delivered(advisor) &&
    /import\s*\{\s*spawnSync\s*\}\s*from\s*['"]node:child_process['"]/.test(
      advisorSource,
    )
  ) {
    for (const block of directCallbacks(advisorSource)) {
      const body = block.statements.map(compact);
      // This one carrier has exactly three direct statements. Accept that ordered
      // sequence only; returns, throws, conditionals or extra calls are unsupported,
      // even when the required spellings remain elsewhere in the callback.
      if (block.statements.length !== 3) continue;
      const declarationStatement = block.statements[1];
      if (
        !ts.isVariableStatement(declarationStatement) ||
        declarationStatement.declarationList.flags !== ts.NodeFlags.Const ||
        declarationStatement.declarationList.declarations.length !== 1
      )
        continue;
      const declaration = declarationStatement.declarationList.declarations[0];
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'run')
        continue;
      const spawn = declaration?.initializer;
      const options =
        spawn && ts.isCallExpression(spawn) ? spawn.arguments[2] : undefined;
      const args =
        spawn && ts.isCallExpression(spawn) ? spawn.arguments[1] : undefined;
      const child =
        spawn && ts.isCallExpression(spawn) ? spawn.arguments[0] : undefined;
      const cwd =
        options && ts.isObjectLiteralExpression(options)
          ? options.properties.find(
              (p) => ts.isPropertyAssignment(p) && p.name.getText() === 'cwd',
            )
          : undefined;
      if (
        body[0] ===
          "constroot=fileURLToPath(newURL('../../../',import.meta.url));" &&
        spawn &&
        ts.isCallExpression(spawn) &&
        spawn.expression.getText() === 'spawnSync' &&
        child &&
        ts.isStringLiteral(child) &&
        child.text === 'python3' &&
        args &&
        ts.isArrayLiteralExpression(args) &&
        args.elements.every(ts.isStringLiteral) &&
        JSON.stringify(
          args.elements.map((a) => (a as ts.StringLiteral).text),
        ) ===
          JSON.stringify([
            '-B',
            '-m',
            'unittest',
            'discover',
            '-s',
            'tests/advisor-role-reminders',
            '-v',
          ]) &&
        cwd &&
        ts.isPropertyAssignment(cwd) &&
        cwd.initializer.getText() === 'root' &&
        body[2] === 'expect(run.status,run.stderr).toBe(0);'
      )
        out.push('tests/advisor-role-reminders/test_reminders.py');
    }
  }
  const husky = 'packages/core/hooks/ci-checker-oracles.test.ts';
  const huskySource = sources(husky);
  const ast = ts.createSourceFile(
    'husky.ts',
    huskySource,
    ts.ScriptTarget.Latest,
    true,
  );
  const run = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'run',
  ) as ts.FunctionDeclaration | undefined;
  const spawn = run?.body?.statements[0];
  if (
    delivered(husky) &&
    spawn &&
    ts.isReturnStatement(spawn) &&
    compact(spawn).startsWith(
      "returnspawnSync('bash',['-e','-o','pipefail','-c',command],{cwd,env:",
    ) &&
    directCallbacks(huskySource).some((block) => {
      const body = block.statements.map(compact);
      // The supported call and status assertion must be the first live statements.
      // Later independent diagnostic assertions remain owned by the wrapper.
      return (
        body[0] ===
          "constresult=run('bashtests/hooks/test-enforce-husky-presence.sh');" &&
        body[1] === "status(result,0,'PASS:huskycheckerfixedcontrols');"
      );
    })
  )
    out.push('tests/hooks/test-enforce-husky-presence.sh');
  return out;
}
const missing = (sources = workflows()) => {
  const registry = workflowRegistry(sources);
  const wrappers = sources.length ? wrapperTargets() : [];
  return population().filter(
    (f) =>
      !nativeCovered(f, registry.calls) &&
      !wrappers.includes(f) &&
      !ALLOWLIST.has(f),
  );
};
const yamlRun = (command: string) =>
  `jobs:\n  test:\n    steps:\n      - run: ${JSON.stringify(command)}\n`;
const hygiene = (map: Map<string, string>) =>
  [...map].filter(
    ([f, why]) => !population().includes(f) || why.trim().length < 20,
  );

describe('Principle 41 — native source suites reach actual CI invocations', () => {
  it('(a) real-tree: no tracked native source test is uninvoked', () => {
    expect(
      missing(),
      `Missing native invocation. Wire or explicitly justify; unsupported commands: ${workflowRegistry().unsupported.join('\n')}`,
    ).toEqual([]);
  });
  it('(b) non-vacuity: source and invocation populations stay real', () => {
    expect(
      population().filter((f) => f.endsWith('.test.sh')).length,
    ).toBeGreaterThan(50);
    expect(population()).toContain(
      '.agents/roles/dual-channel-drift-auditor/test_overlap.py',
    );
    expect(workflowRegistry().calls.length).toBeGreaterThan(100);
    expect(missing([]).length).toBeGreaterThan(50);
  });
  it.each([
    ['direct', 'bash tests/a.test.sh', true],
    ['quoted', 'bash "./tests/a.test.sh"', true],
    ['env', 'env CI=1 bash tests/a.test.sh', true],
    ['and', 'true && bash tests/a.test.sh', true],
    ['cwd', 'cd tests && bash a.test.sh', true],
    ['echo', 'echo bash tests/a.test.sh', false],
    ['printf', 'printf "%s" "bash tests/a.test.sh"', false],
    ['comment', '# bash tests/a.test.sh', false],
    ['dead', 'false && bash tests/a.test.sh', false],
    ['heredoc', 'cat <<EOF\nbash tests/a.test.sh\nEOF', false],
    ['misleading', 'bash tests/a.test.sh.backup', false],
    ['shell glob is not a battery', 'bash tests/*.test.sh', false],
    ['wrong runner', 'node --test tests/a.test.sh', false],
    [
      'Node restricted suite',
      'node --test --test-name-pattern=one tests/a.test.mjs',
      false,
    ],
    ['negated', '! true && bash tests/a.test.sh', false],
    ['function body', 'f() {\nbash tests/a.test.sh\n}', false],
    ['outside cwd', 'cd /not-the-repository && bash tests/a.test.sh', false],
    ['dynamic cwd', 'cd "$OTHER" && bash tests/a.test.sh', false],
    ['unknown', 'if false; then bash tests/a.test.sh; fi', false],
  ])('(c) fixed command corpus: %s', (_name, command, expected) => {
    expect(
      nativeCovered(
        'tests/a.test.mjs',
        commands('node --test --test-name-pattern=one tests/a.test.mjs').calls,
      ),
    ).toBe(false);
    expect(
      nativeCovered(
        'tests/a.test.mjs',
        commands('node --test tests/a.test.mjs').calls,
      ),
    ).toBe(true);
    expect(
      nativeCovered(
        'tests/a.test.sh',
        workflowRegistry([yamlRun(command as string)]).calls,
      ),
    ).toBe(expected);
  });
  it('(d) data and disabled steps do not register execution', () => {
    for (const source of [
      'jobs: {test: {steps: [{name: "bash tests/a.test.sh", run: "true"}]}}',
      'jobs: {test: {steps: [{if: false, run: "bash tests/a.test.sh"}]}}',
      'jobs: {test: {steps: [{if: "unknown()", run: "bash tests/a.test.sh"}]}}',
      'jobs: {test: {if: "${{ false }}", steps: [{run: "bash tests/a.test.sh"}]}}',
    ])
      expect(
        nativeCovered('tests/a.test.sh', workflowRegistry([source]).calls),
      ).toBe(false);
    expect(
      nativeCovered(
        'tests/a.test.sh',
        commands('node --test tests/a.test.sh.backup').calls,
      ),
    ).toBe(false);
  });
  it('(e) actual nested package scripts, Node globs and missing targets are resolved', () => {
    const result = workflowRegistry([
      yamlRun('npm --prefix packages/core run test:canonical'),
    ]);
    expect(
      nativeCovered('scripts/canonical-native.test.mjs', result.calls),
    ).toBe(true);
    expect(
      nativeCovered('scripts/docs-author-runtime.test.mjs', result.calls),
    ).toBe(true);
    expect(
      nativeCovered(
        'scripts/dot-relay/cli.test.mjs',
        commands('node --test scripts/dot-relay/*.test.mjs').calls,
      ),
    ).toBe(true);
    expect(nativeCovered('tests/new-unwired.test.py', result.calls)).toBe(
      false,
    );
    expect(
      workflowRegistry([yamlRun('npm run missing')], () => ({})).calls,
    ).toEqual([]);
  });
  it('(I2) Node test options must precede the script or test operands', () => {
    const target = 'scripts/codex-hook-compatibility.test.mjs';
    for (const command of [
      `node /dev/null --test ${target}`,
      `node scripts/noop.mjs --test ${target}`,
      `node --experimental-strip-types scripts/noop.mjs --test ${target}`,
    ]) {
      const registry = commands(command);
      expect(nativeCovered(target, registry.calls), command).toBe(false);
      expect(registry.unsupported.join(), command).toContain(
        'Node option position',
      );
    }
    for (const command of [
      `node --test ${target} scripts/pipeline-saved-coordination.test.mjs`,
      `node --experimental-strip-types --test ${target}`,
    ])
      expect(nativeCovered(target, commands(command).calls), command).toBe(
        true,
      );
  });
  it('(I3) advisor requires the ordered direct spawn and assertion without control flow', () => {
    const path = 'packages/core/hooks/advisor-role-reminders.test.ts';
    const target = 'tests/advisor-role-reminders/test_reminders.py';
    const source = read(path);
    for (const mutation of [
      (s: string) => s.replace('const root =', 'return; const root ='),
      (s: string) => s.replace('const run =', 'return; const run ='),
      (s: string) =>
        s.replace('expect(run.status', 'return; expect(run.status'),
      (s: string) => s.replace('const run =', 'if (true) return; const run ='),
      (s: string) =>
        s.replace('const run =', 'throw new Error("stopped"); const run ='),
    ])
      expect(
        wrapperTargets((p) => (p === path ? mutation(source) : read(p))),
      ).not.toContain(target);
    const commented = source.replace(
      'const run =',
      '// literal straight-line companion\n    const run =',
    );
    expect(wrapperTargets((p) => (p === path ? commented : read(p)))).toContain(
      target,
    );
  });
  it('(f) wrappers require a live callback, real spawn and status assertion', () => {
    expect(wrapperTargets()).toEqual([
      'tests/advisor-role-reminders/test_reminders.py',
      'tests/hooks/test-enforce-husky-presence.sh',
    ]);
    for (const mutation of [
      (s: string) => s.replace('spawnSync(', 'fakeSpawn('),
      (s: string) => s.replace("it('", "it.skip('"),
      (s: string) => s.replace('expect(run.status, run.stderr).toBe(0);', ''),
    ]) {
      expect(
        wrapperTargets((path) =>
          path.includes('advisor-role') ? mutation(read(path)) : read(path),
        ),
      ).not.toContain('tests/advisor-role-reminders/test_reminders.py');
    }
  });
  it.each([
    ['return before invocation', 'return;', 'const result ='],
    [
      'throw before invocation',
      'throw new Error("stopped");',
      'const result =',
    ],
    ['conditional before invocation', 'if (true) return;', 'const result ='],
    [
      'return before status',
      'return;',
      "status(result, 0, 'PASS: husky checker fixed controls');",
    ],
    [
      'conditional before status',
      'if (true) return;',
      "status(result, 0, 'PASS: husky checker fixed controls');",
    ],
  ])('(I1) husky wrapper rejects %s', (_name, interruption, boundary) => {
    const path = 'packages/core/hooks/ci-checker-oracles.test.ts';
    const source = read(path);
    const fault = source.replace(boundary, `${interruption}\n    ${boundary}`);
    expect(fault).not.toBe(source);
    expect(wrapperTargets((p) => (p === path ? fault : read(p)))).not.toContain(
      'tests/hooks/test-enforce-husky-presence.sh',
    );
  });
  it.each(['unchanged', 'comment-only'])(
    '(I1) husky wrapper accepts %s live companion',
    (kind) => {
      const path = 'packages/core/hooks/ci-checker-oracles.test.ts';
      const source = read(path);
      const companion =
        kind === 'unchanged'
          ? source
          : source.replace(
              'const result =',
              '// The fixed controls still run before their independent diagnostic assertion.\n    const result =',
            );
      expect(
        wrapperTargets((p) => (p === path ? companion : read(p))),
      ).toContain('tests/hooks/test-enforce-husky-presence.sh');
    },
  );
  it('(g) exemption hygiene remains live with an empty map', () => {
    expect(hygiene(ALLOWLIST)).toEqual([]);
    expect(
      hygiene(
        new Map([
          ['tests/not-real.test.sh', 'a sufficiently detailed rationale'],
          [population()[0], 'short'],
        ]),
      ),
    ).toHaveLength(2);
  });
});
