# getff name-architecture freeze record

> **Authoritative for:** the npm name-architecture freeze for the getff beta program — which repo package publishes under which npm name, the CLI/init entrypoint mapping, the version floor, scope-ownership evidence, and the rollback doctrine. U10 cites this record without re-reading the R1 kickoff.
> **NOT authoritative for:** the design rationale of the beta program — see [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../superpowers/specs/2026-07-23-beta-program-design.md) §4 A6. The repo-wide `@rules-as-tests/*` → `@getff/*` rename execution — U9 (post-announce). The publish act itself — U10 (operator act, phase 2).

> **Produced by:** beta-delivery-ux R1 (stage PR, 2026-08-09). Absorbs U11 (name-freeze obligation).
> **Binding sources:** [`s6-u10-handoff.md`](../../.claude/orchestrator-prompts/launch-preannounce-track/s6-u10-handoff.md) §2–§5; [`beta-delivery-ux/kickoff.md`](../../.claude/orchestrator-prompts/beta-delivery-ux/kickoff.md) §0.1–§0.5.

---

## 1. The family — which repo package publishes under which npm name

Seven workspace packages measured at R1 entry (2026-08-09, all carry `"private": true`):

| repo package (`packages/*/package.json:name`) | version | R1 verdict | rationale |
|---|---|---|---|
| `@rules-as-tests/core` | `0.1.0` | **publish-as `@getff/core`** | the package R1 prepares for release (files allowlist, bin runnability, metadata). The rename `@rules-as-tests/core` → `@getff/core` is U9's per kickoff §0.3 — R1 does NOT execute it. U10 drops `private:true`. |
| `@rules-as-tests/lint-config` | `0.1.0` | **stays private** | internal ESLint shareable config; no consumer-facing publish intent declared. |
| `@rules-as-tests/meta-factory` | `0.1.0` | **stays private** | internal factory tooling (`peerDependency` on core, only script is `typecheck` per s6-u10-handoff.md §1). Never consumer-facing. |
| `@rules-as-tests/preset-next-15-canonical` | `0.1.0` | **deferred to U9** | preset may publish post-rename; out of R1 scope (kickoff §7). |
| `@rules-as-tests/preset-react-native` | `0.1.0` | **deferred to U9** | same. |
| `@rules-as-tests/preset-react-spa` | `0.1.0` | **deferred to U9** | same. |
| `@rules-as-tests-aif/runtime-bridge` | `0.0.1` | **stays private** | vendored subset (different scope `@rules-as-tests-aif/`); per CLAUDE.md capability-commit carve-out, a vendored copy adds no capability and stays internal. |

**The publish set at first release = `@getff/core` only** (after U9 rename + U10 `private:true` drop). Everything else stays private or is deferred.

## 2. `getff` (unscoped) = the CLI / init entrypoint

The unscoped name **`getff`** is the CLI/init entrypoint for the beta program.

- **Already reserved** in the npm registry: `npm view getff` → `0.0.1`, maintainer `artyhoo <yhooi2011@gmail.com>`, created `2026-06-23T07:50:39Z`, description "getff.ai — name reserved. Real release coming soon." (measured 2026-08-09, §4 below).
- **`getff init` maps to `./setup` today** — [`README.md:10`](../../README.md): "`getff init` (via `./setup`, see Installation) installs the enforcement layer (ESLint/husky/CI gates) into your TypeScript project".
- **Bin name:** `getff`.

### §0.5 gap — `bin: getff` does NOT exist in any package today (open deliverable, blocks U10)

U10's own gate is `npx getff init` ([`getff-to-prod-meta-launch/kickoff.md:98,154`](../../.claude/orchestrator-prompts/getff-to-prod-meta-launch/kickoff.md)). **No package with `bin: getff` exists in this repo** — `packages/core` ships six bins, all named `rules-as-tests-*`:

```text
$ git grep getff -- '*/package.json'
(no output — zero hits)
```

Spec A6 asks R1 for a name freeze, a `files` allowlist, bin runnability, metadata, and release notes — not a CLI package build. So R1 closes everything except the CLI package itself.

**This is an open deliverable blocking U10.** The `getff` CLI package's shape (new workspace package? re-point `packages/core`? a separate stage?) is **not resolved by R1** — it is parked per kickoff §9. U10 must either create a `bin: getff` package or re-point an existing bin before `npx getff init` can work.

