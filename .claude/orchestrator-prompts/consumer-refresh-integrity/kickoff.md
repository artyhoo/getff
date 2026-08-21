# KICKOFF — consumer-refresh-integrity (R1 → R2 → R3 → R4)

> **Type:** remediation umbrella (I-phase; four stages decomposed by defect class, one root
> cause each). Authored 2026-08-19 from the open-issue sweep (worktree
> `issue-sweep-2026-08-19`), operator-approved route («go», 2026-08-19).
> **Origin:** the consumer-delivery cluster measured on consumer `artyhoo/timeliner`
> (upstream-sync round 5, window `fa8da94..b811923`):
> <https://github.com/artyhoo/getff/issues/1481> (refresh clobbers consumer-owned content),
> <https://github.com/artyhoo/getff/issues/1482> (ask-leg script never delivered),
> <https://github.com/artyhoo/getff/issues/1485> (harvest gate script never delivered),
> <https://github.com/artyhoo/getff/issues/1484> (digest dead citations in every consumer;
> duplicate 1486 closed into it 2026-08-19 with its measurements absorbed).
> **Base branch:** staging. Per [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md),
> do NOT dispatch until this kickoff is merged to staging.
> **Rigor label (effort-worthiness L0):** `research-grade` — every stage edits a
> consumer-shipped surface (the `install.sh` refresh loop, delivered scripts, the
> every-prompt digest).
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** in-repo REUSE — `refresh_safe` /
> `.override.md` Layer-3 escape ([setup.d/lib.sh:376](../../../setup.d/lib.sh)), the
> consumer-owned offer-only precedent T-S5-A ([install.sh:765-780](../../../install.sh),
> getff-honest-signals S5), `copy_safe` + snapshot discipline. Implementing PRs carry
> `Prior-art:` trailers citing these. A stage that proposes a new dependency or a new
> module under `packages/` owes a fresh 6-item consult before building it.
>
> **Citation form is load-bearing** — same discipline as the
> [pre-merge-carrier-build header](../pre-merge-carrier-build/kickoff.md): issue/PR
> references are written as full URLs or bare `issue NNN` / `PR NNN`, never `#NNN`
> hash-tokens (dup-detect signal 1 greps kickoffs for hash-number tokens against merged
> PRs; measured live on `frontier-residue-sweep`, fixed in PR 1473).

## §0 Read first, in order

1. This kickoff — §1 decisions and §3 constraints are binding, not advisory.
2. The four origin issues (URLs above), INCLUDING issue 1481's follow-up comment
   (2026-08-19): the B1 carrier that clobbered the consumer's own
   `scripts/pre-merge-local.sh` is additionally **non-functional on a pnpm consumer**
   (`npm ci` fails unconditionally; base default `origin/main` resolves against a stale
   trunk) — the lane-gating half is PMCB B2's, NOT this umbrella's (§3 W-RI-1).
3. [setup.d/lib.sh](../../../setup.d/lib.sh) `refresh_safe()` (line 376) and `copy_safe()` —
   the two delivery verbs every stage here builds on.
4. [install.sh](../../../install.sh) `do_refresh` — the «Scripts → scripts/» pair-list and the
   skills/hooks arms that call `refresh_safe`.
5. [pre-merge-carrier-build/kickoff.md](../pre-merge-carrier-build/kickoff.md) §3 W-2 —
   the in-flight sibling whose surfaces this umbrella must not touch.

## §1 Decisions (authored 2026-08-19 with rationale; operator-overridable at PR review — an executor that re-opens one has left scope: park as `DECISION-NEEDED` only if the answer is *impossible* to implement as stated, with the impossibility measured)

