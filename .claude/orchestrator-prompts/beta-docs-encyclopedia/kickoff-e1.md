<!-- scope: stage kickoff — beta-docs-encyclopedia E1 (census + drift). Dispatch input for ONE read-only task in `artyhoo/getff-landing` through aif project `361685f1-6fe0-407d-a492-ebcfa259407f`. The umbrella plan lives in ../beta-docs-encyclopedia/kickoff.md and is NOT this file's scope. Filename `kickoff-e1.md` = umbrella E, stage 1 — the `kickoff-<letter><digit>` shape is what places it in the stage-kickoff family principle 12's citation gate resolves. No runtime-profile marker is attached, on purpose: the project's mode tiers already resolve to the executor profile (operator GLM-only directive 2026-08-17, beta-docs-showcase kickoff.decisions.md Decision 1); do not pass a preset. -->

# beta-docs-encyclopedia E1 — capability census + drift re-measure (read-only)

> **Type:** read-only census + drift audit, single aif task, autonomous. **Deliverable:
> exactly TWO new files at the task-branch root of the landing repo** —
> `ENCYCLOPEDIA-CENSUS.md` and `E1-REPORT.md`. **Zero edits anywhere else** (`content/`,
> `app/`, `scripts/`, the deploy workflow — all untouched; a diff that touches them is a
> stage failure, not a fix).
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) §0 (the two questions), §2
> (families + the raw-page contract this census feeds), §4 (known inputs — re-measure,
> never rediscover), §5 (T-ENC-A/B).
> **Stage gate into this stage:** BS3 GREEN — cutover merged `8104eabf`, umbrella closed in
> getff#1711, production live. This stage works against a PUBLISHED surface.
> **Rigor label (effort-worthiness L0):** `build-and-verify` for the branch itself (nothing
> deploys from it) — **but the census is research-grade INPUT**: E2+ scope and the
> umbrella's eventual "everything is documented" claim inherit its completeness. An
> undercount here becomes an undocumented capability on the live site there. Enumerate
> before you conclude (T10), always.

<!-- host-verify: none — read-only stage: it authors no executable deliverable in this repo. Its acceptance commands (§3) are read-only git/grep/ls probes inside the aif container's landing worktree; the artifacts land as two Markdown files on the task branch, harvested by the host. -->

## §0 Goal

Answer, with quoted evidence, two questions the operator asked on 2026-09-11:

