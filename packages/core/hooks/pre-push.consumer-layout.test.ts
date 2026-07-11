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
 * S3 push-channel contract (F-push): the workflow-security scanners (actionlint §1,
 * zizmor §2, the ci-tool-pinning unpinned-install gate) are `owner: maintainer` — a
 * consumer's OWN workflows/scripts are NOT gated at push (ci-tool-pinning.md §2). The
 * only external tool the consumer push channel still runs is lychee (§8, on *changed*
 * Markdown). The stubs below (zizmor/actionlint/lychee → exit 0) keep the framework-
 * layout arms hermetic; on the consumer layout the workflow scanners are never composed.
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

// Each case spawns `node --import tsx` against a real git fixture (and the
// TOOL-absence arms re-spawn under a stripped PATH), so the default 5s ceiling is
// too tight on a loaded CI box. Mirrors the SLOW_SHELL_MS convention in the
// principles hook tests (e.g. 20-bundle-classification.test.ts).
const SLOW_SHELL_MS = 30_000;

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

    // ── S3 push-channel contract — F-push adjudication (workflow scanners not on the
    //    consumer channel) ────────────────────────────────────────────────────────
    // S1 finding F-push (R3 ky): the consumer pre-push ran a FULL zizmor audit over the
    // consumer's OWN `.github/workflows/*.yml` and hard-blocked their FIRST `git push`
    // on pre-existing `@v6` action refs. The S3 contract makes actionlint/zizmor/the
    // ci-tool-pinning gate `owner: maintainer` — NOT gated on a consumer (ci-tool-
    // pinning.md §2: "a consumer's own scripts must not be gated by our discipline").
    // These arms lock that in: the scanners must NOT run on the consumer layout, so a
    // consumer's own workflows — even ones a PRESENT scanner would reject — never block.

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
  },
);
