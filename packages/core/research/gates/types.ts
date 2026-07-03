// Research-side gate outcome — stage B (research-pipeline-as-gates).
// Plan: docs/superpowers/plans/2026-07-02-stage-b-impl.md DN-B-2 (Option B).
//
// A research-local twin of validator/types.ts's GateOutcome, NOT an import
// of it (DN-B-2): the research pipeline is natively Diagnostic-typed (D1
// made validateProvenance -> Diagnostic | null), so a research gate's
// failure list is Diagnostic[] directly -- no GateFailure re-wrap needed.
// "Symmetry by pattern, not abstraction" (spec Sec9) -- the shapes rhyme
// (status + failure list) but are deliberately distinct types.

import type { Diagnostic } from '../../diagnostics/types.ts';

export type ResearchGateStatus = 'pass' | 'fail' | 'skip';

export interface ResearchGateOutcome {
  status: ResearchGateStatus;
  diagnostics: Diagnostic[];
}
