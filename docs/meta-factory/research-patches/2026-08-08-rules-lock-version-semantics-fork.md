<!-- scope:rules-lock-version-semantics-fork -->

# `RulesLock.version` semantics — an unresolved fork that blocks `getff-freshness-widening` S1

> **Type:** research-patch (discovered gap). Owner: the `/dispatcher` session that found it, 2026-08-08.
> **Status:** DECIDED — **Option A** (operator, 2026-08-08); see §9. S1-r1 stays withheld; the stage re-dispatches under the rev-2 kickoff.
> **Reader:** a cold session convened to decide this fork. Everything needed is below; you do not need the originating session's transcript.

## §1 The fork in one sentence

`rules-lock.<framework>.json` has a `version` field, and **the lanes disagree about what it means**: the npm lane records a **dependency's** version, while the python and cargo writers produced by S1 record the **consumer's own project** version.

## §2 The evidence (each line re-verified on the host, not quoted from an agent)

| Claim | Evidence |
|---|---|
| The spec binds *dependency* versions | `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md:231-232` — «record the consumer's actual **dependency** versions at generation time (today: `"version": null`)» |
| npm already honours that | `packages/core/installer/install.ts:63` — `version: plan.version`; the parity fixture feeds `framework:'next', version:'16.0.0'` (`tests/install-sh/npm-lane-parity.mts:26-27`) |
| S1's python writer reads the project's OWN version | `setup.d/45-python.sh` — `sed -n '/^\[project\]/,/^\[/p' "$PROJECT_ROOT/pyproject.toml"` → `[project] version` |
| S1's cargo writer likewise | `setup.d/46-cargo.sh` → `[package] version` |
| The schema does not disambiguate | `packages/core/installer/types.ts:36-43` — `RulesLock { schemaVersion: 1; framework: string\|null; version: string\|null; ruleIds: string[]; emittedAt: string; sourceFingerprint: string }` |

## §3 Why this is not cosmetic — it inverts the umbrella's goal

`getff-freshness-widening` exists to make staleness **addressable**: S2 diffs successive locks to say «these rules were researched against a dependency that has since moved». Under the project-own-version reading:

- a consumer bumping **their own** project version emits a lock diff → a false staleness signal;
- a consumer bumping **a dependency the rules cite** emits **no** diff → the true staleness signal is lost.

That is the opposite of what S2 consumes. The field name is identical either way, so nothing downstream can detect the confusion — a differ would read both lanes as the same quantity.

## §4 The two options, with their real consequences

**Option A — every lane records a DEPENDENCY version.**
Matches spec §7.1. Gives S2 the signal it was designed around. **Cost:** the three shell writers must know *which* dependency the rule set was generated against — that is generation-context state a bash writer does not hold. It almost certainly forces the synthesizer to emit a manifest the shell reads (the same infrastructure `PARK-S1-3` Option B describes), which re-opens S1's scope and probably merges it with the parked provenance work.

**Option B — every lane records the consumer's own project version, and npm aligns down to it.**
One line changes; S1's current diff survives nearly intact. **Cost:** S2 loses its input entirely (see §3). The umbrella would need a different staleness source, or a redefinition of what «не протухает» means here.

**A third possibility worth naming, not recommended blind:** keep both — a `version` (project) plus a distinct dependency-version structure. This interacts directly with the parked per-rule provenance work (`PARK-S1-2/3/4`), so deciding it in isolation is likely wasted.

## §5 What is already built and should not be re-derived

S1's branch is `feature/getff-freshness-widening-s1-ed7dd3` (head `4e4ee22730`, 4 commits). It is **not merged, not accepted, and not on `origin`** — a fidelity audit returned REVISE, and an attempt to push it for safekeeping was **refused by `.husky/pre-push`** (the red test in §6 item 1 fires at the push rung, before the branch can reach the remote). The gate behaved correctly; nothing was forced past it.

**Where the work is preserved** (two independent copies, neither claiming readiness):

- a verified git bundle at `~/.claude-coordination/rules-as-tests-aif/getff-freshness-widening-s1/s1-4e4ee22730.bundle` — restore with `git fetch <bundle> refs/heads/feature/getff-freshness-widening-s1-ed7dd3`; it requires base `7d44221af3` to be present;
- the aif container's task worktree for task `ed7dd346-181b-495c-be8b-580273e1c487`.

Parts that are independently sound and worth carrying into whichever option wins:

- **Criterion 1 is value-level PROVEN.** `tests/install-sh/rules-lock-schema-parity.test.sh` gained a `lock_version_raw()` extractor plus `case` arms; reverting the python writer to `printf '  "version": null,\n'` makes it RED. It discriminates — it does not merely check that a field name exists.
- **Lane parity is asserted over OUTPUTS**, not over writers looking alike: the npm arm invokes `install()` for real and greps the emitted lock with the same checker as the shell lanes.
- **SSOT row 241** (lockfile-provenance) exists with Verdict / Rationale / Trigger-to-revisit.
- **`PARK-S1-5`** (go lane) is a model park: both options with consequences, an architecturally true reason (`go.mod` has no project-version concept), and an un-park pointer.

## §6 Blockers that must be fixed under EITHER option

