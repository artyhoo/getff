// Enrichment sidecar — FIRING test (rule-tests-surface S2, paired-negative discipline, spec §11).
// Spec: docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md Part I §2 (single-rule
// isolation) + §3 (sidecar) + §11 (self-application). Sidecar module: synthesizer/rule-tests-sidecar.ts.
//
// WHAT THIS PROVES: for the framework's OWN committed astgrep sidecar
// (fixtures/live-generation/rule-tests/astgrep.json), every bad[] sample FIRES the rule and every
// good[] sample stays CLEAN — each fired in SINGLE-RULE ISOLATION (a fresh mkdtemp dir containing
// ONLY the rule-under-repair rendered + its own sgconfig.yml + the one planted src.py). One fire per
// sample (fireContract fires exactly ONE src.py/config per dir — an array needs a plant+fire LOOP;
// planting all samples in one dir would conflate findings, spec §2). The in-memory contract reuses
// the shipped fireContract with expectedCode = ruleId; the committed firing-contract.json is NOT
// grown (spec §3 — its shape is reused at fire time).
//
// HONEST COVERAGE (T14 — read this before citing "the sidecar is tested"): the ONLY committed
// non-npm researched fixture today is the astgrep getff-researched-no-yaml-load. The sidecar FORMAT
// is defined + validated for all backends by the loader (synthesizer/rule-tests-sidecar.ts,
// unit-tested in synthesizer/rule-tests-sidecar.test.ts), but ruff/cargo have NO committed framework
// fixture to fire. So: FORMAT DEFINED for all lanes; FIRING COVERAGE = astgrep lane only;
// ruff/cargo firing coverage arrives with their first researched fixture. NOT "all lanes covered".
//
// Home rationale (backends/astgrep/, NOT synthesizer/): this fires the REAL pinned ast-grep, which
// CI installs + runs ONLY for the `test:backends` suite (audit-self.yml — "Install pinned ast-grep"
// + "Run packages/core/backends tests"). Placed anywhere else → loud-skip in CI = green-without-firing.
//
// $0-in-CI (no-paid-llm-in-ci.md / principle 17): every input is a committed in-source artifact (the
// rendered rule + the sidecar samples). The pinned @ast-grep/cli@0.44.1 is a FREE PATH binary.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { loadRuleTestsSidecar } from '../../synthesizer/rule-tests-sidecar.ts';
import {
  deriveToolVersion,
  fireContract,
  FIXTURE_CONFIG,
  FIXTURE_SOURCE,
  type AstgrepFiringContract,
} from './firing-runner.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// .../packages/core/backends/astgrep → repo root (four levels up).
const REPO_ROOT = resolve(HERE, '../../../..');
const LIVE_GEN_DIR = join(REPO_ROOT, 'packages/core/synthesizer/fixtures/live-generation');
/** The framework's OWN committed astgrep sidecar (the consumer path .ai-factory/rule-tests/astgrep.json
 *  is gitignored in this repo — .gitignore:42 — so the framework's instance lives with the fixtures). */
const SIDECAR_PATH = join(LIVE_GEN_DIR, 'rule-tests', 'astgrep.json');
/** The committed rendered artifacts the samples fire against (renderedRulePath →
 *  firing/rules/<ruleId>.yml, render-researched-astgrep.ts:65-66). */
const RULES_DIR = join(LIVE_GEN_DIR, 'firing', 'rules');

// Loaded at module scope (needed to generate the per-sample `it`s) — a malformed committed sidecar
// throws here, loud, failing collection. The committed sidecar is valid, so this is a clean load.
const sidecar = loadRuleTestsSidecar(SIDECAR_PATH);

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Build the per-rule firing contract in memory (astgrep: expectedCode = the ruleId ast-grep reports
 *  as $.ruleId). The committed firing-contract.json is NOT grown — shape reused at fire time (spec §3). */
function contractFor(ruleId: string): AstgrepFiringContract {
  return { command: 'ast-grep scan --json', jsonPath: '$.ruleId', expectedCode: ruleId };
}

