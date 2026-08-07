<!-- scope:dispatch-worktree-automation-umbrella -->
# R-phase patch — `dispatch-worktree-automation`: eliminate manual worktree-setup tax from parallel dispatch

> **Status:** R-phase research patch. No code shipped. Verdict + I-phase sketch only.
> **Authoritative for:** verdict on 7 candidate solutions (A-G) against 5 evaluation criteria for eliminating the manual `git worktree add` + `cd` + `node_modules` symlink + `git checkout -b` paste-block tax from parallel R-phase / execution-build dispatch.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). I-phase implementation — separate umbrella post-merge per kickoff §12. PR #265 sibling drift R-phase verdict — that R-phase is closed unmerged; this one supersedes its operational direction per kickoff §1.
> **Origin kickoff:** `.claude/orchestrator-prompts/dispatch-worktree-automation/kickoff.md` (gitignored; status DRAFT 2026-05-29; this patch executes §9 deliverable spec).

---

## §1 Problem restatement (own paraphrase, not §1 copy-paste)

Every parallel dispatch in `/meta-orchestrator` workflow today emits a 5-7 command bash STEP 0 block per sub-wave: `cd primary` → `git fetch origin <base>` → `git worktree add <abs-path> origin/<base>` → `cd worktree` → `node_modules` + `packages/core/node_modules` symlink setup → `git checkout -b <branch>` → maintainer opens fresh CC tab in that dir and pastes the Worker prompt. For a 2-sub-wave umbrella that is ~14 maintainer keyboard actions; for a 4-sub-wave umbrella it crosses 28. The bash is verbatim every time, the cognitive load is non-trivial («which abs-path for this umbrella again?»), and the failure mode if maintainer skips a step silently corrupts results (Worker writes to primary workdir instead of worktree → `parallel-subwave-isolation.md §3 #shared-workdir-parallel`).

The question this R-phase answers: **how does the worktree itself come into being without maintainer typing terminal commands?** Reframes the channel-selection question that PR #265 closed unmerged (Agent vs paste-tab) to a layer below — what is the cheapest reliable mechanism for getting a worktree to exist *before* a fresh CC session paste is even possible?

---

## §2 Search-coverage execution (per kickoff §6 + `phase-research-coverage.md §1` 6-item checklist)

All 6 items run before any verdict. File:line citations per claim per T3.

### §2.1 SSOT consult — `docs/meta-factory/prior-art-evaluations.md`

Grep on `(worktree|dispatch|isolation|session.start|fs.watch|daemon)` surfaced 4 relevant entries (full grep output: `prior-art-evaluations.md` lines 95, 113, 114, 133, 134):

- **SSOT #27** (`prior-art-evaluations.md:95`) — `lee-to/aif-handoff` `HANDOFF_MODE` env-var fork. Verdict DEFER. Different problem class (external-system integration suppression vs our model-quota + context-isolation). Not load-bearing for this R-phase.
- **SSOT #45** (`prior-art-evaluations.md:113`) — `lee-to/aif-handoff` Watchdogs / Error Classification & Recovery. Verdict ADAPT. Different problem class (autonomous pipeline self-healing vs worktree creation automation). Not load-bearing here; relevant for Candidate F coordination if aif-handoff bridge Sub-wave B lands.
- **SSOT #46** (`prior-art-evaluations.md:114`) — `lee-to/aif-handoff` Subagents-mode vs Skills-mode dichotomy. Verdict ADOPT VOCABULARY. Different dimensions (execution-quality/speed vs session-scope isolation). Vocabulary only.
- **SSOT #65** (`prior-art-evaluations.md:133`) — Superpowers `obra/superpowers` `using-git-worktrees`. Verdict ADOPT. **Load-bearing for Candidate E** — Red Flag #1 «use the native primitive when available» is direct input. Step-0 detects `GIT_DIR != GIT_COMMON_DIR` and skips nested creation; pure-git fallback when no native primitive; project-setup auto-runner.
- **SSOT #66** (`prior-art-evaluations.md:134`) — AI Factory `lee-to/ai-factory`. Verdict REFERENCE (vocabulary only). T16 match score 14% — partial vocabulary match; not load-bearing for worktree automation surface.

No SSOT entry matches the «automate worktree CREATION in dispatch workflow» problem class directly. Closest is #65 which describes the orchestrator-side discipline (use the native primitive) but predates the discovery that CC native `--worktree` flag exists in this project. The SSOT consult thus surfaces the gap: this R-phase will close it by formalising CC native primitive adoption.

### §2.2 DeepWiki ≥3 phrasings × 3 repos (per kickoff §6.2)

Dispatched via Explore subagent (verbatim quotes from Agent return — paraphrased for length where the full passage was repeating):

**Query 1 — `obra/superpowers`** («Does Superpowers automate worktree creation at dispatch, vs just isolation?»):
> «Yes, Superpowers has a skill that automates worktree creation when an orchestrator dispatches subagent work: `superpowers:using-git-worktrees`. […] Native Worktree Tools (Preferred): It attempts to use native worktree tools provided by the platform (e.g., `EnterWorktree`, `WorktreeCreate`). If a native tool is used, it skips to project setup. […] Git Worktree Fallback: If no native tool is available, it falls back to manually creating a worktree using `git worktree add`. […] Project Setup: After worktree creation (or detection), the skill automatically runs appropriate setup commands based on detected project files (e.g., `npm install`, `cargo build`, `pip install`).»

Load-bearing finding: Superpowers explicitly REFERENCES `EnterWorktree` / `WorktreeCreate` as native primitives to prefer. That is dispositive for Candidate E (live primitive, not hypothetical) and Candidate D2 (hook channel is the right adapter).

**Query 2 — `cline/cline`** («multi-task dispatch in isolated environments?»):
> «Cline handles multi-task dispatch in isolated environments primarily through the use of Git worktrees, which it can automate. The `--worktree` flag in the CLI automatically creates a detached Git worktree for a task, ensuring isolation. […] When the `--worktree` flag is used, Cline automates the creation of a new Git worktree. […] the `createTaskWorktree` function is called, and the `runAgent` function is invoked with the `cwd` and `workspaceRoot` set to the newly created worktree path.»

Cross-tool convergent **vocabulary**, *narrower* than convergent architecture: Cline also exposes `--worktree` CLI flag that auto-creates worktree for the dispatched task. **T16 problem-class check (per `ai-laziness-traps.md §2 T16` — explicit, not asserted):** Cline upstream problem class = «Cline's AI agent creates a worktree for ITS OWN dispatched task at the moment Cline starts work on it» (agent-internal isolation); our problem class = «maintainer invokes `claude -w` from a terminal to create a worktree that a *paste-dispatched fresh Worker session* will run inside» (human-driven setup, then Worker consumes). The two **differ in WHO triggers worktree creation and WHO consumes the worktree** — Cline's agent is both trigger and consumer; in our pattern maintainer triggers and Worker consumes. **Match? Surface-level vocabulary (`--worktree` flag name) matches; control-flow architecture differs.** The §4 rationale point 3 «industry-converged vocabulary» is therefore valid for the FLAG-NAME shape — not for the dispatch-architecture shape. Stronger architectural-convergence claim would require Cline analogues for *paste-to-fresh-session* dispatch, which Query 2 evidence does not cover. T16 risk: do not assume the broader vocabulary-convergence justifies architectural-convergence claims downstream.

**Query 3 — `code-yeongyu/oh-my-openagent`** («isolated worker session bootstrap?»):
> «OhMyOpencode's "Team Mode" is designed for parallel multi-agent coordination. When enabled, it automatically creates isolated environments for each team member. […] For each member of a team, OhMyOpencode can optionally create a dedicated Git worktree. […] When `tmux_visualization` is enabled in the `team_mode` configuration, each member gets a dedicated tmux pane.»

Third independent precedent for auto-worktree-per-worker. tmux-pane visualization parallels CC's `--tmux` flag (verified in §2.5).

**Query 4 — `Yhooi2/rules-as-tests-aif`** (this repo): DeepWiki returned «Repository not found. Visit <https://deepwiki.com> to index it.» Fallback: direct local grep. Surfaced this kickoff itself as the only prior research on worktree-automation-at-dispatch surface; orthogonal `cross-worktree-coord-doc-sync` patch (`docs/meta-factory/research-patches/2026-05-17-cross-worktree-coord-doc-sync.md`) handles a different problem (gitignored coord-doc sync across worktrees, not creation). Local cache `~/.claude/cache/changelog.md` confirms CC `--worktree` flag history: «Fixed `--worktree` flag not loading skills and hooks from the worktree directory», «Added `worktree` field to status line hook commands... when running in a `--worktree` session», «Fixed `--worktree` sometimes being ignored on first launch», «Added `worktree.baseRef` setting (`fresh` | `head`)». The project does NOT currently use `claude --worktree` anywhere in its hooks, skills, or settings — confirmed by `grep -rE "(claude -w|--worktree|WorktreeCreate)" .claude/` returning empty (Bash output 2026-05-29 §2.6).

