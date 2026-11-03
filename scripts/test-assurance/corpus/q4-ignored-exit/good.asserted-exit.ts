import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Q4 good companion — the subprocess outcome is ASSERTED (spec §5 Q4 required
// result: «the repaired suite fails on that actual process outcome»). Batch C
// flips the fixture's exit code and requires THIS file to fail (sensitivity)
// while the ignored-exit companion keeps passing.
describe('q4 good: asserted subprocess status', () => {
  it('the verifier exits 42 on a bad payload', () => {
    const res = spawnSync(process.execPath, ['-e', 'process.exit(42)'], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(42);
  });
});
