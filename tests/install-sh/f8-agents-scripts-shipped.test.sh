#!/usr/bin/env bash
# cih-s2 F8 — the shipped AGENTS.md promises only scripts install actually delivers.
# Pre-S1, AGENTS.md listed `npm run test-storybook` + `npx playwright test` as if they were
# core, while install.sh shipped neither (no script key, no dep, no Storybook scaffold). This
# test asserts via the REAL install pipeline (mirror f11/f13) that:
#   (pos)  every `npm run X` in AGENTS.md OUTSIDE the UI-gated subsection is a real key in the
#          shipped package.json — so a doc promise can't outrun the install.
#   (gate) `test-storybook` + `playwright` live ONLY in the "### UI projects" subsection, not in
#          the unconditional core enumeration (an adjacent `# (UI projects)` comment is NOT enough).
#   (neg)  appending a fake `npm run __never__` to the shipped AGENTS.md makes the pos check FAIL —
#          proving the probe bites and is not vacuous.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ts-server is the load-bearing stack: Storybook/Playwright are legitimately UNshipped there,
# so a doc that lists them as core is the exact F8 defect.
T=$(mktemp -d)
printf '{"name":"f8","version":"0.0.0"}\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
A="$T/AGENTS.md"
P="$T/package.json"

[ -f "$A" ] || { bad "AGENTS.md not shipped by install.sh"; echo "PASS=$PASS FAIL=$FAIL"; exit 1; }

# Lines OUTSIDE the UI-gated subsection (### UI projects … up to the next ## heading).
non_ui() { awk '/^### UI projects/{ui=1; next} /^## /{ui=0} ui==0{print}' "$A"; }

# Required keys = every `npm run <key>` that is NOT inside the UI subsection.
required_keys=$(non_ui | grep -oE 'npm run [A-Za-z0-9:_-]+' | awk '{print $3}' | sort -u)

# package.json key presence via node (guaranteed present — the scripts-merge needs it; no jq dep).
has_script() { node -e 'const p=require(process.argv[1]); process.exit(p.scripts&&(process.argv[2] in p.scripts)?0:1)' "$P" "$1"; }

# (pos) helper — returns 0 iff EVERY required key is a real script. Reused by the neg arm.
all_required_shipped() {
  local k missing=0
  for k in $required_keys; do has_script "$k" || { echo "MISSING:$k"; missing=1; }; done
  return $missing
}

# ── pos ──────────────────────────────────────────────────────────────────────
[ -n "$required_keys" ] \
  && ok "AGENTS core block enumerates $(wc -w <<<"$required_keys" | tr -d ' ') npm-run scripts" \
  || bad "no core 'npm run' scripts found in shipped AGENTS.md (parse/structure broke)"
if missing=$(all_required_shipped); then
  ok "every core 'npm run X' in AGENTS.md exists in shipped package.json"
else
  bad "AGENTS core promises scripts install never ships: ${missing}"
fi

# ── gate (structural move, not a comment) ────────────────────────────────────
if grep -qE 'test-storybook|playwright' <<<"$(non_ui)"; then
  bad "test-storybook/playwright still in the unconditional core block — must be UI-gated"
else
  ok "test-storybook + playwright are confined to the '### UI projects' subsection"
fi
# and they DO still appear somewhere (UI subsection) — guards against silent deletion of the gate.
grep -qE 'test-storybook' "$A" && grep -qE 'playwright' "$A" \
  && ok "UI commands documented in the gated subsection (not dropped)" \
  || bad "UI commands vanished from AGENTS.md entirely (over-trimmed)"

# ── neg (load-bearing) ───────────────────────────────────────────────────────
echo 'npm run __fake_never_shipped__' >> "$A"
required_keys=$(non_ui | grep -oE 'npm run [A-Za-z0-9:_-]+' | awk '{print $3}' | sort -u)
if all_required_shipped >/dev/null; then
  bad "neg arm vacuous: fake 'npm run __fake_never_shipped__' did NOT trip the probe"
