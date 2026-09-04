/**
 * Functional meta-test for the priority-score helper's skip-closed optimisation
 * (umbrella pipeline-completion-scan-skip-closed, 2026-06-17).
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §2.5/§7.3.
 *
 * What this proves (the optimisation + its correctness invariant):
 *   The expensive per-umbrella C2/dup-detect jaccard scan is the dominant cost of
 *   `/pipeline` priority scoring (measured 2026-06-17: ~2.70s/umbrella over the full
 *   164-umbrella set, ~3.0s umbrella-invariant → full=446s vs open-only=76s, 83% of the
 *   cost is per-umbrella). priority-score.sh now computes the CHEAP closed-set first
 *   (C3 done.md file-existence + C1 merged-branch match) and feeds dup-detect ONLY the
 *   open survivors via the MO_UMBRELLA_SUBSET opt-in seam (fix shape (a) —
 *   orchestration-side; dup-detect stays closure-agnostic).
 *
 * Paired-negative contract (AC-1 + AC-2):
 *
 *   AC-1 (optimisation): umbrellas provably closed by a cheap signal (done.md OR
 *     branch-match) are EXCLUDED from the subset handed to dup-detect — proven by a
 *     probe file the fake dup-detect writes recording the received MO_UMBRELLA_SUBSET.
 *
 *   AC-2 (correctness invariant — DONE-membership unchanged):
 *     ✅ C2-ONLY: an umbrella closed ONLY by C2 jaccard (no done.md, no branch) is NOT
 *        cheap-closed → it SURVIVES into the subset → C2 still classifies it status=DONE.
 *     ✅ C3 / C1 cheap-closed umbrellas are STILL DONE (via done-md / branch, not C2).
 *     ❌ a genuinely-open umbrella (all layers miss) stays a candidate (no DONE tag).
 *
 * If the filter over-excluded the C2-only umbrella, it would no longer be in the subset,
 * the (subset-respecting) fake dup-detect would not emit its POTENTIAL_DUPE, and the
 * C2-ONLY assertion below would FAIL — so this test is a genuine regression guard for
 * the AC-2 invariant, not a tautology.
 *
 * Reference pattern: packages/core/hooks/done-md-completion-filter.test.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  chmodSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/priority-score.sh',
);

// Each case spawns priority-score.sh against a real git fixture, so the default 5s
// ceiling is too tight under a fully parallel `npm run test` on a loaded box
// (observed 14-51s). Mirrors the SLOW_SHELL_MS convention (PR #848, e.g.
// pre-push.consumer-layout.test.ts).
const SLOW_SHELL_MS = 30_000;

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'priority-score-skip-closed-test-'));
  sandboxes.push(d);
  return d;
}

function setupRepo(sandboxRoot: string, umbrellaNames: string[]): void {
  const promptsDir = join(sandboxRoot, '.claude', 'orchestrator-prompts');
  for (const name of umbrellaNames) {
    const dir = join(promptsDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'kickoff.md'),
      `# Umbrella ${name}\n\n> **Type:** I-phase\n\n## §0 Problem\n- placeholder\n`,
      'utf8',
    );
  }
}

function writeDoneMd(sandboxRoot: string, umbrellaName: string, prNum: number): void {
  const dir = join(sandboxRoot, '.claude', 'orchestrator-prompts', umbrellaName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'done.md'),
    `# ${umbrellaName} — DONE\n- Final PR: #${prNum}\n- Closed: 2026-06-17\n- Summary: done\n`,
    'utf8',
  );
}

/** Fake gh: emits the merged-PR JSON for a `--state merged` call, `[]` otherwise. */
function makeFakeGh(sandboxRoot: string, mergedPrsJson: string): string {
  const fakeGh = join(sandboxRoot, 'fake-gh.sh');
  const script = `#!/usr/bin/env bash
for a in "$@"; do
  if [[ "$a" == "merged" ]]; then
    cat <<'JSON'
${mergedPrsJson}
JSON
    exit 0
  fi
done
echo "[]"
exit 0
`;
  writeFileSync(fakeGh, script, 'utf8');
  chmodSync(fakeGh, 0o755);
  return fakeGh;
}

/**
 * Subset-respecting fake dup-detect: writes the received MO_UMBRELLA_SUBSET to `probeFile`
 * (so the test can assert which umbrellas reached the expensive scan), and — mirroring the
 * real dup-detect.sh contract — when MO_UMBRELLA_SUBSET is set it scans ONLY those names.
 * Emits POTENTIAL_DUPE for `jaccardName`; OK for the rest.
 */
function makeSubsetAwareDupDetect(
  sandboxRoot: string,
  probeFile: string,
  jaccardName: string,
  prNum: number,
  score: number,
): string {
  const fakeDup = join(sandboxRoot, 'fake-dup-detect-subset.sh');
  const script = `#!/usr/bin/env bash
PROBE="${probeFile}"
printf '%s' "\${MO_UMBRELLA_SUBSET:-}" > "\$PROBE"
emit() {
  local name="\$1"
  if [[ "\$name" == "${jaccardName}" ]]; then
    echo "POTENTIAL_DUPE: \$name may overlap with merged #${prNum} \\"t\\" (basis=jaccard score=${score}%)"
  else
    echo "OK: \$name no dup-detect signal vs merged-PRs-30d"
  fi
}
if [[ -n "\${MO_UMBRELLA_SUBSET:-}" ]]; then
  for name in \${MO_UMBRELLA_SUBSET}; do emit "\$name"; done
else
  REPO_ROOT="\${REPO_ROOT:-}"
  for d in "\${REPO_ROOT}/.claude/orchestrator-prompts"/*/; do emit "\$(basename "\$d")"; done
fi
exit 0
`;
  writeFileSync(fakeDup, script, 'utf8');
  chmodSync(fakeDup, 0o755);
  return fakeDup;
}

