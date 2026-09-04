# pre-merge-carrier-meta-launch — DONE

- Final PR: #1475
- Closed: 2026-08-18
- Summary: the S0 dispatch this meta-launch record planned was executed and merged; the umbrella it launched is closed at [`../pre-merge-carrier/done.md`](../pre-merge-carrier/done.md).

## Dispatch outcome vs the launch table

The §2 launch table called one sub-wave — S0, R-phase, Mode A inline, single stage, volume L. That is what ran, and its §4 ordered obligations were all discharged: prior-art consult first (SSOT rows #259-#263), spec authored with sections (a)-(g), falsifiers carried verbatim, one docs-only PR to staging with the §4b §1.7 blocks, and the T19 own cold review before handoff.

Its §3 stage gate for admitting the build umbrella now reads green — with the caveat the gate itself flagged: the planned head branch name `design/pre-merge-carrier` happened to be the real one, but the gate text is right that a plan-time branch name must be re-derived rather than trusted.

## What this record got wrong, worth knowing

- **§2a fog-of-war item 1 undercounted the lanes.** It carried the umbrella kickoff's «two template roots» framing; there are three roots and seven shipped lanes. The three UI presets (react-next / react-spa / react-native) ship `github-actions-ci-ui.yml` as the consumer's own `ci.yml` (`setup.d/40-configs.sh:399/414/437`). The cold review caught it; the spec's §b inventories all seven.
- **§2a item 3 asked whether a shipped waiter exists — the measured answer is no** (0 files across the shipped tree read the checks API), which turns kickoff §1 row 2(d)'s conditional into a contradiction with §2. Recorded as `KICKOFF-AMBIGUOUS` and resolved toward §2, explicitly.
- **§4c's honest fit-caveat was right.** It predicted a design stage with mandatory `DECISION-NEEDED` forks puts the autonomous park contract under maximum load and recommended the paste tab. Three forks are indeed open (spec §i) and are the operator's to answer.

## Next

Not this record's scope: the build umbrella from the spec's §(g) (B1 / B2 / B3). Its §7 Phase -1 cold-review before admission stays mandatory, and F1 + F2 must be answered before B1 can be dispatched.
