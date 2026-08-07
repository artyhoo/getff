#!/usr/bin/env bash
# Consumer-matrix W6 CELL: python unfamiliar-stack e2e · master default branch
# (getff-any-stack-trace S4, spec §9.1).
#
# THE LOAD-BEARING CELL OF THIS STAGE. Mechanizes the spec §9.1 chain on a scripted fresh
# python project (FastAPI/SQLAlchemy-class) — the chain runs end-to-end against REAL
# shipped artefacts (install.sh python lane + the curated 2-agent surface + Tier-1 host
# derivation + researched-rule generation + ast-grep firing). The cell Discriminates: a
# gate that cannot fail is not a gate (T-S4-A), so RED on a planted violation / GREEN on
# clean code is the §3 «works» claim, not a green-CI narrative.
#
# Asserts (kickoff §2 item 1 chain, in order):
#   (1) scripted fresh python project (FastAPI/SQLAlchemy-class fixture, pyproject.toml)
#   (2) `master` as the default branch ON PURPOSE (R1-input W5.4 regression guard — see
#       setup.d/lib.sh:194 `deliver_getff_workflow` sed-substitutes `branches: [main]` to
#       the consumer's default branch; assert the delivered workflow trigger carries master)
#   (3) `install.sh python` under a Node-stripped PATH — proves F-A DECLARE (the python
#       install stays Node-free; Node in the CI RUNNER is fine, per kickoff §6 anti-scope)
#   (4) agent surface IS PRESENT after install (skills, curated 2 agents, hooks + settings,
#       .mcp.json, starter AGENTS.md, .ai-factory/ subtree — the S2 delivery)
#   (5) committed Tier-1-provenance practice fixture → rule-bootstrap-cli --from-practice
#       resolves Tier-1 (vendored .dist-info METADATA, fastapi.tiangoco.com / docs.sqlalchemy.org
#       ABSENT from packages/core/research/allowlist.ts — Tier-0 misses by construction,
#       Tier-1 ADMITS via `Project-URL: Documentation, <url>`)
#   (6) the rule LANDS at <consumer>/.getff/rules-research/<entryId>.yml
#   (7) RED arm: ast-grep fires non-zero on a planted violation matching the new rule
#   (8) GREEN arm: ast-grep silent on conforming code (clean control — paired per
#       adapter-jig E1, mirrors setup.d/45-python.sh:397 _py_firing_self_check)
#   (9) REJECT arm: a practice record citing a NON-direct-dep package (`requests`) is
#       downgraded to research-only — provenance-rejected by Tier-1 (FF2007 — not a direct
#       dependency). NO file written under rules-research/ for the rejected entryId.
#  (10) R1-input assertion: delivered workflow trigger carries `branches: [master]`
#       (park-don't-guess: do NOT widen to cargo/go — R1's routing; belongs to widening).
#
# Fail-closed polarity (no-paid-llm-in-ci.md §1 + kickoff §2 item 1): a missing tool is
# RED, never SKIP. ast-grep is installed PINNED (ci-tool-pinning.md Rule A — version-pin
# bare run: installs). Deterministic + API-free.
#
# Runs in CI (ubuntu) and host-verify (`make consumer-matrix`). Container runs are
# informational only — host is load-bearing (destination-environment-verification.md §1).
set -euo pipefail

FRAMEWORK_ROOT="${FRAMEWORK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/consumer-matrix-python-unfamiliar.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
CONSUMER="$WORK/consumer"
BARE="$WORK/origin.git"
LOG="$WORK/install.log"

fail() { echo "" ; echo "✗ FAIL: $*" >&2; exit 1; }
step() { echo ""; echo "── $*"; }

# Pin per ci-tool-pinning.md Rule A (bare run: installs require version pin).
# ast-grep is the only on-CI tool we install for the firing arm — pinned to the same
# version setup.d/45-python.sh:437 advertises in its degrade hint.
ASTGREP_VERSION='0.44.1'
ASTGREP_PKG="@ast-grep/cli@${ASTGREP_VERSION}"

