// Prior-art: prior-art-evaluations.md#140 (BUILD — error-boundary presence gap confirmed;
// upstream eslint-react/error-boundaries validates *usage* not *presence*; WebSearch ×3
// found no production rule enforcing presence at route/app-root; DeepWiki unavailable in
// this environment — DeepWiki-down precedent per SSOT #121/#123, WebSearch is the
// established fallback; Vite SPA has no Next error.tsx / RR errorElement convention → genuine gap).
function isErrorBoundaryLike(name) {
    return name.includes('ErrorBoundary') || name.includes('error-boundary');
}
function extractJSXElementName(nameNode) {
    if (nameNode.type === 'JSXIdentifier') {
        return nameNode.name;
    }
    if (nameNode.type === 'JSXMemberExpression') {
        // e.g. Sentry.ErrorBoundary — check property (likely has ErrorBoundary in name)
        if (isErrorBoundaryLike(nameNode.property.name)) {
            return nameNode.property.name;
        }
        const obj = nameNode.object;
        if (obj.type === 'JSXIdentifier')
            return obj.name;
    }
    return null;
}
export const requireErrorBoundary = {
    meta: {
        type: 'problem',
        docs: {
            url: `https://github.com/artyhoo/getff/blob/main/packages/preset-react-spa/RULES.react-spa.md#r-spa-eb-error-boundary-presence`,
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
        let hasUnprotectedJSX = false;
        let firstJSXNode = null;
        let firstUnprotectedNode = null;
        return {
            JSXOpeningElement(node) {
                hasJSX = true;
                // Track first JSX node for the whole-file audit:exempt line-check (contract unchanged)
                if (firstJSXNode === null)
                    firstJSXNode = node;
                // AST check (T-MS-A): a boundary is recognized in the JSX tree, NOT by string grep on
                // imports — an import produces no JSXOpeningElement, so an imported-but-never-rendered
                // boundary never protects anything.
                const name = extractJSXElementName(node.name);
                if (name !== null && isErrorBoundaryLike(name))
                    return; // a boundary itself, not a violation
                // A05 repair: protection requires an ErrorBoundary ANCESTOR in the file's JSX tree
                // (RULES.react-spa.md §R-SPA-EB: «as an ancestor in the file's JSX tree»). The previous
                // whole-file any-presence flag let an unrelated wrapped component — or a wrapped JSX
                // sibling — mask the diagnostic on unprotected content (seed A05, frozen cases
                // unrelated-wrapped-before/after-app, fragment-unwrapped-sibling).
                // TSESTree gives JSXOpeningElement.parent the precise JSXElement type; the walk
                // needs the general node union (same idiom as no-vacuous-assertion.ts).
                for (let p = node.parent; p && p.type !== 'Program'; p = p.parent) {
                    if (p.type === 'JSXElement') {
                        const ancName = extractJSXElementName(p.openingElement.name);
                        if (ancName !== null && isErrorBoundaryLike(ancName))
                            return; // protected by ancestor
                    }
                }
                hasUnprotectedJSX = true;
                if (firstUnprotectedNode === null)
                    firstUnprotectedNode = node;
            },
            'Program:exit'(program) {
                // Rule only fires when JSX is present (i.e. this is a React component file) and at
                // least one JSX element is not protected by a boundary ancestor.
                // Glob scoping in eslint.config.react.mjs ensures this runs only on app-root files.
                if (!hasJSX || !hasUnprotectedJSX)
                    return;
                const reportNode = firstUnprotectedNode ?? firstJSXNode ?? program;
                // audit:exempt line check — mirrors require-use-server-directive.ts pattern; stays on
                // the FIRST JSX element of the file (whole-file exemption contract, unchanged by A05).
                const exemptLine = firstJSXNode
                    ? (lines[firstJSXNode.loc.start.line - 1] ?? '')
                    : '';
                if (exemptLine.includes('// audit:exempt'))
                    return;
                context.report({
                    node: reportNode,
                    messageId: 'missingErrorBoundary',
                });
            },
        };
    },
};