1. **What does the framework actually ship?** Enumerate EVERY shipped capability, per
   family (umbrella §2's A-I), from the implementation — never from the site, never from
   memory — and record, per item, whether the site documents it (claim-checked, T-ENC-A).
2. **Has the live site drifted since the BS3 audit?** Re-measure the claims most exposed
   to the 35-commit staging drift window and the 7 known framework defects, at the
   framework HEAD you actually read.

This census is the scope SSOT for stages E2-E5 (the raw reference drafts). Its MISSING set
IS their dispatch scope.

## §1 Do this FIRST — entry re-verification

Facts measured **2026-09-11 from the host**. Snapshots: **re-verify, act on what you
find**, quote command + output for each (T3).

| # | Fact at authoring | How to re-verify |
| --- | --- | --- |
| 1 | Your task worktree is branched from the container base `/home/www/getff-landing` at `main` | `git -C /home/www/getff-landing log --oneline -1`; `git log --oneline -1` in your worktree |
| 2 | **The framework repo is on the same filesystem** at `/home/www/rules-as-tests-aif`. Host `origin/staging` at authoring = **`1c9d711cee`**. The clone may lag — **record the HEAD you actually read; it becomes the census pin** and goes in every provenance line and in the census header | `git -C /home/www/rules-as-tests-aif log --oneline -1`; `git -C /home/www/rules-as-tests-aif fetch --dry-run 2>&1 \| head -3` (a fetch is not possible from the container — record, don't chase) |
| 3 | Landing `origin/main` = **`f34fdd2`** (2026-09-10, PR #9 merge). The BS3 audit head `b782f51` is its ancestor; the post-audit diff is expected to touch only `BS3-REPORT.md` and the `/docs/` index page | `git rev-parse origin/main`; `git merge-base --is-ancestor b782f51 origin/main && echo ANCESTOR-OK`; `git diff --name-only b782f51..origin/main` — read anything content-bearing |
| 4 | The drift window: `94a3a9efcd..1c9d711cee` = **35 commits** (at authoring). Load-bearing for site claims: #1694 (runtime-bridge review-state), #1702 (bootstrap digest block), #1707 (merge policy), #1708-#1710 (zcode-parity), #1712 (closure sweep) | `git -C /home/www/rules-as-tests-aif log --oneline 94a3a9efcd..HEAD \| wc -l`; same without the pipe to eyeball the list |
| 5 | `CLAIMS-LEDGER.md` at main root: 86 base rows + the §BS3 rounds 2-9 dispositions. `BS3-REPORT.md` §Findings = the 7 known framework defects. `BS3-GAPS.md` = the round-1 ledger, whose census table (surfaces × unrowed claims) is the surface-enumeration template | `wc -l CLAIMS-LEDGER.md BS3-REPORT.md BS3-GAPS.md`; `sed -n '/## Findings/,/^## /p' BS3-REPORT.md` |
| 6 | No `github.com` egress from the container; the npm registry is reachable. You never push — the host harvests | `curl -m 6 -sS -o /dev/null -w '%{http_code}' https://github.com` (expect a failure — that IS the fact) |
| 7 | Production is live and green (host snapshot 2026-09-11: `/`, `/docs/`, `/llms.txt`, `/llms-full.txt`, `/rss.xml` all 200; prototype 404; draft contained). Given — do NOT probe the public site from the container | host-side fact; no container action |
| 8 | Toolchain node v22 / npm 10. E1 runs NO build — if you find yourself running `npm run build`, you have left the stage | `node -v` |

## §2 Deliverables

### D1 — `ENCYCLOPEDIA-CENSUS.md` (the scope SSOT for E2+)

Families A-I, boundaries per umbrella §2 (you may refine a boundary, never shrink the
union). Per family:

1. **Preamble:** the enumeration command(s) you ran (e.g. `ls setup.d/`, the skills
   manifest arms in `setup.d/10-skills.sh`, `ls packages/core/hooks/`, the per-lane
   template trees under `packages/core/templates/`, the plugin surface), their **quoted
   output**, and the item count you derived.
2. **One row per item:** `| id | ships-to | what (one line) | anchors | satellites | site
   coverage |` where:
   - **ships-to** — lanes / tier arms that receive it (npm, python, cargo, go; core,
     env+, factory+);
   - **anchors** — at least TWO `file:line` anchors, and at least one carries the line's
     actual content quoted (an anchor without its quoted line is unverifiable later);
   - **satellites** — the upstream/peer capabilities it uses/adapts, or `—`;
   - **site coverage** — exactly one of: `documented <url>` (name the page SENTENCE that
     documents the behavior — not a title match, T-ENC-A), `PARTIAL <url> <what is
     missing>`, or `MISSING`.

The census header stamps the framework commit you read (§1 row 2) and the date. Close the
census with the per-family MISSING roll-up — that list is E2-E5's dispatch scope.

### D2 — drift re-measure (a section of `E1-REPORT.md`, NOT of the census)

1. **The anchor-touch intersection:** ledger rows in `CLAIMS-LEDGER.md` whose cited
   framework files appear in `git -C /home/www/rules-as-tests-aif diff --name-only
   94a3a9efcd..HEAD`. List the intersection, then **re-verify every such row** with a
   fresh probe — VERIFIED/GAP with command + output, the claims-auditor grammar.
2. **The 7 known defects** (umbrella §4 lists them with anchors): re-measure each at the
   HEAD you read. Fixed upstream since BS3 → `VERIFIED-fixed`; still broken → `GAP-carried`
   (it stays a finding for the operator's fix dispatch — you never fix it).
3. **Landing-side additions since the audit:** pages added after `b782f51` (expected: the
   `/docs/` index page, PR #6 — authored claim-free by design). Verify no NEW claims
   entered un-ledgered.

### D3 — `E1-REPORT.md`

§1 rows with outputs · D2 drift section · §3 gate table · T7 counter-prompt · findings ·
parks · the verdict line:
`E1: GREEN — census <N> items across 9 families, drift <M> rows re-measured (<K> GAP), MISSING set explicit`
or `E1: FAIL — <which row, with output>`.

## §3 The gate — run it, quote command + output (T2/T3)

| # | Check | How |
| --- | --- | --- |
| 1 | Exactly two new files, nothing else touched | `git status --porcelain`; `git diff --stat origin/main` — two paths, both at repo root |
| 2 | Families A-I all present, each with its enumeration command + quoted output | `grep -c '^## ' ENCYCLOPEDIA-CENSUS.md`; read-back per family |
| 3 | Per family: the enumeration-derived count == the row count | paste the family preamble count and `grep -c '^\\| '` for that family's table |
| 4 | Every row has ≥2 anchors (≥1 with quoted line), ships-to, and a 3-form coverage status | a read-back sweep over the census; quote the row count that passed |
| 5 | Coverage is claim-checked: every `documented`/`PARTIAL` names the page + the sentence | spot-read 10 rows across families in the report — quote them |
| 6 | The anchor-touch intersection is listed, and every ledger row citing a touched file was re-verified | quote the intersection list + the re-verification tally |
| 7 | The 7 known defects re-measured, each with a disposition | quote each disposition line |
| 8 | The MISSING roll-up exists and matches the census tables | `sed -n '/MISSING/,$p' ENCYCLOPEDIA-CENSUS.md` cross-check |
| 9 | No claims entered the landing repo outside the two files | `git diff --name-only origin/main` — the two paths only |
| 10 | T7 counter-prompt ran and its checks are reported | the report's T7 section |

**On any FAIL:** report it with the output and **STOP**. No fix-forward past the gate.

## §4 Out of scope — and the floors

- **No edits to the site** (content, app, config, workflow). Not even "tiny fixes" —
  drift you find is REPORTED (D2), fixed by E2+.
- **No framework-repo edits.** Read `/home/www/rules-as-tests-aif` all you need; write
  nothing there. Its defects are findings.
- **No pushes, no PRs.** Commit on the task branch; the host harvests (§6).
- **No cold-audit role.** You re-measure the bounded drift set (D2); the FULL cold audit
  of the final surface is E6's. Do not inflate D2 into one.
- Operator questions → **park** (aif park/answer) and continue park-independent work, or
  exit clean. Never improvise around a floor.

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active traps: **T2, T3, T7, T10, T12, T14, T19** + umbrella **T-ENC-A/B**.

- **T2** — designing ≠ auditing. Every §3 row is run, not described.
- **T3** — no prose-only findings. Command + output, or `file:line` with the line's content.
- **T7** — before declaring green, write and run the adversarial counter-prompt: «what
  would make this census look complete when it is not?» Candidates to actually check: an
  enumeration command that misses a delivery arm (skills shipped by env+ but invisible to
  a core-only `ls`); coverage marked `documented` off a URL slug alone; the drift
  intersection computed against a HEAD different from the stamped pin; a family whose
  count matches only because rows were dropped to meet it.
- **T10** — enumerate before claiming. The census IS the enumeration; a family described
  from its best-known member is a fail.
- **T12** — every framework fact from the clone at the HEAD you read, never memory. The
  35-commit window exists precisely because memory is stale.
- **T14** — coverage bounds the verdict. Ten §3 rows run and passing = green; nine = «not
  green», regardless of how the ninth "obviously" passes.
- **T19** — run your own cold pass over both files before reporting done: every family's
  count chain, every anchor resolvable, every coverage claim pointing at a sentence that
  exists.
- **T-ENC-A/B** (umbrella) — coverage is sentence-checked, never word-matched; the
  census enumerates from the implementation, never from the site.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **Project:** `361685f1-6fe0-407d-a492-ebcfa259407f` (`getff-landing`). The operator
  shell may export `RUNTIME_BRIDGE_AIF_PROJECT_ID` pointing at the FRAMEWORK project —
  override it explicitly on the dispatch command, or the task lands on the wrong project
  (the BS2 lesson, kickoff-b2 §6).
- **Branch naming:** aif names the worker's branch `feature/beta-docs-encyclopedia-<taskid>`.
- **Harvest:** the artifacts are docs-only Markdown at the branch root — the host harvests
  the branch and opens a PR to landing `main` (merge-commit, the PRs #5-#9 convention).
  Nothing here deploys anything user-visible, but the merge still fires the Pages deploy —
  check it green.
- **Pre-dispatch in-flight probe:** adjudicate any `DONE-UNHARVESTED` false positives from
  the BS umbrella before adding this task; record the adjudication.
- **No preset, no profile override** — the project's mode tiers already resolve to the
  executor profile; the dispatch passes neither.

## §7 Report format

`E1-REPORT.md` at the branch root, next to the census. It must carry:

1. **§1 entry re-verification** — the eight rows, each with the command and its output,
   including the framework HEAD you read (the census pin).
2. **D2 drift section** — the intersection list, the per-row re-verifications, the 7
   defect dispositions, the landing-side check.
3. **§3 gate table** — ten rows, actual command + actual output each, plus the verdict line.
4. **T7 counter-prompt** — what you wrote, what you ran, what it surfaced.
5. **Findings** — census surprises, framework defects (new or carried), anything the site
   claims that the framework could not support. These are the umbrella's honest-claims
   output, not failures.
6. **Parked questions** — the operator forks you hit and how you stated them.
