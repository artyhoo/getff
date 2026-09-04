import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  () =>
    `https://github.com/artyhoo/getff/blob/main/packages/preset-next-15-canonical/RULES.md#r8--observability`,
);

// Keys that form circular refs or are not AST children
const SKIP_KEYS = new Set(['parent', 'loc', 'range', 'tokens', 'comments']);

function functionHasSpan(body: TSESTree.BlockStatement | undefined): boolean {
  if (!body) return false;

  // Iterative DFS to avoid stack overflow on large bodies
  const stack: TSESTree.Node[] = [body];

  while (stack.length > 0) {
    const node = stack.pop()!;

    // tracer.startActiveSpan(...) / x.startActiveSpan(...)
    if (
      node.type === AST_NODE_TYPES.CallExpression &&
      node.callee.type === AST_NODE_TYPES.MemberExpression &&
      node.callee.property.type === AST_NODE_TYPES.Identifier &&
      node.callee.property.name === 'startActiveSpan'
    ) {
      return true;
    }
    // withSpan(...)
    if (
      node.type === AST_NODE_TYPES.CallExpression &&
      node.callee.type === AST_NODE_TYPES.Identifier &&
      node.callee.name === 'withSpan'
    ) {
      return true;
    }

    // Push child nodes onto stack
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (!value || typeof value !== 'object') continue;
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object' && 'type' in child) {
            stack.push(child as TSESTree.Node);
          }
        }
      } else if ('type' in value) {
        stack.push(value as TSESTree.Node);
      }
    }
  }

  return false;
}

// TODO: decorator @span not supported in this version, left for future

export const requireOtelSpan = createRule({
  name: 'require-otel-span',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Exported async functions must open an OTel span (tracer.startActiveSpan or withSpan) — R8.',
    },
    messages: {
      missingSpan:
        'Exported async function "{{name}}" must open an OTel span (tracer.startActiveSpan / withSpan) — R8.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function checkFn(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
      name: string,
    ): void {
      if (!node.async) return;
      const body =
        node.body.type === AST_NODE_TYPES.BlockStatement
          ? node.body
          : undefined;
      if (functionHasSpan(body)) return;
      context.report({
        node,
        messageId: 'missingSpan',
        data: { name },
      });
    }

    return {
      // export async function foo() {}
      'ExportNamedDeclaration > FunctionDeclaration'(
        node: TSESTree.FunctionDeclaration,
      ) {
        if (!node.id) return;
        checkFn(node, node.id.name);
      },
      // export const foo = async () => {} / async function() {}
      'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator'(
        node: TSESTree.VariableDeclarator,
      ) {
        if (node.id.type !== AST_NODE_TYPES.Identifier || !node.init) return;
        if (
          node.init.type === AST_NODE_TYPES.ArrowFunctionExpression ||
          node.init.type === AST_NODE_TYPES.FunctionExpression
        ) {
          checkFn(node.init, node.id.name);
        }
      },
    };
  },
});
