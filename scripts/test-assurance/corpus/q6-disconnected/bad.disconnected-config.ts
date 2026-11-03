import { describe, expect, it } from 'vitest';

// Q6 bad case (scratch-repo template — Batch E plants this in a scratch checkout
// whose delivered eslint.config.mjs carries the rule at severity "off") — an
// IN-MEMORY plan asserted while the DELIVERED configuration is disconnected
// (spec §5: «Testing an in-memory plan while claiming the emitted/installed
// configuration enforces it»; A04 shape). Nothing here reads the artifact from
// disk — the delivery-conformance channel (Batch E) rejects the claim.
const lintPlan = { rule: 'rules-as-tests/no-vacuous-assertion', severity: 'error' as const };

describe('q6 bad: in-memory plan valid, delivered config off', () => {
  it('the plan enables the rule', () => {
    expect(lintPlan.severity).toBe('error');
  });
});
