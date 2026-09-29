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
#   G7  python lane: the .pre-commit-config.yaml getff entry is reconciled (at the indent it was
#       written at), a consumer edit is kept
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
# A value the consumer set is theirs: an explicit "0" is an opt-out, not a gate to arm.
jq '.env.AIF_RECAP_GATE = "0"' "$S" > "$S.t" && mv "$S.t" "$S"
out=$(refresh "$T" --full)
[ "$(jq -r '.env.AIF_RECAP_GATE' "$S")" = 0 ] \
  && ok "G8: --refresh --full keeps a consumer's AIF_RECAP_GATE=\"0\"" \
  || bad "G8: --refresh --full overwrote the consumer's AIF_RECAP_GATE=\"0\""
grep -qF 'AIF_RECAP_GATE in .claude/settings.json — not armed' <<<"$(not_wired <<<"$out")" \
  && ok "G8: the kept opt-out is named in the NOT wired summary" || bad "G8: no NOT wired line for the kept opt-out"
jq 'del(.env.AIF_RECAP_GATE)' "$S" > "$S.t" && mv "$S.t" "$S"

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
grep -qF 'devDependency husky (' <<<"$(not_wired <<<"$out")" \
  && ok "G5: the missing husky devDependency is named in the NOT wired summary" \
  || bad "G5: no NOT wired line for the missing husky devDependency"
cp "$P" "$P.before"; refresh "$T" >/dev/null
cmp -s "$P" "$P.before" && ok "G5: a --refresh with nothing to add leaves package.json byte-identical" \
  || bad "G5: --refresh rewrote package.json with nothing to add"
# `prepare: husky` with no husky behind it fails the consumer's next `npm install` (exit 127): a
# consumer without the husky devDependency (moved to lefthook, say) gets no `prepare` from a refresh.
jq 'del(.scripts.prepare)' "$P" > "$P.t" && mv "$P.t" "$P"
out=$(refresh "$T")
[ -z "$(jq -r '.scripts.prepare // empty' "$P")" ] \
  && ok "G5: no husky devDependency → --refresh adds no \`prepare: husky\`" \
  || bad "G5: --refresh added prepare=husky to a package.json without husky (npm install would exit 127)"
grep -qF 'script "prepare" in package.json' <<<"$(not_wired <<<"$out")" \
  && ok "G5: the withheld prepare script is named in the NOT wired summary" \
  || bad "G5: no NOT wired line for the withheld prepare script"
# A package.json that does not parse fails the merge, not the refresh: the baseline flush still runs.
cp "$P" "$P.good"; printf '{ "name": "consumer",\n<<<<<<< HEAD\n' > "$P"
out=$(refresh "$T"); rc=$?
[ "$rc" = 0 ] && grep -qF 'Framework artefacts refreshed' <<<"$out" \
  && ok "G5: an unparseable package.json does not abort the refresh" \
  || bad "G5: --refresh aborted on an unparseable package.json (rc=$rc)"
grep -qF 'package.json scripts — not merged: package.json does not parse as JSON' <<<"$(not_wired <<<"$out")" \
  && ok "G5: the unparseable package.json is named in the NOT wired summary" \
  || bad "G5: no NOT wired line for the unparseable package.json"
mv "$P.good" "$P"

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
grep -qF -- '--refresh does not edit it' <<<"$(grep -F 'CI gate check:globs' <<<"$out")" \
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
_frag_sha=$( (sha256sum "$FRAG" 2>/dev/null || shasum -a 256 "$FRAG") | awk '{print $1}')
grep -qF "$_frag_sha:$(wc -l < "$FRAG" | tr -d ' ')" "$REPO_ROOT/setup.d/45-python.sh" \
  && ok "G7: the current fragment is in 45-python.sh's shipped-entry list (a changed fragment cannot orphan installed entries)" \
  || bad "G7: the current fragment's sha256:lines ($_frag_sha) is missing from _PY_PRECOMMIT_SHIPPED — installed entries of it would read as edits"
