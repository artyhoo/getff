/**
 * Functional meta-test for the meta-orchestrator priority-score helper's
 * tri-layer completion-detection classifier — Layers C2 (jaccard REUSE) and
 * C3 (done.md convention) added in Stage 2-extend of meta-orch-no-arg-overview
 * umbrella (2026-05-29).
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §2.5/§7.3.
 *
 * Background (§4 Stage 2 mechanism confirmation from research-patch
 * 2026-05-29-meta-orch-no-arg-overview-s0-remainder.md):
 *   §1.5c empirical audit of 100 merged PRs: 13% branch-matchable (Layer C1),
 *   4% jaccard-title-only (Layer C2), 83% no-match (Layer C3 = load-bearing fallback).
 *   Layer C1 alone insufficient as sole signal. Multi-signal classifier with C1→C2→C3
 *   first-match-wins order closes the coverage gap.
 *
 * Completion-detection Layer C2 (jaccard REUSE — priority-score.sh:C2 block):
 *   REUSEs dup-detect.sh jaccard logic via sub-shell call (approach a, not shared helper).
 *   Parses "POTENTIAL_DUPE: <umbrella> may overlap with merged #<num>..." lines.
 *   MO_DUP_DETECT_BIN seam used for deterministic test injection.
 *
 * Completion-detection Layer C3 (done.md convention — priority-score.sh:C3 block):
 *   ADAPT Cline Memory Bank committed-markdown sub-pattern (SSOT #77 ~85% match).
 *   Checks .claude/orchestrator-prompts/<umbrella>/done.md existence.
 *   Parses "- Final PR: #<num>" line; tags status=DONE done_pr=<num> basis=done-md.
 *
 * Paired-negative contract (6 cases):
 *
 *   Case 1 — C2 POSITIVE: umbrella with merged PR title sharing ≥threshold% jaccard
 *     → DONE done_pr=<num> basis=jaccard (L1 not matched)
 *   Case 2 — C2 NEGATIVE: umbrella with zero jaccard overlap → still candidate (no DONE)
 *   Case 3 — C3 POSITIVE: umbrella with valid done.md → DONE done_pr=<num> basis=done-md
 *   Case 4 — C3 NEGATIVE: no done.md → still candidate (no DONE tag)
 *   Case 5 — COMBINED: C1 fail + C2 hit → DONE; separate: C1 fail + C2 fail + C3 hit → DONE
 *   Case 6 — ALL LAYERS FAIL: no branch match, no jaccard, no done.md → still candidate
 *     (paired-negative for the negative space — principle 15 paired-negative discipline)
 *
 * T3 compliance: each assertion cites the helper source line/region it targets.
 * T11/T12: L2 jaccard is REUSE (dup-detect.sh:62); no reimplementation.
 * T16: SSOT #77 Cline problem-class match ~85% cited above.
 * T17: priority-score.sh Layer C1 (branch-matcher) from #272 preserved verbatim.
 *
 * Reference pattern: packages/core/hooks/priority-score-branch-matcher.test.ts (#272)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
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
  const d = mkdtempSync(join(tmpdir(), 'done-md-completion-filter-test-'));
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

/**
 * Writes done.md with the binding schema:
 *   # <umbrella> — DONE
 *   - Final PR: #<num>
 *   - Closed: <date>
 *   - Summary: <summary>
 */
function writeDoneMd(
  sandboxRoot: string,
  umbrellaName: string,
  prNum: number,
  date = '2026-05-29',
  summary = 'Completed all stages',
): void {
  const dir = join(sandboxRoot, '.claude', 'orchestrator-prompts', umbrellaName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'done.md'),
    `# ${umbrellaName} — DONE\n- Final PR: #${prNum}\n- Closed: ${date}\n- Summary: ${summary}\n`,
    'utf8',
  );
}

/**
 * Creates a fake `gh` binary that returns empty merged list (used when we want
 * C1 + C2 to fail and only C3 to fire).
 */
