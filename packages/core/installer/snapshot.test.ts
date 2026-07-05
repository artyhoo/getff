// L5 self-application snapshot — frozen InstallReport shape for own repo
// install onto a tmp consumer. Strips non-deterministic fields:
//   - artifact paths (depend on tmpdir),
//   - rules-lock.json emittedAt + sourceFingerprint (timestamp + hash).
// What remains is the deterministic shape: ok, installed, artifact names,
// lockShape (schemaVersion + framework + version + ruleIds), and the two
// embedded ValidationReports.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectStack } from '../detector/index.ts';
import { research } from '../research/index.ts';
import { synthesize } from '../synthesizer/synthesize.ts';
import { install } from './install.ts';
import type { InstallReport, RulesLock } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const SELF_EXPECTED = resolve(HERE, 'expected-self-install.json');

interface InstallSnapshot {
  ok: boolean;
  installed: boolean;
  failuresCount: number;
  artifactNames: string[];
  lockShape: {
    schemaVersion: number;
    framework: string | null;
    version: string | null;
    ruleIds: string[];
  };
  preValidation: InstallReport['preValidation'];
  postValidation: InstallReport['postValidation'];
}

function deterministicShape(
  report: InstallReport,
  consumerRoot: string,
): InstallSnapshot {
  // Lock filename is stack-scoped since GH #915 obs 2 (rules-lock.<framework>.json;
  // legacy rules-lock.json only when framework is null) — derive it from the report's
  // artifact list instead of hardcoding the legacy name, so this harness stays correct
  // for framework plans too (self-install here is framework:null, but don't rely on it).
  const lockName =
    report.artifacts
      .map((p) => basename(p))
      .find((n) => /^rules-lock(\..+)?\.json$/.test(n)) ?? 'rules-lock.json';
  const lockPath = resolve(
    consumerRoot,
    '.ai-factory',
    'synthesizer-output',
    lockName,
  );
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as RulesLock;
  return {
    ok: report.ok,
    installed: report.installed,
    failuresCount: report.failures.length,
    artifactNames: report.artifacts.map((p) => basename(p)),
    lockShape: {
      schemaVersion: lock.schemaVersion,
      framework: lock.framework,
      version: lock.version,
      ruleIds: lock.ruleIds,
    },
    preValidation: report.preValidation,
    postValidation: report.postValidation,
  };
}

describe('installer self-application snapshot', () => {
  let consumerRoot: string;

  beforeEach(() => {
    consumerRoot = mkdtempSync(resolve(tmpdir(), 'install-snapshot-'));
  });

  afterEach(() => {
    rmSync(consumerRoot, { recursive: true, force: true });
  });

  it('own repo install on tmp consumer matches expected-self-install.json', () => {
    const synthPlan = synthesize(research(detectStack(REPO_ROOT)));
    const report = install(synthPlan, { consumerRoot });
    const snapshot = deterministicShape(report, consumerRoot);
    const expected = JSON.parse(readFileSync(SELF_EXPECTED, 'utf8'));
    expect(snapshot).toEqual(expected);
  });
});
