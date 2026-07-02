// Append-only diagnostic code registry — D1 (diagnostics-core).
// Spec: docs/superpowers/specs/2026-07-02-diagnostics-core-design.md §3.2
// Plan: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.md Task 1.2
// Decisions: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.decisions.md
//   DN-D1-2 (FF2009 single code), NEW-2 (FF2014 thrown via AckFileError),
//   NEW-3 (message-fidelity constraint — each template below reproduces the
//   exact substring the resolver's current reason string carries, verified
//   against packages/core/research/allowlist-resolver.ts at HEAD 35c0b4104).
//
// Ranges (tsc diagnosticMessages.json pattern): FF1xxx schema/shape,
// FF2xxx provenance/trust, FF3xxx L4 semantic gates (Task 4), FF4xxx
// installer/wiring (reserved), FF5xxx CLI/config (reserved). FF = fitness
// functions (getff brand). This file seeds FF1001 + the 15 FF2xxx codes only
// — FF3xxx lands in Task 4 (plan sequencing), FF4xxx/FF5xxx are D2 at-touch.
//
// Registry is append-only: never remove or renumber an existing code (see
// registry.test.ts test (d), pinned against registry.codes.snapshot.json).

import type { Severity } from './types.ts';

export interface RegistryEntry {
  /** Interpolation template. `{placeholder}` tokens must match a params key. */
  template: string;
  defaultSeverity: Severity;
  /** Human-readable explanation of when/why this code fires. */
  explanation: string;
}

