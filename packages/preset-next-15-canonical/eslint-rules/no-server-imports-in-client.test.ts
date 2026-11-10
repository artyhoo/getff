import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { noServerImportsInClient } from './no-server-imports-in-client.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run('no-server-imports-in-client', noServerImportsInClient, {
  valid: [
    // No 'use client' directive — rule does not apply
    `import fs from 'fs';\nexport function x() {}`,
    `import { db } from '@/infrastructure/db';\nexport const y = 1;`,
    // 'use client' file with safe imports
    `'use client';\nimport { useState } from 'react';\nexport function C() { return null; }`,
    `"use client";\nimport { z } from 'zod';\nexport const s = z.string();`,
    // Exempt line
    `'use client';\nimport fs from 'fs'; // audit:exempt\nexport const x = 1;`,
    // directive after leading comments is still a directive prologue (SWEEP-4 §4.2) — covered
    // by the matching invalid arm below; here: directive genuinely after code is NOT a prologue
    `const x = 1;\n'use client';\nimport fs from 'fs';\nexport const y = 2;`,
    // directive after an import statement is NOT in the prologue — rule does not apply
    `import './side-effect';\n'use client';\nimport fs from 'fs';\nexport const y = 2;`,
    // false positive guard: 'infrastructure' as substring of unrelated word
    `'use client';\nimport { x } from './infrastructureless-helper';\nexport const x2 = 1;`,
  ],
  invalid: [
    {
      // SWEEP-4 §4.2 repro: license-header comment block before the directive — bundler honors
      // it (comments are trivia), so the R12 ban must reach the server import.
      code: `// header\n// header\n// header\n'use client';\nimport fs from 'fs';\nexport const x = 1;`,
      errors: [{ messageId: 'noServerImportInClient', data: { module: 'fs' } }],
    },
    {
      // single-line block comment before the directive — same prologue rule
      code: `/* license */\n'use client';\nimport { db } from '@/infrastructure/db';\nexport const x = 1;`,
      errors: [
        {
          messageId: 'noServerImportInClient',
          data: { module: '@/infrastructure/db' },
        },
      ],
    },
    {
      code: `'use client';\nimport fs from 'fs';\nexport const x = 1;`,
      errors: [{ messageId: 'noServerImportInClient', data: { module: 'fs' } }],
    },
    {
      code: `"use client";\nimport { readFile } from 'node:fs';\nexport const y = 1;`,
      errors: [
        { messageId: 'noServerImportInClient', data: { module: 'node:fs' } },
      ],
    },
    {
      code: `'use client';\nimport { hash } from 'node:crypto';\nexport const z = 1;`,
      errors: [
        { messageId: 'noServerImportInClient', data: { module: 'node:crypto' } },
      ],
    },
    {
      code: `'use client';\nimport { db } from '@/infrastructure/db';\nexport const a = 1;`,
      errors: [
        {
          messageId: 'noServerImportInClient',
          data: { module: '@/infrastructure/db' },
        },
      ],
    },
    {
      code: `'use client';\nimport { repo } from '../../infrastructure/repo';\nexport const b = 1;`,
      errors: [
        {
          messageId: 'noServerImportInClient',
          data: { module: '../../infrastructure/repo' },
        },
      ],
    },
    {
      code: `'use client';\nimport { env } from '@/config/env';\nexport const c = 1;`,
      errors: [
        {
          messageId: 'noServerImportInClient',
          data: { module: '@/config/env' },
        },
      ],
    },
  ],
});
