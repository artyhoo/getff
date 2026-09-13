# consumer-truth-audit V0 — the delivery census (report)

> **Deliverable pair:** machine-readable `census-v0.json` (276 rows, one per artefact) + this report.
> **Rigor label:** research-grade (kickoff L0). **Lane discipline:** measure only — no fixes (§6);
> every finding below carries a proposed fix for the triage pass, none applied.
> **Round:** 2 + harvest-round fixes. Round 2 regenerated the census from re-run benches after
> the round-1 `delivered` derivation defects (rework BLOCKER + MAJOR 1/2) and made the generator
> a runnable verifier (`gen-census.mjs --check`). The **harvest round** then applied a cold
> review: one Critical (C1 — the census had missed its own generating defect, now row
> `.claude/hooks/inject-matching-rule.sh` = DOC-LIES, §findings F5), three Important structural
> fixes (I1 root-skill provenance + missed population member; I3 per-file `delivered`; I5 the
> aged-stratum join implemented and run for real), two Minor code fixes (M2 hook-registration
> count, M7 the script no longer writes into the repo), and explicit disclosures for the rest
> (§method, §coverage, §findings adjudications). Every census change was re-verified with
> `gen-census.mjs --check` → 0 disagreements on three **host** installs.
> Evidence logs: [`logs/`](logs/) — `entry-verification.md`, `population-enumeration.md`,
> `install-{core,env,factory}.log` (+ `-r2.log` re-run), `consumer-dirs.txt` (+ `-r2.txt`),
> `delivered-tree-measurement.md`, `works-checks.md`, `aged-stratum.md`,
> `aged-stratum-join.md` (harvest round).

## §population

Enumerated 2026-09-08 on the factory at `feature/consumer-truth-audit-55b9ad` (T10: full lists
before any coverage claim; per-file lists with line numbers in `logs/population-enumeration.md` and `logs/population-enumeration-2.md` (C9-C11 + drift),
comma-joined here). **Denominator: 276 artefacts** — the row set of `census-v0.json`
(`meta.population_total`); the per-class list below sums to 276 and is the same population —
re-derivable, not asserted: `jq '.rows|group_by(.class)|map({(.[0].class):length})|add'
census-v0.json` emits (wrapped here for width) `{"agent":20,"ci-workflow":5,"companion":6,
"discipline-rule":30,"hook":25,"hook-check":13,"hook-check-test":12,"lint-bundle":8,
"mcp-config":1,"principle":47,"script":85,"skill":18,"template":6}` — thirteen classes,
rendered below as twelve bullets because the prose merges the two hook-check classes into one
25-bullet and `mcp-config`+`companion` onto one line.
Round 1 stated 252/253 here while the census carried 253 rows including a phantom template
row — fixed by making both deliverables derive from one enumeration. The harvest round added
the **276th** row: root `skills/tool-bootstrapping/`, which `logs/population-enumeration.md:48`
had enumerated but the generator dropped because it hardcoded `const rootGetff = 'skills/getff'`
(cold review I1). Root skills are now derived from `git ls-files skills/*` behind the same
throw-guard the templates block uses, so the same class of omission cannot recur silently —
the previous shape was invisible to `--check` by construction, since both sides of the
comparison read that one literal.

- **skills (18):** ai-doc, aif-doctor, arch, claude-glm-executor-handoff, dispatcher, harvest,
  night-mode, orchestrator, pipeline, reviewer, rule-research, rule-tests, self-reflection,
  story, template-audit, tool-bootstrapping (16 tracked under `.claude/skills/`) + **two** root
  skills, `skills/getff` **and `skills/tool-bootstrapping`** — the harvest round's 276th row.
  The root `tool-bootstrapping` shares a name with the tracked `.claude/skills/tool-bootstrapping/`
  but is a different artefact on a different delivery path, so it is a row of its own (see
  the paragraph above, `gen-census.mjs:74`, and §self-falsification item 6); counting the pair
  as one is exactly the omission that hid it. *25 further on-disk dirs (`aif`, `aif-*`) are gitignored container-local
  consumer skills (`.gitignore:115`), not framework cargo — the naive count 41 is misleading.*
- **agents (20):** adapter-jig-reviewer, aif-init, backward-sweep-auditor, capability-reuse-auditor,
  claims-conformance-auditor, compliance-verifier, dispatch-input-checker, docplan-auditor,
  dual-channel-drift-auditor, fidelity-auditor, getff-cold-run-prober, living-docs-auditor,
  manual-rule-liveness-prober, memory-codification-auditor, orchestrator-worker-discipline,
  review-sidecar, reviewer-discipline, rule-researcher, rule-test-author,
  shipped-agent-liveness-prober.
