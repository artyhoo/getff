<!-- scope:getff-any-stack-trace-r1-lane-channel-parity -->

# Lane × channel-rung parity audit — getff-any-stack-trace R1

> **Scope:** R-phase research patch (one file, append-only under `docs/meta-factory/research-patches/**`, folder-level authority inherited from the folder README — no per-file authority header required).
> **Round:** 2 — rework of round-1 (aif task `6f18c179`, branch `research/getff-any-stack-trace-r1`, commit `1479f54741`). Round-1 patch was **unreachable in this worker clone** (verified mechanically — see §7); round 2 re-derives every cell against the live tree per kickoff §8 (T-R1-D). Round-1's text is convenience, not evidence.
> **Audited SHA:** `2923ba6f4` (2026-08-07). Branch `feature/getff-any-stack-trace-r1-940456`.
> **Origin:** the S2b discovery — the python lane's local git-hook rung was empty, and the emptiness had a broken decision chain behind it (a prior-art verdict about the WRONG role consumed as a channel decision). The operator asked: «what else is missing the same way?» This audit answers systematically.
> **Predecessors merged:** S1 = #1166, S2 = #1169. S2b in flight (closes python rung 2).

## §1 Population enumeration (T10 — before any cell verdict)

**Lanes (rows) — 4, NOT 3 + absence (the §8.1 BLOCKER):**