# ── 1. Fixture: scripted fresh python project (FastAPI/SQLAlchemy-class) ──────────
step "fixture: fresh python project (FastAPI/SQLAlchemy-class, master default branch)"
mkdir -p "$CONSUMER" && cd "$CONSUMER"
git init -q -b master
git config user.email ci@example.com
git config user.name CI

# pyproject.toml: minimal PEP-621 project with FastAPI + SQLAlchemy as direct deps.
# These two packages are what the vendored METADATA will declare — Tier-1 needs them
# present as DIRECT deps (listDirectDeps in ecosystem-python.ts:249 reads [project]
# dependencies). `dependencies = [...]` on a single line because that is the shape
# pipAdapter's extractPep621Deps regex matches (single-line array, the parser's
# documented input shape).
cat > pyproject.toml <<'TOML'
[project]
name = "unfamiliar-consumer"
version = "0.1.0"
description = "W6 acceptance cell — python unfamiliar-stack e2e (getff S4)"
requires-python = ">=3.10"
dependencies = ["fastapi>=0.115", "sqlalchemy>=2.0"]

[tool.ruff]
line-length = 100
TOML

# A trivial app.py so the fixture has a body (the install does not need this to run,
# but the consumer tree should look non-empty for git push + downstream runs).
mkdir -p app
cat > app/__init__.py <<'PY'
"""Unfamiliar-stack consumer fixture (getff S4 W6 acceptance cell)."""
PY

# Tier-1 vendored metadata. We ARE NOT installing FastAPI/SQLAlchemy via pip — that
# would introduce PyPI network nondeterminism (kickoff §4 trigger #1). The vendor/pin
# alternative the same trigger explicitly allows: minimal .dist-info/METADATA files
# carrying `Project-URL: Documentation, <url>` so ecosystem-python.ts:281 readInstalledMeta
# derives the docs host. PEP 503 normalization makes `Name: SQLAlchemy` and the
# directory's `SqlAlchemy-` spelling both normalize to `sqlalchemy` — verified at
# ecosystem-python.ts:283 (normalizePep503).
mkdir -p .venv/lib/python3.12/site-packages
mkdir -p .venv/lib/python3.12/site-packages/fastapi-0.115.0.dist-info
mkdir -p .venv/lib/python3.12/site-packages/SqlAlchemy-2.0.36.dist-info

cat > .venv/lib/python3.12/site-packages/fastapi-0.115.0.dist-info/METADATA <<'META'
Metadata-Version: 2.1
Name: fastapi
Version: 0.115.0
Summary: FastAPI framework, high performance, easy to learn, ready for production
Home-page: https://github.com/fastapi/fastapi
Project-URL: Documentation, https://fastapi.tiangolo.com/
Project-URL: Source, https://github.com/fastapi/fastapi
META

cat > .venv/lib/python3.12/site-packages/SqlAlchemy-2.0.36.dist-info/METADATA <<'META'
Metadata-Version: 2.1
Name: SQLAlchemy
Version: 2.0.36
Summary: Database Abstraction Library
Home-page: https://www.sqlalchemy.org/
Project-URL: Documentation, https://docs.sqlalchemy.org/
Project-URL: Source, https://github.com/sqlalchemy/sqlalchemy
META

