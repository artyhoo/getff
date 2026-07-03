// Shared Ajv validators for the research module.
// Single source of compiled validators — used by load.ts (entry-by-entry
// during disk read) and validate-plan.ts (full ResearchPlan validation
// for external consumers like the synthesizer's --from-research CLI mode).
// Avoids double-compiling the schema and double-parsing the JSON file.
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
// AIF_SYNTH_PKG_ROOT: when running as a precompiled bundle, import.meta.url points
// to the bundle file (install/ dir), not the original source. Set this env var to
// the packages/core directory so all four fs anchors resolve to the real data files.
const _pkgCore = process.env['AIF_SYNTH_PKG_ROOT'];
const SCHEMA_PATH = _pkgCore
  ? resolve(_pkgCore, 'research', 'research-plan.schema.json')
  : resolve(HERE, 'research-plan.schema.json');

const schemaDoc = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

const ACK_SCHEMA_PATH = _pkgCore
  ? resolve(_pkgCore, 'research', 'research-allowlist.schema.json')
  : resolve(HERE, 'research-allowlist.schema.json');
const ackSchemaDoc = JSON.parse(readFileSync(ACK_SCHEMA_PATH, 'utf8'));

export const validateEntry: ValidateFunction = makeSchemaValidator(
  schemaDoc,
  'research-plan#/definitions/ResearchEntry',
);

export const validateResearchPlanShape: ValidateFunction = makeSchemaValidator(
  schemaDoc,
  'research-plan',
);

export const validateAckFileShape: ValidateFunction = makeSchemaValidator(
  ackSchemaDoc,
  'research-allowlist',
);

export function errorsText(errors: ValidateFunction['errors']): string {
  return sharedErrorsText(errors);
}
