/**
 * authority.mjs — LIVE current-authority read for the autonomy binding.
 *
 * The binding never trusts its own cached authority snapshot as proof: every reconcile
 * re-reads the current-decisions selector through the INTENT HELPERS' own validators
 * (requireSelectorFeature + liveValidateCurrentPrd + liveValidateCurrentSpec), which
 * re-resolve the recorded ContentRefs through the shared digest-checking resolver
 * (resolveContentRef). This module is a thin adapter that maps the reused validators'
 * results into the record's authority projection — the SEMANTIC authority validation is
 * deliberately NOT duplicated here (plan §1: «Reuse current APIs; do not duplicate their
 * authority or semantic validators»).
 *
 * No caching, no fallback to the record's stored snapshot: a selector that cannot be
 * live-validated is `authority_unavailable`, and the caller holds.
 */
import {
  repoIdentityOf,
  requireSelectorFeature,
  liveValidateCurrentPrd,
  liveValidateCurrentSpec,
} from '../../../intent/helpers/current-decisions.mjs';

/**
 * Read the current authority for a feature. `roots` are the owner roots ContentRefs
 * resolve against (the repo checkout by default). Returns
 * {ok, authority: {repoIdentity, selectorRevision, prdSha256, prdRef, specSha256, specRef, checkedAt}}
 * or {ok: false, code, reason} with the reused validators' codes surfaced verbatim
 * (`selector_missing`, `feature_missing`, `prd_receipt_invalid:*`, `spec_agreement_missing`, …).
 */
export function readCurrentAuthority({ repoRoot, featureId, featureHome, roots, now }) {
  const identity = repoIdentityOf(repoRoot);
  if (!identity.ok) {
    return { ok: false, code: 'repo_identity_unresolvable', reason: identity.reason };
  }
  const selected = requireSelectorFeature(featureHome, identity.identity, featureId);
  if (!selected.ok) {
    return selected;
  }
  const { entry } = selected;
  // The intent helpers' `ok` spreads its payload (`{ok: true, ...value}`), so results are
  // read as `prd.currentPrd` / `spec.currentSpec` — no `.value` wrapper (current-decisions.mjs:96).
  const prd = liveValidateCurrentPrd(entry, roots);
  if (!prd.ok) return prd;
  const spec = liveValidateCurrentSpec(entry, roots, prd.currentPrd);
  if (!spec.ok) return spec;
  return {
    ok: true,
    authority: {
      repoIdentity: identity.identity,
      selectorRevision: entry.revision,
      prdSha256: prd.currentPrd.approvedSha256,
      prdRef: prd.currentPrd.snapshotRef,
      specSha256: spec.currentSpec.specRef.sha256,
      specRef: spec.currentSpec.specRef,
      checkedAt: now,
    },
  };
}

/**
 * Comparable signature of an authority projection — `undefined` when the projection is
 * absent. repoIdentity is PART of the comparable signature (A1-CODE-05): two repositories
 * with identical revision/PRD/spec hashes are NOT the same authority. The engine's
 * identity gate runs before any signature comparison, so this binding only sharpens the
 * changed-authority detection for callers comparing signatures directly.
 */
export function authoritySignature(authority) {
  if (!authority) return undefined;
  return [authority.repoIdentity, authority.selectorRevision, authority.prdSha256, authority.specSha256].join(':');
}
