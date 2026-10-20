// Conformance oracle for the D0 living-docs command (kickoff-d0 §5 table, frozen).
//
// Every expectation below is HAND-SPECIFIED from the kickoff's runner grammar and
// result contract (d0-result §Oracle rows 1–14). Production parsing/aggregation
// NEVER computes an expected value. Rows 13–14 are the anti-tautology teeth: each
// injects ONE fault at a production seam (role-invocation removed / success-only
// parser / over-rejecting classifier) and asserts the UNCHANGED frozen oracle
// FAILS for that fault — direct helper tests alone cannot satisfy this file.
//
// TAK fault protocol mapping (baseline → fault → RED → restore → re-green): the
// clean rows below are the baseline; each `fault:*` case injects exactly one
// fault and asserts the corresponding frozen literal is NOT met (RED observed);
// the un-faulted assertions in the same file are the restoration re-green. The
// production seam functions are imported UNMODIFIED from the ready artifact —
// faults live in test-space wrappers, so restoration is structural (the original
// import is what the clean rows run against), never a file edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, chmodSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, existsSync, readdirSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMMAND_ARTIFACT, ROLE_FILE, RUNNER_BYTES, buildCleanFixture, disposeFixture, runCommand, readResult, deliverCommand, runDeliveredCommand, runRoleInvocation, assertRoleAuditResult } from './fixtures.mjs';

const seam = await import(pathToFileURL(COMMAND_ARTIFACT).href);
const { parseRunnerOutput, evaluateScope, classifyWarn, deriveExitCode } = seam;

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const okProc = { exitCode: 0, timedOut: false, overflowed: false, killed: false };

// Grammar-conformant runner outputs, hand-written from the kickoff grammar (frozen inputs).
const CLEAN_BASE_STDOUT = [
  'WARN: R4: Every public export in src/domain has matching .unit.ts (ts-morph) (skipped: no src/domain — probe could not run)',
  'PASS: D3 (drift): canonical goal phrase present in downstream goal-bearing docs',
  'PASS: D4 (drift): .ai-factory/tool-decisions.md up-to-date with package.json',
  '',
  '─────────────────────────────────────────',
  'Audit complete: 2 PASS, 0 FAIL, 1 WARN',
  '',
].join('\n');
const VIOLATION_STDOUT = [
  'FAIL: R2: Validation at HTTP boundaries (Zod safeParse, not parse)',
  '    src/app/api/orders/route.ts:24: uses OrderSchema.parse(body)',
  '',
  '─────────────────────────────────────────',
  'Audit complete: 0 PASS, 1 FAIL, 0 WARN',
  '',
].join('\n');

// ─── Row 1 (identity arm): embedded sha256 == independently computed artifact hash ──

test('row 1: admitted runner identity equals the sha256 of the source artifact computed independently', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('base');
  try {
    const result = readResult(runCommand(['--project-root', root, '--profile', 'base']));
    assert.equal(result.runner.actualSha256, sha256(RUNNER_BYTES.base));
    assert.equal(result.runner.expectedSha256, result.runner.actualSha256);
    assert.equal(result.runner.admitted, true);
  } finally { disposeFixture(root); }
});

// ─── Row 2: real violations surfaced with locations (E2E) ────────────────────

