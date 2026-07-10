/**
 * audit-ai-docs.ts — Code-vs-docs consistency audit for server-side TypeScript projects.
 * Wave 10.4: bash→TS port with D1–D5 structural hardening (code-fence-aware remark AST,
 * JSON.parse key-match for D2). Prior-art: prior-art-evaluations.md#58 (remark, ADOPT).
 *
 * Full rule mapping (mirrors audit-ai-docs.sh rule header; workflow rule-to-probe grep reads this):
 *   R1  TypeScript hygiene       → delegated to ESLint (no-explicit-any, no-non-null-assertion)
 *   R2  Validation at boundaries → delegated to local ESLint rule (rules-as-tests/no-unsafe-zod-parse)
 *   R3  Architectural boundaries → delegated to dependency-cruiser (run separately)
 *   R4  Tests for new code       → probeR4() — ts-morph: every domain export has .unit.ts
 *   R5  Async correctness        → delegated to ESLint no-floating-promises
 *   R6  Errors                   → delegated to ESLint (no-throw-literal, no-useless-catch)
 *   R7  Time/randomness/IO       → delegated to local ESLint rule (rules-as-tests/no-direct-time-randomness)
 *   R8  Observability            → delegated to local ESLint rule (rules-as-tests/require-otel-span)
 *   R9  Imports/dependencies     → delegated to ESLint (no-restricted-imports)
 *   R10 Naming                   → manual review only (not formalisable)
 *   R11 CI integrity             → manual review only
 *   D1  Skills declared exist    → probeD1() — remark AST (code-fence-aware; ignores negative mentions)
 *   D2  No TODO/_comment in JSON → probeD2() — JSON.parse key-match (not substring grep)
 *   D3  Goal-phrase parity       → probeD3() — includes() check on prose text (authoring repo only; consumer installs skip — see isAuthoringRepo)
 *   D4  Tool-decisions staleness → probeD4() — mtime comparison
 *   D5  Inverse-completeness     → probeD5() — includes() grep over repo files + exemption list (authoring repo only; consumer installs skip — see isAuthoringRepo)
 *
 * skip_unless R4 — active probe (probeR4 function below); all others delegated or manual.
 *
 * Exit codes:
 *   0 — all probes PASS (WARN allowed)
 *   1 — at least one FAIL
 */

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { remark } from 'remark';
import type { Node } from 'unist';
import { visit } from 'unist-util-visit';

// ─── Canonical goal phrases (D3 / D5) ────────────────────────────────────────
export const CANON_PHRASE = "AI agents can't silently bypass undocumented conventions";
export const CANON_ALT    = 'AI cannot silently bypass what fails CI';

export const DOWNSTREAM_DOCS: readonly string[] = [
  '.claude/session-bootstrap.md',
  'CLAUDE.md',
  '.claude/hooks/inject-session-bootstrap.sh',
  'docs/meta-factory/EXECUTION-PLAN.md',
];

/**
 * Mode detection (D3/D5 only): authoring repo vs consumer install.
 *
 * D3/D5 are authoring-repo drift probes — they track goal-phrase parity across
 * THIS framework's own goal-bearing docs, none of which install.sh ships to
 * consumers (it ships AGENTS.md + .ai-factory/RULES.md, which do not carry the
 * canonical phrase). Without this gate every fresh consumer install failed D3
 * (4× "file not found") and D5 (the installed script itself is a phrase-carrying
 * orphan at scripts/audit-ai-docs.sh — TEST_INFRA only exempts the authoring
 * path), making install.sh's "Run ./scripts/audit-ai-docs.sh — should PASS"
 * unsatisfiable (verified 2026-06-11 on a fresh /tmp install).
 *
 * Capability check, not brand-name (dual-implementation-discipline §4): the
 * framework source tree uniquely contains the audit script's own source path;
 * consumer installs receive only scripts/audit-ai-docs.sh (+ the unrelated
 * packages/core/hooks/pre-push.fallback.sh).
 */
export function isAuthoringRepo(cwd: string): boolean {
  return existsSync(join(cwd, 'packages/core/audit-self/audit-ai-docs.sh'));
}

