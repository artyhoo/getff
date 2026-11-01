// D011 S1 recovery — carrier-enforcement probe (amended-2, A5-corrected; NEW).
// The amended-1 carrier projection accepted ANY matching rule key (a `vitest/...` key
// would have passed) and never asserted BOTH Q1/Q2 severities; templates were projected
// as bytes, never executed; the root tests/ LOCATION row was unproven (finding A5).
//
// Lane 1 — CARRIER-ENF (root, REAL): writes a scratch population at the repo root and
//   lints it through the REAL root eslint.config.mjs (the same file the CLI lane loads —
//   which executes the COMMITTED .mjs rule twins). Enforcement is credited ONLY for the
//   EXACT intended rule id at severity 2:
//     bad-q1     carrier-a5-probe/x.vacuous.test.ts     (corpus bad.literal-identity.ts)  -> no-vacuous-assertion
//     bad-q2     carrier-a5-probe/x.comment-only.test.ts (corpus bad.comment-only.ts)      -> require-effective-assertion
//     good       carrier-a5-probe/x.good.test.ts         (corpus good.constant-on-subject) -> zero messages
//     tests-dir  carrier-a5-probe/tests/plain-vacuous.ts (bad.literal-identity bytes, NO
//                test-bearing name — covered only by the '**/tests/**' location entry
//                the amended-2 widening adds) -> no-vacuous-assertion (pristine) / HOLE
//                under the SUP-R2-ROOT-TESTS-DIR fault.
// Lane 2 — CARRIER-SEV (root, projected): calculateConfigForFile per name×ext cell AND
//   per location cell; BOTH exact keys must sit at 'error' — a foreign rule key, a
//   missing key or a warn severity prints MISSING, never BOTH-ERROR.
// Lane 3 — CARRIER-TPL (templates, EXECUTED): each shipped preset template's test-scope
//   block is byte-verified (both keys 'error' + the location entry) and then EXECUTED —
//   Linter.verify over the REAL corpus bytes with the REAL .mjs twins and the real TS
//   parser, filenames chosen per axis. Projection alone proves nothing; these lines
//   carry actual fired/clean verdicts.
// This probe is POST-SB2-companion anchored: the tests-dir/location expectations bind
// the amended-2 widened world (the be84/names-widened state reads HOLE/MISSING there —
// the measured hole the widening closes).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minimatch } from 'minimatch';
import { ESLint, Linter } from 'eslint';
import tseslintParser from '@typescript-eslint/parser';
import { noVacuousAssertion } from '../../../packages/core/eslint-rules/no-vacuous-assertion.mjs';
import { requireEffectiveAssertion } from '../../../packages/core/eslint-rules/require-effective-assertion.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CORPUS = join(ROOT, 'scripts/test-assurance/corpus');
const Q1_BAD = readFileSync(join(CORPUS, 'q1-vacuous/bad.literal-identity.ts'), 'utf8');
const Q2_BAD = readFileSync(join(CORPUS, 'q2-noassertion/bad.comment-only.ts'), 'utf8');
const Q1_GOOD = readFileSync(join(CORPUS, 'q1-vacuous/good.constant-on-subject.ts'), 'utf8');
const Q1_RULE = 'rules-as-tests/no-vacuous-assertion';
const Q2_RULE = 'rules-as-tests/require-effective-assertion';

// ── Lane 1: real root-config lint over the scratch population ──
const PROBE_DIR = 'carrier-a5-probe';
const population: Array<{ lane: string; path: string; bytes: string; intended: string | null }> = [
  { lane: 'bad-q1', path: `${PROBE_DIR}/x.vacuous.test.ts`, bytes: Q1_BAD, intended: Q1_RULE },
  { lane: 'bad-q2', path: `${PROBE_DIR}/x.comment-only.test.ts`, bytes: Q2_BAD, intended: Q2_RULE },
  { lane: 'good', path: `${PROBE_DIR}/x.good.test.ts`, bytes: Q1_GOOD, intended: null },
  {
    lane: 'tests-dir',
    path: `${PROBE_DIR}/tests/plain-vacuous.ts`,
    bytes: Q1_BAD, // no test-bearing name — the location axis alone selects it
    intended: Q1_RULE,
  },
];
for (const f of population) {
  const slash = f.path.lastIndexOf('/');
  mkdirSync(join(ROOT, f.path.slice(0, slash)), { recursive: true });
  writeFileSync(join(ROOT, f.path), f.bytes);
}
try {
  const eslint = new ESLint({ cwd: ROOT });
  for (const f of population) {
    const [msg] = await eslint.lintFiles([f.path]);
    if (msg.messages.length === 0) {
      console.log(`CARRIER-ENF root ${f.lane} ${f.path} ${f.intended ? `HOLE msgs=0` : 'CLEAN msgs=0'}`);
      continue;
    }
    const intendedMsg = f.intended
      ? msg.messages.find((m) => m.ruleId === f.intended && m.severity === 2)
      : undefined;
    if (intendedMsg) {
      console.log(`CARRIER-ENF root ${f.lane} ${f.path} ENFORCED rule=${f.intended}`);
      console.log(`CARRIER-ENF-DETAIL ${f.lane} sev=2 msgs=${msg.messages.length} line=${intendedMsg.line}`);
    } else {
      const other = msg.messages[0];
      console.log(`CARRIER-ENF root ${f.lane} ${f.path} WRONGENF rule=${String(other.ruleId)} sev=${other.severity}`);
    }
  }

  // ── Lane 2: both exact keys at 'error', per name×ext and per location cell ──
  const NAMES = ['test', 'spec', 'unit', 'audit', 'integration'] as const;
  const EXTS = ['ts', 'tsx', 'mts', 'cts', 'mjs', 'cjs', 'js', 'jsx'] as const;
  const cells: string[] = [];
  for (const n of NAMES) for (const e of EXTS) cells.push(`src/widget.${n}.${e}`);
  cells.push(`${PROBE_DIR}/tests/plain.ts`, 'packages/foo/__tests__/x.ts', 'app/tests/deep/x.tsx');
  for (const cell of cells) {
    const config = await eslint.calculateConfigForFile(cell);
    const rules = (config.rules ?? {}) as Record<string, unknown>;
    // calculateConfigForFile normalizes 'error' -> 2 / 'warn' -> 1; accept both spellings.
    const norm = (v: unknown): string => {
      const first = Array.isArray(v) ? v[0] : v;
      return first === 2 || first === 'error' ? 'error' : first === 1 || first === 'warn' ? 'warn' : String(first);
    };
    const q1 = norm(rules[Q1_RULE]);
    const q2 = norm(rules[Q2_RULE]);
    if (q1 === 'error' && q2 === 'error') console.log(`CARRIER-SEV ${cell} BOTH-ERROR`);
    else console.log(`CARRIER-SEV ${cell} MISSING q1=${q1} q2=${q2}`);
  }
} finally {
  rmSync(join(ROOT, PROBE_DIR), { recursive: true, force: true });
}

