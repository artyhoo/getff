// Grammar-gate outcome — IR plane. A twin BY PATTERN of research/gates/types.ts (DN-B-2:
// shapes rhyme, deliberately distinct types). No 'skip': the grammar gate always runs on
// its input; widen the union at S3 only when a real skip case exists (non-breaking).

import type { Diagnostic } from '../../diagnostics/types.ts';

export type GrammarGateStatus = 'pass' | 'fail';

export interface GrammarGateOutcome {
  status: GrammarGateStatus;
  diagnostics: Diagnostic[];
}
