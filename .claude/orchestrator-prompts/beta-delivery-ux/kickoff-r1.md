<!-- scope: stage kickoff — beta-delivery-ux R1 (npm release mechanics, spec A6, absorbs U10-prep + U11). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-delivery-ux-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker): top tier plans, executor implements + reviews. -->

# beta-delivery-ux R1 — npm release mechanics (A6)

> **Type:** execution-build (packaging + one new matrix cell), single PR onto `staging`.
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §4 **A6** (`:278-284`) + §11 fork **F-C′** (`:467-468`) are the design SSOT. On any divergence
> between this kickoff and the spec, **the spec wins** — surface the divergence, never improvise
> past a binding decision.
> **Binding input (read in full before scoping anything):**
> [`../launch-preannounce-track/s6-u10-handoff.md`](../launch-preannounce-track/s6-u10-handoff.md)
> — §2 publish-readiness audit + the recommended `files` allowlist marked «VALIDATE before
> trusting», §3 step-3 wiring facts, §4 rollback doctrine (**binding**), §5 one-command publish
> target. Its §0 dependency graph is partly SUPERSEDED — see §0.4 below.
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) §2 row R1 (`:47`) +
> [`../beta-delivery-ux-meta-launch/kickoff.md`](../beta-delivery-ux-meta-launch/kickoff.md) `:262-268`.
> **Base branch:** `staging`.

## §0 Entry facts + binding decisions (measured 2026-08-09 — re-verify every one at entry)

### §0.1 Dispatch verdict — R1 IS aif-dispatchable, and the guard is mechanical

R1 performs **no registry-visible act**. `npm publish` is out of scope (spec A6: «publish itself
stays an operator act in phase 2»), and the thing that makes that a *mechanism* rather than a
reminder is:

> **BINDING: `packages/core/package.json` keeps `"private": true` for the whole of R1.**
> npm refuses to publish a `private:true` package. Do NOT drop it. The drop is U10's single line.

Measured evidence that this does not block the stage: `npm pack --dry-run` **works on a
`private:true` package** — run at authoring from `packages/core/`, it produced
`rules-as-tests-core-0.1.0.tgz` (707 files, 1.2 MB packed, 4.8 MB unpacked). So the whole
tarball-validation loop runs with the publish guard armed. This is the
[`attention-is-not-a-mechanism.md §1`](../../rules/attention-is-not-a-mechanism.md) posture:
«the worker will remember not to publish» is not a detection layer; `private:true` is.

**Read-only registry queries (`npm view …`) are allowed and expected. `npm publish`,
`npm unpublish`, `npm deprecate`, `npm owner`, `npm access` (write forms), and `npm version`
with a git tag are FORBIDDEN in this stage** — see §7.

### §0.2 The name is already frozen IN THE REGISTRY — measured, not assumed

`npm view` at authoring (2026-08-09):

| query | result |
|---|---|
| `getff` | **EXISTS — `0.0.1`**, maintainer `artyhoo <yhooi2011@gmail.com>`, created `2026-06-23T07:50:39Z`, description «getff.ai — name reserved. Real release coming soon.», 2 files / 393 B |
| `@getff/core` | `E404` |
| `@getff/cli` | `E404` |
| `rules-as-tests` | `E404` |

Three consequences that shape this stage:

1. **The unscoped `getff` name is OURS already.** U11's inherited gate («имена заморожены ДО
   публикации») is satisfied on the registry side for the CLI name. R1's job is to align the
   *repo* to that fact and record the family, not to re-open the choice.
2. **`0.0.1` is spent.** The first real release cannot be `0.0.1` — it is already published and
   `npm unpublish` is not a rollback (binding input §4). Record the version floor.
3. **`@getff` scope ownership is UNPROVEN.** A 404 on `@getff/core` proves the *package* is free,
   **not** that the *scope* is ours. **Entry probe (run it, quote the output):**
   `npm access list packages @getff` or `npm org ls getff`. If the scope is not ours →
   **STOP and park** (§9); do not invent a fallback scope.

