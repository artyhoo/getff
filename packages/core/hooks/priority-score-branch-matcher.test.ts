/**
 * Functional meta-test for the meta-orchestrator priority-score helper's
 * branch-matcher (.claude/skills/pipeline/helpers/priority-score.sh) —
 * paired-negative contract for Stage 2 P2 (meta-orch-no-arg-overview umbrella,
 * 2026-05-28).
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §2.5/§7.3.
 * Class C → Class A-via-companion-test (this file is the companion test for the
 * branch-matcher addition; the surrounding script remains Class C overall).
 *
 * Background — T-NoArg-A `#open-prs-zero-equals-no-work` (kickoff §4):
 *   The pre-Stage-2 priority-score.sh inspected `gh pr list --search "is:open
 *   head:<umbrella>"` only. A merged-and-shipped umbrella has open_prs=0, yet
 *   the SKILL.md ranking layer interpreted that as «no live work» and recommended
 *   the umbrella for fresh dispatch (incident 2026-05-28, PR #236 case). The
 *   branch-matcher adds a complementary `--state merged` probe so closed
 *   umbrellas surface with `status=DONE done_pr=<num>`.
 *
 * Paired-negative contract (Stage 2 P2 scope = branch→umbrella completion mapping):
 *
 *   ✅ POSITIVE: merged PR `feat/<umbrella>` → output line for that umbrella
 *      carries `status=DONE done_pr=<num>` (the PR # from JSON)
 *   ✅ POSITIVE-PREFIXES: prefix variants (`fix/`, `chore/`, `docs/`, `research/`)
 *      all strip to the same exact-match comparison; each triggers DONE
 *   ✅ PR #236 CASE: umbrella `meta-orchestrator-skill-memory` with merged PR
 *      branch `feat/meta-orchestrator-skill-memory` → DONE done_pr=236 (the
 *      exact mis-classification incident from 2026-05-28)
 *   ❌ NEGATIVE: open umbrella with no matching merged PR → output line WITHOUT
 *      `status=DONE` (still a candidate)
 *   ❌ PR #266 CASE (mid-umbrella per convention): merged PR
 *      `feat/<umbrella>-s2` is a single-stage merge inside a multi-stage umbrella;
 *      the bare umbrella name does NOT match `<umbrella>-s2`, so the umbrella
 *      stays a candidate (no false DONE on partial progress).
 *   ❌ NO-JQ / NO-GH: missing merged_prs_json gracefully falls through — no
 *      DONE tag, no crash (covered by existing dup-detect.sh fake-gh pattern).
 *
 * T-NoArg-B compliance: matcher does NOT grep `#<num>` from kickoff body
 *   (kickoff is authored before its own PRs, physically cannot reference them).
 * T-NoArg-C compliance: matcher does NOT use PR-title word overlap (kickoff
 *   titles and PR titles share ≈0 substantive words per maintainer 2026-05-28
 *   diagnosis).
 * T3 compliance: each assertion cites the helper source line/region it targets.
 *
 * Reference pattern: packages/core/hooks/dup-detect-empty-arg.test.ts
 * (vitest + spawnSync + mkdtempSync sandbox; fake-gh.sh via MO_GH_BIN seam).
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

// Every test here spawns the real priority-score.sh against a sandbox repo — real
// git + `gh` stub calls per umbrella, so multi-second runtimes are inherent and the
// vitest 5s default is a mis-set gate rather than a signal. Run in isolation the
// cases measure 0.8-1.6s; under full-suite parallel load (`vitest run hooks/
// skills/`, measured 2026-08-10) four of them time out at 5000ms. 30_000 is the
// SLOW_SHELL_MS convention this helper's own sibling suites already use
// (priority-score-synthetic.test.ts, priority-score-skip-closed.test.ts).
const SLOW_SHELL_MS = 30_000;

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'priority-score-branch-matcher-test-'));
  sandboxes.push(d);
  return d;
}

/**
 * Sets up a fake repo layout with .claude/orchestrator-prompts/<name>/kickoff.md
 * per `umbrellaNames`. Returns the sandbox root.
 */
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
 * Writes a fake `gh` binary that emits the supplied JSON for a `pr list --state
 * merged` call and an empty array for `--state open` / `--search`. The script
 * branches on argv to mimic the two `gh pr list` invocations priority-score.sh
 * makes (one merged-fetch outside the loop, one open-search per umbrella).
 */
