# S1 replay commands

> Every command below was executed in this stage and its raw exit is in the cited log.
> Exit grammar: `0` = detection/accepted, `1` = REAL failure/RED, `3` = infrastructure
> (never counts as detection — T-TAK-A). Run from the repo root.

## Acceptance adapter (the stage-level contract)

```bash
node scripts/test-assurance/verify.mjs --stage S1 --require-host linux   # expect exit 0 with the evidence package present
node scripts/test-assurance/verify.mjs --stage S1 --require-host darwin  # on linux: exit 3 (host guard, BEFORE anything runs)
node scripts/test-assurance/verify.mjs --stage S2                        # exit 3 — no acceptance registry registered for S2 yet
node scripts/test-assurance/verify.mjs --stage S1 --require-host linux --step static-matrix
node scripts/test-assurance/verify.mjs --stage S1 --require-host linux --tamper-arm T0   # T1, T2 likewise — each must print DETECTED and exit nonzero-observed/restore-clean
```

Logs: `logs/batch-g/acceptance.log` (runs 1–2), `logs/batch-g/tamper-arms.log`.

## Frozen outer conformance driver (K3/K4 anti-detector arms)

```bash
node scripts/test-assurance/driver.mjs                 # all arms; expect DRIVER_EXIT=0
node scripts/test-assurance/driver.mjs --arm D5-PERM-GLV
node scripts/test-assurance/driver.mjs --arm NO-SUCH   # expect exit 3 (fail-closed grammar)
```

Logs: `logs/batch-f/driver-run.log`, `driver-run2.log` (byte-identical 45 OBS lines),
`determinism.log`.

## Corpus static replays (Q1/Q2 — real CLI, real delivered config)

```bash
npx eslint scripts/test-assurance/corpus/q1-vacuous/bad.literal-identity.ts    # exit 1 + no-vacuous-assertion
npx eslint scripts/test-assurance/corpus/q2-noassertion/bad.comment-only.ts    # exit 1 + require-effective-assertion
npx eslint scripts/test-assurance/corpus/q1-vacuous/good.constant-on-subject.ts # exit 0
npx eslint scripts/test-assurance/corpus/wrong-import/bad.wrong-import.ts       # exit 0 — the honest S1 admission (reject-by-review)
```

Full per-case matrix with expected outcomes: `scripts/test-assurance/expectations.json`
(frozen; sha256-pinned in the adapter) replayed by `verify.mjs --step static-matrix`.
Logs: `logs/batch-b/red-probe.log`, `verification.log`.

## Counterfactual replays (Q3 — pinned reached faults, frozen oracle)

```bash
bash scripts/test-assurance/counterfactuals/replay-cf1-a03-circular-oracle.sh
bash scripts/test-assurance/counterfactuals/replay-cf2a-age-boundary-shift.sh
bash scripts/test-assurance/counterfactuals/replay-cf2b-min-age-weaken.sh
bash scripts/test-assurance/counterfactuals/replay-cf3-guard-liveness-permissive.sh
bash scripts/test-assurance/counterfactuals/replay-cf4-guard-liveness-status-inversion.sh
```

Each exits 0 on reproduction; records in `counterfactuals/*.json`; timed second runs in
`logs/batch-d/replay2-*.log`.

## Delivery replays (Q6 + K5/K6 edges)

```bash
bash scripts/test-assurance/delivery/replay-fences-fire-deletion.sh       # import-time throw on fixture deletion
bash scripts/test-assurance/delivery/replay-template-dangling-ref.sh      # principle 25 RED names the dangling ref
bash scripts/test-assurance/delivery/replay-principle-rename-break.sh     # silent drop + 53 ratchet RED
bash scripts/test-assurance/delivery/replay-a12-emitted-corruption.sh     # characterization: WI-1 seam survives (queue owner S2)
```

All four exit 0 on demonstrated behavior; logs `logs/batch-e/edges.log`.

## Neighbor gates

