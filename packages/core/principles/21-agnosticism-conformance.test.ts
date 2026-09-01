/**
 * Principle 21 — Agnosticism conformance (agnosticism-remediation umbrella, PR #564)
 *
 * Source: .claude/orchestrator-prompts/agnosticism-remediation/kickoff.md §5/§6 task T-C;
 *         README.md#why-this-exists invariant 4 (multi-channel enforcement);
 *         .claude/rules/rule-enforcement-channel-selection.md §4 (principle test = gate,
 *         repo-wide, deterministic, zero standing cost).
 *
 * Invariant: every deterministic conformance probe in
 *   tests/agnosticism/probes/*.sh
 * must report verdict PORTABLE — meaning the repo's rules, hooks, CI jobs, and
 * doc-claims function correctly for AI harnesses OTHER than Claude Code (Cursor,
 * Aider, Codex, etc.), without requiring CC presence.
 *
 * Dependency: T-A (doc-claims probe, b3872b14, PR #570) and T-B (AGENTS.md portable
 * rule index + rules-autoload probe, eb0faae9, PR #575) must be on this branch — they
 * are the commits that flipped doc-claims and rules-autoload from CC-ONLY → PORTABLE.
 * Both are present on feature/agnosticism-remediation-t-c-853487 (verified at plan time).
 *
 * How the test works:
 *  1. Runs `bash tests/agnosticism/run-audit.sh` via execSync (cwd = REPO_ROOT).
 *     The harness writes tests/agnosticism/conformance-record.tsv (gitignored, §34 of
 *     .gitignore). The script uses `set -uo pipefail` with no `-e`, so the harmless
 *     `column -t` failure (absent in lean CI images) does not abort the record write.
 *  2. Reads the TSV; filters out the header row + any PORTABLE rows.
 *  3. Asserts the non-PORTABLE list is empty.
 *  4. Population sentinel: asserts at least 6 deterministic rows — guards against a
 *     vacuous pass from a silently-truncated or empty record file.
 *
 * T15 self-application: this test IS agnosticism applied to itself — it runs inside
 * the CI principle suite, a channel that operates entirely independently of CC.
 *
 * No paid LLM: pure bash + file read, zero API calls (no-paid-llm-in-ci.md §1 satisfied).
 *
 * Build-vs-reuse note: REUSE existing harness (tests/agnosticism/run-audit.sh +
 * probes/*.sh); only the vitest wrapper (this file) is new — not a capability commit
 * per CLAUDE.md definition (no new dependency, no new module ≥80 LOC). Prior-art:
 * no upstream tool targets "agnosticism conformance as a CI principle test" for this
 * project-specific probe structure — BUILD verdict for the wrapper is self-evident.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');
const RECORD_FILE = resolve(REPO_ROOT, 'tests/agnosticism/conformance-record.tsv');
const HARNESS = resolve(REPO_ROOT, 'tests/agnosticism/run-audit.sh');

/**
 * Parse a conformance-record TSV and return the non-PORTABLE rows.
 * Skips the header row. A row is non-PORTABLE when its last tab-delimited
 * field is NOT exactly "PORTABLE".
 */
