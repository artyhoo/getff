#!/usr/bin/env node
/**
 * render-rule-channels — CTX Stage 3, "channel-as-data" lite (design §4 Тезис B).
 *
 * WHY: CTX Stage 2 (principle 31) gates that every `.claude/rules/*.md` DECLARES a
 * delivery channel (paths:/globs:/channel:/ALWAYS_ON_CORE). It does NOT compute what
 * that declaration actually MEANS on a harness other than CC — e.g. `paths:`
 * frontmatter is a CC-native read-time primitive; zcode has no such primitive
 * (P1 fact, .ai-factory/rule-channel-capabilities.json). Stage 3 makes that
 * per-(rule × harness) reality DATA: for every Tier-0 core rule and every
 * `paths:`-declaring rule, and for every harness marked `"support":"supported"` in
 * the capability matrix, compute one of:
 *   - native    — the harness has the primitive the rule's declared channel needs
 *   - degraded  — the harness lacks the primitive but an alternate delivery path
 *                 exists (must be DECLARED in the tracked degradation manifest below)
 *   - refused   — no delivery path exists at all
 *
 * The honest-degraded invariant (Тезис B): a `refused` verdict that is NOT already
 * declared in `.ai-factory/rule-channel-degradations.json` is a GATE FAILURE (exit 1),
 * not a silent drop. This is the "attention is not a mechanism" property applied to
 * cross-harness delivery — a refusal must be loud (`--check` exit 1) or explicitly
 * accepted in a tracked, reviewed file; it may never be merely implied by the matrix.
 *
 * SCOPE: injection-plane only (rule-channel declarations), mirrors
 * scripts/render-rule-index.mjs's SOURCE OF TRUTH discipline — this script does NOT
 * invent facts, it derives verdicts from (a) each rule's own declared channel fields
 * (paths:/globs:/channel:/ALWAYS_ON_CORE, via the SAME shared parser principle 31
 * uses) and (b) the harness capability matrix (data, human-maintained + ajv-validated,
 * NOT probed live — no zcode binary exists on this machine to probe against; see
 * .claude/rules/research-source-trust.md-style tiering precedent for "data + review",
 * not "gate that requires an unavailable live probe").
 *
 * Modes: `--write` (emit the degradation manifest scaffold if absent — does NOT
 * silently invent honesty, only creates the file with an empty `degradations: []`
 * array if missing so `--check` has something to diff against) | `--check` (compute
 * + compare + refuse-on-undeclared-refusal, exit 1 on any mismatch).
 * `--root <dir>` overrides the search root. Zero deps beyond ajv (already a stack
 * dependency, packages/core/diagnostics/ajv.ts factory reused here via a thin
 * same-shape validator — see makeValidator() below).
 *
 * Prior-art: docs/meta-factory/prior-art-evaluations.md#209 (rulesync — ADAPT; their
 * unit is whole-file translation with warnings that nobody is forced to read; ours is
 * a per-(rule×harness) refusal-as-gate-failure, deterministic, zero-dep offline).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// ajv is a `packages/core` dep, NOT root. This script lives in scripts/, so a bare
// `import 'ajv'` resolves from scripts/ up to ROOT node_modules — absent in the CI
// Principles job (`npm ci --prefix packages/core` installs only packages/core deps).
// Route ajv through the packages/core factory instead: its own `import 'ajv'` resolves
// from packages/core/diagnostics/ (walk-up finds packages/core/node_modules/ajv in CI,
// or the hoisted root ajv locally). This also REUSES the shared factory rather than
// re-constructing Ajv inline (build-first-reuse / dual-implementation §8).
import {
  makeSchemaValidator,
  errorsText,
} from '../packages/core/diagnostics/ajv.ts';
import {
  extractHeaderField,
  extractFrontmatterPaths,
  extractGlobsMarker,
  extractChannelMarkers,
} from '../packages/core/principles/rule-channel-glob.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

// Tier-0 "always-on core" — mirrors packages/core/principles/31-rule-channel-declaration.ts
// ALWAYS_ON_CORE verbatim (that file is the gate's own source of truth for this set; this
// script re-declares it rather than importing a .ts principle test module at runtime, since
// principle files are test-only entry points, not intended as a library import surface for a
// standalone CLI script — precedent: render-rule-index.mjs also re-declares its own TIER0_CORE
// rather than importing from principle 31).
const ALWAYS_ON_CORE = new Set([
  'build-first-reuse-default',
  'attention-is-not-a-mechanism',
  'ai-laziness-traps',
]);

function findRoot(start) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, '.ai-factory/rule-channel-capabilities.json'))) return d;
    const up = dirname(d);
    if (up === d) throw new Error('.ai-factory/rule-channel-capabilities.json not found (walked to filesystem root). Pass --root <dir>.');
    d = up;
  }
}

function listRuleFiles(root) {
  const dir = join(root, '.claude/rules');
  let tracked = null;
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files', '--', '.claude/rules'], { encoding: 'utf8' });
    tracked = new Set(out.split('\n').filter(Boolean));
  } catch {
    tracked = null;
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== '00-rule-index.md')
    .filter((f) => !tracked || tracked.has(`.claude/rules/${f}`))
    .sort()
    .map((f) => join(dir, f));
}

/** Parse one rule file's channel-declaration fields — same fields principle 31 gates on. */
function parseRuleFields(path) {
  const source = readFileSync(path, 'utf8');
  const name = path.split('/').pop().replace(/\.md$/, '');
  return {
    name,
    isTier0: ALWAYS_ON_CORE.has(name),
    paths: extractFrontmatterPaths(source),
    globsMarker: extractGlobsMarker(source),
    channelMarkers: extractChannelMarkers(source),
  };
}