| # | Lane | install.sh entry | Layer file | Templates dir |
|---|---|---|---|---|
| 1 | `npm` (default flow) | main dispatcher → setup.d layer loop | `setup.d/[0-9]*.sh` (10-skills, 20-agents, 30-templates, 40-configs, 50-hooks, 60-ci, 70-deps, 80-rule-bootstrap, 99-finalize) | `packages/core/templates/shared/` |
| 2 | `python` | `do_python_lane` `install.sh:244` | `setup.d/45-python.sh` | `packages/core/templates/python/` |
| 3 | `cargo` | `do_cargo_lane` `install.sh:288` | `setup.d/46-cargo.sh` | `packages/core/templates/cargo/` |
| 4 | `go` | `do_go_lane` `install.sh:316` (merged PR #1171, 2026-08-06) | `setup.d/47-go.sh` (361 lines) | `packages/core/templates/go/` |

Live verification of §8.1's macro-claim (this clone, this SHA):

```text
$ grep -cE 'do_go_lane|TOOLCHAIN=go' install.sh
6
$ wc -l setup.d/47-go.sh
361 setup.d/47-go.sh
$ ls packages/core/templates/go/
.golangci.yml  github-actions-ci.yml
```

**All four lanes exit before the npm-flow layer loop.** `do_go_lane` exits at `install.sh:424` (`exit 0`); `do_cargo_lane` and `do_python_lane` carry the same parity comment («EXITS — never enters the npm package.json precondition, stack pick, or the setup.d layer loop»). The structural consequence (load-bearing for cells below): a cargo-only or go-only consumer does NOT receive any of the npm-flow's agent surface (CC hooks, husky pre-commit/pre-push, skills) unless they ALSO run the default `./install.sh` flow against a `package.json`. Python is the lone non-npm lane that ships its own agent surface — via `_py_deliver_agent_surface` (`setup.d/45-python.sh:692`, called from `install.sh:278`).

**Channel rungs (columns) — 7, the project's ladder, earliest first:**

1. **edit/agent-session** — CC hooks delivered to the consumer session (`inject-matching-rule` PostToolUse:Edit|Write|MultiEdit; `deps-hash-check` UserPromptSubmit) AND any lane-native edit-time channel (a linter that fires in the consumer's editor counts here).
2. **local git — pre-commit/pre-push** — husky hook wiring delivered by install.sh.
3. **install-time firing proof** — the `_X_firing_self_check` class (plant a violation, prove the delivered rules fire at install).
4. **CI** — delivered workflow with failing gates (the `branches: [main]` default-branch substitution question is in scope per cell).
5. **freshness** — deps-hash-check staleness signal on the lane's manifest class.
6. **refresh reconciliation** — `--refresh` reconciles renames/stale companions on this lane.
7. **opt-out story** — documented deletion path / env escape per delivered enforcement artifact.

**Deliberately EXCLUDED columns (stated, not silently dropped):** *production audit* (the ladder's last rung — framework-internal `audit-self.yml` machinery, not a per-consumer-lane deliverable) and *mutation gates* (framework-internal quality machinery). Per kickoff §1.

**Matrix bounds:** 4 lanes × 7 rungs = **28 substantive cells**, every one verdicted below.

## §2 Matrix

Legend: **EXISTS** = artifact `file:line` AND firing evidence cited. **GAP** = provenance protocol run (§4). **N/A** = structurally meaningless for this lane, one-sentence justification. No hybrid tokens (§8.2.3 — round-1's `EXISTS*` eliminated).

### npm lane (reference implementation — T-R1-C: presumption-of-health forbidden)

| Rung | Verdict | Evidence (live, this SHA) |
|---|---|---|
| 1. edit/agent-session | **EXISTS** | `deps-hash-check` UserPromptSubmit + `inject-matching-rule` PostToolUse:Edit\|Write\|MultiEdit, both wired in `setup.d/10-skills.sh:117-146` (dhc) and `:201-211` (imr); settings.json registration at `.claude/settings.json:74` (dhc) + `:123` (imr). **Firing:** `deps-hash-check.sh:297-298` emits a WARN via `_emit_warn` on hash drift; `inject-matching-rule.sh:59-66` reports loudly once-per-session when corpus absent (S6 honest-signals fix, PR #1175, commit `7f3397363`). Edit-time ESLint-in-editor is the reference native channel — `setup.d/40-configs.sh` ships `eslint.config.mjs` with getff rules wired (R2 auto-wire in `setup.d/60-ci.sh:38-93`). |
| 2. pre-commit/pre-push | **EXISTS** | `.husky/pre-commit` + `.husky/pre-push` delivered by `setup.d/50-hooks.sh` (fresh) and re-delivered by `do_refresh()` at `install.sh:1026-1027` (refresh). **Firing:** `husky-pre-push.sh` is the TS-core dispatcher (`install.sh:1015`); runs the `pre-push.ts` pipeline shipped via `install.sh:925-1031` (complete import graph). |
| 3. install-time firing proof | **EXISTS** | `install-self-verify` capstone at `setup.d/99-finalize.sh:250-355` — three checks (fences fire, shields wired, generated tests non-vacuous), runs at install under `--full`. **Firing:** `setup.d/99-finalize.sh:265` dry-run echo + the live 3/3-passed run recorded in `.claude/orchestrator-prompts/launch-preannounce-track/s1-calibration-report.md:69` («self-verify 3/3 passed, pre-push present»). |
| 4. CI | **GAP** | No `packages/core/templates/npm/github-actions-ci.yml` (verified: `ls packages/core/templates/npm/` → absent — npm uses `templates/shared/`). `setup.d/60-ci.sh` only WARNs about `.nvmrc`↔CI drift (`:13-36`) and auto-wires R2 globs (`:38-93`) into the consumer's **existing** workflow — it does not deliver a getff CI workflow. **Provenance:** DECIDED-AGAINST — the framework's earliest-reachable-channel thesis routes npm enforcement through the pre-push gate (rung 2), treating CI as consumer-owned. See §4. |
| 5. freshness | **EXISTS** | `deps-hash-check.sh:107-120` `_npm_current()` hashes 7 fields (dependencies/devDependencies/peerDependencies/optionalDependencies/overrides/resolutions/pnpm.overrides); `:266` reads `deps-hash-npm` baseline (with legacy bare `deps-hash:` backward-compat per `:84-95`); `:276-278` compares + routes to `_drifted`. **Firing:** WARN emitted at `:297-298`. |
| 6. refresh reconciliation | **EXISTS** | `do_refresh()` at `install.sh:600`, dispatched from `install.sh:1097`. **Firing:** the skill-rename orphan reclaim at `install.sh:684-723` (getff-honest-signals S5 — reclaims `.claude/skills/rules-as-tests/` when `.claude/skills/getff/` coexists, with `.override.md` escape hatch); the stale `.lintstagedrc.json` reconciliation at `install.sh:725-762` (offer-only, never mutates consumer file). |
| 7. opt-out story | **EXISTS** | Husky hooks: delete `.husky/pre-commit` + `.husky/pre-push`. CC hooks: remove from `.claude/settings.json`. Skills: `.override.md` sibling (`install.sh:694`, `:705-706`). **Firing:** the `Delete this file to opt out` literal appears in every lane-CI template (python `:12`, cargo `:12`, go `:14`) — npm has no lane-CI template, but the principle is uniform. |

### python lane

| Rung | Verdict | Evidence (live, this SHA) |
|---|---|---|
| 1. edit/agent-session | **EXISTS** | `_py_deliver_agent_surface` at `setup.d/45-python.sh:692-820` replicates both hooks: deps-hash-check at `:753-761` + inject-matching-rule at `:765-767`, wired via `register_cc_hook` into the consumer's `.claude/settings.json`. **Firing:** identical hook files as npm lane (the scripts are byte-identical — `inject-matching-rule.sh:1-2` carries `@dual-pair: rule-path-scoping`; `deps-hash-check.sh:1-2` carries `@dual-pair: deps-hash-check-dogfood`). ast-grep/ruff fire in the consumer's editor via the delivered `sgconfig.yml` + `ruff.toml` (the lane's native edit-time channel — kickoff §1 column-1 note). |
| 2. pre-commit/pre-push | **GAP** | `_py_deliver_agent_surface` does NOT deliver husky hooks (verified: `grep -nE 'husky\|pre-commit\|pre-push' setup.d/45-python.sh` → empty). The python lane ships CC-session hooks but no git hooks. **Provenance:** MISDECIDED — see §4.1 (the S2b-origin broken decision chain; SSOT #216 role mismatch). |
| 3. install-time firing proof | **EXISTS** | `_py_firing_self_check` at `setup.d/45-python.sh:397`, called from `install.sh:268`. **Firing:** `install.sh:270` dry-run echo describes the live path — «plant a violation in an OS temp dir → assert ast-grep + ruff fire RED»; the function plants a real violation and asserts both rule channels fire. |
| 4. CI | **EXISTS** | `packages/core/templates/python/github-actions-ci.yml` delivered by `_py_deliver_ci` (`setup.d/45-python.sh:340`). **Firing:** two parallel jobs — ast-grep scan (`:34-49`, fails RED on rule fire via `sgconfig.yml`) + ruff check (`:54-81`, two steps: discovered-config + isolated `--config .getff/ruff-bans.toml` to close the ruff-collision silent-skip). **Deceptive-rung sub-finding (parked, §5):** `branches: [main]` (`:17-19`) — a `master`-default consumer gets zero CI enforcement (S4 origin per spec wall 7(d)). |
| 5. freshness | **EXISTS** | deps-hash-check covers python via the two-tier ladder: `_PY_TIER1_AWK` (`deps-hash-check.sh:128`) hashes 6 non-`[project]` dep tables; `_PY_TIER2_SCRIPT` (`:137-150`) hashes `[project].dependencies` + optional-dependencies via tomllib/tomli; sentinel `:157` keeps the baseline stable across python-upgrade. **Firing:** `:267` reads `deps-hash-python`; `:280` compares + `_drifted`. The hook IS delivered (`_py_deliver_agent_surface:753-761`). |
| 6. refresh reconciliation | **EXISTS** (lane artifacts) with **parked sub-scope GAP** (framework reconciliation) | Lane artifacts: `_py_copy_or_refresh` and `refresh_safe` calls fire under `GETFF_TOOLCHAIN_REFRESH=1` (`install.sh:246`, sourced layer at `setup.d/45-python.sh:652-655`). **Sub-scope GAP (parked, §5):** the framework-wide reconciliation blocks — skill-rename orphan reclaim (`install.sh:684-723`) and `.lintstagedrc` offer (`:725-762`) — live inside `do_refresh()` which is npm-flow only; a python-only consumer running `install.sh python --refresh` does NOT trigger `do_refresh()`. |
| 7. opt-out story | **EXISTS** | `packages/core/templates/python/github-actions-ci.yml:12` — «Delete this file to opt out of the getff gates». **Firing:** literal comment in delivered file. |

### cargo lane

| Rung | Verdict | Evidence (live, this SHA) |
|---|---|---|
| 1. edit/agent-session | **GAP** | **Verified absence:** `grep -nE '_cargo_deliver_agent_surface' install.sh setup.d/*.sh` → no match. The cargo lane delivers rule-pack + CI template + firing proof but NOT the agent surface (no CC hooks, no skills, no inject-matching-rule, no deps-hash-check wiring). A cargo-only consumer (no npm flow) gets zero CC-session enforcement. **Provenance:** SILENTLY-MISSED — see §4.2. |
| 2. pre-commit/pre-push | **GAP** | No husky delivery for cargo (same absence as rung 1 — the cargo lane doesn't enter the npm-flow layer loop where `setup.d/50-hooks.sh` delivers husky hooks). **Provenance:** SILENTLY-MISSED — see §4.2. |
| 3. install-time firing proof | **EXISTS** | `_cargo_firing_self_check` at `setup.d/46-cargo.sh:264`, called from `install.sh:303`. **Firing:** `install.sh:305` dry-run echo — «plant a violation in an OS temp dir → assert cargo clippy fires RED». |
| 4. CI | **EXISTS** | `packages/core/templates/cargo/github-actions-ci.yml` delivered by the cargo lane. **Firing:** clippy job with `-D clippy::disallowed_methods -D clippy::disallowed_types -D clippy::disallowed_macros` (`:48`) FAILS RED. **Deceptive-rung sub-finding (parked, §5):** `branches: [main]` (`:17-19`) — same master-default gap as python. Note: the `-D` flags enforce regardless of clippy.toml, so the REFUSE-cell `getff-clippy.toml` inertness (see §5) does NOT weaken this CI gate. |
| 5. freshness | **EXISTS** (detection) with **parked delivery cascade** | Detection: `deps-hash-check.sh:195-235` `_cargo_current()` covers `Cargo.toml` via the two-tier ladder (`_CARGO_TIER1_AWK:203` + `_CARGO_TIER2_SCRIPT:206-216`); `:268` reads `deps-hash-cargo`. **Firing:** `:282` compares + `_drifted`. **Parked cascade (§5):** the hook is NOT delivered to cargo-only consumers (no `_cargo_deliver_agent_surface`) — a cargo-only consumer never sees the WARN even though the detection logic would cover their stack. Polyglot consumers (npm+cargo) get it via the npm-flow delivery. |
| 6. refresh reconciliation | **EXISTS** (lane artifacts) with **parked sub-scope GAP** (framework reconciliation) | Lane artifacts: `_cargo_copy_or_refresh` at `setup.d/46-cargo.sh:60-68` routes to `refresh_safe` under `GETFF_TOOLCHAIN_REFRESH=1`. **Sub-scope GAP (same as python rung 6):** framework-wide reconciliation is `do_refresh()`-only (npm flow). |
| 7. opt-out story | **EXISTS** | `packages/core/templates/cargo/github-actions-ci.yml:12` — «Delete this file to opt out of the getff gate». **Firing:** literal comment in delivered file. |

### go lane (BLOCKER per §8.1 — entirely new substantive row replacing round-1's N/A absence)

| Rung | Verdict | Evidence (live, this SHA) |
|---|---|---|
| 1. edit/agent-session | **GAP** | **Verified absence:** `grep -nE '_go_deliver_agent_surface' install.sh setup.d/*.sh` → no match. Same structural gap as cargo — the go lane (PR #1171, 2026-08-06) inherited the cargo lane's minimal shape and does not deliver any agent surface. **Provenance:** SILENTLY-MISSED — see §4.3. |
| 2. pre-commit/pre-push | **GAP** | No husky delivery for go. **Provenance:** SILENTLY-MISSED — see §4.3. |
| 3. install-time firing proof | **EXISTS** | `_go_firing_self_check` at `setup.d/47-go.sh:252`, called from `install.sh:331`. **Firing:** `install.sh:333` dry-run echo — «plant a violation in an OS temp dir → assert golangci-lint fires RED». |
| 4. CI | **EXISTS** | `packages/core/templates/go/github-actions-ci.yml` delivered by `_go_deliver_ci` (`setup.d/47-go.sh:119`). **Firing:** golangci-lint forbidigo job on `os.Getenv` (`:36-68`) FAILS RED via `--enable forbidigo --config`. **Deceptive-rung sub-finding (parked, §5):** `branches: [main]` (`:19-21`) — same master-default gap. |
| 5. freshness | **GAP** | **Verified absence:** `grep -nE '_go_current\|go.sum\|go.mod.*hash\|golang.*staleness' packages/core/hooks/deps-hash-check.sh` → empty. deps-hash-check covers npm/python/cargo only; there is no go.sum/go.mod manifest hash. **Provenance:** SILENTLY-MISSED — see §4.3. |
| 6. refresh reconciliation | **EXISTS** (lane artifacts) with **parked sub-scope GAP** (framework reconciliation) | Lane artifacts: `_go_copy_or_refresh` at `setup.d/47-go.sh:56-64` routes to `refresh_safe` under `GETFF_TOOLCHAIN_REFRESH=1`. **Sub-scope GAP (same as python/cargo rung 6):** framework-wide reconciliation is `do_refresh()`-only. |
| 7. opt-out story | **EXISTS** | `packages/core/templates/go/github-actions-ci.yml:14` — «Delete this file to opt out of the getff gate». **Firing:** literal comment in delivered file. |

### Matrix tally

| Verdict | Count | Cells |
|---|---|---|
| EXISTS | 21 | npm: 1, 2, 3, 5, 6, 7 (6); python: 1, 3, 4, 5, 6, 7 (6); cargo: 3, 4, 5, 6, 7 (5); go: 3, 4, 6, 7 (4). Four EXISTS cells carry parked sub-scope concerns nested INSIDE the EXISTS verdict (NOT subtracted): python rung 6 + cargo rung 6 + go rung 6 (framework-reconciliation refresh gap, §5.3); cargo rung 5 (delivery cascade, §5.4). |
| GAP | 7 | npm: 4 (1); python: 2 (1); cargo: 1, 2 (2); go: 1, 2, 5 (3) |
| N/A | 0 | (the go row's 7 substantive verdicts replace round-1's absence row per §8.1) |
| **Total** | **28** | 4 lanes × 7 rungs — every cell substantive, no implicit cells |

**Per-GAP provenance classification counts (quoted in PR body per kickoff §7):**

| Classification | Count | Cells |
|---|---|---|
| DECIDED-AGAINST | 1 | npm rung 4 (CI delegated to consumer; pre-push is the earlier reachable channel) |
| MISDECIDED | 1 | python rung 2 (SSOT #216 role-mismatch — see §4.1) |
| DEFERRED | 0 | — |
| SILENTLY-MISSED | 5 | cargo rung 1, cargo rung 2, go rung 1, go rung 2, go rung 5 |

Plus 3 parked sub-scope GAPs (not counted in the 7 — they are nested inside EXISTS cells with their sub-scope stated): framework-reconciliation refresh gap on python/cargo/go rung 6 (3 lanes); cargo rung 5 delivery cascade (1 lane). And 3 parked deceptive-rung findings: the `[main]` default-branch gap on python/cargo/go CI (§5).

## §3 Evidence appendix — firing proofs per EXISTS cell

### npm lane

- **rung 1 (deps-hash-check fires):** `deps-hash-check.sh:266-282` — reads three baselines (`deps-hash-npm`, `deps-hash-python`, `deps-hash-cargo`), computes current via `_npm_current`/`_python_current`/`_cargo_current`, routes each to `_drifted` which accumulates into `WARN_MSGS`, emitted as a single `_emit_warn` at `:297-298`. Output shape: `⚠ <stack> deps changed since last tool-bootstrap — run /tool-bootstrapping to re-evaluate`.
- **rung 1 (inject-matching-rule fires):** `inject-matching-rule.sh:47` exits 0 unless tool is Edit|Write|MultiEdit; `:54-66` corpus-present check with once-per-session loud-report when corpus absent (S6 fix); `:13` describes the injection mechanism (rule's `<!-- inject: ... -->` summary as PostToolUse additionalContext, once per session).
- **rung 2 (husky fires):** `install.sh:1014-1029` ships `husky-pre-commit.sh` + `husky-pre-push.sh` as framework-authored dispatchers into `.husky/`; `install.sh:925-1031` ships the complete `pre-push.ts` import graph. The dispatcher runs `pre-push.ts` which executes the principle tests + the §8 lychee + zizmor + unpin-tool-install sections as failing gates.
- **rung 3 (install-self-verify fires):** `setup.d/99-finalize.sh:265-355` — gated on `FULL` (capstone runs on `--full` only); probes fences-fire + shields-wired + generated-tests-non-vacuous; reports `_ISV_PASS/3 passed`. Live cross-reference: `.claude/orchestrator-prompts/launch-preannounce-track/s1-calibration-report.md:69`.
- **rung 5 (freshness WARN shape):** see rung 1 above.
- **rung 6 (refresh reconciliation firing):** `install.sh:691` echo `▶ Skill-rename orphan reclaim`; `:712` `rm -rf "$_LEGACY_SKILL_DIR"`; `:735` echo `▶ Stale .lintstagedrc reconciliation`. The reclaim logic guards on `.override.md` (`:705`) — the consumer escape hatch.

### python lane

- **rung 1 (agent surface delivery):** `setup.d/45-python.sh:692-820` — skills (`:701-723`), agents (`:730-743`), hooks (`:745-767`). The hook block explicitly replicates `setup.d/10-skills.sh:117-146` (dhc) + `:201-211` (imr).
- **rung 3 (firing self-check):** `_py_firing_self_check` at `setup.d/45-python.sh:397`; called from `install.sh:268` gated on `DRY_RUN != --dry-run`. The dry-run echo at `install.sh:270` describes the assertion.
- **rung 4 (CI gate firing):** `packages/core/templates/python/github-actions-ci.yml:34-49` ast-grep scan (`ast-grep scan` fails RED when sgconfig-resolved rules fire); `:54-81` ruff check (step 1 discovered-config + step 2 isolated `--config .getff/ruff-bans.toml --no-cache` to close the ruff-collision silent-skip — see `:73-79` comment).
- **rung 5 (python freshness detection):** `deps-hash-check.sh:128-157` two-tier ladder; `:267` baseline read; `:280` compare.

### cargo lane

- **rung 3 (firing self-check):** `_cargo_firing_self_check` at `setup.d/46-cargo.sh:264`; called from `install.sh:303`. Dry-run echo at `:305`.
- **rung 4 (CI gate firing):** `packages/core/templates/cargo/github-actions-ci.yml:34-48` clippy job with `-D clippy::disallowed_*` flags — FAILS RED regardless of clippy.toml content (the `-D` promotes warn-by-default to build-failing per `:44-46` comment).
- **rung 5 (cargo freshness detection):** `deps-hash-check.sh:195-235` two-tier ladder (`_CARGO_TIER1_AWK:203` + `_CARGO_TIER2_SCRIPT:206-216`); `:268` baseline read; `:282` compare.
- **rung 6 (lane refresh):** `setup.d/46-cargo.sh:60-68` `_cargo_copy_or_refresh` branches on `GETFF_TOOLCHAIN_REFRESH`; `:99` `refresh_safe "$tpl/clippy.toml" "$dst"`; `:137` `refresh_safe "$tpl/deny.toml" "$dst"`.

### go lane

- **rung 3 (firing self-check):** `_go_firing_self_check` at `setup.d/47-go.sh:252`; called from `install.sh:331`. Dry-run echo at `:333`.
- **rung 4 (CI gate firing):** `packages/core/templates/go/github-actions-ci.yml:36-68` golangci-lint job. `:53` pins `golangci-lint@v1.55.2` (ci-tool-pinning Rule A exact-pin); `:60-68` runs `golangci-lint run --enable forbidigo --config <file> ./...` — FAILS RED on `os.Getenv` ban fire.
- **rung 6 (lane refresh):** `setup.d/47-go.sh:56-64` `_go_copy_or_refresh`; `:95` `refresh_safe "$tpl/.golangci.yml" "$dst"`; `:131-132` `refresh_safe "$tpl/github-actions-ci.yml" "$wf_dst"`.

### T7 adversarial counter-prompt — RUN, not ticked

Prompt: «which rung or lane did I not even think to put in the matrix?» Run 3 times with rephrasings:

1. **Rephrasing 1 (audit-self lane):** «What about the framework's own `audit-self.yml` — is that a per-lane deliverable?» → No. Kickoff §1 explicitly excludes «production audit» as a column (framework-internal machinery, not a per-consumer-lane deliverable). The 4 lanes are the consumer-facing surfaces.
2. **Rephrasing 2 (docker / plugin / markdown lane):** «What about a docker-lane, a plugin-lane, or a markdown/prose lane?» → No. The kickoff §1 enumerates the lanes against `setup.d/[0-9]*.sh` layers + the four `do_X_lane` functions. Plugin/docker/markdown are not product lanes — they're framework-internal delivery channels (plugin twins ship via `scripts/generate-plugin-twins.sh`, not via a `do_plugin_lane`).
3. **Rephrasing 3 (mutation-testing / principle-tests rung):** «What about a mutation-testing rung, or a principle-tests rung?» → No. Kickoff §1 explicitly excludes «mutation gates» as a column (framework-internal quality machinery). The principle tests are the framework's own CI (`.github/workflows/audit-self.yml`), not a per-consumer-lane deliverable.

**Honest answer:** nothing surfaced after 3 attempts. The 4-lane × 7-rung matrix is complete per the kickoff's own enumeration; the excluded columns (production audit, mutation gates) are explicit, not silently dropped.

## §4 Provenance findings per GAP

### §4.1 python rung 2 — MISDECIDED (the S2b origin, role-mismatch on SSOT #216)

**The GAP:** python delivers CC-session hooks (`_py_deliver_agent_surface`) but no git hooks (no husky pre-commit/pre-push). A python-only consumer has zero local-git enforcement.

**The broken decision chain:** per the kickoff origin block and the S2b kickoff's provenance, the python lane's git-hook emptiness was justified by consuming a prior-art verdict about the WRONG role. SSOT #216 at `docs/meta-factory/prior-art-evaluations.md:289` is about **Python lint-config DELIVERY into an existing project** — its Verdict column reads (quoted literally from the SSOT, per §8.3 MINOR 1 — the word «literal» is dropped from round-1's label because the quote is the SSOT's own text, not a paraphrase):

> **BUILD the thin bash writer** — no upstream tool delivers this headlessly.

The SSOT entry's Capability column names «python-delivery-v0 Task 5 — a pure-bash delivery layer (`setup.d/45-python.sh`) copying pre-rendered ast-grep YAML + `sgconfig.yml` + ruff config templates into a consumer Python project». The decision-class this entry resolves is **delivery mechanism** (how to copy lint configs into a consumer tree). It is NOT a **channel/enforcement** decision (whether the delivered configs should fire at pre-commit/pre-push). Consuming a BUILD verdict for delivery as a verdict against wiring a git hook is a role mismatch — the two decisions are orthogonal: the delivery layer can be BUILD (and it is, correctly) while the channel question remains open.

**Classification:** MISDECIDED (T-R1-A). The fix is not «implement the missing hook» alone — it's «correct the verdict: SSOT #216 does not decide the channel question; the channel question is open». S2b is the stage that re-decides and implements.

**Why this matters structurally (the operator's underlying question):** «after S2b found python's pre-commit rung had a broken decision chain behind it, what else is missing the same way?» This audit answers: the same role-mismatch failure mode was NOT found in any other lane (the other GAPs are SILENTLY-MISSED — no prior decision at all, broken or otherwise). The python lane is the lone MISDECIDED instance.

### §4.2 cargo rung 1 + rung 2 — SILENTLY-MISSED

**The GAPs:** cargo lane delivers no agent surface (rung 1: no `_cargo_deliver_agent_surface`), no git hooks (rung 2). A cargo-only consumer gets rule-pack + CI template + firing proof and nothing else.

**Negative searches (per phase-research-coverage.md 6-item checklist, ≥3 phrasings per surface):**

```text
$ grep -rnE 'cargo.*agent.surface|cargo.*inject-matching|cargo.*deps-hash' \
    .claude/orchestrator-prompts/ docs/meta-factory/research-patches/ \
    docs/superpowers/specs/ docs/meta-factory/prior-art-evaluations.md
(no match for a cargo-lane agent-surface DECISION — matches are about deps-hash
DETECTION coverage, which is a different question: the hook detects cargo drift
but is not DELIVERED to cargo-only consumers)

$ grep -rnE 'cargo.*hook|cargo.*git-hook|rust.*pre-commit|rust.*pre-push|clippy.*hook' \
    .claude/orchestrator-prompts/ docs/meta-factory/research-patches/ \
    docs/superpowers/specs/ docs/meta-factory/prior-art-evaluations.md
(no decision found)

$ grep -rnE '_cargo_deliver_agent' install.sh setup.d/*.sh
(no match — function does not exist)
```

**Phrasings run:** (1) «cargo agent surface»; (2) «cargo inject-matching-rule»; (3) «cargo deps-hash-check delivery»; (4) «cargo git-hook»; (5) «rust pre-commit pre-push»; (6) «_cargo_deliver_agent». All empty.

**Classification:** SILENTLY-MISSED. No prior decision (broken or otherwise) on whether the cargo lane should deliver the agent surface or git hooks. The cargo lane was built (ecosystem-wiring W4) as a minimal rule-pack + CI + firing-proof lane, mirroring python's pre-D8 shape (before D8 / `_py_deliver_agent_surface` was added). The agent-surface question was never asked for cargo.

**Routing verdict:** this-umbrella (new stage). One-line cost/benefit: cargo lane already has the python D8 precedent (`_py_deliver_agent_surface` is a documented template — `setup.d/45-python.sh:692-820`); the cost is one `_cargo_deliver_agent_surface` function + install.sh call site, the benefit is closing 2 GAPs (rung 1 + rung 2 cascade) plus the rung 5 delivery cascade.

### §4.3 go rung 1 + rung 2 + rung 5 — SILENTLY-MISSED

**The GAPs:** go lane (PR #1171, 2026-08-06) inherited cargo's minimal shape — no agent surface (rung 1), no git hooks (rung 2), no freshness detection (rung 5: deps-hash-check has no `_go_current` / go.sum / go.mod hash).

**Negative searches:**

```text
$ grep -rnE 'go.*agent.surface|go.*inject-matching|go.*deps-hash|golang.*pre-commit|golang.*pre-push' \
    .claude/orchestrator-prompts/ docs/meta-factory/research-patches/ \
    docs/superpowers/specs/ docs/meta-factory/prior-art-evaluations.md
(no decision found)

$ grep -nE '_go_deliver_agent' install.sh setup.d/*.sh
(no match)

$ grep -nE '_go_current|go.sum|go.mod.*hash|golang.*staleness' packages/core/hooks/deps-hash-check.sh
(no match — no go-stack detection in the freshness hook)
```

**Classification:** SILENTLY-MISSED (3 cells). The go lane is brand-new (5 days old at audit time — see §6) and inherited cargo's minimal shape without re-asking the agent-surface/freshness questions.

**Routing verdict ( rewritten per §8.1 — round-1's `operator-roadmap` rested on the dead «go is absent» premise):** this-umbrella (new stage), in lockstep with §4.2's cargo stage. One-line cost/benefit: the go lane's `_go_deliver_agent_surface` would be a near-copy of cargo's (which would be a near-copy of python's D8); building both in one stage closes 5 GAPs (cargo rung 1+2, go rung 1+2) + 1 (go rung 5 — needs a new `_go_current` in deps-hash-check, comparable to the cargo DH-S2 work).

### §4.4 npm rung 4 — DECIDED-AGAINST (pre-push is the earlier reachable channel)

**The GAP:** no `packages/core/templates/npm/github-actions-ci.yml` exists; `setup.d/60-ci.sh` does drift-WARN + R2 auto-wire against the consumer's EXISTING workflows, not deliver a getff CI workflow.

**Provenance (cite where):**

- `setup.d/60-ci.sh:13-36` §6b — `.nvmrc` ↔ CI Node-version drift WARN against EXISTING consumer workflows (`$_wf` iterates `$PROJECT_ROOT/.github/workflows/*.yml`, never creates one).
- `setup.d/60-ci.sh:38-93` §6b-bis — R2 auto-wire patches the consumer's EXISTING `eslint.config.mjs` (the `if [ -f "$PROJECT_ROOT/eslint.config.mjs" ]` guard at `:46`), never ships a workflow.
- The framework's thesis (README.md#why-this-exists,「CI = last-resort gate」): enforcement routes to the earliest reachable channel. For npm consumers, the pre-push gate (rung 2 — `pre-push.ts`) IS the failing gate; CI is downstream.

**Role-match check:** the decision class is «which channel delivers the npm-lane enforcement gate?». The answer routes it to pre-push (rung 2), not CI. This is a legitimate channel-selection decision per `.claude/rules/rule-enforcement-channel-selection.md` — the verdict matches the problem class.

**Classification:** DECIDED-AGAINST. Not a defect — a design choice. Recorded here for parity: every other lane has a delivered CI workflow; npm does not, by design.

**Routing verdict:** no routing — the design is sound. Recorded for matrix completeness.

## §5 Honest-signals findings (elevated per §8.3 MINOR 2 — deceptive-rung observations get their own findings with the hotfix question PARKED)

### §5.1 The `[main]` default-branch substitution gap — python, cargo, go CI templates

**Observation:** all three lane CI templates trigger on `branches: [main]` only (python `packages/core/templates/python/github-actions-ci.yml:17-19`, cargo `:17-19`, go `:19-21`). A consumer whose default branch is `master` (a sizeable population — Git's pre-2020 default, still common in long-lived repos) gets **zero CI enforcement** from the delivered gate. The CI workflow EXISTS, registers as a workflow in the Actions tab, and silently never fires.

**Why this is honest-signals class (kickoff §4):** the gate fires but lies — it reports «no CI failures» because it never ran, not because the rules passed. This is the S4 origin per spec `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` wall 7(d).

**Parked hotfix question:** should the lane CI templates substitute the consumer's actual default branch at install time (the way `setup.d/60-ci.sh` patches the consumer's existing workflows)? Or should they trigger on `branches: [main, master]` as a belt-and-braces default? Both have trade-offs (the former requires detecting the default branch — `git symbolic-ref refs/remotes/origin/HEAD` or similar; the latter over-triggers on repos that intentionally keep master as a release branch). **Parked** — this is a S4-class fix, not a parity-audit fix. The audit's job is to record it; the fix belongs to the stage that owns CI-template substitution.

### §5.2 The cargo REFUSE-cell `getff-clippy.toml` is honestly inert (NOT deceptive)

**Observation:** `setup.d/46-cargo.sh:104-110` — when the consumer has their own `clippy.toml`, the cargo lane REFUSES to overwrite and ships `getff-clippy.toml` as a reference instead. The `:109` log line says: «Shipped our rules as getff-clippy.toml (clippy does NOT auto-discover it — inert until you opt in)».

**Why this is NOT deceptive-rung class:** the lane TELLS the consumer the file is inert (`:109` log + `:110` MANUAL merge instruction). The CI gate compensates: `packages/core/templates/cargo/github-actions-ci.yml:48` uses `-D clippy::disallowed_*` flags which promote the bans to build-failing **regardless of clippy.toml content** (per the `:44-46` comment: «`-D` promotes the getff lint families to build-failing (clippy.toml carries no severity — render-clippy.ts FF7003), so the ban gates even if the `[lints.clippy]` deny projection was not merged into Cargo.toml»). The inert reference file + the CI flag-fallback is a deliberate two-surface design, honestly labeled.

**Recorded for completeness** — round-1 flagged this as a deceptive-rung observation; on re-derivation against the live tree (T-R1-D), the observation does not hold. The lane is honest about the inertness and the CI gate enforces the bans unconditionally.

### §5.3 The framework-reconciliation refresh gap — python, cargo, go `--refresh` runs the lane but not `do_refresh()`

**Observation:** a consumer running `install.sh python --refresh` (or `cargo`/`go`) gets their lane artifacts refreshed (via `_X_copy_or_refresh` under `GETFF_TOOLCHAIN_REFRESH=1`), but does NOT trigger `do_refresh()` (`install.sh:600`) — which is where the framework-wide reconciliation lives: skill-rename orphan reclaim (`install.sh:684-723`) and `.lintstagedrc` reconciliation (`:725-762`). The lane exits at `install.sh:424` (go) before the npm-flow layer loop where `do_refresh` would be dispatched (`:1097`).

**Why this is honest-signals class:** the `--refresh` flag promises to «reconcile renames/stale companions» (kickoff rung 6) but only does so for the npm flow. A python/cargo/go consumer's stale skill-rename orphan (the exact defect getff-honest-signals S5 was built to fix) survives `--refresh` if they don't ALSO run the npm flow. The lane refresh honestly re-delivers lane artifacts (EXISTS for the sub-scope) but the framework-reconciliation promise is silently unmet.

**Parked hotfix question:** should `do_python_lane` / `do_cargo_lane` / `do_go_lane` call the framework-reconciliation blocks (skill-reclaim + lintstaged-offer) when `REFRESH` is set? Or should those blocks be factored out of `do_refresh()` into a shared helper that both paths call? **Parked** — structural refactor with snapshot consequences; out of scope for a parity audit.

### §5.4 The cargo rung 5 delivery cascade — detection EXISTS but delivery does not

**Observation:** `deps-hash-check.sh:195-235` covers `Cargo.toml` (two-tier ladder), so the freshness detection logic EXISTS. But the hook is NOT delivered to cargo-only consumers (no `_cargo_deliver_agent_surface`). The detection is real (a polyglot npm+cargo consumer gets the cargo WARN via the npm-flow delivery), but a cargo-only consumer never sees it.

**Why this is honest-signals class:** the deps-hash-multistack research patch (`docs/meta-factory/research-patches/2026-07-16-deps-hash-multistack.md:118`) explicitly says «**detection only; no rust *delivery lane* is built here**». The detection-only boundary was deliberate for the deps-hash umbrella, but it produces a parity gap: cargo's freshness rung is EXISTS-detection + GAP-delivery, and the delivery GAP cascades from rung 1 (no agent surface).

**Parked hotfix question:** none — this cascades from §4.2's routing verdict. Closing cargo rung 1 (deliver `_cargo_deliver_agent_surface`) automatically closes the rung 5 delivery cascade.

## §6 Shelf-life finding (§8.1 — record the staleness itself as a finding)

Round-1's verdict on the go row («product-scope absence», all 7 cells N/A) was **honest and correct when it ran** — verified mechanically at round-1's base (`git show 0e2d366a9f:install.sh | grep -cE 'do_go_lane|TOOLCHAIN=go'` → 0; `git ls-tree 0e2d366a9f setup.d/47-go.sh` → absent). PR #1171 merged 2026-08-06T22:04Z (5 days before this round-2 audit) and added the entire go lane. Round-1's verdict aged out in five days.

**Methodological note (belongs in the patch, not only in the PR body):** a parity audit's verdicts are only as live as the tree they were taken against. The audit method itself is the weakest cell (see §8 self-application) — every merged PR has the potential to invalidate a row. The mitigation is not «re-run the audit continuously» (impossible — the audit is a human-attention-shaped activity, not a gate per `attention-is-not-a-mechanism.md §1`). The mitigation is:

1. **Date-stamp every verdict** (this patch carries `Audited SHA: 2923ba6f4` at the top; every cell verdict is taken against this SHA).
2. **Flag high-velocity surfaces** — the go lane is 5 days old at audit time; a re-audit after the next cargo/go-equivalent merge is the honest cadence.
3. **Treat the audit as a snapshot, not a contract** — a GAP verdict classified SILENTLY-MISSED today may become DECIDED-AGAINST tomorrow if a downstream decision resolves it; the patch is a point-in-time record, not a load-bearing invariant.

The operator's underlying question («what else is missing the same way?») is answered at this SHA. The answer's shelf life is the shelf life of the audit method itself — short, by the nature of parity.

## §7 Round-1-patch-unreachable finding (Option A vs B)

**The fork:** kickoff §8 instructed «read the round-1 patch first; keep every verdict that still holds». Round-1's branch `research/getff-any-stack-trace-r1` (commit `1479f54741`) is **unreachable in this worker clone**:

```text
$ git rev-list --all 2>/dev/null | grep -c 1479f54741
0
$ git rev-parse research/getff-any-stack-trace-r1
fatal: ambiguous argument 'research/getff-any-stack-trace-r1': unknown revision
$ git fsck --no-reflogs --lost-found 2>/dev/null | grep 1479f54741
(empty — commit absent from dangling objects too)
$ git ls-remote --heads origin
(origin unreachable from sandbox: gnutls_handshake() failed)
```

**Option A — block on retrieval.** Surface as `blocked_external`, request the dispatching session push the round-1 branch or attach the patch. Cost: round 2 stalls entirely until retrieved; the dispatching session is the only one with the missing artifact.

**Option B — re-derive under §8's map.** Treat kickoff §8 itself as the round-1 map (it cites round-1 line numbers and verdicts), and re-derive every cell against the live tree. The kickoff already mandates this for every cell ANYWAY («Re-run every search on the tree you are actually on and quote YOUR output» — §8.5 T-R1-D); the round-1 text is convenience, not evidence.

**Choice: Option B.** This patch is a full re-derivation under §8's map. The dispatching session can convert to Option A by attaching round-1 before implementation starts, but Option B is sufficient: §8.5's evidence bar cannot be met FROM round-1's text anyway (round-1's citations are themselves second-hand relative to the live tree).

**What was re-derived vs what is best-effort:**

- **Re-derived (live-tree evidence):** all 28 cell verdicts; all §4 provenance findings; all §5 honest-signals findings; the §6 shelf-life finding; the §8 self-application.
- **Best-effort (round-1 phrasings unrecoverable):** the §8.3 MINORs that referenced round-1's specific wording — the «literal quote» label (§4.1 — I quote SSOT #216 directly from the SSOT and drop the «literal» label rather than verify round-1's exact phrasing) and the «166 lines» count (replaced with section cites throughout — kickoff §8.3 MINOR 3).

## §8 Self-application (T15)

**What would auditing this audit look like?** Three angles:

**(a) The weakest cell verdicts.** The five SILENTLY-MISSED GAPs (cargo rung 1+2, go rung 1+2+5) rest on negative-existence evidence — the absence of `_cargo_deliver_agent_surface` / `_go_deliver_agent_surface` / `_go_current`. The negative searches are quoted (§4.2, §4.3) and meet the phase-research-coverage 6-item bar, but they rest on the assumption that the agent surface delivery is the EXPECTED baseline. I derived that expectation from `_py_deliver_agent_surface` existing for python (the D8 precedent). A different auditor could argue «cargo/go are intentionally minimal lanes; the agent surface is an npm-flow concern, not a lane-rung obligation». I disagree (kickoff §1 column 1 covers «delivered CC-session hooks» without lane qualification, and python D8 set the precedent that non-npm lanes DO deliver the agent surface), but the judgment is real. The mitigating evidence: the same GAP classification applies to BOTH cargo and go symmetrically, and the cost/benefit of closing them is low (one near-copy of D8 per lane). If the dispatcher disagrees with the baseline assumption, the 5 SILENTLY-MISSED verdicts flip to N/A-by-design — but then python D8 itself becomes the anomaly to explain.

**Likewise the parked sub-scope GAPs** (the framework-reconciliation refresh gap on python/cargo/go rung 6) rest on interpreting the kickoff's rung-6 description — «`--refresh` reconciles renames/stale companions on this lane» — as promising framework-wide reconciliation, not just lane-artifact refresh. A stricter reading («on this lane» = lane-scoped only) would downgrade the sub-scope GAPs to N/A. The honest-signals framing in §5.3 is the load-bearing argument for keeping it as a parked finding.

**(b) The round-1-patch-unreachable fork (Option A vs B).** Would a different auditor have decided differently? A different auditor with round-1 access (the dispatching session) might preserve more of round-1's specific phrasings, especially for the §8.3 MINORs. But §8.5 T-R1-D's evidence bar applies regardless: round-1's text cannot serve as primary evidence for round-2's claims. Option B is the stricter choice — it forces every citation through the live tree. The cost is losing round-1's convenience (best-effort on the MINORs); the benefit is no second-hand-claim laundering. A different auditor following the same §8.5 bar would reach the same Option B.

**(c) The shelf-life finding (§6) — is the audit method itself the weakest cell?** Yes. A parity audit's value decays with every merged PR. Round-1 aged out in 5 days because PR #1171 (go lane) merged in the window between round-1's audit and round-2's rework. There is no mechanical mitigation: the audit is a point-in-time snapshot, and re-running it continuously would require either a gate (which violates `attention-is-not-a-mechanism.md §1` — parity audits are judgment-shaped, not mechanical) or a recurring human-attention commitment (which is the exact thing the project's thesis says cannot be a mechanism). The honest disclosure: this patch's verdicts are valid at SHA `2923ba6f4`; they may not be valid after the next merge. The shelf-life finding itself (§6) is the audit's most load-bearing output — it tells the dispatcher how long to trust the rest.

**T-R1-D self-application:** the §8.1/§8.2 anchors cited in the kickoff were treated as a *list of cells to verify*, not a *list of verdicts to confirm*. Every anchor was re-derived against the live tree; where the anchor diverged (round-1's `:544` for `do_refresh()` → live `:600`; round-1's `:663` for skill-reclaim → live `:684`; round-1's `:1041` for the refresh call site → live `:1097`), the live value is cited. No §8 anchor is carried forward by assertion.

## §9 §8.3 MINOR compliance log

| MINOR | Round-1 defect | Round-2 resolution |
|---|---|---|
| §8.3 MINOR 1 (SSOT #216 «literal quote» was normalised) | Round-1's §4.1 labelled its quote of SSOT #216 as «literal» but the quote was normalised (bold moved, parenthetical elided). | §4.1 quotes SSOT #216's Verdict column directly from the SSOT at `docs/meta-factory/prior-art-evaluations.md:289`. The word «literal» is **dropped** (per §8.3: «Either quote literally or drop the word») — the quote is the SSOT's own text, and the MISDECIDED classification rests on the role-mismatch, not on the quote's literalness. |
| §8.3 MINOR 2 (deceptive-rung observations buried inline) | Round-1 had two deceptive-rung observations as inline clauses only; §4 kickoff park-trigger requires them as their own findings with the hotfix question parked. | §5 elevates **three** findings (the round-1 two, re-derived, plus a third discovered in round-2): §5.1 the `[main]` default-branch substitution gap (python/cargo/go CI); §5.2 the cargo REFUSE-cell `getff-clippy.toml` (re-derived as honestly inert — NOT deceptive, round-1's flag corrected); §5.3 the framework-reconciliation refresh gap (python/cargo/go rung 6 sub-scope); §5.4 the cargo rung 5 delivery cascade. Each carries its own evidence + a PARKED hotfix question per §4. |
| §8.3 MINOR 3 («166 lines» rots) | Round-1 stated the kickoff was «166 lines» at `:14` and `:210`; line counts rot. | This patch cites **sections** (e.g. «kickoff §8.1», «kickoff §4») throughout, not line counts. The kickoff's actual length at round-2 is irrelevant to any claim made here. |

## See also

- `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` — the any-stack closure spec; wall 7(d) is the `[main]` default-branch origin; wall 7(e) is the skill-rename orphan origin.
- `docs/meta-factory/research-patches/2026-07-16-deps-hash-multistack.md` — the deps-hash-multistack research patch; §118 documents the «detection only; no rust delivery lane» boundary.
- `docs/meta-factory/research-patches/2026-07-25-getff-honest-signals-s6-done-md-correction-payload.md` — S6 (inject-matching-rule corpus-absent) closure record.
- `.claude/orchestrator-prompts/deps-hash-multistack/kickoff.md` — the deps-hash-multistack umbrella kickoff.
- `.claude/rules/phase-research-coverage.md` — the 6-item negative-existence checklist.
- `.claude/rules/attention-is-not-a-mechanism.md` — §1 (why the audit method itself cannot be mechanised into a gate).
