# KICKOFF — promote-gate-fixes

> **Type:** remediation umbrella, single stage (I-phase), two atomic commits, one PR to `staging`.
> **Origin:** the first CI run of the draft promote PR
> <https://github.com/artyhoo/getff/pull/1597> (`staging` → `main`, 682 commits) — 39 pass,
> 3 fail. One failure was a PR-body defect and was fixed by the PR author. The two defects below
> are repo defects and are what this kickoff buys.
> **Why they survived 682 commits:** neither is reachable from a routinely-triggered workflow.
> `guard-liveness-fullsweep` fires ONLY on `pull_request: branches: [main]`
> ([.github/workflows/guard-liveness-fullsweep.yml:39](../../../.github/workflows/guard-liveness-fullsweep.yml)),
> and it is one of only two consumers of the ROOT lockfile via `npm ci` — the other is
> `demo-regen.yml:69`, which runs on `release: published` / manual dispatch. Every other workflow
> either installs with `npm install` (`audit-self.yml:219`, `audit-self.yml:438`, which tolerates a
> desynced lock) or installs the `packages/core` layer only.
> **Base branch:** staging. Per
> [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md), this kickoff is
> merged to `staging` before dispatch.
> **Rigor label (effort-worthiness L0):** `build-and-verify` — both edits are reversible, and the
> authoritative verification is a live CI run, not a local argument. Neither edit touches a
> consumer-shipped artefact.
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** no capability commit here. PG-1 is a lockfile
> regeneration (npm's own resolver output, no new dependency key). PG-2 changes error handling
> inside an existing workflow. No new module, no new dependency, no new subdirectory. Both commits
> carry a `Prior-art: skipped — <rationale ≥20 chars>` escape line.
>
> **Citation form is load-bearing** — issue/PR references are full URLs or bare `PR NNN`, never
> hash-tokens.

## §0 Read first, in order

1. [README.md#why-this-exists](../../../README.md#why-this-exists) → [.claude/session-bootstrap.md](../../session-bootstrap.md) → [CLAUDE.md](../../../CLAUDE.md).
2. PR 1597 (URL above) and its three failing runs from 2026-09-03 11:53-11:55 UTC.
3. [.github/workflows/guard-liveness-fullsweep.yml](../../../.github/workflows/guard-liveness-fullsweep.yml) — whole file; the trigger at line 39 and the `npm ci` at line 70.
4. [.github/workflows/context7-refresh.yml](../../../.github/workflows/context7-refresh.yml) — whole file; the run block at lines 49-67 and, above all, the comment at lines 52-56 that states the job's deliberate fail-loudly posture.
5. [.claude/rules/attention-is-not-a-mechanism.md §2](../../rules/attention-is-not-a-mechanism.md) — `#warning-nobody-reads`. PG-2 must not turn this job into one.
6. [.claude/rules/ci-tool-pinning.md](../../rules/ci-tool-pinning.md) — fires on any `.github/workflows/**` edit.

## §1 Decisions (authored with rationale; operator-overridable at PR review)

**D1 — PG-1 fix shape: add the one missing nested lock entry, do NOT regenerate the whole lock.**
The measured delta is exactly **17 inserted lines, one package key** — `node_modules/mongoose/node_modules/gcp-metadata` at version `7.0.1` (`dev: true`, `optional: true`, `peer: true`). Produce it with `npm install --package-lock-only` under Node 22.
*Rationale:* a full regeneration on a beta candidate can silently drift dozens of transitive pins, and this PR sits directly under the promote.
*Falsifier:* if the command yields anything beyond that single added key, STOP and park — extra churn is a separate decision, not this stage's.

**D2 — the dependency graph is not the defect; the lock is.**
Chain: `promptfoo@0.122.0` → `natural@^9.2.1` → `mongoose@9.9.2` → its bundled `mongodb@7.5.0`, which declares `gcp-metadata: ^7.0.1` in `peerDependencies` with `peerDependenciesMeta.gcp-metadata.optional: true`. The tree already carries `gcp-metadata@8.1.4` and `8.1.2` (for `google-auth-library`, pulled by `promptfoo`), neither of which satisfies `^7.0.1`, so npm's ideal tree wants a nested `7.0.1` that the lockfile never recorded. `npm ci` then reports `Missing: gcp-metadata@7.0.1 from lock file`. Do NOT attempt to drop, pin, or override `mongoose`/`promptfoo` to make the peer disappear.

**D3 — PG-2: treat the documented `too-early` response as success; everything else still fails loudly.**
Observed body: HTTP 400 with `{"error":"too-early","message":"Too early to refresh the project. Last update was 1 days ago. Minimum 10 days required between updates."}`. The service enforces a 10-day minimum between refreshes, so after any successful refresh this job is RED on every `staging` push for the next nine days.
*Constraint:* the exemption is matched on that specific response — the `too-early` error token in the body — and nothing else. A blanket `|| true`, a dropped `--fail-with-body`, or a `continue-on-error: true` on the job is a REJECTED shape: it converts a real gate into `#warning-nobody-reads`, which the file's own comment at lines 52-56 explicitly refuses. An unset key, a 401, a 5xx, or a network failure must still exit non-zero.

**D4 — scope is the ROOT lockfile only.**
`packages/core/package-lock.json` is exercised by `npm ci --prefix packages/core` in five workflows, including [.github/workflows/audit-self.yml:184](../../../.github/workflows/audit-self.yml), and is green on `staging`; that layer also carries no `gcp-metadata` entry at all. A night-session note claimed the desync hits "both layers" — CI does not confirm it. **Verify and report** (`npm ci --prefix packages/core` on a clean checkout, quote the tail), and edit the core lock only if you can show it failing.

## §1b Autonomous aif dispatch — park-don't-guess contract

Park the task (do not guess) if any of these fire:

- D1's falsifier — the regeneration touches more than the single `gcp-metadata` key.
- No PG-2 shape can satisfy D3 (documented no-op green, every other failure red) without weakening the job.
- The local sweep goes red for reasons that predate this branch (interpret against the merge-base, per [.claude/skills/dispatcher/SKILL.md §2.4](../../skills/dispatcher/SKILL.md)).

## §2 Stages

One stage, two atomic commits, one PR to `staging`.

**Commit 1 — PG-1.** `package-lock.json` only. Subject: `fix(deps): record the nested gcp-metadata@7.0.1 peer so npm ci resolves the root lock`. Body states the D2 chain and that `guard-liveness-fullsweep` is the only routinely-reachable consumer of this lock.

**Commit 2 — PG-2.** `.github/workflows/context7-refresh.yml` only. Subject: `fix(ci): context7 refresh treats the documented too-early response as a no-op, not a failure`. Body quotes the observed 400 body verbatim and states which failures remain red.

## §3 Binding constraints (do not re-derive)

- **Node 22** — matches `guard-liveness-fullsweep.yml:65`. Regenerating the lock under a different Node/npm major can produce a lockfile that CI still rejects; verify the npm major you used and put it in the PR body.
- Never `--no-verify`. Never force-push. On a conflicting branch, merge-forward per [.claude/rules/git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md).
- `.github/workflows/**` edits pass through `workflow-integrity.yml` and the pinning rule — run the local sweep, do not hand-wave the workflow lint.
- Touch nothing else. PR 1597 must stay a pure promote; any other finding is an observation in the report, not a commit.
- Both commits need a `Prior-art:` line. The escape form is required here (neither is a capability commit) and its rationale must be ≥20 chars and say *why*.
- PR body needs a `## Fidelity verdict` section with a literal `FIDELITY: skipped — <≥20 chars>` line, plus `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied`, each ≥40 characters and each carrying at least one literal `path.ext:NN` citation.

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active for this stage — name them in the report, do not restate the catalogue:

- **T3** — every acceptance claim carries command output or a `file:line` citation. No prose-only findings.
- **T5** — this is an I-phase with a two-file scope. If you open an editor on a third file, stop and park.
- **T14** — a green local run proves little here: the whole defect class is «the gate that never fired». The authority is the CI run, and for PG-1 specifically the authority is `guard-liveness-fullsweep` on PR 1597 after this lands.
- **T19** — run your own cold review of the diff before handoff. CI checks form, not whether D3's constraint was actually honoured.
- **T20** — quote the output of the command behind each verdict in the report.

## §5 Host acceptance

The host-verify contract for this stage — run from the repository root on the stage branch:

```bash host-verify
npm ci
npm ci --prefix packages/core
bash scripts/run-local-ci-sweep.sh
```

`npm ci` at the root is the gate PG-1 exists to repair, so it is the contract's first line: on
`staging` today it fails, and on a correct stage branch it must pass. The `packages/core` line is
D4's verification, not a fix target. Then, item by item:

1. `npm ci` at the repository root succeeds on a clean checkout of the branch — quote the tail of the output.
2. `git diff origin/staging...HEAD -- package-lock.json` shows exactly one added package key and no other change — paste the diff.
3. `npm ci --prefix packages/core` on the same checkout — report pass or fail (D4 verification), do not act on it beyond reporting unless it fails.
4. Local sweep green: `bash scripts/run-local-ci-sweep.sh` — a red that also reproduces on `origin/staging` is pre-existing, not this branch's.
5. PR to `staging` opened and green.
6. **The promote PR verifies itself.** PR 1597's head IS `staging`, so merging this PR moves that PR's head and re-runs `guard-liveness-fullsweep` automatically. Report its verdict — that is the real acceptance for PG-1, and it is the first time this workflow will have run to completion.
7. PG-2 acceptance: the `context7-refresh` run triggered by the merge to `staging` is GREEN while the service still answers `too-early` — quote the run's log lines showing both facts together. If the service happens to answer 200 (10 days elapsed), say so explicitly: the exemption path was then NOT exercised and stays unverified.

## §6 Stage gates

- Do not open the PR before §5 items 1-4 are done and quoted.
- Do not claim PG-1 fixed before §5 item 6 reports a real `guard-liveness-fullsweep` verdict. If that workflow then fails for a DIFFERENT reason, that is a new finding: report it, do not fold the fix into this PR.
- Report at `.claude/orchestrator-prompts/promote-gate-fixes/report.md`.

## §7 See also

- [docs/meta-factory/operational-conventions.md#promote-stagingmain-mechanics-two-hard-rules](../../../docs/meta-factory/operational-conventions.md) — why the promote PR's head must stay `staging`.
- [.claude/rules/attention-is-not-a-mechanism.md](../../rules/attention-is-not-a-mechanism.md) — the posture PG-2 must preserve.
- [.claude/rules/effort-worthiness.md](../../rules/effort-worthiness.md) — the L0 label above.

## §8 Observation for the operator (NOT this stage's work)

The root lockfile has exactly two `npm ci` consumers, and both are off the routine path: a
`main`-only PR workflow and a release-time regen. That is why a broken root lock survived 682
commits with `staging` green throughout. Whether the root layer deserves an `npm ci` on the
routine path is a separate decision — surface it, do not act on it here.
