# Coordination adopt-on-write hook — umbrella kickoff

> **For:** `/pipeline coordination-adopt-hook` (run in a fresh session). Single I-phase stage + verify. One design fork (§6 DN-A).
> **Mode:** Mode A inline. Small surface: one hook script + settings.json wiring + one paired-negative test.
> **PR base:** `staging`. One stage, one PR (small); Phase -1 cold-review before push.
> **Commissioned:** maintainer, 2026-06-13 — make a lost work-product impossible by mechanism, not by the agent remembering. Direct response to the incident below.

## §0 The incident this closes (CONFIRMED, this session)

A new umbrella kickoff (`consumer-install-completeness/kickoff.md`) was authored as a **real file** inside a session worktree (`gracious-varahamihira-ba40fa`) under `.claude/orchestrator-prompts/`. The worktree was later deleted; the file — gitignored + sole copy — died with it. `/pipeline` could not find the umbrella. Recovery was manual (rewrite from context).

**Root cause is structural, not a one-off slip:**
- `.claude/orchestrator-prompts/*/*` is **gitignored** (`.gitignore:13`) → git never pins these files.
- The durable home is CANON (`~/.claude-coordination/rules-as-tests-aif/<umbrella>/`); worktrees get symlinks. The **adopt-then-link** logic that moves a real local file into CANON + symlinks it back already exists: [`scripts/link-coordination.sh:97-142`](../../../scripts/link-coordination.sh).
- But it runs only at **session/worktree boundaries** — `SessionStart` (`.claude/settings.json:176`) and `WorktreeCreate` (`.claude/hooks/worktree-setup.sh:123`) — plus explicit calls. **None of these fire when a file is born mid-session:** such a file is not adopted until the *next* session start, by which point the worktree may already be deleted. `link-coordination.sh:18-20` documents this limitation ("a NEW gitignored file born in a worktree is only shared after re-running this helper"). The gap is precisely the **mid-session window** — between session-start/worktree-create and worktree-deletion, a newly-authored file has no trigger.

So the persistence of any mid-session orchestrator-prompt file (kickoff, state.md, dispatch prompt) depends on the agent remembering to author it in the primary checkout or re-run the helper. **That dependence on agent attention is the failure mode** — and it is exactly what the project's own thesis says to eliminate ([README.md#why-this-exists](../../../README.md): "fail at the earliest reachable channel … CI = last-resort gate"; don't rely on the agent recalling a convention).

## §1 Goal (one line)

Any **new real file born under `.claude/orchestrator-prompts/*/`** inside any worktree is **automatically adopted into CANON + symlinked back** by a hook — so it survives worktree deletion regardless of whether the agent remembered where to write it. Persistence stops depending on attention; it becomes mechanical.

## §2 Stage map

| Stage | What | Parallel? | Depends on | Branch prefix |
|---|---|---|---|---|
| **S1 hook + wire + test** | the adopt-on-write hook, settings.json registration, one paired-negative test | no | maintainer GO on **DN-A** (trigger choice) | `cah-s1-hook` |
| **S2 verify + close** | live smoke: write a real file under a worktree's `orchestrator-prompts/<x>/` → confirm it becomes a CANON symlink before turn/worktree end; `done.md` | no | S1 merged | `cah-s2-verify` |

### S1 — the hook (reuse, don't rebuild)

The hook does **not** reimplement adoption — it **triggers the existing** `scripts/link-coordination.sh` (adopt-then-link, `:97-142`) when a relevant file appears. Minimal shape:

