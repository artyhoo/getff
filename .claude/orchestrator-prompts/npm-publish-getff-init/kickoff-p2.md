# npm-publish-getff-init P2 — code truth gate over the `staging..main` delta

> **Umbrella:** [kickoff.md](kickoff.md) — §2 decided inputs and §6 floors are binding.
> **Sibling lane:** [kickoff-p1.md](kickoff-p1.md) — the DOC half of the same gate, already run.
> **Class:** operational kickoff (dispatch input). **Base branch:** `staging`.
> **Rigor label (effort-worthiness L0):** `research-grade` — this lane and P1 together are the
> agreed REPLACEMENT for the `/code-review ultra` floor on promote #4 (operator waiver
> 2026-09-14, re-affirmed 2026-09-15: «нужна проверка всего в аиф фабрике до мержа в майн»).
> What this clears goes to `main`, which the getff.ai docs site pins to. `npm unpublish` is not
> a rollback (umbrella §2 «Rollback»).
> **Authoritative for:** the scope, lane split, method, verdict grammar and gate of the P2 pass.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the doc surfaces (P1 owns those); promote mechanics —
> [`operational-conventions.md`](../../../docs/meta-factory/operational-conventions.md) §2;
> the publish act — umbrella §3 S3 (the operator's hand, never this lane's).

## §0 Why this lane exists — the hole P1 left

