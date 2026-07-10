// Layer 5 Installer (Phase 7) — public types.
// L5 v1 scope: write only validated rules to consumer disk + emit rules-lock.json
// + re-run L4 against installed artifacts (final meta-check per
// architecture.md §2.7 item 5). Out-of-scope v1: npm deps install,
// husky setup, GitHub Actions workflow generation — install.sh handles
// those for the framework's own self-application; L5 v1 layers
// synthesized additions on top.

import type { ValidationReport } from '../validator/types.ts';

export interface InstallOptions {
  /** Consumer project root. Synthesized output is written under <consumerRoot>/.ai-factory/synthesizer-output/. */
  consumerRoot: string;
  /**
   * Overwrite an existing lock. Default false — collision is treated as authoring error.
   * Lock filename is stack-scoped (GH #915 obs 2): rules-lock.<framework>.json for a
   * framework plan, legacy rules-lock.json when framework is null — so multi-stack runs
   * against one consumerRoot keep a cumulative per-stack machine record.
   */
  force?: boolean;
  /** Compute artifacts + run pre-validation but skip disk writes. */
  dryRun?: boolean;
}

export type InstallStage =
  | 'pre-validate'
  | 'lock-collision'
  | 'emit'
  | 'post-validate';

export interface InstallFailure {
  stage: InstallStage;
  reason: string;
}

export interface RulesLock {
  schemaVersion: 1;
  framework: string | null;
  version: string | null;
  ruleIds: string[];
  emittedAt: string;
  sourceFingerprint: string;
}

export interface InstallReport {
  ok: boolean;
  /** True iff disk write occurred (false for dry-run, pre-validate fail, lock collision). */
  installed: boolean;
  /** Artifact paths under .ai-factory/synthesizer-output/ — populated even for dry-run. */
  artifacts: string[];
  preValidation: ValidationReport;
  postValidation?: ValidationReport;
  failures: InstallFailure[];
}
