// Neutral live-research → ConventionNode bridge — live-generation umbrella (LG-S1, Increment 1).
// Spec: docs/meta-factory/research-patches/2026-07-11-live-generation.md §0 Plane 3 (the one
// load-bearing BUILD of this umbrella), §Qb (frozen-IR expressibility ceiling + MAJOR-1 filter),
// §Qc (Tier-0 python keys as data).
// Prior-art: docs/meta-factory/prior-art-evaluations.md#219 (stack-agnostic autogeneration core)
// + #183 (the shipped JS rule-research bridge this generalizes onto the neutral ConventionNode plane).
//
// WHAT THIS IS: the thin, SHARED projection «a researched practice → a ConventionNode (frozen IR)
// routed to the stack's backend». Python (this stage) and Rust (LG-S3) both consume it. It is NOT a
// pipeline — it authors ONE neutral node from ONE researched practice and hands it to the (verbatim,
// pure) `renderAstgrep` backend the caller then invokes. It does NOT render, write files, or touch
// the network — same purity contract as the renderers (render-astgrep.ts:5).
//
// PLANE SEPARATION (why the bridge DEFINES ITS OWN input type): only the OUTPUT `ConventionNode`
// (ir/types.ts) is frozen. No existing type carries the astgrep {kind, pattern} the backend needs —
// `ResearchEntry` has no pattern/kind, and `GenerateCandidate` (generate-port.ts:14) has
// selector/presence/engine but NO `kind`. So the bridge owns its input interface, an astgrep-shaped
// «researched practice» (GenerateCandidate-shaped + the frozen-IR `kind` discriminator). The OUTPUT
// stays the frozen node — no field added.
//
// TWO HONESTY LINES, both non-negotiable (§Qb + Phase -1):
//   1. Degrade-not-inert (MAJOR-1): a practice that does NOT reduce to a single literal ast-grep
//      `pattern` of kind call/attribute/import is dropped to a RESEARCH-ONLY FINDING *before* node
//      construction — NEVER emitted as an inert node. Mirrors the JS lane's withManualDrop /
//      agents/rule-researcher.md §MAJOR-1. NOTE (post-ir-unfreeze, PR #1079/#1084): the RENDERER is
//      no longer frozen — render-astgrep.ts DOES emit any:/all:/not:/has: from ConventionNode.relational.
//      This BRIDGE, however, deliberately authors only flat-pattern nodes today (buildAstgrepNode sets
//      no `relational`; AstgrepResearchedPractice carries no relational field) — bridge-side relational
//      authoring is un-wired follow-through, NOT shipped here. So from THIS lane, alternation /
//      non-{call,attribute,import} kinds (mutable-default-arg, bare-except, == None) remain research-only.
//      Note the getff-no-yaml-load bypass forms (aliased receiver / bare import) are a DIFFERENT limit —
//      import-binding, which relational does not close either; accepted as a deliberate demo limit
//      (docs/meta-factory/research-patches/2026-07-22-getff-no-yaml-load-coverage-verdict.md).
//   2. The bridge validates provenance ITSELF (the grammar gate does NOT check the provenance host —
//      grammar.ts validates only shape/degenerate-pair/dup-id/dangling-anchor). A practice whose
//      provenance does not resolve to a trusted Tier-0 source is a research-only finding, never a
//      trusted node. (The Tier-1 consumer-package adapter is DEFERRED to LG-S4/rust per §Qc — this
//      bridge ships the Tier-0 path only; a package-scoped Tier-1 seam is added there with a package
//      field + Tier-1-reachable tests, not speculatively here.)

import type { Severity } from '../diagnostics/types.ts';
import type { ConventionNode } from '../ir/types.ts';
import { runGrammarGate } from '../ir/gates/grammar.ts';
// S1 getff-any-stack-trace: the bridge switches from the one-arg Tier-0-only wrapper
// (`allowlist.ts:validateProvenance`) to the exported two-arg resolved-aware validator
// (`allowlist-resolver.ts:validateProvenance`) — the same SSOT, called with a manifest-derived
// `ResolvedSources` so a practice whose provenance host matches a direct dependency's
// `homepage`/`documentation`/`repository` metadata is admitted at Tier-1 instead of dropped.
import {
  resolveAllowedSources,
  validateProvenance,
  type ResolveCtx,
  type ResolvedSources,
} from '../research/allowlist-resolver.ts';
import type { Provenance } from '../research/types.ts';

/** The frozen-IR-expressible ast-grep node kinds (render-astgrep.ts:44). A practice whose `kind`
 *  is outside this set cannot be honestly rendered as a single literal pattern (§Qb). */
export const EXPRESSIBLE_KINDS: readonly string[] = ['call', 'attribute', 'import'];

/**
 * A researched practice, astgrep-shaped — the bridge's OWN input interface (not a frozen type).
 * Modelled on `GenerateCandidate` (generate-port.ts:14) and extended with the frozen-IR `kind`
 * discriminator the ConventionNode → renderAstgrep contract requires. Only the OUTPUT node is frozen.
 */
