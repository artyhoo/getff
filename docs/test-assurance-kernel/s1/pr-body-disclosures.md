# S1 PR-body disclosures

> **Status:** ACTIVE — reviewer-facing disclosures to be carried verbatim (or by pointer)
> into the S1 PR body. Source of record for finding b55cd1aeca20 (auto-review rework round 1,
> 2026-10-08): the `AGENTS.md` derived-edit disclosure must reach the PR body, not only
> `batches.md:550` (the file was at 597/600 lines, so the receipt moved here).
> **Rule:** these are disclosures of OUT-OF-FENCE bytes this branch carries, each with the
> in-fence cause, the rationale for editing rather than queueing, and the verification.

## 1. Root `AGENTS.md` + `.agents/rules/00-rule-index.md` — renderer-forced rule-index rows

**The bytes:** `git diff <base>..HEAD -- AGENTS.md` adds exactly one generated rule-index row
(the `test-quality-contracts.md` row), and the same renderer regenerated
`.agents/rules/00-rule-index.md`. Root `AGENTS.md` is NOT in the kickoff's literal write
fence; `.agents/rules/**` (test-quality authority only) IS.

**Cause:** the in-scope rule add `.agents/rules/test-quality-contracts.md` (Batch H). The
renderer `scripts/render-rule-index.mjs --write` emits BOTH index surfaces from rule
frontmatter — `.agents/rules/00-rule-index.md` and the rule-index region of root `AGENTS.md`.
The row is the twin output of an in-fence source edit, mechanically forced: refusing to write
it leaves the shipped index asserting the rule does not exist, and the rule-index digest is
the resident context every session reads — the new rule would be invisible at its own
consumption channel while its source file shipped.

