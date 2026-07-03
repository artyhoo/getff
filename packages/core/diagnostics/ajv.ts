// Shared Ajv factory — D1 (diagnostics-core).
// Spec: docs/superpowers/specs/2026-07-02-diagnostics-core-design.md §3.5
// Plan: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.md Task 2.1
//
// One Ajv config for every schema-validation surface in the codebase
// (research pipeline's research-plan/research-allowlist schemas, the
// validator's synthesis-plan schema). Both existing internal-validators.ts
// files (research/, validator/) collapse onto this factory in Task 2.2 —
// this file is the single Ajv-construction site; they become thin
// schema-binding wrappers.

import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import { diag } from './registry.ts';
import type { Diagnostic } from './types.ts';

/**
 * Construct a compiled ValidateFunction for `ref` against `schemaDoc`, using
 * the one Ajv config shared across every schema-validation surface in the
 * codebase: `{allErrors: true, strict: false}`.
 *
 * `ref` is either the schema's own base id (e.g. `'research-plan'`, to
 * validate the whole document) or a `<baseId>#/definitions/...` pointer
 * into it (e.g. `'research-plan#/definitions/ResearchEntry'`) — matching
 * how the two existing internal-validators.ts files use `ajv.addSchema` +
 * `ajv.compile({$ref: ...})` today.
 *
 * `schemaDoc` is registered under `ref`'s base id (the part before the
 * first `#`) — NOT under `ref` itself, which would register the schema
 * under an id that already carries the fragment and make `{$ref: ref}`
 * resolve to the schema's document root instead of the intended fragment
 * (verified during Task 2: registering under the full `ref` string broke
 * `validateEntry` — `tier1.test.ts` and `load.test.ts` went RED with
 * ResearchPlan-shaped "must have required property 'framework'" errors
 * instead of ResearchEntry-shaped ones — before this base-id split fixed
 * it). A schema's own `$id`, when present, still wins over the derived
 * base id, matching Ajv's own `$id`-takes-precedence resolution.
 */
export function makeSchemaValidator(
  schemaDoc: Record<string, unknown>,
  ref: string,
): ValidateFunction {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const baseId = ref.split('#')[0] as string;
  const schemaId =
    typeof schemaDoc['$id'] === 'string' && schemaDoc['$id'].length > 0
      ? (schemaDoc['$id'] as string)
      : baseId;
  ajv.addSchema(schemaDoc, schemaId);
  return ajv.compile({ $ref: ref });
}

// Shared errorsText — a single Ajv instance's errorsText() is a pure
// formatter over an errors array (does not depend on which instance/schema
// produced them); reusing one instance here avoids each caller constructing
// its own throwaway Ajv just to format errors. Identical output to the
// pre-D1 per-file `ajv.errorsText(errors)` calls.
const errorsTextAjv = new Ajv({ allErrors: true, strict: false });

export function errorsText(errors: ValidateFunction['errors']): string {
  return errorsTextAjv.errorsText(errors);
}

/**
 * Convert raw ajv ErrorObject[] (from a ValidateFunction's `.errors`) into
 * the unified Diagnostic model. Every ajv error maps to FF1001 (generic
 * schema-shape violation) — see registry.ts FF1001 explanation for why
 * per-keyword codes are not allocated (spec §3.2).
 */
export function ajvErrorsToDiagnostics(
  errors: ErrorObject[] | null | undefined,
): Diagnostic[] {
  if (!errors) return [];
  return errors.map((err) =>
    diag(
      'FF1001',
      {
        keyword: err.keyword,
        instancePath: err.instancePath,
        schemaPath: err.schemaPath,
      },
      { path: err.instancePath },
    ),
  );
}
