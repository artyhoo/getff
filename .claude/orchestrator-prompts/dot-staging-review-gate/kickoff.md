# Dot staging review gate — canonical umbrella kickoff

> **Status:** PUBLISHED 2026-10-05 as the staging dispatch input for this umbrella. Protocol pinned `dot-staging-review/1.0`. This kickoff authorizes nothing by itself: autonomous launch stays BLOCKED until every [setup manifest](../../../docs/meta-factory/dot-review-handoff.md#setup-manifest) field resolves and S0–S4 receipts exist.
> **Rigor label (L0):** `build-and-verify` — every stage needs live receipts against the declared host-verify contract; no new research is authorized by dispatches under this kickoff.
> **Authoritative for:** dispatch order, scope boundaries and the host-verification contract for any future `/pipeline dot-staging-review-gate` or aif stage dispatch.
> **NOT authoritative for:** Dot's operating instructions — [DotStagingReviewV1 protocol](../../../docs/meta-factory/dot-review-protocol.md); result shape — [schema](../../../docs/meta-factory/dot-review-result.schema.json); setup receipts and runbooks — [handoff](../../../docs/meta-factory/dot-review-handoff.md); design rationale — [spec](../../../docs/superpowers/specs/2026-10-05-dot-staging-review-gate-design.md); full stage detail — [implementation kickoff](../../../docs/superpowers/plans/2026-10-05-dot-staging-review-gate-kickoff.md); project goal — [README §why-this-exists](../../../README.md#why-this-exists).

## §0 Dispatch authority and boundaries

- **No dispatch until the implementation has merged.** `/pipeline` and aif sessions read `staging`: a dispatch is valid only after the implementation PR (`scripts/dot-review-gate/`, `tests/dot-review-gate/`, repair record, prior-art #314) is on `staging`. Sequence per [kickoff-staging-placement §1](../../../.claude/rules/kickoff-staging-placement.md): author → merge → dispatch.
- **Operator-gated, never agent-owned:** GitHub admin/settings changes (protection, rulesets, required checks), App enrollment, OAuth/webhook credentials, hosting/ledger provisioning, scheduling actual Dot work, main promotion, purchases or paid model APIs. Agents prepare receipts and runbooks; the operator executes these.
- **Dot is reviewer-only:** its own cloud environment, local access disabled, no Codex/Work/background-agent delegation, no external model APIs or purchased credits; Dot never edits code, resolves conflicts, pushes or merges. The executor owns merge-forward + fresh CI + fresh review request.
- **Probe discipline:** run `SLUG=dot-staging-review-gate bash .claude/skills/dispatcher/helpers/probe-inflight.sh` before any dispatch and `--late` in the same turn as every outward irreversible act (PR create, merge, chip). `PROBE-INCOMPLETE`/`LATE-COLLISION` = STOP.
- **No stage has two owners.** Live S0–S5 steps are operator-supervised; local test/implementation stages are single-owner dispatches.

## §1 Read first (fresh session — you inherit no memory)

1. [README §why-this-exists](../../../README.md#why-this-exists) — project goal.
2. [.claude/session-bootstrap.md](../../../.claude/session-bootstrap.md) — invariants, reading order.
3. [CLAUDE.md](../../../CLAUDE.md) — PR merge policy (never `--body` with squash; check `autoMergeRequest` first), artifact ownership, harness gates.
4. The packet docs listed in the header (protocol → schema → handoff → spec → implementation kickoff), in that order.
5. Active discipline rules: kickoff-staging-placement, no-paid-llm-in-ci, attention-is-not-a-mechanism, build-first-reuse-default, destination-environment-verification, language-discipline.
6. [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) + implementation kickoff §6 traps (T2/T3/T4/T7/T11–T16/T19–T22, T-DOT-A…D) — instantiate countermeasures, do not cite them.

## §2 Stage order (detail lives in the implementation kickoff §3)

| Stage | One-line scope | Gate to exit |
| --- | --- | --- |
| S0 | Feasibility + enrollment proof; disposable objects only; evidence under `docs/meta-factory/research-patches/` | P2/P3/P5/P6/P8 proved or specific STOP |
| S1 | Trusted contract, mechanical inventory, strict parser/validator, policy promotion rules | Negative matrix rejects every non-authorizing case |
| S2 | Intake, queue, transactional ledger, isolated publisher (checks-write only) | Replay/crash/restart tests; no PR code reaches secrets |
| S3 | Dot protocol adoption, reporter feedback, observation mode `dot-review/observe-v1` | Real authenticated Dot report with provenance |
| S4 | Disposable native matrix + semantic calibration | All spec §10 rows proved; unresolved negative blocks S5 |
| S5 | Operator promotion: strict + `dot-review/v1` bound to publisher app_id + pause | One authorized admission observed end-to-end |

Mechanism repair state: review findings R1–R11 are dispositioned in `docs/meta-factory/dot-review-gate-repair-record.md` (11 suites, 197 arms) once the implementation PR lands — read it before any live stage; nothing there is evidence a live proof ran.

## §3 Host-verification contract

Every stage's acceptance evidence MUST come from these commands run on the host from the repo root — a container green or a chat summary is not evidence. Any non-zero exit fails the contract. The suites exist only after the implementation PR merges (§0).

```bash host-verify
bash scripts/dot-review-gate/strict-json.test.sh
bash scripts/dot-review-gate/validate-report.test.sh
bash scripts/dot-review-gate/load-policy.test.sh
bash scripts/dot-review-gate/readiness.test.sh
bash scripts/dot-review-gate/ledger.test.sh
bash scripts/dot-review-gate/intake.test.sh
bash scripts/dot-review-gate/publisher.test.sh
bash scripts/dot-review-gate/reporter.test.sh
bash scripts/dot-review-gate/armer.test.sh
bash scripts/dot-review-gate/service.test.sh
bash scripts/dot-review-gate/harness.test.sh
echo "98b10f4f1378495241b808265902e6555d2592af6f61454d11cc484d4ae323b0  docs/meta-factory/dot-review-result.schema.json" | shasum -a 256 -c -
npx markdownlint-cli2 "docs/meta-factory/dot-review-*.md" "docs/superpowers/specs/2026-10-05-dot-staging-review-gate-design.md" "docs/superpowers/plans/2026-10-05-dot-staging-review-gate-kickoff.md"
make self-audit
```

The `shasum -c` arm enforces the schema byte pin recorded in the [handoff setup manifest](../../../docs/meta-factory/dot-review-handoff.md#setup-manifest) — any drift is a STOP, never a re-pin by the dispatching agent. The protocol file digest at publication: `0fb5bfe74bd8c3fe2f9eb2f4a46cf96e1938b23da8f5367317b2e7869f463e66`; at S5 the operator pins the promoted release's digests in the manifest, and those pins replace these.

**Live configuration probes (operator-supervised; run with the enrolled observer identity — read-only):**

```bash
gh api repos/artyhoo/getff/branches/staging/protection
gh api repos/artyhoo/getff/rulesets
```

Expected until S5: `strict:false`, exactly the three mechanical contexts (`ci-success`, `fidelity-verdict-in-pr-body`, `stale-revert-in-pr-diff`), zero rulesets, no `dot-review/*` context anywhere. After S5: `strict:true`, the reconciled six mechanical contexts + `dot-review/v1` with `app_id` equal to the publisher App, the `dot-review-pause` ruleset retired, and the observer JSON archived as the receipt. A 403/404 from these reads is **UNVERIFIED** — never green.

## §4 Health, limits, return

Limits, pause ordering (native pause BEFORE service pause) and rollback are owned by the [handoff §6–§7](../../../docs/meta-factory/dot-review-handoff.md) — do not restate them in stage reports, link the manifest state instead. Return contract per [implementation kickoff §7](../../../docs/superpowers/plans/2026-10-05-dot-staging-review-gate-kickoff.md): GO/REVISE/STOP + COMPLETE/INCOMPLETE, stage receipts with exact revisions and digests, measured negative-matrix outcomes, remaining prerequisites. Do not call setup complete without live evidence; do not silently weaken source authentication, freshness or spending limits.
