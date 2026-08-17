// U10 option b (2026-08-17) — the resolver behind the five plugin-rule gates.
//
// Two arms carry the operator's falsifier ("if the barrel anchor is not implemented and
// consumers always degrade, option (b) collapses into theatre"):
//   (a) with a fixture barrel present, the barrel tier is what supplies the rules — asserted
//       here at resolver level and in gate-tautology.test.ts at gate level (a seeded
//       tautology is CAUGHT, which is only possible if the barrel really loaded);
//   (b) with neither tier available, the resolver reports core-only + a named skip, never a
//       silent success.
//
// Tier (ii)'s absence is simulated with `workspaceSpecifiers: []` — inside the monorepo the
// workspace packages are always on disk, so an empty specifier list is the only way to
// reproduce a published tarball, where they are absent by construction. The `skipped`
// bookkeeping for a genuinely unresolvable specifier is proven separately below.

import { existsSync, readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONSUMER_BARREL_SPECIFIER,
  WORKSPACE_PRESET_SPECIFIERS,
  degradeFor,
  isUnresolvablePluginRule,
  knownPlugins,
  resolvePluginRegistry,
} from './preset-plugin-resolver.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BARREL_FIXTURE = resolve(HERE, 'fixtures', 'consumer-barrel');
const NO_BARREL = resolve(HERE, 'fixtures', 'negative-corpus'); // a dir with no eslint-rules-local/

describe('preset-plugin-resolver — tier (i) consumer barrel', () => {
  it('resolves the vendored barrel anchored at the given cwd, with tier (ii) unavailable', () => {
    const registry = resolvePluginRegistry({
      cwd: BARREL_FIXTURE,
      workspaceSpecifiers: [],
    });
    expect(registry.source).toBe('consumer-barrel');
    expect(registry.presetsResolved).toBe(true);
    expect(Object.keys(registry.rules)).toContain('always-fires');
    expect(registry.resolvedFrom[0]).toContain(CONSUMER_BARREL_SPECIFIER);
    expect(registry.skipped).toEqual([]);
  });

  it('unions the barrel with the core rules that ship inside the package', () => {
    const registry = resolvePluginRegistry({
      cwd: BARREL_FIXTURE,
      workspaceSpecifiers: [],
    });
    // corePlugin contributes the exempt-aware wrapper the declarative tier emits.
    expect(Object.keys(registry.rules)).toContain(
      'restricted-syntax-audit-exempt',
    );
  });

  it('prefers the barrel over the workspace packages (tier order)', () => {
    const registry = resolvePluginRegistry({ cwd: BARREL_FIXTURE });
    expect(registry.source).toBe('consumer-barrel');
    // The workspace preset rule is NOT in a barrel-sourced registry — proof the barrel was
    // used rather than the workspace packages that resolve in this repo.
    expect(Object.keys(registry.rules)).not.toContain(
      'no-server-imports-in-client',
    );
  });
});

describe('preset-plugin-resolver — tier (ii) workspace packages', () => {
  it('falls back to the workspace packages when no barrel exists (the monorepo/CI path)', () => {
    const registry = resolvePluginRegistry({ cwd: NO_BARREL });
    expect(registry.source).toBe('workspace-presets');
    expect(registry.presetsResolved).toBe(true);
    expect(Object.keys(registry.rules)).toContain('no-server-imports-in-client');
    expect(Object.keys(registry.rules)).toContain('require-error-boundary');
    expect(registry.resolvedFrom).toEqual([...WORKSPACE_PRESET_SPECIFIERS]);
    expect(registry.skipped.map((s) => s.specifier)).toEqual([
      `${CONSUMER_BARREL_SPECIFIER} (from ${NO_BARREL})`,
    ]);
  });

  it('records an unresolvable workspace specifier instead of throwing', () => {
    const registry = resolvePluginRegistry({
      cwd: NO_BARREL,
      workspaceSpecifiers: ['@rules-as-tests/no-such-preset/eslint-rules'],
    });
    expect(registry.presetsResolved).toBe(false);
    const skipped = registry.skipped.find((s) =>
      s.specifier.includes('no-such-preset'),
    );
    expect(skipped?.reason).toMatch(/MODULE_NOT_FOUND|Cannot find/);
  });
});

