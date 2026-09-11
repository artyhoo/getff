#!/usr/bin/env bash
# Generate plugin/skills/ entries from their in-repo source populations.
#
#   plugin/skills/<name>/ ← source population per the ENTRY TABLE below:
#     - skills/<name>/          (top-level; the ZCode workspace-skills population)
#     - .claude/skills/<name>/  (repo session-skills population)
#
# Derivation modes (per entry, declared in the ENTRY TABLE):
#   byte-copy             — verbatim tree copy (frontmatter stays byte-verbatim; NO header
#                          is ever injected: SKILL.md frontmatter must open on line 1).
#   transform             — copy + `transform_internal_refs` (the 15 sed arms mirrored from
#                          setup.d/lib.sh:144-165, rewriting repo-internal links to blob URLs).
#   transform+textstrip   — transform + a 16th, link-TEXT-scoped arm stripping the `../`
#                          ladder from link TEXT (the shape today's plugin/skills/getff
#                          hand-copy carries; Stage 0 probe B proved byte-identity — see
#                          docs/meta-factory/research-patches/2026-09-11-plugin-skills-generator-stage0-reverif.md §2).
#
# The ENTRY TABLE IS THE RECORDED MEMBERSHIP DECISION (the skills analogue of principle 24(g)'s
# M1_SET). Entries absent from plugin/skills/ are CREATED on the next run; entries present but
# not in the table (plugin-native: installing-enforcement, using-getff) are NEVER touched.
# Adding a table row is therefore itself the membership decision — it lands with a PR-body
# rationale (Stage 2 does this for the CORE four).
#
# Escape hatch: a source SKILL.md may declare
#     <!-- @plugin-skills: manual — <>=20-char rationale for staying hand-maintained -->
# (anywhere in the file). The entry is then skipped, never written. A marker whose rationale is
# shorter than 20 chars is malformed → exit 2 (same grammar gate as the twins' marker).
#
# Exit codes (mirrors scripts/generate-plugin-twins.sh):
#   0  success (including the all-no-op case)
#   1  environment/usage error (missing source population, unknown table entry)
#   2  malformed marker or unknown derivation mode
#   3  clobber-guard refusal — see guard_tree_clobber below
#
# Regeneration is a NO-OP on a clean tree: every write is preceded by a byte comparison, so a
# clean run rewrites nothing (no mtime churn in pre-commit). Clobber guard: per file, refuse
# (exit 3, before ANY write) when the existing copy matches NEITHER the render from the
# working-tree source NOR the render from the HEAD source — content no source reproduces would
# be silently deleted (the #1044/#1442 Stage-9C class, twins header :78-95). Deliberately
# permissive where twins is: no HEAD, or the source file not in HEAD (first generation), or a
# payload file that HEAD's source tree also lacks being removed → allow, log.
#
# Transform parity obligation: the arm block below is a DELIBERATE mirror of
# setup.d/lib.sh:148-162 (F2 verdict: reimplement + parity gate — the kickoff §6 non-goal
# «No installer changes» blocks sourcing or extracting lib.sh). The two arm sets are held
# equal by tests/plugin/skills-generation.test.sh, which extracts both blocks and diffs them;
# edit them only in pairs. UPSTREAM_BLOB_URL default must match setup.d/lib.sh:47.
#
# Zero deps beyond bash + sed + git. Idempotent. Consult record: prior-art-evaluations.md#270
# (trigger fired) + #266; control-flow analog obra/superpowers sync-to-codex-plugin.sh.
set -euo pipefail

LOG_LEVEL="${LOG_LEVEL:-INFO}"
log_info() { printf '[INFO] generate-plugin-skills: %s\n' "$*" >&2; }
log_debug() { [ "$LOG_LEVEL" = "DEBUG" ] && printf '[DEBUG] generate-plugin-skills: %s\n' "$*" >&2 || true; }

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PAYLOAD_DIR="$REPO_ROOT/plugin/skills"
UPSTREAM_BLOB_URL="${UPSTREAM_BLOB_URL:-https://github.com/artyhoo/getff/blob/main}"

