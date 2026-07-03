// Shared Ajv validator for SynthesisPlan structural shape.
// Re-uses synthesis-plan.schema.json as single source. Compiled once
// at module load, shared across gate 1 (schema check) and any future
// gate that needs structural pre-checks (e.g. gate 6 conflict expects
// a syntactically valid plan before semantic conflict scanning).
//
// D1: thin schema-binding wrapper over diagnostics/ajv.ts's shared factory
// (Task 2.2). Zero behavior change — every exported symbol name and its
// runtime shape (ValidateFunction / errorsText(errors): string) is
// preserved verbatim for existing callers.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ValidateFunction } from 'ajv';
import { errorsText as sharedErrorsText, makeSchemaValidator } from '../diagnostics/ajv.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(
  HERE,
  '..',
  'synthesizer',
  'synthesis-plan.schema.json',
);

const schemaDoc = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

export const validateSynthesisPlan: ValidateFunction = makeSchemaValidator(
  schemaDoc,
  'synthesis-plan',
);

export function errorsText(errors: ValidateFunction['errors']): string {
  return sharedErrorsText(errors);
}