# A Tier-1-valid researched practice fixture. `allowlistKey: sqlalchemy.official` is
# ABSENT from packages/core/research/allowlist.ts (verified at entry — Tier-0 misses),
# forcing the Tier-1 path. `packageName: pip:sqlalchemy` carries the explicit ecosystem
# prefix the S4 ecosystem-name parser requires (research-source-trust.md §4: unprefixed
# names default to npm; pip-adapter lookup must carry the `pip:` prefix); `pip:sqlalchemy`
# strips to bare `sqlalchemy`, IS a direct dep in pyproject.toml; the vendored METADATA
# exposes docs.sqlalchemy.org as a `Project-URL: Documentation` host; the URL host
# matches → Tier-1 ADMITS → the rule renders.
cat > "$WORK/sqlalchemy-print-ban.practice.json" <<'JSON'
{
  "_comment": "W6 acceptance cell — Tier-1-valid researched practice. allowlistKey sqlalchemy.official is ABSENT from Tier-0 (allowlist.ts), forcing the Tier-1 path; packageName pip:sqlalchemy carries the explicit ecosystem prefix (research-source-trust.md §4); pip:sqlalchemy strips to bare sqlalchemy, IS a direct dep; vendored METADATA exposes docs.sqlalchemy.org; URL host matches → Tier-1 ADMITS.",
  "entryId": "getff-researched-sqlalchemy-print-ban",
  "title": "Prefer logger over print() in app code — Tier-1-valid researched rule",
  "stack": ["python"],
  "kind": "call",
  "presence": "forbid",
  "pattern": "print($$$ARGS)",
  "replacement": "logger.info($$$ARGS)",
  "examples": {
    "bad": "print(\"debug\")",
    "good": "logger.info(\"debug\")"
  },
  "provenance": [
    {
      "url": "https://docs.sqlalchemy.org/en/20/core/engines.html",
      "allowlistKey": "sqlalchemy.official",
      "packageName": "pip:sqlalchemy",
      "fetchedAt": "2026-08-07T00:00:00.000Z"
    }
  ],
  "defaultSeverity": "error"
}
JSON

# A Tier-1-REJECTABLE practice fixture. `pip:requests` strips to bare `requests`,
# which is NOT in pyproject.toml direct deps → Tier-1 FF2007 ("not a direct
# dependency") → research-only finding, no rule written. allowlistKey requests.official
# is absent from Tier-0 too, so the chain falls through Tier-1 (reject) → Tier-2 (no
# ack file) → reject.
cat > "$WORK/requests-not-dep.practice.json" <<'JSON'
{
  "_comment": "W6 acceptance cell — Tier-1-REJECTABLE researched practice. packageName pip:requests strips to bare requests, which is NOT a direct dep in pyproject.toml → FF2007 → research-only, no rule written.",
  "entryId": "getff-researched-requests-print-ban",
  "title": "REJECT arm — requests is not a direct dep, provenance must be rejected",
  "stack": ["python"],
  "kind": "call",
  "presence": "forbid",
  "pattern": "print($$$ARGS)",
  "replacement": "logger.info($$$ARGS)",
  "examples": {
    "bad": "print(\"x\")",
    "good": "logger.info(\"x\")"
  },
  "provenance": [
    {
      "url": "https://requests.readthedocs.io/en/latest/",
      "allowlistKey": "requests.official",
      "packageName": "pip:requests",
      "fetchedAt": "2026-08-07T00:00:00.000Z"
    }
  ],
  "defaultSeverity": "error"
}
JSON

# Bare origin + remote wiring so deliver_getff_workflow's `git symbolic-ref
# refs/remotes/origin/HEAD` resolves `master`. Without `git remote set-head origin
# master` the symbolic ref is unset (auto-set-head doesn't fire on push).
git init -q --bare "$BARE"
git remote add origin "$BARE"
git add -A
git commit -q -m "fixture: unfamiliar-stack python consumer (W6 cell)"
git push -q origin master
git remote set-head origin master

echo "  fixture at $CONSUMER (default branch: $(git symbolic-ref --short HEAD))"

# ── 2. install.sh python under Node-stripped PATH (F-A DECLARE) ───────────────────
step "install.sh python (Node-stripped PATH — F-A DECLARE on the install path)"

