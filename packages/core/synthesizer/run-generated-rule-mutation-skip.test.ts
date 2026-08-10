/**
 * Paired-negative test for run-generated-rule-mutation.sh skip-counter +
 * non-PASS polarity (getff-honest-signals S1).
 *
 * The umbrella's defect class is `#skip-reported-as-green`: the pre-fix runner
 * reported PASS/exit-0 even when every rule was skipped (zero actual testing).
 * This suite proves the post-fix runner exits NON-ZERO with `skipped=N — NOT green`
 * for both skip paths:
 *   - `:172` malformed (empty id/selector/input after node extraction)
 *   - `:182` selector-not-firing (valid selector that doesn't match the input)
 *
 * T-HS-A (binding, umbrella-level): asserts the EXIT CODE first, message wording
 * second. A test that greps wording but lets the gate exit 0 reproduces the
 * umbrella's own defect inside its own fix.
 *
 * T-S1-A (stage-level): covers the SILENT path (`:172` malformed) — not just the
 * loud WARN path (`:182`). A fix that counts only the WARN path still reports PASS
 * on a manifest of malformed rules; this test catches that regression.
 *
 * Anti-scope guard: the empty-manifest case (RULE_COUNT=0 early exit) is pinned to
 * STILL exit 0 honestly — if a future edit makes that path exit non-zero, this
 * test catches the scope creep (§6: «Do NOT change the RULE_COUNT -eq 0 path»).
 *
 * Pre-fix RED behaviour (captured 2026-07-24 via git-stash, quoted in PR body —
 * NOT re-asserted here because the pre-fix runner no longer exists):
 *   - Case A (empty input)  → PASS exit 0, silent skip, no summary line  (the defect)
 *   - Case B (no-match sel) → PASS exit 0, WARN printed, summary VANISHED (the defect)
 *   - Case C (empty)        → exit 0, "nothing to test"                  (unchanged)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE = <repo>/packages/core/synthesizer/ → repo root is 3 levels up.
// Mirrors the runner's own REPO_ROOT resolution (run-generated-rule-mutation.sh:39-40
// via git rev-parse --show-toplevel) and pre-push.ts:60 (same '../../..' climb from
// packages/core/hooks/). The previous '../..' resolved to <repo>/packages/, causing
// PROBES_AVAILABLE=false in standard CI (deps at <repo>/node_modules/.bin/ via root
// `npm ci` or <repo>/packages/core/node_modules/.bin/ via `npm ci --prefix packages/core`
// in audit-self.yml) → describe.skipIf silently skipped the suite → zero regression
// protection (review blocking finding 457dd734421c, T14 inside the fix's own evidence).
const REPO_ROOT = resolve(HERE, '../../..');
const RUNNER = resolve(HERE, 'run-generated-rule-mutation.sh');

// Mirror the runner's own bin resolution (run-generated-rule-mutation.sh :54-65) +
// pre-push.ts generatedRuleMaterialSection pre-check (:937). Skip the whole suite
// when tsx/eslint are absent — the runner would die exit 2 ("tsx/eslint not found")
// before reaching the skip logic under test, and we cannot distinguish that from a
// real regression. CI environments with `npm install` will have both; minimal
// consumer checkouts may not.
function binResolvable(bin: string): boolean {
  return (
    existsSync(resolve(REPO_ROOT, `node_modules/.bin/${bin}`)) ||
    existsSync(resolve(REPO_ROOT, `packages/core/node_modules/.bin/${bin}`)) ||
    existsSync(`/app/node_modules/.bin/${bin}`)
  );
}
const PROBES_AVAILABLE = binResolvable('tsx') && binResolvable('eslint');

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function writeManifest(json: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'mutrunner-skip-'));
  tmpDirs.push(dir);
  const abs = join(dir, 'manifest.json');
  writeFileSync(abs, JSON.stringify(json), 'utf8');
  return abs;
}

function runRunner(manifestPath: string): { code: number; out: string } {
  const r = spawnSync('bash', [RUNNER, manifestPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// Every case here spawns the real run-generated-rule-mutation.sh runner and does real filesystem/git work in a
// sandbox — multi-second runtimes are inherent, so the vitest 5s default is a mis-set
// gate rather than a signal, not a budget these tests were ever meant to meet. Measured
// 2026-08-10 (`vitest run skills/`, macOS): the untimed cases below time out at 5000ms
// while the underlying script succeeds. 30_000 is the SLOW_SHELL_MS convention already
// used by the sibling shell-spawning suites (dup-detect, create-worktree,
// priority-score-synthetic), applied here per the #1363 precedent.
const SLOW_SHELL_MS = 30_000;

describe.skipIf(!PROBES_AVAILABLE)(
  'run-generated-rule-mutation — skip-counter + non-PASS polarity (getff S1)',
  { timeout: SLOW_SHELL_MS },
  () => {
    it('manifest with empty negative-test input → malformed skip (SILENT :172 path, T-S1-A)', () => {
      // After node extraction, RULE_INPUT=(inputs||[])[0]||'' becomes '' because
      // inputs[0] is the empty string. Bash `:172` malformed check fires.
      // Pre-fix: this path was a bare `IDX++; continue` with no WARN, no counter,
      // and the all-skipped case then printed PASS exit 0 — the umbrella's defect.
      const manifest = writeManifest({
        'rule-empty-input': {
          check: {
            type: 'declarative',
            selector: "CallExpression[callee.name='foo']",
          },
          'negative-test': { input: [''] },
        },
      });
      const { code, out } = runRunner(manifest);

      // T-HS-A: EXIT CODE FIRST. Pre-fix was 0 (the defect); post-fix MUST be 1.
      expect(code, `runner output:\n${out}`).toBe(1);
      // Counter + WARN line printed (silent path is now LOUD)
      expect(out).toContain('skipped=1');
      expect(out).toContain('empty id/selector/input');
      // Verdict wording (umbrella kickoff §4 S1: «N skipped — NOT green»)
      expect(out).toContain('NOT green');
      // Summary line did NOT vanish — RULE_COUNT>0 unconditional print
      expect(out).toContain('=== overall:');
    });

    it('manifest with non-matching selector → selector-not-firing skip (LOUD :182 path)', () => {
      // Selector is syntactically valid ESLint selector but matches no AST node in
      // the input. _probe returns non-zero → `:182` selector-not-firing skip fires.
      // Pre-fix: WARN was printed but the summary line VANISHED (OVERALL_TOTAL=0
      // guard) and the final verdict was PASS exit 0 — the umbrella's defect.
      const manifest = writeManifest({
        'rule-no-match': {
          check: {
            type: 'declarative',
            // Valid selector syntax; no Literal node has this value in the input
            selector: "Literal[value='NOMATCH_VALUE_9X_ABSENT']",
          },
          'negative-test': { input: ['const x = 1;'] },
        },
      });
      const { code, out } = runRunner(manifest);

      // T-HS-A: EXIT CODE FIRST.
      expect(code, `runner output:\n${out}`).toBe(1);
      expect(out).toContain('skipped=1');
      expect(out).toContain('did NOT fire on negative-test input');
      expect(out).toContain('NOT green');
      // Summary printed (post-fix: unconditional when RULE_COUNT>0)
      expect(out).toContain('=== overall:');
    });

    it('POSITIVE (probe liveness): a genuinely matching selector is TESTED, never skipped', () => {
      // The arm above is satisfied by a skip — and a skip is what you get whether the
      // selector honestly missed the AST *or* the probe never ran at all. Nothing here
      // could tell those apart, so a dead probe reads as a green suite: every rule
      // "correctly" skipped, forever.
      //
      // This arm removes that blind spot. The selector below provably matches its input
      // (MemberExpression with object.name === 'localStorage'), so a live probe MUST
      // reach the mutation loop. If it skips, the probe itself is broken.
      //
      // Concretely what this catches: the probe builds a flat config with no `files` key
      // and calls linter.verify(..., { filename: 'probe.ts' }). ESLint 9 flat config only
      // matches js/mjs/cjs by default, so a `.ts` filename matches NO config object —
      // verify returns "No matching configuration found for probe.ts", _probe exits
      // non-zero, and EVERY rule takes the `:182` selector-not-firing path. Same trap
      // already documented and fixed in audit-self/check-fences-fire.sh:177-182.
      const manifest = writeManifest({
        'rule-live': {
          check: {
            type: 'declarative',
            selector: "MemberExpression[object.name='localStorage']",
          },
          'negative-test': { input: ["localStorage.getItem('token');"] },
        },
      });
      const { code, out } = runRunner(manifest);

      // The defect signature, asserted directly: no skip, no not-fired warning.
      expect(out, `runner output:\n${out}`).not.toContain('did NOT fire on negative-test input');
      expect(out).not.toContain('skipped=1');
      // Rule was actually measured, and the mutants died (attribute-value mutations
      // stop matching `localStorage`), so the gate is green on its own merits.
      expect(out).toContain('=== overall:');
      expect(code, `runner output:\n${out}`).toBe(0);
    });

    it('anti-scope guard: empty manifest (RULE_COUNT=0) still exits 0 honestly', () => {
      // §6 anti-scope: «Do NOT change the RULE_COUNT -eq 0 early-exit path (§1)».
      // That path is ALREADY HONEST — it claims nothing. Pins it in place: if a
      // future edit makes the runner exit non-zero here, this test catches the
      // scope creep.
      const manifest = writeManifest({});
      const { code, out } = runRunner(manifest);

      expect(code, `runner output:\n${out}`).toBe(0);
      expect(out).toContain('nothing to test');
      expect(out).not.toContain('NOT green');
      expect(out).not.toContain('skipped=');
    });
  },
);
