#!/usr/bin/env bash
# refresh-rewires.test.sh — `install.sh --refresh` re-does the WIRING a --full install does, not only
# the file copies (refresh backward-sweep 2026-09-29, gaps G1-G9).
#
# The static half is tests/install-sh/refresh-covers-full-delivery.test.sh Check 5 (every wiring call
# of the install has a do_refresh counterpart). This file runs each one end to end: install a
# consumer, take one piece of wiring away the way an older installer (or a lost edit) leaves it, run
# --refresh, and assert the wiring is back — or, where the consumer owns the surface, that it is left
# as it is and named in the NOT wired summary with its reason (Q4.7: a reason, never a manual step).
#
#   G1  deps-hash-check UserPromptSubmit registration
#   G2  core.hooksPath → .husky (and a consumer's own hooksPath kept + named)
#   G3  context7 in .mcp.json under --refresh --full; bare --refresh adds nothing
#   G4  R2 wiring: boundary globs into getff's root config; the per-workspace pass on a consumer config
#   G5  package.json scripts merged add-if-missing; a missing devDependency is named, never written
#   G6  CI gates a consumer workflow lacks are named; the workflow is not edited
#   G7  python lane: the .pre-commit-config.yaml getff entry is reconciled, a consumer edit is kept
#   G8  AIF_RECAP_GATE=1 under --refresh --full (operator decision 2026-09-29); bare --refresh leaves it
#   G9  the kind=mcp companion rows run under --refresh --full with the install's consent rules
#
# Deterministic: a `claude` stub on PATH records every call (no real MCP/plugin install); no network.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
command -v jq >/dev/null 2>&1 || { echo "FATAL: jq is required by this test"; exit 1; }

STUB_BIN=$(mktemp -d)
CLAUDE_LOG=$(mktemp)
cat > "$STUB_BIN/claude" <<'EOF'
#!/usr/bin/env bash
printf 'claude-stub %s\n' "$*" >> "$CLAUDE_LOG"
exit 0
EOF
chmod +x "$STUB_BIN/claude"
export CLAUDE_LOG PATH="$STUB_BIN:$PATH"
unset GETFF_GLOBAL 2>/dev/null || true
CLEANUP=("$STUB_BIN" "$CLAUDE_LOG")
trap 'rm -rf "${CLEANUP[@]}"' EXIT

# ts_consumer — a flat ts-server consumer after a plain (non --full) install.
ts_consumer() {
  local T; T=$(mktemp -d); CLEANUP+=("$T")
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$INSTALL" ts-server < /dev/null ) >/dev/null 2>&1
  echo "$T"
}
refresh() {  # refresh <dir> [flags…] → combined output
  local d="$1"; shift
  ( cd "$d" && bash "$INSTALL" --refresh "$@" < /dev/null 2>&1 )
}
not_wired() {  # stdin: installer output → the lines of its NOT wired summary (print_not_wired, lib.sh)
  awk '/framework piece\(s\) NOT wired/{on=1; next} on && /^      - /{print; next} on && !/^      - /{on=0}'
}

# ══ G1 — deps-hash-check registration ═════════════════════════════════════════════════════════
echo "▶ G1 deps-hash-check registration"
T=$(ts_consumer)
S="$T/.claude/settings.json"
jq '.hooks.UserPromptSubmit |= map(select(([.hooks[].command] | any(test("deps-hash-check"))) | not))' "$S" > "$S.t" && mv "$S.t" "$S"
grep -q deps-hash-check "$S" && bad "G1 precondition: registration still present after removal" || ok "G1 precondition: registration removed"
refresh "$T" --dry-run >/dev/null
grep -q deps-hash-check "$S" && bad "G1 neg: --dry-run registered the hook" || ok "G1 neg: --dry-run registers nothing"
refresh "$T" >/dev/null
[ "$(jq '[.hooks.UserPromptSubmit[]?.hooks[]?.command | select(test("deps-hash-check"))] | length' "$S")" = 1 ] \
  && ok "G1: --refresh registered deps-hash-check on UserPromptSubmit" \
  || bad "G1: --refresh did not register deps-hash-check: $(jq -c '.hooks.UserPromptSubmit' "$S")"
refresh "$T" >/dev/null
[ "$(jq '[.hooks.UserPromptSubmit[]?.hooks[]?.command | select(test("deps-hash-check"))] | length' "$S")" = 1 ] \
  && ok "G1: a second --refresh registers nothing twice" || bad "G1: duplicate registration after a second --refresh"

