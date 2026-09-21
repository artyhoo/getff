/**
 * Principle 21 — Shipped-agent / shipped-skill `tools:`-name validity (M1 gate)
 *
 * Source: docs/meta-factory/research-patches/2026-06-16-shipped-artifact-liveness.md §0/§4 (M1 spec)
 *         SSOT docs/meta-factory/prior-art-evaluations.md #121 (verdict BUILD)
 *         Umbrella: shipped-artifact-liveness-gap, Stage 2 / Phase 1.
 *
 * Closes #551: 6 shipped `agents/*.md` declared NON-canonical Claude Code tool
 * names (`read_file`, `list_files`, `run_command`). Per CC's Agent-tool contract
 * («`tools` only: the subagent gets only the listed tools»), an agent dispatched
 * with unresolvable names resolves to ZERO usable tools — it cannot Read, Glob, or
 * Bash, so a read-only "auditor / verifier / prober" has only one path left:
 * fabricate findings. `npm run validate` was green while the agents were dead,
 * because NO principle test, hook, or script parsed `agents/*.md` `tools:`.
 *
 * Invariant: every shipped `agents/*.md` `tools:` entry AND every shipped-skill
 * `allowed-tools` entry must be a real Claude Code tool name — its base name (the
 * `Bash` in a scoped `Bash(git *)`) ∈ the CC-canonical allow-list, OR it matches
 * the MCP tool pattern `^mcp__<server>__`.
 *
 * SCOPE — the framework's *shipped* delivery surface, exactly what `install.sh`
 * copies (install.sh:13,108-120): cite:historical install.sh:13 listed these 4 dirs when written; skill tiers now live at setup.d/lib.sh:63-65
 *   - agents/*.md                                       (the #551 surface)
 *   - skills/<slug>/SKILL.md                            (top-level shipped skills)
 *   - .claude/skills/{pipeline,dispatcher,aif-doctor,template-audit}/SKILL.md
 *   - packages/core/templates/shared/skill-context/[dir]/SKILL.md
 * The broad `.claude/skills/aif-*` set is VENDORED AI-Factory harness — NOT shipped
 * by this installer — and is deliberately OUT OF SCOPE. (Those carry `Questions` /
 * `Task`, non-canonical names; they are not this framework's delivery artefacts and
 * skill `allowed-tools` is not enforced by CC anyway — issue #18837. Flagged as a
 * separate observation, not fixed here.)
 *
 * T16 — FORM-CHECK, NOT BEHAVIOUR-CHECK (load-bearing, do not gloss): a valid-name
 * `tools:` proves the names *resolve*, NOT that the agent actually *uses* them. This
 * gate would have caught #551 (names didn't resolve) but does NOT prove an agent
 * with valid names calls a tool rather than fabricating. The behavioural probe (M2,
 * RED→GREEN dispatch smoke) is Phase 2, deferred behind a trigger — NOT this test.
 *
 * T15 — recursive self-application: this principle test IS the executable artifact
 * the project's own thesis demanded for its own delivery layer («documents lie;
 * tests don't; every rule fails at the earliest reachable channel»). It runs the
 * discipline top-down on the framework's shipped sub-agents, closing the
 * `#recursive-self-application-gap` #551 exposed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');

/**
 * CC-canonical tool allow-list. Authoritative source: research-patch §0, verified
 * against code.claude.com/docs/en/tools-reference 2026-06-16. Do NOT extend this
 * from memory — widening it silently weakens the gate (the exact failure #551 was).
 */
export const CC_CANONICAL_TOOLS: ReadonlySet<string> = new Set([
  'Agent', 'AskUserQuestion', 'Bash', 'CronCreate', 'CronDelete', 'CronList', 'Edit',
  'EnterPlanMode', 'ExitPlanMode', 'EnterWorktree', 'ExitWorktree', 'Glob', 'Grep',
  'ListMcpResourcesTool', 'LSP', 'Monitor', 'NotebookEdit', 'PowerShell', 'PushNotification',
  'Read', 'ReadMcpResourceTool', 'RemoteTrigger', 'ScheduleWakeup', 'SendMessage',
  'ShareOnboardingGuide', 'Skill', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskOutput',
  'TaskStop', 'TaskUpdate', 'TeamCreate', 'TeamDelete', 'TodoWrite', 'ToolSearch',
  'WaitForMcpServers', 'WebFetch', 'WebSearch', 'Workflow', 'Write',
]);

