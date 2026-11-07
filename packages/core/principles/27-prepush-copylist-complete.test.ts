/**
 * Principle 27 — the consumer's pre-push hook is the prebuilt bundle, and it is complete.
 *
 * > **Authoritative for:** both delivery sites (setup.d/50-hooks.sh on install, install.sh on
 * > --refresh) ship `packages/core/hooks/pre-push.bundle.mjs` and NO TypeScript hook source; the
 * > shipped dispatcher runs that bundle with plain `node`; every module the bundle still loads at
 * > run time is a declared external whose pre-push section never composes on a consumer.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. Bundle freshness
 * > against its sources — the drift gate `node scripts/build-runtime-bundles.mjs --check`.
 *
 * HISTORY. This slot closed #735 as «install.sh ships the COMPLETE import graph of pre-push.ts»:
 * the consumer received pre-push.ts, its checks/ and utils/ modules and the packages/core/eslint-rules
 * barrel, and a missing entry crashed the hook with ERR_MODULE_NOT_FOUND. Since 2026-09-28 the
 * consumer receives one prebuilt .mjs instead (scripts/build-runtime-bundles.mjs) — the shipped .ts
 * graph was linted and type-checked by every project that owns its eslint.config / tsconfig and
 * turned lint, typecheck and build RED right after install. The completeness question survives in a
 * new form: a module the bundle leaves out (an `external`) must never be reached on a consumer,
 * because the consumer does not have it. Arm (d) checks exactly that.
 *
 * Paired negatives (e)/(f) run the same parsers on the pre-2026-09-28 delivery shape and on a bundle
 * with an undeclared runtime import, and assert both are reported — the real-tree arms cannot pass
 * vacuously.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECTIONS, composeSections } from '../hooks/pre-push.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');

const INSTALL_SH = resolve(REPO_ROOT, 'install.sh');
const SETUP_HOOKS_SH = resolve(REPO_ROOT, 'setup.d/50-hooks.sh');
const DISPATCHER = resolve(
  REPO_ROOT,
  'packages/core/templates/shared/husky-pre-push.sh',
);
const BUNDLE_REL = 'packages/core/hooks/pre-push.bundle.mjs';
const BUNDLE = resolve(REPO_ROOT, BUNDLE_REL);

/** What a consumer may receive under packages/core/{hooks,eslint-rules}/ — nothing else. */
const ALLOWED_HOOK_DESTINATIONS = new Set([
  '$PROJECT_ROOT/packages/core/hooks/pre-push.bundle.mjs',
  '$PROJECT_ROOT/packages/core/hooks/pre-push.fallback.sh',
]);

interface BundleSpec {
  entry: string;
  outfile: string;
  external: { path: string; section: string }[];
}

async function prePushBundleSpec(): Promise<BundleSpec> {
  const mod = (await import(
    resolve(REPO_ROOT, 'scripts/build-runtime-bundles.mjs')
  )) as { BUNDLES: BundleSpec[] };
  const spec = mod.BUNDLES.find((b) => b.outfile === BUNDLE_REL);
  if (!spec) throw new Error(`scripts/build-runtime-bundles.mjs declares no ${BUNDLE_REL}`);
  return spec;
}

/**
 * Every copy_safe / refresh_safe destination under packages/core/hooks/ or
 * packages/core/eslint-rules/, with line continuations joined. A loop copy such as
 * `"$PROJECT_ROOT/packages/core/hooks/$ts_hook"` is returned verbatim — it is not an
 * allowed destination, so the arm reports it.
 */
export function hookDeliveries(source: string): string[] {
  const joined = source.replace(/\\\n\s*/g, ' ');
  const out: string[] = [];
  for (const m of joined.matchAll(
    /\b(?:copy_safe|refresh_safe)\s+"[^"]*"\s+"([^"]*packages\/core\/(?:hooks|eslint-rules)\/[^"]*)"/g,
  )) {
    out.push(m[1]);
  }
  return out;
}

/**
 * Module specifiers the bundle still loads at run time — static `from "…"`, bare `import "…"`
 * and dynamic `import("…")` — minus Node built-ins.
 */
export function bundleRuntimeImports(text: string): string[] {
  const builtins = new Set(builtinModules);
  const seen = new Set<string>();
  for (const m of text.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm,
  )) {
    const spec = m[1];
    if (spec.startsWith('node:') || builtins.has(spec)) continue;
    seen.add(spec);
  }
  return [...seen].sort();
}

