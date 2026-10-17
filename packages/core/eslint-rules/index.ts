import { noUnsafeZodParse } from './no-unsafe-zod-parse.ts';
import { noDirectTimeRandomness } from './no-direct-time-randomness.ts';
import { requireOtelSpan } from './require-otel-span.ts';
import { restrictedSyntaxAuditExempt } from './restricted-syntax-audit-exempt.ts';
import { requireErrorBoundary } from './require-error-boundary.ts';

const plugin = {
  meta: {
    name: '@rules-as-tests/core-eslint-rules',
    version: '0.1.0',
  },
  rules: {
    'no-unsafe-zod-parse': noUnsafeZodParse,
    'no-direct-time-randomness': noDirectTimeRandomness,
    'require-otel-span': requireOtelSpan,
    'restricted-syntax-audit-exempt': restrictedSyntaxAuditExempt,
    'require-error-boundary': requireErrorBoundary,
  },
};

export default plugin;
export const rules = plugin.rules;
