---
title: destination-environment-verification rule
description: The rule that work is accepted where it will run, not where it was produced — kickoffs declare their acceptance commands in a host-verify block, and claims that a destination cannot do something need a probe, not a citation.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/destination-environment-verification.md
  - .agents/rules/00-rule-index.md
  - scripts/host-verify.sh
  - .agents/hooks/check-kickoff-traps.sh
  - packages/core/hooks/check-kickoff-traps.test.ts
  - packages/core/principles/43-kickoff-host-verify-presence.test.ts
  - .claude/orchestrator-prompts/getff-ai-site/kickoff-s1rf1a.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: host-verify-list-and-fail-closed, stack: repo, date: 2026-10-10, result: 17-commands-exit0-exit2 }
---

# destination-environment-verification rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-destination-environment-verification plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `destination-environment-verification` |
| kind | rule |
| ships-to | framework |
| description | the destination-environment verification discipline — §1 the positive contract and its grammar, §1b the negative direction (claims that the destination *cannot*), §2 the incident base, §3 why a green container run is not evidence, §4 anti-patterns, §5 promotion / retirement. |
| source | `.agents/rules/destination-environment-verification.md:14` |
| class | B |
| fires | kickoff authoring; accepting container work; a cannot-reach claim. |
| channels | paths:(1), edit-time inject |
<!-- getff:end section=F1-card-destination-environment-verification -->

<!-- vale on -->

## Explanation

Much of this framework's work is produced in one place (a container) and used in
another (the host machine). A test suite that passes in the container proves one
thing only: it passed in the container. The gap between those two worlds is not
hypothetical — the rule's incident table records a day when four separate jobs
reported green where they ran and failed where their results were used: a
missing binary, a path layout that differs between Linux and macOS, hooks
resolved from a worktree with no `node_modules`, and a timeout budget sized
against a machine three times faster than the one that enforces it.

