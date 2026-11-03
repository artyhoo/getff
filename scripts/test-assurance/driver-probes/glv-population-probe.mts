// D011 S1 recovery — GLV population probe (amended-2, A2-corrected).
// Lints the FROZEN population fixture FILES (copied verbatim, runtime sha256-asserted)
// through the REAL runGuardLivenessGate, committing them with plain `git commit`
// (normal hooks retained — no --no-verify anywhere, F7).
// A2 correction (amended-supplemental-freeze-review finding 2): the probe is IDEMPOTENT
// and executable repeatedly. Each observation first NORMALIZES to a controlled base —
// a previous observation's TARGET dir is removed and the removal recorded as its own
// plain commit — so the fixture commit always has content, always has a DIFFERENT
// parent (distinct intended changed identity across repeated observations), and the
// gate's changed-file window is exactly the frozen fixture set every time.
// Attribution order (F2): infra/fail-closed lines FIRST; a fixture is credited GLV-DETECT
// only when its violation line carries the intended rule diagnostic
// [rules-as-tests/no-vacuous-assertion]. The probe is a pure observer: it prints what the
// gate produced; expectation matching lives in the oracle (driver arms), not here.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  runGuardLivenessGate,
  TEST_QUALITY_FAILURE_RULE_ID,
} from '../../../packages/core/hooks/checks/guard-liveness.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const POP_DIR_REL = 'scripts/test-assurance/recovery-d011/fixtures/population';
const POP_DIR = join(ROOT, POP_DIR_REL);
const TARGET_REL = 'recovery-d011-population';
const TARGET = join(ROOT, TARGET_REL);
const INTENDED_RULE = '[rules-as-tests/no-vacuous-assertion]';

// Frozen bytes (fixtures_freeze in amended2-supplemental-controls-request.json) — the
// probe refuses to lint anything that is not byte-identical to the frozen packet.
const FREEZE: Record<string, string> = {
  '__tests__/bad.vacuous-dir.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  '__tests__/good.assertive-dir.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'bad.vacuous.audit.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.integration.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.spec.mjs': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.test.cjs': 'be847625874b518218536e240584d9dd587d05aa9006366612b0fed9c64acb67',
  'bad.vacuous.test.cts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.test.js': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.test.jsx': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.test.mjs': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.test.mts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.test.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.test.tsx': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'bad.vacuous.unit.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'good.assertive.audit.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'good.assertive.integration.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'good.assertive.spec.mjs': '31de17200a3409736d21d0b03076b6a7204a3fd414fea9e0193efc2df2358571',
  'good.assertive.test.cjs': '447b746f4a0bc807bfc6647b609f730eaad2107cdcb041ecfda29f7bcfaae197',
  'good.assertive.test.cts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'good.assertive.test.js': '31de17200a3409736d21d0b03076b6a7204a3fd414fea9e0193efc2df2358571',
  'good.assertive.test.jsx': '31de17200a3409736d21d0b03076b6a7204a3fd414fea9e0193efc2df2358571',
  'good.assertive.test.mjs': '31de17200a3409736d21d0b03076b6a7204a3fd414fea9e0193efc2df2358571',
  'good.assertive.test.mts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'good.assertive.test.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'good.assertive.test.tsx': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'good.assertive.unit.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
};

function fail(msg: string): never {
  console.error(`GLV-PROBE-INFRA ${msg}`);
  process.exit(3);
}

// 1. Enumerate + hash-verify the frozen fixture files (F2: byte identity enforced, not claimed).
function walk(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...walk(p, `${prefix}${n}/`));
    else out.push(`${prefix}${n}`);
  }
  return out;
}
const fixtures = walk(POP_DIR);
if (fixtures.length !== Object.keys(FREEZE).length) {
  fail(`fixture count ${fixtures.length} != freeze ${Object.keys(FREEZE).length}`);
}
for (const rel of fixtures) {
  let sha: string;
  try {
    sha = createHash('sha256').update(readFileSync(join(POP_DIR, rel))).digest('hex');
  } catch {
    fail(`unreadable fixture ${rel}`);
  }
  if (FREEZE[rel] !== sha) fail(`sha mismatch ${rel} (frozen bytes drifted)`);
}

