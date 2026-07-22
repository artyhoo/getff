/**
 * F-tripwire — the mechanical detector for research-source-trust.md §5 item 3's
 * harden-criterion. Item F (ackFilePath no path-containment) stays
 * KEEP-DOCUMENTED / BLOCKED.
 *
 * Threat (F): a plan-derived (untrusted, --from-research) value reaches
 * `ResolveCtx.ackFilePath`, which `resolveAllowedSources` reads verbatim into
 * `loadAckFile(ctx.ackFilePath ?? <default>)` (allowlist-resolver.ts) with NO
 * path-containment (no `..` / absolute / symlink reject) — an attacker-chosen
 * filesystem path fed straight into a file read.
 *
 * Why F is BLOCKED today: `ackFilePath` is DECLARED once (the `ResolveCtx` field
 * in allowlist-resolver.ts) and READ once (the `loadAckFile` call there), and
 * NOWHERE else across the research/synthesizer sources. Since ecosystem-wiring W2
 * the sole production `ResolveCtx` construction literals live in ONE factory,
 * `synthesizer/resolve-ctx.ts` (`resolveCtxForRoot`), which returns
 * `{ root, adapter: <npm|cargo|pip>Adapter }` and never threads ackFilePath; the
 * two plan-parsing call sites pass that factory's result verbatim:
 *     synthesizer/cli.ts          validateResearchPlan(parsed, resolveCtxForRoot(args.root))
 *     synthesizer/file-clients.ts validateResearchPlan(parsed, resolveCtxForRoot(process.cwd()))
 * and research-plan.schema.json is `additionalProperties:false`, so a plan cannot
 * smuggle an `ackFilePath` key through --from-research either.
 *
 * This tripwire makes F's harden-criterion MECHANICALLY DETECTABLE. GREEN today;
 * RED the instant either realization of F lands:
 *   (I1) CONTAINMENT — `ackFilePath` escapes its type-def + single read-site
 *        (allowlist-resolver.ts) into ANY plan-parsing source.
 *   (I2) CONSTRUCTION — any production `validateResearchPlan(parsed, {...})`
 *        ResolveCtx literal grows an `ackFilePath:` key.
 * When this fires, the fix is NOT to relax the tripwire — it is to add the
 * path-containment F names (reject `..` / absolute / symlink-escape before
 * loadAckFile) and re-scope F from BLOCKED to CONDITIONAL per §5.
 *
 * Residual (documented, NOT covered): both detectors are TEXTUAL — a
 * reintroduction that never writes the literal token `ackFilePath` slips both,
 * the one realistic shape being an ANONYMOUS SPREAD of a plan-derived object into
 * a ctx literal (`validateResearchPlan(parsed, { root, adapter, ...planCtx })`).
 * That requires a *future* caller-side refactor (today both prod literals are
 * `{ root, adapter }`, and `additionalProperties:false` blocks direct plan
 * smuggling), so it is a documented residual, not a live hole. If a spread-into-ctx
 * shape is ever introduced, add a third detector flagging a `...`-spread inside a
 * `validateResearchPlan` / `resolveAllowedSources` ctx literal.
 * (Adapter-jig H2 note: the previously UNDOCUMENTED nested-brace evasion of I2 —
 * a ctx literal whose flat-brace scan was broken by a nested `{ … }` value — is
 * now CLOSED by the union detector below, no longer a residual. The remaining
 * exotic textual gap is an inline comment interposed directly before the key
 * inside a nested-brace literal — that breaks shape 2's `[{,]` adjacency; it is
 * caught by I1 regardless, since I1 flags the bare token anywhere outside home.)
 *
 * Deterministic: git ls-files + readFileSync + regex. ZERO API-billed calls
 * (no-paid-llm-in-ci). Mirrors principle 30's git-aware trackedStoreFiles idiom.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

/** The single file allowed to name `ackFilePath` — the `ResolveCtx` type-def home
 *  + the single `loadAckFile` read-site. Any OTHER research/synthesizer source
 *  naming it means the field escaped its seam. */