export function nonPortableFindings(tsv: string): string[] {
  return tsv
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(1) // skip header
    .filter((line) => {
      const fields = line.split('\t');
      const verdict = fields[fields.length - 1]?.trim() ?? '';
      return verdict !== 'PORTABLE';
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shipped-agent tools-frontmatter portability probe (DN-M1 Task 2 / A3 N2 / DN-A3-1)
//
// WHY this exists — the gap the bash-harness arm above does NOT reach:
//   `bash run-audit.sh` (the arm above) probes substrate / hooks / configs /
//   doc-claims / rules-autoload — it has ZERO rows for `agents/*.md` `tools:`
//   frontmatter, the one surface where genuine Claude-Code coupling lives. A3 §5
//   live run reported 8/8 PORTABLE while `agents/manual-rule-liveness-prober.md:4`
//   and `agents/shipped-agent-liveness-prober.md:4` carry `tools: ... Agent`. The
//   gate was GREEN on a coverage set that EXCLUDED the only finding (umbrella-summary
//   §2.3 pattern P-3 — "deterministic check passes because its coverage set is drawn
//   narrower than the surface it claims to govern").
//
// WHAT it checks (policy DN-M1 Option C — operator decision 2026-06-27):
//   every SHIPPED agent (those install.sh actually copies) must carry ONLY
//   harness-universal tools. The authoring-only probers are EXEMPT — they never ship
//   (setup.d/20-agents.sh skip-loop + install.sh --refresh skip), and their `Agent`
//   use is correct by design (their whole methodology IS sub-agent dispatch). The
//   exemption is MECHANICAL, not a hand-picked name-list: it is DERIVED from the
//   installer skip-loop (the ship-boundary SSOT) and drift-guarded against install.sh.
//
// RELATION to 21-shipped-agent-tools-valid.test.ts (M1 gate, #551): that sibling
//   parses the SAME `tools:` field but answers a DIFFERENT question — "is each name a
//   real CC tool?" (name-validity). Its `CC_CANONICAL_TOOLS` set INCLUDES `Agent`, so a
//   shipped agent loaded with `Agent` PASSES M1 yet is non-portable. This probe is the
//   portability complement, not a duplicate. We deliberately do NOT import M1's helpers:
//   they live in a `.test.ts`, and importing it would re-register its vitest suite
//   (double-run). The frontmatter parse below is intentionally minimal — agent `tools:`
//   is always the inline-comma form (verified across all 8 agents/*.md, 2026-06-27).
//   FOLLOW-UP (parked, not this PR): extract the shared frontmatter/tools parser to a
//   `.ts` lib (the principle-09 `.ts` / `.test.ts` split pattern) so both arms share one
//   source instead of two minimal parsers.
//
// T16 (pattern-matching-on-name — verify the mechanism, not the label):
//   CC-specific primitive: `Agent` / `Task` (sub-agent dispatch).
//   Portable equivalent:   OpenCode `@mention` syntax (.opencode/INSTALL.md:59);
//                          Codex `import_subagents` (A3 §6 C3); NONE for Aider-class
//                          single-session harnesses. File / search / shell / web
//                          primitives (Read/Glob/Grep/Bash/Write/Edit/WebFetch/
//                          WebSearch) ARE universal across all four → the allow-set below.

/**
 * Harness-universal tool primitives — present in every AI coding harness this project
 * targets (Claude Code, OpenCode, Codex, Aider). Grounded in the `.opencode/INSTALL.md`
 * tool mapping + A3 §4.1 (the 6 reporting-only shipped agents use only these).
 * FAIL-CLOSED: any tool NOT in this set, on a shipped agent, is treated as non-portable
 * (so a future CC-only tool is caught loudly, not silently passed). Extend ONLY with a
 * documented portable-equivalent rationale — widening it from memory silently weakens
 * the gate (the same discipline `CC_CANONICAL_TOOLS` carries in the M1 sibling).
 */
export const PORTABLE_TOOLS: ReadonlySet<string> = new Set([
  'Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch',
]);

/**
 * Parse an agent's `tools:` frontmatter into trimmed base tool names. Agent `tools:`
 * is always the inline-comma form (`tools: Read, Glob, Grep, Agent`) — verified across
 * all 8 agents/*.md (2026-06-27). Returns [] when there is no frontmatter or no `tools:`
 * key (an agent declaring no tools declares no coupling → trivially portable).
 * Minimal by design — see the RELATION note above for why M1's richer parser is not reused.
 */
export function parseAgentTools(fileContent: string): string[] {
  const fm = fileContent.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return [];
  const line = fm[1].split('\n').find((l) => /^tools:\s*/.test(l));
  if (!line) return [];
  return line
    .replace(/^tools:\s*/, '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

/**
 * Derive the operator-only (authoring-only, never-shipped) agent set from the installer
 * skip-loop — the ship-boundary SSOT. Matches `<name>.md) continue ;;` lines in
 * setup.d/20-agents.sh. This is WHY the exemption is mechanical rather than a hand-picked
 * allow-list: change the skip-loop and the exemption changes with it.
 */
export function parseOperatorOnlyAgents(setupShContent: string): Set<string> {
  const out = new Set<string>();
  const re = /^\s*([\w.-]+\.md)\)\s*continue\s*;;/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(setupShContent)) !== null) out.add(m[1]);
  return out;
}

export interface AgentToolsInfo {
  /** basename, e.g. "compliance-verifier.md" */
  file: string;
  tools: string[];
}

export interface PortabilityViolation {
  file: string;
  /** the non-portable tools found on a SHIPPED agent */
  offending: string[];
}

/**
 * The gate: a SHIPPED agent (one NOT in `operatorOnly`) carrying any tool outside
 * `portable` is a violation. Operator-only agents are exempt by design. Pure → unit-
 * testable with the synthetic paired-negatives below (principle 02).
 */
export function nonPortableShippedAgents(
  agents: AgentToolsInfo[],
  operatorOnly: Set<string>,
  portable: ReadonlySet<string> = PORTABLE_TOOLS,
): PortabilityViolation[] {
  const out: PortabilityViolation[] = [];
  for (const a of agents) {
    if (operatorOnly.has(a.file)) continue; // authoring-only → exempt by design
    const offending = a.tools.filter((t) => !portable.has(t));
    if (offending.length > 0) out.push({ file: a.file, offending });
  }
  return out;
}

// The conformance harness (~1s) is deterministic — it reads the same rules/hooks/
// docs and writes the same conformance-record.tsv every run. Two tests below each
// consumed it, and both used to `execSync(bash HARNESS)` independently, so it ran
// twice (~2s). Memoize LAZILY: the first consumer to run pays the single harness
// pass and caches its TSV; the second reads the cache. The synthetic paired-negative
// tests never call this, so they stay independent of the harness (and of each other).
let _harnessTsv: string | null = null;
function runHarnessOnce(): string {
  if (_harnessTsv === null) {
    execSync(`bash "${HARNESS}"`, { cwd: REPO_ROOT, stdio: 'pipe' });
    _harnessTsv = readFileSync(RECORD_FILE, 'utf8');
  }
  return _harnessTsv;
}

describe('Principle 21 — agnosticism conformance', () => {
  it('runs the conformance harness (harness file must exist)', () => {
    expect(existsSync(HARNESS), `harness not found: ${HARNESS}`).toBe(true);
  });

  it('produces a conformance-record.tsv with at least 6 deterministic rows (population sentinel)', () => {
    const tsv = runHarnessOnce();
    expect(existsSync(RECORD_FILE), `record file not produced: ${RECORD_FILE}`).toBe(true);

    const dataRows = tsv
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(1); // skip header

    expect(
      dataRows.length,
      `expected ≥6 deterministic probe rows in conformance-record.tsv; got ${dataRows.length} — ` +
        `this guard prevents a vacuous pass from a silently-empty record file`,
    ).toBeGreaterThanOrEqual(6);
  });

  it('all deterministic conformance probes report PORTABLE (zero non-PORTABLE findings)', () => {
    const tsv = runHarnessOnce();
    const nonPortable = nonPortableFindings(tsv);
    expect(
      nonPortable,
      `non-PORTABLE agnosticism findings detected — rule/hook/doc must be fixed before merge:\n` +
        nonPortable.join('\n'),
    ).toEqual([]);
  });

  // ── Paired-negative: prove nonPortableFindings CATCHES real violations ─────────
  it('paired-negative: detects a CC-ONLY verdict row', () => {
    const tsv = [
      'surface\tprobe\tcmd\texit\tverdict',
      'hooks\tsome-hook\tgrep check\t1\tCC-ONLY',
      'substrate\tconfig\tconfig-check\t0\tPORTABLE',
    ].join('\n');
    expect(nonPortableFindings(tsv).length).toBeGreaterThan(0);
  });

  it('paired-negative: detects a DEGRADED verdict row', () => {
    const tsv = [
      'surface\tprobe\tcmd\texit\tverdict',
      'rules-autoload\tmanual-read-burden\tAGENTS.md missing 3/12 rules\t1\tDEGRADED:12-rules',
    ].join('\n');
    expect(nonPortableFindings(tsv).length).toBeGreaterThan(0);
  });

  it('paired-negative: does NOT false-positive on an all-PORTABLE TSV', () => {
    const tsv = [
      'surface\tprobe\tcmd\texit\tverdict',
      'hooks\t.husky/pre-commit\tgrep CC coupling\t0\tPORTABLE',
      'substrate\tconfig-cc-coupling\tgrep CLAUDE_\t0\tPORTABLE',
    ].join('\n');
    expect(nonPortableFindings(tsv)).toEqual([]);
  });
});

describe('Principle 21 — shipped-agent tools-frontmatter portability (DN-M1 Option C)', () => {
  const AGENTS_DIR = resolve(REPO_ROOT, 'agents');
  const SETUP_AGENTS_SH = resolve(REPO_ROOT, 'setup.d/20-agents.sh');
  const INSTALL_SH = resolve(REPO_ROOT, 'install.sh');

  /** Read the real agents/*.md tree into {file, tools} records. */
  function realAgents(): AgentToolsInfo[] {
    return readdirSync(AGENTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => ({
        file: f,
        tools: parseAgentTools(readFileSync(resolve(AGENTS_DIR, f), 'utf8')),
      }));
  }

  // ── The gate (real-tree) ────────────────────────────────────────────────────
  it('every SHIPPED agents/*.md carries only harness-universal tools (probers exempt)', () => {
    const agents = realAgents();
    // Non-vacuity (T1/T10): the shipped surface must actually be scanned.
    expect(agents.length, 'expected ≥6 agents/*.md to scan').toBeGreaterThanOrEqual(6);

    const operatorOnly = parseOperatorOnlyAgents(readFileSync(SETUP_AGENTS_SH, 'utf8'));
    const violations = nonPortableShippedAgents(agents, operatorOnly);
    expect(
      violations,
      `Shipped agent(s) carry non-portable (Claude-Code-only) tools — they would silently ` +
        `under-deliver on OpenCode / Codex / Aider:\n` +
        violations
          .map(
            (v) =>
              `  ${v.file}: ${v.offending.join(', ')} ` +
              `(CC-specific; portable equivalent: OpenCode @mention / Codex import / none — .opencode/INSTALL.md:59)`,
          )
          .join('\n') +
        `\nFix: use only [${[...PORTABLE_TOOLS].join(', ')}], OR add the agent to the ` +
        `setup.d/20-agents.sh skip-loop if it is authoring-only (never shipped).`,
    ).toEqual([]);
  });

  // ── Non-vacuity tied to reality — the exemption is actually exercised ────────
  it('non-vacuity: ≥1 real agent carries a non-portable tool, and every such carrier is operator-only', () => {
    const agents = realAgents();
    const carriers = agents.filter((a) => a.tools.some((t) => !PORTABLE_TOOLS.has(t)));
    // If nothing carried a non-portable tool, the operator-only exemption would be
    // untested against reality — a green-but-vacuous gate. Today the 2 probers carry `Agent`.
    expect(
      carriers.length,
      'expected ≥1 agent carrying a non-portable tool (the probers) — guards a vacuous gate',
    ).toBeGreaterThanOrEqual(1);

    const operatorOnly = parseOperatorOnlyAgents(readFileSync(SETUP_AGENTS_SH, 'utf8'));
    for (const c of carriers) {
      expect(
        operatorOnly.has(c.file),
        `${c.file} carries non-portable tool(s) [${c.tools.filter((t) => !PORTABLE_TOOLS.has(t)).join(', ')}] ` +
          `but is NOT in the setup.d/20-agents.sh skip-loop — a shipped agent must be portable`,
      ).toBe(true);
    }
  });

  // ── Drift-guard — the exemption is real + the two installers agree ──────────
  it('drift-guard: every operator-only exemption is a real agent file AND is skipped by install.sh too', () => {
    const agentFiles = new Set(realAgents().map((a) => a.file));
    const operatorOnly = parseOperatorOnlyAgents(readFileSync(SETUP_AGENTS_SH, 'utf8'));
    expect(operatorOnly.size, 'skip-loop parse matched nothing — regex drift').toBeGreaterThanOrEqual(1);

    const installSh = readFileSync(INSTALL_SH, 'utf8');
    for (const name of operatorOnly) {
      expect(agentFiles.has(name), `skip-loop names ${name} but agents/${name} does not exist`).toBe(true);
      const skipRe = new RegExp(`${name.replace(/\./g, '\\.')}\\)\\s*continue`);
      expect(
        skipRe.test(installSh),
        `${name} is skipped in setup.d/20-agents.sh but NOT in install.sh --refresh — the two installers would drift`,
      ).toBe(true);
    }
  });

  // ── Paired-negative (principle 02): prove the gate CATCHES real violations ───
  it('paired-negative: a SHIPPED agent carrying Agent is flagged', () => {
    const agents: AgentToolsInfo[] = [{ file: 'new-shipped.md', tools: ['Read', 'Agent'] }];
    expect(nonPortableShippedAgents(agents, new Set())).toEqual([
      { file: 'new-shipped.md', offending: ['Agent'] },
    ]);
  });

  it('paired-negative: an OPERATOR-ONLY agent carrying Agent is exempt (no violation)', () => {
    const agents: AgentToolsInfo[] = [
      { file: 'manual-rule-liveness-prober.md', tools: ['Read', 'Glob', 'Grep', 'Agent'] },
    ];
    const operatorOnly = new Set(['manual-rule-liveness-prober.md']);
    expect(nonPortableShippedAgents(agents, operatorOnly)).toEqual([]);
  });

  it('paired-negative: a SHIPPED agent with only universal tools is clean (no false-positive)', () => {
    const agents: AgentToolsInfo[] = [{ file: 'compliance-verifier.md', tools: ['Read', 'Glob', 'Grep'] }];
    expect(nonPortableShippedAgents(agents, new Set())).toEqual([]);
  });

  it('paired-negative: parseAgentTools reads the inline-comma form and tolerates a no-tools agent', () => {
    expect(parseAgentTools('---\nname: x\ntools: Read, Glob, Grep, Agent\n---\n# body')).toEqual([
      'Read', 'Glob', 'Grep', 'Agent',
    ]);
    expect(parseAgentTools('---\nname: x\n---\n# body')).toEqual([]);
  });

  it('paired-negative: parseOperatorOnlyAgents extracts the skip-loop names', () => {
    const sh =
      '  case "$(basename "$f")" in\n' +
      '    manual-rule-liveness-prober.md) continue ;;\n' +
      '    shipped-agent-liveness-prober.md) continue ;;\n' +
      '  esac';
    expect([...parseOperatorOnlyAgents(sh)].sort()).toEqual([
      'manual-rule-liveness-prober.md',
      'shipped-agent-liveness-prober.md',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Skills-surface harness-posture census (beta-ai-docs-agnosticism S2, spec C3)
//
// WHY this exists — the gap the two arms above do NOT reach: the bash harness arm
//   runs every probes/*.sh (including the new skills-census.sh) but a probe that
//   emits ZERO skills rows would pass vacuously (its non-PORTABLE filter has
//   nothing to reject), and the agents arm walks `agents/*.md`, not
//   `.claude/skills/`. This arm pins the census to the real tracked population so
//   CI enforces the skills surface structurally, not just on session runs.
//
// WHAT it checks — the declaration grammar lives in the probe header
//   (tests/agnosticism/probes/skills-census.sh): every git-tracked SKILL.md must
//   carry `<!-- @harness-posture: <vocab> — <rationale> -->` on its own line, with
//   vocab ∈ {portable, portable-designed-not-proven, cc-native-with-fallback,
//   cc-only}; `cc-only` requires a ≥20-non-whitespace-char rationale. The probe
//   verdicts the DECLARATION's presence/shape only — never live cross-harness
//   execution (T-BAD-B); `portable-designed-not-proven` is how an unproven skill
//   stays honestly green-adjacent without faking proof.
//
// T16 statement (kickoff §7): upstream problem class = "agents declare tools
//   mechanically" (the DN-M1 arm above parses `tools:` frontmatter); our problem
//   class = "skills declare harness posture mechanically". The match is structural
//   at the census + dynamic-enumeration + pure-parser + paired-negative level; the
//   declaration form is designed for SKILL.md prose bodies (marker comment, per
//   dual-implementation-discipline.md §5 markdown convention), NOT ported from
//   agent frontmatter parsing.
//
// Population is enumerated DYNAMICALLY on both sides (git ls-files here, the same
//   in the probe) — no skill name or count literal exists (T-BADC-S2-A census-that-
//   freezes guard; kickoff §4.5 falsifier).
// ─────────────────────────────────────────────────────────────────────────────

/** The ONLY allowed harness-posture vocabulary values (mirrors the probe header grammar). */
export const HARNESS_POSTURE_VOCAB: ReadonlySet<string> = new Set([
  'portable',
  'portable-designed-not-proven',
  'cc-native-with-fallback',
  'cc-only',
]);

export interface PostureDeclaration {
  /** repo-relative path, e.g. ".claude/skills/arch/SKILL.md" */
  file: string;
  /** the vocabulary token, or null when no declaration line exists */
  vocab: string | null;
  /** everything after the vocab token (em-dash separator stripped), trimmed of the closing `-->` */
  rationale: string;
}

export type PostureViolation = { file: string; reason: string };

/**
 * Pure parser for the `<!-- @harness-posture: ... -->` declaration — mirrors
 * skills-census.sh exactly (anchored line-start marker; first whitespace-delimited
 * token after the colon is the vocab; cc-only rationale ≥20 non-ws chars).
 * Returns the FIRST declaration line found (probe: grep -m1).
 */
export function parseHarnessPosture(fileContent: string, file = '<synthetic>'): PostureDeclaration {
  // Fence-state tracking mirrors skills-census.sh's awk scanner exactly: a declaration
  // inside a ``` fenced block is documentation, not a declaration (cold-QA MAJOR,
  // 2026-09-01 — a fenced example must never hijack the verdict).
  let inFence = false;
  const line = fileContent.split('\n').find((l) => {
    if (/^```/.test(l)) {
      inFence = !inFence;
      return false;
    }
    return !inFence && /^<!--[ \t]*@harness-posture:/.test(l);
  });
  if (!line) return { file, vocab: null, rationale: '' };
  const rest = line.replace(/^<!--[ \t]*@harness-posture:[ \t]*/, '').replace(/[ \t]*-->[ \t]*$/, '');
  const vocab = rest.split(/[ \t]/)[0] ?? '';
  const rationale = rest
    .slice(vocab.length)
    .replace(/^[ \t]+/, '')
    .replace(/^—[ \t]*/, '');
  return { file, vocab, rationale };
}

/**
 * The gate: a violation when the declaration is missing, the vocab is outside the
 * allowed set, or a cc-only declaration carries a <20-char rationale. Pure →
 * unit-testable with the synthetic paired-negatives below (principle 02).
 */
export function postureViolations(d: PostureDeclaration): PostureViolation[] {
  if (d.vocab === null) return [{ file: d.file, reason: 'no @harness-posture declaration' }];
  if (!HARNESS_POSTURE_VOCAB.has(d.vocab))
    return [{ file: d.file, reason: `posture '${d.vocab}' outside allowed vocabulary` }];
  if (d.vocab === 'cc-only' && d.rationale.replace(/\s/g, '').length < 20)
    return [{ file: d.file, reason: 'cc-only rationale too short (<20 chars)' }];
  return [];
}

describe('Principle 21 — skills-surface harness-posture census (beta S2, spec C3)', () => {
  const SKILLS_TSV = (tsv: string): string[] =>
    tsv
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(1)
      .filter((line) => line.split('\t')[0] === 'skills-census');

  it('census rows cover the full dynamic tracked-skills population (non-vacuity, T10)', () => {
    const tsv = runHarnessOnce();
    const tracked = execSync(`git -C "${REPO_ROOT}" ls-files '.claude/skills/*/SKILL.md'`, {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((l) => l.trim() !== '');
    const rows = SKILLS_TSV(tsv);
    expect(
      rows.length,
      `expected a census row per tracked SKILL.md (${tracked.length}); got ${rows.length} — ` +
        `a zero-row census passes the harness-wide PORTABLE filter vacuously`,
    ).toBeGreaterThanOrEqual(tracked.length);
    expect(tracked.length, 'expected ≥10 tracked skills — guards a vacuous population').toBeGreaterThanOrEqual(10);
  });

  it('every skills-census row is PORTABLE (census verdict, skills-specific message)', () => {
    const tsv = runHarnessOnce();
    const rows = SKILLS_TSV(tsv);
    const nonPortable = rows.filter((line) => line.split('\t').pop()?.trim() !== 'PORTABLE');
    expect(
      nonPortable,
      `skills harness-posture census has non-PORTABLE rows — add/fix the ` +
        `<!-- @harness-posture: ... --> declaration (grammar: probes/skills-census.sh header):\n` +
        nonPortable.join('\n'),
    ).toEqual([]);
  });

  it('paired-negative: a missing declaration is a violation', () => {
    expect(postureViolations(parseHarnessPosture('# no marker here', 'x/SKILL.md'))).toEqual([
      { file: 'x/SKILL.md', reason: 'no @harness-posture declaration' },
    ]);
  });

  it('paired-negative: every vocabulary value parses', () => {
    for (const v of HARNESS_POSTURE_VOCAB) {
      const d = parseHarnessPosture(`<!-- @harness-posture: ${v} — basis stated here -->`);
      expect(d.vocab).toBe(v);
      expect(postureViolations(v === 'cc-only'
        ? parseHarnessPosture(`<!-- @harness-posture: ${v} — deliberate choice with a long-enough rationale -->`)
        : d,
      )).toEqual([]);
    }
  });

  it('paired-negative: an invalid vocabulary value is a violation', () => {
    const d = parseHarnessPosture('<!-- @harness-posture: works-everywhere — invented vocab -->');
    expect(postureViolations(d)).toEqual([
      { file: '<synthetic>', reason: "posture 'works-everywhere' outside allowed vocabulary" },
    ]);
  });

  it('paired-negative: a cc-only rationale under 20 chars is a violation', () => {
    const d = parseHarnessPosture('<!-- @harness-posture: cc-only — later -->');
    expect(postureViolations(d)).toEqual([
      { file: '<synthetic>', reason: 'cc-only rationale too short (<20 chars)' },
    ]);
  });

  it('paired-negative: a valid declaration is clean (no false-positive)', () => {
    const d = parseHarnessPosture(
      '<!-- @harness-posture: cc-native-with-fallback — degradations documented: no subagents → serial fallback -->',
    );
    expect(d.vocab).toBe('cc-native-with-fallback');
    expect(postureViolations(d)).toEqual([]);
  });

  it('paired-negative: prose mentioning the marker mid-sentence does NOT parse as a declaration', () => {
    // Anchored line-start discipline (same as the probe's grep -E '^<!--'): a mention
    // inside prose or a blockquote must not satisfy the census.
    const d = parseHarnessPosture('> see the <!-- @harness-posture: portable --> convention');
    expect(d.vocab).toBeNull();
    expect(postureViolations(d)).toHaveLength(1);
  });

  it('paired-negative: a declaration inside a fenced code block does NOT parse (cold-QA MAJOR)', () => {
    // A fenced grammar example must never hijack the verdict — even when the real
    // declaration is missing entirely (fence-state tracking, mirrors the probe's awk).
    const fenced = ['```markdown', '<!-- @harness-posture: portable — example -->', '```'].join('\n');
    expect(parseHarnessPosture(fenced).vocab).toBeNull();
    expect(postureViolations(parseHarnessPosture(fenced, 'fenced/SKILL.md'))).toEqual([
      { file: 'fenced/SKILL.md', reason: 'no @harness-posture declaration' },
    ]);
    // ...and when a valid declaration exists outside the fence, the fence never shadows it.
    const real = `${fenced}\n<!-- @harness-posture: portable — real basis stated -->`;
    expect(parseHarnessPosture(real).vocab).toBe('portable');
  });
});
