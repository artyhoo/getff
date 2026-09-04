import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils';
// Prior-art: prior-art-evaluations.md#140 (BUILD — error-boundary presence gap confirmed;
// upstream eslint-react/error-boundaries validates *usage* not *presence*; WebSearch ×3
// found no production rule enforcing presence at route/app-root; DeepWiki unavailable in
// this environment — DeepWiki-down precedent per SSOT #121/#123, WebSearch is the
// established fallback; Vite SPA has no Next error.tsx / RR errorElement convention → genuine gap).
const createRule = ESLintUtils.RuleCreator(() => `https://github.com/artyhoo/getff/blob/main/packages/preset-react-spa/RULES.react-spa.md#r-spa-eb-error-boundary-presence`);
function isErrorBoundaryLike(name) {
    return name.includes('ErrorBoundary') || name.includes('error-boundary');
}
function extractJSXElementName(nameNode) {
    if (nameNode.type === AST_NODE_TYPES.JSXIdentifier) {
        return nameNode.name;
    }
    if (nameNode.type === AST_NODE_TYPES.JSXMemberExpression) {
        // e.g. Sentry.ErrorBoundary — check property (likely has ErrorBoundary in name)
        if (isErrorBoundaryLike(nameNode.property.name)) {
            return nameNode.property.name;
        }
        const obj = nameNode.object;
        if (obj.type === AST_NODE_TYPES.JSXIdentifier)
            return obj.name;
    }
    return null;
}
export const requireErrorBoundary = createRule({
    name: 'require-error-boundary',
    meta: {
        type: 'problem',
        docs: {
            description: 'App-root files must render content wrapped in an ErrorBoundary JSX element (R-SPA-EB). Enable via glob scoping to entry-point files such as App.tsx. Scope CONSTRAINT v1: narrow in-file check only — no cross-file boundary-tree walk (per SSOT #115 brittleness precedent).',
        },
        messages: {
            missingErrorBoundary: 'App-root component must render its content inside an ErrorBoundary JSX element (R-SPA-EB). Add <ErrorBoundary> as an ancestor in the JSX tree. To opt out intentionally, add // audit:exempt on the same line as the first JSX element.',
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = context.sourceCode;
        const lines = sourceCode.lines;
        let hasJSX = false;
        let hasErrorBoundaryInJSX = false;
        let firstJSXNode = null;
        return {
            JSXOpeningElement(node) {
                hasJSX = true;
                // Track first JSX node for reporting (and for audit:exempt line-check)
                if (firstJSXNode === null)
                    firstJSXNode = node;
                // AST ancestor check (T-MS-A): detect ErrorBoundary in JSX tree, NOT string grep on import.
                // An import statement does NOT produce a JSXOpeningElement node, so a component that is
                // imported but never rendered never sets hasErrorBoundaryInJSX=true.
                const name = extractJSXElementName(node.name);
                if (name !== null && isErrorBoundaryLike(name)) {
                    hasErrorBoundaryInJSX = true;
                }
            },
            'Program:exit'(program) {
                // Rule only fires when JSX is present (i.e. this is a React component file).
                // Glob scoping in eslint.config.react.mjs ensures this runs only on app-root files.
                if (!hasJSX || hasErrorBoundaryInJSX)
                    return;
                const reportNode = firstJSXNode ?? program;
                // audit:exempt line check — mirrors require-use-server-directive.ts pattern
                const line = lines[reportNode.loc.start.line - 1] ?? '';
                if (line.includes('// audit:exempt'))
                    return;
                context.report({
                    node: reportNode,
                    messageId: 'missingErrorBoundary',
                });
            },
        };
    },
});
