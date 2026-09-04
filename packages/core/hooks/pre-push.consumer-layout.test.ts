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
 * S3 push-channel contract (F-push): the workflow-SECURITY/SYNTAX scanners (actionlint
 * §1, zizmor §2) are `owner: maintainer` — a consumer's OWN workflows are NOT scanned
 * for zizmor `unpinned-uses` at push, so a first push is never blocked on pre-existing
 * `@v6` action refs. The ci-tool-pinning unpinned-install gate is DIFFERENT: its WORKFLOW
 * population is `owner: both` (ci-tool-pinning.md §2 pop 1 — "scanned on every push,
 * framework and consumer repos alike"), so a consumer's own workflows ARE gated for
 * un-pinned bare `run: pip install` / `npm install -g` (narrow, §3 escape hatch); only
 * its SHELL-SCRIPT population (pop 2) is framework-only (within-body isFrameworkRepo
 * guard). External tools the consumer channel runs: lychee (§8, on *changed* Markdown)
 * plus the deterministic (no-tool) ci-tool-pinning workflow regex scan. The stubs below
 * (zizmor/actionlint/lychee → exit 0) keep the framework-layout arms hermetic; on the
 * consumer layout the SECURITY scanners are never composed but the pop-1 regex scan is.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { spawnSync, execSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  symlinkSync,
  chmodSync,
} from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
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

// Each case spawns `node --import tsx` against a real git fixture (and the
// TOOL-absence arms re-spawn under a stripped PATH), so the default 5s ceiling is
// too tight on a loaded CI box. Mirrors the SLOW_SHELL_MS convention in the
// principles hook tests (e.g. 20-bundle-classification.test.ts).
const SLOW_SHELL_MS = 30_000;

/**
 * Fixture teardown budget. A recursive rm removes the children `readdir` returned and
 * then `rmdir`s the parent; if ANY entry appears in between, `rmdir` fails ENOTEMPTY.
 * `force: true` does NOT cover that — per the Node 22 docs it only means "exceptions
 * will be ignored if `path` does not exist" (ENOENT). The retry knob is the documented
 * cover: `maxRetries` retries on «EBUSY, EMFILE, ENFILE, ENOTEMPTY, or EPERM … with a
 * linear backoff wait of retryDelay milliseconds longer on each try», default **0** —
 * i.e. stock `rmSync` makes exactly ONE `rmdir` attempt and rethrows
 * (`lib/internal/fs/rimraf.js`: `const tries = options.maxRetries + 1`).
 *
 * Worst case here is 50+100+150+200+250 = 750ms per directory — deliberately well
 * under vitest's 10s default `hookTimeout` (neither vitest.config.ts sets one) even
 * for the smoke case that registers two sandboxes.
 */
const CLEANUP_MAX_RETRIES = 5;
const CLEANUP_RETRY_DELAY_MS = 50;

/**
 * Remove a throwaway fixture tree — race-tolerant AND non-fatal.
 *
 * Two separate properties, both load-bearing (observed 2026-08-10: run 31375018780
 * reddened `pop-1 NEGATIVE` on an ENOTEMPTY rmdir of `.git/objects`, on a diff that
 * changed one markdown line — a teardown crash, not an assertion):
 *
 *  1. **Retry** narrows the window. This is a Node-side recursive-rm race (nodejs/node#54561,
 *     "[fs.rm] Reports ENOTEMPTY randomly"), not an un-reaped child of ours: every git
 *     invocation on this path is synchronous — `execSync` in the fixture builders above,
 *     and `spawnSync` inside the hook itself (`utils/run-check.ts:51`, the single funnel
 *     `utils/git.ts` routes all git I/O through) — so each is reaped before control
 *     returns here. There is no child left to await.
 *  2. **Tolerate** is the structural guarantee: teardown is hygiene, never an assertion,
 *     so it must not be able to fail a suite whose assertions all passed. Retrying alone
 *     lowers the probability; only the catch removes the failure mode. A leaked directory
 *     under `os.tmpdir()` is the strictly cheaper outcome, and swallowing here gates
 *     nothing — no check depends on the removal (`.claude/rules/attention-is-not-a-mechanism.md`
 *     §1 concerns load-bearing checks; this is not one).
 *
 * Keeping it non-throwing also stops one bad directory from stranding every LATER entry
 * in the caller's `splice(0)` loop.
 *
 * `rm` is injectable for the same reason `GitProvider` is (`utils/git.ts`): it lets the
 * teardown contract below be tested without racing a real filesystem.
 */
export function removeSandbox(dir: string, rm: typeof rmSync = rmSync): void {
  try {
    rm(dir, {
      recursive: true,
      force: true,
      maxRetries: CLEANUP_MAX_RETRIES,
      retryDelay: CLEANUP_RETRY_DELAY_MS,
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? String(err);
    console.warn(
      `⚠ fixture cleanup could not remove ${dir} (${code}) — tolerated, not fatal: ` +
        `teardown is hygiene, not an assertion. The tmpdir entry is leaked deliberately.`,
    );
  }
}

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) removeSandbox(d);
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

  // Stub the external tools (actionlint, zizmor, lychee) to exit 0 so the test is
  // hermetic. Post-S3 only lychee can run on a consumer (actionlint/zizmor are
  // maintainer-owned); the actionlint/zizmor stubs are exercised by the framework-
  // layout arms (SSOT-planted) — stubbing all three keeps every assertion independent
  // of whichever of these binaries happen to be installed on the runner.
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

/** Flip the framework-repo layout signal ON by planting the SSOT register. This is
 *  the SINGLE consumer/maintainer axis the S3 owner-split composes on: present →
 *  isFrameworkRepo === true → the `maintainer` owner-class sections compose. */
function plantSsotRegister(dir: string): void {
  mkdirSync(join(dir, 'docs/meta-factory'), { recursive: true });
  writeFileSync(
    join(dir, 'docs/meta-factory/prior-art-evaluations.md'),
    '# Prior-art SSOT\n\n| ID | Capability | Verdict |\n|---|---|---|\n',
  );
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

/**
 * Run the hook with a PATH that carries ONLY the binaries the hook legitimately
 * needs to run (node + git, symlinked into a fresh allowlist dir) plus the repo's
 * node_modules/.bin — deliberately EXCLUDING the workflow-security scanners
 * (zizmor, actionlint) and lychee wherever the runner happens to install them.
 * This simulates a consumer/CI box that never installed the optional scanners, so
 * the TOOL-ABSENCE axis (#923 follow-up) is exercised rather than the runner's luck.
 *
 * `presentStubs` optionally seeds exit-0 stubs into the allowlist dir for tools that
 * SHOULD be present — used to make §1 actionlint pass so execution reaches §2 zizmor
 * (otherwise §1 dies first and §2's onMissing wiring is never exercised).
 */
function runHookStrippedTools(
  dir: string,
  hook: string,
  baseRef: string,
  presentStubs: readonly string[] = [],
): { status: number; stdout: string; stderr: string } {
  const toolsBin = join(dir, '.tools-bin');
  mkdirSync(toolsBin, { recursive: true });
  symlinkSync(process.execPath, join(toolsBin, 'node'));
  const gitPath = execSync('command -v git').toString().trim();
  symlinkSync(gitPath, join(toolsBin, 'git'));
  for (const tool of presentStubs) {
    const p = join(toolsBin, tool);
    writeFileSync(p, '#!/bin/sh\nexit 0\n');
    chmodSync(p, 0o755);
  }

  const r = spawnSync('node', ['--import', TSX_LOADER, hook], {
    encoding: 'utf8',
    cwd: dir,
    env: {
      ...process.env,
      NODE_PATH: REAL_NODE_MODULES,
      PATH: `${toolsBin}:${resolve(REAL_NODE_MODULES, '.bin')}`,
      PREPUSH_UPSTREAM_REF: baseRef,
    },
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

/** Minimal workflow file body (contents irrelevant — the scanners are absent); the
 *  file's mere presence flips §1/§2's `workflows.length > 0` guard on. Shared by the
 *  addConsumerCommit calls that plant a workflow (no separate pre-write needed —
 *  addConsumerCommit writes + commits this same path). */
const WORKFLOW_YML =
  'name: ci\non: [push]\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps: [{ run: "true" }]\n';

describe(
  'pre-push.ts — consumer-layout push shield (#920/#921)',
  { timeout: SLOW_SHELL_MS },
  () => {
    it('POSITIVE — maintainer-only paths absent → a real consumer push reaches exit 0', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      addConsumerCommit(
        dir,
        'src/app.ts',
        'export const x = 1;\n',
        'feat: app',
      );

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

    // ── S3 owner-split: the LAYOUT signal (SSOT presence), not per-section existsSync,
    //    is what gates a maintainer section. This paired arm isolates that: a failing
    //    packages/core/package.json is present in BOTH arms; only the SSOT differs.
    const failingCorePkg = JSON.stringify({
      name: 'core-fixture',
      private: true,
      // type:module so tsx still loads the hook (nested to packages/core/) as ESM —
      // the nearest package.json wins over the root; same loader concern as the root one.
      type: 'module',
      scripts: { 'test:principles': 'exit 1' },
    });

    it('S3 owner-split POSITIVE — consumer layout: a FAILING packages/core/package.json is present but §5 (maintainer) is NOT composed → push reaches exit 0 (owner, not existsSync, gates)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      // The §5 trigger file is present AND would fail if run — but the SSOT register is
      // absent, so the layout is `consumer` and the maintainer-owned §5 is never composed.
      writeFileSync(join(dir, 'packages/core/package.json'), failingCorePkg);
      addConsumerCommit(
        dir,
        'src/app.ts',
        'export const x = 1;\n',
        'feat: app',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      // Pre-S3 (per-section existsSync) this planted file would RE-ENGAGE §5 and block.
      // Post-S3 owner-composition excludes it on a consumer layout → the section is not run.
      expect(out, out).not.toMatch(/principles meta-tests failed/);
      expect(r.status, out).toBe(0);
    });

    it('S3 owner-split NEGATIVE — maintainer layout (SSOT planted): §5 IS composed and its failure blocks the push (owner-composition is load-bearing)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      // Flip the ONLY thing that differs from the arm above: the SSOT register → the
      // layout becomes `maintainer`, so the maintainer-owned §5 composes and runs.
      plantSsotRegister(dir);
      writeFileSync(join(dir, 'packages/core/package.json'), failingCorePkg);
      addConsumerCommit(
        dir,
        'src/app.ts',
        'export const x = 1;\n',
        'feat: app',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      // §5 now runs and its failing test:principles blocks — proving the section is live
      // code composed by the maintainer layout, not dead/always-skip.
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

    it('S3 owner-split NEGATIVE — maintainer layout (SSOT planted): §6 IS composed and the failing batch-spec validator blocks the force-added prompt', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      // Flip the layout to `maintainer` so the maintainer-owned §6 composes; then plant
      // the validator it gates on (a stub that fails) + the force-added orchestrator-prompt.
      plantSsotRegister(dir);
      mkdirSync(join(dir, 'packages/core/spec-validation'), {
        recursive: true,
      });
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

    // ── S3 push-channel contract — F-push adjudication (SECURITY scanners not on the
    //    consumer channel) ────────────────────────────────────────────────────────
    // S1 finding F-push (R3 ky): the consumer pre-push ran a FULL zizmor audit over the
    // consumer's OWN `.github/workflows/*.yml` and hard-blocked their FIRST `git push`
    // on pre-existing `@v6` action refs. The S3 contract makes actionlint/zizmor
    // `owner: maintainer` — NOT gated on a consumer. These arms lock that in: the
    // SECURITY scanners must NOT run on the consumer layout, so a consumer's own
    // workflows — even ones a PRESENT scanner would reject — never block.
    // NOTE: this is the zizmor `unpinned-uses` (@v6) surface ONLY. The ci-tool-pinning
    // unpinned-install regex gate is DISTINCT and stays `owner: both` on its WORKFLOW
    // population (ci-tool-pinning.md §2 pop 1) — see the dedicated pop-1 arms further down.

    it('P0.1b — consumer with NO .github/workflows/ + scanners absent → exit 0 (workflow scanners not composed on a consumer)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      // No workflow dir at all (the CI-less consumer). Scanners stripped from PATH.
      addConsumerCommit(
        dir,
        'src/app.ts',
        'export const x = 1;\n',
        'feat: app',
      );

      const r = runHookStrippedTools(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      // actionlint/zizmor are maintainer-owned → not composed on a consumer → never
      // invoked, so neither a notFound death nor a DEGRADED line can appear.
      expect(out, out).not.toMatch(/zizmor not found in PATH/);
      expect(out, out).not.toMatch(/DEGRADED/);
      expect(r.status, out).toBe(0);
    });

    it('P0.1c (F-push) — consumer WITH a pre-existing unpinned workflow + zizmor PRESENT and REJECTING it → push still reaches exit 0 (the scanner is not composed on a consumer)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      // Make the consumer's zizmor/actionlint stubs REJECT (exit 1) — i.e. an installed
      // scanner that WOULD block, mimicking real `unpinned-uses` findings on `@v6`. This
      // is the exact F-push shape (S1 R3 ky). Pre-S3 (owner: both) the consumer layout
      // composed zizmor → the failing stub → die → exit 1 (the RED this arm pins). Post-S3
      // (owner: maintainer) the scanner is not composed on a consumer → never invoked.
      const stubBin = join(dir, '.stub-bin');
      for (const tool of ['zizmor', 'actionlint']) {
        writeFileSync(
          join(stubBin, tool),
          '#!/bin/sh\necho "findings"\nexit 1\n',
        );
        chmodSync(join(stubBin, tool), 0o755);
      }
      // A consumer's own pre-existing workflow with an UNPINNED action ref (`@v6`).
      addConsumerCommit(
        dir,
        '.github/workflows/ci.yml',
        'name: ci\non: [push]\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/setup-node@v6\n',
        'ci: add workflow',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      // The rejecting scanner must NOT have run: no findings surfaced, no block.
      expect(out, out).not.toMatch(/findings/);
      expect(out, out).not.toMatch(/reported problems/);
      expect(out, out).not.toMatch(/unpinned/);
      // Clean-tree consumer push is ALLOWED (RULES.md "Push channel — thin by contract").
      expect(r.status, out).toBe(0);
    });

    it('P0.1c — FRAMEWORK layout (SSOT present) WITH a workflow + scanners absent → fail-closed (nonzero, die not DEGRADE)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      // Flip the framework-repo signal: the SSOT register exists → onMissing = 'die'.
      mkdirSync(join(dir, 'docs/meta-factory'), { recursive: true });
      writeFileSync(
        join(dir, 'docs/meta-factory/prior-art-evaluations.md'),
        '# Prior-art SSOT\n\n| ID | Capability | Verdict |\n|---|---|---|\n',
      );
      addConsumerCommit(
        dir,
        '.github/workflows/ci.yml',
        WORKFLOW_YML,
        'ci: add workflow',
      );

      const r = runHookStrippedTools(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      // ci-tool-pinning discipline preserved: on the framework repo a missing workflow
      // linter is a hard fail (die), NOT a soft DEGRADE. §1 actionlint dies first here.
      expect(r.status, out).toBe(1);
      expect(out, out).toMatch(/actionlint not found in PATH/);
      expect(out, out).not.toMatch(/DEGRADED/);
    });

    it('P0.1c — FRAMEWORK layout, actionlint present+passing, zizmor absent → §2 zizmor fail-closed (nonzero, die not DEGRADE)', () => {
      // Distinct from the arm above: there §1 actionlint dies FIRST, so §2 zizmor's
      // onMissing='die' wiring is never reached. Here actionlint is stubbed present+
      // passing so execution flows past §1 into §2 — proving the zizmor requireTool
      // call actually carries onMissingTool='die' in the framework layout (a wrong 5th
      // arg on that call would let this arm DEGRADE and exit 0, reddening the suite).
      const { dir, baseSha, hook } = makeConsumerSandbox();
      mkdirSync(join(dir, 'docs/meta-factory'), { recursive: true });
      writeFileSync(
        join(dir, 'docs/meta-factory/prior-art-evaluations.md'),
        '# Prior-art SSOT\n\n| ID | Capability | Verdict |\n|---|---|---|\n',
      );
      addConsumerCommit(
        dir,
        '.github/workflows/ci.yml',
        WORKFLOW_YML,
        'ci: add workflow',
      );

      const r = runHookStrippedTools(dir, hook, baseSha, ['actionlint']);
      const out = `${r.stdout}\n${r.stderr}`;

      // §1 actionlint passed (stubbed exit 0); §2 zizmor is absent → die, NOT DEGRADE.
      expect(r.status, out).toBe(1);
      expect(out, out).toMatch(/zizmor not found in PATH/);
      expect(out, out).not.toMatch(/DEGRADED/);
    });

    // ── ci-tool-pinning §2 WORKFLOW population (pop 1) — owner:'both', gated on a
    //    consumer (rework-round finding) ───────────────────────────────────────────
    // ci-tool-pinning.md §2 pop 1: `.github/workflows/*.yml` is "Scanned on every push,
    // framework and consumer repos alike, via workflowYmlFiles()". Only pop 2 (shell
    // scripts) is framework-only. The first S3 draft over-reached by tagging the whole
    // unpinned-install section owner:'maintainer', silently dropping pop-1 enforcement
    // from every consumer push — corrected to owner:'both'. These arms lock pop-1 back
    // ON for consumers. RED under the buggy owner:'maintainer' (exit 0, gate not
    // composed); GREEN (this expected exit 1) under the corrected owner:'both'.

    it('pop-1 NEGATIVE (F-finding) — CONSUMER layout, workflow with an UNPINNED bare `run: pip install` → ci-tool-pinning Rule A FIRES on the consumer (exit 1)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      // A consumer's own workflow carrying an un-pinned bare tool install (pop 1). This
      // is DISTINCT from the F-push @v6 `uses:` case (that is zizmor, maintainer-only).
      addConsumerCommit(
        dir,
        '.github/workflows/ci.yml',
        'name: ci\non: [push]\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pip install pyyaml\n',
        'ci: add workflow',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      // The workflow-population gate must run on the consumer and block the un-pinned install.
      expect(r.status, out).toBe(1);
      expect(out, out).toMatch(/Unpinned bare-run tool install/);
      expect(out, out).toMatch(/ci\.yml:7: - run: pip install pyyaml/);
    });

    it('pop-1 POSITIVE — CONSUMER layout, workflow with a PINNED install → exit 0 (gate is not always-failing)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      addConsumerCommit(
        dir,
        '.github/workflows/ci.yml',
        'name: ci\non: [push]\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pip install pyyaml==6.0.2\n',
        'ci: add workflow',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      expect(out, out).not.toMatch(/Unpinned bare-run tool install/);
      expect(r.status, out).toBe(0);
    });

    it('pop-1 escape-hatch — CONSUMER layout, unpinned install carrying `# ci-tool-pin: allow` → exit 0 (§3 hatch honoured on a consumer)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      addConsumerCommit(
        dir,
        '.github/workflows/ci.yml',
        'name: ci\non: [push]\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pip install pyyaml  # ci-tool-pin: allow no stable release\n',
        'ci: add workflow',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      expect(out, out).not.toMatch(/Unpinned bare-run tool install/);
      expect(r.status, out).toBe(0);
    });

    // ── S2 §3 binding pair — Part 1 narrowing live + gate still catches consumer-side leaks ──
    // S2 (getff-honest-signals) §3 binding contract: "a consumer-clean diff PLUS a shipped
    // file carrying a dangling framework ref → push passes" (PRIMARY, POSITIVE arm) AND
    // "Add coverage that the section still fails when the consumer's own changed markdown
    // has a real dangling link — otherwise part 1 has silently disabled the gate, which is
    // this umbrella's defect class wearing the opposite mask." (SECONDARY, NEGATIVE arm).
    // T-HS-A: assert EXIT CODE first, message wording second.

    it('S2 §3 PRIMARY (POSITIVE) — CONSUMER-clean diff + SHIPPED file with a dangling framework ref → §8 narrows to consumer-authored only → push passes (exit 0)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      // Override the consumer-sandbox's exit-0 lychee stub to REJECT if and only if a
      // framework-shipped file reaches its argv. Mimics a real shipped markdown carrying
      // a framework-internal ref that resolves in this repo but dangles in a consumer
      // checkout (the getff-honest-signals defect class). With Part 1 narrowing live,
      // §8 excludes AGENTS.md before invoking lychee → lychee sees only the clean
      // consumer file → exit 0. Without Part 1, lycheee would receive AGENTS.md and
      // reject → §8 would die. The stub differentiates the two states deterministically.
      const stubBin = join(dir, '.stub-bin');
      writeFileSync(
        join(stubBin, 'lychee'),
        '#!/bin/sh\nfor a in "$@"; do\n' +
          '  case "$a" in\n' +
          '    --offline|--no-progress) ;;\n' +
          // FRAMEWORK_SHIPPED_MD_PREFIXES (mirror of pre-push.ts) — these are the paths
          // Part 1 must exclude. If any reaches lychee's argv, REJECT to surface a
          // narrowing regression (T7/T14 — skip-reported-as-green is the trap this stub
          // exists to catch: a stub that always exit-0 cannot distinguish narrowed from
          // un-narrowed, so the §3 POSITIVE shape becomes a tautology).
          '    AGENTS.md|.claude/agents/*|.claude/skills/*|.ai-factory/*|.claude/session-bootstrap.md)' +
          '      echo "✗ would-block-shipped: $a"; exit 1 ;;\n' +
          '  esac\n' +
          'done\n' +
          'exit 0\n',
      );
      chmodSync(join(stubBin, 'lychee'), 0o755);

      // A SHIPPED file (AGENTS.md is the canonical framework-shipped top-level starter,
      // 30-templates.sh:81) carrying a dangling framework-internal ref — the exact shape
      // that blocked a consumer's first push before Part 1.
      addConsumerCommit(
        dir,
        'AGENTS.md',
        '# Agents\n\n[dangling-framework-ref](docs/meta-factory/nonexistent.md)\n',
        'agents: framework-shipped starter with a dangling framework ref',
      );
      // A CONSUMER-clean changed markdown file — what the consumer actually authored.
      addConsumerCommit(
        dir,
        'docs/consumer-page.md',
        '# Page\n\n[valid](./README.md)\n',
        'docs: add a consumer page with a valid link',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      // §3 PRIMARY binding (T-HS-A): exit code FIRST, wording second. exit 0 = narrowing
      // excluded the shipped file → consumer push not blocked by our shipped content.
      expect(r.status, out).toBe(0);
      // The narrowing diagnostic surfaces in §8's output (count of excluded files).
      expect(out, out).toMatch(/excluded 1 framework-shipped \*\.md/);
      // The shipped file must NOT have been passed to lychee (the stub's reject arm).
      expect(out, out).not.toMatch(/would-block-shipped: AGENTS\.md/);
    });

    it('S2 §3 SECONDARY (NEGATIVE) — CONSUMER-owned markdown with a real broken link + lychee REJECTS → §8 lycheeSection blocks (gate is live, not silently disabled)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      // Override the consumer-sandbox's exit-0 lychee stub to REJECT — mimics a real
      // dangling link in a consumer-authored file. The §8 lycheeSection shells out to
      // this binary; its non-zero exit + stderr bubbles via die().
      const stubBin = join(dir, '.stub-bin');
      writeFileSync(
        join(stubBin, 'lychee'),
        '#!/bin/sh\necho "✗ bad-link-in-consumer-file.md: broken link"\nexit 1\n',
      );
      chmodSync(join(stubBin, 'lychee'), 0o755);
      // A CONSUMER's OWN markdown file (NOT framework-shipped — it lives at the
      // consumer's own docs/ path, never touched by install.sh's copy-list). The §8
      // walk covers all changed *.md regardless of owner; this one would trip a real
      // offline lychee run.
      addConsumerCommit(
        dir,
        'docs/consumer-page.md',
        '# Page\n\n[broken](./does-not-exist.md)\n',
        'docs: add a page with a broken link',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      // §3 binding (T-HS-A): exit code FIRST, wording second. exit 1 = gate lived.
      expect(r.status, out).toBe(1);
      expect(out, out).toMatch(/bad-link-in-consumer-file\.md/);
      expect(out, out).toMatch(/lychee found broken links/);
    });

    // ── §8 plugin/agents twin exclusion (PR #1574 follow-up) ───────────────────
    // plugin/agents/*.md are byte-identical copies of agents/*.md one directory
    // DEEPER, so every relative link in them resolves to a non-existent plugin/… path
    // while the same link is correct at the source. Both arms run on a MAINTAINER
    // layout (SSOT planted) — that is where plugin/agents/ exists at all, and where
    // the S2 Part 1 narrowing above deliberately does NOT fire, so nothing else can
    // account for the exclusion.

    it('§8 twin-exclusion POSITIVE — a changed plugin/agents twin never reaches lychee argv (maintainer layout)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      plantSsotRegister(dir);
      // REJECT if and only if a plugin/agents path reaches argv. A blanket exit-0 stub
      // could not tell "excluded" from "passed and happened to be clean" — the T7/T14
      // skip-reported-as-green trap this shape exists to avoid.
      const stubBin = join(dir, '.stub-bin');
      writeFileSync(
        join(stubBin, 'lychee'),
        '#!/bin/sh\nfor a in "$@"; do\n' +
          '  case "$a" in\n' +
          '    plugin/agents/*) echo "✗ would-check-twin: $a"; exit 1 ;;\n' +
          '  esac\n' +
          'done\n' +
          'exit 0\n',
      );
      chmodSync(join(stubBin, 'lychee'), 0o755);
      addConsumerCommit(
        dir,
        'plugin/agents/twin.md',
        '# twin\n\n[rule](../.claude/rules/no-paid-llm-in-ci.md)\n',
        'chore: sync agent twin',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      // Deliberately NOT asserting exit 0. A maintainer layout composes every
      // maintainer-owned section, and this fixture trips unrelated ones (e.g. the
      // always-on budget gate) — binding to the process exit code would encode "no
      // other section fails in this sandbox", which is not the claim under test. The
      // three assertions below are exactly the §8 claim: the twin was dropped BEFORE
      // the shell-out (the stub's reject arm never fired), the narrowing announced
      // itself, and §8 itself did not die.
      expect(out, out).not.toMatch(/would-check-twin/);
      expect(out, out).toMatch(/excluded 1 plugin\/agents twin/);
      expect(out, out).not.toMatch(/lychee found broken links/);
    });

    it('§8 twin-exclusion NEGATIVE — the agents/ SOURCE is still walked and a broken link there still blocks (exclusion is scoped, not a hole)', () => {
      const { dir, baseSha, hook } = makeConsumerSandbox();
      plantSsotRegister(dir);
      // REJECT if and only if an agents/ (non-plugin) path reaches argv. If the new
      // filter were written as a substring match on "agents/" it would swallow the
      // source too and this arm would go green-by-omission — that is the regression
      // this arm exists to catch.
      const stubBin = join(dir, '.stub-bin');
      writeFileSync(
        join(stubBin, 'lychee'),
        '#!/bin/sh\nfor a in "$@"; do\n' +
          '  case "$a" in\n' +
          '    plugin/*) ;;\n' +
          '    agents/*) echo "✗ source-still-checked: $a"; exit 1 ;;\n' +
          '  esac\n' +
          'done\n' +
          'exit 0\n',
      );
      chmodSync(join(stubBin, 'lychee'), 0o755);
      addConsumerCommit(
        dir,
        'agents/source.md',
        '# source\n\n[broken](./does-not-exist.md)\n',
        'docs: agent source with a broken link',
      );

      const r = runHook(dir, hook, baseSha);
      const out = `${r.stdout}\n${r.stderr}`;

      expect(r.status, out).toBe(1);
      expect(out, out).toMatch(/source-still-checked: agents\/source\.md/);
      expect(out, out).toMatch(/lychee found broken links/);
    });

    // ── S3 deliverable 2: consumer-topology smoke ──────────────────────────────
    // The kickoff's explicit smoke: a tmp repo whose default branch is `main`, only the
    // consumer copy-list installed (no maintainer packages/core parts, no SSOT register),
    // a benign commit, executing the shipped pre-push main() → exit 0. Unlike the cases
    // above it uses NO PREPUSH_UPSTREAM_REF override and NO piped git stdin, so it
    // exercises the REAL default-branch resolution path (resolveDefaultBase → origin/main
    // via origin/HEAD) end-to-end — the path a fresh consumer's first `git push` takes.
    it('S3 smoke — consumer default-branch `main`, no maintainer packages/core, benign commit → shipped main() reaches exit 0', () => {
      const dir = mkdtempSync(join(tmpdir(), 'prepush-smoke-'));
      sandboxes.push(dir);

      // Consumer copy-list only (install.sh:343-367 shape): hooks + eslint-rules.
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
      writeFileSync(join(dir, 'package.json'), rootPkg({}));

      // Consumer-appropriate external tools stubbed exit 0 (hermetic).
      const stubBin = join(dir, '.stub-bin');
      mkdirSync(stubBin, { recursive: true });
      for (const tool of ['zizmor', 'actionlint', 'lychee']) {
        const p = join(stubBin, tool);
        writeFileSync(p, '#!/bin/sh\nexit 0\n');
        chmodSync(p, 0o755);
      }

      // Default branch = main (the kickoff requirement), a bare `origin`, and
      // origin/HEAD → origin/main so resolveDefaultBase resolves without any override.
      execSync('git init -b main', { cwd: dir });
      execSync('git config user.email t@t.com', { cwd: dir });
      execSync('git config user.name Test', { cwd: dir });
      execSync('git config commit.gpgsign false', { cwd: dir });
      writeFileSync(join(dir, 'README.md'), 'base\n');
      execSync('git add -A', { cwd: dir });
      execSync('git commit -m "chore: base"', { cwd: dir });

      const remote = mkdtempSync(join(tmpdir(), 'prepush-smoke-remote-'));
      sandboxes.push(remote);
      execSync('git init --bare -b main', { cwd: remote });
      execSync(`git remote add origin "${remote}"`, { cwd: dir });
      execSync('git push -u origin main', { cwd: dir });
      execSync('git remote set-head origin main', { cwd: dir });

      // A benign consumer commit ahead of origin/main — the range main()'s base-scoped
      // sections (§8 lychee, etc.) diff over.
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(join(dir, 'src/app.ts'), 'export const x = 1;\n');
      execSync('git add -A', { cwd: dir });
      execSync('git commit -m "feat: app"', { cwd: dir });

      // Run the shipped hook exactly as the dispatcher does, but with NEITHER
      // PREPUSH_UPSTREAM_REF NOR piped stdin → the default-branch resolver must find
      // origin/main on its own. `input: ''` closes stdin so readPushStdin() sees EOF.
      const hook = join(dir, 'packages/core/hooks/pre-push.ts');
      const r = spawnSync('node', ['--import', TSX_LOADER, hook], {
        encoding: 'utf8',
        cwd: dir,
        input: '',
        env: {
          ...process.env,
          NODE_PATH: REAL_NODE_MODULES,
          PATH: `${stubBin}:${resolve(REAL_NODE_MODULES, '.bin')}:${process.env['PATH']}`,
        },
      });
      const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;

      // No maintainer-only section leaked onto the consumer default-branch push.
      expect(out, out).not.toMatch(/No test files found/);
      expect(out, out).not.toMatch(/ERR_MODULE_NOT_FOUND/);
      expect(out, out).not.toMatch(/ENOENT/);
      expect(out, out).not.toMatch(/pre-push hook crashed/);
      // Not a silent-skip either: the resolver found the default branch (no warnSkip).
      expect(out, out).not.toMatch(/could not determine a base ref/);
      expect(r.status ?? -1, out).toBe(0);
    });

    // ── rule-tests-surface S5: generated-rule-material guarded arm ──────────────
    // The standing consumer channel for hash-exempt sidecar rule-test material (spec §2). Paired
    // negative (testing.md): POSITIVE = the lane tool is ABSENT → a LOUD skip line + exit 0 (a
    // silent green would be the failure); NEGATIVE = the tool is PRESENT and the material is
    // BROKEN (a bad[] sample that does NOT fire) → exit 1 RED. Exercised via the PREPUSH_ONLY
    // isolation seam so the arm is tested independent of the other sections' tools/deps.

    /** Seed the S5 fixtures into a consumer sandbox: the delivered firing runner at scripts/, one
     *  delivered astgrep rule config under .getff/, and an astgrep sidecar with the given samples. */
    function seedRuleTestsFixture(
      dir: string,
      bad: string[],
      good: string[],
    ): void {
      mkdirSync(join(dir, 'scripts'), { recursive: true });
      cpSync(
        resolve(
          REPO_ROOT,
          'packages/core/synthesizer/run-rule-tests-firing.sh',
        ),
        join(dir, 'scripts/run-rule-tests-firing.sh'),
      );
      chmodSync(join(dir, 'scripts/run-rule-tests-firing.sh'), 0o755);
      mkdirSync(join(dir, '.getff/astgrep-rules'), { recursive: true });
      cpSync(
        resolve(
          REPO_ROOT,
          'packages/core/synthesizer/fixtures/live-generation/firing/rules/getff-researched-no-yaml-load.yml',
        ),
        join(dir, '.getff/astgrep-rules/getff-researched-no-yaml-load.yml'),
      );
      mkdirSync(join(dir, '.ai-factory/rule-tests'), { recursive: true });
      writeFileSync(
        join(dir, '.ai-factory/rule-tests/astgrep.json'),
        `${JSON.stringify(
          { 'getff-researched-no-yaml-load': { bad, good } },
          null,
          2,
        )}\n`,
      );
    }

    /** Run ONLY the generated-rule-material section via the PREPUSH_ONLY seam. `strip` builds a
     *  PATH with just node+git (no lane tool, no bash) to exercise the TOOL-ABSENCE axis. `env`
     *  merges extra vars (e.g. GETFF_PREPUSH_CARGO_FIRE=1). */
    function runMaterialSection(
      dir: string,
      hook: string,
      { strip, env = {} }: { strip: boolean; env?: Record<string, string> },
    ): { status: number; stdout: string; stderr: string } {
      let PATH: string;
      if (strip) {
        const only = join(dir, '.only-bin');
        mkdirSync(only, { recursive: true });
        symlinkSync(process.execPath, join(only, 'node'));
        symlinkSync(
          execSync('command -v git').toString().trim(),
          join(only, 'git'),
        );
        // the lane tool (and bash) deliberately absent: with the tool gone the section loud-skips
        // BEFORE it would ever shell to bash — that early skip is the property under test.
        PATH = `${only}:${resolve(REAL_NODE_MODULES, '.bin')}`;
      } else {
        PATH = `${resolve(REAL_NODE_MODULES, '.bin')}:${process.env['PATH']}`;
      }
      const r = spawnSync('node', ['--import', TSX_LOADER, hook], {
        encoding: 'utf8',
        cwd: dir,
        input: '',
        env: {
          ...process.env,
          NODE_PATH: REAL_NODE_MODULES,
          PATH,
          PREPUSH_ONLY: 'generated-rule-material',
          ...env,
        },
      });
      return {
        status: r.status ?? -1,
        stdout: r.stdout ?? '',
        stderr: r.stderr ?? '',
      };
    }

    /** Copy the delivered firing runner into a consumer sandbox's scripts/ (all lanes share it). */
    function seedFiringRunner(dir: string): void {
      mkdirSync(join(dir, 'scripts'), { recursive: true });
      cpSync(
        resolve(
          REPO_ROOT,
          'packages/core/synthesizer/run-rule-tests-firing.sh',
        ),
        join(dir, 'scripts/run-rule-tests-firing.sh'),
      );
      chmodSync(join(dir, 'scripts/run-rule-tests-firing.sh'), 0o755);
    }

    /** Seed the ruff lane: the delivered-shape .getff/ruff-bans.toml (banning `requests` under
     *  TID251, mirroring render-ruff.ts / setup.d/45-python.sh) + a TID251-keyed sidecar. */
    function seedRuffFixture(dir: string, bad: string[], good: string[]): void {
      seedFiringRunner(dir);
      mkdirSync(join(dir, '.getff'), { recursive: true });
      writeFileSync(
        join(dir, '.getff/ruff-bans.toml'),
        '# generated by getff ruff backend v0 — do not edit by hand\n' +
          '[lint]\n' +
          'select = ["TID251", "TID253"]\n\n' +
          '[lint.flake8-tidy-imports.banned-api]\n' +
          '"requests".msg = "Use httpx, not the requests library"\n',
      );
      mkdirSync(join(dir, '.ai-factory/rule-tests'), { recursive: true });
      writeFileSync(
        join(dir, '.ai-factory/rule-tests/ruff.json'),
        `${JSON.stringify({ TID251: { bad, good } }, null, 2)}\n`,
      );
    }

    /** Seed a valid cargo sidecar (shape-valid; no clippy config — the toggle/skip tests never
     *  compile). */
    function seedCargoFixture(dir: string): void {
      seedFiringRunner(dir);
      mkdirSync(join(dir, '.ai-factory/rule-tests'), { recursive: true });
      writeFileSync(
        join(dir, '.ai-factory/rule-tests/cargo.json'),
        `${JSON.stringify(
          {
            'no-mem-forget': {
              bad: ['fn f(){ std::mem::forget(x); }'],
              good: ['fn f(){ drop(x); }'],
            },
          },
          null,
          2,
        )}\n`,
      );
    }

    const hasRuff =
      !spawnSync('ruff', ['--version']).error ||
      !spawnSync('uvx', ['--version']).error;

    // Does this runner have ast-grep? The NEGATIVE RED path needs it present; CI installs the
    // pinned ast-grep before test:hooks. A box without it green-skips (never a false GREEN).
    const hasAstGrep =
      !spawnSync('ast-grep', ['--version']).error ||
      !spawnSync('sg', ['--version']).error;

    it('S5 POSITIVE — astgrep sidecar present, lane tool ABSENT → LOUD skip + exit 0 (NOT a silent green)', () => {
      const { dir, hook } = makeConsumerSandbox();
      // Sound material (would fire if ast-grep were present); the point is the tool is absent.
      seedRuleTestsFixture(
        dir,
        ['import yaml\ndata = yaml.load(raw)\n'],
        ['import yaml\ndata = yaml.safe_load(raw)\n'],
      );

      const r = runMaterialSection(dir, hook, { strip: true });
      const out = `${r.stdout}\n${r.stderr}`;

      // Loud DEGRADE, never silent: the honesty wording family + "NOT green".
      expect(out, out).toMatch(/DEGRADED: astgrep lane tool not found/);
      expect(out, out).toMatch(/a skipped check is NOT green/);
      // A skip must NOT block the push.
      expect(r.status, out).toBe(0);
    });

    it.skipIf(!hasAstGrep)(
      'S5 NEGATIVE — astgrep sidecar with BROKEN material (a bad[] sample that does not fire) + tool PRESENT → exit 1 RED',
      () => {
        const { dir, hook } = makeConsumerSandbox();
        // BROKEN: the bad[] sample is actually clean Python (safe_load) — the rule is blind to it,
        // so the standing arm MUST reject it. good[] stays conforming.
        seedRuleTestsFixture(
          dir,
          ['import yaml\ndata = yaml.safe_load(raw)\n'],
          ['import yaml\ndata = yaml.safe_load(raw)\n'],
        );

        const r = runMaterialSection(dir, hook, { strip: false });
        const out = `${r.stdout}\n${r.stderr}`;

        expect(r.status, out).toBe(1);
        expect(out, out).toMatch(
          /rule-test firing failed|bad sample did NOT fire/,
        );
      },
    );

    it.skipIf(!hasAstGrep)(
      'S5 NEGATIVE-guard GREEN — same layout with SOUND material + tool present → exit 0 (the arm is not always-red)',
      () => {
        const { dir, hook } = makeConsumerSandbox();
        seedRuleTestsFixture(
          dir,
          ['import yaml\ndata = yaml.load(raw)\n'],
          ['import yaml\ndata = yaml.safe_load(raw)\n'],
        );

        const r = runMaterialSection(dir, hook, { strip: false });
        const out = `${r.stdout}\n${r.stderr}`;

        expect(out, out).toMatch(/bad sample fired RED/);
        expect(r.status, out).toBe(0);
      },
    );

    // BLOCKER regression: a corrupt sidecar must be BROKEN MATERIAL (RED), not a silent green.
    // Runs UNGUARDED (strip:true, no lane tool) — the JSON validity check must fire before, and
    // independent of, tool presence. Without the up-front guard the runner reads zero samples
    // from the unparseable file and the push sails through green.
    it('S5 BLOCKER — corrupt sidecar JSON → exit 1 RED (no lane tool needed)', () => {
      const { dir, hook } = makeConsumerSandbox();
      seedRuleTestsFixture(
        dir,
        ['import yaml\ndata = yaml.load(raw)\n'],
        ['import yaml\ndata = yaml.safe_load(raw)\n'],
      );
      // Corrupt the sidecar AFTER seeding (invalid JSON).
      writeFileSync(
        join(dir, '.ai-factory/rule-tests/astgrep.json'),
        '{ this is : not valid json ]\n',
      );

      const r = runMaterialSection(dir, hook, { strip: true });
      const out = `${r.stdout}\n${r.stderr}`;

      expect(r.status, out).toBe(1);
      expect(out, out).toMatch(/not valid rule-test material/);
      expect(out, out).toMatch(/not valid JSON/);
    });

    // BLOCKER (whole-work): SHAPE, not just parse. A field typo (`badd`) or an empty `bad[]` is
    // valid JSON but yields zero samples → the runner would end green. The up-front shape probe
    // (mirror of the S2 loader) must RED both, UNGUARDED (no lane tool).
    it("S5 BLOCKER-shape (a) — typo'd key `badd` → exit 1 RED (no lane tool needed)", () => {
      const { dir, hook } = makeConsumerSandbox();
      seedRuleTestsFixture(dir, ['x'], ['y']);
      writeFileSync(
        join(dir, '.ai-factory/rule-tests/astgrep.json'),
        JSON.stringify({
          'getff-researched-no-yaml-load': {
            badd: ['import yaml\ndata = yaml.load(raw)\n'],
            good: ['import yaml\ndata = yaml.safe_load(raw)\n'],
          },
        }),
      );

      const r = runMaterialSection(dir, hook, { strip: true });
      const out = `${r.stdout}\n${r.stderr}`;

      expect(r.status, out).toBe(1);
      expect(out, out).toMatch(/unexpected key "badd"/);
    });

    it('S5 BLOCKER-shape (b) — empty `bad[]` → exit 1 RED (no lane tool needed)', () => {
      const { dir, hook } = makeConsumerSandbox();
      seedRuleTestsFixture(dir, ['x'], ['y']);
      writeFileSync(
        join(dir, '.ai-factory/rule-tests/astgrep.json'),
        JSON.stringify({
          'getff-researched-no-yaml-load': {
            bad: [],
            good: ['import yaml\ndata = yaml.safe_load(raw)\n'],
          },
        }),
      );

      const r = runMaterialSection(dir, hook, { strip: true });
      const out = `${r.stdout}\n${r.stderr}`;

      expect(r.status, out).toBe(1);
      expect(out, out).toMatch(
        /field "bad" must be a non-empty array \(no violating sample/,
      );
    });

    // ── FIX-2: ruff lane coverage (paired-negative, end-to-end through _fire_ruff) ──
    it.skipIf(!hasRuff)(
      'S5 ruff GREEN — TID251-keyed sidecar, bad[] fires + good[] clean → exit 0',
      () => {
        const { dir, hook } = makeConsumerSandbox();
        seedRuffFixture(
          dir,
          ['import requests\nx = requests.get(1)\n'],
          ['import httpx\nx = httpx.get(1)\n'],
        );

        const r = runMaterialSection(dir, hook, { strip: false });
        const out = `${r.stdout}\n${r.stderr}`;

        expect(out, out).toMatch(/\[ruff TID251\] bad sample fired RED/);
        expect(out, out).toMatch(/\[ruff TID251\] good sample clean/);
        expect(r.status, out).toBe(0);
      },
    );

    it.skipIf(!hasRuff)(
      'S5 ruff NEGATIVE — broken bad[] (does not violate the ban) → exit 1 RED',
      () => {
        const { dir, hook } = makeConsumerSandbox();
        // bad[] imports httpx (not the banned `requests`) → the rule is blind to it → broken.
        seedRuffFixture(
          dir,
          ['import httpx\nx = httpx.get(1)\n'],
          ['import httpx\nx = httpx.get(1)\n'],
        );

        const r = runMaterialSection(dir, hook, { strip: false });
        const out = `${r.stdout}\n${r.stderr}`;

        expect(r.status, out).toBe(1);
        expect(out, out).toMatch(
          /ruff rule-test firing failed|\[ruff TID251\] bad sample did NOT fire/,
        );
      },
    );

    // ── FIX-2: cargo toggle logic (no cargo / no compile needed) ──
    it('S5 cargo — toggle unset → loud opt-in skip + exit 0', () => {
      const { dir, hook } = makeConsumerSandbox();
      seedCargoFixture(dir);

      const r = runMaterialSection(dir, hook, { strip: true });
      const out = `${r.stdout}\n${r.stderr}`;

      // Shared substring with the runner (FIX-4 unify) — drift breaks this assert.
      expect(out, out).toMatch(/cargo firing arm is opt-in \(compile cost\)/);
      expect(r.status, out).toBe(0);
    });

    it('S5 cargo — GETFF_PREPUSH_CARGO_FIRE=1 + cargo absent → DEGRADED loud skip + exit 0', () => {
      const { dir, hook } = makeConsumerSandbox();
      seedCargoFixture(dir);

      const r = runMaterialSection(dir, hook, {
        strip: true,
        env: { GETFF_PREPUSH_CARGO_FIRE: '1' },
      });
      const out = `${r.stdout}\n${r.stderr}`;

      expect(out, out).toMatch(/DEGRADED: cargo lane tool not found/);
      expect(r.status, out).toBe(0);
    });

    // ── FIX-3: mutation-root consumer-depth regression (D-S5-mutation-root) ──
    // The delivered run-generated-rule-mutation.sh sits at scripts/ (1 level) in a consumer but at
    // packages/core/synthesizer/ (3 levels) in the framework; a fixed ../../.. root pointed ABOVE a
    // consumer's root → always exit 2 (npm lane theatre). git-toplevel fixes it. Cheapest catch:
    // with NO manifest, the die() must cite the manifest path INSIDE this sandbox, not two levels up.
    it('S5 mutation-root — run-generated-rule-mutation.sh at consumer scripts/ depth resolves the sandbox root', () => {
      const dir = mkdtempSync(join(tmpdir(), 'prepush-mutroot-'));
      sandboxes.push(dir);
      mkdirSync(join(dir, 'scripts'), { recursive: true });
      cpSync(
        resolve(
          REPO_ROOT,
          'packages/core/synthesizer/run-generated-rule-mutation.sh',
        ),
        join(dir, 'scripts/run-generated-rule-mutation.sh'),
      );
      chmodSync(join(dir, 'scripts/run-generated-rule-mutation.sh'), 0o755);
      execSync('git init -q', { cwd: dir });

      // No manifest present → die() exit 2 citing the manifest path. With the fix that path is
      // INSIDE the sandbox (git root); a regression to ../../.. would cite a path two levels above.
      const r = spawnSync('bash', ['scripts/run-generated-rule-mutation.sh'], {
        cwd: dir,
        encoding: 'utf8',
      });
      const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;

      expect(r.status, out).toBe(2); // manifest-not-found precondition (root resolved past)
      expect(out, out).toContain(
        `${basename(dir)}/.ai-factory/synthesizer-output/rules-manifest-additions.json`,
      );
    });
  },
);

// ── Teardown contract (fixture-cleanup flake, run 31375018780) ────────────────
// The suite above asserts hook behaviour; this block asserts that its OWN teardown
// cannot decide the suite's result. Every arm is deterministic — the injectable `rm`
// seam replaces the real filesystem race, so these tests never race anything.
describe('removeSandbox — fixture teardown contract', () => {
  it('POSITIVE — removes a real git-bearing fixture tree (cleanup is not a no-op)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prepush-teardown-'));
    execSync('git init -q', { cwd: dir });
    execSync('git config user.email t@t.com', { cwd: dir });
    execSync('git config user.name Test', { cwd: dir });
    execSync('git config commit.gpgsign false', { cwd: dir });
    writeFileSync(join(dir, 'README.md'), 'base\n');
    execSync('git add -A', { cwd: dir });
    execSync('git commit -q -m "chore: base"', { cwd: dir });
    // The exact directory the flake failed to rmdir — present before, gone after.
    expect(existsSync(join(dir, '.git/objects'))).toBe(true);

    removeSandbox(dir);

    expect(existsSync(dir)).toBe(false);
  });

  it('retry wiring is LIVE — the recursive rm is handed maxRetries/retryDelay > 0 (deleting them reddens this)', () => {
    // Guards against the exact stock shape that flaked: `{recursive,force}` with the
    // default maxRetries:0 makes ONE rmdir attempt and rethrows ENOTEMPTY. A POSITIVE-only
    // suite would still pass with the knobs stripped, so assert they reach fs.
    const rm = vi.fn();
    removeSandbox('/tmp/does-not-matter', rm as unknown as typeof rmSync);

    expect(rm).toHaveBeenCalledTimes(1);
    const opts = rm.mock.calls[0]?.[1] as {
      recursive: boolean;
      force: boolean;
      maxRetries: number;
      retryDelay: number;
    };
    expect(opts.recursive).toBe(true);
    expect(opts.maxRetries).toBeGreaterThan(0);
    expect(opts.retryDelay).toBeGreaterThan(0);
  });

  it('NEGATIVE (structural guarantee) — an rm that always throws ENOTEMPTY does NOT propagate, and says so loudly', () => {
    // This is the property the flake violated: a teardown crash reddening a suite whose
    // assertions all passed. Retries only narrow the window; the catch is what removes
    // the failure mode, so it is asserted directly rather than argued in prose.
    const boom = Object.assign(
      new Error("ENOTEMPTY: directory not empty, rmdir '/tmp/x/.git/objects'"),
      { code: 'ENOTEMPTY' },
    );
    const rm = vi.fn(() => {
      throw boom;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        removeSandbox('/tmp/x', rm as unknown as typeof rmSync),
      ).not.toThrow();
      // Not silent either: a leaked tmpdir entry is reported with its errno.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toMatch(/ENOTEMPTY/);
    } finally {
      warn.mockRestore();
    }
  });

  it('a failing entry does not strand the LATER sandboxes in the afterEach loop', () => {
    // The pre-fix `for (…) rmSync(…)` aborted on the first throw, leaking every dir
    // queued behind it. Mirrors the afterEach body over a failing-then-succeeding pair.
    const seen: string[] = [];
    const rm = vi.fn((p: string) => {
      seen.push(p);
      if (p === 'first')
        throw Object.assign(new Error('x'), { code: 'ENOTEMPTY' });
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      for (const d of ['first', 'second'])
        removeSandbox(d, rm as unknown as typeof rmSync);
      expect(seen).toEqual(['first', 'second']);
    } finally {
      warn.mockRestore();
    }
  });
});
