# lane-config-insertion — umbrella kickoff (toolchain lanes insert getff's bans into the consumer's own lint config)

> **Class:** umbrella kickoff — a plan that dispatches five stage kickoffs (`kickoff-l1.md` …
> `kickoff-l5.md`); it is not itself a buildable task.
> **Rigor label (L0): `build-and-verify`** — five install-surface build stages, each gated by
> RED-first tests, live tool probes and the lane suites.
> **Design SSOT:** [docs/superpowers/specs/2026-09-28-lane-config-insertion-design.md](../../../docs/superpowers/specs/2026-09-28-lane-config-insertion-design.md)
> (DRAFT r4, operator-approved; §2 premises P1-P7 binding, §8 decisions D1-D12 all answered or
> decided). This file never restates the design; on any divergence between a kickoff and the
> spec, **the spec wins** — the executor parks the divergence, never improvises past it.
> **Authoritative for:** the stage split and its rationale, dependencies, the file-lock matrix,
> stage-gate commands, stop conditions, the descope-ownership register, the binding execution
> rules. **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> any design decision — the spec.
> **Base branch:** `staging`. **Dispatch precondition:** this directory AND the spec are merged
> to `staging` (kickoff-staging-placement §1) and PR #1890 is merged (§3 gate 0).
> **Tier routing:** each plan-complete stage kickoff carries the executor-profile header marker;
> value and evidence in §6 below.

**Measurement SHA for every `path:line` below and in the stage kickoffs:** `origin/staging` =
`b3a19811be6`, measured 2026-09-29. PR #1890 (OPEN, head `8c82c1a1e7b`,
`fix/install-no-manual-steps-lanes`) rewrites the three lane files and `setup.d/99-finalize.sh`;
anchors that exist only on that branch are marked «#1890» and MUST be re-located by content
(`grep -n`) after #1890 merges — every stage starts after it, so every staging anchor in the
lane files is stale by then too. Re-locate, never trust a number.

## §0 Binding execution rules (every stage)

1. **Operator floors (verbatim, Q4.7 2026-09-28; spec P1-P3):** «never edit the consumer's
   tsconfig.json; never overwrite a consumer-owned file — add by insertions only and keep the
   original, as PR #1868 did for ESLint». And: the install never hands the user a manual step —
   what it cannot do is a NOT-wired fact line with its reason. A stage that cannot meet a floor
   STOPS and parks; it never trades the floor for a manual step or a clobber.
2. **Run, never install (spec P7 / D12):** the install may *run* a pinned lint tool one-shot to
   prove an insertion; it never installs one (no PATH entry, no toolchain component, no consumer
   dependency). `rustup component add`, `go install`, `pip install` in install code = STOP.
3. **One PR per stage** off `staging`, branch and title per §1. Author in an own worktree
   (`.claude/rules/parallel-subwave-isolation.md`). Merge-forward, never rebase
   (`.claude/rules/git-conflict-merge-forward.md`); never `--no-verify`.
4. **Merge lock.** Every stage touches `setup.d/**` and `tests/install-sh/**` (most also
   `install.sh`), so every merge goes through the install-area lock:
   `~/.claude-coordination/rules-as-tests-aif/merge-lock.sh take <PR> "<title>"` → `git fetch
   origin && git merge origin/staging` → regenerate (rule 5) → push → CI green on the NEW head
   SHA, checked by explicit SHA (`gh api repos/artyhoo/getff/commits/<sha>/check-runs`), and
   `mergeable` not `CONFLICTING` → `gh pr merge --squash` → `merge-lock.sh release <PR>`.
5. **Regeneration (every stage moves delivered bytes or setup.d):** `scripts/build-getff-dist.sh`
   → `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` → `scripts/build-getff-dist.sh --check`.
   Measure the drift before each capture; a changed path outside the stage's expected set (its
   stage kickoff names it) is a STOP. Lane baselines live at `tests/install-sh/baselines/{python,cargo,go}/`
   and each fingerprints `.ai-factory/refresh-baseline.json` (e.g. `baselines/cargo/greenfield.fingerprint:1`).
6. **D26 docs-refresh gate:** `node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"`.
   Take the page list from the gate's OUTPUT; refresh each page or add
   `docs-refresh: deferred — <reason>`; list every page in the PR body.