1. **The branch lands RED as-is.** `tests/install-sh/python-rules-lock.test.sh:59` asserts `grep -q '"version"[[:space:]]*:[[:space:]]*null'` and is CI-wired via `.github/workflows/audit-self.yml`. S1's diff never touched it. Whatever the decision, that assertion must be re-stated to express the chosen intent — not merely flipped to chase green.
2. **Criteria 4 and 6 are bare gaps, not parks** — no machine-readable-diff-shape test, no backward-compatibility test for `schemaVersion`.
3. **`PARK-S1-1..4` are invisible.** They live only in `.ai-factory/plans/…`, which is gitignored. A park no reviewer can see is not a park.
4. **Malformed-value vectors in the shell extractors**, reproduced: `version = { workspace = true }` (cargo workspace inheritance) passes through `sed` verbatim into the JSON slot; TOML literal strings (`version = '1.2.3'`) likewise; a value containing a backslash yields an invalid JSON escape, so `JSON.parse` on the lock throws.

## §7 The process finding (recorded so it is not repeated)

The originating session's S1 kickoff framed the work as «the three writers that hard-code the `null`» and pointed at the `printf` sites. The umbrella carried the word «dependency»; the stage kickoff did not. An executor following that framing reasonably reached for the nearest readable version — the project's own — and the framing, not the execution, produced the wrong artefact.

**Counter for the next authoring pass:** a stage criterion that depends on a spec distinction must **quote the spec line inside the criterion**, not paraphrase it upstream and assume it survives the hop. The cheap grep that would have caught this: `grep -n 'dependency' <spec §7.1>` before writing criterion 1.

## §8 §1.7 self-review

**Forward-check.** This patch introduces no rule and no mechanism — it records a discovered gap and an open decision, so the disciplines it must satisfy are the authoring ones. [`phase-research-coverage.md §1.12`](../../../.claude/rules/phase-research-coverage.md): every §2 row and every §6 blocker carries a `path:line` or a reproduced command, and §4's options each state a cost rather than a preference — the one place a verdict would belong (which option) is deliberately left unpicked, per [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md) (a scope fork is the maintainer's). [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md): nothing here adds a CI call. [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md): no capability proposed — §4 Option A explicitly names that it would re-open scope rather than pretending it is free. [`language-discipline.md §1`](../../../.claude/rules/language-discipline.md): the artefact is English.

**Backward-check.** Class of this change = *research-patches that record an open decision blocking an in-flight umbrella*. Sibling surfaces where the same class occurs, and their state: [`2026-07-24-autonomous-loop-diagnostics.md`](2026-07-24-autonomous-loop-diagnostics.md) — SWEPT-CLEAN, it records the container≠host finding (F3) that later became `destination-environment-verification.md`; disjoint subject, and this patch does not supersede it. The umbrella's own dispatch inputs — `.claude/orchestrator-prompts/getff-freshness-widening/kickoff.md` and `…-s1/kickoff.md` — are **GAP-FOUND, deliberately left**: the S1 stage kickoff still carries the framing §7 identifies as the root cause, and re-authoring it is the *next* action under whichever option wins, not this patch's (editing it now would pre-commit the decision this patch exists to surface). `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` — untouched by design: it is the binding source this patch cites, and a spec correction is a separate spec-owner commit ([`/pipeline §5`](../../../.claude/skills/pipeline/SKILL.md) park-record contract, precedent PR #1252).

**Self-application (T15).** The patch's own §7 finding — «a criterion that depends on a spec distinction must quote the spec line, not paraphrase it one hop upstream» — is applied to this document: §2 quotes `…closure-design.md:231-232` verbatim rather than summarising it, and §6 quotes the failing assertion's literal `grep` expression rather than describing it. The honest limit: this patch was written by the same session whose framing caused the defect, so its §7 counter is **self-diagnosed, not cold-reviewed** — a cold reader deciding the fork should treat §7 as a hypothesis about the cause, not an established one.

## §9 Decision record (2026-08-08, appended by the deciding session)

**Option A — every lane records a DEPENDENCY version.** Decided by the operator in dialogue after
a host-evidence-backed walkthrough of §3-§4. Rationale accepted: (1) Option B cancels the
umbrella's goal rather than costing less — S2/S3 would need a replacement staleness source
anyway; (2) Option A's cost (a synthesizer-emitted generation-context manifest the shell lanes
read) overlaps the infrastructure spec §7.1 already requires for per-rule provenance and S3's
ledger — pulled forward, not newly built; (3) the §4 third possibility («both fields») reduces to
«A + an extra field later», to be shaped by the parked provenance work, so it needed no separate
decision now.

**Cascade:** `PARK-S1-3` resolves to its Option B (manifest) by implication — the shell has no
other access to the generation context. `PARK-S1-1/2/4` remain open. The stage kickoff was
re-authored per §7's counter (spec line quoted inside criterion 1):
[`getff-freshness-widening-s1/kickoff.md`](../../../.claude/orchestrator-prompts/getff-freshness-widening-s1/kickoff.md) rev 2 — it also inlines the §6 blockers as
criteria 6-8 and preserves the r1 park payloads, closing §6 item 3 (invisible parks).

## See also

- `.claude/orchestrator-prompts/getff-freshness-widening/kickoff.md` — the umbrella (S1 row).
- `.claude/orchestrator-prompts/getff-freshness-widening-s1/kickoff.md` — the stage kickoff whose framing §7 describes; **re-author criterion 1 before any re-dispatch**.
- `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` §7.1 — BINDING.
- `.claude/orchestrator-prompts/_plan-cache.md` — the session-local trace (gitignored; this patch is the durable half).