P1 was dispatched as the replacement for the waived `/code-review ultra`. Read its
[§2 «Surface — enumerated, not sampled»](kickoff-p1.md): the enumerated surface is
`README.md`, `INSTALL.md`, `INSTALL-FOR-AI.md`, `CONTRIBUTING.md`, `AI-USAGE-GUIDE.md`,
`first-steps.source.json`, `plugin/README.md`. **Seven prose files.** It asked one question —
«is this sentence true of the code?» — and it answered it well (295 claims, 22 repaired in
#1789).

It never read the code as code. Nobody has. Measured 2026-09-15 at `origin/staging`
`08a95a6dea4`: the promote delta is **190 first-parent commits, 532 files, +61313/−4869**,
spanning 2026-09-05→09-14, with **zero reverts**. Of that, **358 files are product surface**
(the rest is `.claude/orchestrator-prompts/**` dispatch inputs and `docs/meta-factory/**`
research records). Green CI covers form — typecheck, lint, the principle suite, the install
battery — not intent. This lane closes that.

**The operator's stated purpose, which ranks the findings:** the report is what the
documentation will be rewritten from, immediately and before the merge. So a finding's value is
«does a doc sentence written today from this code come out true?» — not «is this code pretty».

## §1 Goal

For your assigned lane, decide whether the delta's **behavioural** claims hold at
`origin/staging` `08a95a6dea4`: does each changed unit do what its own name, signature,
comment, test name and commit subject say it does — and does anything a consumer reaches
behave differently than before in a way nobody wrote down?

Three verdicts, and only these:

| Verdict | Means | Requires |
|---|---|---|
| `TRUE` | the claim holds | the falsifier you ran, and its output |
| `CODE-LIES` | code, comment, test name or commit subject asserts something the code does not do | the exact `path.ext:NN`, the asserting text quoted, and the observed behaviour |
| `BROKEN` | a consumer-reachable defect — wrong result, crash, silent no-op, lost data | a reproduction: command + actual output |

`INCONCLUSIVE-needs-human` is allowed and is **not** a failure — it is the honest verdict when
a claim needs a judgement call or an environment you cannot reach. An invented `TRUE` is a
failure. Prefer five `INCONCLUSIVE` rows to one guess.

## §2 Lanes — take ONLY the lane named in your task title

Counts measured 2026-09-15 against `origin/staging` `08a95a6dea4` with
`git diff --shortstat origin/main...origin/staging -- <paths>`. **`staging` moves several times
a day** — the table is a pinned size estimate for scoping, NOT your population. Re-run the
enumeration in §3 step 1 against the head you actually have, and report that head's SHA.

| Lane | Paths | Files | Lines |
|---|---|---|---|
| **P2-A getff + installer** | `packages/getff` `setup.d` `install.sh` `tests/install-sh` `scripts/build-getff-dist.sh` | 60 | +7157 −1401 |
| **P2-B core enforcement** | `packages/core/principles` `packages/core/hooks` `packages/core/backends` | 63 | +11947 −976 |
| **P2-C core rest + presets** | `packages/core` minus the three above, `packages/preset-*`, `packages/lint-config`, `packages/meta-factory` | 47 | +1815 −344 |
| **P2-D runtime-bridge** | `packages/runtime-bridge` | 49 | +4968 −848 |
| **P2-E agent surface** | `.claude/hooks` `.claude/rules` `.claude/skills` `plugin` `agents` `skills` | 88 | +4519 −883 |
| **P2-F scripts + CI** | `scripts` `.github` | 51 | +5677 −261 |

**P2-A is the highest-stakes lane** — it is the release payload itself. `packages/getff` does
not exist on `main` at all; after this promote it does, and it is what `npx getff init` runs.
Note that `getff@0.0.1` is ALREADY published on npm (2026-06-23, a name reservation), so the
publish that follows is a `0.0.1 → 0.1.0` bump that moves the `latest` tag — an existing-user
surface, not a greenfield one.

## §3 Method — population before verdicts (T10)

1. **Enumerate your lane's population first.** `git diff --name-status origin/main...origin/staging -- <your paths>`. Put the count in the report BEFORE any finding. A verdict count with no denominator is meaningless.
2. **Read the diff, then read the file.** A hunk read without its surroundings is how a correct-looking change hides a broken contract. For every changed exported symbol, open the whole file.
3. **Derive the claim, then falsify it.** For each changed unit write the claim in one line — from its name, signature, doc comment, test names, or commit subject — then run the thing that would prove it false. Static reading alone yields `INCONCLUSIVE`, never `TRUE`.
4. **Run what is runnable.** `npx vitest run <file>` on the touched suites, the shipped shell scripts against a throwaway fixture, `bash install.sh` in a temp consumer for P2-A. Quote command + output (T2/T3).
5. **Check the pairing.** This repo's thesis is that a rule without a falsifier is theatre. For every new gate/check/principle in your lane: does a paired negative test exist, and does removing the guard actually turn it RED? If you cannot show that, the finding is `CODE-LIES` against the gate's own claim.
6. **Sweep by predicate, not by spelling.** When you find one instance, enumerate the class — field + comparator + window — and report every sibling. One spelling is never the population.

## §4 Calibration — already decided, do not re-derive

- **`context7 — refresh library index` is RED on `origin/staging` and is NOT a defect.** `.github/workflows/context7-refresh.yml` has trigger `push: [staging]` and no `pull_request:` trigger; its own comment at `:28-33` says registering it required would leave every PR Pending forever. It fails on `curl exit 22` (library/key not provisioned). P2-F: do not file it. DO check the coupling its comment at `:10-11` declares — the flip to `main` at publication must change that trigger AND `context7.json`'s `branch` field in one commit — and report whether anything else in the repo is coupled to the same flip.
- **The GIT_DIR / `core.bare` class is closed** — #1791 fixed the firing site, #1795 landed the class-wide scrub and its gate. Measured: `env GIT_DIR=<admin-dir> git init -q <path>` exits 0, creates no `.git` at the target, and flips `core.bare` in the COMMON config; only the MAIN checkout then breaks (rc=128) while linked worktrees stay rc=0. P2-B: verify #1795's gate has a working falsifier; do not re-investigate the incident.
- **Recap v2 ships partial by design** — slices 0-2 merged (#1742/#1763/#1771), S3 is in flight in aif `2244e50a`, S4/S5 unwritten. P2-E: report what a consumer sees from the merged half; do not file «incomplete» as a defect.
- **`.claude/orchestrator-prompts/**` and `docs/meta-factory/**` are OUT of every lane.** Dispatch inputs and research records, not product.

## §5 The gate — run it, quote command + output

Before writing §findings, run from the repo root and paste the real output:

```bash
npx vitest run --reporter=basic <every test file your lane changed>
```

A lane whose own suites you did not run cannot report `TRUE` on anything they cover. If a suite
cannot run in your environment, say so by name and mark the claims it covers `INCONCLUSIVE`.

## §6 Deliverable

**One file**, committed on your branch: `.claude/orchestrator-prompts/npm-publish-getff-init/report-p2-<lane>.md`
(e.g. `report-p2-a.md`). Sections, in order:

`§population-enumeration` (count + how derived) → `§method-actually-run` (commands + output) →
`§findings` (one row per finding: verdict, `path.ext:NN`, the asserting text, the falsifier and
its output, and **one line on what a doc sentence written from this code should say**) →
`§coverage` (n verified / n population, as a fraction, per T6 — no bare «high») →
`§self-application` (what auditing this audit would look like; produce a finding) →
`§inconclusive` (what you could not reach, and what would settle it).

**Report only. Change no product code** (T5). The one exception is your own report file.

## §7 Out of scope

Opening a PR against `main`; merging anything; `npm publish` in any form; fixing the findings;
touching the paused umbrella task `790cf853-1638-4732-a801-09ca286ca7cc`; re-running P1's
295-claim doc pass; any lane but your own.

## §8 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active: **T1** (sampling floor 5, depth ≥20 — «first three look clean» is a sampling artifact),
**T2** (designing the method is not running it — «would detect» is banned in §findings),
**T3** (no prose-only findings — command+output or `path:NN` with the line's actual content),
**T6** (no bare «high confidence» — give the fraction), **T9** (sample across the whole window,
not the recent easy end), **T10** (population before sampling), **T14** (clean + low coverage is
«coverage insufficient», not «lane clean»), **T15** (§self-application is mandatory), **T20**
(no verdict without an evidence-bearing call in the same turn).

Domain-specific, **T-P2-A** — *«the diff reads correct, so the behaviour is correct»*: this
delta is 190 PRs that each passed CI and a self-review. The defects that survive that filter
are exactly the ones a careful diff-read also passes: a changed default nobody documented, a
guard whose negative test asserts the wrong thing, a shipped script whose new branch is
unreachable. Counter: for every claim, name the observation that would have caught it and run
that, not the re-read.

Domain-specific, **T-P2-B** — *«it is in the delta, so it is new»*: some hunks are relocations
or vendored twins. Before filing, check `git log --follow` / the pre-image tree; a moved file is
not a new capability and a twin is generated, not authored.

## §9 Host-verify contract

Unlike P1 (which opted out — a pure read of tracked files), this lane RUNS things: the §5 suite
gate, and for P2-A an installer against a throwaway consumer. So it has a real host dependency,
and the acceptance command below must pass on the machine the lane ran on. If it cannot, say so
by name rather than reporting around it.

```bash host-verify
node --version && npx vitest --version && git --version
```

Your branch must be pushed and carry the report. Do NOT open a PR to `main`. A `staging` PR for
the report file alone is acceptable and is the expected egress. State plainly in your final
report whether your lane is `GO` (nothing found that should block the promote), `GO-WITH-NOTES`
(findings exist, none consumer-blocking — list them), or `STOP` (at least one `BROKEN` on a
consumer-reachable path — name it first). The dispatching seat merges the verdicts; the promote
decision is the operator's.
