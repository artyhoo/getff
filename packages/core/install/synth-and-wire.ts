#!/usr/bin/env -S node --experimental-strip-types
/**
 * synth-and-wire.ts — deterministic synthesizer → install wiring entry point.
 *
 * Runs synthesize() for the detected stack, then calls wireNRules() to merge the
 * emitted rules-as-tests slice into the consumer's eslint.config.mjs. Idempotent:
 * if the preset template already contains all synthesized selectors (which principle 26
 * guarantees for in-sync templates), this is a fast no-op with no writes.
 *
 * Called from setup.d/99-finalize.sh BEFORE the R2-per-package wirer so the root
 * eslint.config is confirmed/updated first. R2 (no-unsafe-zod-parse) still uses its
 * own wirer (wire-eslint-r2.ts) for the bare→self-contained probe escalation.
 *
 * --own-config (operator decision Q4.7, 2026-09-28): the config is the CONSUMER's, not a getff
 * template. One write adds getff's whole block to it — the stack's rules, one global-ignores
 * element for the files getff delivered (--ignore), and R2 with its RULE_GLOBS block when the
 * install found an HTTP boundary (--r2-boundary) — as insertions only, then lint-probes it
 * (rolled back when it breaks ESLint). 99-finalize.sh keeps a copy of the original first.
 *
 * Usage (from consumer cwd, PKG_ROOT points to the framework checkout):
 *   npx --no-install tsx "$PKG_ROOT/packages/core/install/synth-and-wire.ts" \
 *       --stack react-next --path ./eslint.config.mjs [--dry-run]
 *
 * Prior-art: prior-art-evaluations.md#120 (install auto-wires R2 by reading repo),
 *            #131 (ts-morph REUSE), #135 (wirer BUILD).
 * @cc-only-rationale: runs in consumer context after install; the bash gate in
 *   99-finalize.sh is the primary gatekeeper.
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { loadEntries } from '../research/load.ts';
import { synthesize } from '../synthesizer/synthesize.ts';
import { ESLINT_RESTRICTED_RULE_NAME } from '../synthesizer/compile-declarative-md.ts';
import {
  customRulesImportSpecifier,
  formatLikeConsumer,
  probeLintViaEslint,
  wireNRules,
  wireOwnConfig,
  writeWithLintProbe,
  type WireResult,
} from './wire-eslint-r2.ts';

// ─── Canonical pattern sets per install stack ─────────────────────────────────
// Mirrors the WRAPPER_TEMPLATES in packages/core/principles/26-template-selector-sync.test.ts.
// Only patterns that produce eslint config entries for the consumer's root config (R12/R14/R20);
// opt-in runtime rules (R7/R8) and R2 are excluded (R2 uses its own wirer for probe escalation).
// ts-server has no qualifying patterns → synthesizer emits {} → fast idempotent no-op.
const STACK_PATTERNS: Record<string, { framework: string; version: string; patterns: string[] }> = {
  'react-next': {
    framework: 'next',
    version: '15.4.0',
    patterns: [
      'next-r12-no-server-imports-in-client',
      'next-r14-require-form-safe-parse',
      'next-r20-require-use-server-directive',
    ],
  },
};

/** Exit code meaning «ran, but the rules were NOT wired» — read by setup.d/99-finalize.sh. */
const NOT_WIRED_RC = 3;

/** Prefix of each «what did not land, and why» line; 99-finalize.sh copies them into its NOT wired summary. */
const NOT_WIRED_LINE = '  · not wired: ';

