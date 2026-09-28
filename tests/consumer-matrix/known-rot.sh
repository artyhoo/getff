# shellcheck shell=bash
# known-rot.sh — sourced by tests/consumer-matrix/own-config-cell.sh and by its matcher test,
# tests/install-sh/own-config-known-rot.test.sh. Reads $STACK. Defines ROT_ENTRIES and
# known_rot_for; no side effects.
#
# KNOWN ROT: preset-template defects the own-config cell SHOWS but does not fail on.
# Operator decision Q4.4 (2026-09-28): a stale preset template is NOT hand-patched; this gate shows
# which template files rot, and whether presets ship config templates at all is the one-button
# design session's call. So each entry below is printed as ROT on every run, and it is STRICT both
# ways: a step counts as rot only when EVERY error in its log is the entry's signature (anything
# else is a plain FAIL), and an entry that stops reproducing on a stack it names turns the cell
# RED — the list cannot outlive the rot it names.
#   K2  preset vitest.config.ts sets `test.poolOptions`, which vitest 4 (the ^4.1.5 getff pins,
#       setup.d/70-deps.sh) removed; tsc rejects the whole config with TS2769, so the consumer's
#       whole-tree typecheck and build go red. Stacks: ts-server react-next react-spa.
#   K4  the ts-server vitest.config.ts collects only `*.unit.ts` / `*.audit.ts`, so a project whose
#       tests are `*.test.ts` has none: «No test files found». Stacks: ts-server. Found by this
#       cell on 2026-09-28 once the layout fix let the config look in lib/ at all.
ROT_ENTRIES="K2:typecheck,build:ts-server,react-next,react-spa K4:test:ts-server"
_strip_ansi() { sed $'s/\x1b\\[[0-9;]*m//g' "$1"; }
_rot_k2() { # every tsc error is the poolOptions overload error in vitest.config.ts
  # Per error, not per log: each `error TS` line opens a block that must be a vitest.config.ts
  # TS2769 AND carry the poolOptions text before the next error — so a second TS2769 in the same
  # file about another key is not absorbed by the first one's message.
  grep -qE 'error TS[0-9]+' "$1" || return 1
  awk -v msg="'poolOptions' does not exist in type 'InlineConfig'" '
    /error TS[0-9]+/ {
      if (open && !seen) bad = 1
      if ($0 !~ /^vitest\.config\.ts\([0-9]+,[0-9]+\): error TS2769:/) bad = 1
      open = 1; seen = 0; next
    }
    open && index($0, msg) { seen = 1 }
    END { if (open && !seen) bad = 1; exit bad }
  ' "$1"
}
_rot_k4() { # vitest found nothing although it looked in lib/ — only for the *.unit / *.audit naming
  local inc
  _strip_ansi "$1" | grep -q 'No test files found' || return 1
  inc=$(_strip_ansi "$1" | grep -E '^[[:space:]]*include:' | head -1)
  # It must have looked where the fixture's test lives (lib/answer.test.ts). An include still on
  # src/ is the layout rewrite regressing (setup.d/lib.sh rewrite_vitest_source_roots), not K4.
  case "$inc" in *"lib/**/"*".unit.ts"*) ;; *) return 1 ;; esac
  case "$inc" in *".test."* | *"{test"* | *".spec."* | *"spec}"*) return 1 ;; esac
  _strip_ansi "$1" | grep -qE '(FAIL|Error:|error TS)' && return 1
  return 0
}
# known_rot_for <step> <log> — prints the id of the entry that explains the step's failure on
# this stack, or nothing.
known_rot_for() {
  local step="$1" log="$2" e id steps stacks
  for e in $ROT_ENTRIES; do
    id=${e%%:*}; steps=${e#*:}; steps=${steps%%:*}; stacks=${e##*:}
    case ",$stacks," in *",$STACK,"*) ;; *) continue ;; esac
    case ",$steps," in *",$step,"*) ;; *) continue ;; esac
    case "$id" in
      K2) _rot_k2 "$log" && { echo K2; return 0; } ;;
      K4) _rot_k4 "$log" && { echo K4; return 0; } ;;
    esac
  done
  return 0
}

