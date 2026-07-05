/**
 * Consumer-context regression test for pre-push.ts (GH #920 / #921).
 *
 * The bug: several pre-push sections shell out to MAINTAINER-ONLY paths that a
 * consumer install never receives. `install.sh` ships only
 * `packages/core/{hooks,eslint-rules}` to a consumer — NOT `package.json`,
 * `audit-self/`, `render/`, `manifest/`, `spec-validation/`, nor `docs/meta-factory/`.
 * Sections that referenced those paths without the `existsSync` consumer-skip guard
 * their siblings (3b–3f/4b) use would `die()` (or bubble a raw ENOENT → "pre-push
 * hook crashed"), hard-blocking EVERY consumer `git push`. `check:shields-up` never
 * caught it because it only verifies the hook is present/executable/wired — it never
 * executes the check chain. Only a REAL push does.
 *
 * This test closes that coverage gap: it runs the ACTUAL orchestrator against a
 * fixture consumer layout (a copy of exactly the install.sh consumer copy-list,
 * with every maintainer-only path absent) and asserts the push reaches `exit 0`.
 * Runs in CI via `test:hooks` (audit-self.yml → `vitest run hooks/`).
 *
 * Coverage of all 8 guards (each exercised by a case whose failure the guard prevents,
 * so deleting the guard reddens the suite):
 *   - §3 audit-self, §4 render, §5–5d meta-tests, guard/cmd-script-liveness manifest
 *     → the plain POSITIVE case (their absent paths would each hard-fail the push).
 *   - §7 prior-art / §1.7  → the capability-commit POSITIVE (skip) + SSOT-planted NEGATIVE.
 *   - §6 spec-validate     → the orchestrator-prompt POSITIVE (skip) + validator-planted NEGATIVE.
 *
 * Paired-negatives (testing.md discipline): each NEGATIVE plants exactly ONE
 * maintainer-only path back into the fixture and asserts the guarded section
 * RE-ENGAGES and blocks — proving that guard gates on its path's presence and is not
 * dead/always-skip code (RED-before-GREEN, per T15). §5 uses a failing `test:principles`,
 * §7 uses the SSOT register, §6 uses a failing batch-spec validator.
 *
 * The genuinely-consumer-appropriate external tools (zizmor §2, actionlint §1,
 * lychee §8) are stubbed to exit 0 so the maintainer-only-section behaviour under
 * test is isolated from whether those binaries happen to be installed on the runner.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync, execSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  symlinkSync,
  chmodSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
// Resolve the tsx ESM loader from wherever it actually lives (hoisted repo-root
// node_modules, a nested worktree parent, or packages/core/node_modules on a
// `--prefix packages/core` CI install) — createRequire walks the real resolution
// order, unlike a fixed path guess. The sandbox cwd has no node_modules of its own,
// so the spawned `node --import <absolute loader>` + NODE_PATH below carry tsx in.
const TSX_LOADER = createRequire(import.meta.url).resolve('tsx/esm');
const REAL_NODE_MODULES = TSX_LOADER.replace(
  /\/tsx\/dist\/esm\/index\.mjs$/,
  '',
);

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0))
    rmSync(d, { recursive: true, force: true });
});

/** Pretty-printed consumer root package.json with the given dependencies. */
function rootPkg(dependencies: Record<string, string>): string {
  return `${JSON.stringify(
    { name: 'consumer-fixture', private: true, type: 'module', dependencies },
    null,
    2,
  )}\n`;
}

/**
 * Build a temp git repo mirroring a CONSUMER install: only the two directory
 * groups install.sh ships (`packages/core/{hooks,eslint-rules}`), a node_modules
 * symlink for tsx/esm, and exit-0 stubs for the consumer-appropriate binaries.
 * Every maintainer-only path (package.json / audit-self / render / manifest /
 * spec-validation / docs/meta-factory) is DELIBERATELY absent.
 */
