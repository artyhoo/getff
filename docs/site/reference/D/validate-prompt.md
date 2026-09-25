---
title: validate-prompt hook
description: Kickoffs pin GitHub Actions to exact SHAs. This gate runs the SHA verifier over an orchestrator-prompt the moment you save it — and tells you plainly when it could not, instead of letting a skip read as a pass.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/validate-prompt.sh
  - .claude/hooks/lib/hook-emit.sh
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - packages/core/hooks/validate-prompt.test.ts
  - packages/core/spec-validation/validate-batch-spec.ts
  - plugin/hooks/hooks.json
executed:
  - { example: validate-prompt-green-on-a-kickoff-without-action-refs, stack: repo, date: 2026-09-25, result: silent }
  - { example: validate-prompt-gh-unavailable-soft-skip, stack: repo, date: 2026-09-25, result: printed }
  - { example: validate-prompt-opt-out-env-var, stack: repo, date: 2026-09-25, result: silent }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# validate-prompt hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-validate-prompt plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `validate-prompt` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PostToolUse gate — validates the batch-spec section on orchestrator-prompts kickoff edits |
| source | `.claude/hooks/validate-prompt.sh:2` |
| event | `["PostToolUse"]` |
| matcher | `["Edit|Write|MultiEdit"]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-validate-prompt -->

<!-- vale on -->

## Explanation

The name says prompts; the work is pins. Files under `.claude/orchestrator-prompts/`
sometimes reference GitHub Actions, and the framework's discipline is that such a
reference is pinned to a full 40-character commit SHA. This [gate](../../terms.md#gate)
fires after you save any markdown under that directory and runs the framework's batch-spec
verifier over the file — the same validator CI runs, moved to the moment of the edit.
Its paired test is blunt about the naming: «PostToolUse hook, NOT UserPromptSubmit
(name is misleading)».

The validator, not the hook, decides what is wrong; the hook is its Claude Code
[channel](../../terms.md#channel) — the fire-point that makes the check early. A file
with no action references has nothing to verify, and the whole thing is silent:

```bash
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-vp-1",
  "tool_input":{"file_path":"'$PWD'/.claude/orchestrator-prompts/getff-ai-site/kickoff.md"}}' \
  | bash .claude/hooks/validate-prompt.sh
```

```text
(nothing — exit 0)
```

What happens when the file *does* carry a pin depends on one tool: `gh`. With `gh`
working, a fake SHA is reported as unresolvable and the hook exits 2 — the paired
negative its own test asserts. With `gh` missing, this gate refuses to pretend: the
hook announces that the cross-checks did not run. That is the output captured live
here (the demo machine had `gh` stripped from `PATH`; the fixture carries an
obviously fake SHA so the intent is visible):

```bash
printf '%s\n' '# demo batch prompt' \
  'uses: actions/checkout@0000000000000000000000000000000000000000' \
  > .claude/orchestrator-prompts/tmp-red-vp/batch-demo.md
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-vp-2",
  "tool_input":{"file_path":"'$PWD'/.claude/orchestrator-prompts/tmp-red-vp/batch-demo.md"}}' \
  | bash .claude/hooks/validate-prompt.sh
```

```text
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"⚠ validate-prompt: gh CLI unavailable — the gh-dependent spec cross-checks DID NOT RUN for this edit (soft-skip by validate-batch-spec.ts). This is a partial SKIP, not a pass; install gh to restore full validation."}}
⚠ validate-prompt: gh CLI unavailable — the gh-dependent spec cross-checks DID NOT RUN for this edit (soft-skip by validate-batch-spec.ts). This is a partial SKIP, not a pass; install gh to restore full validation.
```

The first line is the JSON the model receives; the second is the same notice on
stderr for the operator transcript. Exit code: 0 — a skip is not a failure, but it is
never allowed to dress up as a pass, which the source calls out as «the same
dependency-skip defect class» it exists to prevent: in a container without `gh`, the
cross-checks never ran and nobody knew. Delete the demo directory when you are done.

Turning the gate off entirely is one environment variable, and it is silent by
design — a recorded choice:

```bash
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-vp-3",
  "tool_input":{"file_path":"'$PWD'/.claude/orchestrator-prompts/tmp-red-vp/batch-demo.md"}}' \
  | AIF_VALIDATE_PROMPT=0 bash .claude/hooks/validate-prompt.sh
```

```text
(nothing — exit 0)
```

Everything the gate needs it resolves by tier — repo-local `tsx`, then the main
worktree's, then one on `PATH`; the batch-spec validator likewise, framework layout
first, vendor drop second. A miss at any tier is announced on the model channel with
the same «SKIP, not a pass» wording, so a tooling gap on an unusual layout never
masquerades as a clean file.

## Evidence

- `.claude/hooks/validate-prompt.sh:2` is the header the card's description row
  quotes: `# validate-prompt.sh — PostToolUse gate — validates the batch-spec section on orchestrator-prompts kickoff edits`.
- Registration: `.claude/settings.json:104` reads `"matcher": "Edit|Write|MultiEdit"`
  with the command at line 109; the plugin registry registers it too
  (`plugin/hooks/hooks.json:81`).
- Scope: lines 117-119 pass only paths containing `.claude/orchestrator-prompts/` and
  ending `.md`; the dependency-skip notices are scoped the same way (lines 101-108)
  so a jq-less machine is not warned on every edit.
- The validator and its exit codes: `packages/core/spec-validation/validate-batch-spec.ts:9-12` —
  `0` all valid, `1` findings, `2` «tooling unavailable (no gh CLI, rate limit) — not
  treated as fail in pre-push»; its action-reference regex (lines 28-30) matches
  `uses: owner/repo@<40-hex-sha>`.
- gh soft-skip mapping: lines 139-149 — validator exit 2 becomes the hook's
  «partial SKIP, not a pass» notice; the comment (lines 139-143) records the origin:
  «in the aif container gh IS absent, so the gh-dependent cross-checks never ran and
  nobody knew».
- Violation path under CC: lines 155-159 re-emit the validator's stderr and exit 2;
  under a schema-bound harness the same text goes out as JSON `additionalContext`
  (lines 150-154).
- Tier resolution: `_resolve_tsx` at lines 57-71 (comment at line 56 cites its
  precedent) and `_resolve_validator` at lines 84-92; the header comment (lines 75-83)
  explains the loud-miss branch — «a shipped artefact that resolves a FRAMEWORK-ONLY
  path and then exits 0 is a permanent silent no-op on every consumer».
- Opt-out: line 96, `[[ "${AIF_VALIDATE_PROMPT:-1}" == "0" ]] && exit 0`, with the
  rationale-bearing escape precedent noted at lines 94-95.
- Twin is hand-maintained: lines 16-20 — `@plugin-transform: manual`, the twin drops
  the Wave-7 header lines and the `@file-content-gate` marker, «Keep the two blocks in
  sync by hand».
- Paired test: `packages/core/hooks/validate-prompt.test.ts` — its header (lines 9-32)
  states the paired negative («❌ orchestrator-prompt .md with a FAKE action SHA → exit
  2») and the gh interaction: when gh is absent the validator exits 2 and the hook
  maps that to 0.