# Build a Node-stripped PATH to prove the python install lane is Node-free. The CI
# runner has Node (F-A DECLARE: Node in the CI RUNNER is fine — kickoff §6 anti-scope);
# the install PATH is the surface under test.
# ITERATIVE strip, not single-shot. `command -v X` reports only the FIRST match on PATH,
# so a one-pass enumeration misses a second copy in a directory further along. The GitHub
# runner has exactly that shape: setup-node's /opt/hostedtoolcache/node/<ver>/x64/bin AND a
# system /usr/local/bin/node. A single pass stripped the first and left the second, and the
# guard below then correctly refused to claim Node-freeness. Loop until no Node tool resolves
# (or nothing more can be removed), which is environment-agnostic — ubuntu runner and macOS
# host both converge.
NODE_STRIPPED_PATH="$PATH"
_strip_rounds=0
while [ "$_strip_rounds" -lt 20 ]; do
  _round_dirs=()
  for _tool in node npm npx; do
    _found="$(PATH="$NODE_STRIPPED_PATH" command -v "$_tool" 2>/dev/null || true)"
    if [ -n "$_found" ]; then _round_dirs+=("$(dirname "$_found")"); fi
  done
  [ "${#_round_dirs[@]}" -gt 0 ] || break   # nothing left to strip — converged
  _round_alt="$(printf '%s\n' "${_round_dirs[@]}" | sort -u | paste -sd'|' -)"
  _next="$(echo "$NODE_STRIPPED_PATH" | tr ':' '\n' | grep -vxE "$_round_alt" | paste -sd: -)"
  [ "$_next" != "$NODE_STRIPPED_PATH" ] || break   # no progress — the guard below reports it
  NODE_STRIPPED_PATH="$_next"
  _strip_rounds=$((_strip_rounds + 1))
done
if [ "$_strip_rounds" -eq 0 ]; then
  echo "  ⚠ no Node/npm/npx found to strip — F-A DECLARE still proven by the install's own _py_firing_self_check degrade hints"
else
  echo "  stripped Node tool dirs in $_strip_rounds pass(es)"
fi

if [ -z "$NODE_STRIPPED_PATH" ]; then
  # Refuse to fake-claim Node-freeness by silent-empty-PATH — that would only prove
  # the cell is structurally broken. Real CI has Node, and stripping is best-effort
  # but must not produce an empty PATH.
  fail "PATH stripping produced empty PATH — environment is not what the cell expects"
fi

# Verify the strip worked: `command -v node` under the stripped PATH must return empty.
# A non-empty result here means Node is reachable via a dir we did not strip — the
# F-A DECLARE proof is then incomplete (T-AST-B class — overclaiming the install path).
STRIPPED_NODE_CHECK="$(PATH="$NODE_STRIPPED_PATH" command -v node 2>/dev/null || true)"
if [ -n "$STRIPPED_NODE_CHECK" ]; then
  fail "PATH strip INCOMPLETE — node still reachable at $STRIPPED_NODE_CHECK under the stripped PATH (F-A DECLARE overclaim)"
fi
echo "  ✓ Node-stripped PATH verified: command -v node returns empty under stripped PATH"

# Run the install with Node stripped. We keep COREPACK, JQ etc. (non-Node tooling)
# but the lane should not invoke them — install.sh python is bash + jq-merge only
# per setup.d/45-python.sh:854-856.
PATH="$NODE_STRIPPED_PATH" bash "$FRAMEWORK_ROOT/install.sh" python --full --force > "$LOG" 2>&1 \
  || { echo "----- install.log (tail)"; tail -n 80 "$LOG"; fail "install.sh python exited non-zero"; }

echo "  ✓ install.sh python completed (Node-stripped PATH)"
echo "  install.log: $(wc -l < "$LOG") lines"

# ── 3. Assert agent surface present (S2 delivery) ────────────────────────────────
step "agent surface assertions (S2 curated 2-agent + skills + hooks + .mcp.json)"

