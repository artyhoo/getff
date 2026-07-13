// Live-generation rust adapter — session-side render (Model A′) + local `cargo clippy` RED +
// LG-owned committed-evidence tests. Umbrella: live-generation LG-S3, Increment 2. Spec:
// docs/meta-factory/research-patches/2026-07-11-live-generation.md §Qa/§Qb/§Qe/§Qf-LG-S3.
//
// HOME rationale (synthesizer/, NOT backends/): the cross-owner boundary (#977/lpt) makes
// packages/core/backends/cargo/** READ-ONLY — this increment adds ZERO files there. So, unlike the
// LG-S1 astgrep sibling (which lives in backends/astgrep/ because CI installs pinned ast-grep for the
// test:backends suite), this rust test lives with its driver under synthesizer/. It IMPORTS the cargo
// firing harness (fireContract) + the shared capability-matrix validator — never edits them.
//
// THE 3-PART «works for rust» SPLIT (§Qe — stated, never hidden):
//   (1) GENERATION renders session-side: render-researched-clippy.ts → a committed clippy.toml
//       (Model A′). AC1 drift-gates it (always-on, CI-capable).
//   (2) DEV-MACHINE proves it FIRES: the local `cargo clippy` live-fire (AC2) is a developer-machine
//       DoD gate — describe.skipIf(!runLiveFire), runLiveFire = cargoPresent && !isCI. A green CI is
//       therefore a render/drift/evidence proof, NOT a live-fire proof (loud module-level skip warn).
//   (3) CI verifies COMMITTED EVIDENCE, not a fresh fire: the LG-owned evidence JSON records the
//       live-fired result; the always-on validateMatrix check (AC3, no !isCI guard) gates the
//       committed evidence — so honesty is mechanized without a paid/absent toolchain in CI
//       (no-paid-llm-in-ci.md / principle 17).

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { fireContract } from '../backends/cargo/firing-runner.ts';
import type { FiringContract } from '../backends/cargo/firing-runner.ts';
import { validateMatrix } from '../backends/shared/capability-matrix.ts';
import type { CapabilityMatrix } from '../backends/shared/capability-matrix.ts';
import {
  researchedPracticeToClippyNode,
  type ClippyResearchedPractice,
} from './research-to-clippy-node.ts';
import {
  CRATE_DIRS,
  LIVE_GEN_RUST_DIR,
  PRACTICE_RECORDS,
  checkResearchedClippyDrift,
  loadPracticeRecord,
  planFromCommittedRecords,
  planResearchedClippy,
  renderedClippyPath,
} from './render-researched-clippy.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RULE_ID = 'mem-forget';
const RECORD_ABS = join(LIVE_GEN_RUST_DIR, PRACTICE_RECORDS[0] as string);
const BAD_DIR = join(LIVE_GEN_RUST_DIR, 'firing', 'bad');
const GOOD_DIR = join(LIVE_GEN_RUST_DIR, 'firing', 'good');
const EVIDENCE_ABS = join(LIVE_GEN_RUST_DIR, 'mem-forget.evidence.json');
const EXPECTED_CODE = 'clippy::disallowed_methods';

// cargo's live diagnostic identity is clippy's nested `message.code.code` shape (mirrors
// backends/cargo/capability-matrix.test.ts:19 — extractor imported-by-shape, not by editing it).
const extractClippyCode = (parsed: unknown): unknown =>
  (parsed as { message?: { code?: { code?: unknown } } })?.message?.code?.code;

// ── AC1: the committed practice record projects to a valid, single-toml render ─────────────────────

describe('AC1 — committed researched-rust-practice → one clippy.toml, both crates carry it', () => {
  it('the committed practice record file exists', () => {
    expect(existsSync(RECORD_ABS)).toBe(true);
  });

  it('planFromCommittedRecords renders exactly the mem-forget ban, nothing degraded', () => {
    const plan = planFromCommittedRecords();
    expect(plan.rendered).not.toBeNull();
    expect(plan.rendered?.entryIds).toEqual([RULE_ID]);
    expect(plan.researchOnly).toHaveLength(0);
    // The rendered clippy.toml is a disallowed-methods ban on the researched FQ path.
    expect(plan.rendered?.toml).toContain('disallowed-methods = [');
    expect(plan.rendered?.toml).toContain('path = "std::mem::forget"');
  });

  it('researchedPracticeToClippyNode(record) → a type-aware node with params {kind:method, path:std::mem::forget}', () => {
    const record = loadPracticeRecord(RECORD_ABS);
    const result = researchedPracticeToClippyNode(record);
    expect(result.status).toBe('node');
    if (result.status !== 'node') throw new Error(`expected a node, got ${result.status}`);
    expect(result.node.selectorClass).toBe('type-aware');
    expect(result.node.params['kind']).toBe('method');
    expect(result.node.params['path']).toBe('std::mem::forget');
    expect(result.node.id).toBe(RULE_ID);
  });
});

