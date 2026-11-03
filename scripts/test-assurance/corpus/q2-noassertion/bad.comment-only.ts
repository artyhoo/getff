import { describe, it } from 'vitest';

// Q2 bad case — comment-only body (spec §5 Q2: «comment-only, empty body, disabled
// assertions, fabricated status»). S0 probe seed:
// docs/test-assurance-kernel/s0/logs/probes/q1-scratch/noassertion.test.ts.
describe('q2 bad: comment-only test', () => {
  it('claims the installer exits 0 and the artifact is written', () => {
    // the installer exits 0 and the artifact is written
  });
});
