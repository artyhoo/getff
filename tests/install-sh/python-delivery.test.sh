#!/usr/bin/env bash
# tests/install-sh/python-delivery.test.sh — Python delivery layer + collision-matrix + live-fire.
#
# Covers setup.d/45-python.sh (python-delivery-v0 S1 Task 5): the pure-bash augment-first delivery
# of the pre-rendered Python lint bundle, probe-decided per .superpowers/sdd/task-2-report.md.
#
# DETERMINISTIC arms (always run — the load-bearing CI signal):
#   inertness   — sourcing the layer with no GETFF_TOOLCHAIN writes NOTHING (npm-flow inert); paired
#                 with a positive-activation arm proving the guard fires when GETFF_TOOLCHAIN=python.
#   (i)  fresh dir                       → whole-file copy; no getff-ruff.toml.
#   (ii) pre-existing sgconfig block-list → STRUCTURAL merge into ruleDirs (idempotent on re-run).
#   (ii) pre-existing sgconfig flow-list  → REFUSE-LOUDLY, file untouched, rules dir still delivered.
#   (iii) pre-existing ruff.toml          → REFUSE-LOUDLY, ruff.toml untouched, getff-ruff.toml shipped,
#                                           `extend` instructions (+ scalar caveat if extend present).
#   (iv) pre-existing pyproject [tool.ruff] → REFUSE-LOUDLY, NO ruff.toml written, getff-ruff.toml shipped.
#   (v)  re-run                          → delivered config artefacts byte-identical (idempotent).
#   .prettierignore                       → append `.getff/` if one exists (idempotent); never created.
#
# LIVE-FIRE arms (GATED on tool availability, like packages/core/backends/cargo/firing.test.ts gates
#   on cargoPresent — CI may lack uvx): all 4 shipped ast-grep rules fire RED on planted violations,
#   both ruff TID bans fire RED. When the pinned tool cannot be obtained → SKIP loudly (never RED);
#   the deterministic assertions above carry the CI signal.
#
# TDD seam: PY_LAYER_UNDER_TEST overrides the layer path (default = the real layer). Used during
#   development to point the merge/refuse arms at a naive copy-only stub → they go RED, proving the
#   assertions discriminate the augment/refuse logic (RED-before-GREEN evidence in task-5-report.md).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { echo "  · $1"; }

TPL="$REPO_ROOT/packages/core/templates/python"
LAYER="${PY_LAYER_UNDER_TEST:-$REPO_ROOT/setup.d/45-python.sh}"
LOG_NAME=".getff-python-install.log"

# ── Dispatcher-scope globals the layer + lib helpers read ─────────────────────
PKG_ROOT="$REPO_ROOT"
PROJECT_ROOT=""
FORCE=""
DRY_RUN=""
SKIPPED=()
export INSTALL_SH_LIB_ONLY=1
# shellcheck source=/dev/null
source "$REPO_ROOT/setup.d/lib.sh"
export PY_LAYER_LIB_ONLY=1
# shellcheck source=/dev/null
source "$LAYER"

# run_delivery <project_root> — set globals + run the layer entrypoint; echo captured stdout+stderr.
run_delivery() {
  PROJECT_ROOT="$1"
  SKIPPED=()
  deliver_python_toolchain 2>&1
}

# fingerprint of delivered CONFIG artefacts (EXCLUDES the running audit log).
config_fingerprint() {
  find "$1" -type f -not -name "$LOG_NAME" 2>/dev/null | LC_ALL=C sort | while IFS= read -r f; do
    if command -v shasum >/dev/null 2>&1; then
      printf '%s  %s\n' "$(shasum -a 256 "$f" | awk '{print $1}')" "${f#"$1/"}"
    else
      printf '%s  %s\n' "$(md5 -q "$f" 2>/dev/null || echo NOHASH)" "${f#"$1/"}"
    fi
  done
}

echo "▶ Python delivery layer — collision matrix ($(basename "$LAYER"))"
echo ""

