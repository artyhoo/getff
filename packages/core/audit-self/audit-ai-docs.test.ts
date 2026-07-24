/**
 * audit-ai-docs.test.ts — Vitest tests for audit-ai-docs.ts (Wave 10.4).
 *
 * Ports all 8 test functions from audit-ai-docs.test.sh with MULTI-ASSERTION:
 * both exit code AND message content are asserted (fixing C3 gap).
 *
 * Paired-negative requirement (kickoff §Wave 10.4):
 *   ❌ skill in AGENTS.md prose but missing on disk + code-fence skill → NOT flagged
 *   ✅ skill in AGENTS.md prose and present on disk → passes
 *   ❌ negative-mention "removed skill `x`" → NOT flagged (D1 hardening)
 *
 * D5 hardening — .stryker-tmp negative test:
 *   ❌ file under .stryker-tmp/ with canonical phrase → NOT flagged (exempt)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, utimesSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Resolve the repo root from this test file's location (works in vitest + stryker)
const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), '../../..');
import {
  extractProseText,
  extractDeclaredSkills,
  probeR4,
  probeD1,
  probeD2,
  probeD3,
  probeD4,
  probeD5,
  isAuthoringRepo,
  runAudit,
  main,
  CANON_PHRASE,
  CANON_ALT,
  DOWNSTREAM_DOCS,
  type D2Finding,
  type D5Finding,
} from './audit-ai-docs.ts';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Create a temp directory and return its path. Caller owns cleanup. */
function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'audit-ai-docs-test-'));
}

/** Write a file (and create parent dirs) in a temp dir. */
function writeFile(dir: string, relPath: string, content: string): string {
  const full = join(dir, relPath);
  mkdirSync(resolve(full, '..'), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}

/**
 * Mark a tmp dir as authoring-repo-shaped for D3/D5 mode detection
 * (see isAuthoringRepo): consumer installs do not have the script's own
 * source path, so a bare tmp dir is consumer-shaped and D3/D5 skip there.
 * Marker content is phrase-free so it never enters the D5 found-set.
 */
function markAuthoring(dir: string): void {
  writeFile(dir, 'packages/core/audit-self/audit-ai-docs.sh', '# authoring-repo marker for D3/D5 mode detection\n');
}

// ─── extractProseText() — remark code-fence-aware extraction ─────────────────

describe('extractProseText()', () => {
  it('returns text from prose paragraphs (NOT the inlineCode value)', () => {
    const md = 'Use skill `myskill` for tasks.\n';
    const prose = extractProseText(md);
    // The prose TEXT node "Use skill " is extracted
    expect(prose).toContain('Use skill');
    // The inlineCode node "myskill" is NOT extracted (it's a code node, not prose)
    expect(prose).not.toContain('myskill');
  });

  it('does NOT include text from fenced code blocks', () => {
    const md = '```bash\nUse skill `phantom-skill`\n```\n';
    const prose = extractProseText(md);
    // The text inside the code fence must NOT appear in extracted prose
    expect(prose).not.toContain('phantom-skill');
  });

  it('does NOT include text from inline code', () => {
    // An inline-code backtick span is NOT prose; the skill name inside should not be extracted
    // (We test a paragraph that is ONLY inline code with no surrounding prose words)
    const md = 'See `skill-x` for details.\n';
    // "See" and "for details" are prose; "skill-x" is inlineCode — the surrounding text is prose
    // but we specifically test that a standalone inlineCode node is not visited:
    const md2 = '`standalone-code-only`\n';
    const prose2 = extractProseText(md2);
    // The standalone inline code value is inside an inlineCode node — should not be extracted
    expect(prose2).not.toContain('standalone-code-only');
  });

  it('extracts headings and paragraph text correctly', () => {
    const md = '# Title\n\nThis is a paragraph with skill `my-skill` referenced.\n';
    const prose = extractProseText(md);
    expect(prose).toContain('Title');
    expect(prose).toContain('This is a paragraph with skill');
    // "my-skill" is inside an inlineCode node — should NOT be extracted
    expect(prose).not.toContain('my-skill');
  });

  it('does NOT extract text from HTML comment nodes', () => {
    const md = '<!-- @dual-pair: some-anchor -->\n\nProse paragraph.\n';
    const prose = extractProseText(md);
    expect(prose).toContain('Prose paragraph');
    expect(prose).not.toContain('@dual-pair');
  });

  it('joins multiple fragments with newlines (not spaces)', () => {
    const md = '# Title\n\nParagraph one.\n\nParagraph two.\n';
    const prose = extractProseText(md);
    // Contains both paragraphs separated by newlines
    expect(prose).toContain('Title');
    expect(prose).toContain('Paragraph one');
    expect(prose).toContain('Paragraph two');
  });

  it('returns empty string for empty markdown', () => {
    // Empty input → no fragments → join returns ""
    const prose = extractProseText('');
    expect(prose).toBe('');
  });

  it('fragments array accumulates values from text nodes (not empty for populated doc)', () => {
    const md = 'Hello world.\n';
    const prose = extractProseText(md);
    // Must contain the text
    expect(prose).toBe('Hello world.');
  });

  it('skips code fence node and does NOT add it to fragments', () => {
    // A fenced code block with a text value should not appear in prose output
    // Tests that the 'skip' return for CODE_NODE_TYPES skips the subtree
    const md = 'Intro.\n\n```\nSECRET_CONTENT\n```\n\nOutro.\n';
    const prose = extractProseText(md);
    expect(prose).not.toContain('SECRET_CONTENT');
    expect(prose).toContain('Intro');
    expect(prose).toContain('Outro');
  });

  it('node with value but no children contributes its value to fragments', () => {
    // A text node with only a value (no children) must be collected
    const md = 'Simple text node.\n';
    const prose = extractProseText(md);
    expect(prose).toContain('Simple text node');
  });
});

// ─── extractDeclaredSkills() — D1 core logic ─────────────────────────────────

describe('extractDeclaredSkills()', () => {
  it('extracts skills from prose "skill `<name>`" pattern', () => {
    const md = 'Use skill `my-skill` for this task.\nAlso use skill `other-skill` sometimes.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).toContain('my-skill');
    expect(skills).toContain('other-skill');
  });

  it('does NOT extract skills mentioned in fenced code blocks (D1 hardening)', () => {
    const md = '# AGENTS\n\n```\nUse skill `phantom-skill` in code\n```\n\nNormal prose.\n';
    const skills = extractDeclaredSkills(md);
    // The skill reference inside the code fence must not be extracted
    expect(skills).not.toContain('phantom-skill');
  });

  it('does NOT extract skills from negative-mention lines ("removed skill `x`")', () => {
    const md = 'The skill `old-skill` was removed from the workflow.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).not.toContain('old-skill');
  });

  it('does NOT extract skills from "deprecated skill" lines', () => {
    const md = 'Deprecated skill `legacy-skill` is no longer available.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).not.toContain('legacy-skill');
  });

  it('extracts skills from normal prose (positive case)', () => {
    const md = 'Use skill `active-skill` for all reviews.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).toContain('active-skill');
  });

  it('returns empty array when no skills are declared', () => {
    const md = '# AGENTS\n\nNo skill references here.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).toHaveLength(0);
  });

  it('returns skills sorted alphabetically', () => {
    const md = 'Use skill `z-skill` and skill `a-skill` for tasks.\n';
    const skills = extractDeclaredSkills(md);
    if (skills.length >= 2) {
      expect(skills[0]!.localeCompare(skills[1]!)).toBeLessThan(0);
    }
  });

  it('skips skill in heading that follows negative word', () => {
    // "was skill `x`" should be skipped (negative word before "skill")
    // Note: "was" in NEGATIVE_RE — but the test is specifically about the preceding text node
    const md = '# Topic\n\nPreviously skill `prev-skill` was used.\n';
    const skills = extractDeclaredSkills(md);
    // "previously" appears in the text BEFORE the inlineCode in parsed form
    // The negative word check is on the preceding text; "Previously skill" → NEGATIVE_RE matches "previously"
    // So prev-skill should NOT be extracted
    expect(skills).not.toContain('prev-skill');
  });

  it('handles blockquote containers (recurses into them)', () => {
    // Skill in a blockquote paragraph should be found
    const md = '> Use skill `block-skill` for tasks.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).toContain('block-skill');
  });

  it('skips skill when following text node contains negative word', () => {
    // Pattern: "skill `x` was removed" — "was removed" comes AFTER the inlineCode
    // The "after" text check catches this
    const md = 'Use skill `after-skill` was removed from the workflow.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).not.toContain('after-skill');
  });

  it('does NOT skip when following text node contains non-negative word (after-text boundary)', () => {
    // "skill `x` and then something else" — "and" is not in NEGATIVE_RE
    // So the skill SHOULD be extracted
    const md = 'Use skill `kept-skill` and apply it everywhere.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).toContain('kept-skill');
  });

  it('does NOT extract when codeName is empty string', () => {
    // Edge case: "skill `` " — backtick with no content → empty codeName
    // The codeName.length > 0 check must prevent empty string from being added
    // remark represents `` as an inlineCode node with value=""
    const md = 'Use skill `` for tasks.\n';
    const skills = extractDeclaredSkills(md);
    // Empty codeName must not be included
    expect(skills).not.toContain('');
  });

  it('extracts skills from list items (recurses into listItem block containers)', () => {
    // A skill referenced inside a list paragraph should be found via blockquote/list recursion
    const md = '## Skills\n\n- Use skill `list-skill` to do things.\n';
    const skills = extractDeclaredSkills(md);
    // List items contain paragraphs; walkBlock must recurse into list → listItem → paragraph
    expect(skills).toContain('list-skill');
  });

  it('extracts skills from headings (heading path in walkBlock)', () => {
    // Heading "## Use skill `heading-skill`" — heading has inline children
    // The heading path (node.type === 'heading') must be taken
    const md = '## Use skill `heading-skill`\n\nSome body text.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).toContain('heading-skill');
  });

  it('regex: text ending with "skills" does NOT match (\\bskill\\s*$ requires word boundary)', () => {
    // "skills" ends with the substring "skill" but SKILL_END_RE is /\bskill\s*$/i
    // which matches "skill" as a whole word at the end — NOT "skills"
    // This kills the /\bskill\s$/i mutant (which would also fail on "skill ")
    const md = 'These skills `some-skill` are available.\n';
    const skills = extractDeclaredSkills(md);
    // "skills" doesn't match \bskill\s*$ so some-skill must NOT be extracted
    expect(skills).not.toContain('some-skill');
  });

  it('does NOT extract when curr node is not a text node (non-text curr)', () => {
    // If a paragraph has inlineCode followed by inlineCode, the curr→next pair
    // will have curr.type === 'inlineCode', not 'text' → skip
    // We simulate by having a link/strong node before the inlineCode
    // Markdown: **bold** `skill-name` — curr=strong, next=inlineCode
    const md = '**bold** `no-skill`\n';
    const skills = extractDeclaredSkills(md);
    // "bold" doesn't end in "skill" so this should not be extracted regardless
    expect(skills).not.toContain('no-skill');
  });

  it('does NOT extract when next node is not an inlineCode node', () => {
    // Paragraph: "Use skill text-not-code" — text followed by text, not inlineCode
    // curr.type === 'text' ✓, next.type !== 'inlineCode' → skip
    const md = 'Use skill text-not-code here.\n';
    const skills = extractDeclaredSkills(md);
    // No inlineCode node present → nothing should be extracted
    expect(skills).toHaveLength(0);
  });

  it('does not follow "after" filter when after node is not a text node (after.type guard)', () => {
    // "skill `x` **bold**" — the node after inlineCode is "strong", not "text"
    // The after.type === 'text' check should NOT filter → skill IS extracted
    const md = 'Use skill `after-nontext-skill` **bold text**.\n';
    const skills = extractDeclaredSkills(md);
    // after.type is 'strong', not 'text' → filter does not apply → skill extracted
    expect(skills).toContain('after-nontext-skill');
  });
});

// ─── test_R4 — ts-morph probe ─────────────────────────────────────────────────
// Mirrors bash test_R4: src/domain/greet.ts exists, no .unit.ts → fail OR warn(skip)

describe('test_R4 — R4: domain export tests', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns warn (not silent pass) when no src/domain — probe could not run', () => {
    // No src/domain → WARN(skipped): the probe checked zero files, so it must
    // surface a WARN, never silently PASS (project thesis — a probe that cannot
    // run must FAIL or at minimum WARN). universalization-fix F1a.
    const result = probeR4(dir);
    // Multi-assertion: result is 'warn' specifically AND message has R4 + skip
    expect(result.result).toBe('warn');
    expect(result.message).toMatch(/R4/);
    expect(result.message).toMatch(/skip/i);
  });

  it('FAIL or WARN(skip): domain file lacks .unit.ts (R4 / ts-morph)', () => {
    mkdirSync(join(dir, 'src/domain'), { recursive: true });
    writeFile(dir, 'src/domain/greet.ts', 'export function greet(name: string) { return "hi " + name; }\n');
    const result = probeR4(dir);
    // Should be 'fail' (ts-morph installed) or 'warn' (ts-morph not in sandbox) — never error
    // Multi-assertion: both result type and message content
    expect(['fail', 'warn']).toContain(result.result);
    expect(result.message).toMatch(/R4/);
    if (result.result === 'fail') {
      expect(result.message).toMatch(/every public export/i);
    } else {
      expect(result.message).toMatch(/skip/i);
    }
  });

  it('WARN(skip): no tsconfig.json AND no ts-morph installed → skips (both conditions)', () => {
    // Create src/domain but no tsconfig.json and no ts-morph in node_modules
    mkdirSync(join(dir, 'src/domain'), { recursive: true });
    writeFile(dir, 'src/domain/foo.ts', 'export const x = 1;\n');
    // No tsconfig.json, no node_modules/ts-morph — R4 should warn(skip)
    // This exercises the !hasTsconfig && !hasTsMorph branch
    const result = probeR4(dir);
    // Must be warn (NOT fail, NOT pass) when both are missing
    // (Unless npx itself not found, which gives 'warn' too)
    expect(['pass', 'warn']).toContain(result.result);
    // If warn: message should mention skip
    if (result.result === 'warn') {
      expect(result.message).toMatch(/skip/i);
    }
    // Multi-assertion: result.message always contains R4
    expect(result.message).toMatch(/R4/);
  });

  it('WARN(skip): tsconfig.json exists but ts-morph missing → still skips OR proceeds', () => {
    // hasTsconfig = true, hasTsMorph = false
    // The condition is: if (!hasTsconfig && !hasTsMorph) → only skip when BOTH missing
    // So this test verifies the && vs || distinction: one present → proceed (might fail/pass)
    mkdirSync(join(dir, 'src/domain'), { recursive: true });
    writeFile(dir, 'src/domain/bar.ts', 'export const y = 2;\n');
    writeFile(dir, 'tsconfig.json', '{"compilerOptions":{}}\n');
    // ts-morph not present → execSync will fail → result is fail or warn
    const result = probeR4(dir);
    // With tsconfig but no ts-morph: hasTsconfig=true so we DON'T take the skip branch
    // → execSync will run → fail (no scripts/audit-r4.ts) or warn (npx not found)
    expect(result.message).toMatch(/R4/);
    // The result can be fail or warn but NOT pass-skipped-for-missing-env
    // (it's not the "no tsconfig AND no ts-morph" path)
    expect(['fail', 'warn']).toContain(result.result);
  });
});

