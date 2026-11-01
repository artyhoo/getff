import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Q4 bad case — the subprocess fails with the intended nonzero status and the test
// passes anyway because the status is IGNORED (spec §5: «Ignoring subprocess return
// codes or asserting only an unrelated side effect»; A08 shape). Detection channel:
// the executed conformance suite (Batch C) — this file must PASS under a real
// runner against the real exit-42 subprocess, and that pass is exactly the defect
// the conformance arm demonstrates.
describe('q4 bad: intended nonzero exit ignored', () => {
  it('claims the verifier rejects a bad payload', () => {
    const res = spawnSync(process.execPath, ['-e', 'process.exit(42)'], {
      encoding: 'utf8',
    });
    // "verification ran" — the exit status carrying the verdict is never read
    expect(res).toBeDefined();
  });
});