## 3. Version floor

**`0.0.1` of `getff` is spent** — published 2026-06-23 by `artyhoo` (§4 evidence). `npm unpublish` is not a rollback (§5 below), so the first real release **cannot** be `0.0.1`.

**First real version: `0.1.0`** — rationale:
- Matches `packages/core` version (`0.1.0`), which is the package R1 prepares for release.
- `0.0.2` would imply a patch on the reservation placeholder, which misrepresents the jump from "name reservation" to "first real release".
- The binding input §4 says "Publish `0.1.0` (or the name-frozen equivalent)".

## 4. Scope-ownership evidence (measured 2026-08-09, re-measured at R1 entry)

### §4.1 The unscoped `getff` name — OURS, already in the registry

| probe | result | reading |
|---|---|---|
| `npm view getff` | **EXISTS — `0.0.1`**, maintainer `artyhoo <yhooi2011@gmail.com>`, created `2026-06-23`, 2 files / 393 B, description "getff.ai — name reserved. Real release coming soon." | the unscoped name is ours |
| `npm owner ls getff` | `artyhoo <yhooi2011@gmail.com>` | ownership confirmed — **same owner, not a different one** |
| `npm view @getff/core` | `E404 Not Found` | the scoped package is free |
| `npm view @getff/cli` | `E404 Not Found` | same |
| `npm view rules-as-tests` | `E404 Not Found` | the old name is free (not that we want it) |

### §4.2 The `@getff` scope — org EXISTS, ownership UNRESOLVED (U10 gate)

Measured 2026-08-09 with **unauthenticated** commands (these work with no login):

| probe | result | reading |
|---|---|---|
| `curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/-/org/getff/user` | `200` | the org **exists** |
| same URL for `babel` (control — known to exist) | `200` | control pair confirms `200` means «exists» |
| same URL for `zzqqxx-not-an-org-9931` (control — known not to exist) | `404` | control pair confirms `404` means «does not exist» |
| `curl -s 'https://registry.npmjs.org/-/v1/search?text=scope:getff&size=5'` | `{"objects":[],"total":0}` | nothing published under the scope yet |

**What is still open:** *whose* org `getff` is. That needs an authenticated read, and **npm auth is absent** on both the aif container and the operator host:

```text
$ npm whoami
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in.
```

**Status: `UNRESOLVED — needs `npm access list packages @getff` under an authed account; U10 gate`.**

This is **not a stop condition** for R1 (per kickoff §0.2): every R1 deliverable is name-independent (`npm i <tarball>` installs by path), and `private:true` is kept so nothing reaches the registry from this stage. Scope ownership first becomes load-bearing at **publish — U10**. Only a probe that returns a **different owner** is a stop (§11 of the kickoff); an unauthenticated probe is a recorded unknown, not a foreign scope.

**The exact command that closes this:** `npm access list packages @getff` (or `npm org ls getff`), under an authenticated account — `npm login`, an operator act.

## 5. Rollback doctrine (binding — restated verbatim from s6-u10-handoff.md §4)

> - **`npm unpublish` is NOT a rollback.** The 72h unpublish window is not a safety net for a shipped release; treat every publish as permanent.
> - **Roll forward with patch releases.** A bad `0.x.y` is fixed by `0.x.(y+1)`, never by unpublish.
> - **Consumers pin last-good.** The file-copy fallback path stays functional so a consumer can pin the previous known-good delivery while a patch ships.
> - Publish `0.1.0` (or the name-frozen equivalent) only after the S2 start cell is green on the tarball path.

**R1 implication:** the `files` allowlist + tarball matrix cell (R1 Deliverable 2) are the mechanism that makes "publish `0.1.0` only after the start cell is green" enforceable. The file-copy fallback (the existing `pnpm-monorepo-cell.sh`) must stay green alongside the new tarball cell — a `files` allowlist that breaks the file-copy path is a regression regardless of how green the tarball cell is.

## F-C′ resolution — bin runnability (decided inside R1 against the tarball matrix cell)