# Skills (4-skill curated subset: getff, tool-bootstrapping, rule-research, rule-tests)
[ -d "$CONSUMER/.claude/skills/getff" ]                       || fail "missing .claude/skills/getff"
[ -d "$CONSUMER/.claude/skills/tool-bootstrapping" ]          || fail "missing .claude/skills/tool-bootstrapping"
[ -d "$CONSUMER/.claude/skills/rule-research" ]               || fail "missing .claude/skills/rule-research"
[ -d "$CONSUMER/.claude/skills/rule-tests" ]                  || fail "missing .claude/skills/rule-tests"
echo "  ✓ 4 curated skills present"

# Agents (curated 2-agent subset)
[ -f "$CONSUMER/.claude/agents/rule-researcher.md" ]          || fail "missing .claude/agents/rule-researcher.md (S2 delivery)"
[ -f "$CONSUMER/.claude/agents/rule-test-author.md" ]         || fail "missing .claude/agents/rule-test-author.md (S2 delivery)"
echo "  ✓ 2 curated agents present (rule-researcher, rule-test-author)"

# Hooks: deps-hash-check + inject-matching-rule
[ -f "$CONSUMER/.claude/hooks/inject-matching-rule.sh" ]      || fail "missing inject-matching-rule hook"
echo "  ✓ hooks delivered (inject-matching-rule.sh)"

# .claude/settings.json wires the hooks
[ -f "$CONSUMER/.claude/settings.json" ]                      || fail "missing .claude/settings.json"
jq -e '.hooks.PostToolUse' "$CONSUMER/.claude/settings.json" >/dev/null 2>&1 \
  || fail "settings.json missing PostToolUse wiring (inject-matching-rule)"
echo "  ✓ .claude/settings.json wires PostToolUse (inject-matching-rule)"

# .mcp.json with context7
[ -f "$CONSUMER/.mcp.json" ]                                  || fail "missing .mcp.json"
jq -e '.mcpServers.context7' "$CONSUMER/.mcp.json" >/dev/null 2>&1 \
  || fail ".mcp.json missing context7"
echo "  ✓ .mcp.json has context7"

# Starter AGENTS.md
[ -f "$CONSUMER/AGENTS.md" ]                                  || fail "missing starter AGENTS.md"
echo "  ✓ AGENTS.md present"

# .ai-factory/ subtree
[ -d "$CONSUMER/.ai-factory" ]                                || fail "missing .ai-factory/ subtree"
echo "  ✓ .ai-factory/ present"

# .getff/ substrate (starter rules + sgconfig)
[ -d "$CONSUMER/.getff/astgrep-rules" ]                       || fail "missing .getff/astgrep-rules (starter delivery)"
[ -f "$CONSUMER/.getff/astgrep-rules/getff-no-eval.yml" ]     || fail "missing starter rule getff-no-eval.yml"
[ -f "$CONSUMER/sgconfig.yml" ]                               || fail "missing sgconfig.yml"
echo "  ✓ starter rules + sgconfig delivered"

# ── 4. Tier-1 generation (rule-bootstrap-cli --from-practice, Node restored) ─────
step "rule-bootstrap-cli --from-practice (Tier-1 resolves via vendored METADATA)"

# Generation runs SESSION-SIDE — Node IS available in the CI runner (F-A DECLARE
# constrains the install path, not the runner per kickoff §6 anti-scope). Run via
# `npx --no-install tsx` from the framework root so the framework's tsx + workspace
# deps resolve (mirrors setup.d/80-rule-bootstrap.sh:70 — `cd $PKG_ROOT && npx --no-install tsx`).
BOOTSTRAP_LOG="$WORK/bootstrap.log"
( cd "$FRAMEWORK_ROOT" && npx --no-install tsx "$FRAMEWORK_ROOT/packages/core/install/rule-bootstrap-cli.ts" \
    --consumer-root "$CONSUMER" \
    --from-practice "$WORK/sqlalchemy-print-ban.practice.json" ) > "$BOOTSTRAP_LOG" 2>&1 \
  || { echo "----- bootstrap.log"; cat "$BOOTSTRAP_LOG"; fail "rule-bootstrap-cli exited non-zero on the VALID practice record"; }

