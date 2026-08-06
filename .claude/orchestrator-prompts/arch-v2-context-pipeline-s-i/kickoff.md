<!-- scope: stage-scoped dispatch input — S-I of the arch-v2-context-pipeline umbrella (doctor-surfaced context-economy residue, operator-invited 2026-08-06). HOST-BOUND stage like S-H: NO bridge-profile marker — executed by a host CC session holding this kickoff (container lacks ~/.claude, /context, live hook surfaces). Seat: MID tier (Opus today — operator directive 2026-08-06), NOT the GLM executor tier: description authoring is routing-load-bearing judgment (skill-description-quality class), and the session MUST load its skill-authoring toolkit before P-I1/P-I2 — `superpowers:writing-skills` + the repo `ai-doc` skill; `skill-description-quality.md` fires edit-time via paths. The remaining items (P-I3..P-I6, P-I8) are mechanical host-config work the same session carries. -->

# S-I — doctor-surfaced context-economy residue (skills listing + host config debt)

> **Provenance:** operator `/doctor` scan 2026-08-06 (50 sessions / 5 days), cross-checked and
> recorded in `docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md` §8; the §8
> rev-4 disposition («deferred out of umbrella») was SUPERSEDED same day by explicit operator
> invitation («умбрелла всё берёт» — CLAUDE.md «PR strategy» explicit-invitation exception).
> **Independent of S-G/S-E/S-H** — different budget surface (skills listing ≠ rules resident
> set); concurrent-allowed with every remaining stage. Re-measure AFTER S-G lands is preferred
> but NOT a gate (only the §8-recorded baseline note changes).

## §0 Problem (measured)

The harness's skill-listing budget (~2k tokens ≈ 1% window) is exceeded ~4.5×: names +
descriptions across all sources ≈ 9.1k est. tokens (doctor, disk-side). Over budget the
harness truncates descriptions → inter-skill routing degrades for EVERY session. Controllable
shares: project skills `description:` total **10,719 B** (host-measured 2026-08-06, awk over
`.claude/skills/*/SKILL.md` frontmatter; top: `arch` 1,486 B, `self-reflection` 969 B,
`aif-doctor` 965 B, `pipeline` 907 B); user skills ~0.8k tokens. App-bundled plugin share
(~6.2k) is NOT settings-controllable per the doctor scan — P-I5 probes the one uncertain edge.
Plus host config debt the same scan surfaced: two duplicate keys in
`.claude/settings.local.json`, a dead 5.5 MB marketplace backup, and a PostToolUse:Bash hook
blocking the loop at 3.9 s median when it fires.

## §1 Work items

