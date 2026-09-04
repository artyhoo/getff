import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  () =>
    `https://github.com/artyhoo/getff/blob/main/packages/preset-next-15-canonical/RULES.md#r7--time-randomness-io`,
);

const FORBIDDEN_MODULES = new Set([
  'fs',
  'http',
  'https',
  'node:fs',
  'node:http',
  'node:https',
]);

function isExempt(line: string): boolean {
  return line.includes('// audit:exempt');
}

export const noDirectTimeRandomness = createRule({
  name: 'no-direct-time-randomness',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid Date.now(), new Date(), Math.random(), and direct fs/http/https imports outside infrastructure (R7).',
    },
    messages: {
      noDateNow: 'Use an injected Clock instead of `Date.now()` (R7).',
      noNewDate: 'Use an injected Clock instead of `new Date()` (R7).',
      noMathRandom:
        'Use an injected Random source instead of `Math.random()` (R7).',
      noDirectIO:
        'Direct `{{module}}` import is forbidden outside `infrastructure/` (R7). Wrap it in an infrastructure module.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const lines = sourceCode.lines;
    const lineExempt = (n: number) => isExempt(lines[n - 1] ?? '');

    return {
      "CallExpression[callee.type='MemberExpression'][callee.object.name='Date'][callee.property.name='now']"(
        node: TSESTree.CallExpression,
      ) {
        if (lineExempt(node.loc.start.line)) return;
        context.report({ node, messageId: 'noDateNow' });
      },
      "CallExpression[callee.type='MemberExpression'][callee.object.name='Math'][callee.property.name='random']"(
        node: TSESTree.CallExpression,
      ) {
        if (lineExempt(node.loc.start.line)) return;
        context.report({ node, messageId: 'noMathRandom' });
      },
      "NewExpression[callee.name='Date']"(node: TSESTree.NewExpression) {
        if (lineExempt(node.loc.start.line)) return;
        context.report({ node, messageId: 'noNewDate' });
      },
      ImportDeclaration(node) {
        if (typeof node.source.value !== 'string') return;
        if (!FORBIDDEN_MODULES.has(node.source.value)) return;
        if (lineExempt(node.loc.start.line)) return;
        context.report({
          node,
          messageId: 'noDirectIO',
          data: { module: node.source.value },
        });
      },
    };
  },
});
