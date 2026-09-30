# trigger build, slice 3 — the non-lint liveness arm, shipped to consumers

> **Class:** stage kickoff (dispatch input), single stage. **Base branch:** `staging`.
> **Branch:** `feat/trigger-build-s3-nonlint-liveness`. **PR title:**
> `trigger build S3: cmd-script liveness arm reads the project's manifest, owner both`.
> **Channel:** one aif task, own worktree, one PR to `staging`, harvested from the host (never
> pushed from the container). The lead session of the trigger build verifies the proof on the host.
> **Rigor label (L0):** `build-and-verify` — a gate that today runs only in getff becomes a gate on
> every consumer push; slice 3's proof (a) reads its output in getff and in a fixture project.
> **Authoritative for:** this stage's contract — which manifest the arm reads per layout, the
> owner change and what it drags along (bundle, principle 27), the paired fixtures, exit gates,
> falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the trigger-build design and spec — they live in the operator's coordination store, not in the
> repo; the rows this stage needs are quoted verbatim in §0 below.

**Measurement SHA for every `path:line` below:** `2855667cb34` (`origin/staging`, 2026-09-30).
Re-locate by content (`grep -n`) if yours differ.

## §0 Spec rows this stage carries (verbatim, by pointer)

Source: `_spec-2026-09-29-trigger-build.md` (coordination store, revision r2e; not readable from the
container, hence quoted). §3 «Slice 3», item 3 (`:212-218`):

> 3. A2 / A3, non-lint half: the logic of `cmdScriptLivenessEntry` (`packages/core/hooks/pre-push.ts:2162`,
>    registered `:2710`; population filter `check.type` `command` / `script`,
>    `packages/core/hooks/checks/cmd-script-liveness.ts:137-138`, `:599`) made general — its population
>    from the manifest (S-9), shipped as a pre-push section with owner `both`. r2 (BU-S2):
>    `guardLivenessEntry` (`pre-push.ts:2153`, `:2705`) is NOT part of this half — it is getff's own
>    ESLint liveness check (`guard-liveness.ts:2` «Change-scoped ESLint guard-liveness check»; `:131` skips
>    every non-`eslint` rule). It stays as it is; the lint half for consumers is item 2.

Proof (`:220-221`): «(a) A seeded dead check (one that cannot fail) is reported by each arm, in getff
and in a fixture project.» Seam (`:231-232`): «The non-lint arm — TO BUILD from the one pre-push entry
`cmdScriptLivenessEntry` [...]; its paired fixture TO BUILD.»

S-9 (§2.2, `:85`):

> The non-lint half of A2 / A3 reads its population from the manifest the project already has —
> `.ai-factory/synthesizer-output/rules-manifest-additions.json` (r7 N9) — and from getff's
> `packages/core/manifest/rules-manifest.json` inside getff. No new registry file is created (entry 26)
> | Falsifier: the manifest cannot name a command or script check, so the population is empty at a consumer

Routing (§3 «Who builds what», `:110`): «3 | item 3 (the non-lint liveness arm + fixture); item 2 once
P5 is on staging | item 1's live-delivery proof (b); item 1's text is written by the host».
The base-core rows behind «A2 / A3» are `_base-core-review-results-2026-09-29.md:192-193`; the same
file's answer to the operator (`:35`) glosses them: A2 «a rule fires on the bad example and passes on
the good one», A3 «a check that cannot fail proves nothing». Design binding (v2
`_design-2026-09-29-trigger-build-v2.md:173`, D17): «Mechanisms are harvested from getff, made
general, shipped; getff runs the shipped version on itself». Operator log entry 26 (spec §1) forbids a
registry runner and a new registry file.

## §1 Facts, measured at `2855667cb34`

- **The arm is maintainer-only today, three ways.** Registry: `owner: 'maintainer'`
  (`pre-push.ts:2709-2713`). Entry guard: runs only if `packages/core/manifest/rules-manifest.json`
  exists (`pre-push.ts:2162-2168`). Manifest path hard-coded: `MANIFEST_REL` (`cmd-script-liveness.ts:58`),
  read at `:664-667`.
