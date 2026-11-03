import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

// Q1 of the S1 test-assurance kernel (spec: docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md §5).
// A vacuous assertion asserts a literal against itself — `expect(true).toBe(true)`,
// `expect(1 + 1).toBe(2)` — so it survives ANY production fault and proves nothing.
//
// SCOPE CONSTRAINT (decidable syntax only — the declared scope frozen in
// scripts/test-assurance/expectations.json `rules.no-vacuous-assertion.declared_scope`):
//   - fires ONLY when the first `expect()` argument is a pure literal expression:
//     a Literal, a template literal with no substitutions, or a unary/binary
//     composition of those (no identifiers, no calls — so `expect(constant)` and
//     `expect(call())` are never reported);
//   - fires ONLY inside a test body (`it`/`test`/`specify` callback, `.skip`/`.only`
//     variants included);
//   - honours the project's per-line `// audit:exempt` suppression convention
//     (intentional harness fixtures — the tested exclusion).
// It makes NO dataflow claim: `expect(actual).toBe(true)` with a wrong-by-construction
// production constant is Q3's channel (counterfactual audit), not this rule.

function isExempt(line: string): boolean {
  return line.includes('// audit:exempt');
}

const UNARY_PURE_OPERATORS = new Set(['-', '+', '!', '~', 'typeof', 'void']);

/** A pure literal expression: literals, literal templates, unary/binary over those. */
function isPureLiteral(
  node: TSESTree.Expression | TSESTree.PrivateIdentifier,
): boolean {
  switch (node.type) {
    case 'Literal':
      return true;
    case 'TemplateLiteral':
      return node.expressions.length === 0;
    case 'UnaryExpression':
      return (
        UNARY_PURE_OPERATORS.has(node.operator) && isPureLiteral(node.argument)
      );
    case 'BinaryExpression':
      return isPureLiteral(node.left) && isPureLiteral(node.right);
    default:
      return false;
  }
}

/** Callee identifier of a test call, seeing through `it.skip` and `test.each(...)` wrappers. */
function testCallName(
  callee: TSESTree.CallExpression['callee'],
): string | null {
  if (callee.type === 'Identifier') {
    return ['it', 'test', 'specify'].includes(callee.name) ? callee.name : null;
  }
  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier'
  ) {
    return ['it', 'test', 'specify'].includes(callee.object.name)
      ? callee.object.name
      : null;
  }
  // `test.each(table)(name, fn)` — the outer call's callee is the inner `test.each(table)` call.
  if (callee.type === 'CallExpression') return testCallName(callee.callee);
  return null;
}

function insideTestBody(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (
      current.type === 'CallExpression' &&
      testCallName(current.callee) !== null
    )
      return true;
    current = current.parent;
  }
  return false;
}

type MessageIds = 'vacuousAssertion';

export const noVacuousAssertion: TSESLint.RuleModule<MessageIds> = {
  meta: {
    type: 'problem',
    docs: {
      url: `https://github.com/artyhoo/getff/blob/main/packages/core/eslint-rules/no-vacuous-assertion.ts`,
      description:
        'Forbid expect() over a pure literal inside a test body (Q1 vacuous assertion — survives every production fault). Scope CONSTRAINT: decidable syntax only, see rule header.',
    },
    messages: {
      vacuousAssertion:
        'Vacuous assertion: `expect(<literal>)` compares a constant to itself and survives every production fault (Q1). Assert the real subject instead. Intentional fixture: add `// audit:exempt` on this line with a reason.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const lines = context.sourceCode.lines;
    return {
      "CallExpression[callee.name='expect']"(node: TSESTree.CallExpression) {
        const first = node.arguments[0];
        if (!first) return;
        // A spread argument can never be a pure literal — narrow before the literal walk
        // (CallExpressionArgument = SpreadElement | Expression).
        if (first.type === 'SpreadElement') return;
        if (!isPureLiteral(first)) return;
        if (!insideTestBody(node)) return;
        if (isExempt(lines[node.loc.start.line - 1] ?? '')) return;
        context.report({ node, messageId: 'vacuousAssertion' });
      },
    };
  },
};
