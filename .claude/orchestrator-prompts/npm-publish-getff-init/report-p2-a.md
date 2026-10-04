# P2-A code-truth report — getff package + installer lane (promote #4 truth gate)

> **Lane:** P2-A — `packages/getff`, `setup.d`, `install.sh`, `tests/install-sh`, `scripts/build-getff-dist.sh`
> **Head audited:** `origin/staging` = `c26593c90b` (== local HEAD at audit time; `git rev-list --left-right --count origin/staging...HEAD` → `0 0` before the lane commit)
> **Delta:** `origin/main...origin/staging` restricted to lane paths — **60 files, 18 A + 42 M, +7165 −1409**
> **Method:** kickoff-p2.md §1–§9 (population before verdicts; every verdict carries a falsifier run this session)
> **Verdict (closing):** **GO-WITH-NOTES** — one CODE-LIES finding, doc-side, in this lane's own shipped README; all product-code rows TRUE; doc-obligation notes listed for the docs pass that rewrites the consumer surface BEFORE promote #4.

## §population-enumeration

Enumeration run at the audited head (T10 — denominator before any finding):

```text
git diff --name-status origin/main...origin/staging -- packages/getff setup.d install.sh tests/install-sh scripts/build-getff-dist.sh
  → 18 A + 42 M (60 files)
git diff --numstat <same paths>  → +7165 −1409
```

| Slice | Files | A/M |
|---|---|---|
| `packages/getff/` (bin/getff, package.json, README.md, LICENSE, MANIFEST.sha256, .npmignore, .gitignore) | 7 | 7 A |
| `scripts/build-getff-dist.sh` | 1 | 1 A |
| `setup.d/` (engine.sh, lib.sh, 05-mcp.sh, 10-skills.sh, 40-configs.sh, 45-python.sh, 46-cargo.sh, 47-go.sh, 50-hooks.sh, 55-runtime-bridge-vendor.sh, 60-ci.sh, 70-deps.sh, aif-handoff-guided-install.sh, bridge-guided.sh) | 14 | 14 M |
| `install.sh` | 1 | 1 M |
| `tests/install-sh/` — 24 suites (10 A + 14 M) + 13 M fingerprints | 37 | 10 A + 27 M |