function makeFakeGhEmpty(sandboxRoot: string): string {
  const fakeGh = join(sandboxRoot, 'fake-gh-empty.sh');
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env bash\necho "[]"\nexit 0\n`,
    'utf8',
  );
  chmodSync(fakeGh, 0o755);
  return fakeGh;
}

/**
 * Creates a fake `gh` binary returning specified merged PRs JSON (for C1/C2 tests).
 */
function makeFakeGh(sandboxRoot: string, mergedPrsJson: string, suffix = ''): string {
  const fakeGh = join(sandboxRoot, `fake-gh${suffix}.sh`);
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
 * Creates a fake dup-detect.sh binary that emits POTENTIAL_DUPE for specific umbrellas.
 * Maps umbrella name → { prNum, score }. Other umbrellas get "OK: ..." lines.
 */
function makeFakeDupDetect(
  sandboxRoot: string,
  matches: Record<string, { prNum: number; score: number }>,
  suffix = '',
): string {
  const fakeDup = join(sandboxRoot, `fake-dup-detect${suffix}.sh`);
  // Build the case statement entries
  const caseEntries = Object.entries(matches)
    .map(
      ([name, { prNum, score }]) =>
        `  if echo "$output" | grep -q "^${name}$" 2>/dev/null || [[ -z "$output" ]]; then\n` +
        `    echo "POTENTIAL_DUPE: ${name} may overlap with merged #${prNum} \\"some title\\" (basis=jaccard score=${score}%)"\n` +
        `  fi`,
    )
    .join('\n');

  // Generate known POTENTIAL_DUPE names for the non-match guard
  const matchedNames = Object.keys(matches)
    .map((n) => `"${n}"`)
    .join(' ');

  const script = `#!/usr/bin/env bash
# Fake dup-detect.sh for testing Layer C2 jaccard in priority-score.sh
# Emits POTENTIAL_DUPE lines for matched umbrellas; OK lines for others.
REPO_ROOT="\${REPO_ROOT:-}"
PROMPTS_DIR="\${REPO_ROOT}/.claude/orchestrator-prompts"

if [[ "\${1:-}" == "--all" || -z "\${1:-}" ]]; then
  matched=(${matchedNames})
  for d in "\${PROMPTS_DIR}"/*/; do
    name="\$(basename "\${d}")"
    found=0
    for m in "\${matched[@]:-}"; do
      [[ "\$m" == "\$name" ]] && found=1 && break
    done
    if [[ "\$found" -eq 1 ]]; then
      # emit POTENTIAL_DUPE for this umbrella using the configured values
${caseEntries.split('\n').map((l) => '      ' + l).join('\n')}
    else
      echo "OK: \${name} no dup-detect signal vs merged-PRs-30d"
    fi
  done
else
  name="\$1"
  found=0
  for m in \${matched[@]:-}; do [[ "\$m" == "\$name" ]] && found=1 && break; done
  if [[ "\$found" -eq 1 ]]; then
${caseEntries.split('\n').map((l) => '    ' + l).join('\n')}
  else
    echo "OK: \${name} no dup-detect signal vs merged-PRs-30d"
  fi
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
    env: {
      ...process.env,
      REPO_ROOT: sandboxRoot,
      MO_GH_BIN: fakeGh,
      ...extraEnv,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('done-md-completion-filter — Layer C2 + C3 paired-negative contract', { timeout: SLOW_SHELL_MS }, () => {
  it('Case 1 — C2 POSITIVE: jaccard POTENTIAL_DUPE match → status=DONE done_pr=<num> basis=jaccard', () => {
    // Targets priority-score.sh completion Layer C2 block:
    //   _dup_detect_all_output=$(MO_DUP_DETECT_BIN ... --all)
    //   grep "^POTENTIAL_DUPE: ${name} " → extract merged #<num>
    //   done_basis="jaccard..."
    // C1 does NOT match (no merged PR with exact branch name after prefix-strip).
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['jaccard-hit-umbrella', 'jaccard-miss-umbrella']);
    const fakeGh = makeFakeGhEmpty(sandbox);
    // C2: jaccard hit for 'jaccard-hit-umbrella' only
    const fakeDup = makeFakeDupDetect(sandbox, {
      'jaccard-hit-umbrella': { prNum: 500, score: 45 },
    });

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    expect(r.status).toBe(0);
    // jaccard-hit-umbrella matched via C2 → DONE with jaccard basis
    expect(r.stdout).toMatch(/jaccard-hit-umbrella .* status=DONE done_pr=500/);
    expect(r.stdout).toMatch(/jaccard-hit-umbrella .* basis=jaccard/);
    // jaccard-miss-umbrella has no match → no DONE tag
    const missLine = r.stdout.split('\n').find((l) => l.startsWith('jaccard-miss-umbrella '));
    expect(missLine).toBeDefined();
    expect(missLine).not.toMatch(/status=DONE/);
  });

  it('Case 2 — C2 NEGATIVE: zero jaccard overlap → still candidate (no DONE tag)', () => {
    // Targets the negative path in C2: _dup_detect_all_output has only "OK: ..." lines,
    // no POTENTIAL_DUPE for the umbrella → done_pr stays empty, C3 also skipped (no done.md).
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['no-match-umbrella']);
    const fakeGh = makeFakeGhEmpty(sandbox);
    // C2: no POTENTIAL_DUPE lines at all (dup-detect returns only OK)
    const fakeDup = makeFakeDupDetect(sandbox, {});

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    expect(r.status).toBe(0);
    const line = r.stdout.split('\n').find((l) => l.startsWith('no-match-umbrella '));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/status=DONE/);
    expect(line).not.toMatch(/done_pr=/);
    // Legacy fields still present (T17 backward-compat)
    expect(line).toMatch(/kickoff=exists/);
  });

  it('Case 3 — C3 POSITIVE: valid done.md → status=DONE done_pr=<num> basis=done-md', () => {
    // Targets priority-score.sh completion Layer C3 block:
    //   [[ -f "${dir}done.md" ]] → grep "Final PR: #<num>" → done_basis="done-md"
    // Both C1 and C2 intentionally miss so only C3 fires.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['done-md-umbrella', 'active-umbrella']);
    writeDoneMd(sandbox, 'done-md-umbrella', 777);
    const fakeGh = makeFakeGhEmpty(sandbox);
    const fakeDup = makeFakeDupDetect(sandbox, {});

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    expect(r.status).toBe(0);
    // done-md-umbrella has done.md → DONE via Layer C3
    expect(r.stdout).toMatch(/done-md-umbrella .* status=DONE done_pr=777/);
    expect(r.stdout).toMatch(/done-md-umbrella .* basis=done-md/);
    // active-umbrella has no done.md → still candidate
    const activeLine = r.stdout.split('\n').find((l) => l.startsWith('active-umbrella '));
    expect(activeLine).toBeDefined();
    expect(activeLine).not.toMatch(/status=DONE/);
  });

  it('Case 4 — C3 NEGATIVE: no done.md → still candidate (no DONE tag)', () => {
    // Paired-negative for Case 3: same umbrella WITHOUT done.md should stay a candidate.
    // Neither C1, C2, nor C3 fires → umbrella surfaced as an open candidate.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['no-done-md-umbrella']);
    // No done.md written for 'no-done-md-umbrella'
    const fakeGh = makeFakeGhEmpty(sandbox);
    const fakeDup = makeFakeDupDetect(sandbox, {});

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    expect(r.status).toBe(0);
    const line = r.stdout.split('\n').find((l) => l.startsWith('no-done-md-umbrella '));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/status=DONE/);
    expect(line).not.toMatch(/done_pr=/);
    expect(line).not.toMatch(/basis=/);
  });

  it('Case 3b — C3 n/a: done.md with "Final PR: n/a" → status=DONE done_pr=n/a basis=done-md', () => {
    // Regression for the 2026-06-16 closure-sweep fix. A stale/superseded closure carries
    // "- Final PR: n/a" (no numeric PR). done.md existence ALONE proves closure, so C3 MUST
    // still tag DONE. Pre-fix bug: such n/a closures (e.g. the 2026-06-05 sweep) stayed
    // false-open because the layer only tagged DONE when it parsed a numeric PR.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['na-done-umbrella', 'active-umbrella']);
    const dir = join(sandbox, '.claude', 'orchestrator-prompts', 'na-done-umbrella');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'done.md'),
      `# na-done-umbrella — DONE\n- Final PR: n/a (superseded)\n- Closed: 2026-06-05\n- Summary: scope absorbed elsewhere\n`,
      'utf8',
    );
    const fakeGh = makeFakeGhEmpty(sandbox);
    const fakeDup = makeFakeDupDetect(sandbox, {});

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    expect(r.status).toBe(0);
    // na-done-umbrella has done.md (n/a PR) → still DONE via Layer C3
    expect(r.stdout).toMatch(/na-done-umbrella .* status=DONE done_pr=n\/a basis=done-md/);
    // active-umbrella has no done.md → still candidate (paired-negative)
    const activeLine = r.stdout.split('\n').find((l) => l.startsWith('active-umbrella '));
    expect(activeLine).not.toMatch(/status=DONE/);
  });

  it('Case 5 — COMBINED: C1 fail + C2 hit → DONE; C1 fail + C2 fail + C3 hit → DONE', () => {
    // Verifies first-match-wins ordering: when C1 misses but C2 or C3 matches, DONE is emitted.
    // Also verifies that C3 still fires when both C1 and C2 miss.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['c2-only-umbrella', 'c3-only-umbrella', 'all-miss-umbrella']);
    // done.md for 'c3-only-umbrella'
    writeDoneMd(sandbox, 'c3-only-umbrella', 888);
    const fakeGh = makeFakeGhEmpty(sandbox); // C1 misses for all
    // C2 hits only 'c2-only-umbrella'
    const fakeDup = makeFakeDupDetect(sandbox, {
      'c2-only-umbrella': { prNum: 600, score: 50 },
    });

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    expect(r.status).toBe(0);
    // c2-only-umbrella: C1 miss, C2 hit → DONE via jaccard
    expect(r.stdout).toMatch(/c2-only-umbrella .* status=DONE done_pr=600/);
    expect(r.stdout).toMatch(/c2-only-umbrella .* basis=jaccard/);
    // c3-only-umbrella: C1 miss, C2 miss, C3 hit → DONE via done-md
    expect(r.stdout).toMatch(/c3-only-umbrella .* status=DONE done_pr=888/);
    expect(r.stdout).toMatch(/c3-only-umbrella .* basis=done-md/);
    // all-miss-umbrella: all 3 layers miss → still candidate
    const allMissLine = r.stdout.split('\n').find((l) => l.startsWith('all-miss-umbrella '));
    expect(allMissLine).toBeDefined();
    expect(allMissLine).not.toMatch(/status=DONE/);
  });

  it('Case 6 — ALL LAYERS FAIL: no branch match, no jaccard, no done.md → still candidate (pure negative space)', () => {
    // Paired-negative for the entire classifier: when all three layers fail,
    // the umbrella MUST NOT be marked DONE. Verifies the negative space contract
    // per principle 15 paired-negative discipline.
    // This is the canonical "open umbrella" case used by SKILL.md ranking.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['genuinely-open-umbrella']);
    const fakeGh = makeFakeGhEmpty(sandbox); // C1: no merged PRs
    const fakeDup = makeFakeDupDetect(sandbox, {}); // C2: no POTENTIAL_DUPE

    const r = runHelper(sandbox, fakeGh, { MO_DUP_DETECT_BIN: fakeDup });
    // C3: no done.md (none written)
    expect(r.status).toBe(0);
    const line = r.stdout.split('\n').find((l) => l.startsWith('genuinely-open-umbrella '));
    expect(line).toBeDefined();
    // MUST be a pure candidate line — no DONE, no done_pr, no basis
    expect(line).not.toMatch(/status=DONE/);
    expect(line).not.toMatch(/done_pr=/);
    expect(line).not.toMatch(/basis=/);
    // Verify standard kickoff fields are present (backward-compat with Layer C1 test #272)
    expect(line).toMatch(/type=/);
    expect(line).toMatch(/kickoff=exists/);
    expect(line).toMatch(/open_prs=/);
  });
});