# The fixture's repos: items sit at two spaces; an entry at that indent is what the install writes since
# C3 (#1935).
_ind() { sed 's/^./  &/'; }
# _pc_parses <dir> <label> — the dir's .pre-commit-config.yaml loads as YAML (js-yaml, a packages/core
# dependency, as python-entry-lane (16f) loads it) and its repos: hold the consumer's hook and getff's.
# A getff entry left in column 0 under indented repos: items is «expected <block end>, but found '-'»:
# pre-commit cannot load the file, so no hook of the project runs.
_pc_parses() {
  local got
  got=$(node -e '
    const r = require("module").createRequire(process.argv[1] + "/packages/core/package.json");
    const doc = r("js-yaml").load(require("fs").readFileSync(process.argv[2], "utf8"));
    console.log(doc.repos.flatMap((x) => (x.hooks || []).map((h) => h.id)).sort().join(","));
  ' "$REPO_ROOT" "$1/.pre-commit-config.yaml" 2>&1)
  [ "$got" = "getff-python-pre-push,trailing-whitespace" ] && ok "$2 parses as YAML, hooks = $got" \
    || bad "$2 does not parse as YAML with both hooks: $(tail -3 <<<"$got" | tr '\n' '|')"
}
py_consumer() {  # $1 = entry body to leave after the marker (pre-fix shape: no end line)
  local Y; Y=$(mktemp -d); CLEANUP+=("$Y")
  printf '[project]\nname = "demo"\n' > "$Y/pyproject.toml"
  printf 'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks\n    rev: v4.6.0\n    hooks:\n      - id: trailing-whitespace\n' > "$Y/.pre-commit-config.yaml"
  ( cd "$Y" && git init -q && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  printf 'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks\n    rev: v4.6.0\n    hooks:\n      - id: trailing-whitespace\n\n%s\n%s\n' "$MARK" "$1" > "$Y/.pre-commit-config.yaml"
  echo "$Y"
}
# The entry sits in column 0 (written before C3, #1935) under the fixture's indented repos: items, so
# the file is invalid YAML until the entry moves to the items' indent.
Y=$(py_consumer "$V1_BODY")
( cd "$Y" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
_got=$(awk -v m="$MARK" '$0==m{on=1; next} on&&/^# getff-python-pre-push entry end/{exit} on' "$Y/.pre-commit-config.yaml")
[ "$_got" = "$(_ind < "$FRAG")" ] \
  && ok "G7: --refresh replaced a shipped earlier column-0 entry with the current fragment, at the indent of the repos: items" \
  || bad "G7: the getff entry is not the current fragment at the repos: items' indent after --refresh"
_pc_parses "$Y" "G7: the file after --refresh of a column-0 earlier entry"
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
grep -qF 'getff-python-pre-push entry in .pre-commit-config.yaml — not updated' <<<"$(not_wired <<<"$out")" \
  && ok "G7: the kept edited entry is named in the NOT wired summary" \
  || bad "G7: no NOT wired line for the kept edited entry"

# A consumer item in column 0 next to a column-0 getff entry, under indented repos: items. The file does
# not load as YAML before the refresh, and no placement of getff's entry makes it load: the stray item is
# the project's own, and getff does not re-indent it. So the file is left as it was, the entry is named
# with the line that breaks it, nothing claims «updated» or «no-op», and no pre-push stage is installed for
# an entry pre-commit cannot read (the mirror-check line records that gap instead, as for an entry not
# added).
# _stray_item_left <dir> <label> — those five facts for the fixture in <dir> (pc.before = before the run,
# out = the run's output, the stray item's text = its only line containing example.invalid).
_nw_noload='getff-python-pre-push entry in .pre-commit-config.yaml — not updated: line'
_stray_item_left() {
  local d="$1" label="$2" ln nw
  ln=$(grep -n 'example.invalid' "$d/pc.before" | cut -d: -f1)
  nw=$(not_wired <<<"$out")
  cmp -s "$d/.pre-commit-config.yaml" "$d/pc.before" && ok "G7: $label — the file is left as it was" \
    || bad "G7: $label — --refresh changed the file"
  grep -qE 'updated the getff entry|already has the current getff entry' <<<"$out" \
    && bad "G7: $label — --refresh claims the entry is updated or current: $(grep -E 'updated the getff entry|already has the current getff entry' <<<"$out")" \
    || ok "G7: $label — no «updated» or «no-op» claim"
  grep -qF "$_nw_noload $ln is a repos: item in column 0" <<<"$nw" \
    && ok "G7: $label — the NOT wired summary names the entry and line $ln as the reason" \
    || bad "G7: $label — no NOT wired line naming line $ln: $(grep -F 'getff-python-pre-push entry' <<<"$nw" | tr '\n' '|')"
  grep -qF 'pre-commit pre-push stage' <<<"$out" && bad "G7: $label — a pre-push stage was attempted for an entry pre-commit cannot read" \
    || ok "G7: $label — no pre-push stage for an entry pre-commit cannot read"
  grep -qF 'no hook runs it — the getff entry in .pre-commit-config.yaml cannot run' <<<"$nw" \
    && ok "G7: $label — the mirror-check gap is named" || bad "G7: $label — no mirror-check NOT wired line"
}
# After a pre-end-line entry (the shape --refresh read as getff's own and rewrote before C6-F3).
Y3=$(py_consumer "$(printf '%s\n- repo: https://example.invalid/after\n  rev: v1' "$V1_BODY")")
cp "$Y3/.pre-commit-config.yaml" "$Y3/pc.before"
out=$( cd "$Y3" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
_stray_item_left "$Y3" "a column-0 consumer item after a column-0 earlier entry"
# After a current column-0 entry with its end line.
Y11=$(py_consumer "$(printf '%s\n# getff-python-pre-push entry end\n- repo: https://example.invalid/after\n  rev: v1' "$(cat "$FRAG")")")
cp "$Y11/.pre-commit-config.yaml" "$Y11/pc.before"
out=$( cd "$Y11" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
_stray_item_left "$Y11" "a column-0 consumer item after a current column-0 entry with its end line"
# Before the entry: the same break, found ahead of getff's entry.
Y12=$(py_consumer "$V1_BODY")
printf 'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks\n    rev: v4.6.0\n    hooks:\n      - id: trailing-whitespace\n- repo: https://example.invalid/before\n  rev: v1\n\n%s\n%s\n' "$MARK" "$V1_BODY" > "$Y12/.pre-commit-config.yaml"
cp "$Y12/.pre-commit-config.yaml" "$Y12/pc.before"
out=$( cd "$Y12" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
_stray_item_left "$Y12" "a column-0 consumer item before a column-0 earlier entry"
# After a CURRENT entry at the items' indent, with its end line (train C6 cold review, M2). The entry needs
# no update, so --refresh took the idempotent no-op path, which returned before the stray-item check: it
# said «no-op», installed the pre-push stage, and left a file pre-commit cannot load.
Y14=$(py_consumer "$(printf '%s\n# getff-python-pre-push entry end\n- repo: https://example.invalid/after\n  rev: v1\n  hooks:\n    - id: x' "$(_ind < "$FRAG")")")
cp "$Y14/.pre-commit-config.yaml" "$Y14/pc.before"
out=$( cd "$Y14" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
_stray_item_left "$Y14" "a column-0 consumer item after a current entry at the items' indent"
# The same shape as staging's C5-F2 code wrote it: a Y3 file refreshed once by the reconcile without the
# stray-item check (what the code before C6-F3 was), which moved getff's entry to the items' indent and
# left the consumer item in column 0; then refreshed by this code, twice.
Y15=$(py_consumer "$(printf '%s\n- repo: https://example.invalid/after\n  rev: v1' "$V1_BODY")")
( cd "$Y15" && PROJECT_ROOT="$Y15" INSTALL_SH_LIB_ONLY=1 bash -c '
    source "$1/setup.d/lib.sh"; PY_LAYER_LIB_ONLY=1 source "$1/setup.d/45-python.sh"
    _py_precommit_stray_item() { :; }
    DRY_RUN=""; _py_precommit_reconcile .pre-commit-config.yaml "$2" "# getff-python-pre-push entry end" "$3"
  ' _ "$REPO_ROOT" "$MARK" "$FRAG" ) >/dev/null 2>&1
_got=$(awk -v m="$MARK" '$0==m{on=1; next} on&&/^# getff-python-pre-push entry end/{exit} on' "$Y15/.pre-commit-config.yaml")
[ "$_got" = "$(_ind < "$FRAG")" ] && grep -q '^- repo: https://example.invalid/after$' "$Y15/.pre-commit-config.yaml" \
  && ok "G7 precondition: the first refresh wrote C5-F2's shape (current entry at the items' indent, consumer item in column 0)" \
  || bad "G7 precondition: the first refresh did not write C5-F2's shape — the arms below prove nothing"
cp "$Y15/.pre-commit-config.yaml" "$Y15/pc.before"
out=$( cd "$Y15" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
_stray_item_left "$Y15" "a file C5-F2's refresh left with a column-0 consumer item"
out=$( cd "$Y15" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
_stray_item_left "$Y15" "a second --refresh of that file"
# pre-commit's own sample style: EVERY repos: item in column 0, which is valid YAML, with a column-0 earlier
# getff entry and a consumer item after it (train C6 cold review, M3). Column 0 is the items' indent here,
# so no item is stray: the entry is updated in column 0, the file loads, the consumer item stays, and the
# pre-push stage runs; the next --refresh is the no-op. This pins the `[ -z "$want" ] ||` guards in
# _py_precommit_reconcile — without them every item of this file reads as a stray one.
Y13=$(py_consumer "$V1_BODY")
printf 'repos:\n-   repo: https://github.com/pre-commit/pre-commit-hooks\n    rev: v4.6.0\n    hooks:\n    -   id: trailing-whitespace\n\n%s\n%s\n-   repo: https://example.invalid/after\n    rev: v1\n' "$MARK" "$V1_BODY" > "$Y13/.pre-commit-config.yaml"
out=$( cd "$Y13" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
_got=$(awk -v m="$MARK" '$0==m{on=1; next} on&&/^# getff-python-pre-push entry end/{exit} on' "$Y13/.pre-commit-config.yaml")
grep -qF 'updated the getff entry in .pre-commit-config.yaml' <<<"$out" && [ "$_got" = "$(cat "$FRAG")" ] \
  && ok "G7: column-0 repos: items (pre-commit's sample style) — the earlier entry is updated, in column 0" \
  || bad "G7: column-0 repos: items — the earlier entry was not updated to the current fragment in column 0: $(grep -F 'getff entry' <<<"$out" | tr '\n' '|')"
_pc_parses "$Y13" "G7: column-0 repos: items — the file after --refresh"
grep -q '^-   repo: https://example.invalid/after$' "$Y13/.pre-commit-config.yaml" \
  && ok "G7: column-0 repos: items — the consumer item after the entry is kept" \
  || bad "G7: column-0 repos: items — the consumer item after the entry is gone"
grep -qF 'not updated' <<<"$out" && bad "G7: column-0 repos: items — a «not updated» line: $(grep -F 'not updated' <<<"$out" | head -1)" \
  || ok "G7: column-0 repos: items — no «not updated» line"
grep -qF 'pre-commit pre-push stage' <<<"$out" && ok "G7: column-0 repos: items — the pre-push stage runs" \
  || bad "G7: column-0 repos: items — no pre-push stage for a file that loads"
cp "$Y13/.pre-commit-config.yaml" "$Y13/pc.before"
out=$( cd "$Y13" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
cmp -s "$Y13/.pre-commit-config.yaml" "$Y13/pc.before" && grep -qF 'already has the current getff entry' <<<"$out" \
  && ok "G7: column-0 repos: items — a second --refresh is the no-op, byte-identical" \
  || bad "G7: column-0 repos: items — a second --refresh is not the no-op: $(grep -F 'getff entry' <<<"$out" | tr '\n' '|')"
# An edited entry that already has its end line is kept too.
Y4=$(py_consumer "$(printf '%s\n        args: [--consumer]\n# getff-python-pre-push entry end' "$(cat "$FRAG")")")
cp "$Y4/.pre-commit-config.yaml" "$Y4/pc.before"
( cd "$Y4" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
cmp -s "$Y4/.pre-commit-config.yaml" "$Y4/pc.before" && ok "G7: an edited entry with its end line is kept as it is" \
  || bad "G7: --refresh overwrote an edited entry that has its end line"

# A CRLF file (Windows, autocrlf) is the same entry: matched, never appended a second time. The entry is
# current and at the items' indent, as the install writes it.
Y5=$(py_consumer "$(printf '%s\n# getff-python-pre-push entry end' "$(_ind < "$FRAG")")")
sed 's/$/\r/' "$Y5/.pre-commit-config.yaml" > "$Y5/crlf" && mv "$Y5/crlf" "$Y5/.pre-commit-config.yaml"
cp "$Y5/.pre-commit-config.yaml" "$Y5/pc.before"
( cd "$Y5" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
[ "$(grep -c '^# getff-python-pre-push entry — delivered' "$Y5/.pre-commit-config.yaml")" = 1 ] \
  && ok "G7: a CRLF .pre-commit-config.yaml keeps exactly one getff entry" \
  || bad "G7: $(grep -c '^# getff-python-pre-push entry — delivered' "$Y5/.pre-commit-config.yaml") getff entries in a CRLF file after --refresh"
cmp -s "$Y5/.pre-commit-config.yaml" "$Y5/pc.before" && ok "G7: a current entry in a CRLF file is left byte-identical" \
  || bad "G7: --refresh changed a CRLF file whose getff entry is current"
# A CRLF file with a shipped earlier entry is updated, and stays CRLF throughout.
Y6=$(py_consumer "$V1_BODY")
sed 's/$/\r/' "$Y6/.pre-commit-config.yaml" > "$Y6/crlf" && mv "$Y6/crlf" "$Y6/.pre-commit-config.yaml"
( cd "$Y6" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
_got=$(tr -d '\r' < "$Y6/.pre-commit-config.yaml" | awk -v m="$MARK" '$0==m{on=1; next} on&&/^# getff-python-pre-push entry end/{exit} on')
[ "$_got" = "$(_ind < "$FRAG")" ] && ! grep -qv $'\r$' "$Y6/.pre-commit-config.yaml" \
  && ok "G7: a CRLF file's shipped earlier entry is updated at the items' indent, every line still CRLF" \
  || bad "G7: the CRLF update is wrong (body current at the items' indent: $([ "$_got" = "$(_ind < "$FRAG")" ] && echo y || echo n); LF-only lines: $(grep -cv $'\r$' "$Y6/.pre-commit-config.yaml"))"
_pc_parses "$Y6" "G7: the CRLF file after --refresh of a column-0 earlier entry"

# An entry at the indent of the file's `repos:` items — how the install writes it since C3 (#1935) — is
# the same entry: a current one is left alone, an earlier shipped one is updated at that indent.
_nw_edit='getff-python-pre-push entry in .pre-commit-config.yaml — not updated'
Y7=$(mktemp -d); CLEANUP+=("$Y7")
printf '[project]\nname = "demo"\n' > "$Y7/pyproject.toml"
printf 'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks\n    rev: v4.6.0\n    hooks:\n      - id: trailing-whitespace\n' > "$Y7/.pre-commit-config.yaml"
( cd "$Y7" && git init -q && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
grep -q '^  - repo: local$' "$Y7/.pre-commit-config.yaml" \
  && ok "G7 precondition: the install wrote the entry at the indent of the file's repos: items" \
  || bad "G7 precondition: the install did not indent the entry to the repos: items"
cp "$Y7/.pre-commit-config.yaml" "$Y7/pc.before"
out=$( cd "$Y7" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
cmp -s "$Y7/.pre-commit-config.yaml" "$Y7/pc.before" && ok "G7: --refresh leaves a current indented entry byte-identical" \
  || bad "G7: --refresh changed a file whose indented getff entry is current"
grep -qF "$_nw_edit" <<<"$(not_wired <<<"$out")" \
  && bad "G7: --refresh names a current indented entry as an edit in the NOT wired summary" \
  || ok "G7: a current indented entry is not named as an edit"
# An indented earlier entry with no end line (C3 wrote the first fragment that way) is updated in place.
Y8=$(py_consumer "$(_ind <<<"$V1_BODY")")
out=$( cd "$Y8" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
_got=$(awk -v m="$MARK" '$0==m{on=1; next} on&&/^# getff-python-pre-push entry end/{exit} on' "$Y8/.pre-commit-config.yaml")
[ "$_got" = "$(_ind < "$FRAG")" ] && ok "G7: an indented earlier entry is updated to the current fragment, at its indent" \
  || bad "G7: the indented earlier entry is not the current fragment at its indent after --refresh"
grep -qF "$_nw_edit" <<<"$(not_wired <<<"$out")" \
  && bad "G7: an indented earlier entry is named as an edit instead of being updated" \
  || ok "G7: an indented earlier entry is not named as an edit"
cp "$Y8/.pre-commit-config.yaml" "$Y8/pc.before"
( cd "$Y8" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
cmp -s "$Y8/.pre-commit-config.yaml" "$Y8/pc.before" && ok "G7: a second --refresh leaves the updated indented entry byte-identical" \
  || bad "G7: a second --refresh changed the updated indented entry"
# The next item of the same sequence, at the entry's indent, does not make the entry an edit.
Y9=$(py_consumer "$(printf '%s\n  - repo: https://example.invalid/after\n    rev: v1' "$(_ind <<<"$V1_BODY")")")
( cd "$Y9" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
_got=$(awk -v m="$MARK" '$0==m{on=1; next} on&&/^# getff-python-pre-push entry end/{exit} on' "$Y9/.pre-commit-config.yaml")
awk '/^# getff-python-pre-push entry end/{e=1} e && /example.invalid\/after/{f=1} END{exit !f}' "$Y9/.pre-commit-config.yaml" \
  && [ "$_got" = "$(_ind < "$FRAG")" ] \
  && ok "G7: an indented earlier entry followed by a consumer item is updated, the item kept after it" \
  || bad "G7: an indented earlier entry followed by a consumer item was kept as an edit, or lost the item"
# A current entry in column 0 with its end line, under indented items — what --refresh wrote for a
# pre-#1935 entry before C5-F2 — is moved to the items' indent too, and is then left alone.
Y10=$(py_consumer "$(printf '%s\n# getff-python-pre-push entry end' "$(cat "$FRAG")")")
out=$( cd "$Y10" && bash "$INSTALL" python --refresh < /dev/null 2>&1 )
_got=$(awk -v m="$MARK" '$0==m{on=1; next} on&&/^# getff-python-pre-push entry end/{exit} on' "$Y10/.pre-commit-config.yaml")
[ "$_got" = "$(_ind < "$FRAG")" ] && ok "G7: a current column-0 entry under indented repos: items is rewritten at their indent" \
  || bad "G7: a current column-0 entry under indented repos: items was left in column 0"
_pc_parses "$Y10" "G7: the file after --refresh of a current column-0 entry"
grep -qF "$_nw_edit" <<<"$(not_wired <<<"$out")" \
  && bad "G7: a current column-0 entry is named as an edit" || ok "G7: a current column-0 entry is not named as an edit"
cp "$Y10/.pre-commit-config.yaml" "$Y10/pc.before"
( cd "$Y10" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
cmp -s "$Y10/.pre-commit-config.yaml" "$Y10/pc.before" && ok "G7: a second --refresh leaves the re-indented entry byte-identical" \
  || bad "G7: a second --refresh changed the re-indented entry"

# ══ G4 — the R2 N/A record a declarative layout gets does not grow on each refresh ═════════════
echo "▶ G4 R2 N/A record"
H=$(mktemp -d); CLEANUP+=("$H")
printf '{"name":"h","version":"0.0.0","dependencies":{"@hono/zod-openapi":"^0.9.0"}}\n' > "$H/package.json"
mkdir -p "$H/src"; echo 'export const app = 1;' > "$H/src/app.ts"
( cd "$H" && git init -q && bash "$INSTALL" ts-server < /dev/null ) >/dev/null 2>&1
grep -qF '<!-- aif:r2-na:begin -->' "$H/.ai-factory/tool-decisions.md" \
  && ok "G4 precondition: a declarative Hono layout has the R2 N/A record" || bad "G4 precondition: no R2 N/A record"
refresh "$H" >/dev/null; cp "$H/.ai-factory/tool-decisions.md" "$H/td.before"
refresh "$H" >/dev/null; refresh "$H" >/dev/null
cmp -s "$H/.ai-factory/tool-decisions.md" "$H/td.before" \
  && ok "G4: repeated --refresh leaves tool-decisions.md byte-identical (no blank line per run)" \
  || bad "G4: tool-decisions.md changed across refreshes ($(wc -l < "$H/td.before") → $(wc -l < "$H/.ai-factory/tool-decisions.md") lines)"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