- **It is left out of the shipped bundle.** The consumer receives one file,
  `packages/core/hooks/pre-push.bundle.mjs` (`setup.d/50-hooks.sh:42`). `scripts/build-runtime-bundles.mjs:71-78`
  lists `./checks/cmd-script-liveness.ts` as an `external`, so the bundle keeps a run-time
  `await import("./checks/cmd-script-liveness.ts")` (section body `pre-push.ts:678-686`, which
  `die()`s if the file is absent). Principle 27 (d) requires every such external to belong to a
  `maintainer` section that never composes on a consumer
  (`packages/core/principles/27-prepush-copylist-complete.test.ts:134-152`, the owner assert at `:150`).
  The module imports only Node built-ins and `../utils/run-check.ts` (`cmd-script-liveness.ts:49-54`),
  which the bundle already inlines — no third-party code, so inlining it keeps `thirdParty: false`
  (`build-runtime-bundles.mjs:80`).
- **Script resolution is getff-shaped.** `resolve-and-run` resolves `check.script` by BASENAME among
  tracked files under `packages/` only (`cmd-script-liveness.ts:241-248`, filter `:243`) — at a
  consumer a project script under `scripts/` is never found and the rule SKIPs (`:396-401`).
- **Layout signal.** One detection axis, `ctx.isFrameworkRepo` (SSOT-register presence,
  `pre-push.ts:2784`), threaded to every section; sections must not re-derive it (`pre-push.ts:807-812`).
  Precedent for reading the consumer manifest path: the mutation lane, `pre-push.ts:1222-1225`.
- **Population today.** getff's manifest: 10 `command`/`script` rules (R1, R3, R4, R11, R17, R19,
  IR1-IR4; `jq` over `packages/core/manifest/rules-manifest.json`). Consumer manifest: the schema admits
  both types (`packages/core/synthesizer/types.ts:10-11`, `recipe.schema.json:50-62`), but no shipped
  producer emits one — the consumer path `generate.ts:59-75` emits `declarative | eslint | manual` only,
  and all 10 recipes under `packages/core/synthesizer/recipes/` are `eslint`, `declarative` or `manual`
  (`jq -r .rule.check.type`, run 2026-09-30). See OPEN-1.
- **RED today, measured (2026-09-30, node v24.3.0).** getff: a dead rule (`check.command: "true"`,
  setup-script `echo bad > violating.txt`) seeded into a clone of `2855667cb34` IS reported
  (`ZZ-DEAD [run-and-assert]: the check passed clean but did NOT exit non-zero on the violating
  fixture`, exit 1). Fixture consumer (bundle alone + the same rule as `G1` in
  `.ai-factory/synthesizer-output/rules-manifest-additions.json`, `PREPUSH_ONLY=cmd-script-liveness`):
  **exit 0, empty output** — the dead check passes silently. Both commands are in §5.

## §2 Deliverables

1. **Manifest by layout, in `cmd-script-liveness.ts`.** `runCmdScriptLivenessGate` takes the manifest
   path from its caller instead of `MANIFEST_REL` (`:58`, `:664`, `:667`). The section passes
   `packages/core/manifest/rules-manifest.json` when `ctx.isFrameworkRepo`, else
   `.ai-factory/synthesizer-output/rules-manifest-additions.json`; the caller also passes `repoRoot`
   explicitly (the pre-push `REPO_ROOT`, `pre-push.ts:77`) rather than relying on the module's
   `import.meta.url` default (`:57`), which the bundle rewrites. Change-scoped semantics stay: the
   base manifest via `git show <base>:<same path>`, absent at the base → every `command`/`script` rule
   counts as changed (`:600-601`, `:667-668`). A manifest that is not valid JSON fails loudly naming
   its path (fail-closed), never a crash message and never a skip. Keep the whole generalization inside
   the existing module — no new production file (see §3).
2. **Script resolution by layout.** On the framework layout keep the tracked-basename-under-`packages/`
   resolver unchanged (`:241-248`, with its ambiguity FAIL). On the consumer layout resolve
   `check.script`'s path AS WRITTEN, relative to the project root, among tracked files (same
   `trackedPaths` predicate, `:207-220`); not found → the visible SKIP it already prints. The layout
   reaches the module as an option from the caller, not a second `existsSync` of the SSOT.
