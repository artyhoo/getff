// symlink-or-junction-or-skip.ts — Windows-portable shared test helper for symlink
// fixtures (#1799: fs.symlinkSync needs privileges on Windows, so the hooks suite died
// at fixture setup). On POSIX this is a pass-through to fs.symlinkSync with the caller's
// exact arguments (type defaults preserved — behaviour byte-for-byte identical, the
// CC-compatibility invariant). On win32: a DIRECTORY target (existing, or declared
// `posixType: 'dir'` — junctions may dangle and need absolute targets) is expressed as a
// junction, which needs no privilege and reports lstatSync().isSymbolicLink() === true
// (in-repo precedent: packages/core/install/wire-eslint-r2.test.ts:316); a fixture a
// junction cannot express (file target, dangling relative link) SKIPS the enclosing test
// with a named reason — a visible named skip, never a silent pass and never a fabricated
// wrong-shaped fixture. Junction-vs-skip decisions log to stderr behind
// DEBUG_WIN_SYMLINK=1 (hook debug output never touches stdout).
import { existsSync, statSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Minimal structural slice of the vitest test/hook context this helper needs. */
export interface Skippable {
  skip(note?: string): void;
}

/** Context for module-scope call sites (no vitest ctx exists at import time). Their
 *  dir-target fixtures always take the junction arm on win32, so skip is never reached;
 *  if that invariant ever breaks, fail LOUD — never a silent wrong-shaped fixture. */
export function failLoudSkipContext(what: string): Skippable {
  return {
    skip: (note?: string) => {
      throw new Error(
        `symlinkOrJunctionOrSkip: ${what} cannot skip (no vitest ctx at module scope): ${note}`,
      );
    },
  };
}

export function symlinkOrJunctionOrSkip(
  ctx: Skippable,
  target: string,
  linkPath: string,
  posixType?: 'dir' | 'file' | 'junction',
): void {
  if (process.platform !== 'win32') {
    symlinkSync(target, linkPath, posixType);
    return;
  }
  // A relative symlink target resolves against the LINK's directory, never cwd.
  const absTarget = resolve(dirname(linkPath), target);
  const dirShaped =
    posixType === 'dir' ||
    (existsSync(absTarget) && statSync(absTarget).isDirectory());
  if (dirShaped) {
    if (process.env.DEBUG_WIN_SYMLINK === '1')
      console.error(`[symlink-or-junction-or-skip] junction ${linkPath} -> ${absTarget}`);
    symlinkSync(absTarget, linkPath, 'junction');
    return;
  }
  const note = `skipped on win32: symlink fixture ${target} -> ${linkPath} is junction-inexpressible (file/dangling target) — #1799`;
  if (process.env.DEBUG_WIN_SYMLINK === '1')
    console.error(`[symlink-or-junction-or-skip] ${note}`);
  ctx.skip(note);
}
