#!/usr/bin/env bash
# tests/install-sh/python-agent-surface-refresh.test.sh — the two python-lane DELIVERY defects from
# the PR 1597 local review ledger: A2-4 (`--refresh` never refreshed the agent surface) and A2-5 (a
# Python consumer was handed the Next.js-15 preset's RULES.md as its rule SSOT).
#
# ── A2-4 ────────────────────────────────────────────────────────────────────────────────────────
# `install.sh python --refresh` cannot reach install.sh's do_refresh() at all: do_python_lane exits
# at install.sh:381, and do_refresh lives at :1276. Inside _py_deliver_agent_surface every delivery
# was skip-if-exists, so a brownfield python consumer got "✅ … re-delivery complete" while
# .claude/skills, .claude/agents and .claude/hooks stayed at the version they first installed.
# MEASURED RED-before-GREEN (2026-09-05) — the pre-fix layer (`git show HEAD:setup.d/45-python.sh`,
# 1142 lines) put into a symlink-farm PKG_ROOT, install → drift 3 artefacts → `python --refresh`:
#   STALE -> arm (1) RED   .claude/hooks/inject-matching-rule.sh
#   STALE -> arm (1) RED   .claude/agents/rule-researcher.md
#   STALE -> arm (1) RED   .claude/skills/rule-research/SKILL.md
#   completion lines printed anyway: 1     ← "✅ … agent surface re-delivery complete."
# The same run measured A2-5: `getff-no-eval` occurrences in the delivered RULES.md = 0, while
# `tsc --noEmit` / `ESLint` / `eslint` were all present — arms (6) and (7) RED.
#
# Arm (1) is the ledger's own paired-negative shape — the update starts in the FRAMEWORK copy and
# must reach the consumer — built on a symlink-farm PKG_ROOT so the framework "change" is a real
# source change without touching the repo. Arm (2) is the non-vacuity control: the SAME scenario
# with the refresh flag OFF must NOT propagate (that is the pre-fix behaviour of both paths), so a
# helper that overwrote unconditionally would fail here.
#
# ── A2-5 ────────────────────────────────────────────────────────────────────────────────────────
# The delivered AGENTS.md declares `.ai-factory/RULES.md` "the rule list and the only place rules
# are stated", while the python lane wrote the Next.js preset's file there. Arms (6)-(9) assert the
# consumer's RULES.md names the rules actually delivered, carries no TypeScript-lane check, is
# RENDERED (a rule researched into .getff/rules-research/ shows up), and stays consumer-owned.
# Arm (10) is the non-vacuity control: the very file the lane used to ship must FAIL both content
# assertions — proving they discriminate rather than passing on any markdown.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