Stratification (T9 — whole window 2026-09-05 → 09-14, not the recent end): the delta spans the
failure-honesty ledger sweep (A1-*, #1632/#1643/#1645), consumer-refresh-integrity (R1/R3, issues
1481/1482/1485), the adapter-jig/eco-wiring lane dedup (S-2/S-3, #1597), ownership-by-manifest
(L-4/L-5), Windows/LF delivery (#1796/#1797/#1798), and the getff package assembly itself. Both the
old-code half (main side) and the new-code half (staging side) of the window were read; findings
below cite staging-side lines.

T-P2-B (relocation check before filing «new»): every A file hashed and matched against the full
tracked object space — exactly one twin: `packages/getff/LICENSE` is byte-identical to root
`LICENSE.md` (blob `fb4798c6b1…`), the deliberate npm-required vendored license copy. No A file is
a mislabelled relocation; `packages/getff` is genuinely new surface.

## §method-actually-run

Every command below was executed this session, in this worktree, with output quoted (T2/T3/T20).

**§9 host-verify fence (re-run at report time):**

```text
node --version   → v22.23.2
git --version    → git version 2.39.5
npx vitest --version (npm_config_cache=/tmp/npmcache-p2a2) → vitest/4.1.8 linux-x64 node-v22.23.2
```

**§5 suite gate — all 24 `tests/install-sh/*.test.sh` suites, as subprocesses, `env -u CLAUDE_CODE_ENTRYPOINT`:**

```text
24/24 suites rc=0. Per-suite PASS totals:
aif-guided-install-gating 32 · bridge-guided 15 · cargo-entry-lane 50 · cic-s3-dep-install 53 ·
copy-safe-force-dir-payload 15 · deliver-gate-scripts 23 · engine 15 · eslint-barrel-preserve-consumer 20 ·
eslint-rule-prune-by-manifest 6 · gh-531-shipped-prettier 55 · gh-934-ship-eot-hook 12 · go-entry-lane 34 ·
lane-orphan-residue 39 · layer-units 33 · merge-fenced-splice-failure 15 · python-agent-surface-refresh 14 ·
python-entry-lane 85 · python-rules-lock 42 ("42 passed, 0 failed") · refresh-baseline-survives-early-exit 9 ·
refresh-covers-full-delivery 21 · refresh-dir-payload-ownership 17 · refresh-safe-dir-payload 7 ·
refresh-vendor-single-delivery 15 · stale-tmp-unconditional-success 36
Total: 649 assertions, 0 failures.
```

Env note (prior run's lesson, applied): one suite (gh-934) went RED under the inherited
`CLAUDE_CODE_ENTRYPOINT=sdk-ts`; re-run with `env -u` → PASS=12 FAIL=0. Env contamination, not a
delta defect.

**Throwaway consumer (npm lane end-to-end), 2026-09-15:**

```text
/tmp/p2a-consumer2$ printf '{"name":"p2a-probe",…,"dependencies":{"typescript":"^5.0.0"}}' > package.json
$ node <repo>/packages/getff/bin/getff init ts-server -y   → rc=0 (log on file)
observed on disk: eslint.config.mjs, vitest.config.ts, stryker.config.json, tsconfig.json,
  AGENTS.md, scripts/, tests/, packages/, eslint-rules-local/,
  .github/workflows/ci.yml (10 159 B) + .github/workflows/workflow-integrity.yml (3 517 B)  ← both delivered
$ grep -c 'npm publish' .github/workflows/ci.yml → 0
```

**Package assembly + pack gate:**

```text
$ bash scripts/build-getff-dist.sh --check → green, 1083 files (MANIFEST bijection, no drift)
$ bash scripts/build-getff-dist.sh         → assembles packages/getff payload (run in a scratch
  checkout state; assembled payload is gitignored — working tree stayed clean, §6 honoured)
$ node packages/getff/bin/getff --version → 0.1.0 ; unknown arg → usage, exit 2
```

**MANIFEST.sha256 bijection (falsifier for the pack-surface claim):**

```text
cut -d' ' -f3- packages/getff/MANIFEST.sha256 | sort          vs
git ls-files -z -- bin setup setup.d agents skills templates .claude .prettierrc.json packages scripts MANIFEST.sha256 install.sh | tr '\0' '\n' | sort
comm -3 → 0 manifest-not-tracked, 0 tracked-not-in-manifest   (1083 rows)
```

**Guard pairing (kickoff §3 step 5 — removing the guard turns the negative RED; neuter in throwaway form only):**

```text
neutered setup.d/05-mcp.sh's jq-failure guard back to the unconditional-success shape →
  bash tests/install-sh/stale-tmp-unconditional-success.test.sh → rc=1, PASS=35 FAIL=1,
  "✗ C: '> \"…tmp\" && mv' outside an if/while condition still present"
git restore setup.d/05-mcp.sh → re-run rc=0, PASS=36 FAIL=0.
```

**Test-name truth sampling (T1: floor 5, depth ≥20):** 21 arm names read against their assertion
bodies across 13 suites (copy-safe-force-dir-payload, eslint-rule-prune-by-manifest,
refresh-baseline-survives-early-exit, refresh-dir-payload-ownership, refresh-vendor-single-delivery,
merge-fenced-splice-failure, stale-tmp-unconditional-success, aif-guided-install-gating,
go-entry-lane, cargo-entry-lane, python-entry-lane, lane-orphan-residue, cic-s3-dep-install) —
every sampled name asserts what it says; several carry explicit vacuity preconditions
(«arm 1 precondition: … else arm 1 is vacuous»).

**Fingerprint cross-check (snapshot rot vs real delivery change):** all 13 changed fingerprints
diffed main→staging — 844 hash-row changes, net adds/removes correlate exactly with delivery
changes in the window: `scripts/check-ask-files.sh` removed from 7 npm baselines (ledger C-2),
`.claude/hooks/lib/residue-dir.sh` added (D29), python baselines swap
`ARCHITECTURE.ts-server.md` → `ARCHITECTURE.python.md`, plus hash-only updates on hook/agent
sources changed in the same window (end-of-turn-reminder #1797, deps-hash-check, rule-researcher,
skill-context). The fingerprint-asserting suites were green in the §5 run, so fingerprints ==
delivered bytes today — no rot.

**Registry probe:** `npm view getff dist-tags --json` → `{"latest":"0.0.1"}` — the publish is a
`0.0.1 → 0.1.0` bump moving `latest` (existing-user surface confirmed).

**Egress probes (kickoff §9 expectation):**

```text
git push --dry-run origin <lane branch> → remote: Invalid username or token … fatal: Authentication failed
gh auth status → "You are not logged into any GitHub hosts."
→ per the rework instruction: commit locally, hand exact commands to the coordinator.
```

## §findings

Verdict grammar per kickoff §1. Doc-sentence lines are quoted verbatim; product-code rows carry
their falsifier.

### F1 — CODE-LIES: the shipped README denies the CI workflows the installer delivers

- **Claim:** `packages/getff/README.md:25` — «CI stays yours — getff ships no workflow for the npm lane.»
- **Code:** `setup.d/40-configs.sh:448` — `deliver_getff_workflow "$PKG_ROOT/templates/ts-server/github-actions-ci.yml" "$PROJECT_ROOT/.github/workflows/ci.yml"` and `:454` — `…github-actions-workflow-integrity.yml" "$PROJECT_ROOT/.github/workflows/workflow-integrity.yml"` — both in the **ts-server (npm stack) flat-repo arm**; the react-next arm repeats the pair at `:467/:469`, react-spa at `:483/:485`.
- **Observed behaviour:** the throwaway consumer run (`getff init ts-server -y`) delivered both files (§method: `ci.yml` 10 159 B + `workflow-integrity.yml` 3 517 B on disk).
- **Falsifier:** `ls /tmp/p2a-consumer2/.github/workflows/` → `ci.yml  workflow-integrity.yml`; `head -8 ci.yml` → `name: CI / on: push/pull_request branches: [main]`.
- **Honest nuance:** `grep -c 'npm publish' ci.yml` → `0` — the delivered workflows run lint/typecheck/tests and never publish. The narrow claim «no publish workflow» would be TRUE; the sentence as written («no workflow for the npm lane») is FALSE.
- **Doc-sentence obligation:** the README sentence must be repaired in the docs pass BEFORE promote #4 — e.g. «getff ships CI workflows (`.github/workflows/ci.yml` + `workflow-integrity.yml`, your default branch substituted at install time) that run lint/typecheck/tests — they never publish; publishing stays yours.»

### F2 — TRUE with an anti-claim: MANIFEST.sha256 is a pack-time gate only; docs must not claim post-install tamper-evidence

- `packages/getff/MANIFEST.sha256` + `scripts/build-getff-dist.sh:104-119`: bijection with tracked payload verified (§method: 0/0 `comm` over 1083 rows); `--check` drift gate green.
- **Pairing check:** no consumer-side reader exists — nothing in `bin/getff`, `install.sh`, or `setup.d/` hashes installed files against the manifest post-install (grep over the lane: the only `MANIFEST` consumers are the pack script and CI). The ledger/companions `manifest` hits are a different file.
- **Doc-sentence obligation:** describe MANIFEST.sha256 as what it is — «a pack-time/CI drift gate over the assembled payload» — never as tamper-evidence for installed files. If tamper-evidence is wanted, a runtime `getff verify` must be built deliberately (out of this delta).

### F3 — TRUE: bin entry, package metadata, and pack surface match the decided inputs

- `packages/getff/package.json`: name `getff`, version `0.1.0`, `private: false`, `bin: {getff: ./bin/getff}`, `engines.node >=22`, `files:` covers every payload root, `prepack` = `build-getff-dist.sh --check && build-getff-dist.sh` (drift-gated), FSL-1.1-ALv2 — matches kickoff §2 freeze §1/§3.
- `packages/getff/bin/getff:105` — `spawnSync(bash, [setup, ...args], …)`: argv-array, no shell-string interpolation; `:63-74` `findBash()` honours `GETFF_BASH` → Program Files Git → `where git` sibling; `--version` reads the real package.json; unknown subcommand → usage + exit 2 (all exercised in §method).
- Falsifiers: the `--version`/unknown-arg runs and the `--check`/manifest outputs above; registry probe pins the bump semantics.

### F4 — TRUE: the failure-honesty class (ledger A1-*) is real in code and pinned by paired tests

- `setup.d/engine.sh:41-67` — `companion_step` now ends `return 0` unconditionally; the trailing `[ "$kind" = "mcp" ] && printf` arm (which made every non-mcp companion return 1 and killed `setup -y` on fresh machines, PR #1613) is gone; `[ … ] && printf` shapes replaced by if-blocks. Falsifier: `engine.test.sh` PASS=15.
- `setup.d/lib.sh:580ff` `merge_fenced` — `-r` source probe refuses to splice on unreadable source; `if ! awk … || ! mv …` guards the rewrite with tmp cleanup (A1-8). Falsifier: `merge-fenced-splice-failure.test.sh` PASS=15.
- `setup.d/lib.sh:2189-2241` `register_cc_hook` — both jq arms write `"$settings.tmp"` then mv, ✓ only after mv, `rm -f` + ⚠ on failure (A1-9/A1-9b); no zero-byte `settings.json` path remains. Falsifier: `layer-units.test.sh` PASS=33 (register_cc_hook arms).
- `setup.d/lib.sh:474-521` `copy_safe` — `if cp -r …; then ✓ + stage; else ⚠ + rm -rf partial + return 0` (A1-9d), and the A2-1 `[ -d "$src" ] && rm -rf "$dst"` replace-before-copy that ended the `--force` directory-nesting defect (duplicate ast-grep rule ids, exit 8). Falsifier: `copy-safe-force-dir-payload.test.sh` PASS=15, whose arm 2 reproduces the OLD body verbatim and proves it NESTS (paired negative).
- `setup.d/05-mcp.sh:38-42` — jq rewrite in if/else with `rm -f` cleanup + honest ⚠ (A1-9c class). Falsifier: the live paired-neuter in §method (neuter → RED PASS=35 FAIL=1; restore → green).
- `install.sh:84` — `trap 'refresh_baseline_flush' EXIT` guarantees the R1 manifest on every exit path including 99-finalize's sourced `exit 1` (A1-2). Falsifier: `refresh-baseline-survives-early-exit.test.sh` PASS=9 with explicit vacuity preconditions (deps-incomplete `--full` must exit non-zero and print the degraded banner before the manifest assertion counts).

### F5 — TRUE: ownership machinery (L-4/L-5) and lane dedup (S-2/S-3) behave as documented

- `setup.d/lib.sh:867` `_refresh_dir_payload` — directory payloads now walk per-file through the same override→divergence→preserve→stage decision; sweep removes only baseline-attributed pristine files; everything else kept and NAMED (`_report_dir_residue`, ORPHAN vocabulary). Falsifier: `refresh-dir-payload-ownership.test.sh` PASS=17 (consumer-authored file survives `--refresh`; issue-1481 class named in the assertion).
- `setup.d/lib.sh:222` `refresh_tree_with_transform` + removal of install.sh's second policy-free vendor arm (A1-1): the override'd tree gets «⊝ keeping» and nothing else. Falsifier: `refresh-vendor-single-delivery.test.sh` PASS=15.
- `setup.d/lib.sh:1824` `_rule_basename_consumer_owned` + `:1906ff` barrel prune — deletion now requires pristine-framework-delivery provenance from the refresh-baseline manifest; adapted consumer triples survive. Falsifier: `eslint-rule-prune-by-manifest.test.sh` PASS=6.
- `install.sh:281` LANE_TABLE + `:449` `_lane_detect` — table-driven precedence (python → cargo → go), declined-offer unmasking (rc=2, `_LANE_DECLINED` accumulates), EOF-safe read, for-walk (not heredoc-fed while) so offers read the consumer's stdin. Falsifier: `go-entry-lane.test.sh` PASS=34 incl. arms 11e/11f (one and two-decline unmasking).
- `setup.d/lib.sh:1032` `getff_lane_installed` / `:1285` `report_getff_orphans` — lane-union expected-set ends polyglot false orphans; per-find `|| true` ends the set -e abort on absent `.getff/`. Falsifier: `lane-orphan-residue.test.sh` PASS=39.
- `setup.d/lib.sh:1170` `_lane_write_toolchain_lock` — single lock writer for cargo/go; fingerprint covers delivered config + generation-context manifest + fragments (A2-9); `_hash256` (`setup.d/lib.sh:293`) is sha256-only (sha256sum → shasum → fail), so `sha256:<digest>` can never mislabel an md5 — the pre-S-2 per-lane md5 rungs were deliberately absorbed into the R-3 single ladder, degrading LOUDLY to the non-authoritative `sha256:unknown` constant. **Changed default, honest and documented in-code** — a host with only md5 tools now records `sha256:unknown` + stderr warning instead of `md5:…`.
- Falsifier for the lock rows: `go-entry-lane.test.sh` arm 2 («second run produced the identical sourceFingerprint») + `python-rules-lock.test.sh` 42/42.

### F6 — TRUE: 50-hooks C-2 removal and refresh-parity surfaces

- `setup.d/50-hooks.sh:60` — `scripts/check-ask-files.sh` no longer delivered; `install.sh` do_refresh now reports a stale copy as `⚠ ORPHAN` and never refreshes/deletes it. Premise verified in source: the pre-push ask-file-schema section registers `owner: 'maintainer'` (`packages/core/hooks/pre-push.ts:2159-2161` — `id: 'ask-file-schema', owner: 'maintainer'`) and a maintainer-only section is «NEVER composed on a consumer layout» (`packages/core/hooks/pre-push.ts:749-751`; `composeSections` at `:2171`) — the gate never ran on consumers. Falsifier: consumer baselines dropped `scripts/check-ask-files.sh` in exactly the 7 npm-stack fingerprints (§method cross-check).
- Runtime-bridge vendor refresh parity moved to the shared verb (`refresh_tree_with_transform`) — install.sh's duplicate arm deleted (A1-1, F5); `aif-handoff-guided-install.sh` gains child-side gating: `GETFF_DRY_RUN`/`GETFF_NONINTERACTIVE` exported by install.sh (never-prompt contract), dry-run previews instead of cloning, clone/compose failures route through `_aif_handoff_record_failure` + degrade (A1-3/A1-4), and `bridge-guided` gains the reachable `docker-down` state (A1-7). Falsifier: `aif-guided-install-gating.test.sh` PASS=32 + `bridge-guided.test.sh` PASS=15.

### F7 — Doc-obligation notes (security-audit carried into the truth gate; verified with own citations)

- **`setup.d/engine.sh:39` and `:65`** — `eval "$detect_cmd"` / `eval "$install_cmd"` execute `setup.d/companions.manifest` rows verbatim on consumer machines. Safe today (tracked, maintainer-authored data shipped in the tarball; no consumer input reaches the manifest; detect-first + consent-gated per companion-install-principle.md). **Doc sentence needed:** companion install commands are executed verbatim from the shipped manifest, so the trust model is explicit.
- **Unpinned companions** — `setup.d/05-mcp.sh:38` writes `@upstash/context7-mcp@latest` into `.mcp.json`; `setup.d/companions.manifest` rows install `@ast-grep/cli` / `claude plugin install` unpinned. This is the documented no-pin policy; the delta added no new unpinned surface (the context7 row predates it — the delta only wrapped the write in failure cleanup). **Doc sentence needed:** companions update through their own registries, not through getff.
- **Fixed-name tmp siblings** — `setup.d/lib.sh:2214/:2233` (`$settings.tmp`), `setup.d/05-mcp.sh:39` (`$_05mcp_json.tmp`), `setup.d/10-skills.sh:285` (`$SETTINGS.recapgate.tmp`) rather than same-directory `mktemp`. Theoretical symlink-clobber race in a multi-writer project dir; low risk under the single-writer install threat model; non-blocking hardening note. (All three sit behind the new A1-8/A1-9 conditional guards, so a failed rewrite is no longer silent — the race window is the only residue.)

### F8 — Product-code defects found: none

Zero BROKEN verdicts. No reproduction exists for any product-code misbehaviour in this delta; the
one CODE-LIES is a doc sentence (F1). The §4 pre-decided items (context7-refresh RED, GIT_DIR
class, recap v2 partial-by-design) were not re-investigated.

## §coverage

- **Files:** 23/60 delta files deep-audited by full diff read + targeted whole-file reads
  (all 14 `setup.d/` M files, `install.sh`, `build-getff-dist.sh`, all 7 `packages/getff` files).
- **Execution:** 24/24 suites executed green (649 asserts) — all 24 are delta files (10 A + 14 M),
  i.e. every changed suite was run, not a sample; 1/1 consumer lane run end-to-end
  (`init ts-server -y`, rc=0, artifacts inspected); pack gate `--check` + assemble run; bin smoke
  run (`--version`, unknown-arg rc=2).
- **Tests:** name-truth sampled 21 arms / 13 suites (T1 floor 5 / depth ≥20 met); paired-neuter
  executed for 1 structural guard (05-mcp arm C); 844 fingerprint rows cross-correlated with real
  delivery changes.
- **Not deep-read (honest residue):** 24 of the 37 test files' bodies beyond their sampled arms —
  their subject matter is however covered by full execution (all green, zero skips reported) and
  by the paired-neuter probe.
  `.gitattributes` (repo root, out of lane, same delta) was read as cross-lane corroboration for
  the LF story: the README carries no LF claim; `INSTALL.md` (out of lane) carries the
  `core.autocrlf` text and matches `.gitattributes` (`* text=auto eol=lf`).
- **Calibration (T6/T14):** coverage fraction ≈ 23/60 deep-read + 60/60 execution-covered via
  suites; first run of this methodology on this lane — expect residual false-negatives despite
  0 product-code findings; the claim is «execution + sampling found nothing», not «proven clean».

## §self-application (T15)

- **Finding on this audit:** my first MANIFEST bijection probe was wrong — `git ls-files
  --error-unmatch --quiet` exits 129 (unknown option), which I initially read as «every manifest
  path untracked». The negative result was the probe's, not the artefact's. Re-derived with a
  single-file check + a set-level `comm` (0/0). Lesson applied: a probe's own failure mode must be
  characterised before its negative output is believed (T3 in probe form).
- **T-P2-A applied to this report:** a diff read that finds nothing is exactly the shape T-P2-A
  warns about — countered by running the observation layer anyway (649 asserts, consumer run,
  pack gate, paired-neuter, fingerprint correlation). The one finding that survived is a doc/code
  contradiction a careful diff-read of README alone would have passed (the README sentence *reads*
  plausible; only running the installer falsified it).
- **Env-noise discipline:** the §5 gate's only RED of the session (gh-934 under inherited
  `CLAUDE_CODE_ENTRYPOINT`) was proven env-borne by `env -u` re-run before being dismissed —
  the delta was not blamed for an environment artefact.

## §inconclusive

- **None.** Every row above carries a command + output or a `path:NN` + quoted line. The two
  things this container cannot run (a Windows host, toolchain-present go/rust firing self-checks)
  are covered by the suites' own precondition-guarded degradation + the CI consumer-matrix cell
  that #1796 landed (cross-lane, cited not re-run) — recorded here as citation-level, not
  re-executed, evidence.

## Verdict

**GO-WITH-NOTES.**

- The getff package payload, installer core, ownership machinery, honesty fixes, and lane dedup
  are TRUE at code-truth level under the §5 gate + end-to-end consumer run. No product-code defect.
- **Note 1 (blocking for the docs pass, not for this branch):** F1 — `packages/getff/README.md:25`
  must be repaired before promote #4 (the sentence is contradicted by `setup.d/40-configs.sh:448,
  :454/:469/:485` and by the observed consumer run). F2's anti-claim (no post-install
  tamper-evidence) and F7's three doc sentences (eval trust model; companions update via their own
  registries; MANIFEST is a pack-time gate) bind the same rewrite.
- **Note 2:** publish mechanics remain maintainer-owned: this is a `latest`-moving `0.0.1 → 0.1.0`
  bump on an existing-user surface; `npm publish` is out of this lane's scope by kickoff §7.
- **Egress:** push/`gh` are auth-blocked in this container (probes quoted in §method); the lane
  commit is local on
  `feature/npm-publish-getff-init-p2-a-getff-packag-452263` — the coordinator should run:
  `git push -u origin feature/npm-publish-getff-init-p2-a-getff-packag-452263` then
  `gh pr create --base staging --head feature/npm-publish-getff-init-p2-a-getff-packag-452263`
  with the `## Fidelity verdict` / `### §1.7 Forward-check applied` / `### §1.7 Backward-check applied`
  sections per the plan's task 8.
