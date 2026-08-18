# KICKOFF — pre-merge-carrier-build (B1 → B2 → B3)

> **Type:** build umbrella (I-phase; three stages decomposed by the S0 design spec §g).
> Authored 2026-08-18, the same day the operator answered the four open decisions (§1).
> **Origin:** [the S0 design spec](../../../docs/superpowers/specs/2026-08-18-pre-merge-carrier-design.md)
> (merged as PR 1475) + [the build handoff](../../../docs/superpowers/specs/2026-08-18-pre-merge-carrier-build-handoff.md)
> (merged as PR 1477) + the evidence base
> <https://github.com/artyhoo/getff/issues/1466> / <https://github.com/artyhoo/getff/issues/1465>.
> **Base branch:** staging. Per [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md),
> do NOT dispatch until this kickoff is merged to staging.
> **Rigor label (effort-worthiness L0):** `research-grade` — every stage ships a
> consumer-facing surface (carrier script, probe script, install docs, `setup.d/` delivery).
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** SPENT at S0 —
> [prior-art-evaluations.md rows #259-#263](../../../docs/meta-factory/prior-art-evaluations.md).
> B1/B2 are capability commits; their `Prior-art:` trailers cite those rows (CLAUDE.md
> per-commit gate). No new consult is owed unless a stage proposes a capability outside the
> spec's scope.

> **Citation form is load-bearing — do NOT rewrite PR references into the hash form.** PR
> references here are written `PR 1475` or as bare URLs. `dup-detect.sh` signal (1) greps a
> kickoff for hash-number tokens and treats a match against a recently merged PR as evidence
> the umbrella is already delivered; `priority-score.sh` Layer C2 then tags it
> `status=DONE basis=xref` and `/pipeline` drops it before scoring (measured live on
> `frontier-residue-sweep`, fixed in PR 1473). The citations here are PROVENANCE of inputs,
> not evidence of delivery. Separately, dup-detect signal (3) DOES flag this umbrella —
> `basis=deliverable-on-staging`, a slug-token match («merge»+«build») against an unrelated
> 2026-06-14 research-patch. Verified benign 2026-08-18: `priority-score.sh` emits no
> `status=DONE` for it (no `merged #<num>` in that signal), so the umbrella stays scored.

## §0 Read first, in order

1. This kickoff — §1 ratified answers and §3 constraints are binding, not advisory.
2. [The design spec](../../../docs/superpowers/specs/2026-08-18-pre-merge-carrier-design.md) —
   §a-§f are the build contract; §g is the stage decomposition this table mirrors.
3. [The build handoff](../../../docs/superpowers/specs/2026-08-18-pre-merge-carrier-build-handoff.md)
   — §4 the cold audit's watch-list (W-1/W-2/W-3 restated in §3 below; the FULL six-row
   table lives in PR 1475's `## Review findings` — W-6 is B2's own risk) AND §5 «traps this
   stage already paid for» (blind `ls` negatives; never `prettier --write` the SSOT; seven
   lanes, not four; `gh pr merge` GraphQL EOF → use the REST path). Do not re-pay them.
4. Reference implementation: `scripts/pre-merge-local.sh` @
   <https://github.com/artyhoo/timeliner/pull/229> — read, never vendor (SSOT #263).

## §1 Ratified decisions (operator, 2026-08-18 — do not re-derive, do not re-open)

| Fork | Answer | Consequence for the build |
| --- | --- | --- |
| F1 delivery depth | **All profiles** (core included) | `setup.d/40-configs.sh` delivery is NOT profile-gated; the script is a standalone leaf; a delivery arm proves `--profile core` receives it (§2 B1) |
| F2 head already contains base | **Proceed**, reporting `merge = head (base already contained)` | three-sha contract stays intact on up-to-date branches; never die like the reference does; self-test arm 6 covers this path (§2 B1) |
| F3 NOT-COVERED policy | **Report-only** | every uncovered CI leg named in the verdict; opportunistic run when the binary exists (`command -v`); absence is never CANNOT-RUN for optional legs |
| F4 the #1465 riders | **Per spec §d** — part 1 lands as the NEW `ci-available-probe.sh` in B1 | the kickoff contradiction is resolved toward the same-change binding; no docs-only reading |

An executor that re-opens any of these has left scope: park as `DECISION-NEEDED` only if a
ratified answer is *impossible* to implement as stated, with the impossibility measured.

## §2 Stages