// ─── remark helpers for code-fence-aware parsing (D1) ───────────────────────

/** mdast node types we treat as "code" (skip during prose extraction). */
const CODE_NODE_TYPES = new Set(['code', 'inlineCode']);

/**
 * Extract all prose text from a Markdown string using remark AST.
 * Skips `code` (fenced/indented blocks) and `inlineCode` (backtick-quoted)
 * nodes entirely — addressing D1's phantom-skill-from-code-example false-positive.
 *
 * Also skips HTML comment nodes (type 'html') to avoid matching content in
 * comment annotations.
 */
export function extractProseText(markdown: string): string {
  const tree = remark().parse(markdown);
  const fragments: string[] = [];

  // Walk every node; collect `value` only from non-code leaf nodes
  visit(tree, (node: Node) => {
    if (CODE_NODE_TYPES.has(node.type)) return 'skip'; // skip subtree
    if (node.type === 'html') return 'skip';           // skip HTML comments
    const n = node as Node & { value?: string };
    if (typeof n.value === 'string') {
      fragments.push(n.value);
    }
  });

  return fragments.join('\n');
}

/** Inline AST node types relevant to skill extraction. */
interface AstNode extends Node {
  type: string;
  value?: string;
  children?: AstNode[];
}

/**
 * Extract skill names declared in prose of a Markdown file.
 *
 * The pattern is: prose-text-node "... skill " immediately followed by an
 * inlineCode node "<name>" inside the same paragraph. This is structurally
 * the representation of "skill `<name>`" in mdast.
 *
 * D1 hardening (Wave 10.4):
 *   - code-fence-aware: walks only paragraph/heading children; fenced code
 *     blocks (type='code') are never visited for skill extraction.
 *   - negative-mention filter: if the preceding text node on the same line
 *     contains words like "removed", "deprecated", etc., skip the skill.
 *
 * Implementation note: we cannot simply regex-match the extracted prose text
 * because the backtick-quoted skill name is an `inlineCode` node — its value
 * does NOT appear in prose text extraction (by design). Instead we walk
 * paragraph children directly, looking for text→inlineCode pairs.
 */
export function extractDeclaredSkills(agentsMarkdown: string): string[] {
  const tree = remark().parse(agentsMarkdown) as AstNode;
  const skills = new Set<string>();
  const SKILL_END_RE  = /\bskill\s*$/i;          // "... skill " at end of a text fragment
  const NEGATIVE_RE   = /\b(removed|deprecated|deleted|was|old|former|previously)\b/i;

  /** Walk all paragraph/heading nodes and check for text→inlineCode "skill `name`" pairs. */
  function walkBlock(node: AstNode): void {
    // Recurse into block-level containers (root, list, listItem, blockquote, etc.)
    if (!node.children) return;

    if (CODE_NODE_TYPES.has(node.type)) return;  // skip code fences entirely

    // For paragraphs and headings: scan children for the pattern
    if (node.type === 'paragraph' || node.type === 'heading') {
      const children = node.children ?? [];
      for (let i = 0; i < children.length - 1; i++) {
        const curr = children[i]!;
        const next = children[i + 1]!;
        if (curr.type === 'text' && next.type === 'inlineCode') {
          const textVal = curr.value ?? '';
          const codeName = next.value ?? '';
          if (!SKILL_END_RE.test(textVal)) continue;  // preceding text must end with "skill"
          if (NEGATIVE_RE.test(textVal)) continue;    // negative-mention in preceding text
          // Also check the text node that follows the inlineCode (if any)
          const after = children[i + 2];
          if (after && after.type === 'text' && NEGATIVE_RE.test(after.value ?? '')) continue;
          if (codeName.length > 0) {
            skills.add(codeName);
          }
        }
      }
      return;  // don't recurse into paragraph children (they're inline, not block)
    }

    // Recurse into block containers
    for (const child of node.children) {
      walkBlock(child);
    }
  }

  walkBlock(tree);
  return [...skills].sort();
}