// ── AC1 (cont.): Model A′ determinism / drift gate — each committed clippy.toml === a fresh render ──

describe('AC1 — committed clippy.toml is byte-for-byte the fresh render (Model A′ drift gate)', () => {
  it('each fixture crate carries the committed clippy.toml, byte-identical to the plan render', () => {
    const plan = planFromCommittedRecords();
    expect(plan.rendered).not.toBeNull();
    for (const crateDir of CRATE_DIRS) {
      const abs = join(LIVE_GEN_RUST_DIR, renderedClippyPath(crateDir));
      expect(existsSync(abs)).toBe(true);
      expect(readFileSync(abs, 'utf8')).toBe(plan.rendered?.toml);
    }
    // …surfaced the same way the CLI's --check does, so a drift fails HERE at the earliest channel.
    expect(checkResearchedClippyDrift()).toEqual([]);
  });

  it('the drift gate has teeth: a mutated committed clippy.toml → a byte-mismatch finding (restored after)', () => {
    // REAL non-vacuity: mutate the committed artifact ON DISK, run the ACTUAL drift gate
    // (checkResearchedClippyDrift → planFromCommittedRecords → renderCargoClippy), and assert it
    // reports the mismatch. A `finally` restores the verbatim bytes even if the assertion throws.
    const rel = renderedClippyPath('firing/bad');
    const abs = join(LIVE_GEN_RUST_DIR, rel);
    const original = readFileSync(abs, 'utf8');
    try {
      writeFileSync(abs, original.replace('std::mem::forget', 'std::mem::OOPS'));
      const drift = checkResearchedClippyDrift();
      expect(drift).toContainEqual({ path: rel, reason: 'byte-mismatch' });
    } finally {
      writeFileSync(abs, original);
    }
    // Restored: the gate is empty again — proves the finally left the committed bytes pristine.
    expect(checkResearchedClippyDrift()).toEqual([]);
  });

  it('the drift gate reports `missing` when a committed clippy.toml is absent (restored after)', () => {
    const rel = renderedClippyPath('firing/good');
    const abs = join(LIVE_GEN_RUST_DIR, rel);
    const original = readFileSync(abs, 'utf8');
    try {
      unlinkSync(abs);
      const drift = checkResearchedClippyDrift();
      expect(drift).toContainEqual({ path: rel, reason: 'missing' });
    } finally {
      writeFileSync(abs, original);
    }
    expect(checkResearchedClippyDrift()).toEqual([]);
  });
});

// ── MAJOR-1 honest through the driver — non-expressible → research-only, NO clippy.toml entry ───────

describe('driver honesty — a non-expressible practice degrades (never inert-emits)', () => {
  // A per-impl trait-method ban: kind outside {method,type,macro} — genuinely inexpressible as a
  // single clippy disallowed-table path-ban (§Qb ceiling; render-clippy cannot express per-impl bans).
  const NON_EXPRESSIBLE: ClippyResearchedPractice = {
    entryId: 'no-custom-trait-impl',
    title: 'Do not implement Trait for LocalType this way',
    stack: ['rust'],
    kind: 'trait-impl',
    presence: 'forbid',
    path: 'LocalType',
    examples: { bad: 'impl Trait for LocalType {}', good: 'impl OtherTrait for LocalType {}' },
    provenance: [
      {
        url: 'https://doc.rust-lang.org/reference/items/implementations.html',
        allowlistKey: 'rust.official',
        fetchedAt: '2026-07-13T00:00:00.000Z',
      },
    ],
  };

  it('a non-expressible practice → nothing rendered, 1 research-only (not-expressible), NO silent drop', () => {
    const plan = planResearchedClippy([NON_EXPRESSIBLE]);
    expect(plan.rendered).toBeNull();
    expect(plan.researchOnly).toHaveLength(1);
    expect(plan.researchOnly[0]!.entryId).toBe('no-custom-trait-impl');
    expect(plan.researchOnly[0]!.reason).toBe('not-expressible');
  });

  it('mixed input: the expressible flagship renders, the non-expressible one degrades — both surfaced', () => {
    const flagship = loadPracticeRecord(RECORD_ABS);
    const plan = planResearchedClippy([flagship, NON_EXPRESSIBLE]);
    expect(plan.rendered?.entryIds).toEqual([RULE_ID]);
    expect(plan.researchOnly.map((r) => r.entryId)).toEqual(['no-custom-trait-impl']);
  });

  it('driver guard: two practices sharing an entryId → planResearchedClippy throws (no silent clobber)', () => {
    const flagship = loadPracticeRecord(RECORD_ABS);
    expect(() => planResearchedClippy([flagship, flagship])).toThrow(/duplicate rendered entryId/);
  });
});