export interface AstgrepResearchedPractice {
  /** ResearchEntry.id — becomes ConventionNode.id (namespaced, e.g. 'getff-no-yaml-load'). */
  entryId: string;
  /** Human claim — becomes ConventionNode.claim AND the rendered rule's message. */
  title: string;
  /** Enrichment the node backbone does NOT carry (parity with GenerateCandidate.stack /
   *  to-node.ts:82); kept on the input for the caller, never projected onto the node. */
  stack: string[];
  /** ast-grep node kind. Only EXPRESSIBLE_KINDS are frozen-IR-expressible; any other value (or a
   *  non-string) routes the practice to a research-only finding (§Qb ceiling). Typed wide on
   *  purpose so an inexpressible kind (e.g. a structural def-match) is REPRESENTABLE — the
   *  MAJOR-1 filter must be non-vacuous. */
  kind: 'call' | 'attribute' | 'import' | (string & {});
  /** Forbid-class signal (MAJOR-1; mirrors GenerateCandidate.presence + file-clients.routesToManual).
   *  A ban is expressible ONLY when presence:'forbid' AND a literal pattern is present. */
  presence?: 'forbid';
  /** The single literal ast-grep pattern (e.g. 'yaml.load($$$ARGS)') — becomes params.pattern.
   *  Absent/empty ⇒ not single-pattern-expressible ⇒ research-only finding (§Qb). */
  pattern?: string;
  /** Optional ast-grep rewrite — becomes params.replacement (the renderer's `fix:`) when present. */
  replacement?: string;
  /** Paired examples — become ConventionNode.pairedExamples (bad → negative, good → positive). */
  examples: { bad: string; good: string };
  /** Provenance chain — VALIDATED by the bridge's Tier-0 validateProvenance call. */
  provenance: Provenance[];
  /** Rendered-rule severity; defaults to 'error' (required for `ast-grep scan` to exit 1). */
  defaultSeverity?: Severity;
}

/** Why a practice did NOT become a node (all honest degrade paths — never a silent drop). */
export type ResearchOnlyReason = 'not-expressible' | 'provenance-rejected' | 'gate-failed';

export type ResearchToNodeResult =
  | { status: 'node'; node: ConventionNode }
  | { status: 'research-only'; entryId: string; reason: ResearchOnlyReason; detail: string };

/**
 * §Qb MAJOR-1 expressibility filter: true iff the practice reduces to a single literal ast-grep
 * `pattern` that is a call/attribute/import BAN. This is the frozen-IR ceiling made testable —
 * everything else is a research-only finding.
 */
export function isSinglePatternExpressible(p: AstgrepResearchedPractice): boolean {
  return (
    p.presence === 'forbid' &&
    typeof p.pattern === 'string' &&
    p.pattern.length > 0 &&
    typeof p.kind === 'string' &&
    EXPRESSIBLE_KINDS.includes(p.kind)
  );
}

/**
 * Project one researched practice to a `ConventionNode`, or degrade it to a research-only finding.
 * Order matters (Phase -1): expressibility (§Qb) → provenance host-tier (the bridge's own resolver
 * call) → grammar-gate shape. Each failure is an honest research-only finding, never an inert node.
 *
 * `ctx` (S1 getff-any-stack-trace, spec §4 W1-1): the manifest-derived `ResolveCtx` from the
 * resolve-ctx.ts factory (`resolveCtxForRoot`). When passed, a practice whose provenance host
 * matches a direct dependency's `homepage`/`documentation`/`repository` metadata is admitted at Tier-1
 * (the two-arg `validateProvenance(p, resolved)` form, the SSOT). When omitted, the bridge
 * degrades to the Tier-0-only back-compat path (the resolver materialises an empty ctx) —
 * preserving every existing call site that has no consumer manifest in scope (framework-side
 * drift gates, internal renders, every test that pre-dates this threading).
 */
