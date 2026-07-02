// Tiered allowlist resolver — Tier 0 (builtin) + Tier 2 (consumer-acked) in S1;
// Tier 1 (derived from installed-package metadata) lands in S2 behind tier1For().
// Kickoff: .claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md §4
// (branch docs/kickoff-rule-research-trust-tiers). DN resolutions 2026-07-02:
//   DN #3 — exact-host matching, NO eTLD+1/PSL computation anywhere;
//   DN #6 — multi-tenant apexes ineligible for Tier-1 (S2 data file);
//   DN #2 — ack activation = human-merged PR (no in-session auto-ack path in code).
// Cross-tier invariants (§4): https-only; registrable hostnames only (IP literals
// rejected); canonicalized hosts; xn-- (punycode) labels rejected outside an
// explicit Tier-2 ack; subdomain-inclusive matching (bare domain covers subdomains).

// --- host invariant helpers ---

/** Lowercase + strip one trailing dot (DNS root marker). */
export function canonicalizeHost(host: string): string {
  const lower = host.toLowerCase();
  return lower.endsWith('.') ? lower.slice(0, -1) : lower;
}

/** Bare IPv4 or bracketed IPv6 (URL.hostname returns IPv6 as "[::1]"). */
export function isIpLiteral(host: string): boolean {
  if (host.startsWith('[') && host.endsWith(']')) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/** Any DNS label starting with the IDN/punycode prefix. URL.hostname already
 *  ASCII-encodes Unicode (café.com → xn--caf-dma.com), so this label check is
 *  the real homograph guard — "must be ASCII" would be a no-op (kickoff §4). */
export function hasPunycodeLabel(host: string): boolean {
  return host.split('.').some((label) => label.startsWith('xn--'));
}

/** Exact host or subdomain-of (segment-safe endsWith) — kickoff §3 row 7 semantics. */
export function hostMatches(host: string, allowed: readonly string[]): boolean {
  return allowed.some((a) => host === a || host.endsWith(`.${a}`));
}

// --- Tier-2 ack file (cargo-vet-shaped committed trust records) ---

import { readFileSync } from 'node:fs';
import { validateAckFileShape, errorsText } from './internal-validators.ts';

export interface AckEntry {
  key: string; // enters the allowlistKey namespace
  hosts: string[]; // registrable hosts, https implied; canonicalized at load
  scope?: string; // optional package scope-lock (checked against entryPackage)
  reason: string;
  ackedBy: string; // human git identity — never the agent (DN #2, T-RTT-C)
  ackedAt: string; // ISO 8601 calendar date
}

/** Thrown on ANY malformed ack entry — fail-closed and loud. */
export class AckFileError extends Error {
  override name = 'AckFileError';
}

/** Missing file ⇒ empty Map (fail-closed default). Malformed content ⇒ throw. */
export function loadAckFile(path: string): Map<string, AckEntry> {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return new Map();
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AckFileError(`malformed JSON in ack file: ${path}`);
  }
  if (!validateAckFileShape(parsed)) {
    throw new AckFileError(errorsText(validateAckFileShape.errors));
  }
  const doc = parsed as { entries: AckEntry[] };
  const map = new Map<string, AckEntry>();
  for (const entry of doc.entries) {
    // Schema regex admits shape-valid non-dates ("2026-13-45") — Date.parse guards semantics.
    if (!Number.isFinite(Date.parse(entry.ackedAt))) {
      throw new AckFileError(
        `malformed ackedAt date "${entry.ackedAt}" in entry "${entry.key}"`,
      );
    }
    const hosts = entry.hosts.map(canonicalizeHost);
    for (const h of hosts) {
      if (isIpLiteral(h)) {
        throw new AckFileError(
          `IP-literal host "${h}" in entry "${entry.key}" — registrable domain names only`,
        );
      }
    }
    if (map.has(entry.key)) {
      throw new AckFileError(`duplicate key "${entry.key}" in ack file`);
    }
    map.set(entry.key, { ...entry, hosts });
  }
  return map;
}

// --- resolver port + tiered validation ---

import { join } from 'node:path';
import type { Provenance } from './types.ts';
import { ALLOWED_SOURCES, type ProvenanceValidation } from './allowlist.ts';

/** Ecosystem seam (S1: interface only; npm adapter lands in S2, non-JS in S4).
 *  Parameterizes the toolchain axis ({toolchain, stack}) instead of forking
 *  the resolver — maintainer direction 2026-07-02. */
export interface EcosystemAdapter {
  readonly ecosystem: string;
  listDirectDeps(root: string): Set<string>;
  readInstalledMeta(root: string, pkg: string): InstalledMeta | null;
}
export interface InstalledMeta {
  homepage?: string;
  repository?: string | { type?: string; url?: string };
}
export interface ResolveCtx {
  /** Consumer root: the directory containing the consumer package.json. */
  root: string;
  /** Default set in S2 (npmAdapter); absent in S1 ⇒ Tier-1 always misses. */
  adapter?: EcosystemAdapter;
  /** Default: <root>/.ai-factory/research-allowlist.json */
  ackFilePath?: string;
}
export type Tier1Result =
  | { ok: true; hosts: readonly string[] }
  | { ok: false; reason: string };
export interface ResolvedSources {
  tier0: Readonly<Record<string, readonly string[]>>;
  tier2: ReadonlyMap<string, AckEntry>;
  tier1For(packageName: string): Tier1Result;
}

