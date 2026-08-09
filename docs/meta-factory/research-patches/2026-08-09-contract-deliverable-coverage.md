<!-- scope:contract-deliverable-coverage -->

# host-verify contract ↔ deliverable coverage — three gate variants, all falsified; K6 emission is the reachable mechanism

> **Type:** research-patch (discovered gap + three rejected mechanisms, with the measurements that rejected them). Owner: the session that ran the sweep, 2026-08-09.
> **Status:** DECIDED — no gate. The emitter [`scripts/host-verify-coverage.sh`](../../../scripts/host-verify-coverage.sh) and the K6 candidate-emission-3 extension in [`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) ship in the same PR.
> **Reader:** anyone tempted to make «§2-permitted area unreachable by every declared command» an error inside [`scripts/host-verify.sh`](../../../scripts/host-verify.sh) or a principle test. Read §3–§4 first: the incident replay that kills all three designs is here, so you do not have to re-derive it.
> **Sibling:** [`2026-08-09-kickoff-allowlist-obligation-closure.md`](2026-08-09-kickoff-allowlist-obligation-closure.md) — same day, same seat, **different class** (allowlist *contradicts* an obligation vs. contract *does not cover* the deliverable) and the same outcome shape. Its «incident replay, not flag count, is the acceptance leg» bar is applied here.

## §1 The gap in one sentence

A stage's acceptance contract can pass green on a branch whose central deliverable is missing, because nothing relates the contract's commands to the code the stage is allowed to change.

Live instance — `getff-freshness-widening-s1/kickoff.md` (merged PR #1333). Its contract declares four commands:

```text
npx vitest run packages/core/installer
bash tests/install-sh/rules-lock-schema-parity.test.sh
bash tests/install-sh/python-rules-lock.test.sh
npx vitest run packages/core/hooks/deps-hash-check.test.ts
```

§2 permits `packages/core/synthesizer/**` and §3 criterion 3 is *about* a synthesis-time stamp. `bash scripts/host-verify.sh getff-freshness-widening-s1` returned **4/4 PASS** on a branch where `packages/core/synthesizer/generate.ts` never stamped `tier`; a cold audit graded it MAJOR. The contract could not have detected the defect class it existed to gate.

## §2 Population first (T10 — enumeration before sampling)

```bash
grep -rl '```bash host-verify' .claude/orchestrator-prompts/ | wc -l    # 43 files match
# of which, per `bash scripts/host-verify.sh --list <f>`:
#   41 carry a real contract
#    1 carries none (getff-honest-signals-meta-launch/state.md — a quoted mention)
#    1 has an unterminated fence (beta-delivery-ux-meta-launch/HANDOFF-2026-08-09-r2.md)
git grep -lIiE '^#+ .*(permitted files|permitted set|files you may touch)' \
  -- '.claude/orchestrator-prompts/**' | wc -l                          # 12 (11 contract-bearing)
```

**The first structural finding: the gate as framed has no input for 73% of the corpus.** Only **11 of the 41** contract-bearing kickoffs carry an explicit permitted-files allowlist. The other **30** state scope as prose plus an `Anti-scope`/`Descopes` **denylist** — there is no permitted set to subtract from. (The sibling patch counted 9/305 with a narrower regex over `*/kickoff.md` only; widening to `Permitted set` / `Files you may touch` and to `kickoff-s*.md` gives 12, of which one carries no contract.)

**The second: S1 is the norm, not an outlier.** Across the 11-kickoff allowlist cohort, **11/11** have at least one permitted area named by no declared command. Per-file candidate counts: `1 1 3 5 5 6 6 8 9 9 10` — **63 candidates, 5.7/file**. A signal that fires on 100% of its population does not discriminate.

## §3 Three detector variants, all run (T2 — not «would detect»)

| Variant | Flags/file | Catches the S1 incident? |
|---|---|---|
| **A — syntactic**: the area's path appears in a declared command | 5.7 | **yes** — but see §4 for the false-flag rate |
| **B — transitive**: area appears in the import closure of the commands' test entries | 3.4 | **NO — recall 0** |
| **C — file-fraction**: <10% of the area's files in that closure | 5.1 | **NO** — the area sits at 13% |

**The decisive leg — incident replay.** `packages/core/installer/install.ts:9-12` imports `emit`, `SynthesisPlan` and `weakestTier` from `../synthesizer/`, so `npx vitest run packages/core/installer` **does** execute synthesizer code. Variant B therefore reports the synthesizer as covered and emits nothing — zero recall on the only incident of the class. Measured closure of that command's four test entries: 62 files; `synthesize.ts` **reached**, `generate.ts` and `menu-pick.ts` **not reached** — 1 of the 3 `SynthesisPlan` producers PR #1333 had to stamp.

Variant C inherits the same blindness at a different threshold: `packages/core/synthesizer` scores 8/62 = **13%**, above a 10% bar. Lowering the bar to catch it also catches `packages/core` (16%) and `setup.d` (19%), and **56 of the 79** permitted areas in the cohort already flag at 10%.

## §4 Why the survivor is not a gate either

Variant A fires on the incident, but **38% of its flags are demonstrably false**: re-running the cohort with transitive reachability kills 23 of 60 prototype flags — areas a command exercises without naming. At 5.7 flags/file with a measured 38% false rate, variant A is an order of magnitude past the sibling patch's pre-registered «≤1 false flag per file» bar.

**And the deeper falsifier: the defect is an OMISSION at file granularity.** `generate.ts` was not merely unreached — it was *unchanged*, when the criterion required changing it. No diff-scoped or reachability-scoped check can detect a file that should have been edited and was not; only an assertion over the enumerated population («all three producers stamp `tier`») can, and that assertion is stage-specific by construction.

**Independently, the import-graph leg is already rejected in this repo.** [SSOT #210](../prior-art-evaluations.md) (`vitest --changed` / Nx `affected` / `testmon`) records that **30/32 principle tests read rule/config files via `fs` at runtime rather than via static `import`**, so a static affected-set computation «cannot see a rule-file→test edge». Variant B's closure inherits exactly that unsoundness.

Wrong if: a future convention required every kickoff to carry a literal-path allowlist **and** every acceptance criterion to name the command that falsifies it. Both are new authoring obligations across the corpus, and neither closes the omission falsifier above.

## §5 Verdict — detectability axis says emission, not gate

Per [rule-enforcement-channel-selection.md §1](../../../.claude/rules/rule-enforcement-channel-selection.md) the detectability axis resolves NO: «does this command assert this deliverable» is prose-and-code semantics, so gating it is `#gate-where-judgment-needed` (§5 there). That is the same conclusion [destination-environment-verification.md §4](../../../.claude/rules/destination-environment-verification.md) already reached for its own substance sibling `#optout-as-reflex` — «the gate cannot decide whether a deliverable is executable, and pretending it can would be `#gate-where-judgment-needed`».

The judgment ceiling is **not** a licence for bare attention. Per [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md) a load-bearing check is (a) a deterministic gate or (b) a NAMED cold-agent protocol with structured output. Branch (a) is falsified in §3–§4; branch (b) ships. An advisory warning inside `host-verify.sh` was considered and **rejected**: its only consumer would be «someone reads the log», which is `#warning-nobody-reads` in that rule's §2.

## §6 The mechanism — K6 candidate emission 3

[`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) K6 is the candidate/adjudicate split, and its declared shape fits: «the candidate list is the deliverable; an empty candidate list is **not** "no framing bias"». A flag density that disqualifies a gate is the right density for a candidate list. Build-vs-reuse: **REUSE** of an existing seat — no new agent, no new dependency, no new `packages/` module, therefore no capability commit and no new SSOT row.

**Deliberately NOT K4.** `#silent-contract-skip` is the closest anti-pattern, but K4 is a *finding* class and the verdict rule sends any K4 finding to REVISE. With 63 candidates across the cohort, routing them to K4 would make REVISE the permanent verdict — a gate through the back door, and the same `#discipline-theatre` this patch exists to avoid.

The emitter is [`scripts/host-verify-coverage.sh`](../../../scripts/host-verify-coverage.sh). It does **not** re-implement contract extraction: it shells out to `host-verify.sh --list` and consumes its `   • ` lines, so the two cannot disagree about what a contract is (`#sync-by-copy-paste`, [dual-implementation-discipline.md §8](../../../.claude/rules/dual-implementation-discipline.md)). It prints `Candidates: N/A` — never `0` — for the 30 allowlist-less kickoffs, and carries its three measured false-positive classes plus the file-granularity false-negative class in its own output, so a reader cannot mistake an empty list for health (T14).

## §7 Paired negative (T2 — the mechanism was fired, not designed)

[`scripts/host-verify-coverage.test.sh`](../../../scripts/host-verify-coverage.test.sh), wired at `.github/workflows/audit-self.yml` (install-sh battery shard A) — an unwired can-it-fire proof is not a proof, the lesson of this same umbrella's rev-4 repair. Because the emitter always exits 0, the negative leg is on its **output**: fixture A (allowlist permits the synthesizer, contract runs only an install-sh script) must emit `CANDIDATE: packages/core/synthesizer`; fixture B (allowlist fully covered) must emit none; fixture C (no allowlist) must report `N/A`, not `0`; fixture D opt-out; fixture E no-contract → exit 2 fail-closed; plus an **incident replay against the real S1 kickoff**.

Mutation-checked, so the suite is not green over a dead mechanism:

| Mutant | Result |
|---|---|
| never emit a `CANDIDATE:` line | **RED** — 2 checks fail (fixture A + incident replay) |
| emit a candidate for every permitted area (the 100%-red failure) | **RED** — 3 checks fail (fixture A count, fixture B ×2) |
| unmutated | PASS |

## §8 Coverage honesty (T14) + self-application (T15)

**Coverage.** The population enumeration and the three variants are mechanical and cover 41/41 contract-bearing kickoffs. The **38% false-flag figure is prototype-derived** (a node import-closure run over the same 11-kickoff cohort: 60 → 37 flags), not a property of the shipped bash emitter, whose own count is 63; both are stated rather than merged. The «which candidates are genuinely uncovered» question was **not** answered for all 63 — that is the adjudicator's job, and claiming otherwise would be the `#discipline-theatre` this patch rejects.

**Self-application.** This patch proposes a mechanism, so it owes its own test: is *its* deliverable gateable? Partly — the emitter's liveness is (§7, wired + mutation-checked); «did the adjudicator actually weigh the candidates» is the same semantic judgment one level up and, per [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md), cannot become a CI gate. The patch therefore claims no catch rate. What it claims, and what is mechanically checkable, is narrower: **the contract↔allowlist comparison now reaches the adjudicator's input, where before it did not.**

**Promotion trigger.** A second incident of this class in which the uncovered area is named by **no** declared command *and* the deliverable is a file the stage does change → the omission falsifier no longer covers the population, and variant A becomes worth re-measuring as a gate — with the incident replay, not the flag count, as the acceptance leg.

**Proposed rule edit, not applied here.** [`destination-environment-verification.md §4`](../../../.claude/rules/destination-environment-verification.md) should gain a fourth anti-pattern, `#contract-that-cannot-fail` — «a contract that runs, reports PASS, and asserts nothing about the deliverable; counter: §6 emission + the K6 adjudicator». It is **not** edited in this PR: `.claude/rules/**` is maintainer-owned and read-only for session agents (CLAUDE.md Artifact Ownership Contract), so the diff travels in the PR body — the route `arch-v2-context-pipeline-s-d-prime` is cited for in the sibling patch's §7.

## See also

- [`scripts/host-verify.sh`](../../../scripts/host-verify.sh) — the runner; contract-grammar SSOT the emitter defers to.
- [`.claude/rules/attention-is-not-a-mechanism.md §1-§2`](../../../.claude/rules/attention-is-not-a-mechanism.md) — the (a)/(b) fork and `#warning-nobody-reads`.
- [`.claude/rules/rule-enforcement-channel-selection.md §1/§5`](../../../.claude/rules/rule-enforcement-channel-selection.md) — the detectability axis + `#gate-where-judgment-needed`.
- [SSOT #210](../prior-art-evaluations.md) — diff-scoped test execution, REJECT; the fs-vs-static-import measurement reused in §4.