// ─── Preset rule scopes (critical-review S7-2) ─────────────────────────────────
// The files: each preset template gives its rules. A brownfield config keeps the consumer's own
// eslint.config.mjs (copy_safe), so the preset rules are APPENDED — and an unscoped append turned
// R20 on for every exported async function repo-wide. Mirrors RULE_GLOBS in
// packages/preset-next-15-canonical/templates/eslint.config.react.mjs; the drift guard is the
// «presetRuleScopes(react-next) mirrors the preset template» test in wire-synth-rules.test.ts.
// Live-research selectors merged into the wrapper share its scope, exactly as they do when they
// merge into the template's own boundary-scoped wrapper block.
const NEXT_BOUNDARY_GLOBS = [
  '**/app/**/actions/**/*.{ts,tsx}',
  '**/app/api/**/*.{ts,tsx}',
  '**/actions/**/*.{ts,tsx}',
  '**/features/*/api/**/*.{ts,tsx}',
];
const STACK_RULE_SCOPES: Record<string, Record<string, string[]>> = {
  'react-next': {
    'rules-as-tests/no-server-imports-in-client': ['**/*.{ts,tsx}'],
    [ESLINT_RESTRICTED_RULE_NAME]: NEXT_BOUNDARY_GLOBS,
  },
};

/** The preset's per-rule `files:` for `stack` (empty when the stack scopes nothing). */
export function presetRuleScopes(stack: string): Record<string, string[]> {
  return STACK_RULE_SCOPES[stack] ?? {};
}

// ─── Live-research augment-first merge ────────────────────────────────────────
// Union the deterministic preset-baseline rule set with the consumer's LIVE-research snippet
// (emitted to .ai-factory/synthesizer-output/eslint-rules-snippet.json by 80-rule-bootstrap),
// with LIVE precedence per rule-id — realising «live-research is the default delivery, presets
// the fallback baseline». Returns the merged rule set + the set of rule-ids whose live value
// must OVERRIDE the preset value already in the consumer config (D2 live-wins); the wrapper
// rule (restricted-syntax-audit-exempt) augments by selector-union, never override.

/**
 * Safe rule-id charset: letters, digits, @, /, _, - (standard ESLint plugin/rule naming).
 * Keys from the LLM-sourced live snippet are validated against this before use — a key outside
 * this set could break out of the string literal in the generated eslint.config.mjs (RCE).
 * NOTE: underscores (_) are in-charset, so `__proto__` PASSES this regex. The actual guard
 * against prototype-key attacks is `Object.create(null)` in readLiveSnippet (creates a null-
 * prototype object so `__proto__` is stored as an own data property, not a setter).
 */
const RULE_ID_SAFE = /^[A-Za-z0-9@/_-]+$/;

/** Union two restricted-syntax wrapper arrays by selector; live entry wins on selector collision. */
function unionWrapperSelectors(presetArr: unknown[], liveArr: unknown[]): unknown[] {
  const severity =
    typeof liveArr[0] === 'string'
      ? liveArr[0]
      : typeof presetArr[0] === 'string'
        ? presetArr[0]
        : 'error';
  const bySelector = new Map<string, unknown>();
  for (const e of presetArr.slice(1)) {
    const sel = (e as { selector?: string })?.selector;
    if (sel) bySelector.set(sel, e);
  }
  for (const e of liveArr.slice(1)) {
    const sel = (e as { selector?: string })?.selector;
    if (sel) bySelector.set(sel, e); // live overwrites the preset entry for the same selector
  }
  return [severity, ...bySelector.values()];
}

export function mergeLiveRules(
  presetRules: Record<string, unknown>,
  liveRules: Record<string, unknown>,
): { rules: Record<string, unknown>; overrideKeys: Set<string> } {
  const rules: Record<string, unknown> = { ...presetRules };
  const overrideKeys = new Set<string>();
  for (const [id, liveVal] of Object.entries(liveRules)) {
    if (!RULE_ID_SAFE.test(id)) {
      console.error(`  · synth-and-wire: live snippet — non-conforming rule-id '${id}' rejected`);
      continue;
    }
    if (!Object.hasOwn(presetRules, id)) {
      rules[id] = liveVal; // live-only rule — pure augment
      continue;
    }
    const presetVal = presetRules[id];
    if (Array.isArray(liveVal) && Array.isArray(presetVal)) {
      // Wrapper rule (e.g. ESLINT_RESTRICTED_RULE_NAME): union selectors, live wins per selector.
      // Augments via selector-union in the wirer — no override-replace needed.
      rules[id] = unionWrapperSelectors(presetVal, liveVal);
    } else {
      // Simple rule (or a shape change) sharing a preset rule-id → live wins; mark for override.
      rules[id] = liveVal;
      overrideKeys.add(id);
    }
  }
  return { rules, overrideKeys };
}