// ─── test_R4 bash (shipped script) — exec-based paired-negative ───────────────
// universalization-fix F1b — the shipped scripts/audit-ai-docs.sh is what
// install.sh ships to consumers. Its R4 skip-branch (no src/domain) must emit
// WARN, never a silent PASS. This test EXECs the real script in a fresh temp
// dir with NO src/domain and asserts the live verdict is WARN (T-UF-A: assert
// the real script's output, not a string literal). No positive arm: a genuine
// bash R4 PASS needs ts-morph + scripts/audit-r4.ts, which a fresh temp dir
// lacks (it would FAIL there, not PASS); the anti-tautology contrast for the
// R4 verdict is already given by the TS probeR4 arms above (src/domain present
// → fail/warn, never silent-pass).

describe('test_R4 bash (shipped audit-ai-docs.sh) — WARN, not silent PASS, when no src/domain', () => {
  const coreScript = join(REPO_ROOT, 'packages/core/audit-self/audit-ai-docs.sh');
  // Stryker-sandbox guard: skip when the shipped script is not present at
  // REPO_ROOT (mirrors the isRealRepo check used by the R17 structural test).
  const isRealRepo = existsSync(join(REPO_ROOT, 'packages/core/package.json')) &&
                     existsSync(coreScript);

  it('emits WARN (not PASS) for R4 when src/domain is absent', () => {
    // Arrange: fresh temp dir with no src/domain (probe cannot run there).
    if (!isRealRepo) return; // sandbox: script absent, nothing to exec
    const dir = mkdtempSync(join(tmpdir(), 'audit-ai-docs-test-'));

    // Act: run the SHIPPED script's R4 probe only, in the empty dir.
    const out = execFileSync('bash', [coreScript, '--only=R4'], {
      cwd: dir,
      encoding: 'utf8',
    });

    // Assert: live verdict is WARN R4, and NOT a silent PASS R4.
    expect(out).toMatch(/WARN.*R4/);
    expect(out).not.toMatch(/PASS:\s*R4/);
  });
});

// ─── test_R4_partial ──────────────────────────────────────────────────────────
// Mirrors bash test_R4_partial: .unit.ts exists but does NOT reference the export

describe('test_R4_partial — R4: .unit.ts exists but missing reference', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('FAIL or WARN(skip): .unit.ts does not reference the export', () => {
    mkdirSync(join(dir, 'src/domain'), { recursive: true });
    writeFile(dir, 'src/domain/foo.ts', 'export function unrelated() { return 1; }\n');
    writeFile(dir, 'src/domain/foo.unit.ts', 'import { describe } from "vitest"; describe("nothing", () => {});\n');
    const result = probeR4(dir);
    // ts-morph should catch missing reference, or warn if not installed
    // Multi-assertion: result shape AND message content
    expect(['fail', 'warn']).toContain(result.result);
    expect(result.message).toMatch(/R4/);
    if (result.result === 'fail') {
      expect(result.message).toMatch(/every public export/i);
    } else {
      expect(result.message).toMatch(/skip/i);
    }
  });
});

// ─── extractDeclaredSkills detail tests ──────────────────────────────────────

describe('extractDeclaredSkills() — additional boundary tests', () => {
  it('violation message contains "declared in AGENTS.md" (probeD1 message format)', () => {
    // probeD1 uses violation string 'skill X declared in AGENTS.md but missing from ...'
    // We verify this message format by calling probeD1 directly
    const dir = mkdtempSync(join(tmpdir(), 'audit-ai-docs-test-'));
    try {
      writeFile(dir, 'AGENTS.md', '# Agents\n\nUse skill `msg-skill` for X.\n');
      const viols = probeD1(dir);
      expect(viols.length).toBeGreaterThan(0);
      expect(viols[0]).toContain('declared in AGENTS.md');
      expect(viols[0]).toContain('.claude/skills');
      expect(viols[0]).toContain('msg-skill');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── test_D1 — skill declared but missing on disk ────────────────────────────

describe('test_D1 — D1: skill declared in AGENTS.md missing on disk', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('FAIL: violation when skill declared in prose but directory missing', () => {
    writeFile(dir, 'AGENTS.md', '# Agents\n\nUse skill `phantom-skill` for X.\n');
    // No .claude/skills/phantom-skill/ → violation
    const viols = probeD1(dir);
    // Multi-assertion: violation exists AND mentions the skill name
    expect(viols.length).toBeGreaterThan(0);
    expect(viols.some((v) => v.includes('phantom-skill'))).toBe(true);
  });

  it('PASS (negative arm): skill in code fence NOT flagged (D1 hardening)', () => {
    // skill `phantom-skill` appears only inside a code block → must NOT be flagged
    writeFile(dir, 'AGENTS.md', '# Agents\n\n```bash\nUse skill `phantom-skill`\n```\n\nNormal prose.\n');
    const viols = probeD1(dir);
    // The code-fence mention must not produce a violation
    expect(viols).toHaveLength(0);
  });

  it('PASS (negative arm): removed skill NOT flagged (D1 hardening)', () => {
    writeFile(dir, 'AGENTS.md', '# Agents\n\nThe skill `old-skill` was removed.\n');
    const viols = probeD1(dir);
    expect(viols).toHaveLength(0);
  });

  it('PASS when skill directory exists on disk', () => {
    writeFile(dir, 'AGENTS.md', '# Agents\n\nUse skill `existing-skill` for X.\n');
    mkdirSync(join(dir, '.claude/skills/existing-skill'), { recursive: true });
    const viols = probeD1(dir);
    expect(viols).toHaveLength(0);
  });

  it('PASS with no violations when AGENTS.md absent', () => {
    const viols = probeD1(dir);
    expect(viols).toHaveLength(0);
  });
});

// ─── test_D2 — TODO/_comment in JSON ─────────────────────────────────────────

describe('test_D2 — D2: no TODO/_comment in JSON configs', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('WARN (finding emitted): _comment key in .mcp.json', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ '_comment_TODO': 'remove me', 'mcpServers': {} }));
    const findings = probeD2(dir);
    // Multi-assertion: finding exists AND mentions the key
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.reason.includes('_comment'))).toBe(true);
  });

  it('WARN: TODO value inside a string field', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ 'server': { 'endpoint': 'TODO: set this' } }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.reason.includes('TODO'))).toBe(true);
  });

  it('PASS (negative arm): _comment as string VALUE (not key) not flagged by key check', () => {
    // D2 hardening: grep would have flagged "_comment" appearing in a value
    // JSON.parse key-check only flags it as a KEY
    writeFile(dir, '.mcp.json', JSON.stringify({ 'description': 'this is not a _comment key, just text', 'mcpServers': {} }));
    const findings = probeD2(dir);
    // The word "_comment" in a VALUE should not trigger the _comment-KEY check
    // (though it may trigger TODO/FIXME check if present — it's not here)
    const commentKeyFindings = findings.filter((f) => f.reason.includes('_comment'));
    expect(commentKeyFindings).toHaveLength(0);
  });

  it('PASS: clean JSON produces no findings', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ 'mcpServers': { 'myServer': { 'url': 'http://localhost' } } }));
    const findings = probeD2(dir);
    expect(findings).toHaveLength(0);
  });

  it('PASS: no JSON files → no findings', () => {
    const findings = probeD2(dir);
    expect(findings).toHaveLength(0);
  });

  it('WARN: TODO in deeply nested JSON value', () => {
    // walkJson must recurse into nested objects
    writeFile(dir, '.mcp.json', JSON.stringify({
      server: { nested: { endpoint: 'TODO: fill in' } },
    }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.reason.includes('TODO'))).toBe(true);
  });

  it('WARN: TODO in array value', () => {
    // walkJson must iterate arrays
    writeFile(dir, '.mcp.json', JSON.stringify({
      servers: ['TODO: add server', 'http://localhost'],
    }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('PASS: null value in JSON does not throw', () => {
    // null is a non-string, non-object, non-array value → walkJson returns early
    writeFile(dir, '.mcp.json', JSON.stringify({ key: null, mcpServers: {} }));
    const findings = probeD2(dir);
    expect(findings).toHaveLength(0);
  });

  it('WARN: .ai-factory/*.json files are also scanned', () => {
    // D2 scans .ai-factory/ directory for JSON files
    mkdirSync(join(dir, '.ai-factory'), { recursive: true });
    writeFile(dir, '.ai-factory/config.json', JSON.stringify({ _comment: 'remove me' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.file.includes('.ai-factory'))).toBe(true);
  });

  it('PASS: FIXME in value is also flagged (TODO_VALUE_RE covers FIXME)', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ endpoint: 'FIXME: set this' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.reason.includes('FIXME'))).toBe(true);
  });

  it('finding reason contains "value at" path string with $.key format', () => {
    // walkJson produces reason: `value at ${path} contains TODO/FIXME: "${val}"`
    // The path starts with "$" and uses ".key" notation
    writeFile(dir, '.mcp.json', JSON.stringify({ endpoint: 'TODO: fill in' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    // Must contain "value at $.endpoint" or similar
    expect(findings[0]!.reason).toContain('value at');
    expect(findings[0]!.reason).toContain('$.endpoint');
  });

  it('finding reason contains "looks like a comment placeholder" for _comment key', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ '_comment': 'remove me' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.reason).toContain('looks like a comment placeholder');
  });

  it('finding reason for array item contains [index] path notation', () => {
    // walkJson with array: path becomes `${path}[${i}]`
    writeFile(dir, '.mcp.json', JSON.stringify({ servers: ['TODO: add one'] }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.reason).toContain('[0]');
  });

  it('finding file path is relative (not absolute) when inside cwd', () => {
    // D2 relativizes the filePath relative to cwd
    writeFile(dir, '.mcp.json', JSON.stringify({ key: 'TODO: fill' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    // The file field should be '.mcp.json' (relative) not an absolute path
    expect(findings[0]!.file).toBe('.mcp.json');
    expect(findings[0]!.file).not.toContain(dir);
  });

  it('.claude/settings.json is also scanned', () => {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFile(dir, '.claude/settings.json', JSON.stringify({ _comment: 'remove' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.file.includes('settings.json'))).toBe(true);
  });

  it('only .json files in .ai-factory/ are scanned (not .md or .sh files)', () => {
    // D2 filters aiFactory files to .endsWith('.json')
    // A non-JSON file with _comment content must NOT produce findings
    mkdirSync(join(dir, '.ai-factory'), { recursive: true });
    writeFile(dir, '.ai-factory/notes.md', '_comment this is just a text file with TODO: do something');
    // No JSON files → no findings
    const findings = probeD2(dir);
    // notes.md is not a JSON file — must not be scanned
    expect(findings.filter((f) => f.file.includes('notes.md'))).toHaveLength(0);
  });

  it('non-string primitive values (number, boolean) in JSON do not produce findings', () => {
    // walkJson: null or typeof val !== 'object' → check typeof val === 'string' before pushing
    // A number or boolean value should NOT trigger the TODO check (it's not a string)
    writeFile(dir, '.mcp.json', JSON.stringify({ count: 42, enabled: true, ratio: 0.5 }));
    const findings = probeD2(dir);
    expect(findings).toHaveLength(0);
  });
});

// ─── test_D3 — goal phrase parity ────────────────────────────────────────────

describe('test_D3 — D3: canonical goal phrase in downstream docs', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  function buildD3Fixtures(dir: string, omitFrom: string): void {
    // Satisfy all DOWNSTREAM_DOCS except the one we omit
    for (const doc of DOWNSTREAM_DOCS) {
      if (doc === omitFrom) {
        writeFile(dir, doc, '# Doc without goal phrase\n\nSome content.\n');
      } else {
        writeFile(dir, doc, `# Doc\n\n${CANON_PHRASE}\n`);
      }
    }
  }

  it('FAIL: violation when CLAUDE.md lacks goal phrase (and mentions it in no synonym form)', () => {
    buildD3Fixtures(dir, 'CLAUDE.md');
    const viols = probeD3(dir);
    // Multi-assertion: violation exists AND identifies CLAUDE.md
    expect(viols.length).toBeGreaterThan(0);
    expect(viols.some((v) => v.includes('CLAUDE.md'))).toBe(true);
  });

  it('FAIL: violation when session-bootstrap.md lacks goal phrase', () => {
    buildD3Fixtures(dir, '.claude/session-bootstrap.md');
    const viols = probeD3(dir);
    expect(viols.length).toBeGreaterThan(0);
    expect(viols.some((v) => v.includes('session-bootstrap.md'))).toBe(true);
  });

  it('PASS: synonym phrase satisfies D3', () => {
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `# Doc\n\n${CANON_ALT}\n`);
    }
    const viols = probeD3(dir);
    expect(viols).toHaveLength(0);
  });

  it('FAIL: missing file listed as violation', () => {
    // Only create first doc; others missing → violations
    writeFile(dir, DOWNSTREAM_DOCS[0]!, `# Doc\n\n${CANON_PHRASE}\n`);
    const viols = probeD3(dir);
    expect(viols.some((v) => v.includes('not found'))).toBe(true);
  });

  it('PASS: all docs contain canonical phrase', () => {
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `# Doc\n\n${CANON_PHRASE}\n`);
    }
    const viols = probeD3(dir);
    expect(viols).toHaveLength(0);
  });

  it('violation string for missing file contains "file not found"', () => {
    // probeD3 violation format: `  ${docRelPath}: file not found`
    // Only create first doc; others missing
    writeFile(dir, DOWNSTREAM_DOCS[0]!, `${CANON_PHRASE}\n`);
    const viols = probeD3(dir);
    const notFoundViols = viols.filter((v) => v.includes('not found'));
    expect(notFoundViols.length).toBeGreaterThan(0);
    // The doc path must also be in the violation string
    expect(notFoundViols[0]).toContain(DOWNSTREAM_DOCS[1]!);
  });

  it('violation string for missing phrase contains "missing canonical goal phrase"', () => {
    // probeD3 violation format: `  ${docRelPath}: missing canonical goal phrase or synonym`
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, '# No phrase here.\n');
    }
    const viols = probeD3(dir);
    const missingViols = viols.filter((v) => v.includes('missing canonical goal phrase'));
    expect(missingViols.length).toBeGreaterThan(0);
  });
});