| Stage | Deliverable | Depends on | Volume |
| --- | --- | --- | --- |
| B1 | **Opt-in carrier ship, ts-server lane + both #1465 riders in ONE change** (ratified): `packages/core/audit-self/pre-merge-local.sh` (throwaway-worktree merge, three-sha report on every verdict, spec §a.3 exit-code table with F2 semantics, ts-lane gate derivation + vacuity control, atomic `mkdir` lock via `git rev-parse --git-path`, NDJSON run ledger §f.1, §e honest-framing fixed strings INCLUDING the §e.4 copy-paste PR-body citation block) + `packages/core/audit-self/ci-available-probe.sh` (#1465 part 1, spec §d contract) + the two docs lines (#1465 part 2: `packages/core/templates/shared/AI-USAGE-GUIDE.md` + `INSTALL-FOR-AI.md`) + delivery per the §3 delivery-mechanism constraint (install: `copy_safe` + `chmod_safe +x` in `setup.d/40-configs.sh`, ungated by profile per F1; refresh: two entries in the `install.sh` `do_refresh` «Scripts → scripts/» pair-list) + **the enforcement wiring the new test fileS force** (steps inside EXISTING `audit-self.yml` jobs invoking BOTH new test files — a new job would also owe `ci-success.needs`, principle 36; the install-sh one additionally needs the literal `run: bash tests/install-sh/<name>` line `tests/install-sh/meta-all-wired.test.sh` asserts; plus sweep reachability for `packages/core/audit-self/*.test.sh` in `scripts/run-local-ci-sweep.sh` `gate_table()` + its coverage test — principle 41's population is every tracked `*.test.sh`, allowlist deliberately empty; plus extending the `audit-self.yml` shellcheck step to the two new shipped scripts, making §3's shellcheck-clean constraint CI-enforced) + fixture self-tests at `packages/core/audit-self/pre-merge-local.test.sh` (arms per §3) + a core-profile delivery arm at `tests/install-sh/pre-merge-local-delivery.test.sh` (runs `install.sh --profile core` against a fixture consumer, asserts `scripts/pre-merge-local.sh` + `scripts/ci-available-probe.sh` land — fixture precedent: `consumer-upgrade-path.test.sh`) + install snapshot regen | — | L |
| B2 | python/go/cargo + UI preset lane runners — **all SEVEN shipped lanes** (ts-server done in B1; python/go/cargo + react-next/react-spa/react-native here; a lane count ≠ 7 means the template census was not re-run — handoff §5): per-lane gate derivation + pin checks (mismatch → exit 3 with the pin named), the §b.1 cache isolations (ruff `--no-cache`, `GOLANGCI_LINT_CACHE` isolation, `CARGO_TARGET_DIR`/`RUSTC_WRAPPER` unset), golangci-lint cache-staleness **verified, never assumed** (the spec's `INCONCLUSIVE-needs-verification`), F3 report-only policy for browser/binary-dependent legs, lane self-tests appended to the §5 contract | B1 | M |
| B3 | Promotion-to-default decision: fires on the recorded §f trigger (first live catch on a non-timeliner consumer) OR on falsifier α (usage ≈ zero after N weeks; N is B3 config) — an operator fork, never a scheduled build | B1 (trigger-gated) | S |

## §3 Binding constraints (ratified + cold-audit watch-list — do not re-derive)

- **W-1 — gate the MERGE RESULT, never the head alone.** Every verdict path and every
  self-test asserts three shas (`head`, `base`, `merge`); the verified sha is the **merge**
  sha. A draft where the verified sha equals the head sha while the branch is behind base
  has re-created the #1466 defect — a wrong answer, not a variant.
- **W-2 — the #1465 riders stay inside B1.** `ci-available-probe.sh` or either docs line
  drifting into a B2/B3 row, or a new fork naming the riders, is a deviation from the
  ratified record.
- **W-3 — opt-in only.** Delivery = the files land in the consumer's `scripts/`. NO husky,
  `validate`, CI, or hook wiring of the carrier in B1/B2 — default-on is exclusively B3's
  trigger-gated decision. (Deliberate narrowing of the handoff §4 W-3 tell, which lists
  `setup.d/` wiring: the delivery itself lives in `setup.d/40-configs.sh` by design — the
  tell is *invocation* wiring, not file delivery.)
- **Delivery mechanism (resolves the spec §c letter against measured install.sh reality).**
  Spec §c names «the `_copy_or_refresh` pattern». Measured 2026-08-18: no generic
  `_copy_or_refresh` exists — the three helpers are lane-scoped (`_py_/_cargo_/_go_…`,
  `setup.d/45/46/47`), their `GETFF_TOOLCHAIN_REFRESH` flag is exported only by the lane
  runners, and on the npm flow `--refresh` runs `do_refresh` and exits BEFORE the
  `setup.d/` layer loop — so a `_copy_or_refresh` call in `40-configs.sh` would be a
  permanently dead refresh branch. The ratified mechanism preserving §c's INTENT
  (brownfield consumers not stranded on v1; Layer-3 `<dst>.override.md` escape honoured):
  install-time `copy_safe` + `chmod_safe +x` in `40-configs.sh` (the sibling gate-script precedent)
  PLUS two pairs in `do_refresh`'s «Scripts → scripts/» list (`refresh_safe`, which skips
  `.override.md`-owned files). `tests/install-sh/refresh-covers-full-delivery.test.sh`
  extracts deliveries by the `copy_safe` verb, so this form is also the only one its gate
  can see.