### §0.3 What R1 does NOT do — the rename is U9's

**BINDING: R1 does NOT execute the repo-wide `@rules-as-tests/*` → `@getff/*` rename.**

- Umbrella [`kickoff.md:57-58`](kickoff.md) §3 puts «U9 repo split / bridge npm packaging» **out
  of scope (post-announce)**.
- Blast radius measured at authoring: `git grep -l "@rules-as-tests/core"` → **33 tracked files
  / 55 occurrences** (18 `.md`, 8 `.ts`, 7 `.json`); `@rules-as-tests` anywhere → 60 files.
  Renaming the manifest alone breaks every workspace import and the `meta-factory` peerDep.
- The acceptance gate is **name-independent**: `npm i <tarball>` installs by path, so the matrix
  cell validates `files` + bin runnability under either name.
- U11's obligation is that names are **frozen** (decided + recorded), not **executed**.

So R1 ships a *binding name-architecture record* (§2), not a rename commit.

### §0.4 Divergences from the binding input — recorded, do not re-derive

`s6-u10-handoff.md` was written 2026-07-11 against a dependency graph that the 2026-07-23 spec
amendment changed. Two of its §0 gates no longer hold as written:

- **§0.2 «U9 repo-split is the natural window»** — SUPERSEDED.
  [`../getff-to-prod-meta-launch/kickoff.md:66,97`](../getff-to-prod-meta-launch/kickoff.md)
  now reads «post-announce; no longer gates U10 (2026-07-23)», and `:98` gates U10 on
  **beta-delivery-ux R1** instead. The exports-narrowing remainder (`./research`,
  `./synthesizer`, `./installer`) therefore stays with U9 and is **out of R1's scope** (§7).
- **§0.3 «drop `private:true` in the same commit as the name-freeze»** — SUPERSEDED by §0.1.
  Its stated invariant («the package is never publishable under the wrong name») is satisfied
  *more strongly* by keeping `private:true` through R1: there is then no window at all in which
  the package is publishable. The drop travels with U10.

Everything else in that handoff — §2 audit method, §2 allowlist + its CAVEAT, §3 step-3 facts,
§4 rollback doctrine, §5 publish target — is **binding and current**.

### §0.5 Honest gap R1 does NOT close (surface it, do not fix it here)

U10's own gate is `npx getff init` ([`../getff-to-prod-meta-launch/kickoff.md:98,154`](../getff-to-prod-meta-launch/kickoff.md)).
**No package with `bin: getff` exists in this repo today** — `packages/core` ships six bins, all
named `rules-as-tests-*`, and `git grep getff -- '*/package.json'` returns nothing. Spec A6 does
not ask R1 to build a CLI package; it asks for a name **freeze**, a `files` allowlist, bin
runnability, metadata, and release notes. So R1 closes everything except the CLI package itself.

**Obligation:** the §2 record MUST state, explicitly, where `bin: getff` will live and what
`getff init` maps to (today `./setup` — [`README.md:10`](../../../README.md)), and MUST name
this as an open deliverable blocking U10. Do **not** build that package in R1 (§7).

## §1 Inputs (re-verify at entry — the numbers above are snapshots)

- **`packages/core/package.json`** — at authoring: `name: "@rules-as-tests/core"`,
  `version: "0.1.0"`, `private: true`, `type: "module"`, `main: "./manifest/rules-manifest.json"`,
  **no `files`**, **no `description`**, **no `repository`**, **no `engines`**,
  `license: "FSL-1.1-ALv2"`, 7 `exports` subpaths, 6 `bin` targets **all pointing at `.ts`**.
- **`tsx` is already a devDependency of `packages/core`** (`^4.22.4`) — load-bearing input to
  F-C′ (§4): the tsx path is a `devDependencies`→`dependencies` promotion, not a new dep.
