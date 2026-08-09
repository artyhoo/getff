#!/usr/bin/env -S npx tsx
/**
 * rule-bootstrap-cli.ts — install-time entry for the rule-bootstrapping SKELETON spike.
 *
 * Invoked behind the `--full` carrier (session-bound, NEVER the CI self-install path)
 * to run: stub-research → generate.ts factory → install() → rules-lock.json, on the
 * react-next stack. Deterministic — no network, no LLM (principle 17, $0-in-CI).
 *
 * SHARED ENTRY: this CLI is what an install-time gate calls. The EXACT gate placement
 * (a standalone `setup.d/NN-*.sh` step vs a guarded branch in `setup.d/99-finalize.sh`)
 * is a PARKED design fork — see the kickoff §6. This CLI is the unambiguous dependency
 * of BOTH placements, so it is built here without deciding the fork. A FULL-gated,
 * node-present, degrade-on-absence shell block is sketched in the README banner below.
 *
 *   # --- ready-to-wire shell block (placement PARKED — do not enable without GO) ---
 *   if [ -n "${FULL:-}" ] && [ "$DRY_RUN" != "--dry-run" ] && command -v node >/dev/null 2>&1; then
 *     _rb="$PKG_ROOT/packages/core/install/rule-bootstrap-cli.ts"
 *     [ -f "$_rb" ] && ( cd "$PROJECT_ROOT" && npx --no-install tsx "$_rb" \
 *         --consumer-root "$PROJECT_ROOT" 2>&1 ) || true   # rc=0: never abort install
 *   fi
 *   # -------------------------------------------------------------------------------
 *
 * @cc-only-rationale: install-time orchestration script run in consumer context after
 *   --full dep-install; the bash gate is the primary gatekeeper, this CLI is the payload.
 *
 * Prior-art: prior-art-evaluations.md#183 (rule-research→rule-factory bridge BUILD;
 *   #798 §11). Re-grep the next-free id at commit time per kickoff §4.
 */

import process from 'node:process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
// NOTE: `runRuleBootstrap` is imported DYNAMICALLY inside main() (the live/synthesis arm), NOT
// statically here. It transitively reaches `validator/validate.ts` → `gate-conflict.ts` /
// `gate-tautology.ts`, whose top-level `import … from '@rules-as-tests/preset-next-15-canonical/
// eslint-rules'` requires the sibling workspace preset to be resolvable AT MODULE LOAD. The
// lightweight `--from-practice` arm (renderResearchedAstgrep, preset-free) does NOT need any of
// that — but a static import here would drag the preset into EVERY CLI invocation, so merely
// LOADING this module in a core-only layout (`npm ci --prefix packages/core`, no sibling
// packages — the `test:backends` CI job) crashes with ERR_MODULE_NOT_FOUND before parseArgs runs.
// Keeping the import dynamic lets the render/practice paths run preset-free (ecosystem-wiring W5).
import {
  FileResearchClient,
  FileGenerateClient,
  withManualDrop,
} from '../synthesizer/file-clients.ts';
import { ResearchPlanError } from '../research/validate-plan.ts';
import {
  planResearchedAstgrep,
  type ResearchOnlyFinding,
} from '../synthesizer/render-researched-astgrep.ts';
import { resolveCtxForRoot } from '../synthesizer/resolve-ctx.ts';
import { stampProvenanceTier, weakestTier } from '../synthesizer/tier.ts';
import type { AstgrepResearchedPractice } from '../synthesizer/research-to-node.ts';

interface Args {
  consumerRoot: string;
  force: boolean;
  strict: boolean;
  fromResearch?: string;
  fromSelection?: string;
  fromPractice?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { consumerRoot: process.cwd(), force: true, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--consumer-root') args.consumerRoot = argv[++i] ?? args.consumerRoot;
    else if (a === '--no-force') args.force = false;
    else if (a === '--strict') args.strict = true;
    else if (a === '--from-research') args.fromResearch = argv[++i];
    else if (a === '--from-selection') args.fromSelection = argv[++i];
    else if (a === '--from-practice') args.fromPractice = argv[++i];
    else if (a === '-h' || a === '--help') {
      process.stdout.write(
        'Usage: rule-bootstrap-cli [--consumer-root <path>] [--from-research <plan.json>] [--from-selection <sel.json>] [--from-practice <rec.practice.json|dir>] [--no-force] [--strict]\n',
      );
      process.exit(0);
    } else if (!a.startsWith('-')) args.consumerRoot = a;
  }
  return args;
}

