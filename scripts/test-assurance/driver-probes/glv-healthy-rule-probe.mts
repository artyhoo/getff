// Frozen D6 probe (test-assurance kernel Batch F) — the kernel-engine K4 arm.
//
// Direct `runRuleLiveness` call with a HEALTHY rule: its negative-test input genuinely
// violates (`const now = Date.now();` against rules-as-tests/no-direct-time-randomness,
// the real manifest R7 negative-test data) and its good example is clean (an injected
// clock). A healthy engine therefore returns pass — nothing to report.
//
// Observations (pinned in scripts/test-assurance/driver-expectations.json D6-K4-GLV):
//   pristine (healthy engine):   PROBE status=pass
//   D6 mutant (good-example violation forced): PROBE status=fail — the healthy rule is
//   rejected, so the over-rejection is reached and the probe's verification fails.
//
// Executed by scripts/test-assurance/driver.mjs through the repo tsx INSIDE a detached
// scratch worktree, so this import resolves to the WORKTREE's guard-liveness.ts (the
// mutated carrier). Always exits 0 — the observation is the status line, and the probe
// crashing is an infrastructure failure for the caller (T-TAK-A), not a detection.
import { runRuleLiveness, type ManifestRule } from '../../../packages/core/hooks/checks/guard-liveness.ts';

const rule: ManifestRule = {
  check: { type: 'eslint', rule: 'rules-as-tests/no-direct-time-randomness' },
  examples: {
    bad: 'const now = Date.now();',
    good: 'const now = clock.now(); // injected from infrastructure/clock',
  },
  'negative-test': {
    input: ['const now = Date.now();'],
    'expect-violation': 'rules-as-tests/no-direct-time-randomness',
  },
};

const res = runRuleLiveness('S1-D6-PROBE', rule);
console.log(`PROBE status=${res.status}`);
if (res.failures) console.log(`PROBE failures=${JSON.stringify(res.failures)}`);
