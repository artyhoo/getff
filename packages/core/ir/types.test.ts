// IR types structural tests — MT umbrella S1.
// (a) CAPABILITY_CLASSES <-> convention-node.schema.json selectorClass enum, read from the
//     schema file (not literal-to-literal) so this is not a tautology.
// (b) pin lines for CONFIDENCE_TIERS / ASSERT_TIERS / PROVENANCE_TIERS (freeze the literals).
// (c) the schema's anchors pattern === ^FF\d{4}$.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ASSERT_TIERS,
  CAPABILITY_CLASSES,
  CONFIDENCE_TIERS,
  PROVENANCE_TIERS,
  RELATIONAL_OPS,
} from './types.ts';

const schema = JSON.parse(
  readFileSync(new URL('./convention-node.schema.json', import.meta.url), 'utf8'),
) as {
  properties: { selectorClass: { enum: string[] }; anchors: { items: { pattern: string } } };
  definitions: {
    RelationalRule: { oneOf: unknown[] };
    RelationalHas: { properties: { op: { const: string } } };
    RelationalNot: { properties: { op: { const: string } } };
    RelationalAll: { properties: { op: { const: string } } };
    RelationalAny: { properties: { op: { const: string } } };
  };
};

describe('IR types — (a) CAPABILITY_CLASSES matches schema selectorClass enum (bidirectional, schema-read)', () => {
  it('every CAPABILITY_CLASSES member is in the schema enum', () => {
    for (const c of CAPABILITY_CLASSES) {
      expect(schema.properties.selectorClass.enum, `"${c}" missing from schema enum`).toContain(c);
    }
  });

  it('every schema enum member is in CAPABILITY_CLASSES', () => {
    for (const e of schema.properties.selectorClass.enum) {
      expect(
        (CAPABILITY_CLASSES as readonly string[]).includes(e),
        `schema enum member "${e}" missing from CAPABILITY_CLASSES`,
      ).toBe(true);
    }
  });
});

describe('IR types — (b) vocabulary literal pins (freeze against accidental drift)', () => {
  it('CONFIDENCE_TIERS pin', () => {
    expect(CONFIDENCE_TIERS).toEqual(['allow', 'warn', 'deny', 'deny-by-default']);
  });

  it('ASSERT_TIERS pin', () => {
    expect(ASSERT_TIERS).toEqual(['compile_fail', 'no_run', 'run', 'should_panic', 'output']);
  });

  it('PROVENANCE_TIERS pin', () => {
    expect(PROVENANCE_TIERS).toEqual([0, 1, 2]);
  });
});

describe('IR types — (c) schema anchors pattern', () => {
  it('anchors items pattern is exactly ^FF\\d{4}$', () => {
    expect(schema.properties.anchors.items.pattern).toBe('^FF\\d{4}$');
  });
});

// (d) Option B (ir-unfreeze S1): the TS RelationalRule discriminated-union ops and the schema's
// RelationalRule oneOf arm `op` consts MUST agree — the same schema-read coherence discipline as
// (a) for selectorClass, so a drift between the type and the recursive JSON-Schema is caught.
describe('IR types — (d) RELATIONAL_OPS matches schema RelationalRule arm op-consts (bidirectional)', () => {
  const armOpConsts = [
    schema.definitions.RelationalHas.properties.op.const,
    schema.definitions.RelationalNot.properties.op.const,
    schema.definitions.RelationalAll.properties.op.const,
    schema.definitions.RelationalAny.properties.op.const,
  ];

  it('every schema arm op-const is a RELATIONAL_OPS member', () => {
    for (const op of armOpConsts) {
      expect(
        (RELATIONAL_OPS as readonly string[]).includes(op),
        `schema arm op "${op}" missing from RELATIONAL_OPS`,
      ).toBe(true);
    }
  });

  it('every RELATIONAL_OPS member maps to exactly one schema arm', () => {
    for (const op of RELATIONAL_OPS) {
      expect(
        armOpConsts.filter((c) => c === op),
        `op "${op}" must map to exactly one schema arm`,
      ).toHaveLength(1);
    }
  });

  it('the RelationalRule union has exactly 4 arms (oneOf)', () => {
    expect(schema.definitions.RelationalRule.oneOf).toHaveLength(4);
  });
});