# Assert the rule file landed.
RENDERED="$CONSUMER/.getff/rules-research/getff-researched-sqlalchemy-print-ban.yml"
[ -f "$RENDERED" ] \
  || { echo "----- bootstrap.log"; cat "$BOOTSTRAP_LOG"; fail "rendered rule file NOT at $RENDERED — Tier-1 generation did not produce a rule"; }

echo "  ✓ Tier-1 ADMITTED — rule rendered at .getff/rules-research/getff-researched-sqlalchemy-print-ban.yml"
echo "  rendered rule ($(wc -l < "$RENDERED") lines):"
sed 's/^/    /' "$RENDERED"

# Re-run install.sh python (--refresh) so _py_join_researched_rules joins the new rule
# into .getff/astgrep-rules/ (the dir sgconfig.yml points ast-grep at). The join runs
# on EVERY pass (setup.d/45-python.sh:203), so the refresh is what surfaces the rule
# to ast-grep's ruleDirs.
PATH="$NODE_STRIPPED_PATH" bash "$FRAMEWORK_ROOT/install.sh" python --refresh --force > "$LOG" 2>&1 \
  || { echo "----- refresh install.log (tail)"; tail -n 80 "$LOG"; fail "install.sh python --refresh exited non-zero"; }

# The joined rule should now be in astgrep-rules.
JOINED="$CONSUMER/.getff/astgrep-rules/getff-researched-sqlalchemy-print-ban.yml"
[ -f "$JOINED" ] \
  || fail "researched rule was NOT joined into .getff/astgrep-rules/ by the refresh pass (_py_join_researched_rules)"
echo "  ✓ researched rule joined into .getff/astgrep-rules/ via _py_join_researched_rules"

# ── 5. RED arm: ast-grep fires non-zero on a planted violation ───────────────────
step "RED arm — planted violation, ast-grep fires non-zero"

# Install ast-grep PINNED (ci-tool-pinning.md Rule A — bare `run:` install must pin).
# `npm install -g` rather than `npx -p` so the cell's later ast-grep invocations are
# straightforward; the version is the same setup.d/45-python.sh:437 advertises.
# The pin is REAL but INDIRECT: ASTGREP_PKG expands to @ast-grep/cli@0.44.1 (literal at :56).
# The pre-push regex gate resolves no variables, so these three lines carry the §3 escape token.
if ! npm install -g "$ASTGREP_PKG" > "$WORK/npm-install.log" 2>&1; then  # ci-tool-pin: allow pinned indirectly via ASTGREP_PKG=@ast-grep/cli@0.44.1, literal at :56
  echo "----- npm-install.log"
  cat "$WORK/npm-install.log"
  fail "npm install -g $ASTGREP_PKG failed"  # ci-tool-pin: allow error message, not an install
fi

# `npm install -g` lands in `npm prefix -g`/bin — that dir is not always on the runner's
# PATH (CI runners usually add it; container environments vary). Resolve it explicitly
# and prepend, so the cell does not depend on the runner's PATH being npm-aware.
NPM_GLOBAL_BIN="$(npm prefix -g)/bin"
case ":$PATH:" in
  *":$NPM_GLOBAL_BIN:"*) : ;;  # already present
  *) PATH="$NPM_GLOBAL_BIN:$PATH" ;;
esac
export PATH

# Confirm ast-grep is on PATH and is the pinned version. Belt-and-braces: also catch
# the Linux `sg` collision — `command -v sg` matches the setgid(1) coreutil, so the
# ast-grep binary is the only name we trust (mirrors setup.d/45-python.sh:404-410).
ASTGREP_BIN="$(command -v ast-grep || true)"
[ -n "$ASTGREP_BIN" ] || fail "ast-grep not on PATH after npm install -g (looked in: $NPM_GLOBAL_BIN)"  # ci-tool-pin: allow error message, not an install
ast-grep --version || fail "ast-grep --version exited non-zero"
echo "  ast-grep binary: $ASTGREP_BIN ($(ast-grep --version))"