This [rule](../../terms.md#rule) closes the gap with an artifact rather than
with diligence. Every kickoff must declare the commands whose result decides
acceptance, exactly as they will run on the host, inside a fenced block whose
info-string says `host-verify`. A runner turns that block into a command with an
exit code. The grammar lives in one place — both the contract parser and the
opt-out recogniser are the runner's, and the edit-time [gate](../../terms.md#gate)
shells out to the runner rather than re-implementing either.

The block is not optional, and neither is honesty about skipping it. A kickoff
with nothing to verify must say so with an explicit opt-out comment carrying a
reason of at least twenty characters. Silence fails closed — a missing contract
is an error, not a pass. That direction can be demonstrated in seconds with a
scratch file (removed after the demonstration):

```bash
printf '# scratch kickoff\n\nSome prose, no contract.\n' > /tmp/f1a-nocontract.md && bash scripts/host-verify.sh --list /tmp/f1a-nocontract.md; echo "EXIT:$?"; rm -f /tmp/f1a-nocontract.md && echo "scratch removed"
```

```text
❌ host-verify: /tmp/f1a-nocontract.md declares no `host-verify` contract block.
   A missing contract is a FAIL, not a pass — see .claude/rules/destination-environment-verification.md §1.
   Add the commands, or opt out: <!-- host-verify: none — <rationale, ≥20 chars> -->
EXIT:2
scratch removed
```

Exit 0 means every declared command passed on this host, or a valid opt-out was
found; 1 means one failed; 2 means no contract, an empty one, or a too-short
opt-out. This documentation batch's own governing kickoff carries a real
contract, and `--list` shows the runner parsing it — seventeen commands, from
file-existence checks to a JSON member-count assertion:

```bash
bash scripts/host-verify.sh --list .claude/orchestrator-prompts/getff-ai-site/kickoff-s1rf1a.md; echo "EXIT:$?"
```

```text
── host-verify: .claude/orchestrator-prompts/getff-ai-site/kickoff-s1rf1a.md
   host=Darwin  repo=/Users/art/.codex/worktrees/328b/rules-as-tests-aif
   • test -f .claude/orchestrator-prompts/getff-ai-site/kickoff-s1.md
   • test -f .claude/orchestrator-prompts/getff-ai-site/kickoff-s1.inventory.md
   • test -f docs/site/reference/F1.json
   • test -f docs/site/reference/B/dispatcher.md
   • test -f docs/site/reference/B/harvest.md
   • test -f docs/site/reference/B.md
   • test -f docs/site/guides/add-design-and-review-skills.md
   • test -f .claude/skills/docs-author/SKILL.md
   • test -f .claude/skills/docs-author/references/page-kinds.md
   • test -f agents/docs-form-auditor.md
   • test -f agents/claims-conformance-auditor.md
   • test -f agents/fidelity-auditor.md
   • test -f scripts/render-reference.mjs
   • test -f scripts/docs-check.mjs
   • test -f scripts/run-local-ci-sweep.sh
   • node --input-type=module -e "import {readFileSync} from 'node:fs'; const d=JSON.parse(readFileSync('docs/site/reference/F1.json')); if(d.members.length!==30) process.exit(1);"
   • bash scripts/check-ask-files.sh
EXIT:0
```

The rule has a second, opposite half. The first half gates claims of the form
"this passes"; the falsified claims in its incident base are mostly the other
direction — statements that a destination **cannot** do something («that tool is
NOT available in the container», «that path does not exist there»). Six such
claims are recorded, each later overturned by actually probing the
destination: the "missing" tool was installable and the registry reachable; the
"absent" directory held hundreds of session files. The rule's diagnosis is
precise: these are not carelessness about *whether* to cite — several of the
false claims cited something. They are carelessness about *what a citation can
establish*. A document that describes how the environment was assembled is not
a probe of the environment as it runs. So the obligation is: a claim that a
destination cannot do something carries the probe command (run against the live
destination) and the date, or an explicit "could not probe" statement.

The `class` row is `B`, and both halves are honest about their ceilings. The
contract's *existence* is enforced — an edit-time gate on kickoff files, plus a
CI principle test that holds the whole tracked kickoff family to
contract-or-opt-out. But nothing yet *forces the runner to be invoked* before
work is accepted: running it is still a choice, and the rule's promotion
section names the host-side pre-push hook as the reachable channel for closing
that half. The negative direction is deliberately prose: a candidate detector
was built and measured against real claims, caught four of six known defects,
and fired on 54 of 115 innocent lines in the wild — near 11% precision. The
rule file publishes that measurement as the reason it is not a
[gate](../../terms.md#gate).

What the rule does not do: it cannot stop you from accepting container-green
work without running the runner — that is the unclosed execution half, stated
plainly. And it does not police timing budgets written outside kickoffs; the
rule counts sixteen hard-coded budgets repo-wide that state a measurement
without naming a machine, none of them reachable by this rule's channels, and
records closing that population as a separate, not-yet-built change.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including the in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- The contract grammar (fenced `host-verify` block, declaration order,
  ≥20-character opt-out rationale): `.claude/rules/destination-environment-verification.md:21`
  to `:47`.
- Fail-closed exit codes (0/1/2) and "grammar lives in one place":
  `:51` to `:63`.
- The negative direction's obligation (probe against the live destination +
  date, or an explicit INCONCLUSIVE): `:75` to `:84`; "a primary-doc citation
  is not a probe": `:86` to `:94`; not-in-the-repo ≠ not-reachable: `:96`
  to `:99`.
- The four-incident positive table: `:114` to `:119` (§2 opens `:112`); the
  six-claim negative table: `:131` to `:138` (§2b opens `:125`).
- The class-`B` split (existence gated, execution not yet) and the §1b
  measurement (recall 4/6, 0/15 curated negatives, 54/115 wild firings):
  `:12` and `:244` to `:261`.
- The known population gap (16 unowned budgets, incl. a CI workflow line and a
  test's timing comment): `:232` to `:243`.
- The runner: `scripts/host-verify.sh` — `--list` mode at `:72`; its output
  above ran at this base (17 commands for the batch kickoff, exit 0; a
  contract-less scratch file, exit 2).
- The edit-time gate: `.claude/hooks/check-kickoff-traps.sh` — the arm-1
  rationale comment at `:93` and the delegation to the runner's grammar at
  `:159` and `:176` to `:183`; paired-negative test
  `packages/core/hooks/check-kickoff-traps.test.ts`.
- The CI population test:
  `packages/core/principles/43-kickoff-host-verify-presence.test.ts`.
- The index row grading this rule class `B` with channels
  `paths:(1), edit-time inject`: `.claude/rules/00-rule-index.md:19`.
