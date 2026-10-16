// Runtime tests for the CONVERTED living-docs-auditor role (kickoff-d0 §4, OBL-10).
//
// The pre-conversion extractor tests (bash-snippet extraction of Step-1..5 recipes)
// died with the recipes they extracted; these tests execute the role's ACTUAL
// runtime behavior: the ONE invocation against consumer fixtures carrying REAL
// runner bytes (kickoff §5: "actual profile acceptance must execute shipped
// runners"; stubs are allowed only for bounded control-process cases, and the
// bounded controls below use the real admitted runner with tight bounds instead —
// the identity gate would refuse to execute fake bytes, by design).
//
// The command artifact is the kickoff §2 ready artifact (the bundle). The
// consumer destination scripts/living-docs-audit.mjs is reservation-gated
// (d0-result §Residual) and is covered by installed.test.mjs once delivered.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { ROLE_FILE, repoRoot, RUNNER_BYTES, buildCleanFixture, disposeFixture, runCommand, readResult } from './fixtures.mjs';

const role = readFileSync(ROLE_FILE, 'utf8');
const roleBlock = title => role.split(title)[1].split('```bash\n')[1].split('```')[0];

// ─── Role shape (OBL-10): ONE command, no displaced recipes ──────────────────

test('role carries exactly the ONE command invocation with the frozen contract flags', () => {
  const invocation = roleBlock('### Step 3: Invoke the command (the ONE invocation)');
  assert.match(invocation, /node scripts\/living-docs-audit\.mjs/);
  assert.match(invocation, /--project-root <absolute-root>/);
  assert.match(invocation, /--profile <base\|react-next\|react-spa\|react-native>/);
  assert.match(invocation, /--diagnostics-dir/);
  assert.match(invocation, /--timeout-ms/);
  assert.match(invocation, /--max-output-bytes/);
});

