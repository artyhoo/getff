# late-inflight-probe-hook — PreToolUse hook that runs the late in-flight probe before PR create / merge / chip

<!-- bridge-profile: Z.AI GLM-5.3 SDK -->

> **Class:** single-stage kickoff (dispatch input). **Base branch:** `staging`. **Branch:**
> `feat/late-inflight-probe-hook`. **PR title:** `feat(hooks): run the late in-flight probe before gh pr create/merge and before a spawn_task chip`.
> **Channel:** one aif task, own worktree, one PR to `staging` (harvested from the host).
> **Rigor label (L0):** `build-and-verify` — a PreToolUse hook that can DENY a tool call in every agent
> session of this repo; a false deny blocks PR creation.
> **Authoritative for:** this stage's contract — deliverables, permitted files, RED-first arms, acceptance.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the convention itself — [CLAUDE.md «Pre-dispatch in-flight probe» item (f)](../../../CLAUDE.md); the probe's
> signals and verdicts — the header of `.claude/skills/dispatcher/helpers/probe-inflight.sh` (`--late` block).

## §0 Why

Convention (CLAUDE.md «Pre-dispatch in-flight probe» (f), codified from agent memory
`feedback_inflight_probing.md` in the PR that carries this kickoff): probe for in-flight work
immediately before every outward irreversible act — `gh pr create`, harvest, merge, and offering a
`spawn_task` chip — not only at dispatch. Item (f) is prose; prose is read by attention, and attention
is not a detection layer (`.claude/rules/attention-is-not-a-mechanism.md` §1). This stage makes the
probe RUN at the act, by a PreToolUse hook. Incidents: PR 612 duplicated 613 (no re-probe before
`gh pr create`, 2026-06-17); PR 1354 was an empty-diff twin of 1353 (no re-probe before harvest,
2026-08-10); a chip duplicated PR 1879 (no probe before offering it, 2026-09-29).

The detector already exists and is tested: `probe-inflight.sh --late` (branch mode) and
`--late --chip` (chip mode), `packages/core/skills/dispatcher/probe-inflight-late.test.ts`. This stage
only wires it to the moment. Do NOT change the probe's signals or verdicts; if the hook needs a
different probe behaviour, PARK (§6).

## §1 Prerequisite probe — run first, quote the result in the PR body

**P1 — PreToolUse JSON contract.** Confirm from Claude Code's own hooks documentation
(`https://code.claude.com/docs/en/hooks` via WebFetch, or context7 `/anthropics/claude-code`, ≥2
phrasings) and quote the lines: (a) `hookSpecificOutput.permissionDecision: "deny"` +
`permissionDecisionReason` blocks the call and the reason reaches the model; (b) whether
`hookSpecificOutput.additionalContext` on a PreToolUse hook that does NOT deny reaches the model.
The repo already relies on (a): `.claude/hooks/ask-question-reminder.sh:19-21`. If (b) is not
documented, PARK with «Option A → deny-only hook, weak signals dropped / Option B → weak signals
delivered as a deny that the agent retries past with the ack token» — do not guess.

## §2 Permitted files

- `.claude/hooks/late-inflight-probe.sh` (new)
- `.claude/hooks/lib/shell-segments.sh` (new — see §3.2)
- `.claude/hooks/close-aif-task-on-merge.sh` (only: replace its private `_split_segments` /
  `_strip_prefixes` with a `source` of the lib; no behaviour change)
- `packages/core/hooks/late-inflight-probe.test.ts` (new)
- `scripts/render-harness-config.mjs` (only: add the hook to `PLUGIN_INCOMPATIBLE`)
- `packages/core/hooks/harness-config-drift.test.ts` (only: mirror that name in `PLUGIN_INCOMPATIBLE_NAMES`)
- generated: `docs/site/reference/D.json`, `docs/site/reference/D.md` (`node scripts/render-reference.mjs --write`),
  `packages/getff/MANIFEST.sha256` (`bash scripts/build-getff-dist.sh`), `plugin/hooks/**` only if the
  pre-commit twin sync regenerates it.

NOT permitted: `.claude/settings.json`, `.ai-factory/harness-model.json` (registration is the operator's
step — §5), `probe-inflight.sh`, `CLAUDE.md`, any rule file. Recording a fired PARK is not a file write
(see /pipeline §5 park-record contract): it lands in the park payload + the PR's `## Parked questions`,
and its correction lands as a separate owner commit — so this allowlist deliberately names no
park-record artefact.

