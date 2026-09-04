// ruff.toml (flake8-tidy-imports fast-path) renderer — paired negatives (MT umbrella S2,
// python-backend-v0). Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §4, §7.
// RED-first: authored BEFORE render-ruff.ts — run to confirm it fails to import/compile, then
// implement until every case below is GREEN. Mirrors backends/{cargo,astgrep}/render-*.test.ts.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGrammarGate } from '../../ir/gates/grammar.ts';
import type { ConventionNode } from '../../ir/types.ts';
import { assertEveryNodeResolved, type RenderOutcome } from '../shared/render-outcome.ts';
import { renderRuff } from './render-ruff.ts';
import { RUFF_TID251_NODE, RUFF_TID253_NODE } from './test-fixtures.ts';

function node(overrides: Partial<ConventionNode> = {}): ConventionNode {
  return { ...RUFF_TID251_NODE, ...overrides };
}

function refused(o: RenderOutcome | undefined) {
  return o as Extract<RenderOutcome, { kind: 'refused' }>;
}
function degraded(o: RenderOutcome | undefined) {
  return o as Extract<RenderOutcome, { kind: 'degraded' }>;
}

describe('renderRuff — cross-stage self-application (T15)', () => {
  it('T15: both canonical fixtures are grammar-gate valid (pass) before use as render fixtures', () => {
    expect(runGrammarGate([RUFF_TID251_NODE]).status).toBe('pass');
    expect(runGrammarGate([RUFF_TID253_NODE]).status).toBe('pass');
    expect(runGrammarGate([RUFF_TID251_NODE, RUFF_TID253_NODE]).status).toBe('pass');
  });
});

describe('renderRuff — refusal split (routing; narrow fast-path)', () => {
  it('R1: selectorClass "type-aware" -> refused FF7001 (mypy deferred)', () => {
    const { outcomes } = renderRuff([node({ id: 'r1', selectorClass: 'type-aware', params: {} })]);
    expect(outcomes.get('r1')?.kind).toBe('refused');
    expect(refused(outcomes.get('r1')).code).toBe('FF7001');
  });

  it('R2: selectorClass "dep-graph" -> refused FF7001 (import-linter deferred)', () => {
    const { outcomes } = renderRuff([node({ id: 'r2', selectorClass: 'dep-graph', params: {} })]);
    expect(outcomes.get('r2')?.kind).toBe('refused');
    expect(refused(outcomes.get('r2')).code).toBe('FF7001');
  });

  it('R3: syntax kind "call" (call-with-args ban) -> refused FF7001 — OUT of the ruff fast-path, astgrep is the catch-all', () => {
    // The astgrep FIXTURE_NODE is exactly this shape (`datetime.datetime.now($$$ARGS)`): ruff bans
    // a qualified NAME, it cannot express a call-site arg pattern -> honest capability-gap refusal,
    // NOT a params error. This is the load-bearing narrowness boundary (P2 census NO-GO rationale).
    const { outcomes } = renderRuff([
      node({ id: 'r3', params: { kind: 'call', pattern: 'datetime.datetime.now($$$ARGS)' } }),
    ]);
    expect(outcomes.get('r3')?.kind).toBe('refused');
    expect(refused(outcomes.get('r3')).code).toBe('FF7001');
  });

  it('R4: syntax params without pattern -> refused FF7002', () => {
    const { outcomes } = renderRuff([node({ id: 'r4', params: { kind: 'attribute' } })]);
    expect(outcomes.get('r4')?.kind).toBe('refused');
    expect(refused(outcomes.get('r4')).code).toBe('FF7002');
  });

  it('R4b: syntax params with empty-string pattern -> refused FF7002 (guards the length check)', () => {
    const { outcomes } = renderRuff([node({ id: 'r4b', params: { kind: 'attribute', pattern: '' } })]);
    expect(outcomes.get('r4b')?.kind).toBe('refused');
    expect(refused(outcomes.get('r4b')).code).toBe('FF7002');
  });

  it('R5: syntax params kind "decorator" (off-contract) -> refused FF7002', () => {
    const { outcomes } = renderRuff([node({ id: 'r5', params: { kind: 'decorator', pattern: 'app.route' } })]);
    expect(outcomes.get('r5')?.kind).toBe('refused');
    expect(refused(outcomes.get('r5')).code).toBe('FF7002');
  });

  it('R6: attribute pattern that is NOT a bare dotted name -> refused FF7002 (ruff banned-api keys are qualified names)', () => {
    // `datetime.datetime.now($$$ARGS)` under kind:attribute is malformed for banned-api (parens /
    // metavars are not a qualified-name key) -> params error, distinct from the kind:call capability gap.
    const { outcomes } = renderRuff([
      node({ id: 'r6', params: { kind: 'attribute', pattern: 'datetime.datetime.now($$$ARGS)' } }),
    ]);
    expect(outcomes.get('r6')?.kind).toBe('refused');
    expect(refused(outcomes.get('r6')).code).toBe('FF7002');
  });

  it('R7: import pattern that is not a simple `import <dotted>` -> refused FF7002', () => {
    const { outcomes } = renderRuff([
      node({ id: 'r7', params: { kind: 'import', pattern: 'from requests import get' } }),
    ]);
    expect(outcomes.get('r7')?.kind).toBe('refused');
    expect(refused(outcomes.get('r7')).code).toBe('FF7002');
  });

  it('R8: node.relational present -> refused FF7001, EVEN when params look otherwise-bannable (OWNER-FORK-1 Option B, ir-unfreeze S2)', () => {
    // kind:'attribute' + a bare dotted pattern is exactly the RUFF_TID251_NODE shape (would
    // otherwise render as a banned-api entry) — but a relational tree makes the node MORE than a
    // qualified-name ban, which ruff's flake8-tidy-imports vocabulary has no surface for (no
    // has/not/all/any). Checked BEFORE the kind fast-path, so this is a real refusal, not a
    // silently-relational-blind render.
    const { outcomes } = renderRuff([
      node({
        id: 'r8',
        params: { kind: 'attribute', pattern: 'requests' },
        relational: { op: 'not', children: [{ op: 'has', pattern: 'x' }] },
      }),
    ]);
    expect(outcomes.get('r8')?.kind).toBe('refused');
    expect(refused(outcomes.get('r8')).code).toBe('FF7001');
  });

  it('R8b: node.relational present -> refused FF7001, no banned-api/banned-module entry leaks into the toml', () => {
    const { toml, outcomes } = renderRuff([
      node({
        id: 'r8b',
        params: { kind: 'attribute', pattern: 'requests' },
        relational: { op: 'not', children: [{ op: 'has', pattern: 'x' }] },
      }),
    ]);
    expect(outcomes.get('r8b')?.kind).toBe('refused');
    expect(toml).not.toContain('requests');
  });
});

