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
 * NOWHERE else across the research/synthesizer sources. The only two production
 * `ResolveCtx` construction literals — both in the plan-parsing path — construct
 * `{ root, adapter }` and never thread ackFilePath:
 *     synthesizer/cli.ts          validateResearchPlan(parsed, { root: args.root, adapter: npmAdapter })
 *     synthesizer/file-clients.ts validateResearchPlan(parsed, { root: process.cwd(), adapter: npmAdapter })
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

/** I2 detector: a ResolveCtx object literal passed to validateResearchPlan that
 *  carries an `ackFilePath:` key. The two production literals are
 *  `{ root, adapter }` only — this matches the moment one grows the seam. */
const VALIDATE_PLAN_ACKFILEPATH_RE = /validateResearchPlan\s*\([^)]*\{[^}]*\backFilePath\s*:/s;

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

  // ── I2: CONSTRUCTION — no validateResearchPlan(...) ctx literal threads ackFilePath ──
  it.skipIf(!POPULATED)(
    'I2: no production validateResearchPlan(parsed, {...}) ctx literal carries an `ackFilePath:` key',
    () => {
      const offenders: string[] = [];
      for (const { rel, abs } of sources) {
        if (VALIDATE_PLAN_ACKFILEPATH_RE.test(readFileSync(abs, 'utf8'))) offenders.push(rel);
      }
      expect(
        offenders,
        `A production ResolveCtx construction threaded a value into ackFilePath in the plan-parsing ` +
          `path:\n  ${offenders.join('\n  ')}\n` +
          `The two production literals (synthesizer/cli.ts, synthesizer/file-clients.ts) must stay ` +
          `{ root, adapter } only. An attacker controls the --from-research plan; ackFilePath is read ` +
          `verbatim into loadAckFile with no path-containment. Add the containment F names first.`,
      ).toHaveLength(0);
    },
  );

  // ── Paired negative — proves I2 DISCRIMINATES on the REAL call-graph shape ──
  // The positive arm is NOT a synthetic string — it is the REAL synthesizer/cli.ts
  // construction line read live from the working tree, with `ackFilePath` threaded
  // in exactly as an attacker-reachable --from-research change would do it.
  describe('paired negative — I2 is non-vacuous on the real construction shape', () => {
    const CLI_REL = 'packages/core/synthesizer/cli.ts';
    const CLI_ABS = resolve(REPO_ROOT, CLI_REL);
    const cliPresent = existsSync(CLI_ABS);

    it.skipIf(!cliPresent)(
      'sanity: the real synthesizer/cli.ts construction line exists and is currently clean',
      () => {
        const text = readFileSync(CLI_ABS, 'utf8');
        expect(text).toMatch(
          /validateResearchPlan\(parsed,\s*\{\s*root:\s*args\.root,\s*adapter:\s*npmAdapter\s*\}\)/,
        );
        expect(VALIDATE_PLAN_ACKFILEPATH_RE.test(text)).toBe(false); // clean today
      },
    );

    it.skipIf(!cliPresent)(
      'POSITIVE arm: threading ackFilePath into the REAL cli.ts literal trips the detector (RED proof)',
      () => {
        const text = readFileSync(CLI_ABS, 'utf8');
        const attacked = text.replace(
          'validateResearchPlan(parsed, { root: args.root, adapter: npmAdapter })',
          'validateResearchPlan(parsed, { root: args.root, adapter: npmAdapter, ackFilePath: (parsed as any).ackFilePath })',
        );
        // Guard: the replace must have matched the real line, else the proof is
        // vacuous (drift in cli.ts renamed the literal).
        expect(attacked).not.toBe(text);
        expect(VALIDATE_PLAN_ACKFILEPATH_RE.test(attacked)).toBe(true);
      },
    );

    it.skipIf(!cliPresent)(
      'anti-tautology: the untouched real cli.ts literal is NOT flagged (detector is specific)',
      () => {
        expect(VALIDATE_PLAN_ACKFILEPATH_RE.test(readFileSync(CLI_ABS, 'utf8'))).toBe(false);
      },
    );
  });
});
