/**
 * The gate that keeps the hook suites hermetic (incident 2026-09-09, staging @ 7ad05c385b).
 *
 * `packages/core/vitest.setup.ts` scrubs host-supplied configuration out of `process.env`
 * before any test module loads, so the ~147 `spawnSync(..., { env: { ...process.env, … } })`
 * sites across this package hand the artefact under test an environment the TEST chose. That
 * scrub is a list, and a list nobody re-derives is `#hope-as-gate`
 * (.claude/rules/attention-is-not-a-mechanism.md §2) — the moment a shipped hook grows a new
 * knob, the leak class reopens silently. These four checks are the detection layer:
 *
 *   1. the scrub function removes exactly the classified names (paired negative: it removes
 *      nothing else);
 *   2. BOTH vitest configs register the setup file — the check that fails on CI too, where
 *      the environment is clean and every other check here would pass vacuously;
 *   3. every env knob the SHIPPED hook trees read is classified — scrubbed, or named in the
 *      inherit-on-purpose table below with the reason;
 *   4. a real spawned child inherits none of the scrubbed names — the actual contract, tested
 *      on the actual inheritance path rather than on `process.env` alone. This check only
 *      means something because the tables live in a SIDE-EFFECT-FREE module: importing
 *      `vitest.host-env.ts` scrubs nothing, so an unregistered `setupFiles` shows up here as
 *      a leak rather than being silently performed by this file's own import.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isScrubbed, scrubHostEnv, SCRUBBED_EXACT, SCRUBBED_PREFIXES } from '../vitest.host-env.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

/**
 * Env knobs the shipped hooks read that MUST keep flowing in from the real environment, with
 * the reason each one is safe. Anything read by a hook and absent from both this table and
 * the scrub list fails check 3 — the classification is forced, never defaulted.
 */
const INHERIT_ON_PURPOSE: Record<string, string> = {
  // Structural: every hook test already pins TMPDIR to its own mkdtemp dir, and deleting it
  // would only move bash's and node's scratch files, never change a hook's decision.
  TMPDIR: 'process-structural; each test pins it explicitly',
};

/** Every `*.sh` under the shipped hook trees, both channels (source + plugin twin). */
function shellFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.sh')) out.push(p);
    }
  };
  walk(root);
  return out;
}

/**
 * Names read as `${NAME:-default}` / `:=` / `:+` / `:?` — the shell idiom for "configuration
 * that may arrive from the environment". Whole-line comments are dropped first; a trailing
 * comment on a code line is not, so this over-reports rather than under-reports, which is the
 * safe direction for a coverage gate.
 */
function envKnobs(file: string): Set<string> {
  const knobs = new Set<string>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trimStart().startsWith('#')) continue;
    for (const m of line.matchAll(/\$\{([A-Z][A-Z0-9_]{2,})(?::[-=+?])/g)) knobs.add(m[1]!);
  }
  return knobs;
}

describe('vitest host-env hermeticity', () => {
  it('scrubHostEnv removes exactly the classified names, and nothing else', () => {
    const env: Record<string, string | undefined> = {
      AIF_HANDOFF_GATE: '1',
      AIF_CTX_WINDOW: '1000000',
      CLAUDE_CODE_AUTO_COMPACT_WINDOW: '300000',
      RUNTIME_BRIDGE_AIF_PROJECT_ID: 'p',
      ZCODE_PROJECT_DIR: '/z',
      ORCHESTRATION_MODE_MARKER: '/m',
      LOG_LEVEL: 'DEBUG',
      // Paired negative — the process must still be able to run commands and find $HOME.
      PATH: '/usr/bin',
      HOME: '/home/x',
      TMPDIR: '/tmp',
      CLAUDE_CODE_ENTRYPOINT: 'cli',
    };
    const removed = scrubHostEnv(env);
    expect(removed).toEqual([
      'AIF_CTX_WINDOW',
      'AIF_HANDOFF_GATE',
      'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
      'LOG_LEVEL',
      'ORCHESTRATION_MODE_MARKER',
      'RUNTIME_BRIDGE_AIF_PROJECT_ID',
      'ZCODE_PROJECT_DIR',
    ]);
    expect(Object.keys(env).sort(), 'the survivors are the process-structural ones').toEqual([
      'CLAUDE_CODE_ENTRYPOINT',
      'HOME',
      'PATH',
      'TMPDIR',
    ]);
  });

  it('BOTH vitest configs register the setup file', () => {
    // The one check here that is not vacuous on a clean CI runner: unregister the setup in
    // either config and this fails everywhere, rather than only on a developer's machine.
    // Pre-push runs individual packages/core files FROM REPO ROOT, so both configs matter.
    const pairs: [string, string][] = [
      ['packages/core/vitest.config.ts', './vitest.setup.ts'],
      ['vitest.config.ts', './packages/core/vitest.setup.ts'],
    ];
    for (const [cfg, entry] of pairs) {
      const src = readFileSync(resolve(REPO_ROOT, cfg), 'utf8');
      expect(src, `${cfg} must register ${entry} in setupFiles`).toContain(`setupFiles: ['${entry}']`);
    }
  });

  it('every env knob the shipped hooks read is classified — scrubbed or inherited on purpose', () => {
    const files = [
      ...shellFiles(resolve(REPO_ROOT, '.claude/hooks')),
      ...shellFiles(resolve(REPO_ROOT, 'plugin/hooks')),
    ];
    expect(files.length, 'the scan found the hook trees at all').toBeGreaterThan(20);
    const unclassified = new Map<string, string>();
    for (const f of files) {
      for (const knob of envKnobs(f)) {
        if (isScrubbed(knob) || knob in INHERIT_ON_PURPOSE) continue;
        if (!unclassified.has(knob)) unclassified.set(knob, f.slice(REPO_ROOT.length + 1));
      }
    }
    expect(
      [...unclassified].map(([k, f]) => `${k} (${f})`),
      'a new hook knob must be added to vitest.host-env.ts or to INHERIT_ON_PURPOSE with a reason',
    ).toEqual([]);
  });

  it('a spawned child inherits none of the scrubbed names', () => {
    // The contract as the hook suites actually exercise it: spread process.env into a child.
    const probe = `process.stdout.write(JSON.stringify(Object.keys(process.env)))`;
    const r = spawnSync(process.execPath, ['-e', probe], {
      encoding: 'utf8',
      env: { ...process.env },
    });
    expect(r.status, `probe stderr: ${r.stderr}`).toBe(0);
    const leaked = (JSON.parse(r.stdout) as string[]).filter(isScrubbed);
    expect(leaked, 'setupFiles ran and the child environment is clean').toEqual([]);
  });

  it('the classification tables are non-empty and disjoint', () => {
    expect(SCRUBBED_PREFIXES.length).toBeGreaterThan(0);
    expect(SCRUBBED_EXACT.length).toBeGreaterThan(0);
    for (const name of Object.keys(INHERIT_ON_PURPOSE)) {
      expect(isScrubbed(name), `${name} cannot be both scrubbed and inherited`).toBe(false);
    }
  });
});