- A small wrapper hook (e.g. `.claude/hooks/adopt-orchestrator-prompts.sh`) that runs `bash scripts/link-coordination.sh "<repo-toplevel>"` (its adopt-then-link arm `mv`s the real file → CANON, symlinks back; idempotent; `done.md`/`README.md` are skipped as tracked exceptions).
- Registered in `.claude/settings.json` under the chosen trigger (§6 DN-A). Precedent: `.claude/hooks/check-doc-authority.sh` — a `PostToolUse` hook with **tool-name matcher `Edit|Write`** that path-filters **in-script** (`cat | jq -r '.tool_input.file_path'`, `:15`, then `exit 0` for paths outside scope, `:20`). The new hook mirrors that shape — the settings `matcher` cannot glob a path; scoping to `.claude/orchestrator-prompts/` happens inside the script.
- **`@cc-only-rationale` marker** (per [dual-implementation-discipline.md §6](../../../.claude/rules/dual-implementation-discipline.md)): this is **internal orchestrator coordination tooling, not a consumer-shipping path** → CC-native only, no portable fallback. State the rationale in the hook header.
- **Not a capability commit** (per [CLAUDE.md `What is a capability commit`](../../../CLAUDE.md)): a small wrapper hook + test, no new dep, reuses existing logic → escape-hatch `Prior-art:` trailer ("wiring/reuse only — triggers existing link-coordination.sh adopt-then-link on a new event; no new capability"). **Caveat:** the test file may exceed 80 LOC (peer hook tests are 5–20 KB) and could trip the capability-commit detector on file-size alone — apply the escape-hatch trailer to the commit **regardless**; do not let a green-CI assumption skip it.

### S1 — the test (paired-negative, mandatory)

