#!/usr/bin/env bash
# F7 (owner GO 2026-07-10) — the AIF operator suite ships ONLY behind an explicit
# --with-aif-suite opt-in; the consumer-facing core set stays default.
#
# Background: setup.d/10-skills.sh formerly transform-copied 9 skills to EVERY consumer.
# Five presuppose the aif-handoff operator runtime (pipeline, dispatcher, aif-doctor,
# harvest, night-mode) and story crashes on landing (its lang-pack is not shipped, #934).
# Owner resolved fork F7: gate that suite behind --with-aif-suite (reversible; BFR §1.1
# integrate-never-hard-depend; same opt-in posture as companions.manifest). This asserts via
# the REAL install pipeline (mirror f8/ship-orchestration) that:
#   (a-default)  default install → the 6 gated suite skills ABSENT; core set + the two
#                separately-copied skills (getff, tool-bootstrapping) PRESENT.
#   (b-flag)     --with-aif-suite → all nine skills present.
#   (c-refresh)  refresh over an existing suite install WITHOUT the flag → the suite files
#                are still present and refreshed (presence on disk = prior opt-in), not deleted.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

CORE_SET="template-audit ai-doc rule-research rule-tests"
GATED_SET="pipeline dispatcher aif-doctor harvest night-mode story"
ALWAYS_COPIED="getff tool-bootstrapping"
# F7 agents arm (owner GO 2026-07-11): the two aif-handoff-presupposing agents + their
# @dual-pair skill-context are gated behind the same flag as the suite skills.
GATED_AGENTS="orchestrator-worker-discipline reviewer-discipline"
GATED_SC=".ai-factory/skill-context/aif-orchestrator-discipline/SKILL.md"

# ── (a) default install: gated suite absent, core set present ────────────────
T=$(mktemp -d)
printf '{"name":"f7-default","version":"0.0.0"}\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
for s in $GATED_SET; do
  if [ -e "$T/.claude/skills/$s/SKILL.md" ]; then
    bad "default install shipped gated suite skill: $s (should be flag-gated)"
  else
    ok "default install: gated suite skill absent: $s"
  fi
done
for s in $CORE_SET $ALWAYS_COPIED; do
  if [ -e "$T/.claude/skills/$s/SKILL.md" ]; then
    ok "default install: core skill present: $s"
  else
    bad "default install: core skill MISSING: $s"
  fi
done
for a in $GATED_AGENTS; do
  [ ! -e "$T/.claude/agents/$a.md" ] && ok "default install: gated agent absent: $a" || bad "default install shipped gated agent: $a"
done
[ ! -e "$T/$GATED_SC" ] && ok "default install: aif-orchestrator-discipline skill-context absent" || bad "default install shipped gated skill-context"
[ -e "$T/.claude/agents/review-sidecar.md" ] && ok "default install: consumer agent present: review-sidecar" || bad "default install: review-sidecar MISSING"
[ -e "$T/.claude/agents/docplan-auditor.md" ] && ok "default install: consumer agent present: docplan-auditor" || bad "default install: docplan-auditor MISSING"
rm -rf "$T"

# ── (b) --with-aif-suite: all nine present ───────────────────────────────────
T2=$(mktemp -d)
printf '{"name":"f7-flag","version":"0.0.0"}\n' > "$T2/package.json"
( cd "$T2" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force --with-aif-suite ) >/dev/null 2>&1
for s in $CORE_SET $GATED_SET; do
  if [ -e "$T2/.claude/skills/$s/SKILL.md" ]; then
    ok "--with-aif-suite: skill present: $s"
  else
    bad "--with-aif-suite: skill MISSING: $s"
  fi
done
# aif-doctor helpers surface only under the flag (gated block)
if [ -e "$T2/.claude/skills/aif-doctor/helpers/heal.sh" ]; then
  ok "--with-aif-suite: aif-doctor helpers landed"
else
  bad "--with-aif-suite: aif-doctor helpers MISSING"
fi
for a in $GATED_AGENTS; do
  [ -e "$T2/.claude/agents/$a.md" ] && ok "--with-aif-suite: gated agent present: $a" || bad "--with-aif-suite: gated agent MISSING: $a"
done
[ -e "$T2/$GATED_SC" ] && ok "--with-aif-suite: aif-orchestrator-discipline skill-context present" || bad "--with-aif-suite: gated skill-context MISSING"
rm -rf "$T2"

