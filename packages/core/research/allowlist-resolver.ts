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
      // A single-label host (bare TLD, e.g. "com") would authorize an entire TLD via
      // hostMatches (`host === 'com' || host.endsWith('.com')`). `h` is already
      // canonicalized (so "com." → "com"), so no-dot ⇒ not a registrable domain name.
      // Same fail-closed class as the IP-literal reject above (a human hand-edit typo,
      // e.g. "com" for "docs.com", would silently widen trust to every *.com).
      if (!h.includes('.')) {
        throw new AckFileError(
          `single-label host "${h}" in entry "${entry.key}" — registrable domain names only`,
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

import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
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

// --- Tier-1 support: multi-tenant apex data file (DN #6 Option A-via-C) ---

// AIF_SYNTH_PKG_ROOT: same bundle-relocation env var as internal-validators.ts —
// when running as a precompiled bundle, import.meta.url points to the bundle
// file (install/ dir), not the original source.
const _here = dirname(fileURLToPath(import.meta.url));
const _pkgCoreForData = process.env['AIF_SYNTH_PKG_ROOT'];
const MULTI_TENANT_HOSTS_PATH = _pkgCoreForData
  ? resolvePath(_pkgCoreForData, 'research', 'multi-tenant-hosts.json')
  : resolvePath(_here, 'multi-tenant-hosts.json');
const MULTI_TENANT_HOSTS: readonly string[] = (
  JSON.parse(readFileSync(MULTI_TENANT_HOSTS_PATH, 'utf8')) as { hosts: string[] }
).hosts;

/** Is `host` equal to, or a subdomain of, a known multi-tenant apex
 *  (github.com, *.github.io, npmjs.com, …)? Matching rule per kickoff §4/DN #6:
 *  host === entry || host.endsWith('.' + entry) — the same segment-safe
 *  subdomain-inclusive semantics as hostMatches, applied to the apex list. */
function isMultiTenantHost(host: string): boolean {
  return MULTI_TENANT_HOSTS.some((apex) => host === apex || host.endsWith(`.${apex}`));
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
      // No adapter wired (S1 back-compat path, or no ctx at all) ⇒ always miss.
      if (!ctx?.adapter) {
        return {
          ok: false,
          reason: `host not authorized: Tier-1 unavailable for \`${packageName}\` (no ecosystem adapter wired — S2)`,
        };
      }
      // Direct-dep gate (kickoff §4: transitive deps excluded — the full
      // dependency closure is not consumer-chosen).
      if (!ctx.adapter.listDirectDeps(ctx.root).has(packageName)) {
        return {
          ok: false,
          reason: `host not authorized: \`${packageName}\` is not a direct dependency`,
        };
      }
      const meta = ctx.adapter.readInstalledMeta(ctx.root, packageName);
      const candidateFields = [meta?.homepage, meta?.repository];
      const hosts: string[] = [];
      for (const field of candidateFields) {
        const rawHost = extractHttpsHostFromMeta(field);
        if (rawHost === null) continue; // no extractable https host — contributes nothing
        const host = canonicalizeHost(rawHost);
        if (isIpLiteral(host)) continue;
        if (hasPunycodeLabel(host)) continue;
        if (isMultiTenantHost(host)) continue; // H2/DN #6 — shared-apex ineligible
        if (!hosts.includes(host)) hosts.push(host);
      }
      if (hosts.length === 0) {
        return {
          ok: false,
          reason: `no Tier-1-eligible host in ${packageName} metadata (multi-tenant or non-https)`,
        };
      }
      return { ok: true, hosts };
    },
  };
}

/** Local re-implementation of ecosystem-npm.ts's extractHttpsHost, generalized
 *  over the InstalledMeta['repository'] | string | undefined union so this
 *  file does not need to import the npm-specific adapter module (the resolver
 *  stays ecosystem-agnostic — S4 non-JS adapters produce the same
 *  InstalledMeta shape). Mirrors ecosystem-npm.ts extractHttpsHost exactly. */
function extractHttpsHostFromMeta(
  field: InstalledMeta['homepage'] | InstalledMeta['repository'],
): string | null {
  if (field === undefined) return null;
  if (typeof field === 'object') {
    return extractHttpsHostFromMeta(field.url);
  }
  const stripped = field.startsWith('git+') ? field.slice(4) : field;
  try {
    const url = new URL(stripped);
    if (url.protocol !== 'https:') return null;
    return url.hostname;
  } catch {
    return null;
  }
}

/** Tiered validation of a single URL string against p's allowlistKey/packageName
 *  — first match wins (kickoff §4: Tier 0 → 1 → 2). Factored out of
 *  validateProvenance so the finalUrl same-tier check (below) can re-run the
 *  IDENTICAL tier-resolution logic on a second URL string, rather than
 *  duplicating it. Tier-0 preserves the pre-refactor validator's ok-verdict +
 *  reason strings for every curated-store input. It is NOT byte-identical on
 *  all inputs: the §4 cross-tier invariants (host canonicalization, IP-literal
 *  + punycode rejection) apply uniformly, so a trailing-dot FQDN of an allowed
 *  host now resolves ok, and IP-literal / punycode inputs carry a specific
 *  reason. Those three divergences are pinned in allowlist-resolver.test.ts
 *  (executable truth, not a prose claim). Three untouched callers print the
 *  reason strings as consumer guidance. */
function validateUrlAgainstTiers(
  rawUrl: string,
  p: Pick<Provenance, 'allowlistKey' | 'packageName'>,
  resolved: ResolvedSources,
  opts?: { entryPackage?: string },
): ProvenanceValidation {
  // Tier 0 — replicate the legacy key-first ordering for exact back-compat.
  const builtinHosts = resolved.tier0[p.allowlistKey];
  if (builtinHosts) {
    const parsed = parseHttpsHost(rawUrl);
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
  const packageName = p.packageName;
  if (packageName !== undefined && opts?.entryPackage !== undefined) {
    if (packageName !== opts.entryPackage) {
      return {
        ok: false,
        reason: `cross-package provenance: packageName ${packageName} !== entry.package ${opts.entryPackage} (T-RTT-A)`,
      };
    }
    const t1 = resolved.tier1For(packageName);
    if (t1.ok) {
      const parsed = parseHttpsHost(rawUrl);
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
    const parsed = parseHttpsHost(rawUrl);
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

/** Tiered provenance validation, public entrypoint. Validates p.url against
 *  the tier stack; when p.finalUrl is present and differs from p.url, the
 *  final URL must INDEPENDENTLY satisfy the same tier resolution (kickoff §4
 *  redirect handling) — a redirect crossing to a host that tier does not
 *  cover fails closed. finalUrl is an agent-protocol obligation, not a
 *  validator-verified fact about what was actually fetched (kickoff §4
 *  honesty bound) — this check only bounds what a RECORDED finalUrl may claim. */
export function validateProvenance(
  p: Provenance,
  resolved: ResolvedSources,
  opts?: { entryPackage?: string },
): ProvenanceValidation {
  const urlResult = validateUrlAgainstTiers(p.url, p, resolved, opts);
  if (!urlResult.ok) return urlResult;
  if (p.finalUrl !== undefined && p.finalUrl !== p.url) {
    const finalResult = validateUrlAgainstTiers(p.finalUrl, p, resolved, opts);
    if (!finalResult.ok) {
      return {
        ok: false,
        reason: `finalUrl redirect crosses to an unauthorized host: ${finalResult.reason}`,
      };
    }
  }
  return urlResult;
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