test('row 2: absent declared skill (blocking) + JSON _comment debt (warning) → exit 1, findings name targets with locations', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('base');
  try {
    // Declaration grammar: "skill `name`" — text ending in "skill" + inlineCode name.
    writeFileSync(join(root, 'AGENTS.md'), '# AGENTS\n\nUse the skill `absent` at `.claude/skills/absent/SKILL.md`.\n');
    writeFileSync(join(root, '.mcp.json'), '{\n  "_comment_TODO_remove": "x",\n  "mcpServers": {}\n}\n');
    const res = runCommand(['--project-root', root, '--profile', 'base']);
    assert.equal(res.status, 1, `complete run with blocking findings — stdout=${res.stdout}`);
    const result = readResult(res);
    assert.equal(result.complete, true);
    const d1 = result.checks.find(c => c.check === 'structured/d1-skills');
    assert.equal(d1.status, 'violations');
    assert.equal(d1.findings[0].severity, 'blocking', 'missing declared skill is blocking');
    assert.match(d1.findings[0].message, /absent/);
    assert.ok(d1.findings[0].location?.line >= 1, 'D1 finding carries a located line');
    const d2 = result.checks.find(c => c.check === 'structured/d2-json-configs');
    assert.equal(d2.status, 'violations');
    assert.equal(d2.findings[0].severity, 'warning', '_comment debt is a nonblocking finding');
    assert.match(d2.findings.map(f => f.message).join(' '), /\.mcp\.json/);
    assert.equal(result.counts.blocking, 1);
  } finally { disposeFixture(root); }
});

// ─── Row 3: discrimination — fenced mention is NOT a declaration (no false D1) ──

test('row 3: skill mentioned only inside a fenced code block is not a declaration; clean JSON stays clean', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('base');
  try {
    writeFileSync(join(root, 'AGENTS.md'), [
      '# AGENTS',
      '',
      'Use the skill `demo` at `.claude/skills/demo/SKILL.md`.',
      '',
      '```md',
      'Example text mentioning skill `fenced-ghost` at `.claude/skills/fenced-ghost/SKILL.md`.',
      '```',
      '',
    ].join('\n'));
    const res = runCommand(['--project-root', root, '--profile', 'base']);
    assert.equal(res.status, 0, res.stdout);
    const result = readResult(res);
    const d1 = result.checks.find(c => c.check === 'structured/d1-skills');
    assert.equal(d1.status, 'passed');
    assert.equal(d1.findings.length, 0);
    assert.equal(result.checks.find(c => c.check === 'structured/d2-json-configs').status, 'passed');
  } finally { disposeFixture(root); }
});

// ─── Row 3 rules arm (cold-review MAJOR 2): declared-but-missing rule paths ──

test('row 3-rules: missing declared rule is blocking with a location; existing/fenced/placeholder paths are not flagged', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('base');
  try {
    mkdirSync(join(root, '.claude/rules'), { recursive: true });
    writeFileSync(join(root, '.claude/rules/team-standards.md'), '# Team standards\n');
    // Grammar (audit-ai-docs.ts:464-502): `.claude/rules/<path>` in prose
    // text/inlineCode; fenced blocks are invisible; `<`-placeholders filtered.
    writeFileSync(join(root, 'AGENTS.md'), [
      '# AGENTS',
      '',
      'Use the skill `demo` at `.claude/skills/demo/SKILL.md`.',
      '',
      'Follow `.claude/rules/team-standards.md` and `.claude/rules/ghost.md`.',
      '',
      '```md',
      'Fenced mention of `.claude/rules/fenced-ghost.md` declares nothing.',
      '```',
      '',
      'The `.claude/rules/<name>.md` placeholder is not a rule path.',
      '',
    ].join('\n'));
    const res = runCommand(['--project-root', root, '--profile', 'base']);
    assert.equal(res.status, 1, `blocking rule violation — stdout=${res.stdout}`);
    const result = readResult(res);
    assert.equal(result.complete, true);
    const rules = result.checks.find(c => c.check === 'structured/d1-rules');
    assert.equal(rules.status, 'violations');
    assert.equal(rules.findings.length, 1, 'exactly the ghost path is a finding');
    assert.equal(rules.findings[0].severity, 'blocking');
    assert.match(rules.findings[0].message, /ghost\.md/);
    assert.ok(rules.findings[0].location?.line >= 1, 'rule finding carries a located line');
    const messages = rules.findings.map(f => f.message).join(' ');
    assert.doesNotMatch(messages, /team-standards/, 'existing rule is not a finding');
    assert.doesNotMatch(messages, /fenced-ghost/, 'fenced mention did not declare');
    assert.doesNotMatch(messages, /<name>/, 'placeholder did not declare');
  } finally { disposeFixture(root); }
});