/**
 * Read + parse the live-research eslint snippet if present. Returns {} when the file is absent
 * (the byte-identical no-op gate) or unreadable/empty (degrade, never crash the install).
 */
function readLiveSnippet(snippetPath: string): Record<string, unknown> {
  if (!existsSync(snippetPath)) return {};
  try {
    const raw = readFileSync(snippetPath, 'utf8').trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const safe: Record<string, unknown> = Object.create(null);
      for (const [id, val] of Object.entries(parsed as Record<string, unknown>)) {
        if (!RULE_ID_SAFE.test(id)) {
          console.error(`  · synth-and-wire: live snippet — non-conforming rule-id '${id}' rejected (must match [A-Za-z0-9@/_-]+)`);
          continue;
        }
        safe[id] = val;
      }
      return safe;
    }
    console.error(`  · synth-and-wire: live snippet at ${snippetPath} is not a rules object — ignored`);
    return {};
  } catch (err) {
    console.error(
      `  · synth-and-wire: live snippet at ${snippetPath} unreadable (${(err as Error).message}) — using preset baseline only`,
    );
    return {};
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log([
      'synth-and-wire — run the deterministic synthesizer and wire emitted rules-as-tests rules',
      '                  into the consumer eslint.config.mjs',
      '',
      'Usage: npx tsx synth-and-wire.ts [options]',
      '  --stack <name>  Install stack identifier (react-next | ts-server | ...)',
      '  --path <file>   Config file to wire (default: ./eslint.config.mjs)',
      '  --dry-run       Print what would change; no writes',
      '  --own-config    The config is the consumer\'s own: add getff\'s block to it (insertions only)',
      '  --ignore <glob>        (--own-config, repeatable) a path getff delivered, added to one global ignores element',
      '  --r2-boundary <glob>   (--own-config, repeatable) RULE_GLOBS.boundary for R2; absent = R2 not added',
    ].join('\n'));
    process.exit(0);
  }

  const stackIdx = argv.indexOf('--stack');
  if (stackIdx < 0 || !argv[stackIdx + 1]) {
    console.error('  · synth-and-wire: --stack <name> is required');
    process.exit(0); // rc=0 — install must not abort
  }
  const stack = argv[stackIdx + 1];

  const pathIdx = argv.indexOf('--path');
  const configPath = resolve(pathIdx >= 0 ? argv[pathIdx + 1] : './eslint.config.mjs');
  const dryRun = argv.includes('--dry-run');

  // Live-research snippet path (D1). Default: <consumer-root>/.ai-factory/synthesizer-output/
  // eslint-rules-snippet.json, derived from the config's own directory (configPath lives at the
  // consumer root). Override with --snippet for tests / non-default layouts.
  const snippetIdx = argv.indexOf('--snippet');
  const snippetPath =
    snippetIdx >= 0
      ? resolve(argv[snippetIdx + 1])
      : resolve(dirname(configPath), '.ai-factory', 'synthesizer-output', 'eslint-rules-snippet.json');

  // Unknown-flag guard: catch mis-wired flags early rather than silently ignoring them
  // (the CLI's argv.indexOf approach swallows unrecognised flags — a mis-wired --store-root
  // would produce a silent green-lie no-op; this guard makes mis-wiring loud).
  const KNOWN_FLAGS = new Set([
    '--help', '-h', '--stack', '--path', '--dry-run', '--snippet', '--own-config', '--ignore', '--r2-boundary',
  ]);
  const VALUE_FLAGS = new Set(['--stack', '--path', '--snippet', '--ignore', '--r2-boundary']);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') || argv[i].startsWith('-')) {
      if (!KNOWN_FLAGS.has(argv[i])) {
        console.error(`  · synth-and-wire: unrecognised flag '${argv[i]}' — aborting (known: ${[...KNOWN_FLAGS].join(', ')})`);
        process.exit(0); // rc=0 — install must not abort
      }
      // skip the next arg if this flag consumes a value
      if (VALUE_FLAGS.has(argv[i])) i++;
    }
  }
  const ownConfig = argv.includes('--own-config');

  // Preset baseline: synthesize the stack's declared patterns. A stack with NO STACK_PATTERNS
  // entry (ts-server, react-native, react-spa, …) contributes no preset rules → synthRules = {},
  // but the LIVE-research snippet below can still wire — augment-first: live is the default
  // delivery, presets the fallback baseline. #827 B2: the read+merge of the live snippet MUST run
  // for an absent stackDef too, so the former early "no synthesizer pattern set" exit(0) (which
  // fired BEFORE the merge) no longer kills live delivery for every non-react-next stack.
  const stackDef = STACK_PATTERNS[stack];
  let synthRules: Record<string, unknown> = {};
  if (stackDef) {
    // Run the deterministic synthesizer (no LLM; no network — principle 17)
    console.debug(`  [synth-wire] DEBUG: synthesizing rules for stack '${stack}' (${stackDef.framework}@${stackDef.version})`);
    const entries = loadEntries(stackDef.framework, stackDef.version, stackDef.patterns);
    const plan = synthesize({
      framework: stackDef.framework,
      version: stackDef.version,
      patterns: entries,
      missing: [],
      drift: null,
    });
    synthRules = JSON.parse(plan.eslintConfigSnippet) as Record<string, unknown>;
  } else {
    console.log(`  [synth-wire] stack '${stack}' has no synthesizer pattern set — preset baseline empty; live-research snippet (if any) still wires`);
  }

  // ─── Augment-first: merge the LIVE-research snippet over the preset baseline (D1/D2) ──
  // The live snippet (when present) is the consumer's researched rules; it AUGMENTS the preset
  // baseline and OVERRIDES on rule-id collision (live is the default delivery). Gated on the
  // snippet FILE existing — absent ⇒ {} ⇒ mergedRules === synthRules ⇒ the byte-identical
  // capture path (no snippet) is wholly unchanged (§5).
  const liveRules = readLiveSnippet(snippetPath);
  const { rules: mergedRules, overrideKeys } = mergeLiveRules(synthRules, liveRules);
  if (Object.keys(liveRules).length > 0) {
    const newIds = Object.keys(liveRules).filter((id) => !(id in synthRules));
    const liveSelectors = Array.isArray(liveRules[ESLINT_RESTRICTED_RULE_NAME])
      ? (liveRules[ESLINT_RESTRICTED_RULE_NAME] as unknown[]).length - 1
      : 0;
    console.log(
      `  [synth-wire] live-research snippet found at ${snippetPath} — augmenting preset baseline ` +
        `(live precedence; ${newIds.length} new rule-id(s), ${overrideKeys.size} override(s), ${liveSelectors} live selector(s))`,
    );
  }

  // A consumer's own config still gets getff's ignores and R2 when the stack synthesizes no rules.
  if (Object.keys(mergedRules).length === 0 && !ownConfig) {
    console.log(`  [synth-wire] synthesizer emitted no rules for '${stack}' — no-op`);
    process.exit(0);
  }

  console.debug(`  [synth-wire] DEBUG: emitted ${Object.keys(mergedRules).length} rule(s): ${Object.keys(mergedRules).join(', ')}`);

  // S7-2: appended preset rules keep the preset's files: scope.
  const scopes = presetRuleScopes(stack);
  const scopeForStack = (key: string) => (scopes[key] ? { files: scopes[key] } : undefined);

  if (ownConfig) {
    process.exit(
      await wireIntoOwnConfig({
        configPath,
        dryRun,
        rules: mergedRules,
        overrideKeys,
        scopeFor: scopeForStack,
        ruleScopeGlobs: [...new Set(Object.keys(mergedRules).flatMap((key) => scopes[key] ?? []))],
        ignores: flagValues(argv, '--ignore'),
        boundaryGlobs: flagValues(argv, '--r2-boundary'),
      }),
    );
  }

  // Dry-run: check config existence and report what would happen, no writes
  if (dryRun) {
    if (!existsSync(configPath)) {
      console.log(`  [dry-run] [synth-wire] ${configPath} not found — would skip`);
    } else {
      const source = readFileSync(configPath, 'utf8');
      const result = await wireNRules(source, mergedRules, {
        overrideKeys,
        // #829: enable plugin self-registration for presets that don't pre-register `rules-as-tests`
        // (RN/ts-server). Resolved against the config's own dir → `./eslint-rules-local/index.mjs`
        // (40-configs.sh provisions it at the root AND per-workspace), so it works for both layouts.
        customRulesImportPath: customRulesImportSpecifier(configPath, dirname(configPath)),
        scopeFor: scopeForStack,
      });
      if (result.status === 'already-wired') {
        console.log(`  [dry-run] [synth-wire] all synthesized rules already present in ${configPath} (no change needed)`);
      } else {
        console.log(`  [dry-run] [synth-wire] would wire synthesized rules into ${configPath} (status: ${result.status})`);
      }
    }
    process.exit(0);
  }

  // Check config file
  if (!existsSync(configPath)) {
    console.log(`  [synth-wire] ${configPath} not found — skipped`);
    process.exit(0);
  }

  const source = readFileSync(configPath, 'utf8');
  const result = await wireNRules(source, mergedRules, {
    overrideKeys,
    // #829: see the dry-run site above — enables plugin self-registration for presets lacking it.
    customRulesImportPath: customRulesImportSpecifier(configPath, dirname(configPath)),
    scopeFor: scopeForStack,
  });

  // Post-write lint probe (critical-review wave 2): ESLint lints probe files against the written
  // config — one next to it plus one inside every appended block's files: scope; if the wiring made
  // the config unusable, the original bytes are restored and this reads as degrade.
  const scopeGlobs = [...new Set(Object.keys(mergedRules).flatMap((key) => scopes[key] ?? []))];
  const final =
    result.status === 'wired'
      ? await writeWithLintProbe({
          configPath,
          cwd: process.cwd(),
          original: source,
          modified: result.modified,
          runProbe: (p, c) => probeLintViaEslint(p, c, { scopeGlobs }),
        })
      : result;

  switch (final.status) {
    case 'already-wired':
      console.log(`  [synth-wire] ✓ all synthesized rules confirmed in ${configPath} (idempotent — no change)`);
      break;
    case 'wired':
      console.log(`  [synth-wire] ✓ synthesized rules wired into ${configPath}`);
      if (final.probeNote) console.log(`    (lint probe ${final.probeNote})`);
      break;
    // No «add it by hand» advice (Q4.7): a rolled-back wiring breaks ESLint just the same when added
    // by hand, so the output names what did not land and why, and 99-finalize.sh lists it.
    case 'degrade':
      console.log(`  · synth-and-wire: could not auto-wire (${final.degradeReason ?? 'unknown'}).`);
      printNotWired(`the stack's rules-as-tests rules in ${configPath} — ${reasonOf(final)}`);
      break;
    case 'unrecognised':
      printNotWired(`the stack's rules-as-tests rules in ${configPath} — ${reasonOf(final)}`);
      break;
  }

  // Exit NOT_WIRED_RC when the rules did not land, so 99-finalize.sh lists the config under
  // «NOT wired» instead of swallowing the message; every other outcome stays 0 (install never aborts).
  process.exit(final.status === 'degrade' || final.status === 'unrecognised' ? NOT_WIRED_RC : 0);
}