# ── The recorded membership decision ─────────────────────────────────────────
# name|source-population|mode. Population keys: skills → top-level skills/, claude-skills →
# .claude/skills/. The CORE four (ai-doc rule-research rule-tests template-audit ← claude-skills,
# mode transform) join HERE in Stage 2, with the supersession rationale in that PR body
# (research-patch 2026-09-11-plugin-skills-generator-stage0-reverif.md §4 F5).
ENTRY_TABLE=(
  "getff|skills|transform+textstrip"
  "tool-bootstrapping|skills|byte-copy"
)

population_dir() {
  case "$1" in
    skills)        printf '%s/skills' "$REPO_ROOT" ;;
    claude-skills) printf '%s/.claude/skills' "$REPO_ROOT" ;;
    *) return 1 ;;
  esac
}

# tool-bootstrapping derivation depth — recorded disposition (Stage 0 row 0.3, patch §1/§5):
# the plugin side derives from the top-level skills/ fork, NOT from .claude/skills/. The
# .claude/skills/ → skills/ prose adaptation (different header, consumer-weakened AIF wording)
# stays HAND-MAINTAINED and un-gated BY DECISION: it is judgment-bearing prose (the doc-authority
# D7 class), skills/ is its consumer-shaped output, and the consumer-facing consequence is now
# frozen by this generator (byte-copy from skills/), so plugin-side rot via the fork is no
# longer representable. Never silently delete the hand-fork (kickoff Stage 1 item 5).

# ── Transform (parity-guarded mirror of setup.d/lib.sh:144-165 + the 16th arm) ──────
# BEGIN TRANSFORM ARMS (parity-extracted by tests/plugin/skills-generation.test.sh; edit in
# pairs with setup.d/lib.sh transform_internal_refs)
transform_one_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  sed -E -i \
    -e "s#\]\((\.\./)+docs/#](${UPSTREAM_BLOB_URL}/docs/#g" \
    -e "s#\]\((\.\./)+packages/#](${UPSTREAM_BLOB_URL}/packages/#g" \
    -e "s#\]\((\.\./)+README\.md#](${UPSTREAM_BLOB_URL}/README.md#g" \
    -e "s#\]\((\.\./)+CLAUDE\.md#](${UPSTREAM_BLOB_URL}/CLAUDE.md#g" \
    -e "s#\]\((\.\./)+\.claude/rules/#](${UPSTREAM_BLOB_URL}/.claude/rules/#g" \
    -e "s#\]\((\.\./)+\.claude/skills/#](${UPSTREAM_BLOB_URL}/.claude/skills/#g" \
    -e "s#\]\((\.\./)+\.claude/orchestrator-prompts/#](${UPSTREAM_BLOB_URL}/.claude/orchestrator-prompts/#g" \
    -e "s#\]\((\.\./)+rules/#](${UPSTREAM_BLOB_URL}/.claude/rules/#g" \
    -e "s|\]\((\.\./)+install\.sh([#)])|](${UPSTREAM_BLOB_URL}/install.sh\2|g" \
    -e "s#\]\((\.\./)+agents/#](${UPSTREAM_BLOB_URL}/agents/#g" \
    -e "s#\]\((\.\./)+tests/#](${UPSTREAM_BLOB_URL}/tests/#g" \
    -e "s#\]\((\.\./)+orchestrator-prompts/#](${UPSTREAM_BLOB_URL}/.claude/orchestrator-prompts/#g" \
    -e "s#\]\((\.\./)+\.github/#](${UPSTREAM_BLOB_URL}/.github/#g" \
    -e "s#\]\((\.\./)+scripts/run-local-ci-sweep\.sh#](${UPSTREAM_BLOB_URL}/scripts/run-local-ci-sweep.sh#g" \
    -e "s#\]\((\.\./)+hooks/check-worker-dispatch-channel\.sh#](${UPSTREAM_BLOB_URL}/.claude/hooks/check-worker-dispatch-channel.sh#g" \
    -e "s#\[((\.\./)+)([^]]*\]\()#[\3#g" \
    "$f"
}
# END TRANSFORM ARMS
# The 16th arm (textstrip) is link-TEXT-scoped by construction: it only rewrites a `[(../)+`
# ladder that opens a link whose `](` follows before the next `]`, so non-link bracket text
# can never be corrupted. Census at Stage 0: the ladder shape exists only in the five
# skills/getff/references/*.md README links (patch §2, consequence 1).

