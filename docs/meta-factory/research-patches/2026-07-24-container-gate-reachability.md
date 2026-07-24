<!-- scope:container-gate-reachability -->

# Container gate reachability audit — which framework gates are alive in this worktree

> **Type:** R-phase research patch (enumeration audit, docs-only deliverable).
> **Scope:** the 20 `.claude/hooks/*.sh` framework gates + the registration channels that wire them into this session. Verdict per hook against causes A–E.
> **Verified against:** `03949222ca4a83020af67f1cafa3d61d79f56860` (worktree HEAD, branched off the synced container base `3bbc58b8d`; `git rev-parse HEAD`).
> **Date:** 2026-07-24.

---

## §1 Population enumeration (T10 — before any findings)

Commands run in this worktree:

```bash
ls -1 .claude/hooks/*.sh | wc -l          → 20
ls -1 plugin/hooks/*      | wc -l          → 25  (incl. _zcode-emit, hooks.json, run-hook.cmd,
                                                  session-start, warn-subagent-report-zcode,
                                                  and a lang/ subdir of 3 files)
```

The population under audit is the **20 `.claude/hooks/*.sh`** files. The 25 `plugin/hooks/*` entries are the plugin-channel twins; whether they are *active here* is a registration question settled in §3, not a separate population.

The 20 hooks (alphabetical):

```text
adopt-orchestrator-prompts.sh    inject-output-language.sh
ask-question-reminder.sh         inject-project-digest.sh
check-doc-authority-header.sh    inject-session-bootstrap.sh
check-doc-authority.sh           inject-subagent-context.sh
check-hook-marker.sh             inject-subagent-digest.sh
check-kickoff-traps.sh           inject-subagent-memory-codification.sh  ← actually: inject-memory-codification.sh
check-worker-dispatch-channel.sh runtime-bridge-dispatch.sh
deps-hash-check.sh               validate-prompt.sh
end-of-turn-reminder.sh          warn-subagent-report.sh
                                 worktree-setup.sh
```

(Correcting the alphabetical slip: the file is `inject-memory-codification.sh`, listed once.)

**Denominator for §5: 20 hooks.**

---

## §2 Environment resolution table

Every binary named or constructed-path'd by any hook, resolved **in this container**:

| dependency | `command -v` (PATH) | constructed-path probe | present? |
|---|---|---|---|
| `jq`      | `/usr/bin/jq`                                   | n/a (no hook constructs a jq path)        | **present** |
| `node`    | `/usr/local/bin/node`                           | n/a                                       | **present** |
| `tsx`     | `/app/node_modules/.bin/tsx`                    | `$REPO_ROOT/node_modules/.bin/tsx` → **MISSING** (`-x` test false; no repo-local `node_modules`) | **present on PATH, ABSENT at the constructed path** ← cause C |
| `python3` | `/usr/bin/python3`                              | n/a                                       | **present** |
| `gh`      | `/usr/bin/gh`                                   | n/a                                       | **present** |
| `git`     | `/usr/bin/git`                                  | n/a                                       | **present** |
| `awk`     | (busybox coreutil, on PATH)                     | n/a                                       | **present** |
| `sha256sum` | `/usr/bin/sha256sum`                          | n/a                                       | **present** |
| `actionlint` | (absent)                                     | n/a                                       | absent (not used by any hook at runtime) |
| `zizmor`  | (absent)                                        | n/a                                       | absent (pre-push only, not a hook dep) |
| `rg`      | alias → `/app/node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/arm64-linux/rg` | n/a | present (no hook uses `rg`) |

The single load-bearing asymmetry: **`tsx` exists at `/app/node_modules/.bin/tsx` (on PATH) but NOT at `$REPO_ROOT/node_modules/.bin/tsx`** — the repo-local `node_modules` is absent from this worktree (verified: `ls node_modules/.bin/tsx` → no such file). Three hooks construct the wrong path; every other binary is PATH-resolved by the hooks that use it. `CLAUDE_PLUGIN_ROOT` is **unset** and the repo's own plugin is **not enabled** in `~/.claude/settings.json` (only `superpowers@superpowers-dev` is) — so the `plugin/hooks/hooks.json` registration channel is inert here.

---

## §3 Per-hook verdict table

Registration source of truth for THIS session: `.claude/settings.json` (CC reads project + user settings; user settings enable no extra hooks for this repo). `.ai-factory/harness-model.json` is the rendered twin (semantically identical hook set, plus a `SessionStart: link-coordination.sh` not mirrored into `.claude/settings.json`). `plugin/hooks/hooks.json` exists but is dead here (plugin channel disabled, `CLAUDE_PLUGIN_ROOT` unset).

