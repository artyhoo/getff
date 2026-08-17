// L4 shared plugin-rule registry resolution (U10 ratified fix, option b — 2026-08-17).
//
// WHY THIS EXISTS. Five shipped gates (gate-tautology, gate-conflict, gate-rule-tester,
// gate-message-id-coverage, gate-autofix-clean) need the `rules-as-tests` ESLint plugin
// registry. They used to reach it through a STATIC import of
// `@rules-as-tests/preset-next-15-canonical/eslint-rules` (+ preset-react-spa in
// gate-rule-tester) — packages that carry `"private": true` and therefore can never appear
// in a published `@getff/core` tarball. A static import that cannot resolve crashes the
// module at load, so the shipped `rules-as-tests-validate` bin was unrunnable from a tarball
// even with every dev-dependency promoted (docs/meta-factory/getff-name-architecture-freeze.md,
// «U10 WARNING»). Ratified resolution: dynamic resolution with an honest degrade.
//
// RESOLUTION ORDER (mirrors the shipped ts-morph degrade at install/wire-eslint-r2.ts:115-143):
//   (i)  the CONSUMER's vendored barrel `<cwd>/eslint-rules-local/index.mjs` — what install.sh
//        generates (setup.d/lib.sh generate_eslint_barrel), a single plugin object whose
//        `rules` map unions the core rules with this stack's preset rules;
//   (ii) the workspace packages — keeps the monorepo/CI path working unchanged;
//   (iii) honest degrade — `presetsResolved: false`, with `skipped` naming every specifier
//        tried and the concrete failure. Callers turn that into a `degrade` GateOutcome,
//        never a crash and never a silent pass.
//
// The (i) anchor is `createRequire(resolve(cwd, 'package.json'))`, NOT this file's directory:
// the shipped bin runs from the framework's own node_modules with cwd = consumer root, so
// framework-anchored resolution would miss the consumer's freshly vendored barrel and falsely
// degrade (the GH #642 lesson recorded at wire-eslint-r2.ts:124-129). The anchor file itself
// need not exist — `createRequire` only needs a path to resolve relatively from.
//
// Resolution is SYNCHRONOUS (`createRequire`), deliberately: `validate()` / `install()` are
// shipped synchronous APIs and a dynamic `import()` would have forced them async. `require()`
// of the `.mjs` barrel uses Node's require(esm) (Node >= 22.12; `engines.node` is `>=22`) —
// on an older Node it throws ERR_REQUIRE_ESM, which lands in the (iii) degrade like any other
// resolution failure rather than crashing.
//
// NOT memoized: `cwd` is read per call so a consumer that vendors the barrel mid-session (and
// the paired-negative tests) see the current state. Node's own require cache makes repeat hits
// cheap.

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import corePlugin from '../eslint-rules/index.ts';
import type { GateDegrade, GateFailure, GateOutcome } from './types.ts';

/** The single plugin namespace every synthesized plugin-rule reference uses. */
export const PRESET_PREFIX = 'rules-as-tests/';

/** What install.sh vendors into the consumer root (setup.d/lib.sh generate_eslint_barrel). */
export const CONSUMER_BARREL_SPECIFIER = './eslint-rules-local/index.mjs';

/** Workspace packages tried after the barrel. Both carry `"private": true` — absent from a tarball. */
export const WORKSPACE_PRESET_SPECIFIERS = [
  '@rules-as-tests/preset-next-15-canonical/eslint-rules',
  '@rules-as-tests/preset-react-spa/eslint-rules',
] as const;

export interface PresetResolutionOptions {
  /** Consumer-barrel anchor. Defaults to `process.cwd()` — the consumer root under the shipped bin. */
  cwd?: string;
  /**
   * Workspace specifiers for tier (ii). Defaults to WORKSPACE_PRESET_SPECIFIERS. Tests pass `[]`
   * to reproduce a published tarball, where these packages are absent by construction — the only
   * way to exercise tier (iii) from inside the monorepo, which always has them on disk.
   */
  workspaceSpecifiers?: readonly string[];
}

export interface PluginRegistry {
  /** bare rule name → ESLint rule module, for the `rules-as-tests` namespace. */
  rules: Record<string, unknown>;
  /** Where the preset rules came from — `core-only` means tier (iii): degraded. */
  source: 'consumer-barrel' | 'workspace-presets' | 'core-only';
  /** Specifiers that loaded, in resolution order. */
  resolvedFrom: string[];
  /** Every specifier that did not load, with the concrete reason. */
  skipped: { specifier: string; reason: string }[];
  /** false ⇒ only the tarball-resident core rules are known; plugin-rule checks must degrade. */
  presetsResolved: boolean;
}

function rulesOf(mod: unknown): Record<string, unknown> | null {
  const ns = mod as { default?: { rules?: unknown }; rules?: unknown } | null;
  const rules = ns?.default?.rules ?? ns?.rules;
  if (!rules || typeof rules !== 'object') return null;
  return rules as Record<string, unknown>;
}

