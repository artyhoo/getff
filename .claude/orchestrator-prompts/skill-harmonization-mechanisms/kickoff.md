# KICKOFF — skill-harmonization-mechanisms

> **Type:** factory umbrella (4 build stages), authored 2026-08-18 per `/arch` §3 exit
> routing (factory-bound row).
> **Origin:** the three-stack skill harmonization design contour — spec
> `docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md`, status
> REVIEWED-GO 2026-08-18 (3 cold two-altitude review rounds, both seats GO on the
> round-3 delta). The spec §5 is the **verbatim source of truth** for every mechanism
> below; this kickoff routes and gates, it does not re-decide. Decisions D-H1..D-H18
> are ratified — do NOT re-open them (spec §4 carries the falsifiers).
> **Deliverable:** the four mechanical channels the design ratified — prune drift
> detector, CONTEXT.md pointer-rule principle test, claim-first dispatch machinery,
> `/pipeline` dependency frontier.
> **Base branch:** staging (NOT main — main is prod, manual promote only).
> **Rigor label (effort-worthiness L0):** `build-and-verify` for all stages — every
> surface is reversible and each stage carries a live RED/GREEN seam proof (spec §7);
> no stage ships consumer-visible behaviour (S1's pre-push section is
> `owner: 'maintainer'` — never composed on consumer layouts).

## §0 Normative inputs + provenance

- **Spec:** `docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md` —
  at authoring time this file is NOT yet on `staging`; the GO version is commit
  `f2d3fe2655` on local branch `claude/keen-shannon-46577a` (design-contour session,
  unpushed, PR pause held by the operator). **Dispatch precondition D-P1 (§6) blocks
  every stage until the spec is reachable from `origin/staging`.** Spec references in
  this kickoff are backticked (not linked) so link gates stay green until it lands.
- **Operator premise register (spec §2, P-1..P-7) is BINDING** for every session in
  this umbrella. Transfer by copy-or-pointer, never paraphrase — read §2 verbatim from
  the spec. Load-bearing here: P-1 (argue on substance, never concede to please), P-5
  (claims = the existing pipeline status layer, no second status vocabulary), P-3
  (prune motive is misrouting, not tokens — keep lists narrow).
- **SSOT rows:** `prior-art-evaluations.md` #253 (counter arm + observation №0) and
  REJECT rows #254-257 land with the same design-contour branch; cite them by ID once
  D-P1 is met.
- Mold for the stage table: `arch-v2-context-pipeline/kickoff.md` §1 (the incumbent
  `Depends on` column — 14 tracked kickoffs carry it; S4 standardizes on exactly this
  spelling, and this kickoff self-applies it, T15).

## §1 Stage table