```bash
cd packages/core && npx tsc --noEmit                       # exit 0
bash scripts/build-shipped-eslint-rules.sh --check         # exit 0 — twins in sync (32 checks)
npx vitest run packages/core/eslint-rules packages/core/hooks/checks \
  packages/core/principles/51-test-quality-corpus-conformance.test.ts \
  packages/core/principles/52-subprocess-status-conformance.test.ts \
  packages/core/principles/53-delivery-discovery-conformance.test.ts       # exit 0 (29 files / 773 tests at the Batch F pin)
npx markdownlint-cli2 docs/test-assurance-kernel/s1/matrix.md docs/test-assurance-kernel/s1/dispositions.md \
  docs/test-assurance-kernel/s1/honest-limits.md docs/test-assurance-kernel/s1/replay-commands.md
wc -l docs/test-assurance-kernel/s1/batches.md             # must stay < 600 (pre-commit gate)
```

## T15 self-application + T7 adversarial sweep

```bash
npx eslint packages/core/eslint-rules/*.test.ts packages/core/hooks/checks/guard-liveness.test.ts \
  packages/core/principles/51-test-quality-corpus-conformance.test.ts \
  packages/core/principles/52-subprocess-status-conformance.test.ts \
  packages/core/principles/53-delivery-discovery-conformance.test.ts   # expect exit 0 — the kernel admits its own suites
```

Logs: `logs/batch-h/self-application.log`, `logs/batch-h/adversarial-sweep.log` (the T7
counter-prompt, its probe files, and the raw per-probe detector results).

## Promotion gate (rework round 1, 2026-10-08 — re-pointed final rework 2026-10-10, `disp-rework4-bundle-carrier-gate`)

The gate5 sweep left one promotion-blocking obligation, pinned in round 1 to the delivered
`packages/core/hooks/pre-push.bundle.mjs` (0 hits for `runTestQualityLiveness`). The final
rework (2026-10-10) re-pointed it after the premise was host-measured unsatisfiable: pre-push.ts
loads `checks/guard-liveness.ts` via `await import` and the builder keeps first-party modules
external by design (scripts/build-runtime-bundles.mjs), so the symbol can never land in the
bundle — a freshly rebuilt bundle is byte-identical and still 0-hit. The gate now pins the REAL
delivery carrier — `packages/core/hooks/checks/guard-liveness.ts`, the tracked source the Q1/Q2
changed-file arm ships as — and references the runtime-bundles-drift script-selftests lane
(`NODE_ENV=development node scripts/build-runtime-bundles.mjs --check`) as the bundle-freshness
evidence (rebuild executed on the lockfile-clean host as commit 46c8d1d5f78 — a commit that
enters the PR lineage via the coordinator merge-forward; reader check
`git cat-file -t 46c8d1d5f78`; until it resolves the dispositions step enforces the carrier
obligation `disp-rework5-host-commit-merge-carrier`, and the post-merge manifest regen is the
S2 entry condition `disp-rework5-s2-entry-manifest-regen`). A queue note
saying MUST is not a mechanism, so the obligation still carries a pinned, executable gate and
the adapter refuses a stale-bundle entry without one:

```bash
node scripts/test-assurance/verify.mjs --stage S1 --promote-gate
# Current tree (carrier intact): exit 0 — gate RESOLVED (guard-liveness.ts references the arm;
#   freshness lane named) + the built-in flip control proves the check flips BOTH ways
#   (RESOLVED→BLOCKED here — every occurrence of the symbol stripped, replacement keeps none),
#   restoration hash-proven.
# Tamper the carrier (strip the symbol): exit 1 — PROMOTE-GATE ... BLOCKED naming the missing
#   arm + the ready-to-run repair.
node scripts/test-assurance/verify.mjs --stage S1 --step dispositions
# exit 0 — the stale-bundle entry names its promotion_gate; strip that field and the step
#   exits 1 "a MUST note is not a mechanism" (logs/batch-i/promote-gate-shape-refusal.log)
```

Run `--promote-gate` at/before S1 promote. Raw round-1 RED evidence (the unsatisfiable premise
itself): `logs/batch-i/promote-gate-red.log`; refusal grammar unchanged (0/1/3; combined
`--promote-gate --step`/`--tamper-arm` → exit 3 refusal).

## M15 actual-lineage successor verification (2026-10-14, corrected per review 09826c35; `disp-m15-successor-merge-carrier`)