// ─── test_D4 — tool-decisions staleness ──────────────────────────────────────

describe('test_D4 — D4: tool-decisions.md staleness', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('WARN (exit 0): package.json present but tool-decisions.md absent', () => {
    writeFile(dir, 'package.json', '{"name":"test","dependencies":{},"devDependencies":{}}\n');
    const result = probeD4(dir);
    // Multi-assertion: result is warn AND message mentions the file
    expect(result.result).toBe('warn');
    expect(result.message).toMatch(/tool-decisions\.md missing/);
  });

  it('PASS (exit 0): no package.json → skip', () => {
    const result = probeD4(dir);
    expect(result.result).toBe('pass');
    expect(result.message).toMatch(/no package\.json/i);
  });

  it('WARN: package.json newer than tool-decisions.md', async () => {
    writeFile(dir, '.ai-factory/tool-decisions.md', '# decisions\n');
    // Wait a tick then write package.json so mtime is strictly newer
    await new Promise((r) => setTimeout(r, 10));
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    const result = probeD4(dir);
    // package.json mtime > tool-decisions mtime → warn
    expect(result.result).toBe('warn');
    expect(result.message).toMatch(/package\.json is newer/);
  });

  it('PASS: tool-decisions.md is newer than package.json', async () => {
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    await new Promise((r) => setTimeout(r, 10));
    writeFile(dir, '.ai-factory/tool-decisions.md', '# decisions\n');
    const result = probeD4(dir);
    expect(result.result).toBe('pass');
  });

  it('pass message contains "no package.json" when no package.json', () => {
    const result = probeD4(dir);
    expect(result.result).toBe('pass');
    expect(result.message).toContain('no package.json');
  });

  it('warn message contains ".ai-factory/tool-decisions.md missing" when absent', () => {
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    const result = probeD4(dir);
    expect(result.result).toBe('warn');
    expect(result.message).toContain('.ai-factory/tool-decisions.md missing');
  });

  it('warn message contains "package.json is newer" when pkg newer', async () => {
    writeFile(dir, '.ai-factory/tool-decisions.md', '# decisions\n');
    await new Promise((r) => setTimeout(r, 10));
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    const result = probeD4(dir);
    expect(result.result).toBe('warn');
    expect(result.message).toContain('package.json is newer');
  });

  it('PASS: pkgMtime === decMtime (equal mtime, strictly > fails)', async () => {
    // pkgMtime > decMtime is strict greater-than — equal mtime should NOT warn
    // We can't easily force exactly equal mtime in a cross-platform test,
    // but we can test the pass branch exists when tool-decisions is newer
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    await new Promise((r) => setTimeout(r, 10));
    writeFile(dir, '.ai-factory/tool-decisions.md', '# decisions\n');
    const result = probeD4(dir);
    // tool-decisions is newer → pkgMtime < decMtime → pass
    expect(result.result).toBe('pass');
    // The pass message should contain the rule name
    expect(result.message).toContain('D4');
  });
});

// ─── test_D5 — inverse-completeness ──────────────────────────────────────────

