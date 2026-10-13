/**
 * is-main-entry — the ONE "am I the entry point?" check for scripts/*.mjs.
 *
 * WHY (SSOT docs/meta-factory/prior-art-evaluations.md #269): Node resolves `import.meta.url`
 * through symlinks, `process.argv[1]` is the path as typed. Any compare of the two that does not
 * realpath BOTH sides is false whenever the script is reached through a symlinked directory
 * (the PC mirror /home/etot/mirror -> /mnt/wsl/spill/mirror, macOS /tmp -> /private/tmp, a
 * symlinked checkout), so main() never runs and a `--check` exits 0 with no output — a silent
 * pass. Measured 2026-09-29: `render-rule-index.mjs --check` on a drifted index exits 1 by its
 * real path and 0, silently, through `ln -s <repo>/scripts <tmp>/linked`.
 *
 * Fourteen scripts carried their own copy of the naive compare and now import this module
 * (#sync-by-copy-paste counter, dual-implementation-discipline.md §8). Scripts that already had a
 * correct inline realpath-both-sides copy (render-invariants, render-rule-channels,
 * render-harness-config, check-pipefail-early-exit) keep it for now. A test that copies one of
 * these scripts into a fixture must copy this file beside it (check-line-citations.test.sh).
 * Principle 47 (packages/core/principles/47-symlink-safe-entry-point.test.ts) rejects the naive
 * form in any new file. packages/core has its own lock and cannot import this file — its twin
 * is packages/core/install/is-direct-run.ts.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * True when the module whose `import.meta.url` is `metaUrl` is the process entry point.
 * Never throws: a missing argv[1] (REPL, `node -e`) is "not main"; when realpath fails (the
 * entry no longer exists on disk) it falls back to a literal compare — the same error semantic
 * as its twin `isDirectRun`.
 */
export function isMainEntry(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  const metaPath = fileURLToPath(metaUrl);
  try {
    return realpathSync(metaPath) === realpathSync(argv1);
  } catch {
    return metaPath === argv1;
  }
}
