// synthesize.ts врезка helper — MT umbrella S3b, PR-2.
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §3, §4, §7.
//
// The producer врезка (brief §2): the synthesizer builds a ConventionNode from its own
// existing input, runs it through the IR grammar gate, and — for the declarative-syntax
// class — routes it through the shipped npm adapter (backends/npm/from-node.ts). The plane
// separation is the point: the node is the convention BACKBONE (id/claim/params.selector/
// pairedExamples/provenance/severity); everything else the producer holds is ENRICHMENT
// (stack, applies-to, negative-test, fixture, liveness-mode, pressure-scenario, and the
// check-detail fields that do NOT project into the node backbone: engine, exact message,
// messageId). Enrichment is passed/merged from the producer's own source — never read off
// the node (ir/types.ts:3 field freeze).
//
// Byte-identity lock (brief §3, T-3B-A): this врезка MUST keep synthesize()'s output
// byte-identical to today. Two DIFFERENT locks cover two DIFFERENT paths — do not conflate:
//   - Passthrough + gate-in-flow (the whole current canonical corpus): `synthesizer/
//     snapshot.test.ts` (deep-equal against frozen expected-*.json — byte-exact) and
//     `tests/acceptance/canonical-regen*` (similarity ≥ 0.95 acceptance — NOT byte-exact;
//     the byte-exact guarantee is the snapshot's, not this one's). The canonical corpus
//     (self-synth + fixture-synth) contains ZERO declarative-syntax rules, so for that
//     corpus these locks only exercise the non-syntax PASSTHROUGH + the grammar gate — the
//     npm adapter is NEVER hit by them. A snapshot diff that is NOT a temporary distortion
//     is a projection-loss signal (лоси проекции) → escalate, do NOT edit assertion/snapshot.
//   - The npm ADAPTER projection (declarative-syntax rules): byte-locked at UNIT level by
//     `synthesizer/to-node.test.ts` (the check.message≠title trap + `toEqual` round-trip,
//     verified live: breaking mergeEnrichment turns it RED). This is the honest N5 for the
//     adapter path — the corpus has no declarative rule to make the integration lock fire.

import type { Severity } from '../diagnostics/types.ts';
import { nodeToSynthesizedRule, type NpmEnrichment } from '../backends/npm/from-node.ts';
import { runGrammarGate } from '../ir/gates/grammar.ts';
import type { ConventionNode } from '../ir/types.ts';
import type { Provenance } from '../research/types.ts';
import type { ManifestCheck, SynthesizedRule } from './types.ts';

/** Thrown when the grammar gate rejects a node the producer built (surfaces OUTWARD as a
 *  synthesis error — the врезка does NOT swallow a gate failure, brief §2). */
export class GrammarGateError extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly diagnostics: string,
  ) {
    super(`Grammar gate rejected node ${nodeId}: ${diagnostics}`);
    this.name = 'GrammarGateError';
  }
}

/** Map the L4 severity vocabulary onto the IR `defaultSeverity`. Synthesized rules do not
 *  carry an explicit severity today (eslint projects it in the config layer), so the node's
 *  defaultSeverity is a rendering detail (spec §3) that defaults to 'error' — the gate treats
 *  it as opaque and it never projects back into the SynthesizedRule. */
const DEFAULT_NODE_SEVERITY: Severity = 'error';

/**
 * True iff the rule's check is the declarative-syntax class the npm adapter renders
 * (`no-restricted-syntax` via the eslint-restricted engine). Only these round-trip through
 * `nodeToSynthesizedRule`; eslint/command/script/manual checks are not a syntax-selector
 * class and are reconstructed directly (the adapter throws on them by design).
 */
export function isSyntaxDeclarative(check: ManifestCheck): boolean {
  return (
    check.type === 'declarative' &&
    (check.engine === undefined || check.engine === 'eslint-restricted')
  );
}

/**
 * Build the ConventionNode backbone for a synthesized rule. Projectable fields only:
 *   id           <- research.entryId (the pattern id — so adapter research.entryId is right)
 *   claim        <- rule.title
 *   params        {selector, presence} for a declarative check; {} otherwise (non-syntax
 *                  rules still get a node so the gate stands in the flow — T15/N4 — but their
 *                  params carry no selector contract)
 *   provenance   <- research.provenance
 *   pairedExamples {positive: examples.good, negative: examples.bad}
 * Enrichment (engine, exact message, messageId, applies-to, negative-test, fixture,
 * liveness-mode, pressure-scenario, stack) is NOT read off the node — see mergeEnrichment.
 */