| Stage | Scope (one line) | Depends on | Tier | Marker | Implements |
|---|---|---|---|---|---|
| S1 | `scripts/prune-plugin-skills.sh` (2-item list) + `--check` as an `owner: 'maintainer'` pre-push registry section + wizard-generated operator walkthrough | operator probe P5 = PASS, recorded in §5 (spec §6; hard gate — do not dispatch without it) | 2 | **YES** `<!-- bridge-profile: Z.AI GLM-5.2 SDK -->` (D1 exception: /arch-produced, plan-complete; verify precondition at dispatch, §6 D-P2) | spec §5.1, D-H15 + D-H6 |
| S2 | CONTEXT.md pointer-rule principle test (new slot 42, mold of 08/09) | — | 1 | **YES** same marker (Tier 1 — the «how» is one sentence + a mold) | spec §5.2, D-H11 |
| S3 | claim-first machinery, four parts: runtime-bridge dispatch split, `/pipeline` Step 3 reorder, probe-inflight claim signal, orphan-claim expiry | — | 2 | **YES** same marker (D1 exception, same verification) | spec §5.3, D-H5/P-5 |
| S4 | `/pipeline` dependency frontier from the incumbent `Depends on` column + vertical-slice/expand–contract/fog-of-war vocabulary into `meta-kickoff.template.md` | S3 merged (both stages edit `.claude/skills/pipeline/SKILL.md` — serialized to avoid conflict + S4's frontier hangs off the Step 3 shape S3 lands) | 2 | **YES** same marker (D1 exception, same verification) | spec §5.4, D-H13 |

S1/S2 are independent of everything and of each other — dispatchable in parallel
(separate worktrees, one PR per stage). S3 is independent of S1/S2. S4 waits for S3.

## §2 Stage briefs (binding scope + acceptance)

### S1 — prune script + `--check` drift section + wizard (spec §5.1, verbatim)

Build:

1. `scripts/prune-plugin-skills.sh` — operator-run (the permission classifier blocks
   agent writes to `~/.claude/plugins/cache/**`; measured live in the design session).
   Deletes the listed skill dirs from the plugin cache; idempotent; glob over version
   dirs. Prune list v1, both under `mattpocock-skills/*/skills/engineering/`: `tdd`,
   `resolving-merge-conflicts`. The list is CLOSED at 2 items (F7 selective radius,
   operator answer — machine-globally-justified collisions only). `code-review` and
   `codebase-design` stay cache-resident; `research` and `prototype` must NEVER enter
   the list (wayfinder tickets invoke them by name).
2. `--check` mode: report-only; non-zero exit when a pruned skill is back in the
   cache. Wired as an **`owner: 'maintainer'` section in the
   [pre-push.ts](../../../packages/core/hooks/pre-push.ts) section registry**
   (registry at `packages/core/hooks/pre-push.ts:678-695`; composition rule guarantees
   maintainer sections are never composed on a consumer layout, fail-closed on
   absent/invalid owner; principle 32 is the CI net for a mis-tagged owner). RED
   output must carry a re-run instruction (the script's own path + invocation).
3. Operator walkthrough generated with `mattpocock-skills:wizard` (first wizard use,
   D-H6): walks the operator through running P5 (if not yet run), the prune itself,
   and a `--check` confirmation. The wizard output is a repo artifact (e.g.
   `scripts/prune-plugin-skills-walkthrough.sh` or equivalent) — the executor decides
   placement, English only.

Acceptance (seam 2 of spec §7): live RED/GREEN proof of `--check` — with the cache
root injectable (env override, e.g. `PRUNE_CACHE_ROOT`) so the proof runs against a
fixture tree, never the real `~/.claude/plugins` (agent cannot write there — see
T-SHM-A, §4). Negative pair required: `--check` RED on a restored pruned dir, GREEN on
a clean fixture. Editing `pre-push.ts` (shipped file): run
`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` and commit the regenerated
snapshot if it moves; principle 32 + the pre-push suite must be green locally.

### S2 — CONTEXT.md pointer-rule principle test (spec §5.2, verbatim)

Build: `packages/core/principles/42-context-md-pointer-rule.test.ts` (slot 42 — 41 is
the current top; name at executor's discretion, mold of principles 08/09): every link
in a repo-root `CONTEXT.md` resolves to an existing file AND, when it carries a
`#fragment`, to an existing anchor in that file.

Binding constraints:

- **CONTEXT.md does not exist yet** (it is authored later in an ATTENDED
  `/setup-matt-pocock-skills` + domain-modeling session — spec §8 item 1, NOT this
  umbrella's scope). The test must treat absence as a VALID state (skip pattern, mold:
  principle 12's `KICKOFFS_AVAILABLE`), with anti-tautology negatives that need no
  real file (blank content, broken-anchor fixture → check fails). Do NOT create
  CONTEXT.md to make the test observable.
- Non-duplication (verified at kickoff time): the lychee gates
  (`.github/workflows/link-checker.yml` + the pre-push `lychee --offline` section) run
  WITHOUT `--include-fragments` — anchors are unchecked today. Record in the test
  header: if lychee fragment-checking is ever enabled repo-wide, the anchor half of
  this principle becomes redundant — revisit trigger.
- The redefinition half of the pointer rule (owner-doc terms get a one-line gist +
  link, never a redefinition) is judgment — it stays prose in the spec/CONTEXT.md
  authoring session; this test enforces only the mechanically checkable half.

### S3 — claim-first machinery, four parts (spec §5.3, verbatim — all four, no subset)

This is NOT a prose «dispatcher step reorder» (review finding B-M2 killed that
reading). Three owners are touched:

1. **Runtime-bridge split** — `packages/runtime-bridge/src/AifHandoffBackend.ts`:
   today create+unpause are one atomic `dispatch()` (POST `/tasks` with `paused:true`
   at `:231-241`, unpause PUT at `:260`; best-effort DELETE rollback already exists at
   `:263`). Split into claim-create (paused task, occupies no lane) and unpause
   halves, each reachable from the CLI/skill layer. Keep the existing rollback path.
2. **`/pipeline` Step 3 reorder** — `.claude/skills/pipeline/SKILL.md:425` (Phase -1
   cold-review): claim-create fires BEFORE the Phase -1 window; unpause only on
   Phase -1 GO; DELETE the claim task on RED (cancel branch). No new status
   vocabulary — the claim IS the existing pipeline status layer (premise P-5);
   `state.md` stays the journal, never the claim medium.
3. **Probe widening** — `.claude/skills/dispatcher/helpers/probe-inflight.sh`: the jq
   filter at `:146-147` selects only `done|verified` tasks with a branch, so a fresh
   paused claim is invisible to ALL five existing signals. Add a claim signal
   (backlog/paused task whose description carries the umbrella slug) with its own
   `SIGNAL` line; a live claim must flip the `VERDICT` away from `FRESH`.
4. **Orphan-claim expiry** — a claim whose session died before Phase -1 returned must
   surface as `STALE-CLAIM` (age/marker heuristic at executor's discretion, surfaced
   in probe output), never eternally block the stage — the starvation mode TD-F5
   named.

Acceptance (seam 3 of spec §7): live RED/GREEN proof — create a paused claim on a
throwaway slug → probe reports it (RED / claim signal ≥1); DELETE → probe GREEN.
Negative branches: Phase -1 RED path deletes the task; an aged orphan surfaces as
`STALE-CLAIM`. Closes probe P4 (spec §6) — say so in the PR body.

### S4 — dependency frontier + template vocabulary (spec §5.4, verbatim)

Build:

1. `/pipeline` derives the dispatchable frontier mechanically from the **incumbent
   `Depends on` stage-table column** (mold: `arch-v2-context-pipeline/kickoff.md:91`).
   Kickoffs without the column degrade safely — every not-yet-done stage is frontier.
   **NEVER introduce a `Blocked-by:` second spelling** for the same edge (D-H13/B-M6 —
   that would be the exact `#parallel-evolution-creep` the parent spec kills). Helper
   placement: `.claude/skills/pipeline/helpers/` precedent exists
   (`print-plan-path.sh`).
2. Vertical-slice / expand–contract / per-umbrella fog-of-war vocabulary lands in
   `.claude/skills/pipeline/templates/meta-kickoff.template.md` (241 lines — room
   under the 600 gate) + the pipeline kickoff conventions. There is NO
   `kickoff.template.md` — do not create one (B-M6 measured the templates dir).

Acceptance: frontier output proven on two fixtures — a kickoff WITH the column (this
umbrella's own table qualifies: S4 must show as blocked while S3 is unmerged) and one
WITHOUT (degrades to all-not-done). Self-application (T15): run the frontier
computation on THIS kickoff and quote the output in the PR body.

## §3 Prior-art consult (EXECUTION-PLAN §5.5 Step 1.5, run at kickoff time — TD-F9)

| Item | SSOT / evidence consulted | Verdict + trailer guidance |
|---|---|---|
| S1 prune script | SSOT #253 + REJECT row «total-sweep pruning» (#254-257 block; lands with the spec branch). CC-native alternatives measured ABSENT by the design contour's probes: P1 — per-skill disable of plugin skills does not exist (`skillOverrides` explicitly excludes plugin skills); P6 — no per-project plugin scoping (`enabledPlugins` global-only; the claimed workaround falsified by a direct skills.md fetch 2026-08-18). | OWN-BUILD (small operator script; no production-grade analog for machine-global plugin-cache pruning). Trailer: cite #253 + the P1/P6 absence evidence. Revisit trigger: per-project plugin scoping shipping in CC dissolves the radius dilemma (D-H15). |
| S2 principle test | REUSE candidate exists upstream: lychee `--include-fragments` (anchor checking). Measured 2026-08-18: neither `link-checker.yml` nor the pre-push lychee section enables it → no duplication today. Ratified verdict (D-H11) = principle test, mold 08/09 (repo-wide fragment turn-on has a much larger blast radius than the CONTEXT.md-scoped rule). | ADAPT (internal mold 08/09). Trailer: name lychee-fragments as the considered-REUSE candidate + the revisit trigger recorded in the test header. |
| S3 claim machinery | Refactor + extension of own runtime-bridge (own-build lineage, `aif-handoff-as-runtime-bridge` umbrella); rollback call reused, not built. Alternative claim media evaluated in the design: GH issues — deferred, recorded as D-H5's falsifier-triggered revisit; wayfinder native assignee-claim ADOPTED for the design-ticket population (not this stage's scope). | No new capability (split of an existing atomic op + probe widening). Escape-hatch trailers acceptable: `Prior-art: skipped — refactor/extension of own runtime-bridge, no new capability` (≥20 chars, specific). |
| S4 frontier | Incumbent `Depends on` column measured across 14 tracked kickoffs (grep evidence in the design round-1, B-M6). Vocabulary = ADOPT VOCABULARY from the satellite stacks (BFR §1 verdict class) — thin wrapper, no runtime coupling. | No new dependency; skill/template doc edits. Escape-hatch trailer with the ADOPT-VOCABULARY note. |

Each stage PR additionally carries the standard obligations: `Prior-art:` trailer
(real or ≥20-char escape hatch), §1.7 forward+backward self-check with `file.ext:NN`
citations, `Audited-SHA` prefixing the PR head where the fidelity gate demands it.

## §4 AI-laziness traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active traps for this umbrella: **T2** (claiming the mechanism «would detect» instead
of running the RED/GREEN proof — every seam in §2 demands a live invocation), **T3**
(file:line findings must quote actual content — the `:NN` anchors in §2 were verified
2026-08-18 and must be re-verified against the executor's checkout before editing),
**T5** (S-stage executors fix nothing outside their stage scope — surface
observations, per CLAUDE.md PR strategy), **T8** (answers already in the spec/kickoff
— do not ask; batch genuine operator forks at review phase), **T15**
(self-application: S4 runs its frontier on this kickoff; S2's test carries
anti-tautology negatives), **T19** (own cold-QA of the diff before handoff — CI
checks form, not design), **T21** (backward-check must enumerate sibling surfaces —
e.g. S3's probe widening must sweep ALL probe consumers, not just the one edited
line).

Domain-specific traps:

- **T-SHM-A** — «verify the prune/`--check` against the factory checkout instead of
  the real machine-global cache». The subject is the OPERATOR's `~/.claude/plugins`
  (agent-unwritable). Counter: injectable cache root (env override) for the RED/GREEN
  fixture proof + the operator's wizard-assisted live run as the final verification —
  never claim the live half is done from the fixture half.
- **T-SHM-B** — «implement S3 as prose reordering of pipeline text while the atomic
  `dispatch()` stays atomic» (the exact B-M2 finding the review killed). Counter: the
  runtime-bridge split (part 1) is the load-bearing half; a PR whose diff touches only
  `SKILL.md` is non-conformant by construction.

## §5 Operational gates + recorded state

- **P5 record (gates S1):** PENDING at authoring. Operator procedure (spec §6): rename
  `~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.3/skills/engineering/tdd`,
  open a fresh session, confirm the skill is absent from the listing; restore or keep.
  On PASS, the pipeline session records `P5: PASS <date>` here (one-line edit) before
  dispatching S1. On FAIL: S1 is dead as designed — revive D-H10's fallback (dispatch
  prompt binding + project shadow) as a NEW design question, not silently.
- **600-line wall:** `.claude/skills/pipeline/SKILL.md` is at **599 lines** — S3/S4
  MUST NOT push it past 600 (pre-commit gate). Free lines or route detail to
  `references/` (the skill's established pattern).
- **Shape pins:** principle 39 pins the shape of `pipeline/SKILL.md` §1's first line —
  keep the prefix; principle-18 families pin dispatch/chip substrings on pipeline
  output formats — run the principle suite locally after any SKILL.md edit.
- **Shipped-file edits** (`packages/core/hooks/pre-push.ts`, anything under
  `packages/core/templates/**`): regenerate the install snapshot
  (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) in the same commit.
- One PR per stage onto `staging`; Phase -1 cold review between stages per `/pipeline`
  Step 3; PR merge only on live operator GO (session norm for this umbrella).

## §5b Host-verify contract (destination-environment-verification §1)

Workers run in the aif container; acceptance happens on the HOST. Before accepting any
stage, run on the host (`bash scripts/host-verify.sh skill-harmonization-mechanisms`):

```host-verify
# All stages — principle + hook suites on the host checkout:
npx vitest run packages/core/principles/
# S1 — --check RED/GREEN against an injectable fixture cache (never the live cache):
PRUNE_CACHE_ROOT="$(mktemp -d)" bash scripts/prune-plugin-skills.sh --check; echo "clean-exit=$?"
# S2 — the new slot-42 test green with CONTEXT.md absent (skip-valid state):
npx vitest run packages/core/principles/42-*.test.ts
# S3 — probe claim signal present in output shape (grep the new SIGNAL line):
probe_out=$(SLUG=shm-hostverify-throwaway bash .claude/skills/dispatcher/helpers/probe-inflight.sh); echo "$probe_out" | grep -E "SIGNAL (claim|task-)"
# S4 — frontier self-application on this kickoff (exact invocation lands with S4):
grep -n "Depends on" .claude/orchestrator-prompts/skill-harmonization-mechanisms/kickoff.md
```

S1's LIVE half (the real `~/.claude/plugins` prune + `--check`) is the operator's
wizard-assisted run — host-verify covers the fixture half only (T-SHM-A).

## §6 Dispatch preconditions (for the `/pipeline` session — check ALL before any stage)

- **D-P1 — spec on staging:** `git ls-tree origin/staging --name-only
  docs/superpowers/specs/ | grep skill-stack-harmonization` must hit. Until the design
  contour's branch (`claude/keen-shannon-46577a`, GO SHA `f2d3fe2655`) lands via its
  own operator-approved PR, every stage is blocked — the spec is each stage's
  verbatim source of truth and MUST be readable by executors dispatched from staging.
- **D-P2 — D1 marker precondition:** the marker in §1 is valid only while
  `fidelity-verdict-in-pr-body` is a REQUIRED check in staging branch protection
  (tier-home §2). If unregistered, dispatch WITHOUT the marker (project defaults: top
  tier plans).
- **D-P3 — in-flight probe:** `SLUG=skill-harmonization-mechanisms bash
  .claude/skills/dispatcher/helpers/probe-inflight.sh` immediately before EACH stage
  dispatch and RE-probe after each Phase -1 review completes (CLAUDE.md pre-dispatch
  probe). Any hit or `PROBE-INCOMPLETE` → stop and surface. (Authoring-time run
  2026-08-18: `VERDICT: FRESH`.)
- **D-P4 — P5 gate:** S1 only per §5.