describe('renderRuff — rendered goldens (byte-for-byte)', () => {
  const HEADER = '# generated by getff ruff backend v0 — do not edit by hand\n';

  it('P5a: RUFF_TID251_NODE -> rendered, ruff.toml byte-for-byte == golden (banned-api only)', () => {
    const { toml, outcomes } = renderRuff([RUFF_TID251_NODE]);
    expect(outcomes.get('no-requests-api')?.kind).toBe('rendered');
    const golden =
      HEADER +
      '[lint]\n' +
      'select = ["DTZ005", "TID251"]\n' +
      '\n' +
      '[lint.flake8-tidy-imports.banned-api]\n' +
      '"requests".msg = "Use httpx, not the requests library"\n';
    expect(toml).toBe(golden);
  });

  it('P5b: RUFF_TID253_NODE -> rendered, ruff.toml byte-for-byte == golden (module-level import only)', () => {
    const { toml, outcomes } = renderRuff([RUFF_TID253_NODE]);
    expect(outcomes.get('no-torch-module-import')?.kind).toBe('rendered');
    const golden =
      HEADER +
      '[lint]\n' +
      'select = ["DTZ005", "TID253"]\n' +
      '\n' +
      '[lint.flake8-tidy-imports]\n' +
      'banned-module-level-imports = ["torch"]\n';
    expect(toml).toBe(golden);
  });

  it('P5c: both fixtures -> rendered, both codes selected, both tables emitted (deterministic order)', () => {
    const { toml, outcomes } = renderRuff([RUFF_TID251_NODE, RUFF_TID253_NODE]);
    expect(outcomes.get('no-requests-api')?.kind).toBe('rendered');
    expect(outcomes.get('no-torch-module-import')?.kind).toBe('rendered');
    const golden =
      HEADER +
      '[lint]\n' +
      'select = ["DTZ005", "TID251", "TID253"]\n' +
      '\n' +
      '[lint.flake8-tidy-imports]\n' +
      'banned-module-level-imports = ["torch"]\n' +
      '\n' +
      '[lint.flake8-tidy-imports.banned-api]\n' +
      '"requests".msg = "Use httpx, not the requests library"\n';
    expect(toml).toBe(golden);
  });

  it('empty (all refused) -> header + [lint] select = ["DTZ005"] (built-in selector independent of custom bans; was header-only pre-DTZ005)', () => {
    const { toml } = renderRuff([node({ id: 'x', selectorClass: 'type-aware', params: {} })]);
    const golden =
      HEADER + '[lint]\n' + 'select = ["DTZ005"]\n';
    expect(toml).toBe(golden);
  });

  it('P5d: renderRuff([]) -> header + [lint] select = ["DTZ005"] (zero-bans path now emits built-in selectors; T3 item-3 implementation)', () => {
    // Mirrors the empty case above but with a literally-empty node list (no refusals), so the
    // renderToml([]) early-return path is exercised independently — covers the §2 item-1 path the
    // kickoff flagged as a §5 park trigger (park NOT taken: zero-bans path is dead on the consumer
    // lane — snapshot.sh brownfield-ruff refuses headerless consumer ruff.toml; firing.test.ts:97-110
    // exercises both bans).
    const { toml, outcomes } = renderRuff([]);
    expect(outcomes.size).toBe(0);
    const golden =
      HEADER + '[lint]\n' + 'select = ["DTZ005"]\n';
    expect(toml).toBe(golden);
  });

  it('P5e (structural, T21 backward sweep): DTZ005 is visibly distinct from TID251/TID253 in the source — BUILTIN_SELECTORS constant exists and is referenced by renderToml', () => {
    // Guards the «smuggled into one array» failure: a future edit that puts DTZ005 directly into the
    // {TID251, TID253} codes array (without the BUILTIN_SELECTORS surface marker) fails this test.
    // Reading the source as text so the structural surface (comment + constant + comment in
    // renderToml) is asserted, not just the rendered output shape. Uses an absolute path resolved
    // from this test file (via fileURLToPath) so the assertion is cwd-independent — `test:backends`
    // runs from packages/core, direct vitest runs from repo root.
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(__dirname, 'render-ruff.ts'), 'utf8');
    expect(source).toContain('BUILTIN_SELECTORS');
    expect(source).toMatch(/BUILTIN_SELECTORS.*DTZ005/);
    // The T21 backward-sweep invariant: the closed-vocabulary refusal comment is intact
    // (FF7001 NOT weakened — the closed surface is still named closed; DTZ005 is a separate surface).
    expect(source).toContain('call-with-args ban not expressible in ruff');
  });
});