test('role no longer ships displaced recipes: no direct runner run, no detection heuristic, no drift greps', () => {
  // The removed Step-1/3/4 + auxiliary awk/grep recipes must not reappear anywhere.
  assert.doesNotMatch(role, /bash "\$SCRIPT"|RUN_AUDIT|AUDIT_LOG=|mktemp "\$\{TMPDIR/);
  assert.doesNotMatch(role, /next\.config\.(ts|js|mjs)\]/); // Step-1 stack heuristic
  assert.doesNotMatch(role, /awk 'match/);                  // auxiliary drift recipes
  // And the role must not instruct running the runner scripts directly.
  assert.doesNotMatch(roleBlock('### Step 3: Invoke the command (the ONE invocation)'), /audit-ai-docs\.sh/);
});

test('compatibility loader and CC-native entry stay wired to the canonical role', () => {
  // .claude/agents entry is a symlink to the owner; agents/ loader names the owner.
  assert.equal(
    readlinkSync(join(repoRoot, '.claude/agents/living-docs-auditor.md')),
    '../../.agents/roles/living-docs-auditor.md',
  );
  const loader = readFileSync(join(repoRoot, 'agents/living-docs-auditor.md'), 'utf8');
  assert.ok(loader.includes('Read `.agents/roles/living-docs-auditor.md` completely before acting'));
  // The loader's registry face no longer references the removed Step-2 mechanism.
  assert.doesNotMatch(loader, /Step-2/);
});

// ─── Profile acceptance with REAL shipped runner bytes (kickoff §5 row 1) ────

for (const profile of ['base', 'react-next', 'react-spa']) {
  test(`clean ${profile} layout: completed clean via the real shipped runner`, { timeout: 120_000 }, () => {
    const root = buildCleanFixture(profile);
    try {
      const res = runCommand(['--project-root', root, '--profile', profile]);
      assert.equal(res.status, 0, `stdout=${res.stdout}\nstderr=${res.stderr}`);
      const result = readResult(res);
      assert.equal(result.requestedProfile, profile);
      assert.equal(result.resolvedTarget, root);
      assert.equal(result.complete, true);
      assert.ok(result.runner, 'runner identity recorded');
      assert.equal(result.runner.admitted, true);
      for (const check of result.checks) {
        assert.notEqual(check.status, 'violations', `${check.check} unexpectedly violated`);
        assert.notEqual(check.status, 'incomplete', `${check.check} unexpectedly incomplete: ${check.reasons}`);
        assert.notEqual(check.status, 'error', `${check.check} unexpectedly errored: ${check.reasons}`);
      }
      const completion = result.checks.find(c => c.check.endsWith('/completion'));
      assert.ok(completion, 'a scope completion check exists');
      if (profile !== 'base') {
        assert.ok(result.chainedBase?.admitted, 'chained base identity admitted');
        // nested base + preset summary scopes counted independently (kickoff §3)
        assert.ok(result.checks.some(c => c.check.startsWith('base/')), 'nested base scope present');
        assert.ok(result.checks.some(c => c.check.startsWith(`${profile}/`)), 'preset scope present');
      }
      // Population floor (cold-review MAJOR 3): concrete check identities, not
      // just "no bad status" — a vacuously small population cannot pass. Floors
      // measured empirically on the real runner bytes (d0-result §Runs).
      const byId = id => result.checks.find(c => c.check === id);
      assert.equal(byId('structured/d1-skills').status, 'passed');
      assert.equal(byId('base/D3').status, 'passed');
      assert.equal(byId('base/completion').status, 'passed');
      if (profile !== 'base') assert.equal(byId(`${profile}/completion`).status, 'passed');
      if (profile === 'react-spa') {
        assert.equal(byId('react-spa/R-SPA-EB').status, 'passed');
        assert.equal(byId('react-spa/R-SPA-HOOKS').status, 'passed');
      }
      const passedFloor = { base: 7, 'react-next': 8, 'react-spa': 10 }[profile];
      assert.ok(
        result.counts.checksByStatus.passed >= passedFloor,
        `${profile}: passed floor ${passedFloor} not met (${JSON.stringify(result.counts.checksByStatus)})`,
      );
    } finally { disposeFixture(root); }
  });
}

// ─── react-native: explicit incomplete control, no base fallback (§3) ────────

test('react-native profile: main incomplete by design, auxiliaries run, NO base fallback', { timeout: 60_000 }, () => {
  const root = buildCleanFixture('react-native');
  try {
    const res = runCommand(['--project-root', root, '--profile', 'react-native']);
    assert.equal(res.status, 2);
    const result = readResult(res);
    assert.equal(result.complete, false);
    const main = result.checks.find(c => c.check === 'main');
    assert.equal(main.status, 'incomplete');
    assert.match(main.reasons[0], /not admitted in D0/);
    // Admitted auxiliary checks still ran…
    assert.ok(result.checks.some(c => c.check === 'structured/d1-skills' && c.status === 'passed'));
    // …and no base-runner scope was fabricated as a fallback.
    assert.ok(!result.checks.some(c => c.check.startsWith('base/')), 'no base fallback scope');
    assert.equal(result.runner, null);
  } finally { disposeFixture(root); }
});

// ─── Missing runner / unsupported bytes (kickoff §5 rows 5, 6, 9) ────────────

test('missing delivered runner: main incomplete, auxiliaries still report (no empty-population PASS)', { timeout: 60_000 }, () => {
  const root = buildCleanFixture('base', { drop: 'scripts/audit-ai-docs.sh' });
  try {
    const res = runCommand(['--project-root', root, '--profile', 'base']);
    assert.equal(res.status, 2);
    const result = readResult(res);
    const main = result.checks.find(c => c.check === 'main');
    assert.equal(main.status, 'incomplete');
    assert.ok(result.checks.some(c => c.check === 'structured/d1-skills'), 'auxiliary checks still ran');
  } finally { disposeFixture(root); }
});

test('framework profile without its consumer script: honest incomplete, no cross-profile fallback', { timeout: 60_000 }, () => {
  const root = buildCleanFixture('react-next', { drop: 'scripts/audit-ai-docs.react-next.sh' });
  try {
    const res = runCommand(['--project-root', root, '--profile', 'react-next']);
    assert.equal(res.status, 2);
    const result = readResult(res);
    const main = result.checks.find(c => c.check === 'main');
    assert.equal(main.status, 'incomplete');
    assert.ok(!result.checks.some(c => c.check.startsWith('base/R') || c.check.startsWith('react-next/')), 'no fallback execution of another profile');
  } finally { disposeFixture(root); }
});

test('one-byte-modified runner: unsupported/incomplete naming the mismatch, consumer bytes preserved', { timeout: 60_000 }, () => {
  const root = buildCleanFixture('base');
  let before;
  try {
    const scriptPath = join(root, 'scripts/audit-ai-docs.sh');
    writeFileSync(scriptPath, Buffer.concat([RUNNER_BYTES.base, Buffer.from('# x\n')])); // append → different sha256
    before = readFileSync(scriptPath);
    const res = runCommand(['--project-root', root, '--profile', 'base']);
    assert.equal(res.status, 2);
    const result = readResult(res);
    const main = result.checks.find(c => c.check === 'main');
    assert.equal(main.status, 'incomplete');
    assert.match(main.reasons.join(' '), /unsupported runner bytes/);
    // bytes preserved in/out (hash in = hash out — never rewritten)
    assert.deepEqual(readFileSync(scriptPath), before);
    assert.equal(result.runner.admitted, false);
  } finally { disposeFixture(root); }
});

// ─── Bounded controls on the REAL runner (kickoff §5 row 11) ─────────────────

test('tight --timeout-ms kills the real runner: error/incomplete, never a completed result', { timeout: 60_000 }, () => {
  const root = buildCleanFixture('base');
  try {
    // 1ms: bash spawn+exec alone exceeds the deadline, so the kill machinery
    // fires deterministically mid-run; if a machine ever delivered the timer
    // late enough for the runner to finish, this fails LOUDLY (never passes vacuously).
    const res = runCommand(['--project-root', root, '--profile', 'base', '--timeout-ms', '1']);
    assert.equal(res.status, 2);
    const result = readResult(res);
    assert.equal(result.complete, false);
    assert.ok(
      result.checks.some(c => c.status === 'error' || (c.status === 'incomplete' && /timed out|killed/.test(c.reasons.join(' ')))),
      'timeout surfaced as error/incomplete with a kill reason',
    );
    assert.equal(result.process.timedOut, true);
    assert.equal(result.process.killed, true);
  } finally { disposeFixture(root); }
});

test('tiny --max-output-bytes overflows the real runner: error/incomplete, completion not proven', { timeout: 60_000 }, () => {
  const root = buildCleanFixture('base');
  try {
    const res = runCommand(['--project-root', root, '--profile', 'base', '--max-output-bytes', '200']);
    assert.equal(res.status, 2);
    const result = readResult(res);
    assert.equal(result.complete, false);
    assert.equal(result.process.overflowed, true);
    const completion = result.checks.find(c => c.check === 'base/completion');
    assert.ok(completion.status === 'error' || completion.status === 'incomplete', 'completion not proven on truncated output');
  } finally { disposeFixture(root); }
});
