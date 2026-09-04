#!/usr/bin/env bash
# FQA S3-C1 — "de-inert the shipped quality gates". Asserts install.sh lands the WIRING the
# rules need (not just the rule files): P1 tool-decisions seed, P2 all 3 skill-context, W1
# generated eslint barrel, W2 dep-cruiser config, W4 package.json scripts. Plus the P1
# PAIRED-NEGATIVE (umbrella §5): WITHOUT the seed the deps-change hook is silent (the dead
# state the audit found); WITH it, a deps change WARNs (the chain is live). The negative arm
# is what proves the fix isn't vacuous — it fails if the seed stops mattering.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

T=$(mktemp -d)
printf '{ "name": "c1t", "version": "0.0.0", "scripts": { "test": "echo keep" } }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1

# P1 — seed lands so deps-hash-check.sh no longer short-circuits to silent exit 0
[ -f "$T/.ai-factory/tool-decisions.md" ] && ok "P1: tool-decisions.md seeded" || bad "P1: tool-decisions.md missing"

# P2 — the 2 default skill-context land (verify-list ↔ copy-list single-sourced);
# aif-orchestrator-discipline is AIF-suite-gated (F7 agents arm) — absent by default,
# flag-gated presence asserted in with-aif-suite-flag.test.sh.
n=$(find "$T/.ai-factory/skill-context" -name SKILL.md 2>/dev/null | wc -l | tr -d ' ')
[ "$n" = "2" ] && ok "P2: 2/2 default skill-context landed" || bad "P2: $n/2 default skill-context"
[ ! -f "$T/.ai-factory/skill-context/aif-orchestrator-discipline/SKILL.md" ] && ok "P2: aif-orchestrator-discipline absent by default (suite-gated)" || bad "P2: aif-orchestrator-discipline leaked into default install"

# W1 — compiled ESM barrel generated, valid, covers every landed rule file (eslint.config imports it)
[ -f "$T/eslint-rules-local/index.mjs" ] && ok "W1: eslint ESM barrel generated" || bad "W1: eslint ESM barrel missing (S2 fix)"
grep -q 'export default plugin' "$T/eslint-rules-local/index.mjs" 2>/dev/null && ok "W1: barrel exports a plugin" || bad "W1: barrel malformed"
nf=$(find "$T"/eslint-rules-local -maxdepth 1 -name '*.ts' ! -name 'index.ts' ! -name '*.d.ts' | wc -l | tr -d ' ')
ni=$(grep -c '^import ' "$T/eslint-rules-local/index.mjs")
[ "$nf" = "$ni" ] && [ "$nf" -ge 4 ] && ok "W1: barrel covers all $nf rule files" || bad "W1: barrel $ni imports vs $nf rule files"

# W2 — arch config lands so arch:check has something to run against
[ -f "$T/.dependency-cruiser.cjs" ] && ok "W2: .dependency-cruiser.cjs landed" || bad "W2: .dependency-cruiser.cjs missing"

# W4 — canonical scripts merged non-destructively (existing kept, gate scripts added)
node -e 'const s=require(process.argv[1]).scripts||{}; process.exit((s.lint&&s["arch:check"]&&s.validate&&s["test:coverage"]&&s.test==="echo keep")?0:1)' "$T/package.json" \
  && ok "W4: canonical scripts merged, existing 'test' kept" || bad "W4: scripts merge wrong"

# P1 PAIRED-NEGATIVE — the load-bearing arm
HOOK="$REPO_ROOT/.claude/hooks/deps-hash-check.sh"
N=$(mktemp -d); printf '{ "name":"n","version":"0.0.0","dependencies":{"x":"1"} }\n' > "$N/package.json"
out_neg=$( cd "$N" && echo '{}' | bash "$HOOK" 2>&1 )
[ -z "$out_neg" ] && ok "P1-neg: no tool-decisions.md → hook SILENT (reproduces the dead state)" || bad "P1-neg: hook spoke without a seed: $out_neg"
out_pos=$( cd "$T" && echo '{}' | bash "$HOOK" 2>&1 )
echo "$out_pos" | grep -qi 'tool-bootstrap' && ok "P1-pos: seed + sentinel hash → WARN (chain is LIVE)" || bad "P1-pos: no WARN with seed present"


