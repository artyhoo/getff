# §5 gate self-check — every row: command + verbatim output (T2/T3)

> **Round 2 re-walk** (2026-09-08): the round-1 benches had expired and the round-1 census
> carried two `delivered` derivation defects (review BLOCKER) plus a phantom row (MAJOR 2) and
> a non-runnable self-falsification mechanism (MAJOR 1). The three installs were re-run (Gate 1),
> `gen-census.mjs` was fixed into a real verifier, the census regenerated (275 rows), and every
> gate re-walked below. Round-1 records retained at the bottom.
>
> **Harvest-round addendum (2026-09-09):** a cold review of the harvested branch found 1 Critical
> + 6 Important + 8 Minor. The census moved from **275 to 276 rows** (root
> `skills/tool-bootstrapping/` was enumerated but dropped by a hardcoded literal — I1) and the
> verdict counts from `273/1/1` to `273/2/1` (`.claude/hooks/inject-matching-rule.sh` → DOC-LIES
> — C1). Every «275» below is the **round-2 record and stays as written**; the harvest-round
> re-walk is appended at §Harvest-round re-check, run against three fresh **host** installs.

## Gate 1 — three profiles installed into fresh dirs; three full logs captured

Round-2 re-run (dirs recorded in `logs/consumer-dirs-r2.txt`):
```text
$ cat logs/consumer-dirs-r2.txt
core /tmp/census-consumer-core-r2-lacg1W
env /tmp/census-consumer-env-r2-y3F4uO
factory /tmp/census-consumer-factory-r2-TZpjMT
$ grep -H "install exit" logs/install-*-r2.log
logs/install-core-r2.log:--- install exit=0 @ 22:04:45
logs/install-env-r2.log:--- install exit=0 @ 22:04:46
logs/install-factory-r2.log:--- install exit=0 @ 22:04:48
$ wc -l logs/install-*-r2.log
 179 logs/install-core-r2.log
 198 logs/install-env-r2.log
 228 logs/install-factory-r2.log
```
Line counts identical to round 1 (179/198/228) — same-commit reinstall reproduces the same
delivery. Tree spot-check vs §M4/§M7 truth: agents 11/11/13, scripts 20/24/25, skills
6/11/16, `.claude/rules` absent ×3 (Gate 6).

## Gate 2 — population enumerated per §2, full lists

```text
$ jq '.meta.population_total, .meta.verdict_counts' census-v0.json
275
{
  "BY-DESIGN": 273,
  "DOC-LIES": 1,
  "BROKEN": 1
}
$ jq '.rows | group_by(.class) | map({(.[0].class): length}) | add' census-v0.json
{
  "agent": 20, "ci-workflow": 5, "companion": 6, "discipline-rule": 30,
  "hook": 25, "hook-check": 13, "hook-check-test": 12, "lint-bundle": 8,
  "mcp-config": 1, "principle": 47, "script": 85, "skill": 17, "template": 6
}
```
Per-file lists: `logs/population-enumeration.md` + `-2.md` (+ §C11b addendum for the
consumer-script sources round 1 missed — the class is now 85 = 62 repo `scripts/` + 23
`packages/core/{audit-self,probes,synthesizer}` sources).

## Gate 3 — every row carries verdict + evidence, AND `delivered` agrees with the trees

**(a) verdict/evidence presence** (the round-1 check, re-run):
```text
$ jq '[.rows[] | select((has("verdict") and has("evidence")) | not)] | length' census-v0.json
0
```

**(b) NEW — `delivered`-vs-trees consistency** (`gen-census.mjs --check`: re-derives every
row's `delivered` from the live trees — roots from `--repo/--core/--env/--factory` argv or
`CENSUS_*` env with the container bench as default — and exits non-zero on any disagreement,
writing nothing):
```text
$ node gen-census.mjs --check
gen-census --check: repo=/home/www/rules-as-tests-aif-feature-consumer-truth-audit-55b9ad-55b9ad6a-8c8d-47de-8672-bbe63c892370
gen-census --check: core=/tmp/census-consumer-core-r2-lacg1W
gen-census --check: env=/tmp/census-consumer-env-r2-y3F4uO
gen-census --check: factory=/tmp/census-consumer-factory-r2-TZpjMT
gen-census --check: 275 tree-derived rows vs 275 census rows in …/census-v0.json
CHECK OK: 0 delivered disagreements; artefact sets identical (275/275); nothing was written
```
(full output: `logs/check-green.out`; exit=0)

**(c) the check discriminates** — same command against the round-1 census (pre-fix, kept at
git HEAD~0 until this commit): **exit=1, 40 findings** (full list: `logs/check-red.out`):
```text
$ node gen-census.mjs --check; echo "exit=$?"
… 9 × DELIVERED-MISMATCH .claude/agents/*  (7 authoring-only: census true³ vs trees false³;
   2 factory-only: census true³ vs trees false/false/true)      ← round-1 Bug A
… 5 × DELIVERED-MISMATCH scripts/*          (census false³ vs trees env+factory / factory)
… NOT-DERIVABLE: packages/core/templates/ts-server-configs/    ← round-1 MAJOR 2 (phantom)
… MISSING-FROM-CENSUS + NOT-DERIVABLE × eslint-rules-local     ← mis-pathed row (root, not packages/core/)
… 23 × MISSING-FROM-CENSUS scripts/*        ← never-enumerated consumer-script sources
CHECK FAILED: 40 finding(s) — census disagrees with the live trees (exit 1); nothing was written
exit=1
```
Round-1's gate 3 checked key presence only and never compared `delivered` against §M4/§M7 —
which is exactly why 82 wrong rows passed. The comparison is now part of the gate and is
runnable by V1 (`node gen-census.mjs --check`).