**Winner: option (a) tsx-dependency.** `tsx` (`^4.22.4`) promoted from `devDependencies` to `dependencies` in [`packages/core/package.json`](../../packages/core/package.json). All six bin targets already carry `#!/usr/bin/env -S npx tsx` shebangs, so once `tsx` is a runtime dep the installed bin resolves it via `node_modules/.bin/tsx` and the .ts loads. No build step, no `.js` shims, no `exports`/`bin` retargeting.

**Loser's concrete cost (T20 — record why (b) lost, not just why (a) won):** option (b) prebuild would add (i) a build step (e.g. `tsc --outDir dist`), (ii) `files:` entries for the emitted `dist/` output, (iii) re-targeting of every `bin:` and `exports:` entry from `.ts` → `.js`, (iv) a source-map + type-shipping decision, (v) ongoing drift risk between `.ts` source and the emitted `.js` that the cell would have to detect. None of that is in R1's scope. (a) wins because **the consumer-side cost is the same one-time install** (a runtime dep they pay either way) while the maintainer-side cost is zero — no new build pipeline.

**Cell evidence (paired RED→GREEN, kickoff §3 item 4) — MEASURED, and the first draft of this paragraph was falsified by the measurement:**

The cell at [`tests/consumer-matrix/npm-tarball-cell.sh`](../../tests/consumer-matrix/npm-tarball-cell.sh) step (7) runs `rules-as-tests-detect --help` AND a real `rules-as-tests-detect <fixture>` against the installed tarball. Step (7a) then asserts `tsx` is present in the fixture's `node_modules`.

| arm | `packages/core/package.json` | cell result |
|---|---|---|
| GREEN | `tsx` in `dependencies` (shipped state) | rc=0 — `✓ tsx present in fixture as a runtime dep: 4.23.12` |
| RED | `tsx` demoted back to `devDependencies` | rc=1 — `✗ FAIL: (7a) tsx NOT installed into the fixture …` |

> **Correction (2026-08-10, measured).** An earlier draft of this paragraph claimed: «without it (the prior state) the shebang fails to find `tsx` and the bin exits non-zero.» **That is false.** Demoting `tsx` and re-running the cell as originally written returned **rc=0** — the bin ran fine. The reason is in stderr: the shebang is `#!/usr/bin/env -S npx tsx`, and when `tsx` is absent `npx` **silently installs it from the network** — observed `npm warn exec The following package was not found and will be installed: tsx@4.23.12`, an **unpinned** fetch that ignores the declared `^4.22.4`, with `tsx` confirmed absent from the fixture's `node_modules`.
>
> So as first written, step (7) **could not fail for the fork it exists to decide** — «the bin ran» is true under both F-C′ options. That is `#contract-that-cannot-fail` ([destination-environment-verification.md §4](../../.claude/rules/destination-environment-verification.md)) landing on the one deliverable spec §11 bound to this cell, and kickoff §4 («decide against the cell, not against reasoning») is unsatisfiable without a discriminating assert. Step **(7a)** is that assert, and the table above is its two-direction proof.

**What the measurement changes about the verdict.** Option (a) still wins, but *not* for the reason first recorded. The real cost of NOT promoting `tsx` is not «the bin fails» — it is that every consumer's first bin invocation performs a **silent, unpinned, network-dependent install** of whatever `tsx` currently resolves to, which (i) breaks entirely offline / in an air-gapped or locked-down CI, (ii) ignores the version range the package declares, and (iii) is an unreviewed supply-chain fetch at *runtime* rather than at install time. Promotion to `dependencies` converts all three into a normal, lockfile-pinned install-time dependency. Option (b)'s costs (build step, `dist/` `files` entries, `bin`/`exports` retargeting, source-map + type-shipping decision, ongoing `.ts`↔`.js` drift risk) are unchanged and still out of R1 scope.

**Deferred runtime-dep gap (U10 follow-up — out of R1 scope):**

The cell step (7b) exercises the **three** bins whose import chains are satisfied by the package's declared `dependencies`: `rules-as-tests-detect`, `rules-as-tests-research`, `rules-as-tests-verify-provenance`.

The other **three** bins (`rules-as-tests-synth`, `rules-as-tests-validate`, `rules-as-tests-install`) transitively import `validator/gate-*.ts`, which `import 'eslint'` — currently a `devDependency`, not present in a tarball install. Their `.ts` files are present in the tarball (validated by step 4b: every `bin:` target resolves in the installed package), but the bins cannot actually execute in a consumer fixture until `eslint` (+ the `@typescript-eslint/*` family + `ts-morph`) are promoted to runtime deps OR prebuilt artifacts decouple the runtime from the typecheck-time deps.

