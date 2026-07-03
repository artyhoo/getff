// npm EcosystemAdapter — the first concrete implementation of the EcosystemAdapter
// seam (allowlist-resolver.ts). All local fs, zero network (DN #1 resolved:
// metadata-alone; DN #3 resolved: exact-host, no eTLD+1/PSL).
// Kickoff §4 edge cases: scoped names, npm alias resolves by KEY, workspace symlinks.
// Plan: docs/superpowers/plans/2026-07-02-rule-research-trust-tiers-impl.md Task 2.2.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EcosystemAdapter, InstalledMeta } from './allowlist-resolver.ts';

/** Rejects a dependency name containing a path-traversal or separator
 *  segment BEFORE it is ever joined into a filesystem path
 *  (research-source-trust.md §5 item D harden-criterion — now LIVE: a
 *  second EcosystemAdapter (cargoAdapter, ecosystem-cargo.ts) landed,
 *  which is exactly the precondition ecosystem-adapter-precondition.test.ts
 *  watches for). A legitimate scoped name (`@scope/name`) contains exactly
 *  one `/` at a fixed position and is handled by installedPkgJsonPath's own
 *  `name.split('/')` BEFORE this guard is consulted per-segment — this
 *  guard runs on the RAW incoming name and rejects any `..` substring or a
 *  segment count/shape indicating traversal beyond the scoped-name form. */
function isUnsafeDepName(name: string): boolean {
  if (name.includes('..')) return true;
  const segments = name.startsWith('@') ? name.split('/') : [name];
  // A scoped name has exactly 2 segments (@scope, name); a bare name has
  // exactly 1. More segments, or an embedded separator within a segment,
  // indicates a shape this adapter's join was never designed for — reject
  // rather than silently joining a longer/deeper path than intended.
  if (name.startsWith('@') && segments.length !== 2) return true;
  return segments.some((s) => s.includes('/') || s.includes('\\'));
}

/** node_modules/<name>/package.json path — scoped names split on the slash.
 *  Returns null for an unsafe name (§5 item D) instead of ever constructing
 *  a path from it. */
function installedPkgJsonPath(root: string, name: string): string | null {
  if (isUnsafeDepName(name)) return null;
  const segments = name.startsWith('@') ? name.split('/') : [name];
  return join(root, 'node_modules', ...segments, 'package.json');
}

/** Reads and parses an installed package.json; null if absent, unreadable,
 *  or the name is rejected by installedPkgJsonPath's traversal guard.
 *  existsSync + readFileSync both follow symlinks (workspace-linked packages
 *  install as a symlinked node_modules/<name> dir — kickoff §4). */
function readInstalledPkgJson(root: string, name: string): Record<string, unknown> | null {
  const p = installedPkgJsonPath(root, name);
  if (p === null) return null;
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const npmAdapter: EcosystemAdapter = {
  ecosystem: 'npm',

  listDirectDeps(root: string): Set<string> {
    const pkgJsonPath = join(root, 'package.json');
    if (!existsSync(pkgJsonPath)) return new Set();
    let pkgJson: Record<string, unknown>;
    try {
      pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
    } catch {
      return new Set();
    }
    const deps = (pkgJson['dependencies'] as Record<string, string> | undefined) ?? {};
    const devDeps = (pkgJson['devDependencies'] as Record<string, string> | undefined) ?? {};
    const declared = new Set([...Object.keys(deps), ...Object.keys(devDeps)]);

    const direct = new Set<string>();
    for (const name of declared) {
      // npm alias ("x": "npm:real@1") installs the REAL package under
      // node_modules/<KEY>, i.e. node_modules/x — resolve by the declared key,
      // never by parsing the alias target out of the semver-range string.
      if (readInstalledPkgJson(root, name) !== null) {
        direct.add(name);
      }
    }
    return direct;
  },

  readInstalledMeta(root: string, pkg: string): InstalledMeta | null {
    const json = readInstalledPkgJson(root, pkg);
    if (json === null) return null;
    const homepage = typeof json['homepage'] === 'string' ? json['homepage'] : undefined;
    const repository = json['repository'] as InstalledMeta['repository'] | undefined;
    return { homepage, repository };
  },
};

/** Extracts a canonicalizable https host from a repository/homepage field.
 *  Returns null when no https host is extractable (org/repo shorthand, git@
 *  SSH URL, git:// URL, bare name) — contributes nothing to Tier-1 (kickoff §4).
 *  Canonicalization (lowercase, trailing-dot strip) happens at the call site
 *  (allowlist-resolver.ts canonicalizeHost), not here — this function only
 *  extracts the raw hostname substring. */
export function extractHttpsHost(
  repoOrHomepage: InstalledMeta['repository'] | string | undefined,
): string | null {
  if (repoOrHomepage === undefined) return null;
  if (typeof repoOrHomepage === 'object') {
    return extractHttpsHost(repoOrHomepage.url);
  }
  const raw = repoOrHomepage;
  // git+https://... → strip the git+ prefix, then parse as a normal URL.
  const stripped = raw.startsWith('git+') ? raw.slice(4) : raw;
  try {
    const url = new URL(stripped);
    if (url.protocol !== 'https:') return null;
    return url.hostname;
  } catch {
    // org/repo shorthand, git@host:path, git://host/path, bare names — none
    // parse as an absolute URL, so none yield an extractable https host.
    return null;
  }
}
