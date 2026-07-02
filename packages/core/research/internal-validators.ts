// Shared Ajv validators for the research module.
// Single source of compiled validators — used by load.ts (entry-by-entry
// during disk read) and validate-plan.ts (full ResearchPlan validation
// for external consumers like the synthesizer's --from-research CLI mode).
// Avoids double-compiling the schema and double-parsing the JSON file.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';

const HERE = dirname(fileURLToPath(import.meta.url));
// AIF_SYNTH_PKG_ROOT: when running as a precompiled bundle, import.meta.url points
// to the bundle file (install/ dir), not the original source. Set this env var to
// the packages/core directory so all four fs anchors resolve to the real data files.
const _pkgCore = process.env['AIF_SYNTH_PKG_ROOT'];
const SCHEMA_PATH = _pkgCore
  ? resolve(_pkgCore, 'research', 'research-plan.schema.json')
  : resolve(HERE, 'research-plan.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
const schemaDoc = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
ajv.addSchema(schemaDoc, 'research-plan');

const ACK_SCHEMA_PATH = _pkgCore
  ? resolve(_pkgCore, 'research', 'research-allowlist.schema.json')
  : resolve(HERE, 'research-allowlist.schema.json');
const ackSchemaDoc = JSON.parse(readFileSync(ACK_SCHEMA_PATH, 'utf8'));
ajv.addSchema(ackSchemaDoc, 'research-allowlist');

export const validateEntry: ValidateFunction = ajv.compile({
  $ref: 'research-plan#/definitions/ResearchEntry',
});

export const validateResearchPlanShape: ValidateFunction = ajv.compile({
  $ref: 'research-plan',
});

export const validateAckFileShape: ValidateFunction = ajv.compile({
  $ref: 'research-allowlist',
});

export function errorsText(errors: ValidateFunction['errors']): string {
  return ajv.errorsText(errors);
}
