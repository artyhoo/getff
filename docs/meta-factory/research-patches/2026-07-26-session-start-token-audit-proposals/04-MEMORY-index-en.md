# Proposal 4 — operator-global MEMORY.md index, English-compressed rewrite

> **Apply to:** operator-global `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/MEMORY.md`
> (OUTSIDE the repo — this is a host-side, operator-owned artefact; the agent cannot reach it
> from inside the container).
> **Origin:** session-start-token-audit S2 §1 table row 5.
> **Mechanism:** the operator's host-cc MEMORY.md is 19,407 bytes of Cyrillic Russian index
> lines (measured at S1 attribution). Russian text costs ~2× tokens per byte vs English (T-TOK-A:
> bytes/2.2 for >30% non-ASCII, vs bytes/4 for ASCII-dominant). The index lines are pure
> navigation pointers — they do not carry semantic content the operator needs in Russian — so
> translating them to English halves their per-byte token cost while leaving the actual memory
> CONTENT files (the `.md` files the index points to) untouched in Russian.
>
> **Token impact:** projected ~13,000 bytes saved at host-cc session-start (19,407 → ~6,400
> bytes), ~5,909 tokens saved (RU: 19,407/2.2 ≈ 8,821 → EN: 6,400/4 ≈ 1,600, delta ≈ 7,221
> tokens; conservative projection ~5,909 to account for some English overhead). The container
> (aif-container) is UNAFFECTED — it has its own 1,158-byte English MEMORY.md, already optimal.

## Why index-only, not content-files

The memory content files (e.g. `feedback_no_git_reset_hard.md`, `project_handoff_*.md`) carry
the operator's verbatim framing and are referenced by their Russian-language keys in many rule
citations. Translating them would:

1. Break the rule citations (the rule files cite `feedback_X` slugs and quote Russian phrases
   verbatim — translation would orphan those quotes).
2. Lose operator-voice context (the Russian phrasing is often the load-bearing signal in
   feedback entries — English paraphrase erases it).
3. Cost operator time for marginal benefit (the content files are NOT loaded at session-start;
   only MEMORY.md is auto-injected as an index).

The index lines are different: they are pure navigation ("X — short summary"), the summary can
be re-phrased in English without loss, and the load-bearing Russian phrases live in the content
files (which the index merely points to).

## The template (operator-applied)

The operator's actual MEMORY.md content is not container-readable (host path outside the
container's filesystem). The template below is the structure to follow; the operator fills in
the index lines from their own current MEMORY.md, translating each line's summary clause to
English.

```markdown
# Memory index

<!-- Each entry: one line. Slug stays as-is (filenames unchanged). Summary clause in English. -->
<!-- Russian verbatim quotes stay inside the content files, NOT in the index. -->

- [Handoff container devDeps omitted](project_handoff_container_devdeps_omitted.md) — NODE_ENV=production skips vitest; force --include=dev + NODE_ENV=development to run principle tests in-container
- [Handoff worktree pre-existing pollution](project_handoff_worktree_preexisting_pollution.md) — prepared branches arrive with unrelated M files (AGENTS.md, hooks) that break principle 14/21 locally; restore to HEAD, commit only your files
- [enforcement-liveness S2 compile reach](project_enforcement_liveness_s2_compile_reach.md) — S2 variant-A compile is opportunistic (deps-present only); non-full flow stays on parked dev-deps fork; ship-precompiled is the reach-everyone alternative
- [Handoff worktree vanish recovery](project_handoff_worktree_vanish_recovery.md) — prepared worktree dir can be deleted mid-session; branch survives → `git worktree prune` + `git worktree add <path> <branch>` to recover
- [Handoff npm cache root-owned (RESOLVED)](project_handoff_npm_cache_root_owned.md) — image fixed 2026-07-24: /home/node/.npm now node-owned, npm_config_cache workaround no longer needed (workaround kept for regression)
- [promote staging→main mechanics](feedback_promote_staging_to_main_mechanics.md) — codified into [docs/meta-factory/operational-conventions.md §2](rules-as-tests-aif/docs/meta-factory/operational-conventions.md); see CLAUDE.md Harness-gates pointer
- [meta-orchestrator self-reviews own kickoff](feedback_meta_orch_self_reviews_own_kickoff.md) — codified into [docs/meta-factory/operational-conventions.md §3](rules-as-tests-aif/docs/meta-factory/operational-conventions.md); see CLAUDE.md
- [harness merge block + 500-line gate](feedback_harness_merge_block_and_500line_gate.md) — codified in CLAUDE.md Harness-gates (Homebrew PATH + 600-line markdown gate)
- [probe inflight automation before dispatch](feedback_probe_inflight_automation_before_dispatch.md) — codified in CLAUDE.md Operational conventions
- [git reset --hard banned](feedback_no_git_reset_hard.md) — destructive-op ban; recovery via `git reflog` only
- [branch contamination rescue pattern](feedback_branch_contamination_rescue_pattern.md) — when a feature branch picks up unrelated commits, cherry-pick the intended work to a fresh branch off main
- [operator-control-not-decide-everything](operator-control-not-decide-everything.md) — operator gates ambiguous forks only; clear-calls are decided + reported, not asked
- [preserve before destructive delegation](preserve_before_destructive_delegation.md) — codified as T17 in [.claude/rules/ai-laziness-traps.md §2](rules-as-tests-aif/.claude/rules/ai-laziness-traps.md)
- [preserve unique residue via skill-context](preserve_unique_residue_via_skill_context.md) — codified as T18 in [.claude/rules/ai-laziness-traps.md §2](rules-as-tests-aif/.claude/rules/ai-laziness-traps.md)
- [own QA before handoff](own_qa_before_handoff.md) — codified as T19 in [.claude/rules/ai-laziness-traps.md §2](rules-as-tests-aif/.claude/rules/ai-laziness-traps.md)
- [...add the rest of your entries here, same pattern...]
```