# ══ G2 — core.hooksPath ═══════════════════════════════════════════════════════════════════════
echo "▶ G2 core.hooksPath"
git -C "$T" config --unset core.hooksPath 2>/dev/null || true
refresh "$T" --dry-run >/dev/null
[ -z "$(git -C "$T" config --get core.hooksPath)" ] && ok "G2 neg: --dry-run sets nothing" || bad "G2 neg: --dry-run set core.hooksPath"
refresh "$T" >/dev/null
[ "$(git -C "$T" config --get core.hooksPath)" = .husky ] \
  && ok "G2: --refresh pointed core.hooksPath at .husky" \
  || bad "G2: core.hooksPath='$(git -C "$T" config --get core.hooksPath)' after --refresh (expected .husky)"
git -C "$T" config core.hooksPath my-hooks
out=$(refresh "$T")
[ "$(git -C "$T" config --get core.hooksPath)" = my-hooks ] \
  && ok "G2: a consumer's own core.hooksPath is kept" || bad "G2: --refresh repointed the consumer's own core.hooksPath"
grep -qF "framework git hooks (.husky/) — not active: core.hooksPath is already 'my-hooks'" <<<"$out" \
  && ok "G2: the kept hooksPath is named in the NOT wired summary" \
  || bad "G2: no NOT wired line for the kept hooksPath: $(grep -i hookspath <<<"$out" | tr '\n' '|')"
git -C "$T" config core.hooksPath .husky

# ══ G3 + G8 + G9 — the --full-gated steps ═════════════════════════════════════════════════════
echo "▶ G3/G8/G9 --full-gated steps"
rm -f "$T/.mcp.json"; : > "$CLAUDE_LOG"
[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$S")" = "" ] && ok "G8 precondition: a plain install leaves AIF_RECAP_GATE unset" \
  || bad "G8 precondition: AIF_RECAP_GATE already set by a plain install"
out=$(refresh "$T")
[ ! -e "$T/.mcp.json" ] && ok "G3 neg: bare --refresh creates no .mcp.json (the install gates it on --full)" \
  || bad "G3 neg: bare --refresh created .mcp.json"
[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$S")" = "" ] && ok "G8 neg: bare --refresh leaves AIF_RECAP_GATE unset" \
  || bad "G8 neg: bare --refresh armed AIF_RECAP_GATE"
grep -q 'kind=mcp' <<<"$out" && bad "G9 neg: bare --refresh processed the kind=mcp companion rows" \
  || ok "G9 neg: bare --refresh leaves the companion rows alone"
out=$(refresh "$T" --full)
[ "$(jq -r '.mcpServers.context7.command // empty' "$T/.mcp.json" 2>/dev/null)" = npx ] \
  && ok "G3: --refresh --full added context7 to .mcp.json" || bad "G3: no context7 in .mcp.json after --refresh --full"
[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$S")" = 1 ] \
  && ok "G8: --refresh --full armed AIF_RECAP_GATE=1" || bad "G8: AIF_RECAP_GATE not armed by --refresh --full"
_mcp_rows=$(awk -F'\t' '$0 !~ /^#/ && $4 == "mcp"' "$REPO_ROOT/setup.d/companions.manifest" | wc -l | tr -d ' ')
grep -qF "[05-mcp] processed $_mcp_rows kind=mcp manifest row(s)" <<<"$out" \
  && ok "G9: --refresh --full ran the $_mcp_rows kind=mcp companion row(s)" \
  || bad "G9: --refresh --full did not run the kind=mcp companion rows"
grep -q 'mcp add' "$CLAUDE_LOG" && bad "G9: a machine-global MCP server was added without --global: $(cat "$CLAUDE_LOG" | tr '\n' '|')" \
  || ok "G9: no machine-global install without --global (the install's consent rule holds)"

# ══ G5 — package.json scripts / devDependencies ═══════════════════════════════════════════════
echo "▶ G5 package.json scripts"
P="$T/package.json"
jq 'del(.scripts["check:globs"]) | del(.devDependencies.husky)' "$P" > "$P.t" && mv "$P.t" "$P"
out=$(refresh "$T")
[ "$(jq -r '.scripts["check:globs"] // empty' "$P")" = "bash scripts/check-rule-globs.sh" ] \
  && ok "G5: --refresh merged the missing check:globs script" || bad "G5: check:globs not merged by --refresh"