/** MCP tools are `mcp__<server>__<tool>` — server segment has no underscores. */
const MCP_TOOL_RE = /^mcp__[^_]+__/;

/** The 4 `.claude/skills/` companion skills install.sh ships (install.sh:13). cite:historical install.sh:13 listed these 4 dirs when written; skill tiers now live at setup.d/lib.sh:63-65 */
const SHIPPED_CC_SKILL_DIRS = ['pipeline', 'dispatcher', 'aif-doctor', 'template-audit'];

export interface ToolViolation {
  file: string;
  entry: string;
  base: string;
}

/**
 * Strip CC permission-scope syntax to the base tool name:
 *   `Bash(git *)` → `Bash`, `Read` → `Read`, `mcp__h__x` → `mcp__h__x`.
 * A scoped `Bash(...)` is a valid CC permission entry whose tool IS `Bash`.
 */
export function baseToolName(entry: string): string {
  const trimmed = entry.trim();
  const paren = trimmed.indexOf('(');
  return (paren === -1 ? trimmed : trimmed.slice(0, paren)).trim();
}

/** True when the entry's base name is a real CC tool (canonical or MCP). */
export function isValidToolEntry(entry: string): boolean {
  const base = baseToolName(entry);
  if (base === '') return true; // empty token — caller filters these out first
  if (MCP_TOOL_RE.test(base)) return true;
  return CC_CANONICAL_TOOLS.has(base);
}

