// D5 CI proof: run-generated-rule-mutation gate logic — iterates >1 generated rule,
// kills ≥60% of selector mutations, and flags broken (neutered) selectors (neuter→RED).
//
// Does NOT shell to universalmutator or pip — runs inline via ESLint Linter API.
// Mirrors run-bash-mutation.test.ts structural intent but for the generated-rule surface:
// - Non-JSX selectors used in stub so Espree parses without JSX plugin
// - Paired negative (neuter→RED) proves the gate's baseline-check catches vacuous tests
//
// SSOT #91 ADAPT: same kill-floor (60%) as run-bash-mutation.sh's MIN_KILL=${3:-60}.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import { synthesizeGenerate } from './generate.ts';
import type { GenerateClient, Menu, GenerateSelection } from './generate-port.ts';
import type { ResearchPlan } from '../research/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, 'fixtures');

// ─── Test stub: two declarative rules from the no-head-element research plan ──
// Uses non-JSX selectors so Espree parses inputs without requiring JSX plugin.
// Rule 1 maps to 'next-no-head-element'; Rule 2 maps to 'next-server-only-boundary'.
// This proves synthesizeGenerate + mutation gate handle >1 rule correctly.
const stubGenerateHead: GenerateClient = {
  async generate(_menu: Menu): Promise<GenerateSelection> {
    return {
      rules: [
        {
          // G1 — next-no-head-element: proxy with non-JSX selector (CallExpression form)
          entryId: 'next-no-head-element',
          ruleId: 'no-head-element-proxy',
          title: 'Do not call createHeadElement() — use the Metadata API (proxy, no-JSX form)',
          stack: ['react-next'],
          presence: 'forbid',
          selector: "CallExpression[callee.name='createHeadElement']",
          message: 'Use the Metadata API instead of createHeadElement().',
          examples: {
            bad: 'createHeadElement();',
            good: 'const metadata = { title: "Page" };',
          },
          negativeTest: {
            input: ['createHeadElement();'],
            'expect-violation': 'no-restricted-syntax',
          },
        },
        {
          // G2 — next-server-only-boundary: server-only import proxy
          entryId: 'next-server-only-boundary',
          ruleId: 'no-server-only-import-proxy',
          title: "Forbid import of 'server-only' in client components (proxy form)",
          stack: ['react-next'],
          presence: 'forbid',
          selector: "ImportDeclaration[source.value='server-only']",
          message: "Do not import 'server-only' in client components.",
          examples: {
            bad: "import 'server-only';",
            good: '// server-only is only used in Server Components',
          },
          negativeTest: {
            input: ["import 'server-only';"],
            'expect-violation': 'no-restricted-syntax',
          },
        },
      ],
    };
  },
};

// ─── Inline mutation helpers — mirrors check-generated-rule-mutation.sh _mutate() ──
// 11 operators: STRUCT-1/2/3/4, VAL-1/2/3, ATTR-1, NODE-1/2, LOGIC-1.
// Semantic operators (VAL/ATTR/LOGIC) can SURVIVE on over-broad selectors, making the
// ≥60% kill-floor meaningful — unlike structure-only sentinels that are always killed.
function applyMutations(selector: string): string[] {
  return [
    // STRUCT-1: prepend unreachable ancestor (always killed)
    `NOMATCH_9X > ${selector}`,
    // STRUCT-2: replace with sentinel (always killed)
    'Program > NOMATCH_SENTINEL_9X',
    // STRUCT-3: append unmatchable attribute (always killed)
    `${selector}[NOMATCH_ATTR_9X='_']`,
    // STRUCT-4: swap first ' > ' combinator to descendant space (survives if no '>')
    selector.replace(' > ', ' '),
    // VAL-1: prefix first quoted value (survives if selector has no quoted value)
    selector.replace(/'([^']+)'/, "'X_$1'"),
    // VAL-2: suffix first quoted value
    selector.replace(/'([^']+)'/, "'$1_Y'"),
    // VAL-3: replace first quoted value with nomatch token
    selector.replace(/'[^']+'/, "'_NOMATCH_VAL_9X'"),
    // ATTR-1: remove first [...] attribute filter (SURVIVES on over-broad test inputs)
    selector.replace(/\[[^\]]*\]/, ''),
    // NODE-1: prefix first node-type identifier (always killed — not a real AST type)
    selector.replace(/^([A-Z][A-Za-z]*)/, 'X_$1'),
    // NODE-2: suffix first node-type identifier
    selector.replace(/^([A-Z][A-Za-z]*)/, '$1_Y'),
    // LOGIC-1: negate first attribute equality (killed when bad input has target value)
    selector.replace(/='([^']*)'/, "!='$1'"),
  ];
}

function probeSelector(selector: string, code: string): boolean {
  const linter = new Linter();
  const cfg: Linter.Config[] = [
    {
      rules: {
        'no-restricted-syntax': ['error', { selector, message: 'mutation-ci-probe' }],
      },
      languageOptions: {
        ecmaVersion: 2022 as const,
        sourceType: 'module' as const,
      },
    },
  ];
  try {
    const msgs = linter.verify(code, cfg, { filename: 'probe.js' });
    return msgs.some((m) => m.ruleId === 'no-restricted-syntax');
  } catch {
    return false;
  }
}