test('row 3-rules-clean: only-existing declarations keep d1-rules passed', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('base');
  try {
    mkdirSync(join(root, '.claude/rules'), { recursive: true });
    writeFileSync(join(root, '.claude/rules/team-standards.md'), '# Team standards\n');
    writeFileSync(join(root, 'AGENTS.md'), '# AGENTS\n\nUse the skill `demo` at `.claude/skills/demo/SKILL.md`.\n\nFollow `.claude/rules/team-standards.md`.\n');
    const res = runCommand(['--project-root', root, '--profile', 'base']);
    assert.equal(res.status, 0, res.stdout);
    const rules = readResult(res).checks.find(c => c.check === 'structured/d1-rules');
    assert.equal(rules.status, 'passed');
    assert.equal(rules.findings.length, 0);
  } finally { disposeFixture(root); }
});

// ─── Row 4: malformed JSON + retained known violation (E2E) ──────────────────

test('row 4: unreadable/malformed JSON is its own acquisition state; the known _comment violation is retained', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('base');
  try {
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(join(root, '.claude/settings.json'), '{ invalid json ');
    writeFileSync(join(root, '.mcp.json'), '{\n  "_comment_TODO_remove": "x"\n}\n');
    const res = runCommand(['--project-root', root, '--profile', 'base']);
    assert.equal(res.status, 2);
    const result = readResult(res);
    assert.equal(result.complete, false);
    const d2 = result.checks.find(c => c.check === 'structured/d2-json-configs');
    assert.equal(d2.status, 'incomplete', 'the unreadable input records its own acquisition state');
    assert.match(d2.reasons.join(' '), /settings\.json/);
    assert.match(d2.findings.map(f => f.message).join(' '), /\.mcp\.json/, 'known violation retained');
  } finally { disposeFixture(root); }
});

// ─── Row 5: missing chained base — wrapper exit 0 ≠ complete (E2E) ───────────

test('row 5: react-next without its nested base stays honestly incomplete even if the wrapper exits 0', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('react-next', { drop: 'scripts/audit-ai-docs.sh' });
  try {
    const res = runCommand(['--project-root', root, '--profile', 'react-next']);
    assert.equal(res.status, 2);
    const result = readResult(res);
    assert.equal(result.complete, false);
    const chained = result.checks.find(c => c.check === 'main/chained-base');
    assert.ok(chained, 'chained-base incompleteness is explicit');
    assert.equal(chained.status, 'incomplete');
  } finally { disposeFixture(root); }
});

// ─── Row 7: contradictions never read as clean (pure seam) ───────────────────

test('row 7a: FAIL records with exit 0 → error contradiction, FAIL findings retained', () => {
  const parse = parseRunnerOutput(false, VIOLATION_STDOUT);
  const { checks, completion } = evaluateScope({
    scopeLabel: 'base', scope: 'base', isWrapperScope: false, baseExit: null,
    proc: { ...okProc, exitCode: 0 }, stdout: VIOLATION_STDOUT, parse,
  });
  assert.equal(completion.status, 'error');
  assert.match(completion.reasons.join(' '), /exit\/result contradiction/);
  const r2 = checks.find(c => c.check === 'base/R2');
  assert.equal(r2.status, 'violations', 'FAIL findings retained despite the contradiction');
});

test('row 7b: crash exit 3 with no FAIL records → unexplained-exit error', () => {
  const parse = parseRunnerOutput(false, CLEAN_BASE_STDOUT);
  const { completion } = evaluateScope({
    scopeLabel: 'base', scope: 'base', isWrapperScope: false, baseExit: null,
    proc: { ...okProc, exitCode: 3 }, stdout: CLEAN_BASE_STDOUT, parse,
  });
  assert.equal(completion.status, 'error');
  assert.match(completion.reasons.join(' '), /unexplained runner exit code 3/);
});

