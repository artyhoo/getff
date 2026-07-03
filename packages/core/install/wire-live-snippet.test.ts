/**
 * wire-live-snippet.test.ts — the live-research-default-delivery oracle (kickoff §6, T15).
 *
 * THIS is the non-vacuous live-path proof (principle 28 stays recipe-sourced + unmodified — §4).
 * It exercises the real disconnect-fix path end-to-end, $0/no-network:
 *   (1) build the LIVE snippet deterministically from the committed no-head-element fixtures via
 *       synthesizeGenerate(FileResearchClient, FileGenerateClient) — the same builder the live
 *       install path uses (rule-bootstrap-live.test.ts);
 *   (2) build the preset baseline rule set from the react-next recipes (as principle 28 does);
 *   (3) mergeLiveRules(preset, live) — the augment-first union with live precedence;
 *   (4) wireNRules(presetTemplateSource, merged, { overrideKeys }) — REUSE the ts-morph wirer.
 *
 * Three arms, each able to fail (T-LRD-A «green-but-inert»):
 *   Positive   — the generated no-head selector lands in the config AND the preset R12/R14/R20
 *                are retained (augment, not replace).
 *   Negative 1 — absent/empty snippet ⇒ merged == preset ⇒ already-wired byte-identical
 *                (this is what keeps the §5 byte-identical baselines green).
 *   Negative 2 — a live rule reusing R12's id with a different value ⇒ the merged config carries
 *                the LIVE value (D2 live-wins); the paired-negative (no overrideKeys) proves the
 *                override path — not presence-only wiring — is what flips it.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadEntries } from '../research/load.ts';
import { synthesize } from '../synthesizer/synthesize.ts';
import { synthesizeGenerate } from '../synthesizer/generate.ts';
import { FileResearchClient, FileGenerateClient, withManualDrop } from '../synthesizer/file-clients.ts';
import { wireNRules } from './wire-eslint-r2.ts';
import { mergeLiveRules } from './synth-and-wire.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');
const TEMPLATE = resolve(REPO_ROOT, 'packages/preset-next-15-canonical/templates/eslint.config.react.mjs');
const RESEARCH = resolve(HERE, '../synthesizer/fixtures/no-head-element.research.json');
const SELECTION = resolve(HERE, '../synthesizer/fixtures/no-head-element.selection.json');

const TS_MORPH_AVAILABLE =
  existsSync(resolve(REPO_ROOT, 'node_modules/ts-morph/package.json')) ||
  existsSync(resolve(REPO_ROOT, 'packages/core/node_modules/ts-morph/package.json'));

const BUNDLE = resolve(HERE, 'synth-and-wire.bundle.mjs');
const RN_SELECTOR = "MemberExpression[object.name='localStorage']";

const R12 = 'rules-as-tests/no-server-imports-in-client';
const HEAD_SELECTOR = "JSXOpeningElement[name.name='head']";
const R14_SELECTOR_FRAGMENT = "callee.property.name='safeParse'";
const R20_SELECTOR_FRAGMENT = "Literal[value='use server']";

/** Preset baseline rule set — react-next recipes (mirrors principle 28 ORACLE_CONFIG). */
function presetRules(): Record<string, unknown> {
  const entries = loadEntries('next', '15.4.0', [
    'next-r12-no-server-imports-in-client',
    'next-r14-require-form-safe-parse',
    'next-r20-require-use-server-directive',
  ]);
  const plan = synthesize({ framework: 'next', version: '15.4.0', patterns: entries, missing: [], drift: null });
  return JSON.parse(plan.eslintConfigSnippet) as Record<string, unknown>;
}

/** LIVE snippet rules built from the committed no-head-element fixtures ($0, no network). */
async function liveSnippetRules(): Promise<Record<string, unknown>> {
  const researchClient = new FileResearchClient(RESEARCH);
  const generateClient = withManualDrop(new FileGenerateClient(SELECTION), () => {});
  const plan = await researchClient.research({} as never);
  const synthPlan = await synthesizeGenerate(plan, generateClient);
  return JSON.parse(synthPlan.eslintConfigSnippet) as Record<string, unknown>;
}