function makeConsumerSandbox(): { dir: string; baseSha: string; hook: string } {
  const dir = mkdtempSync(join(tmpdir(), 'prepush-consumer-'));
  sandboxes.push(dir);

  // The exact install.sh consumer copy-list (install.sh:343-367).
  cpSync(
    resolve(REPO_ROOT, 'packages/core/hooks'),
    join(dir, 'packages/core/hooks'),
    { recursive: true },
  );
  cpSync(
    resolve(REPO_ROOT, 'packages/core/eslint-rules'),
    join(dir, 'packages/core/eslint-rules'),
    { recursive: true },
  );
  symlinkSync(REAL_NODE_MODULES, join(dir, 'node_modules'));

  // A realistic modern consumer is ESM — its root package.json declares
  // "type":"module", so tsx loads the .ts hook as ESM (without it tsx defaults the
  // fixture's extensionless-type files to CJS and import.meta.url trips a
  // require(ESM)-cycle — a loader detail orthogonal to the guards under test).
  // NB: this is the CONSUMER root package.json, NOT packages/core/package.json —
  // the §5 meta-test guard keys on the latter, which stays absent.
  // Pretty-printed (2-space) with a dependencies block so a later dep-add lands on
  // its own `+  "name": "^ver"` diff line — the exact shape prior-art capability
  // detection keys on (isNewDepAdded, checks/prior-art.ts); the §7/§1.7 cases use it.
  writeFileSync(join(dir, 'package.json'), rootPkg({}));

  // Stub the consumer-appropriate external tools (§1 actionlint, §2 zizmor, §8
  // lychee) so the test is hermetic. §2 zizmor runs unconditionally; the others
  // only when a workflow / changed *.md is present — stubbing all three keeps the
  // maintainer-only-section assertions independent of the runner's installed tools.
  const stubBin = join(dir, '.stub-bin');
  mkdirSync(stubBin, { recursive: true });
  for (const tool of ['zizmor', 'actionlint', 'lychee']) {
    const p = join(stubBin, tool);
    writeFileSync(p, '#!/bin/sh\nexit 0\n');
    chmodSync(p, 0o755);
  }

  execSync('git init', { cwd: dir });
  execSync('git config user.email t@t.com', { cwd: dir });
  execSync('git config user.name Test', { cwd: dir });
  execSync('git config commit.gpgsign false', { cwd: dir });
  writeFileSync(join(dir, 'README.md'), 'base\n');
  execSync('git add -A', { cwd: dir });
  execSync('git commit -m "chore: base"', { cwd: dir });
  const baseSha = execSync('git rev-parse HEAD', { cwd: dir })
    .toString()
    .trim();

  return { dir, baseSha, hook: join(dir, 'packages/core/hooks/pre-push.ts') };
}

/** Add a plain consumer commit (no framework trailers — the trailer checks skip
 *  on a consumer, so none are required). Returns the new SHA. */
function addConsumerCommit(
  dir: string,
  file: string,
  content: string,
  subject: string,
): string {
  const p = join(dir, file);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  execSync(`git add "${file}"`, { cwd: dir });
  execSync(`git commit -m "${subject}"`, { cwd: dir });
  return execSync('git rev-parse HEAD', { cwd: dir }).toString().trim();
}

/** Add a CONSUMER capability commit: a dep-add to the root package.json with NO
 *  `Prior-art:` trailer. This is what §7 (prior-art) fires on — the exact shape a
 *  consumer produces when adding a dependency. Returns the new SHA. */
function addDepCommit(
  dir: string,
  dep: string,
  version: string,
  subject: string,
): string {
  writeFileSync(join(dir, 'package.json'), rootPkg({ [dep]: version }));
  execSync('git add package.json', { cwd: dir });
  execSync(`git commit -m "${subject}"`, { cwd: dir });
  return execSync('git rev-parse HEAD', { cwd: dir }).toString().trim();
}

/** Run the copied orchestrator exactly as .husky/pre-push does, with the base ref
 *  supplied via env (the documented override — avoids stdin plumbing). */