test('row 7c: empty runner output → error, never clean', () => {
  const parse = parseRunnerOutput(false, '');
  const { completion } = evaluateScope({
    scopeLabel: 'base', scope: 'base', isWrapperScope: false, baseExit: null,
    proc: { ...okProc, exitCode: 0 }, stdout: '', parse,
  });
  assert.equal(completion.status, 'error');
  assert.match(completion.reasons.join(' '), /no output/);
});

test('row 7-exit: deriveExitCode literals — invocationError→2, incomplete/error→2, blocking→1, clean→0', () => {
  assert.equal(deriveExitCode({ invocationError: 'x', checks: [], counts: { blocking: 0 } }), 2);
  assert.equal(deriveExitCode({ checks: [{ status: 'incomplete' }], counts: { blocking: 0 } }), 2);
  assert.equal(deriveExitCode({ checks: [{ status: 'error' }], counts: { blocking: 0 } }), 2);
  assert.equal(deriveExitCode({ checks: [{ status: 'violations' }], counts: { blocking: 2 } }), 1);
  assert.equal(deriveExitCode({ checks: [{ status: 'passed' }, { status: 'not-applicable' }], counts: { blocking: 0 } }), 0);
});

// ─── Row 8: three-way WARN discrimination maps to three distinct states ──────

test('row 8: tooling-acquisition WARN → incomplete; documented-absence WARN → not-applicable; soft WARN → passed+warning', () => {
  assert.equal(classifyWarn('R4: probe (skipped: npx not found)').kind, 'incomplete-known');
  assert.equal(classifyWarn('D6: x (no passport — nothing to check)').kind, 'not-applicable');
  assert.equal(classifyWarn('D2 (drift): JSON configs accumulate stale comments').kind, 'soft-warning');

  const stdout = [
    'WARN: R4: probe (skipped: npx not found)',
    'WARN: D6: x (no passport — nothing to check; install.sh materializes it)',
    'WARN: D2 (drift): JSON configs accumulate stale comments',
    '',
    'Audit complete: 0 PASS, 0 FAIL, 3 WARN',
    '',
  ].join('\n');
  const parse = parseRunnerOutput(false, stdout);
  const { checks } = evaluateScope({
    scopeLabel: 'base', scope: 'base', isWrapperScope: false, baseExit: null,
    proc: okProc, stdout, parse,
  });
  assert.equal(checks.find(c => c.check === 'base/R4').status, 'incomplete');
  assert.equal(checks.find(c => c.check === 'base/D6').status, 'not-applicable');
  const d2 = checks.find(c => c.check === 'base/D2');
  assert.equal(d2.status, 'passed');
  assert.equal(d2.findings.length, 1, 'completed soft warning is a non-blocking finding');
  assert.equal(d2.findings[0].severity, 'warning');
});

// ─── Row 10: path hostility (E2E) ─────────────────────────────────────────────

test('row 10a: spaces + Unicode root honored exactly; nested cwd does not rebind the target', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('base');
  const hostile = `${root}-пробел Δ nested`; // sibling rename (renaming into itself is EINVAL)
  try {
    renameSync(root, hostile);
    const res = runCommand(['--project-root', hostile, '--profile', 'base']);
    assert.equal(res.status, 0, res.stdout);
    const result = readResult(res);
    assert.equal(result.resolvedTarget, hostile);
    // nested cwd: run from deep inside the target — the explicit root still governs
    const nested = runCommand(['--project-root', hostile, '--profile', 'base'], { cwd: join(hostile, '.ai-factory') });
    assert.equal(nested.status, 0, nested.stdout);
    assert.equal(readResult(nested).resolvedTarget, hostile);
    renameSync(hostile, root);
  } catch (err) {
    try { renameSync(hostile, root); } catch { /* already restored */ }
    throw err;
  } finally { disposeFixture(root); }
});

