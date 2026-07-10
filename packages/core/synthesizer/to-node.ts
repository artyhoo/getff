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
// byte-identical to today — byte-EXACT, INCLUDING object key order (emit.ts serializes the
// manifest via JSON.stringify, so a key reorder changes the emitted bytes even when the rule
// is semantically identical). mergeEnrichment reconstructs the output in the ORIGINAL rule's
// key iteration order for exactly this reason (review BLOCKER-1 fix). Which locks cover what:
//   - ORDER-SENSITIVE byte-exact lock (the real one for the adapter path): `synthesizer/
//     to-node.test.ts` asserts `JSON.stringify(wireRuleThroughNode(rule)) === JSON.stringify(rule)`
//     for BOTH a declarative-syntax rule (R20-shaped — routes through the npm adapter) and a
//     non-syntax rule. `toEqual` alone is order-INSENSITIVE and did NOT catch the pre-fix
//     reorder; the JSON.stringify assertion is what byte-locks key order.
//   - Corpus regen locks: `tests/acceptance/canonical-regen*` synthesizes the frozen
//     `expected-canonical-v15.json` — which DOES contain declarative-syntax rules (R14 + R20
//     route through the npm adapter; only R12 is non-syntax). It compares via `presetSimilarity`
//     (ruleIds/eslintKeys overlap ≥ 0.95) — an ORDER-INSENSITIVE metric that does NOT byte-lock
//     the projection (it stayed 1.0 under the pre-fix key reorder). `synthesizer/snapshot.test.ts`
//     deep-equals the next-16 fixture plan (also order-insensitive `toEqual`). So the corpus DOES
//     exercise the adapter, but the byte-exact key-order guarantee is the to-node.test.ts
//     assertion's, NOT the corpus metrics'. A snapshot diff that is NOT a temporary distortion is
//     a projection-loss signal (лоси проекции) → escalate, do NOT edit assertion/snapshot.

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
    // For a declarative-syntax rule this is a REAL classification ('syntax' — the adapter
    // renders it). For a non-syntax rule (eslint/command/script/manual) the node exists ONLY
    // to stand the grammar gate in the flow (T15/N4) and is then discarded — wireRuleThroughNode
    // returns the original rule unchanged before the adapter is ever reached, so this value is
    // NEVER consumed. 'dep-graph' is a throwaway placeholder here, NOT a real dependency-graph
    // classification of the rule. (Latent trap guard: if a future stage feeds these gate-only
    // nodes to the npm router in from-node.ts, 'dep-graph' would be refused FF7001 with a
    // misleading "dependency-level ban" note — at that point give non-syntax nodes a truthful
    // class or route them away before the router, do not let this placeholder leak.)
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
 * Reconstruct the byte-identical SynthesizedRule from (a) the adapter's node-projection and
 * (b) the producer's original rule — preserving the ORIGINAL rule's exact key iteration order
 * so `JSON.stringify(merged) === JSON.stringify(original)` (byte-exact, review BLOCKER-1).
 *
 * WHY key order matters and why a spread cannot be used here: the adapter builds `{id, title,
 * …}` (id-first), and a trailing `{...projected, negative-test}` spread would (1) hoist `id`
 * to the front and (2) append `negative-test` after `research`. The producer instead places
 * `negative-test` before `id`, `id` before `research`. A naive spread therefore REORDERS keys
 * for declarative rules — semantically identical, but not byte-identical (emit.ts writes the
 * manifest via JSON.stringify, so the emitted bytes diverge). We rebuild field-by-field in the
 * original's own iteration order to eliminate the reorder.
 *
 * Field sourcing (the adapter projection stays genuinely USED — a broken adapter is still
 * caught, because the node-backbone-owned fields are taken from `projected`, not `original`):
 *   - `title`            <- projected.title   (= node.claim; node backbone owns the claim)
 *   - `examples`         <- projected.examples (= node.pairedExamples; backbone owns the pair)
 *   - `check.selector`   <- projected.check.selector  (round-trips through node.params)
 *   - `check.presence`   <- projected.check.presence  (round-trips through node.params)
 *   - `check` other keys <- original.check   (engine + exact message + messageId are enrichment
 *                          the node cannot carry — the adapter would overwrite message with the
 *                          claim; restore the producer's exact check, in the producer's key order)
 *   - `id`               <- original.id       (adapter uses node.id = entryId; producer id is G{n})
 *   - `research`         <- original.research (adapter sets research.entryId = node.id — same
 *                          value; restore the producer's object for byte-exact provenance order)
 *   - `stack` / `applies-to` <- projected     (the adapter re-emitted them from enrichment; taking
 *                          the projected copy proves the enrichment round-trip is used)
 *   - `negative-test` / `fixture` / `liveness-mode` / `pressure-scenario`: pure enrichment,
 *                          never in the node — carried from the producer's rule when present.
 */
function mergeEnrichment(projected: SynthesizedRule, original: SynthesizedRule): SynthesizedRule {
  // Per-key value resolver. The adapter projection is the source for the node-backbone-owned
  // fields (title, examples, and the selector/presence sub-fields of check); everything else is
  // the producer's enrichment. `check` is rebuilt in the ORIGINAL check's key order so a
  // declarative check's `{type, engine, selector, message, presence}` order is byte-preserved.
  const resolve = (key: string): unknown => {
    switch (key) {
      case 'title':
        return projected.title; // node backbone owns the claim -> title
      case 'examples':
        // Node backbone owns pairedExamples -> bad/good. safeForms is ENRICHMENT the node
        // cannot carry (multi-token safe idioms, GH #915 obs 4) — without this overlay the
        // IR round-trip silently DROPPED it for declarative rules and the FF3021 gate probe
        // never saw it on the real pipeline. Appended after bad/good, matching the producer's
        // key order (byte-exact contract preserved for safeForms-less rules).
        return original.examples.safeForms !== undefined
          ? { ...projected.examples, safeForms: original.examples.safeForms }
          : projected.examples;
      case 'stack':
        return projected.stack; // adapter re-emits from enrichment.stack (round-trip used)
      case 'applies-to':
        return projected['applies-to']; // adapter re-emits from enrichment.appliesTo
      case 'check':
        return mergeCheck(projected.check, original.check);
      default:
        // id, research, negative-test, fixture, liveness-mode, pressure-scenario — enrichment /
        // producer identity the node cannot carry (or that the adapter set to node.id).
        return (original as unknown as Record<string, unknown>)[key];
    }
  };

  // Rebuild following the ORIGINAL rule's key iteration order — this is what preserves the bytes.
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(original)) {
    merged[key] = resolve(key);
  }
  return merged as unknown as SynthesizedRule;
}

/**
 * Rebuild the `check` field in the ORIGINAL check's key order, taking the selector + presence
 * from the adapter's projection (they round-trip through node.params, so the projection is
 * genuinely used) while preserving every other producer key (type, engine, message, messageId)
 * exactly and in place. For a non-declarative check there is no selector/presence to project;
 * the original check is returned verbatim.
 */
function mergeCheck(projectedCheck: ManifestCheck, originalCheck: ManifestCheck): ManifestCheck {
  if (originalCheck.type !== 'declarative' || projectedCheck.type !== 'declarative') {
    return originalCheck;
  }
  const rebuilt: Record<string, unknown> = {};
  for (const key of Object.keys(originalCheck)) {
    if (key === 'selector') {
      rebuilt[key] = projectedCheck.selector; // from node.params.selector (projection used)
    } else if (key === 'presence') {
      rebuilt[key] = projectedCheck.presence; // from node.params.presence (projection used)
    } else {
      rebuilt[key] = (originalCheck as unknown as Record<string, unknown>)[key]; // engine/message/messageId
    }
  }
  return rebuilt as unknown as ManifestCheck;
}
