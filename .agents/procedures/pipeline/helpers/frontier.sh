#!/usr/bin/env bash
# frontier.sh — deterministic DEPENDENCY-FRONTIER feed for SKILL.md §3 (Stage column)
# and §6 (stage gates). Mechanises D-H13 / spec §5.4.
#
# > Class: C at the consuming section (SKILL.md prose can ignore injected data);
# >        this helper own contract is Class A via the companion paired-negative test
# >        at packages/core/hooks/frontier.test.ts.
# > Authoritative for: deriving the dispatchable frontier from an umbrella kickoff
# >        INCUMBENT `Depends on` stage-table column — the one spelling (a second
# >        `Blocked-by:` spelling for the same edge is the #parallel-evolution-creep
# >        D-H13 forbids), plus the degrade rule when the column is absent.
# > NOT authoritative for: whether a stage REALLY merged. `basis=marker-unverified` is a
# >        row-text READ, never a merge proof; SKILL.md §6 Step 1
# >        `gh pr list --search "is:merged head:<branch> base:staging"` is the authority.
# >        Feed its verdict back through MO_FRONTIER_DONE / MO_FRONTIER_OPEN.
# > NOT authoritative for: sub-wave detection — that is launch-table-generator.sh, a
# >        DIFFERENT population (§2/§3 sub-wave rows `A`-`D` / `1`-`N` inside a
# >        `## §N Sub-wave` section, which carry no dependency column). No logic is
# >        shared beyond lib/common.sh; the two feeds are complementary, not twins.
#
# Usage: frontier.sh <umbrella>
#
# Output grammar (full reference: ../references/frontier.md):
#   === frontier: <umbrella> ===
#   kickoff: <path> (<n> lines)
#   done-md: yes | no
#   depends-column: present (header line <n>) | absent
#   stages: <n>
#   STAGE <id> done=<no|yes basis=<marker-unverified|done-md|override>> deps=<a,b|-|?> \
#         unmet=<a,b|-|?> unresolved=<yes|no> label="<first cell>" \
#         raw="<Depends-on cell, <=60 chars>" [residue="<unconsumed cell text>"]
#   FRONTIER: <ids | (none)>
#   BLOCKED: <id(unmet:a,b) ... | (none)>
#   DONE: <ids | (none)>
#   UNRESOLVED: <ids | (none)>     # the whole cell resolved to no in-table id
#   RESIDUE: <ids | (none)>        # cell named an in-table id AND something else
#   ATTN: <...>                    # marker-based dones to confirm at the §6 gate;
#                                  # prose dependency lines outside the table; rows
#                                  # with no `Depends on` cell at all
#   DEGRADE: <reason>              # column absent, table absent, or zero rows parsed
#   WARN: <reason>                 # no frontier while stages remain; done+unmet
#                                  # contradiction; contradictory override pair
#
# Honest ceilings (T14 — a clean read is not a proof):
#   1. Only edges to stages IN THE SAME TABLE resolve. A range (`S1-S4 all merged`,
#      en/em dash included) expands to the inclusive table-order span. Anything the cell
#      names beyond that is echoed verbatim in `residue=` and listed on `RESIDUE:` — the
#      helper never claims to have understood it. A cell that resolves to NOTHING while
#      still carrying text sets `unresolved=yes`.
#   2. Done-detection reads UPPERCASE MERGED / CLOSED / RETIRED / DONE **only when merge
#      evidence sits within 60 characters** (a `#<digits>` PR ref, an ISO date, or
#      `staging`), or a bare ✅. Without that proximity rule the read fires on prose that
#      merely contains the word (measured: arch-v2-context-pipeline S-L says «load-bearing
#      unknown is **CLOSED**» about a QUESTION, and would report an unmerged stage DONE).
#      Every marker-based done is echoed on an `ATTN:` line for the §6 gh gate to confirm.
#   3. Cells split on `|`, with pipes inside an inline-code span protected first
#      (protect(), added after the T15 self-application run shredded this umbrella own S2
#      row on `done|verified`). A literal `|` OUTSIDE backticks would still mis-split —
#      unobserved across the tracked stage tables; the parallel marker in use is `∥`.
#   4. Frontier = DIRECT dependencies met. It is a readiness set, not a topological order:
#      a dependency cycle surfaces as «no frontier while stages remain» (a WARN line),
#      never as a silent empty answer. A `Depends on` header with zero parsed rows is a
#      DEGRADE + WARN, never an empty answer either.
#   5. Edges stated in PROSE (a `> **Depends on:** …` header line, `**Prerequisite:**`, or
#      a stray `Blocked-by`) are NOT parsed — 11 of the 27 tracked kickoffs that mention
#      the edge state it that way (measured 2026-08-18). They are reported on an `ATTN:`
#      line with their line numbers so the degrade path cannot read as permission.
#   6. Only `<umbrella>/kickoff.md` is read. 29 files across 7 umbrellas keep stages in
#      sibling `kickoff-s<N>.md` files; those resolve to DEGRADE. `wave-sequencing-plan.md`
#      also carries a `Depends on` column — a DIFFERENT population (backlog tasks), never
#      read here.
#
# Seams for testing (mirrors dispatch-from-state.sh convention):
#   MO_KICKOFF_DIR    — override umbrella dir (default: <resolved-orch-home>)
#   MO_FRONTIER_DONE  — comma/space list of stage ids to force DONE (the §6 gh verdict)
#   MO_FRONTIER_OPEN  — comma/space list of stage ids to force NOT-DONE (stale marker).
#                       An id in BOTH lists is a contradiction: OPEN wins (fail-safe — the
#                       claim goes back to the §6 gh gate) and a WARN line names it.
#   REPO_ROOT         — override repo root (default: git rev-parse --show-toplevel)
#
# @dual-pair: meta-orchestrator-frontier
# spec: SKILL.md §3 Step 1 + §6 Step 1 (consumers of this output) ↔ this file (emitter);
#       both agree on the `FRONTIER:` / `BLOCKED:` / `DEGRADE:` line prefixes.
# @cc-only-rationale: /pipeline skill helper — runs in-session via `!shell` injection at
#   §3 Step 1; no portable hook fires at the per-invocation moment, so a portable twin
#   would be a no-op outside CC. Pure bash + awk, deterministic, no paid LLM.
set -euo pipefail

