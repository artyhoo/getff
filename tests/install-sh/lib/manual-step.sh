#!/usr/bin/env bash
# tests/install-sh/lib/manual-step.sh — the shared «does the install hand the user a manual step?»
# predicate for the install-sh battery. Sourced, never run.
#
# Operator directive (2026-09-28, decision Q4.7): the getff install never hands the person running
# it a manual step. What it cannot do goes to the «NOT wired» summary with what is missing and why,
# never with «do X yourself». A line that names what was not done and why is fine; a line that
# tells the reader to run, edit, merge, port, install, verify, remove or re-run something is not.
#
# The wording list is every phrasing the installer has used for such a step (setup.d/*.sh,
# install.sh, the wirers' own lines): «by hand», «manually», «yourself», «merge <src> into it»,
# «port your rules», the R2 snippet's «Add to <cfg> (adjust the relative path…)», the summary's
# «what to do», the hooks' «to use them … run:», the Next-steps «should print» / «should PASS» /
# numbered «Run: / Review / Edit / Install / Verify», «re-run the install / with --x»,
# «to overwrite», the kept-hook advice «to add them, call from it: <cmd>», and the cold-review
# residues: «then ./setup --full», «↳ NEXT …», «Set VAR=1 to …», «use --force to …», «Consider
# adding …», «review whether / output / the diff», «edit <file> if …», «or remove the …», «pass
# --flag to …», «until you remove …», «needs --global or …»; and from the toolchain lanes and the
# aif-handoff / runtime-bridge guided flows: «run the manual command(s) above», «review above», a
# printed command «# must exit non-zero», «To wire the getff … add a job running:», «run '<cmd>'»,
# «to activate», «source it from your existing hook», «move your hooks», «start it / start docker»,
# «install docker», «see <doc>.md for …», «manual setup», the config REFUSE cells' «MANUAL: …»,
# «merge our/its/the getff … into your …», «OR run:», «inert until you opt in», «once you add». A
# wording list is closed by nature:
# install-no-manual-step.test.sh arm R holds a positive control (every wording above must match)
# and sweeps the installer source, so a new phrasing in a line no arm reaches still surfaces.

# manual_step_lines <log> — print each line of <log> that hands work back to the reader.
manual_step_lines() {
  grep -iE 'by hand|manually|yourself|merge .* into it|port your rules|add to .*adjust|adjust the relative path|what to do|to use them|should print|should PASS|re-run (it|the install|install|with|\./)|then re-run|\(run: |^[[:space:]]*[0-9]+\. (Run|Review|Edit|Install|Verify)[ /:]|to overwrite|to add (it|them)|call (it )?from|then \./setup|↳ NEXT|(^|[^A-Za-z_])Set [A-Z][A-Z_]+=|use --[a-z-]+ to|consider (adding|running|using)|review (whether|output|the diff)|edit [^ ]+ if |or remove (the|it|them)|pass --[a-z-]+( [a-z]+)? to|until you remove|needs --[a-z]+ or|run the manual|review above|must (exit|appear)|to wire the|add (a job|jobs) running|run '\''|to activate|source it from|move your hooks|start (it|docker)[ ,.]|install docker|see [^ ]+\.md for|manual setup|manual:|merge (our|its|the getff|\.getff)|or run:|until you opt in|once you add' "$1"
}

# asks_by_hand <log> — true when <log> carries at least one such line.
asks_by_hand() {
  manual_step_lines "$1" >/dev/null
}