// ─── R4: Tests for new public code (ts-morph via npx tsx) ────────────────────
/**
 * R4 probe: every domain export in src/domain has a matching .unit.ts file.
 * Delegates to `scripts/audit-r4.ts` in the consumer project via npx tsx.
 * Falls back to WARN(skipped) when env lacks Node/tsx/tsconfig.
 *
 * `opts.execSync` is the dependency-injection seam for warm-path tests
 * (DN-1 Path C, 2026-05-25); omit it in prod and contract tests — defaults
 * to the real `execSync` from node:child_process, preserving byte-for-byte
 * subprocess behaviour.
 */
export function probeR4(
  cwd: string,
  opts?: { execSync?: typeof execSync },
): { result: 'pass' | 'fail' | 'warn'; message: string } {
  const exec = opts?.execSync ?? execSync;
  const RULE = 'R4: Every public export in src/domain has matching .unit.ts (ts-morph)';
  if (!existsSync(join(cwd, 'src/domain'))) {
    return { result: 'warn', message: `${RULE} (skipped: no src/domain — probe could not run)` };
  }
  try {
    exec('npx --version', { stdio: 'ignore' });
  } catch {
    return { result: 'warn', message: `${RULE} (skipped: npx not found)` };
  }
  const hasTsconfig = existsSync(join(cwd, 'tsconfig.json'));
  const hasTsMorph  = existsSync(join(cwd, 'node_modules/ts-morph/package.json'));
  if (!hasTsconfig && !hasTsMorph) {
    return { result: 'warn', message: `${RULE} (skipped: no tsconfig.json and ts-morph not installed)` };
  }
  try {
    exec('npx --no-install tsx scripts/audit-r4.ts', { cwd, stdio: 'pipe' });
    return { result: 'pass', message: RULE };
  } catch {
    return { result: 'fail', message: RULE };
  }
}

// ─── D1: Skills declared in AGENTS.md exist on disk ─────────────────────────
/**
 * D1 probe: code-fence-aware + negative-mention-aware skill existence check.
 * Returns list of violation strings (empty = pass).
 */
export function probeD1(cwd: string): string[] {
  const agentsPath = join(cwd, 'AGENTS.md');
  if (!existsSync(agentsPath)) return [];  // no AGENTS.md → skip (no violation)

  const content = readFileSync(agentsPath, 'utf8');
  const skills  = extractDeclaredSkills(content);
  const violations: string[] = [];

  for (const skill of skills) {
    const skillDir = join(cwd, '.claude/skills', skill);
    if (!existsSync(skillDir)) {
      violations.push(`skill '${skill}' declared in AGENTS.md but missing from .claude/skills/`);
    }
  }
  return violations;
}

// ─── D2: No TODO / _comment in JSON configs ───────────────────────────────────
/**
 * D2 probe: detect `_comment` keys or `TODO`/`FIXME` values in JSON configs.
 * Uses JSON.parse + key traversal — not substring grep — so a TODO inside a
 * string value nested under a non-comment key does NOT trigger a false-positive.
 *
 * D2 hardening (Wave 10.4):
 *   bash used grep -E "_comment|TODO|FIXME" which matched those strings ANYWHERE
 *   in the file, including inside legitimate string values. This port matches
 *   `_comment` as a key and `TODO`/`FIXME` as values at any JSON depth.
 */
export interface D2Finding {
  file: string;
  reason: string;
}

const COMMENT_KEY_RE = /_comment/i;
const TODO_VALUE_RE  = /\b(TODO|FIXME)\b/;

/** Recursively walk a JSON value for _comment keys or TODO/FIXME string values. */
function walkJson(val: unknown, path: string, findings: D2Finding[], file: string): void {
  if (val === null || typeof val !== 'object') {
    if (typeof val === 'string' && TODO_VALUE_RE.test(val)) {
      findings.push({ file, reason: `value at ${path} contains TODO/FIXME: "${val}"` });
    }
    return;
  }
  if (Array.isArray(val)) {
    val.forEach((item, i) => walkJson(item, `${path}[${i}]`, findings, file));
    return;
  }
  for (const [key, child] of Object.entries(val as Record<string, unknown>)) {
    if (COMMENT_KEY_RE.test(key)) {
      findings.push({ file, reason: `key "${key}" looks like a comment placeholder` });
    }
    walkJson(child, `${path}.${key}`, findings, file);
  }
}