- **No `packages/core/README.md`, no `packages/core/LICENSE*`** — repo root has
  [`LICENSE.md`](../../../LICENSE.md) only. Confirm both at entry (`ls packages/core/`).
- **Over-ship has GROWN since the binding input measured it.** S6 (2026-07-11): 549 files /
  842.6 kB packed / 3.24 MB unpacked. Measured 2026-08-09: **707 files / 1.2 MB / 4.8 MB**.
  Re-measure at entry and use YOUR number — do not quote 549.
- **Consumer-matrix cells that already exist** (the sibling shape to copy):
  [`tests/consumer-matrix/pnpm-monorepo-cell.sh`](../../../tests/consumer-matrix/pnpm-monorepo-cell.sh)
  and `python-unfamiliar-stack-cell.sh`; CI jobs at
  [`.github/workflows/audit-self.yml:1494`](../../../.github/workflows/audit-self.yml) and `:1538`,
  both wired into the merge-blocking `ci-success` aggregate at `:1604` and `:1610`; local runner
  [`Makefile:34`](../../../Makefile).
- **Release-drafter is already wired** — [`.github/release-drafter.yml`](../../../.github/release-drafter.yml)
  (`tag-template: v$RESOLVED_VERSION`, label-driven categories + embedded autolabeler) and
  [`.github/workflows/release-drafter.yml`](../../../.github/workflows/release-drafter.yml).
  A6 says «release notes via the **existing** release-drafter» — this is a *verify + document*
  item, not a rebuild (§5).

## §2 Deliverable 1 — the name-architecture freeze record (absorbs U11)

A tracked markdown record (place it under this umbrella dir or `docs/meta-factory/` — your call,
record why) that freezes and is thereafter cited by U10:

1. **The family** — which repo package publishes under which npm name. Minimum rows: the six
   workspace packages (`git grep -h '"name"' packages/*/package.json`) each get a verdict of
   `publish-as <name>` / `stays private` / `deferred to U9`.
2. **`getff` (unscoped) = the CLI/init entrypoint**, already reserved (§0.2). State the bin name
   and the `getff init` → `./setup` mapping, plus the §0.5 gap: the package does not exist yet.
3. **Version floor** — `0.0.1` of `getff` is spent; state the first real version and why.
4. **Scope-ownership evidence** — quote the §0.2 entry-probe output verbatim.
5. **Rollback doctrine restated as binding** (binding input §4): unpublish is not a rollback;
   roll forward with patch releases; the file-copy fallback stays live so consumers pin last-good.

**This record is the U11 deliverable.** It must be readable by U10 without re-reading this kickoff.

## §3 Deliverable 2 — `files` allowlist, validated by a REAL tarball matrix cell

**The allowlist is not the deliverable; the cell that proves it is.**

`s6-u10-handoff.md §2` hands you a recommended allowlist **explicitly marked «VALIDATE before
trusting»**, and states its own known blind spot: an import-closure allowlist **misses by-path
assets** (`templates/`, `skills/`, `install/synth-and-wire.bundle.mjs`, manifest JSON loaded by
path), and `composition/` was never reached by the closure at all. **Do not ship that list as
given.** Derive → pack → install → run → adjust.

**Build the cell** at `tests/consumer-matrix/npm-tarball-cell.sh` (this exact path is binding —
the §6 host-verify contract names it), following the sibling cells' shape:

1. `npm pack` `packages/core` → a tarball.
2. `npm i <tarball>` into a **fresh fixture** (no registry needed).
3. Run the real consumer path against the installed package — the install flow + at least one
   rule actually firing, per the binding input §3 item 2 («the matrix cell is the only honest
   check that they arrived»).
4. **Paired RED→GREEN, per file class.** For each asset class you add to `files`, prove the cell
   **fails without it** and passes with it. A `files` entry with no failing-without-it evidence
   is an unvalidated guess — that is the whole reason S6 refused to add `files` blind.