- **Six self-test arms + one, as live seeded runs.** Arms 1-5 verbatim from spec §a.6.
  Arm 6 (F2): a fixture where base is an ancestor of head → the carrier proceeds, the
  verdict prints `merge = head (base already contained)` alongside all three shas
  (merge == head is CORRECT there), exit code per the gate result — no new exit code.
  Arm 7 (§f observability): a PASS run appends the NDJSON ledger line
  (`pre-merge-runs.ndjson` under `git rev-parse --git-path`) and prints the §e.4 PR-body
  citation block. Every arm asserts the carrier's OUTPUT and exit code on a fixture repo —
  never its source text (T-PMC-D).
- **Exit-code contract verbatim from spec §a.3:** 0 PASS / 1 FAIL / 2 MERGE CONFLICT
  (distinct outcome + the «GitHub runs no pull_request workflow in this state» warning) /
  3 CANNOT-RUN (required tool/pin absent, named) / 90 VACUITY.
- **Honest framing (spec §e) ships as fixed strings asserted by the self-tests** — PASS
  says «LOCAL PRE-MERGE PASS», never «CI green»; every verdict carries the NOT-COVERED
  list; the §e.4 PR-body block is part of the contract (it is B3's only observation
  channel, spec §f.2).
- **Portability of the two shipped scripts:** bash 3.2-compatible (macOS default — live
  constraint, see `refresh-covers-full-delivery.test.sh` header), shellcheck-clean, no
  GNU-only flags; CI shellcheck currently sweeps `setup.d/*.sh install.sh` only, so B1
  extends that step to the two new scripts (§2 B1 row) and §5 carries the opportunistic
  host-side lint.
- **Shipped-axis agnosticism:** no Turbo/pnpm/Postgres assumptions; `gh` absence degrades
  to a named CANNOT-RUN in the probe script, never a hard dependency. No paid LLM anywhere
  ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)).
- **Capability commits:** B1/B2 add ≥80-LOC files under `packages/` → `Prior-art:` trailers
  citing rows #259-#263.
- **Shipped-file edits** (`setup.d/**`, `packages/core/templates/**`) require deliberate
  baseline regen (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) with the diff
  reviewed before committing. **`INSTALL-FOR-AI.md` sits at 583/600** against the hard
  600-line markdown gate — the #1465 docs addition there must stay within 17 lines or
  free lines first.
