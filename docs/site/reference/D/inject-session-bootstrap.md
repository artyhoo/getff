---
title: inject-session-bootstrap hook
description: At every session start — and again after a clear, a resume or a compaction — the project's non-negotiables — the goal, the invariants, the reading order, the evidence discipline — are put back into context, so they cannot decay out of attention.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/inject-output-language.sh
  - .claude/hooks/inject-session-bootstrap.sh
  - .claude/hooks/lib/skill-index.sh
  - .claude/rules/autonomous-loop-continuity.md
  - .claude/rules/recommendation-laziness-discipline.md
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D/inject-output-language.md
  - docs/site/reference/D/inject-project-digest.md
  - docs/site/reference/D.md
  - docs/site/terms.md
  - plugin/hooks/hooks.json
  - scripts/render-harness-config.mjs
  - packages/core/hooks/inject-session-bootstrap.test.ts
executed:
  - { example: session-bootstrap-default-digest, stack: repo, date: 2026-09-29, result: printed }
  - { example: session-bootstrap-autonomy-opt-in, stack: repo, date: 2026-09-29, result: printed }
  - { example: session-bootstrap-skill-index-on-compact, stack: repo, date: 2026-09-29, result: printed }
docs-refresh: deferred — the only cited-source change in this range is the new seal-primary-checkout row in the D family table; this page's hook contract is untouched; clears at the next refresh of this page
---

# inject-session-bootstrap hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-inject-session-bootstrap plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `inject-session-bootstrap` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | SessionStart hook — injects the session-bootstrap digest into session context |
| source | `.claude/hooks/inject-session-bootstrap.sh:2` |
| event | `["SessionStart"]` |
| matcher | `["startup|resume|clear|compact"]` |
| delivery | `["@cc-only-rationale"]` |
<!-- getff:end section=D-card-inject-session-bootstrap -->

<!-- vale on -->

## Explanation

Long sessions forget. The goal you started with, the invariants you agreed to, the
reading order that keeps a newcomer honest — all of it decays out of a context window a
few compactions later. This hook refuses to let that happen quietly: when a session
starts, and again after every `/clear`, resume or compaction, it re-feeds a short digest
of the project's non-negotiables into the context. Until 2026-09-29 it fired on every
prompt; once per context is enough, because the text does not change between prompts. Not a file the agent should read — text that arrives whether or not
anything reads it.

This is the framework's own digest, about the framework's own rules — that is why it is
in this family but not shipped to consumer projects (consumers get
[inject-project-digest](inject-project-digest.md), which injects their digest instead).
Until 2026-09-29 the plugin also carried it, so every repository with the plugin got
getff's internal digest on each prompt; the plugin no longer ships it, and in the getff
repository itself it moved from every prompt to session start the same day.
Here it is running in the getff repository, verbatim:

```bash
printf '%s' '{"hook_event_name":"SessionStart","source":"startup","session_id":"docs-demo-sb-1"}' \
  | bash .claude/hooks/inject-session-bootstrap.sh
```

```text
[session-bootstrap digest — auto-injected at session start]
Goal: AI agents can't silently bypass undocumented conventions. Every rule is an executable artifact that fails at the earliest reachable channel — edit-time → pre-commit → pre-push → CI → production audit. CI = last-resort gate. (README.md#why-this-exists)
Invariants: (1) Build-vs-reuse discipline — prior-art consult before any capability commit (.claude/rules/build-first-reuse-default.md); (2) Recursive self-application — make self-audit green = the framework's own conventions don't drift; (3) Search-coverage discipline — negative-existence claims («no production analog») fail the §1 6-item checklist before shipping as load-bearing (.claude/rules/phase-research-coverage.md); (4) No paid LLM in CI — no API-billed LLM calls in CI/GH Actions beyond the operator's existing Claude Code subscription (.claude/rules/no-paid-llm-in-ci.md); (5) Multi-channel enforcement — every rule fails at the earliest reachable channel.
Step-0 reading order: README.md → .claude/session-bootstrap.md → CLAUDE.md → task-specific docs.
Recommendation discipline (H1): before issuing a verdict/recommendation (ADOPT/BUILD/REJECT/DEFER, «we should X», «use Y», «pick A over B») — (1) cite SSOT/prior-art by ID, (2) give file:line or command-output evidence, (3) state what would falsify it («wrong if …»), (4) for «nothing exists» claims run the 6-item search check. An unbacked verdict is provisional, not load-bearing. This is a reminder, not a gate. (see also .claude/rules/recommendation-laziness-discipline.md + T-trap in ai-laziness-traps.md §2) (.claude/rules/phase-research-coverage.md §1.7)
Full bootstrap + reviewer drift-prevention flowchart: .claude/session-bootstrap.md
[/session-bootstrap digest]
```

