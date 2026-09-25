---
title: check-kickoff-traps hook
description: A kickoff that cites the AI-traps catalogue without naming real trap numbers is decoration. This gate reads the kickoff the moment you write it — and also checks it tells the worker how its work will be verified.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/check-kickoff-traps.sh
  - .claude/hooks/lib/hook-emit.sh
  - .claude/rules/ai-laziness-traps.md
  - .claude/rules/destination-environment-verification.md
  - .claude/rules/kickoff-staging-placement.md
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - packages/core/hooks/check-kickoff-traps.test.ts
  - packages/core/principles/kickoff-population.ts
  - plugin/hooks/hooks.json
  - scripts/host-verify.sh
executed:
  - { example: kickoff-traps-green-on-a-real-kickoff, stack: repo, date: 2026-09-25, result: silent }
  - { example: kickoff-traps-red-on-a-near-miss-filename, stack: repo, date: 2026-09-25, result: printed }
  - { example: kickoff-traps-red-on-a-thin-trap-enumeration, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# check-kickoff-traps hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-check-kickoff-traps plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `check-kickoff-traps` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PostToolUse gate — kickoff T-enumeration floor (ai-laziness-traps §3) |
| source | `.claude/hooks/check-kickoff-traps.sh:2` |
| event | `["PostToolUse"]` |
| matcher | `["Edit|Write|MultiEdit"]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-check-kickoff-traps -->

<!-- vale on -->

## Explanation

A kickoff is the instruction sheet a worker session runs on. If it cites the
framework's AI-traps catalogue the way a student cites a bibliography — naming the
rule, naming no traps — the worker inherits nothing. This
[gate](../../terms.md#gate) reads a kickoff the moment you write it and applies a
countable floor: engage the traps rule, and you must enumerate at least three distinct
canonical T-numbers. The floor is deliberately mechanical; whether you picked the
*right* traps stays a judgment for review.

Kickoffs are also the one artefact class written and dispatched before any CI can look
at them — which is why this check lives at edit time, the only moment it can. Here it
is passing on the framework's real umbrella kickoff, which engages the rule and names
six distinct T-numbers:

```bash
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-ckt-1",
  "tool_input":{"file_path":"'$PWD'/.claude/orchestrator-prompts/getff-ai-site/kickoff.md"}}' \
  | bash .claude/hooks/check-kickoff-traps.sh
```

```text
(nothing — exit 0)
```

Three things can make it speak, and the first is not about traps at all. The hook
classifies every `kickoff-*` filename it sees into exactly three buckets — umbrella,
stage, or a named sidecar — and a name that fits none is itself the violation, because
every other gate silently skips such a file and reports green having examined nothing.
A near-miss name is the demo:

```bash
mkdir -p .claude/orchestrator-prompts/tmp-red-traps
printf '%s\n' '# a near-miss kickoff name' 'Content.' \
  > .claude/orchestrator-prompts/tmp-red-traps/kickoff-zz.md
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-ckt-2",
  "tool_input":{"file_path":"'$PWD'/.claude/orchestrator-prompts/tmp-red-traps/kickoff-zz.md"}}' \
  | bash .claude/hooks/check-kickoff-traps.sh
```

```text
❌ kickoff-name: .claude/orchestrator-prompts/tmp-red-traps/kickoff-zz.md — unrecognised `kickoff-*` filename.
   It is NEITHER the stage form `kickoff-<letter><digit>[alnum].md` (`kickoff-b0.md`, `kickoff-s2b.md`)
   NOR a known sidecar (`kickoff[-<stage>].<kind>.md`, e.g. `kickoff-s4.decisions.md`; or `kickoff-amendments.md`).
   A name in this class is SILENTLY reclassified as a sidecar: principle 12 (trap citation),
   principle 40 (rigor label), principle 43 (host-verify) and BOTH arms of this hook skip it
   and report green having examined nothing.
   Fix: rename to the stage form if it carries worker instructions (and add the matching
   `.gitignore` exception so it reaches `staging`); otherwise rename to a sidecar form.
```

The second and third checks run together on a real kickoff file, and their failures
accumulate — one report, every breach. A kickoff that names the host commands the
worker's results will be verified with, and one that engages the traps rule with a
single T-number, trips both arms at once:

```bash
printf '%s\n' '# demo kickoff' 'Engages ai-laziness-traps but names only T1.' \
  > .claude/orchestrator-prompts/tmp-red-traps/kickoff.md
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-ckt-3",
  "tool_input":{"file_path":"'$PWD'/.claude/orchestrator-prompts/tmp-red-traps/kickoff.md"}}' \
  | bash .claude/hooks/check-kickoff-traps.sh