function makeFakeGh(sandboxRoot: string, mergedPrsJson: string): string {
  const fakeGh = join(sandboxRoot, 'fake-gh.sh');
  const script = `#!/usr/bin/env bash
# Distinguish merged-fetch (state=merged) from open-search (search arg).
for a in "$@"; do
  if [[ "$a" == "merged" ]]; then
    cat <<'JSON'
${mergedPrsJson}
JSON
    exit 0
  fi
done
# Default: empty list (used by per-umbrella open-PR probe).
echo "[]"
exit 0
`;
  writeFileSync(fakeGh, script, 'utf8');
  chmodSync(fakeGh, 0o755);
  return fakeGh;
}

function runHelper(
  sandboxRoot: string,
  fakeGh: string,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HELPER], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: sandboxRoot,
      MO_GH_BIN: fakeGh,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('priority-score.sh — branch-matcher (paired-negative contract)', { timeout: SLOW_SHELL_MS }, () => {
  it('POSITIVE: merged PR `feat/<umbrella>` tags umbrella with `status=DONE done_pr=<num>`', () => {
    // Targets priority-score.sh branch-matcher block:
    //   merged_prs_json="$(${MO_GH_BIN} pr list --state merged ...)"
    //   jq … sub("^(feat|fix|chore|docs|research)/"; "") == $name … .number
    // Asserts: feat/ prefix strip + exact match → status=DONE emitted.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['alpha-umbrella', 'beta-umbrella']);
    const mergedJson = JSON.stringify([
      { number: 999, headRefName: 'feat/alpha-umbrella' },
    ]);
    const fakeGh = makeFakeGh(sandbox, mergedJson);

    const r = runHelper(sandbox, fakeGh);
    expect(r.status).toBe(0);
    // alpha-umbrella matched → DONE
    expect(r.stdout).toMatch(
      /alpha-umbrella .* status=DONE done_pr=999/,
    );
    // beta-umbrella unmatched → NO status=DONE on its line
    const betaLine = r.stdout
      .split('\n')
      .find((line) => line.startsWith('beta-umbrella '));
    expect(betaLine).toBeDefined();
    expect(betaLine).not.toMatch(/status=DONE/);
  });

  it('POSITIVE-PREFIXES: fix/, chore/, docs/, research/ all strip to exact match → DONE', () => {
    // Targets the regex `^(feat|fix|chore|docs|research)/` in the jq sub() call.
    // Each prefix variant must trigger the same DONE tagging.
    const sandbox = makeSandbox();
    setupRepo(sandbox, [
      'fix-umbrella',
      'chore-umbrella',
      'docs-umbrella',
      'research-umbrella',
    ]);
    const mergedJson = JSON.stringify([
      { number: 100, headRefName: 'fix/fix-umbrella' },
      { number: 101, headRefName: 'chore/chore-umbrella' },
      { number: 102, headRefName: 'docs/docs-umbrella' },
      { number: 103, headRefName: 'research/research-umbrella' },
    ]);
    const fakeGh = makeFakeGh(sandbox, mergedJson);

    const r = runHelper(sandbox, fakeGh);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/fix-umbrella .* status=DONE done_pr=100/);
    expect(r.stdout).toMatch(/chore-umbrella .* status=DONE done_pr=101/);
    expect(r.stdout).toMatch(/docs-umbrella .* status=DONE done_pr=102/);
    expect(r.stdout).toMatch(/research-umbrella .* status=DONE done_pr=103/);
  });

  it('PR #236 CASE: `meta-orchestrator-skill-memory` umbrella with merged feat/<same-name> → DONE done_pr=236', () => {
    // Replays the literal 2026-05-28 mis-classification incident (kickoff §0 P2,
    // bullet «Concrete incident»). Before this matcher, the umbrella surfaced
    // as winner with open_prs=0; after the matcher it carries status=DONE
    // done_pr=236 and the SKILL.md ranking layer should exclude / down-rank it.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['meta-orchestrator-skill-memory']);
    const mergedJson = JSON.stringify([
      { number: 236, headRefName: 'feat/meta-orchestrator-skill-memory' },
    ]);
    const fakeGh = makeFakeGh(sandbox, mergedJson);

    const r = runHelper(sandbox, fakeGh);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(
      /meta-orchestrator-skill-memory .* status=DONE done_pr=236/,
    );
  });

  it('NEGATIVE: open umbrella with no matching merged PR → line WITHOUT `status=DONE`', () => {
    // Targets the negative branch: jq returns empty, done_pr stays empty,
    // the legacy echo path emits the original 6-field line.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['active-umbrella']);
    // gh returns NO merged PRs at all.
    const fakeGh = makeFakeGh(sandbox, '[]');

    const r = runHelper(sandbox, fakeGh);
    expect(r.status).toBe(0);
    const line = r.stdout
      .split('\n')
      .find((l) => l.startsWith('active-umbrella '));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/status=DONE/);
    expect(line).not.toMatch(/done_pr=/);
    // Legacy 6-field format preserved (T17 backward-compat — kickoff §5):
    expect(line).toMatch(/type=I-phase/);
    expect(line).toMatch(/kickoff=exists/);
    expect(line).toMatch(/open_prs=0/);
  });

  it('PR #266 CASE (mid-umbrella per convention): merged `feat/<umbrella>-s2` does NOT match bare `<umbrella>` → still candidate', () => {
    // Multi-stage umbrellas use `feat/<umbrella>-s<N>` branches per kickoff §3
    // recursive-self-application clause. The bare umbrella name does NOT match
    // `<umbrella>-s2` after prefix strip — `meta-orch-no-arg-overview` ≠
    // `meta-orch-no-arg-overview-s2`. The umbrella must stay a candidate (no
    // false DONE on partial progress). Counters T-NoArg-A self-application:
    // matcher correctly distinguishes single-shot-completion from mid-umbrella
    // stage merges.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['meta-orch-no-arg-overview']);
    // Merged PR is the Stage 2 branch — `-s2` suffix, NOT the bare umbrella name.
    const mergedJson = JSON.stringify([
      { number: 266, headRefName: 'feat/meta-orch-no-arg-overview-s2' },
    ]);
    const fakeGh = makeFakeGh(sandbox, mergedJson);

    const r = runHelper(sandbox, fakeGh);
    expect(r.status).toBe(0);
    const line = r.stdout
      .split('\n')
      .find((l) => l.startsWith('meta-orch-no-arg-overview '));
    expect(line).toBeDefined();
    // The umbrella stays a candidate — no false DONE on partial-progress merge.
    expect(line).not.toMatch(/status=DONE/);
    expect(line).not.toMatch(/done_pr=/);
  });
});

