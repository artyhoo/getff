#!/usr/bin/env bash
# @cc-only-rationale: drift check over the hook language packs. It DOES reach consumer
#   projects — setup.d/10-skills.sh and install.sh both deliver lang/{en,ru,check-parity}.sh
#   alongside end-of-turn-reminder.sh — but there is no portable hook to pair it with: it is a
#   standalone script an author or CI runs, not an event handler. This rationale previously
#   asserted the opposite about delivery, which both sites falsify (#1597 review ledger E-5).
# @dual-pair: hook-lang-i18n
#
# Asserts en.sh and ru.sh expose the SAME set of aif_msg_* functions (+ the
# AIF_RECAP_MARKER variable). A new message added to one pack but not the other
# = drift; this is the deterministic, no-LLM guard against #two-prompts-drift
# at the leaf-string level. Run locally / at review; not a blocking pre-push gate
# Exit 0 = parity, 1 = drift. Wired into CI via packages/core/hooks/lang-parity.test.ts, which
# runs this script over the real packs and carries a seeded-drift paired negative — until that
# test landed nothing invoked it at all, so any pack drift shipped unnoticed (ledger A3-7).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Every probe is `|| true`-guarded. Under `set -euo pipefail` a grep that matches nothing exits
# 1, and the LAST command of the brace group sets the group's status: dropping the final
# AIF_EOT_* key made `keys()` return 1, pipefail propagated it, and `set -e` aborted the script
# at the assignment below — exit 1 with NO diagnostic, indistinguishable from an ordinary DRIFT
# failure except that it printed nothing (#1597 review ledger A3-7). An absent key class is
# exactly what this check exists to REPORT, so it must never abort the reporter.
keys() {
  # Function names (aif_msg_*) + the marker var names, sorted.
  {
    grep -oE '^aif_msg_[a-z_]+\(\)' "$1" | sed 's/()$//' || true
    grep -qE '^AIF_RECAP_MARKER=' "$1" && echo 'AIF_RECAP_MARKER' || true
    grep -qE '^AIF_STORY_MARKER=' "$1" && echo 'AIF_STORY_MARKER' || true
    grep -oE '^AIF_EOT_[A-Z_]+=' "$1" | sed 's/=$//' || true
  } | sort -u
}

en="$(keys "$DIR/en.sh")"
ru="$(keys "$DIR/ru.sh")"

if [ "$en" = "$ru" ]; then
  echo "OK: en.sh and ru.sh expose identical keys ($(echo "$en" | wc -l | tr -d ' ') entries)."
  exit 0
fi

echo "DRIFT: en.sh and ru.sh key sets differ." >&2
echo "--- only in en.sh ---" >&2
comm -23 <(printf '%s\n' "$en") <(printf '%s\n' "$ru") >&2
echo "--- only in ru.sh ---" >&2
comm -13 <(printf '%s\n' "$en") <(printf '%s\n' "$ru") >&2
exit 1
