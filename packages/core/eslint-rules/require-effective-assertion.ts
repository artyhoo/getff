import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

// Q2 of the S1 test-assurance kernel (spec: docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md §5).
// A test body with no assertion — comment-only, empty, console-only, an `await` with
// no expectation — exercises code but verifies nothing: it is green by construction.
//
// SCOPE CONSTRAINT (decidable syntax only — the declared scope frozen in
// scripts/test-assurance/expectations.json `rules.require-effective-assertion.declared_scope`):
//   - fires on `it`/`test`/`specify` callbacks (non-skipped variants) whose body contains
//     NO call whose callee name starts with `expect` / `assert` / `verify`
//     (`expect`, `expectTypeOf`, `assertParsedShape`, `verifySealed`, …);
//   - `await`ing a promise is NOT effective — only a recognized assertion-name call is;
//   - skipped variants (`.skip` / `.skipIf` / `.todo` / `.fails`) are exempt, as are tests
//     with no callback argument;
//   - nested test callbacks are judged separately (an inner `it`'s assertion does not
//     excuse the outer body);
//   - honours the per-line `// audit:exempt` suppression convention on the `it(...)` line.
// It makes NO claim that a recognized name asserts substantively — an empty `assert*`
// helper is a semantic question routed to the named cold-review protocol.

function isExempt(line: string): boolean {
  return line.includes('// audit:exempt');
}

const TEST_NAMES = new Set(['it', 'test', 'specify']);
const EXEMPT_VARIANTS = new Set(['skip', 'skipIf', 'todo', 'fails']);

/** `it` / `test` / `specify` call metadata: base name + the variant property (`.skip` etc.). */
function testCallInfo(callee: TSESTree.CallExpression['callee']): {
  name: string;
  variant: string | null;
} | null {
  if (callee.type === 'Identifier' && TEST_NAMES.has(callee.name)) {
    return { name: callee.name, variant: null };
  }
  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    TEST_NAMES.has(callee.object.name)
  ) {
    const variant =
      callee.property.type === 'Identifier' ? callee.property.name : null;
    return { name: callee.object.name, variant };
  }
  // `test.each(table)(name, fn)` — the outer call's callee is the inner `test.each(table)` call.
  if (callee.type === 'CallExpression') return testCallInfo(callee.callee);
  return null;
}

function isTestCallback(node: TSESTree.CallExpression): boolean {
  const info = testCallInfo(node.callee);
  if (!info) return false;
  if (info.variant !== null && EXEMPT_VARIANTS.has(info.variant)) return false;
  return true;
}

function effectiveName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('expect') ||
    lower.startsWith('assert') ||
    lower.startsWith('verify')
  );
}

/**
 * Candidate names of a call: the callee identifier, and for member calls BOTH the
 * property and the object identifier (`assert.equal(x, y)` — the assertion prefix
 * lives on the object; `chai.expect(x)` — it lives on the property).
 */
function calleeNames(callee: TSESTree.CallExpression['callee']): string[] {
  if (callee.type === 'Identifier') return [callee.name];
  const names: string[] = [];
  if (callee.type === 'MemberExpression') {
    if (callee.property.type === 'Identifier') names.push(callee.property.name);
    if (callee.object.type === 'Identifier') names.push(callee.object.name);
  }
  return names;
}

/**
 * True when the subtree contains an effective assertion call. Nested test callbacks are
 * NOT descended into — their bodies are judged as their own tests.
 */
function hasEffectiveAssertion(node: TSESTree.Node | undefined): boolean {
  if (!node) return false;
  if (node.type === 'CallExpression') {
    if (isTestCallback(node)) return false; // separate body — judged separately
    if (calleeNames(node.callee).some(effectiveName)) return true;
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const child: unknown = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in (item as object)) {
          if (hasEffectiveAssertion(item as TSESTree.Node)) return true;
        }
      }
    } else if (
      child &&
      typeof child === 'object' &&
      'type' in (child as object)
    ) {
      if (hasEffectiveAssertion(child as TSESTree.Node)) return true;
    }
  }
  return false;
}

function callbackOf(node: TSESTree.CallExpression): TSESTree.Node | undefined {
  const last = node.arguments[node.arguments.length - 1];
  if (!last) return undefined;
  if (
    last.type === 'ArrowFunctionExpression' ||
    last.type === 'FunctionExpression'
  )
    return last;
  return undefined;
}

type MessageIds = 'noEffectiveAssertion';

export const requireEffectiveAssertion: TSESLint.RuleModule<MessageIds> = {
  meta: {
    type: 'problem',
    docs: {
      url: `https://github.com/artyhoo/getff/blob/main/packages/core/eslint-rules/require-effective-assertion.ts`,
      description:
        'Forbid test bodies with no expect*/assert*/verify*-named call (Q2 — a test that cannot fail). Scope CONSTRAINT: decidable syntax only, see rule header.',
    },
    messages: {
      noEffectiveAssertion:
        'Test body contains no effective assertion (`expect*` / `assert*` / `verify*` call): it cannot fail, so it verifies nothing (Q2). Await alone is not an assertion. Intentional placeholder: use `it.todo`, or add `// audit:exempt` on this line with a reason.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const lines = context.sourceCode.lines;
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (!isTestCallback(node)) return;
        const cb = callbackOf(node);
        if (!cb) return; // no callback argument — outside the declared scope
        if (isExempt(lines[node.loc.start.line - 1] ?? '')) return;
        if (hasEffectiveAssertion(cb)) return;
        context.report({ node, messageId: 'noEffectiveAssertion' });
      },
    };
  },
};