// ── --from-practice arm — the researched-python (Model A′) consumer lane — ecosystem-wiring W5 ──
//
// The JS live path above (FileResearchClient/FileGenerateClient → generate.ts → L4 → install) is
// eslint-only: `engine:'ast-grep'` is parked at the L4 gates as error-severity FF3003/FF3010/FF3012
// («ast-grep engine reserved but not wired — deferred per generator-forbid-mvp decision (i)»,
// diagnostics/registry.ts:182), and install() writes `.ai-factory/` which the python lane forbids
// (setup.d/45-python.sh:438 + tests/install-sh/python-entry-lane.test.sh). The SHIPPED researched-
// python generation contract is the Model A′ lane instead: an `AstgrepResearchedPractice` record →
// `researchedPracticeToNode` bridge → `renderAstgrep` (both pure, proven LG-S1 INC-1/2).
//
// This arm is the MINIMAL glue making that lane invokable for a CONSUMER: practice JSON → rendered
// rule YAML at `<consumer>/.getff/rules-research/<entryId>.yml` — a consumer-side researched home
// that SURVIVES `--refresh` (unlike `.getff/astgrep-rules/`, which refresh_safe rm-rf-replaces from
// the template — lib.sh:126). The python delivery seam (`_py_deliver_astgrep`, setup.d/45-python.sh)
// then joins `rules-research/*.yml` into `.getff/astgrep-rules/` on every install/refresh pass, so
// the rendered rule fires via the consumer's existing single `ruleDirs:` entry (§Qd additive).
//
// Render runs SESSION-SIDE (node available in the research/framework session); the consumer INSTALL
// path stays Node-free — Model A′ §Qa preserved at consumer scope. MAJOR-1 honesty is inherited from
// `planResearchedAstgrep` (bridge filters: not-expressible / provenance-rejected / gate-failed —
// research-only findings are logged LOUDLY and never written).

/** Where a consumer's researched (rendered) rules live — the durable, refresh-surviving home. */
export function rulesResearchDirOf(consumerRoot: string): string {
  return join(consumerRoot, '.getff', 'rules-research');
}

/**
 * A practice record's `entryId` failed the filesystem-safety gate. `entryId` is consumer-authored
 * JSON that this CLI turns into a FILENAME (`<rulesResearchDir>/<entryId>.yml`), so an unvalidated
 * id is an arbitrary-file-write / clobber primitive (traversal `../`, absolute paths, path
 * separators). This is a HARD refusal — never the rc=0 "degrade with guidance" contract, which is
 * reserved for honestly-malformed records, not attack-shaped ones.
 */
export class PracticeEntryIdError extends Error {
  constructor(entryId: string, why: string) {
    super(
      `unsafe practice entryId ${JSON.stringify(entryId)}: ${why}. ` +
        `entryId must be a rule-id slug (^[a-z][a-z0-9-]*$, e.g. 'getff-researched-no-yaml-load') ` +
        `— it becomes the rendered rule's filename, so path separators, '..', absolute paths and ` +
        `other non-slug characters are refused.`,
    );
    this.name = 'PracticeEntryIdError';
  }
}

/**
 * The shipped rule-id slug convention: lower-kebab, leading letter. Matches every starter
 * (`getff-no-eval`, `getff-no-os-system`, …) and the researched sub-namespace
 * (`getff-researched-no-yaml-load`). Deliberately excludes `.` `/` `\` whitespace and any absolute
 * or `..` form — the exact characters a traversal/clobber id needs.
 */
const RULE_ID_SLUG = /^[a-z][a-z0-9-]*$/;

/**
 * Validate a consumer-authored entryId BEFORE it is used to build any filesystem path, and assert
 * the RESOLVED output path stays inside the rules-research dir (belt-and-braces containment mirroring
 * the ecosystem-cargo/-python `resolvedWithinRoot` posture). Throws {@link PracticeEntryIdError} on
 * any unsafe id; returns the safe absolute output path on success.
 */