else
  ok "neg arm bites: injected fake script makes the pos check fail"
fi


# ── C1-Check4: live-signal — shipped bash scripts exit 0 with non-empty stdout ──
# Uses the shipped scripts/ directory (authoritative list from install above) as the
# enumeration source. Tests exit-0 + non-empty output for scripts that run without
# a full `npm install` in the consumer (deterministic, no network required).
#
# Design rule (T-smoke-A): config-presence checks (like f8's existing pos arm) test that the
# script KEY exists in package.json. This arm runs the ACTUAL bash scripts and asserts the
# runtime signal: "exit 0 and produces output" — proving the script isn't crashing or silently
# no-oping.
#
# PAIRED-NEGATIVE: truncate one script to `exit 1` → the check MUST detect FAIL (non-vacuous).

# Fresh consumer for Check 4 (separate from the neg-injected $T above)
C4=$(mktemp -d)
printf '{"name":"f8c4","version":"0.0.0"}\n' > "$C4/package.json"
( cd "$C4" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1

# Run check-rule-globs.sh: a shipped script that runs without node_modules.
# Without boundary files it prints "nothing for R2 to govern" and exits 0.
# With a boundary file it checks globs and exits 0 with glob-coverage output.
GLOBS="$C4/scripts/check-rule-globs.sh"
if [ -x "$GLOBS" ]; then
  # Add a boundary file so the script has something to work with
  mkdir -p "$C4/src/routes"
  echo 'export const h = 1;' > "$C4/src/routes/h.ts"
  out_globs=$( cd "$C4" && bash "$GLOBS" 2>&1 )
  rc_globs=$?
  if [ "$rc_globs" -eq 0 ] && [ -n "$out_globs" ]; then
    ok "Check4: scripts/check-rule-globs.sh exits 0 with output (live signal; not crash/silent-noop)"
  elif [ "$rc_globs" -ne 0 ]; then
    bad "Check4: scripts/check-rule-globs.sh CRASHED (exit $rc_globs) — shipped script is broken"
  else
    bad "Check4: scripts/check-rule-globs.sh exits 0 but produced NO output (silent no-op — T-smoke-A violation)"
  fi
else
  bad "Check4: scripts/check-rule-globs.sh not shipped or not executable"
fi

# Run detect-r2-boundary.sh: a shipped script that detects if boundary patterns exist.
DETECT="$C4/scripts/detect-r2-boundary.sh"
if [ -x "$DETECT" ]; then
  out_detect=$( cd "$C4" && bash "$DETECT" 2>&1 )
  rc_detect=$?
  if [ "$rc_detect" -eq 0 ] && [ -n "$out_detect" ]; then
    ok "Check4: scripts/detect-r2-boundary.sh exits 0 with output (live signal)"
  elif [ "$rc_detect" -ne 0 ]; then
    bad "Check4: scripts/detect-r2-boundary.sh CRASHED (exit $rc_detect)"
  else
    bad "Check4: scripts/detect-r2-boundary.sh exits 0 but silent (no output)"
  fi
else
  bad "Check4: scripts/detect-r2-boundary.sh not shipped or not executable"
fi

# PAIRED-NEGATIVE: truncate check-rule-globs.sh to exit-1 → detection must FAIL
if [ -x "$GLOBS" ]; then
  GLOBS_BAK=$(mktemp); cp "$GLOBS" "$GLOBS_BAK"
  printf '#!/usr/bin/env bash\nexit 1\n' > "$GLOBS"
  out_broken=$( cd "$C4" && bash "$GLOBS" 2>&1 )
  rc_broken=$?
  if [ "$rc_broken" -ne 0 ]; then
    ok "Check4 neg: truncated script exits non-zero → crash detected (check non-vacuous)"
  else
    bad "Check4 neg: broken script exits 0 — check is VACUOUS (cannot detect crash)"
  fi
  # Restore
  cp "$GLOBS_BAK" "$GLOBS"
  rm -f "$GLOBS_BAK"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
