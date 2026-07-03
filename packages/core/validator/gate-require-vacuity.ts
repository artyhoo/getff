// L4 Gate — require anti-vacuity check (T-RCT-B).
// For declarative rules with presence:'require', the selector fires when the
// required construct is ABSENT. This gate checks TWO vacuity directions that
// the forbid tautology gate (gate-tautology.ts) cannot catch:
//
// Direction A (never-fires): selector fires 0 times on examples.bad.
//   Symptom: rule can never detect violations — always green.
//   Cause: wrong node type, selector too narrow.
//
// Direction B (always-fires): selector fires on examples.good.
//   Symptom: rule fires unconditionally — always red.
//   Cause: selector too broad, does not distinguish absent vs present construct.
//
// Cannot copy gate-tautology.ts verbatim (T-RCT-B):
// - Tautology gate uses a fixed negative corpus + checks for 0 violations.
// - Require gate uses the rule's own examples + checks BOTH directions.
// - An empty/unrelated corpus has no host node → a broken require selector
//   trivially "passes" the tautology check (direction A false green).

import { Linter } from 'eslint';
import * as tseslintParser from '@typescript-eslint/parser';
import type { SynthesisPlan, SynthesizedRule } from '../synthesizer/types.ts';
import type { GateFailure, GateOutcome } from './types.ts';

function buildRequireConfig(rule: SynthesizedRule): Linter.Config[] | null {
  if (rule.check.type !== 'declarative') return null;
  if (rule.check.presence !== 'require') return null;
  const engine = rule.check.engine ?? 'eslint-restricted';
  if (engine !== 'eslint-restricted') return null;
  const entry: Record<string, string> = { selector: rule.check.selector };
  if (rule.check.message) entry.message = rule.check.message;
  return [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        parser: tseslintParser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      },
      rules: {
        'no-restricted-syntax': ['error', entry] as Linter.RuleEntry,
      },
    },
  ] as Linter.Config[];
}

export function runRequireVacuityGate(plan: SynthesisPlan): GateOutcome {
  const requireRules = plan.rules.filter(
    (r) =>
      r.check.type === 'declarative' &&
      (r.check as { presence: string }).presence === 'require',
  );
  if (requireRules.length === 0) {
    return { status: 'n/a', failures: [] };
  }

  const linter = new Linter();
  const failures: GateFailure[] = [];

  for (const rule of requireRules) {
    if (rule.check.type !== 'declarative') continue;

    // ast-grep engine is reserved but not wired — explicit deferred-marker per decision (i)
    const engine = (rule.check as { engine?: string }).engine ?? 'eslint-restricted';
    if (engine === 'ast-grep') {
      failures.push({
        ruleId: rule.id,
        code: 'FF3018',
        reason:
          'ast-grep engine reserved but not wired for require-vacuity gate — deferred per generator-require-composite-tier decision',
      });
      continue;
    }

    const config = buildRequireConfig(rule);
    if (!config) continue;

    // Direction A: selector must fire on examples.bad (absence → must fire)
    const badMessages = linter.verify(rule.examples.bad, config, { filename: 'bad.ts' });
    const badViolations = badMessages.filter((m) => m.ruleId === 'no-restricted-syntax');
    if (badViolations.length === 0) {
      failures.push({
        ruleId: rule.id,
        code: 'FF3019',
        reason: `require-vacuity direction A — selector never fires on examples.bad; rule can never catch violations`,
      });
    }

    // Direction B: selector must NOT fire on examples.good (presence → must not fire)
    const goodMessages = linter.verify(rule.examples.good, config, { filename: 'good.ts' });
    const goodViolations = goodMessages.filter((m) => m.ruleId === 'no-restricted-syntax');
    if (goodViolations.length > 0) {
      failures.push({
        ruleId: rule.id,
        code: 'FF3020',
        reason: `require-vacuity direction B — selector fires on good example (${goodViolations.length} violation${goodViolations.length > 1 ? 's' : ''}); rule fires unconditionally`,
      });
    }
  }

  return failures.length === 0
    ? { status: 'pass', failures: [] }
    : { status: 'fail', failures };
}