/** Return the YAML frontmatter block (between the first two `---` fences), or null. */
export function extractFrontmatter(fileContent: string): string | null {
  const m = fileContent.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

/**
 * Paren-aware tokenizer for an INLINE tool list. Splits on commas AND whitespace,
 * but never inside `(...)` — so a scoped `Bash(git *)` stays one token even though
 * it contains a space. Handles both `Read, Glob, Bash` and `Read Bash(git *) Write`.
 */
function tokenizeInline(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (depth === 0 && (ch === ',' || /\s/.test(ch))) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else { cur += ch; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Extract tool entries from a frontmatter `key:` field. Handles three shapes:
 *   - inline comma-delimited:  `tools: Read, Glob, Bash`
 *   - inline space-delimited:  `allowed-tools: Read Write Edit`
 *   - YAML block sequence:     `allowed-tools:\n  - Bash(git *)\n  - Read`
 * Returns [] when the key is absent or its value is empty.
 */
export function extractToolEntries(fileContent: string, key: 'tools' | 'allowed-tools'): string[] {
  const fm = extractFrontmatter(fileContent);
  if (fm === null) return [];
  const lines = fm.split('\n');
  const keyRe = new RegExp(`^${key}:\\s*(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(keyRe);
    if (!m) continue;
    const inline = m[1].trim();
    if (inline !== '') return tokenizeInline(inline);
    // empty inline value → YAML block sequence on the following `  - item` lines
    const entries: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const seq = lines[j].match(/^\s*-\s+(.*)$/);
      if (seq) { entries.push(seq[1].trim()); continue; }
      if (lines[j].trim() === '') continue; // tolerate blank lines within/after block
      break; // any other non-blank line (a new key) ends the sequence
    }
    return entries;
  }
  return [];
}

/** Collect violations for a single file under the given frontmatter key. */
export function checkFile(
  relPath: string,
  content: string,
  key: 'tools' | 'allowed-tools',
): ToolViolation[] {
  return extractToolEntries(content, key)
    .filter((entry) => !isValidToolEntry(entry))
    .map((entry) => ({ file: relPath, entry, base: baseToolName(entry) }));
}

// ── Shipped-surface enumeration (mirrors install.sh:13,108-120) ─────────────── cite:historical install.sh:13 listed these 4 dirs when written; skill tiers now live at setup.d/lib.sh:63-65

/** Every shipped `agents/*.md` (the #551 surface). */
export function collectAgentFiles(): string[] {
  const dir = resolve(REPO_ROOT, 'agents');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => resolve(dir, f));
}

/**
 * Every shipped CC-plugin agent — plugin/agents/*.md (the plugin payload surface).
 * Same #551 tool-name-validity invariant as collectAgentFiles(), applied to the
 * agents the plugin-packaging umbrella ships into a consumer via the plugin channel.
 */
export function collectPluginAgentFiles(): string[] {
  const dir = resolve(REPO_ROOT, 'plugin/agents');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => resolve(dir, f));
}

/** Every shipped SKILL.md — the install.sh-copied surface only (NOT vendored aif-*). */
export function collectShippedSkillFiles(): string[] {
  const files: string[] = [];
  // (a) top-level skills/<slug>/SKILL.md
  const topSkills = resolve(REPO_ROOT, 'skills');
  if (existsSync(topSkills)) {
    for (const d of readdirSync(topSkills, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = resolve(topSkills, d.name, 'SKILL.md');
      if (existsSync(p)) files.push(p);
    }
  }
  // (b) the 4 named .claude/skills/ companion skills install.sh ships
  for (const name of SHIPPED_CC_SKILL_DIRS) {
    const p = resolve(REPO_ROOT, '.claude/skills', name, 'SKILL.md');
    if (existsSync(p)) files.push(p);
  }
  // (c) shipped skill-context overrides under packages/core/templates/shared
  const sc = resolve(REPO_ROOT, 'packages/core/templates/shared/skill-context');
  if (existsSync(sc)) {
    for (const d of readdirSync(sc, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = resolve(sc, d.name, 'SKILL.md');
      if (existsSync(p)) files.push(p);
    }
  }
  return files.sort();
}

function rel(p: string): string {
  return relative(REPO_ROOT, p);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Principle 21 — shipped agent/skill tools-name validity (M1 gate, closes #551)', () => {
  // ── Arm (a): real-tree — every shipped agent uses canonical tool names ──────
  it('(a) real-tree: every shipped agents/*.md tools: entry is a canonical CC tool', () => {
    const agents = collectAgentFiles();
    // Non-vacuity guard (T1/T10): the 6 #551 agents must actually be scanned.
    expect(agents.length, 'expected ≥6 shipped agents/*.md to scan').toBeGreaterThanOrEqual(6);

    const violations = agents.flatMap((p) => checkFile(rel(p), readFileSync(p, 'utf8'), 'tools'));
    expect(
      violations,
      `Non-canonical agent tool names (→ zero-tools dispatch + fabrication, the #551 mechanism):\n` +
        violations.map((v) => `  ${v.file}: "${v.entry}" (base "${v.base}")`).join('\n'),
    ).toHaveLength(0);
  });

  // ── Arm (b): real-tree — every shipped skill allowed-tools entry is canonical ──
  it('(b) real-tree: every shipped SKILL.md allowed-tools entry is a canonical CC tool', () => {
    const skills = collectShippedSkillFiles();
    expect(skills.length, 'expected ≥1 shipped SKILL.md to scan').toBeGreaterThan(0);

    const violations = skills.flatMap((p) => checkFile(rel(p), readFileSync(p, 'utf8'), 'allowed-tools'));
    expect(
      violations,
      `Non-canonical shipped-skill tool names:\n` +
        violations.map((v) => `  ${v.file}: "${v.entry}" (base "${v.base}")`).join('\n'),
    ).toHaveLength(0);
  });

  // ── Arm (c): non-vacuity — the skill scan actually parses entries ───────────
  it('(c) non-vacuity: the shipped-skill scan extracts real entries (not silently empty)', () => {
    // The pipeline skill ships a YAML-list allowed-tools with scoped Bash(...) +
    // Read/Write/Edit/Agent. If extraction silently returned [], arm (b) would be
    // a vacuous green — this proves entries are genuinely parsed AND validated.
    const pipeline = resolve(REPO_ROOT, '.claude/skills/pipeline/SKILL.md');
    if (existsSync(pipeline)) {
      const entries = extractToolEntries(readFileSync(pipeline, 'utf8'), 'allowed-tools');
      expect(entries.length, 'pipeline SKILL.md should yield parsed allowed-tools entries').toBeGreaterThan(0);
      // Scoped Bash(...) must resolve to a canonical base, not a spurious violation.
      expect(entries.some((e) => baseToolName(e) === 'Bash')).toBe(true);
      expect(entries.every((e) => isValidToolEntry(e))).toBe(true);
    }
  });

  // ── Arm (d): PAIRED-NEGATIVE (mandatory, principle-02) — #551 is DETECTED ───
  it('(d) paired-negative: the exact #551 agent frontmatter goes RED', () => {
    // This is the load-bearing proof the gate is not a happy-path tautology:
    // feed it the literal pre-fix frontmatter and assert it fails.
    const bogusAgent = [
      '---',
      'name: living-docs-auditor',
      'description: runs an audit and reports findings.',
      'tools: read_file, list_files, run_command',
      '---',
      '',
      '# body',
    ].join('\n');

    const violations = checkFile('agents/bogus.md', bogusAgent, 'tools');
    expect(violations.map((v) => v.base)).toEqual(['read_file', 'list_files', 'run_command']);
    expect(violations).toHaveLength(3);
  });

  // ── Arm (e): positive — the post-fix frontmatter is GREEN ──────────────────
  it('(e) positive: canonical agent frontmatter passes', () => {
    const goodAgent = '---\nname: x\ntools: Read, Glob, Bash\n---\n# body\n';
    expect(checkFile('agents/x.md', goodAgent, 'tools')).toHaveLength(0);
  });

  // ── Arm (f): scoped-Bash + MCP positives, scoped-bogus negative ────────────
  it('(f) scoped Bash(...) and mcp__ entries pass; a bogus scoped name fails', () => {
    const goodSkill = '---\nname: s\nallowed-tools:\n  - Bash(git *)\n  - Read\n  - mcp__handoff__sync_status\n  - Agent\n---\n# body\n';
    expect(checkFile('skills/s/SKILL.md', goodSkill, 'allowed-tools')).toHaveLength(0);

    const badSkill = '---\nname: s\nallowed-tools:\n  - Frobnicate(x *)\n  - Read\n---\n# body\n';
    const v = checkFile('skills/s/SKILL.md', badSkill, 'allowed-tools');
    expect(v).toHaveLength(1);
    expect(v[0].base).toBe('Frobnicate');
  });

  // ── Arm (g): inline space-delimited form with a non-canonical name fails ────
  it('(g) inline space-delimited allowed-tools: non-canonical names (e.g. Questions) are caught', () => {
    // Documents the vendored-skill observation (Questions/Task are non-canonical);
    // the gate WOULD flag them — they are excluded only by SCOPE, not by allow-list.
    const inline = '---\nname: s\nallowed-tools: Read Write Questions Task\n---\n# body\n';
    const v = checkFile('skills/s/SKILL.md', inline, 'allowed-tools');
    expect(v.map((x) => x.base).sort()).toEqual(['Questions', 'Task']);
  });

  // ── Arm (h): plugin-tree — every plugin/agents/*.md tools: entry is canonical ──
  // The CC-plugin payload ships a consumer-facing agent subset (plugin-packaging
  // umbrella S4). They are the same #551 surface as agents/*.md and must satisfy the
  // same tool-name-validity invariant — guarded here so a future plugin-agent edit
  // cannot drift to a non-canonical name unnoticed.
  it('(j) plugin-tree: every plugin/agents/*.md tools: entry is a canonical CC tool', () => {
    const agents = collectPluginAgentFiles();
    // Non-vacuity guard: v1 ships review-sidecar + living-docs-auditor + compliance-verifier.
    expect(agents.length, 'expected ≥3 shipped plugin/agents/*.md to scan').toBeGreaterThanOrEqual(3);

    const violations = agents.flatMap((p) => checkFile(rel(p), readFileSync(p, 'utf8'), 'tools'));
    expect(
      violations,
      `Non-canonical plugin-agent tool names (→ zero-tools dispatch, the #551 mechanism):\n` +
        violations.map((v) => `  ${v.file}: "${v.entry}" (base "${v.base}")`).join('\n'),
    ).toHaveLength(0);
  });

  // ── Arm (h): no-key files are not false-positives ──────────────────────────
  it('(h) a SKILL.md without allowed-tools yields no violations', () => {
    expect(checkFile('skills/s/SKILL.md', '---\nname: s\n---\n# body\n', 'allowed-tools')).toHaveLength(0);
  });

  // ── Arm (i): T15 self-application — this file declares itself a FORM-check ──
  it('(i) T15 self-application: this principle is a form-check, declared as such', () => {
    const self = readFileSync(resolve(HERE, '21-shipped-agent-tools-valid.test.ts'), 'utf8');
    expect(self.length).toBeGreaterThan(500);
    expect(self).toContain('FORM-CHECK, NOT BEHAVIOUR-CHECK');
  });
});
