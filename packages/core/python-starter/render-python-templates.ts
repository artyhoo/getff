#!/usr/bin/env tsx
// Commit-time render script — python-delivery-v0 umbrella, S1 Task 4.
// Prior-art: docs/meta-factory/prior-art-evaluations.md#212 (ast-grep render backend, ADOPT) +
// #215 (ruff fast-path render backend, ADOPT). This script renders the #217 curated Python
// starter node set (python-starter/starter-nodes.ts) through the ALREADY-ADOPTED pure backends —
// no new render target, no new dependency. Model A: the rendered files are STATIC shipped
// templates committed under packages/core/templates/python/; a byte-drift gate
// (backends/python-templates-drift.test.ts, pre-push §5c via test:backends) keeps them in sync.
//
// SEPARATION OF CONCERNS (brief: "Renderers themselves stay pure — all fs writes live in YOUR
// script"): renderAstgrep / renderRuff are pure (zero fs/network). `planPythonTemplates()` below
// is ALSO pure — it composes the renderers into an in-memory { path, content }[] plan and is what
// the drift gate imports. The ONLY fs writes are in `writePythonTemplates()` / `main()`.
//
// SINGLE-OWNER LANE (coordinator Decision #5 — one rule ships in exactly ONE lane, so a consumer
// never gets a duplicate report for the same convention). Partition is BY NODE KIND, total and
// disjoint over the frozen kind vocabulary {call, attribute, import}:
//   - kind 'call'                 -> ast-grep lane  (renderAstgrep). ruff refuses these FF7001
//     (it bans a qualified NAME, not a `$$$ARGS` call site), so ast-grep is the catch-all.
//   - kind 'attribute' | 'import' -> ruff lane      (renderRuff — TID251 / TID253 fast-path).
// The lane count assertion in planPythonTemplates() fails loudly if a future node carries a kind
// outside this partition (guards against a silent drop).
//
// AST-GREP LAYOUT — ONE RULE PER FILE (single-doc YAML). renderAstgrep([oneNode]) emits a single
// YAML document with its own header. We deliberately do NOT concatenate all four call-kind rules
// into one multi-document file: (a) a `---`-separated multi-doc stream fails a single-document
// validator — the repo's own pre-commit gate runs `python3 -c "yaml.safe_load(open(f))"` on every
// changed *.yml and `safe_load` raises ComposerError on the second document (empirically verified,
// Task 4); (b) one-rule-per-file is the idiomatic ast-grep `ruleDirs` layout. Each committed file
// is therefore renderAstgrep([node]).yaml VERBATIM, which keeps the drift gate a byte comparison.
//
// SGCONFIG (coordinator Decision #4 — our own sgconfig.yml template, NO `ast-grep new` shellout):
// authored here (not renderer output — it is project config, not a rule). Its `ruleDirs` entry is
// written from the CONSUMER's perspective: the path is relative to the installed sgconfig.yml's
// directory (the consumer repo root). The referenced dir MUST exist or `ast-grep scan` aborts
// (exit 6 — Task 2 Probe 6), so the delivery layer (Task 5) copies the rules dir alongside it.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ConventionNode } from '../ir/types.ts';
import { renderAstgrep } from '../backends/astgrep/render-astgrep.ts';
import { renderRuff } from '../backends/ruff/render-ruff.ts';
import { PYTHON_STARTER_NODES } from './starter-nodes.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The committed template tree root: packages/core/templates/python/. */
export const PYTHON_TEMPLATE_DIR = resolve(HERE, '../templates/python');

/**
 * The ast-grep rules directory as the CONSUMER sees it — relative to the installed
 * `sgconfig.yml` (consumer repo root). A namespaced dot-dir: `.getff/` groups every
 * framework-installed artefact under one hidden directory (matching the `getff-*` rule-id
 * namespace + the repo's dot-dir convention — `.claude/`, `.storybook/`, `.prettierignore`),
 * and `astgrep-rules` names the tool + leaves room for sibling tool artefacts under `.getff/`
 * without colliding with a consumer's own conventional `rules/` directory.
 */
