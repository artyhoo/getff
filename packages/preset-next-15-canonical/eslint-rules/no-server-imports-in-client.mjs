import { ESLintUtils } from '@typescript-eslint/utils';
const createRule = ESLintUtils.RuleCreator(() => `https://github.com/artyhoo/getff/blob/main/packages/preset-next-15-canonical/RULES.react-next.md#r12--server-vs-client-components`);
const FORBIDDEN_EXACT = new Set(['fs', 'node:fs', 'node:crypto', 'node:path']);
function isServerOnlyImport(spec) {
    if (FORBIDDEN_EXACT.has(spec))
        return true;
    if (/(^|[/@])infrastructure(\/|$)/.test(spec))
        return true;
    if (spec.includes('config/env'))
        return true;
    return false;
}
function isExempt(line) {
    return line.includes('// audit:exempt');
}
function fileHasUseClient(lines) {
    for (let i = 0; i < Math.min(3, lines.length); i++) {
        const line = lines[i] ?? '';
        if (/^\s*['"]use client['"]\s*;?\s*$/.test(line))
            return true;
    }
    return false;
}
export const noServerImportsInClient = createRule({
    name: 'no-server-imports-in-client',
    meta: {
        type: 'problem',
        docs: {
            description: "Forbid imports of server-only modules (infrastructure, config/env, fs, node:fs/crypto/path) in files marked 'use client' (R12).",
        },
        messages: {
            noServerImportInClient: "'use client' file cannot import server-only module `{{module}}` (R12). Move the dependency to a server boundary or wrap in an infrastructure adapter.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = context.sourceCode;
        const lines = sourceCode.lines;
        const isClientFile = fileHasUseClient(lines);
        if (!isClientFile)
            return {};
        return {
            ImportDeclaration(node) {
                if (typeof node.source.value !== 'string')
                    return;
                if (!isServerOnlyImport(node.source.value))
                    return;
                if (isExempt(lines[node.loc.start.line - 1] ?? ''))
                    return;
                context.report({
                    node,
                    messageId: 'noServerImportInClient',
                    data: { module: node.source.value },
                });
            },
        };
    },
});