| Fork | Answer | Rationale + consequence |
| --- | --- | --- |
| RI-1 divergence semantics: refuse or warn? | **Warn + preserve, never refuse** | On divergence: save the consumer's diverged copy, refresh anyway, print a loud `⚠` naming both paths. Practice-first ([effort-worthiness.md §1](../../rules/effort-worthiness.md)): refuse bricks the refresh loop and needs offer-only migration machinery we have not built; T-S5-A ([install.sh:765](../../../install.sh)) is the precedent for consumer-owned content. Escalation trigger recorded: the first incident where warn+preserve was insufficient (content still lost or ignored) re-opens refuse as a fork. |
| RI-2 baseline source: where does «previous upstream content» come from? | **A consumer-local manifest of delivery hashes** (`$PROJECT_ROOT/.ai-factory/refresh-baseline.json`, sha256 per delivered dst path) | A consumer has no upstream git history to diff against (issue 1481's «previous upstream blob» has no reachable copy there). Manifest is written on every install/refresh delivery; a missing entry means **unknown → today's behaviour exactly** (no divergence claim, no spam on first refresh of a pre-manifest consumer). Lives under `.ai-factory/` (consumer-local, gitignored, never tracked). |
| RI-3 namespace newly-shipped scripts (`scripts/getff-*`)? | **No renames in this umbrella** | Renaming `scripts/pre-merge-local.sh` (already delivered by PMCB B1) would itself be a clobber event — the exact class this umbrella removes. Revisit only as a migration-designed follow-up (manifest makes a tracked rename detectable). |
| RI-4 R3 delivery breadth AND source location | **Measured, not assumed** — derive per script from install reality; sources stay at root `scripts/` | Breadth: `check-ask-files.sh` is presence-gated by `pre-push.ts` `askFileSchemaSection()` (issue 1482: the gate side already shipped) → deliver wherever that hook ships. `run-local-ci-sweep.sh` is gated on by `harvest/SKILL.md` §3 → deliver wherever that skill ships (factory / `--with-aif-suite`). The executor MEASURES the profile matrix (grep the delivery sites, cite file:line); a blanket «all profiles» claim is the F5 defect class re-created. Source location: the pair-list convention sources from `packages/**`, BUT `packages/core/hooks/pre-push.ts:1323-1326` records the session-bus v2 §9 executable claim that check-ask-files' logic (and its mailbox literal) lives OUTSIDE `packages/` — relocation to satisfy the pair-list convention would violate a stated requirement, so the new entries source `$PKG_ROOT/scripts/…` as-is. Open measurement the executor owes: whether the npm-tarball install context ships root `scripts/` (probe via the `consumer-matrix-npm-tarball` Makefile target); if it does not, park as DECISION-NEEDED (packaging fix vs relocation) — do not silently relocate. |

## §1b Autonomous aif dispatch — park-don't-guess contract

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to
> `manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
> consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the
> unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists
> to prevent.

## §2 Stages

| Stage | Deliverable | Depends on | Volume |
| --- | --- | --- | --- |
| R1 | **Divergence guard in the refresh path** (issue 1481 casualties 1+3): manifest write on every `copy_safe`/`refresh_safe` delivery (RI-2); before a `refresh_safe` overwrite, if `sha256(dst)` ≠ manifest entry AND ≠ `sha256(src)` → preserve the diverged copy to `$PROJECT_ROOT/.ai-factory/refresh-conflicts/<basename>.<sha8>` (never a sibling of the live file — no new same-name collisions), print `⚠ overwriting locally-modified file: <dst> (consumer copy preserved at <path>)`, then refresh (RI-1); `--dry-run` reports `would-flag: <dst> (locally modified)` instead. `.override.md` Layer-3 behaviour untouched. Regression arms in `tests/install-sh/refresh-divergence-guard.test.sh`: (a) install → mutate a delivered file → refresh → warning printed + preserved copy exists + file refreshed; (b) untouched file → refresh → NO warning, NO conflicts dir; (c) pre-manifest consumer (delete manifest) → refresh → zero divergence claims; (d) `.override.md` file → unchanged skip path, no conflict copy; (e) dry-run lists the would-flag and writes nothing. **Snapshot regen IS required in R1**: the manifest adds `.ai-factory/refresh-baseline.json` to every installed tree the fingerprint hashes (`tests/install-sh/snapshot.sh` covers the installed tree's file paths + sha256, only `.git/` excluded) — `SNAPSHOT_MODE=capture` with the diff reviewed (expect one new state file per fixture). Excluding consumer-local state from the fingerprint is an explicit non-goal here (delivered-state drift is exactly what the snapshot should see). | — | M |
| R2 | **Barrel preserves consumer entries** (issue 1481 casualty 2): `generate_eslint_barrel` ([setup.d/40-configs.sh:195](../../../setup.d/40-configs.sh) call site; logic in ONE place per the comment above it) keeps every import/entry found in the existing `eslint-rules-local/index.mjs` that is NOT in the framework set (trivially identifiable: imports not in the framework set — issue 1481's own criterion). Arms in `tests/install-sh/eslint-barrel-preserve-consumer.test.sh`: fixture with a consumer-added rule file + hand-extended barrel → regeneration keeps the entry; framework-only barrel → output byte-identical to today. | — | S |
| R3 | **Deliver the two undelivered gate scripts** (issues 1482 + 1485): `scripts/check-ask-files.sh` and `scripts/run-local-ci-sweep.sh` enter the delivery per RI-4's measured breadth (delivery site + `do_refresh` mirror per `refresh-covers-full-delivery`'s `copy_safe`-verb extraction; profile gating per surface). Non-clobbering precondition: R1 merged first — the delivery test MUST include the diverged-existing-file arm (a consumer that already vendored the script — the timeliner case — gets the R1 warning + preserved copy, never a silent swap). Snapshot regen + `meta-all-wired` literal run lines for the new `tests/install-sh/*.test.sh`. | R1 | M |
| R4 | **Consumer-aware digest** (issue 1484, incl. absorbed 1486 deltas): `.claude/hooks/inject-session-bootstrap.sh` (the single SSOT — its own header records `@dual-pair does not apply`; companion test `packages/core/hooks/inject-session-bootstrap.test.ts`) existence-checks every path-shaped citation it renders (`.claude/rules/*`, `CLAUDE.md`, Makefile targets like `make self-audit`) against the live consumer tree at render time; an absent target degrades to the rule NAME without the dead path, never a silent drop of the invariant itself. Arms: fixture tree without the rules/Makefile/CLAUDE.md → rendered digest carries the invariant text + zero nonexistent paths; framework tree → byte-identical to today (dogfood unchanged). | — | S |

## §3 Binding constraints (do not re-derive)

- **W-RI-1 — PMCB is in flight; its surfaces are off-limits.** The two carrier scripts,
  their `setup.d/40-configs.sh` delivery lines, and their `do_refresh` pair entries were
  shipped by PMCB **B1** (merged, PR 1479); the lane runners inside
  `pre-merge-local.sh` and the npm-lane doc claims belong to **B2**
  ([pre-merge-carrier-build](../pre-merge-carrier-build/kickoff.md) §2 rows). R1's
  mechanism is generic in `refresh_safe`/`copy_safe` and MUST NOT special-case or edit
  those two pair entries' semantics or the carrier files. The pnpm-lane carrier collision
  (issue 1481 follow-up comment) is B2's lane-gating, not a rename here (RI-3).
- **The manifest and conflicts dir are consumer-local state** — under
  `$PROJECT_ROOT/.ai-factory/` only, gitignored, never tracked, never shipped as template.
- **Fail-open, exit-0 discipline preserved:** a missing/corrupt manifest (unparsable JSON,
  unreadable dir) degrades to today's behaviour with a one-line note, never a failed
  refresh (the install must stay non-blocking; precedent: `refresh_safe`'s own
  `source-gone → return 0`).
- **New `*.test.sh` homes owe their wiring** (the B1 lesson, verbatim): principle 41
  population is every tracked `*.test.sh` (empty allowlist) → CI steps + literal
  `run: bash tests/install-sh/<name>` lines asserted by `meta-all-wired.test.sh` +
  `scripts/run-local-ci-sweep.sh` `gate_table()` reachability.
- **Shipped-file edits require snapshot regen**
  (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) with the diff reviewed;
  `refresh-covers-full-delivery` must see every new `copy_safe` mirrored in `do_refresh`.
- **`INSTALL-FOR-AI.md` line budget:** 594/600 as of this authoring (`wc -l
  INSTALL-FOR-AI.md`, worktree `issue-sweep-2026-08-19`, 2026-08-19 — B1's issue-1465
  docs lines landed since the exemplar's 583 figure) against the hard 600-line gate, and PMCB
  B2 consumes lines in the same window — R3/R4 doc additions must re-measure
  (`wc -l`) and count free lines first or free them; if B2 and this umbrella race, merge
  forward per
  [git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md).
- **Portability:** all shipped-script edits stay bash 3.2-compatible, shellcheck-clean,
  no GNU-only flags ([language-discipline.md](../../rules/language-discipline.md):
  English-only machinery). No paid LLM anywhere
  ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)).

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active: **T2** (a guard designed but never run against a mutated fixture is not built —
show the runs), **T3** (every acceptance claim carries command output or file:line),
**T8** (RI-1..RI-4 are answered in §1 — do not re-ask), **T14** (a green suite with a
missing arm is «coverage insufficient», not «guard correct» — the five R1 arms are the
floor), **T19** (own cold review of the diff before handoff), **T21** (delegate the
backward sweep to a cold seat; hand it the change's class, never the diff).

Domain-specific:

- **T-CRI-A — source-grep as test.** Asserting the divergence guard by grepping
  `install.sh` for the warning string. Counter: run install → mutate → refresh on the
  fixture and assert the OUTPUT, the preserved file, and the refreshed file (arms a-b).
- **T-CRI-B — first-refresh spam.** A consumer that installed before the manifest existed
  must see zero divergence claims (RI-2 unknown ≠ diverged). Arm (c) exists because this
  is the release-blocking failure mode: a noisy warning trains operators to ignore the
  exact signal the umbrella ships.
- **T-CRI-C — clobber-by-another-name.** R3 delivering a script onto a consumer that
  already vendored it (the timeliner case for BOTH scripts) must fire the R1 warning —
  the delivery test's diverged-existing-file arm is the acceptance for «non-clobbering
  delivery» (issue 1485's own precondition).
- **T-CRI-D — PMCB scope creep.** Any R-stage edit touching the carrier rows/files is a
  W-RI-1 violation even if it «helps» — park it, do not fold it.

## §5 Host acceptance

```bash host-verify
# — append-only per stage: R2/R3/R4 add their commands BELOW the R1 block, never edit it —
bash tests/install-sh/refresh-divergence-guard.test.sh
bash tests/install-sh/meta-all-wired.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
npx vitest run --root packages/core principles/41-shell-test-ci-coverage.test.ts
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
npx vitest run --root packages/core hooks/inject-session-bootstrap.test.ts
```

(R1 contract; R2 appends `bash tests/install-sh/eslint-barrel-preserve-consumer.test.sh`,
R3 appends its delivery test, R4 appends
`npx vitest run --root packages/core hooks/inject-session-bootstrap.test.ts` — an amended
contract, never a bypassed one; R-stage lines are append-only history. Run the block
against a COMMITTED tree: principle 41's population is `git ls-files`, so an untracked
new test file passes vacuously. A host run of this block is the acceptance authority; a
green container run is not evidence
([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).)

## §6 Stage gates

- One stage = one executor session. Before EVERY dispatch:
  `SLUG=consumer-refresh-integrity bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
  — and re-probe immediately before the actual dispatch.
- Phase -1 cold review of each stage's dispatch prompt is mandatory (meta-launch record §7
  precedent; this kickoff's own authoring PR ran its cold review before merge — see its
  `## Phase -1` section).
- R3 is dispatched only after R1 is merged (its acceptance depends on the guard being
  live; R2/R4 are dispatchable in parallel with either).
- When the last stage merges, the merging session writes `done.md`
  ([operational-conventions.md §1](../../../docs/meta-factory/operational-conventions.md)).

## §7 See also

- Origin issues: 1481, 1482, 1484 (+1486 absorbed), 1485 (URLs in the header).
- [pre-merge-carrier-build/kickoff.md](../pre-merge-carrier-build/kickoff.md) — the
  in-flight sibling whose W-2 this umbrella honours (§3 W-RI-1).
- [install.sh:765-780](../../../install.sh) — T-S5-A consumer-owned offer-only precedent
  (RI-1's in-repo prior art).
- [getff-honest-signals S5](../getff-honest-signals-s5/kickoff.md) — the stalemate
  resolution pattern for consumer-owned files this umbrella generalises.