# ── Inertness (npm-flow): plain source with no GETFF_TOOLCHAIN writes NOTHING ──
echo "  ── inertness (npm flow untouched) ──"
INERT_P=$(mktemp -d)
inert_out=$(
  PROJECT_ROOT="$INERT_P"; SKIPPED=(); FORCE=""; DRY_RUN=""
  unset GETFF_TOOLCHAIN 2>/dev/null || true
  unset PY_LAYER_LIB_ONLY 2>/dev/null || true   # source as install.sh would (auto-guard path)
  # shellcheck source=/dev/null
  source "$LAYER"
  ls -A "$INERT_P" 2>/dev/null | tr '\n' ' '
)
if [ -z "$(echo "$inert_out" | tr -d '[:space:]')" ]; then
  ok "layer sourced with no GETFF_TOOLCHAIN → wrote nothing (npm flow inert; install.sh:564 auto-source is a no-op)"
else
  bad "layer NOT inert without GETFF_TOOLCHAIN → wrote: $inert_out"
fi

# Positive-activation pair: GETFF_TOOLCHAIN=python DOES deliver (non-vacuous guard).
ACT_P=$(mktemp -d); printf '{"name":"a","version":"0.0.0"}\n' > "$ACT_P/package.json"
act_out=$(
  PROJECT_ROOT="$ACT_P"; SKIPPED=(); FORCE=""; DRY_RUN=""; PKG_ROOT="$REPO_ROOT"
  export GETFF_TOOLCHAIN=python
  unset PY_LAYER_LIB_ONLY 2>/dev/null || true
  # shellcheck source=/dev/null
  source "$LAYER" 2>&1
)
if [ -f "$ACT_P/sgconfig.yml" ]; then
  ok "layer sourced with GETFF_TOOLCHAIN=python → delivered (guard fires; env-var contract for S2)"
else
  bad "layer with GETFF_TOOLCHAIN=python did NOT deliver (guard vacuous?); out: $(echo "$act_out" | tail -2 | tr '\n' '|')"
fi

# ── Cell (i): fresh dir → whole-file copy ────────────────────────────────────
echo ""; echo "  ── cell (i): fresh dir ──"
P=$(mktemp -d); printf '{"name":"c1","version":"0.0.0"}\n' > "$P/package.json"
run_delivery "$P" >/dev/null 2>&1
cmp -s "$TPL/sgconfig.yml" "$P/sgconfig.yml" \
  && ok "(i) sgconfig.yml copied byte-identical to template" \
  || bad "(i) sgconfig.yml missing or differs from template"
cmp -s "$TPL/ruff.toml" "$P/ruff.toml" \
  && ok "(i) ruff.toml copied byte-identical to template" \
  || bad "(i) ruff.toml missing or differs from template"
rules_ok=1
for rf in getff-no-eval getff-no-os-system getff-no-datetime-now getff-no-datetime-datetime-now; do
  cmp -s "$TPL/.getff/astgrep-rules/$rf.yml" "$P/.getff/astgrep-rules/$rf.yml" || rules_ok=0
done
[ "$rules_ok" -eq 1 ] \
  && ok "(i) all 4 ast-grep rule files copied to .getff/astgrep-rules/ byte-identical" \
  || bad "(i) one or more ast-grep rule files missing/differ under .getff/astgrep-rules/"
[ ! -e "$P/getff-ruff.toml" ] \
  && ok "(i) no getff-ruff.toml on a fresh dir (reference copy is only for ruff-collision cells)" \
  || bad "(i) getff-ruff.toml written on a fresh dir (should only appear on cells iii/iv)"
[ -f "$P/$LOG_NAME" ] \
  && ok "(i) audit log $LOG_NAME written" \
  || bad "(i) audit log $LOG_NAME missing"

# ── Cell (ii): pre-existing sgconfig.yml (block list) → structural merge ──────
echo ""; echo "  ── cell (ii): pre-existing sgconfig.yml (block-list, structural merge) ──"
P=$(mktemp -d); printf '{"name":"c2","version":"0.0.0"}\n' > "$P/package.json"
printf 'ruleDirs:\n  - consumer_rules\n' > "$P/sgconfig.yml"
mkdir -p "$P/consumer_rules"
run_delivery "$P" >/dev/null 2>&1
if grep -qE '^[[:space:]]*-[[:space:]]+\.getff/astgrep-rules[[:space:]]*$' "$P/sgconfig.yml" \
   && grep -qE '^[[:space:]]*-[[:space:]]+consumer_rules[[:space:]]*$' "$P/sgconfig.yml"; then
  ok "(ii) .getff/astgrep-rules merged INTO ruleDirs; consumer_rules preserved (augment, not clobber)"