# ── (c) refresh over an existing suite install WITHOUT the flag keeps the suite ──
T3=$(mktemp -d)
printf '{"name":"f7-refresh","version":"0.0.0"}\n' > "$T3/package.json"
( cd "$T3" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force --with-aif-suite ) >/dev/null 2>&1
# sentinel: mutate a shipped file so we can prove refresh re-copied (not just left) it
DISP="$T3/.claude/skills/dispatcher/SKILL.md"
[ -f "$DISP" ] || { bad "refresh setup: dispatcher not installed by flagged install"; }
echo "LOCAL-EDIT-SENTINEL" >> "$DISP"
( cd "$T3" && bash "$REPO_ROOT/install.sh" ts-server --refresh ) >/dev/null 2>&1
for s in $GATED_SET; do
  if [ -e "$T3/.claude/skills/$s/SKILL.md" ]; then
    ok "refresh (no flag) kept prior-opt-in suite skill: $s"
  else
    bad "refresh (no flag) DELETED prior-opt-in suite skill: $s"
  fi
done
for a in $GATED_AGENTS; do
  [ -e "$T3/.claude/agents/$a.md" ] && ok "refresh (no flag) kept prior-opt-in gated agent: $a" || bad "refresh (no flag) LOST prior-opt-in gated agent: $a"
done
[ -e "$T3/$GATED_SC" ] && ok "refresh (no flag) kept prior-opt-in gated skill-context" || bad "refresh (no flag) LOST prior-opt-in gated skill-context"
if [ -f "$DISP" ] && ! grep -q 'LOCAL-EDIT-SENTINEL' "$DISP"; then
  ok "refresh re-copied dispatcher over the prior install (sentinel gone)"
else
  bad "refresh did not re-copy dispatcher (sentinel survived — refresh was a no-op)"
fi
rm -rf "$T3"

# ── (d) refresh WITHOUT prior opt-in and no flag → suite stays absent ─────────
T4=$(mktemp -d)
printf '{"name":"f7-refresh-clean","version":"0.0.0"}\n' > "$T4/package.json"
( cd "$T4" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
( cd "$T4" && bash "$REPO_ROOT/install.sh" ts-server --refresh ) >/dev/null 2>&1
for s in $GATED_SET; do
  if [ -e "$T4/.claude/skills/$s/SKILL.md" ]; then
    bad "refresh (no prior opt-in, no flag) CREATED gated suite skill: $s"
  else
    ok "refresh (no prior opt-in, no flag): gated skill stays absent: $s"
  fi
done
for a in $GATED_AGENTS; do
  [ ! -e "$T4/.claude/agents/$a.md" ] && ok "refresh (no prior opt-in): gated agent stays absent: $a" || bad "refresh (no prior opt-in) CREATED gated agent: $a"
done
[ ! -e "$T4/$GATED_SC" ] && ok "refresh (no prior opt-in): gated skill-context stays absent" || bad "refresh (no prior opt-in) CREATED gated skill-context"
rm -rf "$T4"

# ── (e) --all = --full + --with-aif-suite (operator shorthand, owner directive 2026-07-11) ──
# NO REAL INSTALL / NO NETWORK: --all implies --full, whose 70-deps layer invokes npm — stub the
# PM on PATH (same tactic as cic-s3-dep-install.test.sh) so this arm asserts only the suite arm.
T5=$(mktemp -d)
STUB=$(mktemp -d)
printf '#!/bin/sh\nexit 0\n' > "$STUB/npm"; chmod +x "$STUB/npm"
printf '{"name":"f7-all","version":"0.0.0"}\n' > "$T5/package.json"
( cd "$T5" && git init -q && PATH="$STUB:$PATH" bash "$REPO_ROOT/install.sh" ts-server --force --all ) >/dev/null 2>&1
for s in $GATED_SET; do
  [ -e "$T5/.claude/skills/$s/SKILL.md" ] && ok "--all: suite skill present: $s" || bad "--all: suite skill MISSING: $s"
done
for a in $GATED_AGENTS; do
  [ -e "$T5/.claude/agents/$a.md" ] && ok "--all: gated agent present: $a" || bad "--all: gated agent MISSING: $a"
done
[ -e "$T5/$GATED_SC" ] && ok "--all: gated skill-context present" || bad "--all: gated skill-context MISSING"
rm -rf "$T5" "$STUB"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