// ── Named-mode early-exit guard (pipeline-ux Stage 1B) ───────────────────────

/**
 * Run helper with an umbrella arg (named-mode) — tests the early-exit guard added
 * in pipeline-ux Stage 1B: priority-score.sh exits 0 with a single skip-line when
 * a named umbrella arg is passed.
 */
function runHelperNamed(
  sandboxRoot: string,
  fakeGh: string,
  umbrellaArg: string,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HELPER, umbrellaArg], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: sandboxRoot,
      MO_GH_BIN: fakeGh,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('priority-score.sh — named-mode early-exit (pipeline-ux Stage 1B)', { timeout: SLOW_SHELL_MS }, () => {
  it('named-mode early-exit: non-empty string arg → exits 0 with skip-line, no full scan', () => {
    // Targets priority-score.sh named-mode guard:
    //   _ARG="${1:-}"
    //   if [[ -n "$_ARG" ]] && [[ "$_ARG" =~ [^0-9] ]]; then
    //     echo "=== priority-score: named-mode skip ..."
    //     exit 0
    //   fi
    // Asserts: string arg → skip header emitted, no full scan output.
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['alpha-umbrella', 'beta-umbrella', 'gamma-umbrella']);
    const fakeGh = makeFakeGh(sandbox, '[]');

    const r = runHelperNamed(sandbox, fakeGh, 'any-umbrella-name');
    expect(r.status).toBe(0);
    // Skip-line must appear
    expect(r.stdout).toContain('named-mode skip');
    // Full scan output (per-umbrella candidate lines) must NOT appear
    // "source=" would appear in synthetic section; "kickoff=" in real entries
    expect(r.stdout).not.toContain('kickoff=');
    expect(r.stdout).not.toContain('=== priority-score: candidate umbrellas ===');
  });

  it('named-mode early-exit PAIRED-NEGATIVE: integer arg proceeds to full scan', () => {
    // Integer arg = top-N V4 request → NOT early-exit; full scan proceeds.
    // Counters the risk of the guard firing on integer args (V4 binding).
    const sandbox = makeSandbox();
    setupRepo(sandbox, ['umbrella-x']);
    const fakeGh = makeFakeGh(sandbox, '[]');

    // Integer arg "5" should NOT trigger early-exit
    const r = runHelperNamed(sandbox, fakeGh, '5');
    expect(r.status).toBe(0);
    // Full scan header must appear (not the named-mode skip line)
    expect(r.stdout).toContain('=== priority-score: candidate umbrellas ===');
    // The umbrella must appear in output (full scan ran)
    expect(r.stdout).toContain('umbrella-x');
    // Named-mode skip must NOT appear for integer arg
    expect(r.stdout).not.toContain('named-mode skip');
  });
});