# ── C1-548: live-signal Check 1 — shipped hook emits NO false-warn on fresh install (#548) ──
# The #548 gap: on a fresh install the stored deps-hash sentinel (`<pending>`) mismatched any
# computed hash → hook printed "deps changed since last tool-bootstrap" even though nothing
# changed. The shipped fix (packages/core/hooks/deps-hash-check.sh) distinguishes sentinel from
# a real sha256- baseline, printing "not yet baselined" instead. This check asserts the runtime
# signal: the shipped hook MUST NOT emit "deps changed" on a freshly-installed consumer.
# Paired-negative proves non-vacuity: a stored sha256 that mismatches current deps MUST emit
# "deps changed" (a real drift, not a fresh-install false-warn).
C548=$(mktemp -d)
printf '{ "name": "c548t", "version": "0.0.0", "dependencies": { "lodash": "4.17.21" } }\n' > "$C548/package.json"
( cd "$C548" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
HOOK_C548="$C548/.claude/hooks/deps-hash-check.sh"

if [ -x "$HOOK_C548" ]; then
  # POSITIVE: fresh install → hook MUST NOT emit "deps changed" (that was the #548 false-warn)
  out_c548=$( cd "$C548" && bash "$HOOK_C548" 2>&1 )
  if echo "$out_c548" | grep -q 'deps changed'; then
    bad "C1-548: fresh install → 'deps changed' false-warn (reproduces #548; shipped hook missing the fix)"
  else
    ok "C1-548: fresh install → NO 'deps changed' false-warn (#548 fix live; output: '$(echo "$out_c548" | tr '\n' '|')')"
  fi

  # PAIRED-NEGATIVE: store a sha256 hash that mismatches → hook MUST emit "deps changed"
  # (proves the check is non-vacuous: real deps drift IS still caught)
  if [ -f "$C548/.ai-factory/tool-decisions.md" ]; then
    # Portable in-place edit: BSD sed (macOS) and GNU sed (Linux CI) disagree on `sed -i`
    # syntax — BSD reads the next token as a backup suffix, so `sed -i 's/…/…/' file` errors
    # and never mutates the file, making this negative arm VACUOUS on macOS (spurious FAIL).
    # Write to a sibling temp file and move it back — works identically on both seds.
    # NOTE (DH-S1 round-3.5): the install template now seeds BOTH deps-hash-npm: AND the legacy
    # bare deps-hash:; the hook reads deps-hash-npm: with precedence (design §3a M1). To prove
    # real-drift detection non-vacuously, BOTH keys must carry the mismatched sha256 — otherwise
    # the <pending>-seeded deps-hash-npm: shadows the drifted legacy key and the WARN wording is
    # "not yet baselined" (honest for unbaselined), not "deps changed". Replace both lines.
    TDM_NEG="$C548/.ai-factory/tool-decisions.md"
    sed -e 's/^deps-hash-npm:.*/deps-hash-npm: sha256-0000000000000000000000000000000000000000000000000000000000000000/' \
        -e 's/^deps-hash:.*/deps-hash: sha256-0000000000000000000000000000000000000000000000000000000000000000/' \
      "$TDM_NEG" > "$TDM_NEG.tmp" && mv "$TDM_NEG.tmp" "$TDM_NEG"
    out_c548_neg=$( cd "$C548" && bash "$HOOK_C548" 2>&1 )
    if echo "$out_c548_neg" | grep -q 'deps changed'; then
      ok "C1-548-neg: mismatched sha256 → 'deps changed' WARN (non-vacuous: real drift IS caught)"
    else
      bad "C1-548-neg: mismatched sha256 → no warn (check VACUOUS — cannot detect real deps drift)"
    fi
  else
    bad "C1-548-neg: tool-decisions.md not seeded — cannot run paired-negative"
  fi
else
  bad "C1-548: deps-hash-check.sh not shipped to consumer by install.sh"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
