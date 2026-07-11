import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';

// Generic exempt-aware counterpart to ESLint's built-in `no-restricted-syntax`.
//
// Why this exists: the declarative rule tier (synthesizer `check.type:"declarative"`,
// engine `eslint-restricted`) compiles a `{selector, message}` pair into an ESLint
// rule. The built-in `no-restricted-syntax` cannot honour the project's per-line
// `// audit:exempt` suppression convention because esquery selectors cannot see
// comments. This wrapper runs the same selector(s) but suppresses a report when the
// matched node's line carries `audit:exempt` — mirroring the handwritten rules'
// `context.sourceCode.lines` check (require-form-safe-parse.ts, require-use-server-directive.ts).
//
// Options shape mirrors `no-restricted-syntax`: a variadic list of {selector, message}
// entries. Reports under messageId `restrictedSyntax` with the entry's message.

const createRule = ESLintUtils.RuleCreator(
  () =>
    `https://github.com/artyhoo/getff/blob/main/packages/core/eslint-rules/restricted-syntax-audit-exempt.ts`,
);

interface RestrictedEntry {
  selector: string;
  message?: string;
}

type Options = RestrictedEntry[];
type MessageIds = 'restrictedSyntax';

const EXEMPT_TOKEN = 'audit:exempt';

export const restrictedSyntaxAuditExempt = createRule<Options, MessageIds>({
  name: 'restricted-syntax-audit-exempt',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow syntax matching the given selector(s), honouring per-line `audit:exempt` suppression (exempt-aware no-restricted-syntax).',
    },
    messages: {
      restrictedSyntax: '{{message}}',
    },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          selector: { type: 'string', minLength: 1 },
          message: { type: 'string' },
        },
        required: ['selector'],
        additionalProperties: false,
      },
    },
  },
  defaultOptions: [],
  create(context) {
    const lines = context.sourceCode.lines;
    const listeners: Record<string, (node: TSESTree.Node) => void> = {};

    for (const entry of context.options) {
      const { selector } = entry;
      const message =
        entry.message ??
        `Using '${selector}' is restricted (audit:exempt to override).`;

      const handler = (node: TSESTree.Node): void => {
        // Mirror the handwritten rules: suppress when the violation's line is exempt.
        const line = lines[node.loc.start.line - 1] ?? '';
        if (line.includes(EXEMPT_TOKEN)) return;
        context.report({
          node,
          messageId: 'restrictedSyntax',
          data: { message },
        });
      };

      // Multiple entries may target the same selector — chain their handlers so
      // ESLint's single-listener-per-selector contract is preserved.
      const prev = listeners[selector];
      listeners[selector] = prev
        ? (node: TSESTree.Node): void => {
            prev(node);
            handler(node);
          }
        : handler;
    }

    return listeners;
  },
});
