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
import { ajvErrorsToDiagnostics } from '../diagnostics/ajv.ts';
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

/** Maps a provenance Diagnostic to the entry `id` it belongs to. Built
 *  alongside `diagnostics` in checkResearchPlan's loop rather than recovered
 *  by parsing `path` back apart — `research-plan.schema.json` leaves `id` an
 *  unconstrained string, so an id containing `/` (e.g. `'next/app-router'`)
 *  is schema-legal but not round-trippable through a `[^/]+` path regex.
 *  A `WeakMap` keyed on the Diagnostic object itself avoids widening the
 *  Diagnostic shape (still exactly the diag()-constructed value) or
 *  reserving an ad-hoc field for a throw-adapter-only concern. */
type EntryIdMap = WeakMap<Diagnostic, string>;

/** Accumulates ALL ajv shape diagnostics (allErrors already on) AND ALL
 *  provenance violations across ALL entries — replaces first-failure throw.
 *  `patterns` is iterated defensively (Array.isArray guard) so a
 *  shape-invalid-but-still-iterable plan (e.g. missing an unrelated required
 *  top-level field, but `patterns` itself is a valid array) still surfaces
 *  its provenance diagnostics alongside the shape diagnostics — the two
 *  checks are independent, not sequential-and-short-circuiting. When
 *  `patterns` is absent or not an array, only shape diagnostics apply (there
 *  is nothing iterable to derive provenance diagnostics from). */
export function checkResearchPlan(
  plan: unknown,
  ctx?: ResolveCtx,
  entryIdOut?: EntryIdMap,
): PlanCheckResult {
  const shapeOk = validateResearchPlanShape(plan);
  const diagnostics: Diagnostic[] = shapeOk
    ? []
    : ajvErrorsToDiagnostics(validateResearchPlanShape.errors);

  const maybePatterns =
    plan !== null && typeof plan === 'object' && Array.isArray((plan as { patterns?: unknown }).patterns)
      ? ((plan as { patterns: unknown[] }).patterns as Array<Record<string, unknown>>)
      : undefined;

  const resolved = ctx ? resolveAllowedSources(ctx) : undefined;
  if (maybePatterns) {
    for (const entry of maybePatterns) {
      const provenance = Array.isArray(entry?.['provenance']) ? entry['provenance'] : [];
      const entryId = typeof entry?.['id'] === 'string' ? entry['id'] : '<unknown>';
      const entryPackage = typeof entry?.['package'] === 'string' ? entry['package'] : undefined;
      for (const p of provenance) {
        const d = resolved
          ? validateProvenanceResolved(p, resolved, { entryPackage })
          : provenanceDiagFromTier0Only(p);
        if (d !== null) {
          // Attach a path pointing at the owning entry (ajv-instancePath
          // style) without disturbing code/message/params — those are the
          // exact Diagnostic diag() already constructed at the failure site.
          const withPath: Diagnostic = { ...d, path: d.path ?? `/patterns/${entryId}/provenance` };
          diagnostics.push(withPath);
          // Record the id->diagnostic association out-of-band (see
          // EntryIdMap doc comment) — `path` alone can't round-trip an id
          // containing '/', but the map records it verbatim, unconstrained.
          entryIdOut?.set(withPath, entryId);
        }
      }
    }
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return { ok: true, plan: plan as ResearchPlan, diagnostics: [] };
}

/** Tier-0-only provenance check that returns a Diagnostic (not {ok,reason}) —
 *  used internally by checkResearchPlan's no-ctx path. Reuses the 1-arg
 *  wrapper's Tier-0-only resolver instance rather than re-deriving it, then
 *  re-wraps: the 1-arg wrapper (DN-D1-1) returns {ok,reason} for its own
 *  back-compat contract, but checkResearchPlan (a NEW D1 surface, no
 *  back-compat obligation) wants the Diagnostic directly. Zero behavior
 *  change to the 1-arg wrapper itself — this is a second, independent call. */
function provenanceDiagFromTier0Only(p: Parameters<typeof validateProvenanceTier0Only>[0]): Diagnostic | null {
  const v = validateProvenanceTier0Only(p);
  if (v.ok) return null;
  // The 1-arg wrapper's `.reason` IS a Diagnostic's `.message` (DN-D1-1
  // derives {ok,reason} FROM a Diagnostic internally) — but the code/params
  // are not exposed through that {ok,reason} shape. Re-resolve via the
  // 3-arg form against a Tier-0-only ResolvedSources to recover the full
  // Diagnostic (same resolver call the 1-arg wrapper makes internally).
  const tier0Only = resolveAllowedSources();
  return validateProvenanceResolved(p, tier0Only);
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