describe('preset-plugin-resolver — tier (iii) honest degrade', () => {
  const degradedRegistry = () =>
    resolvePluginRegistry({ cwd: NO_BARREL, workspaceSpecifiers: [] });

  it('reports core-only, never an empty success', () => {
    const registry = degradedRegistry();
    expect(registry.source).toBe('core-only');
    expect(registry.presetsResolved).toBe(false);
    // The core rules still ship inside the package — they are not part of the degrade.
    expect(Object.keys(registry.rules)).toContain(
      'restricted-syntax-audit-exempt',
    );
    expect(Object.keys(registry.rules)).not.toContain(
      'no-server-imports-in-client',
    );
  });

  it('names every specifier it tried and why each failed', () => {
    const registry = degradedRegistry();
    expect(registry.skipped).toHaveLength(1);
    expect(registry.skipped[0].specifier).toContain(NO_BARREL);
    expect(registry.skipped[0].reason).toMatch(/MODULE_NOT_FOUND|Cannot find/);
  });

  it('classifies a preset rule as unresolvable only while the presets are unresolved', () => {
    const degraded = degradedRegistry();
    const resolved = resolvePluginRegistry({ cwd: NO_BARREL });
    expect(
      isUnresolvablePluginRule(
        'rules-as-tests/no-server-imports-in-client',
        degraded,
      ),
    ).toBe(true);
    // With the registry resolved, a missing plugin rule is a real finding (gate-conflict
    // FF3008), not a degrade — the resolver must not swallow it.
    expect(
      isUnresolvablePluginRule('rules-as-tests/does-not-exist', resolved),
    ).toBe(false);
    // A built-in ESLint rule never degrades — it needs no plugin.
    expect(isUnresolvablePluginRule('no-restricted-imports', degraded)).toBe(
      false,
    );
  });

  it('degradeFor names the gate, the rule and the concrete resolution failure (FF3022)', () => {
    const d = degradeFor(
      'tautology',
      'rules-as-tests/no-server-imports-in-client',
      degradedRegistry(),
      'G12',
    );
    expect(d.code).toBe('FF3022');
    expect(d.ruleId).toBe('G12');
    expect(d.reason).toContain('tautology');
    expect(d.reason).toContain('rules-as-tests/no-server-imports-in-client');
    expect(d.reason).toContain(CONSUMER_BARREL_SPECIFIER);
  });

  it('still produces a usable ESLint plugins block at the degraded tier', () => {
    const plugins = knownPlugins(degradedRegistry()) as {
      'rules-as-tests': { rules: Record<string, unknown> };
    };
    expect(Object.keys(plugins['rules-as-tests'].rules).length).toBeGreaterThan(
      0,
    );
  });
});

// The U10 defect itself, as a rule-as-test: a static import of an unpublishable package in a
// SHIPPED file crashes the `rules-as-tests-validate` bin at module load from a tarball. The
// freeze doc's table listed four such files; enumerating the whole directory found five
// (gate-autofix-clean.ts was missed), so this check enumerates rather than allowlists.
describe('no shipped validator file statically imports an unpublishable package', () => {
  const privateWorkspacePackages = readdirSync(resolve(HERE, '..', '..'), {
    withFileTypes: true,
  })
    .filter((e) => e.isDirectory())
    .map((e) => resolve(HERE, '..', '..', e.name, 'package.json'))
    .filter((p) => existsSync(p))
    .map((p) => JSON.parse(readFileSync(p, 'utf8')))
    .filter((pkg) => pkg.private === true)
    .map((pkg) => pkg.name as string)
    .filter((name) => name !== '@rules-as-tests/core');

  const shippedFiles = readdirSync(HERE).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
  );

  it('enumerated the population it checks (guards against a silently empty sweep)', () => {
    expect(privateWorkspacePackages).toContain(
      '@rules-as-tests/preset-next-15-canonical',
    );
    expect(shippedFiles.length).toBeGreaterThan(5);
  });

  it.each(shippedFiles)('%s', (file) => {
    const source = readFileSync(resolve(HERE, file), 'utf8');
    for (const pkg of privateWorkspacePackages) {
      const staticImport = new RegExp(
        `^\\s*import[^\\n]*from\\s+'${pkg.replace(/[/@-]/g, '\\$&')}(/[^']*)?';`,
        'm',
      );
      expect(
        staticImport.test(source),
        `${file} statically imports ${pkg}, which is "private": true and can never appear in a published tarball — the U10 crash. Resolve it through preset-plugin-resolver.ts instead.`,
      ).toBe(false);
    }
  });
});
