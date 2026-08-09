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

```
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

```
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

**Cell evidence (paired RED→GREEN, kickoff §3 item 4):**

The cell at [`tests/consumer-matrix/npm-tarball-cell.sh`](../../tests/consumer-matrix/npm-tarball-cell.sh) step (7) runs `rules-as-tests-detect --help` AND a real `rules-as-tests-detect <fixture>` against the installed tarball, with output quoted in the PR body. With `tsx` as a runtime dep the bin executes end-to-end; without it (the prior state) the shebang fails to find `tsx` and the bin exits non-zero.

**Deferred runtime-dep gap (U10 follow-up — out of R1 scope):**

The cell step (7b) exercises the **three** bins whose import chains are satisfied by the package's declared `dependencies`: `rules-as-tests-detect`, `rules-as-tests-research`, `rules-as-tests-verify-provenance`.

The other **three** bins (`rules-as-tests-synth`, `rules-as-tests-validate`, `rules-as-tests-install`) transitively import `validator/gate-*.ts`, which `import 'eslint'` — currently a `devDependency`, not present in a tarball install. Their `.ts` files are present in the tarball (validated by step 4b: every `bin:` target resolves in the installed package), but the bins cannot actually execute in a consumer fixture until `eslint` (+ the `@typescript-eslint/*` family + `ts-morph`) are promoted to runtime deps OR prebuilt artifacts decouple the runtime from the typecheck-time deps.

**Ruling:** promoting `eslint` + the `@typescript-eslint/*` family + `ts-morph` to runtime deps for a `0.1.0` beta was ruled out as disproportionate scope expansion at R1 entry — it would bloat the install with test-runner machinery that most consumers won't invoke, and the bin `rules-as-tests-validate` is the only one that needs it at runtime. This is therefore **deferred to U10** (or to a prebuild-based resolution in U9). The deferral is recorded here so U10 doesn't rediscover it.

**Consequence for `files` validation coverage:**

The four code directories `ir/`, `backends/`, `composition/`, and the validator-internal slice of `diagnostics/` are **transitively needed by the three deferred bins** but are NOT RED-provable by this cell (the runnable bins don't reach them). They are kept in the `files` list with the marking **`UNVALIDATED-by-this-cell — transitively-needed by synth/validate/install bins whose runtime-dep gap is deferred to U10`** per kickoff §9 (park-don't-guess: surface the gap, don't drop the entry). Dropping them would silently break those three bins when their runtime-dep gap is later closed.

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
