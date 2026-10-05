# Project skill repairs — senior result

> **Authoritative for:** the repaired implementation snapshot, observed verification and senior acceptance for this task.
> **NOT authoritative for:** project goal, live AIF/model certification, CI results not yet observed or Git delivery not yet completed.

**Senior acceptance: ACCEPTED for task-scoped junior Git delivery.** F1–F8 are repaired and deterministically verified; F9 stays OPEN. This is an author-session read-only review under the operator-invoked review-agent, not an independent cold seat or a behavioral benchmark.

## Identity and exact scope

- Workspace: `/Users/art/.codex/worktrees/9d39/rules-as-tests-aif`.
- Branch: `codex/skills-standards-repair`; base/main-worktree HEAD: `c4532e16aa369ef3c66e227dd59d8ceef9e60263`. Task commits 5024b8e26ff, e7a87061610 and fd6c7b07017 exist; normal pushes have stopped at required dependent drift gates, so no PR/merge yet. Junior continues delivery of the refreshed identity.
- Clean disposable implementation snapshot: `/var/folders/03/tk988ft10_92gfb989p1wrn40000gn/T/skills-repair-candidate-7aci2dof/repo` at `1332a811a76f7bb8618827065aa93e1695cc876b`. It contains the original 56 core implementation files including new resources; its clean status was checked after generation tests.
- Frozen binary implementation patch: `/tmp/skills-repair-accepted.patch`; SHA256 `d7eedde987d0746abde774dfb9fb1aabf8498235db2a084f7fbccc78fbab4ed1`.
- [Implementation manifest](2026-10-05-skills-repair-manifest.json): SHA256 `3a5243a3a2edb430d22e201424255d41aaca3c115623964c4a5722e314b0c6ae`; each of the 81 paths has its own SHA256. This excludes administrative task docs deliberately, avoiding a report hashing itself.
- Implementation: **14 source cards + 4 generated cards = 18 SKILL.md files**, 29 new conditional references, one amended existing claim reference, eight existing test files. No new executable skill helper or dependency.
- Administrative task files: HANDOFF, original audit, six existing preparation/role packet files, this result, manifest and [implementation review receipt](../superpowers/plans/2026-10-05-skills-standards-implementation-review.md). Stage only this manifest plus these eleven task documents; preserve unrelated WIP.

## Finding dispositions

