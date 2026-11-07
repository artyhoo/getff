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

Source: `_spec-2026-09-29-trigger-build.md` (coordination store, revision r2f; not readable from the
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

S-9 (§2.2, `:85`; the table row verbatim, columns Decision | Serves | Falsifier):

> | S-9 | The non-lint half of A2 / A3 reads its population from the manifest the project already has —
> `.ai-factory/synthesizer-output/rules-manifest-additions.json` (r7 N9) — and from getff's
> `packages/core/manifest/rules-manifest.json` inside getff. No new registry file is created (entry 26)
> | D17, entry 26, E18 F1 | HALF-FIRED (r2f, E18): the manifest CAN name a command/script check
> (`packages/core/synthesizer/types.ts:10-11` at `2855667cb34`; r2g path fix, E19), but no shipped path
> writes one — the synthesizer emits `declarative` / `eslint` / `manual` only (`generate.ts:60-74` at
> `2855667cb34`). Declared limit: at a consumer the population is empty today; the arm ships, and its
> report prints the population as a NUMBER («command/script checks: 0 — nothing to check yet»), never a
> green check. Trigger to revisit: the synthesizer emits a command/script check |

Advisor verdict E18 F1 (`_advisor-trigger-build.decisions.md#e18`, `:586-596`): «A, ship now, with two
conditions» — (1) «at a consumer the report prints the population as a number («command/script checks:
0 — nothing to check yet»), never as a green check»; (2) the S-9 revision above. Its «Wrong if»: «the
empty run is scored as a green check anywhere».

Routing (§3 «Who builds what», `:110`): «3 | item 3 (the non-lint liveness arm + fixture); item 2 once
P5 is on staging | item 1's live-delivery proof (b); item 1's text is written by the host».
The base-core rows behind «A2 / A3» are `_base-core-review-results-2026-09-29.md:192-193`; the same
file's answer to the operator (`:35`) glosses them: A2 «a rule fires on the bad example and passes on
the good one», A3 «a check that cannot fail proves nothing». Design binding (v2
`_design-2026-09-29-trigger-build-v2.md:173`, D17): «Mechanisms are harvested from getff, made
general, shipped; getff runs the shipped version on itself». Operator log entry 26
(`_advisor-one-button-operator-log.md:248-250`) lists «the registry runner» under «NOT PART OF THE
IDEA», beside `.getff/project.json` / `checks.json` / `chain.json`; S-9 adds «No new registry file».

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
  (`build-runtime-bundles.mjs:80`). **Principle 27 also counts the externals:** its non-vacuity floor
  (`27-prepush-copylist-complete.test.ts:153-154`, comment «the bundle really does leave the two
  liveness gates out», `expect(imports.length).toBeGreaterThanOrEqual(2)`) goes RED once this module
  is inlined and only `guard-liveness` stays external.
- **`import.meta.url` in an inlined module.** esbuild itself leaves `import.meta.url` as the URL of the
  bundle file; this repo's `ownMetaUrlPlugin` (`build-runtime-bundles.mjs:114-145`) replaces it in every
  inlined non-entry module with `new URL(<the module's source path relative to the bundle>,
  import.meta.url)` (`:136-139`). So `DEFAULT_REPO_ROOT` (`cmd-script-liveness.ts:57`) is derived from
  the bundle's location plus that relative path, not from a file that exists at a consumer.
- **The `PREPUSH_ONLY` seam bypasses the owner filter.** It looks the section up in `SECTIONS`, not
  `activeSections()` (`pre-push.ts:2799-2801`), so a `PREPUSH_ONLY=cmd-script-liveness` run proves the
  section's logic, never that it composes on a consumer. Only a full-hook run (no `PREPUSH_ONLY`) on a
  consumer layout proves the owner change.
- **Script resolution is getff-shaped.** `resolve-and-run` resolves `check.script` by BASENAME among
  tracked files under `packages/` only (`cmd-script-liveness.ts:241-248`, filter `:243`) — at a
  consumer a project script under `scripts/` is never found and the rule SKIPs (`:396-401`).
- **Layout signal.** One detection axis, `ctx.isFrameworkRepo` (SSOT-register presence,
  `pre-push.ts:2784`), threaded to every section; sections must not re-derive it (`pre-push.ts:807-812`).
  Precedent for reading the consumer manifest path: the mutation lane, `pre-push.ts:1222-1225`.
- **Population today.** getff's manifest: 10 `command`/`script` rules (R1, R3, R4, R11, R17, R19,
  IR1-IR4; `jq` over `packages/core/manifest/rules-manifest.json`). Consumer manifest: the schema admits
  both types (`packages/core/synthesizer/types.ts:10-11`, `recipe.schema.json:50-62`), but no shipped
  producer emits one — the consumer path `generate.ts:60-74` emits `declarative | eslint | manual` only,
  and all 10 recipes under `packages/core/synthesizer/recipes/` are `eslint`, `declarative` or `manual`
  (`jq -r .rule.check.type`, run 2026-09-30). E18 F1 ships the arm anyway, as a counted number (§0);
  the limits are in §8.