**P-I1 — trim project skill `description:` fields (repo, committable).**
Load `superpowers:writing-skills` and the repo `ai-doc` skill FIRST — the trim is a
skill-authoring pass under their discipline, not a mechanical byte cut.
For each of the 16 `.claude/skills/*/SKILL.md`: keep the routing-load-bearing content —
trigger keyword lists (RU + EN), the when-to-use / when-NOT clause — drop narrative prose,
duplicated SSOT references, and anything restating the body. Discipline:
`.claude/rules/skill-description-quality.md` (fires edit-time via `paths:`). Target: total
≤ 5,000 B (from 10,719), no single description > 500 B unless the overage is justified in the
PR body per skill. MUST preserve: every distinct trigger phrase class present before the trim
(inventory in P-I7). If any trimmed skill is install-shipped, regenerate install fingerprints
(`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) in the same PR — the agents/*.md
fingerprint incident (8/13 baselines red) is the precedent.

**P-I2 — trim user skill descriptions (host, `~/.claude/skills/*/SKILL.md`).**
Same discipline, same target ratio, applied to `orchestrator`, `ai-docs`, `design-compare`,
`native-css-responsive`. Host-side edit, no repo commit; record before/after bytes in the
stage report.

**P-I3 — `settings.local.json` dedupe (host). — EXECUTED 2026-08-06 in the /arch session
(Actions-outage window); stage VERIFIES only.** What ran: conditional sweep over all 21
worktree copies — `claudeMdExcludes` dropped ONLY where the worktree's committed
`.claude/settings.json` already carries the 7-entry `**/` glob form (3 sites: repo root,
`doctor-command-fde4cf`, `review-pr-pipeline-restore-0c3caf`); the duplicate
`inject-memory-codification.sh` PostToolUse:Write registration removed in 20 copies
(committed registration is the survivor); `feat-prune-worktrees` left untouched (committed
file not ready). Backup: session scratchpad `settings-local-backup-*.tar.gz`. Stage
obligation: re-run the census (`md5` over worktree copies), confirm one-time hook fire on a
live Write, and re-apply the conditional drop to any worktree whose branch has since picked
up the `**/` committed form.

**P-I4 — `skillOverrides` off-switches (host, `~/.claude/settings.json`). — EXECUTED
2026-08-06 in the /arch session; stage VERIFIES only.** `"uniq-rewrite": "off"` added next to
the pre-existing `"pr-template-multi-phase": "off"` (0 uses / 243 launches; verbatim duplicate
of `anthropic-skills:uniq-rewrite`). Backup: scratchpad `user-settings-backup.json`. Stage
obligation: confirm the skill is absent from a fresh session's listing.

**P-I5 — plugin-skill suppression probe (host, empirical).**
Determine EMPIRICALLY whether plugin-namespaced skills obey `skillOverrides` (e.g.
`"anthropic-skills:uniq-rewrite": "off"`) or any other user-reachable switch: set the
override, start a fresh `claude -p` session, inspect the skill listing for the namespaced
entry. Report the verdict either way with the observed listing excerpt. If suppression works:
list the zero-use plugin skills as candidates in the stage report — the OPERATOR picks which
to disable (their machine, their listing); do NOT bulk-disable autonomously. If not: record
the negative with the probe evidence; the ~6.2k plugin share is then formally out of
user-settings reach (upstream-tool limitation, not our gap).

**P-I6 — `post-api-push-autosync.sh` latency fix (host, `~/.claude/hooks/`).**
Blocking network at 3.9 s median / 7.5 s max per fired call. Fix = deferred-report pattern,
NOT plain backgrounding: move each path's network body to a detached background job writing
its outcome line to a stamp-adjacent report file (`/tmp/aif-autosync.report`); the NEXT hook
invocation (any Bash call) emits and truncates any pending report lines FIRST, so both loud
warnings (`DIVERGED`, `ff failed — ref NOT moved`) still reach the active session model, one
turn late. Plain `&` without the report relay would orphan those warnings —
`#warning-nobody-reads` (`attention-is-not-a-mechanism.md` §1); the DIVERGED line's named
consumer is the session model (hook comment, 2026-07-10 31-commit-drift incident). Keep
`AIFAUTOSYNC_DEBUG=1` fully synchronous and network-free — `post-api-push-autosync.test.sh`
must stay green unmodified; gate logic (all greps, worktree checks) stays synchronous.

**P-I7 — trigger-vocabulary inventory (repo, the P-I1/P-I2 acceptance instrument).**
Before trimming: extract per-skill trigger-phrase inventory (the comma/dash-separated trigger
lists) to `docs/superpowers/specs/2026-08-06-skill-trigger-inventory.md`. After trimming:
re-extract, diff — the diff MUST show only prose/duplicate removals, zero lost trigger
classes. This file is the reviewable evidence, not a claim.

**P-I8 — disk residue sweep (host, trivial).**
Delete `~/.claude/plugins/marketplaces/claude-plugins-official.bak` (5.5 MB, unregistered in
`known_marketplaces.json`) and the six `~/.claude/plugins/blocklist.json.*.tmp` files. Verify
unregistered-ness first (`jq . ~/.claude/plugins/known_marketplaces.json | grep -c official.bak`
→ 0) — deletion is the irreversible branch (T17): `tar` the .bak to `~/.claude/trash-$(date +%F).tar.gz`
before `rm`, note the path in the report.

## §2 Environment (destination-environment-verification)

HOST stage. Requires: writable `~/.claude` (settings, skills, hooks, plugins), a repo worktree
on a fresh branch off staging for P-I1/P-I7, `gh` authenticated, ability to launch a probe
`claude -p` session (P-I5), and a live re-measure channel (`/context` in an interactive
session, or the doctor's disk-side estimator re-run) for the before/after. NOT dispatchable
via aif marker — the container has none of these surfaces (same rationale as S-H, spec §1.6
FORK C).

## §3 Acceptance

1. Deterministic: project `description:` total ≤ 5,000 B (`awk` one-liner in §0, run in CI-less
   host shell, output quoted in PR body); trigger-inventory diff clean (P-I7 file committed).
2. Deterministic: `post-api-push-autosync.test.sh` green, unmodified; one live fired call
   measured < 500 ms wall (time the hook body with the network detached).
3. Report-graded: P-I5 verdict with probe evidence; P-I3/P-I4/P-I8 before/after excerpts.
4. Re-measure: skill-listing estimate re-run after P-I1/P-I2/P-I4 (+P-I5 if it lands);
   expected recovery ≥ 1.5k est. tokens (project ~1.4k + user share); record actual vs
   expected — a shortfall is a finding, not a silent pass (T14).

## §3.5 Host-verify contract

```bash host-verify
test "$(for f in .claude/skills/*/SKILL.md; do awk '/^description:/{flag=1} flag{print} /^---$/ && NR>1{exit}' "$f"; done | wc -c | tr -d ' ')" -le 5000
test -f docs/superpowers/specs/2026-08-06-skill-trigger-inventory.md
```

## §4 AI traps (per `.claude/rules/ai-laziness-traps.md` §3)

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).
Active traps for this R-phase: T1, T3, T5, T14, T15, T17, T19, T20.
Instantiation: T1/T3 — every byte number re-measured at execution, not carried from this
kickoff; T5 — host stage editing repo files: keep P-I1/P-I7 in the PR, everything else
host-only, no drive-by repo edits; T14 — a clean trigger-diff on a shallow inventory is
«coverage insufficient», not «clean»; T15 — this kickoff's own description-trim discipline
applies to any skill the stage itself touches; T17 — P-I8 tar-before-rm, P-I1 trims are
git-reversible; T19 — own cold re-read of the trimmed descriptions before handoff;
T20 — P-I5 verdict only with probe output quoted.

Domain-specific:
- **T-SI-A** — trimming descriptions by byte count while destroying trigger vocabulary: the
  byte target passes, routing silently dies. Counter: P-I7 inventory diff is the acceptance
  instrument; byte total alone proves nothing.
- **T-SI-B** — assuming plugin-namespaced skills obey `skillOverrides` because user skills do
  (`#pattern-matching-on-name` on a config key). Counter: P-I5 is an empirical probe with
  quoted listing output; no verdict without it.

## §5 Descopes (recorded, per plan-completeness)

- Merging/consolidating sibling skills (e.g. rule-research + rule-tests) — product-surface
  change requiring its own /arch + BFR pass; NOT this stage.
- App-bundled plugin listing weight beyond the P-I5 probe — upstream surface.
- Any `.claude/settings.json` (committed) edit — none needed; P-I3 only touches the local file.
- Umbrella-wide re-baseline of S-E's budget gate — S-E owns its meter; S-I only reports its
  own before/after.
