#!/usr/bin/env bash
# check-zcode-mirror.test.sh — the consumer ZCode skill-mirror check (#1502, W2-G) against EVERY
# row of the kickoff §1 behaviour table, positive AND paired negative (same tree, defect removed
# → passes). Throwaway consumer trees in mktemp -d; the check runs against the tree as $1.
#
# The test runs the SOURCE script (packages/core/audit-self/check-zcode-mirror.sh) — the same
# byte-blob copy_safe delivers to consumer scripts/ (the delivered copy is fingerprinted by
# MANIFEST.sha256 and the live-consumer probes run it end-to-end). Precedent sibling:
# check-shields-up-paired-negative.test.sh.
#
# OUTPUT CONTRACT this test pins (the check's own §1 table, channel decisions per DECISIONS):
#   - ALL check output goes to stderr; stdout stays EMPTY (the ZCode §0.5 stdout contract keeps
#     stdout reserved for strict-JSON hook payloads — a wrapper must be able to capture stdout).
#   - the verdict is the EXIT CODE: 0 = mirror complete (or no .zcode/ at all), non-zero = blockers.
#   - one offender line PER offender, each starting "check-zcode-mirror:" and naming the offender:
#       missing mirror entry for skill '<name>'
#       dangling mirror link '<name>' (<path> -> <target>): target does not exist
#       stale exemption '<name>' (line <n>)
#       exemption '<name>' (line <n>): reason under 20 characters | no reason given
#   - SEMANTICS pinned by the timeliner incident (#1502 comment 2, 2026-08-20):
#       * coverage = a NON-dangling entry of the same NAME in .zcode/skills (real dir OR symlink;
#         a plain FILE is neither and is NOT coverage — arm (xx); a symlink to a file IS a
#         symlink by behaviour-table row (c) and stays covered — documented edge, arm (xxi));
#       * a dangling link never covers anything; a dangling link is ONE offender by itself —
#         it does not additionally report its own name as missing;
#       * so timeliner (6 uncovered skills + 1 dangling rules-as-tests) = EXACTLY SEVEN offenders.
#
# ARMS:
#   (i)    form-check: check script exists and is executable
#   (ii)   POSITIVE: no .zcode/ (CC-only consumer)      → rc 0, EXACTLY ONE stderr line, stdout empty
#   (iii)  NEGATIVE control for (ii): same tree + a mirror with one missing skill → rc non-zero
#   (iv)   POSITIVE: .zcode/skills → ../.claude/skills (this repo's one-link shape) → rc 0, one line
#   (v)    NEGATIVE: .zcode/skills is a DANGLING top-level link → rc non-zero
#   (vi)   POSITIVE: complete mirror, real dirs        → rc 0, one OK line
#   (vii)  POSITIVE: complete mirror, valid symlinks   → rc 0 (row (c): symlink OR real dir)
#   (viii) NEGATIVE: one counterpart removed, no exemption → rc non-zero, names EXACTLY that skill
#   (ix)   POSITIVE pair of (viii): the link restored   → rc 0 (same tree, defect removed)
#   (x)    TIMELINER fixture: EXACTLY SEVEN offenders — six missing + dangling rules-as-tests,
#          asserted as the exact SET (names), not a count floor
#   (xi)   NEGATIVE: dangling link naming an EXISTING skill (typo target) → rc non-zero, line
#          carries the link name AND its target
#   (xii)  POSITIVE pair of (xi): the link repaired     → rc 0
#   (xiii) NEGATIVE: stale exemption (skill gone from .claude/skills) → rc non-zero, names it
#   (xiv)  POSITIVE pair of (xiii): stale line removed  → rc 0
#   (xv)   NEGATIVE: exemption reason under 20 chars    → rc non-zero
#   (xvi)  NEGATIVE: exemption with NO reason           → rc non-zero
#   (xvii) POSITIVE: valid exemption (reason ≥ 20 chars) suppresses the missing offender → rc 0
#   (xviii) NEGATIVE: .zcode/ exists but .zcode/skills does NOT → rc non-zero, EVERY skill named
#   (xix)  POSITIVE pair of (xviii): .zcode/skills created complete → rc 0
#   (xx)   NEGATIVE: a plain FILE at .zcode/skills/<name> is NOT coverage → rc non-zero,
#          offender set is EXACTLY {that skill} (T19 cold-review 2026-09-28 MINOR 1)
#   (xxi)  POSITIVE: a symlink whose target is a plain FILE stays covered — behaviour-table
#          row (c) admits «symlink OR real dir»; pinned so tightening it is a deliberate
#          table change, not an accident (T19 cold-review 2026-09-28 m2)
#   (xxii) NEGATIVE: a CRLF exemption file — the CR must not pad a short reason past the
#          20-char gate (T19 cold-review 2026-09-28 m1: 19 real chars read as 20)
#   (xxiii) POSITIVE pair of (xxii): a ≥20-char CRLF reason still opens the escape hatch
#   (xxiv) POSITIVE: a valid exemption for a skill named «-x» — the name must not reach grep as
#          an option (W2-G review m1)
#
# FIX-COMMAND arms (W2-G review I1): every offender line names a fix command; these arms RUN the
# printed commands, exactly as printed, in the fixture, then re-run the check and require rc 0 —
# a fix hint that fails when pasted is a defect, not a hint:
#   (v.b)    the (v) tree: the printed `relink:` command repairs a dangling top-level link
#   (x.b)    the timeliner tree: every printed command (six `ln -s` + one `rm`) → complete
#   (xi.c)   the (xi) tree: the printed `relink:` command replaces a dangling per-skill link
#   (xviii.b) .zcode/ without .zcode/skills: the printed commands create the dir as well
#
# HOOK arms (W2-G review I2/I4/m2): the two hook templates that call the check, run as a hook runs
# them — from the root of a throwaway git tree, the check delivered at scripts/check-zcode-mirror.sh,
# and stub `npx` / `ast-grep` / `ruff` first on PATH that record whether they were called. Per hook
# (husky pre-commit → npx lint-staged; python pre-push → ast-grep + ruff):
#   (a) check present + mirror gap        → rc non-zero, the gap named, downstream tool NOT run
#   (b) the same with the check at mode 644 → still blocked: the hook runs it with `sh`, so the
#       executable bit must not decide whether the check runs
#   (c) an inherited AIF_PROJECT_ROOT naming another (CC-only) tree → still blocked: the hook checks
#       ITS OWN tree, never an ambient variable's
#   (d) mirror completed                  → rc 0, the check's OK line, downstream tool run
#   (e) check removed from the (a) tree   → loud WARN, rc 0, downstream tool run — counted only when
#       (a) blocked on the same tree, so the flip is caused by the removal alone
#
# rc=0 on SKIP, rc=1 on FAIL. RED-first: `CHECK_SCRIPT=/nonexistent bash <this file>` runs every
# arm against a missing check — every arm must FAIL (0 PASS). A missing script makes `sh` exit
# 127, so no arm may assert a bare non-zero exit: each one also names the line it expects.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECK_SCRIPT="${CHECK_SCRIPT:-$REPO_ROOT/packages/core/audit-self/check-zcode-mirror.sh}"

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "· $1"; }