function runHelper(
  sandboxRoot: string,
  fakeGh: string,
  extraEnv: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HELPER], {
    encoding: 'utf8',
    env: { ...process.env, REPO_ROOT: sandboxRoot, MO_GH_BIN: fakeGh, ...extraEnv },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function lineFor(stdout: string, name: string): string | undefined {
  return stdout.split('\n').find((l) => l.startsWith(`${name} `));
}

describe('priority-score.sh — skip-closed optimisation (AC-1 + AC-2)', { timeout: SLOW_SHELL_MS }, () => {
  it('excludes cheap-closed (done.md + branch) from the C2 subset, keeps C2-only + open in it; DONE-membership unchanged', () => {
    // Targets priority-score.sh skip-closed pre-filter block:
    //   _open_survivors = umbrellas with kickoff.md, NO done.md, NO merged-branch match
    //   dup-detect called with MO_UMBRELLA_SUBSET="${_open_survivors}"
    const sandbox = makeSandbox();
    setupRepo(sandbox, [
      'done-md-umbrella', // cheap-closed via C3 done.md
      'branch-umbrella', // cheap-closed via C1 merged-branch match
      'c2-only-umbrella', // closed ONLY by C2 jaccard (no done.md, no branch)
      'open-umbrella', // genuinely open (all layers miss)
    ]);
    writeDoneMd(sandbox, 'done-md-umbrella', 777);
    const fakeGh = makeFakeGh(
      sandbox,
      JSON.stringify([{ number: 999, headRefName: 'feat/branch-umbrella' }]),
    );
    const probeFile = join(sandbox, 'subset-probe.txt');
    const fakeDup = makeSubsetAwareDupDetect(
      sandbox,
      probeFile,
      'c2-only-umbrella',
      600,
      50,
    );

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    expect(r.status).toBe(0);

    // ── AC-1: the expensive scan input excludes cheap-closed umbrellas ──
    expect(existsSync(probeFile)).toBe(true);
    const subset = readFileSync(probeFile, 'utf8').split(/\s+/).filter(Boolean);
    expect(subset).toContain('c2-only-umbrella');
    expect(subset).toContain('open-umbrella');
    expect(subset).not.toContain('done-md-umbrella'); // C3 cheap-closed → not scanned
    expect(subset).not.toContain('branch-umbrella'); // C1 cheap-closed → not scanned

    // ── AC-2: DONE-membership is unchanged by the optimisation ──
    // C3 cheap-closed still DONE (via done-md, not C2):
    expect(r.stdout).toMatch(/done-md-umbrella .* status=DONE done_pr=777 basis=done-md/);
    // C1 cheap-closed still DONE (via branch, not C2):
    expect(r.stdout).toMatch(/branch-umbrella .* status=DONE done_pr=999 basis=branch/);
    // C2-ONLY survives the filter and is STILL classified DONE (the load-bearing invariant):
    expect(r.stdout).toMatch(/c2-only-umbrella .* status=DONE done_pr=600 basis=jaccard/);
    // Paired-negative: genuinely-open umbrella stays a candidate (no DONE):
    const openLine = lineFor(r.stdout, 'open-umbrella');
    expect(openLine).toBeDefined();
    expect(openLine).not.toMatch(/status=DONE/);
    expect(openLine).not.toMatch(/done_pr=/);
  });

  it('PAIRED-NEGATIVE (no cheap-closed): with no done.md and no branch-match, ALL umbrellas reach the C2 subset', () => {
    // Proves the filter does not OVER-exclude: when nothing is cheap-closed, the subset
    // equals the full candidate set, so the C2 scan still sees every umbrella.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['alpha', 'beta', 'gamma']);
    const fakeGh = makeFakeGh(sandbox, '[]'); // no merged PRs → no branch match
    const probeFile = join(sandbox, 'subset-probe.txt');
    // jaccardName intentionally matches none → all OK, but the subset still records membership
    const fakeDup = makeSubsetAwareDupDetect(sandbox, probeFile, '__none__', 0, 0);

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    expect(r.status).toBe(0);
    const subset = readFileSync(probeFile, 'utf8').split(/\s+/).filter(Boolean);
    expect(subset.sort()).toEqual(['alpha', 'beta', 'gamma']);
    // None are DONE (all three layers miss) — paired-negative for the whole classifier.
    for (const n of ['alpha', 'beta', 'gamma']) {
      expect(lineFor(r.stdout, n)).not.toMatch(/status=DONE/);
    }
  });

  it('EDGE (all cheap-closed): every umbrella has done.md → dup-detect is NOT invoked, all still DONE', () => {
    // When _open_survivors is empty, priority-score.sh skips the dup-detect call entirely
    // (the `-n "${_open_survivors}"` guard) — the C2 scan has nothing to find. The fake
    // dup-detect therefore never runs, so the probe file is never written.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['closed-a', 'closed-b']);
    writeDoneMd(sandbox, 'closed-a', 11);
    writeDoneMd(sandbox, 'closed-b', 22);
    const fakeGh = makeFakeGh(sandbox, '[]');
    const probeFile = join(sandbox, 'subset-probe.txt');
    const fakeDup = makeSubsetAwareDupDetect(sandbox, probeFile, '__none__', 0, 0);

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    expect(r.status).toBe(0);
    // dup-detect was never invoked (no open survivors) → probe absent:
    expect(existsSync(probeFile)).toBe(false);
    // Both umbrellas still DONE via C3 done-md:
    expect(r.stdout).toMatch(/closed-a .* status=DONE done_pr=11 basis=done-md/);
    expect(r.stdout).toMatch(/closed-b .* status=DONE done_pr=22 basis=done-md/);
  });
});