3. **Section `cmd-script-liveness`, owner `both`** (`pre-push.ts:2709-2713`). Keep the id (principle
   32 diagnostics and the `PREPUSH_ONLY` seam, `pre-push.ts:2802`, key on it). The entry
   (`:2162-2168`) guards on the layout's manifest, and when it is absent prints one visible line
   (`ℹ cmd-script-liveness: no rules manifest at <path> — nothing to check`), never silence. Load the
   module with a STATIC import (as `checks/prior-art.ts` is, `pre-push.ts:48-52`), remove it from
   `external` in `build-runtime-bundles.mjs:73-76`, update the comment there (`:23-26`: «two
   maintainer-only sections») and the NOTE in `pre-push.ts:37-46`, then regenerate the bundle
   (`node scripts/build-runtime-bundles.mjs`). The fix hint at `pre-push.ts:716-719` names
   `packages/core/manifest/rules-manifest.json`; print the manifest actually read.
4. **Paired fixtures (TO BUILD), vitest — no new `*.test.sh`.**
   - `packages/core/hooks/checks/cmd-script-liveness.test.ts` (extend; describes at `:91`, `:140`,
     `:450`, `:477`): consumer-layout manifest path read; consumer `check.script` resolved as written;
     a DEAD rule (clean pass + violating pass) → `fail`; its LIVE twin (`check.command:
     "test ! -e violating.txt"`, same setup-script) → `pass`; invalid-JSON manifest → loud failure.
   - `packages/core/hooks/pre-push.consumer-layout.test.ts`, in the shipped-bundle describe
     (`:1966-1967`, «the shipped hook on plain node, in the shipped layout»): a consumer fixture whose
     generated manifest carries the dead rule → the push exits non-zero naming it; the same fixture with
     only the live rule → exit 0; a fixture with no manifest → exit 0 and the `ℹ` line. Each asserts
     the exit code AND the rule id in the output.
   - Seeded values are fixture text the test writes; a dead check is one that ALWAYS PASSES (`true`).
     A check that always fails is «non-functional on the clean state» and SKIPs by design
     (`cmd-script-liveness.ts:303-316`) — it is not a dead check and does not prove the arm.
5. **Regenerated artefacts in the same PR:** the bundle, `packages/getff/MANIFEST.sha256`
   (`bash scripts/build-getff-dist.sh`), the install fingerprints under
   `tests/install-sh/baselines/*/` (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) — all
   three carry the bundle's hash. No CI workflow edit is needed: `vitest run hooks/` already runs both
   test files (`packages/core/package.json:57`, `.github/workflows/audit-self.yml:542`). If you add a
   `*.test.sh` anyway, principle 41 needs a workflow step: chain it onto an existing `run:` line or
   append where no cited line follows — inserting lines into `audit-self.yml` shifts `path:line`
   citations, some inside `.claude/rules/*` which this stage cannot edit, and the pre-push citation
   gate refuses the push.

## §3 Prior-art consult (run by the drafting session 2026-09-30; re-check, do not re-derive)

- SSOT: `prior-art-evaluations.md` row **#114** (BUILD — the change-scoped ESLint guard-liveness gate,
  the sibling half that stays as it is), row **#54** (ADAPT — `runCheck()`, the subprocess primitive
  this module already reuses, `cmd-script-liveness.ts:38-41`), row **#39** (ADOPT — StrykerJS, mutation
  of source, a different arm of A3). No row covers the command/script liveness runner itself; its BUILD
  verdict sits in its own header (`cmd-script-liveness.ts:43-47`).
- context7, three phrasings (the `/upstash` context7 server was over quota; the second context7 server
  answered): `/pre-commit/pre-commit.com` «verify a hook actually fails on a violating file» →
  `try-repo` runs hooks from a repo, meta hooks `check-hooks-apply` / `check-useless-excludes` check
  that a hook matches files, not that it can fail; `/evilmartians/lefthook` «check that a hook
  command can fail» → `lefthook validate` checks config syntax, integration tests assert a hook's
  failure by hand; `/stryker-mutator/stryker-js` «detect a check that can never fail» → the `command`
  test runner reports one synthetic result from one command's exit code, over mutated source. None
  runs a per-rule violating fixture against the rule's own check. Verdict: REUSE own stack — make the
  existing runner layout-general (D17), no new tool, no new registry (entry 26).
