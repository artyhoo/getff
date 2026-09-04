// Relational firing harness — live-fire tests (OWNER-FORK-1 Option B, ir-unfreeze S2).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// Mirrors firing.test.ts (S1, no-datetime-now) but for the relational rendering path added in
// render-astgrep.ts (RuleEntry.relational -> renderRelationalNode). Reuses firing-runner.ts's
// fireContract()/deriveToolVersion() UNCHANGED — this file adds NO new spawn plumbing beyond one
// local raw-count helper for the arm-deleted control assertion below (§ control block), which
// needs finding COUNTS, a shape fireContract()'s `{codes: Set<string>}` return deliberately does
// not expose (codes is a de-duplicated identity set, not a per-rule occurrence count).
//
// Same loud-skip discipline as firing.test.ts: NO `!isCI` guard, a real module-level
// console.warn (not swallowed inside a skipIf body) when the pinned ast-grep is absent from
// PATH, and the always-on self-application block runs regardless of tool presence.

import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveToolVersion, fireContract, type AstgrepFiringContract } from './firing-runner.ts';
import { RELATIONAL_FIXTURE_NODE, MULTI_CHILD_FIXTURE_NODE } from './test-fixtures.ts';
import { renderAstgrep } from './render-astgrep.ts';
import type { ConventionNode } from '../../ir/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT: AstgrepFiringContract = JSON.parse(
  readFileSync(join(__dirname, 'relational-firing-contract.json'), 'utf8'),
) as AstgrepFiringContract;

const INVALID_DIR = join(__dirname, 'fixtures/firing/relational-invalid');
const VALID_DIR = join(__dirname, 'fixtures/firing/relational-valid');

// Multi-child (≥2-child `not`) firing contract + fixture dirs — ir-unfreeze S4 (closes S2 M3).
// Same bare-PATH `ast-grep scan --json` command as CONTRACT, so `toolPresent` (derived below from
// CONTRACT.command) gates these blocks too — no second version derivation needed.
const MULTI_CONTRACT: AstgrepFiringContract = JSON.parse(
  readFileSync(join(__dirname, 'relational-multichild-firing-contract.json'), 'utf8'),
) as AstgrepFiringContract;

const MULTI_INVALID_DIR = join(__dirname, 'fixtures/firing/relational-multichild-invalid');
const MULTI_VALID_DIR = join(__dirname, 'fixtures/firing/relational-multichild-valid');

const LIVE_TIMEOUT_MS = 120_000;

const resolvedVersion = deriveToolVersion(CONTRACT.command);
const toolPresent = resolvedVersion !== undefined;

if (!toolPresent) {
  console.warn(
    '⚠ live ast-grep RELATIONAL firing SKIPPED (ast-grep not on PATH — CI install step missing ' +
      'or local machine without the pinned binary); the relational rendering path MUST NOT be ' +
      'claimed live-fire-green from this run alone. The always-on self-application drift block ' +
      'still gates fixture drift.',
  );
}

describe.skipIf(!toolPresent)('relational firing harness — live ast-grep scan (OWNER-FORK-1 Option B)', () => {
  it(
    'RED: relational-invalid (def without a return-type hint) -> ruleIds contains expectedCode',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, INVALID_DIR);
      expect(codes.has(CONTRACT.expectedCode)).toBe(true);
    },
  );

  it(
    'GREEN: relational-valid (same def, now with `-> int`) -> ZERO codes (not just absent expectedCode)',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, VALID_DIR);
      expect(codes.has(CONTRACT.expectedCode)).toBe(false);
      expect(codes.size).toBe(0);
    },
  );
});

// --- Always-on self-application (fixture-drift protection), PURE — no tool spawn -------------
// Same pattern as firing.test.ts:90-103, applied to both relational fixture dirs (each carries
// a byte-identical copy of the committed rule, mirroring the S1 invalid/valid/valid-clean trio).
describe('self-application: committed relational rule YAML == render(RELATIONAL_FIXTURE_NODE)', () => {
  const RULE_REL = join('rules', 'require-return-type-hint.yml');
  for (const [label, dir] of [
    ['relational-invalid', INVALID_DIR],
    ['relational-valid', VALID_DIR],
  ] as const) {
    it(`committed ${label}/${RULE_REL} is byte-for-byte the render of RELATIONAL_FIXTURE_NODE`, () => {
      const { yaml } = renderAstgrep([RELATIONAL_FIXTURE_NODE]);
      const committed = readFileSync(join(dir, RULE_REL), 'utf8');
      expect(committed).toBe(yaml);
    });
  }
});