UMBRELLA="${1:-}"
# REPO_ROOT + resolve_orch_home() + repo_rel() from the shared lib (BASH_SOURCE-relative so it
# survives the REPO_ROOT test seam).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

if [[ -z "${UMBRELLA}" ]]; then
  # Legitimate: §3 runs after §2 picks a winner. Quiet skip so CC does not flag the block.
  echo "(frontier: no umbrella — the frontier is derived after §2 selects an umbrella)"
  exit 0
fi

KICKOFF_DIR="${MO_KICKOFF_DIR:-$(resolve_orch_home)}"
KICKOFF="${KICKOFF_DIR}/${UMBRELLA}/kickoff.md"

echo "=== frontier: ${UMBRELLA} ==="
if [[ ! -f "${KICKOFF}" ]]; then
  # Same wording as §3 Blocking rule, and the path actually probed (never a hardcoded
  # framework literal — see resolve_orch_home_rel() rationale in lib/common.sh).
  echo "MISSING kickoff: $(repo_rel "${KICKOFF}")"
  exit 0
fi

DONE_MD=no
[[ -f "${KICKOFF_DIR}/${UMBRELLA}/done.md" ]] && DONE_MD=yes

echo "kickoff: ${KICKOFF} ($(wc -l < "${KICKOFF}" | tr -d ' ') lines)"
echo "done-md: ${DONE_MD}"

awk -v done_md="${DONE_MD}" \
    -v force_done="${MO_FRONTIER_DONE:-}" \
    -v force_open="${MO_FRONTIER_OPEN:-}" '