/** Plant ONE sample in a FRESH mkdtemp dir carrying ONLY the rule-under-repair rendered (single-rule
 *  isolation) + its own sgconfig.yml, then fire. Returns the reported ruleId set. */
function fireSample(ruleId: string, sample: string): Set<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rt-sidecar-fire-'));
  tmpDirs.push(dir);
  mkdirSync(join(dir, 'rules'));
  // ONLY this one rendered rule → aliasing on other lanes cannot conflate; on astgrep it keeps the
  // isolation invariant uniform across all lanes (spec §2 / T-RTS-C).
  cpSync(join(RULES_DIR, `${ruleId}.yml`), join(dir, 'rules', `${ruleId}.yml`));
  // sgconfig ruleDirs is relative to the sgconfig file → the local single-rule `rules/` dir.
  writeFileSync(join(dir, FIXTURE_CONFIG), 'ruleDirs: [rules]\n');
  writeFileSync(join(dir, FIXTURE_SOURCE), sample.endsWith('\n') ? sample : `${sample}\n`);
  return fireContract(contractFor(ruleId), dir).codes;
}

// ── Always-on structural block (runs everywhere, tool present or not) ─────────────────────────────
// Tool-absent must NOT be a total no-op: the committed sidecar still loads + shape-checks, and every
// ruleId it names must have a committed rendered artifact to fire against (else the firing block below
// would silently skip a rule with no rule file). Mirrors firing.test.ts's always-on drift block.

describe('rule-tests sidecar — structural (always-on, tool-independent)', () => {
  it('every ruleId in the committed sidecar has a rendered rule artifact + non-empty bad[]/good[]', () => {
    const ruleIds = Object.keys(sidecar);
    expect(ruleIds.length).toBeGreaterThan(0);
    for (const ruleId of ruleIds) {
      expect(existsSync(join(RULES_DIR, `${ruleId}.yml`))).toBe(true);
      expect(sidecar[ruleId]?.bad.length).toBeGreaterThan(0);
      expect(sidecar[ruleId]?.good.length).toBeGreaterThan(0);
    }
  });
});

// ── Live firing (single-rule isolation, per-sample plant+fire loop) ───────────────────────────────

const LIVE_TIMEOUT_MS = 120_000;
// Presence = the pinned ast-grep on PATH here? deriveToolVersion returns undefined when absent (CI
// install step missing / local machine without ast-grep). No `!isCI` — CI installs it, fires for real.
const resolvedVersion = deriveToolVersion(contractFor('probe').command);
const toolPresent = resolvedVersion !== undefined;

if (!toolPresent) {
  // Real module-level loud-skip (a console.warn inside a skipIf body never fires) — the sidecar MUST
  // NOT be claimed green on live-fire from a run that never fired it. The always-on block still gates.
  console.warn(
    '⚠ live ast-grep firing SKIPPED for the rule-tests sidecar (ast-grep not on PATH — CI install ' +
      'step missing / local machine without the pinned binary); the sidecar MUST NOT be claimed ' +
      'green on live-fire from this run alone. The always-on structural block still gates.',
  );
}

describe.skipIf(!toolPresent)('rule-tests sidecar — astgrep lane firing (single-rule isolation)', () => {
  for (const [ruleId, samples] of Object.entries(sidecar)) {
    describe(ruleId, () => {
      samples.bad.forEach((sample, i) => {
        it(
          `bad[${i}] FIRES → reported ruleIds contain ${ruleId}`,
          { timeout: LIVE_TIMEOUT_MS },
          () => {
            expect(fireSample(ruleId, sample).has(ruleId)).toBe(true);
          },
        );
      });
      samples.good.forEach((sample, i) => {
        it(
          `good[${i}] CLEAN → ${ruleId} not reported, zero findings`,
          { timeout: LIVE_TIMEOUT_MS },
          () => {
            const codes = fireSample(ruleId, sample);
            expect(codes.has(ruleId)).toBe(false);
            expect(codes.size).toBe(0);
          },
        );
      });
    });
  }
});