py_fixture() {  # a pure Python consumer: pyproject.toml, no package.json, a git repo
  local d; d=$(mktemp -d)
  printf '[project]\nname = "demo"\nversion = "0.0.1"\n' > "$d/pyproject.toml"
  ( cd "$d" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
  echo "$d"
}

# fake_pkg_root <marker> — a symlink farm over the real repo whose ONLY real files are the two
# `.claude/` paths the agent surface reads, so one of them can be mutated as if the framework had
# shipped a new version. Everything else (skills/, agents/, packages/, setup.d/, install.sh …) is a
# symlink to the real tree, so this costs no copy of the repo.
fake_pkg_root() {
  local marker="$1" fake e
  fake=$(mktemp -d)
  for e in "$REPO_ROOT"/*; do ln -s "$e" "$fake/$(basename "$e")"; done
  mkdir -p "$fake/.claude/hooks"
  ln -s "$REPO_ROOT/.claude/skills" "$fake/.claude/skills"
  cp "$REPO_ROOT/.claude/hooks/inject-matching-rule.sh" "$fake/.claude/hooks/inject-matching-rule.sh"
  printf '# %s\n' "$marker" >> "$fake/.claude/hooks/inject-matching-rule.sh"
  echo "$fake"
}

echo "▶ Python agent surface — --refresh parity (A2-4) + python-lane RULES.md (A2-5)"
echo ""

# ── (1) A2-4 pos: a framework-side hook change REACHES a brownfield consumer via --refresh ────────
echo "  ── (1) framework-side update → install.sh python --refresh → consumer copy updated ──"
P=$(py_fixture)
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
if [ ! -f "$P/.claude/hooks/inject-matching-rule.sh" ]; then
  bad "(1) precondition: the fresh install did not deliver .claude/hooks/inject-matching-rule.sh"
else
  ok "(1) precondition: fresh install delivered .claude/hooks/inject-matching-rule.sh"
  FAKE=$(fake_pkg_root "FRAMEWORK-SIDE-UPDATE-A24")
  # PKG_ROOT is resolved by install.sh from its own location, so drive the install THROUGH the farm.
  ( cd "$P" && bash "$FAKE/install.sh" python --refresh < /dev/null ) > "$P/refresh.log" 2>&1
  if grep -qF 'FRAMEWORK-SIDE-UPDATE-A24' "$P/.claude/hooks/inject-matching-rule.sh"; then
    ok "(1) the new framework hook body reached the consumer (agent surface honours --refresh)"
  else
    bad "(1) consumer hook STILL at the old body after --refresh — A2-4 live (the run printed: $(grep -c '✅' "$P/refresh.log") completion line(s))"
  fi
  # Skills + agents ride the same fix: after a refresh their bytes must equal the framework source.
  if cmp -s "$REPO_ROOT/agents/rule-researcher.md" "$P/.claude/agents/rule-researcher.md" \
    || [ -s "$P/.claude/agents/rule-researcher.md" ]; then
    printf 'CONSUMER-DRIFT\n' >> "$P/.claude/agents/rule-researcher.md"
    printf 'CONSUMER-DRIFT\n' >> "$P/.claude/skills/rule-research/SKILL.md"
    printf 'CONSUMER-DRIFT\n' >> "$P/.claude/skills/getff/SKILL.md"
    printf 'CONSUMER-DRIFT\n' >> "$P/.claude/hooks/deps-hash-check.sh"
    ( cd "$P" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
    _stale=""
    for _f in .claude/agents/rule-researcher.md .claude/skills/rule-research/SKILL.md \
              .claude/skills/getff/SKILL.md .claude/hooks/deps-hash-check.sh; do
      grep -qF 'CONSUMER-DRIFT' "$P/$_f" && _stale="$_stale $_f"
    done
    if [ -z "${_stale// }" ]; then
      ok "(1) skills + agents + the deps-hash hook are all re-delivered on --refresh"
    else
      bad "(1) NOT re-delivered on --refresh (A2-4 live for):$_stale"
    fi
  fi
  rm -rf "$FAKE"
fi

# ── (2) A2-4 NEG (non-vacuity): WITHOUT --refresh the same framework change must NOT propagate ────
# copy_safe's skip-if-exists is the contract for a plain re-run; a helper that overwrote
# unconditionally would pass arm (1) while destroying that contract, so this arm must stay RED-able.
echo ""; echo "  ── (2) NEG: a plain re-run (no --refresh) must NOT overwrite the consumer copy ──"
P2=$(py_fixture)
( cd "$P2" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
FAKE2=$(fake_pkg_root "FRAMEWORK-SIDE-UPDATE-NEG")
( cd "$P2" && bash "$FAKE2/install.sh" python < /dev/null ) >/dev/null 2>&1
if grep -qF 'FRAMEWORK-SIDE-UPDATE-NEG' "$P2/.claude/hooks/inject-matching-rule.sh"; then
  bad "(2) a plain re-run overwrote the consumer hook — skip-if-exists contract broken (arm (1) is vacuous)"
else
  ok "(2) plain re-run left the consumer copy alone (arm (1) measures --refresh, not unconditional copy)"
fi
rm -rf "$FAKE2" "$P2"

# ── (3) A2-4: the Layer-3 escape hatch survives the fix ───────────────────────────────────────────
echo ""; echo "  ── (3) <dst>.override.md keeps a consumer-owned artefact through --refresh ──"
printf 'CONSUMER-OWNED-BODY\n' >> "$P/.claude/agents/rule-researcher.md"
: > "$P/.claude/agents/rule-researcher.override.md"
printf 'CONSUMER-OWNED-SKILL\n' >> "$P/.claude/skills/rule-research/SKILL.md"
: > "$P/.claude/skills/rule-research.override.md"
( cd "$P" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
if grep -qF 'CONSUMER-OWNED-BODY' "$P/.claude/agents/rule-researcher.md"; then
  ok "(3) agent with a sibling .override.md was NOT overwritten"
else
  bad "(3) .override.md ignored for an agent — Layer-3 consumer ownership lost"
fi
if grep -qF 'CONSUMER-OWNED-SKILL' "$P/.claude/skills/rule-research/SKILL.md"; then
  ok "(3) skill with a sibling .override.md was NOT overwritten"
else
  bad "(3) .override.md ignored for a skill — Layer-3 consumer ownership lost"
fi

# ── (4) A2-4 boundary: consumer-authored .ai-factory docs are NEVER refreshed ─────────────────────
# do_refresh's own contract (install.sh:614) names RULES.md / DESCRIPTION.md / ARCHITECTURE.md
# consumer-authored. The python lane must not be more destructive than the npm lane.
echo ""; echo "  ── (4) consumer-authored .ai-factory docs survive --refresh (npm-lane boundary parity) ──"
for _f in .ai-factory/RULES.md .ai-factory/DESCRIPTION.md .ai-factory/ARCHITECTURE.md \
          .ai-factory/tool-decisions.md .ai-factory/rules/integration-rules.md; do
  printf '\n<!-- CONSUMER-EDIT -->\n' >> "$P/$_f"
done
( cd "$P" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
_clobbered=""
for _f in .ai-factory/RULES.md .ai-factory/DESCRIPTION.md .ai-factory/ARCHITECTURE.md \
          .ai-factory/tool-decisions.md .ai-factory/rules/integration-rules.md; do
  grep -qF 'CONSUMER-EDIT' "$P/$_f" || _clobbered="$_clobbered $_f"
done
if [ -z "${_clobbered// }" ]; then
  ok "(4) every consumer-authored .ai-factory doc kept its edits through --refresh"
else
  bad "(4) --refresh clobbered consumer-authored doc(s):$_clobbered"
fi

# ── (5) A2-4: the framework-owned AI-USAGE-GUIDE.md IS refreshed (do_refresh install.sh:1218) ─────
echo ""; echo "  ── (5) .ai-factory/AI-USAGE-GUIDE.md is framework-owned → refreshed ──"
printf '\nSTALE-GUIDE\n' >> "$P/.ai-factory/AI-USAGE-GUIDE.md"
( cd "$P" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
if grep -qF 'STALE-GUIDE' "$P/.ai-factory/AI-USAGE-GUIDE.md"; then
  bad "(5) AI-USAGE-GUIDE.md not refreshed — diverges from do_refresh (install.sh:1218)"
else
  ok "(5) AI-USAGE-GUIDE.md re-delivered on --refresh (npm-lane parity)"
fi
rm -rf "$P"

# ── (6)-(9) A2-5: the python consumer's RULES.md is the PYTHON rule list ──────────────────────────
echo ""; echo "  ── (6) RULES.md names every delivered ast-grep rule id + ruff ban code ──"
PR=$(py_fixture)
# A researched rule joins the delivered set on every pass (_py_join_researched_rules) — plant one so
# arm (8) can prove the doc is RENDERED from disk, not a static list that would start lying here.
mkdir -p "$PR/.getff/rules-research"
cat > "$PR/.getff/rules-research/getff-researched-no-pickle-loads.yml" <<'YML'
# generated by getff astgrep backend v0 — do not edit by hand
id: "getff-researched-no-pickle-loads"
language: python
severity: error
message: "Do not use pickle.loads() on untrusted bytes; it executes arbitrary code"
metadata:
  kind: call
rule:
  pattern: "pickle.loads($$$ARGS)"
YML
( cd "$PR" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
RULES="$PR/.ai-factory/RULES.md"
if [ ! -f "$RULES" ]; then
  bad "(6) .ai-factory/RULES.md was not delivered on the python lane"
else
  # The expected set is read from the DELIVERED artefacts, not hard-coded, so this arm keeps
  # measuring the real rule set as the starter nodes evolve.
  _missing=""
  while IFS= read -r _id; do
    [ -n "$_id" ] || continue
    grep -qF "$_id" "$RULES" || _missing="$_missing $_id"
  done <<EOF
$(grep -h '^id:' "$PR"/.getff/astgrep-rules/*.yml 2>/dev/null | sed -E 's/^id:[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/' | sort -u)
EOF
  while IFS= read -r _code; do
    [ -n "$_code" ] || continue
    grep -qF "$_code" "$RULES" || _missing="$_missing $_code"
  done <<EOF
$(grep -oE '"[A-Z]+[0-9]+"' "$PR/.getff/ruff-bans.toml" 2>/dev/null | tr -d '"' | sort -u)
EOF
  if [ -z "${_missing// }" ]; then
    ok "(6) every delivered ast-grep rule id and ruff ban code appears in .ai-factory/RULES.md"
  else
    bad "(6) delivered rule(s)/ban(s) documented NOWHERE the shipped AGENTS.md points:$_missing"
  fi

  echo ""; echo "  ── (7) RULES.md carries no TypeScript-lane check on a Python project ──"
  _ts=$(grep -oiE 'tsc --noEmit|eslint|arch:check|no-unsafe-zod-parse' "$RULES" | sort -u | tr '\n' ' ')
  if [ -z "${_ts// }" ]; then
    ok "(7) no tsc / eslint / arch:check / zod-parse rule text in the python consumer's RULES.md"
  else
    bad "(7) TypeScript-lane checks stated as this Python project's rules: $_ts"
  fi

  echo ""; echo "  ── (8) RULES.md is RENDERED from .getff/, not a static list ──"
  if grep -qF 'getff-researched-no-pickle-loads' "$RULES"; then
    ok "(8) a rule researched into .getff/rules-research/ appears in the rendered table"
  else
    bad "(8) a joined researched rule is missing from RULES.md — the doc is static and already lying"
  fi

  echo ""; echo "  ── (9) RULES.md is consumer-owned: --refresh never overwrites it ──"
  printf '\n<!-- MY-OWN-RULE -->\n' >> "$RULES"
  ( cd "$PR" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
  if grep -qF 'MY-OWN-RULE' "$RULES"; then
    ok "(9) --refresh preserved the consumer's own RULES.md edits"
  else
    bad "(9) --refresh overwrote RULES.md — it is consumer-authored (install.sh:614)"
  fi
fi
rm -rf "$PR"

# ── (10) A2-5 NEG (non-vacuity): the file the lane USED to ship must FAIL arms (6)+(7) ────────────
# Without this, arms (6)/(7) could pass on any markdown that merely avoided the words.
echo ""; echo "  ── (10) NEG: the Next.js-15 preset RULES.md fails the same two assertions ──"
PRESET="$REPO_ROOT/packages/preset-next-15-canonical/RULES.md"
if [ ! -f "$PRESET" ]; then
  bad "(10) $PRESET not found — the negative control moved, update this arm"
else
  _n_ids=0
  for _id in getff-no-eval getff-no-os-system TID251 TID253; do
    grep -qF "$_id" "$PRESET" && _n_ids=$((_n_ids+1))
  done
  if [ "$_n_ids" = 0 ]; then
    ok "(10) the preset file names NONE of the delivered python rule ids → arm (6) discriminates"
  else
    bad "(10) the preset file already names $_n_ids python rule id(s) — arm (6) is vacuous"
  fi
  if grep -qiE 'tsc --noEmit|eslint' "$PRESET"; then
    ok "(10) the preset file DOES carry TypeScript-lane checks → arm (7) discriminates"
  else
    bad "(10) the preset file carries no TypeScript-lane check — arm (7) is vacuous"
  fi
fi

echo ""
echo "──────────────────────────────────────────"
echo "  PASS: $PASS   FAIL: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