## §3 Deliverables

### 3.1 The hook — `.claude/hooks/late-inflight-probe.sh`

Header: one-line purpose, `# @cc-only-rationale: internal operator tooling — PreToolUse on this repo's
own gh/chip calls; not shipped by any setup.d step, no plugin twin` (dual-implementation-discipline.md §6),
a WHY paragraph citing §0's incidents. Bash 3.2 compatible (no `mapfile`, no associative arrays,
no `${var,,}`). `set -uo pipefail`; source `lib/hook-emit.sh` like `close-aif-task-on-merge.sh:42-47`.

Input: PreToolUse JSON on stdin. Behaviour:

1. **Cheap pre-filter.** A Bash call whose raw input does not contain `gh` and `pr` exits 0 before `jq`
   is required. Zero cost for ordinary Bash calls.
2. **Bash.** Split `tool_input.command` into segments with the lib (§3.2). A segment counts only when
   `gh` is its COMMAND word and it is `gh pr create …` or `gh pr merge …` (`--disable-auto` ignored).
   A commit message / echo / heredoc that merely mentions `gh pr create` never counts. Track a literal
   `cd <dir>` as `close-aif-task-on-merge.sh` does and run the probe with that cwd.
   - `gh pr create`: run `probe-inflight.sh --late`; if a literal `--title`/`-t` value is present, pass
     it as `PROBE_LATE_TERMS`.
   - `gh pr merge <n>` (numeric selector): run `probe-inflight.sh --late` with `PROBE_SELF_PR=<n>`.
3. **`mcp__ccd_session__spawn_task`.** Run `probe-inflight.sh --late --chip` with
   `PROBE_LATE_TERMS=<tool_input.title>`.
4. **Probe location.** `${LATE_PROBE_BIN:-$REPO_ROOT/.claude/skills/dispatcher/helpers/probe-inflight.sh}`
   (the env override is the test seam). Missing script or `jq` → exit 0 with an `additionalContext`
   notice naming what did not run (never silent — `#warning-nobody-reads` does not apply because the
   reader is the acting agent at the act).
5. **Verdict → decision** (last `VERDICT:` line of the probe output):

   | Verdict | Decision |
   |---|---|
   | `LATE-COLLISION` | **deny**, reason = the probe's SIGNAL + detail lines + «compare before acting; if this is not a duplicate, re-run with the ack token» |
   | `LATE-COLLISION` + valid ack | allow + `additionalContext` echoing the hits and the ack rationale |
   | `LATE-OVERLAP` | allow + `additionalContext` with the hit lines |
   | `PROBE-INCOMPLETE` | allow + `additionalContext` naming the unavailable signal(s) |
   | `LATE-CLEAR` | exit 0, no output |

   **Ack token** (error-with-escape, precedent `MERGE_LOCK_OVERRIDE` in CLAUDE.md «Agent PR merge policy»
   and `ci-tool-pinning.md` §3): Bash — an env prefix `LATE_PROBE_ACK="<rationale>"` on the gh segment;
   spawn_task — a line `late-probe-ack: <rationale>` in `tool_input.prompt`. Rationale must be ≥20
   non-space characters, else the deny stands and says why.
6. Exit 0 on every path (the JSON carries the decision).

### 3.2 Shared segment parser — `.claude/hooks/lib/shell-segments.sh`

Move `_split_segments` and `_strip_prefixes` verbatim from `close-aif-task-on-merge.sh` into the lib
and `source` it from both hooks. Copying them instead is `#sync-by-copy-paste`
(dual-implementation-discipline.md §8). `packages/core/hooks/close-aif-task-on-merge.test.ts` must stay
green unchanged — it is the proof the move changed no behaviour.

### 3.3 Harness renderer

Add `'late-inflight-probe'` to `PLUGIN_INCOMPATIBLE` in `scripts/render-harness-config.mjs` with the
reason «operator-axis only — probes this repo's own PRs and chips; no plugin twin» (same shape as the
`close-aif-task-on-merge` entry), and mirror the name in `harness-config-drift.test.ts`.

## §4 RED-first — `packages/core/hooks/late-inflight-probe.test.ts`

Write the test first, run it, and record the RED output in the PR body. Drive the hook with
`LATE_PROBE_BIN` pointing at a stub script (written under a tmpdir, invoked as `bash <stub>` — see the
SLOW_SHELL_MS memo in `probe-inflight.test.ts` before adding any timeout) that records its argv + env
and prints a fixture verdict. Arms (each a paired negative where marked ⇄):

