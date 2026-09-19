/**
 * The ManualBackend fallback must NOT swallow an invalid kickoff spec.
 *
 * Incident 2026-09-02 (beta-docs-showcase BS0): a kickoff whose header named the
 * `bridge-profile` token produced a garbage profile hint; `_resolveProfileId`
 * threw; `cli/dispatch.ts` caught it under its blanket `BackendError ->
 * ManualBackend` rule, wrote /tmp/runtime-bridge-<id>.md and exited 0. The
 * operator saw a successful-looking dispatch and no aif task existed.
 *
 * The fallback answers "the runtime is unreachable / metered out / busy" — the
 * operator is stuck through no fault of the kickoff, so copy-paste is a genuine
 * escape. It does NOT answer "the kickoff names a runtime profile that does not
 * exist": that is an authoring defect in the INPUT, no backend can satisfy it,
 * and degrading silently routes the work to a seat the marker explicitly did not
 * ask for. Same judgment the repo already made for cli/claim.ts ("a claim that
 * silently failed is worse than no claim" — dispatch-import-no-sideeffect.test.ts).
 *
 * Paired arms below: the spec_invalid class must abort (exit 2, no /tmp artefact),
 * and every environmental class must STILL fall back (exit 0, /tmp artefact written).
 *
 * Harness note: the aif stub runs in its OWN process. `spawnSync` blocks this
 * process's event loop, so an in-test `http.createServer` can never answer the
 * CLI's `available()` probe — every arm would silently degrade to ManualBackend
 * and the spec_invalid arms would "pass" for the wrong reason.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync, spawn, type ChildProcess, type SpawnSyncReturns } from 'node:child_process';
import { readdirSync, existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { isFallbackEligible } from '../src/cli/dispatch.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const CLI = resolve(HERE, '../src/cli/dispatch.ts');
const TSX = resolve(REPO_ROOT, 'node_modules/.bin/tsx');

// Shell spawn of tsx cold-compiles the CLI; slow shells need headroom
// (SLOW_SHELL_MS precedent, PR #848).
const SLOW_SHELL_MS = 30_000;

/** Minimal aif REST stub, sourced into its own node process (see harness note). */
const STUB_SRC = `
import { createServer } from 'node:http';
const cfg = JSON.parse(process.argv[2]);
const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
createServer((req, res) => {
  const url = req.url ?? '';
  req.resume();
  if (url.startsWith('/health')) return send(res, 200, { ok: true });
  if (url.startsWith('/projects')) return send(res, 200, [{ id: 'proj-uuid', parallelEnabled: true }]);
  if (url.startsWith('/runtime-profiles')) {
    // emptyProfilesBody: 200 with NO body. _rest tolerates an empty body by
    // returning {}, so _resolveProfileId then calls profiles.filter on an object
    // and throws a TypeError — the exact non-BackendError repro A5-4 cites.
    if (cfg.emptyProfilesBody) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
    return send(res, 200, cfg.profiles);
  }
  if (url.startsWith('/tasks') && req.method === 'POST')
    return cfg.failCreate ? send(res, 500, { error: 'boom' }) : send(res, 201, { id: 'task-123' });
  return send(res, 200, {});
}).listen(0, '127.0.0.1', function () {
  process.stdout.write('READY http://127.0.0.1:' + this.address().port + '\\n');
});
`;

const running: ChildProcess[] = [];
afterEach(() => {
  while (running.length) running.pop()?.kill();
});

/**
 * Start the stub and resolve its base URL. `profiles` is what
 * GET /runtime-profiles serves; `failCreate` makes POST /tasks 500 so an
 * ENVIRONMENTAL dispatch_failed can be exercised on the same wire.
 */
function startStub(cfg: {
  profiles: Array<{ id: string; name: string }>;
  failCreate?: boolean;
  emptyProfilesBody?: boolean;
}): Promise<string> {
  const dir = mkdtempSync(resolve(tmpdir(), 'rb-stub-'));
  const stubPath = resolve(dir, 'stub.mjs');
  writeFileSync(stubPath, STUB_SRC, 'utf8');
  const child = spawn('node', [stubPath, JSON.stringify(cfg)], { stdio: ['ignore', 'pipe', 'pipe'] });
  running.push(child);
  return new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('stub never reported READY')), 10_000);
    child.stdout!.on('data', (buf: Buffer) => {
      const m = /READY (\S+)/.exec(String(buf));
      if (m) {
        clearTimeout(t);
        ok(m[1]);
      }
    });
  });
}