// ── Lane 3: shipped templates — byte-verified AND executed over real corpus bytes ──
const TEMPLATES = [
  'packages/preset-next-15-canonical/templates/eslint.config.react.mjs',
  'packages/preset-react-spa/templates/eslint.config.react.mjs',
] as const;
const TPL_TAG = /templates\/([a-z0-9-]+)\/eslint\.config\.react\.mjs$/;
for (const tpl of TEMPLATES) {
  const tag = tpl.match(TPL_TAG)?.[1] ?? tpl;
  const text = readFileSync(join(ROOT, tpl), 'utf8');
  const filesLine = text.match(/files: \[([^\]]*)\],/g)?.find((l) => l.includes('test,spec')) ?? '';
  const globs = [...filesLine.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const q1Err = /'rules-as-tests\/no-vacuous-assertion':\s*'error'/.test(text);
  const q2Err = /'rules-as-tests\/require-effective-assertion':\s*'error'/.test(text);
  const hasLocation = globs.some((g) => /^tests\/\*\*\/\*\.\{ts,tsx\}$/.test(g));
  console.log(
    `CARRIER-TPL-BYTES ${tag} q1-error=${q1Err} q2-error=${q2Err} location-entry=${hasLocation} globs=${globs.length}`,
  );

  // Execute the template's declared test-scope contract over the corpus bytes with the
  // REAL shipped .mjs twins and the real TS parser. The Linter.verify single-object
  // route silently ignores `files` keys, so glob membership is asserted separately with
  // minimatch (the matcher family ESLint's flat config uses) and the executed config
  // carries the rules unconditionally — execution and scope are two honest checks.
  const linter = new Linter();
  const config: Linter.Config = {
    languageOptions: {
      parser: tseslintParser as Linter.Parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: {
      'rules-as-tests': {
        rules: { 'no-vacuous-assertion': noVacuousAssertion, 'require-effective-assertion': requireEffectiveAssertion },
      },
    },
    rules: { [Q1_RULE]: 'error', [Q2_RULE]: 'error' },
  };
  const samples: Array<[string, string]> = [
    ['src/widget.test.ts', Q1_BAD],
    ['src/noassert.test.ts', Q2_BAD],
    ['src/good.test.ts', Q1_GOOD],
    ['tests/plain.ts', Q1_BAD],
  ];
  for (const [name] of samples) {
    const selected = globs.some((g) => minimatch(name, g, { dot: true }));
    console.log(`CARRIER-TPL-GLOB ${tag} ${name} ${selected ? 'selected' : 'unselected'}`);
  }
  const exec = (name: string, bytes: string): number => linter.verify(bytes, config, { filePath: name }).length;
  const vacuousFix = exec('src/widget.test.ts', Q1_BAD);
  const commentFix = exec('src/noassert.test.ts', Q2_BAD);
  const goodFix = exec('src/good.test.ts', Q1_GOOD);
  const locationFix = exec('tests/plain.ts', Q1_BAD);
  console.log(
    `CARRIER-TPL-EXEC ${tag} bad-q1=${vacuousFix > 0 ? 'fired' : 'silent'} bad-q2=${commentFix > 0 ? 'fired' : 'silent'} good=${goodFix === 0 ? 'clean' : 'fired'} tests-dir=${locationFix > 0 ? 'fired' : 'silent'}`,
  );
}
