// Rust live-research → ConventionNode bridge (clippy backend) — live-generation umbrella (LG-S3, Inc 1).
// Spec: docs/meta-factory/research-patches/2026-07-11-live-generation.md §Qb (frozen-IR expressibility
// ceiling + MAJOR-1 filter), §Qc (rust Tier-0 keys as data), §Qf/LG-S3.
// Prior-art: docs/meta-factory/prior-art-evaluations.md#219 (stack-agnostic autogeneration core —
// this is the rust thin adapter's authoring half) + #197 (cargo `Cargo.toml` metadata trust source,
// the ecosystem-cargo adapter this bridge's Tier-0 provenance path composes with).
//
// WHAT THIS IS: the clippy-shaped SIBLING of research-to-node.ts (the astgrep bridge, LG-S1). Same
// thin projection «a researched practice → a ConventionNode (frozen IR) routed to the stack's
// backend», but authored for the ADOPTED cargo clippy.toml backend (backends/cargo/render-clippy.ts,
// #977-owned, READ-ONLY here) rather than the ast-grep backend. It authors ONE neutral node from ONE
// researched rust practice and hands it to the (verbatim, pure) `renderCargoClippy` backend the caller
// then invokes. It does NOT render, write files, or touch the network — same purity contract as the
// renderers (render-clippy.ts:4).
//
// WHY A NEW SIBLING (not an extension of research-to-node.ts): the astgrep bridge is hard-coded to
// clippy-incompatible values — `selectorClass:'syntax'` (research-to-node.ts:167, which render-clippy
// REFUSES with FF7001), astgrep kinds `{call,attribute,import}` + a `pattern` param, and a default
// severity of `'error'` (research-to-node.ts:150, which render-clippy DEGRADES with FF7003). Clippy's
// RENDER CONTRACT (Phase-1-grounded, render-clippy.ts:81-133) needs ALL of: `selectorClass:'type-aware'`,
// `params:{kind ∈ {method,type,macro}, path:<FQ-path>}` (a fully-qualified path to ban, NOT an astgrep
// pattern), `defaultSeverity:'warning'` (→ `rendered`; `error`/`note` → `degraded`). Extending the
// astgrep bridge to carry both shapes would risk the landed LG-S1 for zero reuse gain. So this is a
// sibling that REUSES the frozen `ConventionNode` IR, `runGrammarGate`, `validateProvenance`, and the
// exported `ResearchOnlyReason`/`ResearchToNodeResult` result types (research-to-node.ts:80-84).
//
// TWO HONESTY LINES, both non-negotiable (§Qb + Phase -1), identical to the astgrep lane:
//   1. Degrade-not-inert (MAJOR-1): a practice that does NOT reduce to a single clippy path-ban of
//      kind method/type/macro is dropped to a RESEARCH-ONLY FINDING *before* node construction —
//      NEVER emitted as an inert node.
//   2. The bridge validates provenance ITSELF (the grammar gate does NOT check the provenance host).
//      A practice whose provenance does not resolve to a trusted Tier-0 source is a research-only
//      finding, never a trusted node.

import type { Severity } from '../diagnostics/types.ts';
import type { ConventionNode } from '../ir/types.ts';
import { runGrammarGate } from '../ir/gates/grammar.ts';
import { validateProvenance } from '../research/allowlist.ts';
import type { Provenance } from '../research/types.ts';
import type { ResearchOnlyReason, ResearchToNodeResult } from './research-to-node.ts';

// Re-export the shared result vocabulary so callers can import the clippy lane's types from one place
// without depending on the astgrep bridge module name. The types themselves are REUSED verbatim.
export type { ResearchOnlyReason, ResearchToNodeResult } from './research-to-node.ts';

/** The frozen-IR-expressible clippy node kinds. Kept in lockstep with render-clippy.ts:40's private
 *  `VALID_KINDS` — a practice whose `kind` is outside this set cannot be honestly rendered as a
 *  clippy disallowed-{methods,types,macros} path-ban (§Qb).
 *
 *  DRIFT-PARITY GAP (Phase-1, deliberate): render-clippy.ts:40 does NOT export its `VALID_KINDS`
 *  (unlike render-astgrep.ts, whose `VALID_KINDS` LG-S1 exported so the bridge asserts set-equality).
 *  Exporting it would be a `backends/cargo/**` edit = a cross-owner boundary violation (#977-owned).
 *  So this constant is hard-coded here with a comment ref to render-clippy.ts:40, and the set-equality
 *  drift-parity test the astgrep lane has is a DOCUMENTED GAP (a cross-owner handoff request to #977,
 *  NOT silently dropped honesty). If a kind is added to render-clippy's VALID_KINDS but not here, an
 *  expressible practice for it degrades to research-only (conservative — never an inert node); if added
 *  here but not there, the built node is REFUSED FF7002 at render time (surfaced, not silent). */
export const CLIPPY_EXPRESSIBLE_KINDS: readonly string[] = ['method', 'type', 'macro'];

/**
 * A researched rust practice, clippy-shaped — the bridge's OWN input interface (not a frozen type).
 * Sibling of `AstgrepResearchedPractice` (research-to-node.ts:50): the frozen-IR `kind` discriminator
 * plus clippy's `path` (a fully-qualified path to ban, e.g. `std::mem::forget`) in place of astgrep's
 * `pattern`. Only the OUTPUT node is frozen.
 */