describe('Principle 27 — the consumer pre-push hook is the prebuilt bundle, and it is complete', () => {
  it('(a) both delivery sites ship pre-push.bundle.mjs', () => {
    const want = '$PROJECT_ROOT/packages/core/hooks/pre-push.bundle.mjs';
    expect(
      hookDeliveries(readFileSync(SETUP_HOOKS_SH, 'utf8')),
      'setup.d/50-hooks.sh must copy_safe the bundle',
    ).toContain(want);
    expect(
      hookDeliveries(readFileSync(INSTALL_SH, 'utf8')),
      'install.sh --refresh must refresh_safe the bundle',
    ).toContain(want);
  });

  it('(b) neither delivery site ships TypeScript hook source, the eslint-rules barrel or a module-type marker', () => {
    for (const [name, file] of [
      ['setup.d/50-hooks.sh', SETUP_HOOKS_SH],
      ['install.sh', INSTALL_SH],
    ] as const) {
      const stray = hookDeliveries(readFileSync(file, 'utf8')).filter(
        (d) => !ALLOWED_HOOK_DESTINATIONS.has(d),
      );
      expect(
        stray,
        `${name} delivers into packages/core/{hooks,eslint-rules}/ beyond the bundle + fallback — ` +
          `a consumer's own eslint/tsc would check these files as project code:\n  ${stray.join('\n  ')}`,
      ).toEqual([]);
    }
  });

  it('(c) the shipped dispatcher runs the bundle with plain node — no tsx', () => {
    const dispatcher = readFileSync(DISPATCHER, 'utf8');
    expect(dispatcher).toMatch(/HOOK="\$REPO_ROOT\/packages\/core\/hooks\/pre-push\.bundle\.mjs"/);
    expect(dispatcher).toMatch(/exec node "\$HOOK"/);
    expect(dispatcher, 'the dispatcher must not load a loader (tsx)').not.toMatch(/--import|tsx\/esm/);
  });

  it('(d) every runtime import left in the bundle is a declared external of a maintainer-only section', async () => {
    const spec = await prePushBundleSpec();
    const declared = new Map(spec.external.map((e) => [e.path, e.section]));
    const imports = bundleRuntimeImports(readFileSync(BUNDLE, 'utf8'));

    const undeclared = imports.filter((i) => !declared.has(i));
    expect(
      undeclared,
      `${BUNDLE_REL} loads modules at run time that are neither Node built-ins nor declared ` +
        `externals — a consumer has none of them:\n  ${undeclared.join('\n  ')}`,
    ).toEqual([]);

    const consumerIds = new Set(composeSections(SECTIONS, false).map((s) => s.id));
    for (const [path, section] of declared) {
      const entry = SECTIONS.find((s) => s.id === section);
      expect(entry, `external ${path} names section '${section}', which is not registered`).toBeDefined();
      expect(entry?.owner, `external ${path} is loaded by '${section}'`).toBe('maintainer');
      expect(consumerIds.has(section), `'${section}' composes on a consumer`).toBe(false);
    }
    // Non-vacuity: the bundle really does leave the ESLint liveness gate out.
    expect(imports.length).toBeGreaterThanOrEqual(1);
  });

  it('(e) paired negative: the pre-2026-09-28 delivery shape is reported by arm (b)', () => {
    const oldShape = [
      'copy_safe "$PKG_ROOT/packages/core/hooks/pre-push.fallback.sh" "$PROJECT_ROOT/packages/core/hooks/pre-push.fallback.sh"',
      'for ts_hook in \\',
      '  pre-push.ts \\',
      '  utils/git.ts; do',
      '  copy_safe "$PKG_ROOT/packages/core/hooks/$ts_hook" "$PROJECT_ROOT/packages/core/hooks/$ts_hook"',
      'done',
      '  refresh_safe "$PKG_ROOT/packages/core/eslint-rules/$_esl" \\',
      '               "$PROJECT_ROOT/packages/core/eslint-rules/$_esl"',
      'copy_safe "$PKG_ROOT/packages/core/templates/shared/hooks-package.json" "$PROJECT_ROOT/packages/core/hooks/package.json"',
    ].join('\n');
    const stray = hookDeliveries(oldShape).filter((d) => !ALLOWED_HOOK_DESTINATIONS.has(d));
    expect(stray).toEqual([
      '$PROJECT_ROOT/packages/core/hooks/$ts_hook',
      '$PROJECT_ROOT/packages/core/eslint-rules/$_esl',
      '$PROJECT_ROOT/packages/core/hooks/package.json',
    ]);
  });

  it('(f) paired negative: an undeclared runtime import and a third-party import are reported by arm (d)', () => {
    const text = [
      'import { readFileSync } from "node:fs";',
      'import { spawnSync } from "child_process";',
      'import Ajv from "ajv";',
      'const gate = await import("./checks/guard-liveness.ts");',
      'const other = await import("./checks/new-gate.ts");',
    ].join('\n');
    expect(bundleRuntimeImports(text)).toEqual([
      './checks/guard-liveness.ts',
      './checks/new-gate.ts',
      'ajv',
    ]);
  });
});