const ACKFILEPATH_HOME = 'packages/core/research/allowlist-resolver.ts';

/** Plan-parsing sources: everything under research/*.ts ∪ synthesizer/*.ts is
 *  where a plan-derived (untrusted) value could reach a ResolveCtx literal.
 *  git-aware (mirrors principle 30 trackedStoreFiles); empty list is a valid
 *  fresh-clone state. */
function trackedResearchSynthSources(): { rel: string; abs: string }[] {
  let out = '';
  try {
    out = execFileSync(
      'git',
      ['ls-files', '-z', 'packages/core/research/*.ts', 'packages/core/synthesizer/*.ts'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
  } catch {
    return [];
  }
  return out
    .split('\0')
    .filter(Boolean)
    .filter((rel) => !rel.endsWith('.test.ts')) // discipline check on prod sources, not tests
    .map((rel) => ({ rel, abs: resolve(REPO_ROOT, rel) }))
    .filter(({ abs }) => existsSync(abs));
}

/** I2 detector: a construction that threads a value into an `ackFilePath:` key —
 *  REGARDLESS of whether an `adapter:` key is co-present. Keyed on the
 *  `ackFilePath:` value-key ALONE, not on a co-present `adapter:`. This is
 *  deliberate: it catches BOTH the W2 factory return
 *  `{ root, adapter: X, ackFilePath: Y }` in resolve-ctx.ts AND an adapter-LESS
 *  reintroduction such as
 *      validateResearchPlan(parsed, { root, ackFilePath: plan.ackFilePath })
 *  at any call site. That adapter-less shape is exactly what a narrower
 *  `adapter:`-co-present regex silently missed — restoring it keeps I2 an
 *  INDEPENDENT defense-in-depth layer over I1 (the containment grep), not a
 *  single-point dependent on it.
 *
 *  Union of two shapes (adapter-jig H2 rework — the earlier single flat-brace
 *  form `\{(?=[^{}]*\backFilePath\s*:)[^{}]*\}` required the key to sit in a
 *  brace group with NO nested braces, an undocumented structural narrowing: a
 *  ctx literal carrying a nested-brace value, e.g.
 *  `{ root, adapter: { ecosystem: 1 }, ackFilePath: root }`, EVADED it entirely.
 *  Per this arm's own no-conjunctive-narrowing principle the detector now keys
 *  on the invariant-bearing token in a construction position alone):
 *    1. `\{[^{}]*\backFilePath\s*:`  — the key inside a flat brace-group prefix
 *       (tolerates an interposed inline comment between `,` and the key);
 *    2. `[{,]\s*\backFilePath\s*:`   — the key in key-position after `{` or `,`
 *       at ANY nesting depth (closes the nested-brace evasion).
 *
 *  The `:` (not `?:`) requirement keeps an optional-property DECLARATION
 *  (`ackFilePath?:` in the `ResolveCtx` interface) from matching: the `?` breaks
 *  the `ackFilePath\s*:` adjacency, so a type-def never trips a construction
 *  detector. (The type-def home, allowlist-resolver.ts, is also excluded from the
 *  scan below regardless — belt and suspenders.) */
const RESOLVE_CTX_ACKFILEPATH_RE =
  /\{[^{}]*\backFilePath\s*:|[{,]\s*\backFilePath\s*:/;

describe('F-tripwire — ackFilePath plan-containment (research-source-trust.md §5 item 3)', () => {
  const sources = trackedResearchSynthSources();
  // Population sentinel — catches a broken glob without demanding a count. The
  // four load-bearing sources are all under these two globs.
  const POPULATED = sources.length > 0;

  it.skipIf(!POPULATED)(
    'population sentinel — research/synthesizer sources are enumerable (glob intact)',
    () => {
      expect(sources.length).toBeGreaterThan(0);
      const rels = sources.map((s) => s.rel);
      expect(rels).toContain(ACKFILEPATH_HOME);
      expect(rels).toContain('packages/core/research/validate-plan.ts');
      expect(rels).toContain('packages/core/synthesizer/cli.ts');
      expect(rels).toContain('packages/core/synthesizer/file-clients.ts');
      expect(rels).toContain('packages/core/synthesizer/resolve-ctx.ts');
    },
  );

  // ── I1: CONTAINMENT — `ackFilePath` lives ONLY in its type-def + read-site home ──
  it.skipIf(!POPULATED)(
    'I1: no research/synthesizer source names `ackFilePath` except its allowlist-resolver.ts home',
    () => {
      const escapes: string[] = [];
      for (const { rel, abs } of sources) {
        if (rel === ACKFILEPATH_HOME) continue; // type-def + single read-site — allowed
        if (/\backFilePath\b/.test(readFileSync(abs, 'utf8'))) escapes.push(rel);
      }
      expect(
        escapes,
        `\`ackFilePath\` escaped its type-def + single read-site (${ACKFILEPATH_HOME}) into a ` +
          `plan-parsing source:\n  ${escapes.join('\n  ')}\n` +
          `Item F (research-source-trust.md §5) is BLOCKED precisely because ackFilePath is confined ` +
          `to allowlist-resolver.ts. If a plan-controlled ack-file path is now genuinely introduced, ` +
          `ADD PATH-CONTAINMENT (reject '..' / absolute / symlink-escape before loadAckFile) and ` +
          `re-scope F from BLOCKED to CONDITIONAL — do NOT relax this tripwire.`,
      ).toHaveLength(0);
    },
  );

  // ── I2: CONSTRUCTION — no production ResolveCtx literal threads ackFilePath ──
  it.skipIf(!POPULATED)(
    'I2: no production ResolveCtx construction literal carries an `ackFilePath:` key',
    () => {
      const offenders: string[] = [];
      for (const { rel, abs } of sources) {
        if (rel === ACKFILEPATH_HOME) continue; // the ResolveCtx type-def home legitimately declares both fields (`adapter?:`/`ackFilePath?:`)
        if (RESOLVE_CTX_ACKFILEPATH_RE.test(readFileSync(abs, 'utf8'))) offenders.push(rel);
      }
      expect(
        offenders,
        `A production ResolveCtx construction threaded a value into ackFilePath in the plan-parsing ` +
          `path:\n  ${offenders.join('\n  ')}\n` +
          `The production construction literals (synthesizer/resolve-ctx.ts resolveCtxForRoot) must stay ` +
          `{ root, adapter } only. An attacker controls the --from-research plan; ackFilePath is read ` +
          `verbatim into loadAckFile with no path-containment. Add the containment F names first.`,
      ).toHaveLength(0);
    },
  );

  // ── Paired negative — proves I2 DISCRIMINATES on the REAL construction shape ──
  // The positive arm is NOT a synthetic string — it is the REAL
  // synthesizer/resolve-ctx.ts construction literal read live from the working
  // tree (the sole production ResolveCtx literal since W2), with `ackFilePath`
  // threaded in exactly as an attacker-reachable --from-research change would.
  describe('paired negative — I2 is non-vacuous on the real construction shape', () => {
    const CTX_REL = 'packages/core/synthesizer/resolve-ctx.ts';
    const CTX_ABS = resolve(REPO_ROOT, CTX_REL);
    const ctxPresent = existsSync(CTX_ABS);
    const CLEAN_LITERAL = '{ root, adapter: npmAdapter }';

    // @arm:H2:pos tripwire-predicate-no-conjunctive-narrowing (GREEN-path control:
    // the live production literal is clean and the broadened token-alone predicate
    // does NOT false-fire on it — jig registry semantics: pos = clean state passes)
    it.skipIf(!ctxPresent)(
      'sanity: the real synthesizer/resolve-ctx.ts construction literal exists and is currently clean',
      () => {
        const text = readFileSync(CTX_ABS, 'utf8');
        expect(text).toContain(CLEAN_LITERAL);
        expect(RESOLVE_CTX_ACKFILEPATH_RE.test(text)).toBe(false); // clean today
      },
    );

    // @arm:H2:neg tripwire-predicate-no-conjunctive-narrowing (RED-proof: the
    // violating construction — threading the invariant-bearing token into the REAL
    // production literal — trips the detector; proves the tripwire CAN fire)
    it.skipIf(!ctxPresent)(
      'POSITIVE arm: threading ackFilePath into the REAL resolve-ctx.ts literal trips the detector (RED proof)',
      () => {
        const text = readFileSync(CTX_ABS, 'utf8');
        const attacked = text.replace(
          CLEAN_LITERAL,
          '{ root, adapter: npmAdapter, ackFilePath: root }',
        );
        // Guard: the replace must have matched the real literal, else the proof is
        // vacuous (drift in resolve-ctx.ts renamed the literal).
        expect(attacked).not.toBe(text);
        expect(RESOLVE_CTX_ACKFILEPATH_RE.test(attacked)).toBe(true);
      },
    );

    it.skipIf(!ctxPresent)(
      'anti-tautology: the untouched real resolve-ctx.ts literal is NOT flagged (detector is specific)',
      () => {
        expect(RESOLVE_CTX_ACKFILEPATH_RE.test(readFileSync(CTX_ABS, 'utf8'))).toBe(false);
      },
    );

    // Coverage restoration (W2 rework): the detector must flag an `ackFilePath:`
    // literal EVEN WHEN no `adapter:` key is co-present. The retargeted
    // (adapter-co-present) regex silently missed the adapter-less shape below —
    // e.g. `validateResearchPlan(parsed, { root, ackFilePath: plan.ackFilePath })`
    // — which the OLD (pre-retarget) regex caught. Broadening I2 to key on
    // `ackFilePath:` alone restores that independent defense-in-depth over I1.
    // @arm:H2:neg tripwire-predicate-no-conjunctive-narrowing (the previously-caught
    // shape the W2 conjunctive `adapter:`-co-present retarget silently missed — the
    // arm's Origin corpus case: every retarget must keep it tripping)
    it('POSITIVE arm: an adapter-LESS ackFilePath ctx literal trips the detector (the shape the co-present regex missed)', () => {
      const adapterLess = 'validateResearchPlan(parsed, { root: args.root, ackFilePath: (parsed as any).ackFilePath });';
      expect(RESOLVE_CTX_ACKFILEPATH_RE.test(adapterLess)).toBe(true);
    });

    // @arm:H2:pos tripwire-predicate-no-conjunctive-narrowing (GREEN-path control /
    // anti-tautology: a type-def DECLARATION never trips the construction detector —
    // proves the broadened predicate still discriminates)
    // The `?:` optional-property DECLARATION syntax must NOT match — it is a
    // type-def, not a construction that threads a value. `?` breaks the
    // `ackFilePath\s*:` adjacency the detector keys on.
    it('anti-tautology: an `ackFilePath?:` optional-property DECLARATION is NOT flagged', () => {
      const declaration = 'interface ResolveCtx { root: string; adapter?: EcosystemAdapter; ackFilePath?: string; }';
      expect(RESOLVE_CTX_ACKFILEPATH_RE.test(declaration)).toBe(false);
    });

    // @arm:H2:neg tripwire-predicate-no-conjunctive-narrowing (fix+arm atomic: the
    // pre-fix flat-brace-group detector REQUIRED the key to sit in a brace group
    // with no nested braces — an undocumented structural narrowing, the exact
    // failure class this arm exists to catch. RED-proof: this test FAILED against
    // the pre-fix regex — "expected false to be true" — and went GREEN only with
    // the token-alone union predicate.)
    // A ctx literal that ALSO carries a nested-brace value (e.g. an inline
    // adapter object) must still trip the detector — the flat-brace-group shape
    // (`[^{}]*`) cannot cross the nested `{ … }`, so this construction EVADED the
    // detector entirely (probed empirically: flat=true, nested=false).
    it('a NESTED-brace ctx literal threading ackFilePath trips the detector (the flat-brace evasion shape)', () => {
      const nested =
        'validateResearchPlan(parsed, { root, adapter: { ecosystem: 1 }, ackFilePath: root })';
      expect(RESOLVE_CTX_ACKFILEPATH_RE.test(nested)).toBe(true);
    });
  });
});