export function safeRenderedPath(rulesResearchDir: string, entryId: string): string {
  if (typeof entryId !== 'string' || entryId.length === 0) {
    throw new PracticeEntryIdError(String(entryId), 'empty or non-string');
  }
  if (!RULE_ID_SLUG.test(entryId)) {
    throw new PracticeEntryIdError(entryId, 'not a rule-id slug (^[a-z][a-z0-9-]*$)');
  }
  // Belt-and-braces: even a slug-passing id must resolve strictly inside the rules-research dir.
  const outPath = resolve(rulesResearchDir, `${entryId}.yml`);
  const base = rulesResearchDir.endsWith(sep) ? rulesResearchDir : rulesResearchDir + sep;
  const rel = relative(rulesResearchDir, outPath);
  if (!outPath.startsWith(base) || rel.startsWith('..') || rel.includes(sep)) {
    throw new PracticeEntryIdError(entryId, `resolved path escapes ${rulesResearchDir}`);
  }
  return outPath;
}

export interface PracticeRenderOptions {
  consumerRoot: string;
  /** A single `*.practice.json` record, or a directory of them (the `.getff/rules-research` home). */
  fromPractice: string;
  log?: (msg: string) => void;
}

export interface PracticeRenderResult {
  mode: 'practice-render';
  rendered: { entryId: string; path: string }[];
  researchOnly: ResearchOnlyFinding[];
}

/** Load one record, or every `*.practice.json` in a directory (sorted — deterministic order). */
function loadPracticeRecords(src: string): AstgrepResearchedPractice[] {
  if (!existsSync(src)) {
    throw new Error(`practice input not found: ${src}`);
  }
  if (statSync(src).isDirectory()) {
    const files = readdirSync(src)
      .filter((f) => f.endsWith('.practice.json'))
      .sort();
    if (files.length === 0) {
      throw new Error(`no *.practice.json practice records in directory: ${src}`);
    }
    return files.map(
      (f) => JSON.parse(readFileSync(join(src, f), 'utf8')) as AstgrepResearchedPractice,
    );
  }
  return [JSON.parse(readFileSync(src, 'utf8')) as AstgrepResearchedPractice];
}

/**
 * Render researched practice record(s) onto a consumer: each expressible practice becomes
 * `<consumer>/.getff/rules-research/<entryId>.yml` (byte-identical to the pure
 * bridge+renderAstgrep plan — the SAME pipeline the framework's drift gate locks). Practices the
 * bridge degrades are surfaced as research-only findings (logged loudly, NEVER written). The output
 * dir is created only when something renders — a fully-degraded run leaves the consumer untouched.
 *
 * S1 getff-any-stack-trace (spec §4 W1-1): threads `resolveCtxForRoot(consumerRoot)` so a practice
 * whose provenance host is a direct dependency's `homepage`/`documentation`/`repository` metadata
 * is admitted at Tier-1 — the same SSOT two-arg validator the bridge runs. Without ctx, the
 * bridge degrades to the Tier-0-only back-compat path (resolver materialises an empty ctx) —
 * preserving every pre-S1 caller that has no consumer manifest in scope.
 */
