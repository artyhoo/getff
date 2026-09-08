# consumer-truth-audit V0 — the delivery census (report)

> **Deliverable pair:** machine-readable `census-v0.json` (275 rows, one per artefact) + this report.
> **Rigor label:** research-grade (kickoff L0). **Lane discipline:** measure only — no fixes (§6);
> every finding below carries a proposed fix for the triage pass, none applied.
> **Round:** 2 — regenerated from re-run benches after the round-1 `delivered` derivation
> defects (rework BLOCKER + MAJOR 1/2); the generator is now also a runnable verifier
> (`gen-census.mjs --check`).
> Evidence logs: [`logs/`](logs/) — `entry-verification.md`, `population-enumeration.md`,
> `install-{core,env,factory}.log` (+ `-r2.log` re-run), `consumer-dirs.txt` (+ `-r2.txt`),
> `delivered-tree-measurement.md`, `works-checks.md`, `aged-stratum.md`.

## §population

Enumerated 2026-09-08 on the factory at `feature/consumer-truth-audit-55b9ad` (T10: full lists
before any coverage claim; per-file lists with line numbers in `logs/population-enumeration.md` + `-2.md` (C9-C11 + drift),
comma-joined here). **Denominator: 275 artefacts** — the row set of `census-v0.json`
(`meta.population_total`); the per-class list below sums to 275 and is the same population.
Round 1 stated 252/253 here while the census carried 253 rows including a phantom template
row — fixed by making both deliverables derive from one enumeration.

- **skills (17):** ai-doc, aif-doctor, arch, claude-glm-executor-handoff, dispatcher, harvest,
  night-mode, orchestrator, pipeline, reviewer, rule-research, rule-tests, self-reflection,
  story, template-audit, tool-bootstrapping (16 tracked under `.claude/skills/`) + root
  `skills/getff`. *25 further on-disk dirs (`aif`, `aif-*`) are gitignored container-local
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
  11 `packages/core/audit-self/*.sh` + 6 `audit-self/fixtures/fences-fire` files (delivered as
  `scripts/fences-fire-fixtures/`; 3 of the 6 — `no-server-imports-in-client.*` — are
  react-next-stack-gated and undelivered on this ts-server fixture) + `packages/core/probes/audit-r4.ts`
  + 2 `packages/core/synthesizer/run-*.sh`. Round 1 enumerated only the repo side, leaving 20
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
- **Aged stratum:** host-scoped N/A with probe evidence + `host-verify-aged.sh` (see below).

## §census summary

| verdict | rows | meaning |
|---|---|---|
| BY-DESIGN | 273 | consistent with documented design — **every row carries a `by_design_citation`** (gate 8: 0 without) |
| DOC-LIES | 1 | delivered content that misdirects on a consumer host (F2) |
| BROKEN | 1 | delivered and unable to do its job anywhere outside the factory (F1) |
| NOT-BUILT | 0 | — |

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

**N/A — host-scoped, never faked.** `/Users/art/code/timeliner/.claude` does not exist in this
container (`ls` → No such file or directory, `logs/entry-verification.md` §Check 4). Coverage
impact is stated, not smoothed: aged stratum = 0 artefacts measured (T14: this is «unreached»,
not «clean»). The maintainer-side contract is emitted at
[`host-verify-aged.sh`](host-verify-aged.sh) (read-only enumeration → `aged-inventory.json`,
exit 3 = absent, exit 4 = not an install) with the §3 bucket template and a falsifiable
prediction (`logs/aged-stratum.md`: shipped-since should dominate skills, given the install
predates the contour/operator split).

## §coverage

- **HAS × DELIVERED: 275/275 rows** (`census-v0.json`) — every artefact of the enumerated
  population, per profile, from tree measurement. No sampling anywhere in the column (T1).
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
   gap worth fixing in V1's schema); (b) the L3 window's evidence validity — recorded with its
   incident + recovery in full so a reviewer can judge rather than trust; (c) the 8
   delivered-but-unexercised script rows (6 `fences-fire-fixtures` + `check-rule-enforced.sh` +
   `r2-na-marker.sh`; «same layer» reasoning) — the cheapest falsifier is running them;
   (d) the profile-model assumption that `core` vs `env` differ only in the
   contour skills — env delivered 69 more `.claude` files than core, all under the 5 contour
   skill dirs, but a per-file diff of the two trees was not enumerated in V0.
6. **What the verifier caught on its own first run (T15, round 2):** two rows the round-1
   hardcoded matrix had wrong in ways the block's own evidence hid — (a) `eslint-rules-local`
   lands at the consumer ROOT (install log: «Custom ESLint rules → eslint-rules-local/»), not
   `packages/core/` — row renamed, probe re-pathed; (b) `.claude/vendor/runtime-bridge` in the
   factory tree is the `55-runtime-bridge-vendor.sh` layer already censused as its own hook row,
   so the companion-class probe excludes `.claude/vendor/` explicitly instead of double-counting
   it, and the row's evidence string names the dir so a machine reader sees the adjudication.