7. **Delivery-mode naming.** Every new consumer-delivered file names its mode (`copy_safe`
   skip-if-exists / `refresh_safe` overwrite-on-refresh / the lane wrapper `_<lane>_copy_or_refresh`)
   and its `--refresh` parity. The toolchain lanes EXIT before the npm `do_refresh`, so lane
   refresh parity is the lane's own `GETFF_TOOLCHAIN_REFRESH` path, asserted by Check 4 of
   `tests/install-sh/refresh-covers-full-delivery.test.sh` (the `TOOLCHAIN_LANES` table,
   `:56-60`) — not the install.sh `do_refresh` list. A new sourced helper under `setup.d/` is
   not consumer-delivered: it runs from `$PKG_ROOT` and ships in the dist (`packages/getff/MANIFEST.sha256`
   carries 22 `setup.d/` entries today).
8. **Every insertion obeys spec §3 I1-I6** (insertions only, recognised shapes only, original
   kept with file identity, differential tool proof, CI independent of the insertion, payload
   from the template). The NOT-wired summary mechanism is `setup.d/lib.sh` `note_not_wired`
   (`:2725` staging, `:2730` #1890) / `print_not_wired` (#1890 `lib.sh:2738`).
9. **PR body:** the `.github/pull_request_template.md` sections — `## Fidelity verdict`, §1.7
   Forward-check / Backward-check, `## Parked questions`, `## Provenance` (this is a stage PR).
   Capability commits carry a `Prior-art:` trailer (CLAUDE.md syntax). Every stage PR carries a
   `## Probe results` section: each prerequisite probe it ran, the command, the raw output, and
   which spec branch the result selected — later stages read it from there
   (`gh pr view <N> --json body`).
10. **Language:** every repo artefact English (`.claude/rules/language-discipline.md`).

## §1 Stages, rationale, dependencies

| Stage | Branch | PR title | Owns (spec) | Depends on (merged) |
|---|---|---|---|---|
| **L1** | `fix/lane-ci-gate-isolation` | `L1: getff CI gates read only getff-owned configs` | §4.0 cargo + ast-grep; refresh fact line; §9 isolation arms | #1890 |
| **L2** | `fix/lane-config-lookup-names` | `L2: lanes detect every config name their tool loads (D11)` | D11 lookup lists + fresh-cell detection (all three lanes); §4.0 go `else` branch | L1 |
| **L3** | `feat/lane-insert-python` | `L3: shared lane-config writer + differential probe; python lane inserts ruff + sgconfig` | §5 writer, probe scaffolding, D12 ladder, result contract, lane-path added-to printer; §6 markers + D10 refresh; §4.1; §4.2 | L1, L2 |
| **L4** | `feat/lane-insert-cargo` | `L4: cargo lane inserts getff's clippy bans` | §4.3; §4.4 wording; §4.5 fact + template guard | L1, L2, L3 |
| **L5** | `feat/lane-insert-go` | `L5: go lane inserts getff's forbidigo bans (golangci v1/v2)` | §4.6 incl. schema + D4 `kept-default`; §4.7 unchanged | L2, L3 (and L4 — merge serialisation only, §2) |

**Why this split (and where it deviates from the brief):**

- It is spec §11 verbatim: #1890 → §4.0 → D11 → writer+probe, one PR per lane.
- **The go CI `else` branch sits in L2, not L1.** Spec §4.0 says that branch «learns D11's
  lookup names», and D11's own resolution lists it. L1 therefore touches only the cargo and
  python CI templates, L2 only the go one — no template is written by two stages. L2 also closes
  the neighbouring `elif .golangci.yml` hole the same way (kickoff-l2 Deviation 1).
- **The writer lands with the python lane (L3), not alone.** A writer with no caller would be
  a mechanism without a consumer (`.claude/rules/effort-worthiness.md`); python carries the one
  existing insertion (`_py_sgconfig_merge`, `setup.d/45-python.sh:208`) that the writer replaces,
  so L3 proves the writer on a shape already in production.
- **L4 before L5, strictly sequential.** Both extend the shared writer and `audit-self.yml`, and
  both regenerate MANIFEST and baselines. L4 goes first because it consumes L1's cargo probe
  result. If L4 parks, L5 may go first — the order is swappable, concurrency is not.

**Stage-kickoff names** (`kickoff-l1.md` … `kickoff-l5.md`) classify as `stage` under
`classifyKickoffName` (`packages/core/principles/kickoff-population.ts:34`,
`STAGE_KICKOFF_RE = /^kickoff-[a-z]\d[a-z0-9]*\.md$/`) — umbrella letter L + stage digit.

## §2 File-lock matrix (which stage writes what)

`W` = writes. Sequential merge order is L1 → L2 → L3 → L4 → L5, so no two stages are open on
one file at once; the matrix is what the Backward-check and the merge lock are checked against.

| File / area | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| `packages/core/templates/cargo/github-actions-ci.yml` | W | | | | |
| `packages/core/templates/python/github-actions-ci.yml` | W | | | | |
| `packages/core/templates/python/hooks/pre-push.sh` (ast-grep mirror) | W | | | | |
| `packages/core/templates/python/.getff/sgconfig.yml` (new) | W | | | | |
| `packages/core/templates/go/github-actions-ci.yml` | | W | | | |
| `setup.d/45-python.sh` | W | W | W | | |
| `setup.d/46-cargo.sh` | W | W | | W | |
| `setup.d/47-go.sh` | | W | | | W |
| `setup.d/lib.sh` | W (if the delivered-path resolver changes) | W (shared lookup lists, if shared) | W (shared added-to printer) | | |
| `setup.d/lane-config-insert.sh` (new sourced helper) | | | W | W | W |
| `setup.d/99-finalize.sh` (added-to block → shared printer) | | | W | | |
| `install.sh` (lane paths: printer next to `print_not_wired`, #1890 `:351`, `:400`) | | | W | | |
| `packages/core/hooks/pin-parity.test.ts` (one-shot pin surfaces) | | | W | | W |
| `packages/core/principles/33-adapter-jig-arm-registry.ts` (arm locators, if moved) | W | | | | |
| `.github/workflows/audit-self.yml` (register tests; tool placement) | W | W | W | W | W |
| `tests/install-sh/{python-delivery,python-entry-lane}.test.sh` | W | W | W | | |
| `tests/install-sh/cargo-entry-lane.test.sh` | W | W | | W | |
| `tests/install-sh/go-entry-lane.test.sh` | | W | | | W |
| `tests/install-sh/lane-orphan-residue.test.sh` | W | | | | |
| `tests/install-sh/install-no-manual-step.test.sh` | | | W | W | W |
| new `tests/install-sh/*.test.sh` + `tests/install-sh/fixtures/lane-config-insert/<lane>/` | W | W | W | W | W |
| `tests/install-sh/baselines/{python,cargo,go}/*` + `packages/getff/MANIFEST.sha256` (regen only) | W | W | W | W | W |
| `docs/meta-factory/prior-art-evaluations.md` (append-only row, only if none fits) | | | W | | |
| `docs/site/**` pages the D26 gate names | W | W | W | W | W |

Never written by any stage: `docs/superpowers/specs/**` (spec owner commits only),
`.claude/orchestrator-prompts/**` (kickoff owner commits only), any consumer `tsconfig.json`,
any consumer `Cargo.toml`.

## §3 Stage gates (run before dispatching each stage)

```bash
# gate 0 — every stage: #1890 merged (it rewrites every cell this umbrella touches)
gh pr view 1890 --repo artyhoo/getff --json state --jq .state          # must print MERGED
# gate L2 — L1 merged
gh pr list --repo artyhoo/getff --state merged --search 'is:merged head:fix/lane-ci-gate-isolation base:staging' --json number,mergedAt
# gate L3 — L1 and L2 merged
gh pr list --repo artyhoo/getff --state merged --search 'is:merged head:fix/lane-config-lookup-names base:staging' --json number,mergedAt
# gate L4 — L3 merged
gh pr list --repo artyhoo/getff --state merged --search 'is:merged head:feat/lane-insert-python base:staging' --json number,mergedAt
# gate L5 — L4 merged (or L4 parked and the operator swapped the order, §1)
gh pr list --repo artyhoo/getff --state merged --search 'is:merged head:feat/lane-insert-cargo base:staging' --json number,mergedAt
# closure — L5 merged
gh pr list --repo artyhoo/getff --state merged --search 'is:merged head:feat/lane-insert-go base:staging' --json number,mergedAt
```

An empty array `[]` = not merged = do not dispatch. Before each dispatch also run the in-flight
probe: `SLUG=lane-config-insertion bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
(one `VERDICT:` line; `PROBE-INCOMPLETE` is not a clean answer).

## §4 Stop conditions (per stage — each one STOPs and parks, never guesses)

| Stage | STOP when |
|---|---|
| all | a floor in §0.1 or §0.2 cannot be met; a regen drifts a path outside the stage's expected set; a registered adapter-jig arm (E2 `self-check-resolves-delivered-config`, `33-adapter-jig-arm-registry.ts:82`) would have to be reversed; CI shows a getff gate reading a consumer config the stage was meant to isolate |
| L1 | the cargo `-A <group>` probe or the ast-grep `-c` probe returns something that is neither spec branch (neither «works» nor the recorded fallback); the isolated gate goes red on a fixture with no getff ban and the cause is not the recorded §12 source-level `#![deny]` limit |
| L2 | a tool's real lookup order (probe) contradicts the spec's candidate list in a way that changes which cell a consumer lands in, and the spec does not say which wins |
| L3 | the differential probe cannot separate getff-attributable results from consumer results for ruff or ast-grep; `ruff check --show-settings` does not expose enough to decide I4; a recognised shape's golden output is not byte-preserving outside the inserted lines |
| L4 | the L1 probe forced the recorded fallback AND the §4.3 insertion cannot be proven (tool absent) — then CI enforces nothing for that consumer; surface it, do not paper over it |
| L5 | the D4 before-probe cannot run the consumer's config «exactly as the consumer's own run would» (no linter-selection flags) and still yield per-issue linter names on the binary in use; or proceeding would need a golangci pin bump. **Not** a stop: `go run …/golangci-lint@v1.55.2` failing to build against the host's Go — D12 step 2 is then `not-proven` by construction, and the pin bump is its OWN task (spec §11). Record it; never bump the pin inside L5. |

## §5 Descope register — which stage owns each spec descope

A fidelity auditor checks each stage against its own kickoff alone, so every descope lives in
the stage that owns it (and is restated there):

| Spec descope | Owner |
|---|---|
| §7 every shape §4 marks NOT-wired, with the recogniser's reason | L3 (ruff, sgconfig), L4 (clippy), L5 (golangci) |
| §7 `not-proven` / `rolled-back` lines with the tool's message | L3 (mechanism), L4/L5 (per lane) |
| §7 getff code in `ignore` (§4.1); `forbidigo` under `disable` (§4.6) | L3; L5 |
| §7 / §4.4 / P5 / D3 — `Cargo.toml` is never edited; `[lints.clippy]` stays a NOT-wired line | L4 |
| §4.5 / D6 — `deny.toml`: nothing to insert; the NOT-wired line becomes a fact; template guard | L4 |
| §7 / §4.7 / D7 — a squatted `getff-<lane>.yml` stays NOT-wired, unchanged from #1890 | L5 (restated for all lanes; no code change) |
| §7 / I3 — an original that could not be kept → write undone, NOT-wired | L3 (mechanism) |
| §4.6 — `.golangci.toml` / `.golangci.json` targets are NOT-wired; `formatters` never a target; `disable-all` / `exclude-use-default` never inserted | L5 |
| §4.1 — `per-file-ignores` left alone; nested ruff configs each on their own; a ruff `--config` in the consumer's tooling → that path NOT-wired | L3 |
| §4.3 — both `clippy.toml` and `.clippy.toml` in one dir → NOT-wired; `CLIPPY_CONF_DIR` in `.cargo/config.toml [env]` → NOT-wired | L4 |
| §12 limits (CLI-only `-E forbidigo`; formatter-stripped tags; probe ruff ≠ consumer's pinned ruff; source-level `#![deny]` survives `-A`) | L5; L3; L3; L1 |
| P7 / D12 — no `rustup component add` (clippy has no step 2), no `go install`, no `pip install` | L3 (ladder), L4, L5 |
| P2 — the consumer's `tsconfig.json` is never touched | all (no stage has a reason to open it) |

## §6 Tier routing and dispatch

- **Profile value:** `Z.AI GLM-5.3 SDK`. Evidence, measured 2026-09-29 on the live aif API
  (`docker --context pc exec aif-api-1 node -e 'fetch(".../runtime-profiles")…'`): four
  profiles — `Claude Opus (plan+review)` (enabled=false), `Z.AI GLM-5.3 SDK` (`53eca24c`,
  enabled), `Qwen3.8-Max-Preview`, `Z.AI GLM-5.3 Flash (implementer)`. The value matches exactly
  one name exactly and is a substring of no other name (the Flash profile lacks `SDK`), so both
  resolver steps (`AifHandoffBackend._resolveProfileId`, tier-home.md «Marker value rule») land on
  one row. Same value as `.claude/skills/pipeline/references/presets/economy.json:4`.
- **Why a marker at all:** `/arch` §3 row «factory-bound» (`.claude/skills/arch/SKILL.md:125`) —
  the design passed `/arch` §2 review (two cold rounds, spec §13), each stage kickoff is
  plan-complete (decisions encoded, descopes restated), and `fidelity-verdict-in-pr-body` IS a
  required check on `staging` (`gh api repos/artyhoo/getff/branches/staging/protection/required_status_checks`
  → `["ci-success","fidelity-verdict-in-pr-body","stale-revert-in-pr-diff"]`, 2026-09-29). This
  umbrella carries no marker: it is a plan, never a dispatch input.
- **Channel:** one aif task per stage, own worktree, harvested from the host (`/harvest`), never
  pushed from the container. Pre-dispatch: `grep -qi 'park it as a question' <stage-kickoff>` AND
  the container-side `AGENT_MAX_REVIEW_ITERATIONS` probe (`/pipeline` §5
  `#autonomous-dispatch-without-park`). Re-verify the profile list before each dispatch.

## §7 Global acceptance (all five stages merged)

```bash host-verify
# Global gate at final staging HEAD; each stage's own contract lives in its kickoff.
scripts/build-getff-dist.sh --check
bash tests/install-sh/python-delivery.test.sh
bash tests/install-sh/python-entry-lane.test.sh
bash tests/install-sh/cargo-entry-lane.test.sh
bash tests/install-sh/go-entry-lane.test.sh
bash tests/install-sh/install-no-manual-step.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
bash tests/install-sh/lane-orphan-residue.test.sh
```

Plus, from the stage kickoffs: `lane-ci-gate-isolation`, `lane-config-lookup-names`,
`lane-config-writer`, `lane-config-insert-{python,cargo,go}`, `deny-template-defaults-guard`
(`tests/install-sh/<name>.test.sh`) all green in CI; every §8 decision's falsifier stated in the
PR that implements it; the closure session writes `done.md` (CLAUDE.md «Umbrella closure
convention»).

## §8 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this umbrella: T2, T3, T7, T10, T11, T15, T16, T19, T20, T21.**

- **T2 / T3** — a stage «works» only with the command and its output; a probe result is the raw
  tool output, not a paraphrase.
- **T7** — the spec's tables are shapes to *recognise*, not a checklist to tick; a row the
  recogniser cannot tokenise is NOT-wired (I2), never «close enough».
- **T10** — enumerate every config the tool loads (D11, nested configs) before claiming a lane
  is wired; the root file is not the population.
- **T11 / T16** — L3 is the capability stage: prior-art consult before the writer
  (kickoff-l3 §3). toml_edit (#132) edits TOML with a CST; our class is bash-only, no parser —
  state the match per candidate.
- **T15 (self-application, mandatory)** — this umbrella applies its own rule to itself: every
  anchor above was measured at `b3a19811be6` (or on #1890 head `8c82c1a1e7b`, marked), the
  profile value against the live list, the required check against branch protection; the
  stage names were checked against `STAGE_KICKOFF_RE`. What auditing this plan would look like:
  a cold reviewer given only the spec and these six files, checking that every §5 descope and
  every §8 decision lands in exactly one stage.
- **T19** — each stage runs its own cold review of the diff before handoff; green CI is form.
- **T20** — every verdict in a PR body quotes its evidence.
- **T21** — each stage's Backward-check delegates the sibling sweep to
  `agents/backward-sweep-auditor.md` with the change's class only.
- **T-LCI-A (domain) — «the syntactically clean insertion is proof enough».** Shape recognition
  authorises the attempt; only the tool authorises the result (I4). A stage that writes the file
  when the tool is absent — or that treats a clean parse as the proof — has shipped exactly the
  design round 1 rejected (spec §13 r2, D2 row).
- **T-LCI-B (domain) — «the gate reads getff's config» asserted from the YAML, not measured.**
  The only acceptance for I5 is a run of the template's own command, extracted from the template
  file (never retyped), against a consumer fixture whose config lacks getff's bans — and the
  gate still fires.
- **T-LCI-C (domain) — «fixed on staging's line numbers».** #1890 moves every lane anchor; a
  stage that edits by staging line number edits the wrong code. Re-locate by content.

## §9 Report format (per stage, back to the dispatcher)

`Stat` (files + lines) / `Verify` (each exit gate with its output; the RED-first run; the probe
results) / `DECISIONS` (every fork taken, and which spec branch a probe selected) / `ATTN`
(mandatory stop if non-empty) / `Confidence: high|medium|low` with its predicate (T6).