// ── AC3: committed live-fire evidence + always-on validator (CI-verifiable, no fresh fire) ──────────

describe('AC3 — LG-owned committed evidence passes validateMatrix (always-on, no !isCI guard)', () => {
  it('the evidence JSON file exists', () => {
    expect(existsSync(EVIDENCE_ABS)).toBe(true);
  });

  it('the committed evidence carries live-fired clippy::disallowed_methods and validates clean', () => {
    const evidence = JSON.parse(readFileSync(EVIDENCE_ABS, 'utf8')) as CapabilityMatrix;
    expect(validateMatrix(evidence, EXPECTED_CODE, extractClippyCode)).toEqual([]);
  });

  it('the evidence teeth: a mutated captured code → an identity-mismatch violation (paired-negative)', () => {
    // Non-vacuity: prove the validator would REJECT wrong/absent evidence. Mutate an in-memory copy
    // (never the committed file) so the diagnostic identity no longer matches the expected clippy code.
    const evidence = JSON.parse(readFileSync(EVIDENCE_ABS, 'utf8')) as CapabilityMatrix;
    const cell = evidence.cells['type-aware']!;
    cell.evidence = {
      ...cell.evidence!,
      capturedDiagnostic: JSON.stringify({ message: { code: { code: 'clippy::wrong_code' } } }),
    };
    const violations = validateMatrix(evidence, EXPECTED_CODE, extractClippyCode);
    expect(violations.some((v) => v.includes('identity is'))).toBe(true);
  });
});

// ── AC2: local `cargo clippy` RED — the flagship (developer-machine DoD gate, NOT a CI gate) ────────

const CONTRACT: FiringContract = {
  command: 'cargo clippy --message-format=json',
  jsonPath: '$.message.code.code',
  expectedCode: EXPECTED_CODE,
};

const cargoPresent = spawnSync('cargo', ['--version'], { encoding: 'utf8' }).status === 0;
// Live-fire is a DEVELOPER-MACHINE DoD gate, NOT a CI gate (mirrors backends/cargo/firing.test.ts:38
// + spec §8: do not fix by installing rust on the runner). Gate on cargo present AND not-CI so the
// live block only runs where the pinned toolchain is real — a green CI is a render/drift/evidence
// proof, NOT a live-fire proof.
const isCI = !!process.env.CI;
const runLiveFire = cargoPresent && !isCI;
const LIVE_TIMEOUT_MS = 120_000;

if (!runLiveFire) {
  // Real module-level loud-skip (a console.warn inside a skipIf body never fires): the researched
  // clippy artifact must NOT be claimed green on live-fire from a run that never fired it (T-MT-C).
  // The always-on AC1 (drift) + AC3 (committed evidence) blocks still gate in CI.
  console.warn(
    `⚠ live cargo clippy firing SKIPPED for the researched mem-forget rule (${!cargoPresent ? 'cargo absent' : 'CI environment — live-fire is a developer-machine DoD gate, not a CI gate'}); the rendered clippy.toml MUST NOT be claimed green on live-fire from this run alone. AC1 (committed-artifact drift) + AC3 (committed live-fire evidence) still gate.`,
  );
}

describe.skipIf(!runLiveFire)('AC2 — researched clippy.toml live-fires via cargo clippy', () => {
  it(
    'RED: the bad crate (calls std::mem::forget) → codes contains clippy::disallowed_methods',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, BAD_DIR);
      expect(codes.has(CONTRACT.expectedCode)).toBe(true);
    },
  );

  it(
    'CLEAN: the good crate (drops explicitly) → ZERO codes, does NOT contain the rule code',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, GOOD_DIR);
      expect(codes.has(CONTRACT.expectedCode)).toBe(false);
      expect(codes.size).toBe(0);
    },
  );
});