else
  bad "(ii) merge failed: $(tr '\n' '|' < "$P/sgconfig.yml")"
fi
nkeys=$(grep -c '^ruleDirs:' "$P/sgconfig.yml")
[ "$nkeys" -eq 1 ] \
  && ok "(ii) exactly ONE top-level ruleDirs: key (no duplicate-field exit-8 shape)" \
  || bad "(ii) $nkeys ruleDirs: keys — duplicate-field would trip ast-grep exit 8"
if command -v python3 >/dev/null 2>&1; then
  n=$(python3 -c "import yaml,sys; d=yaml.safe_load(open('$P/sgconfig.yml')); print(len(d['ruleDirs']))" 2>/dev/null || echo ERR)
  [ "$n" = "2" ] \
    && ok "(ii) merged sgconfig.yml parses as single YAML doc with 2 ruleDirs entries" \
    || bad "(ii) merged sgconfig.yml did not parse to 2 ruleDirs entries (got: $n)"
else
  skip "(ii) python3 absent — skipping YAML-parse assertion"
fi
[ -f "$P/.getff/astgrep-rules/getff-no-eval.yml" ] \
  && ok "(ii) rules dir delivered alongside merge (dir MUST exist before scan — Probe 6 exit 6)" \
  || bad "(ii) rules dir NOT delivered — a scan would abort with exit 6"
cmp -s "$TPL/ruff.toml" "$P/ruff.toml" \
  && ok "(ii) ruff.toml copied fresh (no ruff collision in this cell)" \
  || bad "(ii) ruff.toml missing/differs"
# idempotent re-run: merge must not double-list
before=$(cat "$P/sgconfig.yml")
run_delivery "$P" >/dev/null 2>&1
after=$(cat "$P/sgconfig.yml")
if [ "$before" = "$after" ]; then
  ok "(ii) re-run is idempotent — sgconfig.yml byte-identical (no duplicate .getff entry → no exit-8)"
else
  bad "(ii) re-run changed sgconfig.yml (not idempotent): $(diff <(echo "$before") <(echo "$after") | tr '\n' '|')"
fi

# ── Cell (ii-comment): pre-existing sgconfig.yml entry has a trailing comment ─────────────────
# Reproduces the review-round-1 idempotency bug: a consumer-added trailing comment on our entry
# (`  - .getff/astgrep-rules  # our rules`) must still be recognised as already-present — else a
# re-run inserts a DUPLICATE entry, which trips ast-grep exit 8 on the consumer's next scan.
echo ""; echo "  ── cell (ii): pre-existing sgconfig.yml entry has a trailing comment (idempotency) ──"
P=$(mktemp -d); printf '{"name":"c2c","version":"0.0.0"}\n' > "$P/package.json"
printf 'ruleDirs:\n  - .getff/astgrep-rules  # our rules\n  - consumer_rules\n' > "$P/sgconfig.yml"
before=$(cat "$P/sgconfig.yml")
run_delivery "$P" >/dev/null 2>&1
after=$(cat "$P/sgconfig.yml")
n=$(grep -cE '^[[:space:]]*-[[:space:]]+\.getff/astgrep-rules([[:space:]]|$)' "$P/sgconfig.yml")
[ "$n" -eq 1 ] \
  && ok "(ii-comment) exactly ONE .getff/astgrep-rules entry survives a trailing-comment pre-existing entry (no duplicate)" \
  || bad "(ii-comment) found $n .getff/astgrep-rules entries — trailing-comment entry not recognised as already-present (duplicate inserted)"
[ "$before" = "$after" ] \
  && ok "(ii-comment) sgconfig.yml left byte-identical (already-present entry recognised, no rewrite)" \
  || bad "(ii-comment) sgconfig.yml was rewritten even though our entry (with trailing comment) was already present"