export function researchedPracticeToNode(
  practice: AstgrepResearchedPractice,
  ctx?: ResolveCtx,
): ResearchToNodeResult {
  // 1. Degrade-not-inert (MAJOR-1 §Qb) — BEFORE node construction.
  if (!isSinglePatternExpressible(practice)) {
    return {
      status: 'research-only',
      entryId: practice.entryId,
      reason: 'not-expressible',
      detail:
        `not single-pattern call/attribute/import-ban expressible ` +
        `(kind=${String(practice.kind)}, presence=${String(practice.presence)}, ` +
        `pattern=${practice.pattern ? 'present' : 'absent'}) — §Qb frozen-IR ceiling`,
    };
  }

  // 2. Trust gate — the bridge validates provenance itself (grammar gate does NOT check host).
  //    Materialise `ResolvedSources` ONCE here (the ack-file load is fs IO); pass it down to
  //    `firstProvenanceRejection` so a multi-record practice reuses the same resolved view
  //    instead of re-loading per record. No ctx ⇒ resolveAllowedSources() returns Tier-0-only.
  const resolved = resolveAllowedSources(ctx);
  const provReject = firstProvenanceRejection(practice.provenance, resolved);
  if (provReject !== null) {
    return {
      status: 'research-only',
      entryId: practice.entryId,
      reason: 'provenance-rejected',
      detail: provReject,
    };
  }

  const node = buildAstgrepNode(practice);

  // 3. Final shape check — the produced node MUST pass the IR grammar gate. A shape defect
  //    (e.g. degenerate pairedExamples) degrades honestly rather than shipping a bad node.
  const gate = runGrammarGate([node]);
  if (gate.status !== 'pass') {
    return {
      status: 'research-only',
      entryId: practice.entryId,
      reason: 'gate-failed',
      detail: gate.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; '),
    };
  }

  return { status: 'node', node };
}

const DEFAULT_SEVERITY: Severity = 'error';

/** Build the frozen ConventionNode from an already-expressible practice (params guaranteed present
 *  by isSinglePatternExpressible). NO field added to the frozen IR — selectorClass is 'syntax'
 *  (the ast-grep-rendered class) and params carry the {kind, pattern} the backend validates. */
function buildAstgrepNode(practice: AstgrepResearchedPractice): ConventionNode {
  const params: Record<string, string | number> = {
    kind: practice.kind,
    pattern: practice.pattern as string,
  };
  if (practice.replacement !== undefined) {
    params['replacement'] = practice.replacement;
  }
  return {
    id: practice.entryId,
    claim: practice.title,
    anchors: [],
    selectorClass: 'syntax',
    params,
    defaultSeverity: practice.defaultSeverity ?? DEFAULT_SEVERITY,
    provenance: practice.provenance,
    pairedExamples: {
      negative: practice.examples.bad,
      positive: practice.examples.good,
    },
  };
}

/**
 * Return the first provenance rejection reason, or null if every record resolves to a trusted
 * source. A practice with ZERO provenance cannot be trusted (fail-closed).
 *
 * Tier model (S1 getff-any-stack-trace, spec §4 W1-1): the validator runs in its two-arg
 * resolved-aware form. When the caller threads a `ResolveCtx`, `resolved` carries Tier-0,
 * Tier-1 (the manifest-derived hosts), and Tier-2 (the ack file); otherwise `resolved` is
 * Tier-0-only and the validator falls back to the historical behaviour. Either way the
 * validator is the SSOT — the bridge never re-implements the host-tier call.
 *
 * `entryPackage` opt (S1): the validator's Tier-1 branch is gated on `opts.entryPackage`
 * (allowlist-resolver.ts:316) — it is the scope-lock left-hand side from `entry.package`
 * (gates/provenance.ts:85). The bridge's input shape `AstgrepResearchedPractice` has no
 * separate `package` field: a single-practice record IS scoped to whatever its provenance
 * records declare — the practice's package IS `p.packageName`. We therefore thread
 * `{ entryPackage: p.packageName }` so the Tier-1 branch activates for manifest-derived
 * admission. The scope-lock check (`packageName !== entryPackage`) becomes a self-check
 * (trivially satisfied), which is the correct posture for the bridge's single-practice
 * scope: a practice that cites a URL claiming to be about package X is, by construction,
 * "for package X" — there is no second independent package claim to disagree. The
 * plan-level validator (gates/provenance.ts over a full ResearchPlan) is the proper home
 * for the multi-entry scope-lock; the bridge does not re-introduce it.
 *
 * Operational consequence (FF2010 is structurally unreachable from the bridge): because
 * `entryPackage === p.packageName` by construction, the validator's `packageName !==
 * opts.entryPackage` branch (FF2010) can NEVER fire from a bridge call. The effective
 * scope-lock on the bridge's single-practice path is the `tier1For` direct-dep gate
 * (FF2007, allowlist-resolver.ts:206) — "the cited package MUST be a direct dependency
 * of the consumer's manifest." FF2010 remains the scope-lock for the plan-level
 * validator, where `entry.package` and `provenance.packageName` are independent claims.
 */
function firstProvenanceRejection(
  provenance: Provenance[],
  resolved: ResolvedSources,
): string | null {
  if (provenance.length === 0) {
    return 'no provenance record — cannot resolve a trusted documentation source';
  }
  for (const p of provenance) {
    // Two-arg validator (allowlist-resolver.ts): null ⇒ admitted; Diagnostic ⇒ rejected.
    // `entryPackage: p.packageName` unlocks the Tier-1 branch (scope-lock self-check, see above).
    const opts = p.packageName !== undefined ? { entryPackage: p.packageName } : undefined;
    const d = validateProvenance(p, resolved, opts);
    if (d !== null) return d.message;
  }
  return null;
}
