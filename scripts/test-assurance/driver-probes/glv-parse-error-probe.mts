// Frozen D5 probe (test-assurance kernel Batch F) — the cf3 discharge mechanism.
//
// Direct `runRuleLiveness` call with a FATAL PARSE ERROR input: the only message class
// whose ruleId differs from the configured rule, hence the only input that reaches the
// `matchesViolation` fallthrough (a clean zero-message input never invokes the matcher
// — `messages.some(...)` over an empty array). Reachability analysis frozen from
// Batch D (docs/test-assurance-kernel/s1/counterfactuals/cf3-guard-liveness-permissive.json).
//
// Observations (pinned in scripts/test-assurance/driver-expectations.json D5-PERM-GLV):
//   pristine (healthy matcher):  PROBE status=fail  — the miss IS reported
//   D5 mutant (fallthrough true): PROBE status=pass — the miss is silently matched
//
// Executed by scripts/test-assurance/driver.mjs through the repo tsx INSIDE a detached
// scratch worktree, so this import resolves to the WORKTREE's guard-liveness.ts (the
// mutated carrier). Always exits 0 — the observation is the status line, and the probe
// crashing is an infrastructure failure for the caller (T-TAK-A), not a detection.
import { runRuleLiveness, type ManifestRule } from '../../../packages/core/hooks/checks/guard-liveness.ts';

const rule: ManifestRule = {
  check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
  examples: {
    bad: "'use client';\nimport fs from 'fs';\nexport const x = 1;",
    good: "'use client';\nimport { useState } from 'react';\nexport function C() { return null; }",
  },
  'negative-test': {
    input: ['const totally = ;'],
    'expect-violation': 'rules-as-tests/no-server-imports-in-client',
  },
};

const res = runRuleLiveness('S1-D5-PROBE', rule);
console.log(`PROBE status=${res.status}`);
if (res.failures) console.log(`PROBE failures=${JSON.stringify(res.failures)}`);
