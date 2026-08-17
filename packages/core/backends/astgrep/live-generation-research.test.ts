// Live-generation python adapter — author + session-side render (Model A′) tests.
// Umbrella: live-generation LG-S1, Increment 2. Spec:
// docs/meta-factory/research-patches/2026-07-11-live-generation.md §Qa/§Qb/§Qd/§Qe.
//
// Home rationale (backends/astgrep/, not synthesizer/): the firing AC (AC3) fires the REAL pinned
// ast-grep binary, which CI installs and runs ONLY for the `test:backends` suite (audit-self.yml —
// "Install pinned ast-grep" + "Run packages/core/backends tests"). Co-locating AC1/AC2/AC4 here
// gives the whole increment CI coverage in one suite. The driver under test lives at
// synthesizer/render-researched-astgrep.ts; its committed inputs/artifacts under
// synthesizer/fixtures/live-generation/.
//
// $0-in-CI (principle 17 / no-paid-llm-in-ci.md): every input is a COMMITTED in-source record —
// NEVER a live MCP/research call. The render ran session-side (Model A′); CI only drift-checks the
// committed artifact (AC2) and fires it (AC3) — it never renders-from-research.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderAstgrep } from './render-astgrep.ts';
import {
  deriveToolVersion,
  fireContract,
  type AstgrepFiringContract,
} from './firing-runner.ts';
import { validateProvenance } from '../../research/allowlist.ts';
import {
  isSinglePatternExpressible,
  researchedPracticeToNode,
  type AstgrepResearchedPractice,
} from '../../synthesizer/research-to-node.ts';
import {
  LIVE_GEN_DIR,
  PRACTICE_RECORDS,
  checkResearchedAstgrepDrift,
  loadPracticeRecord,
  planFromCommittedRecords,
  planResearchedAstgrep,
  renderedRulePath,
} from '../../synthesizer/render-researched-astgrep.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RULE_ID = 'getff-researched-no-yaml-load';
const RECORD_ABS = join(LIVE_GEN_DIR, PRACTICE_RECORDS[0] as string);
/** The committed rendered artifact = the SHARED rule the firing fixtures scan. */
const ARTIFACT_ABS = join(LIVE_GEN_DIR, renderedRulePath(RULE_ID));
const BAD_DIR = join(LIVE_GEN_DIR, 'firing', 'bad');
const GOOD_DIR = join(LIVE_GEN_DIR, 'firing', 'good');

/** Clone the drift-gate surface (practice records + the rendered artifact) into a fresh tmpdir.
 *  Gate-teeth tests mutate the CLONE — the committed tree stays byte-identical for the whole run,
 *  so parallel vitest workers (delivery/sidecar suites cpSync the same artifact) can never observe
 *  a mutate/unlink window (the PR #1349 ENOENT flake). Caller rmSyncs the returned root. */
function cloneDriftSurface(): string {
  const root = mkdtempSync(join(tmpdir(), 'lg-s1-drift-teeth-'));
  mkdirSync(join(root, 'firing', 'rules'), { recursive: true });
  for (const record of PRACTICE_RECORDS) {
    cpSync(join(LIVE_GEN_DIR, record), join(root, record));
  }
  cpSync(ARTIFACT_ABS, join(root, renderedRulePath(RULE_ID)));
  return root;
}

// ── AC1: the committed practice record projects to a valid, namespaced ConventionNode ────────────

describe('AC1 — committed researched-practice record → valid ConventionNode', () => {
  it('the committed record file exists', () => {
    expect(existsSync(RECORD_ABS)).toBe(true);
  });

  it('researchedPracticeToNode(record) returns a node with params {kind:call, pattern:yaml.load($$$ARGS)}', () => {
    const record = loadPracticeRecord(RECORD_ABS);
    const result = researchedPracticeToNode(record);
    expect(result.status).toBe('node');
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    expect(result.node.params['kind']).toBe('call');
    expect(result.node.params['pattern']).toBe('yaml.load($$$ARGS)');
    expect(result.node.selectorClass).toBe('syntax');
    // §Qd rule-id sub-namespace — a delivered researched rule never collides with a starter getff-*.
    expect(result.node.id).toBe(RULE_ID);
    expect(result.node.id.startsWith('getff-researched-')).toBe(true);
  });

  it('the record provenance resolves via the bridge’s Tier-0 validateProvenance (host pyyaml)', () => {
    const record = loadPracticeRecord(RECORD_ABS);
    expect(record.provenance.length).toBeGreaterThan(0);
    for (const p of record.provenance) {
      expect(validateProvenance(p).ok).toBe(true);
    }
  });
});