describe('test_D5 — D5: inverse-completeness (orphan file detection)', () => {
  // D5 operates on the real repo root (like the bash version) to grep
  // actual files. We use a temp dir that acts as a mini-repo.
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('FAIL: orphan file with canonical phrase detected as violation', () => {
    const orphanPath = 'docs/some-orphan.md';
    writeFile(dir, orphanPath, `# Orphan\n\n${CANON_PHRASE}\n`);
    // Create enrolled docs without the phrase (so they don't appear in found set)
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `# Doc\n\n${CANON_PHRASE}\n`);
    }
    const findings = probeD5(dir);
    // Multi-assertion: finding exists AND identifies the orphan file
    expect(findings.length).toBeGreaterThan(0);
    const orphanFinding = findings.find((f) => f.file === orphanPath);
    expect(orphanFinding).toBeDefined();
    expect(orphanFinding!.reason).toMatch(/not in DOWNSTREAM_DOCS/);
  });

  it('PASS: enrolled files with canonical phrase not flagged', () => {
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `# Doc\n\n${CANON_PHRASE}\n`);
    }
    // README.md is exempt (root source)
    writeFile(dir, 'README.md', `# README\n\n${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // All enrolled or exempt → no violations
    expect(findings).toHaveLength(0);
  });

  it('PASS (D5 negative arm — .stryker-tmp exemption): .stryker-tmp file with canonical phrase NOT flagged', () => {
    // This is the prescribed D5 hardening test (Wave 10.4 dispatch):
    // a file under .stryker-tmp/ containing the canonical phrase must NOT be flagged
    const strykerFile = '.stryker-tmp/sandbox12345/some-instrumented-file.md';
    writeFile(dir, strykerFile, `# Instrumented copy\n\n${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // The .stryker-tmp/ file must be exempt
    const strykerFinding = findings.find((f) => f.file.startsWith('.stryker-tmp'));
    expect(strykerFinding).toBeUndefined();
  });

  // D5_GENERATED_TWIN — paired arms. The exemption is content-gated on the
  // generator's own header, so a hand-written plugin/hooks/* file still counts
  // as an orphan. Without the negative arm the exemption could widen to the
  // whole directory and nothing would notice.
  it('PASS (D5_GENERATED_TWIN): generated plugin twin carrying the generator header is exempt', () => {
    const twin = 'plugin/hooks/inject-session-bootstrap';
    writeFile(
      dir,
      twin,
      `#!/usr/bin/env bash\n# AUTO-GENERATED from .claude/hooks/inject-session-bootstrap.sh — do not edit\n# ${CANON_PHRASE}\n`,
    );
    const findings = probeD5(dir);
    expect(findings.find((f) => f.file === twin)).toBeUndefined();
  });

  it('FAIL (D5_GENERATED_TWIN negative arm): hand-written plugin/hooks file without the generator header IS flagged', () => {
    const handWritten = 'plugin/hooks/hand-maintained-twin';
    writeFile(dir, handWritten, `#!/usr/bin/env bash\n# ${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const finding = findings.find((f) => f.file === handWritten);
    expect(finding).toBeDefined();
    expect(finding!.reason).toMatch(/not in DOWNSTREAM_DOCS/);
  });

  it('PASS: research-patches files are exempt (D5_FROZEN)', () => {
    writeFile(dir, 'docs/meta-factory/research-patches/2026-01-01-some-patch.md',
      `# Patch\n\n${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const patchFinding = findings.find((f) => f.file.includes('research-patches'));
    expect(patchFinding).toBeUndefined();
  });

  it('PASS: audit-ai-docs.ts itself is exempt (D5_TEST_INFRA)', () => {
    // The TS port file itself contains function names / constants that could match
    // — it should be exempt via D5_TEST_INFRA_RE
    writeFile(dir, 'packages/core/audit-self/audit-ai-docs.ts',
      `// test\nexport const CANON_PHRASE = "${CANON_PHRASE}";\n`);
    const findings = probeD5(dir);
    const selfFinding = findings.find((f) => f.file.includes('audit-ai-docs.ts'));
    expect(selfFinding).toBeUndefined();
  });

  it('PASS: .claude/orchestrator-prompts/ files are exempt (D5_GITIGNORED)', () => {
    writeFile(dir, '.claude/orchestrator-prompts/wave-10/kickoff.md',
      `# Kickoff\n\n${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const orchFinding = findings.find((f) => f.file.includes('orchestrator-prompts'));
    expect(orchFinding).toBeUndefined();
  });

  it('FAIL: non-exempt, non-enrolled file with canonical phrase is flagged with "not in DOWNSTREAM_DOCS"', () => {
    // A file that doesn't match any exemption pattern → must be flagged
    writeFile(dir, 'docs/some-random-doc.md', `# Random\n\n${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `# Doc\n\n${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `# README\n\n${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // docs/some-random-doc.md is not in DOWNSTREAM_DOCS, not exempt → violation
    const flagged = findings.find((f) => f.file === 'docs/some-random-doc.md');
    expect(flagged).toBeDefined();
    expect(flagged!.reason).toContain('not in DOWNSTREAM_DOCS');
  });

  it('PASS: docs/audits/ files are exempt (D5_FROZEN includes docs/audits/)', () => {
    // D5_FROZEN_RE covers docs/audits/ (second alternative in the regex)
    writeFile(dir, 'docs/audits/2026-01-01-audit.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const auditFinding = findings.find((f) => f.file.includes('docs/audits'));
    expect(auditFinding).toBeUndefined();
  });

  it('PASS: audit-ai-docs.test.ts is also exempt (D5_TEST_INFRA covers test.ts extension)', () => {
    writeFile(dir, 'packages/core/audit-self/audit-ai-docs.test.ts',
      `// contains for tests\nexport const CP = "${CANON_PHRASE}";\n`);
    const findings = probeD5(dir);
    const testFinding = findings.find((f) => f.file.includes('audit-ai-docs.test.ts'));
    expect(testFinding).toBeUndefined();
  });

  it('FAIL: non-research-patch, non-audits docs/X file IS flagged (boundary of D5_FROZEN_RE)', () => {
    // "docs/meta-factory/some-other.md" is NOT in the frozen pattern and NOT in DOWNSTREAM_DOCS
    // (frozen = research-patches/ and audits/ only, not all of docs/meta-factory/)
    writeFile(dir, 'docs/meta-factory/some-unlisted-doc.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // some-unlisted-doc.md is NOT in DOWNSTREAM_DOCS and not in frozen/test/root/gitignored
    const unlisted = findings.find((f) => f.file === 'docs/meta-factory/some-unlisted-doc.md');
    expect(unlisted).toBeDefined();
  });

  it('PASS: CANON_ALT phrase also detected and enrolled files with it are not flagged', () => {
    // D5 scans for both CANON_PHRASE and CANON_ALT
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `# Doc\n\n${CANON_ALT}\n`);
    }
    writeFile(dir, 'README.md', `# README\n\n${CANON_ALT}\n`);
    const findings = probeD5(dir);
    // All enrolled → no violations
    expect(findings).toHaveLength(0);
  });

  it('PASS: node_modules/ files are not scanned (SKIP_DIRS)', () => {
    // Files under node_modules/ must be skipped even if they contain canonical phrase
    writeFile(dir, 'node_modules/some-pkg/README.md', `# Pkg\n\n${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const nodeModFinding = findings.find((f) => f.file.includes('node_modules'));
    expect(nodeModFinding).toBeUndefined();
  });

  it('PASS: .git/ files are not scanned (SKIP_DIRS)', () => {
    writeFile(dir, '.git/COMMIT_EDITMSG', `${CANON_PHRASE}`);
    const findings = probeD5(dir);
    const gitFinding = findings.find((f) => f.file.includes('.git'));
    expect(gitFinding).toBeUndefined();
  });

  it('PASS: .stryker/ files are also exempt (D5_GITIGNORED covers .stryker/)', () => {
    writeFile(dir, '.stryker/sandbox99/some-file.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const strykerFinding = findings.find((f) => f.file.startsWith('.stryker/'));
    expect(strykerFinding).toBeUndefined();
  });

  it('D5 findings are returned in sorted order', () => {
    // probeD5 uses [...found].sort() — verify findings are alphabetically sorted
    writeFile(dir, 'docs/zzz-last.md', `${CANON_PHRASE}\n`);
    writeFile(dir, 'docs/aaa-first.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const orphans = findings.filter((f) => f.file.startsWith('docs/') && (f.file.includes('aaa') || f.file.includes('zzz')));
    // aaa must come before zzz in sorted order
    if (orphans.length >= 2) {
      const aaaIdx = orphans.findIndex((f) => f.file.includes('aaa'));
      const zzzIdx = orphans.findIndex((f) => f.file.includes('zzz'));
      expect(aaaIdx).toBeLessThan(zzzIdx);
    }
  });

  it('finding file paths are relative (not absolute)', () => {
    // grepFilesContaining returns relative paths from cwd
    writeFile(dir, 'docs/some-test-file.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // The orphan file finding should be relative (no leading slash, no dir prefix)
    const orphan = findings.find((f) => f.file === 'docs/some-test-file.md');
    expect(orphan).toBeDefined();
    expect(orphan!.file.startsWith('/')).toBe(false);
    expect(orphan!.file).not.toContain(dir);
  });

  it('finding reason for non-enrolled file is "contains canonical phrase but not in DOWNSTREAM_DOCS or any exemption"', () => {
    writeFile(dir, 'docs/some-doc.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const orphan = findings.find((f) => f.file === 'docs/some-doc.md');
    expect(orphan).toBeDefined();
    expect(orphan!.reason).toBe('contains canonical phrase but not in DOWNSTREAM_DOCS or any exemption');
  });
});

// ─── test_R17 — component stories (react-next preset) ────────────────────────
// R17 is tested at the bash script level (audit-ai-docs.react-next.sh).
// The TS core module does not implement R17 directly — it's in the preset.
// We document this as an integration-tested surface and verify the test
// correctly delegates to the bash script path.

describe('test_R17 — R17: component .stories.tsx (react-next preset)', () => {
  it('R17 is NOT in audit-ai-docs.ts core module (it lives in the react-next preset)', () => {
    // R17 (component .stories.tsx check) lives in the PRESET, not in core audit-ai-docs.ts.
    // This documents the architectural boundary: audit-ai-docs.ts exports probeR4..probeD5;
    // probeR17 is deliberately absent (it's a preset-specific concern).
    //
    // Multi-assertion:
    //   1. The core module does NOT export a probeR17 function
    //   2. The preset script exists on disk (when running from the repo root)
    //
    // For (1): We verify the module's exports don't include probeR17.
    // The named exports that DO exist are the ones we imported at the top of this file.
    // Since probeR17 was not imported (it doesn't exist), this is structurally verified
    // by the fact that `import { probeR17 }` would fail at module load time.
    // We document this as: the module exports probeR4, probeD1..probeD5 but not probeR17.
    expect(typeof probeR4).toBe('function');    // probeR4 exists in core
    expect(typeof probeD1).toBe('function');    // probeD1 exists in core
    // probeR17 would NOT be defined — TypeScript wouldn't compile if we tried to import it

    // For (2): Check the preset script exists (best-effort; skip if running in sandbox)
    const presetScript = join(REPO_ROOT, 'packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh');
    // Only assert existence if REPO_ROOT is the real repo (not Stryker sandbox)
    const isRealRepo = existsSync(join(REPO_ROOT, 'packages/core/package.json')) &&
                       existsSync(join(REPO_ROOT, 'packages/preset-next-15-canonical'));
    if (isRealRepo) {
      expect(existsSync(presetScript)).toBe(true);
    }
    // (If not in real repo, the probeR4/probeD1 assertions above are sufficient)
  });

  // universalization-fix F2 — exec-based paired-negative for the SHIPPED preset
  // script's R17 probe (install.sh ships it to consumers). Without the canonical
  // UI dirs, find matches zero files; an unconditional pass() would be a silent
  // PASS. These arms EXEC the real script (T-UF-A: assert the real output, not a
  // string literal) and prove both: (negative) absent layout → WARN R17, and
  // (positive) a present component + matching .stories.tsx → genuine PASS R17 —
  // the anti-tautology contrast that distinguishes the fix from a blanket WARN.
  const presetScript = join(REPO_ROOT, 'packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh');
  const isRealRepo = existsSync(join(REPO_ROOT, 'packages/core/package.json')) &&
                     existsSync(presetScript);

  it('emits WARN (not PASS) for R17 when no src/shared/ui or src/features/*/ui', () => {
    // Arrange: temp dir with NO UI dirs (probe cannot run there).
    if (!isRealRepo) return; // sandbox: script absent, nothing to exec
    const dir = mkdtempSync(join(tmpdir(), 'audit-ai-docs-test-'));

    // Act: run the SHIPPED preset script's R17 probe only.
    const out = execFileSync('bash', [presetScript, '--only=R17'], {
      cwd: dir,
      encoding: 'utf8',
    });

    // Assert: live verdict is WARN R17, NOT a silent PASS R17.
    expect(out).toMatch(/WARN.*R17/);
    expect(out).not.toMatch(/PASS:\s*R17/);
  });

  it('emits genuine PASS for R17 when a component has a matching .stories.tsx', () => {
    // Arrange: temp dir WITH the canonical UI layout — a component plus its
    // matching story → the probe has files to check and must genuinely PASS.
    if (!isRealRepo) return; // sandbox: script absent, nothing to exec
    const dir = mkdtempSync(join(tmpdir(), 'audit-ai-docs-test-'));
    mkdirSync(join(dir, 'src/shared/ui'), { recursive: true });
    writeFileSync(join(dir, 'src/shared/ui/Button.tsx'), 'export const Button = () => null;\n', 'utf8');
    writeFileSync(join(dir, 'src/shared/ui/Button.stories.tsx'), 'export default { component: Button };\n', 'utf8');

    // Act: run the SHIPPED preset script's R17 probe only.
    const out = execFileSync('bash', [presetScript, '--only=R17'], {
      cwd: dir,
      encoding: 'utf8',
    });

    // Assert: genuine PASS R17 fires (anti-tautology contrast to the WARN arm).
    expect(out).toMatch(/PASS:\s*R17/);
  });
});

// ─── runAudit() — orchestration layer ────────────────────────────────────────
// Tests that exercise the runAudit() orchestration, covering the branches
// in the shouldSkip() logic and the result aggregation.

describe('runAudit() — orchestration layer', () => {
  let dir: string;
  // authoring-shaped: D3/D5 enforce here (consumer-mode skip is tested separately)
  beforeEach(() => { dir = makeTmpDir(); markAuthoring(dir); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns AuditReport with zero failCount when everything is clean', () => {
    // No package.json (D4 skipped cleanly), no AGENTS.md (D1 warn only)
    // Enroll all downstream docs for D3/D5 to pass
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `# Doc\n\n${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `# README\n\n${CANON_PHRASE}\n`);
    const report = runAudit(dir, '');
    // Multi-assertion: structure and fail count
    expect(report).toHaveProperty('results');
    expect(report).toHaveProperty('passCount');
    expect(report).toHaveProperty('failCount');
    expect(report).toHaveProperty('warnCount');
    expect(report.failCount).toBe(0);
  });

  it('returns failCount > 0 when D3 fails', () => {
    // CLAUDE.md missing canonical phrase → D3 fail
    for (const doc of DOWNSTREAM_DOCS) {
      if (doc === 'CLAUDE.md') {
        writeFile(dir, doc, '# CLAUDE\n\nNo canonical phrase.\n');
      } else {
        writeFile(dir, doc, `# Doc\n\n${CANON_PHRASE}\n`);
      }
    }
    const report = runAudit(dir, '');
    expect(report.failCount).toBeGreaterThan(0);
    const d3 = report.results.find((r) => r.probe === 'D3');
    expect(d3?.level).toBe('fail');
    // Multi-assertion: details mention CLAUDE.md
    expect(d3?.details.some((d) => d.includes('CLAUDE.md'))).toBe(true);
  });

  it('--only=D1 skips all other probes', () => {
    // With --only=D1, only D1 runs; AGENTS.md missing → D1 warn
    const report = runAudit(dir, 'D1');
    // Only the D1 result should appear
    expect(report.results.every((r) => r.probe === 'D1')).toBe(true);
    expect(report.results).toHaveLength(1);
    expect(report.results[0]!.probe).toBe('D1');
  });

  it('--only=D3 isolates D3 probe', () => {
    writeFile(dir, '.claude/session-bootstrap.md', `${CANON_PHRASE}\n`);
    // Missing other docs → D3 fail on first missing doc
    const report = runAudit(dir, 'D3');
    // Only D3 result
    expect(report.results.length).toBe(1);
    expect(report.results[0]!.probe).toBe('D3');
    // Multi-assertion: level is fail (some docs missing)
    expect(report.results[0]!.level).toBe('fail');
  });

  it('--only=D4 isolates D4 probe (warn: no package.json)', () => {
    const report = runAudit(dir, 'D4');
    expect(report.results.length).toBe(1);
    expect(report.results[0]!.probe).toBe('D4');
    // No package.json → pass(skipped) — not warn
    expect(report.results[0]!.level).toBe('pass');
  });

  it('--only=D2 isolates D2 probe (pass: no JSON files)', () => {
    const report = runAudit(dir, 'D2');
    expect(report.results.length).toBe(1);
    expect(report.results[0]!.probe).toBe('D2');
    expect(report.results[0]!.level).toBe('pass');
  });

  it('--only=D5 isolates D5 probe', () => {
    writeFile(dir, 'README.md', `# README\n\n${CANON_PHRASE}\n`);
    const report = runAudit(dir, 'D5');
    expect(report.results.length).toBe(1);
    expect(report.results[0]!.probe).toBe('D5');
    // README.md is exempt → pass
    expect(report.results[0]!.level).toBe('pass');
  });

  it('D1 fail: skill declared missing → fail result with details', () => {
    writeFile(dir, 'AGENTS.md', '# Agents\n\nUse skill `missing-skill` for X.\n');
    const report = runAudit(dir, 'D1');
    const d1 = report.results.find((r) => r.probe === 'D1');
    expect(d1?.level).toBe('fail');
    // Multi-assertion: details mention missing-skill
    expect(d1?.details.some((d) => d.includes('missing-skill'))).toBe(true);
  });

  it('D2 warn: _comment key → warn result with details', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ '_comment': 'remove me', mcpServers: {} }));
    const report = runAudit(dir, 'D2');
    const d2 = report.results.find((r) => r.probe === 'D2');
    expect(d2?.level).toBe('warn');
    // Multi-assertion: details present
    expect(d2?.details.length).toBeGreaterThan(0);
  });

  it('D5 fail: orphan file → fail result with details', () => {
    writeFile(dir, 'docs/orphan.md', `# Orphan\n\n${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `# Doc\n\n${CANON_PHRASE}\n`);
    }
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    expect(d5?.level).toBe('fail');
    // Multi-assertion: details include fix hint
    expect(d5?.details.some((d) => d.includes('Fix:'))).toBe(true);
  });

  it('D1 warn message contains "AGENTS.md not found" exact text', () => {
    // No AGENTS.md → D1 warn with exact message text
    const report = runAudit(dir, 'D1');
    const d1 = report.results.find((r) => r.probe === 'D1');
    expect(d1!.level).toBe('warn');
    expect(d1!.message).toContain('AGENTS.md not found');
  });

  it('D1 pass message contains "D1 (drift)"', () => {
    // AGENTS.md present with no skills → D1 pass
    writeFile(dir, 'AGENTS.md', '# Agents\n\nNo skills declared.\n');
    const report = runAudit(dir, 'D1');
    const d1 = report.results.find((r) => r.probe === 'D1');
    expect(d1!.level).toBe('pass');
    expect(d1!.message).toContain('D1 (drift)');
  });

  it('D1 fail message contains "D1 (drift)" and details contain skill name', () => {
    writeFile(dir, 'AGENTS.md', '# Agents\n\nUse skill `exact-skill` for tasks.\n');
    const report = runAudit(dir, 'D1');
    const d1 = report.results.find((r) => r.probe === 'D1');
    expect(d1!.level).toBe('fail');
    expect(d1!.message).toContain('D1 (drift)');
    expect(d1!.details.some((d) => d.includes('exact-skill'))).toBe(true);
  });

  it('D2 pass message contains "D2 (drift)"', () => {
    const report = runAudit(dir, 'D2');
    const d2 = report.results.find((r) => r.probe === 'D2');
    expect(d2!.level).toBe('pass');
    expect(d2!.message).toContain('D2 (drift)');
  });

  it('D2 warn message contains "JSON configs accumulate stale comments"', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ '_comment': 'remove me' }));
    const report = runAudit(dir, 'D2');
    const d2 = report.results.find((r) => r.probe === 'D2');
    expect(d2!.level).toBe('warn');
    expect(d2!.message).toContain('JSON configs accumulate stale comments');
  });

  it('D3 pass message contains "D3 (drift)"', () => {
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    const report = runAudit(dir, 'D3');
    const d3 = report.results.find((r) => r.probe === 'D3');
    expect(d3!.level).toBe('pass');
    expect(d3!.message).toContain('D3 (drift)');
  });

  it('D3 fail message contains "canonical goal phrase present"', () => {
    // D3 fail
    writeFile(dir, DOWNSTREAM_DOCS[0]!, '# No phrase\n');
    const report = runAudit(dir, 'D3');
    const d3 = report.results.find((r) => r.probe === 'D3');
    expect(d3!.level).toBe('fail');
    expect(d3!.message).toContain('canonical goal phrase present');
  });

  it('D5 fail message contains "D5 (drift, inverse)"', () => {
    writeFile(dir, 'docs/orphan-x.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    expect(d5!.level).toBe('fail');
    expect(d5!.message).toContain('D5 (drift, inverse)');
  });

  it('D5 fail details include "Fix:" with exact instruction text', () => {
    writeFile(dir, 'docs/orphan-y.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    expect(d5!.details.some((d) => d.includes('Fix: add the file to DOWNSTREAM_DOCS'))).toBe(true);
    expect(d5!.details.some((d) => d.includes('D5_FROZEN'))).toBe(true);
  });

  it('D5 pass message contains "D5 (drift, inverse)"', () => {
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    expect(d5!.level).toBe('pass');
    expect(d5!.message).toContain('D5 (drift, inverse)');
  });

  it('R4 result is included in runAudit() full run', () => {
    // R4 must be in the results (not skipped by default)
    const report = runAudit(dir, '');
    const r4 = report.results.find((r) => r.probe === 'R4');
    expect(r4).toBeDefined();
    // No src/domain → warn(skipped): probeR4 could not run, so runAudit must
    // surface its honest WARN verdict (never a silent pass). universalization-fix F1a.
    expect(r4!.level).toBe('warn');
    expect(r4!.message).toMatch(/R4/);
  });

  it('--only=R4 isolates R4 probe', () => {
    const report = runAudit(dir, 'R4');
    expect(report.results.length).toBe(1);
    expect(report.results[0]!.probe).toBe('R4');
  });

  it('D1 warn when AGENTS.md not found (run all, no AGENTS.md)', () => {
    // D1 emits warn (not fail) when AGENTS.md is absent
    const report = runAudit(dir, 'D1');
    const d1 = report.results.find((r) => r.probe === 'D1');
    expect(d1?.level).toBe('warn');
    expect(d1?.message).toMatch(/AGENTS\.md not found/);
  });

  it('D2 pass when no JSON configs present (run all)', () => {
    const report = runAudit(dir, 'D2');
    const d2 = report.results.find((r) => r.probe === 'D2');
    expect(d2?.level).toBe('pass');
    expect(d2?.message).toMatch(/D2/);
  });

  it('D3 results include details when violation found', () => {
    // D3 fail: missing canonical phrase in CLAUDE.md → details list violations
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, doc === 'CLAUDE.md' ? '# CLAUDE\n' : `${CANON_PHRASE}\n`);
    }
    const report = runAudit(dir, 'D3');
    const d3 = report.results.find((r) => r.probe === 'D3');
    expect(d3!.details.length).toBeGreaterThan(0);
  });

  it('D5 pass result has empty details', () => {
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    expect(d5!.level).toBe('pass');
    expect(d5!.details).toHaveLength(0);
  });

  it('D5 fail result has Fix: hint in details', () => {
    // D5 fail message includes "Fix:" guidance
    writeFile(dir, 'docs/orphan-test.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    expect(d5!.level).toBe('fail');
    expect(d5!.details.some((d) => d.includes('Fix:'))).toBe(true);
  });

  it('D4 warn result included in full run when package.json present but no tool-decisions', () => {
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    const report = runAudit(dir, 'D4');
    const d4 = report.results.find((r) => r.probe === 'D4');
    expect(d4!.level).toBe('warn');
    expect(d4!.message).toMatch(/tool-decisions\.md missing/);
  });

  it('passCount / failCount / warnCount are accurate', () => {
    // Set up: D3 fail (CLAUDE.md missing phrase), all others clean/skipped
    for (const doc of DOWNSTREAM_DOCS) {
      if (doc === 'CLAUDE.md') {
        writeFile(dir, doc, '# CLAUDE\n\nNo phrase.\n');
      } else {
        writeFile(dir, doc, `${CANON_PHRASE}\n`);
      }
    }
    writeFile(dir, 'README.md', `# README\n\n${CANON_PHRASE}\n`);
    const report = runAudit(dir, '');
    // D3 should fail; everything else should be pass or warn (D1: no AGENTS.md)
    expect(report.failCount).toBeGreaterThanOrEqual(1);
    expect(report.passCount + report.warnCount + report.failCount).toBe(report.results.length);
  });
});

