/** B2: exercise the actual Node module, including selection and failing aftermath.
 * A watchdog is a hang classification, never evidence of an assertion failure.
 * Copies retain real imports; no audited source is mutated by fault controls.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const helpers = join(root, '.agents/procedures/pipeline/helpers');
const moduleName = 'autonomy-binding.test.mjs';
const source = readFileSync(join(helpers, moduleName), 'utf8');
const sandbox = mkdtempSync(join(tmpdir(), 'b2-lifecycle-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

function run(pattern: string, injection = '') {
  let target = join(helpers, moduleName);
  if (injection) {
    const tree = mkdtempSync(join(sandbox, 'case-'));
    const copy = join(tree, 'pipeline/helpers');
    cpSync(helpers, copy, { recursive: true });
    cpSync(join(helpers, '../../intent/helpers'), join(tree, 'intent/helpers'), { recursive: true });
    target = join(copy, moduleName);
    const needle = '  assert.equal(recorderConnections, 0,';
    expect(source.split(needle)).toHaveLength(2);
    writeFileSync(target, source.replace(needle, `${injection}\n${needle}`));
  }
  return spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=${pattern}`, target], {
    encoding: 'utf8', timeout: 8000, maxBuffer: 2 * 1024 * 1024,
  });
}

function finished(result: ReturnType<typeof run>, expectedStatus: number) {
  expect(result.error, `watchdog/spawn failure: ${result.error?.message}\n${result.stdout}`).toBeUndefined();
  expect(result.signal, result.stderr).toBeNull();
  expect(result.status, result.stdout + result.stderr).toBe(expectedStatus);
}

// The fixture listener is real. TCP-only traffic must be detected even without HTTP.
const connection = `
  const { connect } = await import('node:net');
  const socket = connect(recorder.address().port, '127.0.0.1');
  await once(recorder, 'connection');
`;

describe('autonomy recorder lifecycle', () => {
  it('releases the listener when no case matches', () => {
    finished(run('^B2-no-such-case$'), 0);
  }, 12000);

  it('releases the listener with one harmless selected case', () => {
    const result = run('^A1 CQ round1: pure record construction does not certify a caller-supplied home$');
    finished(result, 0);
    expect(result.stdout).toContain('pure record construction does not certify');
    expect(result.stdout).toMatch(/# pass 1\b/);
  }, 12000);

  it('releases the listener with a distinct harmless selection', () => {
    const result = run('^A1 CQ round1: malformed authority home selection provenance is rejected$');
    finished(result, 0);
    expect(result.stdout).toMatch(/# pass 1\b/);
  }, 12000);

  it('reaches the TCP prohibition and exits nonzero after assertion failure', () => {
    const result = run('^row 13 aftermath:', connection);
    finished(result, 1);
    expect(result.stdout).toContain('no TCP connection may reach the recorder (1 did)');
    expect(result.stdout).toContain('ERR_ASSERTION');
  }, 12000);

  it('retains the separate HTTP prohibition and cleans up its failing aftermath', () => {
    const result = run('^row 13 aftermath:', `${connection}
  socket.write('GET / HTTP/1.1\\r\\nHost: localhost\\r\\n\\r\\n');
  await once(recorder, 'request');
  // Isolate the second oracle: otherwise the TCP assertion masks HTTP removal.
  recorderConnections = 0;`);
    finished(result, 1);
    expect(result.stdout).toContain('no HTTP request may reach the recorder (1 did)');
    expect(result.stdout).toContain('ERR_ASSERTION');
  }, 12000);
});
