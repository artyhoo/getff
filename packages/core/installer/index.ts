// Layer 5 Installer (Phase 7) — public API.
// Side-effecting on consumer disk; pre-validates via L4, writes 4 artifacts
// + rules-lock.json under <consumerRoot>/.ai-factory/synthesizer-output/,
// then re-validates as final meta-check. v1 intentionally NOT responsible
// for npm deps install, husky setup, GitHub Actions workflow generation —
// install.sh handles those at the framework boundary.

export { install, readRulesLock, RulesLockSchemaError } from './install.ts';
export type {
  InstallFailure,
  InstallOptions,
  InstallReport,
  InstallStage,
  RulesLock,
  RulesLockRule,
} from './types.ts';