| ID | Result | Evidence and limit |
| --- | --- | --- |
| F1 | CLOSED | Pipeline card and invocation reference describe pre-approval and binding host permissions; unconditional global workaround removed. No global settings changed. |
| F2 | CLOSED | Doctor passive inventory excludes verify-bridge/ensure-parallel; active create/delete, possible executor start and persisted full-project PUT are explicit Tier-2 operations. Tier-1 repairs remain automatic with evidence/undo. No live mutations performed. |
| F3 | CLOSED | Dispatcher execution §2.4b matches actual flags and multi-file Git Data API. Host srcdir/full listed-path replacement, preserved unlisted paths, local sweep and minted-head cold fidelity are retained. Actual documented example executed through existing gh stub: RED exit 2 before correction, GREEN exit 0 with two explicit paths afterward. |
| F4 | CLOSED | Real framework agents resolve under agents/, real React consumer agents under .claude/agents/. Plugin-only root reports missing installer protocols. Framework-only allowlist/template runner and missing consumer ./setup are named rather than fabricated. Actual research/paid inference was not run. |
| F5 | CLOSED | Framework React preset exists; actual installed React consumer delivers eslint.config.mjs. getff instructs resolving the delivered filename. |
| F6 | CLOSED | All 27 production metadata objects parse as strict YAML. Existing names, invocation flags, models and other metadata values unchanged; seven description values preserved. Native validation passed. |
| F7 | CLOSED | Six cards materially reduced, 29 conditional references preserved, all 83 original top-level sections accounted for (the detector's apparent missing doctor heading was only its rewritten link). Read-before-action constraints, chips, lifecycle and negative controls retained. No universal 200-line gate introduced. |
| F8 | CLOSED | using-getff preserves binding host/system/developer/tool rules, supports actual harness file reading and explicit-only policy, and excludes unrelated conversation. Its description was intentionally narrowed; routing quality is not certified. |
| F9 | OPEN | No new model-routing or full live workflow benchmark. Static/generation/command receipts are not model outcome evidence. Follow-up: isolated neighboring positive/negative requests under an authorized model/harness evaluation. |

## Card measurements and read conditions

Body after frontmatter, with initial blank lines stripped; words are whitespace-separated; bytes UTF-8. The original audit counted one extra leading blank line. No line-target exception.

| Skill | Lines before → after | Words before → after | Bytes before → after |
| --- | --- | --- | --- |
| pipeline | 581 → 94 | 8286 → 1070 | 79071 → 8330 |
| dispatcher | 507 → 58 | 6132 → 691 | 53344 → 5176 |
| aif-doctor | 380 → 54 | 8780 → 672 | 70469 → 4979 |
| orchestrator | 485 → 46 | 5802 → 555 | 43601 → 4234 |
| arch | 164 → 54 | 4302 → 685 | 35959 → 5069 |
| night-mode | 65 → 64 | 3171 → 634 | 24306 → 4799 |

The cards normally require these branches before their actions, not all references at activation:

- Pipeline: invocation/routing; status-only; planning/currency/classification; launch/kickoff; dispatch/claim/review/gates; artifacts/output; failures and ownership on their conditions. Its real cache command remains in the card for principle 39's seeded negative.
- Dispatcher: invocation and preflight/current execution step; parked questions; harvest/fidelity; scope/provenance. Host API escape is conditional on failed host transport, not a container-only block. Execution reference retains each §2 loop step.
- Doctor: passive inventory; matching observed failure mode; mutation tier before repair; scope/catalogue evidence only when relevant. Blind deletion, paid/config floors and proxy discrimination remain visible in the card.
- Arch: ideation/retell; evidence-driven research contour; cold design review; exit/escalation. Pinned grilling/domain-modeling and format companions are byte-identical.
- Orchestrator: glossary/bootstrap and discovery when new; intake/planning; delegation before workers; quota when choosing mode; acceptance before REPORT/publication; recovery/communication on that branch; queue only on requested multi-kickoff autonomy; rationale for history. High confidence no longer replaces source receipts.
- Night-mode: substrate/models before role assignment; all eight unattended policy deltas before first decision/dispatch/retry/push/merge; closure before done/delivery. Shared object floors and NIGHT-END chip limits stay in the card.

Untouched names: ai-doc, docs-author, installing-enforcement, reviewer, self-reflection, story. The consumer tool-bootstrapping source/generated fork stays unchanged despite the separate .claude syntax fix. Overlays and intentional fixtures stay outside production normalization.

## Verification receipts

| Check | Observed result | Scope/limit |
| --- | --- | --- |
| Python/PyYAML strict parse and metadata comparison | 27 PASS; all non-description values unchanged; only using-getff description changed semantically | Production populations only; original seven scalars normalized for comparison |
| claude plugin validate .claude/skills, skills, plugin | All exit 0 | Native structural validation, not model behavior |
| bash scripts/check-skill-drift.sh | PASS, 0 errors | Invocation contract, references and metadata presence |
| bash tests/plugin/skill-routing.test.sh | 42 PASS / 0 FAIL | Consent/routing infrastructure, not model selection |
| vitest run --configLoader runner principles/ skills/dispatcher/dispatch.test.ts skills/dispatcher/advance-frontier.test.ts | 59 files PASS; 680 PASS / 1 existing skip | Actual checkout and existing dependencies; expected core.bare=maybe negative-fixture stderr appeared |
| Earlier full skills/ run plus repaired/isolated reruns | Initial 26 files passed; relocated target tests then passed; probe-inflight + repo-root-anchor isolated rerun 77/77 | Initial parallel run also had three timing/discovery failures; all passed without timeout/assertion changes in separate --no-file-parallelism run. Not a single all-green full-skills command receipt |
| bash tests/plugin/skills-generation.test.sh | 15 PASS / 0 FAIL; candidate remains clean | Final immutable candidate listed above, not pristine baseline |
| bash tests/dispatcher/harvest-via-api.test.sh | 18 PASS / 0 FAIL | Existing stubbed API interface/mode/ref failures, no real GitHub mutation |
| Actual documented API example, same existing gh stub | RED 2 → GREEN 0; two supplied paths in minted tree | Reproduced newly introduced literal-plus error and fixed it before acceptance |
| bash tests/install-sh/ship-orchestration-skills.test.sh | 30 PASS / 0 FAIL | Real install; all conditional resources delivered; seeded reference transform leak detected |
| bash tests/install-sh/transform-internal-refs.test.sh | 21 PASS / 0 FAIL | Existing real-transform controls retained |
| Real install.sh react-next --force in temporary consumer | exit 0; .claude/agents protocols readable; eslint.config.mjs present | No --full install, npm dependencies or live research; missing framework runner/setup explicitly verified |
| Local Markdown targets/anchors | No introduced broken target or anchor | Three pinned CONTEXT-format example paths excluded; two pre-existing §-fragment candidates in untouched mode-overrides recorded, not attributed to this patch |
| format-shipped.sh --check on changed shipped sources and transformed delivery | exit 0, both phases clean | npm resolution unavailable (ENOTFOUND/ENOTCACHED); reused actual cached pinned Prettier 3.8.3 via a temporary npx adapter. No download/version/gate change. Final two repaired resources checked again |
| git diff --check and cached diff --check | exit 0 | Complete indexed candidate includes all new resources |

Tool adaptation: temporary node_modules symlink reused main-clone dependencies. Vite's default config bundler could not write through the dependency link; --configLoader runner avoided that write. The local tsx IPC needed permitted escalated execution. These are host limitations, not source fixes; no manifests/locks/global configuration changed. Remove the local symlink before junior delivery.

## Review and acceptance

[Read-only review receipt](../superpowers/plans/2026-10-05-skills-standards-implementation-review.md): first pass found a P2 literal-plus command regression; author repaired it and the actual snippet proved RED/GREEN. Final pass: **No findings.** The reviewer was this senior author session under review-agent's no-delegation/read-only rules. Independent cold acceptance and full live workflow behavior remain unmeasured; no such claim is made.

| Acceptance | Verdict | Basis |
| --- | --- | --- |
| A1 | PASS | Strict metadata/native validation and value comparison |
| A2 | PASS | Real helper sources, documented-command execution, real installer/consumer/plugin prerequisite branches |
| A3 | PASS | Six measured concise cards; explicit branch reads, preserved sections/invariants and pinned resources |
| A4 | PASS | Required deterministic suites, candidate generation, links and real delivery checks; behavioral evidence separated |
| A5 | PASS | Exact manifest/patch/clean candidate, receipts, dispositions and review limits recorded |

Paused-task capacity caveat: claim creates a paused task intended to remain backlog, but the bridge does not own the upstream capacity counter. Removed the blanket free-lane inference and require status/coordinator-log evidence; no deployed upstream capacity behavior was newly certified.

## Junior delivery

Authorized next action: read HANDOFF, this report, manifest and the revised junior prompt; verify these bytes, commit only task paths, push, create/attach a PR against staging, and normally merge only through passing required gates. No skill edits, force push, destructive reset, CI bypass, main merge, deployment or live AIF mutation. Substantive CI/conflict/upstream repairs return to senior. Return source-head/PR/merge identities, gate receipts and byte equivalence. Delivery is **PENDING** at this report's creation.

## Pre-commit citation repair (senior, 2026-10-06)

The actual pre-commit gate initially refused three blank-landed harness-posture citations. Senior replaced migrated line-number pointers across the five affected cards and their five procedure references with actual procedure locations, and corrected the dispatcher’s obsolete single-file co-location comment. No runtime command, metadata, authorization or test assertion changed. Blank-landing gate: resolved 23, skipped 18 external/ambiguous citations, exit 0; actual source/delivered formatting PASS. Principle 21: 24/24 PASS with the installed local runtime outside the restricted sandbox (the first restricted probe could not render its rule-channel data). Read-only delta review: No findings. The manifest and frozen patch below supersede the earlier accepted identities; earlier candidate/test receipts remain evidence for the unchanged procedures.

## Full pre-push dependency repair (senior, 2026-10-06)

The first normal push of 5024b8e26ff was refused by the full citation gate: 14 stale pointers. Senior refreshed the two convergence references in reviewer-discipline, seven affected reference pages, and three genuinely historical installer/test comments. Four procedure pages now declare their conditional resources as sources; doctor separates passive inventory from authorized active smoke/configuration, and template-audit describes its actual paired-negative gate. Actual doctor directory-list example now includes references. The existing render-reference --write regenerated C/I JSONs (using-getff metadata and card-scoped mention roster); --check PASS. No installer/test executable statements changed.

Additional verification: full citation corpus exit 0 (1032 resolved, 312 skipped; 56 generated deferrals and 32 lacking blame baselines including five uncommitted citations reported honestly); post-commit ARM-1 recheck remains a delivery requirement. Existing transform test 21/0; docs-check over all seven pages PASS, zero errors/117 nonblocking style suggestions; doctor directory example executed locally. Read-only review of all thirteen dependency diffs: No findings. The manifest now contains **69 implementation/dependency paths**, comprising the original 56 plus these 13; eleven administrative task docs remain excluded. Frozen patch is against the original base and includes both commits. The earlier 56-file candidate is core-procedure evidence, not a snapshot of these additional docs. Refreshed bytes ACCEPTED for junior delivery through remaining real gates.

## Distribution index refresh (senior, 2026-10-06)

The next normal push passed committed citation checks (1064 resolved/312 skipped), AI docs (218/218 plus live audits 4 PASS/0 FAIL/2 WARN) and skill drift, then refused the stale distribution manifest. The actual build-getff-dist assembler regenerated packages/getff/MANIFEST.sha256 and ignored payload copies. Read-only delta verification: exactly 52 accepted payload paths changed, 29 additions, no removals/unrelated paths; every changed digest matches accepted source. Fresh --check PASS: 1249 files, all package.json payload roots covered. No findings. The accepted implementation/dependency manifest now covers **70 paths**, adding this generated index to the previous69; eleven administrative docs remain excluded. No package publication or release performed. ACCEPTED for Git delivery with refreshed identities.

## Installed baselines refresh (senior, 2026-10-06)

The next normal push passed distribution and stopped at installed snapshot drift. Actual SNAPSHOT_MODE=capture performed all15 temporary-fixture installs; eleven fingerprints changed (eight npm greenfield/brownfield, three Python). Read-only inventory: npm rows have31 changed entries/20 new procedure files each; Python rows have4 changed entries/no additions; zero removals. Deltas contain only changed skills and the derived refresh-baseline/prettierignore records (ignore_shipped_configs enumerates freshly shipped markdown, lib.sh; no ignore logic changed). Cargo/go fingerprints stayed unchanged. Repeated actual SNAPSHOT_MODE=compare: **15 PASS/0 FAIL**, byte-identical installed trees. Full citation corpus PASS1037resolved/312skipped,56 generator deferrals/27 pre-existing missing blame baselines, no uncommitted skips. Arch’s fingerprint evidence now names its skill paths instead of the earlier contiguous line range; docs-check PASS0errors. No findings in complete baseline/reference delta review. No snapshot assertions removed or modified. Process completion confirmed before freezing.

The accepted implementation/dependency manifest now has **81 paths** (previous70 +11 installed fingerprints), plus eleven excluded administrative docs. This supersedes earlier scope counts/identities. ACCEPTED for junior delivery through remaining gates.