// --- Arm-deleted control (T21/T20-class rigor: prove the relational arm is load-bearing, not
// vacuous) --------------------------------------------------------------------------------
//
// The single-function invalid/valid fixtures above prove the RENDERED rule fires RED/GREEN, but
// on their own they do NOT prove the `not:{has:...}` arm did any work — a rule using ONLY the
// mandatory `pattern:` anchor could in principle reproduce the identical exit codes (this is
// exactly the live-proven vacuous-arm defect the original census idiom had: a narrower anchor
// pattern already fully encoded the "no return type" condition by AST-shape mismatch, making its
// `not:has` arm redundant — see test-fixtures.ts's RELATIONAL_FIXTURE_NODE comment). The control
// below fires BOTH the arm-present rule and an arm-deleted variant (same anchor, relational
// field stripped) against ONE mixed file containing both an annotated and an un-annotated
// function, and asserts the ARM-PRESENT rule flags exactly the un-annotated function while the
// ARM-DELETED rule flags BOTH — a genuine behavioural difference, not just a textual one.
//
// This needs raw finding COUNTS (not fireContract's de-duplicated `codes: Set<string>`), so it
// spawns the contract command directly rather than extending firing-runner.ts (kept UNCHANGED
// per this stage's harness instruction).
function countFindings(fixtureDir: string): number {
  const [cmd, ...args] = CONTRACT.command.split(' ');
  if (cmd === undefined) throw new Error('countFindings(): empty command');
  const configPath = join(fixtureDir, 'sgconfig.yml');
  const targetPath = join(fixtureDir, 'src.py');
  const result = spawnSync(cmd, [...args, '-c', configPath, targetPath], {
    cwd: fixtureDir,
    encoding: 'utf8',
    shell: false,
  });
  const trimmed = (result.stdout ?? '').trim();
  if (trimmed.length === 0) return 0;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

describe.skipIf(!toolPresent)('arm-deleted control — relational arm is load-bearing, not vacuous', () => {
  it(
    'mixed file (1 annotated + 1 un-annotated def): WITH the arm -> 1 finding; WITHOUT the arm -> 2 findings',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const mixedSrc = 'def compute(x):\n    return x + 1\n\n\ndef helper(y) -> int:\n    return y + 2\n';

      // Arm-deleted variant: identical anchor pattern, `relational` field stripped entirely.
      const armDeletedNode: ConventionNode = { ...RELATIONAL_FIXTURE_NODE };
      delete (armDeletedNode as { relational?: unknown }).relational;
      expect(armDeletedNode.relational).toBeUndefined();

      const withArmYaml = renderAstgrep([RELATIONAL_FIXTURE_NODE]).yaml;
      const noArmYaml = renderAstgrep([armDeletedNode]).yaml;
      // Sanity: the two rendered rules actually differ (otherwise the control proves nothing).
      expect(withArmYaml).not.toBe(noArmYaml);

      const withArmDir = mkdtempSync(join(tmpdir(), 'astgrep-relational-control-witharm-'));
      const noArmDir = mkdtempSync(join(tmpdir(), 'astgrep-relational-control-noarm-'));
      try {
        for (const [dir, yaml] of [
          [withArmDir, withArmYaml],
          [noArmDir, noArmYaml],
        ] as const) {
          mkdirSync(join(dir, 'rules'), { recursive: true });
          writeFileSync(join(dir, 'sgconfig.yml'), 'ruleDirs: [rules]\n');
          writeFileSync(join(dir, 'rules', 'require-return-type-hint.yml'), yaml);
          writeFileSync(join(dir, 'src.py'), mixedSrc);
        }

        expect(countFindings(withArmDir)).toBe(1); // only `compute` (no return-type hint)
        expect(countFindings(noArmDir)).toBe(2); // both `compute` AND `helper` — anchor alone is broad
      } finally {
        rmSync(withArmDir, { recursive: true, force: true });
        rmSync(noArmDir, { recursive: true, force: true });
      }
    },
  );
});

// --- Multi-child relational firing (OWNER-FORK-1 Option B, ir-unfreeze S4) -------------------
// Closes the S2 carry-forward M3: the multi-child `not:{any:[...]}` fold was previously only
// RENDER-golden verified (render-astgrep.test.ts:253-277); S1's single-child `not:{has}` was the
// only committed LIVE-FIRE. This block adds a REAL ast-grep scan for a ≥2-child `not` — the census
// "require-return-type-or-docstring" NOR (MULTI_CHILD_FIXTURE_NODE): a function is flagged only
// when it has NEITHER a return-type hint (arm A) NOR a docstring/string descendant (arm B).
describe.skipIf(!toolPresent)('relational MULTI-child firing — not:{any} NOR (OWNER-FORK-1 Option B, S4)', () => {
  it(
    'RED: multichild-invalid (def with NEITHER return-type NOR docstring) -> ruleIds contains expectedCode',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(MULTI_CONTRACT, MULTI_INVALID_DIR);
      expect(codes.has(MULTI_CONTRACT.expectedCode)).toBe(true);
    },
  );

  it(
    'GREEN: multichild-valid (same def, now with `-> int`) -> ZERO codes (arm A satisfies the any-fold)',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(MULTI_CONTRACT, MULTI_VALID_DIR);
      expect(codes.has(MULTI_CONTRACT.expectedCode)).toBe(false);
      expect(codes.size).toBe(0);
    },
  );
});