/** Every value of a repeatable flag, in order (`--ignore a --ignore b` → [a, b]). */
function flagValues(argv: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i] === flag) out.push(argv[++i]);
  }
  return out;
}

/** Print one NOT_WIRED_LINE: what did not land, and why, on one line. */
function printNotWired(what: string): void {
  console.log(`${NOT_WIRED_LINE}${what.replace(/\s+/g, ' ').slice(0, 300)}`);
}

/** Why a wirer step wrote nothing, on one line. */
function reasonOf(r: WireResult): string {
  if (r.status === 'degrade') return r.degradeReason ?? 'the AST editor could not run';
  return 'its export is not a flat-config array getff can append to (`export default [...]`, `export default tseslint.config(...)`, `export default defineConfig(...)`)';
}

/**
 * --own-config: add getff's block to a config the consumer owns in ONE write — the stack's rules
 * (wireNRules), then the machinery ignores and R2 (wireOwnConfig) — and lint-probe it. Returns the
 * exit code: 0 when everything asked for is in the config, NOT_WIRED_RC when any part is not, each
 * part named on a NOT_WIRED_LINE.
 */
async function wireIntoOwnConfig(a: {
  configPath: string;
  dryRun: boolean;
  rules: Record<string, unknown>;
  overrideKeys: Set<string>;
  scopeFor: (key: string) => { files: string[] } | undefined;
  ruleScopeGlobs: string[];
  ignores: string[];
  boundaryGlobs: string[];
}): Promise<number> {
  const { configPath } = a;
  if (!existsSync(configPath)) {
    console.log(`  [synth-wire] ${configPath} not found — skipped`);
    return 0;
  }
  const source = readFileSync(configPath, 'utf8');
  const customRulesImportPath = customRulesImportSpecifier(configPath, dirname(configPath));
  const notWired: string[] = [];
  let text = source;
  if (Object.keys(a.rules).length > 0) {
    const r = await wireNRules(text, a.rules, {
      overrideKeys: a.overrideKeys,
      customRulesImportPath,
      scopeFor: a.scopeFor,
      insertOnly: true,
    });
    if (r.status === 'wired') text = r.modified;
    else if (r.status !== 'already-wired') notWired.push(`the stack's rules-as-tests rules — ${reasonOf(r)}`);
    notWired.push(...(r.notes ?? [])); // rules the consumer already sets keep the consumer's value
  }
  // The install runs from the project root; check-rule-globs.sh reads RULE_GLOBS from the config there only.
  // Real paths: on macOS the cwd reads /private/var/… where the --path given reads /var/….
  const gateReadsRuleGlobs = realpathSync(dirname(resolve(configPath))) === realpathSync(process.cwd());
  const own = await wireOwnConfig(text, { ignores: a.ignores, boundaryGlobs: a.boundaryGlobs, customRulesImportPath, gateReadsRuleGlobs });
  if (own.status === 'wired') text = own.modified;
  else if (own.status !== 'already-wired') notWired.push(`getff's ignores and R2 — ${reasonOf(own)}`);
  notWired.push(...(own.notes ?? []));
  if (text !== source) text = await formatLikeConsumer(configPath, process.cwd(), source, text);

  let rc = 0;
  if (text === source) {
    if (notWired.length === 0) console.log(`  [synth-wire] ✓ getff's block is already in ${configPath} (no change)`);
  } else if (a.dryRun) {
    console.log(`  [dry-run] [synth-wire] would add getff's block to ${configPath} (insertions only)`);
  } else {
    const final = await writeWithLintProbe({
      configPath,
      cwd: process.cwd(),
      original: source,
      modified: text,
      runProbe: (p, c) => probeLintViaEslint(p, c, { scopeGlobs: [...new Set([...a.ruleScopeGlobs, ...a.boundaryGlobs])] }),
    });
    if (final.status === 'wired') {
      console.log(`  [synth-wire] ✓ getff's block added to ${configPath}`);
      if (final.probeNote) console.log(`    (lint probe ${final.probeNote})`);
    } else {
      notWired.unshift(`getff's block in ${configPath} — ${reasonOf(final)}`);
    }
  }
  for (const n of notWired) {
    printNotWired(n);
    rc = NOT_WIRED_RC;
  }
  return rc;
}

// Only run as CLI; when imported as a module, skip main() (allows unit-testing imports)
// Matches both the .ts source (tsx invocation) and the .bundle.mjs precompiled artifact.
if (
  process.argv[1] &&
  (process.argv[1].endsWith('synth-and-wire.ts') || process.argv[1].endsWith('synth-and-wire.bundle.mjs'))
) {
  main().catch((err) => {
    console.error('synth-and-wire fatal:', err);
    process.exit(0); // rc=0 — install must not abort
  });
}
