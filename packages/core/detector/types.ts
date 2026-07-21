// Detector public types — shared across read-aif, read-manifest, read-config, index.

import type { Confidence, Severity } from './confidence.ts';

// W1 type-shape decision (ecosystem-wiring, spec §7): widen the string-literal
// union rather than restructure to a `{toolchain, framework}` pair. The pair shape
// would duplicate the sibling `runtime` (toolchain) and `framework` fields already
// on DetectionResult — parallel-evolution-creep, against build-first-reuse-default.
// Census: no consumer exhaustively switches on this value (all four pipeline CLIs
// pass DetectionResult through to research()/synthesize()); the compiler enumerates
// every consumer and the change is reversible pre-ship — so the delegation criterion
// (non-frozen, compiler-enumerated, reversible) holds. 'react-next'/'ts-server' are
// the JS/TS labels; 'python' and 'cargo' are the widened non-JS toolchain labels.
export type Stack = 'react-next' | 'ts-server' | 'python' | 'cargo' | 'unknown';

export interface Framework {
  name: string | null;
  version: string | null;
  major: number | null;
}

export interface Runtime {
  name: string;
  major: number | null;
}

export interface DetectionResult {
  stack: Stack;
  framework: Framework;
  runtime: Runtime;
  confidence: Confidence;
  severity: Severity;
  weight: 0 | 1 | 2;
  source: string;
  rules: { applicable: string[]; skipped: string[] };
  /** Standard packages absent from project; fed to Layer 2 (Research Agent). */
  missing?: string[];
  /** Detected stack patterns (e.g. 'nextjs-app-router', 'tailwind-v4-css-tokens'); fed to Layer 2/3. */
  patterns?: string[];
}

export interface DetectorOptions {
  /** Skip AIF artifact reads (priority 1-3); use only manifest/config. */
  skipAif?: boolean;
}
