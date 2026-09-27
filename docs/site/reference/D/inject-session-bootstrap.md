---
title: inject-session-bootstrap hook
description: On every prompt you submit, the project's non-negotiables — the goal, the invariants, the reading order, the evidence discipline — ride along with it, so they cannot decay out of attention.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/inject-output-language.sh
  - .claude/hooks/inject-session-bootstrap.sh
  - .claude/rules/autonomous-loop-continuity.md
  - .claude/rules/recommendation-laziness-discipline.md
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D/inject-output-language.md
  - docs/site/reference/D/inject-project-digest.md
  - docs/site/reference/D.md
  - docs/site/terms.md
  - plugin/hooks/hooks.json
  - packages/core/hooks/inject-session-bootstrap.test.ts
executed:
  - { example: session-bootstrap-default-digest, stack: repo, date: 2026-09-25, result: printed }
  - { example: session-bootstrap-autonomy-opt-in, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
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
| description | UserPromptSubmit hook — injects the session-bootstrap digest into prompt context |
| source | `.claude/hooks/inject-session-bootstrap.sh:2` |
| event | `["UserPromptSubmit"]` |
| matcher | `[]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-inject-session-bootstrap -->

<!-- vale on -->

## Explanation

Long sessions forget. The goal you started with, the invariants you agreed to, the
reading order that keeps a newcomer honest — all of it decays out of a context window a
few compactions later. This hook refuses to let that happen quietly: on every single
prompt you submit, it re-feeds a short digest of the project's non-negotiables into the
prompt context. Not a file the agent should read — text that arrives whether or not
anything reads it.

This is the framework's own digest, about the framework's own rules — that is why it is
in this family but not shipped to consumer projects as-is (consumers get
[inject-project-digest](inject-project-digest.md), which injects their digest instead).
Here it is running in the getff repository, verbatim:

```bash
printf '%s' '{"prompt":"hi","session_id":"docs-demo-sb-1"}' \
  | bash .claude/hooks/inject-session-bootstrap.sh
```

```text
[session-bootstrap digest — auto-injected at prompt submit]
Goal: AI agents can't silently bypass undocumented conventions. Every rule is an executable artifact that fails at the earliest reachable channel — edit-time → pre-commit → pre-push → CI → production audit. CI = last-resort gate. (README.md#why-this-exists)
Invariants: (1) build-vs-reuse SSOT consult before capability commit + build-first-reuse-default discipline (.claude/rules/build-first-reuse-default.md); (2) recursive self-application green (make self-audit); (3) search-coverage 6-item checklist on negative-existence claims; (4) multi-channel enforcement — every rule fails at earliest reachable channel (CI = last resort).
Step-0 reading order: README.md → .claude/session-bootstrap.md → CLAUDE.md → task-specific docs.
Recommendation discipline (H1): before issuing a verdict/recommendation (ADOPT/BUILD/REJECT/DEFER, «we should X», «use Y», «pick A over B») — (1) cite SSOT/prior-art by ID, (2) give file:line or command-output evidence, (3) state what would falsify it («wrong if …»), (4) for «nothing exists» claims run the 6-item search check. An unbacked verdict is provisional, not load-bearing. This is a reminder, not a gate. (see also .claude/rules/recommendation-laziness-discipline.md + T-trap in ai-laziness-traps.md §2) (.claude/rules/phase-research-coverage.md §1.7)
Full bootstrap + reviewer drift-prevention flowchart: .claude/session-bootstrap.md
[/session-bootstrap digest]
```

Three details make this more than a heredoc:

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
- **One more block exists, strictly opt-in.** Run with `AIF_AUTONOMOUS=1` and a fourth
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

Two of the digest's lines are declared delivery channels for rules that live outside
the always-on context: the H1 recommendation-discipline line is the alt-channel of
`.claude/rules/recommendation-laziness-discipline.md`, and the autonomy block is the
second channel of `.claude/rules/autonomous-loop-continuity.md`. The hook's comments
mark those anchor points so the rendered rule index reports the full delivery surface.

## Evidence

- `.claude/hooks/inject-session-bootstrap.sh:2` is the header the card's description row
  quotes: `# inject-session-bootstrap.sh — UserPromptSubmit hook — injects the session-bootstrap digest into prompt context`.
- Registration: `.claude/settings.json:70` (UserPromptSubmit) and
  `plugin/hooks/hooks.json:24` both wire it; no matcher is set.
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
- The Step-0 arrow list is built by the loop at lines 73-77 over
  `README.md .claude/session-bootstrap.md CLAUDE.md`, kept only when `_has` confirms the
  file; the assembled line lands at lines 79-82.
- Digest assembly is lines 103-109, opening
  `[session-bootstrap digest — auto-injected at prompt submit]` and closing
  `[/session-bootstrap digest]`; the demo above is that string verbatim.
- The language append is the case at lines 114-122; the Russian branch (line 117) appends
  the same `[output-language]` line the standalone hook prints.
- The autonomy block: gated by line 150 `if [ "${AIF_AUTONOMOUS:-0}" = "1" ]`; the
  honest classification is comment lines 140-145 — «this is PROSE delivered reliably,
  NOT a gate … Falsifier: if a session with AIF_AUTONOMOUS=1 still stops at a reportable
  boundary with work in flight, this block bought nothing and F10 needs the Stop-hook
  arm, not more words».
- Channel anchors: lines 98-102 mark the H1 line as the token target for
  `.claude/rules/recommendation-laziness-discipline.md` («the rule itself is evicted
  from always-on rule context per CTX Stage 1; this digest line … are what still fires at
  every prompt»); lines 124-130 mark the autonomy block for
  `.claude/rules/autonomous-loop-continuity.md` («Both must be declared separately so the
  rendered index reports the full delivery surface»).
- The extraction that produced `inject-output-language.sh` is recorded in that hook's
  header, lines 5-7.
- Paired test: `packages/core/hooks/inject-session-bootstrap.test.ts` (484 lines) — its
  header (lines 1-15) pins the contract including the two sentinel tags,
  `[session-bootstrap digest — auto-injected at prompt submit]` and
  `[/session-bootstrap digest]`.
