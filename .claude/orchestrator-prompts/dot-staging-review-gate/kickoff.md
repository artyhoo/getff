# Dot staging review gate — canonical umbrella kickoff

> **Status:** PUBLISHED 2026-10-05; **AMENDED 2026-10-06** for the V2 contract (supersession dated in each declaring doc). Protocol pinned `dot-pr-review/2.0.0` ([DotPRReviewV2](../../../docs/meta-factory/dot-review-protocol.md)); V1 `dot-staging-review/1.0` is historical/import-only. This kickoff authorizes nothing by itself: autonomous launch stays BLOCKED until every [setup manifest](../../../docs/meta-factory/dot-review-handoff.md) field resolves and S0–S4 receipts exist.
> **Rigor label (L0):** `build-and-verify` — every stage needs live receipts against the declared host-verify contract; no new research is authorized by dispatches under this kickoff.
> **Authoritative for:** dispatch order, scope boundaries and the host-verification contract for any future `/pipeline dot-staging-review-gate` or aif stage dispatch.
> **NOT authoritative for:** Dot's operating instructions — [DotPRReviewV2 protocol](../../../docs/meta-factory/dot-review-protocol.md); result shape — [V2 schema](../../../docs/meta-factory/dot-review-result-v2.schema.json) ([V1 historical](../../../docs/meta-factory/dot-review-result.schema.json)); setup receipts and runbooks — [handoff](../../../docs/meta-factory/dot-review-handoff.md); coordination rationale — [2026-10-06 spec](../../../docs/superpowers/specs/2026-10-06-dot-pr-coordination-design.md); integration design — [2026-10-05 spec](../../../docs/superpowers/specs/2026-10-05-dot-staging-review-gate-design.md); full stage detail — [implementation kickoff](../../../docs/superpowers/plans/2026-10-05-dot-staging-review-gate-kickoff.md); project goal — [README §why-this-exists](../../../README.md#why-this-exists).

## §0 Dispatch authority and boundaries

- **No dispatch until the implementation has merged.** `/pipeline` and aif sessions read `staging`: a dispatch is valid only after the implementation PR (`scripts/dot-review-gate/`, `tests/dot-review-gate/`, repair record, prior-art #314) is on `staging`. Sequence per [kickoff-staging-placement §1](../../../.claude/rules/kickoff-staging-placement.md): author → merge → dispatch.
- **Operator-gated, never agent-owned:** GitHub admin/settings changes (protection, rulesets, required checks), App enrollment, OAuth/webhook credentials, hosting/ledger provisioning, scheduling actual Dot work, main promotion, purchases or paid model APIs. Agents prepare receipts and runbooks; the operator executes these.
- **Dot is reviewer-only:** its own cloud environment, local access disabled, no Codex/Work/background-agent delegation, no external model APIs or purchased credits; Dot never edits code, resolves conflicts, pushes or merges. The executor owns merge-forward + fresh CI + fresh review request.
- **Managed-PR roles (V2, 2026-10-06):** the executor delivers the pre-PR change review and corrections; the Claude Code coordinator owns registration, monitoring, feedback routing and merge ordering once a durable registration receipt exists; a registered managed PR strips executor self-merge/arming even on green CI ([CLAUDE.md exception](../../../CLAUDE.md), [spec §3](../../../docs/superpowers/specs/2026-10-06-dot-pr-coordination-design.md)). Dot's report acceptance never equals admission; the coordinator's journal derives readiness.
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

V2 contract milestone (2026-10-06, docs lane): DotPRReviewV2 schema/protocol/examples published; the implementation PR adapts validators, policy pins and fixtures to the same schema version/digest — declaring-document supersession, compatibility handling and fixture changes land together, and validators must not interpret V2 as V1.

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
echo "<V2_SCHEMA_SHA256_AT_CONTRACT_READY>  docs/meta-factory/dot-review-result-v2.schema.json" | shasum -a 256 -c -
node -e "const A=require('ajv/dist/2020'),f=require('ajv-formats'),fs=require('fs');const a=new A({strict:true,allErrors:true});f(a);const v=a.compile(JSON.parse(fs.readFileSync('docs/meta-factory/dot-review-result-v2.schema.json','utf8')));let bad=0;for(const [name,expect] of Object.entries(JSON.parse(fs.readFileSync('docs/meta-factory/dot-review-v2-examples/expectations.json','utf8')))){const r=JSON.parse(fs.readFileSync('docs/meta-factory/dot-review-v2-examples/'+name,'utf8'));const ok=v(r)===(expect==='valid');if(!ok){bad++;console.error('EXAMPLE MISMATCH',name)}}if(bad)process.exit(1);console.log('V2 examples: expectations met')"
npx markdownlint-cli2 "docs/meta-factory/dot-review-*.md" "docs/meta-factory/dot-review-v2-examples/README.md" "docs/superpowers/specs/2026-10-05-dot-staging-review-gate-design.md" "docs/superpowers/specs/2026-10-06-dot-pr-coordination-design.md" "docs/superpowers/plans/2026-10-05-dot-staging-review-gate-kickoff.md"
make self-audit
```

The `shasum -c` arms enforce the schema byte pins recorded in the [handoff setup manifest](../../../docs/meta-factory/dot-review-handoff.md) — any drift is a STOP, never a re-pin by the dispatching agent. `<V2_SCHEMA_SHA256_AT_CONTRACT_READY>` is filled from the CONTRACT_READY receipt in the docs PR description before dispatch. Historical publication digests (V1 protocol `0fb5bfe74bd8c3fe2f9eb2f4a46cf96e1938b23da8f5367317b2e7869f463e66`, V1 schema `98b10f4f…3b0` above) stay valid for V1-import archaeology only; at S5 the operator pins the promoted release's digests in the manifest, and those pins replace these. The examples arm checks each bounded record against both schema validity AND its declared expectation (see the examples README) — a schema-valid GO over PARTIAL coverage is still an admission denial, and the expectations file is the executable statement of that.

**Live configuration probes (operator-supervised; run with the enrolled observer identity — read-only):**

```bash
gh api repos/artyhoo/getff/branches/staging/protection
gh api repos/artyhoo/getff/rulesets
```

Expected until S5: `strict:false`, exactly the three mechanical contexts (`ci-success`, `fidelity-verdict-in-pr-body`, `stale-revert-in-pr-diff`), zero rulesets, no `dot-review/*` context anywhere. After S5: `strict:true`, the reconciled six mechanical contexts + `dot-review/v1` with `app_id` equal to the publisher App, the `dot-review-pause` ruleset retired, and the observer JSON archived as the receipt. A 403/404 from these reads is **UNVERIFIED** — never green.

## §4 Health, limits, return

Limits, pause ordering (native pause BEFORE service pause) and rollback are owned by the [handoff §6–§7](../../../docs/meta-factory/dot-review-handoff.md) — do not restate them in stage reports, link the manifest state instead. Return contract per [implementation kickoff §7](../../../docs/superpowers/plans/2026-10-05-dot-staging-review-gate-kickoff.md): V2 axes (coverage COMPLETE/PARTIAL, prior-review sufficiency, verdict GO/REVISE/DECISION_REQUIRED) + accepted-but-not-admitted negative reports, stage receipts with exact revisions and digests, measured negative-matrix outcomes, remaining prerequisites. Do not call setup complete without live evidence; do not silently weaken source authentication, freshness or spending limits.
