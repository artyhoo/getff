import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (_name) =>
    `https://github.com/artyhoo/getff/blob/main/packages/preset-next-15-canonical/RULES.md#r2--validation-at-boundaries`,
);

// Returns true if node is (or contains) a direct z.* call/member chain.
// Handles z.object({}).parse(x), z.string().nullable().parse(x), etc.
function isZodChain(node: TSESTree.Node): boolean {
  if (node.type === 'CallExpression') return isZodChain(node.callee);
  if (node.type === 'MemberExpression') {
    if (node.object.type === 'Identifier' && node.object.name === 'z')
      return true;
    return isZodChain(node.object);
  }
  return false;
}

// Heuristic: is the receiver node a Zod schema?
// Uses AST + ESLint scope analysis only — zero type info, zero new dependencies.
// Three signals: (1) direct z.* chain, (2) *Schema naming, (3) scope-resolved z.* init or 'zod' import.
function isZodishReceiver(
  receiver: TSESTree.Node,
  scope: TSESLint.Scope.Scope,
): boolean {
  // (1) Direct z.* chain: z.object({}).parse(x), z.string().parse(x)
  if (isZodChain(receiver)) return true;

  if (receiver.type !== 'Identifier') return false;
  const name = receiver.name;

  // (2) *Schema naming convention (e.g. OrderSchema, bodySchema)
  if (name.endsWith('Schema')) return true;

  // (3) Scope-resolve: walk scope chain to check declaration
  let s: TSESLint.Scope.Scope | null = scope;
  while (s) {
    const variable = s.set.get(name);
    if (variable) {
      for (const def of variable.defs) {
        // Imported directly from 'zod': import { schema } from 'zod'
        if (
          def.type === 'ImportBinding' &&
          (def.parent as TSESTree.ImportDeclaration)?.source.value === 'zod'
        )
          return true;
        // Variable initialised from a z.* chain: const S = z.object({...})
        if (def.type === 'Variable') {
          const init = (def.node as TSESTree.VariableDeclarator).init;
          if (init && isZodChain(init)) return true;
        }
      }
      break; // found variable in this scope level; stop traversal
    }
    s = s.upper;
  }

  return false;
}

// A fully-static literal expression cannot carry external input, so a throwing .parse()
// on it is deliberate fail-fast (e.g. ConfigSchema.parse({port: 3000}) at startup), not a
// boundary-validation gap. Conservative by construction: any identifier, member access,
// call, spread, or computed key inside makes the argument non-static and the rule fires.
function isStaticLiteral(node: TSESTree.Node): boolean {
  switch (node.type) {
    case 'Literal':
      return true;
    case 'TemplateLiteral':
      return node.expressions.length === 0;
    case 'UnaryExpression':
      // -42, +1, !0, ~0 over a static operand
      return isStaticLiteral(node.argument);
    case 'ObjectExpression':
      return node.properties.every(
        (p) =>
          p.type === 'Property' &&
          !p.computed &&
          (p.key.type === 'Identifier' || p.key.type === 'Literal') &&
          isStaticLiteral(p.value),
      );
    case 'ArrayExpression':
      return node.elements.every(
        (el) =>
          el !== null && el.type !== 'SpreadElement' && isStaticLiteral(el),
      );
    case 'TSAsExpression': // { ... } as const
    case 'TSSatisfiesExpression':
      return isStaticLiteral(node.expression);
    default:
      return false;
  }
}

export const noUnsafeZodParse = createRule({
  name: 'no-unsafe-zod-parse',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid Zod schema `.parse()` in HTTP boundary files; require `.safeParse()`. Stdlib `.parse()` (JSON, Date, path) and fully-static literal arguments (fail-fast config parses) are not flagged.',
    },
    messages: {
      useSafeParse:
        'Use `.safeParse()` instead of `.parse()` in HTTP boundaries — `.parse()` throws and bypasses structured error handling (R2).',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      "CallExpression[callee.type='MemberExpression'][callee.property.name='parse']"(
        node: TSESTree.CallExpression,
      ) {
        const line = node.loc.start.line;
        const lines = sourceCode.lines;
        const currentLine = lines[line - 1] ?? '';
        if (currentLine.includes('// audit:exempt')) return;

        const callee = node.callee as TSESTree.MemberExpression;
        if (!isZodishReceiver(callee.object, sourceCode.getScope(node))) return;

        // Static-literal argument → not a boundary parse; skip (false-positive arm of
        // ultrareview P1.1(e): a rule that cries on clean code gets disabled).
        const firstArg = node.arguments[0];
        if (
          firstArg &&
          firstArg.type !== 'SpreadElement' &&
          isStaticLiteral(firstArg)
        )
          return;

        context.report({ node, messageId: 'useSafeParse' });
      },
    };
  },
});