function trim(s) { gsub(/^[ \t]+/, "", s); gsub(/[ \t]+$/, "", s); return s }
# Markdown lets a cell carry a literal `|` inside an inline-code span (`done|verified` in the
# S2 row of THIS umbrella — found by running the helper on its own kickoff, T15). Splitting on
# a raw `|` would shred that row, so pipes inside backticks are swapped for SUB (\001) before
# the split and swapped back by clean().
function protect(line,   out, i, c, incode) {
  out = ""; incode = 0
  for (i = 1; i <= length(line); i++) {
    c = substr(line, i, 1)
    if (c == "`") incode = !incode
    if (c == "|" && incode) c = "\001"
    out = out c
  }
  return out
}
function clean(s) { gsub(/\*\*/, "", s); gsub(/`/, "", s); gsub(/\001/, "|", s); return trim(s) }
# Word char for id-boundary tests: ASCII alnum + underscore only. Every other byte (space,
# punctuation, and each byte of a multibyte dash or prime) is a boundary, so `S1` never
# matches inside `S1b` while `S-D′ merged` still bounds `S-D′`.
function isw(c) { return (c ~ /^[A-Za-z0-9_]$/) }
function isalpha(c) { return (c ~ /^[A-Za-z]$/) }
function hasid(text, id,   pos, pre, post) {
  while ((pos = index(text, id)) > 0) {
    pre = (pos > 1) ? substr(text, pos - 1, 1) : ""
    post = substr(text, pos + length(id), 1)
    if (!isw(pre) && !isw(post)) return 1
    text = substr(text, pos + 1)
  }
  return 0
}
# Blank out bounded occurrences of id, so longest-first matching keeps `S-D` from claiming
# the edge that belongs to `S-D′` (both are stages of arch-v2-context-pipeline).
function maskid(text, id,   out, pos, pre, post) {
  out = ""
  while ((pos = index(text, id)) > 0) {
    pre = (pos > 1) ? substr(text, pos - 1, 1) : ""
    post = substr(text, pos + length(id), 1)
    if (!isw(pre) && !isw(post)) {
      out = out substr(text, 1, pos - 1) " "
    } else {
      out = out substr(text, 1, pos + length(id) - 1)
    }
    text = substr(text, pos + length(id))
  }
  return out text
}
# Remove the FIRST literal occurrence of sub (used to consume a matched range span).
function rmsub(text, needle,   pos) {
  pos = index(text, needle)
  if (pos == 0) return text
  return substr(text, 1, pos - 1) " " substr(text, pos + length(needle))
}
function is_divider(line) { return (line ~ /^\|[ \t:|-]*$/) }
function first_token(s,   a) { split(s, a, /[ \t]+/); return a[1] }
# Stage id from the first cell. `| Stage 0 |` / `| Sub-wave A |` are a live table shape
# (dispatcher-skill-meta-launch/kickoff.md:33): the bare first token would collide with the
# header word and the row would be dropped, so the shape keeps its second token.
function row_id(cell,   a, n) {
  n = split(cell, a, /[ \t]+/)
  if ((a[1] == "Stage" || a[1] == "Sub-wave" || a[1] == "Wave") && n >= 2) return a[1] " " a[2]
  return a[1]
}
function is_header_word(id) { return (id == "Stage" || id == "Sub-wave" || id == "Wave" || id == "#" || id == "") }
# A status marker counts only with merge evidence within 60 chars (ceiling 2).
function marked_done(text,   marks, n, i, rest, pos, pre, post, tail) {
  n = split("MERGED CLOSED RETIRED DONE", marks, " ")
  for (i = 1; i <= n; i++) {
    rest = text
    while ((pos = index(rest, marks[i])) > 0) {
      pre = (pos > 1) ? substr(rest, pos - 1, 1) : ""
      post = substr(rest, pos + length(marks[i]), 1)
      if (!isalpha(pre) && !isalpha(post)) {
        tail = substr(rest, pos, 60)
        if (tail ~ /#[0-9]+/ || tail ~ /20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]/ || tail ~ /staging/) return 1
      }
      rest = substr(rest, pos + 1)
    }
  }
  return (index(text, "✅") > 0)
}
function in_list(list, id,   a, i, n) {
  n = split(list, a, /[,\t]+/)
  for (i = 1; i <= n; i++) { gsub(/^ +| +$/, "", a[i]); if (a[i] != "" && a[i] == id) return 1 }
  n = split(list, a, /[ \t]+/)
  for (i = 1; i <= n; i++) if (a[i] != "" && a[i] == id) return 1
  return 0
}
# Strip PR refs, dates, and pure connectives; what survives is text the parser did not
# consume, echoed verbatim rather than judged (ceiling 1).
function residue_of(txt,   res, w, n, i, keep) {
  res = txt
  gsub(/\(start\)/, " ", res)
  gsub(/#[0-9]+/, " ", res)
  gsub(/20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]/, " ", res)
  n = split(res, w, /[^A-Za-z0-9._\/-]+/)
  keep = ""
  for (i = 1; i <= n; i++) {
    if (length(w[i]) < 2) continue
    if (tolower(w[i]) ~ /^(merged|merge|merges|met|all|and|the|per|squash|staging|start|none|n\/a|tbd|yes|not|but|its|was|are|both|then|plus|with|from|this|that|no|in|of|to|is|at|on|by|it|as|or|if|so|up|we|be|do|via|for|has|had|new|now|one|two|out|own|see|use|per|its|the)$/) continue
    keep = keep (keep == "" ? "" : " ") w[i]
  }
  return keep
}
BEGIN { depidx = 0; hdrline = 0; intable = 0; nst = 0; fallback_hdr = 0; prose = "" }
# Prose edges (ceiling 5): a non-table line stating the edge. Collected on every line so the
# report can point at them whichever branch is taken.
!/^\|/ && (/\*\*Depends on/ || /\*\*Prerequisite/ || /\*\*Blocked-by/) {
  prose = prose (prose == "" ? "" : ",") ":" NR
}
# Header row of the stage table: the FIRST pipe-row that names the incumbent column.
# `i <= nf` on purpose — a GFM header may omit the trailing `|`, and missing the last cell
# used to send a fully-populated table down the no-column degrade path.
!hdrline && /^\|/ && index($0, "Depends on") {
  nf = split(protect($0), F, "|")
  for (i = 2; i <= nf; i++) if (clean(F[i]) == "Depends on") depidx = i - 1
  if (depidx) { hdrline = NR; intable = 1; next }
}
# Degrade path: remember the first `| Stage |` / `| Sub-wave |` header seen, in case no
# `Depends on` column exists anywhere in the file.
!hdrline && !fallback_hdr && /^\|/ {
  nf = split(protect($0), F, "|")
  h = clean(F[2])
  if (h == "Stage" || h == "Sub-wave") { fallback_hdr = NR; fb_intable = 1; next }
}
intable && /^\|/ {
  if (is_divider($0)) next
  nf = split(protect($0), F, "|")
  id_cell = clean(F[2])
  id = row_id(id_cell)
  if (is_header_word(id)) next
  nst++
  sid[nst] = id
  slabel[nst] = id_cell
  if (nf > depidx + 1) { sdep[nst] = clean(F[depidx + 1]); shascell[nst] = 1 }
  else { sdep[nst] = ""; shascell[nst] = 0 }
  # Row text for done-detection: every cell EXCEPT the Depends-on cell (ceiling 2).
  rt = ""
  for (i = 2; i < nf; i++) if (i != depidx + 1) rt = rt " " clean(F[i])
  srow[nst] = rt
  next
}
intable && !/^\|/ { intable = 0; next }
fb_intable && /^\|/ {
  if (is_divider($0)) next
  nf = split(protect($0), F, "|")
  id_cell = clean(F[2])
  id = row_id(id_cell)
  if (is_header_word(id)) next
  fbn++
  fbid[fbn] = id
  fblabel[fbn] = id_cell
  fbrow[fbn] = clean($0)
  next
}
fb_intable && !/^\|/ { fb_intable = 0; next }
END {
  nd = split("- – —", DASH, " ")
  if (prose != "") prose_note = "ATTN: prose dependency line(s) at " prose " — stated outside the stage table, so NOT parsed; read them before dispatch (ceiling 5)"
  if (!hdrline) {
    print "depends-column: absent"
    if (!fbn) {
      print "stages: 0"
      print "FRONTIER: (none)"
      if (prose_note != "") print prose_note
      print "DEGRADE: no stage table found — read the kickoff and treat every not-yet-done stage as frontier (spec §5.4)"
      exit 0
    }
    print "stages: " fbn
    fr = ""; dn = ""; markerdone = ""
    for (i = 1; i <= fbn; i++) {
      # Same done-set ladder as the columned path (below): done-md > row-text marker >
      # not done, then the §6 force flags — so a lying done/MERGED marker in a no-column
      # kickoff reaches the consumer AS marker-unverified, never as a bare done=yes
      # (#1498: marker-lies protection must reach the degrade path too).
      fbbasis = ""
      if (done_md == "yes") { d = "yes"; fbbasis = "done-md" }
      else if (marked_done(fbrow[i])) { d = "yes"; fbbasis = "marker-unverified" }
      else d = "no"
      if (in_list(force_done, fbid[i])) { d = "yes"; fbbasis = "override" }
      if (in_list(force_open, fbid[i])) { d = "no"; fbbasis = "" }
      if (fbbasis == "marker-unverified") markerdone = markerdone " " fbid[i]
      printf "STAGE %s done=%s%s deps=? unmet=? unresolved=no label=\"%s\" raw=\"(no column)\"\n", fbid[i], d, (d == "yes" ? " basis=" fbbasis : ""), fblabel[i]
      if (d == "yes") dn = dn " " fbid[i]; else fr = fr " " fbid[i]
    }
    print "FRONTIER:" (fr == "" ? " (none)" : fr)
    print "DONE:" (dn == "" ? " (none)" : dn)
    if (markerdone != "")
      print "ATTN: marker-unverified done —" markerdone " read as done from row text, NOT proven merged; confirm with the §6 gh check before dispatching a consumer"
    if (prose_note != "") print prose_note
    print "DEGRADE: kickoff carries no `Depends on` column — every not-yet-done stage is frontier (spec §5.4); ordering is judgment again"
    exit 0
  }
  print "depends-column: present (header line " hdrline ")"
  print "stages: " nst
  if (nst == 0) {
    # A header without a single parsed row is NOT an empty frontier — it is a parse miss.
    print "FRONTIER: (none)"
    if (prose_note != "") print prose_note
    print "DEGRADE: `Depends on` header found at line " hdrline " but zero stage rows parsed — treat every not-yet-done stage as frontier and report the shape"
    print "WARN: no stage rows under a present column — the table shape is unrecognised, do NOT read the empty frontier as «nothing to dispatch»"
    exit 0
  }
  # Done set.
  for (i = 1; i <= nst; i++) {
    basis[i] = ""
    if (done_md == "yes") { isdone[i] = 1; basis[i] = "done-md" }
    else if (marked_done(srow[i])) { isdone[i] = 1; basis[i] = "marker-unverified" }
    else isdone[i] = 0
    if (in_list(force_done, sid[i])) { isdone[i] = 1; basis[i] = "override" }
    if (in_list(force_open, sid[i])) { isdone[i] = 0; basis[i] = "" }
    # Contradictory input is surfaced, never silently resolved. OPEN wins because
    # not-done routes the claim to the §6 gh gate, which is the authority anyway.
    if (in_list(force_done, sid[i]) && in_list(force_open, sid[i])) contra = contra " " sid[i]
    if (basis[i] == "marker-unverified") markerdone = markerdone " " sid[i]
  }
  # Edge resolution order: longest id first, masking as we go (see maskid()).
  for (i = 1; i <= nst; i++) order[i] = i
  for (i = 1; i <= nst; i++)
    for (j = i + 1; j <= nst; j++)
      if (length(sid[order[j]]) > length(sid[order[i]])) { t = order[i]; order[i] = order[j]; order[j] = t }
  frontier = ""; blocked = ""; donelist = ""; unres = ""; residues = ""; nocell = ""
  for (i = 1; i <= nst; i++) {
    txt = sdep[i]
    for (k = 1; k <= nst; k++) edge[k] = 0
    # (1) Ranges first: `S1-S4` / `S1–S5` name every stage in the inclusive table-order
    #     span. Taking only the two endpoints (the pre-fix behaviour) dropped the middle
    #     stages silently — measured on plugin-packaging S6/S8 and one-click-installer S5.
    for (p = 1; p <= nst; p++) {
      for (q = 1; q <= nst; q++) {
        if (p == q) continue
        for (d = 1; d <= nd; d++) {
          cand = sid[p] DASH[d] sid[q]
          if (index(txt, cand) > 0) {
            lo = (p < q) ? p : q; hi = (p < q) ? q : p
            for (r = lo; r <= hi; r++) if (r != i) edge[r] = 1
            txt = rmsub(txt, cand)
          }
        }
      }
    }
    # (2) Then single ids, longest-first.
    for (k = 1; k <= nst; k++) {
      j = order[k]
      if (j == i) continue
      if (hasid(txt, sid[j])) edge[j] = 1
      txt = maskid(txt, sid[j])
    }
    deps = ""; unmet = ""; ndeps = 0
    for (j = 1; j <= nst; j++) {
      if (!edge[j]) continue
      deps = deps (deps == "" ? "" : ",") sid[j]
      ndeps++
      if (!isdone[j]) unmet = unmet (unmet == "" ? "" : ",") sid[j]
    }
    # (3) What the parser did not consume: echoed, never judged (ceiling 1).
    res = residue_of(txt)
    u = "no"
    if (ndeps == 0 && res != "") u = "yes"
    raw = sdep[i]
    if (!shascell[i]) raw = "(no cell)"
    if (length(raw) > 60) raw = substr(raw, 1, 57) "..."
    resfield = ""
    if (ndeps > 0 && res != "") resfield = " residue=\"" (length(res) > 40 ? substr(res, 1, 37) "..." : res) "\""
    printf "STAGE %s done=%s%s deps=%s unmet=%s unresolved=%s label=\"%s\" raw=\"%s\"%s\n", \
      sid[i], (isdone[i] ? "yes" : "no"), (isdone[i] ? " basis=" basis[i] : ""), \
      (deps == "" ? "-" : deps), (unmet == "" ? "-" : unmet), u, slabel[i], raw, resfield
    if (isdone[i]) donelist = donelist " " sid[i]
    else if (unmet != "") blocked = blocked " " sid[i] "(unmet:" unmet ")"
    else frontier = frontier " " sid[i]
    if (u == "yes") unres = unres " " sid[i]
    if (resfield != "") residues = residues " " sid[i]
    if (!shascell[i]) nocell = nocell " " sid[i]
    if (isdone[i] && unmet != "") selfcontra = selfcontra " " sid[i] "(unmet:" unmet ")"
  }
  print "FRONTIER:" (frontier == "" ? " (none)" : frontier)
  print "BLOCKED:" (blocked == "" ? " (none)" : blocked)
  print "DONE:" (donelist == "" ? " (none)" : donelist)
  print "UNRESOLVED:" (unres == "" ? " (none)" : unres)
  print "RESIDUE:" (residues == "" ? " (none)" : residues)
  if (markerdone != "")
    print "ATTN: marker-unverified done —" markerdone " read as done from row text, NOT proven merged; confirm with the §6 gh check before dispatching a consumer"
  if (nocell != "")
    print "ATTN: row(s)" nocell " carry no `Depends on` cell — treated as no dependency; fix the row or state the edge"
  if (prose_note != "") print prose_note
  if (selfcontra != "")
    print "WARN: contradictory row read —" selfcontra " is marked done while a dependency is not; the marker or the edge is stale"
  if (frontier == "" && blocked != "")
    print "WARN: no frontier — every open stage has an unmet dependency; check for a dependency cycle or a stale done marker before concluding the umbrella is parked"
  if (contra != "")
    print "WARN: contradictory override —" contra " named by BOTH MO_FRONTIER_DONE and MO_FRONTIER_OPEN; treated as NOT done (the §6 gh check decides)"
}
' "${KICKOFF}"