describe('renderRuff — severity degrade (FF7003, first backend exercising it in the Python lane)', () => {
  it('S1: defaultSeverity "warning" -> degraded FF7003 AND the entry is STILL emitted', () => {
    const n = node({ id: 'no-requests-api', defaultSeverity: 'warning' });
    const { toml, outcomes } = renderRuff([n]);
    expect(outcomes.get('no-requests-api')?.kind).toBe('degraded');
    expect(degraded(outcomes.get('no-requests-api')).code).toBe('FF7003');
    // degraded = rendered-with-loss: the banned-api entry is present regardless.
    expect(toml).toContain('"requests".msg =');
  });

  it('S2: defaultSeverity "note" -> degraded FF7003, entry still emitted, note names the severity loss', () => {
    const n = node({ id: 'no-requests-api', defaultSeverity: 'note' });
    const { toml, outcomes } = renderRuff([n]);
    expect(outcomes.get('no-requests-api')?.kind).toBe('degraded');
    expect(degraded(outcomes.get('no-requests-api')).code).toBe('FF7003');
    expect(degraded(outcomes.get('no-requests-api')).note).toContain('severity');
    expect(toml).toContain('"requests".msg =');
  });

  it('S3: defaultSeverity "error" -> rendered, NOT degraded (error is ruff\'s fixed native level)', () => {
    const { outcomes } = renderRuff([node({ id: 'no-requests-api', defaultSeverity: 'error' })]);
    expect(outcomes.get('no-requests-api')?.kind).toBe('rendered');
  });
});

