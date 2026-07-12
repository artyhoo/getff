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
//      agents/rule-researcher.md §MAJOR-1. The frozen renderer emits only a flat `pattern:` (no
//      any:/all:/relational surface), so alternation / non-{call,attribute,import} kinds
//      (mutable-default-arg, bare-except, == None) are genuinely inexpressible, not just unhandled.
//   2. The bridge validates provenance ITSELF (the grammar gate does NOT check the provenance host —
//      grammar.ts validates only shape/degenerate-pair/dup-id/dangling-anchor). A practice whose
//      provenance does not resolve to a trusted source (Tier-0 by default; Tier-1/2 when a ResolveCtx
//      is supplied) is a research-only finding, never a trusted node.

import type { Severity } from '../diagnostics/types.ts';
import type { ConventionNode } from '../ir/types.ts';
import { runGrammarGate } from '../ir/gates/grammar.ts';
import { validateProvenance } from '../research/allowlist.ts';
import {
  resolveAllowedSources,
  validateProvenance as validateProvenanceTiered,
  type ResolveCtx,
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
  /** Provenance chain — VALIDATED by the bridge's resolver call (Tier-0 by default). */
  provenance: Provenance[];
  /** Rendered-rule severity; defaults to 'error' (required for `ast-grep scan` to exit 1). */
  defaultSeverity?: Severity;
}

/** Why a practice did NOT become a node (all honest degrade paths — never a silent drop). */
export type ResearchOnlyReason = 'not-expressible' | 'provenance-rejected' | 'gate-failed';

export type ResearchToNodeResult =
  | { status: 'node'; node: ConventionNode }
  | { status: 'research-only'; entryId: string; reason: ResearchOnlyReason; detail: string };

export interface ResearchToNodeOptions {
  /** When supplied, provenance resolves through the full tiered resolver (Tier 0→1→2) against this
   *  consumer context; absent ⇒ Tier-0-only (zero fs), the default for the $0 firing-fixture path. */
  resolveCtx?: ResolveCtx;
}

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
 */
export function researchedPracticeToNode(
  practice: AstgrepResearchedPractice,
  opts: ResearchToNodeOptions = {},
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
  const provReject = firstProvenanceRejection(practice.provenance, opts.resolveCtx);
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
 * source. A practice with ZERO provenance cannot be trusted (fail-closed). Tier-0 by default
 * (validateProvenance, allowlist.ts — zero fs); tiered when a ResolveCtx is supplied.
 */
function firstProvenanceRejection(
  provenance: Provenance[],
  resolveCtx?: ResolveCtx,
): string | null {
  if (provenance.length === 0) {
    return 'no provenance record — cannot resolve a trusted documentation source';
  }
  if (resolveCtx) {
    const resolved = resolveAllowedSources(resolveCtx);
    for (const p of provenance) {
      const d = validateProvenanceTiered(p, resolved);
      if (d !== null) return d.message;
    }
    return null;
  }
  for (const p of provenance) {
    const v = validateProvenance(p);
    if (!v.ok) return v.reason ?? 'provenance rejected';
  }
  return null;
}