# Every fixture lives under ONE scratch root, removed on any exit (precedent:
# check-shields-up-paired-negative.test.sh:63).
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

# ─── Arm (i): form-check ──────────────────────────────────────────────────────
if [ -f "$CHECK_SCRIPT" ] && [ -x "$CHECK_SCRIPT" ]; then
  ok "(i) check script $CHECK_SCRIPT exists and is executable"
else
  bad "(i) check script $CHECK_SCRIPT missing or not executable (RED until it ships)"
fi

# ─── Harness ──────────────────────────────────────────────────────────────────
new_tree() { # $1 = name of the variable to set with the fresh tree path
  local t
  t=$(mktemp -d "$SCRATCH/tree.XXXXXX")
  mkdir -p "$t/.claude/skills"
  eval "$1=\$t"
}
mk_skill() { # $1 = tree, $2 = skill name
  mkdir -p "$1/.claude/skills/$2"
  printf 'skill %s\n' "$2" > "$1/.claude/skills/$2/SKILL.md"
}
# Run the check against a tree; sets CHECK_OUT (stdout), CHECK_ERR (stderr), RC.
run_check() {
  local errf rc
  errf=$(mktemp "$SCRATCH/err.XXXXXX")
  # sh, not bash: the delivered hooks run `sh scripts/check-zcode-mirror.sh` — pin the same
  # interpreter here so a bashism in the check fails THIS test, not a consumer's dash (T19 2026-09-28 MINOR 2).
  CHECK_OUT=$(sh "$CHECK_SCRIPT" "$1" 2>"$errf")
  rc=$?
  CHECK_ERR=$(cat "$errf")
  rm -f "$errf"
  RC=$rc
}
# Offender-name extraction — the message grammar above is the contract these pin.
missing_names()  { printf '%s\n' "$CHECK_ERR" | sed -n "s/.*missing mirror entry for skill '\([^']*\)'.*/\1/p" | sort; }
dangling_names() { printf '%s\n' "$CHECK_ERR" | sed -n "s/.*dangling mirror link '\([^']*\)'.*/\1/p" | sort; }
offender_lines() { printf '%s\n' "$CHECK_ERR" | grep -c '^check-zcode-mirror:' || true; }
# The fix commands the offender lines print, one per line, in output order: `— fix: <cmd> (or add …`,
# `— relink: <cmd> (or remove .zcode/)`, `— relink: <cmd>`, `remove it: <cmd>`.
fix_cmds() {
  printf '%s\n' "$CHECK_ERR" | sed -n \
    -e 's/.* — fix: \(.*\) (or add .*/\1/p' -e t \
    -e 's/.* — relink: \(.*\) (or remove \.zcode\/)$/\1/p' -e t \
    -e 's/.* — relink: \(.*\)$/\1/p' -e t \
    -e 's/.* remove it: \(.*\)$/\1/p'
}
# Run every printed fix command, as printed, from the tree root; sets FIX_N (commands found) and
# FIX_FAILED (the commands that exited non-zero, with their stderr).
run_fixes() { # $1 = tree
  local cmd out
  FIX_N=0; FIX_FAILED=""
  while IFS= read -r cmd; do
    [ -n "$cmd" ] || continue
    FIX_N=$((FIX_N + 1))
    out=$( cd "$1" && sh -c "$cmd" 2>&1 ) || FIX_FAILED="$FIX_FAILED[$cmd → $out] "
  done <<EOF
$(fix_cmds)
EOF
}

