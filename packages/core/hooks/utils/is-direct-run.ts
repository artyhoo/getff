/**
 * is-direct-run.ts — the ONE "am I the entry point?" check for packages/core CLIs.
 *
 * Lifted out of `install/rule-bootstrap-cli.ts` (issue #910) so every packages/core CLI shares
 * it instead of carrying its own naive `import.meta.url === pathToFileURL(argv[1]).href` compare
 * (SSOT docs/meta-factory/prior-art-evaluations.md #269; dual-implementation-discipline.md §8).
 * Its scripts/*.mjs twin is `scripts/lib/is-main-entry.mjs` — packages/core has its own lock and
 * does not import from scripts/. Principle 47 rejects the naive form in new files.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