**Why edited rather than queued** (the reviewer-noted inconsistency with
`disp-gate5-derived-artifact-regens`): these rows are the DIRECT, same-commit, single-line
consequence of an edit the fence explicitly authorizes, produced by the declared renderer,
and verifiable in the same commit — folding them is the Batch-B-twins precedent (regen of an
in-fence source's declared twin). The gate5 queued regens are a different class: derived
artifacts whose content depends on whole-tree state this container cannot honestly produce
(`pre-push.bundle.mjs` needs a lockfile-clean install — fast-uri 3.1.7 vs 3.1.8; the
install-sh snapshots, `docs/site/**` and `MANIFEST.sha256` sweep multiple delivery surfaces),
so queueing them (with ready-to-run repair commands + a promotion gate) avoids shipping
unverified derived bytes. One sentence: **edit what the renderer deterministically derives
from an in-fence edit; queue what requires a tree state or delivery surface this stage cannot
verify.**

**Verification:** principle 31 + 09 green over the live population (84/84, Batch H); the
index row is byte-output of `npx tsx scripts/render-rule-index.mjs --write` at the shipped
frontmatter; disclosed in the Batch-H commit body at the time of the edit and at
`batches.md` §Batch-H outcome.

## 2. Four `docs/site` pages — derived `sources:` rows for the new root `eslint.config.mjs`

**The bytes:** `git diff <base>..HEAD` adds exactly one `sources:` frontmatter row
(`- eslint.config.mjs`) to each of `docs/site/ai-agents.md`, `docs/site/installation.md`,
`docs/site/quickstart-ts.md`, `docs/site/understand/why-a-rule-must-prove-it-fires.md` —
four pages that are otherwise byte-identical to base. `docs/site/**` is NOT in the
kickoff's literal write fence.

**Cause:** the in-fence root `eslint.config.mjs` addition (Batch B delivery edge + K5
family). `scripts/docs-check.mjs` `extractAnchors` promotes a page's pre-existing
inline-code `` `eslint.config.mjs` `` span to a body anchor only once the file exists
(the `statSync(...).isFile()` gate), and `checkSources` then requires every body anchor
to appear in `sources:` (D-Q18: authors add, never remove a derived entry). The branch
created the file; the four pre-existing spans became anchors; the derived rows were
missing — `run-local-ci-sweep.sh` docs-quality-strict FAILed (exit 1, 4 errors naming
exactly these four files) at `bf498cab6` while the merge-base run exits 0.

**Why edited rather than queued** (coordinator scope ruling, host-contract rework round 2,
2026-10-09): mechanical completion of the in-fence `eslint.config.*` addition propagating
to site pages — the same class as disclosure §1 (a declared mechanism deterministically
derives new rows from an in-fence edit; here the mechanism is docs-check's anchor↔sources
pairing rather than the rule-index renderer). Queueing instead would egress a red
docs-quality-strict arm, which the host contract requires green.

**Verification:** rows were ADDED only — nothing removed; `run-local-ci-sweep.sh`
docs-quality-strict arm green on the post-fix tree (rework-round-2 receipt in
`logs/batch-i/`).

## 3. Rework-round-2 fold — derived-artifact regens + the audit-self STACK_RULES mirror

**The bytes:** `git diff <base>..HEAD` beyond the two host-contract fixes adds: (a) two
derived count lines in `docs/site/face-facts.json` (`principles.count` 57→60,
`F1.members` 30→31); (b) one adjacency in `docs/site/reference/C.json` and one rule row in
`docs/site/reference/F1.json` (the `test-quality-contracts` rule); (c) re-captured
`tests/install-sh/baselines/<react-native|react-next|react-spa|ts-server>/{greenfield,brownfield}.fingerprint`
(8 files — the two rules' `eslint-rules-local/` twins plus derived install outputs);
(d) `packages/core/audit-self/prove-rules.mjs` — 6 mirror entries (in-fence, not a
disclosure item by itself; listed because it feeds (c) and the `MANIFEST.sha256` delta).
`docs/site/**` and `tests/install-sh/**` are NOT in the kickoff's literal write fence.

**Cause:** in-fence additions — principles 51/52/53, Batch B's rule twins + template
placements, Batch H's `test-quality-contracts` rule — whose derived surfaces had not been
regenerated. Surfaced by the rework-round-2 post-commit `--keep-going` sweep enumeration
(round 1's battery was cut before these lanes): `face-facts-check` FAIL (the round-1
`disp-gate5-derived-artifact-regens` drift) and 4 `prove-rules-parity.test.ts` REDs
(T-C3 mirror, a previously-untriaged round-1 residue — the round-1 battery never reached
`vitest-units`).

**Why edited rather than queued** (round-2 extension of the §1 sentence, under the
coordinator's BLOCKER-2 scope ruling): the host contract requires the sweep arms green, and
queueing these would egress red `face-facts-check` / `reference-check` / `byte-identical`
arms — the same reasoning that ruled the §2 rows in scope. Unlike the round-1 queue rationale,
each regen is verified green IN THIS CONTAINER by its own declared check
(`render-face-facts.mjs --check` byte-identical; `render-reference.mjs --check`;
`byte-identical.test.sh` compare), so no unverified derived bytes ship. **The queue-class
boundary stays where §1 drew it:** `bash scripts/build-getff-dist.sh` (the
`MANIFEST.sha256`/`pre-push.bundle.mjs` rebuild, whose delta now also covers the (d) mirror
edit) still requires a lockfile-clean install this container cannot produce (fast-uri 3.1.7
vs 3.1.8) and remains queued with its promotion gate
(`disp-rework2-derived-regen-fold`, superseding `disp-gate5-derived-artifact-regens`);
`disp-gate5-stale-citations` (3 line re-pins in pre-existing out-of-fence sources) is
unchanged. One sentence: **round 2 edits the regens the host contract needs green AND whose
gates verify them here; the bundle rebuild stays queued because no gate here can verify it.**

**Verification:** the three gate runs green (raw: `logs/batch-i/rework2-regens.log`,
incl. the reference→face-facts regen ORDER dependency the fold caught — the face-facts
derivation reads `docs/site/reference/F1.json`); parity 7/7 + `prove-rules.test.ts` 47/47 +
prettier clean (`logs/batch-i/rework2-parity-green.log`); deltas are additions/derived counts
only — no pre-existing content removed.

## 4. Final-rework fold — citation re-pins + fences counts + the re-pointed promote gate, and the coordinator-side derived-regen commit 46c8d1d5f78

**The bytes (this round's edits, final rework 2026-10-10):** (a)
`packages/core/install/wire-synth-rules.test.ts` — the stale `eslint.config.mjs:50`
citation re-qualified: once the stage added a repo-root `eslint.config.mjs` the bare
basename resolved to a DIFFERENT artifact than the sentence's referent (the root Q1/Q2 lane
config is deliberately the array form), so the citation folds into the preset-template
citation already in the same sentence, with a 2-line comment recording the replacement; (b)
`scripts/render-face-facts.mjs` + derived `docs/site/face-facts.json` — the two `AGENTS.md`
citations re-pinned :79→:80 / :99→:100 (the §1-disclosed +1 rule-index row shifted both
`getff:begin` fence markers by exactly one line; regen delta = exactly those 2 lines,
`--check` byte-identical); (c) `tests/install-sh/getff-default-branch-substitution.test.sh`
— one blame-drifted citation renumbered :70-76→:81-87 (this round's own (d) header insertion
moved the cited lines); (d) `tests/install-sh/check-fences-fire-full-barrel.test.sh` —
expected installed-barrel counts 6→8 / 5→7 with the R12 re-derivation recorded in-file (the
barrel is GENERATED AT INSTALL TIME from the tracked rule sources, so the stage's two
test-quality rules join it as soon as their sources ship; measured identical in-container at
3d2e79d49 and on the lockfile-clean host at 46c8d1d5f78); (e)
`scripts/test-assurance/verify.mjs` + `honest-limits.md` + `replay-commands.md` — the
promotion gate re-pointed at the delivery carrier (BLOCKER-3). (a)-(c) are the coordinator's
BLOCKER-4 scope-ruling class: mechanical completion of in-fence additions activating
pre-existing references — the same class as the §2 D-Q18 rows.

**The coordinator-side bytes (NOT this branch's diff):** host commit `46c8d1d5f78` executed
the queued `bash scripts/build-getff-dist.sh` on a lockfile-clean install — both bundles
rebuilt with fast-uri 3.1.8 verified (NOT rebuilt in this container, where fast-uri 3.1.7
would inline the wrong copy; `rule-bootstrap-cli.bundle.mjs` +176 mirror entries) and
`packages/getff/MANIFEST.sha256` regenerated (1542 files, exit 0). This RESOLVES the §3
queue-class boundary item: `disp-rework4-derived-regen-host-complete` (superseding
`disp-rework3-proverules-snapshot-regen`) marks the build-getff-dist family residual
RESOLVED with that evidence, and `disp-rework4-bundle-carrier-gate` (superseding
`disp-gate5-runtime-bundle-rebuild`) records the re-pointed promote gate + freshness pair.
**Re-open-at-merge note:** the round-4 citation re-pins edit exactly ONE manifest-population
file (`packages/core/install/wire-synth-rules.test.ts` — the only round-4 edit inside the
MANIFEST.sha256 population; proven by pin-vs-HEAD hash equality before the edit), so the
manifest needs one more lockfile-clean host regen after the merge-forward (same channel,
same ready-to-run command); the in-container `getff-dist-manifest` lane red is unchanged
base-shape (the pre-existing stage-file drifts plus that one file). §3's closing sentence
("`disp-gate5-stale-citations` … is unchanged") is superseded here: those 3 pins (plus the
4th self-activated one) are now RESOLVED — `disp-rework4-stale-citations-resolved`.

**Merge-carrier obligation (review round 5, 2026-10-10):** every citation of `46c8d1d5f78`
in this package (the freshness evidence above, both rework4 queue entries, honest-limits,
replay-commands, the fences-fire count comment) names a commit that exists only on the
coordinator host — it does not resolve in the executor container, and the RAW host receipt
(build-getff-dist stdout, fast-uri 3.1.8 verification) was never passed into it, so none is
attached: attaching a reconstruction would be invented evidence. The enforced path is the
carrier: **the coordinator merge-forward MUST place `46c8d1d5f78` in the final PR lineage**;
a reader verifies with `git cat-file -t 46c8d1d5f78` (or
`git merge-base --is-ancestor 46c8d1d5f78 HEAD`). Until it resolves, the adapter's
dispositions step REDs if the queued carrier obligation (`disp-rework5-host-commit-merge-carrier`)
is missing — the citations cannot dangle silently. The post-merge manifest regen is the
explicit S2 entry condition `disp-rework5-s2-entry-manifest-regen`.

**Verification:** `node scripts/check-line-citations.mjs --check --corpus` exit 0 (raw:
`logs/batch-i/rework4-citations.log`); `render-face-facts.mjs --check` byte-identical;
`bash tests/install-sh/check-fences-fire-full-barrel.test.sh` exit 0, 4/4 arms, with the
updated counts (`logs/batch-i/rework4-fences-barrel.log`); `node
scripts/test-assurance/verify.mjs --stage S1 --promote-gate` PASS exit 0 with the both-ways
flip control DETECTED and the carrier restored hash-proven
(`logs/batch-i/rework4-promote-gate-green.log`); full sweep re-run vs the recorded container
base-red set (`logs/batch-i/rework4-sweep.log`).

## 5. Coordinator merge-side bytes — merge 942ccdef43c, the FETCH_HEAD incident, and the post-merge manifest regen

**The bytes (coordinator host output, not worker bytes):** (a) merge commit `942ccdef43c`
bringing worker head `2b2281902e7` into the S1 branch over host commit `46c8d1d5f78` —
completed through the merge guard's declared escape hatch `MERGE_UNPUSHED_OVERRIDE` (one
use, logged in `<git-common-dir>/merge-unpushed-override.log`: «aif container bundle
harvest bd2bc9be (egress via this branch PR only); full S1 battery runs on this host
before push»), because `2b2281902e7` is container-origin and unreachable from `origin/*` —
the designed path for bundle-harvest egress, with the full battery run on this host before
any push. (b) The fetch-sequencing incident the merge survived: an intermediate
`git merge FETCH_HEAD` briefly merged the WRONG head (`origin/staging` 4849aede805) because
a later `git fetch origin staging` had clobbered the single-slot FETCH_HEAD — diagnosed via
FETCH_HEAD content + MERGE_HEAD, aborted cleanly (`git merge --abort`, zero loss; tree
verified back at `46c8d1d5f78`), then the correct merge performed by explicit SHA. No bytes
from the aborted merge survive; disclosed for lineage transparency. (c) This commit:
`packages/getff/MANIFEST.sha256` regenerated on the lockfile-clean host
(`bash scripts/build-getff-dist.sh`, exit 0, 1542 files) — exactly the §4
«Re-open-at-merge note» obligation (round 4 edited exactly one manifest-population file) —
the delta is exactly one line (`packages/core/install/wire-synth-rules.test.ts`
`f46336e25…` → `881e4d13b…`), bundles unchanged (already current from `46c8d1d5f78`), and
`bash scripts/build-getff-dist.sh --check` exit 0, re-verified in the tree this commit
builds on.

**Why here and not queued:** the §4 merge-carrier obligation requires the coordinator
merge-forward to place `46c8d1d5f78` in the final PR lineage (done: `942ccdef43c`), and the
declared S2 entry condition `disp-rework5-s2-entry-manifest-regen` requires this regen
before S2 repairs ship. This host is the declared lockfile-clean channel and the PR cannot
egress a red `getff-dist-manifest` lane that this same host can repair; the queue entry
flips at S2 entry review, not here.

**Verification:** `git cat-file -t 46c8d1d5f78` resolves in this checkout (merge-carrier
flip condition met); `bash scripts/build-getff-dist.sh --check` exit 0 («in sync with the
repo root, 1542 files»), run both in the regen checkout and against the tree this commit
builds on; regen diff vs pre-regen tree = exactly 1 manifest line; raw logs
`/tmp/tak-harvest/manifest-regen-r5.log` + `/tmp/tak-harvest/manifest-check-r5.log` +
`/tmp/tak-harvest/manifest-check-r5-wtfinal.log`, receipts copied into the S1 review
package (`receipts/s1-manifest-{regen,check}-r5.log`).

## 6. M15 actual-lineage successor — the 46-carry citations re-pointed to the real generation receipts (2026-10-14, corrected per review 09826c35)

- **Bytes:** exactly six paths (verify.mjs actual-lineage + receipts + live-freshness arm;
  dispositions.md appended §M15 with six byte-exact embedded receipts and the three successor
  records; this file; replay-commands.md; honest-limits.md; s2/dispositions.json M15 rows).
  All four S1 docs carry the complete original bytes as an untouched prefix — the M15 material
  sits AFTER the original Queue discipline footer (first-proposal placement corrected).
- **Cause:** the historical host commit `46c8d1d5f78` named by the round-4/5 citations is not
  recoverable (local object probe exit 128; GitHub commit lookup HTTP 422; configured container
  transport timed out — remote UNKNOWN), and the raw host receipt exists only on a host this
  branch cannot reach. Chief decision `tak-m15-real-lineage-successor-decision-20261014`
  (sha256 `d438e372…`, option B) selected the evidence-bound successor; the first preparation
  proposal (`be79f2e0`/tree `175f9917`) was reviewed REVISE_BEFORE_SOURCE_EFFECT
  (`09826c35…`) and this is its bounded correction: receipts embedded as machine-verified
  bytes (not prose SHAs), freshness enforced through the stock --check tools (not a historical
  hash alone), and the append placed after the complete original prefix.
- **Why disclosed:** a PR reader must be able to see that the citations that previously
  dangled on `46c8d1d5f78` now bind to real, byte-verified evidence — and that the missing
  historical objects are NOT claimed. The embedded receipts (source GO `56f33fd1…`, S1 GO
  `e011679d…`, ownership renewal `23575146…`, freshness results `114ced73…`, generation
  input `bf297320…`/after `d00ccc4c…`) pin each other's hashes and the live lineage
  identities; `verify.mjs` refuses missing/empty/malformed/altered/duplicate blocks.
- **Verification:** `node scripts/test-assurance/verify.mjs --stage S1 --step dispositions`
  (receipts + lineage + live freshness in one step), `--promote-gate` (carrier + flip
  control), and the hand replays in `replay-commands.md` §M15. The 46 story above (§4–§5) and
  every superseded entry remain byte-intact as history.