export function runPracticeRender(opts: PracticeRenderOptions): PracticeRenderResult {
  const log = opts.log ?? ((m: string) => process.stderr.write(m + '\n'));
  const records = loadPracticeRecords(opts.fromPractice);
  const ctx = resolveCtxForRoot(opts.consumerRoot);
  const plan = planResearchedAstgrep(records, ctx);

  for (const finding of plan.researchOnly) {
    // The degrade is LOUD, never silent (mirrors withManualDrop).
    log(
      `[rule-bootstrap] practice '${finding.entryId}' researched but not rendered ` +
        `(${finding.reason}): ${finding.detail} — recorded as research-only, NOT shipped as a rule.`,
    );
  }

  const outDir = rulesResearchDirOf(opts.consumerRoot);
  // Validate EVERY entryId (attack-shaped input → arbitrary file write / clobber) BEFORE touching the
  // filesystem — one bad id refuses the whole run with nothing written, no output dir created.
  const targets = plan.rendered.map((rule) => ({
    rule,
    outPath: safeRenderedPath(outDir, rule.entryId),
  }));
  const rendered: { entryId: string; path: string }[] = [];
  for (const { rule, outPath } of targets) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, rule.yaml);
    rendered.push({ entryId: rule.entryId, path: outPath });
  }

  // S1b (unparks PARK-S1-7): emit a per-rule generation-context fragment for the python lane.
  // The fragment is the substrate for getff staleness (spec §7 item 1 — «the substrate for what
  // went stale»): the python lock reader `_py_json_rules` (setup.d/45-python.sh:528) cat's it
  // verbatim into the lock's `rules[]`. Without this producer the reader falls through to the
  // literal `{"id":...,"provenance":[],"tier":2}` at 45-python.sh:531 — provenance records the
  // research moment (url/allowlistKey/fetchedAt), so its absence is exactly the empty-substrate
  // defect S1 shipped and S2 (targeted staleness) cannot consume.
  //
  // Path layout (DC-1, kickoff §6 Tier-2 call): `<consumerRoot>/.ai-factory/synthesizer-output/
  // generation-context/python/<entryId>.json` — the per-lane subdir closes criterion 4 by
  // construction. Cargo/go glob `*.json` NON-recursively on the parent generation-context/ dir
  // (46-cargo.sh:262, 47-go.sh:229), so a python lane fragment in the subdir is invisible to
  // them. The Node synthesize path (emit.ts:97-103) keeps writing `G${n}.json` to the parent
  // dir unchanged — criterion 7 unregressed by leaving it alone.
  //
  // DC-3 join: `record.entryId === rule.entryId`. research-to-node.ts:193 sets the node id from
  // `practice.entryId` by construction, and render-researched-astgrep.ts:139 sets the rendered
  // entryId from the node id — so the two equal by construction. No translation layer.
  //
  // DC-4 tier honesty: reuse `stampProvenanceTier` + `weakestTier` from synthesizer/tier.ts
  // (the same canonical derivation as synthesize.ts:96-100). This is a DERIVED verdict, NOT the
  // DEFAULT_TIER=2 accidental fallback — the exact distinction kickoff §3 criterion 3 warns
  // against. For the LG-S1 fixture (provenance host pyyaml.org, builtin allowlist key 'pyyaml'),
  // stampProvenanceTier yields tier:0 per source; weakestTier collapses to 0. An empty-
  // provenance record (not the case here) would honestly yield DEFAULT_TIER=2 via weakestTier's
  // empty-array arm — still derived, never literal-printed.
  const fragDir = resolve(
    opts.consumerRoot,
    '.ai-factory',
    'synthesizer-output',
    'generation-context',
    'python',
  );
  for (const rule of plan.rendered) {
    // Defensive PF-1 park trigger (kickoff §6): the join is 1:1 BY CONSTRUCTION
    // (planResearchedAstgrep iterates `records` → `plan.rendered`, with a loud dup-guard at
    // render-researched-astgrep.ts:149 catching duplicate entryIds at plan time). If this
    // throws, the §1 join assumption broke — surface LOUD, do NOT write a wrong fragment.
    const matches = records.filter((r) => r.entryId === rule.entryId);
    if (matches.length !== 1) {
      throw new Error(
        `[rule-bootstrap] S1b PF-1 park trigger fired for '${rule.entryId}': ` +
          `expected exactly 1 record, found ${matches.length}. The §1 join ` +
          `(record.entryId === rendered.entryId) broke — see kickoff §6 PF-1.`,
      );
    }
    const record = matches[0];
    const stampedProv = stampProvenanceTier(record.provenance);
    const ruleTier = weakestTier(stampedProv);
    const fragment = { id: rule.entryId, provenance: stampedProv, tier: ruleTier };
    mkdirSync(fragDir, { recursive: true });
    writeFileSync(resolve(fragDir, `${rule.entryId}.json`), JSON.stringify(fragment) + '\n');
    log(
      `[rule-bootstrap] wrote generation-context/python/${rule.entryId}.json ` +
        `(tier=${ruleTier}, ${stampedProv.length} provenance source(s))`,
    );
  }

  return { mode: 'practice-render', rendered, researchOnly: plan.researchOnly };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // The practice arm is a DIFFERENT lane (Model A′ ast-grep render, no generate.ts/L4/install run);
  // combining it with the JS live pair is an authoring error — refuse before touching anything.
  if (args.fromPractice && (args.fromResearch || args.fromSelection)) {
    process.stderr.write(
      'rule-bootstrap-cli: --from-practice cannot be combined with --from-research/--from-selection\n',
    );
    process.exit(args.strict ? 1 : 0);
  }

  // Live path requires BOTH files; one-only is an authoring error.
  const oneOnly = Boolean(args.fromResearch) !== Boolean(args.fromSelection);
  if (oneOnly) {
    process.stderr.write(
      'rule-bootstrap-cli: --from-research and --from-selection must be passed together\n',
    );
    process.exit(args.strict ? 1 : 0);
  }

  if (args.fromPractice) {
    try {
      const result = runPracticeRender({
        consumerRoot: args.consumerRoot,
        fromPractice: args.fromPractice,
      });
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      if (args.strict && result.rendered.length === 0) process.exit(1);
      return;
    } catch (err) {
      // A filesystem-unsafe entryId is an ATTACK-shaped input, not an honest malformed record — it
      // is refused with a HARD non-zero exit, NOT the rc=0 degrade contract below (a traversal id
      // must never be swallowed as "just a bad record" that the install continues past).
      if (err instanceof PracticeEntryIdError) {
        process.stderr.write(`[rule-bootstrap] REFUSED — ${err.message}\n`);
        process.exit(1);
      }
      // Decision B parity: a malformed/unreadable practice record degrades with guidance,
      // never a bad rule.
      process.stderr.write(
        `[rule-bootstrap] practice record invalid or unreadable — ${(err as Error).message}\n` +
          `[rule-bootstrap] a valid input is an AstgrepResearchedPractice JSON record (schema: ` +
          `packages/core/synthesizer/research-to-node.ts; committed example: packages/core/synthesizer/` +
          `fixtures/live-generation/getff-researched-no-yaml-load.practice.json) — fix or re-author it, ` +
          `then re-run --from-practice.\n`,
      );
      process.exit(args.strict ? 1 : 0); // rc=0: never abort install
    }
  }

  const live = Boolean(args.fromResearch && args.fromSelection);
  const clients = live
    ? {
        researchClient: new FileResearchClient(args.fromResearch as string),
        generateClient: withManualDrop(new FileGenerateClient(args.fromSelection as string)),
      }
    : {};

  // Loaded lazily (see the import note near the top): only the synthesis/live arm needs the L4/L5
  // validator, which statically requires the sibling `@rules-as-tests/preset-next-15-canonical`
  // package. The `--from-practice` arm returned above, so it never reaches this import — that arm
  // stays runnable in a core-only layout with no sibling workspace packages resolvable.
  const { runRuleBootstrap } = await import('../synthesizer/rule-bootstrap.ts');

  try {
    const result = await runRuleBootstrap({
      consumerRoot: args.consumerRoot,
      force: args.force,
      ...clients,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (args.strict) {
      const ok = result.mode === 'synthesis' && result.install.ok;
      if (!ok) process.exit(1);
    }
  } catch (err) {
    // Decision B: a malformed/unreadable live artefact degrades with guidance, never a bad rule.
    const why = err instanceof ResearchPlanError ? err.message : (err as Error).message;
    process.stderr.write(
      `[rule-bootstrap] live research artefact invalid or unreadable — ${why}\n` +
        `[rule-bootstrap] run the rule-research protocol (agents/rule-researcher.md or the ` +
        `rule-research skill) to (re)author the two files, then re-run ./setup --full.\n`,
    );
    process.exit(args.strict ? 1 : 0); // rc=0: never abort install (the bash gate also || true's)
  }
}

/**
 * True when this module is the process entry point (executed directly, not imported).
 *
 * Realpath-normalizes BOTH sides before comparing. `argv1` is the path as-passed to the
 * runtime (logical — `install.sh` derives PKG_ROOT via `pwd`, which preserves symlinks),
 * while `metaUrl` is the path as tsx/node resolve it (realpath). A single symlink component
 * anywhere in the framework checkout path — macOS `/tmp`→`/private/tmp`, `mktemp` under
 * `/var/folders`, a symlinked `$HOME` or CI checkout dir — desyncs the two strings, so a
 * literal `import.meta.url === \`file://${argv1}\`` compare silently returns false and
 * `main()` never runs: `--full` exits 0 with zero synthesized rules. Normalizing both to
 * their realpaths closes that gap regardless of the caller's path (issue #910). Falls back
 * to a decoded literal compare if realpath fails (e.g. the entry no longer exists on disk).
 */
export function isDirectRun(argv1: string | undefined, metaUrl: string): boolean {
  if (!argv1) return false;
  const metaPath = fileURLToPath(metaUrl);
  try {
    return realpathSync(argv1) === realpathSync(metaPath);
  } catch {
    return metaPath === argv1;
  }
}

// Run only when executed directly (not when imported by a test).
if (isDirectRun(process.argv[1], import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`rule-bootstrap-cli failed: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