test('row 10b: missing --project-root / relative root refused before any backend', async () => {
  const missing = readResult(runCommand(['--profile', 'base']));
  assert.match(missing.invocationError, /--project-root/, 'invocation error names the missing option');
  const relative = readResult(runCommand(['--project-root', 'relative/path', '--profile', 'base']));
  assert.match(relative.invocationError, /absolute/);
  const res = await seam.executeAudit([]);
  assert.equal(deriveExitCode(res), 2);
});

// ─── Row 11 (diagnostics arm): unwritable --diagnostics-dir is an error, checks continue ──

test('row 11: diagnostic-write failure errors but independent checks still complete', { timeout: 120_000 }, () => {
  const root = buildCleanFixture('base');
  const lockedDir = `${root}-locked-diag`;
  try {
    mkdirSync(lockedDir);
    chmodSync(lockedDir, 0o000);
    const res = runCommand(['--project-root', root, '--profile', 'base', '--diagnostics-dir', lockedDir]);
    const result = readResult(res);
    assert.ok(result.diagnostics.writeError, 'write failure recorded as an error');
    assert.ok(result.checks.some(c => c.check === 'base/completion'), 'runner checks still ran');
  } finally {
    chmodSync(lockedDir, 0o755);
    disposeFixture(lockedDir);
    disposeFixture(root);
  }
});

// ─── Row 10 numeric/placement arms (cold-review MINOR 2): pre-backend validation ──

test('row 10c: timeout bounds and diagnostics placement are refused before any backend runs', { timeout: 60_000 }, () => {
  // Numeric arms fire in parseArgs — no real target needed.
  const zero = readResult(runCommand(['--project-root', '/definitely/absolute', '--profile', 'base', '--timeout-ms', '0']));
  assert.match(zero.invocationError, /--timeout-ms must be positive, got: 0/);
  const tooBig = readResult(runCommand(['--project-root', '/definitely/absolute', '--profile', 'base', '--timeout-ms', '300001']));
  assert.match(tooBig.invocationError, /--timeout-ms exceeds maximum 300000, got: 300001/);
  // The placement arm needs a real target: root resolution precedes the diagnostics check.
  const root = buildCleanFixture('base');
  try {
    const inside = runCommand(['--project-root', root, '--profile', 'base', '--diagnostics-dir', join(root, 'diag')]);
    assert.equal(inside.status, 2);
    assert.match(readResult(inside).invocationError, /--diagnostics-dir must be outside the audited tree/);
  } finally { disposeFixture(root); }
});

// ─── Row 11 bounded kill controls (cold-review BLOCKER remediation) ───────────
// kickoff §2 sanctions a fake runner ONLY for bounded control-process cases; these
// drive the kill machinery directly through the exported seam (the identity gate
// would refuse fake bytes in a real profile run — by design).