5. **The file-copy fallback must pass the same cell** (binding input §3 item 3 + §4). If the cell
   cannot exercise both paths, say so explicitly rather than claiming coverage you lack (T14).

**Wire it merge-blocking** the way its siblings are: a job in `audit-self.yml` **and** a line in
the `ci-success` `needs:` list (`:1604`/`:1610` are the precedent). A cell that can go RED while
`ci-success` stays green is `#warning-nobody-reads` — the workflow's own comments at `:1605-1609`
say exactly this. Add it to `Makefile` `consumer-matrix` too.

## §4 Deliverable 3 — bin runnability (fork F-C′, RESOLVE in-stage, do NOT park)

Spec §11 (`:467-468`): «**F-C′ — bin runnability** (tsx dependency vs prebuild): decided **inside
R1** against the tarball matrix cell; input = S6 audit facts.» This is a binding instruction to
decide — it is the one fork in this stage that is explicitly **not** parkable.

All six bins point at `.ts` (`packages/core/package.json`), so under plain `node` an installed bin
does not run (binding input §2). The two candidates and the decision procedure:

- **(a) tsx dependency** — promote `tsx` from `devDependencies` to `dependencies` (it is already
  `^4.22.4` there) and/or ship shims that invoke it. Cost: a runtime dep on every consumer.
- **(b) prebuild** — compile `.ts` → `.js` into the tarball. Cost: a build step + `files` entries
  for the emitted output + `exports`/`bin` retargeting.

**Decide against the §3 cell, not against reasoning.** Acceptance for this deliverable is: the
cell installs the tarball and **executes at least one bin end-to-end**, with the command and its
output quoted. Record the losing option and the concrete cost that lost it (T20).

## §5 Deliverable 4 — package metadata + release notes

Close the gaps the binding input §2 enumerates, each verified in the packed tarball (not just in
the manifest):

- `packages/core/README.md` — absent today; the npm package page would be blank. A stub pointing
  at the repo is acceptable; say which you chose.
- `LICENSE` inside the package — `license: "FSL-1.1-ALv2"` is declared but no LICENSE file lives
  in `packages/core`. Copy it in (a symlink will not survive `npm pack` reliably — verify which
  you get, in the tarball, with `tar tzf`).
- `description`, `repository` — both absent.
- `main: "./manifest/rules-manifest.json"` — the binding input calls this intentional and
  harmless. **Confirm it, do not silently change it.**
- **Release notes** — A6 says «via the existing release-drafter». Verify the existing config
  produces sane notes for a release of this package and document the tag→notes flow in the §2
  record. If a config change is genuinely required, make it minimal and justify it; do **not**
  rebuild the release pipeline.

## §6 «Works» — acceptance (evidence quoted in the PR body)

1. **The tarball cell is green on the host** and merge-blocking (`ci-success needs:` line cited).
2. **Every `files` entry carries paired RED→GREEN evidence** (§3 item 4), or is explicitly marked
   as unvalidated with the reason.
3. **At least one bin runs from the installed tarball** — command + output (F-C′ resolved).
4. **File-copy fallback passes the same cell**, or the gap is stated (§3 item 5).
5. **`packages/core/package.json` still has `"private": true`** — `git diff` proves it untouched.
6. **Nothing was published.** No registry write occurred; state it and show the guard.
7. **The §2 record exists and is self-contained** for U10, including the §0.5 gap.
8. **The over-ship number moved** — quote before/after file counts from `npm pack --dry-run`.

### §6.1 Host-verification contract ([`destination-environment-verification.md §1`](../../rules/destination-environment-verification.md))

A tarball's file list, its bin runnability, and `npm pack`'s symlink handling all differ by
machine — this is exactly the container≠host surface that rule exists for. **No opt-out.**
Run before accepting:
`bash scripts/host-verify.sh .claude/orchestrator-prompts/beta-delivery-ux/kickoff-r1.md`

