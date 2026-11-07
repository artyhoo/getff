---
title: seal-primary-checkout hook
description: Claude Code path rules anchor to the session's working directory, so a worktree session could edit the ORIGINAL checkout's settings.json — this hook resolves the primary checkout from any worktree and denies file-tool edits to its protected paths, regardless of permission rules.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/seal-primary-checkout.sh
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - tests/hooks/seal-primary-checkout.test.sh
executed:
  - { example: seal-primary-checkout-denies-a-primary-settings-edit-from-a-worktree, stack: repo, date: 2026-10-07, result: deny }
  - { example: seal-primary-checkout-stays-silent-for-the-worktree-copy, stack: repo, date: 2026-10-07, result: silent }
docs-refresh: deferred — re-verified 2026-10-07, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# seal-primary-checkout hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-seal-primary-checkout plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `seal-primary-checkout` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PreToolUse deny gate — seal the PRIMARY checkout's protected paths |
| source | `.claude/hooks/seal-primary-checkout.sh:2` |
| event | `["PreToolUse"]` |
| matcher | `["Edit|Write|MultiEdit"]` |
| delivery | `["@cc-only-rationale"]` |
<!-- getff:end section=D-card-seal-primary-checkout -->

<!-- vale on -->

## Explanation

Path-based permission rules look like they protect `.claude/settings.json` everywhere. They
do not. A rule defined in project settings resolves against the session's primary working
directory — so in a session running inside a git worktree, a deny rule for that file denies
the worktree's copy while the ORIGINAL checkout's copy passes through untouched. The Write
half never worked anywhere: Claude Code accepts a path rule for the Write tool and then
never consults it. Measured on 2026-10-01: a worktree session could edit the primary
checkout's `.claude/settings.json` — the one file that wires every future session's hooks.
The worktree copy was denied; the primary copy reached content.

This hook closes that hole by not using permission rules at all. On every Edit, Write or
MultiEdit call it resolves the primary checkout itself — from a worktree, `.git` is a
pointer file and `git rev-parse --git-common-dir` exposes the primary checkout's `.git`,
whose parent is the primary root; from the primary itself the seal applies there too. It
then turns the target path into a canonical absolute path and denies the call when it lands under one of four
sealed surfaces of that primary checkout: `.claude/settings.json`,
`.claude/settings.local.json`, `.husky/**`, and `.git/hooks/**`. The deny arrives as the
standard PreToolUse permission decision, so the reason — "edit the worktree copy, or ask
the maintainer" — reaches the model instead of a bare refusal.

Everything outside the sealed set is fail-open by design. A global fail-closed would brick
every session the moment git is absent or the payload is unreadable; fail-closed applies
only to a resolved sealed match. The four surfaces are exactly the files that change what
code runs in future sessions — settings, local settings, and both hook directories — so the
short seal list is the threat model, not an arbitrary corner.

Here it is deciding, from this very worktree, with its real output. The primary checkout's
settings file is denied:

```bash
printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"/Users/art/code/rules-as-tests-aif/.claude/settings.json"},"cwd":"'$PWD'"}' \
  | bash .claude/hooks/seal-primary-checkout.sh
```

```text
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Sealed path (primary checkout): /Users/art/code/rules-as-tests-aif/.claude/settings.json — protected from every session by .claude/hooks/seal-primary-checkout.sh. Edit the WORKTREE copy, or ask the maintainer for the sealed surfaces."}}
```

The same file inside the worktree is ordinary project surface and passes through:

```bash
printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"'$PWD'/.claude/settings.json"},"cwd":"'$PWD'"}' \
  | bash .claude/hooks/seal-primary-checkout.sh
echo "exit=$?"
```

```text
exit=0
```

## Evidence

- `.claude/hooks/seal-primary-checkout.sh:4` states the anchoring problem the seal exists
  for: `# CC path-based permission rules anchor to the session's primary working directory`,
  and lines 8 to 10 record the measured consequence:
  `# Edit(/src/**) matches THAT worktree's src/). Consequence measured 2026-10-01: a`.
- Primary resolution works from any linked worktree via the common git dir —
  `.claude/hooks/seal-primary-checkout.sh:17`:
  `# Primary checkout resolution works from ANY linked worktree: in a worktree`, with the
  `git rev-parse --git-common-dir` resolution at lines 95 to 101.
- The sealed set is the case arm at lines 131 to 137 — exactly `.claude/settings.json`,
  `.claude/settings.local.json`, `.husky`, and `.git/hooks` of the resolved primary;
  anything else exits 0 (line 136).
- Fail-open is deliberate and scoped, `.claude/hooks/seal-primary-checkout.sh:26`:
  `# Fail-open outside the sealed set BY DESIGN (git absent, non-repo cwd, unparseable`; a
  jq-less sed fallback keeps the gate alive on well-formed payloads (lines 78 to 82).
- The deny carries a reason naming the sealed path — jq builds the guaranteed-valid JSON at
  lines 142 to 148; the reason string is the one quoted in the example above.
- Registered on this repo's own harness at `.claude/settings.json:108`:
  `"command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/seal-primary-checkout.sh\""`
  (PreToolUse, matcher `Edit|Write|MultiEdit`).
- Paired test: `tests/hooks/seal-primary-checkout.test.sh` — 16 enumerated sub-tests run
  the hook as a child process against a throwaway git repo plus linked worktree in a
  temporary directory: positive denies from worktree AND from the primary, negative allows for
  non-sealed files, the Bash tool gate, the jq-less branch, relative paths, spaces in
  `file_path`, truncated JSON, and a contract sub-test that parses the deny JSON with jq
  and checks the reason length. No test exercises this repo's own paths.
- The delivery is CC-only by a recorded rationale (`.claude/hooks/seal-primary-checkout.sh:33`):
  the sealed threat model itself — permission rules anchoring to the session's working
  directory plus inert Write-path rules — is CC-specific, so a portable twin has nothing to anchor.
