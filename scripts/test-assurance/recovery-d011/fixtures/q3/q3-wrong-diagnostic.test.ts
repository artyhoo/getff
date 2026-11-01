import { describe, expect, it } from 'vitest';
import { isAdult } from './subject.ts';

// K3 frozen VIOLATING companion — wrong-diagnostic kill claim (amended-4 A4-K3).
// Green on the healthy subject; under BOTH pinned faults (cf2a boundary shift,
// cf2b constant weakening) it FAILS, but the failure message is
// "expected 'adult' to be 'minor'" — it does NOT carry the intended diagnostic
// /expected true to be false/. A healthy actual judge must REFUSE kill credit
// here (crash-RED is not a kill, K7); a judge whose intended-diagnostic
// predicate is permissively weakened improperly ACCEPTS it. Frozen bytes —
// hash-pinned in manifests/fixture-manifest.json; never edit in place.
describe('k3 violating: kill claim without the intended diagnostic', () => {
  it('maps the boundary observation through a non-intended assertion', () => {
    expect(isAdult(17) ? 'adult' : 'minor').toBe('minor');
  });
});
