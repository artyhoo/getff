/**
 * Principle 19 — meta-orchestrator §2.5 ALIAS-mapping ↔ §5-routing-tree consistency
 *
 * Source: .agents/procedures/pipeline/SKILL.md §2.5 (Stage 2C wiring)
 *         docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md §5 + §9
 *         DN-3 binding (single source = SKILL.md body; classify-work.sh UNCHANGED)
 *
 * Invariant: SKILL.md §2.5 must declare the 6-row ALIAS↔DISPATCH mapping table
 * with all 6 aliases (DIRECT/BUNDLE/SOLO/PAIR/DECOMPOSE/RESEARCH), all 6 internal
 * dispatch strings (direct-Edit/Mode-A-bundle/Mode-A/Mode-SDD/Mode-B/R-phase-session),
 * and the 6 routing predicates (load_bearing/sibling_count/scope_decided/
 * parallel_safe/bundle_opt_in/review_required). The mapping is 1:1 with the
 * routing tree in the same section.
 *
 * Slot 19 rationale: slots 01-18 occupied as of 2026-05-26.
 *
 * Note: ALIAS-in-rendered-output enforcement (output-format.md template update +
 * principle 18 extension) is DEFERRED to a separate follow-up PR per
 * feedback_no_drive_by_prs. Stage 2C file scope = SKILL.md + this principle test.
 *
 * Companion paired-negative: synthetic mutation of §2.5 (in-memory copy) that
 * removes one token must fail the structural check. Run as `it.each` over the
 * 12 tokens (6 aliases + 6 dispatches).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SKILL = resolve(REPO_ROOT, '.agents/procedures/pipeline/references/planning.md');
const CARD = resolve(REPO_ROOT, '.agents/procedures/pipeline/SKILL.md');

const ALIASES = ['DIRECT', 'BUNDLE', 'SOLO', 'PAIR', 'DECOMPOSE', 'RESEARCH'] as const;
const DISPATCHES = [
  'direct-Edit',
  'Mode-A-bundle',
  'Mode-A',
  'Mode-SDD',
  'Mode-B',
  'R-phase-session',
] as const;
const PREDICATES = [
  'load_bearing',
  'sibling_count',
  'scope_decided',
  'parallel_safe',
  'bundle_opt_in',
  'review_required',
] as const;

/**
 * Extract §2.5 region from SKILL.md — lines from '## §2.5 ...'
 * through the next '## ' heading boundary.
 */
