import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const BIN = fileURLToPath(new URL('./pr-body-fidelity-bin.ts', import.meta.url));
const HEAD = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0';
const GO_BODY = `## Fidelity verdict\nFIDELITY: GO\nBasis: k.md\nRound: 1\nAudited-SHA: ${HEAD}\nEvidence: src/a.ts:1\n`;

/** Run the bin with an env set; returns { code, stdout, stderr }. */
function run(env: Record<string, string | undefined>) {
  try {
    const stdout = execFileSync('npx', ['tsx', BIN], {
      env: { ...process.env, BASE_REF: undefined, PR_BODY: undefined, HEAD_SHA: undefined, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

describe('pr-body-fidelity-bin env contract (fails closed on misconfiguration)', () => {
  it('exits 0 on a valid GO body for base staging', () => {
    const r = run({ BASE_REF: 'staging', PR_BODY: GO_BODY, HEAD_SHA: HEAD });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/pr-body-fidelity: OK/);
  });

  it('exits 1 with ::error:: annotations on a body missing the section', () => {
    const r = run({ BASE_REF: 'staging', PR_BODY: '## Summary\nx\n', HEAD_SHA: HEAD });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/::error::/);
    expect(r.stderr).toMatch(/missing `## Fidelity verdict` section/);
  });

  it('exits 1 when BASE_REF is unset (must not degrade to a green no-op)', () => {
    const r = run({ PR_BODY: '', HEAD_SHA: HEAD });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/BASE_REF env var is required/);
  });

  it('exits 1 when HEAD_SHA is unset on a staging PR (staleness guard cannot run)', () => {
    const r = run({ BASE_REF: 'staging', PR_BODY: GO_BODY });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/HEAD_SHA env var is required/);
  });

  it('exits 0 out-of-scope for an explicitly different non-empty base ref', () => {
    const r = run({ BASE_REF: 'main', PR_BODY: '', HEAD_SHA: HEAD });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/out of scope/);
  });
});