## Gate 4 — every WORKS check has severed + factory-control results

Not re-executed (rework scope: the WORKS lane, install logs, L1/L2/L3 severing and the
aged-stratum contract stand). Round-2 verification is confined to the `delivered` column and
the enumeration it derives from. Round-1 record stands: `works-checks.md`
§L2/§L2b/§L2c/§L2d/§L2e + the L3 rename-sever window; factory controls per defect claim
(guard-liveness: ERR_MODULE_NOT_FOUND severed vs LOADED OK on factory — §L2d).

## Gate 5 — aged stratum MEASURED (host run, real join) + script re-verified

**Harvest-round update (cold review I5).** The heading above used to say «measured» while the
record underneath was an N/A contract, and the script's delta block printed bucket definitions
without joining anything. Both are fixed: the join is implemented in `host-verify-aged.sh` and
was run against a real aged consumer install on the host —
`bash host-verify-aged.sh /Users/art/code/timeliner census-v0.json` → exit 0, **4 shipped-since /
21 never-shipped / 5 consumer-authored** over the comparable classes (skill, agent, hook), with
every other class printed as `NOT-COMPARED` rather than dropped. Full run + reading + limits:
`logs/aged-stratum-join.md`.

Round-2's own record (`logs/aged-stratum.md`) stands as the container-side history: inside the
agent container there was no aged install, so N/A was the honest answer *there*. The exit
contract is unchanged (exit 3 = absent, 4 = not an install, 0 = valid).

Round-2 fixes to the script, verified live (shellcheck 0.11.0 from the PyPI wheel — github
egress blocked, pypi reachable; binary at /tmp, not committed):
```text
$ shellcheck host-verify-aged.sh && echo "shellcheck exit=0 (post-fix)"
shellcheck exit=0 (post-fix)
$ bash -n host-verify-aged.sh && echo clean
clean
$ T=$(mktemp -d); mkdir -p "$T/.claude/agents"; : > agent x.md …
$ bash host-verify-aged.sh "$T"; echo exit=$?
aged-inventory.json written: …
NOTE: read-only measurement — nothing inside …/hva-aged-4uQi was touched.
empty-class exit=0
{"skills":[],"agents":["x.md"],"hooks":[],"rules_dir":"absent","workflows":[],"scripts":[],"ai_factory":[],"mcp_json":"absent","settings_registrations":"none"}
$ bash host-verify-aged.sh /tmp/does-not-exist-xyz; echo exit=$?
AGED-ABSENT: /tmp/does-not-exist-xyz does not exist on this machine (exit 3)
absent-root exit=3 (want 3)
$ bash host-verify-aged.sh <dir-without-.claude>; echo exit=$?
NOT-AN-INSTALL: …/.claude missing (exit 4)
not-an-install exit=4 (want 4)
```
Empty classes now emit `[]` (was `[""]` — the phantom `""` element the never-shipped bucket
could have joined against); populated classes render unchanged; the exit contract is intact.

## Gate 6 — .claude/rules/ answered definitively, all three profiles (round-2 trees)

