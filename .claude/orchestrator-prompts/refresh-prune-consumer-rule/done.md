# refresh-prune-consumer-rule — DONE

- Final PR: #1548
- Closed: 2026-09-02
- Summary: `install.sh --refresh` no longer deletes consumer-authored `eslint-rules-local/*.{ts,mjs,d.ts}` rules — the issue-882 stale-rule prune in `generate_eslint_barrel` now fires only for framework-attributable basenames (the `_fw_basenames` predicate hoisted above the prune, RP-1), the issue-1481 kept-entry loop skips a basename whose `.ts` is on disk so a preserved rule is emitted exactly once (RP-1b), and arm (a2) of the existing `tests/install-sh/eslint-barrel-preserve-consumer.test.sh` pins byte-identity + exactly-once + barrel loadability (RP-3); issue 1519 (the one open beta phase-1 BLOCKER) auto-closed on merge.

## What landed

- **P1 #1548** (squash `ff686ce77feb1b2bab16c2ccad2b2c2d2398f19e`, merged 2026-09-02) — single stage, one commit from aif task `d80087a9-5f04-4db7-88bb-da746f24365b` (branch `feature/refresh-prune-consumer-rule-d80087`, container HEAD `2118e70149`). Cold fidelity audit Round 1 = GO with a 7-row watch-list (W-1..W-7 all CLEAN); kickoff §5 `host-verify` block green on the host, including `shellcheck setup.d/lib.sh` in the CI form (`--exclude=SC2034,SC2016,SC2317`), which the container could not run at all. The issue's own repro (basename `no-inline-rgba-in-tsx`) replayed on the patched tree: trio byte-identical after refresh, barrel import + rules-map lines each counted exactly once, barrel loads. RED-before-GREEN observed in BOTH defect modes (unpatched → trio deleted, `PASS=13 FAIL=5`; RP-1 alone → counts = 2 + `barrel import failed`) and the paired negative (prune disabled → arm (c) RED, #882 regressed) — all pasted verbatim in the PR body.
- **Kickoff PRs**: #1527 (original) + #1543 (Phase -1 revision that added RP-1b after the cold review reproduced the duplicate-import barrel kill, re-pointed RP-3 at the existing test file, and pinned the exactly-once assert to `grep -c … -eq 1`).

## Routed onward / open residue (named, not elided)

- **Accepted edge (kickoff T19, stated not solved):** a consumer basename that collides with a framework rule of ANOTHER stack is framework-attributable by construction and IS still pruned — the #882 case.
- **Observation, not a fork:** a consumer `.ts` with NO sibling `.mjs` now survives the prune but the generation loops emit a barrel entry for it → dead import → barrel dead. Loud and recoverable (vs the silent deletion this umbrella fixed); population was scoped by the kickoff to the `.ts+.mjs+.d.ts` layout the installer produces. Worth its own small task if a consumer ever hits it.
- **Pre-existing host-lane reds, not this umbrella's:** on the operator host `tests/install-sh/byte-identical.test.sh` (snapshot cells `cargo/greenfield` + `cargo/brownfield-clippy` differ by `.ai-factory/refresh-baseline.json`) and `tests/install-sh/cargo-entry-lane.test.sh` (clippy self-check does not fire) fail identically on a detached `origin/staging` worktree; CI is green on the same tree. Recorded so the next harvest does not re-classify them as branch-introduced.
- `docs/superpowers/plans/2026-07-03-eslint-barrel-stack-prune.md:261` still quotes the OLD prune body — it is a dated design-history plan and was deliberately left untouched (frozen artefact class).