Adapter path (one step: entries + actual lineage + receipts + LIVE freshness):

```bash
node scripts/test-assurance/verify.mjs --stage S1 --step dispositions
node scripts/test-assurance/verify.mjs --stage S1 --promote-gate
```

Hand replay of the actual lineage (every command must succeed except the 46 probe):

```bash
git cat-file -t 4fa71b5d0429720244da763de1c62cc885d99c39   # commit
git rev-parse 4fa71b5d0429720244da763de1c62cc885d99c39^{tree}  # 4229a3a350c844813388c6844f995ea6b1434a7d
git cat-file -t 1cb4a51d3e71534403a4769ee3a80577ce2505ff   # commit
git rev-parse 1cb4a51d3e71534403a4769ee3a80577ce2505ff^{tree}  # 63a480cad56fb2c254b93a78748effd817ccaec6
git cat-file -t ac17594f1f1edaad7d98b0acb2ddcd08e748518f   # commit
git rev-parse ac17594f1f1edaad7d98b0acb2ddcd08e748518f^{tree}  # a5da6f4068f948381bdae3e9aeafd680db6bb799
git rev-parse ac17594f1f1edaad7d98b0acb2ddcd08e748518f^    # = 1cb4a51d… (generation parent = source)
git diff --name-only 1cb4a51d3e71534403a4769ee3a80577ce2505ff ac17594f1f1edaad7d98b0acb2ddcd08e748518f  # packages/getff/MANIFEST.sha256 only
git cat-file -p ac17594f1f1edaad7d98b0acb2ddcd08e748518f:packages/getff/MANIFEST.sha256 | shasum -a 256  # 235967764aca27d33b1ec73c9f30c62b74f933585f4ac2d82cc16d429d4e20bc
git merge-base --is-ancestor 4fa71b5d0429720244da763de1c62cc885d99c39 1cb4a51d3e71534403a4769ee3a80577ce2505ff && echo ok
git merge-base --is-ancestor 1cb4a51d3e71534403a4769ee3a80577ce2505ff ac17594f1f1edaad7d98b0acb2ddcd08e748518f && echo ok
git merge-base --is-ancestor ac17594f1f1edaad7d98b0acb2ddcd08e748518f HEAD && echo ok
git cat-file -t 46c8d1d5f78  # MUST FAIL (exit 128) — the historical object stays missing, never synthesized
```

Hand replay of the embedded receipts (each block in `dispositions.md` §M15: take the base64
payload lines inside the ```text fence, join them, then):

```bash
# <payload> = joined base64; verify byte-exactness against the pinned hash, then inspect
printf %s "<payload>" | base64 -d | zlib-flate -uncompress | shasum -a 256
# SOURCE_GO           56f33fd15124806dce58c8ac3e60f9651187e19ef983a8b4c7b41023862cbbb5
# S1_GO               e011679d161ea7c03940f0cf9033960e7f6bd114bfc153d38ea3476a93f7e548
# OWNERSHIP_RENEWAL   23575146581203ba7a54ddda5a6237ff5d4cfd1d0cd627a0bcd7b6eeec42ea9d
# FRESHNESS_RESULTS   114ced7360848fae5c324163f5cdb257544acd5178bfe872c91963c48ecab3fe
# GENERATION_INPUT    bf29732001ebd9ddd4477ed7e5a9f199ed04667090eeb8a52053acf77be570ee
# GENERATION_AFTER    d00ccc4c168ab84eb2726792d4f948c19a06b804e68eb6ce3adb9e045cb26784
```

LIVE freshness through the stock entrypoints (the dispositions arm runs both on every
invocation; --check only, no output writes):

```bash
bash scripts/build-getff-dist.sh --check                 # 0 = sync; 1 = DRIFT (stale manifest/payload)
NODE_ENV=development node scripts/build-runtime-bundles.mjs --check  # 0 = sync; 1 = drift; 2 = missing toolchain
```

Supersession: the round-5 carrier replays above remain as history; the binding records are
the three `disp-m15-successor-*` entries in `dispositions.md` §M15 (appended after the
complete original queue bytes), and the enforced mechanism is this adapter's dispositions
step (lineage + receipts + live freshness) with no owner-stage carrier fallback.