export const REGISTRY: Readonly<Record<string, RegistryEntry>> = Object.freeze({
  // --- FF1xxx: schema/shape (ajv), both pipelines ---
  FF1001: {
    template: 'schema violation: {keyword} at {instancePath} (schema: {schemaPath})',
    defaultSeverity: 'error',
    explanation:
      'Generic ajv schema-shape violation. keyword is ajv\'s own discriminator; ' +
      'per-keyword codes would bloat the registry with no consumer (spec §3.2).',
  },

  // --- FF2xxx: provenance/trust (resolveAllowedSources / validateProvenance) ---
  FF2001: {
    template: 'malformed URL: {url}',
    defaultSeverity: 'error',
    explanation: 'p.url (or finalUrl) failed `new URL()` parsing. allowlist-resolver.ts parseHttpsHost.',
  },
  FF2002: {
    template: 'non-https URL: {url}',
    defaultSeverity: 'error',
    explanation: 'URL parsed but protocol !== "https:". allowlist-resolver.ts parseHttpsHost.',
  },
  FF2003: {
    template: 'IP-literal host {host} rejected: registrable domain names only',
    defaultSeverity: 'error',
    explanation:
      'Host is a bare IPv4 or bracketed IPv6 literal. allowlist-resolver.ts parseHttpsHost.',
  },
  FF2004: {
    template: 'punycode (xn--) host {host} rejected outside an explicit Tier-2 ack',
    defaultSeverity: 'error',
    explanation:
      'Host carries an xn-- (IDN/punycode) label and is not explicitly acked. ' +
      'allowlist-resolver.ts punycodeReject.',
  },
  FF2005: {
    template: 'unknown allowlistKey: {allowlistKey}',
    defaultSeverity: 'error',
    explanation:
      'allowlistKey matched no Tier-0 builtin, no Tier-1 miss reason, and no Tier-2 ack. ' +
      'allowlist-resolver.ts validateUrlAgainstTiers (terminal fallback).',
  },
  FF2006: {
    template:
      'host {host} not allowed under key {allowlistKey} (expected one of: {expectedHosts})',
    defaultSeverity: 'error',
    explanation:
      'allowlistKey matched a Tier-0 builtin, but the URL host is not in that key\'s host list. ' +
      'allowlist-resolver.ts validateUrlAgainstTiers (Tier 0 branch).',
  },
  FF2007: {
    template: 'host not authorized: `{packageName}` is not a direct dependency',
    defaultSeverity: 'error',
    explanation:
      'Tier-1 direct-dep gate: packageName is not in the consumer\'s direct dependency set. ' +
      'allowlist-resolver.ts resolveAllowedSources tier1For.',
  },
  FF2008: {
    template:
      'host not authorized: Tier-1 unavailable for `{packageName}` (no ecosystem adapter wired — S2)',
    defaultSeverity: 'error',
    explanation:
      'No EcosystemAdapter wired on the ResolveCtx (S1 back-compat path, or no ctx at all) — ' +
      'Tier-1 always misses. allowlist-resolver.ts resolveAllowedSources tier1For.',
  },
  FF2009: {
    template: 'no Tier-1-eligible host in {packageName} metadata (multi-tenant or non-https)',
    defaultSeverity: 'error',
    explanation:
      'Tier-1 derivation found zero eligible hosts across homepage/repository metadata ' +
      '(multi-tenant apex, non-https, IP-literal, or punycode all fold into this single ' +
      'reason — DN-D1-2: the resolver emits ONE reason string for all four causes, so ONE ' +
      'code is honest to what is actually emitted). allowlist-resolver.ts resolveAllowedSources tier1For.',
  },
  FF2010: {
    template: 'cross-package provenance: packageName {packageName} !== entry.package {entryPackage} (T-RTT-A)',
    defaultSeverity: 'error',
    explanation:
      'Tier-1 scope-lock: the provenance packageName does not match the entry\'s own package. ' +
      'allowlist-resolver.ts validateUrlAgainstTiers (Tier 1 branch).',
  },
  FF2011: {
    template: 'host not authorized: not in the Tier-1 host set of `{packageName}`',
    defaultSeverity: 'error',
    explanation:
      'Tier-1 resolved a host set for packageName, but the URL host is not in it. ' +
      'allowlist-resolver.ts validateUrlAgainstTiers (Tier 1 branch).',
  },
  FF2012: {
    template: 'ack key {allowlistKey} is scoped to package {scope}',
    defaultSeverity: 'error',
    explanation:
      'Tier-2 ack entry carries a scope that does not match opts.entryPackage. ' +
      'allowlist-resolver.ts validateUrlAgainstTiers (Tier 2 branch).',
  },
  FF2013: {
    template:
      'host {host} not allowed under ack key {allowlistKey} (acked hosts: {ackedHosts})',
    defaultSeverity: 'error',
    explanation:
      'Tier-2 ack entry exists for allowlistKey, but the URL host is not in its acked hosts. ' +
      'allowlist-resolver.ts validateUrlAgainstTiers (Tier 2 branch).',
  },
  FF2014: {
    template: '{ackFileReason}',
    defaultSeverity: 'error',
    explanation:
      'Ack-file malformed family — thrown as AckFileError (NEW-2), NOT returned by ' +
      'validateProvenance. Covers: malformed JSON, bad shape, malformed ackedAt date, ' +
      'IP-literal ack host, single-label ack host (#857), duplicate key. ' +
      'allowlist-resolver.ts loadAckFile throw sites.',
  },
  FF2015: {
    template: 'finalUrl redirect crosses to an unauthorized host: {innerReason}',
    defaultSeverity: 'error',
    explanation:
      'p.finalUrl is present, differs from p.url, and independently fails the same tier ' +
      'resolution. allowlist-resolver.ts validateProvenance (finalUrl redirect check).',
  },
});

/** Registry lookup for `diag()` — throws (programmer bug) on unknown code. */
function lookup(code: string): RegistryEntry {
  const entry = REGISTRY[code];
  if (entry === undefined) {
    throw new Error(`diag(): unknown diagnostic code "${code}" — not in REGISTRY`);
  }
  return entry;
}

const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;

/** Interpolate `template` with `params`; throws (programmer bug) on a
 *  placeholder with no matching params key. */
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(PLACEHOLDER_RE, (whole, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      throw new Error(
        `diag(): template placeholder "{${key}}" has no matching params key (params: ${JSON.stringify(params)})`,
      );
    }
    return String(params[key]);
  });
}

export interface DiagOpts {
  severity?: Severity;
  path?: string;
}

/** Construct a Diagnostic from a registry code + params. Fails loudly on an
 *  unknown code or a missing template placeholder (programmer bug, not
 *  expected bad input — Fowler Notification split, spec §2 item 5). */
export function diag(
  code: string,
  params: Record<string, string | number>,
  opts?: DiagOpts,
): import('./types.ts').Diagnostic {
  const entry = lookup(code);
  return {
    code,
    severity: opts?.severity ?? entry.defaultSeverity,
    ...(opts?.path !== undefined ? { path: opts.path } : {}),
    params,
    message: interpolate(entry.template, params),
  };
}
