# consumer-truth-audit V3R — report-v3 (write-up of the 2026-09-08 host run)

> **Date:** 2026-09-09 · **Rigor label:** `build-and-verify` · **Re-verification bench:** this framework repo checkout, branch `feature/consumer-truth-audit-55970e`, HEAD `ea9ac409c8` (clean tree at session start).
> **Authoritative for:** the written-up answer to lane V3 from measurements taken on the operator's host on 2026-09-08, plus this session's §2 re-verification of every re-checkable citation at HEAD (2026-09-09).
> **NOT authoritative for:** any fix — DEC-1, the counting-claims gate and the parked forks are proposals (`kickoff-v3r.md` §5); the live-harness questions themselves (§probe-incomplete — they stayed unanswered); V0/V2 reports.
> **Attribution rule (gate 2, T-V3R-A):** every environment fact resolves to either a §2 verdict re-opened at HEAD on 2026-09-09, or an explicit `HOST-MEASURED 2026-09-08` label. There is no third register in this report.

## §scope

Lane V3 (`kickoff-v3.md` §0) asks whether the artefacts that only mean something inside an AI
harness are **delivered AND registered AND firing** at a consumer: hooks, MCP servers, skills,
settings registration — measured in a fresh consumer install (never this repo), under two
deliberate arms: **arm A** = a live Claude Code session on the host, **arm B** = the same
checklist under zcode. This stage (V3R) does **not** re-run V3 — `kickoff-v3.md:5` declares the
lane non-dispatchable to a container, and that stayed true. V3R writes up the 2026-09-08 host
measurements and re-verifies the code-citation half at HEAD.

| Row group | Arm that produced it |
|---|---|
| F1-F5 framework-repo citations (install.sh, docs, skills, agents, hooks, census) | neither arm — repo facts; re-verified at HEAD 2026-09-09 (§citation-verification) |
| F2 profile matrix (bench-core / bench-full / bench-factory, three fresh installs, all `exit 0`) | arm A (CC host) — delivery measurement · HOST-MEASURED 2026-09-08 |
| Consumer `AGENTS.md:32`, `RULES.md:34`, consumer `package.json` script count | arm A — generated consumer files on benches that no longer exist · HOST-MEASURED 2026-09-08, not re-checkable in this environment |
| F6: `PostToolUse` firing, MCP load in a fresh session, arm B (zcode) | arm A attempted and failed (`claude -p` OAuth); arm B never started · PROBE-INCOMPLETE |
| F7 run traps | arm A run-environment observations · HOST-MEASURED 2026-09-08 |

## §findings

### F1 — one shipped directory, one root cause (the lane's main finding)

**Attribution:** the symptoms were measured on the host benches on 2026-09-08 (HOST-MEASURED);
every framework-repo citation below was re-opened at HEAD on 2026-09-09 — verdicts in
§citation-verification.

`.claude/skills/orchestrator/references/` ships at the **`env` tier — the default profile**
(`install.sh:627` `"" ) PROFILE="env" ;;`, `:628` `2) PROFILE="env" ;;`, both CONFIRMED) and
carries three symptoms at once:

- **5 lines containing the absolute path** `/Users/art/code/rules-as-tests-aif` —
  `worker-template.md:73,82,107`, `reviewer-template.md:37`,
  `ai-laziness-traps-orchestrator.md:131`. Re-measured at HEAD: exactly 5 grep hits across
  exactly those 3 files. All five lines quoted in §citation-verification — CONFIRMED.
- **5 references to `npm run test:principles`**, a script a consumer `package.json` does not
  have (21 scripts on the bench — HOST-MEASURED 2026-09-08, not re-checkable). Re-measured at
  HEAD: exactly 5 lines in `references/` contain the string (`worker-template.md:45,73`,
  `reviewer-template.md:37`, `ai-laziness-traps-orchestrator.md:127,131`) — CONFIRMED.
- **9 of 11** dead `.claude/rules/*` citations written in bare backticks. Re-measured at HEAD:
  exactly **9** strict-backtick citations under `references/` (`ai-laziness-traps-orchestrator.md:3,137`,
  `reviewer-template.md:140`, `worker-template.md:120`, `queue-mode.md:22,290,448,449,450`) —
  the 9 matches; the "of 11" denominator is the host's counting over the bench copy
  (HOST-MEASURED, not reproduced here — see §self-falsification). All four cited rule files
  exist in this repo at HEAD, so «dead» means dead **at the consumer** — rules ship on no
  profile (F2) — not missing at source.

