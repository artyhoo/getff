# KICKOFF — refresh-prune-consumer-rule (P1)

> **Type:** remediation umbrella, single stage (I-phase). Authored 2026-09-01 by the
> beta-release night seat from the open-issue triage; operator-approved route («да, чип на
> aif-диспатч», 2026-09-01) — the ONE open BLOCKER for the beta-program phase-1 exit
> («0 open BLOCKER issues»).
> **Origin:** <https://github.com/artyhoo/getff/issues/1519> — `generate_eslint_barrel`'s
> stale-rule prune (the issue-882 loop, [setup.d/lib.sh:1239-1252](../../../setup.d/lib.sh))
> `rm -f`s a CONSUMER-authored rule (`eslint-rules-local/<name>.ts` + `.mjs` + `.d.ts`)
> because its basename is not in the current stack's valid set, BEFORE the issue-1481
> preservation loop ([setup.d/lib.sh:1256-1270](../../../setup.d/lib.sh)) can keep its barrel
> entry — silent data loss on `--refresh`, no `⚠`, no preserved copy. **Reproduced live
> 2026-09-01** on a fixture consumer (`install.sh ts-server --profile core`, add
> `consumer-only.ts` + `.mjs`, `--refresh`): output line `· pruned stale rule [consumer-only]
> — not part of the ts-server stack`, both files gone (repro transcript in the issue's
> 2026-09-01 comment).
> **Base branch:** staging. Per [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md),
> do NOT dispatch until this kickoff is merged to staging.
> **Rigor label (effort-worthiness L0):** `research-grade` — the edit is in the installer's
> refresh path, the surface every consumer's second command touches.
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** in-repo REUSE only — the
> «framework-attributable» criterion already computed for the barrel preservation loop
> (`_fw_basenames`, [setup.d/lib.sh:1266-1274](../../../setup.d/lib.sh), PR 1505) is the
> exact predicate the prune lacks; the R1 divergence guard (`refresh_baseline_diverged()`,
> PR 1503) is the sibling precedent for «warn, never silently destroy». No new module or
> dependency; a stage that proposes one owes a fresh 6-item consult.
>
> **Citation form is load-bearing** — issue/PR references are full URLs or bare
> `issue NNN` / `PR NNN`, never hash-tokens (dup-detect signal 1, issue 1517).

## §0 Read first, in order

