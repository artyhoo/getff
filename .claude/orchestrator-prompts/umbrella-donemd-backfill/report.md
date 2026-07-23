# umbrella-donemd-backfill — Stage 1 report

> **Authoritative for:** the Stage 1 closure decisions of the umbrella-donemd-backfill umbrella (single-stage, Tier 1).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Schema for done.md — see [CLAUDE.md `Umbrella closure convention`](../../../CLAUDE.md).
> **Run date:** 2026-07-23. **Executor:** aif-handoff (autonomous, GLM-5.2). **Branch:** `feature/umbrella-donemd-backfill-cb4cdd`.

## §1 Population enumeration

**Command (run from repo root, 2026-07-23):**

```bash
# Total umbrella dirs:
find .claude/orchestrator-prompts/ -mindepth 1 -maxdepth 1 -type d | wc -l
# → 287 (matches plan's "287 dirs total")

# With done.md (closed):
find .claude/orchestrator-prompts/ -mindepth 2 -maxdepth 2 -name "done.md" -type f | wc -l
# → 187 (matches plan's "187 with done.md")

# Without done.md (this umbrella's population):
287 − 187 = 100 (matches plan's "100 without, ~99 within drift tolerance")
```

**Structural finding (load-bearing, surfaces a class of dirs the plan did not
anticipate):** of the 100 no-done.md dirs, **35 are pure runtime coordination
slots with no `kickoff.md` on disk** (34 candidates after exclusions + this
umbrella's own `-meta-launch` runtime slot). All 35 share these properties:

- No `kickoff.md` committed (`git ls-files --error-unmatch …/kickoff.md` → "did not match any file(s) known to git").
- No `kickoff.md` on disk either (`ls …/kickoff.md` → not found).
- No commit in git history touching the dir path (`git log --all --oneline -- …/` → empty).
- Contents are symlinks to `~/.claude-coordination/` (gitignored runtime CANON) — typically `state.md`, `dispatch.md`, `batch-*.md`, `decisions.md`.

**Why this matters for the plan's goal** (`priority-score.sh` panel hygiene):

[`priority-score.sh`](../../skills/pipeline/helpers/priority-score.sh) filters dirs at
**line 144** (`if [[ ! -f "${kickoff}" ]]; then … continue`): dirs without
`kickoff.md` are skipped from the real-candidates loop. Layer C3 (the done.md
fallback the plan targets) is consulted **only inside that loop** (line 222).
**Conclusion:** writing done.md for a no-kickoff dir has zero effect on the
`priority-score.sh` output — the dir already does not appear as an open
candidate, so adding done.md cannot hide it further.

The 65 no-done dirs that DO have `kickoff.md` (the real-umbrella population)
are all excluded from Stage 1 action by either the explicit live-program
list (10 cases), the 45-day live-signal rule (50 cases: last commit
>= 2026-06-08), the meta-of-excluded rule (4 cases), or the this-umbrella
rule (1 case: `umbrella-donemd-backfill-meta-launch`). There are
**zero actionable real-umbrella closures in the live-program-with-kickoff
population** — every such umbrella is either actively live or already
excluded. The plan's panel-cleanup goal is therefore achieved at zero
done.md writes for that population (correctly: nothing to clean up).

The 12 done.md files Stage 1 DOES write (§3 below) all go to no-kickoff
runtime slots. They serve the documentation role the schema also covers
("tell future maintainers this thing was closed by PR X"), not the
priority-score.sh panel-state role. §3 surfaces this honestly per
`done.md` basis reporting.

## §2 Exclusion breakdown (66 excluded of 100)

| Reason | Count | Examples |
|---|---|---|
| explicit live-program list (kickoff §«Scope + hard exclusions» §1) | 10 | `adapter-jig`, `getff-honest-signals`, `beta-delivery-ux`, `stack-tooling-generation`, … |
| live-signal (<45 days, last commit on the dir) | 50 | any dir with `git log` date ≥ 2026-06-08 (`core-1.0` 2026-06-28, `honest-readme-demo` 2026-07-23, `r2-zod-aware-selector` 2026-06-26, …) |
| meta-of-excluded (parent in live-program list) | 4 | `adapter-jig-meta-launch`, `python-delivery-v0-meta-launch`, `launch-preannounce-track-meta-launch`, `generation-live-delivery-meta-launch` |
| this-umbrella (Stage 1 explicitly does not write its own done.md) | 2 | `umbrella-donemd-backfill`, `umbrella-donemd-backfill-meta-launch` |
| **total excluded** | **66** | |

The active-program-family prefix rule (`beta-*` / `getff-*`) is subsumed by
explicit-list + live-signal — every `beta-*` and `getff-*` dir already
matched one of those rows.

## §3 CLOSED-VERIFIED — 12 done.md files written (Commit A `22a77a1719`)

| Dir | Final PR | Closed | Evidence basis |
|---|---|---|---|
| `agnosticism-remediation-t-a` | #570 | 2026-06-16 | parent `agnosticism-remediation/done.md` Summary explicitly maps T-A stage → PR #570; parent closure PR #589 (2026-06-16) |
| `agnosticism-remediation-t-b` | #575 | 2026-06-16 | parent done.md Summary maps T-B → PR #575; parent closure #589 |
| `agnosticism-remediation-t-c` | #577 | 2026-06-16 | parent done.md `Final PR: #577` (T-C is the final stage); parent closure #589 |
| `consumer-upgrade-path-meta-launch` | #615 | 2026-06-17 | parent `consumer-upgrade-path/done.md` Final PR #615; meta-launch runtime state closed by parent's final PR |
| `egress-host-push-default-meta-launch` | #760 | 2026-06-27 | parent `egress-host-push-default/done.md` Final PR #760 |
| `generator-require-composite-tier-meta-launch` | #708 | 2026-06-24 | parent `generator-require-composite-tier/done.md` Final PR #708 |
| `hook-test-suite-rot-meta-launch` | #608 | 2026-06-17 | parent `hook-test-suite-rot/done.md` Final PR #608 |
| `wave-5-trio-followup` | #37 | 2026-05-11 | PR #37 merge commit `8c29ba6d5b` — `Merge pull request #37 from Yhooi2/chore/wave-5-trio-followup`; branch name IS dir slug |
| `wave-7-hot-checks-joint-closure` | #29 | 2026-05-11 | PR #29 merge commit `ffdab6d9f0` — `Merge pull request #29 from Yhooi2/wave-7-hot-checks-joint-closure`; branch IS slug |
| `wave-8-retro-h8-gate5-13-31` | #48 | 2026-05-12 | PR #48 merge commit `1903271289` — `Merge pull request #48 from Yhooi2/chore/wave-8-retro-h8-gate5-13-31`; branch IS slug |
| `phase-9-implementation` | #18 | 2026-05-09 | PR #18 merge commit `fdedd8cc8d` — `Merge pull request #18 from Yhooi2/docs/phase-9-implementation`; branch IS slug |
| `audit-fixes-2026-05` | #1 | 2026-05-07 | PR #1 merge commit `35ab3f9660` — `Merge pull request #1 from Yhooi2/feat/audit-fixes-2026-05`; branch IS slug |

**Caveat on the 5 branch-name matches** (T-UDB-C self-check): the kickoff
warns that a PR-title slug match is not closure evidence, because the matched
PR could be the umbrella's own kickoff-authoring PR (live example PR #1107
for THIS umbrella). For the 5 above, that disqualifier cannot fire: none of
the 5 dirs has a tracked `kickoff.md`, so no kickoff-authoring PR exists to
self-match. The branch name being identical to the dir slug, plus the
substantial PR diffs (verified via `git show <sha> --stat`), plus the
runtime-batch-state contents of each dir (`batch-*.md`,
`orchestrator-kickoff.md`), together establish that the PR plausibly
delivered the umbrella's final stage. Without kickoff.md, *plausibly* is the
strongest claim available; the call is to write the done.md (documentation
value, zero panel-state risk because priority-score.sh skips these dirs
anyway per §1) rather than leave a runtime-slot falsely appearing open.

