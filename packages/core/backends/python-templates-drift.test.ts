// Byte-drift gate — python-delivery-v0 umbrella, S1 Task 4.
//
// WHY HERE (backends/): this gate proves the committed static templates under
// packages/core/templates/python/ are byte-identical to a fresh render of the curated starter
// nodes through the ast-grep (#212) + ruff (#215) BACKENDS. It runs at the pre-push channel via
// `npm --prefix packages/core run test:backends` (== `vitest run backends/`, .husky/pre-push
// → hooks/pre-push.ts §5c). Co-locating it with the backend suites is what makes it a pre-push
// gate WITHOUT editing the maintainer-owned hook — the python-starter/ suite is NOT in any
// pre-push `test:*` script, only in the full `test` run (CI).
//
// The plan is imported PURE from render-python-templates.ts (no fs writes on import); this test
// only READS committed bytes. On drift the fix is: `npx tsx packages/core/python-starter/render-python-templates.ts`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PYTHON_TEMPLATE_DIR,
  checkPythonTemplateDrift,
  listTemplateFiles,
  planPythonTemplates,
} from '../python-starter/render-python-templates.ts';

describe('python templates — committed == fresh render (byte-drift gate)', () => {
  it('every planned file is committed byte-for-byte, with no orphans', () => {
    // The load-bearing assertion: zero drift findings (missing | byte-mismatch | orphan).
    expect(checkPythonTemplateDrift()).toEqual([]);
  });

  it('each planned file matches its committed bytes individually (sharper diff on failure)', () => {
    for (const f of planPythonTemplates()) {
      const committed = readFileSync(join(PYTHON_TEMPLATE_DIR, f.path), 'utf8');
      expect(committed, `drift in ${f.path}`).toBe(f.content);
    }
  });

  it('the committed file set is exactly the planned set (no stray files under templates/python)', () => {
    const planned = planPythonTemplates()
      .map((f) => f.path)
      .sort();
    expect(listTemplateFiles(PYTHON_TEMPLATE_DIR)).toEqual(planned);
  });
});

describe('python templates — Decision #5 single-owner lane (no rule ships in both lanes)', () => {
  it('no getff-* rule id appears in both an ast-grep rule file and ruff.toml', () => {
    const files = planPythonTemplates();
    const astgrepIds = new Set(
      files
        .filter((f) => f.path.endsWith('.yml') && f.path !== 'sgconfig.yml')
        .flatMap((f) =>
          [...f.content.matchAll(/^id: "([^"]+)"/gm)].map((m) => m[1]),
        ),
    );
    const ruff = files.find((f) => f.path === 'ruff.toml')?.content ?? '';
    const bothLanes = [...astgrepIds].filter((id) => ruff.includes(id));
    expect(bothLanes, 'ids present in BOTH lanes').toEqual([]);
    // Sanity: the ast-grep lane is non-empty (guards a vacuous pass).
    expect(astgrepIds.size).toBeGreaterThan(0);
  });
});