// ── AC2: Model A′ determinism / drift gate — committed artifact === a fresh render, byte-for-byte ─

describe('AC2 — committed rendered artifact is byte-for-byte renderAstgrep([node])', () => {
  it('the committed artifact file exists at the shared firing/rules path', () => {
    expect(existsSync(ARTIFACT_ABS)).toBe(true);
  });

  it('the driver plan render === the committed artifact bytes (drift gate is empty)', () => {
    const plan = planFromCommittedRecords();
    expect(plan.rendered).toHaveLength(1);
    const committed = readFileSync(ARTIFACT_ABS, 'utf8');
    // The load-bearing Model-A drift gate: a fresh render must equal the committed bytes exactly.
    expect(committed).toBe(plan.rendered[0]!.yaml);
    // …surfaced the same way the CLI's --check does, so a drift fails HERE at the earliest channel.
    expect(checkResearchedAstgrepDrift()).toEqual([]);
  });

  it('an independent render of the node (not via the driver plan) also equals the committed bytes', () => {
    const record = loadPracticeRecord(RECORD_ABS);
    const result = researchedPracticeToNode(record);
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    const { yaml, outcomes } = renderAstgrep([result.node]);
    expect(outcomes.get(RULE_ID)?.kind).toBe('rendered');
    expect(readFileSync(ARTIFACT_ABS, 'utf8')).toBe(yaml);
  });

  it('the drift gate has teeth: a mutated artifact → a byte-mismatch finding (tmpdir clone; tracked tree untouched)', () => {
    // REAL non-vacuity: mutate the artifact ON DISK and run the ACTUAL drift gate
    // (checkResearchedAstgrepDrift → planFromCommittedRecords → renderAstgrep) — but against a
    // tmpdir CLONE of the drift surface, never the committed tree. The prior in-place
    // mutate-then-restore raced parallel vitest workers: the delivery/sidecar suites cpSync the
    // SAME committed artifact, and a copy landing inside the mutate/unlink window fails with
    // ENOENT or mutated bytes (PR #1349 CI run 31336870255, job 93304066830).
    const root = cloneDriftSurface();
    try {
      const abs = join(root, renderedRulePath(RULE_ID));
      writeFileSync(
        abs,
        readFileSync(abs, 'utf8').replace('yaml.load($$$ARGS)', 'yaml.load($$$OOPS)'),
      );
      const drift = checkResearchedAstgrepDrift(root);
      expect(drift).toContainEqual({
        path: renderedRulePath(RULE_ID),
        reason: 'byte-mismatch',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    // The committed tree was never touched — the real gate is still empty.
    expect(checkResearchedAstgrepDrift()).toEqual([]);
  });

  it('the drift gate reports `missing` when the artifact is absent (tmpdir clone; tracked tree untouched)', () => {
    // Covers the second drift reason: a deleted/absent committed artifact must be caught, not
    // silently treated as up-to-date. Same tmpdir-clone isolation as the byte-mismatch case.
    const root = cloneDriftSurface();
    try {
      unlinkSync(join(root, renderedRulePath(RULE_ID)));
      const drift = checkResearchedAstgrepDrift(root);
      expect(drift).toContainEqual({
        path: renderedRulePath(RULE_ID),
        reason: 'missing',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    expect(checkResearchedAstgrepDrift()).toEqual([]);
  });
});

// ── AC4: MAJOR-1 still honest through the driver — non-expressible → research-only, NO rule ───────

describe('AC4 — the driver degrades a non-expressible practice (never inert-emits)', () => {
  // A mutable-default-arg practice: kind outside {call,attribute,import} + a multiline structural
  // pattern — genuinely inexpressible as a single literal ast-grep pattern (§Qb ceiling).
  const NON_EXPRESSIBLE: AstgrepResearchedPractice = {
    entryId: 'getff-researched-no-mutable-default-arg',
    title: 'Do not use a mutable default argument; it is shared across every call',
    stack: ['python'],
    kind: 'structural',
    presence: 'forbid',
    pattern: 'def $F($$$A, $P=[], $$$B):\n    $$$BODY',
    examples: {
      bad: 'def f(x, items=[]):\n    items.append(x)',
      good: 'def f(x, items=None):\n    items = items if items is not None else []',
    },
    provenance: [
      {
        url: 'https://docs.python.org/3/reference/compound_stmts.html',
        allowlistKey: 'python.official',
        fetchedAt: '2026-07-11T00:00:00.000Z',
      },
    ],
  };

  it('a non-expressible practice → 0 rendered, 1 research-only (not-expressible), NO silent drop', () => {
    const plan = planResearchedAstgrep([NON_EXPRESSIBLE]);
    expect(plan.rendered).toHaveLength(0);
    expect(plan.researchOnly).toHaveLength(1);
    expect(plan.researchOnly[0]!.entryId).toBe('getff-researched-no-mutable-default-arg');
    expect(plan.researchOnly[0]!.reason).toBe('not-expressible');
  });

  it('mixed input: the expressible flagship renders, the non-expressible one degrades — both surfaced', () => {
    const flagship = loadPracticeRecord(RECORD_ABS);
    const plan = planResearchedAstgrep([flagship, NON_EXPRESSIBLE]);
    expect(plan.rendered.map((r) => r.entryId)).toEqual([RULE_ID]);
    expect(plan.researchOnly.map((r) => r.entryId)).toEqual([
      'getff-researched-no-mutable-default-arg',
    ]);
  });

  it('non-vacuity: the expressibility predicate is false for the drop and true for the flagship', () => {
    expect(isSinglePatternExpressible(NON_EXPRESSIBLE)).toBe(false);
    expect(isSinglePatternExpressible(loadPracticeRecord(RECORD_ABS))).toBe(true);
  });
});

// ── Driver guard: two practices sharing an entryId → loud throw, never a silent clobber ───────────

describe('driver guard — duplicate entryId in a plan fails loud (no silent clobber)', () => {
  it('two practices sharing an entryId render to the same path → planResearchedAstgrep throws', () => {
    // Two identical flagship records both project to id RULE_ID → the same firing/rules/<id>.yml
    // path. Without the guard, writeResearchedAstgrep would silently clobber the first. Sibling of
    // planPythonTemplates' lane guard (render-python-templates.ts:127-133).
    const flagship = loadPracticeRecord(RECORD_ABS);
    expect(() => planResearchedAstgrep([flagship, flagship])).toThrow(
      /duplicate rendered entryId/,
    );
  });
});

// ── AC3: the committed rendered artifact FIRES for real (pinned ast-grep@0.44.1, $0, CI-capable) ──

// The firing contract for this rule — reuses the EXISTING firing-runner harness (no re-invented
// scan invocation). expectedCode is the namespaced rule id ast-grep reports on a match.
const CONTRACT: AstgrepFiringContract = {
  command: 'ast-grep scan --json',
  jsonPath: '$.ruleId',
  expectedCode: RULE_ID,
};

const resolvedVersion = deriveToolVersion(CONTRACT.command);
const toolPresent = resolvedVersion !== undefined;
const LIVE_TIMEOUT_MS = 120_000;

if (!toolPresent) {
  // Real module-level loud-skip (a console.warn inside a skipIf body never fires) — the researched
  // artifact must NOT be claimed green on live-fire from a run that never fired it (mirrors
  // firing.test.ts). The always-on AC2 drift block above still gates the committed bytes in CI.
  console.warn(
    '⚠ live ast-grep firing SKIPPED for the researched getff-researched-no-yaml-load rule ' +
      '(ast-grep not on PATH); the rendered artifact MUST NOT be claimed green on live-fire from ' +
      'this run alone. AC2 (committed-artifact drift) still gates.',
  );
}

describe.skipIf(!toolPresent)('AC3 — researched artifact live-fires via ast-grep scan', () => {
  it(
    'RED: the bad fixture (yaml.load) → ruleIds contains getff-researched-no-yaml-load',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, BAD_DIR);
      expect(codes.has(CONTRACT.expectedCode)).toBe(true);
    },
  );

  it(
    'CLEAN: the good fixture (yaml.safe_load) → ZERO findings, does NOT contain the rule id',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, GOOD_DIR);
      expect(codes.has(CONTRACT.expectedCode)).toBe(false);
      expect(codes.size).toBe(0);
    },
  );
});
