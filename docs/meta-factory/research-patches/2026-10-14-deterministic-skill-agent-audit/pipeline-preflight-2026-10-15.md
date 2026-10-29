# Deterministic core — named pipeline preflight

> **Authoritative for:** observations and gate disposition from the explicit `$pipeline deterministic-core` invocation on 2026-10-15.
> **NOT authoritative for:** implementation approval, published input availability, current global roadmap truth or runtime acceptance.

## Outcome

**HALT at plan currency (F1).** The named kickoff exists locally, but that helper's exit zero proves existence only. No launch table/meta-launch input, claim, worker, runtime task, implementation or publication was created by this invocation.

The installed canonical pipeline planning reference section 1 requires a drift report and maintainer acknowledgement before proceeding; failures.md F1 says to halt before sections 2/3. This is the reason for the hold, not a new architecture/product approval request. The unchanged specification agreement and prior kickoff reviews remain valid.

## Live evidence

- Source HEAD: `80196f2f9e3546ceffa00c0cb362903d1eebaebe`, detached. Normal index: two new regular kickoff files; research/design documents remain untracked.
- `integer-name-guard.sh --auto`: exit 0. `parse-override-flags.sh deterministic-core`: exit 1, the documented no-override outcome. `plan-currency-check.sh deterministic-core`: exit 0 with kickoff EXISTS and END trailer; not a CURRENT/merged verdict.
- `gh pr list --search "is:open" --json number,title,state,headRefName,baseRefName --limit 20`: exit 0, nine rows, below the bound. Eight target staging: #2097, #2080, #2079, #2076, #2074, #2067, #2063, #2025. #2106 targets main. No merge/CI/ownership decision is inferred from this list.
- `docs/meta-factory/wave-sequencing-plan.md:53` still says **no open PRs** in an explicitly dated 2026-09-10 snapshot. That historical snapshot is not current launch evidence. `deterministic-core` has no named row in the plan. The shared cache is supplementary and contains prior unrelated session residues.
- `git fetch origin staging`: exit 0. Fetched ref: `9868fe507910d4905cfae59cdac9cfea8ea716c2`. `git rev-list --count --left-right origin/staging...HEAD`: `4 0`.
- `git ls-tree -r origin/staging -- .claude/orchestrator-prompts/deterministic-core docs/superpowers/specs/2026-10-14-deterministic-core-design.md docs/superpowers/specs/2026-10-14-deterministic-core-coverage.md`: exit 0, no entries. The reviewed local inputs are not available on this fetched staging ref. They must be published with their resolving dependencies before factory dispatch.
- Runtime bridge mode is `aif-handoff`; `GET http://localhost:3009/health` returned HTTP success with `{"status":"ok","uptime":14032}`. Validated `/projects` response: four rows, framework project `441c1c0c-b633-4612-a34c-2cc0c4d0eaf2`, root `/home/www/rules-as-tests-aif`. Validated `/tasks` response: 407 rows, no serialized row containing `deterministic-core`. This is a bounded queue observation, not the complete multi-signal in-flight clearance. No claim was made.

The broad GitHub text search returned unrelated rows and was not used to assert absence of a feature PR. No external-source investigation or repeated architecture review was performed.

## Proposed factual reconciliation and next boundary

DRIFT-1: global plan line 53 is a historical zero-open-PR claim; the current successful bounded query returns nine open PRs. Proposed correction for a human-directed reconciliation: explicitly label that paragraph historical and record the new query date/result separately, without asserting its other remaining-work claims were reverified.

The next useful action after acknowledgement is documentation publication preparation for the agreed design, coverage, resolving authority/evidence and actual umbrella/D0 inputs. Use the existing isolated checkout/PR-to-staging route. Publication is a prerequisite to execution, not an instruction to send the entire umbrella to one worker. Do not alter the agreed design digest or replay approval. Do not run D1 before D0's actual required results/merges and later stage preparation.

At that later launch boundary, recheck in-flight signals, actual destination authority/payload, routing/channel selection and required review/placement gates. Bridge health alone is insufficient, and this invocation does not change the prior no-implementation boundary into unattended campaign authorization.

## Persistence and limits

The canonical cache Last invocation section and delta metadata were updated to record the hold. Prior global delta arrays were preserved: section 2.5 discovery/classification was not reached, so replacing arrays with a fabricated empty/current population would erase unrelated evidence. The global plan, kickoff/spec bytes, source code and normal Git index were not changed. No commit, PR, push, merge, dependency installation or execution dispatch.

### §1.7 Forward-check applied

Used canonical pipeline invocation/planning/failure references and existing cache helpers. Preserved current intent agreement, separate published-input versus local-file evidence, English artifacts, bounded GitHub/API observations and no paid inference in CI. The report grants no worker execution authority.

### §1.7 Backward-check applied

Class = claims used to admit the named feature for launch. Surfaces checked: named existence helper (existence only), local kickoff/index, fetched staging tree (inputs absent), global plan status (historical mismatch), GitHub open-PR population (nine verified rows), shared cache (supplementary), bridge health/project/task arrays (available but not full dedup), and prior spec/kickoff review authority (unchanged). No broader roadmap compliance or all-project in-flight clearance is claimed.