describe('renderRuff — toml shape + mapping details', () => {
  it('TID251 msg carries node.claim verbatim (parity with render-clippy.ts reason == claim)', () => {
    const n = node({ id: 'no-requests-api', claim: 'Never call the network at import time' });
    const { toml } = renderRuff([n]);
    expect(toml).toContain('"requests".msg = "Never call the network at import time"');
  });

  it('attribute pattern that is a dotted qualified name renders as the banned-api key verbatim', () => {
    const n = node({ id: 'no-utcnow', params: { kind: 'attribute', pattern: 'datetime.datetime.utcnow' } });
    const { toml } = renderRuff([n]);
    expect(toml).toContain('"datetime.datetime.utcnow".msg =');
  });

  it('import pattern: the `import ` prefix is stripped, only the module name enters TID253', () => {
    const n = node({ id: 'no-torch-module-import', params: { kind: 'import', pattern: 'import torch' } });
    const { toml } = renderRuff([n]);
    expect(toml).toContain('banned-module-level-imports = ["torch"]');
  });

  it('import pattern: a bare dotted module name (no `import ` prefix) is also accepted', () => {
    const n = node({ id: 'no-torch-module-import', params: { kind: 'import', pattern: 'torch' } });
    const { toml } = renderRuff([n]);
    expect(toml).toContain('banned-module-level-imports = ["torch"]');
  });

  it('double quotes in the claim are escaped inside the TID251 msg basic-string', () => {
    const n = node({ id: 'no-requests-api', claim: 'Use "httpx" instead' });
    const { toml } = renderRuff([n]);
    expect(toml).toContain('"requests".msg = "Use \\"httpx\\" instead"');
  });

  it('TID253 module names are sorted for determinism', () => {
    const zz = node({ id: 'zz', params: { kind: 'import', pattern: 'import zzz' } });
    const aa = node({ id: 'aa', params: { kind: 'import', pattern: 'import aaa' } });
    const { toml } = renderRuff([zz, aa]);
    expect(toml).toContain('banned-module-level-imports = ["aaa", "zzz"]');
  });

  it('TID251 banned-api keys are sorted for determinism', () => {
    const zz = node({ id: 'zz', params: { kind: 'attribute', pattern: 'zzz' } });
    const aa = node({ id: 'aa', params: { kind: 'attribute', pattern: 'aaa' } });
    const { toml } = renderRuff([zz, aa]);
    const idxA = toml.indexOf('"aaa".msg');
    const idxZ = toml.indexOf('"zzz".msg');
    expect(idxA).toBeGreaterThan(-1);
    expect(idxZ).toBeGreaterThan(-1);
    expect(idxA).toBeLessThan(idxZ);
  });

  it('TID253 duplicate module bans collapse to ONE array entry (deduped-order-stable)', () => {
    const a = node({ id: 'a', params: { kind: 'import', pattern: 'import torch' } });
    const b = node({ id: 'b', params: { kind: 'import', pattern: 'torch' } }); // same module, bare form
    const { toml } = renderRuff([a, b]);
    expect(toml).toContain('banned-module-level-imports = ["torch"]');
    // Exactly one occurrence of the module string inside the array (no `["torch", "torch"]`).
    expect(toml.match(/"torch"/g)?.length).toBe(1);
  });

  it('TID251 duplicate qualified-name bans collapse to ONE key — NO invalid duplicate TOML key', () => {
    // Two nodes banning the same qualified name would otherwise emit `"requests".msg = ...` twice,
    // which is invalid TOML (duplicate key). Dedup-by-key keeps the first (post-sort) message.
    const a = node({ id: 'a', claim: 'first message', params: { kind: 'attribute', pattern: 'requests' } });
    const b = node({ id: 'b', claim: 'second message', params: { kind: 'attribute', pattern: 'requests' } });
    const { toml } = renderRuff([a, b]);
    expect(toml.match(/^"requests"\.msg =/gm)?.length).toBe(1);
    expect(toml).toContain('"requests".msg = "first message"');
    expect(toml).not.toContain('second message');
  });

  it('R-assert: outcomes missing a node -> assertEveryNodeResolved throws', () => {
    expect(() => assertEveryNodeResolved(['missing-1'], new Map<string, RenderOutcome>())).toThrow();
  });
});