# ── Cell (ii-refuse): pre-existing sgconfig.yml (flow list) → refuse loudly ───
echo ""; echo "  ── cell (ii): pre-existing sgconfig.yml (flow-list → REFUSE, STOP-line) ──"
P=$(mktemp -d); printf '{"name":"c2r","version":"0.0.0"}\n' > "$P/package.json"
printf 'ruleDirs: [consumer_rules]\n' > "$P/sgconfig.yml"
before=$(cat "$P/sgconfig.yml")
out=$(run_delivery "$P" 2>&1)
after=$(cat "$P/sgconfig.yml")
[ "$before" = "$after" ] \
  && ok "(ii-refuse) flow-list sgconfig.yml left UNTOUCHED (unproven shape → no clever merge; STOP-line)" \
  || bad "(ii-refuse) flow-list sgconfig.yml was modified — STOP-line violation"
echo "$out" | grep -qi 'REFUSE' && echo "$out" | grep -qF '.getff/astgrep-rules' \
  && ok "(ii-refuse) printed a loud REFUSE + manual instruction to add the ruleDirs entry" \
  || bad "(ii-refuse) refusal/instructions not printed: $(echo "$out" | tr '\n' '|')"
[ -f "$P/.getff/astgrep-rules/getff-no-eval.yml" ] \
  && ok "(ii-refuse) rules dir still delivered (ready once the consumer adds the entry manually)" \
  || bad "(ii-refuse) rules dir not delivered"
grep -qi 'REFUSE' "$P/$LOG_NAME" \
  && ok "(ii-refuse) refusal recorded in $LOG_NAME (degrade path logged)" \
  || bad "(ii-refuse) refusal not in audit log"

# ── Cell (iii): pre-existing ruff.toml → refuse loudly, ship getff-ruff.toml ──
echo ""; echo "  ── cell (iii): pre-existing ruff.toml (REFUSE — silent-win risk) ──"
P=$(mktemp -d); printf '{"name":"c3","version":"0.0.0"}\n' > "$P/package.json"
printf '[lint]\nselect = ["E"]\n' > "$P/ruff.toml"
before=$(cat "$P/ruff.toml")
out=$(run_delivery "$P" 2>&1)
[ "$before" = "$(cat "$P/ruff.toml")" ] \
  && ok "(iii) consumer ruff.toml left byte-identical (no silent clobber)" \
  || bad "(iii) consumer ruff.toml was overwritten — silent-clobber STOP-line violation"
cmp -s "$TPL/ruff.toml" "$P/getff-ruff.toml" \
  && ok "(iii) shipped getff-ruff.toml reference copy (== template bytes; ruff does not auto-discover it)" \
  || bad "(iii) getff-ruff.toml missing or differs from template"
echo "$out" | grep -qi 'REFUSE' && echo "$out" | grep -qF 'extend' && echo "$out" | grep -qF 'getff-ruff.toml' \
  && ok "(iii) printed REFUSE + extend manual instructions" \
  || bad "(iii) refusal/extend instructions not printed: $(echo "$out" | tr '\n' '|')"
# sub-case: consumer ruff.toml already sets extend → scalar caveat surfaced
P=$(mktemp -d); printf '{"name":"c3e","version":"0.0.0"}\n' > "$P/package.json"
printf '[lint]\nextend = "base.toml"\n' > "$P/ruff.toml"
out=$(run_delivery "$P" 2>&1)
echo "$out" | grep -qiE 'scalar|already sets' \
  && ok "(iii) consumer already uses extend → scalar-one-per-file caveat surfaced" \
  || bad "(iii) extend-scalar caveat not surfaced: $(echo "$out" | tr '\n' '|')"

# sub-case: consumer has a DOTFILE .ruff.toml (no ruff.toml) → same REFUSE path (:153 collision
# trigger — was untested until now).
P=$(mktemp -d); printf '{"name":"c3d","version":"0.0.0"}\n' > "$P/package.json"
printf '[lint]\nselect = ["E"]\n' > "$P/.ruff.toml"
before=$(cat "$P/.ruff.toml")
out=$(run_delivery "$P" 2>&1)
[ ! -e "$P/ruff.toml" ] \
  && ok "(iii-dotfile) no ruff.toml written when consumer has .ruff.toml (dotfile variant)" \
  || bad "(iii-dotfile) ruff.toml written next to consumer .ruff.toml — silent-clobber STOP-line violation"
[ "$before" = "$(cat "$P/.ruff.toml")" ] \
  && ok "(iii-dotfile) consumer .ruff.toml left byte-identical" \
  || bad "(iii-dotfile) consumer .ruff.toml was overwritten"