export const RULES_DIR = '.getff/astgrep-rules';

/**
 * Hand-authored files committed under {@link PYTHON_TEMPLATE_DIR} that are NOT starter-node
 * renders and so live OUTSIDE this byte-drift gate's render plan. `github-actions-ci.yml` is the
 * S2 consumer CI workflow template — authored directly (a GitHub Actions workflow, not a lint-rule
 * render from PYTHON_STARTER_NODES). Its byte-integrity is guarded by the install fingerprint gate
 * (tests/install-sh/byte-identical.test.sh — the delivered `.github/workflows/getff-python.yml`
 * hash) + tests/install-sh/python-delivery.test.sh (`cmp` template↔delivered), so the render
 * pipeline neither produces it nor should flag it as an orphan. Registered here so the orphan
 * check does not false-positive on it AND so `checkPythonTemplateDrift()` still asserts it EXISTS
 * (a silent deletion surfaces as a `missing` finding — the exclusion is not a blind pass).
 */
export const NON_RENDERED_TEMPLATE_FILES: readonly string[] = [
  'github-actions-ci.yml',
];

/** A single template file, `path` relative to {@link PYTHON_TEMPLATE_DIR}. */
export interface TemplateFile {
  path: string;
  content: string;
}

/** call-kind -> ast-grep lane (Decision #5). */
function astgrepLaneNodes(nodes: ConventionNode[]): ConventionNode[] {
  return nodes.filter((n) => n.params['kind'] === 'call');
}

/** attribute|import-kind -> ruff lane (Decision #5). */
function ruffLaneNodes(nodes: ConventionNode[]): ConventionNode[] {
  return nodes.filter(
    (n) => n.params['kind'] === 'attribute' || n.params['kind'] === 'import',
  );
}

/** The authored sgconfig.yml content (Decision #4). Single-doc YAML, `#` header. */
function renderSgconfig(): string {
  return (
    [
      '# generated by getff — do not edit by hand',
      '# ast-grep project config. `ruleDirs` is resolved RELATIVE TO THIS FILE (the consumer',
      '# repo root where the delivery layer installs it). The referenced directory MUST exist',
      '# or `ast-grep scan` aborts (exit 6) — the delivery layer copies it alongside this file.',
      'ruleDirs:',
      `  - ${RULES_DIR}`,
    ].join('\n') + '\n'
  );
}

/**
 * PURE. Compose the curated starter nodes into the in-memory template-file plan — the exact bytes
 * that must be committed under {@link PYTHON_TEMPLATE_DIR}. No fs, no network. The drift gate and
 * the writer both call this so they can never disagree. Sorted by path for deterministic output.
 */