- **Where consumers are told what pre-push checks.** Four shipped templates list «getff's own rule
  checks»: `packages/core/templates/shared/CLAUDE.md.template:22`, `AGENTS.md.template:46`,
  `DESCRIPTION.template.md:61`, `AI-USAGE-GUIDE.md:208-212` (the list runs `:209-211` inside the
  «4. **On push**» item at `:208`). None names this check. Swept further (`git grep -n "generated-rule
  firing" 2855667cb34`): `README.md:34`, `AUDIT-CHECKLIST.md:372`, `INSTALL-FOR-AI.md:561`,
  `packages/core/templates/shared/skill-context/aif-rules-check/SKILL.md:18` carry the same list (§6).
- **RED today, measured (2026-09-30, node v24.3.0).** getff: a dead rule (`check.command: "true"`,
  setup-script `echo bad > violating.txt`) seeded into a clone of `2855667cb34` IS reported
  (`ZZ-DEAD [run-and-assert]: the check passed clean but did NOT exit non-zero on the violating
  fixture`, exit 1). Fixture consumer (bundle alone + the same rule as `G1` in
  `.ai-factory/synthesizer-output/rules-manifest-additions.json`, `PREPUSH_ONLY=cmd-script-liveness`):
  **exit 0, empty output** — the dead check passes silently. The same fixture through the FULL hook
  (no `PREPUSH_ONLY`): exit 0, the only output line the mutation lane's `⚠ DEGRADED: generated-rules
  manifest present but run-generated-rule-mutation.sh not delivered`. All three commands are in §5.

## §2 Deliverables

1. **Manifest by layout, in `cmd-script-liveness.ts`.** `runCmdScriptLivenessGate` takes the manifest
   path from its caller instead of `MANIFEST_REL` (`:58`, `:664`, `:667`). The section passes
   `packages/core/manifest/rules-manifest.json` when `ctx.isFrameworkRepo`, else
   `.ai-factory/synthesizer-output/rules-manifest-additions.json`; the caller also passes `repoRoot`
   explicitly (the pre-push `REPO_ROOT`, `pre-push.ts:77`) rather than relying on the module's
   `import.meta.url` default (`:57`), which after inlining resolves through the bundle's own URL (§1).
   Change-scoped semantics stay: the base manifest via `git show <base>:<same path>`; absent at the
   base (the `git show` exits non-zero) → every `command`/`script` rule counts as changed (`:600-601`,
   `:667-668`). **Invalid JSON fails closed, in both manifests:** a current manifest that does not parse
   (today an uncaught `JSON.parse` at `:597`, reported as «pre-push hook crashed») and a base manifest
   that exists but does not parse (today silently treated as «all changed», `:604-608`) each end the
   section with exit 1 and one message naming the path and, for the base, the ref. Never a crash
   message, never a skip. Keep the whole generalization inside the existing module — no new
   production file (see §3).
2. **Script resolution by layout.** On the framework layout keep the tracked-basename-under-`packages/`
   resolver unchanged (`:241-248`, with its ambiguity FAIL). On the consumer layout take the first
   token after `extractRunnable` (`:390-391`) as a repo-relative path and resolve it AS WRITTEN among
   tracked files (same `trackedPaths` predicate, `:207-220`); not found → the visible SKIP it already
   prints. A path that is absolute, or that has a `..` segment after normalisation, is rejected: status
   `fail`, message naming the path («resolves outside the project»), never resolved and never run. The
   layout reaches the module as an option from the caller, not a second `existsSync` of the SSOT.
3. **The population is reported as a NUMBER (E18 F1 condition 1).** Every run of the section, in both
   layouts, prints one line `ℹ cmd-script-liveness: command/script checks: <N> in <manifest path>,
   <M> changed in this push`. When N = 0 it reads exactly `ℹ cmd-script-liveness: command/script
   checks: 0 — nothing to check yet` (no manifest: `... checks: 0 — nothing to check yet (no rules
   manifest at <path>)`). The `✅` line (`pre-push.ts:700-704`) prints only when at least one rule
   actually passed; an empty or all-unchanged run never prints `✅`, never «passed».
4. **Section `cmd-script-liveness`, owner `both`** (`pre-push.ts:2709-2713`). Keep the id (principle
   32 diagnostics and the `PREPUSH_ONLY` seam, `pre-push.ts:2802`, key on it). The entry
   (`:2162-2168`) guards on the layout's manifest; when it is absent it prints the item-3 line, never
   silence. Load the module with a STATIC import (as `checks/prior-art.ts` is, `pre-push.ts:48-52`),
   remove it from `external` in `build-runtime-bundles.mjs:73-76`, then regenerate the bundle
   (`node scripts/build-runtime-bundles.mjs`). The fix hint at `pre-push.ts:716-719` names
   `packages/core/manifest/rules-manifest.json`; print the manifest actually read. **Stale comments to
   update in the same commit:** `pre-push.ts:2161` («cmd-script-liveness (maintainer)»),
   `pre-push.ts:37-46` (the NOTE: a maintainer-only gate goes behind a lazy import on the `external`
   list), `build-runtime-bundles.mjs:23-26` («two maintainer-only sections»),
   `pre-push.consumer-layout.test.ts:23-24` (the cmd-script-liveness manifest named among the
   maintainer-only absent paths).
5. **Principle 27's floor — its OWN commit (cross-owner handoff).** `packages/core/principles/` is
   owned by meta-tests CI and read-only for implementation agents (CLAUDE.md «Artifact Ownership
   Contract»). This kickoff is the explicit handoff: change `27-prepush-copylist-complete.test.ts:154`
   to `expect(imports.length).toBeGreaterThanOrEqual(1);` and its comment at `:153` to «Non-vacuity:
   the bundle really does leave the ESLint liveness gate out.», in a separate commit carrying a
   rationale line (e.g. `Rationale: cmd-script-liveness is inlined into the consumer bundle (trigger
   build S3), so one external remains; the floor tracks the real count, handoff authorised by
   .claude/orchestrator-prompts/trigger-build-s3/kickoff.md §2 item 5`). No other edit to principle 27.
6. **Consumer-facing lists.** Add the check, in the list's own wording style (e.g. «command/script
   check liveness»), to `packages/core/templates/shared/CLAUDE.md.template:22`,
   `AGENTS.md.template:46`, `DESCRIPTION.template.md:61` and `AI-USAGE-GUIDE.md:209-211`. Their
   rendered copies change the install fingerprints — regenerated under item 8. `README.md:34` and the
   other surfaces §1 names are NOT edited here (§6).
7. **Paired fixtures (TO BUILD), vitest — no new `*.test.sh`.**
   - `packages/core/hooks/checks/cmd-script-liveness.test.ts` (extend; describes at `:91`, `:140`,
     `:450`, `:477`): consumer-layout manifest path read; consumer `check.script` resolved as written;
     a `..` / absolute `check.script` → `fail`; a DEAD rule (clean pass + violating pass) → `fail`; its
     LIVE twin (`check.command: "test ! -e violating.txt"`, same setup-script) → `pass`; an invalid-JSON
     CURRENT manifest and an invalid-JSON BASE manifest (a real git repo whose base commit carries
     unparsable text at the manifest path) → each a failure naming the path, not a thrown error.
   - `packages/core/hooks/pre-push.consumer-layout.test.ts`, in the shipped-bundle describe
     (`:1966-1967`, «the shipped hook on plain node, in the shipped layout»). These run the FULL hook
     with NO `PREPUSH_ONLY`, so they exercise consumer composition: (i) the generated manifest carries
     the dead rule → exit non-zero, output names it; (ii) only the live rule → exit 0, no dead-rule
     failure; (iii) no manifest → exit 0 and the exact line `command/script checks: 0 — nothing to
     check yet`, and no `✅ cmd-script-liveness` line. Case (iii)'s `ℹ` line is the **owner proof**: it
     can appear only if the section composes on a consumer layout. Each case asserts the exit code AND
     the text.
   - Seeded values are fixture text the test writes; a dead check is one that ALWAYS PASSES (`true`).
     A check that always fails is «non-functional on the clean state» and SKIPs by design
     (`cmd-script-liveness.ts:303-316`) — it is not a dead check and does not prove the arm.
8. **Regenerated artefacts in the same PR:** the bundle, `packages/getff/MANIFEST.sha256`
   (`bash scripts/build-getff-dist.sh`), the install fingerprints under
   `tests/install-sh/baselines/*/` (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) — they
   carry the bundle's hash and the four templates of item 6. No CI workflow edit is needed: `vitest run
   hooks/` already runs both test files (`packages/core/package.json:57`,
   `.github/workflows/audit-self.yml:542`). If you add a `*.test.sh` anyway, principle 41 needs a
   workflow step: chain it onto an existing `run:` line or append where no cited line follows —
   inserting lines into `audit-self.yml` shifts `path:line` citations, some inside `.claude/rules/*`
   which this stage cannot edit, and the pre-push citation gate refuses the push.

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

- Run the new consumer-layout cases and the two consumer commands of §5 (`PREPUSH_ONLY` and full
  hook) against the UNMODIFIED code first and paste the failing runs into the PR body (expected: exit 0
  with the dead rule, as measured in §1). Then GREEN.
- Commit order: the principle 27 handoff (§2 item 5) is its own commit; run principle 27 before it
  (RED on the inlined bundle) and after it (GREEN) and paste both.
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
bash -c 'set -eu; R=$PWD; T=$(mktemp -d); trap "rm -rf \"$T\"" EXIT; cd "$T"; git init -q c; cd c; mkdir -p packages/core/hooks .ai-factory/synthesizer-output; cp "$R/packages/core/hooks/pre-push.bundle.mjs" packages/core/hooks/; M=.ai-factory/synthesizer-output/rules-manifest-additions.json; printf "{}\n" > $M; git add -A; git -c user.name=hv -c user.email=hv@example.invalid commit -qm base; printf "%s\n" "{\"G1\": {\"check\": {\"type\": \"command\", \"command\": \"true\"}, \"fixture\": {\"setup-script\": \"echo bad > violating.txt\"}}}" > $M; git -c user.name=hv -c user.email=hv@example.invalid commit -qam seed; if PREPUSH_UPSTREAM_REF=HEAD~1 node packages/core/hooks/pre-push.bundle.mjs > "$T/out" 2>&1; then echo "consumer full hook: dead check NOT reported"; exit 1; fi; grep -q "G1" "$T/out"'
bash -c 'set -eu; R=$PWD; T=$(mktemp -d); trap "rm -rf \"$T\"" EXIT; cd "$T"; git init -q c; cd c; mkdir -p packages/core/hooks; cp "$R/packages/core/hooks/pre-push.bundle.mjs" packages/core/hooks/; git add -A; git -c user.name=hv -c user.email=hv@example.invalid commit -qm base; PREPUSH_UPSTREAM_REF=HEAD node packages/core/hooks/pre-push.bundle.mjs > "$T/out" 2>&1; grep -q "command/script checks: 0 — nothing to check yet" "$T/out"; if grep -q "✅ cmd-script-liveness" "$T/out"; then echo "empty run scored green"; exit 1; fi'
node scripts/check-line-citations.mjs --check --corpus $(git diff --name-only "$(git merge-base origin/staging HEAD)" HEAD | sed 's/^/--affected-by=/')
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

The last two consumer lines run the FULL hook (no `PREPUSH_ONLY`, which bypasses the owner filter,
§1): one proves the dead rule blocks a consumer push, the other that an empty consumer prints the
counted `0` and no `✅` (E18 F1 condition 1, and the owner proof). The citation gate covers the line shifts in `pre-push.ts`, `cmd-script-liveness.ts` and
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
- **ATTN for the lead (maintainer-owned or outside the four templates, NOT edited here):** `README.md:34`
  (maintainer-owned per the Artifact Ownership Contract) lists the pre-push checks without this one;
  the same list sits in `AUDIT-CHECKLIST.md:372`, `INSTALL-FOR-AI.md:561` and
  `packages/core/templates/shared/skill-context/aif-rules-check/SKILL.md:18` (skill-context overrides
  are framework-maintainer-owned). Report them in `ATTN`; the lead decides.

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
- Principle 27 still asserts `>= 2`, or the floor edit rides inside a code commit, or anything else in
  principle 27 changed → the cross-owner handoff of §2 item 5 was not kept to one explicit commit.
- An empty or all-unchanged consumer run prints `✅` or «passed», or omits the counted `0` line → E18
  F1 condition 1 broken («the empty run is scored as a green check»).
- The no-manifest `ℹ` line is asserted only under `PREPUSH_ONLY` → the owner change is unproven.
- An invalid-JSON current or base manifest yields «pre-push hook crashed» or a silent «all changed» →
  fail-closed not kept.
- A `check.script` with `..` or an absolute path is resolved or run → the resolver escapes the project.

## §8 Report

`Stat` / `Verify` (each §5 gate, the RED-then-GREEN runs) / `DECISIONS` (how the layout reaches the
module, the consumer script resolver, the counted-population line) / `ATTN` (stale citations under
`.claude/rules/`, the §6 ATTN surfaces, the OPEN-2…4 limits below as you met them) / `Confidence`. The PR body carries
`## Fidelity verdict` (the lead adds it after the cold fidelity round on the host) and the §1.7
Forward-check / Backward-check sections.

**Declared limits (write them into the PR body; not fixed by this stage):**

- **OPEN-1 — CLOSED by E18 F1 (ship now, the count is printed).** Two limits stay with it, from the cold
  Phase -1 review: (a) the only way a consumer gets a `command`/`script` rule today is to add one to the
  generated manifest by hand, and a hand edit is exactly what the S5 anti-hand-edit gate rejects
  (`packages/core/synthesizer/verify-provenance.ts:1-5`, mismatch kind `missing-in-provenance` `:38`);
  measured at `2855667cb34`, `git grep -n verify-provenance` outside tests and markdown finds only
  `packages/core/package.json:43`, `:83` and the CLI, i.e. no shipped consumer channel was found
  invoking it — the conflict is by design, not yet by mechanism; (b) without `fixture.cwd` both runs
  happen in an empty temp dir (`cmd-script-liveness.ts:284-287`, `:418-421`), so only checks that can
  decide from a near-empty directory are provable — a real project check that needs the project tree
  SKIPs as non-functional.
- **`fixture.cwd` at a consumer** runs the setup-script (and `cleanup-script`) INSIDE the project
  tree (`cmd-script-liveness.ts:286-287`, `:319`, `:345`; resolve-and-run `:420-421`, `:441`, `:459`) —
  a fixture that writes a violating file there leaves it behind if cleanup is missing or fails. Declared
  limit; not sandboxed by this stage.

Closed by the lead (2026-09-30) as declared limits — the stage builds under the current behaviour and
writes each into the PR body with its trigger to revisit (the next slice-3 follow-up, or the first
consumer incident of that shape):
- **OPEN-2 (D27) — CLOSED, declared limit.** `liveness-mode: exempt` at a consumer carries no reason — the rationale map is
  keyed by getff's IDs (`cmd-script-liveness.ts:98-101`), the default text is fixed (`:566`). D27
  (v2 `:182`) rejects an empty reason.
- **OPEN-3 (D23) — CLOSED, declared limit.** On the first push after install every `command`/`script` rule counts as new
  (`:600-601`, `:667-668`); there is no starting list. Whether D23 (v2 `:179`) applies to this arm.
- **OPEN-4 (D19 / `#warning-nobody-reads`) — CLOSED, declared limit.** A rule with no fixture prints a `⚠` line and passes
  (`pre-push.ts:695-697`); D24 supports the SKIP of a non-functional check, but no-data is a warning
  whose only consumer is a reader.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2** run the fixtures, do not describe what they would print · **T3**
command-or-`file:line` for every claim · **T6** confidence as predicates, not «high» · **T14** the no-manifest
consumer case proves the owner change and the counted line, never liveness — only the dead-rule case
proves the arm · **T15** getff runs the shipped arm on itself — the getff seed in §5 is that check ·
**T19** own cold review of the diff before handoff · **T21** cold `agents/backward-sweep-auditor.md`
on the class «a pre-push section promoted from `maintainer` to `both` whose module, path constants or
resolver still assume the framework layout» — the other `external` (`guard-liveness`) and every
`packages/`-rooted path constant in `packages/core/hooks/checks/*` are the candidates.

**T-TB3-A (domain):** in getff the bundle finds `./checks/cmd-script-liveness.ts` beside it and loads
it (node strips the types), so every getff run — the §5 getff seed included — stays GREEN while the
module is still an `external`. Only a consumer fixture that carries the bundle ALONE and a manifest
WITH a `command` rule exercises the import; a dead check that always FAILS is SKIPped, not reported.
Seed an always-passing check, in a bundle-only tree.