# ─── Arms (ii)+(iii): CC-only consumer ────────────────────────────────────────
new_tree T
mk_skill "$T" solo
run_check "$T"
if [ "$RC" -eq 0 ] && [ "$(offender_lines)" -eq 1 ] && [ -z "$CHECK_OUT" ]; then
  ok "(ii) POSITIVE: no .zcode/ → rc 0, exactly ONE stderr info line, stdout empty (§0.11 + §0.5)"
else
  bad "(ii) POSITIVE: no .zcode/ → rc=$RC, stderr lines=$(offender_lines), stdout=${#CHECK_OUT} chars — CC behaviour changed or noisy"
fi
mkdir -p "$T/.zcode/skills"
mk_skill "$T" second   # 'second' has no mirror entry
run_check "$T"
if [ "$RC" -ne 0 ] && printf '%s\n' "$CHECK_ERR" | grep -q "missing mirror entry for skill 'second'"; then
  ok "(iii) NEGATIVE control: same CC-only tree once a mirror exists with a gap → rc non-zero, gap named"
else
  bad "(iii) NEGATIVE control: a real mirror gap read rc=$RC — (ii)'s exit 0 would prove nothing"
fi

# ─── Arms (iv)+(v): this repo's one-link shape ────────────────────────────────
new_tree T
for s in getff rule-tests; do mk_skill "$T" "$s"; done
mkdir -p "$T/.zcode"
ln -s ../.claude/skills "$T/.zcode/skills"
run_check "$T"
if [ "$RC" -eq 0 ] && [ "$(offender_lines)" -eq 1 ]; then
  ok "(iv) POSITIVE: .zcode/skills → ../.claude/skills (one link) → rc 0, one OK line — complete by construction (D3 Reopen-if guard)"
else
  bad "(iv) POSITIVE: the repo's one-link shape read rc=$RC with $(offender_lines) lines — the check misreads a complete layout"
fi
rm "$T/.zcode/skills"
ln -s ../nowhere "$T/.zcode/skills"
run_check "$T"
# A bare `rc -ne 0` passes when the check does not exist at all (sh exits 127) — the line is the proof.
if [ "$RC" -ne 0 ] && printf '%s\n' "$CHECK_ERR" | grep -q "^check-zcode-mirror: broken mirror link 'skills'"; then
  ok "(v) NEGATIVE: dangling top-level .zcode/skills link → rc non-zero, «broken mirror link 'skills'» named"
else
  bad "(v) NEGATIVE: dangling top-level mirror link read rc=$RC without the broken-link line — a broken mirror reads complete, or the check never ran"
fi
run_fixes "$T"
run_check "$T"
if [ "$FIX_N" -eq 1 ] && [ -z "$FIX_FAILED" ] && [ "$RC" -eq 0 ]; then
  ok "(v.b) the printed relink command, run as printed, repairs the dangling top-level link → rc 0"
else
  bad "(v.b) printed relink: $FIX_N command(s), failed: ${FIX_FAILED:-none}; check afterwards rc=$RC"
fi

# ─── Arms (vi)+(vii): complete mirrors ────────────────────────────────────────
new_tree T
for s in alpha beta; do mk_skill "$T" "$s"; mkdir -p "$T/.zcode/skills/$s"; done
run_check "$T"
if [ "$RC" -eq 0 ] && [ "$(offender_lines)" -eq 1 ]; then
  ok "(vi) POSITIVE: complete mirror (real dirs) → rc 0, one OK line"
