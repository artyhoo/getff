/**
 * Runtime-binary drift gate for the ZCode parity SSOT (Fork B, survey #1699 §8).
 *
 * Channel: test:hooks (`vitest run hooks/`). Wraps scripts/probe-zcode-runtime.sh —
 * the same hand-probes that produced #1696 (doc-ahead-of-runtime) and survey #1699
 * §4 (our own renderer citing a dead security policy), made executable per the
 * framework thesis: documents lie, binaries don't — so the BINARY is the test
 * oracle and the doc is the claim under test.
 *
 * Coverage on machines with /Applications/ZCode.app present (maintainer hosts):
 * the 7-event enum, the workspace-hooks trust channel markers, the §3 hook I/O
 * contract literals, plugin-component compatibility, CC env compat — 17
 * assertions, all pinned to the survey's build-2026-09-04 baseline.
 *
 * Absent binary (CI runners, consumer clones): the script SKIPs (exit 0, loud
 * notice) and this suite reports vitest-skip — a missing oracle asserts nothing,
 * by design (the harness-config-drift N4 precedent: loud-skip, never
 * false-green). ZCODE_RUNTIME_BUNDLE overrides the path for non-default installs.
 *
 * Paired-negative contract:
 *   N1 point ZCODE_RUNTIME_BUNDLE at a file lacking the markers → exit 1 + DRIFT line
 *   N2 absent bundle → exit 0 + SKIP line (this suite skips)
 *   P1 live bundle → exit 0 + "all assertions green"
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '../../../scripts/probe-zcode-runtime.sh');
const defaultBundle = '/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs';

interface RunResult {
  status: number;
  out: string;
}

function runProbe(env: Record<string, string>): RunResult {
  try {
    const out = execFileSync('bash', [script], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: 60_000,
    });
    return { status: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { status: err.status ?? 1, out: err.stdout ?? '' };
  }
}

describe('zcode-runtime-probe — parity SSOT vs installed binary (Fork B)', () => {
  it('P1: live bundle (when present) — all assertions green', { timeout: 90_000 }, () => {
    if (!existsSync(defaultBundle)) {
      console.warn(`SKIP: ${defaultBundle} absent — runtime probe asserts nothing here (by design).`);
      return;
    }
    const r = runProbe({});
    expect(r.out).toContain('probe-zcode-runtime:');
    expect(r.status).toBe(0);
    expect(r.out).toContain('all assertions green');
    expect(r.out).not.toContain('DRIFT');
  });

  it('N2: absent bundle → script SKIPs (exit 0, loud notice), never fails CI', () => {
    const r = runProbe({ ZCODE_RUNTIME_BUNDLE: '/nonexistent/zcode.cjs' });
    expect(r.status).toBe(0);
    expect(r.out).toContain('SKIP:');
  });

  it('N1: bundle without the trust-channel markers → exit 1 + DRIFT names the lockstep rule', () => {
    const fake = join(mkdtempSync(join(tmpdir(), 'zcp-probe-')), 'zcode.cjs');
    // Carries the enum so early assertions pass, but none of the §4 trust markers.
    writeFileSync(
      fake,
      'x ["SessionStart","UserPromptSubmit","PreToolUse","PermissionRequest","PostToolUse","PostToolUseFailure","Stop"] x',
    );
    const r = runProbe({ ZCODE_RUNTIME_BUNDLE: fake });
    expect(r.status).toBe(1);
    expect(r.out).toContain('DRIFT');
    expect(r.out).toContain('update this probe + doctrine in lockstep');
  });
});