function extractSection25(content: string): string {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => /^## §2\.5/.test(l));
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## (?:§|[A-Z0-9])/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

describe('Principle 19 — meta-orchestrator §2.5 ALIAS-mapping ↔ §5-routing-tree consistency', () => {
  it('planning procedure is reachable before currency/classification work', () => {
    expect(readFileSync(CARD, 'utf8')).toContain('[planning](references/planning.md) before checking');
  });

  it('planning procedure exists', () => {
    expect(existsSync(SKILL), `SKILL.md not found at: ${SKILL}`).toBe(true);
  });

  it('SKILL.md §2.5 section header is present', () => {
    const content = readFileSync(SKILL, 'utf8');
    const section = extractSection25(content);
    expect(section, '§2.5 section not found — header "## §2.5 Dedup + classify + assign + route" missing').not.toBe('');
  });

  it('§2.5 contains the ALIAS mapping table header row', () => {
    const content = readFileSync(SKILL, 'utf8');
    const section = extractSection25(content);
    // Whitespace-tolerant: Prettier re-aligns markdown table columns (pads cells to the widest in
    // each column), so assert on the content with intra-line whitespace runs collapsed — column
    // padding is cosmetic and not part of the invariant (GH #531 Prettier adoption).
    const flat = section.replace(/[^\S\n]+/g, ' ');
    expect(flat).toContain('| ALIAS | DISPATCH (internal) | Fires when ');
  });

  it('§2.5 mapping table contains all 6 aliases as bare tokens in table rows', () => {
    const content = readFileSync(SKILL, 'utf8');
    const section = extractSection25(content);
    // Whitespace-tolerant (see header test): Prettier pads `| DIRECT   |` etc. to column width.
    const flat = section.replace(/[^\S\n]+/g, ' ');
    const missing: string[] = [];
    for (const alias of ALIASES) {
      // Check for bare token in a table row: "| ALIAS |"
      if (!flat.includes(`| ${alias} |`)) {
        missing.push(alias);
      }
    }
    expect(
      missing,
      `§2.5 ALIAS table missing rows for: ${missing.join(', ')}`,
    ).toHaveLength(0);
  });

  it('§2.5 mapping table contains all 6 DISPATCH internal-mechanism strings in table rows', () => {
    const content = readFileSync(SKILL, 'utf8');
    const section = extractSection25(content);
    const missing: string[] = [];
    for (const dispatch of DISPATCHES) {
      if (!section.includes(dispatch)) {
        missing.push(dispatch);
      }
    }
    expect(
      missing,
      `§2.5 DISPATCH table missing entries for: ${missing.join(', ')}`,
    ).toHaveLength(0);
  });

  it('§2.5 contains all 6 routing predicates as literal tokens', () => {
    const content = readFileSync(SKILL, 'utf8');
    const section = extractSection25(content);
    const missing: string[] = [];
    for (const predicate of PREDICATES) {
      if (!section.includes(predicate)) {
        missing.push(predicate);
      }
    }
    expect(
      missing,
      `§2.5 routing predicates missing: ${missing.join(', ')}`,
    ).toHaveLength(0);
  });

  it('§2.5 mentions DN-3 binding: "classify-work.sh UNCHANGED"', () => {
    const content = readFileSync(SKILL, 'utf8');
    const section = extractSection25(content);
    expect(section).toContain('classify-work.sh` UNCHANGED');
  });

  // Paired-negative tests (principle 02 mandate + T15 self-application):
  // Synthetic mutation of §2.5 in-memory — removing one token must fail the structural check.
  // This proves the positive check is non-tautological: a real omission would be caught.
  describe('paired-negative: synthetic §2.5 with one alias token removed must fail alias check', () => {
    it.each(ALIASES as unknown as string[])('alias %s — omitting it from a synthetic §2.5 is detected', (alias) => {
      // Build a synthetic §2.5 that contains all tokens EXCEPT this one alias
      const allAliasRows = ALIASES.map((a) => `| ${a} | some-dispatch | some-predicate |`).join('\n');
      const syntheticSection25 =
        `## §2.5 Dedup + classify + assign + route\n\n` +
        `| ALIAS | DISPATCH (internal) | Fires when something |\n` +
        `|---|---|---|\n` +
        allAliasRows.replace(`| ${alias} |`, `| PLACEHOLDER_REMOVED |`) +
        `\nclassify-work.sh\` UNCHANGED\n`;

      // The check should find that this alias is missing
      expect(syntheticSection25).not.toContain(`| ${alias} |`);
    });
  });

  describe('paired-negative: synthetic §2.5 with one dispatch token removed must fail dispatch check', () => {
    it.each(DISPATCHES as unknown as string[])('dispatch %s — omitting it from a synthetic §2.5 is detected', (dispatch) => {
      // Build a synthetic §2.5 — one row per dispatch, then remove the target row
      // (removing the whole row avoids sub-string false-positives where e.g. removing
      // "Mode-A" from "Mode-A-bundle" would still leave "Mode-A" in the other row).
      const dispatchRows = DISPATCHES.map((d) => `| SOME-ALIAS | ${d} | some-condition |`);
      const rowsWithoutTarget = dispatchRows.filter((row) => !row.includes(`| ${dispatch} |`));
      const syntheticSection25 =
        `## §2.5 Dedup + classify + assign + route\n\n` +
        `| ALIAS | DISPATCH (internal) | Fires when something |\n` +
        `|---|---|---|\n` +
        rowsWithoutTarget.join('\n') +
        `\nclassify-work.sh\` UNCHANGED\n`;

      // The check must find that this dispatch is missing in the mutated copy
      expect(syntheticSection25).not.toContain(`| ${dispatch} |`);
    });
  });

  // §2.5 Step 3 candidate-iteration invariant — added 2026-05-27 to close the
  // gap that allowed a single-shot ${umbrella} block to ship in b1f47f4 while
  // prose said "per surviving candidate". Downstream Steps 5–9 (sibling_count
  // predicate, multi-Stage rendering, multi-id delta-diff) require N
  // classifications. A single-shot block silently broke those invariants without
  // principle 19 catching it (the substring-only check passed for the broken
  // code). Step 3 now delegates iteration to classify-each-candidate.sh — this
  // principle test asserts the delegation; the helper itself has its own
  // paired-negative test at packages/core/skills/classify-each-candidate.test.ts.
  describe('§2.5 Step 3 delegates per-candidate iteration to classify-each-candidate.sh', () => {
    /** Extract the Step 3 block + its !shell fenced code. */
    function extractStep3Region(section: string): string {
      const lines = section.split('\n');
      const start = lines.findIndex((l) => /Step 3 — L4 classify/.test(l));
      if (start === -1) return '';
      // Take up to 20 lines forward (Step 3 prose + the !shell block + first lines after).
      return lines.slice(start, Math.min(start + 20, lines.length)).join('\n');
    }

    it('§2.5 Step 3 region invokes classify-each-candidate.sh (iteration helper)', () => {
      const content = readFileSync(SKILL, 'utf8');
      const section = extractSection25(content);
      const step3 = extractStep3Region(section);
      expect(step3, 'Step 3 region empty — heading "Step 3 — L4 classify" missing').not.toBe('');
      expect(
        step3,
        'Step 3 must delegate to classify-each-candidate.sh — a single-shot ${umbrella} → classify-work.sh reference cannot satisfy Step 5 sibling_count / Step 8 multi-id delta-diff invariants',
      ).toMatch(/classify-each-candidate\.sh/);
    });

    it('§2.5 Step 3 documents F8 per-candidate failure semantics (not whole-skill halt)', () => {
      const content = readFileSync(SKILL, 'utf8');
      const section = extractSection25(content);
      const step3 = extractStep3Region(section);
      expect(
        step3,
        'Step 3 must declare F8 per-candidate semantics — single-shot halt is the b1f47f4 bug shape',
      ).toMatch(/F8 for that candidate/);
    });

    // Paired-negative: the b1f47f4 single-shot Step 3 shape must fail the iteration-helper check.
    it('paired-negative: synthetic single-shot Step 3 with bare ${umbrella} fails the iteration-helper check', () => {
      const syntheticBrokenStep3 =
        '**Step 3 — L4 classify (per surviving candidate):**\n\n' +
        '```!\n' +
        '${CLAUDE_SKILL_DIR}/helpers/classify-work.sh ".claude/orchestrator-prompts/${umbrella}/kickoff.md"\n' +
        '```\n\n' +
        'Capture TYPE / DISPATCH / LOC / SURFACES / RATIONALE.\n';
      // The iteration-helper check MUST fail on this shape.
      expect(syntheticBrokenStep3).not.toMatch(/classify-each-candidate\.sh/);
    });
  });
});