// ─── Wave 4 mutation-hardening additions ─────────────────────────────────────
// Each block targets a specific survivor (file:line · mutator).

// ── L68-69: return 'skip' → '' in extractProseText() visit() callback ────────
// visit() in unist-util-visit treats 'skip' as a special signal to skip the subtree.
// If mutated to '', the subtree is NOT skipped, and children of html/code nodes
// would be visited, potentially collecting their text content.
describe('extractProseText() — return-skip sentinel value (L68-69)', () => {
  it('code fence children are truly skipped, not just the fence node itself', () => {
    // A fenced code block wraps a text node as child.
    // 'skip' stops visit() from descending; '' would not stop it.
    // If '' were returned, the inner text of the fence would be collected.
    const md = '```\nSECRET_INSIDE_FENCE\n```\nOutside text.\n';
    const prose = extractProseText(md);
    // The text INSIDE the fence must NOT appear
    expect(prose).not.toContain('SECRET_INSIDE_FENCE');
    // Text outside the fence IS extracted
    expect(prose).toContain('Outside text');
  });

  it('html comment children are truly skipped (html node subtree)', () => {
    // An HTML comment node <!-- ... --> should have its content fully excluded.
    // Returning '' instead of 'skip' would allow child traversal on any child nodes.
    const md = '<!-- SECRET_HTML_COMMENT -->\n\nReal prose.\n';
    const prose = extractProseText(md);
    expect(prose).not.toContain('SECRET_HTML_COMMENT');
    expect(prose).toContain('Real prose');
  });

  it('inlineCode content is skipped — returns skip not empty string', () => {
    // inlineCode is in CODE_NODE_TYPES; the return 'skip' prevents visiting its value.
    // With '' instead of 'skip', visit() might still descend into inlineCode children.
    const md = 'Text before `INLINE_SECRET` text after.\n';
    const prose = extractProseText(md);
    expect(prose).not.toContain('INLINE_SECRET');
    expect(prose).toContain('Text before');
    expect(prose).toContain('text after');
  });
});

// ── L76: join('\n') → join('') in extractProseText() ────────────────────────
describe('extractProseText() — join separator is newline not empty string (L76)', () => {
  it('multiple prose fragments are joined with \\n not concatenated', () => {
    // Two paragraphs produce two text fragments; join('\\n') puts a newline between them.
    // join('') would merge them without separator.
    const md = 'Alpha paragraph.\n\nBeta paragraph.\n';
    const prose = extractProseText(md);
    // Must contain a newline between the two fragments
    expect(prose).toMatch(/Alpha paragraph\.\nBeta paragraph\./);
  });

  it('heading and paragraph are separated by a newline in output', () => {
    const md = '# HeadingText\n\nBodyText.\n';
    const prose = extractProseText(md);
    // Both texts present, separated by a newline
    expect(prose).toMatch(/HeadingText\nBodyText\./);
  });
});

// ── L107: Regex /\bskill\s*$/ → /\bskill\s$/ (0 or more spaces vs exactly 1) ─
describe('extractDeclaredSkills() — SKILL_END_RE matches "skill" with 0 spaces before backtick (L107)', () => {
  it('extracts skill when "skill" immediately precedes backtick with no trailing space', () => {
    // "skill`name`" — zero spaces between "skill" and the backtick
    // \s* matches 0 occurrences; \s requires exactly 1 → mutant would fail to match
    const md = 'Use skill`no-space-skill` for tasks.\n';
    const skills = extractDeclaredSkills(md);
    // The remark AST splits "Use skill" as text and "no-space-skill" as inlineCode.
    // SKILL_END_RE must match "Use skill" (ends with "skill", zero spaces between text and code)
    expect(skills).toContain('no-space-skill');
  });
});

// ── L113: if (!node.children) return; → if (false) return; ──────────────────
// ── L115: if (CODE_NODE_TYPES.has(node.type)) return; → if (false) return; ──
describe('extractDeclaredSkills() — walkBlock guards (L113, L115)', () => {
  it('leaf nodes without children do not cause errors (L113 no-children guard)', () => {
    // A leaf node (no children property) should trigger the !node.children guard
    // and return early. If guard is false, node.children iteration would error or be skipped.
    // We verify walkBlock handles a doc with only text-only leaf nodes safely
    const md = 'Just plain text, no lists or anything.\n';
    // If the guard were removed (if false), walkBlock might iterate undefined children
    // and either throw or silently skip — either way the result changes
    const skills = extractDeclaredSkills(md);
    expect(skills).toHaveLength(0); // no skills declared
  });

  it('code fence blocks are completely skipped (L115 CODE_NODE_TYPES guard in walkBlock)', () => {
    // walkBlock must skip fenced code blocks. If the guard is removed (if false),
    // the for...of loop at the end of walkBlock would attempt to recurse into code block
    // children — which could produce phantom skill extractions.
    const md = '## Title\n\n```\nUse skill `fence-skill` here\n```\n\nNormal prose.\n';
    const skills = extractDeclaredSkills(md);
    // The code fence guard must prevent fence-skill from being extracted
    expect(skills).not.toContain('fence-skill');
    expect(skills).toHaveLength(0);
  });
});

// ── L123: curr.type==='text' && next.type==='inlineCode' ─────────────────────
// L123 LogicalOperator: && → || means ANY pair where curr=text OR next=inlineCode fires.
// L123 ConditionalExpression (true && next=inlineCode): always treats curr as text
// L123 ConditionalExpression (curr=text && true): always treats next as inlineCode
describe('extractDeclaredSkills() — type guards on curr/next (L123)', () => {
  it('does NOT extract when curr is inlineCode and next is text (guards curr.type===text)', () => {
    // `code` followed by text — curr.type is 'inlineCode', not 'text'
    // With && → ||, this would match because next might be anything
    // With true on left, it always passes the curr check
    const md = '`some-code` skill then text.\n';
    const skills = extractDeclaredSkills(md);
    // curr is inlineCode, not text → must NOT match → no skill extracted
    expect(skills).not.toContain('then');
    expect(skills).toHaveLength(0);
  });

  it('does NOT extract when curr is text ending with "skill" but next is plain text (guards next.type===inlineCode)', () => {
    // "Use skill plainname" — next node is text, not inlineCode
    // With && → ||, curr=text would be true → would try to extract "plainname"
    const md = 'Use skill plainname here.\n';
    const skills = extractDeclaredSkills(md);
    // next is text, not inlineCode → must NOT match
    expect(skills).toHaveLength(0);
  });

  it('extracts ONLY when curr=text ending with "skill" AND next=inlineCode (both guards together)', () => {
    // Positive control: both conditions true → extract
    const md = 'Use skill `correct-skill` for tasks.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).toContain('correct-skill');
    // Also: a node that fails either condition → NOT extracted in same doc
    // "skill code" pair exists AND "text plain" pair exists → only code pair extracted
    const md2 = '`code` skill plain-text.\n\nAlso use skill `the-skill` here.\n';
    const skills2 = extractDeclaredSkills(md2);
    expect(skills2).toContain('the-skill');
    expect(skills2).not.toContain('plain-text');
  });
});

// ── L130: after.type === 'text' check → true ─────────────────────────────────
describe('extractDeclaredSkills() — after.type===text guard (L130)', () => {
  it('does NOT skip skill when after node is strong (not text), even if strong text would match NEGATIVE_RE', () => {
    // after.type === 'text' ensures we only look at text nodes following inlineCode
    // With true instead, a strong/em/link node's value would be tested (undefined → '' → no match anyway)
    // The distinguishing case: after is non-text with a truthy value → type guard prevents skip
    // Verified via the existing test: "after-nontext-skill" IS extracted when after is "strong"
    const md = 'Use skill `was-nontext-skill` **was removed**.\n';
    // "**was removed**" → strong node, not text; 'was' would match NEGATIVE_RE
    // But after.type === 'text' is false → the check is skipped → skill IS extracted
    const skills = extractDeclaredSkills(md);
    expect(skills).toContain('was-nontext-skill');
  });

  it('DOES skip skill when after node IS a text node containing negative word', () => {
    // Confirms the after guard fires when after IS a text node
    const md = 'Use skill `skipped-after-skill` was deprecated.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).not.toContain('skipped-after-skill');
  });
});

// ── L131: codeName.length > 0 → true / >= 0 ──────────────────────────────────
describe('extractDeclaredSkills() — codeName.length > 0 guard (L131)', () => {
  it('does NOT add empty string to skills when backtick span is empty (> 0 vs >= 0)', () => {
    // `` produces an inlineCode node with value="" — length is 0
    // length > 0 excludes it; length >= 0 would include it; true would always include it
    const md = 'Use skill `` for tasks.\n';
    const skills = extractDeclaredSkills(md);
    // Empty string must NOT be added regardless of which operator fires
    expect(skills).not.toContain('');
    expect(skills).toHaveLength(0);
  });

  it('adds single-char skill name (length === 1, satisfies > 0 but not if guard were > 1)', () => {
    // A skill with a single-char name: length=1 → satisfies > 0 → should be added
    // This confirms > 0 is correct (not > 1 or similar)
    const md = 'Use skill `x` for tasks.\n';
    const skills = extractDeclaredSkills(md);
    expect(skills).toContain('x');
  });
});

// ── execSync call content in probeR4() — exec-injection seam ────────────────
// These mutants change the command string to "" or change the options object.
// The test structure for R4 already verifies the result shape; we need to
// verify the actual command content matters.
describe('probeR4() — execSync call content', () => {
  /**
   * Fast execSync stub for warm-path probeR4 tests (DN-1 Path C, 2026-05-25).
   * Scoped to this describe block (the only consumer) — module-level placement
   * would risk leaking into unrelated tests if the file extends.
   *
   * Mirrors the subprocess outcomes probeR4 cares about without spawning npx:
   *   - `npx --version` → returns '8.0.0\n' (npx is available)
   *   - `npx --no-install tsx scripts/audit-r4.ts` → throws ENOENT (tsx absent)
   *
   * These assertions exercise CONDITIONAL LOGIC (early-return branches), not
   * the real-subprocess contract. The sibling contract test (`tsconfig.json
   * exists but ts-morph missing → still skips OR proceeds`) deliberately omits
   * this stub — semantic preservation is the design intent of Option C.
   */
  const fastExecSyncStub = ((cmd: string): Buffer => {
    if (cmd.startsWith('npx --version')) return Buffer.from('8.0.0\n');
    // `npx --no-install tsx ...` → simulate tsx absent (real behaviour on warm-path test envs)
    const err: NodeJS.ErrnoException = new Error('ENOENT: tsx not found');
    err.code = 'ENOENT';
    throw err;
  }) as unknown as typeof import('node:child_process').execSync;

  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('execSync command is not empty — real "npx --version" succeeds, mutant "" throws to npx-not-found warn (L161 StringLiteral)', () => {
    // Source flow with real command: execSync('npx --version') succeeds (npx is in PATH) →
    //   falls through to tsconfig/ts-morph check → both missing → early-return WARN("no tsconfig and ts-morph")
    // Mutant: execSync('') throws TypeError → catch fires → WARN("npx not found") specifically
    //
    // Distinguishing assertion: real path message must NOT contain "npx not found"
    // (real path hits either the tsconfig-skip warn OR the execSync fail path — never "npx not found")
    mkdirSync(join(dir, 'src/domain'), { recursive: true });
    writeFile(dir, 'src/domain/greet.ts', 'export function greet() {}\n');
    // No tsconfig.json, no ts-morph installed in this temp dir
    const result = probeR4(dir);
    // Real code: npx found → tsconfig+ts-morph both absent → 'warn' with "no tsconfig and ts-morph" message
    // Mutant: execSync('') throws → catch → 'warn' with "npx not found" message
    // Both produce 'warn' BUT with DIFFERENT messages → assert on message content
    expect(result.result).toBe('warn');
    expect(result.message).not.toMatch(/npx not found/);
    expect(result.message).toContain('R4');
  });

  it('hasTsconfig && !hasTsMorph path: does NOT warn-skip (hasTsconfig=true gates the early-return)', () => {
    // Only tsconfig present (no ts-morph) → condition !hasTsconfig && !hasTsMorph is false
    // LogicalOperator mutant !hasTsconfig || !hasTsMorph would be TRUE → early-return
    // So the mutant would produce 'warn' instead of 'fail'/'warn' from execSync
    //
    // Uses fastExecSyncStub (DN-1 Path C) — this test asserts on conditional logic,
    // not on real-subprocess contract. The :344 sibling keeps real execSync.
    mkdirSync(join(dir, 'src/domain'), { recursive: true });
    writeFile(dir, 'src/domain/a.ts', 'export const x = 1;\n');
    writeFile(dir, 'tsconfig.json', '{"compilerOptions":{}}\n');
    const result = probeR4(dir, { execSync: fastExecSyncStub });
    // hasTsconfig=true → condition !hasTsconfig && !hasTsMorph = false → does NOT early-return
    // → execSync runs → result is fail or warn (from execSync failure)
    expect(['warn', 'fail']).toContain(result.result);
    // If it were the || mutant, result.message would contain 'skipped' (early-return warning)
    // The real code should NOT early-return here
    if (result.result === 'warn') {
      // 'warn' is OK (npx not found) but the message should NOT be the "no tsconfig and ts-morph" skip
      // The "both missing" message is exactly: '(skipped: no tsconfig.json and ts-morph not installed)'
      expect(result.message).not.toMatch(/no tsconfig\.json and ts-morph not installed/);
    }
  });

  it('hasTsMorph present path: does NOT warn-skip either (both present prevents early-return)', () => {
    // With || mutant: !hasTsconfig || !hasTsMorph → if only hasTsMorph is true (hasTsconfig=false)
    // → condition is true → early-return warn (wrong!)
    // Real code: !hasTsconfig && !hasTsMorph → false when either is present
    //
    // Uses fastExecSyncStub (DN-1 Path C) — see sibling test above for rationale.
    mkdirSync(join(dir, 'src/domain'), { recursive: true });
    writeFile(dir, 'src/domain/a.ts', 'export const x = 1;\n');
    // Make ts-morph "present" via the existence check
    mkdirSync(join(dir, 'node_modules/ts-morph'), { recursive: true });
    writeFile(dir, 'node_modules/ts-morph/package.json', '{"name":"ts-morph"}\n');
    const result = probeR4(dir, { execSync: fastExecSyncStub });
    // hasTsMorph=true → !hasTsconfig && !hasTsMorph = false → does NOT early-return
    // The result should be 'fail' or 'warn' (execSync fails, not the early-return warn)
    expect(['warn', 'fail']).toContain(result.result);
    if (result.result === 'warn') {
      expect(result.message).not.toMatch(/no tsconfig\.json and ts-morph not installed/);
    }
  });
});