1. `gh pr create --title "x"` + COLLISION → deny; reason carries the probe's detail line. ⇄ same with
   `LATE_PROBE_ACK="compared with #1353, different scope entirely"` → allow with context. ⇄ ack of <20
   chars → deny naming the length rule.
2. OVERLAP → allow + `additionalContext`, no `permissionDecision: deny`.
3. CLEAR → empty stdout, exit 0.
4. PROBE-INCOMPLETE → allow + context naming the signal.
5. Not an act ⇄ act: `git commit -m "run gh pr create later"` and `echo gh pr merge 5` → stub never
   called; `cd sub && gh pr create -t y` → stub called with cwd `sub` and `PROBE_LATE_TERMS=y`.
6. `gh pr merge 42 --squash` → stub env has `PROBE_SELF_PR=42`; `gh pr merge --disable-auto 42` → not called.
7. `spawn_task` with title T → stub argv `--late --chip`, env `PROBE_LATE_TERMS=T`; prompt ack line
   honoured as in arm 1.
8. Ordinary Bash (`ls`) → stub never called and no `jq` needed (run with `jq` hidden from PATH).
9. Missing probe script → exit 0 + context notice.

Then one live smoke in the PR body: the hook fed a real `gh pr create` payload inside this worktree,
the real probe, and the JSON it printed.

## §5 Operator step (not yours — put it verbatim in the PR body)

`.claude/settings.json` is agent-denied; registration is the operator's step (precedent PR #1865):

```bash
jq '.hooks.PreToolUse += [{"matcher":"Bash|mcp__ccd_session__spawn_task","command":"bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/late-inflight-probe.sh\""}]' .ai-factory/harness-model.json > /tmp/hm.json && mv /tmp/hm.json .ai-factory/harness-model.json && node scripts/render-harness-config.mjs --write && git add .ai-factory/harness-model.json .claude/settings.json plugin/hooks/hooks.json
```

Check the model's actual PreToolUse shape with `jq '.hooks.PreToolUse' .ai-factory/harness-model.json`
before writing this line; if it differs, adapt the command and say so.

## §6 Park contract

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do
NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external`
with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that
task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure
this whole loop exists to prevent.

## §7 Exit gates

- The host-verify block below is green on the host (the orchestrator re-runs it with
  `bash scripts/host-verify.sh late-inflight-probe-hook` before accepting):

```bash host-verify
(cd packages/core && npx vitest run hooks/late-inflight-probe.test.ts hooks/close-aif-task-on-merge.test.ts hooks/harness-config-drift.test.ts skills/dispatcher/probe-inflight-late.test.ts)
bash tests/agnosticism/probes/channel-coverage.sh
```

- `bash tests/agnosticism/probes/channel-coverage.sh` green (hook marker present).
- `shellcheck .claude/hooks/late-inflight-probe.sh .claude/hooks/lib/shell-segments.sh .claude/hooks/close-aif-task-on-merge.sh` clean.
- `node scripts/render-reference.mjs --check` and `bash scripts/build-getff-dist.sh` leave no diff after regeneration.
- PR body: §1.7 Forward-check / Backward-check sections, `## Fidelity verdict`, `## Probe results`
  (P1 quotes), `## Parked questions`, the §5 operator command, and the trailer
  `Prior-art: prior-art-evaluations.md#20 (Claude Code hooks API, ADOPT — PreToolUse is the channel)`
  plus `Prior-art: prior-art-evaluations.md#111 (/dispatcher, BUILD — the hook only triggers the existing probe-inflight.sh --late)`.

## §8 AI traps — [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)

Active traps: **T3** (every claim in the PR body = command + output or `file:line`) · **T12** (the
PreToolUse JSON contract changed across Claude Code versions — P1 from the docs, not memory) · **T15**
(the PR that ships this hook is itself a `gh pr create`: run the hook on your own payload and show it) ·
**T16** (`close-aif-task-on-merge.sh` is PostToolUse and fail-open; this hook is PreToolUse and can deny —
do not copy its exit semantics) · **T19** (cold-review your own diff before handoff) · **T21**
(backward-check: enumerate every hook that parses `gh` commands, not only the two in the diff).

**T-LIPH-A (domain):** a hook that denies on a noisy signal trains agents to paste the ack token by
reflex, and then it guards nothing. Only `LATE-COLLISION` may deny; if a test fixture tempts you to
deny on OVERLAP or INCOMPLETE, the fixture is wrong.