export function planPythonTemplates(
  nodes: ConventionNode[] = PYTHON_STARTER_NODES,
): TemplateFile[] {
  const astgrep = astgrepLaneNodes(nodes);
  const ruff = ruffLaneNodes(nodes);

  // Total + disjoint partition guard: every node lands in exactly one lane. A future node with an
  // unexpected kind would otherwise be silently dropped from BOTH lanes.
  if (astgrep.length + ruff.length !== nodes.length) {
    const laned = new Set([...astgrep, ...ruff].map((n) => n.id));
    const orphans = nodes.filter((n) => !laned.has(n.id)).map((n) => n.id);
    throw new Error(
      `planPythonTemplates(): ${orphans.length} node(s) match no lane (unexpected kind): ${orphans.join(', ')}`,
    );
  }

  const files: TemplateFile[] = [];

  // ast-grep lane — one single-doc YAML file per rule, verbatim renderer output.
  for (const n of astgrep) {
    const { yaml, outcomes } = renderAstgrep([n]);
    const oc = outcomes.get(n.id);
    if (oc?.kind !== 'rendered') {
      throw new Error(
        `planPythonTemplates(): astgrep-lane node ${n.id} did not render (${oc?.kind ?? 'missing'})`,
      );
    }
    files.push({ path: join(RULES_DIR, `${n.id}.yml`), content: yaml });
  }

  // sgconfig referencing the rules dir (authored — Decision #4).
  files.push({ path: 'sgconfig.yml', content: renderSgconfig() });

  // ruff lane — a single ruff.toml for the whole lane (renderer dedupes + sorts internally).
  const { toml, outcomes } = renderRuff(ruff);
  for (const n of ruff) {
    const oc = outcomes.get(n.id);
    if (oc?.kind !== 'rendered') {
      throw new Error(
        `planPythonTemplates(): ruff-lane node ${n.id} did not render (${oc?.kind ?? 'missing'})`,
      );
    }
  }
  files.push({ path: 'ruff.toml', content: toml });

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Recursively list every file under `dir`, as paths relative to `dir` (posix separators). */
export function listTemplateFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out.push(relative(dir, abs).split('\\').join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** Write the planned template files to disk (the ONLY fs-mutating path). */
export function writePythonTemplates(): TemplateFile[] {
  const files = planPythonTemplates();
  for (const f of files) {
    const abs = join(PYTHON_TEMPLATE_DIR, f.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.content);
  }
  return files;
}

/** A drift finding: a planned file whose committed bytes differ / are missing, or an orphan. */
export interface DriftFinding {
  path: string;
  reason: 'missing' | 'byte-mismatch' | 'orphan';
}

/** PURE (read-only fs). Compare committed template bytes to a fresh render. */
export function checkPythonTemplateDrift(): DriftFinding[] {
  const files = planPythonTemplates();
  const findings: DriftFinding[] = [];
  const plannedPaths = new Set(files.map((f) => f.path));

  for (const f of files) {
    const abs = join(PYTHON_TEMPLATE_DIR, f.path);
    if (!existsSync(abs)) {
      findings.push({ path: f.path, reason: 'missing' });
      continue;
    }
    if (readFileSync(abs, 'utf8') !== f.content) {
      findings.push({ path: f.path, reason: 'byte-mismatch' });
    }
  }
  // Hand-authored (non-rendered) files are guarded elsewhere (see NON_RENDERED_TEMPLATE_FILES),
  // but we still assert they EXIST here so a silent deletion surfaces — the exclusion is not a
  // blind pass.
  for (const p of NON_RENDERED_TEMPLATE_FILES) {
    if (!existsSync(join(PYTHON_TEMPLATE_DIR, p))) {
      findings.push({ path: p, reason: 'missing' });
    }
  }

  // Orphan: a committed file the current plan no longer produces (e.g. a removed node's rule file).
  // Hand-authored non-rendered files are allowlisted so they are not mistaken for stray orphans.
  const allowed = new Set([...plannedPaths, ...NON_RENDERED_TEMPLATE_FILES]);
  for (const committed of listTemplateFiles(PYTHON_TEMPLATE_DIR)) {
    if (!allowed.has(committed)) {
      findings.push({ path: committed, reason: 'orphan' });
    }
  }
  return findings;
}

function main(): void {
  const check = process.argv.includes('--check');
  if (check) {
    const drift = checkPythonTemplateDrift();
    if (drift.length === 0) {
      process.stdout.write('python templates are up-to-date\n');
      process.exit(0);
    }
    process.stderr.write('❌ python template drift detected:\n');
    for (const d of drift) {
      process.stderr.write(`  ${d.reason}: ${d.path}\n`);
    }
    process.stderr.write(
      'Run: npx tsx packages/core/python-starter/render-python-templates.ts\n',
    );
    process.exit(1);
  }
  const files = writePythonTemplates();
  process.stdout.write(
    `wrote ${files.length} python template file(s) under ${relative(resolve(HERE, '../../..'), PYTHON_TEMPLATE_DIR)}/\n`,
  );
  for (const f of files) process.stdout.write(`  ${f.path}\n`);
  process.exit(0);
}

// Run only when invoked directly (`tsx render-python-templates.ts`), never on import — the drift
// gate imports planPythonTemplates() and must not trigger fs writes.
const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1] as string).href;
if (isMain) main();