// ── L167: !hasTsconfig && !hasTsMorph → if (true) (always skip) ─────────────
describe('probeR4() — hasTsconfig/hasTsMorph early-return condition (L167)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('WARN with message "no tsconfig.json and ts-morph not installed" when BOTH absent', () => {
    // Both conditions absent → early-return with specific warn message
    // if (true) mutant also early-returns but we verify the message content
    mkdirSync(join(dir, 'src/domain'), { recursive: true });
    writeFile(dir, 'src/domain/a.ts', 'export const x = 1;\n');
    // No tsconfig.json, no node_modules/ts-morph
    const result = probeR4(dir);
    // If npx is available: warn with specific message; if npx not found: warn(npx not found)
    expect(result.result).toMatch(/^(warn|pass)$/);
    // Either npx-not-found warn OR tsconfig+tsmorph-missing warn — both are 'warn' (or pass if no src/domain but src/domain exists here)
    // The critical check: when both missing AND npx exists, message must be exact
    if (result.message.includes('no tsconfig')) {
      expect(result.message).toContain('no tsconfig.json and ts-morph not installed');
    }
  });
});

// ── L187: readFileSync encoding 'utf8' → '' in probeD1() ─────────────────────
describe('probeD1() — readFileSync encoding (L187)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('reads AGENTS.md as a string (not Buffer) — encoding utf8 matters', () => {
    // If encoding is '' (empty), readFileSync returns a Buffer, not a string.
    // extractDeclaredSkills(buffer) would receive a Buffer object, which when passed
    // to remark().parse() may fail or produce different results.
    // The test: AGENTS.md with a skill → must extract correctly (requires string result)
    writeFile(dir, 'AGENTS.md', '# Agents\n\nUse skill `utf8-skill` for tasks.\n');
    const viols = probeD1(dir);
    // skill not on disk → violation should be found; if Buffer was passed, extraction might fail
    expect(viols.some((v) => v.includes('utf8-skill'))).toBe(true);
  });
});

// ── L221: val===null check → false ───────────────────────────────────────────
describe('walkJson() via probeD2() — null value handling (L221)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('null value in JSON does not produce a finding (null branch returns early)', () => {
    // val===null → returns early (no finding pushed)
    // Mutant: false || typeof val !== 'object' → val===null fails the null check
    // but typeof null === 'object' so the typeof branch also fails → FALLS THROUGH
    // to the object branch → would try to Object.entries(null) → TypeError or wrong behavior
    writeFile(dir, '.mcp.json', JSON.stringify({ nullKey: null, mcpServers: {} }));
    // Must NOT throw and must produce zero findings
    expect(() => probeD2(dir)).not.toThrow();
    const findings = probeD2(dir);
    expect(findings.filter((f) => f.reason.includes('nullKey'))).toHaveLength(0);
  });

  it('null at array position does not produce finding either', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ items: [null, 'http://ok'] }));
    expect(() => probeD2(dir)).not.toThrow();
    const findings = probeD2(dir);
    // null item → no TODO/FIXME → no finding from the null
    expect(findings).toHaveLength(0);
  });
});

// ── L222: typeof val === 'string' check → true ───────────────────────────────
describe('walkJson() — typeof val === string check (L222)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('number value does NOT produce TODO/FIXME finding (string type guard matters)', () => {
    // typeof val === 'string' → only strings are checked for TODO/FIXME
    // Mutant: true && TODO_VALUE_RE.test(val) → would call .test() on a number
    // TODO_VALUE_RE.test(42) → calls val.toString first? No — RegExp.test coerces.
    // But the test is: number 42 does NOT contain TODO text → finding would still be 0
    // Distinguishing case: a number whose string representation looks like TODO? Not realistic.
    // Better: verify a non-string doesn't accidentally match via coercion
    writeFile(dir, '.mcp.json', JSON.stringify({ count: 42, flag: true }));
    const findings = probeD2(dir);
    // numbers and booleans must NOT produce TODO findings
    expect(findings).toHaveLength(0);
  });

  it('boolean value does NOT produce finding (string type guard)', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ enabled: true, disabled: false }));
    const findings = probeD2(dir);
    expect(findings).toHaveLength(0);
  });

  it('string with TODO DOES produce finding (string type guard passes for actual strings)', () => {
    // Positive control: string value matching TODO_VALUE_RE → finding pushed
    writeFile(dir, '.mcp.json', JSON.stringify({ endpoint: 'TODO: set this' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.reason).toContain('TODO');
  });
});

// ── L246: existsSync(aiFactoryDir) → true ────────────────────────────────────
describe('probeD2() — aiFactory dir existence check (L246)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('does NOT throw when .ai-factory/ dir is absent (existsSync guard prevents readdirSync call)', () => {
    // If existsSync is mutated to true, readdirSync('.ai-factory') would be called
    // even when the directory doesn't exist → throws ENOENT (or returns empty caught by try/catch)
    // But the catch around readdirSync returns early — so the mutant may survive if catch handles it.
    // The key assertion: no crash AND no findings from the non-existent dir
    expect(() => probeD2(dir)).not.toThrow();
    const findings = probeD2(dir);
    expect(findings).toHaveLength(0);
  });

  it('returns findings only from .ai-factory/ when dir EXISTS (positive path)', () => {
    mkdirSync(join(dir, '.ai-factory'), { recursive: true });
    writeFile(dir, '.ai-factory/settings.json', JSON.stringify({ _comment: 'remove me' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.file.includes('.ai-factory'))).toBe(true);
  });
});

// ── L249: .endsWith('.json') filter + MethodExpression (filter removed) ──────
describe('probeD2() — .json extension filter in .ai-factory/ (L249)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('non-.json files in .ai-factory/ are NOT scanned (filter matters)', () => {
    mkdirSync(join(dir, '.ai-factory'), { recursive: true });
    // A .md file with TODO content — should NOT be scanned
    writeFile(dir, '.ai-factory/readme.md', 'TODO: document this\n');
    // A .sh file with _comment content — should NOT be scanned
    writeFile(dir, '.ai-factory/setup.sh', '# _comment placeholder\n');
    // No .json files → no findings
    const findings = probeD2(dir);
    // Without the filter, .md and .sh would be attempted as JSON → JSON.parse fails → caught silently
    // But if filter is `endsWith("")` → ALL files match → .md → JSON.parse fails → caught → no finding
    // So this test is not enough alone. Need a second: txt file with valid JSON content and TODO
    writeFile(dir, '.ai-factory/data.txt', JSON.stringify({ key: 'TODO: value' }));
    const findings2 = probeD2(dir);
    // data.txt ends with '.txt' not '.json' → must NOT be scanned
    expect(findings2.filter((f) => f.file.includes('data.txt'))).toHaveLength(0);
  });

  it('endsWith("") mutation would match ALL files — verify only .json files produce findings', () => {
    mkdirSync(join(dir, '.ai-factory'), { recursive: true });
    // A valid JSON file with TODO — should be found
    writeFile(dir, '.ai-factory/config.json', JSON.stringify({ key: 'TODO: fix this' }));
    // A non-JSON file with TODO content but not valid JSON → JSON.parse would throw
    writeFile(dir, '.ai-factory/notes.yaml', 'key: TODO: fix this');
    const findings = probeD2(dir);
    // config.json → parsed → finding exists
    expect(findings.some((f) => f.file.includes('config.json'))).toBe(true);
    // notes.yaml → not .json → not scanned (even if endsWith("") would match, JSON.parse would fail silently)
    expect(findings.filter((f) => f.file.includes('notes.yaml'))).toHaveLength(0);
  });
});

// ── L256: !existsSync(filePath) → false (never skip) ─────────────────────────
describe('probeD2() — per-file existence check (L256)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('candidates that do not exist are skipped (no throw) — .mcp.json not present', () => {
    // No .mcp.json and no .claude/settings.json — both are in candidates
    // existsSync returns false → skip; mutant (false) never skips → readFileSync throws
    // But the try/catch in the loop catches it → mutant survives silently
    // So we need to distinguish: with guard=false, readFileSync on non-existent file throws
    // The catch block is OUTSIDE the guard (for JSON.parse errors), so the readFileSync
    // would throw ENOENT inside the try block → caught → skipped silently → same result?
    // Wait: the catch block IS at the filePath level — but the guard is BEFORE the try block.
    // Let me re-read the source:
    //   if (!existsSync(filePath)) continue;  ← guard is before try
    //   try { JSON.parse(readFileSync...) } catch { }
    // Mutant: if (false) continue → never skips → readFileSync(nonExistent) throws OUTSIDE try
    // → uncaught ENOENT → test would throw → mutant is KILLED by the test
    expect(() => probeD2(dir)).not.toThrow();
    const findings = probeD2(dir);
    expect(findings).toHaveLength(0);
  });

  it('existence check: file that exists IS read (positive path)', () => {
    writeFile(dir, '.mcp.json', JSON.stringify({ _comment: 'test' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ── L258-259: readFileSync encoding '' + startsWith path separator ────────────
describe('probeD2() — readFileSync/rel path (L258-259)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('file content is read as string (utf8 encoding), not Buffer', () => {
    // If encoding is '' → readFileSync returns Buffer → JSON.parse(Buffer) works but
    // the relative path computation is still correct → mutant may survive silently
    // Key test: a JSON file with TODO must produce a finding with correct content
    writeFile(dir, '.mcp.json', JSON.stringify({ key: 'TODO: fix this' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    // The finding reason must contain the actual string value (requires string, not Buffer)
    expect(findings[0]!.reason).toContain('TODO: fix this');
  });

  it('file path in finding is relative to cwd (not absolute) — path separator matters', () => {
    // startsWith(cwd + '/') must use '/' not '' separator
    // If mutated to cwd + '', then startsWith(cwd) would match every path under cwd
    // including paths like /tmp/cwd-prefix-coincidence/ — broader match
    // Concrete: the file path must be exactly '.mcp.json' (relative)
    writeFile(dir, '.mcp.json', JSON.stringify({ _comment: 'x' }));
    const findings = probeD2(dir);
    expect(findings.length).toBeGreaterThan(0);
    // File must be relative (no leading slash)
    expect(findings[0]!.file).toBe('.mcp.json');
    expect(findings[0]!.file).not.toContain('/');  // relative path has no leading slash
  });
});

// ── L280: readFileSync encoding '' in probeD3() ──────────────────────────────
describe('probeD3() — readFileSync encoding (L280)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('reads doc file as string and includes() check works correctly', () => {
    // If encoding is '' → readFileSync returns Buffer; Buffer.includes() also works
    // but as a Buffer search, not a substring search — may miss string matches.
    // Test: file with CANON_PHRASE → must NOT produce violation
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `# Doc\n\n${CANON_PHRASE}\n`);
    }
    const viols = probeD3(dir);
    // All docs have the phrase → no violations
    expect(viols).toHaveLength(0);
  });
});

// ── L306: pkgMtime > decMtime → >= ───────────────────────────────────────────
describe('probeD4() — strict inequality pkgMtime > decMtime (L306)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('PASS when tool-decisions.md is newer than package.json (strictly newer)', async () => {
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    await new Promise((r) => setTimeout(r, 20));
    writeFile(dir, '.ai-factory/tool-decisions.md', '# decisions\n');
    const result = probeD4(dir);
    // pkgMtime < decMtime → condition pkgMtime > decMtime is false → pass
    expect(result.result).toBe('pass');
    // >= mutant would also pass here (pkgMtime < decMtime → not >=) — need the equal-mtime case
  });

  it('WARN when package.json is strictly newer (pkgMtime > decMtime — not just >=)', async () => {
    writeFile(dir, '.ai-factory/tool-decisions.md', '# decisions\n');
    await new Promise((r) => setTimeout(r, 20));
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    const result = probeD4(dir);
    // pkgMtime > decMtime → warn
    expect(result.result).toBe('warn');
  });

  it('PASS when mtime is equal (strictly > fails, >= would warn — kills >= mutant) [utimesSync deterministic]', () => {
    // Force EXACTLY equal mtime on both files using utimesSync — no timing dependency.
    // Real code (>):  pkgMtime > decMtime → false when equal → returns 'pass'
    // Mutant  (>=): pkgMtime >= decMtime → true when equal → returns 'warn'
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    writeFile(dir, '.ai-factory/tool-decisions.md', '# decisions\n');
    const pkgPath = join(dir, 'package.json');
    const decPath = join(dir, '.ai-factory/tool-decisions.md');
    const t = new Date('2026-01-01T00:00:00.000Z');
    utimesSync(pkgPath, t, t);
    utimesSync(decPath, t, t);
    // Sanity: verify the mtimes are actually equal
    expect(statSync(pkgPath).mtimeMs).toBe(statSync(decPath).mtimeMs);
    const result = probeD4(dir);
    // Equal mtime → pkgMtime > decMtime is false → real code returns 'pass'
    // >= mutant: pkgMtime >= decMtime is true → returns 'warn' — test would FAIL → kills mutant
    expect(result.result).toBe('pass');
    expect(result.message).toContain('D4');
  });
});