```bash host-verify
bash tests/consumer-matrix/npm-tarball-cell.sh
bash tests/consumer-matrix/pnpm-monorepo-cell.sh
```

The second line is not padding: it is the file-copy fallback path the §4 rollback doctrine
requires to stay functional, and it is the existing merge-blocking start cell — a `files`
allowlist that breaks it is a regression regardless of how green the new cell is.

## §7 Out of scope (do NOT do these here)

- **`npm publish` / `npm unpublish` / `npm deprecate` / `npm owner` / `npm access` (write forms) /
  `npm version` with a git tag.** Publish is U10, an operator act, phase 2.
- **Dropping `private: true`.** U10's single line (§0.1).
- **The repo-wide `@rules-as-tests/*` → `@getff/*` rename** — U9, post-announce (§0.3).
- **Finishing the `exports` narrowing** (`./research`, `./synthesizer`, `./installer`) — it needs
  the `meta-factory` shim rewire, which is U9's (§0.4).
- **Building the `getff` CLI package** — record the gap (§0.5), do not build it.
- **Publishing any other workspace package.** R1 touches `packages/core` packaging only.
- S1-S5 surfaces: install profiles, presets/status/`getff work`, tier-home doc, GLM one-button,
  contour-skill wiring, runtime-bridge vendoring.
- Killer-layer code (track 1 owns); docs-site work (umbrella B); AGENTS.md content (umbrella C).

## §8 AI-laziness traps ([`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T2, T3, T10, T12, T14, T19, T20, T21.**

- **T2** — designing ≠ auditing. An allowlist *derived* is not an allowlist *validated*. If you
  write «the cell would catch a missing asset», replace it with the cell's actual RED output.
- **T3** — every «works» claim carries command + output. `npm pack --dry-run` counts, `tar tzf`
  listings, the cell's exit code — never prose.
- **T10** — enumerate the population before sampling it. The tarball's **full** file list is the
  population; «I checked that templates/ arrived» over an unenumerated 707-file tarball is a
  meaningless coverage claim.
- **T12** — do not size the `files` list from training-data familiarity with npm packaging.
  The binding input's own list is marked unvalidated; yours must be earned from the cell.
- **T14** — a green cell with thin asserts is «coverage insufficient to conclude», not «packaging
  correct». State which asset classes the cell actually exercises and which it does not.
- **T19** — own adversarial cold-QA of the diff before handoff. CI ≠ design review.
- **T20** — every verdict (F-C′ winner, each `files` entry, the version floor, the scope-ownership
  call) carries file:line or command output.
- **T21** — the Backward-check enumerates **sibling surfaces**, not the diff (§10).
- **T-BDU-R1-A (domain)** — «the tarball is correct because `npm pack` succeeded». `npm pack`
  succeeds on a tarball that ships 707 files including every test, and it succeeds on one whose
  `files` list silently drops a by-path asset — **it cannot fail on either**. The packing command
  is not a gate; only installing the tarball into a fixture and running the real consumer path is.
  Any claim about packaging correctness sourced from `npm pack` output alone is this trap.
- **T-BDU-R1-B (domain)** — «the name is decided because the spec says `@getff`». The spec names
  a family; the **registry** is the authority on what is actually available and owned, and it
  disagreed with the naive reading at authoring time (unscoped `getff` already exists, published
  by us). Re-probe the registry at entry; never treat a name as free because a doc used it.

