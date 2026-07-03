#!/usr/bin/env -S node --experimental-strip-types
/**
 * wire-eslint-r2.ts — GH #547 Layer 2 (migration-ast Stage 4)
 * AST-wires R2 (rules-as-tests/no-unsafe-zod-parse) into a consumer's ESLint
 * flat-config (.mjs). Uses ts-morph for targeted minimal-edit with format
 * preservation (Fixture E invariant: unchanged lines are byte-identical).
 *
 * Ensure-then-use: install.sh's bash probe checks node AND the consumer's
 * node_modules/ts-morph BEFORE calling this script. Both that probe and this
 * module's :86 import resolve ts-morph from the consumer's cwd, NOT the framework
 * checkout this file lives in (GH #642). The import still degrades gracefully on
 * failure as a belt-and-suspenders (genuine consumer-absence path).
 *
 * @cc-only-rationale: runs in consumer context after --full dep-install; the
 *   bash probe is the primary gatekeeper; this degrade is secondary belt.
 *
 * Prior-art: prior-art-evaluations.md#131 (ts-morph REUSE),
 *            prior-art-evaluations.md#132 (cargo format-preservation REFERENCE),
 *            prior-art-evaluations.md#133 (astro/shadcn UX ADOPT VOCABULARY),
 *            prior-art-evaluations.md#134 (magicast REJECT as engine),
 *            prior-art-evaluations.md#135 (this wirer BUILD),
 *            prior-art-evaluations.md#117 (--wire-ci posture ADOPT),
 *            prior-art-evaluations.md#118 (check:enforced oracle ADOPT)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const R2_RULE_ID = 'rules-as-tests/no-unsafe-zod-parse';

export type TransformVariant = 'bare' | 'self-contained';
export interface TransformOpts {
  variant?: TransformVariant;
  customRulesImportPath?: string; // required when variant === 'self-contained'
  /** When provided, emits `{ files: [...], rules: {...} }` — workspace-scoped block. */
  scope?: { files: string[] };
  /**
   * Live-wins override set (D2). Rule-ids in this set REPLACE an existing simple-rule value in
   * the config (rather than the default append-if-missing, which keeps the preset). Used by the
   * live-research augment-first path so a live rule sharing a preset rule-id is authoritative.
   */
  overrideKeys?: Set<string>;
}

function r2Element(variant: TransformVariant, scope?: { files: string[] }): string {
  // SSOT #182: files: scoped emission — when scope provided, emit workspace-scoped block.
  // Scope source = install-time dir→stack map, NOT recipe appliesTo (T-MS-A).
  // jsString() prevents code-injection when glob contains a single quote (T-MSA-sec).
  const filesPart = scope ? `files: [${scope.files.map((f) => jsString(f)).join(', ')}], ` : '';
  return variant === 'self-contained'
    ? `{ ${filesPart}plugins: { 'rules-as-tests': customRules }, rules: { '${R2_RULE_ID}': 'error' } }`
    : `{ ${filesPart}rules: { '${R2_RULE_ID}': 'error' } }`;
}

/**
 * Relative import specifier from a per-package config to the consumer-root
 * eslint-rules-local barrel (install.sh ships it at <root>/eslint-rules-local/index.mjs).
 * Computed per config depth — never hardcoded.
 */
