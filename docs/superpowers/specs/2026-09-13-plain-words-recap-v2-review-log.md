# Plain-words recap v2 — cold review log (rounds 1-2)

> **Authoritative for:** the per-finding dispositions of the `/arch` §2 cold reviews of
> [2026-09-13-plain-words-recap-v2-design.md](2026-09-13-plain-words-recap-v2-design.md) — split
> out of the spec's Changelog under the 600-line gate (precedent:
> [harmonization-round3-handoff](2026-08-18-harmonization-round3-handoff.md)).
> **NOT authoritative for:** the design itself — the spec; project goal —
> [README.md#why-this-exists](../../../README.md#why-this-exists).

Disposition vocabulary per [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md):
`ACCEPTED | DISSOLVED | ESCALATED | FIXED`. Seats: top-down TD, bottom-up BU (mid tier, artifact
paths only). Reports: `top-down[-r2]-plain-words-recap-v2.md` / `bottom-up[-r2]-plain-words-recap-v2.md`
in the review session's scratchpad.

## Round 2 — 2026-09-13 (TD REVISE, BU REVISE; round cap reached)

Round-1 closure as judged cold: TD 11/15 CLOSED, PARTIAL F2 / F3 / F7 / F9 / F15; BU 11/14
CLOSED, PARTIAL F2 / F4 / F7, 26/26 line citations EXACT at `b75b697b11c`. Every PARTIAL is
closed by a round-2 disposition below.

- TD-N1 + BU-N1 MAJOR — gate site names two disjoint populations; `:625` is a silent exit and the
  matrix inputs are computed 150 lines below — **FIXED** (D-A «what the gate is»: section checker,
  `_eot_turn_shape()` at both sites, no reorder; R-16).
- TD-N2 + BU-N5 MAJOR/MINOR — ZCode has no `stop_hook_active`, «retry budget one» false; ZCode arm
  - terminal paths unenumerated; twin unmentioned — **FIXED** (D-A retry bound = `_zcb_sha` shape;
    exemption set completed; twin in slice 1; facts; R-16).
- TD-N3 + BU-N6 + TD-N7b MAJOR/MINOR — three «от тебя» grammars; pack functions cannot seed a
  regex; P-7 rendering lacks the R-3 trace — **FIXED** (D-B scope = last line of the block, scalars
  `AIF_EOT_FOR_YOU_*`; D-C §5 body-only; D-D closing line = block §5; P-7 amended; R-17).
- BU-N2 MAJOR — «byte-identical unarmed» contradicts slice 1's pack edits — **FIXED** as two axes
  (rejection flag-gated, text unconditional, goldens regenerated once; R-15, author, reversible).
- BU-N3 MAJOR — installer has no env writer for `--full` arming — **FIXED** (D-A names the
  `FULL`-gated jq step in `10-skills.sh` mirroring `register-handoff-gate.sh:161-174`, baselines,
  `gh-934` arm); whether arming ships at all is **ESCALATED** with TD-N8 (R-14).
- TD-N4 MAJOR — R-7 corpus run has no reader under D5b — **FIXED** (snapshot arm in principle 29's
  test, NEW fixture; D5b list no longer names principles, owner = meta-tests CI).
- TD-N5 MINOR — D-H11 row still «ADOPT as-is» — **FIXED** (slice 3 amends `:138`).
- TD-N6 MINOR — `--full` is the dev-deps axis, hook ships at every profile — **ACCEPTED**, recorded
  in the facts; R-1's falsifier already covers the profile reading.
- TD-N7a / N7c MINOR — card §0 duplicates block §1 on single-fork turns; story turn exemption
  unstated — **FIXED** (D-A block-vs-round; exemption set).
- BU-N4 MINOR — nine → eleven «operator GO» sites, `:307` is the file's own summary — **FIXED** (D5c).
- BU collisions MINOR — `end-of-turn-reminder.test.ts:691/1009/1230` + `gh-934:82` false-green
  alternation unnamed — **FIXED** (D-G, slice 4).
- TD-N8 ESCALATED — arm a blocking gate on consumer turns from operator-only calibration? —
  **ESCALATED → R-14 operator-fork** (asked with the round-cap fork).
- TD checklist residue: R-11 empty falsifier — **FIXED**.

## Round 1 — 2026-09-13 (TD REVISE, BU REVISE)

Dispositions (one per finding):
TD-F1 BLOCKER D5b carve-out — **FIXED** (D5b, R-2, operator Q2);
TD-F2 exemption set / SDK guard — **FIXED** (D-A);
TD-F3 card twice on round turns — **FIXED** (D-A block-vs-round, R-13);
TD-F4 `_Avoid_` inverted — **FIXED** (D-F ADAPT, R-4);
TD-F5 «ничего» form-only — **FIXED** (D-B trace, R-3, operator Q3);
TD-F6 shipped axis absent — **FIXED** (D-A kill switch + `--full` arming, R-1, P-9);
TD-F7 no kill switch / precedence — **FIXED** (D-A);
TD-F8 register not closed — **FIXED** (vocabulary + rows R-8…R-12);
TD-F9 principle 29 narrowing unmeasured — **FIXED** (D-H (d) precondition, R-7);
TD-F10 «sessions scanned» — **FIXED** (table);
TD-F11 cap inert — **ACCEPTED**, recorded as a regression guard (D-A);
TD-F12 rename scope — **FIXED** (D-H (c) LIVE / FROZEN);
TD-F13 measurement provenance — **FIXED** (slice 0);
TD-F14 `CONTEXT.md` authority header — **FIXED** (D-F);
TD-F15 ESCALATED consumer premise — **ESCALATED → closed by the operator** (Q1, P-9, R-1).
BU-F1 base SHA false — **FIXED** (staging merged forward, facts re-anchored at `b75b697b11c`);
BU-F2 gate site unreachable — **FIXED** (D-A gate site);
BU-F3 `emit-story-prompt.test.ts` — **FIXED** (D-G, seams);
BU-F4 story marker literal — **FIXED** (D-G, R-5);
BU-F5 principle 42 + D-H11 — **FIXED** (D-F pointer direction reversed);
BU-F6 pipeline/SKILL.md at 600 — **FIXED** (net-zero rename, list in the rule file);
BU-F7 D5c nine sites — **FIXED** (R-6);
BU-F8 parity probe — **FIXED** (D-F);
BU-F9 RU-only values — **FIXED** (D-B both packs);
BU-F10 glossary hook unarmed — **FIXED** (`register-glossary-hook.sh`, D-E);
BU-F11 baselines moved by the glossary migration — **DISSOLVED** (glossary no longer moves);
BU-F12 / TD-F10 same population label — **FIXED**;
BU-F13 33→34, 1571→1607 — **FIXED** (table + fact);
BU-F14 636/101 not re-derivable — **FIXED** (slice 0) + Consequences reworded (upper bound).
Cold-seat drill-downs recorded: measure script re-run (TD-1, BU), 636/101 source read (TD-2),
`/wait-what` + `domain-modeling` upstream bodies opened (TD-3, BU-1/2).

- 2026-09-13 — draft after the design session (Q1-Q14 closed, two research reports, two
  transcript measurements). Recorded, not resolved: (i) operator recollection of «a skill
  recently implemented in GLM» for running tested scripts from any place — searched repo
  skills, global skills and commands, all plugin caches, aif-handoff skills, all git branches
  since 2026-09-05, repo text, merged/open PRs: NOT FOUND; aif queue unreachable from the Mac;
  ask the operator at implementation (D-E is skill-agnostic); (ii) Stop hook fires twice
  (project hook + plugin twin `run-hook.cmd`) — out of scope, surfaced; (iii) worktree
  pre-commit blocks merge-forward on inherited lint debt — surfaced; (iv) UNVERIFIED: the
  «term (explanation)» form is countable; `/wait-what` answers in Russian; classifier block on
  `gh pr merge --squash` reproduces; subagent + worktree write bug #39886 on current CC.
