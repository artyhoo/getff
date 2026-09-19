# KICKOFF — ledger-1597-fixes / F5 — C-2: the delivered ask-file gate is dead on consumers

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first; this is a **§1b tail stage**.
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Findings:** C-2 (verbatim below; absorbs A1-5). Line numbers relocated at `e55e4bf2f6`.
> **Routing decided by the coordinator:** REMOVAL on the installer side. Do NOT flip the `ask-file-schema` section owner in `packages/core/hooks/pre-push.ts` — that section reads a maintainer mailbox literal (`scripts/check-ask-files.sh:12-16`) and cannot work on a consumer.

## Task

Stop delivering `scripts/check-ask-files.sh` to npm consumers (`setup.d/50-hooks.sh:61-70`), remove every installer/refresh arm and shipped pointer that promises the gate exists on a consumer, and make `--refresh` report an already-delivered stale copy through the existing refresh-divergence machinery without deleting the consumer's file. One PR to `staging`.

## Context (data — the finding, verbatim from the ledger)

### C-2 — Delivered ask-file gate is dead: section is maintainer-only `[CONFIRMED]`
- **Where:** `setup.d/50-hooks.sh` (installer; the delivery block is at :61-70 on `e55e4bf2f6`)
- **Defect:** 50-hooks.sh delivers scripts/check-ask-files.sh to every npm consumer on the premise that pre-push.ts askFileSchemaSection presence-gates it and 'an undelivered script means the gate NEVER FIRES on a consumer', but the section registry tags ask-file-schema as owner 'maintainer' and composeSections() drops maintainer sections on consumers — the delivered script is never invoked by a consumer's pre-push and the delivery comment (and the install.sh refresh arm, A1-5) describe a gate that does not exist on consumers.
- **Failure-scenario:** Consumer installs (50-hooks.sh:68 lands scripts/check-ask-files.sh), writes a malformed ask file and pushes → activeSections(false) filters 'ask-file-schema' (owner 'maintainer') out → askFileSchemaSection never runs → push green; the delivery rationale and the refresh arm describe a gate that does not exist on consumers (supersedes A1-5).
- **Verifier:** pre-push.ts owner 'maintainer' on the ask-file-schema section; composeSections drops it on consumers; only other invocation is the PREPUSH_ONLY test seam; no consumer-side caller of check-ask-files.sh anywhere, yet 50-hooks.sh delivers it.

## Constraints

- Owned files: `setup.d/50-hooks.sh` (the :61-70 delivery block ONLY — the `core.hooksPath` activation at :75-90 is addendum A2-8, an undecided operator fork: touch nothing there), `install.sh` (only a `check-ask-files` refresh arm IF one still exists — `grep -n check-ask-files install.sh` returned nothing at `e55e4bf2f6`; if absent, say so and do not invent one), `tests/install-sh/deliver-gate-scripts.test.sh` (the existing test that asserts the delivery — flip it to a paired negative), `packages/getff/MANIFEST.sha256`, `tests/install-sh/baselines/*/{green,brown}field.fingerprint` (npm lane only; the delivery set changes so the baselines change — recapture with `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` and keep ONLY the cells CI flags; never recapture the cargo baselines).
- `packages/core/hooks/pre-push.ts` and `scripts/check-ask-files.sh` are NOT yours. A shipped doc/template outside the installer that claims the gate exists is a PARK with the file:line, not an edit.
- Consumer file already on disk from an earlier install: `--refresh` must REPORT it as no-longer-shipped through the refresh-divergence path that already exists (`setup.d/lib.sh` `report_getff_orphans` / refresh baseline) — never delete a consumer file. Prove on a mktemp consumer what `--refresh` prints for the stale copy.
- Every setup.d/ edit ⇒ `bash scripts/build-getff-dist.sh` in the SAME commit, then `bash scripts/build-getff-dist.sh --check`. `shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh` at default severity. BSD sed/awk portability.
- Iteration cap: 6 tool-loop rounds; then report PARTIAL with what is left.

## Tools

Bash (`bash tests/install-sh/deliver-gate-scripts.test.sh`, `bash tests/install-sh/snapshot.sh`), Read, Edit, Grep, git. No Node is needed on the consumer side; the installer runs as plain bash.

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, then `Deliverable:` (branch + commits), `Evidence:` (the RED and GREEN outputs quoted), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3**, **T5**, **T14**, **T19**, **T20** (umbrella §4).

## Verify

1. RED before (pre-fix tree): a mktemp npm consumer after `install.sh ts-server` HAS `scripts/check-ask-files.sh`, and the composed consumer pre-push contains NO `ask-file-schema` section (quote the composition or the `activeSections(false)` output) — the delivered script is provably unreachable.
2. GREEN after: the same install delivers no `scripts/check-ask-files.sh`; `--refresh` on a consumer that still carries the old copy prints the divergence line (quote it) and the file is still on disk.
3. `bash tests/install-sh/deliver-gate-scripts.test.sh` passes with the flipped arm; `SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh` green after the recapture.
4. `git grep -n check-ask-files -- setup.d install.sh packages/core/templates` returns only comments explaining the removal (or nothing).

```bash host-verify
bash tests/install-sh/deliver-gate-scripts.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash scripts/build-getff-dist.sh --check
bash scripts/run-local-ci-sweep.sh
```
