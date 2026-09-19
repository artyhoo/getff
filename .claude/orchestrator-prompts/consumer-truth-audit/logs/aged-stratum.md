# Task 6 — aged stratum (§3 T9): N/A record + host contract

## The N/A record (with probe evidence)

The kickoff's aged stratum — the DELIVERED column re-measured against
`/Users/art/code/timeliner` (installed 2026-08-07) — **cannot be measured in this
container**. The path is a macOS host path; this census runs in a Linux container.

Probe (quoted from `logs/entry-verification.md` §Check 4, 2026-09-08T18:13Z):

```
$ ls -la /Users/art/code/timeliner/.claude 2>&1
ls: cannot access '/Users/art/code/timeliner/.claude': No such file or directory
--- exit=2
```

Per the plan's decision (recorded in the plan §Research Context, decision 2) and
kickoff §7 evidence discipline: the stratum is **recorded N/A with this probe
evidence, never approximated and never faked** — approximating it with a second
fresh install would measure the wrong stratum and silently satisfy T9's letter
while violating its purpose.

## The host contract (what closes the gap)

`host-verify-aged.sh` (emitted next to this log, in the umbrella dir) measures the
aged stratum on the host that owns the checkout:

- read-only: enumerates skills / agents / hooks / rules-dir presence / workflows /
  scripts / `.ai-factory/` / `.mcp.json` / settings registrations from the aged tree;
- emits `aged-inventory.json`;
- never runs `install.sh` there, never writes inside the aged project;
- exit 3 = absent (the container case), exit 4 = present but not an install.

## 3-bucket classification template (to apply when the host runs it)

Each delta aged-vs-fresh is classified into exactly one of the kickoff §3 buckets:

| bucket | test | meaning |
|---|---|---|
| `shipped-since` | absent in aged, `delivered=true` in fresh | the artefact SHIPPED after 2026-08-07; the aged install is stale (expected for the majority — the install predates the profile system's contour surface) |
| `never-shipped` | absent in aged AND absent from all three fresh profiles | the artefact reaches nobody — the strongest census verdict class |
| `consumer-authored` | present in aged, absent from fresh census | theirs, not ours — informational; never a deletion basis by itself |

Predicted-dominant bucket (stated in advance, falsifiable by the host run):
`shipped-since` should dominate the skills class — the aged install (2026-08-07)
predates the beta-delivery-ux contour/operator skill split that this census
measured (env +5 skills, factory +5 skills). If the host run instead shows aged
skills ⊇ fresh factory skills, that prediction is wrong and the install-history
assumption needs revisiting.

## Coverage impact (T14 honesty)

Aged stratum coverage: **0 artefacts / 0 measured of the aged population — N/A,
not clean.** Every census row's `aged_install` field therefore carries
`"n/a — host-scoped (see host-verify-aged.sh)"` rather than a value, and the
report's coverage section states this as an unreached stratum, not a completed one.
