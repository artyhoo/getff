const EXEMPT_TOKEN = 'audit:exempt';
export const restrictedSyntaxAuditExempt = {
    meta: {
        type: 'problem',
        docs: {
            url: `https://github.com/artyhoo/getff/blob/main/packages/core/eslint-rules/restricted-syntax-audit-exempt.ts`,
            description: 'Disallow syntax matching the given selector(s), honouring per-line `audit:exempt` suppression (exempt-aware no-restricted-syntax).',
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
        const listeners = {};
        for (const entry of context.options) {
            const { selector } = entry;
            const message = entry.message ??
                `Using '${selector}' is restricted (audit:exempt to override).`;
            const handler = (node) => {
                // Mirror the handwritten rules: suppress when the violation's line is exempt.
                const line = lines[node.loc.start.line - 1] ?? '';
                if (line.includes(EXEMPT_TOKEN))
                    return;
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
                ? (node) => {
                    prev(node);
                    handler(node);
                }
                : handler;
        }
        return listeners;
    },
};