Home: `packages/core/hooks/<name>.test.ts` (precedent: `check-doc-authority.test.ts`, `ask-question-reminder.test.ts`). **Reuse the EXISTING `packages/core/hooks/link-coordination.test.ts`** (19.8 KB, 2026-06-02) — it already has adopt / skip-list / conflict paired-negative coverage **and** a `CLAUDE_COORDINATION_DIR`→tmpdir isolation harness. The NEW test must exercise the **trigger/hook firing on a write**, NOT re-prove adoption (already covered there; re-proving it = T-CAH-A). The trigger test must flip **red→green→red**:
1. New real file under a temp worktree's `orchestrator-prompts/<x>/foo.md`, CANON absent → run hook → file is now a symlink to CANON, CANON holds the real content. (green)
2. Run hook again (idempotent) → no change, still a symlink, no conflict. (green)
3. Tracked exceptions (`done.md`, `README.md`) under the umbrella → hook leaves them as real files (not adopted). (negative arm — confirms the hook honors the same skip-list as link-coordination.sh, doesn't over-adopt)

## §3 Scope fence (hard)

**IN:** one new hook script, its settings.json registration, one paired-negative test, S2 live verify, `done.md`.
**OUT (surface as observation — do NOT do):**
- Modifying `scripts/link-coordination.sh` itself (it already does adopt-then-link; the umbrella only adds a *trigger*). If a real bug in its adopt arm surfaces, surface it — don't fold a rewrite in.
- A "default-to-durable" convention change (authoring kickoffs directly in CANON) — that's a behavioral fix on a separate axis; the hook makes it unnecessary. Note as observation only.
- Consumer-shipping anything — this is internal tooling (`@cc-only-rationale`).
- `~/.claude/**` (agent-uncommittable); touching the consumer-install-completeness umbrella.

## §4 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) — MANDATORY)

Active traps: **T3, T5, T11/T13, T19** + domain.
- **T3** — acceptance is the executable paired-negative test + S2 live smoke, not prose "hook added".
- **T5** — research is done (this kickoff + the incident). Implement per §2; do not re-audit the coordination subsystem.
- **T11/T13** — REUSE, do not rebuild: the adoption logic exists (`link-coordination.sh:97-142`); the umbrella adds a trigger only. If tempted to write a fresh adopt routine in the hook — stop, call the existing script.
- **T19** — S2 own cold-QA via a REAL worktree smoke (write a file, confirm it's a CANON symlink) before close; a green unit test ≠ the hook actually firing on the live event.

**Domain-specific:**
- **T-CAH-A — «test the script, not the trigger».** The bug was never in adopt-then-link (it works); it was that nothing *fired* it on a new file. The test must exercise the **hook firing on a write**, not just call link-coordination.sh directly. If the test only invokes the script, it re-proves the already-working part and misses the actual gap.
- **T-CAH-B — «adopt-everything».** The hook must honor link-coordination's skip-list (`done.md`, `README.md` are tracked, never adopted). A hook that symlinks those breaks the tracked-file contract. The §2 negative arm guards this.
- **T-CAH-C — «verify in the primary checkout».** The failure only exists in a *worktree* (gitignored + ephemeral). S2 smoke MUST run inside a real `git worktree`, not the primary checkout, or it proves nothing about the actual incident shape.

## §5 Acceptance

- **S1:** paired-negative test green (red→green→red per §2); hook carries `@cc-only-rationale`; PR commit carries the escape-hatch `Prior-art:` trailer; §1.7 Forward/Backward if any `.claude/rules/**` or watched path is touched (likely none — hook + test only).
- **S2:** live smoke in a real worktree — author a real `orchestrator-prompts/<x>/k.md`, trigger the hook, then `ls -la` shows a symlink to CANON and `git check-ignore` + CANON content confirm durability; re-run = idempotent; `done.md` per CLAUDE.md Umbrella-closure schema.

## §6 DECISION-NEEDED (maintainer GO required before S1)

- **DN-A — hook trigger:** **(A) `PostToolUse` with tool-name matcher `Edit|Write` + in-script path filter** — the settings `matcher` matches the **tool name only** (`Edit|Write`), NOT a path; scoping to `.claude/orchestrator-prompts/` is done inside the script, exactly like `check-doc-authority.sh` (reads `.tool_input.file_path` via `jq`, `:15`; `exit 0` for out-of-scope paths). Fires at write-time (earliest catch); the in-script early-exit keeps it cheap on irrelevant writes. **(B) `Stop`** — fires once at end of every turn; no matcher; catches everything created that turn; a sibling of the existing `SessionStart` whole-tree sweep (`settings.json:176`), differing only in fire timing; runs always but adopts later. **Orchestrator lean: A** — the project invariant is "fail at the **earliest reachable channel**" ([README.md#why-this-exists](../../../README.md)); A closes the mid-session window at write-time, B at turn-end. *Lean is wrong if* the live probe shows `PostToolUse` does not reliably deliver `Write`'s `tool_input.file_path` inside a worktree → then **B (Stop)** as the robust fallback. **MANDATORY before committing A — dual-channel verify the `PostToolUse` stdin contract** (`tool_input.file_path` field name + that the matcher is tool-name-only) via `claude-code-guide` + a live stdin probe (`claude -p -w probe --settings '{inline}'`); do NOT assert the contract from memory. *(This kickoff's first draft mis-stated the matcher as path-globbing — caught in cold-review; the same dual-channel rule that caught it is why this DN demands a probe.)* Maintainer's hook surface → maintainer decides.

## §7 Stage-gate mechanic

```bash
gh pr list --search "is:merged head:cah-s1-hook base:staging" --json number,title,mergedAt --limit 5
```
S1 merged → Phase -1 cold-review (read-only Agent) → GO before S2. Pre-dispatch in-flight probe per CLAUDE.md §Operational conventions before dispatch.

## §8 Notes for the orchestrator (/pipeline)

- **CC-claim dual-channel:** any claim about how `PostToolUse`/`Stop`/matchers behave (DN-A) must be verified via `claude-code-guide` + a live stdin probe (`claude -p -w probe --settings '{inline}'`) — do NOT assert hook-event semantics from memory (precedent: the CC-skill-name incident).
- **Reuse, don't rebuild (BFR):** the whole point is to add a *trigger* over `scripts/link-coordination.sh` — no new adoption logic. SSOT #110 already covers the coordination capability.
- **Tunnel caveat:** push may be blocked by the Clash fake-ip TUN; use `harvest-via-api.sh` / gh Git Data API fallback.
- **Recursion (this umbrella eats its own dog food):** THIS kickoff was authored in CANON + symlinked (the durable way) precisely because the hook it specifies does not exist yet. Once shipped, the manual CANON-authoring step becomes unnecessary — the hook adopts automatically. Verify that property in S2.
- Last-stage merge → `done.md` here; this kickoff is consumed by `/pipeline` (its generated meta-launch kickoff must pass principle 12 — §4 above seeds the trap list).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