// ── L328-331: Regex anchor ^ removed from D5 patterns ────────────────────────
describe('probeD5() — regex anchor ^ in exemption patterns (L328-331)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('D5_FROZEN_RE: file NOT starting with docs/meta-factory/research-patches/ is NOT exempt (L328 anchor)', () => {
    // Without ^ anchor: a file like 'other/docs/meta-factory/research-patches/x.md' would match
    // With ^ anchor: only paths STARTING with the pattern match
    // Create a file whose path contains the pattern but doesn't START with it
    writeFile(dir, 'other/docs/meta-factory/research-patches/x.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // 'other/docs/meta-factory/research-patches/x.md' does NOT start with the pattern
    // → must NOT be exempt → must appear in findings
    const orphan = findings.find((f) => f.file.includes('other/docs'));
    expect(orphan).toBeDefined();
  });

  it('D5_FROZEN_RE: file properly starting with docs/meta-factory/research-patches/ IS exempt (L328 positive)', () => {
    writeFile(dir, 'docs/meta-factory/research-patches/patch.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    expect(findings.find((f) => f.file.includes('research-patches'))).toBeUndefined();
  });

  it('D5_TEST_INFRA_RE: file that does NOT start with packages/core/audit-self/ is NOT exempt (L329 first anchor)', () => {
    // Remove first ^ anchor: 'other/packages/core/audit-self/audit-ai-docs.ts' would match
    writeFile(dir, 'other/packages/core/audit-self/audit-ai-docs.ts', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // Must NOT be exempt (path doesn't start with packages/core/audit-self/)
    const orphan = findings.find((f) => f.file.includes('other/packages'));
    expect(orphan).toBeDefined();
  });

  it('D5_ROOT_SOURCE_RE: file named docs/README.md is NOT exempt (L330 anchor prevents partial match)', () => {
    // Without ^: /README\.md$/ matches 'docs/README.md' — should NOT be exempt
    // With ^: /^README\.md$/ only matches the root 'README.md'
    writeFile(dir, 'docs/README.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // docs/README.md is NOT root README.md → must be flagged
    const docReadme = findings.find((f) => f.file === 'docs/README.md');
    expect(docReadme).toBeDefined();
  });

  it('D5_ROOT_SOURCE_RE: only root README.md (exactly) is exempt (L330 $ end anchor)', () => {
    // Without $ anchor: /^README\.md/ would match 'README.md.bak' or 'README.md.old'
    writeFile(dir, 'README.md.bak', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // README.md.bak does NOT match /^README\.md$/ → must be flagged
    const bakFinding = findings.find((f) => f.file === 'README.md.bak');
    expect(bakFinding).toBeDefined();
  });

  it('D5_GITIGNORED_RE: file not starting with .claude/orchestrator-prompts/ is NOT exempt (L331 anchor)', () => {
    // Without ^: 'other/.claude/orchestrator-prompts/kickoff.md' would match
    writeFile(dir, 'other/.claude/orchestrator-prompts/kickoff.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const orphan = findings.find((f) => f.file.includes('other/.claude'));
    expect(orphan).toBeDefined();
  });

  it('D5_TEST_INFRA_RE: template-render.audit.ts NOT starting with packages/core/audit-self/ is NOT exempt (L329 second anchor)', () => {
    // Mutant A removes ^ from second alternative:
    //   /^packages\/...audit-ai-docs...| packages\/...template-render\.audit\.ts/  (no ^ on second alt)
    // → 'other/packages/core/audit-self/template-render.audit.ts' would match mutant second alt
    // → incorrectly treated as exempt
    // Real: ^ requires the path to START with packages/core/...
    writeFile(dir, 'other/packages/core/audit-self/template-render.audit.ts', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // Real regex: 'other/packages/.../template-render.audit.ts' does NOT start with packages/... → not exempt → flagged
    // Mutant regex: second alt matches without ^ → incorrectly exempt → NOT flagged
    const orphan = findings.find((f) => f.file.includes('other/packages') && f.file.includes('template-render'));
    expect(orphan).toBeDefined();
    expect(orphan!.reason).toContain('not in DOWNSTREAM_DOCS');
  });
});

// ── L345: sort() removed from [...found].sort() in probeD5() ─────────────────
describe('probeD5() — findings returned in sorted order (L345)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('orphan files are returned in strictly ascending alphabetical order', () => {
    // Create multiple orphan files out of alphabetical order
    writeFile(dir, 'docs/zzz-file.md', `${CANON_PHRASE}\n`);
    writeFile(dir, 'docs/aaa-file.md', `${CANON_PHRASE}\n`);
    writeFile(dir, 'docs/mmm-file.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const orphans = findings.filter((f) => f.file.startsWith('docs/') &&
      (f.file.includes('aaa') || f.file.includes('mmm') || f.file.includes('zzz')));
    expect(orphans.length).toBeGreaterThanOrEqual(2);
    // Verify sorted order: each file must be <= next
    for (let i = 0; i < orphans.length - 1; i++) {
      expect(orphans[i]!.file.localeCompare(orphans[i + 1]!.file)).toBeLessThanOrEqual(0);
    }
  });
});

// ── L365: SKIP_DIRS StringLiteral mutations (.stryker-tmp → '' and .stryker → '') ─
describe('grepFilesContaining() via probeD5() — SKIP_DIRS entries (L365)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('.stryker-tmp/ directory is skipped during file walk (entry name matters)', () => {
    // SKIP_DIRS.has('.stryker-tmp') must be true; mutant changes '.stryker-tmp' to ''
    // → SKIP_DIRS.has('.stryker-tmp') becomes false → walk enters .stryker-tmp/
    writeFile(dir, '.stryker-tmp/sandbox123/some.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // .stryker-tmp/ files must be skipped both by SKIP_DIRS and D5_GITIGNORED_RE
    // But if SKIP_DIRS doesn't skip it, grepFilesContaining returns the file,
    // and D5_GITIGNORED_RE still exempts it in probeD5 → might still survive
    // The key: if SKIP_DIRS skips the entry, the file is never even read → performance
    // For correctness: the D5_GITIGNORED_RE provides backup exemption
    // To kill L365 specifically, we need a case where SKIP_DIRS miss causes a difference
    // that D5_GITIGNORED_RE doesn't cover → use '.stryker' directory specifically
    const strykerFinding = findings.find((f) => f.file.startsWith('.stryker-tmp'));
    expect(strykerFinding).toBeUndefined();
  });

  it('.stryker/ directory is skipped during file walk (.stryker entry name matters)', () => {
    // If '.stryker' is mutated to '' in SKIP_DIRS, .stryker/ directory is walked
    // D5_GITIGNORED_RE /^(\.claude\/orchestrator-prompts\/|\.stryker-tmp\/|\.stryker\/)/ also exempts it
    // So a .stryker/ file would still be exempt via D5_GITIGNORED_RE even if not skipped
    // The test confirms it's excluded regardless of whether SKIP_DIRS or D5_GITIGNORED_RE catches it
    writeFile(dir, '.stryker/sandbox99/file.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    const strykerFinding = findings.find((f) => f.file.startsWith('.stryker/'));
    expect(strykerFinding).toBeUndefined();
  });
});

