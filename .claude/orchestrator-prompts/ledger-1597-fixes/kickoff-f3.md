# KICKOFF — ledger-1597-fixes / F3 — firing-runner: an exit code is not a firing signal

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first.
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Findings:** A7-2, A7-3, A7-5 (verbatim below). Line numbers are at `992377dbdb`; relocate on the current base.

## Task

Make each lane of `packages/core/synthesizer/run-rule-tests-firing.sh` decide "fired" from the linter's structured diagnostics (rule id / diagnostic code in JSON output), never from the process exit code — for ast-grep (A7-2), cargo clippy (A7-3) and ruff (A7-5). Three atomic commits (one per lane), one PR to `staging`.

## Context (data — the findings, verbatim from the ledger)

### A7-2 — astgrep firing verdict = exit code; warning rules false-RED `[CONFIRMED]`
- **Where:** `packages/core/synthesizer/run-rule-tests-firing.sh:181` (synth+research+validator)
- **Defect:** The astgrep lane's only 'fired' signal is `ast-grep scan` exit≠0, but ast-grep exits 0 on a matched warning/hint-severity rule and 8 on an unparseable rule YAML, so a legitimately firing warning-severity researched rule is reported as broken material (push-blocking RED) while a broken rule file reports every bad[] sample as fired.
- **Failure-scenario:** Practice JSON with defaultSeverity warning → sidecar bad[] sample matches → exit 0 → '✗ FAIL bad sample did NOT fire' → pre-push dies on correct material. Inverse: unparseable rule YAML → exit 8 → every bad[] counted fired (good[] arm goes RED so the file is caught, but the bad[] arm alone is blind).
- **Verifier:** Reproduced on ast-grep 0.44.1 with the exact lane layout: warning rule match → exit 0; error match → 1; broken YAML → 8. :178/:181 map rc≠0 → fired. Warning severity reachable (research-to-node.ts:92 defaultSeverity; render-astgrep.test.ts R5 asserts warning renders as warning).

### A7-3 — cargo lane conflates compile error/any warning with 'fired' `[CONFIRMED]`
- **Where:** `packages/core/synthesizer/run-rule-tests-firing.sh:276` (synth+research+validator)
- **Defect:** The cargo lane decides 'fired' from `cargo clippy -- -D warnings` exit≠0, so any compile error or unrelated warning in the planted sample (dead_code for the private fn main every pairedExamples sample carries once planted as src/lib.rs, an unresolved module) counts as the ban firing — unlike _cargo_firing_self_check it claims to mirror, which parses the diagnostic code from --message-format=json.
- **Failure-scenario:** GETFF_PREPUSH_CARGO_FIRE=1 with a sidecar seeded from a cargo node: good[0] = `fn main() { let _ = app_config::env_var("HOME"); }` (test-fixtures.ts:23) — app_config undefined → compile error → rc≠0 → '✗ FAIL [cargo …] good sample FIRED — over-fire' → pre-push dies on correct material; a bad[] sample that merely fails to compile is reported as fired.
- **Verifier:** Deterministic by Rust semantics: :271 plants sample as src/lib.rs, Cargo.toml has no [dependencies], :275-276 map any rc≠0 to fired; the claimed mirrors (46-cargo.sh:308-309, firing.test.ts:23) key on diagnostic codes, not exit. Lane opt-in via GETFF_PREPUSH_CARGO_FIRE=1.

### A7-5 — ruff lane: syntax-error sample counted as 'fired' `[CONFIRMED]`
- **Where:** `packages/core/synthesizer/run-rule-tests-firing.sh:235` (synth+research+validator)
- **Defect:** The ruff lane also uses exit≠0 as 'fired', but ruff exits 1 for a syntax error in the sample regardless of the narrowed select (and 2 for a config error), so a bad[] sample that does not parse is reported as firing the code under test — an arm that cannot go RED for that sample.
- **Failure-scenario:** Sidecar ruff.json bad[0] = `import datetime\nx = datetime.datetime.utcnow(` (typo) under TID251. Verified on ruff 0.15.21 with select=["TID251"]: syntax-error sample → rc=1 → '✓ [ruff TID251] bad sample fired RED' although TID251 never matched; the material is attested sound while blind.
- **Verifier:** Reproduced on ruff 0.15.21 with the lane's exact invocation: syntax-error sample → exit 1 (invalid-syntax); real TID251 match → 1; clean → 0. :233/:235 cannot distinguish the two rc=1 cases.

## Constraints

- Owned files: `packages/core/synthesizer/run-rule-tests-firing.sh` and its test material (the sibling test script / fixtures that exercise the runner — locate with `grep -rln 'run-rule-tests-firing' packages/ tests/`). The TypeScript firing runners under `packages/core/backends/` already parse structured output (`--json` for ast-grep, `--output-format json` for ruff, `--message-format=json` for cargo) — REUSE their invocation shape and identity extraction; do not invent a third parser.
- Decision per lane: "fired" ⇔ the diagnostics contain the rule id under test; a parse/config failure of the SAMPLE is a distinct outcome (`✗ sample invalid`) that is RED on both good[] and bad[] arms; a broken RULE file is `✗ rule invalid`, never "fired".
- The runtime has NO ast-grep, ruff, cargo or go. Tests must use recorded fixtures: a fake `ast-grep`/`ruff`/`cargo` shim on PATH that emits captured JSON and the exit code named in the finding. Prove each lane RED on the current base with the shim, then GREEN.
- Iteration cap: 6 tool-loop rounds per lane; then report PARTIAL.

## Tools

Bash, Read, Edit, Grep, git. `jq` may be absent — check `command -v jq`; if absent use `node -e` for JSON extraction, consistent with what the script already does.

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, then `Deliverable:`, `Evidence:` (per lane: RED with shim on base, GREEN after), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T3** (command output or `file:line` behind every claim), **T5** (the owned-file row is the whole scope), **T14** (a SKIPped lane proves nothing — say which lanes executed), **T19** (cold-review your own diff before the report), **T20** (quote the output behind each verdict).

## Verify

1. Per lane, a shim-driven case where exit code and diagnostics disagree: (ast-grep) exit 0 + matched warning → fired; exit 8 → rule invalid, not fired. (ruff) exit 1 + `invalid-syntax` only → sample invalid, not fired; exit 1 + TID251 → fired. (cargo) rc≠0 + E0433 only → sample invalid; clippy diagnostic with the banned code → fired.
2. The runner's existing tests still pass (quote the tail).
3. `git diff origin/staging --stat` lists only the runner and its test material.

```bash host-verify
bash tests/run-rule-tests-firing.test.sh 2>/dev/null || bash $(grep -rln 'run-rule-tests-firing' tests/ packages/core/synthesizer/ | grep '\.test\.sh$' | head -1)
bash scripts/run-local-ci-sweep.sh
```