const git = (args: string[]): string =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const plainCommit = (msg: string): void => {
  try {
    execFileSync('git', ['commit', '-m', msg], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    fail(`plain git commit failed (hooks must stay enabled): ${(err as Error).message.slice(0, 200)}`);
  }
};

// 2. NORMALIZE to a controlled base (amended-2/A2): make repeated observations executable.
//    A previous observation's TARGET is removed; if that stages anything, the removal is
//    its own plain commit — the NEXT fixture commit then has a different parent, so every
//    observation carries a distinct intended changed identity while linting the identical
//    frozen bytes.
if (existsSync(TARGET)) {
  rmSync(TARGET, { recursive: true, force: true });
  git(['add', '-A', TARGET_REL]);
  let stagedChanges = true;
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: ROOT, stdio: 'ignore' });
    stagedChanges = false; // exit 0 — nothing staged
  } catch {
    stagedChanges = true; // non-zero — a removal is staged
  }
  if (stagedChanges) {
    plainCommit('probe: reset D011 population base (normal hooks retained)');
    console.log(`GLV-RESET-COMMIT ${git(['rev-parse', 'HEAD'])}`);
  }
}
const base = git(['rev-parse', 'HEAD']);

// 3. Copy verbatim into the scratch-visible population dir (repo-relative).
mkdirSync(TARGET, { recursive: true });
for (const rel of fixtures) {
  const slash = rel.lastIndexOf('/');
  if (slash !== -1) mkdirSync(join(TARGET, rel.slice(0, slash)), { recursive: true });
  copyFileSync(join(POP_DIR, rel), join(TARGET, rel));
}

// 4. Commit with NORMAL hooks (F7): plain `git commit`, no --no-verify, no env bypass.
//    Post-normalization this ALWAYS has content (A2: the amended-1 probe died here on the
//    second observation with nothing-to-commit).
git(['add', TARGET_REL]);
plainCommit('probe: D011 population fixtures (normal hooks retained)');
const head = git(['rev-parse', 'HEAD']);
console.log(`GLV-COMMIT ${head} parent=${base}`);

// 5. Run the REAL gate at the pre-push invocation over the committed change.
const report = runGuardLivenessGate(base);
const entry = report.failures.find((f) => f.ruleId === TEST_QUALITY_FAILURE_RULE_ID);

// 6. Attribute (order load-bearing, F2): infra/fail-closed FIRST, then intended-diagnostics.
const violationRe = /^(.+?):\d+ \[([^\]]+)\] (.*)$/;
const fcRe = /^no test-quality configuration covers selected file '([^']+)'/;
const detected = new Set<string>();
const wrongReason = new Set<string>();
for (const line of entry?.failures ?? []) {
  const fc = line.match(fcRe);
  if (fc) {
    console.log(`GLV-FAILCLOSED ${fc[1]}`);
    continue;
  }
  const v = line.match(violationRe);
  if (!v) {
    console.log(`GLV-ERROR ${line.slice(0, 120)}`);
    continue;
  }
  if (`[${v[2]}]` === INTENDED_RULE) detected.add(v[1]);
  else wrongReason.add(v[1]);
}

if (!entry) {
  // The test-quality channel produced nothing at all — every fixture is silently
  // unreported (SUP-R1-INVOC-GLV mutant observation).
  console.log('GLV-NODETECT-ALL');
  for (const rel of fixtures) console.log(`GLV-SILENT ${TARGET_REL}/${rel}`);
} else {
  for (const rel of fixtures) {
    const path = `${TARGET_REL}/${rel}`;
    if (detected.has(path)) console.log(`GLV-DETECT ${path}`);
    else if (wrongReason.has(path)) console.log(`GLV-WRONGREASON ${path}`);
    else console.log(`GLV-CLEAN ${path}`);
  }
}
