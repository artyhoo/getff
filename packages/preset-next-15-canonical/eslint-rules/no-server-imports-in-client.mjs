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
// A directive prologue is the leading run of string-literal expression statements; comments
// and whitespace are trivia and never enter the AST, so a directive after a license-header
// comment block is honored here (SWEEP-4 §4.2) while one following real code is not.
function directivePrologueHasUseClient(body) {
    for (const stmt of body) {
        if (stmt.type !== 'ExpressionStatement')
            return false;
        const expr = stmt.expression;
        if (expr.type !== 'Literal' || typeof expr.value !== 'string')
            return false;
        if (expr.value === 'use client')
            return true;
    }
    return false;
}
export const noServerImportsInClient = {
    meta: {
        type: 'problem',
        docs: {
            url: `https://github.com/artyhoo/getff/blob/main/packages/preset-next-15-canonical/RULES.react-next.md#r12--server-vs-client-components`,
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
        const isClientFile = directivePrologueHasUseClient(sourceCode.ast.body);
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
};