export function buildNode(
  rule: SynthesizedRule,
  entryId: string,
  provenance: Provenance[],
): ConventionNode {
  const params: Record<string, string | number> = {};
  if (rule.check.type === 'declarative') {
    params['selector'] = rule.check.selector;
    params['presence'] = rule.check.presence;
  }
  return {
    id: entryId,
    claim: rule.title,
    anchors: [],
    selectorClass: isSyntaxDeclarative(rule.check) ? 'syntax' : 'dep-graph',
    params,
    defaultSeverity: DEFAULT_NODE_SEVERITY,
    provenance,
    pairedExamples: {
      // negative example = the violating code; positive = the conforming code (spec §4)
      negative: rule.examples.bad,
      positive: rule.examples.good,
    },
  };
}

/**
 * Run the врезка for ONE rule: build its node, run the grammar gate (throw OUTWARD on
 * failure), and — for the declarative-syntax class — route through the npm adapter, then
 * overlay the enrichment/check-detail fields the node backbone cannot carry to reconstruct
 * the byte-identical SynthesizedRule. Non-syntax rules pass through the gate (T15) and are
 * returned unchanged (the adapter is not defined for them).
 *
 * `rule` is the fully-composed rule the producer already built (`{...recipe.rule, id,
 * research}`); this врезка threads it through the IR plane WITHOUT changing its output.
 */
export function wireRuleThroughNode(rule: SynthesizedRule): SynthesizedRule {
  const entryId = rule.research.entryId;
  const provenance = rule.research.provenance;
  const node = buildNode(rule, entryId, provenance);

  const gate = runGrammarGate([node]);
  if (gate.status !== 'pass') {
    // Surface OUTWARD as a synthesis error — do NOT swallow (brief §2).
    throw new GrammarGateError(node.id, gate.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; '));
  }

  if (!isSyntaxDeclarative(rule.check)) {
    // Non-syntax class: the adapter is not defined here (it throws on a non-'syntax' node).
    // The node still passed the gate — the flow contract is honoured — and the rule is
    // returned unchanged (nothing to project through the syntax-only declarative adapter).
    return rule;
  }

  // Declarative-syntax: route the backbone through the shipped adapter, then merge back the
  // enrichment the node cannot carry so the output is byte-identical to today's.
  const enrichment: NpmEnrichment = {
    stack: rule.stack,
    ...(rule['applies-to'] !== undefined ? { appliesTo: rule['applies-to'] } : {}),
  };
  const projected = nodeToSynthesizedRule(node, enrichment);
  return mergeEnrichment(projected, rule);
}

/**
 * Overlay the enrichment + check-detail fields the adapter's node-projection cannot produce
 * onto the adapter output, so the result is byte-identical to the producer's original rule:
 *   - `id`             : adapter uses node.id (= entryId); the producer's rule.id is G{n}.
 *   - `check`          : the adapter sets check.message = claim and omits engine when the
 *                        node carries none; the recipe's check.message often DIFFERS from
 *                        the title/claim and always carries `engine` — restore the exact
 *                        producer check.
 *   - `research.entryId`: adapter sets it to node.id (= entryId) — same value, restored
 *                        explicitly for clarity.
 *   - `negative-test` / `fixture` / `liveness-mode` / `pressure-scenario`: pure enrichment,
 *                        never in the node — carried from the producer's rule when present.
 */
function mergeEnrichment(projected: SynthesizedRule, original: SynthesizedRule): SynthesizedRule {
  const merged: SynthesizedRule = {
    ...projected,
    id: original.id,
    check: original.check, // exact producer check (engine + exact message + messageId)
    research: original.research,
    ...(original['negative-test'] !== undefined ? { 'negative-test': original['negative-test'] } : {}),
    ...(original.fixture !== undefined ? { fixture: original.fixture } : {}),
    ...(original['liveness-mode'] !== undefined ? { 'liveness-mode': original['liveness-mode'] } : {}),
    ...(original['pressure-scenario'] !== undefined ? { 'pressure-scenario': original['pressure-scenario'] } : {}),
  };
  return merged;
}