[ -z "$(jq -r '.devDependencies.husky // empty' "$P")" ] \
  && ok "G5: --refresh did not write a devDependency (the lockfile would go out of step)" \
  || bad "G5: --refresh wrote husky into devDependencies without installing it"
grep -q 'husky' <<<"$(not_wired <<<"$out")" \
  && ok "G5: the missing husky devDependency is named in the NOT wired summary" \
  || bad "G5: no NOT wired line for the missing husky devDependency"
cp "$P" "$P.before"; refresh "$T" >/dev/null
cmp -s "$P" "$P.before" && ok "G5: a --refresh with nothing to add leaves package.json byte-identical" \
  || bad "G5: --refresh rewrote package.json with nothing to add"

# ══ G6 — CI gates missing from a consumer workflow ════════════════════════════════════════════
echo "▶ G6 CI gates"
W="$T/.github/workflows/ci.yml"
mkdir -p "$T/.github/workflows"
printf 'name: ci\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n' > "$W"
cp "$W" "$W.before"
out=$(refresh "$T")
grep -qF 'CI gate check:globs' <<<"$(not_wired <<<"$out")" \
  && ok "G6: --refresh names the CI gate the consumer's workflow lacks" || bad "G6: no NOT wired line for the missing CI gates"
cmp -s "$W" "$W.before" && ok "G6: the consumer's workflow is not edited" || bad "G6: --refresh edited the consumer's workflow"
grep -F 'CI gate check:globs' <<<"$out" | grep -qF -- '--refresh does not edit it' \
  && ok "G6: the line's reason is --refresh's own (it never edits the workflow)" \
  || bad "G6: the NOT wired line does not say why --refresh left the workflow alone"

# ══ G4 — R2 wiring ════════════════════════════════════════════════════════════════════════════
echo "▶ G4 R2 wiring"
# getff's template already lists the five token folders (routes/, handlers/, …); a zod parse site
# elsewhere yields a glob the template does not carry — the one a refresh must add.
C="$T/eslint.config.mjs"
LIBG="'**/lib/**/*.{ts,tsx}'"
grep -qF "$LIBG" "$C" && bad "G4 precondition: lib glob already in RULE_GLOBS.boundary" \
  || ok "G4 precondition: no lib/ boundary glob before the parse site exists"
mkdir -p "$T/src/lib"; printf "import { z } from 'zod';\nexport const f = (b: unknown) => z.object({}).parse(b);\n" > "$T/src/lib/input.ts"
refresh "$T" --dry-run >/dev/null
grep -qF "$LIBG" "$C" && bad "G4 neg: --dry-run wrote the glob" || ok "G4 neg: --dry-run writes no glob"
refresh "$T" >/dev/null
grep -qF "$LIBG" "$C" \
  && ok "G4: --refresh added the lib/ parse-site glob to getff's RULE_GLOBS.boundary" \
  || bad "G4: --refresh did not wire R2's boundary glob into getff's eslint.config.mjs"
# Per-workspace pass on a config the consumer owns (the #1881 fix). No ts-morph in node_modules: the
# pass cannot write, so it names the config — proof the pass ran on --refresh.
M=$(mktemp -d); CLEANUP+=("$M")
printf '{ "name":"mono","private":true,"devDependencies":{"typescript":"5.6.0"} }\n' > "$M/package.json"
printf 'packages:\n  - "apps/*"\n' > "$M/pnpm-workspace.yaml"
mkdir -p "$M/apps/api/src"
printf '{ "name":"@m/api","devDependencies":{"typescript":"5.6.0"} }\n' > "$M/apps/api/package.json"
printf 'export default [];\n' > "$M/apps/api/eslint.config.mjs"
( cd "$M" && git init -q && bash "$INSTALL" ts-server < /dev/null ) >/dev/null 2>&1
mkdir -p "$M/apps/api/src/routes"; printf 'export const u = 1;\n' > "$M/apps/api/src/routes/users.ts"
out=$(refresh "$M")
grep -qF 'R2 (rules-as-tests/no-unsafe-zod-parse) in apps/api/eslint.config.mjs' <<<"$(not_wired <<<"$out")" \
  && ok "G4: --refresh runs the per-workspace R2 pass (names the consumer's apps/api config)" \
  || bad "G4: the per-workspace R2 pass did not run on --refresh: $(grep -i 'r2' <<<"$out" | tr '\n' '|')"