## §9 Park-don't-guess contract (BINDING — this task may run autonomously)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
> `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
> Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep
> moving" is the failure this whole loop exists to prevent.

**PARK these — do not guess:**

- **`@getff` scope not ours** (§0.2 probe fails) → park; do not invent a fallback scope.
- **A `files` entry that the cell can neither prove nor disprove** (e.g. an asset only a consumer
  flow you cannot run would load) → park that entry, ship the rest, name the untested class.
- **Any change that would require dropping `private: true`** → park. That is the tripwire.
- **Any change that would require touching a package outside `packages/core`** → park; that is
  U9's boundary being crossed.
- **The `getff` CLI package's shape** (new workspace package? re-point `packages/core`? a
  separate stage?) → park with options; §0.5 says record the gap, not resolve it.

**RESOLVE these — they are yours, not parks:**

- **F-C′ bin runnability** — spec §11 binds the decision to this stage (§4). Parking it is a
  spec violation; decide it against the cell and record the cost that decided it.
- The cell's fixture shape, assert structure, and job wiring (follow the sibling cells).
- Where the §2 record lives, and README stub vs full README (record why).

## §10 PR-body requirements (both gates are REQUIRED checks on `staging`)

This stage touches `packages/core/package.json`, a new `tests/consumer-matrix/**` cell,
`.github/workflows/audit-self.yml`, and a tracked decision record → **the §1.7 mandate is ON**.

**Required sections — H3 depth (`###`), the word «applied» is required, ≥40 non-whitespace chars
in EACH body, ≥1 `path.ext:N` citation per section:**

```markdown
### §1.7 Forward-check applied

<which existing disciplines were checked, with file:line evidence>

### §1.7 Backward-check applied

<sibling-surface sweep — see below>
```

**T21 — the Backward-check is where this stage will fail if you rush it.** Class of this change =
*packaging/publish surfaces + merge-blocking matrix cells*. Enumerate sibling surfaces the diff
did NOT touch and verdict each (`SWEPT-CLEAN(evidence)` / `GAP-FOUND(action)`): the other six
workspace `package.json` files, the existing two consumer-matrix cells, `ci-success needs:` as a
whole, `Makefile`, `.husky/pre-push` (it runs the start cell), the release-drafter config, the
plugin channel, `install.sh`/`setup.d/**` (the file-copy delivery path this stage must not break).
**A Backward-check whose surface list equals your own diff's file list is non-conformant by
format.** Delegate it cold to [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md).

**Also required: a `## Fidelity verdict` section.** `fidelity-verdict-in-pr-body` is a REQUIRED
staging check. **`FIDELITY: skipped` is NOT available to this PR** — it is a stage PR. It needs a
real GO block from a cold [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) run:
`FIDELITY: GO` + `Basis:` + `Round:` + `Audited-SHA:` (12–40 hex, must prefix the PR head SHA at
merge time) + ≥1 file:line evidence on a line other than `Basis:`. Exactly one such section,
exactly one `FIDELITY:` line — a rework round REPLACES the block, never appends.

**Prior-art trailer:** the new matrix cell is likely a capability commit (a new ≥80-LOC file under
`packages/`? no — under `tests/`; check the [CLAUDE.md](../../../CLAUDE.md) triggers against your
actual diff). If the hook fires, cite the SSOT properly; the escape hatch needs a ≥20-char *why*.

**Pre-flight before `gh pr create`** (compose the body first, then check):

```bash
echo "$PR_BODY" | grep -cE '^### §1\.7 (Forward|Backward)-check applied'   # must be 2
echo "$PR_BODY" | grep -cE '[^[:space:]]+\.[a-z]+:[0-9]+'                  # must be >=2
```

## §11 Stop conditions

- Anything would require `npm publish` or dropping `private: true` → **STOP**, do not proceed.
- The `@getff` scope-ownership probe (§0.2) does not return ours → **STOP and park**.
- A design decision would diverge from spec §4 A6 or §11 F-C′ → **STOP** and surface the divergence.
- The tarball cell cannot be made to install + run a bin → park the blocker with the failing
  output; do NOT ship a `files` list validated only by inspection.
- Wiring the new cell into `ci-success needs:` would deadlock merges (the job is RED on staging
  first) → fix-first or wire with a dated escape note, per the precedent at
  [`../launch-preannounce-track/kickoff.md:46`](../launch-preannounce-track/kickoff.md).
- Local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.
