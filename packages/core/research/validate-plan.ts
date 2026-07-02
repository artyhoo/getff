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

import { validateProvenance as validateProvenanceTier0Only } from './allowlist.ts';
import {
  resolveAllowedSources,
  validateProvenance as validateProvenanceResolved,
  type ResolveCtx,
} from './allowlist-resolver.ts';
import {
  errorsText,
  validateResearchPlanShape,
} from './internal-validators.ts';
import type { ResearchPlan } from './types.ts';

export class ResearchPlanError extends Error {
  constructor(public readonly errors: string) {
    super(`Invalid ResearchPlan: ${errors}`);
    this.name = 'ResearchPlanError';
  }
}

export function validateResearchPlan(
  plan: unknown,
  resolveCtx?: ResolveCtx,
): asserts plan is ResearchPlan {
  if (!validateResearchPlanShape(plan)) {
    throw new ResearchPlanError(errorsText(validateResearchPlanShape.errors));
  }
  const parsed = plan as ResearchPlan;
  const resolved = resolveCtx ? resolveAllowedSources(resolveCtx) : undefined;
  for (const entry of parsed.patterns) {
    for (const p of entry.provenance) {
      const v = resolved
        ? validateProvenanceResolved(p, resolved, { entryPackage: entry.package })
        : validateProvenanceTier0Only(p);
      if (!v.ok) {
        throw new ResearchPlanError(
          `pattern[${entry.id}] provenance violation — ${v.reason}`,
        );
      }
    }
  }
}
