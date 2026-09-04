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

// ─────────────────────────────────────────────────────────────────────────────
// Adapter-jig arm G2 `all-callsites-migrated-atomically` (spec §3.7) — the
// ADAPTER-keyed twin of the I2 tripwire above.
//
// W2 (#1076) migrated BOTH production ctx-construction callsites
// (synthesizer/cli.ts + synthesizer/file-clients.ts) through the single factory
// `resolveCtxForRoot` (synthesizer/resolve-ctx.ts) and §1.7-verified «no third
// site». That claim was protected only by the ackFilePath-keyed I2 detector —
// which would NOT catch a rogue `{ root, adapter: npmAdapter }` bypass that
// omits ackFilePath (recon group G, honest coverage-gap finding). G2 closes it:
//   (1) SCAN — no production research/synthesizer source OTHER than the factory
//       home constructs a ResolveCtx with a hardcoded `<npm|cargo|pip>Adapter`
//       literal; every production ResolveCtx comes from resolveCtxForRoot.
//   (2) CENSUS — the production `resolveCtxForRoot(` call sites are EXACTLY
//       {cli.ts, file-clients.ts} (mirrors the ecosystem-unwired-debt BASELINE
//       discipline: a callsite added or dropped must update this census in the
//       SAME PR — that is the atomic-migration gate, both directions).
// The detector reuses the H2 lesson directly: a token-alone union predicate
// (flat-brace prefix ∪ key-position at any nesting depth), never a conjunctive
// co-presence term.
// ─────────────────────────────────────────────────────────────────────────────

/** The single file allowed to construct a ResolveCtx with an explicit
 *  `adapter: <symbol>` literal — the W2 factory (analogous to ACKFILEPATH_HOME
 *  for the I-detectors above). */
const CTX_FACTORY_HOME = 'packages/core/synthesizer/resolve-ctx.ts';

/** G2 detector: a hardcoded default-adapter ResolveCtx construction —
 *  `adapter:` key in construction position with a concrete `<npm|cargo|pip>Adapter`
 *  symbol value. Union of the two H2 shapes (flat-brace prefix tolerating an
 *  interposed inline comment; key-position after `{`/`,` at any nesting depth —
 *  closes the nested-brace evasion). A type DECLARATION (`adapter?:`) never
 *  matches (`?` breaks the `adapter\s*:` adjacency); an import binding
 *  (`import { npmAdapter }`) has no `adapter:` key; the factory-call form
 *  (`resolveCtxForRoot(root)`) carries no literal at all. */