(The 5 container-side entries above are the operator's likely current set — they were observed
in the container's separate MEMORY.md. The actual host-cc MEMORY.md has more entries that the
operator will translate directly. The pattern is: keep the slug, translate the summary clause
to English, drop the long Russian narrative, leave the content file alone.)

## Apply recipe

```bash
# 0. Backup the current MEMORY.md (in case the operator wants to revert):
cp ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/MEMORY.md \
   ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/MEMORY.md.ru.bak

# 1. Measure the current byte count + token estimate:
wc -c ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/MEMORY.md
# expected: ~19,407 bytes per S1 attribution
LC_ALL=C grep -o '[^ -~]' ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/MEMORY.md | wc -l
# non-ASCII ratio → decides byte/4 vs byte/2.2 divisor

# 2. Edit the file in place: translate each index line's summary clause to English.
#    DO NOT touch the content files in the same directory.
#    DO NOT rename any slug (the bracketed link target must stay).
#    DO NOT delete any entry — only translate the summary.

# 3. After saving, measure again:
wc -c ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/MEMORY.md
# target: ~6,400 bytes (66% reduction)

# 4. Verify a fresh CC session still finds every entry by slug:
#    Start a new CC session in this repo and ask: "What's in your memory about X?"
#    for each of the major slugs. The model should pull the (unchanged) content file
#    via the (translated) index pointer.
```

## Why this is safe

- The index is **pure navigation** — translating the summary clause does not change which file
  the index points to. The bracketed link target stays as-is.
- The content files are unchanged. Their Russian content remains the load-bearing semantic
  payload. Only the index "table of contents" becomes English.
- `MEMORY.md` is auto-loaded as an index at session-start. The savings hit every session.
- The container's separate `MEMORY.md` (5 entries, 1,158 bytes, already English) is untouched.

## Risks if misapplied

- **Translating content files (not just the index)** is a destructive change — the rule
  citations that quote Russian phrases verbatim from those files become orphans. Apply
  index-only.
- **Renaming slugs** (e.g. `feedback_promote_staging_to_main_mechanics.md` →
  `feedback_promote_staging.md`) breaks every `feedback_X` reference in
  `.claude/rules/*.md`, CLAUDE.md, and `docs/meta-factory/`. Keep slugs as-is.
- **Forgetting the backup** makes the change irreversible if the operator later wants the
  Russian index back. Step 0 of the recipe creates `.ru.bak`.
- **Deleting "stale" entries** silently — `memory-codification.md` §3 says memory entries
  that codify into the repo should reduce to a one-line pointer (e.g. "See
  `docs/meta-factory/operational-conventions.md §2` — codified at <SHA>"). Do NOT delete them;
  convert to pointers. The template above shows the pointer shape for entries that already
  have repo codification.