export function probeD2(cwd: string): D2Finding[] {
  const candidates = [
    join(cwd, '.mcp.json'),
    join(cwd, '.claude/settings.json'),
  ];
  // Also scan .ai-factory/*.json
  const aiFactoryDir = join(cwd, '.ai-factory');
  if (existsSync(aiFactoryDir)) {
    try {
      readdirSync(aiFactoryDir)
        .filter((f) => f.endsWith('.json'))
        .forEach((f) => candidates.push(join(aiFactoryDir, f)));
    } catch { /* ignore unreadable dirs */ }
  }

  const findings: D2Finding[] = [];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
      const rel = filePath.startsWith(cwd + '/') ? filePath.slice(cwd.length + 1) : filePath;
      walkJson(parsed, '$', findings, rel);
    } catch {
      // Malformed JSON — skip silently (not a D2 concern)
    }
  }
  return findings;
}

// ─── D3: Goal-phrase parity ───────────────────────────────────────────────────
/**
 * D3 probe: canonical goal phrase present in all downstream goal-bearing docs.
 */
export function probeD3(cwd: string): string[] {
  const violations: string[] = [];
  for (const docRelPath of DOWNSTREAM_DOCS) {
    const full = join(cwd, docRelPath);
    if (!existsSync(full)) {
      violations.push(`  ${docRelPath}: file not found`);
      continue;
    }
    const text = readFileSync(full, 'utf8');
    if (!text.includes(CANON_PHRASE) && !text.includes(CANON_ALT)) {
      violations.push(`  ${docRelPath}: missing canonical goal phrase or synonym`);
    }
  }
  return violations;
}

// ─── D4: Tool-decisions staleness ────────────────────────────────────────────
/**
 * D4 probe: .ai-factory/tool-decisions.md mtime ≤ package.json mtime.
 * Returns { result, message } — only WARN, never FAIL.
 */
export function probeD4(cwd: string): { result: 'pass' | 'warn'; message: string } {
  const RULE = 'D4 (drift): .ai-factory/tool-decisions.md up-to-date with package.json';
  const pkgPath = join(cwd, 'package.json');
  const decPath = join(cwd, '.ai-factory/tool-decisions.md');

  if (!existsSync(pkgPath)) {
    return { result: 'pass', message: `${RULE} (no package.json — skipped)` };
  }
  if (!existsSync(decPath)) {
    return { result: 'warn', message: `${RULE} — .ai-factory/tool-decisions.md missing; re-run install.sh (auto-seeds it) or /tool-bootstrapping` };
  }
  const pkgMtime = statSync(pkgPath).mtimeMs;
  const decMtime = statSync(decPath).mtimeMs;
  if (pkgMtime > decMtime) {
    return { result: 'warn', message: `${RULE} — package.json is newer than tool-decisions.md; run /tool-bootstrapping to re-evaluate` };
  }
  return { result: 'pass', message: RULE };
}

// ─── D5: Inverse-completeness ────────────────────────────────────────────────
/**
 * D5 probe: every file in the repo with the canonical goal phrase must be
 * enrolled in DOWNSTREAM_DOCS or explicitly exempt. Catches Incident-4.
 *
 * D5 hardening (Wave 10.4):
 *   Added `.stryker-tmp` and `.stryker` to D5_GITIGNORED_PATTERNS to prevent
 *   false-positives from Stryker mutation temp directories that may contain
 *   instrumented copies of source files carrying the canonical phrase.
 */
export interface D5Finding {
  file: string;
  reason: string;
}

/** Patterns for paths that are exempt from D5 (not coverage gaps). */
const D5_FROZEN_RE        = /^(docs\/meta-factory\/research-patches\/|docs\/audits\/)/;
const D5_TEST_INFRA_RE    = /^packages\/core\/audit-self\/audit-ai-docs\.(ts|test\.ts|sh|test\.sh)|^packages\/core\/audit-self\/template-render\.audit\.ts/;
const D5_ROOT_SOURCE_RE   = /^README\.md$/;
const D5_GITIGNORED_RE    = /^(\.claude\/orchestrator-prompts\/|\.stryker-tmp\/|\.stryker\/)/;

