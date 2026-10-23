#!/usr/bin/env bash
# Payload size must not become native argv size (Windows CreateProcessW: 32767 chars).
# Exercise the real ledger and both ESLint delivery routes under that boundary.
set -euo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
export REAL_NODE=$(command -v node) REAL_JQ=$(command -v jq)
mkdir -p "$WORK/bin"
for tool in node jq; do
  cat > "$WORK/bin/$tool" <<'SH'
#!/usr/bin/env bash
chars=0
for arg in "$@"; do chars=$((chars + ${#arg} + 3)); done
if [ "$chars" -ge 32767 ]; then
  echo "native argv budget exceeded: $chars characters" >&2
  exit 126
fi
case "${0##*/}" in node) exec "$REAL_NODE" "$@" ;; jq) exec "$REAL_JQ" "$@" ;; esac
SH
  chmod +x "$WORK/bin/$tool"
done
export PATH="$WORK/bin:$PATH"
export PROJECT_ROOT="$WORK/consumer" PKG_ROOT="$REPO_ROOT"
mkdir -p "$PROJECT_ROOT/.ai-factory"
source "$REPO_ROOT/setup.d/lib.sh"
REFRESH_BASELINE_STAGED=(); REFRESH_BASELINE_STAGED_WEAK=()
SKIPPED=(); NOT_WIRED=(); DRY_RUN=""; STACK=generic
# A concatenated JSON stream is a corrupt retained manifest, not three merge operands.
printf '{"previous":"first"}\n{"previous":"second"}\n' > "$PROJECT_ROOT/.ai-factory/refresh-baseline.json"
printf 'delivered\n' > "$PROJECT_ROOT/probe.mjs"
refresh_baseline_stage "$PROJECT_ROOT/probe.mjs"
refresh_baseline_flush
jq -e --arg hash "$(_hash256 "$PROJECT_ROOT/probe.mjs")" '.["probe.mjs"] == $hash' \
  "$PROJECT_ROOT/.ai-factory/refresh-baseline.json" >/dev/null
rm "$PROJECT_ROOT/.ai-factory/refresh-baseline.json" "$PROJECT_ROOT/probe.mjs"
echo 'PASS: corrupt multi-object ledger heals without losing the actual delivery'
# Long exact paths, including spaces; no directory-wide ignores may replace them.
for i in $(seq 1 650); do
  rel=".agents/roles/resources/long owned path-$i/portable-payload-long-enough-to-cross-the-native-argument-boundary.mjs"
  mkdir -p "$PROJECT_ROOT/${rel%/*}"
  printf 'export {};\n' > "$PROJECT_ROOT/$rel"
  printf '%s\n' "$rel" >> "$WORK/paths"
  refresh_baseline_stage "$PROJECT_ROOT/$rel"
done
refresh_baseline_flush
jq -e 'length == 650' "$PROJECT_ROOT/.ai-factory/refresh-baseline.json" >/dev/null
# Refresh must keep previous values over weak stages and actual writes over both.
first=$(head -1 "$WORK/paths")
printf 'consumer edit\n' > "$PROJECT_ROOT/$first"
REFRESH_BASELINE_STAGED_WEAK+=("$PROJECT_ROOT/$first")
refresh_baseline_flush
jq -e --arg key "$first" --arg hash "$(_hash256 "$PROJECT_ROOT/$first")" '.[$key] != $hash and length == 650' \
  "$PROJECT_ROOT/.ai-factory/refresh-baseline.json" >/dev/null
refresh_baseline_stage "$PROJECT_ROOT/$first"
refresh_baseline_flush
jq -e --arg key "$first" --arg hash "$(_hash256 "$PROJECT_ROOT/$first")" '.[$key] == $hash and length == 650' \
  "$PROJECT_ROOT/.ai-factory/refresh-baseline.json" >/dev/null
echo 'PASS: large ledger writes and weak < previous < actual precedence'

source "$REPO_ROOT/setup.d/eslint-wire.sh"
# Transport seam: the ownership-filtered producer is unchanged; verify every emitted path
# survives the real shell route and bundled AST writer, with real ESLint/ts-morph resolution.
getff_portable_owned_paths() { cat "$WORK/paths"; }
_ts_morph_available() { return 0; }
_r2_own_gap() { :; }
_r2_own_refused() { return 1; }
ln -s "$REPO_ROOT/node_modules" "$PROJECT_ROOT/node_modules"
for route in managed own; do
  printf 'export default [];\n' > "$PROJECT_ROOT/eslint.config.mjs"
  if [ "$route" = managed ]; then
    refresh_baseline_stage "$PROJECT_ROOT/eslint.config.mjs"
  else
    REFRESH_BASELINE_STAGED=()
    jq 'del(.["eslint.config.mjs"])' "$PROJECT_ROOT/.ai-factory/refresh-baseline.json" > "$WORK/ledger"
    mv "$WORK/ledger" "$PROJECT_ROOT/.ai-factory/refresh-baseline.json"
  fi
  eslint_wire_synth
  "$REAL_NODE" --input-type=module - "$PROJECT_ROOT/eslint.config.mjs" "$WORK/paths" <<'JS'
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const config = (await import(pathToFileURL(process.argv[2]).href + '?' + Date.now())).default;
const expected = readFileSync(process.argv[3], 'utf8').trimEnd().split('\n');
const actual = new Set(config.flatMap(e => e.ignores ?? []));
for (const path of expected) if (!actual.has(path)) throw new Error(`Missing exact ignore: ${path}`);
if (actual.has('.agents/**')) throw new Error('Ownership boundary widened');
JS
  echo "PASS: $route exact ignores cross native argv boundary"
done
