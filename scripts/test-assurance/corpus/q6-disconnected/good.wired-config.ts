import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Q6 good companion — the DELIVERED ARTIFACT is read from disk and its enforcement
// asserted (spec §4 K5: source → emitted artifact → invoked runner → gate). The
// scratch template reads the scratch repo's emitted eslint config; Batch E proves
// the delivery break (severity off / unregistered rule) flips this to RED.
describe('q6 good: delivered config actually enforces the rule', () => {
  it('the emitted eslint config wires the rule at error severity', () => {
    const cfg = readFileSync(join(process.cwd(), 'eslint.config.mjs'), 'utf8');
    expect(cfg).toMatch(/no-vacuous-assertion['"]?\s*:\s*['"]?error/);
  });
});