/** Names of the ManualBackend kickoff artefacts currently sitting in /tmp. */
function manualArtifacts(): string[] {
  return readdirSync('/tmp').filter(
    (f) => f.startsWith('runtime-bridge-') && f.endsWith('.md') && !f.includes('.response.'),
  );
}

/** Write a kickoff whose header carries the given bridge-profile marker line. */
function writeKickoff(marker: string): string {
  const kickoffDir = resolve(mkdtempSync(resolve(tmpdir(), 'rb-kickoff-')), 'demo-stage');
  mkdirSync(kickoffDir, { recursive: true });
  const path = resolve(kickoffDir, 'kickoff.md');
  // Unique body so the idempotency log never dedups one arm against another.
  writeFileSync(path, `${marker}\n# Demo ${Math.random()}\n\n## §1\nBody.\n`, 'utf8');
  return path;
}

function runDispatch(
  kickoffPath: string,
  baseUrl: string,
  envOverride: Record<string, string> = {},
): SpawnSyncReturns<string> {
  return spawnSync(TSX, [CLI, kickoffPath, '--force'], {
    encoding: 'utf8',
    timeout: SLOW_SHELL_MS,
    env: {
      ...process.env,
      RUNTIME_BRIDGE_MODE: 'aif-handoff',
      RUNTIME_BRIDGE_AIF_URL: baseUrl,
      RUNTIME_BRIDGE_AIF_PROJECT_ID: 'proj-uuid',
      RUNTIME_BRIDGE_PREFLIGHT: '',
      ...envOverride,
    },
  });
}

describe('isFallbackEligible — which BackendError classes may degrade to ManualBackend', () => {
  it('environmental classes stay fallback-eligible (the "never leave the operator stuck" contract)', () => {
    expect(isFallbackEligible('unavailable')).toBe(true);
    expect(isFallbackEligible('quota_exceeded')).toBe(true);
    expect(isFallbackEligible('timeout')).toBe(true);
    expect(isFallbackEligible('dispatch_failed')).toBe(true);
  });

  it('spec_invalid is NOT fallback-eligible: no backend can satisfy a broken kickoff', () => {
    expect(isFallbackEligible('spec_invalid')).toBe(false);
  });
});