const HARDCODED_ADAPTER_CTX_RE =
  /\{[^{}]*\badapter\s*:\s*(?:npm|cargo|pip)Adapter\b|[{,]\s*adapter\s*:\s*(?:npm|cargo|pip)Adapter\b/;

/** A production factory call site (definition line excluded via CTX_FACTORY_HOME). */
const FACTORY_CALL_RE = /\bresolveCtxForRoot\s*\(/;

/** The frozen production callsite census (W2 #1076 «both sites, no third»).
 *  Adding a legitimate new plan-parsing entrypoint MUST extend this census in
 *  the same PR that adds the `resolveCtxForRoot` call — atomic, both ways. */
const EXPECTED_FACTORY_CALLSITES = [
  'packages/core/synthesizer/cli.ts',
  'packages/core/synthesizer/file-clients.ts',
];

describe('G2 — all production ResolveCtx construction routes through the factory (adapter-jig §3.7)', () => {
  const sources = trackedResearchSynthSources();
  const POPULATED = sources.length > 0;

  // @arm:G2:pos all-callsites-migrated-atomically (GREEN path: zero hardcoded
  // default-adapter literals outside the factory home — the W2 migration is
  // complete and STAYS complete)
  it.skipIf(!POPULATED)(
    'SCAN: no production source outside resolve-ctx.ts constructs a ResolveCtx with a hardcoded <npm|cargo|pip>Adapter literal',
    () => {
      const offenders: string[] = [];
      for (const { rel, abs } of sources) {
        if (rel === CTX_FACTORY_HOME) continue; // the sanctioned construction home
        if (HARDCODED_ADAPTER_CTX_RE.test(readFileSync(abs, 'utf8'))) offenders.push(rel);
      }
      expect(
        offenders,
        `A production source constructs a ResolveCtx with a hardcoded adapter literal, bypassing ` +
          `resolveCtxForRoot:\n  ${offenders.join('\n  ')}\n` +
          `Since ecosystem-wiring W2 the ONLY sanctioned \`adapter: <symbol>\` construction home is ` +
          `${CTX_FACTORY_HOME} (resolveCtxForRoot) — a hardcoded literal re-pins one ecosystem's adapter ` +
          `and silently mis-routes python/cargo consumers down the npm path. Route the callsite through ` +
          `resolveCtxForRoot(root) instead; if a genuinely new construction home is intended, that is a ` +
          `spec §2 frozen-contract change, not a drive-by literal.`,
      ).toHaveLength(0);
    },
  );

  // @arm:G2:pos all-callsites-migrated-atomically (census half: BOTH migrated
  // callsites still call the factory, and NO unexpected third caller exists —
  // set-equality in both directions, the atomicity gate)
  it.skipIf(!POPULATED)(
    'CENSUS: production resolveCtxForRoot call sites are exactly {cli.ts, file-clients.ts}',
    () => {
      const callers = sources
        .filter(({ rel }) => rel !== CTX_FACTORY_HOME) // the defining file, not a call site
        .filter(({ abs }) => FACTORY_CALL_RE.test(readFileSync(abs, 'utf8')))
        .map(({ rel }) => rel)
        .sort();
      expect(
        callers,
        `The production resolveCtxForRoot callsite census drifted from the frozen W2 set ` +
          `[${EXPECTED_FACTORY_CALLSITES.join(', ')}].\n` +
          `A NEW caller: extend EXPECTED_FACTORY_CALLSITES in this census (same PR — atomic migration). ` +
          `A DROPPED caller: that plan-parsing site lost its Tier-1 ctx routing — restore the factory ` +
          `call or migrate the census consciously, never silently.`,
      ).toEqual([...EXPECTED_FACTORY_CALLSITES].sort());
    },
  );

  // @arm:G2:pos all-callsites-migrated-atomically (anti-vacuity grounding: the
  // detector regex MATCHES the factory's own real construction literals — the
  // live positive corpus proving the regex fits the real construction shape)
  it('sanity: the factory home itself carries the sanctioned literals and the detector recognizes them', () => {
    const factoryText = readFileSync(resolve(REPO_ROOT, CTX_FACTORY_HOME), 'utf8');
    expect(factoryText).toContain('{ root, adapter: npmAdapter }');
    expect(HARDCODED_ADAPTER_CTX_RE.test(factoryText)).toBe(true);
  });

  describe('paired negative — G2 is non-vacuous on the real callsite shape', () => {
    const CLI_REL = 'packages/core/synthesizer/cli.ts';
    const CLI_ABS = resolve(REPO_ROOT, CLI_REL);
    const cliPresent = existsSync(CLI_ABS);
    const CLEAN_CALL = 'validateResearchPlan(parsed, resolveCtxForRoot(args.root));';

    // @arm:G2:neg all-callsites-migrated-atomically (RED-proof: reverting the
    // REAL cli.ts callsite to its pre-W2 hardcoded shape trips the detector —
    // observed live as a planted on-disk violation failing the SCAN + CENSUS
    // arms before this in-memory form was committed)
    it.skipIf(!cliPresent)(
      'reverting the REAL cli.ts callsite to a hardcoded { root, adapter: npmAdapter } literal trips the detector',
      () => {
        const text = readFileSync(CLI_ABS, 'utf8');
        const attacked = text.replace(
          CLEAN_CALL,
          'validateResearchPlan(parsed, { root: args.root, adapter: npmAdapter });',
        );
        // Guard: the replace must have matched the real factory call, else the
        // proof is vacuous (drift in cli.ts renamed the callsite shape).
        expect(attacked).not.toBe(text);
        expect(HARDCODED_ADAPTER_CTX_RE.test(attacked)).toBe(true);
        // ...and the clean text does NOT trip (the discrimination pair).
        expect(HARDCODED_ADAPTER_CTX_RE.test(text)).toBe(false);
      },
    );

    // @arm:G2:neg all-callsites-migrated-atomically (nested-brace evasion shape
    // — the H2 lesson applied to the adapter key: key-position after `,` at any
    // nesting depth still trips)
    it('a NESTED-brace ctx literal with a hardcoded adapter trips the detector', () => {
      const nested =
        'validateResearchPlan(parsed, { root, meta: { depth: 1 }, adapter: cargoAdapter })';
      expect(HARDCODED_ADAPTER_CTX_RE.test(nested)).toBe(true);
    });

    // @arm:G2:pos all-callsites-migrated-atomically (anti-tautology trio: the
    // three legitimate `xxxAdapter` / `adapter` shapes production code is
    // ALLOWED to carry must NOT trip — declaration, import, factory call)
    it('anti-tautology: a type declaration, an import binding, and the factory-call form are NOT flagged', () => {
      const declaration =
        'interface ResolveCtx { root: string; adapter?: EcosystemAdapter; ackFilePath?: string; }';
      const importBinding = "import { npmAdapter } from '../research/ecosystem-npm.ts';";
      const factoryCall = 'validateResearchPlan(parsed, resolveCtxForRoot(process.cwd()));';
      expect(HARDCODED_ADAPTER_CTX_RE.test(declaration)).toBe(false);
      expect(HARDCODED_ADAPTER_CTX_RE.test(importBinding)).toBe(false);
      expect(HARDCODED_ADAPTER_CTX_RE.test(factoryCall)).toBe(false);
    });
  });
});