# Plant a print() call — the new rule's `forbid` pattern targets `print($$$ARGS)`.
VIOLATION_FILE="$WORK/violation.py"
cat > "$VIOLATION_FILE" <<'PY'
def some_handler():
    print("this should fire the researched print ban")
PY

# ast-grep scan with the consumer's sgconfig.yml (which points ruleDirs at
# .getff/astgrep-rules — the dir the refresh populated with the new rule). cd into the
# consumer so the relative ruleDirs in sgconfig.yml resolves.
cd "$CONSUMER"
set +e
ast-grep scan "$VIOLATION_FILE" > "$WORK/red-arm.log" 2>&1
RED_RC=$?
set -e

echo "  ast-grep exit code on planted violation: $RED_RC"
echo "  red-arm.log:"
sed 's/^/    /' "$WORK/red-arm.log"

if [ "$RED_RC" -eq 0 ]; then
  fail "RED arm: ast-grep exited 0 on a planted print() — the researched rule is SILENT (delivery bug)"
fi
echo "  ✓ RED arm: ast-grep fired non-zero on planted print() — researched rule is live"

# ── 6. GREEN arm: ast-grep silent on clean conforming code ───────────────────────
step "GREEN arm — conforming code, ast-grep silent"

CLEAN_FILE="$WORK/clean.py"
cat > "$CLEAN_FILE" <<'PY'
import logging
logger = logging.getLogger(__name__)
def some_handler():
    logger.info("this is the conforming shape — no print() call")
PY

set +e
ast-grep scan "$CLEAN_FILE" > "$WORK/green-arm.log" 2>&1
GREEN_RC=$?
set -e

echo "  ast-grep exit code on clean code: $GREEN_RC"
echo "  green-arm.log:"
sed 's/^/    /' "$WORK/green-arm.log"

if [ "$GREEN_RC" -ne 0 ]; then
  fail "GREEN arm: ast-grep fired on conforming code — the researched rule is OVER-BROAD (a rule that matches every file is not enforcement)"
fi
echo "  ✓ GREEN arm: ast-grep silent on conforming code — researched rule discriminates"

# ── 7. REJECT arm: Tier-1 rejects the non-direct-dep practice record ─────────────
step "REJECT arm — Tier-1 rejects the requests-not-dep practice (FF2007, research-only)"

REJECT_LOG="$WORK/reject-bootstrap.log"
set +e
( cd "$FRAMEWORK_ROOT" && npx --no-install tsx "$FRAMEWORK_ROOT/packages/core/install/rule-bootstrap-cli.ts" \
    --consumer-root "$CONSUMER" \
    --from-practice "$WORK/requests-not-dep.practice.json" ) > "$REJECT_LOG" 2>&1
REJECT_RC=$?
set -e

echo "  rule-bootstrap-cli exit code on REJECT practice: $REJECT_RC"
echo "  reject-bootstrap.log (the research-only verdict must be loud):"
sed 's/^/    /' "$REJECT_LOG"

# The bootstrap CLI returns rc=0 on research-only findings (they're honest degrades,
# NOT errors — see rule-bootstrap-cli.ts:215 runPracticeRender header). The LOUD log
# line carries the verdict.
grep -F 'researched but not rendered' "$REJECT_LOG" >/dev/null 2>&1 \
  || fail "REJECT arm: research-only verdict NOT logged (the loud degrade is the contract — silent reject is T-AST-B)"
grep -F 'requests' "$REJECT_LOG" >/dev/null 2>&1 \
  || fail "REJECT arm: the rejected entryId (requests) is not named in the verdict log"

