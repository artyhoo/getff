/**
 * Adapter-jig arm G1 `type-widening-exhaustiveness` (spec §3.7) — the
 * compiler-enumerated Stack-union sentinel.
 *
 * RETROFIT (recon group G): before this file the `Stack` union
 * (detector/types.ts) had ZERO compiler-enumerated consumer — the only
 * production brancher is `synthesizer/resolve-ctx.ts` `resolveCtxForRoot`, an
 * if-chain ending in a bare `return { root, adapter: npmAdapter }` fallthrough.
 * Adding a new toolchain variant to `Stack` (e.g. a future 'go') therefore
 * produced zero tsc errors and zero test failures anywhere: exactly the
 * «default-arm fallthrough routing the new stack down the npm path» the spec's
 * G1 RED-proof column names. This sentinel CREATES the invariant the arm
 * checks: `stackLabel` below is an exhaustive `switch (stack)` whose default
 * arm calls `assertNever` (the in-repo exhaustiveness idiom, modeled verbatim
 * on ir/gates/grammar.ts:56 — the `satisfies never`-equivalent form the spec
 * admits), so widening the union without handling the new variant makes
 * `assertNever` receive a non-`never` argument → `tsc --noEmit` RED at the
 * `typecheck` gate (packages/core/package.json). Trybuild-style: the arm's
 * pairing lives at the typecheck-gate level, not per-vitest-assertion
 * (spec §6 Rust-trybuild REFERENCE).
 *
 * SCOPE LIMIT (recon blocker b, flagged deliberately): this sentinel guards
 * TYPE-ENUMERATION only. It does NOT retrofit resolve-ctx.ts's npm-default
 * routing — a widened variant still resolves to npmAdapter there with no
 * compile error, and per the spec that default is BY-DESIGN (types.ts:5-13 +
 * resolve-ctx.ts:39-41 declare the strict-superset npm fallthrough). What the
 * sentinel guarantees is that the widening PR cannot land with the union
 * change alone: this switch stops compiling, forcing the author to make an
 * EXPLICIT decision for the new variant (and the spec §5 advisor consult on
 * the live consumer census is the process obligation covering the rest).
 *
 * Coverage plumbing (recon blocker a, verified): packages/core/tsconfig.json
 * `include: ["**\/*.ts"]` covers this file (exclusions are node_modules /
 * probes / install / pilot fixtures only), so the sentinel is live under
 * `npm run typecheck` — not silently inert.
 */
import { describe, it, expect } from 'vitest';
import type { Stack } from './types.ts';

/** Exhaustiveness guard — unreachable at runtime for a well-typed call; a
 *  compile-time totality device (grammar.ts:56 idiom, `satisfies never`
 *  equivalent). */
function assertNever(x: never): never {
  throw new Error(`unhandled Stack variant: ${JSON.stringify(x)}`);
}

/**
 * THE SENTINEL — the compiler-enumerated Stack consumer. Every variant of the
 * union MUST have an explicit case; the default arm's `assertNever(stack)`
 * only typechecks while the switch is total. Widening `Stack` in
 * detector/types.ts without extending this switch is a compile error
 * (TS2345: argument of type '"<new>"' is not assignable to parameter of type
 * 'never') — proven live during this arm's RED phase by temporarily adding
 * `| 'go'` to the union.
 */
export function stackLabel(stack: Stack): string {
  switch (stack) {
    case 'react-next':
      return 'js:react-next';
    case 'ts-server':
      return 'js:ts-server';
    case 'python':
      return 'toolchain:python';
    case 'cargo':
      return 'toolchain:cargo';
    case 'unknown':
      return 'js:unknown-default';
    default:
      return assertNever(stack);
  }
}

/**
 * Type-level PAIRED NEGATIVE — a deliberately-incomplete switch that omits
 * 'cargo'. In its default arm `stack` narrows to `'cargo'` (not `never`), so
 * the `assertNever(stack)` call is a compile error; the `@ts-expect-error`
 * directive pins that the error EXISTS. If the un-handled variant ever
 * compiled clean (exhaustiveness checking lost — e.g. `Stack` degraded to
 * `string`, or `assertNever` widened its parameter), the directive turns into
 * TS2578 «Unused '@ts-expect-error' directive» → `tsc --noEmit` RED. This is
 * the inversion the typecheck gate can actually run per-build (precedent:
 * synthesizer/rule-bootstrap.test.ts @ts-expect-error usage).
 */
function incompleteStackLabel(stack: Stack): string {
  switch (stack) {
    case 'react-next':
      return 'react-next';
    case 'ts-server':
      return 'ts-server';
    case 'python':
      return 'python';
    case 'unknown':
      return 'unknown';
    default:
      // @ts-expect-error -- 'cargo' is deliberately unhandled: `stack` is NOT
      // `never` here, so this call MUST fail to typecheck. RED-proof observed
      // live: without this directive, `npx tsc --noEmit` fails with TS2345
      // (argument of type '"cargo"' is not assignable to parameter of type
      // 'never') at this exact call.
      return assertNever(stack);
  }
}

describe('G1 — Stack union stays compiler-enumerated (adapter-jig §3.7)', () => {
  // @arm:G1:pos type-widening-exhaustiveness (GREEN path: the sentinel handles
  // every current Stack variant explicitly — tsc-clean + distinct labels; the
  // compile-time half of the positive is `npm run typecheck` passing over the
  // total switch above)
  it('the exhaustive sentinel maps every Stack variant to a distinct explicit label', () => {
    const variants: Stack[] = ['react-next', 'ts-server', 'python', 'cargo', 'unknown'];
    const labels = variants.map((v) => stackLabel(v));
    expect(labels).toEqual([
      'js:react-next',
      'js:ts-server',
      'toolchain:python',
      'toolchain:cargo',
      'js:unknown-default',
    ]);
    // All labels explicit and distinct — no two variants share a default path.
    expect(new Set(labels).size).toBe(variants.length);
  });

  // @arm:G1:neg type-widening-exhaustiveness (RED-proof: the incomplete switch
  // is a pinned compile error via @ts-expect-error above — if the omitted
  // variant ever stops being a type error, TS2578 REDs the typecheck gate.
  // The runtime half below exercises the incomplete switch's handled path so
  // the negative fixture is live code, and proves assertNever THROWS when an
  // unhandled variant actually reaches a default arm at runtime.)
  it('the deliberately-incomplete switch still serves handled variants, and assertNever throws on the unhandled one', () => {
    expect(incompleteStackLabel('python')).toBe('python');
    // Force the unhandled variant through at runtime (the cast models exactly
    // what a widened-union value would do to a stale default arm).
    expect(() => incompleteStackLabel('cargo')).toThrow(/unhandled Stack variant: "cargo"/);
  });
});