Four details make this more than a heredoc:

- **The lines take care of themselves.** Every path the digest mentions is checked
  against the tree as the digest is built. A file that exists keeps its path; a file
  that does not degrades to the rule's bare name — the text stays, the dead path goes.
  The Step-0 reading order is an arrow list assembled from whichever of the candidate
  files actually exist. A fork of this project with fewer files produces a smaller,
  still-correct digest, never one with broken references.
- **The language line rides along too.** With `AIF_HOOK_LANG` pinned to a non-English
  language, the same reminder the standalone
  [inject-output-language](inject-output-language.md) hook delivers is appended to this
  digest — one mechanism on the framework side.
- **An opt-in block for unattended runs.** Run with `AIF_AUTONOMOUS=1` and a fourth
  section appears:

  ```text
  [autonomy] Standing operator authorization for this unattended run — do NOT re-ask for it, and do NOT infer a narrower constraint than is written here:
  ```

  …followed by four numbered standing authorizations (dispatch cold sub-agents for
  adversarial review; do not end a turn while work is in flight; distrust constraints
  you cannot trace to a citable line; prefer bounded waiters that always emit a
  verdict). Off by default — an ordinary session pays zero tokens and sees no change.
  The hook classifies this block honestly in its own comments: it is «PROSE delivered
  reliably, NOT a gate», and it names its own falsifier — if an autonomous session
  still stops at a reportable boundary with work in flight, the block bought nothing.