1. [README.md#why-this-exists](../../../README.md#why-this-exists) → [.claude/session-bootstrap.md](../../session-bootstrap.md) → [CLAUDE.md](../../../CLAUDE.md).
2. The issue (URL above) and its 2026-09-01 repro comment.
3. [setup.d/lib.sh](../../../setup.d/lib.sh) `generate_eslint_barrel` — the prune loop at
   1239-1252 and the preservation loop at 1256-1270 (line numbers as of staging
   `ff6a02245c`; re-locate by the comment `# issue 1481 casualty 2` before editing).
4. [tests/install-sh/refresh-divergence-guard.test.sh](../../../tests/install-sh/refresh-divergence-guard.test.sh)
   — the fixture-install test shape to mirror (arms, `PASS=/FAIL=` summary line).

## §1 Decisions (authored with rationale; operator-overridable at PR review)

- **RP-1 — the prune keeps every rule that is NOT framework-attributable.** Move the
  `_fw_basenames` computation ABOVE the prune loop and change the prune condition to
  «basename ∉ valid-for-this-stack AND basename ∈ `_fw_basenames`». A rule absent from
  EVERY framework rules dir (core + all presets, all stacks) is consumer-owned by the
  issue-1481 criterion and is left untouched — files AND barrel entry. Rationale: one
  predicate, two loops, no new concept; the issue-882 cross-stack prune stays intact (a
  stray rule from a different `--stack` IS framework-attributable → still pruned).
- **RP-2 — pruning is announced per file it deletes, exactly as today; keeping is silent.**
  No new `⚠` for kept consumer rules (they are the consumer's own files — nothing to warn
  about). Rationale: the divergence guard warns about DIVERGED framework files; a consumer
  rule is not framework-owned, so the R1 manifest does not apply and must not be extended
  here.
- **RP-3 — regression home is a new `tests/install-sh/refresh-prune-consumer-rule.test.sh`**,
  fixture-install shape (mirror `refresh-divergence-guard.test.sh`), with arms:
  (a) consumer `.ts`+`.mjs`+`.d.ts` + hand-added barrel entry survive `--refresh`
  byte-identical (the issue's table); (b) PAIRED NEGATIVE — a framework rule from a
  DIFFERENT stack planted in `eslint-rules-local/` is still pruned and its barrel entry
  dropped (issue-882 behaviour unchanged); (c) fresh install with zero consumer rules
  produces a byte-identical barrel (pre-change control); (d) RED-before-GREEN: the test
  MUST be run once against the unpatched `lib.sh` and its FAIL observed (paste the line
  in the PR body) before the fix commit.
- **RP-4 — no delivered-file bytes change.** `setup.d/lib.sh` is installer machinery, not
  a shipped artefact; the install snapshot fingerprint is expected unchanged. If
  `SNAPSHOT_MODE=compare` goes red, STOP — that means the fix touched a delivered file, which
  is out of scope; park it.

## §1b Autonomous aif dispatch — park-don't-guess contract

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to
> `manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
> consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the
> unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists
> to prevent. Known non-forks (already decided above): RP-1..RP-4.

## §2 Stages

| Stage | Content | Depends on | Size |
|---|---|---|---|
| P1 | RP-1 prune predicate in `setup.d/lib.sh` `generate_eslint_barrel` (move `_fw_basenames` above the prune; condition per RP-1); RP-3 test file with arms (a)-(d); principle-41 wiring for the new `*.test.sh` (CI step inside an EXISTING `audit-self.yml` install-sh shard, `tests/install-sh/meta-all-wired.test.sh` literal `run:` line, `scripts/run-local-ci-sweep.sh` `gate_table()` reachability); the issue's 2026-09-01 repro replayed on the patched tree and pasted in the PR body | — | S |

Order: single stage. One PR onto staging; closure writes `done.md` and the PR body carries
`Closes <issue URL>` so the issue closes on merge.

## §3 Binding constraints (do not re-derive)

- **Issue-882 behaviour preserved** — arm (b) is mandatory; a fix that keeps stray
  framework rules from other stacks is a regression, not a fix.
- **PMCB B2 surfaces off-limits** (W-2 honour): no edits to `packages/core/audit-self/**`
  or `setup.d/40-configs.sh` carrier lines.
- **`lib.sh` has exactly one prune site** — verify with `grep -n 'pruned stale rule'
  setup.d/lib.sh install.sh setup.d/*.sh` before editing (the deps-hash 3-way-guard class);
  a second site means this kickoff under-counted and the executor parks.
- **Portability:** bash 3.2-compatible, shellcheck-clean (`shellcheck setup.d/lib.sh` is
  a CI step), no GNU-only flags; English-only machinery
  ([language-discipline.md](../../rules/language-discipline.md)); no paid LLM
  ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)).
- **PR body gates:** `### §1.7 Forward-check applied` / `### §1.7 Backward-check applied`
  each with a real `path.ext:NN` citation; `## Fidelity verdict` with `FIDELITY: GO` +
  `Basis: <this kickoff path>` + `Round: <n>` + `Audited-SHA: <PR head>` from a cold
  [agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) run (this IS a stage PR —
  `skipped` is not available); not a capability commit (≥80-LOC test files are exempt only
  if `*.md`; a `*.test.sh` ≥80 LOC under `tests/` is NOT under `packages/`, so no
  `Prior-art:` trailer is forced — add one anyway citing the in-repo REUSE above).

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

- **T3** — every claim in the PR body carries command output or `file:line`; the RED
  observation of RP-3(d) is pasted verbatim, not described.
- **T15** — paired negative: arm (b) must be seen RED if the prune is disabled outright
  (a fix that deletes the prune loop passes (a) and fails (b)); observe both directions.
- **T19** — run your own adversarial cold review of the diff before handoff: «which
  consumer layout did the arms NOT cover?» (multi-stack monorepo; a consumer rule whose
  basename COLLIDES with a framework rule of another stack — that one is framework-
  attributable by construction and IS pruned: state it in the PR as an accepted edge, do
  not silently widen scope to solve it).
- **T20** — no recommendation in the PR without a tool-backed quote.

## §5 Host acceptance

```bash host-verify
bash tests/install-sh/refresh-prune-consumer-rule.test.sh
bash tests/install-sh/refresh-divergence-guard.test.sh
bash tests/install-sh/meta-all-wired.test.sh
npx vitest run --root packages/core principles/41-shell-test-ci-coverage.test.ts
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
shellcheck setup.d/lib.sh
```

(Run against a COMMITTED tree — principle 41's population is `git ls-files`. A host run of
this block is the acceptance authority; a green container run is not evidence
([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).)

## §6 Stage gates

- Before dispatch: `SLUG=refresh-prune-consumer-rule bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
  — re-probe immediately before the actual dispatch.
- Phase -1 cold review of the dispatch prompt is mandatory (meta-launch record precedent).
- When P1 merges, the merging session writes `done.md`
  ([operational-conventions.md §1](../../../docs/meta-factory/operational-conventions.md)).

## §7 See also

- Sibling umbrella [consumer-refresh-integrity](../consumer-refresh-integrity/kickoff.md)
  (R1 guard + R2 barrel preservation — this kickoff closes R2's live residue).
- [.claude/rules/git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md).
