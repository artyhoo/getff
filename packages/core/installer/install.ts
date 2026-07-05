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
import type {
  InstallOptions,
  InstallReport,
  RulesLock,
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
 * stacks while keeping each lock's ruleIds drift-check (postInstallChecks)
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

function buildLock(plan: SynthesisPlan, emittedAt: string): RulesLock {
  return {
    schemaVersion: 1,
    framework: plan.framework,
    version: plan.version,
    ruleIds: plan.rules.map((r) => r.id),
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
  // Lock content must round-trip and ruleIds must match the plan.
  try {
    const lockPath = resolve(outputDir, lockNameOf(plan));
    if (existsSync(lockPath)) {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as RulesLock;
      const expected = plan.rules.map((r) => r.id);
      if (JSON.stringify(lock.ruleIds) !== JSON.stringify(expected)) {
        failures.push({
          stage: 'post-validate',
          reason: `rules-lock.json ruleIds drift: lock=${JSON.stringify(lock.ruleIds)} plan=${JSON.stringify(expected)}`,
        });
      }
    }
  } catch (err) {
    failures.push({
      stage: 'post-validate',
      reason: `rules-lock.json failed to parse: ${(err as Error).message}`,
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
    return {
      ok: false,
      installed: false,
      artifacts: expectedArtifacts,
      preValidation,
      failures: [
        {
          stage: 'lock-collision',
          reason: `${lockNameOf(plan)} already exists at ${lockPath}; pass force: true to overwrite`,
        },
      ],
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