- **Capability commit?** Not by CLAUDE.md «What is a capability commit?» when built as §2 says: edits
  to existing files, regenerated artefacts, test material (carved out). A new production file ≥80 LOC
  under `packages/` would make it one — §2 item 1 says not to create one. If the pre-push hook asks
  anyway, the trailer is
  `Prior-art: prior-art-evaluations.md#114 (sibling ESLint liveness BUILD; this commit ships the existing cmd/script runner to consumers, no new tool)`.

## §4 Proof — RED first

- Run the new consumer-layout cases and the consumer command of §5 against the UNMODIFIED code first
  and paste the failing run into the PR body (expected: exit 0 with the dead rule, as measured in §1).
  Then GREEN.
- The getff half is GREEN before and after (§1); it is a regression proof that the owner change and
  the inlining did not break the framework path. Paste its output too.
- The host half is the lead's: it runs the §5 block on the Mac. Do not claim host numbers.

## §5 Exit gates

```bash host-verify
npx vitest run packages/core/hooks/checks/cmd-script-liveness.test.ts packages/core/hooks/pre-push.consumer-layout.test.ts
npx vitest run packages/core/principles/27-prepush-copylist-complete.test.ts packages/core/principles/32-prepush-section-owner.test.ts packages/core/principles/02-paired-negative-test.test.ts
NODE_ENV=development node scripts/build-runtime-bundles.mjs --check
bash scripts/build-getff-dist.sh --check
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash -c 'set -eu; T=$(mktemp -d); trap "rm -rf \"$T\"" EXIT; git clone -q --no-checkout . "$T/g"; git -C "$T/g" checkout -q "$(git rev-parse HEAD)"; cd "$T/g"; M=packages/core/manifest/rules-manifest.json; jq ". + {\"ZZ-DEAD\": {\"check\": {\"type\": \"command\", \"command\": \"true\"}, \"fixture\": {\"setup-script\": \"echo bad > violating.txt\"}}}" "$M" > "$T/m"; mv "$T/m" "$M"; git -c user.name=hv -c user.email=hv@example.invalid commit -qam seed; if PREPUSH_UPSTREAM_REF=HEAD~1 PREPUSH_ONLY=cmd-script-liveness node packages/core/hooks/pre-push.bundle.mjs > "$T/out" 2>&1; then echo "getff: dead check NOT reported"; exit 1; fi; grep -q "ZZ-DEAD" "$T/out"'
bash -c 'set -eu; R=$PWD; T=$(mktemp -d); trap "rm -rf \"$T\"" EXIT; cd "$T"; git init -q c; cd c; mkdir -p packages/core/hooks .ai-factory/synthesizer-output; cp "$R/packages/core/hooks/pre-push.bundle.mjs" packages/core/hooks/; M=.ai-factory/synthesizer-output/rules-manifest-additions.json; printf "{}\n" > $M; git add -A; git -c user.name=hv -c user.email=hv@example.invalid commit -qm base; printf "%s\n" "{\"G1\": {\"check\": {\"type\": \"command\", \"command\": \"true\"}, \"fixture\": {\"setup-script\": \"echo bad > violating.txt\"}}}" > $M; git -c user.name=hv -c user.email=hv@example.invalid commit -qam seed; if PREPUSH_UPSTREAM_REF=HEAD~1 PREPUSH_ONLY=cmd-script-liveness node packages/core/hooks/pre-push.bundle.mjs > "$T/out" 2>&1; then echo "consumer: dead check NOT reported"; exit 1; fi; grep -q "G1" "$T/out"'
node scripts/check-line-citations.mjs --check --corpus $(git diff --name-only "$(git merge-base origin/staging HEAD)" HEAD | sed 's/^/--affected-by=/')
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

The citation gate covers the line shifts in `pre-push.ts`, `cmd-script-liveness.ts` and
`build-runtime-bundles.mjs`; renumber stale citations with `--write` on files outside `.claude/rules/`,
and report any stale one inside `.claude/rules/` in `ATTN` (the lead patches it; §6). The
docs-refresh gate decides whether any `docs/site/` page cites these files in `sources:`; refresh a
named page or add `docs-refresh: deferred — <reason>` (a comma inside the reason, never `: `).

## §6 Out of scope

- Item 1 (the always-on text: base-core map + three roots) — the host writes it and runs its
  live-delivery proof (b).
- Item 2 (the lint half of A2 / A3, through P5's `prove-rules.mjs --prove`) — waits for P5 on
  `staging`; a later stage kickoff.
- `guardLivenessEntry` / `guard-liveness.ts` (spec r2 BU-S2) — stays maintainer-only and unchanged.
- The mutation and fence checks named beside the arm in v2 (`_design-...-v2.md:264`) — not this item.
- Any file under `.claude/rules/` or `.claude/settings.json` — no agent and no factory run commits
  there in this build (spec `:114-118`, `[op V8]`); a needed change there is the lead's operator patch.
- A starting list, a `[params]` file, the `getff-mechanism-<name>` marker (S-12, S-13, S-15) — slice 4.
- The bash critical-only fallback (`pre-push.fallback.sh`, Node < 20) — not extended; declared limit.
- Changing the liveness modes, `EXEMPT_RULES` (`cmd-script-liveness.ts:98-101`), the SKIP / no-data
  semantics, or the manifest schema.

## §7 Falsifiers to write into the PR body

- The consumer fixture with the dead rule exits 0 → the arm did not ship (still external, still
  maintainer, or reading getff's path).
- The consumer fixture with NO manifest crashes or dies «failed to load the liveness runner» → the
  module is still an external of the bundle.
- The live twin fails, or the dead rule passes, in either layout → the clean/violating pair broke.
- A consumer `check.script` under `scripts/` SKIPs as «not found among tracked files under packages/»
  → the resolver is still getff-shaped.
- The getff seed is no longer reported → the owner change or inlining broke the framework path.
- Principle 27 (d) or 32 red → an external or owner tag is inconsistent.
- The bundle, `MANIFEST.sha256` or a fingerprint drifts → a regenerated artefact was left out.

## §8 Report

`Stat` / `Verify` (each §5 gate, the RED-then-GREEN runs) / `DECISIONS` (how the layout reaches the
module, the consumer script resolver, the no-manifest line) / `ATTN` (stale citations under
`.claude/rules/`, OPEN-1…4 below as you met them) / `Confidence`. The PR body carries
`## Fidelity verdict` (the lead adds it after the cold fidelity round on the host) and the §1.7
Forward-check / Backward-check sections.