- **Destination facts go stale:** the handoff §3 container probes (git 2.39.5, worktree
  add/remove OK, node v22, clone base far behind staging) were run 2026-08-18 against
  `aif-handoff-agent-1`. Container state is operator-machine state — re-run the probes at
  dispatch time and down-sync the container clone before any aif dispatch, or the worker
  builds on a stale tree.

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active: **T2** (a carrier that is designed but never run on a fixture repo is not built —
show the runs), **T3** (every acceptance claim carries command output or file:line),
**T8** (the F1-F4 answers are in §1 — do not re-ask), **T14** (a green self-test with
missing arms is «coverage insufficient», not «carrier correct»), **T19** (own cold review
of the diff before handoff), **T21** (delegate the backward sweep to a cold seat; hand it
the change's class, never the diff).

Domain-specific:

- **T-PMC-A (carried from S0 — B2's own trap)** — generalising the interlock set from one
  measured lane: every B2 lane claim is measured against that lane's template + wired
  surfaces (grep/run, file:line), never extrapolated by analogy; the lane population is
  SEVEN, re-derived via `find . -name "github-actions-ci*.yml"`, never recalled.
- **T-PMC-B (carried from S0)** — quietly gating the head because it is simpler: any code
  path or self-test reporting fewer than three shas, or naming the head sha as the verified
  one, is the #1466 defect re-created. The three-sha report is a hard output contract.
- **T-PMC-D** — self-test vacuity: asserting the honest-framing strings by grepping the
  carrier's *source* instead of RUNNING the carrier against a fixture repo and asserting
  its *output* on seeded outcomes (failing gate → exit 1; seeded conflict → exit 2; gate
  name deleted from the log → exit 90; PASS log retained outside the worktree). A self-test
  that cannot fail on a broken carrier proves nothing (§3 arms are the floor). (Label
  T-PMC-C is taken — spec §j uses it for the 600-line-wall check; not reused here.)
- **T-PMC-E** — «helpful» wiring: adding the carrier to `.husky/`, `validate`, a hook, or
  CI during B1/B2 because «consumers will forget to run it». That is W-3's violation
  exactly; promotion pressure is B3's evidence-gated decision, not an implementation
  detail. (The `audit-self.yml` step for the SELF-TEST is not this — it tests the
  framework's own artifact; it never invokes the carrier on consumer repos.)

## §5 Host acceptance

```bash host-verify
# — B1 arms (append-only: B2 adds its lane self-test commands BELOW, never edits these) —
test -x packages/core/audit-self/pre-merge-local.sh
test -x packages/core/audit-self/ci-available-probe.sh
bash packages/core/audit-self/pre-merge-local.test.sh
bash tests/install-sh/pre-merge-local-delivery.test.sh
bash tests/install-sh/meta-all-wired.test.sh
if command -v shellcheck >/dev/null 2>&1; then shellcheck --exclude=SC2034,SC2016,SC2317 packages/core/audit-self/pre-merge-local.sh packages/core/audit-self/ci-available-probe.sh; fi
grep -q "pre-merge-local" setup.d/40-configs.sh
grep -q "ci-available-probe" setup.d/40-configs.sh
grep -q "LOCAL PRE-MERGE PASS" packages/core/audit-self/pre-merge-local.sh
grep -q "ci-available-probe" packages/core/templates/shared/AI-USAGE-GUIDE.md
grep -qiE "actions minutes|ci-available-probe" INSTALL-FOR-AI.md
npx vitest run --root packages/core principles/41-shell-test-ci-coverage.test.ts
bash tests/install-sh/refresh-covers-full-delivery.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

(B1 contract; the two `.test.sh` homes are ratified by this kickoff — spec §a.6 names the
behaviour arms, §3 names arms 6-7 and the delivery arm. Run the block against a COMMITTED
tree: principle 41's population is `git ls-files`, so on an untracked working copy it
passes vacuously — the new test files are not in its population yet. The last three commands are the
gates B1's new files and delivery lines will trip if the wiring is skipped: principle 41
(every tracked `*.test.sh` must be CI-invoked, empty allowlist), the refresh-coverage gate
(every `copy_safe` delivery mirrored in `do_refresh`), and the install snapshot. B2
APPENDS its lane commands below the B1 block in the same PR that adds them — an amended
contract, never a bypassed one; B1 lines are append-only history. A B1 run of this block
on the host is the acceptance authority; a green container run is not evidence
([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).)

## §6 Stage gates

- One stage = one executor session. Before EVERY dispatch:
  `SLUG=pre-merge-carrier-build bash .claude/skills/dispatcher/helpers/probe-inflight.sh` —
  and re-probe after Phase -1 completes, immediately before the actual dispatch.
- Phase -1 cold review of each stage's dispatch prompt is mandatory (meta-launch record §7
  precedent). B1's Phase -1 MUST re-check the enforcement chain of §2's B1 row: the new
  `*.test.sh` files are in principle 41's population the moment they are tracked, and the
  new `copy_safe` lines are in the refresh-coverage gate's population — confirm the wiring
  obligations are in the dispatch prompt (the docs line only EDITS an existing file under
  `packages/core/templates/shared/`; no new path lands there).
- B3 is dispatched only when its trigger has observably fired (a ledger line quoted, per
  spec §f) — never by calendar.
- Stage-closing merges: if `gh pr merge` dies with a GraphQL EOF, use the REST path —
  `gh api -X PUT repos/<o>/<r>/pulls/<n>/merge -f merge_method=squash -f sha=<head>`
  (handoff §5, already paid for).
- When the last stage merges, the merging session writes `done.md`
  ([operational-conventions.md §1](../../../docs/meta-factory/operational-conventions.md)).
- **Phase -1 record for THIS kickoff** (handoff §2 step 3): 2× Opus cold review with a
  mechanical/architectural focus split, 2026-08-18 — round 1 REVISE (2 BLOCKER, 4 MAJOR,
  11 MINOR across both seats; the blockers were the dead `_copy_or_refresh` refresh branch
  and the unwired principle-41 chain), amended, round 2 **GO × 2**. Residual MINORs folded
  in; the spec §c supersession note landed with this kickoff.

## §7 See also

- [S0 design spec](../../../docs/superpowers/specs/2026-08-18-pre-merge-carrier-design.md) — the build contract (§a-§g).
- [Build handoff](../../../docs/superpowers/specs/2026-08-18-pre-merge-carrier-build-handoff.md) — decision record + aif fitness probes + paid-for traps (§5).
- [S0 umbrella kickoff](../pre-merge-carrier/kickoff.md) — the ratified constraints B-stages inherit (§2 there).
- [prior-art-evaluations.md rows #259-#263](../../../docs/meta-factory/prior-art-evaluations.md) — what the `Prior-art:` trailers cite.
