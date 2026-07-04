/**
 * rule-bootstrap-cli.test.ts — regression guard for issue #910.
 *
 * The install-time entry-point check must fire even when the framework checkout path
 * contains a symlink component (macOS `/tmp`→`/private/tmp`, `mktemp` under `/var/folders`,
 * a symlinked `$HOME` / CI dir). The pre-fix literal `import.meta.url === \`file://${argv1}\``
 * compared a logical `argv[1]` (from `install.sh`'s `pwd`) against a realpath `import.meta.url`
 * (as tsx/node resolve it); a single symlink desynced the strings, `main()` never ran, and
 * `--full` exited 0 with ZERO synthesized rules — silent discipline-theatre.
 *
 * Paired-negative (principle 15): the same symlinked inputs under the OLD naive compare must
 * return false — proving the realpath normalization, not mere presence of the guard, is what
 * flips the entry-point detection.
 */

import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isDirectRun } from './rule-bootstrap-cli.ts';

// The realpath-normalized naive predicate the fix replaced — kept here ONLY as the
// paired-negative oracle, so the symlink scenario can be shown to fail the old logic.
const naiveDirectRun = (argv1: string | undefined, metaUrl: string): boolean =>
  metaUrl === `file://${argv1}`;

describe('isDirectRun — entry-point guard (#910)', () => {
  let root: string;
  let realDir: string;
  let symDir: string;
  let realFile: string;
  let symFile: string;
  let metaUrl: string;

  beforeEach(() => {
    // mkdtemp on macOS already sits under a symlinked /var/folders, but we add our OWN
    // explicit symlink so the divergence is deterministic on Linux CI too.
    root = mkdtempSync(join(tmpdir(), 'rb-cli-910-'));
    realDir = join(root, 'real');
    mkdirSync(realDir);
    realFile = join(realDir, 'rule-bootstrap-cli.ts');
    writeFileSync(realFile, '// entry\n');

    symDir = join(root, 'linked');
    symlinkSync(realDir, symDir); // linked/ -> real/
    symFile = join(symDir, 'rule-bootstrap-cli.ts'); // logical path with a symlink component

    // import.meta.url resolves to the realpath (how tsx/node hand it to the module).
    metaUrl = pathToFileURL(realFile).href;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns true when argv[1] reaches the entry via a symlinked path (the #910 repro)', () => {
    expect(symFile).not.toBe(realFile); // the two strings genuinely differ
    expect(isDirectRun(symFile, metaUrl)).toBe(true);
  });

  it('PAIRED-NEGATIVE: the old naive compare returns false on the same inputs', () => {
    // Proves the bug was real and that realpath normalization is the load-bearing change.
    expect(naiveDirectRun(symFile, metaUrl)).toBe(false);
  });

  it('returns true for a plain non-symlinked direct run', () => {
    expect(isDirectRun(realFile, metaUrl)).toBe(true);
  });

  it('returns false when argv[1] is a different file (imported, not executed directly)', () => {
    const otherFile = join(realDir, 'some-test-runner.ts');
    writeFileSync(otherFile, '// other\n');
    expect(isDirectRun(otherFile, metaUrl)).toBe(false);
  });

  it('returns false when argv[1] is undefined', () => {
    expect(isDirectRun(undefined, metaUrl)).toBe(false);
  });

  it('falls back to a decoded literal compare when argv[1] does not exist on disk', () => {
    const ghost = join(realDir, 'does-not-exist' + sep + 'x.ts');
    // realpathSync throws on the missing path → literal fallback; a non-matching ghost is false.
    expect(isDirectRun(ghost, metaUrl)).toBe(false);
    // and a literal match on the decoded realpath is true.
    expect(isDirectRun(realFile, metaUrl)).toBe(true);
  });
});