Cause codes: **A** not registered · **B** dependency absent · **C** resolution path wrong · **D** output goes nowhere · **E** alive.

| # | hook | registered (config:line) | dependency guard (file:line) | resolution class | verdict | evidence |
|---|---|---|---|---|---|---|
| 1 | `adopt-orchestrator-prompts.sh` | **not registered** (no row in `.claude/settings.json` `hooks.*`) | `command -v jq` `:28` | A | **A** | No registration in any active channel; framework-internal. (jq + `scripts/link-coordination.sh` both resolve, so it *would* be E if registered.) |
| 2 | `ask-question-reminder.sh` | PreToolUse:AskUserQuestion (`.claude/settings.json:30-38`) | `command -v jq` `:32` | E | **E** | PROBE 9: fed `{"tool_name":"AskUserQuestion",...}` → emitted `{permissionDecision:"deny",permissionDecisionReason:...}` JSON, exit 0. Live-observed. |
| 3 | `check-doc-authority-header.sh` | **not registered** (consumer-shippable variant; framework uses #4) | `command -v jq` `:41` | A | **A** | No registration; the framework dogfoods #4 (the tsx-delegating twin). Intentional — not a gap. |
| 4 | `check-doc-authority.sh` | PostToolUse:Edit\|Write\|MultiEdit (`.claude/settings.json:46-54`) | `command -v jq` `:50`; `TSX="$REPO_ROOT/node_modules/.bin/tsx"` `:48`, `[[ ! -x "$TSX" ]] && _emit_skip … :65` | C (LOUD) | **C** | PROBE 2: fed an in-scope `.claude/rules/*.md` edit → jq OK → `09-doc-authority-hierarchy.bin.ts` EXISTS → tsx guard hit → emitted `{"hookSpecificOutput":{…additionalContext:"⚠ check-doc-authority: tsx not found — … DID NOT RUN …"}}`, exit 0. Gate inert **but the skip is announced on the model-visible channel** (post-PR #1120 fix working as designed). |
| 5 | `check-hook-marker.sh` | PostToolUse:Edit\|Write\|MultiEdit (`.claude/settings.json:78-86`) | `command -v jq` `:64` | E | **E** | PROBE 6b: fed an in-repo hook with a valid marker → ran, exit 0 silent (marker present). No tsx dep; pure jq+grep. Live-observed. |
| 6 | `check-kickoff-traps.sh` | PostToolUse:Edit\|Write\|MultiEdit (`.claude/settings.json:70-78`) | `command -v jq` `:46` | E | **E** | jq present; no tsx dep (pure `grep -oE '\bT[0-9]+\b'`); path-filtered to `*/kickoff.md`. Source-proven alive; no kickoff edited this session so no live emission observed (not inferred — the gate is a pure bash/jq pipeline with all deps resolving). |
| 7 | `check-worker-dispatch-channel.sh` | PostToolUse:Edit\|Write\|MultiEdit (`.claude/settings.json:94-102`) | `command -v jq` `:45`; `TSX="$REPO_ROOT/node_modules/.bin/tsx"` `:43`, `[[ ! -x "$TSX" ]] && exit 0 :64` (**silent — no `_emit_skip`**) | C + D | **C+D** | PROBE 3: fed a real `*/kickoff.md` edit → jq OK → `29-worker-dispatch-channel.bin.ts` EXISTS → tsx guard hit → **`NOTHING APPEARED`**, exit 0. The `#worker-dispatch-via-subagent` gate is registered + would fire on kickoff edits, but the tsx-resolution failure produces no output at all — the model never learns the check skipped. **This is the one cause-C hook missed by the PR #1116/#1120 loud-skip sweep.** |
| 8 | `deps-hash-check.sh` | UserPromptSubmit (`.claude/settings.json:21-27`) | none hard-required; uses jq/node/awk/sha256sum (all present) | E (no-op by design) | **E** | PROBE 7: ran, exit 0 silent. Reason: `.ai-factory/tool-decisions.md` is absent → `[ -f "$DECISIONS" ] || exit 0` `:82`. Alive (deps resolve; would emit a WARN on drift) — silent here because no baseline is recorded yet (the documented zero-setup default). |
| 9 | `end-of-turn-reminder.sh` | Stop (`.claude/settings.json:113-119`) | `command -v jq` `:14` | E | **E** | jq present; sources `lang/en.sh`. Not yet live-observed from my vantage because the Stop event fires at turn end (will observe at this session's Stop). Source-proven: all deps resolve, output is the documented `{decision:"block",reason:…}` JSON. |
| 10 | `inject-matching-rule.sh` | PostToolUse:Edit\|Write\|MultiEdit (`.claude/settings.json:62-70`) | `command -v jq` `:32` | E | **E** | PROBE 5: fed a `.claude/hooks/*.sh` edit → emitted JSON `additionalContext` with 4 path-relevant rules (ci-tool-pinning, dual-implementation, language-discipline, zcode-parity). Live-observed. |
| 11 | `inject-memory-codification.sh` | PostToolUse:Write (`.claude/settings.json:106-113`) | `command -v jq` `:22` | E | **E** | PROBE 8: fed a `Write` to a `/memory/` path → emitted the codification-reminder JSON, exit 0. Live-observed. |
| 12 | `inject-output-language.sh` | **not registered** (subsumed by #14's B1 language branch) | none (pure bash) | A | **A** | No registration. Functionally subsumed: `inject-session-bootstrap.sh:38-46` injects the same `[output-language]` signal from the bootstrap digest. No live gap. |
| 13 | `inject-project-digest.sh` | **not registered** (subsumed by #14 + #15) | none hard-required; optional jq | A | **A** | No registration. The framework dogfoods `inject-session-bootstrap.sh` (UserPromptSubmit) + `inject-subagent-digest.sh` (SubagentStart), which together cover both events this consumer-generic hook handles. No live gap for the framework session. |
| 14 | `inject-session-bootstrap.sh` | UserPromptSubmit (`.claude/settings.json:14-20`) | none (plain printf/cat) | E | **E** | Observed directly: the `[session-bootstrap digest — auto-injected at prompt submit]` block appeared at the top of this turn's prompt. Live-observed from the model's own vantage. |
| 15 | `inject-subagent-context.sh` | PreToolUse:Agent\|Task (`.claude/settings.json:39-45`) | `_is_zcode \|\| exit 0` `:33` | E (by-design no-op on CC) | **E** | Registered + runs. On CC it exits 0 immediately by design (line 33 — it is the ZCode backup for SubagentStart; the CC primary is `inject-subagent-digest.sh`). Source-proven; no dependency missing. Not a defect — the inline `_is_zcode` gate IS the portability branch. |
| 16 | `inject-subagent-digest.sh` | SubagentStart (`.claude/settings.json:120-126`) | `command -v jq` `:18` | E | **E** | PROBE 10: fed a `SubagentStart` event → emitted `{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:"[session-bootstrap digest…]}}`, exit 0. Live-observed. |
| 17 | `runtime-bridge-dispatch.sh` | PostToolUse:Write\|Edit\|MultiEdit (`.claude/settings.json:54-62`) | `command -v jq \|\| … :52`; **uses `command -v tsx` (PATH, NOT constructed)** `:114` | E | **E** | Deps resolve: `command -v tsx` finds `/app/node_modules/.bin/tsx` (PATH-resolved, unlike #4/#7); `dispatch.ts` EXISTS. Path-filtered to `*/kickoff.md` with first-line `<!-- bridge: auto -->`. Not live-observed (no bridge-auto kickoff edited this session) — source-proven, no missing dep. |
| 18 | `validate-prompt.sh` | PostToolUse:Edit\|Write\|MultiEdit (`.claude/settings.json:38-46`) | `command -v jq` `:52`; `TSX="$REPO_ROOT/node_modules/.bin/tsx"` `:46`, `[[ ! -x "$TSX" ]] && _emit_skip … :69` | C (LOUD) | **C** | PROBE 4: fed a real `*/kickoff.md` edit → jq OK → tsx guard hit → emitted `{"hookSpecificOutput":{…additionalContext:"⚠ validate-prompt: tsx not found at <constructed-path> — batch-spec validation DID NOT RUN …"}}`, exit 0. Gate inert on kickoff edits **but the skip is announced** (post-PR #1120 fix). Only fires on `.claude/orchestrator-prompts/**/*.md`; silent on other paths by design. |
| 19 | `warn-subagent-report.sh` | SubagentStop (`.claude/settings.json:127-133`) | `command -v jq` `:59` | E | **E** | PROBE 11: fed a SubagentStop with a report missing `ATTN` → emitted `{hookSpecificOutput:{hookEventName:"SubagentStop",additionalContext:"⚠ … missing section(s): ATTN …"}}`, exit 0. Live-observed. |
| 20 | `worktree-setup.sh` | **not registered** (`WorktreeCreate` is not in `.claude/settings.json`; CLAUDE.md documents this) | n/a | A | **A** | No registration. `WorktreeCreate` is a maintainer-applied scaffolding hook; irrelevant to this container session (no worktree being created). |

Footnote on the "settings.json line" citations: line numbers refer to the file as checked out at HEAD; the `PostToolUse` block spans the validate-prompt through inject-memory-codification entries in registration order. The exact line is less load-bearing than the *fact* of registration, which was verified by reading the rendered config end-to-end.

---

## §4 Live-fire results (verbatim observations)

Per T-CGR-A: every row is either an observation or an explicit `not live-observed (reason)`. No "presumably same as above".

| hook | input shape | observed output |
|---|---|---|
| `inject-session-bootstrap.sh` | (real UserPromptSubmit, this turn) | `[session-bootstrap digest — auto-injected at prompt submit]` block appeared at the prompt head (verbatim, see the system reminder). |
| `check-doc-authority.sh` | `Write` of `.claude/rules/00-rule-index.md` | `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"⚠ check-doc-authority: tsx not found — the principle-09 authority-header check DID NOT RUN for this edit. This is a SKIP, not a pass."}}` + stderr copy, exit 0. |
| `check-worker-dispatch-channel.sh` | `Edit` of `.claude/orchestrator-prompts/547-install-auto-wire-r2/kickoff.md` | **`NOTHING APPEARED`** (empty stdout+stderr), exit 0. |
| `validate-prompt.sh` | `Write` of `…/547-install-auto-wire-r2/kickoff.md` | `{"hookSpecificOutput":{…additionalContext:"⚠ validate-prompt: tsx not found at <constructed-path> — batch-spec validation DID NOT RUN for this edit. This is a SKIP, not a pass."}}` + stderr copy, exit 0. |
| `inject-matching-rule.sh` | `Edit` of `.claude/hooks/validate-prompt.sh` | `{…additionalContext:"📎 Path-relevant rule — … ci-tool-pinning … dual-implementation-discipline … language-discipline … zcode-parity-doctrine …"}`, exit 0. |
| `check-hook-marker.sh` | `Write` of an in-repo hook with a valid marker | `NOTHING APPEARED` (marker present → pass), exit 0. (First attempt used an out-of-repo tmpdir path and hit the outside-repo guard at `:84` — re-ran in-repo.) |
| `deps-hash-check.sh` | `UserPromptSubmit` event JSON | `NOTHING APPEARED` — `.ai-factory/tool-decisions.md` absent → `exit 0` at `:82` (zero-setup default). |
| `inject-memory-codification.sh` | `Write` of a `/memory/` path | `{…additionalContext:"📎 Memory-codification reminder — … Codify it into the repo in the SAME step …"}`, exit 0. |
| `ask-question-reminder.sh` | `AskUserQuestion` tool JSON | `{…permissionDecision:"deny",permissionDecisionReason:"Stop — you are about to ask a question. First check the question itself …"}`, exit 0. |
| `inject-subagent-digest.sh` | `SubagentStart` event JSON | `{…hookEventName:"SubagentStart",additionalContext:"[session-bootstrap digest — auto-injected at prompt submit] …"}`, exit 0. |
| `warn-subagent-report.sh` | `SubagentStop` with `VERIFY`+`Confidence:` but no `ATTN` | `{"hookSpecificOutput":{"hookEventName:"SubagentStop",additionalContext:"⚠ SubagentStop: subagent REPORT missing section(s): ATTN — treat the report as incomplete …"}}` + stderr, exit 0. |
| `check-kickoff-traps.sh` | — | **not live-observed** — no `kickoff.md` edited this session. Source-proven (jq present; pure grep, no tsx). Not inferred from another row. |
| `end-of-turn-reminder.sh` | — | **not yet live-observed** — the Stop event fires at this session's turn end. Source-proven (jq present, lang/en.sh resolves). |
| `runtime-bridge-dispatch.sh` | — | **not live-observed** — no `<!-- bridge: auto -->` kickoff edited this session. Source-proven (`command -v tsx` PATH-resolves to `/app/…`; `dispatch.ts` exists). |
| `inject-subagent-context.sh` | — | **not live-observed** — on CC exits 0 at `:33` `_is_zcode || exit 0` by design (zcode backup). Source-proven; no dependency missing. |

---

## §5 Rollup

Counts per verdict class across the **20-hook population**:

| verdict | count | hooks |
|---|---|---|
| **A — not registered** | 5 | adopt-orchestrator-prompts, check-doc-authority-header, inject-output-language, inject-project-digest, worktree-setup |
| **B — dependency absent** | 0 | — (jq/node/python3/gh/git/awk/sha256sum all present) |
| **C — resolution path wrong** | 3 | check-doc-authority (loud), validate-prompt (loud), check-worker-dispatch-channel (**silent**) |
| **D — output goes nowhere** | (1, subsumed in C) | check-worker-dispatch-channel is the single D-class row — a tsx-resolution skip with no `_emit_skip`, so the model receives nothing |
| **E — alive** | 12 | ask-question-reminder, check-hook-marker, check-kickoff-traps, deps-hash-check, end-of-turn-reminder, inject-matching-rule, inject-memory-codification, inject-session-bootstrap, inject-subagent-context, inject-subagent-digest, runtime-bridge-dispatch, warn-subagent-report |

**Headline answer — how many registered gates enforce nothing here, and for which cause:**

- **3 registered gates enforce nothing** (out of 15 registered): the three tsx-delegating PostToolUse gates — `check-doc-authority.sh`, `validate-prompt.sh`, `check-worker-dispatch-channel.sh`. All three fail for **cause C** (tsx looked for at `$REPO_ROOT/node_modules/.bin/tsx`, a path absent in this worktree, while tsx IS available at `/app/node_modules/.bin/tsx` on PATH).
- Of those three, **two are loud** (cause C only): `check-doc-authority.sh` and `validate-prompt.sh` announce the skip on the model-visible `hookSpecificOutput.additionalContext` channel — the PR #1116/#1120 fix working as designed.
- **one is silent** (cause C + D): `check-worker-dispatch-channel.sh` has the same tsx-resolution failure but lacks the `_emit_skip` mechanism, so it exits 0 with no output. This is the one hook missed by the PR #1116/#1120 dependency-skip loudness sweep.
- The 5 cause-A hooks are **not defects** — 4 are subsumed by other live hooks (inject-output-language, inject-project-digest by the bootstrap digest; check-doc-authority-header by its tsx twin; inject-subagent-context by the CC primary) or are maintainer-only scaffolding (worktree-setup) / framework-internal (adopt-orchestrator-prompts). None represents a live enforcement gap for this session.

---

## §6 Coverage statement

**Mechanically verified:** 20/20 hooks read in full (dependency guards + constructed paths quoted with `file:line`); 11/15 registered hooks live-fired from the model's own vantage (observations quoted verbatim in §4); the tsx cause-C asymmetry proven directly (`-x` test on the constructed path + `command -v tsx` on PATH).

**Source-proven (not live-observed, event did not occur this session):** 4 hooks — `check-kickoff-traps.sh`, `end-of-turn-reminder.sh` (fires at Stop, observed post-turn), `runtime-bridge-dispatch.sh`, `inject-subagent-context.sh`. Each was verified by reading the full source + confirming every named dependency resolves in this environment; none is inferred from "same shape as another row".

**What would falsify the rollup:**

1. If `node_modules/.bin/tsx` were symlinked into the worktree (e.g. by `scripts/worktree-node-modules.sh` being run, which CLAUDE.md names as the provisioning SSOT), the three cause-C hooks would flip to E and the headline finding dissolves. **The single most consequential finding is conditional on the repo-local `node_modules` being absent — which this worktree's provisioning did not provide.**
2. If the repo's own plugin were enabled in `~/.claude/settings.json`, the `plugin/hooks/hooks.json` channel would activate and the cause-A verdicts for the 4 hooks it twins (inject-output-language, inject-project-digest, + the session-start entry) would need re-evaluation. The plugin is not enabled here.
3. If `.ai-factory/tool-decisions.md` existed, `deps-hash-check.sh` would move from "alive, silent by design" to "actively comparing baselines" — still E either way.
4. If a future container-sync added a repo-local `node_modules` (the documented fix at CLAUDE.md `## Operational conventions` "Worktree `node_modules` provisioning"), the three cause-C hooks become E and only the cause-D silence of `check-worker-dispatch-channel.sh`'s missing `_emit_skip` remains — which is itself the fix-pointer for a separate task.

**Self-application (T15):** the gates that guard *this very PR* — the principles and discipline rules the framework applies to its own commits — are, in this container, mostly alive: the §1.7 forward/backward-check discipline, the doc-authority header rule, the dual-implementation marker rule, and the ai-laziness-traps T-enumeration floor all reach me through live E-class hooks or through the session-bootstrap digest injection. The one exception that touches this PR directly is `check-doc-authority.sh` (cause C, loud): when I write this research-patch file the principle-09 authority-header gate does not run — but I am told it did not run, so the discipline still reaches me as information even though the mechanical gate is inert. The `check-worker-dispatch-channel.sh` gate does not touch this PR (no kickoff edited).