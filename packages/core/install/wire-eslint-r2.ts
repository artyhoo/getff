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

import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path, { basename, dirname, join, relative, resolve, win32, type PlatformPath } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

export const R2_RULE_ID = 'rules-as-tests/no-unsafe-zod-parse';

export type TransformVariant = 'bare' | 'self-contained';
export interface TransformOpts {
  variant?: TransformVariant;
  customRulesImportPath?: string; // required when variant === 'self-contained'
  /** When provided, emits `{ files: [...], rules: {...} }` — workspace-scoped block. */
  scope?: { files: string[] };
  /**
   * Per-rule scope, taking precedence over `scope`: returns the `files:` a freshly appended block
   * for that rule-id must carry, or undefined for the default. Lets a preset keep the scope its
   * template gives each rule when the rules are appended to a brownfield config (critical-review S7-2).
   */
  scopeFor?: (ruleKey: string) => { files: string[] } | undefined;
  /**
   * Live-wins override set (D2). Rule-ids in this set REPLACE an existing simple-rule value in
   * the config (rather than the default append-if-missing, which keeps the preset). Used by the
   * live-research augment-first path so a live rule sharing a preset rule-id is authoritative.
   */
  overrideKeys?: Set<string>;
  /**
   * A config the consumer owns (Q4.7): each new block is a text insertion on its own line and the
   * customRules import follows the file's quotes — no line the config already has is re-printed.
   */
  insertOnly?: boolean;
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
 * One spelling per directory, so `relative` between a --path-derived dir and cwd never walks out of
 * the project: process.cwd() is the physical directory while install.sh passes --path under its
 * logical `pwd` (macOS /var → /private/var, a symlinked Linux workspace, a Windows junction or 8.3
 * short name like C:\Users\RUNNER~1). `.native` because only it expands 8.3 names on Windows; the JS
 * realpathSync resolves links but keeps a short name. A path that does not exist yet is its nearest
 * existing ancestor, resolved, plus the rest, so both sides still share one spelling. (A `subst`
 * drive is resolved to its target too, where Node's module URL keeps the drive: a specifier that
 * climbs above such a drive's root would miss. Not a layout the install produces.)
 */
function canonicalDir(p: string): string {
  const abs = resolve(p);
  try {
    return realpathSync.native(abs);
  } catch {
    const parent = dirname(abs);
    return parent === abs ? abs : join(canonicalDir(parent), basename(abs));
  }
}

/**
 * The ESM specifier that imports `target` from a module in `fromDir`. A specifier is a URL path, so
 * it is joined with `/`; with no relative path between them (another Windows drive) it is the file
 * URL. `p` is the path flavour, so the Windows arm is testable on any platform.
 */
export function importSpecifierFrom(fromDir: string, target: string, p: PlatformPath = path): string {
  const rel = p.relative(fromDir, target);
  if (p.isAbsolute(rel)) return pathToFileURL(target, { windows: p === win32 }).href;
  const spec = rel.split(p.sep).join('/');
  return spec.startsWith('.') ? spec : `./${spec}`;
}

/**
 * Relative import specifier from a per-package config to the consumer-root
 * eslint-rules-local barrel (install.sh ships it at <root>/eslint-rules-local/index.mjs).
 * Computed per config depth — never hardcoded — between one spelling of each directory (canonicalDir).
 */
export function customRulesImportSpecifier(configPath: string, cwd: string): string {
  return importSpecifierFrom(canonicalDir(dirname(configPath)), join(canonicalDir(cwd), 'eslint-rules-local', 'index.mjs'));
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
  /** Set when the write stands but the post-write lint probe could not verify it. */
  probeNote?: string;
  /** Parts of the block that were NOT written, each with its reason (wireOwnConfig). */
  notes?: string[];
}

/** Why R2 did not land when its AST editor could not be loaded (the install's not-wired reason). */
export const R2_NO_ENGINE = 'its AST editor (ts-morph) could not be loaded; a --full install puts it in node_modules';

/**
 * R2 not landing in `configPath`, as the install reports it (operator decision Q4.7, 2026-09-28): one
 * «  · not wired: <what> — <why>» line, which 99-finalize.sh copies into its NOT wired summary. The
 * install never gets a snippet to add by hand; that one (generateDegradedSnippet) is for a human who
 * runs this CLI directly. The install reads that line by line, so a multi-line reason (an ESLint
 * error text) is folded onto the one line.
 */
export function r2NotWiredLine(configPath: string, why: string, cwd: string = process.cwd()): string {
  return `  · not wired: R2 (${R2_RULE_ID}) in ${projectRelative(configPath, cwd)} — ${why.replace(/\s*\n\s*/g, ' ')}`;
}

/**
 * `configPath` relative to `cwd` for a message, directories on both sides in one spelling (canonicalDir).
 * The file itself is not resolved: a config that is a symlink is named by its own path.
 */
function projectRelative(configPath: string, cwd: string): string {
  return relative(canonicalDir(cwd), join(canonicalDir(dirname(configPath)), basename(configPath)));
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
    // Without the parser only the quoted search can answer; it decides already-wired vs degrade, never an edit.
    if (simpleRulePresent(source, R2_RULE_ID)) return { status: 'already-wired', original: source, modified: source };
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

  // Idempotency: R2 set as code (a comment or a longer string naming it sets nothing) → byte-identical
  if (ruleSetInConfig(sf, SyntaxKind, R2_RULE_ID)) {
    return { status: 'already-wired', original: source, modified: source };
  }

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

/**
 * The no-ts-morph stand-in for ruleKeyNodes: a quoted mention anywhere. It misses an identifier key
 * (`eqeqeq: 'off'`) and counts a comment, so it only decides already-wired vs degrade — never an edit.
 */
function simpleRulePresent(source: string, ruleName: string): boolean {
  return source.includes(`'${ruleName}'`) || source.includes(`"${ruleName}"`);
}

/**
 * The properties that set `ruleName` in this config: its key — quoted, or an identifier (`eqeqeq: 'off'`,
 * prettier's default quoteProps output) — in a rules object. A rules object is the object literal under a
 * `rules` property, or one that property reaches through a same-file variable (`rules: shared`,
 * `rules: { ...shared }`, `{ rules }`), parentheses or a cast, either branch of `?:` / `&&` / `||` / `??`,
 * or a call's arguments (`Object.assign({}, …)`). The same word in a comment, a string value or another
 * object's key (`settings: { eqeqeq: true }`) sets nothing.
 */
function ruleKeyNodes(sf: any, SyntaxKind: any, ruleName: string): any[] {
  const objects = new Set<any>();
  const seen = new Set<any>();
  const LOGICAL = [SyntaxKind.AmpersandAmpersandToken, SyntaxKind.BarBarToken, SyntaxKind.QuestionQuestionToken];
  const WRAPPERS = [
    SyntaxKind.ParenthesizedExpression, // also a JSDoc cast: /** @type {any} */ ({ … })
    SyntaxKind.AsExpression,
    SyntaxKind.SatisfiesExpression,
    SyntaxKind.TypeAssertionExpression,
    SyntaxKind.NonNullExpression,
  ];
  const collect = (node: any): void => {
    if (!node?.isKind) return;
    if (node.isKind(SyntaxKind.Identifier)) {
      const decl = sf.getVariableDeclaration(node.getText());
      if (!decl || seen.has(decl)) return;
      seen.add(decl);
      collect(decl.getInitializer());
    } else if (WRAPPERS.some((k) => node.isKind(k))) {
      collect(node.getExpression());
    } else if (node.isKind(SyntaxKind.ConditionalExpression)) {
      collect(node.getWhenTrue());
      collect(node.getWhenFalse());
    } else if (node.isKind(SyntaxKind.BinaryExpression) && LOGICAL.includes(node.getOperatorToken().getKind())) {
      collect(node.getLeft());
      collect(node.getRight());
    } else if (node.isKind(SyntaxKind.CallExpression)) {
      for (const arg of node.getArguments()) collect(arg);
    } else if (node.isKind(SyntaxKind.ObjectLiteralExpression) && !objects.has(node)) {
      objects.add(node);
      for (const p of node.getProperties()) {
        if (p.isKind(SyntaxKind.SpreadAssignment)) collect(p.getExpression());
      }
    }
  };
  for (const p of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    if (normPropName(p.getName()) === 'rules') collect(p.getInitializer());
  }
  for (const p of sf.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)) {
    if (p.getName() === 'rules') collect(p.getNameNode());
  }
  const out: any[] = [];
  for (const obj of objects) {
    for (const p of obj.getProperties()) {
      const keyed = p.isKind(SyntaxKind.PropertyAssignment) || p.isKind(SyntaxKind.ShorthandPropertyAssignment);
      if (keyed && normPropName(p.getName()) === ruleName) out.push(p);
    }
  }
  return out;
}

/**
 * Whether this config sets `ruleName`: a key ruleKeyNodes finds, or — in a shape it does not follow
 * (`rules: mk()`, `rules['x'] = …`, a computed key) — the exact rule-id as a string literal, which the
 * quoted-string search counted too; unlike it, a comment or a longer string (`"use 'eqeqeq'"`) does not
 * count. Leaning to «set» is what keeps an appended block from overriding a value the consumer chose.
 */
function ruleSetInConfig(sf: any, SyntaxKind: any, ruleName: string): boolean {
  if (ruleKeyNodes(sf, SyntaxKind, ruleName).length > 0) return true;
  const literal = (kind: any): boolean => sf.getDescendantsOfKind(kind).some((n: any) => n.getLiteralValue() === ruleName);
  return literal(SyntaxKind.StringLiteral) || literal(SyntaxKind.NoSubstitutionTemplateLiteral);
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
 * Whether the module binds or exports the name RULE_GLOBS other than by a plain `RULE_GLOBS = …`
 * declaration: an import of it, a top-level destructuring, or an export under that name (a re-export, a
 * namespace export, `export { x as RULE_GLOBS }`). A declaration of getff's beside any of these is a
 * SyntaxError. A RULE_GLOBS bound inside a function is that function's own and does not count (second
 * cold review 2026-09-29).
 */
function ruleGlobsBoundElsewhere(sf: any, SyntaxKind: any): boolean {
  const named = (n: any): boolean => n?.getText?.() === 'RULE_GLOBS';
  for (const d of sf.getImportDeclarations?.() ?? []) {
    if (named(d.getDefaultImport?.()) || named(d.getNamespaceImport?.())) return true;
    if ((d.getNamedImports?.() ?? []).some((s: any) => named(s.getAliasNode?.() ?? s.getNameNode?.()))) return true;
  }
  for (const d of sf.getExportDeclarations?.() ?? []) {
    if (named(d.getNamespaceExport?.()?.getNameNode?.())) return true;
    if ((d.getNamedExports?.() ?? []).some((s: any) => named(s.getAliasNode?.() ?? s.getNameNode?.()))) return true;
  }
  return (sf.getVariableStatements?.() ?? []).some((st: any) => st.getDeclarations().some((v: any) =>
    v.getNameNode().getDescendantsOfKind(SyntaxKind.BindingElement).some((b: any) => named(b.getNameNode?.()))));
}

/**
 * #829: true when some config element already registers the `rules-as-tests` plugin — i.e. a
 * `plugins` property whose initializer object has a `rules-as-tests` key. A rule-id like
 * `rules-as-tests/foo` under `rules:` does NOT count (the slash is the discriminator): a rule
 * reference is not a plugin registration. Mirrors mergeSelectorsIntoExistingWrapper's AST walk.
 *
 * Only a GLOBAL registration counts — an element with no `files` / `ignores` key. In flat config a
 * `plugins` entry applies only to the files its own block matches, and the shipped templates
 * register the plugin inside `files:`-scoped blocks; treating those as global left an appended
 * bare block unresolvable on every other file (critical-review S7-1).
 *
 * «No scope key» must be PROVEN, spreads included: `{ ...onlyJs, plugins: … }` with
 * `const onlyJs = { files: ['**\/*.js'] }` is scoped although the literal shows no `files` key.
 * A false «not global» costs nothing — the wirer registers the plugin in its own blocks, and ESLint
 * accepts the same plugin object in several elements. The `plugins` that counts is the element's
 * LAST one, with no spread after it: a later key or spread replaces the whole object.
 */
function configRegistersRulesAsTestsPlugin(elements: any[], SyntaxKind: any): boolean {
  for (const el of elements) {
    if (!el.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
    if (!provablyUnscoped(el, SyntaxKind, new Set())) continue;
    const props: any[] = el.getProperties?.() ?? [];
    let last = -1;
    props.forEach((p, i) => {
      try { if (normPropName(p.getName?.()) === 'plugins') last = i; } catch { /* spread: no name */ }
    });
    if (last < 0 || props.slice(last + 1).some((p) => p.isKind?.(SyntaxKind.SpreadAssignment))) continue;
    const pluginsInit = props[last].getInitializer?.();
    if (!pluginsInit?.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
    for (const pp of pluginsInit.getProperties?.() ?? []) {
      let ppName: string;
      try { ppName = normPropName(pp.getName?.()); } catch { continue; }
      if (ppName === 'rules-as-tests') return true;
    }
  }
  return false;
}

/**
 * True when an element that sets `ruleName` under `rules:` is not provably unscoped (a `files`, `ignores`
 * or `basePath` key of its own or through a spread) — the rule may apply to some files only, and an
 * element that sets it for more files would widen it.
 */
function ruleSetForSomeFilesOnly(elements: any[], SyntaxKind: any, ruleName: string): boolean {
  for (const el of elements) {
    if (!el.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
    if (provablyUnscoped(el, SyntaxKind, new Set())) continue;
    // `'rules':` as well as `rules:` — getProperty('rules') finds the unquoted key only.
    const rulesProp = (el.getProperties?.() ?? []).find((p: any) => {
      try { return normPropName(p.getName?.()) === 'rules'; } catch { return false; }
    });
    const rules = rulesProp?.getInitializer?.();
    if (!rules?.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
    for (const rp of rules.getProperties?.() ?? []) {
      try { if (normPropName(rp.getName?.()) === ruleName) return true; } catch { /* next */ }
    }
  }
  return false;
}

/** Keys that limit which files a flat-config element applies to. */
const SCOPE_KEYS = new Set(['files', 'ignores', 'basePath']);

/**
 * True only when neither `obj` nor anything it spreads carries a scope key. A computed or escaped
 * key, an accessor or method (it runs during a spread and can add keys to its object), or a spread
 * whose object literal this file does not show, cannot be proven free of one → false.
 */
function provablyUnscoped(obj: any, SyntaxKind: any, seen: Set<any>): boolean {
  if (seen.has(obj)) return false;
  seen.add(obj);
  for (const p of obj.getProperties?.() ?? []) {
    if (p.isKind?.(SyntaxKind.SpreadAssignment)) {
      const lit = spreadObjectLiteral(p.getExpression(), SyntaxKind);
      if (!lit || !provablyUnscoped(lit, SyntaxKind, seen)) return false;
      continue;
    }
    if (p.isKind?.(SyntaxKind.GetAccessor) || p.isKind?.(SyntaxKind.SetAccessor) || p.isKind?.(SyntaxKind.MethodDeclaration)) return false;
    const nameNode = p.getNameNode?.();
    if (nameNode?.isKind?.(SyntaxKind.ComputedPropertyName) || nameNode?.getText?.().includes('\\')) return false;
    let name: string;
    try { name = normPropName(p.getName?.()); } catch { return false; }
    if (SCOPE_KEYS.has(name)) return false;
  }
  return true;
}

/**
 * The object literal a spread operand stands for, when this file proves it: an inline literal, or
 * the one `const` in this file bound to a literal and used nowhere but as a spread operand (a
 * property write or a call argument could add `files` to it). Anything else → undefined.
 */
function spreadObjectLiteral(expr: any, SyntaxKind: any): any {
  const unwrap = (e: any): any => {
    let cur = e;
    while (cur && (cur.isKind(SyntaxKind.ParenthesizedExpression) || cur.isKind(SyntaxKind.AsExpression) || cur.isKind(SyntaxKind.SatisfiesExpression))) {
      cur = cur.getExpression();
    }
    return cur;
  };
  const e = unwrap(expr);
  if (e?.isKind(SyntaxKind.ObjectLiteralExpression)) return e;
  if (!e?.isKind(SyntaxKind.Identifier)) return undefined;
  const name = e.getText();
  const sf = e.getSourceFile();
  const decls = sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration).filter((d: any) => d.getName() === name);
  if (decls.length !== 1) return undefined;
  const decl = decls[0];
  if (decl.getVariableStatement?.()?.getDeclarationKind?.() !== 'const') return undefined;
  const init = unwrap(decl.getInitializer?.());
  if (!init?.isKind(SyntaxKind.ObjectLiteralExpression)) return undefined;
  const nameNode = decl.getNameNode();
  const onlySpread = sf.getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id: any) => id.getText() === name && id !== nameNode)
    .every((id: any) => {
      const parent = id.getParent();
      return parent?.isKind(SyntaxKind.SpreadAssignment) || parent?.isKind(SyntaxKind.SpreadElement);
    });
  return onlySpread ? init : undefined;
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
 * `apply: false` (a config the consumer owns) never replaces: a different value is 'differs'.
 */
function replaceSimpleRuleValue(
  elements: any[],
  SyntaxKind: any,
  ruleName: string,
  desiredExpr: string,
  apply = true,
): 'changed' | 'differs' | 'same' | 'not-found' {
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
        if (!apply) return 'differs';
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
  // A computed key spelled as a literal — [`rules-as-tests/x`] or ['x'] — names the same property.
  const computed = /^\[\s*(['"`])(.*)\1\s*\]$/s.exec(name);
  if (computed) return computed[2];
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

  // Load ts-morph from consumer cwd (same GH #642 fix as wireConfigSource). Absent, the quoted-string
  // search below still tells an already-wired config from one that needs an edit it cannot make.
  let mod: any;
  try {
    const requireFromCwd = createRequire(resolve(process.cwd(), 'package.json'));
    const tsMorphPath = requireFromCwd.resolve('ts-morph');
    mod = await import(pathToFileURL(tsMorphPath).href);
  } catch {
    mod = undefined;
  }
  const SyntaxKind: any = mod?.SyntaxKind;
  const sf: any = mod
    ? new mod.Project({
        useInMemoryFileSystem: true,
        compilerOptions: { allowJs: true, target: 99, module: 99 },
        skipFileDependencyResolution: true,
        skipLoadingLibFiles: true,
      }).createSourceFile('eslint.config.mjs', source, { overwrite: true })
    : undefined;

  // `missing` = rules absent from the config (appended). `overrides` = simple rules PRESENT
  // in the config whose key is a live-wins override target (D2): they need an AST value
  // comparison (present-but-different ⇒ replace), resolved below. A wrapper rule is never
  // overridden — it augments by selector-union (mergeSelectorsIntoExistingWrapper), so it only
  // appears in `missing`. Whether a simple rule is present is ruleSetInConfig's call.
  const rulePresent = (key: string): boolean =>
    sf ? ruleSetInConfig(sf, SyntaxKind, key) : simpleRulePresent(source, key);
  const overrideKeys = opts.overrideKeys;
  const missing: Array<{ key: string; value: unknown }> = [];
  const overrides: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of ruleEntries) {
    if (Array.isArray(value)) {
      if (!wrapperSelectorsPresent(source, value)) missing.push({ key, value });
    } else if (!rulePresent(key)) {
      missing.push({ key, value });
    } else if (overrideKeys?.has(key)) {
      overrides.push({ key, value });
    }
  }
  if (missing.length === 0 && overrides.length === 0) {
    return { status: 'already-wired', original: source, modified: source };
  }

  console.debug(
    `  [synth-wire] DEBUG: ${missing.length} rule(s) to wire, ${overrides.length} override(s): ` +
      `${[...missing, ...overrides].map((m) => m.key).join(', ')}`,
  );
  if (!sf) {
    console.debug('  [synth-wire] DEBUG: ts-morph unavailable → degrade');
    return { status: 'degrade', original: source, modified: source, degradeReason: 'ts-morph import failed' };
  }

  const exportAssignment = sf.getExportAssignment((ea: any) => !ea.isExportEquals());
  if (!exportAssignment) {
    return { status: 'unrecognised', original: source, modified: source };
  }

  let exportArr: any = exportAssignment.getExpression();
  // isCallExprMode: true when the export is defineConfig(obj, obj, …) — each arg is a
  // flat-config element, not nested inside an array. callExprNode holds the CallExpression.
  let isCallExprMode = false;
  let callExprNode: any = null;
  let identifierExport = false;

  if (exportArr.isKind(SyntaxKind.CallExpression)) {
    if (opts.insertOnly && !isFlatConfigHelperCall(exportArr, SyntaxKind)) {
      return { status: 'unrecognised', original: source, modified: source };
    }
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
    if (opts.insertOnly) {
      identifierExport = true; // wrapped by insertions at the end
    } else {
      exportAssignment.setExpression(`[...${exportArr.getText()}]`);
      exportArr = exportAssignment.getExpression();
    }
  }

  if (!isCallExprMode && !identifierExport && !exportArr.isKind(SyntaxKind.ArrayLiteralExpression)) {
    return { status: 'unrecognised', original: source, modified: source };
  }

  // configElements: the individual flat-config objects to search for the wrapper rule.
  // An identifier's elements live elsewhere — nothing of them is visible here.
  const configElements: any[] = identifierExport
    ? []
    : isCallExprMode
      ? callExprNode.getArguments()
      : exportArr.getElements?.() ?? [];
  // insertOnly: blocks wait here and land as text insertions once every AST edit is done.
  const pending: string[] = [];
  const append = (element: string): void => {
    if (opts.insertOnly) pending.push(element);
    else if (isCallExprMode) callExprNode.addArgument(element);
    else exportArr.addElement(element);
  };

  let changed = false;

  // #829: a net-new `rules-as-tests/*` block must self-register the plugin when the base config
  // does not already register it (RN/ts-server presets) AND the caller supplied an import path.
  // When eligible, each fresh rules-as-tests block carries `plugins: { 'rules-as-tests': … }` and
  // the `import customRules` declaration is injected once after the loop (dedupe-guarded). Without
  // an import path the path degrades to bare (backward-compatible — unit callers pass none).
  const selfRegisterEligible =
    !!opts.customRulesImportPath && !configRegistersRulesAsTestsPlugin(configElements, SyntaxKind);
  let didSelfRegister = false;
  const scopeOf = (ruleKey: string) => opts.scopeFor?.(ruleKey) ?? opts.scope;
  const registerFor = (ruleKey: string): boolean => {
    const yes = selfRegisterEligible && ruleKey.startsWith('rules-as-tests/');
    if (yes) didSelfRegister = true;
    return yes;
  };

  // Live-wins overrides first: replace an existing simple-rule value when the live value differs.
  // insertOnly (a config the consumer owns) changes no value the consumer set: the rule keeps it,
  // and the note names it (cold-review F2 — a deliberate 'off' used to become "error").
  const notes: string[] = [];
  for (const { key, value } of overrides) {
    const desired = buildRuleValueExpr(value);
    const outcome = replaceSimpleRuleValue(configElements, SyntaxKind, key, desired, !opts.insertOnly);
    if (outcome === 'differs') {
      notes.push(`${key} at ${desired} — your config already sets this rule, and getff does not change a setting of yours`);
    } else if (outcome === 'changed') {
      console.debug(`  [synth-wire] DEBUG: live-override replaced value of '${key}'`);
      changed = true;
    } else if (outcome === 'not-found' && opts.insertOnly) {
      // Set where the exported list reaches it only indirectly (`rules: { ...shared }`, `export default config`,
      // `STRICT ? [...base, strict] : base`): an appended block would override the consumer's value, and whether
      // their setting applies at all is not visible here — so it stays, and the note names the rule.
      notes.push(`${key} at ${desired} — your config sets this rule outside the list getff edits, and getff leaves it as it is`);
    } else if (outcome === 'not-found') {
      // Set outside the exported list's own elements — getff's own config lets the live value win by a later block.
      console.debug(`  [synth-wire] DEBUG: override target '${key}' not found as a rules prop — appending`);
      append(buildRuleConfigElement(key, value, scopeOf(key), registerFor(key)));
      changed = true;
    } // 'same' → no change (idempotent)
  }

  for (const { key, value } of missing) {
    changed = true;
    const keyScope = scopeOf(key);
    if (keyScope) {
      console.log(`  [wire:N-rule] scoping ${key} to files=${keyScope.files.join(', ')}`);
    }
    if (Array.isArray(value)) {
      const missingSels = (value.slice(1) as Array<{ selector?: string; message?: string }>).filter(
        (e) => typeof e === 'object' && e !== null && e.selector && !source.includes(e.selector),
      ) as Array<{ selector: string; message?: string }>;
      const merged = mergeSelectorsIntoExistingWrapper(configElements, SyntaxKind, missingSels);
      if (!merged) {
        console.debug(`  [synth-wire] DEBUG: adding new wrapper block for '${key}'`);
        append(buildRuleConfigElement(key, value, scopeOf(key), registerFor(key)));
      } else {
        console.debug(`  [synth-wire] DEBUG: merged ${missingSels.length} selector(s) into existing '${key}' block`);
      }
    } else {
      console.debug(`  [synth-wire] DEBUG: appending simple rule block for '${key}'`);
      append(buildRuleConfigElement(key, value, scopeOf(key), registerFor(key)));
    }
  }

  // Overrides that all matched (outcome 'same') and no missing rules ⇒ byte-identical no-op.
  if (!changed) {
    return { status: 'already-wired', original: source, modified: source, notes };
  }

  // #829: inject the customRules import exactly once when any block self-registered the plugin.
  // Dedupe-guarded (mirror the self-contained variant) so a re-run never adds a second import.
  const needsImport =
    didSelfRegister &&
    !!opts.customRulesImportPath &&
    !sf.getImportDeclarations().some((d: any) => d.getDefaultImport()?.getText() === 'customRules');
  if (!opts.insertOnly) {
    if (needsImport) sf.addImportDeclaration({ defaultImport: 'customRules', moduleSpecifier: opts.customRulesImportPath });
    return { status: 'wired', original: source, modified: sf.getFullText() };
  }
  const text = sf.getFullText();
  const inserts: Insertion[] = [];
  if (pending.length > 0) inserts.push(...exportAppendInsertions(text, exportOfSource(sf).getExpression(), SyntaxKind, pending));
  if (needsImport) inserts.push(importInsertion(sf, text, SyntaxKind, opts.customRulesImportPath!));
  return { status: 'wired', original: source, modified: applyInsertions(text, inserts), notes };
}

// ─── getff's block in a config the CONSUMER owns (operator decision Q4.7, 2026-09-28) ──────
// The install used to keep a consumer-owned eslint config byte-identical and print «add it by hand»
// (the 2026-09-23 skip + report rule): getff's rules then never ran in any project with its own
// config. Now getff writes its block itself, additively — every consumer line stays, in order:
//  - one global-ignores element for the files getff delivered, so the consumer's own lint does not
//    check getff's machinery (a ts-only config reported the bundles' `/* eslint-disable */` banner
//    as an unused directive and failed `--max-warnings=0`);
//  - R2, scoped by a `RULE_GLOBS.boundary` block in the form the shipped gates read
//    (check-rule-globs.sh / check-rule-enforced.sh read its `boundary: [` array, in either quotes); in a
//    root config that sets R2 its own way, the block alone, and the consumer's R2 stays as it is.
// The caller keeps a copy of the original and lint-probes the result (writeWithLintProbe).

export interface OwnConfigOpts {
  /** Paths getff delivered that the consumer's lint must skip — added as one global-ignores element. */
  ignores?: string[];
  /** RULE_GLOBS.boundary for R2. Absent or empty → R2 is not wired (the install found no boundary). */
  boundaryGlobs?: string[];
  /** eslint-rules-local specifier, for the R2 element's plugin registration. */
  customRulesImportPath?: string;
  /**
   * The root config: check-rule-globs.sh reads R2's globs from its RULE_GLOBS.boundary and fails when it
   * sets R2 without one. The gate reads no package config's RULE_GLOBS (a package config that names R2
   * counts as wired), so a package config that sets R2 to 'error' for every file needs nothing added.
   */
  gateReadsRuleGlobs?: boolean;
}

/** A glob as a single-quoted string literal — the form getff's templates write RULE_GLOBS in. */
function singleQuoted(s: string): string {
  return /['\\\n\r\u2028\u2029]/.test(s) ? jsString(s) : `'${s}'`;
}

/** A `RULE_GLOBS = { boundary: [ … ] }` declaration under `comment`, `// prettier-ignore` so the gates keep reading it. */
function ruleGlobsDeclaration(boundary: string[], comment: string[], keyword: 'const' | 'export const'): string {
  return [
    ...comment,
    '// prettier-ignore',
    `${keyword} RULE_GLOBS = {`,
    '  boundary: [',
    ...boundary.map((g) => `    ${singleQuoted(g)},`),
    '  ],',
    '};',
  ].join('\n');
}

/** String values of an array literal's string-literal elements. */
function stringElements(arr: any, SyntaxKind: any): string[] {
  return (arr.getElements?.() ?? [])
    .filter((e: any) => e.isKind(SyntaxKind.StringLiteral) || e.isKind(SyntaxKind.NoSubstitutionTemplateLiteral))
    .map((e: any) => e.getLiteralValue());
}

/** Globs already ignored globally: elements whose only key is `ignores` (ESLint's global-ignores form). */
function globallyIgnored(elements: any[], SyntaxKind: any): Set<string> {
  const out = new Set<string>();
  for (const el of elements) {
    if (!el.isKind?.(SyntaxKind.ObjectLiteralExpression)) continue;
    const props = el.getProperties?.() ?? [];
    if (props.length !== 1) continue;
    let name: string;
    try { name = normPropName(props[0].getName?.()); } catch { continue; }
    const init = props[0].getInitializer?.();
    if (name !== 'ignores' || !init?.isKind?.(SyntaxKind.ArrayLiteralExpression)) continue;
    for (const g of stringElements(init, SyntaxKind)) out.add(g);
  }
  return out;
}

/** The list a flat config's elements live in: an array literal, or a call's arguments (tseslint.config(…)). */
interface ElementList { items: any[]; open: number; close: number }

/**
 * A call to one of the variadic flat-config helpers — `defineConfig(…)` (eslint/config) or
 * `<typescript-eslint import>.config(…)` — whose arguments ARE the config list. Any other call is a
 * factory that reads its own arguments: a block appended to them would load and never run, while the
 * install said «wired» (cold-review F4).
 */
function isFlatConfigHelperCall(call: any, SyntaxKind: any): boolean {
  const callee = call.getExpression();
  if (callee.isKind(SyntaxKind.Identifier)) return callee.getText() === 'defineConfig';
  if (!callee.isKind(SyntaxKind.PropertyAccessExpression)) return false;
  const name = callee.getName();
  if (name === 'defineConfig') return true;
  const obj = callee.getExpression();
  if (name !== 'config' || !obj.isKind(SyntaxKind.Identifier)) return false;
  return call.getSourceFile().getImportDeclarations().some((d: any) =>
    d.getModuleSpecifierValue() === 'typescript-eslint'
    && (d.getDefaultImport()?.getText() === obj.getText() || d.getNamespaceImport()?.getText() === obj.getText()));
}

function elementList(expr: any, SyntaxKind: any): ElementList | undefined {
  if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
    return { items: expr.getElements(), open: expr.getStart(), close: expr.getEnd() - 1 };
  }
  if (expr.isKind(SyntaxKind.CallExpression)) {
    if (!isFlatConfigHelperCall(expr, SyntaxKind)) return undefined;
    const args = expr.getArguments();
    if (args.length > 0 && args[0].isKind(SyntaxKind.ArrayLiteralExpression)) return elementList(args[0], SyntaxKind);
    return { items: args, open: expr.getExpression().getEnd(), close: expr.getEnd() - 1 };
  }
  return undefined;
}

/**
 * The insertion that appends `add` to `list` without touching a character already in the file: a
 * multi-line list gets one item per line at its last item's indentation, in the list's own
 * trailing-comma style (after a trailing line comment, not before it); a one-line list gets `, item`.
 */
function appendInsertion(src: string, list: ElementList, add: string[]): { pos: number; text: string } {
  if (list.items.length === 0) return { pos: list.close, text: add.join(', ') };
  const last = list.items[list.items.length - 1];
  const lastEnd = last.getEnd();
  const comma = /^\s*,/.exec(src.slice(lastEnd, list.close));
  if (src.slice(list.open, list.close).includes('\n')) {
    const lineStart = src.lastIndexOf('\n', last.getStart()) + 1;
    const indent = /^[ \t]*/.exec(src.slice(lineStart))?.[0] ?? '';
    if (!comma) return { pos: lastEnd, text: add.map((a) => `,\n${indent}${a}`).join('') };
    let pos = lastEnd + comma[0].length;
    const eol = src.indexOf('\n', pos);
    if (eol !== -1 && eol < list.close && /^[ \t]*(\/\/.*)?$/.test(src.slice(pos, eol))) pos = eol;
    return { pos, text: add.map((a) => `\n${indent}${a},`).join('') };
  }
  if (comma) return { pos: lastEnd + comma[0].length, text: add.map((a) => ` ${a},`).join('') };
  return { pos: lastEnd, text: add.map((a) => `, ${a}`).join('') };
}

type Insertion = { pos: number; text: string };

/** Apply insertions to `text`, last position first so the earlier positions stay valid. */
function applyInsertions(text: string, inserts: Insertion[]): string {
  let out = text;
  for (const ins of [...inserts].sort((a, b) => b.pos - a.pos)) out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);
  return out;
}

function exportOfSource(sf: any): any {
  return sf.getExportAssignment((ea: any) => !ea.isExportEquals());
}

/** Append `add` to the exported list; an exported identifier becomes `[...name, …]`. */
function exportAppendInsertions(src: string, expr: any, SyntaxKind: any, add: string[]): Insertion[] {
  if (expr.isKind(SyntaxKind.Identifier)) {
    return [{ pos: expr.getStart(), text: '[...' }, { pos: expr.getEnd(), text: `, ${add.join(', ')}]` }];
  }
  return [appendInsertion(src, elementList(expr, SyntaxKind)!, add)];
}

/** `import customRules from …;` on its own line after the last import, in the quotes the file's imports use. */
function importInsertion(sf: any, src: string, SyntaxKind: any, specifier: string): Insertion {
  const imports = sf.getImportDeclarations();
  const quoted = imports[0]?.getModuleSpecifier().getText() ?? sf.getFirstDescendantByKind(SyntaxKind.StringLiteral)?.getText();
  const line = `import customRules from ${quoted?.startsWith('"') ? JSON.stringify(specifier) : singleQuoted(specifier)};`;
  if (imports.length === 0) return { pos: 0, text: `${line}\n` };
  let pos = imports[imports.length - 1].getEnd();
  const eol = src.indexOf('\n', pos);
  if (eol !== -1 && /^[ \t]*(\/\/.*)?$/.test(src.slice(pos, eol))) pos = eol; // after a trailing line comment
  return { pos, text: `\n${line}` };
}

export async function wireOwnConfig(source: string, opts: OwnConfigOpts = {}): Promise<WireResult> {
  let Project: any;
  let SyntaxKind: any;
  try {
    const requireFromCwd = createRequire(resolve(process.cwd(), 'package.json'));
    const mod = await import(pathToFileURL(requireFromCwd.resolve('ts-morph')).href); // GH #642: consumer cwd
    Project = mod.Project;
    SyntaxKind = mod.SyntaxKind;
  } catch {
    return { status: 'degrade', original: source, modified: source, degradeReason: 'ts-morph import failed' };
  }
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, target: 99, module: 99 },
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });
  const sf = project.createSourceFile('eslint.config.mjs', source, { overwrite: true });
  const exportOf = (): any => sf.getExportAssignment((ea: any) => !ea.isExportEquals());
  const exported = exportOf()?.getExpression();
  if (!exported) return { status: 'unrecognised', original: source, modified: source };
  const isIdentifier = exported.isKind(SyntaxKind.Identifier);
  // An identifier's elements live elsewhere — nothing of them is visible here.
  const visible = isIdentifier ? [] : elementList(exported, SyntaxKind)?.items;
  if (!visible) return { status: 'unrecognised', original: source, modified: source };

  const notes: string[] = [];
  const toAdd: string[] = [];
  const ignored = globallyIgnored(visible, SyntaxKind);
  const newIgnores = [...new Set(opts.ignores ?? [])].filter((g) => !ignored.has(g));
  if (newIgnores.length > 0) toAdd.push(`{ ignores: [${newIgnores.map(singleQuoted).join(', ')}] }`);

  // R2: a key in a rules object is a rule entry; a mention in a comment is not (the RULE_GLOBS comment below).
  const r2Present = ruleSetInConfig(sf, SyntaxKind, R2_RULE_ID);
  const boundary = [...new Set(opts.boundaryGlobs ?? [])];
  let registerR2 = false;
  let missingGlobs: string[] = [];
  let ruleGlobsBlock: string | undefined;
  let boundaryArr: any;
  if (boundary.length > 0) {
    // RULE_GLOBS.boundary as check-rule-globs.sh reads it: the key quoted or not, the object inside
    // parentheses, a type assertion (`/** @type {const} */ ({ … })`, `{ … } as const`) or Object.freeze( … ).
    const arrOf = (): any => {
      const wrappers = new Set([SyntaxKind.ParenthesizedExpression, SyntaxKind.AsExpression,
        SyntaxKind.SatisfiesExpression, SyntaxKind.TypeAssertionExpression]);
      const frozen = (n: any): boolean => n.isKind(SyntaxKind.CallExpression)
        && n.getExpression().getText().replace(/\s/g, '') === 'Object.freeze' && n.getArguments().length === 1;
      let init = sf.getVariableDeclaration('RULE_GLOBS')?.getInitializer();
      while (init && (wrappers.has(init.getKind()) || frozen(init))) {
        init = frozen(init) ? init.getArguments()[0] : init.getExpression();
      }
      const prop = init?.isKind(SyntaxKind.ObjectLiteralExpression)
        ? init.getProperties().find((p: any) => normPropName(p.getName?.()) === 'boundary')
        : undefined;
      const arr = prop?.isKind(SyntaxKind.PropertyAssignment) ? prop.getInitializer() : undefined;
      return arr?.isKind(SyntaxKind.ArrayLiteralExpression) ? arr : undefined;
    };
    // No RULE_GLOBS block, but the config sets R2 itself (a hand merge of the snippet the install
    // printed before Q4.7). In the root config check-rule-globs.sh reads R2's globs from RULE_GLOBS.boundary
    // and fails without one (cold-review F11): at 'error' for every file, where getff can read it, the block
    // and the scoped element that uses it add nothing the consumer did not ask for. Set more than once, the
    // last setting wins in ESLint and getff's element would outrank it; set for some files only, getff's
    // element would reach the rest: both read as a setting getff cannot confirm. Such a setting, or any
    // value but 'error', stays as the consumer set it, and the root config gets the block alone — the
    // boundary code the install found, for the gates to read: check-rule-globs.sh passes on it, and
    // check-rule-enforced.sh asks ESLint whether the consumer's R2 is on at 'error' there, which is the
    // question the consumer's own setting answers (operator decision 2026-09-29, «A + name the miss»; it
    // replaced a note that left check:globs red on every push, however R2 was set).
    const r2Mentions = [`'`, `"`, '`'].reduce((n, q) => n + source.split(`${q}${R2_RULE_ID}${q}`).length - 1, 0);
    const r2Setting = !r2Present ? 'not-found'
      : r2Mentions > 1 || ruleSetForSomeFilesOnly(visible, SyntaxKind, R2_RULE_ID) ? 'differs'
        : replaceSimpleRuleValue(visible, SyntaxKind, R2_RULE_ID, "'error'", false);
    // ts-morph finds `const { RULE_GLOBS } = …` by that name too; only `RULE_GLOBS = …` is a declaration of it.
    const plainDecl = !!sf.getVariableDeclaration('RULE_GLOBS')?.getNameNode?.().isKind?.(SyntaxKind.Identifier);
    if (!plainDecl && ruleGlobsBoundElsewhere(sf, SyntaxKind)) {
      // A declaration of getff's would bind the name a second time, a SyntaxError: the lint probe would
      // fail and roll back every getff edit to the config (cold review 2026-09-29).
      notes.push(
        'R2 — the config binds RULE_GLOBS from elsewhere (an import or a destructuring), and getff does not redefine it' +
          (opts.gateReadsRuleGlobs
            ? '; scripts/check-rule-globs.sh reads only a `RULE_GLOBS = …` declared in this file, so it fails on this config'
            : ''),
      );
    } else if (sf.getVariableDeclaration('RULE_GLOBS')) {
      const arr = (boundaryArr = arrOf());
      if (!arr) {
        notes.push(
          'R2 — the config declares its own RULE_GLOBS with no boundary array, and getff does not redefine it' +
            (opts.gateReadsRuleGlobs ? '; scripts/check-rule-globs.sh fails on this config without RULE_GLOBS.boundary' : ''),
        );
      } else {
        const have = new Set(stringElements(arr, SyntaxKind));
        missingGlobs = boundary.filter((g) => !have.has(g));
        registerR2 = !r2Present;
      }
    } else if (r2Present && r2Setting !== 'same') {
      if (opts.gateReadsRuleGlobs) {
        // Nothing in the config reads it, so it is exported: a bare const fails no-unused-vars in the
        // consumer's own lint of this file.
        ruleGlobsBlock = ruleGlobsDeclaration(boundary, [
          '// Added by getff: the HTTP boundary code the install found. Where R2 runs is your own setting in this file;',
          "// check:globs fails when none of these matches a source file, check:enforced when R2 is not 'error' there.",
        ], 'export const');
      } else {
        notes.push(
          `the config sets ${R2_RULE_ID} itself, not to 'error' for every file or not where getff can read it; ` +
            'getff does not change a setting of yours, so it adds nothing for R2',
        );
      }
    } else if (!r2Present || opts.gateReadsRuleGlobs) {
      ruleGlobsBlock = ruleGlobsDeclaration(boundary, [
        '// Added by getff: where its R2 rule looks for an unguarded zod .parse() — the HTTP boundary code the',
        '// install found. check:globs fails when none of these matches a source file; widen the list if that code moves.',
      ], 'const');
      registerR2 = true;
    }
  }
  let importR2 = false;
  if (registerR2) {
    // A files:-scoped block needs its own plugin registration unless one applies to every file (S7-1).
    importR2 = !!opts.customRulesImportPath && !configRegistersRulesAsTestsPlugin(visible, SyntaxKind);
    const plugins = importR2 ? `plugins: { 'rules-as-tests': customRules }, ` : '';
    toAdd.push(`{ files: RULE_GLOBS.boundary, ${plugins}rules: { '${R2_RULE_ID}': 'error' } }`);
  }
  const needsImport = importR2 && !sf.getImportDeclarations().some((d: any) => d.getDefaultImport()?.getText() === 'customRules');

  // Every change lands as a text insertion.
  const current = sf.getFullText();
  const inserts: Insertion[] = [];
  if (missingGlobs.length > 0) {
    inserts.push(appendInsertion(current, elementList(boundaryArr, SyntaxKind)!, missingGlobs.map(singleQuoted)));
  }
  if (toAdd.length > 0) inserts.push(...exportAppendInsertions(current, exportOf().getExpression(), SyntaxKind, toAdd));
  if (needsImport) inserts.push(importInsertion(sf, current, SyntaxKind, opts.customRulesImportPath!));
  if (ruleGlobsBlock) {
    // Right above the export — and above a comment that sits on it, which stays with its export.
    const ea = exportOf();
    const lead = ea.getLeadingCommentRanges();
    inserts.push({ pos: lead.length > 0 ? lead[0].getPos() : ea.getStart(), text: `${ruleGlobsBlock}\n\n` });
  }
  const text = applyInsertions(current, inserts);

  if (text === source) return { status: 'already-wired', original: source, modified: source, notes };
  return { status: 'wired', original: source, modified: text, notes };
}

interface PrettierApi {
  resolveConfig(file: string, opts?: { editorconfig?: boolean }): Promise<Record<string, unknown> | null>;
  check(text: string, opts: Record<string, unknown>): Promise<boolean> | boolean;
  format(text: string, opts: Record<string, unknown>): Promise<string> | string;
}

/**
 * `modified` in the consumer's own prettier style, when their prettier already accepts `original` (Q4.7).
 * format:check (`prettier --check .`) reads a config the consumer owns, so an unformatted insertion into
 * a file prettier accepted would fail every push. A config prettier does not accept, or a project with
 * no prettier, gets `modified` back unchanged: formatting it would rewrite the consumer's own lines.
 * wireOwnConfig marks RULE_GLOBS `// prettier-ignore`, so the gates keep reading it. Options resolve as
 * the prettier CLI resolves them (.editorconfig included).
 */
export async function formatLikeConsumer(configPath: string, cwd: string, original: string, modified: string): Promise<string> {
  let prettier: PrettierApi | undefined;
  for (const base of [dirname(resolve(configPath)), cwd]) {
    try {
      const mod = await import(pathToFileURL(createRequire(resolve(base, 'package.json')).resolve('prettier')).href);
      prettier = (mod.default ?? mod) as PrettierApi;
      break;
    } catch { /* next base */ }
  }
  if (typeof prettier?.format !== 'function' || typeof prettier.check !== 'function') return modified;
  try {
    const options = { ...((await prettier.resolveConfig(configPath, { editorconfig: true })) ?? {}), filepath: configPath };
    if (!(await prettier.check(original, options))) return modified;
    return await prettier.format(modified, options);
  } catch {
    return modified;
  }
}

// ─── Probe-driven resolution (try-bare → escalate → degrade) ────────────────────

/**
 * `unconfirmed`: ESLint ran, but resolved R2 for none of the probe paths — no evidence either way.
 * `timed-out`: a `--print-config` run did not finish within the probe's limit.
 */
export type ProbeVerdict = 'ok' | 'could-not-find-plugin' | 'unavailable' | 'other-error' | 'unconfirmed' | 'timed-out';

export interface ResolveWireArgs {
  configPath: string;
  cwd: string;
  runProbe: (configPath: string, cwd: string, scope?: { files: string[] }) => Promise<ProbeVerdict>;
  /** Workspace scope for scoped emission (SSOT #182). When set, emits { files: [...], rules: {...} }. */
  scope?: { files: string[] };
}

/** Extensions ESLint may lint: its default `files` cover .js/.mjs/.cjs, a TypeScript or JSX block adds the rest. */
const LINTABLE_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts'];

/**
 * Paths handed to `--print-config`, relative to the config's dir: one per lintable extension. It resolves a
 * config per path; no file is read.
 */
const R2_PROBE_PATHS = LINTABLE_EXTENSIONS.map((ext) => `__aif_r2_probe__.${ext}`);

const execFileAsync = promisify(execFile);

/**
 * Limit on one `--print-config` run. It resolves a config and reads no file (~0.45 s measured with the tsx
 * loader), so the limit only has to outlast a slow cold config load — and a run that never finishes (a config
 * whose import blocks, a hung loader) no longer holds the install: the probe reads `timed-out` and the wirer degrades.
 */
const PRINT_CONFIG_TIMEOUT_MS = 60_000;

/** R2's severity in a `--print-config` result (ESLint prints it normalised: `[2]`); 0 when absent or `undefined`. */
function r2SeverityIn(printed: string): number {
  try {
    const cfg = JSON.parse(printed) as { rules?: Record<string, unknown> } | null;
    const entry = cfg?.rules?.[R2_RULE_ID];
    return Array.isArray(entry) && typeof entry[0] === 'number' ? entry[0] : 0;
  } catch {
    return 0;
  }
}

/**
 * Default probe: resolve the consumer's eslint and run `--print-config` on probe paths next to the config.
 * eslint's package `exports` does NOT expose `./bin/eslint.js` (resolve throws ERR_PACKAGE_PATH_NOT_EXPORTED
 * on v9/v10) — resolve the EXPORTED `./package.json` and derive the bin path. GH #644 (#535 trap).
 *
 * `ok` needs ESLint to have resolved R2 for at least one probe path, and no path to fail. `--print-config`
 * exits 0 printing `undefined` for a path no block matches — a `.ts` path under a config that matches no `.ts`,
 * an absolute path through a symlinked dir (macOS /var → /private/var reads as outside the base path), a path
 * outside a `files:` scope — so exit 0 alone proved nothing: the plugin-less bare element passed, and the
 * consumer's lint then died with exit 2, «could not find plugin» (measured with ESLint 9.39.4, 2026-09-28).
 * One path per lintable extension catches a base that registers the plugin for some extensions only (the
 * global bare element reaches the rest); each scope glob gets one path it matches. The paths run in parallel
 * (~0.45 s each with the tsx loader).
 */
export async function probeViaEslint(
  configPath: string,
  cwd: string,
  scope?: { files: string[] },
  opts: { timeoutMs?: number } = {},
): Promise<ProbeVerdict> {
  const timeoutMs = opts.timeoutMs ?? PRINT_CONFIG_TIMEOUT_MS;
  let eslintBin: string;
  try {
    const reqd = createRequire(resolve(cwd, 'package.json'));
    const pj = reqd.resolve('eslint/package.json');
    eslintBin = join(dirname(pj), 'bin', 'eslint.js');
    if (!existsSync(eslintBin)) return 'unavailable';
  } catch {
    return 'unavailable';
  }
  // tsx loader lets eslint load a config that imports a `.ts` barrel on ANY Node (a brownfield
  // consumer's own .nvmrc may pin 20.x/22.0-22.17 — no native type-stripping there; plain node →
  // ERR_UNKNOWN_FILE_EXTENSION. The shipped default .nvmrc is 22.23.1, which strips types natively,
  // but tsx keeps the path uniform across consumer Node versions). tsx is a
  // consumer devDep + the pre-push-hook pattern (build-first-reuse). Absent → plain node (works on
  // Node >=22.18, degrades on 20 — same as the consumer's own `eslint .` would).
  const nodeArgs: string[] = [];
  try {
    createRequire(resolve(cwd, 'package.json')).resolve('tsx');
    nodeArgs.push('--import', 'tsx');
  } catch {
    /* tsx not resolvable → plain node */
  }
  // Run from the config's own directory (dir) so ESLint discovers the workspace-local config; running
  // from project root in multi-stack mode (no root config) fails to load it → 'other-error' → degrade.
  const dir = dirname(resolve(configPath));
  const scoped = (scope?.files ?? []).map(probeScopePath).filter((x): x is string => x !== undefined);
  const paths = [...new Set([...R2_PROBE_PATHS, ...scoped])];
  const runs = await Promise.all(
    paths.map(async (path): Promise<{ resolvedR2: boolean } | { stderr: string } | { timedOut: true }> => {
      try {
        const { stdout } = await execFileAsync(process.execPath, [...nodeArgs, eslintBin, '--print-config', path], {
          cwd: dir,
          maxBuffer: 16 * 1024 * 1024,
          timeout: timeoutMs,
          killSignal: 'SIGKILL',
        });
        return { resolvedR2: r2SeverityIn(stdout) > 0 };
      } catch (e: unknown) {
        // `killed` is set only when execFile itself killed the child, i.e. on the timeout; a child that
        // dies of its own signal (SIGSEGV, a V8 heap-limit abort, the OOM killer) is an error, and its
        // stderr is what the degrade message shows.
        const err = e as { stderr?: string; killed?: boolean };
        if (err.killed) return { timedOut: true };
        return { stderr: String(err.stderr ?? '') };
      }
    }),
  );
  if (runs.some((r) => 'timedOut' in r)) {
    console.error(`  · R2 probe: ESLint did not answer --print-config within ${timeoutMs / 1000} s in ${dir} → degrading`);
    return 'timed-out';
  }
  const failures = runs.flatMap((r) => ('stderr' in r ? [r.stderr] : []));
  if (failures.some((stderr) => /could not find plugin/i.test(stderr))) return 'could-not-find-plugin';
  if (failures.length > 0) {
    // Surface WHY we degrade (e.g. type-aware projectService/tsconfig error) — no silent degrade.
    console.error(`  · R2 probe: unexpected eslint error → degrading:\n${(failures[0] ?? '').slice(0, 400)}`);
    return 'other-error';
  }
  if (runs.some((r) => 'resolvedR2' in r && r.resolvedR2)) return 'ok';
  console.error(`  · R2 probe: ESLint applied ${R2_RULE_ID} to none of ${paths.join(', ')} in ${dir} → degrading`);
  return 'unconfirmed';
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
  // Whether R2 is already set is wireConfigSource's call (step 1), read from the code, not the text.

  // 1. bare
  const bare = await wireConfigSource(original, { variant: 'bare', scope });
  if (bare.status !== 'wired') return bare; // already-wired / unrecognised / degrade — nothing written
  if (scope) {
    console.log(`  [wire:R2] scoped probe target=${configPath} glob=${scope.files.join(', ')}`);
  }
  writeFileSync(configPath, bare.modified, 'utf8');

  // 2. probe
  const v1 = await runProbe(configPath, cwd, scope);
  if (v1 === 'ok') return { ...bare, variant: 'bare' };

  // 3. escalate: self-contained — the bare element reaches a file the base registers no plugin for
  if (v1 === 'could-not-find-plugin') {
    const spec = customRulesImportSpecifier(configPath, cwd);
    const sc = await wireConfigSource(original, { variant: 'self-contained', customRulesImportPath: spec, scope });
    if (sc.status === 'wired') {
      writeFileSync(configPath, sc.modified, 'utf8');
      const v2 = await runProbe(configPath, cwd, scope);
      if (v2 === 'ok') return { ...sc, variant: 'self-contained' };
    }
  }

  // 4. degrade: restore, never leave a half-edit
  writeFileSync(configPath, original, 'utf8');
  return { status: 'degrade', original, modified: original, degradeReason: `probe verdict: ${v1}` };
}

// ─── N-rule post-write lint probe + restore (critical-review wave 2) ─────────────

export interface LintProbeResult {
  verdict: 'ok' | 'broken' | 'unavailable';
  detail?: string;
  /**
   * Why a `broken` config is broken: `parse` — ESLint ran but could not parse a probe file (exit 1);
   * `config` — ESLint could not use the config at all (exit 2). The second is the worse failure.
   */
  failure?: 'parse' | 'config';
  /**
   * What ESLint made of each probed path (relative to the config's dir). writeWithLintProbe compares the
   * paths one by one: an original that already fails on one path says nothing about another.
   */
  paths?: Record<string, LintProbePath>;
}

export interface LintProbePath {
  outcome: 'ok' | 'parse' | 'config' | 'unavailable';
  detail?: string;
}

export interface LintProbeOptions {
  /** `files:` globs of the appended blocks — each is linted at one concrete path per brace alternative. */
  scopeGlobs?: string[];
  /** Per-ESLint-run limit; a run that exceeds it reads as `unavailable`. */
  timeoutMs?: number;
}

const PROBE_BASENAME = '__aif_nrule_probe__';
const PROBE_TIMEOUT_MS = 120_000;
const MISSING_PACKAGE = /Cannot find package '/;

/**
 * One concrete relative path that `glob` matches, for linting a `files:`-scoped block
 * (cold-review F3). `**` segments collapse, `*` directory segments become `x`, a brace list takes its
 * first alternative, and a file-less glob gets a `.js` probe. Negations and character classes have
 * no single obvious witness → undefined (that scope is not probed).
 */
export function probeScopePath(glob: string): string | undefined {
  if (glob.startsWith('!') || /[[\]?]/.test(glob)) return undefined;
  return witnessPath(glob.replace(/\{([^{}]*)\}/g, (_m, alts: string) => alts.split(',')[0] ?? ''));
}

/**
 * probeScopePath for every brace alternative (each list crossed with the others), probeScopePath's own
 * path first: ESLint lints every file a `files:` glob names, so `**\/*.{ts,tsx}` needs a `.tsx` path too.
 */
export function probeScopePaths(glob: string): string[] {
  if (glob.startsWith('!') || /[[\]?]/.test(glob)) return [];
  return [...new Set(braceAlternatives(glob).map(witnessPath).filter((p): p is string => p !== undefined))];
}

function braceAlternatives(glob: string): string[] {
  const m = /\{([^{}]*)\}/.exec(glob);
  if (!m) return [glob];
  const head = glob.slice(0, m.index);
  const tail = glob.slice(m.index + m[0].length);
  return (m[1] ?? '').split(',').flatMap((alt) => braceAlternatives(`${head}${alt}${tail}`));
}

/** The concrete path for a brace-free glob (see probeScopePath). */
function witnessPath(expanded: string): string | undefined {
  const segs = expanded.split('/').filter((seg) => seg !== '**' && seg !== '');
  const last = segs[segs.length - 1];
  let file = `${PROBE_BASENAME}.js`;
  if (last !== undefined && last.includes('*')) {
    segs.pop();
    const ext = /^\*(\.[A-Za-z0-9]+)$/.exec(last)?.[1];
    if (ext === undefined) return undefined;
    file = `${PROBE_BASENAME}${ext}`;
  }
  return [...segs.map((seg) => (seg === '*' ? 'x' : seg)), file].join('/');
}

type EslintRun = { rc: number | 'timeout' | 'error'; text: string };

function runEslint(nodeArgs: string[], eslintBin: string, eslintArgs: string[], dir: string, timeoutMs: number, input?: string): EslintRun {
  try {
    execFileSync(process.execPath, [...nodeArgs, eslintBin, ...eslintArgs], {
      cwd: dir, stdio: 'pipe', timeout: timeoutMs, killSignal: 'SIGKILL', ...(input !== undefined ? { input } : {}),
    });
    return { rc: 0, text: '' };
  } catch (e: unknown) {
    const err = e as { status?: number | null; signal?: string | null; stderr?: Buffer; stdout?: Buffer };
    const text = `${String(err.stderr ?? '')}\n${String(err.stdout ?? '')}`.trim();
    if (err.signal) return { rc: 'timeout', text };
    return { rc: typeof err.status === 'number' ? err.status : 'error', text };
  }
}

/**
 * A typed-lint parser refusing a file outside its tsconfig (typescript-eslint projectService /
 * parserOptions.project) — also reported as a «Parsing error», but about the probe path, not the
 * wiring: the original config refuses the probe the same way.
 */
const TYPED_LINT_REFUSAL = /not found by the project service|parserOptions\.project|allowDefaultProject|default project/;

function verdictOf(run: EslintRun): LintProbeResult {
  // Exit 1 is findings, which the probe files may draw — except a syntax parsing error: the config
  // cannot read the file at all, and `eslint .` would report it on every real file there (Q4.7: a
  // TS-scoped block appended to a consumer config that parses no TypeScript).
  const syntaxError = run.text.split('\n').some((l) => l.includes('Parsing error') && !TYPED_LINT_REFUSAL.test(l));
  if (run.rc === 1 && syntaxError) return { verdict: 'broken', detail: run.text.slice(0, 400), failure: 'parse' };
  if (run.rc === 0 || run.rc === 1) return { verdict: 'ok' };
  if (run.rc === 2) {
    // A missing PACKAGE (bare specifier) means deps are not installed yet — it says nothing about
    // the wiring (cold-review F2). A missing relative module stays `broken`: that can be ours.
    if (MISSING_PACKAGE.test(run.text)) return { verdict: 'unavailable', detail: run.text.slice(0, 400) };
    return { verdict: 'broken', detail: run.text.slice(0, 400), failure: 'config' };
  }
  return { verdict: 'unavailable', detail: run.rc === 'timeout' ? 'ESLint did not finish in time' : run.text.slice(0, 400) };
}

function outcomeOf(r: LintProbeResult): LintProbePath['outcome'] {
  if (r.verdict === 'ok' || r.verdict === 'unavailable') return r.verdict;
  return r.failure ?? 'config';
}

/** Worst first: an exit 2, then a parsing error, then a run that could not finish (it proves nothing). */
const OUTCOME_SEVERITY: Record<LintProbePath['outcome'], number> = { ok: 0, unavailable: 1, parse: 2, config: 3 };

/**
 * Lint throwaway files with the consumer's own ESLint from the config's directory. Unlike
 * probeViaEslint's `--print-config` (config resolution only), this makes ESLint resolve and run every
 * rule of every block matching the file, and parse it — so it also sees a block that leaves the file
 * unparseable. A plugin-less `rules-as-tests/*` block fails both. One real file per lintable extension
 * sits next to the config; each `scopeGlobs` entry is linted through `--stdin-filename` at one path per
 * brace alternative, so no directory is created in the consumer tree. Exit 0/1 means the config loads
 * and lints (1 = the probe file drew findings); exit 2 means ESLint cannot use the config. The verdict
 * is the worst path's: an exit 2, then a parsing error, then a run that could not finish; short of
 * `ok`, `paths` holds every path's outcome.
 */
export async function probeLintViaEslint(configPath: string, cwd: string, opts: LintProbeOptions = {}): Promise<LintProbeResult> {
  const dir = dirname(resolve(configPath));
  // The config's own directory first: a per-workspace config is wired from the project root, where
  // a workspace-only ESLint (no hoisting) does not resolve. Node's lookup still walks up to the root.
  const resolveFrom = (id: string): string | undefined => {
    for (const base of [dir, cwd]) {
      try { return createRequire(resolve(base, 'package.json')).resolve(id); } catch { /* next base */ }
    }
    return undefined;
  };
  const pj = resolveFrom('eslint/package.json');
  if (pj === undefined) return { verdict: 'unavailable' };
  const eslintBin = join(dirname(pj), 'bin', 'eslint.js');
  if (!existsSync(eslintBin)) return { verdict: 'unavailable' };
  // tsx not resolvable → plain node (same fallback as probeViaEslint)
  const nodeArgs: string[] = resolveFrom('tsx') !== undefined ? ['--import', 'tsx'] : [];
  const timeoutMs = opts.timeoutMs ?? PROBE_TIMEOUT_MS;
  // A `.ts` probe carries TypeScript-only syntax, so a config that cannot parse TypeScript there shows;
  // a `.js` probe is an ES module. Every other probe file asks one question — can ESLint use the config
  // for a file at this path — so its body parses as a script, a module, CommonJS and TypeScript alike:
  // only an exit 2 can fail it. `.tsx` stays neutral: a `.ts` block with no TypeScript parser already
  // fails the `.ts` body, and a `{ts,tsx}` block added to it would newly fail a TypeScript `.tsx` body
  // too — a rollback of a sound wiring (2026-09-28).
  const bodyFor = (rel: string): string =>
    /\.ts$/.test(rel) ? 'export const __aif_probe: number = 1;\n'
      : /\.js$/.test(rel) ? 'export const __aif_probe = 1;\n'
        : 'var __aif_probe = 1;\n';
  // One file per lintable extension: `eslint .` also lints `.mjs`/`.cjs` (the config itself) and every
  // extension a block names, and a rule block whose plugin the base registers for some of them only
  // reaches the rest without it — exit 2, «could not find plugin» (measured with ESLint 9.39.4, 2026-09-28).
  // Every path handed to ESLint is relative to its cwd (`dir`): an absolute path through a symlinked
  // dir (macOS /var → /private/var) reads as «outside of base path» — ignored, exit 0, a false ok.
  const names = LINTABLE_EXTENSIONS.map((ext) => `${PROBE_BASENAME}.${ext}`);
  const targets = names.map((n) => resolve(dir, n));
  const runs = new Map<string, LintProbeResult>();
  names.forEach((n, i) => writeFileSync(targets[i], bodyFor(n), 'utf8'));
  try {
    const pooled = verdictOf(runEslint(nodeArgs, eslintBin, names, dir, timeoutMs));
    if (pooled.verdict === 'unavailable') return pooled;
    // One run has one exit code. When it fails, each file is linted alone, so writeWithLintProbe can tell
    // a path the change broke from one the original already fails on (an extension the project lacks).
    // A lone file's detail is also its own error, free of the «File ignored» notices a pooled run prints.
    for (const n of names) runs.set(n, pooled.verdict === 'ok' ? pooled : verdictOf(runEslint(nodeArgs, eslintBin, [n], dir, timeoutMs)));
  } finally {
    for (const t of targets) {
      try { unlinkSync(t); } catch { /* best-effort */ }
    }
  }
  // Each scope at every brace alternative, unless the run above linted that path already.
  for (const rel of new Set((opts.scopeGlobs ?? []).flatMap(probeScopePaths))) {
    if (runs.has(rel)) continue;
    runs.set(rel, verdictOf(runEslint(nodeArgs, eslintBin, ['--stdin', '--stdin-filename', rel], dir, timeoutMs, bodyFor(rel))));
  }
  const paths: Record<string, LintProbePath> = {};
  let worst: LintProbeResult = { verdict: 'ok' };
  for (const [rel, r] of runs) {
    paths[rel] = { outcome: outcomeOf(r), ...(r.detail !== undefined ? { detail: r.detail } : {}) };
    if (OUTCOME_SEVERITY[outcomeOf(r)] > OUTCOME_SEVERITY[outcomeOf(worst)]) worst = r;
  }
  return worst.verdict === 'ok' ? worst : { ...worst, paths };
}

/**
 * A probed path where the modified config fails worse than the original (an exit 2 beats a parsing
 * error); a run that could not finish on either side proves nothing there. Without per-path results,
 * only an exit 2 against an original that merely fails to parse counts.
 */
function worsenedPath(after: LintProbeResult, before: LintProbeResult): LintProbePath | undefined {
  const rank = (o: LintProbePath['outcome']): number => ({ ok: 0, parse: 1, config: 2, unavailable: -1 })[o];
  if (after.paths === undefined || before.paths === undefined) {
    return after.failure === 'config' && before.failure === 'parse' ? { outcome: 'config', detail: after.detail } : undefined;
  }
  for (const [rel, a] of Object.entries(after.paths)) {
    const b = before.paths[rel];
    if (b !== undefined && rank(a.outcome) >= 0 && rank(b.outcome) >= 0 && rank(a.outcome) > rank(b.outcome)) return a;
  }
  return undefined;
}

/**
 * Write `modified`, lint-probe it, and restore `original` only when the probe proves the WIRING broke
 * ESLint: the modified config is broken while the original lints clean, or fails worse than the
 * original on some probed path (worsenedPath). When the original fails too
 * (typed-lint parser setup, plugins not installed yet — cold-review F1/F2) the probe cannot judge the
 * change, so the write stands — the pre-probe behaviour — with a `probeNote` saying it was not
 * verified. An `unavailable` probe likewise proves nothing either way.
 */
export async function writeWithLintProbe(args: {
  configPath: string;
  cwd: string;
  original: string;
  modified: string;
  runProbe: (configPath: string, cwd: string) => Promise<LintProbeResult>;
}): Promise<WireResult> {
  const { configPath, cwd, original, modified, runProbe } = args;
  writeFileSync(configPath, modified, 'utf8');
  const after = await runProbe(configPath, cwd);
  if (after.verdict === 'ok') return { status: 'wired', original, modified };
  if (after.verdict === 'unavailable') {
    return { status: 'wired', original, modified, probeNote: `not verified: ${after.detail ?? 'ESLint could not be run'}` };
  }

  writeFileSync(configPath, original, 'utf8');
  const before = await runProbe(configPath, cwd);
  // Keep a proven-broken write only on evidence the original fails the same probe too: exit 2, or a
  // missing package. A re-check that merely could not run (timeout) is no such evidence (round 2, N6).
  // Nor is an original that fails elsewhere or less badly: a path the change made fail worse — a `.ts`
  // block with no TypeScript parser hid a plugin-less rule block, and an exit 2 on an extension the
  // project lacks hid one on `.ts` (2026-09-28).
  const worse = worsenedPath(after, before);
  const originalFails = worse === undefined && (before.verdict === 'broken' || MISSING_PACKAGE.test(before.detail ?? ''));
  if (!originalFails) {
    return {
      status: 'degrade', original, modified: original,
      degradeReason: `the wiring broke ESLint, so it was rolled back (${worse?.detail ?? after.detail ?? 'exit 2'})`,
    };
  }
  writeFileSync(configPath, modified, 'utf8');
  return {
    status: 'wired', original, modified,
    probeNote: `not verified: ESLint already fails on this config without the change (${before.detail ?? 'exit 2'})`,
  };
}

/**
 * `--own-config` (Q4.7): R2 in a config the consumer owns, added the way synth-and-wire adds getff's
 * block to one (wireOwnConfig): text insertions only, scoped to the HTTP boundary globs found under
 * that config (RULE_GLOBS.boundary), in the consumer's prettier style, lint-probed and rolled back when
 * it breaks ESLint. The AST path (wireConfigSource / resolveAndWire) re-prints the list it edits, which
 * drops the consumer's comments and trailing commas, and adds R2 to every file (cold-review F1/F15), so
 * it serves getff's own configs only. Returns the output lines; anything not added is one
 * «  · not wired: <what> — <why>» line, never a manual step.
 */
export async function wireR2IntoOwnConfig(a: {
  configPath: string;
  cwd: string;
  boundaryGlobs: string[];
  dryRun?: boolean;
  runProbe?: (configPath: string, cwd: string) => Promise<LintProbeResult>;
}): Promise<string[]> {
  const { configPath, cwd } = a;
  const rel = projectRelative(configPath, cwd);
  const notWired = (why: string): string => r2NotWiredLine(configPath, why, cwd);
  const boundaryGlobs = [...new Set(a.boundaryGlobs)];
  if (boundaryGlobs.length === 0) return [`· R2: no HTTP boundary found for ${rel} — nothing for R2 to guard, so it is left as it is`];
  const source = readFileSync(configPath, 'utf8');
  const own = await wireOwnConfig(source, { boundaryGlobs, customRulesImportPath: customRulesImportSpecifier(configPath, cwd) });
  const notes = (own.notes ?? []).map(notWired);
  switch (own.status) {
    case 'already-wired':
      return notes.length > 0 ? notes : [`· R2 already enforced in ${configPath} (no change)`];
    case 'unrecognised':
      return [...notes, notWired('its export is not a flat-config array getff can append to (`export default [...]`, `export default tseslint.config(...)`, `export default defineConfig(...)`), so it added nothing to it')];
    case 'degrade':
      return [...notes, notWired(R2_NO_ENGINE)];
    default:
      break;
  }
  if (a.dryRun) return [`  [dry-run] would add R2 to ${configPath} (insertions only, scoped to RULE_GLOBS.boundary)`, ...notes];
  const styled = await formatLikeConsumer(configPath, cwd, source, own.modified);
  const runProbe = a.runProbe ?? ((p: string, c: string) => probeLintViaEslint(p, c, { scopeGlobs: boundaryGlobs }));
  const final = await writeWithLintProbe({ configPath, cwd, original: source, modified: styled, runProbe });
  if (final.status !== 'wired') return [...notes, notWired(`${final.degradeReason ?? 'ESLint could not use the config with R2 added'}; the config is as it was`)];
  return [
    `  ✓ R2 wired into ${rel} (insertions only, scoped to RULE_GLOBS.boundary)`,
    ...(final.probeNote ? [`    (lint probe ${final.probeNote})`] : []),
    ...notes,
  ];
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
      '  --own-config    The config is the consumer\'s own (Q4.7): add R2 by text insertions only, scoped',
      '                  to --boundary, in its prettier style; anything not added is a «  · not wired:',
      '                  <what> — <why>» line, never a manual step',
      '  --boundary <glob>  (repeatable, with --own-config) HTTP boundary globs found under the config',
      '  --install       The install is running this (Q4.7): never prompt, and report what did not land as',
      '                  one «  · not wired: <what> — <why>» line instead of a snippet to add by hand',
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
  const ownConfig = argv.includes('--own-config');
  const install = argv.includes('--install') || ownConfig;
  const boundaryGlobs = argv.flatMap((v, i) => (v === '--boundary' && i + 1 < argv.length ? [argv[i + 1]] : []));
  // R2 did not land: the install gets one not-wired line with the reason; a human running this CLI
  // directly gets `forHuman`, the snippet to act on. Two audiences, never mixed (Q4.7).
  const notLanded = (why: string, forHuman: string): void => {
    console.log(install ? r2NotWiredLine(configPath, why) : forHuman);
  };

  // Belt-and-suspenders degrade: bash probe should have checked this already
  if (!existsSync('node_modules/ts-morph/package.json')) {
    notLanded(R2_NO_ENGINE, generateDegradedSnippet(configPath));
    process.exit(0);
  }

  if (!existsSync(configPath)) {
    console.log(`· wire-eslint-r2: ${configPath} not found — skipped`);
    process.exit(0);
  }

  if (ownConfig) {
    const lines = await wireR2IntoOwnConfig({ configPath, cwd: process.cwd(), boundaryGlobs, dryRun: dryRun || diffOnly });
    for (const line of lines) console.log(line);
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
      notLanded(R2_NO_ENGINE, generateDegradedSnippet(configPath));
      process.exit(0);
      break;

    case 'unrecognised':
      notLanded(
        'its export is not a shape getff can add R2 to (`export default [...]`, `export default <config>`, `export default defineConfig([...])`), so nothing was added',
        [
          `· R2 not auto-wired: ${configPath} uses an unrecognised export shape.`,
          `  Add manually (adjust the relative path to your eslint-rules-local/):`,
          `    import customRules from './eslint-rules-local/index.mjs';`,
          `    export default [...yourConfig, { plugins: { 'rules-as-tests': customRules }, rules: { '${R2_RULE_ID}': 'error' } }];`,
        ].join('\n'),
      );
      process.exit(0);
      break;

    case 'wired': {
      const diff = buildLineDiff(result.original, result.modified); // bare preview
      if (dryRun || diffOnly) {
        console.log(`Diff for ${configPath}:\n${diff}`);
        process.exit(0);
      }

      console.log(`\nProposed change to ${configPath}:\n${diff}\n`);

      // Only a human at a terminal is asked; the install never waits on a prompt.
      let apply = assumeYes;
      if (!apply && !install && process.stdin.isTTY) {
        const { createInterface } = await import('node:readline');
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((done) => {
          rl.question('Apply this change? [y/N] ', done);
        });
        rl.close();
        apply = /^y(es)?$/i.test(answer.trim());
      }

      if (!apply) {
        notLanded('the wirer was run without --yes, so nothing was written', generateDegradedSnippet(configPath));
        process.exit(0);
      }

      // Apply through the probe loop: bare → escalate to self-contained → degrade.
      const wired = await resolveAndWire({ configPath, cwd: process.cwd(), runProbe: probeViaEslint, scope });
      if (wired.status === 'wired') {
        console.log(`  ✓ R2 wired into ${configPath} (${wired.variant})`);
      } else if (wired.status === 'already-wired') {
        console.log(`· R2 already enforced in ${configPath}`);
      } else {
        notLanded(
          `ESLint could not confirm the config loads with R2 added (${wired.degradeReason ?? 'no verdict'}), so the change was undone and the config is as it was`,
          generateDegradedSnippet(configPath),
        );
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
