<!-- scope:zcode-live-smoke -->
<!-- Live smoke of the ZCode harness on this repo, prompted by the doctrine rows 21-22 refresh
     (#1696). Five load-bearing mechanisms probed by actually running them inside a live ZCode
     session — the verifying session itself is the instrument. One new content-prerequisite
     finding (missing digest block keeps rows 13/15 mechanism-parity but live-inert) and one
     environment gap (harvest channel down). Recorded so the doctrine cites live probes, not
     only binary-level verification. -->

# ZCode live smoke — five checkpoints on this repo

> **Authoritative for:** the 2026-09-10 live-session evidence behind [zcode-parity-doctrine.md](../../../.claude/rules/zcode-parity-doctrine.md) §2 rows 9/13/14/15 and §5 (ZCode tier): what actually fires when a real ZCode session runs this repo's mechanisms.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Hook census classifications — the doctrine §2 table stays the SSOT. Binary-level compaction evidence — see [2026-09-10-zcode-compaction-hook-verification.md](2026-09-10-zcode-compaction-hook-verification.md).

## §1 Scope and method

Subject: the live ZCode session that authored this patch (installed build 2026-09-04, same
binary as the compaction verification). Method: in-session behavioral probes (the session's
own context is the observation surface for injected hook output), manual hook runs on
synthetic stdin where dispatch cannot be isolated, one binary grep, and the repo's own
scripts run as-is. Nothing was taken from vendor docs. Five checkpoints, per the operator
brief: hooks, skills, worktree creation, `make self-audit` in the worktree, harvest channel.

Channel fact first (load-bearing for every hook verdict below): **ZCode does not parse
`.claude/settings.json`** — the repo's hook set reaches ZCode only through the rendered
plugin twins (`plugin/hooks/hooks.json`, from the same `.claude/hooks/*.sh` SSOT via
`scripts/render-harness-config.mjs`). "Do the settings.json hooks fire under ZCode" therefore
means "does the same hook set fire via the only channel ZCode has".

## §2 Results rollup

| # | Checkpoint | Verdict | Doctrine line |
|---|---|---|---|
| 1a | UserPromptSubmit (`inject-session-bootstrap`) | **works** (live-delivered) | row 14 (`zcode-parity-doctrine.md:56`) |
| 1b | PreToolUse `Agent\|Task` (`inject-subagent-context`) | **gap** — live-unverifiable: content no-op | rows 13/15 (`:55`, `:57`) |
| 1c | Stop (`end-of-turn-reminder`) | **works at script level**; dispatch probe below | row 9 (`:51`) |
| 2 | `.zcode/skills/` resolve + load | **works** | §5 tier (`:118`) |
| 3 | `scripts/create-worktree.sh` | **works** | §4 row 20 portable half (`:101`) |
| 4 | `make self-audit` in worktree | **works** (green) | bootstrap invariant (2) |
| 5 | Harvest channel `:3009/health` | **broken** (nothing listens) | none (runtime-bridge, not a hook) |

## §3 Checkpoint 1 — hooks

**1a. UserPromptSubmit: works.** The verifying session received at prompt submit the block
`[session-bootstrap digest — auto-injected at prompt submit] … [/session-bootstrap digest]`
verbatim in its own context. Under ZCode this delivery is only possible through the whole
pipe — dispatch → `run-hook.cmd` → script → strict-JSON `{additionalContext}` (plain stdout
is discarded and the run marked failed, `inject-session-bootstrap.sh:9-11`) — so one clean
delivery proves the channel end-to-end, not just the script. Sibling hooks on the same event
were silent by design, verified manually:

- `inject-output-language`: empty at `AIF_HOOK_LANG=en`, emits `[output-language] … (AIF_HOOK_LANG=ru)` when ru — script healthy, in-session silence = unpinned lang.
- `deps-hash-check`: rc=0, no output (fresh-hash no-op path).
- `inject-project-digest`: no-op, cause in §3.1.

**1b. PreToolUse (`Agent|Task`): gap — live-unverifiable today, and the pipe it guards is inert.**
A subagent was dispatched live and asked whether `[subagent context anchor]` appeared in its
task prompt; answer: **NO**. Root cause is content, not dispatch: `inject-subagent-context.sh`
is ZCode-only (`:33` `_is_zcode || exit 0`) and extracts its payload from a
`digest:start/end` block in `.claude/session-bootstrap.md` — which carries no such markers
(`grep -n 'digest:start\|digest:end' .claude/session-bootstrap.md` → rc=1), so the hook
exits before any `updatedInput`. DEBUG-confirmed on synthetic stdin:

```text
printf '{"tool_name":"Task","tool_input":{"prompt":"smoke probe"}}' \
  | ZCODE_PROJECT_DIR=$PWD LOG_LEVEL=DEBUG bash .claude/hooks/inject-subagent-context.sh
→ [DEBUG] inject-subagent-context: no digest block, no-op   (rc=0)
```
Consequences: (i) the subagent-anchor pipe (row 15 "parity with role annotation") and the
project-digest UserPromptSubmit arm (row 13) are **live-inert in the current tree** — their
"works" classification is binary/census-level mechanism truth, not a live pipe; (ii) whether
ZCode actually dispatches `PreToolUse` for the Agent tool could be neither confirmed nor
refuted — the hook produces zero output either way, and the only other configured PreToolUse
hook (`ask-question-reminder`, matcher `AskUserQuestion`) requires a user-blocking call,
unacceptable in an unattended smoke. The runtime does carry the `updatedInput` apply
mechanism (`grep -ac updatedInput zcode.cjs` → 4 sites).

**1c. Stop: works at script level; in-session dispatch probed by this very turn.**
Synthetic positive control (minified one-line transcript, ZCode-shape `role` field, >500-char
markdown-dense assistant text, `ZCODE_PROJECT_DIR` set):

```text
bash .claude/hooks/end-of-turn-reminder.sh   # stdin: {transcript_path,session_id}
→ {"decision":"block","reason":"Stop. Before you finish — a recap in plain words, …
   You MUST begin the block with exactly the line \"## 🟢 In plain words\" …"}
```

The B2-C thin-recap ZCode branch (`end-of-turn-reminder.sh:614`) fires and emits the correct
block shape. In-session dispatch outcome: this report's landing turn ends with a long
markdown-dense final message — if the harness dispatches Stop and honors `decision:block`,
the session is continued with the recap demand and the outcome is recorded in a follow-up
commit on this branch; if the session instead ends silently, that silence IS the negative
outcome (block not delivered to the model) and this paragraph is the pre-registered
interpretation. (D7/D13 arms expected inert — synthetic transcripts carry no usage fields,
per the compaction patch §3.3.)

## §4 Checkpoint 2 — `.zcode/skills/`

**Works.** Resolution: the harness skill registry lists the project skills at
`.zcode/skills/*` (a symlink: `.zcode/skills -> ../.claude/skills`). Load: the `story` skill
was invoked through the Skill tool and its full SKILL.md content was returned into the
invoking session's context. Its helper also ran live:
`AIF_HOOK_LANG=ru bash .zcode/skills/story/helpers/emit-story-prompt.sh` emitted the
localized story instruction (ru pack) — the skill's machinery, not just its text, executes
under ZCode.

## §5 Checkpoints 3-4 — worktree + self-audit

**`create-worktree.sh`: works.** `bash scripts/create-worktree.sh zcode-smoke-0910` printed
exactly the worktree path on stdout (contract `create-worktree.sh:11`) and provisioned:
branch `worktree-zcode-smoke-0910`, base `a1337cb301` == `origin/staging` HEAD,
`node_modules` and `packages/core/node_modules` symlinked to the primary checkout, `tsx`
reachable at `node_modules/.bin/tsx`. This smoke's own report+PR ride that worktree.

**`make self-audit` in the worktree: green.** Exit 0; principles sweep:
`Test Files 47 passed (47)`, `Tests 481 passed | 2 skipped (483)` — recursive
self-application (bootstrap invariant 2) holds from a ZCode-driven worktree.

## §6 Checkpoint 5 — harvest channel

**Broken as probed.** `curl -s -m5 http://localhost:3009/health` → empty body, curl rc=7
(connection refused); `lsof -nP -iTCP:3009 -sTCP:LISTEN` → no listener. The runtime-bridge
service is not running in this environment. Consistent with the session being started
directly rather than via aif-handoff, but the smoke records the state: no harvest channel is
reachable from a plain ZCode session on this repo today. (The end-of-turn F10 in-flight arm
probes `/tasks` and would report the same unreachability — inert here anyway: `AIF_AUTONOMOUS`
unset.)

## §7 Action items surfaced (out of scope for this read-only smoke)

1. Add a `<!-- digest:start -->…<!-- digest:end -->` block to `.claude/session-bootstrap.md`
   — turns rows 13/15 from mechanism-parity into a live pipe, and makes PreToolUse dispatch
   live-observable (the anchor becomes the positive control).
2. Re-probe PreToolUse dispatch once (1) lands; until then row 15's "works" should be read
   as binary-verified, not live-verified.
3. Harvest channel: start/verify the runtime-bridge service before any aif-loop work under
   ZCode, or record its absence as an environment precondition.

## §8 Falsifier

A ZCode build newer than 2026-09-04 changing hook dispatch (or the digest block landing)
invalidates §3 — re-run the probes before relying on the verdicts. The works-verdicts
(§3.1a, §4, §5) are single-session observations by construction; a second live session
corroborating them would upgrade them from "observed once" to "stable".

## §9 Self-review (§1.7)

**Forward-check:** principle 13 substance arm — this section carries Forward+Backward
(`packages/core/principles/13-phase-research-coverage-s17.test.ts:26`); doc-authority —
patch follows the folder convention and adds no canonical-doc claims; language-discipline —
repo artifact English, operator chat Russian; recommendation discipline — every verdict
cites a command + observed output above and §8 states what would falsify it.

**Backward-check:** class = "ZCode parity claims without live corroboration". Swept:
`zcode-parity-doctrine.md:56` row 14 — now live-corroborated, no change; `:55`/`:57` rows
13/15 — the live-inert nuance recorded here, classification deliberately untouched
(read-only smoke; the doctrine edit belongs to the action-item owner); `:51` row 9 —
script-level corroboration added, dispatch outcome appended post-probe;
`plugin/hooks/hooks.json:3` — channel fact restated, consistent with
`render-harness-config.mjs` row-12 note. No contradiction found between these probes and
any doctrine row; the one stale-looking surface (row 15 "works") is a precision gap, not a
false claim, and is handled as an action item rather than a hot edit.
