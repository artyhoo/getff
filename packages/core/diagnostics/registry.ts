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
// FF2xxx provenance/trust, FF3xxx L4 semantic gates, FF4xxx installer/wiring
// (reserved), FF5xxx CLI/config (reserved), FF6xxx IR grammar gates (seeded
// S1), FF7xxx render outcomes (seeded by cargo-v0 S2), FF8xxx composition/doc
// plane (seeded S4 — DocPlan composition gate). FF = fitness functions (getff
// brand). This file seeds FF1001, the 15 FF2xxx codes, and the 20 FF3xxx codes
// (Task 4, DN-D1-4 — one code per failure kind per gate, spec-literal per-gate
// allocation; see decisions.md DN-D1-4 for the full derivation), plus 3 FF6xxx
// codes (MT umbrella S1 — IR grammar gate), 3 FF7xxx codes (MT umbrella S2 —
// cargo backend v0 render outcomes), and 4 FF8xxx codes (MT umbrella S4 —
// DocPlan composition gate). FF4xxx/FF5xxx are D2+ at-touch (reserved, not seeded here).
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
  FF2016: {
    template: 'ecosystem mismatch: `{packageName}` requested a different ecosystem than the wired adapter',
    defaultSeverity: 'error',
    explanation:
      'S4 ecosystem-prefix dispatch (research-source-trust.md §4): packageName carries an ' +
      '"<ecosystem>:<bareName>" prefix (or defaults to npm when unprefixed) that does not ' +
      'match ctx.adapter.ecosystem — fail closed rather than silently retrying under the ' +
      'wrong adapter. allowlist-resolver.ts resolveAllowedSources tier1For.',
  },

  // --- FF3xxx: L4 semantic gates (validator/gate-*.ts) ---
  // One code per failure KIND per gate (DN-D1-4, spec-literal per-gate
  // allocation — 20 codes, not the 16-code shared-astgrep alternative).
  // The astgrep-deferred branch appears in 5 gates; each gets its own code
  // because its message text already diverges per gate (e.g.
  // gate-require-vacuity.ts's wording differs from the other four) and the
  // gate identity is a meaningful discriminator for the `path`/context.
  FF3001: {
    template: 'SynthesisPlan schema violation: {details}',
    defaultSeverity: 'error',
    explanation: 'Gate 1 (schema): plan fails synthesis-plan.schema.json (ajv). gate-schema.ts.',
  },
  FF3002: {
    template: '{checkType}-checked rule has no negative-test (required by L4 gate 2 — rule-tester roundtrip)',
    defaultSeverity: 'error',
    explanation: 'Gate 1 (schema): an eslint/declarative rule is missing its negative-test. gate-schema.ts.',
  },
  FF3003: {
    template: 'ast-grep engine reserved but not wired — deferred per generator-forbid-mvp decision (i)',
    defaultSeverity: 'error',
    explanation: 'Gate 2 (ruleTester): declarative rule declares engine ast-grep, deferred. gate-rule-tester.ts.',
  },
  FF3004: {
    template: 'eslint rule has no negative-test (gate 1 catches this; gate 2 cannot run without it)',
    defaultSeverity: 'error',
    explanation: 'Gate 2 (ruleTester): eslint-type rule missing negative-test. gate-rule-tester.ts.',
  },
  FF3005: {
    template: 'negative-test.input[{idx}] did not produce expected violation \'{expectViolation}\' for rule \'{ruleName}\'; got {got}',
    defaultSeverity: 'error',
    explanation: 'Gate 2 (ruleTester): negative-test input did not fire the expected violation. gate-rule-tester.ts.',
  },
  FF3006: {
    template: 'examples.good produced unexpected violation: rule=\'{ruleId}\' message=\'{message}\'',
    defaultSeverity: 'error',
    explanation: 'Gate 2 (ruleTester): examples.good unexpectedly fired the rule. gate-rule-tester.ts.',
  },
  FF3007: {
    template: 'tautology — rule \'{ruleName}\' fires on negative-corpus/{fileName}: {details}',
    defaultSeverity: 'error',
    explanation: 'Gate 4 (tautology): rule fires on a fixed negative-corpus file. gate-tautology.ts.',
  },
  FF3008: {
    template: 'references plugin rule \'{ruleName}\' that does not exist in the preset plugin registry; known: {knownRules}',
    defaultSeverity: 'error',
    explanation: 'Gate 6 (conflict): plugin rule reference orphan. gate-conflict.ts.',
  },
  FF3009: {
    template: 'synthesized rule references \'{ruleName}\' but eslintConfigSnippet has no entry for it (B1 merge may have dropped the rule, or recipe.eslintRuleConfig is empty)',
    defaultSeverity: 'error',
    explanation: 'Gate 6 (conflict): eslintConfigSnippet is missing an entry for a referenced rule. gate-conflict.ts.',
  },
  FF3010: {
    template: 'ast-grep engine reserved but not wired — deferred per generator-forbid-mvp decision (i)',
    defaultSeverity: 'error',
    explanation: 'Gate 7 (singleTokenDiff): declarative rule declares engine ast-grep, deferred. gate-single-token-diff.ts.',
  },
  FF3011: {
    template: 'single-token-diff: examples.bad and examples.good differ by {distance} tokens (threshold {threshold}) — pair does not isolate the forbidden construct; reduce to a minimal ≈1 token / 1 AST-node difference',
    defaultSeverity: 'error',
    explanation: 'Gate 7 (singleTokenDiff): bad/good example pair exceeds MAX_TOKEN_EDITS. gate-single-token-diff.ts.',
  },
  FF3012: {
    template: 'ast-grep engine reserved but not wired — deferred per generator-forbid-mvp decision (i)',
    defaultSeverity: 'error',
    explanation: 'Gate 8 (messageIdCoverage): declarative rule declares engine ast-grep with a declared message/messageId, deferred. gate-message-id-coverage.ts.',
  },
  FF3013: {
    template: 'messageId-coverage: declared check.message \'{declaredMessage}\' not found in emitted message \'{emittedMessage}\' — declared message is unreachable',
    defaultSeverity: 'error',
    explanation: 'Gate 8 (messageIdCoverage): declared check.message never appears in the actually-emitted message. gate-message-id-coverage.ts.',
  },
  FF3014: {
    template: 'messageId-coverage: declared check.messageId \'{declaredMessageId}\' does not match emitted messageId \'{emittedMessageId}\' — declared messageId is unreachable',
    defaultSeverity: 'error',
    explanation: 'Gate 8 (messageIdCoverage): declared check.messageId never matches the actually-emitted messageId. gate-message-id-coverage.ts.',
  },
  FF3015: {
    template: 'ast-grep engine reserved but not wired — deferred per generator-forbid-mvp decision (i)',
    defaultSeverity: 'error',
    explanation: 'Gate 9 (autofixClean): declarative rule declares engine ast-grep, deferred. gate-autofix-clean.ts.',
  },
  FF3016: {
    template: 'autofix-clean: fixer for \'{ruleName}\' produced unparseable output — {details}',
    defaultSeverity: 'error',
    explanation: 'Gate 9 (autofixClean): one-pass fixer output fails to parse. gate-autofix-clean.ts.',
  },
  FF3017: {
    template: 'autofix-clean: fixer for \'{ruleName}\' left {count} violation(s) in fixed output — fix is incomplete or introduces new same-rule violations',
    defaultSeverity: 'error',
    explanation: 'Gate 9 (autofixClean): fixer output still has same-rule violations after one pass. gate-autofix-clean.ts.',
  },
  FF3018: {
    template: 'ast-grep engine reserved but not wired for require-vacuity gate — deferred per generator-require-composite-tier decision',
    defaultSeverity: 'error',
    explanation: 'requireVacuity gate: declarative require-presence rule declares engine ast-grep, deferred. gate-require-vacuity.ts.',
  },
  FF3019: {
    template: 'require-vacuity direction A — selector never fires on examples.bad; rule can never catch violations',
    defaultSeverity: 'error',
    explanation: 'requireVacuity gate: selector never fires on the bad example (always-green false negative). gate-require-vacuity.ts.',
  },
  FF3020: {
    template: 'require-vacuity direction B — selector fires on good example ({count} violation{plural}); rule fires unconditionally',
    defaultSeverity: 'error',
    explanation: 'requireVacuity gate: selector fires on the good example too (always-red false positive). gate-require-vacuity.ts.',
  },
  FF3021: {
    template: 'examples.safeForms[{idx}] produced unexpected violation — selector is broader than its rationale (matches a known-safe form): rule=\'{ruleId}\' message=\'{message}\'',
    defaultSeverity: 'error',
    explanation: 'Gate 2 (ruleTester): a declared known-safe form of the forbidden construct fired the rule — over-broad selector (GH #915 obs 4: hasOwnProperty.call / x == null class). gate-rule-tester.ts.',
  },

  // --- FF6xxx: IR grammar gates (MT umbrella S1 — ir/gates/grammar.ts) ---
  FF6001: {
    template: 'degenerate pairedExamples: positive === negative for node {nodeId}',
    defaultSeverity: 'error',
    explanation:
      'IR grammar gate (tautology class): pairedExamples.positive and pairedExamples.negative ' +
      'are byte-identical, so the pair cannot discriminate the convention it claims to test. ir/gates/grammar.ts.',
  },
  FF6002: {
    template: 'duplicate ConventionNode id {id} ({count} occurrences)',
    defaultSeverity: 'error',
    explanation:
      'IR grammar gate (conflict class): two or more nodes in the set share the same id, ' +
      'breaking id-addressability. ir/gates/grammar.ts.',
  },
  FF6003: {
    template: 'dangling anchor {anchor} on node {nodeId}: not a REGISTRY code',
    defaultSeverity: 'error',
    explanation:
      'IR grammar gate (coverage/broken-ref class, principle-08 pattern generalized): an anchor ' +
      'in node.anchors does not resolve to a key in the diagnostics REGISTRY. ir/gates/grammar.ts.',
  },

  // --- FF7xxx: render outcomes (MT umbrella S2 — backends/cargo/render-clippy.ts) ---
  FF7001: {
    template: 'not expressible in {backend}: selectorClass {selectorClass} (node {nodeId})',
    defaultSeverity: 'warning',
    explanation:
      'Backend render refusal (capability class): the node\'s selectorClass has no ' +
      'representation in this backend\'s render target at v0 (e.g. syntax-class or ' +
      'dep-graph-class nodes against the cargo clippy.toml backend). backends/cargo/render-clippy.ts.',
  },
  FF7002: {
    template: 'params contract violation for {backend} renderer: node {nodeId} missing/invalid {missing}',
    defaultSeverity: 'error',
    explanation:
      'Backend render refusal (params class): node.params does not satisfy the backend\'s ' +
      'own params contract (e.g. missing kind/path, or kind outside the backend\'s known set). ' +
      'backends/cargo/render-clippy.ts.',
  },
  FF7003: {
    template: 'severity {requested} not projected by {backend} at v0 (node {nodeId})',
    defaultSeverity: 'note',
    explanation:
      'Backend render degradation (severity class): the node\'s defaultSeverity has no ' +
      'projection in this backend\'s render target at v0 (rendered-with-loss, not dropped — ' +
      'the content is still emitted). backends/cargo/render-clippy.ts.',
  },

  // --- FF8xxx: composition/doc plane (MT umbrella S4 — composition/gates/composition-gate.ts) ---
  FF8001: {
    template: 'dangling node reference: id {nodeId} in {where} has no matching ConventionNode',
    defaultSeverity: 'error',
    explanation:
      'Composition gate (broken-ref class): a DocPlan section nodeId or an excluded[] nodeId ' +
      'points at a ConventionNode id that is not in the node set. A plan cannot document a ' +
      'node that does not exist. composition/gates/composition-gate.ts.',
  },
  FF8002: {
    template:
      'node {nodeId} is neither placed in a section nor a valid excluded[] entry ({reason})',
    defaultSeverity: 'error',
    explanation:
      'Composition gate (coverage class, attention-is-not-a-mechanism): a scoped node is ' +
      'silently absent from the doc — it appears in no section AND has no valid excluded[] ' +
      'opt-out (missing, or reason under 20 chars). Silence about an undocumented node is ' +
      'impossible: it must be documented or explicitly, reasonedly excluded. ' +
      'composition/gates/composition-gate.ts.',
  },
  FF8003: {
    template: 'composition contradiction for node {nodeId}: {detail}',
    defaultSeverity: 'error',
    explanation:
      'Composition gate (contradiction class): the plan and the render facts disagree — a node ' +
      'placed in BOTH a section and excluded[], OR a backend segment with no RenderOutcome in ' +
      'the outcomes Map (a doc claiming enforcement a backend never produced). ' +
      'composition/gates/composition-gate.ts.',
  },
  FF8004: {
    template:
      'matrix incoherence for node {nodeId} backend {backend}: the cell for its selectorClass carries live-fired evidence while its status is "no" (evidence of firing in a cell marked not-applicable)',
    defaultSeverity: 'error',
    explanation:
      'Composition gate (honesty class, T-S4-A / DN-4): the capability-matrix cell for the ' +
      'node\'s selectorClass is internally incoherent — status is "no" (the rule does not apply) ' +
      'yet evidence.kind === "live-fired" (it was fired). The two honesty sources contradict. A ' +
      'rendered-not-fired 🟡 (status "no", no evidence) is spec-legal and is NOT FF8004. ' +
      'composition/gates/composition-gate.ts.',
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
