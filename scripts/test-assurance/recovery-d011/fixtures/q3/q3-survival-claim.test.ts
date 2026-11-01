import { describe, expect, it } from 'vitest';
import { isAdult } from './subject.ts';

// K3 frozen VIOLATING companion — survival kill claim (amended-4 A4-K3).
// Green on the healthy subject AND under BOTH pinned faults (a 25-year-old is
// an adult before and after each fault). The outer control CLAIMS this file as
// a kill; any judge must refuse that credit because the file status stays
// 'pass' while 'fail' is claimed. Frozen bytes — hash-pinned in
// manifests/fixture-manifest.json; never edit in place.
describe('k3 violating: survival claimed as a kill', () => {
  it('keeps passing under both pinned faults', () => {
    expect(isAdult(25)).toBe(true);
  });
});