export function customRulesImportSpecifier(configPath: string, cwd: string): string {
  const target = resolve(cwd, 'eslint-rules-local/index.mjs');
  let rel = relative(dirname(resolve(configPath)), target);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

export interface WireOpts {
  assumeYes?: boolean;
  dryRun?: boolean;
  diffOnly?: boolean;
}

export interface WireResult {
  status: 'wired' | 'already-wired' | 'degrade' | 'unrecognised';
  original: string;
  modified: string;
  degradeReason?: string;
  variant?: TransformVariant;
}

export function generateDegradedSnippet(configPath: string): string {
  return [
    `· R2 not auto-wired: AST editor unavailable (Node or ts-morph not present).`,
    `  Add to ${configPath} (adjust the relative path to your eslint-rules-local/):`,
    `    import customRules from './eslint-rules-local/index.mjs';`,
    `    export default [...base, { plugins: { 'rules-as-tests': customRules }, rules: { '${R2_RULE_ID}': 'error' } }];`,
    `  (or run ./install.sh ts-server --full to install dev-deps and auto-wire)`,
  ].join('\n');
}

function buildLineDiff(original: string, modified: string): string {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const out: string[] = [];
  const max = Math.max(origLines.length, modLines.length);
  for (let i = 0; i < max; i++) {
    if (i >= origLines.length) {
      out.push(`+ ${modLines[i]}`);
    } else if (i >= modLines.length) {
      out.push(`- ${origLines[i]}`);
    } else if (origLines[i] !== modLines[i]) {
      out.push(`- ${origLines[i]}`);
      out.push(`+ ${modLines[i]}`);
    }
  }
  return out.join('\n');
}

/**
 * Core wiring logic. Pure function over file source text — no I/O.
 * Uses dynamic ts-morph import so the module loads without crashing when
 * ts-morph is absent (degrade path).
 */
export async function wireConfigSource(source: string, opts: TransformOpts = {}): Promise<WireResult> {
  // Idempotency: if R2 already referenced, bail early (byte-identical)
  if (source.includes(R2_RULE_ID)) {
    return { status: 'already-wired', original: source, modified: source };
  }

  // Dynamic import resolved from process.cwd(), NOT this file's directory.
  // install.sh runs the wirer from the framework checkout (PKG_ROOT/packages/core/
  // install/wire-eslint-r2.ts) with cwd=consumer-root. A bare `import('ts-morph')`
  // resolves relative to the importing FILE (the framework tree) — so it would miss
  // the consumer's freshly-installed ts-morph and falsely degrade (GH #642). Anchor
  // resolution to the consumer's cwd so the engine installed by `--full` is found.
  let Project: any;
  let SyntaxKind: any;
  try {
    const requireFromCwd = createRequire(resolve(process.cwd(), 'package.json'));
    const tsMorphPath = requireFromCwd.resolve('ts-morph'); // resolves from <cwd>/node_modules
    const mod = await import(pathToFileURL(tsMorphPath).href); // file URL — raw abs path → ERR_UNSUPPORTED_ESM_URL_SCHEME
    Project = mod.Project;
    SyntaxKind = mod.SyntaxKind;
  } catch {
    return {
      status: 'degrade',
      original: source,
      modified: source,
      degradeReason: 'ts-morph import failed',
    };
  }

  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      target: 99 /* ESNext */,
      module: 99 /* ESNext */,
    },
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });

  const sf = project.createSourceFile('eslint.config.mjs', source, { overwrite: true });

  // Find: export default <expr>
  const exportAssignment = sf.getExportAssignment((ea: any) => !ea.isExportEquals());
  if (!exportAssignment) {
    return { status: 'unrecognised', original: source, modified: source };
  }

  const expr = exportAssignment.getExpression();

  const variant = opts.variant ?? 'bare';
  const element = r2Element(variant, opts.scope);
  if (opts.scope) {
    console.log(`  [wire:R2] scoping R2 to files=${opts.scope.files.join(', ')}`);
  }

  if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
    // export default [...] or export default [...base, {...}]
    // addElement appends while preserving existing element formatting
    (expr as any).addElement(element);
  } else if (expr.isKind(SyntaxKind.Identifier)) {
    // export default base → export default [...base, R2]
    exportAssignment.setExpression(`[...${expr.getText()}, ${element}]`);
  } else if (expr.isKind(SyntaxKind.CallExpression)) {
    // export default defineConfig([...]) or similar
    const callExpr = expr as any;
    const args = callExpr.getArguments();
    if (args.length > 0 && args[0].isKind(SyntaxKind.ArrayLiteralExpression)) {
      args[0].addElement(element);
    } else {
      return { status: 'unrecognised', original: source, modified: source };
    }
  } else {
    // Unrecognised — bail safely, never partial-edit
    return { status: 'unrecognised', original: source, modified: source };
  }

  // self-contained variant must also register the plugin → inject the customRules import
  if (variant === 'self-contained') {
    const spec = opts.customRulesImportPath;
    if (!spec) throw new Error('self-contained variant requires customRulesImportPath');
    const already = sf.getImportDeclarations().some(
      (d: any) => d.getDefaultImport()?.getText() === 'customRules',
    );
    if (!already) {
      sf.addImportDeclaration({ defaultImport: 'customRules', moduleSpecifier: spec });
    }
  }

  const modified = sf.getFullText();
  return { status: 'wired', original: source, modified, variant };
}

// ─── N-rule synthesizer-driven wirer ──────────────────────────────────────────
// Ingests a parsed eslintConfigSnippet from synthesize() and AST-merges missing
// rules into the consumer's flat-config. Idempotent, non-destructive, degrade-safe.
// Prior-art: #120 (install auto-wires R2 → same pattern for N rules), #131 (ts-morph REUSE).