describe('live-research-default-delivery — wire the live snippet into the preset config', () => {
  it('fixtures + preset template exist (non-vacuous)', () => {
    expect(existsSync(TEMPLATE)).toBe(true);
    expect(existsSync(RESEARCH)).toBe(true);
    expect(existsSync(SELECTION)).toBe(true);
  });

  it('the live snippet genuinely carries the no-head selector (oracle source is real)', async () => {
    const live = await liveSnippetRules();
    expect(JSON.stringify(live)).toContain(HEAD_SELECTOR);
  });

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Positive (augment) — generated no-head selector lands AND preset R12/R14/R20 retained',
    async () => {
      const preset = presetRules();
      const live = await liveSnippetRules();
      const { rules: merged, overrideKeys } = mergeLiveRules(preset, live);

      const templateSource = readFileSync(TEMPLATE, 'utf8');
      const result = await wireNRules(templateSource, merged, { overrideKeys });

      expect(result.status).toBe('wired');
      // The live rule landed — literal selector present (T-LRD-A: not merely "the step ran").
      expect(result.modified).toContain(HEAD_SELECTOR);
      // Presets retained (augment, not replace).
      expect(result.modified).toContain(`'${R12}'`);
      expect(result.modified).toContain(R14_SELECTOR_FRAGMENT);
      expect(result.modified).toContain(R20_SELECTOR_FRAGMENT);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Negative 1 (absent snippet) — merged == preset ⇒ already-wired byte-identical',
    async () => {
      const preset = presetRules();
      const { rules: merged, overrideKeys } = mergeLiveRules(preset, {});
      const templateSource = readFileSync(TEMPLATE, 'utf8');
      const result = await wireNRules(templateSource, merged, { overrideKeys });

      expect(result.status).toBe('already-wired');
      expect(result.modified).toBe(templateSource);
      // The live-only selector must NOT have appeared.
      expect(result.modified).not.toContain(HEAD_SELECTOR);
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Negative 2 (override / D2 live-wins) — live R12 value overrides the preset value',
    async () => {
      const preset = presetRules();
      // A live rule reusing R12's id with a different value (severity flip).
      const live = { [R12]: 'warn' };
      const { rules: merged, overrideKeys } = mergeLiveRules(preset, live);
      expect(overrideKeys.has(R12)).toBe(true);

      const templateSource = readFileSync(TEMPLATE, 'utf8');
      const result = await wireNRules(templateSource, merged, { overrideKeys });

      expect(result.status).toBe('wired');
      // The R12 block now carries the LIVE value.
      expect(result.modified).toMatch(new RegExp(`${R12}'\\s*:\\s*["']warn["']`));
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Negative 2 paired-negative — WITHOUT overrideKeys the preset R12 value is kept (non-vacuity)',
    async () => {
      const templateSource = readFileSync(TEMPLATE, 'utf8');
      // Same live value, but drop overrideKeys → presence-only wiring keeps the preset 'error'.
      const result = await wireNRules(templateSource, { [R12]: 'warn' }, {});
      expect(result.status).toBe('already-wired');
      expect(result.modified).toBe(templateSource);
      expect(result.modified).not.toMatch(new RegExp(`${R12}'\\s*:\\s*["']warn["']`));
    },
  );
});

describe('security — rule-id key validation (injection prevention)', () => {
  it('mergeLiveRules rejects keys outside [A-Za-z0-9@/_-]+ charset', () => {
    const preset = { [R12]: 'error' };
    // "bad'key" and "has space" are rejected by RULE_ID_SAFE (chars outside the charset).
    // "__proto__" NOTE: underscores ARE in-charset so RULE_ID_SAFE does NOT reject it.
    // The test still passes because JS object-literal semantics mean { '__proto__': v }
    // modifies the prototype rather than creating an own property named '__proto__', so
    // Object.entries({ '__proto__': 'error' }) returns [] — the key never reaches mergeLiveRules.
    // The guard in readLiveSnippet (Object.create(null)) handles the JSON.parse path.
    const malicious = { "bad'key": 'warn', 'has space': 'error', '__proto__': 'error' };
    const { rules } = mergeLiveRules(preset, malicious as Record<string, unknown>);
    expect(Object.keys(rules)).not.toContain("bad'key");
    expect(Object.keys(rules)).not.toContain('has space');
    expect(Object.keys(rules)).not.toContain('__proto__');
  });

  it('mergeLiveRules accepts conforming keys (rule-id safe charset)', () => {
    const preset = {};
    const conforming = {
      'plugin/rule-name': 'error',
      '@scope/package/rule': 'warn',
      'no-unused-vars': 'off',
    };
    const { rules } = mergeLiveRules(preset, conforming);
    expect(Object.keys(rules)).toContain('plugin/rule-name');
    expect(Object.keys(rules)).toContain('@scope/package/rule');
    expect(Object.keys(rules)).toContain('no-unused-vars');
  });

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'Negative 3 (injection-resilience) — backslash in live value does not break generated config',
    async () => {
      const preset = presetRules();
      // A live rule reusing R12's id with a value containing a trailing backslash — the exact
      // character that previously caused `'${value}'` to emit `'warn\'` (an invalid JS string
      // literal: the \\ escapes the closing quote, leaving trailing code outside the string).
      // With jsString fixed (falls back to JSON.stringify), the value is emitted as `"warn\\"`.
      const live = { [R12]: 'warn\\' };
      const { rules: merged, overrideKeys } = mergeLiveRules(preset, live);
      expect(overrideKeys.has(R12)).toBe(true);

      const templateSource = readFileSync(TEMPLATE, 'utf8');
      const result = await wireNRules(templateSource, merged, { overrideKeys });

      expect(result.status).toBe('wired');
      // The backslash must be escaped in the emitted literal: "warn\\" (two chars: w,a,r,n,\).
      // A raw unescaped \ at this position would leave eslint.config.mjs unparseable.
      expect(result.modified).toContain('"warn\\\\"');
      // Paired-negative: must NOT contain the broken unescaped form.
      expect(result.modified).not.toContain("'warn\\'");
    },
  );
});

describe('#827 B2 — live snippet wires for a stack with NO STACK_PATTERNS entry (CLI control-flow)', () => {
  // These exercise the SHIPPED bundle's main() control flow, not just mergeLiveRules: the B2 bug was
  // an early `process.exit(0)` ("no synthesizer pattern set") that fired BEFORE the live-snippet
  // merge for any stack absent from STACK_PATTERNS (ts-server / react-native / react-spa). The unit
  // tests above prove mergeLiveRules({}, live) === live; they do NOT prove main() reaches the merge.
  // Spawning the bundle (the artifact 99-finalize.sh runs via plain node) is the faithful proof.
  // cwd = REPO_ROOT so the bundle's externalised ts-morph (wireNRules) resolves, as in 99-finalize.

  const run = (cfg: string, snippet: string) =>
    execFileSync('node', [BUNDLE, '--stack', 'react-native', '--path', cfg, '--snippet', snippet], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      // Anchor the bundle's fs-based schema reads (import.meta.url collapses to install/ under
      // bundling, #755) — the same env var 99-finalize.sh:34 sets when it runs the bundle.
      env: { ...process.env, AIF_SYNTH_PKG_ROOT: resolve(REPO_ROOT, 'packages/core') },
    });

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'positive — react-native (no preset patterns) + live snippet ⇒ the live selector wires',
    () => {
      const dir = mkdtempSync(resolve(tmpdir(), 'b2-pos-'));
      const cfg = resolve(dir, 'eslint.config.mjs');
      copyFileSync(TEMPLATE, cfg);
      const snippet = resolve(dir, 'snippet.json');
      writeFileSync(
        snippet,
        JSON.stringify({
          'rules-as-tests/restricted-syntax-audit-exempt': [
            'error',
            { selector: RN_SELECTOR, message: 'no web localStorage in RN' },
          ],
        }),
      );
      try {
        run(cfg, snippet);
        // B2: the live RN selector landed even though react-native has no STACK_PATTERNS entry.
        // Under the pre-fix early-exit this would be ABSENT (the merge was never reached).
        expect(readFileSync(cfg, 'utf8')).toContain(RN_SELECTOR);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'negative — react-native + absent snippet ⇒ byte-identical no-op (preserves §5 baselines)',
    () => {
      const dir = mkdtempSync(resolve(tmpdir(), 'b2-neg-'));
      const cfg = resolve(dir, 'eslint.config.mjs');
      copyFileSync(TEMPLATE, cfg);
      const before = readFileSync(cfg, 'utf8');
      try {
        run(cfg, resolve(dir, 'does-not-exist.json'));
        const after = readFileSync(cfg, 'utf8');
        expect(after).toBe(before); // empty preset + absent snippet ⇒ {} ⇒ no write
        expect(after).not.toContain(RN_SELECTOR);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

describe('#829 — shipped bundle self-registers the rules-as-tests plugin when the base config lacks it', () => {
  // Faithful end-to-end proof of the PRODUCTION path: spawn the shipped bundle (what 99-finalize.sh
  // runs via plain node), wiring a live `rules-as-tests/*` rule into a config that does NOT register
  // the plugin (RN/ts-server preset shape). Pre-#829 the block was emitted bare → ESLint errored
  // "could not find plugin 'rules-as-tests'" and the rule never fired. Post-fix the bundle injects
  // `import customRules` + `plugins: { 'rules-as-tests': customRules }` so the plugin resolves.
  const run = (cfg: string, snippet: string) =>
    execFileSync('node', [BUNDLE, '--stack', 'react-native', '--path', cfg, '--snippet', snippet], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      env: { ...process.env, AIF_SYNTH_PKG_ROOT: resolve(REPO_ROOT, 'packages/core') },
    });

  it.skipIf(!TS_MORPH_AVAILABLE)(
    'positive — unregistered config + live rules-as-tests rule ⇒ plugin self-registered (import + plugins)',
    () => {
      const dir = mkdtempSync(resolve(tmpdir(), 'b829-pos-'));
      const cfg = resolve(dir, 'eslint.config.mjs');
      // Unregistered config: empty flat-config array — no `plugins: { 'rules-as-tests' }`, no import.
      writeFileSync(cfg, `export default [];\n`);
      const snippet = resolve(dir, 'snippet.json');
      writeFileSync(
        snippet,
        JSON.stringify({
          'rules-as-tests/restricted-syntax-audit-exempt': [
            'error',
            { selector: RN_SELECTOR, message: 'no web localStorage in RN' },
          ],
        }),
      );
      try {
        run(cfg, snippet);
        const out = readFileSync(cfg, 'utf8');
        expect(out).toContain(RN_SELECTOR); // the live rule wired
        // #829: the new block self-registers the plugin so ESLint resolves it (vs the pre-fix bare block).
        expect(out).toContain(`plugins: { 'rules-as-tests': customRules }`);
        expect(out).toMatch(/import customRules from ['"]\.\/eslint-rules-local\/index\.mjs['"]/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(!TS_MORPH_AVAILABLE)(
    '❌ paired-negative: a config that ALREADY registers stays single-registration (no duplicate import)',
    () => {
      const dir = mkdtempSync(resolve(tmpdir(), 'b829-neg-'));
      const cfg = resolve(dir, 'eslint.config.mjs');
      // Already-registered config (react-next shape): must NOT gain a second customRules import.
      writeFileSync(
        cfg,
        [
          `import customRules from './eslint-rules-local/index.mjs';`,
          `export default [`,
          `  { plugins: { 'rules-as-tests': customRules }, rules: {} },`,
          `];`,
          ``,
        ].join('\n'),
      );
      const snippet = resolve(dir, 'snippet.json');
      writeFileSync(
        snippet,
        JSON.stringify({
          'rules-as-tests/restricted-syntax-audit-exempt': [
            'error',
            { selector: RN_SELECTOR, message: 'no web localStorage in RN' },
          ],
        }),
      );
      try {
        run(cfg, snippet);
        const out = readFileSync(cfg, 'utf8');
        expect(out).toContain(RN_SELECTOR); // still wired
        // detection holds: no SECOND registration / import injected on an already-registered config
        expect((out.match(/import customRules from/g) ?? []).length).toBe(1);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
