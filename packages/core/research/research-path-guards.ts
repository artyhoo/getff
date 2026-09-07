// Shared path-containment guards for the EcosystemAdapter implementations —
// R-1 (ledger-1597-fixes). ONE definition per guard (extracted from
// ecosystem-cargo.ts, the canonical carrier of the realpath-both-sides VALUE
// gate) so a hardening fix reaches every adapter at once instead of dying in
// one adapter's private copy (research-source-trust.md §5 item 2).
//
// Modes for isUnsafeDepName (binding — ledger plan Decision 4):
//   - DEFAULT ('strictest') = the cargo/python contract: reject `..`, '/',
//     '\' and the platform separator. A dep NAME is never joined into a
//     filesystem path while it carries any of these.
//   - 'go-feed-raw' = go's FROZEN feed-raw contract (adapter-jig F3 /
//     T-AJ3-A): reject `..` and '\' only. A go module path legitimately
//     contains '/' (`github.com/user/repo` IS the identity); host-shape
//     rejection is tier1For's job, never the adapter's. Byte-equivalent to
//     go's former private guard.
// npm deliberately KEEPS its local scoped-aware guard (a different manifest
// shape with its own @scope/name segment contract — not a clone).
// Pure guards, silent by design (no logging — contract surfaces stay quiet).

import { existsSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

/** Which separator shapes a dependency name may not carry. */
export type UnsafeDepNameMode = 'strictest' | 'go-feed-raw';

/** Rejects a dependency name containing path-traversal or separator segments
 *  before it is ever joined into a filesystem path (research-source-trust.md
 *  §5 item D). Fail-closed: returns true (reject) on any unsafe shape. */
export function isUnsafeDepName(name: string, mode: UnsafeDepNameMode = 'strictest'): boolean {
  if (name.includes('..')) return true;
  if (mode === 'go-feed-raw') return name.includes('\\');
  return name.includes('/') || name.includes(sep) || name.includes('\\');
}

/** Is `candidateAbs` equal to `root`, or nested inside it? Both arguments
 *  MUST already be absolute (resolved) paths. Purely LEXICAL — does NOT
 *  dereference symlinks; the containment gate is resolvedWithinRoot (below),
 *  which realpath-canonicalizes both sides first. Kept as the low-level
 *  primitive for the lexical-only absolute-path / `..`-segment cases. */
export function isWithinRoot(candidateAbs: string, root: string): boolean {
  const base = root.endsWith(sep) ? root : root + sep;
  return candidateAbs === root || candidateAbs.startsWith(base);
}

/** Resolves `resolve(root, ...segments)` and returns it ONLY if it both (a)
 *  exists on disk and (b) its REALPATH (symlink-resolved) lies within root's
 *  OWN realpath — both sides canonicalized (canonicalizing only the candidate
 *  would false-reject legitimate in-tree paths when root sits under a
 *  symlinked ancestor, e.g. macOS /tmp → /private/tmp). Fail-closed: any
 *  realpath error rejects rather than guesses. THE containment gate for every
 *  dependency-manifest VALUE surface (vendored / path-override /
 *  workspace-member / venv site-packages). */
export function resolvedWithinRoot(root: string, ...segments: string[]): string | null {
  const candidate = resolve(root, ...segments);
  if (!isWithinRoot(candidate, root)) return null; // cheap lexical reject first
  if (!existsSync(candidate)) return null; // must exist to read + to realpath
  let real: string;
  let realRoot: string;
  try {
    real = realpathSync(candidate);
    realRoot = realpathSync(root);
  } catch {
    return null; // fail-closed on any realpath error (broken symlink, EPERM, race)
  }
  return isWithinRoot(real, realRoot) ? candidate : null;
}