// --- Always-on self-application (fixture-drift protection), PURE — no tool spawn -------------
// DRIFT GUARD ONLY: this asserts committed == render(MULTI_CHILD_FIXTURE_NODE), it is explicitly
// NOT the fire (the fire is the skipIf blocks above/below). Mirrors the single-child block:69-84.
describe('self-application: committed multichild rule YAML == render(MULTI_CHILD_FIXTURE_NODE)', () => {
  const RULE_MC = join('rules', 'require-return-type-or-docstring.yml');
  for (const [label, dir] of [
    ['relational-multichild-invalid', MULTI_INVALID_DIR],
    ['relational-multichild-valid', MULTI_VALID_DIR],
  ] as const) {
    it(`committed ${label}/${RULE_MC} is byte-for-byte the render of MULTI_CHILD_FIXTURE_NODE`, () => {
      const { yaml } = renderAstgrep([MULTI_CHILD_FIXTURE_NODE]);
      const committed = readFileSync(join(dir, RULE_MC), 'utf8');
      expect(committed).toBe(yaml);
    });
  }
});

// --- Multi-child NOR control — the any-fold is load-bearing, not:{all} is wrong --------------
//
// The multi-child analog of the single-child arm-deleted control above (:123-161). This is what
// makes the multi-child block a REAL fire, not render==fire: it proves BOTH (a) the scan genuinely
// runs, and (b) the S2-committed NOR decision (`not:{any}` NEVER `not:{all}`, render-astgrep.ts:
// 205-208 / :256-257) is BEHAVIOURALLY load-bearing, not just a textual golden.
//
// One mixed source satisfies EXACTLY arm B (has a docstring string-literal) and NOT arm A (no
// return type). Under the correct NOR `not:{any:[A,B]}`, arm B matches -> the any-fold matches ->
// `not` suppresses -> 0 findings. Under the WRONG `not:{all:[A,B]}` (all children must match),
// arm A fails -> the all-fold fails -> `not` fires -> 1 finding. any->0 / all->1 is the genuine
// behavioural discriminator. The wrong variant is built by swapping ONLY the combinator token in
// the rendered YAML (`any:` -> `all:`), so the two rules are otherwise byte-identical.
//
// Uses the local raw-count helper countFindings() (needs finding COUNTS, not fireContract's
// de-duplicated `codes: Set<string>`), same rationale as the single-child control above.
describe.skipIf(!toolPresent)('multi-child NOR control — the any-fold is load-bearing, not:{all} is wrong', () => {
  it(
    'docstring-only def: not:{any} (rendered) -> 0 findings (NOR-correct); not:{all} (wrong swap) -> 1 finding',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      // Satisfies EXACTLY arm B (docstring string-literal), NOT arm A (no return type).
      const mixedSrc = 'def documented(x):\n    """doc"""\n    return x + 1\n';

      const anyYaml = renderAstgrep([MULTI_CHILD_FIXTURE_NODE]).yaml; // not:{any:[...]} (correct NOR)
      // Wrong variant: the ONLY change is the combinator token any -> all (String.replace hits the
      // single `any:` occurrence — the assertions below prove no residual `any:` remains).
      const allYaml = anyYaml.replace('any:', 'all:');
      expect(allYaml).not.toBe(anyYaml); // the swap actually changed the rule
      expect(anyYaml).toContain('any:');
      expect(allYaml).toContain('all:');
      expect(allYaml).not.toContain('any:');

      const anyDir = mkdtempSync(join(tmpdir(), 'astgrep-relational-multichild-any-'));
      const allDir = mkdtempSync(join(tmpdir(), 'astgrep-relational-multichild-all-'));
      try {
        for (const [dir, yaml] of [
          [anyDir, anyYaml],
          [allDir, allYaml],
        ] as const) {
          mkdirSync(join(dir, 'rules'), { recursive: true });
          writeFileSync(join(dir, 'sgconfig.yml'), 'ruleDirs: [rules]\n');
          writeFileSync(join(dir, 'rules', 'require-return-type-or-docstring.yml'), yaml);
          writeFileSync(join(dir, 'src.py'), mixedSrc);
        }

        expect(countFindings(anyDir)).toBe(0); // NOR: docstring satisfies the any-fold -> suppressed
        expect(countFindings(allDir)).toBe(1); // wrong all-fold: arm A fails -> all fails -> `not` fires
      } finally {
        rmSync(anyDir, { recursive: true, force: true });
        rmSync(allDir, { recursive: true, force: true });
      }
    },
  );
});