```

```text
❌ kickoff host-verify: .claude/orchestrator-prompts/tmp-red-traps/kickoff.md
❌ host-verify: .claude/orchestrator-prompts/tmp-red-traps/kickoff.md declares no `host-verify` contract block.
   A missing contract is a FAIL, not a pass — see .claude/rules/destination-environment-verification.md §1.
   Add the commands, or opt out: <!-- host-verify: none — <rationale, ≥20 chars> -->
❌ kickoff-traps: .claude/orchestrator-prompts/tmp-red-traps/kickoff.md engages ai-laziness-traps but enumerates only 1 distinct T-number(s) (floor: 3).
   §3 obligation #2: list the active traps, e.g. "Active traps for this R-phase: T1, T3, T7".
   Citing the rule without naming ≥3 traps = #trap-catalogue-blanket-reference.
```

Remove the demo directory when you are done. Both messages exit 2 on the
[channel](../../terms.md#channel) the model receives. The host-verify arm does not
re-implement its contract — it runs `scripts/host-verify.sh --list` on the file and
surfaces the runner's output verbatim, one implementation, one answer. And a kickoff
that never mentions the traps rule is not failed for it: the engagement guard leaves
that to review, on purpose.

## Evidence

- `.claude/hooks/check-kickoff-traps.sh:2` is the header the card's description row
  quotes: `# check-kickoff-traps.sh — PostToolUse gate — kickoff T-enumeration floor (ai-laziness-traps §3)`.
- Registration: `.claude/settings.json:132` reads `"matcher": "Edit|Write|MultiEdit"`
  with the command at line 136; the plugin registry registers it too
  (`plugin/hooks/hooks.json:108`).
- Engagement guard: line 216 greps for `ai-laziness-traps` in the file content — the
  comment (lines 214-215) says a kickoff that never engages is «principle-12 /
  review territory».
- The floor: line 219 counts distinct canonical T-numbers with
  `grep -oE '\bT[0-9]+\b' | sort -u`, and line 220 fails anything under 3; the
  violation names the anti-pattern `#trap-catalogue-blanket-reference` (lines 221-223).
  Domain labels (`T-Wave9-A`) are excluded from the count (comment lines 217-218).
- Filename classification: lines 100-114 — dotted and word-suffixed sidecars exit 0
  first (lines 102-104), the umbrella name is recognised (line 105), and line 107
  applies the stage regex `^kickoff-[a-z][0-9][a-z0-9]*\.md$`, which the comment
  (lines 96-99) says mirrors `packages/core/principles/kickoff-population.ts` so the
  two never disagree.
- The three-way split is arm 3, lines 126-149; the comment (lines 133-138) records the
  2026-09-02 measurement that made near-misses loud: a misnamed kickoff «landed in the
  sidecar bucket», principle 12 «reported GREEN having examined nothing».
- Host-verify arm: lines 174-211 — the runner is resolved by tier, a miss is loud when
  the rule file exists and correctly silent when the project never carried the rule
  (lines 180-197); line 205 runs `bash scripts/host-verify.sh --list "$ABS_PATH"` and
  non-zero output is surfaced verbatim (lines 207-210). The comment (lines 159-164)
  explains why: a parallel in-gate scan «was the source of bypasses B1-B8».
- Accumulation: violations are collected in an array (line 124, comment lines 121-123:
  «reporting one at a time costs the author a round-trip per rule») and reported
  together at lines 227-229.
- Scope matching is on the absolute path's suffix, never a repo-root-relative path —
  comment lines 88-94 record the linked-worktree silent-skip defect that suffix
  matching closes.
- Exit contract: `_adv_violation` (line 48) exits 2 on the model-visible channel; the
  header (lines 16-19) cites the live-verified finding. Shared prelude lines 37-47.
- Paired test: `packages/core/hooks/check-kickoff-traps.test.ts` — its header (lines
  1-13) states the contract: «❌ kickoff engages the rule + <3 distinct T-numbers →
  exit 2», «✅ kickoff that never mentions the rule → exit 0 (engagement guard)».