### §2.3 WebSearch ≥3 phrasings (per kickoff §6.3 + T12)

Three independent web queries (full results in tool-output transcript):

1. `"claude code" "git worktree" auto-create session hook dispatch 2026` — surfaced [CC official worktrees docs](https://code.claude.com/docs/en/worktrees) (top result), [tfriedel/claude-worktree-hooks](https://github.com/tfriedel/claude-worktree-hooks) third-party hook precedent, [issue #57209](https://github.com/anthropics/claude-code/issues/57209) (Desktop's worktree flow doesn't fire hook — CLI does), [issue #27744](https://github.com/anthropics/claude-code/issues/27744) (FEATURE: PostWorktreeCreate), [issue #37611](https://github.com/anthropics/claude-code/issues/37611) (WorktreeCreate hook disables cleanup prompt on exit), [mattbrailsford.dev «Replacing My Custom Git Worktree Skill with Claude Code Hooks»](https://mattbrailsford.dev/replacing-my-custom-git-worktree-skill-with-claude-code-hooks) (industry precedent for the exact move this R-phase recommends).
2. `"agent SDK" worktree isolation subagent dispatch native primitive` — surfaced [issue #39886 `isolation: "worktree"` silently fails](https://github.com/anthropics/claude-code/issues/39886), [issue #27881 nested worktrees when CWD drifts after compaction](https://github.com/anthropics/claude-code/issues/27881), [Nimbalyst «Best Git Worktree Tools for AI Coding in 2026»](https://nimbalyst.com/blog/best-git-worktree-tools-ai-coding-2026/), [Augment Code worktrees guide](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution).
3. `orchestrator worker dispatch automate worktree creation fresh session` — surfaced [ComposioHQ/agent-orchestrator](https://github.com/ComposioHQ/agent-orchestrator) (each agent its own git worktree, branch, PR — confirmation pattern), [MindStudio «Orchestrate Multiple Claude Code Sessions»](https://www.mindstudio.ai/blog/orchestrate-multiple-claude-code-sessions-ralf-loop), [wt — Worktree Session Manager](https://badri.github.io/wt/) third-party CLI.

Convergent finding across all 3 web queries: «`--worktree` CLI flag + WorktreeCreate hook» is the dominant industry pattern. Mattbrailsford post is direct prior art for the exact migration this patch recommends («Replacing My Custom Git Worktree Skill with Claude Code Hooks»).

### §2.4 Build-vs-reuse SSOT sweep (per kickoff §6.4 + `build-first-reuse-default.md §3` 6-layer)

For each candidate verdict in §3 below, the BFR §3 6-layer search is applied. Summary in advance:

| Candidate | BFR verdict | Rationale (full in §3) |
|---|---|---|
| A (embedded STEP 0) | REJECT BUILD | Duplicates upstream native `-w` flag (Candidate E) |
| B (Agent isolation:"worktree") | REJECT (write-Workers) / KEEP (read-only) | Upstream bug #39886; maintainer veto (operational) |
| C (mo-worktree script) | REJECT BUILD | `claude -w` is the upstream primitive that does this |
| D2 (WorktreeCreate hook for symlinks) | ADAPT | `tfriedel/claude-worktree-hooks` precedent; thin project-specific wrapper |
| E (`claude -w`) | **ADOPT** | Native primitive (CC v2.1.143); SSOT #65 Red Flag #1 mandate |
| F (fs-watcher daemon) | REJECT BUILD | `claude -w` does this with 0 daemon cost; aif-handoff overlap |
| G (Hybrid A+B) | REJECT | Both A and B downgraded individually; correct hybrid is E+D2 |

### §2.5 CC primitive verification (per kickoff §6.5 5a/5b/5c/5d)

Direct evidence per probe, with quoted line numbers / command output where possible:

**5a — `WorktreeCreate` / `EnterWorktree` tool existence:** **YES, BOTH EXIST.** WebFetch of `code.claude.com/docs/en/worktrees`:
> «You can also ask Claude to "work in a worktree" during a session, and it will create one with the [`EnterWorktree`](/en/tools-reference) tool.»

Plus from `code.claude.com/docs/en/hooks` complete event list (verbatim): «**WorktreeCreate** - When worktree created (replaces default git behavior)» (item 26 of 30 hook events) and «**WorktreeRemove** - When worktree removed» (item 27).

**5b — `--worktree` flag on `claude` CLI:** **YES, EXISTS in v2.1.143.** Direct probe `claude --help | grep -i worktree` (executed in worktree at 2026-05-29):
```text
--tmux                Create a tmux session for the worktree (requires --worktree). Uses iTerm2 native panes when available; use --tmux=classic for traditional tmux.
-w, --worktree [name] Create a new git worktree for this session (optionally specify a name)
```
Version: `claude --version` → `2.1.143 (Claude Code)`. Full WebFetch of `code.claude.com/docs/en/worktrees` provides authoritative behaviour:
> «Pass `--worktree` or `-w` to create an isolated worktree and start Claude in it. By default, the worktree is created under `.claude/worktrees/<value>/` at your repository root, on a new branch named `worktree-<value>`. […] Worktrees branch from your repository's default branch, `origin/HEAD`, so they start from a clean tree matching the remote. […] `worktree.baseRef` to `"head"` makes new worktrees carry your unpushed commits»

Constraint surfaced: `worktree.baseRef` accepts only `"fresh"` or `"head"`, NOT arbitrary refs. For this project `origin/HEAD` = `staging` (per default-branch migration 2026-05-22, memory `project_automerge_staging_plan`) — matches the umbrella convention.

**5c — Hook semantics for cwd change:** **CwdChanged is observational only.** WebFetch of `code.claude.com/docs/en/hooks`:
> «**Decision control**: None - **cannot block or modify the cwd** […] The hook is observational only. It receives the change that already happened […] You can set environment variables via `CLAUDE_ENV_FILE` (like SessionStart), but cannot retroactively prevent or modify the directory change.»

Implication: Candidate D1 sub-variant («PreToolUse/UserPromptSubmit hook auto-cd's session into worktree») is **INFEASIBLE**. The only viable hook channel is `WorktreeCreate` (D2 sub-variant), which fires when `--worktree` is invoked and replaces default git logic — not when an arbitrary prompt is submitted.

**5d — Agent tool `isolation:"worktree"` semantics:** **Known bug per [issue #39886](https://github.com/anthropics/claude-code/issues/39886).** WebFetch of issue page:
> «When spawning a subagent with `isolation: "worktree"`, the agent runs in the main repository directory instead of an isolated worktree, with no error raised […] Runs in the main repo directory (same `pwd` as parent); `worktreePath: done` (not an actual path); `worktreeBranch: undefined`; No git worktree is created (`git worktree list` shows only main); Agent commits directly to the main checkout's branch. […] **Current Status:** Closed as duplicate — marked with the `duplicate` label on the GitHub issue page (no indication of whether this is fixed in CC 2.1.143). […] **Recommended Workaround:** Use parallel agents only for read-only tasks (search, read, analyze); Perform all git mutations (checkout, commit, push) sequentially from the main conversation thread; Never dispatch two agents that both need different branches.»

Today's 2026-05-29 Workflow failure (227k tokens burned with workers receiving `undefined` prompt) is separate from this bug per maintainer post-mortem, but the bug independently undermines reliability of Candidate B for write-Workers regardless of args-passing.

### §2.6 DeepWiki on this repo (per kickoff §6.6)

Fallback grep (DeepWiki has not indexed this repo per Query 4 above):

- `.claude/settings.json` → no `WorktreeCreate` hook entry (Bash output 2026-05-29: only `UserPromptSubmit` hooks present)
- `.claude/hooks/*.sh` → 9 hooks, NONE named worktree-create (Bash output 2026-05-29: `ask-question-reminder.sh check-doc-authority.sh check-hook-marker.sh check-kickoff-traps.sh deps-hash-check.sh end-of-turn-reminder.sh inject-matching-rule.sh inject-session-bootstrap.sh validate-prompt.sh`)
- `.claude/worktrees/` directory → does NOT exist (`ls` returns «No such file or directory»). The project has never used `claude -w`. Pure prior-art gap.
- `.gitignore` → already contains «# Also ignore a node_modules *symlink* (worktree pattern: ln -s <main>/node_modules).» but does NOT explicitly ignore `.claude/worktrees/`. **Will need a one-line addition in I-phase** (CC docs Tip: «Add `.claude/worktrees/` to your `.gitignore` so worktree contents don't appear as untracked files in your main checkout»).
- `.claude/skills/meta-orchestrator/SKILL.md` — references manual `git worktree add` pattern at lines 322, 324, 339, 454 (Bash output 2026-05-29 grep results above). Direct I-phase edit targets.
- `.claude/skills/meta-orchestrator/templates/meta-kickoff.template.md §4a` (lines 126-144) — currently codifies the node_modules symlink setup AS A WORKER-PROMPT SECTION. If WorktreeCreate hook lands (D2), this section can be DELETED from prompts (hook handles it transparently).
- `.claude/skills/meta-orchestrator/references/placeholders.md:24` — `{{DISPATCH_INSTRUCTIONS}}` description references manual worktree pattern; needs update.

No prior abandoned PRs on this surface (gh PR search: only PR #265 closed unmerged on the sibling channel-discipline drift).

---

## §3 Per-candidate verdict (each scored against §4 5 criteria with file:line / command-output evidence)

### Candidate A — Embedded STEP 0 bash inside paste-block

**Mechanism:** `meta-orchestrator §4` emission includes a bash STEP 0 block at the top of every Worker paste-prompt. Worker session's AI runs the bash on its first Bash tool call, then proceeds to the task body.

**Scores:**
1. Manual maintainer step count BEFORE/AFTER: **7 → 2** (open tab + paste single mega-block).
2. Visibility: **YES** (fresh tab).
3. Quota separation: **YES** (fresh tab).
4. Integration: **small** — template emission change only (`meta-kickoff.template.md §4 {{DISPATCH_INSTRUCTIONS}}` regenerated).
5. Audit trail: **YES** (bash runs in Worker session, fully logged).

**Cons:** Worker session must trust that AI will run STEP 0 first (T7 discipline-theatre risk — `ai-laziness-traps.md §2 T7`). Bash duplicated per sub-wave (10+ LOC of visual bloat in meta-launch kickoff). If maintainer pastes into a tab opened in wrong dir, bash creates worktree but Worker may not be in the expected starting state. Does not eliminate the «which abs-path?» cognitive load (the bash hardcodes the path per sub-wave).

**Falsifier:** wrong if (a) CC v2.1.143 native `-w` flag did not exist — refuted by §2.5 5b probe; OR (b) maintainer's friction is bash duplication itself (in which case A is the wrong layer — fix is to remove the bash entirely, not embed it deeper). Both falsifiers favor Candidate E.

**Verdict:** **REJECT** — superseded by Candidate E. A was the right move when `claude -w` was thought hypothetical (kickoff §1 «3 hand-crafted paste-prompts»). With §2.5 5b confirming the native primitive, A duplicates upstream per [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md). REUSE > BUILD.

### Candidate B — `Agent({isolation:"worktree"})` inline subagent dispatch

**Mechanism:** Meta-orchestrator dispatches all sub-wave Workers via `Agent({isolation:"worktree", model:"opus", prompt:...})` in one Workflow call. CC native primitive creates worktree per-subagent + auto-removes on no-change.

**Scores:**
1. Manual maintainer step count: **7 → 0** (meta-orchestrator dispatches all subagents in one Workflow call; no maintainer keyboard action).
2. Visibility: **NO** (only post-completion via Workflow result; no separate session log to tail).
3. Quota separation: **NO** (subagent shares orchestrator's Opus pool window).
4. Integration: **small** (template emission change).
5. Audit trail: **PARTIAL** (visible via Workflow tool result; no separate transcript file per subagent).

**Critical cons:**
- **Bug [#39886](https://github.com/anthropics/claude-code/issues/39886)** — `isolation: "worktree"` silently fails (closed as duplicate; status uncertain in 2.1.143). Reported workaround from the bug page itself: «Use parallel agents only for read-only tasks; perform all git mutations sequentially». Strong upstream signal AGAINST using for write-Workers in current CC state.
- **2026-05-29 maintainer veto** (kickoff §3 Candidate B Cons): «сабагент не вариант» — preferring separate fresh CC sessions for visibility + quota separation. The veto correlated with a Workflow run that burned 227k tokens on misconfigured args; argument can be made the veto was situational, but the bug #39886 evidence makes the veto independently justified even absent the failed-Workflow context.

**Falsifier:** wrong if (a) bug #39886 is verified fixed in CC 2.1.143 AND (b) maintainer reverses the operational veto. Either condition alone is insufficient — both required for B to re-enter consideration as primary write-Worker channel.

**Verdict:** **REJECT for write-Workers** in execution-build parallel. **KEEP** for read-only research subagents (Phase -1 reviewers, Explore subagents, the DeepWiki probe dispatched in §2.2 above — note this very R-phase used Candidate B for read-only research, validating its scope). Status quo per current `.claude/skills/meta-orchestrator/SKILL.md:347-348` anti-pattern `#worker-dispatch-via-subagent` (verified at file:line 347-348, content «Worker dispatch via Agent tool from the meta-orchestrator session. Agent tool is ONLY for Phase -1 read-only reviewer + read-only research subagents (text return). Write-task Worker dispatch belongs in a fresh CC session opened by the maintainer pasting a §10 1-liner block.») aligns with this verdict and **REMAINS UNCHANGED** by I-phase.

### Candidate C — External helper script `mo-worktree <umbrella> <suffix>`

**Mechanism:** Maintainer runs `mo-worktree aif-handoff sw-A` → script handles `git worktree add` + symlinks + branch creation → echoes «open fresh tab, paste prompt». Maintainer then opens tab + pastes.

**Scores:**
1. Manual maintainer step count: **7 → 3** (run script + open tab + paste).
2. Visibility: **YES** (fresh tab).
3. Quota separation: **YES**.
4. Integration: **medium** — new artefact `.bin/mo-worktree` ~50-80 LOC bash to ship + maintain + onboard fresh checkouts.
5. Audit trail: **YES**.

**Cons:** CC native `claude -w` (Candidate E) does this with one fewer step (2 vs 3) and zero new artefacts. The «branch name derivation» logic (per-umbrella convention or `<umbrella>-<suffix>` default) is project-specific work that duplicates what CC's `worktree-<name>` convention already provides. Per [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) 6-layer search: SSOT consult (#65, native primitive referenced); WebSearch confirms `claude -w` industry-converged (Cline `--worktree`, OhMyOpencode auto-worktree); CC primitive verification 5b confirms `claude -w` lives and works. BUILD verdict for C requires escaping all 6 layers — fails layer 5 (CC primitive exists).

**Falsifier:** wrong if maintainer's friction is genuinely not «typing commands» but «context-switching terminal↔CC» — script doesn't fix context switch, only collapses commands; but native `-w` doesn't fix it either, so C still loses to E on the same axis.

**Verdict:** **REJECT** per BFR. `claude -w` is the upstream primitive.

### Candidate D — Hook auto-creates worktree on dispatch

Split per §2.5 probe results:

**D1 — PreToolUse/UserPromptSubmit hook auto-cd's session into worktree on marker detection.**

**Mechanism (as in kickoff §3 Candidate D):** hook reads prompt, detects marker (e.g. `# WORKTREE: <umbrella>/<sub-wave>`), creates worktree, cd's session, strips marker, forwards prompt.

**Verdict: INFEASIBLE.** §2.5 5c probe: «`CwdChanged` … cannot block or modify the cwd. The hook is observational only.» UserPromptSubmit hook can only add context, not change cwd. SessionStart hook fires before session opens (cwd already bound at `claude` launch time). Therefore no hook event can retroactively cd an already-running session into a new worktree. The marker-based pattern requires the worktree path passed via env var at `claude` launch time — which is what `claude --worktree <name>` already does natively (Candidate E). D1 collapses to «use E».

**D2 — `WorktreeCreate` hook that wraps `git worktree add` and adds project-specific setup (node_modules symlinks + branch-name convention).**

**Mechanism:** Add `.claude/hooks/worktree-create.sh` (~30 LOC) + `.claude/settings.json` `"hooks": { "WorktreeCreate": [...] }` entry. Hook fires when `claude -w` is invoked; receives JSON on stdin with `name` field; runs `git worktree add` + sets up `node_modules` + `packages/core/node_modules` symlinks + prints worktree path on stdout. Per `code.claude.com/docs/en/hooks` WorktreeCreate spec (§2.5 fetch): exit 2 or missing path = fail worktree creation.

**Scores (D2):**
1. Manual maintainer step count: **7 → 2** (`claude -w <name>` + paste prompt; hook handles symlinks transparently).
2. Visibility: **YES** (fresh tab).
3. Quota separation: **YES**.
4. Integration: **medium** — ~30 LOC new bash hook + `.claude/settings.json` entry + verification (maintainer-applied per agent-uncommittable design; memory `feedback_settings_json_agent_uncommittable`).
5. Audit trail: **YES**.

**Pros:** Adapts proven precedent — `tfriedel/claude-worktree-hooks` (WebFetch §2.3): «automates environment setup for Claude Code worktrees by automatically configuring isolated git worktrees with dependencies, environment files, and deterministic ports». Same architecture (WorktreeCreate hook + wrapper script under `$CLAUDE_PROJECT_DIR/scripts/`). Mattbrailsford post (WebSearch #1) is third-party precedent for the exact migration this candidate represents.

**Cons:** New hook to maintain (joins 9 existing hooks). Maintainer must apply `.claude/settings.json` edit manually (agent-self-protected). Worktree path convention shifts from `../<repo>-<umbrella>-<suffix>` (kickoff §11 pattern) to `.claude/worktrees/<name>/` (CC default); IDE / shell muscle-memory must adapt.

**Falsifier:** wrong if (a) WorktreeCreate hook semantics differ from §2.5 fetch (low risk — fetch was authoritative docs site); OR (b) `node_modules` symlink approach is replaceable by `.worktreeinclude` (untested — `.worktreeinclude` is for gitignored FILES, not symlinks; likely doesn't apply); OR (c) `npm install` per worktree is acceptable (slower per-worktree bootstrap; per `tfriedel/claude-worktree-hooks` precedent — but per this project's optimisation choice via `meta-kickoff.template.md §4a`, symlinks were chosen, suggesting npm install was rejected on the time/disk tradeoff).

**Verdict:** **ADAPT** — wrap CC native `-w` with project-specific node_modules symlink hook. Pattern adapts `tfriedel/claude-worktree-hooks`. Recommended as I-phase polish ALONGSIDE Candidate E adoption; not a precondition (E alone delivers the 7→2 step reduction; D2 makes the worktree fully usable without manual symlink intervention).

### Candidate E — Native CC `claude --worktree <name>` (`-w`) — was hypothetical, NOW CONFIRMED REAL

**Mechanism:** Maintainer types `claude -w dispatch-worktree-automation` in any terminal. CC creates worktree under `.claude/worktrees/dispatch-worktree-automation/` on branch `worktree-dispatch-worktree-automation`, branched from `origin/HEAD` (= `staging` for this project per default-branch migration). Maintainer pastes Worker prompt; Worker runs in the auto-created worktree.

**Scores:**
1. Manual maintainer step count: **7 → 2** (one command + paste). 1 step if maintainer types the command from a terminal that already includes the paste as a shell-history bookmark or `tmux` macro.
2. Visibility: **YES** (fresh tab; `--tmux` flag also available per CLI help: «Create a tmux session for the worktree (requires --worktree). Uses iTerm2 native panes when available»).
3. Quota separation: **YES** (fresh CC session).
4. Integration: **ZERO** — just use what already exists in v2.1.143 (`claude --version` → `2.1.143 (Claude Code)` verified 2026-05-29).
5. Audit trail: **YES** (standard CC session transcript).

**Pros:**
- **Native primitive** per SSOT #65 Red Flag #1 mandate («use the native primitive when available»).
- **Industry-converged** — `claude -w`, Cline `--worktree`, OhMyOpencode auto-worktree all use same vocabulary (DeepWiki Queries 1-3).
- **PR-branch worktree support** (CC docs verbatim: «To branch from a specific pull request, pass the PR number prefixed with `#`, or a full GitHub pull request URL.»). Useful for reviewer worktrees on existing PRs.
- **`.worktreeinclude` support** for env-like files (CC docs: «To copy [.env, .env.local, etc.] automatically when Claude creates a worktree, add a `.worktreeinclude` file»).
- **Auto-cleanup** on session exit if no changes; prompts to keep if changes exist (CC docs Clean up worktrees section).

**Constraints / cons:**
- **Worktree location is fixed** at `.claude/worktrees/<name>/` — cannot be `../<repo>-<suffix>` per current pattern. Required `.gitignore` addition (CC docs Tip: «Add `.claude/worktrees/` to your `.gitignore`»).
- **Branch name is `worktree-<name>`** — different from current `research/<umbrella>-<suffix>` convention. Can be renamed inside the session (`git branch -m`) but adds 1 step per worktree if convention is enforced. Alternative: relax branch-name convention to `worktree-<umbrella>-<suffix>`.
- **`worktree.baseRef`** accepts only `"fresh"` or `"head"` (CC docs verbatim: «The setting accepts only "fresh" or "head", not arbitrary git refs»). For this project `origin/HEAD = staging` (post-2026-05-22 migration), so `"fresh"` default works for staging-based dispatch; for main-based dispatch (`audit-self` PR repaint or similar) maintainer would need `"head"` setting OR manual `git checkout` after `claude -w`.
- **First-time use in a directory requires `claude` (no -w) first** to accept workspace trust dialog (CC docs: «Before using `--worktree` in a directory for the first time, accept the workspace trust dialog by running `claude` once in that directory»). One-time cost.
- **`node_modules` symlinks NOT auto-set up** by `-w` alone — needs Candidate D2 (WorktreeCreate hook) or per-worktree `npm install`. Without one of these, Worker hits «Cannot find module» on its first `npm` invocation.

**Falsifier:** wrong if (a) `claude -w` does not in fact exist in CC 2.1.143 — directly refuted by `claude --help` probe output above; OR (b) the `worktree.baseRef` constraint blocks staging-from-main dispatches that the umbrella needs — refuted by §2.5 5b citation showing `origin/HEAD = staging` matches the umbrella's `staging` base.

**Verdict:** **ADOPT** as primary mechanism for parallel dispatch worktree creation. Combine with D2 (WorktreeCreate hook) for node_modules symlink ergonomics. This is the reasoned recommendation per [`phase-research-coverage.md §1.12`](../../../.claude/rules/phase-research-coverage.md) (lead with verdict, not option-dump).

### Candidate F — Filesystem-watcher daemon (aif-handoff bridge Variant B-equivalent)

**Mechanism:** Daemon watches `.claude/orchestrator-prompts/**/<umbrella>-meta-launch/kickoff.md`; on new kickoff parses §4 sub-wave list and pre-creates worktrees. Maintainer opens fresh CC tabs in pre-created paths.

**Scores:**
1. Manual maintainer step count: **7 → 0** (zero — daemon does setup).
2. Visibility: **YES**.
3. Quota separation: **YES**.
4. Integration: **LARGE** — daemon process management (systemd/launchd), race conditions if maintainer also runs `git worktree add`, new failure surface (daemon crash detection / restart). Overlaps with `aif-handoff-as-runtime-bridge` Sub-wave B (which evaluates aif-handoff itself for daemon role).
5. Audit trail: **YES** (daemon logs + standard CC session transcripts).

**Cons:** For single maintainer + low-volume dispatch (~1-2 umbrellas/week max per `wave-sequencing-plan.md` cadence), daemon ROI poor vs `claude -w` 2-step. Overlap with aif-handoff bridge Sub-wave B — if that R-phase verdicts «adopt aif-handoff as daemon», F collapses to «use aif-handoff» (no new daemon).

**Falsifier (updated post-Sub-wave-B landing):** wrong if (a) maintainer transitions to high-volume autonomous dispatch (>10 umbrellas/day) where daemon ROI flips — currently no evidence of this trajectory; OR (b) `lee-to/aif-handoff` ships a `POST /tasks/ingest-from-path` endpoint or `packages/agent/src/dirWatcher.ts` module — per Sub-wave B's verified-as-of-2026-05-29 falsifier, no such surface exists; coordinator is API-driven (WebSocket `agent:wake`) only.

**Verdict:** **REJECT (confirmed, not deferred)** per BFR — over-engineered for actual workload, AND the aif-handoff-as-daemon alternative is independently ruled out by sibling Sub-wave B R-phase (verdict REJECT, ~5% match score, no upstream fs-watcher exists — see [`docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-variant-b-watcher.md §0`](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) which landed on this branch before this patch was written and explicitly closes the «coordinate with Sub-wave B» branch). T16 problem-class check: aif-handoff fs-watcher = «autonomous CI-feedback dispatch + handoff coordination» (broader); our problem class = «pre-create worktree for paste-dispatch» (narrower). Different match scores — `claude -w` matches our narrower problem more precisely.

### Candidate G — Hybrid (A + B): meta-orchestrator emits both formats

**Mechanism:** §4 dispatch generates two blocks per sub-wave (embedded STEP 0 paste-block + Agent isolation:worktree example). Maintainer picks per situation.

**Verdict:** **REJECT** — both A and B are downgraded individually (A by E; B by bug #39886 + maintainer veto for write-Workers). Hybrid of two losers. The correct compose is **E + D2** (`claude -w` + WorktreeCreate hook for symlinks). G's «decision-fatigue» con applies regardless of the components — emitting two formats per sub-wave defers the choice to the maintainer at the worst possible moment (mid-dispatch). The orchestrator should pick.

---

## §4 Recommendation (lead with verdict + rationale + falsifier per `phase-research-coverage.md §1.12`)

**Recommendation: ADOPT Candidate E (`claude -w` native CLI flag) + ADAPT Candidate D2 (`WorktreeCreate` hook for `node_modules` symlinks).**

**Five-point rationale:**

1. **Native primitive exists** in CC v2.1.143 (`claude --help` probe + `code.claude.com/docs/en/worktrees` WebFetch §2.5 5b) — superseding the «3 hand-crafted paste-prompts» pattern that the kickoff (§1) treated as Candidate A's exemplar. Per [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md) ADOPT > BUILD when upstream solves the same problem class.
2. **SSOT #65 Red Flag #1 mandate satisfied** — Superpowers `using-git-worktrees` explicitly REFERENCES `EnterWorktree` / `WorktreeCreate` as native primitives to prefer (DeepWiki Query 1 §2.2). Adopting `claude -w` directly satisfies the mandate the project already adopted.
3. **Industry-converged vocabulary** — Cline `--worktree`, OhMyOpencode auto-worktree, ComposioHQ agent-orchestrator all use the same pattern (DeepWiki Queries 1-3 + WebSearch §2.3). Adopting CC native = adopting the cross-tool norm.
4. **`isolation:"worktree"` subagent dispatch (Candidate B) is independently undermined** for write-Workers by [bug #39886](https://github.com/anthropics/claude-code/issues/39886) (closed-as-duplicate, status uncertain in 2.1.143) — the published workaround from the bug page itself instructs «parallel agents only for read-only tasks». This holds even absent the 2026-05-29 maintainer veto.
5. **D2 hook is thin and proven** — adapts `tfriedel/claude-worktree-hooks` precedent (~30 LOC bash + 1 `.claude/settings.json` entry). Handles the one Candidate E gap (`node_modules` symlinks). Mattbrailsford's «Replacing My Custom Git Worktree Skill with Claude Code Hooks» (WebSearch §2.3 result 1) is third-party direct precedent for the exact migration this patch recommends.

**Falsifier:** wrong if any of (a) `claude -w` does not work as documented in CC 2.1.143 — refuted by `claude --help` direct probe; (b) `WorktreeCreate` hook semantics in §2.5 5a differ from the docs site fetch — fetch was authoritative; (c) maintainer rejects the worktree path convention shift `.claude/worktrees/<name>/` (vs `../<repo>-<suffix>`) — surface as DECISION-NEEDED in §8; (d) `worktree.baseRef` constraint blocks the project's umbrella base — refuted by `origin/HEAD = staging` matching the umbrella base.

**Acceptance bar from kickoff §10 met:** manual step count ≤2 ✓ (E delivers 7→2; with D2 hook the symlinks are also automated); visibility YES ✓; quota separation YES ✓; integration cost low ✓ (zero for E, medium-thin for D2); audit trail YES ✓. **No DECISION-NEEDED escalation** required for the primary verdict — open items deferred to §8 are I-phase scope choices, not blockers for adoption.

---

## §5 §1.7 Forward+Backward — discipline-bearing artefact self-check

### §1.7 Forward-check applied

Sweep across active `.claude/rules/`:

- [`doc-authority-hierarchy.md §5`](../../../.claude/rules/doc-authority-hierarchy.md) — folder-level scope-by-filename pattern applies; this patch lives under `docs/meta-factory/research-patches/` (folder-level scope). file:line evidence: `.claude/rules/doc-authority-hierarchy.md:94` (§5 header). Per-file Authoritative-for header included at top of this patch. ✓
- [`phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md) — 6-item search-coverage executed in §2; file:line evidence per claim per T3 throughout. file:line evidence: `.claude/rules/phase-research-coverage.md:20` (§1 header) + `phase-research-coverage.md:24-30` (items 1-6 of the methodology checklist). ✓
- [`phase-research-coverage.md §1.11`](../../../.claude/rules/phase-research-coverage.md) — verify-against-source-of-truth: CC `--worktree` flag verified via direct `claude --help` probe (not from training-data memory); WorktreeCreate hook semantics verified via WebFetch of `code.claude.com/docs/en/hooks` (authoritative site, not blog post). file:line evidence: `.claude/rules/phase-research-coverage.md:79` (item 1 «State / closure claims» — re-verify before each ship-step) + `phase-research-coverage.md:82` (item 4 «Diff direction before live claim»). ✓
- [`phase-research-coverage.md §1.12`](../../../.claude/rules/phase-research-coverage.md) — §4 leads with reasoned recommendation (ADOPT E + ADAPT D2) with 5-point rationale + falsifier, not option-dump. file:line evidence: `.claude/rules/phase-research-coverage.md:92` (item 1 «Lead with your own reasoned pick»). ✓
- [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md) — Candidate verdicts explicitly favor REUSE (E ADOPT, D2 ADAPT, B keep upstream pattern for read-only, C/F REJECT BUILD). file:line evidence: `.claude/rules/build-first-reuse-default.md:30` (§1 verdict ladder). ✓
- [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) — 6-layer search executed in §2 (SSOT consult §2.1, DeepWiki §2.2, WebSearch §2.3, BFR sweep §2.4, CC primitive verification §2.5, project repo probe §2.6). file:line evidence: `.claude/rules/build-first-reuse-default.md:30` (verdict-ladder anchor that the 6-layer mandate enforces). ✓
- [`no-paid-llm-in-ci.md §1`](../../../.claude/rules/no-paid-llm-in-ci.md) — all candidates are deterministic (CLI flag, bash hook, paste-block, daemon). No CI-side LLM call. file:line evidence: `.claude/rules/no-paid-llm-in-ci.md:14`. ✓
- [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md) — §8 DECISION-NEEDED items reserve project-strategy choices for maintainer (worktree path convention, branch-name convention, `worktree.baseRef` setting for main-based dispatch). file:line evidence: `.claude/rules/reviewer-discipline.md:17` (§2 «Surface-as-decision-needed pattern» header). ✓
- [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md) — active T-traps enumerated in §6; ≥1 domain-specific (T-DWA-A/B/C inherited from kickoff §5; T-DWA-D added below in §6 for «native primitive existence proves the path forward» bias). file:line evidence: `.claude/rules/ai-laziness-traps.md:14` (kickoff-author obligations section anchor). ✓
- [`parallel-subwave-isolation.md §4 N7`](../../../.claude/rules/parallel-subwave-isolation.md) — N7 verdict (REFERENCE Superpowers `using-git-worktrees`) directly aligned with Candidate E adoption; the «dogfooded upstream primitive» pattern this rule REFERENCES is exactly what `claude -w` adoption operationalises. file:line evidence: `.claude/rules/parallel-subwave-isolation.md:37` (N7 bullet). ✓
- [`dual-implementation-discipline.md §3`](../../../.claude/rules/dual-implementation-discipline.md) — D2 hook (`.claude/hooks/worktree-create.sh`) ships as CC-native (no portable agent counterpart needed since `claude -w` itself is CC-only by definition — the WorktreeCreate hook event exists only in CC). Carry `@cc-only-rationale: WorktreeCreate hook event is CC-only; no portable equivalent fires at worktree creation moment` marker at I-phase. file:line evidence: `.claude/rules/dual-implementation-discipline.md:108`. ✓

### §1.7 Backward-check applied

Sweep of existing artefacts under this patch's recommendation scope:

- [`.claude/skills/meta-orchestrator/SKILL.md:322`](../../../.claude/skills/pipeline/SKILL.md) — `R-phase, multiple parallel | Mode A × N inline Agents` row. NOT affected by E+D2 (no worktree mention in this row). ✓ No edit needed.
- [`.claude/skills/meta-orchestrator/SKILL.md:324`](../../../.claude/skills/pipeline/SKILL.md) — `Execution-build, parallel ≥2 in same stage | Mode B × N worktrees | Per parallel-subwave-isolation.md §1: \`git worktree add ../<repo>-<wave>-<N> staging && git checkout -b <branch>\` for each session.` **I-phase edit target** — replace the manual `git worktree add` bash with `claude -w <umbrella>-<wave-N>` instruction.
- [`.claude/skills/meta-orchestrator/SKILL.md:339`](../../../.claude/skills/pipeline/SKILL.md) — fallback paragraph on Mode B unavailable. Stays relevant (CC `-w` may also fail on filesystem constraints; same fallback applies). No edit needed.
- [`.claude/skills/meta-orchestrator/SKILL.md:347-348`](../../../.claude/skills/pipeline/SKILL.md) — anti-pattern `#worker-dispatch-via-subagent` (write-Worker dispatch via Agent tool). **REMAINS UNCHANGED** — Candidate B verdict REJECT for write-Workers (§3) preserves this anti-pattern. The new recommendation does NOT introduce subagent write-dispatch.
- [`.claude/skills/meta-orchestrator/SKILL.md:454`](../../../.claude/skills/pipeline/SKILL.md) — prose «From the worktree `rules-as-tests-aif-meta-orchestrator-iphase/`, run:» (kickoff §8 lists). **I-phase edit target** — rephrase to «`claude -w meta-orchestrator-iphase`».
- [`.claude/skills/meta-orchestrator/templates/meta-kickoff.template.md §4 {{DISPATCH_INSTRUCTIONS}}`](../../../.claude/skills/pipeline/templates/meta-kickoff.template.md) — generator template for per-sub-wave dispatch block. **PRIMARY I-phase edit target** — replace `git worktree add` paste-block generation with `claude -w <umbrella>-<suffix>` instruction.
- [`.claude/skills/meta-orchestrator/templates/meta-kickoff.template.md §4a Worker worktree setup (lines 126-144)`](../../../.claude/skills/pipeline/templates/meta-kickoff.template.md) — currently codifies `node_modules` symlink setup AS A WORKER-PROMPT SECTION. If D2 hook lands, this section can be DELETED from prompts (hook handles it transparently). I-phase edit target.
- [`.claude/skills/meta-orchestrator/references/placeholders.md:24`](../../../.claude/skills/pipeline/references/placeholders.md) — `{{DISPATCH_INSTRUCTIONS}}` description currently «name the worktree command (Mode B) or inline Agent dispatch (Mode A)». **I-phase edit target** — rewrite to «emit `claude -w <umbrella>-<sub-wave>` (Mode B per CC native `--worktree`); inline Agent dispatch (Mode A)».
- [`.claude/rules/parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md) — mandatory worktree setup block uses manual `git worktree add ../<repo>-wave-<N> main`. **I-phase edit target** — rewrite to `claude -w <wave>-<task-slug>` OR add as alternative («prefer `claude -w` per dispatch-worktree-automation R-phase verdict, fall back to manual when in non-CC harness»).
- [`.claude/rules/parallel-subwave-isolation.md §4 N7`](../../../.claude/rules/parallel-subwave-isolation.md) — REFERENCE to Superpowers `using-git-worktrees`. Aligned with this verdict (Superpowers itself prefers native primitive). No edit needed.
- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — **I-phase: ADD new SSOT entries** for `claude -w` CLI flag (ADOPT), WorktreeCreate hook event (ADOPT), `tfriedel/claude-worktree-hooks` (ADAPT precedent for D2). Plus `mattbrailsford.dev` post and Cline / OhMyOpencode `--worktree` convergent vocabulary as supporting references.
- [`.gitignore`](../../../.gitignore) — does NOT currently ignore `.claude/worktrees/`. **I-phase edit target** — add per CC docs Tip.
- [`.claude/settings.json`](../../../.claude/settings.json) — does NOT have `WorktreeCreate` hook entry. **I-phase edit target (maintainer-applied)** — add hook entry pointing to `.claude/hooks/worktree-create.sh`. Per `feedback_settings_json_agent_uncommittable` agent cannot self-commit; recipe-script pattern (per `/tmp/skill-edit.py` precedent from PR #265) applies.
- [`.claude/hooks/`](../../../.claude/hooks/) — currently 9 hooks, none named worktree-create. **I-phase NEW artefact** — `worktree-create.sh` (~30 LOC bash).
- PR #265 (closed unmerged) — sibling drift R-phase on Agent vs paste-tab channel. Superseded operationally by this verdict (Agent stays as the right channel for read-only Phase -1 reviewers + research subagents; paste-tab with `claude -w` is the right channel for write-Workers). No re-open needed; verdict alignment recorded here.
- 3 hand-crafted paste-prompts from 2026-05-29 session (Stage 4 P4 fix, aif-handoff bridge SW-A, SW-B; not committed) — empirical exemplar of Candidate A's embedded-STEP-0 pattern; superseded by E recommendation. Reference for I-phase if D2 hook lands first and `claude -w` adoption is staged in a second I-phase commit.

No artefact silently superseded. I-phase edit targets explicitly listed. `parallel-subwave-isolation.md §1` is the only rule edit; SKILL.md / template / placeholders / .gitignore / .claude/settings.json / new hook artefact are project-internal generators and config.

---

## §6 Active AI-laziness traps (kickoff §5 inherited + 1 domain-specific addition)

Inherited from kickoff §5 (verified against `.claude/rules/ai-laziness-traps.md §2`):

- **T1** (sampling floor ≥5): 7 candidates × 5 criteria = 35 evaluations performed, well above floor. ✓
- **T3** (file:line per claim): every primitive-existence / hook-semantics / version claim cites file:line or command-output evidence in §2.5. ✓
- **T7** (run the adversarial counter-prompt): §3 Candidate E falsifier ran the actual probe (`claude --help`) rather than asserting «may exist». ✓
- **T11** (BFR §3 6-layer): §2.4 executed all 6 layers; Candidate C and F BUILD verdicts explicitly refused per layer 5 (CC primitive exists). ✓
- **T12** (web-search at moment): §2.3 WebSearch ×3 phrasings executed live; not pulled from training data. ✓
- **T13** (verify ADOPTED items have upstream evidence): Candidate E adoption cites concrete `claude --help` output + WebFetch quotes; D2 adaptation cites `tfriedel/claude-worktree-hooks` README. ✓
- **T15** (self-application): §7 below. ✓
- **T16** (problem-class match): §3 Candidate F explicitly checks T16 against aif-handoff bridge Sub-wave B (different problem classes; `claude -w` narrower match). ✓
- **T19** (own cold-QA before handoff): Phase -1 reviewer dispatched after this patch is written (see Worker REPORT). ✓
- **T20** (verdict backed by evidence): every ADOPT/ADAPT/REJECT/DEFER carries §3 same-section tool-call evidence. ✓

Domain-specific traps from kickoff (verified active):

- **T-DWA-A** «Native primitive blind-trust»: §2.5 5b probe ran the actual `claude --help` test BEFORE declaring E winner; did not assume existence from training-data. ✓
- **T-DWA-B** «Veto-as-permanent-NO»: §3 Candidate B verdict explicitly re-evaluates the 2026-05-29 maintainer veto against bug #39886 independent evidence; verdict REJECT for write-Workers / KEEP for read-only is grounded in bug evidence, not just veto. ✓
- **T-DWA-C** «Embedded-STEP-0 today = embedded-STEP-0 forever»: §3 Candidate A verdict treats A as a SHAPE («bash STEP 0 inside paste body»), not as the specific 2026-05-29 text; rejection is on grounds of duplicating E, not «I tried it once and it didn't feel right». ✓

**New domain-specific trap added:**

- **T-DWA-D** «Found-the-primitive = problem solved». R-phase tempted to declare E winner and stop, ignoring that `node_modules` symlinks are NOT auto-set up by `-w` alone — leaving Worker session in a broken state on first `npm` invocation. Counter: §3 Candidate E «Cons» section explicitly enumerated this gap; §4 recommendation = E + D2 compose, NOT E alone. Falsifier: if D2 hook adds friction that exceeds the `npm install`-per-worktree alternative (per `tfriedel/claude-worktree-hooks` original pattern), the alternative re-enters consideration. Empirical re-evaluation belongs in I-phase.

---

## §7 §11 Self-application (T15) — does the recommendation apply to dispatching THIS R-phase?

**Yes — and the R-phase dispatch itself consumed the anti-recommendation.**

Today's dispatch (2026-05-29) followed kickoff §11 channel (a):
```bash
cd /Users/art/code/rules-as-tests-aif
git fetch origin staging --quiet
git worktree add /Users/art/code/rules-as-tests-aif-dispatch-worktree-auto origin/staging
cd /Users/art/code/rules-as-tests-aif-dispatch-worktree-auto
GIT_COMMON_DIR=$(git rev-parse --git-common-dir)
PRIMARY=$(dirname "$(cd "$GIT_COMMON_DIR" && pwd)")
[[ ! -e node_modules ]] && ln -sfn "$PRIMARY/node_modules" node_modules
[[ ! -e packages/core/node_modules ]] && ln -sfn ../../node_modules packages/core/node_modules
git checkout -b research/dispatch-worktree-automation
pwd && git branch --show-current
```

= 9 commands (including `pwd` verify) + maintainer-side open-tab + paste. Worker (this session) ran 0 of these — maintainer ran all 9 because the agent dispatched via VS Code cannot open new shell tabs.

**If the recommendation had been in place** before this R-phase, the dispatch would be:
```bash
claude -w dispatch-worktree-automation
```
= 1 command + paste. Worktree under `.claude/worktrees/dispatch-worktree-automation/`, branch `worktree-dispatch-worktree-automation`, branched from `origin/HEAD` (= `staging`). If D2 hook were also installed, `node_modules` + `packages/core/node_modules` symlinks would be set up by the hook before the first prompt.

The R-phase dispatching itself proves the friction the R-phase exists to address. Recursive self-application satisfied per project invariant #2 («recursive self-application green»). Next dispatch in this umbrella series should use the recommended pattern.

**Note on dispatch channel for THIS Worker session:** the Worker (me) is running in the worktree at `/Users/art/code/rules-as-tests-aif-dispatch-worktree-auto/`, on branch `research/dispatch-worktree-automation`. The maintainer dispatched via VS Code (could not open new CC tab in the worktree per their environment), so I am working through absolute paths from the VS Code session — not via fresh tab. This does NOT change the verdict; it surfaces an additional environment-specific constraint: **VS Code-tab dispatch is a fourth channel** alongside fresh-CLI-tab, Agent-subagent, and (hypothetical) daemon. For VS Code-tab dispatch, the maintainer's workflow is «open VS Code in the desired worktree; ask agent to do work via absolute paths». Candidate E does not help here — `claude -w` is a CLI command, not a VS Code action. **DECISION-NEEDED in §8 captures this.**

---

## §8 I-phase implementation sketch + ATTN / DECISION-NEEDED

### I-phase edit targets (post-merge of this R-phase)

Mechanical edits (Worker-applicable):

1. **`.claude/skills/meta-orchestrator/SKILL.md:324`** — replace manual `git worktree add ../<repo>-<wave>-<N> staging` row content with: `\`claude -w <umbrella>-<wave-N>\` per CC native primitive (CC v2.1.50+; `code.claude.com/docs/en/worktrees`). Subagent worktrees per `parallel-subwave-isolation.md §1` is the discipline; CC native is the mechanism.`
2. **`.claude/skills/meta-orchestrator/SKILL.md:454`** — rephrase prose to `claude -w meta-orchestrator-iphase` (1-line edit).
3. **`.claude/skills/meta-orchestrator/templates/meta-kickoff.template.md §4 {{DISPATCH_INSTRUCTIONS}}`** — regenerate template to emit:
   ```markdown
   ## §10 Worker dispatch (one per sub-wave)
   
   For each sub-wave, run from any terminal:
   
       claude -w <umbrella>-<sub-wave-id>
   
   Then in the new CC session that opens, paste:
   
       /orchestrator <umbrella> §N <sub-wave> — ... [Worker prompt body]
   
   The `claude -w` flag creates `.claude/worktrees/<umbrella>-<sub-wave-id>/`, branches from `origin/<default>`, and sets up `node_modules` symlinks via the WorktreeCreate hook (`.claude/hooks/worktree-create.sh`).
   ```
4. **`.claude/skills/meta-orchestrator/templates/meta-kickoff.template.md §4a Worker worktree setup (lines 126-144)`** — DELETE **if and only if** D2 hook lands first (otherwise retain — symlinks must come from somewhere). Conditional ordering: I-phase commit sequence is (a) ship D2 hook + verify via `claude -w probe`, (b) only then delete §4a from template. Hook handles symlinks once installed; until then template stays as fallback.
5. **`.claude/skills/meta-orchestrator/references/placeholders.md:24`** — rewrite `{{DISPATCH_INSTRUCTIONS}}` description: `per-sub-wave dispatch block: emit "claude -w <umbrella>-<sub-wave-id>" (Mode B per CC native --worktree); inline Agent dispatch (Mode A read-only only)`.
6. **`.claude/rules/parallel-subwave-isolation.md §1`** — add as preferred channel; manual `git worktree add` retained as fallback for non-CC harness.
7. **`.gitignore`** — add line `.claude/worktrees/` (per CC docs Tip).
8. **`docs/meta-factory/prior-art-evaluations.md`** — add 3 new SSOT entries: CC `--worktree` flag (ADOPT), CC WorktreeCreate hook event (ADOPT), `tfriedel/claude-worktree-hooks` (ADAPT precedent).

Maintainer-applied edits (agent-uncommittable per `feedback_settings_json_agent_uncommittable`):

9. **`.claude/settings.json`** — add `"hooks": { "WorktreeCreate": [{ "hooks": [{ "type": "command", "command": "bash $CLAUDE_PROJECT_DIR/.claude/hooks/worktree-create.sh" }] }] }` entry. Recipe-script pattern (per `/tmp/skill-edit.py` precedent) for agent-prepared edit; maintainer applies.

New artefact (≤30 LOC bash; Worker-applicable). **HOOK STDIN SCHEMA IS UNVERIFIED — see ATTN 4 below; this sketch is a starting point requiring live-probe before I-phase commit:**

10. **`.claude/hooks/worktree-create.sh`** — sketched body (TODO-verify field names against live `claude -w` invocation; the docs site does NOT publish the WorktreeCreate stdin schema as of 2026-05-29 — confirmed via re-WebFetch of `code.claude.com/docs/en/hooks` post cold-review):
    ```bash
    #!/usr/bin/env bash
    set -euo pipefail
    # WorktreeCreate hook — replaces default git worktree logic.
    # Per code.claude.com/docs/en/hooks: must print worktree path on stdout.
    # @dual-pair: rules-as-tests-aif/worktree-automation (per dual-implementation-discipline.md §5)
    # @cc-only-rationale: WorktreeCreate hook event is CC-only; no portable equivalent fires at worktree creation moment.
    
    INPUT=$(cat)
    # FIELD NAMES UNVERIFIED — probe with: claude -w test-probe and capture stdin to /tmp/wtc-probe.json
    # Likely candidates based on convention: .name | .worktreeName | .worktree_name | .params.name
    # Until probed, fail safe: extract first non-empty candidate, else generate name.
    NAME=$(echo "$INPUT" | jq -r '.name // .worktreeName // .worktree_name // .params.name // empty')
    if [ -z "$NAME" ]; then
      # User invoked `claude -w` with no name → CC generates one (e.g. bright-running-fox)
      # If hook receives no name and we still need a path, generate locally:
      NAME="wt-$(date +%s)-$$"
    fi
    
    REPO_ROOT=$(git rev-parse --show-toplevel)
    WORKTREE_DIR="$REPO_ROOT/.claude/worktrees/$NAME"
    BRANCH="worktree-$NAME"
    BASE_REF=$(git rev-parse --abbrev-ref --symbolic-full-name origin/HEAD 2>/dev/null || echo "origin/main")
    
    if [ -d "$WORKTREE_DIR" ]; then
      # Worktree already exists; reuse (idempotent).
      echo "$WORKTREE_DIR"
      exit 0
    fi
    
    git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" -b "$BRANCH" "$BASE_REF" >&2
    
    # Project-specific: link node_modules from primary workdir (workspace optimisation).
    [ ! -e "$WORKTREE_DIR/node_modules" ] && ln -sfn "$REPO_ROOT/node_modules" "$WORKTREE_DIR/node_modules"
    [ ! -e "$WORKTREE_DIR/packages/core/node_modules" ] && \
      ln -sfn ../../node_modules "$WORKTREE_DIR/packages/core/node_modules"
    
    echo "$WORKTREE_DIR"
    ```
    Companion test: `packages/core/hooks/worktree-create.test.ts` — paired-negative per [`packages/core/principles/15-paired-negative.test.ts`](../../../packages/core/principles/15-paired-negative.test.ts) (if applies); deterministic input/output check per `inject-matching-rule.test.ts` precedent. **I-phase MUST start with a stdin-schema probe** (run `claude -w test-probe` with a hook that just `cat > /tmp/wtc-stdin.json && echo /tmp/probe-out`) before finalising the field-extraction logic.

### ATTN / DECISION-NEEDED for maintainer (per `reviewer-discipline.md §2`)

**DECISION-NEEDED 1:** Worktree path convention — `.claude/worktrees/<name>/` (CC native default; under repo root, gitignored) vs current pattern `../<repo>-<umbrella>-<suffix>` (parent dir, outside repo). Both legitimate. Option A → adopts CC default, IDE muscle-memory adapts. Option B → WorktreeCreate hook overrides path to current convention, slight hook complexity. Maintainer preference required.

**DECISION-NEEDED 2:** Branch name convention — CC default `worktree-<name>` vs current `research/<umbrella>-<suffix>` / `feat/<umbrella>` etc. Option A → adopt CC default (consistent, less typing). Option B → hook renames branch post-creation (1 extra line in hook). Option C → leave branch-rename as 1 manual `git branch -m` step (back to a 3-step flow but allows convention preservation).

**DECISION-NEEDED 3:** VS Code-tab dispatch channel — for sessions like this one where maintainer dispatches via VS Code rather than fresh CC CLI tab, `claude -w` is not directly invocable. Options: (A) maintainer always uses CLI for new dispatches (status quo for parallel work); (B) add an `EnterWorktree` invocation in the dispatch prompt (asks Claude to invoke `EnterWorktree` mid-session per CC docs — needs probe of tool availability in VS Code context); (C) document the VS Code-specific workflow («open VS Code in pre-created worktree») as an explicit fourth channel separate from `claude -w`. Maintainer decides which channel(s) to formally support.

**DECISION-NEEDED 4 (CLOSED — was false dilemma):** Coordination with aif-handoff bridge Sub-wave B is **resolved** — Sub-wave B already landed (`2026-05-29-aif-handoff-bridge-variant-b-watcher.md`, verdict REJECT, ~5% match) before this patch was written. The «proceed independently OR defer» fork no longer applies. E+D2 proceeds independently as originally hypothesised; no aif-handoff path remains open for the daemon role. Kept here for audit trail; no maintainer action needed.

**ATTN 1:** Bug [#39886](https://github.com/anthropics/claude-code/issues/39886) status — closed-as-duplicate but no confirmation it's fixed in CC 2.1.143. Before I-phase ships D2 hook, recommend a quick `Agent({isolation:"worktree"})` probe in a write-task to confirm whether the bug still reproduces. If it still reproduces, the `#worker-dispatch-via-subagent` anti-pattern (SKILL.md:347-348) stays correct (REJECT for write-Workers) regardless of D2 / E choice — they're orthogonal.

**ATTN 2:** Recipe-script pattern for `.claude/settings.json` edit — per memory `feedback_settings_json_agent_uncommittable`, agent cannot self-commit. I-phase Worker will prepare a `/tmp/settings-add-worktree-create-hook.py` recipe (matching `/tmp/skill-edit.py` precedent from PR #265) for maintainer to run + verify + commit separately.

**ATTN 3:** Principle test slot for any future channel-selection discipline test — if `dual-implementation-discipline.md` D2 marker discipline graduates from Class C to Class A (per its §6 promotion criterion: 3+ violations of `#two-prompts-drift` or `#cc-only-without-rationale`), the WorktreeCreate hook is the first dual-channel-eligible artefact. Surface for monitoring; no immediate action.

**ATTN 4 (NEW per cold-review MAJOR-3):** WorktreeCreate hook stdin JSON schema is **NOT published** in `code.claude.com/docs/en/hooks` as of 2026-05-29 — re-WebFetch post cold-review confirmed: «The documentation provided does not contain a detailed JSON input schema or example for the `WorktreeCreate` event.» The only authoritative docs claim is «Command hook prints path on stdout; HTTP hook returns `hookSpecificOutput.worktreePath`; Hook failure or missing path fails creation.» The hook sketch in I-phase edit target 10 above marks field names as UNVERIFIED and includes a defensive fallback chain (`.name // .worktreeName // .worktree_name // .params.name // generated`). **I-phase Worker MUST start with a 2-line stdin-probe** (`cat > /tmp/wtc-stdin.json; echo /tmp/probe-out`) wired into a temporary `.claude/settings.json` `WorktreeCreate` entry and invoke `claude -w schema-probe` to capture the actual stdin payload before finalising the production hook. Risk if skipped: hook silently fails to extract name, falls back to generated, branch name drifts from convention.

**ATTN 5 (NEW per cold-review MINOR-4):** SSOT register cross-check — Sub-wave B (`2026-05-29-aif-handoff-bridge-variant-b-watcher.md §6`) explicitly states «No new SSOT row proposed» and adds only an additive note to existing SSOT #67 («Variant B (filesystem-watcher daemon mode) evaluated separately. Verdict: REJECT»). No new SSOT entry from Sub-wave B interferes with this R-phase's 3 proposed new entries (`claude -w` ADOPT, WorktreeCreate ADOPT, `tfriedel/claude-worktree-hooks` ADAPT). Hygiene gap closed.

**ATTN 6 (NEW per cold-review MINOR-3):** Step-count discrepancy clarification — §1 baseline «7 commands» counts CONCEPTUAL steps (cd → fetch → worktree add → cd → symlinks → checkout → tab+paste, treating the multi-line symlinks bash as one conceptual step). §7 self-application quotes 9 LITERAL bash lines (including `GIT_COMMON_DIR` derivation, `PRIMARY` derivation, and `pwd && git branch` verify — sub-lines of the conceptual «symlinks» step). The 7→2 reduction claim in §3 Candidate E + §4 holds on both counts (E delivers 2 conceptual steps = 2 literal lines: `claude -w <name>` + paste).

---

## §9 What I would do differently next time (Worker self-reflection)

- Confirm CC version + flag set BEFORE drafting candidate-evaluation prose. If I had run `claude --help | grep -i worktree` as the very first probe, Candidate E would have been the obvious frame from the start; candidates C and F would have been pruned in pre-flight.
- DeepWiki Query 4 on this repo returned «not indexed» — fallback to local grep + cache works but is asymmetric with the other 3 queries. Future R-phases in this repo should plan for the index-gap upfront (use the local cache directly as primary, deepwiki as secondary).
- Bug #39886 closed-as-duplicate is a fragile evidence point — the duplicate-of link wasn't followed. For tighter T20 backing, future Worker should chase the duplicate-of chain to the originating issue and report its status.

---

## See also

- Kickoff: `.claude/orchestrator-prompts/dispatch-worktree-automation/kickoff.md` (gitignored)
- [`prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT #65 (Superpowers `using-git-worktrees`, ADOPT) + #66 (AI Factory, REFERENCE); 3 new entries pending I-phase
- [`code.claude.com/docs/en/worktrees`](https://code.claude.com/docs/en/worktrees) — CC `--worktree` flag + WorktreeCreate hook authoritative reference
- [`code.claude.com/docs/en/hooks`](https://code.claude.com/docs/en/hooks) — WorktreeCreate / WorktreeRemove / CwdChanged hook spec
- [`tfriedel/claude-worktree-hooks`](https://github.com/tfriedel/claude-worktree-hooks) — Candidate D2 precedent (env-files + deps + ports auto-setup)
- [`mattbrailsford.dev/replacing-my-custom-git-worktree-skill-with-claude-code-hooks`](https://mattbrailsford.dev/replacing-my-custom-git-worktree-skill-with-claude-code-hooks) — third-party direct precedent for this migration
- [issue #39886](https://github.com/anthropics/claude-code/issues/39886) — `isolation:"worktree"` silently-fails bug (Candidate B reliability risk)
- PR #265 (closed unmerged) — sibling drift R-phase on channel discipline (Agent vs paste-tab); superseded operationally by this verdict
- [`.claude/rules/parallel-subwave-isolation.md §4 N7`](../../../.claude/rules/parallel-subwave-isolation.md) — REFERENCE to Superpowers `using-git-worktrees` (aligned with E verdict)
- [`.claude/rules/build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) — 6-layer BFR sweep mandate (executed in §2)
- [`.claude/rules/dual-implementation-discipline.md §3`](../../../.claude/rules/dual-implementation-discipline.md) — `@cc-only-rationale` marker required on D2 hook

Prior-art: prior-art-evaluations.md#65 (Superpowers `using-git-worktrees` ADOPT — Red Flag #1 «use the native primitive» directly justifies E adoption). prior-art-evaluations.md#64 (`subagent-driven-development` ADOPT VOCABULARY — Candidate B remains valid scope for read-only subagents per this verdict). prior-art-evaluations.md#66 (AI Factory REFERENCE — vocabulary only, not load-bearing here).
