#!/usr/bin/env bash
# Stage 1 acceptance — plugin/skills derived-copy generator (plugin-skills-generator umbrella).
# spec: docs/meta-factory/research-patches/2026-09-11-plugin-skills-generator-stage0-reverif.md §2 + §5
#
# Covers:
#   (1) real tree: generator exits 0 and is a byte-level no-op (regen writes nothing)
#   (2) transform parity (F2(c) gate): the generator's first 15 arms == setup.d/lib.sh's
#       transform_internal_refs arms; the 16th textstrip arm is the documented generator-only
#       divergence (lib.sh must NOT grow one without this test going RED)
#   (3) sandbox: created entry / in-sync no-op / tampered payload → exit 3, untouched /
#       stale payload after a committed source edit → re-synced
#   (4) sandbox: manual marker ≥20 chars → skipped untouched; short rationale → exit 2
#   (5) sandbox: plugin-native entries never touched
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
GEN="$REPO_ROOT/scripts/generate-plugin-skills.sh"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ── (1) real tree ─────────────────────────────────────────────────────────────
if bash "$GEN" >/dev/null 2>&1; then
  ok "generator exits 0 on the real tree"
else
  bad "generator non-zero exit on the real tree"
fi
if [ -z "$(git -C "$REPO_ROOT" status --porcelain -- plugin/skills)" ]; then
  ok "regeneration is a no-op on a clean tree"
else
  bad "regeneration wrote to a clean tree"
fi