const WRAPPER_RULE_KEY = 'rules-as-tests/restricted-syntax-audit-exempt';

/**
 * Serialize a string to a safe JS string literal. Prefers double/single quotes for the
 * common case; falls back to JSON.stringify for any string containing a backslash or line
 * terminator (U+000A \n, U+000D \r, U+2028, U+2029) — these characters would break out of
 * an unescaped `'...'` or `"..."` literal in the generated eslint.config.mjs.
 */
function jsString(s: string): string {
  const needsEscape = s.includes('\\') || s.includes('\n') || s.includes('\r') || s.includes('\u2028') || s.includes('\u2029');
  if (!needsEscape) {
    if (!s.includes('"')) return `"${s}"`;
    if (!s.includes("'")) return `'${s}'`;
  }
  return JSON.stringify(s); // always valid, handles all escaping → double-quoted
}

function simpleRulePresent(source: string, ruleName: string): boolean {
  return source.includes(`'${ruleName}'`) || source.includes(`"${ruleName}"`);
}

function wrapperSelectorsPresent(source: string, arrValue: unknown[]): boolean {
  const entries = arrValue.slice(1) as Array<{ selector?: string }>;
  return entries.every((e) => {
    const sel = typeof e === 'object' && e !== null ? e.selector : undefined;
    return sel != null && source.includes(sel);
  });
}

/**
 * Serialise ONE rule's VALUE expression (the part after `'rule-id':`) — string severity,
 * `[severity, {selector, message}…]` wrapper array, or arbitrary JSON. Single source of the
 * value shape, reused both by buildRuleConfigElement (append path) and the live-override
 * replace path (replaceSimpleRuleValue), so an overridden value and a freshly-appended one
 * serialise identically (idempotency on re-run).
 */
function buildRuleValueExpr(value: unknown): string {
  if (typeof value === 'string') {
    // Severity strings ('error'/'warn'/'off') serialise via jsString — injection-safe for
    // all inputs (backslash, line terminators, embedded quotes) since jsString falls back
    // to JSON.stringify when escaping is required.
    return jsString(value);
  }
  if (Array.isArray(value)) {
    const severity = typeof value[0] === 'string' ? value[0] : 'error';
    const entries = (value.slice(1) as Array<{ selector?: string; message?: string }>)
      .filter((e) => typeof e === 'object' && e !== null && e.selector)
      .map((e) => {
        const parts = [`selector: ${jsString(e.selector!)}`];
        if (e.message) parts.push(`message: ${jsString(e.message)}`);
        return `{ ${parts.join(', ')} }`;
      });
    return `[${jsString(severity)}, ${entries.join(', ')}]`;
  }
  return JSON.stringify(value);
}

function buildRuleConfigElement(
  ruleName: string,
  value: unknown,
  scope?: { files: string[] },
  registerPlugin = false,
): string {
  // SSOT #182: files: scoped emission — when scope provided, emit workspace-scoped block.
  // Scope source = install-time dir→stack map, NOT recipe appliesTo (T-MS-A).
  // jsString() prevents code-injection when glob/ruleName contains a single quote (T-MSA-sec).
  // #829: registerPlugin emits a `plugins` entry so a `rules-as-tests/*` rule resolves when the
  // base config does not already register the plugin (RN/ts-server presets). Single-quoted to
  // match the preset template idiom (eslint.config.react.mjs); the import is injected by wireNRules.
  const filesPart = scope ? `files: [${scope.files.map((f) => jsString(f)).join(', ')}], ` : '';
  const pluginsPart = registerPlugin ? `plugins: { 'rules-as-tests': customRules }, ` : '';
  return `{ ${filesPart}${pluginsPart}rules: { ${jsString(ruleName)}: ${buildRuleValueExpr(value)} } }`;
}

/**
 * #829: true when some config element already registers the `rules-as-tests` plugin — i.e. a
 * `plugins` property whose initializer object has a `rules-as-tests` key. A rule-id like
 * `rules-as-tests/foo` under `rules:` does NOT count (the slash is the discriminator): a rule
 * reference is not a plugin registration. Mirrors mergeSelectorsIntoExistingWrapper's AST walk.
 */
