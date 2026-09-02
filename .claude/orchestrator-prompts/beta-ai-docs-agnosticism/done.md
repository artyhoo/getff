# beta-ai-docs-agnosticism — DONE

- Final PR: #1569
- Closed: 2026-09-02
- Summary: AI-facing docs made harness-agnostic and discoverable — AGENTS.md layer + AI Usage Guide (S1), a skills harness-posture census (S2), self-generating doc sections (S3), and Context7 indexing + deterministic re-index (S4).

## Stages

| Stage | PR | Squash | Head branch |
|---|---|---|---|
| S1 — AGENTS.md layer + AI Usage Guide (C1) | #1311 | `744bb06e35` | `beta-c-s1-agents-layer` |
| S1b — Phase -1 BLOCKER fixes | #1329 | `501af27ea5` | `beta-c-s1b-phase-minus1-fixes` |
| S1c — refresh-claim repair | #1332 | `ebb974afde` | `beta-c-s1c-refresh-claim-repair` |
| S2 — skills agnosticism probe (C3) | #1552 | `ee0ccfe593` | `feature/beta-ai-docs-agnosticism-5bb3da-s17` |
| S3 — self-generating docs sweep (C5) | #1550 | `7534fd9a48` | `feature/beta-ai-docs-agnosticism-fc864f` |
| S4 — discoverability (C4) | #1569 | `1d382d4783` | `beta-c-s4-discoverability` |

**Read the Head-branch column before re-running any head-name gate.** S2 and S3 were dispatched
through the aif runtime, which mints `feature/<slug>-<id>` branch names with no override in
`dispatch.ts` or `harvest.ts`. The meta-launch Stage-2→3 entry gate greps the kickoff's
*predicted* head names (`beta-c-s2-skills-probe`, `beta-c-s3-selfgen-docs`), so
`gh pr list --search "is:merged head:beta-c-s2-skills-probe base:staging"` returns `[]` for
both stages even though both landed. The gate was satisfied by substance instead —
`git merge-base --is-ancestor 7534fd9a48 origin/staging` and the same for `ee0ccfe593` — and
S4 gated on PR NUMBERS rather than head names (night-coordinator resolution, 2026-09-02). An
empty grep here means the naming mismatch, never an unlanded stage. S4's own head IS the
literal `beta-c-s4-discoverability` the closure gate expects.

## Owner-parked residue (carried out of the umbrella, nothing applied)

From S3 (#1550):

- **`aif-version` permanently-empty schema field** — 6 tracked occurrences, not 4; the hook
  never reads it. Option A keep / Option B remove (3 shipped files plus twin edits). Operator
  fork, unresolved.
- **`agents/claims-conformance-auditor.md` ships to consumers by default** — it is absent from
  the `setup.d/20-agents.sh` skip-list, unlike `backward-sweep-auditor`. Advisor verdict was
  **B — add to the skip-list as a morning follow-up PR**; the skip-list has an `install.sh` twin
  guarded by principle 21, both outside S3's permitted files. Decision package: `kickoff-s3.decisions.md` (#1547).
- **zcode-doctrine table scope (owner proposal P1)** — widen the P1 renderer with a networked
  or heuristic source, versus stays-prose with an owner and a trigger. Maintainer picks at P1 sign-off.
- **Owner-gated proposals P1/P2/P3** — flagged for sign-off, nothing applied.

From S2 (#1552):

- **A shipped line-number citation drifted** — `packages/core/templates/shared/tier-home.md`
  cites `night-mode/SKILL.md:15`; S2's two-line declaration insert moved that line to `:17`.
  tier-home is umbrella-A S3 consumer payload, outside S2's permitted files, so it is parked for
  its owner: a one-line re-point plus a baseline regen.
- **Census population boundary** — `plugin/skills/*/SKILL.md` sits outside the census and that
  exclusion is not yet recorded in the probe header, unlike the `skills/` and `skill-context/`
  exclusions. Follow-up header line.

From S4 (#1569):

- **Both maintainer-only legs are DONE (operator, 2026-09-02T05:44Z), and the umbrella AC «the
  Action runs green» is MET at the workflow level.** S4 shipped with them outstanding and #1569
  labelled the AC INCONCLUSIVE; that label no longer holds. Measured, not asserted:
  `gh secret list --repo artyhoo/getff` shows `CONTEXT7_API_KEY` created `2026-09-02T05:44:03Z`,
  and run **33594897822 attempt 2** on `staging` concluded `success` at `05:45:30Z` carrying the
  service's own response — `{"message":"Refresh started successfully"}` followed by
  `Refresh requested for /artyhoo/getff.` A 2xx from `context7.com/api/v1/refresh` also confirms
  the `add-library` submission landed, so `.github/workflows/context7-refresh.yml` no longer
  fails by design. The run log echoes the whole `run:` block and contains no secret value, so the
  `env:` indirection held up live.
- **Residual, still open: DISCOVERABILITY — `INCONCLUSIVE` until someone quotes a hit.** A
  refresh being *accepted* is not the same as the index being *built*. As of 2026-09-02T05:52Z,
  `resolve-library-id` for both `getff` and `artyhoo/getff` still returns unrelated libraries and
  no `/artyhoo/getff`. Upstream describes refresh as taking minutes and the surveyed third-party
  action ships a 30-minute default timeout, so this is expected latency rather than a fault. To
  close it, re-run the probe and quote the output:

  ```text
  context7 MCP → resolve-library-id(libraryName: "getff")
  ```

  It is closed when that returns `/artyhoo/getff`, and only then. Do not mark the stage's §0 goal
  («an AI harness that has never seen this repo can find its documentation») met on the green
  workflow alone — that is exactly the T-BADC-S4-A shape, «external-service green by assertion».
- **The Phase-2 index-branch flip is owed to the spec §8 integration checklist as a PROPOSAL**,
  not applied — `kickoff-s4.decisions.md` Decision 1. Two cold rounds disagreed on whether it is
  a two-place or a three-place change; it depends on whether the promote also makes `main` the
  default branch, which nobody has decided. Both readings are written into the S4 PR body.
- **Three ungated couplings**, each needing a gate in a file S4 was not permitted to touch: a
  push-only workflow can declare `# required-context: yes` and principle 37 will not see it; the
  `rules` array is a hand-maintained selection of 9 from a generated population of 29 with no
  anti-drift test; and `context7.json`'s `branch` is coupled to the workflow trigger by a comment
  rather than an assertion.
- **`README.md` is the tree's stale outlier on toolchain coverage** — it names two lanes and
  states no Rust rule-pack exists, contradicted by `packages/core/backends/cargo/` and by
  `install.sh`. README is maintainer-owned; surfaced, not edited.
- **`plugin/skills/getff/*` is an ungenerated stale fork** — `scripts/generate-plugin-twins.sh`
  covers `plugin/hooks/` and `plugin/agents/` only, so the shipped skill copy still calls
  `/aif-verify` the pre-PR gate. Excluded from the Context7 index; the shipped staleness itself
  is a sibling-surface gap for a later stage.
- **`scripts/run-local-ci-sweep.sh` discards a failing gate's output**, printing only the gate
  name. Diagnosing S4's three pre-existing reds meant re-running each gate by hand.