- **discipline rules (30):** 00-rule-index, ai-laziness-digest, ai-laziness-traps,
  attention-is-not-a-mechanism, autonomous-loop-continuity, build-first-reuse-default,
  ci-tool-pinning, cold-seat-economy, companion-install-principle,
  destination-environment-verification, doc-authority-hierarchy, dual-implementation-discipline,
  effort-worthiness, egress-no-api-bypass, evidence-regeneration, git-conflict-merge-forward,
  kickoff-staging-placement, language-discipline, memory-codification, no-paid-llm-in-ci,
  parallel-subwave-isolation, phase-research-coverage, recommendation-laziness-discipline,
  research-source-trust, reviewer-discipline, rule-enforcement-channel-selection,
  seat-lifecycle, skill-description-quality, source-before-shape, zcode-parity-doctrine.
- **hooks (25):** adopt-orchestrator-prompts, ask-question-reminder, check-doc-authority-header,
  check-doc-authority, check-hook-marker, check-kickoff-traps, check-worker-dispatch-channel,
  deps-hash-check, end-of-turn-reminder, inject-matching-rule, inject-memory-codification,
  inject-output-language, inject-project-digest, inject-session-bootstrap, inject-subagent-context,
  inject-subagent-digest, lang/{check-parity,en,ru}.sh, lib/hook-emit.sh, precompact-residue,
  runtime-bridge-dispatch, validate-prompt, warn-subagent-report, worktree-setup.
- **hook checks (25):** 13 production (cmd-script-liveness, guard-liveness-fullsweep,
  guard-liveness, pr-body-fidelity-bin, pr-body-fidelity, pr-body-prior-art-bin,
  pr-stale-revert-bin, pr-stale-revert, prior-art, registry, s17, skill-core-edit-scope,
  unpinned-tool-install) + 12 `*.test.ts`.
- **principles (47):** `01`–`44` family per `logs/population-enumeration.md` §C6.
- **templates (6):** packages/core/templates/{cargo, go, python, react-next, shared} +
  root `templates/ts-server/`.
- **lint bundles (8):** core eslint-rules (4 rules + index), consumer barrel eslint-rules-local,
  astgrep ymls ×4, clippy.toml, deny.toml, .golangci.yml, ruff.toml, ts-server eslint.config.mjs.
- **MCP config (1):** context7 wiring (`setup.d/05-mcp.sh`). **companions (6):** superpowers,
  runtime-bridge, deepwiki, ast-grep-cli, ast-grep, aif-handoff.
