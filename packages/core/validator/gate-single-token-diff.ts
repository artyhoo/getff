// L4 Gate 7 — single-token-diff anti-vacuity check.
// Per architecture.md §2.6 anti-vacuity cluster:
// For each declarative rule (non-ast-grep), examples.good and examples.bad
// must differ by at most MAX_TOKEN_EDITS whitespace-tokens (Levenshtein
// distance). A larger distance means the pair may not isolate the targeted
// construct — the bad example could "redden" for unrelated reasons, making
// the rule's positive-signal vacuous.
//
// THRESHOLD: MAX_TOKEN_EDITS = 5 is a CONSERVATIVE bound — it rejects grossly
// non-minimal pairs (this gate's adversarial BAD fixture is 22 edits).
// CALIBRATED at S4 against the first real `declarative` forbid pair `synthesize`
// emits — `.only` test-focus (`it.only('should work', ...)` vs `it('should
// work', ...)`) measures token-distance = 1, confirming real forbid pairs sit at
// the ≈1 token / 1 AST-node ideal (umbrella §S3 intent). The threshold 5 stays a
// conservative-safe upper bound; tighten only if a future pair class proves a
// lower ceiling. As of S4 this gate is `pass` (not n/a) on any plan carrying a
// declarative forbid — see validator/expected-fixture-validate.json.
//
// NET-NEW vs gate 2 (rule-tester): gate 2 checks the rule FIRES; this gate
// checks the example pair IS MINIMAL — isolating the forbidden construct.
// NET-NEW vs gate 4 (tautology): gate 4 checks corpus-firing; this gate
// checks example-pair distance.
//
// Applies only to check.type === 'declarative' (eslint-restricted engine).
// eslint/manual/command/script types: n/a (no declared example isolation req).
// ast-grep: explicit deferred-marker per generator-forbid-mvp decision (i).

import type { SynthesisPlan, SynthesizedRule } from '../synthesizer/types.ts';
import type { GateFailure, GateOutcome } from './types.ts';

const MAX_TOKEN_EDITS = 5;

function tokenize(code: string): string[] {
  return code.trim().split(/\s+/).filter(Boolean);
}

function tokenEditDistance(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const m = ta.length;
  const n = tb.length;
  let row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const newRow: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const sub = ta[i - 1] === tb[j - 1] ? 0 : 1;
      newRow.push(
        Math.min(newRow[j - 1]! + 1, row[j]! + 1, row[j - 1]! + sub),
      );
    }
    row = newRow;
  }
  return row[n]!;
}

function checkRule(rule: SynthesizedRule): GateFailure[] {
  if (rule.check.type !== 'declarative') return [];

  if (rule.check.engine === 'ast-grep') {
    return [
      {
        ruleId: rule.id,
        code: 'FF3010',
        reason:
          'ast-grep engine reserved but not wired — deferred per generator-forbid-mvp decision (i)',
      },
    ];
  }

  const distance = tokenEditDistance(rule.examples.bad, rule.examples.good);
  if (distance > MAX_TOKEN_EDITS) {
    return [
      {
        ruleId: rule.id,
        code: 'FF3011',
        reason: `single-token-diff: examples.bad and examples.good differ by ${distance} tokens (threshold ${MAX_TOKEN_EDITS}) — pair does not isolate the forbidden construct; reduce to a minimal ≈1 token / 1 AST-node difference`,
      },
    ];
  }
  return [];
}

export function runSingleTokenDiffGate(plan: SynthesisPlan): GateOutcome {
  const declarativeRules = plan.rules.filter(
    (r) => r.check.type === 'declarative',
  );
  if (declarativeRules.length === 0) {
    return { status: 'n/a', failures: [] };
  }
  const failures: GateFailure[] = [];
  for (const rule of declarativeRules) {
    failures.push(...checkRule(rule));
  }
  return failures.length === 0
    ? { status: 'pass', failures: [] }
    : { status: 'fail', failures };
}