/** Rules in scope for the Stage-3 matrix: Tier-0 core rules ∪ paths:-declaring rules. */
function inScopeRules(root) {
  return listRuleFiles(root)
    .map(parseRuleFields)
    .filter((r) => r.isTier0 || (r.paths && r.paths.length > 0));
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Validate `doc` against `schema` via the shared packages/core Ajv factory
 *  ({allErrors:true, strict:false}). makeSchemaValidator creates its own Ajv per call, so a
 *  fixed internal ref id is safe across the matrix + degradations schemas. */
function validateAgainstSchema(doc, schema, label) {
  const validate = makeSchemaValidator(schema, 'rule-channel-doc');
  if (!validate(doc)) {
    throw new Error(`${label}: ${errorsText(validate.errors)}`);
  }
}

/**
 * Compute the delivery verdict for one (rule × harness) pair.
 *
 * PASS predicate mirrors principle 31's branches, reinterpreted per-harness:
 *   Tier-0 rule            -> needs the harness to have SOME always-on-equivalent
 *                              text-injection path: sessionStartHook OR rulesAutoload.
 *   paths:-declaring rule  -> needs the harness's pathScoping primitive (native), OR
 *                              postToolUseInject (edit-time inject, degraded target
 *                              "edit-time-inject" — matches the dual-channel design
 *                              rule-enforcement-channel-selection.md §4 already documents:
 *                              `paths:` (read-time) + inject-matching-rule.sh (edit-time)
 *                              are a `@dual-pair`, so a harness with ONLY the inject-time
 *                              primitive is a legitimate, named degraded path, not a refusal).
 *
 * A harness capability value is "present" if it is `true` OR any non-empty string
 * (a string means "yes, via a differently-shaped mechanism" — schema comment).
 */
function present(v) {
  return v === true || (typeof v === 'string' && v.length > 0);
}

function computeVerdict(rule, harnessName, caps) {
  if (rule.isTier0) {
    if (present(caps.sessionStartHook) || present(caps.rulesAutoload)) {
      return present(caps.rulesAutoload) && caps.rulesAutoload !== 'agents-md'
        ? 'native'
        : present(caps.rulesAutoload) === true
          ? 'native'
          : 'degraded(session-start-hook)';
    }
    return 'refused';
  }
  // paths:-declaring rule
  if (present(caps.pathScoping)) return 'native';
  if (present(caps.postToolUseInject)) return 'degraded(edit-time-inject)';
  if (present(caps.rulesAutoload)) return 'degraded(agents-md-index)';
  return 'refused';
}

function computeMatrix(root) {
  const capsDoc = loadJson(join(root, '.ai-factory/rule-channel-capabilities.json'));
  const capsSchema = loadJson(join(root, '.ai-factory/rule-channel-capabilities.schema.json'));
  validateAgainstSchema(capsDoc, capsSchema, '.ai-factory/rule-channel-capabilities.json');

  const rules = inScopeRules(root);
  const supportedHarnesses = Object.entries(capsDoc.harnesses)
    .filter(([, v]) => v.support === 'supported');

  const rows = [];
  for (const rule of rules) {
    for (const [harnessName, caps] of supportedHarnesses) {
      rows.push({
        rule: rule.name,
        harness: harnessName,
        verdict: computeVerdict(rule, harnessName, caps),
      });
    }
  }
  return rows;
}

function manifestKey(row) {
  return `${row.rule}::${row.harness}`;
}

/** Undeclared refusals: rows with verdict "refused" whose (rule,harness) key is not present
 *  in the tracked degradation manifest's `degradations[]` array with matching `status`. */
function findUndeclaredRefusals(rows, manifestDoc) {
  const declared = new Map(
    (manifestDoc.degradations ?? []).map((d) => [`${d.rule}::${d.harness}`, d]),
  );
  const undeclared = [];
  for (const row of rows) {
    if (row.verdict !== 'refused') continue;
    const decl = declared.get(manifestKey(row));
    if (!decl || decl.status !== 'refused') undeclared.push(row);
  }
  return undeclared;
}

/** Declared-degraded rows whose LIVE computed verdict no longer matches the manifest (either
 *  direction — a stale "refused" record when the live computation now says "native", or a
 *  manifest entry whose recorded `verdict` string no longer matches, e.g. after a capability
 *  matrix edit). Surfaced as drift so the manifest can never silently go stale. */
function findManifestDrift(rows, manifestDoc) {
  const byKey = new Map(rows.map((r) => [manifestKey(r), r]));
  const drift = [];
  for (const d of manifestDoc.degradations ?? []) {
    const key = `${d.rule}::${d.harness}`;
    const live = byKey.get(key);
    if (!live) {
      drift.push(`${key}: manifest entry names a (rule,harness) pair no longer in scope`);
      continue;
    }
    if (d.status === 'refused' && live.verdict !== 'refused') {
      drift.push(`${key}: manifest declares "refused" but live computation is now "${live.verdict}" — remove the stale entry`);
    }
    if (d.status === 'degraded' && !live.verdict.startsWith('degraded')) {
      drift.push(`${key}: manifest declares "degraded" but live computation is now "${live.verdict}"`);
    }
  }
  return drift;
}

const DEFAULT_MANIFEST = { degradations: [] };

function run(argv) {
  const mode = argv.includes('--check')
    ? 'check'
    : argv.includes('--write')
      ? 'write'
      : argv.includes('--json')
        ? 'json'
        : null;
  if (!mode) { console.error('usage: render-rule-channels.mjs (--write | --check | --json) [--root <dir>]'); return 2; }
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag !== -1 ? resolve(argv[rootFlag + 1]) : findRoot(process.cwd());
  const manifestPath = join(root, '.ai-factory/rule-channel-degradations.json');

  // --json: raw computeMatrix() rows as JSON on stdout, no manifest comparison. Consumed by
  // tests/agnosticism/probes/rule-channel-readability.sh (the off-CC readability probe) so it
  // does not have to reimplement computeVerdict()'s logic in bash (#sync-by-copy-paste guard).
  if (mode === 'json') {
    let jsonRows;
    try {
      jsonRows = computeMatrix(root);
    } catch (e) {
      console.error(`✗ ${e.message}`);
      return 1;
    }
    console.log(JSON.stringify(jsonRows));
    return 0;
  }

  let rows;
  try {
    rows = computeMatrix(root);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }

  if (mode === 'write') {
    if (!existsSync(manifestPath)) {
      writeFileSync(manifestPath, `${JSON.stringify(DEFAULT_MANIFEST, null, 2)}\n`);
      console.log('render-rule-channels: wrote scaffold .ai-factory/rule-channel-degradations.json (empty — declare degradations by hand, then re-run --check)');
    } else {
      console.log('render-rule-channels: manifest already exists — --write does not overwrite (edit it by hand; this is reviewed data, not a derived render target)');
    }
    console.log(`render-rule-channels: computed ${rows.length} (rule × harness) verdicts`);
    return 0;
  }

  // --check
  if (!existsSync(manifestPath)) {
    console.error(`✗ ${manifestPath}: missing (run --write to scaffold, then declare any refusals by hand)`);
    return 1;
  }
  let manifestDoc;
  try {
    manifestDoc = loadJson(manifestPath);
  } catch (e) {
    console.error(`✗ ${manifestPath}: invalid JSON (${e.message})`);
    return 1;
  }

  const undeclared = findUndeclaredRefusals(rows, manifestDoc);
  const drift = findManifestDrift(rows, manifestDoc);

  if (undeclared.length || drift.length) {
    if (undeclared.length) {
      console.error('✗ UNDECLARED REFUSALS (rule-channel-degradations.json §honest-degraded):');
      for (const r of undeclared) {
        console.error(`    - ${r.rule} on ${r.harness}: refused, but not declared in .ai-factory/rule-channel-degradations.json`);
      }
    }
    if (drift.length) {
      console.error('✗ MANIFEST DRIFT (declared degradation no longer matches live computation):');
      for (const d of drift) console.error(`    - ${d}`);
    }
    console.error('  Fix: edit .ai-factory/rule-channel-degradations.json to declare/repair the above, or fix the underlying capability gap.');
    return 1;
  }

  console.log(`✓ rule-channel matrix up-to-date: ${rows.length} verdicts computed, 0 undeclared refusals, manifest current`);
  return 0;
}

// Entry-point guard: canonicalize BOTH sides through realpathSync. `import.meta.url` is
// already symlink-resolved by Node, but `process.argv[1]` is NOT — so a bare resolve()-only
// compare (this repo's own render-rule-index.mjs pattern) silently no-ops when the script is
// invoked via a symlinked path (e.g. this repo's own worktrees + this script's test harness,
// which symlinks scripts/ into a sandbox root — verified live: without this fix, --json
// produced ZERO output and exit 0 under a symlinked invocation, a silent false-green).
// Canonicalizing both sides makes the guard fire regardless of symlinks; the try/catch keeps
// import-as-module (argv[1] = the test runner, no match) from throwing on realpathSync.
// Precedent: scripts/render-harness-config.mjs's isMainEntry() (#894), same fix, same reason.
function isMainEntry() {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? '');
  } catch {
    return false;
  }
}
if (isMainEntry()) process.exit(run(process.argv.slice(2)));

export {
  computeMatrix,
  computeVerdict,
  findUndeclaredRefusals,
  findManifestDrift,
  inScopeRules,
  ALWAYS_ON_CORE,
};