cmp -s "$TPL/ruff.toml" "$P/getff-ruff.toml" \
  && ok "(iii-dotfile) shipped getff-ruff.toml reference copy (== template bytes)" \
  || bad "(iii-dotfile) getff-ruff.toml missing or differs from template"
echo "$out" | grep -qi 'REFUSE' && echo "$out" | grep -qF 'extend' && echo "$out" | grep -qF 'getff-ruff.toml' \
  && ok "(iii-dotfile) printed REFUSE + extend manual instructions" \
  || bad "(iii-dotfile) refusal/extend instructions not printed: $(echo "$out" | tr '\n' '|')"
grep -qi 'REFUSE' "$P/$LOG_NAME" \
  && ok "(iii-dotfile) refusal recorded in $LOG_NAME (degrade path logged)" \
  || bad "(iii-dotfile) refusal not in audit log"

# ── Cell (iv): pre-existing pyproject [tool.ruff], no ruff.toml → refuse ──────
echo ""; echo "  ── cell (iv): pre-existing pyproject.toml [tool.ruff] (REFUSE — silent override) ──"
P=$(mktemp -d); printf '{"name":"c4","version":"0.0.0"}\n' > "$P/package.json"
printf '[project]\nname = "c4"\n\n[tool.ruff.lint]\nselect = ["E"]\n' > "$P/pyproject.toml"
before=$(cat "$P/pyproject.toml")
out=$(run_delivery "$P" 2>&1)
[ ! -e "$P/ruff.toml" ] \
  && ok "(iv) NO ruff.toml written (a sibling ruff.toml would SILENTLY override their [tool.ruff])" \
  || bad "(iv) ruff.toml written next to pyproject [tool.ruff] — silent-override STOP-line violation"
[ "$before" = "$(cat "$P/pyproject.toml")" ] \
  && ok "(iv) consumer pyproject.toml left untouched" \
  || bad "(iv) consumer pyproject.toml was modified"
cmp -s "$TPL/ruff.toml" "$P/getff-ruff.toml" \
  && ok "(iv) shipped getff-ruff.toml reference copy" \
  || bad "(iv) getff-ruff.toml missing or differs"
echo "$out" | grep -qi 'REFUSE' && echo "$out" | grep -qF 'tool.ruff.lint' \
  && ok "(iv) printed REFUSE + merge-into-[tool.ruff.lint] instructions" \
  || bad "(iv) refusal/merge instructions not printed: $(echo "$out" | tr '\n' '|')"

# ── Cell (v): re-run idempotency (delivered config artefacts byte-identical) ──
echo ""; echo "  ── cell (v): re-run idempotency ──"
P=$(mktemp -d); printf '{"name":"c5","version":"0.0.0"}\n' > "$P/package.json"
printf 'node_modules/\n' > "$P/.prettierignore"   # exercise the prettierignore path under idempotency
run_delivery "$P" >/dev/null 2>&1
fp1=$(config_fingerprint "$P")
run_delivery "$P" >/dev/null 2>&1
fp2=$(config_fingerprint "$P")
[ "$fp1" = "$fp2" ] \
  && ok "(v) second run left the delivered config tree byte-identical (idempotent; log excluded)" \
  || bad "(v) second run changed the config tree: $(diff <(echo "$fp1") <(echo "$fp2") | tr '\n' '|')"

# ── .prettierignore: append `.getff/` if present (idempotent); never create ──
echo ""; echo "  ── .prettierignore handling ──"
P=$(mktemp -d); printf '{"name":"pi","version":"0.0.0"}\n' > "$P/package.json"
printf 'node_modules/\ndist/\n' > "$P/.prettierignore"
run_delivery "$P" >/dev/null 2>&1
c=$(grep -cxF '.getff/' "$P/.prettierignore")
[ "$c" -eq 1 ] \
  && ok "(pi) '.getff/' appended to existing .prettierignore exactly once" \
  || bad "(pi) '.getff/' appears $c times (expected 1)"
run_delivery "$P" >/dev/null 2>&1
c=$(grep -cxF '.getff/' "$P/.prettierignore")
[ "$c" -eq 1 ] \
  && ok "(pi) re-run keeps '.getff/' exactly once (idempotent)" \
  || bad "(pi) re-run duplicated '.getff/' ($c occurrences)"
