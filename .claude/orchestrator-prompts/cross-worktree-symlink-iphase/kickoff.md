# I-phase — implement cross-worktree symlink-to-canonical (the un-built §5 verdict)

> **Decision origin:** research-patch `docs/meta-factory/research-patches/2026-05-17-cross-worktree-coord-doc-sync.md` (merged PR #77/#78, 2026-05-20). Verdict **(b) ADAPT — symlink-to-canonical**: make the gitignored contents of `.claude/orchestrator-prompts/` symlinks to ONE canonical dir outside every worktree, so an edit/new file in any worktree is the same file everywhere and survives `git worktree remove`. SSOT #48.
> **Status verified 2026-06-01 (4 checks):** the verdict was research-only and **NEVER implemented** — zero symlinks in any worktree's orchestrator-prompts, `~/.claude-coordination/` absent, both worktree helpers symlink only `node_modules`, repo-wide zero `ln -s` on coord/orchestrator dirs. Not broken — never built.
> **Do NOT re-decide the verdict** (settled + merged). This I-phase only IMPLEMENTS it. `reviewer-discipline §2`.

## TASK
Build the `link-coordination.sh` helper from patch §5 (≤30 LOC bash, harness-agnostic, zero LLM), wire it into worktree creation, seed the canonical store, and migrate existing worktrees — **reconciling two things that changed AFTER the 2026-05-17 patch** (below). Closes the maintainer's pain: a kickoff born/edited in a disposable worktree is currently lost on delete (J5's one-way copy does not carry it back).

## ⚠ Two post-patch changes the §5 sketch does NOT account for — MUST resolve (Phase -1 verifies)

1. **J5 rsync-hydration already ships** (`.claude/hooks/worktree-setup.sh:122-126`, PR #310, 2026-05-31): on worktree create it does `rsync -a --ignore-existing` primary→worktree, creating **real** dirs. The §5 helper (`exit 1` on "exists as real dir", patch line 183) would then always CONFLICT. **Decision required:** symlink-to-canonical SUPERSEDES one-way copy (symlink = live shared; rsync = stale snapshot). So this I-phase must **replace** the J5 rsync block with the symlink helper, not run both. Confirm + remove/disable the rsync block in the same PR; note J5's read-only goal is subsumed by the symlink (canonical store is visible in every worktree by identity).

2. **`done.md` tracking was added AFTER the patch.** On 2026-05-17 only `README.md` was tracked (patch line 215). Now `.gitignore:14` also tracks `*/done.md` **inside each umbrella subdir**. Therefore patch §5 "option 1: symlink each umbrella subdir" **breaks done.md** (symlinking `<umbrella>/` shadows the tracked `<umbrella>/done.md` → git sees it deleted → `priority-score.sh` Layer C3 regresses). The patch's README-only wrinkle analysis is now incomplete. **Decision required:** pick a symlink granularity that keeps tracked `README.md` AND every `*/done.md` as real per-worktree files. Candidate approaches for the implementer to evaluate + pick one with rationale:
   - (i) Symlink only `<umbrella>/kickoff.md` (+ other gitignored files), leaving `<umbrella>/` a real dir and `done.md` real. Per-file symlinks; new files born in a worktree need re-running the helper to link back — document that.
   - (ii) Move kickoffs to a sibling gitignored tree with NO tracked files (e.g. `.claude/orchestrator-prompts/_shared/<umbrella>/kickoff.md`), symlink `_shared/` wholesale; keep `<umbrella>/done.md` + `README.md` in the real tree. One symlink, clean, but relocates kickoffs (tooling/skill paths must follow).
   - (iii) Other — justify against the done.md + README constraints.
   - Whichever is chosen: a test must assert `git status` stays clean for tracked `README.md` + all `*/done.md` after linking (no phantom deletions).

## Hard constraints
- **Never clobber.** Helper fails loud on real-dir conflict (patch line 183-184), never `rm`/overwrite. `#no-git-reset-hard` spirit.
- **Canonical store outside every worktree:** `${CLAUDE_COORDINATION_DIR:-$HOME/.claude-coordination/rules-as-tests-aif}` (patch line 169). Survives `git worktree remove` AND main-checkout deletion (lives in `$HOME`).
- **Seed source = the primary checkout** — this session consolidated all **123 umbrellas** into `/Users/art/code/rules-as-tests-aif/.claude/orchestrator-prompts/`, so it is the freshest/most-complete canonical source. This resolves the patch §193 "which worktree is canonical?" ambiguity — seed `$CANON` from the primary checkout. (Confirm count before seeding.)
- **Harness-agnostic bash**, internal tooling (`dual-implementation §3` → CC-native-only default; plain bash needs no `@cc-only-rationale`; carry `@dual-pair: cross-worktree-coordination-doc-sync` + `# spec: research-patch §5`).
- **`Prior-art:` trailer** citing the 2026-05-17 patch + SSOT #48 (per patch §6 line 206; `<50 LOC` under `.claude/` → likely not a capability-commit by thresholds, but trailer anyway).

## Files
- NEW `scripts/link-coordination.sh` (or `.claude/hooks/`) — the §5 helper, adapted per the two decisions above + the chosen done.md-safe granularity.
- EDIT `.claude/hooks/worktree-setup.sh` — **replace** the rsync block (122-126) with a call to the helper; keep `node_modules` symlinks untouched.
- EDIT `scripts/create-worktree.sh` — same wiring (it's the portable sibling; both must call the helper for parity, `dual-implementation`).
- NEW test (bash/paired-negative per repo convention) — asserts: (a) symlink created + points at `$CANON`; (b) `git status` clean for tracked `README.md` + `*/done.md` (no phantom deletes); (c) conflict path exits 1, never clobbers; (d) a file created in worktree's linked dir is visible in `$CANON` (live write-back proof).
- One-time migration: `cp -R` primary checkout's 123 umbrellas → `$CANON`, then run helper in each live worktree (patch §193).

## Process
- **Phase -1 cold-review MANDATORY** (worktree-infra change, blast radius). Reviewer MUST verify: the J5-rsync reconciliation is actually done (not both running), the done.md-granularity decision keeps `git status` clean, and the seed source is confirmed at 123.
- Mode A (inline Agent, `isolation: "worktree"`), TDD: write the git-status-clean + write-back tests first.
- Phase 0: branch `feat/cross-worktree-symlink-coordination` from `origin/staging`.
- One umbrella, one PR → staging.

## VERIFY (worker attaches evidence)
1. `find <worktree>/.claude/orchestrator-prompts -type l` shows the new symlink(s) → `$CANON`.
2. `git status` clean: no tracked `README.md`/`*/done.md` shown deleted.
3. Write-back proof: `touch $CANON/_probe/kickoff.md`-style → visible in another worktree (or vice-versa).
4. J5 rsync block removed from `worktree-setup.sh`; `node_modules` symlinks intact.
5. Helper conflict path exits 1 on a pre-existing real dir (never clobbers).
6. Capability commit (if any) carries `Prior-art:` trailer.
```
```

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