/** No ctx ⇒ Tier-0 only, ZERO fs access (safe for the one-arg wrapper). */
export function resolveAllowedSources(ctx?: ResolveCtx): ResolvedSources {
  const tier2 = ctx
    ? loadAckFile(ctx.ackFilePath ?? join(ctx.root, '.ai-factory', 'research-allowlist.json'))
    : new Map<string, AckEntry>();
  return {
    tier0: ALLOWED_SOURCES as Readonly<Record<string, readonly string[]>>,
    tier2,
    tier1For(packageName: string): Tier1Result {
      // S1 stub — real derivation (local installed-package metadata, exact-host,
      // multi-tenant-ineligible) lands in S2 behind the EcosystemAdapter seam.
      return {
        ok: false,
        reason: `host not authorized: Tier-1 unavailable for \`${packageName}\` (no ecosystem adapter wired — S2)`,
      };
    },
  };
}

/** Tiered provenance validation — first match wins (kickoff §4: Tier 0 → 1 → 2).
 *  Tier-0 preserves the pre-refactor validator's ok-verdict + reason strings for
 *  every curated-store input. It is NOT byte-identical on all inputs: the §4
 *  cross-tier invariants (host canonicalization, IP-literal + punycode rejection)
 *  apply uniformly, so a trailing-dot FQDN of an allowed host now resolves ok, and
 *  IP-literal / punycode inputs carry a specific reason. Those three divergences
 *  are pinned in allowlist-resolver.test.ts (executable truth, not a prose claim).
 *  Three untouched callers print the reason strings as consumer guidance. */
export function validateProvenance(
  p: Provenance,
  resolved: ResolvedSources,
  opts?: { entryPackage?: string },
): ProvenanceValidation {
  // Tier 0 — replicate the legacy key-first ordering for exact back-compat.
  const builtinHosts = resolved.tier0[p.allowlistKey];
  if (builtinHosts) {
    const parsed = parseHttpsHost(p.url);
    if (!('host' in parsed)) return parsed;
    if (hasPunycodeLabel(parsed.host)) return punycodeReject(parsed.host);
    if (hostMatches(parsed.host, builtinHosts)) return { ok: true };
    return {
      ok: false,
      reason: `host ${parsed.host} not allowed under key ${p.allowlistKey} (expected one of: ${builtinHosts.join(', ')})`,
    };
  }

  // Tier 1 — scope-locked derived trust (activates in S2; S1 tier1For always misses).
  let tier1Miss: string | undefined;
  const packageName = (p as Provenance & { packageName?: string }).packageName;
  if (packageName !== undefined && opts?.entryPackage !== undefined) {
    if (packageName !== opts.entryPackage) {
      return {
        ok: false,
        reason: `cross-package provenance: packageName ${packageName} !== entry.package ${opts.entryPackage} (T-RTT-A)`,
      };
    }
    const t1 = resolved.tier1For(packageName);
    if (t1.ok) {
      const parsed = parseHttpsHost(p.url);
      if (!('host' in parsed)) return parsed;
      if (hasPunycodeLabel(parsed.host)) return punycodeReject(parsed.host);
      if (hostMatches(parsed.host, t1.hosts)) return { ok: true };
      tier1Miss = `host not authorized: not in the Tier-1 host set of \`${packageName}\``;
    } else {
      tier1Miss = t1.reason;
    }
  }

  // Tier 2 — consumer-acked keys.
  const ack = resolved.tier2.get(p.allowlistKey);
  if (ack) {
    if (ack.scope !== undefined && opts?.entryPackage !== ack.scope) {
      return {
        ok: false,
        reason: `ack key ${p.allowlistKey} is scoped to package ${ack.scope}`,
      };
    }
    const parsed = parseHttpsHost(p.url);
    if (!('host' in parsed)) return parsed;
    if (hostMatches(parsed.host, ack.hosts)) {
      // Carve-out (kickoff §4): a punycode host passes ONLY via an acked host
      // that itself carries the xn-- label — i.e. a human deliberately listed it.
      if (hasPunycodeLabel(parsed.host)) {
        const explicitlyAcked = ack.hosts.some(
          (a) => hasPunycodeLabel(a) && (parsed.host === a || parsed.host.endsWith(`.${a}`)),
        );
        if (!explicitlyAcked) return punycodeReject(parsed.host);
      }
      return { ok: true };
    }
    return {
      ok: false,
      reason: `host ${parsed.host} not allowed under ack key ${p.allowlistKey} (acked hosts: ${ack.hosts.join(', ')})`,
    };
  }

  if (tier1Miss) return { ok: false, reason: tier1Miss };
  return { ok: false, reason: `unknown allowlistKey: ${p.allowlistKey}` };
}

function parseHttpsHost(rawUrl: string): { host: string } | ProvenanceValidation {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: `malformed URL: ${rawUrl}` };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: `non-https URL: ${rawUrl}` };
  }
  const host = canonicalizeHost(url.hostname);
  if (isIpLiteral(host)) {
    return { ok: false, reason: `IP-literal host ${host} rejected: registrable domain names only` };
  }
  return { host };
}

function punycodeReject(host: string): ProvenanceValidation {
  return {
    ok: false,
    reason: `punycode (xn--) host ${host} rejected outside an explicit Tier-2 ack`,
  };
}
