// Composition plane — the executable AI-doc surface (MT umbrella S4, Surface 3).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1
//   (MT-AIDOC-COMPOSITION-DESIGN, 2026-07-03).
//
// Plane ABOVE the backends: an AGENTS.md paragraph, a clippy.toml entry, and a firing test
// become THREE renders of ONE ConventionNode. A DocPlan composes nodes into fenced regions
// whose `Enforced:` lines are COMPUTED from live RenderOutcomes + capability matrices — a doc
// cannot silently lie about its enforcement.
//
// Node-shape discipline (T-MT-B): NOTHING beyond this contract. Grouping nodes into sections
// is judgment → it lives in committed, reviewable DocPlan data (prior art unanimous: DITA maps,
// Redoc x-tagGroups, Sphinx toctree — SSOT #202). NO connectiveProse / order / provenance on a
// section: a field read by only one backend is a REJECT. v1 has NO free prose inside a region.

/** One themed section of the composed doc: a title + the node ids it renders, in order. */
export interface Section {
  /** Slug, unique across the plan. Schema-pinned to ^[a-z0-9-]+$. */
  sectionId: string;
  title: string;
  /** The node ids this section renders (minItems 1). */
  nodeIds: string[];
}

/**
 * An explicit, reasoned opt-out: a scoped node deliberately NOT documented in any section.
 * attention-is-not-a-mechanism — silence about an undocumented node is impossible; the reason
 * is a committed, reviewable justification. Shape (schema): a non-empty string. The ≥20-char
 * SUBSTANCE floor is a SEMANTIC check owned by the composition gate (FF8002, reason < 20 chars)
 * — kept out of the schema so a too-short reason reaches FF8002 rather than collapsing to a
 * generic FF1001 shape violation (documents-lie-tests-don't: the specific code is the honest one).
 */
export interface ExcludedNode {
  nodeId: string;
  reason: string;
}

/**
 * The doc-as-data plan. Grouping is judgment (committed data); rendering is a pure function.
 * An LLM may DRAFT a DocPlan session-side (provenance-gated); CI only ever re-renders it.
 */
export interface DocPlan {
  sections: Section[];
  excluded?: ExcludedNode[];
}

/**
 * The computed enforcement token for ONE (node × backend) cell — the atom of the `Enforced:`
 * line. NEVER hand-written (T-S4-A): every token is derived from the backend's RenderOutcome +
 * capability matrix by enforcement-line.ts. `backend` carries lexicographic-ordering identity.
 */
export interface EnforcementToken {
  backend: string;
  /** The rendered `Enforced:`-line segment for this backend, e.g. `npm ✅` or `cargo — FF7001 (note)`. */
  segment: string;
}