# ── (2) transform parity ──────────────────────────────────────────────────────
arms_of() { # $1=file $2=sed range → one normalized arm per line (bash string ops: sed's
            # BRE chokes on the literal `${UPSTREAM_BLOB_URL}` braces in a s/// replacement)
  sed -n "$2" "$1" | grep -oE '\-e "[^"]*"' | while IFS= read -r l; do
    l=${l#-e \"}; l=${l%\"}; l=${l//'${UPSTREAM_BLOB_URL}'/AT-BLOB}
    printf '%s\n' "$l"
  done
}
lib_arms=$(arms_of "$REPO_ROOT/setup.d/lib.sh" '/^transform_internal_refs()/,/^}/p')
gen_arms=$(arms_of "$GEN" '/# BEGIN TRANSFORM ARMS/,/# END TRANSFORM ARMS/p')
lib_n=$(printf '%s\n' "$lib_arms" | grep -c .)
gen_n=$(printf '%s\n' "$gen_arms" | grep -c .)
if [ "$lib_n" -eq 15 ]; then
  ok "lib.sh transform exposes 15 arms"
else
  bad "lib.sh transform arm count changed: $lib_n (expected 15) — update the parity gate AND the generator"
fi
if [ "$(printf '%s\n' "$gen_arms" | head -15)" = "$(printf '%s\n' "$lib_arms")" ]; then
  ok "transform parity: generator arms 1-15 identical to setup.d/lib.sh"
else
  bad "transform parity FAILED — arm sets diverged (edit both in pairs: setup.d/lib.sh + generator header block)"
fi
if [ "$gen_n" -eq 16 ] && printf '%s\n' "$gen_arms" | sed -n '16p' | grep -qF '(\.\./)+'; then
  ok "16th textstrip arm present, generator-only as documented"
else
  bad "16th textstrip arm missing or lib.sh grew an arm ($gen_n generator arms vs $lib_n lib arms)"
fi

# ── sandbox helper ────────────────────────────────────────────────────────────
# A minimal git repo whose ENTRY TABLE is overridden to a single probe entry, so the real
# tree (and the real table) are never touched: CLAUDE_PROJECT_DIR pins REPO_ROOT to the box.
mk_sandbox() {
  local sb="$1"
  mkdir -p "$sb/skills/probe-a" "$sb/plugin/skills"
  sed 's/  "getff|skills|transform+textstrip"/  "probe-a|skills|byte-copy"/; /"tool-bootstrapping|skills|byte-copy"/d' "$GEN" > "$sb/gen.sh"
  printf '# probe source v1\n' > "$sb/skills/probe-a/SKILL.md"
  git -C "$sb" init -q
  git -C "$sb" add -A
  git -C "$sb" -c user.email=t@t -c user.name=test commit -qm init
}
sb_run() { CLAUDE_PROJECT_DIR="$1" bash "$1/gen.sh" 2>/dev/null; }

# ── (3) lifecycle: created → no-op → tamper → stale ──────────────────────────
SB="$TMP/lifecycle"
mk_sandbox "$SB"
if sb_run "$SB" && [ -f "$SB/plugin/skills/probe-a/SKILL.md" ]; then
  ok "sandbox: absent table entry is created"
else
  bad "sandbox: absent table entry NOT created"
fi
git -C "$SB" add -A; git -C "$SB" -c user.email=t@t -c user.name=test commit -qm "payload created"
sb_run "$SB"
if [ -z "$(git -C "$SB" status --porcelain)" ]; then
  ok "sandbox: second run is a no-op"
else
  bad "sandbox: second run wrote to a in-sync tree"
fi
printf 'TAMPER\n' >> "$SB/plugin/skills/probe-a/SKILL.md"
sb_rc=0; sb_run "$SB" || sb_rc=$?
if [ "$sb_rc" -eq 3 ] && grep -q TAMPER "$SB/plugin/skills/probe-a/SKILL.md"; then
  ok "sandbox: tampered payload → exit 3, content preserved (clobber guard)"
else
  bad "sandbox: tampered payload NOT guarded (rc=$sb_rc)"
fi
git -C "$SB" checkout -q -- plugin/skills/probe-a/SKILL.md
# Stale case, in the flow the pre-commit arm actually produces: source edit STAGED (wt=v2,
# HEAD=v1), payload still v1 → matches the HEAD render → guard allows the re-sync. (A
# source-only COMMIT first would leave the payload matching neither render — the same
# deliberate sharp edge twins documents: "commit the reduction first".)
printf '# probe source v2\n' > "$SB/skills/probe-a/SKILL.md"
git -C "$SB" add -A
if sb_run "$SB" && grep -q "source v2" "$SB/plugin/skills/probe-a/SKILL.md"; then
  ok "sandbox: stale payload re-synced with the source edit staged (pre-commit flow)"
else
  bad "sandbox: stale payload NOT re-synced"
fi
git -C "$SB" add -A; git -C "$SB" -c user.email=t@t -c user.name=test commit -qm "source v2 + payload"

# ── (4) manual escape hatch ───────────────────────────────────────────────────
SB2="$TMP/manual"
mk_sandbox "$SB2"
sb_run "$SB2"
printf '# probe source (hand-maintained fork)\n' > "$SB2/skills/probe-a/SKILL.md"
printf '# deliberately hand-maintained payload content\n' > "$SB2/plugin/skills/probe-a/SKILL.md"
git -C "$SB2" add -A; git -C "$SB2" -c user.email=t@t -c user.name=test commit -qm diverged
printf '<!-- @plugin-skills: manual — payload intentionally hand-maintained for this test -->\n' >> "$SB2/skills/probe-a/SKILL.md"
m_rc=0; sb_run "$SB2" || m_rc=$?
if [ "$m_rc" -eq 0 ] && grep -q "hand-maintained payload content" "$SB2/plugin/skills/probe-a/SKILL.md"; then
  ok "sandbox: manual marker (>=20-char rationale) skips, payload untouched"
else
  bad "sandbox: manual marker NOT honored (rc=$m_rc)"
fi
printf '<!-- @plugin-skills: manual — short -->\n' > "$SB2/skills/probe-a/SKILL.md"
s_rc=0; sb_run "$SB2" || s_rc=$?
if [ "$s_rc" -eq 2 ]; then
  ok "sandbox: short manual rationale → exit 2"
else
  bad "sandbox: short manual rationale NOT rejected (rc=$s_rc)"
fi

# ── (5) plugin-native entries never touched (in the lifecycle sandbox, in-sync state) ──
mkdir -p "$SB/plugin/skills/probe-native"
printf '# native skill body\n' > "$SB/plugin/skills/probe-native/SKILL.md"
git -C "$SB" add -A; git -C "$SB" -c user.email=t@t -c user.name=test commit -qm native
sb_run "$SB" >/dev/null 2>&1
if grep -q "# native skill body" "$SB/plugin/skills/probe-native/SKILL.md"; then
  ok "sandbox: plugin-native entry untouched"
else
  bad "sandbox: plugin-native entry was modified"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