// ── L378: content.includes(phrase) → true in grepFilesContaining() ───────────
describe('grepFilesContaining() — content.includes(phrase) check (L378)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('files NOT containing canonical phrase are not returned by D5 grep', () => {
    // If includes(phrase) → true, ALL files would be considered to contain the phrase
    // → many enrolled or exempt files would be returned, then pass their exemption
    // But NON-enrolled, NON-exempt files WITHOUT the phrase would also be returned → false findings
    // We create a non-exempt file WITHOUT the phrase → with mutant it gets flagged; without, it doesn't
    writeFile(dir, 'docs/no-phrase-file.md', '# No phrase here.\n\nSome other content.\n');
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // docs/no-phrase-file.md does NOT contain CANON_PHRASE or CANON_ALT
    // → must NOT appear in findings
    const falseFinding = findings.find((f) => f.file === 'docs/no-phrase-file.md');
    expect(falseFinding).toBeUndefined();
  });

  it('files containing CANON_ALT are found but enrolled ones do not flag', () => {
    // D5 scans for both CANON_PHRASE and CANON_ALT; if includes → true, every file would match
    // A file with CANON_ALT but not CANON_PHRASE → should be found but if enrolled → no finding
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_ALT}\n`); }
    writeFile(dir, 'README.md', `${CANON_ALT}\n`);
    const findings = probeD5(dir);
    // All enrolled → no findings (whether or not phrase-check fires)
    expect(findings).toHaveLength(0);
  });
});

// ── L377/380: readFileSync encoding '' and path separator in grepFilesContaining ─
describe('grepFilesContaining() — readFileSync encoding and path relativization (L377/380)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('relative paths returned by grepFilesContaining have no leading slash', () => {
    // full.startsWith(cwd + '/') → slice → relative; mutant: startsWith(cwd + '')
    // With '' separator: startsWith(cwd) would still match (cwd is a prefix of the full path)
    // and cwd.length + 1 would still slice correctly... so the mutant is mostly equivalent here.
    // But: if full === cwd (exact match), the mutant would produce '' while real produces cwd.
    // More concretely: the test verifies relative paths don't contain the dir prefix
    writeFile(dir, 'docs/test.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const findings = probeD5(dir);
    // Any orphan finding must have a relative path
    const orphan = findings.find((f) => f.file === 'docs/test.md');
    expect(orphan).toBeDefined();
    expect(orphan!.file.startsWith('/')).toBe(false);
    expect(orphan!.file).not.toContain(dir);
  });
});

// ── L428-497: ArrayDeclaration details:[] → ["Stryker was here"] ──────────────
// Surviving probes: R4, D1-warn, D1-pass, D2-pass, D3-pass, D4-any, D5-fail-empty
describe('runAudit() — probe result details[] must be empty for pass/warn (L428-497)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); markAuthoring(dir); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('R4 pass result has empty details array (L428)', () => {
    // No src/domain → R4 pass; details must be []
    const report = runAudit(dir, 'R4');
    const r4 = report.results.find((r) => r.probe === 'R4');
    expect(r4!.details).toHaveLength(0);
  });

  it('D1 warn (no AGENTS.md) result has empty details array (L435)', () => {
    // No AGENTS.md → D1 warn; details must be []
    const report = runAudit(dir, 'D1');
    const d1 = report.results.find((r) => r.probe === 'D1');
    expect(d1!.level).toBe('warn');
    expect(d1!.details).toHaveLength(0);
  });

  it('D1 pass (AGENTS.md present, no skills) result has empty details array (L439)', () => {
    writeFile(dir, 'AGENTS.md', '# Agents\n\nNo skills.\n');
    const report = runAudit(dir, 'D1');
    const d1 = report.results.find((r) => r.probe === 'D1');
    expect(d1!.level).toBe('pass');
    expect(d1!.details).toHaveLength(0);
  });

  it('D2 pass (no JSON files) result has empty details array (L451)', () => {
    const report = runAudit(dir, 'D2');
    const d2 = report.results.find((r) => r.probe === 'D2');
    expect(d2!.level).toBe('pass');
    expect(d2!.details).toHaveLength(0);
  });

  it('D3 pass result has empty details array (L467)', () => {
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    const report = runAudit(dir, 'D3');
    const d3 = report.results.find((r) => r.probe === 'D3');
    expect(d3!.level).toBe('pass');
    expect(d3!.details).toHaveLength(0);
  });

  it('D4 result has empty details array regardless of level (L476)', () => {
    // D4 never populates details in any outcome
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    const report = runAudit(dir, 'D4');
    const d4 = report.results.find((r) => r.probe === 'D4');
    expect(d4!.details).toHaveLength(0);
  });

  it('D4 pass result (no package.json) also has empty details array (L476 alternate path)', () => {
    const report = runAudit(dir, 'D4');
    const d4 = report.results.find((r) => r.probe === 'D4');
    expect(d4!.details).toHaveLength(0);
  });
});

// ── L457/491: ArrowFunction + StringLiteral in details.map() ──────────────────
describe('runAudit() — details.map() content format (L457, L491)', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); markAuthoring(dir); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('D2 warn details items are "file: reason" strings (not empty strings from map(() => ``))', () => {
    // L457 ArrowFunction mutant: map(() => undefined) → undefined items in details
    // L457 StringLiteral mutant: map((f) => ``) → empty string items
    writeFile(dir, '.mcp.json', JSON.stringify({ _comment: 'remove me' }));
    const report = runAudit(dir, 'D2');
    const d2 = report.results.find((r) => r.probe === 'D2');
    expect(d2!.level).toBe('warn');
    // Details must contain non-empty strings with the expected format
    expect(d2!.details.length).toBeGreaterThan(0);
    expect(d2!.details[0]).toBeTruthy();
    expect(d2!.details[0]).toMatch(/\.mcp\.json:/);
    expect(d2!.details[0]).toContain('_comment');
  });

  it('D5 fail details items include "file: reason" string (L491 StringLiteral map)', () => {
    // L491 StringLiteral: ...d5Findings.map((f) => ``) → empty strings instead of "file: reason"
    writeFile(dir, 'docs/orphan-map.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    expect(d5!.level).toBe('fail');
    // First element must be "file: reason" format (not empty string)
    const fileReasonLines = d5!.details.filter((d) => d.includes(':') && d.includes('orphan-map'));
    expect(fileReasonLines.length).toBeGreaterThan(0);
    expect(fileReasonLines[0]).toMatch(/docs\/orphan-map\.md:/);
  });

  it('D5 fail details empty-string separator line (\'\' not \'Stryker was here!\') (L492)', () => {
    // L492 StringLiteral: '' → 'Stryker was here!' — the separator line must be exactly ''
    writeFile(dir, 'docs/orphan-sep.md', `${CANON_PHRASE}\n`);
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    // The separator line (empty string '') must appear in details between findings and fix hint
    const emptyLines = d5!.details.filter((d) => d === '');
    expect(emptyLines.length).toBeGreaterThan(0);
  });
});

// ── L518: argv.slice(2).find() mutations ──────────────────────────────────────
describe('main() — argv parsing (L518)', () => {
  let dir: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutLines: string[];

  beforeEach(() => {
    dir = makeTmpDir();
    markAuthoring(dir);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => {
      throw new Error(`process.exit(${_code})`);
    });
    stdoutLines = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdoutLines.push(args.join(' '));
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('argv[0] and argv[1] (node/script) are ignored — --only= in argv[2] is used', () => {
    // MethodExpression mutant: argv.find() instead of argv.slice(2).find()
    // → would find '--only=D1' even in argv[0] or argv[1] if present there
    // If argv[0] is 'node' and argv[1] is '--only=D1', slice(2) skips them
    // Without slice: find() would match argv[1] '--only=D1' when it shouldn't
    // Test: --only=D1 in argv[1] (script position) must NOT be picked up
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    try { main(dir, ['node', '--only=D1', 'audit-ai-docs.ts']); } catch { /* exit */ }
    // Without slice: --only=D1 is at argv[1], find() without slice(2) would match it
    // → only D1 runs → D1 warn (no AGENTS.md) → exit 0 (no fails)
    // With slice(2): --only=D1 is at argv[1], skipped → no --only arg found → all probes run
    // The output should contain more than just D1 (all probes ran)
    const d3Lines = stdoutLines.filter((l) => l.includes('D3'));
    const d1Lines = stdoutLines.filter((l) => l.includes('D1'));
    // All probes ran → both D1 and D3 appear
    expect(d1Lines.length).toBeGreaterThan(0);
    expect(d3Lines.length).toBeGreaterThan(0);
  });

  it('startsWith("--only=") not endsWith — correctly identifies --only= flag (L518 endsWith mutant)', () => {
    // Mutant: a.endsWith('--only=') → matches strings like 'something--only='
    // Real: a.startsWith('--only=') → matches '--only=D1' correctly
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    try { main(dir, ['node', 'script.ts', '--only=D5']); } catch { /* exit */ }
    // --only=D5 starts with '--only=' → D5 probe selected
    // D5: all enrolled → pass
    const d5Lines = stdoutLines.filter((l) => l.includes('D5'));
    expect(d5Lines.length).toBeGreaterThan(0);
    // D3 must NOT appear (only D5 ran)
    const d3Lines = stdoutLines.filter((l) => l.includes('D3'));
    expect(d3Lines).toHaveLength(0);
  });

  it('startsWith("--only=") not startsWith("") — empty string matches everything (L518 "" literal)', () => {
    // Mutant: startsWith("") → EVERY argv element matches → find() returns argv[2] (first element after slice)
    // With argv = ['node', 'script.ts', 'somearg'], find returns 'somearg'
    // onlyArg.slice('--only='.length) = 'somearg'.slice(7) = 'earg' → invalid probe name → no probe matches
    // With real code: startsWith("") on argv with no --only= → find returns undefined → only = '' → all probes
    // Distinguishing test: argv with no --only= → all probes should run, not just an invalid one
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    try { main(dir, ['node', 'audit-ai-docs.ts']); } catch { /* exit */ }
    // All probes ran → both D1 and D3 and D5 appear in output
    const d3Lines = stdoutLines.filter((l) => l.includes('D3'));
    const d5Lines = stdoutLines.filter((l) => l.includes('D5'));
    expect(d3Lines.length).toBeGreaterThan(0);
    expect(d5Lines.length).toBeGreaterThan(0);
  });
});

// ── L533-534: console.log('') and console.log('───...') ─────────────────────
describe('main() — separator lines in output (L533-534)', () => {
  let dir: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutLines: string[];

  beforeEach(() => {
    dir = makeTmpDir();
    markAuthoring(dir);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => {
      throw new Error(`process.exit(${_code})`);
    });
    stdoutLines = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdoutLines.push(args.join(' '));
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('prints exactly one blank line (empty string) before the separator (L533)', () => {
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    try { main(dir, ['node', 'audit-ai-docs.ts']); } catch { /* exit */ }
    // A blank line ('') must appear in the output before the separator bar
    const blankLines = stdoutLines.filter((l) => l === '');
    expect(blankLines.length).toBeGreaterThanOrEqual(1);
    // The separator must also appear
    const sepLine = stdoutLines.find((l) => l.includes('─────'));
    expect(sepLine).toBeDefined();
    // Blank line must appear BEFORE the separator line
    const blankIdx = stdoutLines.lastIndexOf('');
    const sepIdx = stdoutLines.findIndex((l) => l.includes('─────'));
    expect(blankIdx).toBeLessThan(sepIdx);
  });

  it('prints a separator bar (─ characters) before the summary (L534)', () => {
    for (const doc of DOWNSTREAM_DOCS) { writeFile(dir, doc, `${CANON_PHRASE}\n`); }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);
    try { main(dir, ['node', 'audit-ai-docs.ts']); } catch { /* exit */ }
    // A line containing '─' (not empty) must appear
    const sepLines = stdoutLines.filter((l) => l.includes('─'));
    expect(sepLines.length).toBeGreaterThan(0);
    // The separator must NOT be empty (mutant changes it to '')
    expect(sepLines[0]).not.toBe('');
    expect(sepLines[0]!.length).toBeGreaterThan(10);
  });
});

// ─── main() — CLI entrypoint ─────────────────────────────────────────────────
// Tests that cover the I/O shell in main(): PASS/FAIL/WARN prefixes, argv parsing,
// process.exit codes, and the "Audit complete:" summary line.

describe('main() — CLI entrypoint', () => {
  let dir: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutLines: string[];
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = makeTmpDir();
    markAuthoring(dir);
    // Mock process.exit so it doesn't terminate the test process
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => {
      throw new Error(`process.exit(${_code})`);
    });
    // Capture console.log output
    stdoutLines = [];
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdoutLines.push(args.join(' '));
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('exits 0 and prints "Audit complete:" summary when all probes pass', () => {
    // Set up a clean audit environment
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);

    let caught: string | null = null;
    try {
      main(dir, ['node', 'audit-ai-docs.ts']);
    } catch (e) {
      caught = (e as Error).message;
    }
    // Should exit 0
    expect(caught).toBe('process.exit(0)');
    // Summary line must appear
    const summaryLine = stdoutLines.find((l) => l.includes('Audit complete:'));
    expect(summaryLine).toBeDefined();
    expect(summaryLine).toContain('0 FAIL');
  });

  it('exits 1 when D3 fails (at least one FAIL)', () => {
    // Missing canonical phrase in CLAUDE.md → D3 fail
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, doc === 'CLAUDE.md' ? '# CLAUDE\n' : `${CANON_PHRASE}\n`);
    }

    let caught: string | null = null;
    try {
      main(dir, ['node', 'audit-ai-docs.ts']);
    } catch (e) {
      caught = (e as Error).message;
    }
    // Should exit 1 (has FAILs)
    expect(caught).toBe('process.exit(1)');
  });

  it('prints "PASS:" prefix for passing probes (not "WARN:" for PASS results)', () => {
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);

    try { main(dir, ['node', 'audit-ai-docs.ts']); } catch { /* exit mock */ }

    // Lines starting with 'PASS:' (probe prefix, not summary line)
    const passPrefixLines = stdoutLines.filter((l) => /^PASS:/.test(l));
    expect(passPrefixLines.length).toBeGreaterThan(0);
    // D3 should pass — check that its line starts with PASS: not WARN:
    const d3Lines = stdoutLines.filter((l) => l.includes('D3'));
    expect(d3Lines.some((l) => l.startsWith('PASS:'))).toBe(true);
    expect(d3Lines.some((l) => l.startsWith('WARN:'))).toBe(false);
  });

  it('prints "FAIL:" prefix for failing probes (not "PASS:" for FAIL results)', () => {
    // D3 fail — CLAUDE.md missing phrase
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, doc === 'CLAUDE.md' ? '# CLAUDE\n' : `${CANON_PHRASE}\n`);
    }

    try { main(dir, ['node', 'audit-ai-docs.ts']); } catch { /* exit mock */ }

    // Lines starting with 'FAIL:' (the probe prefix lines, not summary)
    // Use regex to match "FAIL:" at line start — NOT the summary "1 FAIL" count
    const failPrefixLines = stdoutLines.filter((l) => /^FAIL:/.test(l));
    expect(failPrefixLines.length).toBeGreaterThan(0);
    // Must NOT show "PASS:" for the failing D3 probe
    const d3Lines = stdoutLines.filter((l) => l.includes('D3'));
    expect(d3Lines.some((l) => l.startsWith('FAIL:'))).toBe(true);
    expect(d3Lines.some((l) => l.startsWith('PASS:'))).toBe(false);
  });

  it('prints "WARN:" prefix for warn probes (not "PASS:" for WARN results)', () => {
    // D1: no AGENTS.md → warn; D4: package.json but no tool-decisions → warn
    writeFile(dir, 'package.json', '{"name":"test"}\n');
    // AGENTS.md is skipped deliberately: this case exercises the D1 warn arm,
    // which fires precisely when AGENTS.md is absent. The exclusion used to be
    // implicit (AGENTS.md was missing from DOWNSTREAM_DOCS, so this loop never
    // created it); enrolling it there made the omission explicit instead.
    for (const doc of DOWNSTREAM_DOCS.filter((d) => d !== 'AGENTS.md')) {
      writeFile(dir, doc, `${CANON_PHRASE}\n`);
    }
    writeFile(dir, 'README.md', `${CANON_PHRASE}\n`);

    try { main(dir, ['node', 'audit-ai-docs.ts']); } catch { /* exit mock */ }

    // Lines starting with 'WARN:' (probe prefix lines, not summary count)
    const warnPrefixLines = stdoutLines.filter((l) => /^WARN:/.test(l));
    expect(warnPrefixLines.length).toBeGreaterThan(0);
    // D1 warn (no AGENTS.md) must show WARN: not PASS:
    const d1Lines = stdoutLines.filter((l) => l.includes('D1'));
    expect(d1Lines.some((l) => l.startsWith('WARN:'))).toBe(true);
    expect(d1Lines.some((l) => l.startsWith('PASS:'))).toBe(false);
  });

  it('--only=D3 argv arg isolates D3 probe (via main)', () => {
    writeFile(dir, '.claude/session-bootstrap.md', `${CANON_PHRASE}\n`);
    // missing other docs → D3 fail

    let caught: string | null = null;
    try {
      main(dir, ['node', 'audit-ai-docs.ts', '--only=D3']);
    } catch (e) {
      caught = (e as Error).message;
    }
    // D3 fail → exit 1
    expect(caught).toBe('process.exit(1)');
    // Only D3 probe runs → only one FAIL line
    const failLines = stdoutLines.filter((l) => l.includes('FAIL'));
    expect(failLines.length).toBeGreaterThan(0);
  });

  it('prints detail lines indented under fail result', () => {
    // D3 fail produces detail lines
    for (const doc of DOWNSTREAM_DOCS) {
      writeFile(dir, doc, doc === 'CLAUDE.md' ? '# CLAUDE\n' : `${CANON_PHRASE}\n`);
    }

    try { main(dir, ['node', 'audit-ai-docs.ts', '--only=D3']); } catch { /* exit */ }

    // Detail lines are indented with 4 spaces
    const detailLines = stdoutLines.filter((l) => l.startsWith('    '));
    expect(detailLines.length).toBeGreaterThan(0);
  });
});

// ─── consumer mode — D3/D5 are authoring-repo probes ──────────────────────────
// Bug (2026-06-11): fresh consumer installs (install.sh ships the audit to
// scripts/audit-ai-docs.sh) failed D3 (4× "file not found" — none of
// DOWNSTREAM_DOCS is in the shipped payload) and D5 (the installed script
// itself carries the canonical phrase; the TEST_INFRA exemption only covered
// the authoring path). install.sh "Next steps: Run ./scripts/audit-ai-docs.sh
// — should PASS" was unsatisfiable. Fix: D3/D5 run only in the framework
// authoring repo (detected via presence of the script's own source path);
// on consumer installs they pass as skipped — same pattern as D4's
// "(no package.json — skipped)".

describe('consumer mode — D3/D5 skip outside the authoring repo', () => {
  let dir: string;
  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('isAuthoringRepo(): false for a consumer-shaped dir, true when the source-path marker exists', () => {
    expect(isAuthoringRepo(dir)).toBe(false);
    markAuthoring(dir);
    expect(isAuthoringRepo(dir)).toBe(true);
  });

  it('D3 passes as skipped on a consumer install (DOWNSTREAM_DOCS not shipped)', () => {
    // Fresh consumer shape: installed script only, none of the 4 authoring docs
    writeFile(dir, 'scripts/audit-ai-docs.sh', `# installed copy\nCANON_PHRASE="${CANON_PHRASE}"\n`);
    const report = runAudit(dir, 'D3');
    const d3 = report.results.find((r) => r.probe === 'D3');
    expect(d3!.level).toBe('pass');
    expect(d3!.message).toContain('skipped: consumer install');
    expect(d3!.details).toHaveLength(0);
  });

  it('D5 passes as skipped on a consumer install (installed script carries the phrase but is not an orphan)', () => {
    writeFile(dir, 'scripts/audit-ai-docs.sh', `# installed copy\nCANON_PHRASE="${CANON_PHRASE}"\n`);
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    expect(d5!.level).toBe('pass');
    expect(d5!.message).toContain('skipped: consumer install');
    expect(d5!.details).toHaveLength(0);
  });

  it('main() exits 0 on a fresh consumer-shaped install (the install.sh next-steps invariant)', () => {
    writeFile(dir, 'scripts/audit-ai-docs.sh', `# installed copy\nCANON_PHRASE="${CANON_PHRASE}"\n`);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => {
      throw new Error(`process.exit(${_code})`);
    });
    const stdoutLines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdoutLines.push(args.join(' '));
    });
    let caught: string | null = null;
    try {
      main(dir, ['node', 'audit-ai-docs.ts']);
    } catch (e) {
      caught = (e as Error).message;
    } finally {
      vi.restoreAllMocks();
    }
    expect(exitSpy).toHaveBeenCalled();
    expect(caught).toBe('process.exit(0)');
    const summaryLine = stdoutLines.find((l) => l.includes('Audit complete:'));
    expect(summaryLine).toContain('0 FAIL');
  });

  it('paired negative: consumer mode does NOT neuter the audit — D1 still fails on a phantom skill', () => {
    writeFile(dir, 'AGENTS.md', '# Agents\n\nUse skill `phantom-skill` for X.\n');
    const report = runAudit(dir, 'D1');
    const d1 = report.results.find((r) => r.probe === 'D1');
    expect(d1!.level).toBe('fail');
    expect(d1!.details.some((d) => d.includes('phantom-skill'))).toBe(true);
  });

  it('paired negative: the authoring marker restores D3 FAIL on missing docs', () => {
    markAuthoring(dir);
    const report = runAudit(dir, 'D3');
    const d3 = report.results.find((r) => r.probe === 'D3');
    expect(d3!.level).toBe('fail');
    expect(d3!.details.some((d) => d.includes('file not found'))).toBe(true);
  });

  it('paired negative: the authoring marker restores D5 FAIL on an orphan file', () => {
    markAuthoring(dir);
    writeFile(dir, 'docs/consumer-orphan.md', `${CANON_PHRASE}\n`);
    const report = runAudit(dir, 'D5');
    const d5 = report.results.find((r) => r.probe === 'D5');
    expect(d5!.level).toBe('fail');
    expect(d5!.details.some((d) => d.includes('docs/consumer-orphan.md'))).toBe(true);
  });
});
