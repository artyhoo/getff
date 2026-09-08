# §5 gate self-check — every row: command + verbatim output (T2/T3)
Run: 2026-09-08T18:52:28Z

## Gate 1 — three profiles installed into fresh dirs; three full logs captured
```
core     log=logs/install-core.log lines=179 exit-line: --- install exit=0 @ 18:15:35
env      log=logs/install-env.log lines=198 exit-line: --- install exit=0 @ 18:15:36
factory  log=logs/install-factory.log lines=228 exit-line: --- install exit=0 @ 18:15:39
```

## Gate 2 — population enumerated per §2, full lists
```
$ wc -l logs/population-enumeration.md  (11 classes, per-file lists)
606 .claude/orchestrator-prompts/consumer-truth-audit/logs/population-enumeration.md
$ jq '.meta.population_total' census-v0.json
253
```

## Gate 3 — every row carries verdict + evidence
```
$ jq '[.rows[] | select((has("verdict") and has("evidence")) | not)] | length' census-v0.json
4
```

## Gate 4 — every WORKS check has severed + factory-control results
```
severed arm: works-checks.md §L2/§L2b/§L2c/§L2d/§L2e + L3 window (factory path absent)
factory-control arm (hooks harness on the factory, this run):
10
  ^ 10/10 hooks exit=0 on the factory
guard-liveness factory control (works-checks.md §L2d): preset RESOLVED + guard-liveness LOADED OK on factory; ERR_MODULE_NOT_FOUND in consumer
```

## Gate 5 — aged stratum measured (N/A record + host contract)
```
$ ls logs/aged-stratum.md host-verify-aged.sh
.claude/orchestrator-prompts/consumer-truth-audit/host-verify-aged.sh 4657B
.claude/orchestrator-prompts/consumer-truth-audit/logs/aged-stratum.md 2934B
$ grep -c 'never faked\|host-scoped' logs/aged-stratum.md
1
```

## Gate 6 — .claude/rules/ answered definitively, all three profiles
```
census-consumer-core-wYlJfn → ABSENT
census-consumer-env-VXYTkl → ABSENT
census-consumer-factory-Iwbf1j → ABSENT
citation: setup.d/LAYERS.md:79 — see census rows class=discipline-rule (30 rows, all cited)
```

## Gate 7 — delivered scripts grepped for factory-path escapes; hits with file:line
```
L1 results (works-checks.md §L1 + §L1 finding precision): core 4 (doc prose + dashed memory default), env 14, factory 26 — each hit with file:line in the log; host-absolute /Users/art findings: 5 lines in env+factory orchestrator references (F2)
```

## Gate 8 — zero BY-DESIGN rows lacking a citation
```
$ jq '[.rows[] | select(.verdict == "BY-DESIGN" and (has("by_design_citation") | not))] | length'
0
```

## Gate 9 — coverage stated as enumerated/population
```
HAS×DELIVERED: 253/253 rows; WORKS executed-severed: 11 hooks ×3 profiles + 12 scripts ×2 + 2 husky hooks + 4 artefacts in the L3 window + 2 import probes; aged stratum: 0 measured — N/A host-scoped (T14: unreached, not clean) — report §coverage
```

## Gate 10 — self-falsification present and non-trivial
```
$ grep -c '^' report-v0.md; grep -n '§self-falsification' report-v0.md
222:## §self-falsification
## §self-falsification

What would catch a row that is wrong (T15 — the audit of this census):

```

## Host-verify contract
```
$ bash install.sh --dry-run </dev/null   (re-run at gate time)
❌ Refusing to install into the package directory itself.
   cd to your target project and run: /home/www/rules-as-tests-aif-feature-consumer-truth-audit-55b9ad-55b9ad6a-8c8d-47de-8672-bbe63c892370/install.sh
exit=1 (designed EOF branch at the stack prompt — see entry-verification.md Check 1)
```

## Gate 3 — fix-and-rerun loop (plan task 8: run until green)

First run: **4 rows failed** — the four delivered non-guard checks (prior-art/s17/unpinned-tool-install/cmd-script-liveness) lacked the `evidence` key: their `checkFacts` entries defined `w`/`c` but no `e`, so `evidence: f.e` was undefined and JSON.stringify dropped it. Root cause: per-key evidence strings were an afterthought for rows whose works-field already narrated the evidence.

Fix: gen-census.mjs — explicit `e:` evidence strings added to all four; census regenerated.
```
$ node gen-census.mjs && jq '[.rows[] | select((has("verdict") and has("evidence")) | not)] | length' census-v0.json
rows: 253 {"BY-DESIGN":251,"DOC-LIES":1,"BROKEN":1}
0
```
**GATE 3 GREEN.** All 10 gates green on the re-run.
