// Unified diagnostic model — D1 (diagnostics-core).
// Spec: docs/superpowers/specs/2026-07-02-diagnostics-core-design.md §3.1
// Plan: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.md Task 1.1
//
// One serializable value shape for every validation surface in the codebase
// (research pipeline, L4 gates, schema/ajv). Message is derived presentation,
// never the contract — code + params are what tests and callers assert on.

export type Severity = 'error' | 'warning' | 'note';

export interface Diagnostic {
  /** Registry code, e.g. 'FF2003'. Stable contract; tests assert on code + params. */
  code: string;
  severity: Severity;
  /** JSON Pointer into the validated artifact (ajv instancePath) or a file path. */
  path?: string;
  /** Structured payload; the discriminated contract per code. */
  params: Record<string, string | number>;
  /** Derived at construction from registry template + params. Presentation only. */
  message: string;
}
