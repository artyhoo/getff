// provenance gate -- stage B (research-pipeline-as-gates), Task 2.
// Plan: docs/superpowers/plans/2026-07-02-stage-b-impl.md Task 2.
// Spec: docs/superpowers/specs/2026-07-02-diagnostics-core-design.md Sec9.
//
// Lifts the per-entry provenance walk from checkResearchPlan's inline
// accumulation (research/validate-plan.ts, pre-Task-4 lines 77-99) into a
// named gate mirroring the L4 aggregator pattern. Resolves the tier stack
// once via resolveAllowedSources, then walks every entry's provenance list.
// scope-lock (FF2010 Tier-1 cross-package, FF2012 Tier-2 scoped-ack) is NOT
// a separate gate (plan F1) -- it surfaces HERE, inline inside
// validateProvenance/validateUrlAgainstTiers, exactly as it does today.
//
// DN-B-1 = Option B: tier1For / Tier1Result / tier1ReasonToDiagnostic are
// UNTOUCHED (trust-tiers-owned resolver surface) -- this gate calls
// resolveAllowedSources + validateProvenance exactly as validate-plan.ts
// does today, no substring-bridge cleanup here.
// DN-B-3 = Option A: resolveAllowedSources(ctx) is NOT wrapped in a
// try/catch -- an AckFileError thrown at resolve time propagates out of
// this gate exactly as it does out of checkResearchPlan today (zero
// behavior change, AC-3).

import {
  resolveAllowedSources,
  validateProvenance as validateProvenanceResolved,
  type ResolveCtx,
} from '../allowlist-resolver.ts';
import { validateProvenance as validateProvenanceTier0Only } from '../allowlist.ts';
import type { Diagnostic } from '../../diagnostics/types.ts';
import type { ResearchGateOutcome } from './types.ts';

/** Maps a provenance Diagnostic to the entry `id` it belongs to -- see
 *  validate-plan.ts's EntryIdMap doc comment for why a WeakMap keyed on the
 *  Diagnostic object (rather than parsing `path` back apart) is used: an id
 *  containing '/' (e.g. 'next/app-router') is schema-legal but not
 *  round-trippable through a `[^/]+` path regex. */
export type EntryIdMap = WeakMap<Diagnostic, string>;

function maybePatternsOf(plan: unknown): Array<Record<string, unknown>> | undefined {
  return plan !== null && typeof plan === 'object' && Array.isArray((plan as { patterns?: unknown }).patterns)
    ? ((plan as { patterns: unknown[] }).patterns as Array<Record<string, unknown>>)
    : undefined;
}

/** Tier-0-only provenance check that returns a Diagnostic (not {ok,reason}) --
 *  used when no ResolveCtx is supplied. Mirrors validate-plan.ts's
 *  provenanceDiagFromTier0Only exactly (same reasoning: the 1-arg wrapper's
 *  {ok,reason} contract doesn't expose code/params, so re-resolve via the
 *  3-arg form against a Tier-0-only ResolvedSources). */
function provenanceDiagFromTier0Only(
  p: Parameters<typeof validateProvenanceTier0Only>[0],
): Diagnostic | null {
  const v = validateProvenanceTier0Only(p);
  if (v.ok) return null;
  const tier0Only = resolveAllowedSources();
  return validateProvenanceResolved(p, tier0Only);
}

export function runProvenanceGate(
  plan: unknown,
  ctx?: ResolveCtx,
  entryIdOut?: EntryIdMap,
): ResearchGateOutcome {
  // resolveAllowedSources(ctx) runs unconditionally -- matches today's
  // unconditional derivation order in checkResearchPlan (validate-plan.ts
  // pre-Task-4, line 75: `const resolved = ctx ? resolveAllowedSources(ctx)
  // : undefined;` runs BEFORE the `if (maybePatterns)` guard). An
  // AckFileError thrown by resolveAllowedSources must propagate here before
  // the un-iterable-patterns early return, or a corrupt
  // .ai-factory/research-allowlist.json would be silently swallowed for
  // shape-invalid plans (DN-B-3, zero-behavior-change / AC-3).
  const resolved = ctx ? resolveAllowedSources(ctx) : undefined;

  const maybePatterns = maybePatternsOf(plan);
  if (!maybePatterns) {
    // Nothing iterable to derive provenance diagnostics from -- matches
    // today's maybePatterns === undefined guard (validate-plan.ts:71-74).
    return { status: 'pass', diagnostics: [] };
  }

  const diagnostics: Diagnostic[] = [];

  for (const entry of maybePatterns) {
    const provenance = Array.isArray(entry?.['provenance']) ? entry['provenance'] : [];
    const entryId = typeof entry?.['id'] === 'string' ? entry['id'] : '<unknown>';
    const entryPackage = typeof entry?.['package'] === 'string' ? entry['package'] : undefined;
    for (const p of provenance) {
      const d = resolved
        ? validateProvenanceResolved(p, resolved, { entryPackage })
        : provenanceDiagFromTier0Only(p);
      if (d !== null) {
        const withPath: Diagnostic = { ...d, path: d.path ?? `/patterns/${entryId}/provenance` };
        diagnostics.push(withPath);
        entryIdOut?.set(withPath, entryId);
      }
    }
  }

  if (diagnostics.length > 0) return { status: 'fail', diagnostics };
  return { status: 'pass', diagnostics: [] };
}
