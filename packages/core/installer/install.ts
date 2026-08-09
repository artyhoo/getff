// Layer 5 Installer — pre-validate, write artifacts, emit rules-lock.json,
// then re-validate (architecture.md §2.7 item 5). Returns a structured
// InstallReport with explicit failures per stage; never throws on
// validation outcomes — caller decides via report.ok.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emit } from '../synthesizer/emit.ts';
import type { SynthesisPlan } from '../synthesizer/types.ts';
import { validate } from '../validator/validate.ts';
import { weakestTier } from '../synthesizer/tier.ts';
import type {
  InstallFailure,
  InstallOptions,
  InstallReport,
  RulesLock,
  RulesLockRule,
} from './types.ts';

const OUTPUT_SUBPATH = ['.ai-factory', 'synthesizer-output'] as const;
const SHARED_ARTIFACTS = [
  'rules-manifest-additions.json',
  'RULES-additions.md',
  'eslint-rules-snippet.json',
] as const;

function outputDirOf(consumerRoot: string): string {
  return resolve(consumerRoot, ...OUTPUT_SUBPATH);
}

/**
 * Stack-scoped lock filename (GH #915 obs 2). A multi-stack consumer runs the
 * bootstrap once per stack against the SAME consumerRoot; a single
 * `rules-lock.json` recorded only the last-synthesized stack (react-native
 * overwrote the ts-server G1–G5 record). Scoping the lock by plan.framework —
 * `rules-lock.<framework>.json`, the same per-stack suffix convention as
 * `.ai-factory/RULES.<stack>.md` — makes the machine record cumulative across
 * stacks while keeping each lock's rules drift-check (postInstallChecks)
 * exact against ITS OWN plan. framework:null keeps the legacy unsuffixed name.
 */
function lockNameOf(plan: SynthesisPlan): string {
  return plan.framework === null
    ? 'rules-lock.json'
    : `rules-lock.${plan.framework}.json`;
}

function artifactsOf(plan: SynthesisPlan): string[] {
  return [...SHARED_ARTIFACTS, lockNameOf(plan)];
}

function fingerprint(plan: SynthesisPlan): string {
  // Stable over re-synth of the same recipes against the same research:
  // synthesize() emits keys in deterministic order. For external callers
  // who hand-build a SynthesisPlan, JSON.stringify reflects their key order;
  // that's their authoring choice, not a fingerprint instability.
  return createHash('sha256')
    .update(JSON.stringify(plan))
    .digest('hex')
    .slice(0, 16);
}

/** Error thrown when a rules-lock JSON carries an unsupported schemaVersion (criterion 8).
 *  Silent partial reads of a v1 lock are forbidden — an old lock has no per-rule data to migrate. */
export class RulesLockSchemaError extends Error {
  constructor(public readonly path: string, public readonly found: number) {
    super(
      `${path}: rules-lock schema version ${found} is no longer supported; regenerate the lock (delete it and re-run the install to emit a v2 lock)`,
    );
    this.name = 'RulesLockSchemaError';
  }
}

/** Read + parse a rules-lock JSON file, refusing non-v2 locks loudly (criterion 8).
 *  Any shipped reader written for v2 branches on schemaVersion from day one. */
export function readRulesLock(path: string): RulesLock {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { schemaVersion?: number } & Partial<RulesLock>;
  if (raw.schemaVersion !== 2) {
    throw new RulesLockSchemaError(path, raw.schemaVersion ?? 0);
  }
  return raw as RulesLock;
}