else
  bad "(vi) POSITIVE: a complete real-dir mirror read rc=$RC with $(offender_lines) lines — false RED"
fi
new_tree T
for s in alpha beta; do
  mk_skill "$T" "$s"
  mkdir -p "$T/.zcode/skills"
  ln -s "../../.claude/skills/$s" "$T/.zcode/skills/$s"
done
run_check "$T"
if [ "$RC" -eq 0 ] && [ "$(offender_lines)" -eq 1 ]; then
  ok "(vii) POSITIVE: complete mirror (valid symlinks) → rc 0 — row (c): symlink OR real dir"
else
  bad "(vii) POSITIVE: a complete symlinked mirror read rc=$RC — symlink counterparts rejected"
fi

# ─── Arms (viii)+(ix): missing counterpart, then repaired ─────────────────────
new_tree T
for s in alpha beta gamma; do mk_skill "$T" "$s"; done
mkdir -p "$T/.zcode/skills"
ln -s ../../.claude/skills/alpha "$T/.zcode/skills/alpha"
ln -s ../../.claude/skills/beta "$T/.zcode/skills/beta"
run_check "$T"
if [ "$RC" -ne 0 ] && [ "$(missing_names)" = "gamma" ]; then
  ok "(viii) NEGATIVE: one missing counterpart → rc non-zero, offender set is EXACTLY {gamma}"
else
  bad "(viii) NEGATIVE: rc=$RC, offenders=[$(missing_names | tr '\n' ' ')] — must be exactly gamma"
fi
ln -s ../../.claude/skills/gamma "$T/.zcode/skills/gamma"
run_check "$T"
if [ "$RC" -eq 0 ]; then
  ok "(ix) POSITIVE pair of (viii): same tree, link added → rc 0"
else
  bad "(ix) POSITIVE pair of (viii): repaired tree still rc=$RC — the defect arm proved nothing"
fi

# ─── Arm (x): TIMELINER fixture — the incident, field for field (#1502) ───────
# .claude/skills/ = arch, building-native-ui, getff, orchestrator, pr-template-multi-phase,
# rule-tests (real dirs, no counterparts) + getff-core (correctly linked).
# .zcode/skills/  = the correct getff-core link + a dangling rules-as-tests link.
new_tree T
for s in arch building-native-ui getff orchestrator pr-template-multi-phase rule-tests getff-core; do
  mk_skill "$T" "$s"
done
mkdir -p "$T/.zcode/skills"
ln -s ../../.claude/skills/getff-core "$T/.zcode/skills/getff-core"
ln -s ../../.claude/skills/rules-as-tests "$T/.zcode/skills/rules-as-tests"   # target does not exist
run_check "$T"
EXPECTED_SET="dangling:rules-as-tests
missing:arch
missing:building-native-ui
missing:getff
missing:orchestrator
missing:pr-template-multi-phase
missing:rule-tests"
OBSERVED_SET="$( { missing_names | sed 's/^/missing:/'; dangling_names | sed 's/^/dangling:/'; } | sort )"
if [ "$RC" -ne 0 ] && [ "$(offender_lines)" -eq 7 ] && [ "$OBSERVED_SET" = "$EXPECTED_SET" ]; then
  ok "(x) TIMELINER: rc non-zero, EXACTLY SEVEN offenders, exact SET match (6 missing + dangling rules-as-tests)"
else
  bad "(x) TIMELINER: rc=$RC, offender lines=$(offender_lines), observed set:
$(printf '%s\n' "$OBSERVED_SET" | sed 's/^/      /')
      expected set:
$(printf '%s\n' "$EXPECTED_SET" | sed 's/^/      /')"
fi
run_fixes "$T"
run_check "$T"
if [ "$FIX_N" -eq 7 ] && [ -z "$FIX_FAILED" ] && [ "$RC" -eq 0 ]; then
  ok "(x.b) TIMELINER: all seven printed commands, run as printed, leave a complete mirror → rc 0"
else
  bad "(x.b) TIMELINER: $FIX_N printed command(s), failed: ${FIX_FAILED:-none}; check afterwards rc=$RC"
fi

# ─── Arms (xi)+(xii): dangling link whose name matches an EXISTING skill ──────
new_tree T
mk_skill "$T" arch
mkdir -p "$T/.zcode/skills"
# Typo target → dangling, name matches. The typo is a MISSPELLING, never a case variant:
# on a case-insensitive file system (macOS APFS default) `skills/ARCH` resolves to the
# existing `skills/arch`, the link is not dangling, and the arm reads a false RED.
ln -s ../../.claude/skills/arhc "$T/.zcode/skills/arch"
run_check "$T"
if [ "$RC" -ne 0 ] \
   && [ "$(dangling_names)" = "arch" ] \
   && [ -z "$(missing_names)" ] \
   && printf '%s\n' "$CHECK_ERR" | grep -q "dangling mirror link 'arch'"; then
  ok "(xi) NEGATIVE: dangling link named like an existing skill → rc non-zero, ONE dangling line, no double missing-report"