Open for the lead / advisor — the stage does not decide them, it builds under the current behaviour:

- **OPEN-1 (S-9 falsifier, half-fired).** A consumer manifest CAN name a `command`/`script` check
  (schema), but no shipped producer writes one (§1), so the consumer population is empty today and
  the arm fires only on a project-added rule. Whether that meets S-9 or goes to the advisor.
- **OPEN-2 (D27).** `liveness-mode: exempt` at a consumer carries no reason — the rationale map is
  keyed by getff's IDs (`cmd-script-liveness.ts:98-101`), the default text is fixed (`:566`). D27
  (v2 `:182`) rejects an empty reason.
- **OPEN-3 (D23).** On the first push after install every `command`/`script` rule counts as new
  (`:600-601`, `:667-668`); there is no starting list. Whether D23 (v2 `:179`) applies to this arm.
- **OPEN-4 (D19 / `#warning-nobody-reads`).** A rule with no fixture prints a `⚠` line and passes
  (`pre-push.ts:695-697`); D24 supports the SKIP of a non-functional check, but no-data is a warning
  whose only consumer is a reader.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2** run the fixtures, do not describe what they would print · **T3**
command-or-`file:line` for every claim · **T6** confidence as predicates, not «high» · **T14** a green
consumer case over a fixture with NO manifest proves nothing about the arm (the entry returns before
the import) · **T15** getff runs the shipped arm on itself — the getff seed in §5 is that check ·
**T19** own cold review of the diff before handoff · **T21** cold `agents/backward-sweep-auditor.md`
on the class «a pre-push section promoted from `maintainer` to `both` whose module, path constants or
resolver still assume the framework layout» — the other `external` (`guard-liveness`) and every
`packages/`-rooted path constant in `packages/core/hooks/checks/*` are the candidates.

**T-TB3-A (domain):** in getff the bundle finds `./checks/cmd-script-liveness.ts` beside it and loads
it (node strips the types), so every getff run — the §5 getff seed included — stays GREEN while the
module is still an `external`. Only a consumer fixture that carries the bundle ALONE and a manifest
WITH a `command` rule exercises the import; a dead check that always FAILS is SKIPped, not reported.
Seed an always-passing check, in a bundle-only tree.