function buildLock(plan: SynthesisPlan, emittedAt: string): RulesLock {
  const rules: RulesLockRule[] = plan.rules
    .map((r) => ({
      id: r.id,
      provenance: r.research.provenance,
      tier: weakestTier(r.research.provenance, r.research.tier),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    schemaVersion: 2,
    framework: plan.framework,
    version: plan.version,
    rules,
    emittedAt,
    sourceFingerprint: fingerprint(plan),
  };
}

function postInstallChecks(
  plan: SynthesisPlan,
  outputDir: string,
): { ok: boolean; failures: InstallReport['failures'] } {
  const failures: InstallReport['failures'] = [];
  for (const name of artifactsOf(plan)) {
    const path = resolve(outputDir, name);
    if (!existsSync(path)) {
      failures.push({
        stage: 'post-validate',
        reason: `expected artifact missing on disk: ${name}`,
      });
    }
  }
  // Lock content must round-trip: rules (v2) must match the plan's rule ids.
  try {
    const lockPath = resolve(outputDir, lockNameOf(plan));
    if (existsSync(lockPath)) {
      const lock = readRulesLock(lockPath);
      const expected = plan.rules.map((r) => r.id).sort();
      const actual = lock.rules.map((r) => r.id).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failures.push({
          stage: 'post-validate',
          reason: `${lockNameOf(plan)} rules drift: lock=${JSON.stringify(actual)} plan=${JSON.stringify(expected)}`,
        });
      }
    }
  } catch (err) {
    // Preserve the schema-refusal message verbatim (criterion 8) — do not collapse
    // RulesLockSchemaError into a generic "failed to parse" framing, which hides
    // the deliberate refusal nature of the throw and weakens the loud guarantee.
    failures.push({
      stage: 'post-validate',
      reason: err instanceof RulesLockSchemaError
        ? (err as RulesLockSchemaError).message
        : `${lockNameOf(plan)} failed to parse: ${(err as Error).message}`,
    });
  }
  return { ok: failures.length === 0, failures };
}

export function install(plan: SynthesisPlan, opts: InstallOptions): InstallReport {
  const outputDir = outputDirOf(opts.consumerRoot);
  const expectedArtifacts = artifactsOf(plan).map((n) => resolve(outputDir, n));

  const preValidation = validate(plan);
  if (!preValidation.ok) {
    return {
      ok: false,
      installed: false,
      artifacts: expectedArtifacts,
      preValidation,
      failures: [
        {
          stage: 'pre-validate',
          reason: `L4 validation failed before install — ${JSON.stringify(preValidation.gates)}`,
        },
      ],
    };
  }

  const lockPath = resolve(outputDir, lockNameOf(plan));
  if (!opts.dryRun && !opts.force && existsSync(lockPath)) {
    // Criterion 8 loud-refusal surface: a v1 lock on disk is REFUSED here (before
    // postInstallChecks ever runs) with the regenerate remediation — never the
    // "pass force: true to overwrite" message, which suggests silent overwrite and
    // hides the schema reason. readRulesLock throws RulesLockSchemaError on non-v2;
    // any other parse error (corrupt/empty file) falls through to lock-collision.
    let schemaStaleFound: number | null = null;
    try {
      readRulesLock(lockPath);
    } catch (err) {
      if (err instanceof RulesLockSchemaError) schemaStaleFound = err.found;
    }
    const failure: InstallFailure = schemaStaleFound !== null
      ? {
          stage: 'schema-stale',
          reason: `${lockNameOf(plan)} at ${lockPath} is schemaVersion ${schemaStaleFound} (this installer is v2-aware); regenerate the lock (delete it and re-run the install, or pass force: true, to emit a v2 lock)`,
        }
      : {
          stage: 'lock-collision',
          reason: `${lockNameOf(plan)} already exists at ${lockPath}; pass force: true to overwrite`,
        };
    return {
      ok: false,
      installed: false,
      artifacts: expectedArtifacts,
      preValidation,
      failures: [failure],
    };
  }

  if (opts.dryRun) {
    return {
      ok: true,
      installed: false,
      artifacts: expectedArtifacts,
      preValidation,
      failures: [],
    };
  }

  try {
    mkdirSync(outputDir, { recursive: true });
    emit(plan, outputDir);
    const lock = buildLock(plan, new Date().toISOString());
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  } catch (err) {
    return {
      ok: false,
      installed: false,
      artifacts: expectedArtifacts,
      preValidation,
      failures: [{ stage: 'emit', reason: (err as Error).message }],
    };
  }

  const postChecks = postInstallChecks(plan, outputDir);
  const postValidation = validate(plan);

  return {
    ok: postChecks.ok && postValidation.ok,
    installed: true,
    artifacts: expectedArtifacts,
    preValidation,
    postValidation,
    failures: postChecks.failures,
  };
}