```text
$ for d in core-r2 env-r2 factory-r2; do test -d "$d/.claude/rules" && echo present || echo ABSENT
census-consumer-core-r2-lacg1W ABSENT
census-consumer-env-r2-y3F4uO ABSENT
census-consumer-factory-r2-TZpjMT ABSENT
```
Census rows class=discipline-rule (30) carry the corrected citation `setup.d/20-agents.sh:44`
(«rules/ is not shipped» — round 1 cited `:45`, the comment's trailing half).

## Gate 7 — delivered scripts grepped for factory-path escapes; hits with file:line

Not re-executed (WORKS-lane evidence stands): round-1 L1 results in `works-checks.md` §L1 —
core 4, env 14, factory 26 hits with file:line; host-absolute `/Users/art` findings = 5 lines
in env+factory orchestrator references (F2). The `delivered` set this grep ran over is a
subset of the round-2 script class (same delivered files, now all rowed).

## Gate 8 — zero BY-DESIGN rows lacking a citation

```text
$ jq '[.rows[] | select(.verdict == "BY-DESIGN" and (has("by_design_citation") | not))] | length' census-v0.json
0
```

## Gate 9 — coverage stated as enumerated/population

```text
HAS×DELIVERED: 275/275 rows (census-v0.json, jq class counts in Gate 2)
WORKS executed-severed (round-1 record, stands): 11 hooks ×3 profiles + 12 scripts ×2 + 2 husky
hooks + 4 artefacts in the L3 window + 2 import probes
aged stratum: 0 measured — N/A host-scoped (T14: unreached, not clean) — report §coverage
```

## Gate 10 — self-falsification present and non-trivial

```text
$ grep -n '^## §self-falsification' report-v0.md
239:## §self-falsification
```
Item 1 is now an executable claim (the `--check` verifier, quoted under Gate 3) instead of the
round-1 claim that could not run (hardcoded roots, in-place write, no check mode); item 6
records what the verifier caught on its own first run (T15).

## Host-verify contract (re-run at gate time, seeded target dir)

```text
$ T=$(mktemp -d); printf '{"name":"f","private":true,"dependencies":{"typescript":"^5"}}' > "$T/package.json"
$ (cd "$T" && bash install.sh --dry-run </dev/null | tail -3); echo "dry-run exit=$?"
  7. Run: npm run validate

For full guide: see INSTALL.md
dry-run exit=0
```
(The round-1 gate quote ran the same command from the repo root and recorded the designed
«Refusing to install into the package directory itself» EOF branch, exit=1. Host-side
re-verification per the kickoff contract remains the maintainer's acceptance step.)

## Round-2 acceptance crosswalk

| # | acceptance | evidence |
|---|---|---|
| 1 | `--check` re-derives, exits 0, zero disagreements | Gate 3b (quoted; `logs/check-green.out`) |
| 2 | agents 11/11/13, scripts 20/24/25 via jq | below |
| 3 | census rows = report §population per-class sum, one denominator | 275 = `meta.population_total` = report §population (scripts 85 breakdown there) |
| 4 | `shellcheck host-verify-aged.sh` exit 0; empty class emits `[]` | Gate 5 (quoted) |
| 5 | gates re-walked; gate 3 checks evidence-vs-`delivered` | this file |
| 6 | nothing outside `.claude/orchestrator-prompts/consumer-truth-audit/` | `git diff --name-status origin/staging...HEAD` at commit (quoted in the handoff summary) |

```text
$ jq -c '[.rows[] | select(.class=="agent")] | {rows: length, core: map(select(.delivered.core))|length, env: map(select(.delivered.env))|length, factory: map(select(.delivered.factory))|length}' census-v0.json
{"rows":20,"core":11,"env":11,"factory":13}
$ jq -c '[.rows[] | select(.class=="script")] | {rows: length, core: map(select(.delivered.core))|length, env: map(select(.delivered.env))|length, factory: map(select(.delivered.factory))|length}' census-v0.json
{"rows":85,"core":20,"env":24,"factory":25}
```
(= §M4 agents and §M7 scripts exactly; the script class grew to 85 rows because the
round-1 population missed the installer's real delivery sources — see §C11b.)

## Round-1 record (retained)

Round 1: three fresh installs 2026-09-08 18:15 (`logs/install-{core,env,factory}.log`, dirs in
`consumer-dirs.txt`), population 253 rows, gate-3 fix-and-rerun loop (4 rows missing `evidence`
keys in `checkFacts` → explicit `e:` strings added → 0). That gate checked key presence only;
the `delivered`-vs-trees comparison did not exist, and the round-1 census's agent/script rows
were wrong (Bug A: `dbool()` object-as-boolean at :85-86; Bug B: `scripts/` prefix mismatch at
:40-42 vs :278) — fixed in round 2 and now mechanically guarded (Gate 3b/c).

## Harvest-round re-check (2026-09-09, three fresh HOST installs)

Cold-review fixes C1 / I1 / I3 / I5 / M2 / M7 applied, then the census regenerated and
re-verified. Benches: three `mktemp -d` dirs on macOS, seeded with a minimal `package.json`
(typescript devDependency) + `git init`, installed with `bash install.sh --profile <p> </dev/null`
**from inside the target directory** (passing the target as an argument trips
«Refusing to install into the package directory itself»). All three `EXIT=0`.

```text
$ node gen-census.mjs
wrote …/census-v0.json
rows: 276 {"BY-DESIGN":273,"DOC-LIES":2,"BROKEN":1}

$ node gen-census.mjs --check
gen-census --check: repo=…/harvest-v0-r2
gen-census --check: core=/tmp/census-host-core-…
gen-census --check: env=/tmp/census-host-env-…
gen-census --check: factory=/tmp/census-host-factory-…
gen-census --check: 276 tree-derived rows vs 276 census rows in …/census-v0.json
CHECK OK: 0 delivered disagreements; artefact sets identical (276/276); nothing was written
```

Delivered matrix re-measured on the host benches — unchanged from the container round:
skills 6/11/16, agents 11/11/13, hooks 9/9/10 registered in `settings.json`
(9 registrations over 8 distinct scripts, identical per profile — this is the M2 correction to
the earlier «7 hooks» evidence string), `.claude/rules` absent ×3, `packages/core/principles`
absent ×3.

The container's factory bench had degraded to env-level
(`logs/install-factory-r2.log:222-226`); the host's did not
(`[aif-handoff-guided-install] diagnose: state=up at http://localhost:3009` → `no-op`). The
`delivered` column came out identical on both, so the degradation did not move the result —
recorded because round 2 never disclosed it (cold review I2).