function configRegistersRulesAsTestsPlugin(elements: any[], SyntaxKind: any): boolean {
  for (const el of elements) {
    if (!el.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
    for (const prop of el.getProperties?.() ?? []) {
      let propName: string;
      try { propName = normPropName(prop.getName?.()); } catch { continue; }
      if (propName !== 'plugins') continue;
      const pluginsInit = prop.getInitializer?.();
      if (!pluginsInit?.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
      for (const pp of pluginsInit.getProperties?.() ?? []) {
        let ppName: string;
        try { ppName = normPropName(pp.getName?.()); } catch { continue; }
        if (ppName === 'rules-as-tests') return true;
      }
    }
  }
  return false;
}

/** Quote-/whitespace-insensitive equality of two value expressions (idempotency guard for override). */
function exprEqual(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/['"`]/g, '"').replace(/\s+/g, '');
  return norm(a) === norm(b);
}

/**
 * Live-override replace path (D2 live-wins): locate the existing `rules: { '<ruleName>': <init> }`
 * property in any flat-config element and replace its initializer with the live value when it
 * differs. Returns 'changed' (replaced), 'same' (value already matches — idempotent no-op), or
 * 'not-found' (no such property — caller appends a new block). Only simple/scalar+array rule
 * values are handled; the restricted-syntax wrapper augments via selector-union, never replace.
 */
function replaceSimpleRuleValue(
  elements: any[],
  SyntaxKind: any,
  ruleName: string,
  desiredExpr: string,
): 'changed' | 'same' | 'not-found' {
  for (const el of elements) {
    if (!el.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
    for (const prop of el.getProperties?.() ?? []) {
      let propName: string;
      try { propName = normPropName(prop.getName?.()); } catch { continue; }
      if (propName !== 'rules') continue;
      const rulesInit = prop.getInitializer?.();
      if (!rulesInit?.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
      for (const rp of rulesInit.getProperties?.() ?? []) {
        let rpName: string;
        try { rpName = normPropName(rp.getName?.()); } catch { continue; }
        if (rpName !== ruleName) continue;
        const init = rp.getInitializer?.();
        if (!init) return 'not-found';
        if (exprEqual(init.getText(), desiredExpr)) return 'same';
        rp.setInitializer(desiredExpr);
        return 'changed';
      }
    }
  }
  return 'not-found';
}

/**
 * ts-morph PropertyAssignment.getName() for string literal keys (e.g. 'foo/bar')
 * returns the text WITH surrounding quotes. Strip them for comparison.
 */
function normPropName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.replace(/^['"`]|['"`]$/g, '');
}

/**
 * Locates the existing wrapper array in the AST and adds each missing selector entry.
 * Returns true if the wrapper was found and updated, false if not found.
 * Accepts a pre-extracted elements list (array elements OR call args) so it works for
 * both `export default [...]` and `export default defineConfig(obj, …)` shapes.
 */
function mergeSelectorsIntoExistingWrapper(
  elements: any[],
  SyntaxKind: any,
  missingSels: Array<{ selector: string; message?: string }>,
): boolean {
  for (const el of elements) {
    if (!el.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
    for (const prop of el.getProperties?.() ?? []) {
      let propName: string;
      try { propName = normPropName(prop.getName?.()); } catch { continue; }
      if (propName !== 'rules') continue;
      const rulesInit = prop.getInitializer?.();
      if (!rulesInit?.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
      for (const rp of rulesInit.getProperties?.() ?? []) {
        let rpName: string;
        try { rpName = normPropName(rp.getName?.()); } catch { continue; }
        if (rpName !== WRAPPER_RULE_KEY) continue;
        const wrapperArr = rp.getInitializer?.();
        if (!wrapperArr?.isKind?.(SyntaxKind.ArrayLiteralExpression)) continue;
        for (const e of missingSels) {
          const parts = [`selector: ${jsString(e.selector)}`];
          if (e.message) parts.push(`message: ${jsString(e.message)}`);
          wrapperArr.addElement(`{ ${parts.join(', ')} }`);
        }
        return true;
      }
    }
  }
  return false;
}

/**
 * N-rule synthesizer-driven wirer. Pure function over file source text — no I/O.
 *
 * Ingests the parsed eslintConfigSnippet from synthesize() and AST-merges missing rules
 * into the consumer's ESLint flat-config:
 *  - Simple string-valued rules (e.g. 'error'): appended as { rules: { 'name': 'error' } }
 *  - Array-valued rules (restricted-syntax-audit-exempt): selectors merged INTO the existing
 *    wrapper array when found, or a new config block added when absent. Never clobbers an
 *    existing wrapper (flat-config last-wins — a sibling would shadow the existing selectors).
 *
 * Idempotent: all rules/selectors already in source → status='already-wired', byte-identical.
 * Degrades gracefully when ts-morph is unavailable (status='degrade').
 */
export async function wireNRules(
  source: string,
  synthRules: Record<string, unknown>,
  // opts.overrideKeys + opts.scope are consumed below; opts.customRulesImportPath enables
  // #829 plugin self-registration when a net-new rules-as-tests/* block is added to a config
  // that does not already register the plugin. opts.variant is unused on the N-rule path.
  opts: TransformOpts = {},
): Promise<WireResult> {
  const ruleEntries = Object.entries(synthRules);
  if (ruleEntries.length === 0) {
    return { status: 'already-wired', original: source, modified: source };
  }

  // Idempotency check — string-search only, no ts-morph needed.
  // `missing` = rules absent from the config (appended). `overrides` = simple rules PRESENT
  // in the config whose key is a live-wins override target (D2): they need an AST value
  // comparison (present-but-different ⇒ replace) which string search cannot decide, so they
  // are resolved below with ts-morph. A wrapper rule is never overridden — it augments by
  // selector-union (mergeSelectorsIntoExistingWrapper), so it only appears in `missing`.
  const overrideKeys = opts.overrideKeys;
  const missing: Array<{ key: string; value: unknown }> = [];
  const overrides: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of ruleEntries) {
    if (Array.isArray(value)) {
      if (!wrapperSelectorsPresent(source, value)) missing.push({ key, value });
    } else if (!simpleRulePresent(source, key)) {
      missing.push({ key, value });
    } else if (overrideKeys?.has(key)) {
      overrides.push({ key, value });
    }
  }
  if (missing.length === 0 && overrides.length === 0) {
    return { status: 'already-wired', original: source, modified: source };
  }

  // Load ts-morph from consumer cwd (same GH #642 fix as wireConfigSource)
  console.debug(
    `  [synth-wire] DEBUG: ${missing.length} rule(s) to wire, ${overrides.length} override(s): ` +
      `${[...missing, ...overrides].map((m) => m.key).join(', ')}`,
  );
  let Project: any;
  let SyntaxKind: any;
  try {
    const requireFromCwd = createRequire(resolve(process.cwd(), 'package.json'));
    const tsMorphPath = requireFromCwd.resolve('ts-morph');
    const mod = await import(pathToFileURL(tsMorphPath).href);
    Project = mod.Project;
    SyntaxKind = mod.SyntaxKind;
  } catch {
    console.debug('  [synth-wire] DEBUG: ts-morph unavailable → degrade');
    return { status: 'degrade', original: source, modified: source, degradeReason: 'ts-morph import failed' };
  }

  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, target: 99, module: 99 },
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });
  const sf = project.createSourceFile('eslint.config.mjs', source, { overwrite: true });

  const exportAssignment = sf.getExportAssignment((ea: any) => !ea.isExportEquals());
  if (!exportAssignment) {
    return { status: 'unrecognised', original: source, modified: source };
  }

  let exportArr: any = exportAssignment.getExpression();
  // isCallExprMode: true when the export is defineConfig(obj, obj, …) — each arg is a
  // flat-config element, not nested inside an array. callExprNode holds the CallExpression.
  let isCallExprMode = false;
  let callExprNode: any = null;

  if (exportArr.isKind(SyntaxKind.CallExpression)) {
    const args = exportArr.getArguments();
    if (args.length > 0 && args[0].isKind(SyntaxKind.ArrayLiteralExpression)) {
      // defineConfig([...]) — single array arg; unwrap to the array
      exportArr = args[0];
    } else {
      // defineConfig(obj, obj, …) — each arg is a flat-config element (the real shipped shape)
      isCallExprMode = true;
      callExprNode = exportArr;
    }
  } else if (exportArr.isKind(SyntaxKind.Identifier)) {
    exportAssignment.setExpression(`[...${exportArr.getText()}]`);
    exportArr = exportAssignment.getExpression();
  }

  if (!isCallExprMode && !exportArr.isKind(SyntaxKind.ArrayLiteralExpression)) {
    return { status: 'unrecognised', original: source, modified: source };
  }

  // configElements: the individual flat-config objects to search for the wrapper rule.
  const configElements: any[] = isCallExprMode
    ? callExprNode.getArguments()
    : exportArr.getElements?.() ?? [];

  let changed = false;

  // #829: a net-new `rules-as-tests/*` block must self-register the plugin when the base config
  // does not already register it (RN/ts-server presets) AND the caller supplied an import path.
  // When eligible, each fresh rules-as-tests block carries `plugins: { 'rules-as-tests': … }` and
  // the `import customRules` declaration is injected once after the loop (dedupe-guarded). Without
  // an import path the path degrades to bare (backward-compatible — unit callers pass none).
  const selfRegisterEligible =
    !!opts.customRulesImportPath && !configRegistersRulesAsTestsPlugin(configElements, SyntaxKind);
  let didSelfRegister = false;
  const registerFor = (ruleKey: string): boolean => {
    const yes = selfRegisterEligible && ruleKey.startsWith('rules-as-tests/');
    if (yes) didSelfRegister = true;
    return yes;
  };

  // Live-wins overrides first: replace an existing simple-rule value when the live value differs.
  for (const { key, value } of overrides) {
    const desired = buildRuleValueExpr(value);
    const outcome = replaceSimpleRuleValue(configElements, SyntaxKind, key, desired);
    if (outcome === 'changed') {
      console.debug(`  [synth-wire] DEBUG: live-override replaced value of '${key}'`);
      changed = true;
    } else if (outcome === 'not-found') {
      // String-present but not locatable as a rules property (e.g. in a comment) — append fresh.
      console.debug(`  [synth-wire] DEBUG: override target '${key}' not found as a rules prop — appending`);
      if (isCallExprMode) callExprNode.addArgument(buildRuleConfigElement(key, value, opts.scope, registerFor(key)));
      else exportArr.addElement(buildRuleConfigElement(key, value, opts.scope, registerFor(key)));
      changed = true;
    } // 'same' → no change (idempotent)
  }

  for (const { key, value } of missing) {
    changed = true;
    if (opts.scope) {
      console.log(`  [wire:N-rule] scoping ${key} to files=${opts.scope.files.join(', ')}`);
    }
    if (Array.isArray(value)) {
      const missingSels = (value.slice(1) as Array<{ selector?: string; message?: string }>).filter(
        (e) => typeof e === 'object' && e !== null && e.selector && !source.includes(e.selector),
      ) as Array<{ selector: string; message?: string }>;
      const merged = mergeSelectorsIntoExistingWrapper(configElements, SyntaxKind, missingSels);
      if (!merged) {
        console.debug(`  [synth-wire] DEBUG: adding new wrapper block for '${key}'`);
        if (isCallExprMode) {
          callExprNode.addArgument(buildRuleConfigElement(key, value, opts.scope, registerFor(key)));
        } else {
          exportArr.addElement(buildRuleConfigElement(key, value, opts.scope, registerFor(key)));
        }
      } else {
        console.debug(`  [synth-wire] DEBUG: merged ${missingSels.length} selector(s) into existing '${key}' block`);
      }
    } else {
      console.debug(`  [synth-wire] DEBUG: appending simple rule block for '${key}'`);
      if (isCallExprMode) {
        callExprNode.addArgument(buildRuleConfigElement(key, value, opts.scope, registerFor(key)));
      } else {
        exportArr.addElement(buildRuleConfigElement(key, value, opts.scope, registerFor(key)));
      }
    }
  }

  // Overrides that all matched (outcome 'same') and no missing rules ⇒ byte-identical no-op.
  if (!changed) {
    return { status: 'already-wired', original: source, modified: source };
  }

  // #829: inject the customRules import exactly once when any block self-registered the plugin.
  // Dedupe-guarded (mirror the self-contained variant) so a re-run never adds a second import.
  if (didSelfRegister && opts.customRulesImportPath) {
    const already = sf.getImportDeclarations().some(
      (d: any) => d.getDefaultImport()?.getText() === 'customRules',
    );
    if (!already) {
      sf.addImportDeclaration({ defaultImport: 'customRules', moduleSpecifier: opts.customRulesImportPath });
    }
  }

  const modified = sf.getFullText();
  return { status: 'wired', original: source, modified };
}

// ─── Probe-driven resolution (try-bare → escalate → degrade) ────────────────────

export type ProbeVerdict = 'ok' | 'could-not-find-plugin' | 'unavailable' | 'other-error';

export interface ResolveWireArgs {
  configPath: string;
  cwd: string;
  runProbe: (configPath: string, cwd: string) => Promise<ProbeVerdict>;
  /** Workspace scope for scoped emission (SSOT #182). When set, emits { files: [...], rules: {...} }. */
  scope?: { files: string[] };
}

function synthProbeTarget(configDir: string): string {
  // ALWAYS synthesize in configDir (deterministic). For scoped elements (files: ['<dir>/**']),
  // the probe file must be inside the scope dir so ESLint matches the files: glob. configDir is
  // the workspace dir (e.g. apps/api/) when the config is placed per-workspace, so the probe file
  // naturally lands inside the scope glob when ESLint is run from project root (see probeViaEslint).
  const p = resolve(configDir, '__aif_r2_probe__.ts');
  writeFileSync(p, 'export const __aif_probe = 1;\n', 'utf8');
  return p;
}

/**
 * Default probe: resolve the consumer's eslint and run `--print-config` on a synthesized target.
 * eslint's package `exports` does NOT expose `./bin/eslint.js` (resolve throws ERR_PACKAGE_PATH_NOT_EXPORTED
 * on v9/v10) — resolve the EXPORTED `./package.json` and derive the bin path. GH #644 (#535 trap).
 */
export async function probeViaEslint(configPath: string, cwd: string): Promise<ProbeVerdict> {
  let eslintBin: string;
  try {
    const reqd = createRequire(resolve(cwd, 'package.json'));
    const pj = reqd.resolve('eslint/package.json');
    eslintBin = join(dirname(pj), 'bin', 'eslint.js');
    if (!existsSync(eslintBin)) return 'unavailable';
  } catch {
    return 'unavailable';
  }
  // tsx loader lets eslint load a config that imports a `.ts` barrel on ANY Node (the shipped
  // .nvmrc is 20.x — no native type-stripping; plain node → ERR_UNKNOWN_FILE_EXTENSION). tsx is a
  // consumer devDep + the pre-push-hook pattern (build-first-reuse). Absent → plain node (works on
  // Node >=22.18, degrades on 20 — same as the consumer's own `eslint .` would).
  const nodeArgs: string[] = [];
  try {
    createRequire(resolve(cwd, 'package.json')).resolve('tsx');
    nodeArgs.push('--import', 'tsx');
  } catch {
    /* tsx not resolvable → plain node */
  }
  const dir = dirname(resolve(configPath));
  const target = synthProbeTarget(dir);
  // Run probe from the config's own directory (dir) so ESLint discovers the workspace-local
  // config by walking up from the probe file. Running from project root in multi-stack mode
  // (where no root config exists) causes ESLint to fail to load the config → 'other-error' →
  // degrade. Global elements (no files: filter) are unaffected by cwd choice.
  try {
    execFileSync(process.execPath, [...nodeArgs, eslintBin, '--print-config', target], { cwd: dir, stdio: 'pipe' });
    return 'ok';
  } catch (e: unknown) {
    const stderr = String((e as { stderr?: Buffer }).stderr ?? '');
    if (/could not find plugin/i.test(stderr)) return 'could-not-find-plugin';
    // Surface WHY we degrade (e.g. type-aware projectService/tsconfig error) — no silent degrade.
    console.error(`  · R2 probe: unexpected eslint error → degrading:\n${stderr.slice(0, 400)}`);
    return 'other-error';
  } finally {
    try {
      unlinkSync(target);
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Write the bare element, ask ESLint (via runProbe) whether the config loads, and escalate to
 * the self-contained (plugin-registering) element ONLY on `could-not-find-plugin`. Bare never
 * registers a plugin → "Cannot redefine plugin" is unreachable by construction. Any non-ok
 * terminal verdict restores the original (no half-edit). GH #644.
 */
export async function resolveAndWire(args: ResolveWireArgs): Promise<WireResult> {
  const { configPath, cwd, runProbe, scope } = args;
  const original = readFileSync(configPath, 'utf8');
  if (original.includes(R2_RULE_ID)) {
    return { status: 'already-wired', original, modified: original };
  }

  if (scope) {
    console.log(`  [wire:R2] scoped probe target=${configPath} glob=${scope.files.join(', ')}`);
  }

  // 1. bare
  const bare = await wireConfigSource(original, { variant: 'bare', scope });
  if (bare.status !== 'wired') return bare; // unrecognised / degrade — nothing written
  writeFileSync(configPath, bare.modified, 'utf8');

  // 2. probe
  const v1 = await runProbe(configPath, cwd);
  if (v1 === 'ok') return { ...bare, variant: 'bare' };

  // 3. escalate: self-contained (only when the base registers the plugin nowhere)
  if (v1 === 'could-not-find-plugin') {
    const spec = customRulesImportSpecifier(configPath, cwd);
    const sc = await wireConfigSource(original, { variant: 'self-contained', customRulesImportPath: spec, scope });
    if (sc.status === 'wired') {
      writeFileSync(configPath, sc.modified, 'utf8');
      const v2 = await runProbe(configPath, cwd);
      if (v2 === 'ok') return { ...sc, variant: 'self-contained' };
    }
  }

  // 4. degrade: restore, never leave a half-edit
  writeFileSync(configPath, original, 'utf8');
  return { status: 'degrade', original, modified: original, degradeReason: `probe verdict: ${v1}` };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log([
      'wire-eslint-r2 — wire R2 (rules-as-tests/no-unsafe-zod-parse) into eslint.config.mjs',
      '',
      'Usage: npx tsx wire-eslint-r2.ts [options]',
      '  --path <file>   Config to wire (default: ./eslint.config.mjs)',
      '  --scope <glob>  Workspace scope glob (e.g. apps/api/**) — emits { files: [glob], rules: {...} }',
      '  --yes           Auto-apply without confirmation',
      '  --dry-run       Print what would change, no write',
      '  --diff          Print diff and exit (no write, no prompt)',
    ].join('\n'));
    process.exit(0);
  }

  const pathIdx = argv.indexOf('--path');
  const configPath = resolve(pathIdx >= 0 ? argv[pathIdx + 1] : './eslint.config.mjs');
  const scopeIdx = argv.indexOf('--scope');
  const scopeStr = scopeIdx >= 0 ? argv[scopeIdx + 1] : undefined;
  const scope = scopeStr ? { files: [scopeStr] } : undefined;
  const assumeYes = argv.includes('--yes');
  const dryRun = argv.includes('--dry-run');
  const diffOnly = argv.includes('--diff');

  // Belt-and-suspenders degrade: bash probe should have checked this already
  if (!existsSync('node_modules/ts-morph/package.json')) {
    console.log(generateDegradedSnippet(configPath));
    process.exit(0);
  }

  if (!existsSync(configPath)) {
    console.log(`· wire-eslint-r2: ${configPath} not found — skipped`);
    process.exit(0);
  }

  const source = readFileSync(configPath, 'utf8');
  const result = await wireConfigSource(source);

  switch (result.status) {
    case 'already-wired':
      console.log(`· R2 already enforced in ${configPath} (no change)`);
      process.exit(0);
      break;

    case 'degrade':
      console.log(generateDegradedSnippet(configPath));
      process.exit(0);
      break;

    case 'unrecognised':
      console.log([
        `· R2 not auto-wired: ${configPath} uses an unrecognised export shape.`,
        `  Add manually (adjust the relative path to your eslint-rules-local/):`,
        `    import customRules from './eslint-rules-local/index.mjs';`,
        `    export default [...yourConfig, { plugins: { 'rules-as-tests': customRules }, rules: { '${R2_RULE_ID}': 'error' } }];`,
      ].join('\n'));
      process.exit(0);
      break;

    case 'wired': {
      const diff = buildLineDiff(result.original, result.modified); // bare preview
      if (dryRun || diffOnly) {
        console.log(`Diff for ${configPath}:\n${diff}`);
        process.exit(0);
      }

      console.log(`\nProposed change to ${configPath}:\n${diff}\n`);

      let apply = assumeYes;
      if (!apply) {
        if (!process.stdin.isTTY) {
          // Non-interactive without --yes → degrade to manual snippet
          console.log(generateDegradedSnippet(configPath));
          process.exit(0);
        }
        const { createInterface } = await import('node:readline');
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((done) => {
          rl.question('Apply this change? [y/N] ', done);
        });
        rl.close();
        apply = /^y(es)?$/i.test(answer.trim());
      }

      if (!apply) {
        console.log(generateDegradedSnippet(configPath));
        process.exit(0);
      }

      // Apply through the probe loop: bare → escalate to self-contained → degrade.
      const wired = await resolveAndWire({ configPath, cwd: process.cwd(), runProbe: probeViaEslint, scope });
      if (wired.status === 'wired') {
        console.log(`  ✓ R2 wired into ${configPath} (${wired.variant})`);
      } else if (wired.status === 'already-wired') {
        console.log(`· R2 already enforced in ${configPath}`);
      } else {
        console.log(generateDegradedSnippet(configPath));
      }
      process.exit(0);
    }
  }
}

// Only run as CLI entry point; when imported as a module, skip main()
if (process.argv[1] && process.argv[1].endsWith('wire-eslint-r2.ts')) {
  main().catch((err) => {
    console.error('wire-eslint-r2 fatal:', err);
    process.exit(0); // rc=0 even on crash — install must not abort
  });
}
