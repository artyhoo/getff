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
 * Usage (from consumer cwd, PKG_ROOT points to the framework checkout):
 *   npx --no-install tsx "$PKG_ROOT/packages/core/install/synth-and-wire.ts" \
 *       --stack react-next --path ./eslint.config.mjs [--dry-run]
 *
 * Prior-art: prior-art-evaluations.md#120 (install auto-wires R2 by reading repo),
 *            #131 (ts-morph REUSE), #135 (wirer BUILD).
 * @cc-only-rationale: runs in consumer context after install; the bash gate in
 *   99-finalize.sh is the primary gatekeeper.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { loadEntries } from '../research/load.ts';
import { synthesize } from '../synthesizer/synthesize.ts';
import { ESLINT_RESTRICTED_RULE_NAME } from '../synthesizer/compile-declarative-md.ts';
import { customRulesImportSpecifier, wireNRules } from './wire-eslint-r2.ts';

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
  const KNOWN_FLAGS = new Set(['--help', '-h', '--stack', '--path', '--dry-run', '--snippet']);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') || argv[i].startsWith('-')) {
      if (!KNOWN_FLAGS.has(argv[i])) {
        console.error(`  · synth-and-wire: unrecognised flag '${argv[i]}' — aborting (known: ${[...KNOWN_FLAGS].join(', ')})`);
        process.exit(0); // rc=0 — install must not abort
      }
      // skip the next arg if this flag consumes a value
      if (argv[i] === '--stack' || argv[i] === '--path' || argv[i] === '--snippet') i++;
    }
  }

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

  if (Object.keys(mergedRules).length === 0) {
    console.log(`  [synth-wire] synthesizer emitted no rules for '${stack}' — no-op`);
    process.exit(0);
  }

  console.debug(`  [synth-wire] DEBUG: emitted ${Object.keys(mergedRules).length} rule(s): ${Object.keys(mergedRules).join(', ')}`);

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
  });

  switch (result.status) {
    case 'already-wired':
      console.log(`  [synth-wire] ✓ all synthesized rules confirmed in ${configPath} (idempotent — no change)`);
      break;
    case 'wired':
      writeFileSync(configPath, result.modified, 'utf8');
      console.log(`  [synth-wire] ✓ synthesized rules wired into ${configPath}`);
      break;
    case 'degrade':
      console.log(
        `  · synth-and-wire: could not auto-wire (${result.degradeReason ?? 'unknown'}).` +
        `\n    Add the rules-as-tests slice manually to ${configPath}:` +
        `\n    (run \`npx tsx synth-and-wire.ts --stack ${stack} --dry-run\` to preview)`,
      );
      break;
    case 'unrecognised':
      console.log(
        `  · synth-and-wire: unrecognised export shape in ${configPath} — add rules-as-tests slice manually.`,
      );
      break;
  }

  process.exit(0);
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
