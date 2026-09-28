/**
 * Functional tests for the PostToolUse(Bash) hook close-aif-task-on-merge.sh — after a Bash call
 * that merges a PR, close the aif task(s) the PR body names (`aif-task: <id>`) through
 * `harvest.ts <id> --report-merge <prUrl>`.
 *
 * Honest scope: the hook is shell glue. The close itself — merge proof, PR→task mapping, activity
 * order, approve_done, read-back — lives in packages/runtime-bridge/src/cli/harvest.ts and is
 * covered by packages/runtime-bridge/test/harvest-merge-report.test.ts. These tests pin what the
 * hook adds on top: which Bash commands count as merges, how the PR selector is extracted, which
 * PR bodies name tasks, the fail-open contract (aif down / harvest error / missing entrypoint all
 * exit 0 WITH a notice), and the exact argv handed to harvest.ts.
 *
 * Sandbox: every external tool is a stub on PATH — `gh` (logs argv, answers `pr view` from a
 * per-selector JSON file or a default), `curl` (exit code from env), and `tsx` placed at the
 * sandbox's node_modules/.bin (tier 1 of the hook's resolver). CLAUDE_PROJECT_DIR points at the
 * sandbox, which carries an empty packages/runtime-bridge/src/cli/harvest.ts so the entrypoint
 * resolves. The real `gh` and the real aif API are never reached.
 *
 * PATH note: lib/hook-emit.sh prepends /opt/homebrew/bin and /usr/local/bin when they are
 * ABSENT from PATH, which would put the real `gh` in front of the stub. Both are therefore listed
 * explicitly after the stub dir, so nothing is prepended.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/close-aif-task-on-merge.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

const PR_URL = 'https://github.com/artyhoo/getff/pull/42';

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

interface Sandbox {
  root: string;
  bin: string;
  log: string;
}

function makeSandbox(opts: { harvestEntrypoint?: boolean } = {}): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'caom-test-'));
  tmpDirs.push(root);
  const bin = join(root, 'stub-bin');
  const log = join(root, 'calls.log');
  mkdirSync(bin, { recursive: true });
  writeFileSync(log, '');

  const stub = (path: string, body: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(path, 0o755);
  };
  // gh: `pr view <sel> …` answers from $STUB_DIR/view-<sel>.json, else view-default.json.
  stub(
    join(bin, 'gh'),
    [
      'printf "gh %s\\n" "$*" >> "$STUB_LOG"',
      '[ "${STUB_GH_FAIL:-0}" = 1 ] && exit 1',
      'if [ "$1 $2" = "pr view" ]; then',
      '  sel="$3"; case "$sel" in --*) sel=default ;; esac',
      '  f="$STUB_DIR/view-$(printf %s "$sel" | tr -c "A-Za-z0-9" _).json"',
      '  [ -f "$f" ] || f="$STUB_DIR/view-default.json"',
      '  cat "$f"; exit 0',
      'fi',
      'exit 0',
    ].join('\n'),
  );
  stub(join(bin, 'curl'), 'printf "curl %s\\n" "$*" >> "$STUB_LOG"\nexit "${STUB_CURL_RC:-0}"');
  stub(
    join(root, 'node_modules', '.bin', 'tsx'),
    [
      'printf "tsx %s\\n" "$*" >> "$STUB_LOG"',
      '[ -n "${STUB_TSX_ERR:-}" ] && printf "%s\\n" "$STUB_TSX_ERR" >&2',
      'printf "%s\\n" "${STUB_TSX_OUT:-}"',
      'exit "${STUB_TSX_RC:-0}"',
    ].join('\n'),
  );
  if (opts.harvestEntrypoint !== false) {
    const entry = join(root, 'packages', 'runtime-bridge', 'src', 'cli', 'harvest.ts');
    mkdirSync(dirname(entry), { recursive: true });
    writeFileSync(entry, '// stub entrypoint\n');
  }
  return { root, bin, log };
}

function setView(sb: Sandbox, view: { url?: string; state?: string; body?: string }, selector = 'default'): void {
  const name = selector === 'default' ? 'default' : selector.replace(/[^A-Za-z0-9]/g, '_');
  writeFileSync(join(sb.root, `view-${name}.json`), JSON.stringify(view));
}

const APPROVED = JSON.stringify({ ok: true, mergeReport: { approved: true, finalStatus: 'verified' } });

function runHook(
  sb: Sandbox,
  payload: Record<string, unknown>,
  env: Record<string, string> = {},
): { status: number | null; stdout: string; context: string; calls: string[] } {
  const res = spawnSync('bash', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${sb.bin}:/opt/homebrew/bin:/usr/local/bin:${process.env['PATH'] ?? ''}`,
      CLAUDE_PROJECT_DIR: sb.root,
      STUB_LOG: sb.log,
      STUB_DIR: sb.root,
      RUNTIME_BRIDGE_AIF_URL: 'http://aif.test:3009',
      ZCODE_PROJECT_DIR: '',
      ...env,
    },
  });
  let context = '';
  const out = res.stdout.trim();
  if (out) {
    const parsed = JSON.parse(out) as { hookSpecificOutput?: { additionalContext?: string } };
    context = parsed.hookSpecificOutput?.additionalContext ?? '';
  }
  const calls = existsSync(sb.log) ? readFileSync(sb.log, 'utf8').split('\n').filter(Boolean) : [];
  return { status: res.status, stdout: out, context, calls };
}

const bash = (command: string, cwd?: string) => ({
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command },
  ...(cwd ? { cwd } : {}),
});

describe.skipIf(!JQ)('close-aif-task-on-merge.sh — what counts as a merge', () => {
  it('ignores a non-Bash tool even when its payload mentions gh pr merge', () => {
    const sb = makeSandbox();
    const r = runHook(sb, { tool_name: 'Write', tool_input: { file_path: 'x', content: 'gh pr merge 42' } });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.calls).toEqual([]);
  });

  it('ignores a Bash call that merges nothing', () => {
    const sb = makeSandbox();
    const r = runHook(sb, bash('git merge origin/staging && gh pr view 42'));
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.calls).toEqual([]);
  });

  it('ignores gh pr merge --disable-auto', () => {
    const sb = makeSandbox();
    const r = runHook(sb, bash('gh pr merge 42 --disable-auto'));
    expect(r.stdout).toBe('');
    expect(r.calls).toEqual([]);
  });

  it.each([
    ['gh pr merge 42 --squash', '42', ''],
    [`gh pr merge ${PR_URL} --squash --delete-branch`, PR_URL, ''],
    ['cd /tmp && gh pr merge 42 --squash; echo done', '42', ''],
    ['gh pr merge -R artyhoo/getff --squash 42', '42', 'artyhoo/getff'],
    ['gh pr merge --repo=artyhoo/getff 42', '42', 'artyhoo/getff'],
    ['gh pr merge --subject "fix: a b; c" --squash 42', '42', ''],
    ['gh api -X PUT repos/artyhoo/getff/pulls/42/merge -f merge_method=squash', '42', 'artyhoo/getff'],
  ])('extracts the selector from `%s`', (command, sel, repo) => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'summary\n\naif-task: t-1\n' });
    const r = runHook(sb, bash(command), { STUB_TSX_OUT: APPROVED });
    expect(r.status).toBe(0);
    const view = r.calls.find((c) => c.startsWith('gh pr view'));
    expect(view).toBe(`gh pr view ${sel}${repo ? ` --repo ${repo}` : ''} --json url,state,body`);
  });

  it('a bare `gh pr merge` resolves the current branch (no selector argument)', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'aif-task: t-1' });
    const r = runHook(sb, bash('gh pr merge --squash'), { STUB_TSX_OUT: APPROVED });
    expect(r.calls).toContain('gh pr view --json url,state,body');
  });

  it('a shell-variable selector is announced, not guessed', () => {
    const sb = makeSandbox();
    const r = runHook(sb, bash('for n in 1 2; do gh pr merge $n --squash; done'));
    expect(r.status).toBe(0);
    expect(r.context).toMatch(/selector could not be resolved/);
    expect(r.calls.filter((c) => c.startsWith('gh '))).toEqual([]);
  });
});

describe.skipIf(!JQ)('close-aif-task-on-merge.sh — closing', () => {
  it('merged PR with a marker, aif up → harvest.ts <id> --report-merge <url>, notice says closed', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'text\naif-task: 514693af\n' });
    const r = runHook(sb, bash('gh pr merge 42 --squash'), { STUB_TSX_OUT: APPROVED });
    expect(r.status).toBe(0);
    const harvest = join(sb.root, 'packages/runtime-bridge/src/cli/harvest.ts');
    expect(r.calls).toContain(`tsx ${harvest} 514693af --report-merge ${PR_URL}`);
    expect(r.calls).toContain('curl -sf -o /dev/null --max-time 3 http://aif.test:3009/health');
    expect(r.context).toMatch(/aif task 514693af closed \(done → verified\)/);
  });

  it('closes every task a PR names (two marker lines → two calls)', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'aif-task: a1\r\nprose\r\naif-task: b2\r\n' });
    const r = runHook(sb, bash('gh pr merge 42 --squash'), { STUB_TSX_OUT: APPROVED });
    expect(r.calls.filter((c) => c.startsWith('tsx ')).map((c) => c.split(' ')[2])).toEqual(['a1', 'b2']);
  });

  it('a PR with no exact marker line is not a harvest → silent, no aif probe, no harvest call', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'follow-up to aif-task: t-1 from last week' });
    const r = runHook(sb, bash('gh pr merge 42 --squash'));
    expect(r.stdout).toBe('');
    expect(r.calls.some((c) => c.startsWith('curl') || c.startsWith('tsx'))).toBe(false);
  });

  it('not merged yet (auto-merge armed) → notice with the later command, nothing written', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'OPEN', body: 'aif-task: t-1' });
    const r = runHook(sb, bash('gh pr merge 42 --auto --squash'));
    expect(r.status).toBe(0);
    expect(r.context).toMatch(/is OPEN, not merged yet/);
    expect(r.context).toContain(`harvest.ts t-1 --report-merge ${PR_URL}`);
    expect(r.calls.some((c) => c.startsWith('curl') || c.startsWith('tsx'))).toBe(false);
  });

  it('the same PR merged twice in one command is closed once', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'aif-task: t-1' });
    const r = runHook(sb, bash(`gh pr merge 42 --squash || gh pr merge ${PR_URL} --squash`), {
      STUB_TSX_OUT: APPROVED,
    });
    expect(r.calls.filter((c) => c.startsWith('tsx '))).toHaveLength(1);
  });

  it('reports an already-verified task and a refused close distinctly', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'aif-task: t-1' });
    const already = runHook(sb, bash('gh pr merge 42'), {
      STUB_TSX_OUT: JSON.stringify({ ok: true, mergeReport: { alreadyClosed: true, finalStatus: 'verified' } }),
    });
    expect(already.context).toMatch(/already verified/);
    const refused = runHook(sb, bash('gh pr merge 42'), {
      STUB_TSX_OUT: JSON.stringify({
        ok: true,
        mergeReport: { approved: false, finalStatus: 'review', skippedReason: 'approve_done is only allowed from done' },
      }),
    });
    expect(refused.context).toMatch(/NOT closed \(status review\): approve_done is only allowed from done/);
  });
});

describe.skipIf(!JQ)('close-aif-task-on-merge.sh — fail-open', () => {
  it('aif unreachable → exit 0, SKIP notice naming the task and the retry command, no harvest call', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'aif-task: t-1' });
    const r = runHook(sb, bash('gh pr merge 42 --squash'), { STUB_CURL_RC: '7' });
    expect(r.status).toBe(0);
    expect(r.context).toMatch(/unreachable \(aif-tunnel off\?\)/);
    expect(r.context).toMatch(/SKIP, not a pass/);
    expect(r.context).toContain(`harvest.ts t-1 --report-merge ${PR_URL}`);
    expect(r.calls.some((c) => c.startsWith('tsx'))).toBe(false);
  });

  it('harvest.ts exits non-zero → exit 0, notice carries its stderr', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'aif-task: t-1' });
    const r = runHook(sb, bash('gh pr merge 42 --squash'), {
      STUB_TSX_RC: '1',
      STUB_TSX_ERR: '[harvest] --report-merge FAILED: aif 500',
    });
    expect(r.status).toBe(0);
    expect(r.context).toMatch(/closing aif task t-1 .* FAILED \(exit 1\): \[harvest\] --report-merge FAILED: aif 500/);
  });

  it('gh pr view fails → exit 0 with a notice', () => {
    const sb = makeSandbox();
    const r = runHook(sb, bash('gh pr merge 42 --squash'), { STUB_GH_FAIL: '1' });
    expect(r.status).toBe(0);
    expect(r.context).toMatch(/gh pr view 42 failed/);
  });

  it('no harvest.ts entrypoint → exit 0 with a notice, no tsx call', () => {
    const sb = makeSandbox({ harvestEntrypoint: false });
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'aif-task: t-1' });
    const r = runHook(sb, bash('gh pr merge 42 --squash'));
    expect(r.status).toBe(0);
    expect(r.context).toMatch(/no harvest\.ts entrypoint/);
    expect(r.calls.some((c) => c.startsWith('tsx'))).toBe(false);
  });

  it('every notice is valid JSON on the PostToolUse channel', () => {
    const sb = makeSandbox();
    setView(sb, { url: PR_URL, state: 'MERGED', body: 'aif-task: t-1' });
    const r = runHook(sb, bash('gh pr merge 42 --squash'), {
      STUB_TSX_RC: '1',
      STUB_TSX_ERR: 'tab\there "quoted" \\ back',
    });
    const parsed = JSON.parse(r.stdout) as { hookSpecificOutput: { hookEventName: string } };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
  });
});
