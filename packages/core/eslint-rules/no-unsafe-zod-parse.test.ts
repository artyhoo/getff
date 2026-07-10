import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { noUnsafeZodParse } from './no-unsafe-zod-parse.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run('no-unsafe-zod-parse', noUnsafeZodParse, {
  valid: [
    // safeParse is allowed
    `const r = OrderSchema.safeParse(req.body);`,
    // audit:exempt escape hatch
    `const r = OrderSchema.parse(req.body); // audit:exempt`,
    // standalone parse function (not member access — selector won't match)
    `const r = parse(req.body);`,
    // Stdlib .parse() MUST NOT be flagged.
    // Revert-killer: restoring the bare selector
    // `CallExpression[callee.property.name='parse']` causes these three to fail,
    // proving the test detects the over-broad selector (the gap the shipped test had).
    `const r = JSON.parse(text);`,
    `const d = Date.parse(str);`,
    `const p = path.parse(str);`,
    // Fully-static literal argument: no external input can flow through it, so a throwing
    // .parse() is a legitimate fail-fast pattern (e.g. config defaults), not a boundary
    // validation gap. Live incident: ConfigSchema.parse({port: 3000}) in src/index.ts fired
    // R2 on a fresh ts-server install (false-positive arm of P1.1(e)).
    `const config = ConfigSchema.parse({ port: 3000 });`,
    `const config = ConfigSchema.parse({ port: 3000, name: 'api', flags: { debug: false } });`,
    `const list = ItemsSchema.parse([1, 2, 'three', null]);`,
    `const n = NumSchema.parse(-42);`,
    `const s = StrSchema.parse(\`static\`);`,
    `const config = ConfigSchema.parse({ port: 3000 } as const);`,
  ],
  invalid: [
    // *Schema naming convention: identifiers suffixed with Schema are treated as Zod schemas
    {
      code: `const r = OrderSchema.parse(req.body);`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    // Direct z.* chain: z.string().parse(input)
    {
      code: `const r = z.string().parse(input);`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    // Direct z.* chain: z.object({...}).parse(input)
    {
      code: `const r = z.object({ id: z.string() }).parse(input);`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    // Scope-resolved z.* init: const S = z.object({...}); S.parse(input)
    {
      code: `const S = z.object({ id: z.string() }); const r = S.parse(input);`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    // Paired-negative for the static-literal skip: an argument that LOOKS literal but
    // carries external input anywhere inside must still fire.
    {
      code: `const c = ConfigSchema.parse({ port: process.env.PORT });`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    {
      code: `const c = ConfigSchema.parse({ port: 3000, ...overrides });`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    {
      code: `const c = ConfigSchema.parse([1, input]);`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    {
      code: `const c = ConfigSchema.parse(\`port=\${input}\`);`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    // Mutation-killers for the remaining isStaticLiteral branches (cold-review MAJOR):
    // UnaryExpression over a NON-static operand must stay non-static…
    {
      code: `const n = NumSchema.parse(-input);`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    // …as-const over an identifier must stay non-static…
    {
      code: `const c = ConfigSchema.parse(input as const);`,
      errors: [{ messageId: 'useSafeParse' }],
    },
    // …and a getter smuggling external input through an "object literal" must fire.
    {
      code: `const c = ConfigSchema.parse({ get port() { return req.query.port; } });`,
      errors: [{ messageId: 'useSafeParse' }],
    },
  ],
});