**Ruling:** promoting `eslint` + the `@typescript-eslint/*` family + `ts-morph` to runtime deps for a `0.1.0` beta was ruled out as disproportionate scope expansion at R1 entry — it would bloat the install with test-runner machinery that most consumers won't invoke, and the bin `rules-as-tests-validate` is the only one that needs it at runtime. This is therefore **deferred to U10** (or to a prebuild-based resolution in U9). The deferral is recorded here so U10 doesn't rediscover it.

> **U10 WARNING — the gap is deeper than a dependency-tier move. Measured 2026-08-10, cold backward sweep.**
> Promoting `eslint` and friends to `dependencies` is **necessary but not sufficient**. Four shipped validator gates statically import a package that **can never be published as things stand**:
>
> | shipped file (in the tarball) | import | target |
> |---|---|---|
> | `validator/gate-tautology.ts:15` | `@rules-as-tests/preset-next-15-canonical/eslint-rules` | `private: true` |
> | `validator/gate-conflict.ts:21` | same | `private: true` |
> | `validator/gate-rule-tester.ts:22` | same | `private: true` |
> | `validator/gate-message-id-coverage.ts:21` | same | `private: true` |
>
> Verified: `packages/preset-next-15-canonical/package.json` and `packages/preset-react-spa/package.json` both carry `"private": true`, and `npm pack --dry-run` from `packages/core` **does** list `validator/gate-tautology.ts` and `validator/gate-rule-tester.ts` — so the importing files ship while the imported package cannot. `rules-as-tests-validate` is therefore unrunnable from a published tarball even with every dev-dependency promoted.
>
> **U10 must pick one** (R1 does not — it is out of scope per kickoff §7, «no package outside `packages/core`»): (a) publish the presets too, (b) make the preset imports dynamic with a documented degrade, mirroring the existing `ts-morph` pattern at `install/wire-eslint-r2.ts:115-143`, or (c) drop those gates from the `files` allowlist and accept `validate` as a repo-internal bin.
>
> Related and also out of R1 scope: `packages/core` declares **no** `peerDependencies` while all four publishable-intent siblings do (`preset-react-spa/package.json:11`, `meta-factory/package.json:13`). Whichever option U10 picks, the peer-tier decision travels with it.

**Consequence for `files` validation coverage:**