export interface ClippyResearchedPractice {
  /** ResearchEntry.id — becomes ConventionNode.id (namespaced, e.g. 'mem-forget'). */
  entryId: string;
  /** Human claim — becomes ConventionNode.claim AND the rendered clippy `reason`. */
  title: string;
  /** Enrichment the node backbone does NOT carry (parity with GenerateCandidate.stack); kept on the
   *  input for the caller, never projected onto the node. */
  stack: string[];
  /** clippy disallowed-table kind. Only CLIPPY_EXPRESSIBLE_KINDS are frozen-IR-expressible; any other
   *  value (or a non-string) routes the practice to a research-only finding (§Qb ceiling). Typed wide
   *  on purpose so an inexpressible kind (e.g. a structural trait-impl ban) is REPRESENTABLE — the
   *  MAJOR-1 filter must be non-vacuous. */
  kind: 'method' | 'type' | 'macro' | (string & {});
  /** Forbid-class signal (MAJOR-1). A clippy disallowed-table entry is a ban by definition, so a
   *  practice is expressible ONLY when presence:'forbid' AND a literal FQ path is present. */
  presence?: 'forbid';
  /** The single fully-qualified path to ban (e.g. 'std::mem::forget') — becomes params.path.
   *  Absent/empty ⇒ not single-path-expressible ⇒ research-only finding (§Qb). */
  path?: string;
  /** Optional replacement path — becomes params.replacement (the clippy `replacement:`) when present. */
  replacement?: string;
  /** Paired examples — become ConventionNode.pairedExamples (bad → negative, good → positive). */
  examples: { bad: string; good: string };
  /** Provenance chain — VALIDATED by the bridge's Tier-0 validateProvenance call. */
  provenance: Provenance[];
  /** Rendered-rule severity; defaults to 'warning' — the ONLY severity render-clippy renders (not
   *  degrades) into clippy.toml (render-clippy.ts:119). 'error'/'note' degrade FF7003. */
  defaultSeverity?: Severity;
}

/**
 * §Qb MAJOR-1 expressibility filter: true iff the practice reduces to a single clippy path-ban of a
 * method/type/macro kind. This is the frozen-IR ceiling made testable — everything else is a
 * research-only finding. Sibling of isSinglePatternExpressible (research-to-node.ts:91).
 */
export function isClippyExpressible(p: ClippyResearchedPractice): boolean {
  return (
    p.presence === 'forbid' &&
    typeof p.path === 'string' &&
    p.path.length > 0 &&
    typeof p.kind === 'string' &&
    CLIPPY_EXPRESSIBLE_KINDS.includes(p.kind)
  );
}

/**
 * Project one researched rust practice to a `ConventionNode`, or degrade it to a research-only
 * finding. Order matters (Phase -1): expressibility (§Qb) → provenance host-tier (the bridge's own
 * resolver call) → grammar-gate shape. Each failure is an honest research-only finding, never an
 * inert node.
 */
export function researchedPracticeToClippyNode(
  practice: ClippyResearchedPractice,
): ResearchToNodeResult {
  // 1. Degrade-not-inert (MAJOR-1 §Qb) — BEFORE node construction.
  if (!isClippyExpressible(practice)) {
    return {
      status: 'research-only',
      entryId: practice.entryId,
      reason: 'not-expressible',
      detail:
        `not single-path method/type/macro-ban expressible ` +
        `(kind=${String(practice.kind)}, presence=${String(practice.presence)}, ` +
        `path=${practice.path ? 'present' : 'absent'}) — §Qb frozen-IR ceiling`,
    };
  }

  // 2. Trust gate — the bridge validates provenance itself (grammar gate does NOT check host).
  const provReject = firstProvenanceRejection(practice.provenance);
  if (provReject !== null) {
    return {
      status: 'research-only',
      entryId: practice.entryId,
      reason: 'provenance-rejected',
      detail: provReject,
    };
  }

  const node = buildClippyNode(practice);

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

// The ONLY severity render-clippy.ts renders (not degrades) into clippy.toml (render-clippy.ts:119).
const DEFAULT_SEVERITY: Severity = 'warning';

/** Build the frozen ConventionNode from an already-expressible practice (params guaranteed present by
 *  isClippyExpressible). NO field added to the frozen IR — selectorClass is 'type-aware' (the clippy
 *  render class per render-clippy.ts:95) and params carry the {kind, path} the backend validates. */
function buildClippyNode(practice: ClippyResearchedPractice): ConventionNode {
  const params: Record<string, string | number> = {
    kind: practice.kind,
    path: practice.path as string,
  };
  if (practice.replacement !== undefined) {
    params['replacement'] = practice.replacement;
  }
  return {
    id: practice.entryId,
    claim: practice.title,
    anchors: [],
    selectorClass: 'type-aware',
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
 * Return the first provenance rejection reason, or null if every record resolves to a trusted source.
 * A practice with ZERO provenance cannot be trusted (fail-closed). Tier-0 only (validateProvenance,
 * allowlist.ts — zero fs). Re-implemented locally because the astgrep bridge's `firstProvenanceRejection`
 * is module-private (research-to-node.ts:183) — a ~10-line loop, cheaper to mirror than to export.
 */
function firstProvenanceRejection(provenance: Provenance[]): string | null {
  if (provenance.length === 0) {
    return 'no provenance record — cannot resolve a trusted documentation source';
  }
  for (const p of provenance) {
    const v = validateProvenance(p);
    if (!v.ok) return v.reason ?? 'provenance rejected';
  }
  return null;
}