- **After a compaction, a skill index.** When the session start is a compaction
  (`"source":"compact"` in the hook's input), one more block follows the digest. The
  harness re-sends everything else it loaded at startup, but not its list of
  [skills](../../terms.md#skill). Without this block the agent stops knowing which
  skills exist. The block holds skill names only, one line per plugin prefix, taken from
  the last full listing the harness recorded in the session transcript plus every change
  after it. Here is the same demo with a compaction payload. It carries no transcript
  path, so the index falls back to the project's own skills that the model may start:

  ```bash
  printf '%s' '{"hook_event_name":"SessionStart","source":"compact","session_id":"docs-demo-sb-3"}' \
    | bash .claude/hooks/inject-session-bootstrap.sh | sed -n '/^\[skill index/,$p'
  ```

  ```text
  [skill index — re-injected after compaction]
  The harness does not re-send its skill listing after a compaction. The skills below are still installed: invoke one through the Skill tool by its exact name (`namespace:name`; names in the first line have no namespace). Descriptions are not repeated here — when a name plausibly fits the task, invoke the skill and read it.
  ai-doc, aif-doctor, claude-glm-executor-handoff, docs-author, night-mode, orchestrator, reviewer, rule-research, rule-tests, self-reflection, story, template-audit, tool-bootstrapping
  [/skill index]
  ```

  On startup, resume and clear the block is absent, because the harness sends its own
  listing then, with descriptions. The index never pushes the digest out: the harness
  cuts one hook's output at 10,000 characters, so the index only gets the room the
  digest leaves, and 4,000 bytes at most (`AIF_SKILL_INDEX_MAX_BYTES`).
  `AIF_SKILL_INDEX=off` turns it off. A copy of the hook without its `lib/` folder next
  to it has no index at all.

Two of the digest's lines are declared delivery channels for rules that live outside
the always-on context: the H1 recommendation-discipline line is the alt-channel of
`.claude/rules/recommendation-laziness-discipline.md`, and the autonomy block is the
second channel of `.claude/rules/autonomous-loop-continuity.md`. The hook's comments
mark those anchor points so the rendered rule index reports the full delivery surface.

## Evidence

- `.claude/hooks/inject-session-bootstrap.sh:2` is the SessionStart header the card's description
  row quotes: `# inject-session-bootstrap.sh — SessionStart hook — injects the session-bootstrap digest into session context`.
- Registration: `.claude/settings.json:260` (SessionStart, matcher
  `startup|resume|clear|compact`) wires it. The plugin does not: `scripts/render-harness-config.mjs` lists it in
  `PLUGIN_INCOMPATIBLE` as operator-axis only, so `plugin/hooks/hooks.json` has no entry
  for it (measured: `grep -c inject-session-bootstrap plugin/hooks/hooks.json` prints `0`).
- The harness-portable output helpers are inline, lines 25-28 — `_is_zcode` branching on
  `ZCODE_PROJECT_DIR` and `_emit_ctx` choosing plain stdout or strict-JSON
  `additionalContext`; header lines 10-12 explain why (under ZCode, plain stdout is
  discarded and the run marked failed).
- Env-first root: line 30
  `REPO_ROOT="${CLAUDE_PROJECT_DIR:-${ZCODE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}}"`
  with the NB at lines 31-32 — the `$0`-relative fallback is «the LAST resort, not the
  primary (issue 1484 root cause)».
- The degradation helpers are lines 36-56: `_rule_ref`, `_rule_bare`, `_rule_name` each
  test the file and print the path or the bare name; header lines 18-21 state the rule —
  «an absent target degrades to the rule/target NAME without the dead path — never a
  silent drop of the invariant text itself».
- The Step-0 arrow list is built by the loop at lines 79-83 over
  `README.md .claude/session-bootstrap.md CLAUDE.md`, kept only when `_has` confirms the
  file; the assembled line lands at lines 84-88.
- Digest assembly is lines 109-115, opening
  `[session-bootstrap digest — auto-injected at session start]` and closing
  `[/session-bootstrap digest]`; the demo above is that string verbatim.
- The language append is the case at lines 120-128; the Russian branch (line 123) appends
  the same `[output-language]` line the standalone hook prints.
- The autonomy block: gated by line 156 `if [ "${AIF_AUTONOMOUS:-0}" = "1" ]`; the
  honest classification is comment lines 146-151 — «this is PROSE delivered reliably,
  NOT a gate … Falsifier: if a session with AIF_AUTONOMOUS=1 still stops at a reportable
  boundary with work in flight, this block bought nothing and F10 needs the Stop-hook
  arm, not more words».
- Channel anchors: lines 104-108 mark the H1 line as the token target for
  `.claude/rules/recommendation-laziness-discipline.md` («the rule itself is evicted
  from always-on rule context per CTX Stage 1; this digest line … are what still fires in
  every session»); lines 130-136 mark the autonomy block for
  `.claude/rules/autonomous-loop-continuity.md` («Both must be declared separately so the
  rendered index reports the full delivery surface»).
- The skill index is lines 170-191 of the hook. The comment at lines 172-174 says why it
  rides on this hook: «a separate hook would need a `.claude/settings.json` registration
  no agent can write». Line 182 reads the input with a one-second bound; lines 183-184
  load `lib/skill-index.sh` only when it is there; line 188 gives the index the room
  under 9,500 bytes that the digest leaves; line 190 appends it.
- In `.claude/hooks/lib/skill-index.sh`, `_skill_index_block` starts at line 81. Line 96
  returns with no output unless the source is `compact`. Lines 98-99 take the names from
  the transcript, then fall back to the project's skills. Line 102 sets the 4,000-byte
  default cap, and the block's fences are lines 120 and 122. Header lines 4-7 cite the
  vendor fact the block repairs: the skill listing is the one startup block the harness
  does not re-inject after a compaction.
- The extraction that produced `inject-output-language.sh` is recorded in that hook's
  header, lines 5-7.
- Paired test: `packages/core/hooks/inject-session-bootstrap.test.ts` (623 lines) — its
  header (lines 1-15) pins the contract including the two sentinel tags,
  `[session-bootstrap digest — auto-injected at session start]` and
  `[/session-bootstrap digest]`.