else
  bad "(xi) NEGATIVE: rc=$RC, dangling=[$(dangling_names | tr '\n' ' ')], missing=[$(missing_names | tr '\n' ' ')] — dangling arm misfires"
fi
if printf '%s\n' "$CHECK_ERR" | grep -q "\.zcode/skills/arch -> ../../\.claude/skills/arhc"; then
  ok "(xi.b) the dangling line carries the link name AND its raw target (row (e))"
else
  bad "(xi.b) the dangling line does not carry the link name + target — a consumer cannot fix what is not named"
fi
run_fixes "$T"
run_check "$T"
if [ "$FIX_N" -eq 1 ] && [ -z "$FIX_FAILED" ] && [ "$RC" -eq 0 ]; then
  ok "(xi.c) the printed relink command, run as printed, replaces the dangling per-skill link → rc 0"
else
  bad "(xi.c) printed relink: $FIX_N command(s), failed: ${FIX_FAILED:-none}; check afterwards rc=$RC"
fi
rm "$T/.zcode/skills/arch"
ln -s ../../.claude/skills/arch "$T/.zcode/skills/arch"
run_check "$T"
if [ "$RC" -eq 0 ]; then
  ok "(xii) POSITIVE pair of (xi): same tree, link repaired → rc 0"
else
  bad "(xii) POSITIVE pair of (xi): repaired tree still rc=$RC — the dangling arm proved nothing"
fi

# ─── Arms (xiii)+(xiv): stale exemption ───────────────────────────────────────
new_tree T
mk_skill "$T" alpha
mkdir -p "$T/.zcode/skills" "$T/.ai-factory"
ln -s ../../.claude/skills/alpha "$T/.zcode/skills/alpha"
printf '# zcode mirror exemptions\nghost-skill removed from the framework in v9, mirror entry deleted too\n' \
  > "$T/.ai-factory/zcode-mirror-exemptions.txt"
run_check "$T"
if [ "$RC" -ne 0 ] && printf '%s\n' "$CHECK_ERR" | grep -q "stale exemption 'ghost-skill'"; then
  ok "(xiii) NEGATIVE: stale exemption (skill gone) → rc non-zero, entry named"
else
  bad "(xiii) NEGATIVE: stale exemption read rc=$RC — the escape hatch is unguarded"
fi
printf '# zcode mirror exemptions\n' > "$T/.ai-factory/zcode-mirror-exemptions.txt"
run_check "$T"
if [ "$RC" -eq 0 ]; then
  ok "(xiv) POSITIVE pair of (xiii): stale line removed → rc 0"
else
  bad "(xiv) POSITIVE pair of (xiii): clean exemptions file still rc=$RC"
fi

# ─── Arms (xv)-(xvii): exemption reason discipline ────────────────────────────
new_tree T
for s in alpha beta gamma; do mk_skill "$T" "$s"; done
mkdir -p "$T/.zcode/skills" "$T/.ai-factory"
ln -s ../../.claude/skills/alpha "$T/.zcode/skills/alpha"
# beta: short reason; gamma: no reason at all
printf 'beta too lazy\ngamma\n' > "$T/.ai-factory/zcode-mirror-exemptions.txt"
run_check "$T"
if [ "$RC" -ne 0 ] \
   && printf '%s\n' "$CHECK_ERR" | grep -q "exemption 'beta' (line 1): reason under 20 characters" \
   && printf '%s\n' "$CHECK_ERR" | grep -q "exemption 'gamma' (line 2): no reason given"; then
  ok "(xv)+(xvi) NEGATIVE: short reason AND missing reason both caught, line numbers cited"
else
  bad "(xv)+(xvi) NEGATIVE: rc=$RC — a reasonless exemption slipped through: $(printf '%s\n' "$CHECK_ERR" | grep 'exemption' | tr '\n' '|')"
fi
printf 'beta deliberately excluded from ZCode: mirrored by the team sync script instead\ngamma deliberately excluded from ZCode: mirrored by the team sync script instead\n' \
  > "$T/.ai-factory/zcode-mirror-exemptions.txt"
run_check "$T"
if [ "$RC" -eq 0 ] && [ "$(offender_lines)" -eq 1 ]; then
  ok "(xvii) POSITIVE: valid ≥20-char reasons suppress the missing offenders → rc 0, one OK line"