function reasonOf(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const code = e?.code ? `${e.code}: ` : '';
  return `${code}${(e?.message ?? String(err)).split('\n')[0]}`;
}

/**
 * Resolve the `rules-as-tests` rule registry: core rules (always present — they ship inside
 * the package) unioned with the preset rules from tier (i) or tier (ii).
 */
export function resolvePluginRegistry(
  opts: PresetResolutionOptions = {},
): PluginRegistry {
  const cwd = opts.cwd ?? process.cwd();
  const workspaceSpecifiers =
    opts.workspaceSpecifiers ?? WORKSPACE_PRESET_SPECIFIERS;
  const coreRules = { ...corePlugin.rules } as Record<string, unknown>;
  const skipped: { specifier: string; reason: string }[] = [];

  // (i) consumer barrel — anchored at the CONSUMER cwd, not at this file.
  const barrelLabel = `${CONSUMER_BARREL_SPECIFIER} (from ${cwd})`;
  try {
    const requireFromCwd = createRequire(resolve(cwd, 'package.json'));
    const barrel = requireFromCwd(
      requireFromCwd.resolve(CONSUMER_BARREL_SPECIFIER),
    );
    const rules = rulesOf(barrel);
    if (!rules) throw new Error('barrel exports no `rules` map');
    return {
      rules: { ...coreRules, ...rules },
      source: 'consumer-barrel',
      resolvedFrom: [barrelLabel],
      skipped,
      presetsResolved: true,
    };
  } catch (err) {
    skipped.push({ specifier: barrelLabel, reason: reasonOf(err) });
  }

  // (ii) workspace packages — resolved from THIS file (the framework tree is the workspace).
  const requireFromHere = createRequire(import.meta.url);
  const resolvedFrom: string[] = [];
  let presetRules: Record<string, unknown> = {};
  for (const specifier of workspaceSpecifiers) {
    try {
      const rules = rulesOf(requireFromHere(specifier));
      if (!rules) throw new Error('package exports no `rules` map');
      presetRules = { ...presetRules, ...rules };
      resolvedFrom.push(specifier);
    } catch (err) {
      skipped.push({ specifier, reason: reasonOf(err) });
    }
  }
  if (resolvedFrom.length > 0) {
    return {
      rules: { ...coreRules, ...presetRules },
      source: 'workspace-presets',
      resolvedFrom,
      skipped,
      presetsResolved: true,
    };
  }

  // (iii) degrade — core rules only. Callers report `degrade`, never `pass` and never a crash.
  return {
    rules: coreRules,
    source: 'core-only',
    resolvedFrom,
    skipped,
    presetsResolved: false,
  };
}

/** `plugins` block for a flat ESLint config built from a resolved registry. */
export function knownPlugins(registry: PluginRegistry): Record<string, unknown> {
  return { 'rules-as-tests': { rules: registry.rules } };
}

/**
 * true when `ruleName` names a `rules-as-tests/*` rule the registry cannot supply AND the
 * presets are unresolved — i.e. the check cannot run for a reason that is environmental, not
 * a defect in the plan. A missing plugin rule with the presets RESOLVED is a real finding
 * (gate-conflict FF3008), not a degrade, so this returns false there.
 */
export function isUnresolvablePluginRule(
  ruleName: string,
  registry: PluginRegistry,
): boolean {
  if (registry.presetsResolved) return false;
  if (!ruleName.startsWith(PRESET_PREFIX)) return false;
  return !(ruleName.slice(PRESET_PREFIX.length) in registry.rules);
}

/** The FF3022 degrade record for one skipped rule — names what was skipped and why. */
export function degradeFor(
  gate: string,
  ruleName: string,
  registry: PluginRegistry,
  ruleId?: string,
): GateDegrade {
  const tried = registry.skipped
    .map((s) => `${s.specifier} — ${s.reason}`)
    .join('; ');
  return {
    ruleId,
    code: 'FF3022',
    reason:
      `${gate} skipped rule '${ruleName}': the 'rules-as-tests' plugin registry could not be ` +
      `resolved, so the check cannot run. Tried: ${tried}. Install the framework into the ` +
      `project (which vendors eslint-rules-local/) or run the gate from the framework workspace.`,
  };
}

/**
 * Gate outcome from the two channels. Real failures win over degrades (a degraded gate that
 * still found a defect is a failing gate); a degrade-only gate reports `degrade`, never `pass`.
 * `degraded` is omitted when empty so unaffected outcomes stay byte-identical to before.
 */
export function gateOutcome(
  failures: GateFailure[],
  degraded: GateDegrade[],
): GateOutcome {
  if (failures.length > 0) {
    return degraded.length > 0
      ? { status: 'fail', failures, degraded }
      : { status: 'fail', failures };
  }
  if (degraded.length > 0) return { status: 'degrade', failures: [], degraded };
  return { status: 'pass', failures: [] };
}