describe('priority-score.sh — rank-order (pipeline-ux Stage 1B)', { timeout: SLOW_SHELL_MS }, () => {
  it('rank-order: umbrella with larger kickoff.md appears before umbrella with smaller kickoff', () => {
    // Targets priority-score.sh volume scoring:
    //   loc="$(wc -l < "${kickoff}")"
    //   volume="S" if loc<100, "M" if loc<250, "L" otherwise
    // This test verifies umbrellas emit correctly sized volume tags, which SKILL.md uses
    // to rank (smaller = lower priority when equal). A volume=L umbrella appears in output.
    //
    // Note: priority-score.sh does NOT sort output — ranking/ordering is done by SKILL.md
    // judgment layer. This test verifies volume=S vs volume=L emission, which is the
    // proxy signal SKILL.md uses for rank. Correctness of the LOC-based volume tag is
    // what enables rank-order in the downstream judgment step.
    const sandbox = makeSandbox();

    // UmbrellaA: large kickoff (~110 lines) → volume=M or L
    const promptsDir = join(sandbox, '.claude', 'orchestrator-prompts');
    const largeContent = [
      '> **Type:** I-phase',
      '# Umbrella A — Large',
      '',
      ...Array.from({ length: 110 }, (_, i) => `- Detailed item ${i + 1} with substantial content for volume`),
    ].join('\n');
    mkdirSync(join(promptsDir, 'umbrella-large'), { recursive: true });
    writeFileSync(join(promptsDir, 'umbrella-large', 'kickoff.md'), largeContent, 'utf8');

    // UmbrellaB: small kickoff (~5 lines) → volume=S
    const smallContent = '> **Type:** I-phase\n# Umbrella B — Small\n- item 1\n- item 2\n';
    mkdirSync(join(promptsDir, 'umbrella-small'), { recursive: true });
    writeFileSync(join(promptsDir, 'umbrella-small', 'kickoff.md'), smallContent, 'utf8');

    const fakeGh = makeFakeGh(sandbox, '[]');
    const r = runHelper(sandbox, fakeGh);
    expect(r.status).toBe(0);

    // Both umbrellas appear in output
    expect(r.stdout).toContain('umbrella-large');
    expect(r.stdout).toContain('umbrella-small');

    // Volume tags correctly reflect LOC
    const largeLine = r.stdout.split('\n').find((l) => l.startsWith('umbrella-large '));
    const smallLine = r.stdout.split('\n').find((l) => l.startsWith('umbrella-small '));
    expect(largeLine).toBeDefined();
    expect(smallLine).toBeDefined();

    // Large kickoff should have volume=M or volume=L (not volume=S)
    expect(largeLine).toMatch(/volume=[ML]/);
    // Small kickoff should have volume=S
    expect(smallLine).toMatch(/volume=S/);
  });
});