test('bounded control A: timeout kills the whole process group — a same-group descendant cannot stall settlement', { timeout: 30_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'd0-killA-'));
  try {
    const script = join(dir, 'linger.sh');
    writeFileSync(script, 'echo hello\nsleep 30 &\nexec sleep 30\n');
    const t0 = process.hrtime.bigint();
    const proc = await seam.runBounded(script, dir, 3_000, 1_000_000);
    const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.equal(proc.timedOut, true);
    assert.equal(proc.killed, true);
    assert.ok(proc.stdout.includes('hello'), 'pre-kill output is retained');
    assert.ok(elapsedMs < 15_000, `settled in ${Math.round(elapsedMs)}ms — a descendant held the pipe past all grace`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('bounded control B: a re-sessioned (setsid) orphan is abandoned via the exit-grace stream destroy', { timeout: 30_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'd0-killB-'));
  try {
    const script = join(dir, 'orphan.sh');
    // setsid puts the descendant in a NEW session — unreachable by the group
    // signal; only the exit-grace stream destroy can force settlement.
    writeFileSync(script, 'echo hello\nsetsid sleep 30 &\nexec sleep 30\n');
    const t0 = process.hrtime.bigint();
    const proc = await seam.runBounded(script, dir, 3_000, 1_000_000);
    const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.equal(proc.timedOut, true);
    assert.ok(proc.stdout.includes('hello'), 'pre-kill output is retained');
    assert.ok(elapsedMs < 15_000, `settled in ${Math.round(elapsedMs)}ms — the orphan held the pipe forever`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── Rows 13–14: anti-tautology — the frozen oracle FAILS under injected faults ──

const row1Expectation = evaluation => {
  // Frozen row-1 literals: completion passed, zero violations anywhere.
  const statuses = evaluation.checks.map(c => c.status);
  return evaluation.completion.status === 'passed' && !statuses.includes('violations');
};
const evalClean = (parseFn, procExit = 0) => {
  const parse = parseFn(false, CLEAN_BASE_STDOUT);
  return evaluateScope({
    scopeLabel: 'base', scope: 'base', isWrapperScope: false, baseExit: null,
    proc: { ...okProc, exitCode: procExit }, stdout: CLEAN_BASE_STDOUT, parse,
  });
};
const evalViolation = parseFn => {
  const parse = parseFn(false, VIOLATION_STDOUT);
  return evaluateScope({
    scopeLabel: 'base', scope: 'base', isWrapperScope: false, baseExit: null,
    proc: { ...okProc, exitCode: 1 }, stdout: VIOLATION_STDOUT, parse,
  });
};

test('row 13a: the unchanged caller oracle kills an executed echo bypass and accepts restoration', () => {
  const root = buildCleanFixture('base');
  try {
    deliverCommand(root);
    const realRole = readFileSync(ROLE_FILE, 'utf8');
    const bypass = realRole.replace(/^node scripts\/living-docs-audit\.mjs/m, 'echo node scripts/living-docs-audit.mjs');
    assert.notEqual(bypass, realRole, 'the fault reaches the actual executable line');
    const res = runRoleInvocation(root, 'base', bypass);
    assert.equal(res.status, 0, 'the bypass itself executed successfully');
    assert.match(res.stdout, /^node scripts\/living-docs-audit\.mjs /, 'reached bypass, not a loader failure');
    assert.throws(() => assertRoleAuditResult(res, root, 'base'), /role invocation must produce actual audit JSON/);
    assertRoleAuditResult(runRoleInvocation(root, 'base'), root, 'base');
  } finally { disposeFixture(root); }
});

for (const nested of [false, true]) {
  test(`R1 delivered diagnostics refuses an outside symlink into the target (new descendants=${nested})`, () => {
    const root = buildCleanFixture('base');
    const outside = mkdtempSync(join(tmpdir(), 'd0-diag-outside-'));
    try {
      const inside = join(root, 'inside-diag'); mkdirSync(inside);
      symlinkSync(inside, join(outside, 'redirect'));
      const dir = join(outside, 'redirect', ...(nested ? ['not-created', 'logs'] : []));
      const res = runDeliveredCommand(root, ['--project-root', root, '--profile', 'base', '--diagnostics-dir', dir]);
      assert.equal(res.status, 2, res.stdout);
      assert.match(readResult(res).invocationError, /outside the audited tree/);
      assert.deepEqual(readdirSync(inside), [], 'no target bytes created through the alias');
    } finally { disposeFixture(root); rmSync(outside, { recursive: true, force: true }); }
  });
}

test('R1 physical target aliases cannot disguise an internal diagnostics directory', () => {
  const root = buildCleanFixture('base'); const outside = mkdtempSync(join(tmpdir(), 'd0-root-alias-'));
  try {
    const alias = join(outside, 'project'); symlinkSync(root, alias);
    const res = runDeliveredCommand(root, ['--project-root', alias, '--profile', 'base', '--diagnostics-dir', join(root, 'logs')]);
    assert.equal(res.status, 2, res.stdout);
    assert.match(readResult(res).invocationError, /outside the audited tree/);
    assert.equal(existsSync(join(root, 'logs')), false);
  } finally { disposeFixture(root); rmSync(outside, { recursive: true, force: true }); }
});

for (const name of ['runner-stdout.txt', 'runner-stderr.txt', 'result.json']) {
  test(`R1 refuses a symlinked diagnostics file ${name} before altering its target`, () => {
    const root = buildCleanFixture('base'); const outside = mkdtempSync(join(tmpdir(), 'd0-diag-file-'));
    try {
      const target = join(root, 'preserve.txt'); writeFileSync(target, 'unaltered target bytes');
      symlinkSync(target, join(outside, name));
      const res = runDeliveredCommand(root, ['--project-root', root, '--profile', 'base', '--diagnostics-dir', outside]);
      assert.equal(res.status, 2, res.stdout);
      assert.equal(readFileSync(target, 'utf8'), 'unaltered target bytes');
    } finally { disposeFixture(root); rmSync(outside, { recursive: true, force: true }); }
  });
}

test('R1 ordinary external diagnostics succeed without writing through a pre-existing hard link', () => {
  const root = buildCleanFixture('base'); const outside = mkdtempSync(join(tmpdir(), 'd0-diag-hardlink-'));
  try {
    const target = join(root, 'preserve.txt'); writeFileSync(target, 'unaltered target bytes');
    linkSync(target, join(outside, 'runner-stdout.txt'));
    const res = runDeliveredCommand(root, ['--project-root', root, '--profile', 'base', '--diagnostics-dir', outside]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(readFileSync(target, 'utf8'), 'unaltered target bytes');
    assert.equal(readResult(res).diagnostics.fullLogsRetained, true);
    assert.equal(JSON.parse(readFileSync(join(outside, 'result.json'), 'utf8')).schema, 'getff.living-docs-audit/1');
  } finally { disposeFixture(root); rmSync(outside, { recursive: true, force: true }); }
});

for (const physical of [false, true]) {
  test(`R2 rejects outside declarations independently of external existence (symlink=${physical})`, () => {
    const root = buildCleanFixture('base'); const outside = mkdtempSync(root + '-outside-');
    try {
      const sentinel = join(outside, 'present.md'); const spy = join(outside, 'outside-reads');
      writeFileSync(sentinel, 'outside data');
      mkdirSync(join(root, '.claude/rules'));
      let name = `../../../${basename(outside)}/present.md`;
      const aliases = [join(root, '.claude/skills/escape'), join(root, '.claude/rules/escape')];
      if (physical) { for (const alias of aliases) symlinkSync(outside, alias); name = 'escape/present.md'; }
      writeFileSync(join(root, 'AGENTS.md'), `Use the skill \`caller-missing\`.\nUse the skill \`${name}\`.\nFollow \`.claude/rules/${name}\`.\n`);
      // Observe only forbidden follows. Reading an in-tree link's own metadata remains allowed.
      const shim = `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
const outside=${JSON.stringify(outside)}, aliases=${JSON.stringify(aliases)}, log=${JSON.stringify(spy)};
for(const key of ['statSync','lstatSync','realpathSync','readFileSync']) { const original=fs[key]; fs[key]=function(path,...args) {
 const s=String(path); if((s===outside||s.startsWith(outside+'/')) || (key!=='lstatSync'&&aliases.some(a=>s===a||s.startsWith(a+'/')))) fs.appendFileSync(log,key+' '+s+'\\n');
 return original.call(this,path,...args); }; } syncBuiltinESMExports();`;
      const nodeArgs = ['--import', 'data:text/javascript;base64,' + Buffer.from(shim).toString('base64')];
      const invoke = () => runDeliveredCommand(root, ['--project-root', root, '--profile', 'base'], nodeArgs);
      const first = invoke();
      assert.equal(first.status, 2, first.stdout);
      const a = readResult(first);
      assert.equal(a.complete, false);
      assert.ok(a.findings.some(f => f.message.includes("skill 'caller-missing'")), 'independent known violation retained');
      for (const id of ['structured/d1-skills', 'structured/d1-rules']) {
        const check = a.checks.find(c => c.check === id);
        assert.equal(check.status, 'incomplete'); assert.match(check.reasons.join(' '), /outside|escap|bound/i);
      }
      assert.equal(existsSync(spy), false, 'no read/stat/follow of the outside declaration');
      unlinkSync(sentinel);
      const second = invoke(); assert.equal(second.status, 2, second.stdout);
      assert.deepEqual(readResult(second).checks.filter(c => c.check.startsWith('structured/')), a.checks.filter(c => c.check.startsWith('structured/')));
      assert.equal(existsSync(spy), false);
    } finally { disposeFixture(root); rmSync(outside, { recursive: true, force: true }); }
  });
}

test('R2 legitimate in-target canonical skill and rule links remain admitted', () => {
  const root = buildCleanFixture('base');
  try {
    mkdirSync(join(root, '.agents/procedures/demo'), { recursive: true });
    mkdirSync(join(root, '.agents/rules'), { recursive: true });
    writeFileSync(join(root, '.agents/rules/demo.md'), '# Rule\n');
    rmSync(join(root, '.claude/skills/demo'), { recursive: true });
    symlinkSync('../../.agents/procedures/demo', join(root, '.claude/skills/demo'));
    mkdirSync(join(root, '.claude/rules')); symlinkSync('../../.agents/rules/demo.md', join(root, '.claude/rules/demo.md'));
    writeFileSync(join(root, 'AGENTS.md'), 'Use the skill `demo`.\nFollow `.claude/rules/demo.md`.\n');
    const res = runDeliveredCommand(root, ['--project-root', root, '--profile', 'base']);
    assert.equal(res.status, 0, res.stdout);
  } finally { disposeFixture(root); }
});

test('row 13b (fault: success-only parser): row-2 frozen expectation fails when FAIL records are dropped', () => {
  const successOnlyParse = (w, text) => {
    const real = parseRunnerOutput(w, text);
    return { ...real, records: real.records.filter(r => r.kind !== 'FAIL') };
  };
  const mutant = evalViolation(successOnlyParse);
  // Frozen row-2 literal: a FAIL record present in the grammar input MUST surface
  // as a violation. The success-only mutant cannot satisfy it — the oracle FAILS
  // (the mutant instead reports a summary/counter disagreement, not a clean pass).
  const hasViolation = mutant.checks.some(c => c.status === 'violations');
  assert.equal(hasViolation, false, 'mutant dropped the violation (RED observed)');
  assert.equal(mutant.completion.status, 'error', 'mutant cannot masquerade as complete either');
  // restoration: the unmodified parser satisfies the frozen literal (re-green)
  const restored = evalViolation(parseRunnerOutput);
  assert.equal(restored.checks.some(c => c.status === 'violations'), true);
});

test('row 14 (fault: over-rejecting classifier): row-1 clean expectation fails when PASS is rejected', () => {
  const overRejectingParse = (w, text) => {
    const real = parseRunnerOutput(w, text);
    return { ...real, records: real.records.map(r => (r.kind === 'PASS' ? { ...r, kind: 'FAIL' } : r)) };
  };
  const mutant = evalClean(overRejectingParse, 0);
  assert.equal(row1Expectation(mutant), false, 'oracle rejects the excess rejection (RED observed)');
  // restoration: the unmodified classifier satisfies row 1 (re-green)
  assert.equal(row1Expectation(evalClean(parseRunnerOutput)), true);
});