grep -qF 'this install was not --full' <<<"$out" && bad "G4: a --refresh reason speaks of «this install»" \
  || ok "G4: the ts-morph reason is worded for --refresh"

# ══ G7 — python .pre-commit-config.yaml entry ═════════════════════════════════════════════════
echo "▶ G7 python pre-commit entry"
MARK='# getff-python-pre-push entry — delivered by setup.d/45-python.sh'
FRAG="$REPO_ROOT/packages/core/templates/python/hooks/getff.pre-commit-config.yaml.fragment"
# The entry as the first shipped version (a66c0cb9aa4, #1233) appended it: marker, body, no end line.
V1_BODY=$(cat <<'V1'
# getff pre-push entry — append into your .pre-commit-config.yaml to run the getff python
# pre-push rung via the pre-commit framework's pre-push stage.
#
# Delivered by setup.d/45-python.sh; the script body lives at .getff/hooks/pre-push. REMOVE
# this entry (or run with `SKIP=getff-python-pre-push ...`) to disable. After appending, run
# `pre-commit install --hook-type pre-push` to register the pre-push stage with git.
- repo: local
  hooks:
    - id: getff-python-pre-push
      name: getff Python pre-push (ast-grep + ruff)
      entry: .getff/hooks/pre-push
      language: system
      stages: [pre-push]
      pass_filenames: false
V1
)
[ "$(cat "$FRAG")" != "$V1_BODY" ] && ok "G7 precondition: the shipped fragment differs from its first version (reconcile is observable)" \
  || bad "G7 precondition: the fragment still equals its first version — the replace arm below proves nothing"
py_consumer() {  # $1 = entry body to leave after the marker (pre-fix shape: no end line)
  local Y; Y=$(mktemp -d); CLEANUP+=("$Y")
  printf '[project]\nname = "demo"\n' > "$Y/pyproject.toml"
  printf 'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks\n    rev: v4.6.0\n    hooks:\n      - id: trailing-whitespace\n' > "$Y/.pre-commit-config.yaml"
  ( cd "$Y" && git init -q && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  printf 'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks\n    rev: v4.6.0\n    hooks:\n      - id: trailing-whitespace\n\n%s\n%s\n' "$MARK" "$1" > "$Y/.pre-commit-config.yaml"
  echo "$Y"
}
Y=$(py_consumer "$V1_BODY")
( cd "$Y" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
_got=$(awk -v m="$MARK" '$0==m{on=1; next} on&&/^# getff-python-pre-push entry end/{exit} on' "$Y/.pre-commit-config.yaml")
[ "$_got" = "$(cat "$FRAG")" ] \
  && ok "G7: --refresh replaced a shipped earlier entry with the current fragment" \
  || bad "G7: the getff entry is not the current fragment after --refresh"
grep -q '^# getff-python-pre-push entry end' "$Y/.pre-commit-config.yaml" \
  && ok "G7: the entry now ends with an end line (the next reconcile knows where it stops)" \
  || bad "G7: no end line after the reconciled entry"
[ "$(grep -cF "$MARK" "$Y/.pre-commit-config.yaml")" = 1 ] && ok "G7: exactly one getff entry" \
  || bad "G7: $(grep -cF "$MARK" "$Y/.pre-commit-config.yaml") getff entries after --refresh"
cp "$Y/.pre-commit-config.yaml" "$Y/pc.before"
( cd "$Y" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
cmp -s "$Y/.pre-commit-config.yaml" "$Y/pc.before" && ok "G7: a second --refresh leaves the file byte-identical" \
  || bad "G7: a second --refresh changed .pre-commit-config.yaml"
# A consumer edit of getff's entry is theirs: kept byte-identical, named with the reason.
Y2=$(py_consumer "$(printf '%s\n        args: [--consumer]' "$V1_BODY")")
cp "$Y2/.pre-commit-config.yaml" "$Y2/pc.before"
out=$( cd "$Y2" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
cmp -s "$Y2/.pre-commit-config.yaml" "$Y2/pc.before" && ok "G7: an edited getff entry is kept as it is" \
  || bad "G7: --refresh overwrote an edited getff entry"
grep -qF '.pre-commit-config.yaml' <<<"$(not_wired <<<"$out")" \
  && ok "G7: the kept edited entry is named in the NOT wired summary" \
  || bad "G7: no NOT wired line for the kept edited entry"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