function runHook(
  dir: string,
  hook: string,
  baseRef: string,
): { status: number; stdout: string; stderr: string } {
  const stubBin = join(dir, '.stub-bin');
  const r = spawnSync('node', ['--import', TSX_LOADER, hook], {
    encoding: 'utf8',
    cwd: dir,
    env: {
      ...process.env,
      NODE_PATH: REAL_NODE_MODULES,
      PATH: `${stubBin}:${resolve(REAL_NODE_MODULES, '.bin')}:${process.env['PATH']}`,
      PREPUSH_UPSTREAM_REF: baseRef,
    },
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

describe('pre-push.ts — consumer-layout push shield (#920/#921)', () => {
  it('POSITIVE — maintainer-only paths absent → a real consumer push reaches exit 0', () => {
    const { dir, baseSha, hook } = makeConsumerSandbox();
    addConsumerCommit(dir, 'src/app.ts', 'export const x = 1;\n', 'feat: app');

    const r = runHook(dir, hook, baseSha);
    const out = `${r.stdout}\n${r.stderr}`;

    // Each blocker's hard-fail signature must be ABSENT (guards skipped the section).
    expect(out, out).not.toMatch(/No test files found/); // §3 self-test
    expect(out, out).not.toMatch(/ERR_MODULE_NOT_FOUND/); // §4 render / §6 spec
    expect(out, out).not.toMatch(/ENOENT/); // §5 meta-tests / manifest reads
    expect(out, out).not.toMatch(/pre-push hook crashed/); // §5 raw-ENOENT bubble
    // The shield reaches its clean exit.
    expect(r.status, out).toBe(0);
  });

  it('NEGATIVE — planting packages/core/package.json re-engages §5 (guard is load-bearing)', () => {
    const { dir, baseSha, hook } = makeConsumerSandbox();
    // Plant the ONE maintainer-only path §5 gates on, with a failing test script.
    writeFileSync(
      join(dir, 'packages/core/package.json'),
      JSON.stringify({
        name: 'core-fixture',
        private: true,
        // type:module so tsx still loads the hook (nested to packages/core/) as ESM —
        // the nearest package.json wins over the root; same loader concern as the root one.
        type: 'module',
        scripts: { 'test:principles': 'exit 1' },
      }),
    );
    addConsumerCommit(dir, 'src/app.ts', 'export const x = 1;\n', 'feat: app');

    const r = runHook(dir, hook, baseSha);
    const out = `${r.stdout}\n${r.stderr}`;

    // The guard is NOT dead code: with package.json present, §5 runs and its failure
    // blocks the push — proving `coreMetaTestsAvailable` genuinely gates the section.
    expect(r.status, out).toBe(1);
    expect(out).toMatch(/principles meta-tests failed/);
  });

  it('POSITIVE — a consumer capability commit (dep-add, no Prior-art trailer) still reaches exit 0 (§7/§1.7 skip; SSOT absent)', () => {
    const { dir, baseSha, hook } = makeConsumerSandbox();
    // A real consumer adding a dependency = a capability commit by the LOC/dep
    // detector — but it carries no `Prior-art:`/`§1.7` trailer (those are framework
    // authoring conventions). Without the isFrameworkRepo guard this would block.
    addDepCommit(dir, 'lodash', '^4.17.21', 'feat: add lodash');

    const r = runHook(dir, hook, baseSha);
    const out = `${r.stdout}\n${r.stderr}`;

    expect(out, out).not.toMatch(/Prior-art trailer missing or invalid/); // §7 skipped
    expect(out, out).not.toMatch(/§1\.7 trailer missing or invalid/); // §1.7 skipped
    expect(r.status, out).toBe(0);
  });

  it('NEGATIVE — planting the SSOT register re-engages §7 on the capability commit (isFrameworkRepo guard is load-bearing)', () => {
    const { dir, baseSha, hook } = makeConsumerSandbox();
    // Flip the framework-repo signal: the SSOT register now exists on disk.
    mkdirSync(join(dir, 'docs/meta-factory'), { recursive: true });
    writeFileSync(
      join(dir, 'docs/meta-factory/prior-art-evaluations.md'),
      '# Prior-art SSOT\n\n| ID | Capability | Verdict |\n|---|---|---|\n',
    );
    addDepCommit(dir, 'lodash', '^4.17.21', 'feat: add lodash');

    const r = runHook(dir, hook, baseSha);
    const out = `${r.stdout}\n${r.stderr}`;

    // With the SSOT present, §7 runs, sees a capability commit lacking a Prior-art
    // trailer, and blocks — proving `isFrameworkRepo` genuinely gates §7/§1.7.
    expect(r.status, out).toBe(1);
    expect(out).toMatch(/Prior-art trailer missing or invalid/);
  });

  it('POSITIVE — a force-added orchestrator-prompt still reaches exit 0 (§6 spec-validate skips; validator absent)', () => {
    const { dir, baseSha, hook } = makeConsumerSandbox();
    addConsumerCommit(
      dir,
      '.claude/orchestrator-prompts/x.md',
      '# spec\n',
      'chore: add prompt',
    );

    const r = runHook(dir, hook, baseSha);
    const out = `${r.stdout}\n${r.stderr}`;

    expect(out, out).not.toMatch(/ERR_MODULE_NOT_FOUND/); // §6 tsx would ERR if it ran
    expect(out, out).not.toMatch(/spec-validate findings/);
    expect(r.status, out).toBe(0);
  });

  it('NEGATIVE — planting the batch-spec validator re-engages §6 on the force-added prompt (guard is load-bearing)', () => {
    const { dir, baseSha, hook } = makeConsumerSandbox();
    // Plant the maintainer-only validator §6 gates on, as a stub that fails.
    mkdirSync(join(dir, 'packages/core/spec-validation'), { recursive: true });
    writeFileSync(
      join(dir, 'packages/core/spec-validation/validate-batch-spec.ts'),
      'process.exit(1);\n',
    );
    addConsumerCommit(
      dir,
      '.claude/orchestrator-prompts/x.md',
      '# spec\n',
      'chore: add prompt',
    );

    const r = runHook(dir, hook, baseSha);
    const out = `${r.stdout}\n${r.stderr}`;

    // With the validator present, §6 runs it and its non-zero exit blocks the push —
    // proving the §6 existsSync guard genuinely gates the section.
    expect(r.status, out).toBe(1);
    expect(out).toMatch(/spec-validate findings/);
  });
});