- **CI workflows (5):** ci.yml, workflow-integrity.yml (ts-server) + cargo/go/python lanes.
- **scripts (85):** repo `scripts/` (62, full list in `logs/population-enumeration-2.md` §C11)
  **+ the installer's real consumer-script sources (23)** delivered by `setup.d/40-configs.sh:14-54`:
  11 `packages/core/audit-self/*.sh` + **9** `audit-self/fixtures/fences-fire` files (delivered as
  `scripts/fences-fire-fixtures/`; 6 of the 9 land, and 3 — `no-server-imports-in-client.*` — are
  react-next-stack-gated and undelivered on this ts-server fixture) + `packages/core/probes/audit-r4.ts`
  + 2 `packages/core/synthesizer/run-*.sh`. **11 + 9 + 1 + 2 = 23.** (Cold review M1: this
  sentence previously read «6 … 3 of the 6», which summed to 20, not the 23 claimed on the line
  above and carried correctly in `meta.spec_corrections` and in the census's 9 fixture rows.) Round 1 enumerated only the repo side, leaving 20
  delivered files with no row (rework round-2 BLOCKER); addendum `logs/population-enumeration-2.md` §C11b.

**Spec corrections surfaced by enumeration (recorded, not fixed):** (1) CI workflow sources live
at root `templates/<stack>/github-actions-*.yml` — the kickoff's
`packages/core/templates/**/workflows` matches nothing; (2) `.getff/astgrep-rules` exists only
under `packages/core/templates/python/` (same for clippy/golangci/ruff under cargo/go/python);
(3) `hooks` authoring count 29 is unreproducible — tree truth is 25; (4) skills 16 holds only
for the *tracked* population.

## §method

- **Three installs, fresh dirs** (`logs/install-{core,env,factory}.log`, dirs in
  `logs/consumer-dirs.txt`): each `mktemp -d` + minimal `package.json` (typescript dep →
  deterministic ts-server auto-detect, `setup.d/lib.sh:1630`) + `git init`;
  `bash install.sh --profile <p> </dev/null`. All three **exit=0** (core 95 files hashed,
  factory 105; no `npm install` ran — dev-dep install is `--full`/interactive-gated,
  `setup.d/70-deps.sh:309-320`). **Round-2 re-run** (benches are ephemeral; the census must
  come from live trees — rework round 2): `logs/install-{core,env,factory}-r2.log`, dirs in
  `logs/consumer-dirs-r2.txt`, seeded the same way, all three **exit=0** with log line counts
  identical to round 1 (179/198/228) and trees re-measured at the same truth (agents 11/11/13,
  scripts 20/24/25, skills 6/11/16, `.claude/rules` absent ×3).
- **DELIVERED measured on the trees, never on the logs** (domain trap T-CTA-A): full
  `find`-based inventories per profile (`logs/delivered-tree-measurement.md` §M2-§M7);
  symlink audit: 0 links in all three trees (§M3).
- **WORKS severing — layered substitution** (recorded, per plan decision 1):
  **L1** escape-grep over every delivered artefact (factory absolute paths, `/Users/` host
  paths, 3+ `..` traversals); **L2** execution of every delivered hook (representative CC
  stdin payloads, cwd=consumer) + 12 scripts ×2 profiles + `.husky/pre-push`/`pre-commit`;
  **L3** rename-sever window — factory path genuinely absent (`test -e $REPO` → gone) while the
  consumer re-ran key artefacts. `unshare -m` is EPERM in this container, so OS-level
  namespacing was unavailable; the substitution is recorded rather than silently dropped.
  **Factory control** ran for every defect claim (§findings F1: same probe passes on the
  factory with npm's own workspace symlinks).
- **L3 incident + full recovery, zero data loss:** the rename crossed filesystems
  (`/tmp` dev 64 vs `/home/www` dev 42) and its restore degraded to copy+delete, which cannot
  read the 745 handoff-prepared mode-200 (write-only) files. Detected immediately (file-count +
  `git status` → exactly 2 tracked files missing); recovered via owner-identity `chmod u+r` +
  byte copy-back with mode re-application; verified (`comm` residual 0, `git status` clean —
  tracked content byte-identical to HEAD, 0/745 size mismatches). Full record:
  `logs/works-checks.md` §L3. **Method lesson recorded there: rename-severing is safe only
  same-filesystem on trees without unreadable-owner files; the severed-window results themselves
  are valid.**
- **Harvest-round HOST re-measurement (cold review I2 + I4 + recommendation 3).** The census
  above was measured inside the agent container. Three **fresh host installs** (macOS) were then
  built the same way (`mktemp -d` + minimal `package.json` + `git init`, then
  `bash install.sh --profile <p> </dev/null` from inside the target dir), all three **exit=0**,
  and `gen-census.mjs --check` re-derived every row against them: **0 delivered disagreements,
  artefact sets identical (276/276)**. Two things this closes:
  - **I2 — the container's factory bench had silently degraded.**
    `logs/install-factory-r2.log:222-226` records
    `[aif-handoff-guided-install] state=absent: degrade to env-level`, i.e. the `factory` column
    was measured on a degraded install, and the report never said so. On the host the same step
    reads `state=up at http://localhost:3009` → `no-op (detect-first)`, so the host factory bench
    is **not** degraded — and the `delivered` column came out identical. The degradation
    therefore did not move the result, but the lane had no right to assume that; it is stated
    here rather than left implicit.
  - **I4 — a logged command that did not reproduce its own output.** `logs/works-checks.md` §L1
    prints the escape-grep with four `--include` filters while listing hits in `.prettierignore`
    and `*.md`, which no such filter can pass. Re-run literally on a host bench: as written → **0
    hits**; without the `--include` filters (`grep -rn --exclude-dir=.git '/home/www\|rules-as-tests-aif' .`
    piped through `grep -v refresh-baseline`) → **4 hits**, exactly the four in the log. The
    number was right, the transcribed command was a reconstruction. Corrected in that log; the
    lesson (log the literal command, not a tidied one) is the operative fix.
  - **M8 — one bench-dependent number.** `audit-ai-docs.sh` yields `5 PASS / 0 FAIL / 1 WARN` on
    the container bench and `4 PASS / 0 FAIL / 2 WARN` on the host. Not a defect: the WARN is
    the empty-project warning, which flips on bench contents. Treat that line as bench-scoped.
- **Aged stratum:** **measured on the host in the harvest round** (was host-scoped N/A in the
  container) — `host-verify-aged.sh` now performs the 3-bucket join itself and was run against a
  real aged consumer install; see §aged-stratum deltas and `logs/aged-stratum-join.md`.

## §census summary

| verdict | rows | meaning |
|---|---|---|
| BY-DESIGN | 273 | consistent with documented design — **every row carries a `by_design_citation`** (gate 8: 0 without) |
| DOC-LIES | 2 | delivered content that misdirects on a consumer host (F2, F5) |
| BROKEN | 1 | delivered and unable to do its job anywhere outside the factory (F1) |
| NOT-BUILT | 0 | — |

> **Read this column with its known weakness.** The kickoff §4 enum has no value for «delivered
> and healthy, exactly as designed», so 273 of 276 rows collapse into `BY-DESIGN` carrying a
> shipping-layer citation. That makes `verdict` nearly information-free and gives a real
> `DOC-LIES` somewhere to hide — which is precisely what happened to F5 in round 2, found by the
> harvest-round cold review rather than by the column. The fix is a schema change (`SHIPPED` /
> `HEALTHY` as a distinct value) owned by the umbrella kickoff, not by this lane; it is filed as
> a parked question for the triage pass and for V1's schema.

DELIVERED matrix (tree truth): skills 6/11/16 · agents 11/11/13 · **rules 0/0/0** · hooks
11/11/12 · checks 5/5/5 (of 13 prod) · principles 0/0/0 · scripts 20/24/25 · workflows 2/2/2 ·
MCP 0/0/0 · companions 0/0/0.

## §findings

One per non-BY-DESIGN row, most severe first; each with a concrete failure scenario and a
proposed fix (not applied — §6). Two supplementary context findings (F3, F4) sit on BY-DESIGN
rows whose consumer-experience implications the triage pass should still weigh.

### F1 · BROKEN · `packages/core/hooks/checks/guard-liveness.ts` — delivered gate that can never load outside the factory

- **Artefact truth:** HAS=true, DELIVERED=true in **all three profiles** (consumer trees,
  `logs/delivered-tree-measurement.md` §M4), WORKS=false everywhere delivered.
- **Mechanism (quoted):** line 34 `import presetPlugin from '@rules-as-tests/preset-next-15-canonical/eslint-rules';`
  — the package is **not delivered** (consumer `packages/` carries only `core/hooks` +
  `core/eslint-rules`), **not declared** (consumer package.json devDeps: husky, lint-staged,
  sort-package-json), **not published** (absent from the documented `npm install` line,
  `install-core.log` Next steps 4), and **not reachable** (npm workspace symlinks exist only
  where `workspaces: ["packages/*"]` covers it — the factory root package.json).
- **Concrete failure scenario:** a consumer on any profile follows INSTALL next-steps exactly
  (`npm i -D … tsx@^4.22.4 …` → the `.husky/pre-push` probe `node --import tsx/esm -e ''` now
  succeeds → full TS-core path armed) and pushes a commit that touches a manifest rule →
  `pre-push.ts:519` lazy-imports the gate → `ERR_MODULE_NOT_FOUND` (proven live with
  everything-else-installed) → `pre-push.ts:522-527` `die('❌ guard-liveness: failed to load
  the ESLint stack … run \`npm install\` at the repo root')` → **push blocked by remediation
  that cannot work** — there is no root install that can materialize the package in a consumer.
- **Mandatory control (factory):** same probe on the factory after its own npm install —
  npm itself creates `node_modules/@rules-as-tests/preset-next-15-canonical` → import
  **RESOLVED**, `guard-liveness.ts` **LOADED OK**. Pass-only-on-factory = exactly the
  `runtime-bridge-dispatch.sh` defect class this lane hunts (umbrella §1).
- **Proposed fix (for triage):** (a) drop the preset import from the delivered copy (merge the
  core rules only; the preset arm is factory-CI concern), or (b) make the import conditional
  with a visible SKIP notice — the file's own header documents exactly this pattern for
  unavailable plugins (R5/R15/R16 are «skipped with a visible SKIP notice — not failures»), so
  the fix is symmetric with the file's own design.

### F2 · DOC-LIES · `.claude/skills/orchestrator/` (env+factory) — delivered docs hard-code the author's host path

- **Artefact truth:** delivered env+factory; works as docs, but 5 lines instruct operations
  against `/Users/art/code/rules-as-tests-aif`: `references/worker-template.md:73`
  (`cd /Users/art/code/rules-as-tests-aif && npm run test:principles`), `:82`, `:107`,
  `references/reviewer-template.md:37`, `references/ai-laziness-traps-orchestrator.md:131`.
- **Concrete failure scenario:** a factory-profile consumer's dispatched worker reads the
  worker template and `cd`s to a path that is (at best) a different project or (at worst)
  non-existent on their machine — the acceptance loop the template prescribes
  (`npm run test:principles`) runs against the wrong tree or fails confusingly.
- **Evidence:** `grep -rn '/Users/art' <consumer>` → 5 hits, all inside this skill
  (`logs/works-checks.md` §L1 finding precision; core is clean of this form).
- **Proposed fix:** template-ize the repo path (`<AIF_REPO_ROOT>` placeholder resolved at
  install or from `git rev-parse --show-toplevel` at read time), matching the existing
  `<WORKDIR>` placeholder convention in the same file (`worker-template.md:107`).

### F3 · context (BY-DESIGN row) · host-scoped memory defaults shipped in delivered agents/helpers

`.claude/agents/memory-codification-auditor.md:37` (delivered **core**+) defaults the memory
dir to `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/` — the author's host
layout, dashed-form; `pipeline/helpers/priority-score.sh:54` (factory) defaults `MO_MEM_DIR`
the same way. Override-able, so BY-DESIGN — but a consumer following the doc verbatim reads a
memory dir that does not exist on their machine. Proposed fix: derive the default from the
local project path (`pwd`-dashed) at read time.

### F4 · context (BY-DESIGN row) · first push blocked on fresh consumers by the armed rule-glob alarm

`.husky/pre-push` (full or fallback) runs `check-rule-globs.sh`; on a fresh install with no
`src/handlers|routes|controllers` layout the boundary globs match zero files → exit 1 →
**git push blocked** until the consumer widens `RULE_GLOBS.boundary` or creates matching dirs.
The installer does warn at install time («R2 boundary layout ambiguous → leaving
scripts/check-rule-globs.sh as the alarm») and the hook message is actionable, so the row is
BY-DESIGN (`setup.d/40-configs.sh:19` «silent-inertness alarm») — but the consumer-experience
sequence (install says ✓ → first push fails) is worth a triage look: e.g. downgrade to a
warning while the project has zero source files.

### F5 · DOC-LIES · `.claude/hooks/inject-matching-rule.sh` — a delivered hook whose own header states the opposite of what installs

Found by the harvest-round cold review (C1) — **the census had missed its own umbrella's
generating defect**, in the very artefact whose consumer-side consequence F-adjacent rows
already describe.

- **The claim.** `.claude/hooks/inject-matching-rule.sh:28-31` (delivered verbatim to every
  profile): «SHIP status (GH #934): **NOW SHIPPED to consumer CC projects — consumers DO get
  `.claude/rules/*` installed**, and without this hook that rules channel is cold-load only.»
- **What actually installs.** `setup.d/LAYERS.md:79` states the opposite for the same
  directory: `transform_internal_refs` rewrites `.claude/rules/` references in delivered docs to
  upstream blob URLs precisely because «**rules/ is not shipped**» — corroborated at
  `setup.d/20-agents.sh:44`. Measured on all three host benches: `.claude/rules` is **absent**
  in core, env and factory (`ls … | wc -l` → 0 ×3), which is the same 0/0/0 the DELIVERED matrix
  above already reports for rules.
- **It is not dead code.** `.claude/settings.json` in every profile registers the hook
  (9 registrations over 8 distinct scripts, identical in all three — re-measured, see M2 below),
  so it fires on a real consumer and reaches its own «no rules corpus found … nothing to inject»
  branch every time.
- **Concrete failure scenario:** a consumer (or an agent reading the consumer's own tree, which
  is the audience this repo exists for) opens the delivered hook to find out whether the rules
  channel is live, reads line 28, and concludes the corpus is installed and the injection path
  is armed. It is not: the directory does not exist, the hook no-ops, and every rule reference
  in the delivered docs has already been rewritten to a GitHub URL. The reader is misdirected by
  a shipped artefact — the definition of `DOC-LIES` in this umbrella.
- **Runtime safety is not the issue.** The hook degrades to exit 0 when the rules dir or `jq`
  is absent, so nothing breaks; the defect is the assertion, not the behaviour.
- **Proposed fix (for triage, not applied — §6):** either correct the header to state the
  shipped truth (rules are framework-internal; the consumer channel is the rewritten blob URLs),
  or ship `.claude/rules/` and make the header true. The two are a genuine product fork; this
  lane only records that today's tree cannot satisfy both.

### Adjudications (findings the logs raised and the census left unresolved)

- **13 «escape the project root» hits — all guarded fallbacks, no finding** (cold review I6).
  The kickoff §3 says «any artefact that resolves a path outside the consumer project root is a
  finding by construction», and `logs/works-checks.md` §L1 dutifully logged 13 `../../..` hits
  per profile, but no census row and no §findings entry ever adjudicated them. Verified at
  source in this round, on the framework copies:
  - `packages/core/audit-self/check-shields-up.sh:33,35` and
    `packages/core/audit-self/check-fences-fire.sh:73,75` — the `../../../packages` arm is the
    **last** branch of a four-way root resolution: `AIF_PROJECT_ROOT` → (shields only) git
    toplevel → **the consumer arm** `[ -d "$SCRIPT_DIR/../scripts" ] && [ -d "$SCRIPT_DIR/../node_modules" ]`
    → the framework arm, itself gated on `[ -d "$SCRIPT_DIR/../../../packages" ]`, → `$(pwd)`.
    In a consumer the script sits at `scripts/`, one level deep, so the consumer arm wins and
    the traversal is never evaluated.
  - `check-fences-fire.sh:180,189` — tail entries of the tsx / eslint binary search lists, each
    behind `[ -x "$_t" ]`; a miss just falls through to the next candidate.
  - `packages/core/synthesizer/run-generated-rule-mutation.sh:47` — reached only when
    `git rev-parse --show-toplevel` returns nothing (non-git checkout); the comment at :33-39
    documents that the *previously fixed* bug was exactly a fixed `../../..` escaping a
    consumer root.
  **Verdict: no finding.** Every traversal is a guarded fallback behind a consumer-first branch.
  Recorded here so a reader of the census does not have to re-derive it — and so the kickoff's
  «by construction» rule is answered rather than quietly dropped.

### Supplementary observations (rows BY-DESIGN, recorded for triage)

- **MCP axis mismatch:** `setup.d/05-mcp.sh:13` gates on `FULL` (the deps-consent flag), not on
  `PROFILE` — no `--profile` run ever writes `.mcp.json`; a factory-depth consumer gets zero
  MCP wiring unless `--full` is also passed. Depth-vs-consent axes arguably want decoupling.
- **Companions are display-only in the non-interactive flow:** `install.sh` prints
  «6 companion(s) selected» and delivers nothing; installs are consent-gated in the
  interactive `setup` wrapper (`setup.d/15-companions-stack.sh:58-65`,
  `companions.manifest:5-14`). Documented design; the silent gap between «selected» and
  «installed» is easy to misread in the install log.
- **`self-reflection` intentionally unshipped** — positive control that the census would have
  flagged as an anomaly is in fact documented (`setup.d/10-skills.sh:121`).

## §aged-stratum deltas

**MEASURED in the harvest round** (it was «N/A — host-scoped, never faked» through round 2, and
that was honest *in the container*: `/Users/art/code/timeliner/.claude` does not exist there —
`logs/entry-verification.md` §Check 4).

Two things changed, both from cold review I5. First, `host-verify-aged.sh` used to accept
`fresh-census.json`, do **nothing** with it, and print the three bucket definitions followed by
«(Join performed manually or by the triage pass…)» — a load-bearing check whose only mechanism
was that someone would do it later, i.e. the `#hope-as-gate` shape of
[`attention-is-not-a-mechanism.md §2`](../../rules/attention-is-not-a-mechanism.md). Both sides
of the join were already in hand, so the join is **implemented in the script** now. Second, it
was run on the host against a real aged consumer install:

```text
$ bash host-verify-aged.sh /Users/art/code/timeliner census-v0.json   # exit 0
shipped-since     4    never-shipped    21    consumer-authored     5
```

- **shipped-since (4)** — `claims-conformance-auditor.md`, `runtime-bridge-dispatch.sh`,
  `skills/claude-glm-executor-handoff/`, `skills/reviewer/`: they ship today and are absent from
  the aged tree, so that install is STALE with respect to them. Not a delivery defect. This
  confirms the round-2 falsifiable prediction (`logs/aged-stratum.md`) only in direction, not in
  magnitude: skills are 2 of the 4, not dominant.
- **never-shipped (21)** — absent from the aged install AND `delivered=false` in all three fresh
  profiles: operator-side machinery that reaches no consumer, consistent with the census's own
  BY-DESIGN rows for the same artefacts (`setup.d/LAYERS.md:10`). This bucket **cross-checks**
  the `delivered=false` column against a real install rather than adding a new claim.
- **consumer-authored (5)** — `aif-upstream-drift-check.sh`, `check-kickoff-on-staging.sh`,
  `building-native-ui`, `pr-template-multi-phase`, `vercel-react-best-practices`: the consumer's
  own artefacts. Never delete on this signal alone (kickoff §3 caveat).

**Two limits, stated not smoothed (T14).** (a) One aged install, so these are *that* install's
deltas, not a population statistic. (b) The inventory walks only **skill, agent, hook** — the
three classes whose names the census artefact keys also carry; every other class is printed
under `NOT-COMPARED` with its row count (`principle 47, script 85, discipline-rule 30,
hook-check 13, hook-check-test 12, lint-bundle 8, template 6, companion 6, ci-workflow 5,
mcp-config 1`) rather than dropped, so the covered set cannot be mistaken for the whole census.
A `shipped-since` or `consumer-authored` artefact in any NOT-COMPARED class is invisible here.
Full run, reading and limits: [`logs/aged-stratum-join.md`](logs/aged-stratum-join.md). The
script's exit contract is unchanged (0 = measured, 3 = aged root absent, 4 = not an install);
it no longer writes its JSON into the repository (cold review M7 — output defaults to
`$TMPDIR`, overridable with `AGED_OUT`).

## §coverage

- **HAS × DELIVERED: 276/276 rows** (`census-v0.json`) — every artefact of the enumerated
  population, per profile, from tree measurement. No sampling anywhere in the column (T1).
- **What each column can and cannot discriminate** (cold review M3/M5/M6 — stated so a reader
  does not over-read the JSON):
  - `has` is **degenerate by construction**: 276/276 `true`, because the population *is* the set
    of artefacts the framework has. It carries no information; of the kickoff §0 questions only
    `delivered` discriminates fully, and `works` partially.
  - `aged_install` is likewise one value across all 276 rows — it is a property of an *install*,
    not of a row. The aged answer lives in §aged-stratum deltas, not in this column.
  - `works` is constant **within** several classes (companion 1 distinct value over 6 rows,
    discipline-rule 1/30, principle 1/47, hook-check-test 1/12, hook 3/25 — 4/25 after F5). The
    measurements underneath are per-file (§L2), but the JSON does not show that granularity;
    treat a class-constant `works` as a class-level statement.
  - `evidence` carries substance unevenly: 30 distinct strings over 276 rows, of which 102 hold
    a command-like token and 12 a `file:line`; the rest point into `logs/`. `gate-check.md`
    Gate 3(a) only asserts the key *exists* — that arm is `#hope-as-gate` and should not be
    read as a substance check; the substance is carried by Gate 3(b) and by
    `gen-census.mjs --check`, which re-derives the `delivered` column mechanically.
  - `artefact` mixes **framework-source** and **consumer-landing** paths: 54 of the 276 keys do
    not exist in the repository tree (all 20 `.claude/agents/*`, the 23 consumer scripts, 4 CI
    rows, 6 companions, `eslint-rules-local/`). Resolving a key therefore requires knowing the
    per-class convention. For the machine consumers (V1/V2) the right fix is an explicit
    `source` field; recorded as a parked schema question rather than changed here, because the
    key shape is what V1/V2's kickoffs were written against (cold review M4).
- **WORKS: exercised vs reasoned, stated exactly.** Executed severed: 11 hooks ×3 profiles with
  representative payloads (§L2/§L2b), `.husky/pre-push` + `.husky/pre-commit`,
  `audit-ai-docs.sh` (documented acceptance), `deps-hash-check`, `lang/check-parity`, 12
  scripts ×2 profiles with exit codes (§L2e), the guard-liveness load probe + isolated import
  probe (§L2d), and the L3 window re-run of 4 artefacts. Reasoned-from-code (load path read,
  not executed): rows whose `works` field says so — e.g. consumer-side `prior-art` section
  behavior on a live push is marked `INCONCLUSIVE-needs-live-push`; unexercised delivered
  scripts carry «same layer as the exercised set», individually named.
- **Not reached, and why:** (1) aged stratum — host-only path (contract emitted); (2) a live
  consumer `git push` through the full hook suite — the fixture has no remote/commits by
  design; the push-blocking consequences were established via direct hook invocation instead;
  (3) non-ts-server stacks (react-next/react-spa/react-native) and the cargo/go/python
  toolchain lanes — the kickoff's benches are the three profiles at the ts-server stack; the
  lane-gated rows carry the INERT citations (`setup.d/LAYERS.md:28-29` — the 45-python and
  46-cargo rows; `:30` is the unrelated 50-hooks husky row) rather than executed
  evidence.
- Per T14: the clean rows are clean **at the exercised depth**; coverage limits above are part
  of the result, not a footnote.

## §self-falsification

What would catch a row that is wrong (T15 — the audit of this census):

1. **Re-derive, for real (executable since round 2):** `node gen-census.mjs --check` re-derives
   every row's `delivered` from live trees — roots via `--repo/--core/--env/--factory` or
   `CENSUS_*` env (container bench as default), mechanical classes by list membership, static
   classes by file probes — and **exits non-zero on any disagreement, writing nothing**. It
   discriminates: against the round-1 census it exits 1 with **40 findings** (the 9 agent rows
   inverted by the dbool-object bug, the 5 script rows inverted by the prefix mismatch, the
   phantom `ts-server-configs` row, the mis-pathed `eslint-rules-local` row pair, and the 23
   never-enumerated consumer-script sources); against the round-2 census it exits 0 with zero
   disagreements. Both runs are quoted in `logs/gate-check.md` §Gate 3. Stated scope limit:
   `--check` verifies the `delivered` column and the artefact sets only — the hand-authored
   `works`/verdict/citation texts are the part it cannot judge; those stay reviewer-checked
   (citations quoted verbatim in the JSON, each checkable against the named file:line in
   minutes).
2. **The DELIVERED-from-log trap was caught live once already:** companions «selected» in the
   log but absent from every tree (M5) — a log-trusting census would have emitted 6 false
   delivered=true cells. Any row whose evidence cites an install log rather than a tree is
   suspect by that precedent.
3. **The parity probe caught a second trap:** env/factory `inject-matching-rule` appeared
   silent vs core — that was the hook's once-per-session cache keyed by session_id, not a
   delivery difference; a fresh session_id restored identical behavior. Hook results that
   differ between profiles should be re-run with fresh session ids before being believed.
4. **Host re-verification is load-bearing** (destination-environment-verification): the census's
   central delivery claims were measured in a Linux container against macOS-authored scripts.
   The host re-runs `bash install.sh --dry-run </dev/null` (host-verify contract) and — for
   full closure — `host-verify-aged.sh` against the real aged install. A host run whose tree
   inventories diverge from `consumer-dirs.txt` trees falsifies the corresponding rows.
5. **What I would audit if auditing this audit:** (a) the verdict assignments on the 273
   BY-DESIGN rows — the enum has no «healthy» value, so healthy rows are BY-DESIGN with the
   shipping-design citation; a stricter reading would demand a distinct SHIPPED value (a spec
   gap worth fixing in V1's schema). **This one stopped being hypothetical:** the harvest-round
   cold review found exactly the predicted failure — a real `DOC-LIES`
   (`.claude/hooks/inject-matching-rule.sh`, §findings F5) sitting in the BY-DESIGN bulk,
   defaulted there by the hook loop because the enum had nowhere else to put a delivered,
   runtime-safe artefact. Round 2 predicted the hazard in this very paragraph and still shipped
   an instance of it, which is the strongest argument available for changing the enum before
   V1; (b) the L3 window's evidence validity — recorded with its
   incident + recovery in full so a reviewer can judge rather than trust; (c) the 8
   delivered-but-unexercised script rows (6 `fences-fire-fixtures` + `check-rule-enforced.sh` +
   `r2-na-marker.sh`; «same layer» reasoning) — the cheapest falsifier is running them;
   (d) the profile-model assumption that `core` vs `env` differ only in the
   contour skills — env delivered 69 more `.claude` files than core, all under the 5 contour
   skill dirs, but a per-file diff of the two trees was not enumerated in V0.
6. **What the harvest round's cold review caught that neither the verifier nor this section
   did (T15, honest scoring):** the review found 1 Critical + 6 Important + 8 Minor. Of those,
   the two that matter methodologically are (a) F5 above — a verdict the column was
   structurally unable to surface, and (b) I1 — a hardcoded `'skills/getff'` literal that made
   `--check` **blind to its own omission**, because both sides of the comparison were derived
   from that same literal. (b) is the general lesson: a mechanical verifier only falsifies the
   parts of a claim it derives *independently*; anything both sides read from one constant is
   outside its reach, and needs the phantom-guard shape (throw on an un-enumerated member) that
   the templates block already used and the skills block did not. Both are fixed and re-verified;
   the per-file `delivered` fix (I3) closes the same class for the 77 rows that previously shared
   one directory-existence value across 30 rules and 47 principles. **And the fix's own
   consequence escaped this section too:** the fidelity audit of the harvest round (round 1)
   found §population still reading «skills (17)» against a regenerated census carrying 18 —
   the prose was reconciled against the census by attention, not by a command. §population now
   carries the `jq` group-by that re-derives every class count, so the reconciliation is
   re-runnable instead of asserted ([attention-is-not-a-mechanism.md:17](../../rules/attention-is-not-a-mechanism.md));
7. **What the verifier caught on its own first run (T15, round 2):** two rows the round-1
   hardcoded matrix had wrong in ways the block's own evidence hid — (a) `eslint-rules-local`
   lands at the consumer ROOT (install log: «Custom ESLint rules → eslint-rules-local/»), not
   `packages/core/` — row renamed, probe re-pathed; (b) `.claude/vendor/runtime-bridge` in the
   factory tree is the `55-runtime-bridge-vendor.sh` layer already censused as its own hook row,
   so the companion-class probe excludes `.claude/vendor/` explicitly instead of double-counting
   it, and the row's evidence string names the dir so a machine reader sees the adjudication.
