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

/** I2 detector: a ResolveCtx construction object literal that carries an
 *  `ackFilePath:` key. Keyed on the ctx SHAPE (a brace group carrying BOTH an
 *  `adapter:` value-key AND an `ackFilePath:` value-key, in either order) rather
 *  than the enclosing `validateResearchPlan(...)` call — so it catches the W2
 *  factory return `{ root, adapter: X, ackFilePath: Y }` in resolve-ctx.ts AND a
 *  future reintroduced inline literal at a call site alike. The `:` (not `?:`)
 *  requirement is what keeps the `ResolveCtx` interface's own `adapter?:` /
 *  `ackFilePath?:` optional-property declaration in allowlist-resolver.ts from
 *  matching (that home file is excluded from the scan below regardless). */
const RESOLVE_CTX_ACKFILEPATH_RE =
  /\{(?=[^{}]*\badapter\s*:)(?=[^{}]*\backFilePath\s*:)[^{}]*\}/s;

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

    it.skipIf(!ctxPresent)(
      'sanity: the real synthesizer/resolve-ctx.ts construction literal exists and is currently clean',
      () => {
        const text = readFileSync(CTX_ABS, 'utf8');
        expect(text).toContain(CLEAN_LITERAL);
        expect(RESOLVE_CTX_ACKFILEPATH_RE.test(text)).toBe(false); // clean today
      },
    );

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
  });
});