apply_mode_to_tree() {
  local mode="$1" tree="$2"
  case "$mode" in
    byte-copy) return 0 ;;
    transform|transform+textstrip)
      local md
      while IFS= read -r -d '' md; do transform_one_file "$md"; done \
        < <(find "$tree" -name '*.md' -type f -print0 2>/dev/null)
      ;;
  esac
}

# Render a single source file under a mode to stdout (used by the clobber guard).
render_one() {
  local src="$1" mode="$2" tmp
  tmp=$(mktemp /tmp/gps-render.XXXXXX.md)
  cp "$src" "$tmp"
  [ "$mode" = "byte-copy" ] || transform_one_file "$tmp"
  cat "$tmp"
  rm -f "$tmp"
}

# Escape-hatch marker on the source SKILL.md. Echoes the rationale; rc 2 on malformed.
marker_rationale() {
  local skill_md="$1" rationale
  rationale=$(grep -o '@plugin-skills:[[:space:]]*manual[[:space:]]*[—-].*' "$skill_md" 2>/dev/null | head -1 | sed 's/@plugin-skills:[[:space:]]*manual[[:space:]]*[—-][[:space:]]*//; s/-->$//' || true)
  if [ -z "$rationale" ]; then return 1; fi
  rationale=$(printf '%s' "$rationale" | sed 's/[[:space:]]*$//')
  if [ "${#rationale}" -lt 20 ]; then
    echo "[ERROR] generate-plugin-skills: $skill_md — @plugin-skills: manual rationale must be >=20 chars, got: $rationale" >&2
    exit 2
  fi
  printf '%s' "$rationale"
}

# ── Clobber guard (per file + orphans) ───────────────────────────────────────
# Refuses BEFORE any write when a payload file matches neither the render from the
# working-tree source nor the render from the HEAD source, or when a payload file exists
# that neither source tree knows (content no source reproduces). Guard inputs:
#   $1 source dir   $2 destination dir   $3 mode   $4 display name
guard_tree_clobber() {
  local src_dir="$1" dst_dir="$2" mode="$3" name="$4"
  local src_rel="${src_dir#"$REPO_ROOT"/}"
  local have_head=0
  if git -C "$REPO_ROOT" rev-parse --verify -q HEAD >/dev/null 2>&1 \
     && git -C "$REPO_ROOT" cat-file -e "HEAD:$src_rel" 2>/dev/null; then
    have_head=1
  fi

  local head_src_tree=""
  if [ "$have_head" -eq 1 ]; then
    head_src_tree=$(mktemp -d)
    git -C "$REPO_ROOT" ls-tree -r --name-only "HEAD:$src_rel" > "$head_src_tree/list" 2>/dev/null || have_head=0
  fi

  local rc=0
  # 1. Every destination file must be reproducible from wt-source or HEAD-source.
  while IFS= read -r -d '' dst_file; do
    local rel="${dst_file#"$dst_dir"/}"
    local src_file="$src_dir/$rel"
    if [ -f "$src_file" ]; then
      if cmp -s <(render_one "$src_file" "$mode") "$dst_file"; then continue; fi
    fi
    if [ "$have_head" -eq 1 ] && git -C "$REPO_ROOT" cat-file -e "HEAD:$src_rel/$rel" 2>/dev/null; then
      local head_src_file
      head_src_file=$(mktemp)
      if git -C "$REPO_ROOT" show "HEAD:$src_rel/$rel" > "$head_src_file" 2>/dev/null \
         && cmp -s <(render_one "$head_src_file" "$mode") "$dst_file"; then
        rm -f "$head_src_file"
        continue  # stale payload — the normal case this generator exists to fix
      fi
      rm -f "$head_src_file"
    fi
    echo "[ERROR] generate-plugin-skills: $name — refusing to overwrite plugin/skills/$name/$rel." >&2
    echo "  Its content matches neither the render from $src_rel/$rel (working tree) nor from HEAD," >&2
    echo "  so this file holds logic no source reproduces; writing would delete it silently" >&2
    echo "  (the #1044/#1442 silent-loss class)." >&2
    echo "  Fix: move the content into the SOURCE and re-run, or commit the payload reduction" >&2
    echo "  explicitly first, or declare <!-- @plugin-skills: manual — <rationale> --> on the source SKILL.md." >&2
    rc=3
  done < <(find "$dst_dir" -type f -print0 2>/dev/null)
  # 2. Destination dirs that exist but whose every file was already covered above are handled;
  #    whole-extra subtrees cannot exist (we only ever write files the source has).

  [ "$have_head" -eq 1 ] && rm -rf "$head_src_tree"
  return $rc
}

