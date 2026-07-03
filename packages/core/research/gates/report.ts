// research-side report + aggregator -- stage B (research-pipeline-as-gates), Task 3.
// Plan: docs/superpowers/plans/2026-07-02-stage-b-impl.md Task 3.
// Spec: docs/superpowers/specs/2026-07-02-diagnostics-core-design.md Sec9.
//
// ResearchValidationReport {ok, gates: {shape, provenance}} -- a
// research-specific report type mirroring validator/types.ts's
// ValidationReport BY PATTERN, not by shared abstraction (DN-B-2, spec
// Sec9 "NO generic aggregator over both plan types").
//
// Short-circuit (DN-B-4 = Option B, confirmed against the baseline AC-2
// fixture): the shape gate failing does NOT skip provenance wholesale --
// provenance still runs on shape-valid entries even when other entries in
// the SAME plan are shape-invalid (preserves today's independent-
// accumulation semantics, validate-plan.ts:52-60). The skip applies ONLY
// when the top-level plan.patterns is not iterable at all (a HARD
// un-iterable shape) -- there is nothing to walk, mirroring today's
// maybePatterns === undefined guard (validate-plan.ts:71-74).

import type { ResolveCtx } from '../allowlist-resolver.ts';
import { runShapeGate } from './shape.ts';
import { runProvenanceGate, type EntryIdMap } from './provenance.ts';
import type { ResearchGateOutcome } from './types.ts';

export interface ResearchValidationReport {
  ok: boolean;
  gates: {
    shape: ResearchGateOutcome;
    provenance: ResearchGateOutcome;
  };
}

const SKIPPED: ResearchGateOutcome = { status: 'skip', diagnostics: [] };

/** True iff plan.patterns is NOT iterable at the top level -- the hard
 *  short-circuit condition (DN-B-4 Option B). Deliberately does NOT ask
 *  "did the shape gate fail" (that would over-trigger the short-circuit --
 *  the AC-2 fixture's plan IS shape-invalid yet patterns IS an array). */
function hasUniterablePatterns(plan: unknown): boolean {
  return !(
    plan !== null &&
    typeof plan === 'object' &&
    Array.isArray((plan as { patterns?: unknown }).patterns)
  );
}

export function runResearchValidation(
  plan: unknown,
  ctx?: ResolveCtx,
  entryIdOut?: EntryIdMap,
): ResearchValidationReport {
  const shape = runShapeGate(plan);
  const provenance = hasUniterablePatterns(plan)
    ? SKIPPED
    : runProvenanceGate(plan, ctx, entryIdOut);

  const ok = shape.status !== 'fail' && provenance.status !== 'fail';

  return {
    ok,
    gates: { shape, provenance },
  };
}
