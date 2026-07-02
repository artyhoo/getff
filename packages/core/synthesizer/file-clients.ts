// Rule-bootstrapping LIVE adapter (Phase 1) — file-reading research + generate clients.
//
// Replaces stubRuleResearch / stubGenerateNextImage on the ./setup --full consumer path:
// the human's interactive MCP-enabled agent session runs the rule-research protocol
// (agents/rule-researcher.md), writes two committed JSON files, and these thin clients
// feed them through the UNCHANGED deterministic tail (generate.ts → L4 → install → lock).
//
// $0-in-CI (principle 17): no network, no LLM here — the live research happened in the
// human session; these clients only READ its committed output. CI keeps injecting the stubs.
//
// SEAM fidelity: FileResearchClient ignores `detection` and FileGenerateClient ignores
// `menu`, exactly like the stubs — the input is the file, authored upstream by the agent.
//
// Prior-art: prior-art-evaluations.md#183 (rule-research→rule-factory bridge BUILD; #798 §11).

import { readFileSync } from 'node:fs';
import process from 'node:process';
import type { DetectionResult } from '../detector/types.ts';
import type { ResearchPlan } from '../research/types.ts';
import { validateResearchPlan } from '../research/validate-plan.ts';
import { npmAdapter } from '../research/ecosystem-npm.ts';
import type { RuleResearchClient } from './rule-research-port.ts';
import type {
  GenerateCandidate,
  GenerateClient,
  GenerateSelection,
  Menu,
} from './generate-port.ts';

/**
 * Research-half live client. Reads a committed ResearchPlan JSON and runs the
 * EXTERNAL-facing validator (schema + provenance host-gate) — Trust boundary #1.
 * Throws ResearchPlanError on malformed shape or non-allowlisted provenance; the
 * CLI catches it → degrade + guidance (Decision B, never a silent bad rule).
 */
export class FileResearchClient implements RuleResearchClient {
  constructor(private readonly planPath: string) {}

  async research(_detection: DetectionResult): Promise<ResearchPlan> {
    const raw = readFileSync(this.planPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    // DN #7 Option A (Task 2.6): thread the consumer-root/cwd notion this call
    // path already holds — this CLI's entrypoint (rule-bootstrap-cli.ts)
    // defaults its own consumerRoot to process.cwd() too, so this is the
    // same root the surrounding install-time run targets, not a guess.
    validateResearchPlan(parsed, { root: process.cwd(), adapter: npmAdapter });
    return parsed;
  }
}

/**
 * Generate-half live client. Reads a committed GenerateSelection JSON and returns it
 * verbatim (ignores `menu`, like stubGenerateNextImage). Trust boundary #2 is L4
 * downstream (executable roundtrip + anti-vacuity) PLUS the withManualDrop backstop.
 */
export class FileGenerateClient implements GenerateClient {
  constructor(private readonly selectionPath: string) {}

  async generate(_menu: Menu): Promise<GenerateSelection> {
    const raw = readFileSync(this.selectionPath, 'utf8');
    return JSON.parse(raw) as GenerateSelection;
  }
}

/**
 * Would this candidate route to check.type:'manual' in synthesizeGenerate?
 * READ-ONLY mirror of generate.ts:58-73 (factory untouched): a candidate is
 * declarative-expressible iff presence:'forbid' AND selector; eslint-expressible iff
 * a non-empty eslintConfig. Neither → manual (an inert rule L4 passes WITHOUT a firing
 * test — the §MAJOR-1 masquerade). Keep in sync with generate.ts routing.
 */
export function routesToManual(c: GenerateCandidate): boolean {
  const declarative = c.presence === 'forbid' && Boolean(c.selector);
  const hasEslintConfig =
    c.eslintConfig !== undefined && Object.keys(c.eslintConfig).length > 0;
  return !declarative && !hasEslintConfig;
}

/**
 * §MAJOR-1 layer-2 backstop (live consume path only). Wraps a GenerateClient and DROPS
 * any candidate that would route to manual, logging it loudly. The honest live flow
 * (agents/rule-researcher.md §MAJOR-1) never emits such a candidate; this is defence in
 * depth so a non-L4-expressible practice can never ship as an inert rule. The stub/CI
 * path does NOT wrap → unaffected (byte-identical behaviour preserved).
 */
export function withManualDrop(
  inner: GenerateClient,
  log: (msg: string) => void = (m) => process.stderr.write(m + '\n'),
): GenerateClient {
  return {
    async generate(menu: Menu): Promise<GenerateSelection> {
      const selection = await inner.generate(menu);
      const rules: GenerateCandidate[] = [];
      for (const c of selection.rules) {
        if (routesToManual(c)) {
          log(
            `[rule-bootstrap] practice '${c.entryId}' researched but not L4-expressible ` +
              `(no forbid-selector, no eslintConfig) — recorded as research-only, NOT shipped as a rule.`,
          );
          continue;
        }
        rules.push(c);
      }
      return { rules };
    },
  };
}
