# Development efficiency S5 — KEEP fingerprints and refresh ledger

> **Decision:** KEEP. **Observed:** 2026-10-25 UTC. The filename dates the program.
> **Authoritative for:** the bounded S5 residual-maintenance decision and its return conditions.
> **NOT authoritative for:** migration execution, installed acceptance, S1–S4 closure, or D1–D3 implementation.

## Decision and authority

Keep the current fingerprint representation, early freshness consumer, independent
package comparison and runtime refresh ledger. Residual manual effort and migration
payoff remain UNKNOWN. Existing automation already performs capture, comparison and
package assembly; no measured net benefit justifies another representation now.
This is a successful decision-stage outcome, not a claim of eliminated bookkeeping.

Binding intent: [S5 kickoff](../../../.claude/orchestrator-prompts/development-efficiency/kickoff-s5.md)
and [design §10](../specs/2026-10-22-development-efficiency-design.md#10-s5--decide-whether-fingerprint-migration-pays).
Their SHA256 values are respectively
`a72ab59e65b89b8ee61a3ae0fb5ab584b43be4fab2ad5aee062a605fcd484ef4` and
`22efd36f9a3d08e8f087d4bf7678444f58dbfbf80fcc15212642148c6940487a`.
The umbrella is `7c4a1949423746e57fb2d7bbf98e7c08de3328ace1588a663d70fbb53e8aeee1`.
Original plan-prep authority passed on 2026-10-25 with matches attempt
`ab51569fc129f2bcc37f8c05af8f8d58e125cb7430692101d7ab4f42a652f67b` and approved brief
`e1d88b90d4996999c058aab6a52df6d28ed707c56d2bdc5c835dbe6d56c8100e`.
No replacement approval was created.

Source observation base: `8ae9f41584377a0d70a89c79c40b4fabbc150be1` (staging).
Required S1 [PR #2127](https://github.com/artyhoo/getff/pull/2127) was verified merged
at `2026-10-24T11:28:22Z`, merge `817dc1d0763e0e33736f4447f37d9b56a722a0ff`.
Accepted head `cc384a7b8c224439a1c6fbd9f3b5da9d95beb83e` and merge share tree
`c15276cffa1c67a49df079519f2f613cca87ba34`. This satisfies S5's hard edge.

## Current oracle and existing comparator

The scope inspected is all eight npm expectations, not a sampled fixture. In the
following table each cell names `tests/install-sh/baselines/<cell>.fingerprint`;
columns give the canonical hook, compatibility hook and ledger row numbers.

| Cell                    | `.agents/hooks/precompact-residue.sh` | `.claude/hooks/precompact-residue.sh` | `.ai-factory/refresh-baseline.json` |
| ----------------------- | ------------------------------------- | ------------------------------------- | ----------------------------------- |
| ts-server/greenfield    | 16                                    | 252                                   | 219                                 |
| ts-server/brownfield    | 15                                    | 252                                   | 218                                 |
| react-next/greenfield   | 16                                    | 254                                   | 221                                 |
| react-next/brownfield   | 15                                    | 254                                   | 220                                 |
| react-spa/greenfield    | 16                                    | 254                                   | 221                                 |
| react-spa/brownfield    | 15                                    | 254                                   | 220                                 |
| react-native/greenfield | 16                                    | 254                                   | 221                                 |
| react-native/brownfield | 15                                    | 254                                   | 220                                 |

All sixteen hook rows have SHA256
`4a54d3421fde771cc972fe99795eed9731afe8b17de36810985e05bd3dee96fd`.
The eight whole-ledger hashes are scenario-specific. Source compatibility path is a
symlink to `../../.agents/hooks/precompact-residue.sh`; fixture expectations describe
two delivered regular files. Source and installed file identity must stay distinct.
Delivery uses `setup.d/10-skills.sh:457`, `setup.d/portable-bindings.sh:336` and
`setup.d/portable-bindings.sh:49`; only Markdown is transformed by that copy helper.

- `tests/install-sh/snapshot.sh:96` records installed regular bytes and symlink
  identities; `tests/install-sh/snapshot.sh:338` installs and diffs expectations.
  The default remains fifteen cells (`tests/install-sh/snapshot.sh:357` and
  `tests/install-sh/snapshot.sh:378`). Capture and comparison are existing commands,
  not eight manually authored hash calculations. File modes and installer stdout
  are outside this fingerprint oracle; source behavior needs its existing tests.
- `packages/core/hooks/pre-push.ts:1873` parses literal fingerprint hash rows;
  `packages/core/hooks/pre-push.ts:1944` checks changed source pre-images against
  recorded homes, and `packages/core/hooks/pre-push.ts:1969` names recapture on
  staleness. Additions and transformed output require their other checks. A second
  consumer derives shipped Markdown membership (`packages/core/hooks/pre-push.ts:2615`).
- `setup.d/lib.sh:395` stages delivered paths; `setup.d/lib.sh:879` hashes final
  on-disk bytes. Flush merges weak records, previous records, then actual writes
  (`setup.d/lib.sh:930`). `install.sh:1766` flushes after transformations. The ledger
  protects refresh ownership; a whole-file golden hash is not a semantic proof of
  retained-record preservation. These snapshot cells use fresh force installs
  (`tests/install-sh/snapshot.sh:191`), not a refresh acceptance scenario.
- `scripts/build-getff-dist.sh:178` assembles tracked source, resolving allowed
  aliases; `scripts/build-getff-dist.sh:248` regenerates in scratch. Its archive
  comparator independently checks exact members, payload and five metadata hashes
  (`scripts/build-getff-dist.sh:119`, `scripts/build-getff-dist.sh:134`). It does not
  replace installed-fixture or runtime behavior checks.

Reuse basis: SSOT #267 (`docs/meta-factory/prior-art-evaluations.md:340`) owns npm
files/prepack assembly; #270 (`docs/meta-factory/prior-art-evaluations.md:343`) owns
scratch regeneration and independent comparison. Design §13 additionally retains
#111/#274/#277 for review/citation economy and #258/#307/#308 for task/review identity.
S5 reuses those decisions and the existing commands. It adds no capability or
negative-existence claim about alternative tools; no new dependency survey is needed.

## Evidence and cost applicability

Observed on 2026-10-25; historical events keep their actual dates and inputs.

| Evidence                                                                                                                                           | Observed work                                                                                                                                                                             | Applicability and limit                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-20 commits `e5c511601d7432fac968b1b017ba2c8afd8323b3` and `abde02fa6ab164b8525fc04f1af3337b8884a2a0`                                       | One comment citation changed; eight npm fingerprints changed three rows each, 24 rows total. Retained episode reports eight fresh comparisons and seven historical unchanged cells.       | Demonstrates the cascade before S1. Commit timestamps are not active handling time. No fifteen-fresh-cell claim for this episode.                            |
| S1 initial navigation/capture evidence, 2026-10-23                                                                                                 | A disposable renderer moved the unique symbol from line 48 to 68 without changing candidate hook bytes; full capture had 15 cells, eight changed by the same three rows, seven identical. | Demonstrates removed navigation trigger and one-time initial maintenance. It does not measure the frequency of future payload edits.                         |
| S1 later delivery repairs, accepted by 2026-10-24 merge                                                                                            | A separate capture changed injector/ledger rows in all 15 cells after actual injector and delivery fixes.                                                                                 | Different payload and scope. Do not price this repair as the comment-only cascade or as S5-removable execution.                                              |
| Next real authorized source changes: S2 merge `819582ad868dcfd21c7fad481e3e33bc2bb7cccd`, then S3 merge `8ae9f41584377a0d70a89c79c40b4fabbc150be1` | Git path comparisons show zero fingerprint changes and no canonical precompact edit in each transition. S2 repaired runner import/selection/failure interfaces.                           | Real subsequent work, not a synthetic benchmark. Neither is a matched precompact payload intervention; zero churn here proves no marginal time/token saving. |

Retained source identities, observation commands and SHA256 values are in the local
`existing-change-evidence.json` under this S5 evidence root:
`/Users/art/.codex/visualizations/2026/10/25/01a17272-7949-76b1-a95c-5b13f77973e0/s5-evidence`.
Historical S1 root is
`/Users/art/.codex/visualizations/2026/10/23/01a167eb-39b1-7b23-8325-d9ce74613d89`.
Its `s1-evidence/navigation.json` SHA256 is
`8a9d36d1ff2548a6e60fe777c9bc57a336479af52efaaba7339160ece8930285`;
initial `s1-evidence/generated-closure.json` is
`d4cc9cd6852aaf00d09d55689ccfd23c8542bb1ec5cfe065f1371dfeabf4e8b6`;
later `s1-repair/generated-closure.json` is
`7fa6000a762dfaad3ba05b0ed02a27c3b8f1e7b46dc830b8fd492433f6595f5e`.
These are retained local receipts, not newly executed S5 acceptance tests.

| Cost category                | Existing path                                                                                     | Replacement comparison                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Capture/update handling      | Automation produces expectations; observed row counts above. Active manual/model seconds UNKNOWN. | Could remove selected literal updates; actual saved handling UNKNOWN.                                                                                  |
| Comparison execution         | Real install/fingerprint/diff remains required for applicable fixtures.                           | Representation alone removes no required test executions; local suite walltime is not handling effort.                                                 |
| Evidence assembly            | Existing logs, closure and canonical result are reused here. Incremental handling UNKNOWN.        | No proven reduction; mapping/fault evidence would also need assembly.                                                                                  |
| Waiting / usable destination | Source delivery and installed custody remain separate; comparable wait attribution UNKNOWN.       | Representation does not establish shorter review, CI, custody or installation waits.                                                                   |
| Migration and recurring work | No new representation to maintain. Existing recapture remains necessary for real payload changes. | Mapping/schema, early-consumer integration, ledger validation and fault/rollback controls incur work; implementation hours and recurring cost UNKNOWN. |
| Model usage                  | No attributable per-cause usage measurement.                                                      | Token/dollar savings UNKNOWN; account-wide allowance supplies no estimate.                                                                             |

No measured break-even exists. The decision relies on insufficient payoff evidence,
not a claim that residual work is small or that migration is proved more expensive.
Unknown benefit cannot justify retiring independent controls. A new installer matrix
solely to restate unchanged inputs would not resolve missing handling attribution.

## Preserved boundary, falsifier and next owner

No production, schema, baseline, oracle, test-selection or ledger change is admitted
by this decision. The optional future candidate stays limited to the two direct-copy
precompact destinations in the eight cells above. Other/transformed outputs retain
independent expectations. Unknown mappings/schema fail closed; representation and
early consumer would change together under a separately admitted implementation.

Before any later oracle retirement, demonstrate intended RED and restored GREEN for
missing canonical/alias, extra path, corruption, wrong mapping/link identity,
transformed output, missing/invalid/duplicate ledger key, unrelated mutation, stale
pre-transform hash, overwritten prior record and consumer-edit loss. Preserve independent
membership, identity, installed bytes and source behavior. Runtime ledger stays.
Optional test-only value masking has no approval here: it would first validate exact
scenario membership/values, preserve every other byte, reject ambiguous data and
distinguish retained records from fresh delivery. A fault checklist is not execution evidence.

KEEP is wrong if a subsequent real authorized covered payload change supplies a
comparable residual-handling record showing that avoided capture/update and assembly
work exceeds implementation plus recurring mapping/validation maintenance, while all
independent controls survive. Record actual inputs, required scope, usable destination,
active handling, execution and waiting separately. A repeated cascade or changed mapping
is a revisit trigger; it is not automatic migration authority. No recurring benchmark,
model campaign or new observer is required or created.

Current decision/source owner is native S5 chat `01a17272-7949-76b1-a95c-5b13f77973e0`,
checkout `/Users/art/.codex/worktrees/development-efficiency-s5/rules-as-tests-aif`,
branch `codex/development-efficiency-s5`. Existing parent pipeline owner
`01a167a0-ed84-7272-9487-4df61d9c8d8b` receives the canonical stage result and owns
prioritizing a revisit when that evidence returns; any implementation requires its own
bounded admission and owner. Rollback withdraws/corrects this decision through normal
source review, without altering consumer ledger data.

## Other stages and separately bounded deferrals

At this observation S2 is source-merged but foreign/native acceptance remains PARTIAL;
S3 is source-merged but installed economy adoption remains pending. S4's accepted source
PR #2132 is unmerged in the retained terminal result; its last CI snapshot was pending,
not green. No S4 status/CI requery was performed for this decision. Source repairs are
not measured installed improvements. Existing `--until-actionable` behavior, all custody,
five witnesses, UNKNOWN 1/1 and release/receiver-ACK conditions remain with their owners.

| Deferral                                        | Current accountable custody                                                                                                                                                                    | Return condition and disposition                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 terminated-owner recovery                    | Existing parent pipeline owner above retains the deferred design; S4 owner `01a17240-75cb-7d22-939c-fd32032ce8ee` retains its bounded source/installed reconciliation.                         | Separate durable-runtime capability design and admission after S4 boundaries; actual termination/restart/generation/duplicate/uncertain-effect/cancellation evidence. Saved state or a live waiter does not close D1.                                                                      |
| D2 HO8 proportionality and destination delivery | Existing Onebutton27/HO8 owner retains product/destination work and Dot24 retains its controller/c9 custody; parent retains program reconciliation. No foreign ownership is transferred to S5. | After applicable command/ownership repairs, compare the actual enrolled-external-red-to-bounded-triage outcome and necessary controls with a smaller adequate path. Preserve WIP/data/drain and unavailable-destination pending state. No deletion, deployment or retry follows from KEEP. |
| D3 unknown incident causes                      | Existing Integration25/Root25 and Windows24 owners retain their incidents/caps; parent retains deferred cause disposition.                                                                     | Discriminating diagnostics plus an authorized verified changed recovery condition. Socket resets, disappeared processes and historical timeouts remain UNKNOWN; no outage/quota/permission diagnosis, speculative replay or counter reset.                                                 |

Consumer41 retains installed acceptance. S5 closes only this decision slice after its
normal document/review/delivery gates. The existing program journal remains the result
home; no umbrella completion marker or heartbeat deletion follows.
