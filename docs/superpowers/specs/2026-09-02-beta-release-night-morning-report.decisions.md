# Beta-release night run — operator decisions log (2026-09-03 morning review)

> **Authoritative for:** the four operator decisions taken on 2026-09-03 over the owner-fork
> list of the [morning report](2026-09-02-beta-release-night-morning-report.md) §4/§6, each
> in the session-bus v2 entry shape (decision package · decision · rationale · falsifier ·
> reversibility + undo · decided-by · status).
> **NOT authoritative for:** the beta-program design itself —
> [2026-07-23-beta-program-design.md](2026-07-23-beta-program-design.md); the night-run
> narrative — the morning report above; project goal —
> [README.md#why-this-exists](../../../README.md#why-this-exists).

Recorded by the advisor seat BEFORE application (advisor-pattern §3 invariant 1;
night-mode items 1 + 8). Evidence quoted was measured on 2026-09-03 against staging
`88a63438d9`.

## Decision 1 — npm package name: unscoped `getff`, bin `getff`

**Decision package.** The spec already fixes the *form*: D6 names the entry point
`npx getff@latest init` (`2026-07-23-beta-program-design.md:150`), A6-R1 fixes bin `getff`
and the `@getff` family (`:278-279`), and the phase-2 line says «`npm publish` (@getff
scope …)» (`:398`). The untracked s6-u10 handoff adds «Do NOT publish under
`@rules-as-tests/core`» and «publish-under-@getff-only». The only open question is the
package NAME, because `npx getff@latest` resolves only an unscoped `getff`. Registry state:
`npm view getff version` → `0.0.1` (the operator's placeholder); `npm view @getff/core` →
404. Current package: `packages/core/package.json:2-4` = `@rules-as-tests/core`, `0.1.0`,
`private: true`; `bin` block (`:37-42`) exposes `rules-as-tests-*` names, no `getff`.

Options: (a) `@getff/cli` with bin `getff` — the handoff's letter, but D6 must be rewritten
to `npx @getff/cli init`; (b) unscoped `getff` with bin `getff` — D6 verbatim, the name is
already held, `@getff/*` stays reserved for library packages; the A6-R1 wording gains one
phrase («`getff` + `@getff/*`»).

**Decision: (b) — unscoped `getff`.**

**Rationale.** The consumer-facing promise (D6) outranks an internal naming rule whose
purpose (never ship under `@rules-as-tests`) is satisfied either way. The placeholder
already holds the name, so no squatting window opens.

**Falsifier.** Wrong if the operator does not control the npm `getff` name, or if the
`@getff`-only rule was meant as a substitution guard (scoped names cannot be squatted) —
then (a).

**Reversibility.** Type-2 until the first `npm publish` (which is the operator's act, phase
2); after publish, unpublish is not rollback (handoff). Undo before publish = rename in the
prep PR.

**Decided-by.** Operator, 2026-09-03 (AskUserQuestion, advisor recommendation (b) taken).

**Status.** decided — application = the phase-2 prep PR (rename, `private: false`, `files`
allowlist, bin `getff`, package README/LICENSE) + the one-phrase A6-R1 amendment
(carried by the cleanup PR of Decision 4).

## Decision 2 — z.code «factory self-diagnosis» report: not committed; facts live in issues

**Decision package.** The report's main finding (agent `docker logs` dead) was refuted:
`docker logs --since` returns 0 lines for any in-range value on this host while
`-t --tail` shows live lines (morning report §evening). The file was Russian-language,
uncommitted in the primary clone under `docs/reviews/`.

**Decision: do not commit; carry the two verified facts as issues; delete the file.**

**Rationale.** One false headline finding + language-discipline violation; the residual
value is two paragraphs, already present as #1580 (confirmed) and #1581 (rewritten under
the `--since` framing on 2026-09-02).

**Falsifier.** Wrong if the report contained a third verified finding not yet in an issue —
none found on the 2026-09-02 evening read.

**Reversibility.** Type-2 (the two issues remain; the report can be re-derived from them).

**Decided-by.** Operator, 2026-09-03.

**Status.** applied by prior action — on 2026-09-03 the primary clone no longer holds
`docs/reviews/` (`git status` shows no untracked report), #1581 body already carries the
revised measurement table, #1580 already carries the confirmation. Nothing left to delete.

## Decision 3 — zcode-parity-rollup renderer + nine `[zcode-probe]` NON-BLOCKERs: parked post-beta

**Decision package.** S3 shipped a renderer whose target fence
(`getff:begin section=zcode-parity-rollup`) is absent from
`.claude/rules/zcode-parity-doctrine.md` and whose `--check` step is absent from
`audit-self.yml` (grep on 2026-09-03: zero hits in both) — a renderer without a gate.
Proposal file: `docs/meta-factory/research-patches/2026-09-01-s3-owner-proposals.md`.

**Decision: park — one post-beta umbrella (fence + `--check` step + the nine NON-BLOCKER
`[zcode-probe]` items), not before publication.**

**Rationale.** [effort-worthiness.md §1](../../../.claude/rules/effort-worthiness.md) test 1:
none of it moves the beta; a new CI gate on the release path adds false-red risk. The
[attention-is-not-a-mechanism](../../../.claude/rules/attention-is-not-a-mechanism.md)
objection (ungated renderer = theatre) is acknowledged and answered by the parking date,
not by shipping the gate now.

**Falsifier.** Wrong if a zcode-parity regression reaches a consumer before the umbrella
runs — then the gate was load-bearing and should land immediately.

**Reversibility.** Type-2; undo = apply the proposal as written.

**Decided-by.** Operator, 2026-09-03.

**Status.** decided — parked; the post-beta umbrella kickoff is a separate authoring act.

## Decision 4 — post-night cleanup package: go (one cleanup PR + one FC-4 PR)

**Decision package.** Items, each with its measured pointer:

1. Morning report §4/§6 still list the claims-conformance-auditor A/B/C fork as open
   (`2026-09-02-beta-release-night-morning-report.md:52,63,99`); resolved as C in #1563.
2. `packages/core/templates/shared/tier-home.md:152,154` cite `night-mode/SKILL.md:15` and
   `:17`; the «window slides» sentence is now line 17 and the portability table line 19.
3. `plugin/skills/getff` differs from `skills/getff` in 6/6 files (`diff -rq`); quarantined
   in principle 24 (#1587). Re-sync + lift the quarantine.
4. `md5_of` residue in `tests/install-sh/refresh-offers-lintstaged-migration.test.sh:49`
   (exit inside `$(…)`, no `-e`) — fix if reproducible, else record as not-a-defect.
5. Dependabot #1524, #1526, #1590, #1591 — merge on green CI (update branch when
   `mergeable: UNKNOWN`); #1216 stays for the operator (red for a real reason).
6. A6-R1 one-phrase amendment per Decision 1.
7. Separate PR: FC-4 carve-out — `first-commit-passable/kickoff.md:162` forbids «any other
   file in the snapshot diff» while `SNAPSHOT_MODE=capture` re-hashes
   `.ai-factory/refresh-baseline.json` by construction (`done.md:6`). Add an explicit
   carve-out for install-time-generated manifests.

Operator-only, outside both PRs: delete the dangling symlink
`.claude/orchestrator-prompts/beta-docs-showcase/kickoff-bs0.md` in worktree
`beta-release-plan-c20d1e` (target absent; trips principle 44 Arm B on every push from
that worktree; the auto-mode classifier blocks agent `rm` under `orchestrator-prompts/`).

**Decision: go on all seven; a junior executor session does both PRs; the advisor records.**

**Rationale.** All items are reversible, none touches a floor, and items 1-3 are stale
claims that mislead the next session.

**Falsifier.** Wrong if any item turns out to need a design choice (then it leaves the
package and comes back as a fork).

**Reversibility.** Type-2; undo = revert the PR.

**Decided-by.** Operator, 2026-09-03.

**Status.** decided — application pending (cleanup PR + FC-4 PR).
