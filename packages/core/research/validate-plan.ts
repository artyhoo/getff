// External-facing ResearchPlan validator.
// Used by consumers that load a ResearchPlan from JSON without going through
// loadEntries() (e.g. synthesizer/cli.ts --from-research mode). Closes the
// B2 hole where a bare `as ResearchPlan` cast could let malformed data —
// including spoofed provenance.url not in the allowlist — bypass schema
// + provenance gates that loadEntries already enforces per-entry.
//
// DN #7 Option A (2026-07-02, kickoff §8): optional resolveCtx param — when
// present, Tier 1/2 activate via resolveAllowedSources(resolveCtx); when
// absent, EXACTLY today's Tier-0-only path (validateProvenance(p), zero
// behavior change). The validator NEVER guesses a root/cwd — an implicit
// root would be a silent trust expansion (kickoff §8 DN #7).

import type { ResolveCtx } from './allowlist-resolver.ts';
import { errorsText, validateResearchPlanShape } from './internal-validators.ts';
import { runResearchValidation } from './gates/report.ts';
import type { EntryIdMap } from './gates/provenance.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import type { ResearchPlan } from './types.ts';

export class ResearchPlanError extends Error {
  constructor(
    public readonly errors: string,
    public readonly diagnostics: Diagnostic[] = [],
  ) {
    super(`Invalid ResearchPlan: ${errors}`);
    this.name = 'ResearchPlanError';
  }
}

export type PlanCheckResult =
  | { ok: true; plan: ResearchPlan; diagnostics: [] }
  | { ok: false; diagnostics: Diagnostic[] };

export type { EntryIdMap };

/** Thin adapter over the research-side gate aggregator (gates/report.ts,
 *  stage B): runs the `shape` gate then (short-circuit-aware, DN-B-4) the
 *  `provenance` gate, and flattens `report.gates.*.diagnostics` into the
 *  same flat `PlanCheckResult.diagnostics` array this function returned
 *  pre-stage-B. Zero behavior change for callers (AC-3) — accumulation
 *  semantics, short-circuit conditions, and the EntryIdMap path-attribution
 *  are owned by gates/report.ts + gates/provenance.ts now; this function
 *  only flattens. */
export function checkResearchPlan(
  plan: unknown,
  ctx?: ResolveCtx,
  entryIdOut?: EntryIdMap,
): PlanCheckResult {
  const report = runResearchValidation(plan, ctx, entryIdOut);
  const diagnostics: Diagnostic[] = [
    ...report.gates.shape.diagnostics,
    ...report.gates.provenance.diagnostics,
  ];

  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return { ok: true, plan: plan as ResearchPlan, diagnostics: [] };
}

export function validateResearchPlan(
  plan: unknown,
  resolveCtx?: ResolveCtx,
): asserts plan is ResearchPlan {
  const entryIds: EntryIdMap = new WeakMap();
  const result = checkResearchPlan(plan, resolveCtx, entryIds);
  if (!result.ok) {
    const first = result.diagnostics[0];
    if (first === undefined) {
      // Unreachable in practice (ok:false implies diagnostics.length > 0),
      // but keeps the throw-adapter total over PlanCheckResult's type.
      throw new ResearchPlanError('unknown validation failure', result.diagnostics);
    }
    // Message fidelity (NEW-3): preserve the exact wrapper texts existing
    // tests assert on. Shape diagnostics are FF1001 (ajv errorsText format,
    // matching the pre-D1 ResearchPlanError(errorsText(...)) message).
    // Provenance diagnostics carry the resolver's FF2xxx codes — preserve
    // the exact 'pattern[id] provenance violation — <reason>' wrapper text,
    // with the entry id read verbatim from entryIds (built alongside the
    // diagnostics in checkResearchPlan — see EntryIdMap doc comment for why
    // this doesn't recover the id by parsing `path` back apart).
    const message =
      first.code === 'FF1001'
        ? errorsText(validateResearchPlanShape.errors)
        : `pattern[${entryIds.get(first) ?? '<unknown>'}] provenance violation — ${first.message}`;
    throw new ResearchPlanError(message, result.diagnostics);
  }
}