export function probeD5(cwd: string): D5Finding[] {
  // Build the enrollment set from DOWNSTREAM_DOCS
  const enrolled = new Set(DOWNSTREAM_DOCS);

  // Find all files containing either canonical phrase (excluding node_modules / .git)
  const found = new Set<string>();
  for (const phrase of [CANON_PHRASE, CANON_ALT]) {
    const files = grepFilesContaining(cwd, phrase);
    files.forEach((f) => found.add(f));
  }

  const findings: D5Finding[] = [];
  for (const file of [...found].sort()) {
    if (enrolled.has(file)) continue;
    if (D5_FROZEN_RE.test(file)) continue;
    if (D5_TEST_INFRA_RE.test(file)) continue;
    if (D5_ROOT_SOURCE_RE.test(file)) continue;
    if (D5_GITIGNORED_RE.test(file)) continue;
    findings.push({
      file,
      reason: `contains canonical phrase but not in DOWNSTREAM_DOCS or any exemption`,
    });
  }
  return findings;
}

/**
 * Recursively find files under `cwd` containing `phrase`, excluding
 * node_modules, .git, .stryker-tmp, and .stryker directories.
 */
function grepFilesContaining(cwd: string, phrase: string): string[] {
  const results: string[] = [];
  const SKIP_DIRS = new Set(['node_modules', '.git', '.stryker-tmp', '.stryker']);

  function walk(dir: string): void {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { walk(full); continue; }
      try {
        const content = readFileSync(full, 'utf8');
        if (content.includes(phrase)) {
          // Return relative to cwd
          const rel = full.startsWith(cwd + '/') ? full.slice(cwd.length + 1) : full;
          results.push(rel);
        }
      } catch { /* binary or unreadable — skip */ }
    }
  }

  walk(cwd);
  return results;
}

// ─── Audit result types ───────────────────────────────────────────────────────

export type ProbeLevel = 'pass' | 'fail' | 'warn';

export interface ProbeResult {
  probe: string;
  level: ProbeLevel;
  message: string;
  details: string[];
}

export interface AuditReport {
  results: ProbeResult[];
  passCount: number;
  failCount: number;
  warnCount: number;
}

// ─── runAudit() — pure orchestration, returns data (no side effects) ──────────
/**
 * Run all probes and return a structured report. No console I/O, no process.exit.
 * This is the testable core — the CLI shell wraps it with I/O.
 *
 * @param cwd - The working directory to audit (defaults to process.cwd()).
 * @param only - If non-empty, only run the probe matching this name (like --only=D1).
 */
