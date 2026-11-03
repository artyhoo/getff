#!/usr/bin/env bash
# Batch E replay — emitted-output family: A12-class corruption of a fenced region.
#
# Seed A12 (spec §7): `packages/core/composition/fence.ts` TOLERATES a `hash=sha256:x`
# attribute on an input begin marker but NEVER emits or verifies one (the WI-1
# forward-compat seam). This replay characterizes, through the REAL fence.ts modules
# (no reimplementation, no mock):
#
#   arm 1 — WHAT CATCHES IT TODAY: body drift inside a region is caught by
#           `regionsMatch` (byte-identical body comparison) → `body-drift-caught=true`.
#   arm 2 — THE DEMONSTRATED GAP: a begin marker carrying a CORRUPTED `hash=sha256:<64
#           zeros>` attribute parses fine, the attribute is even exposed on the parsed
#           region, and `regionsMatch` still reports a match — integrity metadata that
#           nothing verifies cannot fail any check.
#
# This is a CHARACTERIZATION, not a kill: the honest classification is a demonstrated
# gap (spec §5 Q6 emitted-output lane) queued to the blocking dispositions queue for S2 —
# NO out-of-scope repair is attempted here, and no CI arm asserts the gap stays broken
# (that would punish the fix). Exit 0 means "characterization reproduced", never "gate green".
#
# Runs against the MAIN checkout read-only (pure functions, no files mutated).
#
# Exit: 0 characterization reproduced · 1 characterization drifted · 3 infrastructure.

set -uo pipefail
# shellcheck source=../counterfactuals/counterfactual-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../counterfactuals/counterfactual-lib.sh"

FENCE_REL="packages/core/composition/fence.ts"
[ -f "$CF_REPO_ROOT/$FENCE_REL" ] || infra "fence module missing: $FENCE_REL"

PROBE_DIR="$CF_REPO_ROOT/.ai-factory"
mkdir -p "$PROBE_DIR" || infra "cannot create probe dir: $PROBE_DIR"
git -C "$CF_REPO_ROOT" check-ignore -q "$PROBE_DIR/.probe" || infra "$PROBE_DIR is not gitignored — refusing to write a probe into the tracked tree"
PROBE="$(mktemp "$PROBE_DIR/s1-batch-e-a12-XXXXXX.mts")"
cleanup() { rm -f "$PROBE" "$PROBE.err"; }
trap cleanup EXIT

cat >"$PROBE" <<'EOF'
import { findRegions, injectRegion, regionsMatch } from '../packages/core/composition/fence.ts';

// Build a healthy composed region through the REAL injector.
const content = 'A12 replay: rendered region body (committed by the plan owner)';
const composed = injectRegion('# Host document\n', 's1-a12-probe', 'plans/a12.md', content);

// Sanity: the healthy composition matches its plan.
const healthy = regionsMatch(composed, new Map([['s1-a12-probe', content]]));
console.log(`A12-CHARACTERIZATION healthy-match=${healthy}`);

// arm 1 — body drift IS caught today (the byte-identical comparison).
const drifted = composed.replace(content, `${content} TAMPERED`);
const driftCaught = regionsMatch(drifted, new Map([['s1-a12-probe', content]])) === false;
console.log(`A12-CHARACTERIZATION body-drift-caught=${driftCaught}`);

// arm 2 — the WI-1 seam: a corrupted `hash=` attribute on the begin marker.
const zeros = '0'.repeat(64);
const corrupted = composed.replace('plan=plans/a12.md', `plan=plans/a12.md hash=sha256:${zeros}`);
const parsedHash = findRegions(corrupted)[0]?.attributes['hash'] ?? 'ABSENT';
console.log(`A12-CHARACTERIZATION hash-attribute-parsed=${parsedHash === `sha256:${zeros}`}`);
// The corrupted-integrity composition STILL matches its plan — nothing verifies the hash.
const corruptedStillMatches = regionsMatch(corrupted, new Map([['s1-a12-probe', content]]));
console.log(`A12-CHARACTERIZATION corrupted-hash-still-matches=${corruptedStillMatches}`);
EOF

echo "== phase: A12 characterization through the real fence.ts modules (read-only) =="
OUT="$("$CF_TSX" "$PROBE" 2>"$PROBE.err")" || infra "A12 probe crashed: $(tail -3 "$PROBE.err" | tr '\n' ' ')"
echo "$OUT"

echo "$OUT" | grep -qF 'healthy-match=true' || die "baseline sanity failed: healthy composition did not match its plan"
echo "$OUT" | grep -qF 'body-drift-caught=true' || die "arm 1 drifted: body drift is no longer caught by regionsMatch — Batch-C/D premise changed"
echo "$OUT" | grep -qF 'hash-attribute-parsed=true' || die "arm 2 drifted: the hash attribute is no longer even parsed — the seam may have been closed (check the dispositions queue)"
echo "$OUT" | grep -qF 'corrupted-hash-still-matches=true' \
  || die "arm 2 drifted: corrupted hash NO LONGER matches — the WI-1 seam appears closed; update the disposition record instead of failing"

echo "== phase: main checkout untouched (read-only characterization) =="
[ -z "$(git -C "$CF_REPO_ROOT" status --porcelain "$FENCE_REL")" ] \
  || die "main checkout fence.ts is dirty — characterization is read-only by contract"

cat <<'SUMMARY'
A12-EMITTED-CORRUPTION VERDICT: pass-as-CHARACTERIZATION
  - caught today:        body drift (regionsMatch byte comparison) — arm 1
  - demonstrated gap:    a corrupted hash= attribute parses, is exposed, and cannot
                         fail any check (never verified) — arm 2, the WI-1 seam
  - classification:      SURVIVED (demonstrated gap) → blocking dispositions queue,
                         S2 obligation; NO repair attempted in S1 (out of scope)
SUMMARY
exit 0