Four of the fourteen entries are **transitively needed by the three deferred bins** but are NOT RED-provable by this cell (the runnable bins don't reach them). They are kept in the `files` list with the marking **`UNVALIDATED-by-this-cell — transitively-needed by synth/validate/install bins whose runtime-dep gap is deferred to U10`** per kickoff §9 (park-don't-guess: surface the gap, don't drop the entry). Dropping them would silently break those three bins when their runtime-dep gap is later closed. Which four is a **measured** fact, not an inferred one — see the table below.

## `files` allowlist — measured paired-RED evidence (kickoff §3 item 4, acceptance §6 item 2)

**Method (T2 counter — the arms were RUN, not reasoned about).** For each of the 14 `files` entries: drop that one entry from `packages/core/package.json`, re-run `bash tests/consumer-matrix/npm-tarball-cell.sh` unchanged, record exit code and the first `✗ FAIL` line. Restore, repeat. 14 arms, host `Darwin`, 2026-08-10, against branch tip. The GREEN column is the honest half: an entry whose removal leaves the cell passing is an entry **this cell does not validate** (T14 — "coverage insufficient to conclude", not "entry justified").

| `files` entry | arm result | the assert that caught it |
|---|---|---|
| `manifest/` | **RED** rc=1 | (3) manifest JSON not loadable or empty — the package main is broken |
| `eslint-rules/` | **RED** rc=1 | (4) file `eslint-rules/index.ts` missing from installed package |
| `detector/` | **RED** rc=1 | (4c) one or more exports targets missing |
| `research/` | **RED** rc=1 | (4c) one or more exports targets missing |
| `synthesizer/` | **RED** rc=1 | (4c) one or more exports targets missing |
| `installer/` | **RED** rc=1 | (4c) one or more exports targets missing |
| `diagnostics/` | **RED** rc=1 | (7b) `rules-as-tests-research` import chain failed to load |
| `templates/` | **RED** rc=1 | (4) directory `templates/` missing from installed package |
| `install/` | **RED** rc=1 | (4) file `install/synth-and-wire.bundle.mjs` missing |
| `skills/` | **RED** rc=1 | (4) directory `skills/` missing from installed package |
| `validator/` | GREEN rc=0 | — **UNVALIDATED-by-this-cell** |
| `ir/` | GREEN rc=0 | — **UNVALIDATED-by-this-cell** |
| `backends/` | GREEN rc=0 | — **UNVALIDATED-by-this-cell** |
| `composition/` | GREEN rc=0 | — **UNVALIDATED-by-this-cell** |

**10 validated / 4 unvalidated.** The unvalidated four are `validator/`, `ir/`, `backends/`, `composition/` — all reached only through the `synth` / `validate` / `install` bins, whose `import 'eslint'` chain cannot execute from a tarball install (the deferred runtime-dep gap above). They stay in `files` because dropping them breaks those bins the moment U10 closes that gap.

> **Correction (2026-08-10, measured).** An earlier draft of this record named the unvalidated four as «`ir/`, `backends/`, `composition/`, + the validator-internal slice of `diagnostics/`». The arms falsify that split: `diagnostics/` **is** RED-validated (step 7b — the research bin's import chain reaches it), and `validator/` is unvalidated **in whole**, not as a slice of another entry. The count (10/4) was right; the membership was inferred rather than measured. Kept visible rather than silently rewritten, per T3.

## Over-ship — before / after (kickoff §6 acceptance item 8)

Recorded here, not only in the stage PR body, because kickoff §6 item 7 requires this record to be **self-contained for U10** and the PR body is not what U10 reads.

| state | `npm pack --dry-run` total files | source |
|---|---|---|
| **before** — no `files` key | **707** | host measurement at R1 entry, 2026-08-09 (kickoff §1 records 549 at S6 / 2026-07-11 and 711 in-container the same day — three machines, three numbers, which is why the entry re-measurement is mandatory) |
| **after** — 14-entry `files` allowlist | **494** | host, 2026-08-10, printed by the cell itself: `✅ consumer-matrix npm-tarball cell: GREEN (494 files in tarball)` |

Δ = **−213 files (−30%)**. The number is emitted by every cell run (`files in tarball: …`), so it is a live figure, not a frozen claim — a future `files` edit that re-inflates the tarball shows up in CI output without anyone re-measuring by hand.

## Package-metadata decisions (kickoff §5 — «say which you chose»)

| item | choice | why |
|---|---|---|
| `packages/core/README.md` | **stub**, not a full README | kickoff §5 permits either. A stub pointing at [`README.md#why-this-exists`](../../README.md#why-this-exists) keeps one source of truth for the project narrative; a full copy would be a `#sync-by-copy-paste` twin with no regenerating mechanism ([dual-implementation-discipline.md §8](../../.claude/rules/dual-implementation-discipline.md)). Revisit at U10 if the npm package page needs standalone framing. |
| `packages/core/LICENSE` | **real file copy** of root `LICENSE.md`, not a symlink | kickoff §5: symlinks do not survive `npm pack` reliably. Arrival is **gated**, not just verified once: `LICENSE` and `README.md` are asserted in the cell's by-path asset loop ([`npm-tarball-cell.sh`](../../tests/consumer-matrix/npm-tarball-cell.sh) step 4). Neither is in `files` — npm auto-includes both — so the gate is what notices if that behaviour ever changes. |
| `main` | **unchanged** — `./manifest/rules-manifest.json` | kickoff §5 says confirm, do not silently change. Confirmed intentional (binding input §2); the tarball cell step (3) is the regression guard. |
| `engines.node` | `>=22` | matches the `node-version: '22'` pin every CI workflow uses. |

## What the tarball cell does NOT assert (T14 — stated, not implied)

**It does not fire a rule.** The cell asserts that the shipped rule **definitions arrive** (manifest entries + `eslint-rules/` modules). Firing needs `eslint` plus a TS-aware config loader inside the fixture, and neither is present in a tarball install — the same runtime-dep gap recorded above for the `synth` / `validate` / `install` bins.

**It does not run the install flow.** Step (5) asserts the shipped `install/synth-and-wire.bundle.mjs` arrived **intact** (`node --check` + entry guard + tail export), not that installing works. The real flow runs through [`setup.d/99-finalize.sh:25`](../../setup.d/99-finalize.sh), and the sibling cell exercises it end-to-end. Three weaker forms were measured and rejected on 2026-08-10: `readFileSync().length > 100` passes on any file over 100 bytes (`#contract-that-cannot-fail` — this was the shipped form and is why step (5) was rewritten); `await import()` throws regardless of integrity, because the bundle has a module-level side effect opening `install/research-plan.schema.json` relative to cwd, even though its `process.argv[1]` self-guard correctly suppresses `main()`; and `node --check` alone passes on a 200-byte head of the bundle (a 50 KB head fails), so it needs the entry-guard + tail-export greps beside it.

«At least one rule actually firing» (binding input §3 item 2) is carried by the **sibling cell on the file-copy channel**: [`tests/consumer-matrix/pnpm-monorepo-cell.sh`](../../tests/consumer-matrix/pnpm-monorepo-cell.sh) step (d-1) plants an `OrderSchema.parse(req.body)` violation and asserts `eslint rc=1` carrying the R2 message, with (d-2) proving the lint-staged shield blocks it. Both cells are merge-blocking via `ci-success needs:` and both are declared in the R1 kickoff's `host-verify` contract, so the pair covers **arrival** (tarball channel) + **firing** (file-copy channel).

The residual uncovered class is «a rule that works file-copied and breaks tarball-installed». Rule modules are plain ESLint rule objects whose behaviour does not depend on delivery channel, and their arrival is RED-proven above, so this class is not reachable by any assert the tarball cell could add short of promoting `eslint` to a runtime dependency — ruled out at R1 entry as disproportionate for a `0.1.0` beta. Recorded here rather than papered over.

## Release-drafter tag→notes flow

**Verified config** at [`.github/release-drafter.yml`](../../.github/release-drafter.yml) + [workflow](../../.github/workflows/release-drafter.yml):

- **autolabeler** runs on `pull_request` (opened/reopened/synchronize/edited) and maps the PR title's conventional-commit prefix to a `type: *` label: `feat` → `type: feature`, `fix` → `type: fix`, `docs` → `type: docs`, `ci` → `type: ci`, `chore` → `type: chore`, `<anything>!` → `type: breaking`.
- **update_release_draft** runs on `push` to `staging` (i.e. PR merge) and regroups all labelled PRs since the last published release into a draft GitHub release, categorised per the `categories:` block.
- **`name-template`/`tag-template`:** both `v$RESOLVED_VERSION`. The version resolver bumps **major** on `type: breaking`, **minor** on `type: feature`, and patch on everything else.

**Tag flow for `@getff/core` 0.1.0** (the first real release, post-U10):

1. U10 merges to `staging` (the `private:true` drop + the `@getff` rename + the publish itself). The merge commit triggers `update_release_draft`, which appends every labelled PR since the last release to the draft body.
2. Maintainer reviews the draft, edits if needed, and clicks **Publish release**. Release-drafter then creates the `v0.1.0` tag against the merge SHA (operator act — `git tag`/publish are operator acts per the §7 of the R1 kickoff).
3. The published release body enumerates the PRs by category. R1's commits (per the plan): `docs(beta-delivery-ux): R1 name-architecture freeze record...` → Documentation, `feat(beta-delivery-ux): npm-tarball consumer-matrix cell + files allowlist + bin runnability F-C′ resolved (A6)` → Features, `feat(beta-delivery-ux): packages/core npm metadata + release-drafter flow verified` → Features, `ci(beta-delivery-ux): wire npm-tarball cell merge-blocking via ci-success needs:` → CI.

**No config change required** for R1: the existing autolabeler covers all five conventional prefixes the commit plan uses. `feat(...) !:` would mark a breaking change — none of R1's commits use it.

---

*Record location rationale: this file lives at `docs/meta-factory/` (the canonical project docs surface) rather than under `.claude/orchestrator-prompts/beta-delivery-ux/` because it must outlive this branch/PR and be discoverable by U10 without knowing which stage produced it. The `docs/meta-factory/` surface is where prior-art-evaluations, research-patches, and retros live — the same "canonical, cited-by-future-work" class.*