**Provenance — CONFIRMED, both commits reachable from this checkout:**
`aa7e6a17b2` 2026-08-17 «chore(skills): vendor the orchestrator skill into the repo (#1420)»
and `6d8dd9a3e7` 2026-08-17 «fix(docs): repoint every live ref to the vendored orchestrator
skill (D6.1) (#1452)». The vendoring arrived carrying the operator's machine path; #1452
repointed links *at* the copy without depersonalising it. Nothing in the repo's gates tracks
this class — the snapshot tests pin file hashes (host-run context, no specific citation given).

**DEC-1 refinement — the one place re-verification changed the finding's shape.** The host's
earliest-channel recommendation cites
`packages/core/principles/39-skill-fence-orch-home.test.ts` (:219-220, :237) and says «its
population is only `SKILL.md` files», so widening it to the whole skills tree would be the
narrow fix. Both cited lines exist and are CONFIRMED as content — but the claim they were
cited for is **refuted at HEAD, and was already false at the last pre-run commit
(`fb9b117f36`, 2026-09-02)**: the population function `skillDocs()` (:168-179) globs
`.claude/skills/*.md`, `.claude/skills/**/*.md` and `.claude/skills/**/*.template` — 51
tracked files, `references/**` included (verified: the glob returns
`.claude/skills/orchestrator/references/*.md` files). What **is** narrow is the *detector
pattern*: a single relative literal, `FRAMEWORK_ORCH_HOME = '.claude/orchestrator-prompts'`
(:94), fence-scoped (:156). `/Users/art/...` machine-absolute paths are simply outside its
pattern class. So the narrow fix keeps the test and widens the **pattern class**, not the
population — a smaller change than the host's wording implies. The mechanism control holds:
`pipeline/SKILL.md:32,87,112` all resolve `"$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" ...)"`
— CONFIRMED. DEC-1 remains a **proposal**; nothing was fixed here (out of scope, §5).

### F2 — the profile matrix (three fresh installs — HOST-MEASURED 2026-09-08)

| | core | env | factory |
|---|---|---|---|
| skills | 6 | 11 | 16 |
| agents | 11 | 11 | 11 |
| `.claude/rules/` | 0 | 0 | 0 |
| absolute path present | no | **5 lines** | **5 lines** |

Every cell in this table is HOST-MEASURED 2026-09-08 on benches `bench-core` / `bench-full` /
`bench-factory` (arm A), all three installs `exit 0`; the benches no longer exist and no cell
is re-checkable in this environment. Repo-side corroboration where re-checkable at HEAD: the
two factory-only discipline agents exist (`agents/orchestrator-worker-discipline.md`,
`agents/reviewer-discipline.md` — measured present), and the factory skill set is
`setup.d/lib.sh:63` (5 names, CONFIRMED). Hooks and agents are **profile-independent** — all
11 agents from `core` upward, exactly as the generated `AGENTS.md:32` promises
(HOST-MEASURED). Rules ship on **no profile at all**; together with the timeliner consumer
that is **four strata**, so the «this install is just stale» explanation is dead.

### F3 — counting claims in the docs are checked by nothing (structural)

**Attribution:** the drift was measured on the host run; every cited line was re-opened at
HEAD on 2026-09-09 and is CONFIRMED verbatim (§citation-verification).

The operator suite's size is stated as **three different numbers** in the project's own docs:
`README.md:123` → «6 skills + 2 agents», `INSTALL-FOR-AI.md:71` → «7 skills + 2 agents»,
`INSTALL-FOR-AI.md:459` → «5 skills (dispatcher, aif-doctor, harvest, story,
claude-glm-executor-handoff)». The SSOT `setup.d/lib.sh:63` = **5**
(`GETFF_SKILLS_FACTORY="dispatcher aif-doctor harvest story claude-glm-executor-handoff"`),
the generated consumer `AGENTS.md` = **5** (HOST-MEASURED), and the measured `env`→`factory`
delta = **5** (HOST-MEASURED). Exactly two sources are right: the code and the *generated* doc.

Same drift twice more. **Agents:** `INSTALL-FOR-AI.md:80` lists 11 (correct — it sits inside
the generated `getff:begin section=install-roster` block, :79-82), while `:97` («confirm the
10 files listed above») and `:370` («← 10 files at every depth») say 10 — wrong: the roster
became 11 on **2026-09-02** with `claims-conformance-auditor.md` (birth commit measured:
`7534fd9a48` 2026-09-02 «feat(beta-ai-docs-agnosticism): S3 … (#1550)»; the file is present at
HEAD). **Hooks:** `README.md:274` says «deepest coverage (all 20 hooks)» — CONFIRMED verbatim,
and wrong: the run measured **21** hook scripts (HOST-MEASURED), and the census table in
`zcode-parity-doctrine.md` §2 also listed **21** at run time. At HEAD the ground has moved:
`ls .claude/hooks/*.sh | wc -l` → **22** (`inject-handoff-on-compact.sh` was first added
**after** the run, by `1941d4a176` 2026-09-09 «feat(hooks): handoff-currency gate (D13) …
(#1680)»), and the census §2 now carries **22 rows** with the rollup «Total = 22 = `ls
.claude/hooks/*.sh | wc -l`» (:66). No interpretation yields 20 — the README claim is now off
by two, and the doc-vs-census drift **widened** after the run.

**Five incorrect counting claims across two public docs, and no channel checks any of them.**
The absence claim was re-verified at HEAD: `07-documents-lie.test.ts` checks `examples.bad` /
`examples.good` structural validity in the rules manifest (`MANIFEST_PATH` =
`../manifest/rules-manifest.json`, :29) — not numbers in docs (CONFIRMED, matching the host's
characterisation); the live doc-audit script's closest behaviour is an *existence* check
(`packages/core/audit-self/audit-ai-docs.sh:117` — «skill … declared in AGENTS.md but missing
from .claude/skills/»), not a count reconciliation. One search-surface correction to the
host's record: `scripts/audit-ai-docs.sh` is **GONE** — deleted 2026-05-08 (`962d55707b`
«cleanup(phase-3.1)…»), months before the run; the live copies at HEAD are
`packages/core/audit-self/audit-ai-docs.{sh,ts}` + preset twins, and the absence was
re-verified against the live copy. This is the project's own `#hope-as-gate` shape, in the two
documents a consumer opens first. The proposed narrow gate (a principle test reconciling
README / INSTALL-FOR-AI counting claims against their SSOTs) remains a **proposal** — not
built here.

## §not-a-defect

Checked on the host run and closed — carried so a later reader does not reopen them. Citations
re-verified at HEAD 2026-09-09; two lines drifted and are re-pointed below.

### F4 — checked and NOT a defect (do not reopen)

- `inject-project-digest.sh` being silent — the block ships empty **by design**. The host
  cited `session-bootstrap.md:13`; at HEAD that content lives in the **shipped template**:
  `.claude/templates/session-bootstrap.md:13` — «Zero-setup default: the block below ships
  EMPTY, so nothing is injected until you fill it.» — with the empty `<!-- digest:start -->` /
  `<!-- digest:end -->` markers at :17-18. The template is what a consumer gets
  (`install.sh:1018` and `setup.d/10-skills.sh:353` copy it to the consumer tree); the hook
  reads exactly those markers (`inject-project-digest.sh:36`). The repo-root
  `.claude/session-bootstrap.md` carries no markers at HEAD (grep → 0).
- `check-ask-files.sh` not shipping — the host cited `install.sh:1134`; at HEAD the statement
  sits at **`install.sh:1142`**: «scripts/check-ask-files.sh is NO LONGER DELIVERED (ledger
  C-2, #1597) … a gate that never ran there», with the read-only ORPHAN warning at :1149-1150.
  The paired negative exists at HEAD: `scripts/check-ask-files.test.sh` (measured present).
  The ledger document itself is GitHub-side (#1597) — not re-checkable from this container
  (no gh egress); the reference to it is verbatim in-repo.
- `self-reflection` not shipping — `install.sh:26-27` CONFIRMED: «ONLY self-reflection is
  intentionally NOT shipped — repo-internal §1.7 self-review discipline».
- The `factory` tier — `setup.d/lib.sh:63` CONFIRMED (the third tier variable).
- `arch` / `pipeline` absent from the model's skill list — CONFIRMED: both carry
  `disable-model-invocation: true` (`.claude/skills/arch/SKILL.md:6`,
  `.claude/skills/pipeline/SKILL.md:6`); they are explicit-`/<name>`-only by design.
- `AGENTS.md:32` — a table row about the `factory` profile, not a broken pointer
  (HOST-MEASURED, generated consumer file).
- `RULES.md:34` — a catalogue row with a stack column (HOST-MEASURED, generated consumer file).
- `pre-merge-local.sh:455` — the build call IS under the `_build_owed` guard; at HEAD the
  guard is at :448 (`if [ "$_build_owed" -eq 1 ] && [ "$_vrc" -eq 0 ]`) and the call at :450
  (`"$_pm" run build`), with :455 today being that block's FAIL echo — content moved ±5
  lines, claim intact.
- Markdown links to rules are rewritten to GitHub blob URLs and open (host-verified on the
  benches; mechanism lives at `setup.d/lib.sh` per the umbrella's §1 fact 2).

### F5 — checked and TRUE (do not reopen)

All `INSTALL-FOR-AI.md` claims re-verified CONFIRMED at HEAD: `:80` (11 agents, generated
roster), `:81` (11 skills on `env`, by name — 6 core + 5 contour), `:83` and `:97`
(orchestrator-worker-discipline + reviewer-discipline appear only at `--profile factory` /
`--with-aif-suite` / `--all`; measured at HEAD: both files exist in `agents/`), `:173`
(factory refresh gate names exactly `.claude/hooks/runtime-bridge-dispatch.sh` + the vendor
payload), `:376` (6 skill dirs at every depth), `:395` (the `05-mcp` layer merges context7 on
the full install path), `:459` (suite = 5 skills + 2 agents).

**`./setup -y` ≠ `install.sh -y`** — mechanism CONFIRMED at HEAD: the wrapper sets
`FULL="--full"` on `-y` (`setup:48`), while inside `install.sh` only `--full` (:128) and
`--all` (:158) set `FULL` (measured: those are the only two `FULL=` assignments besides the
empty init at :95; there is no `-y` branch in install.sh's arg parse). So `./setup -y` takes
the full path (merges MCP, per `INSTALL-FOR-AI.md:395`) and `install.sh -y` does not. Both
docs are right about their own entrypoint; the trap is treating them as interchangeable. (The
behavioural half — which bench got an `.mcp.json` — is HOST-MEASURED 2026-09-08.)

## §probe-incomplete

**PROBE-INCOMPLETE** (`kickoff-v3.md` §4 gate 7, verbatim standard: «anything unreachable
reported `PROBE-INCOMPLETE` with the reason, never guessed»).

`claude -p` failed machine-wide on the host: `OAuth session expired and could not be
refreshed` (HOST-MEASURED 2026-09-08). Without a headless session the run could not measure:

- **`PostToolUse` firing** in a live session — unasked;
- **MCP load** in a fresh session (which delivered servers come up) — unasked;
- **arm B under zcode** at all — the second harness never ran, so no CC-only-assumption row
  exists for the delivered artefacts.

Per `kickoff-v3.md` §4 gates 3 and 4, the skill-routing and MCP-load rows stay **unanswered**
— they are not «passing», they are missing. Per T14: coverage on the hook-firing / MCP-load /
zcode rows is **insufficient to conclude** anything; this report contains no clean result for
them, and none may be inferred from the delivery-level F2 rows (delivery ≠ firing — that is
the lane's own thesis). The fix is `claude login`, which is the operator's action; the lane
re-runs after that.

## §traps

Run traps worth carrying (all HOST-MEASURED 2026-09-08, arm-A run environment):

1. **`change_directory` does not reload every event.** `UserPromptSubmit` and `Stop` start
   using the new directory's hooks; `PostToolUse` does not. Discriminator for a future run:
   register your own probe hook that dumps its payload to a log — if that is silent too, the
   channel is silent, not the artefact. Mid-session `settings.json` edits are not picked up
   at all.
2. **A naive «path mentioned, file absent» detector has low precision here** — 154 pairs on
   the benches, most of them legitimate (descriptions of neighbouring tiers, catalogue rows
   for another stack, provenance quotes). Do not build a gate on it; only on the narrow
   DEC-1 subset (machine-absolute paths inside the shipped skills tree).
3. **`find -newermt` silently returns nothing on macOS** — use `-mmin`. (macOS host
   behaviour; this Linux container's `find` is not a counter-example either way.)

## §parked

Carried **verbatim and undecided** from `kickoff-v3r.md` §1 F8 — no recommendation laundering;
each is the operator's call:

- **PARK-1** — should rules ship at all.
- **PARK-2** — may the installer write to the machine-global area.
- **PARK-3** — context7 scope conflict.
- **PARK-4** — how much of the `factory` tier consumers get (*recommendation on record:
  switch the criterion from profile to runtime presence*).
- **PARK-5** — whether to promote the advisor seat.

## §citation-verification

Every framework-repo citation from `kickoff-v3r.md` §1, re-opened at HEAD `ea9ac409c8` on
2026-09-09 by this session (T3: quoted line per verdict). Consumer-bench rows are labelled,
never invented.

| Citation | Claim it supported | Verdict | Evidence (line content at HEAD) |
|---|---|---|---|
| `install.sh:623` | env is the interactive default | CONFIRMED | `read -rp "Choose [1/2/3] (default 2): " _profile_ans \|\| _profile_ans=""` |
| `install.sh:627` | empty answer → env | CONFIRMED | `"" ) PROFILE="env" ;;` |
| `install.sh:628` | option 2 → env | CONFIRMED | `2) PROFILE="env" ;;` |
| `references/worker-template.md:73` | absolute path shipped | CONFIRMED | `cd /Users/art/code/rules-as-tests-aif && npm run test:principles` |
| `references/worker-template.md:82` | absolute path shipped | CONFIRMED | `- DO NOT edit project-scope files: README.md, CLAUDE.md, .claude/rules/*, … (PROJECT scope inside /Users/art/code/rules-as-tests-aif/), …` |
| `references/worker-template.md:107` | absolute path shipped | CONFIRMED | table row: `` `<WORKDIR>` → `/Users/art/code/rules-as-tests-aif` (or project root) `` |
| `references/reviewer-template.md:37` | absolute path shipped | CONFIRMED | ``- Optionally re-run `cd /Users/art/code/rules-as-tests-aif && npm run test:principles` yourself to confirm; …`` |
| `references/ai-laziness-traps-orchestrator.md:131` | absolute path shipped | CONFIRMED | «…run `cd /Users/art/code/rules-as-tests-aif && npm run test:principles`. If any test fails → fix violation, re-run…» |
| 5× `test:principles` refs | script a consumer lacks | CONFIRMED | grep → 5 lines: worker:45,73; reviewer:37; ai-lazy:127,131 |
| 9 backtick `.claude/rules/*` citations | dead at consumer | CONFIRMED (the 9) | grep → exactly 9: ai-lazy:3,137; reviewer:140; worker:120; queue-mode:22,290,448,449,450 |
| «of 11» denominator | total citation population | HOST-MEASURED | host counting over bench copy; HEAD-side loose-pattern enumeration differs slightly (unwrapped mentions at worker:31,33; phase-minus-1:29) |
| `39-…fence-orch-home.test.ts:219-220` | population evidence | CONFIRMED as lines | `expect(files, 'the /pipeline SKILL.md must be in the population').toContain('.claude/skills/pipeline/SKILL.md')` |
| `39-…fence-orch-home.test.ts:237` | population evidence | CONFIRMED as lines | `const target = '.claude/skills/pipeline/SKILL.md';` |
| «population is only SKILL.md files» | DEC-1's widening premise | **REFUTED (claim) / DRIFTED (basis)** | `skillDocs()` :168-179 globs `.claude/skills/*.md`, `**/*.md`, `**/*.template` — 51 files, references included; same at pre-run `fb9b117f36`; narrow axis is the pattern (:94 relative literal, :156 fence scope) |
| `pipeline/SKILL.md:32,87,112` | `${CLAUDE_SKILL_DIR}` used correctly | CONFIRMED | all three resolve `"$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)"` |
| `aa7e6a17b2` (#1420) | vendoring provenance | CONFIRMED | 2026-08-17 «chore(skills): vendor the orchestrator skill into the repo (#1420)» |
| `6d8dd9a3e7` (#1452) | repoint-without-depersonalise | CONFIRMED | 2026-08-17 «fix(docs): repoint every live ref to the vendored orchestrator skill (D6.1) (#1452)» |
| F2 matrix (all cells) | three fresh installs | HOST-MEASURED | bench-core/full/factory, arm A, all `exit 0`; benches no longer exist |
| consumer `AGENTS.md:32` | agents profile-independent | HOST-MEASURED | generated consumer file, not re-checkable here |
| consumer `RULES.md:34` | catalogue row | HOST-MEASURED | generated consumer file, not re-checkable here |
| consumer `package.json` (21 scripts) | `test:principles` absent at consumer | HOST-MEASURED | bench file, not re-checkable here |
| `README.md:123` | suite stated as 6 | CONFIRMED | «`--all` — everything: `--yes` PLUS the AIF operator suite (6 skills + 2 agents + their skill-context…)» |
| `INSTALL-FOR-AI.md:71` | suite stated as 7 | CONFIRMED | «additionally ships the AIF operator suite (7 skills + 2 agents + skill-context) at `factory` depth…» |
| `INSTALL-FOR-AI.md:459` | suite stated as 5 (+2 agents) | CONFIRMED | «the AIF operator suite — 5 skills (dispatcher, aif-doctor, harvest, story, claude-glm-executor-handoff) + 2 agents…» |
| `setup.d/lib.sh:63` | SSOT = 5 | CONFIRMED | `GETFF_SKILLS_FACTORY="dispatcher aif-doctor harvest story claude-glm-executor-handoff"` |
| generated consumer `AGENTS.md` = 5 | generated doc right | HOST-MEASURED | bench-generated file, not re-checkable here |
| `INSTALL-FOR-AI.md:80` | 11 agents (correct) | CONFIRMED | «`.claude/agents/` — 11 files: aif-init, capability-reuse-auditor, claims-conformance-auditor, …» (inside generated roster block :79-82) |
| `INSTALL-FOR-AI.md:97` | says 10 (wrong) | CONFIRMED | «`ls -la .claude/agents/` — confirm the 10 files listed above exist; orchestrator-worker-discipline.md + reviewer-discipline.md appear only after --profile factory…» |
| `INSTALL-FOR-AI.md:370` | says 10 (wrong) | CONFIRMED | «`agents/` ← 10 files at every depth: aif-init, capability-reuse-auditor,» |
| roster became 11 on 2026-09-02 | drift date | CONFIRMED | `7534fd9a48` 2026-09-02 (#1550) adds `agents/claims-conformance-auditor.md`; file present at HEAD |
| `README.md:274` | says «all 20 hooks» | CONFIRMED | «**Claude Code** — primary dogfood harness; deepest coverage (all 20 hooks).» |
| 21 hook scripts at run | population then | HOST-MEASURED | host count 2026-09-08 |
| hooks = 22 at HEAD | population now | §2 re-measure | `ls .claude/hooks/*.sh \| wc -l` → 22; `inject-handoff-on-compact.sh` first added by `1941d4a176` 2026-09-09 (#1680) — post-run |
| census §2 «lists 21» | census agreed with 21 | **DRIFTED** | §2 at HEAD carries 22 rows; rollup :66: «Total = 22 = `ls .claude/hooks/*.sh \| wc -l`» — moved post-run, same commit wave |
| `07-documents-lie.test.ts` | closest candidate, wrong scope | CONFIRMED | `MANIFEST_PATH = resolve(HERE, '../manifest/rules-manifest.json')` (:29) — checks manifest examples, not doc numbers |
| `scripts/audit-ai-docs.sh` | host search surface | **GONE** | deleted `962d55707b` 2026-05-08 (before the run); live copy `packages/core/audit-self/audit-ai-docs.sh` — absence re-verified there (:117 is an existence check, not a count gate) |
| `session-bootstrap.md:13` | block ships empty by design | **DRIFTED** | content lives at `.claude/templates/session-bootstrap.md:13`: «Zero-setup default: the block below ships EMPTY, so nothing is injected until you fill it.» + empty markers :17-18; shipped at `install.sh:1018` / `10-skills.sh:353`; hook reads markers (`inject-project-digest.sh:36`); repo-root copy has 0 markers |
| `install.sh:1134` | check-ask-files not shipped | **DRIFTED** | now `install.sh:1142`: «scripts/check-ask-files.sh is NO LONGER DELIVERED (ledger C-2, #1597)…», ORPHAN warning :1149-1150; paired negative `scripts/check-ask-files.test.sh` present at HEAD |
| ledger «C-2 #1597» | closure record | PARTIAL | named verbatim in-repo at `install.sh:1142,1150`; the ledger document is GitHub-side — not re-checkable from this container (no gh egress) |
| `install.sh:26` | self-reflection not shipped | CONFIRMED | «ONLY self-reflection is intentionally NOT shipped — repo-internal §1.7 self-review discipline…» (:26-27) |
| `setup.d/lib.sh:63` (factory tier) | tier exists | CONFIRMED | same line as above |
| `arch/SKILL.md:6`, `pipeline/SKILL.md:6` | not model-invocable | CONFIRMED | both: `disable-model-invocation: true` |
| `pre-merge-local.sh:455` | call under `_build_owed` guard | **DRIFTED (±5 lines)** | guard now :448 `if [ "$_build_owed" -eq 1 ] && [ "$_vrc" -eq 0 ]; then`, call :450 `"$_pm" run build >>"$LOG_FILE" 2>&1`; :455 is that block's FAIL echo — claim intact |
| `INSTALL-FOR-AI.md:81` | 11 env skills by name | CONFIRMED | «`.claude/skills/` — 11 dirs at the default `env` depth: the 6-dir core set… plus the operator contour arch, night-mode, orchestrator, pipeline, reviewer» |
| `INSTALL-FOR-AI.md:83` | two discipline agents, factory only | CONFIRMED | «orchestrator-worker-discipline + reviewer-discipline appear only at --profile factory / --with-aif-suite / --all» |
| `INSTALL-FOR-AI.md:173` | factory adds runtime-bridge-dispatch.sh | CONFIRMED | «…the `.claude/vendor/runtime-bridge/` payload and the `.claude/hooks/runtime-bridge-dispatch.sh` dispatch hook, now refresh on the `factory \| --with-aif-suite \| already-on-disk` gate…» |
| `INSTALL-FOR-AI.md:376` | 6 dirs at every depth | CONFIRMED | «`skills/` ← 6 dirs at every depth: getff, tool-bootstrapping,» |
| `INSTALL-FOR-AI.md:395` | context7 MCP on full path | CONFIRMED | «…the `05-mcp` layer merges a context7 server entry into your `.mcp.json` on the full install path (`./setup -y` / `--full»)» |
| `setup:48` | wrapper adds `--full` on `-y` | CONFIRMED | `-y\|--yes)          MODE="yes"; FULL="--full" ;;` |
| `install.sh:128,158` | only FULL-setting branches | CONFIRMED | :128 `--full) FULL="--full" ;;`; :158 `--all) FULL="--full"; WITH_AIF_SUITE="--with-aif-suite" ;;`; no `-y` branch exists; :95 inits empty |
| `kickoff-v3.md` §4 gates 7, 8 | report grammar | CONFIRMED | :70 «anything unreachable reported `PROBE-INCOMPLETE` with the reason, never guessed»; :71 «self-falsification section present and non-trivial» |
| F6 OAuth failure; F7 all three traps | run events | HOST-MEASURED | arm-A run environment, 2026-09-08 |

Count: 51 rows adjudicated — every framework-repo citation from §1 of the stage kickoff
carries a verdict; none skipped (gate 1). Tally: 36 CONFIRMED, 5 DRIFTED, 1 GONE,
8 HOST-MEASURED, 1 PARTIAL, 1 REFUTED-claim (its basis row also DRIFTED), 1 HEAD re-measure.

## §self-falsification

Umbrella §7.2 + `kickoff-v3.md` §4 gate 8 + T15. What would have to be true for these
findings to be wrong, and what this write-up could not see:

- **Weakest claim: the «9 of 11» backtick-citation population.** This report reproduces the
  9 under one strict grep pattern but could not reproduce the host's denominator (11). If the
  host counted mentions rather than backtick-wrapped citations — or counted over the bench
  copy, which could differ from this repo's copy — the «of 11» half is wrong while the 9 stay
  right. Attack command: `grep -rno '\`\.claude/rules/[^`]*\`' .claude/skills/orchestrator/references/ | wc -l`
  (→ 9 here) versus any looser pattern, and diff the bench copy if it is ever recovered.
- **Second weakest: the DEC-1 refinement.** It rests on reading `skillDocs()` (:168-179) as
  the population and verifying the glob reaches `references/`. Attack: `git ls-files
  '.claude/skills/**/*.md' | grep references/ | wc -l` (→ non-zero here). If the host meant
  «the test only *asserts* about SKILL.md» rather than «only scans SKILL.md», the practical
  difference is small — but the fix shape differs (pattern-class widening vs population
  widening), which is why the refinement is recorded at all.
- **What this write-up could not see:** the host run's raw logs, bench terminal output, and
  the operator's judgement calls — only the inlined summary plus what HEAD still carries. The
  ground also **moved under this report while it was being written**: hooks 21→22 and census
  §2 21→22 rows landed 2026-09-09 (`1941d4a176`), one day after the measurements. Any HEAD
  count in this report is a 2026-09-09 snapshot, not a permanent fact; the consumer-bench
  rows can never be re-checked (benches deleted), so F2's matrix is unfalsifiable from here —
  its authority rests entirely on the host-run attribution.
- **T15 self-application:** the framework's thesis is that every rule is an executable
  artefact that fails at the earliest reachable channel. This report is a prose artefact; its
  self-application is that every §2 row carries the command or `file:line` needed to re-run
  it, and that its own subject matter demonstrates the thesis *failing*: F1's defect class
  (shipped machine-absolute paths) is caught by **no** gate — measured, not asserted, via the
  fence test's pattern (:94, a relative literal) vs the shipped absolute paths. The one
  channel that would catch it is exactly DEC-1's proposal, which this stage deliberately did
  not build.
- **T7 counter-prompts, run against the draft** (the five from the plan): (1) «which CONFIRMED
  did I not re-open at HEAD?» — none; every CONFIRMED row traces to a grep/awk/git executed in
  this session. (2) «where did the summary's hedges get smoothed?» — two places were caught
  and kept hedged: the «of 11» denominator (not reproduced) and F5's behavioural MCP half
  (HOST-MEASURED, mechanism-only here). (3) «which environment fact resolves to neither
  register?» — the two-register scan (task 4) returned zero unlabelled environment facts on
  its first pass: every bench-name occurrence (§scope, §findings F2, §citation-verification)
  already carried the HOST-MEASURED label, and the only «this run» hit in the attribution
  grep is the gate-table row quoting the gate itself. (4) «what did the write-up not see?» — the blind spots above. (5) «did I
  invent a container result for a bench row?» — no; every bench row is labelled HOST-MEASURED
  and three are additionally marked not-re-checkable.

## §gate-table

| # | Gate (`kickoff-v3r.md` §4) | Result | Evidence |
|---|---|---|---|
| 1 | every framework-repo citation carries a §2 verdict, none skipped | PASS | §citation-verification: 51 rows; every §1 citation enumerated in the plan's population list appears; 5 DRIFTED / 1 GONE / 1 REFUTED-claim / 1 PARTIAL, rest CONFIRMED or HOST-MEASURED |
| 2 | no claim attributed to this run; live-harness rows say host-measured + date | PASS | attribution rule in the header; every bench row labelled `HOST-MEASURED 2026-09-08`; HEAD rows dated 2026-09-09 |
| 3 | F6 present, labelled `PROBE-INCOMPLETE`, never softened | PASS | §probe-incomplete; hook/MCP/zcode rows state «insufficient to conclude» (T14), gates 3/4 rows explicitly unanswered |
| 4 | parked forks carried undecided | PASS | §parked: five PARK items verbatim, no recommendation added |
| 5 | `§self-falsification` present and non-trivial | PASS | weakest claim + attack command + cannot-see list + T7 runs recorded |
| 6 | nothing outside `report-v3.md` is modified | PASS | verified at commit time (Task 6/7): `git status` shows only this file |