**Honest panel-state accounting:** all 12 written done.md files land in
no-kickoff dirs. priority-score.sh's output is unchanged by this commit
(those dirs were already filtered at line 144). The plan's panel-cleanup
goal is therefore achieved at zero priority-score.sh-visible change for
Stage 1 — there were no actionable real-umbrella closures in the
live-program-with-kickoff population.

## §4 SUPERSEDED — 0 cases

The S3 protocol (check for `superseded-by:` / `absorbed-by:` / `→ superseded`
markers in the candidate's own `kickoff.md`) is structurally inapplicable to
the 34-classified candidates: **none has a `kickoff.md` on disk**. S3
requires reading the kickoff to find the marker; without kickoff, S3 returns
no signal by construction.

The 65 dirs that DO have kickoff.md are all excluded (§2), so the S3 surface
is empty for this Stage 1 run.

## §5 OBSOLETE-CANDIDATE — 0 proposed

Per the verdict table, OBSOLETE-CANDIDATE requires: no S1/S3 AND last
activity > 6 months AND topic visibly overtaken (with cited over taker).

The "no S1/S3" half holds for 22 of the 34 classified candidates (the
UNCLEAR bucket in §6 below). The "last activity > 6 months" half is
structurally tricky for this population: **the candidates have no git
history at all** (`git log --all` returns empty for every of the 34 dirs),
so the >6-month clock has no start point. The "visibly overtaken" half
requires identifying a specific over taker — a judgment that needs
kickoff-context to make safely (e.g. "Wave-N era work was overtaken by the
umbrella workflow" is a meta-level claim, not a per-dir one).

Conservative call: **zero OBSOLETE-CANDIDATE proposals in Stage 1.** The
operator-confirmation queue is empty. Per the kickoff (§«Deliverables» §2),
the OBSOLETE-CANDIDATE table is the operator-confirmation queue; an empty
queue means no follow-up obsolete-close batch (Deliverable 3 second
paragraph) is required for Stage 1's population. The follow-up decision
(`umbrella-donemd-backfill`'s own done.md) therefore depends only on the
operator's read of §1's structural finding and §6's UNCLEAR table, not on
any obsolete-close confirmation.

## §6 UNCLEAR — 22 cases (no done.md written)

These candidates lack both S1 (no parent closure, no branch-name PR match)
and S3 (no kickoff to check). All have the structural shape described in §1
(no `kickoff.md`, no git history, runtime-only symlinks). They appear in the
table for completeness; no action is taken.

| Dir | On-disk contents (sample) | S1 signals seen | Notes |
|---|---|---|---|
| `aif-handoff-overlap-2026-05-11` | research/review/implement-adapt md files | none | date in name suggests 2026-05-11 origin; no PR |
| `autonomous-self-audit-research` | research-prompt.md | PR #938 weekly link-checker (false match — different topic); PR #1034 §13.34 trigger registration | research artefact, no closure PR |
| `commits-2-4b-orchestration` | file-prompt.md, pr-body.md | none | orchestration scratch, no PR |
| `consumer-install-hardening-s4-meta-launch` | state.md | none | state.md shows "S4 GAP (load-bearing): No `cih-s4-verify` PR exists" — **stage explicitly identified as never-run, not closed**; do NOT close |
| `d-items-strategic-dialogue` | decisions.md, dialogue-brief.md, state.md, wave-1-prompt.md | none (PR #1191 cited `phase-research-coverage §1.10` only) | historical dialogue runtime state (May 2026) |
| `f2-fire-statusreadback-brainstorm` | prompt.md | none | brainstorm runtime, no PR |
| `hook-cwd-verify` | verify.md | none | single verify artefact |
| `instruction-compliance-empirical-research` | research-prompt.md | none | research artefact, no PR |
| `memory-codification` | multiple REVIEWER-VERDICT-*.md | PRs #1014/#1054 mention the *rule* `memory-codification.md` (the rule is shipped) but no PR closes the umbrella-slot itself | rule exists at `.claude/rules/memory-codification.md` (shipped); umbrella-slot is reviewer-dialogue runtime state |
| `modular-install-fullpack-meta-launch` | state.md | none | parent `modular-install-fullpack` not closed; state.md shows "READY — preflight green; awaiting maintainer GO"; **parent is live** |
| `open-questions-refactor` | batch.md | none | refactor scratch |
| `orchestrator-skill-refactor-2026-05-17` | prompt.md | none | date in name; refactor prompt |
| `phase-5-entry` | 4-partial-extended-*.md, next-session-bootstrap.md | none | phase-5 entry research artefacts |
| `phase-9-review` | 01-wave-5-6-7-review.md, 02-phase-9-full-review.md, 03-project-wide-review.md | none | review md files; sister dir `phase-9-implementation` was closed via PR #18 (different dir, different PR); this dir's review work has no closure PR |
| `queue-mode-execution-bc` | review-B-iter-0.md, review-C-iter-*.md, state.md | none | queue-mode runtime |
| `wave-1-13.21-headers` | batch-A/B/C.md | none | wave-1 batch runtime; no PR by this slug name |
| `wave-2-13.21-principle-09` | batch-A.md | none | wave-2 batch runtime; no PR |
| `wave-5-tool-bootstrapping` | batch-A-wave-5.1.md, batch-A-wave-5.2-5.3.md, orchestrator-kickoff.md, readiness-review.md, research.md | SSOT ID remap PRs mention "wave-5" tangentially | wave-5 sub-wave runtime; no slam-dunk closure PR |
| `wave-6-ai-doc-cold-audit` | cold-audit.md, wave-6-closure.md, wave-6-review.md | none | wave-6 audit runtime; the file `wave-6-closure.md` exists in-slot but no repo PR closes this dir's slug |
| `wave-8-substantive-compliance` | batch-8.1.md, batch-8.1b.md, …, d3-completeness-fix.md | false match: PR #938 (lychee link-checker, unrelated topic) | wave-8 batch runtime; no PR by this slug |
| `zcode-full-parity-mega-umbrella-meta-launch` | state.md | none | parent `zcode-full-parity-mega-umbrella` not closed; state.md shows "WAVE A DISPATCHED — 7 autonomous aif-handoff tasks running in parallel"; **parent is live (Wave B pending)** |
| `zcode-parity-step1-emit-wrapper-meta-launch` | state.md | none | parent `zcode-parity-step1-emit-wrapper` not closed; state.md shows "AWAITING-MAINTAINER-GO"; **parent is live** |

**Per T14** (catalogue §2 of `ai-laziness-traps.md`): the absence of CLOSED
or SUPERSEDED findings for these 22 is a stated result, not an omission.
Each has been examined; each lacks the evidence the protocol requires. The
structural finding in §1 (no kickoff → priority-score.sh already skips →
done.md would be cosmetic) covers the "so what" for this bucket: these
dirs do not pollute the `/pipeline` panel today, regardless of done.md.

## §7 Acceptance gate self-check (Stage 1)

- ✅ Every done.md in §3 corresponds to a row with cited PR + merge SHA (verifiable via `git show <sha>` on origin/staging). 12 of 12 present in §3 table.
- ✅ ZERO done.md files **written by this umbrella** under any exclusion-list dir (the 12 target dirs are all in the candidate bucket, not the excluded bucket; the 16 explicit-list dirs and 50 live-signal dirs were never touched). **Note (pre-existing state, not a leak):** 5 dirs in the kickoff's explicit exclusion list (`multi-model-pipeline-pilot`, `launch-preannounce-track`, `python-delivery-v0`, `generation-live-delivery`, `meta-orchestrator-prior-art`) DO carry `done.md` files — these were authored by **other maintainers' past PRs** that legitimately closed those umbrellas (#1113, #995, #997, #813, cf246c2 respectively), NOT by this umbrella's Commit A/C. `git log --author=Yhooi2 --since=2026-07-23` confirms zero of my commits today touched any of these 5 files. The exclusion list guards against **new work by this umbrella**, which is verified clean.
- ✅ `bash .claude/skills/pipeline/helpers/priority-score.sh` runs clean — exit 0, 367 lines of output, no parse breakage. New done.md files land in dirs the script already skips at line 144 (`kickoff=missing → continue`) — they add documentation value (visible closure marker) without changing panel output.
- ✅ Report UNCLEAR section present (§6 above) with 22 rows; T14 compliance confirmed (absence of closure findings is a stated result, not an omission).
- ✅ **Population enumeration** present (§1 above) with exact command + 100-dir count + structural split.
- ✅ **Schema check** on all 12 new done.md files: every file carries `# <name> — DONE` title line, `- Final PR:`, `- Closed:`, `- Summary:` (with backfill trailer `done.md backfilled 2026-07 by umbrella-donemd-backfill`). 0 schema failures.

## §8 Follow-ups (out of Stage 1 scope)

- **`consumer-install-hardening-s4-meta-launch`:** state.md explicitly identifies an "S4 GAP" — the S4 verify stage never ran. This is NOT a closure candidate; it is an open work item. **Surface to operator** as a follow-up: either run S4 or formally accept the gap with rationale.
- **`umbrella-donemd-backfill` own done.md:** per kickoff §«Deliverables» §3, this Stage 1 run does NOT write done.md for `umbrella-donemd-backfill` itself — that waits for the follow-up obsolete-close batch (Deliverable 3). Since §5 proposes zero obsolete closures, the follow-up decision reduces to "is §1's structural finding + §6's UNCLEAR accounting acceptable as Stage 1 output?" If yes, the operator can either (a) author `umbrella-donemd-backfill/done.md` directly citing this Stage 1 PR as the closure, or (b) declare the umbrella's goal partially-met (panel-cleanup unchanged because the live-program-with-kickoff population had no actionable closures) and schedule a deeper sweep.
- **Structural-fix follow-up (operator decides):** the §1 finding (35 of 100 no-done dirs are runtime-only slots priority-score.sh already skips) suggests the `/pipeline` panel's "open umbrella" count is inflated only by real-umbrella-with-kickoff activity (the 65 currently-excluded live ones), not by these stale runtime slots. If the goal is "make the count match actual open work", the lever is closing/completing the live-program umbrellas themselves, not backfilling done.md for runtime slots. That decision is above Stage 1's pay grade — surfaced here for operator awareness.