# Belt-and-braces: assert NO rule file was written for the rejected entryId. A silent
# write here would be the worst discipline-theatre shape (rejected-but-written).
if [ -f "$CONSUMER/.getff/rules-research/getff-researched-requests-print-ban.yml" ]; then
  ls -la "$CONSUMER/.getff/rules-research/" >&2
  fail "REJECT arm: a rule file WAS written for the rejected entryId — research-only verdict is silent theatre"
fi
echo "  ✓ REJECT arm: research-only verdict LOUD + no rule file written (honest degrade)"

# ── 8. R1-input assertion — delivered workflow trigger carries master ────────────
step "R1-input assertion — delivered workflow branches: [master]"

# The python lane delivers .github/workflows/getff-python.yml via deliver_getff_workflow
# (setup.d/45-python.sh:342 + setup.d/lib.sh:194), which sed-substitutes
# `branches: [main]` → `branches: [master]` because the consumer's default branch
# (git symbolic-ref origin/HEAD) is master. The `getff-python.yml` filename is
# namespaced to never clobber the consumer's own workflow (setup.d/45-python.sh:330).
DELIVERED_WF="$CONSUMER/.github/workflows/getff-python.yml"
[ -f "$DELIVERED_WF" ] || fail "delivered workflow missing at $DELIVERED_WF"

# Assert `branches: [master]` IS present (the R1-input W5.4 regression guard — the
# python lane has no other surface that re-resolves the trigger; this is the
# mechanism R1 §5.1 parked the question on).
if ! grep -F 'branches: [master]' "$DELIVERED_WF" >/dev/null 2>&1; then
  echo "----- delivered workflow (head)"; sed -n '1,20p' "$DELIVERED_WF"
  fail "R1-input: 'branches: [master]' not present in delivered workflow — deliver_getff_workflow did not substitute"
fi

# Belt-and-braces: assert `branches: [main]` is NOT present (the literal pre-substitution
# value the template carries). If both [main] and [master] are present, the substitution
# ran on only one of the two trigger blocks — a partial substitute is a regression.
MAIN_HITS=$(grep -Fc 'branches: [main]' "$DELIVERED_WF" || true)
if [ "$MAIN_HITS" -gt 0 ]; then
  echo "----- delivered workflow branches lines:"; grep -nF 'branches:' "$DELIVERED_WF" >&2
  fail "R1-input: 'branches: [main]' STILL present $MAIN_HITS time(s) — partial substitution"
fi
echo "  ✓ R1-input: 'branches: [master]' present, 'branches: [main]' absent (full substitution)"
echo "  delivered workflow trigger block (head):"
grep -nF 'branches:' "$DELIVERED_WF" | head -5 | sed 's/^/    /'

# ── 9. Summary — the cell discriminated (RED + GREEN + REJECT + R1-input) ─────────
step "W6 cell PASSED — all arms discriminated"
cat <<EOF
  fixture: python (FastAPI/SQLAlchemy class), default branch master, vendored .dist-info METADATA
  install: install.sh python under Node-stripped PATH (F-A DECLARE proven on install path)
  agent surface: 4 skills + 2 agents + hooks + .mcp.json + AGENTS.md + .ai-factory/ + .getff/
  Tier-1: rule-bootstrap-cli --from-practice admitted via docs.sqlalchemy.org host derivation
  RED: ast-grep fired non-zero (rc=$RED_RC) on planted print() violation — researched rule is live
  GREEN: ast-grep silent (rc=$GREEN_RC) on conforming logger.info() — rule discriminates
  REJECT: requests-not-dep practice downgraded to research-only (Tier-1 FF2007); no rule written
  R1-input: delivered workflow trigger carries branches: [master] (deliver_getff_workflow substitute)
EOF

echo ""
echo "✓ W6 acceptance cell — python unfamiliar-stack e2e (spec §9.1) PASSED"