else
  bad "(xvii) POSITIVE: valid exemptions still rc=$RC with $(offender_lines) lines — the escape hatch does not open"
fi

# ─── Arms (xviii)+(xix): .zcode/ without .zcode/skills ────────────────────────
new_tree T
for s in alpha beta; do mk_skill "$T" "$s"; done
mkdir -p "$T/.zcode"
run_check "$T"
if [ "$RC" -ne 0 ] && [ "$(missing_names)" = "alpha
beta" ]; then
  ok "(xviii) NEGATIVE: .zcode/ without .zcode/skills → rc non-zero, EVERY skill named"
else
  bad "(xviii) NEGATIVE: rc=$RC, offenders=[$(missing_names | tr '\n' ' ')] — must name every skill"
fi
mkdir -p "$T/.zcode/skills"
for s in alpha beta; do ln -s "../../.claude/skills/$s" "$T/.zcode/skills/$s"; done
run_check "$T"
if [ "$RC" -eq 0 ]; then
  ok "(xix) POSITIVE pair of (xviii): mirror dir created complete → rc 0"
else
  bad "(xix) POSITIVE pair of (xviii): completed mirror still rc=$RC"
fi
# (xviii.b) on a fresh copy of the (xviii) state — the printed commands must create the missing
# .zcode/skills directory themselves.
new_tree T
for s in alpha beta; do mk_skill "$T" "$s"; done
mkdir -p "$T/.zcode"
run_check "$T"
run_fixes "$T"
run_check "$T"
if [ "$FIX_N" -eq 2 ] && [ -z "$FIX_FAILED" ] && [ "$RC" -eq 0 ]; then
  ok "(xviii.b) .zcode/ without .zcode/skills: both printed commands, run as printed, complete the mirror → rc 0"
else
  bad "(xviii.b) .zcode/ without .zcode/skills: $FIX_N printed command(s), failed: ${FIX_FAILED:-none}; check afterwards rc=$RC"
fi

# ─── Arm (xx): a plain FILE as the counterpart is NOT coverage ────────────────
# Behaviour-table row (c) admits «symlink OR real dir»; a regular file at
# .zcode/skills/<name> is neither and ZCode loads neither — the skill must still be
# reported. (T19 cold-review 2026-09-28 MINOR 1: the old `-e` test let a plain file
# cover a skill, so a corrupted/aborted mirror copy read as complete.)
new_tree T
for s in alpha beta; do mk_skill "$T" "$s"; done
mkdir -p "$T/.zcode/skills"
ln -s ../../.claude/skills/alpha "$T/.zcode/skills/alpha"
printf 'not a skill\n' > "$T/.zcode/skills/beta"
run_check "$T"
if [ "$RC" -ne 0 ] && [ "$(missing_names)" = "beta" ]; then
  ok "(xx) NEGATIVE: plain-file counterpart → not coverage, offender set is EXACTLY {beta}"
else
  bad "(xx) NEGATIVE: rc=$RC, offenders=[$(missing_names | tr '\n' ' ')] — a plain file covered skill beta"
fi

# ─── Arm (xxi): symlink → plain FILE stays covered (behaviour-table row (c)) ──
# T19 cold-review 2026-09-28 (m2): row (c) admits «symlink OR real dir» with NO
# resolves-to-a-directory qualifier, so a link to an existing file is covered BY CONTRACT.
# Pinned here so any future tightening is a deliberate table change, not a silent accident.
new_tree T
for s in alpha beta; do mk_skill "$T" "$s"; done
mkdir -p "$T/.zcode/skills"
ln -s ../../.claude/skills/alpha "$T/.zcode/skills/alpha"
printf 'not a skill\n' > "$T/outside.txt"
ln -s ../../outside.txt "$T/.zcode/skills/beta"
run_check "$T"
if [ "$RC" -eq 0 ] && [ "$(offender_lines)" -eq 1 ]; then
  ok "(xxi) POSITIVE: symlink→file counterpart is covered by contract (row (c)) → rc 0, one OK line"
else
  bad "(xxi) POSITIVE: rc=$RC with $(offender_lines) stderr lines — a symlink-to-file counterpart was reported, but row (c) admits it"
fi

# ─── Arm (xxii): a CRLF exemption file cannot pad a short reason past the gate ─
# T19 cold-review 2026-09-28 (m1): the trailing CR of a CRLF file counted toward ${#reason},
# so «excluded from ZCode» (19 real chars) read as 20 and passed. The check strips one
# trailing CR per exemption line before parsing.
new_tree T
for s in alpha beta; do mk_skill "$T" "$s"; done
mkdir -p "$T/.zcode/skills" "$T/.ai-factory"
ln -s ../../.claude/skills/alpha "$T/.zcode/skills/alpha"
printf 'beta excluded from ZCode\r\n' > "$T/.ai-factory/zcode-mirror-exemptions.txt"
run_check "$T"
if [ "$RC" -ne 0 ] && printf '%s\n' "$CHECK_ERR" | grep -q "exemption 'beta' (line 1): reason under 20 characters"; then
  ok "(xxii) NEGATIVE: a CRLF reason is length-checked WITHOUT its CR → 19 real chars caught"
else
  bad "(xxii) NEGATIVE: rc=$RC — a CR-padded short reason slipped past the gate: $(printf '%s\n' "$CHECK_ERR" | grep exemption | tr '\n' '|')"
fi

# ─── Arm (xxiii): POSITIVE pair of (xxii) — a ≥20-char CRLF reason still works ─
printf 'beta deliberately excluded from ZCode: mirrored by the team sync script instead\r\n' \
  > "$T/.ai-factory/zcode-mirror-exemptions.txt"
run_check "$T"
if [ "$RC" -eq 0 ] && [ "$(offender_lines)" -eq 1 ]; then
  ok "(xxiii) POSITIVE pair of (xxii): a ≥20-char CRLF reason still opens the escape hatch → rc 0"
else
  bad "(xxiii) POSITIVE pair of (xxii): rc=$RC with $(offender_lines) lines — the CRLF escape hatch does not open"
fi

# ─── Arm (xxiv): an exemption for a skill whose name looks like an option ─────
# W2-G review m1: the exemption lookup handed the name to grep as a bare argument, so «-x» was
# read as grep's own flag and the valid exemption never matched.
new_tree T
for s in alpha -x; do mk_skill "$T" "$s"; done
mkdir -p "$T/.zcode/skills" "$T/.ai-factory"
ln -s ../../.claude/skills/alpha "$T/.zcode/skills/alpha"
printf -- '-x deliberately excluded from ZCode: mirrored by the team sync script instead\n' \
  > "$T/.ai-factory/zcode-mirror-exemptions.txt"
run_check "$T"
if [ "$RC" -eq 0 ] && [ "$(offender_lines)" -eq 1 ] \
   && printf '%s\n' "$CHECK_ERR" | grep -q '^check-zcode-mirror: OK'; then
  ok "(xxiv) POSITIVE: a valid exemption for a skill named «-x» opens the escape hatch → rc 0, OK line"
else
  bad "(xxiv) POSITIVE: exemption for «-x» → rc=$RC — the name reached grep as an option: $(printf '%s\n' "$CHECK_ERR" | head -2 | tr '\n' '|')"
fi

# ─── Hook arms (a)-(e): the templates that call the check, run as a hook runs them ─
HUSKY_HOOK="$REPO_ROOT/packages/core/templates/shared/husky-pre-commit.sh"
PY_HOOK="$REPO_ROOT/packages/core/templates/python/hooks/pre-push.sh"
# A hook runs inside git with GIT_DIR & co. exported; never let those leak into a fixture's git.
unset_git_env() { unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_PREFIX; }

# new_hook_tree <var> — a git work tree with skills alpha + beta, a mirror covering only alpha
# (the gap: beta), and the check delivered where the installers put it (scripts/, mode 755).
new_hook_tree() {
  local ht
  new_tree ht
  mk_skill "$ht" alpha; mk_skill "$ht" beta
  mkdir -p "$ht/.zcode/skills" "$ht/scripts"
  ln -s ../../.claude/skills/alpha "$ht/.zcode/skills/alpha"
  ( unset_git_env; git -C "$ht" init -q )
  cp "$CHECK_SCRIPT" "$ht/scripts/check-zcode-mirror.sh" 2>/dev/null \
    && chmod 755 "$ht/scripts/check-zcode-mirror.sh"
  eval "$1=\$ht"
}

# run_hook <tree> <interpreter> <hook> [VAR=value …] — run the hook from the tree root, stdin
# closed, with stub npx / ast-grep / ruff first on PATH (each appends its name to a calls file and
# exits 0). Sets HOOK_RC, HOOK_ERR (stderr) and HOOK_CALLS (one tool name per call).
run_hook() {
  local tree="$1" interp="$2" hook="$3" stub="$1.stubs" calls="$1.calls" errf="$1.err" tool
  shift 3
  mkdir -p "$stub"; : > "$calls"
  for tool in npx ast-grep ruff; do
    printf '#!/bin/sh\necho %s >> "%s"\nexit 0\n' "$tool" "$calls" > "$stub/$tool"
    chmod +x "$stub/$tool"
  done
  ( cd "$tree" || exit 99
    unset_git_env
    unset AIF_PROJECT_ROOT GETFF_SKIP_HOOKS
    for kv in "$@"; do export "${kv?}"; done
    PATH="$stub:$PATH" "$interp" "$hook" ) </dev/null >/dev/null 2>"$errf"
  HOOK_RC=$?
  HOOK_ERR=$(cat "$errf")
  HOOK_CALLS=$(cat "$calls")
}

# hook_arms <label> <interpreter> <hook> <downstream tool>
hook_arms() {
  local label="$1" interp="$2" hook="$3" tool="$4" H CC blocked=0
  if [ ! -f "$hook" ]; then
    bad "($label) hook template $hook missing — no hook arm can run"
    return
  fi
  blocked_gap() { # the (a)-(c) verdict: blocked, the gap named, nothing downstream ran
    [ "$HOOK_RC" -ne 0 ] && [ -z "$HOOK_CALLS" ] \
      && printf '%s\n' "$HOOK_ERR" | grep -q "missing mirror entry for skill 'beta'"
  }
  new_hook_tree H

  run_hook "$H" "$interp" "$hook"
  if blocked_gap; then
    blocked=1
    ok "($label a) check present + mirror gap → rc $HOOK_RC, gap named, $tool NOT run"
  else
    bad "($label a) check present + mirror gap → rc=$HOOK_RC, calls=[$(printf '%s' "$HOOK_CALLS" | tr '\n' ' ')] — the hook let an incomplete mirror through"
  fi

  chmod 644 "$H/scripts/check-zcode-mirror.sh" 2>/dev/null
  run_hook "$H" "$interp" "$hook"
  if blocked_gap; then
    ok "($label b) check at mode 644 still runs (the hook runs it with sh) → blocked"
  else
    bad "($label b) check at mode 644 → rc=$HOOK_RC, calls=[$(printf '%s' "$HOOK_CALLS" | tr '\n' ' ')] — the executable bit decided whether the check ran: $(printf '%s\n' "$HOOK_ERR" | head -1)"
  fi
  chmod 755 "$H/scripts/check-zcode-mirror.sh" 2>/dev/null

  new_tree CC; mk_skill "$CC" solo          # a CC-only tree: the check would exit 0 there
  run_hook "$H" "$interp" "$hook" "AIF_PROJECT_ROOT=$CC"
  if blocked_gap; then
    ok "($label c) inherited AIF_PROJECT_ROOT naming another tree → the hook still checks its own tree → blocked"
  else
    bad "($label c) inherited AIF_PROJECT_ROOT=$CC → rc=$HOOK_RC — an ambient variable redirected the check away from the tree being committed/pushed"
  fi

  ln -s ../../.claude/skills/beta "$H/.zcode/skills/beta"
  run_hook "$H" "$interp" "$hook"
  if [ "$HOOK_RC" -eq 0 ] && printf '%s\n' "$HOOK_CALLS" | grep -qx "$tool" \
     && printf '%s\n' "$HOOK_ERR" | grep -q '^check-zcode-mirror: OK'; then
    ok "($label d) mirror completed → rc 0, the check's OK line, $tool run"
  else
    bad "($label d) completed mirror → rc=$HOOK_RC, calls=[$(printf '%s' "$HOOK_CALLS" | tr '\n' ' ')], OK line $(printf '%s\n' "$HOOK_ERR" | grep -c '^check-zcode-mirror: OK')"
  fi
  rm "$H/.zcode/skills/beta"                # restore the gap for (e)

  rm -f "$H/scripts/check-zcode-mirror.sh"
  run_hook "$H" "$interp" "$hook"
  if [ "$blocked" -eq 1 ] && [ "$HOOK_RC" -eq 0 ] \
     && printf '%s\n' "$HOOK_CALLS" | grep -qx "$tool" \
     && printf '%s\n' "$HOOK_ERR" | grep -q 'check-zcode-mirror.sh not found' \
     && printf '%s\n' "$HOOK_ERR" | grep -q -- '--refresh'; then
    ok "($label e) check removed from the (a) tree → loud WARN naming --refresh, rc 0, $tool run (the flip is the removal alone)"
  else
    bad "($label e) check removed → rc=$HOOK_RC, (a) blocked=$blocked, calls=[$(printf '%s' "$HOOK_CALLS" | tr '\n' ' ')], stderr: $(printf '%s\n' "$HOOK_ERR" | head -2 | tr '\n' '|')"
  fi
}

if ! command -v git >/dev/null 2>&1; then
  skip "(hook arms) git not available — the hook arms need a git work tree; SKIP"
else
  hook_arms "husky pre-commit" sh "$HUSKY_HOOK" npx
  hook_arms "python pre-push" bash "$PY_HOOK" ast-grep
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
