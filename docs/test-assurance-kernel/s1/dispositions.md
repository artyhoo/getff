# S1 blocking dispositions queue

> **Status:** ACTIVE — blocking consumer for every unresolved S1 obligation.
> **Consumer:** `node scripts/test-assurance/verify.mjs --stage S1` → step `dispositions`
> (parses the fenced-JSON blocks below; missing file, empty selection, unparseable entry,
> dangling disposition, or a coverage gap = RED / exit 1). A warning nobody consumes is
> insufficient — this queue IS the consumer (spec §4).
> **Schema (frozen, Batch G):** each entry is one fenced ```json block with `id`, `source`,
> `classification`, `disposition` ∈ `resolved` | `owner-stage`; `resolved` ⇒ ≥1
> `resolution_evidence` path that exists on disk; `owner-stage` ⇒ `owner_stage` ∈ S2|S3|S4.
> **Denominator (mechanical, never hand-counted):** every `s1/counterfactuals/*.json` record
> whose `classification` ∉ {killed, equivalent}, plus every oracle case in
> `scripts/test-assurance/expectations.json` whose `expectation` is `reject-by-review`.
> Currently = `cf3-guard-liveness-permissive` (survived) + `wrong-import/bad.wrong-import`
> (reject-by-review) — both MUST be named as `source` by some entry below or the adapter REDs.

## Entries

Discharge record for the cf3 counterfactual (`classification: survived` — the honest value
from the §6 record, not an upgrade). Discharged at the GATE level, not the suite level:
frozen driver arm `D5-PERM-GLV` applies the byte-identical fault to
`packages/core/hooks/checks/guard-liveness.ts` (patch label «cf3: guard-liveness
matchesViolation permissive», sha256 `6da3c1c1…`, exactly-once, hash-proven restore) and the
frozen parse-error probe observes the required flip `PROBE status=fail` → `PROBE status=pass`.
The suite-level residual (GLV-1's clean zero-message input never reaches the
`matchesViolation` fallthrough) is retained as an honest limit — see
`honest-limits.md` §GLV-suite-fallthrough.

```json
{
  "id": "disp-cf3-guard-liveness-permissive",
  "source": "cf3-guard-liveness-permissive",
  "classification": "survived",
  "disposition": "resolved",
  "resolution_evidence": [
    "docs/test-assurance-kernel/s1/counterfactuals/cf3-guard-liveness-permissive.json",
    "docs/test-assurance-kernel/s1/logs/batch-f/driver-run.log",
    "docs/test-assurance-kernel/s1/logs/batch-f/driver-run2.log"
  ]
}
```

Wrong-import has NO executable S1 detector: no installed ESLint/Vitest rule decides import
correctness against the governed subject, and inventing an AST-dataflow rule is exactly what
spec §5 forbids (no unsupported dataflow claim). The oracle pins the honest expectation
`reject-by-review`; the review channel is the named cold-review protocol
(`.agents/roles/review-sidecar.md`, whose §1 dimension set includes import-substance review).
Blocking until S2 delivers an executable metacheck for the class (candidate design space:
registered-import reconciliation against the subject's real export surface — NOT claimed here).

```json
{
  "id": "disp-wrong-import-review-routed",
  "source": "wrong-import/bad.wrong-import",
  "classification": "candidate-needs-review",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "note": "executable wrong-import metacheck is an S2 obligation; S1 honestly admits this case in the static matrix and routes rejection to the review channel"
}
```

A12-class emitted-output corruption, characterized in Batch E through the REAL
`packages/core/composition/fence.ts`: a corrupted `hash=` marker attribute parses, is
exposed by `fence.ts` as parsed data, and cannot fail any check (the WI-1 seam). The replay
`scripts/test-assurance/delivery/replay-a12-emitted-corruption.sh` proves body drift IS
caught while the hash seam is NOT — recorded as survived, queued, and deliberately not
repaired in S1 (out of the stage's repair scope; S2 owns the emitted-output class).

```json
{
  "id": "disp-a12-emitted-corruption",
  "source": "replay-a12-emitted-corruption",
  "classification": "survived",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "note": "WI-1 seam: emitted-output integrity needs a consumer of the parsed hash attribute (S2); S1 demonstrates the gap and refuses to claim delivery integrity for it"
}
```

Batch I cold-review finding C4 (GAP-FOUND, MINOR, reviewer dimension 7): the preset consumer
rule catalogs (`RULES.md` × 3 presets) carry no row for the new test-quality contract/kernel
rules; out of S1 write scope, but unlike the SSOT append (recorded in `prior-art.md` §58-60)
this out-of-scope observation was recorded nowhere in the s1 evidence — an unrecorded parallel
surface. Recorded here per the queue discipline below (a review finding that is only a log line
is the failure mode spec §4 forbids).

```json
{
  "id": "disp-c4-preset-rules-md-catalogs",
  "source": "cold-review-batch-i/C4-preset-rules-md-catalogs",
  "classification": "gap-found-minor",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "note": "preset RULES.md consumer catalogs (packages/preset-*/RULES.md) need rows for no-vacuous-assertion + require-effective-assertion; catalog files are outside the S1 write scope, so S1 records the parallel surface here instead of editing them"
}
```

Batch I cold-review finding C5 (GAP-FOUND, MINOR, reviewer dimension 7): the two new rules are
unregistered in `packages/core/manifest/rules-manifest.json`, so guard-liveness's
manifest-driven/fullsweep population does not see them; the changed-file arm compensates at
pre-push and principle 05 enforces only the manifest→RULES.md direction, so no gate is
violated — but the exclusion is undeclared. Registration is outside the S1 write scope
(flagged as a coordinator observation at planning, `.ai-factory/plans/feature-test-assurance-kernel-bd2bc9.md` Task 2 note).

```json
{
  "id": "disp-c5-rules-manifest-registration",
  "source": "cold-review-batch-i/C5-rules-manifest-registration",
  "classification": "gap-found-minor",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "note": "register no-vacuous-assertion + require-effective-assertion in packages/core/manifest/rules-manifest.json so the manifest-driven/fullsweep guard-liveness population sees them; manifest is outside the S1 write scope — until then the exclusion is declared here, and the changed-file arm covers both rules at pre-push"
}
```

Batch I gate5 (clean-tree sweep at `899d33df6`, every RED triaged in
`logs/batch-i/gate5-triage.md`) left a family of STAGE-CAUSED drifts whose repair target is a
DERIVED artifact outside the S1 write fence (`docs/site/**`, `packages/getff/MANIFEST.sha256`,
`tests/install-sh` snapshot baselines, pre-existing citation-bearing sources, the prebuilt
runtime bundle). Per the C4/C5 + rules-manifest planning precedent these are queued, not
edited; each carries its ready-to-run repair command. They are mechanical regens forced by
in-fence source changes — routing them to S2 (or the coordinator at S1 merge) in one batch:

```json
{
  "id": "disp-gate5-derived-artifact-regens",
  "source": "gate5-sweep/derived-artifact-drift",
  "classification": "derived-artifact-drift",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "note": "4 regens on a lockfile-clean tree: node scripts/render-face-facts.mjs --write (principles 57->60, the stage's 51/52/53); npx tsx scripts/render-reference.mjs --write (C.json/F1.json pick up the test-quality-contracts rule); bash scripts/build-getff-dist.sh (MANIFEST.sha256 delta = the stage's own files); SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh (6 new fences-fire fixtures). Full per-gate evidence: logs/batch-i/gate5-triage.md #4-#7"
}
```

```json
{
  "id": "disp-gate5-stale-citations",
  "source": "gate5-sweep/stale-line-citations",
  "classification": "stale-citation",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "note": "3 stale path:line citations in PRE-EXISTING out-of-fence files, each transitively caused by the stage: scripts/render-face-facts.mjs:283,284 -> AGENTS.md:79,99 (Batch H's +1 generated rule-index row shifted the target lines; content now at 80,100) and packages/core/install/wire-synth-rules.test.ts:338 -> eslint.config.mjs:50 (the stage's new 49-line root config made a previously-unresolvable bare citation resolvable). Fix = re-pin/qualify or cite:historical in those files; not editable inside the S1 fence. Evidence: logs/batch-i/gate5-triage.md #8"
}
```

```json
{
  "id": "disp-gate5-runtime-bundle-rebuild",
  "source": "gate5-sweep/stale-pre-push-bundle",
  "classification": "stale-bundle",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "promotion_gate": "node scripts/test-assurance/verify.mjs --stage S1 --promote-gate (fail-closed exit 1 while the delivered bundle lacks the arm; built-in both-ways flip control; runs at/before S1 promote)",
  "note": "packages/core/hooks/pre-push.bundle.mjs (last touched 9f22c9e6a, pre-stage) contains 0 hits for the stage's runTestQualityLiveness/TEST_QUALITY_RULES although pre-push.ts imports guard-liveness.ts — consumers do not receive the Q1/Q2 changed-file arm until the bundle is rebuilt. MUST be rebuilt on a lockfile-clean install — ENFORCED at/before S1 promote by promotion_gate (rework round 1, 2026-10-08: verify.mjs stepDispositions refuses a stale-bundle entry that does not name its gate; the gate exits 1 RED on the current tree with the repair command, and its flip control proves the check is load-bearing both ways). This container's node_modules carries fast-uri 3.1.7 vs lockfile 3.1.8, so a rebuild here would inline the wrong copy (runtime-bundles-drift's own phantom warning). Until the rebuild lands, delivery to consumers runs through the changed-file arm on the .ts source. Evidence: logs/batch-i/gate5-triage.md #9 + logs/batch-i/promote-gate-red.log"
}
```

Rework round 2 (2026-10-09, host-contract coordinator replay) ran the first `--keep-going`
enumeration of the full 55-gate sweep (round 1's battery was cut before the vitest/selftest
lanes — `logs/batch-i/gate5-triage.md` covers "up to the cut" only). It surfaced one
previously-untriaged STAGE-caused RED — the T-C3 mirror below — FIXED in this round, and the
same enumeration re-proved the round-1 queue complete: pre-fix, every other RED in the
enumeration was round-1-known (queued above) or pre-existing/environmental, with failing-test
name sets byte-identical at HEAD and at pre-rework-2 `bf498cab6`. The post-fix residual set
(the bundle rebuild + stale citations queued above, plus the pre-existing/environmental rows)
is attributed per-RED in `logs/batch-i/rework2-sweep-triage.md`.

```json
{
  "id": "disp-t-c3-oxlint-mirror",
  "source": "rework2-sweep/t-c3-oxlint-mirror-drift",
  "classification": "stale-mirror",
  "disposition": "resolved",
  "resolution_evidence": [
    "packages/core/audit-self/prove-rules.mjs",
    "docs/test-assurance-kernel/s1/logs/batch-i/rework2-parity-green.log"
  ],
  "note": "STACK_RULES mirror (T-C3) lacked the two rules Batch B placed in the ts-server/react-next/react-spa template eslint blocks (no-vacuous-assertion, require-effective-assertion — the K5 delivery edge): 4 REDs (each stack expects [] got 2 'neither placed nor named not-placed'; the paired negative expects [1 problem] got 3). FIXED in rework round 2 rather than queued: the mirror file is inside the S1 write fence (kickoff constraints list packages/core/audit-self/**), so the working-tree draft's out-of-fence rationale was wrong; that draft was never committed and this resolved entry is its replacement (append-only discipline intact). Mirror entries carry the templates' exact file globs (ts-server includes tests/**/*.{ts,tsx}); parity 7/7, prove-rules.test.ts 47/47, prettier --check green. Evidence: logs/batch-i/rework2-parity-green.log"
}
```

The round-2 sweep contract also folded 3 of the 4 regens queued above. Superseding entry per
the queue discipline (the last entry naming a `source` is the binding one):

```json
{
  "id": "disp-rework2-derived-regen-fold",
  "source": "gate5-sweep/derived-artifact-drift",
  "classification": "derived-artifact-drift",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "promotion_gate": "node scripts/test-assurance/verify.mjs --stage S1 --promote-gate (fail-closed exit 1 while the delivered bundle lacks the arm; built-in both-ways flip control; runs at/before S1 promote)",
  "note": "Supersedes disp-gate5-derived-artifact-regens (same source; append-only). Rework round 2 folded 3 of the 4 queued regens under the coordinator's round-2 contract + BLOCKER-2 scope ruling: queueing them would egress red face-facts-check / reference-check / byte-identical arms, which the host contract requires green, and each is a declared mechanism's deterministic output verified green in this container. (1) node scripts/render-face-facts.mjs --write — principles 57->60 + F1 members 30->31 (2-line delta; --check byte-identical; ORDER matters: the derivation reads docs/site/reference/F1.json, so reference regen runs first); (2) npx tsx scripts/render-reference.mjs --write — C.json +1 adjacency, F1.json +1 test-quality-contracts rule row, exactly round-1 triage #5's delta (--check green); (3) SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh — 8 npm-stack baselines re-captured (the two rules' twins + derived install outputs; byte-identical gate green). RESIDUAL (S2, unchanged class): bash scripts/build-getff-dist.sh still MUST run on a lockfile-clean install (fast-uri 3.1.7 vs 3.1.8 — a rebuild here inlines the wrong copy, round-1 triage #9), and its delta now also covers the round-2 prove-rules.mjs mirror edit; the promotion_gate above stays enforced. Evidence: logs/batch-i/rework2-regens.log + logs/batch-i/rework2-sweep-triage.md"
}
```

Rework round 3 (2026-10-09, auto-review blocking finding `77f8a05f000d`): the round-2 fold's
byte-identical arm was immediately re-drifted by the round-2 follow-through commit `bfe90e4dd` —
its formatting-only reformat of `packages/core/audit-self/prove-rules.mjs` (the T-C3 mirror fixed
in `disp-t-c3-oxlint-mirror`) changes the bytes install.sh delivers as `scripts/prove-rules.mjs`,
and the fingerprints re-captured at `03f225520` predate it, so all 8 npm-stack cells went stale by
construction. The same repair channel round 2 used folded this slice in-container; the family
residual narrows to the `build-getff-dist` rebuild below.

```json
{
  "id": "disp-rework3-proverules-snapshot-regen",
  "source": "gate5-sweep/derived-artifact-drift",
  "classification": "derived-artifact-drift",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "promotion_gate": "node scripts/test-assurance/verify.mjs --stage S1 --promote-gate (fail-closed exit 1 while the delivered bundle lacks the arm; built-in both-ways flip control; runs at/before S1 promote)",
  "note": "Supersedes disp-rework2-derived-regen-fold (same source; append-only). Byte-identical slice RESOLVED in rework round 3 (auto-review blocking finding 77f8a05f000d): commit bfe90e4dd (formatting-only reformat of packages/core/audit-self/prove-rules.mjs, the disp-t-c3-oxlint-mirror fix) postdates the round-2 fingerprint regen 03f225520, so all 8 npm-stack cells (4 stacks × greenfield/brownfield) pinned stale bytes — SNAPSHOT_MODE=compare at HEAD: 7 pass / 8 fail, exit 1, every failing cell pinning scripts/prove-rules.mjs b29827f2235f… vs fresh ea47e72adc5c… (byte-equal to the reformatted source) + the coupled .ai-factory/refresh-baseline.json line; python/cargo/go byte-identical. Repair = the round-2 channel: SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh → git delta EXACTLY 8 fingerprint files × 2 lines (scripts/prove-rules.mjs + refresh-baseline.json; python/cargo/go baselines untouched), post-repair compare ×2 = 15/15 byte-identical, exit 0 both, run logs byte-identical. Family residual narrows to the build-getff-dist rebuild (lockfile-clean constraint unchanged); promotion_gate stays enforced for the stale-bundle residual (disp-gate5-runtime-bundle-rebuild). Evidence: logs/batch-i/rework3-snapshot-{compare-red,capture,compare-green-1,compare-green-2}.log"
}
```

Final rework (2026-10-10, coordinator request_changes round 2 of cap 2) — three folds: the
unsatisfiable round-1 promote-gate premise, the coordinator-side host regen receipt, and the
citation re-pins. Superseding entries per the queue discipline:

```json
{
  "id": "disp-rework4-bundle-carrier-gate",
  "source": "gate5-sweep/stale-pre-push-bundle",
  "classification": "stale-bundle",
  "disposition": "resolved",
  "resolution_evidence": [
    "scripts/test-assurance/verify.mjs",
    "docs/test-assurance-kernel/s1/pr-body-disclosures.md",
    "docs/test-assurance-kernel/s1/logs/batch-i/rework4-promote-gate-green.log"
  ],
  "promotion_gate": "node scripts/test-assurance/verify.mjs --stage S1 --promote-gate (PASS exit 0 on the re-pointed gate; built-in both-ways flip control; runs at/before S1 promote)",
  "note": "Supersedes disp-gate5-runtime-bundle-rebuild (same source; append-only). The round-1 premise was UNSATISFIABLE BY CONSTRUCTION (coordinator host-measured, 2026-10-10): pre-push.ts loads checks/guard-liveness.ts via `await import` and the builder holds first-party modules external on purpose (scripts/build-runtime-bundles.mjs:23), so runTestQualityLiveness can never land in pre-push.bundle.mjs — a fresh lockfile-clean rebuild is byte-identical and still 0-hit. The rebuild itself was executed on the lockfile-clean host as coordinator commit 46c8d1d5f78 (fast-uri 3.1.8 verified; NOT rebuilt in this container, where fast-uri 3.1.7 would inline the wrong copy). The ENFORCED PAIR is now: (1) the promotion gate re-pointed at the REAL delivery carrier — packages/core/hooks/checks/guard-liveness.ts must contain runTestQualityLiveness (the Q1/Q2 changed-file arm ships as this tracked source) — with the both-ways flip control carried over (strip EVERY occurrence → BLOCKED; restore → RESOLVED; two latent round-1 defects were exercised here for the first time because the round-1 gate sat BLOCKED pre-rebuild: a first-occurrence-only strip cannot flip a two-hit carrier — definition + call site — and the PREFIX_${symbol} strip replacement contained the needle itself); (2) bundle freshness via the runtime-bundles-drift script-selftests lane (NODE_ENV=development node scripts/build-runtime-bundles.mjs --check), referenced as the gate's freshness evidence instead of a symbol-in-bundle probe. Gate id in verify.mjs renamed to this entry's id; replay-commands.md §Promotion gate + honest-limits.md updated to match. Frozen inputs untouched: expectations.json / driver-expectations.json (oracle sha 069d2a70… unchanged). Carrier note (review round 5): the host commit enters this PR's lineage only via the coordinator merge-forward — until it resolves (`git cat-file -t 46c8d1d5f78`), the dispositions step requires the merge-carrier obligation entry `disp-rework5-host-commit-merge-carrier`, so this citation cannot dangle silently. Evidence: logs/batch-i/rework4-promote-gate-green.log (PASS exit 0, control DETECTED, carrier restored hash-proven)"
}
```

```json
{
  "id": "disp-rework4-derived-regen-host-complete",
  "source": "gate5-sweep/derived-artifact-drift",
  "classification": "derived-artifact-drift",
  "disposition": "resolved",
  "resolution_evidence": [
    "docs/test-assurance-kernel/s1/pr-body-disclosures.md",
    "docs/test-assurance-kernel/s1/logs/batch-i/rework4-promote-gate-green.log",
    "docs/test-assurance-kernel/s1/logs/batch-i/rework4-fences-barrel.log"
  ],
  "promotion_gate": "node scripts/test-assurance/verify.mjs --stage S1 --promote-gate (PASS exit 0 on the re-pointed carrier gate; this entry supersedes the stale-bundle promotion_gate lines of disp-rework2-derived-regen-fold and disp-rework3-proverules-snapshot-regen — the enforced pair is the carrier-source check + runtime-bundles --check freshness, named in disp-rework4-bundle-carrier-gate)",
  "note": "Supersedes disp-rework3-proverules-snapshot-regen (same source; append-only) and with it the promotion_gate lines of disp-rework2-derived-regen-fold and disp-rework3-proverules-snapshot-regen. The build-getff-dist family residual is RESOLVED: the coordinator executed bash scripts/build-getff-dist.sh on the lockfile-clean host as commit 46c8d1d5f78 — exit 0, packages/getff/MANIFEST.sha256 1542 files, both bundles rebuilt with fast-uri 3.1.8 verified (rule-bootstrap-cli.bundle.mjs +176 mirror entries). Disclosed in pr-body-disclosures.md §4. Re-open-at-merge note (honest residual accounting, same class, same ready-to-run command): the round-4 citation re-pins edit exactly one manifest-population file (packages/core/install/wire-synth-rules.test.ts — the only round-4 edit inside the MANIFEST.sha256 population; proven by pin-vs-HEAD hash equality before the edit), so the manifest needs one more lockfile-clean host regen after the coordinator merge-forwards this round's commits; the in-container getff-dist-manifest lane red is unchanged base-shape (the pre-existing stage-file drifts plus that one file). Carrier note (review round 5): this citation resolves only after the merge-forward carries the host commit (`disp-rework5-host-commit-merge-carrier`); the re-open regen itself is now an explicit S2 entry condition — `disp-rework5-s2-entry-manifest-regen`"
}
```

```json
{
  "id": "disp-rework4-stale-citations-resolved",
  "source": "gate5-sweep/stale-line-citations",
  "classification": "stale-citation",
  "disposition": "resolved",
  "resolution_evidence": [
    "packages/core/install/wire-synth-rules.test.ts",
    "scripts/render-face-facts.mjs",
    "docs/test-assurance-kernel/s1/logs/batch-i/rework4-citations.log"
  ],
  "note": "Supersedes disp-gate5-stale-citations (same source; append-only). The 3 activated citations are re-pinned under the coordinator's BLOCKER-4 scope ruling (mechanical completion of in-fence additions activating pre-existing references — the same class as the §2 D-Q18 rows): (1) wire-synth-rules.test.ts — the bare `eslint.config.mjs` line-citation was written pre-stage when the checker skipped it as path-missing; once the stage's root config existed it resolved to a DIFFERENT artifact than the sentence's referent (the root Q1/Q2 lane config is deliberately the array form, not defineConfig), so the citation is folded into the preset-template citation in the same sentence (the installed consumer config's true source) with a 2-line comment recording the replacement; (2)-(3) render-face-facts.mjs AGENTS.md:79/:99 → :80/:100 — the disclosed +1 rule-index row shifted the two getff:begin fence markers by exactly one line (merge-base content verified); the derived docs/site/face-facts.json embeds the strings and was regenerated (git delta = exactly those 2 lines; --check byte-identical). A 4th pin surfaced from this round's own bytes and was renumbered by the tool's drift arm: getff-default-branch-substitution.test.sh:289 citing check-fences-fire-full-barrel.test.sh:70-76 → :81-87 (the fences-count header insertion moved the cited lines). Note: check-line-citations --write CANNOT renumber beyond-eof/blank-landing findings (its renumber arm handles blame-drifted only — measured: 'renumbered 0'), so (1)-(3) are hand re-pins as the round-1 triage prescribed. Evidence: logs/batch-i/rework4-citations.log (--check --corpus exit 0)"
}
```

Review round 5 (2026-10-10, auto-review gate request_changes) — two stage-boundary
obligations promoted from prose to consumed entries. The raw host receipt for `46c8d1d5f78`
(build-getff-dist stdout, fast-uri 3.1.8 verification) exists ONLY on the coordinator host
and is not attached to this branch — the executor will not reconstruct it (invented
evidence) — so the enforced path is the merge-forward carrier, made mechanical below.

```json
{
  "id": "disp-rework5-host-commit-merge-carrier",
  "source": "merge-carrier/46c8d1d5f78",
  "classification": "dangling-citation-carrier",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "note": "Review round 5 [89d0cdb7197e]. Five shipped citations name coordinator host commit 46c8d1d5f78 (verify.mjs promotion-gate freshness string, disp-rework4-bundle-carrier-gate, disp-rework4-derived-regen-host-complete, honest-limits.md promotion-gate section, pr-body-disclosures.md §4, replay-commands.md, the fences-fire count comment); the commit does not resolve in this container (git cat-file -t fails, no origin ref carries it) and its raw receipt was not passed into it. MECHANISM: the dispositions step runs `git cat-file -t 46c8d1d5f78` on every invocation — while it fails, THIS entry must exist (owner-stage) or the adapter REDs 'the citation dangles for any PR reader'; once the merge-forward places the commit in the PR lineage the check flips to 'resolves in this checkout' and this entry self-discharges (flip it to resolved with that command's output as resolution_evidence). The coordinator merge-forward MUST carry 46c8d1d5f78 into the final PR lineage; reader check: git cat-file -t 46c8d1d5f78 (or git merge-base --is-ancestor 46c8d1d5f78 HEAD)"
}
```

```json
{
  "id": "disp-rework5-s2-entry-manifest-regen",
  "source": "merge-forward/reopen-manifest-regen",
  "classification": "reopen-at-merge",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "note": "Review round 5 [04b2f96c72a8] — EXPLICIT S2 ENTRY CONDITION (carried forward from the disp-rework4-derived-regen-host-complete re-open note so it cannot be lost at the stage boundary). After the merge-forward required by disp-rework5-host-commit-merge-carrier, run ONE further lockfile-clean host regen: bash scripts/build-getff-dist.sh — the round-4 citation re-pins edit exactly ONE manifest-population file (packages/core/install/wire-synth-rules.test.ts, the only round-4 edit inside the MANIFEST.sha256 population; proven by pin-vs-HEAD hash equality before the edit), so the committed manifest predates it. Exit condition: the getff-dist-manifest lane green on the post-merge checkout. S2 must not begin repair work until this entry is discharged (flip to resolved with the regen log as resolution_evidence). In-container rebuild is NOT the discharge: fast-uri 3.1.7 here would inline the wrong copy (same reason the round-4 rebuild ran host-side)"
}
```

D011 conditional source cycle (2026-10-14): the shared derived artifacts stay HELD. The
coordinator ACK (D011-SHARED-OWNERSHIP-ACK.json, SHA256 a034425f…) admitted the private
guard-liveness source/test edits under the frozen SB2 anchors but explicitly holds the
three derived bundle/MANIFEST paths until an independently accepted repaired source HEAD
is presented and the accepted-input checks are renewed. The recovery (R3 at `17e8c3ad5b1`)
presents that source; the reciprocal generation is the coordinator's move, recorded here
so a PR reader cannot mistake "source green" for "derived artifacts fresh".

```json
{
  "id": "disp-d011-shared-derived-hold",
  "source": "d011/shared-derived-artifact-hold",
  "classification": "held-pending-coordinator-generation",
  "disposition": "owner-stage",
  "owner_stage": "S2",
  "note": "Supersedes nothing (new source; append-only). The three derived bundle/MANIFEST paths held by the D011 shared-ownership ACK are NOT regenerated by the source cycle — generation freshness cannot be claimed green on the recovery tree, and the executor does not copy old generation output over current source. Discharge = the coordinator's post-acceptance reciprocal generation (renewed accepted-input checks), then flip to resolved with the generation receipts as resolution_evidence; if the boundary passes with it still held, S2 inherits the obligation and must not treat the delivered bundles as fresh. Evidence: recovery-d011/README.md non-claims section + honest-limits.md D011 section"
}
```

## Queue discipline

- Append-only per finding; never delete an entry — supersede it with a new entry naming the
  old `id` in `note` (the adapter re-validates the whole file on every run). The LAST entry
  naming a `source` is the binding one for the mechanical classification cross-check, so
  appending a corrected entry is the remedy for a stale one.
- A finding from the review channel (cold-review / review-sidecar) lands here the same way:
  `source` names the finding, `classification` names what the reviewer observed,
  `disposition: owner-stage` + `owner_stage` routes it. A review finding that is only a log
  line is exactly the failure mode spec §4 forbids.
- Coverage is recomputed from the records on every adapter run; adding a new surviving
  counterfactual or a new reject-by-review oracle case without an entry below REDs the
  acceptance run by construction.


## M15 actual-lineage successor (2026-10-14, corrected per independent review 09826c35)

Chief decision `tak-m15-real-lineage-successor-decision-20261014.json` (sha256
`d438e3722bcc48b7e0adc61bbacd33e4adb9cc14ca6afbf52bebf99fdc810f7d`, option B) selected an
evidence-bound lineage successor replacing the unrecoverable historical host commit
`46c8d1d5f78`. The first preparation proposal (dangling commit `be79f2e0`, tree
`175f9917`) was reviewed REVISE_BEFORE_SOURCE_EFFECT (M15-PREPARATION-REVISE.json, sha256
`09826c35bc99f55361b0e3a12836e5e9073a4c619645d39b707cf11b157bcb21`); this section is the
corrected form: the six immutable receipts below are embedded BYTE-EXACTLY (zlib+base64 of
the original files, generated by code — never hand-retyped or synthesized), the adapter
`verify.mjs` pins their hashes and REFUSES on missing/empty/malformed/altered/duplicate
blocks and on linkage drift, and the same adapter invokes the stock freshness tools
(`build-getff-dist.sh --check`, `build-runtime-bundles.mjs --check`) against LIVE source on
every dispositions run. This section is appended AFTER the complete original queue bytes
above (the Queue discipline footer included) — every prior byte is an untouched prefix.
Historical `46c8d1d5f78` and the historical be84 object stay MISSING and disclosed (local
probe exit 128; GitHub HTTP 422; configured container transport timeout — remote UNKNOWN);
neither is synthesized.

```text
M15-RECEIPT SOURCE_GO
label: independent accepted-source GO (ACTUAL-SOURCE-HEAD-GO.json)
content-encoding: zlib-deflate-then-base64 (node:zlib inflateSync reverses it deterministically)
original-bytes: 12485
sha256: 56f33fd15124806dce58c8ac3e60f9651187e19ef983a8b4c7b41023862cbbb5
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
h9k=
```

```text
M15-RECEIPT S1_GO
label: independent S1 private-stage GO (S1-PRIVATE-STAGE-GO.json)
content-encoding: zlib-deflate-then-base64 (node:zlib inflateSync reverses it deterministically)
original-bytes: 6905
sha256: e011679d161ea7c03940f0cf9033960e7f6bd114bfc153d38ea3476a93f7e548
eJzNWVtv3LgVfs+vIPxayxJJXddPRuLNBk2T3dhZoCiKAUUeerTWSCol+bLB/vd+pDQzThqjaB9avxgeDslzzndu3+F8ecXYyW3TmZMf2Mm7ztBA+NNN7IqzwTV3aqJo
nNQNMaU1DZPqNP61Ezk29rPDB0eDahxTncG/uhlcr1XLbqgjp6am705OvQg1beZJeyEiEXnEk4in1wn/gWc/JMmZLNIkz/+UJPiw7L8jZxo9+QNvPy5LQQ2/cMWXhS2p
oLbSvMiq1HLLyShlClOVdaJ0LYzRJimpSMuMl3Y5NTkKt6jMqNxCbmmrtJQlr40iSZUiZU1eJqbO67qoquWU6/ugTPx5JDfGyk3xme4NPcT3vbv1d46xUKWK3dzSGKkx
mmic8E+ziq0doNv6K5Zjk7qNRh6ZhK/W9K65aTrVbmo1BgVlVsgyy1KrbCIqqizJuqxTLbLaGkMiFTbPdJ6v6Oh+WNFh9EB6nlTdErsl11HLmo5N22ZkhnSrHJm9b9ni
W70lfdvP0znba8GuBBv6YW6DD2MN9zbGH2i6OxjW3IR1tlOPzHucyJyxDz2zc9tGWPiN9MRq2qq7pne4TZObGtvocOoUl0Bu20IP3XfjvCMXD3Pdrt/HOwV9sfhV1J2t
doao2xzXYfMXfIGvBjVtv++ju2acVdv8Hq6HoxCCMU9iLuKEKy6syKK81joqdMGjSgiKjMxJK4FwyHQMZIZ5GoPPHHl9I38FT7iMXRqNW4LVuneI/6D/omOkhuFgUnNM
LVxx19B9fPH6+vPF++jq4+dPry+jny4v3kRvP579Nq4p423dKpHl3qQst1JawzMu0jLJjaas1KXSkvLEVnnGeVkQr8hWpVQ+SIo65YmQZS50XdfZCS78I+C3JiaZ70K4
ouuV8WK5rlOVcSOp4JlM00SqtMgrIghJsqLQJLIks3avMFkLCA7H/6PExHG9Vd0NNPOOHHHB38Jy8Ky+RZyO8Q1N1sZ/ufjw7sfLq+uzFaCw7e/rJV3vdsgiC0dtOxrH
jSGr5nba0EPjUzhZ95lmnJ77LmSF2exU11hE+8Z77+HbTYdvj24SMqvyoshThdgpjJQ1J11IXVmZ6FzURWorKbMys9ghTCm05rlJRWVSEkmt90DMXQvtoMHRW3O3ogM5
k5tpj/iDAuCr2/p77B63zbBxOHev2lWnIuNpnpVcJLJWhcpSY4zKVC5kYW1mUo3IMok2uSgUtDBFnRORTgWpyhyc0+92fbfpEM93tFk8jfutakc6RNeTMN9se2CD/J6c
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
```

```text
M15-RECEIPT OWNERSHIP_RENEWAL
label: reciprocal ownership renewal (TAK-PRIVATE-1cb4-GENERATION-OWNERSHIP-RENEWAL.json, coordinator-supplied byte-exact copy)
content-encoding: zlib-deflate-then-base64 (node:zlib inflateSync reverses it deterministically)
original-bytes: 3536
sha256: 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
y3e/AzBmdCE=
```

```text
M15-RECEIPT FRESHNESS_RESULTS
label: independent freshness results (freshness-results.json)
content-encoding: zlib-deflate-then-base64 (node:zlib inflateSync reverses it deterministically)
original-bytes: 1131
sha256: 114ced7360848fae5c324163f5cdb257544acd5178bfe872c91963c48ecab3fe
eJytk89PwjAUx+/8Fc1Omrit2xgFPXnQxINe9CYGavfG6kq79IdIDP+7HRjQiALqYc3y3vd9X/vp630HoVf/IRQYS60zwSkKSidKLgQUwckq9UyFA59ZKX2AVU7WI160
6u6gyDF+l/rcjAoxsnwKIwNMyaK1xFHSJTjtkUGy1sELtyOmitYYr6NK8wmX1DuoGqTPO2m9gPQ3Cmcb18aCoUtJkqGGsppOwMRMaYgrpWoTNxrCxpkqenSyEBBNnwzi
Epm5ZGjGbfVzkTVDudWcS09JiFg7AeGjUtZYTZuQCb5nox8MdjadsiY0ymkGIauA1Qe2/FLeNgyWVBd+XZz8fRSyBBPc3TUK/V5O+kkvzX83Cuk+ozABW5bx9fnN1eXF
7V1kKprmvc+UbAVIQ6OQ9teAjpK8myJ/VjDHZ2i8/Bkjpp5BGwR+nXvzuVC0WOr/mxzJcAY7HlESYZylA0Jwfyej9HtGfosTKA5GtS5bQfjIy8PYfpUbRJ2HzhvHHVkn
```

```text
M15-RECEIPT GENERATION_INPUT
label: private generation input (private-generation/INPUT.json)
content-encoding: zlib-deflate-then-base64 (node:zlib inflateSync reverses it deterministically)
original-bytes: 587
sha256: bf29732001ebd9ddd4477ed7e5a9f199ed04667090eeb8a52053acf77be570ee
eJxVkc2O0zAURvd9CqtrPPFPbCewqpgCXTCgTmEbXdvXbSBNKtupBhDvjtMZIc3Gsnx9vu/I/rMiZA3+3KfUT+P6LVlX3xLGVEHM1Z2bPD5V1z7NMPS/IZcrqRJM6Iqz
iouKceAiCEW1dY4aZzhthUDqpUYHAltQrprmfJlzqjL8pBHTfEa6RHDGZfV1v/u+OWzpx+3Ddr857L480M39593jY9nd/UjF6M0rwS6dQCi9eIIMjQRluW+4hFpLKJWm
bZgE7zCYWjjhkYvWiFpaaUCYxlo0oC3TXLnn5DTN0WH3abu5X0K5szUo7iUarmRdl7Da6BZRQsOUMQ6FYiqEV3COiAtcFOqGOfBKB1vaVW1bCaYxdYMhFE3jXJHULzCc
sUv4/90LbFE1ioLnhhZlQdtGWioDY6JtbdAcXsgMx1vhJfZXyEjwCVyWZJziGQZyxBFjOfbE49BfMf56xsI8DN1pSrk7lunC70aPFyzLmMn75atJnMdEptEh2Xw4bPck
n/pEbn3vSjzx82Xo3VI5jxGHWwnMvs/r1d/VP5qPsOc=
```

```text
M15-RECEIPT GENERATION_AFTER
label: private generation after-state (private-generation/AFTER-STATE.json)
content-encoding: zlib-deflate-then-base64 (node:zlib inflateSync reverses it deterministically)
original-bytes: 2067
sha256: d00ccc4c168ab84eb2726792d4f948c19a06b804e68eb6ce3adb9e045cb26784
eJztVctu40YQvPsrCF0TWvN+ONgAAZIAOeQBrHMWerp7LMUSKZCj7C4W++9pys/YRvYHciPImarururi54uuW02M40RMG2ibU8PVVbcyyoReq167a6WvlL3y6tJa56z9
RqkrpVbfni+OY1tOr/+ceZrXMLX1JY7EH9cfxum2Tczz2kCC9XTa89zD3Deemzzs6h1AmWDA7QJxd63BbT/rnpTWdwcAkY9NSpvH04S82TLQclxjceA1WY7aS13Kgosh
M1tIyseIbLzytb6NslS2oAS5lRQC+VCLQeNdyRZiii5xrZR0RATGcIdywwNP0Hbj8FgGoI4+u6qrZgKgSDkVBVgMEZJKLEhep/oK4KEC8AShOhVSzS7ZpAsBW87AUCkk
RSWUEnO+7+PUtuP01MeOeGi79mlBol2t3YtG++9f1Ny9e9eNw/5TdwS8hRuR54Zbretff/jtl59/en99OW/B+Pt+21aK3ByhbecN1MaT0HyWD/Lp8boYh9fbcbyd18eJ
++Np3l6W00B7vjz8NS91JZkopcw6FJWztQqKB+VC9dEbp10p1kSZdvY5m5iBLBStQ4o5csQM51peUe6GucF+fzZWX8SGc5vg2ON+94I+ir6ZWKdktNWxUCVXqhLVxDUZ
vddV1IvZWdIq5GpVAROx1IpZRLWv6N8e2LIy1ucQY3CAgkDWFs0YLS6YGEyJrkr7PvkqJwwlg6gDOZPJsVEFV0L05dXgC1fp9//J/9fkM5F1OqGq1SUHyVDQGLyxJoTC
KkPUMRgdI8WgNFKqUUFiG9BUyjU+Tf407Hfzsj8HPD4sGW4Zbzc4Hg67dl6tR15HzAmdR8MJtHO1MpEGTl6BrxSFpRrPQXnrJWPQSVihSakSWi9zXn2F8yTZCMMNL1HT
phPfhQhIhi5JXXcD7B+S6N4d00ny4MBd358R5IO6nyIJx/PXjy0Pkg5/C+M4zKcDT/8ivUd9SDs25BIkb2vQhrIu1ausRbeAroihHKcQTYiPyr3tS88mqhAUSe6VDLIZ
wZnooxPdBMdrA65aCcasFGrkxTBJFYpaKVMtPsB/1YFGQ5CFSzVgVdl552OyNcXC4kSBVCorIAqsVE3Jk6aiS5KFkH6rKeGB6A3LabSKcwGMKbAv7MV4GJnE06SZHfsg
6W1MKuRknzRlxyqRslgTWHi27AN/bJtF1AX2/fXvf3Sy8B2O8kcWgZs87wbiIw9L1ndn0funVL9PfPmL8nddPe333Y8wfdgN3XYUvUVUGQ02SYjxMDZeX6trfW26wvtx
uOna2LUtP+daXXy5+AdJCWuy
```

The three successor records below supersede the round-5 pair and the D011 hold per the
queue's append-only discipline (the LAST entry naming a `source` is the binding one):

```json
{
  "id": "disp-m15-successor-merge-carrier",
  "source": "merge-carrier/46c8d1d5f78",
  "classification": "dangling-citation-carrier",
  "disposition": "resolved",
  "resolution_evidence": [
    "scripts/test-assurance/verify.mjs",
    "docs/test-assurance-kernel/s1/dispositions.md",
    "docs/test-assurance-kernel/s1/honest-limits.md",
    "docs/test-assurance-kernel/s1/pr-body-disclosures.md",
    "docs/test-assurance-kernel/s1/replay-commands.md"
  ],
  "note": "Supersedes disp-rework5-host-commit-merge-carrier (same source; append-only). Chief decision tak-m15-real-lineage-successor-decision-20261014 (sha256 d438e372…, option B) replaces the literal carry of historical host commit 46c8d1d5f78 with the VERIFIED actual lineage — recovered 4fa71b5d/tree 4229a3a3 → accepted source 1cb4a51d/tree 63a480ca → host generation ac17594f/tree a5da6f40 → HEAD — checked LIVE by verify.mjs stepDispositions (commit types, exact trees, ancestry, generation parent == source, generation diff == packages/getff/MANIFEST.sha256 only, manifest blob sha256 23596776…) and bound to the six byte-exact embedded receipts above (SOURCE_GO/S1_GO/OWNERSHIP_RENEWAL/FRESHNESS_RESULTS/GENERATION_INPUT/GENERATION_AFTER; pinned hashes in verify.mjs; duplicate/missing/empty/malformed/altered blocks RED). The same arm runs the stock build-getff-dist.sh --check and build-runtime-bundles.mjs --check against LIVE source — stale manifest or bundle is RED with the stock diagnosis, not a historical-hash-only pass. The commit itself remains MISSING (remote UNKNOWN) and is NOT synthesized. Load-bearing citations re-pointed to the actual generation receipt; historical narrative (pr-body-disclosures §4–§5, the superseded entry above, raw logs) keeps the old story byte-intact."
}
```

```json
{
  "id": "disp-m15-successor-s2-entry-regen",
  "source": "merge-forward/reopen-manifest-regen",
  "classification": "reopen-at-merge",
  "disposition": "owner-stage",
  "owner_stage": "S4",
  "note": "Supersedes disp-rework5-s2-entry-manifest-regen (same source; append-only). PRIVATE-STAGE DISCHARGE (chief decision, option B): the reciprocal generation ac17594f regenerated packages/getff/MANIFEST.sha256 from accepted source 1cb4a51d (diff = exactly that one path; manifest sha256 23596776…; renewed accepted-input checks — ownership renewal receipt sha256 23575146… embedded above; independent S1 acceptance e011679d… embedded above). This discharges the S2 entry condition FOR THE PRIVATE STAGE and with it the D011 hold (disp-m15-successor-d011-hold). The obligation is NOT retired: it RE-ARMS at public integration — any future public source integration MUST (1) merge-forward the then-current staging/native, (2) regenerate the integrated accepted inputs with SHARED owner renewal (the D011 shared-ownership ACK holds the three bundle/MANIFEST paths for shared ownership), (3) pass same-head CI/publication/final acceptance. Enforced at that boundary by the existing freshness gates against live source — verify.mjs invokes the stock runtime-bundles --check and getff-dist --check directly, never symbol/scalar substitutes; no blanket owner-stage fallback discharges it."
}
```

```json
{
  "id": "disp-m15-successor-d011-hold",
  "source": "d011/shared-derived-artifact-hold",
  "classification": "held-pending-coordinator-generation",
  "disposition": "resolved",
  "resolution_evidence": [
    "scripts/test-assurance/verify.mjs",
    "docs/test-assurance-kernel/s1/dispositions.md",
    "docs/test-assurance-kernel/s1/honest-limits.md"
  ],
  "note": "Supersedes disp-d011-shared-derived-hold (same source; append-only). Discharge condition met in the private stage: the coordinator's reciprocal generation ac17594f renewed the three held bundle/MANIFEST paths from the accepted repaired source 1cb4a51d — post-generation byte identities pinned in the embedded OWNERSHIP_RENEWAL and GENERATION_AFTER receipts (pre-push.bundle.mjs 893ad89e…, rule-bootstrap-cli.bundle.mjs 780c9de1…, MANIFEST.sha256 23596776…; unlisted generated source unchanged; native 0166 consumer slots untouched) — with renewed accepted-input checks (ownership renewal receipt 23575146…) and both stock --check gates green at HEAD, re-verified LIVE by the dispositions arm on every run. The share-ownership residual at PUBLIC integration re-arms via disp-m15-successor-s2-entry-regen (shared owner renewal there), not here."
}
```

## S2 current scoped resolutions (history above retained)

```json
{"id":"disp-s2-final-01","source":"wrong-import/bad.wrong-import","classification":"scoped-current-resolution","disposition":"resolved","resolution_evidence":["docs/test-assurance-kernel/s2/final-scope-ruling.json","docs/test-assurance-kernel/s2/dispositions.json"],"scope":"Independent current boundary/source proof only; future actual unresolved semantic findings remain blocking, never waived by external-contract status."}
```
```json
{"id":"disp-s2-final-02","source":"replay-a12-emitted-corruption","classification":"scoped-current-resolution","disposition":"resolved","resolution_evidence":["docs/test-assurance-kernel/s2/final-scope-ruling.json","docs/test-assurance-kernel/s2/dispositions.json"],"scope":"Independent current boundary/source proof only; future actual unresolved semantic findings remain blocking, never waived by external-contract status."}
```
```json
{"id":"disp-s2-final-03","source":"cold-review-batch-i/C4-preset-rules-md-catalogs","classification":"scoped-current-resolution","disposition":"resolved","resolution_evidence":["docs/test-assurance-kernel/s2/final-scope-ruling.json","docs/test-assurance-kernel/s2/dispositions.json"],"scope":"Independent current boundary/source proof only; future actual unresolved semantic findings remain blocking, never waived by external-contract status."}
```
```json
{"id":"disp-s2-final-04","source":"cold-review-batch-i/C5-rules-manifest-registration","classification":"scoped-current-resolution","disposition":"resolved","resolution_evidence":["docs/test-assurance-kernel/s2/final-scope-ruling.json","docs/test-assurance-kernel/s2/dispositions.json"],"scope":"Independent current boundary/source proof only; future actual unresolved semantic findings remain blocking, never waived by external-contract status."}
```
```json
{"id":"disp-s2-final-05","source":"CAND-086","classification":"scoped-current-resolution","disposition":"resolved","resolution_evidence":["docs/test-assurance-kernel/s2/final-scope-ruling.json","docs/test-assurance-kernel/s2/dispositions.json"],"scope":"Independent current boundary/source proof only; future actual unresolved semantic findings remain blocking, never waived by external-contract status."}
```
```json
{"id":"disp-s2-final-06","source":"CAND-088","classification":"scoped-current-resolution","disposition":"resolved","resolution_evidence":["docs/test-assurance-kernel/s2/final-scope-ruling.json","docs/test-assurance-kernel/s2/dispositions.json"],"scope":"Independent current boundary/source proof only; future actual unresolved semantic findings remain blocking, never waived by external-contract status."}
```
```json
{"id":"disp-s2-final-07","source":"CAND-089","classification":"scoped-current-resolution","disposition":"resolved","resolution_evidence":["docs/test-assurance-kernel/s2/final-scope-ruling.json","docs/test-assurance-kernel/s2/dispositions.json"],"scope":"Independent current boundary/source proof only; future actual unresolved semantic findings remain blocking, never waived by external-contract status."}
```
```json
{"id":"disp-s2-final-08","source":"CAND-090","classification":"scoped-current-resolution","disposition":"resolved","resolution_evidence":["docs/test-assurance-kernel/s2/final-scope-ruling.json","docs/test-assurance-kernel/s2/dispositions.json"],"scope":"Independent current boundary/source proof only; future actual unresolved semantic findings remain blocking, never waived by external-contract status."}
```
```json
{"id":"disp-s2-final-09","source":"CAND-094","classification":"scoped-current-resolution","disposition":"resolved","resolution_evidence":["docs/test-assurance-kernel/s2/final-scope-ruling.json","docs/test-assurance-kernel/s2/dispositions.json"],"scope":"Independent current boundary/source proof only; future actual unresolved semantic findings remain blocking, never waived by external-contract status."}
```