export function runAudit(cwd: string = process.cwd(), only: string = ''): AuditReport {
  const results: ProbeResult[] = [];

  function shouldSkip(probe: string): boolean {
    if (!only) return false;
    return only !== probe;
  }

  // ── R4 ──────────────────────────────────────────────────────────────────────
  if (!shouldSkip('R4')) {
    const r4 = probeR4(cwd);
    results.push({ probe: 'R4', level: r4.result, message: r4.message, details: [] });
  }

  // ── D1 ──────────────────────────────────────────────────────────────────────
  if (!shouldSkip('D1')) {
    const RULE = 'D1 (drift): skills declared in AGENTS.md exist on disk';
    if (!existsSync(join(cwd, 'AGENTS.md'))) {
      results.push({ probe: 'D1', level: 'warn', message: `${RULE}: AGENTS.md not found, skipping`, details: [] });
    } else {
      const viols = probeD1(cwd);
      if (viols.length === 0) {
        results.push({ probe: 'D1', level: 'pass', message: RULE, details: [] });
      } else {
        results.push({ probe: 'D1', level: 'fail', message: RULE, details: viols });
      }
    }
  }

  // ── D2 ──────────────────────────────────────────────────────────────────────
  if (!shouldSkip('D2')) {
    const RULE = 'D2 (drift): no TODO/_comment in JSON configs';
    const d2Findings = probeD2(cwd);
    if (d2Findings.length === 0) {
      results.push({ probe: 'D2', level: 'pass', message: RULE, details: [] });
    } else {
      results.push({
        probe: 'D2',
        level: 'warn',
        message: `${RULE} — JSON configs accumulate stale comments`,
        details: d2Findings.map((f) => `${f.file}: ${f.reason}`),
      });
    }
  }

  // ── D3 ──────────────────────────────────────────────────────────────────────
  if (!shouldSkip('D3')) {
    const RULE = 'D3 (drift): canonical goal phrase present in downstream goal-bearing docs';
    if (!isAuthoringRepo(cwd)) {
      results.push({
        probe: 'D3',
        level: 'pass',
        message: `${RULE} (skipped: consumer install — authoring-repo goal docs are not part of the shipped payload)`,
        details: [],
      });
    } else {
      const d3Viols = probeD3(cwd);
      if (d3Viols.length === 0) {
        results.push({ probe: 'D3', level: 'pass', message: RULE, details: [] });
      } else {
        results.push({ probe: 'D3', level: 'fail', message: RULE, details: d3Viols });
      }
    }
  }

  // ── D4 ──────────────────────────────────────────────────────────────────────
  if (!shouldSkip('D4')) {
    const d4 = probeD4(cwd);
    results.push({ probe: 'D4', level: d4.result, message: d4.message, details: [] });
  }

  // ── D5 ──────────────────────────────────────────────────────────────────────
  if (!shouldSkip('D5')) {
    const RULE = 'D5 (drift, inverse): every file with canonical phrase is enrolled or exempt';
    if (!isAuthoringRepo(cwd)) {
      results.push({
        probe: 'D5',
        level: 'pass',
        message: `${RULE} (skipped: consumer install — inverse enrollment tracks the framework authoring repo)`,
        details: [],
      });
    } else {
      const d5Findings = probeD5(cwd);
      if (d5Findings.length === 0) {
        results.push({ probe: 'D5', level: 'pass', message: RULE, details: [] });
      } else {
        results.push({
          probe: 'D5',
          level: 'fail',
          message: RULE,
          details: [
            ...d5Findings.map((f) => `${f.file}: ${f.reason}`),
            '',
            'Fix: add the file to DOWNSTREAM_DOCS in audit-ai-docs.ts,',
            '     OR add a justified pattern to D5_FROZEN/TEST_INFRA/ROOT_SOURCE/GITIGNORED.',
          ],
        });
      }
    }
  }

  const passCount = results.filter((r) => r.level === 'pass').length;
  const failCount = results.filter((r) => r.level === 'fail').length;
  const warnCount = results.filter((r) => r.level === 'warn').length;
  return { results, passCount, failCount, warnCount };
}

// ─── CLI entrypoint ────────────────────────────────────────────────────────────
/**
 * Print a report to stdout with ANSI colours (if TTY) and exit.
 * This is the I/O shell around `runAudit()`.
 */
export function main(cwd: string = process.cwd(), argv: string[] = process.argv): void {
  const useColour = process.stdout.isTTY;
  const RED    = useColour ? '\x1b[0;31m' : '';
  const GREEN  = useColour ? '\x1b[0;32m' : '';
  const YELLOW = useColour ? '\x1b[1;33m' : '';
  const NC     = useColour ? '\x1b[0m'    : '';

  const onlyArg = argv.slice(2).find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length) : '';

  const report = runAudit(cwd, only);

  for (const r of report.results) {
    const prefix = r.level === 'pass' ? `${GREEN}PASS${NC}` :
                   r.level === 'fail' ? `${RED}FAIL${NC}` :
                   `${YELLOW}WARN${NC}`;
    console.log(`${prefix}: ${r.message}`);
    for (const detail of r.details) {
      console.log(`    ${detail}`);
    }
  }

  console.log('');
  console.log('─────────────────────────────────────────');
  console.log(`Audit complete: ${report.passCount} PASS, ${report.failCount} FAIL, ${report.warnCount} WARN`);

  if (report.failCount > 0) process.exit(1);
  process.exit(0);
}

// Run when invoked directly (not when imported by tests)
if (
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  (process.argv[1].endsWith('audit-ai-docs.ts') || process.argv[1].endsWith('audit-ai-docs.js'))
) {
  main();
}