function measureKillRate(selector: string, badInput: string): number {
  const mutations = applyMutations(selector);
  let killed = 0;
  for (const mut of mutations) {
    if (!probeSelector(mut, badInput)) killed++;
  }
  return killed / mutations.length;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('run-generated-rule-mutation — D5 CI proof', () => {
  const noHeadPlan: ResearchPlan = JSON.parse(
    readFileSync(resolve(FIXTURES, 'no-head-element.research.json'), 'utf8'),
  ) as ResearchPlan;

  it('stubGenerateHead: produces >1 declarative rule from 2-pattern fixture', async () => {
    const plan = await synthesizeGenerate(noHeadPlan, stubGenerateHead);
    const declarative = plan.rules.filter((r) => r.check.type === 'declarative');
    // Must cover BOTH patterns → >1 rule (proves gate iterates across rules, not just one)
    expect(declarative.length).toBeGreaterThan(1);
    // Each rule carries a negative-test with ≥1 bad input
    for (const r of declarative) {
      const nt = r['negative-test'];
      expect(nt, `rule ${r.id} (${r.research.entryId}) must have negative-test`).toBeDefined();
      expect(
        nt?.input.length,
        `rule ${r.id} negative-test.input must be non-empty`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('baseline check: each generated selector fires on its bad input (non-vacuous before mutation)', async () => {
    const plan = await synthesizeGenerate(noHeadPlan, stubGenerateHead);
    for (const rule of plan.rules.filter((r) => r.check.type === 'declarative')) {
      if (rule.check.type !== 'declarative') continue;
      const badInput = rule['negative-test']?.input[0];
      if (!badInput) continue;
      expect(
        probeSelector(rule.check.selector, badInput),
        `rule ${rule.id} selector='${rule.check.selector}' must fire on bad input '${badInput}'`,
      ).toBe(true);
    }
  });

  it('mutation gate: all generated declarative rules achieve ≥60% kill rate (SSOT #91 floor)', async () => {
    const plan = await synthesizeGenerate(noHeadPlan, stubGenerateHead);
    for (const rule of plan.rules.filter((r) => r.check.type === 'declarative')) {
      if (rule.check.type !== 'declarative') continue;
      const badInput = rule['negative-test']?.input[0];
      if (!badInput) continue;
      const killRate = measureKillRate(rule.check.selector, badInput);
      expect(
        killRate,
        `rule ${rule.id} (${rule.check.selector}): kill=${Math.round(killRate * 100)}% < 60% floor — generated test is theatre`,
      ).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('gate covers both generated rules (not just the first)', async () => {
    const plan = await synthesizeGenerate(noHeadPlan, stubGenerateHead);
    const declarative = plan.rules.filter((r) => r.check.type === 'declarative');
    expect(declarative.length).toBeGreaterThanOrEqual(2);
    const entryIds = declarative.map((r) => r.research.entryId);
    expect(entryIds).toContain('next-no-head-element');
    expect(entryIds).toContain('next-server-only-boundary');
    // Both achieve ≥60% kill rate independently
    for (const rule of declarative) {
      if (rule.check.type !== 'declarative') continue;
      const badInput = rule['negative-test']?.input[0];
      if (!badInput) continue;
      expect(measureKillRate(rule.check.selector, badInput)).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('paired-negative (neuter → RED): over-broad selector yields <60% kill rate via semantic mutations', () => {
    // An over-broad selector (no attribute constraint) passes the gate's baseline check
    // (original fires on bad input) but fails the kill-rate floor: semantic mutations
    // STRUCT-4, VAL-1/2/3, ATTR-1, LOGIC-1 all produce the SAME broad selector when
    // there are no quoted values, brackets, or '>' combinators to perturb → they SURVIVE.
    // Only STRUCT-1/2/3 + NODE-1/2 are reliably killed (5/11 ≈ 45% < 60% floor).
    // This proves the mutation operators have teeth: the gate goes RED for a weak test.
    const broadSelector = 'CallExpression'; // no attribute constraint — over-broad
    const badInput = 'foo();'; // any call expression matches

    // Baseline passes (gate precondition: original selector fires)
    expect(probeSelector(broadSelector, badInput)).toBe(true);

    // Kill rate must be < 60% — semantic mutations produce the same selector → SURVIVE
    const killRate = measureKillRate(broadSelector, badInput);
    expect(
      killRate,
      `over-broad selector '${broadSelector}' kill=${Math.round(killRate * 100)}% — ` +
        `must be <60% so the gate flags this as a weak (theatre) negative-test`,
    ).toBeLessThan(0.6);
  });

  it('semantic mutations (ATTR-1, LOGIC-1): non-structural operators have teeth', () => {
    // White-box check: the semantic operators are NOT structurally always-killed.
    // ATTR-1 (remove attribute filter) broadens the selector → can SURVIVE on over-broad inputs.
    // LOGIC-1 (negate attribute equality) reliably KILLS for well-specified selectors.
    const selector = "ImportDeclaration[source.value='server-only']";
    const badInput = "import 'server-only';";

    // Original fires
    expect(probeSelector(selector, badInput)).toBe(true);

    // ATTR-1: removes [source.value='server-only'] → 'ImportDeclaration'
    // 'import "server-only";' IS an ImportDeclaration → SURVIVED (proves not always-killed)
    const attr1 = selector.replace(/\[[^\]]*\]/, '');
    expect(attr1).toBe('ImportDeclaration');
    expect(probeSelector(attr1, badInput)).toBe(true); // SURVIVED

    // LOGIC-1: negate equality → [source.value!='server-only']
    // bad input has value='server-only' so != doesn't match → KILLED
    const logic1 = selector.replace(/='([^']*)'/, "!='$1'");
    expect(probeSelector(logic1, badInput)).toBe(false); // KILLED

    // Full kill rate for a well-specified selector is still ≥60%
    const killRate = measureKillRate(selector, badInput);
    expect(killRate).toBeGreaterThanOrEqual(0.6);
  });
});