# ── Main pass ────────────────────────────────────────────────────────────────
[ -d "$PAYLOAD_DIR" ] || mkdir -p "$PAYLOAD_DIR"

declared_names=""
created=0; updated=0; noop=0; manual=0

for entry in "${ENTRY_TABLE[@]}"; do
  name="${entry%%|*}"
  rest="${entry#*|}"
  pop="${rest%%|*}"
  mode="${rest#*|}"

  case "$mode" in
    byte-copy|transform|transform+textstrip) ;;
    *) echo "[ERROR] generate-plugin-skills: $name — unknown derivation mode: $mode" >&2; exit 2 ;;
  esac

  src_dir="$(population_dir "$pop")/$name" || { echo "[ERROR] unknown population: $pop" >&2; exit 1; }
  if [ ! -d "$src_dir" ]; then
    echo "[ERROR] generate-plugin-skills: $name — source population missing: $src_dir" >&2
    exit 1
  fi

  declared_names="$declared_names $name"

  if [ -f "$src_dir/SKILL.md" ]; then
    # rc 0 + non-empty = manual (skip); rc 1 = no marker (fall through to generation);
    # rc 2 = malformed marker (fatal). `||` would catch 1 and 2 alike, so capture and branch.
    mrc=0
    rat=$(marker_rationale "$src_dir/SKILL.md") || mrc=$?
    [ "$mrc" -eq 2 ] && exit 2
    if [ "$mrc" -eq 0 ] && [ -n "$rat" ]; then
      log_info "skill: $name mode: manual (declared on source: $rat)"
      manual=$((manual+1))
      continue
    fi
  fi

  dst_dir="$PAYLOAD_DIR/$name"

  if [ -d "$dst_dir" ]; then
    guard_tree_clobber "$src_dir" "$dst_dir" "$mode" "$name" || exit 3
    # Regenerate only when bytes differ (no-op on a clean tree — no mtime churn).
    diff_found=0
    while IFS= read -r -d '' src_file; do
      rel="${src_file#"$src_dir"/}"
      dst_file="$dst_dir/$rel"
      if [ ! -f "$dst_file" ] || ! cmp -s <(render_one "$src_file" "$mode") "$dst_file"; then
        diff_found=1
        break
      fi
    done < <(find "$src_dir" -type f -print0 2>/dev/null)
    if [ "$diff_found" -eq 0 ]; then
      log_debug "skill: $name already in sync (no-op)"
      noop=$((noop+1))
      continue
    fi
  fi

  tmp_tree=$(mktemp -d)
  cp -a "$src_dir/." "$tmp_tree/"
  apply_mode_to_tree "$mode" "$tmp_tree"
  rm -rf "$dst_dir"
  mkdir -p "$PAYLOAD_DIR/$name"
  cp -a "$tmp_tree/." "$dst_dir/"
  rm -rf "$tmp_tree"
  log_info "skill: $name mode: $mode — written"
  created=$((created+1))
done

# Plugin-native entries present in the payload but not table-managed: report, never touch.
for existing in "$PAYLOAD_DIR"/*/; do
  [ -d "$existing" ] || continue
  ename=$(basename "$existing")
  case " $declared_names " in
    *" $ename "*) ;;
    *) log_info "plugin-native (not table-managed, untouched): $ename" ;;
  esac
done

log_info "generated $created (written), $noop already in sync, $manual manual-skipped"

# created counts writes; distinguishing first-generation vs update is visible in git status,
# which is the reviewer's surface (the generator never invents membership — the table does).
exit 0