P=$(mktemp -d); printf '{"name":"pi2","version":"0.0.0"}\n' > "$P/package.json"
out=$(run_delivery "$P" 2>&1)
[ ! -e "$P/.prettierignore" ] \
  && ok "(pi) no .prettierignore created when the consumer has none (no unrequested opinion)" \
  || bad "(pi) .prettierignore was created out of nothing"
echo "$out" | grep -qi 'prettierignore' \
  && ok "(pi) prettierignore decision logged either way" \
  || bad "(pi) prettierignore decision not logged"

# ── LIVE-FIRE: all 4 ast-grep rules fire RED on planted violations (GATED) ────
echo ""; echo "  ── live-fire: ast-grep rules (pinned @ast-grep/cli@0.44.1; SKIP if unobtainable) ──"
ASTGREP_OK=0
if command -v npx >/dev/null 2>&1 && npx --yes -p @ast-grep/cli@0.44.1 ast-grep --version >/dev/null 2>&1; then
  ASTGREP_OK=1
fi
if [ "$ASTGREP_OK" -eq 1 ]; then
  P=$(mktemp -d); printf '{"name":"lf","version":"0.0.0"}\n' > "$P/package.json"
  run_delivery "$P" >/dev/null 2>&1
  cat > "$P/sample.py" <<'PY'
import datetime
x = eval("1 + 1")
os.system("echo hi")
a = datetime.datetime.now()
b = datetime.now()
PY
  sg_out=$(cd "$P" && npx --yes -p @ast-grep/cli@0.44.1 ast-grep scan . 2>&1)
  for rid in getff-no-eval getff-no-os-system getff-no-datetime-now getff-no-datetime-datetime-now; do
    echo "$sg_out" | grep -qF "$rid" \
      && ok "live-fire: ast-grep rule $rid fired RED on planted violation" \
      || bad "live-fire: ast-grep rule $rid did NOT fire (out: $(echo "$sg_out" | tr '\n' '|' | cut -c1-200))"
  done
else
  skip "live-fire ast-grep SKIP — @ast-grep/cli@0.44.1 not obtainable (npx/network absent); deterministic copy assertions carry CI"
fi

# ── LIVE-FIRE: both ruff TID bans fire RED (GATED: uvx, else pip venv, else SKIP) ──
echo ""; echo "  ── live-fire: ruff TID bans (pinned ruff==0.15.21; SKIP if unobtainable) ──"
RUFF_RUN=""
if command -v uvx >/dev/null 2>&1 && uvx ruff@0.15.21 --version >/dev/null 2>&1; then
  RUFF_RUN="uvx ruff@0.15.21"
elif command -v python3 >/dev/null 2>&1; then
  RUFF_VENV=$(mktemp -d)
  if python3 -m venv "$RUFF_VENV" >/dev/null 2>&1 && "$RUFF_VENV/bin/pip" install --quiet "ruff==0.15.21" >/dev/null 2>&1; then
    RUFF_RUN="$RUFF_VENV/bin/ruff"
  fi
fi
if [ -n "$RUFF_RUN" ]; then
  P=$(mktemp -d); printf '{"name":"lfr","version":"0.0.0"}\n' > "$P/package.json"
  run_delivery "$P" >/dev/null 2>&1
  cat > "$P/sample.py" <<'PY'
import tensorflow
import datetime
x = datetime.datetime.utcnow()
PY
  ruff_out=$(cd "$P" && $RUFF_RUN check --config ruff.toml . 2>&1)
  echo "$ruff_out" | grep -qF 'TID253' \
    && ok "live-fire: ruff TID253 (banned module-level import tensorflow) fired RED" \
    || bad "live-fire: ruff TID253 did NOT fire (out: $(echo "$ruff_out" | tr '\n' '|' | cut -c1-200))"
  echo "$ruff_out" | grep -qF 'TID251' \
    && ok "live-fire: ruff TID251 (banned-api datetime.datetime.utcnow) fired RED" \
    || bad "live-fire: ruff TID251 did NOT fire (out: $(echo "$ruff_out" | tr '\n' '|' | cut -c1-200))"
else
  skip "live-fire ruff SKIP — ruff==0.15.21 not obtainable via uvx or pip venv; deterministic copy assertions carry CI"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