describe('cli/dispatch.ts — an unresolvable bridge-profile marker aborts instead of degrading', () => {
  it(
    'hint matching NO profile → exit 2, no /tmp artefact, operator told what to fix',
    async () => {
      const url = await startStub({ profiles: [{ id: 'glm-sdk', name: 'Z.AI GLM-5.2 SDK' }] });
      const before = new Set(manualArtifacts());
      const r = runDispatch(writeKickoff('<!-- bridge-profile: Nonexistent Seat -->'), url);

      expect(r.status).toBe(2);
      expect(r.stderr).toContain('Nonexistent Seat');
      expect(r.stderr).toContain('Z.AI GLM-5.2 SDK'); // the candidate list, so the fix is obvious
      // The defect being fixed: a /tmp file that made a no-op look like a dispatch.
      expect(manualArtifacts().filter((f) => !before.has(f))).toEqual([]);
      // ...and nothing on stdout may read as a successful dispatch.
      expect(r.stdout).not.toContain('paste into a new Claude Code session');
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'hint matching SEVERAL profiles ambiguously → exit 2 as well (same authoring-defect class)',
    async () => {
      const url = await startStub({
        profiles: [
          { id: 'glm-api', name: 'Z.AI GLM-5.2' },
          { id: 'glm-sdk', name: 'Z.AI GLM-5.2 SDK' },
        ],
      });
      const before = new Set(manualArtifacts());
      const r = runDispatch(writeKickoff('<!-- bridge-profile: GLM -->'), url);

      expect(r.status).toBe(2);
      expect(r.stderr).toContain('ambiguously');
      expect(manualArtifacts().filter((f) => !before.has(f))).toEqual([]);
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'CONTROL: a resolvable hint still dispatches normally (exit 0, real task created)',
    async () => {
      const url = await startStub({ profiles: [{ id: 'glm-sdk', name: 'Z.AI GLM-5.2 SDK' }] });
      const r = runDispatch(writeKickoff('<!-- bridge-profile: Z.AI GLM-5.2 SDK -->'), url);

      expect(r.status).toBe(0);
      expect(r.stdout).toContain('task-123');
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'CONTROL: an ENVIRONMENTAL failure still degrades to ManualBackend (exit 0 + /tmp artefact)',
    async () => {
      // POST /tasks 500 → BackendError('dispatch_failed') from the create step,
      // NOT from marker resolution. This arm is the reason the fix is a per-class
      // split rather than "stop falling back": kill it and the bridge starts
      // leaving operators stuck on a transient aif failure.
      const url = await startStub({ profiles: [], failCreate: true });
      const r = runDispatch(writeKickoff('<!-- no profile marker here -->'), url);

      expect(r.status).toBe(0);
      expect(r.stdout).toContain('paste into a new Claude Code session');
      // Assert on the artefact the run itself names, not on a directory diff:
      // ManualBackend task ids are second-resolution timestamps and the dispatch
      // also prunes its own stale /tmp files, so both are unstable across arms.
      const named = /runtime-bridge-([0-9A-Za-z:.-]+)\.md/.exec(r.stdout);
      expect(named).not.toBeNull();
      expect(existsSync(`/tmp/runtime-bridge-${named![1]}.md`)).toBe(true);
    },
    SLOW_SHELL_MS + 15_000,
  );
});

// ── E-3: a missing projectId aborts instead of degrading ──────────────────────

describe('E-3 — a missing RUNTIME_BRIDGE_AIF_PROJECT_ID aborts, it does not degrade', () => {
  it(
    'unset project id → exit 2, no /tmp artefact, no "dispatched" claim',
    async () => {
      // The consumer exported the var in the wrong shell or misspelled it. aif is
      // UP, so available() passes and auto mode selects it — the misconfiguration
      // only surfaces inside claim(). Classified environmental, it took the
      // blanket fallback: a /tmp file, exit 0, and an additionalContext line
      // reporting success while no aif task existed and the stage was silently
      // re-dispatchable later as a duplicate.
      const url = await startStub({ profiles: [] });
      const before = new Set(manualArtifacts());
      const r = runDispatch(writeKickoff('<!-- no profile marker here -->'), url, {
        RUNTIME_BRIDGE_AIF_PROJECT_ID: '',
      });

      expect(r.status).toBe(2);
      expect(r.stderr).toContain('RUNTIME_BRIDGE_AIF_PROJECT_ID');
      expect(manualArtifacts().filter((f) => !before.has(f))).toEqual([]);
      expect(r.stdout).not.toContain('paste into a new Claude Code session');
      // The abort must reach the agent as additionalContext, not stderr alone.
      expect(r.stdout).toContain('ABORTED');
    },
    SLOW_SHELL_MS + 15_000,
  );
});

// ── A5-4: a non-BackendError must not exit 0 in silence ───────────────────────

describe('A5-4 — an unexpected (non-BackendError) failure is reported, not swallowed', () => {
  it(
    'a shape error inside dispatch() → exit 1 + additionalContext, no false success',
    async () => {
      // Ledger repro: GET /runtime-profiles answers 200 with an EMPTY body, _rest
      // tolerates that by returning {}, and _resolveProfileId calls .filter on it
      // → TypeError. That is not a BackendError, so it fell through to a branch
      // that wrote one stderr line and exited 0 with no additionalContext — and
      // the shipped hook redirects this CLI's stderr to a file and forwards only
      // stdout, so an auto-marked kickoff silently did not dispatch while the
      // author saw nothing but a successful Write.
      const url = await startStub({ profiles: [], emptyProfilesBody: true });
      const before = new Set(manualArtifacts());
      const r = runDispatch(writeKickoff('<!-- bridge-profile: Some Seat -->'), url);

      expect(r.status).toBe(1);
      // Reaches the agent through the ONE channel the hook forwards.
      expect(r.stdout).toContain('[runtime-bridge]');
      expect(r.stdout).toMatch(/unexpected|internal error/i);
      // Nothing may read as a dispatch that happened.
      expect(r.stdout).not.toContain('paste into a new Claude Code session');
      expect(r.stdout).not.toMatch(/Dispatched to/);
      expect(manualArtifacts().filter((f) => !before.has(f))).toEqual([]);
    },
    SLOW_SHELL_MS + 15_000,
  );

  it(
    'CONTROL: the same wire with a resolvable profile still dispatches (exit 0)',
    async () => {
      const url = await startStub({ profiles: [{ id: 'seat-1', name: 'Some Seat' }] });
      const r = runDispatch(writeKickoff('<!-- bridge-profile: Some Seat -->'), url);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('task-123');
    },
    SLOW_SHELL_MS + 15_000,
  );
});
